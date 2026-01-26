-- CreateEnum
CREATE TYPE "TopicStatus" AS ENUM ('ACTIVE', 'COOLDOWN', 'ABANDONED', 'RESOLVED');

-- CreateTable
CREATE TABLE "NotificationTopicTracker" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topicHash" TEXT NOT NULL,
    "topicCategory" TEXT NOT NULL,
    "topicSummary" TEXT NOT NULL,
    "representativeContent" TEXT NOT NULL,
    "status" "TopicStatus" NOT NULL DEFAULT 'ACTIVE',
    "attemptCount" INTEGER NOT NULL DEFAULT 1,
    "lastAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextAllowedAt" TIMESTAMP(3),
    "userRespondedAt" TIMESTAMP(3),
    "abandonedAt" TIMESTAMP(3),
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationTopicTracker_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificationTopicTracker_userId_idx" ON "NotificationTopicTracker"("userId");

-- CreateIndex
CREATE INDEX "NotificationTopicTracker_topicHash_idx" ON "NotificationTopicTracker"("topicHash");

-- CreateIndex
CREATE INDEX "NotificationTopicTracker_status_idx" ON "NotificationTopicTracker"("status");

-- CreateIndex
CREATE INDEX "NotificationTopicTracker_userId_status_idx" ON "NotificationTopicTracker"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationTopicTracker_userId_topicHash_key" ON "NotificationTopicTracker"("userId", "topicHash");

-- AddForeignKey
ALTER TABLE "NotificationTopicTracker" ADD CONSTRAINT "NotificationTopicTracker_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
