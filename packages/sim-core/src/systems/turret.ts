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
} from '../types.js';
import { Xorshift32 } from '../rng.js';
import { getTurretById, calculateTurretStats, TURRET_SLOTS } from '../data/turrets.js';
import { createTurretProjectile } from './projectile.js';
import { TURRET_ATTACK_INTERVAL_BASE, HIT_FLASH_TICKS } from './constants.js';

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
    const enemiesInRange = state.enemies.filter(e => {
      const distSq = FP.distSq(e.x, e.y, turretX, turretY);
      return distSq <= rangeSq;
    });

    if (enemiesInRange.length === 0) continue;

    // Calculate attack interval
    // NOTE: turret stats use 16384 as 1.0 scale
    // Apply guild stat boost to attack speed
    const guildBoost = 1 + (config.guildStatBoost ?? 0);
    const attackSpeed = (stats.attackSpeed / 16384) * guildBoost;
    const attackInterval = Math.floor(TURRET_ATTACK_INTERVAL_BASE / attackSpeed);

    if (state.tick - turret.lastAttackTick >= attackInterval) {
      turret.lastAttackTick = state.tick;

      // Target enemy based on turret's targeting mode
      const target = selectTarget(
        enemiesInRange,
        turret.targetingMode || 'closest_to_fortress',
        turretX,
        turretY
      );

      // Create projectile (damage also uses 16384 scale)
      // Apply global damage bonus (includes guild stat boost)
      let turretDamage = stats.damage / 16384;
      if (state.modifiers.damageBonus > 0) {
        turretDamage = turretDamage * (1 + state.modifiers.damageBonus);
      }
      createTurretProjectile(turret, target, state, turretX, turretY, turret.currentClass, turretDamage);
    }

    // Check special ability
    if (turretDef.ability && turret.specialCooldown <= 0) {
      // Use special ability
      turret.specialCooldown = turretDef.ability.cooldown;

      // Apply ability effect
      applyTurretAbility(turret, turretDef.ability, state, enemiesInRange, rng);
    }

    // Decrease special cooldown
    if (turret.specialCooldown > 0) {
      turret.specialCooldown--;
    }
  }
}

/**
 * Apply turret special ability
 */
function applyTurretAbility(
  _turret: ActiveTurret,
  ability: any,
  state: GameState,
  enemies: Enemy[],
  _rng: Xorshift32
): void {
  switch (ability.effect.type) {
    case 'damage_boost':
      // Buff self for next attacks (handled in attack logic)
      break;
    case 'aoe_attack':
      // Deal damage to all enemies in area
      for (const enemy of enemies) {
        const damage = ability.effect.value ? ability.effect.value * 10 : 50;
        enemy.hp -= damage;
        enemy.hitFlashTicks = HIT_FLASH_TICKS;
      }
      break;
    case 'guaranteed_crit':
      // Next attack crits (handled in projectile logic)
      break;
    case 'chain_all':
      // Hit all enemies
      for (const enemy of enemies) {
        enemy.hp -= 15;
        enemy.hitFlashTicks = HIT_FLASH_TICKS;
      }
      break;
    case 'freeze_all':
      // Freeze all enemies (reduce speed)
      for (const enemy of enemies) {
        enemy.speed = FP.mul(enemy.speed, FP.fromFloat(0.5));
      }
      break;
    case 'zone_damage':
      // Create damage zone (simplified: instant damage)
      for (const enemy of enemies) {
        enemy.hp -= 20;
        enemy.hitFlashTicks = HIT_FLASH_TICKS;
      }
      break;
    case 'buff_allies':
      // Buff all heroes
      for (const hero of state.heroes) {
        hero.buffs.push({
          id: 'power_surge',
          stat: 'damageBonus',
          amount: ability.effect.value || 0.5,
          expirationTick: state.tick + (ability.effect.duration || 240),
        });
      }
      break;
    case 'poison_all':
      // Apply poison stacks
      for (const enemy of enemies) {
        // Simplified: deal damage over time
        enemy.hp -= 10;
        enemy.hitFlashTicks = HIT_FLASH_TICKS;
      }
      break;
  }
}
