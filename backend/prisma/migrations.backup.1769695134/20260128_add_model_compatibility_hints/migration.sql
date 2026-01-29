-- Create ModelCompatibilityHint table for learning from LLM errors
CREATE TABLE "model_compatibility_hints" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "providerId" TEXT NOT NULL,
  "modelId" TEXT NOT NULL,
  "supportedEndpoints" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "unsupportedEndpoints" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "preferredEndpoint" TEXT,
  "lastErrorType" TEXT,
  "lastErrorMessage" TEXT,
  "errorCount" INTEGER NOT NULL DEFAULT 0,
  "successCount" INTEGER NOT NULL DEFAULT 0,
  "lastErrorTime" TIMESTAMP(3),
  "lastSuccessTime" TIMESTAMP(3),
  "isBlacklisted" BOOLEAN NOT NULL DEFAULT false,
  "blacklistReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "model_compatibility_hints_providerId_fkey" 
    FOREIGN KEY ("providerId") REFERENCES "ai_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create unique index for providerId + modelId combination
CREATE UNIQUE INDEX "model_compatibility_hints_providerId_modelId_key" 
  ON "model_compatibility_hints"("providerId", "modelId");

-- Create index for querying by providerId
CREATE INDEX "model_compatibility_hints_providerId_idx" 
  ON "model_compatibility_hints"("providerId");

-- Create index for finding blacklisted models
CREATE INDEX "model_compatibility_hints_isBlacklisted_idx" 
  ON "model_compatibility_hints"("isBlacklisted");
