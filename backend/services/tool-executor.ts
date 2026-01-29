// Tool Executor Service
// Safely executes external operations and built-in tools

import {
  GoalStatus,
  NotificationType,
  ScheduleType,
  TaskActionType,
  TodoPriority,
  TodoStatus,
} from "@prisma/client";
import { SUBAGENT_TEMPLATES, subAgentRunner } from "./subagent/index.js";
import { UserProfile, userProfileService } from "./user-profile.js";
import {
  braveSearchService,
  browserService,
  curlService,
  longRunningTaskService,
  notificationService,
  scheduledTaskService,
  todoService,
} from "./tools/index.js";

import { achievementsService } from "./achievements.service.js";
import { codeExecutorService } from "./code-executor-wrapper.js";
import { dynamicToolGeneratorService } from "./dynamic-tool-generator.js";
import { dynamicToolRegistry } from "./dynamic-tool-registry.js";
import { goalsService } from "./goals.service.js";
import { memorySearchService } from "./memory-search.js";
import { secretsService } from "./secrets.js";

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
    id: "brave_search",
    name: "Brave Web Search",
    emoji: "🧭",
    category: "builtin",
    enabled: true,
    rateLimit: 40,
    timeout: 15000,
    config: {
      description:
        "Search the public internet using the Brave Search API. Requires a Brave API key saved as secret 'BRAVE_SEARCH_API_KEY' or environment variable BRAVE_SEARCH_API_KEY.",
      actions: ["search"],
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
   */
  async executeTool(
    userId: string,
    request: ToolExecutionRequest,
    options?: ToolExecutionOptions,
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();
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

    try {
      let data: any;

      // Route to appropriate executor
      switch (tool.category) {
        case "builtin":
          data = await this.executeBuiltinTool(userId, request, options);
          break;
        case "browser":
          data = await this.executeBrowserTask(request.params);
          break;
        case "api":
          data = await this.executeApiCall(request.params);
          break;
        case "mcp":
          data = await this.executeMcpCall(request.params);
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
      return {
        success: false,
        error: error.message,
        executionTime: Date.now() - startTime,
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
        return this.executeTodoAction(userId, action, params);
      case "notification":
        return this.executeNotificationAction(userId, action, params);
      case "scheduled_task":
        return this.executeScheduledTaskAction(userId, action, params);
      case "curl":
        return this.executeCurlAction(action, params);
      case "brave_search":
        return this.executeBraveSearchAction(userId, action, params);
      case "user_context":
        return this.executeUserContextAction(userId, action, params);
      case "user_profile":
        return this.executeUserProfileAction(userId, action, params);
      case "long_running_task":
        return this.executeLongRunningTaskAction(userId, action, params);
      case "code_executor":
        return this.executeCodeExecutorAction(action, params);
      case "generate_tool":
        return this.executeGenerateToolAction(
          userId,
          action,
          params,
          options?.onGenerationStep,
        );
      case "secrets":
        return this.executeSecretsAction(userId, action, params);
      case "goals_management":
        return this.executeGoalsManagementAction(userId, action, params);
      case "achievements_management":
        return this.executeAchievementsManagementAction(userId, action, params);
      case "spawn_subagent":
        return this.executeSubAgentAction(userId, action, params);
      case "read_skill":
        return this.executeReadSkillAction(userId, action, params);
      case "read_tool_code":
        return this.executeReadToolCodeAction(userId, action, params);
      case "browser":
        return this.executeBrowserAction(action, params);
      default:
        // Check if it's a generated tool
        if (dynamicToolRegistry.isGeneratedToolCall(toolId)) {
          const toolName = dynamicToolRegistry.extractToolName(toolId);
          return this.executeGeneratedTool(userId, toolName, params);
        }
        throw new Error(`Unknown builtin tool: ${toolId}`);
    }
  }

  /**
   * Execute a dynamically generated tool
   */
  private async executeGeneratedTool(
    userId: string,
    toolName: string,
    params: Record<string, any>,
  ): Promise<any> {
    const result = await dynamicToolRegistry.executeTool(
      userId,
      toolName,
      params,
    );

    if (result.success) {
      return {
        action: "execute",
        tool: toolName,
        success: true,
        result: result.data,
        executionTime: result.executionTime,
      };
    }

    throw new Error(result.error || "Tool execution failed");
  }

  /**
   * Execute generate_tool actions
   * @param onGenerationStep Optional callback for generation steps (for SSE streaming)
   */
  private async executeGenerateToolAction(
    userId: string,
    action: string,
    params: Record<string, any>,
    onGenerationStep?: (step: any) => void,
  ): Promise<any> {
    switch (action) {
      case "generate": {
        if (!params.objective) {
          throw new Error(
            "Missing 'objective' parameter - describe what the tool should do",
          );
        }

        const result = await dynamicToolGeneratorService.generateTool(
          userId,
          {
            objective: params.objective,
            context: params.context,
            suggestedSecrets:
              params.suggestedSecrets || params.required_secrets,
          },
          onGenerationStep,
        );

        if (result.success && result.tool) {
          // Add to registry cache
          await dynamicToolRegistry.addToCache(result.tool);

          return {
            action: "generate",
            success: true,
            tool: {
              id: result.tool.id,
              name: result.tool.name,
              displayName: result.tool.displayName,
              description: result.tool.description,
              category: result.tool.category,
              requiredSecrets: result.tool.requiredSecrets,
            },
            executionResult: result.executionResult,
            iterations: result.iterations,
            message: `Successfully created tool '${result.tool.displayName}'. It's now available for use.`,
          };
        }

        return {
          action: "generate",
          success: false,
          error: result.error,
          logs: result.logs,
          iterations: result.iterations,
        };
      }

      case "list": {
        const tools = await dynamicToolGeneratorService.listTools(
          userId,
          params.category,
          params.enabled_only !== false,
        );

        return {
          action: "list",
          tools: tools.map((t) => ({
            id: t.id,
            name: t.name,
            displayName: t.displayName,
            description: t.description,
            category: t.category,
            usageCount: t.usageCount,
            lastUsedAt: t.lastUsedAt,
            enabled: t.enabled,
            isVerified: t.isVerified,
          })),
          count: tools.length,
        };
      }

      case "get": {
        if (!params.tool_id && !params.name) {
          throw new Error("Missing 'tool_id' or 'name' parameter");
        }

        const tool = await dynamicToolGeneratorService.getTool(
          userId,
          params.tool_id || params.name,
        );

        if (!tool) {
          return { action: "get", found: false, error: "Tool not found" };
        }

        return {
          action: "get",
          found: true,
          tool: {
            id: tool.id,
            name: tool.name,
            displayName: tool.displayName,
            description: tool.description,
            category: tool.category,
            tags: tool.tags,
            requiredSecrets: tool.requiredSecrets,
            inputSchema: tool.inputSchema,
            usageCount: tool.usageCount,
            lastUsedAt: tool.lastUsedAt,
            enabled: tool.enabled,
            isVerified: tool.isVerified,
            version: tool.version,
            code: tool.code, // Include code for debugging/review
          },
        };
      }

      case "execute": {
        if (!params.tool_id && !params.name) {
          throw new Error("Missing 'tool_id' or 'name' parameter");
        }

        const toolParams = params.params || params.tool_params || {};
        const result = await dynamicToolGeneratorService.executeTool(
          userId,
          params.tool_id || params.name,
          toolParams,
        );

        return {
          action: "execute",
          success: result.success,
          result: result.result,
          error: result.error,
        };
      }

      case "delete": {
        if (!params.tool_id) {
          throw new Error("Missing 'tool_id' parameter");
        }

        const deleted = await dynamicToolGeneratorService.deleteTool(
          userId,
          params.tool_id,
        );

        if (deleted) {
          dynamicToolRegistry.removeFromCache(userId, params.tool_id);
        }

        return {
          action: "delete",
          success: deleted,
          message: deleted ? "Tool deleted successfully" : "Tool not found",
        };
      }

      case "search": {
        if (!params.query) {
          throw new Error("Missing 'query' parameter");
        }

        const tools = await dynamicToolRegistry.searchTools(
          userId,
          params.query,
        );

        return {
          action: "search",
          query: params.query,
          tools: tools.map((t) => ({
            id: t.id,
            name: t.name,
            displayName: t.displayName,
            description: t.description,
            category: t.category,
          })),
          count: tools.length,
        };
      }

      default:
        throw new Error(`Unknown generate_tool action: ${action}`);
    }
  }

  /**
   * Execute secrets management actions
   */
  private async executeSecretsAction(
    userId: string,
    action: string,
    params: Record<string, any>,
  ): Promise<any> {
    switch (action) {
      case "list": {
        const secrets = await secretsService.listSecrets(
          userId,
          params.category,
        );

        return {
          action: "list",
          secrets: secrets.map((s) => ({
            key: s.key,
            displayName: s.displayName,
            category: s.category,
            description: s.description,
            lastUsedAt: s.lastUsedAt,
            // Never include the actual value!
          })),
          count: secrets.length,
        };
      }

      case "check": {
        if (!params.keys || !Array.isArray(params.keys)) {
          throw new Error("Missing 'keys' array parameter");
        }

        const result = await secretsService.checkSecretsExist(
          userId,
          params.keys,
        );

        return {
          action: "check",
          exists: result.exists,
          missing: result.missing,
          allPresent: result.missing.length === 0,
        };
      }

      case "has": {
        if (!params.key) {
          throw new Error("Missing 'key' parameter");
        }

        const exists = await secretsService.hasSecret(userId, params.key);

        return {
          action: "has",
          key: params.key,
          exists,
        };
      }

      case "update": {
        if (!params.key) {
          throw new Error(
            "Missing 'key' parameter - specify which secret to update",
          );
        }
        if (!params.value) {
          throw new Error(
            "Missing 'value' parameter - provide the new value for the secret",
          );
        }

        // Check if the secret exists first
        const exists = await secretsService.hasSecret(userId, params.key);
        if (!exists) {
          return {
            action: "update",
            key: params.key,
            success: false,
            error: `Secret '${params.key}' not found. Use 'create' action to add a new secret.`,
          };
        }

        const updates: {
          value: string;
          displayName?: string;
          category?: string;
          description?: string;
        } = {
          value: params.value,
        };
        if (params.displayName) updates.displayName = params.displayName;
        if (params.category) updates.category = params.category;
        if (params.description) updates.description = params.description;

        const secret = await secretsService.updateSecret(
          userId,
          params.key,
          updates,
        );

        // Log the update for audit purposes
        console.log(
          `[SecretsAudit] User ${userId} updated secret: ${params.key}`,
        );

        return {
          action: "update",
          key: secret.key,
          displayName: secret.displayName,
          category: secret.category,
          success: true,
          message: `Secret '${params.key}' updated successfully`,
        };
      }

      case "create": {
        if (!params.key || !params.value) {
          throw new Error("Missing required parameters: 'key' and 'value'");
        }

        const secret = await secretsService.createSecret(userId, {
          key: params.key,
          value: params.value,
          displayName: params.displayName || params.key,
          category: params.category || "api_keys",
          description: params.description,
        });

        return {
          action: "create",
          success: true,
          key: secret.key,
          displayName: secret.displayName,
          category: secret.category,
          message: `Secret '${params.key}' created successfully`,
        };
      }

      default:
        throw new Error(`Unknown secrets action: ${action}`);
    }
  }

  /**
   * Execute goals management actions
   */
  private async executeGoalsManagementAction(
    userId: string,
    action: string,
    params: Record<string, any>,
  ): Promise<any> {
    switch (action) {
      case "create": {
        if (!params.title) {
          throw new Error("Missing required parameter: 'title'");
        }

        const goal = await goalsService.createGoal(userId, {
          title: params.title,
          description: params.description,
          category: params.category || "personal_growth",
          targetDate: params.target_date
            ? new Date(params.target_date)
            : undefined,
          tags: params.tags || [],
          metadata: params.metadata || {},
        });

        return {
          action: "create",
          success: true,
          goal,
          message: `Goal '${params.title}' created successfully`,
        };
      }

      case "update": {
        if (!params.goal_id) {
          throw new Error("Missing required parameter: 'goal_id'");
        }

        const updateData: any = {};
        if (params.title) updateData.title = params.title;
        if (params.description !== undefined)
          updateData.description = params.description;
        if (params.category) updateData.category = params.category;
        if (params.status) updateData.status = params.status as GoalStatus;
        if (params.progress !== undefined)
          updateData.progress = params.progress;
        if (params.target_date)
          updateData.targetDate = new Date(params.target_date);
        if (params.tags) updateData.tags = params.tags;
        if (params.metadata) updateData.metadata = params.metadata;

        const goal = await goalsService.updateGoal(
          params.goal_id,
          userId,
          updateData,
        );

        return {
          action: "update",
          success: true,
          goal,
          message: "Goal updated successfully",
        };
      }

      case "list": {
        const options: any = {};
        if (params.filter_status)
          options.status = params.filter_status as GoalStatus;
        if (params.filter_category) options.category = params.filter_category;
        if (params.include_archived)
          options.includeArchived = params.include_archived;

        const goals = await goalsService.getUserGoals(userId, options);

        return {
          action: "list",
          goals,
          count: goals.length,
          filters: options,
        };
      }

      case "get": {
        if (!params.goal_id) {
          throw new Error("Missing required parameter: 'goal_id'");
        }

        const goal = await goalsService.getGoal(params.goal_id, userId);

        if (!goal) {
          return {
            action: "get",
            success: false,
            error: "Goal not found",
          };
        }

        return {
          action: "get",
          success: true,
          goal,
        };
      }

      case "delete": {
        if (!params.goal_id) {
          throw new Error("Missing required parameter: 'goal_id'");
        }

        const deleted = await goalsService.deleteGoal(params.goal_id, userId);

        return {
          action: "delete",
          success: deleted,
          message: deleted ? "Goal deleted successfully" : "Goal not found",
        };
      }

      case "update_progress": {
        if (!params.goal_id || params.progress === undefined) {
          throw new Error(
            "Missing required parameters: 'goal_id' and 'progress'",
          );
        }

        const goal = await goalsService.updateGoal(params.goal_id, userId, {
          progress: Math.max(0, Math.min(100, params.progress)), // Clamp between 0-100
        });

        return {
          action: "update_progress",
          success: true,
          goal,
          message: `Goal progress updated to ${params.progress}%`,
        };
      }

      case "add_milestone": {
        if (!params.goal_id || !params.milestone_name) {
          throw new Error(
            "Missing required parameters: 'goal_id' and 'milestone_name'",
          );
        }

        const milestone = {
          name: params.milestone_name,
          completed: params.milestone_completed || false,
          date: new Date(),
        };

        const goal = await goalsService.addMilestone(
          params.goal_id,
          userId,
          milestone,
        );

        return {
          action: "add_milestone",
          success: true,
          goal,
          milestone,
          message: `Milestone '${params.milestone_name}' added to goal`,
        };
      }

      case "get_stats": {
        const stats = await goalsService.getStats(userId);

        return {
          action: "get_stats",
          success: true,
          stats,
        };
      }

      case "get_categories": {
        const categories = await goalsService.getCategories(userId);

        return {
          action: "get_categories",
          success: true,
          categories,
        };
      }

      default:
        throw new Error(`Unknown goals_management action: ${action}`);
    }
  }

  /**
   * Execute achievements management actions
   */
  private async executeAchievementsManagementAction(
    userId: string,
    action: string,
    params: Record<string, any>,
  ): Promise<any> {
    switch (action) {
      case "create": {
        if (!params.title || !params.description) {
          throw new Error(
            "Missing required parameters: 'title' and 'description'",
          );
        }

        const achievement = await achievementsService.createAchievement(
          userId,
          {
            title: params.title,
            description: params.description,
            category: params.category || "personal_growth",
            icon: params.icon,
            significance: params.significance || "normal",
            criteria: params.criteria || {},
            isHidden: params.is_hidden !== false, // Default to hidden
            metadata: params.metadata || {},
          },
        );

        return {
          action: "create",
          success: true,
          achievement,
          message: `Achievement '${params.title}' created successfully`,
        };
      }

      case "update": {
        if (!params.achievement_id) {
          throw new Error("Missing required parameter: 'achievement_id'");
        }

        const updateData: any = {};
        if (params.title) updateData.title = params.title;
        if (params.description) updateData.description = params.description;
        if (params.category) updateData.category = params.category;
        if (params.icon !== undefined) updateData.icon = params.icon;
        if (params.significance) updateData.significance = params.significance;
        if (params.criteria) updateData.criteria = params.criteria;
        if (params.is_hidden !== undefined)
          updateData.isHidden = params.is_hidden;
        if (params.metadata) updateData.metadata = params.metadata;

        const achievement = await achievementsService.updateAchievement(
          params.achievement_id,
          userId,
          updateData,
        );

        return {
          action: "update",
          success: true,
          achievement,
          message: "Achievement updated successfully",
        };
      }

      case "list": {
        const options: any = {};
        if (params.filter_category) options.category = params.filter_category;
        if (params.unlocked_only) options.unlockedOnly = params.unlocked_only;
        if (params.include_hidden)
          options.includeHidden = params.include_hidden;

        const achievements = await achievementsService.getUserAchievements(
          userId,
          options,
        );

        return {
          action: "list",
          achievements,
          count: achievements.length,
          filters: options,
        };
      }

      case "get": {
        if (!params.achievement_id) {
          throw new Error("Missing required parameter: 'achievement_id'");
        }

        const achievement = await achievementsService.getAchievement(
          params.achievement_id,
          userId,
        );

        if (!achievement) {
          return {
            action: "get",
            success: false,
            error: "Achievement not found",
          };
        }

        return {
          action: "get",
          success: true,
          achievement,
        };
      }

      case "delete": {
        if (!params.achievement_id) {
          throw new Error("Missing required parameter: 'achievement_id'");
        }

        const deleted = await achievementsService.deleteAchievement(
          params.achievement_id,
          userId,
        );

        return {
          action: "delete",
          success: deleted,
          message: deleted
            ? "Achievement deleted successfully"
            : "Achievement not found",
        };
      }

      case "unlock": {
        if (!params.achievement_id) {
          throw new Error("Missing required parameter: 'achievement_id'");
        }

        const achievement = await achievementsService.unlockAchievement(
          params.achievement_id,
          userId,
        );

        return {
          action: "unlock",
          success: true,
          achievement,
          message: `Achievement '${achievement.title}' unlocked! 🎉`,
        };
      }

      case "get_stats": {
        const stats = await achievementsService.getStats(userId);

        return {
          action: "get_stats",
          success: true,
          stats,
        };
      }

      case "get_categories": {
        const categories = await achievementsService.getCategories(userId);

        return {
          action: "get_categories",
          success: true,
          categories,
        };
      }

      default:
        throw new Error(`Unknown achievements_management action: ${action}`);
    }
  }

  /**
   * Execute sub-agent actions
   * Spawns isolated sub-agents for complex subtasks
   */
  private async executeSubAgentAction(
    userId: string,
    action: string,
    params: Record<string, any>,
  ): Promise<any> {
    switch (action) {
      case "spawn": {
        // Validate required parameters
        if (!params.task) {
          throw new Error(
            "Missing required parameter: 'task' - describe what the sub-agent should accomplish",
          );
        }

        if (!params.task_description) {
          throw new Error(
            "Missing required parameter: 'task_description' - explain the sub-agent's mission",
          );
        }

        if (!params.tools || params.tools.length === 0) {
          throw new Error(
            "Missing required parameter: 'tools' - array of tool names the sub-agent can use (e.g., ['brave_search', 'curl'])",
          );
        }

        // Spawn the sub-agent
        const result = await subAgentRunner.spawn(userId, {
          task: params.task,
          taskDescription: params.task_description,
          tools: params.tools,
          maxIterations: params.max_iterations || 10,
          promptMode: params.prompt_mode || "minimal",
          timeout: params.timeout,
          parentContext: params.context,
          parentFlowId: params.parent_flow_id,
        });

        return {
          action: "spawn",
          success: result.success,
          result: result.result,
          toolsUsed: result.toolsUsed,
          iterations: result.iterations,
          executionTime: result.executionTime,
          flowId: result.flowId,
          error: result.error,
          message: result.success
            ? `Sub-agent completed task successfully in ${result.iterations} iteration(s)`
            : `Sub-agent failed: ${result.error}`,
        };
      }

      case "spawn_template": {
        // Spawn from a predefined template
        if (!params.template_id) {
          throw new Error(
            "Missing required parameter: 'template_id' - use 'list_templates' to see available templates",
          );
        }

        if (!params.task) {
          throw new Error(
            "Missing required parameter: 'task' - describe what the sub-agent should accomplish",
          );
        }

        const result = await subAgentRunner.spawnFromTemplate(
          userId,
          params.template_id,
          params.task,
          {
            parentFlowId: params.parent_flow_id,
            parentContext: params.context,
            additionalTools: params.additional_tools,
          },
        );

        return {
          action: "spawn_template",
          template: params.template_id,
          success: result.success,
          result: result.result,
          toolsUsed: result.toolsUsed,
          iterations: result.iterations,
          executionTime: result.executionTime,
          flowId: result.flowId,
          error: result.error,
          message: result.success
            ? `Sub-agent (${params.template_id}) completed task successfully`
            : `Sub-agent failed: ${result.error}`,
        };
      }

      case "list_templates": {
        // List available sub-agent templates
        return {
          action: "list_templates",
          templates: SUBAGENT_TEMPLATES.map((t) => ({
            id: t.id,
            name: t.name,
            description: t.description,
            defaultTools: t.defaultTools,
            maxIterations: t.maxIterations,
          })),
          count: SUBAGENT_TEMPLATES.length,
          message:
            "Use spawn_template with a template_id to quickly spawn a pre-configured sub-agent",
        };
      }

      case "get_status": {
        // Get status of active sub-agents
        const activeSubAgents = subAgentRunner.getActiveSubAgents();

        return {
          action: "get_status",
          activeSubAgents: activeSubAgents.map((s) => ({
            id: s.id,
            parentFlowId: s.parentFlowId,
            status: s.status,
            currentIteration: s.currentIteration,
            maxIterations: s.maxIterations,
            toolsUsed: s.toolsUsed,
            startTime: s.startTime,
            runningFor: Date.now() - s.startTime.getTime(),
          })),
          count: activeSubAgents.length,
        };
      }

      default:
        throw new Error(`Unknown spawn_subagent action: ${action}`);
    }
  }

  /**
   * Execute read_skill actions
   * Read skill instructions for specialized workflows
   */
  private async executeReadSkillAction(
    userId: string,
    action: string,
    params: Record<string, any>,
  ): Promise<any> {
    // Import skill manager dynamically to avoid circular dependency
    const { skillManager } = await import("./skill-manager.js");

    switch (action) {
      case "read": {
        if (!params.skill_id && !params.location) {
          throw new Error(
            "Missing required parameter: 'skill_id' or 'location' - specify which skill to read",
          );
        }

        // Extract skill slug from location (format: "skill:slug") or use skill_id directly
        let skillSlug = params.skill_id;
        if (params.location) {
          if (params.location.startsWith("skill:")) {
            skillSlug = params.location.replace("skill:", "");
          } else {
            skillSlug = params.location;
          }
        }

        // Get skill body (instructions only, without frontmatter)
        const body = await skillManager.getSkillBody(userId, skillSlug);

        if (!body) {
          throw new Error(
            `Skill not found: ${skillSlug}. Use the skills listed in available_skills.`,
          );
        }

        return {
          action: "read",
          skill_id: skillSlug,
          success: true,
          instructions: body,
          message: `Successfully read skill instructions for '${skillSlug}'. Follow these instructions for the current task.`,
        };
      }

      default:
        throw new Error(`Unknown read_skill action: ${action}`);
    }
  }

  /**
   * Execute read_tool_code actions
   * Read, analyze, and optionally fix the source code of generated tools
   */
  private async executeReadToolCodeAction(
    userId: string,
    action: string,
    params: Record<string, any>,
  ): Promise<any> {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();

    try {
      switch (action) {
        case "read": {
          if (!params.tool_id && !params.tool_name) {
            throw new Error(
              "Missing required parameter: 'tool_id' or 'tool_name' - specify which tool to read",
            );
          }

          const tool = await prisma.generatedTool.findFirst({
            where: {
              userId,
              OR: [
                { id: params.tool_id },
                { name: params.tool_name },
                { name: params.tool_id },
              ],
            },
          });

          if (!tool) {
            throw new Error(
              `Tool not found: ${params.tool_id || params.tool_name}. Use generate_tool with action 'list' to see available tools.`,
            );
          }

          return {
            action: "read",
            success: true,
            tool: {
              id: tool.id,
              name: tool.name,
              displayName: tool.displayName,
              description: tool.description,
              code: tool.code,
              inputSchema: tool.inputSchema,
              requiredSecrets: tool.requiredSecrets,
              version: tool.version,
              usageCount: tool.usageCount,
              lastError: tool.lastError,
              lastErrorAt: tool.lastErrorAt,
              enabled: tool.enabled,
            },
            message: `Successfully read tool code for '${tool.displayName}'. Review the code to understand its implementation.`,
          };
        }

        case "analyze": {
          if (!params.tool_id && !params.tool_name) {
            throw new Error(
              "Missing required parameter: 'tool_id' or 'tool_name' - specify which tool to analyze",
            );
          }

          const tool = await prisma.generatedTool.findFirst({
            where: {
              userId,
              OR: [
                { id: params.tool_id },
                { name: params.tool_name },
                { name: params.tool_id },
              ],
            },
          });

          if (!tool) {
            throw new Error(
              `Tool not found: ${params.tool_id || params.tool_name}`,
            );
          }

          // Get recent execution logs for error analysis
          const recentLogs = await prisma.toolExecutionLog.findMany({
            where: {
              toolId: tool.id,
              userId,
            },
            orderBy: { startedAt: "desc" },
            take: 10,
          });

          const errorLogs = recentLogs.filter((log) => !log.success);
          const successRate =
            recentLogs.length > 0
              ? ((recentLogs.length - errorLogs.length) / recentLogs.length) *
                100
              : 100;

          // Extract common error patterns
          const errorPatterns: Record<string, number> = {};
          for (const log of errorLogs) {
            const errorType = log.errorType || "unknown";
            errorPatterns[errorType] = (errorPatterns[errorType] || 0) + 1;
          }

          return {
            action: "analyze",
            success: true,
            tool: {
              id: tool.id,
              name: tool.name,
              displayName: tool.displayName,
              description: tool.description,
              code: tool.code,
            },
            analysis: {
              successRate: `${successRate.toFixed(1)}%`,
              totalExecutions: recentLogs.length,
              recentErrors: errorLogs.length,
              errorPatterns: Object.entries(errorPatterns).map(
                ([type, count]) => ({ type, count }),
              ),
              lastError: tool.lastError,
              lastErrorAt: tool.lastErrorAt,
              recentErrorMessages: errorLogs
                .slice(0, 5)
                .map((log) => log.error)
                .filter(Boolean),
            },
            message:
              successRate < 80
                ? `Tool '${tool.displayName}' has a ${successRate.toFixed(1)}% success rate. Consider using 'fix' action to repair it.`
                : `Tool '${tool.displayName}' is performing well with ${successRate.toFixed(1)}% success rate.`,
          };
        }

        case "fix": {
          if (!params.tool_id && !params.tool_name) {
            throw new Error(
              "Missing required parameter: 'tool_id' or 'tool_name' - specify which tool to fix",
            );
          }

          if (!params.fixed_code) {
            throw new Error(
              "Missing required parameter: 'fixed_code' - provide the corrected Python code",
            );
          }

          const tool = await prisma.generatedTool.findFirst({
            where: {
              userId,
              OR: [
                { id: params.tool_id },
                { name: params.tool_name },
                { name: params.tool_id },
              ],
            },
          });

          if (!tool) {
            throw new Error(
              `Tool not found: ${params.tool_id || params.tool_name}`,
            );
          }

          // Store previous version for potential rollback
          const previousCode = tool.code;
          const previousVersion = tool.version;

          // Validate the new code has basic Python structure
          const newCode = params.fixed_code.trim();
          if (!newCode.includes("def ") && !newCode.includes("result =")) {
            throw new Error(
              "Invalid fix: Code must define functions or set a 'result' variable",
            );
          }

          // Update the tool with the fixed code
          // Note: previousCode field stores the last version for immediate rollback
          const updatedTool = await prisma.generatedTool.update({
            where: { id: tool.id },
            data: {
              code: newCode,
              version: tool.version + 1,
              previousCode: previousCode, // Store for potential rollback
              lastError: null,
              lastErrorAt: null,
            },
          });

          // Log the fix action for audit trail
          await prisma.toolExecutionLog.create({
            data: {
              toolId: tool.id,
              userId,
              inputParams: {
                action: "fix",
                previousVersion,
                newVersion: updatedTool.version,
                fixReason: params.fix_reason || "Manual fix via read_tool_code",
              },
              success: true,
              result: { fixed: true },
              executionTimeMs: 0,
              startedAt: new Date(),
              completedAt: new Date(),
              triggeredBy: "read_tool_code",
            },
          });

          // Invalidate cache to use the new code
          dynamicToolRegistry.invalidateCache(userId);

          return {
            action: "fix",
            success: true,
            tool: {
              id: updatedTool.id,
              name: updatedTool.name,
              displayName: updatedTool.displayName,
              newVersion: updatedTool.version,
              previousVersion: previousVersion,
            },
            message: `Successfully updated tool '${updatedTool.displayName}' to version ${updatedTool.version}. Previous version saved for rollback if needed.`,
            tip: "Test the tool to verify the fix works correctly.",
          };
        }

        case "rollback": {
          if (!params.tool_id && !params.tool_name) {
            throw new Error(
              "Missing required parameter: 'tool_id' or 'tool_name' - specify which tool to rollback",
            );
          }

          const tool = await prisma.generatedTool.findFirst({
            where: {
              userId,
              OR: [
                { id: params.tool_id },
                { name: params.tool_name },
                { name: params.tool_id },
              ],
            },
          });

          if (!tool) {
            throw new Error(
              `Tool not found: ${params.tool_id || params.tool_name}`,
            );
          }

          if (!tool.previousCode) {
            throw new Error(
              `No previous version available for tool '${tool.displayName}'. Rollback not possible.`,
            );
          }

          const currentCode = tool.code;
          const currentVersion = tool.version;

          // Rollback to previous version
          const updatedTool = await prisma.generatedTool.update({
            where: { id: tool.id },
            data: {
              code: tool.previousCode,
              version: tool.version + 1,
              previousCode: currentCode, // Store current as new previous for potential re-rollback
              lastError: null,
              lastErrorAt: null,
            },
          });

          // Log the rollback action
          await prisma.toolExecutionLog.create({
            data: {
              toolId: tool.id,
              userId,
              inputParams: {
                action: "rollback",
                fromVersion: currentVersion,
                toVersion: updatedTool.version,
                reason: params.reason || "Manual rollback via read_tool_code",
              },
              success: true,
              result: { rolledBack: true },
              executionTimeMs: 0,
              startedAt: new Date(),
              completedAt: new Date(),
              triggeredBy: "read_tool_code",
            },
          });

          // Invalidate cache
          dynamicToolRegistry.invalidateCache(userId);

          return {
            action: "rollback",
            success: true,
            tool: {
              id: updatedTool.id,
              name: updatedTool.name,
              displayName: updatedTool.displayName,
              newVersion: updatedTool.version,
              rolledBackFromVersion: currentVersion,
            },
            message: `Successfully rolled back tool '${updatedTool.displayName}' to previous version.`,
          };
        }

        default:
          throw new Error(`Unknown read_tool_code action: ${action}`);
      }
    } finally {
      await prisma.$disconnect();
    }
  }

  /**
   * Execute curl actions
   */
  private async executeCurlAction(
    action: string,
    params: Record<string, any>,
  ): Promise<any> {
    switch (action) {
      case "request":
        return curlService.makeRequest({
          method: params.method || "GET",
          url: params.url,
          headers: params.headers,
          body: params.body,
          timeout: params.timeout,
          followRedirects: params.followRedirects,
          validateSsl: params.validateSsl,
        });

      case "get":
        return curlService.get(params.url, params.headers, params.timeout);

      case "post":
        return curlService.post(
          params.url,
          params.body,
          params.headers,
          params.timeout,
        );

      case "put":
        return curlService.put(
          params.url,
          params.body,
          params.headers,
          params.timeout,
        );

      case "delete":
        return curlService.delete(params.url, params.headers, params.timeout);

      case "patch":
        return curlService.patch(
          params.url,
          params.body,
          params.headers,
          params.timeout,
        );

      default:
        throw new Error(`Unknown curl action: ${action}`);
    }
  }

  /**
   * Execute Brave web search actions
   */
  private async executeBraveSearchAction(
    userId: string,
    action: string,
    params: Record<string, any>,
  ): Promise<any> {
    switch (action) {
      case "search": {
        const query = params.query || params.q;
        if (!query) {
          throw new Error(
            "Missing 'query' parameter. Provide the search query text.",
          );
        }

        return braveSearchService.searchWeb(userId, query, {
          count: params.count,
          offset: params.offset,
          country: params.country,
          searchLang: params.search_lang || params.searchLang,
          uiLang: params.ui_lang || params.uiLang,
          safesearch: params.safesearch,
          freshness: params.freshness,
          extraSnippets:
            params.extra_snippets !== undefined
              ? params.extra_snippets
              : params.extraSnippets,
          summary: params.summary,
          timeoutMs: params.timeout_ms ?? params.timeoutMs,
        });
      }

      default:
        throw new Error(`Unknown brave_search action: ${action}`);
    }
  }

  /**
   * Execute browser automation actions via Browserless
   */
  private async executeBrowserAction(
    action: string,
    params: Record<string, any>,
  ): Promise<any> {
    switch (action) {
      case "navigate": {
        if (!params.url) {
          throw new Error(
            "Missing 'url' parameter. Provide the URL to navigate to.",
          );
        }
        const result = await browserService.navigate({
          url: params.url,
          waitForSelector: params.wait_for_selector || params.waitForSelector,
          waitForNavigation:
            params.wait_for_navigation ?? params.waitForNavigation ?? true,
          timeout: params.timeout,
          blockResources:
            params.block_resources ?? params.blockResources ?? false,
          userAgent: params.user_agent || params.userAgent,
        });
        return {
          action: "navigate",
          ...result,
        };
      }

      case "get_content": {
        if (!params.url) {
          throw new Error(
            "Missing 'url' parameter. Provide the URL to fetch content from.",
          );
        }
        const result = await browserService.getContent({
          url: params.url,
          selector: params.selector,
          waitForSelector: params.wait_for_selector || params.waitForSelector,
          includeHtml: params.include_html ?? params.includeHtml ?? false,
          maxLength: params.max_length ?? params.maxLength ?? 50000,
          timeout: params.timeout,
        });
        return {
          action: "get_content",
          ...result,
        };
      }

      case "screenshot": {
        if (!params.url) {
          throw new Error(
            "Missing 'url' parameter. Provide the URL to screenshot.",
          );
        }
        const result = await browserService.screenshot({
          url: params.url,
          fullPage: params.full_page ?? params.fullPage ?? false,
          format: params.format || "png",
          quality: params.quality,
          width: params.width || 1920,
          height: params.height || 1080,
          selector: params.selector,
          waitForSelector: params.wait_for_selector || params.waitForSelector,
          timeout: params.timeout,
        });
        return {
          action: "screenshot",
          ...result,
          // Truncate base64 in response summary, full data is still available
          screenshotPreview: result.screenshot
            ? `[Base64 image, ${Math.round((result.screenshot.length * 3) / 4 / 1024)}KB]`
            : undefined,
        };
      }

      case "pdf": {
        if (!params.url) {
          throw new Error(
            "Missing 'url' parameter. Provide the URL to convert to PDF.",
          );
        }
        const result = await browserService.pdf({
          url: params.url,
          format: params.format || "A4",
          printBackground:
            params.print_background ?? params.printBackground ?? true,
          landscape: params.landscape ?? false,
          margin: params.margin,
          waitForSelector: params.wait_for_selector || params.waitForSelector,
          timeout: params.timeout,
        });
        return {
          action: "pdf",
          ...result,
          // Truncate base64 in response summary
          pdfPreview: result.pdf
            ? `[Base64 PDF, ${Math.round((result.pdf.length * 3) / 4 / 1024)}KB]`
            : undefined,
        };
      }

      case "scrape": {
        if (!params.url) {
          throw new Error(
            "Missing 'url' parameter. Provide the URL to scrape.",
          );
        }
        if (!params.selectors || typeof params.selectors !== "object") {
          throw new Error(
            "Missing or invalid 'selectors' parameter. Provide an object with named selectors, e.g., { title: { selector: 'h1' }, links: { selector: 'a', attribute: 'href', multiple: true } }",
          );
        }
        const result = await browserService.scrape({
          url: params.url,
          selectors: params.selectors,
          waitForSelector: params.wait_for_selector || params.waitForSelector,
          timeout: params.timeout,
        });
        return {
          action: "scrape",
          ...result,
        };
      }

      case "interact": {
        if (!params.url) {
          throw new Error(
            "Missing 'url' parameter. Provide the URL to interact with.",
          );
        }
        if (!params.actions || !Array.isArray(params.actions)) {
          throw new Error(
            "Missing or invalid 'actions' parameter. Provide an array of actions, e.g., [{ type: 'click', selector: '#button' }, { type: 'type', selector: '#input', value: 'hello' }]",
          );
        }
        const result = await browserService.interact({
          url: params.url,
          actions: params.actions,
          waitForSelector: params.wait_for_selector || params.waitForSelector,
          returnContent: params.return_content ?? params.returnContent ?? true,
          takeScreenshot:
            params.take_screenshot ?? params.takeScreenshot ?? false,
          timeout: params.timeout,
        });
        return {
          action: "interact",
          ...result,
        };
      }

      case "evaluate": {
        if (!params.url) {
          throw new Error(
            "Missing 'url' parameter. Provide the URL to evaluate JavaScript on.",
          );
        }
        if (!params.script) {
          throw new Error(
            "Missing 'script' parameter. Provide the JavaScript code to execute on the page.",
          );
        }
        const result = await browserService.evaluate(
          params.url,
          params.script,
          params.timeout,
        );
        return {
          action: "evaluate",
          ...result,
        };
      }

      case "health_check": {
        const result = await browserService.healthCheck();
        return {
          action: "health_check",
          browserless_available: result.available,
          version: result.version,
          error: result.error,
          message: result.available
            ? "Browserless service is running and ready"
            : "Browserless service is not available",
        };
      }

      default:
        throw new Error(
          `Unknown browser action: ${action}. Valid actions are: navigate, get_content, screenshot, pdf, scrape, interact, evaluate, health_check`,
        );
    }
  }

  /**
   * Execute code executor actions
   */
  private async executeCodeExecutorAction(
    action: string,
    params: Record<string, any>,
  ): Promise<any> {
    switch (action) {
      case "execute": {
        if (!params.code) {
          throw new Error("Missing 'code' parameter");
        }
        const result = await codeExecutorService.executeCode(
          params.code,
          params.timeout,
        );
        return {
          action: "execute",
          success: result.success,
          result: result.result,
          stdout: result.stdout,
          stderr: result.stderr,
          error: result.error,
          execution_time_ms: result.execution_time_ms,
          truncated: result.truncated,
          formatted_output: codeExecutorService.formatResult(result),
        };
      }

      case "validate": {
        if (!params.code) {
          throw new Error("Missing 'code' parameter");
        }
        const result = await codeExecutorService.validateCode(params.code);
        return {
          action: "validate",
          valid: result.valid,
          error: result.error,
        };
      }

      case "get_limits": {
        const limits = await codeExecutorService.getLimits();
        return {
          action: "get_limits",
          ...limits,
        };
      }

      case "get_examples": {
        const examples = await codeExecutorService.getExamples();
        return {
          action: "get_examples",
          examples,
        };
      }

      default:
        throw new Error(`Unknown code_executor action: ${action}`);
    }
  }

  /**
   * Execute user context actions
   */
  private async executeUserContextAction(
    userId: string,
    action: string,
    params: Record<string, any>,
  ): Promise<any> {
    switch (action) {
      case "get_location": {
        // Search for location-related memories with multiple query variations
        const queries = [
          "location address city country where I live",
          "I live in based in located in",
          "home address residence city country",
        ];

        // Try multiple queries and combine results
        let allResults: any[] = [];
        for (const query of queries) {
          const result = await memorySearchService.semanticSearch(
            userId,
            query,
            2,
          );
          allResults.push(...result.results);
        }

        // Deduplicate by memory ID and sort by score
        const seen = new Set();
        const uniqueResults = allResults
          .filter((r) => {
            if (seen.has(r.memory.id)) return false;
            seen.add(r.memory.id);
            return true;
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);

        return {
          action: "get_location",
          found: uniqueResults.length > 0,
          results: uniqueResults.map((r) => ({
            content: r.memory.content,
            score: r.score,
            date: r.memory.createdAt,
          })),
          hint:
            uniqueResults.length === 0
              ? "No location found in memories. Ask the user or check user_profile tool."
              : undefined,
        };
      }

      case "get_preferences": {
        // Search for preference-related memories
        const baseQuery = params.topic
          ? `preferences about ${params.topic} likes ${params.topic} favorite ${params.topic}`
          : "preferences likes dislikes favorite prefer";
        const result = await memorySearchService.semanticSearch(
          userId,
          baseQuery,
          params.limit || 5,
        );
        return {
          action: "get_preferences",
          topic: params.topic || "general",
          found: result.results.length > 0,
          results: result.results.map((r) => ({
            content: r.memory.content,
            score: r.score,
            date: r.memory.createdAt,
          })),
        };
      }

      case "search_facts": {
        // Search for specific facts about the user
        if (!params.query) {
          throw new Error(
            "Missing required parameter 'query' for search_facts action. " +
              "Provide a descriptive query about what you want to find (e.g., 'job occupation work', 'family members wife husband').",
          );
        }
        const result = await memorySearchService.semanticSearch(
          userId,
          params.query,
          params.limit || 5,
        );
        return {
          action: "search_facts",
          query: params.query,
          found: result.results.length > 0,
          resultsCount: result.results.length,
          results: result.results.map((r) => ({
            content: r.memory.content,
            score: r.score,
            date: r.memory.createdAt,
          })),
        };
      }

      default:
        throw new Error(
          `Unknown user_context action: ${action}. Valid actions are: get_location, get_preferences, search_facts`,
        );
    }
  }

  /**
   * Execute user profile actions - manage permanent user profile
   */
  private async executeUserProfileAction(
    userId: string,
    action: string,
    params: Record<string, any>,
  ): Promise<any> {
    switch (action) {
      case "get": {
        const profile = await userProfileService.getUserProfile(userId);
        return {
          action: "get",
          profile,
          isEmpty: Object.keys(profile).length === 0,
        };
      }

      case "update": {
        // Allow partial updates - merge with existing profile
        const updates: Partial<UserProfile> = {};

        // Map allowed fields from params to profile
        const allowedFields = [
          "name",
          "firstName",
          "lastName",
          "nickname",
          "age",
          "birthdate",
          "location",
          "timezone",
          "language",
          "occupation",
          "company",
          "industry",
          "skills",
          "workStyle",
          "communicationStyle",
          "preferredName",
          "interests",
          "hobbies",
          "currentGoals",
          "longTermGoals",
          "relationships",
          "dietaryPreferences",
          "exerciseHabits",
          "sleepSchedule",
          "custom",
        ];

        for (const field of allowedFields) {
          if (params[field] !== undefined) {
            (updates as any)[field] = params[field];
          }
        }

        if (Object.keys(updates).length === 0) {
          throw new Error(
            "At least one profile field must be provided for update",
          );
        }

        const updatedProfile = await userProfileService.mergeUserProfile(
          userId,
          updates,
        );

        return {
          action: "update",
          updatedFields: Object.keys(updates),
          profile: updatedProfile,
          message: `Profile updated successfully with fields: ${Object.keys(updates).join(", ")}`,
        };
      }

      case "delete_fields": {
        if (!params.fields || !Array.isArray(params.fields)) {
          throw new Error("fields array is required for delete_fields");
        }

        const updatedProfile = await userProfileService.deleteProfileFields(
          userId,
          params.fields as (keyof UserProfile)[],
        );

        return {
          action: "delete_fields",
          deletedFields: params.fields,
          profile: updatedProfile,
          message: `Fields deleted: ${params.fields.join(", ")}`,
        };
      }

      default:
        throw new Error(`Unknown user_profile action: ${action}`);
    }
  }

  /**
   * Execute long running task actions
   */
  private async executeLongRunningTaskAction(
    userId: string,
    action: string,
    params: Record<string, any>,
  ): Promise<any> {
    // Validate taskId for actions that require it
    const actionsRequiringTaskId = [
      "add_steps",
      "start",
      "pause",
      "resume",
      "cancel",
      "get",
      "get_progress",
      "get_report",
    ];
    if (actionsRequiringTaskId.includes(action) && !params.taskId) {
      throw new Error(
        `Missing required parameter 'taskId' for '${action}' action. ` +
          `Use 'create' first to get a taskId, or 'list' to find existing tasks.`,
      );
    }

    switch (action) {
      case "create": {
        // Validate required fields
        if (!params.name) {
          throw new Error(
            "Missing required parameter 'name' for create action",
          );
        }
        if (!params.description) {
          throw new Error(
            "Missing required parameter 'description' for create action",
          );
        }
        if (!params.objective) {
          throw new Error(
            "Missing required parameter 'objective' for create action",
          );
        }
        const task = await longRunningTaskService.createTask(userId, {
          name: params.name,
          description: params.description,
          objective: params.objective,
          estimatedDurationMinutes: params.estimatedDurationMinutes,
          priority: params.priority,
          completionBehavior: params.completionBehavior,
          notifyOnProgress: params.notifyOnProgress,
          progressIntervalMinutes: params.progressIntervalMinutes,
          metadata: params.metadata,
          initialContext: params.initialContext,
        });
        return {
          action: "create",
          taskId: task.id,
          name: task.name,
          status: task.status,
          message: `Task "${task.name}" created successfully. NEXT STEPS: 1) Use 'add_steps' with this taskId to define steps, then 2) Use 'start' to begin execution.`,
          nextAction: "add_steps",
        };
      }

      case "add_steps": {
        if (!params.steps || !Array.isArray(params.steps)) {
          throw new Error(
            "Missing required parameter 'steps' (array) for add_steps action. " +
              "Each step needs: name (string), action (string: llm_generate|wait|conditional|aggregate|notify), params (object).",
          );
        }
        if (params.steps.length === 0) {
          throw new Error("Steps array cannot be empty");
        }
        // Validate each step has required fields
        for (let i = 0; i < params.steps.length; i++) {
          const step = params.steps[i];
          if (!step.name) {
            throw new Error(`Step ${i + 1} is missing required field 'name'`);
          }
          if (!step.action) {
            throw new Error(
              `Step ${i + 1} (${step.name}) is missing required field 'action'`,
            );
          }
          if (!step.params) {
            throw new Error(
              `Step ${i + 1} (${step.name}) is missing required field 'params'`,
            );
          }
        }
        const steps = await longRunningTaskService.addSteps(
          params.taskId,
          params.steps,
        );
        return {
          action: "add_steps",
          taskId: params.taskId,
          stepsAdded: steps.length,
          message: `Added ${steps.length} steps to the task. NEXT: Use 'start' action with this taskId to begin execution.`,
          nextAction: "start",
        };
      }

      case "start": {
        await longRunningTaskService.startTask(userId, params.taskId);
        return {
          action: "start",
          taskId: params.taskId,
          message:
            "Task started. It will run in the background. Use 'get_progress' or 'get_report' to check status.",
        };
      }

      case "pause": {
        await longRunningTaskService.pauseTask(userId, params.taskId);
        return {
          action: "pause",
          taskId: params.taskId,
          message: "Task paused. Use 'resume' to continue execution.",
        };
      }

      case "resume": {
        await longRunningTaskService.resumeTask(userId, params.taskId);
        return {
          action: "resume",
          taskId: params.taskId,
          message: "Task resumed. It will continue from where it paused.",
        };
      }

      case "cancel": {
        await longRunningTaskService.cancelTask(userId, params.taskId);
        return {
          action: "cancel",
          taskId: params.taskId,
          message: "Task cancelled.",
        };
      }

      case "get": {
        const task = await longRunningTaskService.getTask(
          userId,
          params.taskId,
        );
        if (!task) {
          return { action: "get", found: false, error: "Task not found" };
        }
        return {
          action: "get",
          found: true,
          task: {
            id: task.id,
            name: task.name,
            description: task.description,
            objective: task.objective,
            status: task.status,
            progress: task.progress,
            totalSteps: task.totalSteps,
            completedSteps: task.steps.filter((s) => s.status === "COMPLETED")
              .length,
            currentStep: task.steps.find((s) => s.status === "RUNNING")?.name,
            startedAt: task.startedAt,
            completedAt: task.completedAt,
            errorMessage: task.errorMessage,
          },
        };
      }

      case "list": {
        const tasks = await longRunningTaskService.listTasks(userId, {
          status: params.status,
          priority: params.priority,
          limit: params.limit || 20,
        });
        return {
          action: "list",
          count: tasks.length,
          tasks: tasks.map((t) => ({
            id: t.id,
            name: t.name,
            status: t.status,
            progress: t.progress,
            priority: t.priority,
            createdAt: t.createdAt,
          })),
        };
      }

      case "get_progress": {
        const progress = await longRunningTaskService.getProgressSummary(
          userId,
          params.taskId,
        );
        if (!progress) {
          return {
            action: "get_progress",
            found: false,
            error: "Task not found",
          };
        }
        return {
          action: "get_progress",
          found: true,
          progress,
        };
      }

      case "get_report": {
        const report = await longRunningTaskService.generateProgressReport(
          userId,
          params.taskId,
        );
        return {
          action: "get_report",
          taskId: params.taskId,
          report,
        };
      }

      case "list_active": {
        const activeTasks = await longRunningTaskService.listTasks(userId, {
          status: ["RUNNING", "PAUSED"] as any,
          limit: 50,
        });
        return {
          action: "list_active",
          count: activeTasks.length,
          tasks: activeTasks.map((t) => ({
            id: t.id,
            name: t.name,
            status: t.status,
            progress: t.progress,
            currentStep: t.steps.find((s) => s.status === "RUNNING")?.name,
            startedAt: t.startedAt,
          })),
        };
      }

      default:
        throw new Error(
          `Unknown long_running_task action: ${action}. Valid actions are: create, add_steps, start, pause, resume, cancel, get, list, get_progress, get_report, list_active`,
        );
    }
  }

  /**
   * Execute todo actions
   */
  private async executeTodoAction(
    userId: string,
    action: string,
    params: Record<string, any>,
  ): Promise<any> {
    // Validate todoId for actions that require it
    const actionsRequiringTodoId = ["get", "update", "complete", "delete"];
    if (actionsRequiringTodoId.includes(action) && !params.todoId) {
      throw new Error(
        `Missing required parameter 'todoId' for '${action}' action. ` +
          `Use 'list' action first to find the todo ID, then use that ID with '${action}'.`,
      );
    }

    switch (action) {
      case "create":
        if (!params.title) {
          throw new Error(
            "Missing required parameter 'title' for create action",
          );
        }
        return todoService.createTodo(userId, {
          title: params.title,
          description: params.description,
          priority: params.priority as TodoPriority,
          category: params.category,
          tags: params.tags,
          dueDate: params.dueDate ? new Date(params.dueDate) : undefined,
          reminderAt: params.reminderAt
            ? new Date(params.reminderAt)
            : undefined,
          isRecurring: params.isRecurring,
          recurrenceRule: params.recurrenceRule,
        });

      case "get":
        return todoService.getTodo(userId, params.todoId);

      case "list":
        return todoService.listTodos(
          userId,
          {
            status: params.status,
            priority: params.priority,
            category: params.category,
            tags: params.tags,
            dueBefore: params.dueBefore
              ? new Date(params.dueBefore)
              : undefined,
            dueAfter: params.dueAfter ? new Date(params.dueAfter) : undefined,
            search: params.search,
            includeCompleted: params.includeCompleted,
          },
          {
            page: params.page,
            limit: params.limit,
            sortBy: params.sortBy,
            sortOrder: params.sortOrder,
          },
        );

      case "update":
        return todoService.updateTodo(userId, params.todoId, {
          title: params.title,
          description: params.description,
          status: params.status as TodoStatus,
          priority: params.priority as TodoPriority,
          category: params.category,
          tags: params.tags,
          dueDate: params.dueDate ? new Date(params.dueDate) : undefined,
          reminderAt: params.reminderAt
            ? new Date(params.reminderAt)
            : undefined,
        });

      case "complete":
        return todoService.completeTodo(userId, params.todoId);

      case "delete":
        return todoService.deleteTodo(userId, params.todoId);

      case "stats":
        return todoService.getTodoStats(userId);

      case "overdue":
        return todoService.getOverdueTodos(userId);

      case "due_soon":
        return todoService.getTodosDueSoon(userId, params.withinHours ?? 24);

      case "categories":
        return todoService.getCategories(userId);

      case "tags":
        return todoService.getTags(userId);

      default:
        throw new Error(
          `Unknown todo action: ${action}. Valid actions are: create, get, list, update, complete, delete, stats, overdue, due_soon, categories, tags`,
        );
    }
  }

  /**
   * Execute notification actions
   */
  private async executeNotificationAction(
    userId: string,
    action: string,
    params: Record<string, any>,
  ): Promise<any> {
    switch (action) {
      case "send":
        if (!params.title) {
          throw new Error("Missing required parameter 'title' for send action");
        }
        if (!params.message) {
          throw new Error(
            "Missing required parameter 'message' for send action",
          );
        }
        return notificationService.sendNotification(userId, {
          title: params.title,
          message: params.message,
          type: params.type as NotificationType,
          channels: params.channels,
          sourceType: params.sourceType,
          sourceId: params.sourceId,
          actionUrl: params.actionUrl,
          actionLabel: params.actionLabel,
          metadata: params.metadata || {},
        });

      case "schedule":
        if (!params.title) {
          throw new Error(
            "Missing required parameter 'title' for schedule action",
          );
        }
        if (!params.message) {
          throw new Error(
            "Missing required parameter 'message' for schedule action",
          );
        }
        if (!params.scheduledFor) {
          throw new Error(
            "Missing required parameter 'scheduledFor' (ISO date string) for schedule action",
          );
        }
        return notificationService.scheduleNotification(userId, {
          title: params.title,
          message: params.message,
          type: params.type as NotificationType,
          channels: params.channels,
          scheduledFor: new Date(params.scheduledFor),
          sourceType: params.sourceType,
          sourceId: params.sourceId,
          actionUrl: params.actionUrl,
          actionLabel: params.actionLabel,
          metadata: params.metadata || {},
        });

      case "get":
        if (!params.notificationId) {
          throw new Error(
            "Missing required parameter 'notificationId' for get action",
          );
        }
        const notification = await notificationService.getNotification(
          userId,
          params.notificationId,
        );
        if (!notification) {
          return { found: false, error: "Notification not found" };
        }
        return { found: true, notification };

      case "list":
        return notificationService.listNotifications(
          userId,
          {
            type: params.type,
            isRead: params.isRead,
            isDismissed: params.isDismissed,
            sourceType: params.sourceType,
            since: params.since ? new Date(params.since) : undefined,
          },
          {
            page: params.page || 1,
            limit: params.limit || 50,
            sortBy: params.sortBy || "createdAt",
            sortOrder: params.sortOrder || "desc",
          },
        );

      case "unread_count":
        const count = await notificationService.getUnreadCount(userId);
        return { unreadCount: count };

      case "mark_read":
        if (params.all === true) {
          return notificationService.markAllAsRead(userId);
        }
        if (!params.notificationId) {
          throw new Error(
            "Missing required parameter 'notificationId' for mark_read action (or set 'all: true' to mark all as read)",
          );
        }
        return notificationService.markAsRead(userId, params.notificationId);

      case "dismiss":
        if (!params.notificationId) {
          throw new Error(
            "Missing required parameter 'notificationId' for dismiss action",
          );
        }
        return notificationService.dismissNotification(
          userId,
          params.notificationId,
        );

      case "delete":
        if (!params.notificationId) {
          throw new Error(
            "Missing required parameter 'notificationId' for delete action",
          );
        }
        return notificationService.deleteNotification(
          userId,
          params.notificationId,
        );

      case "cancel_scheduled":
        if (!params.notificationId) {
          throw new Error(
            "Missing required parameter 'notificationId' for cancel_scheduled action",
          );
        }
        return notificationService.cancelScheduledNotification(
          userId,
          params.notificationId,
        );

      default:
        throw new Error(
          `Unknown notification action: ${action}. Valid actions are: send, schedule, get, list, unread_count, mark_read, dismiss, delete, cancel_scheduled`,
        );
    }
  }

  /**
   * Execute scheduled task actions
   */
  private async executeScheduledTaskAction(
    userId: string,
    action: string,
    params: Record<string, any>,
  ): Promise<any> {
    // Validate taskId for actions that require it
    const actionsRequiringTaskId = [
      "get",
      "update",
      "enable",
      "disable",
      "delete",
      "execute_now",
      "history",
    ];
    if (actionsRequiringTaskId.includes(action) && !params.taskId) {
      throw new Error(
        `Missing required parameter 'taskId' for '${action}' action. ` +
          `Use 'list' action first to find the task ID.`,
      );
    }

    switch (action) {
      case "create":
        // Validate required fields for create
        if (!params.name) {
          throw new Error(
            "Missing required parameter 'name' for create action",
          );
        }
        if (!params.scheduleType) {
          throw new Error(
            "Missing required parameter 'scheduleType'. Must be one of: ONE_TIME, CRON, INTERVAL",
          );
        }
        if (!params.actionType) {
          throw new Error(
            "Missing required parameter 'actionType'. Must be one of: SEND_NOTIFICATION, CREATE_TODO, GENERATE_SUMMARY, RUN_AGENT, WEBHOOK, CUSTOM",
          );
        }
        // Validate schedule-specific requirements
        if (params.scheduleType === "ONE_TIME" && !params.executeAt) {
          throw new Error(
            "Missing required parameter 'executeAt' (ISO date string) for ONE_TIME schedule type",
          );
        }
        if (params.scheduleType === "CRON" && !params.cronExpression) {
          throw new Error(
            "Missing required parameter 'cronExpression' for CRON schedule type. " +
              "Format: 'minute hour day-of-month month day-of-week' (5 fields). " +
              "Examples: '0 9 * * *' (daily 9 AM), '0 9 * * MON' (Mondays 9 AM), '*/30 * * * *' (every 30 min)",
          );
        }
        if (params.scheduleType === "INTERVAL" && !params.interval) {
          throw new Error(
            "Missing required parameter 'interval' (number of minutes) for INTERVAL schedule type",
          );
        }
        // Validate actionPayload for specific action types
        if (params.actionType === "SEND_NOTIFICATION") {
          if (!params.actionPayload?.title || !params.actionPayload?.message) {
            throw new Error(
              "For SEND_NOTIFICATION actionType, actionPayload must include 'title' and 'message'. " +
                "Example: { title: 'Reminder', message: 'Time for your daily review' }",
            );
          }
        }
        if (
          params.actionType === "CREATE_TODO" &&
          !params.actionPayload?.title
        ) {
          throw new Error(
            "For CREATE_TODO actionType, actionPayload must include 'title'. " +
              "Optional: description, priority (LOW/MEDIUM/HIGH/URGENT), dueDate, category, tags",
          );
        }
        if (params.actionType === "WEBHOOK" && !params.actionPayload?.url) {
          throw new Error(
            "For WEBHOOK actionType, actionPayload must include 'url'. " +
              "Optional: method (default: POST), headers, body",
          );
        }
        return scheduledTaskService.createTask(userId, {
          name: params.name,
          description: params.description,
          scheduleType: params.scheduleType as ScheduleType,
          cronExpression: params.cronExpression,
          executeAt: params.executeAt ? new Date(params.executeAt) : undefined,
          interval: params.interval,
          actionType: params.actionType as TaskActionType,
          actionPayload: params.actionPayload,
          maxRuns: params.maxRuns,
          expiresAt: params.expiresAt ? new Date(params.expiresAt) : undefined,
        });

      case "get":
        return scheduledTaskService.getTask(userId, params.taskId);

      case "list":
        return scheduledTaskService.listTasks(userId, {
          isEnabled: params.isEnabled,
          actionType: params.actionType,
          scheduleType: params.scheduleType,
        });

      case "update":
        return scheduledTaskService.updateTask(userId, params.taskId, {
          name: params.name,
          description: params.description,
          cronExpression: params.cronExpression,
          executeAt: params.executeAt ? new Date(params.executeAt) : undefined,
          interval: params.interval,
          actionPayload: params.actionPayload,
          isEnabled: params.isEnabled,
          maxRuns: params.maxRuns,
          expiresAt: params.expiresAt ? new Date(params.expiresAt) : undefined,
        });

      case "enable":
        return scheduledTaskService.enableTask(userId, params.taskId);

      case "disable":
        return scheduledTaskService.disableTask(userId, params.taskId);

      case "delete":
        return scheduledTaskService.deleteTask(userId, params.taskId);

      case "execute_now":
        return scheduledTaskService.executeTaskNow(userId, params.taskId);

      case "history":
        return scheduledTaskService.getTaskExecutions(
          userId,
          params.taskId,
          params.limit,
        );

      default:
        throw new Error(
          `Unknown scheduled task action: ${action}. Valid actions are: create, get, list, update, enable, disable, delete, execute_now, history`,
        );
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
    return this.executeBrowserAction(action, params);
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
    return [
      {
        name: "todo",
        description:
          "Manage user's todo list - create, read, update, delete, and complete tasks. You have full CRUD capability: list existing todos, create new ones, modify their properties (title, priority, due date, etc.), mark them complete, and delete them entirely. IMPORTANT: For update/complete/delete, you MUST first use 'list' to get the todoId.",
        parameters: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: [
                "create",
                "get",
                "list",
                "update",
                "complete",
                "delete",
                "stats",
                "overdue",
                "due_soon",
                "categories",
                "tags",
              ],
              description:
                "The action to perform. 'create': new todo (requires title). 'list': show todos (with optional filters). 'get/update/complete/delete': operate on specific todo (requires todoId from list). 'stats': get statistics. 'overdue': get overdue todos. 'due_soon': get todos due within hours.",
            },
            todoId: {
              type: "string",
              description:
                "ID of the todo - REQUIRED for get, update, complete, delete actions. ALWAYS use 'list' action first to find the todoId before using these actions.",
            },
            title: {
              type: "string",
              description:
                "Title of the todo (REQUIRED for create, optional for update)",
            },
            description: {
              type: "string",
              description: "Description of the todo (optional, can be updated)",
            },
            priority: {
              type: "string",
              enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
              description:
                "Priority level (default: MEDIUM, can be updated anytime)",
            },
            status: {
              type: "string",
              enum: ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
              description:
                "For 'list': FILTER by this status. For 'update': CHANGE the todo's status. To mark done, prefer 'complete' action over setting status to COMPLETED.",
            },
            category: {
              type: "string",
              description:
                "Category to organize todos (e.g., 'work', 'personal', 'health')",
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description:
                "Tags for the todo (replaces existing tags when updating)",
            },
            dueDate: {
              type: "string",
              description:
                "Due date in ISO format (e.g., '2024-12-31T23:59:59Z'). Can be updated or set to null to clear.",
            },
            search: {
              type: "string",
              description:
                "For 'list' action: search query that matches title and description",
            },
            includeCompleted: {
              type: "boolean",
              description:
                "For 'list' action: include completed todos (default: false)",
            },
            withinHours: {
              type: "number",
              description:
                "For 'due_soon' action: number of hours to look ahead (default: 24)",
            },
          },
          required: ["action"],
        },
      },
      {
        name: "notification",
        description:
          "Send and manage notifications to the user - immediate, scheduled, or manage existing ones. The system automatically selects the best delivery channel (Pushover for mobile if configured, otherwise browser). Use 'send' for immediate, 'schedule' for future delivery.",
        parameters: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: [
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
              description:
                "'send': send immediately (requires title, message). 'schedule': send later (requires title, message, scheduledFor). 'list': show notifications. 'get': get specific notification. 'unread_count': count unread. 'mark_read': mark as read (use notificationId or all:true). 'dismiss': hide notification. 'delete': permanently remove. 'cancel_scheduled': cancel a pending scheduled notification.",
            },
            notificationId: {
              type: "string",
              description:
                "ID of the notification - REQUIRED for get, mark_read (unless all:true), dismiss, delete, cancel_scheduled. Use 'list' to find IDs.",
            },
            title: {
              type: "string",
              description:
                "Title of the notification - REQUIRED for send and schedule actions",
            },
            message: {
              type: "string",
              description:
                "Message content - REQUIRED for send and schedule actions",
            },
            type: {
              type: "string",
              enum: [
                "INFO",
                "SUCCESS",
                "WARNING",
                "ERROR",
                "REMINDER",
                "ACHIEVEMENT",
              ],
              description:
                "Type of notification (default: INFO). Affects visual styling and priority.",
            },
            scheduledFor: {
              type: "string",
              description:
                "When to send the notification - REQUIRED for 'schedule' action. Use ISO 8601 format (e.g., '2024-12-31T09:00:00Z')",
            },
            all: {
              type: "boolean",
              description:
                "For 'mark_read' action: set to true to mark ALL notifications as read instead of a specific one",
            },
            isRead: {
              type: "boolean",
              description:
                "For 'list' action: filter by read status (true=read only, false=unread only, omit for all)",
            },
            since: {
              type: "string",
              description:
                "For 'list' action: only show notifications created after this ISO date",
            },
          },
          required: ["action"],
        },
      },
      {
        name: "scheduled_task",
        description:
          "Schedule tasks to run in the future. Supports one-time (executeAt), recurring (cron), and interval-based schedules. IMPORTANT: For 'create', you must provide: name, scheduleType, actionType, and schedule-specific params. For actionPayload, see the parameter description for required fields per actionType.",
        parameters: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: [
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
              description:
                "'create': new scheduled task. 'list': show all tasks. 'get/update/enable/disable/delete/execute_now/history': operate on specific task (requires taskId from list).",
            },
            taskId: {
              type: "string",
              description:
                "ID of the task - REQUIRED for get, update, enable, disable, delete, execute_now, history. Use 'list' action first to find taskId.",
            },
            name: {
              type: "string",
              description: "Name of the scheduled task - REQUIRED for create",
            },
            description: {
              type: "string",
              description: "Description of what the task does",
            },
            scheduleType: {
              type: "string",
              enum: ["ONE_TIME", "CRON", "INTERVAL"],
              description:
                "Type of schedule - REQUIRED for create. ONE_TIME: requires 'executeAt'. CRON: requires 'cronExpression'. INTERVAL: requires 'interval' (minutes).",
            },
            cronExpression: {
              type: "string",
              description:
                "Cron expression (5 fields: minute hour day-of-month month day-of-week). REQUIRED for CRON type. Examples: '0 9 * * *' (daily 9AM), '0 9 * * 1' (Mondays 9AM, 1=Monday), '0 */2 * * *' (every 2 hours), '30 8 1 * *' (1st of month 8:30AM). Uses server timezone.",
            },
            executeAt: {
              type: "string",
              description:
                "When to execute - REQUIRED for ONE_TIME type. ISO 8601 format (e.g., '2024-12-31T09:00:00Z')",
            },
            interval: {
              type: "number",
              description:
                "Minutes between executions - REQUIRED for INTERVAL type (e.g., 60 for hourly, 1440 for daily)",
            },
            actionType: {
              type: "string",
              enum: [
                "SEND_NOTIFICATION",
                "CREATE_TODO",
                "GENERATE_SUMMARY",
                "RUN_AGENT",
                "WEBHOOK",
                "CUSTOM",
              ],
              description:
                "Type of action when task runs - REQUIRED for create. Determines what actionPayload needs.",
            },
            actionPayload: {
              type: "object",
              description:
                "Parameters for the action - REQUIRED fields depend on actionType: " +
                "SEND_NOTIFICATION: {title: string, message: string, type?: 'INFO'|'REMINDER'|etc}. " +
                "CREATE_TODO: {title: string, description?: string, priority?: 'LOW'|'MEDIUM'|'HIGH'|'URGENT', dueDate?: ISO string, category?: string}. " +
                "WEBHOOK: {url: string, method?: 'GET'|'POST', headers?: object, body?: object}. " +
                "GENERATE_SUMMARY: {type?: 'daily'|'weekly', includeCategories?: string[]}. " +
                "RUN_AGENT: {agentId: string, prompt?: string, context?: object}. " +
                "CUSTOM: any object (for custom handlers).",
            },
            maxRuns: {
              type: "number",
              description:
                "Maximum number of times to run (for CRON/INTERVAL). After reaching this, task auto-disables.",
            },
            expiresAt: {
              type: "string",
              description:
                "When to stop running (ISO format). Task auto-disables after this date.",
            },
            isEnabled: {
              type: "boolean",
              description:
                "For 'list': filter by enabled status. For 'update': change enabled state.",
            },
          },
          required: ["action"],
        },
      },
      {
        name: "curl",
        description:
          "Make HTTP requests to external APIs and websites. Supports all HTTP methods with custom headers and body. For APIs requiring authentication, include the auth header (e.g., Bearer token). Response includes status code, headers, and body.",
        parameters: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: ["request", "get", "post", "put", "delete", "patch"],
              description:
                "'request': full control with method param. 'get/post/put/delete/patch': shorthand methods. Use 'get' for reading, 'post' for creating, 'put' for replacing, 'patch' for partial update, 'delete' for removing.",
            },
            url: {
              type: "string",
              description:
                "The URL to request - REQUIRED. Must be a valid HTTP/HTTPS URL (e.g., 'https://api.example.com/data')",
            },
            method: {
              type: "string",
              enum: [
                "GET",
                "POST",
                "PUT",
                "DELETE",
                "PATCH",
                "HEAD",
                "OPTIONS",
              ],
              description:
                "HTTP method - only needed with 'request' action. Otherwise use the action shortcuts.",
            },
            headers: {
              type: "object",
              description:
                "Custom HTTP headers as key-value object. Common headers: {'Authorization': 'Bearer <token>', 'Content-Type': 'application/json', 'Accept': 'application/json'}. Content-Type defaults to 'application/json' when body is an object.",
            },
            body: {
              type: "object",
              description:
                "Request body for POST/PUT/PATCH. Pass as an object (will be JSON-encoded automatically). For form data or other formats, use a string and set appropriate Content-Type header.",
            },
            timeout: {
              type: "number",
              description:
                "Request timeout in milliseconds (default: 30000, max: 30000). Increase for slow APIs.",
            },
            followRedirects: {
              type: "boolean",
              description:
                "Whether to follow HTTP redirects (default: true, max 5 redirects)",
            },
            validateSsl: {
              type: "boolean",
              description:
                "Validate SSL certificates (default: true). Set to false only for self-signed certs in development.",
            },
          },
          required: ["action", "url"],
        },
      },
      {
        name: "brave_search",
        description:
          "Search the public web via the Brave Search API. Requires an API key saved as secret 'BRAVE_SEARCH_API_KEY' (preferred) or environment variable BRAVE_SEARCH_API_KEY. If the key is missing, ask the user to provide it via the secrets.create tool before retrying.",
        parameters: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: ["search"],
              description: "Only 'search' is supported.",
            },
            query: {
              type: "string",
              description: "The search query text (required).",
            },
            count: {
              type: "number",
              description: "Number of results to return (1-20, default 10).",
            },
            offset: {
              type: "number",
              description: "Result page offset (0-9, default 0).",
            },
            country: {
              type: "string",
              description:
                "2-letter country code for localization (default 'us').",
            },
            search_lang: {
              type: "string",
              description: "Language to search in (default 'en').",
            },
            ui_lang: {
              type: "string",
              description: "Language for UI elements (default 'en-US').",
            },
            safesearch: {
              type: "string",
              enum: ["off", "moderate", "strict"],
              description: "Safe search level (default 'moderate').",
            },
            freshness: {
              type: "string",
              description:
                "Freshness filter: 'pd' (24h), 'pw' (week), 'pm' (month), 'py' (year).",
            },
            extra_snippets: {
              type: "boolean",
              description:
                "Return extra_snippets for results when available (default false).",
            },
            summary: {
              type: "boolean",
              description:
                "Ask Brave to include a summary block when supported (default false).",
            },
            timeout_ms: {
              type: "number",
              description:
                "Request timeout in milliseconds (default 12000, max 15000).",
            },
          },
          required: ["action", "query"],
        },
      },
      {
        name: "user_context",
        description:
          "Retrieve user context information from memory - location, preferences, and facts about the user. Use this to understand user's location, preferences, or search for specific information about them.",
        parameters: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: ["get_location", "get_preferences", "search_facts"],
              description:
                "The action to perform - get_location: retrieve user's location info, get_preferences: get user preferences (optionally on a topic), search_facts: search for specific facts",
            },
            topic: {
              type: "string",
              description:
                "Topic for preferences (optional, used with get_preferences action)",
            },
            query: {
              type: "string",
              description:
                "Search query for facts (required for search_facts action)",
            },
            limit: {
              type: "number",
              description:
                "Number of results to return (optional, default: 5, used with search_facts)",
            },
          },
          required: ["action"],
        },
      },
      {
        name: "long_running_task",
        description:
          "Start and manage long-lasting autonomous tasks that run in the background. Use for complex, multi-step operations that may take minutes to hours. " +
          "CRITICAL WORKFLOW: You MUST follow these 3 steps in order: 1) 'create' to get taskId, 2) 'add_steps' to define what the task does, 3) 'start' to begin execution. " +
          "Skipping steps will cause the task to fail or do nothing.",
        parameters: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: [
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
              description:
                "WORKFLOW: 1) 'create' → returns taskId. 2) 'add_steps' with taskId → defines steps. 3) 'start' with taskId → begins execution. Other actions: 'pause/resume/cancel': control running task. 'get/get_progress/get_report': check status. 'list/list_active': show tasks.",
            },
            taskId: {
              type: "string",
              description:
                "ID of the task - REQUIRED for add_steps, start, pause, resume, cancel, get, get_progress, get_report. Get this from 'create' response or 'list' action.",
            },
            name: {
              type: "string",
              description: "Name of the task - REQUIRED for 'create' action",
            },
            description: {
              type: "string",
              description:
                "Detailed description of the task - REQUIRED for 'create' action",
            },
            objective: {
              type: "string",
              description:
                "Clear statement of what the task should achieve - REQUIRED for 'create' action",
            },
            estimatedDurationMinutes: {
              type: "number",
              description:
                "Estimated duration in minutes (helps with progress display)",
            },
            priority: {
              type: "string",
              enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
              description: "Task priority level (default: MEDIUM)",
            },
            completionBehavior: {
              type: "string",
              enum: ["SILENT", "NOTIFY_USER", "NOTIFY_AND_SUMMARIZE"],
              description:
                "What happens when task completes. SILENT: nothing. NOTIFY_USER: send notification. NOTIFY_AND_SUMMARIZE: notification with full summary (default).",
            },
            notifyOnProgress: {
              type: "boolean",
              description:
                "Send periodic progress notifications while running (default: false)",
            },
            progressIntervalMinutes: {
              type: "number",
              description:
                "Minutes between progress notifications (only if notifyOnProgress is true)",
            },
            initialContext: {
              type: "object",
              description:
                "Initial data passed to all steps. Use for shared configuration or input data.",
            },
            steps: {
              type: "array",
              description:
                "Array of step definitions - REQUIRED for 'add_steps' action. Each step needs: name (string), action (enum), params (object). Steps execute in order.",
              items: {
                type: "object",
                properties: {
                  name: {
                    type: "string",
                    description: "Step name (shown in progress) - REQUIRED",
                  },
                  description: {
                    type: "string",
                    description: "What this step does",
                  },
                  action: {
                    type: "string",
                    enum: [
                      "llm_generate",
                      "wait",
                      "conditional",
                      "aggregate",
                      "notify",
                    ],
                    description:
                      "Step action type - REQUIRED. 'llm_generate': call LLM with params.prompt. 'wait': pause for params.seconds. 'conditional': branch based on params.condition. 'aggregate': combine results. 'notify': send notification with params.title/message.",
                  },
                  params: {
                    type: "object",
                    description:
                      "Action parameters - REQUIRED. For llm_generate: {prompt, model?, temperature?}. For wait: {seconds}. For notify: {title, message}. For conditional: {condition, ifTrue, ifFalse}.",
                  },
                  isCheckpoint: {
                    type: "boolean",
                    description:
                      "Create a checkpoint after this step (saves progress, allows resume)",
                  },
                  onError: {
                    type: "string",
                    enum: ["continue", "retry", "abort"],
                    description:
                      "What to do on error. 'continue': skip to next step. 'retry': retry up to maxRetries. 'abort': stop task (default).",
                  },
                  maxRetries: {
                    type: "number",
                    description:
                      "Max retry attempts if onError is 'retry' (default: 3)",
                  },
                },
                required: ["name", "action", "params"],
              },
            },
            status: {
              type: "array",
              items: {
                type: "string",
                enum: [
                  "PENDING",
                  "RUNNING",
                  "PAUSED",
                  "COMPLETED",
                  "FAILED",
                  "CANCELLED",
                ],
              },
              description: "For 'list' action: filter by these statuses",
            },
            limit: {
              type: "number",
              description:
                "For 'list' action: maximum results to return (default: 20)",
            },
          },
          required: ["action"],
        },
      },
      {
        name: "user_profile",
        description:
          "Manage the user's permanent profile - store important information about them (name, job, location, goals, etc.). This data is ALWAYS available to you without memory search. " +
          "IMPORTANT: When the user shares personal information, IMMEDIATELY use this tool to save it. " +
          "Array fields (skills, interests, hobbies, goals, relationships) are MERGED with existing data. To REPLACE an array entirely, use 'delete_fields' first then 'update'.",
        parameters: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: ["get", "update", "delete_fields"],
              description:
                "'get': retrieve current profile. 'update': add/modify fields (arrays are MERGED). 'delete_fields': remove specific fields (use to clear arrays before replacing).",
            },
            // Personal info
            name: {
              type: "string",
              description: "User's full name",
            },
            firstName: {
              type: "string",
              description: "User's first name",
            },
            lastName: {
              type: "string",
              description: "User's last name",
            },
            nickname: {
              type: "string",
              description: "User's nickname",
            },
            preferredName: {
              type: "string",
              description: "How the user wants to be addressed",
            },
            age: {
              type: "number",
              description: "User's age",
            },
            birthdate: {
              type: "string",
              description: "User's birthdate (ISO format, e.g., '1990-05-15')",
            },
            location: {
              type: "string",
              description: "User's location (city, country)",
            },
            timezone: {
              type: "string",
              description:
                "User's timezone (e.g., 'Europe/Paris', 'America/New_York')",
            },
            language: {
              type: "string",
              description: "User's preferred language",
            },
            // Professional
            occupation: {
              type: "string",
              description: "User's job/occupation",
            },
            company: {
              type: "string",
              description: "User's company/employer",
            },
            industry: {
              type: "string",
              description: "User's industry",
            },
            skills: {
              type: "array",
              items: { type: "string" },
              description:
                "User's skills - MERGED with existing (to replace, delete_fields first)",
            },
            workStyle: {
              type: "string",
              description: "User's work style preferences",
            },
            // Preferences
            communicationStyle: {
              type: "string",
              description:
                "How user prefers AI to communicate (e.g., 'concise', 'detailed', 'casual', 'formal')",
            },
            interests: {
              type: "array",
              items: { type: "string" },
              description: "User's interests - MERGED with existing",
            },
            hobbies: {
              type: "array",
              items: { type: "string" },
              description: "User's hobbies - MERGED with existing",
            },
            // Goals
            currentGoals: {
              type: "array",
              items: { type: "string" },
              description:
                "User's current goals - MERGED with existing (duplicates auto-ignored)",
            },
            longTermGoals: {
              type: "array",
              items: { type: "string" },
              description: "User's long-term goals - MERGED with existing",
            },
            // Relationships
            relationships: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Person's name" },
                  relation: {
                    type: "string",
                    description:
                      "Relationship type (e.g., 'wife', 'colleague', 'friend', 'boss')",
                  },
                  notes: {
                    type: "string",
                    description: "Additional notes about this person",
                  },
                },
                required: ["name", "relation"],
              },
              description:
                "Important people in user's life - MERGED by name (existing person updated, new person added)",
            },
            // Health & Lifestyle
            dietaryPreferences: {
              type: "string",
              description:
                "User's dietary preferences/restrictions (e.g., 'vegetarian', 'no gluten')",
            },
            exerciseHabits: {
              type: "string",
              description: "User's exercise habits",
            },
            sleepSchedule: {
              type: "string",
              description: "User's typical sleep schedule",
            },
            // Custom
            custom: {
              type: "object",
              description:
                "Any other important information as key-value pairs (MERGED with existing custom data)",
            },
            // For delete_fields action
            fields: {
              type: "array",
              items: { type: "string" },
              description:
                "For 'delete_fields': array of field names to remove (e.g., ['skills', 'hobbies'] to clear those arrays)",
            },
          },
          required: ["action"],
        },
      },
      {
        name: "code_executor",
        description:
          "Execute Python code in a secure sandbox. Use for calculations, data processing, algorithms, statistics. " +
          "CRITICAL: You MUST use print() to output results - return values are NOT captured. " +
          "Example: Instead of 'result = 42 * 17\nresult', write 'result = 42 * 17\nprint(result)'. " +
          "Available modules: math, random, datetime, json, re, itertools, functools, collections, string, decimal, fractions, statistics, operator, copy, textwrap, unicodedata. " +
          "No filesystem or network access.",
        parameters: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: ["execute", "validate", "get_limits", "get_examples"],
              description:
                "'execute': run Python code (use print() for output!). 'validate': check syntax without running. 'get_limits': see constraints. 'get_examples': see code examples.",
            },
            code: {
              type: "string",
              description:
                "Python code to execute - REQUIRED for execute/validate. IMPORTANT: Use print() for ALL output. " +
                "WRONG: 'x = 5 + 3\nx' (returns nothing). " +
                "RIGHT: 'x = 5 + 3\nprint(x)' (outputs 8). " +
                "For multiple values: 'print(f\"Sum: {a+b}, Product: {a*b}\")'.",
            },
            timeout: {
              type: "number",
              description:
                "Max execution time in seconds (default: 30, max: 30). Increase for complex calculations.",
            },
          },
          required: ["action"],
        },
      },
      {
        name: "generate_tool",
        description:
          "Generate, manage, and execute custom AI-created tools. Use 'generate' to create a new tool from a detailed objective. " +
          "The AI writes Python code, tests it, and saves it for reuse. Generated tools can make HTTP requests and use API keys from secrets. " +
          "Before generating, use 'secrets' tool to check if required API keys exist.",
        parameters: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: ["generate", "list", "get", "execute", "delete", "search"],
              description:
                "'generate': create new tool (requires objective). 'list': show all tools. 'get': view tool details/code. 'execute': run a tool (requires tool_id/name + params). 'delete': remove a tool. 'search': find tools by keyword.",
            },
            objective: {
              type: "string",
              description:
                "For 'generate': DETAILED description of what the tool should do. " +
                "GOOD: 'Get current weather for a city using OpenWeatherMap API. Input: city name. Output: temperature (Celsius), conditions, humidity.' " +
                "BAD: 'Make weather tool' (too vague). " +
                "Include: what it does, required inputs, expected outputs, which API to use if applicable.",
            },
            context: {
              type: "string",
              description:
                "For 'generate': additional context from conversation (e.g., user's specific requirements, error from previous attempt)",
            },
            suggestedSecrets: {
              type: "array",
              items: { type: "string" },
              description:
                "For 'generate': API key names the tool might need (e.g., ['openweathermap_api_key']). Check with 'secrets' tool first!",
            },
            tool_id: {
              type: "string",
              description:
                "For 'get', 'execute', 'delete': the tool ID (from 'list' or 'generate' response)",
            },
            name: {
              type: "string",
              description:
                "For 'get', 'execute': the tool name (alternative to tool_id)",
            },
            params: {
              type: "object",
              description:
                "For 'execute': parameters to pass to the tool. Check tool's inputSchema (via 'get') to see required params.",
            },
            query: {
              type: "string",
              description:
                "For 'search': keyword to search in tool names/descriptions",
            },
            category: {
              type: "string",
              description: "For 'list': filter by category",
            },
          },
          required: ["action"],
        },
      },
      {
        name: "secrets",
        description:
          "Manage user API keys and secrets. Use to check, create, or update secrets needed for generated tools. " +
          "IMPORTANT: You can NEVER read/retrieve the actual value of a secret - only list, check existence, create, or update.",
        parameters: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: ["list", "check", "has", "create", "update"],
              description:
                "'list': show all configured secret names (grouped by category). 'check': verify if multiple keys exist. 'has': check single key existence. 'create': store a new API key or secret. 'update': update the value of an existing secret.",
            },
            keys: {
              type: "array",
              items: { type: "string" },
              description:
                "For 'check': array of secret key names to verify (e.g., ['openweathermap_api_key', 'google_maps_key'])",
            },
            key: {
              type: "string",
              description:
                "For 'has', 'create', 'update': the secret key name (e.g., 'openweathermap_api_key')",
            },
            value: {
              type: "string",
              description:
                "For 'create' or 'update': the actual secret value (API key, token, etc.)",
            },
            displayName: {
              type: "string",
              description:
                "For 'create': human-readable name for the secret (e.g., 'OpenWeatherMap API Key')",
            },
            description: {
              type: "string",
              description:
                "For 'create': optional description of what this secret is used for",
            },
            category: {
              type: "string",
              description:
                "For 'list' or 'create': secret category (e.g., 'api_keys', 'oauth', 'database')",
            },
          },
          required: ["action"],
        },
      },
      {
        name: "goals_management",
        description:
          "Create, update, track, and manage user goals. Monitor progress, set milestones, update status, and organize goals by category. Use for goal setting, progress tracking, milestone management, and goal lifecycle management.",
        parameters: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: [
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
              description:
                "'create': new goal. 'update': modify existing goal. 'list': get all goals (with filters). 'get': get specific goal. 'delete': remove goal. 'update_progress': set progress percentage. 'add_milestone': add milestone to goal. 'get_stats': goal statistics. 'get_categories': available categories.",
            },
            goal_id: {
              type: "string",
              description:
                "Goal ID (required for update, get, delete, update_progress, add_milestone)",
            },
            title: {
              type: "string",
              description:
                "Goal title (required for create, optional for update)",
            },
            description: {
              type: "string",
              description: "Goal description (optional)",
            },
            category: {
              type: "string",
              description:
                "Goal category (e.g., 'health', 'career', 'learning', 'personal_growth', 'finance', 'relationships')",
            },
            status: {
              type: "string",
              enum: ["ACTIVE", "COMPLETED", "PAUSED", "ARCHIVED", "ABANDONED"],
              description: "Goal status (for update)",
            },
            progress: {
              type: "number",
              description:
                "Progress percentage (0-100, for update_progress or update)",
            },
            target_date: {
              type: "string",
              description:
                "Target completion date (ISO format: YYYY-MM-DD, optional)",
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Goal tags (optional)",
            },
            milestone_name: {
              type: "string",
              description: "Milestone name (required for add_milestone)",
            },
            milestone_completed: {
              type: "boolean",
              description:
                "Whether milestone is completed (for add_milestone, default false)",
            },
            // Filter options for list
            filter_status: {
              type: "string",
              description: "Filter by status (for list)",
            },
            filter_category: {
              type: "string",
              description: "Filter by category (for list)",
            },
            include_archived: {
              type: "boolean",
              description: "Include archived goals (for list, default false)",
            },
          },
          required: ["action"],
        },
      },
      {
        name: "achievements_management",
        description:
          "Create, unlock, and manage user achievements. Track accomplishments, celebrate milestones, and organize achievements by category. Use for achievement creation, unlocking, progress tracking, and celebration.",
        parameters: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: [
                "create",
                "update",
                "list",
                "get",
                "delete",
                "unlock",
                "get_stats",
                "get_categories",
              ],
              description:
                "'create': new achievement. 'update': modify existing achievement. 'list': get all achievements (with filters). 'get': get specific achievement. 'delete': remove achievement. 'unlock': unlock achievement for user. 'get_stats': achievement statistics. 'get_categories': available categories.",
            },
            achievement_id: {
              type: "string",
              description:
                "Achievement ID (required for update, get, delete, unlock)",
            },
            title: {
              type: "string",
              description:
                "Achievement title (required for create, optional for update)",
            },
            description: {
              type: "string",
              description:
                "Achievement description (required for create, optional for update)",
            },
            category: {
              type: "string",
              description:
                "Achievement category (e.g., 'consistency', 'milestone', 'personal_growth', 'skill_mastery', 'social', 'health')",
            },
            icon: {
              type: "string",
              description:
                "Achievement icon (emoji or icon identifier, optional)",
            },
            significance: {
              type: "string",
              enum: ["minor", "normal", "major", "milestone"],
              description: "Achievement significance level (default: normal)",
            },
            criteria: {
              type: "object",
              description:
                "Achievement criteria (flexible JSON object describing unlock conditions)",
            },
            is_hidden: {
              type: "boolean",
              description:
                "Whether achievement is hidden until unlocked (default true for create)",
            },
            // Filter options for list
            filter_category: {
              type: "string",
              description: "Filter by category (for list)",
            },
            unlocked_only: {
              type: "boolean",
              description:
                "Show only unlocked achievements (for list, default false)",
            },
            include_hidden: {
              type: "boolean",
              description:
                "Include hidden achievements (for list, default false)",
            },
          },
          required: ["action"],
        },
      },
      {
        name: "spawn_subagent",
        description:
          "Spawn a focused sub-agent for complex subtasks. Sub-agents run in isolated contexts with limited tools and iterations. " +
          "Use when: (1) A task requires multiple tool calls that don't need main context, (2) You want to delegate research or data gathering, " +
          "(3) A subtask is complex enough to benefit from focused attention. " +
          "Sub-agents CANNOT spawn other sub-agents and have a maximum of 15 iterations.",
        parameters: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: ["spawn", "spawn_template", "list_templates", "get_status"],
              description:
                "'spawn': spawn a custom sub-agent with specific tools. 'spawn_template': use a predefined template. 'list_templates': see available templates. 'get_status': check active sub-agents.",
            },
            // For spawn action
            task: {
              type: "string",
              description:
                "The specific task for the sub-agent to accomplish. Be clear and detailed. (Required for spawn/spawn_template)",
            },
            task_description: {
              type: "string",
              description:
                "Human-readable description of the sub-agent's mission. Explains the purpose and expected outcome. (Required for spawn)",
            },
            tools: {
              type: "array",
              items: { type: "string" },
              description:
                "Array of tool names the sub-agent can use (e.g., ['brave_search', 'curl', 'code_executor']). (Required for spawn)",
            },
            max_iterations: {
              type: "number",
              description:
                "Maximum LLM iterations for the sub-agent (default: 10, max: 15). Lower for simple tasks.",
            },
            timeout: {
              type: "number",
              description:
                "Timeout in milliseconds (default: 120000 = 2 minutes). Increase for complex tasks.",
            },
            context: {
              type: "string",
              description:
                "Optional context from the main conversation to provide to the sub-agent.",
            },
            // For spawn_template action
            template_id: {
              type: "string",
              description:
                "Template ID to use (e.g., 'research', 'scheduler', 'data_processor', 'task_manager'). Use list_templates to see all.",
            },
            additional_tools: {
              type: "array",
              items: { type: "string" },
              description:
                "Additional tools to add to the template's default tools. (For spawn_template)",
            },
          },
          required: ["action"],
        },
      },
      {
        name: "read_tool_code",
        description:
          "Read and analyze the source code of generated tools to understand their implementation, diagnose errors, or apply fixes. " +
          "Use 'read' to see the full code. Use 'analyze' to get error statistics and patterns. Use 'fix' to update broken code proactively. " +
          "Use 'rollback' to revert to the previous version if a fix made things worse. " +
          "This tool helps you understand how generated tools work and repair them when they fail.",
        parameters: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: ["read", "analyze", "fix", "rollback"],
              description:
                "'read': view full source code and metadata. 'analyze': get error statistics, success rate, and common failure patterns. 'fix': apply corrected code to repair the tool. 'rollback': revert to the previous code version.",
            },
            tool_id: {
              type: "string",
              description:
                "The tool ID to read/analyze/fix/rollback (from 'generate_tool list' response)",
            },
            tool_name: {
              type: "string",
              description: "The tool name (alternative to tool_id)",
            },
            fixed_code: {
              type: "string",
              description:
                "For 'fix' action: the corrected Python code. Must define functions or set a 'result' variable. " +
                "Important: Keep the same structure and params as the original tool.",
            },
            fix_reason: {
              type: "string",
              description:
                "For 'fix' action: explanation of what was fixed (stored for history)",
            },
            reason: {
              type: "string",
              description:
                "For 'rollback' action: reason for the rollback (stored for audit)",
            },
          },
          required: ["action"],
        },
      },
      {
        name: "browser",
        description:
          "Interact with web pages through a headless browser (Browserless/Chrome). " +
          "Use for: navigating dynamic sites, extracting content from JavaScript-rendered pages, taking screenshots, " +
          "generating PDFs, scraping structured data, filling forms, clicking buttons, and running JavaScript. " +
          "More powerful than curl for sites requiring JavaScript execution.",
        parameters: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: [
                "navigate",
                "get_content",
                "screenshot",
                "pdf",
                "scrape",
                "interact",
                "evaluate",
                "health_check",
              ],
              description:
                "'navigate': load page and get basic info (title, URL, status). " +
                "'get_content': extract text content, links, and metadata. " +
                "'screenshot': capture visual snapshot. " +
                "'pdf': generate PDF document. " +
                "'scrape': extract structured data using CSS selectors. " +
                "'interact': perform actions (click, type, scroll) on page. " +
                "'evaluate': run custom JavaScript on page. " +
                "'health_check': verify browserless service is available.",
            },
            url: {
              type: "string",
              description:
                "The URL to navigate to (REQUIRED for all actions except health_check)",
            },
            // For get_content action
            selector: {
              type: "string",
              description:
                "CSS selector to extract specific element content (for get_content/screenshot)",
            },
            include_html: {
              type: "boolean",
              description:
                "Include raw HTML in response (for get_content, default: false)",
            },
            max_length: {
              type: "number",
              description:
                "Maximum text length to return (for get_content, default: 50000)",
            },
            // For screenshot action
            full_page: {
              type: "boolean",
              description:
                "Capture full page including scrollable area (for screenshot, default: false)",
            },
            format: {
              type: "string",
              enum: ["png", "jpeg", "webp"],
              description: "Image format (for screenshot, default: png)",
            },
            quality: {
              type: "number",
              description: "Image quality 0-100 for jpeg/webp (for screenshot)",
            },
            width: {
              type: "number",
              description:
                "Viewport width in pixels (for screenshot, default: 1920)",
            },
            height: {
              type: "number",
              description:
                "Viewport height in pixels (for screenshot, default: 1080)",
            },
            // For pdf action
            paper_format: {
              type: "string",
              enum: ["A4", "Letter", "Legal", "Tabloid"],
              description: "Paper format (for pdf, default: A4)",
            },
            print_background: {
              type: "boolean",
              description: "Print background graphics (for pdf, default: true)",
            },
            landscape: {
              type: "boolean",
              description:
                "Use landscape orientation (for pdf, default: false)",
            },
            // For scrape action
            selectors: {
              type: "object",
              description:
                "Object mapping field names to selector configs. " +
                "Each config has: selector (CSS), attribute (optional, e.g., 'href'), multiple (optional boolean). " +
                "Example: { title: { selector: 'h1' }, links: { selector: 'a', attribute: 'href', multiple: true } }",
            },
            // For interact action
            actions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: {
                    type: "string",
                    enum: [
                      "click",
                      "type",
                      "select",
                      "scroll",
                      "wait",
                      "evaluate",
                    ],
                    description: "Action type",
                  },
                  selector: {
                    type: "string",
                    description: "CSS selector for the element",
                  },
                  value: {
                    type: "string",
                    description: "Value for type/select actions",
                  },
                  delay: {
                    type: "number",
                    description: "Delay in ms before action",
                  },
                  direction: {
                    type: "string",
                    enum: ["up", "down", "top", "bottom"],
                    description: "Scroll direction (for scroll action)",
                  },
                  amount: {
                    type: "number",
                    description: "Scroll amount in pixels (for scroll action)",
                  },
                  duration: {
                    type: "number",
                    description: "Wait duration in ms (for wait action)",
                  },
                  script: {
                    type: "string",
                    description: "JavaScript to execute (for evaluate action)",
                  },
                },
              },
              description:
                "Array of actions to perform in sequence. " +
                "Example: [{ type: 'click', selector: '#login' }, { type: 'type', selector: '#username', value: 'user' }]",
            },
            return_content: {
              type: "boolean",
              description:
                "Return page text content after interactions (for interact, default: true)",
            },
            take_screenshot: {
              type: "boolean",
              description:
                "Take screenshot after interactions (for interact, default: false)",
            },
            // For evaluate action
            script: {
              type: "string",
              description:
                "JavaScript code to execute on the page (for evaluate). " +
                "Code runs in page context and can return values.",
            },
            // Common options
            wait_for_selector: {
              type: "string",
              description:
                "Wait for this CSS selector to appear before proceeding",
            },
            timeout: {
              type: "number",
              description: "Timeout in milliseconds (default: 30000)",
            },
            block_resources: {
              type: "boolean",
              description:
                "Block images, fonts, CSS for faster loading (for navigate, default: false)",
            },
            user_agent: {
              type: "string",
              description: "Custom user agent string",
            },
          },
          required: ["action"],
        },
      },
    ];
  }

  /**
   * Get tool schemas including dynamically generated tools
   */
  async getToolSchemasWithGenerated(userId: string): Promise<any[]> {
    const builtinSchemas = this.getToolSchemas();
    const generatedSchemas = await dynamicToolRegistry.getToolSchemas(userId);

    return [...builtinSchemas, ...generatedSchemas];
  }
}

export const toolExecutorService = new ToolExecutorService();
