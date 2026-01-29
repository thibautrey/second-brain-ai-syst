-- Migration: Add Built-in Tools (Todos, Scheduled Tasks, Notifications)
-- This migration adds the tables for the built-in tools system

-- Todo Status Enum
CREATE TYPE "TodoStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- Todo Priority Enum
CREATE TYPE "TodoPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- Schedule Type Enum
CREATE TYPE "ScheduleType" AS ENUM ('ONE_TIME', 'CRON', 'INTERVAL');

-- Task Action Type Enum
CREATE TYPE "TaskActionType" AS ENUM ('SEND_NOTIFICATION', 'CREATE_TODO', 'GENERATE_SUMMARY', 'RUN_AGENT', 'WEBHOOK', 'CUSTOM');

-- Notification Type Enum
CREATE TYPE "NotificationType" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'ERROR', 'REMINDER', 'ACHIEVEMENT');

-- Notification Channel Enum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'PUSH', 'WEBHOOK');

-- Todos Table
CREATE TABLE "todos" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TodoStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "TodoPriority" NOT NULL DEFAULT 'MEDIUM',
    "category" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dueDate" TIMESTAMP(3),
    "reminderAt" TIMESTAMP(3),
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrenceRule" TEXT,
    "completedAt" TIMESTAMP(3),
    "sourceMemoryId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "todos_pkey" PRIMARY KEY ("id")
);

-- Scheduled Tasks Table
CREATE TABLE "scheduled_tasks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scheduleType" "ScheduleType" NOT NULL,
    "cronExpression" TEXT,
    "executeAt" TIMESTAMP(3),
    "interval" INTEGER,
    "actionType" "TaskActionType" NOT NULL,
    "actionPayload" JSONB NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "lastRunStatus" TEXT,
    "lastRunError" TEXT,
    "maxRuns" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_tasks_pkey" PRIMARY KEY ("id")
);

-- Task Executions Table
CREATE TABLE "task_executions" (
    "id" TEXT NOT NULL,
    "scheduledTaskId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "output" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,

    CONSTRAINT "task_executions_pkey" PRIMARY KEY ("id")
);

-- Notifications Table
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'INFO',
    "channels" "NotificationChannel"[] DEFAULT ARRAY['IN_APP']::"NotificationChannel"[],
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "isDismissed" BOOLEAN NOT NULL DEFAULT false,
    "scheduledFor" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "sourceType" TEXT,
    "sourceId" TEXT,
    "actionUrl" TEXT,
    "actionLabel" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- Indexes for Todos
CREATE INDEX "todos_userId_idx" ON "todos"("userId");
CREATE INDEX "todos_status_idx" ON "todos"("status");
CREATE INDEX "todos_dueDate_idx" ON "todos"("dueDate");
CREATE INDEX "todos_priority_idx" ON "todos"("priority");

-- Indexes for Scheduled Tasks
CREATE INDEX "scheduled_tasks_userId_idx" ON "scheduled_tasks"("userId");
CREATE INDEX "scheduled_tasks_isEnabled_idx" ON "scheduled_tasks"("isEnabled");
CREATE INDEX "scheduled_tasks_nextRunAt_idx" ON "scheduled_tasks"("nextRunAt");

-- Indexes for Task Executions
CREATE INDEX "task_executions_scheduledTaskId_idx" ON "task_executions"("scheduledTaskId");
CREATE INDEX "task_executions_startedAt_idx" ON "task_executions"("startedAt");

-- Indexes for Notifications
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");
CREATE INDEX "notifications_isRead_idx" ON "notifications"("isRead");
CREATE INDEX "notifications_scheduledFor_idx" ON "notifications"("scheduledFor");
CREATE INDEX "notifications_type_idx" ON "notifications"("type");

-- Foreign Keys
ALTER TABLE "todos" ADD CONSTRAINT "todos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "scheduled_tasks" ADD CONSTRAINT "scheduled_tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "task_executions" ADD CONSTRAINT "task_executions_scheduledTaskId_fkey" FOREIGN KEY ("scheduledTaskId") REFERENCES "scheduled_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
