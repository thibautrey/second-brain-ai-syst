import { Alert, AlertDescription } from "../ui/alert";
import { AlertCircle, Loader2, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import React, { useEffect, useState } from "react";

import { Button } from "../ui/button";
import { Select } from "../ui/select";
import { useAISettings } from "../../hooks/useAISettings";
import { useTranslation } from "react-i18next";

interface ModelSelectionStepProps {
  onNext: () => void;
  onSkip: () => void;
  discoveredModels?: Array<{ id: string; name: string }>;
}

export function ModelSelectionStep({
  onNext,
  onSkip,
  discoveredModels = [],
}: ModelSelectionStepProps) {
  const { settings, updateTaskConfigsBatch, isSaving } = useAISettings();
  const { t } = useTranslation();
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Find the provider that was just added (the last one or the one with models)
  const lastProvider = settings.providers[settings.providers.length - 1];
  const availableModels =
    discoveredModels.length > 0 ? discoveredModels : lastProvider?.models || [];

  // Auto-select first model if available
  useEffect(() => {
    if (availableModels.length > 0 && !selectedModel) {
      setSelectedModel(availableModels[0].id);
    }
  }, [availableModels, selectedModel]);

  const handleSelectModel = async () => {
    if (!selectedModel || !lastProvider) {
      return;
    }

    setIsUpdating(true);
    try {
      // Set this model as the LLM for all chat-related tasks
      await updateTaskConfigsBatch([
        {
          taskType: "chat",
          providerId: lastProvider.id,
          modelId: selectedModel,
        },
        {
          taskType: "routing",
          providerId: lastProvider.id,
          modelId: selectedModel,
        },
        {
          taskType: "reflection",
          providerId: lastProvider.id,
          modelId: selectedModel,
        },
        {
          taskType: "summarization",
          providerId: lastProvider.id,
          modelId: selectedModel,
        },
        {
          taskType: "analysis",
          providerId: lastProvider.id,
          modelId: selectedModel,
        },
      ]);
      onNext();
    } catch (error) {
      console.error("Failed to set model:", error);
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
        <Zap className="w-12 h-12 mx-auto mb-4 text-primary" />
        <h2 className="mb-2 text-xl font-semibold">
          {t("onboarding.modelSelectionStep.title")}
        </h2>
        <p className="text-muted-foreground">
          {t("onboarding.modelSelectionStep.subtitle")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("onboarding.modelSelectionStep.providerTitle", {
              provider: lastProvider.name,
            })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block mb-2 text-sm font-medium">
              {t("onboarding.modelSelectionStep.selectModel")}
            </label>
            <Select
              options={availableModels.map((model) => ({
                value: model.id,
                label: model.name || model.id,
              }))}
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              placeholder={t("onboarding.modelSelectionStep.chooseModel")}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              {t("onboarding.modelSelectionStep.modelDescription")}
            </p>
          </div>

          {availableModels.length === 0 && (
            <Alert className="border-amber-500">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                {t("onboarding.modelSelectionStep.noModelsFound")}
              </AlertDescription>
            </Alert>
          )}

          <div className="p-3 border border-blue-200 rounded-lg bg-blue-50">
            <p className="text-sm text-blue-900">
              <span className="font-semibold">
                💡 {t("onboarding.modelSelectionStep.tipTitle")}:
              </span>{" "}
              {t("onboarding.modelSelectionStep.tipDescription")}
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
