/**
 * Chat Token Recovery Service
 *
 * Handles context overflow errors and token constraints
 * - Max token validation
 * - Error detection and parsing
 * - Recovery strategies (context reduction, fallback providers)
 */

import {
  calculateSafeMaxTokens,
  getFallbackMaxTokens,
  isMaxTokensError,
  parseContextOverflowError,
  validateMaxTokens,
} from "../utils/token-validator.js";

import OpenAI from "openai";
import { getTemperatureForModel } from "./llm-router.js";
import { notificationService } from "./notification.js";

export interface TokenRecoveryResult {
  success: boolean;
  response?: string;
  messages?: any[];
  strategy: string;
  error?: string;
}

/**
 * Handle max tokens error with recovery strategies
 */
export async function recoverFromMaxTokensError(
  error: any,
  userId: string,
  openai: OpenAI,
  fallbackOpenAI: OpenAI | null,
  modelId: string,
  fallbackModelId: string | null,
  fallbackProvider: any,
  provider: any,
  messages: any[],
  toolSchemas: any[],
  flowId: string,
  flowTracker: any,
  iterationCount: number,
): Promise<TokenRecoveryResult> {
  console.error(
    `[LLM Error - Iteration ${iterationCount}]:`,
    error instanceof Error ? error.message : String(error),
  );

  if (!isMaxTokensError(error)) {
    // Not a max_tokens error, re-throw
    return {
      success: false,
      strategy: "not_applicable",
      error: "Not a max_tokens error",
    };
  }

  // Parse the error to get exact token information
  const overflowInfo = parseContextOverflowError(error);

  if (overflowInfo) {
    // We have precise information about the context overflow
    console.warn(
      `[TokenRecovery] Context overflow detected. Input: ${overflowInfo.inputTokens} tokens, ` +
        `Context limit: ${overflowInfo.contextLimit}, Available: ${overflowInfo.availableTokens}. ` +
        `Requested max_tokens was ${overflowInfo.requestedMaxTokens}, adjusting to ${overflowInfo.suggestedMaxTokens}.`,
    );

    flowTracker.trackEvent({
      flowId,
      stage: `context_overflow_recovery_${iterationCount}`,
      service: "ChatController",
      status: "started",
      data: {
        iteration: iterationCount,
        inputTokens: overflowInfo.inputTokens,
        contextLimit: overflowInfo.contextLimit,
        availableTokens: overflowInfo.availableTokens,
        requestedMaxTokens: overflowInfo.requestedMaxTokens,
        adjustedMaxTokens: overflowInfo.suggestedMaxTokens,
      },
    });

    // Strategy 0: If we have room, just adjust max_tokens and retry immediately
    if (overflowInfo.availableTokens >= 100) {
      const safeMaxTokens = calculateSafeMaxTokens(overflowInfo);
      console.log(
        `[TokenRecovery] Retrying with adjusted max_tokens: ${safeMaxTokens}`,
      );

      try {
        const recoveryTemp = getTemperatureForModel(modelId, 0.7);
        const recoveryPayload: any = {
          model: modelId,
          messages: messages as any,
          max_tokens: safeMaxTokens,
          tools: toolSchemas.map((schema) => ({
            type: "function",
            function: schema,
          })) as any[],
          tool_choice: "auto",
          stream: false,
        };

        // Only add temperature if the model supports it
        if (recoveryTemp !== undefined) {
          recoveryPayload.temperature = recoveryTemp;
        }

        const recoveryResponse =
          await openai.chat.completions.create(recoveryPayload);

        const recoveryMessage = recoveryResponse.choices[0]?.message;
        if (recoveryMessage) {
          flowTracker.trackEvent({
            flowId,
            stage: `context_overflow_recovery_success_${iterationCount}`,
            service: "ChatController",
            status: "success",
            data: {
              adjustedMaxTokens: safeMaxTokens,
              responseLength: recoveryMessage.content?.length || 0,
            },
          });

          // Notify user about the recovery
          try {
            await notificationService.createNotification({
              userId,
              title: "Response optimized",
              message: `Your conversation context is large. Response may be shorter than usual. Consider starting a new chat for complex queries.`,
              type: "INFO",
              channels: ["IN_APP"],
            });
          } catch (notifyError) {
            console.warn("Failed to send recovery notification:", notifyError);
          }

          return {
            success: true,
            response: recoveryMessage.content || "",
            strategy: "adjusted_max_tokens",
          };
        }
      } catch (recoveryError) {
        console.warn(
          `[TokenRecovery] Adjusted max_tokens retry failed:`,
          recoveryError instanceof Error
            ? recoveryError.message
            : String(recoveryError),
        );
        // Fall through to other strategies
      }
    }

    // Strategy 1: Reduce conversation history if context is still too large
    if (messages.length > 6 && overflowInfo.availableTokens < 500) {
      console.log(
        `[TokenRecovery] Context extremely tight (${overflowInfo.availableTokens} available). ` +
          `Reducing conversation history from ${messages.length} to essential messages.`,
      );
      // Keep system prompt + last 2 exchanges
      const systemMessages = messages.slice(0, 1);
      const recentMessages = messages.slice(-4);
      const reducedMessages = [...systemMessages, ...recentMessages];

      return {
        success: true,
        messages: reducedMessages,
        strategy: "reduce_history",
      };
    }
  }

  // Strategy 2: Try fallback provider if available
  if (fallbackOpenAI && fallbackProvider && fallbackModelId) {
    console.log(
      `[TokenFallback] Primary provider (${provider.name}) failed. Switching to fallback: ${fallbackProvider.name}`,
    );

    try {
      // Notify user about provider switch
      await notificationService.createNotification({
        userId,
        title: "Switching to alternative provider",
        message: `${provider.name} encountered issues. Attempting response with ${fallbackProvider.name}...`,
        type: "WARNING",
        channels: ["IN_APP"],
      });
    } catch (notifyError) {
      console.warn("Failed to send fallback notification:", notifyError);
    }

    flowTracker.trackEvent({
      flowId,
      stage: `fallback_provider_switch_${iterationCount}`,
      service: "ChatController",
      status: "started",
      data: {
        primaryProvider: provider.name,
        fallbackProvider: fallbackProvider.name,
        fallbackModel: fallbackModelId,
      },
    });

    try {
      const fallbackTemp = getTemperatureForModel(fallbackModelId, 0.7);
      const fallbackPayload: any = {
        model: fallbackModelId,
        messages: messages as any,
        max_tokens: Math.min(
          getFallbackMaxTokens(fallbackModelId),
          overflowInfo?.suggestedMaxTokens || 2000,
        ),
        tools: toolSchemas.map((schema) => ({
          type: "function",
          function: schema,
        })) as any[],
        tool_choice: "auto",
        stream: false,
      };

      // Only add temperature if the model supports it
      if (fallbackTemp !== undefined) {
        fallbackPayload.temperature = fallbackTemp;
      }

      const fallbackResponse =
        await fallbackOpenAI.chat.completions.create(fallbackPayload);

      const fallbackMessage = fallbackResponse.choices[0]?.message;
      if (fallbackMessage) {
        flowTracker.trackEvent({
          flowId,
          stage: `fallback_provider_success_${iterationCount}`,
          service: "ChatController",
          status: "success",
          data: {
            responseLength: fallbackMessage.content?.length || 0,
          },
        });

        return {
          success: true,
          response: fallbackMessage.content || "",
          strategy: "fallback_provider",
        };
      }
    } catch (fallbackProviderError) {
      console.warn(
        `[TokenFallback] Fallback provider (${fallbackProvider.name}) also failed:`,
        fallbackProviderError,
      );
      // Fall through to existing token reduction strategies
    }
  }

  // Strategy 3: Reduce conversation history
  if (messages.length > 10) {
    console.log(
      `[TokenFallback] Reducing conversation history from ${messages.length} to 5 messages`,
    );
    // Keep system prompt + last 4 messages (user + assistant pairs)
    const systemMessages = messages.slice(0, 1);
    const recentMessages = messages.slice(-4);
    const reducedMessages = [...systemMessages, ...recentMessages];

    return {
      success: true,
      messages: reducedMessages,
      strategy: "reduce_history",
    };
  }

  return {
    success: false,
    strategy: "all_failed",
    error: "All token recovery strategies failed",
  };
}

/**
 * Validate and adjust max tokens for a request
 */
export function validateAndAdjustMaxTokens(
  userMaxTokens: number,
  modelId: string,
  messagesCount: number,
  messagesStr: string,
  userId: string,
): {
  maxTokens: number;
  warning?: string;
} {
  const validation = validateMaxTokens(
    userMaxTokens,
    modelId,
    messagesCount,
    messagesStr,
  );

  if (validation.warning) {
    console.warn(`[TokenValidator] ${validation.warning}`);
  }

  return {
    maxTokens: validation.maxTokens,
    warning: validation.warning,
  };
}
