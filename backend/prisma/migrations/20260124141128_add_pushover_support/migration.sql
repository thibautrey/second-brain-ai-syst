-- AlterTable
ALTER TABLE "user_settings" ADD COLUMN "pushoverApiToken" TEXT,
ADD COLUMN "pushoverUserKey" TEXT;

-- AlterEnum
ALTER TYPE "NotificationChannel" ADD VALUE 'PUSHOVER';
