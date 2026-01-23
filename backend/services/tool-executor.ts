// Tool Executor Service
// Safely executes external operations and built-in tools

import {
  todoService,
  notificationService,
  scheduledTaskService,
  curlService,
  longRunningTaskService,
} from "./tools/index.js";
import { memorySearchService } from "./memory-search.js";
import { userProfileService, UserProfile } from "./user-profile.js";
import { codeExecutorService } from "./code-executor-wrapper.js";
import { dynamicToolRegistry } from "./dynamic-tool-registry.js";
import { dynamicToolGeneratorService } from "./dynamic-tool-generator.js";
import { secretsService } from "./secrets.js";
import {
  TodoStatus,
  TodoPriority,
  ScheduleType,
  TaskActionType,
  NotificationType,
} from "@prisma/client";

export interface ToolConfig {
  id: string;
  name: string;
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

// Built-in tool definitions
const BUILTIN_TOOLS: ToolConfig[] = [
  {
    id: "todo",
    name: "Todo List",
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
    category: "builtin",
    enabled: true,
    rateLimit: 50,
    timeout: 5000,
    config: {
      description: "Send notifications to the user",
      actions: [
        "send",
        "schedule",
        "list",
        "mark_read",
        "dismiss",
        "unread_count",
      ],
    },
  },
  {
    id: "scheduled_task",
    name: "Scheduled Tasks",
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
    category: "builtin",
    enabled: true,
    rateLimit: 5,
    timeout: 120000,
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
        "Manage user secrets like API keys for generated tools. List available secrets, check if required secrets exist. Never expose secret values - only check existence.",
      actions: ["list", "check", "has"],
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
          data = await this.executeBuiltinTool(userId, request);
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
      case "user_context":
        return this.executeUserContextAction(userId, action, params);
      case "user_profile":
        return this.executeUserProfileAction(userId, action, params);
      case "long_running_task":
        return this.executeLongRunningTaskAction(userId, action, params);
      case "code_executor":
        return this.executeCodeExecutorAction(action, params);
      case "generate_tool":
        return this.executeGenerateToolAction(userId, action, params);
      case "secrets":
        return this.executeSecretsAction(userId, action, params);
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
    const result = await dynamicToolRegistry.executeTool(userId, toolName, params);
    
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
   */
  private async executeGenerateToolAction(
    userId: string,
    action: string,
    params: Record<string, any>,
  ): Promise<any> {
    switch (action) {
      case "generate": {
        if (!params.objective) {
          throw new Error("Missing 'objective' parameter - describe what the tool should do");
        }
        
        const result = await dynamicToolGeneratorService.generateTool(userId, {
          objective: params.objective,
          context: params.context,
          suggestedSecrets: params.suggestedSecrets || params.required_secrets,
        });
        
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
        
        const deleted = await dynamicToolGeneratorService.deleteTool(userId, params.tool_id);
        
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
        
        const tools = await dynamicToolRegistry.searchTools(userId, params.query);
        
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
        const secrets = await secretsService.listSecrets(userId, params.category);
        
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
        
        const result = await secretsService.checkSecretsExist(userId, params.keys);
        
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

      default:
        throw new Error(`Unknown secrets action: ${action}`);
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
        // Search for location-related memories
        const result = await memorySearchService.semanticSearch(
          userId,
          "location address city country where I live",
          3,
        );
        return {
          action: "get_location",
          found: result.results.length > 0,
          results: result.results.map((r) => ({
            content: r.memory.content,
            score: r.score,
            date: r.memory.createdAt,
          })),
        };
      }

      case "get_preferences": {
        // Search for preference-related memories
        const query = params.topic
          ? `preferences about ${params.topic}`
          : "preferences likes dislikes favorite";
        const result = await memorySearchService.semanticSearch(
          userId,
          query,
          5,
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
          throw new Error("query parameter is required for search_facts");
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
          results: result.results.map((r) => ({
            content: r.memory.content,
            score: r.score,
            date: r.memory.createdAt,
          })),
        };
      }

      default:
        throw new Error(`Unknown user_context action: ${action}`);
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
    switch (action) {
      case "create": {
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
          message: `Task "${task.name}" created successfully. Add steps and then start the task.`,
        };
      }

      case "add_steps": {
        if (!params.taskId) {
          throw new Error("taskId is required");
        }
        if (!params.steps || !Array.isArray(params.steps)) {
          throw new Error("steps array is required");
        }
        const steps = await longRunningTaskService.addSteps(
          params.taskId,
          params.steps,
        );
        return {
          action: "add_steps",
          taskId: params.taskId,
          stepsAdded: steps.length,
          message: `Added ${steps.length} steps to the task.`,
        };
      }

      case "start": {
        if (!params.taskId) {
          throw new Error("taskId is required");
        }
        await longRunningTaskService.startTask(userId, params.taskId);
        return {
          action: "start",
          taskId: params.taskId,
          message: "Task started. It will run in the background.",
        };
      }

      case "pause": {
        if (!params.taskId) {
          throw new Error("taskId is required");
        }
        await longRunningTaskService.pauseTask(userId, params.taskId);
        return {
          action: "pause",
          taskId: params.taskId,
          message: "Task paused. You can resume it later.",
        };
      }

      case "resume": {
        if (!params.taskId) {
          throw new Error("taskId is required");
        }
        await longRunningTaskService.resumeTask(userId, params.taskId);
        return {
          action: "resume",
          taskId: params.taskId,
          message: "Task resumed. It will continue from where it paused.",
        };
      }

      case "cancel": {
        if (!params.taskId) {
          throw new Error("taskId is required");
        }
        await longRunningTaskService.cancelTask(userId, params.taskId);
        return {
          action: "cancel",
          taskId: params.taskId,
          message: "Task cancelled.",
        };
      }

      case "get": {
        if (!params.taskId) {
          throw new Error("taskId is required");
        }
        const task = await longRunningTaskService.getTask(
          userId,
          params.taskId,
        );
        if (!task) {
          throw new Error("Task not found");
        }
        return {
          action: "get",
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
        if (!params.taskId) {
          throw new Error("taskId is required");
        }
        const progress = await longRunningTaskService.getProgressSummary(
          userId,
          params.taskId,
        );
        if (!progress) {
          throw new Error("Task not found");
        }
        return {
          action: "get_progress",
          progress,
        };
      }

      case "get_report": {
        if (!params.taskId) {
          throw new Error("taskId is required");
        }
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
        throw new Error(`Unknown long_running_task action: ${action}`);
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
    switch (action) {
      case "create":
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
        throw new Error(`Unknown todo action: ${action}`);
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

      case "list":
        return notificationService.listNotifications(
          userId,
          {},
          {
            page: params.page || 1,
            limit: params.limit || 50,
            sortBy: params.sortBy || "createdAt",
            sortOrder: params.sortOrder || "desc",
          },
        );

      case "mark_read":
        return notificationService.markAsRead(userId, params.notificationId);

      default:
        throw new Error(`Unknown notification action: ${action}`);
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
    switch (action) {
      case "create":
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
        throw new Error(`Unknown scheduled task action: ${action}`);
    }
  }

  /**
   * Execute browser automation task
   */
  private async executeBrowserTask(params: any): Promise<any> {
    // TODO: Implement browser automation via Browseruse
    throw new Error("Browser automation not implemented yet");
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
          "Manage user's todo list - create, read, update, delete, and complete tasks. You have full CRUD capability: list existing todos, create new ones, modify their properties (title, priority, due date, etc.), mark them complete, and delete them entirely.",
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
                "The action to perform. MODIFY: use 'update' to change any todo properties. DELETE: use 'delete' to remove a todo entirely. COMPLETE: use 'complete' to mark as done.",
            },
            todoId: {
              type: "string",
              description:
                "ID of the todo (required for get, update, complete, delete). Always get or list todos first to find the ID.",
            },
            title: {
              type: "string",
              description:
                "Title of the todo (required for create, optional for update)",
            },
            description: {
              type: "string",
              description: "Description of the todo (optional, can be updated)",
            },
            priority: {
              type: "string",
              enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
              description: "Priority level (can be updated anytime)",
            },
            status: {
              type: "string",
              enum: ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
              description:
                "Status of the todo (can be updated, or use 'complete' action for COMPLETED)",
            },
            category: {
              type: "string",
              description: "Category to organize todos (can be updated)",
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Tags for the todo (can be updated)",
            },
            dueDate: {
              type: "string",
              description:
                "Due date in ISO format (can be updated or cleared with 'null')",
            },
            search: {
              type: "string",
              description:
                "Search query for listing todos (searches title and description)",
            },
          },
          required: ["action"],
        },
      },
      {
        name: "notification",
        description: "Send notifications to the user - immediate or scheduled",
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
              ],
              description: "The action to perform",
            },
            notificationId: {
              type: "string",
              description:
                "ID of the notification (for get, mark_read, dismiss, delete)",
            },
            title: {
              type: "string",
              description:
                "Title of the notification (required for send/schedule)",
            },
            message: {
              type: "string",
              description: "Message content (required for send/schedule)",
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
              description: "Type of notification",
            },
            scheduledFor: {
              type: "string",
              description:
                "When to send the notification (ISO format, for schedule action)",
            },
            all: {
              type: "boolean",
              description:
                "Mark all notifications as read (for mark_read action)",
            },
          },
          required: ["action"],
        },
      },
      {
        name: "scheduled_task",
        description:
          "Schedule tasks to run in the future with full management capabilities - create, modify, enable/disable, delete, and execute on-demand. Supports cron expressions, one-time execution, and interval-based scheduling. You can update existing tasks (change schedule, action payload, etc.), delete them, enable/disable them temporarily, and trigger immediate execution.",
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
                "The action to perform. MODIFY: use 'update' to change schedule or action. DISABLE: temporarily pause without deleting. DELETE: permanently remove. ENABLE: re-activate disabled tasks.",
            },
            taskId: {
              type: "string",
              description:
                "ID of the task (required for get, update, enable, disable, delete, execute_now, history). Always get or list tasks first to find the ID.",
            },
            name: {
              type: "string",
              description: "Name of the scheduled task (can be updated)",
            },
            description: {
              type: "string",
              description: "Description of what the task does (can be updated)",
            },
            scheduleType: {
              type: "string",
              enum: ["ONE_TIME", "CRON", "INTERVAL"],
              description:
                "Type of schedule. ONE_TIME: run once at specific time. CRON: recurring schedule. INTERVAL: repeat every N minutes.",
            },
            cronExpression: {
              type: "string",
              description:
                "Cron expression for CRON type (e.g., '0 9 * * *' for daily at 9 AM, '0 9 * * MON' for Monday at 9 AM, '*/30 * * * *' for every 30 minutes)",
            },
            executeAt: {
              type: "string",
              description:
                "When to execute in ISO format for ONE_TIME type (can be updated)",
            },
            interval: {
              type: "number",
              description:
                "Interval in minutes for INTERVAL type (can be updated)",
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
                "Type of action to perform when task runs. Can be changed via update.",
            },
            actionPayload: {
              type: "object",
              description:
                "Parameters for the action (e.g., for SEND_NOTIFICATION: {title, message}). Can be updated.",
            },
          },
          required: ["action"],
        },
      },
      {
        name: "curl",
        description:
          "Make HTTP requests to fetch data from the web - supports GET, POST, PUT, DELETE, PATCH with custom headers",
        parameters: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: ["request", "get", "post", "put", "delete", "patch"],
              description:
                "The HTTP action to perform - 'request' for full control, or shorthand methods",
            },
            url: {
              type: "string",
              description:
                "The URL to request (must be a valid HTTP/HTTPS URL)",
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
                "HTTP method (used with 'request' action, optional for others)",
            },
            headers: {
              type: "object",
              description:
                "Custom HTTP headers as key-value pairs (e.g., {'Authorization': 'Bearer token', 'Accept': 'application/json'})",
            },
            body: {
              type: ["string", "object"],
              description:
                "Request body for POST, PUT, PATCH - can be a string or object (will be JSON encoded)",
            },
            timeout: {
              type: "number",
              description:
                "Request timeout in milliseconds (default: 30000, max: 30000)",
            },
            followRedirects: {
              type: "boolean",
              description:
                "Whether to follow HTTP redirects (default: true, max 5 redirects)",
            },
            validateSsl: {
              type: "boolean",
              description:
                "Whether to validate SSL certificates (default: true)",
            },
          },
          required: ["action", "url"],
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
          "Start and manage long-lasting autonomous tasks that run in the background. Use for complex, multi-step operations that may take minutes to hours. Tasks run asynchronously with progress tracking, error recovery, and optional user notifications on completion.",
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
                "The action to perform - create: create a new task, add_steps: add execution steps, start: begin execution, get_progress: get current status summary, get_report: get detailed AI-readable report",
            },
            taskId: {
              type: "string",
              description:
                "ID of the task (required for start, pause, resume, cancel, get, add_steps, get_progress, get_report)",
            },
            name: {
              type: "string",
              description: "Name of the task (required for create)",
            },
            description: {
              type: "string",
              description:
                "Detailed description of the task (required for create)",
            },
            objective: {
              type: "string",
              description:
                "Clear statement of what the task should achieve (required for create)",
            },
            estimatedDurationMinutes: {
              type: "number",
              description: "Estimated duration in minutes",
            },
            priority: {
              type: "string",
              enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
              description: "Task priority level",
            },
            completionBehavior: {
              type: "string",
              enum: ["SILENT", "NOTIFY_USER", "NOTIFY_AND_SUMMARIZE"],
              description:
                "What to do when task completes - SILENT: no notification, NOTIFY_USER: send notification, NOTIFY_AND_SUMMARIZE: notify with detailed summary",
            },
            notifyOnProgress: {
              type: "boolean",
              description: "Whether to send periodic progress notifications",
            },
            progressIntervalMinutes: {
              type: "number",
              description:
                "How often to send progress notifications (in minutes)",
            },
            initialContext: {
              type: "object",
              description:
                "Initial context data that will be available to all steps",
            },
            steps: {
              type: "array",
              description:
                "Array of step definitions to add (used with add_steps action)",
              items: {
                type: "object",
                properties: {
                  name: {
                    type: "string",
                    description: "Step name",
                  },
                  description: {
                    type: "string",
                    description: "Step description",
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
                      "Action type - llm_generate: call LLM, wait: pause execution, conditional: branch logic, aggregate: combine results, notify: send notification",
                  },
                  params: {
                    type: "object",
                    description: "Parameters for the action",
                  },
                  isCheckpoint: {
                    type: "boolean",
                    description:
                      "Whether this step creates a checkpoint with progress summary",
                  },
                  onError: {
                    type: "string",
                    enum: ["continue", "retry", "abort"],
                    description: "Error handling behavior",
                  },
                  maxRetries: {
                    type: "number",
                    description: "Maximum retry attempts if onError is 'retry'",
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
              description: "Filter by status (for list action)",
            },
            limit: {
              type: "number",
              description: "Maximum number of results (for list action)",
            },
          },
          required: ["action"],
        },
      },
      {
        name: "user_profile",
        description:
          "Manage the user's permanent profile - store and update important structural information like name, occupation, preferences, goals, and relationships. This data is always available to you without needing memory search. Use this to remember important facts about the user that don't change often. IMPORTANT: When the user shares personal information (name, job, location, preferences, etc.), USE THIS TOOL to save it to their profile.",
        parameters: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: ["get", "update", "delete_fields"],
              description:
                "The action to perform - get: retrieve current profile, update: add/modify profile fields (merges with existing), delete_fields: remove specific fields",
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
              description: "User's birthdate (ISO format)",
            },
            location: {
              type: "string",
              description: "User's location (city, country)",
            },
            timezone: {
              type: "string",
              description: "User's timezone",
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
              description: "User's skills (will be merged with existing)",
            },
            workStyle: {
              type: "string",
              description: "User's work style preferences",
            },
            // Preferences
            communicationStyle: {
              type: "string",
              description:
                "User's preferred communication style (e.g., 'concise', 'detailed', 'casual')",
            },
            interests: {
              type: "array",
              items: { type: "string" },
              description: "User's interests (will be merged with existing)",
            },
            hobbies: {
              type: "array",
              items: { type: "string" },
              description: "User's hobbies (will be merged with existing)",
            },
            // Goals
            currentGoals: {
              type: "array",
              items: { type: "string" },
              description:
                "User's current goals (will be merged with existing)",
            },
            longTermGoals: {
              type: "array",
              items: { type: "string" },
              description:
                "User's long-term goals (will be merged with existing)",
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
                      "Relationship type (e.g., 'wife', 'colleague', 'friend')",
                  },
                  notes: {
                    type: "string",
                    description: "Additional notes about this person",
                  },
                },
                required: ["name", "relation"],
              },
              description:
                "Important people in user's life (will be merged by name)",
            },
            // Health & Lifestyle
            dietaryPreferences: {
              type: "string",
              description: "User's dietary preferences/restrictions",
            },
            exerciseHabits: {
              type: "string",
              description: "User's exercise habits",
            },
            sleepSchedule: {
              type: "string",
              description: "User's sleep schedule",
            },
            // Custom
            custom: {
              type: "object",
              description:
                "Any other important information about the user as key-value pairs",
            },
            // For delete_fields action
            fields: {
              type: "array",
              items: { type: "string" },
              description:
                "Fields to delete (required for delete_fields action)",
            },
          },
          required: ["action"],
        },
      },
      {
        name: "code_executor",
        description:
          "Execute Python code in a secure sandbox. Use this tool for mathematical calculations, data processing, algorithm testing, statistical analysis, and any computation requiring precise results. The code runs in isolation with no filesystem or network access. IMPORTANT: Always use print() to display results - the output is captured and returned. Available modules: math, random, datetime, json, re, itertools, functools, collections, string, decimal, fractions, statistics, operator, copy, textwrap, unicodedata.",
        parameters: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: ["execute", "validate", "get_limits", "get_examples"],
              description:
                "The action to perform - execute: run Python code, validate: check syntax without running, get_limits: get execution constraints, get_examples: get code examples",
            },
            code: {
              type: "string",
              description:
                "Python code to execute or validate (required for execute/validate actions). Use print() to output results.",
            },
            timeout: {
              type: "number",
              description:
                "Maximum execution time in seconds (default: 30, max: 30)",
            },
          },
          required: ["action"],
        },
      },
      {
        name: "generate_tool",
        description:
          "Generate, manage, and execute custom AI-created tools. Use 'generate' to create a new tool from an objective (e.g., 'get directions from Google Maps API', 'fetch weather data'). The AI will write Python code, test it, and save it for future use. Generated tools can make HTTP requests and use API keys stored in user secrets.",
        parameters: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: ["generate", "list", "get", "execute", "delete", "search"],
              description:
                "generate: create new tool from objective, list: show all generated tools, get: get tool details and code, execute: run a generated tool, delete: remove a tool, search: find tools by keyword",
            },
            objective: {
              type: "string",
              description:
                "For 'generate': describe what the tool should do (e.g., 'get driving directions between two cities using Google Maps')",
            },
            context: {
              type: "string",
              description:
                "For 'generate': additional context from the conversation",
            },
            suggestedSecrets: {
              type: "array",
              items: { type: "string" },
              description:
                "For 'generate': API key names that might be needed (e.g., ['google_maps_api_key'])",
            },
            tool_id: {
              type: "string",
              description:
                "For 'get', 'execute', 'delete': the tool ID",
            },
            name: {
              type: "string",
              description:
                "For 'get', 'execute': the tool name (alternative to tool_id)",
            },
            params: {
              type: "object",
              description:
                "For 'execute': parameters to pass to the tool",
            },
            query: {
              type: "string",
              description:
                "For 'search': keyword to search for in tool names/descriptions",
            },
            category: {
              type: "string",
              description:
                "For 'list': filter by category",
            },
          },
          required: ["action"],
        },
      },
      {
        name: "secrets",
        description:
          "Check which API keys and secrets are configured by the user. Use this before generating tools to verify required API keys are available. Never exposes actual secret values - only lists names and checks existence.",
        parameters: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: ["list", "check", "has"],
              description:
                "list: show all configured secrets (names only), check: verify if specific keys exist, has: check single key",
            },
            keys: {
              type: "array",
              items: { type: "string" },
              description:
                "For 'check': array of secret keys to verify existence",
            },
            key: {
              type: "string",
              description:
                "For 'has': single key to check",
            },
            category: {
              type: "string",
              description:
                "For 'list': filter by category",
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
