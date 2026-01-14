-- Migration: Remove sigils and convert to dust (10:1 ratio)
-- Dust becomes the premium currency

-- Step 1: Convert sigils to dust in Inventory (10:1 ratio)
UPDATE "Inventory" SET dust = dust + (sigils * 10) WHERE sigils > 0;

-- Step 2: Drop sigils column from Inventory
ALTER TABLE "Inventory" DROP COLUMN IF EXISTS "sigils";

-- Step 3: Convert sigils to dust in GuildTreasury (10:1 ratio)
UPDATE "GuildTreasury" SET dust = dust + (sigils * 10) WHERE sigils > 0;

-- Step 4: Drop sigils columns from GuildTreasury
ALTER TABLE "GuildTreasury" DROP COLUMN IF EXISTS "sigils";
ALTER TABLE "GuildTreasury" DROP COLUMN IF EXISTS "totalSigilsDeposited";

-- Step 5: Update GuildTreasuryLog - convert sigilsAmount to dustAmount and drop column
UPDATE "GuildTreasuryLog" SET "dustAmount" = "dustAmount" + ("sigilsAmount" * 10) WHERE "sigilsAmount" > 0;
UPDATE "GuildTreasuryLog" SET "balanceAfterDust" = "balanceAfterDust" + ("balanceAfterSigils" * 10) WHERE "balanceAfterSigils" > 0;
ALTER TABLE "GuildTreasuryLog" DROP COLUMN IF EXISTS "sigilsAmount";
ALTER TABLE "GuildTreasuryLog" DROP COLUMN IF EXISTS "balanceAfterSigils";

-- Step 6: Update WeeklyPlayerReward - convert sigilsAmount to dustAmount and drop column
UPDATE "WeeklyPlayerReward" SET "dustAmount" = "dustAmount" + ("sigilsAmount" * 10) WHERE "sigilsAmount" > 0;
ALTER TABLE "WeeklyPlayerReward" DROP COLUMN IF EXISTS "sigilsAmount";

-- Step 7: Drop totalSigilsDonated from GuildMember
ALTER TABLE "GuildMember" DROP COLUMN IF EXISTS "totalSigilsDonated";

-- Step 8: Update TreasuryTransactionType enum (remove DEPOSIT_SIGILS, WITHDRAW_SIGILS)
-- First update any existing records with sigil transaction types to their dust equivalents
UPDATE "GuildTreasuryLog" SET "transactionType" = 'DEPOSIT_DUST' WHERE "transactionType" = 'DEPOSIT_SIGILS';
UPDATE "GuildTreasuryLog" SET "transactionType" = 'WITHDRAW_DUST' WHERE "transactionType" = 'WITHDRAW_SIGILS';
