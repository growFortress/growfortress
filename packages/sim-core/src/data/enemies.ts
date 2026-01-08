import { EnemyType, PillarId } from '../types.js';
import { FP } from '../fixed.js';
import { getPillarForWave } from './pillars.js';

/**
 * Enemy archetype definitions
 */
export interface EnemyArchetype {
  type: EnemyType;
  baseHp: number;
  baseSpeed: number;        // Units per tick (will be converted to fixed-point)
  baseDamage: number;
  goldReward: number;
  dustReward: number;
  description: string;
}

export const ENEMY_ARCHETYPES: Record<EnemyType, EnemyArchetype> = {
  // Base enemies
  runner: {
    type: 'runner',
    baseHp: 23,
    baseSpeed: 2.8,
    baseDamage: 6,
    goldReward: 2,
    dustReward: 1,
    description: 'Fast but fragile',
  },
  bruiser: {
    type: 'bruiser',
    baseHp: 115,
    baseSpeed: 1.0,
    baseDamage: 17,
    goldReward: 7,
    dustReward: 3,
    description: 'Slow and tanky',
  },
  leech: {
    type: 'leech',
    baseHp: 46,
    baseSpeed: 2.0,
    baseDamage: 4,
    goldReward: 5,
    dustReward: 2,
    description: 'Heals on hit',
  },

  // Streets Pillar enemies
  gangster: {
    type: 'gangster',
    baseHp: 29,
    baseSpeed: 2.2,
    baseDamage: 9,
    goldReward: 4,
    dustReward: 1,
    description: 'Armed street criminal',
  },
  thug: {
    type: 'thug',
    baseHp: 69,
    baseSpeed: 1.5,
    baseDamage: 14,
    goldReward: 6,
    dustReward: 2,
    description: 'Tough street enforcer',
  },
  mafia_boss: {
    type: 'mafia_boss',
    baseHp: 345,
    baseSpeed: 0.8,
    baseDamage: 29,
    goldReward: 25,
    dustReward: 10,
    description: 'Crime lord with bodyguards',
  },

  // Science Pillar enemies
  robot: {
    type: 'robot',
    baseHp: 52,
    baseSpeed: 1.8,
    baseDamage: 12,
    goldReward: 5,
    dustReward: 2,
    description: 'Mechanical soldier',
  },
  drone: {
    type: 'drone',
    baseHp: 17,
    baseSpeed: 3.0,
    baseDamage: 6,
    goldReward: 3,
    dustReward: 1,
    description: 'Fast flying unit',
  },
  ai_core: {
    type: 'ai_core',
    baseHp: 575,
    baseSpeed: 0.5,
    baseDamage: 35,
    goldReward: 40,
    dustReward: 15,
    description: 'Central AI consciousness',
  },

  // Mutants Pillar enemies
  sentinel: {
    type: 'sentinel',
    baseHp: 230,
    baseSpeed: 1.2,
    baseDamage: 23,
    goldReward: 12,
    dustReward: 5,
    description: 'Mutant-hunting robot',
  },
  mutant_hunter: {
    type: 'mutant_hunter',
    baseHp: 92,
    baseSpeed: 2.0,
    baseDamage: 17,
    goldReward: 7,
    dustReward: 3,
    description: 'Human mutant hunter',
  },

  // Cosmos Pillar enemies
  kree_soldier: {
    type: 'kree_soldier',
    baseHp: 80,
    baseSpeed: 1.8,
    baseDamage: 14,
    goldReward: 7,
    dustReward: 3,
    description: 'Kree Empire warrior',
  },
  skrull: {
    type: 'skrull',
    baseHp: 58,
    baseSpeed: 2.0,
    baseDamage: 12,
    goldReward: 6,
    dustReward: 2,
    description: 'Shape-shifting alien',
  },
  cosmic_beast: {
    type: 'cosmic_beast',
    baseHp: 460,
    baseSpeed: 1.0,
    baseDamage: 40,
    goldReward: 30,
    dustReward: 12,
    description: 'Massive space creature',
  },

  // Magic Pillar enemies
  demon: {
    type: 'demon',
    baseHp: 104,
    baseSpeed: 1.5,
    baseDamage: 21,
    goldReward: 9,
    dustReward: 4,
    description: 'Hellish entity',
  },
  sorcerer: {
    type: 'sorcerer',
    baseHp: 46,
    baseSpeed: 1.2,
    baseDamage: 29,
    goldReward: 10,
    dustReward: 5,
    description: 'Dark magic user',
  },
  dimensional_being: {
    type: 'dimensional_being',
    baseHp: 690,
    baseSpeed: 0.6,
    baseDamage: 46,
    goldReward: 50,
    dustReward: 20,
    description: 'Entity from another dimension',
  },

  // Gods Pillar enemies
  einherjar: {
    type: 'einherjar',
    baseHp: 138,
    baseSpeed: 1.5,
    baseDamage: 25,
    goldReward: 12,
    dustReward: 5,
    description: 'Fallen warrior of Valhalla',
  },
  titan: {
    type: 'titan',
    baseHp: 920,
    baseSpeed: 0.4,
    baseDamage: 58,
    goldReward: 60,
    dustReward: 25,
    description: 'Primordial giant',
  },
  god: {
    type: 'god',
    baseHp: 1150,
    baseSpeed: 1.0,
    baseDamage: 69,
    goldReward: 100,
    dustReward: 50,
    description: 'Divine being of immense power',
  },
};

/**
 * Get enemy stats scaled by wave (supports endless mode with cycle scaling)
 */
export function getEnemyStats(
  type: EnemyType,
  wave: number,
  isElite: boolean
): { hp: number; speed: number; damage: number } {
  const archetype = ENEMY_ARCHETYPES[type];

  // Endless mode: calculate cycle and effective wave
  const cycle = Math.floor((wave - 1) / 100);
  const effectiveWave = ((wave - 1) % 100) + 1;

  // Scale HP and damage by effective wave within cycle (12% per wave)
  const waveScale = 1 + (effectiveWave - 1) * 0.12;

  // Cycle scaling: exponential 2^cycle
  // Cycle 0: 1x, Cycle 1: 2x, Cycle 2: 4x, Cycle 3: 8x
  const cycleScale = Math.pow(2, cycle);

  // Combined scaling
  const totalScale = waveScale * cycleScale;

  // Elite multipliers
  const eliteHpMult = isElite ? 3.5 : 1;
  const eliteDmgMult = isElite ? 2.5 : 1;

  return {
    hp: Math.floor(archetype.baseHp * totalScale * eliteHpMult),
    speed: FP.fromFloat(archetype.baseSpeed / 30), // Convert to fixed-point units/tick
    damage: Math.floor(archetype.baseDamage * totalScale * eliteDmgMult),
  };
}

/**
 * Get rewards for killing enemy
 */
export function getEnemyRewards(
  type: EnemyType,
  isElite: boolean,
  goldMult: number,
  dustMult: number
): { gold: number; dust: number } {
  const archetype = ENEMY_ARCHETYPES[type];
  // Elite enemies give 3x rewards (balanced from 5x to prevent late-game economy breaking)
  const eliteMult = isElite ? 3 : 1;

  return {
    gold: Math.floor(archetype.goldReward * eliteMult * goldMult),
    dust: Math.floor(archetype.dustReward * eliteMult * dustMult),
  };
}

/**
 * Wave composition - determines what enemies spawn in each wave
 */
export interface WaveComposition {
  wave: number;
  enemies: Array<{ type: EnemyType; count: number }>;
  eliteChance: number;        // Chance for any enemy to be elite (0-1)
  spawnIntervalTicks: number; // Ticks between spawns
}

/**
 * Pillar-specific enemy configurations
 */
const PILLAR_ENEMIES: Record<PillarId, {
  common: EnemyType[];
  elite: EnemyType[];
  boss: EnemyType[];
}> = {
  streets: {
    common: ['gangster', 'thug', 'runner'],
    elite: ['thug', 'gangster'],
    boss: ['mafia_boss'],
  },
  science: {
    common: ['drone', 'robot', 'runner'],
    elite: ['robot', 'drone'],
    boss: ['ai_core'],
  },
  mutants: {
    common: ['mutant_hunter', 'runner', 'bruiser'],
    elite: ['sentinel', 'mutant_hunter'],
    boss: ['sentinel'],
  },
  cosmos: {
    common: ['kree_soldier', 'skrull', 'runner'],
    elite: ['kree_soldier', 'skrull'],
    boss: ['cosmic_beast'],
  },
  magic: {
    common: ['demon', 'sorcerer', 'leech'],
    elite: ['demon', 'sorcerer'],
    boss: ['dimensional_being'],
  },
  gods: {
    common: ['einherjar', 'bruiser', 'runner'],
    elite: ['einherjar', 'titan'],
    boss: ['god', 'titan'],
  },
};

/**
 * Generate wave composition based on wave number
 * Uses pillar-specific enemies when appropriate
 * Supports endless mode with cycle scaling
 */
export function getWaveComposition(wave: number, tickHz: number): WaveComposition {
  // Endless mode: calculate cycle and effective wave
  const cycle = Math.floor((wave - 1) / 100);
  const effectiveWave = ((wave - 1) % 100) + 1;

  // Enemy count scales with actual wave (more enemies in higher cycles)
  const baseEnemies = 5 + wave * 3;

  // Elite chance continues scaling, caps at 50% (increased from 30% for endless)
  const eliteChance = Math.min(0.05 + wave * 0.005, 0.5);

  // Spawn interval gets faster with cycles (minimum 5 ticks)
  const baseInterval = Math.max(tickHz - effectiveWave * 2, tickHz / 2);
  const spawnInterval = Math.max(baseInterval - cycle * 5, 5);

  const enemies: Array<{ type: EnemyType; count: number }> = [];

  // Get current pillar for this wave (handles cycles automatically)
  const pillar = getPillarForWave(wave);

  if (pillar) {
    // Use pillar-specific enemies
    const pillarEnemies = PILLAR_ENEMIES[pillar.id];
    const isBossWave = effectiveWave % 10 === 0; // Every 10th effective wave is a boss wave
    const waveInPillar = effectiveWave - pillar.waveRange.start + 1;

    if (isBossWave) {
      // Boss wave: fewer enemies but includes a boss
      const bossType = pillarEnemies.boss[wave % pillarEnemies.boss.length];
      enemies.push({ type: bossType, count: 1 });

      // Add some elite guards
      const guardType = pillarEnemies.elite[0];
      enemies.push({ type: guardType, count: Math.floor(baseEnemies * 0.3) });

      // Add common enemies
      const commonType = pillarEnemies.common[0];
      enemies.push({ type: commonType, count: Math.floor(baseEnemies * 0.4) });
    } else if (waveInPillar <= 2) {
      // Early pillar waves: easier composition
      const common1 = pillarEnemies.common[0];
      const common2 = pillarEnemies.common[1] || pillarEnemies.common[0];
      enemies.push({ type: common1, count: Math.floor(baseEnemies * 0.6) });
      enemies.push({ type: common2, count: Math.floor(baseEnemies * 0.4) });
    } else if (waveInPillar <= 5) {
      // Mid pillar waves: mixed composition
      const common1 = pillarEnemies.common[0];
      const common2 = pillarEnemies.common[1] || pillarEnemies.common[0];
      const elite = pillarEnemies.elite[0];
      enemies.push({ type: common1, count: Math.floor(baseEnemies * 0.4) });
      enemies.push({ type: common2, count: Math.floor(baseEnemies * 0.35) });
      enemies.push({ type: elite, count: Math.floor(baseEnemies * 0.25) });
    } else {
      // Late pillar waves: harder composition
      const common1 = pillarEnemies.common[0];
      const elite1 = pillarEnemies.elite[0];
      const elite2 = pillarEnemies.elite[1] || pillarEnemies.elite[0];
      enemies.push({ type: common1, count: Math.floor(baseEnemies * 0.3) });
      enemies.push({ type: elite1, count: Math.floor(baseEnemies * 0.35) });
      enemies.push({ type: elite2, count: Math.floor(baseEnemies * 0.35) });
    }
  } else {
    // Fallback to base enemies (should not happen with proper pillar setup)
    if (wave <= 2) {
      enemies.push({ type: 'runner', count: baseEnemies });
    } else if (wave <= 5) {
      const runners = Math.floor(baseEnemies * 0.6);
      const bruisers = Math.floor(baseEnemies * 0.3);
      const leeches = baseEnemies - runners - bruisers;
      enemies.push({ type: 'runner', count: runners });
      enemies.push({ type: 'bruiser', count: bruisers });
      enemies.push({ type: 'leech', count: leeches });
    } else {
      const runners = Math.floor(baseEnemies * 0.4);
      const bruisers = Math.floor(baseEnemies * 0.4);
      const leeches = baseEnemies - runners - bruisers;
      enemies.push({ type: 'runner', count: runners });
      enemies.push({ type: 'bruiser', count: bruisers });
      enemies.push({ type: 'leech', count: leeches });
    }
  }

  // Filter out zero-count entries
  const filteredEnemies = enemies.filter(e => e.count > 0);

  return {
    wave,
    enemies: filteredEnemies,
    eliteChance,
    spawnIntervalTicks: Math.floor(spawnInterval),
  };
}
