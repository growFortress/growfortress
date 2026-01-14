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
import { getHeroById } from '../data/heroes.js';
import { analytics } from '../analytics.js';
import { calculateWeaknessDamageMultiplier } from './weakness.js';
import {
  calculateHeroArtifactDodgeChance,
  calculateHeroArtifactBlockChance,
  hasArtifactPassive,
} from './artifacts.js';

/**
 * Apply damage to hero with artifact defensive effects (dodge, block) and weakness vulnerabilities
 * @returns actual damage taken (after dodge/block)
 */
export function applyDamageToHero(
  hero: ActiveHero,
  damage: number,
  rng: Xorshift32,
  incomingDamageClass?: FortressClass
): number {
  const heroDef = getHeroById(hero.definitionId);

  // Apply weakness damage vulnerability (e.g., Thunderlord +25% from Magic)
  if (heroDef && incomingDamageClass) {
    const weaknessMultiplier = calculateWeaknessDamageMultiplier(heroDef.weaknesses, incomingDamageClass);
    damage = Math.floor(damage * weaknessMultiplier);
  }
  // Check dodge (Cloak of Levitation)
  const dodgeChance = calculateHeroArtifactDodgeChance(hero.equippedArtifact);
  if (dodgeChance > 0 && rng.nextFloat() < dodgeChance) {
    return 0; // Dodged!
  }

  // Check block (Captain's Shield)
  const blockChance = calculateHeroArtifactBlockChance(hero.equippedArtifact);
  if (blockChance > 0 && rng.nextFloat() < blockChance) {
    // Blocked - reduce damage by 75%
    damage = Math.floor(damage * 0.25);

    // Vibranium Absorption: heal when blocking
    if (hasArtifactPassive(hero.equippedArtifact, 'vibranium absorption')) {
      hero.currentHp = Math.min(hero.currentHp + Math.floor(damage * 0.5), hero.maxHp);
    }
  }

  // Check Sentient Protection (Cloak - blocks one fatal hit per wave)
  if (hero.currentHp - damage <= 0 && hasArtifactPassive(hero.equippedArtifact, 'sentient protection')) {
    // Check if this passive was already used this wave
    const usedThisWave = hero.buffs.some(b => b.id === 'sentient_protection_used');
    if (!usedThisWave) {
      // Block fatal damage, leave at 1 HP
      damage = hero.currentHp - 1;
      // Mark as used (using hpRegen as a marker with 0 effect)
      hero.buffs.push({
        id: 'sentient_protection_used',
        stat: 'hpRegen',
        amount: 0,
        expirationTick: Infinity, // Cleared on wave end
      });
    }
  }

  if (hero.definitionId) {
    analytics.trackDamageTaken(hero.definitionId, damage);
  }

  hero.currentHp -= damage;
  analytics.trackDamage('fortress', 'fortress', damage); // Technically hero taking damage, but for now we track this flow
  return damage;
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
