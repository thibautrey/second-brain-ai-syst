import { longRunningTaskService } from "../../tools/index.js";

export async function executeLongRunningTaskAction(
  userId: string,
  action: string,
  params: Record<string, any>,
): Promise<any> {
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

export const LONG_RUNNING_TASK_TOOL_SCHEMA = {
  name: "long_running_task",
  description:
    "Start and manage long-lasting autonomous tasks that run in the background. Use for complex, multi-step operations that may take minutes to hours. CRITICAL WORKFLOW: You MUST follow these 3 steps in order: 1) 'create' to get taskId, 2) 'add_steps' to define what the task does, 3) 'start' to begin execution. Skipping steps will cause the task to fail or do nothing.",
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
          enum: ["PENDING", "RUNNING", "PAUSED", "COMPLETED", "FAILED", "CANCELLED"],
        },
        description: "For 'list' action: filter by these statuses",
      },
      limit: {
        type: "number",
        description: "For 'list' action: maximum results to return (default: 20)",
      },
    },
    required: ["action"],
  },
};
