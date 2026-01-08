/**
 * Power Level Calculator
 *
 * Oblicza Power Level dla bohaterów, wieżyczek, twierdzy i itemów.
 * Używa formuły multiplikatywnej: Power = basePower × upgradeMultiplier × tierMultiplier
 */

import type {
  PlayerPowerData,
  StatUpgrades,
  ItemTier,
  PowerBreakdown,
  EntityPower,
  TotalPowerSummary,
} from '../data/power-upgrades.js';

import { ITEM_TIER_INDEX } from '../data/power-upgrades.js';

import {
  FORTRESS_STAT_UPGRADES,
  HERO_STAT_UPGRADES,
  TURRET_STAT_UPGRADES,
  ITEM_TIER_CONFIG,
  POWER_WEIGHTS,
  getStatMultiplier,
  type StatUpgradeConfig,
} from '../data/power-config.js';

import { getHeroById } from '../data/heroes.js';
import { getTurretById } from '../data/turrets.js';

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Oblicza łączny mnożnik ze wszystkich ulepszeń statystyk
 */
function calculateUpgradeMultiplier(
  upgrades: StatUpgrades,
  configs: StatUpgradeConfig[]
): number {
  let multiplier = 1.0;

  for (const config of configs) {
    const level = upgrades[config.stat] || 0;
    if (level > 0) {
      multiplier *= getStatMultiplier(config, level);
    }
  }

  return multiplier;
}

/**
 * Oblicza bazową moc z raw statystyk (simplified - only hp, damage, armor, attackSpeed)
 */
function calculateBaseStatPower(stats: {
  hp?: number;
  damage?: number;
  attackSpeed?: number;
}): number {
  let power = 0;

  if (stats.hp) power += stats.hp * POWER_WEIGHTS.hp;
  if (stats.damage) power += stats.damage * POWER_WEIGHTS.damage;
  if (stats.attackSpeed) power += stats.attackSpeed * POWER_WEIGHTS.attackSpeed * 100;

  return power;
}

// ============================================================================
// FORTRESS POWER
// ============================================================================

/**
 * Oblicza Power twierdzy
 */
export function calculateFortressPower(
  upgrades: StatUpgrades,
  commanderLevel: number
): PowerBreakdown {
  // Bazowa moc rośnie z poziomem dowódcy
  const basePower = POWER_WEIGHTS.fortressBase + commanderLevel * 10;

  // Mnożnik z ulepszeń statystyk
  const upgradeMultiplier = calculateUpgradeMultiplier(upgrades, FORTRESS_STAT_UPGRADES);

  // Twierdza nie ma tierów
  const tierMultiplier = 1.0;

  const totalPower = Math.floor(basePower * upgradeMultiplier * tierMultiplier);

  return {
    basePower: Math.floor(basePower),
    upgradeMultiplier,
    tierMultiplier,
    totalPower,
  };
}

// ============================================================================
// HERO POWER
// ============================================================================

/**
 * Oblicza Power bohatera
 */
export function calculateHeroPower(
  heroId: string,
  upgrades: StatUpgrades,
  heroTier: 1 | 2 | 3
): PowerBreakdown {
  const heroDef = getHeroById(heroId);

  if (!heroDef) {
    return {
      basePower: 0,
      upgradeMultiplier: 1,
      tierMultiplier: 1,
      totalPower: 0,
    };
  }

  // Bazowa moc ze statystyk bohatera
  const basePower =
    POWER_WEIGHTS.heroBase +
    calculateBaseStatPower({
      hp: heroDef.baseStats.hp,
      damage: heroDef.baseStats.damage,
      attackSpeed: heroDef.baseStats.attackSpeed,
    });

  // Mnożnik z ulepszeń power upgrades
  const upgradeMultiplier = calculateUpgradeMultiplier(upgrades, HERO_STAT_UPGRADES);

  // Mnożnik z tieru bohatera (z definicji bohatera)
  const tierDef = heroDef.tiers[heroTier - 1];
  const tierMultiplier = tierDef?.statMultiplier ?? 1.0;

  const totalPower = Math.floor(basePower * upgradeMultiplier * tierMultiplier);

  return {
    basePower: Math.floor(basePower),
    upgradeMultiplier,
    tierMultiplier,
    totalPower,
  };
}

// ============================================================================
// TURRET POWER
// ============================================================================

/**
 * Oblicza Power wieżyczki
 */
export function calculateTurretPower(
  turretType: string,
  upgrades: StatUpgrades,
  turretTier: 1 | 2 | 3
): PowerBreakdown {
  const turretDef = getTurretById(turretType);

  if (!turretDef) {
    return {
      basePower: 0,
      upgradeMultiplier: 1,
      tierMultiplier: 1,
      totalPower: 0,
    };
  }

  // Bazowa moc ze statystyk wieżyczki (konwersja z FP) - simplified
  const FP_SCALE = 16384;
  const basePower =
    POWER_WEIGHTS.turretBase +
    calculateBaseStatPower({
      damage: turretDef.baseStats.damage / FP_SCALE,
      attackSpeed: turretDef.baseStats.attackSpeed / FP_SCALE,
    });

  // Mnożnik z ulepszeń power upgrades
  const upgradeMultiplier = calculateUpgradeMultiplier(upgrades, TURRET_STAT_UPGRADES);

  // Mnożnik z tieru wieżyczki (1.0, 1.25, 1.5)
  const tierMultiplier = 1 + (turretTier - 1) * 0.25;

  const totalPower = Math.floor(basePower * upgradeMultiplier * tierMultiplier);

  return {
    basePower: Math.floor(basePower),
    upgradeMultiplier,
    tierMultiplier,
    totalPower,
  };
}

// ============================================================================
// ITEM POWER
// ============================================================================

/**
 * Oblicza Power ze wszystkich itemów
 */
export function calculateItemPower(
  itemTiers: { itemId: string; tier: ItemTier }[]
): number {
  let totalPower = 0;

  for (const item of itemTiers) {
    const tierIndex = ITEM_TIER_INDEX[item.tier];
    const tierConfig = ITEM_TIER_CONFIG[item.tier];

    // Power rośnie z tierem (0-4) i mnożnikiem efektu
    totalPower += POWER_WEIGHTS.itemTierBase * (tierIndex + 1) * tierConfig.effectMultiplier;
  }

  return Math.floor(totalPower);
}

// ============================================================================
// TOTAL POWER SUMMARY
// ============================================================================

/**
 * Tier maps dla kalkulacji
 */
export interface TierMaps {
  heroTiers: Record<string, 1 | 2 | 3>;
  turretTiers: Record<string, 1 | 2 | 3>;
}

/**
 * Oblicza pełne podsumowanie Power dla gracza
 */
export function calculateTotalPower(
  powerData: PlayerPowerData,
  commanderLevel: number,
  tiers: TierMaps
): TotalPowerSummary {
  // Fortress power
  const fortressPower = calculateFortressPower(
    powerData.fortressUpgrades.statUpgrades,
    commanderLevel
  );

  // Hero power (dla każdego bohatera z ulepszeniami)
  const heroPower: EntityPower[] = powerData.heroUpgrades.map(hu => ({
    id: hu.heroId,
    power: calculateHeroPower(
      hu.heroId,
      hu.statUpgrades,
      tiers.heroTiers[hu.heroId] || 1
    ),
  }));

  // Turret power (dla każdego typu wieżyczki z ulepszeniami)
  const turretPower: EntityPower[] = powerData.turretUpgrades.map(tu => ({
    id: tu.turretType,
    power: calculateTurretPower(
      tu.turretType,
      tu.statUpgrades,
      tiers.turretTiers[tu.turretType] || 1
    ),
  }));

  // Item power
  const itemPower = calculateItemPower(powerData.itemTiers);

  // Total
  const totalPower =
    fortressPower.totalPower +
    heroPower.reduce((sum, hp) => sum + hp.power.totalPower, 0) +
    turretPower.reduce((sum, tp) => sum + tp.power.totalPower, 0) +
    itemPower;

  return {
    fortressPower,
    heroPower,
    turretPower,
    itemPower,
    totalPower,
  };
}

// ============================================================================
// QUICK POWER CALCULATION (for cached value)
// ============================================================================

/**
 * Szybka kalkulacja łącznego Power (bez breakdown)
 * Używana do aktualizacji cached value w bazie
 */
export function calculateQuickTotalPower(
  powerData: PlayerPowerData,
  commanderLevel: number,
  defaultHeroTier: 1 | 2 | 3 = 1,
  defaultTurretTier: 1 | 2 | 3 = 1
): number {
  // Fortress
  const fortressMultiplier = calculateUpgradeMultiplier(
    powerData.fortressUpgrades.statUpgrades,
    FORTRESS_STAT_UPGRADES
  );
  const fortressPower = (POWER_WEIGHTS.fortressBase + commanderLevel * 10) * fortressMultiplier;

  // Heroes
  let heroPower = 0;
  for (const hu of powerData.heroUpgrades) {
    const heroDef = getHeroById(hu.heroId);
    if (heroDef) {
      const basePower =
        POWER_WEIGHTS.heroBase +
        heroDef.baseStats.hp * POWER_WEIGHTS.hp +
        heroDef.baseStats.damage * POWER_WEIGHTS.damage;
      const upgradeMultiplier = calculateUpgradeMultiplier(hu.statUpgrades, HERO_STAT_UPGRADES);
      const tierMultiplier = heroDef.tiers[defaultHeroTier - 1]?.statMultiplier ?? 1.0;
      heroPower += basePower * upgradeMultiplier * tierMultiplier;
    }
  }

  // Turrets
  let turretPower = 0;
  const FP_SCALE = 16384;
  for (const tu of powerData.turretUpgrades) {
    const turretDef = getTurretById(tu.turretType);
    if (turretDef) {
      const basePower =
        POWER_WEIGHTS.turretBase +
        (turretDef.baseStats.damage / FP_SCALE) * POWER_WEIGHTS.damage;
      const upgradeMultiplier = calculateUpgradeMultiplier(tu.statUpgrades, TURRET_STAT_UPGRADES);
      const tierMultiplier = 1 + (defaultTurretTier - 1) * 0.25;
      turretPower += basePower * upgradeMultiplier * tierMultiplier;
    }
  }

  // Items
  let itemPower = 0;
  for (const item of powerData.itemTiers) {
    const tierIndex = ITEM_TIER_INDEX[item.tier];
    const tierConfig = ITEM_TIER_CONFIG[item.tier];
    itemPower += POWER_WEIGHTS.itemTierBase * (tierIndex + 1) * tierConfig.effectMultiplier;
  }

  return Math.floor(fortressPower + heroPower + turretPower + itemPower);
}

// ============================================================================
// POWER DISPLAY HELPERS
// ============================================================================

/**
 * Formatuje Power do wyświetlenia (np. 1,234 lub 1.2K)
 */
export function formatPower(power: number): string {
  if (power >= 1_000_000) {
    return `${(power / 1_000_000).toFixed(1)}M`;
  }
  if (power >= 1_000) {
    return `${(power / 1_000).toFixed(1)}K`;
  }
  return power.toLocaleString();
}

/**
 * Zwraca kolor na podstawie Power (dla gradient display)
 */
export function getPowerColor(power: number): number {
  if (power >= 10000) return 0xff8000; // Orange (legendary)
  if (power >= 5000) return 0xa335ee; // Purple (epic)
  if (power >= 2000) return 0x0070dd; // Blue (rare)
  if (power >= 500) return 0x1eff00; // Green (uncommon)
  return 0x9d9d9d; // Gray (common)
}
