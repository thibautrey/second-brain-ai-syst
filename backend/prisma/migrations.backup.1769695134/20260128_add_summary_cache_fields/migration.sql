-- Add cache tracking fields to Summary model
-- Purpose: Avoid calling LLM repeatedly for summaries that change infrequently
-- Cache strategy:
-- - WEEKLY: cache for 24 hours (default tab, data changes once a day)
-- - DAILY: cache for 2 hours
-- - Longer periods: cache for proportionally longer times

ALTER TABLE "summaries" ADD COLUMN "lastLlmGenerationAt" TIMESTAMP(3);
ALTER TABLE "summaries" ADD COLUMN "cacheValidUntil" TIMESTAMP(3);
ALTER TABLE "summaries" ADD COLUMN "isCached" BOOLEAN NOT NULL DEFAULT false;

-- Create index for cache lookup optimization
CREATE INDEX "summaries_isCached_cacheValidUntil_idx" ON "summaries"("isCached", "cacheValidUntil");
