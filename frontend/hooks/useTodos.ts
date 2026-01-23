/**
 * useTodos Hook - State management for todos
 */

import { useState, useEffect, useCallback } from "react";
import { todoService } from "../services/todoService";
import type {
  Todo,
  CreateTodoInput,
  UpdateTodoInput,
  TodoFilters,
  TodoStats,
} from "../types/tools";

interface UseTodosOptions {
  filters?: TodoFilters;
  page?: number;
  limit?: number;
  sortBy?: "createdAt" | "dueDate" | "priority" | "updatedAt";
  sortOrder?: "asc" | "desc";
  autoFetch?: boolean;
}

interface UseTodosReturn {
  todos: Todo[];
  stats: TodoStats | null;
  loading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  } | null;
  // Actions
  fetchTodos: () => Promise<void>;
  fetchStats: () => Promise<void>;
  createTodo: (input: CreateTodoInput) => Promise<Todo>;
  updateTodo: (id: string, input: UpdateTodoInput) => Promise<Todo>;
  completeTodo: (id: string) => Promise<Todo>;
  deleteTodo: (id: string) => Promise<void>;
  setFilters: (filters: TodoFilters) => void;
  setPage: (page: number) => void;
}

export function useTodos(options: UseTodosOptions = {}): UseTodosReturn {
  const {
    filters: initialFilters = {},
    page: initialPage = 1,
    limit = 20,
    sortBy = "createdAt",
    sortOrder = "desc",
    autoFetch = true,
  } = options;

  const [todos, setTodos] = useState<Todo[]>([]);
  const [stats, setStats] = useState<TodoStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<TodoFilters>(initialFilters);
  const [page, setPage] = useState(initialPage);
  const [pagination, setPagination] =
    useState<UseTodosReturn["pagination"]>(null);

  const fetchTodos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await todoService.list(filters, {
        page,
        limit,
        sortBy,
        sortOrder,
      });
      setTodos(response.todos);
      setPagination(response.pagination);
    } catch (err: any) {
      setError(err.message || "Failed to fetch todos");
    } finally {
      setLoading(false);
    }
  }, [filters, page, limit, sortBy, sortOrder]);

  const fetchStats = useCallback(async () => {
    try {
      const statsData = await todoService.getStats();
      setStats(statsData);
    } catch (err: any) {
      console.error("Failed to fetch stats:", err);
    }
  }, []);

  const createTodo = useCallback(
    async (input: CreateTodoInput): Promise<Todo> => {
      const newTodo = await todoService.create(input);
      setTodos((prev) => [newTodo, ...prev]);
      fetchStats(); // Refresh stats
      return newTodo;
    },
    [fetchStats],
  );

  const updateTodo = useCallback(
    async (id: string, input: UpdateTodoInput): Promise<Todo> => {
      const updatedTodo = await todoService.update(id, input);
      setTodos((prev) => prev.map((t) => (t.id === id ? updatedTodo : t)));
      fetchStats(); // Refresh stats
      return updatedTodo;
    },
    [fetchStats],
  );

  const completeTodo = useCallback(
    async (id: string): Promise<Todo> => {
      const completedTodo = await todoService.complete(id);
      setTodos((prev) => prev.map((t) => (t.id === id ? completedTodo : t)));
      fetchStats(); // Refresh stats
      return completedTodo;
    },
    [fetchStats],
  );

  const deleteTodo = useCallback(
    async (id: string): Promise<void> => {
      await todoService.delete(id);
      setTodos((prev) => prev.filter((t) => t.id !== id));
      fetchStats(); // Refresh stats
    },
    [fetchStats],
  );

  useEffect(() => {
    if (autoFetch) {
      fetchTodos();
      fetchStats();
    }
  }, [autoFetch, fetchTodos, fetchStats]);

  return {
    todos,
    stats,
    loading,
    error,
    pagination,
    fetchTodos,
    fetchStats,
    createTodo,
    updateTodo,
    completeTodo,
    deleteTodo,
    setFilters,
    setPage,
  };
}
