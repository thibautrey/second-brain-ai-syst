-- CreateEnum FactCheckStatus
CREATE TYPE "FactCheckStatus" AS ENUM (
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'FAILED',
  'PARTIAL'
);

-- CreateTable fact_check_results
CREATE TABLE "fact_check_results" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "originalAnswer" TEXT NOT NULL,
    "claimsIdentified" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "claimsAnalyzed" INTEGER NOT NULL DEFAULT 0,
    "status" "FactCheckStatus" NOT NULL DEFAULT 'PENDING',
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "overallAccuracy" TEXT,
    "needsCorrection" BOOLEAN NOT NULL DEFAULT false,
    "correctionNeeded" TEXT,
    "suggestedCorrection" TEXT,
    "verificationMethod" TEXT,
    "sources" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "verificationNotes" TEXT,
    "notificationId" TEXT,
    "correctionSent" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "fact_check_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable correction_notifications
CREATE TABLE "correction_notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "factCheckId" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "correction" TEXT NOT NULL,
    "originalClaim" TEXT,
    "notificationId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "isDismissed" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "correction_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fact_check_results_userId_idx" ON "fact_check_results"("userId");
CREATE INDEX "fact_check_results_status_idx" ON "fact_check_results"("status");
CREATE INDEX "fact_check_results_conversationId_idx" ON "fact_check_results"("conversationId");
CREATE INDEX "fact_check_results_needsCorrection_idx" ON "fact_check_results"("needsCorrection");
CREATE INDEX "fact_check_results_createdAt_idx" ON "fact_check_results"("createdAt");

CREATE INDEX "correction_notifications_userId_idx" ON "correction_notifications"("userId");
CREATE INDEX "correction_notifications_factCheckId_idx" ON "correction_notifications"("factCheckId");
CREATE INDEX "correction_notifications_isRead_idx" ON "correction_notifications"("isRead");
CREATE INDEX "correction_notifications_createdAt_idx" ON "correction_notifications"("createdAt");

-- AddForeignKey
ALTER TABLE "fact_check_results" ADD CONSTRAINT "fact_check_results_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "correction_notifications" ADD CONSTRAINT "correction_notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "correction_notifications" ADD CONSTRAINT "correction_notifications_factCheckId_fkey" FOREIGN KEY ("factCheckId") REFERENCES "fact_check_results"("id") ON DELETE SET NULL ON UPDATE CASCADE;
