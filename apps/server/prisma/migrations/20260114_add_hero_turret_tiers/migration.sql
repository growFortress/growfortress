-- AlterTable
ALTER TABLE "PowerUpgrades" ADD COLUMN "heroTiers" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "PowerUpgrades" ADD COLUMN "turretTiers" JSONB NOT NULL DEFAULT '{}';
