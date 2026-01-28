/**
 * Stat Points Service
 *
 * Handles free stat points system:
 * - Award points for waves completed (+1 per wave)
 * - Award points for level ups (+4 per level)
 * - Allocate points to fortress or heroes
 * - Reset allocations (refund points)
 *
 * This is SEPARATE from gold-based power upgrades.
 */

import { prisma } from '../lib/prisma.js';
import type {
  StatPointsSummaryResponse,
  AllocateStatPointsResponse,
  ResetStatPointsResponse,
  AwardStatPointsResponse,
  HeroStatAllocation,
  StatPointAllocationInfo,
  AvailableStatAllocationsResponse,
} from '@arcade/protocol';
import {
  STAT_POINTS_ERROR_CODES,
} from '@arcade/protocol';
import {
  STAT_POINTS_PER_WAVE,
  STAT_POINTS_PER_LEVEL_UP,
  FORTRESS_STAT_POINT_BONUSES,
  HERO_STAT_POINT_BONUSES,
  getFortressStatPointConfig,
  getHeroStatPointConfig,
  getStatPointBonusPercent,
  getMaxPointsForStat,
  type StatPointBonusConfig,
} from '@arcade/sim-core';

// ============================================================================
// TYPES
// ============================================================================

interface StatPointsData {
  id: string;
  totalEarned: number;
  totalSpent: number;
  fortressAllocations: Record<string, number>;
  heroAllocations: HeroStatAllocation[];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get or create stat points record for user
 */
export async function getOrCreateStatPoints(userId: string): Promise<StatPointsData> {
  let statPoints = await prisma.statPoints.findUnique({
    where: { userId },
  });

  if (!statPoints) {
    statPoints = await prisma.statPoints.create({
      data: {
        userId,
        totalEarned: 0,
        totalSpent: 0,
        fortressAllocations: {},
        heroAllocations: [],
      },
    });
  }

  return {
    id: statPoints.id,
    totalEarned: statPoints.totalEarned,
    totalSpent: statPoints.totalSpent,
    fortressAllocations: statPoints.fortressAllocations as Record<string, number>,
    heroAllocations: statPoints.heroAllocations as HeroStatAllocation[],
  };
}

/**
 * Calculate available points
 */
function getAvailablePoints(data: StatPointsData): number {
  return data.totalEarned - data.totalSpent;
}

/**
 * Get stat allocation info for UI
 */
function getStatAllocationInfo(
  stat: string,
  currentPoints: number,
  configs: StatPointBonusConfig[]
): StatPointAllocationInfo {
  const config = configs.find(c => c.stat === stat);
  if (!config) {
    return {
      stat,
      currentPoints,
      maxPoints: 0,
      bonusPerPoint: 0,
      currentBonusPercent: 0,
      canAllocate: false,
    };
  }

  return {
    stat,
    currentPoints,
    maxPoints: config.maxPoints,
    bonusPerPoint: config.bonusPerPoint * 100, // Convert to percentage
    currentBonusPercent: getStatPointBonusPercent(stat, currentPoints, configs),
    canAllocate: currentPoints < config.maxPoints,
  };
}

// ============================================================================
// AWARD POINTS
// ============================================================================

/**
 * Award stat points for completed waves
 */
export async function awardWaveStatPoints(
  userId: string,
  wavesCompleted: number
): Promise<AwardStatPointsResponse> {
  if (wavesCompleted <= 0) {
    return {
      pointsAwarded: 0,
      newTotalEarned: 0,
      availablePoints: 0,
    };
  }

  const pointsToAward = wavesCompleted * STAT_POINTS_PER_WAVE;
  const data = await getOrCreateStatPoints(userId);

  const newTotalEarned = data.totalEarned + pointsToAward;

  await prisma.statPoints.update({
    where: { userId },
    data: { totalEarned: newTotalEarned },
  });

  return {
    pointsAwarded: pointsToAward,
    newTotalEarned,
    availablePoints: newTotalEarned - data.totalSpent,
  };
}

/**
 * Award stat points for level ups
 */
export async function awardLevelUpStatPoints(
  userId: string,
  levelsGained: number
): Promise<AwardStatPointsResponse> {
  if (levelsGained <= 0) {
    return {
      pointsAwarded: 0,
      newTotalEarned: 0,
      availablePoints: 0,
    };
  }

  const pointsToAward = levelsGained * STAT_POINTS_PER_LEVEL_UP;
  const data = await getOrCreateStatPoints(userId);

  const newTotalEarned = data.totalEarned + pointsToAward;

  await prisma.statPoints.update({
    where: { userId },
    data: { totalEarned: newTotalEarned },
  });

  return {
    pointsAwarded: pointsToAward,
    newTotalEarned,
    availablePoints: newTotalEarned - data.totalSpent,
  };
}

// ============================================================================
// ALLOCATE POINTS - FORTRESS
// ============================================================================

/**
 * Allocate stat points to fortress
 */
export async function allocateFortressStatPoints(
  userId: string,
  stat: string,
  pointsToAllocate: number
): Promise<AllocateStatPointsResponse> {
  // Validate stat
  const config = getFortressStatPointConfig(stat);
  if (!config) {
    return {
      success: false,
      pointsAllocated: 0,
      newTotalSpent: 0,
      availablePoints: 0,
      newStatTotal: 0,
      bonusPercent: 0,
      error: STAT_POINTS_ERROR_CODES.INVALID_STAT,
    };
  }

  // Get current data
  const data = await getOrCreateStatPoints(userId);
  const availablePoints = getAvailablePoints(data);

  // Check if enough points
  if (pointsToAllocate > availablePoints) {
    return {
      success: false,
      pointsAllocated: 0,
      newTotalSpent: data.totalSpent,
      availablePoints,
      newStatTotal: data.fortressAllocations[stat] || 0,
      bonusPercent: getStatPointBonusPercent(stat, data.fortressAllocations[stat] || 0, FORTRESS_STAT_POINT_BONUSES),
      error: STAT_POINTS_ERROR_CODES.INSUFFICIENT_POINTS,
    };
  }

  // Check max allocation
  const currentAllocation = data.fortressAllocations[stat] || 0;
  const maxPoints = getMaxPointsForStat(stat, FORTRESS_STAT_POINT_BONUSES);
  const pointsUntilMax = maxPoints - currentAllocation;

  if (pointsUntilMax <= 0) {
    return {
      success: false,
      pointsAllocated: 0,
      newTotalSpent: data.totalSpent,
      availablePoints,
      newStatTotal: currentAllocation,
      bonusPercent: getStatPointBonusPercent(stat, currentAllocation, FORTRESS_STAT_POINT_BONUSES),
      error: STAT_POINTS_ERROR_CODES.MAX_ALLOCATION_REACHED,
    };
  }

  // Clamp to max
  const actualPointsToAllocate = Math.min(pointsToAllocate, pointsUntilMax);
  const newStatTotal = currentAllocation + actualPointsToAllocate;
  const newTotalSpent = data.totalSpent + actualPointsToAllocate;

  // Update allocations
  const newFortressAllocations = {
    ...data.fortressAllocations,
    [stat]: newStatTotal,
  };

  await prisma.statPoints.update({
    where: { userId },
    data: {
      totalSpent: newTotalSpent,
      fortressAllocations: newFortressAllocations,
    },
  });

  return {
    success: true,
    pointsAllocated: actualPointsToAllocate,
    newTotalSpent,
    availablePoints: data.totalEarned - newTotalSpent,
    newStatTotal,
    bonusPercent: getStatPointBonusPercent(stat, newStatTotal, FORTRESS_STAT_POINT_BONUSES),
  };
}

// ============================================================================
// ALLOCATE POINTS - HERO
// ============================================================================

/**
 * Allocate stat points to a hero
 */
export async function allocateHeroStatPoints(
  userId: string,
  heroId: string,
  stat: string,
  pointsToAllocate: number
): Promise<AllocateStatPointsResponse> {
  // Validate stat
  const config = getHeroStatPointConfig(stat);
  if (!config) {
    return {
      success: false,
      pointsAllocated: 0,
      newTotalSpent: 0,
      availablePoints: 0,
      newStatTotal: 0,
      bonusPercent: 0,
      error: STAT_POINTS_ERROR_CODES.INVALID_STAT,
    };
  }

  // Get current data
  const data = await getOrCreateStatPoints(userId);
  const availablePoints = getAvailablePoints(data);

  // Check if enough points
  if (pointsToAllocate > availablePoints) {
    // Find existing hero allocation for error response
    const heroData = data.heroAllocations.find(h => h.heroId === heroId);
    const currentAllocation = heroData?.allocations[stat] || 0;

    return {
      success: false,
      pointsAllocated: 0,
      newTotalSpent: data.totalSpent,
      availablePoints,
      newStatTotal: currentAllocation,
      bonusPercent: getStatPointBonusPercent(stat, currentAllocation, HERO_STAT_POINT_BONUSES),
      error: STAT_POINTS_ERROR_CODES.INSUFFICIENT_POINTS,
    };
  }

  // Find or create hero allocation
  const heroAllocations = [...data.heroAllocations];
  let heroData = heroAllocations.find(h => h.heroId === heroId);

  if (!heroData) {
    heroData = { heroId, allocations: {} };
    heroAllocations.push(heroData);
  }

  const currentAllocation = heroData.allocations[stat] || 0;
  const maxPoints = getMaxPointsForStat(stat, HERO_STAT_POINT_BONUSES);
  const pointsUntilMax = maxPoints - currentAllocation;

  if (pointsUntilMax <= 0) {
    return {
      success: false,
      pointsAllocated: 0,
      newTotalSpent: data.totalSpent,
      availablePoints,
      newStatTotal: currentAllocation,
      bonusPercent: getStatPointBonusPercent(stat, currentAllocation, HERO_STAT_POINT_BONUSES),
      error: STAT_POINTS_ERROR_CODES.MAX_ALLOCATION_REACHED,
    };
  }

  // Clamp to max
  const actualPointsToAllocate = Math.min(pointsToAllocate, pointsUntilMax);
  const newStatTotal = currentAllocation + actualPointsToAllocate;
  const newTotalSpent = data.totalSpent + actualPointsToAllocate;

  // Update hero allocation
  heroData.allocations[stat] = newStatTotal;

  await prisma.statPoints.update({
    where: { userId },
    data: {
      totalSpent: newTotalSpent,
      heroAllocations: heroAllocations,
    },
  });

  return {
    success: true,
    pointsAllocated: actualPointsToAllocate,
    newTotalSpent,
    availablePoints: data.totalEarned - newTotalSpent,
    newStatTotal,
    bonusPercent: getStatPointBonusPercent(stat, newStatTotal, HERO_STAT_POINT_BONUSES),
  };
}

// ============================================================================
// RESET ALLOCATIONS
// ============================================================================

/**
 * Reset fortress allocations (refund all points)
 */
export async function resetFortressAllocations(userId: string): Promise<ResetStatPointsResponse> {
  const data = await getOrCreateStatPoints(userId);

  // Calculate points to refund
  let pointsToRefund = 0;
  for (const stat of Object.keys(data.fortressAllocations)) {
    pointsToRefund += data.fortressAllocations[stat] || 0;
  }

  if (pointsToRefund === 0) {
    return {
      success: false,
      pointsRefunded: 0,
      newTotalSpent: data.totalSpent,
      availablePoints: getAvailablePoints(data),
      error: STAT_POINTS_ERROR_CODES.NOTHING_TO_RESET,
    };
  }

  const newTotalSpent = data.totalSpent - pointsToRefund;

  await prisma.statPoints.update({
    where: { userId },
    data: {
      totalSpent: newTotalSpent,
      fortressAllocations: {},
    },
  });

  return {
    success: true,
    pointsRefunded: pointsToRefund,
    newTotalSpent,
    availablePoints: data.totalEarned - newTotalSpent,
  };
}

/**
 * Reset hero allocations (specific hero or all heroes)
 */
export async function resetHeroAllocations(
  userId: string,
  heroId?: string
): Promise<ResetStatPointsResponse> {
  const data = await getOrCreateStatPoints(userId);

  let pointsToRefund = 0;
  let newHeroAllocations: HeroStatAllocation[];

  if (heroId) {
    // Reset specific hero
    const heroData = data.heroAllocations.find(h => h.heroId === heroId);
    if (!heroData) {
      return {
        success: false,
        pointsRefunded: 0,
        newTotalSpent: data.totalSpent,
        availablePoints: getAvailablePoints(data),
        error: STAT_POINTS_ERROR_CODES.HERO_NOT_FOUND,
      };
    }

    for (const stat of Object.keys(heroData.allocations)) {
      pointsToRefund += heroData.allocations[stat] || 0;
    }

    if (pointsToRefund === 0) {
      return {
        success: false,
        pointsRefunded: 0,
        newTotalSpent: data.totalSpent,
        availablePoints: getAvailablePoints(data),
        error: STAT_POINTS_ERROR_CODES.NOTHING_TO_RESET,
      };
    }

    // Remove this hero's allocations
    newHeroAllocations = data.heroAllocations.filter(h => h.heroId !== heroId);
  } else {
    // Reset all heroes
    for (const heroData of data.heroAllocations) {
      for (const stat of Object.keys(heroData.allocations)) {
        pointsToRefund += heroData.allocations[stat] || 0;
      }
    }

    if (pointsToRefund === 0) {
      return {
        success: false,
        pointsRefunded: 0,
        newTotalSpent: data.totalSpent,
        availablePoints: getAvailablePoints(data),
        error: STAT_POINTS_ERROR_CODES.NOTHING_TO_RESET,
      };
    }

    newHeroAllocations = [];
  }

  const newTotalSpent = data.totalSpent - pointsToRefund;

  await prisma.statPoints.update({
    where: { userId },
    data: {
      totalSpent: newTotalSpent,
      heroAllocations: newHeroAllocations,
    },
  });

  return {
    success: true,
    pointsRefunded: pointsToRefund,
    newTotalSpent,
    availablePoints: data.totalEarned - newTotalSpent,
  };
}

// ============================================================================
// GET SUMMARY
// ============================================================================

/**
 * Get stat points summary for UI
 */
export async function getStatPointsSummary(userId: string): Promise<StatPointsSummaryResponse> {
  const data = await getOrCreateStatPoints(userId);

  return {
    totalEarned: data.totalEarned,
    totalSpent: data.totalSpent,
    availablePoints: getAvailablePoints(data),
    fortressAllocations: data.fortressAllocations,
    heroAllocations: data.heroAllocations,
  };
}

/**
 * Get available stat allocations for UI (shows all stats with current/max)
 */
export async function getAvailableStatAllocations(
  userId: string,
  heroIds: string[]
): Promise<AvailableStatAllocationsResponse> {
  const data = await getOrCreateStatPoints(userId);

  // Build fortress stats info
  const fortressStats: StatPointAllocationInfo[] = FORTRESS_STAT_POINT_BONUSES.map(config => {
    const currentPoints = data.fortressAllocations[config.stat] || 0;
    return getStatAllocationInfo(config.stat, currentPoints, FORTRESS_STAT_POINT_BONUSES);
  });

  // Build hero stats info
  const heroStats: Record<string, StatPointAllocationInfo[]> = {};

  for (const heroId of heroIds) {
    const heroData = data.heroAllocations.find(h => h.heroId === heroId);
    const heroAllocations = heroData?.allocations || {};

    heroStats[heroId] = HERO_STAT_POINT_BONUSES.map(config => {
      const currentPoints = heroAllocations[config.stat] || 0;
      return getStatAllocationInfo(config.stat, currentPoints, HERO_STAT_POINT_BONUSES);
    });
  }

  return {
    availablePoints: getAvailablePoints(data),
    fortressStats,
    heroStats,
  };
}

// ============================================================================
// GET RAW DATA (for simulation)
// ============================================================================

/**
 * Get raw stat point data for use in simulation
 */
export async function getStatPointDataForSimulation(userId: string): Promise<{
  fortressAllocations: Record<string, number>;
  heroAllocations: HeroStatAllocation[];
}> {
  const data = await getOrCreateStatPoints(userId);

  return {
    fortressAllocations: data.fortressAllocations,
    heroAllocations: data.heroAllocations,
  };
}
