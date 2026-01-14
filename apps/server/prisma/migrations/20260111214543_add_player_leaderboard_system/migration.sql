-- AlterTable
ALTER TABLE "Segment" ADD COLUMN     "materialsJson" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "exclusiveItems" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "honor" INTEGER NOT NULL DEFAULT 1000,
ADD COLUMN     "totalWaves" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "weeklyHonor" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "weeklyHonorResetAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "WeeklyPlayerLeaderboard" (
    "id" TEXT NOT NULL,
    "weekKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wavesThisWeek" INTEGER NOT NULL DEFAULT 0,
    "honorGained" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyPlayerLeaderboard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyPlayerReward" (
    "id" TEXT NOT NULL,
    "weekKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "goldAmount" INTEGER NOT NULL,
    "dustAmount" INTEGER NOT NULL,
    "sigilsAmount" INTEGER NOT NULL,
    "itemIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "claimedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyPlayerReward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeeklyPlayerLeaderboard_weekKey_wavesThisWeek_idx" ON "WeeklyPlayerLeaderboard"("weekKey", "wavesThisWeek" DESC);

-- CreateIndex
CREATE INDEX "WeeklyPlayerLeaderboard_weekKey_honorGained_idx" ON "WeeklyPlayerLeaderboard"("weekKey", "honorGained" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyPlayerLeaderboard_weekKey_userId_key" ON "WeeklyPlayerLeaderboard"("weekKey", "userId");

-- CreateIndex
CREATE INDEX "WeeklyPlayerReward_weekKey_idx" ON "WeeklyPlayerReward"("weekKey");

-- CreateIndex
CREATE INDEX "WeeklyPlayerReward_userId_claimed_idx" ON "WeeklyPlayerReward"("userId", "claimed");

-- CreateIndex
CREATE INDEX "WeeklyPlayerReward_expiresAt_idx" ON "WeeklyPlayerReward"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyPlayerReward_weekKey_userId_category_key" ON "WeeklyPlayerReward"("weekKey", "userId", "category");

-- AddForeignKey
ALTER TABLE "WeeklyPlayerLeaderboard" ADD CONSTRAINT "WeeklyPlayerLeaderboard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyPlayerReward" ADD CONSTRAINT "WeeklyPlayerReward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
