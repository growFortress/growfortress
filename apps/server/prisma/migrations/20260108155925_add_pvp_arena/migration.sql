-- CreateEnum
CREATE TYPE "PvpChallengeStatus" AS ENUM ('PENDING', 'ACCEPTED', 'RESOLVED', 'DECLINED', 'EXPIRED', 'CANCELLED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "pvpLosses" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pvpWins" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PvpChallenge" (
    "id" TEXT NOT NULL,
    "challengerId" TEXT NOT NULL,
    "challengedId" TEXT NOT NULL,
    "challengerPower" INTEGER NOT NULL,
    "challengedPower" INTEGER NOT NULL,
    "status" "PvpChallengeStatus" NOT NULL DEFAULT 'PENDING',
    "seed" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "winnerId" TEXT,

    CONSTRAINT "PvpChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PvpResult" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "winnerId" TEXT,
    "winReason" TEXT NOT NULL,
    "challengerFinalHp" INTEGER NOT NULL,
    "challengerDamageDealt" INTEGER NOT NULL,
    "challengerHeroesAlive" INTEGER NOT NULL,
    "challengedFinalHp" INTEGER NOT NULL,
    "challengedDamageDealt" INTEGER NOT NULL,
    "challengedHeroesAlive" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL,
    "challengerBuild" JSONB NOT NULL,
    "challengedBuild" JSONB NOT NULL,
    "replayEvents" JSONB,
    "resolvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PvpResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PvpChallenge_challengerId_idx" ON "PvpChallenge"("challengerId");

-- CreateIndex
CREATE INDEX "PvpChallenge_challengedId_idx" ON "PvpChallenge"("challengedId");

-- CreateIndex
CREATE INDEX "PvpChallenge_status_idx" ON "PvpChallenge"("status");

-- CreateIndex
CREATE INDEX "PvpChallenge_challengerId_challengedId_createdAt_idx" ON "PvpChallenge"("challengerId", "challengedId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PvpResult_challengeId_key" ON "PvpResult"("challengeId");

-- CreateIndex
CREATE INDEX "PvpResult_winnerId_idx" ON "PvpResult"("winnerId");

-- AddForeignKey
ALTER TABLE "PvpChallenge" ADD CONSTRAINT "PvpChallenge_challengerId_fkey" FOREIGN KEY ("challengerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PvpChallenge" ADD CONSTRAINT "PvpChallenge_challengedId_fkey" FOREIGN KEY ("challengedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PvpResult" ADD CONSTRAINT "PvpResult_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "PvpChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
