-- CreateEnum
CREATE TYPE "SkillCategory" AS ENUM ('PRODUCTIVITY', 'DEVELOPMENT', 'WRITING', 'RESEARCH', 'AUTOMATION', 'ANALYSIS', 'COMMUNICATION', 'CREATIVITY', 'HEALTH', 'FINANCE', 'LEARNING', 'OTHER');

-- CreateEnum
CREATE TYPE "SkillSourceType" AS ENUM ('BUILTIN', 'HUB', 'MARKETPLACE', 'GITHUB', 'LOCAL');

-- CreateEnum
CREATE TYPE "SkillPriority" AS ENUM ('WORKSPACE', 'MANAGED', 'BUILTIN', 'CRITICAL', 'HIGH', 'NORMAL', 'LOW');

-- CreateTable
CREATE TABLE "skill_hub_entries" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "author" TEXT NOT NULL DEFAULT 'community',
    "category" "SkillCategory" NOT NULL DEFAULT 'OTHER',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "icon" TEXT,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "installs" INTEGER NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceType" "SkillSourceType" NOT NULL DEFAULT 'BUILTIN',
    "sourceUrl" TEXT,
    "downloadUrl" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "skillContent" TEXT,
    "hasScripts" BOOLEAN NOT NULL DEFAULT false,
    "hasReferences" BOOLEAN NOT NULL DEFAULT false,
    "hasAssets" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skill_hub_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installed_skills" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hubEntryId" TEXT,
    "skillSlug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "installedVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "updateAvailable" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL DEFAULT '{}',
    "env" JSONB NOT NULL DEFAULT '{}',
    "apiKey" TEXT,
    "localPath" TEXT,
    "skillMdContent" TEXT,
    "frontmatter" JSONB NOT NULL DEFAULT '{}',
    "priority" "SkillPriority" NOT NULL DEFAULT 'MANAGED',
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "installed_skills_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "skill_hub_entries_slug_key" ON "skill_hub_entries"("slug");

-- CreateIndex
CREATE INDEX "skill_hub_entries_category_idx" ON "skill_hub_entries"("category");

-- CreateIndex
CREATE INDEX "skill_hub_entries_sourceType_idx" ON "skill_hub_entries"("sourceType");

-- CreateIndex
CREATE INDEX "installed_skills_userId_idx" ON "installed_skills"("userId");

-- CreateIndex
CREATE INDEX "installed_skills_enabled_idx" ON "installed_skills"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "installed_skills_userId_skillSlug_key" ON "installed_skills"("userId", "skillSlug");

-- AddForeignKey
ALTER TABLE "installed_skills" ADD CONSTRAINT "installed_skills_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installed_skills" ADD CONSTRAINT "installed_skills_hubEntryId_fkey" FOREIGN KEY ("hubEntryId") REFERENCES "skill_hub_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
