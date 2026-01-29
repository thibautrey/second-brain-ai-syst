-- AlterTable - Add ChatGPT OAuth fields to AITaskConfig
ALTER TABLE "ai_task_configs" ADD COLUMN IF NOT EXISTS "useChatGPTOAuth" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ai_task_configs" ADD COLUMN IF NOT EXISTS "chatGPTOAuthModelId" TEXT;
ALTER TABLE "ai_task_configs" ADD COLUMN IF NOT EXISTS "useChatGPTOAuthFallback" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ai_task_configs" ADD COLUMN IF NOT EXISTS "chatGPTOAuthFallbackModelId" TEXT;
