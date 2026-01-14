-- Artifact System Upgrade Migration
-- Adds support for:
-- 1. 3-slot artifact system with upgrade levels
-- 2. Crystal fragment tracking for deterministic crystal acquisition
-- 3. Pillar Challenge mode for crystal farming

-- ============================================================================
-- PlayerArtifact modifications
-- ============================================================================

-- Add level column with default value 1
ALTER TABLE "PlayerArtifact" ADD COLUMN "level" INTEGER NOT NULL DEFAULT 1;

-- Add equippedSlot column for weapon/armor/accessory slot type
ALTER TABLE "PlayerArtifact" ADD COLUMN "equippedSlot" TEXT;

-- Add upgradedAt timestamp
ALTER TABLE "PlayerArtifact" ADD COLUMN "upgradedAt" TIMESTAMP(3);

-- Add index on equippedToHeroId for faster lookups
CREATE INDEX "PlayerArtifact_equippedToHeroId_idx" ON "PlayerArtifact"("equippedToHeroId");

-- ============================================================================
-- Inventory modifications
-- ============================================================================

-- Add pillarKeys JSON column for Pillar Challenge keys
ALTER TABLE "Inventory" ADD COLUMN "pillarKeys" JSONB NOT NULL DEFAULT '{}';

-- ============================================================================
-- CrystalProgress - new model
-- ============================================================================

CREATE TABLE "CrystalProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "powerFragments" INTEGER NOT NULL DEFAULT 0,
    "spaceFragments" INTEGER NOT NULL DEFAULT 0,
    "timeFragments" INTEGER NOT NULL DEFAULT 0,
    "realityFragments" INTEGER NOT NULL DEFAULT 0,
    "soulFragments" INTEGER NOT NULL DEFAULT 0,
    "mindFragments" INTEGER NOT NULL DEFAULT 0,
    "fullCrystals" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "matrixAssembled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrystalProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CrystalProgress_userId_key" ON "CrystalProgress"("userId");

ALTER TABLE "CrystalProgress" ADD CONSTRAINT "CrystalProgress_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- PillarChallengeSession - new model
-- ============================================================================

CREATE TABLE "PillarChallengeSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pillarId" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "seed" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "wavesCleared" INTEGER NOT NULL DEFAULT 0,
    "fortressDamageTaken" INTEGER NOT NULL DEFAULT 0,
    "heroesLost" INTEGER NOT NULL DEFAULT 0,
    "fragmentsEarned" INTEGER NOT NULL DEFAULT 0,
    "fullCrystalEarned" BOOLEAN NOT NULL DEFAULT false,
    "crystalType" TEXT,
    "goldEarned" INTEGER NOT NULL DEFAULT 0,
    "materialsEarned" JSONB NOT NULL DEFAULT '{}',
    "bonusesAchieved" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "loadoutJson" JSONB NOT NULL,
    "finalHash" INTEGER,
    "verified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PillarChallengeSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PillarChallengeSession_userId_idx" ON "PillarChallengeSession"("userId");
CREATE INDEX "PillarChallengeSession_pillarId_idx" ON "PillarChallengeSession"("pillarId");
CREATE INDEX "PillarChallengeSession_startedAt_idx" ON "PillarChallengeSession"("startedAt");

ALTER TABLE "PillarChallengeSession" ADD CONSTRAINT "PillarChallengeSession_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- PillarChallengeLimits - new model
-- ============================================================================

CREATE TABLE "PillarChallengeLimits" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dailyAttempts" INTEGER NOT NULL DEFAULT 0,
    "dailyPaidAttempts" INTEGER NOT NULL DEFAULT 0,
    "dailyResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAttemptAt" TIMESTAMP(3),
    "weeklyPerfectClears" JSONB NOT NULL DEFAULT '{}',
    "weeklyResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PillarChallengeLimits_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PillarChallengeLimits_userId_key" ON "PillarChallengeLimits"("userId");

ALTER TABLE "PillarChallengeLimits" ADD CONSTRAINT "PillarChallengeLimits_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
