/**
 * Scheduler Service
 *
 * Manages scheduled tasks for the Second Brain system including:
 * - Automated summarization at various time scales
 * - Memory pruning and archival
 * - Background agent execution
 * - Embedding processing for memories without vectors
 * - Scheduled notifications processing
 */

import prisma from "./prisma.js";
import { summarizationService } from "./summarization.js";
import { memoryManagerService } from "./memory-manager.js";
import { embeddingSchedulerService } from "./embedding-scheduler.js";
import { notificationService } from "./tools/notification.service.js";
import { TimeScale } from "@prisma/client";
import { CronJob } from "cron";

// Import background agents lazily to avoid circular dependencies
let backgroundAgentService: any = null;
async function getBackgroundAgentService() {
  if (!backgroundAgentService) {
    const module = await import("./background-agents.js");
    backgroundAgentService = module.backgroundAgentService;
  }
  return backgroundAgentService;
}

interface ScheduledTask {
  id: string;
  name: string;
  cronExpression: string;
  lastRun: Date | null;
  nextRun: Date | null;
  isEnabled: boolean;
  handler: () => Promise<void>;
  cronJob?: CronJob;
}

interface TaskResult {
  taskId: string;
  success: boolean;
  duration: number;
  error?: string;
  details?: any;
}

export class SchedulerService {
  private tasks: Map<string, ScheduledTask> = new Map();
  private isRunning = false;

  constructor() {
    this.registerDefaultTasks();
  }

  /**
   * Register default scheduled tasks
   */
  private registerDefaultTasks(): void {
    // Daily summarization - runs at midnight
    this.registerTask({
      id: "daily-summarization",
      name: "Daily Memory Summarization",
      cronExpression: "0 0 * * *", // Midnight daily
      lastRun: null,
      nextRun: null,
      isEnabled: true,
      handler: async () => {
        await this.runDailySummarization();
      },
    });

    // Weekly summarization - runs Sunday at midnight
    this.registerTask({
      id: "weekly-summarization",
      name: "Weekly Memory Summarization",
      cronExpression: "0 0 * * 0", // Midnight every Sunday
      lastRun: null,
      nextRun: null,
      isEnabled: true,
      handler: async () => {
        await this.runWeeklySummarization();
      },
    });

    // Monthly summarization - runs 1st of month at midnight
    this.registerTask({
      id: "monthly-summarization",
      name: "Monthly Memory Summarization",
      cronExpression: "0 0 1 * *", // Midnight on the 1st
      lastRun: null,
      nextRun: null,
      isEnabled: true,
      handler: async () => {
        await this.runMonthlySummarization();
      },
    });

    // Memory pruning - runs daily at 1 AM
    this.registerTask({
      id: "memory-pruning",
      name: "Memory Archival and Pruning",
      cronExpression: "0 1 * * *", // 1:00 AM daily
      lastRun: null,
      nextRun: null,
      isEnabled: true,
      handler: async () => {
        await this.runMemoryPruning();
      },
    });

    // Daily reflection - runs at 9 PM
    this.registerTask({
      id: "daily-reflection",
      name: "Daily Reflection Generation",
      cronExpression: "0 21 * * *", // 9:00 PM daily
      lastRun: null,
      nextRun: null,
      isEnabled: true,
      handler: async () => {
        await this.runDailyReflection();
      },
    });

    // Weekly insights - runs Friday at 6 PM
    this.registerTask({
      id: "weekly-insights",
      name: "Weekly Insights Generation",
      cronExpression: "0 18 * * 5", // 6:00 PM every Friday
      lastRun: null,
      nextRun: null,
      isEnabled: true,
      handler: async () => {
        await this.runWeeklyInsights();
      },
    });

    // Embedding processing - runs every hour
    this.registerTask({
      id: "embedding-processing",
      name: "Process Missing Embeddings",
      cronExpression: "0 * * * *", // Every hour at minute 0
      lastRun: null,
      nextRun: null,
      isEnabled: true,
      handler: async () => {
        await this.runEmbeddingProcessing();
      },
    });

    // Scheduled notifications processing - runs every minute
    this.registerTask({
      id: "scheduled-notifications",
      name: "Process Scheduled Notifications",
      cronExpression: "* * * * *", // Every minute
      lastRun: null,
      nextRun: null,
      isEnabled: true,
      handler: async () => {
        await this.runScheduledNotifications();
      },
    });
  }

  /**
   * Register a new task
   */
  registerTask(task: ScheduledTask): void {
    this.tasks.set(task.id, task);
    console.log(`✓ Registered task: ${task.name}`);
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.isRunning) {
      console.log("Scheduler is already running");
      return;
    }

    this.isRunning = true;
    console.log("🕐 Starting scheduler...");

    // Set up cron jobs for each task
    for (const [taskId, task] of this.tasks) {
      if (task.isEnabled) {
        try {
          // Create cron job with proper timezone handling
          const cronJob = new CronJob(
            task.cronExpression,
            async () => {
              await this.executeTask(taskId);
            },
            null, // onComplete callback
            true, // start immediately
            "UTC", // timezone
          );

          task.cronJob = cronJob;
          task.nextRun = cronJob.nextDate().toJSDate();

          console.log(`  ✓ Scheduled: ${task.name} (${task.cronExpression})`);
        } catch (error) {
          console.error(`  ✗ Failed to schedule ${task.name}:`, error);
        }
      }
    }

    console.log(`✓ Scheduler started with ${this.tasks.size} tasks`);

    // Verify and generate missing long-term memory summaries on startup
    this.verifyAndGenerateMissingSummaries().catch((error) => {
      console.error("⚠ Error during missing summaries verification:", error);
    });
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    for (const [, task] of this.tasks) {
      if (task.cronJob) {
        task.cronJob.stop();
      }
    }

    console.log("✓ Scheduler stopped");
  }

  /**
   * Execute a specific task
   */
  async executeTask(taskId: string): Promise<TaskResult> {
    const task = this.tasks.get(taskId);
    if (!task) {
      return {
        taskId,
        success: false,
        duration: 0,
        error: "Task not found",
      };
    }

    const startTime = Date.now();
    console.log(`\n🔄 Running task: ${task.name}`);

    try {
      await task.handler();
      const duration = Date.now() - startTime;
      task.lastRun = new Date();

      // Update nextRun if cronJob exists
      if (task.cronJob) {
        task.nextRun = task.cronJob.nextDate().toJSDate();
      }

      console.log(`✓ Task completed: ${task.name} (${duration}ms)`);

      // Log task execution
      await this.logTaskExecution(taskId, true, duration);

      return {
        taskId,
        success: true,
        duration,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`✗ Task failed: ${task.name}`, error);

      await this.logTaskExecution(taskId, false, duration, error.message);

      return {
        taskId,
        success: false,
        duration,
        error: error.message,
      };
    }
  }

  /**
   * Run task manually
   */
  async runTaskNow(taskId: string): Promise<TaskResult> {
    return this.executeTask(taskId);
  }

  /**
   * Get status of all tasks
   */
  getTasksStatus(): Array<{
    id: string;
    name: string;
    isEnabled: boolean;
    lastRun: Date | null;
    nextRun: Date | null;
  }> {
    return Array.from(this.tasks.values()).map((task) => ({
      id: task.id,
      name: task.name,
      isEnabled: task.isEnabled,
      lastRun: task.lastRun,
      nextRun: task.nextRun,
    }));
  }

  /**
   * Enable or disable a task
   */
  setTaskEnabled(taskId: string, enabled: boolean): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.isEnabled = enabled;

      if (!enabled && task.cronJob) {
        task.cronJob.stop();
        task.cronJob = undefined;
      } else if (enabled && this.isRunning && !task.cronJob) {
        try {
          const cronJob = new CronJob(
            task.cronExpression,
            async () => {
              await this.executeTask(taskId);
            },
            null,
            true,
            "UTC",
          );

          task.cronJob = cronJob;
          task.nextRun = cronJob.nextDate().toJSDate();
        } catch (error) {
          console.error(`Failed to enable task ${taskId}:`, error);
        }
      }
    }
  }

  // ==================== Task Handlers ====================

  /**
   * Run daily summarization for all users
   */
  private async runDailySummarization(): Promise<void> {
    const users = await prisma.user.findMany({ select: { id: true } });

    for (const user of users) {
      try {
        await summarizationService.generateSummary(
          user.id,
          TimeScale.DAILY,
          new Date(),
        );
        console.log(`  ✓ Daily summary generated for user ${user.id}`);
      } catch (error) {
        console.warn(
          `  ⚠ Could not generate daily summary for ${user.id}:`,
          error,
        );
      }
    }
  }

  /**
   * Run weekly summarization for all users
   */
  private async runWeeklySummarization(): Promise<void> {
    const users = await prisma.user.findMany({ select: { id: true } });

    for (const user of users) {
      try {
        await summarizationService.generateSummary(
          user.id,
          TimeScale.WEEKLY,
          new Date(),
        );
        console.log(`  ✓ Weekly summary generated for user ${user.id}`);
      } catch (error) {
        console.warn(
          `  ⚠ Could not generate weekly summary for ${user.id}:`,
          error,
        );
      }
    }
  }

  /**
   * Run monthly summarization for all users
   */
  private async runMonthlySummarization(): Promise<void> {
    const users = await prisma.user.findMany({ select: { id: true } });

    for (const user of users) {
      try {
        await summarizationService.generateSummary(
          user.id,
          TimeScale.MONTHLY,
          new Date(),
        );
        console.log(`  ✓ Monthly summary generated for user ${user.id}`);
      } catch (error) {
        console.warn(
          `  ⚠ Could not generate monthly summary for ${user.id}:`,
          error,
        );
      }
    }
  }

  /**
   * Run memory pruning for all users
   */
  private async runMemoryPruning(): Promise<void> {
    const users = await prisma.user.findMany({ select: { id: true } });

    for (const user of users) {
      try {
        const result = await memoryManagerService.pruneOldMemories(user.id);
        console.log(
          `  ✓ Pruned for ${user.id}: ${result.archived} archived, ${result.deleted} deleted`,
        );
      } catch (error) {
        console.warn(`  ⚠ Could not prune memories for ${user.id}:`, error);
      }
    }
  }

  /**
   * Run daily reflection generation
   */
  private async runDailyReflection(): Promise<void> {
    const users = await prisma.user.findMany({ select: { id: true } });
    const agentService = await getBackgroundAgentService();

    for (const user of users) {
      try {
        await agentService.runDailyReflection(user.id);
        console.log(`  ✓ Daily reflection generated for user ${user.id}`);
      } catch (error) {
        console.warn(
          `  ⚠ Could not generate daily reflection for ${user.id}:`,
          error,
        );
      }
    }
  }

  /**
   * Run weekly insights generation
   */
  private async runWeeklyInsights(): Promise<void> {
    const users = await prisma.user.findMany({ select: { id: true } });
    const agentService = await getBackgroundAgentService();

    for (const user of users) {
      try {
        await agentService.runWeeklyInsights(user.id);
        console.log(`  ✓ Weekly insights generated for user ${user.id}`);
      } catch (error) {
        console.warn(
          `  ⚠ Could not generate weekly insights for ${user.id}:`,
          error,
        );
      }
    }
  }

  /**
   * Process missing embeddings for all memories
   */
  private async runEmbeddingProcessing(): Promise<void> {
    try {
      const result =
        await embeddingSchedulerService.processAllMissingEmbeddings();
      console.log(
        `  ✓ Embedding processing: ${result.successful}/${result.totalProcessed} indexed`,
      );
    } catch (error) {
      console.warn(`  ⚠ Embedding processing failed:`, error);
    }
  }

  /**
   * Process scheduled notifications that are due
   */
  private async runScheduledNotifications(): Promise<void> {
    try {
      const result = await notificationService.processScheduledNotifications();
      if (result.processed > 0) {
        console.log(
          `  ✓ Scheduled notifications: ${result.successful}/${result.processed} sent`,
        );
      }
    } catch (error) {
      console.warn(`  ⚠ Scheduled notifications processing failed:`, error);
    }
  }

  /**
   * Verify and generate missing long-term memory summaries on startup
   */
  private async verifyAndGenerateMissingSummaries(): Promise<void> {
    console.log("\n🔍 Verifying long-term memory summaries...");

    try {
      const users = await prisma.user.findMany({ select: { id: true } });

      for (const user of users) {
        try {
          await this.checkAndGenerateMissingSummariesForUser(user.id);
        } catch (error) {
          console.warn(
            `  ⚠ Could not verify summaries for user ${user.id}:`,
            error,
          );
        }
      }

      console.log("✓ Missing summaries verification completed");
    } catch (error) {
      console.error("✗ Failed to verify missing summaries:", error);
    }
  }

  /**
   * Check and generate missing summaries for a specific user
   */
  private async checkAndGenerateMissingSummariesForUser(
    userId: string,
  ): Promise<void> {
    const now = new Date();

    // Define the time scales to check with their expected intervals in days
    const timeScales: Array<{
      scale: TimeScale;
      intervalDays: number;
      name: string;
    }> = [
      { scale: TimeScale.DAILY, intervalDays: 1, name: "daily" },
      { scale: TimeScale.WEEKLY, intervalDays: 7, name: "weekly" },
      { scale: TimeScale.MONTHLY, intervalDays: 30, name: "monthly" },
    ];

    for (const { scale, intervalDays, name } of timeScales) {
      try {
        // Get the most recent summary of this type
        const lastSummary = await prisma.summary.findFirst({
          where: { userId, timeScale: scale },
          orderBy: { periodEnd: "desc" },
        });

        const shouldGenerate = this.shouldGenerateSummary(
          lastSummary,
          now,
          intervalDays,
        );

        if (shouldGenerate) {
          console.log(`  → Generating missing ${name} summary for ${userId}`);
          await summarizationService.generateSummary(userId, scale, now);
          console.log(`  ✓ Generated ${name} summary for ${userId}`);
        }
      } catch (error: any) {
        // If error is about insufficient memories, it's expected - skip silently
        if (
          error.message &&
          error.message.includes("Not enough memories for")
        ) {
          // Skip - not enough data yet
        } else {
          console.warn(`  ⚠ Error generating ${name} summary:`, error);
        }
      }
    }
  }

  /**
   * Determine if a summary should be generated based on the last summary date
   */
  private shouldGenerateSummary(
    lastSummary: any | null,
    now: Date,
    intervalDays: number,
  ): boolean {
    if (!lastSummary) {
      // No summary exists - generate one if there's data
      return true;
    }

    // Check if enough time has passed since the last summary
    const daysSinceLastSummary =
      (now.getTime() - lastSummary.periodEnd.getTime()) /
      (1000 * 60 * 60 * 24);

    return daysSinceLastSummary >= intervalDays;
  }

  // ==================== Utilities ====================

  /**
   * Log task execution
   * Note: AuditLog table will be added in a future migration
   */
  private async logTaskExecution(
    taskId: string,
    success: boolean,
    duration: number,
    error?: string,
  ): Promise<void> {
    // For now, just log to console
    // TODO: Store in AuditLog table once migration is applied
    const logEntry = {
      action: "SCHEDULER_TASK",
      resource: taskId,
      success,
      duration,
      error,
      timestamp: new Date().toISOString(),
    };

    if (!success) {
      console.warn("Task execution failed:", logEntry);
    }
  }
}

// Export singleton instance
export const schedulerService = new SchedulerService();
