-- AlterTable
ALTER TABLE "user_settings" ADD COLUMN "metadata" JSONB NOT NULL DEFAULT '{}';
