-- AlterTable
ALTER TABLE "User"
ADD COLUMN     "buildPresets" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "activePresetId" TEXT;
