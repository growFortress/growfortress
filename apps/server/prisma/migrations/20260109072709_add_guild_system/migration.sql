-- CreateEnum
CREATE TYPE "GuildRole" AS ENUM ('LEADER', 'OFFICER', 'MEMBER');

-- CreateEnum
CREATE TYPE "GuildInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GuildBattleStatus" AS ENUM ('PENDING', 'ACCEPTED', 'IN_PROGRESS', 'RESOLVED', 'DECLINED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TreasuryTransactionType" AS ENUM ('DEPOSIT_GOLD', 'DEPOSIT_DUST', 'DEPOSIT_SIGILS', 'WITHDRAW_GOLD', 'WITHDRAW_DUST', 'WITHDRAW_SIGILS', 'BATTLE_COST', 'UPGRADE_COST', 'REWARD_DISTRIBUTION');

-- CreateTable
CREATE TABLE "Guild" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "description" TEXT DEFAULT '',
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "totalXp" INTEGER NOT NULL DEFAULT 0,
    "honor" INTEGER NOT NULL DEFAULT 1000,
    "trophies" JSONB NOT NULL DEFAULT '[]',
    "settings" JSONB NOT NULL DEFAULT '{"minLevel":1,"autoAcceptInvites":false,"battleCooldownHours":24}',
    "disbanded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guild_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuildMember" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "GuildRole" NOT NULL DEFAULT 'MEMBER',
    "totalGoldDonated" INTEGER NOT NULL DEFAULT 0,
    "totalDustDonated" INTEGER NOT NULL DEFAULT 0,
    "totalSigilsDonated" INTEGER NOT NULL DEFAULT 0,
    "weeklyXpContributed" INTEGER NOT NULL DEFAULT 0,
    "battlesParticipated" INTEGER NOT NULL DEFAULT 0,
    "battlesWon" INTEGER NOT NULL DEFAULT 0,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuildMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuildInvitation" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "inviteeId" TEXT NOT NULL,
    "status" "GuildInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "GuildInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuildTreasury" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "gold" INTEGER NOT NULL DEFAULT 0,
    "dust" INTEGER NOT NULL DEFAULT 0,
    "sigils" INTEGER NOT NULL DEFAULT 0,
    "totalGoldDeposited" BIGINT NOT NULL DEFAULT 0,
    "totalDustDeposited" BIGINT NOT NULL DEFAULT 0,
    "totalSigilsDeposited" BIGINT NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuildTreasury_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuildTreasuryLog" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "transactionType" "TreasuryTransactionType" NOT NULL,
    "goldAmount" INTEGER NOT NULL DEFAULT 0,
    "dustAmount" INTEGER NOT NULL DEFAULT 0,
    "sigilsAmount" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "referenceId" TEXT,
    "balanceAfterGold" INTEGER NOT NULL,
    "balanceAfterDust" INTEGER NOT NULL,
    "balanceAfterSigils" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuildTreasuryLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuildUpgrade" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "upgradeId" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "upgradedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuildUpgrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuildLeaderboardEntry" (
    "id" TEXT NOT NULL,
    "weekKey" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "honor" INTEGER NOT NULL,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "battlesWon" INTEGER NOT NULL DEFAULT 0,
    "battlesLost" INTEGER NOT NULL DEFAULT 0,
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuildLeaderboardEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuildBattle" (
    "id" TEXT NOT NULL,
    "challengerGuildId" TEXT NOT NULL,
    "challengedGuildId" TEXT NOT NULL,
    "challengerPower" INTEGER NOT NULL,
    "challengedPower" INTEGER NOT NULL,
    "battleFormat" TEXT NOT NULL DEFAULT 'AGGREGATE',
    "goldCost" INTEGER NOT NULL DEFAULT 0,
    "status" "GuildBattleStatus" NOT NULL DEFAULT 'PENDING',
    "seed" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "winnerGuildId" TEXT,

    CONSTRAINT "GuildBattle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuildBattleResult" (
    "id" TEXT NOT NULL,
    "battleId" TEXT NOT NULL,
    "winnerGuildId" TEXT,
    "winReason" TEXT NOT NULL,
    "challengerHonorChange" INTEGER NOT NULL,
    "challengedHonorChange" INTEGER NOT NULL,
    "challengerTotalPower" INTEGER NOT NULL,
    "challengerTotalDamage" BIGINT NOT NULL,
    "challengerMembersWon" INTEGER NOT NULL DEFAULT 0,
    "challengedTotalPower" INTEGER NOT NULL,
    "challengedTotalDamage" BIGINT NOT NULL,
    "challengedMembersWon" INTEGER NOT NULL DEFAULT 0,
    "challengerParticipants" JSONB NOT NULL,
    "challengedParticipants" JSONB NOT NULL,
    "duration" INTEGER NOT NULL,
    "resolvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuildBattleResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Guild_name_key" ON "Guild"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Guild_tag_key" ON "Guild"("tag");

-- CreateIndex
CREATE INDEX "Guild_level_idx" ON "Guild"("level");

-- CreateIndex
CREATE INDEX "Guild_honor_idx" ON "Guild"("honor" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "GuildMember_userId_key" ON "GuildMember"("userId");

-- CreateIndex
CREATE INDEX "GuildMember_guildId_idx" ON "GuildMember"("guildId");

-- CreateIndex
CREATE INDEX "GuildMember_userId_idx" ON "GuildMember"("userId");

-- CreateIndex
CREATE INDEX "GuildInvitation_guildId_idx" ON "GuildInvitation"("guildId");

-- CreateIndex
CREATE INDEX "GuildInvitation_inviteeId_idx" ON "GuildInvitation"("inviteeId");

-- CreateIndex
CREATE INDEX "GuildInvitation_status_idx" ON "GuildInvitation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "GuildTreasury_guildId_key" ON "GuildTreasury"("guildId");

-- CreateIndex
CREATE INDEX "GuildTreasuryLog_guildId_idx" ON "GuildTreasuryLog"("guildId");

-- CreateIndex
CREATE INDEX "GuildTreasuryLog_userId_idx" ON "GuildTreasuryLog"("userId");

-- CreateIndex
CREATE INDEX "GuildTreasuryLog_transactionType_idx" ON "GuildTreasuryLog"("transactionType");

-- CreateIndex
CREATE INDEX "GuildTreasuryLog_createdAt_idx" ON "GuildTreasuryLog"("createdAt");

-- CreateIndex
CREATE INDEX "GuildUpgrade_guildId_idx" ON "GuildUpgrade"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "GuildUpgrade_guildId_upgradeId_key" ON "GuildUpgrade"("guildId", "upgradeId");

-- CreateIndex
CREATE INDEX "GuildLeaderboardEntry_weekKey_honor_idx" ON "GuildLeaderboardEntry"("weekKey", "honor" DESC);

-- CreateIndex
CREATE INDEX "GuildLeaderboardEntry_weekKey_totalScore_idx" ON "GuildLeaderboardEntry"("weekKey", "totalScore" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "GuildLeaderboardEntry_weekKey_guildId_key" ON "GuildLeaderboardEntry"("weekKey", "guildId");

-- CreateIndex
CREATE INDEX "GuildBattle_challengerGuildId_idx" ON "GuildBattle"("challengerGuildId");

-- CreateIndex
CREATE INDEX "GuildBattle_challengedGuildId_idx" ON "GuildBattle"("challengedGuildId");

-- CreateIndex
CREATE INDEX "GuildBattle_status_idx" ON "GuildBattle"("status");

-- CreateIndex
CREATE INDEX "GuildBattle_challengerGuildId_challengedGuildId_createdAt_idx" ON "GuildBattle"("challengerGuildId", "challengedGuildId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GuildBattleResult_battleId_key" ON "GuildBattleResult"("battleId");

-- CreateIndex
CREATE INDEX "GuildBattleResult_winnerGuildId_idx" ON "GuildBattleResult"("winnerGuildId");

-- AddForeignKey
ALTER TABLE "GuildMember" ADD CONSTRAINT "GuildMember_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildMember" ADD CONSTRAINT "GuildMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildInvitation" ADD CONSTRAINT "GuildInvitation_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildInvitation" ADD CONSTRAINT "GuildInvitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildInvitation" ADD CONSTRAINT "GuildInvitation_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildTreasury" ADD CONSTRAINT "GuildTreasury_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildTreasuryLog" ADD CONSTRAINT "GuildTreasuryLog_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildTreasuryLog" ADD CONSTRAINT "GuildTreasuryLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildUpgrade" ADD CONSTRAINT "GuildUpgrade_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildLeaderboardEntry" ADD CONSTRAINT "GuildLeaderboardEntry_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildBattle" ADD CONSTRAINT "GuildBattle_challengerGuildId_fkey" FOREIGN KEY ("challengerGuildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildBattle" ADD CONSTRAINT "GuildBattle_challengedGuildId_fkey" FOREIGN KEY ("challengedGuildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildBattleResult" ADD CONSTRAINT "GuildBattleResult_battleId_fkey" FOREIGN KEY ("battleId") REFERENCES "GuildBattle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
