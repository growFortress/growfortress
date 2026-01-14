-- Add purchasable slot columns to Progression table
ALTER TABLE "Progression" ADD COLUMN "purchasedHeroSlots" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "Progression" ADD COLUMN "purchasedTurretSlots" INTEGER NOT NULL DEFAULT 1;

-- Backfill for existing players based on their current level
-- This grants them the slots they would have earned under the old system
UPDATE "Progression"
SET "purchasedHeroSlots" =
  CASE
    WHEN "level" >= 45 THEN 4
    WHEN "level" >= 30 THEN 3
    WHEN "level" >= 10 THEN 2
    ELSE 2  -- New default is 2 (was 1 under old system)
  END;

-- Turret slots backfill based on old unlock levels
UPDATE "Progression"
SET "purchasedTurretSlots" =
  CASE
    WHEN "level" >= 40 THEN 6
    WHEN "level" >= 35 THEN 5
    WHEN "level" >= 25 THEN 4
    WHEN "level" >= 15 THEN 3
    WHEN "level" >= 5 THEN 2
    ELSE 1
  END;
