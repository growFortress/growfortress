import { prisma } from '../lib/prisma.js';
import {
  DAILY_QUEST_DEFINITIONS,
  DAILY_QUEST_ERROR_CODES,
  type DailyQuestId,
  type DailyQuestProgress,
  type DailyQuestsResponse,
  type ClaimQuestRewardResponse,
  type ClaimAllQuestsResponse,
} from '@arcade/protocol';
import { MATERIAL_DEFINITIONS } from '@arcade/sim-core';
import { addPoints as addBattlePassPoints } from './battlepass.js';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the next daily reset time (midnight UTC)
 */
export function getNextResetTime(): Date {
  const now = new Date();
  const nextReset = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1, // Tomorrow
    0, 0, 0, 0 // Midnight UTC
  ));
  return nextReset;
}

/**
 * Get the current reset time (start of today, midnight UTC)
 */
export function getCurrentResetTime(): Date {
  const now = new Date();
  return new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    0, 0, 0, 0
  ));
}

/**
 * Get a random material of the specified rarity
 */
function getRandomMaterial(rarity: 'rare' | 'epic' | 'legendary' = 'rare'): string {
  const materials = MATERIAL_DEFINITIONS.filter(m => m.rarity === rarity);
  if (materials.length === 0) {
    // Fallback to any rare material
    const rareMaterials = MATERIAL_DEFINITIONS.filter(m => m.rarity === 'rare');
    if (rareMaterials.length === 0) {
      return 'cosmic_dust'; // Ultimate fallback if no materials defined
    }
    return rareMaterials[Math.floor(Math.random() * rareMaterials.length)].id;
  }
  return materials[Math.floor(Math.random() * materials.length)].id;
}

// ============================================================================
// CORE SERVICE FUNCTIONS
// ============================================================================

/**
 * Get daily quest progress for a user
 * Initializes quests if they don't exist for the current period
 */
export async function getDailyQuests(userId: string): Promise<DailyQuestsResponse> {
  const currentReset = getCurrentResetTime();
  const nextReset = getNextResetTime();

  // Get existing progress for current period
  const existingProgress = await prisma.dailyQuestProgress.findMany({
    where: {
      userId,
      resetAt: currentReset,
    },
  });

  // Create a map of existing progress
  const progressMap = new Map(existingProgress.map(p => [p.questId, p]));

  // Build response with all quests
  const quests: DailyQuestProgress[] = DAILY_QUEST_DEFINITIONS.map(quest => {
    const progress = progressMap.get(quest.id);
    return {
      questId: quest.id as DailyQuestId,
      progress: progress?.progress ?? 0,
      target: quest.target,
      completed: progress?.completed ?? false,
      claimed: progress?.claimed ?? false,
      dustReward: quest.dustReward,
      bonusType: quest.bonusType,
      bonusValue: quest.bonusValue,
    };
  });

  // Calculate totals
  const totalDustEarned = quests
    .filter(q => q.claimed)
    .reduce((sum, q) => sum + q.dustReward, 0);

  const allCompleted = quests.every(q => q.completed);
  const allClaimed = quests.every(q => q.claimed);

  return {
    quests,
    resetAt: nextReset.toISOString(),
    totalDustEarned,
    allCompleted,
    allClaimed,
  };
}

/**
 * Update progress for a specific quest
 */
export async function updateQuestProgress(
  userId: string,
  questId: DailyQuestId,
  progressDelta: number
): Promise<void> {
  const quest = DAILY_QUEST_DEFINITIONS.find(q => q.id === questId);
  if (!quest) return;

  const currentReset = getCurrentResetTime();

  // Upsert progress record
  await prisma.dailyQuestProgress.upsert({
    where: {
      userId_questId_resetAt: {
        userId,
        questId,
        resetAt: currentReset,
      },
    },
    create: {
      userId,
      questId,
      progress: Math.min(progressDelta, quest.target),
      completed: progressDelta >= quest.target,
      claimed: false,
      resetAt: currentReset,
    },
    update: {
      progress: {
        increment: progressDelta,
      },
    },
  });

  // Check if now completed
  const updated = await prisma.dailyQuestProgress.findUnique({
    where: {
      userId_questId_resetAt: {
        userId,
        questId,
        resetAt: currentReset,
      },
    },
  });

  if (updated && updated.progress >= quest.target && !updated.completed) {
    await prisma.dailyQuestProgress.update({
      where: { id: updated.id },
      data: { completed: true },
    });
  }
}

/**
 * Batch update multiple quest progress (for run completion)
 */
export async function updateQuestsFromRun(
  userId: string,
  runStats: {
    runsCompleted?: number;
    enemiesKilled?: number;
    elitesKilled?: number;
    bossesKilled?: number;
  }
): Promise<void> {
  const { runsCompleted = 0, enemiesKilled = 0, elitesKilled = 0, bossesKilled = 0 } = runStats;

  // Update each relevant quest
  if (runsCompleted > 0) {
    await updateQuestProgress(userId, 'first_blood', runsCompleted);
    await updateQuestProgress(userId, 'dedicated', runsCompleted);
  }
  if (enemiesKilled > 0) {
    await updateQuestProgress(userId, 'wave_hunter', enemiesKilled);
  }
  if (elitesKilled > 0) {
    await updateQuestProgress(userId, 'elite_slayer', elitesKilled);
  }
  if (bossesKilled > 0) {
    await updateQuestProgress(userId, 'boss_slayer', bossesKilled);
  }
}

/**
 * Claim reward for a completed quest
 */
export async function claimQuestReward(
  userId: string,
  questId: DailyQuestId
): Promise<ClaimQuestRewardResponse> {
  const quest = DAILY_QUEST_DEFINITIONS.find(q => q.id === questId);
  if (!quest) {
    return {
      success: false,
      dustAwarded: 0,
      bonusAwarded: null,
      newInventory: { dust: 0, gold: 0, materials: {} },
      error: DAILY_QUEST_ERROR_CODES.QUEST_NOT_FOUND,
    };
  }

  const currentReset = getCurrentResetTime();

  // Get current progress
  const progress = await prisma.dailyQuestProgress.findUnique({
    where: {
      userId_questId_resetAt: {
        userId,
        questId,
        resetAt: currentReset,
      },
    },
  });

  if (!progress || !progress.completed) {
    return {
      success: false,
      dustAwarded: 0,
      bonusAwarded: null,
      newInventory: { dust: 0, gold: 0, materials: {} },
      error: DAILY_QUEST_ERROR_CODES.QUEST_NOT_COMPLETED,
    };
  }

  if (progress.claimed) {
    return {
      success: false,
      dustAwarded: 0,
      bonusAwarded: null,
      newInventory: { dust: 0, gold: 0, materials: {} },
      error: DAILY_QUEST_ERROR_CODES.QUEST_ALREADY_CLAIMED,
    };
  }

  // Calculate rewards
  const dustAwarded = quest.dustReward;
  let goldAwarded = 0;
  const materialsAwarded: Record<string, number> = {};
  let bonusAwarded: { type: 'gold' | 'material' | 'random_material'; value: number | string } | null = null;

  if (quest.bonusType === 'gold' && typeof quest.bonusValue === 'number') {
    goldAwarded = quest.bonusValue;
    bonusAwarded = { type: 'gold', value: quest.bonusValue };
  } else if (quest.bonusType === 'material' && typeof quest.bonusValue === 'string') {
    materialsAwarded[quest.bonusValue] = 1;
    bonusAwarded = { type: 'material', value: quest.bonusValue };
  } else if (quest.bonusType === 'random_material' && typeof quest.bonusValue === 'number') {
    // Give random materials
    for (let i = 0; i < quest.bonusValue; i++) {
      const materialId = getRandomMaterial('rare');
      materialsAwarded[materialId] = (materialsAwarded[materialId] ?? 0) + 1;
    }
    bonusAwarded = { type: 'random_material', value: quest.bonusValue };
  }

  // Update database in transaction
  const result = await prisma.$transaction(async (tx) => {
    // Mark as claimed
    await tx.dailyQuestProgress.update({
      where: { id: progress.id },
      data: { claimed: true },
    });

    // Get current inventory
    const inventory = await tx.inventory.findUnique({
      where: { userId },
    });

    if (!inventory) {
      throw new Error('Inventory not found');
    }

    // Update inventory
    const currentMaterials = (inventory.materials as Record<string, number>) ?? {};
    const newMaterials = { ...currentMaterials };
    for (const [matId, amount] of Object.entries(materialsAwarded)) {
      newMaterials[matId] = (newMaterials[matId] ?? 0) + amount;
    }

    const updatedInventory = await tx.inventory.update({
      where: { userId },
      data: {
        dust: { increment: dustAwarded },
        gold: { increment: goldAwarded },
        materials: newMaterials,
      },
    });

    return {
      dust: updatedInventory.dust,
      gold: updatedInventory.gold,
      materials: updatedInventory.materials as Record<string, number>,
    };
  });

  // Grant Battle Pass points for completing quest
  await addBattlePassPoints(userId, 'daily_quest');

  return {
    success: true,
    dustAwarded,
    bonusAwarded,
    newInventory: result,
  };
}

/**
 * Claim all completed but unclaimed quest rewards
 */
export async function claimAllQuestRewards(userId: string): Promise<ClaimAllQuestsResponse> {
  const currentReset = getCurrentResetTime();

  // Get all completed but unclaimed quests
  const unclaimedQuests = await prisma.dailyQuestProgress.findMany({
    where: {
      userId,
      resetAt: currentReset,
      completed: true,
      claimed: false,
    },
  });

  if (unclaimedQuests.length === 0) {
    const inventory = await prisma.inventory.findUnique({
      where: { userId },
    });
    return {
      success: false,
      totalDustAwarded: 0,
      totalGoldAwarded: 0,
      materialsAwarded: {},
      claimedCount: 0,
      newInventory: {
        dust: inventory?.dust ?? 0,
        gold: inventory?.gold ?? 0,
        materials: (inventory?.materials as Record<string, number>) ?? {},
      },
      error: DAILY_QUEST_ERROR_CODES.NO_QUESTS_TO_CLAIM,
    };
  }

  // Calculate total rewards
  let totalDust = 0;
  let totalGold = 0;
  const allMaterials: Record<string, number> = {};

  for (const progress of unclaimedQuests) {
    const quest = DAILY_QUEST_DEFINITIONS.find(q => q.id === progress.questId);
    if (!quest) continue;

    totalDust += quest.dustReward;

    if (quest.bonusType === 'gold' && typeof quest.bonusValue === 'number') {
      totalGold += quest.bonusValue;
    } else if (quest.bonusType === 'material' && typeof quest.bonusValue === 'string') {
      allMaterials[quest.bonusValue] = (allMaterials[quest.bonusValue] ?? 0) + 1;
    } else if (quest.bonusType === 'random_material' && typeof quest.bonusValue === 'number') {
      for (let i = 0; i < quest.bonusValue; i++) {
        const materialId = getRandomMaterial('rare');
        allMaterials[materialId] = (allMaterials[materialId] ?? 0) + 1;
      }
    }
  }

  // Update database in transaction
  const result = await prisma.$transaction(async (tx) => {
    // Mark all as claimed
    await tx.dailyQuestProgress.updateMany({
      where: {
        userId,
        resetAt: currentReset,
        completed: true,
        claimed: false,
      },
      data: { claimed: true },
    });

    // Get current inventory
    const inventory = await tx.inventory.findUnique({
      where: { userId },
    });

    if (!inventory) {
      throw new Error('Inventory not found');
    }

    // Update inventory
    const currentMaterials = (inventory.materials as Record<string, number>) ?? {};
    const newMaterials = { ...currentMaterials };
    for (const [matId, amount] of Object.entries(allMaterials)) {
      newMaterials[matId] = (newMaterials[matId] ?? 0) + amount;
    }

    const updatedInventory = await tx.inventory.update({
      where: { userId },
      data: {
        dust: { increment: totalDust },
        gold: { increment: totalGold },
        materials: newMaterials,
      },
    });

    return {
      dust: updatedInventory.dust,
      gold: updatedInventory.gold,
      materials: updatedInventory.materials as Record<string, number>,
    };
  });

  // Grant Battle Pass points for each claimed quest
  if (unclaimedQuests.length > 0) {
    await addBattlePassPoints(userId, 'daily_quest', unclaimedQuests.length);
  }

  return {
    success: true,
    totalDustAwarded: totalDust,
    totalGoldAwarded: totalGold,
    materialsAwarded: allMaterials,
    claimedCount: unclaimedQuests.length,
    newInventory: result,
  };
}

/**
 * Reset all daily quests (called by cron job at midnight UTC)
 * Note: Old records are kept for analytics, new ones are created on demand
 */
export async function cleanupOldQuestProgress(daysToKeep: number = 7): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const result = await prisma.dailyQuestProgress.deleteMany({
    where: {
      resetAt: {
        lt: cutoffDate,
      },
    },
  });

  return result.count;
}
