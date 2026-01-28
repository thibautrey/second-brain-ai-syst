/**
 * Chat Response Service
 *
 * Provides a reusable interface for getting AI responses with tool support.
 * Used by both the chat controller (streaming) and other services like
 * continuous-listening (non-streaming, notification-based).
 *
 * This service encapsulates:
 * - Provider configuration and fallback handling
 * - System prompt building with memory context
 * - Tool execution loop
 * - Error recovery
 */

import {
  CHAT_SYSTEM_PROMPT,
  buildMemoryContext,
  prepareSystemPrompt,
} from "./chat-context.js";
import {
  executeFunctionCalls,
  executeTextToolCalls,
  extractAllTextToolCalls,
} from "./chat-tools.js";

import { CHAT_CONFIG } from "../config/chat-config.js";
import OpenAI from "openai";
import { flowTracker } from "./flow-tracker.js";
import { getChatProvider } from "./chat-provider.js";
import { getTemperatureForModel } from "./llm-router.js";
import { randomBytes } from "crypto";
import { toolExecutorService } from "./tool-executor.js";

export interface ChatResponseOptions {
  /** Additional context to include in system prompt (e.g., audio processing status) */
  additionalContext?: string;
  /** Maximum tool call iterations (default: 30 from CHAT_CONFIG) */
  maxIterations?: number;
  /** Maximum tokens for response (default: 1000) */
  maxTokens?: number;
  /** Whether to include memory search (default: true) */
  includeMemorySearch?: boolean;
  /** Number of memories to retrieve (default: 3) */
  memoryCount?: number;
  /** Custom system prompt override (uses CHAT_SYSTEM_PROMPT if not provided) */
  customSystemPrompt?: string;
  /** Previous messages for conversation context */
  previousMessages?: Array<{ role: "user" | "assistant"; content: string }>;
  /** Callback for tool execution events */
  onToolCall?: (toolName: string, iteration: number) => void;
}

export interface ChatResponseResult {
  success: boolean;
  response: string;
  toolsUsed: Array<{
    tool: string;
    success: boolean;
    executionTime?: number;
  }>;
  totalIterations: number;
  error?: string;
  flowId: string;
}

/**
 * Standard chat message format for OpenAI API
 * Exported for use across chat services
 */
export type ChatMessageParam = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
};

/**
 * Get an AI response for a message with full tool support
 *
 * This is a non-streaming version that returns the complete response.
 * Perfect for background processing, notifications, and voice responses.
 */
export async function getChatResponse(
  userId: string,
  message: string,
  options: ChatResponseOptions = {},
): Promise<ChatResponseResult> {
  const {
    additionalContext = "",
    maxIterations = CHAT_CONFIG.MAX_ITERATIONS,
    maxTokens = 1000,
    includeMemorySearch = true,
    memoryCount = 3,
    customSystemPrompt,
    previousMessages = [],
    onToolCall,
  } = options;

  const flowId = randomBytes(8).toString("hex");
  const startTime = Date.now();
  const allToolResults: any[] = [];

  flowTracker.startFlow(flowId, "chat");
  flowTracker.trackEvent({
    flowId,
    stage: "chat_response_started",
    service: "ChatResponseService",
    status: "started",
    data: {
      messageLength: message.length,
      hasAdditionalContext: !!additionalContext,
    },
  });

  try {
    // 1. Get provider configuration
    const providerResult = await getChatProvider(userId);
    if (!providerResult) {
      return {
        success: false,
        response: "",
        toolsUsed: [],
        totalIterations: 0,
        error: "No LLM provider configured",
        flowId,
      };
    }

    const { provider, modelId, fallbackProvider, fallbackModelId } =
      providerResult;

    // 2. Build memory context (optional)
    let memoryContext = "";
    if (includeMemorySearch) {
      try {
        const memoryResult = await buildMemoryContext(
          userId,
          message,
          memoryCount,
        );
        if (memoryResult.memoryContext.length > 0) {
          memoryContext = `\n\nRelevant memories:\n${memoryResult.memoryContext.map((m, i) => `${i + 1}. ${m}`).join("\n")}`;
        }
      } catch (error) {
        console.warn("[ChatResponseService] Memory search failed:", error);
      }
    }

    // 3. Build system prompt
    const basePrompt = customSystemPrompt || CHAT_SYSTEM_PROMPT;
    const fullContext = `${memoryContext}${additionalContext ? `\n\n${additionalContext}` : ""}`;
    const systemPromptWithMemory = basePrompt + fullContext;
    const systemPrompt = await prepareSystemPrompt(
      systemPromptWithMemory,
      userId,
    );

    // 4. Create OpenAI client
    const openai = new OpenAI({
      apiKey: provider.apiKey,
      baseURL: provider.baseUrl || "https://api.openai.com/v1",
    });

    // 5. Get tool schemas (including generated tools)
    const toolSchemas =
      await toolExecutorService.getToolSchemasWithGenerated(userId);

    // 6. Build initial messages
    const messages: ChatMessageParam[] = [
      { role: "system", content: systemPrompt },
    ];

    // Add previous messages for context
    for (const prevMsg of previousMessages) {
      messages.push({
        role: prevMsg.role,
        content: prevMsg.content,
      });
    }

    messages.push({ role: "user", content: message });

    // 7. LLM call loop with tool execution
    let fullResponse = "";
    let iterationCount = 0;
    let consecutiveFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = CHAT_CONFIG.MAX_CONSECUTIVE_FAILURES;

    while (iterationCount < maxIterations) {
      iterationCount++;

      try {
        const chatTemp = getTemperatureForModel(modelId, 0.7);
        const chatPayload: any = {
          model: modelId,
          messages: messages as any,
          max_tokens: maxTokens,
          tools:
            toolSchemas.length > 0
              ? toolSchemas.map((schema: any) => ({
                  type: "function" as const,
                  function: schema,
                }))
              : undefined,
          tool_choice: toolSchemas.length > 0 ? "auto" : undefined,
        };

        // Only add temperature if the model supports it
        if (chatTemp !== undefined) {
          chatPayload.temperature = chatTemp;
        }

        const response = await openai.chat.completions.create(chatPayload);

        const assistantMessage = response.choices[0]?.message;
        if (!assistantMessage) break;

        // Check for text-based tool calls (fallback pattern)
        const textToolCalls =
          assistantMessage.content &&
          (!assistantMessage.tool_calls ||
            assistantMessage.tool_calls.length === 0)
            ? extractAllTextToolCalls(assistantMessage.content)
            : [];

        // Execute text-based tool calls
        if (textToolCalls.length > 0) {
          const toolResult = await executeTextToolCallsNonStreaming(
            userId,
            textToolCalls,
            flowId,
            iterationCount,
            onToolCall,
          );

          allToolResults.push(...toolResult.toolResults);

          // Add to message history
          const batchToolCallId = `text_tool_batch_${Date.now()}`;
          messages.push({
            role: "assistant",
            content: assistantMessage.content || null,
            tool_calls: textToolCalls.map((tc, idx) => ({
              id: `${batchToolCallId}_${idx}`,
              type: "function",
              function: {
                name: tc.toolId,
                arguments: JSON.stringify(tc.params),
              },
            })),
          });

          toolResult.toolCallResults.forEach((result) => {
            messages.push({
              role: "tool",
              tool_call_id: result.toolCallId,
              name: result.toolId,
              content: JSON.stringify({
                success: result.success,
                data: result.data,
                error: result.error,
              }),
            });
          });

          const allFailed = toolResult.toolCallResults.every((r) => !r.success);
          consecutiveFailures = allFailed ? consecutiveFailures + 1 : 0;

          if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            console.warn(
              `[ChatResponseService] Circuit breaker: ${consecutiveFailures} consecutive failures`,
            );
            break;
          }

          continue;
        }

        // Execute function-call based tools
        if (
          assistantMessage.tool_calls &&
          assistantMessage.tool_calls.length > 0
        ) {
          const toolResult = await executeFunctionCallsNonStreaming(
            userId,
            assistantMessage.tool_calls,
            flowId,
            iterationCount,
            onToolCall,
          );

          allToolResults.push(...toolResult.toolResults);

          // Add to message history
          messages.push({
            role: "assistant",
            content: assistantMessage.content,
            tool_calls: assistantMessage.tool_calls,
          });

          toolResult.toolRequests.forEach((req, index) => {
            const result = toolResult.toolResults[index];
            messages.push({
              role: "tool",
              tool_call_id: req._toolCallId,
              name: req.toolId,
              content: JSON.stringify({
                success: result.success,
                data: result.data,
                error: result.error,
              }),
            });
          });

          const allFailed = toolResult.toolResults.every((r) => !r.success);
          consecutiveFailures = allFailed ? consecutiveFailures + 1 : 0;

          if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            console.warn(
              `[ChatResponseService] Circuit breaker: ${consecutiveFailures} consecutive failures`,
            );
            break;
          }

          continue;
        }

        // No tool calls - we have the final response
        fullResponse = assistantMessage.content || "";
        break;
      } catch (llmError: any) {
        console.error(`[ChatResponseService] LLM error:`, llmError.message);

        // Try fallback provider if available
        if (fallbackProvider && fallbackModelId) {
          try {
            const fallbackOpenAI = new OpenAI({
              apiKey: fallbackProvider.apiKey,
              baseURL: fallbackProvider.baseUrl || "https://api.openai.com/v1",
            });

            const fallbackTemp = getTemperatureForModel(fallbackModelId, 0.7);
            const fallbackPayload: any = {
              model: fallbackModelId,
              messages: messages as any,
              max_tokens: maxTokens,
            };

            // Only add temperature if the model supports it
            if (fallbackTemp !== undefined) {
              fallbackPayload.temperature = fallbackTemp;
            }

            const fallbackResponse =
              await fallbackOpenAI.chat.completions.create(fallbackPayload);

            fullResponse = fallbackResponse.choices[0]?.message?.content || "";
            break;
          } catch (fallbackError) {
            console.error(
              `[ChatResponseService] Fallback also failed:`,
              fallbackError,
            );
          }
        }

        throw llmError;
      }
    }

    flowTracker.trackEvent({
      flowId,
      stage: "chat_response_complete",
      service: "ChatResponseService",
      status: "success",
      duration: Date.now() - startTime,
      data: {
        responseLength: fullResponse.length,
        iterations: iterationCount,
        toolsUsed: allToolResults.length,
      },
    });

    flowTracker.completeFlow(flowId, "completed");

    return {
      success: true,
      response: fullResponse,
      toolsUsed: allToolResults.map((r) => ({
        tool: r.toolUsed,
        success: r.success,
        executionTime: r.executionTime,
      })),
      totalIterations: iterationCount,
      flowId,
    };
  } catch (error: any) {
    flowTracker.trackEvent({
      flowId,
      stage: "chat_response_error",
      service: "ChatResponseService",
      status: "failed",
      data: { error: error.message },
    });

    flowTracker.completeFlow(flowId, "failed");

    return {
      success: false,
      response: "",
      toolsUsed: allToolResults.map((r) => ({
        tool: r.toolUsed,
        success: r.success,
      })),
      totalIterations: 0,
      error: error.message,
      flowId,
    };
  }
}

/**
 * Execute text-based tool calls (non-streaming version)
 */
async function executeTextToolCallsNonStreaming(
  userId: string,
  textToolCalls: Array<{
    toolId: string;
    params: Record<string, any>;
    start: number;
    end: number;
  }>,
  flowId: string,
  iterationCount: number,
  onToolCall?: (toolName: string, iteration: number) => void,
): Promise<{
  toolCallResults: Array<{
    toolCallId: string;
    toolId: string;
    success: boolean;
    data: any;
    error?: string;
  }>;
  toolResults: Array<{
    toolUsed: string;
    success: boolean;
    data?: any;
    error?: string;
    executionTime?: number;
  }>;
}> {
  const batchToolCallId = `text_tool_batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const toolCallResults: Array<{
    toolCallId: string;
    toolId: string;
    success: boolean;
    data: any;
    error?: string;
  }> = [];
  const toolResults: Array<{
    toolUsed: string;
    success: boolean;
    data?: any;
    error?: string;
    executionTime?: number;
  }> = [];

  for (let i = 0; i < textToolCalls.length; i++) {
    const tc = textToolCalls[i];
    const toolCallId = `${batchToolCallId}_${i}`;

    onToolCall?.(tc.toolId, iterationCount);

    flowTracker.trackEvent({
      flowId,
      stage: `tool_execution_text_${iterationCount}_${i}`,
      service: "ToolExecutor",
      status: "started",
      data: { tool: tc.toolId, params: tc.params },
    });

    try {
      const startTime = Date.now();
      const result = await toolExecutorService.executeTool(userId, {
        toolId: tc.toolId,
        action: tc.params.action || "default",
        params: tc.params,
      });

      const executionTime = Date.now() - startTime;

      toolCallResults.push({
        toolCallId,
        toolId: tc.toolId,
        success: result.success,
        data: result.data,
        error: result.error,
      });

      toolResults.push({
        toolUsed: tc.toolId,
        success: result.success,
        data: result.data,
        error: result.error,
        executionTime,
      });

      flowTracker.trackEvent({
        flowId,
        stage: `tool_execution_text_${iterationCount}_${i}`,
        service: "ToolExecutor",
        status: result.success ? "success" : "failed",
        duration: executionTime,
        data: { tool: tc.toolId, success: result.success },
      });
    } catch (error: any) {
      toolCallResults.push({
        toolCallId,
        toolId: tc.toolId,
        success: false,
        data: null,
        error: error.message,
      });

      toolResults.push({
        toolUsed: tc.toolId,
        success: false,
        error: error.message,
      });
    }
  }

  return { toolCallResults, toolResults };
}

/**
 * Execute function-call based tool calls (non-streaming version)
 */
async function executeFunctionCallsNonStreaming(
  userId: string,
  toolCalls: any[],
  flowId: string,
  iterationCount: number,
  onToolCall?: (toolName: string, iteration: number) => void,
): Promise<{
  toolRequests: Array<{
    toolId: string;
    params: Record<string, any>;
    _toolCallId: string;
  }>;
  toolResults: Array<{
    toolUsed: string;
    success: boolean;
    data?: any;
    error?: string;
    executionTime?: number;
  }>;
}> {
  const toolRequests: Array<{
    toolId: string;
    params: Record<string, any>;
    _toolCallId: string;
  }> = [];
  const toolResults: Array<{
    toolUsed: string;
    success: boolean;
    data?: any;
    error?: string;
    executionTime?: number;
  }> = [];

  for (const toolCall of toolCalls) {
    const toolId = toolCall.function.name;
    let params: Record<string, any> = {};

    try {
      params = JSON.parse(toolCall.function.arguments || "{}");
    } catch (e) {
      console.warn(
        `[ChatResponseService] Failed to parse tool arguments for ${toolId}`,
      );
    }

    toolRequests.push({
      toolId,
      params,
      _toolCallId: toolCall.id,
    });

    onToolCall?.(toolId, iterationCount);

    flowTracker.trackEvent({
      flowId,
      stage: `tool_execution_${iterationCount}_${toolId}`,
      service: "ToolExecutor",
      status: "started",
      data: { tool: toolId },
    });

    try {
      const startTime = Date.now();
      const result = await toolExecutorService.executeTool(userId, {
        toolId,
        action: params.action || "default",
        params,
      });

      const executionTime = Date.now() - startTime;

      toolResults.push({
        toolUsed: toolId,
        success: result.success,
        data: result.data,
        error: result.error,
        executionTime,
      });

      flowTracker.trackEvent({
        flowId,
        stage: `tool_execution_${iterationCount}_${toolId}`,
        service: "ToolExecutor",
        status: result.success ? "success" : "failed",
        duration: executionTime,
        data: { tool: toolId, success: result.success },
      });
    } catch (error: any) {
      toolResults.push({
        toolUsed: toolId,
        success: false,
        error: error.message,
      });

      flowTracker.trackEvent({
        flowId,
        stage: `tool_execution_${iterationCount}_${toolId}`,
        service: "ToolExecutor",
        status: "failed",
        data: { tool: toolId, error: error.message },
      });
    }
  }

  return { toolRequests, toolResults };
}

export const chatResponseService = {
  getChatResponse,
};
