-- AlterTable
ALTER TABLE "user_settings" ADD COLUMN "telegramBotToken" TEXT,
ADD COLUMN "telegramChatId" TEXT,
ADD COLUMN "telegramEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterEnum
ALTER TYPE "NotificationChannel" ADD VALUE 'TELEGRAM';
