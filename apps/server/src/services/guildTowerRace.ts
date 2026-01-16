/**
 * Guild Tower Race Service
 *
 * Weekly competition where guilds compete based on total waves cleared by members.
 * Runs Monday 00:00 UTC to Sunday 23:59:59 UTC.
 */

import { prisma } from '../lib/prisma.js';
import type { GuildTowerRace, GuildTowerRaceEntry } from '@prisma/client';
import {
  getCurrentWeekKey as getWeekKey,
  getWeekStart,
  getWeekEnd,
} from '../lib/weekUtils.js';

// ============================================================================
// TYPES
// ============================================================================

export interface TowerRaceLeaderboardEntry {
  guildId: string;
  guildName: string;
  guildTag: string;
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
 * Re-exported from weekUtils for backward compatibility
 */
export function getCurrentWeekKey(): string {
  return getWeekKey();
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
    // Create new race - use week boundaries for consistent timing
    const startedAt = getWeekStart(weekKey);
    const endsAt = getWeekEnd(weekKey);

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
 * Finalize a race
 * Should be called by a scheduled job after race ends
 * Returns rankings for historical tracking
 */
export async function finalizeRace(weekKey: string): Promise<{
  success: boolean;
  rankings?: { guildId: string; rank: number; totalWaves: number }[];
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

  // Mark race as completed
  await prisma.guildTowerRace.update({
    where: { id: race.id },
    data: { status: 'completed' },
  });

  const rankings = entries.map((entry, index) => ({
    guildId: entry.guildId,
    rank: index + 1,
    totalWaves: entry.totalWaves,
  }));

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
