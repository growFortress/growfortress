/**
 * Mastery System
 *
 * Calculates mastery bonuses from unlocked nodes for a player
 */

import type { FortressClass, ModifierSet } from '../types.js';
import type {
  MasteryModifiers,
  MasterySynergyAmplifier,
  PlayerMasteryProgress,
} from '../data/mastery.js';
import { createEmptyMasteryModifiers } from '../data/mastery.js';
import { getMasteryTree, getMasteryNodeById } from '../data/mastery-trees/index.js';

/**
 * Calculate combined mastery modifiers for a player using a specific class
 *
 * Only bonuses from the ACTIVE class tree are applied.
 * This encourages specialization in a specific class.
 */
export function calculateMasteryModifiers(
  progress: PlayerMasteryProgress,
  activeClass: FortressClass
): MasteryModifiers {
  const result = createEmptyMasteryModifiers();
  const classProgress = progress.classProgress[activeClass];

  if (!classProgress || classProgress.unlockedNodes.length === 0) {
    return result;
  }

  const tree = getMasteryTree(activeClass);

  // Process each unlocked node
  for (const nodeId of classProgress.unlockedNodes) {
    const node = tree.nodes.find((n) => n.id === nodeId);
    if (!node) continue;

    // Apply stat bonuses
    if (node.effects.modifiers) {
      for (const [key, value] of Object.entries(node.effects.modifiers)) {
        if (value !== undefined) {
          const modKey = key as keyof ModifierSet;
          result.statBonuses[modKey] = ((result.statBonuses[modKey] as number) ?? 0) + value;
        }
      }
    }

    // Apply synergy amplifiers
    if (node.effects.synergyAmplifier) {
      const amp = node.effects.synergyAmplifier;
      if (amp.heroSynergyBonus) {
        result.synergyAmplifiers.heroSynergyBonus =
          (result.synergyAmplifiers.heroSynergyBonus ?? 0) + amp.heroSynergyBonus;
      }
      if (amp.turretSynergyBonus) {
        result.synergyAmplifiers.turretSynergyBonus =
          (result.synergyAmplifiers.turretSynergyBonus ?? 0) + amp.turretSynergyBonus;
      }
      if (amp.fullSynergyBonus) {
        result.synergyAmplifiers.fullSynergyBonus =
          (result.synergyAmplifiers.fullSynergyBonus ?? 0) + amp.fullSynergyBonus;
      }
    }

    // Track active perks
    if (node.effects.classPerk) {
      result.activePerks.push(node.effects.classPerk.id);
    }
  }

  return result;
}

/**
 * Calculate mastery modifiers for ALL classes (for display purposes)
 * Returns a map of class -> modifiers
 */
export function calculateAllClassMasteryModifiers(
  progress: PlayerMasteryProgress
): Record<FortressClass, MasteryModifiers> {
  const result: Partial<Record<FortressClass, MasteryModifiers>> = {};

  for (const classId of Object.keys(progress.classProgress) as FortressClass[]) {
    result[classId] = calculateMasteryModifiers(progress, classId);
  }

  return result as Record<FortressClass, MasteryModifiers>;
}

/**
 * Get the total points spent across all classes
 */
export function getTotalPointsSpent(progress: PlayerMasteryProgress): number {
  let total = 0;
  for (const classProgress of Object.values(progress.classProgress)) {
    total += classProgress.pointsSpent;
  }
  return total;
}

/**
 * Get progress summary for a specific class
 */
export interface ClassProgressSummary {
  class: FortressClass;
  pointsSpent: number;
  nodesUnlocked: number;
  totalNodes: number;
  percentComplete: number;
  highestTierUnlocked: 1 | 2 | 3 | 4 | 5;
  hasCapstone: boolean;
}

export function getClassProgressSummary(
  progress: PlayerMasteryProgress,
  classId: FortressClass
): ClassProgressSummary {
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
}

/**
 * Get all class progress summaries
 */
export function getAllClassProgressSummaries(
  progress: PlayerMasteryProgress
): ClassProgressSummary[] {
  return (Object.keys(progress.classProgress) as FortressClass[]).map((classId) =>
    getClassProgressSummary(progress, classId)
  );
}

/**
 * Validate that a node can be unlocked
 */
export interface UnlockValidation {
  canUnlock: boolean;
  reason?: string;
}

export function validateNodeUnlock(
  progress: PlayerMasteryProgress,
  nodeId: string
): UnlockValidation {
  const node = getMasteryNodeById(nodeId);
  if (!node) {
    return { canUnlock: false, reason: 'Węzeł nie istnieje' };
  }

  const classProgress = progress.classProgress[node.class];

  // Already unlocked
  if (classProgress.unlockedNodes.includes(nodeId)) {
    return { canUnlock: false, reason: 'Już odblokowane' };
  }

  // Not enough points
  if (progress.availablePoints < node.cost) {
    return { canUnlock: false, reason: `Potrzebujesz ${node.cost} MP (masz ${progress.availablePoints})` };
  }

  // Check tier requirements using imported constant
  const TIER_THRESHOLDS = { tier2: 5, tier3: 15, tier4: 35, tier5: 60 };
  const tierKey = `tier${node.tier}` as keyof typeof TIER_THRESHOLDS;
  const requiredPoints = node.tier === 1 ? 0 : TIER_THRESHOLDS[tierKey];

  if (classProgress.pointsSpent < requiredPoints) {
    return {
      canUnlock: false,
      reason: `Wydaj ${requiredPoints} MP w tym drzewku dla Tier ${node.tier}`,
    };
  }

  // Check prerequisites
  for (const reqId of node.requires) {
    if (!classProgress.unlockedNodes.includes(reqId)) {
      const reqNode = getMasteryNodeById(reqId);
      return {
        canUnlock: false,
        reason: `Wymaga: ${reqNode?.name ?? reqId}`,
      };
    }
  }

  return { canUnlock: true };
}

/**
 * Synchronous version of validateNodeUnlock (for use in simulation)
 */
export function validateNodeUnlockSync(
  progress: PlayerMasteryProgress,
  nodeId: string,
  tierThresholds: { tier2: number; tier3: number; tier4: number; tier5: number }
): UnlockValidation {
  const node = getMasteryNodeById(nodeId);
  if (!node) {
    return { canUnlock: false, reason: 'Węzeł nie istnieje' };
  }

  const classProgress = progress.classProgress[node.class];

  // Already unlocked
  if (classProgress.unlockedNodes.includes(nodeId)) {
    return { canUnlock: false, reason: 'Już odblokowane' };
  }

  // Not enough points
  if (progress.availablePoints < node.cost) {
    return { canUnlock: false, reason: `Potrzebujesz ${node.cost} MP (masz ${progress.availablePoints})` };
  }

  // Check tier requirements
  const tierKey = `tier${node.tier}` as keyof typeof tierThresholds;
  const requiredPoints = node.tier === 1 ? 0 : tierThresholds[tierKey];

  if (classProgress.pointsSpent < requiredPoints) {
    return {
      canUnlock: false,
      reason: `Wydaj ${requiredPoints} MP w tym drzewku dla Tier ${node.tier}`,
    };
  }

  // Check prerequisites
  for (const reqId of node.requires) {
    if (!classProgress.unlockedNodes.includes(reqId)) {
      const reqNode = getMasteryNodeById(reqId);
      return {
        canUnlock: false,
        reason: `Wymaga: ${reqNode?.name ?? reqId}`,
      };
    }
  }

  return { canUnlock: true };
}

/**
 * Check if a specific perk is active
 */
export function hasMasteryPerk(modifiers: MasteryModifiers, perkId: string): boolean {
  return modifiers.activePerks.includes(perkId);
}

/**
 * Get synergy amplifier multiplier (1 + bonus)
 */
export function getSynergyMultiplier(
  amplifiers: MasterySynergyAmplifier,
  type: 'hero' | 'turret' | 'full'
): number {
  switch (type) {
    case 'hero':
      return 1 + (amplifiers.heroSynergyBonus ?? 0);
    case 'turret':
      return 1 + (amplifiers.turretSynergyBonus ?? 0);
    case 'full':
      return 1 + (amplifiers.fullSynergyBonus ?? 0);
  }
}
