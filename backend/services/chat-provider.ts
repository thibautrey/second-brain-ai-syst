/**
 * Chat Provider Service
 *
 * Manages LLM provider configuration and caching for chat operations
 * - Provider lookup and caching (5-minute TTL)
 * - Fallback provider configuration
 * - Model ID validation
 */

import { PROVIDER_CACHE_TTL_MS } from "./intent-router.js";
import prisma from "./prisma.js";

export interface CachedChatProvider {
  provider: {
    id: string;
    name: string;
    apiKey: string;
    baseUrl: string | null;
  };
  modelId: string;
  fallbackProvider?: {
    id: string;
    name: string;
    apiKey: string;
    baseUrl: string | null;
  };
  fallbackModelId?: string;
  timestamp: number;
}

export interface ChatProviderResult {
  provider: any;
  modelId: string;
  fallbackProvider?: any;
  fallbackModelId?: string;
}

const chatProviderCache = new Map<string, CachedChatProvider>();

/**
 * Get chat provider for a user with caching
 * Validates model ID and throws helpful errors if configuration is missing
 */
export async function getChatProvider(
  userId: string,
): Promise<ChatProviderResult | null> {
  // Check cache first
  const cached = chatProviderCache.get(userId);
  if (cached && Date.now() - cached.timestamp < PROVIDER_CACHE_TTL_MS) {
    return {
      provider: cached.provider,
      modelId: cached.modelId,
      fallbackProvider: cached.fallbackProvider,
      fallbackModelId: cached.fallbackModelId,
    };
  }

  // Fetch from DB
  const taskConfig = await prisma.aITaskConfig.findFirst({
    where: { userId, taskType: "REFLECTION" },
    include: {
      provider: true,
      model: true,
      fallbackProvider: true,
      fallbackModel: true,
    },
  });

  if (!taskConfig?.provider) {
    throw new Error(
      "No AI provider configured for REFLECTION task. Please configure a provider and model for the REFLECTION task type in AI Settings. This is a required configuration.",
    );
  }

  const modelId = taskConfig.model?.modelId;

  if (!modelId) {
    throw new Error(
      "No model ID found for REFLECTION task configuration. Please ensure the REFLECTION task config has a valid model selected.",
    );
  }

  // Validate that modelId looks like a real model identifier (not just a numeric ID)
  // Real model IDs typically contain hyphens or specific patterns like 'gpt-4', 'whisper-1', etc.
  if (/^\d+$/.test(modelId)) {
    console.error(
      `[CRITICAL] Model ID appears to be a database ID instead of model identifier: ${modelId}. This suggests the AIModel.modelId field wasn't populated correctly.`,
    );
    throw new Error(
      `Invalid model identifier: "${modelId}". The model configuration may be corrupted. Please reconfigure your AI settings.`,
    );
  }

  const provider = taskConfig.provider;
  const fallbackProvider = taskConfig.fallbackProvider;
  const fallbackModelId = taskConfig.fallbackModel?.modelId;

  // Cache it
  chatProviderCache.set(userId, {
    provider: {
      id: provider.id,
      name: provider.name,
      apiKey: provider.apiKey,
      baseUrl: provider.baseUrl,
    },
    modelId,
    fallbackProvider: fallbackProvider
      ? {
          id: fallbackProvider.id,
          name: fallbackProvider.name,
          apiKey: fallbackProvider.apiKey,
          baseUrl: fallbackProvider.baseUrl,
        }
      : undefined,
    fallbackModelId,
    timestamp: Date.now(),
  });

  return {
    provider,
    modelId,
    fallbackProvider,
    fallbackModelId,
  };
}

/**
 * Clear provider cache for a user (useful after config changes)
 */
export function clearProviderCache(userId: string): void {
  chatProviderCache.delete(userId);
}

/**
 * Clear all provider cache
 */
export function clearAllProviderCache(): void {
  chatProviderCache.clear();
}
