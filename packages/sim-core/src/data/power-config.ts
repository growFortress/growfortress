/**
 * Power Upgrades Configuration
 *
 * Koszty ulepszeń (liniowe skalowanie) i bonusy statystyk.
 * Formuła kosztu: cost = baseCost + (currentLevel × costPerLevel)
 * Formuła bonusu: multiplier = (1 + bonusPerLevel)^level
 */

import type {
  UpgradableStat,
  FortressUpgradableStat,
  HeroUpgradableStat,
  TurretUpgradableStat,
  ItemTier,
} from './power-upgrades.js';

// ============================================================================
// STAT UPGRADE CONFIGURATION
// ============================================================================

export interface StatUpgradeConfig {
  stat: UpgradableStat;
  name: string;
  description: string;
  bonusPerLevel: number;   // np. 0.05 = +5% per level
  maxLevel: number;
  baseCost: number;        // Koszt pierwszego ulepszenia
  costPerLevel: number;    // Dodatkowy koszt za każdy level
}

// ============================================================================
// FORTRESS STAT UPGRADES (Simplified: 3 stats only)
// ============================================================================

export const FORTRESS_STAT_UPGRADES: StatUpgradeConfig[] = [
  {
    stat: 'hp',
    name: 'Wzmocnione Mury',
    description: '+5% HP twierdzy za level',
    bonusPerLevel: 0.05,
    maxLevel: 20,
    baseCost: 60,       // Reduced from 100
    costPerLevel: 45,   // Reduced from 75
  },
  {
    stat: 'damage',
    name: 'Arsenał',
    description: '+4% obrażeń twierdzy za level',
    bonusPerLevel: 0.04,
    maxLevel: 20,
    baseCost: 90,       // Reduced from 150
    costPerLevel: 60,   // Reduced from 100
  },
  {
    stat: 'armor',
    name: 'Pancerz',
    description: '+3% redukcji obrażeń za level',
    bonusPerLevel: 0.03,
    maxLevel: 20,
    baseCost: 120,      // Reduced from 200
    costPerLevel: 75,   // Reduced from 125
  },
];

// ============================================================================
// HERO STAT UPGRADES (Simplified: 2 stats only)
// ============================================================================

export const HERO_STAT_UPGRADES: StatUpgradeConfig[] = [
  {
    stat: 'hp',
    name: 'Wytrzymałość',
    description: '+10% HP bohatera za level',
    bonusPerLevel: 0.10,
    maxLevel: Infinity,
    baseCost: 15,
    costPerLevel: 10,
  },
  {
    stat: 'damage',
    name: 'Siła Ataku',
    description: '+10% obrażeń bohatera za level',
    bonusPerLevel: 0.10,
    maxLevel: Infinity,
    baseCost: 25,
    costPerLevel: 15,
  },
];

// ============================================================================
// TURRET STAT UPGRADES (Simplified: 2 stats only)
// ============================================================================

export const TURRET_STAT_UPGRADES: StatUpgradeConfig[] = [
  {
    stat: 'damage',
    name: 'Ulepszony Kaliber',
    description: '+3% obrażeń wieżyczki za level',
    bonusPerLevel: 0.03,
    maxLevel: 20,
    baseCost: 40,
    costPerLevel: 25,
  },
  {
    stat: 'attackSpeed',
    name: 'Mechanizm Szybkostrzelny',
    description: '+2.5% szybkości ataku wieżyczki za level',
    bonusPerLevel: 0.025,
    maxLevel: 20,
    baseCost: 60,
    costPerLevel: 35,
  },
];

// ============================================================================
// ITEM TIER CONFIGURATION
// ============================================================================

export interface ItemTierConfig {
  tier: ItemTier;
  name: string;
  effectMultiplier: number;  // Mnożnik efektu itemu
  upgradeCost: number | null; // null = max tier (nie można ulepszyć dalej)
  color: number;             // Kolor dla UI
}

export const ITEM_TIER_CONFIG: Record<ItemTier, ItemTierConfig> = {
  common: {
    tier: 'common',
    name: 'Zwykły',
    effectMultiplier: 1.0,
    upgradeCost: 800,      // Rebalanced from 500
    color: 0x9d9d9d, // Gray
  },
  uncommon: {
    tier: 'uncommon',
    name: 'Niezwykły',
    effectMultiplier: 1.15, // Rebalanced from 1.25
    upgradeCost: 1750,      // Rebalanced from 1000
    color: 0x1eff00, // Green
  },
  rare: {
    tier: 'rare',
    name: 'Rzadki',
    effectMultiplier: 1.35, // Rebalanced from 1.5
    upgradeCost: 4000,      // Rebalanced from 2500
    color: 0x0070dd, // Blue
  },
  epic: {
    tier: 'epic',
    name: 'Epicki',
    effectMultiplier: 1.6,  // Rebalanced from 2.0
    upgradeCost: 8000,      // Rebalanced from 5000
    color: 0xa335ee, // Purple
  },
  legendary: {
    tier: 'legendary',
    name: 'Legendarny',
    effectMultiplier: 2.0,  // Rebalanced from 3.0
    upgradeCost: null, // Max tier
    color: 0xff8000, // Orange
  },
};

// ============================================================================
// POWER WEIGHTS (for Power Level calculation)
// ============================================================================

/**
 * Wagi statystyk do kalkulacji Power Level
 * Wyższe wagi = większy wpływ na Power
 * Simplified: only hp, damage, armor, attackSpeed used
 */
export const POWER_WEIGHTS = {
  // Stat weights (simplified)
  hp: 0.5,
  damage: 1.0,
  armor: 0.5,
  attackSpeed: 0.8,

  // Base power per entity type
  fortressBase: 100,
  heroBase: 50,
  turretBase: 30,

  // Item tier power bonus
  itemTierBase: 50, // Power per tier level (0-4)
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Oblicza koszt ulepszenia (liniowe skalowanie)
 */
export function getUpgradeCost(config: StatUpgradeConfig, currentLevel: number): number {
  if (currentLevel >= config.maxLevel) {
    return Infinity; // Nie można ulepszyć dalej
  }
  return config.baseCost + currentLevel * config.costPerLevel;
}

/**
 * Oblicza mnożnik statystyki z poziomu ulepszenia (multiplikatywny)
 */
export function getStatMultiplier(config: StatUpgradeConfig, level: number): number {
  if (level <= 0) return 1.0;
  return Math.pow(1 + config.bonusPerLevel, level);
}

/**
 * Oblicza łączny bonus (procentowy) z poziomu ulepszenia
 */
export function getStatBonusPercent(config: StatUpgradeConfig, level: number): number {
  return (getStatMultiplier(config, level) - 1) * 100;
}

/**
 * Pobiera konfigurację ulepszenia dla twierdzy
 */
export function getFortressStatConfig(stat: FortressUpgradableStat): StatUpgradeConfig | undefined {
  return FORTRESS_STAT_UPGRADES.find(c => c.stat === stat);
}

/**
 * Pobiera konfigurację ulepszenia dla bohatera
 */
export function getHeroStatConfig(stat: HeroUpgradableStat): StatUpgradeConfig | undefined {
  return HERO_STAT_UPGRADES.find(c => c.stat === stat);
}

/**
 * Pobiera konfigurację ulepszenia dla wieżyczki
 */
export function getTurretStatConfig(stat: TurretUpgradableStat): StatUpgradeConfig | undefined {
  return TURRET_STAT_UPGRADES.find(c => c.stat === stat);
}

/**
 * Pobiera koszt ulepszenia itemu do następnego tieru
 */
export function getItemUpgradeCost(currentTier: ItemTier): number | null {
  return ITEM_TIER_CONFIG[currentTier].upgradeCost;
}

/**
 * Oblicza łączny koszt wszystkich dotychczasowych ulepszeń danego statu
 */
export function getTotalSpentOnStat(config: StatUpgradeConfig, currentLevel: number): number {
  let total = 0;
  for (let i = 0; i < currentLevel; i++) {
    total += config.baseCost + i * config.costPerLevel;
  }
  return total;
}

/**
 * Oblicza ile poziomów można kupić za daną ilość golda
 */
export function getAffordableLevels(
  config: StatUpgradeConfig,
  currentLevel: number,
  availableGold: number
): number {
  let levels = 0;
  let remainingGold = availableGold;
  let level = currentLevel;

  while (level < config.maxLevel) {
    const cost = getUpgradeCost(config, level);
    if (remainingGold >= cost) {
      remainingGold -= cost;
      level++;
      levels++;
    } else {
      break;
    }
  }

  return levels;
}
