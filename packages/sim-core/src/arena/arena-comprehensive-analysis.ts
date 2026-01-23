/**
 * ARENA PVP - COMPREHENSIVE DATA ANALYSIS
 *
 * Zbiera szczegółowe dane z wielu symulacji walk:
 * - Statystyki czasowe (czas trwania, DPS, ticki do pierwszego trafienia)
 * - Efektywność bohaterów (damage dealt, survival time, kill participation)
 * - Skalowanie tieru i poziomu
 * - Efektywność armor
 * - Wpływ klas twierdzy
 * - Korelacja power difference vs win rate
 *
 * Run: npx tsx packages/sim-core/src/arena/arena-comprehensive-analysis.ts
 */

import { ArenaSimulation } from './arena-simulation.js';
import type { ArenaBuildConfig, ArenaHeroConfig } from './arena-state.js';
import type { FortressClass } from '../types.js';

// ============================================================================
// TYPES
// ============================================================================

interface MatchResult {
  seed: number;
  leftBuild: string;
  rightBuild: string;
  winner: 'left' | 'right' | 'draw';
  winReason: string;
  durationTicks: number;
  durationSeconds: number;
  leftDamageDealt: number;
  rightDamageDealt: number;
  leftFortressHp: { start: number; end: number; armor: number };
  rightFortressHp: { start: number; end: number; armor: number };
  leftHeroes: HeroMatchStats[];
  rightHeroes: HeroMatchStats[];
  firstDamageTick: number;
  firstDeathTick: number | null;
}

interface HeroMatchStats {
  heroId: string;
  tier: number;
  armor: number;
  startHp: number;
  endHp: number;
  survived: boolean;
  deathTick: number | null;
  survivalTime: number; // ticks alive
}

interface BuildStats {
  name: string;
  commanderLevel: number;
  tier: number; // average tier
  totalPower: number;
  fortressClass: FortressClass;
  heroCount: number;
  wins: number;
  losses: number;
  draws: number;
  totalDamageDealt: number;
  totalDamageReceived: number;
  avgBattleDuration: number;
  avgDPS: number;
  fortressArmor: number;
  avgHeroArmor: number;
}

interface HeroStats {
  heroId: string;
  appearances: number;
  totalDamageDealt: number;
  totalDamageReceived: number;
  kills: number;
  deaths: number;
  avgSurvivalTime: number;
  winContribution: number; // wins where this hero survived
}

interface TierAnalysis {
  tier: number;
  avgArmor: number;
  avgHp: number;
  avgDamageDealt: number;
  avgSurvivalTime: number;
  deathRate: number;
}

interface PowerDifferentialAnalysis {
  powerDiff: string; // e.g., "0-10%", "10-20%"
  matches: number;
  strongerWins: number;
  weakerWins: number;
  draws: number;
  avgDurationSeconds: number;
}

// ============================================================================
// BUILD DEFINITIONS
// ============================================================================

function createHeroConfig(
  heroId: string,
  tier: 1 | 2 | 3 = 1,
  damageLevel: number = 0,
  hpLevel: number = 0
): ArenaHeroConfig {
  return {
    heroId,
    tier,
    statUpgrades: {
      hp: hpLevel,
      damage: damageLevel,
      attackSpeed: 0,
      range: 0,
      critChance: 0,
      critMultiplier: 0,
      armor: 0,
      dodge: 0,
    },
  };
}

// Extended bot pool for more variety
const ALL_BUILDS: { name: string; build: ArenaBuildConfig }[] = [
  // TIER 1 - NOOBS
  {
    name: 'Noob_Natural',
    build: {
      ownerId: 'noob-1',
      ownerName: 'Noob_Natural',
      fortressClass: 'natural',
      commanderLevel: 1,
      heroIds: ['vanguard', 'storm'],
      damageBonus: 0,
      hpBonus: 0,
      heroConfigs: [
        createHeroConfig('vanguard', 1, 0, 0),
        createHeroConfig('storm', 1, 0, 0),
      ],
    },
  },
  {
    name: 'Noob_Fire',
    build: {
      ownerId: 'noob-2',
      ownerName: 'Noob_Fire',
      fortressClass: 'fire',
      commanderLevel: 1,
      heroIds: ['pyro', 'scout'],
      damageBonus: 0,
      hpBonus: 0,
      heroConfigs: [
        createHeroConfig('pyro', 1, 0, 0),
        createHeroConfig('scout', 1, 0, 0),
      ],
    },
  },
  {
    name: 'Noob_Ice',
    build: {
      ownerId: 'noob-3',
      ownerName: 'Noob_Ice',
      fortressClass: 'ice',
      commanderLevel: 1,
      heroIds: ['medic', 'vanguard'],
      damageBonus: 0,
      hpBonus: 0,
      heroConfigs: [
        createHeroConfig('medic', 1, 0, 0),
        createHeroConfig('vanguard', 1, 0, 0),
      ],
    },
  },

  // TIER 2 - MID LEVEL
  {
    name: 'Mid_Lightning',
    build: {
      ownerId: 'mid-1',
      ownerName: 'Mid_Lightning',
      fortressClass: 'lightning',
      commanderLevel: 10,
      heroIds: ['storm', 'frost', 'vanguard'],
      damageBonus: 0.10,
      hpBonus: 0.10,
      heroConfigs: [
        createHeroConfig('storm', 2, 2, 2),
        createHeroConfig('frost', 2, 2, 2),
        createHeroConfig('vanguard', 2, 2, 2),
      ],
    },
  },
  {
    name: 'Mid_Fire',
    build: {
      ownerId: 'mid-2',
      ownerName: 'Mid_Fire',
      fortressClass: 'fire',
      commanderLevel: 12,
      heroIds: ['pyro', 'forge', 'storm'],
      damageBonus: 0.12,
      hpBonus: 0.08,
      heroConfigs: [
        createHeroConfig('pyro', 2, 3, 1),
        createHeroConfig('forge', 2, 3, 1),
        createHeroConfig('storm', 2, 2, 2),
      ],
    },
  },
  {
    name: 'Mid_Ice',
    build: {
      ownerId: 'mid-3',
      ownerName: 'Mid_Ice',
      fortressClass: 'ice',
      commanderLevel: 15,
      heroIds: ['frost', 'medic', 'vanguard'],
      damageBonus: 0.08,
      hpBonus: 0.15,
      heroConfigs: [
        createHeroConfig('frost', 2, 2, 3),
        createHeroConfig('medic', 2, 1, 3),
        createHeroConfig('vanguard', 2, 2, 3),
      ],
    },
  },

  // TIER 3 - ADVANCED
  {
    name: 'Advanced_Ice',
    build: {
      ownerId: 'adv-1',
      ownerName: 'Advanced_Ice',
      fortressClass: 'ice',
      commanderLevel: 20,
      heroIds: ['frost', 'omega', 'medic', 'vanguard'],
      damageBonus: 0.20,
      hpBonus: 0.20,
      heroConfigs: [
        createHeroConfig('frost', 3, 4, 4),
        createHeroConfig('omega', 2, 3, 3),
        createHeroConfig('medic', 2, 2, 4),
        createHeroConfig('vanguard', 3, 4, 4),
      ],
    },
  },
  {
    name: 'Advanced_Lightning',
    build: {
      ownerId: 'adv-2',
      ownerName: 'Advanced_Lightning',
      fortressClass: 'lightning',
      commanderLevel: 22,
      heroIds: ['storm', 'rift', 'spectre', 'forge'],
      damageBonus: 0.25,
      hpBonus: 0.18,
      heroConfigs: [
        createHeroConfig('storm', 3, 5, 3),
        createHeroConfig('rift', 2, 4, 3),
        createHeroConfig('spectre', 3, 5, 3),
        createHeroConfig('forge', 2, 3, 3),
      ],
    },
  },
  {
    name: 'Advanced_Fire',
    build: {
      ownerId: 'adv-3',
      ownerName: 'Advanced_Fire',
      fortressClass: 'fire',
      commanderLevel: 25,
      heroIds: ['pyro', 'inferno', 'titan', 'storm'],
      damageBonus: 0.30,
      hpBonus: 0.15,
      heroConfigs: [
        createHeroConfig('pyro', 3, 5, 3),
        createHeroConfig('inferno', 3, 6, 3),
        createHeroConfig('titan', 2, 4, 4),
        createHeroConfig('storm', 3, 5, 3),
      ],
    },
  },

  // TIER 4 - EXPERT
  {
    name: 'Expert_Fire',
    build: {
      ownerId: 'exp-1',
      ownerName: 'Expert_Fire',
      fortressClass: 'fire',
      commanderLevel: 30,
      heroIds: ['inferno', 'pyro', 'rift', 'titan'],
      damageBonus: 0.35,
      hpBonus: 0.35,
      heroConfigs: [
        createHeroConfig('inferno', 3, 7, 7),
        createHeroConfig('pyro', 3, 7, 7),
        createHeroConfig('rift', 3, 6, 6),
        createHeroConfig('titan', 3, 8, 8),
      ],
    },
  },
  {
    name: 'Expert_Tech',
    build: {
      ownerId: 'exp-2',
      ownerName: 'Expert_Tech',
      fortressClass: 'tech',
      commanderLevel: 30,
      heroIds: ['forge', 'spectre', 'storm', 'vanguard'],
      damageBonus: 0.50,
      hpBonus: 0.50,
      heroConfigs: [
        createHeroConfig('forge', 3, 10, 10),
        createHeroConfig('spectre', 3, 10, 10),
        createHeroConfig('storm', 3, 10, 10),
        createHeroConfig('vanguard', 3, 10, 10),
      ],
    },
  },
  {
    name: 'Expert_Ice',
    build: {
      ownerId: 'exp-3',
      ownerName: 'Expert_Ice',
      fortressClass: 'ice',
      commanderLevel: 35,
      heroIds: ['frost', 'omega', 'medic', 'titan'],
      damageBonus: 0.40,
      hpBonus: 0.45,
      heroConfigs: [
        createHeroConfig('frost', 3, 8, 9),
        createHeroConfig('omega', 3, 9, 9),
        createHeroConfig('medic', 3, 6, 10),
        createHeroConfig('titan', 3, 8, 10),
      ],
    },
  },
];

// ============================================================================
// SIMULATION RUNNER
// ============================================================================

function runMatch(
  leftBuild: { name: string; build: ArenaBuildConfig },
  rightBuild: { name: string; build: ArenaBuildConfig },
  seed: number
): MatchResult {
  const simulation = new ArenaSimulation(seed, leftBuild.build, rightBuild.build);

  // Store initial state
  const initialLeftFortressHp = simulation.state.left.fortress.hp;
  const initialRightFortressHp = simulation.state.right.fortress.hp;
  const initialLeftHeroesHp = simulation.state.left.heroes.map(h => h.currentHp);
  const initialRightHeroesHp = simulation.state.right.heroes.map(h => h.currentHp);

  let firstDamageTick = -1;
  let firstDeathTick: number | null = null;
  const leftHeroDeaths: (number | null)[] = simulation.state.left.heroes.map(() => null);
  const rightHeroDeaths: (number | null)[] = simulation.state.right.heroes.map(() => null);

  let prevLeftFortressHp = initialLeftFortressHp;
  let prevRightFortressHp = initialRightFortressHp;

  // Run simulation tick by tick
  while (!simulation.state.ended) {
    const tick = simulation.state.tick;

    simulation.step();

    // Track first damage
    if (firstDamageTick === -1) {
      if (simulation.state.left.fortress.hp < prevLeftFortressHp ||
          simulation.state.right.fortress.hp < prevRightFortressHp) {
        firstDamageTick = tick;
      }
    }

    // Track hero deaths
    simulation.state.left.heroes.forEach((h, i) => {
      if (h.currentHp <= 0 && leftHeroDeaths[i] === null) {
        leftHeroDeaths[i] = tick;
        if (firstDeathTick === null) firstDeathTick = tick;
      }
    });
    simulation.state.right.heroes.forEach((h, i) => {
      if (h.currentHp <= 0 && rightHeroDeaths[i] === null) {
        rightHeroDeaths[i] = tick;
        if (firstDeathTick === null) firstDeathTick = tick;
      }
    });

    prevLeftFortressHp = simulation.state.left.fortress.hp;
    prevRightFortressHp = simulation.state.right.fortress.hp;
  }

  const result = simulation.getResult();

  return {
    seed,
    leftBuild: leftBuild.name,
    rightBuild: rightBuild.name,
    winner: result.winner === null ? 'draw' : result.winner,
    winReason: result.winReason,
    durationTicks: result.duration,
    durationSeconds: result.duration / 30,
    leftDamageDealt: result.leftStats.damageDealt,
    rightDamageDealt: result.rightStats.damageDealt,
    leftFortressHp: {
      start: initialLeftFortressHp,
      end: simulation.state.left.fortress.hp,
      armor: simulation.state.left.fortress.armor,
    },
    rightFortressHp: {
      start: initialRightFortressHp,
      end: simulation.state.right.fortress.hp,
      armor: simulation.state.right.fortress.armor,
    },
    leftHeroes: simulation.state.left.heroes.map((h, i) => ({
      heroId: h.definitionId,
      tier: h.tier,
      armor: h.arenaArmor ?? 0,
      startHp: initialLeftHeroesHp[i],
      endHp: Math.max(0, h.currentHp),
      survived: h.currentHp > 0,
      deathTick: leftHeroDeaths[i],
      survivalTime: leftHeroDeaths[i] ?? result.duration,
    })),
    rightHeroes: simulation.state.right.heroes.map((h, i) => ({
      heroId: h.definitionId,
      tier: h.tier,
      armor: h.arenaArmor ?? 0,
      startHp: initialRightHeroesHp[i],
      endHp: Math.max(0, h.currentHp),
      survived: h.currentHp > 0,
      deathTick: rightHeroDeaths[i],
      survivalTime: rightHeroDeaths[i] ?? result.duration,
    })),
    firstDamageTick: firstDamageTick === -1 ? 0 : firstDamageTick,
    firstDeathTick,
  };
}

// ============================================================================
// DATA COLLECTION
// ============================================================================

function runFullTournament(builds: typeof ALL_BUILDS, baseSeed: number): MatchResult[] {
  const results: MatchResult[] = [];
  let matchIndex = 0;

  for (let i = 0; i < builds.length; i++) {
    for (let j = i + 1; j < builds.length; j++) {
      const seed = baseSeed + matchIndex;
      results.push(runMatch(builds[i], builds[j], seed));
      matchIndex++;
    }
  }

  return results;
}

function runMultipleTournaments(
  builds: typeof ALL_BUILDS,
  tournamentCount: number,
  baseSeed: number
): MatchResult[] {
  const allResults: MatchResult[] = [];

  for (let t = 0; t < tournamentCount; t++) {
    const tournamentSeed = baseSeed + t * 10000;
    const results = runFullTournament(builds, tournamentSeed);
    allResults.push(...results);
  }

  return allResults;
}

// ============================================================================
// ANALYSIS FUNCTIONS
// ============================================================================

function analyzeBuildStats(results: MatchResult[], builds: typeof ALL_BUILDS): Map<string, BuildStats> {
  const stats = new Map<string, BuildStats>();

  // Initialize stats for all builds
  for (const b of builds) {
    const avgTier = b.build.heroConfigs
      ? b.build.heroConfigs.reduce((sum, h) => sum + (h.tier ?? 1), 0) / b.build.heroConfigs.length
      : 1;

    stats.set(b.name, {
      name: b.name,
      commanderLevel: b.build.commanderLevel,
      tier: avgTier,
      totalPower: b.build.commanderLevel * 10 + avgTier * 20 + (b.build.damageBonus ?? 0) * 100 + (b.build.hpBonus ?? 0) * 100,
      fortressClass: b.build.fortressClass,
      heroCount: b.build.heroIds.length,
      wins: 0,
      losses: 0,
      draws: 0,
      totalDamageDealt: 0,
      totalDamageReceived: 0,
      avgBattleDuration: 0,
      avgDPS: 0,
      fortressArmor: 0,
      avgHeroArmor: 0,
    });
  }

  // Collect data from matches
  for (const match of results) {
    const left = stats.get(match.leftBuild)!;
    const right = stats.get(match.rightBuild)!;

    // Update wins/losses
    if (match.winner === 'left') {
      left.wins++;
      right.losses++;
    } else if (match.winner === 'right') {
      right.wins++;
      left.losses++;
    } else {
      left.draws++;
      right.draws++;
    }

    // Update damage stats
    left.totalDamageDealt += match.leftDamageDealt;
    left.totalDamageReceived += match.rightDamageDealt;
    right.totalDamageDealt += match.rightDamageDealt;
    right.totalDamageReceived += match.leftDamageDealt;

    // Update fortress armor (take latest)
    left.fortressArmor = match.leftFortressHp.armor;
    right.fortressArmor = match.rightFortressHp.armor;

    // Update hero armor (average)
    const leftHeroArmor = match.leftHeroes.reduce((sum, h) => sum + h.armor, 0) / match.leftHeroes.length;
    const rightHeroArmor = match.rightHeroes.reduce((sum, h) => sum + h.armor, 0) / match.rightHeroes.length;
    left.avgHeroArmor = leftHeroArmor;
    right.avgHeroArmor = rightHeroArmor;
  }

  // Calculate averages
  for (const [name, s] of stats) {
    const totalMatches = s.wins + s.losses + s.draws;
    if (totalMatches > 0) {
      const matchesForBuild = results.filter(m => m.leftBuild === name || m.rightBuild === name);
      s.avgBattleDuration = matchesForBuild.reduce((sum, m) => sum + m.durationSeconds, 0) / matchesForBuild.length;
      s.avgDPS = s.totalDamageDealt / matchesForBuild.reduce((sum, m) => sum + m.durationSeconds, 0);
    }
  }

  return stats;
}

function analyzeHeroStats(results: MatchResult[]): Map<string, HeroStats> {
  const stats = new Map<string, HeroStats>();

  for (const match of results) {
    const allHeroes = [
      ...match.leftHeroes.map(h => ({ ...h, won: match.winner === 'left' })),
      ...match.rightHeroes.map(h => ({ ...h, won: match.winner === 'right' })),
    ];

    for (const hero of allHeroes) {
      if (!stats.has(hero.heroId)) {
        stats.set(hero.heroId, {
          heroId: hero.heroId,
          appearances: 0,
          totalDamageDealt: 0,
          totalDamageReceived: 0,
          kills: 0,
          deaths: 0,
          avgSurvivalTime: 0,
          winContribution: 0,
        });
      }

      const s = stats.get(hero.heroId)!;
      s.appearances++;
      s.totalDamageReceived += hero.startHp - hero.endHp;
      if (!hero.survived) s.deaths++;
      if (hero.won && hero.survived) s.winContribution++;
      s.avgSurvivalTime = (s.avgSurvivalTime * (s.appearances - 1) + hero.survivalTime) / s.appearances;
    }
  }

  return stats;
}

function analyzeTierScaling(results: MatchResult[]): TierAnalysis[] {
  const tierData: Map<number, { armor: number[]; hp: number[]; survival: number[]; deaths: number; total: number }> = new Map();

  for (const match of results) {
    const allHeroes = [...match.leftHeroes, ...match.rightHeroes];

    for (const hero of allHeroes) {
      if (!tierData.has(hero.tier)) {
        tierData.set(hero.tier, { armor: [], hp: [], survival: [], deaths: 0, total: 0 });
      }
      const data = tierData.get(hero.tier)!;
      data.armor.push(hero.armor);
      data.hp.push(hero.startHp);
      data.survival.push(hero.survivalTime);
      data.total++;
      if (!hero.survived) data.deaths++;
    }
  }

  const analysis: TierAnalysis[] = [];
  for (const [tier, data] of tierData) {
    analysis.push({
      tier,
      avgArmor: data.armor.reduce((a, b) => a + b, 0) / data.armor.length,
      avgHp: data.hp.reduce((a, b) => a + b, 0) / data.hp.length,
      avgDamageDealt: 0, // Would need more tracking
      avgSurvivalTime: data.survival.reduce((a, b) => a + b, 0) / data.survival.length,
      deathRate: data.deaths / data.total,
    });
  }

  return analysis.sort((a, b) => a.tier - b.tier);
}

function analyzePowerDifferential(results: MatchResult[], buildStats: Map<string, BuildStats>): PowerDifferentialAnalysis[] {
  const buckets: Map<string, { matches: number; strongerWins: number; weakerWins: number; draws: number; totalDuration: number }> = new Map();

  const ranges = ['0-10%', '10-25%', '25-50%', '50-100%', '100%+'];
  for (const r of ranges) {
    buckets.set(r, { matches: 0, strongerWins: 0, weakerWins: 0, draws: 0, totalDuration: 0 });
  }

  for (const match of results) {
    const leftPower = buildStats.get(match.leftBuild)?.totalPower ?? 0;
    const rightPower = buildStats.get(match.rightBuild)?.totalPower ?? 0;

    const maxPower = Math.max(leftPower, rightPower);
    const minPower = Math.min(leftPower, rightPower);
    const diff = maxPower > 0 ? (maxPower - minPower) / minPower : 0;

    let bucket: string;
    if (diff <= 0.10) bucket = '0-10%';
    else if (diff <= 0.25) bucket = '10-25%';
    else if (diff <= 0.50) bucket = '25-50%';
    else if (diff <= 1.00) bucket = '50-100%';
    else bucket = '100%+';

    const data = buckets.get(bucket)!;
    data.matches++;
    data.totalDuration += match.durationSeconds;

    const strongerIsLeft = leftPower >= rightPower;

    if (match.winner === 'draw') {
      data.draws++;
    } else if ((match.winner === 'left' && strongerIsLeft) || (match.winner === 'right' && !strongerIsLeft)) {
      data.strongerWins++;
    } else {
      data.weakerWins++;
    }
  }

  return ranges.map(r => {
    const data = buckets.get(r)!;
    return {
      powerDiff: r,
      matches: data.matches,
      strongerWins: data.strongerWins,
      weakerWins: data.weakerWins,
      draws: data.draws,
      avgDurationSeconds: data.matches > 0 ? data.totalDuration / data.matches : 0,
    };
  });
}

function analyzeArmorEffectiveness(results: MatchResult[]): {
  armorRange: string;
  avgDamageReduction: number;
  avgSurvivalBonus: number;
  samples: number;
}[] {
  const armorBuckets: Map<string, { damageReceived: number[]; maxHp: number[]; survivalTimes: number[] }> = new Map();

  const ranges = ['0-15', '15-30', '30-45', '45-60', '60-80', '80+'];
  for (const r of ranges) {
    armorBuckets.set(r, { damageReceived: [], maxHp: [], survivalTimes: [] });
  }

  for (const match of results) {
    const allHeroes = [...match.leftHeroes, ...match.rightHeroes];

    for (const hero of allHeroes) {
      let bucket: string;
      if (hero.armor < 15) bucket = '0-15';
      else if (hero.armor < 30) bucket = '15-30';
      else if (hero.armor < 45) bucket = '30-45';
      else if (hero.armor < 60) bucket = '45-60';
      else if (hero.armor < 80) bucket = '60-80';
      else bucket = '80+';

      const data = armorBuckets.get(bucket)!;
      data.damageReceived.push(hero.startHp - hero.endHp);
      data.maxHp.push(hero.startHp);
      data.survivalTimes.push(hero.survivalTime);
    }
  }

  return ranges.map(r => {
    const data = armorBuckets.get(r)!;
    const samples = data.damageReceived.length;
    if (samples === 0) {
      return { armorRange: r, avgDamageReduction: 0, avgSurvivalBonus: 0, samples: 0 };
    }

    const avgDmgPercent = data.damageReceived.reduce((a, b) => a + b, 0) /
                          data.maxHp.reduce((a, b) => a + b, 0);
    const avgSurvival = data.survivalTimes.reduce((a, b) => a + b, 0) / samples;

    return {
      armorRange: r,
      avgDamageReduction: 1 - avgDmgPercent,
      avgSurvivalBonus: avgSurvival,
      samples,
    };
  });
}

function analyzeFortressClasses(_results: MatchResult[], buildStats: Map<string, BuildStats>): {
  class: FortressClass;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  avgDamageDealt: number;
  avgDamageReceived: number;
}[] {
  const classData: Map<FortressClass, { wins: number; losses: number; draws: number; dmgDealt: number; dmgReceived: number; matches: number }> = new Map();

  for (const [_name, stats] of buildStats) {
    const fc = stats.fortressClass;
    if (!classData.has(fc)) {
      classData.set(fc, { wins: 0, losses: 0, draws: 0, dmgDealt: 0, dmgReceived: 0, matches: 0 });
    }
    const data = classData.get(fc)!;
    data.wins += stats.wins;
    data.losses += stats.losses;
    data.draws += stats.draws;
    data.dmgDealt += stats.totalDamageDealt;
    data.dmgReceived += stats.totalDamageReceived;
    data.matches += stats.wins + stats.losses + stats.draws;
  }

  const result: ReturnType<typeof analyzeFortressClasses> = [];
  for (const [fc, data] of classData) {
    const total = data.wins + data.losses + data.draws;
    result.push({
      class: fc,
      wins: data.wins,
      losses: data.losses,
      draws: data.draws,
      winRate: total > 0 ? data.wins / total : 0,
      avgDamageDealt: data.matches > 0 ? data.dmgDealt / data.matches : 0,
      avgDamageReceived: data.matches > 0 ? data.dmgReceived / data.matches : 0,
    });
  }

  return result.sort((a, b) => b.winRate - a.winRate);
}

function analyzeBattleDuration(results: MatchResult[]): {
  min: number;
  max: number;
  avg: number;
  median: number;
  stdDev: number;
  distribution: { range: string; count: number; percent: number }[];
} {
  const durations = results.map(r => r.durationSeconds);
  durations.sort((a, b) => a - b);

  const min = durations[0];
  const max = durations[durations.length - 1];
  const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
  const median = durations[Math.floor(durations.length / 2)];

  const variance = durations.reduce((sum, d) => sum + Math.pow(d - avg, 2), 0) / durations.length;
  const stdDev = Math.sqrt(variance);

  // Distribution buckets
  const buckets = [
    { range: '0-2s', min: 0, max: 2, count: 0 },
    { range: '2-5s', min: 2, max: 5, count: 0 },
    { range: '5-10s', min: 5, max: 10, count: 0 },
    { range: '10-20s', min: 10, max: 20, count: 0 },
    { range: '20-60s', min: 20, max: 60, count: 0 },
    { range: '60s+', min: 60, max: Infinity, count: 0 },
  ];

  for (const d of durations) {
    for (const b of buckets) {
      if (d >= b.min && d < b.max) {
        b.count++;
        break;
      }
    }
  }

  return {
    min,
    max,
    avg,
    median,
    stdDev,
    distribution: buckets.map(b => ({
      range: b.range,
      count: b.count,
      percent: b.count / durations.length * 100,
    })),
  };
}

// ============================================================================
// REPORT GENERATION
// ============================================================================

function generateComprehensiveReport(
  results: MatchResult[],
  buildStats: Map<string, BuildStats>,
  heroStats: Map<string, HeroStats>,
  tierAnalysis: TierAnalysis[],
  powerDiffAnalysis: PowerDifferentialAnalysis[],
  armorAnalysis: ReturnType<typeof analyzeArmorEffectiveness>,
  fortressClassAnalysis: ReturnType<typeof analyzeFortressClasses>,
  durationAnalysis: ReturnType<typeof analyzeBattleDuration>
): string {
  const lines: string[] = [];

  lines.push('╔══════════════════════════════════════════════════════════════════════════════╗');
  lines.push('║              ARENA PVP - COMPREHENSIVE DATA ANALYSIS                        ║');
  lines.push('╚══════════════════════════════════════════════════════════════════════════════╝');
  lines.push('');
  lines.push(`Total Matches Analyzed: ${results.length}`);
  lines.push(`Unique Builds: ${buildStats.size}`);
  lines.push(`Unique Heroes: ${heroStats.size}`);
  lines.push('');

  // ============================================================================
  // SECTION 1: BUILD RANKINGS
  // ============================================================================
  lines.push('┌──────────────────────────────────────────────────────────────────────────────┐');
  lines.push('│ 1. BUILD RANKINGS BY WIN RATE                                               │');
  lines.push('└──────────────────────────────────────────────────────────────────────────────┘');
  lines.push('');

  const sortedBuilds = [...buildStats.values()].sort((a, b) => {
    const aWinRate = a.wins / (a.wins + a.losses + a.draws);
    const bWinRate = b.wins / (b.wins + b.losses + b.draws);
    return bWinRate - aWinRate;
  });

  lines.push('  Rank  Build                 Lv   Tier  W    L    D    WinRate   DPS     Armor');
  lines.push('  ────  ────────────────────  ──   ────  ──   ──   ──   ───────   ─────   ─────');

  let rank = 1;
  for (const b of sortedBuilds) {
    const total = b.wins + b.losses + b.draws;
    const winRate = total > 0 ? (b.wins / total * 100).toFixed(1) : '0.0';
    lines.push(`  ${String(rank).padStart(4)}  ${b.name.padEnd(20)}  ${String(b.commanderLevel).padStart(2)}   ${b.tier.toFixed(1).padStart(4)}  ${String(b.wins).padStart(2)}   ${String(b.losses).padStart(2)}   ${String(b.draws).padStart(2)}   ${winRate.padStart(6)}%   ${b.avgDPS.toFixed(0).padStart(5)}   ${b.fortressArmor}/${Math.round(b.avgHeroArmor)}`);
    rank++;
  }
  lines.push('');

  // ============================================================================
  // SECTION 2: BATTLE DURATION STATISTICS
  // ============================================================================
  lines.push('┌──────────────────────────────────────────────────────────────────────────────┐');
  lines.push('│ 2. BATTLE DURATION STATISTICS                                               │');
  lines.push('└──────────────────────────────────────────────────────────────────────────────┘');
  lines.push('');
  lines.push(`  Minimum:    ${durationAnalysis.min.toFixed(2)}s`);
  lines.push(`  Maximum:    ${durationAnalysis.max.toFixed(2)}s`);
  lines.push(`  Average:    ${durationAnalysis.avg.toFixed(2)}s`);
  lines.push(`  Median:     ${durationAnalysis.median.toFixed(2)}s`);
  lines.push(`  Std Dev:    ${durationAnalysis.stdDev.toFixed(2)}s`);
  lines.push('');
  lines.push('  Duration Distribution:');
  for (const d of durationAnalysis.distribution) {
    const bar = '█'.repeat(Math.round(d.percent / 2));
    lines.push(`    ${d.range.padEnd(8)} ${String(d.count).padStart(4)} (${d.percent.toFixed(1).padStart(5)}%) ${bar}`);
  }
  lines.push('');

  // ============================================================================
  // SECTION 3: TIER SCALING ANALYSIS
  // ============================================================================
  lines.push('┌──────────────────────────────────────────────────────────────────────────────┐');
  lines.push('│ 3. TIER SCALING ANALYSIS                                                    │');
  lines.push('└──────────────────────────────────────────────────────────────────────────────┘');
  lines.push('');
  lines.push('  Tier  Avg HP    Avg Armor   Avg Survival   Death Rate');
  lines.push('  ────  ──────    ─────────   ────────────   ──────────');

  for (const t of tierAnalysis) {
    const survivalSec = (t.avgSurvivalTime / 30).toFixed(1);
    const deathPct = (t.deathRate * 100).toFixed(1);
    lines.push(`  T${t.tier}    ${Math.round(t.avgHp).toString().padStart(6)}    ${Math.round(t.avgArmor).toString().padStart(9)}   ${survivalSec.padStart(10)}s   ${deathPct.padStart(9)}%`);
  }
  lines.push('');

  // ============================================================================
  // SECTION 4: ARMOR EFFECTIVENESS
  // ============================================================================
  lines.push('┌──────────────────────────────────────────────────────────────────────────────┐');
  lines.push('│ 4. ARMOR EFFECTIVENESS ANALYSIS                                             │');
  lines.push('└──────────────────────────────────────────────────────────────────────────────┘');
  lines.push('');
  lines.push('  Armor Range   Samples   Theoretical DR   Avg Survival (ticks)');
  lines.push('  ───────────   ───────   ──────────────   ────────────────────');

  for (const a of armorAnalysis) {
    if (a.samples === 0) continue;
    // Calculate theoretical DR based on midpoint of range
    const armorMid = a.armorRange === '80+' ? 90 :
      (parseInt(a.armorRange.split('-')[0]) + parseInt(a.armorRange.split('-')[1])) / 2;
    const theoreticalDR = (armorMid / (100 + armorMid) * 100).toFixed(1);
    lines.push(`  ${a.armorRange.padEnd(11)}   ${String(a.samples).padStart(7)}   ${theoreticalDR.padStart(13)}%   ${Math.round(a.avgSurvivalBonus).toString().padStart(20)}`);
  }
  lines.push('');

  // ============================================================================
  // SECTION 5: POWER DIFFERENTIAL IMPACT
  // ============================================================================
  lines.push('┌──────────────────────────────────────────────────────────────────────────────┐');
  lines.push('│ 5. POWER DIFFERENTIAL IMPACT                                                │');
  lines.push('└──────────────────────────────────────────────────────────────────────────────┘');
  lines.push('');
  lines.push('  Power Diff    Matches   Stronger Wins   Weaker Wins   Draws   Avg Duration');
  lines.push('  ──────────    ───────   ─────────────   ───────────   ─────   ────────────');

  for (const p of powerDiffAnalysis) {
    if (p.matches === 0) continue;
    const strongerPct = (p.strongerWins / p.matches * 100).toFixed(0);
    const weakerPct = (p.weakerWins / p.matches * 100).toFixed(0);
    lines.push(`  ${p.powerDiff.padEnd(10)}    ${String(p.matches).padStart(7)}   ${String(p.strongerWins).padStart(5)} (${strongerPct}%)      ${String(p.weakerWins).padStart(5)} (${weakerPct}%)   ${String(p.draws).padStart(5)}   ${p.avgDurationSeconds.toFixed(1).padStart(10)}s`);
  }
  lines.push('');

  // ============================================================================
  // SECTION 6: FORTRESS CLASS COMPARISON
  // ============================================================================
  lines.push('┌──────────────────────────────────────────────────────────────────────────────┐');
  lines.push('│ 6. FORTRESS CLASS COMPARISON                                                │');
  lines.push('└──────────────────────────────────────────────────────────────────────────────┘');
  lines.push('');
  lines.push('  Class       Wins   Losses   Draws   Win Rate   Avg DMG Dealt   Avg DMG Received');
  lines.push('  ─────────   ────   ──────   ─────   ────────   ─────────────   ────────────────');

  for (const fc of fortressClassAnalysis) {
    lines.push(`  ${fc.class.padEnd(9)}   ${String(fc.wins).padStart(4)}   ${String(fc.losses).padStart(6)}   ${String(fc.draws).padStart(5)}   ${(fc.winRate * 100).toFixed(1).padStart(7)}%   ${Math.round(fc.avgDamageDealt).toString().padStart(13)}   ${Math.round(fc.avgDamageReceived).toString().padStart(16)}`);
  }
  lines.push('');

  // ============================================================================
  // SECTION 7: HERO PERFORMANCE
  // ============================================================================
  lines.push('┌──────────────────────────────────────────────────────────────────────────────┐');
  lines.push('│ 7. HERO PERFORMANCE (sorted by survival contribution)                       │');
  lines.push('└──────────────────────────────────────────────────────────────────────────────┘');
  lines.push('');
  lines.push('  Hero         Appearances   Deaths   Death%   Avg Survival   Win Contribution');
  lines.push('  ──────────   ───────────   ──────   ──────   ────────────   ────────────────');

  const sortedHeroes = [...heroStats.values()].sort((a, b) => b.winContribution - a.winContribution);
  for (const h of sortedHeroes) {
    const deathPct = (h.deaths / h.appearances * 100).toFixed(1);
    const survivalSec = (h.avgSurvivalTime / 30).toFixed(1);
    lines.push(`  ${h.heroId.padEnd(10)}   ${String(h.appearances).padStart(11)}   ${String(h.deaths).padStart(6)}   ${deathPct.padStart(5)}%   ${survivalSec.padStart(10)}s   ${String(h.winContribution).padStart(16)}`);
  }
  lines.push('');

  // ============================================================================
  // SECTION 8: FIRST ENGAGEMENT TIMING
  // ============================================================================
  lines.push('┌──────────────────────────────────────────────────────────────────────────────┐');
  lines.push('│ 8. FIRST ENGAGEMENT TIMING                                                  │');
  lines.push('└──────────────────────────────────────────────────────────────────────────────┘');
  lines.push('');

  const firstDamageTicks = results.map(r => r.firstDamageTick);
  const firstDeathTicks = results.filter(r => r.firstDeathTick !== null).map(r => r.firstDeathTick!);

  const avgFirstDamage = firstDamageTicks.reduce((a, b) => a + b, 0) / firstDamageTicks.length;
  const avgFirstDeath = firstDeathTicks.length > 0
    ? firstDeathTicks.reduce((a, b) => a + b, 0) / firstDeathTicks.length
    : 0;

  lines.push(`  First Damage (avg):   ${(avgFirstDamage / 30).toFixed(2)}s (tick ${Math.round(avgFirstDamage)})`);
  lines.push(`  First Death (avg):    ${(avgFirstDeath / 30).toFixed(2)}s (tick ${Math.round(avgFirstDeath)})`);
  lines.push(`  Matches with deaths:  ${firstDeathTicks.length} / ${results.length} (${(firstDeathTicks.length / results.length * 100).toFixed(1)}%)`);
  lines.push('');

  // ============================================================================
  // SECTION 9: DAMAGE ANALYSIS
  // ============================================================================
  lines.push('┌──────────────────────────────────────────────────────────────────────────────┐');
  lines.push('│ 9. DAMAGE OUTPUT ANALYSIS                                                   │');
  lines.push('└──────────────────────────────────────────────────────────────────────────────┘');
  lines.push('');

  const allDamages = results.flatMap(r => [r.leftDamageDealt, r.rightDamageDealt]);
  const avgDamage = allDamages.reduce((a, b) => a + b, 0) / allDamages.length;
  const maxDamage = Math.max(...allDamages);
  const minDamage = Math.min(...allDamages);

  const allDPS = results.flatMap(r => [
    r.leftDamageDealt / r.durationSeconds,
    r.rightDamageDealt / r.durationSeconds,
  ]);
  const avgDPS = allDPS.reduce((a, b) => a + b, 0) / allDPS.length;
  const maxDPS = Math.max(...allDPS);

  lines.push(`  Total Damage per Match (avg):   ${Math.round(avgDamage)}`);
  lines.push(`  Total Damage per Match (max):   ${Math.round(maxDamage)}`);
  lines.push(`  Total Damage per Match (min):   ${Math.round(minDamage)}`);
  lines.push(`  Average DPS:                    ${Math.round(avgDPS)}`);
  lines.push(`  Maximum DPS:                    ${Math.round(maxDPS)}`);
  lines.push('');

  // ============================================================================
  // SECTION 10: MATCHUP MATRIX (win rates)
  // ============================================================================
  lines.push('┌──────────────────────────────────────────────────────────────────────────────┐');
  lines.push('│ 10. MATCHUP MATRIX (Row vs Column - Row Win Rate %)                         │');
  lines.push('└──────────────────────────────────────────────────────────────────────────────┘');
  lines.push('');

  // Create matchup matrix
  const buildNames = [...buildStats.keys()].sort();
  const matrix: Map<string, Map<string, { wins: number; total: number }>> = new Map();

  for (const name of buildNames) {
    matrix.set(name, new Map());
    for (const opponent of buildNames) {
      matrix.get(name)!.set(opponent, { wins: 0, total: 0 });
    }
  }

  for (const match of results) {
    if (match.winner === 'left') {
      matrix.get(match.leftBuild)!.get(match.rightBuild)!.wins++;
    } else if (match.winner === 'right') {
      matrix.get(match.rightBuild)!.get(match.leftBuild)!.wins++;
    }
    matrix.get(match.leftBuild)!.get(match.rightBuild)!.total++;
    matrix.get(match.rightBuild)!.get(match.leftBuild)!.total++;
  }

  // Print matrix header (abbreviated names)
  const abbrevNames = buildNames.map(n => n.substring(0, 6));
  lines.push('            ' + abbrevNames.map(n => n.padStart(7)).join(''));
  lines.push('  ────────  ' + '───────'.repeat(buildNames.length));

  for (let i = 0; i < buildNames.length; i++) {
    const row = buildNames[i];
    let rowStr = `  ${row.substring(0, 8).padEnd(10)}`;
    for (let j = 0; j < buildNames.length; j++) {
      const col = buildNames[j];
      if (row === col) {
        rowStr += '     - ';
      } else {
        const data = matrix.get(row)!.get(col)!;
        const winRate = data.total > 0 ? Math.round(data.wins / data.total * 100) : 0;
        rowStr += `${String(winRate).padStart(5)}% `;
      }
    }
    lines.push(rowStr);
  }
  lines.push('');

  return lines.join('\n');
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║         ARENA PVP - COMPREHENSIVE DATA COLLECTION           ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log('');

const baseSeed = Math.floor(Math.random() * 1000000);
console.log(`Base seed: ${baseSeed}`);
console.log(`Builds: ${ALL_BUILDS.length}`);
console.log(`Matches per tournament: ${ALL_BUILDS.length * (ALL_BUILDS.length - 1) / 2}`);
console.log('');

// Run multiple tournaments for statistical significance
const TOURNAMENT_COUNT = 5;
console.log(`Running ${TOURNAMENT_COUNT} tournaments...`);

const startTime = Date.now();
const allResults = runMultipleTournaments(ALL_BUILDS, TOURNAMENT_COUNT, baseSeed);
const elapsed = Date.now() - startTime;

console.log(`Completed ${allResults.length} matches in ${elapsed}ms`);
console.log('');

// Analyze data
console.log('Analyzing data...');
const buildStats = analyzeBuildStats(allResults, ALL_BUILDS);
const heroStats = analyzeHeroStats(allResults);
const tierAnalysis = analyzeTierScaling(allResults);
const powerDiffAnalysis = analyzePowerDifferential(allResults, buildStats);
const armorAnalysis = analyzeArmorEffectiveness(allResults);
const fortressClassAnalysis = analyzeFortressClasses(allResults, buildStats);
const durationAnalysis = analyzeBattleDuration(allResults);

// Generate report
const report = generateComprehensiveReport(
  allResults,
  buildStats,
  heroStats,
  tierAnalysis,
  powerDiffAnalysis,
  armorAnalysis,
  fortressClassAnalysis,
  durationAnalysis
);

// Save to file
import * as fs from 'fs';
import * as path from 'path';

const outputPath = path.join(process.cwd(), 'arena-comprehensive-analysis.txt');
fs.writeFileSync(outputPath, report, 'utf-8');
console.log(`\nReport saved to: ${outputPath}`);

// Also output to console
console.log('\n' + '='.repeat(80) + '\n');
console.log(report);
