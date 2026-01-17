/**
 * Fortress Skills System
 *
 * Handles fortress class skill execution:
 * - Skill cooldown management
 * - Auto-use AI for non-targeted skills
 * - Targeted skill execution on player input
 * - Skill effect application
 */

import { FP } from '../fixed.js';
import type { GameState, SimConfig, SkillDefinition } from '../types.js';
import { Xorshift32 } from '../rng.js';
import { getClassById, getSkillById } from '../data/classes.js';
import { applyEffectToEnemy } from './projectile.js';
import { HIT_FLASH_TICKS } from './constants.js';

/**
 * Calculate skill damage with commander level scaling
 * +5% per level above 1
 */
function getScaledSkillDamage(baseDamage: number, commanderLevel: number): number {
  const levelMultiplier = 1 + (commanderLevel - 1) * 0.05;
  return Math.floor(baseDamage * levelMultiplier);
}

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

  // Auto-use only skills that don't require targeting
  for (const skill of classDef.skills) {
    // Skip skills that require player targeting
    if (skill.requiresTarget) continue;

    // Check if skill is unlocked
    if (!state.activeSkills.includes(skill.id)) continue;

    // Check cooldown
    if (state.skillCooldowns[skill.id] > 0) continue;

    // Check if there are enemies to target
    if (state.enemies.length === 0) continue;

    // Use skill (auto-targeted at center)
    executeFortressSkill(skill, state, config, rng);
    applyCooldown(skill, state);
  }
}

/**
 * Apply cooldown to a skill with CDR modifiers
 */
function applyCooldown(skill: SkillDefinition, state: GameState): void {
  const totalCDR = Math.min(
    (state.modifiers.cooldownReduction ?? 0) + (state.synergyModifiers.cooldownReduction ?? 0),
    0.75
  );
  state.skillCooldowns[skill.id] = Math.floor(skill.cooldownTicks * (1 - totalCDR));
}

/**
 * Activate a targeted skill at specified coordinates
 * Returns true if skill was successfully activated
 */
export function activateTargetedSkill(
  skillId: string,
  targetX: number,
  targetY: number,
  state: GameState,
  config: SimConfig,
  rng: Xorshift32
): boolean {
  const skill = getSkillById(state.fortressClass, skillId);
  if (!skill) return false;

  // Check if skill is unlocked
  if (!state.activeSkills.includes(skillId)) return false;

  // Check cooldown
  if (state.skillCooldowns[skillId] > 0) return false;

  // Execute skill at target position
  executeTargetedFortressSkill(skill, targetX, targetY, state, config, rng);
  applyCooldown(skill, state);

  return true;
}

/**
 * Execute a fortress skill (auto-targeted at center)
 */
function executeFortressSkill(
  skill: SkillDefinition,
  state: GameState,
  _config: SimConfig,
  _rng: Xorshift32
): void {
  const centerX = FP.fromInt(20); // Center of field
  executeSkillAtPosition(skill, centerX, FP.fromInt(7), state);
}

/**
 * Execute a targeted fortress skill at specified position
 */
function executeTargetedFortressSkill(
  skill: SkillDefinition,
  targetX: number,
  targetY: number,
  state: GameState,
  _config: SimConfig,
  _rng: Xorshift32
): void {
  executeSkillAtPosition(skill, targetX, targetY, state);
}

/**
 * Core skill execution logic at a position
 */
function executeSkillAtPosition(
  skill: SkillDefinition,
  targetX: number,
  targetY: number,
  state: GameState
): void {
  const radius = skill.radius ? FP.fromFloat(skill.radius) : FP.fromInt(5);
  const radiusSq = FP.mul(radius, radius);

  // Find enemies based on skill target type
  let targetEnemies = state.enemies;

  // For 'single' target skills, find closest enemy to target
  const hasSingleTarget = skill.effects.some(e => e.target === 'single');
  if (hasSingleTarget) {
    let closest = null;
    let closestDistSq = FP.fromInt(999999);

    for (const enemy of state.enemies) {
      const dx = FP.sub(enemy.x, targetX);
      const dy = FP.sub(enemy.y, targetY);
      const distSq = FP.add(FP.mul(dx, dx), FP.mul(dy, dy));

      if (distSq < closestDistSq) {
        closestDistSq = distSq;
        closest = enemy;
      }
    }

    targetEnemies = closest ? [closest] : [];
  }
  // For 'area' target skills, find enemies in radius
  else if (skill.radius) {
    targetEnemies = state.enemies.filter(e => {
      const dx = FP.sub(e.x, targetX);
      const dy = FP.sub(e.y, targetY);
      const distSq = FP.add(FP.mul(dx, dx), FP.mul(dy, dy));
      return distSq <= radiusSq;
    });
  }
  // For 'all' target skills, use all enemies (already set)

  if (targetEnemies.length === 0) return;

  // Apply skill effects with additive damage bonuses and level scaling
  const totalDamageBonus =
    (state.modifiers.damageBonus ?? 0) +
    (state.synergyModifiers.damageBonus ?? 0) +
    (state.pillarModifiers.damageBonus ?? 0);

  // Scale base damage with commander level (+5% per level)
  const scaledBaseDamage = getScaledSkillDamage(skill.damage, state.commanderLevel);
  const baseDamage = Math.floor(scaledBaseDamage * (1 + totalDamageBonus));

  for (const enemy of targetEnemies) {
    enemy.hp -= baseDamage;
    enemy.hitFlashTicks = HIT_FLASH_TICKS;

    // Apply additional effects
    for (const effect of skill.effects) {
      applyEffectToEnemy(effect, enemy, state);
    }
  }
}
