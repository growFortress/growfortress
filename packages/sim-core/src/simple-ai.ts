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

// ============================================================================
// TARGET DISTRIBUTION TRACKING
// ============================================================================

/** Track how many heroes are targeting each enemy (per tick) */
let heroTargetCounts: Map<number, number> = new Map();
let lastTargetCountTick: number = -1;

/**
 * Reset target counts at the start of each tick
 * Called from hero.ts updateHeroes()
 */
export function resetTargetCounts(currentTick: number): void {
  if (currentTick !== lastTargetCountTick) {
    heroTargetCounts.clear();
    lastTargetCountTick = currentTick;
  }
}

/**
 * Register that a hero is targeting an enemy
 */
export function registerTarget(enemyId: number): void {
  heroTargetCounts.set(enemyId, (heroTargetCounts.get(enemyId) || 0) + 1);
}

/**
 * Get count of heroes already targeting an enemy
 */
export function getTargetCount(enemyId: number): number {
  return heroTargetCounts.get(enemyId) || 0;
}

// ============================================================================
// ROLE HELPERS
// ============================================================================

/** Get hero's role from definition */
export function getHeroRole(heroId: string): HeroRole {
  const def = getHeroById(heroId);
  return def?.role ?? 'dps';
}

/** Check if hero should retreat - disabled, heroes have lifesteal now */
export function shouldHeroRetreat(_hero: ActiveHero): boolean {
  // Heroes no longer retreat - they have lifesteal to sustain in combat
  return false;
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
 * Select best target for a hero based on role with intelligent distribution
 * Heroes prefer targets that aren't already being attacked by others
 */
export function selectTarget(
  hero: ActiveHero,
  enemiesInRange: Enemy[],
  state: GameState,
  fortressX: number
): Enemy | null {
  if (enemiesInRange.length === 0) return null;

  // Target stickiness: if current target is still valid, prefer to keep it
  // This prevents heroes from constantly switching targets
  if (hero.currentTargetId !== undefined) {
    const currentTarget = enemiesInRange.find(e => e.id === hero.currentTargetId);
    if (currentTarget) {
      // Check if this target is heavily over-targeted
      const targetCount = getTargetCount(currentTarget.id);
      const combatHeroCount = state.heroes.filter(h => h.state === 'combat').length;
      const maxPerTarget = Math.max(1, Math.ceil(combatHeroCount / Math.max(1, enemiesInRange.length)));

      // Keep current target unless it's over-targeted AND there are alternatives
      if (targetCount <= maxPerTarget + 1 || enemiesInRange.length === 1) {
        registerTarget(currentTarget.id);
        return currentTarget;
      }
    }
  }

  // Select new target with distribution awareness
  const target = selectBestTargetWithDistribution(hero, enemiesInRange, fortressX);

  if (target) {
    registerTarget(target.id);
  }

  return target;
}

/**
 * Select best target considering both role priorities and target distribution
 */
function selectBestTargetWithDistribution(
  hero: ActiveHero,
  enemies: Enemy[],
  fortressX: number
): Enemy | null {
  if (enemies.length === 0) return null;
  if (enemies.length === 1) return enemies[0];

  const role = getHeroRole(hero.definitionId);
  const fxFP = FP.fromInt(fortressX);

  // Score each enemy based on role + distribution bonus
  const scoredEnemies = enemies.map(enemy => {
    let baseScore: number;

    switch (role) {
      case 'tank':
        baseScore = calculateTankTargetScore(enemy, fxFP);
        break;
      case 'dps':
        baseScore = calculateDpsTargetScore(enemy);
        break;
      case 'crowd_control':
        baseScore = calculateCCTargetScore(enemy, enemies);
        break;
      case 'support':
      default:
        // Support targets closest enemy
        baseScore = 100 - FP.toFloat(FP.distSq(hero.x, hero.y, enemy.x, enemy.y)) * 0.5;
        break;
    }

    // Distribution bonus: prefer targets with fewer attackers
    // +25 points for each hero NOT targeting this enemy (up to +75)
    const existingTargeters = getTargetCount(enemy.id);
    const distributionBonus = Math.max(0, (3 - existingTargeters) * 25);

    return {
      enemy,
      score: baseScore + distributionBonus,
    };
  });

  // Sort by score descending and pick best
  scoredEnemies.sort((a, b) => b.score - a.score);
  return scoredEnemies[0].enemy;
}

/**
 * Calculate priority score for crowd control targeting (cluster-based)
 */
function calculateCCTargetScore(enemy: Enemy, allEnemies: Enemy[]): number {
  const CLUSTER_RADIUS = FP.fromInt(3);
  const clusterRadiusSq = FP.mul(CLUSTER_RADIUS, CLUSTER_RADIUS);

  let clusterSize = 0;
  for (const other of allEnemies) {
    if (FP.distSq(enemy.x, enemy.y, other.x, other.y) <= clusterRadiusSq) {
      clusterSize++;
    }
  }

  // Score based on cluster size (0-100 scale)
  return clusterSize * 20;
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

/** Reset AI state - clears target distribution tracking */
export function resetSimpleAI(): void {
  heroTargetCounts.clear();
  lastTargetCountTick = -1;
}
