-- Add Noise Filtering Settings to UserSettings
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "noiseFilterEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "noiseFilterSensitivity" DOUBLE PRECISION NOT NULL DEFAULT 0.7;
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "filterMediaPlayback" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "filterBackgroundConvo" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "filterTrivialSelfTalk" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "filterThirdPartyAddress" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "askConfirmationOnAmbiguous" BOOLEAN NOT NULL DEFAULT false;
