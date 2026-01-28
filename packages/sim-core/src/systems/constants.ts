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

/** Ticks between hero attacks at base speed (lower = faster shooting) */
export const HERO_BASE_ATTACK_INTERVAL = 15;

/** Turret base attack interval multiplier */
export const TURRET_ATTACK_INTERVAL_BASE = 30;

/** Projectile base speed (units per tick) - 0.6 = travels 18 units/sec at 30Hz (slower for visibility) */
export const PROJECTILE_BASE_SPEED = FP.fromFloat(0.6);

/** Minimum projectile lifetime in ticks - ensures projectiles are visible even at close range */
export const PROJECTILE_MIN_LIFETIME = 8;

/** Pierce collision radius - how close projectile must be to hit an enemy */
export const PIERCE_HIT_RADIUS = FP.fromFloat(0.8);

/** Damage multiplier for pierced enemies (not the main target) */
export const PIERCE_DAMAGE_MULTIPLIER = 0.6;

/** Pierce damage falloff - each subsequent pierce does less damage */
export const PIERCE_DAMAGE_FALLOFF = 0.75; // Each pierce after first does 75% of previous

/** Ticks for hit flash effect */
export const HIT_FLASH_TICKS = 3;

// ============================================================================
// FORTRESS ATTACK CONSTANTS
// ============================================================================

/** Minimum ticks between fortress attacks (prevents extreme fire rates) */
export const MIN_FORTRESS_ATTACK_INTERVAL = 5;

/** Maximum attack speed multiplier for fortress */
export const MAX_FORTRESS_ATTACK_SPEED = 4.0;

/** Fortress base damage (pre-scaling) */
export const FORTRESS_BASE_DAMAGE = 12;

/** Fortress base attack interval in ticks */
export const FORTRESS_BASE_ATTACK_INTERVAL = 18;

// ============================================================================
// CLASS-SPECIFIC PROJECTILE MODIFIERS
// ============================================================================

/** Projectile speed multipliers by fortress class */
export const PROJECTILE_CLASS_SPEED: Record<string, number> = {
  natural: 1.0,    // Base speed - balanced
  ice: 0.85,       // Slower, frosty projectiles
  fire: 1.15,      // Fast, aggressive
  lightning: 1.4,  // Fastest - energy-based
  tech: 1.25,      // Precise, efficient
  void: 1.0,       // Mysterious, consistent
  plasma: 1.3,     // High energy
};

/** Fortress damage multipliers by class */
export const FORTRESS_CLASS_DAMAGE: Record<string, number> = {
  natural: 1.0,    // Balanced
  ice: 0.9,        // Lower direct damage, but slows
  fire: 1.15,      // High burst damage
  lightning: 1.0,  // Chain damage compensates
  tech: 1.1,       // Efficient damage
  void: 1.2,       // High damage, mysterious
  plasma: 1.05,    // Slightly boosted
};

/** Pierce count by class */
export const FORTRESS_CLASS_PIERCE: Record<string, number> = {
  natural: 2,      // Standard
  ice: 1,          // Low pierce, high CC
  fire: 2,         // Standard
  lightning: 3,    // High pierce (chain potential)
  tech: 4,         // Highest pierce
  void: 2,         // Standard
  plasma: 3,       // Good pierce
};

// ============================================================================
// PROJECTILE PHYSICS - TRAJECTORIES, HOMING, HIT RADIUS
// ============================================================================

/** Trajectory type by class: 'linear' or 'arc' */
export const PROJECTILE_CLASS_TRAJECTORY: Record<string, 'linear' | 'arc'> = {
  natural: 'linear',   // Standard straight shots
  ice: 'linear',       // Icicles fly straight
  fire: 'arc',         // Fireballs arc through the air
  lightning: 'linear', // Bolts are instant/fast
  tech: 'linear',      // Precise railgun shots
  void: 'linear',      // Mysterious but direct
  plasma: 'arc',       // Plasma arcs with energy
};

/** Arc trajectory gravity (units per tick^2, higher = faster drop) */
export const ARC_GRAVITY = FP.fromFloat(0.015);

/** Arc trajectory initial upward velocity multiplier */
export const ARC_LAUNCH_ANGLE = 0.4; // How high to lob (0 = flat, 1 = 45 degrees)

/** Homing strength by class (0 = no tracking, higher = more aggressive) */
export const PROJECTILE_CLASS_HOMING: Record<string, number> = {
  natural: 0,      // No homing
  ice: 0,          // No homing
  fire: 0,         // No homing (arc instead)
  lightning: 0.15, // Slight tracking
  tech: 0.25,      // Good tracking (smart missiles)
  void: 0.1,       // Subtle tracking
  plasma: 0,       // No homing (arc instead)
};

/** Maximum turn rate for homing projectiles (radians per tick) */
export const HOMING_MAX_TURN_RATE = 0.08;

/** Hit radius multiplier by class (affects hitbox size) */
export const PROJECTILE_CLASS_HIT_RADIUS: Record<string, number> = {
  natural: 1.0,    // Standard
  ice: 0.9,        // Slightly smaller (precise icicles)
  fire: 1.4,       // Larger (explosive fireballs)
  lightning: 1.1,  // Slightly larger (energy spread)
  tech: 0.7,       // Small and precise (railgun)
  void: 1.2,       // Medium-large (void energy)
  plasma: 1.5,     // Largest (plasma explosions)
};

/** Base hit radius for projectiles (fixed-point) */
export const PROJECTILE_BASE_HIT_RADIUS = FP.fromFloat(0.3);

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
