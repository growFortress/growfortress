-- Daily Quests and Prestige System Migration

-- CreateTable: DailyQuestProgress
CREATE TABLE "DailyQuestProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyQuestProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Unique constraint for quest progress per user per reset period
CREATE UNIQUE INDEX "DailyQuestProgress_userId_questId_resetAt_key" ON "DailyQuestProgress"("userId", "questId", "resetAt");

-- CreateIndex: Index for user lookups
CREATE INDEX "DailyQuestProgress_userId_idx" ON "DailyQuestProgress"("userId");

-- CreateIndex: Index for reset time queries
CREATE INDEX "DailyQuestProgress_resetAt_idx" ON "DailyQuestProgress"("resetAt");

-- AddForeignKey: Link to User
ALTER TABLE "DailyQuestProgress" ADD CONSTRAINT "DailyQuestProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add prestige fields to PowerUpgrades table
ALTER TABLE "PowerUpgrades" ADD COLUMN IF NOT EXISTS "fortressPrestige" JSONB NOT NULL DEFAULT '{"hp":0,"damage":0,"armor":0}';
ALTER TABLE "PowerUpgrades" ADD COLUMN IF NOT EXISTS "turretPrestige" JSONB NOT NULL DEFAULT '[]';
