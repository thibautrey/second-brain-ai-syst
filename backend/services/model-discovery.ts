/**
 * Model Discovery Service
 * Fetches available models from AI providers via their APIs
 */

import OpenAI from "openai";
import prisma from "./prisma.js";
import { ModelCapability } from "@prisma/client";

export interface DiscoveredModel {
  modelId: string;
  name: string;
  capabilities: ModelCapability[];
}

// Known model capabilities mapping
// This maps model IDs to their supported capabilities
const MODEL_CAPABILITIES: Record<string, ModelCapability[]> = {
  // OpenAI Chat Models
  "gpt-4o": ["ROUTING", "REFLECTION"],
  "gpt-4o-mini": ["ROUTING", "REFLECTION"],
  "gpt-4-turbo": ["ROUTING", "REFLECTION"],
  "gpt-4-turbo-preview": ["ROUTING", "REFLECTION"],
  "gpt-4": ["ROUTING", "REFLECTION"],
  "gpt-4-0613": ["ROUTING", "REFLECTION"],
  "gpt-3.5-turbo": ["ROUTING"],
  "gpt-3.5-turbo-0125": ["ROUTING"],
  "gpt-3.5-turbo-1106": ["ROUTING"],
  "gpt-3.5-turbo-16k": ["ROUTING"],
  // OpenAI Audio Models
  "whisper-1": ["SPEECH_TO_TEXT"],
  // OpenAI Image Models
  "dall-e-3": ["IMAGE_GENERATION"],
  "dall-e-2": ["IMAGE_GENERATION"],
  // OpenAI Embedding Models
  "text-embedding-3-large": ["EMBEDDINGS"],
  "text-embedding-3-small": ["EMBEDDINGS"],
  "text-embedding-ada-002": ["EMBEDDINGS"],
};

// Model display names
const MODEL_DISPLAY_NAMES: Record<string, string> = {
  "gpt-4o": "GPT-4o",
  "gpt-4o-mini": "GPT-4o Mini",
  "gpt-4-turbo": "GPT-4 Turbo",
  "gpt-4-turbo-preview": "GPT-4 Turbo Preview",
  "gpt-4": "GPT-4",
  "gpt-4-0613": "GPT-4 (0613)",
  "gpt-3.5-turbo": "GPT-3.5 Turbo",
  "gpt-3.5-turbo-0125": "GPT-3.5 Turbo (0125)",
  "gpt-3.5-turbo-1106": "GPT-3.5 Turbo (1106)",
  "gpt-3.5-turbo-16k": "GPT-3.5 Turbo 16K",
  "whisper-1": "Whisper",
  "dall-e-3": "DALL-E 3",
  "dall-e-2": "DALL-E 2",
  "text-embedding-3-large": "Text Embedding 3 Large",
  "text-embedding-3-small": "Text Embedding 3 Small",
  "text-embedding-ada-002": "Text Embedding Ada 002",
};

// Models that we want to include (filter out deprecated/internal models)
const SUPPORTED_MODEL_PREFIXES = [
  "gpt-4o",
  "gpt-4-turbo",
  "gpt-4",
  "gpt-3.5-turbo",
  "whisper",
  "dall-e",
  "text-embedding",
];

/**
 * Check if a model ID should be included in the discovered models
 */
function shouldIncludeModel(modelId: string): boolean {
  // Exclude snapshot models (ending with date patterns)
  if (/\d{4}$/.test(modelId) && !MODEL_CAPABILITIES[modelId]) {
    return false;
  }

  // Exclude instruct/vision variants unless explicitly supported
  if (
    (modelId.includes("instruct") || modelId.includes("vision")) &&
    !MODEL_CAPABILITIES[modelId]
  ) {
    return false;
  }

  // Include if it matches known prefixes
  return SUPPORTED_MODEL_PREFIXES.some((prefix) => modelId.startsWith(prefix));
}

/**
 * Get capabilities for a model, inferring from model ID if not explicitly defined
 */
function getModelCapabilities(modelId: string): ModelCapability[] {
  // Check explicit mapping first
  if (MODEL_CAPABILITIES[modelId]) {
    return MODEL_CAPABILITIES[modelId];
  }

  // Infer capabilities from model ID patterns
  if (modelId.startsWith("gpt-4")) {
    return ["ROUTING", "REFLECTION"];
  }
  if (modelId.startsWith("gpt-3.5")) {
    return ["ROUTING"];
  }
  if (modelId.startsWith("whisper")) {
    return ["SPEECH_TO_TEXT"];
  }
  if (modelId.startsWith("dall-e")) {
    return ["IMAGE_GENERATION"];
  }
  if (modelId.includes("embedding")) {
    return ["EMBEDDINGS"];
  }

  return [];
}

/**
 * Get display name for a model
 */
function getModelDisplayName(modelId: string): string {
  if (MODEL_DISPLAY_NAMES[modelId]) {
    return MODEL_DISPLAY_NAMES[modelId];
  }

  // Generate a reasonable display name
  return modelId
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/Gpt/g, "GPT")
    .replace(/Dall E/g, "DALL-E");
}

export class ModelDiscoveryService {
  /**
   * Discover models available for an OpenAI-compatible provider
   */
  async discoverModels(
    apiKey: string,
    baseUrl?: string | null,
  ): Promise<DiscoveredModel[]> {
    try {
      const client = new OpenAI({
        apiKey,
        baseURL: baseUrl || undefined,
      });

      console.log(
        `[ModelDiscovery] Fetching models from ${baseUrl || "OpenAI API"}...`,
      );

      const response = await client.models.list();
      const models: DiscoveredModel[] = [];

      for (const model of response.data) {
        // Filter to only supported models
        if (!shouldIncludeModel(model.id)) {
          continue;
        }

        const capabilities = getModelCapabilities(model.id);

        // Only include models that have at least one capability
        if (capabilities.length > 0) {
          models.push({
            modelId: model.id,
            name: getModelDisplayName(model.id),
            capabilities,
          });
        }
      }

      console.log(`[ModelDiscovery] Found ${models.length} compatible models`);
      return models;
    } catch (error) {
      console.error("[ModelDiscovery] Error fetching models:", error);
      throw error;
    }
  }

  /**
   * Discover and sync models for a specific provider
   */
  async syncProviderModels(
    userId: string,
    providerId: string,
  ): Promise<{ added: number; updated: number; total: number }> {
    // Get the provider
    const provider = await prisma.aIProvider.findFirst({
      where: { id: providerId, userId },
      include: { models: true },
    });

    if (!provider) {
      throw new Error("Provider not found");
    }

    console.log(
      `[ModelDiscovery] Syncing models for provider: ${provider.name}`,
    );

    // Discover available models
    const discoveredModels = await this.discoverModels(
      provider.apiKey,
      provider.baseUrl,
    );

    let added = 0;
    let updated = 0;

    // Get existing model IDs for this provider
    const existingModelIds = new Set(provider.models.map((m) => m.modelId));

    // Upsert each discovered model
    for (const model of discoveredModels) {
      if (existingModelIds.has(model.modelId)) {
        // Update existing model
        await prisma.aIModel.updateMany({
          where: {
            providerId,
            modelId: model.modelId,
          },
          data: {
            name: model.name,
            capabilities: model.capabilities,
          },
        });
        updated++;
      } else {
        // Create new model
        await prisma.aIModel.create({
          data: {
            providerId,
            modelId: model.modelId,
            name: model.name,
            capabilities: model.capabilities,
            isCustom: false,
          },
        });
        added++;
      }
    }

    console.log(
      `[ModelDiscovery] Sync complete: ${added} added, ${updated} updated`,
    );

    return {
      added,
      updated,
      total: discoveredModels.length,
    };
  }

  /**
   * Test if an API key is valid by making a minimal API call
   */
  async testApiKey(
    apiKey: string,
    baseUrl?: string | null,
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      const client = new OpenAI({
        apiKey,
        baseURL: baseUrl || undefined,
      });

      // Try to list models - this is the lightest API call we can make
      await client.models.list();

      return { valid: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return { valid: false, error: message };
    }
  }
}

export const modelDiscoveryService = new ModelDiscoveryService();
