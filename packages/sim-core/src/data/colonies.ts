/**
 * Colony System
 *
 * Buildings that generate passive gold income while offline.
 * Each colony can be upgraded to increase production.
 * Unlocks at specific commander levels as milestones.
 */

export interface ColonyDefinition {
  id: string;
  name: string;
  description: string;
  baseGoldPerHour: number;
  baseUpgradeCost: number;
  upgradeCostMultiplier: number; // Cost increases by this factor per level
  maxLevel: number;
  unlockLevel: number; // Commander level required to unlock
  icon: string;
}

export interface ActiveColony {
  id: string;
  level: number;
  pendingGold: number; // Accumulated gold not yet claimed
}

/**
 * Colony definitions
 * Progression: Farm (early) -> Mine (mid) -> Market (late) -> Factory (endgame)
 */
export const COLONY_DEFINITIONS: ColonyDefinition[] = [
  {
    id: 'farm',
    name: 'Farma',
    description: 'Podstawowa produkcja zasobów. Stabilny, niski dochód.',
    baseGoldPerHour: 10,
    baseUpgradeCost: 100,
    upgradeCostMultiplier: 1.15,
    maxLevel: 50,
    unlockLevel: 5, // Early unlock
    icon: '🌾',
  },
  {
    id: 'mine',
    name: 'Kopalnia',
    description: 'Wydobycie cennych minerałów. Średni dochód.',
    baseGoldPerHour: 25,
    baseUpgradeCost: 500,
    upgradeCostMultiplier: 1.18,
    maxLevel: 40,
    unlockLevel: 15,
    icon: '⛏️',
  },
  {
    id: 'market',
    name: 'Targ',
    description: 'Handel z innymi osadami. Wysoki dochód.',
    baseGoldPerHour: 50,
    baseUpgradeCost: 2000,
    upgradeCostMultiplier: 1.20,
    maxLevel: 30,
    unlockLevel: 30,
    icon: '🏪',
  },
  {
    id: 'factory',
    name: 'Fabryka',
    description: 'Zaawansowana produkcja. Bardzo wysoki dochód.',
    baseGoldPerHour: 100,
    baseUpgradeCost: 10000,
    upgradeCostMultiplier: 1.25,
    maxLevel: 20,
    unlockLevel: 50,
    icon: '🏭',
  },
];

/**
 * Get colony definition by ID
 */
export function getColonyById(colonyId: string): ColonyDefinition | undefined {
  return COLONY_DEFINITIONS.find(c => c.id === colonyId);
}

/**
 * Get all unlocked colonies for a commander level
 */
export function getUnlockedColonies(commanderLevel: number): ColonyDefinition[] {
  return COLONY_DEFINITIONS.filter(c => commanderLevel >= c.unlockLevel);
}

/**
 * Get next colony to unlock
 */
export function getNextColonyToUnlock(commanderLevel: number): ColonyDefinition | undefined {
  return COLONY_DEFINITIONS
    .filter(c => commanderLevel < c.unlockLevel)
    .sort((a, b) => a.unlockLevel - b.unlockLevel)[0];
}

/**
 * Calculate gold production per hour for a colony at given level
 * Formula: baseGoldPerHour * level * (1 + fortressLevel * 0.01)
 */
export function calculateColonyGoldPerHour(
  colonyId: string,
  colonyLevel: number,
  fortressLevel: number = 1
): number {
  const colony = getColonyById(colonyId);
  if (!colony || colonyLevel <= 0) return 0;

  const baseProduction = colony.baseGoldPerHour * colonyLevel;
  const fortressBonus = 1 + (fortressLevel - 1) * 0.01; // +1% per fortress level above 1

  return Math.floor(baseProduction * fortressBonus);
}

/**
 * Calculate total gold production from all colonies
 */
export function calculateTotalGoldPerHour(
  colonies: ActiveColony[],
  fortressLevel: number = 1
): number {
  return colonies.reduce((total, colony) => {
    return total + calculateColonyGoldPerHour(colony.id, colony.level, fortressLevel);
  }, 0);
}

/**
 * Calculate upgrade cost for a colony at given level
 * Formula: baseUpgradeCost * (upgradeCostMultiplier ^ level)
 */
export function calculateUpgradeCost(colonyId: string, currentLevel: number): number {
  const colony = getColonyById(colonyId);
  if (!colony) return Infinity;

  if (currentLevel >= colony.maxLevel) return Infinity; // Can't upgrade past max

  return Math.floor(
    colony.baseUpgradeCost * Math.pow(colony.upgradeCostMultiplier, currentLevel)
  );
}

/**
 * Check if a colony can be upgraded
 */
export function canUpgradeColony(
  colonyId: string,
  currentLevel: number,
  availableGold: number
): boolean {
  const colony = getColonyById(colonyId);
  if (!colony) return false;
  if (currentLevel >= colony.maxLevel) return false;

  const cost = calculateUpgradeCost(colonyId, currentLevel);
  return availableGold >= cost;
}

/**
 * Calculate pending gold for time offline
 */
export function calculatePendingGold(
  colonies: ActiveColony[],
  hoursOffline: number,
  fortressLevel: number = 1,
  maxHours: number = 8
): number {
  const cappedHours = Math.min(hoursOffline, maxHours);
  const goldPerHour = calculateTotalGoldPerHour(colonies, fortressLevel);

  return Math.floor(goldPerHour * cappedHours);
}

/**
 * Get colony status summary for UI
 */
export function getColonyStatus(
  colony: ActiveColony,
  fortressLevel: number = 1
): {
  id: string;
  name: string;
  level: number;
  maxLevel: number;
  goldPerHour: number;
  upgradeCost: number;
  canUpgrade: boolean;
  icon: string;
} {
  const def = getColonyById(colony.id);
  if (!def) {
    return {
      id: colony.id,
      name: 'Unknown',
      level: colony.level,
      maxLevel: 0,
      goldPerHour: 0,
      upgradeCost: Infinity,
      canUpgrade: false,
      icon: '❓',
    };
  }

  return {
    id: colony.id,
    name: def.name,
    level: colony.level,
    maxLevel: def.maxLevel,
    goldPerHour: calculateColonyGoldPerHour(colony.id, colony.level, fortressLevel),
    upgradeCost: calculateUpgradeCost(colony.id, colony.level),
    canUpgrade: colony.level < def.maxLevel,
    icon: def.icon,
  };
}

/**
 * Initialize default colonies for a new player
 * Starts with level 0 (not built yet)
 */
export function getDefaultColonies(): ActiveColony[] {
  return COLONY_DEFINITIONS.map(def => ({
    id: def.id,
    level: 0,
    pendingGold: 0,
  }));
}

/**
 * Get colonies that are available but not yet built (level 0)
 */
export function getAvailableColoniesToBuild(
  colonies: ActiveColony[],
  commanderLevel: number
): ColonyDefinition[] {
  const unlockedIds = getUnlockedColonies(commanderLevel).map(c => c.id);
  const builtIds = colonies.filter(c => c.level > 0).map(c => c.id);

  return COLONY_DEFINITIONS.filter(
    c => unlockedIds.includes(c.id) && !builtIds.includes(c.id)
  );
}
