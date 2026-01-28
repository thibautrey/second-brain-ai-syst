-- Add missing columns to negative_examples
ALTER TABLE "negative_examples" ADD COLUMN "clusterId" TEXT;
ALTER TABLE "negative_examples" ADD COLUMN "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5;
ALTER TABLE "negative_examples" ADD COLUMN "sourceSessionId" TEXT;
ALTER TABLE "negative_examples" ADD COLUMN "externalPersonId" TEXT;

-- Update capturedAt to use CURRENT_TIMESTAMP as default
ALTER TABLE "negative_examples" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- Rename createdAt to capturedAt if needed, or add capturedAt
ALTER TABLE "negative_examples" RENAME COLUMN "createdAt" TO "capturedAt";

-- Drop columns that are no longer in schema
ALTER TABLE "negative_examples" DROP COLUMN IF EXISTS "similarityToProfile";
ALTER TABLE "negative_examples" DROP COLUMN IF EXISTS "label";

-- Create index for clusterId
CREATE INDEX "negative_examples_clusterId_idx" ON "negative_examples"("clusterId");
