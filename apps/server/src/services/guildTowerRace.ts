/**
 * Guild Tower Race Service
 *
 * Weekly competition where guilds compete based on total waves cleared by members.
 * Runs Monday 00:00 UTC to Sunday 23:59:59 UTC.
 */

import { prisma } from '../lib/prisma.js';
import type { GuildTowerRace, GuildTowerRaceEntry } from '@prisma/client';

// ============================================================================
// TYPES
// ============================================================================

export interface TowerRaceLeaderboardEntry {
  guildId: string;
  guildName: string;
  guildTag: string;
  guildLevel: number;
  totalWaves: number;
  memberCount: number;
  rank: number;
}

export interface TowerRaceGuildDetails {
  guildId: string;
  guildName: string;
  totalWaves: number;
  rank: number;
  memberContributions: MemberContribution[];
}

export interface MemberContribution {
  userId: string;
  displayName: string;
  wavesContributed: number;
  rank: number;
}

export interface TowerRaceStatus {
  race: GuildTowerRace;
  guildEntry: GuildTowerRaceEntry | null;
  guildRank: number | null;
  timeRemaining: number; // milliseconds
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get current week key (YYYY-Www format, ISO week)
 */
export function getCurrentWeekKey(): string {
  const now = new Date();
  const year = now.getUTCFullYear();

  // Calculate ISO week number
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfYear = Math.floor((now.getTime() - new Date(Date.UTC(year, 0, 1)).getTime()) / 86400000) + 1;
  const weekNumber = Math.ceil((dayOfYear + jan4.getUTCDay() - 1) / 7);

  return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
}

/**
 * Get race end time (Sunday 23:59:59 UTC)
 */
function getRaceEndTime(weekKey: string): Date {
  // Parse week key
  const match = weekKey.match(/^(\d{4})-W(\d{2})$/);
  if (!match) throw new Error(`Invalid week key: ${weekKey}`);

  const year = parseInt(match[1]);
  const week = parseInt(match[2]);

  // Find first day of the year
  const jan1 = new Date(Date.UTC(year, 0, 1));

  // Calculate first Monday of week 1
  const jan1Day = jan1.getUTCDay();
  const daysToFirstMonday = jan1Day === 0 ? 1 : (jan1Day === 1 ? 0 : 8 - jan1Day);

  // Calculate the Monday of the target week
  const targetMonday = new Date(jan1.getTime() + (daysToFirstMonday + (week - 1) * 7) * 86400000);

  // Sunday 23:59:59 UTC
  const sundayEnd = new Date(targetMonday.getTime() + 6 * 86400000 + 23 * 3600000 + 59 * 60000 + 59 * 1000);

  return sundayEnd;
}

// ============================================================================
// RACE MANAGEMENT
// ============================================================================

/**
 * Get or create the current week's race
 */
export async function getCurrentRace(): Promise<GuildTowerRace> {
  const weekKey = getCurrentWeekKey();

  // Try to find existing race
  let race = await prisma.guildTowerRace.findUnique({
    where: { weekKey },
  });

  if (!race) {
    // Create new race
    const startedAt = new Date();
    const endsAt = getRaceEndTime(weekKey);

    race = await prisma.guildTowerRace.create({
      data: {
        weekKey,
        startedAt,
        endsAt,
        status: 'active',
      },
    });
  }

  return race;
}

/**
 * Get race status for a guild
 */
export async function getRaceStatus(guildId: string): Promise<TowerRaceStatus> {
  const race = await getCurrentRace();

  // Get guild's entry
  const guildEntry = await prisma.guildTowerRaceEntry.findUnique({
    where: {
      raceId_guildId: {
        raceId: race.id,
        guildId,
      },
    },
  });

  // Calculate rank
  let guildRank: number | null = null;
  if (guildEntry) {
    const higherEntries = await prisma.guildTowerRaceEntry.count({
      where: {
        raceId: race.id,
        totalWaves: { gt: guildEntry.totalWaves },
      },
    });
    guildRank = higherEntries + 1;
  }

  // Calculate time remaining
  const timeRemaining = Math.max(0, race.endsAt.getTime() - Date.now());

  return {
    race,
    guildEntry,
    guildRank,
    timeRemaining,
  };
}

// ============================================================================
// WAVE CONTRIBUTIONS
// ============================================================================

/**
 * Add wave contribution from a player
 * Called when player completes waves in endless mode
 */
export async function addWaveContribution(
  userId: string,
  wavesCleared: number
): Promise<{ success: boolean; error?: string }> {
  if (wavesCleared <= 0) {
    return { success: true }; // Nothing to add
  }

  // Get player's guild membership
  const membership = await prisma.guildMember.findUnique({
    where: { userId },
    include: { guild: { select: { id: true, disbanded: true } } },
  });

  if (!membership || membership.guild.disbanded) {
    return { success: true }; // Not in a guild, silently ignore
  }

  const guildId = membership.guildId;

  // Get current race
  const race = await getCurrentRace();

  // Check if race is still active
  if (race.status !== 'active' || new Date() > race.endsAt) {
    return { success: true }; // Race ended, silently ignore
  }

  // Upsert entry and update contributions
  await prisma.$transaction(async (tx) => {
    // Get or create entry
    let entry = await tx.guildTowerRaceEntry.findUnique({
      where: {
        raceId_guildId: {
          raceId: race.id,
          guildId,
        },
      },
    });

    if (!entry) {
      // Create new entry
      entry = await tx.guildTowerRaceEntry.create({
        data: {
          raceId: race.id,
          guildId,
          totalWaves: 0,
          memberContributions: {},
        },
      });
    }

    // Update contributions
    const contributions = (entry.memberContributions as Record<string, number>) || {};
    contributions[userId] = (contributions[userId] || 0) + wavesCleared;

    // Update entry
    await tx.guildTowerRaceEntry.update({
      where: { id: entry.id },
      data: {
        totalWaves: { increment: wavesCleared },
        memberContributions: contributions,
      },
    });
  });

  return { success: true };
}

// ============================================================================
// LEADERBOARD
// ============================================================================

/**
 * Get tower race leaderboard
 */
export async function getRaceLeaderboard(
  weekKey?: string,
  limit = 20,
  offset = 0
): Promise<{ entries: TowerRaceLeaderboardEntry[]; total: number }> {
  const targetWeekKey = weekKey || getCurrentWeekKey();

  // Find race
  const race = await prisma.guildTowerRace.findUnique({
    where: { weekKey: targetWeekKey },
  });

  if (!race) {
    return { entries: [], total: 0 };
  }

  // Get entries with guild info
  const [entries, total] = await Promise.all([
    prisma.guildTowerRaceEntry.findMany({
      where: { raceId: race.id },
      orderBy: { totalWaves: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.guildTowerRaceEntry.count({
      where: { raceId: race.id },
    }),
  ]);

  // Get guild details
  const guildIds = entries.map(e => e.guildId);
  const guilds = await prisma.guild.findMany({
    where: { id: { in: guildIds } },
    select: {
      id: true,
      name: true,
      tag: true,
      level: true,
      _count: { select: { members: true } },
    },
  });

  const guildMap = new Map(guilds.map(g => [g.id, g]));

  return {
    entries: entries.map((entry, index) => {
      const guild = guildMap.get(entry.guildId);
      return {
        guildId: entry.guildId,
        guildName: guild?.name || 'Unknown',
        guildTag: guild?.tag || '???',
        guildLevel: guild?.level || 1,
        totalWaves: entry.totalWaves,
        memberCount: guild?._count.members || 0,
        rank: offset + index + 1,
      };
    }),
    total,
  };
}

/**
 * Get detailed stats for a guild in the race
 */
export async function getRaceGuildDetails(
  guildId: string,
  weekKey?: string
): Promise<TowerRaceGuildDetails | null> {
  const targetWeekKey = weekKey || getCurrentWeekKey();

  // Find race
  const race = await prisma.guildTowerRace.findUnique({
    where: { weekKey: targetWeekKey },
  });

  if (!race) return null;

  // Get entry
  const entry = await prisma.guildTowerRaceEntry.findUnique({
    where: {
      raceId_guildId: {
        raceId: race.id,
        guildId,
      },
    },
  });

  if (!entry) return null;

  // Get guild info
  const guild = await prisma.guild.findUnique({
    where: { id: guildId },
    select: { name: true },
  });

  // Calculate rank
  const higherEntries = await prisma.guildTowerRaceEntry.count({
    where: {
      raceId: race.id,
      totalWaves: { gt: entry.totalWaves },
    },
  });
  const rank = higherEntries + 1;

  // Get member details
  const contributions = (entry.memberContributions as Record<string, number>) || {};
  const userIds = Object.keys(contributions);

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, displayName: true },
  });

  const userMap = new Map(users.map(u => [u.id, u]));

  // Sort contributions and assign ranks
  const sortedContributions = Object.entries(contributions)
    .map(([userId, waves]) => ({
      userId,
      displayName: userMap.get(userId)?.displayName || 'Unknown',
      wavesContributed: waves,
    }))
    .sort((a, b) => b.wavesContributed - a.wavesContributed)
    .map((c, index) => ({ ...c, rank: index + 1 }));

  return {
    guildId,
    guildName: guild?.name || 'Unknown',
    totalWaves: entry.totalWaves,
    rank,
    memberContributions: sortedContributions,
  };
}

// ============================================================================
// RACE FINALIZATION
// ============================================================================

/**
 * Finalize a race and distribute rewards
 * Should be called by a scheduled job after race ends
 */
export async function finalizeRace(weekKey: string): Promise<{
  success: boolean;
  rankings?: { guildId: string; rank: number; reward: number }[];
  error?: string;
}> {
  const race = await prisma.guildTowerRace.findUnique({
    where: { weekKey },
  });

  if (!race) {
    return { success: false, error: 'Race not found' };
  }

  if (race.status === 'completed') {
    return { success: false, error: 'Race already finalized' };
  }

  // Get final rankings
  const entries = await prisma.guildTowerRaceEntry.findMany({
    where: { raceId: race.id },
    orderBy: { totalWaves: 'desc' },
  });

  // Define rewards (Guild Coins)
  const rewards: Record<number, number> = {
    1: 500,  // 1st place
    2: 300,  // 2nd place
    3: 200,  // 3rd place
    // 4-10: 100 each
    // 11-20: 50 each
  };

  const rankings: { guildId: string; rank: number; reward: number }[] = [];

  await prisma.$transaction(async (tx) => {
    // Mark race as completed
    await tx.guildTowerRace.update({
      where: { id: race.id },
      data: { status: 'completed' },
    });

    // Distribute rewards
    for (let i = 0; i < entries.length; i++) {
      const rank = i + 1;
      const entry = entries[i];

      let reward = rewards[rank];
      if (!reward) {
        if (rank <= 10) reward = 100;
        else if (rank <= 20) reward = 50;
        else reward = 0;
      }

      if (reward > 0) {
        // Add Guild Coins to guild
        await tx.guild.update({
          where: { id: entry.guildId },
          data: { guildCoins: { increment: reward } },
        });

        rankings.push({
          guildId: entry.guildId,
          rank,
          reward,
        });
      }
    }
  });

  return { success: true, rankings };
}

/**
 * Get historical races
 */
export async function getRaceHistory(
  limit = 10
): Promise<{ weekKey: string; status: string; topGuild?: string }[]> {
  const races = await prisma.guildTowerRace.findMany({
    orderBy: { startedAt: 'desc' },
    take: limit,
    include: {
      entries: {
        orderBy: { totalWaves: 'desc' },
        take: 1,
      },
    },
  });

  // Get guild names for winners
  const winnerGuildIds = races
    .filter(r => r.entries.length > 0)
    .map(r => r.entries[0].guildId);

  const guilds = await prisma.guild.findMany({
    where: { id: { in: winnerGuildIds } },
    select: { id: true, name: true },
  });

  const guildMap = new Map(guilds.map(g => [g.id, g.name]));

  return races.map(race => ({
    weekKey: race.weekKey,
    status: race.status,
    topGuild: race.entries.length > 0
      ? guildMap.get(race.entries[0].guildId)
      : undefined,
  }));
}
