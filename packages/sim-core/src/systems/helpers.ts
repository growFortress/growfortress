/**
 * Helper Functions
 *
 * Shared utility functions used by multiple game systems:
 * - Enemy finding (1D and 2D)
 * - Skill effect application
 * - Formation positioning
 * - Attack range calculation
 */

import { FP } from '../fixed.js';
import type { Enemy, ActiveHero, SkillEffect, GameState, FortressClass, ActiveProjectile } from '../types.js';
import { HERO_ATTACK_RANGE_BASE, PROJECTILE_BASE_SPEED } from './constants.js';
import { getHeroById } from '../data/heroes.js';
import { applyEffectToEnemy } from './projectile.js';

/**
 * Find closest enemy to a position (1D - X only, legacy)
 * @deprecated Use findClosestEnemy2D for 2D physics
 */
export function findClosestEnemy(enemies: Enemy[], x: number): Enemy | null {
  if (enemies.length === 0) return null;

  let closest = enemies[0];
  let closestDist = Math.abs(FP.toFloat(enemies[0].x) - FP.toFloat(x));

  for (const enemy of enemies) {
    const dist = Math.abs(FP.toFloat(enemy.x) - FP.toFloat(x));
    if (dist < closestDist) {
      closest = enemy;
      closestDist = dist;
    }
  }

  return closest;
}

/**
 * Find closest enemy to a position (2D - considers both X and Y)
 */
export function findClosestEnemy2D(enemies: Enemy[], x: number, y: number): Enemy | null {
  if (enemies.length === 0) return null;

  let closest = enemies[0];
  let closestDistSq = FP.distSq(enemies[0].x, enemies[0].y, x, y);

  for (const enemy of enemies) {
    const distSq = FP.distSq(enemy.x, enemy.y, x, y);
    if (distSq < closestDistSq) {
      closest = enemy;
      closestDistSq = distSq;
    }
  }

  return closest;
}

/**
 * Get hero attack range based on role
 */
export function getHeroAttackRange(role: string): number {
  switch (role) {
    case 'tank': return FP.fromInt(2);
    case 'dps': return FP.fromInt(4);
    case 'support': return FP.fromInt(5);
    case 'crowd_control': return FP.fromInt(6);
    default: return HERO_ATTACK_RANGE_BASE;
  }
}

/**
 * Get formation position for a hero based on index and total count
 * Returns {x, y} offset from fortress position
 * Aligned with turret slot positions (offsetX: 4, 7, 10)
 */
export function getFormationPosition(index: number, totalCount: number): { xOffset: number; yOffset: number } {
  const centerY = 7.5;
  // Use turret slot X positions for alignment
  const SLOT_X = [4, 7, 10]; // Same as turret offsetX values

  switch (totalCount) {
    case 1:
      // Single hero: centered at slot 1 position
      return { xOffset: SLOT_X[0], yOffset: centerY };

    case 2: {
      // Two heroes: at slot 1, spread vertically
      const positions2 = [
        { xOffset: SLOT_X[0], yOffset: centerY - 2 },
        { xOffset: SLOT_X[0], yOffset: centerY + 2 },
      ];
      return positions2[index] || positions2[0];
    }

    case 3: {
      // Three heroes: leader at slot 2, two at slot 1
      const positions3 = [
        { xOffset: SLOT_X[1], yOffset: centerY },      // Leader front (slot 2)
        { xOffset: SLOT_X[0], yOffset: centerY - 2 },  // Back-top (slot 1)
        { xOffset: SLOT_X[0], yOffset: centerY + 2 },  // Back-bottom (slot 1)
      ];
      return positions3[index] || positions3[0];
    }

    case 4: {
      // Four heroes: diamond at slots 1 and 2
      const positions4 = [
        { xOffset: SLOT_X[1], yOffset: centerY },      // Front (slot 2)
        { xOffset: SLOT_X[0], yOffset: centerY - 2 },  // Top (slot 1)
        { xOffset: SLOT_X[0], yOffset: centerY + 2 },  // Bottom (slot 1)
        { xOffset: SLOT_X[0], yOffset: centerY },      // Back center (slot 1)
      ];
      return positions4[index] || positions4[0];
    }

    case 5: {
      // Five heroes: arrow formation using slots 1, 2, 3
      const positions5 = [
        { xOffset: SLOT_X[2], yOffset: centerY },      // Point (slot 3)
        { xOffset: SLOT_X[1], yOffset: centerY - 2 },  // Front wings (slot 2)
        { xOffset: SLOT_X[1], yOffset: centerY + 2 },
        { xOffset: SLOT_X[0], yOffset: centerY - 2 },  // Back wings (slot 1)
        { xOffset: SLOT_X[0], yOffset: centerY + 2 },
      ];
      return positions5[index] || positions5[0];
    }

    default: {
      // 6+ heroes: rows aligned with slots
      const row = Math.floor(index / 3);
      const col = index % 3;
      const ySpread = 2.5;
      const yPositions = [centerY - ySpread, centerY, centerY + ySpread];
      return {
        xOffset: SLOT_X[Math.min(row, 2)],
        yOffset: yPositions[col] || centerY,
      };
    }
  }
}

/**
 * Get projectile type for class
 */
function getProjectileTypeForClass(fortressClass: FortressClass): 'physical' | 'icicle' | 'fireball' | 'bolt' | 'laser' {
  switch (fortressClass) {
    case 'natural': return 'physical';
    case 'ice': return 'icicle';
    case 'fire': return 'fireball';
    case 'lightning': return 'bolt';
    case 'tech': return 'laser';
    default: return 'physical';
  }
}

/**
 * Create a skill projectile from hero to enemy
 */
function createSkillProjectile(
  hero: ActiveHero,
  target: Enemy,
  state: GameState,
  heroClass: FortressClass,
  damage: number,
  additionalEffects: SkillEffect[],
  skillId?: string
): void {
  const projectile: ActiveProjectile = {
    id: state.nextProjectileId++,
    type: getProjectileTypeForClass(heroClass),
    sourceType: 'hero',
    sourceId: hero.definitionId,
    targetEnemyId: target.id,
    x: hero.x,
    y: hero.y,
    startX: hero.x,
    startY: hero.y,
    targetX: target.x,
    targetY: target.y,
    speed: PROJECTILE_BASE_SPEED,
    damage: damage,
    effects: additionalEffects,
    spawnTick: state.tick,
    class: heroClass,
    skillId,
  };

  state.projectiles.push(projectile);
}

/**
 * Apply skill effects to targets
 */
export function applySkillEffects(
  effects: SkillEffect[],
  hero: ActiveHero,
  state: GameState,
  enemies: Enemy[],
  _rng: unknown,
  skillId?: string
): void {
  const heroDef = getHeroById(hero.definitionId);
  const heroClass = heroDef?.class || 'natural';

  // Collect damage and additional effects that should be applied via projectile
  let damageAmount = 0;
  const projectileEffects: SkillEffect[] = [];
  const immediateEffects: SkillEffect[] = [];
  let percentHpDamageEffect: SkillEffect | null = null;

  for (const effect of effects) {
    if (effect.type === 'damage') {
      damageAmount = effect.amount || 0;
    } else if (effect.type === 'percent_current_hp_damage') {
      // Store for special processing against each enemy
      percentHpDamageEffect = effect;
    } else if (effect.type === 'slow' || effect.type === 'stun' || effect.type === 'freeze' || effect.type === 'burn' || effect.type === 'poison') {
      // These effects should be applied when projectile hits
      projectileEffects.push(effect);
    } else {
      // Buff, heal, shield apply immediately to the hero
      immediateEffects.push(effect);
    }
  }

  // Apply immediate effects (buff, heal, shield)
  for (const effect of immediateEffects) {
    switch (effect.type) {
      case 'buff':
        if (effect.stat) {
          hero.buffs.push({
            id: `skill_buff_${state.tick}`,
            stat: effect.stat,
            amount: effect.amount || 0,
            expirationTick: state.tick + (effect.duration || 150),
          });
        }
        break;

      case 'heal':
        hero.currentHp = Math.min(
          hero.currentHp + (effect.amount || 0),
          hero.maxHp
        );
        break;

      case 'shield':
        // Apply temporary shield that absorbs damage
        hero.shieldAmount = (hero.shieldAmount || 0) + (effect.amount || 0);
        hero.shieldExpiresTick = state.tick + (effect.duration || 300); // Default 10s
        break;
    }
  }

  // Create projectiles for damage effects
  if (damageAmount > 0 && enemies.length > 0) {
    // Check the target type from the original damage effect
    const damageEffect = effects.find(e => e.type === 'damage');
    const targetType = damageEffect?.target || 'single';

    if (targetType === 'single') {
      // Single target - fire at closest enemy
      const closest = findClosestEnemy2D(enemies, hero.x, hero.y);
      if (closest) {
        createSkillProjectile(hero, closest, state, heroClass, damageAmount, projectileEffects, skillId);
      }
    } else {
      // Area or all - fire at all enemies in range
      for (const enemy of enemies) {
        createSkillProjectile(hero, enemy, state, heroClass, damageAmount, projectileEffects, skillId);
      }
    }
  } else if (projectileEffects.length > 0 && enemies.length > 0) {
    // Non-damage effects only (like pure slow) - apply immediately since no projectile needed
    for (const effect of projectileEffects) {
      for (const enemy of enemies) {
        // Use proper effect application with duration tracking and speed recalculation
        applyEffectToEnemy(effect, enemy, state);
      }
    }
  }

  // Handle percent_current_hp_damage effect (INFERNO/RIFT ultimates)
  // This deals damage as a percentage of enemy's current HP, with a cap
  if (percentHpDamageEffect && enemies.length > 0) {
    const percent = (percentHpDamageEffect.percent || 50) / 100;
    const maxBaseDamage = percentHpDamageEffect.maxBaseDamage ?? 500;
    const scalingPerLevel = percentHpDamageEffect.scalingPerLevel ?? 10;
    const maxDamage = maxBaseDamage + (hero.level * scalingPerLevel);

    const targetType = percentHpDamageEffect.target || 'all';
    const targetEnemies = targetType === 'single'
      ? [findClosestEnemy2D(enemies, hero.x, hero.y)].filter((e): e is Enemy => e !== null)
      : enemies;

    for (const enemy of targetEnemies) {
      // Calculate percent damage based on current HP
      let percentDamage = Math.floor(enemy.hp * percent);
      // Apply damage cap
      percentDamage = Math.min(percentDamage, maxDamage);

      // Create projectile for the capped damage
      createSkillProjectile(hero, enemy, state, heroClass, percentDamage, projectileEffects, skillId);
    }
  }
}
