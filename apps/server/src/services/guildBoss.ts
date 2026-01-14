/**
 * Guild Boss Service
 *
 * Weekly PvE boss that all guilds compete against.
 * Each member can attack once per day.
 * Guilds are ranked by total damage dealt.
 */

import { randomInt } from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import type { GuildBoss, GuildBossAttempt } from '@prisma/client';
import { getCurrentWeekKey } from './guildTowerRace.js';
import { GUILD_CONSTANTS } from '@arcade/protocol';

// ============================================================================
// TYPES
// ============================================================================

export interface GuildBossStatus {
  boss: GuildBoss;
  myTodaysAttempt: GuildBossAttempt | null;
  canAttack: boolean;
  myTotalDamage: number;
  guildTotalDamage: number;
  guildRank: number | null;
}

export interface GuildBossLeaderboardEntry {
  rank: number;
  guildId: string;
  guildName: string;
  guildTag: string;
  totalDamage: number;
  participantCount: number;
}

export interface GuildMemberDamage {
  userId: string;
  displayName: string;
  damage: number;
  heroId: string;
  heroTier: number;
  rank: number;
}

export interface AttackBossResult {
  success: boolean;
  error?: string;
  attempt?: GuildBossAttempt;
  bossCurrentHp?: number;
  guildCoinsEarned?: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const BOSS_TOTAL_HP = BigInt(GUILD_CONSTANTS.BOSS_TOTAL_HP);
const BOSS_TYPES = ['dragon', 'titan', 'demon', 'leviathan', 'phoenix'];
const FORTRESS_WEAKNESSES = ['castle', 'arcane', 'nature', 'shadow', 'forge'];

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get boss end time (Sunday 23:59:59 UTC of current week)
 */
function getBossEndTime(weekKey: string): Date {
  const match = weekKey.match(/^(\d{4})-W(\d{2})$/);
  if (!match) throw new Error(`Invalid week key: ${weekKey}`);

  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);

  const jan1 = new Date(Date.UTC(year, 0, 1));
  const jan1Day = jan1.getUTCDay();
  const daysToFirstMonday = jan1Day === 0 ? 1 : (jan1Day === 1 ? 0 : 8 - jan1Day);

  const targetMonday = new Date(jan1.getTime() + (daysToFirstMonday + (week - 1) * 7) * 86400000);
  const sundayEnd = new Date(targetMonday.getTime() + 6 * 86400000 + 23 * 3600000 + 59 * 60000 + 59 * 1000);

  return sundayEnd;
}

/**
 * Get start of today in UTC
 */
function getTodayStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Get end of today in UTC
 */
function getTodayEnd(): Date {
  const start = getTodayStart();
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}

// ============================================================================
// BOSS MANAGEMENT
// ============================================================================

/**
 * Get or create the current week's boss
 */
export async function getCurrentBoss(): Promise<GuildBoss> {
  const weekKey = getCurrentWeekKey();

  let boss = await prisma.guildBoss.findUnique({
    where: { weekKey },
  });

  if (!boss) {
    // Select boss type and weakness based on week (deterministic rotation)
    const weekNumber = parseInt(weekKey.split('-W')[1], 10);
    const bossType = BOSS_TYPES[weekNumber % BOSS_TYPES.length];
    const weakness = FORTRESS_WEAKNESSES[weekNumber % FORTRESS_WEAKNESSES.length];
    const endsAt = getBossEndTime(weekKey);

    boss = await prisma.guildBoss.create({
      data: {
        weekKey,
        bossType,
        totalHp: BOSS_TOTAL_HP,
        currentHp: BOSS_TOTAL_HP,
        weakness,
        endsAt,
      },
    });
  }

  return boss;
}

/**
 * Get boss status for a guild member
 */
export async function getBossStatus(guildId: string, userId: string): Promise<GuildBossStatus> {
  const boss = await getCurrentBoss();

  // Check if user already attacked today
  const todayStart = getTodayStart();
  const todayEnd = getTodayEnd();

  const todaysAttempt = await prisma.guildBossAttempt.findFirst({
    where: {
      guildBossId: boss.id,
      userId,
      attemptedAt: {
        gte: todayStart,
        lte: todayEnd,
      },
    },
  });

  // Get user's total damage this week
  const userDamageResult = await prisma.guildBossAttempt.aggregate({
    where: {
      guildBossId: boss.id,
      userId,
    },
    _sum: {
      damage: true,
    },
  });
  const myTotalDamage = Number(userDamageResult._sum.damage || 0);

  // Get guild's total damage
  const guildDamageResult = await prisma.guildBossAttempt.aggregate({
    where: {
      guildBossId: boss.id,
      guildId,
    },
    _sum: {
      damage: true,
    },
  });
  const guildTotalDamage = Number(guildDamageResult._sum.damage || 0);

  // Calculate guild rank
  let guildRank: number | null = null;
  if (guildTotalDamage > 0) {
    const higherGuilds = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(DISTINCT "guildId") as count
      FROM "GuildBossAttempt"
      WHERE "guildBossId" = ${boss.id}
      GROUP BY "guildId"
      HAVING SUM(damage) > ${BigInt(guildTotalDamage)}
    `;
    guildRank = (higherGuilds[0]?.count ? Number(higherGuilds[0].count) : 0) + 1;
  }

  const canAttack = !todaysAttempt && new Date() < boss.endsAt;

  return {
    boss,
    myTodaysAttempt: todaysAttempt,
    canAttack,
    myTotalDamage,
    guildTotalDamage,
    guildRank,
  };
}

// ============================================================================
// ATTACK
// ============================================================================

/**
 * Attack the boss
 * Uses the player's Battle Hero
 */
export async function attackBoss(
  userId: string
): Promise<AttackBossResult> {
  // Get membership and Battle Hero
  const membership = await prisma.guildMember.findUnique({
    where: { userId },
    include: {
      guild: { select: { id: true, disbanded: true } },
    },
  });

  if (!membership || membership.guild.disbanded) {
    return { success: false, error: 'NOT_IN_GUILD' };
  }

  if (!membership.battleHeroId) {
    return { success: false, error: 'NO_BATTLE_HERO_SET' };
  }

  const guildId = membership.guildId;
  const boss = await getCurrentBoss();

  // Check if boss is still active
  if (new Date() > boss.endsAt) {
    return { success: false, error: 'BOSS_EXPIRED' };
  }

  // Check if already attacked today
  const todayStart = getTodayStart();
  const todayEnd = getTodayEnd();

  const existingAttempt = await prisma.guildBossAttempt.findFirst({
    where: {
      guildBossId: boss.id,
      userId,
      attemptedAt: {
        gte: todayStart,
        lte: todayEnd,
      },
    },
  });

  if (existingAttempt) {
    return { success: false, error: 'ALREADY_ATTACKED_BOSS_TODAY' };
  }

  // Get hero power for damage calculation
  const heroPower = membership.battleHeroPower || 1000;
  const heroTier = membership.battleHeroTier || 1;

  // Calculate damage based on hero power
  // Base damage = heroPower * (0.8 to 1.2 random multiplier) * tier multiplier
  const tierMultiplier = 1 + (heroTier - 1) * 0.5; // T1=1x, T2=1.5x, T3=2x
  // Cryptographically secure random: 0.8 + (0-400)/1000 = 0.8 to 1.2
  const randomMultiplier = 0.8 + randomInt(0, 401) / 1000;
  const baseDamage = Math.floor(heroPower * randomMultiplier * tierMultiplier * 100);

  // Apply weakness bonus (+25% if fortress class matches boss weakness)
  // For now, we don't have fortress class per member, so skip this
  const damage = baseDamage;

  // Create attempt and update boss HP
  const [attempt] = await prisma.$transaction([
    prisma.guildBossAttempt.create({
      data: {
        guildBossId: boss.id,
        guildId,
        userId,
        damage: BigInt(damage),
        heroId: membership.battleHeroId,
        heroTier,
        heroPower,
      },
    }),
    prisma.guildBoss.update({
      where: { id: boss.id },
      data: {
        currentHp: {
          decrement: BigInt(damage),
        },
      },
    }),
  ]);

  // Award Guild Coins for participation
  const guildCoinsEarned = GUILD_CONSTANTS.COINS_BOSS_PARTICIPATION;
  await prisma.guildMember.update({
    where: { userId },
    data: {
      earnedGuildCoins: { increment: guildCoinsEarned },
    },
  });

  // Get updated boss HP
  const updatedBoss = await prisma.guildBoss.findUnique({
    where: { id: boss.id },
  });

  return {
    success: true,
    attempt,
    bossCurrentHp: Math.max(0, Number(updatedBoss?.currentHp || 0)),
    guildCoinsEarned,
  };
}

// ============================================================================
// LEADERBOARD
// ============================================================================

/**
 * Get guild leaderboard for boss damage
 */
export async function getBossLeaderboard(
  weekKey?: string,
  limit = 20,
  offset = 0
): Promise<{ entries: GuildBossLeaderboardEntry[]; total: number }> {
  const targetWeekKey = weekKey || getCurrentWeekKey();

  const boss = await prisma.guildBoss.findUnique({
    where: { weekKey: targetWeekKey },
  });

  if (!boss) {
    return { entries: [], total: 0 };
  }

  // Get aggregated damage per guild
  const guildDamages = await prisma.$queryRaw<
    { guildId: string; totalDamage: bigint; participantCount: bigint }[]
  >`
    SELECT
      "guildId",
      SUM(damage) as "totalDamage",
      COUNT(DISTINCT "userId") as "participantCount"
    FROM "GuildBossAttempt"
    WHERE "guildBossId" = ${boss.id}
    GROUP BY "guildId"
    ORDER BY "totalDamage" DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  // Get total count
  const countResult = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(DISTINCT "guildId") as count
    FROM "GuildBossAttempt"
    WHERE "guildBossId" = ${boss.id}
  `;
  const total = Number(countResult[0]?.count || 0);

  // Get guild details
  const guildIds = guildDamages.map((g) => g.guildId);
  const guilds = await prisma.guild.findMany({
    where: { id: { in: guildIds } },
    select: { id: true, name: true, tag: true },
  });
  const guildMap = new Map(guilds.map((g) => [g.id, g]));

  const entries: GuildBossLeaderboardEntry[] = guildDamages.map((gd, index) => {
    const guild = guildMap.get(gd.guildId);
    return {
      rank: offset + index + 1,
      guildId: gd.guildId,
      guildName: guild?.name || 'Unknown',
      guildTag: guild?.tag || '???',
      totalDamage: Number(gd.totalDamage),
      participantCount: Number(gd.participantCount),
    };
  });

  return { entries, total };
}

/**
 * Get damage breakdown for a guild
 */
export async function getGuildBossDamageBreakdown(
  guildId: string,
  weekKey?: string
): Promise<{ members: GuildMemberDamage[]; totalDamage: number }> {
  const targetWeekKey = weekKey || getCurrentWeekKey();

  const boss = await prisma.guildBoss.findUnique({
    where: { weekKey: targetWeekKey },
  });

  if (!boss) {
    return { members: [], totalDamage: 0 };
  }

  // Get all attempts for this guild
  const attempts = await prisma.guildBossAttempt.findMany({
    where: {
      guildBossId: boss.id,
      guildId,
    },
    orderBy: { damage: 'desc' },
  });

  // Aggregate by user
  const userDamageMap = new Map<
    string,
    { damage: bigint; heroId: string; heroTier: number }
  >();
  for (const attempt of attempts) {
    const existing = userDamageMap.get(attempt.userId);
    if (existing) {
      existing.damage += attempt.damage;
    } else {
      userDamageMap.set(attempt.userId, {
        damage: attempt.damage,
        heroId: attempt.heroId,
        heroTier: attempt.heroTier,
      });
    }
  }

  // Get user details
  const userIds = Array.from(userDamageMap.keys());
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, displayName: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  // Sort by damage and create response
  const members = Array.from(userDamageMap.entries())
    .map(([odId, data]) => ({
      odId,
      ...data,
    }))
    .sort((a, b) => Number(b.damage - a.damage))
    .map((m, index) => ({
      userId: m.odId,
      displayName: userMap.get(m.odId)?.displayName || 'Unknown',
      damage: Number(m.damage),
      heroId: m.heroId,
      heroTier: m.heroTier,
      rank: index + 1,
    }));

  const totalDamage = members.reduce((sum, m) => sum + m.damage, 0);

  return { members, totalDamage };
}

/**
 * Get top damage dealers globally for the boss
 */
export async function getTopDamageDealers(
  weekKey?: string,
  limit = 10
): Promise<GuildMemberDamage[]> {
  const targetWeekKey = weekKey || getCurrentWeekKey();

  const boss = await prisma.guildBoss.findUnique({
    where: { weekKey: targetWeekKey },
  });

  if (!boss) {
    return [];
  }

  // Get top damage attempts (aggregated by user)
  const topUsers = await prisma.$queryRaw<
    { userId: string; totalDamage: bigint; heroId: string; heroTier: number }[]
  >`
    SELECT
      "userId",
      SUM(damage) as "totalDamage",
      MAX("heroId") as "heroId",
      MAX("heroTier") as "heroTier"
    FROM "GuildBossAttempt"
    WHERE "guildBossId" = ${boss.id}
    GROUP BY "userId"
    ORDER BY "totalDamage" DESC
    LIMIT ${limit}
  `;

  // Get user details
  const userIds = topUsers.map((u) => u.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, displayName: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  return topUsers.map((u, index) => ({
    userId: u.userId,
    displayName: userMap.get(u.userId)?.displayName || 'Unknown',
    damage: Number(u.totalDamage),
    heroId: u.heroId,
    heroTier: u.heroTier,
    rank: index + 1,
  }));
}

// ============================================================================
// FINALIZATION
// ============================================================================

/**
 * Finalize boss and distribute rewards
 * Called by scheduled job after boss week ends
 */
export async function finalizeBoss(weekKey: string): Promise<{
  success: boolean;
  topGuilds?: { guildId: string; rank: number; reward: number }[];
  error?: string;
}> {
  const boss = await prisma.guildBoss.findUnique({
    where: { weekKey },
  });

  if (!boss) {
    return { success: false, error: 'Boss not found' };
  }

  // Get top guilds
  const { entries } = await getBossLeaderboard(weekKey, 20, 0);

  // Define rewards (Guild Coins)
  const rewards: Record<number, number> = {
    1: 500, // 1st place
    2: 300, // 2nd place
    3: 200, // 3rd place
    // 4-10: 100 each
    // 11-20: 50 each
  };

  const topGuilds: { guildId: string; rank: number; reward: number }[] = [];

  await prisma.$transaction(async (tx) => {
    for (const entry of entries) {
      let reward = rewards[entry.rank];
      if (!reward) {
        if (entry.rank <= 10) reward = 100;
        else if (entry.rank <= 20) reward = 50;
        else reward = 0;
      }

      if (reward > 0) {
        await tx.guild.update({
          where: { id: entry.guildId },
          data: { guildCoins: { increment: reward } },
        });

        topGuilds.push({
          guildId: entry.guildId,
          rank: entry.rank,
          reward,
        });
      }
    }

    // Award bonus to top damage dealers in each guild
    const guildIds = entries.map((e) => e.guildId);
    for (const guildId of guildIds) {
      const { members } = await getGuildBossDamageBreakdown(guildId, weekKey);
      if (members.length > 0) {
        // Top damage dealer gets bonus coins
        await tx.guildMember.updateMany({
          where: {
            userId: members[0].userId,
            guildId,
          },
          data: {
            earnedGuildCoins: { increment: GUILD_CONSTANTS.COINS_BOSS_TOP_DAMAGE },
          },
        });
      }
    }
  });

  return { success: true, topGuilds };
}
