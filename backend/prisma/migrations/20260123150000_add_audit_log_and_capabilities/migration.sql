-- Add new ModelCapability enum values
ALTER TYPE "ModelCapability" ADD VALUE IF NOT EXISTS 'CHAT';
ALTER TYPE "ModelCapability" ADD VALUE IF NOT EXISTS 'SUMMARIZATION';
ALTER TYPE "ModelCapability" ADD VALUE IF NOT EXISTS 'ANALYSIS';

-- CreateTable: AuditLog
CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_logs_userId_idx" ON "audit_logs"("userId");
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX IF NOT EXISTS "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");
