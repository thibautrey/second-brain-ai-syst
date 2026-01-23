# Long Running Task System Implementation

## Overview

This document describes the Long Running Task system implemented for the Second Brain AI System. This system allows the AI to start, track, and manage autonomous tasks that can run from minutes to hours in the background.

## Architecture

### Components

1. **Database Schema** (`backend/prisma/schema.prisma`)
   - `LongRunningTask`: Main task entity with status, progress, checkpoints
   - `TaskStep`: Individual steps within a task
   - `TaskLog`: Execution logs for debugging

2. **Service** (`backend/services/tools/long-running-task.service.ts`)
   - Core business logic for task management
   - Step execution engine with error handling
   - Progress tracking and checkpoint generation
   - Event emission for real-time updates

3. **Controller** (`backend/controllers/long-running-task.controller.ts`)
   - REST API endpoints for task management

4. **Tool Executor Integration** (`backend/services/tool-executor.ts`)
   - `long_running_task` tool available to the AI
   - Schema definition for LLM function calling

5. **WebSocket Broadcasting** (`backend/services/websocket-broadcast.ts`)
   - Real-time progress updates to connected clients

## Task Lifecycle

```
PENDING → RUNNING → COMPLETED
                 ↓
              PAUSED → RUNNING
                 ↓
              FAILED
                 ↓
              CANCELLED
```

## Step Actions

Built-in actions available for task steps:

| Action         | Description          | Parameters                                           |
| -------------- | -------------------- | ---------------------------------------------------- |
| `llm_generate` | Call LLM with prompt | `prompt`, `systemPrompt`, `maxTokens`, `temperature` |
| `wait`         | Pause execution      | `minutes`                                            |
| `conditional`  | Branch logic         | `condition`, `ifTrue`, `ifFalse`                     |
| `aggregate`    | Combine results      | `keys`, `operation` (concat/merge/list)              |
| `notify`       | Send notification    | `title`, `message`, `type`                           |

## API Endpoints

### Task Management

```
POST   /api/tasks/long-running              Create a new task
GET    /api/tasks/long-running              List all tasks
GET    /api/tasks/long-running/active       List running/paused tasks
GET    /api/tasks/long-running/:taskId      Get task details
POST   /api/tasks/long-running/:taskId/steps Add steps to task
POST   /api/tasks/long-running/:taskId/start Start task execution
POST   /api/tasks/long-running/:taskId/pause Pause task
POST   /api/tasks/long-running/:taskId/resume Resume paused task
POST   /api/tasks/long-running/:taskId/cancel Cancel task
GET    /api/tasks/long-running/:taskId/progress Get progress summary
GET    /api/tasks/long-running/:taskId/report Get AI-readable report
```

## AI Tool Usage

The AI can use the `long_running_task` tool with the following workflow:

### 1. Create Task

```json
{
  "action": "create",
  "name": "Research Project",
  "description": "Detailed research on topic X",
  "objective": "Gather and synthesize information",
  "estimatedDurationMinutes": 60,
  "completionBehavior": "NOTIFY_USER"
}
```

### 2. Add Steps

```json
{
  "action": "add_steps",
  "taskId": "xxx",
  "steps": [
    {
      "name": "Step 1",
      "action": "llm_generate",
      "params": { "prompt": "..." },
      "isCheckpoint": true
    }
  ]
}
```

### 3. Start Execution

```json
{
  "action": "start",
  "taskId": "xxx"
}
```

### 4. Monitor Progress

```json
{
  "action": "get_progress",
  "taskId": "xxx"
}
```

## Completion Behavior

| Behavior               | Description                   |
| ---------------------- | ----------------------------- |
| `SILENT`               | No notification on completion |
| `NOTIFY_USER`          | Send notification when done   |
| `NOTIFY_AND_SUMMARIZE` | Notify with detailed summary  |

## Checkpoints

Steps can be marked as checkpoints (`isCheckpoint: true`). When a checkpoint step completes:

1. An LLM summarizes progress so far
2. Summary is stored in `lastCheckpointSummary`
3. WebSocket notification sent to user
4. AI can use this summary for context in future interactions

## Error Handling

Each step can configure error handling:

| Mode       | Behavior                            |
| ---------- | ----------------------------------- |
| `abort`    | Stop task immediately (default)     |
| `retry`    | Retry step up to `maxRetries` times |
| `continue` | Skip failed step and continue       |

## WebSocket Events

Clients receive real-time updates via WebSocket:

- `task:started` - Task execution began
- `task:progress` - Progress update
- `task:step_completed` - A step finished
- `task:checkpoint` - Checkpoint summary created
- `task:completed` - Task finished successfully
- `task:failed` - Task failed with error
- `task:paused` - Task was paused
- `task:cancelled` - Task was cancelled

## Migration

Apply the database migration:

```bash
cd backend
npx prisma migrate deploy
npx prisma generate
```

## Usage Example

```typescript
// AI creates a research task
const task = await longRunningTaskService.createTask(userId, {
  name: "Market Research",
  description: "Research competitors in the AI space",
  objective: "Create a comprehensive competitor analysis",
  estimatedDurationMinutes: 120,
  completionBehavior: "NOTIFY_AND_SUMMARIZE",
  notifyOnProgress: true,
  progressIntervalMinutes: 30,
});

// Add steps
await longRunningTaskService.addSteps(task.id, [
  {
    name: "Identify Competitors",
    action: "llm_generate",
    params: {
      prompt: "List top 10 AI companies...",
    },
    isCheckpoint: true,
  },
  {
    name: "Gather Details",
    action: "llm_generate",
    params: {
      prompt: "For each competitor: {{step_1_result}}...",
    },
  },
  // ... more steps
]);

// Start execution
await longRunningTaskService.startTask(userId, task.id);

// Task runs in background, user gets notifications
```

## Files Created/Modified

### New Files

- `backend/services/tools/long-running-task.service.ts`
- `backend/controllers/long-running-task.controller.ts`
- `backend/services/websocket-broadcast.ts`
- `backend/prisma/migrations/20260124000000_add_long_running_tasks/migration.sql`

### Modified Files

- `backend/prisma/schema.prisma` - Added new models and enums
- `backend/services/tools/index.ts` - Export new service
- `backend/services/tool-executor.ts` - Added tool definition and executor
- `backend/controllers/chat.controller.ts` - Updated system prompt
- `backend/services/api-server.ts` - Added routes and initialization

## Future Enhancements

1. **Custom Step Actions**: Allow plugins to register custom actions
2. **Task Dependencies**: Support dependent tasks
3. **Parallel Steps**: Execute multiple steps in parallel
4. **Resource Limits**: Limit concurrent tasks per user
5. **Task Templates**: Pre-defined task templates for common operations
6. **Cost Tracking**: Track LLM costs per task
