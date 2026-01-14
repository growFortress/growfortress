/**
 * Hero Weakness System
 *
 * Handles hero weakness calculations including:
 * - Damage vulnerability multipliers
 * - Stat penalties
 * - Behavioral effects
 * - Conditional weaknesses
 */

import type { HeroWeakness, ActiveHero, FortressClass } from '../types.js';

/**
 * Calculate damage multiplier from hero weaknesses when taking damage
 * @param weaknesses - Hero's weaknesses
 * @param incomingDamageClass - Class of the incoming damage
 * @returns Damage multiplier (1.0 = no change, 1.5 = +50% damage taken)
 */
export function calculateWeaknessDamageMultiplier(
  weaknesses: HeroWeakness[],
  incomingDamageClass: FortressClass
): number {
  let multiplier = 1.0;

  for (const weakness of weaknesses) {
    if (weakness.effect.type === 'damage_vulnerability') {
      if (weakness.effect.damageClass === incomingDamageClass && weakness.effect.multiplier) {
        multiplier *= weakness.effect.multiplier;
      }
    }
  }

  return multiplier;
}

/**
 * Calculate stat penalty from hero weaknesses
 * @param weaknesses - Hero's weaknesses
 * @param stat - The stat to check
 * @returns Multiplier for the stat (e.g., 0.7 for -30%)
 */
export function calculateWeaknessStatPenalty(
  weaknesses: HeroWeakness[],
  stat: string
): number {
  let multiplier = 1.0;

  for (const weakness of weaknesses) {
    if (weakness.effect.type === 'stat_penalty' && weakness.effect.stat === stat && weakness.effect.amount) {
      multiplier *= weakness.effect.amount;
    }
  }

  return multiplier;
}

/**
 * Check if hero has a specific behavioral weakness
 */
export function hasWeaknessBehavior(weaknesses: HeroWeakness[], behavior: string): boolean {
  return weaknesses.some(w =>
    w.effect.type === 'behavioral' && w.effect.behavior === behavior
  );
}

/**
 * Get chance for behavioral weakness (friendly fire, betray, etc.)
 */
export function getWeaknessBehaviorChance(weaknesses: HeroWeakness[], behavior: string): number {
  for (const weakness of weaknesses) {
    if (weakness.effect.type === 'behavioral' && weakness.effect.behavior === behavior) {
      return weakness.effect.chance ?? 0;
    }
  }
  return 0;
}

/**
 * Check if conditional weakness applies
 */
export function shouldApplyConditionalWeakness(
  weakness: HeroWeakness,
  hero: ActiveHero,
  context: {
    enemyCount?: number;
    isFirstAttack?: boolean;
    isStunned?: boolean;
    isMeleeRange?: boolean;
    pillarId?: string;
    isPrecisionSkill?: boolean;
    hasWeapon?: boolean;
  }
): boolean {
  if (weakness.effect.type !== 'conditional') return false;

  const condition = weakness.effect.condition;
  if (!condition) return false;

  switch (condition) {
    case 'hp > 80%':
      return hero.currentHp / hero.maxHp > 0.8;
    case 'first_attack':
      return context.isFirstAttack ?? false;
    case 'enemies >= 5':
      return (context.enemyCount ?? 0) >= 5;
    case 'stunned':
      return context.isStunned ?? false;
    case 'cc_applied':
      return context.isStunned ?? false;
    case 'melee_range':
      return context.isMeleeRange ?? false;
    case 'precision_skill':
      return context.isPrecisionSkill ?? false;
    case 'not_cosmos_pillar':
      return context.pillarId !== 'cosmos';
    case 'no_weapon':
      return !(context.hasWeapon ?? true);
    case 'melee_attack':
      return context.isMeleeRange ?? false;
    case 'not_first_strike':
      return !(context.isFirstAttack ?? true);
    case 'primitive_enemy':
      // Simplified - all enemies in first pillar are "primitive"
      return context.pillarId === 'streets';
    default:
      return false;
  }
}

/**
 * Apply all conditional weakness effects to damage output
 */
export function applyConditionalWeaknessesToDamage(
  hero: ActiveHero,
  baseDamage: number,
  weaknesses: HeroWeakness[],
  context: {
    enemyCount?: number;
    isFirstAttack?: boolean;
    isStunned?: boolean;
    isMeleeRange?: boolean;
    pillarId?: string;
    isPrecisionSkill?: boolean;
    hasWeapon?: boolean;
  }
): number {
  let damage = baseDamage;

  for (const weakness of weaknesses) {
    if (shouldApplyConditionalWeakness(weakness, hero, context)) {
      // Only conditional type has the 'effect' string property
      if (weakness.effect.type !== 'conditional') continue;

      const effectStr = weakness.effect.effect || '';

      // Parse effect string like "-50% damage" or "-20% all stats"
      const match = effectStr.match(/(-?\d+)%\s*(damage|effectiveness|all stats|HP)?/i);
      if (match) {
        const percent = parseInt(match[1], 10);
        const target = match[2]?.toLowerCase() || 'damage';

        if (target === 'damage' || target === 'effectiveness' || target === 'all stats') {
          damage = Math.floor(damage * (1 + percent / 100));
        }
      }
    }
  }

  return Math.max(1, damage); // Minimum 1 damage
}

/**
 * Apply behavioral weakness effects during combat
 * @returns Object with flags for various behavioral effects
 */
export function checkBehavioralWeaknesses(
  weaknesses: HeroWeakness[]
): {
  noKillingBlow: boolean;
  needsReload: boolean;
  castingInterrupted: boolean;
  randomTarget: boolean;
} {
  const result = {
    noKillingBlow: false,
    needsReload: false,
    castingInterrupted: false,
    randomTarget: false,
  };

  for (const weakness of weaknesses) {
    if (weakness.effect.type !== 'behavioral') continue;

    const behavior = weakness.effect.behavior;

    switch (behavior) {
      case 'no_killing_blow':
        result.noKillingBlow = true;
        break;
      case 'reload_20':
      case 'recharge_after_10_attacks':
        // This needs to be tracked per hero
        result.needsReload = true;
        break;
      case 'casting_interrupt':
        result.castingInterrupted = true;
        break;
      case 'random_target':
        result.randomTarget = true;
        break;
    }
  }

  return result;
}
