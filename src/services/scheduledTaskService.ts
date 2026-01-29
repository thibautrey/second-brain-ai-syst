/**
 * Scheduled Task Service - API client for scheduled task operations
 */

import { apiGet, apiPost, apiPatch, apiDelete } from "./api";
import type {
  ScheduledTask,
  CreateScheduledTaskInput,
  UpdateScheduledTaskInput,
  TaskFilters,
  TaskListResponse,
  TaskExecution,
} from "../types/tools";

export const scheduledTaskService = {
  /**
   * Create a new scheduled task
   */
  async create(input: CreateScheduledTaskInput): Promise<ScheduledTask> {
    const response = await apiPost<{ success: boolean; task: ScheduledTask }>(
      "/tools/scheduled-tasks",
      input,
    );
    return response.task;
  },

  /**
   * Get a task by ID
   */
  async get(id: string): Promise<ScheduledTask> {
    const response = await apiGet<{ success: boolean; task: ScheduledTask }>(
      `/tools/scheduled-tasks/${id}`,
    );
    return response.task;
  },

  /**
   * List all tasks
   */
  async list(filters?: TaskFilters): Promise<ScheduledTask[]> {
    const response = await apiGet<TaskListResponse>(
      "/tools/scheduled-tasks",
      filters as Record<string, unknown>,
    );
    return response.tasks;
  },

  /**
   * Update a task
   */
  async update(
    id: string,
    input: UpdateScheduledTaskInput,
  ): Promise<ScheduledTask> {
    const response = await apiPatch<{ success: boolean; task: ScheduledTask }>(
      `/tools/scheduled-tasks/${id}`,
      input,
    );
    return response.task;
  },

  /**
   * Enable a task
   */
  async enable(id: string): Promise<ScheduledTask> {
    const response = await apiPost<{ success: boolean; task: ScheduledTask }>(
      `/tools/scheduled-tasks/${id}/enable`,
    );
    return response.task;
  },

  /**
   * Disable a task
   */
  async disable(id: string): Promise<ScheduledTask> {
    const response = await apiPost<{ success: boolean; task: ScheduledTask }>(
      `/tools/scheduled-tasks/${id}/disable`,
    );
    return response.task;
  },

  /**
   * Execute a task immediately
   */
  async execute(id: string): Promise<{ execution: TaskExecution }> {
    return apiPost<{ success: boolean; execution: TaskExecution }>(
      `/tools/scheduled-tasks/${id}/execute`,
    );
  },

  /**
   * Get task execution history
   */
  async getHistory(id: string, limit: number = 10): Promise<TaskExecution[]> {
    const response = await apiGet<{
      success: boolean;
      executions: TaskExecution[];
    }>(`/tools/scheduled-tasks/${id}/history`, { limit });
    return response.executions;
  },

  /**
   * Delete a task
   */
  async delete(id: string): Promise<void> {
    await apiDelete<{ success: boolean }>(`/tools/scheduled-tasks/${id}`);
  },
};
