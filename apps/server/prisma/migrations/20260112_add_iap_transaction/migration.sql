-- CreateEnum
CREATE TYPE "IAPPlatform" AS ENUM ('ios', 'android', 'steam', 'web');

-- CreateTable
CREATE TABLE "IAPTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "dustGranted" INTEGER NOT NULL,
    "bonusGranted" INTEGER NOT NULL DEFAULT 0,
    "transactionId" TEXT NOT NULL,
    "platform" "IAPPlatform" NOT NULL,
    "receipt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IAPTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IAPTransaction_transactionId_key" ON "IAPTransaction"("transactionId");

-- CreateIndex
CREATE INDEX "IAPTransaction_userId_idx" ON "IAPTransaction"("userId");

-- CreateIndex
CREATE INDEX "IAPTransaction_transactionId_idx" ON "IAPTransaction"("transactionId");

-- CreateIndex
CREATE INDEX "IAPTransaction_platform_idx" ON "IAPTransaction"("platform");

-- AddForeignKey
ALTER TABLE "IAPTransaction" ADD CONSTRAINT "IAPTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
