/**
 * Player Leaderboard Service
 * Handles permanent rankings (totalWaves, honor, level) and weekly rankings
 */

import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";
import { getCurrentWeekKey } from "../lib/queue.js";
import { getRewardTierForRank } from "@arcade/sim-core";

// Cache keys and TTLs
const CACHE_TTL = 300; // 5 minutes
const MAX_CACHED_ENTRIES = 100;

const CACHE_KEYS = {
  totalWaves: "player-leaderboard:totalWaves",
  honor: "player-leaderboard:honor",
  level: "player-leaderboard:level",
  weeklyWaves: (weekKey: string) => `player-leaderboard:weeklyWaves:${weekKey}`,
  weeklyHonor: (weekKey: string) => `player-leaderboard:weeklyHonor:${weekKey}`,
} as const;

// Leaderboard category types
export type PermanentLeaderboardCategory = "totalWaves" | "honor" | "level";
export type WeeklyLeaderboardCategory = "weeklyWaves" | "weeklyHonor";
export type LeaderboardCategory =
  | PermanentLeaderboardCategory
  | WeeklyLeaderboardCategory;

// Entry interfaces
export interface PlayerLeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  guildId: string | null;
  guildTag: string | null;
  level: number;
  score: number;
  exclusiveItems: string[];
  rankChange?: number; // +/- from previous position
}

export interface UserRankInfo {
  category: LeaderboardCategory;
  rank: number | null;
  score: number;
  rankChange?: number;
}

export interface AvailableReward {
  id: string;
  weekKey: string;
  category: "waves" | "honor";
  rank: number;
  goldAmount: number;
  dustAmount: number;
  itemIds: string[];
  expiresAt: string;
}

export interface ClaimRewardResult {
  success: boolean;
  goldAmount: number;
  dustAmount: number;
  itemIds: string[];
  newExclusiveItems: string[];
}

// ==========================================
// PERMANENT LEADERBOARDS
// ==========================================

/**
 * Get total waves leaderboard (sum of all waves ever)
 */
export async function getTotalWavesLeaderboard(
  limit: number = 25,
  offset: number = 0,
): Promise<{ entries: PlayerLeaderboardEntry[]; total: number }> {
  return getCachedPermanentLeaderboard(
    "totalWaves",
    limit,
    offset,
    async () => {
      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where: { totalWaves: { gt: 0 }, banned: false },
          orderBy: { totalWaves: "desc" },
          take: MAX_CACHED_ENTRIES,
          select: {
            id: true,
            displayName: true,
            totalWaves: true,
            exclusiveItems: true,
            guildMembership: {
              select: { guildId: true, guild: { select: { tag: true } } },
            },
            progression: {
              select: { level: true },
            },
          },
        }),
        prisma.user.count({ where: { totalWaves: { gt: 0 }, banned: false } }),
      ]);

      return {
        entries: users.map((user, index) => ({
          rank: index + 1,
          userId: user.id,
          displayName: user.displayName,
          guildId: user.guildMembership?.guildId ?? null,
          guildTag: user.guildMembership?.guild.tag ?? null,
          level: user.progression?.level ?? 1,
          score: user.totalWaves,
          exclusiveItems: user.exclusiveItems,
        })),
        total,
      };
    },
  );
}

/**
 * Get honor leaderboard (PvP ranking)
 */
export async function getHonorLeaderboard(
  limit: number = 25,
  offset: number = 0,
): Promise<{ entries: PlayerLeaderboardEntry[]; total: number }> {
  return getCachedPermanentLeaderboard("honor", limit, offset, async () => {
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: { banned: false },
        orderBy: { honor: "desc" },
        take: MAX_CACHED_ENTRIES,
        select: {
          id: true,
          displayName: true,
          honor: true,
          exclusiveItems: true,
          guildMembership: {
            select: { guildId: true, guild: { select: { tag: true } } },
          },
          progression: {
            select: { level: true },
          },
        },
      }),
      prisma.user.count({ where: { banned: false } }),
    ]);

    return {
      entries: users.map((user, index) => ({
        rank: index + 1,
        userId: user.id,
        displayName: user.displayName,
        guildId: user.guildMembership?.guildId ?? null,
        guildTag: user.guildMembership?.guild.tag ?? null,
        level: user.progression?.level ?? 1,
        score: user.honor,
        exclusiveItems: user.exclusiveItems,
      })),
      total,
    };
  });
}

/**
 * Get level leaderboard (fortress level)
 */
export async function getLevelLeaderboard(
  limit: number = 25,
  offset: number = 0,
): Promise<{ entries: PlayerLeaderboardEntry[]; total: number }> {
  return getCachedPermanentLeaderboard("level", limit, offset, async () => {
    const [progressions, total] = await Promise.all([
      prisma.progression.findMany({
        where: { user: { banned: false } },
        orderBy: { level: "desc" },
        take: MAX_CACHED_ENTRIES,
        select: {
          level: true,
          user: {
            select: {
              id: true,
              displayName: true,
              exclusiveItems: true,
              guildMembership: {
                select: { guildId: true, guild: { select: { tag: true } } },
              },
            },
          },
        },
      }),
      prisma.progression.count({ where: { user: { banned: false } } }),
    ]);

    return {
      entries: progressions.map((p, index) => ({
        rank: index + 1,
        userId: p.user.id,
        displayName: p.user.displayName,
        guildId: p.user.guildMembership?.guildId ?? null,
        guildTag: p.user.guildMembership?.guild.tag ?? null,
        level: p.level,
        score: p.level,
        exclusiveItems: p.user.exclusiveItems,
      })),
      total,
    };
  });
}

// ==========================================
// WEEKLY LEADERBOARDS
// ==========================================

/**
 * Get weekly waves leaderboard
 */
export async function getWeeklyWavesLeaderboard(
  weekKey: string = getCurrentWeekKey(),
  limit: number = 25,
  offset: number = 0,
): Promise<{
  entries: PlayerLeaderboardEntry[];
  total: number;
  weekKey: string;
}> {
  const cacheKey = CACHE_KEYS.weeklyWaves(weekKey);
  const cached = await redis.get(cacheKey);

  let data: { entries: PlayerLeaderboardEntry[]; total: number };

  if (cached) {
    data = JSON.parse(cached);
  } else {
    const [entries, total] = await Promise.all([
      prisma.weeklyPlayerLeaderboard.findMany({
        where: { weekKey, wavesThisWeek: { gt: 0 }, user: { banned: false } },
        orderBy: { wavesThisWeek: "desc" },
        take: MAX_CACHED_ENTRIES,
        select: {
          userId: true,
          wavesThisWeek: true,
          user: {
            select: {
              displayName: true,
              exclusiveItems: true,
              guildMembership: {
                select: { guildId: true, guild: { select: { tag: true } } },
              },
              progression: {
                select: { level: true },
              },
            },
          },
        },
      }),
      prisma.weeklyPlayerLeaderboard.count({
        where: { weekKey, wavesThisWeek: { gt: 0 }, user: { banned: false } },
      }),
    ]);

    data = {
      entries: entries.map((entry, index) => ({
        rank: index + 1,
        userId: entry.userId,
        displayName: entry.user.displayName,
        guildId: entry.user.guildMembership?.guildId ?? null,
        guildTag: entry.user.guildMembership?.guild.tag ?? null,
        level: entry.user.progression?.level ?? 1,
        score: entry.wavesThisWeek,
        exclusiveItems: entry.user.exclusiveItems,
      })),
      total,
    };

    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(data));
  }

  // Paginate in memory
  const paginatedEntries = data.entries
    .slice(offset, offset + limit)
    .map((entry, index) => ({
      ...entry,
      rank: offset + index + 1,
    }));

  return {
    entries: paginatedEntries,
    total: data.total,
    weekKey,
  };
}

/**
 * Get weekly honor leaderboard
 */
export async function getWeeklyHonorLeaderboard(
  weekKey: string = getCurrentWeekKey(),
  limit: number = 25,
  offset: number = 0,
): Promise<{
  entries: PlayerLeaderboardEntry[];
  total: number;
  weekKey: string;
}> {
  const cacheKey = CACHE_KEYS.weeklyHonor(weekKey);
  const cached = await redis.get(cacheKey);

  let data: { entries: PlayerLeaderboardEntry[]; total: number };

  if (cached) {
    data = JSON.parse(cached);
  } else {
    const [entries, total] = await Promise.all([
      prisma.weeklyPlayerLeaderboard.findMany({
        where: { weekKey, honorGained: { gt: 0 }, user: { banned: false } },
        orderBy: { honorGained: "desc" },
        take: MAX_CACHED_ENTRIES,
        select: {
          userId: true,
          honorGained: true,
          user: {
            select: {
              displayName: true,
              exclusiveItems: true,
              guildMembership: {
                select: { guildId: true, guild: { select: { tag: true } } },
              },
              progression: {
                select: { level: true },
              },
            },
          },
        },
      }),
      prisma.weeklyPlayerLeaderboard.count({
        where: { weekKey, honorGained: { gt: 0 }, user: { banned: false } },
      }),
    ]);

    data = {
      entries: entries.map((entry, index) => ({
        rank: index + 1,
        userId: entry.userId,
        displayName: entry.user.displayName,
        guildId: entry.user.guildMembership?.guildId ?? null,
        guildTag: entry.user.guildMembership?.guild.tag ?? null,
        level: entry.user.progression?.level ?? 1,
        score: entry.honorGained,
        exclusiveItems: entry.user.exclusiveItems,
      })),
      total,
    };

    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(data));
  }

  // Paginate in memory
  const paginatedEntries = data.entries
    .slice(offset, offset + limit)
    .map((entry, index) => ({
      ...entry,
      rank: offset + index + 1,
    }));

  return {
    entries: paginatedEntries,
    total: data.total,
    weekKey,
  };
}

// ==========================================
// USER RANKS
// ==========================================

/**
 * Get user's ranks across all leaderboard categories
 */
export async function getUserRanks(
  userId: string,
  weekKey: string = getCurrentWeekKey(),
): Promise<UserRankInfo[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      totalWaves: true,
      honor: true,
      progression: {
        select: { level: true },
      },
      weeklyPlayerLeaderboards: {
        where: { weekKey },
        select: {
          wavesThisWeek: true,
          honorGained: true,
        },
      },
    },
  });

  if (!user) {
    return [];
  }

  const weeklyData = user.weeklyPlayerLeaderboards[0];

  // Get ranks in parallel
  const [
    totalWavesRank,
    honorRank,
    levelRank,
    weeklyWavesRank,
    weeklyHonorRank,
  ] = await Promise.all([
    // Total waves rank
    user.totalWaves > 0
      ? prisma.user.count({
          where: {
            totalWaves: { gt: user.totalWaves },
            banned: false,
          },
        })
      : null,
    // Honor rank
    prisma.user.count({
      where: {
        honor: { gt: user.honor },
        banned: false,
      },
    }),
    // Level rank
    user.progression
      ? prisma.progression.count({
          where: {
            level: { gt: user.progression.level },
            user: { banned: false },
          },
        })
      : null,
    // Weekly waves rank
    weeklyData && weeklyData.wavesThisWeek > 0
      ? prisma.weeklyPlayerLeaderboard.count({
          where: {
            weekKey,
            wavesThisWeek: { gt: weeklyData.wavesThisWeek },
            user: { banned: false },
          },
        })
      : null,
    // Weekly honor rank
    weeklyData && weeklyData.honorGained > 0
      ? prisma.weeklyPlayerLeaderboard.count({
          where: {
            weekKey,
            honorGained: { gt: weeklyData.honorGained },
            user: { banned: false },
          },
        })
      : null,
  ]);

  return [
    {
      category: "totalWaves",
      rank: totalWavesRank !== null ? totalWavesRank + 1 : null,
      score: user.totalWaves,
    },
    {
      category: "honor",
      rank: honorRank + 1,
      score: user.honor,
    },
    {
      category: "level",
      rank: levelRank !== null ? levelRank + 1 : null,
      score: user.progression?.level ?? 1,
    },
    {
      category: "weeklyWaves",
      rank: weeklyWavesRank !== null ? weeklyWavesRank + 1 : null,
      score: weeklyData?.wavesThisWeek ?? 0,
    },
    {
      category: "weeklyHonor",
      rank: weeklyHonorRank !== null ? weeklyHonorRank + 1 : null,
      score: weeklyData?.honorGained ?? 0,
    },
  ];
}

// ==========================================
// REWARDS
// ==========================================

/**
 * Get available unclaimed rewards for a user
 */
export async function getAvailableRewards(
  userId: string,
): Promise<AvailableReward[]> {
  const rewards = await prisma.weeklyPlayerReward.findMany({
    where: {
      userId,
      claimed: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  return rewards.map((r) => ({
    id: r.id,
    weekKey: r.weekKey,
    category: r.category as "waves" | "honor",
    rank: r.rank,
    goldAmount: r.goldAmount,
    dustAmount: r.dustAmount,
    itemIds: r.itemIds,
    expiresAt: r.expiresAt.toISOString(),
  }));
}

/**
 * Claim a weekly reward
 */
export async function claimWeeklyReward(
  userId: string,
  rewardId: string,
): Promise<ClaimRewardResult> {
  const reward = await prisma.weeklyPlayerReward.findUnique({
    where: { id: rewardId },
  });

  if (!reward || reward.userId !== userId) {
    throw new Error("Reward not found");
  }

  if (reward.claimed) {
    throw new Error("Reward already claimed");
  }

  if (reward.expiresAt < new Date()) {
    throw new Error("Reward expired");
  }

  // Get user's current exclusive items
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { exclusiveItems: true },
  });

  // Determine which items are new
  const existingItems = new Set(user?.exclusiveItems ?? []);
  const newExclusiveItems = reward.itemIds.filter(
    (id) => !existingItems.has(id),
  );

  // Claim reward in transaction
  await prisma.$transaction([
    // Mark reward as claimed
    prisma.weeklyPlayerReward.update({
      where: { id: rewardId },
      data: {
        claimed: true,
        claimedAt: new Date(),
      },
    }),
    // Add gold
    prisma.inventory.update({
      where: { userId },
      data: { gold: { increment: reward.goldAmount } },
    }),
    // Add dust
    prisma.inventory.update({
      where: { userId },
      data: { dust: { increment: reward.dustAmount } },
    }),
    // Add new exclusive items
    ...(newExclusiveItems.length > 0
      ? [
          prisma.user.update({
            where: { id: userId },
            data: {
              exclusiveItems: {
                push: newExclusiveItems,
              },
            },
          }),
        ]
      : []),
  ]);

  return {
    success: true,
    goldAmount: reward.goldAmount,
    dustAmount: reward.dustAmount,
    itemIds: reward.itemIds,
    newExclusiveItems,
  };
}

// ==========================================
// UPDATE FUNCTIONS
// ==========================================

/**
 * Increment total waves for a user (called after each game session)
 */
export async function incrementTotalWaves(
  userId: string,
  wavesCleared: number,
): Promise<void> {
  const weekKey = getCurrentWeekKey();

  await prisma.$transaction([
    // Update total waves on user
    prisma.user.update({
      where: { id: userId },
      data: { totalWaves: { increment: wavesCleared } },
    }),
    // Upsert weekly leaderboard entry
    prisma.weeklyPlayerLeaderboard.upsert({
      where: { weekKey_userId: { weekKey, userId } },
      update: { wavesThisWeek: { increment: wavesCleared } },
      create: { weekKey, userId, wavesThisWeek: wavesCleared },
    }),
  ]);

  // Invalidate caches
  await Promise.all([
    redis.del(CACHE_KEYS.totalWaves),
    redis.del(CACHE_KEYS.weeklyWaves(weekKey)),
  ]);
}

/**
 * Record honor gain in weekly leaderboard (already updated on User in PvP service)
 */
export async function recordWeeklyHonorGain(
  userId: string,
  honorGained: number,
): Promise<void> {
  if (honorGained <= 0) return;

  const weekKey = getCurrentWeekKey();

  await prisma.weeklyPlayerLeaderboard.upsert({
    where: { weekKey_userId: { weekKey, userId } },
    update: { honorGained: { increment: honorGained } },
    create: { weekKey, userId, honorGained },
  });

  // Invalidate cache
  await redis.del(CACHE_KEYS.weeklyHonor(weekKey));
}

// ==========================================
// WEEKLY RESET & REWARDS DISTRIBUTION
// ==========================================

/**
 * Distribute weekly rewards based on rankings
 * Called by scheduled job at end of week
 */
export async function distributeWeeklyRewards(weekKey: string): Promise<{
  wavesRewardsCreated: number;
  honorRewardsCreated: number;
}> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days to claim

  let wavesRewardsCreated = 0;
  let honorRewardsCreated = 0;

  // Get waves rankings
  const wavesEntries = await prisma.weeklyPlayerLeaderboard.findMany({
    where: { weekKey, wavesThisWeek: { gt: 0 } },
    orderBy: { wavesThisWeek: "desc" },
    take: 100, // Top 100 get rewards
    select: { userId: true },
  });

  // Create waves rewards
  for (let i = 0; i < wavesEntries.length; i++) {
    const rank = i + 1;
    const tier = getRewardTierForRank(rank, "waves");
    if (!tier) continue;

    await prisma.weeklyPlayerReward.create({
      data: {
        weekKey,
        userId: wavesEntries[i].userId,
        category: "waves",
        rank,
        goldAmount: tier.gold,
        dustAmount: tier.dust + tier.sigils * 10,
        itemIds: tier.items,
        expiresAt,
      },
    });
    wavesRewardsCreated++;
  }

  // Get honor rankings
  const honorEntries = await prisma.weeklyPlayerLeaderboard.findMany({
    where: { weekKey, honorGained: { gt: 0 } },
    orderBy: { honorGained: "desc" },
    take: 50, // Top 50 get rewards
    select: { userId: true },
  });

  // Create honor rewards
  for (let i = 0; i < honorEntries.length; i++) {
    const rank = i + 1;
    const tier = getRewardTierForRank(rank, "honor");
    if (!tier) continue;

    await prisma.weeklyPlayerReward.create({
      data: {
        weekKey,
        userId: honorEntries[i].userId,
        category: "honor",
        rank,
        goldAmount: tier.gold,
        dustAmount: tier.dust + tier.sigils * 10,
        itemIds: tier.items,
        expiresAt,
      },
    });
    honorRewardsCreated++;
  }

  return { wavesRewardsCreated, honorRewardsCreated };
}

/**
 * Reset weekly honor for all users
 * Called by scheduled job at start of new week
 */
export async function resetWeeklyHonor(): Promise<number> {
  const result = await prisma.weeklyPlayerLeaderboard.updateMany({
    data: {
      honorGained: 0,
    },
  });

  return result.count;
}

/**
 * Get available week keys for player leaderboards
 */
export async function getAvailablePlayerWeeks(limit = 10): Promise<string[]> {
  const weeks = await prisma.weeklyPlayerLeaderboard.findMany({
    distinct: ["weekKey"],
    orderBy: { weekKey: "desc" },
    take: limit,
    select: { weekKey: true },
  });

  return weeks.map((w) => w.weekKey);
}

/**
 * Get time until next weekly reset (Monday 00:00 UTC)
 */
export function getTimeUntilWeeklyReset(): {
  days: number;
  hours: number;
  minutes: number;
  totalMs: number;
} {
  const now = new Date();
  const nextMonday = new Date(now);

  // Get next Monday at 00:00 UTC
  const daysUntilMonday = (8 - now.getUTCDay()) % 7 || 7;
  nextMonday.setUTCDate(now.getUTCDate() + daysUntilMonday);
  nextMonday.setUTCHours(0, 0, 0, 0);

  const totalMs = nextMonday.getTime() - now.getTime();
  const days = Math.floor(totalMs / (24 * 60 * 60 * 1000));
  const hours = Math.floor(
    (totalMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000),
  );
  const minutes = Math.floor((totalMs % (60 * 60 * 1000)) / (60 * 1000));

  return { days, hours, minutes, totalMs };
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

async function getCachedPermanentLeaderboard(
  category: PermanentLeaderboardCategory,
  limit: number,
  offset: number,
  fetchFn: () => Promise<{ entries: PlayerLeaderboardEntry[]; total: number }>,
): Promise<{ entries: PlayerLeaderboardEntry[]; total: number }> {
  const cacheKey = CACHE_KEYS[category];
  const cached = await redis.get(cacheKey);

  let data: { entries: PlayerLeaderboardEntry[]; total: number };

  if (cached) {
    data = JSON.parse(cached);
  } else {
    data = await fetchFn();
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(data));
  }

  // Paginate in memory
  const paginatedEntries = data.entries
    .slice(offset, offset + limit)
    .map((entry, index) => ({
      ...entry,
      rank: offset + index + 1,
    }));

  return {
    entries: paginatedEntries,
    total: data.total,
  };
}

/**
 * Invalidate all player leaderboard caches
 */
export async function invalidateAllCaches(): Promise<void> {
  const weekKey = getCurrentWeekKey();
  await Promise.all([
    redis.del(CACHE_KEYS.totalWaves),
    redis.del(CACHE_KEYS.honor),
    redis.del(CACHE_KEYS.level),
    redis.del(CACHE_KEYS.weeklyWaves(weekKey)),
    redis.del(CACHE_KEYS.weeklyHonor(weekKey)),
  ]);
}
