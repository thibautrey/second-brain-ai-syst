-- Add autoRespondToQuestions setting to UserSettings
-- When enabled, the system will respond to questions detected in continuous listening
-- without requiring a wake word

ALTER TABLE "user_settings" ADD COLUMN "autoRespondToQuestions" BOOLEAN NOT NULL DEFAULT true;
