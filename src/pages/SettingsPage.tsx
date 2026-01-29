import { useState, useEffect, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Eye,
  EyeOff,
  Server,
  RefreshCw,
  Mic,
  Volume2,
  User,
  Bell,
  Sliders,
  Play,
  AlertCircle,
  Lock,
  Calendar,
  Copy,
  Image,
} from "lucide-react";
import { cn } from "../lib/utils";
import type { LucideIcon } from "lucide-react";
import { getFaviconUrl } from "../utils/favicon";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectOptionGroup } from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { useAISettings } from "../hooks/useAISettings";
import { useSecrets } from "../hooks/useSecrets";
import {
  AIProvider,
  AISettings,
  ProviderType,
  ModelCapability,
  AITaskConfig,
  TASK_LABELS,
  DEFAULT_OPENAI_MODELS,
} from "../types/ai-settings";
import { useContinuousListening } from "../contexts/ContinuousListeningContext";
import { ChatGPTOAuthSection } from "../components/settings/ChatGPTOAuthSection";

export function SettingsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("providers");

  return (
    <div>
      <h2 className="mb-2 text-3xl font-bold text-slate-900">{t("settings.title")}</h2>
      <p className="mb-8 text-slate-600">
        {t("settings.subtitle")}
      </p>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="providers">
            <span className="hidden sm:inline">{t("settings.tabs.providers")}</span>
            <span className="sm:hidden">{t("settings.tabs.providers")}</span>
          </TabsTrigger>
          <TabsTrigger value="models">
            <span className="hidden sm:inline">{t("settings.tabs.models")}</span>
            <span className="sm:hidden">{t("settings.tabs.models")}</span>
          </TabsTrigger>
          <TabsTrigger value="secrets">
            <span className="hidden sm:inline">{t("settings.tabs.secrets")}</span>
            <span className="sm:hidden">{t("settings.tabs.secrets")}</span>
          </TabsTrigger>
          <TabsTrigger value="listening">
            <span className="hidden sm:inline">{t("settings.tabs.listening")}</span>
            <span className="sm:hidden">{t("settings.tabs.listening")}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="providers">
          <ProvidersSection />
        </TabsContent>

        <TabsContent value="models">
          <ModelsConfigSection />
        </TabsContent>

        <TabsContent value="secrets">
          <SecretsSection />
        </TabsContent>

        <TabsContent value="listening">
          <ContinuousListeningSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProvidersSection() {
  const { t } = useTranslation();
  const {
    settings,
    addProvider,
    updateProvider,
    deleteProvider,
    syncProviderModels,
    isSaving,
  } = useAISettings();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const handleSyncModels = async (providerId: string) => {
    setSyncingId(providerId);
    try {
      const result = await syncProviderModels(providerId);
      // Could add a toast notification here
      console.log(
        `Sync complete: ${result.added} added, ${result.updated} updated, ${result.total} total`,
      );
    } catch (error) {
      console.error("Failed to sync models:", error);
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* ChatGPT OAuth Section */}
      <ChatGPTOAuthSection />

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-slate-500">
            {t("settings.providers.orUseApiKey", "Or use API keys")}
          </span>
        </div>
      </div>

      {/* API Key Providers Section */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            {t("settings.providers.title")}
          </h3>
          <p className="text-sm text-slate-500">
            {t("settings.providers.description")}
          </p>
        </div>
        <Button onClick={() => setIsAdding(true)} disabled={isAdding}>
          <Plus className="w-4 h-4 mr-2" />
          {t("settings.providers.addProvider")}
        </Button>
      </div>

      {isAdding && (
        <ProviderForm
          onSave={async (data) => {
            const newProvider = await addProvider(data);
            setIsAdding(false);
            void handleSyncModels(newProvider.id);
          }}
          onCancel={() => setIsAdding(false)}
          isSaving={isSaving}
        />
      )}

      <div className="space-y-4">
        {settings.providers.length === 0 && !isAdding ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Server className="w-12 h-12 mb-4 text-slate-300" />
              <p className="text-center text-slate-500">
                {t("settings.providers.emptyState.title")}
                <br />
                {t("settings.providers.emptyState.subtitle")}
              </p>
            </CardContent>
          </Card>
        ) : (
          settings.providers.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              isEditing={editingId === provider.id}
              isSyncing={syncingId === provider.id}
              onEdit={() => setEditingId(provider.id)}
              onCancelEdit={() => setEditingId(null)}
              onSave={async (updates) => {
                await updateProvider(provider.id, updates);
                setEditingId(null);
              }}
              onDelete={() => deleteProvider(provider.id)}
              onToggleEnabled={(enabled) =>
                updateProvider(provider.id, { isEnabled: enabled })
              }
              onSyncModels={() => handleSyncModels(provider.id)}
              isSaving={isSaving}
            />
          ))
        )}
      </div>
    </div>
  );
}



interface ProviderFormData {
  name: string;
  type: ProviderType;
  apiKey: string;
  baseUrl?: string;
  isEnabled: boolean;
}

function ProviderForm({
  initialData,
  onSave,
  onCancel,
  isSaving,
}: {
  initialData?: Partial<ProviderFormData>;
  onSave: (data: ProviderFormData) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [formData, setFormData] = useState<ProviderFormData>({
    name: initialData?.name || "",
    type: initialData?.type || "openai",
    apiKey: initialData?.apiKey || "",
    baseUrl: initialData?.baseUrl || "",
    isEnabled: initialData?.isEnabled ?? true,
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { t } = useTranslation();

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = t("settings.providers.validation.nameRequired");
    }
    if (!formData.apiKey.trim()) {
      newErrors.apiKey = t("settings.providers.validation.apiKeyRequired");
    }
    if (formData.type === "openai-compatible" && !formData.baseUrl?.trim()) {
      newErrors.baseUrl = t("settings.providers.validation.baseUrlRequired");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await onSave(formData);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {initialData
            ? t("settings.providers.editProvider")
            : t("settings.providers.newProvider")}
        </CardTitle>
        <CardDescription>
          {initialData
            ? t("settings.providers.editProviderDescription")
            : t("settings.providers.newProviderDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">{t("settings.providers.providerName")}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder={t("settings.providers.providerNamePlaceholder")}
              />
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">
                {t("settings.providers.providerTypeLabel")}
              </Label>
              <Select
                id="type"
                value={formData.type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    type: e.target.value as ProviderType,
                  })
                }
                options={[
                  {
                    value: "openai",
                    label: t("settings.providers.providerType.openai"),
                  },
                  {
                    value: "openai-compatible",
                    label: t("settings.providers.providerType.openaiCompatible"),
                  },
                ]}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey">
              {t("settings.providers.apiKeyLabel")}
            </Label>
            <div className="relative">
              <Input
                id="apiKey"
                type={showApiKey ? "text" : "password"}
                value={formData.apiKey}
                onChange={(e) =>
                  setFormData({ ...formData, apiKey: e.target.value })
                }
                placeholder={t("settings.providers.apiKeyPlaceholder")}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute -translate-y-1/2 right-3 top-1/2 text-slate-400 hover:text-slate-600"
              >
                {showApiKey ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {errors.apiKey && (
              <p className="text-sm text-red-500">{errors.apiKey}</p>
            )}
          </div>

          {formData.type === "openai-compatible" && (
            <div className="space-y-2">
              <Label htmlFor="baseUrl">
                {t("settings.providers.baseUrlLabel")}
              </Label>
              <Input
                id="baseUrl"
                value={formData.baseUrl}
                onChange={(e) =>
                  setFormData({ ...formData, baseUrl: e.target.value })
                }
                placeholder={t("settings.providers.baseUrlPlaceholder")}
              />
              {errors.baseUrl && (
                <p className="text-sm text-red-500">{errors.baseUrl}</p>
              )}
              <p className="text-xs text-slate-500">
                {t("settings.providers.baseUrlHelp")}
              </p>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Switch
              checked={formData.isEnabled}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, isEnabled: checked })
              }
            />
            <Label>{t("settings.providers.activeLabel")}</Label>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSaving}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function ProviderCard({
  provider,
  isEditing,
  isSyncing,
  onEdit,
  onCancelEdit,
  onSave,
  onDelete,
  onToggleEnabled,
  onSyncModels,
  isSaving,
}: {
  provider: AIProvider;
  isEditing: boolean;
  isSyncing?: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (updates: Partial<ProviderFormData>) => Promise<void>;
  onDelete: () => void;
  onToggleEnabled: (enabled: boolean) => void;
  onSyncModels: () => void;
  isSaving: boolean;
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null);
  const [faviconError, setFaviconError] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    const fetchFavicon = async () => {
      // For OpenAI, use OpenAI domain
      let urlToFetch = provider.baseUrl || "https://openai.com";

      // Determine endpoint to use
      if (provider.type === "openai") {
        urlToFetch = "https://openai.com";
      } else if (!provider.baseUrl) {
        setFaviconError(true);
        return;
      }

      const url = await getFaviconUrl(urlToFetch);
      if (url) {
        setFaviconUrl(url);
      } else {
        setFaviconError(true);
      }
    };

    fetchFavicon();
  }, [provider.type, provider.baseUrl]);

  if (isEditing) {
    return (
      <ProviderForm
        initialData={provider}
        onSave={onSave}
        onCancel={onCancelEdit}
        isSaving={isSaving}
      />
    );
  }

  return (
    <Card className={!provider.isEnabled ? "opacity-60" : ""}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center w-12 h-12 overflow-hidden rounded-lg bg-linear-to-br from-blue-500 to-purple-600">
              {faviconUrl && !faviconError ? (
                <img
                  src={faviconUrl}
                  alt={`${provider.name} favicon`}
                  className="object-cover w-full h-full"
                  onError={() => setFaviconError(true)}
                />
              ) : (
                <Server className="w-6 h-6 text-white" />
              )}
            </div>
            <div>
              <h4 className="font-semibold text-slate-900">{provider.name}</h4>
              <p className="text-sm text-slate-500">
                {provider.type === "openai"
                  ? t("settings.providers.providerType.openai")
                  : t("settings.providers.providerType.openaiCompatibleShort")}
                {provider.baseUrl && (
                  <span className="ml-2 text-xs">({provider.baseUrl})</span>
                )}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {t("settings.providers.modelCount", {
                  count: provider.models.length,
                })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={provider.isEnabled}
              onCheckedChange={onToggleEnabled}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={onSyncModels}
              disabled={isSyncing}
              title={t("settings.providers.syncModels")}
            >
              <RefreshCw
                className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`}
              />
            </Button>
            <Button variant="ghost" size="icon" onClick={onEdit}>
              <Edit2 className="w-4 h-4" />
            </Button>
            {showDeleteConfirm ? (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    onDelete();
                    setShowDeleteConfirm(false);
                  }}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                  <Check className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-slate-400 hover:text-red-500"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Models Preview */}
        {provider.models.length > 0 && (
          <div className="pt-4 mt-4 border-t border-slate-100">
            <p className="mb-2 text-xs font-medium text-slate-500">
              {t("settings.providers.modelsLabel")}
            </p>
            <div className="flex flex-wrap gap-1">
              {provider.models.slice(0, 5).map((model) => (
                <span
                  key={model.id}
                  className="px-2 py-1 text-xs rounded-full bg-slate-100 text-slate-600"
                >
                  {model.name}
                </span>
              ))}
              {provider.models.length > 5 && (
                <span className="px-2 py-1 text-xs rounded-full bg-slate-100 text-slate-600">
                  {t("settings.providers.moreModels", {
                    count: provider.models.length - 5,
                  })}
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ModelsConfigSection() {
  const { t } = useTranslation();
  const {
    settings,
    updateTaskConfig,
    updateTaskConfigsBatch,
    getModelsForTask,
    getTaskConfig,
    isSaving,
  } = useAISettings();
  const MODE_STORAGE_KEY = "aiSettingsMode";
  const [mode, setMode] = useState<"simple" | "advanced">(() => {
    const saved =
      typeof window !== "undefined"
        ? localStorage.getItem(MODE_STORAGE_KEY)
        : null;
    return saved === "advanced" ? "advanced" : "simple";
  });

  useEffect(() => {
    localStorage.setItem(MODE_STORAGE_KEY, mode);
  }, [mode]);

  const taskTypes: ModelCapability[] = [
    "chat",
    "routing",
    "reflection",
    "speech-to-text",
    "summarization",
    "analysis",
    "image-generation",
    "embeddings",
  ];

  const hasProviders = settings.providers.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            {t("settings.models.title")}
          </h3>
          <p className="text-sm text-slate-500">
            {t("settings.models.description")}
          </p>
        </div>
        <div className="inline-flex items-center rounded-lg bg-slate-100 p-1 text-sm font-medium text-slate-700">
          <button
            className={`rounded-md px-3 py-1 transition ${
              mode === "simple"
                ? "bg-white shadow-sm text-slate-900"
                : "text-slate-600"
            }`}
            onClick={() => setMode("simple")}
          >
            {t("settings.models.mode.simple")}
          </button>
          <button
            className={`rounded-md px-3 py-1 transition ${
              mode === "advanced"
                ? "bg-white shadow-sm text-slate-900"
                : "text-slate-600"
            }`}
            onClick={() => setMode("advanced")}
          >
            {t("settings.models.mode.advanced")}
          </button>
        </div>
      </div>

      {!hasProviders ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Server className="w-12 h-12 mb-4 text-slate-300" />
            <p className="text-center text-slate-500">
              {t("settings.models.noProviders.title")}
              <br />
              {t("settings.models.noProviders.subtitle")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {mode === "simple" ? (
            <SimpleModelsConfig
              settings={settings}
              providers={settings.providers}
              onBatchUpdate={updateTaskConfigsBatch}
              isSaving={isSaving}
            />
          ) : (
            <div className="grid gap-4">
              {taskTypes.map((taskType) => (
                <TaskConfigCard
                  key={taskType}
                  taskType={taskType}
                  config={getTaskConfig(taskType)}
                  availableModels={getModelsForTask(taskType)}
                  onUpdate={(
                    providerId,
                    modelId,
                    fallbackProviderId,
                    fallbackModelId,
                  ) =>
                    updateTaskConfig(
                      taskType,
                      providerId,
                      modelId,
                      fallbackProviderId,
                      fallbackModelId,
                    )
                  }
                  providers={settings.providers}
                  isSaving={isSaving}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

type SimpleModelsConfigProps = {
  settings: AISettings;
  providers: AIProvider[];
  onBatchUpdate: (
    updates: {
      taskType: ModelCapability;
      providerId: string | null;
      modelId: string | null;
    }[],
  ) => Promise<unknown>;
  isSaving: boolean;
};

function SimpleModelsConfig({
  settings,
  providers,
  onBatchUpdate,
  isSaving,
}: SimpleModelsConfigProps) {
  const { t } = useTranslation();
  const taskConfigs = settings.taskConfigs || [];

  const llmTasks: ModelCapability[] = [
    "chat",
    "routing",
    "reflection",
    "summarization",
    "analysis",
  ];
  const embeddingTasks: ModelCapability[] = ["embeddings"];
  const speechTasks: ModelCapability[] = ["speech-to-text"];
  const imageTasks: ModelCapability[] = ["image-generation"];

  const cards = [
    {
      id: "llm",
      title: t("settings.models.simpleCards.llm.title"),
      description: t("settings.models.simpleCards.llm.description"),
      taskTypes: llmTasks,
      required: true,
      icon: <Sliders className="w-5 h-5 text-slate-700" />,
    },
    {
      id: "embeddings",
      title: t("settings.models.simpleCards.embeddings.title"),
      description: t("settings.models.simpleCards.embeddings.description"),
      taskTypes: embeddingTasks,
      required: true,
      icon: <Server className="w-5 h-5 text-slate-700" />,
    },
    {
      id: "speech",
      title: t("settings.models.simpleCards.speech.title"),
      description: t("settings.models.simpleCards.speech.description"),
      taskTypes: speechTasks,
      required: false,
      icon: <Mic className="w-5 h-5 text-slate-700" />,
    },
    {
      id: "images",
      title: t("settings.models.simpleCards.images.title"),
      description: t("settings.models.simpleCards.images.description"),
      taskTypes: imageTasks,
      required: false,
      icon: <Image className="w-5 h-5 text-slate-700" />,
    },
  ];

  const applyGroup = async (
    taskTypes: ModelCapability[],
    providerId: string | null,
    modelId: string | null,
  ) => {
    await onBatchUpdate(
      taskTypes.map((taskType) => ({
        taskType,
        providerId,
        modelId,
      })),
    );
  };

  return (
    <div className="grid gap-4">
      {cards.map((card) => (
        <SimpleTaskCard
          key={card.id}
          {...card}
          providers={providers}
          taskConfigs={taskConfigs}
          onApply={applyGroup}
          isSaving={isSaving}
        />
      ))}
    </div>
  );
}

function SimpleTaskCard({
  title,
  description,
  icon,
  taskTypes,
  required,
  providers,
  taskConfigs,
  onApply,
  isSaving,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  taskTypes: ModelCapability[];
  required: boolean;
  providers: AIProvider[];
  taskConfigs: AITaskConfig[];
  onApply: (
    taskTypes: ModelCapability[],
    providerId: string | null,
    modelId: string | null,
  ) => Promise<void>;
  isSaving: boolean;
}) {
  const { t } = useTranslation();
  const configs = taskTypes.map((taskType) =>
    taskConfigs.find((tc) => tc.taskType === taskType),
  );
  const providerIds = new Set(
    configs.map((c) => c?.providerId).filter(Boolean) as string[],
  );
  const modelIds = new Set(
    configs.map((c) => c?.modelId).filter(Boolean) as string[],
  );

  const missingCount = taskTypes.filter((taskType) => {
    const cfg = taskConfigs.find((tc) => tc.taskType === taskType);
    return !cfg?.providerId || !cfg.modelId;
  }).length;

  const groupProviderId =
    providerIds.size === 1 ? Array.from(providerIds)[0] : "";
  const groupModelId = modelIds.size === 1 ? Array.from(modelIds)[0] : "";
  const isMixed = providerIds.size > 1 || modelIds.size > 1;
  const isConfigured =
    !isMixed && !!groupProviderId && !!groupModelId && missingCount === 0;

  const enabledProviders = providers.filter((p) => p.isEnabled);
  const compatibleProviders = enabledProviders.filter((p) =>
    p.models.some((m) =>
      m.capabilities.some((cap) =>
        taskTypes.includes(cap as ModelCapability),
      ),
    ),
  );
  const otherProviders = enabledProviders.filter(
    (p) => !compatibleProviders.includes(p),
  );

  const selectedProvider = providers.find((p) => p.id === groupProviderId);
  const compatibleModels =
    selectedProvider?.models.filter((m) =>
      m.capabilities.some((cap) => taskTypes.includes(cap as ModelCapability)),
    ) || [];
  const otherModels =
    selectedProvider?.models.filter(
      (m) =>
        !m.capabilities.some((cap) =>
          taskTypes.includes(cap as ModelCapability),
        ),
    ) || [];

  const handleProviderChange = async (providerId: string) => {
    if (!providerId) {
      await onApply(taskTypes, null, null);
      return;
    }
    const provider = providers.find((p) => p.id === providerId);
    const firstModel =
      provider?.models.find((m) =>
        m.capabilities.some((cap) =>
          taskTypes.includes(cap as ModelCapability),
        ),
      ) || provider?.models[0];

    await onApply(taskTypes, providerId, firstModel?.id || null);
  };

  const handleModelChange = async (modelId: string) => {
    await onApply(taskTypes, groupProviderId || null, modelId || null);
  };

  const providerOptionGroups: SelectOptionGroup[] = [];
  if (compatibleProviders.length > 0) {
    providerOptionGroups.push({
      label: t("settings.models.optionGroups.suggested"),
      options: compatibleProviders.map((p) => ({
        value: p.id,
        label: p.name,
      })),
    });
  }
  if (otherProviders.length > 0) {
    providerOptionGroups.push({
      label: t("settings.models.optionGroups.otherProviders"),
      options: otherProviders.map((p) => ({
        value: p.id,
        label: p.name,
      })),
    });
  }

  const modelOptionGroups: SelectOptionGroup[] = [];
  if (compatibleModels.length > 0) {
    modelOptionGroups.push({
      label: t("settings.models.optionGroups.suggested"),
      options: compatibleModels.map((m) => ({
        value: m.id,
        label: m.name,
      })),
    });
  }
  const modelsToShow =
    compatibleModels.length === 0 ? selectedProvider?.models || [] : otherModels;
  if (modelsToShow.length > 0) {
    modelOptionGroups.push({
      label:
        compatibleModels.length === 0
          ? t("settings.models.optionGroups.availableModels")
          : t("settings.models.optionGroups.otherModels"),
      options: modelsToShow.map((m) => ({
        value: m.id,
        label: m.name,
      })),
    });
  }

  const coverage = taskTypes
    .map((t) => TASK_LABELS[t]?.label || t)
    .join(" · ");

  const statusLabel = isMixed
    ? t("settings.models.status.mixed")
    : isConfigured
      ? t("settings.models.status.configured")
      : required
        ? t("settings.models.status.needsConfig")
        : t("settings.models.status.optional");

  const statusClass = isMixed
    ? "bg-amber-100 text-amber-700"
    : isConfigured
      ? "bg-green-100 text-green-700"
      : required
        ? "bg-rose-100 text-rose-700"
        : "bg-slate-100 text-slate-700";

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
            {icon}
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-semibold text-slate-900">{title}</h4>
              <span className={`px-2 py-0.5 text-xs rounded-full ${statusClass}`}>
                {statusLabel}
              </span>
              {required ? (
                <span className="px-2 py-0.5 text-xs rounded-full bg-slate-900 text-white">
                  {t("common.required")}
                </span>
              ) : (
                <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-700">
                  {t("common.optional")}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500">{description}</p>
            <p className="text-xs text-slate-500">
              {t("settings.models.coverage", { coverage })}
            </p>
            {isMixed && (
              <p className="text-xs text-amber-600">
                {t("settings.models.warnings.mixed")}
              </p>
            )}
            {required && missingCount > 0 && !isConfigured && (
              <p className="text-xs text-rose-600">
                {t("settings.models.warnings.required")}
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-4 mt-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("settings.models.providerLabel")}</Label>
            <Select
              value={groupProviderId}
              onChange={(e) => handleProviderChange(e.target.value)}
              disabled={isSaving}
              placeholder={t("settings.models.providerPlaceholder")}
              options={[{ value: "", label: t("common.none") }]}
              optionGroups={providerOptionGroups}
            />
            {compatibleProviders.length === 0 && enabledProviders.length > 0 && (
              <p className="text-xs text-amber-600">
                {t("settings.models.noRecommendedProvider")}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>{t("settings.models.modelLabel")}</Label>
            <Select
              value={groupModelId}
              onChange={(e) => handleModelChange(e.target.value)}
              disabled={isSaving || !groupProviderId}
              placeholder={t("settings.models.modelPlaceholder")}
              options={[{ value: "", label: t("common.none") }]}
              optionGroups={modelOptionGroups}
            />
            {groupProviderId && compatibleModels.length === 0 && (
              <p className="text-xs text-amber-600">
                {t("settings.models.noSuggestedModelForProvider")}
              </p>
            )}
            {!groupProviderId && (
              <p className="text-xs text-slate-500">
                {t("settings.models.selectProviderFirst")}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TaskConfigCard({
  taskType,
  config,
  availableModels,
  onUpdate,
  providers,
  isSaving,
}: {
  taskType: ModelCapability;
  config: ReturnType<ReturnType<typeof useAISettings>["getTaskConfig"]>;
  availableModels: ReturnType<
    ReturnType<typeof useAISettings>["getModelsForTask"]
  >;
  onUpdate: (
    providerId: string | null,
    modelId: string | null,
    fallbackProviderId?: string | null,
    fallbackModelId?: string | null,
  ) => void;
  providers: AIProvider[];
  isSaving: boolean;
}) {
  const { t } = useTranslation();
  const taskInfo = TASK_LABELS[taskType];
  const selectedProvider = providers.find((p) => p.id === config?.providerId);
  const selectedFallbackProvider = providers.find(
    (p) => p.id === config?.fallbackProviderId,
  );

  // Séparer les modèles en "suggérés" (avec la capability) et "autres"
  const suggestedModels =
    selectedProvider?.models.filter((m) => m.capabilities.includes(taskType)) ||
    [];
  const otherModels =
    selectedProvider?.models.filter(
      (m) => !m.capabilities.includes(taskType),
    ) || [];

  // If no suggested models exist, include all models in "others" for flexibility
  const allAvailableModels =
    suggestedModels.length === 0
      ? selectedProvider?.models || []
      : selectedProvider?.models || [];

  // Fallback models
  const suggestedFallbackModels =
    selectedFallbackProvider?.models.filter((m) =>
      m.capabilities.includes(taskType),
    ) || [];
  const otherFallbackModels =
    selectedFallbackProvider?.models.filter(
      (m) => !m.capabilities.includes(taskType),
    ) || [];

  // If no suggested models exist, include all models in "others" for flexibility
  const allAvailableFallbackModels =
    suggestedFallbackModels.length === 0
      ? selectedFallbackProvider?.models || []
      : selectedFallbackProvider?.models || [];

  // Séparer les providers en "suggérés" (avec au moins un modèle compatible) et "autres"
  const enabledProviders = providers.filter((p) => p.isEnabled);
  const suggestedProviders = enabledProviders.filter((p) =>
    p.models.some((m) => m.capabilities.includes(taskType)),
  );
  const otherProviders = enabledProviders.filter(
    (p) => !p.models.some((m) => m.capabilities.includes(taskType)),
  );

  const handleProviderChange = (providerId: string) => {
    if (!providerId) {
      onUpdate(null, null);
      return;
    }
    // Auto-select first compatible model when changing provider (if exists)
    // Otherwise keep current model selection or set to null
    const provider = providers.find((p) => p.id === providerId);
    const firstModel = provider?.models.find((m) =>
      m.capabilities.includes(taskType),
    );

    // If there's no compatible model but provider has models, allow selecting any model later
    // If current model is from the new provider, keep it
    let modelId = firstModel?.id || null;
    if (!modelId && config?.modelId) {
      const currentModel = provider?.models.find(
        (m) => m.id === config.modelId,
      );
      if (currentModel) {
        modelId = config.modelId;
      }
    }

    onUpdate(
      providerId,
      modelId,
      config?.fallbackProviderId,
      config?.fallbackModelId,
    );
  };

  const handleFallbackProviderChange = (providerId: string) => {
    if (!providerId) {
      onUpdate(config?.providerId || null, config?.modelId || null, null, null);
      return;
    }
    // Auto-select first compatible model when changing fallback provider (if exists)
    // Otherwise keep current model selection or set to null
    const provider = providers.find((p) => p.id === providerId);
    const firstModel = provider?.models.find((m) =>
      m.capabilities.includes(taskType),
    );

    // If there's no compatible model but provider has models, allow selecting any model later
    // If current fallback model is from the new provider, keep it
    let modelId = firstModel?.id || null;
    if (!modelId && config?.fallbackModelId) {
      const currentModel = provider?.models.find(
        (m) => m.id === config.fallbackModelId,
      );
      if (currentModel) {
        modelId = config.fallbackModelId;
      }
    }

    onUpdate(
      config?.providerId || null,
      config?.modelId || null,
      providerId,
      modelId,
    );
  };

  const isConfigured = config?.providerId && config?.modelId;
  const isFallbackConfigured =
    config?.fallbackProviderId && config?.fallbackModelId;

  // Build provider option groups
  const providerOptionGroups: SelectOptionGroup[] = [];
  if (suggestedProviders.length > 0) {
    providerOptionGroups.push({
      label: t("settings.models.optionGroups.suggestedCompatible"),
      options: suggestedProviders.map((p) => ({
        value: p.id,
        label: p.name,
      })),
    });
  }
  if (otherProviders.length > 0) {
    providerOptionGroups.push({
      label: t("settings.models.optionGroups.otherProviders"),
      options: otherProviders.map((p) => ({
        value: p.id,
        label: p.name,
      })),
    });
  }

  // Build model option groups
  const modelOptionGroups: SelectOptionGroup[] = [];
  if (suggestedModels.length > 0) {
    modelOptionGroups.push({
      label: t("settings.models.optionGroups.suggestedForTask"),
      options: suggestedModels.map((m) => ({
        value: m.id,
        label: m.name,
      })),
    });
  }
  // Show other models, or all models if no suggested ones exist
  const modelsToShow =
    suggestedModels.length === 0 ? allAvailableModels : otherModels;
  if (modelsToShow.length > 0) {
    modelOptionGroups.push({
      label:
        suggestedModels.length === 0
          ? t("settings.models.optionGroups.availableModels")
          : t("settings.models.optionGroups.otherModels"),
      options: modelsToShow.map((m) => ({
        value: m.id,
        label: m.name,
      })),
    });
  }

  // Build fallback provider option groups
  const fallbackProviderOptionGroups: SelectOptionGroup[] = [];
  if (suggestedProviders.length > 0) {
    fallbackProviderOptionGroups.push({
      label: t("settings.models.optionGroups.suggestedCompatible"),
      options: suggestedProviders.map((p) => ({
        value: p.id,
        label: p.name,
      })),
    });
  }
  if (otherProviders.length > 0) {
    fallbackProviderOptionGroups.push({
      label: t("settings.models.optionGroups.otherProviders"),
      options: otherProviders.map((p) => ({
        value: p.id,
        label: p.name,
      })),
    });
  }

  // Build fallback model option groups
  const fallbackModelOptionGroups: SelectOptionGroup[] = [];
  if (suggestedFallbackModels.length > 0) {
    fallbackModelOptionGroups.push({
      label: t("settings.models.optionGroups.suggestedForTask"),
      options: suggestedFallbackModels.map((m) => ({
        value: m.id,
        label: m.name,
      })),
    });
  }
  // Show other models, or all models if no suggested ones exist
  const fallbackModelsToShow =
    suggestedFallbackModels.length === 0
      ? allAvailableFallbackModels
      : otherFallbackModels;
  if (fallbackModelsToShow.length > 0) {
    fallbackModelOptionGroups.push({
      label:
        suggestedFallbackModels.length === 0
          ? t("settings.models.optionGroups.availableModels")
          : t("settings.models.optionGroups.otherModels"),
      options: fallbackModelsToShow.map((m) => ({
        value: m.id,
        label: m.name,
      })),
    });
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <div className="text-3xl">{taskInfo.icon}</div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-slate-900">{taskInfo.label}</h4>
              {isConfigured ? (
                <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">
                  {t("settings.models.configured")}
                </span>
              ) : (
                <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700">
                  {t("settings.models.notConfigured")}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500">{taskInfo.description}</p>

            {/* Primary Configuration */}
            <div className="p-3 mt-4 rounded-lg bg-slate-50">
              <h5 className="mb-3 text-sm font-medium text-slate-700">
                {t("settings.models.primary.title")}
              </h5>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("settings.models.providerLabel")}</Label>
                  <Select
                    value={config?.providerId || ""}
                    onChange={(e) => handleProviderChange(e.target.value)}
                    disabled={isSaving}
                    placeholder={t("settings.models.providerPlaceholder")}
                    options={[{ value: "", label: t("common.none") }]}
                    optionGroups={providerOptionGroups}
                  />
                  {suggestedProviders.length === 0 &&
                    enabledProviders.length > 0 && (
                      <p className="text-xs text-amber-600">
                        {t("settings.models.noSuggestedProviderForTask")}
                      </p>
                    )}
                  {enabledProviders.length === 0 && (
                    <p className="text-xs text-amber-600">
                      {t("settings.models.noActiveProvider")}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>{t("settings.models.modelLabel")}</Label>
                  <Select
                    value={config?.modelId || ""}
                    onChange={(e) =>
                      onUpdate(
                        config?.providerId || null,
                        e.target.value || null,
                        config?.fallbackProviderId,
                        config?.fallbackModelId,
                      )
                    }
                    disabled={isSaving || !config?.providerId}
                    placeholder={t("settings.models.modelPlaceholder")}
                    options={[{ value: "", label: t("common.none") }]}
                    optionGroups={modelOptionGroups}
                  />
                  {selectedProvider &&
                    suggestedModels.length === 0 &&
                    otherModels.length > 0 && (
                      <p className="text-xs text-amber-600">
                        {t("settings.models.noSuggestedModel")}
                      </p>
                    )}
                </div>
              </div>
            </div>

            {/* Fallback Configuration */}
            <div className="p-3 mt-4 border border-dashed rounded-lg bg-slate-50 border-slate-300">
              <h5 className="mb-3 text-sm font-medium text-slate-700">
                {t("settings.models.fallback.title")}
              </h5>
              <p className="mb-3 text-xs text-slate-500">
                {t("settings.models.fallback.description")}
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("settings.models.fallback.providerLabel")}</Label>
                  <Select
                    value={config?.fallbackProviderId || ""}
                    onChange={(e) =>
                      handleFallbackProviderChange(e.target.value)
                    }
                    disabled={isSaving}
                    placeholder={t("settings.models.providerPlaceholder")}
                    options={[{ value: "", label: t("common.none") }]}
                    optionGroups={fallbackProviderOptionGroups}
                  />
                  {isFallbackConfigured && (
                    <p className="text-xs text-green-600">
                      {t("settings.models.fallback.configured")}
                    </p>
                  )}
                  {!isFallbackConfigured && (
                    <p className="text-xs text-amber-600">
                      {t("settings.models.fallback.optionalHint")}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>{t("settings.models.fallback.modelLabel")}</Label>
                  <Select
                    value={config?.fallbackModelId || ""}
                    onChange={(e) =>
                      onUpdate(
                        config?.providerId || null,
                        config?.modelId || null,
                        config?.fallbackProviderId || null,
                        e.target.value || null,
                      )
                    }
                    disabled={isSaving || !config?.fallbackProviderId}
                    placeholder={t("settings.models.modelPlaceholder")}
                    options={[{ value: "", label: t("common.none") }]}
                    optionGroups={fallbackModelOptionGroups}
                  />
                  {selectedFallbackProvider &&
                    suggestedFallbackModels.length === 0 &&
                    otherFallbackModels.length > 0 && (
                      <p className="text-xs text-amber-600">
                        {t("settings.models.noSuggestedModel")}
                      </p>
                    )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== Continuous Listening Section ====================

function ContinuousListeningSection() {
  const { t } = useTranslation();
  const { settings, isLoading, actions } = useContinuousListening();
  const [isSaving, setIsSaving] = useState(false);
  const [testText, setTestText] = useState("");
  const [testResult, setTestResult] = useState<{
    matches: boolean;
    remainingText: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Local form state
  const [formState, setFormState] = useState({
    wakeWord: settings?.wakeWord || "Hey Brain",
    wakeWordSensitivity: settings?.wakeWordSensitivity || 0.8,
    minImportanceThreshold: settings?.minImportanceThreshold || 0.3,
    silenceDetectionMs: settings?.silenceDetectionMs || 1500,
    vadSensitivity: settings?.vadSensitivity || 0.5,
    speakerConfidenceThreshold: settings?.speakerConfidenceThreshold || 0.7,
    notifyOnMemoryStored: settings?.notifyOnMemoryStored ?? true,
    notifyOnCommandDetected: settings?.notifyOnCommandDetected ?? true,
  });

  // Update form when settings load
  useEffect(() => {
    if (settings) {
      setFormState({
        wakeWord: settings.wakeWord,
        wakeWordSensitivity: settings.wakeWordSensitivity,
        minImportanceThreshold: settings.minImportanceThreshold,
        silenceDetectionMs: settings.silenceDetectionMs,
        vadSensitivity: settings.vadSensitivity,
        speakerConfidenceThreshold: settings.speakerConfidenceThreshold,
        notifyOnMemoryStored: settings.notifyOnMemoryStored,
        notifyOnCommandDetected: settings.notifyOnCommandDetected,
      });
    }
  }, [settings]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await actions.updateSettings(formState);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("common.errorSaving"),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestWakeWord = async () => {
    if (!testText.trim()) return;
    try {
      const result = await actions.testWakeWord(testText);
      setTestResult(result);
    } catch (err) {
      console.error("Test failed:", err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900">
          {t("settings.listening.headerTitle")}
        </h3>
        <p className="text-sm text-slate-500">
          {t("settings.listening.headerDescription")}
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 border border-red-200 rounded-lg bg-red-50">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Wake Word Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mic className="w-5 h-5" />
            {t("settings.listening.wakeWord.title")}
          </CardTitle>
          <CardDescription>
            {t("settings.listening.wakeWord.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="wakeWord">
                {t("settings.listening.wakeWord.label")}
              </Label>
              <Input
                id="wakeWord"
                value={formState.wakeWord}
                onChange={(e) =>
                  setFormState({ ...formState, wakeWord: e.target.value })
                }
                placeholder={t("settings.listening.wakeWord.placeholder")}
              />
              <p className="text-xs text-slate-500">
                {t("settings.listening.wakeWord.help")}
              </p>
            </div>

            <div className="space-y-2">
              <Label>
                {t("settings.listening.wakeWord.sensitivity", {
                  percent: (formState.wakeWordSensitivity * 100).toFixed(0),
                })}
              </Label>
              <input
                type="range"
                min="0"
                max="100"
                value={formState.wakeWordSensitivity * 100}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    wakeWordSensitivity: parseInt(e.target.value) / 100,
                  })
                }
                className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-slate-200"
              />
              <p className="text-xs text-slate-500">
                {t("settings.listening.wakeWord.sensitivityHint")}
              </p>
            </div>
          </div>

          {/* Test Wake Word */}
          <div className="p-4 space-y-3 rounded-lg bg-slate-50">
            <Label>{t("settings.listening.wakeWord.testTitle")}</Label>
            <div className="flex gap-2">
              <Input
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                placeholder={t("settings.listening.wakeWord.testPlaceholder", {
                  word: formState.wakeWord,
                })}
                className="flex-1"
              />
              <Button onClick={handleTestWakeWord} variant="outline">
                <Play className="w-4 h-4 mr-2" />
                {t("settings.listening.wakeWord.testAction")}
              </Button>
            </div>
            {testResult && (
              <div
                className={`p-3 rounded-lg ${testResult.matches ? "bg-green-50 border border-green-200" : "bg-orange-50 border border-orange-200"}`}
              >
                {testResult.matches ? (
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-green-700">
                        {t("settings.listening.wakeWord.detected")}
                      </p>
                      <p className="text-sm text-green-600">
                        {t("settings.listening.wakeWord.commandExtracted", {
                          command:
                            testResult.remainingText ||
                            t("settings.listening.wakeWord.emptyCommand"),
                        })}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <X className="w-5 h-5 text-orange-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-orange-700">
                        {t("settings.listening.wakeWord.notDetected")}
                      </p>
                      <p className="text-sm text-orange-600">
                        {t("settings.listening.wakeWord.passiveNote")}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Audio Processing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Volume2 className="w-5 h-5" />
            {t("settings.listening.audioProcessing.title")}
          </CardTitle>
          <CardDescription>
            {t("settings.listening.audioProcessing.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label>
                {t("settings.listening.audioProcessing.vadSensitivity", {
                  percent: (formState.vadSensitivity * 100).toFixed(0),
                })}
              </Label>
              <input
                type="range"
                min="0"
                max="100"
                value={formState.vadSensitivity * 100}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    vadSensitivity: parseInt(e.target.value) / 100,
                  })
                }
                className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-slate-200"
              />
              <p className="text-xs text-slate-500">
                {t("settings.listening.audioProcessing.vadHint")}
              </p>
            </div>

            <div className="space-y-2">
              <Label>
                {t("settings.listening.audioProcessing.silenceDelay", {
                  ms: formState.silenceDetectionMs,
                })}
              </Label>
              <input
                type="range"
                min="500"
                max="5000"
                step="100"
                value={formState.silenceDetectionMs}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    silenceDetectionMs: parseInt(e.target.value),
                  })
                }
                className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-slate-200"
              />
              <p className="text-xs text-slate-500">
                {t("settings.listening.audioProcessing.silenceHint")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Speaker Identification */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="w-5 h-5" />
            {t("settings.listening.speaker.title")}
          </CardTitle>
          <CardDescription>
            {t("settings.listening.speaker.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>
              {t("settings.listening.speaker.confidenceThreshold", {
                percent: (formState.speakerConfidenceThreshold * 100).toFixed(0),
              })}
            </Label>
            <input
              type="range"
              min="50"
              max="95"
              value={formState.speakerConfidenceThreshold * 100}
              onChange={(e) =>
                setFormState({
                  ...formState,
                  speakerConfidenceThreshold: parseInt(e.target.value) / 100,
                })
              }
              className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-slate-200"
            />
            <p className="text-xs text-slate-500">
              {t("settings.listening.speaker.confidenceHint")}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Memory Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sliders className="w-5 h-5" />
            {t("settings.listening.memory.title")}
          </CardTitle>
          <CardDescription>
            {t("settings.listening.memory.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>
              {t("settings.listening.memory.minImportance", {
                percent: (formState.minImportanceThreshold * 100).toFixed(0),
              })}
            </Label>
            <input
              type="range"
              min="0"
              max="80"
              value={formState.minImportanceThreshold * 100}
              onChange={(e) =>
                setFormState({
                  ...formState,
                  minImportanceThreshold: parseInt(e.target.value) / 100,
                })
              }
              className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-slate-200"
            />
            <p className="text-xs text-slate-500">
              {t("settings.listening.memory.minImportanceHint")}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="w-5 h-5" />
            {t("settings.listening.notifications.title")}
          </CardTitle>
          <CardDescription>
            {t("settings.listening.notifications.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">
                {t("settings.listening.notifications.memoryStored")}
              </Label>
              <p className="text-sm text-slate-500">
                {t("settings.listening.notifications.memoryStoredHint")}
              </p>
            </div>
            <Switch
              checked={formState.notifyOnMemoryStored}
              onCheckedChange={(checked) =>
                setFormState({ ...formState, notifyOnMemoryStored: checked })
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">
                {t("settings.listening.notifications.commandDetected")}
              </Label>
              <p className="text-sm text-slate-500">
                {t("settings.listening.notifications.commandDetectedHint")}
              </p>
            </div>
            <Switch
              checked={formState.notifyOnCommandDetected}
              onCheckedChange={(checked) =>
                setFormState({ ...formState, notifyOnCommandDetected: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              {t("common.saving")}
            </>
          ) : (
            <>
              <Check className="w-4 h-4 mr-2" />
              {t("common.save")}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ==================== Secrets Section ====================

function SecretsSection() {
  const { t } = useTranslation();
  const {
    secrets,
    isLoading,
    isSaving,
    error,
    createSecret,
    updateSecret,
    deleteSecret,
  } = useSecrets();
  const [isAdding, setIsAdding] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [showValues, setShowValues] = useState<Set<string>>(new Set());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const CATEGORIES = [
    "general",
    "ai_provider",
    "mcp",
    "integration",
    "generated_tool",
  ];

  const toggleShowValue = (key: string) => {
    const newSet = new Set(showValues);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setShowValues(newSet);
  };

  const copyToClipboard = (key: string) => {
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleAddClick = () => {
    setEditingKey(null);
    setIsAdding(true);
  };

  const handleEditClick = (key: string) => {
    setEditingKey(key);
    setIsAdding(false);
  };

  const handleCancelEdit = () => {
    setIsAdding(false);
    setEditingKey(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            {t("settings.secrets.title")}
          </h3>
          <p className="text-sm text-slate-500">
            {t("settings.secrets.subtitle")}
          </p>
        </div>
        <Button
          onClick={handleAddClick}
          disabled={isAdding || editingKey !== null}
        >
          <Plus className="w-4 h-4 mr-2" />
          {t("settings.secrets.addSecret")}
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 border border-red-200 rounded-lg bg-red-50">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {isAdding && (
        <SecretForm
          onSave={async (data) => {
            await createSecret(data);
            setIsAdding(false);
          }}
          onCancel={handleCancelEdit}
          isSaving={isSaving}
          categories={CATEGORIES}
        />
      )}

      <div className="space-y-4">
        {secrets.length === 0 && !isAdding ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Lock className="w-12 h-12 mb-4 text-slate-300" />
              <p className="text-center text-slate-500">
                {t("settings.secrets.emptyState.title")}
                <br />
                {t("settings.secrets.emptyState.subtitle")}
              </p>
            </CardContent>
          </Card>
        ) : (
          secrets.map((secret) => (
            <SecretCard
              key={secret.key}
              secret={secret}
              isEditing={editingKey === secret.key}
              isShown={showValues.has(secret.key)}
              isCopied={copiedKey === secret.key}
              onEdit={() => handleEditClick(secret.key)}
              onCancelEdit={handleCancelEdit}
              onUpdate={(data) => updateSecret(secret.key, data)}
              onDelete={() => deleteSecret(secret.key)}
              onToggleShow={() => toggleShowValue(secret.key)}
              onCopy={() => copyToClipboard(secret.key)}
              isSaving={isSaving}
              categories={CATEGORIES}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface SecretFormData {
  key: string;
  value: string;
  displayName: string;
  category: string;
  description?: string;
  expiresAt?: string;
}

function SecretForm({
  initialData,
  onSave,
  onCancel,
  isSaving,
  categories,
}: {
  initialData?: Partial<SecretFormData>;
  onSave: (data: SecretFormData) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
  categories: string[];
}) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<SecretFormData>({
    key: initialData?.key || "",
    value: initialData?.value || "",
    displayName: initialData?.displayName || "",
    category: initialData?.category || "general",
    description: initialData?.description || "",
    expiresAt: initialData?.expiresAt || "",
  });
  const [showValue, setShowValue] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isEditing = !!initialData?.key;

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.key.trim()) {
      newErrors.key = t("settings.secrets.validation.keyRequired");
    } else if (!/^[a-z][a-z0-9_]*$/.test(formData.key)) {
      newErrors.key =
        t("settings.secrets.validation.keyFormat");
    }

    if (!formData.value.trim()) {
      newErrors.value = t("settings.secrets.validation.valueRequired");
    }

    if (!formData.displayName.trim()) {
      newErrors.displayName = t("settings.secrets.validation.displayNameRequired");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await onSave(formData);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {isEditing
            ? t("settings.secrets.editTitle")
            : t("settings.secrets.newTitle")}
        </CardTitle>
        <CardDescription>
          {isEditing
            ? t("settings.secrets.editDescription")
            : t("settings.secrets.newDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="key">{t("settings.secrets.keyLabel")}</Label>
              <Input
                id="key"
                value={formData.key}
                onChange={(e) =>
                  setFormData({ ...formData, key: e.target.value })
                }
                placeholder={t("settings.secrets.keyPlaceholder")}
                disabled={isEditing}
                className={isEditing ? "bg-slate-50" : ""}
              />
              {errors.key && (
                <p className="text-sm text-red-500">{errors.key}</p>
              )}
              <p className="text-xs text-slate-500">
                {t("settings.secrets.keyHelp")}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName">
                {t("settings.secrets.displayNameLabel")}
              </Label>
              <Input
                id="displayName"
                value={formData.displayName}
                onChange={(e) =>
                  setFormData({ ...formData, displayName: e.target.value })
                }
                placeholder={t("settings.secrets.displayNamePlaceholder")}
              />
              {errors.displayName && (
                <p className="text-sm text-red-500">{errors.displayName}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="value">{t("settings.secrets.valueLabel")}</Label>
            <div className="relative">
              <Input
                id="value"
                type={showValue ? "text" : "password"}
                value={formData.value}
                onChange={(e) =>
                  setFormData({ ...formData, value: e.target.value })
                }
                placeholder={t("settings.secrets.valuePlaceholder")}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowValue(!showValue)}
                className="absolute -translate-y-1/2 right-3 top-1/2 text-slate-400 hover:text-slate-600"
              >
                {showValue ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {errors.value && (
              <p className="text-sm text-red-500">{errors.value}</p>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="category">
                {t("settings.secrets.categoryLabel")}
              </Label>
              <Select
                id="category"
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                options={categories.map((cat) => ({
                  value: cat,
                  label:
                    {
                      general: t("settings.secrets.categories.general"),
                      ai_provider: t("settings.secrets.categories.aiProvider"),
                      mcp: t("settings.secrets.categories.mcp"),
                      integration: t("settings.secrets.categories.integration"),
                      generated_tool: t("settings.secrets.categories.generatedTool"),
                    }[cat] || cat,
                }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expiresAt">
                {t("settings.secrets.expiresAtLabel")}
              </Label>
              <Input
                id="expiresAt"
                type="datetime-local"
                value={formData.expiresAt}
                onChange={(e) =>
                  setFormData({ ...formData, expiresAt: e.target.value })
                }
              />
              <p className="text-xs text-slate-500">
                {t("settings.secrets.expiresAtHelp")}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">
              {t("settings.secrets.descriptionLabel")}
            </Label>
            <Input
              id="description"
              value={formData.description || ""}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder={t("settings.secrets.descriptionPlaceholder")}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSaving}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving
                ? t("common.saving")
                : isEditing
                  ? t("common.edit")
                  : t("common.create")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function SecretCard({
  secret,
  isEditing,
  isShown,
  isCopied,
  onEdit,
  onCancelEdit,
  onUpdate,
  onDelete,
  onToggleShow,
  onCopy,
  isSaving,
  categories,
}: {
  secret: any;
  isEditing: boolean;
  isShown: boolean;
  isCopied: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onUpdate: (data: Partial<SecretFormData>) => Promise<any>;
  onDelete: () => void;
  onToggleShow: () => void;
  onCopy: () => void;
  isSaving: boolean;
  categories: string[];
}) {
  const { t } = useTranslation();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const categoryLabels: Record<string, string> = {
    general: t("settings.secrets.categories.general"),
    ai_provider: t("settings.secrets.categories.aiProvider"),
    mcp: t("settings.secrets.categories.mcp"),
    integration: t("settings.secrets.categories.integration"),
    generated_tool: t("settings.secrets.categories.generatedTool"),
  };

  if (isEditing) {
    return (
      <SecretForm
        initialData={secret}
        onSave={onUpdate}
        onCancel={onCancelEdit}
        isSaving={isSaving}
        categories={categories}
      />
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-slate-900">
                {secret.displayName}
              </h4>
              <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600">
                {categoryLabels[secret.category] || secret.category}
              </span>
            </div>

            {secret.description && (
              <p className="mt-1 text-sm text-slate-600">
                {secret.description}
              </p>
            )}

            <div className="flex items-center gap-3 mt-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-slate-50 border border-slate-200">
                <code className="font-mono text-xs text-slate-500">
                  {secret.key}
                </code>
                <button
                  onClick={onCopy}
                  className="p-1 rounded hover:bg-slate-200"
                  title={t("settings.secrets.copyKey")}
                >
                  <Copy
                    className={`w-3 h-3 ${isCopied ? "text-green-500" : "text-slate-400"}`}
                  />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
              {secret.expiresAt && (
                <>
                  <Calendar className="w-3 h-3" />
                  <span>
                    {t("settings.secrets.expiresOn")}{" "}
                    {new Date(secret.expiresAt).toLocaleDateString("fr-FR")}
                  </span>
                </>
              )}
              {secret.lastUsedAt && (
                <span>
                  · {t("settings.secrets.lastUsed")}{" "}
                  {new Date(secret.lastUsedAt).toLocaleDateString("fr-FR")}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleShow}
              title={t("settings.secrets.toggleValue")}
            >
              {isShown ? (
                <Eye className="w-4 h-4 text-slate-400" />
              ) : (
                <EyeOff className="w-4 h-4 text-slate-400" />
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={onEdit}>
              <Edit2 className="w-4 h-4" />
            </Button>
            {showDeleteConfirm ? (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    onDelete();
                    setShowDeleteConfirm(false);
                  }}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                  <Check className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-slate-400 hover:text-red-500"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Show value if toggled */}
        {isShown && (
          <div className="p-3 mt-4 border rounded-lg bg-amber-50 border-amber-200">
            <p className="mb-2 text-xs font-semibold text-amber-700">
              {t("settings.secrets.valueLabel")}:
            </p>
            <div className="p-2 font-mono text-sm break-all bg-white border rounded border-amber-100 text-slate-900">
              {secret.value || "••••••••"}
            </div>
            <p className="mt-2 text-xs text-amber-600">
              {t("settings.secrets.valueWarning")}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
