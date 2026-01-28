-- Add prestige system columns to ColonyProgress table
-- These columns support the "Stellar Rebirth" prestige mechanic

ALTER TABLE "ColonyProgress" ADD COLUMN "stellarPoints" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ColonyProgress" ADD COLUMN "totalGoldEarned" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "ColonyProgress" ADD COLUMN "prestigeCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ColonyProgress" ADD COLUMN "lastPrestigeAt" TIMESTAMP(3);
