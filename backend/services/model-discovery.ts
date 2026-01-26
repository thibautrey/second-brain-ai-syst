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
  // ============================================
  // OpenAI - Latest Models (2025)
  // ============================================
  // Reasoning Models
  "gpt-5.2": ["ROUTING", "REFLECTION"],
  "gpt-5.2-pro": ["ROUTING", "REFLECTION"],
  "gpt-5.1": ["ROUTING", "REFLECTION"],
  "gpt-5.1-pro": ["ROUTING", "REFLECTION"],
  "gpt-5": ["ROUTING", "REFLECTION"],
  "gpt-5-pro": ["ROUTING", "REFLECTION"],
  "gpt-5-mini": ["ROUTING"],
  "gpt-5-nano": ["ROUTING"],

  // Chat Models
  "gpt-4.1": ["ROUTING", "REFLECTION"],
  "gpt-4.1-mini": ["ROUTING"],
  "gpt-4o": ["ROUTING", "REFLECTION"],
  "gpt-4o-mini": ["ROUTING"],
  "gpt-4-turbo": ["ROUTING", "REFLECTION"],
  "gpt-4": ["ROUTING", "REFLECTION"],

  // Specialized Models
  "gpt-realtime": ["ROUTING"],
  "gpt-realtime-mini": ["ROUTING"],
  "gpt-audio": ["ROUTING"],
  "gpt-audio-mini": ["ROUTING"],
  "sora-2": ["IMAGE_GENERATION"],
  "sora-2-pro": ["IMAGE_GENERATION"],
  "gpt-image-1.5": ["IMAGE_GENERATION"],
  o3: ["ROUTING", "REFLECTION"],
  "o3-mini": ["ROUTING"],
  "o3-pro": ["ROUTING", "REFLECTION"],
  o1: ["ROUTING", "REFLECTION"],

  // ============================================
  // Mistral AI - Latest Models (2025)
  // ============================================
  "mistral-large-3-25-12": ["ROUTING", "REFLECTION"],
  "mistral-large-3": ["ROUTING", "REFLECTION"],
  "mistral-medium-3.1-25-08": ["ROUTING", "REFLECTION"],
  "mistral-medium-3.1": ["ROUTING", "REFLECTION"],
  "mistral-medium-3-25-05": ["ROUTING", "REFLECTION"],
  "mistral-medium-3": ["ROUTING"],
  "mistral-small-3.2-25-06": ["ROUTING"],
  "mistral-small-3.2": ["ROUTING"],
  "mistral-small-3.1-25-03": ["ROUTING"],
  "ministral-3-14b-25-12": ["ROUTING", "REFLECTION"],
  "ministral-3-14b": ["ROUTING", "REFLECTION"],
  "ministral-3-8b-25-12": ["ROUTING"],
  "ministral-3-8b": ["ROUTING"],
  "ministral-3-3b-25-12": ["ROUTING"],
  "ministral-3-3b": ["ROUTING"],
  "magistral-medium-1.2-25-09": ["ROUTING", "REFLECTION"],
  "magistral-medium-1.2": ["ROUTING", "REFLECTION"],
  "magistral-small-1.2-25-09": ["ROUTING"],
  "magistral-small-1.2": ["ROUTING"],

  // Mistral Specialist Models
  "devstral-2-25-12": ["ROUTING", "REFLECTION"],
  "devstral-2": ["ROUTING", "REFLECTION"],
  "devstral-small-2-25-12": ["ROUTING"],
  "codestral-25-08": ["ROUTING"],
  codestral: ["ROUTING"],
  "voxtral-small-latest": ["SPEECH_TO_TEXT"],
  "voxtral-mini-25-07": ["SPEECH_TO_TEXT"],
  "voxtral-mini": ["SPEECH_TO_TEXT"],

  // ============================================
  // Anthropic Claude - Latest Models (2025)
  // ============================================
  // Claude 4.5 Series (Latest)
  "claude-opus-4.5": ["ROUTING", "REFLECTION"],
  "claude-opus-4.5-20250814": ["ROUTING", "REFLECTION"],
  "claude-sonnet-4.5": ["ROUTING", "REFLECTION"],
  "claude-sonnet-4.5-20250514": ["ROUTING", "REFLECTION"],
  "claude-haiku-4.5": ["ROUTING"],
  "claude-haiku-4.5-20250219": ["ROUTING"],
  // Claude 3.5 Series
  "claude-3-5-sonnet-20241022": ["ROUTING", "REFLECTION"],
  "claude-3-5-sonnet": ["ROUTING", "REFLECTION"],
  "claude-3-opus-20250219": ["ROUTING", "REFLECTION"],
  "claude-3-opus": ["ROUTING", "REFLECTION"],

  // ============================================
  // Google Gemini - Latest Models (2025)
  // ============================================
  "gemini-3-flash": ["ROUTING"],
  "gemini-2.0-flash": ["ROUTING", "REFLECTION"],
  "gemini-2.0-flash-exp": ["ROUTING", "REFLECTION"],
  "gemini-1.5-pro": ["ROUTING", "REFLECTION"],
  "gemini-1.5-pro-latest": ["ROUTING", "REFLECTION"],
  "gemini-1.5-flash": ["ROUTING"],
  "gemini-1.5-flash-latest": ["ROUTING"],
  "gemini-1.0-pro": ["ROUTING"],
  "gemini-pro": ["ROUTING"],

  // ============================================
  // Alibaba Qwen - Latest Models
  // ============================================
  "qwen-max": ["ROUTING", "REFLECTION"],
  "qwen-max-latest": ["ROUTING", "REFLECTION"],
  "qwen-plus": ["ROUTING"],
  "qwen-plus-latest": ["ROUTING"],
  "qwen-turbo": ["ROUTING"],
  "qwen-turbo-latest": ["ROUTING"],

  // ============================================
  // Meta Llama - Latest Models
  // ============================================
  "llama-3.3-70b": ["ROUTING", "REFLECTION"],
  "llama-3.1-405b": ["ROUTING", "REFLECTION"],
  "llama-3.1-70b-instruct": ["ROUTING", "REFLECTION"],
  "llama-3.1-8b-instruct": ["ROUTING"],
  "llama-3-70b-instruct": ["ROUTING", "REFLECTION"],
  "llama-3-8b-instruct": ["ROUTING"],
  "llama-2-70b-chat": ["ROUTING"],
  "llama-2-13b-chat": ["ROUTING"],

  // ============================================
  // Cohere
  // ============================================
  "command-r-plus": ["ROUTING", "REFLECTION"],
  "command-r": ["ROUTING"],
  command: ["ROUTING"],
  "command-light": ["ROUTING"],

  // ============================================
  // Together AI
  // ============================================
  "meta-llama/Llama-3.3-70b-Instruct-Turbo": ["ROUTING", "REFLECTION"],
  "meta-llama/Llama-3.1-405B-Instruct-Turbo": ["ROUTING", "REFLECTION"],
  "meta-llama/Llama-3.1-70b-instruct-turbo": ["ROUTING", "REFLECTION"],
  "meta-llama/Llama-3.1-8b-instruct-turbo": ["ROUTING"],
  "meta-llama/Llama-3-70b-chat-hf": ["ROUTING", "REFLECTION"],
  "meta-llama/Llama-3-8b-chat-hf": ["ROUTING"],
  "mistralai/Mixtral-8x22B-Instruct-v0.1": ["ROUTING", "REFLECTION"],
  "mistralai/Mistral-7B-Instruct-v0.1": ["ROUTING"],

  // ============================================
  // Perplexity
  // ============================================
  "pplx-7b-chat": ["ROUTING"],
  "pplx-70b-chat": ["ROUTING", "REFLECTION"],
  "pplx-7b-online": ["ROUTING"],
  "pplx-70b-online": ["ROUTING", "REFLECTION"],

  // ============================================
  // Open Router / Provider Agnostic
  // ============================================
  "openrouter/auto": ["ROUTING"],

  // ============================================
  // Legacy/Deprecated OpenAI Models
  // ============================================
  "gpt-4-turbo-preview": ["ROUTING", "REFLECTION"],
  "gpt-4-0613": ["ROUTING", "REFLECTION"],
  "gpt-3.5-turbo": ["ROUTING"],
  "gpt-3.5-turbo-0125": ["ROUTING"],
  "gpt-3.5-turbo-1106": ["ROUTING"],
  "gpt-3.5-turbo-16k": ["ROUTING"],

  // OpenAI Specialized
  "whisper-1": ["SPEECH_TO_TEXT"],
  "dall-e-3": ["IMAGE_GENERATION"],
  "dall-e-2": ["IMAGE_GENERATION"],
  "text-embedding-3-large": ["EMBEDDINGS"],
  "text-embedding-3-small": ["EMBEDDINGS"],
  "text-embedding-ada-002": ["EMBEDDINGS"],
};

// Model display names
const MODEL_DISPLAY_NAMES: Record<string, string> = {
  // ============================================
  // OpenAI - Latest (2025)
  // ============================================
  "gpt-5.2": "GPT-5.2",
  "gpt-5.2-pro": "GPT-5.2 Pro",
  "gpt-5.1": "GPT-5.1",
  "gpt-5.1-pro": "GPT-5.1 Pro",
  "gpt-5": "GPT-5",
  "gpt-5-pro": "GPT-5 Pro",
  "gpt-5-mini": "GPT-5 Mini",
  "gpt-5-nano": "GPT-5 Nano",
  "gpt-4.1": "GPT-4.1",
  "gpt-4.1-mini": "GPT-4.1 Mini",
  "gpt-4o": "GPT-4o",
  "gpt-4o-mini": "GPT-4o Mini",
  "gpt-4-turbo": "GPT-4 Turbo",
  "gpt-4": "GPT-4",
  "gpt-realtime": "GPT-4o Realtime",
  "gpt-realtime-mini": "GPT-4o Realtime Mini",
  "gpt-audio": "GPT-4o Audio",
  "gpt-audio-mini": "GPT-4o Audio Mini",
  "sora-2": "Sora 2",
  "sora-2-pro": "Sora 2 Pro",
  "gpt-image-1.5": "GPT Image 1.5",
  o3: "o3",
  "o3-mini": "o3 Mini",
  "o3-pro": "o3 Pro",
  o1: "o1",

  // ============================================
  // Mistral AI (2025)
  // ============================================
  "mistral-large-3-25-12": "Mistral Large 3 (Dec 2025)",
  "mistral-large-3": "Mistral Large 3",
  "mistral-medium-3.1-25-08": "Mistral Medium 3.1 (Aug 2025)",
  "mistral-medium-3.1": "Mistral Medium 3.1",
  "mistral-medium-3-25-05": "Mistral Medium 3 (May 2025)",
  "mistral-medium-3": "Mistral Medium 3",
  "mistral-small-3.2-25-06": "Mistral Small 3.2 (Jun 2025)",
  "mistral-small-3.2": "Mistral Small 3.2",
  "mistral-small-3.1-25-03": "Mistral Small 3.1 (Mar 2025)",
  "ministral-3-14b-25-12": "Ministral 3 14B (Dec 2025)",
  "ministral-3-14b": "Ministral 3 14B",
  "ministral-3-8b-25-12": "Ministral 3 8B (Dec 2025)",
  "ministral-3-8b": "Ministral 3 8B",
  "ministral-3-3b-25-12": "Ministral 3 3B (Dec 2025)",
  "ministral-3-3b": "Ministral 3 3B",
  "magistral-medium-1.2-25-09": "Magistral Medium 1.2 (Sep 2025)",
  "magistral-medium-1.2": "Magistral Medium 1.2",
  "magistral-small-1.2-25-09": "Magistral Small 1.2 (Sep 2025)",
  "magistral-small-1.2": "Magistral Small 1.2",
  "devstral-2-25-12": "Devstral 2 (Dec 2025)",
  "devstral-2": "Devstral 2",
  "devstral-small-2-25-12": "Devstral Small 2 (Dec 2025)",
  "codestral-25-08": "Codestral (Aug 2025)",
  codestral: "Codestral",
  "voxtral-small-latest": "Voxtral Small",
  "voxtral-mini-25-07": "Voxtral Mini (Jul 2025)",
  "voxtral-mini": "Voxtral Mini",

  // ============================================
  // Claude (2025)
  // ============================================
  // Claude 4.5 Series (Latest)
  "claude-opus-4.5": "Claude Opus 4.5",
  "claude-opus-4.5-20250814": "Claude Opus 4.5 (Aug 2025)",
  "claude-sonnet-4.5": "Claude Sonnet 4.5",
  "claude-sonnet-4.5-20250514": "Claude Sonnet 4.5 (May 2025)",
  "claude-haiku-4.5": "Claude Haiku 4.5",
  "claude-haiku-4.5-20250219": "Claude Haiku 4.5 (Feb 2025)",
  // Claude 3.5 Series
  "claude-3-5-sonnet-20241022": "Claude 3.5 Sonnet",
  "claude-3-5-sonnet": "Claude 3.5 Sonnet",
  "claude-3-opus-20250219": "Claude 3 Opus",
  "claude-3-opus": "Claude 3 Opus",

  // ============================================
  // Gemini (2025)
  // ============================================
  "gemini-3-flash": "Gemini 3 Flash",
  "gemini-2.0-flash": "Gemini 2.0 Flash",
  "gemini-2.0-flash-exp": "Gemini 2.0 Flash Exp",
  "gemini-1.5-pro": "Gemini 1.5 Pro",
  "gemini-1.5-pro-latest": "Gemini 1.5 Pro",
  "gemini-1.5-flash": "Gemini 1.5 Flash",
  "gemini-1.5-flash-latest": "Gemini 1.5 Flash",
  "gemini-1.0-pro": "Gemini 1.0 Pro",
  "gemini-pro": "Gemini Pro",

  // ============================================
  // Qwen
  // ============================================
  "qwen-max": "Qwen Max",
  "qwen-max-latest": "Qwen Max",
  "qwen-plus": "Qwen Plus",
  "qwen-plus-latest": "Qwen Plus",
  "qwen-turbo": "Qwen Turbo",
  "qwen-turbo-latest": "Qwen Turbo",

  // ============================================
  // Llama (2025)
  // ============================================
  "llama-3.3-70b": "Llama 3.3 70B",
  "llama-3.1-405b": "Llama 3.1 405B",
  "llama-3.1-70b-instruct": "Llama 3.1 70B Instruct",
  "llama-3.1-8b-instruct": "Llama 3.1 8B Instruct",
  "llama-3-70b-instruct": "Llama 3 70B Instruct",
  "llama-3-8b-instruct": "Llama 3 8B Instruct",
  "llama-2-70b-chat": "Llama 2 70B Chat",
  "llama-2-13b-chat": "Llama 2 13B Chat",

  // ============================================
  // Cohere
  // ============================================
  "command-r-plus": "Command R+",
  "command-r": "Command R",
  command: "Command",
  "command-light": "Command Light",

  // ============================================
  // Together AI
  // ============================================
  "meta-llama/Llama-3.3-70b-Instruct-Turbo": "Llama 3.3 70B Instruct Turbo",
  "meta-llama/Llama-3.1-405B-Instruct-Turbo": "Llama 3.1 405B Instruct Turbo",
  "meta-llama/Llama-3.1-70b-instruct-turbo": "Llama 3.1 70B Instruct Turbo",
  "meta-llama/Llama-3.1-8b-instruct-turbo": "Llama 3.1 8B Instruct Turbo",
  "meta-llama/Llama-3-70b-chat-hf": "Llama 3 70B Chat",
  "meta-llama/Llama-3-8b-chat-hf": "Llama 3 8B Chat",
  "mistralai/Mixtral-8x22B-Instruct-v0.1": "Mixtral 8x22B",
  "mistralai/Mistral-7B-Instruct-v0.1": "Mistral 7B",

  // ============================================
  // Perplexity
  // ============================================
  "pplx-7b-chat": "Perplexity 7B Chat",
  "pplx-70b-chat": "Perplexity 70B Chat",
  "pplx-7b-online": "Perplexity 7B Online",
  "pplx-70b-online": "Perplexity 70B Online",
};

/**
 * Get capabilities for a model from the mapping
 * If no capabilities are detected, returns an empty array.
 * Users can manually associate capabilities in the UI later.
 */
function getModelCapabilities(modelId: string): ModelCapability[] {
  // Ensure modelId is a string (defensive programming)
  if (typeof modelId !== "string") {
    console.warn(
      `[ModelDiscovery] getModelCapabilities received non-string modelId:`,
      modelId,
      `Type: ${typeof modelId}`,
    );
    modelId = String(modelId);
  }

  // Check explicit mapping first
  if (MODEL_CAPABILITIES[modelId]) {
    return MODEL_CAPABILITIES[modelId];
  }

  // Infer capabilities from model ID patterns
  // Chat/Routing models (by provider keywords)
  if (
    modelId.includes("gpt-") ||
    modelId.includes("claude-") ||
    modelId.includes("mistral") ||
    modelId.includes("gemini") ||
    modelId.includes("qwen") ||
    modelId.includes("llama") ||
    modelId.includes("command") ||
    modelId.includes("pplx")
  ) {
    // High capability models (large, opus, pro versions)
    if (
      modelId.includes("405b") ||
      modelId.includes("70b") ||
      modelId.includes("opus") ||
      modelId.includes("large") ||
      modelId.includes("sonnet") ||
      modelId.includes("pro") ||
      modelId.includes("3.3") ||
      modelId.includes("gpt-5") ||
      modelId.includes("5.2") ||
      modelId.includes("5.1") ||
      modelId.includes("o3") ||
      modelId.includes("o4") ||
      modelId.includes("magistral") ||
      modelId.includes("devstral")
    ) {
      return ["ROUTING", "REFLECTION"];
    }
    return ["ROUTING"];
  }

  // Audio models
  if (modelId.includes("whisper") || modelId.includes("voxtral")) {
    return ["SPEECH_TO_TEXT"];
  }

  // Image models
  if (
    modelId.includes("dall-e") ||
    modelId.includes("image") ||
    modelId.includes("sora") ||
    modelId.includes("gpt-image")
  ) {
    return ["IMAGE_GENERATION"];
  }

  // Embedding models
  if (modelId.includes("embedding") || modelId.includes("embed")) {
    return ["EMBEDDINGS"];
  }

  // Unknown model - return empty array
  // User can manually associate capabilities in the UI
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
   *
   * This method will return ALL models from the provider API, even if their
   * capabilities cannot be automatically detected. Users can manually associate
   * capabilities to unrecognized models in the UI.
   */
  async discoverModels(
    apiKey: string,
    baseUrl?: string | null,
  ): Promise<DiscoveredModel[]> {
    try {
      console.log(`[ModelDiscovery] Creating OpenAI client...`);
      console.log(`[ModelDiscovery] Base URL: ${baseUrl || "OpenAI API"}`);
      console.log(`[ModelDiscovery] API Key present: ${apiKey ? "yes" : "no"}`);
      console.log(
        `[ModelDiscovery] API Key length: ${apiKey ? apiKey.length : 0}`,
      );

      const client = new OpenAI({
        apiKey,
        baseURL: baseUrl || undefined,
      });

      console.log(
        `[ModelDiscovery] Fetching models from ${baseUrl || "OpenAI API"}...`,
      );

      const response = await client.models.list();

      console.log(
        `[ModelDiscovery] Raw API response received, data array length: ${response.data?.length || 0}`,
      );

      // Handle different response formats
      let modelsList: any[] = response.data || [];

      // If data is empty but we have body.items (GPUStack format), use that
      if (modelsList.length === 0) {
        const responseWithBody = response as any;
        if (
          responseWithBody.body?.items &&
          Array.isArray(responseWithBody.body.items)
        ) {
          console.log(
            `[ModelDiscovery] Data array empty, falling back to body.items (${responseWithBody.body.items.length} models)`,
          );
          modelsList = responseWithBody.body.items;
        } else {
          console.warn(
            `[ModelDiscovery] WARNING: API returned empty models list`,
          );
          console.log(
            `[ModelDiscovery] Response structure:`,
            JSON.stringify(response, null, 2),
          );
        }
      }

      const models: DiscoveredModel[] = [];
      const recognizedModels: string[] = [];
      const unrecognizedModels: string[] = [];
      const seenModelIds = new Set<string>(); // Track duplicates

      for (const model of modelsList) {
        // Support both OpenAI format (model.id) and GPUStack format (model.name)
        // OpenAI/OpenRouter returns `id` as the actual model identifier (e.g., "gpt-4o", "zhipu/glm-4-flash")
        // GPUStack returns `id` as a numeric database ID and `name` as the actual model identifier
        // Detect numeric IDs and prefer model.name in that case
        let modelId = model.id || model.name;
        
        // If modelId looks like a numeric database ID (e.g., "1", "2", "123"),
        // prefer model.name which should have the actual model identifier
        if (/^\d+$/.test(String(modelId)) && model.name) {
          console.log(
            `[ModelDiscovery] Detected numeric ID "${modelId}", using model.name "${model.name}" instead`,
          );
          modelId = model.name;
        }

        // Ensure modelId is a string
        if (typeof modelId !== "string") {
          console.warn(
            `[ModelDiscovery] Model ID is not a string:`,
            modelId,
            `Type: ${typeof modelId}`,
          );
          modelId = String(modelId);
        }

        if (!modelId) {
          console.warn(
            `[ModelDiscovery] Skipping model with no id or name:`,
            model,
          );
          continue;
        }

        // Skip duplicate model IDs
        if (seenModelIds.has(modelId)) {
          console.log(`[ModelDiscovery] Skipping duplicate model: ${modelId}`);
          continue;
        }
        seenModelIds.add(modelId);

        console.log(`[ModelDiscovery] Processing model: ${modelId}`);
        const capabilities = getModelCapabilities(modelId);

        console.log(
          `[ModelDiscovery]   - Capabilities: ${
            capabilities.length > 0
              ? capabilities.join(", ")
              : "NONE (unrecognized)"
          }`,
        );

        // Include ALL models from the provider
        // Even if we don't recognize the model type, user can manually associate capabilities later
        // Use the API-provided name if available, otherwise generate from modelId
        const displayName = model.name || getModelDisplayName(modelId);
        models.push({
          modelId: modelId,
          name: displayName,
          capabilities,
        });

        if (capabilities.length > 0) {
          recognizedModels.push(modelId);
        } else {
          unrecognizedModels.push(modelId);
        }
      }

      console.log(
        `[ModelDiscovery] Found ${models.length} models (${recognizedModels.length} recognized, ${unrecognizedModels.length} unrecognized)`,
      );

      if (recognizedModels.length > 0) {
        console.log(
          `[ModelDiscovery] Recognized models: ${recognizedModels.join(", ")}`,
        );
      }

      if (unrecognizedModels.length > 0) {
        if (unrecognizedModels.length <= 20) {
          console.log(
            `[ModelDiscovery] Unrecognized models: ${unrecognizedModels.join(", ")}`,
          );
        } else {
          console.log(
            `[ModelDiscovery] Unrecognized models (first 20 of ${unrecognizedModels.length}): ${unrecognizedModels.slice(0, 20).join(", ")}...`,
          );
        }
      }

      return models;
    } catch (error) {
      console.error("[ModelDiscovery] Error fetching models:", error);
      if (error instanceof Error) {
        console.error("[ModelDiscovery] Error message:", error.message);
        console.error("[ModelDiscovery] Error stack:", error.stack);
      }
      throw error;
    }
  }

  /**
   * Discover and sync models for a specific provider
   */
  async syncProviderModels(
    userId: string,
    providerId: string,
  ): Promise<{ added: number; updated: number; removed: number; total: number }> {
    // Get the provider
    console.log(`[ModelDiscovery] Looking up provider: ${providerId}`);

    const provider = await prisma.aIProvider.findFirst({
      where: { id: providerId, userId },
      include: { models: true },
    });

    if (!provider) {
      console.error(
        `[ModelDiscovery] Provider not found: ${providerId} for user: ${userId}`,
      );
      throw new Error("Provider not found");
    }

    console.log(
      `[ModelDiscovery] Found provider: ${provider.name} (type: ${provider.type})`,
    );
    console.log(`[ModelDiscovery] Base URL: ${provider.baseUrl}`);
    console.log(
      `[ModelDiscovery] Existing models in DB: ${provider.models.length}`,
    );

    console.log(
      `[ModelDiscovery] Syncing models for provider: ${provider.name}`,
    );

    // Discover available models
    console.log(
      `[ModelDiscovery] Calling discoverModels with apiKey length: ${provider.apiKey.length}...`,
    );

    const discoveredModels = await this.discoverModels(
      provider.apiKey,
      provider.baseUrl,
    );

    console.log(
      `[ModelDiscovery] Discovery returned ${discoveredModels.length} models`,
    );

    let added = 0;
    let updated = 0;

    // Get existing model IDs for this provider
    const existingModelIds = new Set(provider.models.map((m) => m.modelId));

    console.log(
      `[ModelDiscovery] Existing model IDs: ${Array.from(existingModelIds).join(", ") || "NONE"}`,
    );

    // Upsert each discovered model
    for (const model of discoveredModels) {
      console.log(
        `[ModelDiscovery] Processing discovered model: ${model.modelId}`,
      );

      if (existingModelIds.has(model.modelId)) {
        // Update existing model
        console.log(
          `[ModelDiscovery]   -> Updating existing model: ${model.modelId}`,
        );
        try {
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
        } catch (error) {
          console.error(
            `[ModelDiscovery] Error updating model ${model.modelId}:`,
            error,
          );
          throw error;
        }
      } else {
        // Create new model
        console.log(
          `[ModelDiscovery]   -> Creating new model: ${model.modelId}`,
        );
        try {
          await prisma.aIModel.create({
            data: {
              providerId,
              modelId: model.modelId,
              name: model.name,
              capabilities: model.capabilities,
              isCustom: false,
            },
          });
          existingModelIds.add(model.modelId); // Update the set to track newly added models
          added++;
        } catch (error) {
          // Handle duplicate constraint violations gracefully
          if (
            error instanceof Error &&
            error.message.includes("Unique constraint failed")
          ) {
            console.warn(
              `[ModelDiscovery] Model ${model.modelId} already exists (duplicate), updating instead...`,
            );
            try {
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
            } catch (updateError) {
              console.error(
                `[ModelDiscovery] Error updating duplicate model ${model.modelId}:`,
                updateError,
              );
              throw updateError;
            }
          } else {
            console.error(
              `[ModelDiscovery] Error creating model ${model.modelId}:`,
              error,
            );
            throw error;
          }
        }
      }
    }

    // Remove models that are no longer returned by the API
    // Only remove non-custom models (user-added models should be preserved)
    const discoveredModelIds = new Set(discoveredModels.map((m) => m.modelId));
    const modelsToRemove = provider.models.filter(
      (m) => !m.isCustom && !discoveredModelIds.has(m.modelId)
    );

    let removed = 0;
    if (modelsToRemove.length > 0) {
      console.log(
        `[ModelDiscovery] Removing ${modelsToRemove.length} models no longer available: ${modelsToRemove.map((m) => m.modelId).join(", ")}`,
      );

      for (const model of modelsToRemove) {
        try {
          await prisma.aIModel.delete({
            where: { id: model.id },
          });
          removed++;
          console.log(`[ModelDiscovery]   -> Removed model: ${model.modelId}`);
        } catch (error) {
          // If model is referenced by task configs, just log warning and skip
          if (error instanceof Error && error.message.includes("foreign key constraint")) {
            console.warn(
              `[ModelDiscovery]   -> Cannot remove model ${model.modelId}: still referenced by task configs`,
            );
          } else {
            console.error(
              `[ModelDiscovery] Error removing model ${model.modelId}:`,
              error,
            );
          }
        }
      }
    }

    console.log(
      `[ModelDiscovery] Sync complete: ${added} added, ${updated} updated, ${removed} removed, ${discoveredModels.length} total discovered`,
    );

    return {
      added,
      updated,
      removed,
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
      console.log(`[ModelDiscovery] Testing API key...`);
      console.log(`[ModelDiscovery] Base URL: ${baseUrl || "OpenAI API"}`);
      console.log(`[ModelDiscovery] API Key length: ${apiKey.length}`);

      const client = new OpenAI({
        apiKey,
        baseURL: baseUrl || undefined,
      });

      // Try to list models - this is the lightest API call we can make
      console.log(`[ModelDiscovery] Making API call to list models...`);
      const result = await client.models.list();
      console.log(
        `[ModelDiscovery] API call successful! Got ${result.data?.length || 0} models`,
      );

      return { valid: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`[ModelDiscovery] API key test failed: ${message}`);
      return { valid: false, error: message };
    }
  }
}

export const modelDiscoveryService = new ModelDiscoveryService();
