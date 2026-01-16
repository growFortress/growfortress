-- Migration: Replace guild XP/level system with structures
-- This removes guild XP, level, and guild coins, replacing them with 4 upgradeable structures

-- AlterEnum: Add STRUCTURE_UPGRADE transaction type
BEGIN;
CREATE TYPE "TreasuryTransactionType_new" AS ENUM ('DEPOSIT_GOLD', 'DEPOSIT_DUST', 'WITHDRAW_GOLD', 'WITHDRAW_DUST', 'BATTLE_COST', 'UPGRADE_COST', 'REWARD_DISTRIBUTION', 'SHIELD_PURCHASE', 'STRUCTURE_UPGRADE');
ALTER TABLE "GuildTreasuryLog" ALTER COLUMN "transactionType" TYPE "TreasuryTransactionType_new" USING ("transactionType"::text::"TreasuryTransactionType_new");
ALTER TYPE "TreasuryTransactionType" RENAME TO "TreasuryTransactionType_old";
ALTER TYPE "TreasuryTransactionType_new" RENAME TO "TreasuryTransactionType";
DROP TYPE "TreasuryTransactionType_old";
COMMIT;

-- Drop old level index
DROP INDEX IF EXISTS "Guild_level_idx";

-- AlterTable Guild: Remove old XP/level fields, add structure fields
ALTER TABLE "Guild"
DROP COLUMN IF EXISTS "guildCoins",
DROP COLUMN IF EXISTS "level",
DROP COLUMN IF EXISTS "techLevels",
DROP COLUMN IF EXISTS "totalXp",
DROP COLUMN IF EXISTS "xp",
ADD COLUMN IF NOT EXISTS "structureKwatera" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "structureSkarbiec" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "structureAkademia" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "structureZbrojownia" INTEGER NOT NULL DEFAULT 0;

-- AlterTable GuildMember: Remove guild coin tracking
ALTER TABLE "GuildMember"
DROP COLUMN IF EXISTS "earnedGuildCoins",
DROP COLUMN IF EXISTS "weeklyXpContributed";
