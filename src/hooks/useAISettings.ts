import { useState, useEffect, useCallback } from "react";
import {
  AISettings,
  AIProvider,
  AITaskConfig,
  DEFAULT_AI_SETTINGS,
  ModelCapability,
} from "../types/ai-settings";

const API_BASE = `${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api`;

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem("authToken");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export function useAISettings() {
  const [settings, setSettings] = useState<AISettings>(DEFAULT_AI_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load settings from API on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiRequest<AISettings>("/ai-settings");
      setSettings(data);
    } catch (err) {
      console.error("Failed to load AI settings:", err);
      setError(err instanceof Error ? err.message : "Failed to load settings");
      // Fall back to default settings
      setSettings(DEFAULT_AI_SETTINGS);
    } finally {
      setIsLoading(false);
    }
  };

  // Add a new provider
  const addProvider = useCallback(
    async (provider: {
      name: string;
      type: "openai" | "openai-compatible";
      apiKey: string;
      baseUrl?: string;
      isEnabled: boolean;
    }) => {
      setIsSaving(true);
      setError(null);
      try {
        const newProvider = await apiRequest<AIProvider>(
          "/ai-settings/providers",
          {
            method: "POST",
            body: JSON.stringify(provider),
          },
        );

        setSettings((prev) => ({
          ...prev,
          providers: [...prev.providers, newProvider],
        }));

        return newProvider;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to add provider";
        setError(message);
        throw new Error(message);
      } finally {
        setIsSaving(false);
      }
    },
    [],
  );

  // Update a provider
  const updateProvider = useCallback(
    async (
      providerId: string,
      updates: {
        name?: string;
        type?: "openai" | "openai-compatible";
        apiKey?: string;
        baseUrl?: string;
        isEnabled?: boolean;
      },
    ) => {
      setIsSaving(true);
      setError(null);
      try {
        const updatedProvider = await apiRequest<AIProvider>(
          `/ai-settings/providers/${providerId}`,
          {
            method: "PATCH",
            body: JSON.stringify(updates),
          },
        );

        setSettings((prev) => ({
          ...prev,
          providers: prev.providers.map((p) =>
            p.id === providerId ? updatedProvider : p,
          ),
        }));

        return updatedProvider;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to update provider";
        setError(message);
        throw new Error(message);
      } finally {
        setIsSaving(false);
      }
    },
    [],
  );

  // Delete a provider
  const deleteProvider = useCallback(async (providerId: string) => {
    setIsSaving(true);
    setError(null);
    try {
      await apiRequest(`/ai-settings/providers/${providerId}`, {
        method: "DELETE",
      });

      // Also reset task configs that used this provider
      setSettings((prev) => ({
        ...prev,
        providers: prev.providers.filter((p) => p.id !== providerId),
        taskConfigs: prev.taskConfigs.map((tc) =>
          tc.providerId === providerId
            ? { ...tc, providerId: null, modelId: null }
            : tc,
        ),
      }));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete provider";
      setError(message);
      throw new Error(message);
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Update task configuration
  const updateTaskConfig = useCallback(
    async (
      taskType: ModelCapability,
      providerId: string | null,
      modelId: string | null,
    ) => {
      setIsSaving(true);
      setError(null);
      try {
        const updatedConfig = await apiRequest<AITaskConfig>(
          `/ai-settings/task-configs/${taskType}`,
          {
            method: "PATCH",
            body: JSON.stringify({ providerId, modelId }),
          },
        );

        setSettings((prev) => ({
          ...prev,
          taskConfigs: prev.taskConfigs.map((tc) =>
            tc.taskType === taskType ? updatedConfig : tc,
          ),
        }));

        return updatedConfig;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to update task config";
        setError(message);
        throw new Error(message);
      } finally {
        setIsSaving(false);
      }
    },
    [],
  );

  // Add custom model to a provider
  const addModelToProvider = useCallback(
    async (
      providerId: string,
      model: { id: string; name: string; capabilities: ModelCapability[] },
    ) => {
      setIsSaving(true);
      setError(null);
      try {
        const newModel = await apiRequest(
          `/ai-settings/providers/${providerId}/models`,
          {
            method: "POST",
            body: JSON.stringify({
              modelId: model.id,
              name: model.name,
              capabilities: model.capabilities,
            }),
          },
        );

        // Reload settings to get updated provider
        await loadSettings();

        return newModel;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to add model";
        setError(message);
        throw new Error(message);
      } finally {
        setIsSaving(false);
      }
    },
    [],
  );

  // Remove model from a provider
  const removeModelFromProvider = useCallback(
    async (providerId: string, modelId: string) => {
      setIsSaving(true);
      setError(null);
      try {
        await apiRequest(
          `/ai-settings/providers/${providerId}/models/${modelId}`,
          { method: "DELETE" },
        );

        // Reload settings to get updated state
        await loadSettings();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to remove model";
        setError(message);
        throw new Error(message);
      } finally {
        setIsSaving(false);
      }
    },
    [],
  );

  // Sync models from provider API
  const syncProviderModels = useCallback(
    async (
      providerId: string,
    ): Promise<{ added: number; updated: number; total: number }> => {
      setIsSaving(true);
      setError(null);
      try {
        const result = await apiRequest<{
          success: boolean;
          added: number;
          updated: number;
          total: number;
          provider: AIProvider | null;
        }>(`/ai-settings/providers/${providerId}/sync-models`, {
          method: "POST",
        });

        // Update local state with the returned provider
        if (result.provider) {
          setSettings((prev) => ({
            ...prev,
            providers: prev.providers.map((p) =>
              p.id === providerId ? result.provider! : p,
            ),
          }));
        }

        return {
          added: result.added,
          updated: result.updated,
          total: result.total,
        };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to sync models";
        setError(message);
        throw new Error(message);
      } finally {
        setIsSaving(false);
      }
    },
    [],
  );

  // Test API key validity
  const testApiKey = useCallback(
    async (
      apiKey: string,
      baseUrl?: string,
    ): Promise<{ valid: boolean; error?: string }> => {
      try {
        const result = await apiRequest<{ valid: boolean; error?: string }>(
          "/ai-settings/test-api-key",
          {
            method: "POST",
            body: JSON.stringify({ apiKey, baseUrl }),
          },
        );
        return result;
      } catch (err) {
        return {
          valid: false,
          error: err instanceof Error ? err.message : "Test failed",
        };
      }
    },
    [],
  );

  // Get models available for a specific task type
  const getModelsForTask = useCallback(
    (taskType: ModelCapability) => {
      const availableModels: {
        provider: AIProvider;
        model: { id: string; name: string };
      }[] = [];

      for (const provider of settings.providers) {
        if (!provider.isEnabled) continue;

        for (const model of provider.models) {
          if (model.capabilities.includes(taskType)) {
            availableModels.push({ provider, model });
          }
        }
      }

      return availableModels;
    },
    [settings.providers],
  );

  // Get current config for a task
  const getTaskConfig = useCallback(
    (taskType: ModelCapability): AITaskConfig | undefined => {
      return settings.taskConfigs.find((tc) => tc.taskType === taskType);
    },
    [settings.taskConfigs],
  );

  return {
    settings,
    isLoading,
    isSaving,
    error,
    addProvider,
    updateProvider,
    deleteProvider,
    updateTaskConfig,
    addModelToProvider,
    removeModelFromProvider,
    syncProviderModels,
    testApiKey,
    getModelsForTask,
    getTaskConfig,
    refreshSettings: loadSettings,
  };
}
