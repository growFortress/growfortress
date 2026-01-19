/**
 * Turret Upgrade Paths (Specialization Branches)
 *
 * Each turret type has 3 upgrade paths (A, B, C) that provide different bonuses.
 * Players choose one path per turret for specialized builds.
 */

import type { TurretUpgradePath, FP } from '../types.js';
import type { TurretType } from './turrets.js';

// ============================================================================
// INTERFACES
// ============================================================================

export interface TurretUpgradePathDefinition {
  turretType: TurretType;
  path: TurretUpgradePath;
  name: string;
  description: string;
  /** Stat modifiers (FP 16384 = 1.0) */
  modifiers: {
    damageMultiplier?: FP;
    attackSpeedMultiplier?: FP;
    rangeMultiplier?: FP;
    critChanceBonus?: number;      // Additive (0.1 = +10%)
    critDamageBonus?: number;      // Additive (0.5 = +50%)
    splashRadiusBonus?: FP;
    chainTargetsBonus?: number;    // Additional chain targets
    slowDurationBonus?: number;    // Additional slow duration in ticks
  };
  /** Minimum tier required to unlock this path */
  unlockedAtTier: 1 | 2 | 3;
  /** Visual indicator color */
  color: number;
}

// ============================================================================
// RAILGUN UPGRADE PATHS
// ============================================================================

const RAILGUN_UPGRADES: TurretUpgradePathDefinition[] = [
  {
    turretType: 'railgun',
    path: 'A',
    name: 'Sniper',
    description: '+50% range, +25% crit damage - Long-range precision strikes',
    modifiers: {
      rangeMultiplier: 24576 as FP, // 1.5
      critDamageBonus: 0.25,
    },
    unlockedAtTier: 2,
    color: 0x4a90d9,
  },
  {
    turretType: 'railgun',
    path: 'B',
    name: 'Overcharge',
    description: '+40% damage, -15% attack speed - High damage per shot',
    modifiers: {
      damageMultiplier: 22938 as FP, // 1.4
      attackSpeedMultiplier: 13926 as FP, // 0.85
    },
    unlockedAtTier: 2,
    color: 0xff6b35,
  },
  {
    turretType: 'railgun',
    path: 'C',
    name: 'Rapid Fire',
    description: '+60% attack speed, -20% damage - High rate of fire',
    modifiers: {
      attackSpeedMultiplier: 26214 as FP, // 1.6
      damageMultiplier: 13107 as FP, // 0.8
    },
    unlockedAtTier: 2,
    color: 0x7ed321,
  },
];

// ============================================================================
// CRYO UPGRADE PATHS
// ============================================================================

const CRYO_UPGRADES: TurretUpgradePathDefinition[] = [
  {
    turretType: 'cryo',
    path: 'A',
    name: 'Deep Freeze',
    description: '+100% slow duration, +10% damage - Extended crowd control',
    modifiers: {
      slowDurationBonus: 60, // +2 seconds at 30Hz
      damageMultiplier: 18022 as FP, // 1.1
    },
    unlockedAtTier: 2,
    color: 0x00bfff,
  },
  {
    turretType: 'cryo',
    path: 'B',
    name: 'Frostbite',
    description: '+30% damage, enemies take +15% more damage while slowed',
    modifiers: {
      damageMultiplier: 21299 as FP, // 1.3
    },
    unlockedAtTier: 2,
    color: 0x1e90ff,
  },
  {
    turretType: 'cryo',
    path: 'C',
    name: 'Blizzard',
    description: '+30% attack speed, larger slow area effect',
    modifiers: {
      attackSpeedMultiplier: 21299 as FP, // 1.3
      splashRadiusBonus: 8192 as FP, // +0.5 units
    },
    unlockedAtTier: 2,
    color: 0x87ceeb,
  },
];

// ============================================================================
// ARTILLERY UPGRADE PATHS
// ============================================================================

const ARTILLERY_UPGRADES: TurretUpgradePathDefinition[] = [
  {
    turretType: 'artillery',
    path: 'A',
    name: 'Siege Cannon',
    description: '+50% damage, +20% splash radius - Devastating explosions',
    modifiers: {
      damageMultiplier: 24576 as FP, // 1.5
      splashRadiusBonus: 13107 as FP, // +0.8 units
    },
    unlockedAtTier: 2,
    color: 0xdc143c,
  },
  {
    turretType: 'artillery',
    path: 'B',
    name: 'Cluster Bomb',
    description: '+80% splash radius, -10% damage - Maximum area coverage',
    modifiers: {
      splashRadiusBonus: 19660 as FP, // +1.2 units
      damageMultiplier: 14745 as FP, // 0.9
    },
    unlockedAtTier: 2,
    color: 0xff8c00,
  },
  {
    turretType: 'artillery',
    path: 'C',
    name: 'Rapid Artillery',
    description: '+40% attack speed, +20% range - Faster bombardment',
    modifiers: {
      attackSpeedMultiplier: 22938 as FP, // 1.4
      rangeMultiplier: 19660 as FP, // 1.2
    },
    unlockedAtTier: 2,
    color: 0xffd700,
  },
];

// ============================================================================
// ARC UPGRADE PATHS
// ============================================================================

const ARC_UPGRADES: TurretUpgradePathDefinition[] = [
  {
    turretType: 'arc',
    path: 'A',
    name: 'Chain Master',
    description: '+2 chain targets, +10% chain damage retention',
    modifiers: {
      chainTargetsBonus: 2,
      damageMultiplier: 18022 as FP, // 1.1
    },
    unlockedAtTier: 2,
    color: 0x9b59b6,
  },
  {
    turretType: 'arc',
    path: 'B',
    name: 'High Voltage',
    description: '+35% damage, 15% chance to stun chained enemies',
    modifiers: {
      damageMultiplier: 22118 as FP, // 1.35
    },
    unlockedAtTier: 2,
    color: 0xe74c3c,
  },
  {
    turretType: 'arc',
    path: 'C',
    name: 'Tesla Coil',
    description: '+25% range, +30% attack speed - Rapid chain attacks',
    modifiers: {
      rangeMultiplier: 20480 as FP, // 1.25
      attackSpeedMultiplier: 21299 as FP, // 1.3
    },
    unlockedAtTier: 2,
    color: 0x3498db,
  },
];

// ============================================================================
// COMBINED DEFINITIONS
// ============================================================================

export const TURRET_UPGRADE_PATHS: TurretUpgradePathDefinition[] = [
  ...RAILGUN_UPGRADES,
  ...CRYO_UPGRADES,
  ...ARTILLERY_UPGRADES,
  ...ARC_UPGRADES,
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get upgrade path definition for a turret type and path
 */
export function getTurretUpgradePath(
  turretType: TurretType,
  path: TurretUpgradePath
): TurretUpgradePathDefinition | undefined {
  return TURRET_UPGRADE_PATHS.find(
    u => u.turretType === turretType && u.path === path
  );
}

/**
 * Get all upgrade paths for a turret type
 */
export function getTurretUpgradePaths(
  turretType: TurretType
): TurretUpgradePathDefinition[] {
  return TURRET_UPGRADE_PATHS.filter(u => u.turretType === turretType);
}

/**
 * Check if an upgrade path is unlocked based on turret tier
 */
export function isUpgradePathUnlocked(
  turretType: TurretType,
  path: TurretUpgradePath,
  currentTier: 1 | 2 | 3
): boolean {
  const upgrade = getTurretUpgradePath(turretType, path);
  if (!upgrade) return false;
  return currentTier >= upgrade.unlockedAtTier;
}

/**
 * Apply upgrade path modifiers to base stats
 * Returns modified stats object
 */
export function applyUpgradePathModifiers(
  baseStats: {
    damage: FP;
    attackSpeed: FP;
    range: FP;
    critChance: FP;
    critMultiplier: FP;
  },
  turretType: TurretType,
  path: TurretUpgradePath | undefined
): typeof baseStats {
  if (!path) return baseStats;

  const upgrade = getTurretUpgradePath(turretType, path);
  if (!upgrade) return baseStats;

  const { modifiers } = upgrade;

  return {
    damage: modifiers.damageMultiplier
      ? ((baseStats.damage * modifiers.damageMultiplier) / 16384) as FP
      : baseStats.damage,
    attackSpeed: modifiers.attackSpeedMultiplier
      ? ((baseStats.attackSpeed * modifiers.attackSpeedMultiplier) / 16384) as FP
      : baseStats.attackSpeed,
    range: modifiers.rangeMultiplier
      ? ((baseStats.range * modifiers.rangeMultiplier) / 16384) as FP
      : baseStats.range,
    critChance: modifiers.critChanceBonus
      ? (baseStats.critChance + (modifiers.critChanceBonus * 16384)) as FP
      : baseStats.critChance,
    critMultiplier: modifiers.critDamageBonus
      ? (baseStats.critMultiplier + (modifiers.critDamageBonus * 16384)) as FP
      : baseStats.critMultiplier,
  };
}
