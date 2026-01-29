import { ScheduleType, TaskActionType } from "@prisma/client";
import { scheduledTaskService } from "../../tools/index.js";

export async function executeScheduledTaskAction(
  userId: string,
  action: string,
  params: Record<string, any>,
): Promise<any> {
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
      if (!params.name) {
        throw new Error("Missing required parameter 'name' for create action");
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
      if (params.actionType === "SEND_NOTIFICATION") {
        if (!params.actionPayload?.title || !params.actionPayload?.message) {
          throw new Error(
            "For SEND_NOTIFICATION actionType, actionPayload must include 'title' and 'message'. " +
              "Example: { title: 'Reminder', message: 'Time for your daily review' }",
          );
        }
      }
      if (params.actionType === "CREATE_TODO" && !params.actionPayload?.title) {
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

export const SCHEDULED_TASK_TOOL_SCHEMA = {
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
          "ID of the task - REQUIRED for get, update, enable, disable, delete, execute_now, history. Use 'list' action first to find the task ID.",
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
};
