-- Add language field to voice_samples table
ALTER TABLE "voice_samples" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'en';

-- Add index for language queries
CREATE INDEX "voice_samples_language_idx" ON "voice_samples"("language");
