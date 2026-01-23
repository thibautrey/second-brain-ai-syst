/**
 * Todo Service
 *
 * Built-in tool for managing user's todo list.
 * Provides CRUD operations and intelligent todo management.
 */

import prisma from "../prisma.js";
import { TodoStatus, TodoPriority, Prisma } from "@prisma/client";
import { notificationService } from "./notification.service.js";

// ==================== Types ====================

export interface CreateTodoInput {
  title: string;
  description?: string;
  priority?: TodoPriority;
  category?: string;
  tags?: string[];
  dueDate?: Date;
  reminderAt?: Date;
  isRecurring?: boolean;
  recurrenceRule?: string;
  sourceMemoryId?: string;
  metadata?: Record<string, any>;
}

export interface UpdateTodoInput {
  title?: string;
  description?: string;
  status?: TodoStatus;
  priority?: TodoPriority;
  category?: string;
  tags?: string[];
  dueDate?: Date | null;
  reminderAt?: Date | null;
  isRecurring?: boolean;
  recurrenceRule?: string | null;
  metadata?: Record<string, any>;
}

export interface TodoFilters {
  status?: TodoStatus | TodoStatus[];
  priority?: TodoPriority | TodoPriority[];
  category?: string;
  tags?: string[];
  dueBefore?: Date;
  dueAfter?: Date;
  search?: string;
  includeCompleted?: boolean;
}

export interface TodoListOptions {
  page?: number;
  limit?: number;
  sortBy?: "createdAt" | "dueDate" | "priority" | "updatedAt";
  sortOrder?: "asc" | "desc";
}

// ==================== Service ====================

export class TodoService {
  /**
   * Create a new todo
   */
  async createTodo(userId: string, input: CreateTodoInput) {
    const todo = await prisma.todo.create({
      data: {
        userId,
        title: input.title,
        description: input.description,
        priority: input.priority ?? TodoPriority.MEDIUM,
        category: input.category,
        tags: input.tags ?? [],
        dueDate: input.dueDate,
        reminderAt: input.reminderAt,
        isRecurring: input.isRecurring ?? false,
        recurrenceRule: input.recurrenceRule,
        sourceMemoryId: input.sourceMemoryId,
        metadata: input.metadata ?? {},
      },
    });

    // Schedule reminder notification if set
    if (input.reminderAt) {
      await this.scheduleReminder(userId, todo.id, input.reminderAt);
    }

    return todo;
  }

  /**
   * Get a todo by ID
   */
  async getTodo(userId: string, todoId: string) {
    return prisma.todo.findFirst({
      where: {
        id: todoId,
        userId,
      },
    });
  }

  /**
   * List todos with filters and pagination
   */
  async listTodos(
    userId: string,
    filters: TodoFilters = {},
    options: TodoListOptions = {},
  ) {
    const {
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = options;

    const where: Prisma.TodoWhereInput = {
      userId,
    };

    // Apply filters
    if (filters.status) {
      where.status = Array.isArray(filters.status)
        ? { in: filters.status }
        : filters.status;
    } else if (!filters.includeCompleted) {
      where.status = { not: TodoStatus.COMPLETED };
    }

    if (filters.priority) {
      where.priority = Array.isArray(filters.priority)
        ? { in: filters.priority }
        : filters.priority;
    }

    if (filters.category) {
      where.category = filters.category;
    }

    if (filters.tags && filters.tags.length > 0) {
      where.tags = { hasSome: filters.tags };
    }

    if (filters.dueBefore) {
      where.dueDate = { ...(where.dueDate as object), lte: filters.dueBefore };
    }

    if (filters.dueAfter) {
      where.dueDate = { ...(where.dueDate as object), gte: filters.dueAfter };
    }

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const [todos, total] = await Promise.all([
      prisma.todo.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.todo.count({ where }),
    ]);

    return {
      todos,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update a todo
   */
  async updateTodo(userId: string, todoId: string, input: UpdateTodoInput) {
    const existing = await this.getTodo(userId, todoId);
    if (!existing) {
      throw new Error("Todo not found");
    }

    const data: Prisma.TodoUpdateInput = {};

    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined) data.description = input.description;
    if (input.status !== undefined) {
      data.status = input.status;
      if (input.status === TodoStatus.COMPLETED) {
        data.completedAt = new Date();
      }
    }
    if (input.priority !== undefined) data.priority = input.priority;
    if (input.category !== undefined) data.category = input.category;
    if (input.tags !== undefined) data.tags = input.tags;
    if (input.dueDate !== undefined) data.dueDate = input.dueDate;
    if (input.reminderAt !== undefined) data.reminderAt = input.reminderAt;
    if (input.isRecurring !== undefined) data.isRecurring = input.isRecurring;
    if (input.recurrenceRule !== undefined)
      data.recurrenceRule = input.recurrenceRule;
    if (input.metadata !== undefined) data.metadata = input.metadata;

    const todo = await prisma.todo.update({
      where: { id: todoId },
      data,
    });

    // Handle completion of recurring todos
    if (
      input.status === TodoStatus.COMPLETED &&
      existing.isRecurring &&
      existing.recurrenceRule
    ) {
      await this.createNextRecurrence(userId, existing);
    }

    return todo;
  }

  /**
   * Complete a todo
   */
  async completeTodo(userId: string, todoId: string) {
    return this.updateTodo(userId, todoId, { status: TodoStatus.COMPLETED });
  }

  /**
   * Delete a todo
   */
  async deleteTodo(userId: string, todoId: string) {
    const existing = await this.getTodo(userId, todoId);
    if (!existing) {
      throw new Error("Todo not found");
    }

    await prisma.todo.delete({
      where: { id: todoId },
    });

    return { success: true };
  }

  /**
   * Get todos due soon (for reminders)
   */
  async getTodosDueSoon(userId: string, withinHours: number = 24) {
    const now = new Date();
    const deadline = new Date(now.getTime() + withinHours * 60 * 60 * 1000);

    return prisma.todo.findMany({
      where: {
        userId,
        status: { not: TodoStatus.COMPLETED },
        dueDate: {
          gte: now,
          lte: deadline,
        },
      },
      orderBy: { dueDate: "asc" },
    });
  }

  /**
   * Get overdue todos
   */
  async getOverdueTodos(userId: string) {
    return prisma.todo.findMany({
      where: {
        userId,
        status: { not: TodoStatus.COMPLETED },
        dueDate: {
          lt: new Date(),
        },
      },
      orderBy: { dueDate: "asc" },
    });
  }

  /**
   * Get todo statistics
   */
  async getTodoStats(userId: string) {
    const [total, pending, inProgress, completed, overdue, dueSoon] =
      await Promise.all([
        prisma.todo.count({ where: { userId } }),
        prisma.todo.count({ where: { userId, status: TodoStatus.PENDING } }),
        prisma.todo.count({
          where: { userId, status: TodoStatus.IN_PROGRESS },
        }),
        prisma.todo.count({ where: { userId, status: TodoStatus.COMPLETED } }),
        prisma.todo.count({
          where: {
            userId,
            status: { not: TodoStatus.COMPLETED },
            dueDate: { lt: new Date() },
          },
        }),
        prisma.todo.count({
          where: {
            userId,
            status: { not: TodoStatus.COMPLETED },
            dueDate: {
              gte: new Date(),
              lte: new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
          },
        }),
      ]);

    return {
      total,
      pending,
      inProgress,
      completed,
      overdue,
      dueSoon,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }

  /**
   * Get all categories for a user
   */
  async getCategories(userId: string) {
    const result = await prisma.todo.findMany({
      where: { userId, category: { not: null } },
      select: { category: true },
      distinct: ["category"],
    });

    return result.map((r) => r.category).filter(Boolean) as string[];
  }

  /**
   * Get all tags for a user
   */
  async getTags(userId: string) {
    const result = await prisma.todo.findMany({
      where: { userId },
      select: { tags: true },
    });

    const allTags = new Set<string>();
    result.forEach((r) => r.tags.forEach((tag) => allTags.add(tag)));

    return Array.from(allTags);
  }

  // ==================== Private Methods ====================

  /**
   * Schedule a reminder notification
   */
  private async scheduleReminder(
    userId: string,
    todoId: string,
    reminderAt: Date,
  ) {
    const todo = await this.getTodo(userId, todoId);
    if (!todo) return;

    await notificationService.scheduleNotification(userId, {
      title: "📝 Rappel de tâche",
      message: `N'oubliez pas: ${todo.title}`,
      type: "REMINDER",
      scheduledFor: reminderAt,
      sourceType: "todo",
      sourceId: todoId,
    });
  }

  /**
   * Create next recurrence of a recurring todo
   */
  private async createNextRecurrence(userId: string, completedTodo: any) {
    // Parse RRULE and calculate next occurrence
    const nextDate = this.calculateNextOccurrence(
      completedTodo.dueDate || new Date(),
      completedTodo.recurrenceRule,
    );

    if (nextDate) {
      await this.createTodo(userId, {
        title: completedTodo.title,
        description: completedTodo.description,
        priority: completedTodo.priority,
        category: completedTodo.category,
        tags: completedTodo.tags,
        dueDate: nextDate,
        isRecurring: true,
        recurrenceRule: completedTodo.recurrenceRule,
        metadata: {
          ...completedTodo.metadata,
          previousTodoId: completedTodo.id,
        },
      });
    }
  }

  /**
   * Calculate next occurrence based on RRULE
   */
  private calculateNextOccurrence(baseDate: Date, rrule: string): Date | null {
    // Simple RRULE parser for common cases
    const rules = rrule.split(";").reduce(
      (acc, part) => {
        const [key, value] = part.split("=");
        acc[key] = value;
        return acc;
      },
      {} as Record<string, string>,
    );

    const freq = rules["FREQ"];
    const interval = parseInt(rules["INTERVAL"] || "1", 10);

    const next = new Date(baseDate);

    switch (freq) {
      case "DAILY":
        next.setDate(next.getDate() + interval);
        break;
      case "WEEKLY":
        next.setDate(next.getDate() + 7 * interval);
        break;
      case "MONTHLY":
        next.setMonth(next.getMonth() + interval);
        break;
      case "YEARLY":
        next.setFullYear(next.getFullYear() + interval);
        break;
      default:
        return null;
    }

    return next;
  }
}

export const todoService = new TodoService();
