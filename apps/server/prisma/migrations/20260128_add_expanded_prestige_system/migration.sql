-- Migration: Add expanded prestige system columns to PowerUpgrades
-- Adds: ascensionLevel, ascensionBonuses, transcendenceLevel, transcendencePerks, essenceBalance

-- Ascension system: unlocked when all 3 fortress prestige stats reach max (5)
ALTER TABLE "PowerUpgrades" ADD COLUMN IF NOT EXISTS "ascensionLevel" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PowerUpgrades" ADD COLUMN IF NOT EXISTS "ascensionBonuses" JSONB NOT NULL DEFAULT '{}';

-- Transcendence system: unlocked at Ascension Level 3
ALTER TABLE "PowerUpgrades" ADD COLUMN IF NOT EXISTS "transcendenceLevel" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PowerUpgrades" ADD COLUMN IF NOT EXISTS "transcendencePerks" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Essence: premium currency earned from transcendence
ALTER TABLE "PowerUpgrades" ADD COLUMN IF NOT EXISTS "essenceBalance" INTEGER NOT NULL DEFAULT 0;
