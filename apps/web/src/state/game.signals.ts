import { signal, computed } from '@preact/signals';
import type { GamePhase } from '../game/Game.js';
import type { GameSpeed } from '../game/loop.js';
export type { GameSpeed };
import type { PillarId } from '@arcade/sim-core';
import { WAVE_SCORE_MULTIPLIER, KILL_SCORE_MULTIPLIER } from '../constants.js';
import { baseGold, baseDust } from './profile.signals.js';

/**
 * Crystal types (ancient artifacts)
 */
export type CrystalType = 'power' | 'space' | 'time' | 'reality' | 'soul' | 'mind';
/** @deprecated Use CrystalType */
export type InfinityStoneType = CrystalType;

/**
 * Crystal fragment
 */
export interface CrystalFragment {
  crystalType: CrystalType;
  count: number;
  /** @deprecated Use crystalType */
  stoneType?: CrystalType;
}
/** @deprecated Use CrystalFragment */
export type InfinityStoneFragment = CrystalFragment;

/**
 * Crystal Matrix state
 */
export interface CrystalMatrixState {
  isAssembled: boolean;
  heroId?: string;
  crystalsCollected: CrystalType[];
  annihilationCooldown: number;
  annihilationUsedCount: number;
  /** @deprecated Use crystalsCollected */
  stonesCollected?: CrystalType[];
  /** @deprecated Use annihilationCooldown */
  snapCooldown?: number;
  /** @deprecated Use annihilationUsedCount */
  snapUsedCount?: number;
}
/** @deprecated Use CrystalMatrixState */
export type InfinityGauntletState = CrystalMatrixState;

/**
 * Game state snapshot from simulation.
 */
export interface GameStateSnapshot {
  tick: number;
  wave: number;
  wavesCleared: number;
  kills: number;
  eliteKills: number;
  killStreak: number;
  goldEarned: number;
  dustEarned: number;
  segmentXpEarned: number;
  waveSpawnedEnemies: number;
  waveTotalEnemies: number;
  enemyCount: number;
  relics: Array<{ id: string }>;
  skillCooldown: number;
  ended: boolean;
  currentPillar: PillarId;
  commanderLevel: number;
  sessionXpEarned: number;
  xpAtSessionStart: number;
  // Crystal system (ancient artifacts)
  collectedStones: CrystalType[];
  infinityStoneFragments: CrystalFragment[];
  gauntletState: CrystalMatrixState | null;
  // Fortress class skills
  fortressActiveSkills: string[];
  fortressSkillCooldowns: Record<string, number>;
  // Militia system
  militiaCount: number;
  maxMilitiaCount: number;
  militiaSpawnCooldowns: Record<string, number>;
}

// Game phase
export const gamePhase = signal<GamePhase>('idle');

// Force reset to hub (used when abandoning session from modal)
export const forceResetToHub = signal(false);

// Game speed multiplier (1x, 2x)
export const gameSpeed = signal<GameSpeed>(1);

// Game state snapshot (updated each tick during gameplay)
export const gameState = signal<GameStateSnapshot | null>(null);

// Fortress HP
export const fortressHp = signal(100);
export const fortressMaxHp = signal(100);
export const fortressHpPercent = computed(() => {
  const max = fortressMaxHp.value;
  if (max <= 0) return 100;
  return (fortressHp.value / max) * 100;
});

// Computed: current score
export const currentScore = computed(() => {
  const state = gameState.value;
  if (!state) return 0;
  return state.wavesCleared * WAVE_SCORE_MULTIPLIER + state.kills * KILL_SCORE_MULTIPLIER;
});

// Computed: display gold (base + earned in current session)
export const displayGold = computed(() => {
  const state = gameState.value;
  return baseGold.value + (state?.goldEarned ?? 0);
});

// Computed: display dust (base + earned in current session)
export const displayDust = computed(() => {
  const state = gameState.value;
  return baseDust.value + (state?.dustEarned ?? 0);
});

// Computed: wave progress percentage (0-100)
export const waveProgress = computed(() => {
  const state = gameState.value;
  if (!state || state.waveTotalEnemies === 0) return 0;
  return (state.waveSpawnedEnemies / state.waveTotalEnemies) * 100;
});

// Computed: waves until next boss (0 = boss wave)
export const wavesUntilBoss = computed(() => {
  const wave = gameState.value?.wave;
  if (!wave || wave <= 0) return null;
  const effectiveWave = ((wave - 1) % 100) + 1;
  return (10 - (effectiveWave % 10)) % 10;
});

// Computed: current wave is a boss wave
export const isBossWave = computed(() => wavesUntilBoss.value === 0);

// Computed: next boss wave number (null if no wave)
export const nextBossWave = computed(() => {
  const wave = gameState.value?.wave;
  const until = wavesUntilBoss.value;
  if (!wave || until === null) return null;
  return wave + (until === 0 ? 10 : until);
});

// Current pillar signal
export const currentPillar = signal<PillarId>('streets');

// Pillar display information
export const PILLAR_INFO: Record<PillarId, {
  name: string;
  subtitle: string;
  color: string;
  icon: string;
}> = {
  streets: {
    name: 'Ulice',
    subtitle: 'Street Level',
    color: '#ff6b6b',
    icon: '🏙️',
  },
  science: {
    name: 'Nauka',
    subtitle: 'Science & Tech',
    color: '#64ffda',
    icon: '🔬',
  },
  mutants: {
    name: 'Mutanci',
    subtitle: 'Mutant World',
    color: '#ee4540',
    icon: '🧬',
  },
  cosmos: {
    name: 'Kosmos',
    subtitle: 'Cosmic Level',
    color: '#3500d3',
    icon: '🌌',
  },
  magic: {
    name: 'Magia',
    subtitle: 'Mystic Realms',
    color: '#fbbf24',
    icon: '✨',
  },
  gods: {
    name: 'Bogowie',
    subtitle: 'Divine Level',
    color: '#ffd700',
    icon: '⚡',
  },
};

// Computed: current pillar info
export const currentPillarInfo = computed(() => {
  return PILLAR_INFO[currentPillar.value];
});

// Track last skill target positions for VFX (skillId -> { x, y })
export const lastSkillTargetPositions = signal<Record<string, { x: number; y: number }>>({});

/**
 * XP needed to advance from level N to level N+1 (matches fortress-progression.ts)
 */
function getXpForLevel(level: number): number {
  if (level <= 10) return level * 200;
  if (level <= 30) return level * level * 18;
  if (level <= 50) return level * level * 40;
  return 100000 + (level - 50) * 8000;
}

/**
 * Pre-computed XP lookup table for O(1) level lookups instead of O(n) loops.
 * Caches total XP needed to reach each level (1-100+).
 */
const XP_LEVEL_CACHE = new Map<number, number>();

// Pre-populate cache for common levels (1-100) at module load
(function precomputeXpTable() {
  let cumulative = 0;
  XP_LEVEL_CACHE.set(1, 0);
  for (let level = 1; level <= 100; level++) {
    XP_LEVEL_CACHE.set(level, cumulative);
    cumulative += getXpForLevel(level);
  }
})();

/**
 * Total XP needed to REACH a given level (from level 1)
 * Uses cached lookup table for O(1) performance instead of O(n) loop.
 */
function getTotalXpForLevel(level: number): number {
  // Return cached value if available
  const cached = XP_LEVEL_CACHE.get(level);
  if (cached !== undefined) return cached;

  // For levels beyond cache, compute and store
  let total = XP_LEVEL_CACHE.get(100) ?? 0;
  for (let i = 100; i < level; i++) {
    total += getXpForLevel(i);
  }
  XP_LEVEL_CACHE.set(level, total);
  return total;
}

// Computed: unified commander level (uses session commander level during gameplay, profile level otherwise)
export const unifiedLevel = computed(() => {
  const state = gameState.value;
  if (state && gamePhase.value !== 'idle') {
    return state.commanderLevel;
  }
  // Import would cause circular dependency, so we access via import
  return 1; // Will be overridden by profile signal
});

// Computed: unified XP progress (0-100) - uses session XP during gameplay
export const unifiedXpProgress = computed(() => {
  const state = gameState.value;
  const phase = gamePhase.value;

  if (state && phase !== 'idle') {
    // During gameplay: calculate progress from session XP
    const { commanderLevel, sessionXpEarned, xpAtSessionStart } = state;

    if (commanderLevel >= 50) return 100; // Max level

    // Calculate effective total XP (XP at session start + XP earned in session)
    const effectiveTotalXp = xpAtSessionStart + sessionXpEarned;

    // Calculate XP needed to reach current level
    const xpAtCurrentLevelStart = getTotalXpForLevel(commanderLevel);

    // XP accumulated within current level
    const xpInCurrentLevel = effectiveTotalXp - xpAtCurrentLevelStart;

    // XP needed to complete current level
    const xpToNextLevel = getXpForLevel(commanderLevel);

    if (xpToNextLevel <= 0) return 100;

    return Math.min(Math.max((xpInCurrentLevel / xpToNextLevel) * 100, 0), 100);
  }

  // During idle: return 0, will use profile xpProgress instead
  return 0;
});
