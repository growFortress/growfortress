import { prisma } from '../lib/prisma.js';
import { GUILD_TROPHIES, GUILD_CONSTANTS } from '@arcade/protocol';

// ============================================================================
// TYPES
// ============================================================================

export interface TrophyCheckResult {
  newTrophies: string[];
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

  // Check UNITED (max members = 30 with fully upgraded Kwatera)
  if (
    !currentTrophies.includes(GUILD_TROPHIES.UNITED.id) &&
    guild._count.members >= GUILD_CONSTANTS.MEMBER_MAX_CAPACITY
  ) {
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
