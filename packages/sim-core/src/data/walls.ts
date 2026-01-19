/**
 * Wall/Barrier Definitions
 *
 * Defines different wall types that can be placed to slow/block enemies.
 */

import type { WallType } from '../types.js';

// ============================================================================
// WALL DEFINITION INTERFACE
// ============================================================================

export interface WallDefinition {
  type: WallType;
  name: string;
  description: string;
  /** Base HP */
  baseHp: number;
  /** Wall width in game units */
  width: number;
  /** Wall height in game units */
  height: number;
  /** Gold cost to place */
  goldCost: number;
  /** Slow effect on enemies (0-1, 0.5 = 50% slow) */
  slowPercent: number;
  /** If true, allows friendly units to pass through */
  allowsFriendlies: boolean;
  /** Visual color */
  color: number;
}

// ============================================================================
// WALL DEFINITIONS
// ============================================================================

export const WALL_DEFINITIONS: Record<WallType, WallDefinition> = {
  basic: {
    type: 'basic',
    name: 'Pole Siłowe',
    description: 'Podstawowa bariera energetyczna, spowalnia wrogów o 50%',
    baseHp: 100,
    width: 2,
    height: 3,
    goldCost: 50,
    slowPercent: 0.50,
    allowsFriendlies: false,
    color: 0x00ccff, // Cyan energy
  },
  reinforced: {
    type: 'reinforced',
    name: 'Tarcza Plazmowa',
    description: 'Wzmocniona bariera z 3x HP, spowalnia o 75%',
    baseHp: 300,
    width: 2,
    height: 3,
    goldCost: 150,
    slowPercent: 0.75,
    allowsFriendlies: false,
    color: 0xff00ff, // Magenta plasma
  },
  gate: {
    type: 'gate',
    name: 'Brama Fazowa',
    description: 'Przepuszcza sojuszników, blokuje wrogów',
    baseHp: 150,
    width: 2,
    height: 3,
    goldCost: 100,
    slowPercent: 0.25,
    allowsFriendlies: true,
    color: 0x00ff88, // Green phase
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get wall definition by type
 */
export function getWallDefinition(type: WallType): WallDefinition {
  return WALL_DEFINITIONS[type];
}

/**
 * Get all wall types
 */
export function getAllWallTypes(): WallType[] {
  return Object.keys(WALL_DEFINITIONS) as WallType[];
}

/**
 * Check if player can afford a wall
 */
export function canAffordWall(type: WallType, gold: number): boolean {
  const def = WALL_DEFINITIONS[type];
  return gold >= def.goldCost;
}
