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
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "audioStreamId" TEXT,

    CONSTRAINT "processed_inputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "speaker_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "voiceCharacteristics" JSONB NOT NULL DEFAULT '{}',
    "identificationMethod" TEXT NOT NULL DEFAULT 'manual',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "centroidEmbedding" JSONB,
    "embeddingModel" TEXT NOT NULL DEFAULT 'ecapa-tdnn',
    "embeddingVersion" TEXT NOT NULL DEFAULT '1.0',
    "isEnrolled" BOOLEAN NOT NULL DEFAULT false,
    "enrollmentDate" TIMESTAMP(3),
    "lastTrainingDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "speaker_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_samples" (
    "id" TEXT NOT NULL,
    "speakerProfileId" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'audio/wav',
    "fileSizeBytes" INTEGER NOT NULL,
    "durationSeconds" DOUBLE PRECISION NOT NULL,
    "phraseText" TEXT,
    "phraseCategory" TEXT,
    "embedding" JSONB,
    "embeddingModel" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_samples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_sessions" (
    "id" TEXT NOT NULL,
    "speakerProfileId" TEXT NOT NULL,
    "modelType" TEXT NOT NULL DEFAULT 'ecapa-tdnn',
    "sampleCount" INTEGER NOT NULL,
    "totalDuration" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currentStep" TEXT,
    "errorMessage" TEXT,
    "centroidEmbedding" JSONB,
    "confidenceScore" DOUBLE PRECISION,
    "intraClassVariance" DOUBLE PRECISION,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audio_stream_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionName" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'wav',
    "sampleRate" INTEGER NOT NULL DEFAULT 16000,
    "channelCount" INTEGER NOT NULL DEFAULT 1,
    "duration" DOUBLE PRECISION,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "audio_stream_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audio_batches" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "batchName" TEXT NOT NULL,
    "fileCount" INTEGER NOT NULL,
    "totalDuration" DOUBLE PRECISION,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "audio_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_processing_results" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "processedInputId" TEXT NOT NULL,
    "fileIndex" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "processingTime" DOUBLE PRECISION,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,

    CONSTRAINT "batch_processing_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "input_processing_metrics" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "snapshotId" TEXT,
    "totalInputs" INTEGER NOT NULL,
    "successfulInputs" INTEGER NOT NULL,
    "failedInputs" INTEGER NOT NULL,
    "averageProcessingTime" DOUBLE PRECISION,
    "lastProcessedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "input_processing_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "processed_inputs_userId_idx" ON "processed_inputs"("userId");

-- CreateIndex
CREATE INDEX "processed_inputs_status_idx" ON "processed_inputs"("status");

-- CreateIndex
CREATE INDEX "speaker_profiles_userId_idx" ON "speaker_profiles"("userId");

-- CreateIndex
CREATE INDEX "voice_samples_speakerProfileId_idx" ON "voice_samples"("speakerProfileId");

-- CreateIndex
CREATE INDEX "voice_samples_status_idx" ON "voice_samples"("status");

-- CreateIndex
CREATE INDEX "training_sessions_speakerProfileId_idx" ON "training_sessions"("speakerProfileId");

-- CreateIndex
CREATE INDEX "training_sessions_status_idx" ON "training_sessions"("status");

-- CreateIndex
CREATE INDEX "audio_stream_sessions_userId_idx" ON "audio_stream_sessions"("userId");

-- CreateIndex
CREATE INDEX "audio_batches_userId_idx" ON "audio_batches"("userId");

-- CreateIndex
CREATE INDEX "audio_batches_status_idx" ON "audio_batches"("status");

-- CreateIndex
CREATE UNIQUE INDEX "batch_processing_results_batchId_fileIndex_key" ON "batch_processing_results"("batchId", "fileIndex");

-- CreateIndex
CREATE UNIQUE INDEX "input_processing_metrics_snapshotId_key" ON "input_processing_metrics"("snapshotId");

-- CreateIndex
CREATE INDEX "input_processing_metrics_userId_idx" ON "input_processing_metrics"("userId");

-- AddForeignKey
ALTER TABLE "processed_inputs" ADD CONSTRAINT "processed_inputs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processed_inputs" ADD CONSTRAINT "processed_inputs_audioStreamId_fkey" FOREIGN KEY ("audioStreamId") REFERENCES "audio_stream_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speaker_profiles" ADD CONSTRAINT "speaker_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_samples" ADD CONSTRAINT "voice_samples_speakerProfileId_fkey" FOREIGN KEY ("speakerProfileId") REFERENCES "speaker_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_speakerProfileId_fkey" FOREIGN KEY ("speakerProfileId") REFERENCES "speaker_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audio_stream_sessions" ADD CONSTRAINT "audio_stream_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audio_batches" ADD CONSTRAINT "audio_batches_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_processing_results" ADD CONSTRAINT "batch_processing_results_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "audio_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_processing_results" ADD CONSTRAINT "batch_processing_results_processedInputId_fkey" FOREIGN KEY ("processedInputId") REFERENCES "processed_inputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "input_processing_metrics" ADD CONSTRAINT "input_processing_metrics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "input_processing_metrics" ADD CONSTRAINT "input_processing_metrics_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "processed_inputs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
