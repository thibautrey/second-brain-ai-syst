-- CreateTable "tips"
CREATE TABLE "tips" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "targetFeature" TEXT,
    "isDismissed" BOOLEAN NOT NULL DEFAULT false,
    "dismissedAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "lastViewedAt" TIMESTAMP(3),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "icon" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tips_userId_idx" ON "tips"("userId");

-- CreateIndex
CREATE INDEX "tips_isDismissed_idx" ON "tips"("isDismissed");

-- CreateIndex
CREATE INDEX "tips_targetFeature_idx" ON "tips"("targetFeature");

-- CreateIndex
CREATE INDEX "tips_priority_idx" ON "tips"("priority");

-- AddForeignKey
ALTER TABLE "tips" ADD CONSTRAINT "tips_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
