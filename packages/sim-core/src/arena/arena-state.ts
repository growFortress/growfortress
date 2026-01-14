/**
 * Arena PvP State Types and Initialization
 *
 * Defines the state structure for 1v1 arena battles where two fortresses
 * fight each other with their heroes and turrets.
 */

import { Xorshift32 } from '../rng.js';
import { FP } from '../fixed.js';
import type {
  FortressClass,
  ActiveHero,
  ActiveProjectile,
  ModifierSet,
} from '../types.js';
import { DEFAULT_MODIFIERS } from '../data/relics.js';
import { initializeHeroes } from '../systems.js';
import {
  calculateTotalHpBonus,
  calculateTotalDamageBonus,
  getMaxHeroSlots,
} from '../data/fortress-progression.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Fortress state in arena
 */
export interface ArenaFortress {
  hp: number;
  maxHp: number;
  class: FortressClass;
  damage: number;
  lastAttackTick: number;
  /** Position on the field (fixed-point) */
  x: number;
  y: number;
}

/**
 * One side of the arena (left or right)
 */
export interface ArenaSide {
  ownerId: string;
  ownerName: string;
  fortress: ArenaFortress;
  heroes: ActiveHero[];
  projectiles: ActiveProjectile[];
  /** Computed modifiers for this side */
  modifiers: ModifierSet;
  /** Stats tracked during battle */
  stats: ArenaStats;
}

/**
 * Statistics for one side during battle
 */
export interface ArenaStats {
  damageDealt: number;
  damageReceived: number;
  heroesKilled: number;
  heroesLost: number;
}

/**
 * Win reason
 */
export type ArenaWinReason = 'fortress_destroyed' | 'timeout' | 'draw';

/**
 * Main arena state
 */
export interface ArenaState {
  mode: 'pvp_arena';
  tick: number;
  maxTicks: number; // Safety timeout (e.g., 18000 = 10 minutes at 30Hz)

  /** RNG state for determinism */
  rngState: number;

  /** Left side (challenger) */
  left: ArenaSide;

  /** Right side (challenged) */
  right: ArenaSide;

  /** Battle result */
  winner: 'left' | 'right' | null;
  winReason: ArenaWinReason | null;
  ended: boolean;
}

/**
 * Configuration for one player's build
 */
export interface ArenaBuildConfig {
  ownerId: string;
  ownerName: string;
  fortressClass: FortressClass;
  commanderLevel: number;
  /** Hero definition IDs */
  heroIds: string[];
  /** Power upgrade bonuses (additive bonuses, e.g., 0.2 = +20%) */
  damageBonus?: number;
  hpBonus?: number;
}

/**
 * Arena simulation configuration
 */
export interface ArenaConfig {
  tickHz: number;
  maxTicks: number; // Safety timeout
  fieldWidth: number; // Fixed-point
  fieldHeight: number; // Fixed-point
  fortressBaseHp: number;
  fortressBaseDamage: number;
  fortressAttackInterval: number;
  /** Distance between fortresses (each fortress is this far from center) */
  fortressDistanceFromCenter: number; // Fixed-point
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default arena configuration */
export const DEFAULT_ARENA_CONFIG: ArenaConfig = {
  tickHz: 30,
  maxTicks: 18000, // 10 minutes at 30Hz
  fieldWidth: FP.fromInt(20), // Compact arena
  fieldHeight: FP.fromInt(15),
  fortressBaseHp: 1000, // High HP for longer battles
  fortressBaseDamage: 15,
  fortressAttackInterval: 15, // 0.5 seconds at 30Hz
  fortressDistanceFromCenter: FP.fromInt(6), // 6 units from center, 12 total distance
};

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Create initial state for one side of the arena
 */
function createArenaSide(
  build: ArenaBuildConfig,
  side: 'left' | 'right',
  fortressX: number,
  config: ArenaConfig
): ArenaSide {
  // Calculate HP with commander level bonus
  const hpBonusFP = calculateTotalHpBonus(build.commanderLevel);
  const baseMaxHp = Math.floor((config.fortressBaseHp * hpBonusFP) / 16384);
  const maxHp = build.hpBonus
    ? Math.floor(baseMaxHp * (1 + build.hpBonus))
    : baseMaxHp;

  // Calculate damage with commander level bonus
  const damageBonus = calculateTotalDamageBonus(build.commanderLevel);
  const baseDamage = Math.floor((config.fortressBaseDamage * damageBonus) / 16384);

  // Initialize heroes - position them near their fortress
  const heroSpawnX = side === 'left'
    ? FP.add(fortressX, FP.fromInt(3)) // 3 units right of left fortress
    : FP.sub(fortressX, FP.fromInt(3)); // 3 units left of right fortress

  const maxHeroSlots = getMaxHeroSlots(build.commanderLevel);
  const heroes = initializeHeroes(build.heroIds.slice(0, maxHeroSlots), heroSpawnX);

  // Flip hero facing direction for right side
  if (side === 'right') {
    for (const hero of heroes) {
      // Flip velocity direction (heroes should move towards enemy)
      hero.vx = FP.mul(hero.vx, FP.fromInt(-1));
    }
  }

  // Build modifiers
  const modifiers: ModifierSet = { ...DEFAULT_MODIFIERS };
  if (build.damageBonus) {
    modifiers.damageBonus += build.damageBonus;
  }

  return {
    ownerId: build.ownerId,
    ownerName: build.ownerName,
    fortress: {
      hp: maxHp,
      maxHp,
      class: build.fortressClass,
      damage: baseDamage,
      lastAttackTick: 0,
      x: fortressX,
      y: FP.fromInt(7), // Center Y
    },
    heroes,
    projectiles: [],
    modifiers,
    stats: {
      damageDealt: 0,
      damageReceived: 0,
      heroesKilled: 0,
      heroesLost: 0,
    },
  };
}

/**
 * Create initial arena state for a PvP battle
 */
export function createArenaState(
  seed: number,
  leftBuild: ArenaBuildConfig,
  rightBuild: ArenaBuildConfig,
  config: ArenaConfig = DEFAULT_ARENA_CONFIG
): ArenaState {
  const rng = new Xorshift32(seed);

  // Calculate fortress positions (symmetric around center)
  const centerX = FP.div(config.fieldWidth, FP.fromInt(2));
  const leftFortressX = FP.sub(centerX, config.fortressDistanceFromCenter);
  const rightFortressX = FP.add(centerX, config.fortressDistanceFromCenter);

  return {
    mode: 'pvp_arena',
    tick: 0,
    maxTicks: config.maxTicks,
    rngState: rng.getState(),
    left: createArenaSide(leftBuild, 'left', leftFortressX, config),
    right: createArenaSide(rightBuild, 'right', rightFortressX, config),
    winner: null,
    winReason: null,
    ended: false,
  };
}

/**
 * Get the enemy side for a given side
 */
export function getEnemySide(state: ArenaState, side: 'left' | 'right'): ArenaSide {
  return side === 'left' ? state.right : state.left;
}

/**
 * Get own side
 */
export function getOwnSide(state: ArenaState, side: 'left' | 'right'): ArenaSide {
  return side === 'left' ? state.left : state.right;
}
