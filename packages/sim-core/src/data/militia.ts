/**
 * Militia/Guards Definitions
 *
 * Temporary friendly units spawned by fortress abilities.
 */

import type { MilitiaType } from '../types.js';

// ============================================================================
// MILITIA DEFINITION INTERFACE
// ============================================================================

export type MilitiaRole = 'melee' | 'ranged' | 'tank';

export interface MilitiaDefinition {
  type: MilitiaType;
  name: string;
  description: string;
  role: MilitiaRole;
  /** Base HP */
  baseHp: number;
  /** Base damage per attack */
  baseDamage: number;
  /** Movement speed in units/tick */
  baseSpeed: number;
  /** Attack range in game units */
  attackRange: number;
  /** Ticks between attacks */
  attackInterval: number;
  /** Duration in ticks before despawn */
  duration: number;
  /** Collision radius in game units */
  radius: number;
  /** Gold cost to spawn */
  goldCost: number;
  /** Visual color */
  color: number;
  /** Secondary visual color */
  secondaryColor: number;
}

// ============================================================================
// MILITIA DEFINITIONS
// ============================================================================

export const MILITIA_DEFINITIONS: Record<MilitiaType, MilitiaDefinition> = {
  infantry: {
    type: 'infantry',
    name: 'Dron Bojowy',
    description: 'Dron szturmowy blokujący natarcie wroga',
    role: 'melee',
    baseHp: 50,
    baseDamage: 20,      // Increased from 15
    baseSpeed: 0.35,     // Reduced from 0.5 (30% slower for balance)
    attackRange: 1.5,
    attackInterval: 45,  // 1.5 seconds
    duration: 300,       // 10 seconds
    radius: 0.5,
    goldCost: 10,
    color: 0x00ccff,     // Cyan
    secondaryColor: 0x0088cc,
  },
  archer: {
    type: 'archer',
    name: 'Dron Snajper',
    description: 'Dron dalekiego zasięgu z laserem',
    role: 'ranged',
    baseHp: 30,
    baseDamage: 28,      // Increased from 20
    baseSpeed: 0.35,     // Reduced from 0.5 (30% slower for balance)
    attackRange: 8,
    attackInterval: 60,  // 2 seconds
    duration: 300,       // 10 seconds
    radius: 0.4,
    goldCost: 15,
    color: 0xff6600,     // Orange
    secondaryColor: 0xffcc00,
  },
  shield_bearer: {
    type: 'shield_bearer',
    name: 'Ciężki Mech',
    description: 'Opancerzony mech z tarczą energetyczną',
    role: 'tank',
    baseHp: 100,
    baseDamage: 10,      // Increased from 5
    baseSpeed: 0.35,     // Reduced from 0.5 (30% slower for balance)
    attackRange: 1.5,
    attackInterval: 90,  // 3 seconds
    duration: 450,       // 15 seconds
    radius: 0.6,
    goldCost: 20,
    color: 0x8800ff,     // Purple
    secondaryColor: 0xcc88ff,
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get militia definition by type
 */
export function getMilitiaDefinition(type: MilitiaType): MilitiaDefinition {
  return MILITIA_DEFINITIONS[type];
}

/**
 * Get all militia types
 */
export function getAllMilitiaTypes(): MilitiaType[] {
  return Object.keys(MILITIA_DEFINITIONS) as MilitiaType[];
}
