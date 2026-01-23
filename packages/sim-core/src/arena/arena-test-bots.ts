/**
 * ARENA PVP TEST - 6 BOTS, FULL ANALYSIS
 *
 * Ten skrypt tworzy 6 botów z różnymi buildami i przeprowadza
 * wszystkie 15 walk (każdy z każdym). Zbiera wszystkie dane
 * i analizuje każdy szczegół.
 */

import { ArenaSimulation, type ArenaResult, type ArenaReplayEvent } from './arena-simulation.js';
import type { ArenaBuildConfig, ArenaHeroConfig } from './arena-state.js';
import type { FortressClass } from '../types.js';
import { FP } from '../fixed.js';

// ============================================================================
// BOT DEFINITIONS
// ============================================================================

interface BotDefinition {
  name: string;
  description: string;
  build: ArenaBuildConfig;
}

/**
 * Tworzy hero config z tierem i upgradami
 */
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

/**
 * Definicje 6 botów z różnymi poziomami ulepszeń
 */
export const BOTS: BotDefinition[] = [
  // BOT 1: Całkowity noob - bazowe statystyki
  {
    name: 'Noob_Base_1',
    description: 'Commander Lv1, Tier 1 heroes, zero upgrades, natural fortress',
    build: {
      ownerId: 'bot-1',
      ownerName: 'Noob_Base_1',
      fortressClass: 'natural' as FortressClass,
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

  // BOT 2: Drugi noob - inne klasy bohaterów
  {
    name: 'Noob_Base_2',
    description: 'Commander Lv1, Tier 1 heroes, zero upgrades, fire fortress',
    build: {
      ownerId: 'bot-2',
      ownerName: 'Noob_Base_2',
      fortressClass: 'fire' as FortressClass,
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

  // BOT 3: Średniozaawansowany - niskie ulepszenia
  {
    name: 'Mid_Level',
    description: 'Commander Lv10, Tier 2 heroes, low upgrades (+10%), lightning fortress',
    build: {
      ownerId: 'bot-3',
      ownerName: 'Mid_Level',
      fortressClass: 'lightning' as FortressClass,
      commanderLevel: 10,
      heroIds: ['storm', 'frost', 'vanguard'],
      damageBonus: 0.1, // +10% damage
      hpBonus: 0.1, // +10% HP
      heroConfigs: [
        createHeroConfig('storm', 2, 3, 3),    // Tier 2, +3 damage, +3 hp
        createHeroConfig('frost', 2, 2, 2),    // Tier 2, +2 damage, +2 hp
        createHeroConfig('vanguard', 2, 2, 4), // Tier 2, tank z większym HP
      ],
    },
  },

  // BOT 4: Zaawansowany - średnie ulepszenia
  {
    name: 'Advanced',
    description: 'Commander Lv20, Tier 2-3 heroes, medium upgrades (+20%), ice fortress',
    build: {
      ownerId: 'bot-4',
      ownerName: 'Advanced',
      fortressClass: 'ice' as FortressClass,
      commanderLevel: 20,
      heroIds: ['glacier', 'frost', 'omega', 'medic'],
      damageBonus: 0.2, // +20% damage
      hpBonus: 0.2, // +20% HP
      heroConfigs: [
        createHeroConfig('glacier', 3, 5, 8), // Tank z dużym HP
        createHeroConfig('frost', 3, 6, 3),   // DPS z dużym damage
        createHeroConfig('omega', 2, 7, 4),   // Assassin
        createHeroConfig('medic', 2, 2, 5),   // Support
      ],
    },
  },

  // BOT 5: Ekspert - wysokie ulepszenia, fire comp
  {
    name: 'Expert_Fire',
    description: 'Commander Lv30, Tier 3 heroes, high upgrades (+35%), fire fortress',
    build: {
      ownerId: 'bot-5',
      ownerName: 'Expert_Fire',
      fortressClass: 'fire' as FortressClass,
      commanderLevel: 30,
      heroIds: ['inferno', 'pyro', 'rift', 'titan'],
      damageBonus: 0.35, // +35% damage
      hpBonus: 0.35, // +35% HP
      heroConfigs: [
        createHeroConfig('inferno', 3, 10, 6), // Fire DPS max
        createHeroConfig('pyro', 3, 8, 5),     // Fire DPS
        createHeroConfig('rift', 3, 7, 4),     // Fire support
        createHeroConfig('titan', 3, 5, 10),   // Tank
      ],
    },
  },

  // BOT 6: Ekspert - maksymalne ulepszenia, tech comp
  {
    name: 'Expert_Tech',
    description: 'Commander Lv30, Tier 3 heroes, max upgrades (+50%), tech fortress',
    build: {
      ownerId: 'bot-6',
      ownerName: 'Expert_Tech',
      fortressClass: 'tech' as FortressClass,
      commanderLevel: 30,
      heroIds: ['forge', 'spectre', 'storm', 'vanguard'],
      damageBonus: 0.5, // +50% damage
      hpBonus: 0.5, // +50% HP
      heroConfigs: [
        createHeroConfig('forge', 3, 12, 8),    // Tech DPS max
        createHeroConfig('spectre', 3, 11, 7),  // Tech DPS
        createHeroConfig('storm', 3, 10, 6),    // Lightning DPS
        createHeroConfig('vanguard', 3, 6, 12), // Tank max HP
      ],
    },
  },
];

// ============================================================================
// BATTLE ANALYSIS TYPES
// ============================================================================

interface HeroAnalysis {
  heroId: string;
  tier: number;
  startHp: number;
  endHp: number;
  armor: number;
  damageDealt: number;
  damageReceived: number;
  attacksPerformed: number;
  wasKilled: boolean;
  killedAtTick: number | null;
  positionHistory: Array<{ tick: number; x: number; y: number }>;
}

interface FortressAnalysis {
  class: FortressClass;
  startHp: number;
  armor: number;
  endHp: number;
  damageReceived: number;
  projectilesFired: number;
  destroyedAtTick: number | null;
}

interface SideAnalysis {
  playerName: string;
  fortress: FortressAnalysis;
  heroes: HeroAnalysis[];
  totalDamageDealt: number;
  totalDamageReceived: number;
  heroesAlive: number;
  heroesKilled: number;
}

interface BattleAnalysis {
  matchId: string;
  leftBot: string;
  rightBot: string;
  seed: number;
  result: ArenaResult;
  duration: number;
  durationSeconds: number;
  winnerName: string | null;
  winReason: string;
  left: SideAnalysis;
  right: SideAnalysis;
  replayEvents: ArenaReplayEvent[];
  tickByTickLog: string[];
}

// ============================================================================
// SIMULATION AND ANALYSIS
// ============================================================================

/**
 * Analizuje jedną walkę tick po ticku
 */
function analyzeFullBattle(
  leftBot: BotDefinition,
  rightBot: BotDefinition,
  seed: number
): BattleAnalysis {
  const simulation = new ArenaSimulation(seed, leftBot.build, rightBot.build);
  const tickByTickLog: string[] = [];

  // Track hero positions and damage per tick
  const leftHeroTracking = new Map<number, { damageDealt: number; attacks: number }>();
  const rightHeroTracking = new Map<number, { damageDealt: number; attacks: number }>();

  // Initialize tracking
  for (let i = 0; i < simulation.state.left.heroes.length; i++) {
    leftHeroTracking.set(i, { damageDealt: 0, attacks: 0 });
  }
  for (let i = 0; i < simulation.state.right.heroes.length; i++) {
    rightHeroTracking.set(i, { damageDealt: 0, attacks: 0 });
  }

  // Store initial state
  const initialLeftFortressHp = simulation.state.left.fortress.hp;
  const initialRightFortressHp = simulation.state.right.fortress.hp;
  const initialLeftHeroesHp = simulation.state.left.heroes.map(h => h.currentHp);
  const initialRightHeroesHp = simulation.state.right.heroes.map(h => h.currentHp);

  // Position history
  const leftPositionHistory: Array<Array<{ tick: number; x: number; y: number }>> =
    simulation.state.left.heroes.map(() => []);
  const rightPositionHistory: Array<Array<{ tick: number; x: number; y: number }>> =
    simulation.state.right.heroes.map(() => []);

  // Track kills
  const leftHeroKills: Array<number | null> = simulation.state.left.heroes.map(() => null);
  const rightHeroKills: Array<number | null> = simulation.state.right.heroes.map(() => null);

  let fortressDestroyedTickLeft: number | null = null;
  let fortressDestroyedTickRight: number | null = null;
  let leftProjectilesFired = 0;
  let rightProjectilesFired = 0;

  // Previous state for delta tracking
  let prevLeftFortressHp = initialLeftFortressHp;
  let prevRightFortressHp = initialRightFortressHp;
  const prevLeftHeroesHp = [...initialLeftHeroesHp];
  const prevRightHeroesHp = [...initialRightHeroesHp];

  // Run simulation tick by tick
  while (!simulation.state.ended) {
    const tick = simulation.state.tick;

    // Log positions every 30 ticks (1 second)
    if (tick % 30 === 0) {
      simulation.state.left.heroes.forEach((h, i) => {
        leftPositionHistory[i].push({
          tick,
          x: FP.toFloat(h.x),
          y: FP.toFloat(h.y),
        });
      });
      simulation.state.right.heroes.forEach((h, i) => {
        rightPositionHistory[i].push({
          tick,
          x: FP.toFloat(h.x),
          y: FP.toFloat(h.y),
        });
      });
    }

    // Advance simulation
    simulation.step();

    // Check for fortress damage
    if (simulation.state.left.fortress.hp < prevLeftFortressHp) {
      const dmg = prevLeftFortressHp - simulation.state.left.fortress.hp;
      tickByTickLog.push(`[${tick}] LEFT fortress took ${dmg} DMG (${simulation.state.left.fortress.hp}/${initialLeftFortressHp} HP)`);
    }
    if (simulation.state.right.fortress.hp < prevRightFortressHp) {
      const dmg = prevRightFortressHp - simulation.state.right.fortress.hp;
      tickByTickLog.push(`[${tick}] RIGHT fortress took ${dmg} DMG (${simulation.state.right.fortress.hp}/${initialRightFortressHp} HP)`);
    }

    // Check for hero deaths
    simulation.state.left.heroes.forEach((h, i) => {
      if (h.currentHp <= 0 && prevLeftHeroesHp[i] > 0) {
        leftHeroKills[i] = tick;
        tickByTickLog.push(`[${tick}] LEFT hero ${h.definitionId} KILLED`);
      }
      prevLeftHeroesHp[i] = h.currentHp;
    });
    simulation.state.right.heroes.forEach((h, i) => {
      if (h.currentHp <= 0 && prevRightHeroesHp[i] > 0) {
        rightHeroKills[i] = tick;
        tickByTickLog.push(`[${tick}] RIGHT hero ${h.definitionId} KILLED`);
      }
      prevRightHeroesHp[i] = h.currentHp;
    });

    // Check fortress destruction
    if (simulation.state.left.fortress.hp <= 0 && fortressDestroyedTickLeft === null) {
      fortressDestroyedTickLeft = tick;
      tickByTickLog.push(`[${tick}] LEFT fortress DESTROYED!`);
    }
    if (simulation.state.right.fortress.hp <= 0 && fortressDestroyedTickRight === null) {
      fortressDestroyedTickRight = tick;
      tickByTickLog.push(`[${tick}] RIGHT fortress DESTROYED!`);
    }

    prevLeftFortressHp = simulation.state.left.fortress.hp;
    prevRightFortressHp = simulation.state.right.fortress.hp;
  }

  const result = simulation.getResult();
  const replayEvents = simulation.getReplayEvents();

  // Count projectiles from replay events
  for (const event of replayEvents) {
    if (event.type === 'projectile') {
      if (event.side === 'left') leftProjectilesFired++;
      else rightProjectilesFired++;
    }
  }

  // Build hero analysis
  const leftHeroAnalysis: HeroAnalysis[] = simulation.state.left.heroes.map((h, i) => ({
    heroId: h.definitionId,
    tier: h.tier,
    startHp: initialLeftHeroesHp[i],
    endHp: h.currentHp,
    armor: h.arenaArmor ?? 0,
    damageDealt: 0, // Would need more tracking
    damageReceived: initialLeftHeroesHp[i] - Math.max(0, h.currentHp),
    attacksPerformed: 0,
    wasKilled: h.currentHp <= 0,
    killedAtTick: leftHeroKills[i],
    positionHistory: leftPositionHistory[i],
  }));

  const rightHeroAnalysis: HeroAnalysis[] = simulation.state.right.heroes.map((h, i) => ({
    heroId: h.definitionId,
    tier: h.tier,
    startHp: initialRightHeroesHp[i],
    endHp: h.currentHp,
    armor: h.arenaArmor ?? 0,
    damageDealt: 0,
    damageReceived: initialRightHeroesHp[i] - Math.max(0, h.currentHp),
    attacksPerformed: 0,
    wasKilled: h.currentHp <= 0,
    killedAtTick: rightHeroKills[i],
    positionHistory: rightPositionHistory[i],
  }));

  // Build analysis
  const analysis: BattleAnalysis = {
    matchId: `${leftBot.name}_vs_${rightBot.name}`,
    leftBot: leftBot.name,
    rightBot: rightBot.name,
    seed,
    result,
    duration: result.duration,
    durationSeconds: result.duration / 30,
    winnerName: result.winner === 'left' ? leftBot.name :
                result.winner === 'right' ? rightBot.name : null,
    winReason: result.winReason,
    left: {
      playerName: leftBot.name,
      fortress: {
        class: leftBot.build.fortressClass,
        startHp: initialLeftFortressHp,
        endHp: simulation.state.left.fortress.hp,
        armor: simulation.state.left.fortress.armor,
        damageReceived: initialLeftFortressHp - simulation.state.left.fortress.hp,
        projectilesFired: leftProjectilesFired,
        destroyedAtTick: fortressDestroyedTickLeft,
      },
      heroes: leftHeroAnalysis,
      totalDamageDealt: result.leftStats.damageDealt,
      totalDamageReceived: simulation.state.left.stats.damageReceived,
      heroesAlive: result.leftStats.heroesAlive,
      heroesKilled: simulation.state.left.stats.heroesKilled,
    },
    right: {
      playerName: rightBot.name,
      fortress: {
        class: rightBot.build.fortressClass,
        startHp: initialRightFortressHp,
        endHp: simulation.state.right.fortress.hp,
        armor: simulation.state.right.fortress.armor,
        damageReceived: initialRightFortressHp - simulation.state.right.fortress.hp,
        projectilesFired: rightProjectilesFired,
        destroyedAtTick: fortressDestroyedTickRight,
      },
      heroes: rightHeroAnalysis,
      totalDamageDealt: result.rightStats.damageDealt,
      totalDamageReceived: simulation.state.right.stats.damageReceived,
      heroesAlive: result.rightStats.heroesAlive,
      heroesKilled: simulation.state.right.stats.heroesKilled,
    },
    replayEvents,
    tickByTickLog,
  };

  return analysis;
}

/**
 * Generuje raport tekstowy z analizy walki
 */
function generateBattleReport(analysis: BattleAnalysis): string {
  const lines: string[] = [];

  lines.push('═'.repeat(80));
  lines.push(`BATTLE: ${analysis.leftBot} vs ${analysis.rightBot}`);
  lines.push('═'.repeat(80));
  lines.push('');

  // Basic info
  lines.push(`Seed: ${analysis.seed}`);
  lines.push(`Duration: ${analysis.duration} ticks (${analysis.durationSeconds.toFixed(1)}s)`);
  lines.push(`Winner: ${analysis.winnerName ?? 'DRAW'}`);
  lines.push(`Win Reason: ${analysis.winReason}`);
  lines.push('');

  // Left side
  lines.push('─'.repeat(40));
  lines.push(`LEFT: ${analysis.left.playerName}`);
  lines.push('─'.repeat(40));
  const leftArmorReduction = Math.round((1 - 100 / (100 + analysis.left.fortress.armor)) * 100);
  lines.push(`Fortress: ${analysis.left.fortress.class.toUpperCase()}`);
  lines.push(`  HP: ${analysis.left.fortress.startHp} → ${analysis.left.fortress.endHp} (took ${analysis.left.fortress.damageReceived} DMG)`);
  lines.push(`  Armor: ${analysis.left.fortress.armor} (${leftArmorReduction}% damage reduction)`);
  lines.push(`  Projectiles Fired: ${analysis.left.fortress.projectilesFired}`);
  if (analysis.left.fortress.destroyedAtTick !== null) {
    lines.push(`  DESTROYED at tick ${analysis.left.fortress.destroyedAtTick}`);
  }
  lines.push('');
  lines.push('Heroes:');
  for (const hero of analysis.left.heroes) {
    const status = hero.wasKilled ? `DEAD at tick ${hero.killedAtTick}` : 'ALIVE';
    const heroArmorRed = Math.round((1 - 100 / (100 + hero.armor)) * 100);
    lines.push(`  [${hero.heroId}] Tier ${hero.tier}, Armor: ${hero.armor} (${heroArmorRed}% DR)`);
    lines.push(`    HP: ${hero.startHp} → ${hero.endHp} (${status})`);
    lines.push(`    DMG received: ${hero.damageReceived}`);
  }
  lines.push('');
  lines.push(`Total DMG Dealt: ${analysis.left.totalDamageDealt}`);
  lines.push(`Total DMG Received: ${analysis.left.totalDamageReceived}`);
  lines.push(`Heroes Alive: ${analysis.left.heroesAlive}`);
  lines.push(`Heroes Killed: ${analysis.left.heroesKilled} enemy heroes`);
  lines.push('');

  // Right side
  lines.push('─'.repeat(40));
  lines.push(`RIGHT: ${analysis.right.playerName}`);
  lines.push('─'.repeat(40));
  const rightArmorReduction = Math.round((1 - 100 / (100 + analysis.right.fortress.armor)) * 100);
  lines.push(`Fortress: ${analysis.right.fortress.class.toUpperCase()}`);
  lines.push(`  HP: ${analysis.right.fortress.startHp} → ${analysis.right.fortress.endHp} (took ${analysis.right.fortress.damageReceived} DMG)`);
  lines.push(`  Armor: ${analysis.right.fortress.armor} (${rightArmorReduction}% damage reduction)`);
  lines.push(`  Projectiles Fired: ${analysis.right.fortress.projectilesFired}`);
  if (analysis.right.fortress.destroyedAtTick !== null) {
    lines.push(`  DESTROYED at tick ${analysis.right.fortress.destroyedAtTick}`);
  }
  lines.push('');
  lines.push('Heroes:');
  for (const hero of analysis.right.heroes) {
    const status = hero.wasKilled ? `DEAD at tick ${hero.killedAtTick}` : 'ALIVE';
    const heroArmorRed = Math.round((1 - 100 / (100 + hero.armor)) * 100);
    lines.push(`  [${hero.heroId}] Tier ${hero.tier}, Armor: ${hero.armor} (${heroArmorRed}% DR)`);
    lines.push(`    HP: ${hero.startHp} → ${hero.endHp} (${status})`);
    lines.push(`    DMG received: ${hero.damageReceived}`);
  }
  lines.push('');
  lines.push(`Total DMG Dealt: ${analysis.right.totalDamageDealt}`);
  lines.push(`Total DMG Received: ${analysis.right.totalDamageReceived}`);
  lines.push(`Heroes Alive: ${analysis.right.heroesAlive}`);
  lines.push(`Heroes Killed: ${analysis.right.heroesKilled} enemy heroes`);
  lines.push('');

  // Replay events summary
  lines.push('─'.repeat(40));
  lines.push('REPLAY EVENTS SUMMARY');
  lines.push('─'.repeat(40));
  const eventCounts = {
    damage: 0,
    hero_death: 0,
    fortress_damage: 0,
    projectile: 0,
  };
  for (const event of analysis.replayEvents) {
    eventCounts[event.type]++;
  }
  lines.push(`  Projectiles: ${eventCounts.projectile}`);
  lines.push(`  Fortress Damage Events: ${eventCounts.fortress_damage}`);
  lines.push(`  Hero Deaths: ${eventCounts.hero_death}`);
  lines.push('');

  // Key moments from tick log
  lines.push('─'.repeat(40));
  lines.push('KEY MOMENTS (from tick log)');
  lines.push('─'.repeat(40));
  for (const log of analysis.tickByTickLog.slice(0, 30)) {
    lines.push(`  ${log}`);
  }
  if (analysis.tickByTickLog.length > 30) {
    lines.push(`  ... and ${analysis.tickByTickLog.length - 30} more events`);
  }
  lines.push('');

  return lines.join('\n');
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

export interface TournamentResults {
  battles: BattleAnalysis[];
  standings: Map<string, { wins: number; losses: number; draws: number }>;
  reports: string[];
}

/**
 * Przeprowadza turniej - każdy bot walczy z każdym
 */
export function runTournament(baseSeed: number = 12345): TournamentResults {
  const battles: BattleAnalysis[] = [];
  const reports: string[] = [];
  const standings = new Map<string, { wins: number; losses: number; draws: number }>();

  // Initialize standings
  for (const bot of BOTS) {
    standings.set(bot.name, { wins: 0, losses: 0, draws: 0 });
  }

  let matchNumber = 0;

  // Each bot vs each other bot
  for (let i = 0; i < BOTS.length; i++) {
    for (let j = i + 1; j < BOTS.length; j++) {
      matchNumber++;
      const seed = baseSeed + matchNumber;

      console.log(`\n[Match ${matchNumber}/15] ${BOTS[i].name} vs ${BOTS[j].name}...`);

      const analysis = analyzeFullBattle(BOTS[i], BOTS[j], seed);
      battles.push(analysis);

      const report = generateBattleReport(analysis);
      reports.push(report);

      // Update standings
      if (analysis.winnerName === BOTS[i].name) {
        standings.get(BOTS[i].name)!.wins++;
        standings.get(BOTS[j].name)!.losses++;
      } else if (analysis.winnerName === BOTS[j].name) {
        standings.get(BOTS[j].name)!.wins++;
        standings.get(BOTS[i].name)!.losses++;
      } else {
        standings.get(BOTS[i].name)!.draws++;
        standings.get(BOTS[j].name)!.draws++;
      }

      console.log(`  → Winner: ${analysis.winnerName ?? 'DRAW'} (${analysis.winReason})`);
      console.log(`  → Duration: ${analysis.durationSeconds.toFixed(1)}s`);
      console.log(`  → Damage: ${BOTS[i].name}=${analysis.left.totalDamageDealt} vs ${BOTS[j].name}=${analysis.right.totalDamageDealt}`);
    }
  }

  return { battles, standings, reports };
}

/**
 * Generuje pełny raport turnieju
 */
export function generateTournamentReport(results: TournamentResults): string {
  const lines: string[] = [];

  lines.push('╔══════════════════════════════════════════════════════════════════════════════╗');
  lines.push('║                       ARENA PVP TOURNAMENT REPORT                            ║');
  lines.push('║                         6 BOTS - 15 MATCHES                                  ║');
  lines.push('╚══════════════════════════════════════════════════════════════════════════════╝');
  lines.push('');

  // Bot descriptions
  lines.push('┌──────────────────────────────────────────────────────────────────────────────┐');
  lines.push('│ BOT CONFIGURATIONS                                                          │');
  lines.push('└──────────────────────────────────────────────────────────────────────────────┘');
  for (const bot of BOTS) {
    lines.push(`  ${bot.name}:`);
    lines.push(`    ${bot.description}`);
    lines.push(`    Heroes: ${bot.build.heroIds.join(', ')}`);
    lines.push(`    Fortress: ${bot.build.fortressClass}`);
    lines.push(`    Bonuses: +${(bot.build.damageBonus || 0) * 100}% DMG, +${(bot.build.hpBonus || 0) * 100}% HP`);
    lines.push('');
  }

  // Standings
  lines.push('┌──────────────────────────────────────────────────────────────────────────────┐');
  lines.push('│ FINAL STANDINGS                                                             │');
  lines.push('└──────────────────────────────────────────────────────────────────────────────┘');
  const sortedStandings = [...results.standings.entries()]
    .sort((a, b) => (b[1].wins * 3 + b[1].draws) - (a[1].wins * 3 + a[1].draws));

  lines.push('  Rank  Bot                  W    L    D    Points');
  lines.push('  ────  ───────────────────  ──   ──   ──   ──────');
  let rank = 1;
  for (const [name, record] of sortedStandings) {
    const points = record.wins * 3 + record.draws;
    lines.push(`  ${rank.toString().padStart(2)}    ${name.padEnd(18)}  ${record.wins.toString().padStart(2)}   ${record.losses.toString().padStart(2)}   ${record.draws.toString().padStart(2)}   ${points.toString().padStart(4)}`);
    rank++;
  }
  lines.push('');

  // Match summary
  lines.push('┌──────────────────────────────────────────────────────────────────────────────┐');
  lines.push('│ MATCH RESULTS SUMMARY                                                       │');
  lines.push('└──────────────────────────────────────────────────────────────────────────────┘');
  for (const battle of results.battles) {
    const leftDmg = battle.left.totalDamageDealt;
    const rightDmg = battle.right.totalDamageDealt;
    const winner = battle.winnerName ?? 'DRAW';
    lines.push(`  ${battle.leftBot.padEnd(16)} vs ${battle.rightBot.padEnd(16)} → ${winner.padEnd(16)} (${battle.durationSeconds.toFixed(1)}s, ${battle.winReason})`);
    lines.push(`    DMG: ${leftDmg} vs ${rightDmg}, Heroes killed: ${battle.left.heroesKilled} vs ${battle.right.heroesKilled}`);
  }
  lines.push('');

  // Detailed battle reports
  lines.push('┌──────────────────────────────────────────────────────────────────────────────┐');
  lines.push('│ DETAILED BATTLE REPORTS                                                     │');
  lines.push('└──────────────────────────────────────────────────────────────────────────────┘');
  lines.push('');
  for (const report of results.reports) {
    lines.push(report);
    lines.push('');
  }

  // Statistics analysis
  lines.push('┌──────────────────────────────────────────────────────────────────────────────┐');
  lines.push('│ STATISTICS ANALYSIS                                                         │');
  lines.push('└──────────────────────────────────────────────────────────────────────────────┘');

  const avgDuration = results.battles.reduce((sum, b) => sum + b.durationSeconds, 0) / results.battles.length;
  const avgDmg = results.battles.reduce((sum, b) => sum + b.left.totalDamageDealt + b.right.totalDamageDealt, 0) / results.battles.length;
  const fortressWins = results.battles.filter(b => b.winReason === 'fortress_destroyed').length;
  const timeouts = results.battles.filter(b => b.winReason === 'timeout').length;
  const draws = results.battles.filter(b => b.winReason === 'draw').length;

  lines.push(`  Average Battle Duration: ${avgDuration.toFixed(1)} seconds`);
  lines.push(`  Average Total Damage: ${avgDmg.toFixed(0)}`);
  lines.push(`  Fortress Destroyed Wins: ${fortressWins}/15`);
  lines.push(`  Timeout Wins: ${timeouts}/15`);
  lines.push(`  Draws: ${draws}/15`);
  lines.push('');

  return lines.join('\n');
}

// ============================================================================
// CLI RUNNER (if run directly)
// ============================================================================

// Export for external use
export { analyzeFullBattle, generateBattleReport };
