import prisma from "../services/prisma.js";
import { ProviderType, ModelCapability, Prisma } from "@prisma/client";

// ==================== Types ====================

export interface CreateProviderInput {
  name: string;
  type: "openai" | "openai-compatible";
  apiKey: string;
  baseUrl?: string;
  isEnabled?: boolean;
}

export interface UpdateProviderInput {
  name?: string;
  type?: "openai" | "openai-compatible";
  apiKey?: string;
  baseUrl?: string;
  isEnabled?: boolean;
}

export interface AddModelInput {
  modelId: string;
  name: string;
  capabilities: ModelCapability[];
}

export interface UpdateTaskConfigInput {
  providerId: string | null;
  modelId: string | null;
}

// Default OpenAI models with their capabilities
const DEFAULT_OPENAI_MODELS: {
  modelId: string;
  name: string;
  capabilities: ModelCapability[];
}[] = [
  {
    modelId: "gpt-4o",
    name: "GPT-4o",
    capabilities: ["ROUTING", "REFLECTION"],
  },
  {
    modelId: "gpt-4o-mini",
    name: "GPT-4o Mini",
    capabilities: ["ROUTING", "REFLECTION"],
  },
  {
    modelId: "gpt-4-turbo",
    name: "GPT-4 Turbo",
    capabilities: ["ROUTING", "REFLECTION"],
  },
  {
    modelId: "gpt-3.5-turbo",
    name: "GPT-3.5 Turbo",
    capabilities: ["ROUTING"],
  },
  { modelId: "whisper-1", name: "Whisper", capabilities: ["SPEECH_TO_TEXT"] },
  { modelId: "dall-e-3", name: "DALL-E 3", capabilities: ["IMAGE_GENERATION"] },
  { modelId: "dall-e-2", name: "DALL-E 2", capabilities: ["IMAGE_GENERATION"] },
  {
    modelId: "text-embedding-3-large",
    name: "Text Embedding 3 Large",
    capabilities: ["EMBEDDINGS"],
  },
  {
    modelId: "text-embedding-3-small",
    name: "Text Embedding 3 Small",
    capabilities: ["EMBEDDINGS"],
  },
  {
    modelId: "text-embedding-ada-002",
    name: "Text Embedding Ada 002",
    capabilities: ["EMBEDDINGS"],
  },
];

// Map frontend type to Prisma enum
function mapProviderType(type: "openai" | "openai-compatible"): ProviderType {
  return type === "openai" ? "OPENAI" : "OPENAI_COMPATIBLE";
}

// Map Prisma enum to frontend type
function mapProviderTypeToFrontend(
  type: ProviderType,
): "openai" | "openai-compatible" {
  return type === "OPENAI" ? "openai" : "openai-compatible";
}

// Map frontend capability to Prisma enum
function mapCapability(cap: string): ModelCapability {
  const mapping: Record<string, ModelCapability> = {
    "speech-to-text": "SPEECH_TO_TEXT",
    routing: "ROUTING",
    reflection: "REFLECTION",
    "image-generation": "IMAGE_GENERATION",
    embeddings: "EMBEDDINGS",
  };
  return mapping[cap] || (cap as ModelCapability);
}

// Map Prisma enum to frontend capability
function mapCapabilityToFrontend(cap: ModelCapability): string {
  const mapping: Record<ModelCapability, string> = {
    SPEECH_TO_TEXT: "speech-to-text",
    ROUTING: "routing",
    REFLECTION: "reflection",
    IMAGE_GENERATION: "image-generation",
    EMBEDDINGS: "embeddings",
  };
  return mapping[cap];
}

// ==================== Provider Operations ====================

/**
 * Get all AI providers for a user
 */
export async function getProviders(userId: string) {
  const providers = await prisma.aIProvider.findMany({
    where: { userId },
    include: {
      models: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return providers.map((p) => ({
    id: p.id,
    name: p.name,
    type: mapProviderTypeToFrontend(p.type),
    apiKey: maskApiKey(p.apiKey),
    baseUrl: p.baseUrl,
    isEnabled: p.isEnabled,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    models: p.models.map((m) => ({
      id: m.modelId,
      name: m.name,
      providerId: m.providerId,
      capabilities: m.capabilities.map(mapCapabilityToFrontend),
      isCustom: m.isCustom,
    })),
  }));
}

/**
 * Get a single provider by ID
 */
export async function getProviderById(userId: string, providerId: string) {
  const provider = await prisma.aIProvider.findFirst({
    where: { id: providerId, userId },
    include: { models: true },
  });

  if (!provider) {
    throw new Error("Provider not found");
  }

  return {
    id: provider.id,
    name: provider.name,
    type: mapProviderTypeToFrontend(provider.type),
    apiKey: maskApiKey(provider.apiKey),
    baseUrl: provider.baseUrl,
    isEnabled: provider.isEnabled,
    createdAt: provider.createdAt.toISOString(),
    updatedAt: provider.updatedAt.toISOString(),
    models: provider.models.map((m) => ({
      id: m.modelId,
      name: m.name,
      providerId: m.providerId,
      capabilities: m.capabilities.map(mapCapabilityToFrontend),
      isCustom: m.isCustom,
    })),
  };
}

/**
 * Create a new AI provider
 */
export async function createProvider(
  userId: string,
  input: CreateProviderInput,
) {
  // Validate input
  if (!input.name?.trim()) {
    throw new Error("Provider name is required");
  }
  if (!input.apiKey?.trim()) {
    throw new Error("API key is required");
  }
  if (input.type === "openai-compatible" && !input.baseUrl?.trim()) {
    throw new Error("Base URL is required for OpenAI-compatible providers");
  }

  // Check for duplicate name
  const existing = await prisma.aIProvider.findFirst({
    where: { userId, name: input.name },
  });
  if (existing) {
    throw new Error("A provider with this name already exists");
  }

  // Create provider with default models for OpenAI type
  const provider = await prisma.aIProvider.create({
    data: {
      userId,
      name: input.name.trim(),
      type: mapProviderType(input.type),
      apiKey: input.apiKey, // TODO: Encrypt in production
      baseUrl: input.baseUrl?.trim() || null,
      isEnabled: input.isEnabled ?? true,
      models:
        input.type === "openai"
          ? {
              create: DEFAULT_OPENAI_MODELS.map((m) => ({
                modelId: m.modelId,
                name: m.name,
                capabilities: m.capabilities,
                isCustom: false,
              })),
            }
          : undefined,
    },
    include: { models: true },
  });

  return {
    id: provider.id,
    name: provider.name,
    type: mapProviderTypeToFrontend(provider.type),
    apiKey: maskApiKey(provider.apiKey),
    baseUrl: provider.baseUrl,
    isEnabled: provider.isEnabled,
    createdAt: provider.createdAt.toISOString(),
    updatedAt: provider.updatedAt.toISOString(),
    models: provider.models.map((m) => ({
      id: m.modelId,
      name: m.name,
      providerId: m.providerId,
      capabilities: m.capabilities.map(mapCapabilityToFrontend),
      isCustom: m.isCustom,
    })),
  };
}

/**
 * Update an AI provider
 */
export async function updateProvider(
  userId: string,
  providerId: string,
  input: UpdateProviderInput,
) {
  // Verify ownership
  const existing = await prisma.aIProvider.findFirst({
    where: { id: providerId, userId },
  });
  if (!existing) {
    throw new Error("Provider not found");
  }

  // Check for duplicate name if name is being changed
  if (input.name && input.name !== existing.name) {
    const duplicate = await prisma.aIProvider.findFirst({
      where: { userId, name: input.name, id: { not: providerId } },
    });
    if (duplicate) {
      throw new Error("A provider with this name already exists");
    }
  }

  // Validate base URL for OpenAI-compatible type
  const newType = input.type ? mapProviderType(input.type) : existing.type;
  const newBaseUrl =
    input.baseUrl !== undefined ? input.baseUrl : existing.baseUrl;
  if (newType === "OPENAI_COMPATIBLE" && !newBaseUrl?.trim()) {
    throw new Error("Base URL is required for OpenAI-compatible providers");
  }

  const provider = await prisma.aIProvider.update({
    where: { id: providerId },
    data: {
      name: input.name?.trim(),
      type: input.type ? mapProviderType(input.type) : undefined,
      apiKey: input.apiKey || undefined,
      baseUrl:
        input.baseUrl !== undefined ? input.baseUrl?.trim() || null : undefined,
      isEnabled: input.isEnabled,
    },
    include: { models: true },
  });

  return {
    id: provider.id,
    name: provider.name,
    type: mapProviderTypeToFrontend(provider.type),
    apiKey: maskApiKey(provider.apiKey),
    baseUrl: provider.baseUrl,
    isEnabled: provider.isEnabled,
    createdAt: provider.createdAt.toISOString(),
    updatedAt: provider.updatedAt.toISOString(),
    models: provider.models.map((m) => ({
      id: m.modelId,
      name: m.name,
      providerId: m.providerId,
      capabilities: m.capabilities.map(mapCapabilityToFrontend),
      isCustom: m.isCustom,
    })),
  };
}

/**
 * Delete an AI provider
 */
export async function deleteProvider(userId: string, providerId: string) {
  // Verify ownership
  const existing = await prisma.aIProvider.findFirst({
    where: { id: providerId, userId },
  });
  if (!existing) {
    throw new Error("Provider not found");
  }

  // Delete provider (cascades to models and resets task configs)
  await prisma.aIProvider.delete({
    where: { id: providerId },
  });

  return { success: true };
}

// ==================== Model Operations ====================

/**
 * Add a custom model to a provider
 */
export async function addModelToProvider(
  userId: string,
  providerId: string,
  input: AddModelInput,
) {
  // Verify ownership
  const provider = await prisma.aIProvider.findFirst({
    where: { id: providerId, userId },
  });
  if (!provider) {
    throw new Error("Provider not found");
  }

  // Check for duplicate model ID
  const existing = await prisma.aIModel.findFirst({
    where: { providerId, modelId: input.modelId },
  });
  if (existing) {
    throw new Error("A model with this ID already exists for this provider");
  }

  const model = await prisma.aIModel.create({
    data: {
      providerId,
      modelId: input.modelId,
      name: input.name,
      capabilities: input.capabilities,
      isCustom: true,
    },
  });

  return {
    id: model.modelId,
    name: model.name,
    providerId: model.providerId,
    capabilities: model.capabilities.map(mapCapabilityToFrontend),
    isCustom: model.isCustom,
  };
}

/**
 * Remove a model from a provider
 */
export async function removeModelFromProvider(
  userId: string,
  providerId: string,
  modelId: string,
) {
  // Verify ownership
  const provider = await prisma.aIProvider.findFirst({
    where: { id: providerId, userId },
  });
  if (!provider) {
    throw new Error("Provider not found");
  }

  // Find and delete the model
  const model = await prisma.aIModel.findFirst({
    where: { providerId, modelId },
  });
  if (!model) {
    throw new Error("Model not found");
  }

  await prisma.aIModel.delete({
    where: { id: model.id },
  });

  return { success: true };
}

// ==================== Task Config Operations ====================

/**
 * Get all task configurations for a user
 */
export async function getTaskConfigs(userId: string) {
  // Ensure all task types have a config entry
  const allTaskTypes: ModelCapability[] = [
    "SPEECH_TO_TEXT",
    "ROUTING",
    "REFLECTION",
    "IMAGE_GENERATION",
    "EMBEDDINGS",
  ];

  const configs = await prisma.aITaskConfig.findMany({
    where: { userId },
    include: {
      provider: { select: { id: true, name: true } },
      model: { select: { modelId: true, name: true } },
    },
  });

  // Create missing configs
  const existingTypes = configs.map((c) => c.taskType);
  const missingTypes = allTaskTypes.filter((t) => !existingTypes.includes(t));

  if (missingTypes.length > 0) {
    await prisma.aITaskConfig.createMany({
      data: missingTypes.map((taskType) => ({
        userId,
        taskType,
      })),
    });

    // Refetch all configs
    const updatedConfigs = await prisma.aITaskConfig.findMany({
      where: { userId },
      include: {
        provider: { select: { id: true, name: true } },
        model: { select: { modelId: true, name: true } },
      },
    });

    return updatedConfigs.map((c) => ({
      taskType: mapCapabilityToFrontend(c.taskType),
      providerId: c.providerId,
      providerName: c.provider?.name || null,
      modelId: c.model?.modelId || null,
      modelName: c.model?.name || null,
    }));
  }

  return configs.map((c) => ({
    taskType: mapCapabilityToFrontend(c.taskType),
    providerId: c.providerId,
    providerName: c.provider?.name || null,
    modelId: c.model?.modelId || null,
    modelName: c.model?.name || null,
  }));
}

/**
 * Update a task configuration
 */
export async function updateTaskConfig(
  userId: string,
  taskType: string,
  input: UpdateTaskConfigInput,
) {
  const prismaTaskType = mapCapability(taskType);

  // Validate provider and model if provided
  if (input.providerId) {
    const provider = await prisma.aIProvider.findFirst({
      where: { id: input.providerId, userId },
    });
    if (!provider) {
      throw new Error("Provider not found");
    }

    if (input.modelId) {
      const model = await prisma.aIModel.findFirst({
        where: { providerId: input.providerId, modelId: input.modelId },
      });
      if (!model) {
        throw new Error("Model not found for this provider");
      }
      // Verify model has the required capability
      if (!model.capabilities.includes(prismaTaskType)) {
        throw new Error("Selected model does not support this task type");
      }
    }
  }

  // Upsert the task config
  const config = await prisma.aITaskConfig.upsert({
    where: {
      userId_taskType: { userId, taskType: prismaTaskType },
    },
    update: {
      providerId: input.providerId,
      modelId: input.modelId
        ? await getModelDbId(input.providerId!, input.modelId)
        : null,
    },
    create: {
      userId,
      taskType: prismaTaskType,
      providerId: input.providerId,
      modelId: input.modelId
        ? await getModelDbId(input.providerId!, input.modelId)
        : null,
    },
    include: {
      provider: { select: { id: true, name: true } },
      model: { select: { modelId: true, name: true } },
    },
  });

  return {
    taskType: mapCapabilityToFrontend(config.taskType),
    providerId: config.providerId,
    providerName: config.provider?.name || null,
    modelId: config.model?.modelId || null,
    modelName: config.model?.name || null,
  };
}

/**
 * Get full AI settings (providers + task configs)
 */
export async function getAISettings(userId: string) {
  const [providers, taskConfigs] = await Promise.all([
    getProviders(userId),
    getTaskConfigs(userId),
  ]);

  return { providers, taskConfigs };
}

// ==================== Helper Functions ====================

/**
 * Get the database ID of a model from its modelId
 */
async function getModelDbId(
  providerId: string,
  modelId: string,
): Promise<string | null> {
  const model = await prisma.aIModel.findFirst({
    where: { providerId, modelId },
    select: { id: true },
  });
  return model?.id || null;
}

/**
 * Mask API key for display (show first 4 and last 4 chars)
 */
function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 12) {
    return "****";
  }
  return `${apiKey.slice(0, 4)}${"*".repeat(Math.min(apiKey.length - 8, 20))}${apiKey.slice(-4)}`;
}

/**
 * Get the full (unmasked) API key for a provider
 * Used internally when making API calls
 */
export async function getProviderApiKey(
  userId: string,
  providerId: string,
): Promise<string | null> {
  const provider = await prisma.aIProvider.findFirst({
    where: { id: providerId, userId, isEnabled: true },
    select: { apiKey: true },
  });
  return provider?.apiKey || null;
}

/**
 * Get the configured provider and model for a specific task
 * Returns null if not configured
 */
export async function getConfiguredModelForTask(
  userId: string,
  taskType: string,
) {
  const prismaTaskType = mapCapability(taskType);

  const config = await prisma.aITaskConfig.findUnique({
    where: {
      userId_taskType: { userId, taskType: prismaTaskType },
    },
    include: {
      provider: true,
      model: true,
    },
  });

  if (!config?.provider || !config?.model) {
    return null;
  }

  return {
    provider: {
      id: config.provider.id,
      name: config.provider.name,
      type: mapProviderTypeToFrontend(config.provider.type),
      apiKey: config.provider.apiKey, // Full key for internal use
      baseUrl: config.provider.baseUrl,
    },
    model: {
      id: config.model.modelId,
      name: config.model.name,
    },
  };
}
