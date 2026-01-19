/**
 * Fortress Aura System
 *
 * Passive auras that buff turrets and heroes within range of the fortress.
 * Auras are unlocked based on commander level and fortress class.
 */

import type { FortressClass, ModifierSet, FP } from '../types.js';

// ============================================================================
// INTERFACES
// ============================================================================

export type AuraTargetType = 'turret' | 'hero' | 'both';

export interface FortressAuraDefinition {
  id: string;
  name: string;
  description: string;
  /** Aura radius in game units (FP format) */
  radius: FP;
  /** What entities are affected */
  targetType: AuraTargetType;
  /** Stat modifiers (additive bonuses) */
  modifiers: Partial<ModifierSet>;
  /** Commander level required to unlock */
  unlockedAtLevel: number;
  /** Optional: Only available for specific fortress class */
  fortressClass?: FortressClass;
  /** Visual color for the aura effect */
  color: number;
  /** Visual pulse speed (1.0 = normal) */
  pulseSpeed?: number;
}

// ============================================================================
// UNIVERSAL AURAS (available to all classes)
// ============================================================================

const UNIVERSAL_AURAS: FortressAuraDefinition[] = [
  {
    id: 'commander_presence',
    name: 'Commander Presence',
    description: 'Nearby units gain +10% damage and +5% attack speed',
    radius: 655360 as FP, // 10 units
    targetType: 'both',
    modifiers: {
      damageBonus: 0.10,
      attackSpeedBonus: 0.05,
    },
    unlockedAtLevel: 1,
    color: 0xffd700,
    pulseSpeed: 0.8,
  },
  {
    id: 'defensive_ward',
    name: 'Defensive Ward',
    description: 'Nearby turrets gain +15% HP and +10% armor',
    radius: 524288 as FP, // 8 units
    targetType: 'turret',
    modifiers: {
      maxHpBonus: 0.15,
      incomingDamageReduction: 0.10,
    },
    unlockedAtLevel: 10,
    color: 0x4169e1,
    pulseSpeed: 0.6,
  },
  {
    id: 'battle_momentum',
    name: 'Battle Momentum',
    description: 'Nearby heroes gain +15% attack speed',
    radius: 589824 as FP, // 9 units
    targetType: 'hero',
    modifiers: {
      attackSpeedBonus: 0.15,
    },
    unlockedAtLevel: 15,
    color: 0xff6347,
    pulseSpeed: 1.2,
  },
  {
    id: 'critical_focus',
    name: 'Critical Focus',
    description: 'All nearby units gain +10% crit chance',
    radius: 524288 as FP, // 8 units
    targetType: 'both',
    modifiers: {
      critChance: 0.10,
    },
    unlockedAtLevel: 25,
    color: 0xff1493,
    pulseSpeed: 1.0,
  },
];

// ============================================================================
// CLASS-SPECIFIC AURAS
// ============================================================================

const CLASS_AURAS: FortressAuraDefinition[] = [
  // Fire class
  {
    id: 'burning_aura',
    name: 'Burning Aura',
    description: 'Nearby units deal +20% damage, attacks apply burn DOT',
    radius: 524288 as FP, // 8 units
    targetType: 'both',
    modifiers: {
      damageBonus: 0.20,
    },
    unlockedAtLevel: 20,
    fortressClass: 'fire',
    color: 0xff4500,
    pulseSpeed: 1.5,
  },
  // Ice class
  {
    id: 'frost_aura',
    name: 'Frost Aura',
    description: 'Nearby units gain +25% slow effect duration',
    radius: 524288 as FP, // 8 units
    targetType: 'both',
    modifiers: {
      cooldownReduction: 0.15,
    },
    unlockedAtLevel: 20,
    fortressClass: 'ice',
    color: 0x00ffff,
    pulseSpeed: 0.5,
  },
  // Lightning class
  {
    id: 'storm_aura',
    name: 'Storm Aura',
    description: 'Nearby units gain +30% attack speed',
    radius: 524288 as FP, // 8 units
    targetType: 'both',
    modifiers: {
      attackSpeedBonus: 0.30,
    },
    unlockedAtLevel: 20,
    fortressClass: 'lightning',
    color: 0x9400d3,
    pulseSpeed: 2.0,
  },
  // Tech class
  {
    id: 'tech_aura',
    name: 'Tech Aura',
    description: 'Nearby turrets gain +20% range and +15% damage',
    radius: 589824 as FP, // 9 units
    targetType: 'turret',
    modifiers: {
      damageBonus: 0.15,
    },
    unlockedAtLevel: 20,
    fortressClass: 'tech',
    color: 0x00ff00,
    pulseSpeed: 0.8,
  },
  // Natural class
  {
    id: 'nature_aura',
    name: 'Nature Aura',
    description: 'Nearby heroes gain +20% HP and +10% lifesteal',
    radius: 524288 as FP, // 8 units
    targetType: 'hero',
    modifiers: {
      maxHpBonus: 0.20,
      lifesteal: 0.10,
    },
    unlockedAtLevel: 20,
    fortressClass: 'natural',
    color: 0x32cd32,
    pulseSpeed: 0.7,
  },
  // Void class
  {
    id: 'void_aura',
    name: 'Void Aura',
    description: 'Nearby units gain +25% crit damage and +15% execute threshold',
    radius: 524288 as FP, // 8 units
    targetType: 'both',
    modifiers: {
      critDamageBonus: 0.25,
      executeThreshold: 0.15,
    },
    unlockedAtLevel: 20,
    fortressClass: 'void',
    color: 0x8b008b,
    pulseSpeed: 1.0,
  },
  // Plasma class
  {
    id: 'plasma_aura',
    name: 'Plasma Aura',
    description: 'Nearby units gain +15% damage and +15% pierce chance',
    radius: 524288 as FP, // 8 units
    targetType: 'both',
    modifiers: {
      damageBonus: 0.15,
      pierceCount: 1,
    },
    unlockedAtLevel: 20,
    fortressClass: 'plasma',
    color: 0xff69b4,
    pulseSpeed: 1.3,
  },
];

// ============================================================================
// COMBINED DEFINITIONS
// ============================================================================

export const FORTRESS_AURAS: FortressAuraDefinition[] = [
  ...UNIVERSAL_AURAS,
  ...CLASS_AURAS,
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get all auras available for a fortress class and commander level
 */
export function getAvailableAuras(
  fortressClass: FortressClass,
  commanderLevel: number
): FortressAuraDefinition[] {
  return FORTRESS_AURAS.filter(aura => {
    // Check level requirement
    if (aura.unlockedAtLevel > commanderLevel) return false;
    // Check class requirement (if any)
    if (aura.fortressClass && aura.fortressClass !== fortressClass) return false;
    return true;
  });
}

/**
 * Get a specific aura by ID
 */
export function getAuraById(id: string): FortressAuraDefinition | undefined {
  return FORTRESS_AURAS.find(aura => aura.id === id);
}

/**
 * Get all universal auras
 */
export function getUniversalAuras(): FortressAuraDefinition[] {
  return UNIVERSAL_AURAS;
}

/**
 * Get class-specific aura for a fortress class
 */
export function getClassAura(fortressClass: FortressClass): FortressAuraDefinition | undefined {
  return CLASS_AURAS.find(aura => aura.fortressClass === fortressClass);
}
