/**
 * Long Running Task Controller
 *
 * REST API endpoints for managing long-running autonomous tasks.
 */

import { Request, Response, Router } from "express";
import { AuthRequest } from "../middlewares/auth.middleware.js";
import {
  longRunningTaskService,
  CreateLongRunningTaskInput,
  TaskStepDefinition,
} from "../services/tools/long-running-task.service.js";
import { LongRunningTaskStatus, TaskPriority } from "@prisma/client";

const router = Router();

// ==================== Task CRUD ====================

/**
 * Create a new long-running task
 * POST /api/tasks/long-running
 */
export async function createTask(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!;
    const input: CreateLongRunningTaskInput = req.body;

    if (!input.name || !input.description || !input.objective) {
      return res.status(400).json({
        error: "Missing required fields: name, description, objective",
      });
    }

    const task = await longRunningTaskService.createTask(userId, input);

    res.status(201).json({
      success: true,
      task,
    });
  } catch (error: any) {
    console.error("Error creating long-running task:", error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Add steps to a task
 * POST /api/tasks/long-running/:taskId/steps
 */
export async function addSteps(req: AuthRequest, res: Response) {
  try {
    const { taskId } = req.params;
    const steps: TaskStepDefinition[] = req.body.steps;

    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      return res.status(400).json({
        error: "Steps array is required and must not be empty",
      });
    }

    const createdSteps = await longRunningTaskService.addSteps(taskId, steps);

    res.json({
      success: true,
      steps: createdSteps,
    });
  } catch (error: any) {
    console.error("Error adding steps:", error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get a task by ID
 * GET /api/tasks/long-running/:taskId
 */
export async function getTask(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!;
    const { taskId } = req.params;

    const task = await longRunningTaskService.getTask(userId, taskId);

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    res.json({
      success: true,
      task,
    });
  } catch (error: any) {
    console.error("Error getting task:", error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * List tasks for current user
 * GET /api/tasks/long-running
 */
export async function listTasks(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!;
    const { status, priority, limit } = req.query;

    const tasks = await longRunningTaskService.listTasks(userId, {
      status: status
        ? ((status as string).split(",") as LongRunningTaskStatus[])
        : undefined,
      priority: priority as TaskPriority | undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });

    res.json({
      success: true,
      tasks,
      count: tasks.length,
    });
  } catch (error: any) {
    console.error("Error listing tasks:", error);
    res.status(500).json({ error: error.message });
  }
}

// ==================== Task Control ====================

/**
 * Start a task
 * POST /api/tasks/long-running/:taskId/start
 */
export async function startTask(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!;
    const { taskId } = req.params;

    await longRunningTaskService.startTask(userId, taskId);

    res.json({
      success: true,
      message: "Task started",
    });
  } catch (error: any) {
    console.error("Error starting task:", error);
    res.status(400).json({ error: error.message });
  }
}

/**
 * Pause a task
 * POST /api/tasks/long-running/:taskId/pause
 */
export async function pauseTask(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!;
    const { taskId } = req.params;

    await longRunningTaskService.pauseTask(userId, taskId);

    res.json({
      success: true,
      message: "Task paused",
    });
  } catch (error: any) {
    console.error("Error pausing task:", error);
    res.status(400).json({ error: error.message });
  }
}

/**
 * Resume a paused task
 * POST /api/tasks/long-running/:taskId/resume
 */
export async function resumeTask(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!;
    const { taskId } = req.params;

    await longRunningTaskService.resumeTask(userId, taskId);

    res.json({
      success: true,
      message: "Task resumed",
    });
  } catch (error: any) {
    console.error("Error resuming task:", error);
    res.status(400).json({ error: error.message });
  }
}

/**
 * Cancel a task
 * POST /api/tasks/long-running/:taskId/cancel
 */
export async function cancelTask(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!;
    const { taskId } = req.params;

    await longRunningTaskService.cancelTask(userId, taskId);

    res.json({
      success: true,
      message: "Task cancelled",
    });
  } catch (error: any) {
    console.error("Error cancelling task:", error);
    res.status(400).json({ error: error.message });
  }
}

// ==================== Progress & Summaries ====================

/**
 * Get task progress summary
 * GET /api/tasks/long-running/:taskId/progress
 */
export async function getProgress(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!;
    const { taskId } = req.params;

    const progress = await longRunningTaskService.getProgressSummary(
      userId,
      taskId,
    );

    if (!progress) {
      return res.status(404).json({ error: "Task not found" });
    }

    res.json({
      success: true,
      progress,
    });
  } catch (error: any) {
    console.error("Error getting progress:", error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get AI-readable progress report
 * GET /api/tasks/long-running/:taskId/report
 */
export async function getReport(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!;
    const { taskId } = req.params;

    const report = await longRunningTaskService.generateProgressReport(
      userId,
      taskId,
    );

    res.json({
      success: true,
      report,
    });
  } catch (error: any) {
    console.error("Error generating report:", error);
    res.status(500).json({ error: error.message });
  }
}

// ==================== Active Tasks ====================

/**
 * Get currently running tasks
 * GET /api/tasks/long-running/active
 */
export async function getActiveTasks(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!;

    const tasks = await longRunningTaskService.listTasks(userId, {
      status: [LongRunningTaskStatus.RUNNING, LongRunningTaskStatus.PAUSED],
    });

    res.json({
      success: true,
      tasks,
      count: tasks.length,
    });
  } catch (error: any) {
    console.error("Error getting active tasks:", error);
    res.status(500).json({ error: error.message });
  }
}

export default {
  createTask,
  addSteps,
  getTask,
  listTasks,
  startTask,
  pauseTask,
  resumeTask,
  cancelTask,
  getProgress,
  getReport,
  getActiveTasks,
};
