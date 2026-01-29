-- CreateTable notification_topic_trackers
CREATE TABLE "notification_topic_trackers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "lastContentHash" TEXT NOT NULL,
    "sampleMessages" TEXT[] DEFAULT '{}',
    "attemptCount" INTEGER NOT NULL DEFAULT 1,
    "cooldownMinutes" INTEGER NOT NULL DEFAULT 60,
    "nextAllowedAt" TIMESTAMP(3) NOT NULL,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "isGivenUp" BOOLEAN NOT NULL DEFAULT false,
    "lastUserResponse" TIMESTAMP(3),
    "responseCount" INTEGER NOT NULL DEFAULT 0,
    "totalSent" INTEGER NOT NULL DEFAULT 1,
    "totalBlocked" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_topic_trackers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_topic_trackers_userId_idx" ON "notification_topic_trackers"("userId");

-- CreateIndex
CREATE INDEX "notification_topic_trackers_topic_idx" ON "notification_topic_trackers"("topic");

-- CreateIndex
CREATE INDEX "notification_topic_trackers_category_idx" ON "notification_topic_trackers"("category");

-- CreateIndex
CREATE INDEX "notification_topic_trackers_userId_category_idx" ON "notification_topic_trackers"("userId", "category");

-- CreateIndex unique constraint on userId + topic
CREATE UNIQUE INDEX "notification_topic_trackers_userId_topic_key" ON "notification_topic_trackers"("userId", "topic");

-- AddForeignKey
ALTER TABLE "notification_topic_trackers" ADD CONSTRAINT "notification_topic_trackers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddColumn to notifications table if not exists
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "topicTrackerId" TEXT;

-- AddIndex on notifications.topicTrackerId
CREATE INDEX IF NOT EXISTS "notifications_topicTrackerId_idx" ON "notifications"("topicTrackerId");

-- AddForeignKey from notifications to notification_topic_trackers (use DO block since IF NOT EXISTS not supported for constraints)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'notifications_topicTrackerId_fkey'
    ) THEN
        ALTER TABLE "notifications" ADD CONSTRAINT "notifications_topicTrackerId_fkey" 
        FOREIGN KEY ("topicTrackerId") REFERENCES "notification_topic_trackers"("id") 
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
