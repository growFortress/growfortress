/**
 * Stat Caps System
 *
 * Hard limits on stats to prevent infinite scaling and balance issues
 */

import type { ModifierSet } from '../types.js';

/**
 * Hard caps for all stats
 */
export const STAT_CAPS = {
  // Offensive caps
  critChance: 0.75,           // Max 75% crit
  critDamage: 5.0,            // Max 500% crit damage
  damageBonus: 5.0,           // Max 500% damage bonus (soft cap at 200%)
  attackSpeedBonus: 3.0,      // Max 300% attack speed (soft cap at 100%)

  // Defensive caps
  cooldownReduction: 0.75,    // Max 75% CDR
  lifesteal: 0.30,            // Max 30% lifesteal
  damageReduction: 0.80,      // Max 80% damage reduction
  dodgeChance: 0.50,          // Max 50% dodge
  blockChance: 0.60,          // Max 60% block

  // Resistance caps
  knockbackResistance: 0.90,  // Max 90% knockback resistance
  ccResistance: 0.90,         // Max 90% crowd control resistance

  // Chain/splash caps
  chainChance: 1.0,           // Max 100% chain
  chainCount: 10,             // Max 10 chain targets
  splashDamagePercent: 1.0,   // Max 100% splash damage

  // Execute cap
  executeThreshold: 0.30,     // Max 30% HP execute threshold
};

/**
 * Apply stat caps to a modifier set
 * Returns a new ModifierSet with capped values
 */
export function applyCaps(modifiers: ModifierSet): ModifierSet {
  return {
    ...modifiers,
    critChance: Math.min(modifiers.critChance ?? 0, STAT_CAPS.critChance),
    critDamageBonus: Math.min(modifiers.critDamageBonus ?? 0.5, STAT_CAPS.critDamage),
    damageBonus: Math.min(modifiers.damageBonus ?? 0, STAT_CAPS.damageBonus),
    attackSpeedBonus: Math.min(modifiers.attackSpeedBonus ?? 0, STAT_CAPS.attackSpeedBonus),
    cooldownReduction: Math.min(modifiers.cooldownReduction ?? 0, STAT_CAPS.cooldownReduction),
    lifesteal: Math.min(modifiers.lifesteal ?? 0, STAT_CAPS.lifesteal),
    incomingDamageReduction: Math.min(modifiers.incomingDamageReduction ?? 0, STAT_CAPS.damageReduction),
    knockbackResistance: Math.min(modifiers.knockbackResistance ?? 0, STAT_CAPS.knockbackResistance),
    ccResistance: Math.min(modifiers.ccResistance ?? 0, STAT_CAPS.ccResistance),
    chainChance: Math.min(modifiers.chainChance ?? 0, STAT_CAPS.chainChance),
    chainCount: Math.min(modifiers.chainCount ?? 0, STAT_CAPS.chainCount),
    splashDamagePercent: Math.min(modifiers.splashDamagePercent ?? 0, STAT_CAPS.splashDamagePercent),
    executeThreshold: Math.min(modifiers.executeThreshold ?? 0, STAT_CAPS.executeThreshold),
  };
}

/**
 * Check if a stat is at or near its cap
 * Returns true if stat is at 90%+ of cap
 */
export function isNearCap(statName: keyof typeof STAT_CAPS, value: number): boolean {
  const cap = STAT_CAPS[statName];
  return value >= cap * 0.9;
}

/**
 * Get remaining room to cap for a stat
 */
export function getRemainingToCap(statName: keyof typeof STAT_CAPS, value: number): number {
  return Math.max(0, STAT_CAPS[statName] - value);
}
