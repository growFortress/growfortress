import { EnemyType, PillarId } from '../types.js';
import { FP } from '../fixed.js';
import { getPillarById, getPillarForWave } from './pillars.js';

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
  // Counterplay properties
  splashResistance?: number;  // Reduces splash damage (0.0-1.0, e.g., 0.5 = 50% reduction)
  chainResistance?: number;   // Reduces chain chance (0.0-1.0, e.g., 0.3 = 30% reduction)
  spreadBehavior?: boolean;   // Enemy avoids grouping (spreads out from others)
}

export const ENEMY_ARCHETYPES: Record<EnemyType, EnemyArchetype> = {
  // Base enemies
  runner: {
    type: 'runner',
    baseHp: 60,       // Buffed from 29 (~2x) - no longer "fragile"
    baseSpeed: 2.33,
    baseDamage: 10,   // Buffed from 8 (+25%)
    goldReward: 1,
    dustReward: 1,
    description: 'Fast basic enemy',
  },
  bruiser: {
    type: 'bruiser',
    baseHp: 200,      // Buffed from 144 (+39%)
    baseSpeed: 0.84,
    baseDamage: 28,   // Buffed from 21 (+33%)
    goldReward: 3,    // Reduced from 5 (-40%)
    dustReward: 2,
    description: 'Slow and tanky',
  },
  leech: {
    type: 'leech',
    baseHp: 85,       // Buffed from 58 (+47%)
    baseSpeed: 1.69,
    baseDamage: 8,    // Buffed from 5 (+60%)
    goldReward: 2,    // Reduced from 4 (-50%)
    dustReward: 1,
    description: 'Heals on hit',
  },

  // Streets Pillar enemies
  gangster: {
    type: 'gangster',
    baseHp: 80,       // Buffed from 36 (~2.2x)
    baseSpeed: 1.90,
    baseDamage: 14,   // Buffed from 11 (+27%)
    goldReward: 2,    // Reduced from 3 for economy balance
    dustReward: 1,
    description: 'Armed street criminal',
  },
  thug: {
    type: 'thug',
    baseHp: 120,      // Buffed from 86 (+40%)
    baseSpeed: 1.27,
    baseDamage: 24,   // Buffed from 18 (+33%)
    goldReward: 3,    // Reduced from 4 (-25%)
    dustReward: 1,
    description: 'Tough street enforcer',
  },
  mafia_boss: {
    type: 'mafia_boss',
    baseHp: 580,      // Buffed from 431 (+35%)
    baseSpeed: 0.68,
    baseDamage: 48,   // Buffed from 36 (+33%)
    goldReward: 12,   // Reduced from 18 (-33%)
    dustReward: 5,
    description: 'Crime lord with bodyguards',
  },

  // Science Pillar enemies
  robot: {
    type: 'robot',
    baseHp: 95,       // Buffed from 65 (+46%)
    baseSpeed: 1.48,
    baseDamage: 20,   // Buffed from 15 (+33%)
    goldReward: 3,    // Reduced from 4 (-25%)
    dustReward: 1,
    description: 'Mechanical soldier',
  },
  drone: {
    type: 'drone',
    baseHp: 40,       // Buffed from 21 (+90%) - still fast but not glass
    baseSpeed: 2.20,  // Reduced from 2.53 (-13%) - slightly easier to hit
    baseDamage: 10,   // Buffed from 8 (+25%)
    goldReward: 1,    // Reduced from 2 (-50%)
    dustReward: 1,
    description: 'Fast flying unit',
  },
  ai_core: {
    type: 'ai_core',
    baseHp: 950,      // Buffed from 719 (+32%)
    baseSpeed: 0.42,
    baseDamage: 58,   // Buffed from 44 (+32%)
    goldReward: 18,   // Reduced from 28 (-36%)
    dustReward: 8,
    description: 'Central AI consciousness',
  },

  // Mutants Pillar enemies
  sentinel: {
    type: 'sentinel',
    baseHp: 400,      // Buffed from 288 (+39%)
    baseSpeed: 1.06,
    baseDamage: 40,   // Buffed from 29 (+38%)
    goldReward: 6,    // Reduced from 9 (-33%)
    dustReward: 3,
    description: 'Mutant-hunting robot',
  },
  mutant_hunter: {
    type: 'mutant_hunter',
    baseHp: 160,      // Buffed from 115 (+39%)
    baseSpeed: 1.69,
    baseDamage: 28,   // Buffed from 21 (+33%)
    goldReward: 3,    // Reduced from 5 (-40%)
    dustReward: 2,
    description: 'Human mutant hunter',
  },

  // Cosmos Pillar enemies
  kree_soldier: {
    type: 'kree_soldier',
    baseHp: 140,      // Buffed from 100 (+40%)
    baseSpeed: 1.48,
    baseDamage: 25,   // Buffed from 18 (+39%)
    goldReward: 3,    // Reduced from 5 (-40%)
    dustReward: 2,
    description: 'Kree Empire warrior',
  },
  skrull: {
    type: 'skrull',
    baseHp: 105,      // Buffed from 73 (+44%)
    baseSpeed: 1.69,
    baseDamage: 20,   // Buffed from 15 (+33%)
    goldReward: 2,    // Reduced from 4 (-50%)
    dustReward: 1,
    description: 'Shape-shifting alien',
  },
  cosmic_beast: {
    type: 'cosmic_beast',
    baseHp: 800,      // Buffed from 575 (+39%)
    baseSpeed: 0.84,
    baseDamage: 68,   // Buffed from 50 (+36%)
    goldReward: 14,   // Reduced from 21 (-33%)
    dustReward: 6,
    description: 'Massive space creature',
  },

  // Magic Pillar enemies
  demon: {
    type: 'demon',
    baseHp: 180,      // Buffed from 130 (+38%)
    baseSpeed: 1.27,
    baseDamage: 35,   // Buffed from 26 (+35%)
    goldReward: 4,    // Reduced from 6 (-33%)
    dustReward: 2,
    description: 'Hellish entity',
  },
  sorcerer: {
    type: 'sorcerer',
    baseHp: 85,       // Buffed from 58 (+47%)
    baseSpeed: 1.06,
    baseDamage: 48,   // Buffed from 36 (+33%)
    goldReward: 5,    // Reduced from 7 (-29%)
    dustReward: 3,
    description: 'Dark magic user',
  },
  dimensional_being: {
    type: 'dimensional_being',
    baseHp: 1150,     // Buffed from 863 (+33%)
    baseSpeed: 0.53,
    baseDamage: 78,   // Buffed from 58 (+34%)
    goldReward: 22,   // Reduced from 35 (-37%)
    dustReward: 10,
    description: 'Entity from another dimension',
  },

  // Gods Pillar enemies
  einherjar: {
    type: 'einherjar',
    baseHp: 240,      // Buffed from 173 (+39%)
    baseSpeed: 1.27,
    baseDamage: 42,   // Buffed from 31 (+35%)
    goldReward: 6,    // Reduced from 9 (-33%)
    dustReward: 3,
    description: 'Fallen warrior of Valhalla',
  },
  titan: {
    type: 'titan',
    baseHp: 1550,     // Buffed from 1150 (+35%)
    baseSpeed: 0.37,
    baseDamage: 98,   // Buffed from 73 (+34%)
    goldReward: 28,   // Reduced from 42 (-33%)
    dustReward: 13,
    description: 'Primordial giant',
  },
  god: {
    type: 'god',
    baseHp: 1950,     // Buffed from 1438 (+36%)
    baseSpeed: 0.84,
    baseDamage: 115,  // Buffed from 86 (+34%)
    goldReward: 45,   // Reduced from 70 (-36%)
    dustReward: 25,
    description: 'Divine being of immense power',
  },

  // ============================================================================
  // SPECIAL ABILITY ENEMIES
  // ============================================================================

  catapult: {
    type: 'catapult',
    baseHp: 140,      // Buffed from 100 (+40%)
    baseSpeed: 0.68,
    baseDamage: 68,   // Buffed from 50 (+36%)
    goldReward: 7,    // Reduced from 11 (-36%)
    dustReward: 3,
    description: 'Ranged siege unit - attacks fortress/turrets from distance',
  },
  sapper: {
    type: 'sapper',
    baseHp: 80,       // Buffed from 56 (+43%)
    baseSpeed: 2.00,  // Reduced from 2.33 (-14%) - easier to hit
    baseDamage: 14,   // Buffed from 10 (+40%)
    goldReward: 5,    // Reduced from 7 (-29%)
    dustReward: 2,
    description: 'Targets walls - plants bombs that deal massive damage',
  },
  healer: {
    type: 'healer',
    baseHp: 65,       // Buffed from 44 (+48%)
    baseSpeed: 1.27,
    baseDamage: 8,    // Buffed from 6 (+33%)
    goldReward: 5,    // Reduced from 8 (-38%)
    dustReward: 2,
    description: 'Heals nearby enemies over time',
  },
  shielder: {
    type: 'shielder',
    baseHp: 110,      // Buffed from 75 (+47%)
    baseSpeed: 1.06,
    baseDamage: 18,   // Buffed from 13 (+38%)
    goldReward: 6,    // Reduced from 10 (-40%)
    dustReward: 3,
    description: 'Creates damage-absorbing shield for nearby enemies',
  },
  teleporter: {
    type: 'teleporter',
    baseHp: 55,       // Buffed from 38 (+45%)
    baseSpeed: 1.69,
    baseDamage: 20,   // Buffed from 15 (+33%)
    goldReward: 4,    // Reduced from 6 (-33%)
    dustReward: 2,
    description: 'Randomly teleports between lanes',
  },

  // ============================================================================
  // COUNTERPLAY ENEMIES - Resist splash/chain builds
  // ============================================================================

  scatterer: {
    type: 'scatterer',
    baseHp: 100,      // Buffed from 72 (+39%)
    baseSpeed: 1.48,
    baseDamage: 19,   // Buffed from 14 (+36%)
    goldReward: 4,    // Reduced from 6 (-33%)
    dustReward: 2,
    description: 'Spreads out, resists splash and chain damage',
    splashResistance: 0.5,
    chainResistance: 0.3,
    spreadBehavior: true,
  },
  lone_wolf: {
    type: 'lone_wolf',
    baseHp: 400,      // Buffed from 288 (+39%)
    baseSpeed: 1.06,
    baseDamage: 38,   // Buffed from 28 (+36%)
    goldReward: 8,    // Reduced from 12 (-33%)
    dustReward: 4,
    description: 'Elite loner - immune to chains, heavily resists splash',
    splashResistance: 0.75,
    chainResistance: 1.0,
    spreadBehavior: true,
  },
};

// ============================================================================
// BOSS MECHANICS (Phases & Abilities)
// ============================================================================

export type BossAbilityType =
  | 'summon_minions'
  | 'damage_shield'
  | 'enrage'
  | 'heal_burst'
  | 'stun_aura';

export interface BossAbility {
  type: BossAbilityType;
  // Ability-specific params
  count?: number;           // For summon_minions
  enemyType?: EnemyType;    // For summon_minions
  duration?: number;        // For damage_shield, stun_aura (in ticks)
  reduction?: number;       // For damage_shield (0.5 = 50% reduction)
  damageBoost?: number;     // For enrage
  speedBoost?: number;      // For enrage
  healPercent?: number;     // For heal_burst
  radius?: number;          // For stun_aura
}

export interface BossPhase {
  hpThreshold: number;      // 0.75 = activates at 75% HP
  ability: BossAbility;
  announcement: string;
}

/**
 * Boss phases by enemy type
 * Each boss has unique phases that trigger at HP thresholds
 */
export const BOSS_PHASES: Partial<Record<EnemyType, BossPhase[]>> = {
  mafia_boss: [
    {
      hpThreshold: 0.75,
      ability: { type: 'summon_minions', count: 5, enemyType: 'gangster' },
      announcement: 'Wzywa ochronę!',
    },
    {
      hpThreshold: 0.50,
      ability: { type: 'damage_shield', duration: 60, reduction: 0.5 },
      announcement: 'Zakłada kamizelkę kuloodporną!',
    },
    {
      hpThreshold: 0.25,
      ability: { type: 'enrage', damageBoost: 1.5, speedBoost: 1.3 },
      announcement: 'Wścieka się!',
    },
  ],
  ai_core: [
    {
      hpThreshold: 0.80,
      ability: { type: 'summon_minions', count: 8, enemyType: 'drone' },
      announcement: 'Aktywuje drony bojowe!',
    },
    {
      hpThreshold: 0.50,
      ability: { type: 'stun_aura', radius: 5, duration: 30 },
      announcement: 'EMP Burst!',
    },
    {
      hpThreshold: 0.20,
      ability: { type: 'heal_burst', healPercent: 0.15 },
      announcement: 'Samonaprawa!',
    },
  ],
  cosmic_beast: [
    {
      hpThreshold: 0.70,
      ability: { type: 'enrage', damageBoost: 1.3, speedBoost: 1.2 },
      announcement: 'Kosmiczna Furia!',
    },
    {
      hpThreshold: 0.40,
      ability: { type: 'damage_shield', duration: 90, reduction: 0.6 },
      announcement: 'Aktywuje kosmiczną tarczę!',
    },
  ],
  dimensional_being: [
    {
      hpThreshold: 0.75,
      ability: { type: 'summon_minions', count: 4, enemyType: 'demon' },
      announcement: 'Otwiera portale!',
    },
    {
      hpThreshold: 0.50,
      ability: { type: 'heal_burst', healPercent: 0.20 },
      announcement: 'Absorbuje energię wymiarową!',
    },
    {
      hpThreshold: 0.25,
      ability: { type: 'enrage', damageBoost: 2.0, speedBoost: 1.4 },
      announcement: 'Wchodzi w szał wymiarowy!',
    },
  ],
  god: [
    {
      hpThreshold: 0.90,
      ability: { type: 'damage_shield', duration: 120, reduction: 0.75 },
      announcement: 'Boska Bariera!',
    },
    {
      hpThreshold: 0.60,
      ability: { type: 'summon_minions', count: 3, enemyType: 'einherjar' },
      announcement: 'Wzywa Einherjarów!',
    },
    {
      hpThreshold: 0.30,
      ability: { type: 'enrage', damageBoost: 2.0, speedBoost: 1.5 },
      announcement: 'Gniew Bogów!',
    },
  ],
  titan: [
    {
      hpThreshold: 0.80,
      ability: { type: 'stun_aura', radius: 6, duration: 45 },
      announcement: 'Ziemia drży!',
    },
    {
      hpThreshold: 0.50,
      ability: { type: 'enrage', damageBoost: 1.8, speedBoost: 1.0 },
      announcement: 'Tytaniczna moc!',
    },
    {
      hpThreshold: 0.20,
      ability: { type: 'heal_burst', healPercent: 0.25 },
      announcement: 'Regeneracja prymalnej siły!',
    },
  ],
  sentinel: [
    {
      hpThreshold: 0.60,
      ability: { type: 'damage_shield', duration: 60, reduction: 0.5 },
      announcement: 'Aktywuje pole siłowe!',
    },
    {
      hpThreshold: 0.30,
      ability: { type: 'summon_minions', count: 4, enemyType: 'drone' },
      announcement: 'Wzywa wsparcie!',
    },
  ],
};

/**
 * Get boss phases for an enemy type
 */
export function getBossPhases(type: EnemyType): BossPhase[] {
  return BOSS_PHASES[type] ?? [];
}

/**
 * Check if enemy type is a boss
 */
export function isBossType(type: EnemyType): boolean {
  return BOSS_PHASES[type] !== undefined;
}

/**
 * Get current boss phase based on HP percent
 */
export function getCurrentBossPhase(type: EnemyType, hpPercent: number): BossPhase | null {
  const phases = getBossPhases(type);
  // Find the first phase that hasn't been triggered yet (hp is above threshold)
  // Phases are ordered from high HP to low HP
  for (const phase of phases) {
    if (hpPercent <= phase.hpThreshold) {
      return phase;
    }
  }
  return null;
}

// ============================================================================
// ENEMY STATS
// ============================================================================

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

  // Scale HP and damage by effective wave within cycle
  // Early waves (1-40) get +5% bonus for better challenge progression
  // Base scaling: +15% per wave (buffed from 12%)
  const earlyWaveBonus = effectiveWave <= 40 ? 0.05 : 0;
  const waveScale = 1 + (effectiveWave - 1) * (0.15 + earlyWaveBonus);
  // Wave 1: 1.0x, Wave 10: 2.80x, Wave 30: 6.80x, Wave 50: 8.35x

  // Cycle scaling: exponential 1.7^cycle (buffed from 1.6x)
  // Cycle 0: 1x, Cycle 1: 1.7x, Cycle 2: 2.89x, Cycle 3: 4.9x
  const cycleScale = Math.pow(1.7, cycle);

  // Combined scaling
  const totalScale = waveScale * cycleScale;

  // Early wave HP boost (waves 1-15 get extra HP to increase early difficulty)
  // Wave 1: 1.5x, gradually decreasing to 1.0x by wave 15
  const earlyWaveHpBoost = effectiveWave <= 15
    ? 1.5 - (effectiveWave - 1) * (0.5 / 14)  // Linear decrease from 1.5 to 1.0
    : 1.0;

  // Elite multipliers
  const eliteHpMult = isElite ? 3.0 : 1;
  const eliteDmgMult = isElite ? 2.5 : 1;

  return {
    hp: Math.floor(archetype.baseHp * totalScale * eliteHpMult * earlyWaveHpBoost),
    speed: FP.fromFloat(archetype.baseSpeed / 30), // Convert to fixed-point units/tick
    damage: Math.floor(archetype.baseDamage * totalScale * eliteDmgMult),
  };
}

/**
 * Get rewards for killing enemy
 * Rewards scale with wave number and cycle (conservative scaling vs difficulty)
 */
export function getEnemyRewards(
  type: EnemyType,
  isElite: boolean,
  goldMult: number,
  _dustMult: number, // Kept for API compatibility, dust no longer earned from kills
  wave: number = 1
): { gold: number; dust: number } {
  const archetype = ENEMY_ARCHETYPES[type];

  // Elite enemies give 2x rewards (reduced from 2.5x for economy balance)
  const eliteMult = isElite ? 2.0 : 1;

  // Endless mode: calculate cycle and effective wave
  const cycle = Math.floor((wave - 1) / 100);
  const effectiveWave = ((wave - 1) % 100) + 1;

  // Wave scaling: 3% per wave (reduced from 5% - rewards grow slower than difficulty)
  const waveMultiplier = 1 + (effectiveWave - 1) * 0.03;

  // Cycle scaling: exponential 1.3^cycle (reduced from 1.4^cycle)
  // Cycle 0: 1x, Cycle 1: 1.3x, Cycle 2: 1.69x, Cycle 3: 2.2x
  const cycleMultiplier = Math.pow(1.3, cycle);

  return {
    gold: Math.floor(archetype.goldReward * eliteMult * goldMult * waveMultiplier * cycleMultiplier),
    // Dust removed from enemy kills - now earned only via daily quests
    dust: 0,
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
 * @param wave - Wave number
 * @param tickHz - Ticks per second
 * @param unlockedPillars - Optional list of unlocked pillars (filters available enemies)
 */
export function getWaveComposition(
  wave: number,
  tickHz: number,
  unlockedPillars?: PillarId[],
  currentPillar?: PillarId
): WaveComposition {
  // Endless mode: calculate cycle and effective wave
  const cycle = Math.floor((wave - 1) / 100);
  const effectiveWave = ((wave - 1) % 100) + 1;

  // Enemy count scales with actual wave (more enemies in higher cycles)
  // Increased for better early-game challenge
  const baseEnemies = (wave <= 30
    ? 8 + Math.floor(wave * 2.5)
    : 8 + Math.floor(30 * 2.5 + (wave - 30) * 1.8)) * 2;

  // Elite chance - start higher and scale faster for better early-game challenge
  // Wave 1: 8.6%, Wave 10: 14.6%, Wave 20: 20.6%
  const eliteCap = wave < 60 ? 0.35 : 0.5;
  const eliteChance = Math.min(0.08 + wave * 0.006, eliteCap);

  // Spawn interval - enemies spawn one by one from portal
  // Base: ~0.35 seconds between spawns (buffed from 0.55), speeds up with waves
  // Faster spawning creates more pressure and groups enemies together
  const baseInterval = Math.max(tickHz * 0.35 - effectiveWave * 0.15, tickHz * 0.20);
  const spawnInterval = Math.max(baseInterval - cycle * 2, 6); // Min ~0.2s at 30Hz

  const enemies: Array<{ type: EnemyType; count: number }> = [];

  // Get current pillar for this wave (handles cycles automatically, filtered by unlocks)
  const canUseOverride =
    currentPillar !== undefined &&
    (unlockedPillars === undefined || unlockedPillars.includes(currentPillar));
  const pillar = canUseOverride
    ? getPillarById(currentPillar)
    : getPillarForWave(wave, unlockedPillars);

  if (pillar) {
    // Use pillar-specific enemies
    const pillarEnemies = PILLAR_ENEMIES[pillar.id];
    const isBossWave = effectiveWave % 10 === 0; // Every 10th effective wave is a boss wave
    
    // Calculate wave position within current pillar cycle (1-10)
    // Since pillars rotate every 10 waves, we need the position in the current 10-wave cycle
    const waveInPillar = ((wave - 1) % 10) + 1;

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
