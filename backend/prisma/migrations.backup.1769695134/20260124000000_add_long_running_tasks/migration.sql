-- CreateEnum
CREATE TYPE "LongRunningTaskStatus" AS ENUM ('PENDING', 'RUNNING', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskStepStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "TaskCompletionBehavior" AS ENUM ('SILENT', 'NOTIFY_USER', 'NOTIFY_AND_SUMMARIZE');

-- CreateTable
CREATE TABLE "long_running_tasks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "estimatedDurationMinutes" INTEGER,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "lastPausedAt" TIMESTAMP(3),
    "lastResumedAt" TIMESTAMP(3),
    "status" "LongRunningTaskStatus" NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "currentStep" TEXT,
    "errorMessage" TEXT,
    "totalSteps" INTEGER NOT NULL DEFAULT 0,
    "completedSteps" INTEGER NOT NULL DEFAULT 0,
    "lastCheckpointAt" TIMESTAMP(3),
    "lastCheckpointSummary" TEXT,
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "completionBehavior" "TaskCompletionBehavior" NOT NULL DEFAULT 'NOTIFY_USER',
    "notifyOnProgress" BOOLEAN NOT NULL DEFAULT false,
    "progressIntervalMinutes" INTEGER NOT NULL DEFAULT 15,
    "context" JSONB NOT NULL DEFAULT '{}',
    "finalSummary" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "long_running_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_steps" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "action" TEXT NOT NULL,
    "params" JSONB NOT NULL DEFAULT '{}',
    "expectedDurationMinutes" INTEGER,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "status" "TaskStepStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "isCheckpoint" BOOLEAN NOT NULL DEFAULT false,
    "onError" TEXT NOT NULL DEFAULT 'abort',
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_logs" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "long_running_tasks_userId_idx" ON "long_running_tasks"("userId");

-- CreateIndex
CREATE INDEX "long_running_tasks_status_idx" ON "long_running_tasks"("status");

-- CreateIndex
CREATE INDEX "long_running_tasks_priority_idx" ON "long_running_tasks"("priority");

-- CreateIndex
CREATE INDEX "long_running_tasks_createdAt_idx" ON "long_running_tasks"("createdAt");

-- CreateIndex
CREATE INDEX "task_steps_taskId_idx" ON "task_steps"("taskId");

-- CreateIndex
CREATE INDEX "task_steps_status_idx" ON "task_steps"("status");

-- CreateIndex
CREATE UNIQUE INDEX "task_steps_taskId_stepOrder_key" ON "task_steps"("taskId", "stepOrder");

-- CreateIndex
CREATE INDEX "task_logs_taskId_idx" ON "task_logs"("taskId");

-- CreateIndex
CREATE INDEX "task_logs_createdAt_idx" ON "task_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "long_running_tasks" ADD CONSTRAINT "long_running_tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_steps" ADD CONSTRAINT "task_steps_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "long_running_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_logs" ADD CONSTRAINT "task_logs_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "long_running_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
