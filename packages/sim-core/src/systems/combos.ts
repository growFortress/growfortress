/**
 * Combo System
 *
 * Detects and applies elemental combos when enemies receive
 * multiple damage types within a short time window.
 *
 * Combos:
 * - Fire + Ice → Steam Burst (+30% damage)
 * - Lightning + Water/Ice → Electrocute (stun 1s)
 * - Physical + Tech → Shatter (armor break - next damage +50%)
 */

import type { Enemy, GameState, FortressClass, SkillEffect } from '../types.js';
import { applyEffectToEnemy } from './projectile.js';

// Time window for combo detection (30 ticks = 1 second at 30Hz)
const COMBO_WINDOW_TICKS = 30;

// Cooldown between same combo type on same enemy
const COMBO_COOLDOWN_TICKS = 60;

/**
 * Combo definition
 */
export interface ComboDefinition {
  id: string;
  name: string;
  elements: [FortressClass, FortressClass]; // Required elements (order doesn't matter)
  effect: 'steam_burst' | 'electrocute' | 'shatter';
  bonusDamagePercent?: number; // Extra damage as % of average recent damage
  stunDuration?: number; // Stun duration in ticks
  armorBreakPercent?: number; // Armor reduction for next hit
}

/**
 * Result of a triggered combo (for VFX)
 */
export interface ComboTrigger {
  comboId: string;
  enemyId: number;
  tick: number;
  x: number; // Enemy position for VFX
  y: number;
  bonusDamage?: number;
}

// Define available combos
export const COMBOS: ComboDefinition[] = [
  {
    id: 'steam_burst',
    name: 'Steam Burst',
    elements: ['fire', 'ice'],
    effect: 'steam_burst',
    bonusDamagePercent: 0.30, // +30% damage
  },
  {
    id: 'electrocute',
    name: 'Electrocute',
    elements: ['lightning', 'ice'], // Lightning + cold/water
    effect: 'electrocute',
    stunDuration: 30, // 1 second stun
  },
  {
    id: 'shatter',
    name: 'Shatter',
    elements: ['natural', 'tech'], // Physical + Tech
    effect: 'shatter',
    armorBreakPercent: 0.50, // Next damage +50%
  },
];

/**
 * Track damage hit on enemy and check for combos
 * @returns combo trigger if a combo was activated
 */
export function trackDamageHit(
  enemy: Enemy,
  damageClass: FortressClass,
  damage: number,
  state: GameState
): ComboTrigger | null {
  // Initialize recentDamageHits if needed
  if (!enemy.recentDamageHits) {
    enemy.recentDamageHits = [];
  }

  // Add the new damage hit
  enemy.recentDamageHits.push({
    damageClass,
    tick: state.tick,
    damage,
  });

  // Clean up old hits outside the combo window
  enemy.recentDamageHits = enemy.recentDamageHits.filter(
    hit => state.tick - hit.tick <= COMBO_WINDOW_TICKS
  );

  // Check for combos
  const trigger = checkForCombo(enemy, state);

  if (trigger) {
    // Apply combo effect
    applyComboEffect(trigger.comboId, enemy, state);

    // Clear recent hits to prevent immediate re-trigger
    enemy.recentDamageHits = [];
  }

  return trigger;
}

/**
 * Check if current damage hits trigger any combo
 */
function checkForCombo(enemy: Enemy, state: GameState): ComboTrigger | null {
  if (!enemy.recentDamageHits || enemy.recentDamageHits.length < 2) {
    return null;
  }

  // Get unique damage classes in window
  const damageClasses = new Set(enemy.recentDamageHits.map(h => h.damageClass));

  for (const combo of COMBOS) {
    const [elem1, elem2] = combo.elements;

    // Check if both elements are present
    if (damageClasses.has(elem1) && damageClasses.has(elem2)) {
      // Check cooldown (using activeEffects as marker)
      const isOnCooldown = enemy.activeEffects.some(
        e => e.type === 'stun' &&
             e.appliedTick > state.tick - COMBO_COOLDOWN_TICKS &&
             // Check for combo marker in a hacky way - we use strength = -999 as marker
             e.strength === -999
      );

      if (!isOnCooldown) {
        // Calculate bonus damage from recent hits
        const totalRecentDamage = enemy.recentDamageHits.reduce((sum, h) => sum + h.damage, 0);
        const avgDamage = totalRecentDamage / enemy.recentDamageHits.length;

        return {
          comboId: combo.id,
          enemyId: enemy.id,
          tick: state.tick,
          x: enemy.x,
          y: enemy.y,
          bonusDamage: combo.bonusDamagePercent
            ? Math.floor(avgDamage * combo.bonusDamagePercent)
            : undefined,
        };
      }
    }
  }

  return null;
}

/**
 * Apply the combo effect to the enemy
 */
function applyComboEffect(comboId: string, enemy: Enemy, state: GameState): void {
  const combo = COMBOS.find(c => c.id === comboId);
  if (!combo) return;

  switch (combo.effect) {
    case 'steam_burst':
      // Deal bonus damage
      if (combo.bonusDamagePercent && enemy.recentDamageHits) {
        const totalRecentDamage = enemy.recentDamageHits.reduce((sum, h) => sum + h.damage, 0);
        const avgDamage = totalRecentDamage / enemy.recentDamageHits.length;
        const bonusDamage = Math.floor(avgDamage * combo.bonusDamagePercent);
        enemy.hp -= bonusDamage;
        enemy.hitFlashTicks = 8; // Extra flash for combo
      }
      break;

    case 'electrocute':
      // Apply stun
      if (combo.stunDuration) {
        const stunEffect: SkillEffect = {
          type: 'stun',
          duration: combo.stunDuration,
        };
        applyEffectToEnemy(stunEffect, enemy, state);
      }
      break;

    case 'shatter':
      // Apply armor break (mark for next damage to deal +50%)
      // We'll use a special effect for this
      enemy.activeEffects.push({
        type: 'slow', // Reuse slow type but with special strength marker
        remainingTicks: COMBO_COOLDOWN_TICKS,
        strength: -0.5, // Negative strength = armor break (next damage +50%)
        appliedTick: state.tick,
      });
      break;
  }
}

/**
 * Get armor break multiplier for enemy (from shatter combo)
 * Returns 1.0 if no armor break, higher if shatter is active
 */
export function getArmorBreakMultiplier(enemy: Enemy): number {
  // Check for shatter effect (slow with negative strength)
  const shatterEffect = enemy.activeEffects.find(
    e => e.type === 'slow' && e.strength < 0
  );

  if (shatterEffect) {
    // Remove the effect after one use
    const idx = enemy.activeEffects.indexOf(shatterEffect);
    if (idx >= 0) {
      enemy.activeEffects.splice(idx, 1);
    }
    return 1.0 + Math.abs(shatterEffect.strength); // 1.5 for -0.5
  }

  return 1.0;
}

/**
 * Clean up expired damage hits on all enemies
 * Called once per tick from simulation
 */
export function cleanupExpiredDamageHits(state: GameState): void {
  for (const enemy of state.enemies) {
    if (enemy.recentDamageHits) {
      enemy.recentDamageHits = enemy.recentDamageHits.filter(
        hit => state.tick - hit.tick <= COMBO_WINDOW_TICKS
      );
    }
  }
}
