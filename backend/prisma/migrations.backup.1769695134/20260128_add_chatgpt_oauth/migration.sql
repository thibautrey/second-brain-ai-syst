-- CreateTable
CREATE TABLE "chatgpt_oauth_credentials" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "accountId" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "lastRefreshedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chatgpt_oauth_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chatgpt_oauth_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "codeVerifier" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chatgpt_oauth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "chatgpt_oauth_credentials_userId_key" ON "chatgpt_oauth_credentials"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "chatgpt_oauth_sessions_state_key" ON "chatgpt_oauth_sessions"("state");

-- CreateIndex
CREATE INDEX "chatgpt_oauth_sessions_userId_idx" ON "chatgpt_oauth_sessions"("userId");

-- CreateIndex
CREATE INDEX "chatgpt_oauth_sessions_state_idx" ON "chatgpt_oauth_sessions"("state");

-- CreateIndex
CREATE INDEX "chatgpt_oauth_sessions_expiresAt_idx" ON "chatgpt_oauth_sessions"("expiresAt");

-- AddForeignKey
ALTER TABLE "chatgpt_oauth_credentials" ADD CONSTRAINT "chatgpt_oauth_credentials_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
