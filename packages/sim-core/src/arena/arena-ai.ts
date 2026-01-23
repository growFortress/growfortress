/**
 * Arena PvP AI - Targeting Logic
 *
 * Handles target selection for heroes in arena battles.
 *
 * Priority rules:
 * - Heroes: Attack enemy fortress (priority) > Attack enemy heroes
 */

import { FP } from '../fixed.js';
import type { ActiveHero } from '../types.js';
import type { ArenaState, ArenaSide, ArenaFortress } from './arena-state.js';
import { getHeroById, calculateHeroStats } from '../data/heroes.js';
import { HERO_PREFERRED_COMBAT_DISTANCE_RATIO } from '../systems/constants.js';

// ============================================================================
// TYPES
// ============================================================================

export type ArenaTargetType = 'fortress' | 'hero' | 'move' | 'none';

export interface ArenaTarget {
  type: ArenaTargetType;
  /** Target position (fixed-point) */
  x: number;
  y: number;
  /** Target ID (for heroes) */
  targetId?: string;
  /** Target index (for heroes array) */
  targetIndex?: number;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Calculate squared distance between two points (fixed-point)
 */
function distanceSquared(x1: number, y1: number, x2: number, y2: number): number {
  const dx = FP.sub(x1, x2);
  const dy = FP.sub(y1, y2);
  return FP.add(FP.mul(dx, dx), FP.mul(dy, dy));
}

/**
 * Get hero's attack range from definition
 */
function getHeroRange(hero: ActiveHero): number {
  const def = getHeroById(hero.definitionId);
  if (!def) return FP.fromInt(3); // Default range

  const stats = calculateHeroStats(def, hero.tier, hero.level);
  // stats.range is already in fixed-point format (FP.fromInt), don't convert again
  return stats.range;
}

/**
 * Find alive heroes on a side
 */
function getAliveHeroes(side: ArenaSide): ActiveHero[] {
  return side.heroes.filter(h => h.currentHp > 0);
}

// ============================================================================
// HERO AI
// ============================================================================

/** Fixed attack range for heroes attacking fortress (units from fortress center) */
const FORTRESS_ATTACK_DISTANCE = FP.fromInt(4);

/**
 * Select target for a hero in arena battle
 *
 * Priority:
 * 1. Enemy fortress (if in range)
 * 2. Enemy heroes (if in range) - target closest
 * 3. Move towards enemy fortress
 */
export function selectHeroTarget(
  hero: ActiveHero,
  ownSide: 'left' | 'right',
  state: ArenaState
): ArenaTarget {
  const enemySide = ownSide === 'left' ? state.right : state.left;
  const heroRange = getHeroRange(hero);
  const heroRangeSq = FP.mul(heroRange, heroRange);

  // Use fixed distance for fortress attacks
  const fortressAttackRangeSq = FP.mul(FORTRESS_ATTACK_DISTANCE, FORTRESS_ATTACK_DISTANCE);

  // Priority 1: Attack enemy fortress if in range
  const fortressDist = distanceSquared(
    hero.x,
    hero.y,
    enemySide.fortress.x,
    enemySide.fortress.y
  );

  if (fortressDist <= fortressAttackRangeSq) {
    return {
      type: 'fortress',
      x: enemySide.fortress.x,
      y: enemySide.fortress.y,
    };
  }

  // Priority 2: Attack enemy heroes in range
  const aliveEnemyHeroes = getAliveHeroes(enemySide);
  let closestHero: ActiveHero | null = null;
  let closestDistSq = Infinity;

  for (let i = 0; i < aliveEnemyHeroes.length; i++) {
    const enemyHero = aliveEnemyHeroes[i];
    const distSq = distanceSquared(hero.x, hero.y, enemyHero.x, enemyHero.y);

    if (distSq <= heroRangeSq && distSq < closestDistSq) {
      closestHero = enemyHero;
      closestDistSq = distSq;
    }
  }

  if (closestHero) {
    return {
      type: 'hero',
      x: closestHero.x,
      y: closestHero.y,
      targetId: closestHero.definitionId,
      targetIndex: enemySide.heroes.indexOf(closestHero),
    };
  }

  // Default: Move towards enemy fortress
  return {
    type: 'move',
    x: enemySide.fortress.x,
    y: enemySide.fortress.y,
  };
}

/**
 * Get movement direction for hero towards target
 * Maintains preferred combat distance when in attack range to prevent model overlap
 */
export function getHeroMovementDirection(
  hero: ActiveHero,
  target: ArenaTarget
): { vx: number; vy: number } {
  if (target.type === 'none') {
    return { vx: 0, vy: 0 };
  }

  const heroRange = getHeroRange(hero);
  const dx = FP.sub(target.x, hero.x);
  const dy = FP.sub(target.y, hero.y);

  // Normalize direction
  const distSq = FP.add(FP.mul(dx, dx), FP.mul(dy, dy));
  if (distSq === 0) {
    return { vx: 0, vy: 0 };
  }

  const dist = FP.sqrt(distSq);
  if (dist === 0) {
    return { vx: 0, vy: 0 };
  }

  // If attacking a target (fortress or hero) and in range, maintain preferred distance
  let targetX = target.x;
  let targetY = target.y;
  
  if ((target.type === 'fortress' || target.type === 'hero') && dist <= heroRange) {
    const preferredDistance = FP.mul(heroRange, HERO_PREFERRED_COMBAT_DISTANCE_RATIO);
    
    // If closer than preferred distance, calculate position to maintain distance from enemy
    if (dist < preferredDistance && dist > 0) {
      // Direction from enemy to hero (away from enemy)
      const awayFromEnemyDx = FP.sub(hero.x, target.x);
      const awayFromEnemyDy = FP.sub(hero.y, target.y);
      const awayDistSq = FP.add(FP.mul(awayFromEnemyDx, awayFromEnemyDx), FP.mul(awayFromEnemyDy, awayFromEnemyDy));
      
      if (awayDistSq > 0) {
        const normalized = FP.normalize2D(awayFromEnemyDx, awayFromEnemyDy);
        const offsetX = FP.mul(normalized.x, preferredDistance);
        const offsetY = FP.mul(normalized.y, preferredDistance);
        
        // Preferred position is enemy position + offset (maintaining preferred distance from enemy)
        targetX = FP.add(target.x, offsetX);
        targetY = FP.add(target.y, offsetY);
        
        // Recalculate direction to preferred position
        const newDx = FP.sub(targetX, hero.x);
        const newDy = FP.sub(targetY, hero.y);
        const newDistSq = FP.add(FP.mul(newDx, newDx), FP.mul(newDy, newDy));
        
        if (newDistSq > 0) {
          const newDist = FP.sqrt(newDistSq);
          if (newDist > 0) {
            // Get hero speed from definition (moveSpeed is already in FP format!)
            const def = getHeroById(hero.definitionId);
            const baseSpeed = def ? def.baseStats.moveSpeed : FP.fromFloat(0.1);

            const vx = FP.div(FP.mul(newDx, baseSpeed), newDist);
            const vy = FP.div(FP.mul(newDy, baseSpeed), newDist);

            return { vx, vy };
          }
        }
      }
    }
  }

  // Get hero speed from definition (moveSpeed is already in FP format!)
  const def = getHeroById(hero.definitionId);
  const baseSpeed = def ? def.baseStats.moveSpeed : FP.fromFloat(0.1);

  const vx = FP.div(FP.mul(dx, baseSpeed), dist);
  const vy = FP.div(FP.mul(dy, baseSpeed), dist);

  return { vx, vy };
}

// ============================================================================
// FORTRESS AI
// ============================================================================

/**
 * Select target for fortress attack in arena battle
 *
 * Priority:
 * 1. Closest enemy hero in range
 * 2. Enemy fortress (when no heroes available)
 */
export function selectFortressTarget(
  fortress: ArenaFortress,
  ownSide: 'left' | 'right',
  state: ArenaState,
  attackRange: number
): ArenaTarget {
  const enemySide = ownSide === 'left' ? state.right : state.left;
  const rangeSq = FP.mul(attackRange, attackRange);

  // Find closest enemy hero in range
  const aliveEnemyHeroes = getAliveHeroes(enemySide);
  let closestHero: ActiveHero | null = null;
  let closestDistSq = Infinity;

  for (let i = 0; i < aliveEnemyHeroes.length; i++) {
    const enemyHero = aliveEnemyHeroes[i];
    const distSq = distanceSquared(fortress.x, fortress.y, enemyHero.x, enemyHero.y);

    if (distSq <= rangeSq && distSq < closestDistSq) {
      closestHero = enemyHero;
      closestDistSq = distSq;
    }
  }

  if (closestHero) {
    return {
      type: 'hero',
      x: closestHero.x,
      y: closestHero.y,
      targetId: closestHero.definitionId,
      targetIndex: enemySide.heroes.indexOf(closestHero),
    };
  }

  // No heroes available - attack enemy fortress directly
  return {
    type: 'fortress',
    x: enemySide.fortress.x,
    y: enemySide.fortress.y,
  };
}
