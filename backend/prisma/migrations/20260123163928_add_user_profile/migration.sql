/*
  Warnings:

  - The primary key for the `_SourceMemories` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[A,B]` on the table `_SourceMemories` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "MCPTransportType" AS ENUM ('STDIO', 'HTTP', 'SSE');

-- AlterTable
ALTER TABLE "_SourceMemories" DROP CONSTRAINT "_SourceMemories_AB_pkey";

-- AlterTable
ALTER TABLE "user_settings" ADD COLUMN     "userProfile" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "user_tool_configs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL DEFAULT '{}',
    "rateLimit" INTEGER,
    "timeout" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_tool_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcp_servers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "transportType" "MCPTransportType" NOT NULL DEFAULT 'STDIO',
    "command" TEXT,
    "args" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "env" JSONB NOT NULL DEFAULT '{}',
    "url" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isConnected" BOOLEAN NOT NULL DEFAULT false,
    "lastConnected" TIMESTAMP(3),
    "lastError" TEXT,
    "availableTools" JSONB NOT NULL DEFAULT '[]',
    "serverInfo" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mcp_servers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_tools" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "toolSlug" TEXT NOT NULL,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "config" JSONB NOT NULL DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "marketplace_tools_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_tool_configs_userId_idx" ON "user_tool_configs"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_tool_configs_userId_toolId_key" ON "user_tool_configs"("userId", "toolId");

-- CreateIndex
CREATE INDEX "mcp_servers_userId_idx" ON "mcp_servers"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "mcp_servers_userId_name_key" ON "mcp_servers"("userId", "name");

-- CreateIndex
CREATE INDEX "marketplace_tools_userId_idx" ON "marketplace_tools"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_tools_userId_toolSlug_key" ON "marketplace_tools"("userId", "toolSlug");

-- CreateIndex
CREATE UNIQUE INDEX "_SourceMemories_AB_unique" ON "_SourceMemories"("A", "B");

-- AddForeignKey
ALTER TABLE "user_tool_configs" ADD CONSTRAINT "user_tool_configs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_servers" ADD CONSTRAINT "mcp_servers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_tools" ADD CONSTRAINT "marketplace_tools_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
