-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('BUG_REPORT', 'ACCOUNT_ISSUE', 'PAYMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "GuildAccessMode" AS ENUM ('OPEN', 'APPLY', 'INVITE_ONLY', 'CLOSED');

-- CreateEnum
CREATE TYPE "GuildApplicationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GachaType" AS ENUM ('HERO', 'ARTIFACT');

-- AlterEnum
ALTER TYPE "ProductType" ADD VALUE 'BUNDLE';

-- AlterEnum
ALTER TYPE "TreasuryTransactionType" ADD VALUE 'BATTLE_REWARD';

-- AlterTable
ALTER TABLE "GuildTreasury" ADD COLUMN     "guildCoins" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "GuildTreasuryLog" ADD COLUMN     "balanceAfterGuildCoins" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "guildCoinsAmount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ColonyProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "colonyLevels" JSONB NOT NULL DEFAULT '{"farm":0,"mine":0,"market":0,"factory":0}',
    "lastClaimAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pendingGold" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ColonyProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerMilestones" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievedIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "claimedIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "goldMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "damageMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "hpMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "bonusHeroSlots" INTEGER NOT NULL DEFAULT 0,
    "unlockedFeatures" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerMilestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "TicketCategory" NOT NULL,
    "subject" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketResponse" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "userId" TEXT,
    "content" TEXT NOT NULL,
    "isStaff" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuildApplication" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "status" "GuildApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "respondedBy" TEXT,

    CONSTRAINT "GuildApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserEnergy" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentEnergy" INTEGER NOT NULL DEFAULT 50,
    "maxEnergy" INTEGER NOT NULL DEFAULT 50,
    "lastRegenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserEnergy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPillarUnlocks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "unlockedPillars" TEXT[] DEFAULT ARRAY['streets']::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPillarUnlocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GachaPull" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gachaType" "GachaType" NOT NULL,
    "rarity" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "isNew" BOOLEAN NOT NULL DEFAULT true,
    "dustSpent" INTEGER NOT NULL,
    "pityCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GachaPull_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GachaProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "heroPityCount" INTEGER NOT NULL DEFAULT 0,
    "heroSparkCount" INTEGER NOT NULL DEFAULT 0,
    "heroShards" INTEGER NOT NULL DEFAULT 0,
    "artifactPity" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GachaProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BattlePassSeason" (
    "id" TEXT NOT NULL,
    "seasonNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "featuredReward" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BattlePassSeason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BattlePassProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "currentTier" INTEGER NOT NULL DEFAULT 0,
    "currentPoints" INTEGER NOT NULL DEFAULT 0,
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "claimedFreeTiers" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "claimedPremiumTiers" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "purchasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BattlePassProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BonusCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "rewardGold" INTEGER NOT NULL DEFAULT 0,
    "rewardDust" INTEGER NOT NULL DEFAULT 0,
    "rewardEnergy" INTEGER NOT NULL DEFAULT 0,
    "rewardMaterials" JSONB NOT NULL DEFAULT '{}',
    "maxRedemptions" INTEGER,
    "redemptionCount" INTEGER NOT NULL DEFAULT 0,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BonusCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BonusCodeRedemption" (
    "id" TEXT NOT NULL,
    "codeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rewardsGiven" JSONB NOT NULL,

    CONSTRAINT "BonusCodeRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ColonyProgress_userId_key" ON "ColonyProgress"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerMilestones_userId_key" ON "PlayerMilestones"("userId");

-- CreateIndex
CREATE INDEX "SupportTicket_userId_idx" ON "SupportTicket"("userId");

-- CreateIndex
CREATE INDEX "SupportTicket_status_idx" ON "SupportTicket"("status");

-- CreateIndex
CREATE INDEX "SupportTicket_createdAt_idx" ON "SupportTicket"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "TicketResponse_ticketId_idx" ON "TicketResponse"("ticketId");

-- CreateIndex
CREATE INDEX "GuildApplication_guildId_idx" ON "GuildApplication"("guildId");

-- CreateIndex
CREATE INDEX "GuildApplication_applicantId_idx" ON "GuildApplication"("applicantId");

-- CreateIndex
CREATE INDEX "GuildApplication_status_idx" ON "GuildApplication"("status");

-- CreateIndex
CREATE UNIQUE INDEX "UserEnergy_userId_key" ON "UserEnergy"("userId");

-- CreateIndex
CREATE INDEX "UserEnergy_userId_idx" ON "UserEnergy"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPillarUnlocks_userId_key" ON "UserPillarUnlocks"("userId");

-- CreateIndex
CREATE INDEX "UserPillarUnlocks_userId_idx" ON "UserPillarUnlocks"("userId");

-- CreateIndex
CREATE INDEX "GachaPull_userId_idx" ON "GachaPull"("userId");

-- CreateIndex
CREATE INDEX "GachaPull_gachaType_idx" ON "GachaPull"("gachaType");

-- CreateIndex
CREATE INDEX "GachaPull_createdAt_idx" ON "GachaPull"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GachaProgress_userId_key" ON "GachaProgress"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BattlePassSeason_seasonNumber_key" ON "BattlePassSeason"("seasonNumber");

-- CreateIndex
CREATE INDEX "BattlePassProgress_userId_idx" ON "BattlePassProgress"("userId");

-- CreateIndex
CREATE INDEX "BattlePassProgress_seasonId_idx" ON "BattlePassProgress"("seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "BattlePassProgress_userId_seasonId_key" ON "BattlePassProgress"("userId", "seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "BonusCode_code_key" ON "BonusCode"("code");

-- CreateIndex
CREATE INDEX "BonusCode_code_idx" ON "BonusCode"("code");

-- CreateIndex
CREATE INDEX "BonusCode_isActive_idx" ON "BonusCode"("isActive");

-- CreateIndex
CREATE INDEX "BonusCodeRedemption_userId_idx" ON "BonusCodeRedemption"("userId");

-- CreateIndex
CREATE INDEX "BonusCodeRedemption_codeId_idx" ON "BonusCodeRedemption"("codeId");

-- CreateIndex
CREATE UNIQUE INDEX "BonusCodeRedemption_codeId_userId_key" ON "BonusCodeRedemption"("codeId", "userId");

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColonyProgress" ADD CONSTRAINT "ColonyProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerMilestones" ADD CONSTRAINT "PlayerMilestones_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketResponse" ADD CONSTRAINT "TicketResponse_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildApplication" ADD CONSTRAINT "GuildApplication_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildApplication" ADD CONSTRAINT "GuildApplication_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildApplication" ADD CONSTRAINT "GuildApplication_respondedBy_fkey" FOREIGN KEY ("respondedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserEnergy" ADD CONSTRAINT "UserEnergy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPillarUnlocks" ADD CONSTRAINT "UserPillarUnlocks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GachaPull" ADD CONSTRAINT "GachaPull_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GachaProgress" ADD CONSTRAINT "GachaProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattlePassProgress" ADD CONSTRAINT "BattlePassProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattlePassProgress" ADD CONSTRAINT "BattlePassProgress_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "BattlePassSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonusCodeRedemption" ADD CONSTRAINT "BonusCodeRedemption_codeId_fkey" FOREIGN KEY ("codeId") REFERENCES "BonusCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
