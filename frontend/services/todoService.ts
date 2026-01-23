/**
 * Todo Service - API client for todo operations
 */

import { apiGet, apiPost, apiPatch, apiDelete } from "./api";
import type {
  Todo,
  CreateTodoInput,
  UpdateTodoInput,
  TodoFilters,
  TodoListResponse,
  TodoStatsResponse,
  ApiResponse,
} from "../types/tools";

export const todoService = {
  /**
   * Create a new todo
   */
  async create(input: CreateTodoInput): Promise<Todo> {
    const response = await apiPost<{ success: boolean; todo: Todo }>(
      "/tools/todos",
      input,
    );
    return response.todo;
  },

  /**
   * Get a todo by ID
   */
  async get(id: string): Promise<Todo> {
    const response = await apiGet<{ success: boolean; todo: Todo }>(
      `/tools/todos/${id}`,
    );
    return response.todo;
  },

  /**
   * List todos with filters
   */
  async list(
    filters?: TodoFilters,
    options?: {
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
    },
  ): Promise<TodoListResponse> {
    const params: Record<string, any> = {
      ...filters,
      ...options,
    };
    return apiGet<TodoListResponse>("/tools/todos", params);
  },

  /**
   * Update a todo
   */
  async update(id: string, input: UpdateTodoInput): Promise<Todo> {
    const response = await apiPatch<{ success: boolean; todo: Todo }>(
      `/tools/todos/${id}`,
      input,
    );
    return response.todo;
  },

  /**
   * Complete a todo
   */
  async complete(id: string): Promise<Todo> {
    const response = await apiPost<{ success: boolean; todo: Todo }>(
      `/tools/todos/${id}/complete`,
    );
    return response.todo;
  },

  /**
   * Delete a todo
   */
  async delete(id: string): Promise<void> {
    await apiDelete<ApiResponse<void>>(`/tools/todos/${id}`);
  },

  /**
   * Get todo statistics
   */
  async getStats(): Promise<TodoStatsResponse["stats"]> {
    const response = await apiGet<TodoStatsResponse>("/tools/todos/stats");
    return response.stats;
  },

  /**
   * Get overdue todos
   */
  async getOverdue(): Promise<Todo[]> {
    const response = await apiGet<{ success: boolean; todos: Todo[] }>(
      "/tools/todos/overdue",
    );
    return response.todos;
  },

  /**
   * Get todos due soon
   */
  async getDueSoon(hours: number = 24): Promise<Todo[]> {
    const response = await apiGet<{ success: boolean; todos: Todo[] }>(
      "/tools/todos/due-soon",
      { hours },
    );
    return response.todos;
  },

  /**
   * Get all categories
   */
  async getCategories(): Promise<string[]> {
    const response = await apiGet<{ success: boolean; categories: string[] }>(
      "/tools/todos/categories",
    );
    return response.categories;
  },

  /**
   * Get all tags
   */
  async getTags(): Promise<string[]> {
    const response = await apiGet<{ success: boolean; tags: string[] }>(
      "/tools/todos/tags",
    );
    return response.tags;
  },
};
