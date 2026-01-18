/**
 * Damage System
 *
 * Handles damage application to heroes and turrets:
 * - Weakness damage vulnerability
 * - Artifact defensive effects (dodge, block)
 * - Special passive abilities
 */

import type { ActiveHero, ActiveTurret, FortressClass } from '../types.js';
import { Xorshift32 } from '../rng.js';

/**
 * Result of damage application to hero
 */
export interface HeroDamageResult {
  damageTaken: number;
  reflectDamage: number;
  slowAttacker?: boolean; // Cryo Armor - attacker should be slowed
}

/**
 * Apply damage to hero with artifact defensive effects (dodge, block) and weakness vulnerabilities
 * @returns object with actual damage taken and reflect damage to apply to attacker
 */
export function applyDamageToHero(
  _hero: ActiveHero,
  _damage: number,
  _rng: Xorshift32,
  _incomingDamageClass?: FortressClass,
  _currentTick?: number
): HeroDamageResult {
  // Heroes are immortal - no damage taken
  return { damageTaken: 0, reflectDamage: 0 };
}

/**
 * Apply damage to a turret from enemy attack
 * @returns actual damage dealt
 */
export function applyDamageToTurret(
  turret: ActiveTurret,
  damage: number
): number {
  const actualDamage = Math.min(damage, turret.currentHp);
  turret.currentHp -= actualDamage;
  return actualDamage;
}

// ============================================================================
// PHYSICS-BASED DEFENSE INTEGRATIONS
// ============================================================================

import { calculateCCDuration, applyKnockbackWithResistance, type PhysicsBody } from '../physics.js';

/**
 * Apply a CC effect to a hero with their CC resistance
 * @param hero - The hero to apply CC to
 * @param baseDuration - Base CC duration in ticks
 * @param ccResistance - Hero's CC resistance (0-0.9)
 * @param effectId - ID for tracking the effect (e.g., 'stun', 'freeze')
 * @param currentTick - Current game tick
 */
export function applyCCToHero(
  hero: ActiveHero,
  baseDuration: number,
  ccResistance: number,
  effectId: string,
  currentTick: number
): void {
  const effectiveDuration = calculateCCDuration(baseDuration, ccResistance);

  // Don't apply if duration is 0 or negative
  if (effectiveDuration <= 0) return;

  // Add CC buff marker
  hero.buffs.push({
    id: effectId,
    stat: 'hpRegen', // Using hpRegen as marker (with 0 effect)
    amount: 0,
    expirationTick: currentTick + effectiveDuration,
  });
}

/**
 * Check if hero is currently CC'd
 * @param hero - Hero to check
 * @param effectId - CC effect ID to check for (e.g., 'stun', 'freeze')
 * @param currentTick - Current game tick
 */
export function isHeroCCd(hero: ActiveHero, effectId: string, currentTick: number): boolean {
  return hero.buffs.some(b => b.id === effectId && b.expirationTick > currentTick);
}

/**
 * Apply knockback to a hero with their knockback resistance
 * @param hero - Hero to knockback (must have PhysicsBody properties)
 * @param kbX - Knockback X velocity (fixed-point)
 * @param kbY - Knockback Y velocity (fixed-point)
 * @param knockbackResistance - Hero's knockback resistance (0-0.9)
 */
export function applyKnockbackToHero(
  hero: ActiveHero & PhysicsBody,
  kbX: number,
  kbY: number,
  knockbackResistance: number
): void {
  applyKnockbackWithResistance(hero, kbX, kbY, knockbackResistance);
}

/**
 * Calculate incoming damage with fortress damage reduction
 * @param baseDamage - Base damage before reduction
 * @param incomingDamageReduction - Damage reduction (positive = less damage, negative = more damage)
 */
export function calculateFortressIncomingDamage(
  baseDamage: number,
  incomingDamageReduction: number
): number {
  // Clamp reduction to prevent negative damage or complete immunity
  const reduction = Math.min(Math.max(incomingDamageReduction, -1.0), 0.9);
  return Math.floor(baseDamage * (1 - reduction));
}
