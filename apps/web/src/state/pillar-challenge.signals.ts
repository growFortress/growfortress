/**
 * Pillar Challenge State Signals
 *
 * State management for the Pillar Challenge mode UI.
 */

import { signal, computed } from '@preact/signals';
import type {
  PillarId,
  PillarChallengeTier,
  CrystalType,
} from '@arcade/sim-core';
import type { CrystalProgress } from '../components/items/CrystalMatrix.js';

// ============================================================================
// TYPES
// ============================================================================

export interface PillarChallengeSession {
  sessionId: string;
  pillarId: PillarId;
  tier: PillarChallengeTier;
  seed: number;
  startedAt: number;
  wavesCleared: number;
  timeElapsed: number;
  fortressDamageTaken: number;
  heroesLost: number;
}

export interface PillarChallengeResult {
  success: boolean;
  wavesCleared: number;
  timeTaken: number;
  fortressHpPercent: number;
  heroesLost: number;
  fragmentsEarned: number;
  fullCrystalEarned: boolean;
  crystalType?: CrystalType;
  goldEarned: number;
  materialsEarned: Array<{ materialId: string; amount: number }>;
  bonusesAchieved: string[];
}

export interface PillarChallengeState {
  // Modal visibility
  isModalVisible: boolean;

  // Current active session
  activeSession: PillarChallengeSession | null;

  // Player's challenge progress
  dailyAttemptsUsed: number;
  dailyAttemptsMax: number;
  paidAttemptsUsed: number;
  paidAttemptsMax: number;
  cooldownEndsAt: number | null;

  // Crystal progress
  crystalProgress: CrystalProgress;
  matrixAssembled: boolean;

  // Tier unlocks (which tiers are available for each pillar)
  unlockedTiers: Record<PillarId, PillarChallengeTier[]>;

  // Best scores for leaderboard
  bestScores: Record<string, { time: number; wavesCleared: number }>;

  // Last result (for showing end screen)
  lastResult: PillarChallengeResult | null;

  // Loading states
  isLoading: boolean;
  error: string | null;
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialCrystalProgress: CrystalProgress = {
  power: 0,
  space: 0,
  time: 0,
  reality: 0,
  soul: 0,
  mind: 0,
};

const initialUnlockedTiers: Record<PillarId, PillarChallengeTier[]> = {
  streets: ['normal'],
  science: ['normal'],
  mutants: ['normal'],
  cosmos: ['normal'],
  magic: ['normal'],
  gods: ['normal'],
};

// ============================================================================
// SIGNALS
// ============================================================================

/** Pillar Challenge modal visibility */
export const pillarChallengeModalVisible = signal(false);

/** Current active session */
export const activeSession = signal<PillarChallengeSession | null>(null);

/** Daily attempts tracking */
export const dailyAttemptsUsed = signal(0);
export const dailyAttemptsMax = signal(3);
export const paidAttemptsUsed = signal(0);
export const paidAttemptsMax = signal(2);

/** Cooldown between attempts */
export const cooldownEndsAt = signal<number | null>(null);

/** Crystal fragment progress */
export const crystalProgress = signal<CrystalProgress>(initialCrystalProgress);

/** Whether the Crystal Matrix is fully assembled */
export const matrixAssembled = signal(false);

/** Unlocked tiers for each pillar */
export const unlockedTiers = signal<Record<PillarId, PillarChallengeTier[]>>(
  initialUnlockedTiers
);

/** Best scores per pillar/tier */
export const bestScores = signal<Record<string, { time: number; wavesCleared: number }>>({});

/** Last challenge result */
export const lastResult = signal<PillarChallengeResult | null>(null);

/** Loading state */
export const isLoading = signal(false);

/** Error message */
export const challengeError = signal<string | null>(null);

// ============================================================================
// COMPUTED VALUES
// ============================================================================

/** Whether the player can start a new challenge */
export const canStartChallenge = computed(() => {
  // Check if in cooldown
  if (cooldownEndsAt.value !== null && Date.now() < cooldownEndsAt.value) {
    return false;
  }

  // Check if already in session
  if (activeSession.value !== null) {
    return false;
  }

  // Check attempts
  const freeAvailable = dailyAttemptsUsed.value < dailyAttemptsMax.value;
  const paidAvailable = paidAttemptsUsed.value < paidAttemptsMax.value;

  return freeAvailable || paidAvailable;
});

/** Remaining cooldown time in seconds */
export const cooldownRemaining = computed(() => {
  if (cooldownEndsAt.value === null) return 0;
  const remaining = Math.max(0, cooldownEndsAt.value - Date.now());
  return Math.ceil(remaining / 1000);
});

/** Whether free attempts are available */
export const hasFreeAttempts = computed(() => {
  return dailyAttemptsUsed.value < dailyAttemptsMax.value;
});

/** Whether paid attempts are available */
export const hasPaidAttempts = computed(() => {
  return paidAttemptsUsed.value < paidAttemptsMax.value;
});

/** Total fragments collected */
export const totalFragments = computed(() => {
  return Object.values(crystalProgress.value).reduce((sum, f) => sum + f, 0);
});

/** Number of complete crystals */
export const completeCrystals = computed(() => {
  return Object.values(crystalProgress.value).filter(f => f >= 10).length;
});

/** Check if specific tier is unlocked for pillar */
export function isTierUnlocked(pillarId: PillarId, tier: PillarChallengeTier): boolean {
  const tiers = unlockedTiers.value[pillarId] || [];
  return tiers.includes(tier);
}

// ============================================================================
// ACTIONS
// ============================================================================

/** Show the Pillar Challenge modal */
export function showPillarChallengeModal(): void {
  pillarChallengeModalVisible.value = true;
}

/** Hide the Pillar Challenge modal */
export function hidePillarChallengeModal(): void {
  pillarChallengeModalVisible.value = false;
}

/** Update crystal progress from server response */
export function updateCrystalProgress(progress: Partial<CrystalProgress>): void {
  crystalProgress.value = {
    ...crystalProgress.value,
    ...progress,
  };
}

/** Set the active session */
export function setActiveSession(session: PillarChallengeSession | null): void {
  activeSession.value = session;
}

/** Update session progress (waves, time, etc.) */
export function updateSessionProgress(updates: Partial<PillarChallengeSession>): void {
  if (activeSession.value) {
    activeSession.value = {
      ...activeSession.value,
      ...updates,
    };
  }
}

/** Set challenge result and clear session */
export function setChallengeResult(result: PillarChallengeResult): void {
  lastResult.value = result;
  activeSession.value = null;

  // Update attempts
  dailyAttemptsUsed.value++;

  // Set cooldown (30 minutes)
  cooldownEndsAt.value = Date.now() + 30 * 60 * 1000;

  // Update crystal progress if earned fragments
  if (result.fragmentsEarned > 0 && result.crystalType) {
    const current = crystalProgress.value[result.crystalType] || 0;
    updateCrystalProgress({
      [result.crystalType]: Math.min(10, current + result.fragmentsEarned),
    });
  }
}

/** Clear the last result (dismiss end screen) */
export function clearLastResult(): void {
  lastResult.value = null;
}

/** Unlock a new tier for a pillar */
export function unlockTier(pillarId: PillarId, tier: PillarChallengeTier): void {
  const current = unlockedTiers.value[pillarId] || [];
  if (!current.includes(tier)) {
    unlockedTiers.value = {
      ...unlockedTiers.value,
      [pillarId]: [...current, tier],
    };
  }
}

/** Update best score for pillar/tier */
export function updateBestScore(
  pillarId: PillarId,
  tier: PillarChallengeTier,
  time: number,
  wavesCleared: number
): void {
  const key = `${pillarId}_${tier}`;
  const current = bestScores.value[key];

  // Only update if better (more waves, or same waves but faster)
  if (
    !current ||
    wavesCleared > current.wavesCleared ||
    (wavesCleared === current.wavesCleared && time < current.time)
  ) {
    bestScores.value = {
      ...bestScores.value,
      [key]: { time, wavesCleared },
    };
  }
}

/** Set loading state */
export function setLoading(loading: boolean): void {
  isLoading.value = loading;
}

/** Set error message */
export function setError(error: string | null): void {
  challengeError.value = error;
}

/** Reset daily attempts (called at midnight) */
export function resetDailyAttempts(): void {
  dailyAttemptsUsed.value = 0;
  paidAttemptsUsed.value = 0;
  cooldownEndsAt.value = null;
}

/** Initialize state from server data */
export function initializePillarChallengeState(data: {
  crystalProgress: CrystalProgress;
  matrixAssembled: boolean;
  unlockedTiers: Record<PillarId, PillarChallengeTier[]>;
  dailyAttemptsUsed: number;
  paidAttemptsUsed: number;
  cooldownEndsAt: number | null;
  bestScores: Record<string, { time: number; wavesCleared: number }>;
}): void {
  crystalProgress.value = data.crystalProgress;
  matrixAssembled.value = data.matrixAssembled;
  unlockedTiers.value = data.unlockedTiers;
  dailyAttemptsUsed.value = data.dailyAttemptsUsed;
  paidAttemptsUsed.value = data.paidAttemptsUsed;
  cooldownEndsAt.value = data.cooldownEndsAt;
  bestScores.value = data.bestScores;
}
