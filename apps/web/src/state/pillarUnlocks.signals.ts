/**
 * Pillar Unlocks State Management
 *
 * Manages dust-gated world progression including:
 * - Unlocked pillars tracking
 * - Unlock requirements
 * - Purchase with dust
 */

import { signal, computed } from '@preact/signals';
import { getPillarUnlocks, unlockPillar as apiUnlockPillar } from '../api/pillarUnlocks.js';
import { baseDust } from './profile.signals.js';
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
export const unlockingPillar = signal<PillarUnlockId | null>(null);

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
 * Check if player can unlock a specific pillar
 */
export function canUnlockPillar(pillarId: PillarUnlockId): boolean {
  const info = getPillarInfo(pillarId);
  return info?.canUnlock ?? false;
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
 * Unlock a pillar using dust
 */
export async function unlockPillarAction(pillarId: PillarUnlockId): Promise<boolean> {
  if (unlockingPillar.value) return false;
  if (!canUnlockPillar(pillarId)) return false;

  unlockingPillar.value = pillarId;
  pillarUnlocksError.value = null;

  try {
    const response = await apiUnlockPillar(pillarId);

    if (!response.success) {
      pillarUnlocksError.value = response.error || 'Failed to unlock pillar';
      return false;
    }

    // Update dust in profile
    if (response.newDust !== undefined) {
      baseDust.value = response.newDust;
    }

    // Update local state with new unlocked pillars
    if (response.unlockedPillars && pillarUnlocksState.value) {
      pillarUnlocksState.value = {
        ...pillarUnlocksState.value,
        unlockedPillars: response.unlockedPillars,
        currentDust: response.newDust ?? pillarUnlocksState.value.currentDust,
      };
    }

    // Refresh full state from server
    await fetchPillarUnlocks();

    return true;
  } catch (error) {
    pillarUnlocksError.value = error instanceof Error ? error.message : 'Failed to unlock pillar';
    return false;
  } finally {
    unlockingPillar.value = null;
  }
}

/**
 * Reset pillar unlocks state (on logout)
 */
export function resetPillarUnlocksState(): void {
  pillarUnlocksState.value = null;
  pillarUnlocksLoading.value = false;
  pillarUnlocksError.value = null;
  unlockingPillar.value = null;
}
