/**
 * Power Upgrades Configuration
 *
 * Koszty ulepszeń i bonusy statystyk.
 * Formuła kosztu (hero): cost = baseCost × costMultiplier^level (wykładnicza)
 * Formuła kosztu (fortress/turret): cost = baseCost + (currentLevel × costPerLevel) (liniowa)
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

/**
 * Konfiguracja ulepszenia statystyki (liniowe koszty - fortress/turret)
 */
export interface StatUpgradeConfig {
  stat: UpgradableStat;
  name: string;
  description: string;
  bonusPerLevel: number;   // np. 0.05 = +5% per level
  maxLevel: number;        // Limit poziomów (Infinity = bez limitu)
  baseCost: number;        // Koszt pierwszego ulepszenia
  costPerLevel: number;    // Dodatkowy koszt za każdy level (liniowe)
}

/**
 * Konfiguracja ulepszenia statystyki bohatera (wykładnicze koszty, bez limitu)
 */
export interface HeroStatUpgradeConfig {
  stat: HeroUpgradableStat;
  name: string;
  description: string;
  bonusPerLevel: number;   // np. 0.05 = +5% per level
  baseCost: number;        // Koszt pierwszego ulepszenia
  costMultiplier: number;  // Mnożnik kosztu za każdy level (wykładnicze)
}

// ============================================================================
// FORTRESS STAT UPGRADES (Simplified: 3 stats only)
// ============================================================================

export const FORTRESS_STAT_UPGRADES: StatUpgradeConfig[] = [
  {
    stat: 'hp',
    name: 'Wzmocnione Mury',
    description: '+6% HP twierdzy za level',
    bonusPerLevel: 0.06,
    maxLevel: 50,
    baseCost: 80,
    costPerLevel: 55,
  },
  {
    stat: 'damage',
    name: 'Arsenał',
    description: '+4% obrażeń twierdzy za level',
    bonusPerLevel: 0.04,
    maxLevel: 50,
    baseCost: 100,
    costPerLevel: 70,
  },
  {
    stat: 'armor',
    name: 'Pancerz',
    description: '+4% redukcji obrażeń za level',
    bonusPerLevel: 0.04,
    maxLevel: 40,
    baseCost: 150,
    costPerLevel: 90,
  },
];

// ============================================================================
// HERO STAT UPGRADES (4 stats, exponential cost, no level cap)
// ============================================================================

export const HERO_STAT_UPGRADES: HeroStatUpgradeConfig[] = [
  {
    stat: 'damage',
    name: 'Siła Ataku',
    description: '+5% obrażeń za level',
    bonusPerLevel: 0.05,
    baseCost: 50,
    costMultiplier: 1.15,
  },
  {
    stat: 'attackSpeed',
    name: 'Szybkość Ataku',
    description: '+3% attack speed za level',
    bonusPerLevel: 0.03,
    baseCost: 60,
    costMultiplier: 1.15,
  },
  {
    stat: 'range',
    name: 'Zasięg',
    description: '+2% zasięgu za level',
    bonusPerLevel: 0.02,
    baseCost: 80,
    costMultiplier: 1.18,
  },
  {
    stat: 'critChance',
    name: 'Szansa na Krytyka',
    description: '+1% crit chance za level',
    bonusPerLevel: 0.01,
    baseCost: 100,
    costMultiplier: 1.20,
  },
];

// ============================================================================
// TURRET STAT UPGRADES (Simplified: 2 stats only)
// ============================================================================

export const TURRET_STAT_UPGRADES: StatUpgradeConfig[] = [
  {
    stat: 'damage',
    name: 'Ulepszony Kaliber',
    description: '+4% obrażeń wieżyczki za level',
    bonusPerLevel: 0.04,
    maxLevel: 25,
    baseCost: 50,
    costPerLevel: 30,
  },
  {
    stat: 'attackSpeed',
    name: 'Mechanizm Szybkostrzelny',
    description: '+3% szybkości ataku wieżyczki za level',
    bonusPerLevel: 0.03,
    maxLevel: 25,
    baseCost: 70,
    costPerLevel: 40,
  },
];

// ============================================================================
// ITEM TIER CONFIGURATION
// ============================================================================

export interface ItemTierConfig {
  tier: ItemTier;
  name: string;
  effectMultiplier: number;
  upgradeCost: number | null;
  color: number;
}

export const ITEM_TIER_CONFIG: Record<ItemTier, ItemTierConfig> = {
  common: {
    tier: 'common',
    name: 'Zwykły',
    effectMultiplier: 1.0,
    upgradeCost: 800,
    color: 0x9d9d9d,
  },
  uncommon: {
    tier: 'uncommon',
    name: 'Niezwykły',
    effectMultiplier: 1.15,
    upgradeCost: 1750,
    color: 0x1eff00,
  },
  rare: {
    tier: 'rare',
    name: 'Rzadki',
    effectMultiplier: 1.35,
    upgradeCost: 4000,
    color: 0x0070dd,
  },
  epic: {
    tier: 'epic',
    name: 'Epicki',
    effectMultiplier: 1.6,
    upgradeCost: 8000,
    color: 0xa335ee,
  },
  legendary: {
    tier: 'legendary',
    name: 'Legendarny',
    effectMultiplier: 2.0,
    upgradeCost: null,
    color: 0xff8000,
  },
};

// ============================================================================
// POWER WEIGHTS (for Power Level calculation)
// ============================================================================

export const POWER_WEIGHTS = {
  // Stat weights
  hp: 0.5,
  damage: 1.0,
  armor: 0.5,
  attackSpeed: 0.8,
  range: 0.6,
  critChance: 0.7,

  // Base power per entity type
  fortressBase: 100,
  heroBase: 50,
  turretBase: 30,

  // Item tier power bonus
  itemTierBase: 50,
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Oblicza koszt ulepszenia (liniowe skalowanie - dla fortress/turret)
 */
export function getUpgradeCost(config: StatUpgradeConfig, currentLevel: number): number {
  if (currentLevel >= config.maxLevel) {
    return Infinity;
  }
  return config.baseCost + currentLevel * config.costPerLevel;
}

/**
 * Oblicza koszt ulepszenia bohatera (wykładnicze skalowanie - bez limitu)
 */
export function getHeroUpgradeCost(config: HeroStatUpgradeConfig, currentLevel: number): number {
  return Math.floor(config.baseCost * Math.pow(config.costMultiplier, currentLevel));
}

/**
 * Oblicza mnożnik statystyki z poziomu ulepszenia (multiplikatywny)
 */
export function getStatMultiplier(config: StatUpgradeConfig | HeroStatUpgradeConfig, level: number): number {
  if (level <= 0) return 1.0;
  return Math.pow(1 + config.bonusPerLevel, level);
}

/**
 * Oblicza łączny bonus (procentowy) z poziomu ulepszenia
 */
export function getStatBonusPercent(config: StatUpgradeConfig | HeroStatUpgradeConfig, level: number): number {
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
export function getHeroStatConfig(stat: HeroUpgradableStat): HeroStatUpgradeConfig | undefined {
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
 * Oblicza łączny koszt wszystkich dotychczasowych ulepszeń danego statu (liniowe)
 */
export function getTotalSpentOnStat(config: StatUpgradeConfig, currentLevel: number): number {
  let total = 0;
  for (let i = 0; i < currentLevel; i++) {
    total += config.baseCost + i * config.costPerLevel;
  }
  return total;
}

/**
 * Oblicza łączny koszt wszystkich ulepszeń bohatera (wykładnicze)
 */
export function getTotalSpentOnHeroStat(config: HeroStatUpgradeConfig, currentLevel: number): number {
  let total = 0;
  for (let i = 0; i < currentLevel; i++) {
    total += getHeroUpgradeCost(config, i);
  }
  return total;
}

/**
 * Oblicza ile poziomów można kupić za daną ilość golda (liniowe - fortress/turret)
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

/**
 * Oblicza ile poziomów bohatera można kupić za daną ilość golda (wykładnicze)
 */
export function getAffordableHeroLevels(
  config: HeroStatUpgradeConfig,
  currentLevel: number,
  availableGold: number,
  maxLevels: number = 100 // Limit do zapobiegania nieskończonej pętli
): number {
  let levels = 0;
  let remainingGold = availableGold;
  let level = currentLevel;

  while (levels < maxLevels) {
    const cost = getHeroUpgradeCost(config, level);
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
