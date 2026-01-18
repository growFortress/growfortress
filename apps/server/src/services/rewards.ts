import { prisma } from '../lib/prisma.js';
import { getXpForLevel } from '@arcade/sim-core';

export interface RunRewards {
  gold: number;
  dust: number;
  xp: number;
  levelUp: boolean;
  newLevel?: number;
}

/**
 * Calculate rewards from a verified run
 * Uses unified XP formula for post-run bonuses
 */
export function calculateRewards(
  summary: {
    wavesCleared: number;
    kills: number;
    eliteKills: number;
    goldEarned: number;
    dustEarned: number;
    won: boolean;
  },
  multipliers: { xp: number; gold: number; dust: number } = { xp: 1, gold: 1, dust: 1 }
): RunRewards {
  // Gold = earned during run
  const gold = summary.goldEarned;

  // Dust = earned during run only (no win bonus - dust now from daily quests only)
  const dust = summary.dustEarned;

  // XP calculation (post-run bonuses according to unified system)
  let xp = 0;
  xp += summary.wavesCleared * 10;        // 10 XP per wave cleared (rebalanced from 15)
  xp += Math.floor(summary.kills * 1.0);  // 1.0 XP per kill (rebalanced from 1.5)
  xp += summary.eliteKills * 5;           // 5 XP per elite kill (rebalanced from 8)
  if (summary.won) {
    xp += 125; // Victory bonus (rebalanced from 200)
  }

  // Apply event multipliers
  const finalGold = Math.floor(gold * multipliers.gold);
  const finalDust = Math.floor(dust * multipliers.dust);
  const finalXp = Math.floor(xp * multipliers.xp);

  return {
    gold: finalGold,
    dust: finalDust,
    xp: finalXp,
    levelUp: false, // Will be set by applyRewards
  };
}

/**
 * Apply rewards to user
 */
export async function applyRewards(
  userId: string,
  rewards: RunRewards
): Promise<{
  newInventory: { gold: number; dust: number };
  newProgression: { level: number; xp: number; totalXp: number; xpToNextLevel: number };
  levelUp: boolean;
  newLevel?: number;
}> {
  // Get current user state
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      inventory: true,
      progression: true,
    },
  });

  if (!user || !user.inventory || !user.progression) {
    throw new Error('User not found');
  }

  // Calculate new inventory
  const newGold = user.inventory.gold + rewards.gold;
  const newDust = user.inventory.dust + rewards.dust;

  // Calculate new progression
  let newXp = user.progression.xp + rewards.xp;
  let newLevel = user.progression.level;
  const newTotalXp = user.progression.totalXp + rewards.xp;
  let levelUp = false;

  // Check for level ups (XP needed is for current level)
  while (newXp >= getXpForLevel(newLevel)) {
    newXp -= getXpForLevel(newLevel);
    newLevel++;
    levelUp = true;
  }

  // Update database
  await prisma.$transaction([
    prisma.inventory.update({
      where: { userId },
      data: {
        gold: newGold,
        dust: newDust,
      },
    }),
    prisma.progression.update({
      where: { userId },
      data: {
        level: newLevel,
        xp: newXp,
        totalXp: newTotalXp,
      },
    }),
  ]);

  return {
    newInventory: {
      gold: newGold,
      dust: newDust,
    },
    newProgression: {
      level: newLevel,
      xp: newXp,
      totalXp: newTotalXp,
      xpToNextLevel: getXpForLevel(newLevel) - newXp,
    },
    levelUp,
    newLevel: levelUp ? newLevel : undefined,
  };
}
