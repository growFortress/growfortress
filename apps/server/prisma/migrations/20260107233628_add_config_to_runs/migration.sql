-- AlterTable
ALTER TABLE "GameSession" ADD COLUMN     "configJson" JSONB;

-- AlterTable
ALTER TABLE "Run" ADD COLUMN     "configJson" JSONB;

-- CreateTable
CREATE TABLE "BossRushSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seed" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "bossesKilled" INTEGER NOT NULL DEFAULT 0,
    "currentBossIndex" INTEGER NOT NULL DEFAULT 0,
    "currentCycle" INTEGER NOT NULL DEFAULT 0,
    "totalDamageDealt" BIGINT NOT NULL DEFAULT 0,
    "goldEarned" INTEGER NOT NULL DEFAULT 0,
    "dustEarned" INTEGER NOT NULL DEFAULT 0,
    "xpEarned" INTEGER NOT NULL DEFAULT 0,
    "materialsEarned" JSONB NOT NULL DEFAULT '{}',
    "loadoutJson" JSONB NOT NULL,
    "finalHash" INTEGER,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "rejectReason" TEXT,

    CONSTRAINT "BossRushSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BossRushLeaderboard" (
    "id" TEXT NOT NULL,
    "weekKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalDamage" BIGINT NOT NULL,
    "bossesKilled" INTEGER NOT NULL,
    "sessionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BossRushLeaderboard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BossRushSession_userId_idx" ON "BossRushSession"("userId");

-- CreateIndex
CREATE INDEX "BossRushSession_startedAt_idx" ON "BossRushSession"("startedAt");

-- CreateIndex
CREATE INDEX "BossRushSession_totalDamageDealt_idx" ON "BossRushSession"("totalDamageDealt" DESC);

-- CreateIndex
CREATE INDEX "BossRushLeaderboard_weekKey_totalDamage_idx" ON "BossRushLeaderboard"("weekKey", "totalDamage" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "BossRushLeaderboard_weekKey_userId_key" ON "BossRushLeaderboard"("weekKey", "userId");

-- AddForeignKey
ALTER TABLE "BossRushSession" ADD CONSTRAINT "BossRushSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BossRushLeaderboard" ADD CONSTRAINT "BossRushLeaderboard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
