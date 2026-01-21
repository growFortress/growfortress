/**
 * Game Systems Constants
 *
 * Shared constants used across all game systems.
 * This module has no internal dependencies.
 */

import { FP } from '../fixed.js';

// ============================================================================
// ATTACK & DAMAGE CONSTANTS
// ============================================================================

/** Distance at which heroes start attacking */
export const HERO_ATTACK_RANGE_BASE = FP.fromInt(3);

/** Fixed-point base (16384 = 1.0) */
export const FP_BASE = 16384;

/** Ticks between hero attacks at base speed */
export const HERO_BASE_ATTACK_INTERVAL = 24;

/** Turret base attack interval multiplier */
export const TURRET_ATTACK_INTERVAL_BASE = 30;

/** Projectile base speed (units per tick) - 1.0 = travels 30 units/sec at 30Hz */
export const PROJECTILE_BASE_SPEED = FP.fromFloat(1.0);

/** Pierce collision radius - how close projectile must be to hit an enemy */
export const PIERCE_HIT_RADIUS = FP.fromFloat(0.8);

/** Damage multiplier for pierced enemies (not the main target) */
export const PIERCE_DAMAGE_MULTIPLIER = 0.6;

/** Ticks for hit flash effect */
export const HIT_FLASH_TICKS = 3;

// ============================================================================
// PHYSICS CONSTANTS
// ============================================================================

/** Arrival radius for steering (when to slow down) - must be smaller than attack range */
export const HERO_ARRIVAL_RADIUS = FP.fromFloat(1.5);

/** Preferred combat distance from enemies (as percentage of attack range) - prevents models from overlapping */
export const HERO_PREFERRED_COMBAT_DISTANCE_RATIO = FP.fromFloat(0.75); // 75% of attack range

/** Separation radius between heroes */
export const HERO_SEPARATION_RADIUS = FP.fromFloat(2.5);

/** Separation force strength */
export const HERO_SEPARATION_FORCE = FP.fromFloat(0.2);

/** Default duration for status effects (in ticks, ~5 seconds at 30Hz) */
export const DEFAULT_EFFECT_DURATION = 150;
