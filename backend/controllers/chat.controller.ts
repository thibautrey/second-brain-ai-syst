/**
 * Chat Controller (Refactored)
 *
 * Handles chat requests with SSE streaming responses
 *
 * Services used:
 * - chat-provider.ts: Provider configuration and caching
 * - chat-tools.ts: Tool extraction and execution
 * - chat-token-recovery.ts: Token validation and recovery strategies
 * - chat-context.ts: Memory retrieval and context building
 * - telegram-chat.ts: Telegram-specific message processing
 */

import {
  CHAT_CONFIG,
  LlmTool,
  ToolFunctionDefinition,
} from "../config/chat-config.js";
import {
  CHAT_SYSTEM_PROMPT,
  analyzeTaskIntent,
  buildMemoryContext,
  buildSystemPromptWithIntent,
  getUserContextData,
  prepareSystemPrompt,
} from "../services/chat-context.js";
import { NextFunction, Response } from "express";
import {
  createToolMetadata,
  generateToolExecutionSummary,
  sanitizeToolResult,
} from "../services/sanitize-tool-results.js";
import {
  executeFunctionCalls,
  executeTextToolCalls,
  extractAllTextToolCalls,
} from "../services/chat-tools.js";
import {
  recoverFromMaxTokensError,
  validateAndAdjustMaxTokens,
} from "../services/chat-token-recovery.js";

import { AuthRequest } from "../middlewares/auth.middleware.js";
import { ChatMessageParam } from "../services/chat-response.js";
import { IntentRouterService } from "../services/intent-router.js";
import OpenAI from "openai";
import { flowTracker } from "../services/flow-tracker.js";
// New refactored services
import { getChatProvider } from "../services/chat-provider.js";
import { getDefaultMaxTokens } from "./ai-settings.controller.js";
import { getTemperatureForModel } from "../services/llm-router.js";
import { notificationService } from "../services/notification.js";
import prisma from "../services/prisma.js";
import { processTelegramMessage } from "../services/telegram-chat.js";
import { randomBytes } from "crypto";
import { responseCacheService } from "../services/response-cache.js";
import { speculativeExecutor } from "../services/speculative-executor.js";
import { toolExecutorService } from "../services/tool-executor.js";

const intentRouter = new IntentRouterService();

/**
 * POST /api/chat
 * Stream chat response using SSE
 *
 * OPTIMIZED FLOW:
 * 1. PARALLEL: Memory search + Provider fetch
 * 2. Stream LLM response to user
 * 3. ASYNC (after response): Unified analysis (classification + value assessment)
 */
export async function chatStream(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { message, messages: previousMessages } = req.body;
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Message is required" });
  }

  const validPreviousMessages = Array.isArray(previousMessages)
    ? previousMessages
    : [];

  const flowId = randomBytes(8).toString("hex");
  const startTime = Date.now();

  flowTracker.startFlow(flowId, "chat");
  flowTracker.trackEvent({
    flowId,
    stage: "chat_received",
    service: "ChatController",
    status: "started",
    data: { messageLength: message.length },
  });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const messageId = `msg_${Date.now()}`;

  try {
    res.write(`data: ${JSON.stringify({ type: "start", messageId })}\n\n`);

    speculativeExecutor.recordQuery(userId, message);
    const prefetchedResults = speculativeExecutor.getPrefetchedResults(
      userId,
      message,
    );

    // 1. PARALLEL PROCESSING: Memory + Provider + Context
    const parallelStart = Date.now();

    const [memoryResult, providerResult, contextData] = await Promise.all([
      buildMemoryContext(userId, message, 5),
      getChatProvider(userId),
      getUserContextData(userId),
    ]);

    const parallelDuration = Date.now() - parallelStart;

    // Pre-fetch for speculative execution
    if (contextData.userContext?.recentTopics) {
      speculativeExecutor
        .speculativeFetch(userId, message, contextData.userContext.recentTopics)
        .catch(() => {});
    }

    // 2. Check provider
    if (!providerResult) {
      res.write(
        `data: ${JSON.stringify({
          type: "error",
          data: "Aucun fournisseur LLM configuré. Allez dans Paramètres > IA pour en ajouter un.",
        })}\n\n`,
      );
      res.write(`data: ${JSON.stringify({ type: "end", messageId })}\n\n`);
      flowTracker.completeFlow(flowId, "failed");
      return res.end();
    }

    const { provider, modelId, fallbackProvider, fallbackModelId } =
      providerResult;

    // Track memory search result
    flowTracker.trackEvent({
      flowId,
      stage: "memory_search",
      service: "MemorySearchService",
      status: memoryResult.flowData.status,
      duration: memoryResult.flowData.duration,
      data: memoryResult.flowData.data || {},
      decision: memoryResult.flowData.decision,
    });

    flowTracker.trackEvent({
      flowId,
      stage: "parallel_fetch_complete",
      service: "ChatController",
      status: "success",
      duration: parallelDuration,
      data: {
        providerName: provider.name,
        modelId,
        memoriesFound: memoryResult.searchResults.length,
      },
      decision: `Parallel fetch: Provider=${provider.name}, Model=${modelId}`,
    });

    // 3. Create OpenAI client
    const openai = new OpenAI({
      apiKey: provider.apiKey,
      baseURL: provider.baseUrl || "https://api.openai.com/v1",
    });

    // Create fallback OpenAI if available
    const fallbackOpenAI = fallbackProvider
      ? new OpenAI({
          apiKey: fallbackProvider.apiKey,
          baseURL: fallbackProvider.baseUrl || "https://api.openai.com/v1",
        })
      : null;

    // 4. Analyze task intent for smart context injection
    const taskIntentAnalysis = analyzeTaskIntent(message);

    // Log intent analysis if a task request was detected
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
          hasExpiration: !!taskIntentAnalysis.temporalInfo.expiresAt,
          needsClarification: taskIntentAnalysis.clarification?.needed,
          confidence: taskIntentAnalysis.confidence,
        },
        decision: taskIntentAnalysis.clarification?.needed
          ? `Clarification needed: ${taskIntentAnalysis.clarification.type}`
          : "All information available for task creation",
      });
    }

    // 5. Build system prompt with memory AND intent analysis
    const systemPrompt = buildSystemPromptWithIntent(
      CHAT_SYSTEM_PROMPT,
      memoryResult.memoryContext,
      taskIntentAnalysis,
    );
    const systemPromptWithContext = await prepareSystemPrompt(
      systemPrompt,
      userId,
    );

    // 6. Get tool schemas
    const toolSchemas = (await toolExecutorService.getToolSchemasWithGenerated(
      userId,
    )) as ToolFunctionDefinition[];

    // 6. Build message history
    let messages: ChatMessageParam[] = [
      { role: "system", content: systemPromptWithContext },
    ];

    if (validPreviousMessages.length > 0) {
      for (const prevMsg of validPreviousMessages) {
        if (prevMsg.role === "user" && prevMsg.content) {
          messages.push({
            role: "user",
            content: prevMsg.content,
          });
        } else if (prevMsg.role === "assistant" && prevMsg.content) {
          messages.push({
            role: "assistant",
            content: prevMsg.content,
          });
        }
      }
    }

    messages.push({ role: "user", content: message });

    // 7. LLM Call Loop with tool execution
    let fullResponse = "";
    let allToolResults: any[] = [];
    let sanitizationResults = new Map<string, any>();
    let iterationCount = 0;
    let consecutiveFailures = 0;
    const MAX_ITERATIONS = CHAT_CONFIG.MAX_ITERATIONS;
    const MAX_CONSECUTIVE_FAILURES = CHAT_CONFIG.MAX_CONSECUTIVE_FAILURES;

    const llmStart = Date.now();

    while (iterationCount < MAX_ITERATIONS) {
      iterationCount++;

      flowTracker.trackEvent({
        flowId,
        stage: `llm_call_iteration_${iterationCount}`,
        service: "OpenAI",
        status: "started",
        data: { messagesCount: messages.length },
      });

      // Validate and adjust tokens
      const messagesStr = messages
        .map((m) =>
          typeof m.content === "string" ? m.content.substring(0, 1000) : "",
        )
        .join(" ");

      const userMaxTokens = await getDefaultMaxTokens(userId);
      const tokenValidation = validateAndAdjustMaxTokens(
        userMaxTokens,
        modelId,
        messages.length,
        messagesStr,
        userId,
      );

      let maxTokensToUse = tokenValidation.maxTokens;

      if (tokenValidation.warning) {
        console.warn(`[TokenValidator] ${tokenValidation.warning}`);
        try {
          if (maxTokensToUse < userMaxTokens * 0.5) {
            await notificationService.createNotification({
              userId,
              title: "Optimizing response length",
              message: `Your conversation is getting long. I'm optimizing to provide a response.`,
              type: "WARNING",
              channels: ["IN_APP"],
            });
          }
        } catch (notifyError) {
          console.warn("Failed to send token notification:", notifyError);
        }
      }

      try {
        const chatTemp = getTemperatureForModel(modelId, 0.7);
        const chatPayload: any = {
          model: modelId,
          messages: messages as any,
          max_tokens: maxTokensToUse,
          tools: toolSchemas.map((schema) => ({
            type: "function",
            function: schema,
          })) as LlmTool[],
          tool_choice: "auto",
          stream: false,
        };

        // Only add temperature if the model supports it
        if (chatTemp !== undefined) {
          chatPayload.temperature = chatTemp;
        }

        const response = await openai.chat.completions.create(chatPayload);

        const assistantMessage = response.choices[0]?.message;
        if (!assistantMessage) break;

        // Check for text-based tool calls
        const textToolCalls =
          assistantMessage.content &&
          (!assistantMessage.tool_calls ||
            assistantMessage.tool_calls.length === 0)
            ? extractAllTextToolCalls(assistantMessage.content)
            : [];

        // Execute text tool calls
        if (textToolCalls.length > 0) {
          const toolResult = await executeTextToolCalls(
            userId,
            textToolCalls,
            flowId,
            flowTracker,
            res,
            iterationCount,
          );

          allToolResults.push(...toolResult.allToolResults);
          sanitizationResults = new Map([
            ...sanitizationResults,
            ...toolResult.sanitizationResults,
          ]);

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

          const allTextToolsFailed = toolResult.toolCallResults.every(
            (r) => !r.success,
          );
          consecutiveFailures = allTextToolsFailed
            ? consecutiveFailures + 1
            : 0;

          continue;
        }

        // Execute function-call based tools
        if (
          assistantMessage.tool_calls &&
          assistantMessage.tool_calls.length > 0
        ) {
          const toolResult = await executeFunctionCalls(
            userId,
            assistantMessage.tool_calls,
            flowId,
            flowTracker,
            res,
            iterationCount,
          );

          // Sanitize tool results
          const sanitizedToolResults = toolResult.toolResults.map((result) => {
            const sanitizationResult = sanitizeToolResult(result.data);
            sanitizationResults.set(result.toolUsed, sanitizationResult);

            return {
              ...result,
              data: sanitizationResult.cleaned,
              _sanitized: sanitizationResult.hasSensitiveData,
              _redactionCount: sanitizationResult.redactedCount,
            };
          });

          allToolResults.push(...sanitizedToolResults);

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
              `[ChatController] Circuit breaker: ${consecutiveFailures} consecutive failures`,
            );
            flowTracker.trackEvent({
              flowId,
              stage: `circuit_breaker_triggered`,
              service: "ChatController",
              status: "failed",
              data: { consecutiveFailures },
            });
          }

          continue;
        }

        // No tool calls - final response
        fullResponse = assistantMessage.content || "";
        break;
      } catch (llmError) {
        // Token recovery
        const recoveryResult = await recoverFromMaxTokensError(
          llmError,
          userId,
          openai,
          fallbackOpenAI,
          modelId,
          fallbackModelId || "",
          fallbackProvider,
          provider,
          messages,
          toolSchemas,
          flowId,
          flowTracker,
          iterationCount,
        );

        if (recoveryResult.success) {
          if (recoveryResult.response) {
            fullResponse = recoveryResult.response;
            break;
          } else if (recoveryResult.messages) {
            messages = recoveryResult.messages;
            continue;
          }
        } else {
          throw llmError;
        }
      }
    }

    flowTracker.trackEvent({
      flowId,
      stage: "llm_response",
      service: "OpenAI",
      status: "success",
      duration: Date.now() - llmStart,
      data: {
        responseLength: fullResponse.length,
        iterations: iterationCount,
        toolsUsed: allToolResults.length,
      },
    });

    // 8. Stream final response
    if (fullResponse) {
      res.write(`data: ${JSON.stringify({ type: "start", messageId })}\n\n`);

      if (allToolResults.length > 0) {
        res.write(
          `data: ${JSON.stringify({
            type: "tools",
            data: {
              count: allToolResults.length,
              tools: allToolResults.map((r) => ({
                tool: r.toolUsed,
                success: r.success,
                duration: r.executionTime,
              })),
            },
          })}\n\n`,
        );
      }

      const chunkSize = 5;
      for (let i = 0; i < fullResponse.length; i += chunkSize) {
        const chunk = fullResponse.slice(i, i + chunkSize);
        res.write(
          `data: ${JSON.stringify({ type: "token", data: chunk })}\n\n`,
        );
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    } else {
      if (allToolResults.length === 0) {
        try {
          await notificationService.createNotification({
            userId,
            title: "Unable to generate response",
            message: `The conversation context was too complex. Try asking a simpler question.`,
            type: "ERROR",
            channels: ["IN_APP"],
          });
        } catch (notifyError) {
          console.warn(
            "Failed to send empty response notification:",
            notifyError,
          );
        }
      }
    }

    const userResponseDuration = Date.now() - startTime;

    flowTracker.trackEvent({
      flowId,
      stage: "chat_complete",
      service: "ChatController",
      status: "success",
      duration: userResponseDuration,
      data: { asyncMemoryProcessing: true },
    });

    res.write(`data: ${JSON.stringify({ type: "end", messageId })}\n\n`);
    res.end();

    // ===== ASYNC: Fact-checking + Memory Storage =====
    if (fullResponse && fullResponse.length > 100) {
      setImmediate(async () => {
        try {
          const { factCheckerService } =
            await import("../services/fact-checker.js");
          await factCheckerService.scheduleFactCheck({
            userId,
            conversationId: messageId,
            messageId,
            response: fullResponse,
            userQuestion: message,
          });
        } catch (error) {
          console.error(
            "[ChatController] Fact-check scheduling failed:",
            error,
          );
        }
      });
    }

    responseCacheService.updateConversationContext(userId, {
      role: "user",
      content: message,
    });
    responseCacheService.updateConversationContext(userId, {
      role: "assistant",
      content: fullResponse,
    });

    // ===== ASYNC: Unified Analysis =====
    setImmediate(async () => {
      try {
        const analysisStart = Date.now();

        const { classification, valueAssessment } =
          await intentRouter.analyzeExchangePostResponse(
            message,
            fullResponse,
            userId,
          );

        flowTracker.trackEvent({
          flowId,
          stage: "unified_analysis",
          service: "IntentRouter",
          status: "success",
          duration: Date.now() - analysisStart,
          data: {
            inputType: classification.inputType,
            importanceScore: classification.importanceScore,
            isValuable: valueAssessment.isValuable,
            shouldStore: valueAssessment.shouldStore,
          },
          decision: `[ASYNC] Type=${classification.inputType}, Importance=${(classification.importanceScore * 100).toFixed(1)}%, Store=${valueAssessment.shouldStore ? "YES" : "NO"}`,
        });

        // Store if valuable
        if (
          valueAssessment.shouldStore &&
          valueAssessment.adjustedImportanceScore >= 0.3
        ) {
          const contentToStore = valueAssessment.isFactualDeclaration
            ? valueAssessment.factToStore ||
              `Question: ${message}\nRéponse: ${fullResponse}`
            : `Question: ${message}\nRéponse: ${fullResponse}`;

          let toolMetadata: any = {};
          if (allToolResults.length > 0) {
            const executionSummary = generateToolExecutionSummary(
              allToolResults.map((r) => ({
                toolUsed: r.toolUsed,
                success: r.success,
                error: r.error,
                executionTime: r.executionTime,
              })),
              sanitizationResults,
            );

            toolMetadata = createToolMetadata(
              allToolResults.map((r) => ({
                toolUsed: r.toolUsed,
                success: r.success,
                error: r.error,
                executionTime: r.executionTime,
              })),
              executionSummary,
            );
          }

          await prisma.memory.create({
            data: {
              userId,
              content: contentToStore,
              type: "SHORT_TERM",
              sourceType: "chat",
              importanceScore: valueAssessment.adjustedImportanceScore,
              tags: classification.topic ? [classification.topic] : [],
              entities: classification.entities,
              metadata: toolMetadata.toolsUsed ? toolMetadata : undefined,
            },
          });

          flowTracker.trackEvent({
            flowId,
            stage: "memory_storage",
            service: "MemoryManager",
            status: "success",
            decision: `[ASYNC] Memory stored with importance=${(valueAssessment.adjustedImportanceScore * 100).toFixed(1)}%`,
          });
        }

        flowTracker.completeFlow(flowId, "completed");
      } catch (error) {
        console.warn("[ASYNC] Analysis failed:", error);
        flowTracker.completeFlow(flowId, "partial");
      }
    });
  } catch (error) {
    console.error("Chat error:", error);

    flowTracker.trackEvent({
      flowId,
      stage: "chat_error",
      service: "ChatController",
      status: "failed",
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    flowTracker.completeFlow(flowId, "failed");

    if (!res.headersSent) {
      res.write(
        `data: ${JSON.stringify({
          type: "error",
          data:
            error instanceof Error ? error.message : "Une erreur est survenue",
        })}\n\n`,
      );
      res.write(`data: ${JSON.stringify({ type: "end", messageId })}\n\n`);
      res.end();
    }
  }
}

/**
 * Export Telegram processor
 */
export { processTelegramMessage };
