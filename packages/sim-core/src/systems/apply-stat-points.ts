/**
 * Apply Stat Points System
 *
 * Applies free stat point allocations to game modifiers during simulation.
 * These bonuses stack additively with other modifiers (power upgrades, relics, class, etc.)
 *
 * Key differences from power upgrades:
 * - Stat points are FREE (no gold cost)
 * - Earned through gameplay (+1/wave, +4/level up)
 * - Can be reset and reallocated anytime
 */

import type { ModifierSet } from '../types.js';
import {
  FORTRESS_STAT_POINT_BONUSES,
  HERO_STAT_POINT_BONUSES,
  getStatPointBonus,
} from '../data/stat-points-config.js';

// ============================================================================
// STAT POINT DATA TYPES
// ============================================================================

/**
 * Player's stat point allocation data (passed to simulation)
 */
export interface StatPointAllocationData {
  /** Fortress allocations: { hp: 5, damage: 10, armor: 3 } */
  fortressAllocations: Record<string, number>;
  /** Hero allocations: [{ heroId: 'storm', allocations: { damage: 10 }}] */
  heroAllocations: Array<{
    heroId: string;
    allocations: Record<string, number>;
  }>;
}

// ============================================================================
// FORTRESS STAT POINTS
// ============================================================================

/**
 * Apply fortress stat point bonuses to base modifiers
 * Returns a new ModifierSet with stat point bonuses applied (additive system)
 */
export function applyFortressStatPointBonuses(
  baseModifiers: ModifierSet,
  allocations: Record<string, number>
): ModifierSet {
  const mods = { ...baseModifiers };

  for (const config of FORTRESS_STAT_POINT_BONUSES) {
    const points = allocations[config.stat] || 0;
    if (points <= 0) continue;

    const bonus = getStatPointBonus(config.stat, points, FORTRESS_STAT_POINT_BONUSES);

    switch (config.stat) {
      case 'hp':
        mods.maxHpBonus += bonus;
        break;
      case 'damage':
        mods.damageBonus += bonus;
        break;
      case 'armor':
        // Armor reduces damage taken via incomingDamageReduction
        mods.incomingDamageReduction += bonus;
        break;
    }
  }

  return mods;
}

// ============================================================================
// HERO STAT POINTS
// ============================================================================

/**
 * Hero stat point bonuses (returned as multipliers/additions for combat application)
 */
export interface HeroStatPointBonuses {
  damageBonus: number;       // +X% damage (e.g., 0.2 = +20%)
  attackSpeedBonus: number;  // +X% attack speed
  critChanceBonus: number;   // +X% crit chance
}

/**
 * Get stat point bonuses for a specific hero
 * Returns bonuses to apply during combat calculations
 */
export function getHeroStatPointBonuses(
  heroAllocations: Array<{ heroId: string; allocations: Record<string, number> }>,
  heroId: string
): HeroStatPointBonuses {
  const result: HeroStatPointBonuses = {
    damageBonus: 0,
    attackSpeedBonus: 0,
    critChanceBonus: 0,
  };

  const heroData = heroAllocations.find(h => h.heroId === heroId);
  if (!heroData) return result;

  for (const config of HERO_STAT_POINT_BONUSES) {
    const points = heroData.allocations[config.stat] || 0;
    if (points <= 0) continue;

    const bonus = getStatPointBonus(config.stat, points, HERO_STAT_POINT_BONUSES);

    switch (config.stat) {
      case 'damage':
        result.damageBonus = bonus;
        break;
      case 'attackSpeed':
        result.attackSpeedBonus = bonus;
        break;
      case 'critChance':
        result.critChanceBonus = bonus;
        break;
    }
  }

  return result;
}

// ============================================================================
// FULL STAT POINTS APPLICATION
// ============================================================================

/**
 * Apply all fortress stat point allocations to modifiers
 * Use this when initializing a game session (after power upgrades)
 */
export function applyAllStatPointBonuses(
  baseModifiers: ModifierSet,
  statPointData?: StatPointAllocationData
): ModifierSet {
  if (!statPointData) return baseModifiers;

  // Apply fortress stat point allocations
  return applyFortressStatPointBonuses(
    baseModifiers,
    statPointData.fortressAllocations
  );
}

/**
 * Check if player has any stat point allocations
 */
export function hasAnyStatPointAllocations(data: StatPointAllocationData): boolean {
  // Check fortress allocations
  for (const stat of Object.keys(data.fortressAllocations)) {
    if (data.fortressAllocations[stat] > 0) return true;
  }

  // Check hero allocations
  for (const hero of data.heroAllocations) {
    for (const stat of Object.keys(hero.allocations)) {
      if (hero.allocations[stat] > 0) return true;
    }
  }

  return false;
}

/**
 * Calculate total stat points allocated (for debugging/analytics)
 */
export function calculateTotalStatPointsAllocated(data: StatPointAllocationData): {
  fortressPoints: number;
  heroPoints: number;
  totalPoints: number;
} {
  let fortressPoints = 0;
  let heroPoints = 0;

  // Sum fortress allocations
  for (const stat of Object.keys(data.fortressAllocations)) {
    fortressPoints += data.fortressAllocations[stat];
  }

  // Sum hero allocations
  for (const hero of data.heroAllocations) {
    for (const stat of Object.keys(hero.allocations)) {
      heroPoints += hero.allocations[stat];
    }
  }

  return {
    fortressPoints,
    heroPoints,
    totalPoints: fortressPoints + heroPoints,
  };
}
