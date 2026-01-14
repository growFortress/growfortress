-- Guild Battle System Redesign: Arena 5v5, Tower Race, Guild Boss, Guild Tech

-- ============================================================================
-- 1. Add Battle Hero fields to GuildMember
-- ============================================================================

ALTER TABLE "GuildMember" ADD COLUMN "battleHeroId" TEXT;
ALTER TABLE "GuildMember" ADD COLUMN "battleHeroTier" INTEGER;
ALTER TABLE "GuildMember" ADD COLUMN "battleHeroPower" INTEGER;
ALTER TABLE "GuildMember" ADD COLUMN "battleHeroUpdatedAt" TIMESTAMP(3);
ALTER TABLE "GuildMember" ADD COLUMN "earnedGuildCoins" INTEGER NOT NULL DEFAULT 0;

-- ============================================================================
-- 2. Add Guild Tech fields to Guild
-- ============================================================================

ALTER TABLE "Guild" ADD COLUMN "guildCoins" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Guild" ADD COLUMN "techLevels" JSONB NOT NULL DEFAULT '{"fortress":{"hp":0,"damage":0,"regen":0},"hero":{"hp":0,"damage":0,"cooldown":0},"turret":{"damage":0,"speed":0,"range":0},"economy":{"gold":0,"dust":0,"xp":0}}';

-- ============================================================================
-- 3. Update TreasuryTransactionType enum
-- ============================================================================

ALTER TYPE "TreasuryTransactionType" ADD VALUE IF NOT EXISTS 'SHIELD_PURCHASE';
ALTER TYPE "TreasuryTransactionType" ADD VALUE IF NOT EXISTS 'GUILD_TECH_UPGRADE';

-- ============================================================================
-- 4. Simplify GuildBattleStatus enum (remove old statuses)
-- ============================================================================

-- First, delete all battles that aren't RESOLVED (old pending/accepted battles)
DELETE FROM "GuildBattle" WHERE "status" != 'RESOLVED';

-- Create new simplified enum
CREATE TYPE "GuildBattleStatus_new" AS ENUM ('RESOLVED');

-- Update the column to use new enum
ALTER TABLE "GuildBattle"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "GuildBattleStatus_new" USING 'RESOLVED'::"GuildBattleStatus_new",
  ALTER COLUMN "status" SET DEFAULT 'RESOLVED'::"GuildBattleStatus_new";

-- Drop old enum and rename new one
DROP TYPE "GuildBattleStatus";
ALTER TYPE "GuildBattleStatus_new" RENAME TO "GuildBattleStatus";

-- ============================================================================
-- 5. Redesign GuildBattle for instant attacks
-- ============================================================================

-- Rename columns
ALTER TABLE "GuildBattle" RENAME COLUMN "challengerGuildId" TO "attackerGuildId";
ALTER TABLE "GuildBattle" RENAME COLUMN "challengedGuildId" TO "defenderGuildId";

-- Drop old columns
ALTER TABLE "GuildBattle" DROP COLUMN IF EXISTS "challengerPower";
ALTER TABLE "GuildBattle" DROP COLUMN IF EXISTS "challengedPower";
ALTER TABLE "GuildBattle" DROP COLUMN IF EXISTS "battleFormat";
ALTER TABLE "GuildBattle" DROP COLUMN IF EXISTS "goldCost";
ALTER TABLE "GuildBattle" DROP COLUMN IF EXISTS "expiresAt";
ALTER TABLE "GuildBattle" DROP COLUMN IF EXISTS "acceptedAt";

-- Add new columns
ALTER TABLE "GuildBattle" ADD COLUMN "attackerUserId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "GuildBattle" ADD COLUMN "attackerMemberIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "GuildBattle" ADD COLUMN "defenderMemberIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "GuildBattle" ADD COLUMN "attackerHeroes" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "GuildBattle" ADD COLUMN "defenderHeroes" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "GuildBattle" ADD COLUMN "isRevenge" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "GuildBattle" ADD COLUMN "revengeForBattleId" TEXT;

-- Make seed required (remove optional)
UPDATE "GuildBattle" SET "seed" = 0 WHERE "seed" IS NULL;
ALTER TABLE "GuildBattle" ALTER COLUMN "seed" SET NOT NULL;

-- Set default for resolvedAt
ALTER TABLE "GuildBattle" ALTER COLUMN "resolvedAt" SET DEFAULT CURRENT_TIMESTAMP;
UPDATE "GuildBattle" SET "resolvedAt" = "createdAt" WHERE "resolvedAt" IS NULL;
ALTER TABLE "GuildBattle" ALTER COLUMN "resolvedAt" SET NOT NULL;

-- Update indexes
DROP INDEX IF EXISTS "GuildBattle_challengerGuildId_idx";
DROP INDEX IF EXISTS "GuildBattle_challengedGuildId_idx";
DROP INDEX IF EXISTS "GuildBattle_challengerGuildId_challengedGuildId_createdAt_idx";

CREATE INDEX "GuildBattle_attackerGuildId_idx" ON "GuildBattle"("attackerGuildId");
CREATE INDEX "GuildBattle_defenderGuildId_idx" ON "GuildBattle"("defenderGuildId");
CREATE INDEX "GuildBattle_attackerGuildId_defenderGuildId_createdAt_idx" ON "GuildBattle"("attackerGuildId", "defenderGuildId", "createdAt");

-- ============================================================================
-- 6. Redesign GuildBattleResult for Arena 5v5
-- ============================================================================

-- Drop old columns
ALTER TABLE "GuildBattleResult" DROP COLUMN IF EXISTS "challengerHonorChange";
ALTER TABLE "GuildBattleResult" DROP COLUMN IF EXISTS "challengedHonorChange";
ALTER TABLE "GuildBattleResult" DROP COLUMN IF EXISTS "challengerTotalPower";
ALTER TABLE "GuildBattleResult" DROP COLUMN IF EXISTS "challengerTotalDamage";
ALTER TABLE "GuildBattleResult" DROP COLUMN IF EXISTS "challengerMembersWon";
ALTER TABLE "GuildBattleResult" DROP COLUMN IF EXISTS "challengedTotalPower";
ALTER TABLE "GuildBattleResult" DROP COLUMN IF EXISTS "challengedTotalDamage";
ALTER TABLE "GuildBattleResult" DROP COLUMN IF EXISTS "challengedMembersWon";
ALTER TABLE "GuildBattleResult" DROP COLUMN IF EXISTS "challengerParticipants";
ALTER TABLE "GuildBattleResult" DROP COLUMN IF EXISTS "challengedParticipants";

-- Add new columns
ALTER TABLE "GuildBattleResult" ADD COLUMN "winnerSide" TEXT NOT NULL DEFAULT 'draw';
ALTER TABLE "GuildBattleResult" ADD COLUMN "attackerHonorChange" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "GuildBattleResult" ADD COLUMN "defenderHonorChange" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "GuildBattleResult" ADD COLUMN "attackerSurvivors" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "GuildBattleResult" ADD COLUMN "defenderSurvivors" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "GuildBattleResult" ADD COLUMN "attackerTotalDamage" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "GuildBattleResult" ADD COLUMN "defenderTotalDamage" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "GuildBattleResult" ADD COLUMN "mvpUserId" TEXT;
ALTER TABLE "GuildBattleResult" ADD COLUMN "mvpHeroId" TEXT;
ALTER TABLE "GuildBattleResult" ADD COLUMN "mvpDamage" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "GuildBattleResult" ADD COLUMN "mvpKills" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "GuildBattleResult" ADD COLUMN "keyMoments" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "GuildBattleResult" ADD COLUMN "killLog" JSONB NOT NULL DEFAULT '[]';

-- ============================================================================
-- 7. Create GuildShield table
-- ============================================================================

CREATE TABLE "GuildShield" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "activatedBy" TEXT NOT NULL,
    "weekKey" TEXT NOT NULL,
    "weeklyCount" INTEGER NOT NULL DEFAULT 1,
    "goldCost" INTEGER NOT NULL DEFAULT 5000,

    CONSTRAINT "GuildShield_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GuildShield_guildId_key" ON "GuildShield"("guildId");
CREATE INDEX "GuildShield_guildId_idx" ON "GuildShield"("guildId");
CREATE INDEX "GuildShield_expiresAt_idx" ON "GuildShield"("expiresAt");

-- ============================================================================
-- 8. Create GuildTowerRace tables
-- ============================================================================

CREATE TABLE "GuildTowerRace" (
    "id" TEXT NOT NULL,
    "weekKey" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "GuildTowerRace_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GuildTowerRace_weekKey_key" ON "GuildTowerRace"("weekKey");
CREATE INDEX "GuildTowerRace_status_idx" ON "GuildTowerRace"("status");

CREATE TABLE "GuildTowerRaceEntry" (
    "id" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "totalWaves" INTEGER NOT NULL DEFAULT 0,
    "memberContributions" JSONB NOT NULL DEFAULT '{}',
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuildTowerRaceEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GuildTowerRaceEntry_raceId_guildId_key" ON "GuildTowerRaceEntry"("raceId", "guildId");
CREATE INDEX "GuildTowerRaceEntry_raceId_idx" ON "GuildTowerRaceEntry"("raceId");
CREATE INDEX "GuildTowerRaceEntry_guildId_idx" ON "GuildTowerRaceEntry"("guildId");
CREATE INDEX "GuildTowerRaceEntry_totalWaves_idx" ON "GuildTowerRaceEntry"("totalWaves" DESC);

ALTER TABLE "GuildTowerRaceEntry" ADD CONSTRAINT "GuildTowerRaceEntry_raceId_fkey"
    FOREIGN KEY ("raceId") REFERENCES "GuildTowerRace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- 9. Create GuildBoss tables
-- ============================================================================

CREATE TABLE "GuildBoss" (
    "id" TEXT NOT NULL,
    "weekKey" TEXT NOT NULL,
    "bossType" TEXT NOT NULL,
    "totalHp" BIGINT NOT NULL,
    "weakness" TEXT,
    "currentHp" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuildBoss_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GuildBoss_weekKey_key" ON "GuildBoss"("weekKey");
CREATE INDEX "GuildBoss_weekKey_idx" ON "GuildBoss"("weekKey");

CREATE TABLE "GuildBossAttempt" (
    "id" TEXT NOT NULL,
    "guildBossId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "damage" BIGINT NOT NULL,
    "heroId" TEXT NOT NULL,
    "heroTier" INTEGER NOT NULL,
    "heroPower" INTEGER NOT NULL,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuildBossAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GuildBossAttempt_guildBossId_userId_attemptedAt_key" ON "GuildBossAttempt"("guildBossId", "userId", "attemptedAt");
CREATE INDEX "GuildBossAttempt_guildBossId_idx" ON "GuildBossAttempt"("guildBossId");
CREATE INDEX "GuildBossAttempt_guildId_idx" ON "GuildBossAttempt"("guildId");
CREATE INDEX "GuildBossAttempt_userId_idx" ON "GuildBossAttempt"("userId");
CREATE INDEX "GuildBossAttempt_damage_idx" ON "GuildBossAttempt"("damage" DESC);

ALTER TABLE "GuildBossAttempt" ADD CONSTRAINT "GuildBossAttempt_guildBossId_fkey"
    FOREIGN KEY ("guildBossId") REFERENCES "GuildBoss"("id") ON DELETE CASCADE ON UPDATE CASCADE;
