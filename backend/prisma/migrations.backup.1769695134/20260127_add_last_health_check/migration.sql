-- Add lastHealthCheck column to speaker_profiles
ALTER TABLE "speaker_profiles" ADD COLUMN "lastHealthCheck" TIMESTAMP(3);
