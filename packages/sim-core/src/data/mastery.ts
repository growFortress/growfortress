/**
 * Class Mastery Tree System
 *
 * Permanent meta-progression where players invest Mastery Points
 * into class-specific skill trees to unlock permanent bonuses.
 */

import type { FortressClass, ModifierSet } from '../types.js';

// ============================================================================
// MASTERY NODE TYPES
// ============================================================================

export type MasteryNodeType =
  | 'stat_bonus' // Direct stat increase
  | 'synergy_amplifier' // Boosts existing synergy bonuses
  | 'class_perk' // Unique class ability/mechanic
  | 'capstone'; // Tier-ending powerful node

export type MasteryNodeId = string;

export interface MasterySynergyAmplifier {
  /** Multiplier to hero-fortress synergy bonuses (0.1 = +10%) */
  heroSynergyBonus?: number;
  /** Multiplier to turret-fortress synergy bonuses */
  turretSynergyBonus?: number;
  /** Multiplier to full synergy bonus (2+ heroes, 3+ turrets) */
  fullSynergyBonus?: number;
}

export interface MasteryClassPerk {
  id: string;
  description: string;
}

export interface MasteryNodeEffect {
  /** Direct stat bonuses (additive with other bonuses) */
  modifiers?: Partial<ModifierSet>;
  /** Synergy amplification (multiplier to synergy bonuses) */
  synergyAmplifier?: MasterySynergyAmplifier;
  /** Class-specific perks */
  classPerk?: MasteryClassPerk;
}

export interface MasteryNodeDefinition {
  id: MasteryNodeId;
  name: string;
  description: string;
  class: FortressClass;
  tier: 1 | 2 | 3 | 4 | 5;
  type: MasteryNodeType;

  /** Cost to unlock (Mastery Points) */
  cost: number;

  /** Prerequisites (node IDs that must be unlocked first) */
  requires: MasteryNodeId[];

  /** Position in tree for UI rendering (grid coordinates) */
  position: { x: number; y: number };

  /** Effects when unlocked */
  effects: MasteryNodeEffect;

  /** Icon identifier for UI */
  icon: string;
}

export interface MasteryTreeDefinition {
  class: FortressClass;
  name: string;
  description: string;
  nodes: MasteryNodeDefinition[];

  /** Total number of nodes in tree */
  totalNodes: number;
  /** Sum of all node costs */
  maxPointsToComplete: number;
}

// ============================================================================
// PLAYER MASTERY STATE
// ============================================================================

export interface ClassMasteryProgress {
  pointsSpent: number;
  unlockedNodes: MasteryNodeId[];
}

export interface PlayerMasteryProgress {
  /** Points available to spend */
  availablePoints: number;
  /** Total points ever earned */
  totalPointsEarned: number;

  /** Per-class progress */
  classProgress: {
    [K in FortressClass]: ClassMasteryProgress;
  };

  /** Last updated timestamp */
  updatedAt: string;
}

export function createDefaultMasteryProgress(): PlayerMasteryProgress {
  return {
    availablePoints: 0,
    totalPointsEarned: 0,
    classProgress: {
      natural: { pointsSpent: 0, unlockedNodes: [] },
      ice: { pointsSpent: 0, unlockedNodes: [] },
      fire: { pointsSpent: 0, unlockedNodes: [] },
      lightning: { pointsSpent: 0, unlockedNodes: [] },
      tech: { pointsSpent: 0, unlockedNodes: [] },
      void: { pointsSpent: 0, unlockedNodes: [] },
      plasma: { pointsSpent: 0, unlockedNodes: [] },
    },
    updatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// MASTERY POINT SOURCES
// ============================================================================

export type MasteryPointCondition =
  | 'wave_milestone'
  | 'boss_kill'
  | 'class_usage'
  | 'achievement'
  | 'weekly_challenge'
  | 'guild_activity';

export interface MasteryPointSource {
  id: string;
  name: string;
  description: string;
  pointsAwarded: number;
  condition: MasteryPointCondition;
  /** For wave_milestone, the wave number; for class_usage, waves needed */
  threshold?: number;
}

export const MASTERY_POINT_SOURCES: MasteryPointSource[] = [
  // Wave milestones (once per session)
  {
    id: 'wave_10',
    name: 'Fala 10',
    description: 'Ukończ falę 10',
    pointsAwarded: 1,
    condition: 'wave_milestone',
    threshold: 10,
  },
  {
    id: 'wave_25',
    name: 'Fala 25',
    description: 'Ukończ falę 25',
    pointsAwarded: 2,
    condition: 'wave_milestone',
    threshold: 25,
  },
  {
    id: 'wave_50',
    name: 'Fala 50',
    description: 'Ukończ falę 50',
    pointsAwarded: 3,
    condition: 'wave_milestone',
    threshold: 50,
  },
  {
    id: 'wave_100',
    name: 'Fala 100',
    description: 'Ukończ falę 100',
    pointsAwarded: 5,
    condition: 'wave_milestone',
    threshold: 100,
  },

  // Boss kills
  {
    id: 'boss_kill',
    name: 'Pogromca Bossów',
    description: 'Zabij dowolnego bossa',
    pointsAwarded: 1,
    condition: 'boss_kill',
  },
  {
    id: 'pillar_boss',
    name: 'Boss Filaru',
    description: 'Zabij bossa filaru',
    pointsAwarded: 2,
    condition: 'boss_kill',
  },

  // Class usage (once per session per class)
  {
    id: 'class_affinity',
    name: 'Powinowactwo Klasy',
    description: 'Ukończ 10 fal z wybraną klasą',
    pointsAwarded: 1,
    condition: 'class_usage',
    threshold: 10,
  },

  // Weekly challenges
  {
    id: 'weekly_challenge',
    name: 'Wyzwanie Tygodniowe',
    description: 'Ukończ wyzwanie tygodniowe',
    pointsAwarded: 3,
    condition: 'weekly_challenge',
  },

  // Guild activities
  {
    id: 'guild_boss',
    name: 'Boss Gildii',
    description: 'Uczestnictwo w bossie gildii',
    pointsAwarded: 2,
    condition: 'guild_activity',
  },
];

// ============================================================================
// POINT ECONOMY CONSTANTS
// ============================================================================

export const MASTERY_ECONOMY = {
  /** Estimated maximum earnable points (soft cap via diminishing returns) */
  ESTIMATED_MAX_POINTS: 150,

  /** Points needed to fully complete one tree */
  POINTS_PER_TREE_FULL: 100,

  /** Tier point thresholds (cumulative points in tree to unlock tier) */
  TIER_THRESHOLDS: {
    tier2: 5,
    tier3: 15,
    tier4: 35,
    tier5: 60,
  } as const,

  /** Node costs by tier */
  NODE_COSTS: {
    tier1: 1,
    tier2: 2,
    tier3: 4,
    tier4: 6,
    tier5: 10,
  } as const,

  /** Respec penalty (fraction of points lost) */
  RESPEC_PENALTY: 0.5,

  /** Minimum points returned on respec */
  MIN_RESPEC_RETURN: 1,
} as const;

// ============================================================================
// MASTERY MODIFIERS (calculated from unlocked nodes)
// ============================================================================

export interface MasteryModifiers {
  /** Direct stat bonuses from all unlocked nodes */
  statBonuses: Partial<ModifierSet>;
  /** Synergy amplifiers from all unlocked nodes */
  synergyAmplifiers: MasterySynergyAmplifier;
  /** Active perk IDs for special handling in simulation */
  activePerks: string[];
}

export function createEmptyMasteryModifiers(): MasteryModifiers {
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

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate Mastery Points required to reach a specific tier
 */
export function getPointsRequiredForTier(tier: 1 | 2 | 3 | 4 | 5): number {
  if (tier === 1) return 0;
  return MASTERY_ECONOMY.TIER_THRESHOLDS[`tier${tier}` as keyof typeof MASTERY_ECONOMY.TIER_THRESHOLDS];
}

/**
 * Check if a tier is unlocked based on points spent in tree
 */
export function isTierUnlocked(pointsSpent: number, tier: 1 | 2 | 3 | 4 | 5): boolean {
  return pointsSpent >= getPointsRequiredForTier(tier);
}

/**
 * Check if a node can be unlocked
 */
export function canUnlockNode(
  node: MasteryNodeDefinition,
  progress: ClassMasteryProgress,
  availablePoints: number
): { canUnlock: boolean; reason?: string } {
  // Already unlocked
  if (progress.unlockedNodes.includes(node.id)) {
    return { canUnlock: false, reason: 'Już odblokowane' };
  }

  // Not enough points
  if (availablePoints < node.cost) {
    return { canUnlock: false, reason: `Potrzebujesz ${node.cost} MP` };
  }

  // Tier not unlocked
  if (!isTierUnlocked(progress.pointsSpent, node.tier)) {
    const required = getPointsRequiredForTier(node.tier);
    return {
      canUnlock: false,
      reason: `Wydaj ${required} MP w tym drzewku aby odblokować Tier ${node.tier}`,
    };
  }

  // Prerequisites not met
  for (const reqId of node.requires) {
    if (!progress.unlockedNodes.includes(reqId)) {
      return { canUnlock: false, reason: 'Wymagane wcześniejsze ulepszenia' };
    }
  }

  return { canUnlock: true };
}

/**
 * Calculate points returned on respec (with penalty)
 */
export function calculateRespecReturn(pointsSpent: number): number {
  const returned = Math.floor(pointsSpent * (1 - MASTERY_ECONOMY.RESPEC_PENALTY));
  return Math.max(returned, Math.min(pointsSpent, MASTERY_ECONOMY.MIN_RESPEC_RETURN));
}
