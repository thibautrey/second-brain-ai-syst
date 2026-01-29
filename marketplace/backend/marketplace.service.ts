/**
 * Marketplace Service
 *
 * Handles all communication with the Supabase marketplace backend.
 * Provides methods for publishing, browsing, installing, and voting on skills/tools.
 */

import crypto from "crypto";
import {
  MarketplaceSkill,
  MarketplaceTool,
  PublishSkillRequest,
  PublishToolRequest,
  BrowseOptions,
  BrowseResponse,
  SecurityCheckResult,
  SecurityIssue,
  ItemType,
  VoteRequest,
  TrackInstallRequest,
  ReportRequest,
  MarketplaceVote,
  MarketplaceInstall,
} from "../types/marketplace.types.js";

// ==================== Configuration ====================

const SUPABASE_URL = process.env.MARKETPLACE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.MARKETPLACE_SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_KEY = process.env.MARKETPLACE_SUPABASE_SERVICE_KEY || "";

// Instance ID - generated once per installation
let INSTANCE_ID = process.env.INSTANCE_ID || "";

// ==================== Helper Functions ====================

/**
 * Generate or retrieve instance ID
 * This is a hash that anonymously identifies this Second Brain instance
 */
function getInstanceId(): string {
  if (!INSTANCE_ID) {
    // Generate a stable instance ID based on some local factors
    // In production, this should be stored in the database
    const seed = `${process.env.DATABASE_URL || "local"}-${Date.now()}`;
    INSTANCE_ID = crypto
      .createHash("sha256")
      .update(seed)
      .digest("hex")
      .slice(0, 32);
    console.log(
      "[Marketplace] Generated new instance ID:",
      INSTANCE_ID.slice(0, 8) + "...",
    );
  }
  return INSTANCE_ID;
}

/**
 * Generate a URL-friendly slug from a name
 */
function generateSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50) +
    "-" +
    crypto.randomBytes(4).toString("hex")
  );
}

/**
 * Make a request to Supabase REST API
 */
async function supabaseRequest<T>(
  endpoint: string,
  options: {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    body?: any;
    useServiceKey?: boolean;
    headers?: Record<string, string>;
  } = {},
): Promise<T> {
  const { method = "GET", body, useServiceKey = false, headers = {} } = options;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Marketplace not configured. Please set MARKETPLACE_SUPABASE_URL and MARKETPLACE_SUPABASE_ANON_KEY",
    );
  }

  const apiKey =
    useServiceKey && SUPABASE_SERVICE_KEY
      ? SUPABASE_SERVICE_KEY
      : SUPABASE_ANON_KEY;

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
    method,
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Prefer: method === "POST" ? "return=representation" : "return=minimal",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Supabase error: ${response.status} - ${error}`);
  }

  // For DELETE or when no content
  if (response.status === 204 || method === "DELETE") {
    return {} as T;
  }

  return response.json();
}

// ==================== Security Check ====================

/**
 * Analyze code/instructions for security issues using LLM
 */
async function performSecurityCheck(
  content: string,
  type: "skill" | "tool",
): Promise<SecurityCheckResult> {
  const issues: SecurityIssue[] = [];

  // Pattern-based checks (fast, no LLM needed)
  const patterns = [
    // Hardcoded secrets
    {
      regex: /api[_-]?key\s*[:=]\s*['"][a-zA-Z0-9]{20,}['"]/gi,
      type: "hardcoded_secret",
      severity: "critical" as const,
      desc: "Hardcoded API key detected",
    },
    {
      regex: /password\s*[:=]\s*['"][^'"]+['"]/gi,
      type: "hardcoded_secret",
      severity: "critical" as const,
      desc: "Hardcoded password detected",
    },
    {
      regex: /secret\s*[:=]\s*['"][a-zA-Z0-9]{10,}['"]/gi,
      type: "hardcoded_secret",
      severity: "critical" as const,
      desc: "Hardcoded secret detected",
    },
    {
      regex: /Bearer\s+[a-zA-Z0-9\-_.]+/gi,
      type: "hardcoded_token",
      severity: "critical" as const,
      desc: "Hardcoded Bearer token detected",
    },

    // Dangerous operations (for tools/code)
    {
      regex: /eval\s*\(/gi,
      type: "dangerous_function",
      severity: "high" as const,
      desc: "Use of eval() detected",
    },
    {
      regex: /exec\s*\(/gi,
      type: "dangerous_function",
      severity: "high" as const,
      desc: "Use of exec() detected",
    },
    {
      regex: /subprocess\.call|os\.system/gi,
      type: "shell_execution",
      severity: "high" as const,
      desc: "Shell command execution detected",
    },
    {
      regex: /rm\s+-rf|rmdir|del\s+\/[sf]/gi,
      type: "destructive_command",
      severity: "critical" as const,
      desc: "Destructive file operation detected",
    },

    // Data exfiltration patterns
    {
      regex: /requests\.(post|put)\s*\([^)]*(?!localhost|127\.0\.0\.1)/gi,
      type: "data_exfiltration",
      severity: "medium" as const,
      desc: "External POST request detected",
    },
    {
      regex: /urllib|httplib|http\.client/gi,
      type: "network_access",
      severity: "low" as const,
      desc: "Network library usage detected",
    },

    // File system access
    {
      regex: /open\s*\(\s*['"]\/etc\//gi,
      type: "sensitive_file_access",
      severity: "high" as const,
      desc: "Access to /etc/ detected",
    },
    {
      regex: /open\s*\(\s*['"]~\//gi,
      type: "home_directory_access",
      severity: "medium" as const,
      desc: "Access to home directory detected",
    },

    // Environment variable access
    {
      regex: /os\.environ|process\.env/gi,
      type: "env_access",
      severity: "low" as const,
      desc: "Environment variable access detected",
    },
  ];

  for (const pattern of patterns) {
    const matches = content.match(pattern.regex);
    if (matches) {
      // Find line numbers
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (pattern.regex.test(lines[i])) {
          issues.push({
            severity: pattern.severity,
            type: pattern.type,
            description: pattern.desc,
            line: i + 1,
            suggestion: getSecuritySuggestion(pattern.type),
          });
        }
        // Reset regex state
        pattern.regex.lastIndex = 0;
      }
    }
  }

  // Determine approval based on issues
  const hasCritical = issues.some((i) => i.severity === "critical");
  const hasHigh = issues.some((i) => i.severity === "high");
  const approved = !hasCritical && !hasHigh;

  return {
    approved,
    issues,
    summary: approved
      ? issues.length > 0
        ? `Approved with ${issues.length} minor warning(s)`
        : "No security issues detected"
      : `Rejected: ${issues.filter((i) => i.severity === "critical" || i.severity === "high").length} critical/high severity issue(s) found`,
  };
}

function getSecuritySuggestion(type: string): string {
  const suggestions: Record<string, string> = {
    hardcoded_secret:
      "Use environment variables or the secrets manager instead",
    hardcoded_token: "Use environment variables or the secrets manager instead",
    dangerous_function: "Avoid eval/exec - use safer alternatives",
    shell_execution:
      "Use Python libraries instead of shell commands when possible",
    destructive_command: "Remove destructive file operations",
    data_exfiltration: "Ensure external requests are necessary and documented",
    network_access: "Document why network access is needed",
    sensitive_file_access: "Avoid accessing system files",
    home_directory_access: "Use workspace-relative paths instead",
    env_access: "Use the provided secrets system instead of direct env access",
  };
  return suggestions[type] || "Review this code for security implications";
}

// ==================== Skills ====================

/**
 * Browse public skills from the marketplace
 */
async function browseSkills(
  options: BrowseOptions = {},
): Promise<BrowseResponse<MarketplaceSkill>> {
  const {
    category,
    search,
    tags,
    sort_by = "popular",
    page = 1,
    limit = 20,
  } = options;

  let query = "marketplace_skills?security_status=eq.approved";

  // Filters
  if (category) {
    query += `&category=eq.${category}`;
  }
  if (search) {
    query += `&or=(name.ilike.*${search}*,description.ilike.*${search}*)`;
  }
  if (tags && tags.length > 0) {
    query += `&tags=cs.{${tags.join(",")}}`;
  }

  // Sorting
  const sortMap: Record<string, string> = {
    popular: "installs_count.desc",
    recent: "created_at.desc",
    top_rated: "upvotes_count.desc",
    most_installed: "installs_count.desc",
  };
  query += `&order=${sortMap[sort_by] || sortMap.popular}`;

  // Pagination
  const offset = (page - 1) * limit;
  query += `&offset=${offset}&limit=${limit}`;

  const items = await supabaseRequest<MarketplaceSkill[]>(query, {
    headers: { Prefer: "count=exact" },
  });

  return {
    items,
    total: items.length, // TODO: Get actual count from headers
    page,
    limit,
    has_more: items.length === limit,
  };
}

/**
 * Get a single skill by ID or slug
 */
async function getSkill(idOrSlug: string): Promise<MarketplaceSkill | null> {
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      idOrSlug,
    );
  const query = isUuid
    ? `marketplace_skills?id=eq.${idOrSlug}&security_status=eq.approved`
    : `marketplace_skills?slug=eq.${idOrSlug}&security_status=eq.approved`;

  const results = await supabaseRequest<MarketplaceSkill[]>(query);
  return results[0] || null;
}

/**
 * Publish a skill to the marketplace
 */
async function publishSkill(request: PublishSkillRequest): Promise<{
  success: boolean;
  skill?: MarketplaceSkill;
  error?: string;
  security?: SecurityCheckResult;
}> {
  // Security check
  const securityResult = await performSecurityCheck(
    request.instructions,
    "skill",
  );

  if (!securityResult.approved) {
    return {
      success: false,
      error: securityResult.summary,
      security: securityResult,
    };
  }

  const skill = {
    slug: generateSlug(request.name),
    name: request.name,
    description: request.description,
    instructions: request.instructions,
    category: request.category || "OTHER",
    tags: request.tags || [],
    icon: request.icon,
    version: request.version || "1.0.0",
    author_instance_id: getInstanceId(),
    author_name: request.author_name,
    author_url: request.author_url,
    metadata: request.metadata || {},
    security_status: "approved", // Pre-approved since we checked
    security_checked_at: new Date().toISOString(),
    security_notes: securityResult.summary,
  };

  try {
    const results = await supabaseRequest<MarketplaceSkill[]>(
      "marketplace_skills",
      {
        method: "POST",
        body: skill,
        useServiceKey: true,
      },
    );

    return {
      success: true,
      skill: results[0],
      security: securityResult,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

// ==================== Tools ====================

/**
 * Browse public tools from the marketplace
 */
async function browseTools(
  options: BrowseOptions = {},
): Promise<BrowseResponse<MarketplaceTool>> {
  const {
    category,
    search,
    tags,
    sort_by = "popular",
    page = 1,
    limit = 20,
  } = options;

  let query = "marketplace_tools?security_status=eq.approved";

  if (category) {
    query += `&category=eq.${category}`;
  }
  if (search) {
    query += `&or=(name.ilike.*${search}*,display_name.ilike.*${search}*,description.ilike.*${search}*)`;
  }
  if (tags && tags.length > 0) {
    query += `&tags=cs.{${tags.join(",")}}`;
  }

  const sortMap: Record<string, string> = {
    popular: "installs_count.desc",
    recent: "created_at.desc",
    top_rated: "upvotes_count.desc",
    most_installed: "installs_count.desc",
  };
  query += `&order=${sortMap[sort_by] || sortMap.popular}`;

  const offset = (page - 1) * limit;
  query += `&offset=${offset}&limit=${limit}`;

  const items = await supabaseRequest<MarketplaceTool[]>(query);

  return {
    items,
    total: items.length,
    page,
    limit,
    has_more: items.length === limit,
  };
}

/**
 * Get a single tool by ID or slug
 */
async function getTool(idOrSlug: string): Promise<MarketplaceTool | null> {
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      idOrSlug,
    );
  const query = isUuid
    ? `marketplace_tools?id=eq.${idOrSlug}&security_status=eq.approved`
    : `marketplace_tools?slug=eq.${idOrSlug}&security_status=eq.approved`;

  const results = await supabaseRequest<MarketplaceTool[]>(query);
  return results[0] || null;
}

/**
 * Publish a tool to the marketplace
 */
async function publishTool(request: PublishToolRequest): Promise<{
  success: boolean;
  tool?: MarketplaceTool;
  error?: string;
  security?: SecurityCheckResult;
}> {
  // Security check on code
  const securityResult = await performSecurityCheck(request.code, "tool");

  if (!securityResult.approved) {
    return {
      success: false,
      error: securityResult.summary,
      security: securityResult,
    };
  }

  const tool = {
    slug: generateSlug(request.name),
    name: request.name,
    display_name: request.display_name,
    description: request.description,
    language: request.language || "python",
    code: request.code,
    input_schema: request.input_schema,
    output_schema: request.output_schema,
    required_secrets: request.required_secrets || [],
    category: request.category || "custom",
    tags: request.tags || [],
    version: request.version || "1.0.0",
    author_instance_id: getInstanceId(),
    author_name: request.author_name,
    author_url: request.author_url,
    metadata: request.metadata || {},
    security_status: "approved",
    security_checked_at: new Date().toISOString(),
    security_notes: securityResult.summary,
  };

  try {
    const results = await supabaseRequest<MarketplaceTool[]>(
      "marketplace_tools",
      {
        method: "POST",
        body: tool,
        useServiceKey: true,
      },
    );

    return {
      success: true,
      tool: results[0],
      security: securityResult,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

// ==================== Install Tracking ====================

/**
 * Track an installation
 */
async function trackInstall(
  request: TrackInstallRequest,
): Promise<{ success: boolean; error?: string }> {
  try {
    await supabaseRequest("marketplace_installs", {
      method: "POST",
      body: {
        item_type: request.item_type,
        item_id: request.item_id,
        instance_id: getInstanceId(),
      },
      useServiceKey: true,
    });

    // Increment counter
    await supabaseRequest("rpc/increment_installs", {
      method: "POST",
      body: {
        p_item_type: request.item_type,
        p_item_id: request.item_id,
      },
      useServiceKey: true,
    });

    return { success: true };
  } catch (error: any) {
    // Might fail due to unique constraint (already installed)
    if (
      error.message.includes("duplicate") ||
      error.message.includes("unique")
    ) {
      return { success: true }; // Already installed is not an error
    }
    return { success: false, error: error.message };
  }
}

/**
 * Track an uninstall
 */
async function trackUninstall(
  request: TrackInstallRequest,
): Promise<{ success: boolean; error?: string }> {
  try {
    // Mark as uninstalled
    await supabaseRequest(
      `marketplace_installs?item_type=eq.${request.item_type}&item_id=eq.${request.item_id}&instance_id=eq.${getInstanceId()}`,
      {
        method: "PATCH",
        body: { uninstalled_at: new Date().toISOString() },
        useServiceKey: true,
      },
    );

    // Decrement counter
    await supabaseRequest("rpc/decrement_installs", {
      method: "POST",
      body: {
        p_item_type: request.item_type,
        p_item_id: request.item_id,
      },
      useServiceKey: true,
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ==================== Voting ====================

/**
 * Add an upvote
 */
async function addVote(
  request: VoteRequest,
): Promise<{ success: boolean; error?: string }> {
  try {
    await supabaseRequest("marketplace_votes", {
      method: "POST",
      body: {
        item_type: request.item_type,
        item_id: request.item_id,
        instance_id: getInstanceId(),
        vote: 1,
      },
      useServiceKey: true,
    });

    // Increment counter
    await supabaseRequest("rpc/increment_upvotes", {
      method: "POST",
      body: {
        p_item_type: request.item_type,
        p_item_id: request.item_id,
      },
      useServiceKey: true,
    });

    return { success: true };
  } catch (error: any) {
    if (
      error.message.includes("duplicate") ||
      error.message.includes("unique")
    ) {
      return { success: false, error: "Already voted" };
    }
    return { success: false, error: error.message };
  }
}

/**
 * Remove an upvote
 */
async function removeVote(
  request: VoteRequest,
): Promise<{ success: boolean; error?: string }> {
  try {
    await supabaseRequest(
      `marketplace_votes?item_type=eq.${request.item_type}&item_id=eq.${request.item_id}&instance_id=eq.${getInstanceId()}`,
      {
        method: "DELETE",
        useServiceKey: true,
      },
    );

    // Decrement counter
    await supabaseRequest("rpc/decrement_upvotes", {
      method: "POST",
      body: {
        p_item_type: request.item_type,
        p_item_id: request.item_id,
      },
      useServiceKey: true,
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Check if this instance has voted for an item
 */
async function hasVoted(itemType: ItemType, itemId: string): Promise<boolean> {
  try {
    const results = await supabaseRequest<MarketplaceVote[]>(
      `marketplace_votes?item_type=eq.${itemType}&item_id=eq.${itemId}&instance_id=eq.${getInstanceId()}&select=id`,
    );
    return results.length > 0;
  } catch {
    return false;
  }
}

/**
 * Check if this instance has installed an item
 */
async function hasInstalled(
  itemType: ItemType,
  itemId: string,
): Promise<boolean> {
  try {
    const results = await supabaseRequest<MarketplaceInstall[]>(
      `marketplace_installs?item_type=eq.${itemType}&item_id=eq.${itemId}&instance_id=eq.${getInstanceId()}&uninstalled_at=is.null&select=id`,
    );
    return results.length > 0;
  } catch {
    return false;
  }
}

// ==================== Reporting ====================

/**
 * Report an item for review
 */
async function reportItem(
  request: ReportRequest,
): Promise<{ success: boolean; error?: string }> {
  try {
    await supabaseRequest("marketplace_reports", {
      method: "POST",
      body: {
        item_type: request.item_type,
        item_id: request.item_id,
        reporter_instance_id: getInstanceId(),
        reason: request.reason,
        details: request.details,
      },
      useServiceKey: true,
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ==================== Utility ====================

/**
 * Check if marketplace is configured
 */
function isConfigured(): boolean {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
}

/**
 * Get marketplace configuration status
 */
function getConfigStatus(): {
  configured: boolean;
  url?: string;
  hasServiceKey: boolean;
} {
  return {
    configured: isConfigured(),
    url: SUPABASE_URL
      ? SUPABASE_URL.replace(/https?:\/\//, "").split(".")[0] + "..."
      : undefined,
    hasServiceKey: !!SUPABASE_SERVICE_KEY,
  };
}

// ==================== Export ====================

export const marketplaceService = {
  // Skills
  browseSkills,
  getSkill,
  publishSkill,

  // Tools
  browseTools,
  getTool,
  publishTool,

  // Install tracking
  trackInstall,
  trackUninstall,
  hasInstalled,

  // Voting
  addVote,
  removeVote,
  hasVoted,

  // Reporting
  reportItem,

  // Security
  performSecurityCheck,

  // Utility
  isConfigured,
  getConfigStatus,
  getInstanceId,
};

export default marketplaceService;
