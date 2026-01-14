/**
 * Crystal System (Legacy: Infinity Stone System)
 *
 * Calculates bonuses from equipped Crystals:
 * - Damage multipliers (Power Crystal)
 * - Cooldown reduction (Chrono Crystal)
 * - Lifesteal (Vitae Crystal)
 *
 * Note: Function/type names kept as "Stone" for backwards compatibility.
 */

import type { InfinityStoneType } from '../types.js';
import { getStoneById } from '../data/infinity-stones.js';
import { FP_BASE } from './constants.js';

/**
 * Calculate damage bonus multiplier from an equipped Crystal
 * @returns Multiplier (1.0 = no bonus, 1.5 = +50% damage)
 */
export function calculateHeroStoneDamageBonus(stoneType: InfinityStoneType): number {
  const stone = getStoneById(stoneType);
  if (!stone) return 1.0;

  // Find damage multiplier effect
  for (const effect of stone.effects) {
    if (effect.type === 'stat_boost' && effect.stat === 'damageMultiplier' && effect.value) {
      // Convert from fixed-point (16384 = 1.0, 24576 = 1.5)
      return effect.value / FP_BASE;
    }
  }

  return 1.0;
}

/**
 * Calculate cooldown reduction from an equipped Crystal (Chrono Crystal)
 * @returns Reduction multiplier (0.5 = -50% cooldown, meaning 2x faster)
 */
export function calculateHeroStoneCooldownReduction(stoneType: InfinityStoneType | undefined): number {
  if (!stoneType) return 1.0;

  const stone = getStoneById(stoneType);
  if (!stone) return 1.0;

  // Find cooldown reduction effect
  for (const effect of stone.effects) {
    if (effect.type === 'stat_boost' && effect.stat === 'cooldownReduction' && effect.value) {
      // Convert from fixed-point, reduction of 24576 means -50%, so multiply cooldown by 0.5
      const reduction = effect.value / FP_BASE;
      return Math.max(0.1, 1 - reduction); // Minimum 10% of original cooldown
    }
  }

  return 1.0;
}

/**
 * Calculate lifesteal from an equipped Crystal (Vitae Crystal)
 * @returns Lifesteal percentage (0.3 = 30%)
 */
export function calculateHeroStoneLifesteal(stoneType: InfinityStoneType | undefined): number {
  if (!stoneType) return 0;

  const stone = getStoneById(stoneType);
  if (!stone) return 0;

  // Find lifesteal effect
  for (const effect of stone.effects) {
    if (effect.type === 'stat_boost' && effect.stat === 'lifesteal' && effect.value) {
      // Convert from fixed-point
      return effect.value / FP_BASE;
    }
  }

  return 0;
}
