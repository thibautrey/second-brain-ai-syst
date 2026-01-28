-- Fix negative_examples embedding column type from JSONB to FLOAT8 array
-- Drop and recreate the column with the correct type
ALTER TABLE "negative_examples" DROP COLUMN "embedding";
ALTER TABLE "negative_examples" ADD COLUMN "embedding" FLOAT8[] NOT NULL DEFAULT ARRAY[]::FLOAT8[];
