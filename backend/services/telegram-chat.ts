/**
 * Telegram Chat Service
 *
 * Handles message processing for Telegram integration
 * - Message processing with tool execution
 * - Telegram-specific response formatting
 * - Intelligent context management to prevent token overflow
 * - Task intent analysis for smart clarification
 */

import {
  CHAT_SYSTEM_PROMPT,
  analyzeTaskIntent,
  buildSystemPromptWithIntent,
} from "./chat-context.js";
import {
  buildTelegramContext,
  estimateTokens,
  validateContextSize,
} from "./telegram-context-manager.js";
import {
  getConversationContext,
  storeTelegramMessage,
} from "./telegram-conversation-manager.js";

import OpenAI from "openai";
import { extractAllTextToolCalls } from "./chat-tools.js";
import { flowTracker } from "./flow-tracker.js";
import { getChatProvider } from "./chat-provider.js";
import { getDefaultMaxTokens } from "../controllers/ai-settings.controller.js";
import { injectContextIntoPrompt } from "./llm-router.js";
import { memorySearchService } from "./memory-search.js";
import { randomBytes } from "crypto";
import { sanitizeToolResult } from "./sanitize-tool-results.js";
import { toolExecutorService } from "./tool-executor.js";
import { validateMaxTokens } from "../utils/token-validator.js";

type ToolFunctionDefinition = {
  name: string;
  description?: string;
  parameters?: Record<string, any>;
};

type LlmTool = {
  type: "function";
  function: ToolFunctionDefinition;
};

type ChatMessageParam = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
};

/**
 * Process a message from Telegram and return the AI response
 */
export async function processTelegramMessage(
  userId: string,
  message: string,
): Promise<string> {
  const startTime = Date.now();
  const flowId = randomBytes(8).toString("hex");

  try {
    console.log(
      `[Telegram] Processing message for user ${userId}: ${message.substring(0, 50)}...`,
    );

    flowTracker.startFlow(flowId, "chat");
    flowTracker.trackEvent({
      flowId,
      stage: "telegram_received",
      service: "Telegram",
      status: "started",
      data: { messageLength: message.length },
    });

    // Get provider configuration
    const providerData = await getChatProvider(userId);
    if (!providerData) {
      return "❌ AI provider not configured. Please set up your AI settings in the web interface.";
    }

    const { provider, modelId } = providerData;

    // Validate model ID isn't a numeric database ID
    if (/^\d+$/.test(modelId)) {
      console.error(
        `[Telegram] Invalid model ID: "${modelId}". Model configuration appears corrupted.`,
      );
      return "❌ Your AI model configuration appears to be corrupted. Please reconfigure your AI settings.";
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: provider.apiKey,
      baseURL: provider.baseUrl,
    });

    // Search for relevant memories
    let memoryContext = "";
    try {
      const searchResults = await memorySearchService.semanticSearch(
        userId,
        message,
        5,
      );
      const results = Array.isArray(searchResults)
        ? searchResults
        : searchResults?.results || [];
      if (results.length > 0) {
        memoryContext = results
          .map((m: any) => `- ${m.memory?.content || m.content}`)
          .join("\n");
      }
    } catch (error) {
      console.warn("[Telegram] Failed to search memories:", error);
    }

    // Analyze task intent for smart clarification
    const taskIntentAnalysis = analyzeTaskIntent(message);

    if (taskIntentAnalysis.isTaskRequest) {
      flowTracker.trackEvent({
        flowId,
        stage: "task_intent_analysis",
        service: "TaskIntentAnalyzer",
        status: "success",
        data: {
          taskType: taskIntentAnalysis.taskType,
          subject: taskIntentAnalysis.extractedEntities.subject?.type,
          location: taskIntentAnalysis.extractedEntities.location,
          onlyOnChange: taskIntentAnalysis.notificationIntent.onlyOnChange,
          needsClarification: taskIntentAnalysis.clarification?.needed,
          confidence: taskIntentAnalysis.confidence,
        },
      });
    }

    // Build system prompt with context and intent analysis
    const memoryContextArray = memoryContext
      ? memoryContext.split("\n").filter((line) => line.trim())
      : [];

    let systemPrompt = buildSystemPromptWithIntent(
      CHAT_SYSTEM_PROMPT,
      memoryContextArray,
      taskIntentAnalysis,
    );

    const systemPromptWithContext = await injectContextIntoPrompt(
      systemPrompt,
      userId,
    );

    const maxTokens = await getDefaultMaxTokens(userId);

    // Build context with intelligent token management
    const contextBuilt = await buildTelegramContext(
      userId,
      message,
      systemPromptWithContext,
      modelId,
      maxTokens,
    );

    if (contextBuilt.warning) {
      console.warn(`[Telegram] ${contextBuilt.warning}`);
    }

    const toolSchemas = (await toolExecutorService.getToolSchemasWithGenerated(
      userId,
    )) as ToolFunctionDefinition[];
    const llmTools: LlmTool[] = toolSchemas.map((schema) => ({
      type: "function",
      function: schema,
    }));

    // Use intelligently built context instead of single message
    const messages: ChatMessageParam[] = contextBuilt.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Validate context size before sending to LLM
    const contextValidation = validateContextSize(
      contextBuilt.messages,
      modelId,
      maxTokens,
    );
    if (!contextValidation.isValid) {
      console.error(
        `[Telegram] Context overflow: ${contextValidation.estimatedTokens} tokens exceeds ${maxTokens} limit`,
      );
      // Remove oldest messages if we still overflow
      while (
        messages.length > 2 &&
        !validateContextSize(messages as any, modelId, maxTokens).isValid
      ) {
        messages.splice(1, 1); // Remove message before current user message
      }
    }

    let finalResponse = "";
    let iterationCount = 0;
    let consecutiveFailures = 0;
    const MAX_ITERATIONS = 10;
    const MAX_CONSECUTIVE_FAILURES = 4;

    while (iterationCount < MAX_ITERATIONS) {
      iterationCount++;

      const messagesStr = messages
        .map((m) =>
          typeof m.content === "string" ? m.content.substring(0, 1000) : "",
        )
        .join(" ");

      const validation = validateMaxTokens(
        maxTokens,
        modelId,
        messages.length,
        messagesStr,
      );
      let tokensForCall = validation.maxTokens;
      if (validation.warning) {
        console.warn(`[Telegram] ${validation.warning}`);
      }

      const response = await openai.chat.completions.create({
        model: modelId,
        messages: messages as any,
        temperature: 0.7,
        max_tokens: tokensForCall,
        tools: llmTools,
        tool_choice: "auto",
        stream: false,
      });

      const assistantMessage = response.choices[0]?.message;
      if (!assistantMessage) {
        break;
      }

      const assistantContent = assistantMessage.content || "";

      const textToolCalls =
        assistantContent &&
        (!assistantMessage.tool_calls ||
          assistantMessage.tool_calls.length === 0)
          ? extractAllTextToolCalls(assistantContent)
          : [];

      if (textToolCalls.length > 0) {
        const batchToolCallId = `telegram_text_tool_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`;
        const toolResults = [];

        for (let i = 0; i < textToolCalls.length; i++) {
          const { toolId, params } = textToolCalls[i];
          const toolCallId = `${batchToolCallId}_${i}`;
          const action = params.action || "request";
          let result;

          try {
            result = await toolExecutorService.executeTool(userId, {
              toolId,
              action,
              params,
            });
          } catch (toolError: any) {
            result = {
              success: false,
              error:
                toolError instanceof Error
                  ? toolError.message
                  : String(toolError),
              data: null,
              executionTime: 0,
              toolUsed: toolId,
            };
          }

          const sanitized = sanitizeToolResult(result.data);
          const payload = {
            toolId,
            success: result.success,
            data: sanitized.cleaned,
            error: result.error,
          };

          toolResults.push({
            toolCallId,
            toolId,
            payload,
          });
        }

        messages.push({
          role: "assistant",
          content: assistantContent,
          tool_calls: textToolCalls.map((tc, idx) => ({
            id: `${batchToolCallId}_${idx}`,
            type: "function",
            function: {
              name: tc.toolId,
              arguments: JSON.stringify(tc.params),
            },
          })),
        });

        toolResults.forEach((result) => {
          messages.push({
            role: "tool",
            tool_call_id: result.toolCallId,
            content: JSON.stringify(result.payload),
          });
        });

        const anySuccess = toolResults.some((r) => r.payload.success);
        consecutiveFailures = anySuccess ? 0 : consecutiveFailures + 1;

        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          finalResponse =
            "❌ Impossible d'exécuter l'outil demandé. Peux-tu reformuler ?";
          break;
        }

        continue;
      }

      if (
        assistantMessage.tool_calls &&
        assistantMessage.tool_calls.length > 0
      ) {
        type ParsedToolArgs = {
          action?: string;
          [key: string]: any;
        };

        const toolRequests = assistantMessage.tool_calls.map(
          (toolCall: any) => {
            let args: ParsedToolArgs = {};
            try {
              args = JSON.parse(toolCall.function.arguments || "{}");
            } catch {
              args = {};
            }

            return {
              toolId: toolCall.function.name,
              action: args.action || "request",
              params: args,
              _toolCallId: toolCall.id,
            };
          },
        );

        const toolResults = await toolExecutorService.executeToolsInParallel(
          userId,
          toolRequests,
          7000,
          60000,
        );

        messages.push({
          role: "assistant",
          content: assistantContent,
          tool_calls: assistantMessage.tool_calls,
        });

        toolResults.forEach((result, index) => {
          const request = toolRequests[index];
          const sanitized = sanitizeToolResult(result.data);
          const payload = {
            toolId: request.toolId,
            success: result.success,
            data: sanitized.cleaned,
            error: result.error,
          };

          messages.push({
            role: "tool",
            tool_call_id: request._toolCallId,
            content: JSON.stringify(payload),
          });
        });

        const anySuccess = toolResults.some((r) => r.success);
        consecutiveFailures = anySuccess ? 0 : consecutiveFailures + 1;

        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          finalResponse =
            "❌ Plusieurs outils ont échoué. Peux-tu reformuler ou réessayer ?";
          break;
        }

        continue;
      }

      finalResponse = assistantContent;
      break;
    }

    if (!finalResponse) {
      finalResponse = "❌ Je n'ai pas pu générer de réponse pour le moment.";
    }

    console.log(`[Telegram] Response generated in ${Date.now() - startTime}ms`);

    // Store messages in conversation history
    try {
      await storeTelegramMessage(userId, "user", message);
      if (finalResponse && !finalResponse.startsWith("❌")) {
        await storeTelegramMessage(userId, "assistant", finalResponse);
      }
    } catch (storageError) {
      console.warn(
        "[Telegram] Failed to store message in history:",
        storageError,
      );
    }

    flowTracker.trackEvent({
      flowId,
      stage: "telegram_response",
      service: "Telegram",
      status: "success",
      duration: Date.now() - startTime,
      data: {
        iterations: iterationCount,
        contextTokens: contextBuilt.contextTokens,
      },
    });
    flowTracker.completeFlow(flowId, "completed");

    return finalResponse;
  } catch (error: any) {
    console.error("[Telegram] Error processing message:", error);

    flowTracker.trackEvent({
      flowId,
      stage: "telegram_response",
      service: "Telegram",
      status: "failed",
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    });
    flowTracker.completeFlow(flowId, "failed");

    return `❌ Sorry, I couldn't process your message: ${error.message}`;
  }
}
