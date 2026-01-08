/**
 * Simple Role-Based AI for Heroes
 *
 * Replaces complex Utility AI with straightforward role-based targeting:
 * - tank: Intercept closest enemy to fortress
 * - dps: Target lowest HP enemy (finish kills)
 * - support: Stay near allies, target closest enemy
 * - crowd_control: Target largest enemy cluster
 */

import { FP } from './fixed.js';
import type { GameState, Enemy, ActiveHero, HeroRole } from './types.js';
import { getHeroById } from './data/heroes.js';

/** HP threshold for retreat (30%) */
const RETREAT_THRESHOLD = 0.3;

/** Get hero's role from definition */
export function getHeroRole(heroId: string): HeroRole {
  const def = getHeroById(heroId);
  return def?.role ?? 'dps';
}

/** Check if hero should retreat based on HP */
export function shouldHeroRetreat(hero: ActiveHero): boolean {
  return hero.currentHp / hero.maxHp < RETREAT_THRESHOLD;
}

/** Check if hero is a frontliner (tank or aggressive dps) */
export function isFrontliner(heroId: string): boolean {
  const role = getHeroRole(heroId);
  return role === 'tank';
}

/** Check if hero is support role */
export function isSupport(heroId: string): boolean {
  const role = getHeroRole(heroId);
  return role === 'support';
}

/**
 * Select best target for a hero based on role
 */
export function selectTarget(
  hero: ActiveHero,
  enemiesInRange: Enemy[],
  _state: GameState,
  fortressX: number
): Enemy | null {
  if (enemiesInRange.length === 0) return null;

  const role = getHeroRole(hero.definitionId);

  switch (role) {
    case 'tank':
      // Target enemy closest to fortress (intercept)
      return findClosestToFortress(enemiesInRange, fortressX);

    case 'dps':
      // Target lowest HP enemy (secure kills)
      return findLowestHp(enemiesInRange);

    case 'crowd_control':
      // Target enemy in largest cluster (maximize AoE)
      return findInLargestCluster(enemiesInRange);

    case 'support':
    default:
      // Target closest enemy
      return findClosestToHero(hero, enemiesInRange);
  }
}

/** Find enemy closest to fortress */
function findClosestToFortress(enemies: Enemy[], fortressX: number): Enemy {
  const fxFP = FP.fromInt(fortressX);
  return enemies.reduce((closest, enemy) => {
    const distA = FP.abs(FP.sub(closest.x, fxFP));
    const distB = FP.abs(FP.sub(enemy.x, fxFP));
    return distB < distA ? enemy : closest;
  });
}

/** Find enemy with lowest HP */
function findLowestHp(enemies: Enemy[]): Enemy {
  return enemies.reduce((lowest, enemy) =>
    enemy.hp < lowest.hp ? enemy : lowest
  );
}

/** Find enemy closest to hero */
function findClosestToHero(hero: ActiveHero, enemies: Enemy[]): Enemy {
  return enemies.reduce((closest, enemy) => {
    const distA = FP.distSq(hero.x, hero.y, closest.x, closest.y);
    const distB = FP.distSq(hero.x, hero.y, enemy.x, enemy.y);
    return distB < distA ? enemy : closest;
  });
}

/** Find enemy in largest cluster (for AoE heroes) */
function findInLargestCluster(enemies: Enemy[]): Enemy {
  const CLUSTER_RADIUS = FP.fromInt(3);

  let bestEnemy = enemies[0];
  let bestClusterSize = 0;

  for (const enemy of enemies) {
    let clusterSize = 0;
    for (const other of enemies) {
      if (FP.distSq(enemy.x, enemy.y, other.x, other.y) <= FP.mul(CLUSTER_RADIUS, CLUSTER_RADIUS)) {
        clusterSize++;
      }
    }
    if (clusterSize > bestClusterSize) {
      bestClusterSize = clusterSize;
      bestEnemy = enemy;
    }
  }

  return bestEnemy;
}

// ============================================================================
// LEGACY API COMPATIBILITY
// ============================================================================

/** Placeholder for battlefield assessment (simplified) */
export interface SimpleBattlefieldState {
  enemyCount: number;
  threatLevel: number;
}

/** Get simple battlefield state */
export function getSimpleBattlefieldState(state: GameState): SimpleBattlefieldState {
  return {
    enemyCount: state.enemies.length,
    threatLevel: state.enemies.length > 10 ? 1.0 : state.enemies.length / 10,
  };
}

/** Reset AI state (no-op for simple AI) */
export function resetSimpleAI(): void {
  // No state to reset in simple AI
}
