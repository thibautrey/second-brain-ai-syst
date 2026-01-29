/**
 * Tool Schemas using TypeBox
 *
 * This module defines all tool schemas using @sinclair/typebox instead of
 * manual JSON Schema. Benefits:
 * - Type-safe schemas with TypeScript inference
 * - Automatic validation via AJV
 * - Better developer experience with autocomplete
 * - Validation errors are automatically formatted for LLM retry
 *
 * Compatible with pi-ai's Tool format for cross-provider compatibility.
 *
 * Note: We use 'any' for Tool type to avoid version conflicts between
 * @sinclair/typebox in this project and the one bundled with pi-ai.
 */

import {
  Type,
  type TObject,
  type Static,
  type TString,
  type TUnsafe,
  type TSchema,
} from "@sinclair/typebox";

// Re-export Tool type from pi-ai for consumers
export type { Tool } from "@mariozechner/pi-ai";

/**
 * Creates a string enum schema compatible with JSON Schema and pi-ai
 * Adapted from pi-ai's StringEnum but returns plain JSON Schema for broader compatibility
 */
function StringEnum<T extends readonly string[]>(
  values: T,
  options?: { description?: string; default?: T[number] },
): TUnsafe<T[number]> {
  return Type.Unsafe<T[number]>({
    type: "string",
    enum: values as unknown as string[],
    ...(options?.description && { description: options.description }),
    ...(options?.default && { default: options.default }),
  });
}

// ==================== Todo Tool ====================

export const TodoActionSchema = StringEnum(
  [
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
  ] as const,
  {
    description:
      "The action to perform. 'create': new todo (requires title). 'list': show todos (with optional filters). 'get/update/complete/delete': operate on specific todo (requires todoId from list). 'stats': get statistics. 'overdue': get overdue todos. 'due_soon': get todos due within hours.",
  },
);

export const TodoPrioritySchema = StringEnum(
  ["LOW", "MEDIUM", "HIGH", "URGENT"] as const,
  { description: "Priority level (default: MEDIUM, can be updated anytime)" },
);

export const TodoStatusSchema = StringEnum(
  ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const,
  {
    description:
      "For 'list': FILTER by this status. For 'update': CHANGE the todo's status. To mark done, prefer 'complete' action over setting status to COMPLETED.",
  },
);

export const TodoParamsSchema = Type.Object(
  {
    action: TodoActionSchema,
    todoId: Type.Optional(
      Type.String({
        description:
          "ID of the todo - REQUIRED for get, update, complete, delete actions. ALWAYS use 'list' action first to find the todoId before using these actions.",
      }),
    ),
    title: Type.Optional(
      Type.String({
        description:
          "Title of the todo (REQUIRED for create, optional for update)",
      }),
    ),
    description: Type.Optional(
      Type.String({
        description: "Description of the todo (optional, can be updated)",
      }),
    ),
    priority: Type.Optional(TodoPrioritySchema),
    status: Type.Optional(TodoStatusSchema),
    category: Type.Optional(
      Type.String({
        description:
          "Category to organize todos (e.g., 'work', 'personal', 'health')",
      }),
    ),
    tags: Type.Optional(
      Type.Array(Type.String(), {
        description: "Tags for the todo (replaces existing tags when updating)",
      }),
    ),
    dueDate: Type.Optional(
      Type.String({
        description:
          "Due date in ISO format (e.g., '2024-12-31T23:59:59Z'). Can be updated or set to null to clear.",
      }),
    ),
    search: Type.Optional(
      Type.String({
        description:
          "For 'list' action: search query that matches title and description",
      }),
    ),
    includeCompleted: Type.Optional(
      Type.Boolean({
        description:
          "For 'list' action: include completed todos (default: false)",
      }),
    ),
    withinHours: Type.Optional(
      Type.Number({
        description:
          "For 'due_soon' action: number of hours to look ahead (default: 24)",
      }),
    ),
  },
  { additionalProperties: false },
);

export type TodoParams = Static<typeof TodoParamsSchema>;

// ==================== Notification Tool ====================

export const NotificationActionSchema = StringEnum(
  [
    "send",
    "schedule",
    "get",
    "list",
    "unread_count",
    "mark_read",
    "dismiss",
    "delete",
    "cancel_scheduled",
  ] as const,
  {
    description:
      "'send': send immediately (requires title, message). 'schedule': send later (requires title, message, scheduledFor). 'list': show notifications. 'get': get specific notification. 'unread_count': count unread. 'mark_read': mark as read (use notificationId or all:true). 'dismiss': hide notification. 'delete': permanently remove. 'cancel_scheduled': cancel a pending scheduled notification.",
  },
);

export const NotificationTypeSchema = StringEnum(
  ["INFO", "SUCCESS", "WARNING", "ERROR", "REMINDER", "ACHIEVEMENT"] as const,
  {
    description:
      "Type of notification (default: INFO). Affects visual styling and priority.",
  },
);

export const NotificationParamsSchema = Type.Object(
  {
    action: NotificationActionSchema,
    notificationId: Type.Optional(
      Type.String({
        description:
          "ID of the notification - REQUIRED for get, mark_read (unless all:true), dismiss, delete, cancel_scheduled. Use 'list' to find IDs.",
      }),
    ),
    title: Type.Optional(
      Type.String({
        description:
          "Title of the notification - REQUIRED for send and schedule actions",
      }),
    ),
    message: Type.Optional(
      Type.String({
        description: "Message content - REQUIRED for send and schedule actions",
      }),
    ),
    type: Type.Optional(NotificationTypeSchema),
    scheduledFor: Type.Optional(
      Type.String({
        description:
          "When to send the notification - REQUIRED for 'schedule' action. Use ISO 8601 format (e.g., '2024-12-31T09:00:00Z')",
      }),
    ),
    all: Type.Optional(
      Type.Boolean({
        description:
          "For 'mark_read' action: set to true to mark ALL notifications as read instead of a specific one",
      }),
    ),
    isRead: Type.Optional(
      Type.Boolean({
        description:
          "For 'list' action: filter by read status (true=read only, false=unread only, omit for all)",
      }),
    ),
    since: Type.Optional(
      Type.String({
        description:
          "For 'list' action: only show notifications created after this ISO date",
      }),
    ),
  },
  { additionalProperties: false },
);

export type NotificationParams = Static<typeof NotificationParamsSchema>;

// ==================== Scheduled Task Tool ====================

export const ScheduledTaskActionSchema = StringEnum(
  [
    "create",
    "get",
    "list",
    "update",
    "delete",
    "pause",
    "resume",
    "history",
  ] as const,
  {
    description:
      "'create': schedule new task. 'get': view task details. 'list': show tasks. 'update': modify task. 'delete': remove task. 'pause/resume': control execution. 'history': view past runs.",
  },
);

export const ScheduleTypeSchema = StringEnum(
  ["ONCE", "CRON", "INTERVAL"] as const,
  {
    description:
      "ONCE: run once at executeAt time. CRON: recurring cron schedule. INTERVAL: repeat every intervalSeconds.",
  },
);

export const TaskActionTypeSchema = StringEnum(
  [
    "SEND_NOTIFICATION",
    "CREATE_TODO",
    "WEBHOOK",
    "GENERATE_SUMMARY",
    "RUN_AGENT",
    "CUSTOM",
  ] as const,
  {
    description: "What the task does when triggered",
  },
);

export const ScheduledTaskParamsSchema = Type.Object(
  {
    action: ScheduledTaskActionSchema,
    taskId: Type.Optional(
      Type.String({
        description:
          "ID of the task - REQUIRED for get, update, delete, pause, resume, history. Get from 'list' or 'create' response.",
      }),
    ),
    name: Type.Optional(
      Type.String({
        description: "Name of the task - REQUIRED for 'create' action",
      }),
    ),
    description: Type.Optional(
      Type.String({
        description: "Description of what the task does",
      }),
    ),
    scheduleType: Type.Optional(ScheduleTypeSchema),
    actionType: Type.Optional(TaskActionTypeSchema),
    executeAt: Type.Optional(
      Type.String({
        description:
          "For ONCE schedule: when to execute (ISO format). E.g., '2024-12-31T09:00:00Z'",
      }),
    ),
    cronExpression: Type.Optional(
      Type.String({
        description:
          "For CRON schedule: cron expression (e.g., '0 9 * * *' for 9 AM daily)",
      }),
    ),
    intervalSeconds: Type.Optional(
      Type.Number({
        description: "For INTERVAL schedule: seconds between runs",
      }),
    ),
    actionPayload: Type.Optional(
      Type.Object(
        {},
        {
          additionalProperties: true,
          description:
            "Parameters for the action - REQUIRED fields depend on actionType",
        },
      ),
    ),
    maxRuns: Type.Optional(
      Type.Number({
        description:
          "Maximum number of times to run (for CRON/INTERVAL). After reaching this, task auto-disables.",
      }),
    ),
    expiresAt: Type.Optional(
      Type.String({
        description:
          "When to stop running (ISO format). Task auto-disables after this date.",
      }),
    ),
    isEnabled: Type.Optional(
      Type.Boolean({
        description:
          "For 'list': filter by enabled status. For 'update': change enabled state.",
      }),
    ),
  },
  { additionalProperties: false },
);

export type ScheduledTaskParams = Static<typeof ScheduledTaskParamsSchema>;

// ==================== Curl Tool ====================

export const CurlActionSchema = StringEnum(
  ["request", "get", "post", "put", "delete", "patch"] as const,
  {
    description:
      "'request': full control with method param. 'get/post/put/delete/patch': shorthand methods.",
  },
);

export const HttpMethodSchema = StringEnum(
  ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"] as const,
  { description: "HTTP method (default: GET)" },
);

export const CurlParamsSchema = Type.Object(
  {
    action: CurlActionSchema,
    url: Type.String({
      description:
        "The URL to request - REQUIRED. Must be a valid HTTP/HTTPS URL",
    }),
    method: Type.Optional(HttpMethodSchema),
    headers: Type.Optional(
      Type.Record(Type.String(), Type.String(), {
        description: "HTTP headers as key-value pairs",
      }),
    ),
    body: Type.Optional(
      Type.Any({
        description:
          "Request body - can be string or object (will be JSON-stringified)",
      }),
    ),
    timeout: Type.Optional(
      Type.Number({
        description: "Request timeout in milliseconds (default: 10000)",
      }),
    ),
    followRedirects: Type.Optional(
      Type.Boolean({
        description: "Follow HTTP redirects (default: true)",
      }),
    ),
  },
  { additionalProperties: false },
);

export type CurlParams = Static<typeof CurlParamsSchema>;

// ==================== Code Executor Tool ====================

export const CodeExecutorActionSchema = StringEnum(
  ["execute", "validate", "get_limits", "get_examples"] as const,
  {
    description:
      "'execute': run Python code (use print() for output!). 'validate': check syntax without running. 'get_limits': see constraints. 'get_examples': see code examples.",
  },
);

export const CodeExecutorParamsSchema = Type.Object(
  {
    action: CodeExecutorActionSchema,
    code: Type.Optional(
      Type.String({
        description:
          "Python code to execute - REQUIRED for execute/validate. IMPORTANT: Use print() for ALL output.",
      }),
    ),
    timeout: Type.Optional(
      Type.Number({
        description: "Max execution time in seconds (default: 30, max: 30)",
        maximum: 30,
      }),
    ),
  },
  { additionalProperties: false },
);

export type CodeExecutorParams = Static<typeof CodeExecutorParamsSchema>;

// ==================== Generate Tool ====================

export const GenerateToolActionSchema = StringEnum(
  ["generate", "list", "get", "execute", "delete", "search"] as const,
  {
    description:
      "'generate': create new tool (requires objective). 'list': show all tools. 'get': view tool details/code. 'execute': run a tool (requires tool_id/name + params). 'delete': remove a tool. 'search': find tools by keyword.",
  },
);

export const GenerateToolParamsSchema = Type.Object(
  {
    action: GenerateToolActionSchema,
    objective: Type.Optional(
      Type.String({
        description:
          "For 'generate': DETAILED description of what the tool should do.",
      }),
    ),
    context: Type.Optional(
      Type.String({
        description: "For 'generate': additional context from conversation",
      }),
    ),
    suggestedSecrets: Type.Optional(
      Type.Array(Type.String(), {
        description:
          "For 'generate': API key names the tool might need (e.g., ['openweathermap_api_key'])",
      }),
    ),
    tool_id: Type.Optional(
      Type.String({
        description:
          "For 'get', 'execute', 'delete': the tool ID (from 'list' or 'generate' response)",
      }),
    ),
    name: Type.Optional(
      Type.String({
        description:
          "For 'get', 'execute': the tool name (alternative to tool_id)",
      }),
    ),
    params: Type.Optional(
      Type.Object(
        {},
        {
          additionalProperties: true,
          description:
            "For 'execute': parameters to pass to the tool. Check tool's inputSchema (via 'get') to see required params.",
        },
      ),
    ),
    query: Type.Optional(
      Type.String({
        description:
          "For 'search': keyword to search in tool names/descriptions",
      }),
    ),
    category: Type.Optional(
      Type.String({
        description: "For 'list': filter by category",
      }),
    ),
  },
  { additionalProperties: false },
);

export type GenerateToolParams = Static<typeof GenerateToolParamsSchema>;

// ==================== Secrets Tool ====================

export const SecretsActionSchema = StringEnum(
  ["list", "check", "create", "update", "delete"] as const,
  {
    description:
      "'list': show all secret names. 'check': verify if a secret exists. 'create': add new secret. 'update': change secret value. 'delete': remove secret.",
  },
);

export const SecretsParamsSchema = Type.Object(
  {
    action: SecretsActionSchema,
    name: Type.Optional(
      Type.String({
        description:
          "Name of the secret - REQUIRED for check, create, update, delete. Use snake_case (e.g., 'openweathermap_api_key').",
      }),
    ),
    value: Type.Optional(
      Type.String({
        description:
          "Value of the secret - REQUIRED for create and update. This will be encrypted before storage.",
      }),
    ),
    description: Type.Optional(
      Type.String({
        description:
          "Description of what the secret is for (optional, but helpful)",
      }),
    ),
  },
  { additionalProperties: false },
);

export type SecretsParams = Static<typeof SecretsParamsSchema>;

// ==================== User Profile Tool ====================

export const UserProfileActionSchema = StringEnum(
  ["get", "update", "get_field", "list_fields"] as const,
  {
    description:
      "'get': retrieve full profile. 'update': modify profile fields. 'get_field': get specific field. 'list_fields': see available fields.",
  },
);

export const UserProfileParamsSchema = Type.Object(
  {
    action: UserProfileActionSchema,
    name: Type.Optional(
      Type.String({
        description:
          "User's name (alias for firstName - use this for simple name updates)",
      }),
    ),
    firstName: Type.Optional(Type.String({ description: "User's first name" })),
    lastName: Type.Optional(Type.String({ description: "User's last name" })),
    nickname: Type.Optional(Type.String({ description: "User's nickname" })),
    preferredName: Type.Optional(
      Type.String({ description: "How the user wants to be addressed" }),
    ),
    age: Type.Optional(Type.Number({ description: "User's age" })),
    birthdate: Type.Optional(
      Type.String({
        description: "User's birthdate (ISO format, e.g., '1990-05-15')",
      }),
    ),
    location: Type.Optional(
      Type.String({ description: "User's location (city, country)" }),
    ),
    timezone: Type.Optional(
      Type.String({
        description:
          "User's timezone (e.g., 'Europe/Paris', 'America/New_York')",
      }),
    ),
    profession: Type.Optional(
      Type.String({ description: "User's profession or job title" }),
    ),
    company: Type.Optional(
      Type.String({ description: "User's company or organization" }),
    ),
    languages: Type.Optional(
      Type.Array(Type.String(), { description: "Languages the user speaks" }),
    ),
    interests: Type.Optional(
      Type.Array(Type.String(), {
        description: "User's interests and hobbies",
      }),
    ),
    personalityTraits: Type.Optional(
      Type.Array(Type.String(), { description: "Key personality traits" }),
    ),
    communicationStyle: Type.Optional(
      Type.String({
        description: "Preferred communication style (formal, casual, etc.)",
      }),
    ),
    goals: Type.Optional(
      Type.Array(Type.String(), {
        description: "User's personal or professional goals",
      }),
    ),
    values: Type.Optional(
      Type.Array(Type.String(), { description: "User's core values" }),
    ),
    customFields: Type.Optional(
      Type.Object(
        {},
        {
          additionalProperties: true,
          description: "Any additional custom fields as key-value pairs",
        },
      ),
    ),
    field: Type.Optional(
      Type.String({
        description: "For 'get_field': the specific field name to retrieve",
      }),
    ),
  },
  { additionalProperties: false },
);

export type UserProfileParams = Static<typeof UserProfileParamsSchema>;

// ==================== Browser Tool ====================

export const BrowserActionSchema = StringEnum(
  [
    "navigate",
    "screenshot",
    "pdf",
    "content",
    "evaluate",
    "click",
    "type",
    "select",
    "wait",
    "scrape",
  ] as const,
  {
    description:
      "'navigate': go to URL. 'screenshot': capture page. 'pdf': generate PDF. 'content': get page HTML. 'evaluate': run JavaScript. 'click': click element. 'type': enter text. 'select': select dropdown option. 'wait': wait for element. 'scrape': extract structured data.",
  },
);

export const BrowserParamsSchema = Type.Object(
  {
    action: BrowserActionSchema,
    url: Type.Optional(
      Type.String({
        description: "URL to navigate to - REQUIRED for 'navigate' action",
      }),
    ),
    selector: Type.Optional(
      Type.String({
        description:
          "CSS selector for targeting elements - used in click, type, select, wait, scrape",
      }),
    ),
    script: Type.Optional(
      Type.String({
        description:
          "JavaScript code to evaluate - REQUIRED for 'evaluate' action",
      }),
    ),
    text: Type.Optional(
      Type.String({ description: "Text to type - REQUIRED for 'type' action" }),
    ),
    value: Type.Optional(
      Type.String({
        description: "Value to select - REQUIRED for 'select' action",
      }),
    ),
    timeout: Type.Optional(
      Type.Number({
        description: "Timeout in milliseconds (default: 30000)",
      }),
    ),
    fullPage: Type.Optional(
      Type.Boolean({
        description: "For 'screenshot': capture full page (default: false)",
      }),
    ),
    format: Type.Optional(
      Type.String({
        description: "For 'screenshot': 'png' or 'jpeg' (default: 'png')",
      }),
    ),
    waitForSelector: Type.Optional(
      Type.String({
        description: "Wait for this selector before continuing",
      }),
    ),
    extractFields: Type.Optional(
      Type.Array(
        Type.Object({
          name: Type.String({ description: "Field name" }),
          selector: Type.String({ description: "CSS selector for the field" }),
          attribute: Type.Optional(
            Type.String({
              description: "Attribute to extract (default: text content)",
            }),
          ),
        }),
        { description: "For 'scrape': fields to extract from page" },
      ),
    ),
  },
  { additionalProperties: false },
);

export type BrowserParams = Static<typeof BrowserParamsSchema>;

// ==================== Goals Tool ====================

export const GoalsActionSchema = StringEnum(
  [
    "create",
    "list",
    "get",
    "update",
    "delete",
    "add_milestone",
    "update_milestone",
    "complete_milestone",
    "delete_milestone",
    "progress",
    "archive",
    "unarchive",
  ] as const,
  {
    description:
      "'create': create new goal. 'list': show goals. 'get': view goal details. 'update': modify goal. 'delete': remove goal. 'add_milestone': add checkpoint. 'update_milestone/complete_milestone/delete_milestone': manage milestones. 'progress': get progress summary. 'archive/unarchive': archive management.",
  },
);

export const GoalStatusSchema = StringEnum(
  ["NOT_STARTED", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "ABANDONED"] as const,
  { description: "Current status of the goal" },
);

export const GoalPrioritySchema = StringEnum(
  ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const,
  { description: "Priority level of the goal" },
);

export const GoalsParamsSchema = Type.Object(
  {
    action: GoalsActionSchema,
    goalId: Type.Optional(
      Type.String({
        description:
          "ID of the goal - REQUIRED for get, update, delete, add_milestone, archive, unarchive",
      }),
    ),
    milestoneId: Type.Optional(
      Type.String({
        description:
          "ID of the milestone - REQUIRED for update_milestone, complete_milestone, delete_milestone",
      }),
    ),
    title: Type.Optional(
      Type.String({
        description:
          "Title of the goal or milestone - REQUIRED for create, add_milestone",
      }),
    ),
    description: Type.Optional(
      Type.String({ description: "Detailed description" }),
    ),
    targetDate: Type.Optional(
      Type.String({ description: "Target completion date (ISO format)" }),
    ),
    status: Type.Optional(GoalStatusSchema),
    priority: Type.Optional(GoalPrioritySchema),
    category: Type.Optional(
      Type.String({
        description:
          "Category to organize goals (e.g., 'health', 'career', 'finance')",
      }),
    ),
    tags: Type.Optional(
      Type.Array(Type.String(), {
        description: "Tags for filtering and organization",
      }),
    ),
    progressNotes: Type.Optional(
      Type.String({ description: "Notes about current progress" }),
    ),
    dueDate: Type.Optional(
      Type.String({ description: "Due date for milestone (ISO format)" }),
    ),
    includeArchived: Type.Optional(
      Type.Boolean({
        description: "For 'list': include archived goals (default: false)",
      }),
    ),
    includeCompleted: Type.Optional(
      Type.Boolean({
        description: "For 'list': include completed goals (default: true)",
      }),
    ),
  },
  { additionalProperties: false },
);

export type GoalsParams = Static<typeof GoalsParamsSchema>;

// ==================== Spawn Subagent Tool ====================

export const SubagentActionSchema = StringEnum(
  ["spawn", "spawn_template", "list_templates", "status", "cancel"] as const,
  {
    description:
      "'spawn': create custom sub-agent. 'spawn_template': use predefined template. 'list_templates': see available templates. 'status': check running agent. 'cancel': stop an agent.",
  },
);

export const SubagentParamsSchema = Type.Object(
  {
    action: SubagentActionSchema,
    task: Type.Optional(
      Type.String({
        description:
          "The task/objective for the sub-agent - REQUIRED for spawn and spawn_template. Be specific and detailed.",
      }),
    ),
    tools: Type.Optional(
      Type.Array(Type.String(), {
        description:
          "List of tool names the sub-agent can use (e.g., ['curl', 'code_executor'])",
      }),
    ),
    max_iterations: Type.Optional(
      Type.Number({
        description:
          "Maximum LLM iterations for the sub-agent (default: 10, max: 15)",
        maximum: 15,
      }),
    ),
    timeout: Type.Optional(
      Type.Number({
        description: "Timeout in milliseconds (default: 120000 = 2 minutes)",
      }),
    ),
    context: Type.Optional(
      Type.String({
        description:
          "Optional context from the main conversation to provide to the sub-agent",
      }),
    ),
    template_id: Type.Optional(
      Type.String({
        description:
          "Template ID to use (e.g., 'research', 'scheduler', 'data_processor', 'task_manager')",
      }),
    ),
    additional_tools: Type.Optional(
      Type.Array(Type.String(), {
        description: "Additional tools to add to the template's default tools",
      }),
    ),
  },
  { additionalProperties: false },
);

export type SubagentParams = Static<typeof SubagentParamsSchema>;

// ==================== Read Tool Code Tool ====================

export const ReadToolCodeActionSchema = StringEnum(
  ["read", "analyze", "fix", "rollback"] as const,
  {
    description:
      "'read': view full source code and metadata. 'analyze': get error statistics, success rate, and common failure patterns. 'fix': apply corrected code to repair the tool. 'rollback': revert to the previous code version.",
  },
);

export const ReadToolCodeParamsSchema = Type.Object(
  {
    action: ReadToolCodeActionSchema,
    tool_id: Type.Optional(
      Type.String({
        description:
          "The tool ID to read/analyze/fix/rollback (from 'generate_tool list' response)",
      }),
    ),
    tool_name: Type.Optional(
      Type.String({ description: "The tool name (alternative to tool_id)" }),
    ),
    fixed_code: Type.Optional(
      Type.String({
        description:
          "For 'fix' action: the corrected Python code. Must define functions or set a 'result' variable.",
      }),
    ),
    fix_reason: Type.Optional(
      Type.String({
        description:
          "For 'fix' action: explanation of what was fixed (stored for history)",
      }),
    ),
    reason: Type.Optional(
      Type.String({
        description:
          "For 'rollback' action: reason for the rollback (stored for audit)",
      }),
    ),
  },
  { additionalProperties: false },
);

export type ReadToolCodeParams = Static<typeof ReadToolCodeParamsSchema>;

// ==================== Long Running Task Tool ====================

export const LongRunningTaskActionSchema = StringEnum(
  [
    "create",
    "add_steps",
    "start",
    "pause",
    "resume",
    "cancel",
    "get",
    "list",
    "get_progress",
    "get_report",
    "list_active",
  ] as const,
  {
    description:
      "WORKFLOW: 1) 'create' → returns taskId. 2) 'add_steps' with taskId → defines steps. 3) 'start' with taskId → begins execution.",
  },
);

export const StepActionSchema = StringEnum(
  ["llm_generate", "wait", "conditional", "aggregate", "notify"] as const,
  { description: "Step action type" },
);

export const LongRunningTaskParamsSchema = Type.Object(
  {
    action: LongRunningTaskActionSchema,
    taskId: Type.Optional(
      Type.String({
        description:
          "ID of the task - REQUIRED for add_steps, start, pause, resume, cancel, get, get_progress, get_report",
      }),
    ),
    name: Type.Optional(
      Type.String({
        description: "Name of the task - REQUIRED for 'create' action",
      }),
    ),
    description: Type.Optional(
      Type.String({ description: "Description of what the task accomplishes" }),
    ),
    onComplete: Type.Optional(
      StringEnum(["SILENT", "NOTIFY_USER", "NOTIFY_AND_SUMMARIZE"] as const, {
        description:
          "What happens when task completes (default: NOTIFY_AND_SUMMARIZE)",
      }),
    ),
    notifyOnProgress: Type.Optional(
      Type.Boolean({
        description:
          "Send periodic progress notifications while running (default: false)",
      }),
    ),
    progressIntervalMinutes: Type.Optional(
      Type.Number({
        description:
          "Minutes between progress notifications (only if notifyOnProgress is true)",
      }),
    ),
    initialContext: Type.Optional(
      Type.Object(
        {},
        {
          additionalProperties: true,
          description: "Initial data passed to all steps",
        },
      ),
    ),
    steps: Type.Optional(
      Type.Array(
        Type.Object({
          name: Type.String({ description: "Step name (shown in progress)" }),
          description: Type.Optional(
            Type.String({ description: "What this step does" }),
          ),
          action: StepActionSchema,
          params: Type.Object(
            {},
            {
              additionalProperties: true,
              description: "Parameters for the step action",
            },
          ),
        }),
        {
          description:
            "Array of step definitions - REQUIRED for 'add_steps' action",
        },
      ),
    ),
    status: Type.Optional(
      Type.Array(
        StringEnum([
          "PENDING",
          "RUNNING",
          "PAUSED",
          "COMPLETED",
          "FAILED",
          "CANCELLED",
        ] as const),
        { description: "For 'list' action: filter by these statuses" },
      ),
    ),
    limit: Type.Optional(
      Type.Number({
        description:
          "For 'list' action: maximum results to return (default: 20)",
      }),
    ),
  },
  { additionalProperties: false },
);

export type LongRunningTaskParams = Static<typeof LongRunningTaskParamsSchema>;

// ==================== User Context Tool ====================

export const UserContextActionSchema = StringEnum(
  ["get_location", "get_preferences", "search_facts"] as const,
  {
    description:
      "'get_location': retrieve user's location info. 'get_preferences': get user preferences. 'search_facts': search for specific facts",
  },
);

export const UserContextParamsSchema = Type.Object(
  {
    action: UserContextActionSchema,
    topic: Type.Optional(
      Type.String({
        description:
          "For 'get_preferences': topic to get preferences for. For 'search_facts': topic to search in facts",
      }),
    ),
    query: Type.Optional(
      Type.String({
        description: "For 'search_facts': search query to find relevant facts",
      }),
    ),
  },
  { additionalProperties: false },
);

export type UserContextParams = Static<typeof UserContextParamsSchema>;

// ==================== Achievements Tool ====================

export const AchievementsActionSchema = StringEnum(
  ["list", "get", "create", "unlock", "check", "progress"] as const,
  {
    description:
      "'list': show achievements. 'get': view details. 'create': define new achievement. 'unlock': unlock for user. 'check': check if unlocked. 'progress': view progress.",
  },
);

export const AchievementsParamsSchema = Type.Object(
  {
    action: AchievementsActionSchema,
    achievement_id: Type.Optional(
      Type.String({ description: "Achievement ID - for get, unlock, check" }),
    ),
    name: Type.Optional(
      Type.String({ description: "Achievement name - REQUIRED for create" }),
    ),
    description: Type.Optional(
      Type.String({ description: "Achievement description" }),
    ),
    category: Type.Optional(
      Type.String({ description: "Achievement category" }),
    ),
    icon: Type.Optional(
      Type.String({ description: "Achievement icon (emoji or URL)" }),
    ),
    points: Type.Optional(
      Type.Number({ description: "Points awarded (default: 10)" }),
    ),
    rarity: Type.Optional(
      StringEnum(["common", "uncommon", "rare", "epic", "legendary"] as const, {
        description: "Achievement rarity level (default: normal)",
      }),
    ),
    criteria: Type.Optional(
      Type.Object(
        {},
        {
          additionalProperties: true,
          description:
            "Achievement criteria (flexible JSON object describing unlock conditions)",
        },
      ),
    ),
    is_hidden: Type.Optional(
      Type.Boolean({
        description:
          "Whether achievement is hidden until unlocked (default true for create)",
      }),
    ),
    filter_category: Type.Optional(
      Type.String({ description: "Filter by category (for list)" }),
    ),
    unlocked_only: Type.Optional(
      Type.Boolean({
        description:
          "Show only unlocked achievements (for list, default false)",
      }),
    ),
    include_hidden: Type.Optional(
      Type.Boolean({
        description: "Include hidden achievements (for list, default false)",
      }),
    ),
  },
  { additionalProperties: false },
);

export type AchievementsParams = Static<typeof AchievementsParamsSchema>;

// ==================== Skills Tool ====================

export const SkillsActionSchema = StringEnum(
  [
    "list_installed",
    "list_hub",
    "list_custom",
    "get",
    "install",
    "uninstall",
    "toggle",
    "create",
    "update",
    "delete",
  ] as const,
  {
    description:
      "'list_installed': show user's installed skills. 'list_hub': browse skills in the hub. 'list_custom': list user's custom skills. 'get': view skill details. 'install/uninstall': manage hub skills. 'toggle': enable/disable. 'create/update/delete': manage custom skills.",
  },
);

export const SkillCategorySchema = StringEnum(
  [
    "PRODUCTIVITY",
    "DEVELOPMENT",
    "RESEARCH",
    "COMMUNICATION",
    "HEALTH",
    "FINANCE",
    "CREATIVE",
    "LEARNING",
    "OTHER",
  ] as const,
  { description: "Category of the skill" },
);

export const SkillsParamsSchema = Type.Object(
  {
    action: SkillsActionSchema,
    skillId: Type.Optional(
      Type.String({
        description:
          "Skill ID - for get, install, uninstall, toggle, update, delete",
      }),
    ),
    name: Type.Optional(
      Type.String({ description: "Skill name - REQUIRED for create" }),
    ),
    description: Type.Optional(
      Type.String({ description: "What the skill does" }),
    ),
    instructions: Type.Optional(
      Type.String({
        description:
          "For create/update: The skill instructions in markdown format. Detailed steps for the AI to follow.",
      }),
    ),
    category: Type.Optional(SkillCategorySchema),
    icon: Type.Optional(Type.String({ description: "Skill icon (emoji)" })),
    triggerPhrases: Type.Optional(
      Type.Array(Type.String(), {
        description: "Phrases that automatically activate this skill",
      }),
    ),
    enabled: Type.Optional(
      Type.Boolean({ description: "For toggle: new enabled state" }),
    ),
    search: Type.Optional(
      Type.String({ description: "For list_hub: search query" }),
    ),
  },
  { additionalProperties: false },
);

export type SkillsParams = Static<typeof SkillsParamsSchema>;

// ==================== Tool Definitions ====================

/**
 * Create a pi-ai compatible Tool from a TypeBox schema
 * Uses type assertion because TObject may contain TUnsafe properties from StringEnum
 * which don't fully satisfy TSchema type requirements
 *
 * Returns 'any' to avoid TypeBox version conflicts between this project
 * and the version bundled with pi-ai
 */
export function createTool(
  name: string,
  description: string,
  parametersSchema: TObject,
): { name: string; description: string; parameters: any } {
  return {
    name,
    description,
    // TypeBox TObject is a valid JSON Schema at runtime
    parameters: parametersSchema,
  };
}

/**
 * All tool schemas in TypeBox format
 * These can be used for:
 * 1. Type inference (Static<typeof Schema>)
 * 2. Validation via pi-ai's validateToolCall
 * 3. Conversion to JSON Schema for OpenAI API
 */
export const toolSchemas = {
  todo: TodoParamsSchema,
  notification: NotificationParamsSchema,
  scheduled_task: ScheduledTaskParamsSchema,
  curl: CurlParamsSchema,
  code_executor: CodeExecutorParamsSchema,
  generate_tool: GenerateToolParamsSchema,
  secrets: SecretsParamsSchema,
  user_profile: UserProfileParamsSchema,
  browser: BrowserParamsSchema,
  goals: GoalsParamsSchema,
  spawn_subagent: SubagentParamsSchema,
  read_tool_code: ReadToolCodeParamsSchema,
  long_running_task: LongRunningTaskParamsSchema,
  user_context: UserContextParamsSchema,
  achievements: AchievementsParamsSchema,
  skills: SkillsParamsSchema,
} as const;

/** Type for pi-ai compatible tool */
export type ToolDefinition = {
  name: string;
  description: string;
  parameters: any;
};

/**
 * Get all tools in pi-ai Tool format
 * Returns ToolDefinition[] which is compatible with pi-ai's Tool[]
 */
export function getTypeBoxTools(): ToolDefinition[] {
  return [
    createTool(
      "todo",
      "Manage user's todo list - create, read, update, delete, and complete tasks. You have full CRUD capability: list existing todos, create new ones, modify their properties (title, priority, due date, etc.), mark them complete, and delete them entirely. IMPORTANT: For update/complete/delete, you MUST first use 'list' to get the todoId.",
      TodoParamsSchema,
    ),
    createTool(
      "notification",
      "Send and manage notifications to the user - immediate, scheduled, or manage existing ones. The system automatically selects the best delivery channel (Pushover for mobile if configured, otherwise browser). Use 'send' for immediate, 'schedule' for future delivery.",
      NotificationParamsSchema,
    ),
    createTool(
      "scheduled_task",
      "Schedule tasks to run in the future. Supports one-time (executeAt), recurring (cron), and interval-based schedules. IMPORTANT: For 'create', you must provide: name, scheduleType, actionType, and schedule-specific params.",
      ScheduledTaskParamsSchema,
    ),
    createTool(
      "curl",
      "Make HTTP requests to external APIs and websites. Supports all HTTP methods with custom headers and body. For APIs requiring authentication, include the auth header (e.g., Bearer token).",
      CurlParamsSchema,
    ),
    createTool(
      "code_executor",
      "Execute Python code in a secure sandbox. Use for calculations, data processing, algorithms, statistics. CRITICAL: You MUST use print() to output results - return values are NOT captured.",
      CodeExecutorParamsSchema,
    ),
    createTool(
      "generate_tool",
      "Generate, manage, and execute custom AI-created tools. Use 'generate' to create a new tool from a detailed objective. The AI writes Python code, tests it, and saves it for reuse.",
      GenerateToolParamsSchema,
    ),
    createTool(
      "secrets",
      "Manage user API keys and secrets. Use to check, create, or update secrets needed for generated tools. IMPORTANT: You can NEVER read/retrieve the actual value of a secret - only list, check existence, create, or update.",
      SecretsParamsSchema,
    ),
    createTool(
      "user_profile",
      "Manage the user's permanent profile - store important information about them (name, job, location, goals, etc.). This data is ALWAYS available to you without memory search.",
      UserProfileParamsSchema,
    ),
    createTool(
      "browser",
      "Interact with web pages through a headless browser (Browserless/Chrome). Use for: navigating dynamic sites, extracting content from JavaScript-rendered pages, taking screenshots, generating PDFs, scraping structured data, filling forms, clicking buttons, and running JavaScript.",
      BrowserParamsSchema,
    ),
    createTool(
      "goals",
      "Manage user's goals and track progress. Create goals with milestones, update status, track progress over time. Use for long-term objective tracking.",
      GoalsParamsSchema,
    ),
    createTool(
      "spawn_subagent",
      "Spawn a sub-agent to handle complex, multi-step tasks autonomously. The sub-agent has its own tool access and can work independently. Use for research, data processing, or parallel task execution.",
      SubagentParamsSchema,
    ),
    createTool(
      "read_tool_code",
      "Read and analyze the source code of generated tools to understand their implementation, diagnose errors, or apply fixes. Use 'read' to see the full code. Use 'analyze' to get error statistics and patterns. Use 'fix' to update broken code proactively. Use 'rollback' to revert to the previous version.",
      ReadToolCodeParamsSchema,
    ),
    createTool(
      "long_running_task",
      "Create and manage long-running background tasks with multiple steps. CRITICAL WORKFLOW: You MUST follow these 3 steps in order: 1) 'create' to get taskId, 2) 'add_steps' to define what the task does, 3) 'start' to begin execution.",
      LongRunningTaskParamsSchema,
    ),
    createTool(
      "user_context",
      "Retrieve user context information from memory - location, preferences, and facts about the user. Use this to understand user's location, preferences, or search for specific information about them.",
      UserContextParamsSchema,
    ),
    createTool(
      "achievements",
      "Manage achievements and gamification. Create, unlock, and track achievements for user engagement. Supports categories, rarity levels, and progress tracking.",
      AchievementsParamsSchema,
    ),
    createTool(
      "skills",
      "Manage skills - list, install, create, update, and delete skills. Skills are reusable instruction sets that guide how to accomplish specific tasks. Custom skills can be updated/deleted; hub skills can only be installed/uninstalled.",
      SkillsParamsSchema,
    ),
  ];
}
