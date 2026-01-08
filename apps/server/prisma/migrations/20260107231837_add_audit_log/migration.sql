/*
  Warnings:

  - You are about to drop the column `guestKey` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `RelicUnlock` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[username]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[activeGameSessionId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `displayName` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `passwordHash` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `username` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- DropForeignKey
ALTER TABLE "RelicUnlock" DROP CONSTRAINT "RelicUnlock_userId_fkey";

-- DropIndex
DROP INDEX "User_guestKey_key";

-- AlterTable
ALTER TABLE "Inventory" ADD COLUMN     "items" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "materials" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "Progression" RENAME CONSTRAINT "Mastery_pkey" TO "Progression_pkey";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "guestKey",
ADD COLUMN     "activeGameSessionId" TEXT,
ADD COLUMN     "banned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "currentWave" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "defaultFortressClass" TEXT,
ADD COLUMN     "defaultHeroId" TEXT,
ADD COLUMN     "defaultTurretType" TEXT,
ADD COLUMN     "displayName" TEXT NOT NULL,
ADD COLUMN     "highestWave" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastIdleClaimAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "passwordHash" TEXT NOT NULL,
ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'USER',
ADD COLUMN     "username" TEXT NOT NULL;

-- DropTable
DROP TABLE "RelicUnlock";

-- CreateTable
CREATE TABLE "GameSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seed" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startingWave" INTEGER NOT NULL DEFAULT 0,
    "currentWave" INTEGER NOT NULL DEFAULT 0,
    "lastVerifiedWave" INTEGER NOT NULL DEFAULT 0,
    "lastSegmentHash" INTEGER NOT NULL DEFAULT 0,
    "endedAt" TIMESTAMP(3),
    "endReason" TEXT,

    CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Segment" (
    "id" TEXT NOT NULL,
    "gameSessionId" TEXT NOT NULL,
    "startWave" INTEGER NOT NULL,
    "endWave" INTEGER NOT NULL,
    "eventsJson" JSONB NOT NULL,
    "checkpointsJson" JSONB NOT NULL,
    "finalHash" INTEGER NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "goldEarned" INTEGER NOT NULL DEFAULT 0,
    "dustEarned" INTEGER NOT NULL DEFAULT 0,
    "xpEarned" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Segment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerArtifact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "equippedToHeroId" TEXT,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PowerUpgrades" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fortressUpgrades" JSONB NOT NULL DEFAULT '{"statUpgrades":{"hp":0,"damage":0,"attackSpeed":0,"range":0,"critChance":0,"critMultiplier":0,"armor":0,"dodge":0}}',
    "heroUpgrades" JSONB NOT NULL DEFAULT '[]',
    "turretUpgrades" JSONB NOT NULL DEFAULT '[]',
    "itemTiers" JSONB NOT NULL DEFAULT '[]',
    "cachedTotalPower" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PowerUpgrades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GameSession_userId_idx" ON "GameSession"("userId");

-- CreateIndex
CREATE INDEX "Segment_gameSessionId_idx" ON "Segment"("gameSessionId");

-- CreateIndex
CREATE INDEX "PlayerArtifact_userId_idx" ON "PlayerArtifact"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerArtifact_userId_artifactId_key" ON "PlayerArtifact"("userId", "artifactId");

-- CreateIndex
CREATE UNIQUE INDEX "PowerUpgrades_userId_key" ON "PowerUpgrades"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_adminId_idx" ON "AuditLog"("adminId");

-- CreateIndex
CREATE INDEX "AuditLog_targetId_idx" ON "AuditLog"("targetId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_activeGameSessionId_key" ON "User"("activeGameSessionId");

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Segment" ADD CONSTRAINT "Segment_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerArtifact" ADD CONSTRAINT "PlayerArtifact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PowerUpgrades" ADD CONSTRAINT "PowerUpgrades_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
