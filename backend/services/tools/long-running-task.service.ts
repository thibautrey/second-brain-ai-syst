/**
 * Long Running Task Service
 *
 * Manages long-lasting autonomous tasks that can take anywhere from minutes to hours.
 * Features:
 * - Step-by-step execution with checkpoints
 * - Error handling and recovery
 * - Progress summaries for AI coherence
 * - User notification on completion (configurable)
 * - State persistence across restarts
 * - Real-time WebSocket updates
 */

import prisma from "../prisma.js";
import { llmRouterService } from "../llm-router.js";
import { notificationService } from "./notification.service.js";
import { wsBroadcastService } from "../websocket-broadcast.js";
import { EventEmitter } from "events";
import {
  LongRunningTaskStatus,
  TaskStepStatus,
  TaskCompletionBehavior,
  TaskPriority,
} from "@prisma/client";

// ==================== Types ====================

export interface CreateLongRunningTaskInput {
  name: string;
  description: string;
  objective: string;
  estimatedDurationMinutes?: number;
  priority?: TaskPriority;
  completionBehavior?: TaskCompletionBehavior;
  notifyOnProgress?: boolean;
  progressIntervalMinutes?: number;
  metadata?: Record<string, any>;
  initialContext?: Record<string, any>;
}

export interface TaskStepDefinition {
  name: string;
  description: string;
  action: string;
  params: Record<string, any>;
  expectedDurationMinutes?: number;
  isCheckpoint?: boolean;
  onError?: "continue" | "retry" | "abort";
  maxRetries?: number;
}

export interface TaskProgressSummary {
  taskId: string;
  taskName: string;
  objective: string;
  status: LongRunningTaskStatus;
  progress: number;
  currentStep: string | null;
  completedSteps: number;
  totalSteps: number;
  elapsedMinutes: number;
  estimatedRemainingMinutes: number | null;
  lastCheckpointSummary: string | null;
  errors: string[];
  keyResults: string[];
}

export interface TaskExecutionContext {
  taskId: string;
  userId: string;
  stepResults: Record<string, any>;
  accumulatedData: Record<string, any>;
  startedAt: Date;
  lastCheckpointAt: Date | null;
}

// ==================== Event Types ====================

export type TaskEventType =
  | "task:started"
  | "task:paused"
  | "task:resumed"
  | "task:completed"
  | "task:failed"
  | "task:cancelled"
  | "step:started"
  | "step:completed"
  | "step:failed"
  | "checkpoint:created"
  | "progress:updated";

export interface TaskEvent {
  type: TaskEventType;
  taskId: string;
  userId: string;
  data: Record<string, any>;
  timestamp: Date;
}

// ==================== Service ====================

export class LongRunningTaskService extends EventEmitter {
  private activeExecutions: Map<string, AbortController> = new Map();
  private progressTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    super();
  }

  /**
   * Initialize the service - recover any interrupted tasks
   */
  async initialize(): Promise<void> {
    console.log("🚀 Initializing Long Running Task Service...");

    // Find tasks that were running when the server stopped
    const interruptedTasks = await prisma.longRunningTask.findMany({
      where: {
        status: {
          in: [LongRunningTaskStatus.RUNNING, LongRunningTaskStatus.PAUSED],
        },
      },
      include: {
        steps: {
          orderBy: { stepOrder: "asc" },
        },
      },
    });

    for (const task of interruptedTasks) {
      // Mark as paused if it was running (server restart)
      if (task.status === LongRunningTaskStatus.RUNNING) {
        await prisma.longRunningTask.update({
          where: { id: task.id },
          data: {
            status: LongRunningTaskStatus.PAUSED,
            lastPausedAt: new Date(),
          },
        });

        await this.addLog(task.id, "warn", "Task paused due to server restart");
      }
    }

    console.log(
      `✓ Found ${interruptedTasks.length} interrupted tasks (marked as paused)`,
    );
  }

  /**
   * Create a new long-running task
   */
  async createTask(
    userId: string,
    input: CreateLongRunningTaskInput,
  ): Promise<any> {
    const task = await prisma.longRunningTask.create({
      data: {
        userId,
        name: input.name,
        description: input.description,
        objective: input.objective,
        estimatedDurationMinutes: input.estimatedDurationMinutes,
        priority: input.priority ?? TaskPriority.MEDIUM,
        completionBehavior:
          input.completionBehavior ?? TaskCompletionBehavior.NOTIFY_USER,
        notifyOnProgress: input.notifyOnProgress ?? false,
        progressIntervalMinutes: input.progressIntervalMinutes ?? 15,
        metadata: input.metadata ?? {},
        context: input.initialContext ?? {},
        status: LongRunningTaskStatus.PENDING,
      },
    });

    await this.addLog(task.id, "info", `Task created: ${input.name}`);

    this.emit("task:created", {
      type: "task:created",
      taskId: task.id,
      userId,
      data: { name: input.name },
      timestamp: new Date(),
    });

    return task;
  }

  /**
   * Add steps to a task
   */
  async addSteps(taskId: string, steps: TaskStepDefinition[]): Promise<any[]> {
    const existingSteps = await prisma.taskStep.count({
      where: { taskId },
    });

    const createdSteps = await Promise.all(
      steps.map((step, index) =>
        prisma.taskStep.create({
          data: {
            taskId,
            stepOrder: existingSteps + index + 1,
            name: step.name,
            description: step.description,
            action: step.action,
            params: step.params,
            expectedDurationMinutes: step.expectedDurationMinutes,
            isCheckpoint: step.isCheckpoint ?? false,
            onError: step.onError ?? "abort",
            maxRetries: step.maxRetries ?? 3,
            status: TaskStepStatus.PENDING,
          },
        }),
      ),
    );

    await prisma.longRunningTask.update({
      where: { id: taskId },
      data: { totalSteps: existingSteps + steps.length },
    });

    return createdSteps;
  }

  /**
   * Start executing a task
   */
  async startTask(userId: string, taskId: string): Promise<void> {
    const task = await this.getTask(userId, taskId);

    if (!task) {
      throw new Error("Task not found");
    }

    if (task.status === LongRunningTaskStatus.RUNNING) {
      throw new Error("Task is already running");
    }

    if (
      task.status === LongRunningTaskStatus.COMPLETED ||
      task.status === LongRunningTaskStatus.FAILED ||
      task.status === LongRunningTaskStatus.CANCELLED
    ) {
      throw new Error("Task has already finished");
    }

    // Create abort controller for this execution
    const abortController = new AbortController();
    this.activeExecutions.set(taskId, abortController);

    // Update task status
    await prisma.longRunningTask.update({
      where: { id: taskId },
      data: {
        status: LongRunningTaskStatus.RUNNING,
        startedAt: task.startedAt ?? new Date(),
        lastResumedAt:
          task.status === LongRunningTaskStatus.PAUSED ? new Date() : undefined,
      },
    });

    await this.addLog(taskId, "info", "Task execution started");

    this.emit("task:started", {
      type: "task:started",
      taskId,
      userId,
      data: {},
      timestamp: new Date(),
    });

    // Send WebSocket notification
    wsBroadcastService.sendTaskStarted(userId, taskId, task.name);

    // Start progress notification timer if enabled
    if (task.notifyOnProgress && task.progressIntervalMinutes) {
      this.startProgressTimer(taskId, userId, task.progressIntervalMinutes);
    }

    // Execute task in background
    this.executeTaskAsync(userId, taskId, abortController.signal);
  }

  /**
   * Pause a running task
   */
  async pauseTask(userId: string, taskId: string): Promise<void> {
    const task = await this.getTask(userId, taskId);

    if (!task || task.status !== LongRunningTaskStatus.RUNNING) {
      throw new Error("Task is not running");
    }

    // Signal abort
    const controller = this.activeExecutions.get(taskId);
    if (controller) {
      controller.abort();
      this.activeExecutions.delete(taskId);
    }

    // Stop progress timer
    this.stopProgressTimer(taskId);

    // Update status
    await prisma.longRunningTask.update({
      where: { id: taskId },
      data: {
        status: LongRunningTaskStatus.PAUSED,
        lastPausedAt: new Date(),
      },
    });

    await this.addLog(taskId, "info", "Task paused by user");

    this.emit("task:paused", {
      type: "task:paused",
      taskId,
      userId,
      data: {},
      timestamp: new Date(),
    });

    // Send WebSocket notification
    wsBroadcastService.sendTaskPaused(userId, taskId, task.name);
  }

  /**
   * Resume a paused task
   */
  async resumeTask(userId: string, taskId: string): Promise<void> {
    const task = await this.getTask(userId, taskId);

    if (!task || task.status !== LongRunningTaskStatus.PAUSED) {
      throw new Error("Task is not paused");
    }

    await this.startTask(userId, taskId);
  }

  /**
   * Cancel a task
   */
  async cancelTask(userId: string, taskId: string): Promise<void> {
    const task = await this.getTask(userId, taskId);

    if (!task) {
      throw new Error("Task not found");
    }

    // Signal abort if running
    const controller = this.activeExecutions.get(taskId);
    if (controller) {
      controller.abort();
      this.activeExecutions.delete(taskId);
    }

    // Stop progress timer
    this.stopProgressTimer(taskId);

    await prisma.longRunningTask.update({
      where: { id: taskId },
      data: {
        status: LongRunningTaskStatus.CANCELLED,
        completedAt: new Date(),
      },
    });

    await this.addLog(taskId, "warn", "Task cancelled by user");

    this.emit("task:cancelled", {
      type: "task:cancelled",
      taskId,
      userId,
      data: {},
      timestamp: new Date(),
    });

    // Send WebSocket notification
    wsBroadcastService.sendTaskCancelled(userId, taskId, task.name);

    // Handle completion behavior
    if (task.completionBehavior !== TaskCompletionBehavior.SILENT) {
      await this.sendCompletionNotification(task, "cancelled");
    }
  }

  /**
   * Get task by ID
   */
  async getTask(userId: string, taskId: string) {
    return prisma.longRunningTask.findFirst({
      where: { id: taskId, userId },
      include: {
        steps: {
          orderBy: { stepOrder: "asc" },
        },
        logs: {
          orderBy: { createdAt: "desc" },
          take: 50,
        },
      },
    });
  }

  /**
   * List tasks for a user
   */
  async listTasks(
    userId: string,
    filters: {
      status?: LongRunningTaskStatus | LongRunningTaskStatus[];
      priority?: TaskPriority;
      limit?: number;
    } = {},
  ) {
    return prisma.longRunningTask.findMany({
      where: {
        userId,
        ...(filters.status && {
          status: Array.isArray(filters.status)
            ? { in: filters.status }
            : filters.status,
        }),
        ...(filters.priority && { priority: filters.priority }),
      },
      include: {
        steps: {
          orderBy: { stepOrder: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
      take: filters.limit ?? 50,
    });
  }

  /**
   * Get progress summary for AI coherence
   */
  async getProgressSummary(
    userId: string,
    taskId: string,
  ): Promise<TaskProgressSummary | null> {
    const task = await this.getTask(userId, taskId);

    if (!task) return null;

    const completedSteps = task.steps.filter(
      (s) => s.status === TaskStepStatus.COMPLETED,
    ).length;
    const currentStep = task.steps.find(
      (s) => s.status === TaskStepStatus.RUNNING,
    );
    const errors = task.steps
      .filter((s) => s.errorMessage)
      .map((s) => s.errorMessage!);
    const keyResults = task.steps
      .filter((s) => s.status === TaskStepStatus.COMPLETED && s.result)
      .map((s) => {
        const result = s.result as Record<string, any>;
        return result.summary || result.result || "Step completed";
      });

    const elapsedMinutes = task.startedAt
      ? Math.round((Date.now() - task.startedAt.getTime()) / 60000)
      : 0;

    const estimatedRemainingMinutes =
      task.estimatedDurationMinutes && task.progress > 0
        ? Math.round(
            (task.estimatedDurationMinutes * (100 - task.progress)) / 100,
          )
        : null;

    return {
      taskId: task.id,
      taskName: task.name,
      objective: task.objective,
      status: task.status,
      progress: task.progress,
      currentStep: currentStep?.name ?? null,
      completedSteps,
      totalSteps: task.totalSteps,
      elapsedMinutes,
      estimatedRemainingMinutes,
      lastCheckpointSummary: task.lastCheckpointSummary,
      errors,
      keyResults,
    };
  }

  /**
   * Generate AI-readable progress report
   */
  async generateProgressReport(
    userId: string,
    taskId: string,
  ): Promise<string> {
    const summary = await this.getProgressSummary(userId, taskId);

    if (!summary) return "Task not found";

    const statusEmoji = {
      PENDING: "⏳",
      RUNNING: "🔄",
      PAUSED: "⏸️",
      COMPLETED: "✅",
      FAILED: "❌",
      CANCELLED: "🚫",
    };

    let report = `## Task Progress Report\n\n`;
    report += `**Task:** ${summary.taskName}\n`;
    report += `**Objective:** ${summary.objective}\n`;
    report += `**Status:** ${statusEmoji[summary.status]} ${summary.status}\n`;
    report += `**Progress:** ${summary.progress}% (${summary.completedSteps}/${summary.totalSteps} steps)\n`;

    if (summary.currentStep) {
      report += `**Current Step:** ${summary.currentStep}\n`;
    }

    report += `**Elapsed Time:** ${summary.elapsedMinutes} minutes\n`;

    if (summary.estimatedRemainingMinutes) {
      report += `**Estimated Remaining:** ${summary.estimatedRemainingMinutes} minutes\n`;
    }

    if (summary.lastCheckpointSummary) {
      report += `\n### Last Checkpoint\n${summary.lastCheckpointSummary}\n`;
    }

    if (summary.keyResults.length > 0) {
      report += `\n### Key Results\n`;
      summary.keyResults.forEach((r, i) => {
        report += `${i + 1}. ${r}\n`;
      });
    }

    if (summary.errors.length > 0) {
      report += `\n### Errors Encountered\n`;
      summary.errors.forEach((e) => {
        report += `- ⚠️ ${e}\n`;
      });
    }

    return report;
  }

  // ==================== Private Methods ====================

  /**
   * Execute task asynchronously
   */
  private async executeTaskAsync(
    userId: string,
    taskId: string,
    signal: AbortSignal,
  ): Promise<void> {
    try {
      const task = await this.getTask(userId, taskId);
      if (!task) return;

      // Find next step to execute
      const pendingSteps = task.steps.filter(
        (s) =>
          s.status === TaskStepStatus.PENDING ||
          s.status === TaskStepStatus.FAILED,
      );

      for (const step of pendingSteps) {
        if (signal.aborted) {
          await this.addLog(taskId, "info", "Execution aborted");
          return;
        }

        await this.executeStep(userId, taskId, step.id, signal);

        // Check if step created a checkpoint
        const updatedStep = await prisma.taskStep.findUnique({
          where: { id: step.id },
        });

        if (updatedStep?.isCheckpoint) {
          await this.createCheckpoint(userId, taskId);
        }

        // Update progress
        await this.updateProgress(taskId);
      }

      // All steps completed - mark task as complete
      await this.completeTask(userId, taskId);
    } catch (error: any) {
      await this.failTask(userId, taskId, error.message);
    }
  }

  /**
   * Execute a single step
   */
  private async executeStep(
    userId: string,
    taskId: string,
    stepId: string,
    signal: AbortSignal,
  ): Promise<void> {
    const step = await prisma.taskStep.findUnique({
      where: { id: stepId },
      include: { task: true },
    });

    if (!step) return;

    // Mark step as running
    await prisma.taskStep.update({
      where: { id: stepId },
      data: {
        status: TaskStepStatus.RUNNING,
        startedAt: new Date(),
      },
    });

    this.emit("step:started", {
      type: "step:started",
      taskId,
      userId,
      data: { stepId, stepName: step.name },
      timestamp: new Date(),
    });

    await this.addLog(taskId, "info", `Starting step: ${step.name}`);

    try {
      // Execute the step action
      const result = await this.executeStepAction(
        userId,
        step.action,
        step.params as Record<string, any>,
        step.task.context as Record<string, any>,
        signal,
      );

      // Mark step as completed
      await prisma.taskStep.update({
        where: { id: stepId },
        data: {
          status: TaskStepStatus.COMPLETED,
          completedAt: new Date(),
          result,
        },
      });

      // Update task context with step result
      const currentContext = step.task.context as Record<string, any>;
      await prisma.longRunningTask.update({
        where: { id: taskId },
        data: {
          context: {
            ...currentContext,
            [`step_${step.stepOrder}_result`]: result,
          },
        },
      });

      this.emit("step:completed", {
        type: "step:completed",
        taskId,
        userId,
        data: { stepId, stepName: step.name, result },
        timestamp: new Date(),
      });

      // Send WebSocket notification
      wsBroadcastService.sendStepCompleted(
        userId,
        taskId,
        step.name,
        step.stepOrder,
      );

      await this.addLog(taskId, "info", `Completed step: ${step.name}`);
    } catch (error: any) {
      const retryCount = step.retryCount + 1;

      if (step.onError === "retry" && retryCount <= step.maxRetries) {
        // Retry the step
        await prisma.taskStep.update({
          where: { id: stepId },
          data: {
            retryCount,
            status: TaskStepStatus.PENDING,
            errorMessage: error.message,
          },
        });

        await this.addLog(
          taskId,
          "warn",
          `Step ${step.name} failed, retrying (${retryCount}/${step.maxRetries}): ${error.message}`,
        );

        // Wait before retry
        await this.sleep(2000 * retryCount);

        if (!signal.aborted) {
          await this.executeStep(userId, taskId, stepId, signal);
        }
      } else if (step.onError === "continue") {
        // Mark as failed but continue
        await prisma.taskStep.update({
          where: { id: stepId },
          data: {
            status: TaskStepStatus.SKIPPED,
            errorMessage: error.message,
          },
        });

        await this.addLog(
          taskId,
          "warn",
          `Step ${step.name} failed, continuing: ${error.message}`,
        );
      } else {
        // Abort the task
        await prisma.taskStep.update({
          where: { id: stepId },
          data: {
            status: TaskStepStatus.FAILED,
            errorMessage: error.message,
          },
        });

        this.emit("step:failed", {
          type: "step:failed",
          taskId,
          userId,
          data: { stepId, stepName: step.name, error: error.message },
          timestamp: new Date(),
        });

        throw error;
      }
    }
  }

  /**
   * Execute a step action
   * Override this method in a subclass to add custom actions
   */
  protected async executeStepAction(
    userId: string,
    action: string,
    params: Record<string, any>,
    context: Record<string, any>,
    signal: AbortSignal,
  ): Promise<Record<string, any>> {
    // Built-in actions
    switch (action) {
      case "llm_generate":
        return this.actionLLMGenerate(userId, params, context);

      case "wait":
        return this.actionWait(params, signal);

      case "conditional":
        return this.actionConditional(params, context);

      case "aggregate":
        return this.actionAggregate(params, context);

      case "notify":
        return this.actionNotify(userId, params, context);

      default:
        // Check if it's a custom action registered by extensions
        throw new Error(`Unknown action: ${action}`);
    }
  }

  /**
   * LLM generation action
   */
  private async actionLLMGenerate(
    userId: string,
    params: Record<string, any>,
    context: Record<string, any>,
  ): Promise<Record<string, any>> {
    const { prompt, systemPrompt, model, maxTokens, temperature } = params;

    // Inject context into prompt
    const finalPrompt = this.interpolateContext(prompt, context);
    const finalSystemPrompt = systemPrompt
      ? this.interpolateContext(systemPrompt, context)
      : undefined;

    const content = await llmRouterService.executeTask(
      userId,
      "analysis",
      finalSystemPrompt || "You are a helpful AI assistant.",
      finalPrompt,
      {
        maxTokens: maxTokens || 2000,
        temperature: temperature || 0.7,
        responseFormat: "text",
      },
    );

    return {
      summary: "LLM response generated",
      result: content,
    };
  }

  /**
   * Wait action
   */
  private async actionWait(
    params: Record<string, any>,
    signal: AbortSignal,
  ): Promise<Record<string, any>> {
    const { minutes } = params;
    const ms = (minutes || 1) * 60 * 1000;

    await this.sleepWithAbort(ms, signal);

    return {
      summary: `Waited ${minutes} minutes`,
      result: "completed",
    };
  }

  /**
   * Conditional action
   */
  private async actionConditional(
    params: Record<string, any>,
    context: Record<string, any>,
  ): Promise<Record<string, any>> {
    const { condition, ifTrue, ifFalse } = params;

    // Simple condition evaluation (can be extended)
    const conditionValue = this.interpolateContext(condition, context);
    const result = Boolean(conditionValue);

    return {
      summary: `Condition evaluated to ${result}`,
      result,
      selectedPath: result ? "ifTrue" : "ifFalse",
      value: result ? ifTrue : ifFalse,
    };
  }

  /**
   * Aggregate action - combine results from previous steps
   */
  private async actionAggregate(
    params: Record<string, any>,
    context: Record<string, any>,
  ): Promise<Record<string, any>> {
    const { keys, operation } = params;

    const values = keys.map((key: string) => context[key]);

    let result: any;
    switch (operation) {
      case "concat":
        result = values.flat().join("\n\n");
        break;
      case "merge":
        result = values.reduce(
          (acc: any, val: any) => ({ ...acc, ...val }),
          {},
        );
        break;
      case "list":
        result = values;
        break;
      default:
        result = values;
    }

    return {
      summary: `Aggregated ${keys.length} values`,
      result,
    };
  }

  /**
   * Notify action
   */
  private async actionNotify(
    userId: string,
    params: Record<string, any>,
    context: Record<string, any>,
  ): Promise<Record<string, any>> {
    const { title, message, type } = params;

    const finalTitle = this.interpolateContext(title, context);
    const finalMessage = this.interpolateContext(message, context);

    await notificationService.sendNotification(userId, {
      title: finalTitle,
      message: finalMessage,
      type: type || "INFO",
    });

    return {
      summary: "Notification sent",
      result: { title: finalTitle, message: finalMessage },
    };
  }

  /**
   * Create a checkpoint with summary
   */
  private async createCheckpoint(
    userId: string,
    taskId: string,
  ): Promise<void> {
    const task = await this.getTask(userId, taskId);
    if (!task) return;

    // Generate checkpoint summary using LLM
    const completedSteps = task.steps.filter(
      (s) => s.status === TaskStepStatus.COMPLETED,
    );
    const stepsInfo = completedSteps
      .map((s) => {
        const result = s.result as Record<string, any>;
        return `- ${s.name}: ${result?.summary || "Completed"}`;
      })
      .join("\n");

    const checkpointPrompt = `Generate a brief checkpoint summary (2-3 sentences) for this task progress:

Task: ${task.name}
Objective: ${task.objective}
Progress: ${task.progress}%

Completed Steps:
${stepsInfo}

Write a concise summary that captures the key progress made.`;

    try {
      const summary = await llmRouterService.executeTask(
        userId,
        "summarization",
        "You are a task progress summarizer. Be concise and factual.",
        checkpointPrompt,
        { maxTokens: 200, temperature: 0.3 },
      );

      await prisma.longRunningTask.update({
        where: { id: taskId },
        data: {
          lastCheckpointAt: new Date(),
          lastCheckpointSummary: summary,
        },
      });

      await this.addLog(taskId, "info", `Checkpoint created: ${summary}`);

      this.emit("checkpoint:created", {
        type: "checkpoint:created",
        taskId,
        userId,
        data: { summary: summary },
        timestamp: new Date(),
      });

      // Send WebSocket notification
      wsBroadcastService.sendTaskCheckpoint(userId, taskId, summary);
    } catch (error: any) {
      await this.addLog(
        taskId,
        "warn",
        `Failed to create checkpoint summary: ${error.message}`,
      );
    }
  }

  /**
   * Update task progress percentage
   */
  private async updateProgress(taskId: string): Promise<void> {
    const task = await prisma.longRunningTask.findUnique({
      where: { id: taskId },
      include: { steps: true },
    });

    if (!task) return;

    const completedSteps = task.steps.filter(
      (s) =>
        s.status === TaskStepStatus.COMPLETED ||
        s.status === TaskStepStatus.SKIPPED,
    ).length;

    const progress =
      task.totalSteps > 0
        ? Math.round((completedSteps / task.totalSteps) * 100)
        : 0;

    await prisma.longRunningTask.update({
      where: { id: taskId },
      data: { progress },
    });

    this.emit("progress:updated", {
      type: "progress:updated",
      taskId,
      userId: task.userId,
      data: { progress, completedSteps, totalSteps: task.totalSteps },
      timestamp: new Date(),
    });

    // Send WebSocket notification
    const currentStep = task.steps.find(
      (s) => s.status === TaskStepStatus.RUNNING,
    );
    wsBroadcastService.sendTaskProgress(
      task.userId,
      taskId,
      progress,
      currentStep?.name ?? null,
      completedSteps,
      task.totalSteps,
    );
  }

  /**
   * Complete a task
   */
  private async completeTask(userId: string, taskId: string): Promise<void> {
    const task = await this.getTask(userId, taskId);
    if (!task) return;

    // Stop progress timer
    this.stopProgressTimer(taskId);

    // Clean up
    this.activeExecutions.delete(taskId);

    // Generate final summary
    const finalReport = await this.generateProgressReport(userId, taskId);

    await prisma.longRunningTask.update({
      where: { id: taskId },
      data: {
        status: LongRunningTaskStatus.COMPLETED,
        completedAt: new Date(),
        progress: 100,
        finalSummary: finalReport,
      },
    });

    await this.addLog(taskId, "info", "Task completed successfully");

    this.emit("task:completed", {
      type: "task:completed",
      taskId,
      userId,
      data: { summary: finalReport },
      timestamp: new Date(),
    });

    // Send WebSocket notification
    wsBroadcastService.sendTaskCompleted(
      userId,
      taskId,
      task.name,
      finalReport,
    );

    // Handle completion notification
    if (task.completionBehavior !== TaskCompletionBehavior.SILENT) {
      await this.sendCompletionNotification(task, "completed", finalReport);
    }
  }

  /**
   * Fail a task
   */
  private async failTask(
    userId: string,
    taskId: string,
    error: string,
  ): Promise<void> {
    const task = await this.getTask(userId, taskId);
    if (!task) return;

    // Stop progress timer
    this.stopProgressTimer(taskId);

    // Clean up
    this.activeExecutions.delete(taskId);

    await prisma.longRunningTask.update({
      where: { id: taskId },
      data: {
        status: LongRunningTaskStatus.FAILED,
        completedAt: new Date(),
        errorMessage: error,
      },
    });

    await this.addLog(taskId, "error", `Task failed: ${error}`);

    this.emit("task:failed", {
      type: "task:failed",
      taskId,
      userId,
      data: { error },
      timestamp: new Date(),
    });

    // Send WebSocket notification
    wsBroadcastService.sendTaskFailed(userId, taskId, task.name, error);

    // Always notify on failure (unless explicitly silent)
    if (task.completionBehavior !== TaskCompletionBehavior.SILENT) {
      await this.sendCompletionNotification(task, "failed", undefined, error);
    }
  }

  /**
   * Send completion notification
   */
  private async sendCompletionNotification(
    task: any,
    outcome: "completed" | "failed" | "cancelled",
    summary?: string,
    error?: string,
  ): Promise<void> {
    const titles = {
      completed: `✅ Task Completed: ${task.name}`,
      failed: `❌ Task Failed: ${task.name}`,
      cancelled: `🚫 Task Cancelled: ${task.name}`,
    };

    const messages = {
      completed:
        summary || `Task "${task.name}" has been completed successfully.`,
      failed: `Task "${task.name}" failed: ${error || "Unknown error"}`,
      cancelled: `Task "${task.name}" was cancelled.`,
    };

    const types = {
      completed: "SUCCESS" as const,
      failed: "ERROR" as const,
      cancelled: "WARNING" as const,
    };

    await notificationService.sendNotification(task.userId, {
      title: titles[outcome],
      message: messages[outcome],
      type: types[outcome],
      sourceType: "long_running_task",
      sourceId: task.id,
    });
  }

  /**
   * Start progress notification timer
   */
  private startProgressTimer(
    taskId: string,
    userId: string,
    intervalMinutes: number,
  ): void {
    const timer = setInterval(
      async () => {
        try {
          const summary = await this.getProgressSummary(userId, taskId);
          if (summary && summary.status === LongRunningTaskStatus.RUNNING) {
            await notificationService.sendNotification(userId, {
              title: `📊 Task Progress: ${summary.taskName}`,
              message: `Progress: ${summary.progress}% - ${summary.currentStep || "Processing..."}`,
              type: "INFO",
              sourceType: "long_running_task",
              sourceId: taskId,
            });
          }
        } catch (error) {
          console.error("Error sending progress notification:", error);
        }
      },
      intervalMinutes * 60 * 1000,
    );

    this.progressTimers.set(taskId, timer);
  }

  /**
   * Stop progress notification timer
   */
  private stopProgressTimer(taskId: string): void {
    const timer = this.progressTimers.get(taskId);
    if (timer) {
      clearInterval(timer);
      this.progressTimers.delete(taskId);
    }
  }

  /**
   * Add a log entry
   */
  private async addLog(
    taskId: string,
    level: "info" | "warn" | "error",
    message: string,
  ): Promise<void> {
    await prisma.taskLog.create({
      data: {
        taskId,
        level,
        message,
      },
    });
  }

  /**
   * Interpolate context variables into a string
   */
  private interpolateContext(
    template: string,
    context: Record<string, any>,
  ): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      if (key in context) {
        const value = context[key];
        return typeof value === "string" ? value : JSON.stringify(value);
      }
      return match;
    });
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Sleep with abort support
   */
  private sleepWithAbort(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(resolve, ms);

      signal.addEventListener("abort", () => {
        clearTimeout(timeout);
        reject(new Error("Aborted"));
      });
    });
  }
}

// Export singleton instance
export const longRunningTaskService = new LongRunningTaskService();
