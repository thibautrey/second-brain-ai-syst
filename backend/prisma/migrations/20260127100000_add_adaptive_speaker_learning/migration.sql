-- Add adaptive learning fields to SpeakerProfile
ALTER TABLE "SpeakerProfile" ADD COLUMN "adaptiveLearningEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SpeakerProfile" ADD COLUMN "lastAdaptiveUpdate" TIMESTAMP(3);
ALTER TABLE "SpeakerProfile" ADD COLUMN "adaptiveUpdateCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SpeakerProfile" ADD COLUMN "profileHealth" DOUBLE PRECISION NOT NULL DEFAULT 1.0;
ALTER TABLE "SpeakerProfile" ADD COLUMN "isFrozen" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SpeakerProfile" ADD COLUMN "frozenAt" TIMESTAMP(3);
ALTER TABLE "SpeakerProfile" ADD COLUMN "frozenReason" TEXT;

-- CreateTable: AdaptiveSample
CREATE TABLE "AdaptiveSample" (
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

    CONSTRAINT "AdaptiveSample_pkey" PRIMARY KEY ("id")
);

-- CreateTable: NegativeExample
CREATE TABLE "NegativeExample" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "embedding" DOUBLE PRECISION[],
    "similarityToProfile" DOUBLE PRECISION NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NegativeExample_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ProfileSnapshot
CREATE TABLE "ProfileSnapshot" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "centroidEmbedding" DOUBLE PRECISION[],
    "sampleCount" INTEGER NOT NULL,
    "healthScore" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ProfileHealthLog
CREATE TABLE "ProfileHealthLog" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "healthScore" DOUBLE PRECISION NOT NULL,
    "intraClusterVariance" DOUBLE PRECISION,
    "averageSimilarity" DOUBLE PRECISION,
    "sampleCount" INTEGER NOT NULL,
    "adaptiveSampleCount" INTEGER NOT NULL,
    "negativeSampleCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileHealthLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdaptiveSample_profileId_idx" ON "AdaptiveSample"("profileId");
CREATE INDEX "AdaptiveSample_createdAt_idx" ON "AdaptiveSample"("createdAt");
CREATE INDEX "NegativeExample_userId_idx" ON "NegativeExample"("userId");
CREATE INDEX "ProfileSnapshot_profileId_idx" ON "ProfileSnapshot"("profileId");
CREATE INDEX "ProfileSnapshot_createdAt_idx" ON "ProfileSnapshot"("createdAt");
CREATE INDEX "ProfileHealthLog_profileId_idx" ON "ProfileHealthLog"("profileId");
CREATE INDEX "ProfileHealthLog_createdAt_idx" ON "ProfileHealthLog"("createdAt");

-- AddForeignKey
ALTER TABLE "AdaptiveSample" ADD CONSTRAINT "AdaptiveSample_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "SpeakerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NegativeExample" ADD CONSTRAINT "NegativeExample_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileSnapshot" ADD CONSTRAINT "ProfileSnapshot_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "SpeakerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileHealthLog" ADD CONSTRAINT "ProfileHealthLog_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "SpeakerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
