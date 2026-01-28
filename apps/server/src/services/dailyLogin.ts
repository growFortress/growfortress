import { prisma } from '../lib/prisma.js';
import {
  DAILY_REWARD_CONFIG,
  DAILY_REWARD_CYCLE_LENGTH,
  getDailyReward,
  getStreakMultiplier,
  getNextStreakMilestone,
  isSameUTCDay,
  isConsecutiveDay,
  type DailyLoginStatusResponse,
  type ClaimDailyRewardResponse,
} from '@arcade/protocol';

/**
 * Daily Login Rewards Service
 *
 * Handles the 7-day login reward cycle with streak bonuses.
 * Players can claim one reward per day, building streaks for bonus multipliers.
 */

// ============================================================================
// DAILY STATUS
// ============================================================================

/**
 * Get daily login status for a user
 */
export async function getDailyLoginStatus(userId: string): Promise<DailyLoginStatusResponse | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      dailyLoginProgress: true,
      inventory: true,
    },
  });

  if (!user) {
    return null;
  }

  const now = new Date();

  // Get or initialize progress
  let progress = user.dailyLoginProgress;
  if (!progress) {
    // Create initial progress record
    progress = await prisma.dailyLoginProgress.create({
      data: {
        userId,
        currentDay: 1,
        streak: 0,
        lastClaimAt: null,
        totalDaysClaimed: 0,
      },
    });
  }

  // Check if player can claim today
  const lastClaim = progress.lastClaimAt;
  let canClaim = true;
  let currentStreak = progress.streak;

  if (lastClaim) {
    // Already claimed today?
    if (isSameUTCDay(lastClaim, now)) {
      canClaim = false;
    } else if (!isConsecutiveDay(lastClaim, now)) {
      // Streak broken - will be reset on next claim
      // (but show current streak until they claim)
    }
  }

  // Calculate streak multiplier
  const streakMultiplier = getStreakMultiplier(currentStreak);
  const nextMilestone = getNextStreakMilestone(currentStreak);
  const daysUntilNextMilestone = nextMilestone ? nextMilestone - currentStreak : null;

  // Build rewards array with claim status
  const rewards = DAILY_REWARD_CONFIG.map((reward, index) => {
    const day = index + 1;
    const isClaimed = day < progress!.currentDay || (day === progress!.currentDay && !canClaim);
    const isToday = day === progress!.currentDay;

    return {
      day,
      gold: reward.gold,
      dust: reward.dust,
      energy: reward.energy,
      materials: reward.materials,
      isBonus: reward.isBonus,
      claimed: isClaimed,
      isToday,
    };
  });

  return {
    currentDay: progress.currentDay,
    streak: currentStreak,
    canClaim,
    lastClaimAt: lastClaim?.toISOString() ?? null,
    totalDaysClaimed: progress.totalDaysClaimed,
    streakMultiplier,
    nextMilestone,
    daysUntilNextMilestone,
    rewards,
  };
}

// ============================================================================
// CLAIM REWARD
// ============================================================================

/**
 * Claim daily login reward
 */
export async function claimDailyReward(userId: string): Promise<ClaimDailyRewardResponse> {
  const now = new Date();

  // Get current status
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      dailyLoginProgress: true,
      inventory: true,
    },
  });

  if (!user) {
    return {
      success: false,
      goldAwarded: 0,
      dustAwarded: 0,
      energyAwarded: 0,
      materialsAwarded: {},
      streakMultiplier: 1,
      newStreak: 0,
      newCurrentDay: 1,
      newInventory: { gold: 0, dust: 0, materials: {} },
      error: 'User not found',
    };
  }

  // Initialize progress if needed
  let progress = user.dailyLoginProgress;
  if (!progress) {
    progress = await prisma.dailyLoginProgress.create({
      data: {
        userId,
        currentDay: 1,
        streak: 0,
        lastClaimAt: null,
        totalDaysClaimed: 0,
      },
    });
  }

  // Check if already claimed today
  if (progress.lastClaimAt && isSameUTCDay(progress.lastClaimAt, now)) {
    return {
      success: false,
      goldAwarded: 0,
      dustAwarded: 0,
      energyAwarded: 0,
      materialsAwarded: {},
      streakMultiplier: getStreakMultiplier(progress.streak),
      newStreak: progress.streak,
      newCurrentDay: progress.currentDay,
      newInventory: {
        gold: user.inventory?.gold ?? 0,
        dust: user.inventory?.dust ?? 0,
        materials: (user.inventory?.materials as Record<string, number>) ?? {},
      },
      error: 'ALREADY_CLAIMED_TODAY',
    };
  }

  // Calculate new streak
  let newStreak = progress.streak;
  if (progress.lastClaimAt) {
    if (isConsecutiveDay(progress.lastClaimAt, now)) {
      // Continue streak
      newStreak = progress.streak + 1;
    } else {
      // Streak broken - reset to 1
      newStreak = 1;
    }
  } else {
    // First ever claim
    newStreak = 1;
  }

  // Get reward for current day
  const reward = getDailyReward(progress.currentDay);
  const streakMultiplier = getStreakMultiplier(newStreak);

  // Apply streak multiplier to rewards
  const goldAwarded = Math.floor(reward.gold * streakMultiplier);
  const dustAwarded = Math.floor(reward.dust * streakMultiplier);
  const energyAwarded = reward.energy; // Energy doesn't scale with streak

  // Apply multiplier to materials
  const materialsAwarded: Record<string, number> = {};
  for (const [materialId, amount] of Object.entries(reward.materials)) {
    materialsAwarded[materialId] = Math.floor(amount * streakMultiplier);
  }

  // Calculate new current day (cycle back to 1 after day 7)
  const newCurrentDay = progress.currentDay >= DAILY_REWARD_CYCLE_LENGTH ? 1 : progress.currentDay + 1;
  const newTotalDaysClaimed = progress.totalDaysClaimed + 1;

  // Update database in transaction
  const result = await prisma.$transaction(async (tx) => {
    // Update daily login progress
    await tx.dailyLoginProgress.update({
      where: { userId },
      data: {
        currentDay: newCurrentDay,
        streak: newStreak,
        lastClaimAt: now,
        totalDaysClaimed: newTotalDaysClaimed,
      },
    });

    // Get or create inventory
    let inventory = await tx.inventory.findUnique({
      where: { userId },
    });

    if (!inventory) {
      inventory = await tx.inventory.create({
        data: { userId },
      });
    }

    // Merge materials
    const currentMaterials = (inventory.materials as Record<string, number>) ?? {};
    const updatedMaterials = { ...currentMaterials };
    for (const [materialId, amount] of Object.entries(materialsAwarded)) {
      updatedMaterials[materialId] = (updatedMaterials[materialId] ?? 0) + amount;
    }

    // Update inventory
    const updatedInventory = await tx.inventory.update({
      where: { userId },
      data: {
        gold: { increment: goldAwarded },
        dust: { increment: dustAwarded },
        materials: updatedMaterials,
      },
    });

    // Update energy if awarded (assuming UserEnergy model exists)
    if (energyAwarded > 0) {
      await tx.userEnergy.upsert({
        where: { userId },
        create: {
          userId,
          currentEnergy: energyAwarded,
          maxEnergy: 50,
        },
        update: {
          currentEnergy: { increment: energyAwarded },
        },
      });
    }

    return {
      gold: updatedInventory.gold,
      dust: updatedInventory.dust,
      materials: updatedMaterials,
    };
  });

  return {
    success: true,
    goldAwarded,
    dustAwarded,
    energyAwarded,
    materialsAwarded,
    streakMultiplier,
    newStreak,
    newCurrentDay,
    newInventory: result,
  };
}

// ============================================================================
// ADMIN / DEBUG FUNCTIONS
// ============================================================================

/**
 * Reset daily login progress for a user (admin/debug only)
 */
export async function resetDailyLoginProgress(userId: string): Promise<boolean> {
  try {
    await prisma.dailyLoginProgress.upsert({
      where: { userId },
      create: {
        userId,
        currentDay: 1,
        streak: 0,
        lastClaimAt: null,
        totalDaysClaimed: 0,
      },
      update: {
        currentDay: 1,
        streak: 0,
        lastClaimAt: null,
        totalDaysClaimed: 0,
      },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Simulate a missed day (for testing streak reset)
 */
export async function simulateMissedDay(userId: string): Promise<boolean> {
  try {
    const progress = await prisma.dailyLoginProgress.findUnique({
      where: { userId },
    });

    if (!progress?.lastClaimAt) {
      return false;
    }

    // Set lastClaimAt to 2 days ago
    const twoDaysAgo = new Date();
    twoDaysAgo.setUTCDate(twoDaysAgo.getUTCDate() - 2);

    await prisma.dailyLoginProgress.update({
      where: { userId },
      data: { lastClaimAt: twoDaysAgo },
    });

    return true;
  } catch {
    return false;
  }
}
