// LLM Router Service
// Routes requests to appropriate language model based on task and user configuration
// All LLM calls are routed through piAiProviderService for unified multi-provider support

import {
  UserProfile,
  formatProfileForPrompt,
  getUserProfile,
} from "./user-profile.js";
import {
  getValidOAuthApiKey,
  piAiProviderService,
  classifyLLMError,
  type PiAiProviderConfig,
  type ChatMessage,
} from "./pi-ai-provider.js";
import {
  isModelBlacklisted,
  markModelEndpointIncompatible,
  recordModelError,
  recordModelSuccess,
} from "./model-compatibility-hint.js";

import { chatGPTOAuthService } from "./chatgpt-oauth.js";
import prisma from "./prisma.js";

// Re-export LLMErrorInfo type from pi-ai-provider for backward compatibility
export type { LLMErrorInfo } from "./pi-ai-provider.js";

// Re-export classifyLLMError from pi-ai-provider (the canonical implementation)
export { classifyLLMError } from "./pi-ai-provider.js";

/**
 * Get the current date formatted for system prompts
 * Format: "23 janvier 2026" in French locale
 */
export function getCurrentDateForPrompt(): string {
  const now = new Date();
  return now.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Inject current date into system prompt
 */
export function injectDateIntoPrompt(systemPrompt: string): string {
  if (!systemPrompt) return systemPrompt;
  const datePrefix = `[Date actuelle: ${getCurrentDateForPrompt()}]\n\n`;
  return datePrefix + systemPrompt;
}

/**
 * Inject user profile into system prompt
 */
export function injectProfileIntoPrompt(
  systemPrompt: string,
  profile: UserProfile,
): string {
  if (!systemPrompt) return systemPrompt;

  const profileContext = formatProfileForPrompt(profile);
  if (!profileContext) {
    return systemPrompt;
  }

  return `${profileContext}\n\n${systemPrompt}`;
}

/**
 * Format available API keys for LLM context
 * Only includes key names and display names (NOT the actual secret values)
 * Safe to include in LLM prompts
 */
async function formatAvailableAPIKeysForPrompt(
  userId: string,
): Promise<string> {
  try {
    const { secretsService } = await import("./secrets.js");
    const availableKeys =
      await secretsService.getAvailableKeysForContext(userId);

    if (!availableKeys || availableKeys.length === 0) {
      return "";
    }

    // Group by category
    const categorized = new Map<
      string,
      Array<{ key: string; displayName: string }>
    >();
    for (const secret of availableKeys) {
      const category = secret.category || "general";
      if (!categorized.has(category)) {
        categorized.set(category, []);
      }
      categorized.get(category)!.push({
        key: secret.key,
        displayName: secret.displayName,
      });
    }

    const parts: string[] = [];
    for (const [category, keys] of Array.from(categorized.entries())) {
      const keyList = keys
        .map((k) => `  - ${k.key} (${k.displayName})`)
        .join("\n");
      parts.push(`${category}:\n${keyList}`);
    }

    return `[Clés API disponibles]\nLes clés suivantes sont déjà configurées et prêtes à utiliser:\n${parts.join("\n\n")}`;
  } catch (error) {
    // Don't fail if we can't get API keys - just omit this section
    console.warn("Failed to retrieve API keys for context:", error);
    return "";
  }
}

/**
 * Inject both date and user profile into system prompt
 */
export async function injectContextIntoPrompt(
  systemPrompt: string,
  userId: string,
): Promise<string> {
  if (!systemPrompt) return systemPrompt;

  // Get user profile and available API keys in parallel
  const [profile, apiKeysContext] = await Promise.all([
    getUserProfile(userId),
    formatAvailableAPIKeysForPrompt(userId),
  ]);

  // Build context prefix
  const parts: string[] = [];

  // Add date
  parts.push(`[Date actuelle: ${getCurrentDateForPrompt()}]`);

  // Add profile if not empty
  const profileContext = formatProfileForPrompt(profile);
  if (profileContext) {
    parts.push(profileContext);
  }

  // Add available API keys if any
  if (apiKeysContext) {
    parts.push(apiKeysContext);
  }

  const contextPrefix = parts.join("\n\n");
  return `${contextPrefix}\n\n${systemPrompt}`;
}

/**
 * Determine which parameter name to use for max tokens based on the model
 * Some newer models (e.g., gpt-5-*) use 'max_completion_tokens' instead of 'max_tokens'
 * @returns 'max_tokens' or 'max_completion_tokens'
 */
export function getMaxTokensParamName(
  modelId: string,
): "max_tokens" | "max_completion_tokens" {
  // Models that use max_completion_tokens instead of max_tokens
  const maxCompletionTokensModels = ["gpt-5", "gpt-5-nano", "gpt-5-turbo"];

  // Check if model matches any of the max_completion_tokens models
  for (const model of maxCompletionTokensModels) {
    if (modelId.includes(model)) {
      return "max_completion_tokens";
    }
  }

  // Default to max_tokens for all other models
  return "max_tokens";
}

/**
 * Get the appropriate temperature for a model
 * Some models (e.g., gpt-5-nano) only support default temperature (1)
 * @returns temperature value or undefined to use model default
 */
export function getTemperatureForModel(
  modelId: string,
  requestedTemperature?: number,
): number | undefined {
  // Models that only support default temperature (1)
  const defaultTemperatureOnlyModels = ["gpt-5-nano"];

  // Check if model requires default temperature
  for (const model of defaultTemperatureOnlyModels) {
    if (modelId.includes(model)) {
      // Return undefined to let API use its default, or return 1 explicitly
      return undefined;
    }
  }

  // For other models, return the requested temperature or undefined
  return requestedTemperature;
}

export type LLMModel =
  | "gpt-4-turbo"
  | "gpt-4o"
  | "gpt-4o-mini"
  | "gpt-3.5-turbo"
  | "claude-3-opus"
  | "claude-3-sonnet"
  | "claude-3-haiku"
  | "local-llm"
  | string; // Allow custom model IDs

export type LLMTaskType =
  | "chat"
  | "reflection"
  | "summarization"
  | "routing"
  | "analysis"
  | "embeddings";

export interface LLMRoutingDecision {
  model: LLMModel;
  maxTokens: number;
  temperature: number;
  costEstimate: number;
  reason: string;
  providerId?: string;
}

export interface TaskExecutionOptions {
  maxTokens?: number;
  temperature?: number;
  responseFormat?: "text" | "json";
  stream?: boolean;
}

interface ProviderConfig {
  id: string;
  name: string;
  apiKey: string;
  baseUrl: string | null;
  modelId: string;
  fallbackProviderId?: string | null;
  fallbackName?: string | null;
  fallbackApiKey?: string | null;
  fallbackBaseUrl?: string | null;
  fallbackModelId?: string | null;
}

// Task type to AITaskConfig mapping
// Using string literals since Prisma client needs regeneration for new enum values
const TASK_TYPE_MAP: Record<LLMTaskType, string> = {
  chat: "CHAT",
  reflection: "REFLECTION",
  summarization: "SUMMARIZATION",
  routing: "ROUTING",
  analysis: "ANALYSIS",
  embeddings: "EMBEDDINGS",
};

export class LLMRouterService {
  /**
   * Determine best model for a given task
   */
  async routeRequest(
    taskType: LLMTaskType,
    complexity: "low" | "medium" | "high",
    contextSize: number,
    isSensitiveData: boolean,
  ): Promise<LLMRoutingDecision> {
    // For sensitive data, prefer local model
    if (isSensitiveData) {
      return {
        model: "local-llm",
        maxTokens: 32000,
        temperature: 0.7,
        costEstimate: 0,
        reason: "Sensitive data - using local model",
      };
    }

    // Route based on complexity and context size
    if (complexity === "high" || contextSize > 50000) {
      return {
        model: "gpt-4o",
        maxTokens: 16000,
        temperature: 0.7,
        costEstimate: 0.03,
        reason: "Complex task or large context - using GPT-4o",
      };
    }

    if (complexity === "medium") {
      return {
        model: "gpt-4o-mini",
        maxTokens: 8000,
        temperature: 0.7,
        costEstimate: 0.01,
        reason: "Medium complexity - using GPT-4o-mini",
      };
    }

    return {
      model: "gpt-3.5-turbo",
      maxTokens: 4096,
      temperature: 0.7,
      costEstimate: 0.002,
      reason: "Simple task - using cost-effective model",
    };
  }

  /**
   * Get configured provider for a specific task type
   * Falls back to finding any compatible provider if no task-specific config exists
   */
  async getProviderForTask(
    userId: string,
    taskType: LLMTaskType,
  ): Promise<ProviderConfig | null> {
    const configTaskType = TASK_TYPE_MAP[taskType] || "CHAT";

    const taskConfig = await prisma.aITaskConfig.findFirst({
      where: {
        userId,
        taskType: configTaskType as any,
      },
      include: {
        provider: true,
        model: true,
        fallbackProvider: true,
        fallbackModel: true,
      },
    });

    if (taskConfig?.provider) {
      // Task-specific configuration found
      return {
        id: taskConfig.provider.id,
        name: taskConfig.provider.name,
        apiKey: taskConfig.provider.apiKey,
        baseUrl: taskConfig.provider.baseUrl,
        modelId: taskConfig.model?.modelId || "gpt-3.5-turbo",
        fallbackProviderId: taskConfig.fallbackProvider?.id,
        fallbackName: taskConfig.fallbackProvider?.name,
        fallbackApiKey: taskConfig.fallbackProvider?.apiKey,
        fallbackBaseUrl: taskConfig.fallbackProvider?.baseUrl,
        fallbackModelId: taskConfig.fallbackModel?.modelId,
      };
    }

    // No task-specific config found - try to find a fallback provider
    console.warn(
      `[LLMRouter] No task configuration found for taskType: ${configTaskType} for user: ${userId}. Attempting to find a fallback provider.`,
    );

    // Try to get a fallback provider with a compatible model
    const fallbackProvider = await this.getFallbackProvider(
      userId,
      configTaskType,
    );
    if (fallbackProvider) {
      console.info(
        `[LLMRouter] Using fallback provider "${fallbackProvider.name}" (${fallbackProvider.modelId}) for task: ${configTaskType}`,
      );
      return fallbackProvider;
    }

    console.error(
      `[LLMRouter] No AI provider available for task: ${configTaskType} for user: ${userId}. User must set up at least one provider with compatible models in AI Settings.`,
    );
    return null;
  }

  /**
   * Find a fallback provider when no task-specific configuration exists
   * Searches for any enabled provider with a model that has the required capability
   * If userId is "system", searches across all users to find any available provider
   */
  private async getFallbackProvider(
    userId: string,
    capability: string,
  ): Promise<ProviderConfig | null> {
    // For "system" user, we need to search across all users
    const whereClause =
      userId === "system" ? { isEnabled: true } : { userId, isEnabled: true };

    // First, try to find a provider with a model that explicitly has this capability
    const providerWithCapability = await prisma.aIProvider.findFirst({
      where: {
        ...whereClause,
        models: {
          some: {
            capabilities: {
              has: capability as any,
            },
          },
        },
      },
      include: {
        models: {
          where: {
            capabilities: {
              has: capability as any,
            },
          },
          take: 1,
        },
      },
    });

    if (providerWithCapability && providerWithCapability.models.length > 0) {
      if (userId === "system") {
        console.info(
          `[LLMRouter] Using global fallback provider "${providerWithCapability.name}" for system-level task`,
        );
      }
      return {
        id: providerWithCapability.id,
        name: providerWithCapability.name,
        apiKey: providerWithCapability.apiKey,
        baseUrl: providerWithCapability.baseUrl,
        modelId: providerWithCapability.models[0].modelId,
      };
    }

    // If no provider with explicit capability, try to use any enabled provider
    // For general LLM tasks (CHAT, ROUTING, REFLECTION, SUMMARIZATION, ANALYSIS)
    // any chat-capable model should work
    const llmCapabilities = [
      "CHAT",
      "ROUTING",
      "REFLECTION",
      "SUMMARIZATION",
      "ANALYSIS",
    ];
    if (llmCapabilities.includes(capability)) {
      // Find any provider with a CHAT capable model as a last resort
      const anyLLMProvider = await prisma.aIProvider.findFirst({
        where: {
          ...whereClause,
          models: {
            some: {
              capabilities: {
                has: "CHAT" as any,
              },
            },
          },
        },
        include: {
          models: {
            where: {
              capabilities: {
                has: "CHAT" as any,
              },
            },
            take: 1,
          },
        },
      });

      if (anyLLMProvider && anyLLMProvider.models.length > 0) {
        console.info(
          `[LLMRouter] Using CHAT-capable model "${anyLLMProvider.models[0].modelId}" as fallback for ${capability}`,
        );
        return {
          id: anyLLMProvider.id,
          name: anyLLMProvider.name,
          apiKey: anyLLMProvider.apiKey,
          baseUrl: anyLLMProvider.baseUrl,
          modelId: anyLLMProvider.models[0].modelId,
        };
      }

      // Last resort: find any enabled provider with any model
      const anyProvider = await prisma.aIProvider.findFirst({
        where: {
          ...whereClause,
          models: {
            some: {},
          },
        },
        include: {
          models: {
            take: 1,
          },
        },
      });

      if (anyProvider && anyProvider.models.length > 0) {
        console.warn(
          `[LLMRouter] Using any available model "${anyProvider.models[0].modelId}" as last resort fallback for ${capability}`,
        );
        return {
          id: anyProvider.id,
          name: anyProvider.name,
          apiKey: anyProvider.apiKey,
          baseUrl: anyProvider.baseUrl,
          modelId: anyProvider.models[0].modelId,
        };
      }
    }

    return null;
  }

  /**
   * Execute a task using the appropriate LLM
   */
  async executeTask(
    userId: string,
    taskType: LLMTaskType,
    userMessage: string,
    systemPrompt?: string,
    options?: TaskExecutionOptions,
  ): Promise<string> {
    const provider = await this.getProviderForTask(userId, taskType);

    if (!provider) {
      throw new Error(`No AI provider configured for task: ${taskType}`);
    }

    return this.callLLM(
      provider,
      systemPrompt || "",
      userMessage,
      options,
      userId,
    );
  }

  /**
   * Call LLM with provider configuration and automatic fallback on failure
   * Intelligently handles different error types and falls back accordingly
   * Learns from errors to improve future provider/model selection
   */
  async callLLM(
    provider: ProviderConfig,
    systemPrompt: string,
    userMessage: string,
    options?: TaskExecutionOptions,
    userId?: string,
  ): Promise<string> {
    const { validateMaxTokens, isMaxTokensError, getFallbackMaxTokens } =
      await import("../utils/token-validator.js");

    // Check if primary provider/model is blacklisted
    const primaryBlacklisted = await isModelBlacklisted(
      provider.id,
      provider.modelId,
    );
    if (primaryBlacklisted) {
      console.warn(
        `[LLMRouter] Primary provider "${provider.name}" (${provider.modelId}) is blacklisted, skipping to fallback`,
      );
    }

    // Try primary provider first (if not blacklisted)
    if (!primaryBlacklisted) {
      try {
        const result = await this.attemptLLMCall(
          provider.apiKey,
          provider.baseUrl,
          provider.modelId,
          systemPrompt,
          userMessage,
          validateMaxTokens,
          isMaxTokensError,
          getFallbackMaxTokens,
          options,
          userId,
          provider.id, // Pass providerId for tracking
        );

        // Record success
        await recordModelSuccess(provider.id, provider.modelId);
        return result;
      } catch (primaryError) {
        const primaryErrorInfo = classifyLLMError(primaryError);

        // Record the error for learning, including endpoint hints
        const suggestedEndpoint = (primaryError as any)?.suggestedEndpoint;
        await recordModelError(
          provider.id,
          provider.modelId,
          primaryErrorInfo,
          suggestedEndpoint,
        );

        console.warn(
          `[LLMRouter] Primary provider "${provider.name}" (${provider.modelId}) failed with ${primaryErrorInfo.type} error`,
          {
            status: primaryErrorInfo.status,
            message: primaryErrorInfo.message,
            isRetryable: primaryErrorInfo.isRetryable,
            isTransient: primaryErrorInfo.isTransient,
            suggestedEndpoint,
          },
        );
      }
    }

    // If primary failed and fallback is configured, try fallback
    if (
      provider.fallbackProviderId &&
      provider.fallbackApiKey &&
      provider.fallbackModelId
    ) {
      console.warn(
        `[LLMRouter] Attempting fallback provider "${provider.fallbackName}" (${provider.fallbackModelId})`,
      );

      // Check if fallback is blacklisted
      const fallbackBlacklisted = await isModelBlacklisted(
        provider.fallbackProviderId,
        provider.fallbackModelId,
      );
      if (fallbackBlacklisted) {
        console.warn(
          `[LLMRouter] Fallback provider "${provider.fallbackName}" (${provider.fallbackModelId}) is also blacklisted`,
        );
      }

      if (!fallbackBlacklisted) {
        try {
          const result = await this.attemptLLMCall(
            provider.fallbackApiKey,
            provider.fallbackBaseUrl,
            provider.fallbackModelId,
            systemPrompt,
            userMessage,
            validateMaxTokens,
            isMaxTokensError,
            getFallbackMaxTokens,
            options,
            userId,
            provider.fallbackProviderId, // Pass providerId for tracking
          );

          // Record success
          await recordModelSuccess(
            provider.fallbackProviderId,
            provider.fallbackModelId,
          );
          return result;
        } catch (fallbackError) {
          const fallbackErrorInfo = classifyLLMError(fallbackError);

          // Record the error for learning with endpoint hints
          const suggestedEndpoint = (fallbackError as any)?.suggestedEndpoint;
          await recordModelError(
            provider.fallbackProviderId,
            provider.fallbackModelId,
            fallbackErrorInfo,
            suggestedEndpoint,
          );

          console.error(
            `[LLMRouter] Both primary and fallback providers failed.`,
            {
              primary: {
                name: provider.name,
                model: provider.modelId,
                blacklisted: primaryBlacklisted,
              },
              fallback: {
                name: provider.fallbackName,
                model: provider.fallbackModelId,
                type: fallbackErrorInfo.type,
                status: fallbackErrorInfo.status,
                message: fallbackErrorInfo.message,
              },
            },
          );

          // Create detailed error message
          const errorMsg = `Both primary provider "${provider.name}" (${provider.modelId}) and fallback provider "${provider.fallbackName}" (${provider.fallbackModelId}) failed. Primary: ${primaryBlacklisted ? "blacklisted" : "timeout"}. Fallback: ${fallbackErrorInfo.type} (${fallbackErrorInfo.message})`;

          // Attach classification info to error for consumers to handle gracefully
          const error = new Error(errorMsg);
          (error as any).primaryErrorInfo = primaryBlacklisted
            ? { type: "blacklisted", isRetryable: false, isTransient: false }
            : classifyLLMError(new Error("timeout"));
          (error as any).fallbackErrorInfo = fallbackErrorInfo;
          throw error;
        }
      }
    }

    // No fallback configured or both are blacklisted, throw with classification info
    const error = new Error(
      `Primary provider "${provider.name}" (${provider.modelId}) failed: ${primaryBlacklisted ? "blacklisted" : "unknown error"}. No fallback configured.`,
    );
    (error as any).errorInfo = {
      type: primaryBlacklisted ? "blacklisted" : "unknown",
      isRetryable: false,
      isTransient: false,
    };
    (error as any).providerDebugInfo = {
      provider: provider.name,
      modelId: provider.modelId,
      baseUrl: provider.baseUrl,
      hasFallback: !!(provider.fallbackProviderId && provider.fallbackApiKey),
    };
    throw error;
  }

  /**
   * Attempt a single LLM call with retry logic for token errors
   * Learns about model endpoint compatibility from errors
   * @private
   *
   * Now uses piAiProviderService for unified multi-provider support.
   */
  private async attemptLLMCall(
    apiKey: string,
    baseUrl: string | null | undefined,
    modelId: string,
    systemPrompt: string,
    userMessage: string,
    validateMaxTokens: any,
    isMaxTokensError: any,
    getFallbackMaxTokens: any,
    options?: TaskExecutionOptions,
    userId?: string,
    providerId?: string,
  ): Promise<string> {
    // Build messages for pi-ai
    const messages: ChatMessage[] = [];

    if (systemPrompt) {
      // Inject current date into system prompt
      const enhancedSystemPrompt = injectDateIntoPrompt(systemPrompt);
      messages.push({ role: "system", content: enhancedSystemPrompt });
    }
    messages.push({ role: "user", content: userMessage });

    // Get user's configured max tokens, or use default
    let defaultMaxTokens = 2048;
    if (userId) {
      const { getDefaultMaxTokens } =
        await import("../controllers/ai-settings.controller.js");
      try {
        defaultMaxTokens = await getDefaultMaxTokens(userId);
      } catch (error) {
        console.warn(
          `Failed to get user max tokens, using default: ${defaultMaxTokens}`,
          error,
        );
      }
    }

    // Use options.maxTokens if provided, otherwise use user's configured default
    const maxTokensToUse = options?.maxTokens || defaultMaxTokens;

    // Validate max_tokens before making the request
    const messagesStr = `${systemPrompt}${userMessage}`.substring(0, 2000);
    const validation = validateMaxTokens(
      maxTokensToUse,
      modelId,
      messages.length,
      messagesStr,
    );

    const requestedMaxTokens = validation.maxTokens;

    if (validation.warning) {
      console.warn(
        `[TokenValidator] ${validation.warning} in attemptLLMCall for model ${modelId}`,
      );
    }

    // Build pi-ai provider config
    const providerConfig: PiAiProviderConfig = {
      provider: "openai", // Default to openai-compatible API
      modelId,
      apiKey,
      baseUrl: baseUrl || undefined,
    };

    // Get temperature only if the model supports it
    const temperature = getTemperatureForModel(
      modelId,
      options?.temperature ?? 0.7,
    );

    try {
      const response = await piAiProviderService.createChatCompletion(
        providerConfig,
        messages,
        {
          temperature,
          maxTokens: requestedMaxTokens,
          responseFormat: options?.responseFormat,
        },
      );

      const content = response.content;
      if (!content || (typeof content === "string" && content.trim() === "")) {
        const errorDetails = {
          hasContent: !!content,
          contentType: typeof content,
          contentLength: content?.length,
          modelId,
          baseUrl,
          provider: providerConfig.provider,
        };
        console.error("[LLMRouter] Empty response from LLM", errorDetails);
        throw new Error(
          `Empty response from LLM (${modelId}): ${JSON.stringify(errorDetails)}`,
        );
      }

      // Log cost tracking from pi-ai
      if (response.usage.cost > 0) {
        console.log(
          `[LLMRouter] LLM call cost: $${response.usage.cost.toFixed(6)} (${response.usage.inputTokens} in, ${response.usage.outputTokens} out)`,
        );
      }

      return content;
    } catch (llmError) {
      // Handle model-incompatible errors specially to learn the right endpoint
      const errorMsg = (llmError as any)?.message || String(llmError);
      const errorStatus =
        (llmError as any)?.status || (llmError as any)?.response?.status;
      const errorCode = (llmError as any)?.code;
      const isIncompatibilityError =
        errorMsg.includes("model-incompatible") ||
        errorMsg.includes("only supported in v1/responses") ||
        (errorMsg.includes("404") && errorMsg.includes("model"));

      // Log detailed error information for debugging
      console.error(
        `[LLMRouter] LLM call failed for ${providerId}/${modelId}:`,
        {
          message: errorMsg,
          status: errorStatus,
          code: errorCode,
          baseUrl,
          type: (llmError as any)?.type || typeof llmError,
        },
      );

      if (isIncompatibilityError) {
        // This model doesn't work with chat/completions endpoint
        console.warn(
          `[LLMRouter] Model ${modelId} incompatible with /v1/chat/completions endpoint`,
        );

        // Try to extract the correct endpoint from error message
        let alternativeEndpoint: string | undefined;
        if (
          errorMsg.includes("v1/responses") ||
          errorMsg.includes("responses")
        ) {
          alternativeEndpoint = "v1/responses";
        }

        if (providerId && alternativeEndpoint) {
          // Mark this model as endpoint-incompatible for permanent learning
          await markModelEndpointIncompatible(
            providerId,
            modelId,
            alternativeEndpoint,
          );

          // Store endpoint suggestion on error for caller to use
          (llmError as any).suggestedEndpoint = alternativeEndpoint;
          (llmError as any).isEndpointIncompatibility = true;
        }
      }

      // Handle max_tokens errors specifically
      if (isMaxTokensError(llmError)) {
        console.warn(
          "[TokenFallback] Max tokens error. Using fallback max_tokens.",
        );

        // Retry with fallback max_tokens using pi-ai
        const fallbackMaxTokens = Math.min(getFallbackMaxTokens(modelId), 512);

        try {
          const fallbackResponse =
            await piAiProviderService.createChatCompletion(
              providerConfig,
              messages,
              {
                temperature,
                maxTokens: fallbackMaxTokens,
                responseFormat: options?.responseFormat,
              },
            );

          const content = fallbackResponse.content;
          if (!content) {
            throw llmError;
          }

          return content;
        } catch (fallbackTokenError) {
          console.error(
            "[TokenFallback] Token fallback also failed:",
            fallbackTokenError,
          );
          throw fallbackTokenError;
        }
      }

      // Not a max_tokens error, re-throw to propagate to caller
      throw llmError;
    }
  }

  /**
   * Call LLM with context injection from memories
   */
  async callLLMWithContext(
    userId: string,
    taskType: LLMTaskType,
    systemPrompt: string,
    userMessage: string,
    contextMemories?: string[],
    options?: TaskExecutionOptions,
  ): Promise<string> {
    let enhancedPrompt = systemPrompt;

    if (contextMemories && contextMemories.length > 0) {
      const contextSection = contextMemories
        .map((m, i) => `[Memory ${i + 1}]: ${m}`)
        .join("\n\n");

      enhancedPrompt += `\n\n## Relevant Context from Memory:\n${contextSection}`;
    }

    return this.executeTask(
      userId,
      taskType,
      userMessage,
      enhancedPrompt,
      options,
    );
  }

  /**
   * Stream LLM response for real-time output
   * Now uses piAiProviderService for unified multi-provider support.
   */
  async *streamTask(
    userId: string,
    taskType: LLMTaskType,
    userMessage: string,
    systemPrompt?: string,
    options?: TaskExecutionOptions,
  ): AsyncGenerator<string, void, unknown> {
    const provider = await this.getProviderForTask(userId, taskType);

    if (!provider) {
      throw new Error(`No AI provider configured for task: ${taskType}`);
    }

    // Build messages for pi-ai
    const messages: ChatMessage[] = [];
    if (systemPrompt) {
      // Inject current date into system prompt
      const enhancedSystemPrompt = injectDateIntoPrompt(systemPrompt);
      messages.push({ role: "system", content: enhancedSystemPrompt });
    }
    messages.push({ role: "user", content: userMessage });

    // Get temperature only if the model supports it
    const streamTemp = getTemperatureForModel(
      provider.modelId,
      options?.temperature ?? 0.7,
    );

    // Build pi-ai provider config
    const providerConfig: PiAiProviderConfig = {
      provider: "openai",
      modelId: provider.modelId,
      apiKey: provider.apiKey,
      baseUrl: provider.baseUrl || undefined,
    };

    // Use pi-ai streaming
    const stream = piAiProviderService.createStreamingChatCompletion(
      providerConfig,
      messages,
      {
        temperature: streamTemp,
        maxTokens: options?.maxTokens || 8000, // Generous default
      },
    );

    for await (const event of stream) {
      if (event.type === "text" && event.content) {
        yield event.content;
      } else if (event.type === "error") {
        throw new Error(event.error);
      }
    }
  }

  /**
   * Execute a task using ChatGPT OAuth (ChatGPT Plus/Pro subscription)
   * Uses pi-ai library for the actual API call to ChatGPT's backend
   *
   * @param userId User ID to get OAuth credentials for
   * @param systemPrompt System prompt for the conversation
   * @param userMessage User's message
   * @param options Execution options
   */
  async executeWithChatGPTOAuth(
    userId: string,
    systemPrompt: string,
    userMessage: string,
    options?: TaskExecutionOptions,
  ): Promise<string> {
    // Check if user has OAuth credentials
    const oauthStatus = await chatGPTOAuthService.getOAuthStatus(userId);
    if (!oauthStatus.isConnected || !oauthStatus.isEnabled) {
      throw new Error(
        "ChatGPT OAuth is not connected or enabled for this user",
      );
    }

    // Get valid OAuth API key (refreshes if needed)
    const apiKey = await getValidOAuthApiKey(userId, "openai-codex");
    if (!apiKey) {
      throw new Error("Failed to get valid OAuth credentials");
    }

    // Use pi-ai to make the call
    const result = await piAiProviderService.createChatCompletion(
      {
        provider: "openai-codex",
        modelId: "gpt-5.2", // Default Codex model
        oauthCredentials: {
          access: apiKey,
          refresh: "", // Not needed for single call
          expires: Date.now() + 3600000, // Not used
        },
      },
      [
        ...(systemPrompt
          ? [{ role: "system" as const, content: systemPrompt }]
          : []),
        { role: "user" as const, content: userMessage },
      ],
      {
        temperature: options?.temperature ?? 0.7,
        maxTokens: options?.maxTokens,
      },
    );

    return result.content;
  }

  /**
   * Stream response using ChatGPT OAuth
   */
  async *streamWithChatGPTOAuth(
    userId: string,
    systemPrompt: string,
    userMessage: string,
    options?: TaskExecutionOptions,
  ): AsyncGenerator<string, void, unknown> {
    // Check if user has OAuth credentials
    const oauthStatus = await chatGPTOAuthService.getOAuthStatus(userId);
    if (!oauthStatus.isConnected || !oauthStatus.isEnabled) {
      throw new Error(
        "ChatGPT OAuth is not connected or enabled for this user",
      );
    }

    // Get valid OAuth API key
    const apiKey = await getValidOAuthApiKey(userId, "openai-codex");
    if (!apiKey) {
      throw new Error("Failed to get valid OAuth credentials");
    }

    // Use pi-ai streaming
    const stream = piAiProviderService.createStreamingChatCompletion(
      {
        provider: "openai-codex",
        modelId: "gpt-5.2",
        oauthCredentials: {
          access: apiKey,
          refresh: "",
          expires: Date.now() + 3600000,
        },
      },
      [
        ...(systemPrompt
          ? [{ role: "system" as const, content: systemPrompt }]
          : []),
        { role: "user" as const, content: userMessage },
      ],
      {
        temperature: options?.temperature ?? 0.7,
        maxTokens: options?.maxTokens,
        stream: true,
      },
    );

    for await (const event of stream) {
      if (event.type === "text" && event.content) {
        yield event.content;
      }
      if (event.type === "error" && event.error) {
        throw new Error(event.error);
      }
    }
  }
}

// Export singleton instance
export const llmRouterService = new LLMRouterService();
