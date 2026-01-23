# Built-in Tools Implementation

This document describes the implementation of the built-in tools system for the Second Brain AI System.

## Overview

The system now includes three integrated tools that the AI can use to perform actions:

1. **Todo List** - Task management system
2. **Scheduled Tasks** - Cron-like task scheduling
3. **Notifications** - User notification system

## Architecture

```
backend/
├── services/
│   ├── tool-executor.ts          # Main tool router
│   └── tools/
│       ├── index.ts              # Tool exports
│       ├── todo.service.ts       # Todo list service
│       ├── notification.service.ts # Notification service
│       └── scheduled-task.service.ts # Scheduled task service
├── controllers/
│   └── tools.controller.ts       # REST API endpoints
└── prisma/
    └── schema.prisma             # Database models
```

## Database Models

### Todo

```prisma
model Todo {
  id              String       @id
  userId          String
  title           String
  description     String?
  status          TodoStatus   (PENDING, IN_PROGRESS, COMPLETED, CANCELLED)
  priority        TodoPriority (LOW, MEDIUM, HIGH, URGENT)
  category        String?
  tags            String[]
  dueDate         DateTime?
  reminderAt      DateTime?
  isRecurring     Boolean
  recurrenceRule  String?      (iCal RRULE format)
  completedAt     DateTime?
  sourceMemoryId  String?
}
```

### ScheduledTask

```prisma
model ScheduledTask {
  id              String
  userId          String
  name            String
  description     String?
  scheduleType    ScheduleType   (ONE_TIME, CRON, INTERVAL)
  cronExpression  String?
  executeAt       DateTime?
  interval        Int?           (minutes)
  actionType      TaskActionType
  actionPayload   Json
  isEnabled       Boolean
  nextRunAt       DateTime?
  runCount        Int
}
```

### Notification

```prisma
model Notification {
  id           String
  userId       String
  title        String
  message      String
  type         NotificationType (INFO, SUCCESS, WARNING, ERROR, REMINDER, ACHIEVEMENT)
  channels     NotificationChannel[] (IN_APP, EMAIL, PUSH, WEBHOOK)
  isRead       Boolean
  scheduledFor DateTime?
  sentAt       DateTime?
}
```

## API Endpoints

### Generic Tool Execution

```
POST /api/tools/execute
{
  "toolId": "todo" | "notification" | "scheduled_task",
  "action": "...",
  "params": { ... }
}
```

### Todo Endpoints

| Method | Endpoint                        | Description               |
| ------ | ------------------------------- | ------------------------- |
| POST   | `/api/tools/todos`              | Create a todo             |
| GET    | `/api/tools/todos`              | List todos (with filters) |
| GET    | `/api/tools/todos/stats`        | Get todo statistics       |
| GET    | `/api/tools/todos/overdue`      | Get overdue todos         |
| GET    | `/api/tools/todos/due-soon`     | Get todos due soon        |
| GET    | `/api/tools/todos/:id`          | Get a specific todo       |
| PATCH  | `/api/tools/todos/:id`          | Update a todo             |
| POST   | `/api/tools/todos/:id/complete` | Complete a todo           |
| DELETE | `/api/tools/todos/:id`          | Delete a todo             |

### Notification Endpoints

| Method | Endpoint                                 | Description                |
| ------ | ---------------------------------------- | -------------------------- |
| POST   | `/api/tools/notifications`               | Send/schedule notification |
| GET    | `/api/tools/notifications`               | List notifications         |
| GET    | `/api/tools/notifications/unread-count`  | Get unread count           |
| POST   | `/api/tools/notifications/mark-all-read` | Mark all as read           |
| POST   | `/api/tools/notifications/:id/read`      | Mark as read               |
| POST   | `/api/tools/notifications/:id/dismiss`   | Dismiss notification       |
| DELETE | `/api/tools/notifications/:id`           | Delete notification        |

### Scheduled Task Endpoints

| Method | Endpoint                                 | Description             |
| ------ | ---------------------------------------- | ----------------------- |
| POST   | `/api/tools/scheduled-tasks`             | Create a scheduled task |
| GET    | `/api/tools/scheduled-tasks`             | List scheduled tasks    |
| GET    | `/api/tools/scheduled-tasks/:id`         | Get a specific task     |
| PATCH  | `/api/tools/scheduled-tasks/:id`         | Update a task           |
| POST   | `/api/tools/scheduled-tasks/:id/enable`  | Enable a task           |
| POST   | `/api/tools/scheduled-tasks/:id/disable` | Disable a task          |
| POST   | `/api/tools/scheduled-tasks/:id/execute` | Execute immediately     |
| GET    | `/api/tools/scheduled-tasks/:id/history` | Get execution history   |
| DELETE | `/api/tools/scheduled-tasks/:id`         | Delete a task           |

## LLM Tool Schemas

The `toolExecutorService.getToolSchemas()` method returns OpenAI-compatible function schemas for the AI to use these tools.

Example usage by the AI:

```json
{
  "tool": "todo",
  "action": "create",
  "params": {
    "title": "Review meeting notes",
    "priority": "HIGH",
    "dueDate": "2026-01-24T18:00:00Z"
  }
}
```

## Features

### Todo System

- **Priorities**: LOW, MEDIUM, HIGH, URGENT
- **Categories & Tags**: Organize todos by category and tags
- **Due dates**: Set deadlines with automatic overdue detection
- **Reminders**: Schedule reminders that create notifications
- **Recurring todos**: Support for daily, weekly, monthly, yearly recurrence (iCal RRULE)
- **Statistics**: Track completion rates, overdue items, etc.

### Scheduled Tasks

- **One-time**: Execute once at a specific datetime
- **Cron**: Execute based on cron expression (e.g., `0 9 * * *` for daily at 9 AM)
- **Interval**: Execute every N minutes

**Available Actions**:

- `SEND_NOTIFICATION` - Send a notification
- `CREATE_TODO` - Create a todo item
- `GENERATE_SUMMARY` - Generate a memory summary
- `RUN_AGENT` - Run a background agent
- `WEBHOOK` - Call an external webhook
- `CUSTOM` - Custom action with payload

### Notification System

- **Types**: INFO, SUCCESS, WARNING, ERROR, REMINDER, ACHIEVEMENT
- **Channels**: IN_APP, EMAIL, PUSH, WEBHOOK
- **Scheduling**: Schedule notifications for future delivery
- **Actions**: Clickable actions with URL

## Setup

1. Run the Prisma migration:

   ```bash
   cd backend
   npx prisma migrate dev --name add_builtin_tools
   ```

2. Regenerate Prisma client:

   ```bash
   npx prisma generate
   ```

3. Restart the backend server

## Usage Examples

### Create a Todo via API

```bash
curl -X POST http://localhost:3001/api/tools/todos \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Review project proposal",
    "description": "Check the new AI feature proposal",
    "priority": "HIGH",
    "category": "Work",
    "tags": ["ai", "review"],
    "dueDate": "2026-01-25T12:00:00Z"
  }'
```

### Schedule a Daily Reminder

```bash
curl -X POST http://localhost:3001/api/tools/scheduled-tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Daily Standup Reminder",
    "scheduleType": "CRON",
    "cronExpression": "0 9 * * 1-5",
    "actionType": "SEND_NOTIFICATION",
    "actionPayload": {
      "title": "⏰ Daily Standup",
      "message": "Time for the daily standup meeting!",
      "type": "REMINDER"
    }
  }'
```

### Send an Immediate Notification

```bash
curl -X POST http://localhost:3001/api/tools/notifications \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Task Completed",
    "message": "Your background analysis is complete",
    "type": "SUCCESS"
  }'
```

## Integration with LLM

The tool schemas are available at `GET /api/tools/schemas` and can be injected into the LLM's function calling context. The AI can then:

1. Create todos based on user conversations
2. Schedule reminders for future actions
3. Send notifications about important events
4. Set up recurring tasks

---

**Created**: January 23, 2026
**Status**: Implementation Complete - Pending Migration
