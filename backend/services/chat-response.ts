/**
 * Chat Response Service
 *
 * Provides a reusable interface for getting AI responses with tool support.
 * Used by both the chat controller (streaming) and other services like
 * continuous-listening (non-streaming, notification-based).
 *
 * This service encapsulates:
 * - Provider configuration and fallback handling (via pi-ai)
 * - System prompt building with memory context
 * - Tool execution loop
 * - Error recovery
 *
 * All LLM calls are routed through piAiProviderService for unified multi-provider support.
 */

import {
  buildCompleteSystemPrompt,
  buildMemoryContext,
  prepareSystemPrompt,
} from "./chat-context.js";
import {
  executeFunctionCalls,
  executeTextToolCalls,
  extractAllTextToolCalls,
} from "./chat-tools.js";

import { CHAT_CONFIG } from "../config/chat-config.js";
import {
  piAiProviderService,
  type ChatMessage,
  type OpenAIToolSchema,
  type PiAiProviderConfig,
} from "./pi-ai-provider.js";
import { flowTracker } from "./flow-tracker.js";
import { getChatProvider } from "./chat-provider.js";
import { getTemperatureForModel } from "./llm-router.js";
import { randomBytes } from "crypto";
import { toolExecutorService } from "./tool-executor.js";
import { smartRetryService, type RetryContext } from "./smart-retry.js";

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
  /** Custom system prompt override (uses buildCompleteSystemPrompt() if not provided) */
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
    maxTokens = 16000,
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

    // 3. Build system prompt with runtime metadata
    const basePrompt = customSystemPrompt || buildCompleteSystemPrompt();
    const fullContext = `${memoryContext}${additionalContext ? `\n\n${additionalContext}` : ""}`;
    const systemPromptWithMemory = basePrompt + fullContext;
    const systemPrompt = await prepareSystemPrompt(
      systemPromptWithMemory,
      userId,
    );

    // 4. Build pi-ai provider config (replaces direct OpenAI client creation)
    const primaryConfig: PiAiProviderConfig = {
      provider: "openai", // Default to openai-compatible API
      modelId: modelId,
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

    // 5. Get tool schemas (including generated tools)
    const toolSchemas = (await toolExecutorService.getToolSchemasWithGenerated(
      userId,
    )) as OpenAIToolSchema[];

    // 6. Build initial messages for pi-ai
    const piAiMessages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
    ];

    // Add previous messages for context
    for (const prevMsg of previousMessages) {
      piAiMessages.push({
        role: prevMsg.role,
        content: prevMsg.content,
      });
    }

    piAiMessages.push({ role: "user", content: message });

    // Also maintain OpenAI-format messages for tool result handling
    const messages: ChatMessageParam[] = piAiMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // 7. LLM call loop with tool execution and Smart Retry
    let fullResponse = "";
    let iterationCount = 0;
    let consecutiveFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = CHAT_CONFIG.MAX_CONSECUTIVE_FAILURES;
    let usedFallback = false;

    // Smart Retry tracking
    let retryAttempt = 0;
    let retryContext: RetryContext | undefined = undefined;
    const MAX_SMART_RETRIES =
      CHAT_CONFIG.SMART_RETRY.MAX_EMPTY_RESPONSE_RETRIES;

    // Outer retry loop for smart retry
    while (retryAttempt <= MAX_SMART_RETRIES) {
      // Reset state for retry
      if (retryAttempt > 0) {
        fullResponse = "";
        iterationCount = 0;
        consecutiveFailures = 0;
        usedFallback = false;

        // Inject retry context into messages
        if (retryContext) {
          const systemMessage =
            smartRetryService.generateSystemMessage(retryContext);
          messages.push({
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
      if (retryContext && retryContext.blockedTools.length > 0) {
        currentToolSchemas = toolSchemas.filter(
          (tool) => !retryContext!.blockedTools.includes(tool.name),
        );
        console.log(
          `[ChatResponseService] Retry ${retryAttempt}: Blocked tools: ${retryContext.blockedTools.join(", ")}. Available: ${currentToolSchemas.map((t) => t.name).join(", ")}`,
        );
      }

      while (iterationCount < maxIterations) {
        iterationCount++;

        try {
          const chatTemp = getTemperatureForModel(modelId, 0.7);

          // Use pi-ai provider service for the LLM call
          const currentConfig =
            usedFallback && fallbackConfig ? fallbackConfig : primaryConfig;
          const currentModelId =
            usedFallback && fallbackModelId ? fallbackModelId : modelId;

          // Convert messages to pi-ai format (filter out tool messages for pi-ai)
          const currentPiAiMessages: ChatMessage[] = messages
            .filter((m) => m.role !== "tool")
            .map((m) => ({
              role: m.role as "user" | "assistant" | "system",
              content:
                typeof m.content === "string" ? m.content : m.content || "",
            }));

          const response = await piAiProviderService.createChatCompletion(
            currentConfig,
            currentPiAiMessages,
            {
              temperature: chatTemp,
              maxTokens,
              tools:
                currentToolSchemas.length > 0 ? currentToolSchemas : undefined,
              toolChoice: currentToolSchemas.length > 0 ? "auto" : undefined,
            },
          );

          // Log cost tracking from pi-ai
          if (response.usage.cost > 0) {
            console.log(
              `[ChatResponseService] LLM call cost: $${response.usage.cost.toFixed(6)} (${response.usage.inputTokens} in, ${response.usage.outputTokens} out)`,
            );
          }

          const assistantContent = response.content;
          const piAiToolCalls = response.toolCalls;

          // Check for text-based tool calls (fallback pattern)
          const textToolCalls =
            assistantContent && (!piAiToolCalls || piAiToolCalls.length === 0)
              ? extractAllTextToolCalls(assistantContent)
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
              content: assistantContent || null,
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

            const allFailed = toolResult.toolCallResults.every(
              (r) => !r.success,
            );
            consecutiveFailures = allFailed ? consecutiveFailures + 1 : 0;

            if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
              console.warn(
                `[ChatResponseService] Circuit breaker: ${consecutiveFailures} consecutive failures`,
              );
              break;
            }

            continue;
          }

          // Execute pi-ai tool calls (function-call based)
          if (piAiToolCalls && piAiToolCalls.length > 0) {
            // Convert pi-ai tool calls to the format expected by executeFunctionCallsNonStreaming
            const openAIStyleToolCalls = piAiToolCalls.map((tc) => ({
              id: tc.id,
              type: "function" as const,
              function: {
                name: tc.name,
                arguments: JSON.stringify(tc.arguments),
              },
            }));

            const toolResult = await executeFunctionCallsNonStreaming(
              userId,
              openAIStyleToolCalls,
              flowId,
              iterationCount,
              onToolCall,
            );

            allToolResults.push(...toolResult.toolResults);

            // Add to message history
            messages.push({
              role: "assistant",
              content: assistantContent,
              tool_calls: openAIStyleToolCalls,
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
          fullResponse = assistantContent || "";
          break;
        } catch (llmError: any) {
          console.error(`[ChatResponseService] LLM error:`, llmError.message);

          // Try fallback provider if available and not already using it
          if (!usedFallback && fallbackConfig) {
            console.warn(
              `[ChatResponseService] Attempting fallback to ${fallbackConfig.modelId}`,
            );
            usedFallback = true;
            // Don't throw, let the loop retry with fallback
            continue;
          }

          throw llmError;
        }
      }

      // === SMART RETRY ANALYSIS ===
      // Check if we need to retry due to empty response or tool failures
      const retryDecision = smartRetryService.analyzeAndDecide({
        response: fullResponse,
        toolResults: allToolResults.map((r) => ({
          toolUsed: r.toolUsed,
          success: r.success,
          error: r.error,
          params: r.params,
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

        // Continue to next retry iteration
        continue;
      }

      // No retry needed or max retries reached - break outer loop
      break;
    } // End of outer retry loop

    // If we exhausted retries and still have no response, provide fallback
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
        smartRetryAttempts: retryAttempt,
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
