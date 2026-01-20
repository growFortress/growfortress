/**
 * Pillar Unlocks State Management
 *
 * Manages level-gated world progression including:
 * - Unlocked pillars tracking
 * - Unlock requirements (fortress level)
 */

import { signal, computed } from '@preact/signals';
import { getPillarUnlocks } from '../api/pillarUnlocks.js';
import {
  PILLAR_UNLOCK_REQUIREMENTS,
  type GetPillarUnlocksResponse,
  type PillarUnlockId,
  type PillarUnlockInfo,
} from '@arcade/protocol';

// ============================================================================
// SIGNALS
// ============================================================================

export const pillarUnlocksState = signal<GetPillarUnlocksResponse | null>(null);
export const pillarUnlocksLoading = signal(false);
export const pillarUnlocksError = signal<string | null>(null);

// ============================================================================
// COMPUTED VALUES
// ============================================================================

/**
 * Set of unlocked pillar IDs for quick lookup
 */
export const unlockedPillarSet = computed(() => {
  const state = pillarUnlocksState.value;
  if (!state) return new Set<PillarUnlockId>(['streets']); // Default: streets always unlocked
  return new Set(state.unlockedPillars);
});

/**
 * List of all unlocked pillar IDs
 */
export const unlockedPillars = computed(() => {
  return pillarUnlocksState.value?.unlockedPillars ?? ['streets'];
});

/**
 * All pillars with unlock status
 */
export const allPillars = computed(() => {
  return pillarUnlocksState.value?.allPillars ?? [];
});

/**
 * Pillars that are locked but can be unlocked
 */
export const availableToUnlock = computed(() => {
  return allPillars.value.filter(p => !p.isUnlocked && p.canUnlock);
});

/**
 * Pillars that are locked and cannot be unlocked yet
 */
export const lockedPillars = computed(() => {
  return allPillars.value.filter(p => !p.isUnlocked && !p.canUnlock);
});

/**
 * Number of unlocked pillars
 */
export const unlockedCount = computed(() => {
  return unlockedPillars.value.length;
});

/**
 * Total number of pillars
 */
export const totalPillars = computed(() => {
  return PILLAR_UNLOCK_REQUIREMENTS.length;
});

/**
 * Progress percentage for world unlocking
 */
export const unlockProgress = computed(() => {
  return Math.round((unlockedCount.value / totalPillars.value) * 100);
});

/**
 * Current player fortress level (from state)
 */
export const currentFortressLevel = computed(() => {
  return pillarUnlocksState.value?.currentFortressLevel ?? 1;
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a specific pillar is unlocked
 */
export function isPillarUnlocked(pillarId: PillarUnlockId): boolean {
  return unlockedPillarSet.value.has(pillarId);
}

/**
 * Get info for a specific pillar
 */
export function getPillarInfo(pillarId: PillarUnlockId): PillarUnlockInfo | undefined {
  return allPillars.value.find(p => p.pillarId === pillarId);
}

/**
 * Get unlock requirement for a pillar
 */
export function getUnlockRequirement(pillarId: PillarUnlockId) {
  return PILLAR_UNLOCK_REQUIREMENTS.find(req => req.pillarId === pillarId);
}

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * Fetch pillar unlock status from server
 */
export async function fetchPillarUnlocks(): Promise<void> {
  pillarUnlocksLoading.value = true;
  pillarUnlocksError.value = null;

  try {
    const response = await getPillarUnlocks();
    pillarUnlocksState.value = response;
  } catch (error) {
    pillarUnlocksError.value = error instanceof Error ? error.message : 'Failed to fetch pillar unlocks';
    pillarUnlocksState.value = null;
  } finally {
    pillarUnlocksLoading.value = false;
  }
}

/**
 * Reset pillar unlocks state (on logout)
 */
export function resetPillarUnlocksState(): void {
  pillarUnlocksState.value = null;
  pillarUnlocksLoading.value = false;
  pillarUnlocksError.value = null;
}
