/**
 * Types for AI Provider Settings
 */

export type ProviderType = "openai" | "openai-compatible";

export interface AIProvider {
  id: string;
  name: string;
  type: ProviderType;
  apiKey: string;
  baseUrl?: string; // Required for openai-compatible
  models: AIModel[];
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AIModel {
  id: string;
  name: string;
  providerId: string;
  capabilities: ModelCapability[];
}

export type ModelCapability =
  | "speech-to-text"
  | "routing"
  | "reflection"
  | "image-generation"
  | "embeddings"
  | "chat"
  | "summarization"
  | "analysis";

export interface AITaskConfig {
  taskType: ModelCapability;
  providerId: string | null;
  modelId: string | null;
  fallbackProviderId: string | null;
  fallbackModelId: string | null;
}

export interface AISettings {
  providers: AIProvider[];
  taskConfigs: AITaskConfig[];
}

export const DEFAULT_OPENAI_MODELS: Omit<AIModel, "providerId">[] = [
  {
    id: "gpt-4o",
    name: "GPT-4o",
    capabilities: [
      "routing",
      "reflection",
      "chat",
      "summarization",
      "analysis",
    ],
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    capabilities: [
      "routing",
      "reflection",
      "chat",
      "summarization",
      "analysis",
    ],
  },
  {
    id: "gpt-4-turbo",
    name: "GPT-4 Turbo",
    capabilities: [
      "routing",
      "reflection",
      "chat",
      "summarization",
      "analysis",
    ],
  },
  {
    id: "gpt-3.5-turbo",
    name: "GPT-3.5 Turbo",
    capabilities: ["routing", "chat", "summarization"],
  },
  { id: "whisper-1", name: "Whisper", capabilities: ["speech-to-text"] },
  { id: "dall-e-3", name: "DALL-E 3", capabilities: ["image-generation"] },
  { id: "dall-e-2", name: "DALL-E 2", capabilities: ["image-generation"] },
  {
    id: "text-embedding-3-large",
    name: "Text Embedding 3 Large",
    capabilities: ["embeddings"],
  },
  {
    id: "text-embedding-3-small",
    name: "Text Embedding 3 Small",
    capabilities: ["embeddings"],
  },
  {
    id: "text-embedding-ada-002",
    name: "Text Embedding Ada 002",
    capabilities: ["embeddings"],
  },
];

export const TASK_LABELS: Record<
  ModelCapability,
  { label: string; description: string; icon: string }
> = {
  "speech-to-text": {
    label: "Speech to Text",
    description: "Transcription audio vers texte",
    icon: "🎤",
  },
  routing: {
    label: "Modèle de Routage",
    description: "Classification et routage des intentions",
    icon: "🔀",
  },
  reflection: {
    label: "Modèle de Réflexion",
    description: "Raisonnement et génération de réponses",
    icon: "🧠",
  },
  "image-generation": {
    label: "Génération d'Images",
    description: "Création d'images à partir de texte",
    icon: "🎨",
  },
  embeddings: {
    label: "Embeddings",
    description: "Vectorisation pour la recherche sémantique",
    icon: "📊",
  },
  chat: {
    label: "Chat",
    description: "Conversations et réponses générales",
    icon: "💬",
  },
  summarization: {
    label: "Résumés",
    description: "Génération de résumés et synthèses",
    icon: "📝",
  },
  analysis: {
    label: "Analyse",
    description: "Analyse et insight de données",
    icon: "🔬",
  },
};

export const DEFAULT_AI_SETTINGS: AISettings = {
  providers: [],
  taskConfigs: [
    {
      taskType: "speech-to-text",
      providerId: null,
      modelId: null,
      fallbackProviderId: null,
      fallbackModelId: null,
    },
    {
      taskType: "routing",
      providerId: null,
      modelId: null,
      fallbackProviderId: null,
      fallbackModelId: null,
    },
    {
      taskType: "reflection",
      providerId: null,
      modelId: null,
      fallbackProviderId: null,
      fallbackModelId: null,
    },
    {
      taskType: "image-generation",
      providerId: null,
      modelId: null,
      fallbackProviderId: null,
      fallbackModelId: null,
    },
    {
      taskType: "embeddings",
      providerId: null,
      modelId: null,
      fallbackProviderId: null,
      fallbackModelId: null,
    },
    {
      taskType: "chat",
      providerId: null,
      modelId: null,
      fallbackProviderId: null,
      fallbackModelId: null,
    },
    {
      taskType: "summarization",
      providerId: null,
      modelId: null,
      fallbackProviderId: null,
      fallbackModelId: null,
    },
    {
      taskType: "analysis",
      providerId: null,
      modelId: null,
      fallbackProviderId: null,
      fallbackModelId: null,
    },
  ],
};
