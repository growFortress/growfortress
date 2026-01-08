-- Add unlocked heroes and turrets arrays to Inventory
ALTER TABLE "Inventory" ADD COLUMN "unlockedHeroIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Inventory" ADD COLUMN "unlockedTurretIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
