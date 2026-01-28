-- Add audio storage fields to adaptive_samples table
ALTER TABLE "adaptive_samples" ADD COLUMN "audioData" BYTEA;
ALTER TABLE "adaptive_samples" ADD COLUMN "audioMimeType" TEXT;

-- Add audio storage fields to negative_examples table
ALTER TABLE "negative_examples" ADD COLUMN "audioData" BYTEA;
ALTER TABLE "negative_examples" ADD COLUMN "audioMimeType" TEXT;
ALTER TABLE "negative_examples" ADD COLUMN "durationSeconds" DOUBLE PRECISION;

-- Create index on admittedAt for easier cleanup of old records
CREATE INDEX "adaptive_samples_admittedAt_idx" ON "adaptive_samples"("admittedAt");
CREATE INDEX "negative_examples_capturedAt_idx" ON "negative_examples"("capturedAt");
