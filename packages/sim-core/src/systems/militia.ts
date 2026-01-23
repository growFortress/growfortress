/**
 * Militia System
 *
 * Handles militia unit AI, movement, combat, and lifecycle.
 */

import { FP } from '../fixed.js';
import type { GameState, SimConfig, Militia, MilitiaType, Enemy } from '../types.js';
import { getMilitiaDefinition } from '../data/militia.js';
import { HIT_FLASH_TICKS } from './constants.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const MILITIA_SEPARATION_FORCE = 0.015; // Force to separate overlapping militia
const MILITIA_SEPARATION_RADIUS = FP.fromFloat(1.5); // Radius for separation check
const MILITIA_ACCELERATION = 0.08; // Steering acceleration for smooth movement
const MILITIA_FRICTION = 0.92; // Lower friction for smoother movement (was 0.9)

// ============================================================================
// MILITIA SPAWNING
// ============================================================================

/**
 * Spawn a new militia unit at the specified position
 * Returns null if spawn limits are exceeded
 */
export function spawnMilitia(
  state: GameState,
  type: MilitiaType,
  x: number,
  y: number
): Militia | null {
  // Check if at max militia count
  if (state.militia.length >= state.maxMilitiaCount) {
    return null;
  }

  // Check if this type is on cooldown
  if (state.militiaSpawnCooldowns[type] > state.tick) {
    return null;
  }

  const def = getMilitiaDefinition(type);

  const militia: Militia = {
    id: state.nextMilitiaId++,
    type,
    x,
    y,
    vx: 0,
    vy: 0,
    radius: FP.fromFloat(def.radius),
    mass: FP.fromFloat(1.0),
    currentHp: def.baseHp,
    maxHp: def.baseHp,
    damage: def.baseDamage,
    attackRange: FP.fromFloat(def.attackRange),
    attackInterval: def.attackInterval,
    lastAttackTick: 0,
    spawnTick: state.tick,
    expirationTick: state.tick + def.duration,
    state: 'moving',
    targetEnemyId: null,
  };

  state.militia.push(militia);
  return militia;
}

/**
 * Spawn multiple militia units in a formation
 */
export function spawnMilitiaSquad(
  state: GameState,
  type: MilitiaType,
  centerX: number,
  centerY: number,
  count: number
): Militia[] {
  const spawned: Militia[] = [];
  const spacing = FP.fromFloat(1.5);

  for (let i = 0; i < count; i++) {
    // Spread out in a line
    const offsetX = FP.mul(FP.fromFloat(i - (count - 1) / 2), spacing);
    const x = FP.add(centerX, offsetX);
    const militia = spawnMilitia(state, type, x, centerY);
    // Only add if spawn was successful (not null due to limits)
    if (militia) {
      spawned.push(militia);
    }
  }

  return spawned;
}

// ============================================================================
// MILITIA AI
// ============================================================================

/**
 * Find the nearest enemy to a militia unit
 */
function findNearestEnemy(
  militia: Militia,
  enemies: Enemy[]
): Enemy | null {
  if (enemies.length === 0) return null;

  let nearestEnemy: Enemy | null = null;
  let nearestDistSq = Infinity;

  for (const enemy of enemies) {
    const distSq = FP.distSq(militia.x, militia.y, enemy.x, enemy.y);
    if (distSq < nearestDistSq) {
      nearestDistSq = distSq;
      nearestEnemy = enemy;
    }
  }

  return nearestEnemy;
}

/**
 * Steer militia towards target position (acceleration-based for smooth movement)
 */
function steerTowards(
  militia: Militia,
  targetX: number,
  targetY: number,
  maxSpeed: number
): void {
  const dx = FP.sub(targetX, militia.x);
  const dy = FP.sub(targetY, militia.y);
  const distSq = FP.add(FP.mul(dx, dx), FP.mul(dy, dy));

  if (distSq < FP.fromFloat(0.01)) return; // Already at target

  const dist = Math.sqrt(FP.toFloat(distSq));

  // Calculate desired velocity direction
  const dirX = FP.toFloat(dx) / dist;
  const dirY = FP.toFloat(dy) / dist;

  // Calculate desired velocity
  const desiredVx = dirX * maxSpeed;
  const desiredVy = dirY * maxSpeed;

  // Calculate steering force (difference between desired and current velocity)
  const currentVx = FP.toFloat(militia.vx);
  const currentVy = FP.toFloat(militia.vy);

  const steerX = (desiredVx - currentVx) * MILITIA_ACCELERATION;
  const steerY = (desiredVy - currentVy) * MILITIA_ACCELERATION;

  // Apply steering force to velocity
  militia.vx = FP.add(militia.vx, FP.fromFloat(steerX));
  militia.vy = FP.add(militia.vy, FP.fromFloat(steerY));

  // Clamp to max speed
  const newVx = FP.toFloat(militia.vx);
  const newVy = FP.toFloat(militia.vy);
  const currentSpeed = Math.sqrt(newVx * newVx + newVy * newVy);

  if (currentSpeed > maxSpeed) {
    const scale = maxSpeed / currentSpeed;
    militia.vx = FP.fromFloat(newVx * scale);
    militia.vy = FP.fromFloat(newVy * scale);
  }
}

/**
 * Apply separation force between overlapping militia
 */
function applySeparation(
  militia: Militia,
  allMilitia: Militia[]
): void {
  for (const other of allMilitia) {
    if (other.id === militia.id) continue;

    const dx = FP.sub(militia.x, other.x);
    const dy = FP.sub(militia.y, other.y);
    const distSq = FP.add(FP.mul(dx, dx), FP.mul(dy, dy));
    const sepRadiusSq = FP.mul(MILITIA_SEPARATION_RADIUS, MILITIA_SEPARATION_RADIUS);

    if (distSq < sepRadiusSq && distSq > 0) {
      const dist = Math.sqrt(FP.toFloat(distSq));
      const pushX = FP.mul(FP.div(dx, FP.fromFloat(dist)), FP.fromFloat(MILITIA_SEPARATION_FORCE));
      const pushY = FP.mul(FP.div(dy, FP.fromFloat(dist)), FP.fromFloat(MILITIA_SEPARATION_FORCE));

      militia.vx = FP.add(militia.vx, pushX);
      militia.vy = FP.add(militia.vy, pushY);
    }
  }
}

// ============================================================================
// MILITIA UPDATE SYSTEM
// ============================================================================

/**
 * Update all militia units
 */
export function updateMilitia(
  state: GameState,
  _config: SimConfig
): void {
  // Skip if no militia
  if (state.militia.length === 0) return;

  const militiaToRemove: number[] = [];

  for (const militia of state.militia) {
    // Check expiration
    if (state.tick >= militia.expirationTick || militia.currentHp <= 0) {
      militia.state = 'dead';
      militiaToRemove.push(militia.id);
      // Set cooldown for this militia type (5 seconds = 150 ticks at 30 ticks/sec)
      state.militiaSpawnCooldowns[militia.type] = state.tick + 150;
      continue;
    }

    // Find target
    const target = findNearestEnemy(militia, state.enemies);
    militia.targetEnemyId = target?.id ?? null;

    const def = getMilitiaDefinition(militia.type);

    if (target) {
      const dist = Math.sqrt(FP.toFloat(FP.distSq(militia.x, militia.y, target.x, target.y)));
      const attackRange = FP.toFloat(militia.attackRange);

      if (dist <= attackRange) {
        // In attack range - attack
        militia.state = 'attacking';
        militia.vx = 0;
        militia.vy = 0;

        if (state.tick - militia.lastAttackTick >= militia.attackInterval) {
          militia.lastAttackTick = state.tick;
          target.hp -= militia.damage;
          target.hitFlashTicks = HIT_FLASH_TICKS;
        }
      } else {
        // Move towards target with smooth steering
        militia.state = 'moving';
        steerTowards(militia, target.x, target.y, def.baseSpeed);
      }
    } else {
      // No targets - hold position or patrol
      militia.state = 'blocking';
      militia.vx = 0;
      militia.vy = 0;
    }

    // Apply separation force
    applySeparation(militia, state.militia);

    // Apply friction (smoother movement)
    const friction = FP.fromFloat(MILITIA_FRICTION);
    militia.vx = FP.mul(militia.vx, friction);
    militia.vy = FP.mul(militia.vy, friction);

    // Integrate position
    militia.x = FP.add(militia.x, militia.vx);
    militia.y = FP.add(militia.y, militia.vy);
  }

  // Remove dead militia
  state.militia = state.militia.filter(m => !militiaToRemove.includes(m.id));
}

// ============================================================================
// MILITIA DAMAGE
// ============================================================================

/**
 * Apply damage to a militia unit (from enemy attacks)
 */
export function applyDamageToMilitia(
  militia: Militia,
  damage: number
): void {
  militia.currentHp -= damage;

  if (militia.currentHp <= 0) {
    militia.state = 'dead';
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get militia unit by ID
 */
export function getMilitiaById(
  state: GameState,
  id: number
): Militia | undefined {
  return state.militia.find(m => m.id === id);
}

/**
 * Get all militia of a specific type
 */
export function getMilitiaByType(
  state: GameState,
  type: MilitiaType
): Militia[] {
  return state.militia.filter(m => m.type === type);
}

/**
 * Count active militia
 */
export function countActiveMilitia(state: GameState): number {
  return state.militia.filter(m => m.state !== 'dead').length;
}
