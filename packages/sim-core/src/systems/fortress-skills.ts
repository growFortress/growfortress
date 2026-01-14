/**
 * Fortress Skills System
 *
 * Handles fortress class skill execution:
 * - Skill cooldown management
 * - Auto-use AI for skills
 * - Skill effect application
 */

import { FP } from '../fixed.js';
import type { GameState, SimConfig } from '../types.js';
import { Xorshift32 } from '../rng.js';
import { getClassById } from '../data/classes.js';
import { applyEffectToEnemy } from './projectile.js';
import { HIT_FLASH_TICKS } from './constants.js';

/**
 * Update fortress class skills
 */
export function updateFortressSkills(
  state: GameState,
  config: SimConfig,
  rng: Xorshift32
): void {
  const classDef = getClassById(state.fortressClass);
  if (!classDef) return;

  // Update cooldowns
  for (const skillId of Object.keys(state.skillCooldowns)) {
    if (state.skillCooldowns[skillId] > 0) {
      state.skillCooldowns[skillId]--;
    }
  }

  // Auto-use skills that are ready (AI-controlled)
  for (const skill of classDef.skills) {
    // Check if skill is unlocked
    if (!state.activeSkills.includes(skill.id)) continue;

    // Check cooldown
    if (state.skillCooldowns[skill.id] > 0) continue;

    // Check if there are enemies to target
    if (state.enemies.length === 0) continue;

    // Use skill
    executeFortressSkill(skill, state, config, rng);
    // CDR is additive: base * (1 - total CDR), capped at 0.75
    const totalCDR = Math.min(
      (state.modifiers.cooldownReduction ?? 0) + (state.synergyModifiers.cooldownReduction ?? 0),
      0.75
    );
    state.skillCooldowns[skill.id] = Math.floor(skill.cooldownTicks * (1 - totalCDR));
  }
}

/**
 * Execute a fortress skill
 */
function executeFortressSkill(
  skill: any,
  state: GameState,
  _config: SimConfig,
  _rng: Xorshift32
): void {
  const centerX = FP.fromInt(20); // Center of field
  const radius = skill.radius || FP.fromInt(5);

  // Find enemies in radius
  const enemiesInRadius = state.enemies.filter(e => {
    const dist = FP.abs(FP.sub(e.x, centerX));
    return dist <= radius;
  });

  if (enemiesInRadius.length === 0) return;

  // Apply skill effects with additive damage bonuses
  const totalDamageBonus =
    (state.modifiers.damageBonus ?? 0) +
    (state.synergyModifiers.damageBonus ?? 0) +
    (state.pillarModifiers.damageBonus ?? 0);
  const baseDamage = Math.floor(skill.damage * (1 + totalDamageBonus));

  for (const enemy of enemiesInRadius) {
    enemy.hp -= baseDamage;
    enemy.hitFlashTicks = HIT_FLASH_TICKS;

    // Apply additional effects
    for (const effect of skill.effects) {
      applyEffectToEnemy(effect, enemy, state);
    }
  }
}
