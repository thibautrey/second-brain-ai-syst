-- Add adaptive learning fields to SpeakerProfile
ALTER TABLE "speaker_profiles" ADD COLUMN "adaptiveLearningEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "speaker_profiles" ADD COLUMN "lastAdaptiveUpdate" TIMESTAMP(3);
ALTER TABLE "speaker_profiles" ADD COLUMN "adaptiveUpdateCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "speaker_profiles" ADD COLUMN "profileHealth" DOUBLE PRECISION NOT NULL DEFAULT 1.0;
ALTER TABLE "speaker_profiles" ADD COLUMN "isFrozen" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "speaker_profiles" ADD COLUMN "frozenAt" TIMESTAMP(3);
ALTER TABLE "speaker_profiles" ADD COLUMN "frozenReason" TEXT;

-- CreateTable: AdaptiveSample
CREATE TABLE "adaptive_samples" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "embedding" DOUBLE PRECISION[],
    "similarityScore" DOUBLE PRECISION NOT NULL,
    "audioQualityScore" DOUBLE PRECISION NOT NULL,
    "snr" DOUBLE PRECISION,
    "clippingRatio" DOUBLE PRECISION,
    "duration" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedInUpdate" BOOLEAN NOT NULL DEFAULT false,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,

    CONSTRAINT "adaptive_samples_pkey" PRIMARY KEY ("id")
);

-- CreateTable: NegativeExample
CREATE TABLE "negative_examples" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "embedding" DOUBLE PRECISION[],
    "similarityToProfile" DOUBLE PRECISION NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "negative_examples_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ProfileSnapshot
CREATE TABLE "profile_snapshots" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "centroidEmbedding" DOUBLE PRECISION[],
    "sampleCount" INTEGER NOT NULL,
    "healthScore" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ProfileHealthLog
CREATE TABLE "profile_health_logs" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "healthScore" DOUBLE PRECISION NOT NULL,
    "intraClusterVariance" DOUBLE PRECISION,
    "averageSimilarity" DOUBLE PRECISION,
    "sampleCount" INTEGER NOT NULL,
    "adaptiveSampleCount" INTEGER NOT NULL,
    "negativeSampleCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_health_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "adaptive_samples_profileId_idx" ON "adaptive_samples"("profileId");
CREATE INDEX "adaptive_samples_createdAt_idx" ON "adaptive_samples"("createdAt");
CREATE INDEX "negative_examples_userId_idx" ON "negative_examples"("userId");
CREATE INDEX "profile_snapshots_profileId_idx" ON "profile_snapshots"("profileId");
CREATE INDEX "profile_snapshots_createdAt_idx" ON "profile_snapshots"("createdAt");
CREATE INDEX "profile_health_logs_profileId_idx" ON "profile_health_logs"("profileId");
CREATE INDEX "profile_health_logs_createdAt_idx" ON "profile_health_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "adaptive_samples" ADD CONSTRAINT "adaptive_samples_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "speaker_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negative_examples" ADD CONSTRAINT "negative_examples_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_snapshots" ADD CONSTRAINT "profile_snapshots_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "speaker_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_health_logs" ADD CONSTRAINT "profile_health_logs_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "speaker_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
