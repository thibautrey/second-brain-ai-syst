import { useState, useEffect } from "react";
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
} from "lucide-react";
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
import {
  AIProvider,
  ProviderType,
  ModelCapability,
  TASK_LABELS,
  DEFAULT_OPENAI_MODELS,
} from "../types/ai-settings";
import { useContinuousListening } from "../contexts/ContinuousListeningContext";

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState("providers");

  return (
    <div>
      <h2 className="mb-2 text-3xl font-bold text-slate-900">Paramètres</h2>
      <p className="mb-8 text-slate-600">
        Configurez vos providers d'IA et assignez les modèles aux différentes
        tâches.
      </p>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="providers">Providers IA</TabsTrigger>
          <TabsTrigger value="models">Configuration des Modèles</TabsTrigger>
          <TabsTrigger value="listening">Écoute Continue</TabsTrigger>
        </TabsList>

        <TabsContent value="providers">
          <ProvidersSection />
        </TabsContent>

        <TabsContent value="models">
          <ModelsConfigSection />
        </TabsContent>

        <TabsContent value="listening">
          <ContinuousListeningSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProvidersSection() {
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
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Providers d'IA
          </h3>
          <p className="text-sm text-slate-500">
            Configurez vos clés API et endpoints pour les différents services
            d'IA.
          </p>
        </div>
        <Button onClick={() => setIsAdding(true)} disabled={isAdding}>
          <Plus className="w-4 h-4 mr-2" />
          Ajouter un Provider
        </Button>
      </div>

      {isAdding && (
        <ProviderForm
          onSave={async (data) => {
            await addProvider(data);
            setIsAdding(false);
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
                Aucun provider configuré.
                <br />
                Ajoutez un provider pour commencer.
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

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Le nom est requis";
    }
    if (!formData.apiKey.trim()) {
      newErrors.apiKey = "La clé API est requise";
    }
    if (formData.type === "openai-compatible" && !formData.baseUrl?.trim()) {
      newErrors.baseUrl =
        "L'URL de base est requise pour les providers compatibles OpenAI";
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
          {initialData ? "Modifier le Provider" : "Nouveau Provider"}
        </CardTitle>
        <CardDescription>
          {initialData
            ? "Modifiez les informations du provider"
            : "Configurez un nouveau provider d'IA"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Nom du Provider</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="ex: OpenAI Production"
              />
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Type de Provider</Label>
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
                  { value: "openai", label: "OpenAI" },
                  {
                    value: "openai-compatible",
                    label: "OpenAI Compatible (URL personnalisée)",
                  },
                ]}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey">Clé API</Label>
            <div className="relative">
              <Input
                id="apiKey"
                type={showApiKey ? "text" : "password"}
                value={formData.apiKey}
                onChange={(e) =>
                  setFormData({ ...formData, apiKey: e.target.value })
                }
                placeholder="sk-..."
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
              <Label htmlFor="baseUrl">URL de Base</Label>
              <Input
                id="baseUrl"
                value={formData.baseUrl}
                onChange={(e) =>
                  setFormData({ ...formData, baseUrl: e.target.value })
                }
                placeholder="https://api.example.com/v1"
              />
              {errors.baseUrl && (
                <p className="text-sm text-red-500">{errors.baseUrl}</p>
              )}
              <p className="text-xs text-slate-500">
                L'URL de base de l'API compatible OpenAI (ex:
                https://api.together.xyz/v1)
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
            <Label>Provider actif</Label>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSaving}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Enregistrement..." : "Enregistrer"}
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
            <div className="flex items-center justify-center w-12 h-12 overflow-hidden rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
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
                {provider.type === "openai" ? "OpenAI" : "OpenAI Compatible"}
                {provider.baseUrl && (
                  <span className="ml-2 text-xs">({provider.baseUrl})</span>
                )}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {provider.models.length} modèle(s) disponible(s)
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
              title="Synchroniser les modèles"
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
            <p className="mb-2 text-xs font-medium text-slate-500">Modèles:</p>
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
                  +{provider.models.length - 5} autres
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
  const {
    settings,
    updateTaskConfig,
    getModelsForTask,
    getTaskConfig,
    isSaving,
  } = useAISettings();
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
      <div>
        <h3 className="text-lg font-semibold text-slate-900">
          Configuration des Modèles
        </h3>
        <p className="text-sm text-slate-500">
          Assignez un provider et un modèle pour chaque type de tâche IA.
        </p>
      </div>

      {!hasProviders ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Server className="w-12 h-12 mb-4 text-slate-300" />
            <p className="text-center text-slate-500">
              Vous devez d'abord configurer au moins un provider
              <br />
              dans l'onglet "Providers IA".
            </p>
          </CardContent>
        </Card>
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
    </div>
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

  // Fallback models
  const suggestedFallbackModels =
    selectedFallbackProvider?.models.filter((m) =>
      m.capabilities.includes(taskType),
    ) || [];
  const otherFallbackModels =
    selectedFallbackProvider?.models.filter(
      (m) => !m.capabilities.includes(taskType),
    ) || [];

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
    const provider = providers.find((p) => p.id === providerId);
    const firstModel = provider?.models.find((m) =>
      m.capabilities.includes(taskType),
    );
    onUpdate(
      providerId,
      firstModel?.id || null,
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
    const provider = providers.find((p) => p.id === providerId);
    const firstModel = provider?.models.find((m) =>
      m.capabilities.includes(taskType),
    );
    onUpdate(
      config?.providerId || null,
      config?.modelId || null,
      providerId,
      firstModel?.id || null,
    );
  };

  const isConfigured = config?.providerId && config?.modelId;
  const isFallbackConfigured =
    config?.fallbackProviderId && config?.fallbackModelId;

  // Build provider option groups
  const providerOptionGroups: SelectOptionGroup[] = [];
  if (suggestedProviders.length > 0) {
    providerOptionGroups.push({
      label: "✓ Suggérés (modèles compatibles)",
      options: suggestedProviders.map((p) => ({
        value: p.id,
        label: p.name,
      })),
    });
  }
  if (otherProviders.length > 0) {
    providerOptionGroups.push({
      label: "Autres providers",
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
      label: "✓ Suggérés pour cette tâche",
      options: suggestedModels.map((m) => ({
        value: m.id,
        label: m.name,
      })),
    });
  }
  if (otherModels.length > 0) {
    modelOptionGroups.push({
      label: "Autres modèles",
      options: otherModels.map((m) => ({
        value: m.id,
        label: m.name,
      })),
    });
  }

  // Build fallback provider option groups
  const fallbackProviderOptionGroups: SelectOptionGroup[] = [];
  if (suggestedProviders.length > 0) {
    fallbackProviderOptionGroups.push({
      label: "✓ Suggérés (modèles compatibles)",
      options: suggestedProviders.map((p) => ({
        value: p.id,
        label: p.name,
      })),
    });
  }
  if (otherProviders.length > 0) {
    fallbackProviderOptionGroups.push({
      label: "Autres providers",
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
      label: "✓ Suggérés pour cette tâche",
      options: suggestedFallbackModels.map((m) => ({
        value: m.id,
        label: m.name,
      })),
    });
  }
  if (otherFallbackModels.length > 0) {
    fallbackModelOptionGroups.push({
      label: "Autres modèles",
      options: otherFallbackModels.map((m) => ({
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
                  Configuré
                </span>
              ) : (
                <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700">
                  Non configuré
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500">{taskInfo.description}</p>

            {/* Primary Configuration */}
            <div className="p-3 mt-4 rounded-lg bg-slate-50">
              <h5 className="mb-3 text-sm font-medium text-slate-700">
                Configuration Primaire
              </h5>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Provider</Label>
                  <Select
                    value={config?.providerId || ""}
                    onChange={(e) => handleProviderChange(e.target.value)}
                    disabled={isSaving}
                    placeholder="Sélectionner un provider"
                    options={[{ value: "", label: "Aucun" }]}
                    optionGroups={providerOptionGroups}
                  />
                  {suggestedProviders.length === 0 &&
                    enabledProviders.length > 0 && (
                      <p className="text-xs text-amber-600">
                        Aucun provider suggéré pour cette tâche, mais vous
                        pouvez choisir n'importe lequel
                      </p>
                    )}
                  {enabledProviders.length === 0 && (
                    <p className="text-xs text-amber-600">
                      Aucun provider actif disponible
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Modèle</Label>
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
                    placeholder="Sélectionner un modèle"
                    options={[{ value: "", label: "Aucun" }]}
                    optionGroups={modelOptionGroups}
                  />
                  {selectedProvider &&
                    suggestedModels.length === 0 &&
                    otherModels.length > 0 && (
                      <p className="text-xs text-amber-600">
                        Aucun modèle suggéré, mais vous pouvez utiliser
                        n'importe quel modèle
                      </p>
                    )}
                </div>
              </div>
            </div>

            {/* Fallback Configuration */}
            <div className="p-3 mt-4 border border-dashed rounded-lg bg-slate-50 border-slate-300">
              <h5 className="mb-3 text-sm font-medium text-slate-700">
                ⚡ Configuration de Secours
              </h5>
              <p className="mb-3 text-xs text-slate-500">
                Utilisé automatiquement en cas d'échec du provider primaire
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Provider de Secours</Label>
                  <Select
                    value={config?.fallbackProviderId || ""}
                    onChange={(e) =>
                      handleFallbackProviderChange(e.target.value)
                    }
                    disabled={isSaving}
                    placeholder="Sélectionner un provider"
                    options={[{ value: "", label: "Aucun" }]}
                    optionGroups={fallbackProviderOptionGroups}
                  />
                  {isFallbackConfigured && (
                    <p className="text-xs text-green-600">
                      ✓ Fallback configuré
                    </p>
                  )}
                  {!isFallbackConfigured && (
                    <p className="text-xs text-amber-600">
                      Optionnel : configurez un fallback pour plus de résilience
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Modèle de Secours</Label>
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
                    placeholder="Sélectionner un modèle"
                    options={[{ value: "", label: "Aucun" }]}
                    optionGroups={fallbackModelOptionGroups}
                  />
                  {selectedFallbackProvider &&
                    suggestedFallbackModels.length === 0 &&
                    otherFallbackModels.length > 0 && (
                      <p className="text-xs text-amber-600">
                        Aucun modèle suggéré, mais vous pouvez utiliser
                        n'importe quel modèle
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
        err instanceof Error ? err.message : "Erreur lors de la sauvegarde",
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
          Écoute Continue
        </h3>
        <p className="text-sm text-slate-500">
          Configurez le mode d'écoute en continu pour capturer automatiquement
          vos pensées et commandes.
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
            Mot d'Activation (Wake Word)
          </CardTitle>
          <CardDescription>
            Le mot ou la phrase qui déclenche le mode commande
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="wakeWord">Mot d'activation</Label>
              <Input
                id="wakeWord"
                value={formState.wakeWord}
                onChange={(e) =>
                  setFormState({ ...formState, wakeWord: e.target.value })
                }
                placeholder="Hey Brain"
              />
              <p className="text-xs text-slate-500">
                Dites ce mot avant une commande pour que le système réponde
                activement
              </p>
            </div>

            <div className="space-y-2">
              <Label>
                Sensibilité ({(formState.wakeWordSensitivity * 100).toFixed(0)}
                %)
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
                Augmentez pour détecter plus de variations du mot d'activation
              </p>
            </div>
          </div>

          {/* Test Wake Word */}
          <div className="p-4 space-y-3 rounded-lg bg-slate-50">
            <Label>Tester le mot d'activation</Label>
            <div className="flex gap-2">
              <Input
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                placeholder={`Ex: ${formState.wakeWord} quelle heure est-il ?`}
                className="flex-1"
              />
              <Button onClick={handleTestWakeWord} variant="outline">
                <Play className="w-4 h-4 mr-2" />
                Tester
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
                        Wake word détecté !
                      </p>
                      <p className="text-sm text-green-600">
                        Commande extraite : "
                        {testResult.remainingText || "(vide)"}"
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <X className="w-5 h-5 text-orange-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-orange-700">
                        Wake word non détecté
                      </p>
                      <p className="text-sm text-orange-600">
                        Ce texte sera traité comme observation passive
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
            Traitement Audio
          </CardTitle>
          <CardDescription>
            Paramètres de détection de voix et de silence
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label>
                Sensibilité VAD ({(formState.vadSensitivity * 100).toFixed(0)}%)
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
                Détection d'activité vocale : plus sensible = détecte les voix
                faibles
              </p>
            </div>

            <div className="space-y-2">
              <Label>Délai de silence ({formState.silenceDetectionMs}ms)</Label>
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
                Durée de silence avant de considérer la phrase terminée
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
            Identification du Locuteur
          </CardTitle>
          <CardDescription>
            Paramètres pour reconnaître votre voix parmi d'autres
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>
              Seuil de confiance (
              {(formState.speakerConfidenceThreshold * 100).toFixed(0)}%)
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
              Niveau de certitude requis pour confirmer que c'est bien vous qui
              parlez. Un seuil plus bas accepte plus de variantes de votre voix.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Memory Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sliders className="w-5 h-5" />
            Seuil de Pertinence
          </CardTitle>
          <CardDescription>
            Contrôle ce qui est enregistré en mémoire passive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>
              Importance minimum (
              {(formState.minImportanceThreshold * 100).toFixed(0)}%)
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
              Seules les paroles jugées pertinentes au-dessus de ce seuil seront
              mémorisées. Un seuil bas capture plus d'informations, un seuil
              haut est plus sélectif.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="w-5 h-5" />
            Notifications
          </CardTitle>
          <CardDescription>
            Paramètres des alertes visuelles et sonores
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Mémoire enregistrée</Label>
              <p className="text-sm text-slate-500">
                Notifier quand une parole est sauvegardée en mémoire
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
              <Label className="text-base">Commande détectée</Label>
              <p className="text-sm text-slate-500">
                Notifier quand le wake word est reconnu
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
              Sauvegarde...
            </>
          ) : (
            <>
              <Check className="w-4 h-4 mr-2" />
              Sauvegarder
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
