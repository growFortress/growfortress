-- Rename Mastery table to Progression
ALTER TABLE "Mastery" RENAME TO "Progression";

-- Add totalXp column with default 0
ALTER TABLE "Progression" ADD COLUMN "totalXp" INTEGER NOT NULL DEFAULT 0;

-- Update totalXp based on existing level and xp
-- Using the old mastery formula: 100 * 1.5^(level-1) for XP per level
-- For simplicity, set totalXp = xp for now (data migration can be refined later)
UPDATE "Progression" SET "totalXp" = "xp";

-- Rename the unique constraint
ALTER INDEX "Mastery_userId_key" RENAME TO "Progression_userId_key";

-- Rename the foreign key constraint
ALTER TABLE "Progression" RENAME CONSTRAINT "Mastery_userId_fkey" TO "Progression_userId_fkey";
