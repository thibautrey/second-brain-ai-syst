-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_inputs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "originalContent" BYTEA,
    "speakerId" TEXT NOT NULL,
    "speakerConfidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "speakerMethod" TEXT NOT NULL DEFAULT 'assumed',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "durationSeconds" DOUBLE PRECISION,
    "processingTimeMs" INTEGER NOT NULL,
    "error" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "processed_inputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "speaker_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "speakerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enrollmentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modelVersion" TEXT NOT NULL,
    "centroidEmbedding" TEXT NOT NULL,
    "confidenceMean" DOUBLE PRECISION NOT NULL,
    "confidenceStd" DOUBLE PRECISION NOT NULL,
    "confidenceMin" DOUBLE PRECISION NOT NULL,
    "confidenceMax" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "speaker_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "speaker_embeddings" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "embedding" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "speaker_embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audio_stream_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "inputId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "totalChunks" INTEGER NOT NULL DEFAULT 0,
    "totalDurationSeconds" DOUBLE PRECISION,
    "finalTranscription" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audio_stream_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audio_batches" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "inputId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "chunkSize" INTEGER NOT NULL,
    "isFinal" BOOLEAN NOT NULL DEFAULT false,
    "transcodedContent" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audio_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "input_processing_metrics" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "inputFormat" TEXT NOT NULL,
    "processingTimeMs" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "errorType" TEXT,
    "speakerIdentified" BOOLEAN NOT NULL DEFAULT false,
    "speakerConfidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "input_processing_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_integrations" (
    "id" TEXT NOT NULL,
    "inputId" TEXT NOT NULL,
    "memoryId" TEXT NOT NULL,
    "integrated" BOOLEAN NOT NULL DEFAULT false,
    "integratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memory_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "processed_inputs_userId_idx" ON "processed_inputs"("userId");

-- CreateIndex
CREATE INDEX "processed_inputs_status_idx" ON "processed_inputs"("status");

-- CreateIndex
CREATE INDEX "processed_inputs_createdAt_idx" ON "processed_inputs"("createdAt");

-- CreateIndex
CREATE INDEX "speaker_profiles_userId_idx" ON "speaker_profiles"("userId");

-- CreateIndex
CREATE INDEX "speaker_profiles_active_idx" ON "speaker_profiles"("active");

-- CreateIndex
CREATE UNIQUE INDEX "speaker_profiles_userId_speakerId_key" ON "speaker_profiles"("userId", "speakerId");

-- CreateIndex
CREATE INDEX "speaker_embeddings_profileId_idx" ON "speaker_embeddings"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "audio_stream_sessions_sessionId_key" ON "audio_stream_sessions"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "audio_stream_sessions_inputId_key" ON "audio_stream_sessions"("inputId");

-- CreateIndex
CREATE INDEX "audio_stream_sessions_userId_idx" ON "audio_stream_sessions"("userId");

-- CreateIndex
CREATE INDEX "audio_stream_sessions_status_idx" ON "audio_stream_sessions"("status");

-- CreateIndex
CREATE INDEX "audio_batches_userId_idx" ON "audio_batches"("userId");

-- CreateIndex
CREATE INDEX "audio_batches_batchId_idx" ON "audio_batches"("batchId");

-- CreateIndex
CREATE INDEX "audio_batches_status_idx" ON "audio_batches"("status");

-- CreateIndex
CREATE INDEX "input_processing_metrics_userId_idx" ON "input_processing_metrics"("userId");

-- CreateIndex
CREATE INDEX "input_processing_metrics_createdAt_idx" ON "input_processing_metrics"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "memory_integrations_inputId_key" ON "memory_integrations"("inputId");

-- CreateIndex
CREATE INDEX "memory_integrations_inputId_idx" ON "memory_integrations"("inputId");

-- AddForeignKey
ALTER TABLE "processed_inputs" ADD CONSTRAINT "processed_inputs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speaker_profiles" ADD CONSTRAINT "speaker_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speaker_embeddings" ADD CONSTRAINT "speaker_embeddings_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "speaker_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audio_stream_sessions" ADD CONSTRAINT "audio_stream_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audio_stream_sessions" ADD CONSTRAINT "audio_stream_sessions_inputId_fkey" FOREIGN KEY ("inputId") REFERENCES "processed_inputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audio_batches" ADD CONSTRAINT "audio_batches_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audio_batches" ADD CONSTRAINT "audio_batches_inputId_fkey" FOREIGN KEY ("inputId") REFERENCES "processed_inputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "input_processing_metrics" ADD CONSTRAINT "input_processing_metrics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_integrations" ADD CONSTRAINT "memory_integrations_inputId_fkey" FOREIGN KEY ("inputId") REFERENCES "processed_inputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
