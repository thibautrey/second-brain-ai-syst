import { useState, useEffect, useCallback } from 'react';
import {
  AISettings,
  AIProvider,
  AITaskConfig,
  DEFAULT_AI_SETTINGS,
  DEFAULT_OPENAI_MODELS,
  ModelCapability,
} from '../types/ai-settings';

const STORAGE_KEY = 'ai-settings';

export function useAISettings() {
  const [settings, setSettings] = useState<AISettings>(DEFAULT_AI_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as AISettings;
        setSettings(parsed);
      }
    } catch (error) {
      console.error('Failed to load AI settings:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save settings to localStorage
  const saveSettings = useCallback(async (newSettings: AISettings) => {
    setIsSaving(true);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error('Failed to save AI settings:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Add a new provider
  const addProvider = useCallback(async (provider: Omit<AIProvider, 'id' | 'createdAt' | 'updatedAt' | 'models'>) => {
    const now = new Date().toISOString();
    const newProvider: AIProvider = {
      ...provider,
      id: `provider-${Date.now()}`,
      createdAt: now,
      updatedAt: now,
      models: provider.type === 'openai' 
        ? DEFAULT_OPENAI_MODELS.map(m => ({ ...m, providerId: `provider-${Date.now()}` }))
        : [],
    };
    
    // Fix the provider ID reference in models
    newProvider.models = newProvider.models.map(m => ({ ...m, providerId: newProvider.id }));
    
    const newSettings = {
      ...settings,
      providers: [...settings.providers, newProvider],
    };
    
    await saveSettings(newSettings);
    return newProvider;
  }, [settings, saveSettings]);

  // Update a provider
  const updateProvider = useCallback(async (providerId: string, updates: Partial<Omit<AIProvider, 'id' | 'createdAt'>>) => {
    const newSettings = {
      ...settings,
      providers: settings.providers.map(p => 
        p.id === providerId 
          ? { ...p, ...updates, updatedAt: new Date().toISOString() }
          : p
      ),
    };
    
    await saveSettings(newSettings);
  }, [settings, saveSettings]);

  // Delete a provider
  const deleteProvider = useCallback(async (providerId: string) => {
    // Also reset any task configs using this provider
    const newTaskConfigs = settings.taskConfigs.map(tc => 
      tc.providerId === providerId 
        ? { ...tc, providerId: null, modelId: null }
        : tc
    );
    
    const newSettings = {
      ...settings,
      providers: settings.providers.filter(p => p.id !== providerId),
      taskConfigs: newTaskConfigs,
    };
    
    await saveSettings(newSettings);
  }, [settings, saveSettings]);

  // Update task configuration
  const updateTaskConfig = useCallback(async (
    taskType: ModelCapability, 
    providerId: string | null, 
    modelId: string | null
  ) => {
    const newSettings = {
      ...settings,
      taskConfigs: settings.taskConfigs.map(tc => 
        tc.taskType === taskType 
          ? { ...tc, providerId, modelId }
          : tc
      ),
    };
    
    await saveSettings(newSettings);
  }, [settings, saveSettings]);

  // Add custom model to a provider
  const addModelToProvider = useCallback(async (
    providerId: string, 
    model: { id: string; name: string; capabilities: ModelCapability[] }
  ) => {
    const newSettings = {
      ...settings,
      providers: settings.providers.map(p => 
        p.id === providerId 
          ? { 
              ...p, 
              models: [...p.models, { ...model, providerId }],
              updatedAt: new Date().toISOString()
            }
          : p
      ),
    };
    
    await saveSettings(newSettings);
  }, [settings, saveSettings]);

  // Remove model from a provider
  const removeModelFromProvider = useCallback(async (providerId: string, modelId: string) => {
    // Also reset any task configs using this model
    const newTaskConfigs = settings.taskConfigs.map(tc => 
      tc.modelId === modelId 
        ? { ...tc, modelId: null }
        : tc
    );
    
    const newSettings = {
      ...settings,
      providers: settings.providers.map(p => 
        p.id === providerId 
          ? { 
              ...p, 
              models: p.models.filter(m => m.id !== modelId),
              updatedAt: new Date().toISOString()
            }
          : p
      ),
      taskConfigs: newTaskConfigs,
    };
    
    await saveSettings(newSettings);
  }, [settings, saveSettings]);

  // Get models available for a specific task type
  const getModelsForTask = useCallback((taskType: ModelCapability) => {
    const availableModels: { provider: AIProvider; model: { id: string; name: string } }[] = [];
    
    for (const provider of settings.providers) {
      if (!provider.isEnabled) continue;
      
      for (const model of provider.models) {
        if (model.capabilities.includes(taskType)) {
          availableModels.push({ provider, model });
        }
      }
    }
    
    return availableModels;
  }, [settings.providers]);

  // Get current config for a task
  const getTaskConfig = useCallback((taskType: ModelCapability): AITaskConfig | undefined => {
    return settings.taskConfigs.find(tc => tc.taskType === taskType);
  }, [settings.taskConfigs]);

  return {
    settings,
    isLoading,
    isSaving,
    addProvider,
    updateProvider,
    deleteProvider,
    updateTaskConfig,
    addModelToProvider,
    removeModelFromProvider,
    getModelsForTask,
    getTaskConfig,
  };
}
