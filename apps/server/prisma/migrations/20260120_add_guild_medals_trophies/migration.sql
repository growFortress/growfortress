-- CreateTable: GuildTowerRaceMedal
-- Weekly medals awarded to top guilds in Tower Race
CREATE TABLE "GuildTowerRaceMedal" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "weekKey" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "medalType" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "totalWaves" INTEGER NOT NULL,
    "coinsAwarded" INTEGER NOT NULL DEFAULT 0,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuildTowerRaceMedal_pkey" PRIMARY KEY ("id")
);

-- CreateTable: GuildMedalBonus
-- Active wave bonus from medals (expires after one week)
CREATE TABLE "GuildMedalBonus" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "wavesBonus" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sourceMedalType" TEXT,
    "sourceWeekKey" TEXT,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuildMedalBonus_pkey" PRIMARY KEY ("id")
);

-- CreateTable: GuildBattleTrophy
-- Trophies earned from Arena 5v5 battles
CREATE TABLE "GuildBattleTrophy" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "trophyId" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "tier" INTEGER NOT NULL DEFAULT 1,
    "maxTier" INTEGER NOT NULL DEFAULT 1,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "upgradedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "GuildBattleTrophy_pkey" PRIMARY KEY ("id")
);

-- CreateTable: GuildBattleStreak
-- Win/loss streaks and rivalry tracking for guilds
CREATE TABLE "GuildBattleStreak" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "currentWinStreak" INTEGER NOT NULL DEFAULT 0,
    "currentLossStreak" INTEGER NOT NULL DEFAULT 0,
    "bestWinStreak" INTEGER NOT NULL DEFAULT 0,
    "bestLossStreak" INTEGER NOT NULL DEFAULT 0,
    "rivalryStats" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuildBattleStreak_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: GuildTowerRaceMedal
CREATE UNIQUE INDEX "GuildTowerRaceMedal_guildId_weekKey_key" ON "GuildTowerRaceMedal"("guildId", "weekKey");
CREATE INDEX "GuildTowerRaceMedal_guildId_idx" ON "GuildTowerRaceMedal"("guildId");
CREATE INDEX "GuildTowerRaceMedal_weekKey_idx" ON "GuildTowerRaceMedal"("weekKey");
CREATE INDEX "GuildTowerRaceMedal_medalType_idx" ON "GuildTowerRaceMedal"("medalType");

-- CreateIndex: GuildMedalBonus
CREATE UNIQUE INDEX "GuildMedalBonus_guildId_key" ON "GuildMedalBonus"("guildId");
CREATE INDEX "GuildMedalBonus_guildId_idx" ON "GuildMedalBonus"("guildId");
CREATE INDEX "GuildMedalBonus_expiresAt_idx" ON "GuildMedalBonus"("expiresAt");

-- CreateIndex: GuildBattleTrophy
CREATE UNIQUE INDEX "GuildBattleTrophy_guildId_trophyId_key" ON "GuildBattleTrophy"("guildId", "trophyId");
CREATE INDEX "GuildBattleTrophy_guildId_idx" ON "GuildBattleTrophy"("guildId");
CREATE INDEX "GuildBattleTrophy_trophyId_idx" ON "GuildBattleTrophy"("trophyId");

-- CreateIndex: GuildBattleStreak
CREATE UNIQUE INDEX "GuildBattleStreak_guildId_key" ON "GuildBattleStreak"("guildId");
CREATE INDEX "GuildBattleStreak_guildId_idx" ON "GuildBattleStreak"("guildId");
CREATE INDEX "GuildBattleStreak_currentWinStreak_idx" ON "GuildBattleStreak"("currentWinStreak" DESC);

-- AddForeignKey: GuildTowerRaceMedal -> GuildTowerRace
ALTER TABLE "GuildTowerRaceMedal" ADD CONSTRAINT "GuildTowerRaceMedal_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "GuildTowerRace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
