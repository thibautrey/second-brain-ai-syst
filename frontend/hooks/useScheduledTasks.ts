/**
 * useScheduledTasks Hook - State management for scheduled tasks
 */

import { useState, useEffect, useCallback } from "react";
import { scheduledTaskService } from "../services/scheduledTaskService";
import type {
  ScheduledTask,
  CreateScheduledTaskInput,
  UpdateScheduledTaskInput,
  TaskFilters,
  TaskExecution,
} from "../types/tools";

interface UseScheduledTasksOptions {
  filters?: TaskFilters;
  autoFetch?: boolean;
}

interface UseScheduledTasksReturn {
  tasks: ScheduledTask[];
  loading: boolean;
  error: string | null;
  // Actions
  fetchTasks: () => Promise<void>;
  createTask: (input: CreateScheduledTaskInput) => Promise<ScheduledTask>;
  updateTask: (
    id: string,
    input: UpdateScheduledTaskInput,
  ) => Promise<ScheduledTask>;
  enableTask: (id: string) => Promise<ScheduledTask>;
  disableTask: (id: string) => Promise<ScheduledTask>;
  executeTask: (id: string) => Promise<TaskExecution>;
  deleteTask: (id: string) => Promise<void>;
  getHistory: (id: string) => Promise<TaskExecution[]>;
  setFilters: (filters: TaskFilters) => void;
}

export function useScheduledTasks(
  options: UseScheduledTasksOptions = {},
): UseScheduledTasksReturn {
  const { filters: initialFilters = {}, autoFetch = true } = options;

  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<TaskFilters>(initialFilters);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tasksList = await scheduledTaskService.list(filters);
      setTasks(tasksList);
    } catch (err: any) {
      setError(err.message || "Failed to fetch tasks");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const createTask = useCallback(
    async (input: CreateScheduledTaskInput): Promise<ScheduledTask> => {
      const newTask = await scheduledTaskService.create(input);
      setTasks((prev) => [newTask, ...prev]);
      return newTask;
    },
    [],
  );

  const updateTask = useCallback(
    async (
      id: string,
      input: UpdateScheduledTaskInput,
    ): Promise<ScheduledTask> => {
      const updatedTask = await scheduledTaskService.update(id, input);
      setTasks((prev) => prev.map((t) => (t.id === id ? updatedTask : t)));
      return updatedTask;
    },
    [],
  );

  const enableTask = useCallback(async (id: string): Promise<ScheduledTask> => {
    const enabledTask = await scheduledTaskService.enable(id);
    setTasks((prev) => prev.map((t) => (t.id === id ? enabledTask : t)));
    return enabledTask;
  }, []);

  const disableTask = useCallback(
    async (id: string): Promise<ScheduledTask> => {
      const disabledTask = await scheduledTaskService.disable(id);
      setTasks((prev) => prev.map((t) => (t.id === id ? disabledTask : t)));
      return disabledTask;
    },
    [],
  );

  const executeTask = useCallback(
    async (id: string): Promise<TaskExecution> => {
      const result = await scheduledTaskService.execute(id);
      // Refresh task to get updated runCount and lastRunAt
      fetchTasks();
      return result.execution;
    },
    [fetchTasks],
  );

  const deleteTask = useCallback(async (id: string): Promise<void> => {
    await scheduledTaskService.delete(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const getHistory = useCallback(
    async (id: string): Promise<TaskExecution[]> => {
      return scheduledTaskService.getHistory(id);
    },
    [],
  );

  useEffect(() => {
    if (autoFetch) {
      fetchTasks();
    }
  }, [autoFetch, fetchTasks]);

  return {
    tasks,
    loading,
    error,
    fetchTasks,
    createTask,
    updateTask,
    enableTask,
    disableTask,
    executeTask,
    deleteTask,
    getHistory,
    setFilters,
  };
}
