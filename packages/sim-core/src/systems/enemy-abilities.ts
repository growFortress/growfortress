/**
 * Enemy Abilities System
 *
 * Handles special abilities for specific enemy types:
 * - Catapult: Ranged attacks on fortress/turrets
 * - Sapper: Targets walls with bombs
 * - Healer: Heals nearby enemies
 * - Shielder: Creates shield aura for nearby enemies
 * - Teleporter: Randomly teleports between lanes
 */

import { FP } from '../fixed.js';
import type { GameState, SimConfig, Enemy } from '../types.js';
import { Xorshift32 } from '../rng.js';
import { TURRET_SLOTS } from '../data/turrets.js';

// ============================================================================
// CONSTANTS
// ============================================================================

// Catapult
const CATAPULT_ATTACK_RANGE = FP.fromFloat(12); // Slightly shorter range
const CATAPULT_ATTACK_COOLDOWN = 105; // 3.5 seconds between attacks

// Healer
const HEALER_HEAL_RANGE = FP.fromFloat(4); // Heals enemies within 4 units
const HEALER_HEAL_COOLDOWN = 30; // Heals every second
const HEALER_HEAL_PERCENT = 0.02; // 2% of max HP per heal

// Shielder
const SHIELDER_SHIELD_RANGE = FP.fromFloat(3); // Shield aura radius
const SHIELDER_SHIELD_AMOUNT = 0.3; // 30% damage reduction for shielded enemies

// Teleporter
const TELEPORTER_COOLDOWN = 150; // 5 seconds between teleports
const TELEPORTER_CHANCE = 0.01; // 1% chance per tick when off cooldown

// Sapper
const SAPPER_BOMB_DAMAGE_MULTIPLIER = 4; // 4x damage to walls

// ============================================================================
// ABILITY STATE TRACKING
// ============================================================================

// Use Map to track per-enemy ability state
const enemyAbilityState = new Map<number, {
  lastAbilityTick: number;
  shieldActive?: boolean;
  targetWallId?: number;
}>();

/**
 * Get or create ability state for an enemy
 */
function getAbilityState(enemyId: number) {
  if (!enemyAbilityState.has(enemyId)) {
    enemyAbilityState.set(enemyId, { lastAbilityTick: 0 });
  }
  return enemyAbilityState.get(enemyId)!;
}

/**
 * Clean up ability state for dead enemies
 */
function cleanupAbilityState(activeEnemyIds: Set<number>): void {
  for (const id of enemyAbilityState.keys()) {
    if (!activeEnemyIds.has(id)) {
      enemyAbilityState.delete(id);
    }
  }
}

// ============================================================================
// INDIVIDUAL ABILITY IMPLEMENTATIONS
// ============================================================================

/**
 * Catapult: Ranged AOE attack on fortress/turrets
 */
function updateCatapultAbility(
  enemy: Enemy,
  state: GameState,
  config: SimConfig
): void {
  const abilityState = getAbilityState(enemy.id);
  const cooldown = state.tick - abilityState.lastAbilityTick;

  if (cooldown < CATAPULT_ATTACK_COOLDOWN) return;

  // Check if in range of fortress
  const distToFortress = Math.sqrt(FP.toFloat(
    FP.distSq(enemy.x, enemy.y, config.fortressX, FP.fromFloat(7.5))
  ));

  if (distToFortress <= FP.toFloat(CATAPULT_ATTACK_RANGE)) {
    // Attack fortress directly
    state.fortressHp -= enemy.damage;
    abilityState.lastAbilityTick = state.tick;
    return;
  }

  // Try to attack nearest turret
  for (const turret of state.turrets) {
    const slot = TURRET_SLOTS.find(s => s.id === turret.slotIndex);
    if (!slot) continue;

    const turretX = FP.add(config.fortressX, FP.fromFloat(slot.offsetX));
    const turretY = FP.fromFloat(7 + slot.offsetY);
    const distToTurret = Math.sqrt(FP.toFloat(FP.distSq(enemy.x, enemy.y, turretX, turretY)));

    if (distToTurret <= FP.toFloat(CATAPULT_ATTACK_RANGE)) {
      turret.currentHp -= enemy.damage;
      abilityState.lastAbilityTick = state.tick;
      return;
    }
  }
}

/**
 * Healer: Heals nearby enemies
 */
function updateHealerAbility(
  enemy: Enemy,
  state: GameState
): void {
  const abilityState = getAbilityState(enemy.id);
  const cooldown = state.tick - abilityState.lastAbilityTick;

  if (cooldown < HEALER_HEAL_COOLDOWN) return;

  const rangeSq = FP.mul(HEALER_HEAL_RANGE, HEALER_HEAL_RANGE);
  let healedAny = false;

  for (const other of state.enemies) {
    if (other.id === enemy.id) continue;

    const distSq = FP.distSq(enemy.x, enemy.y, other.x, other.y);
    if (distSq <= rangeSq && other.hp < other.maxHp) {
      const healAmount = Math.floor(other.maxHp * HEALER_HEAL_PERCENT);
      other.hp = Math.min(other.hp + healAmount, other.maxHp);
      healedAny = true;
    }
  }

  if (healedAny) {
    abilityState.lastAbilityTick = state.tick;
  }
}

/**
 * Shielder: Reduces damage for nearby enemies
 * Note: This modifies incoming damage, so it's applied in the damage system
 */
function updateShielderAbility(
  enemy: Enemy,
  _state: GameState
): void {
  // Shielder ability is passive - just track which enemies are in range
  // Actual damage reduction is applied in projectile.ts
  const abilityState = getAbilityState(enemy.id);
  abilityState.shieldActive = true;
}

/**
 * Check if an enemy is shielded by a nearby shielder
 */
export function isEnemyShielded(
  enemy: Enemy,
  state: GameState
): boolean {
  const shielders = state.enemies.filter(e => e.type === 'shielder' && e.hp > 0);

  for (const shielder of shielders) {
    if (shielder.id === enemy.id) continue;

    const distSq = FP.distSq(enemy.x, enemy.y, shielder.x, shielder.y);
    const rangeSq = FP.mul(SHIELDER_SHIELD_RANGE, SHIELDER_SHIELD_RANGE);

    if (distSq <= rangeSq) {
      return true;
    }
  }

  return false;
}

/**
 * Get shield damage reduction for an enemy
 */
export function getShieldDamageReduction(
  enemy: Enemy,
  state: GameState
): number {
  if (isEnemyShielded(enemy, state)) {
    return SHIELDER_SHIELD_AMOUNT;
  }
  return 0;
}

/**
 * Teleporter: Randomly teleports between lanes
 */
function updateTeleporterAbility(
  enemy: Enemy,
  state: GameState,
  rng: Xorshift32
): void {
  // Don't teleport when already at fortress doorstep
  if (enemy.x <= FP.fromInt(6)) return;

  const abilityState = getAbilityState(enemy.id);
  const cooldown = state.tick - abilityState.lastAbilityTick;

  if (cooldown < TELEPORTER_COOLDOWN) return;

  // Random chance to teleport
  if (rng.nextFloat() < TELEPORTER_CHANCE) {
    // Pick random lane (0, 1, or 2)
    const newLane = Math.floor(rng.nextFloat() * 3);
    if (newLane !== enemy.lane) {
      enemy.targetLane = newLane;
      enemy.lane = newLane;
      // Teleport Y position instantly
      const laneY = FP.fromFloat(3 + newLane * 4.5); // Approximate lane Y positions
      enemy.y = laneY;
      abilityState.lastAbilityTick = state.tick;
    }
  }
}

/**
 * Sapper: Targets walls with increased damage
 */
function updateSapperAbility(
  enemy: Enemy,
  state: GameState
): void {
  if (state.walls.length === 0) return;

  const abilityState = getAbilityState(enemy.id);

  // Find nearest wall
  let nearestWall = null;
  let nearestDistSq = Infinity;

  for (const wall of state.walls) {
    const wallCenterX = FP.add(wall.x, FP.div(wall.width, FP.fromFloat(2)));
    const wallCenterY = FP.add(wall.y, FP.div(wall.height, FP.fromFloat(2)));
    const distSq = FP.distSq(enemy.x, enemy.y, wallCenterX, wallCenterY);

    if (distSq < nearestDistSq) {
      nearestDistSq = distSq;
      nearestWall = wall;
    }
  }

  if (nearestWall) {
    abilityState.targetWallId = nearestWall.id;

    // Sappers deal extra damage to walls (handled in walls.ts)
    // Just mark the enemy as targeting walls
  }
}

/**
 * Get sapper damage multiplier for walls
 */
export function getSapperDamageMultiplier(enemy: Enemy): number {
  if (enemy.type === 'sapper') {
    return SAPPER_BOMB_DAMAGE_MULTIPLIER;
  }
  return 1;
}

// ============================================================================
// MAIN UPDATE FUNCTION
// ============================================================================

/**
 * Update all enemy special abilities
 */
export function updateEnemyAbilities(
  state: GameState,
  config: SimConfig,
  rng: Xorshift32
): void {
  // Track active enemy IDs for cleanup
  const activeIds = new Set(state.enemies.map(e => e.id));

  for (const enemy of state.enemies) {
    switch (enemy.type) {
      case 'catapult':
        updateCatapultAbility(enemy, state, config);
        break;
      case 'healer':
        updateHealerAbility(enemy, state);
        break;
      case 'shielder':
        updateShielderAbility(enemy, state);
        break;
      case 'teleporter':
        updateTeleporterAbility(enemy, state, rng);
        break;
      case 'sapper':
        updateSapperAbility(enemy, state);
        break;
    }
  }

  // Cleanup state for dead enemies
  cleanupAbilityState(activeIds);
}

// ============================================================================
// HELPER EXPORTS
// ============================================================================

export const SPECIAL_ENEMY_TYPES = ['catapult', 'sapper', 'healer', 'shielder', 'teleporter'] as const;

export function isSpecialEnemy(type: string): boolean {
  return SPECIAL_ENEMY_TYPES.includes(type as any);
}
