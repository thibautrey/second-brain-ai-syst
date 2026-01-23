// Tool Executor Service
// Safely executes external operations and built-in tools

import {
  todoService,
  notificationService,
  scheduledTaskService,
  curlService,
} from "./tools/index.js";
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
];

export class ToolExecutorService {
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
      default:
        throw new Error(`Unknown builtin tool: ${toolId}`);
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
        });

      case "schedule":
        return notificationService.scheduleNotification(userId, {
          title: params.title,
          message: params.message,
          type: params.type as NotificationType,
          channels: params.channels,
          scheduledFor: new Date(params.scheduledFor),
          sourceType: params.sourceType,
          sourceId: params.sourceId,
        });

      case "get":
        return notificationService.getNotification(
          userId,
          params.notificationId,
        );

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
            page: params.page,
            limit: params.limit,
            sortBy: params.sortBy,
            sortOrder: params.sortOrder,
          },
        );

      case "unread_count":
        return { count: await notificationService.getUnreadCount(userId) };

      case "mark_read":
        if (params.all) {
          return notificationService.markAllAsRead(userId);
        }
        return notificationService.markAsRead(userId, params.notificationId);

      case "dismiss":
        return notificationService.dismissNotification(
          userId,
          params.notificationId,
        );

      case "delete":
        return notificationService.deleteNotification(
          userId,
          params.notificationId,
        );

      case "clear_dismissed":
        return notificationService.clearDismissed(userId);

      case "cancel_scheduled":
        return notificationService.cancelScheduledNotification(
          userId,
          params.notificationId,
        );

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
          "Manage user's todo list - create, update, complete, and list tasks",
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
              description: "The action to perform",
            },
            todoId: {
              type: "string",
              description:
                "ID of the todo (required for get, update, complete, delete)",
            },
            title: {
              type: "string",
              description: "Title of the todo (required for create)",
            },
            description: {
              type: "string",
              description: "Description of the todo",
            },
            priority: {
              type: "string",
              enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
              description: "Priority level",
            },
            status: {
              type: "string",
              enum: ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
              description: "Status of the todo",
            },
            category: {
              type: "string",
              description: "Category to organize todos",
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Tags for the todo",
            },
            dueDate: {
              type: "string",
              description: "Due date in ISO format",
            },
            search: {
              type: "string",
              description: "Search query for listing todos",
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
          "Schedule tasks to run in the future - supports cron expressions, one-time, and interval scheduling",
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
              description: "The action to perform",
            },
            taskId: {
              type: "string",
              description:
                "ID of the task (for get, update, enable, disable, delete, execute_now, history)",
            },
            name: {
              type: "string",
              description: "Name of the scheduled task",
            },
            description: {
              type: "string",
              description: "Description of what the task does",
            },
            scheduleType: {
              type: "string",
              enum: ["ONE_TIME", "CRON", "INTERVAL"],
              description: "Type of schedule",
            },
            cronExpression: {
              type: "string",
              description:
                "Cron expression (for CRON type, e.g., '0 9 * * *' for daily at 9 AM)",
            },
            executeAt: {
              type: "string",
              description: "When to execute (ISO format, for ONE_TIME type)",
            },
            interval: {
              type: "number",
              description: "Interval in minutes (for INTERVAL type)",
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
              description: "Type of action to perform when task runs",
            },
            actionPayload: {
              type: "object",
              description: "Parameters for the action",
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
    ];
  }
}

export const toolExecutorService = new ToolExecutorService();
