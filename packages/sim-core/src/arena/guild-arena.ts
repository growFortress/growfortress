/**
 * Guild Arena 5v5 - Heroes-only PvP battle
 *
 * Simplified arena simulation for guild battles.
 * 5 heroes vs 5 heroes, no fortresses, no turrets.
 * Winner is the side that eliminates all enemy heroes first.
 */

import { Xorshift32 } from '../rng.js';
import { getHeroById, calculateHeroStats } from '../data/heroes.js';
import type { HeroDefinition } from '../types.js';

// ============================================================================
// TYPES
// ============================================================================

export interface GuildBattleHero {
  ownerId: string;
  ownerName: string;
  heroId: string;
  tier: 1 | 2 | 3;
  power: number;
}

export interface GuildArenaKeyMoment {
  tick: number;
  type: 'battle_start' | 'attack' | 'kill' | 'skill_used' | 'critical_hit' | 'battle_end';
  attackerId?: string;
  attackerHeroId?: string;
  targetId?: string;
  targetHeroId?: string;
  damage?: number;
  winnerId?: string;
}

export interface GuildArenaKillLog {
  tick: number;
  killerId: string;
  killerHeroId: string;
  killerName: string;
  victimId: string;
  victimHeroId: string;
  victimName: string;
}

export interface GuildArenaMvp {
  ownerId: string;
  heroId: string;
  ownerName: string;
  damage: number;
  kills: number;
}

export interface GuildArenaResult {
  winnerSide: 'attacker' | 'defender' | 'draw';
  winReason: 'elimination' | 'timeout' | 'draw';
  attackerSurvivors: number;
  defenderSurvivors: number;
  attackerTotalDamage: number;
  defenderTotalDamage: number;
  mvp: GuildArenaMvp | null;
  keyMoments: GuildArenaKeyMoment[];
  killLog: GuildArenaKillLog[];
  duration: number;
}

// ============================================================================
// INTERNAL HERO STATE
// ============================================================================

interface ArenaHero {
  ownerId: string;
  ownerName: string;
  heroId: string;
  def: HeroDefinition;
  tier: 1 | 2 | 3;
  power: number;
  hp: number;
  maxHp: number;
  damage: number;
  attackSpeed: number;
  lastAttackTick: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  alive: boolean;
  targetIndex: number;
  stats: {
    damageDealt: number;
    kills: number;
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

const ARENA_WIDTH = 20;
const ARENA_HEIGHT = 15;
const MAX_TICKS = 1800; // 60 seconds at 30Hz
const ATTACK_RANGE = 3;
const MOVE_SPEED = 0.15;

// ============================================================================
// SIMULATION
// ============================================================================

export function runGuildArena(
  attackerHeroes: GuildBattleHero[],
  defenderHeroes: GuildBattleHero[],
  seed: number
): GuildArenaResult {
  const rng = new Xorshift32(seed);

  // Initialize heroes
  const attackers = initializeHeroes(attackerHeroes, 'attacker', rng);
  const defenders = initializeHeroes(defenderHeroes, 'defender', rng);

  const keyMoments: GuildArenaKeyMoment[] = [];
  const killLog: GuildArenaKillLog[] = [];

  // Battle start moment
  keyMoments.push({
    tick: 0,
    type: 'battle_start',
  });

  let tick = 0;

  // Main simulation loop
  while (tick < MAX_TICKS) {
    const attackersAlive = attackers.filter(h => h.alive);
    const defendersAlive = defenders.filter(h => h.alive);

    // Check end conditions
    if (attackersAlive.length === 0 || defendersAlive.length === 0) {
      break;
    }

    // Update all heroes
    // Alternate update order to prevent bias
    if (tick % 2 === 0) {
      updateHeroes(attackers, defenders, tick, rng, keyMoments, killLog);
      updateHeroes(defenders, attackers, tick, rng, keyMoments, killLog);
    } else {
      updateHeroes(defenders, attackers, tick, rng, keyMoments, killLog);
      updateHeroes(attackers, defenders, tick, rng, keyMoments, killLog);
    }

    tick++;
  }

  // Calculate results
  const attackersAlive = attackers.filter(h => h.alive);
  const defendersAlive = defenders.filter(h => h.alive);

  let winnerSide: 'attacker' | 'defender' | 'draw';
  let winReason: 'elimination' | 'timeout' | 'draw';

  if (attackersAlive.length === 0 && defendersAlive.length === 0) {
    winnerSide = 'draw';
    winReason = 'draw';
  } else if (attackersAlive.length === 0) {
    winnerSide = 'defender';
    winReason = 'elimination';
  } else if (defendersAlive.length === 0) {
    winnerSide = 'attacker';
    winReason = 'elimination';
  } else {
    // Timeout - compare remaining HP
    const attackerTotalHp = attackersAlive.reduce((sum, h) => sum + h.hp, 0);
    const defenderTotalHp = defendersAlive.reduce((sum, h) => sum + h.hp, 0);

    if (attackerTotalHp > defenderTotalHp) {
      winnerSide = 'attacker';
      winReason = 'timeout';
    } else if (defenderTotalHp > attackerTotalHp) {
      winnerSide = 'defender';
      winReason = 'timeout';
    } else {
      winnerSide = 'draw';
      winReason = 'draw';
    }
  }

  // Calculate totals
  const attackerTotalDamage = attackers.reduce((sum, h) => sum + h.stats.damageDealt, 0);
  const defenderTotalDamage = defenders.reduce((sum, h) => sum + h.stats.damageDealt, 0);

  // Find MVP (highest damage from winning side, or overall if draw)
  const allHeroes = [...attackers, ...defenders];
  const winningHeroes = winnerSide === 'attacker' ? attackers :
                        winnerSide === 'defender' ? defenders :
                        allHeroes;

  const mvpHero = winningHeroes.reduce((best, h) =>
    h.stats.damageDealt > best.stats.damageDealt ? h : best
  , winningHeroes[0]);

  const mvp: GuildArenaMvp | null = mvpHero ? {
    ownerId: mvpHero.ownerId,
    heroId: mvpHero.heroId,
    ownerName: mvpHero.ownerName,
    damage: mvpHero.stats.damageDealt,
    kills: mvpHero.stats.kills,
  } : null;

  // Battle end moment
  keyMoments.push({
    tick,
    type: 'battle_end',
    winnerId: mvp?.ownerId,
  });

  return {
    winnerSide,
    winReason,
    attackerSurvivors: attackersAlive.length,
    defenderSurvivors: defendersAlive.length,
    attackerTotalDamage,
    defenderTotalDamage,
    mvp,
    keyMoments,
    killLog,
    duration: tick,
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function initializeHeroes(
  heroes: GuildBattleHero[],
  side: 'attacker' | 'defender',
  rng: Xorshift32
): ArenaHero[] {
  const startX = side === 'attacker' ? 2 : ARENA_WIDTH - 2;
  const spacing = ARENA_HEIGHT / (heroes.length + 1);

  return heroes.map((hero, index) => {
    const def = getHeroById(hero.heroId);
    if (!def) {
      throw new Error(`Hero not found: ${hero.heroId}`);
    }

    const stats = calculateHeroStats(def, hero.tier, 1);

    // Scale stats based on power (simplified)
    const powerMultiplier = Math.max(1, hero.power / 1000);

    return {
      ownerId: hero.ownerId,
      ownerName: hero.ownerName,
      heroId: hero.heroId,
      def,
      tier: hero.tier,
      power: hero.power,
      hp: Math.floor(stats.hp * powerMultiplier),
      maxHp: Math.floor(stats.hp * powerMultiplier),
      damage: Math.floor(stats.damage * powerMultiplier),
      attackSpeed: stats.attackSpeed,
      lastAttackTick: -100, // Can attack immediately
      x: startX + (rng.nextFloat() - 0.5) * 2,
      y: spacing * (index + 1) + (rng.nextFloat() - 0.5) * 2,
      vx: 0,
      vy: 0,
      alive: true,
      targetIndex: -1,
      stats: {
        damageDealt: 0,
        kills: 0,
      },
    };
  });
}

function updateHeroes(
  ownHeroes: ArenaHero[],
  enemyHeroes: ArenaHero[],
  tick: number,
  rng: Xorshift32,
  keyMoments: GuildArenaKeyMoment[],
  killLog: GuildArenaKillLog[]
): void {
  for (const hero of ownHeroes) {
    if (!hero.alive) continue;

    const aliveEnemies = enemyHeroes.filter(e => e.alive);
    if (aliveEnemies.length === 0) continue;

    // Select target (random if no current target or target dead)
    if (hero.targetIndex < 0 || !enemyHeroes[hero.targetIndex]?.alive) {
      hero.targetIndex = enemyHeroes.findIndex(e =>
        e === aliveEnemies[Math.floor(rng.nextFloat() * aliveEnemies.length)]
      );
    }

    const target = enemyHeroes[hero.targetIndex];
    if (!target || !target.alive) continue;

    // Calculate distance to target
    const dx = target.x - hero.x;
    const dy = target.y - hero.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Move towards target if out of range
    if (dist > ATTACK_RANGE) {
      const moveX = (dx / dist) * MOVE_SPEED;
      const moveY = (dy / dist) * MOVE_SPEED;
      hero.x += moveX;
      hero.y += moveY;

      // Clamp to arena bounds
      hero.x = Math.max(0, Math.min(ARENA_WIDTH, hero.x));
      hero.y = Math.max(0, Math.min(ARENA_HEIGHT, hero.y));
    }

    // Attack if in range and cooldown ready
    if (dist <= ATTACK_RANGE) {
      const attackInterval = Math.floor(30 / hero.attackSpeed);
      if (tick - hero.lastAttackTick >= attackInterval) {
        hero.lastAttackTick = tick;

        // Calculate damage with some variance
        const variance = 0.9 + rng.nextFloat() * 0.2; // 90%-110%
        const isCrit = rng.nextFloat() < 0.15; // 15% crit chance
        const critMultiplier = isCrit ? 1.5 : 1;
        const damage = Math.floor(hero.damage * variance * critMultiplier);

        // Apply damage
        target.hp -= damage;
        hero.stats.damageDealt += damage;

        // Record critical hit
        if (isCrit && keyMoments.length < 50) {
          keyMoments.push({
            tick,
            type: 'critical_hit',
            attackerId: hero.ownerId,
            attackerHeroId: hero.heroId,
            targetId: target.ownerId,
            targetHeroId: target.heroId,
            damage,
          });
        }

        // Check for kill
        if (target.hp <= 0) {
          target.hp = 0;
          target.alive = false;
          hero.stats.kills++;

          // Record kill
          killLog.push({
            tick,
            killerId: hero.ownerId,
            killerHeroId: hero.heroId,
            killerName: hero.ownerName,
            victimId: target.ownerId,
            victimHeroId: target.heroId,
            victimName: target.ownerName,
          });

          keyMoments.push({
            tick,
            type: 'kill',
            attackerId: hero.ownerId,
            attackerHeroId: hero.heroId,
            targetId: target.ownerId,
            targetHeroId: target.heroId,
          });

          // Force new target selection
          hero.targetIndex = -1;
        }
      }
    }
  }
}
