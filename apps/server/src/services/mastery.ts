/**
 * Mastery System Service
 *
 * Handles mastery progress, node unlocking, and point awarding
 */

import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import {
  createDefaultMasteryProgress,
  getMasteryNodeById,
  getMasteryTree,
  MASTERY_ECONOMY,
  type PlayerMasteryProgress,
  type FortressClass,
} from '@arcade/sim-core';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert classProgress to Prisma-compatible JSON
 * This is needed because TypeScript's strict type checking
 * doesn't recognize our typed objects as valid Prisma.InputJsonValue
 */
function classProgressToJson(
  classProgress: PlayerMasteryProgress['classProgress']
): Prisma.InputJsonValue {
  // Deep clone to plain object to satisfy Prisma's JSON type
  return JSON.parse(JSON.stringify(classProgress)) as Prisma.InputJsonValue;
}

/**
 * Convert DB format to PlayerMasteryProgress
 */
function dbToProgress(
  dbProgress: {
    availablePoints: number;
    totalEarned: number;
    classProgress: unknown;
    updatedAt: Date;
  } | null
): PlayerMasteryProgress {
  if (!dbProgress) {
    return createDefaultMasteryProgress();
  }

  const classProgress = dbProgress.classProgress as Record<
    string,
    { pointsSpent: number; unlockedNodes: string[] }
  >;

  // Ensure all classes exist in progress
  const defaultProgress = createDefaultMasteryProgress();
  for (const classId of Object.keys(defaultProgress.classProgress)) {
    if (!classProgress[classId]) {
      classProgress[classId] = { pointsSpent: 0, unlockedNodes: [] };
    }
  }

  return {
    availablePoints: dbProgress.availablePoints,
    totalPointsEarned: dbProgress.totalEarned,
    classProgress: classProgress as PlayerMasteryProgress['classProgress'],
    updatedAt: dbProgress.updatedAt.toISOString(),
  };
}

// ============================================================================
// MASTERY PROGRESS OPERATIONS
// ============================================================================

/**
 * Get player's mastery progress, creating default if not exists
 */
export async function getMasteryProgress(userId: string): Promise<PlayerMasteryProgress> {
  const existing = await prisma.masteryProgress.findUnique({
    where: { userId },
  });

  if (existing) {
    return dbToProgress(existing);
  }

  // Create default progress
  const defaultProgress = createDefaultMasteryProgress();
  const created = await prisma.masteryProgress.create({
    data: {
      userId,
      availablePoints: defaultProgress.availablePoints,
      totalEarned: defaultProgress.totalPointsEarned,
      classProgress: classProgressToJson(defaultProgress.classProgress),
    },
  });

  return dbToProgress(created);
}

/**
 * Unlock a mastery node
 */
export async function unlockMasteryNode(
  userId: string,
  nodeId: string
): Promise<{
  success: boolean;
  progress: PlayerMasteryProgress;
  message?: string;
}> {
  // Get current progress
  const progress = await getMasteryProgress(userId);

  // Validate node exists
  const node = getMasteryNodeById(nodeId);
  if (!node) {
    return {
      success: false,
      progress,
      message: 'Węzeł nie istnieje',
    };
  }

  const classProgress = progress.classProgress[node.class];

  // Check if already unlocked
  if (classProgress.unlockedNodes.includes(nodeId)) {
    return {
      success: false,
      progress,
      message: 'Już odblokowane',
    };
  }

  // Check available points
  if (progress.availablePoints < node.cost) {
    return {
      success: false,
      progress,
      message: `Potrzebujesz ${node.cost} MP (masz ${progress.availablePoints})`,
    };
  }

  // Check tier requirements
  const tierThresholds = MASTERY_ECONOMY.TIER_THRESHOLDS;
  const tierKey = `tier${node.tier}` as keyof typeof tierThresholds;
  const requiredPoints = node.tier === 1 ? 0 : tierThresholds[tierKey];

  if (classProgress.pointsSpent < requiredPoints) {
    return {
      success: false,
      progress,
      message: `Wydaj ${requiredPoints} MP w tym drzewku dla Tier ${node.tier}`,
    };
  }

  // Check prerequisites
  for (const reqId of node.requires) {
    if (!classProgress.unlockedNodes.includes(reqId)) {
      const reqNode = getMasteryNodeById(reqId);
      return {
        success: false,
        progress,
        message: `Wymaga: ${reqNode?.name ?? reqId}`,
      };
    }
  }

  // Unlock the node
  const newClassProgress = {
    ...progress.classProgress,
    [node.class]: {
      pointsSpent: classProgress.pointsSpent + node.cost,
      unlockedNodes: [...classProgress.unlockedNodes, nodeId],
    },
  };

  const updated = await prisma.masteryProgress.update({
    where: { userId },
    data: {
      availablePoints: progress.availablePoints - node.cost,
      classProgress: classProgressToJson(newClassProgress),
      version: { increment: 1 },
    },
  });

  return {
    success: true,
    progress: dbToProgress(updated),
  };
}

/**
 * Respec (reset) a class mastery tree
 */
export async function respecMasteryTree(
  userId: string,
  classId: FortressClass
): Promise<{
  success: boolean;
  progress: PlayerMasteryProgress;
  pointsReturned: number;
  pointsLost: number;
  message?: string;
}> {
  // Get current progress
  const progress = await getMasteryProgress(userId);
  const classProgress = progress.classProgress[classId];

  if (classProgress.pointsSpent === 0) {
    return {
      success: false,
      progress,
      pointsReturned: 0,
      pointsLost: 0,
      message: 'Brak punktów do zwrócenia',
    };
  }

  // Calculate points returned (with penalty)
  const pointsSpent = classProgress.pointsSpent;
  const pointsReturned = Math.floor(pointsSpent * (1 - MASTERY_ECONOMY.RESPEC_PENALTY));
  const pointsLost = pointsSpent - pointsReturned;

  // Reset class progress
  const newClassProgress = {
    ...progress.classProgress,
    [classId]: {
      pointsSpent: 0,
      unlockedNodes: [],
    },
  };

  const updated = await prisma.masteryProgress.update({
    where: { userId },
    data: {
      availablePoints: progress.availablePoints + pointsReturned,
      classProgress: classProgressToJson(newClassProgress),
      version: { increment: 1 },
    },
  });

  return {
    success: true,
    progress: dbToProgress(updated),
    pointsReturned,
    pointsLost,
  };
}

/**
 * Award mastery points to a player
 */
export async function awardMasteryPoints(
  userId: string,
  _source: string, // Reserved for future logging/auditing
  amount: number
): Promise<{
  success: boolean;
  newAvailablePoints: number;
  newTotalEarned: number;
}> {
  if (amount <= 0) {
    const progress = await getMasteryProgress(userId);
    return {
      success: false,
      newAvailablePoints: progress.availablePoints,
      newTotalEarned: progress.totalPointsEarned,
    };
  }

  // Ensure progress record exists
  await getMasteryProgress(userId);

  const updated = await prisma.masteryProgress.update({
    where: { userId },
    data: {
      availablePoints: { increment: amount },
      totalEarned: { increment: amount },
      version: { increment: 1 },
    },
  });

  return {
    success: true,
    newAvailablePoints: updated.availablePoints,
    newTotalEarned: updated.totalEarned,
  };
}

/**
 * Get class progress summaries for UI display
 */
export async function getClassProgressSummaries(
  userId: string
): Promise<{
  summaries: Array<{
    class: FortressClass;
    pointsSpent: number;
    nodesUnlocked: number;
    totalNodes: number;
    percentComplete: number;
    highestTierUnlocked: 1 | 2 | 3 | 4 | 5;
    hasCapstone: boolean;
  }>;
  totalPointsSpent: number;
  availablePoints: number;
}> {
  const progress = await getMasteryProgress(userId);

  const summaries = (Object.keys(progress.classProgress) as FortressClass[]).map((classId) => {
    const classProgress = progress.classProgress[classId];
    const tree = getMasteryTree(classId);

    let highestTier: 1 | 2 | 3 | 4 | 5 = 1;
    let hasCapstone = false;

    for (const nodeId of classProgress.unlockedNodes) {
      const node = tree.nodes.find((n) => n.id === nodeId);
      if (node) {
        if (node.tier > highestTier) {
          highestTier = node.tier as 1 | 2 | 3 | 4 | 5;
        }
        if (node.type === 'capstone') {
          hasCapstone = true;
        }
      }
    }

    return {
      class: classId,
      pointsSpent: classProgress.pointsSpent,
      nodesUnlocked: classProgress.unlockedNodes.length,
      totalNodes: tree.totalNodes,
      percentComplete: Math.round((classProgress.unlockedNodes.length / tree.totalNodes) * 100),
      highestTierUnlocked: highestTier,
      hasCapstone,
    };
  });

  const totalPointsSpent = summaries.reduce((sum, s) => sum + s.pointsSpent, 0);

  return {
    summaries,
    totalPointsSpent,
    availablePoints: progress.availablePoints,
  };
}

/**
 * Calculate mastery modifiers for a player using a specific class
 * This is used when starting a session to apply mastery bonuses
 */
export async function getSessionMasteryModifiers(
  userId: string,
  activeClass: FortressClass
): Promise<{
  statBonuses: Record<string, number>;
  synergyAmplifiers: {
    heroSynergyBonus: number;
    turretSynergyBonus: number;
    fullSynergyBonus: number;
  };
  activePerks: string[];
}> {
  const progress = await getMasteryProgress(userId);
  const classProgress = progress.classProgress[activeClass];

  if (!classProgress || classProgress.unlockedNodes.length === 0) {
    return {
      statBonuses: {},
      synergyAmplifiers: {
        heroSynergyBonus: 0,
        turretSynergyBonus: 0,
        fullSynergyBonus: 0,
      },
      activePerks: [],
    };
  }

  const tree = getMasteryTree(activeClass);
  const result = {
    statBonuses: {} as Record<string, number>,
    synergyAmplifiers: {
      heroSynergyBonus: 0,
      turretSynergyBonus: 0,
      fullSynergyBonus: 0,
    },
    activePerks: [] as string[],
  };

  // Process each unlocked node
  for (const nodeId of classProgress.unlockedNodes) {
    const node = tree.nodes.find((n) => n.id === nodeId);
    if (!node) continue;

    // Apply stat bonuses
    if (node.effects.modifiers) {
      for (const [key, value] of Object.entries(node.effects.modifiers)) {
        if (value !== undefined) {
          result.statBonuses[key] = (result.statBonuses[key] ?? 0) + value;
        }
      }
    }

    // Apply synergy amplifiers
    if (node.effects.synergyAmplifier) {
      const amp = node.effects.synergyAmplifier;
      if (amp.heroSynergyBonus) {
        result.synergyAmplifiers.heroSynergyBonus += amp.heroSynergyBonus;
      }
      if (amp.turretSynergyBonus) {
        result.synergyAmplifiers.turretSynergyBonus += amp.turretSynergyBonus;
      }
      if (amp.fullSynergyBonus) {
        result.synergyAmplifiers.fullSynergyBonus += amp.fullSynergyBonus;
      }
    }

    // Track active perks
    if (node.effects.classPerk) {
      result.activePerks.push(node.effects.classPerk.id);
    }
  }

  return result;
}
