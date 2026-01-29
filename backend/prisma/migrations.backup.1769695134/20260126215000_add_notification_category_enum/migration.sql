-- CreateEnum NotificationCategory
CREATE TYPE "public"."NotificationCategory" AS ENUM (
  'HEALTH',
  'MENTAL',
  'PRODUCTIVITY',
  'GOALS',
  'HABITS',
  'RELATIONSHIPS',
  'LEARNING',
  'FINANCIAL',
  'SYSTEM',
  'GENERAL'
);

-- AlterTable notification_topic_trackers - change category column type from TEXT to enum
ALTER TABLE "notification_topic_trackers"
ALTER COLUMN "category" DROP DEFAULT;

ALTER TABLE "notification_topic_trackers"
ALTER COLUMN "category" TYPE "public"."NotificationCategory" USING "category"::"public"."NotificationCategory";

ALTER TABLE "notification_topic_trackers"
ALTER COLUMN "category" SET DEFAULT 'GENERAL'::"public"."NotificationCategory";

