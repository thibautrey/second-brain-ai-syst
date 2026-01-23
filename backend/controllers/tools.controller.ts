/**
 * Built-in Tools Controller
 *
 * REST API endpoints for the built-in tools:
 * - Todo List
 * - Scheduled Tasks
 * - Notifications
 */

import { Router, Request, Response } from "express";
import { authMiddleware, AuthRequest } from "../middlewares/auth.middleware.js";
import { toolExecutorService } from "../services/tool-executor.js";
import { todoService } from "../services/tools/todo.service.js";
import { notificationService } from "../services/tools/notification.service.js";
import { scheduledTaskService } from "../services/tools/scheduled-task.service.js";

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// ==================== Generic Tool Execution ====================

/**
 * Execute any tool action
 * POST /api/tools/execute
 */
router.post("/execute", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { toolId, action, params } = req.body;

    if (!toolId || !action) {
      return res.status(400).json({
        success: false,
        error: "toolId and action are required",
      });
    }

    const result = await toolExecutorService.executeTool(userId, {
      toolId,
      action,
      params: params || {},
    });

    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * List available tools
 * GET /api/tools
 */
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const tools = await toolExecutorService.listAvailableTools(userId);
    return res.json({ success: true, tools });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get tool schemas for LLM function calling
 * GET /api/tools/schemas
 */
router.get("/schemas", async (req: AuthRequest, res: Response) => {
  try {
    const schemas = toolExecutorService.getToolSchemas();
    return res.json({ success: true, schemas });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ==================== Todo Routes ====================

/**
 * Create a todo
 * POST /api/tools/todos
 */
router.post("/todos", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const todo = await todoService.createTodo(userId, req.body);
    return res.status(201).json({ success: true, todo });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * List todos
 * GET /api/tools/todos
 */
router.get("/todos", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const {
      page,
      limit,
      sortBy,
      sortOrder,
      status,
      priority,
      category,
      search,
      includeCompleted,
    } = req.query;

    const result = await todoService.listTodos(
      userId,
      {
        status: status as any,
        priority: priority as any,
        category: category as string,
        search: search as string,
        includeCompleted: includeCompleted === "true",
      },
      {
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        sortBy: sortBy as any,
        sortOrder: sortOrder as any,
      },
    );

    return res.json({ success: true, ...result });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get todo stats
 * GET /api/tools/todos/stats
 */
router.get("/todos/stats", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const stats = await todoService.getTodoStats(userId);
    return res.json({ success: true, stats });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get overdue todos
 * GET /api/tools/todos/overdue
 */
router.get("/todos/overdue", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const todos = await todoService.getOverdueTodos(userId);
    return res.json({ success: true, todos });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get todos due soon
 * GET /api/tools/todos/due-soon
 */
router.get("/todos/due-soon", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const withinHours = req.query.hours
      ? parseInt(req.query.hours as string)
      : 24;
    const todos = await todoService.getTodosDueSoon(userId, withinHours);
    return res.json({ success: true, todos });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get todo categories
 * GET /api/tools/todos/categories
 */
router.get("/todos/categories", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const categories = await todoService.getCategories(userId);
    return res.json({ success: true, categories });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get todo tags
 * GET /api/tools/todos/tags
 */
router.get("/todos/tags", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const tags = await todoService.getTags(userId);
    return res.json({ success: true, tags });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get a specific todo
 * GET /api/tools/todos/:id
 */
router.get("/todos/:id", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const todo = await todoService.getTodo(userId, req.params.id);

    if (!todo) {
      return res.status(404).json({
        success: false,
        error: "Todo not found",
      });
    }

    return res.json({ success: true, todo });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Update a todo
 * PATCH /api/tools/todos/:id
 */
router.patch("/todos/:id", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const todo = await todoService.updateTodo(userId, req.params.id, req.body);
    return res.json({ success: true, todo });
  } catch (error: any) {
    if (error.message === "Todo not found") {
      return res.status(404).json({
        success: false,
        error: error.message,
      });
    }
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Complete a todo
 * POST /api/tools/todos/:id/complete
 */
router.post("/todos/:id/complete", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const todo = await todoService.completeTodo(userId, req.params.id);
    return res.json({ success: true, todo });
  } catch (error: any) {
    if (error.message === "Todo not found") {
      return res.status(404).json({
        success: false,
        error: error.message,
      });
    }
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Delete a todo
 * DELETE /api/tools/todos/:id
 */
router.delete("/todos/:id", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    await todoService.deleteTodo(userId, req.params.id);
    return res.json({ success: true });
  } catch (error: any) {
    if (error.message === "Todo not found") {
      return res.status(404).json({
        success: false,
        error: error.message,
      });
    }
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ==================== Notification Routes ====================

/**
 * Send a notification
 * POST /api/tools/notifications
 */
router.post("/notifications", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { scheduledFor, ...rest } = req.body;

    let notification;
    if (scheduledFor) {
      notification = await notificationService.scheduleNotification(userId, {
        ...rest,
        scheduledFor: new Date(scheduledFor),
      });
    } else {
      notification = await notificationService.sendNotification(userId, rest);
    }

    return res.status(201).json({ success: true, notification });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * List notifications
 * GET /api/tools/notifications
 */
router.get("/notifications", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { page, limit, sortBy, sortOrder, type, isRead, isDismissed } =
      req.query;

    const result = await notificationService.listNotifications(
      userId,
      {
        type: type as any,
        isRead: isRead === undefined ? undefined : isRead === "true",
        isDismissed:
          isDismissed === undefined ? undefined : isDismissed === "true",
      },
      {
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        sortBy: sortBy as any,
        sortOrder: sortOrder as any,
      },
    );

    return res.json({ success: true, ...result });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get unread count
 * GET /api/tools/notifications/unread-count
 */
router.get(
  "/notifications/unread-count",
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId;
      const count = await notificationService.getUnreadCount(userId);
      return res.json({ success: true, count });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
);

/**
 * Mark all notifications as read
 * POST /api/tools/notifications/mark-all-read
 */
router.post(
  "/notifications/mark-all-read",
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId;
      await notificationService.markAllAsRead(userId);
      return res.json({ success: true });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
);

/**
 * Clear dismissed notifications
 * DELETE /api/tools/notifications/dismissed
 */
router.delete(
  "/notifications/dismissed",
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId;
      await notificationService.clearDismissed(userId);
      return res.json({ success: true });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
);

/**
 * Get a specific notification
 * GET /api/tools/notifications/:id
 */
router.get("/notifications/:id", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const notification = await notificationService.getNotification(
      userId,
      req.params.id,
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: "Notification not found",
      });
    }

    return res.json({ success: true, notification });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Mark notification as read
 * POST /api/tools/notifications/:id/read
 */
router.post(
  "/notifications/:id/read",
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId;
      const notification = await notificationService.markAsRead(
        userId,
        req.params.id,
      );
      return res.json({ success: true, notification });
    } catch (error: any) {
      if (error.message === "Notification not found") {
        return res.status(404).json({
          success: false,
          error: error.message,
        });
      }
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
);

/**
 * Dismiss a notification
 * POST /api/tools/notifications/:id/dismiss
 */
router.post(
  "/notifications/:id/dismiss",
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId;
      const notification = await notificationService.dismissNotification(
        userId,
        req.params.id,
      );
      return res.json({ success: true, notification });
    } catch (error: any) {
      if (error.message === "Notification not found") {
        return res.status(404).json({
          success: false,
          error: error.message,
        });
      }
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
);

/**
 * Delete a notification
 * DELETE /api/tools/notifications/:id
 */
router.delete("/notifications/:id", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    await notificationService.deleteNotification(userId, req.params.id);
    return res.json({ success: true });
  } catch (error: any) {
    if (error.message === "Notification not found") {
      return res.status(404).json({
        success: false,
        error: error.message,
      });
    }
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ==================== Scheduled Task Routes ====================

/**
 * Create a scheduled task
 * POST /api/tools/scheduled-tasks
 */
router.post("/scheduled-tasks", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { executeAt, expiresAt, ...rest } = req.body;

    const task = await scheduledTaskService.createTask(userId, {
      ...rest,
      executeAt: executeAt ? new Date(executeAt) : undefined,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });

    return res.status(201).json({ success: true, task });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * List scheduled tasks
 * GET /api/tools/scheduled-tasks
 */
router.get("/scheduled-tasks", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { isEnabled, actionType, scheduleType } = req.query;

    const tasks = await scheduledTaskService.listTasks(userId, {
      isEnabled: isEnabled === undefined ? undefined : isEnabled === "true",
      actionType: actionType as any,
      scheduleType: scheduleType as any,
    });

    return res.json({ success: true, tasks });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get a specific scheduled task
 * GET /api/tools/scheduled-tasks/:id
 */
router.get("/scheduled-tasks/:id", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const task = await scheduledTaskService.getTask(userId, req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        error: "Task not found",
      });
    }

    return res.json({ success: true, task });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Update a scheduled task
 * PATCH /api/tools/scheduled-tasks/:id
 */
router.patch(
  "/scheduled-tasks/:id",
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId;
      const { executeAt, expiresAt, ...rest } = req.body;

      const task = await scheduledTaskService.updateTask(
        userId,
        req.params.id,
        {
          ...rest,
          executeAt: executeAt ? new Date(executeAt) : undefined,
          expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        },
      );

      return res.json({ success: true, task });
    } catch (error: any) {
      if (error.message === "Task not found") {
        return res.status(404).json({
          success: false,
          error: error.message,
        });
      }
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
);

/**
 * Enable a scheduled task
 * POST /api/tools/scheduled-tasks/:id/enable
 */
router.post(
  "/scheduled-tasks/:id/enable",
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId;
      const task = await scheduledTaskService.enableTask(userId, req.params.id);
      return res.json({ success: true, task });
    } catch (error: any) {
      if (error.message === "Task not found") {
        return res.status(404).json({
          success: false,
          error: error.message,
        });
      }
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
);

/**
 * Disable a scheduled task
 * POST /api/tools/scheduled-tasks/:id/disable
 */
router.post(
  "/scheduled-tasks/:id/disable",
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId;
      const task = await scheduledTaskService.disableTask(
        userId,
        req.params.id,
      );
      return res.json({ success: true, task });
    } catch (error: any) {
      if (error.message === "Task not found") {
        return res.status(404).json({
          success: false,
          error: error.message,
        });
      }
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
);

/**
 * Execute a task immediately
 * POST /api/tools/scheduled-tasks/:id/execute
 */
router.post(
  "/scheduled-tasks/:id/execute",
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId;
      const result = await scheduledTaskService.executeTaskNow(
        userId,
        req.params.id,
      );
      return res.json({ success: true, result });
    } catch (error: any) {
      if (error.message === "Task not found") {
        return res.status(404).json({
          success: false,
          error: error.message,
        });
      }
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
);

/**
 * Get execution history
 * GET /api/tools/scheduled-tasks/:id/history
 */
router.get(
  "/scheduled-tasks/:id/history",
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const executions = await scheduledTaskService.getTaskExecutions(
        userId,
        req.params.id,
        limit,
      );
      return res.json({ success: true, executions });
    } catch (error: any) {
      if (error.message === "Task not found") {
        return res.status(404).json({
          success: false,
          error: error.message,
        });
      }
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
);

/**
 * Delete a scheduled task
 * DELETE /api/tools/scheduled-tasks/:id
 */
router.delete(
  "/scheduled-tasks/:id",
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId;
      await scheduledTaskService.deleteTask(userId, req.params.id);
      return res.json({ success: true });
    } catch (error: any) {
      if (error.message === "Task not found") {
        return res.status(404).json({
          success: false,
          error: error.message,
        });
      }
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
);

export default router;
