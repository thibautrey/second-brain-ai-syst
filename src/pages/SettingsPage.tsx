import { useState } from "react";
import {
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Eye,
  EyeOff,
  Server,
} from "lucide-react";
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
import { Select } from "../components/ui/select";
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
        </TabsList>

        <TabsContent value="providers">
          <ProvidersSection />
        </TabsContent>

        <TabsContent value="models">
          <ModelsConfigSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProvidersSection() {
  const { settings, addProvider, updateProvider, deleteProvider, isSaving } =
    useAISettings();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
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
  onEdit,
  onCancelEdit,
  onSave,
  onDelete,
  onToggleEnabled,
  isSaving,
}: {
  provider: AIProvider;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (updates: Partial<ProviderFormData>) => Promise<void>;
  onDelete: () => void;
  onToggleEnabled: (enabled: boolean) => void;
  isSaving: boolean;
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
              <Server className="w-6 h-6 text-white" />
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
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs font-medium text-slate-500 mb-2">Modèles:</p>
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
    "speech-to-text",
    "routing",
    "reflection",
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
              onUpdate={(providerId, modelId) =>
                updateTaskConfig(taskType, providerId, modelId)
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
  onUpdate: (providerId: string | null, modelId: string | null) => void;
  providers: AIProvider[];
  isSaving: boolean;
}) {
  const taskInfo = TASK_LABELS[taskType];
  const selectedProvider = providers.find((p) => p.id === config?.providerId);
  const modelsForProvider =
    selectedProvider?.models.filter((m) => m.capabilities.includes(taskType)) ||
    [];

  const handleProviderChange = (providerId: string) => {
    if (!providerId) {
      onUpdate(null, null);
      return;
    }
    // Auto-select first compatible model when changing provider
    const provider = providers.find((p) => p.id === providerId);
    const firstModel = provider?.models.find((m) =>
      m.capabilities.includes(taskType),
    );
    onUpdate(providerId, firstModel?.id || null);
  };

  const isConfigured = config?.providerId && config?.modelId;

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

            <div className="grid gap-4 mt-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Provider</Label>
                <Select
                  value={config?.providerId || ""}
                  onChange={(e) => handleProviderChange(e.target.value)}
                  disabled={isSaving}
                  placeholder="Sélectionner un provider"
                  options={[
                    { value: "", label: "Aucun" },
                    ...providers
                      .filter((p) => p.isEnabled)
                      .map((p) => ({
                        value: p.id,
                        label: p.name,
                        disabled: !p.models.some((m) =>
                          m.capabilities.includes(taskType),
                        ),
                      })),
                  ]}
                />
                {providers.filter(
                  (p) =>
                    p.isEnabled &&
                    p.models.some((m) => m.capabilities.includes(taskType)),
                ).length === 0 && (
                  <p className="text-xs text-amber-600">
                    Aucun provider actif ne supporte cette tâche
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Modèle</Label>
                <Select
                  value={config?.modelId || ""}
                  onChange={(e) =>
                    onUpdate(config?.providerId || null, e.target.value || null)
                  }
                  disabled={isSaving || !config?.providerId}
                  placeholder="Sélectionner un modèle"
                  options={[
                    { value: "", label: "Aucun" },
                    ...modelsForProvider.map((m) => ({
                      value: m.id,
                      label: m.name,
                    })),
                  ]}
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
