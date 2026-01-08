-- CreateTable
CREATE TABLE "BulkReward" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "targetType" TEXT NOT NULL DEFAULT 'ALL',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BulkReward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerRewardClaim" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerRewardClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlayerRewardClaim_userId_idx" ON "PlayerRewardClaim"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerRewardClaim_userId_rewardId_key" ON "PlayerRewardClaim"("userId", "rewardId");

-- AddForeignKey
ALTER TABLE "PlayerRewardClaim" ADD CONSTRAINT "PlayerRewardClaim_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "BulkReward"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerRewardClaim" ADD CONSTRAINT "PlayerRewardClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
