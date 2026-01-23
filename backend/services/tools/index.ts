/**
 * Built-in Tools Index
 *
 * Exports all built-in tool services for the Second Brain system.
 */

export { todoService, TodoService } from "./todo.service.js";
export {
  notificationService,
  NotificationService,
} from "./notification.service.js";
export {
  scheduledTaskService,
  ScheduledTaskService,
} from "./scheduled-task.service.js";
export { curlService, CurlService } from "./curl.service.js";

// Re-export types
export type {
  CreateTodoInput,
  UpdateTodoInput,
  TodoFilters,
  TodoListOptions,
} from "./todo.service.js";

export type {
  CreateNotificationInput,
  NotificationFilters,
  NotificationListOptions,
} from "./notification.service.js";

export type {
  CreateScheduledTaskInput,
  UpdateScheduledTaskInput,
  TaskFilters,
} from "./scheduled-task.service.js";

export type { CurlRequest, CurlResponse } from "./curl.service.js";
