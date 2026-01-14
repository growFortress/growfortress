import { prisma } from '../lib/prisma.js';
import {
  GUILD_CONSTANTS,
  GUILD_LEVEL_TABLE,
  GUILD_TROPHIES,
  type GuildLevelInfo,
} from '@arcade/protocol';
// Prisma types used internally

// ============================================================================
// TYPES
// ============================================================================

export interface LevelUpResult {
  leveled: boolean;
  newLevel?: number;
  previousLevel?: number;
}

export interface TrophyCheckResult {
  newTrophies: string[];
}

// ============================================================================
// LEVEL CALCULATIONS
// ============================================================================

/**
 * Get XP required for a specific level
 */
export function getXpForLevel(level: number): number {
  const levelData = GUILD_LEVEL_TABLE.find(l => l.level === level);
  return levelData?.xpRequired ?? GUILD_LEVEL_TABLE[GUILD_LEVEL_TABLE.length - 1].xpRequired;
}

/**
 * Get XP required for next level
 */
export function getXpToNextLevel(currentLevel: number, currentXp: number): number {
  if (currentLevel >= 20) {
    return 0; // Max level
  }
  const nextLevelXp = getXpForLevel(currentLevel + 1);
  return Math.max(0, nextLevelXp - currentXp);
}

/**
 * Calculate level from total XP
 */
export function calculateLevelFromXp(totalXp: number): number {
  let level = 1;
  for (const levelData of GUILD_LEVEL_TABLE) {
    if (totalXp >= levelData.xpRequired) {
      level = levelData.level;
    } else {
      break;
    }
  }
  return level;
}

/**
 * Get full level info for a guild
 */
export function getGuildLevelInfo(level: number, xp: number, totalXp: number): GuildLevelInfo {
  const levelData = GUILD_LEVEL_TABLE.find(l => l.level === level) || GUILD_LEVEL_TABLE[0];

  return {
    level,
    xp,
    xpToNextLevel: getXpToNextLevel(level, totalXp),
    totalXp,
    memberCapacity: levelData.memberCap,
    bonuses: {
      goldBoost: levelData.goldBoost,
      dustBoost: levelData.dustBoost,
      xpBoost: levelData.xpBoost,
    },
  };
}

// ============================================================================
// XP MANAGEMENT
// ============================================================================

/**
 * Add XP to a guild
 */
export async function addGuildXp(
  guildId: string,
  amount: number,
  _source: string
): Promise<LevelUpResult> {
  const guild = await prisma.guild.findUnique({
    where: { id: guildId },
  });

  if (!guild || guild.disbanded) {
    return { leveled: false };
  }

  const newTotalXp = guild.totalXp + amount;
  const newLevel = calculateLevelFromXp(newTotalXp);
  const leveled = newLevel > guild.level;

  await prisma.guild.update({
    where: { id: guildId },
    data: {
      xp: guild.xp + amount,
      totalXp: newTotalXp,
      level: newLevel,
    },
  });

  return {
    leveled,
    newLevel: leveled ? newLevel : undefined,
    previousLevel: leveled ? guild.level : undefined,
  };
}

/**
 * Add XP from member activity (wave cleared)
 */
export async function addXpFromWave(userId: string): Promise<void> {
  const membership = await prisma.guildMember.findUnique({
    where: { userId },
  });

  if (!membership) {
    return;
  }

  await addGuildXp(
    membership.guildId,
    GUILD_CONSTANTS.XP_PER_WAVE,
    'wave_cleared'
  );

  // Update member's weekly contribution
  await prisma.guildMember.update({
    where: { userId },
    data: {
      weeklyXpContributed: { increment: GUILD_CONSTANTS.XP_PER_WAVE },
    },
  });
}

/**
 * Add XP from run completion
 */
export async function addXpFromRun(userId: string): Promise<void> {
  const membership = await prisma.guildMember.findUnique({
    where: { userId },
  });

  if (!membership) {
    return;
  }

  await addGuildXp(
    membership.guildId,
    GUILD_CONSTANTS.XP_PER_RUN,
    'run_completed'
  );

  await prisma.guildMember.update({
    where: { userId },
    data: {
      weeklyXpContributed: { increment: GUILD_CONSTANTS.XP_PER_RUN },
    },
  });
}

/**
 * Add XP from donation
 */
export async function addXpFromDonation(
  guildId: string,
  goldAmount: number,
  dustAmount: number
): Promise<void> {
  const goldXp = Math.floor(goldAmount / 100) * GUILD_CONSTANTS.XP_PER_100_GOLD_DONATED;
  const dustXp = Math.floor(dustAmount / 10) * GUILD_CONSTANTS.XP_PER_10_DUST_DONATED;
  const totalXp = goldXp + dustXp;

  if (totalXp > 0) {
    await addGuildXp(guildId, totalXp, 'donation');
  }
}

/**
 * Add XP from battle
 */
export async function addXpFromBattle(
  guildId: string,
  won: boolean
): Promise<void> {
  const xp = won
    ? GUILD_CONSTANTS.XP_PER_BATTLE_WIN
    : GUILD_CONSTANTS.XP_PER_BATTLE_PARTICIPATION;

  await addGuildXp(guildId, xp, won ? 'battle_win' : 'battle_participation');
}

// ============================================================================
// TROPHY MANAGEMENT
// ============================================================================

/**
 * Check and award trophies based on current stats
 */
export async function checkAndAwardTrophies(guildId: string): Promise<TrophyCheckResult> {
  const guild = await prisma.guild.findUnique({
    where: { id: guildId },
    include: {
      treasury: true,
      _count: { select: { members: true } },
    },
  });

  if (!guild || guild.disbanded) {
    return { newTrophies: [] };
  }

  const currentTrophies = (guild.trophies as string[]) || [];
  const newTrophies: string[] = [];

  // Count battle wins
  const battleWins = await prisma.guildBattle.count({
    where: {
      winnerGuildId: guildId,
      status: 'RESOLVED',
    },
  });

  // Check FIRST_BLOOD
  if (!currentTrophies.includes(GUILD_TROPHIES.FIRST_BLOOD.id) && battleWins >= 1) {
    newTrophies.push(GUILD_TROPHIES.FIRST_BLOOD.id);
  }

  // Check BATTLE_HARDENED
  if (!currentTrophies.includes(GUILD_TROPHIES.BATTLE_HARDENED.id) && battleWins >= 10) {
    newTrophies.push(GUILD_TROPHIES.BATTLE_HARDENED.id);
  }

  // Check WAR_MACHINE
  if (!currentTrophies.includes(GUILD_TROPHIES.WAR_MACHINE.id) && battleWins >= 50) {
    newTrophies.push(GUILD_TROPHIES.WAR_MACHINE.id);
  }

  // Check WEALTHY
  if (
    !currentTrophies.includes(GUILD_TROPHIES.WEALTHY.id) &&
    guild.treasury &&
    Number(guild.treasury.totalGoldDeposited) >= 1000000
  ) {
    newTrophies.push(GUILD_TROPHIES.WEALTHY.id);
  }

  // Check UNITED
  if (!currentTrophies.includes(GUILD_TROPHIES.UNITED.id) && guild._count.members >= 20) {
    newTrophies.push(GUILD_TROPHIES.UNITED.id);
  }

  // Check ANCIENT (90 days)
  const daysSinceCreation = Math.floor(
    (Date.now() - guild.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (!currentTrophies.includes(GUILD_TROPHIES.ANCIENT.id) && daysSinceCreation >= 90) {
    newTrophies.push(GUILD_TROPHIES.ANCIENT.id);
  }

  // Award new trophies
  if (newTrophies.length > 0) {
    await prisma.guild.update({
      where: { id: guildId },
      data: {
        trophies: [...currentTrophies, ...newTrophies],
      },
    });
  }

  return { newTrophies };
}

/**
 * Award champions trophy (called from leaderboard service)
 */
export async function awardChampionsTrophy(guildId: string): Promise<void> {
  const guild = await prisma.guild.findUnique({
    where: { id: guildId },
  });

  if (!guild || guild.disbanded) {
    return;
  }

  const currentTrophies = (guild.trophies as string[]) || [];

  if (!currentTrophies.includes(GUILD_TROPHIES.CHAMPIONS.id)) {
    await prisma.guild.update({
      where: { id: guildId },
      data: {
        trophies: [...currentTrophies, GUILD_TROPHIES.CHAMPIONS.id],
      },
    });
  }
}

/**
 * Get trophy bonuses for a guild
 */
export function getTrophyBonuses(trophies: string[]): {
  statBonus: number;
  goldBonus: number;
  xpBonus: number;
  dustBonus: number;
} {
  let statBonus = 0;
  let goldBonus = 0;
  let xpBonus = 0;
  let dustBonus = 0;

  if (trophies.includes(GUILD_TROPHIES.FIRST_BLOOD.id)) {
    statBonus += 5;
  }
  if (trophies.includes(GUILD_TROPHIES.BATTLE_HARDENED.id)) {
    statBonus += 10;
  }
  if (trophies.includes(GUILD_TROPHIES.WAR_MACHINE.id)) {
    statBonus += 20;
  }
  if (trophies.includes(GUILD_TROPHIES.WEALTHY.id)) {
    goldBonus += 0.05;
  }
  if (trophies.includes(GUILD_TROPHIES.UNITED.id)) {
    xpBonus += 0.05;
  }
  if (trophies.includes(GUILD_TROPHIES.ANCIENT.id)) {
    dustBonus += 0.05;
  }

  return { statBonus, goldBonus, xpBonus, dustBonus };
}

/**
 * Reset weekly member contributions
 */
export async function resetWeeklyContributions(): Promise<number> {
  const result = await prisma.guildMember.updateMany({
    data: { weeklyXpContributed: 0 },
  });
  return result.count;
}
