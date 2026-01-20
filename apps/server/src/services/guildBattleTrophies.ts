/**
 * Guild Battle Trophies Service
 *
 * Handles trophy earning, streak tracking, and battle rewards for Arena 5v5.
 * Trophies provide permanent stat bonuses and coin multipliers.
 */

import { prisma } from '../lib/prisma.js';
import type { GuildBattleTrophy, GuildBattleStreak } from '@prisma/client';
import {
  GUILD_BATTLE_TROPHIES,
  calculateTotalStatBonus,
  calculateCoinMultiplier,
  type GuildBattleStreakData,
  type RivalryStats,
  type BattleReward,
} from '@arcade/protocol';

// ============================================================================
// CONSTANTS
// ============================================================================

const BATTLE_REWARDS = {
  WIN_BASE_COINS: 50,
  LOSS_BASE_COINS: 10,
  DOMINATION_BONUS: 25, // All 5 survivors
  STREAK_BONUS_PER_WIN: 0.10, // +10% per win in streak
  STREAK_BONUS_MAX: 1.0, // Max +100%
} as const;

// ============================================================================
// TYPES
// ============================================================================

export interface BattleOutcome {
  guildId: string;
  opponentGuildId: string;
  opponentHonor: number;
  guildHonor: number;
  won: boolean;
  survivors: number; // 0-5
  totalHeroes: number; // Always 5
  heroesLost: number; // How many heroes died during battle
}

export interface TrophyCheckResult {
  newTrophies: string[];
  updatedStreak: GuildBattleStreakData;
  calculatedReward: BattleReward;
}

// ============================================================================
// STREAK MANAGEMENT
// ============================================================================

/**
 * Get or create battle streak record for a guild
 */
export async function getOrCreateStreak(guildId: string): Promise<GuildBattleStreak> {
  let streak = await prisma.guildBattleStreak.findUnique({
    where: { guildId },
  });

  if (!streak) {
    streak = await prisma.guildBattleStreak.create({
      data: {
        guildId,
        currentWinStreak: 0,
        currentLossStreak: 0,
        bestWinStreak: 0,
        bestLossStreak: 0,
        rivalryStats: {},
      },
    });
  }

  return streak;
}

/**
 * Update streak after a battle
 */
export async function updateBattleStreak(
  guildId: string,
  opponentGuildId: string,
  won: boolean
): Promise<GuildBattleStreak> {
  const streak = await getOrCreateStreak(guildId);

  // Parse rivalry stats
  const rivalryStats = (streak.rivalryStats as RivalryStats) || {};
  if (!rivalryStats[opponentGuildId]) {
    rivalryStats[opponentGuildId] = { wins: 0, losses: 0 };
  }

  // Update rivalry
  if (won) {
    rivalryStats[opponentGuildId].wins++;
  } else {
    rivalryStats[opponentGuildId].losses++;
  }

  // Calculate new streaks
  let newWinStreak = won ? streak.currentWinStreak + 1 : 0;
  let newLossStreak = won ? 0 : streak.currentLossStreak + 1;
  let newBestWin = Math.max(streak.bestWinStreak, newWinStreak);
  let newBestLoss = Math.max(streak.bestLossStreak, newLossStreak);

  return prisma.guildBattleStreak.update({
    where: { guildId },
    data: {
      currentWinStreak: newWinStreak,
      currentLossStreak: newLossStreak,
      bestWinStreak: newBestWin,
      bestLossStreak: newBestLoss,
      rivalryStats,
    },
  });
}

/**
 * Get streak data for a guild
 */
export async function getStreakData(guildId: string): Promise<GuildBattleStreakData> {
  const streak = await getOrCreateStreak(guildId);
  return {
    currentWinStreak: streak.currentWinStreak,
    currentLossStreak: streak.currentLossStreak,
    bestWinStreak: streak.bestWinStreak,
    bestLossStreak: streak.bestLossStreak,
  };
}

// ============================================================================
// TROPHY EARNING
// ============================================================================

/**
 * Get total wins for a guild
 */
export async function getGuildTotalWins(guildId: string): Promise<number> {
  return prisma.guildBattle.count({
    where: { winnerGuildId: guildId },
  });
}

/**
 * Check and award trophies based on battle outcome
 */
export async function checkAndAwardTrophies(
  outcome: BattleOutcome
): Promise<string[]> {
  const newTrophies: string[] = [];

  if (!outcome.won) {
    return newTrophies; // Only award trophies for wins
  }

  // Get current state
  const [totalWins, streak, existingTrophies] = await Promise.all([
    getGuildTotalWins(outcome.guildId),
    getOrCreateStreak(outcome.guildId),
    prisma.guildBattleTrophy.findMany({
      where: { guildId: outcome.guildId },
      select: { trophyId: true },
    }),
  ]);

  const earnedTrophyIds = new Set(existingTrophies.map(t => t.trophyId));
  const rivalryStats = (streak.rivalryStats as RivalryStats) || {};
  const opponentStats = rivalryStats[outcome.opponentGuildId] || { wins: 0, losses: 0 };

  // Check cumulative wins trophies
  const winTrophies = ['FIRST_BLOOD', 'BATTLE_HARDENED', 'WAR_MACHINE', 'LEGENDARY_WARRIORS'];
  for (const trophyId of winTrophies) {
    if (earnedTrophyIds.has(trophyId)) continue;
    const trophy = GUILD_BATTLE_TROPHIES[trophyId];
    if (trophy && totalWins >= trophy.requirementValue) {
      await awardTrophy(outcome.guildId, trophyId, totalWins);
      newTrophies.push(trophyId);
      earnedTrophyIds.add(trophyId);
    }
  }

  // Check streak trophies (based on current streak + 1 for this win)
  const newWinStreak = streak.currentWinStreak + 1;
  const streakTrophies = ['HOT_STREAK', 'UNSTOPPABLE', 'INVINCIBLE'];
  for (const trophyId of streakTrophies) {
    if (earnedTrophyIds.has(trophyId)) continue;
    const trophy = GUILD_BATTLE_TROPHIES[trophyId];
    if (trophy && newWinStreak >= trophy.requirementValue) {
      await awardTrophy(outcome.guildId, trophyId, newWinStreak);
      newTrophies.push(trophyId);
      earnedTrophyIds.add(trophyId);
    }
  }

  // Check combat trophies
  // DOMINATION: Win with all 5 survivors
  if (!earnedTrophyIds.has('DOMINATION') && outcome.survivors === 5) {
    await awardTrophy(outcome.guildId, 'DOMINATION', 5);
    newTrophies.push('DOMINATION');
    earnedTrophyIds.add('DOMINATION');
  }

  // COMEBACK_KINGS: Win after losing 3+ heroes
  if (!earnedTrophyIds.has('COMEBACK_KINGS') && outcome.heroesLost >= 3 && outcome.survivors > 0) {
    await awardTrophy(outcome.guildId, 'COMEBACK_KINGS', outcome.heroesLost);
    newTrophies.push('COMEBACK_KINGS');
    earnedTrophyIds.add('COMEBACK_KINGS');
  }

  // UNDERDOG_VICTORY: Beat guild with 20%+ more honor
  if (!earnedTrophyIds.has('UNDERDOG_VICTORY')) {
    const honorDifference = ((outcome.opponentHonor - outcome.guildHonor) / outcome.guildHonor) * 100;
    if (honorDifference >= 20) {
      await awardTrophy(outcome.guildId, 'UNDERDOG_VICTORY', Math.round(honorDifference));
      newTrophies.push('UNDERDOG_VICTORY');
      earnedTrophyIds.add('UNDERDOG_VICTORY');
    }
  }

  // Check rivalry trophies (wins against same opponent + 1 for this win)
  const winsVsOpponent = opponentStats.wins + 1;

  // RIVAL_CRUSHER: Beat same guild 5 times
  if (!earnedTrophyIds.has('RIVAL_CRUSHER') && winsVsOpponent >= 5) {
    await awardTrophy(outcome.guildId, 'RIVAL_CRUSHER', winsVsOpponent);
    newTrophies.push('RIVAL_CRUSHER');
    earnedTrophyIds.add('RIVAL_CRUSHER');
  }

  // NEMESIS: Beat same guild 10 times
  if (!earnedTrophyIds.has('NEMESIS') && winsVsOpponent >= 10) {
    await awardTrophy(outcome.guildId, 'NEMESIS', winsVsOpponent);
    newTrophies.push('NEMESIS');
    earnedTrophyIds.add('NEMESIS');
  }

  return newTrophies;
}

/**
 * Award a trophy to a guild
 */
async function awardTrophy(
  guildId: string,
  trophyId: string,
  progress: number
): Promise<GuildBattleTrophy> {
  return prisma.guildBattleTrophy.upsert({
    where: {
      guildId_trophyId: { guildId, trophyId },
    },
    update: {
      progress,
      upgradedAt: new Date(),
    },
    create: {
      guildId,
      trophyId,
      progress,
      tier: 1,
      maxTier: 1,
      isActive: true,
    },
  });
}

// ============================================================================
// BATTLE REWARDS
// ============================================================================

/**
 * Calculate battle rewards including trophy bonuses
 */
export async function calculateBattleRewards(
  guildId: string,
  won: boolean,
  survivors: number,
  newTrophies: string[]
): Promise<BattleReward> {
  // Get streak for bonus calculation
  const streak = await getOrCreateStreak(guildId);

  // Get earned trophies for multiplier
  const trophies = await prisma.guildBattleTrophy.findMany({
    where: { guildId, isActive: true },
    select: { trophyId: true },
  });
  const trophyIds = trophies.map(t => t.trophyId);

  // Calculate base coins
  const baseCoins = won ? BATTLE_REWARDS.WIN_BASE_COINS : BATTLE_REWARDS.LOSS_BASE_COINS;

  // Calculate bonuses
  let bonusCoins = 0;
  const bonusReasons: string[] = [];

  if (won) {
    // Domination bonus (all 5 survivors)
    if (survivors === 5) {
      bonusCoins += BATTLE_REWARDS.DOMINATION_BONUS;
      bonusReasons.push(`+${BATTLE_REWARDS.DOMINATION_BONUS} Domination (5 survivors)`);
    }

    // Streak bonus (+10% per win, max +100%)
    const streakBonus = Math.min(
      streak.currentWinStreak * BATTLE_REWARDS.STREAK_BONUS_PER_WIN,
      BATTLE_REWARDS.STREAK_BONUS_MAX
    );
    if (streakBonus > 0) {
      const streakBonusCoins = Math.floor(baseCoins * streakBonus);
      bonusCoins += streakBonusCoins;
      bonusReasons.push(`+${streakBonusCoins} Win Streak x${streak.currentWinStreak + 1}`);
    }
  }

  // Apply trophy coin multiplier
  const coinMultiplier = calculateCoinMultiplier(trophyIds);
  const multipliedTotal = Math.floor((baseCoins + bonusCoins) * coinMultiplier);
  const multiplierBonus = multipliedTotal - (baseCoins + bonusCoins);

  if (multiplierBonus > 0) {
    bonusReasons.push(`+${multiplierBonus} Trophy Bonus (${Math.round((coinMultiplier - 1) * 100)}%)`);
  }

  return {
    baseCoins,
    bonusCoins: multipliedTotal - baseCoins,
    totalCoins: multipliedTotal,
    bonusReasons,
    newTrophies,
    streakStatus: {
      currentWinStreak: won ? streak.currentWinStreak + 1 : 0,
      currentLossStreak: won ? 0 : streak.currentLossStreak + 1,
      bestWinStreak: Math.max(streak.bestWinStreak, won ? streak.currentWinStreak + 1 : 0),
      bestLossStreak: Math.max(streak.bestLossStreak, won ? 0 : streak.currentLossStreak + 1),
    },
  };
}

// ============================================================================
// TROPHY QUERIES
// ============================================================================

/**
 * Get all trophies for a guild with progress
 */
export async function getGuildTrophies(guildId: string): Promise<{
  earned: any[];
  inProgress: any[];
  totalStatBonus: number;
  coinMultiplier: number;
  streak: GuildBattleStreakData;
}> {
  const [trophies, streak, totalWins] = await Promise.all([
    prisma.guildBattleTrophy.findMany({
      where: { guildId },
    }),
    getStreakData(guildId),
    getGuildTotalWins(guildId),
  ]);

  const earnedTrophyIds = new Set(trophies.map(t => t.trophyId));
  const trophyMap = new Map(trophies.map(t => [t.trophyId, t]));

  const earned: any[] = [];
  const inProgress: any[] = [];

  // Process all trophy definitions
  for (const [trophyId, def] of Object.entries(GUILD_BATTLE_TROPHIES)) {
    const dbTrophy = trophyMap.get(trophyId);
    const isEarned = earnedTrophyIds.has(trophyId);

    // Determine current progress
    let progress = 0;
    if (def.requirementType === 'cumulative_wins') {
      progress = totalWins;
    } else if (def.requirementType === 'win_streak') {
      progress = streak.currentWinStreak;
    }
    // Combat and rivalry trophies don't show progress until earned

    const trophyData = {
      trophyId,
      name: def.name,
      polishName: def.polishName,
      icon: def.icon,
      color: def.color,
      category: def.category,
      progress: dbTrophy?.progress ?? progress,
      target: def.requirementValue,
      isEarned,
      earnedAt: dbTrophy?.earnedAt?.toISOString() ?? null,
      bonus: {
        type: def.bonus.type,
        value: def.bonus.value,
        description: def.bonus.description,
      },
    };

    if (isEarned) {
      earned.push(trophyData);
    } else {
      inProgress.push(trophyData);
    }
  }

  // Calculate total bonuses from earned trophies
  const earnedIds = Array.from(earnedTrophyIds);
  const totalStatBonus = calculateTotalStatBonus(earnedIds);
  const coinMultiplier = calculateCoinMultiplier(earnedIds);

  return {
    earned,
    inProgress,
    totalStatBonus,
    coinMultiplier,
    streak,
  };
}

/**
 * Get trophy stat bonus for a guild (for combat calculations)
 */
export async function getTrophyStatBonus(guildId: string): Promise<number> {
  const trophies = await prisma.guildBattleTrophy.findMany({
    where: { guildId, isActive: true },
    select: { trophyId: true },
  });

  return calculateTotalStatBonus(trophies.map(t => t.trophyId));
}
