import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { Switch } from "../components/ui/switch";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import {
  Wrench,
  Server,
  ShoppingBag,
  Plus,
  Settings,
  Trash2,
  Power,
  PowerOff,
  Download,
  Check,
  Star,
  RefreshCw,
  ExternalLink,
} from "lucide-react";

// ==================== Types ====================

interface BuiltinTool {
  id: string;
  name: string;
  category: string;
  enabled: boolean;
  rateLimit: number;
  timeout: number;
  config: {
    description: string;
    actions: string[];
  };
}

interface MCPServer {
  id: string;
  name: string;
  description?: string;
  transportType: "STDIO" | "HTTP" | "SSE";
  command?: string;
  args: string[];
  env: Record<string, string>;
  url?: string;
  enabled: boolean;
  isConnected: boolean;
  lastConnected?: string;
  lastError?: string;
  availableTools: any[];
  serverInfo: any;
}

interface MarketplaceTool {
  slug: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  author: string;
  version: string;
  configSchema?: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
  tags: string[];
  rating: number;
  installs: number;
}

interface InstalledTool {
  id: string;
  toolSlug: string;
  config: Record<string, any>;
  enabled: boolean;
  installedAt: string;
}

interface UserToolConfig {
  id: string;
  toolId: string;
  enabled: boolean;
  config: Record<string, any>;
  rateLimit?: number;
  timeout?: number;
}

interface GeneratedTool {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: string;
  tags: string[];
  requiredSecrets: string[];
  usageCount: number;
  lastUsedAt?: string;
  enabled: boolean;
  isVerified: boolean;
  version: string;
  createdAt: string;
  updatedAt: string;
}

// ==================== API Helpers ====================

const API_BASE = `${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api`;

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem("authToken");

  if (!token) {
    throw new Error("Authentication required. Please log in first.");
  }

  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type");
    let error = "Request failed";

    if (contentType?.includes("application/json")) {
      try {
        const data = await response.json();
        error = data.error || `HTTP ${response.status}`;
      } catch (e) {
        error = `HTTP ${response.status}: ${response.statusText}`;
      }
    } else {
      error = `HTTP ${response.status}: ${response.statusText}`;
    }

    throw new Error(error);
  }

  const contentType = response.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    throw new Error(
      "Server returned non-JSON response. API endpoints may not be implemented.",
    );
  }

  return response.json();
}

// ==================== Main Component ====================

export function ToolsConfigPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("builtin");

  // State for built-in tools
  const [builtinTools, setBuiltinTools] = useState<BuiltinTool[]>([]);
  const [toolConfigs, setToolConfigs] = useState<UserToolConfig[]>([]);

  // State for MCP servers
  const [mcpServers, setMcpServers] = useState<MCPServer[]>([]);
  const [showAddMCP, setShowAddMCP] = useState(false);
  const [editingMCP, setEditingMCP] = useState<MCPServer | null>(null);

  // State for marketplace
  const [marketplaceCatalog, setMarketplaceCatalog] = useState<
    MarketplaceTool[]
  >([]);
  const [installedTools, setInstalledTools] = useState<InstalledTool[]>([]);
  const [installingTool, setInstallingTool] = useState<string | null>(null);
  const [configuringTool, setConfiguringTool] =
    useState<MarketplaceTool | null>(null);
  const [toolConfig, setToolConfig] = useState<Record<string, string>>({});

  // State for generated tools
  const [generatedTools, setGeneratedTools] = useState<GeneratedTool[]>([]);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ==================== Data Fetching ====================

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      const [
        toolsRes,
        configsRes,
        mcpRes,
        catalogRes,
        installedRes,
        generatedRes,
      ] = await Promise.all([
        fetchWithAuth("/tools"),
        fetchWithAuth("/tools/config"),
        fetchWithAuth("/tools/mcp"),
        fetchWithAuth("/tools/marketplace"),
        fetchWithAuth("/tools/marketplace-installed"),
        fetchWithAuth("/generated-tools"),
      ]);

      setBuiltinTools(toolsRes.tools || []);
      setToolConfigs(configsRes.configs || []);
      setMcpServers(mcpRes.servers || []);
      setMarketplaceCatalog(catalogRes.catalog || []);
      setInstalledTools(installedRes.installed || []);
      setGeneratedTools(generatedRes.tools || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ==================== Built-in Tools Handlers ====================

  async function toggleBuiltinTool(toolId: string, enabled: boolean) {
    try {
      await fetchWithAuth(`/tools/config/${toolId}`, {
        method: "PUT",
        body: JSON.stringify({ enabled }),
      });

      setToolConfigs((prev) => {
        const existing = prev.find((c) => c.toolId === toolId);
        if (existing) {
          return prev.map((c) => (c.toolId === toolId ? { ...c, enabled } : c));
        }
        return [...prev, { id: "", toolId, enabled, config: {} }];
      });
    } catch (err: any) {
      setError(err.message);
    }
  }

  function isToolEnabled(toolId: string): boolean {
    const config = toolConfigs.find((c) => c.toolId === toolId);
    return config?.enabled ?? true; // Default to enabled
  }

  // ==================== MCP Server Handlers ====================

  async function createMCPServer(data: Partial<MCPServer>) {
    try {
      const res = await fetchWithAuth("/tools/mcp", {
        method: "POST",
        body: JSON.stringify(data),
      });

      setMcpServers((prev) => [...prev, res.server]);
      setShowAddMCP(false);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function updateMCPServer(id: string, data: Partial<MCPServer>) {
    try {
      const res = await fetchWithAuth(`/tools/mcp/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });

      setMcpServers((prev) => prev.map((s) => (s.id === id ? res.server : s)));
      setEditingMCP(null);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function deleteMCPServer(id: string) {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce serveur MCP ?")) return;

    try {
      await fetchWithAuth(`/tools/mcp/${id}`, { method: "DELETE" });
      setMcpServers((prev) => prev.filter((s) => s.id !== id));
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function toggleMCPServer(id: string, enabled: boolean) {
    try {
      await fetchWithAuth(`/tools/mcp/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
      });

      setMcpServers((prev) =>
        prev.map((s) => (s.id === id ? { ...s, enabled } : s)),
      );
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function connectMCPServer(id: string) {
    try {
      await fetchWithAuth(`/tools/mcp/${id}/connect`, { method: "POST" });
      setMcpServers((prev) =>
        prev.map((s) => (s.id === id ? { ...s, isConnected: true } : s)),
      );
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function disconnectMCPServer(id: string) {
    try {
      await fetchWithAuth(`/tools/mcp/${id}/disconnect`, { method: "POST" });
      setMcpServers((prev) =>
        prev.map((s) => (s.id === id ? { ...s, isConnected: false } : s)),
      );
    } catch (err: any) {
      setError(err.message);
    }
  }

  // ==================== Marketplace Handlers ====================

  function isToolInstalled(slug: string): boolean {
    return installedTools.some((t) => t.toolSlug === slug);
  }

  async function installTool(
    tool: MarketplaceTool,
    config: Record<string, string>,
  ) {
    setInstallingTool(tool.slug);

    try {
      await fetchWithAuth(`/tools/marketplace/${tool.slug}/install`, {
        method: "POST",
        body: JSON.stringify({ config }),
      });

      await loadData(); // Reload to get updated state
      setConfiguringTool(null);
      setToolConfig({});
    } catch (err: any) {
      setError(err.message);
    } finally {
      setInstallingTool(null);
    }
  }

  async function uninstallTool(slug: string) {
    if (!confirm("Êtes-vous sûr de vouloir désinstaller cet outil ?")) return;

    try {
      await fetchWithAuth(`/tools/marketplace/${slug}`, { method: "DELETE" });
      setInstalledTools((prev) => prev.filter((t) => t.toolSlug !== slug));
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  // ==================== Generated Tools Handlers ====================

  async function toggleGeneratedTool(toolId: string, enabled: boolean) {
    try {
      await fetchWithAuth(`/generated-tools/${toolId}/toggle`, {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
      });

      setGeneratedTools((prev) =>
        prev.map((t) => (t.id === toolId ? { ...t, enabled } : t)),
      );
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function deleteGeneratedTool(toolId: string) {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cet outil généré ?"))
      return;

    try {
      await fetchWithAuth(`/generated-tools/${toolId}`, { method: "DELETE" });
      setGeneratedTools((prev) => prev.filter((t) => t.id !== toolId));
    } catch (err: any) {
      setError(err.message);
    }
  }

  // ==================== Render ====================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  // Show placeholder if API not available
  if (
    error &&
    error.includes("HTTP") &&
    !builtinTools.length &&
    !mcpServers.length
  ) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">
              Configuration des Outils
            </h2>
            <p className="mt-1 text-slate-600">
              Gérez les outils intégrés, serveurs MCP et outils du marketplace
            </p>
          </div>
        </div>

        <div className="p-6 text-center bg-white border rounded-lg shadow border-slate-200">
          <div className="mb-4 text-5xl">⚙️</div>
          <h3 className="mb-2 text-lg font-semibold text-slate-900">
            Service Tools Indisponible
          </h3>
          <p className="mb-4 text-slate-600">
            Les endpoints de configuration des outils ne sont pas encore
            disponibles.
          </p>
          <div className="inline-block p-4 text-sm text-left rounded text-slate-500 bg-slate-50">
            <p className="font-mono text-red-600">{error}</p>
          </div>
          <Button
            onClick={loadData}
            variant="outline"
            size="sm"
            className="mt-4"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Réessayer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">
            Configuration des Outils
          </h2>
          <p className="mt-1 text-slate-600">
            Gérez les outils intégrés, serveurs MCP et outils du marketplace
          </p>
        </div>
        <Button onClick={loadData} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualiser
        </Button>
      </div>

      {error && (
        <div className="px-4 py-3 text-red-700 border border-red-200 rounded-lg bg-red-50">
          <div className="mb-2 font-semibold">⚠️ Erreur</div>
          <p className="mb-2 text-sm">{error}</p>
          {error.includes("non-JSON") && (
            <p className="mt-2 text-xs text-red-600">
              💡 <strong>Conseil:</strong> Les endpoints API pour les outils ne
              sont pas encore implémentés dans le backend. Vérifiez que le
              serveur backend est en cours d'exécution et que les routes sont
              définies dans{" "}
              <code className="px-1 bg-red-100 rounded">
                backend/controllers/tools.controller.ts
              </code>
            </p>
          )}
          <button
            onClick={() => setError(null)}
            className="mt-2 ml-4 text-sm underline"
          >
            Fermer
          </button>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="builtin" className="flex items-center gap-2">
            <Wrench className="w-4 h-4" />
            <span className="hidden sm:inline">Outils Intégrés</span>
            <span className="sm:hidden">Intégrés</span>
          </TabsTrigger>
          <TabsTrigger value="mcp" className="flex items-center gap-2">
            <Server className="w-4 h-4" />
            <span className="hidden sm:inline">Serveurs MCP</span>
            <span className="sm:hidden">MCP</span>
          </TabsTrigger>
          <TabsTrigger value="marketplace" className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4" />
            Marketplace
          </TabsTrigger>
          <TabsTrigger value="generated" className="flex items-center gap-2">
            <Star className="w-4 h-4" />
            <span className="hidden sm:inline">Outils Générés</span>
            <span className="sm:hidden">Générés</span>
          </TabsTrigger>
        </TabsList>

        {/* Built-in Tools Tab */}
        <TabsContent value="builtin">
          <div className="grid gap-4 md:grid-cols-2">
            {builtinTools.map((tool) => (
              <Card key={tool.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{tool.name}</CardTitle>
                    <Switch
                      checked={isToolEnabled(tool.id)}
                      onCheckedChange={(checked) =>
                        toggleBuiltinTool(tool.id, checked)
                      }
                    />
                  </div>
                  <CardDescription>{tool.config.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1">
                    {tool.config.actions.slice(0, 5).map((action) => (
                      <Badge key={action} variant="secondary">
                        {action}
                      </Badge>
                    ))}
                    {tool.config.actions.length > 5 && (
                      <Badge variant="outline">
                        +{tool.config.actions.length - 5}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-3 text-xs text-slate-500">
                    Rate limit: {tool.rateLimit}/min • Timeout: {tool.timeout}ms
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* MCP Servers Tab */}
        <TabsContent value="mcp">
          <div className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={showAddMCP} onOpenChange={setShowAddMCP}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Ajouter un serveur MCP
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <MCPServerForm
                    onSubmit={createMCPServer}
                    onCancel={() => setShowAddMCP(false)}
                  />
                </DialogContent>
              </Dialog>
            </div>

            {mcpServers.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Server className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                  <p className="text-slate-500">Aucun serveur MCP configuré</p>
                  <p className="mt-2 text-sm text-slate-400">
                    Ajoutez un serveur MCP pour étendre les capacités de votre
                    assistant
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {mcpServers.map((server) => (
                  <Card key={server.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <CardTitle className="text-lg">
                            {server.name}
                          </CardTitle>
                          {server.isConnected ? (
                            <Badge variant="success">Connecté</Badge>
                          ) : server.enabled ? (
                            <Badge variant="warning">Déconnecté</Badge>
                          ) : (
                            <Badge variant="secondary">Désactivé</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={server.enabled}
                            onCheckedChange={(checked) =>
                              toggleMCPServer(server.id, checked)
                            }
                          />
                        </div>
                      </div>
                      {server.description && (
                        <CardDescription>{server.description}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1 text-sm text-slate-600">
                        <p>
                          <strong>Transport:</strong> {server.transportType}
                        </p>
                        {server.command && (
                          <p>
                            <strong>Commande:</strong>{" "}
                            <code className="px-1 rounded bg-slate-100">
                              {server.command} {server.args.join(" ")}
                            </code>
                          </p>
                        )}
                        {server.url && (
                          <p>
                            <strong>URL:</strong> {server.url}
                          </p>
                        )}
                        {server.lastError && (
                          <p className="text-red-600">
                            <strong>Erreur:</strong> {server.lastError}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 mt-4">
                        {server.enabled && !server.isConnected && (
                          <Button
                            size="sm"
                            onClick={() => connectMCPServer(server.id)}
                          >
                            <Power className="w-4 h-4 mr-1" />
                            Connecter
                          </Button>
                        )}
                        {server.isConnected && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => disconnectMCPServer(server.id)}
                          >
                            <PowerOff className="w-4 h-4 mr-1" />
                            Déconnecter
                          </Button>
                        )}
                        <Dialog
                          open={editingMCP?.id === server.id}
                          onOpenChange={(open) => !open && setEditingMCP(null)}
                        >
                          <DialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingMCP(server)}
                            >
                              <Settings className="w-4 h-4 mr-1" />
                              Configurer
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <MCPServerForm
                              server={server}
                              onSubmit={(data) =>
                                updateMCPServer(server.id, data)
                              }
                              onCancel={() => setEditingMCP(null)}
                            />
                          </DialogContent>
                        </Dialog>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteMCPServer(server.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Supprimer
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Marketplace Tab */}
        <TabsContent value="marketplace">
          <div className="space-y-6">
            {/* Installed tools section */}
            {installedTools.length > 0 && (
              <div>
                <h3 className="mb-3 text-lg font-semibold">Outils installés</h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {installedTools.map((installed) => {
                    const tool = marketplaceCatalog.find(
                      (t) => t.slug === installed.toolSlug,
                    );
                    if (!tool) return null;

                    return (
                      <Card key={installed.id}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-2xl">{tool.icon}</span>
                              <CardTitle className="text-lg">
                                {tool.name}
                              </CardTitle>
                            </div>
                            <Badge variant="success">
                              <Check className="w-3 h-3 mr-1" />
                              Installé
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="mb-3 text-sm text-slate-600">
                            {tool.description}
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => uninstallTool(installed.toolSlug)}
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Désinstaller
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Available tools */}
            <div>
              <h3 className="mb-3 text-lg font-semibold">Outils disponibles</h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {marketplaceCatalog
                  .filter((tool) => !isToolInstalled(tool.slug))
                  .map((tool) => (
                    <Card
                      key={tool.slug}
                      className="transition-shadow hover:shadow-md"
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{tool.icon}</span>
                            <div>
                              <CardTitle className="text-lg">
                                {tool.name}
                              </CardTitle>
                              <p className="text-xs text-slate-400">
                                par {tool.author}
                              </p>
                            </div>
                          </div>
                          <Badge variant="outline">{tool.category}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="mb-3 text-sm text-slate-600">
                          {tool.description}
                        </p>

                        <div className="flex flex-wrap gap-1 mb-3">
                          {tool.tags.slice(0, 3).map((tag) => (
                            <Badge
                              key={tag}
                              variant="secondary"
                              className="text-xs"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>

                        <div className="flex items-center justify-between mb-4 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                            {tool.rating}
                          </span>
                          <span className="flex items-center gap-1">
                            <Download className="w-3 h-3" />
                            {tool.installs.toLocaleString()}
                          </span>
                          <span>v{tool.version}</span>
                        </div>

                        <Dialog
                          open={configuringTool?.slug === tool.slug}
                          onOpenChange={(open) => {
                            if (!open) {
                              setConfiguringTool(null);
                              setToolConfig({});
                            }
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button
                              className="w-full"
                              onClick={() => {
                                setConfiguringTool(tool);
                                // Initialize config with empty values
                                if (tool.configSchema?.properties) {
                                  const initial: Record<string, string> = {};
                                  Object.keys(
                                    tool.configSchema.properties,
                                  ).forEach((key) => {
                                    initial[key] = "";
                                  });
                                  setToolConfig(initial);
                                }
                              }}
                              disabled={installingTool === tool.slug}
                            >
                              {installingTool === tool.slug ? (
                                <>
                                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                  Installation...
                                </>
                              ) : (
                                <>
                                  <Download className="w-4 h-4 mr-2" />
                                  Installer
                                </>
                              )}
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-2">
                                <span className="text-2xl">{tool.icon}</span>
                                Installer {tool.name}
                              </DialogTitle>
                              <DialogDescription>
                                Configurez les paramètres requis pour installer
                                cet outil
                              </DialogDescription>
                            </DialogHeader>

                            {tool.configSchema?.properties &&
                            Object.keys(tool.configSchema.properties).length >
                              0 ? (
                              <div className="space-y-4">
                                {Object.entries(
                                  tool.configSchema.properties,
                                ).map(([key, schema]: [string, any]) => (
                                  <div key={key} className="space-y-2">
                                    <Label htmlFor={key}>
                                      {key}
                                      {tool.configSchema?.required?.includes(
                                        key,
                                      ) && (
                                        <span className="ml-1 text-red-500">
                                          *
                                        </span>
                                      )}
                                    </Label>
                                    <Input
                                      id={key}
                                      type={schema.secret ? "password" : "text"}
                                      placeholder={schema.description}
                                      value={toolConfig[key] || ""}
                                      onChange={(e) =>
                                        setToolConfig({
                                          ...toolConfig,
                                          [key]: e.target.value,
                                        })
                                      }
                                    />
                                    {schema.description && (
                                      <p className="text-xs text-slate-500">
                                        {schema.description}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-slate-600">
                                Aucune configuration requise pour cet outil.
                              </p>
                            )}

                            <DialogFooter>
                              <Button
                                variant="outline"
                                onClick={() => setConfiguringTool(null)}
                              >
                                Annuler
                              </Button>
                              <Button
                                onClick={() => installTool(tool, toolConfig)}
                                disabled={installingTool === tool.slug}
                              >
                                {installingTool === tool.slug ? (
                                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                  <Download className="w-4 h-4 mr-2" />
                                )}
                                Installer
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Generated Tools Tab */}
        <TabsContent value="generated">
          <div className="space-y-4">
            {generatedTools.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Star className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                  <p className="text-slate-500">
                    Aucun outil généré pour le moment
                  </p>
                  <p className="mt-2 text-sm text-slate-400">
                    Les outils générés par l'IA apparaîtront ici une fois créés
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {generatedTools.map((tool) => (
                  <Card key={tool.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <CardTitle className="flex items-center gap-2 text-lg">
                            {tool.displayName}
                            {tool.isVerified && (
                              <Check className="w-4 h-4 text-green-600" />
                            )}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {tool.description}
                          </CardDescription>
                        </div>
                        <Switch
                          checked={tool.enabled}
                          onCheckedChange={(checked) =>
                            toggleGeneratedTool(tool.id, checked)
                          }
                        />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline">{tool.category}</Badge>
                        {tool.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="secondary">
                            {tag}
                          </Badge>
                        ))}
                        {tool.tags.length > 3 && (
                          <Badge variant="outline">
                            +{tool.tags.length - 3}
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm text-slate-600">
                        <div>
                          <span className="font-medium">Version:</span> v
                          {tool.version}
                        </div>
                        <div>
                          <span className="font-medium">Utilisations:</span>{" "}
                          {tool.usageCount}
                        </div>
                        <div className="col-span-2">
                          <span className="font-medium">Créé le:</span>{" "}
                          {new Date(tool.createdAt).toLocaleDateString("fr-FR")}
                        </div>
                        {tool.lastUsedAt && (
                          <div className="col-span-2">
                            <span className="font-medium">
                              Dernière utilisation:
                            </span>{" "}
                            {new Date(tool.lastUsedAt).toLocaleDateString(
                              "fr-FR",
                            )}
                          </div>
                        )}
                      </div>

                      {tool.requiredSecrets.length > 0 && (
                        <div className="pt-2 border-t">
                          <p className="mb-1 text-xs font-medium text-slate-700">
                            Secrets requis:
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {tool.requiredSecrets.map((secret) => (
                              <Badge
                                key={secret}
                                variant="outline"
                                className="text-xs"
                              >
                                {secret}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            // Copier l'ID du tool
                            navigator.clipboard.writeText(tool.id);
                          }}
                        >
                          <Check className="w-3 h-3 mr-1" />
                          Copier ID
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-red-600 border-red-200 hover:text-red-700 hover:bg-red-50"
                          onClick={() => deleteGeneratedTool(tool.id)}
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Supprimer
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ==================== MCP Server Form ====================

interface MCPServerFormProps {
  server?: MCPServer;
  onSubmit: (data: Partial<MCPServer>) => void;
  onCancel: () => void;
}

function MCPServerForm({ server, onSubmit, onCancel }: MCPServerFormProps) {
  const [name, setName] = useState(server?.name || "");
  const [description, setDescription] = useState(server?.description || "");
  const [transportType, setTransportType] = useState<"STDIO" | "HTTP" | "SSE">(
    server?.transportType || "STDIO",
  );
  const [command, setCommand] = useState(server?.command || "");
  const [args, setArgs] = useState(server?.args?.join(" ") || "");
  const [envText, setEnvText] = useState(
    server?.env
      ? Object.entries(server.env)
          .map(([k, v]) => `${k}=${v}`)
          .join("\n")
      : "",
  );
  const [url, setUrl] = useState(server?.url || "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Parse env from text
    const env: Record<string, string> = {};
    envText.split("\n").forEach((line) => {
      const [key, ...rest] = line.split("=");
      if (key && rest.length > 0) {
        env[key.trim()] = rest.join("=").trim();
      }
    });

    onSubmit({
      name,
      description: description || undefined,
      transportType,
      command: command || undefined,
      args: args.split(" ").filter(Boolean),
      env,
      url: url || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>
          {server ? "Modifier le serveur MCP" : "Ajouter un serveur MCP"}
        </DialogTitle>
        <DialogDescription>
          Configurez les paramètres de connexion au serveur MCP
        </DialogDescription>
      </DialogHeader>

      <div className="py-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nom *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ex: GitHub MCP"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description du serveur"
          />
        </div>

        <div className="space-y-2">
          <Label>Type de transport</Label>
          <div className="flex gap-2">
            {(["STDIO", "HTTP", "SSE"] as const).map((type) => (
              <Button
                key={type}
                type="button"
                variant={transportType === type ? "default" : "outline"}
                size="sm"
                onClick={() => setTransportType(type)}
              >
                {type}
              </Button>
            ))}
          </div>
        </div>

        {transportType === "STDIO" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="command">Commande *</Label>
              <Input
                id="command"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="ex: npx"
                required={transportType === "STDIO"}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="args">Arguments</Label>
              <Input
                id="args"
                value={args}
                onChange={(e) => setArgs(e.target.value)}
                placeholder="ex: -y @modelcontextprotocol/server-github"
              />
            </div>
          </>
        )}

        {(transportType === "HTTP" || transportType === "SSE") && (
          <div className="space-y-2">
            <Label htmlFor="url">URL *</Label>
            <Input
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="ex: http://localhost:3001"
              required
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="env">Variables d'environnement</Label>
          <Textarea
            id="env"
            value={envText}
            onChange={(e) => setEnvText(e.target.value)}
            placeholder="KEY=value&#10;ANOTHER_KEY=another_value"
            className="font-mono text-sm"
            rows={4}
          />
          <p className="text-xs text-slate-500">
            Une variable par ligne au format KEY=value
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit">{server ? "Enregistrer" : "Ajouter"}</Button>
      </DialogFooter>
    </form>
  );
}
