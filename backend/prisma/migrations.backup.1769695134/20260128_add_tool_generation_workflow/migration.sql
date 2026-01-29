-- CreateEnum
CREATE TYPE "GenerationSessionStatus" AS ENUM ('PENDING', 'SPECIFICATION', 'PLANNING', 'IMPLEMENTING', 'TESTING', 'FIXING', 'VALIDATING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "HealthReportStatus" AS ENUM ('HEALTHY', 'DEGRADED', 'FAILING', 'HEALING', 'HEALED', 'REQUIRES_ATTENTION');

-- CreateTable
CREATE TABLE "tool_generation_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "toolId" TEXT,
    "objective" TEXT NOT NULL,
    "context" TEXT,
    "suggestedSecrets" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "GenerationSessionStatus" NOT NULL DEFAULT 'PENDING',
    "currentPhase" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "specDocument" TEXT,
    "implementationPlan" TEXT,
    "generatedCode" TEXT,
    "testCode" TEXT,
    "testResults" JSONB,
    "schemaJson" JSONB,
    "currentIteration" INTEGER NOT NULL DEFAULT 0,
    "maxIterations" INTEGER NOT NULL DEFAULT 5,
    "lastError" TEXT,
    "errorHistory" JSONB NOT NULL DEFAULT '[]',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "totalDurationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tool_generation_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tool_generation_logs" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "step" TEXT,
    "level" TEXT NOT NULL DEFAULT 'info',
    "message" TEXT NOT NULL,
    "promptSent" TEXT,
    "responseReceived" TEXT,
    "modelUsed" TEXT,
    "tokensUsed" INTEGER,
    "codeExecuted" TEXT,
    "executionResult" JSONB,
    "executionTimeMs" INTEGER,
    "metadata" JSONB,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tool_generation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tool_health_reports" (
    "id" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "status" "HealthReportStatus" NOT NULL DEFAULT 'HEALTHY',
    "healthScore" INTEGER NOT NULL DEFAULT 100,
    "issuesDetected" JSONB NOT NULL DEFAULT '[]',
    "errorPatterns" JSONB,
    "suggestedFixes" JSONB,
    "rootCauseAnalysis" TEXT,
    "healingAttempted" BOOLEAN NOT NULL DEFAULT false,
    "healingSuccess" BOOLEAN,
    "healedCode" TEXT,
    "healingLog" JSONB,
    "recentSuccessRate" DOUBLE PRECISION,
    "recentErrorCount" INTEGER NOT NULL DEFAULT 0,
    "recentUsageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tool_health_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tool_execution_logs" (
    "id" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "inputParams" JSONB,
    "success" BOOLEAN NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "errorType" TEXT,
    "executionTimeMs" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "triggeredBy" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tool_execution_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tool_generation_sessions_userId_idx" ON "tool_generation_sessions"("userId");

-- CreateIndex
CREATE INDEX "tool_generation_sessions_status_idx" ON "tool_generation_sessions"("status");

-- CreateIndex
CREATE INDEX "tool_generation_sessions_toolId_idx" ON "tool_generation_sessions"("toolId");

-- CreateIndex
CREATE INDEX "tool_generation_logs_sessionId_idx" ON "tool_generation_logs"("sessionId");

-- CreateIndex
CREATE INDEX "tool_generation_logs_phase_idx" ON "tool_generation_logs"("phase");

-- CreateIndex
CREATE INDEX "tool_generation_logs_level_idx" ON "tool_generation_logs"("level");

-- CreateIndex
CREATE INDEX "tool_health_reports_toolId_idx" ON "tool_health_reports"("toolId");

-- CreateIndex
CREATE INDEX "tool_health_reports_status_idx" ON "tool_health_reports"("status");

-- CreateIndex
CREATE INDEX "tool_health_reports_healthScore_idx" ON "tool_health_reports"("healthScore");

-- CreateIndex
CREATE INDEX "tool_execution_logs_toolId_idx" ON "tool_execution_logs"("toolId");

-- CreateIndex
CREATE INDEX "tool_execution_logs_userId_idx" ON "tool_execution_logs"("userId");

-- CreateIndex
CREATE INDEX "tool_execution_logs_success_idx" ON "tool_execution_logs"("success");

-- CreateIndex
CREATE INDEX "tool_execution_logs_createdAt_idx" ON "tool_execution_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "tool_generation_sessions" ADD CONSTRAINT "tool_generation_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_generation_sessions" ADD CONSTRAINT "tool_generation_sessions_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "generated_tools"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_generation_logs" ADD CONSTRAINT "tool_generation_logs_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "tool_generation_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_health_reports" ADD CONSTRAINT "tool_health_reports_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "generated_tools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_execution_logs" ADD CONSTRAINT "tool_execution_logs_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "generated_tools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
