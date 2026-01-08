import { signal, computed } from '@preact/signals';
import type { GamePhase } from '../game/Game.js';
import type { PillarId } from '@arcade/sim-core';
import { WAVE_SCORE_MULTIPLIER, KILL_SCORE_MULTIPLIER } from '../constants.js';
import { baseGold, baseDust } from './profile.signals.js';

/**
 * Infinity Stone types
 */
export type InfinityStoneType = 'power' | 'space' | 'time' | 'reality' | 'soul' | 'mind';

/**
 * Infinity Stone fragment
 */
export interface InfinityStoneFragment {
  stoneType: InfinityStoneType;
  count: number;
}

/**
 * Infinity Gauntlet state
 */
export interface InfinityGauntletState {
  isAssembled: boolean;
  heroId?: string;
  stonesCollected: InfinityStoneType[];
  snapCooldown: number;
  snapUsedCount: number;
}

/**
 * Game state snapshot from simulation.
 */
export interface GameStateSnapshot {
  tick: number;
  wave: number;
  wavesCleared: number;
  kills: number;
  eliteKills: number;
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
  // Infinity Stones
  collectedStones: InfinityStoneType[];
  infinityStoneFragments: InfinityStoneFragment[];
  gauntletState: InfinityGauntletState | null;
  // Fortress class skills
  fortressActiveSkills: string[];
  fortressSkillCooldowns: Record<string, number>;
}

// Game phase
export const gamePhase = signal<GamePhase>('idle');

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
 * Total XP needed to REACH a given level (from level 1)
 */
function getTotalXpForLevel(level: number): number {
  let total = 0;
  for (let i = 1; i < level; i++) {
    total += getXpForLevel(i);
  }
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
