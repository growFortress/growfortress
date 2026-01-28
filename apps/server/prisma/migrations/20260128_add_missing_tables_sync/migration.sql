-- Migration: Add missing tables for new features
-- Applied manually to Neon on 2026-01-28

-- Colony Milestone table
CREATE TABLE IF NOT EXISTS "ColonyMilestone" (
    "id" TEXT NOT NULL,
    "colonyProgressId" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ColonyMilestone_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ColonyMilestone_colonyProgressId_milestoneId_key" ON "ColonyMilestone"("colonyProgressId", "milestoneId");
ALTER TABLE "ColonyMilestone" ADD CONSTRAINT "ColonyMilestone_colonyProgressId_fkey" FOREIGN KEY ("colonyProgressId") REFERENCES "ColonyProgress"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Player Achievements table
CREATE TABLE IF NOT EXISTS "PlayerAchievements" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lifetimeStats" JSONB NOT NULL DEFAULT '{}',
    "achievementProgress" JSONB NOT NULL DEFAULT '{}',
    "claimedTiers" JSONB NOT NULL DEFAULT '{}',
    "unlockedTitles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "activeTitle" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlayerAchievements_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PlayerAchievements_userId_key" ON "PlayerAchievements"("userId");
CREATE INDEX IF NOT EXISTS "PlayerAchievements_userId_idx" ON "PlayerAchievements"("userId");
ALTER TABLE "PlayerAchievements" ADD CONSTRAINT "PlayerAchievements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Expedition Progress table
CREATE TABLE IF NOT EXISTS "ExpeditionProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3),
    "lastProcessedAt" TIMESTAMP(3),
    "wavesCleared" INTEGER NOT NULL DEFAULT 0,
    "maxWavesPerHour" INTEGER NOT NULL DEFAULT 10,
    "pendingGold" INTEGER NOT NULL DEFAULT 0,
    "pendingDust" INTEGER NOT NULL DEFAULT 0,
    "pendingXp" INTEGER NOT NULL DEFAULT 0,
    "pendingMaterials" JSONB NOT NULL DEFAULT '{}',
    "loadoutSnapshot" JSONB,
    "powerSnapshot" INTEGER NOT NULL DEFAULT 0,
    "maxOfflineHours" INTEGER NOT NULL DEFAULT 8,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExpeditionProgress_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ExpeditionProgress_userId_key" ON "ExpeditionProgress"("userId");
ALTER TABLE "ExpeditionProgress" ADD CONSTRAINT "ExpeditionProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Daily Login Progress table
CREATE TABLE IF NOT EXISTS "DailyLoginProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentDay" INTEGER NOT NULL DEFAULT 1,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "lastClaimAt" TIMESTAMP(3),
    "totalDaysClaimed" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DailyLoginProgress_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "DailyLoginProgress_userId_key" ON "DailyLoginProgress"("userId");
CREATE INDEX IF NOT EXISTS "DailyLoginProgress_userId_idx" ON "DailyLoginProgress"("userId");
ALTER TABLE "DailyLoginProgress" ADD CONSTRAINT "DailyLoginProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Weekly Mission table
CREATE TABLE IF NOT EXISTS "WeeklyMission" (
    "id" TEXT NOT NULL,
    "weekKey" TEXT NOT NULL,
    "missionDefId" TEXT NOT NULL,
    "targetValue" INTEGER NOT NULL,
    "rewardGold" INTEGER NOT NULL DEFAULT 0,
    "rewardDust" INTEGER NOT NULL DEFAULT 0,
    "rewardMaterials" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WeeklyMission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "WeeklyMission_weekKey_missionDefId_key" ON "WeeklyMission"("weekKey", "missionDefId");
CREATE INDEX IF NOT EXISTS "WeeklyMission_weekKey_idx" ON "WeeklyMission"("weekKey");

-- Player Mission Progress table
CREATE TABLE IF NOT EXISTS "PlayerMissionProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "currentProgress" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "claimedAt" TIMESTAMP(3),
    CONSTRAINT "PlayerMissionProgress_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PlayerMissionProgress_userId_missionId_key" ON "PlayerMissionProgress"("userId", "missionId");
CREATE INDEX IF NOT EXISTS "PlayerMissionProgress_userId_idx" ON "PlayerMissionProgress"("userId");
CREATE INDEX IF NOT EXISTS "PlayerMissionProgress_missionId_idx" ON "PlayerMissionProgress"("missionId");
ALTER TABLE "PlayerMissionProgress" ADD CONSTRAINT "PlayerMissionProgress_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "WeeklyMission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayerMissionProgress" ADD CONSTRAINT "PlayerMissionProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Stat Points table
CREATE TABLE IF NOT EXISTS "StatPoints" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalEarned" INTEGER NOT NULL DEFAULT 0,
    "totalSpent" INTEGER NOT NULL DEFAULT 0,
    "fortressAllocations" JSONB NOT NULL DEFAULT '{}',
    "heroAllocations" JSONB NOT NULL DEFAULT '[]',
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StatPoints_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "StatPoints_userId_key" ON "StatPoints"("userId");
CREATE INDEX IF NOT EXISTS "StatPoints_userId_idx" ON "StatPoints"("userId");
ALTER TABLE "StatPoints" ADD CONSTRAINT "StatPoints_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add tutorialCompletedAt column to User if missing
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tutorialCompletedAt" TIMESTAMP(3);

-- Cleanup: Drop old DailyQuestProgress table (replaced by DailyLoginProgress)
DROP TABLE IF EXISTS "DailyQuestProgress";
