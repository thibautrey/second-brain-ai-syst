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
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Get all enabled providers with their models
  const enabledProviders = settings.providers.filter((p) => p.isEnabled);

  // Find the provider that was just added (the last one or the first one with models)
  const lastProvider = enabledProviders[enabledProviders.length - 1];

  // Collect all models from all providers
  const allModels = enabledProviders.flatMap((provider) =>
    (provider.models || []).map((model) => ({
      ...model,
      providerId: provider.id,
      providerName: provider.name,
    })),
  );

  // If discoveredModels are provided (from API test), use those for the last provider
  const availableModels =
    discoveredModels.length > 0
      ? discoveredModels.map((m) => ({
          ...m,
          providerId: lastProvider?.id,
          providerName: lastProvider?.name,
        }))
      : allModels;

  // Auto-select well-known models if available
  useEffect(() => {
    if (availableModels.length > 0 && !selectedModel) {
      // Prefer well-known models
      const wellKnownModels = [
        "gpt-4-mini", // Codex-mini-latest equivalent
        "claude-3-5-haiku", // Anthropic Haiku
        "claude-3-5-haiku-20241022",
        "gpt-4",
        "gpt-3.5-turbo",
      ];

      const selectedWellKnown = availableModels.find((model) =>
        wellKnownModels.some((known) =>
          model.id.toLowerCase().includes(known.toLowerCase()),
        ),
      );

      if (selectedWellKnown) {
        setSelectedModel(selectedWellKnown.id);
        setSelectedProviderId(
          selectedWellKnown.providerId || lastProvider?.id || "",
        );
      } else if (availableModels[0]) {
        setSelectedModel(availableModels[0].id);
        setSelectedProviderId(
          availableModels[0].providerId || lastProvider?.id || "",
        );
      }
    }
  }, [availableModels, selectedModel, lastProvider]);

  const handleSelectModel = async () => {
    if (!selectedModel || !selectedProviderId) {
      return;
    }

    setIsUpdating(true);
    try {
      // Find the selected provider
      const selectedProvider = enabledProviders.find(
        (p) => p.id === selectedProviderId,
      );
      if (!selectedProvider) {
        throw new Error("Provider not found");
      }

      // Set this model as the LLM for all chat-related tasks
      await updateTaskConfigsBatch([
        {
          taskType: "chat",
          providerId: selectedProviderId,
          modelId: selectedModel,
        },
        {
          taskType: "routing",
          providerId: selectedProviderId,
          modelId: selectedModel,
        },
        {
          taskType: "reflection",
          providerId: selectedProviderId,
          modelId: selectedModel,
        },
        {
          taskType: "summarization",
          providerId: selectedProviderId,
          modelId: selectedModel,
        },
        {
          taskType: "analysis",
          providerId: selectedProviderId,
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
            {t("onboarding.modelSelectionStep.selectModel")}
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
              <Select
                options={enabledProviders.map((provider) => ({
                  value: provider.id,
                  label: `${provider.name} (${(provider.models || []).length} models)`,
                }))}
                value={selectedProviderId}
                onChange={(e) => {
                  setSelectedProviderId(e.target.value);
                  setSelectedModel(""); // Reset model selection when provider changes
                }}
                placeholder="Choose a provider"
              />
            </div>
          )}

          <div>
            <label className="block mb-2 text-sm font-medium">
              {t("onboarding.modelSelectionStep.selectModel")}
            </label>
            <Select
              options={availableModels.map((model) => ({
                value: model.id,
                label: `${model.name || model.id}${
                  enabledProviders.length > 1 && model.providerName
                    ? ` (${model.providerName})`
                    : ""
                }`,
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
