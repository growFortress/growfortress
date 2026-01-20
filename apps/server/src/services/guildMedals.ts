/**
 * Guild Medals Service
 *
 * Handles Tower Race medal distribution and wave bonus tracking.
 * Medals are awarded at the end of each week based on tower race rankings.
 */

import { prisma } from '../lib/prisma.js';
import type { GuildTowerRaceMedal } from '@prisma/client';
import {
  TOWER_RACE_MEDALS,
  getMedalTypeForRank,
  type MedalType,
  type GuildMedalStats,
} from '@arcade/protocol';

// ============================================================================
// TYPES
// ============================================================================

export interface MedalDistributionResult {
  medalsAwarded: number;
  totalCoinsDistributed: number;
  errors: string[];
}

export interface GuildMedalCollection {
  medals: GuildTowerRaceMedal[];
  stats: GuildMedalStats;
  activeBonus: {
    wavesBonus: number;
    sourceMedalType: MedalType | null;
    sourceWeekKey: string | null;
    expiresAt: Date | null;
    isActive: boolean;
  };
}

// ============================================================================
// MEDAL DISTRIBUTION
// ============================================================================

/**
 * Distribute medals to top 50 guilds in the Tower Race
 * Called by weeklyGuildReset job after race finalization
 */
export async function distributeTowerRaceMedals(
  weekKey: string,
  rankings: { guildId: string; rank: number; totalWaves: number }[]
): Promise<MedalDistributionResult> {
  const result: MedalDistributionResult = {
    medalsAwarded: 0,
    totalCoinsDistributed: 0,
    errors: [],
  };

  // Get the race record
  const race = await prisma.guildTowerRace.findUnique({
    where: { weekKey },
  });

  if (!race) {
    result.errors.push(`Race not found for week ${weekKey}`);
    return result;
  }

  // Calculate bonus expiry (one week from now)
  const bonusExpiry = new Date();
  bonusExpiry.setDate(bonusExpiry.getDate() + 7);

  // Process top 50 guilds
  for (const ranking of rankings) {
    if (ranking.rank > 50) continue; // Only top 50 get medals

    const medalType = getMedalTypeForRank(ranking.rank);
    if (!medalType) continue;

    const medalDef = TOWER_RACE_MEDALS[medalType];
    if (!medalDef) continue;

    try {
      // Use transaction to ensure atomicity
      await prisma.$transaction(async (tx) => {
        // Create medal record
        await tx.guildTowerRaceMedal.create({
          data: {
            guildId: ranking.guildId,
            weekKey,
            raceId: race.id,
            medalType,
            rank: ranking.rank,
            totalWaves: ranking.totalWaves,
            coinsAwarded: medalDef.guildCoinsReward,
          },
        });

        // Apply wave bonus for next week
        await tx.guildMedalBonus.upsert({
          where: { guildId: ranking.guildId },
          update: {
            wavesBonus: medalDef.wavesBonus,
            sourceMedalType: medalDef.id,
            sourceWeekKey: weekKey,
            expiresAt: bonusExpiry,
          },
          create: {
            guildId: ranking.guildId,
            wavesBonus: medalDef.wavesBonus,
            sourceMedalType: medalDef.id,
            sourceWeekKey: weekKey,
            expiresAt: bonusExpiry,
          },
        });

        // Add Guild Coins to treasury
        const treasury = await tx.guildTreasury.update({
          where: { guildId: ranking.guildId },
          data: {
            guildCoins: { increment: medalDef.guildCoinsReward },
          },
        });

        // Get guild leader for log entry
        const guildLeader = await tx.guildMember.findFirst({
          where: { guildId: ranking.guildId, role: 'LEADER' },
          select: { userId: true },
        });

        // Log the transaction
        await tx.guildTreasuryLog.create({
          data: {
            guildId: ranking.guildId,
            userId: guildLeader?.userId || 'SYSTEM', // Fallback to SYSTEM
            transactionType: 'REWARD_DISTRIBUTION',
            guildCoinsAmount: medalDef.guildCoinsReward,
            description: `Tower Race ${medalType} medal (Rank #${ranking.rank})`,
            referenceId: race.id,
            balanceAfterGold: treasury.gold,
            balanceAfterDust: treasury.dust,
            balanceAfterGuildCoins: treasury.guildCoins,
          },
        });
      });

      result.medalsAwarded++;
      result.totalCoinsDistributed += medalDef.guildCoinsReward;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Failed to award medal to guild ${ranking.guildId}: ${errorMsg}`);
    }
  }

  return result;
}

// ============================================================================
// ACTIVE BONUS MANAGEMENT
// ============================================================================

/**
 * Get active wave bonus for a guild
 */
export async function getActiveWaveBonus(guildId: string): Promise<{
  wavesBonus: number;
  sourceMedalType: MedalType | null;
  sourceWeekKey: string | null;
  expiresAt: Date | null;
  isActive: boolean;
}> {
  const now = new Date();

  const bonus = await prisma.guildMedalBonus.findUnique({
    where: { guildId },
  });

  if (!bonus || bonus.expiresAt <= now) {
    return {
      wavesBonus: 0,
      sourceMedalType: null,
      sourceWeekKey: null,
      expiresAt: null,
      isActive: false,
    };
  }

  return {
    wavesBonus: bonus.wavesBonus,
    sourceMedalType: bonus.sourceMedalType as MedalType | null,
    sourceWeekKey: bonus.sourceWeekKey,
    expiresAt: bonus.expiresAt,
    isActive: true,
  };
}

/**
 * Apply wave bonus multiplier to a wave count
 */
export async function applyWaveBonusMultiplier(
  guildId: string,
  baseWaves: number
): Promise<number> {
  const bonus = await getActiveWaveBonus(guildId);

  if (!bonus.isActive || bonus.wavesBonus <= 0) {
    return baseWaves;
  }

  // Apply percentage bonus (e.g., 0.10 = +10%)
  const bonusWaves = Math.floor(baseWaves * bonus.wavesBonus);
  return baseWaves + bonusWaves;
}

/**
 * Cleanup expired medal bonuses
 * Called by weekly reset job
 */
export async function cleanupExpiredBonuses(): Promise<number> {
  const now = new Date();

  const result = await prisma.guildMedalBonus.deleteMany({
    where: {
      expiresAt: { lt: now },
    },
  });

  return result.count;
}

// ============================================================================
// MEDAL COLLECTION QUERIES
// ============================================================================

/**
 * Get medal collection for a guild
 */
export async function getGuildMedalCollection(guildId: string): Promise<GuildMedalCollection> {
  const [medals, activeBonus] = await Promise.all([
    prisma.guildTowerRaceMedal.findMany({
      where: { guildId },
      orderBy: { awardedAt: 'desc' },
    }),
    getActiveWaveBonus(guildId),
  ]);

  // Calculate stats
  const stats: GuildMedalStats = {
    goldCount: 0,
    silverCount: 0,
    bronzeCount: 0,
    top10Count: 0,
    top25Count: 0,
    top50Count: 0,
    totalMedals: medals.length,
    bestRank: null,
  };

  for (const medal of medals) {
    switch (medal.medalType) {
      case 'gold':
        stats.goldCount++;
        break;
      case 'silver':
        stats.silverCount++;
        break;
      case 'bronze':
        stats.bronzeCount++;
        break;
      case 'top10':
        stats.top10Count++;
        break;
      case 'top25':
        stats.top25Count++;
        break;
      case 'top50':
        stats.top50Count++;
        break;
    }

    if (stats.bestRank === null || medal.rank < stats.bestRank) {
      stats.bestRank = medal.rank;
    }
  }

  return {
    medals,
    stats,
    activeBonus,
  };
}

/**
 * Get medals for a specific week
 */
export async function getMedalsForWeek(weekKey: string): Promise<GuildTowerRaceMedal[]> {
  return prisma.guildTowerRaceMedal.findMany({
    where: { weekKey },
    orderBy: { rank: 'asc' },
  });
}

/**
 * Check if a guild has a medal for a specific week
 */
export async function hasGuildMedalForWeek(
  guildId: string,
  weekKey: string
): Promise<boolean> {
  const medal = await prisma.guildTowerRaceMedal.findUnique({
    where: {
      guildId_weekKey: { guildId, weekKey },
    },
  });

  return medal !== null;
}

/**
 * Get medal leaderboard (guilds with most medals of each type)
 */
export async function getMedalLeaderboard(): Promise<{
  goldLeaders: { guildId: string; guildName: string; count: number }[];
  totalLeaders: { guildId: string; guildName: string; count: number }[];
}> {
  // Count gold medals per guild
  const goldCounts = await prisma.guildTowerRaceMedal.groupBy({
    by: ['guildId'],
    where: { medalType: 'gold' },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 10,
  });

  // Count total medals per guild
  const totalCounts = await prisma.guildTowerRaceMedal.groupBy({
    by: ['guildId'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 10,
  });

  // Get guild names
  const guildIds = [...new Set([
    ...goldCounts.map(g => g.guildId),
    ...totalCounts.map(g => g.guildId),
  ])];

  const guilds = await prisma.guild.findMany({
    where: { id: { in: guildIds } },
    select: { id: true, name: true },
  });

  const guildMap = new Map(guilds.map(g => [g.id, g.name]));

  return {
    goldLeaders: goldCounts.map(g => ({
      guildId: g.guildId,
      guildName: guildMap.get(g.guildId) || 'Unknown',
      count: g._count.id,
    })),
    totalLeaders: totalCounts.map(g => ({
      guildId: g.guildId,
      guildName: guildMap.get(g.guildId) || 'Unknown',
      count: g._count.id,
    })),
  };
}
