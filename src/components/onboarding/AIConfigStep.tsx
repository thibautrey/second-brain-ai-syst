import { Alert, AlertDescription } from "../ui/alert";
import {
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Loader2,
  Plus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import React, { useEffect, useState } from "react";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { useAISettings } from "../../hooks/useAISettings";
import { useTranslation } from "react-i18next";

interface AIConfigStepProps {
  onNext: () => void;
  onSkip: () => void;
  onModelsDiscovered?: (models: Array<{ id: string; name: string }>) => void;
}

interface ProviderPreset {
  name: string;
  displayName: string;
  baseUrl: string;
  docsUrl: string;
}

const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    name: "OpenAI",
    displayName: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    docsUrl: "https://platform.openai.com/api-keys",
  },
  {
    name: "Anthropic",
    displayName: "Anthropic",
    baseUrl: "https://api.anthropic.com",
    docsUrl: "https://console.anthropic.com",
  },
  {
    name: "Google Gemini",
    displayName: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
    docsUrl: "https://aistudio.google.com/app/apikey",
  },
  {
    name: "DeepSeek",
    displayName: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    docsUrl: "https://platform.deepseek.com/api-docs",
  },
  {
    name: "xAI Grok",
    displayName: "xAI Grok",
    baseUrl: "https://api.x.ai/v1",
    docsUrl: "https://console.x.ai/",
  },
  {
    name: "Mistral",
    displayName: "Mistral AI",
    baseUrl: "https://api.mistral.ai/v1",
    docsUrl: "https://console.mistral.ai/api-keys/",
  },
  {
    name: "Alibaba Qwen",
    displayName: "Alibaba Qwen",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    docsUrl: "https://bailian.console.aliyun.com/",
  },
];

export function AIConfigStep({
  onNext,
  onModelsDiscovered,
}: AIConfigStepProps) {
  const { settings, addProvider, testApiKey, isLoading, isSaving } =
    useAISettings();
  const { t } = useTranslation();
  const [newProvider, setNewProvider] = useState({
    name: "OpenAI",
    apiKey: "",
    baseUrl: "https://api.openai.com/v1",
  });
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    models?: Array<{ id: string; name: string }>;
  } | null>(null);
  const [hasValidProvider, setHasValidProvider] = useState(false);

  useEffect(() => {
    // Check if user already has a working AI provider
    const workingProvider = settings.providers.find(
      (p) => p.isEnabled && p.apiKey,
    );
    setHasValidProvider(!!workingProvider);
  }, [settings.providers]);

  const handleTestProvider = async () => {
    if (!newProvider.apiKey) {
      setTestResult({ success: false, message: "Please enter an API key" });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await testApiKey(newProvider.apiKey, newProvider.baseUrl);

      if (result.valid) {
        setTestResult({
          success: true,
          message: "Successfully connected to API!",
          models: result.models,
        });
        // Pass models to parent if callback provided
        if (onModelsDiscovered && result.models) {
          onModelsDiscovered(result.models);
        }
        // Automatically add provider on successful test
        setTimeout(() => handleAddProvider(), 500);
      } else {
        setTestResult({
          success: false,
          message: result.error || "Connection failed",
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : "Connection failed",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleAddProvider = async () => {
    if (!newProvider.apiKey) {
      setTestResult({ success: false, message: "Please enter an API key" });
      return;
    }

    try {
      await addProvider({
        name: newProvider.name,
        type: "openai",
        apiKey: newProvider.apiKey,
        baseUrl: newProvider.baseUrl,
        isEnabled: true,
      });

      // Reset form for adding another provider
      setNewProvider({
        name: "OpenAI",
        apiKey: "",
        baseUrl: "https://api.openai.com/v1",
      });
      setTestResult({ success: true, message: "Provider added successfully!" });
      setHasValidProvider(true);
    } catch (error) {
      setTestResult({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to add provider",
      });
    }
  };

  const canProceed =
    hasValidProvider || settings.providers.some((p) => p.isEnabled && p.apiKey);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="ml-2">{t("onboarding.aiConfigStep.loading")}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="mb-2 text-xl font-semibold">
          {t("onboarding.aiConfigStep.title")}
        </h2>
        <p className="text-muted-foreground">
          {t("onboarding.aiConfigStep.subtitle")}
        </p>
      </div>

      {/* Existing Providers */}
      {settings.providers.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-medium">
            {t("onboarding.aiConfigStep.existingProvidersTitle")}
          </h3>
          {settings.providers.map((provider, index) => (
            <Card key={index} className="border-muted">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {provider.isEnabled && provider.apiKey ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-yellow-500" />
                    )}
                    <span className="font-medium">{provider.name}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {provider.isEnabled
                      ? t("onboarding.aiConfigStep.providerStatus.active")
                      : t("onboarding.aiConfigStep.providerStatus.inactive")}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add New Provider */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-lg">
            <Plus className="w-5 h-5" />
            <span>{t("onboarding.aiConfigStep.addProvider")}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Provider Presets */}
          <div>
            <Label className="text-base font-medium mb-3 block">
              {t("onboarding.aiConfigStep.selectProviderPreset")}
            </Label>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {PROVIDER_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => {
                    setNewProvider({
                      name: preset.name,
                      apiKey: "",
                      baseUrl: preset.baseUrl,
                    });
                    setTestResult(null);
                  }}
                  className={`p-3 rounded-lg border-2 transition-all text-sm font-medium ${
                    newProvider.name === preset.name
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-muted hover:border-primary/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {preset.displayName}
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-muted"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                {t("onboarding.aiConfigStep.orCustom")}
              </span>
            </div>
          </div>

          {/* Custom Provider Form */}
            <div>
              <Label htmlFor="provider-name">
                {t("onboarding.aiConfigStep.form.providerName")}
              </Label>
              <Input
                id="provider-name"
                value={newProvider.name}
                onChange={(e) =>
                  setNewProvider({ ...newProvider, name: e.target.value })
                }
                placeholder="OpenAI"
              />
            </div>
            <div>
              <Label htmlFor="base-url">
                {t("onboarding.aiConfigStep.form.baseUrl")}
              </Label>
              <Input
                id="base-url"
                value={newProvider.baseUrl}
                onChange={(e) =>
                  setNewProvider({ ...newProvider, baseUrl: e.target.value })
                }
                placeholder="https://api.openai.com/v1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="api-key">
              {t("onboarding.aiConfigStep.form.apiKey")}
            </Label>
            <Input
              id="api-key"
              type="password"
              value={newProvider.apiKey}
              onChange={(e) =>
                setNewProvider({ ...newProvider, apiKey: e.target.value })
              }
              placeholder="sk-..."
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {t("onboarding.aiConfigStep.securityCopy")}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              onClick={handleTestProvider}
              disabled={isTesting || !newProvider.apiKey}
              variant="outline"
            >
              {isTesting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              {t("onboarding.aiConfigStep.testConnection")}
            </Button>

            {testResult?.success && (
              <Button onClick={handleAddProvider} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                {t("onboarding.aiConfigStep.addProviderButton")}
              </Button>
            )}
          </div>

          {testResult && (
            <Alert
              className={
                testResult.success ? "border-green-500" : "border-red-500"
              }
            >
              <AlertDescription>{testResult.message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Add Another Provider Button (if at least one provider exists) */}
      {hasValidProvider && (
        <div className="text-center">
          <Button
            onClick={() => {
              setTestResult(null);
              setNewProvider({
                name: "OpenAI",
                apiKey: "",
                baseUrl: "https://api.openai.com/v1",
              });
            }}
            variant="outline"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t("onboarding.aiConfigStep.addAnotherProvider")}
          </Button>
        </div>
      )}

      {/* Help Section */}
      <Card className="bg-muted/50">
        <CardContent className="pt-4">
          <h3 className="mb-2 font-medium">
            {t("onboarding.aiConfigStep.helpTitle")}
          </h3>
          <p className="mb-2 text-sm text-muted-foreground">
            {t("onboarding.aiConfigStep.helpCopy")}
          </p>
          <ul className="space-y-1 text-sm">
            <li className="flex items-center space-x-2">
              <span>•</span>
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1 text-primary hover:underline"
              >
                <span>{t("onboarding.aiConfigStep.apiLinks.openai")}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </li>
            <li className="flex items-center space-x-2">
              <span>•</span>
              <a
                href="https://console.anthropic.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1 text-primary hover:underline"
              >
                <span>{t("onboarding.aiConfigStep.apiLinks.anthropic")}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Action Button */}
      {canProceed && (
        <div className="text-center">
          <Button onClick={onNext} size="lg">
            {t("onboarding.aiConfigStep.continueButton")}
          </Button>
        </div>
      )}
    </div>
  );
}
