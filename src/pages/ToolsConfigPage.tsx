import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  Check,
  Download,
  ExternalLink,
  Package,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Search,
  Server,
  Settings,
  ShoppingBag,
  Sparkles,
  Star,
  Trash2,
  Wrench,
  Zap,
} from "lucide-react";
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
  RadixSelect as Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../components/ui/tooltip";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { SelfHealDialog } from "../components/tools/SelfHealDialog";
import { Switch } from "../components/ui/switch";
import { Textarea } from "../components/ui/textarea";
import { useAuth } from "../contexts/AuthContext";
import i18n from "../i18n/config";

// ==================== Types ====================

// Skills (Moltbot-style)
interface SkillHubEntry {
  id: string;
  slug: string;
  name: string;
  description: string;
  version: string;
  author: string;
  category: string;
  tags: string[];
  icon?: string;
  sourceType: "BUILTIN" | "HUB" | "WORKSPACE" | "CUSTOM";
  rating: number;
  installs: number;
  metadata?: {
    moltbot?: {
      emoji?: string;
      requires?: {
        env?: string[];
        bins?: string[];
      };
      primaryEnv?: string;
    };
  };
}

interface InstalledSkill {
  id: string;
  skillSlug: string;
  name: string;
  description: string;
  version: string;
  enabled: boolean;
  config: Record<string, any>;
  usageCount: number;
  lastUsedAt?: string;
  installedAt: string;
  frontmatter?: any;
  hubEntry?: SkillHubEntry;
}

interface SkillCategory {
  id: string;
  name: string;
  icon: string;
}

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
  actions?: string[];
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
    throw new Error(i18n.t("toolsConfig.errors.authRequired"));
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
    let error = i18n.t("toolsConfig.errors.requestFailed");

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
    throw new Error(i18n.t("toolsConfig.errors.nonJsonResponse"));
  }

  return response.json();
}

// ==================== Main Component ====================

export function ToolsConfigPage() {
  const { user } = useAuth();
  const { t, i18n: i18nContext } = useTranslation();
  const [activeTab, setActiveTab] = useState("skills");

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

  // State for skills (Moltbot-style)
  const [skillHubCatalog, setSkillHubCatalog] = useState<SkillHubEntry[]>([]);
  const [installedSkills, setInstalledSkills] = useState<InstalledSkill[]>([]);
  const [skillCategories, setSkillCategories] = useState<SkillCategory[]>([]);
  const [installingSkill, setInstallingSkill] = useState<string | null>(null);
  const [skillSearchQuery, setSkillSearchQuery] = useState("");
  const [skillCategoryFilter, setSkillCategoryFilter] = useState<string>("all");

  // State for self-heal dialog
  const [selfHealOpen, setSelfHealOpen] = useState(false);
  const [selfHealToolId, setSelfHealToolId] = useState<string | null>(null);
  const [selfHealToolName, setSelfHealToolName] = useState<string | null>(null);

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
        skillHubRes,
        skillInstalledRes,
        skillCategoriesRes,
      ] = await Promise.all([
        fetchWithAuth("/tools"),
        fetchWithAuth("/tools/config"),
        fetchWithAuth("/tools/mcp"),
        fetchWithAuth("/tools/marketplace"),
        fetchWithAuth("/tools/marketplace-installed"),
        fetchWithAuth("/generated-tools"),
        fetchWithAuth("/skills/hub").catch(() => ({ catalog: [] })),
        fetchWithAuth("/skills/installed").catch(() => ({ skills: [] })),
        fetchWithAuth("/skills/categories").catch(() => ({ categories: [] })),
      ]);

      setBuiltinTools(toolsRes.tools || []);
      setToolConfigs(configsRes.configs || []);
      setMcpServers(mcpRes.servers || []);
      setMarketplaceCatalog(catalogRes.catalog || []);
      setInstalledTools(installedRes.installed || []);
      setGeneratedTools(generatedRes.tools || []);
      setSkillHubCatalog(skillHubRes.catalog || []);
      setInstalledSkills(skillInstalledRes.skills || []);
      setSkillCategories(skillCategoriesRes.categories || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ==================== Skills Handlers ====================

  function isSkillInstalled(slug: string): boolean {
    return installedSkills.some((s) => s.skillSlug === slug);
  }

  function getInstalledSkill(slug: string): InstalledSkill | undefined {
    return installedSkills.find((s) => s.skillSlug === slug);
  }

  async function installSkill(slug: string) {
    setInstallingSkill(slug);
    try {
      await fetchWithAuth(`/skills/install/${slug}`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setInstallingSkill(null);
    }
  }

  async function uninstallSkill(slug: string) {
    if (!confirm(t("skills.confirm.uninstall"))) return;
    try {
      await fetchWithAuth(`/skills/installed/${slug}`, { method: "DELETE" });
      setInstalledSkills((prev) => prev.filter((s) => s.skillSlug !== slug));
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function toggleSkill(slug: string, enabled: boolean) {
    try {
      await fetchWithAuth(`/skills/installed/${slug}/toggle`, {
        method: "POST",
        body: JSON.stringify({ enabled }),
      });
      setInstalledSkills((prev) =>
        prev.map((s) => (s.skillSlug === slug ? { ...s, enabled } : s)),
      );
    } catch (err: any) {
      setError(err.message);
    }
  }

  const filteredSkillsCatalog = skillHubCatalog.filter((skill) => {
    const matchesSearch =
      !skillSearchQuery ||
      skill.name.toLowerCase().includes(skillSearchQuery.toLowerCase()) ||
      skill.description
        .toLowerCase()
        .includes(skillSearchQuery.toLowerCase()) ||
      skill.tags.some((tag) =>
        tag.toLowerCase().includes(skillSearchQuery.toLowerCase()),
      );
    const matchesCategory =
      skillCategoryFilter === "all" || skill.category === skillCategoryFilter;
    return matchesSearch && matchesCategory;
  });

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
    if (!confirm(t("toolsConfig.confirm.deleteMcpServer"))) return;

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
    if (!confirm(t("toolsConfig.confirm.uninstallTool"))) return;

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
    if (!confirm(t("toolsConfig.confirm.deleteGeneratedTool"))) return;

    try {
      await fetchWithAuth(`/generated-tools/${toolId}`, { method: "DELETE" });
      setGeneratedTools((prev) => prev.filter((t) => t.id !== toolId));
    } catch (err: any) {
      setError(err.message);
    }
  }

  function openSelfHealDialog(toolId: string, toolName: string) {
    setSelfHealToolId(toolId);
    setSelfHealToolName(toolName);
    setSelfHealOpen(true);
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
              {t("toolsConfig.title")}
            </h2>
            <p className="mt-1 text-slate-600">{t("toolsConfig.subtitle")}</p>
          </div>
        </div>

        <div className="p-6 text-center bg-white border rounded-lg shadow border-slate-200">
          <div className="mb-4 text-5xl">⚙️</div>
          <h3 className="mb-2 text-lg font-semibold text-slate-900">
            {t("toolsConfig.placeholder.title")}
          </h3>
          <p className="mb-4 text-slate-600">
            {t("toolsConfig.placeholder.subtitle")}
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
            {t("common.retry")}
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
            {t("toolsConfig.title")}
          </h2>
          <p className="mt-1 text-slate-600">{t("toolsConfig.subtitle")}</p>
        </div>
        <Button
          onClick={loadData}
          variant="outline"
          size="sm"
          className="hidden md:inline-flex"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          {t("common.refresh")}
        </Button>
      </div>

      {error && (
        <div className="px-4 py-3 text-red-700 border border-red-200 rounded-lg bg-red-50">
          <div className="mb-2 font-semibold">
            {t("toolsConfig.errors.bannerTitle")}
          </div>
          <p className="mb-2 text-sm">{error}</p>
          {error.includes("non-JSON") && (
            <p className="mt-2 text-xs text-red-600">
              {t("toolsConfig.errors.nonJsonHint")}{" "}
              <code className="px-1 bg-red-100 rounded">
                backend/controllers/tools.controller.ts
              </code>
            </p>
          )}
          <button
            onClick={() => setError(null)}
            className="mt-2 ml-4 text-sm underline"
          >
            {t("common.close")}
          </button>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="w-full overflow-x-auto overflow-y-hidden">
          <TabsList className="inline-flex gap-1">
            <TabsTrigger
              value="skills"
              className="flex items-center gap-2 whitespace-nowrap"
            >
              <Sparkles className="w-4 h-4" />
              <span>{t("skills.tabs.skills")}</span>
            </TabsTrigger>

            <TabsTrigger
              value="builtin"
              className="flex items-center gap-2 whitespace-nowrap"
            >
              <Wrench className="w-4 h-4" />
              <span>{t("toolsConfig.tabs.builtin")}</span>
            </TabsTrigger>

            <TabsTrigger
              value="generated"
              className="flex items-center gap-2 whitespace-nowrap"
            >
              <Star className="w-4 h-4" />
              <span>{t("toolsConfig.tabs.generated")}</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Skills Tab (Moltbot-style) */}
        <TabsContent value="skills">
          <div className="space-y-6">
            {/* Installed Skills Section */}
            <div>
              <h3 className="mb-4 text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Package className="w-5 h-5" />
                {t("skills.installed.title")} ({installedSkills.length})
              </h3>
              {installedSkills.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <Package className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                    <p className="text-slate-500">
                      {t("skills.installed.empty")}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      {t("skills.installed.emptyHint")}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {installedSkills.map((skill) => (
                    <Card
                      key={skill.id}
                      className={!skill.enabled ? "opacity-60" : ""}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">
                              {skill.frontmatter?.metadata?.moltbot?.emoji ||
                                "📦"}
                            </span>
                            <div>
                              <CardTitle className="text-base">
                                {skill.name}
                              </CardTitle>
                              <p className="text-xs text-slate-500">
                                v{skill.version}
                              </p>
                            </div>
                          </div>
                          <Switch
                            checked={skill.enabled}
                            onCheckedChange={(checked) =>
                              toggleSkill(skill.skillSlug, checked)
                            }
                          />
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-sm text-slate-600 line-clamp-2">
                          {skill.description}
                        </p>
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>
                            {t("skills.usageCount", {
                              count: skill.usageCount,
                            })}
                          </span>
                          {skill.lastUsedAt && (
                            <span>
                              {t("skills.lastUsed", {
                                date: new Date(
                                  skill.lastUsedAt,
                                ).toLocaleDateString(i18nContext.language),
                              })}
                            </span>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => uninstallSkill(skill.skillSlug)}
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          {t("skills.uninstall")}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Skill Hub Section */}
            <div>
              <h3 className="mb-4 text-lg font-semibold text-slate-900 flex items-center gap-2">
                <ShoppingBag className="w-5 h-5" />
                {t("skills.hub.title")}
              </h3>

              {/* Search and Filter */}
              <div className="flex flex-col gap-4 mb-4 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute w-4 h-4 text-slate-400 left-3 top-3" />
                  <Input
                    placeholder={t("skills.hub.searchPlaceholder")}
                    value={skillSearchQuery}
                    onChange={(e) => setSkillSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select
                  value={skillCategoryFilter}
                  onValueChange={setSkillCategoryFilter}
                >
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder={t("skills.hub.allCategories")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {t("skills.hub.allCategories")}
                    </SelectItem>
                    {skillCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.icon} {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Skill Cards */}
              {filteredSkillsCatalog.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <Search className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                    <p className="text-slate-500">
                      {t("skills.hub.noResults")}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredSkillsCatalog.map((skill) => {
                    const installed = isSkillInstalled(skill.slug);
                    const installing = installingSkill === skill.slug;
                    return (
                      <Card key={skill.id} className="flex flex-col">
                        <CardHeader className="pb-3">
                          <div className="flex items-start gap-3">
                            <span className="text-3xl">
                              {skill.metadata?.moltbot?.emoji ||
                                skill.icon ||
                                "📦"}
                            </span>
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-base flex items-center gap-2">
                                {skill.name}
                                {skill.sourceType === "BUILTIN" && (
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {t("skills.builtin")}
                                  </Badge>
                                )}
                              </CardTitle>
                              <p className="text-xs text-slate-500">
                                {t("skills.byAuthor", { author: skill.author })}{" "}
                                · v{skill.version}
                              </p>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="flex-1 space-y-3">
                          <p className="text-sm text-slate-600 line-clamp-3">
                            {skill.description}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {skill.tags.slice(0, 3).map((tag) => (
                              <Badge
                                key={tag}
                                variant="outline"
                                className="text-xs"
                              >
                                {tag}
                              </Badge>
                            ))}
                            {skill.tags.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{skill.tags.length - 3}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <Download className="w-3 h-3" />
                              {skill.installs}
                            </span>
                            {skill.rating > 0 && (
                              <span className="flex items-center gap-1">
                                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                {skill.rating.toFixed(1)}
                              </span>
                            )}
                          </div>
                          {skill.metadata?.moltbot?.requires?.env && (
                            <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                              {t("skills.requiresEnv")}:{" "}
                              {skill.metadata.moltbot.requires.env.join(", ")}
                            </div>
                          )}
                        </CardContent>
                        <div className="p-4 pt-0">
                          {installed ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                              disabled
                            >
                              <Check className="w-4 h-4 mr-2" />
                              {t("skills.installed.badge")}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              className="w-full"
                              onClick={() => installSkill(skill.slug)}
                              disabled={installing}
                            >
                              {installing ? (
                                <>
                                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                  {t("skills.installing")}
                                </>
                              ) : (
                                <>
                                  <Download className="w-4 h-4 mr-2" />
                                  {t("skills.install")}
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

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
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="cursor-help">
                            +{tool.config.actions.length - 5}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="space-y-1">
                            {tool.config.actions.slice(5).map((action) => (
                              <div key={action}>{action}</div>
                            ))}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
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
                    {t("toolsConfig.generated.emptyTitle")}
                  </p>
                  <p className="mt-2 text-sm text-slate-400">
                    {t("toolsConfig.generated.emptySubtitle")}
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
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="cursor-help">
                                +{tool.tags.length - 3}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="space-y-1">
                                {tool.tags.slice(3).map((tag) => (
                                  <div key={tag}>{tag}</div>
                                ))}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>

                      {tool.actions && tool.actions.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          <span className="text-xs font-medium text-slate-600">
                            {t("toolsConfig.generated.actionsLabel")}
                          </span>
                          {tool.actions.slice(0, 2).map((action) => (
                            <Badge
                              key={action}
                              variant="secondary"
                              className="text-xs"
                            >
                              {action}
                            </Badge>
                          ))}
                          {tool.actions.length > 2 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge
                                  variant="outline"
                                  className="cursor-help text-xs"
                                >
                                  +{tool.actions.length - 2}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="space-y-1">
                                  {tool.actions.slice(2).map((action) => (
                                    <div key={action}>{action}</div>
                                  ))}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2 text-sm text-slate-600">
                        <div>
                          <span className="font-medium">
                            {t("toolsConfig.generated.versionLabel")}
                          </span>{" "}
                          v{tool.version}
                        </div>
                        <div>
                          <span className="font-medium">
                            {t("toolsConfig.generated.usageLabel")}
                          </span>{" "}
                          {tool.usageCount}
                        </div>
                        <div className="col-span-2">
                          <span className="font-medium">
                            {t("toolsConfig.generated.createdAtLabel")}
                          </span>{" "}
                          {new Date(tool.createdAt).toLocaleDateString(
                            i18nContext.language,
                          )}
                        </div>
                        {tool.lastUsedAt && (
                          <div className="col-span-2">
                            <span className="font-medium">
                              {t("toolsConfig.generated.lastUsedLabel")}
                            </span>{" "}
                            {new Date(tool.lastUsedAt).toLocaleDateString(
                              i18nContext.language,
                            )}
                          </div>
                        )}
                      </div>

                      {tool.requiredSecrets.length > 0 && (
                        <div className="pt-2 border-t">
                          <p className="mb-1 text-xs font-medium text-slate-700">
                            {t("toolsConfig.generated.requiredSecretsLabel")}
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
                          {t("toolsConfig.generated.copyId")}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-yellow-600 border-yellow-200 hover:text-yellow-700 hover:bg-yellow-50"
                          onClick={() =>
                            openSelfHealDialog(tool.id, tool.displayName)
                          }
                        >
                          <Zap className="w-3 h-3 mr-1" />
                          {t("toolsConfig.generated.selfHeal")}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-red-600 border-red-200 hover:text-red-700 hover:bg-red-50"
                          onClick={() => deleteGeneratedTool(tool.id)}
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          {t("common.delete")}
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

      {/* Self-Heal Dialog */}
      {selfHealToolId && selfHealToolName && (
        <SelfHealDialog
          open={selfHealOpen}
          onOpenChange={setSelfHealOpen}
          toolId={selfHealToolId}
          toolName={selfHealToolName}
        />
      )}
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
  const { t } = useTranslation();
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
          {server
            ? t("toolsConfig.mcp.editTitle")
            : t("toolsConfig.mcp.addTitle")}
        </DialogTitle>
        <DialogDescription>
          {t("toolsConfig.mcp.description")}
        </DialogDescription>
      </DialogHeader>

      <div className="py-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">{t("toolsConfig.mcp.fields.name")}</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("toolsConfig.mcp.fields.namePlaceholder")}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">
            {t("toolsConfig.mcp.fields.description")}
          </Label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("toolsConfig.mcp.fields.descriptionPlaceholder")}
          />
        </div>

        <div className="space-y-2">
          <Label>{t("toolsConfig.mcp.fields.transportType")}</Label>
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
              <Label htmlFor="command">
                {t("toolsConfig.mcp.fields.command")}
              </Label>
              <Input
                id="command"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder={t("toolsConfig.mcp.fields.commandPlaceholder")}
                required={transportType === "STDIO"}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="args">{t("toolsConfig.mcp.fields.args")}</Label>
              <Input
                id="args"
                value={args}
                onChange={(e) => setArgs(e.target.value)}
                placeholder={t("toolsConfig.mcp.fields.argsPlaceholder")}
              />
            </div>
          </>
        )}

        {(transportType === "HTTP" || transportType === "SSE") && (
          <div className="space-y-2">
            <Label htmlFor="url">{t("toolsConfig.mcp.fields.url")}</Label>
            <Input
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t("toolsConfig.mcp.fields.urlPlaceholder")}
              required
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="env">{t("toolsConfig.mcp.fields.env")}</Label>
          <Textarea
            id="env"
            value={envText}
            onChange={(e) => setEnvText(e.target.value)}
            placeholder={t("toolsConfig.mcp.fields.envPlaceholder")}
            className="font-mono text-sm"
            rows={4}
          />
          <p className="text-xs text-slate-500">
            {t("toolsConfig.mcp.fields.envHint")}
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button type="submit">
          {server ? t("common.save") : t("common.add")}
        </Button>
      </DialogFooter>
    </form>
  );
}
