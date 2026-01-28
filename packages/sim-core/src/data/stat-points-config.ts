/**
 * Stat Points Configuration
 *
 * Free stat points system - earned through waves and level-ups.
 * Players can allocate points to fortress or heroes for permanent bonuses.
 * This is separate from the gold-based power upgrades system.
 */

// ============================================================================
// EARNING CONFIGURATION
// ============================================================================

/** Points earned per completed wave */
export const STAT_POINTS_PER_WAVE = 1;

/** Points earned per player level up */
export const STAT_POINTS_PER_LEVEL_UP = 4;

// ============================================================================
// ALLOCATION CONFIGURATION
// ============================================================================

/**
 * Configuration for stat point bonus per stat
 */
export interface StatPointBonusConfig {
  stat: string;
  name: string;
  description: string;
  bonusPerPoint: number;  // e.g., 0.02 = +2% per point
  maxPoints: number;      // Cap per stat (prevents infinite scaling)
}

/**
 * Fortress stat point bonuses
 * More impactful than hero stats since fortress is always active
 */
export const FORTRESS_STAT_POINT_BONUSES: StatPointBonusConfig[] = [
  {
    stat: 'hp',
    name: 'Fortified Walls',
    description: '+2% fortress HP per point',
    bonusPerPoint: 0.02,
    maxPoints: 100, // Max +200% HP
  },
  {
    stat: 'damage',
    name: 'Enhanced Arsenal',
    description: '+1.5% fortress damage per point',
    bonusPerPoint: 0.015,
    maxPoints: 100, // Max +150% damage
  },
  {
    stat: 'armor',
    name: 'Reinforced Plating',
    description: '+1% damage reduction per point',
    bonusPerPoint: 0.01,
    maxPoints: 50, // Max +50% armor
  },
];

/**
 * Hero stat point bonuses
 * Applies to individual heroes, allows specialization
 */
export const HERO_STAT_POINT_BONUSES: StatPointBonusConfig[] = [
  {
    stat: 'damage',
    name: 'Battle Training',
    description: '+2% hero damage per point',
    bonusPerPoint: 0.02,
    maxPoints: 100, // Max +200% damage
  },
  {
    stat: 'attackSpeed',
    name: 'Combat Reflexes',
    description: '+1% attack speed per point',
    bonusPerPoint: 0.01,
    maxPoints: 50, // Max +50% attack speed
  },
  {
    stat: 'critChance',
    name: 'Precision Training',
    description: '+0.5% critical chance per point',
    bonusPerPoint: 0.005,
    maxPoints: 50, // Max +25% crit chance
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the fortress stat config for a given stat
 */
export function getFortressStatPointConfig(stat: string): StatPointBonusConfig | undefined {
  return FORTRESS_STAT_POINT_BONUSES.find(c => c.stat === stat);
}

/**
 * Get the hero stat config for a given stat
 */
export function getHeroStatPointConfig(stat: string): StatPointBonusConfig | undefined {
  return HERO_STAT_POINT_BONUSES.find(c => c.stat === stat);
}

/**
 * Calculate the bonus from allocated stat points
 * Returns additive bonus (e.g., 0.20 for +20%)
 */
export function getStatPointBonus(
  stat: string,
  allocatedPoints: number,
  configs: StatPointBonusConfig[]
): number {
  const config = configs.find(c => c.stat === stat);
  if (!config) return 0;

  // Clamp to max points
  const effectivePoints = Math.min(allocatedPoints, config.maxPoints);
  return effectivePoints * config.bonusPerPoint;
}

/**
 * Calculate the bonus percentage for display
 */
export function getStatPointBonusPercent(
  stat: string,
  allocatedPoints: number,
  configs: StatPointBonusConfig[]
): number {
  return getStatPointBonus(stat, allocatedPoints, configs) * 100;
}

/**
 * Check if a stat can receive more allocations
 */
export function canAllocateMorePoints(
  stat: string,
  currentPoints: number,
  configs: StatPointBonusConfig[]
): boolean {
  const config = configs.find(c => c.stat === stat);
  if (!config) return false;
  return currentPoints < config.maxPoints;
}

/**
 * Get the maximum points that can be allocated to a stat
 */
export function getMaxPointsForStat(
  stat: string,
  configs: StatPointBonusConfig[]
): number {
  const config = configs.find(c => c.stat === stat);
  return config?.maxPoints ?? 0;
}

/**
 * Calculate points earned from completing waves
 */
export function calculateWaveStatPoints(wavesCompleted: number): number {
  return wavesCompleted * STAT_POINTS_PER_WAVE;
}

/**
 * Calculate points earned from level ups
 */
export function calculateLevelUpStatPoints(levelsGained: number): number {
  return levelsGained * STAT_POINTS_PER_LEVEL_UP;
}

/**
 * Get all fortress stat point bonuses as a record
 */
export function getFortressStatPointBonuses(
  allocations: Record<string, number>
): Record<string, number> {
  const bonuses: Record<string, number> = {};

  for (const config of FORTRESS_STAT_POINT_BONUSES) {
    const points = allocations[config.stat] ?? 0;
    if (points > 0) {
      bonuses[config.stat] = getStatPointBonus(config.stat, points, FORTRESS_STAT_POINT_BONUSES);
    }
  }

  return bonuses;
}

/**
 * Get hero stat point bonuses for a specific hero
 */
export function getHeroStatPointBonuses(
  heroAllocations: Array<{ heroId: string; allocations: Record<string, number> }>,
  heroId: string
): Record<string, number> {
  const bonuses: Record<string, number> = {};

  const heroData = heroAllocations.find(h => h.heroId === heroId);
  if (!heroData) return bonuses;

  for (const config of HERO_STAT_POINT_BONUSES) {
    const points = heroData.allocations[config.stat] ?? 0;
    if (points > 0) {
      bonuses[config.stat] = getStatPointBonus(config.stat, points, HERO_STAT_POINT_BONUSES);
    }
  }

  return bonuses;
}
