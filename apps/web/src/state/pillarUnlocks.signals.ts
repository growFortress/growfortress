/**
 * Pillar Unlocks State Management
 *
 * Manages level-gated world progression including:
 * - Unlocked pillars tracking
 * - Unlock requirements (fortress level)
 */

import { signal, computed } from '@preact/signals';
import { getPillarUnlocks } from '../api/pillarUnlocks.js';
import { getSetting, setSetting } from '../storage/idb.js';
import { currentPillar, gamePhase } from './game.signals.js';
import type {
  GetPillarUnlocksResponse,
  PillarUnlockId,
  PillarUnlockInfo,
} from '@arcade/protocol';

// ============================================================================
// SIGNALS
// ============================================================================

const SELECTED_PILLAR_KEY = 'selectedPillar';
const SELECTED_PILLAR_LOCK_KEY = 'selectedPillarLocked';

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
  if (!state) return new Set<PillarUnlockId>(['streets']);
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
 * Number of unlocked pillars
 */
export const unlockedCount = computed(() => {
  return unlockedPillars.value.length;
});

/**
 * Total number of pillars
 */
export const totalPillars = computed(() => {
  return 6; // streets, science, mutants, cosmos, magic, gods
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

// ============================================================================
// ACTIONS
// ============================================================================

async function syncSelectedPillar(unlocked: PillarUnlockId[]): Promise<void> {
  const latestUnlocked = unlocked[unlocked.length - 1] ?? 'streets';
  const storedPillar = await getSetting<PillarUnlockId>(SELECTED_PILLAR_KEY);
  const storedLocked = await getSetting<boolean>(SELECTED_PILLAR_LOCK_KEY);
  const isLocked = storedLocked ?? false;

  const hasStored = storedPillar && unlocked.includes(storedPillar);
  const nextPillar = isLocked && hasStored ? storedPillar : latestUnlocked;
  const nextLocked = isLocked && hasStored;

  await setSetting(SELECTED_PILLAR_KEY, nextPillar);
  await setSetting(SELECTED_PILLAR_LOCK_KEY, nextLocked);

  if (gamePhase.value === 'idle') {
    currentPillar.value = nextPillar;
  }
}

/**
 * Fetch pillar unlock status from server
 */
export async function fetchPillarUnlocks(): Promise<void> {
  pillarUnlocksLoading.value = true;
  pillarUnlocksError.value = null;

  try {
    const response = await getPillarUnlocks();
    pillarUnlocksState.value = response;
    await syncSelectedPillar(response.unlockedPillars);
  } catch (error) {
    pillarUnlocksError.value = error instanceof Error ? error.message : 'Failed to fetch pillar unlocks';
    pillarUnlocksState.value = null;
  } finally {
    pillarUnlocksLoading.value = false;
  }
}

/**
 * Manually select an unlocked pillar (hub only).
 */
export async function selectPillar(pillarId: PillarUnlockId): Promise<void> {
  if (gamePhase.value !== 'idle') return;
  if (!unlockedPillarSet.value.has(pillarId)) return;

  currentPillar.value = pillarId;
  await setSetting(SELECTED_PILLAR_KEY, pillarId);
  await setSetting(SELECTED_PILLAR_LOCK_KEY, true);
}

/**
 * Reset pillar unlocks state (on logout)
 */
export function resetPillarUnlocksState(): void {
  pillarUnlocksState.value = null;
  pillarUnlocksLoading.value = false;
  pillarUnlocksError.value = null;
}
