/**
 * Apply Power Upgrades System
 *
 * Applies permanent power upgrades to game modifiers during simulation.
 * These bonuses stack multiplicatively with other modifiers (relics, class, etc.)
 */

import type { ModifierSet } from '../types.js';
import type { PlayerPowerData, StatUpgrades } from '../data/power-upgrades.js';
import {
  FORTRESS_STAT_UPGRADES,
  HERO_STAT_UPGRADES,
  TURRET_STAT_UPGRADES,
  getStatMultiplier,
} from '../data/power-config.js';

// ============================================================================
// MODIFIER APPLICATION
// ============================================================================

/**
 * Apply fortress power upgrades to base modifiers
 * Returns a new ModifierSet with power upgrade bonuses applied (additive system)
 */
export function applyFortressPowerUpgrades(
  baseModifiers: ModifierSet,
  fortressUpgrades: StatUpgrades
): ModifierSet {
  const mods = { ...baseModifiers };

  // Apply each fortress upgrade (convert multipliers to additive bonuses)
  for (const config of FORTRESS_STAT_UPGRADES) {
    const level = fortressUpgrades[config.stat] || 0;
    if (level <= 0) continue;

    const multiplier = getStatMultiplier(config, level);
    // Convert multiplier to bonus: 1.1 -> 0.1
    const bonus = multiplier - 1;

    switch (config.stat) {
      case 'hp':
        mods.maxHpBonus += bonus;
        break;
      case 'damage':
        mods.damageBonus += bonus;
        break;
      case 'attackSpeed':
        mods.attackSpeedBonus += bonus;
        break;
      case 'critChance':
        // Additive for crit chance (cap handled in computeModifiers)
        mods.critChance += level * config.bonusPerLevel;
        break;
      case 'critMultiplier':
        // Additive for crit damage bonus
        mods.critDamageBonus += level * config.bonusPerLevel;
        break;
      case 'armor':
        // Armor reduces damage taken - we now use incomingDamageReduction
        // Positive reduction = less damage taken
        mods.incomingDamageReduction += bonus;
        break;
    }
  }

  return mods;
}

/**
 * Calculate hero stat multipliers from power upgrades
 * Returns multipliers to apply to hero base stats
 */
export function getHeroPowerMultipliers(
  powerData: PlayerPowerData,
  heroId: string
): {
  hpMultiplier: number;
  damageMultiplier: number;
  attackSpeedMultiplier: number;
  critChanceBonus: number;
  critDamageBonus: number;
} {
  const heroUpgrade = powerData.heroUpgrades.find(h => h.heroId === heroId);
  const upgrades = heroUpgrade?.statUpgrades || {
    hp: 0,
    damage: 0,
    attackSpeed: 0,
    range: 0,
    critChance: 0,
    critMultiplier: 0,
    armor: 0,
    dodge: 0,
  };

  let hpMultiplier = 1.0;
  let damageMultiplier = 1.0;
  let attackSpeedMultiplier = 1.0;
  let critChanceBonus = 0;
  let critDamageBonus = 0;

  for (const config of HERO_STAT_UPGRADES) {
    const level = upgrades[config.stat] || 0;
    if (level <= 0) continue;

    const multiplier = getStatMultiplier(config, level);

    switch (config.stat) {
      case 'hp':
        hpMultiplier *= multiplier;
        break;
      case 'damage':
        damageMultiplier *= multiplier;
        break;
      case 'attackSpeed':
        attackSpeedMultiplier *= multiplier;
        break;
      case 'critChance':
        critChanceBonus += level * config.bonusPerLevel;
        break;
      case 'critMultiplier':
        critDamageBonus += level * config.bonusPerLevel;
        break;
    }
  }

  return {
    hpMultiplier,
    damageMultiplier,
    attackSpeedMultiplier,
    critChanceBonus: Math.min(critChanceBonus, 0.5), // Cap at 50% bonus
    critDamageBonus,
  };
}

/**
 * Calculate turret stat multipliers from power upgrades
 * Returns multipliers to apply to turret base stats
 */
export function getTurretPowerMultipliers(
  powerData: PlayerPowerData,
  turretType: string
): {
  damageMultiplier: number;
  attackSpeedMultiplier: number;
  rangeMultiplier: number;
  critChanceBonus: number;
} {
  const turretUpgrade = powerData.turretUpgrades.find(t => t.turretType === turretType);
  const upgrades = turretUpgrade?.statUpgrades || {
    hp: 0,
    damage: 0,
    attackSpeed: 0,
    range: 0,
    critChance: 0,
    critMultiplier: 0,
    armor: 0,
    dodge: 0,
  };

  let damageMultiplier = 1.0;
  let attackSpeedMultiplier = 1.0;
  let rangeMultiplier = 1.0;
  let critChanceBonus = 0;

  for (const config of TURRET_STAT_UPGRADES) {
    const level = upgrades[config.stat] || 0;
    if (level <= 0) continue;

    const multiplier = getStatMultiplier(config, level);

    switch (config.stat) {
      case 'damage':
        damageMultiplier *= multiplier;
        break;
      case 'attackSpeed':
        attackSpeedMultiplier *= multiplier;
        break;
      case 'range':
        rangeMultiplier *= multiplier;
        break;
      case 'critChance':
        critChanceBonus += level * config.bonusPerLevel;
        break;
    }
  }

  return {
    damageMultiplier,
    attackSpeedMultiplier,
    rangeMultiplier,
    critChanceBonus: Math.min(critChanceBonus, 0.3), // Cap at 30% bonus
  };
}

// ============================================================================
// ITEM TIER BONUSES
// ============================================================================

import { ITEM_TIER_CONFIG } from '../data/power-config.js';
import type { ItemTier } from '../data/power-upgrades.js';

/**
 * Get item effect multiplier based on tier
 */
export function getItemEffectMultiplier(tier: ItemTier): number {
  return ITEM_TIER_CONFIG[tier].effectMultiplier;
}

/**
 * Get item tier from power data
 */
export function getItemTierFromPowerData(
  powerData: PlayerPowerData,
  itemId: string
): ItemTier {
  const itemTier = powerData.itemTiers.find(i => i.itemId === itemId);
  return itemTier?.tier || 'common';
}

// ============================================================================
// FULL POWER APPLICATION
// ============================================================================

/**
 * Apply all power upgrades to modifiers
 * Use this when initializing a game session
 */
export function applyAllPowerUpgrades(
  baseModifiers: ModifierSet,
  powerData: PlayerPowerData
): ModifierSet {
  // Apply fortress upgrades to base modifiers
  return applyFortressPowerUpgrades(
    baseModifiers,
    powerData.fortressUpgrades.statUpgrades
  );
}

/**
 * Check if player has any power upgrades
 */
export function hasAnyPowerUpgrades(powerData: PlayerPowerData): boolean {
  // Check fortress upgrades
  const fortressStats = powerData.fortressUpgrades.statUpgrades;
  for (const key of Object.keys(fortressStats) as (keyof StatUpgrades)[]) {
    if (fortressStats[key] > 0) return true;
  }

  // Check hero upgrades
  if (powerData.heroUpgrades.length > 0) {
    for (const hero of powerData.heroUpgrades) {
      for (const key of Object.keys(hero.statUpgrades) as (keyof StatUpgrades)[]) {
        if (hero.statUpgrades[key] > 0) return true;
      }
    }
  }

  // Check turret upgrades
  if (powerData.turretUpgrades.length > 0) {
    for (const turret of powerData.turretUpgrades) {
      for (const key of Object.keys(turret.statUpgrades) as (keyof StatUpgrades)[]) {
        if (turret.statUpgrades[key] > 0) return true;
      }
    }
  }

  // Check item tiers
  if (powerData.itemTiers.length > 0) {
    for (const item of powerData.itemTiers) {
      if (item.tier !== 'common') return true;
    }
  }

  return false;
}

/**
 * Calculate total upgrade investment (for debugging/analytics)
 */
export function calculateTotalUpgradeInvestment(powerData: PlayerPowerData): {
  totalFortressLevels: number;
  totalHeroLevels: number;
  totalTurretLevels: number;
  totalItemTiers: number;
} {
  let totalFortressLevels = 0;
  let totalHeroLevels = 0;
  let totalTurretLevels = 0;
  let totalItemTiers = 0;

  // Sum fortress levels
  const fortressStats = powerData.fortressUpgrades.statUpgrades;
  for (const key of Object.keys(fortressStats) as (keyof StatUpgrades)[]) {
    totalFortressLevels += fortressStats[key];
  }

  // Sum hero levels
  for (const hero of powerData.heroUpgrades) {
    for (const key of Object.keys(hero.statUpgrades) as (keyof StatUpgrades)[]) {
      totalHeroLevels += hero.statUpgrades[key];
    }
  }

  // Sum turret levels
  for (const turret of powerData.turretUpgrades) {
    for (const key of Object.keys(turret.statUpgrades) as (keyof StatUpgrades)[]) {
      totalTurretLevels += turret.statUpgrades[key];
    }
  }

  // Sum item tier indices
  const tierValues: Record<ItemTier, number> = {
    common: 0,
    uncommon: 1,
    rare: 2,
    epic: 3,
    legendary: 4,
  };
  for (const item of powerData.itemTiers) {
    totalItemTiers += tierValues[item.tier];
  }

  return {
    totalFortressLevels,
    totalHeroLevels,
    totalTurretLevels,
    totalItemTiers,
  };
}
