/**
 * Scheduler Service
 *
 * Manages scheduled tasks for the Second Brain system including:
 * - Automated summarization at various time scales
 * - Memory pruning and archival
 * - Background agent execution
 */

import prisma from "./prisma.js";
import { summarizationService } from "./summarization.js";
import { memoryManagerService } from "./memory-manager.js";
import { TimeScale } from "@prisma/client";

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
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private isRunning = false;

  constructor() {
    this.registerDefaultTasks();
  }

  /**
   * Register default scheduled tasks
   */
  private registerDefaultTasks(): void {
    // Daily summarization - runs at 2 AM
    this.registerTask({
      id: "daily-summarization",
      name: "Daily Memory Summarization",
      cronExpression: "0 2 * * *", // 2:00 AM daily
      lastRun: null,
      nextRun: null,
      isEnabled: true,
      handler: async () => {
        await this.runDailySummarization();
      },
    });

    // Weekly summarization - runs Sunday at 3 AM
    this.registerTask({
      id: "weekly-summarization",
      name: "Weekly Memory Summarization",
      cronExpression: "0 3 * * 0", // 3:00 AM every Sunday
      lastRun: null,
      nextRun: null,
      isEnabled: true,
      handler: async () => {
        await this.runWeeklySummarization();
      },
    });

    // Monthly summarization - runs 1st of month at 4 AM
    this.registerTask({
      id: "monthly-summarization",
      name: "Monthly Memory Summarization",
      cronExpression: "0 4 1 * *", // 4:00 AM on the 1st
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

    // Parse cron expressions and set up intervals
    for (const [taskId, task] of this.tasks) {
      if (task.isEnabled) {
        const intervalMs = this.cronToInterval(task.cronExpression);
        task.nextRun = new Date(Date.now() + intervalMs);

        const interval = setInterval(async () => {
          await this.executeTask(taskId);
        }, intervalMs);

        this.intervals.set(taskId, interval);
        console.log(
          `  ✓ Scheduled: ${task.name} (every ${this.formatDuration(intervalMs)})`,
        );
      }
    }

    console.log(`✓ Scheduler started with ${this.tasks.size} tasks`);
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    for (const [taskId, interval] of this.intervals) {
      clearInterval(interval);
    }
    this.intervals.clear();

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

      if (!enabled && this.intervals.has(taskId)) {
        clearInterval(this.intervals.get(taskId)!);
        this.intervals.delete(taskId);
      } else if (enabled && this.isRunning && !this.intervals.has(taskId)) {
        const intervalMs = this.cronToInterval(task.cronExpression);
        const interval = setInterval(async () => {
          await this.executeTask(taskId);
        }, intervalMs);
        this.intervals.set(taskId, interval);
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

  // ==================== Utilities ====================

  /**
   * Convert cron expression to milliseconds interval
   * Simplified parser for common patterns
   */
  private cronToInterval(cron: string): number {
    const parts = cron.split(" ");
    // minute hour day month weekday

    // Daily at specific hour
    if (parts[2] === "*" && parts[3] === "*" && parts[4] === "*") {
      return 24 * 60 * 60 * 1000; // 24 hours
    }

    // Weekly (specific weekday)
    if (parts[2] === "*" && parts[3] === "*" && parts[4] !== "*") {
      return 7 * 24 * 60 * 60 * 1000; // 7 days
    }

    // Monthly (specific day)
    if (parts[2] !== "*" && parts[3] === "*") {
      return 30 * 24 * 60 * 60 * 1000; // ~30 days
    }

    // Default: daily
    return 24 * 60 * 60 * 1000;
  }

  /**
   * Format duration for logging
   */
  private formatDuration(ms: number): string {
    const hours = Math.floor(ms / (60 * 60 * 1000));
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days} day${days > 1 ? "s" : ""}`;
    }
    return `${hours} hour${hours > 1 ? "s" : ""}`;
  }

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
