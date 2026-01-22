import { signal } from '@preact/signals';
import type { PvpChallenge, PvpRewards, PvpOpponent } from '@arcade/protocol';
import type { ArenaBuildConfig } from '@arcade/sim-core';

// ============================================================================
// TYPES
// ============================================================================

export interface ArenaBattleData {
  seed: number;
  challengerBuild: ArenaBuildConfig;
  challengedBuild: ArenaBuildConfig;
  result: {
    winnerId: string | null;
    winReason: 'fortress_destroyed' | 'timeout' | 'draw';
    challengerStats: {
      finalHp: number;
      damageDealt: number;
      heroesAlive: number;
    };
    challengedStats: {
      finalHp: number;
      damageDealt: number;
      heroesAlive: number;
    };
    duration: number;
  };
  rewards?: PvpRewards;
  challenge: PvpChallenge;
  opponent: PvpOpponent;
}

export type ArenaBattlePhase = 'loading' | 'fighting' | 'ended';

// ============================================================================
// SIGNALS
// ============================================================================

/** Whether the arena battle scene is active */
export const arenaBattleActive = signal(false);

/** Data for the current arena battle */
export const arenaBattleData = signal<ArenaBattleData | null>(null);

/** Current phase of the battle */
export const arenaBattlePhase = signal<ArenaBattlePhase>('loading');

/** Playback speed (1x, 2x, 4x) */
export const arenaBattleSpeed = signal<1 | 2 | 4>(1);

/** Whether playback is paused */
export const arenaBattlePaused = signal(false);

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * Start an arena battle - transition to battle scene
 */
export function startArenaBattle(data: ArenaBattleData): void {
  arenaBattleData.value = data;
  arenaBattlePhase.value = 'fighting';
  arenaBattleSpeed.value = 1;
  arenaBattlePaused.value = false;
  arenaBattleActive.value = true;
}

/**
 * Set the battle phase
 */
export function setArenaBattlePhase(phase: ArenaBattlePhase): void {
  arenaBattlePhase.value = phase;
}

/**
 * Set playback speed
 */
export function setArenaBattleSpeed(speed: 1 | 2 | 4): void {
  arenaBattleSpeed.value = speed;
}

/**
 * Toggle pause state
 */
export function toggleArenaBattlePause(): void {
  arenaBattlePaused.value = !arenaBattlePaused.value;
}

/**
 * End the arena battle and return to PvP
 */
export function endArenaBattle(): void {
  arenaBattleActive.value = false;
  arenaBattleData.value = null;
  arenaBattlePhase.value = 'loading';
  arenaBattleSpeed.value = 1;
  arenaBattlePaused.value = false;
}

/**
 * Reset all arena battle state
 */
export function resetArenaBattleState(): void {
  endArenaBattle();
}
