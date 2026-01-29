-- AlterTable
ALTER TABLE "ai_task_configs" ADD COLUMN     "fallbackModelId" TEXT,
ADD COLUMN     "fallbackProviderId" TEXT;

-- AddForeignKey
ALTER TABLE "ai_task_configs" ADD CONSTRAINT "ai_task_configs_fallbackProviderId_fkey" FOREIGN KEY ("fallbackProviderId") REFERENCES "ai_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_task_configs" ADD CONSTRAINT "ai_task_configs_fallbackModelId_fkey" FOREIGN KEY ("fallbackModelId") REFERENCES "ai_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;
