// Tool Executor Service
// Safely executes external operations and built-in tools

import { dynamicToolRegistry } from "./dynamic-tool-registry.js";
import { BUILTIN_TOOL_SCHEMAS } from "./tool-executor/handlers/schemas.js";
import {
  executeAchievementsManagementAction,
  executeBrowserAction,
  executeCodeExecutorAction,
  executeCryptoPriceAction,
  executeCurlAction,
  executeGenerateToolAction,
  executeGeneratedTool,
  executeGoalsManagementAction,
  executeLongRunningTaskAction,
  executeNotificationAction,
  executeReadSkillAction,
  executeReadToolCodeAction,
  executeScheduledTaskAction,
  executeSecretsAction,
  executeSkillsManagementAction,
  executeStockPriceAction,
  executeSubAgentAction,
  executeTodoAction,
  executeUserContextAction,
  executeUserProfileAction,
  executeWeatherAction,
} from "./tool-executor/handlers/index.js";
import prisma from "./prisma.js";
import { toolErrorLogger } from "./tool-error-logger.js";

// TypeBox validation imports
import {
  validateToolArgs,
  tryValidateToolArgs,
  hasTypeBoxSchema,
  ToolValidationError,
  formatValidationErrorForLLM,
  getTypeBoxTools,
  type ToolDefinition,
  // Generated tool validation (JSON Schema with AJV)
  tryValidateGeneratedToolArgs,
  isValidGeneratedToolSchema,
  type GeneratedToolSchema,
} from "./tool-validation.js";
import type { Tool } from "@mariozechner/pi-ai";

export interface ToolConfig {
  id: string;
  name: string;
  emoji?: string;
  category: "browser" | "api" | "mcp" | "custom" | "builtin";
  enabled: boolean;
  rateLimit: number;
  timeout: number;
  config: Record<string, any>;
}

export interface ToolExecutionRequest {
  toolId: string;
  action: string;
  params: Record<string, any>;
}

export interface ToolExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  executionTime: number;
  toolUsed: string;
}

export interface ToolExecutionOptions {
  onGenerationStep?: (step: any) => void;
  /** Skip TypeBox validation (useful for internal calls) */
  skipValidation?: boolean;
  /** Return validation errors as result instead of throwing */
  softValidation?: boolean;
}

// Built-in tool definitions
const BUILTIN_TOOLS: ToolConfig[] = [
  {
    id: "todo",
    name: "Todo Manager",
    emoji: "✅",
    category: "builtin",
    enabled: true,
    rateLimit: 100,
    timeout: 5000,
    config: {
      description:
        "Manage user's todo list - create, update, complete, and list tasks",
      actions: [
        "create",
        "get",
        "list",
        "update",
        "complete",
        "delete",
        "stats",
        "overdue",
        "due_soon",
      ],
    },
  },
  {
    id: "notification",
    name: "Notifications",
    emoji: "🔔",
    category: "builtin",
    enabled: true,
    rateLimit: 50,
    timeout: 5000,
    config: {
      description:
        "Send and manage notifications to the user. Automatically routes to the best channel based on user configuration (Pushover for mobile if configured, otherwise browser).",
      actions: [
        "send",
        "schedule",
        "get",
        "list",
        "unread_count",
        "mark_read",
        "dismiss",
        "delete",
        "cancel_scheduled",
      ],
    },
  },
  {
    id: "scheduled_task",
    name: "Scheduled Tasks",
    emoji: "⏰",
    category: "builtin",
    enabled: true,
    rateLimit: 20,
    timeout: 10000,
    config: {
      description: "Schedule tasks to run in the future (cron-like)",
      actions: [
        "create",
        "get",
        "list",
        "update",
        "enable",
        "disable",
        "delete",
        "execute_now",
        "history",
      ],
    },
  },
  {
    id: "curl",
    name: "HTTP Requests",
    emoji: "🌐",
    category: "builtin",
    enabled: true,
    rateLimit: 30,
    timeout: 30000,
    config: {
      description:
        "Make HTTP requests (GET, POST, PUT, DELETE, PATCH) to fetch data from the web",
      actions: ["request", "get", "post", "put", "delete", "patch"],
    },
  },
  {
    id: "user_context",
    name: "User Context",
    emoji: "👤",
    category: "builtin",
    enabled: true,
    rateLimit: 50,
    timeout: 5000,
    config: {
      description:
        "Retrieve user context information from memory - location, preferences, facts about the user",
      actions: ["get_location", "get_preferences", "search_facts"],
    },
  },
  {
    id: "user_profile",
    name: "User Profile",
    emoji: "📋",
    category: "builtin",
    enabled: true,
    rateLimit: 50,
    timeout: 5000,
    config: {
      description:
        "Manage user's permanent profile - store and update important structural information like name, preferences, goals. This data persists and is always available to the AI without needing memory search.",
      actions: ["get", "update", "delete_fields"],
    },
  },
  {
    id: "long_running_task",
    name: "Long Running Task",
    emoji: "⚙️",
    category: "builtin",
    enabled: true,
    rateLimit: 10,
    timeout: 60000,
    config: {
      description:
        "Start and manage long-lasting autonomous tasks that can take minutes to hours. Use for complex, multi-step operations that need to run in the background with progress tracking and error recovery.",
      actions: [
        "create",
        "add_steps",
        "start",
        "pause",
        "resume",
        "cancel",
        "get",
        "list",
        "get_progress",
        "get_report",
        "list_active",
      ],
    },
  },
  {
    id: "code_executor",
    name: "Python Code Executor",
    emoji: "🐍",
    category: "builtin",
    enabled: true,
    rateLimit: 10,
    timeout: 35000,
    config: {
      description:
        "Execute Python code in a secure sandbox. Useful for mathematical calculations, data processing, algorithm testing, and any computation that requires precise results. Code runs in isolation with no filesystem or network access. Available modules: math, random, datetime, json, re, itertools, functools, collections, string, decimal, fractions, statistics, operator, copy, textwrap, unicodedata.",
      actions: ["execute", "validate", "get_limits", "get_examples"],
    },
  },
  {
    id: "generate_tool",
    name: "Dynamic Tool Generator",
    emoji: "✨",
    category: "builtin",
    enabled: true,
    rateLimit: 5,
    timeout: 300000, // 5 minutes - tool generation can take time for complex tools
    config: {
      description:
        "Generate a new custom tool with Python code to accomplish a specific task. Use this when you need to create reusable functionality like API integrations, data processing pipelines, or custom calculations. The generated tool will be saved and available for future use. You can specify which API keys/secrets are needed.",
      actions: ["generate", "list", "get", "execute", "delete", "search"],
    },
  },
  {
    id: "secrets",
    name: "User Secrets Manager",
    category: "builtin",
    enabled: true,
    rateLimit: 20,
    timeout: 5000,
    config: {
      description:
        "Manage user secrets like API keys for generated tools. List available secrets, check if required secrets exist, create new secrets, or retrieve secret values for tool execution.",
      actions: ["list", "check", "has", "retrieve", "create"],
    },
  },
  {
    id: "goals_management",
    name: "Goals Management",
    category: "builtin",
    enabled: true,
    rateLimit: 30,
    timeout: 5000,
    config: {
      description:
        "Create, update, track, and manage user goals. Monitor progress, set milestones, update status, and organize goals by category. Use for goal setting, progress tracking, milestone management, and goal lifecycle management.",
      actions: [
        "create",
        "update",
        "list",
        "get",
        "delete",
        "update_progress",
        "add_milestone",
        "get_stats",
        "get_categories",
      ],
    },
  },
  {
    id: "achievements_management",
    name: "Achievements Management",
    category: "builtin",
    enabled: true,
    rateLimit: 30,
    timeout: 5000,
    config: {
      description:
        "Create, unlock, and manage user achievements. Track accomplishments, celebrate milestones, and organize achievements by category. Use for achievement creation, unlocking, progress tracking, and celebration.",
      actions: [
        "create",
        "update",
        "list",
        "get",
        "delete",
        "unlock",
        "get_stats",
        "get_categories",
      ],
    },
  },
  {
    id: "spawn_subagent",
    name: "Spawn Sub-Agent",
    emoji: "🤖",
    category: "builtin",
    enabled: true,
    rateLimit: 5,
    timeout: 120000, // 2 minutes max
    config: {
      description:
        "Spawn a focused sub-agent for complex subtasks. Use when a task requires isolated context, specialized focus, or when you want to delegate a specific subtask without polluting your main conversation context. Sub-agents have limited tools and cannot spawn other sub-agents.",
      actions: ["spawn", "spawn_template", "list_templates", "get_status"],
    },
  },
  {
    id: "read_skill",
    name: "Read Skill",
    emoji: "📖",
    category: "builtin",
    enabled: true,
    rateLimit: 100,
    timeout: 2000,
    config: {
      description:
        "Read skill instructions for specialized workflows. Use when a skill from the available_skills list applies to the user's request. Read the skill's instructions BEFORE proceeding with the task to ensure you follow the correct workflow.",
      actions: ["read"],
    },
  },
  {
    id: "skills_management",
    name: "Skills Management",
    emoji: "📚",
    category: "builtin",
    enabled: true,
    rateLimit: 30,
    timeout: 10000,
    config: {
      description:
        "Manage skills - list, install, create, update, and delete skills. Skills are reusable instruction sets that guide how to accomplish specific tasks. Create custom skills for recurring workflows, or install skills from the hub.",
      actions: [
        "list_installed",
        "list_hub",
        "list_custom",
        "get",
        "install",
        "uninstall",
        "toggle",
        "create",
        "update",
        "delete",
      ],
    },
  },
  {
    id: "read_tool_code",
    name: "Read Tool Code",
    emoji: "🔍",
    category: "builtin",
    enabled: true,
    rateLimit: 50,
    timeout: 10000,
    config: {
      description:
        "Read and analyze the source code of a generated tool to understand its implementation. Use this to inspect how a tool works, diagnose errors, or prepare fixes. Can also apply corrections to fix broken tools proactively and rollback if needed.",
      actions: ["read", "analyze", "fix", "rollback"],
    },
  },
  {
    id: "browser",
    name: "Web Browser",
    emoji: "🌐",
    category: "builtin",
    enabled: true,
    rateLimit: 20,
    timeout: 60000,
    config: {
      description:
        "Interact with web pages through a headless browser. Navigate to URLs, extract content, take screenshots, generate PDFs, scrape data with selectors, and perform complex interactions like clicking, typing, and scrolling. Useful for accessing dynamic content that requires JavaScript, filling forms, or capturing visual snapshots of web pages.",
      actions: [
        "navigate",
        "get_content",
        "screenshot",
        "pdf",
        "scrape",
        "interact",
        "evaluate",
        "health_check",
      ],
    },
  },
];

export class ToolExecutorService {
  /**
   * Execute multiple tools in parallel with individual and global timeouts
   * @param userId - User ID
   * @param requests - Array of tool execution requests
   * @param individualTimeout - Timeout per tool in ms (default: 7000ms)
   * @param globalTimeout - Global timeout for all tools in ms (default: 60000ms)
   */
  async executeToolsInParallel(
    userId: string,
    requests: ToolExecutionRequest[],
    individualTimeout: number = 7000,
    globalTimeout: number = 60000,
  ): Promise<ToolExecutionResult[]> {
    const globalStart = Date.now();

    // Wrapper to add timeout to individual tool execution
    const executeWithTimeout = async (
      request: ToolExecutionRequest,
    ): Promise<ToolExecutionResult> => {
      return Promise.race([
        this.executeTool(userId, request),
        new Promise<ToolExecutionResult>((_, reject) =>
          setTimeout(
            () =>
              reject(new Error(`Tool timeout after ${individualTimeout}ms`)),
            individualTimeout,
          ),
        ),
      ]).catch((error) => ({
        success: false,
        error: error.message,
        executionTime: individualTimeout,
        toolUsed: request.toolId,
      }));
    };

    // Execute all tools in parallel with global timeout
    try {
      const results = await Promise.race([
        Promise.allSettled(requests.map(executeWithTimeout)),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Global timeout after ${globalTimeout}ms`)),
            globalTimeout,
          ),
        ),
      ]);

      return results.map((result) =>
        result.status === "fulfilled"
          ? result.value
          : {
              success: false,
              error: result.reason?.message || "Unknown error",
              executionTime: Date.now() - globalStart,
              toolUsed: "unknown",
            },
      );
    } catch (error: any) {
      // Global timeout reached
      return requests.map((req) => ({
        success: false,
        error: error.message || "Global timeout exceeded",
        executionTime: globalTimeout,
        toolUsed: req.toolId,
      }));
    }
  }

  /**
   * Execute a tool with given parameters
   *
   * Supports two call signatures:
   * 1. New format: executeTool(userId, { toolId, action, params }, options)
   * 2. Legacy format: executeTool(userId, toolName, args) - for backward compatibility
   *
   * The legacy format is automatically converted to the new format, extracting
   * 'action' from args if present.
   */
  async executeTool(
    userId: string,
    requestOrToolName: ToolExecutionRequest | string,
    argsOrOptions?: Record<string, any> | ToolExecutionOptions,
    legacyOptions?: ToolExecutionOptions,
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    // Handle legacy call signature: executeTool(userId, toolName, args)
    let request: ToolExecutionRequest;
    let options: ToolExecutionOptions | undefined;

    if (typeof requestOrToolName === "string") {
      // Legacy format - convert to new format
      const args = (argsOrOptions as Record<string, any>) || {};
      const { action = "execute", ...params } = args;
      request = {
        toolId: requestOrToolName,
        action,
        params,
      };
      options = legacyOptions;
    } else {
      // New format
      request = requestOrToolName;
      options = argsOrOptions as ToolExecutionOptions | undefined;
    }

    const tool = this.getToolConfig(request.toolId);

    if (!tool) {
      return {
        success: false,
        error: `Tool not found: ${request.toolId}`,
        executionTime: Date.now() - startTime,
        toolUsed: request.toolId,
      };
    }

    if (!tool.enabled) {
      return {
        success: false,
        error: `Tool is disabled: ${request.toolId}`,
        executionTime: Date.now() - startTime,
        toolUsed: request.toolId,
      };
    }

    // Validate tool parameters using TypeBox schema if available
    let validatedParams = request.params;
    if (!options?.skipValidation && hasTypeBoxSchema(request.toolId)) {
      // Merge action into params for validation (tools expect action in params)
      const paramsWithAction = { action: request.action, ...request.params };

      if (options?.softValidation) {
        // Soft validation - return errors as result
        const validationResult = tryValidateToolArgs(
          request.toolId,
          paramsWithAction,
        );
        if (!validationResult.success) {
          return {
            success: false,
            error: `Validation failed: ${validationResult.errors.join("; ")}`,
            executionTime: Date.now() - startTime,
            toolUsed: request.toolId,
          };
        }
        validatedParams = validationResult.data;
      } else {
        // Strict validation - throw on errors (will be caught below)
        try {
          validatedParams = validateToolArgs(request.toolId, paramsWithAction);
        } catch (validationError) {
          if (validationError instanceof ToolValidationError) {
            return {
              success: false,
              error: formatValidationErrorForLLM(validationError),
              executionTime: Date.now() - startTime,
              toolUsed: request.toolId,
            };
          }
          throw validationError;
        }
      }
    }

    try {
      let data: any;

      // Create request with validated params
      const validatedRequest = {
        ...request,
        params: validatedParams,
      };

      // Route to appropriate executor
      switch (tool.category) {
        case "builtin":
          data = await this.executeBuiltinTool(
            userId,
            validatedRequest,
            options,
          );
          break;
        case "browser":
          data = await this.executeBrowserTask(validatedRequest.params);
          break;
        case "api":
          data = await this.executeApiCall(validatedRequest.params);
          break;
        case "mcp":
          data = await this.executeMcpCall(validatedRequest.params);
          break;
        default:
          throw new Error(`Unknown tool category: ${tool.category}`);
      }

      return {
        success: true,
        data,
        executionTime: Date.now() - startTime,
        toolUsed: request.toolId,
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error.message || String(error);
      const errorStack = error.stack;

      // Log detailed error information
      try {
        await toolErrorLogger.logError({
          toolId: request.toolId,
          userId,
          action: request.action,
          errorMessage,
          errorStack,
          requestParams: request.params,
          requestSize: JSON.stringify(request.params).length,
          startedAt: new Date(startTime),
          endedAt: new Date(),
          executionTimeMs: executionTime,
          metadata: {
            validationError: validatedParams !== request.params,
            toolCategory: tool?.category,
            toolEnabled: tool?.enabled,
          },
        });
      } catch (logError) {
        console.error("[ToolExecutor] Failed to log tool error:", logError);
      }

      return {
        success: false,
        error: error.message,
        executionTime,
        toolUsed: request.toolId,
      };
    }
  }

  /**
   * Execute built-in tool
   */
  private async executeBuiltinTool(
    userId: string,
    request: ToolExecutionRequest,
    options?: ToolExecutionOptions,
  ): Promise<any> {
    const { toolId, action, params } = request;

    switch (toolId) {
      case "todo":
        return executeTodoAction(userId, action, params);
      case "notification":
        return executeNotificationAction(userId, action, params);
      case "scheduled_task":
        return executeScheduledTaskAction(userId, action, params);
      case "curl":
        return executeCurlAction(action, params);
      case "user_context":
        return executeUserContextAction(userId, action, params);
      case "user_profile":
        return executeUserProfileAction(userId, action, params);
      case "long_running_task":
        return executeLongRunningTaskAction(userId, action, params);
      case "code_executor":
        return executeCodeExecutorAction(action, params);
      case "generate_tool":
        return executeGenerateToolAction(
          userId,
          action,
          params,
          options?.onGenerationStep,
        );
      case "secrets":
        return executeSecretsAction(userId, action, params);
      case "goals_management":
        return executeGoalsManagementAction(userId, action, params);
      case "achievements_management":
        return executeAchievementsManagementAction(userId, action, params);
      case "spawn_subagent":
        return executeSubAgentAction(userId, action, params);
      case "read_skill":
        return executeReadSkillAction(userId, action, params);
      case "skills_management":
        return executeSkillsManagementAction(userId, action, params);
      case "read_tool_code":
        return executeReadToolCodeAction(userId, action, params);
      case "browser":
        return executeBrowserAction(action, params);
      case "weather":
        return executeWeatherAction(action, params);
      case "stock_price":
        return executeStockPriceAction(action, params);
      case "crypto_price":
        return executeCryptoPriceAction(action, params);
      default:
        // Check if it's a generated tool
        if (dynamicToolRegistry.isGeneratedToolCall(toolId)) {
          const toolName = dynamicToolRegistry.extractToolName(toolId);
          return executeGeneratedTool(userId, toolName, params);
        }
        throw new Error(`Unknown builtin tool: ${toolId}`);
    }
  }

  /**
   * Execute browser automation task (category: browser)
   * Routes to the browser service for tools with category "browser"
   */
  private async executeBrowserTask(params: any): Promise<any> {
    // This is called for tools with category: "browser"
    // Route to browser service based on action
    const action = params.action || "get_content";
    return executeBrowserAction(action, params);
  }

  /**
   * Execute HTTP API call
   */
  private async executeApiCall(params: any): Promise<any> {
    // TODO: Implement HTTP API calls with auth
    throw new Error("API calls not implemented yet");
  }

  /**
   * Execute MCP server call
   */
  private async executeMcpCall(params: any): Promise<any> {
    // TODO: Implement MCP server invocation
    throw new Error("MCP calls not implemented yet");
  }

  /**
   * Get tool configuration by ID
   */
  private getToolConfig(toolId: string): ToolConfig | undefined {
    return BUILTIN_TOOLS.find((t) => t.id === toolId);
  }

  /**
   * List available tools for user
   */
  async listAvailableTools(userId: string): Promise<ToolConfig[]> {
    // Return all enabled built-in tools
    // In the future, this could filter based on user permissions
    return BUILTIN_TOOLS.filter((t) => t.enabled);
  }

  /**
   * Get tool schema for LLM function calling
   */
  getToolSchemas(): any[] {
    return BUILTIN_TOOL_SCHEMAS;
  }

  /**
   * Get tool schemas including dynamically generated tools
   * Filters out tools that the user has disabled
   */
  async getToolSchemasWithGenerated(userId: string): Promise<any[]> {
    // Get user's tool configurations
    const userToolConfigs = await prisma.userToolConfig.findMany({
      where: { userId },
    });

    // Create a map for quick lookup
    const userConfigMap = new Map(
      userToolConfigs.map((c) => [c.toolId, c.enabled]),
    );

    // Get builtin schemas and filter by user config
    const builtinSchemas = this.getToolSchemas();
    const enabledBuiltinSchemas = builtinSchemas.filter((schema) => {
      const userEnabled = userConfigMap.get(schema.name);
      // If user has a config, use it; otherwise, use default (enabled)
      return userEnabled !== false;
    });

    // Get generated tool schemas (already filtered by dynamic registry)
    const generatedSchemas = await dynamicToolRegistry.getToolSchemas(userId);

    // Filter generated tools by user config
    const enabledGeneratedSchemas = generatedSchemas.filter((schema) => {
      const userEnabled = userConfigMap.get(schema.name);
      return userEnabled !== false;
    });

    console.log(
      `[ToolExecutor] Enabled tools for user ${userId}: ${enabledBuiltinSchemas.length} builtin, ${enabledGeneratedSchemas.length} generated (disabled: ${builtinSchemas.length - enabledBuiltinSchemas.length} builtin)`,
    );

    return [...enabledBuiltinSchemas, ...enabledGeneratedSchemas];
  }

  /**
   * Get tool schemas in pi-ai native TypeBox format
   * These schemas support automatic validation via pi-ai's validateToolCall
   */
  getTypeBoxTools(): ToolDefinition[] {
    return getTypeBoxTools();
  }

  /**
   * Get tool schemas in pi-ai native format including dynamically generated tools
   * Note: Generated tools may have JSON Schema parameters instead of TypeBox TSchema
   */
  async getTypeBoxToolsWithGenerated(
    userId: string,
  ): Promise<ToolDefinition[]> {
    const builtinTools = this.getTypeBoxTools();
    const generatedSchemas = await dynamicToolRegistry.getToolSchemas(userId);

    // Convert generated tool schemas to pi-ai Tool format
    const generatedTools: ToolDefinition[] = generatedSchemas.map((schema) => ({
      name: schema.name,
      description: schema.description,
      parameters: schema.parameters,
    }));

    return [...builtinTools, ...generatedTools];
  }
}

export const toolExecutorService = new ToolExecutorService();
