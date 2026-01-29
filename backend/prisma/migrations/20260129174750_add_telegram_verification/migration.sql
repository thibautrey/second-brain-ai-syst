-- CreateTable
CREATE TABLE "TelegramVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "verificationCode" TEXT NOT NULL,
    "encryptedBotToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TelegramVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramVerification_verificationCode_key" ON "TelegramVerification"("verificationCode");

-- CreateIndex
CREATE INDEX "TelegramVerification_userId_idx" ON "TelegramVerification"("userId");

-- CreateIndex
CREATE INDEX "TelegramVerification_verificationCode_idx" ON "TelegramVerification"("verificationCode");

-- CreateIndex
CREATE INDEX "TelegramVerification_expiresAt_idx" ON "TelegramVerification"("expiresAt");

-- AddForeignKey
ALTER TABLE "TelegramVerification" ADD CONSTRAINT "TelegramVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
