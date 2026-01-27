/**
 * Scheduled Task Service
 *
 * Built-in tool for scheduling future actions (cron-like functionality).
 * Supports one-time execution, cron expressions, and interval-based scheduling.
 */

import prisma from "../prisma.js";
import { ScheduleType, TaskActionType, Prisma } from "@prisma/client";
import { CronJob } from "cron";
import { notificationService } from "./notification.service.js";
import { todoService } from "./todo.service.js";
import { resourceWatcherService } from "./resource-watcher.service.js";

// ==================== Types ====================

export interface CreateScheduledTaskInput {
  name: string;
  description?: string;
  scheduleType: ScheduleType;
  cronExpression?: string; // Required for CRON type
  executeAt?: Date; // Required for ONE_TIME type
  interval?: number; // Required for INTERVAL type (minutes)
  actionType: TaskActionType;
  actionPayload: Record<string, any>;
  maxRuns?: number;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

export interface UpdateScheduledTaskInput {
  name?: string;
  description?: string;
  cronExpression?: string;
  executeAt?: Date;
  interval?: number;
  actionPayload?: Record<string, any>;
  isEnabled?: boolean;
  maxRuns?: number;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

export interface TaskFilters {
  isEnabled?: boolean;
  actionType?: TaskActionType | TaskActionType[];
  scheduleType?: ScheduleType | ScheduleType[];
}

// ==================== Service ====================

export class ScheduledTaskService {
  private activeCronJobs: Map<string, CronJob> = new Map();
  private intervalTimers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Initialize the scheduler - load and start all active tasks
   */
  async initialize() {
    console.log("🕐 Initializing scheduled tasks service...");

    // Load all enabled tasks
    const tasks = await prisma.scheduledTask.findMany({
      where: { isEnabled: true },
    });

    for (const task of tasks) {
      await this.activateTask(task);
    }

    console.log(`✓ Initialized ${tasks.length} scheduled tasks`);
  }

  /**
   * Create a new scheduled task
   */
  async createTask(userId: string, input: CreateScheduledTaskInput) {
    // Validate input based on schedule type
    this.validateScheduleInput(input);

    // Calculate next run time
    const nextRunAt = this.calculateNextRun(input);

    const task = await prisma.scheduledTask.create({
      data: {
        userId,
        name: input.name,
        description: input.description,
        scheduleType: input.scheduleType,
        cronExpression: input.cronExpression,
        executeAt: input.executeAt,
        interval: input.interval,
        actionType: input.actionType,
        actionPayload: input.actionPayload,
        isEnabled: true,
        nextRunAt,
        maxRuns: input.maxRuns,
        expiresAt: input.expiresAt,
        metadata: input.metadata ?? {},
      },
    });

    // Activate the task
    await this.activateTask(task);

    return task;
  }

  /**
   * Get a task by ID
   */
  async getTask(userId: string, taskId: string) {
    return prisma.scheduledTask.findFirst({
      where: {
        id: taskId,
        userId,
      },
      include: {
        executions: {
          orderBy: { startedAt: "desc" },
          take: 10,
        },
      },
    });
  }

  /**
   * List tasks for a user
   */
  async listTasks(userId: string, filters: TaskFilters = {}) {
    const where: Prisma.ScheduledTaskWhereInput = { userId };

    if (filters.isEnabled !== undefined) {
      where.isEnabled = filters.isEnabled;
    }

    if (filters.actionType) {
      where.actionType = Array.isArray(filters.actionType)
        ? { in: filters.actionType }
        : filters.actionType;
    }

    if (filters.scheduleType) {
      where.scheduleType = Array.isArray(filters.scheduleType)
        ? { in: filters.scheduleType }
        : filters.scheduleType;
    }

    return prisma.scheduledTask.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        executions: {
          orderBy: { startedAt: "desc" },
          take: 1,
        },
      },
    });
  }

  /**
   * Update a scheduled task
   */
  async updateTask(
    userId: string,
    taskId: string,
    input: UpdateScheduledTaskInput,
  ) {
    const existing = await this.getTask(userId, taskId);
    if (!existing) {
      throw new Error("Task not found");
    }

    // Deactivate current task
    this.deactivateTask(taskId);

    const data: Prisma.ScheduledTaskUpdateInput = {};

    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.cronExpression !== undefined)
      data.cronExpression = input.cronExpression;
    if (input.executeAt !== undefined) data.executeAt = input.executeAt;
    if (input.interval !== undefined) data.interval = input.interval;
    if (input.actionPayload !== undefined)
      data.actionPayload = input.actionPayload;
    if (input.isEnabled !== undefined) data.isEnabled = input.isEnabled;
    if (input.maxRuns !== undefined) data.maxRuns = input.maxRuns;
    if (input.expiresAt !== undefined) data.expiresAt = input.expiresAt;
    if (input.metadata !== undefined) data.metadata = input.metadata;

    // Recalculate next run if schedule changed
    if (input.cronExpression || input.executeAt || input.interval) {
      data.nextRunAt = this.calculateNextRun({
        scheduleType: existing.scheduleType,
        cronExpression:
          input.cronExpression ?? existing.cronExpression ?? undefined,
        executeAt: input.executeAt ?? existing.executeAt ?? undefined,
        interval: input.interval ?? existing.interval ?? undefined,
      } as CreateScheduledTaskInput);
    }

    const task = await prisma.scheduledTask.update({
      where: { id: taskId },
      data,
    });

    // Reactivate if enabled
    if (task.isEnabled) {
      await this.activateTask(task);
    }

    return task;
  }

  /**
   * Enable a task
   */
  async enableTask(userId: string, taskId: string) {
    return this.updateTask(userId, taskId, { isEnabled: true });
  }

  /**
   * Disable a task
   */
  async disableTask(userId: string, taskId: string) {
    return this.updateTask(userId, taskId, { isEnabled: false });
  }

  /**
   * Delete a task
   */
  async deleteTask(userId: string, taskId: string) {
    const existing = await this.getTask(userId, taskId);
    if (!existing) {
      throw new Error("Task not found");
    }

    // Deactivate
    this.deactivateTask(taskId);

    await prisma.scheduledTask.delete({
      where: { id: taskId },
    });

    return { success: true };
  }

  /**
   * Execute a task manually (for testing or immediate execution)
   */
  async executeTaskNow(userId: string, taskId: string) {
    const task = await this.getTask(userId, taskId);
    if (!task) {
      throw new Error("Task not found");
    }

    return this.runTask(task);
  }

  /**
   * Get execution history for a task
   */
  async getTaskExecutions(userId: string, taskId: string, limit: number = 50) {
    const task = await this.getTask(userId, taskId);
    if (!task) {
      throw new Error("Task not found");
    }

    return prisma.taskExecution.findMany({
      where: { scheduledTaskId: taskId },
      orderBy: { startedAt: "desc" },
      take: limit,
    });
  }

  // ==================== Task Execution ====================

  /**
   * Run a task
   */
  private async runTask(task: any) {
    const startTime = Date.now();

    // Create execution record
    const execution = await prisma.taskExecution.create({
      data: {
        scheduledTaskId: task.id,
        status: "running",
        startedAt: new Date(),
      },
    });

    try {
      // Execute the action
      const result = await this.executeAction(
        task.userId,
        task.actionType,
        task.actionPayload,
      );

      // Persist stateful updates returned by the action
      if (result?.updatedActionPayload) {
        task.actionPayload = result.updatedActionPayload;
      }
      if (result?.updatedMetadata) {
        task.metadata = result.updatedMetadata;
      }

      // Update execution record
      await prisma.taskExecution.update({
        where: { id: execution.id },
        data: {
          status: "success",
          output: result,
          completedAt: new Date(),
          durationMs: Date.now() - startTime,
        },
      });

      // Update task
      const successUpdate = {
        where: { id: task.id },
        data: {
          lastRunAt: new Date(),
          lastRunStatus: "success",
          lastRunError: null,
          runCount: { increment: 1 },
          nextRunAt: this.calculateNextRun(task),
          ...(result?.updatedActionPayload && {
            actionPayload: result.updatedActionPayload as any,
          }),
          ...(result?.updatedMetadata && {
            metadata: result.updatedMetadata as any,
          }),
        },
      };

      await prisma.scheduledTask.update(successUpdate);

      // Check if task should be disabled
      await this.checkTaskLimits(task);

      return { success: true, output: result };
    } catch (error: any) {
      // Update execution record
      await prisma.taskExecution.update({
        where: { id: execution.id },
        data: {
          status: "failed",
          errorMessage: error.message,
          completedAt: new Date(),
          durationMs: Date.now() - startTime,
        },
      });

      // Update task
      const failureUpdate = {
        where: { id: task.id },
        data: {
          lastRunAt: new Date(),
          lastRunStatus: "failed",
          lastRunError: error.message,
          runCount: { increment: 1 },
          nextRunAt: this.calculateNextRun(task),
        },
      };

      await prisma.scheduledTask.update(failureUpdate);

      return { success: false, error: error.message };
    }
  }

  /**
   * Execute an action based on type
   */
  private async executeAction(
    userId: string,
    actionType: TaskActionType,
    payload: any,
  ): Promise<any> {
    switch (actionType) {
      case TaskActionType.SEND_NOTIFICATION:
        return notificationService.sendNotification(userId, {
          title: payload.title,
          message: payload.message,
          type: payload.type,
          channels: payload.channels,
        });

      case TaskActionType.CREATE_TODO:
        return todoService.createTodo(userId, {
          title: payload.title,
          description: payload.description,
          priority: payload.priority,
          category: payload.category,
          dueDate: payload.dueDate ? new Date(payload.dueDate) : undefined,
        });

      case TaskActionType.GENERATE_SUMMARY:
        // Import dynamically to avoid circular dependencies
        const { summarizationService } = await import("../summarization.js");
        return summarizationService.generateSummary(
          userId,
          payload.timeScale,
          payload.options,
        );

      case TaskActionType.RUN_AGENT:
        const { backgroundAgentService } =
          await import("../background-agents.js");
        const agentMethod = payload.agent;
        const agentServiceMethods = backgroundAgentService as unknown as Record<
          string,
          (userId: string) => Promise<any>
        >;
        if (typeof agentServiceMethods[agentMethod] === "function") {
          return agentServiceMethods[agentMethod](userId);
        }
        throw new Error(`Unknown agent: ${payload.agent}`);

      case TaskActionType.WEBHOOK:
        return this.executeWebhook(payload);

      case TaskActionType.WATCH_RESOURCE:
        return resourceWatcherService.runCheck(userId, payload);

      case TaskActionType.CUSTOM:
        return { custom: true, payload };

      default:
        throw new Error(`Unknown action type: ${actionType}`);
    }
  }

  /**
   * Execute a webhook
   */
  private async executeWebhook(payload: any) {
    const response = await fetch(payload.url, {
      method: payload.method ?? "POST",
      headers: {
        "Content-Type": "application/json",
        ...payload.headers,
      },
      body: payload.body ? JSON.stringify(payload.body) : undefined,
    });

    if (!response.ok) {
      throw new Error(
        `Webhook failed: ${response.status} ${response.statusText}`,
      );
    }

    return {
      status: response.status,
      body: await response.text(),
    };
  }

  // ==================== Task Scheduling ====================

  /**
   * Activate a task (start its schedule)
   */
  private async activateTask(task: any) {
    switch (task.scheduleType) {
      case ScheduleType.ONE_TIME:
        this.scheduleOneTime(task);
        break;

      case ScheduleType.CRON:
        this.scheduleCron(task);
        break;

      case ScheduleType.INTERVAL:
        this.scheduleInterval(task);
        break;
    }
  }

  /**
   * Deactivate a task
   */
  private deactivateTask(taskId: string) {
    // Stop cron job if exists
    const cronJob = this.activeCronJobs.get(taskId);
    if (cronJob) {
      cronJob.stop();
      this.activeCronJobs.delete(taskId);
    }

    // Clear interval if exists
    const timer = this.intervalTimers.get(taskId);
    if (timer) {
      clearInterval(timer);
      this.intervalTimers.delete(taskId);
    }
  }

  /**
   * Schedule a one-time task
   */
  private scheduleOneTime(task: any) {
    if (!task.executeAt) return;

    const delay = task.executeAt.getTime() - Date.now();
    if (delay <= 0) return; // Already passed

    const timer = setTimeout(async () => {
      await this.runTask(task);
      // Disable after one-time execution
      await prisma.scheduledTask.update({
        where: { id: task.id },
        data: { isEnabled: false },
      });
    }, delay);

    // Store as interval timer (for cleanup)
    this.intervalTimers.set(task.id, timer as unknown as NodeJS.Timeout);
  }

  /**
   * Schedule a cron task
   */
  private scheduleCron(task: any) {
    if (!task.cronExpression) return;

    try {
      const cronJob = new CronJob(
        task.cronExpression,
        async () => {
          await this.runTask(task);
        },
        null,
        true,
        "UTC",
      );

      this.activeCronJobs.set(task.id, cronJob);
    } catch (error) {
      console.error(`Failed to schedule cron task ${task.id}:`, error);
    }
  }

  /**
   * Schedule an interval task
   */
  private scheduleInterval(task: any) {
    if (!task.interval) return;

    const intervalMs = task.interval * 60 * 1000; // Convert minutes to ms

    const timer = setInterval(async () => {
      await this.runTask(task);
    }, intervalMs);

    this.intervalTimers.set(task.id, timer);
  }

  // ==================== Helpers ====================

  /**
   * Validate schedule input
   */
  private validateScheduleInput(input: CreateScheduledTaskInput) {
    switch (input.scheduleType) {
      case ScheduleType.ONE_TIME:
        if (!input.executeAt) {
          throw new Error("executeAt is required for ONE_TIME schedule");
        }
        if (input.executeAt <= new Date()) {
          throw new Error("executeAt must be in the future");
        }
        break;

      case ScheduleType.CRON:
        if (!input.cronExpression) {
          throw new Error("cronExpression is required for CRON schedule");
        }
        // Validate cron expression
        try {
          new CronJob(input.cronExpression, () => {});
        } catch {
          throw new Error("Invalid cron expression");
        }
        break;

      case ScheduleType.INTERVAL:
        if (!input.interval || input.interval < 1) {
          throw new Error(
            "interval (minutes) is required for INTERVAL schedule and must be >= 1",
          );
        }
        break;
    }
  }

  /**
   * Calculate next run time
   */
  private calculateNextRun(input: any): Date | null {
    switch (input.scheduleType) {
      case ScheduleType.ONE_TIME:
        return input.executeAt;

      case ScheduleType.CRON:
        if (!input.cronExpression) return null;
        try {
          const job = new CronJob(input.cronExpression, () => {});
          return job.nextDate().toJSDate();
        } catch {
          return null;
        }

      case ScheduleType.INTERVAL:
        if (!input.interval) return null;
        return new Date(Date.now() + input.interval * 60 * 1000);

      default:
        return null;
    }
  }

  /**
   * Check if task has reached its limits and should be disabled
   */
  private async checkTaskLimits(task: any) {
    let shouldDisable = false;

    // Check max runs
    if (task.maxRuns && task.runCount >= task.maxRuns) {
      shouldDisable = true;
    }

    // Check expiration
    if (task.expiresAt && new Date() >= task.expiresAt) {
      shouldDisable = true;
    }

    if (shouldDisable) {
      this.deactivateTask(task.id);
      await prisma.scheduledTask.update({
        where: { id: task.id },
        data: { isEnabled: false },
      });
    }
  }

  /**
   * Stop all scheduled tasks (for shutdown)
   */
  shutdown() {
    for (const [taskId] of this.activeCronJobs) {
      this.deactivateTask(taskId);
    }
    for (const [taskId] of this.intervalTimers) {
      this.deactivateTask(taskId);
    }
    console.log("✓ Scheduled tasks service shut down");
  }
}

export const scheduledTaskService = new ScheduledTaskService();
