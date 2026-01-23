// LLM Router Service
// Routes requests to appropriate language model based on task and user configuration

import prisma from "./prisma.js";
import OpenAI from "openai";
import {
  getUserProfile,
  formatProfileForPrompt,
  UserProfile,
} from "./user-profile.js";

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
 * Inject both date and user profile into system prompt
 */
export async function injectContextIntoPrompt(
  systemPrompt: string,
  userId: string,
): Promise<string> {
  if (!systemPrompt) return systemPrompt;

  // Get user profile
  const profile = await getUserProfile(userId);

  // Build context prefix
  const parts: string[] = [];

  // Add date
  parts.push(`[Date actuelle: ${getCurrentDateForPrompt()}]`);

  // Add profile if not empty
  const profileContext = formatProfileForPrompt(profile);
  if (profileContext) {
    parts.push(profileContext);
  }

  const contextPrefix = parts.join("\n\n");
  return `${contextPrefix}\n\n${systemPrompt}`;
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
}

// Task type to AITaskConfig mapping
// Using string literals since Prisma client needs regeneration for new enum values
const TASK_TYPE_MAP: Record<LLMTaskType, string> = {
  chat: "CHAT",
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
        maxTokens: 2000,
        temperature: 0.7,
        costEstimate: 0,
        reason: "Sensitive data - using local model",
      };
    }

    // Route based on complexity and context size
    if (complexity === "high" || contextSize > 50000) {
      return {
        model: "gpt-4o",
        maxTokens: 4096,
        temperature: 0.7,
        costEstimate: 0.03,
        reason: "Complex task or large context - using GPT-4o",
      };
    }

    if (complexity === "medium") {
      return {
        model: "gpt-4o-mini",
        maxTokens: 2048,
        temperature: 0.7,
        costEstimate: 0.01,
        reason: "Medium complexity - using GPT-4o-mini",
      };
    }

    return {
      model: "gpt-3.5-turbo",
      maxTokens: 2048,
      temperature: 0.7,
      costEstimate: 0.002,
      reason: "Simple task - using cost-effective model",
    };
  }

  /**
   * Get configured provider for a specific task type
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
      },
    });

    if (!taskConfig?.provider) {
      // Fallback: try to get any configured provider
      const anyProvider = await prisma.aIProvider.findFirst({
        where: { userId, isEnabled: true },
        include: { models: true },
      });

      if (!anyProvider || !anyProvider.apiKey) {
        return null;
      }

      const defaultModel = anyProvider.models[0];

      return {
        id: anyProvider.id,
        name: anyProvider.name,
        apiKey: anyProvider.apiKey,
        baseUrl: anyProvider.baseUrl,
        modelId: defaultModel?.modelId || "gpt-3.5-turbo",
      };
    }

    return {
      id: taskConfig.provider.id,
      name: taskConfig.provider.name,
      apiKey: taskConfig.provider.apiKey,
      baseUrl: taskConfig.provider.baseUrl,
      modelId: taskConfig.model?.modelId || "gpt-3.5-turbo",
    };
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

    return this.callLLM(provider, systemPrompt || "", userMessage, options);
  }

  /**
   * Call LLM with provider configuration
   */
  async callLLM(
    provider: ProviderConfig,
    systemPrompt: string,
    userMessage: string,
    options?: TaskExecutionOptions,
  ): Promise<string> {
    const { validateMaxTokens, isMaxTokensError, getFallbackMaxTokens } =
      await import("../utils/token-validator.js");

    const client = new OpenAI({
      apiKey: provider.apiKey,
      baseURL: provider.baseUrl || "https://api.openai.com/v1",
    });

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    if (systemPrompt) {
      // Inject current date into system prompt
      const enhancedSystemPrompt = injectDateIntoPrompt(systemPrompt);
      messages.push({ role: "system", content: enhancedSystemPrompt });
    }
    messages.push({ role: "user", content: userMessage });

    // Validate max_tokens before making the request
    const messagesStr = `${systemPrompt}${userMessage}`.substring(0, 2000);
    const validation = validateMaxTokens(
      options?.maxTokens || 2048,
      provider.modelId,
      messages.length,
      messagesStr,
    );

    const requestedMaxTokens = validation.maxTokens;

    if (validation.warning) {
      console.warn(
        `[TokenValidator] ${validation.warning} in callLLM for model ${provider.modelId}`,
      );
    }

    const requestOptions: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
      model: provider.modelId,
      messages,
      max_tokens: requestedMaxTokens,
      temperature: options?.temperature ?? 0.7,
    };

    // Add JSON response format if requested
    if (options?.responseFormat === "json") {
      requestOptions.response_format = { type: "json_object" };
    }

    try {
      const response = await client.chat.completions.create(requestOptions);

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("Empty response from LLM");
      }

      return content;
    } catch (llmError) {
      // Handle max_tokens errors specifically
      if (isMaxTokensError(llmError)) {
        console.warn(
          "[TokenFallback] Max tokens error in callLLM. Using fallback max_tokens.",
        );

        // Retry with fallback max_tokens
        const fallbackMaxTokens = getFallbackMaxTokens(provider.modelId);
        const fallbackOptions = {
          ...requestOptions,
          max_tokens: Math.min(fallbackMaxTokens, 512),
        };

        try {
          const fallbackResponse =
            await client.chat.completions.create(fallbackOptions);

          const content = fallbackResponse.choices[0]?.message?.content;
          if (!content) {
            throw llmError;
          }

          return content;
        } catch (fallbackError) {
          console.error(
            "[TokenFallback] Fallback also failed in callLLM:",
            fallbackError,
          );
          throw fallbackError;
        }
      }

      // Not a max_tokens error, re-throw
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

    const client = new OpenAI({
      apiKey: provider.apiKey,
      baseURL: provider.baseUrl || "https://api.openai.com/v1",
    });

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (systemPrompt) {
      // Inject current date into system prompt
      const enhancedSystemPrompt = injectDateIntoPrompt(systemPrompt);
      messages.push({ role: "system", content: enhancedSystemPrompt });
    }
    messages.push({ role: "user", content: userMessage });

    const stream = await client.chat.completions.create({
      model: provider.modelId,
      messages,
      max_tokens: options?.maxTokens || 2048,
      temperature: options?.temperature ?? 0.7,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }
}

// Export singleton instance
export const llmRouterService = new LLMRouterService();
