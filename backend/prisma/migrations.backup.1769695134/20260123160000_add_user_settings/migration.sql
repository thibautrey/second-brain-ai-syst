-- CreateTable: UserSettings
CREATE TABLE IF NOT EXISTS "user_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "continuousListeningEnabled" BOOLEAN NOT NULL DEFAULT false,
    "wakeWord" TEXT NOT NULL DEFAULT 'Hey Brain',
    "wakeWordSensitivity" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "minImportanceThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "silenceDetectionMs" INTEGER NOT NULL DEFAULT 1500,
    "vadSensitivity" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "speakerConfidenceThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "autoDeleteAudioAfterProcess" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnMemoryStored" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnCommandDetected" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: userId unique
CREATE UNIQUE INDEX IF NOT EXISTS "user_settings_userId_key" ON "user_settings"("userId");

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
