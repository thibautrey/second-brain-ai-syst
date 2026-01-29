-- CreateEnum
CREATE TYPE "MemoryType" AS ENUM ('SHORT_TERM', 'LONG_TERM');

-- CreateEnum
CREATE TYPE "TimeScale" AS ENUM ('DAILY', 'THREE_DAY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'SIX_MONTH', 'YEARLY', 'MULTI_YEAR');

-- CreateTable
CREATE TABLE "memories" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" "MemoryType" NOT NULL DEFAULT 'SHORT_TERM',
    "timeScale" "TimeScale",
    "sourceType" TEXT,
    "sourceId" TEXT,
    "interactionId" TEXT,
    "embeddingId" TEXT,
    "embedding" JSONB,
    "importanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "entities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "occurredAt" TIMESTAMP(3),
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "summaries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "title" TEXT,
    "timeScale" "TimeScale" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "sourceMemoryCount" INTEGER NOT NULL DEFAULT 0,
    "keyInsights" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "topics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sentiment" TEXT,
    "actionItems" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "embeddingId" TEXT,
    "embedding" JSONB,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_SourceMemories" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_SourceMemories_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "memories_userId_idx" ON "memories"("userId");

-- CreateIndex
CREATE INDEX "memories_type_idx" ON "memories"("type");

-- CreateIndex
CREATE INDEX "memories_timeScale_idx" ON "memories"("timeScale");

-- CreateIndex
CREATE INDEX "memories_importanceScore_idx" ON "memories"("importanceScore");

-- CreateIndex
CREATE INDEX "memories_isArchived_idx" ON "memories"("isArchived");

-- CreateIndex
CREATE INDEX "memories_createdAt_idx" ON "memories"("createdAt");

-- CreateIndex
CREATE INDEX "summaries_userId_idx" ON "summaries"("userId");

-- CreateIndex
CREATE INDEX "summaries_timeScale_idx" ON "summaries"("timeScale");

-- CreateIndex
CREATE INDEX "summaries_periodStart_periodEnd_idx" ON "summaries"("periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "_SourceMemories_B_index" ON "_SourceMemories"("B");

-- AddForeignKey
ALTER TABLE "memories" ADD CONSTRAINT "memories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "summaries" ADD CONSTRAINT "summaries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SourceMemories" ADD CONSTRAINT "_SourceMemories_A_fkey" FOREIGN KEY ("A") REFERENCES "memories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SourceMemories" ADD CONSTRAINT "_SourceMemories_B_fkey" FOREIGN KEY ("B") REFERENCES "summaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
