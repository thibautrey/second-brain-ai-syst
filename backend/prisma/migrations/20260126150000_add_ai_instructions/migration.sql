-- CreateEnum
CREATE TYPE "AIInstructionCategory" AS ENUM ('DATA_COHERENCE', 'USER_PATTERN', 'USER_PREFERENCE', 'TASK_OPTIMIZATION', 'GOAL_TRACKING', 'HEALTH_INSIGHT', 'COMMUNICATION_STYLE', 'SCHEDULING', 'SYSTEM_IMPROVEMENT', 'OTHER');

-- CreateTable
CREATE TABLE "ai_instructions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "title" TEXT,
    "category" "AIInstructionCategory" NOT NULL,
    "sourceAgent" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "relatedGoalIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "relatedTodoIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "relatedMemoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_instructions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_instructions_userId_idx" ON "ai_instructions"("userId");

-- CreateIndex
CREATE INDEX "ai_instructions_category_idx" ON "ai_instructions"("category");

-- CreateIndex
CREATE INDEX "ai_instructions_sourceAgent_idx" ON "ai_instructions"("sourceAgent");

-- CreateIndex
CREATE INDEX "ai_instructions_isActive_idx" ON "ai_instructions"("isActive");

-- CreateIndex
CREATE INDEX "ai_instructions_priority_idx" ON "ai_instructions"("priority");

-- CreateIndex
CREATE INDEX "ai_instructions_createdAt_idx" ON "ai_instructions"("createdAt");

-- AddForeignKey
ALTER TABLE "ai_instructions" ADD CONSTRAINT "ai_instructions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
