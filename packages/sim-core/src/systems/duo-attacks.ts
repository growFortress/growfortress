/**
 * Duo-Attack System
 *
 * Detects and triggers special attacks when two specific heroes
 * are within activation range of each other.
 *
 * Follows patterns from combos.ts for consistency.
 */

import { FP } from '../fixed.js';
import type {
  GameState,
  ActiveHero,
  DuoAttackTrigger,
  DuoAttackDefinition,
  DuoAttackEffect,
  SkillEffect,
  ModifierSet,
} from '../types.js';
import {
  DUO_ATTACK_DEFINITIONS,
  getDuoAttackForPair,
} from '../data/duo-attacks.js';
import { applyEffectToEnemy } from './projectile.js';

// Store pending duo-attack triggers for VFX (similar to combos)
let pendingDuoAttackTriggers: DuoAttackTrigger[] = [];

// Active cooldowns: Map<duoAttackId, expirationTick>
const activeCooldowns: Map<string, number> = new Map();

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get and clear pending duo-attack triggers (for VFX rendering)
 */
export function popDuoAttackTriggers(): DuoAttackTrigger[] {
  const triggers = [...pendingDuoAttackTriggers];
  pendingDuoAttackTriggers = [];
  return triggers;
}

/**
 * Reset duo-attack cooldowns (call on new game/session)
 */
export function resetDuoAttackCooldowns(): void {
  activeCooldowns.clear();
}

/**
 * Check all hero pairs for duo-attack opportunities
 * Called once per tick from main update loop
 */
export function updateDuoAttacks(state: GameState): void {
  const heroes = state.heroes;

  // Need at least 2 heroes for duo-attacks
  if (heroes.length < 2) return;

  // Clean up expired cooldowns
  cleanupExpiredCooldowns(state.tick);

  // Check all unique hero pairs
  for (let i = 0; i < heroes.length; i++) {
    for (let j = i + 1; j < heroes.length; j++) {
      const hero1 = heroes[i];
      const hero2 = heroes[j];

      // Both heroes must be in combat state
      if (hero1.state !== 'combat' || hero2.state !== 'combat') continue;

      // Check if this pair has a duo-attack
      const duoAttack = getDuoAttackForPair(
        hero1.definitionId,
        hero2.definitionId
      );
      if (!duoAttack) continue;

      // Check cooldown
      if (isOnCooldown(duoAttack.id, state.tick)) continue;

      // Check distance between heroes
      const distSq = FP.distSq(hero1.x, hero1.y, hero2.x, hero2.y);
      const rangeSq = FP.mul(duoAttack.activationRange, duoAttack.activationRange);

      if (distSq <= rangeSq) {
        // Trigger duo-attack!
        triggerDuoAttack(duoAttack, hero1, hero2, state);
      }
    }
  }
}

/**
 * Get cooldown remaining for a duo-attack (for UI display)
 * @returns Remaining ticks, or 0 if ready
 */
export function getDuoAttackCooldownRemaining(
  duoAttackId: string,
  currentTick: number
): number {
  const expiration = activeCooldowns.get(duoAttackId);
  if (!expiration || currentTick >= expiration) return 0;
  return expiration - currentTick;
}

/**
 * Get all available duo-attacks for current hero composition
 */
export function getAvailableDuoAttacksForState(
  state: GameState
): DuoAttackDefinition[] {
  const heroIds = state.heroes.map((h) => h.definitionId);

  return DUO_ATTACK_DEFINITIONS.filter((duoAttack) => {
    return (
      heroIds.includes(duoAttack.heroes[0]) &&
      heroIds.includes(duoAttack.heroes[1])
    );
  });
}

// ============================================================================
// INTERNAL FUNCTIONS
// ============================================================================

/**
 * Check if a duo-attack is on cooldown
 */
function isOnCooldown(duoAttackId: string, currentTick: number): boolean {
  const expirationTick = activeCooldowns.get(duoAttackId);
  return expirationTick !== undefined && currentTick < expirationTick;
}

/**
 * Clean up expired cooldowns
 */
function cleanupExpiredCooldowns(currentTick: number): void {
  for (const [id, expiration] of activeCooldowns) {
    if (currentTick >= expiration) {
      activeCooldowns.delete(id);
    }
  }
}

/**
 * Trigger a duo-attack between two heroes
 */
function triggerDuoAttack(
  duoAttack: DuoAttackDefinition,
  hero1: ActiveHero,
  hero2: ActiveHero,
  state: GameState
): void {
  // Calculate center point between heroes
  const centerX = FP.div(FP.add(hero1.x, hero2.x), FP.fromInt(2));
  const centerY = FP.div(FP.add(hero1.y, hero2.y), FP.fromInt(2));

  // Set cooldown
  activeCooldowns.set(duoAttack.id, state.tick + duoAttack.cooldownTicks);

  let totalDamage = 0;

  // Apply effects
  for (const effect of duoAttack.effects) {
    switch (effect.type) {
      case 'damage':
        totalDamage += applyDuoAttackDamage(effect, centerX, centerY, state);
        break;

      case 'buff':
        applyDuoAttackBuff(effect, hero1, hero2, state.tick);
        break;

      case 'debuff':
        applyDuoAttackDebuff(effect, centerX, centerY, state);
        break;

      case 'terrain':
        // TODO: Implement terrain zone effects
        break;

      case 'summon':
        // TODO: Implement summon effects
        break;
    }
  }

  // Create trigger for VFX
  const trigger: DuoAttackTrigger = {
    duoAttackId: duoAttack.id,
    hero1Id: hero1.definitionId,
    hero2Id: hero2.definitionId,
    x: centerX,
    y: centerY,
    tick: state.tick,
    damage: totalDamage,
  };

  pendingDuoAttackTriggers.push(trigger);
}

/**
 * Apply damage effect from duo-attack to enemies in radius
 */
function applyDuoAttackDamage(
  effect: DuoAttackEffect,
  centerX: number,
  centerY: number,
  state: GameState
): number {
  if (!effect.damage || !effect.radius) return 0;

  const radiusSq = FP.mul(effect.radius, effect.radius);
  let totalDamage = 0;

  for (const enemy of state.enemies) {
    const distSq = FP.distSq(enemy.x, enemy.y, centerX, centerY);

    if (distSq <= radiusSq) {
      // Apply damage with falloff (full damage at center, 50% at edge)
      const dist = Math.sqrt(FP.toFloat(distSq));
      const maxDist = Math.sqrt(FP.toFloat(radiusSq));
      const distRatio = maxDist > 0 ? dist / maxDist : 0;
      const damageMultiplier = 1.0 - distRatio * 0.5;
      const damage = Math.floor(effect.damage * damageMultiplier);

      enemy.hp -= damage;
      enemy.hitFlashTicks = 10; // Extended flash for duo-attack
      totalDamage += damage;
    }
  }

  return totalDamage;
}

/**
 * Apply buff effect to both heroes
 */
function applyDuoAttackBuff(
  effect: DuoAttackEffect,
  hero1: ActiveHero,
  hero2: ActiveHero,
  currentTick: number
): void {
  if (!effect.buffStat || !effect.buffAmount || !effect.duration) return;

  const buff = {
    id: `duo_attack_buff_${currentTick}`,
    stat: effect.buffStat as keyof ModifierSet,
    amount: effect.buffAmount,
    expirationTick: currentTick + effect.duration,
  };

  hero1.buffs.push({ ...buff });
  hero2.buffs.push({ ...buff });
}

/**
 * Apply debuff/CC to enemies in radius
 */
function applyDuoAttackDebuff(
  effect: DuoAttackEffect,
  centerX: number,
  centerY: number,
  state: GameState
): void {
  if (!effect.statusEffect) return;

  // Default radius if not specified
  const radius = effect.radius || FP.fromInt(5);
  const radiusSq = FP.mul(radius, radius);

  for (const enemy of state.enemies) {
    const distSq = FP.distSq(enemy.x, enemy.y, centerX, centerY);

    if (distSq <= radiusSq) {
      applyEffectToEnemy(effect.statusEffect as SkillEffect, enemy, state);
    }
  }
}
