import { Alert, AlertDescription } from "../ui/alert";
import { AlertCircle, Database, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import React, { useEffect, useState } from "react";

import { Button } from "../ui/button";
import { SearchSelect } from "../ui/search-select";
import { useAISettings } from "../../hooks/useAISettings";
import { useTranslation } from "react-i18next";

interface EmbeddingSelectionStepProps {
  onNext: () => void;
  onSkip: () => void;
  discoveredModels?: Array<{ id: string; name: string }>;
}

export function EmbeddingSelectionStep({
  onNext,
  onSkip,
  discoveredModels = [],
}: EmbeddingSelectionStepProps) {
  const { settings, updateTaskConfigsBatch, isSaving } = useAISettings();
  const { t } = useTranslation();
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Create a unique composite key for each model (provider_id + model_id)
  const createModelKey = (providerId: string | undefined, modelId: string) =>
    providerId ? `${providerId}:${modelId}` : modelId;

  const parseModelKey = (key: string) => {
    const parts = key.split(":");
    if (parts.length === 2) {
      return { providerId: parts[0], modelId: parts[1] };
    }
    return { providerId: "", modelId: key };
  };

  // Get all enabled providers with their models
  const enabledProviders = settings.providers.filter((p) => p.isEnabled);

  // Find the provider that was just added (the last one or the one with models)
  const lastProvider = enabledProviders[enabledProviders.length - 1];

  // Collect all models from all providers
  const allModels = enabledProviders.flatMap((provider) =>
    (provider.models || []).map((model) => ({
      ...model,
      providerId: provider.id,
      providerName: provider.name,
    })),
  );

  // Always use allModels from database, not discoveredModels from API test preview
  // discoveredModels is only used in AIConfigStep for preview before provider creation
  const availableModels = allModels;

  // Filter models that are likely embeddings (contain 'embedding' in name or are certain known models)
  const embeddingModels = availableModels.filter((model) => {
    const id = model.id.toLowerCase();
    return (
      id.includes("embedding") ||
      id.includes("embed") ||
      id === "text-embedding-3-small" ||
      id === "text-embedding-3-large" ||
      id === "text-embedding-ada-002"
    );
  });

  // If no embedding models found, show all models
  const modelsToShow =
    embeddingModels.length > 0 ? embeddingModels : availableModels;

  // Auto-select first embedding model if available
  useEffect(() => {
    if (modelsToShow.length > 0 && !selectedModel) {
      // Prefer text-embedding-3-small as default
      const smallEmbedding = modelsToShow.find(
        (m) =>
          m.id === "text-embedding-3-small" ||
          m.id.includes("small") ||
          m.id.includes("ada"),
      );
      const selected = smallEmbedding || modelsToShow[0];
      const providerId = selected.providerId || lastProvider?.id || "";
      setSelectedModel(createModelKey(providerId, selected.id));
      setSelectedProviderId(providerId);
    }
  }, [modelsToShow, selectedModel, lastProvider]);

  const handleSelectModel = async () => {
    if (!selectedModel || !selectedProviderId) {
      return;
    }

    setIsUpdating(true);
    try {
      // Parse the composite key to get modelId
      const { modelId } = parseModelKey(selectedModel);

      // Set this model as the embedding model
      await updateTaskConfigsBatch([
        {
          taskType: "embeddings",
          providerId: selectedProviderId,
          modelId: modelId,
        },
      ]);
      onNext();
    } catch (error) {
      console.error("Failed to set embedding model:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  if (!lastProvider) {
    return (
      <div className="space-y-6">
        <Alert className="border-amber-500">
          <AlertCircle className="w-4 h-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            No provider found. Please go back and configure a provider first.
          </AlertDescription>
        </Alert>
        <div className="text-center">
          <Button onClick={onSkip} variant="outline">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <Database className="w-12 h-12 mx-auto mb-4 text-primary" />
        <h2 className="mb-2 text-xl font-semibold">
          {t("onboarding.embeddingSelectionStep.title")}
        </h2>
        <p className="text-muted-foreground">
          {t("onboarding.embeddingSelectionStep.subtitle")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("onboarding.embeddingSelectionStep.selectModel")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Provider selector if multiple providers */}
          {enabledProviders.length > 1 && (
            <div>
              <label className="block mb-2 text-sm font-medium">
                {t("onboarding.modelSelectionStep.selectProvider") ||
                  "Select Provider"}
              </label>
              <SearchSelect
                options={enabledProviders.map((provider) => ({
                  value: provider.id,
                  label: `${provider.name} (${(provider.models || []).length} models)`,
                }))}
                value={selectedProviderId}
                onChange={(value) => {
                  setSelectedProviderId(value);
                  setSelectedModel(""); // Reset model selection when provider changes
                }}
                placeholder="Search or select a provider..."
              />
            </div>
          )}

          <div>
            <label className="block mb-2 text-sm font-medium">
              {t("onboarding.embeddingSelectionStep.selectModel")}
            </label>
            <SearchSelect
              options={modelsToShow
                .filter((model) =>
                  enabledProviders.length > 1
                    ? model.providerId === selectedProviderId
                    : true,
                )
                .map((model) => ({
                  value: createModelKey(model.providerId, model.id),
                  label: `${model.name || model.id}${
                    enabledProviders.length > 1 && model.providerName
                      ? ` (${model.providerName})`
                      : ""
                  }`,
                }))}
              value={selectedModel}
              onChange={(value) => {
                const parsed = parseModelKey(value);
                setSelectedModel(value);
                setSelectedProviderId(parsed.providerId);
              }}
              placeholder={t("onboarding.embeddingSelectionStep.chooseModel")}
              maxHeight="400px"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              {t("onboarding.embeddingSelectionStep.modelDescription")}
            </p>
          </div>

          {modelsToShow.length === 0 && (
            <Alert className="border-amber-500">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                {t("onboarding.embeddingSelectionStep.noModelsFound")}
              </AlertDescription>
            </Alert>
          )}

          <div className="p-3 space-y-2 border border-blue-200 rounded-lg bg-blue-50">
            <p className="text-sm text-blue-900">
              <span className="font-semibold">
                💡 {t("onboarding.embeddingSelectionStep.tipTitle")}:
              </span>{" "}
              {t("onboarding.embeddingSelectionStep.tipDescription")}
            </p>
            <p className="text-xs text-blue-800">
              {t("onboarding.embeddingSelectionStep.tipSecondary")}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex items-center justify-center space-x-4">
        <Button
          variant="outline"
          onClick={onSkip}
          disabled={isUpdating || isSaving}
        >
          {t("onboarding.buttons.skip")}
        </Button>
        <Button
          onClick={handleSelectModel}
          disabled={!selectedModel || isUpdating || isSaving}
        >
          {isUpdating || isSaving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : null}
          {t("onboarding.buttons.continue")}
        </Button>
      </div>
    </div>
  );
}
