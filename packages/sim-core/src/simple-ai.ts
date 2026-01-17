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

/** Find enemy closest to fortress (with priority for dangerous enemies) */
function findClosestToFortress(enemies: Enemy[], fortressX: number): Enemy {
  const fxFP = FP.fromInt(fortressX);
  return enemies.reduce((best, enemy) => {
    const bestScore = calculateTankTargetScore(best, fxFP);
    const enemyScore = calculateTankTargetScore(enemy, fxFP);
    return enemyScore > bestScore ? enemy : best;
  });
}

/** Calculate priority score for tank targeting */
function calculateTankTargetScore(enemy: Enemy, fortressX: number): number {
  let score = 0;

  // Priority 1: Distance to fortress (closer = higher priority)
  // Scale: 0-100 points
  const distToFortress = FP.abs(FP.sub(enemy.x, fortressX));
  score += Math.max(0, 100 - FP.toFloat(distToFortress) * 3);

  // Priority 2: Dangerous enemy types (intercept these first)
  switch (enemy.type) {
    case 'leech':
      score += 30; // Heals on attack, needs to be stopped
      break;
    case 'bruiser':
      score += 25; // High HP enemies need tank attention
      break;
    case 'runner':
      score += 15; // Fast enemies, intercept quickly
      break;
    // Boss-type enemies
    case 'mafia_boss':
    case 'ai_core':
    case 'cosmic_beast':
    case 'dimensional_being':
    case 'god':
      score += 20;
      break;
  }

  // Priority 3: Elite enemies are more dangerous
  if (enemy.isElite) {
    score += 25;
  }

  return score;
}

/** Find enemy with lowest HP (prioritize killable targets and dangerous enemies) */
function findLowestHp(enemies: Enemy[]): Enemy {
  return enemies.reduce((best, enemy) => {
    // Calculate priority score for each enemy
    const bestScore = calculateDpsTargetScore(best);
    const enemyScore = calculateDpsTargetScore(enemy);
    return enemyScore > bestScore ? enemy : best;
  });
}

/** Calculate priority score for DPS targeting */
function calculateDpsTargetScore(enemy: Enemy): number {
  let score = 0;

  // Priority 1: Low HP (inversely proportional)
  // Scale: 0-100 points, enemies close to death are higher priority
  const hpPercent = enemy.hp / enemy.maxHp;
  score += (1 - hpPercent) * 100;

  // Priority 2: Dangerous enemy types (finish them first)
  switch (enemy.type) {
    case 'leech':
      score += 30; // High priority - heals on attack
      break;
    case 'bruiser':
      score += 15; // High HP enemies need focused fire
      break;
    // Boss-type enemies
    case 'mafia_boss':
    case 'ai_core':
    case 'cosmic_beast':
    case 'dimensional_being':
    case 'god':
      score += 20;
      break;
  }

  // Priority 3: Prefer non-frozen/stunned enemies (don't waste damage on CCd)
  const isHardCCd = enemy.activeEffects.some(
    e => (e.type === 'freeze' || e.type === 'stun') && e.remainingTicks > 0
  );
  if (isHardCCd) {
    score -= 30; // Lower priority for CCd enemies
  }

  // Priority 4: Elite enemies
  if (enemy.isElite) {
    score += 15;
  }

  return score;
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
