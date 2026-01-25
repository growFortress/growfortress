/**
 * Turret System
 *
 * Handles turret targeting and attacks:
 * - Target selection by mode (closest, weakest, strongest, nearest)
 * - Attack timing and damage
 * - Special abilities
 */

import { FP } from '../fixed.js';
import type {
  GameState,
  SimConfig,
  Enemy,
  ActiveTurret,
  TurretTargetingMode,
  DamageAttribution,
} from '../types.js';
import { Xorshift32 } from '../rng.js';
import { getTurretById, calculateTurretStats, TURRET_SLOTS } from '../data/turrets.js';
import { createTurretProjectile, applyEffectToEnemy } from './projectile.js';
import { TURRET_ATTACK_INTERVAL_BASE, HIT_FLASH_TICKS } from './constants.js';
import { getTurretSynergyBonus } from './synergy.js';
import { isEnemyTargetable } from './helpers.js';
import { analytics } from '../analytics.js';

// Overcharge constants
const OVERCHARGE_DURATION_TICKS = 150;  // 5 seconds at 30Hz
const OVERCHARGE_COOLDOWN_TICKS = 1800; // 60 seconds at 30Hz

// Attack speed limits to prevent chaotic behavior
const MIN_ATTACK_INTERVAL = 5;    // Minimum 5 ticks between attacks (~6 attacks/sec max)
const MAX_ATTACK_SPEED = 6.0;     // Cap attack speed multiplier

/**
 * Select target enemy based on turret targeting mode
 */
function selectTarget(
  enemies: Enemy[],
  targetingMode: TurretTargetingMode,
  turretX: number,
  turretY: number
): Enemy {
  switch (targetingMode) {
    case 'closest_to_fortress':
      // Enemy with lowest X (closest to fortress at x=2)
      return enemies.reduce((a, b) => a.x < b.x ? a : b);

    case 'weakest':
      // Enemy with lowest current HP
      return enemies.reduce((a, b) => a.hp < b.hp ? a : b);

    case 'strongest':
      // Enemy with highest current HP
      return enemies.reduce((a, b) => a.hp > b.hp ? a : b);

    case 'nearest_to_turret':
      // Enemy closest to turret by Euclidean distance
      return enemies.reduce((a, b) => {
        const distA = FP.distSq(a.x, a.y, turretX, turretY);
        const distB = FP.distSq(b.x, b.y, turretX, turretY);
        return distA < distB ? a : b;
      });

    case 'fastest':
      // Enemy with highest base speed
      return enemies.reduce((a, b) => a.baseSpeed > b.baseSpeed ? a : b);

    default:
      return enemies.reduce((a, b) => a.x < b.x ? a : b);
  }
}

/**
 * Update all turrets - targeting and attacking
 */
export function updateTurrets(
  state: GameState,
  config: SimConfig,
  rng: Xorshift32
): void {
  for (const turret of state.turrets) {
    const turretDef = getTurretById(turret.definitionId);
    if (!turretDef) continue;

    const slot = TURRET_SLOTS.find(s => s.id === turret.slotIndex);
    if (!slot) continue;

    // Calculate turret position
    const turretX = FP.add(config.fortressX, FP.fromFloat(slot.offsetX));
    const turretY = FP.fromFloat(7 + slot.offsetY);

    // Get turret stats with class modifier
    const stats = calculateTurretStats(turretDef, turret.currentClass, turret.tier);

    // Find enemies in range
    // NOTE: turret stats use 16384 as 1.0 scale, not FP's 65536
    const rangeFp = stats.range << 2; // 16384 -> 65536 scale
    const rangeSq = FP.mul(rangeFp, rangeFp);
    const fieldWidth = config.fieldWidth;
    const enemiesInRange = state.enemies.filter(e => {
      if (!isEnemyTargetable(e, fieldWidth)) return false;
      const distSq = FP.distSq(e.x, e.y, turretX, turretY);
      return distSq <= rangeSq;
    });

    if (enemiesInRange.length === 0) {
      // Clear target when no enemies in range
      turret.currentTargetId = undefined;
      continue;
    }

    // Calculate attack interval
    // NOTE: turret stats use 16384 as 1.0 scale
    // Apply guild stat boost to attack speed
    const guildBoost = 1 + (config.guildStatBoost ?? 0);
    let attackSpeed = (stats.attackSpeed / 16384) * guildBoost;

    // Apply turret adjacency synergy attack speed bonus
    const adjacencyBonus = getTurretSynergyBonus(state, turret.slotIndex);
    if (adjacencyBonus && adjacencyBonus.attackSpeedBonus > 0) {
      attackSpeed = attackSpeed * (1 + adjacencyBonus.attackSpeedBonus);
    }

    // Apply overcharge attack speed bonus (1.5x)
    if (turret.overchargeActive && turret.overchargeExpiresTick && state.tick < turret.overchargeExpiresTick) {
      attackSpeed = attackSpeed * 1.5;
    }

    // Cap attack speed to prevent chaotic rapid-fire behavior
    attackSpeed = Math.min(attackSpeed, MAX_ATTACK_SPEED);

    // Calculate attack interval with minimum to prevent every-tick firing
    const attackInterval = Math.max(MIN_ATTACK_INTERVAL, Math.floor(TURRET_ATTACK_INTERVAL_BASE / attackSpeed));

    if (state.tick - turret.lastAttackTick >= attackInterval) {
      turret.lastAttackTick = state.tick;

      // Target persistence: prefer current target if still valid (alive and in range)
      let target: Enemy | undefined;

      if (turret.currentTargetId !== undefined) {
        // Check if current target is still valid
        target = enemiesInRange.find(e => e.id === turret.currentTargetId && e.hp > 0);
      }

      // If no valid current target, select a new one
      if (!target) {
        target = selectTarget(
          enemiesInRange,
          turret.targetingMode || 'closest_to_fortress',
          turretX,
          turretY
        );
        // Remember this target for persistence
        turret.currentTargetId = target.id;
      }

      // Create projectile (damage also uses 16384 scale)
      // Apply global damage bonus (includes guild stat boost)
      let turretDamage = stats.damage / 16384;
      if (state.modifiers.damageBonus > 0) {
        turretDamage = turretDamage * (1 + state.modifiers.damageBonus);
      }

      // Apply turret adjacency synergy bonus
      const synergyBonus = getTurretSynergyBonus(state, turret.slotIndex);
      if (synergyBonus && synergyBonus.damageBonus > 0) {
        turretDamage = turretDamage * (1 + synergyBonus.damageBonus);
      }

      // Apply damage boost from ability (if active)
      if (turret.damageBoostMultiplier && turret.damageBoostExpiresTick && state.tick < turret.damageBoostExpiresTick) {
        turretDamage = turretDamage * (turret.damageBoostMultiplier / 16384);
      } else if (turret.damageBoostExpiresTick && state.tick >= turret.damageBoostExpiresTick) {
        // Clear expired boost
        turret.damageBoostMultiplier = undefined;
        turret.damageBoostExpiresTick = undefined;
      }

      // Apply overcharge bonus (2x damage, 1.5x attack speed handled via attackInterval)
      if (turret.overchargeActive && turret.overchargeExpiresTick && state.tick < turret.overchargeExpiresTick) {
        turretDamage = turretDamage * 2.0;
      } else if (turret.overchargeExpiresTick && state.tick >= turret.overchargeExpiresTick) {
        // Clear expired overcharge
        turret.overchargeActive = false;
        turret.overchargeExpiresTick = undefined;
      }

      createTurretProjectile(turret, target, state, turretX, turretY, turret.currentClass, turretDamage);
    }

    // Check special ability
    if (turretDef.ability && turret.specialCooldown <= 0) {
      // Use special ability
      turret.specialCooldown = turretDef.ability.cooldown;

      // Apply ability effect
      applyTurretAbility(turret, turretDef.ability, state, enemiesInRange, rng);
    } else if (turret.specialCooldown > 0) {
      // Decrease special cooldown (only when ability didn't fire this tick)
      turret.specialCooldown--;
    }
  }
}

/**
 * Apply turret special ability
 */
function applyTurretAbility(
  turret: ActiveTurret,
  ability: any,
  state: GameState,
  enemies: Enemy[],
  _rng: Xorshift32
): void {
  const attribution: DamageAttribution = {
    ownerType: 'turret',
    ownerId: turret.definitionId,
    mechanicType: 'ability',
    mechanicId: ability?.effect?.type || 'unknown_ability',
  };
  // Get turret base damage for abilities that need it
  const turretDef = getTurretById(turret.definitionId);
  const baseDamage = turretDef ? turretDef.baseStats.damage / 16384 : 15;

  switch (ability.effect.type) {
    case 'damage_boost':
      // Apply damage boost buff to turret
      turret.damageBoostMultiplier = ability.effect.value || 32768; // Default 2.0x
      turret.damageBoostExpiresTick = state.tick + (ability.effect.duration || 150);
      break;
    case 'aoe_attack': {
      // Deal boosted damage to all enemies in area
      // value is in FP 16384 scale (e.g. 32768 = 2.0x)
      const damageMultiplier = ability.effect.value ? ability.effect.value / 16384 : 2.0;
      const aoeDamage = Math.floor(baseDamage * damageMultiplier);
      for (const enemy of enemies) {
        const damageDealt = Math.min(aoeDamage, enemy.hp);
        enemy.hp -= aoeDamage;
        enemy.hitFlashTicks = HIT_FLASH_TICKS;
        analytics.trackAttributedDamage(attribution, damageDealt);
      }
      break;
    }
    case 'chain_all':
      // Hit all enemies with turret's base damage
      for (const enemy of enemies) {
        const rawDamage = Math.floor(baseDamage);
        const damageDealt = Math.min(rawDamage, enemy.hp);
        enemy.hp -= rawDamage;
        enemy.hitFlashTicks = HIT_FLASH_TICKS;
        analytics.trackAttributedDamage(attribution, damageDealt);
      }
      break;
    case 'freeze_all': {
      // Freeze all enemies
      const freezeDuration = ability.effect.duration || 90;
      for (const enemy of enemies) {
        applyEffectToEnemy({ type: 'freeze', duration: freezeDuration }, enemy, state, attribution);
      }
      break;
    }
    case 'buff_allies':
      // Buff all heroes
      for (const hero of state.heroes) {
        hero.buffs.push({
          id: 'power_surge',
          stat: 'damageBonus',
          amount: ability.effect.value ? ability.effect.value / 16384 : 0.5,
          expirationTick: state.tick + (ability.effect.duration || 240),
        });
      }
      break;
    case 'poison_all': {
      // Apply poison DOT to all enemies
      const poisonDamage = ability.effect.value ? ability.effect.value / 16384 : 5;
      const poisonDuration = ability.effect.duration || 150;
      for (const enemy of enemies) {
        applyEffectToEnemy({ type: 'poison', damagePerTick: poisonDamage, duration: poisonDuration }, enemy, state, attribution);
      }
      break;
    }
  }
}

/**
 * Activate overcharge on a turret (2x damage, 1.5x attack speed for 5 seconds)
 * Returns true if activation was successful, false if on cooldown
 */
export function activateTurretOvercharge(
  state: GameState,
  slotIndex: number
): boolean {
  const turret = state.turrets.find(t => t.slotIndex === slotIndex);
  if (!turret) return false;

  // Check if on cooldown
  if (turret.overchargeCooldownTick && state.tick < turret.overchargeCooldownTick) {
    return false;
  }

  // Activate overcharge
  turret.overchargeActive = true;
  turret.overchargeExpiresTick = state.tick + OVERCHARGE_DURATION_TICKS;
  turret.overchargeCooldownTick = state.tick + OVERCHARGE_DURATION_TICKS + OVERCHARGE_COOLDOWN_TICKS;

  return true;
}

/**
 * Set turret targeting mode
 */
export function setTurretTargetingMode(
  state: GameState,
  slotIndex: number,
  mode: TurretTargetingMode
): boolean {
  const turret = state.turrets.find(t => t.slotIndex === slotIndex);
  if (!turret) return false;

  turret.targetingMode = mode;
  return true;
}
