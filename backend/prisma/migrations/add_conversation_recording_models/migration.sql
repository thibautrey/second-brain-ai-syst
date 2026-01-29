-- CreateEnum for RecordingStatus
CREATE TYPE "RecordingStatus" AS ENUM ('RECORDING', 'PAUSED', 'COMPLETED', 'PROCESSING', 'ARCHIVED', 'DELETED');

-- CreateEnum for TranscriptionStatus
CREATE TYPE "TranscriptionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'PARTIAL');

-- CreateTable ConversationRecording
CREATE TABLE "conversation_recordings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "conversationId" TEXT NOT NULL,
    "status" "RecordingStatus" NOT NULL DEFAULT 'RECORDING',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "totalDurationSeconds" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "audioChunkCount" INTEGER NOT NULL DEFAULT 0,
    "totalAudioSizeBytes" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "stoppedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "transcriptionStatus" "TranscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "fullTranscript" TEXT,
    "summaryShort" TEXT,
    "summaryLong" TEXT,
    "keyPoints" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "topics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sentiment" TEXT,
    "emotions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_recordings_pkey" PRIMARY KEY ("id")
);

-- CreateTable ConversationParticipant
CREATE TABLE "conversation_participants" (
    "id" TEXT NOT NULL,
    "recordingId" TEXT NOT NULL,
    "speakerId" TEXT NOT NULL,
    "speakerName" TEXT,
    "speakerRole" TEXT,
    "isMainSpeaker" BOOLEAN NOT NULL DEFAULT false,
    "voiceEmbedding" JSONB,
    "speakTimeSeconds" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "turnCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable ConversationAudioSegment
CREATE TABLE "conversation_audio_segments" (
    "id" TEXT NOT NULL,
    "recordingId" TEXT NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "startTimeMs" DOUBLE PRECISION NOT NULL,
    "endTimeMs" DOUBLE PRECISION NOT NULL,
    "durationMs" DOUBLE PRECISION NOT NULL,
    "audioData" BYTEA NOT NULL,
    "audioCodec" TEXT NOT NULL DEFAULT 'aac',
    "sampleRate" INTEGER NOT NULL DEFAULT 16000,
    "isProcessed" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_audio_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable TranscriptionSegment
CREATE TABLE "transcription_segments" (
    "id" TEXT NOT NULL,
    "recordingId" TEXT NOT NULL,
    "startTimeMs" DOUBLE PRECISION NOT NULL,
    "endTimeMs" DOUBLE PRECISION NOT NULL,
    "transcript" TEXT NOT NULL,
    "speakerId" TEXT,
    "confidence" DOUBLE PRECISION,
    "language" TEXT DEFAULT 'en',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transcription_segments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "conversation_recordings_conversationId_key" ON "conversation_recordings"("conversationId");

-- CreateIndex
CREATE INDEX "conversation_recordings_userId_idx" ON "conversation_recordings"("userId");

-- CreateIndex
CREATE INDEX "conversation_recordings_conversationId_idx" ON "conversation_recordings"("conversationId");

-- CreateIndex
CREATE INDEX "conversation_recordings_status_idx" ON "conversation_recordings"("status");

-- CreateIndex
CREATE INDEX "conversation_recordings_isActive_idx" ON "conversation_recordings"("isActive");

-- CreateIndex
CREATE INDEX "conversation_recordings_startedAt_idx" ON "conversation_recordings"("startedAt");

-- CreateIndex
CREATE INDEX "conversation_recordings_createdAt_idx" ON "conversation_recordings"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_participants_recordingId_speakerId_key" ON "conversation_participants"("recordingId", "speakerId");

-- CreateIndex
CREATE INDEX "conversation_participants_recordingId_idx" ON "conversation_participants"("recordingId");

-- CreateIndex
CREATE INDEX "conversation_audio_segments_recordingId_idx" ON "conversation_audio_segments"("recordingId");

-- CreateIndex
CREATE INDEX "conversation_audio_segments_sequenceNumber_idx" ON "conversation_audio_segments"("sequenceNumber");

-- CreateIndex
CREATE INDEX "transcription_segments_recordingId_idx" ON "transcription_segments"("recordingId");

-- CreateIndex
CREATE INDEX "transcription_segments_speakerId_idx" ON "transcription_segments"("speakerId");

-- AddForeignKey
ALTER TABLE "conversation_recordings" ADD CONSTRAINT "conversation_recordings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "conversation_recordings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_audio_segments" ADD CONSTRAINT "conversation_audio_segments_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "conversation_recordings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcription_segments" ADD CONSTRAINT "transcription_segments_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "conversation_recordings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable _ConversationMemories (for many-to-many relationship)
CREATE TABLE "_ConversationMemories" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_ConversationMemories_AB_unique" UNIQUE("A", "B")
);

-- CreateIndex
CREATE INDEX "_ConversationMemories_B_index" ON "_ConversationMemories"("B");

-- AddForeignKey
ALTER TABLE "_ConversationMemories" ADD CONSTRAINT "_ConversationMemories_A_fkey" FOREIGN KEY ("A") REFERENCES "conversation_recordings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ConversationMemories" ADD CONSTRAINT "_ConversationMemories_B_fkey" FOREIGN KEY ("B") REFERENCES "memories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
