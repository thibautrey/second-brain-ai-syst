-- AlterTable
ALTER TABLE "speaker_profiles" DROP COLUMN IF EXISTS "speakerId",
DROP COLUMN IF EXISTS "enrollmentDate",
DROP COLUMN IF EXISTS "modelVersion",
DROP COLUMN IF EXISTS "centroidEmbedding",
DROP COLUMN IF EXISTS "confidenceMean",
DROP COLUMN IF EXISTS "confidenceStd",
DROP COLUMN IF EXISTS "confidenceMin",
DROP COLUMN IF EXISTS "confidenceMax",
DROP COLUMN IF EXISTS "active",
ADD COLUMN "voiceCharacteristics" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "identificationMethod" TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
ADD COLUMN "centroidEmbedding" JSONB,
ADD COLUMN "embeddingModel" TEXT NOT NULL DEFAULT 'ecapa-tdnn',
ADD COLUMN "embeddingVersion" TEXT NOT NULL DEFAULT '1.0',
ADD COLUMN "isEnrolled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "enrollmentDate" TIMESTAMP(3),
ADD COLUMN "lastTrainingDate" TIMESTAMP(3);

-- DropTable
DROP TABLE IF EXISTS "speaker_embeddings";

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

-- AlterTable
ALTER TABLE "processed_inputs" DROP COLUMN IF EXISTS "processingTimeMs",
DROP COLUMN IF EXISTS "error",
ADD COLUMN "errorMessage" TEXT,
ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "audio_stream_sessions" DROP COLUMN IF EXISTS "sessionId",
DROP COLUMN IF EXISTS "inputId",
DROP COLUMN IF EXISTS "startTime",
DROP COLUMN IF EXISTS "endTime",
DROP COLUMN IF EXISTS "totalChunks",
DROP COLUMN IF EXISTS "totalDurationSeconds",
DROP COLUMN IF EXISTS "finalTranscription",
ADD COLUMN "sessionName" TEXT NOT NULL DEFAULT 'default',
ADD COLUMN "format" TEXT NOT NULL DEFAULT 'wav',
ADD COLUMN "sampleRate" INTEGER NOT NULL DEFAULT 16000,
ADD COLUMN "channelCount" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "duration" DOUBLE PRECISION,
ADD COLUMN "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "completedAt" TIMESTAMP(3),
RENAME COLUMN "status" TO "status";

-- AlterTable
ALTER TABLE "audio_batches" DROP COLUMN IF EXISTS "inputId",
DROP COLUMN IF EXISTS "batchId",
DROP COLUMN IF EXISTS "sequenceNumber",
DROP COLUMN IF EXISTS "chunkSize",
DROP COLUMN IF EXISTS "isFinal",
DROP COLUMN IF EXISTS "transcodedContent",
ADD COLUMN "batchName" TEXT NOT NULL DEFAULT 'default',
ADD COLUMN "fileCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "totalDuration" DOUBLE PRECISION,
ADD COLUMN "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "processedAt" TIMESTAMP(3);

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
CREATE INDEX "voice_samples_speakerProfileId_idx" ON "voice_samples"("speakerProfileId");

-- CreateIndex
CREATE INDEX "voice_samples_status_idx" ON "voice_samples"("status");

-- CreateIndex
CREATE INDEX "training_sessions_speakerProfileId_idx" ON "training_sessions"("speakerProfileId");

-- CreateIndex
CREATE INDEX "training_sessions_status_idx" ON "training_sessions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "batch_processing_results_batchId_fileIndex_key" ON "batch_processing_results"("batchId", "fileIndex");

-- CreateIndex
CREATE UNIQUE INDEX "input_processing_metrics_snapshotId_key" ON "input_processing_metrics"("snapshotId");

-- CreateIndex
CREATE INDEX "input_processing_metrics_userId_idx" ON "input_processing_metrics"("userId");

-- AddForeignKey
ALTER TABLE "voice_samples" ADD CONSTRAINT "voice_samples_speakerProfileId_fkey" FOREIGN KEY ("speakerProfileId") REFERENCES "speaker_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_speakerProfileId_fkey" FOREIGN KEY ("speakerProfileId") REFERENCES "speaker_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_processing_results" ADD CONSTRAINT "batch_processing_results_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "audio_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_processing_results" ADD CONSTRAINT "batch_processing_results_processedInputId_fkey" FOREIGN KEY ("processedInputId") REFERENCES "processed_inputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "input_processing_metrics" ADD CONSTRAINT "input_processing_metrics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "input_processing_metrics" ADD CONSTRAINT "input_processing_metrics_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "processed_inputs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
