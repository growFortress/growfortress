/**
 * Arena PvP AI - Targeting Logic
 *
 * Handles target selection for heroes and turrets in arena battles.
 *
 * Priority rules:
 * - Heroes: Attack enemy fortress (priority) > Attack enemy heroes
 * - Turrets: Attack enemy heroes (priority) > Attack enemy fortress
 */

import { FP } from '../fixed.js';
import type { ActiveHero, ActiveTurret } from '../types.js';
import type { ArenaState, ArenaSide, ArenaFortress } from './arena-state.js';
import { getHeroById, calculateHeroStats } from '../data/heroes.js';
import { getTurretById, calculateTurretStats } from '../data/turrets.js';

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
  return FP.fromFloat(stats.range);
}

/**
 * Get turret's attack range from definition
 */
function getTurretRange(turret: ActiveTurret): number {
  const def = getTurretById(turret.definitionId);
  if (!def) return FP.fromInt(8); // Default range

  const stats = calculateTurretStats(def, turret.currentClass, turret.tier);
  // stats.range is already in fixed-point format
  return stats.range;
}

/**
 * Find alive heroes on a side
 */
function getAliveHeroes(side: ArenaSide): ActiveHero[] {
  return side.heroes.filter(h => h.state !== 'dead' && h.currentHp > 0);
}

// ============================================================================
// HERO AI
// ============================================================================

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

  // Priority 1: Attack enemy fortress if in range
  const fortressDist = distanceSquared(
    hero.x,
    hero.y,
    enemySide.fortress.x,
    enemySide.fortress.y
  );
  const fortressRangeSq = FP.mul(heroRange, heroRange);

  if (fortressDist <= fortressRangeSq) {
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

    if (distSq <= fortressRangeSq && distSq < closestDistSq) {
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
 */
export function getHeroMovementDirection(
  hero: ActiveHero,
  target: ArenaTarget
): { vx: number; vy: number } {
  if (target.type === 'none') {
    return { vx: 0, vy: 0 };
  }

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

  // Get hero speed from definition (moveSpeed is already in FP format!)
  const def = getHeroById(hero.definitionId);
  const baseSpeed = def ? def.baseStats.moveSpeed : FP.fromFloat(0.1);

  const vx = FP.div(FP.mul(dx, baseSpeed), dist);
  const vy = FP.div(FP.mul(dy, baseSpeed), dist);

  return { vx, vy };
}

// ============================================================================
// TURRET AI
// ============================================================================

/**
 * Select target for a turret in arena battle
 *
 * Priority:
 * 1. Enemy heroes in range - target closest
 * 2. Enemy fortress (if in range)
 * 3. No target
 */
export function selectTurretTarget(
  turret: ActiveTurret,
  turretX: number,
  turretY: number,
  ownSide: 'left' | 'right',
  state: ArenaState
): ArenaTarget {
  const enemySide = ownSide === 'left' ? state.right : state.left;
  const turretRange = getTurretRange(turret);
  const rangeSq = FP.mul(turretRange, turretRange);

  // Priority 1: Attack enemy heroes in range
  const aliveEnemyHeroes = getAliveHeroes(enemySide);
  let closestHero: ActiveHero | null = null;
  let closestDistSq = Infinity;

  for (let i = 0; i < aliveEnemyHeroes.length; i++) {
    const enemyHero = aliveEnemyHeroes[i];
    const distSq = distanceSquared(turretX, turretY, enemyHero.x, enemyHero.y);

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

  // Priority 2: Attack enemy fortress if in range
  const fortressDistSq = distanceSquared(
    turretX,
    turretY,
    enemySide.fortress.x,
    enemySide.fortress.y
  );

  if (fortressDistSq <= rangeSq) {
    return {
      type: 'fortress',
      x: enemySide.fortress.x,
      y: enemySide.fortress.y,
    };
  }

  // No valid target
  return { type: 'none', x: 0, y: 0 };
}

// ============================================================================
// FORTRESS AI
// ============================================================================

/**
 * Select target for fortress attack in arena battle
 *
 * Priority:
 * 1. Closest enemy hero
 * 2. No target (fortress doesn't attack enemy fortress directly)
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

  // No valid target
  return { type: 'none', x: 0, y: 0 };
}
