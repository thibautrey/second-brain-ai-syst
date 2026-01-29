-- AlterTable: adaptive_samples - Update schema to match current Prisma schema

-- Drop existing constraints and indices
ALTER TABLE "adaptive_samples" DROP CONSTRAINT IF EXISTS "adaptive_samples_profileId_fkey";

-- Rename existing columns to preserve data where applicable
ALTER TABLE "adaptive_samples"
  RENAME COLUMN "profileId" TO "speakerProfileId";

-- Drop old columns we don't need anymore
ALTER TABLE "adaptive_samples"
  DROP COLUMN IF EXISTS "snr",
  DROP COLUMN IF EXISTS "clippingRatio";

-- Rename similarityScore to admissionSimilarity
ALTER TABLE "adaptive_samples"
  RENAME COLUMN "similarityScore" TO "admissionSimilarity";

-- Add new required columns
ALTER TABLE "adaptive_samples"
  ADD COLUMN "sourceType" TEXT NOT NULL DEFAULT 'continuous_listening',
  ADD COLUMN "sourceSessionId" TEXT,
  ADD COLUMN "durationSeconds" DOUBLE PRECISION,
  ADD COLUMN "crossValidationScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  ADD COLUMN "contributionWeight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  ADD COLUMN "decayFactor" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  ADD COLUMN "lastUsedInCentroid" TIMESTAMP(3),
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "admittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Update durationSeconds from duration column if it exists
UPDATE "adaptive_samples" SET "durationSeconds" = "duration" WHERE "durationSeconds" IS NULL AND "duration" IS NOT NULL;

-- Drop duration column if it exists (keep temporarily if needed for data migration)
ALTER TABLE "adaptive_samples" DROP COLUMN IF EXISTS "duration";

-- Drop weight column if it exists (replaced by contributionWeight)
ALTER TABLE "adaptive_samples" DROP COLUMN IF EXISTS "weight";

-- Drop usedInUpdate column if it exists
ALTER TABLE "adaptive_samples" DROP COLUMN IF EXISTS "usedInUpdate";

-- Drop and recreate createdAt if needed
-- (Already exists, so we'll leave it)

-- Rename createdAt to admittedAt if not done already
-- (Done via ADD COLUMN with DEFAULT, so remove old createdAt if different)
ALTER TABLE "adaptive_samples"
  DROP COLUMN IF EXISTS "createdAt";

-- Drop and recreate indices
DROP INDEX IF EXISTS "adaptive_samples_profileId_idx";
DROP INDEX IF EXISTS "adaptive_samples_createdAt_idx";

CREATE INDEX "adaptive_samples_speakerProfileId_idx" ON "adaptive_samples"("speakerProfileId");
CREATE INDEX "adaptive_samples_admittedAt_idx" ON "adaptive_samples"("admittedAt");
CREATE INDEX "adaptive_samples_isActive_idx" ON "adaptive_samples"("isActive");

-- Recreate foreign key with new column name
ALTER TABLE "adaptive_samples"
  ADD CONSTRAINT "adaptive_samples_speakerProfileId_fkey"
  FOREIGN KEY ("speakerProfileId") REFERENCES "speaker_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
