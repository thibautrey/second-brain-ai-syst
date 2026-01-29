-- CreateTable ToolErrorLog
CREATE TABLE "tool_error_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "toolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT,
    "errorMessage" TEXT NOT NULL,
    "errorStack" TEXT,
    "errorType" TEXT,
    "errorCode" TEXT,
    "category" TEXT,
    "severity" TEXT,
    "isRecoverable" BOOLEAN NOT NULL DEFAULT false,
    "suggestedRecovery" TEXT,
    "requestParams" TEXT,
    "requestSize" INTEGER,
    "partialResult" TEXT,
    "responseSize" INTEGER,
    "startedAt" TIMESTAMP NOT NULL,
    "endedAt" TIMESTAMP NOT NULL,
    "executionTimeMs" INTEGER NOT NULL,
    "flowId" TEXT,
    "sessionId" TEXT,
    "iterationCount" INTEGER,
    "relatedToolId" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "tool_error_logs_toolId_idx" ON "tool_error_logs"("toolId");

-- CreateIndex
CREATE INDEX "tool_error_logs_userId_idx" ON "tool_error_logs"("userId");

-- CreateIndex
CREATE INDEX "tool_error_logs_category_idx" ON "tool_error_logs"("category");

-- CreateIndex
CREATE INDEX "tool_error_logs_severity_idx" ON "tool_error_logs"("severity");

-- CreateIndex
CREATE INDEX "tool_error_logs_isRecoverable_idx" ON "tool_error_logs"("isRecoverable");

-- CreateIndex
CREATE INDEX "tool_error_logs_createdAt_idx" ON "tool_error_logs"("createdAt");
