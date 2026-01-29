import { TodoPriority, TodoStatus } from "@prisma/client";
import { todoService } from "../../tools/index.js";

export async function executeTodoAction(
  userId: string,
  action: string,
  params: Record<string, any>,
): Promise<any> {
  // Validate todoId for actions that require it
  const actionsRequiringTodoId = ["get", "update", "complete", "delete"];
  if (actionsRequiringTodoId.includes(action) && !params.todoId) {
    throw new Error(
      `Missing required parameter 'todoId' for '${action}' action. ` +
        `Use 'list' action first to find the todo ID, then use that ID with '${action}'.`,
    );
  }

  switch (action) {
    case "create":
      if (!params.title) {
        throw new Error(
          "Missing required parameter 'title' for create action",
        );
      }
      return todoService.createTodo(userId, {
        title: params.title,
        description: params.description,
        priority: params.priority as TodoPriority,
        category: params.category,
        tags: params.tags,
        dueDate: params.dueDate ? new Date(params.dueDate) : undefined,
        reminderAt: params.reminderAt
          ? new Date(params.reminderAt)
          : undefined,
        isRecurring: params.isRecurring,
        recurrenceRule: params.recurrenceRule,
      });

    case "get":
      return todoService.getTodo(userId, params.todoId);

    case "list":
      return todoService.listTodos(
        userId,
        {
          status: params.status,
          priority: params.priority,
          category: params.category,
          tags: params.tags,
          dueBefore: params.dueBefore
            ? new Date(params.dueBefore)
            : undefined,
          dueAfter: params.dueAfter ? new Date(params.dueAfter) : undefined,
          search: params.search,
          includeCompleted: params.includeCompleted,
        },
        {
          page: params.page,
          limit: params.limit,
          sortBy: params.sortBy,
          sortOrder: params.sortOrder,
        },
      );

    case "update":
      return todoService.updateTodo(userId, params.todoId, {
        title: params.title,
        description: params.description,
        status: params.status as TodoStatus,
        priority: params.priority as TodoPriority,
        category: params.category,
        tags: params.tags,
        dueDate: params.dueDate ? new Date(params.dueDate) : undefined,
        reminderAt: params.reminderAt
          ? new Date(params.reminderAt)
          : undefined,
      });

    case "complete":
      return todoService.completeTodo(userId, params.todoId);

    case "delete":
      return todoService.deleteTodo(userId, params.todoId);

    case "stats":
      return todoService.getTodoStats(userId);

    case "overdue":
      return todoService.getOverdueTodos(userId);

    case "due_soon":
      return todoService.getTodosDueSoon(userId, params.withinHours ?? 24);

    case "categories":
      return todoService.getCategories(userId);

    case "tags":
      return todoService.getTags(userId);

    default:
      throw new Error(
        `Unknown todo action: ${action}. Valid actions are: create, get, list, update, complete, delete, stats, overdue, due_soon, categories, tags`,
      );
  }
}

export const TODO_TOOL_SCHEMA = {
  name: "todo",
  description:
    "Manage user's todo list - create, read, update, delete, and complete tasks. You have full CRUD capability: list existing todos, create new ones, modify their properties (title, priority, due date, etc.), mark them complete, and delete them entirely. IMPORTANT: For update/complete/delete, you MUST first use 'list' to get the todoId.",
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: [
          "create",
          "get",
          "list",
          "update",
          "complete",
          "delete",
          "stats",
          "overdue",
          "due_soon",
          "categories",
          "tags",
        ],
        description:
          "The action to perform. 'create': new todo (requires title). 'list': show todos (with optional filters). 'get/update/complete/delete': operate on specific todo (requires todoId from list). 'stats': get statistics. 'overdue': get overdue todos. 'due_soon': get todos due within hours.",
      },
      todoId: {
        type: "string",
        description:
          "ID of the todo - REQUIRED for get, update, complete, delete actions. ALWAYS use 'list' action first to find the todoId before using these actions.",
      },
      title: {
        type: "string",
        description:
          "Title of the todo (REQUIRED for create, optional for update)",
      },
      description: {
        type: "string",
        description: "Description of the todo (optional, can be updated)",
      },
      priority: {
        type: "string",
        enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
        description:
          "Priority level (default: MEDIUM, can be updated anytime)",
      },
      status: {
        type: "string",
        enum: ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
        description:
          "For 'list': FILTER by this status. For 'update': CHANGE the todo's status. To mark done, prefer 'complete' action over setting status to COMPLETED.",
      },
      category: {
        type: "string",
        description:
          "Category to organize todos (e.g., 'work', 'personal', 'health')",
      },
      tags: {
        type: "array",
        items: { type: "string" },
        description:
          "Tags for the todo (replaces existing tags when updating)",
      },
      dueDate: {
        type: "string",
        description:
          "Due date in ISO format (e.g., '2024-12-31T23:59:59Z'). Can be updated or set to null to clear.",
      },
      search: {
        type: "string",
        description:
          "For 'list' action: search query that matches title and description",
      },
      includeCompleted: {
        type: "boolean",
        description:
          "For 'list' action: include completed todos (default: false)",
      },
      withinHours: {
        type: "number",
        description:
          "For 'due_soon' action: number of hours to look ahead (default: 24)",
      },
    },
    required: ["action"],
  },
};
