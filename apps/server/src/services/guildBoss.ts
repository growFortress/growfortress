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
import { getCurrentWeekKey, getWeekEnd } from '../lib/weekUtils.js';
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

/**
 * Map weakness string to FortressClass
 * Weakness names: 'castle', 'arcane', 'nature', 'shadow', 'forge'
 * FortressClass: 'natural' | 'ice' | 'fire' | 'lightning' | 'tech' | 'void' | 'plasma'
 */
function mapWeaknessToFortressClass(weakness: string | null): string | null {
  if (!weakness) return null;
  
  const mapping: Record<string, string> = {
    'castle': 'natural',   // Standard fortress class
    'arcane': 'void',       // Arcane magic -> void
    'nature': 'natural',    // Nature -> natural
    'shadow': 'void',       // Shadow -> void
    'forge': 'tech',        // Forge -> tech
  };
  
  return mapping[weakness] || null;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get boss end time (Sunday 23:59:59 UTC of current week)
 * Uses centralized weekUtils for consistent calculation
 */
function getBossEndTime(weekKey: string): Date {
  return getWeekEnd(weekKey);
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
 * Optimized: combines getCurrentBoss + stats into single query (2 queries → 1)
 * Uses INSERT ON CONFLICT to ensure boss exists, then fetches all data
 */
export async function getBossStatus(guildId: string, userId: string): Promise<GuildBossStatus> {
  const weekKey = getCurrentWeekKey();
  const weekNumber = parseInt(weekKey.split('-W')[1], 10);
  const bossType = BOSS_TYPES[weekNumber % BOSS_TYPES.length];
  const weakness = FORTRESS_WEAKNESSES[weekNumber % FORTRESS_WEAKNESSES.length];
  const endsAt = getBossEndTime(weekKey);
  const todayStart = getTodayStart();
  const todayEnd = getTodayEnd();

  // Single query: ensure boss exists + fetch all stats
  const result = await prisma.$queryRaw<
    {
      bossId: string;
      bossWeekKey: string;
      bossBossType: string;
      bossTotalHp: bigint;
      bossCurrentHp: bigint;
      bossWeakness: string | null;
      bossEndsAt: Date;
      bossCreatedAt: Date;
      todaysAttemptId: string | null;
      todaysAttemptDamage: bigint | null;
      todaysAttemptHeroId: string | null;
      todaysAttemptHeroTier: number | null;
      todaysAttemptHeroPower: number | null;
      todaysAttemptAttemptedAt: Date | null;
      userTotalDamage: bigint;
      guildTotalDamage: bigint;
      higherGuildsCount: bigint;
    }[]
  >`
    WITH ensure_boss AS (
      INSERT INTO "GuildBoss" ("id", "weekKey", "bossType", "totalHp", "currentHp", "weakness", "endsAt", "createdAt")
      VALUES (gen_random_uuid(), ${weekKey}, ${bossType}, ${BOSS_TOTAL_HP}, ${BOSS_TOTAL_HP}, ${weakness}, ${endsAt}, NOW())
      ON CONFLICT ("weekKey") DO UPDATE SET "weekKey" = EXCLUDED."weekKey"
      RETURNING *
    ),
    boss AS (
      SELECT * FROM ensure_boss
    ),
    today_attempt AS (
      SELECT id, damage, "heroId", "heroTier", "heroPower", "attemptedAt"
      FROM "GuildBossAttempt"
      WHERE "guildBossId" = (SELECT id FROM boss)
        AND "userId" = ${userId}
        AND "attemptedAt" >= ${todayStart}
        AND "attemptedAt" <= ${todayEnd}
      LIMIT 1
    ),
    user_damage AS (
      SELECT COALESCE(SUM(damage), 0) as total
      FROM "GuildBossAttempt"
      WHERE "guildBossId" = (SELECT id FROM boss) AND "userId" = ${userId}
    ),
    guild_damage AS (
      SELECT COALESCE(SUM(damage), 0) as total
      FROM "GuildBossAttempt"
      WHERE "guildBossId" = (SELECT id FROM boss) AND "guildId" = ${guildId}
    ),
    higher_guilds AS (
      SELECT COUNT(*) as count FROM (
        SELECT "guildId"
        FROM "GuildBossAttempt"
        WHERE "guildBossId" = (SELECT id FROM boss)
        GROUP BY "guildId"
        HAVING SUM(damage) > (SELECT total FROM guild_damage)
      ) hg
    )
    SELECT
      b.id as "bossId",
      b."weekKey" as "bossWeekKey",
      b."bossType" as "bossBossType",
      b."totalHp" as "bossTotalHp",
      b."currentHp" as "bossCurrentHp",
      b."weakness" as "bossWeakness",
      b."endsAt" as "bossEndsAt",
      b."createdAt" as "bossCreatedAt",
      ta.id as "todaysAttemptId",
      ta.damage as "todaysAttemptDamage",
      ta."heroId" as "todaysAttemptHeroId",
      ta."heroTier" as "todaysAttemptHeroTier",
      ta."heroPower" as "todaysAttemptHeroPower",
      ta."attemptedAt" as "todaysAttemptAttemptedAt",
      ud.total as "userTotalDamage",
      gd.total as "guildTotalDamage",
      hg.count as "higherGuildsCount"
    FROM boss b
    CROSS JOIN user_damage ud
    CROSS JOIN guild_damage gd
    CROSS JOIN higher_guilds hg
    LEFT JOIN today_attempt ta ON true
  `;

  const row = result[0];
  if (!row) {
    throw new Error('Failed to get or create boss');
  }

  const boss: GuildBoss = {
    id: row.bossId,
    weekKey: row.bossWeekKey,
    bossType: row.bossBossType,
    totalHp: row.bossTotalHp,
    currentHp: row.bossCurrentHp,
    weakness: row.bossWeakness,
    endsAt: row.bossEndsAt,
    createdAt: row.bossCreatedAt,
  };

  const myTotalDamage = Number(row.userTotalDamage || 0);
  const guildTotalDamage = Number(row.guildTotalDamage || 0);

  // Reconstruct today's attempt if it exists
  const todaysAttempt: GuildBossAttempt | null = row.todaysAttemptId
    ? {
        id: row.todaysAttemptId,
        guildBossId: boss.id,
        guildId,
        userId,
        damage: row.todaysAttemptDamage!,
        heroId: row.todaysAttemptHeroId!,
        heroTier: row.todaysAttemptHeroTier!,
        heroPower: row.todaysAttemptHeroPower!,
        attemptedAt: row.todaysAttemptAttemptedAt!,
      }
    : null;

  // Calculate guild rank (only if guild has damage)
  const guildRank: number | null =
    guildTotalDamage > 0 ? Number(row.higherGuildsCount || 0) + 1 : null;

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
 * @param userId The attacking user
 * @param expectedGuildId Optional guildId to validate against (from URL param)
 */
export async function attackBoss(
  userId: string,
  expectedGuildId?: string
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

  // Security: Validate expectedGuildId matches user's actual guild
  if (expectedGuildId && membership.guildId !== expectedGuildId) {
    return { success: false, error: 'NOT_IN_GUILD' };
  }

  if (!membership.battleHeroId) {
    return { success: false, error: 'NO_BATTLE_HERO_SET' };
  }

  const guildId = membership.guildId;
  const heroId = membership.battleHeroId;
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
  let damage = baseDamage;
  const bossWeaknessClass = mapWeaknessToFortressClass(boss.weakness);
  
  if (bossWeaknessClass) {
    // Get user's fortress class
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { defaultFortressClass: true },
    });
    
    const userFortressClass = user?.defaultFortressClass || 'natural';
    
    // Apply +25% bonus if fortress class matches weakness
    if (userFortressClass === bossWeaknessClass) {
      damage = Math.floor(damage * 1.25);
    }
  }

  // Award guild coins for participation (centralized constant)
  const guildCoinsEarned = GUILD_CONSTANTS.COINS_BOSS_PARTICIPATION;

  // Create attempt, update boss HP, and award coins atomically
  const { attempt, bossCurrentHp } = await prisma.$transaction(async (tx) => {
    const attempt = await tx.guildBossAttempt.create({
      data: {
        guildBossId: boss.id,
        guildId,
        userId,
        damage: BigInt(damage),
        heroId,
        heroTier,
        heroPower,
      },
    });

    await tx.guildBoss.update({
      where: { id: boss.id },
      data: {
        currentHp: {
          decrement: BigInt(damage),
        },
      },
    });

    const treasury = await tx.guildTreasury.update({
      where: { guildId },
      data: { guildCoins: { increment: guildCoinsEarned } },
    });

    await tx.guildTreasuryLog.create({
      data: {
        guildId,
        userId,
        transactionType: 'REWARD_DISTRIBUTION',
        guildCoinsAmount: guildCoinsEarned,
        description: `Guild Boss participation (Week ${boss.weekKey})`,
        referenceId: boss.id,
        balanceAfterGold: treasury.gold,
        balanceAfterDust: treasury.dust,
        balanceAfterGuildCoins: treasury.guildCoins,
      },
    });

    const updatedBoss = await tx.guildBoss.findUnique({
      where: { id: boss.id },
      select: { currentHp: true },
    });

    return {
      attempt,
      bossCurrentHp: Math.max(0, Number(updatedBoss?.currentHp || 0)),
    };
  });

  return {
    success: true,
    attempt,
    bossCurrentHp,
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
 * Finalize boss week
 * Called by scheduled job after boss week ends
 * Returns top guilds for historical tracking
 */
export async function finalizeBoss(weekKey: string): Promise<{
  success: boolean;
  topGuilds?: { guildId: string; rank: number; totalDamage: number }[];
  error?: string;
}> {
  const boss = await prisma.guildBoss.findUnique({
    where: { weekKey },
  });

  if (!boss) {
    return { success: false, error: 'Boss not found' };
  }

  // Get top guilds for historical record
  const { entries } = await getBossLeaderboard(weekKey, 20, 0);

  const topGuilds = entries.map((entry) => ({
    guildId: entry.guildId,
    rank: entry.rank,
    totalDamage: entry.totalDamage,
  }));

  return { success: true, topGuilds };
}
