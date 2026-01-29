-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('BROWSER', 'MOBILE_APP', 'WEARABLE', 'IOT', 'DESKTOP_APP', 'OTHER');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('CONNECTING', 'ACTIVE', 'PAUSED', 'RESUMING', 'COMPLETING', 'COMPLETED', 'ERROR', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "ConnectionProtocol" AS ENUM ('WEBSOCKET', 'SSE', 'HTTP_POLLING', 'HTTP_STREAMING');

-- CreateEnum
CREATE TYPE "ChunkStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'ERROR', 'SKIPPED');

-- CreateTable
CREATE TABLE "audio_devices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceType" "DeviceType" NOT NULL,
    "deviceName" TEXT,
    "deviceToken" TEXT NOT NULL,
    "userAgent" TEXT,
    "capabilities" JSONB NOT NULL DEFAULT '{}',
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastProtocol" TEXT,
    "lastIpAddress" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audio_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "universal_audio_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'CONNECTING',
    "protocol" "ConnectionProtocol" NOT NULL DEFAULT 'WEBSOCKET',
    "fallbackCount" INTEGER NOT NULL DEFAULT 0,
    "audioFormat" JSONB NOT NULL DEFAULT '{}',
    "chunksReceived" INTEGER NOT NULL DEFAULT 0,
    "bytesReceived" INTEGER NOT NULL DEFAULT 0,
    "lastChunkSeq" INTEGER NOT NULL DEFAULT 0,
    "missingChunks" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "lastChunkAt" TIMESTAMP(3),
    "pendingEvents" JSONB[] DEFAULT ARRAY[]::JSONB[],
    "lastEventId" INTEGER NOT NULL DEFAULT 0,
    "lastEventDelivery" TIMESTAMP(3),
    "totalTranscripts" INTEGER NOT NULL DEFAULT 0,
    "totalDuration" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "lastErrorAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resumedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "universal_audio_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audio_chunks" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "isFinal" BOOLEAN NOT NULL DEFAULT false,
    "audioData" BYTEA NOT NULL,
    "audioFormat" TEXT NOT NULL,
    "sampleRate" INTEGER NOT NULL DEFAULT 16000,
    "durationMs" INTEGER NOT NULL,
    "bytesReceived" INTEGER NOT NULL,
    "status" "ChunkStatus" NOT NULL DEFAULT 'RECEIVED',
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "transcript" TEXT,
    "vadDetected" BOOLEAN,
    "speakerId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audio_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "audio_devices_deviceToken_key" ON "audio_devices"("deviceToken");

-- CreateIndex
CREATE INDEX "audio_devices_userId_idx" ON "audio_devices"("userId");

-- CreateIndex
CREATE INDEX "audio_devices_deviceToken_idx" ON "audio_devices"("deviceToken");

-- CreateIndex
CREATE INDEX "audio_devices_isActive_idx" ON "audio_devices"("isActive");

-- CreateIndex
CREATE INDEX "universal_audio_sessions_userId_idx" ON "universal_audio_sessions"("userId");

-- CreateIndex
CREATE INDEX "universal_audio_sessions_deviceId_idx" ON "universal_audio_sessions"("deviceId");

-- CreateIndex
CREATE INDEX "universal_audio_sessions_status_idx" ON "universal_audio_sessions"("status");

-- CreateIndex
CREATE INDEX "universal_audio_sessions_startedAt_idx" ON "universal_audio_sessions"("startedAt");

-- CreateIndex
CREATE INDEX "audio_chunks_sessionId_idx" ON "audio_chunks"("sessionId");

-- CreateIndex
CREATE INDEX "audio_chunks_status_idx" ON "audio_chunks"("status");

-- CreateIndex
CREATE UNIQUE INDEX "audio_chunks_sessionId_sequence_key" ON "audio_chunks"("sessionId", "sequence");

-- AddForeignKey
ALTER TABLE "audio_devices" ADD CONSTRAINT "audio_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "universal_audio_sessions" ADD CONSTRAINT "universal_audio_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "universal_audio_sessions" ADD CONSTRAINT "universal_audio_sessions_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "audio_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audio_chunks" ADD CONSTRAINT "audio_chunks_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "universal_audio_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
