import { Alert, AlertDescription } from "../ui/alert";
import { AlertCircle, Database, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import React, { useEffect, useState } from "react";

import { Button } from "../ui/button";
import { Select } from "../ui/select";
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
  const [isUpdating, setIsUpdating] = useState(false);

  // Find the provider that was just added (the last one or the one with models)
  const lastProvider = settings.providers[settings.providers.length - 1];
  const availableModels =
    discoveredModels.length > 0 ? discoveredModels : lastProvider?.models || [];

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
      setSelectedModel(smallEmbedding?.id || modelsToShow[0].id);
    }
  }, [modelsToShow, selectedModel]);

  const handleSelectModel = async () => {
    if (!selectedModel || !lastProvider) {
      return;
    }

    setIsUpdating(true);
    try {
      // Set this model as the embedding model
      await updateTaskConfigsBatch([
        {
          taskType: "embeddings",
          providerId: lastProvider.id,
          modelId: selectedModel,
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
            {t("onboarding.embeddingSelectionStep.providerTitle", {
              provider: lastProvider.name,
            })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block mb-2 text-sm font-medium">
              {t("onboarding.embeddingSelectionStep.selectModel")}
            </label>
            <Select
              options={modelsToShow.map((model) => ({
                value: model.id,
                label: model.name || model.id,
              }))}
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              placeholder={t("onboarding.embeddingSelectionStep.chooseModel")}
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
