/**
 * Types for built-in tools (Todo, ScheduledTask, Notification)
 */

// ==================== Todo Types ====================

export type TodoStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type TodoPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface Todo {
  id: string;
  userId: string;
  title: string;
  description?: string;
  status: TodoStatus;
  priority: TodoPriority;
  category?: string;
  tags: string[];
  dueDate?: string;
  reminderAt?: string;
  completedAt?: string;
  isRecurring: boolean;
  recurrenceRule?: string;
  sourceMemoryId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTodoInput {
  title: string;
  description?: string;
  priority?: TodoPriority;
  category?: string;
  tags?: string[];
  dueDate?: string;
  reminderAt?: string;
  isRecurring?: boolean;
  recurrenceRule?: string;
  sourceMemoryId?: string;
}

export interface UpdateTodoInput {
  title?: string;
  description?: string;
  status?: TodoStatus;
  priority?: TodoPriority;
  category?: string;
  tags?: string[];
  dueDate?: string | null;
  reminderAt?: string | null;
  isRecurring?: boolean;
  recurrenceRule?: string | null;
}

export interface TodoFilters {
  status?: TodoStatus | TodoStatus[];
  priority?: TodoPriority | TodoPriority[];
  category?: string;
  search?: string;
  includeCompleted?: boolean;
}

export interface TodoStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  overdue: number;
  dueSoon: number;
  byPriority: Record<TodoPriority, number>;
  byCategory: Record<string, number>;
}

// ==================== Scheduled Task Types ====================

export type ScheduleType = "ONE_TIME" | "CRON" | "INTERVAL";
export type TaskActionType =
  | "SEND_NOTIFICATION"
  | "CREATE_TODO"
  | "GENERATE_SUMMARY"
  | "RUN_AGENT"
  | "WEBHOOK"
  | "CUSTOM";

export interface ScheduledTask {
  id: string;
  userId: string;
  name: string;
  description?: string;
  scheduleType: ScheduleType;
  cronExpression?: string;
  executeAt?: string;
  interval?: number;
  actionType: TaskActionType;
  actionPayload: Record<string, unknown>;
  isEnabled: boolean;
  nextRunAt?: string;
  lastRunAt?: string;
  runCount: number;
  maxRuns?: number;
  expiresAt?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  executions?: TaskExecution[];
}

export interface TaskExecution {
  id: string;
  taskId: string;
  startedAt: string;
  completedAt?: string;
  status: "RUNNING" | "SUCCESS" | "FAILED";
  result?: Record<string, unknown>;
  error?: string;
}

export interface CreateScheduledTaskInput {
  name: string;
  description?: string;
  scheduleType: ScheduleType;
  cronExpression?: string;
  executeAt?: string;
  interval?: number;
  actionType: TaskActionType;
  actionPayload: Record<string, unknown>;
  maxRuns?: number;
  expiresAt?: string;
}

export interface UpdateScheduledTaskInput {
  name?: string;
  description?: string;
  cronExpression?: string;
  executeAt?: string;
  interval?: number;
  actionPayload?: Record<string, unknown>;
  isEnabled?: boolean;
  maxRuns?: number;
  expiresAt?: string;
}

export interface TaskFilters {
  isEnabled?: boolean;
  actionType?: TaskActionType | TaskActionType[];
  scheduleType?: ScheduleType | ScheduleType[];
}

// ==================== Notification Types ====================

export type NotificationType =
  | "INFO"
  | "WARNING"
  | "ERROR"
  | "SUCCESS"
  | "REMINDER";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  readAt?: string;
  sourceType?: string;
  sourceId?: string;
  actionUrl?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// ==================== API Response Types ====================

export interface TodoListResponse {
  success: boolean;
  error?: string;
  todos: Todo[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface TodoStatsResponse {
  success: boolean;
  error?: string;
  stats: TodoStats;
}

export interface TaskListResponse {
  success: boolean;
  error?: string;
  tasks: ScheduledTask[];
}
