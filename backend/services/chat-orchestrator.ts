/**
 * Chat Orchestrator Service
 *
 * Centralized service for handling chat requests.
 * Both chatStream and chatStreamEnhanced endpoints use this service
 * to ensure consistent behavior including:
 * - Provider configuration
 * - Memory context retrieval
 * - Tool execution with smart retry
 * - Fallback responses
 * - Flow tracking
 *
 * This eliminates code duplication between endpoints.
 */

import { Response } from "express";
import { randomBytes } from "crypto";

import { CHAT_CONFIG, ToolFunctionDefinition } from "../config/chat-config.js";
import {
  analyzeTaskIntent,
  buildCompleteSystemPrompt,
  buildMemoryContext,
  buildSystemPromptWithIntent,
  getUserContextData,
  prepareSystemPrompt,
} from "./chat-context.js";
import {
  piAiProviderService,
  type ChatMessage,
  type OpenAIToolSchema,
  type PiAiProviderConfig,
} from "./pi-ai-provider.js";
import {
  type StreamWriter,
  createEnhancedStream,
  type EnhancedStreamOptions,
} from "./enhanced-streaming.js";
import { flowTracker } from "./flow-tracker.js";
import { getChatProvider } from "./chat-provider.js";
import { getTemperatureForModel } from "./llm-router.js";
import { toolExecutorService } from "./tool-executor.js";
import { smartRetryService, type RetryContext } from "./smart-retry.js";
import { sanitizeToolResult } from "./sanitize-tool-results.js";
import { responseCacheService } from "./response-cache.js";
import { speculativeExecutor } from "./speculative-executor.js";
import { IntentRouterService } from "./intent-router.js";
import { memoryManagerService } from "./memory-manager.js";
import { validateAndAdjustMaxTokens } from "./chat-token-recovery.js";
import { getDefaultMaxTokens } from "../controllers/ai-settings.controller.js";
import { AgenticOrchestrator } from "./orchestration/orchestrator-agent.js";
import { ExecutionPlanner } from "./orchestration/execution-planner.js";

const intentRouter = new IntentRouterService();

// ==================== Types ====================

export interface ChatOrchestratorRequest {
  userId: string;
  message: string;
  previousMessages?: Array<{ role: "user" | "assistant"; content: string }>;
  sessionId?: string;
  saveSession?: boolean;
  sessionTitle?: string;
  flowId?: string;
  messageId?: string;
}

export interface ChatOrchestratorResult {
  success: boolean;
  response: string;
  flowId: string;
  messageId: string;
  toolResults: ToolExecutionResult[];
  usage?: {
    inputTokens: number;
    outputTokens: number;
    cost: number;
  };
  retryAttempts: number;
  modelId?: string;
}

export interface ToolExecutionResult {
  toolName: string;
  success: boolean;
  data?: any;
  error?: string;
  executionTime: number;
}

interface ToolCallInfo {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

// ==================== Chat Orchestrator ====================

/**
 * Main orchestration function for chat requests
 * Handles all the common logic between chat endpoints
 */
export async function orchestrateChat(
  request: ChatOrchestratorRequest,
  writer: StreamWriter,
): Promise<ChatOrchestratorResult> {
  const { userId, message, previousMessages = [] } = request;

  const flowId = request.flowId || randomBytes(8).toString("hex");
  const messageId = request.messageId || `msg_${Date.now()}`;
  const startTime = Date.now();

  // Initialize tracking
  flowTracker.startFlow(flowId, "chat");
  flowTracker.trackEvent({
    flowId,
    stage: "chat_received",
    service: "ChatOrchestrator",
    status: "started",
    data: { messageLength: message.length },
  });

  // Result tracking
  const allToolResults: ToolExecutionResult[] = [];
  let retryAttempt = 0;
  let retryContext: RetryContext | undefined = undefined;
  let fullResponse = "";
  let usage: ChatOrchestratorResult["usage"] | undefined;
  let modelId: string | undefined;

  try {
    // Initial status
    writer.status("Analyzing your request...", "analyzing");

    // Record for speculative execution
    speculativeExecutor.recordQuery(userId, message);

    // ==================== 1. PARALLEL FETCH ====================
    writer.status("Gathering context...", "retrieving");
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

    // ==================== 2. CHECK PROVIDER ====================
    if (!providerResult) {
      writer.error(
        "No LLM provider configured. Go to Settings > AI to add one.",
        "NO_PROVIDER",
        false,
      );
      flowTracker.completeFlow(flowId, "failed");
      return {
        success: false,
        response: "",
        flowId,
        messageId,
        toolResults: [],
        retryAttempts: 0,
        modelId: undefined,
      };
    }

    const { provider, modelId, fallbackProvider, fallbackModelId } =
      providerResult;

    // Track memory search
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
      service: "ChatOrchestrator",
      status: "success",
      duration: parallelDuration,
      data: {
        providerName: provider.name,
        modelId,
        memoriesFound: memoryResult.searchResults.length,
      },
      decision: `Parallel fetch: Provider=${provider.name}, Model=${modelId}`,
    });

    // ==================== 3. BUILD PROVIDER CONFIG ====================
    const primaryConfig: PiAiProviderConfig = {
      provider: "openai",
      modelId,
      apiKey: provider.apiKey,
      baseUrl: provider.baseUrl || undefined,
    };

    const fallbackConfig: PiAiProviderConfig | undefined =
      fallbackProvider && fallbackModelId
        ? {
            provider: "openai",
            modelId: fallbackModelId,
            apiKey: fallbackProvider.apiKey,
            baseUrl: fallbackProvider.baseUrl || undefined,
          }
        : undefined;

    // ==================== 4. ANALYZE INTENT ====================
    const taskIntentAnalysis = analyzeTaskIntent(message);

    if (taskIntentAnalysis.isTaskRequest) {
      flowTracker.trackEvent({
        flowId,
        stage: "task_intent_analysis",
        service: "TaskIntentAnalyzer",
        status: "success",
        data: {
          taskType: taskIntentAnalysis.taskType,
          confidence: taskIntentAnalysis.confidence,
        },
      });
    }

    // ==================== 5. BUILD SYSTEM PROMPT ====================
    const baseSystemPrompt = buildCompleteSystemPrompt();
    const systemPrompt = buildSystemPromptWithIntent(
      baseSystemPrompt,
      memoryResult.memoryContext,
      taskIntentAnalysis,
    );
    const systemPromptWithContext = await prepareSystemPrompt(
      systemPrompt,
      userId,
    );

    // ==================== 6. GET TOOL SCHEMAS (ENABLED ONLY) ====================
    const toolSchemas = (await toolExecutorService.getToolSchemasWithGenerated(
      userId,
    )) as ToolFunctionDefinition[];

    // ==================== 7. BUILD MESSAGES ====================
    const piAiMessages: ChatMessage[] = [
      { role: "system", content: systemPromptWithContext },
    ];

    for (const prevMsg of previousMessages) {
      if (prevMsg.role === "user" && prevMsg.content) {
        piAiMessages.push({ role: "user", content: prevMsg.content });
      } else if (prevMsg.role === "assistant" && prevMsg.content) {
        piAiMessages.push({ role: "assistant", content: prevMsg.content });
      }
    }

    piAiMessages.push({ role: "user", content: message });

    // ==================== 7b. AGENTIC ORCHESTRATION (feature flag) ====================
    const useAgentic = true;
    if (useAgentic) {
      writer.status("Planning next steps...", "analyzing");

      const planner = new ExecutionPlanner(primaryConfig);
      const executionPlan = await planner.createPlan(
        message,
        taskIntentAnalysis,
        toolSchemas,
      );

      flowTracker.trackEvent({
        flowId,
        stage: "agentic_plan",
        service: "ExecutionPlanner",
        status: "success",
        data: {
          toolCount: executionPlan.toolCalls.length,
          confidence: executionPlan.confidence,
        },
        decision: `Parallelizable=${executionPlan.parallelizable}`,
      });

      const orchestratorResult = await AgenticOrchestrator.run({
        flowId,
        userId,
        userQuestion: message,
        intentAnalysis: taskIntentAnalysis,
        executionPlan,
        providerConfig: primaryConfig,
        systemPrompt: systemPromptWithContext,
        previousMessages: piAiMessages.filter((m) => m.role !== "system"),
        writer,
      });

      writer.status("Writing the answer...", "generating");
      writer.write({ type: "text_start" });
      if (orchestratorResult.response) {
        // Stream final response in small chunks for UX parity
        for (let i = 0; i < orchestratorResult.response.length; i += 12) {
          writer.textDelta(orchestratorResult.response.slice(i, i + 12));
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
      }

      flowTracker.trackEvent({
        flowId,
        stage: "agentic_complete",
        service: "AgenticOrchestrator",
        status: orchestratorResult.success ? "success" : "failed",
        duration: Date.now() - startTime,
        data: {
          reflections: orchestratorResult.reflections.length,
          toolsExecuted: orchestratorResult.toolResults.length,
        },
      });

      schedulePostProcessing(
        userId,
        message,
        orchestratorResult.response,
        messageId,
        flowId,
      );

      return {
        success: orchestratorResult.success,
        response: orchestratorResult.response,
        flowId,
        messageId,
        toolResults: orchestratorResult.toolResults.map((r) => ({
          toolName: r.toolName,
          success: r.status === "success",
          data: r.data,
          error: r.error,
          executionTime: r.executionTime,
        })),
        retryAttempts: orchestratorResult.reflections.length,
        modelId,
      };
    }

    // ==================== 8. TOKEN VALIDATION ====================
    const userMaxTokens = await getDefaultMaxTokens(userId);
    const messagesStr = piAiMessages
      .map((m) => m.content.substring(0, 1000))
      .join(" ");
    const tokenValidation = validateAndAdjustMaxTokens(
      userMaxTokens,
      modelId,
      piAiMessages.length,
      messagesStr,
      userId,
    );

    if (tokenValidation.warning) {
      console.warn(`[TokenValidator] ${tokenValidation.warning}`);
    }

    // ==================== 9. SMART RETRY LOOP ====================
    const MAX_SMART_RETRIES =
      CHAT_CONFIG.SMART_RETRY.MAX_EMPTY_RESPONSE_RETRIES;
    const chatTemp = getTemperatureForModel(modelId, 0.7);

    while (retryAttempt <= MAX_SMART_RETRIES) {
      // Reset for retry
      if (retryAttempt > 0) {
        // Notify user about retry
        if (retryContext) {
          const userMessage =
            smartRetryService.generateUserMessage(retryContext);
          writer.write({
            type: "status",
            message: userMessage,
            phase: "analyzing",
          });

          // Inject retry context as a system message
          const systemMessage =
            smartRetryService.generateSystemMessage(retryContext);
          piAiMessages.push({
            role: "system",
            content: systemMessage,
          });

          flowTracker.trackEvent({
            flowId,
            stage: `smart_retry_attempt_${retryAttempt}`,
            service: "SmartRetry",
            status: "started",
            data: {
              reason: retryContext.retryReason,
              failedTools: retryContext.toolFailures.map((f) => f.toolName),
              blockedTools: retryContext.blockedTools,
            },
          });
        }
      }

      // Filter out blocked tools from the available schemas during retry
      let currentToolSchemas = toolSchemas;
      if (
        retryContext &&
        retryContext.blockedTools &&
        retryContext.blockedTools.length > 0
      ) {
        currentToolSchemas = toolSchemas.filter(
          (tool) => !retryContext!.blockedTools.includes(tool.name),
        );
        console.log(
          `[ChatOrchestrator] Retry ${retryAttempt}: Blocked tools: ${retryContext.blockedTools.join(", ")}. Available: ${currentToolSchemas.map((t) => t.name).join(", ")}`,
        );
      }

      // Clear tool results for this attempt
      const attemptToolResults: ToolExecutionResult[] = [];

      // ==================== 10. EXECUTE STREAM ====================
      writer.status("Generating response...", "generating");

      const streamOptions: EnhancedStreamOptions = {
        temperature: chatTemp,
        maxTokens: tokenValidation.maxTokens,
        tools:
          currentToolSchemas.length > 0
            ? (currentToolSchemas as OpenAIToolSchema[])
            : undefined,
        toolChoice: currentToolSchemas.length > 0 ? "auto" : undefined,
        emitThinking: true,
        emitToolPreview: true,
        onToolCall: async (toolCall: ToolCallInfo) => {
          return executeToolWithTracking(
            userId,
            toolCall,
            flowId,
            attemptToolResults,
          );
        },
      };

      const result = await createEnhancedStream(
        primaryConfig,
        piAiMessages,
        writer,
        streamOptions,
      );

      // Collect results from this attempt
      allToolResults.push(...attemptToolResults);

      if (result) {
        fullResponse = result.content || "";
        usage = {
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          cost: result.usage.cost,
        };
      }

      // ==================== 11. ANALYZE FOR RETRY ====================
      const retryDecision = smartRetryService.analyzeAndDecide({
        response: fullResponse,
        toolResults: attemptToolResults.map((r) => ({
          toolUsed: r.toolName,
          success: r.success,
          error: r.error,
        })),
        currentAttempt: retryAttempt,
        previousContext: retryContext,
      });

      if (retryDecision.shouldRetry && retryAttempt < MAX_SMART_RETRIES) {
        retryContext = retryDecision.retryContext;
        retryAttempt++;

        flowTracker.trackEvent({
          flowId,
          stage: "smart_retry_decision",
          service: "SmartRetry",
          status: "started",
          data: {
            reason: retryContext?.retryReason,
            attempt: retryAttempt,
            maxRetries: MAX_SMART_RETRIES,
          },
          decision: `Retrying: ${retryContext?.retryReason}`,
        });

        // Continue to retry
        continue;
      }

      // No retry needed - break loop
      break;
    }

    // ==================== 12. FALLBACK IF NEEDED ====================
    if (
      (!fullResponse ||
        fullResponse.trim().length <
          CHAT_CONFIG.SMART_RETRY.MIN_RESPONSE_LENGTH) &&
      retryContext
    ) {
      fullResponse = smartRetryService.buildFallbackResponse(
        retryContext,
        message,
      );

      // Stream the fallback
      for (let i = 0; i < fullResponse.length; i += 5) {
        const chunk = fullResponse.slice(i, i + 5);
        writer.textDelta(chunk);
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      flowTracker.trackEvent({
        flowId,
        stage: "smart_retry_fallback",
        service: "SmartRetry",
        status: "success",
        data: {
          retriesExhausted: retryAttempt,
          fallbackGenerated: true,
        },
      });
    }

    // Emergency fallback if still no response
    if (!fullResponse || fullResponse.trim().length === 0) {
      fullResponse =
        "I'm experiencing technical difficulties responding to your message. Please try again in a few moments or rephrase your question.";

      for (let i = 0; i < fullResponse.length; i += 5) {
        const chunk = fullResponse.slice(i, i + 5);
        writer.textDelta(chunk);
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      flowTracker.trackEvent({
        flowId,
        stage: "emergency_fallback",
        service: "ChatOrchestrator",
        status: "failed",
        data: {
          reason: "all_strategies_exhausted",
          retryAttempts: retryAttempt,
        },
      });
    }

    // ==================== 13. TRACK COMPLETION ====================
    const totalDuration = Date.now() - startTime;

    flowTracker.trackEvent({
      flowId,
      stage: "llm_response",
      service: "ChatOrchestrator",
      status: "success",
      duration: totalDuration,
      data: {
        responseLength: fullResponse.length,
        toolsUsed: allToolResults.length,
        cost: usage?.cost || 0,
        smartRetryAttempts: retryAttempt,
      },
    });

    flowTracker.trackEvent({
      flowId,
      stage: "chat_complete",
      service: "ChatOrchestrator",
      status: "success",
      duration: totalDuration,
    });

    // ==================== 14. ASYNC POST-PROCESSING ====================
    schedulePostProcessing(userId, message, fullResponse, messageId, flowId);

    // Update conversation context cache
    responseCacheService.updateConversationContext(userId, {
      role: "user",
      content: message,
    });
    responseCacheService.updateConversationContext(userId, {
      role: "assistant",
      content: fullResponse,
    });

    return {
      success: true,
      response: fullResponse,
      flowId,
      messageId,
      toolResults: allToolResults,
      usage,
      retryAttempts: retryAttempt,
      modelId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    flowTracker.trackEvent({
      flowId,
      stage: "chat_error",
      service: "ChatOrchestrator",
      status: "failed",
      data: { error: errorMessage },
    });

    flowTracker.completeFlow(flowId, "failed");

    writer.error(errorMessage, "INTERNAL_ERROR", true);

    return {
      success: false,
      response: "",
      flowId,
      messageId,
      toolResults: allToolResults,
      retryAttempts: retryAttempt,
      modelId,
    };
  }
}

// ==================== Helper Functions ====================

/**
 * Execute a tool with tracking
 */
async function executeToolWithTracking(
  userId: string,
  toolCall: ToolCallInfo,
  flowId: string,
  results: ToolExecutionResult[],
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  const toolStartTime = Date.now();

  try {
    const executionResult = await toolExecutorService.executeTool(
      userId,
      toolCall.name,
      toolCall.arguments,
    );

    const executionTime = Date.now() - toolStartTime;

    // Sanitize result
    const sanitizationResult = sanitizeToolResult(executionResult.data);

    // Track result
    results.push({
      toolName: toolCall.name,
      success: executionResult.success,
      data: sanitizationResult.cleaned,
      error: executionResult.error,
      executionTime,
    });

    flowTracker.trackEvent({
      flowId,
      stage: "tool_execution",
      service: "ToolExecutor",
      status: executionResult.success ? "success" : "failed",
      duration: executionTime,
      data: { toolName: toolCall.name },
    });

    return {
      success: executionResult.success,
      result: sanitizationResult.cleaned,
      error: executionResult.error,
    };
  } catch (error) {
    const executionTime = Date.now() - toolStartTime;
    const errorMsg = error instanceof Error ? error.message : String(error);

    results.push({
      toolName: toolCall.name,
      success: false,
      error: errorMsg,
      executionTime,
    });

    flowTracker.trackEvent({
      flowId,
      stage: "tool_execution",
      service: "ToolExecutor",
      status: "failed",
      duration: executionTime,
      data: { toolName: toolCall.name, error: errorMsg },
    });

    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Schedule async post-processing tasks
 */
function schedulePostProcessing(
  userId: string,
  message: string,
  response: string,
  messageId: string,
  flowId: string,
): void {
  // Fact-checking
  if (response && response.length > 100) {
    setImmediate(async () => {
      try {
        const { factCheckerService } = await import("./fact-checker.js");
        await factCheckerService.scheduleFactCheck({
          userId,
          conversationId: messageId,
          messageId,
          response,
          userQuestion: message,
        });
      } catch (error) {
        console.error(
          "[ChatOrchestrator] Fact-check scheduling failed:",
          error,
        );
      }
    });
  }

  // Analysis and memory storage
  setImmediate(async () => {
    try {
      const analysisStart = Date.now();

      const { classification, valueAssessment } =
        await intentRouter.analyzeExchangePostResponse(
          message,
          response,
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
          importance: valueAssessment.adjustedImportanceScore,
          isValuable: valueAssessment.isValuable,
          shouldStore: valueAssessment.shouldStore,
        },
      });

      if (valueAssessment.shouldStore) {
        const factToStore = valueAssessment.factToStore?.trim();
        const memoryContent =
          factToStore && factToStore.length ? factToStore : message.trim();
        const memoryReason =
          valueAssessment.reason || "Marked for memory storage";

        try {
          const memory = await memoryManagerService.ingestInteraction(
            userId,
            memoryContent,
            {
              sourceType: "chat",
              sourceId: messageId,
              entities: classification.entities || [],
              occurredAt: new Date(),
              metadata: {
                classification: {
                  inputType: classification.inputType,
                  confidence: classification.confidence,
                  topic: classification.topic,
                  timeBucket: classification.timeBucket,
                },
                valueAssessment: {
                  reason: memoryReason,
                  adjustedImportanceScore:
                    valueAssessment.adjustedImportanceScore,
                  isFactualDeclaration: valueAssessment.isFactualDeclaration,
                },
              },
            },
          );

          flowTracker.trackEvent({
            flowId,
            stage: "memory_storage",
            service: "MemoryManager",
            status: "success",
            data: {
              memoryId: memory.id,
              factStored: Boolean(valueAssessment.factToStore),
              importance: valueAssessment.adjustedImportanceScore,
              inputType: classification.inputType,
            },
            decision: memoryReason,
          });
        } catch (memoryError) {
          console.error(
            "[ChatOrchestrator] Memory ingestion failed:",
            memoryError,
          );
          flowTracker.trackEvent({
            flowId,
            stage: "memory_storage",
            service: "MemoryManager",
            status: "failed",
            data: {
              error:
                memoryError instanceof Error
                  ? memoryError.message
                  : String(memoryError),
              inputType: classification.inputType,
              shouldStore: valueAssessment.shouldStore,
            },
          });
        }
      }
    } catch (error) {
      console.error("[ChatOrchestrator] Post-response analysis failed:", error);
    } finally {
      flowTracker.completeFlow(flowId, "completed");
    }
  });
}

// ==================== Export ====================

export const chatOrchestrator = {
  orchestrateChat,
};

export default chatOrchestrator;
