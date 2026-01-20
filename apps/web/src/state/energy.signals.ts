/**
 * Energy System State Management
 *
 * Manages the energy/stamina system state including:
 * - Current energy tracking
 * - Regeneration countdown
 * - Refill with dust
 */

import { signal, computed } from '@preact/signals';
import { getEnergy, refillEnergy as apiRefillEnergy } from '../api/energy.js';
import { baseDust } from './profile.signals.js';
import { ENERGY_CONFIG, type EnergyStatus } from '@arcade/protocol';

// ============================================================================
// SIGNALS
// ============================================================================

export const energyState = signal<EnergyStatus | null>(null);
export const energyLoading = signal(false);
export const energyError = signal<string | null>(null);
export const refilling = signal(false);

// Timer signal that updates every second to force re-computation of time-based values
export const currentTimeTick = signal(Date.now());

// Track if we need to refresh energy (when timer hits zero)
let pendingRefresh = false;

// Start the timer interval (runs globally)
let timerStarted = false;
function startRegenTimer() {
  if (timerStarted) return;
  timerStarted = true;

  // Update every second
  setInterval(() => {
    currentTimeTick.value = Date.now();
  }, 1000);

  // Also update immediately when tab becomes visible (handles browser throttling)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      currentTimeTick.value = Date.now();
    }
  });
}
startRegenTimer();

// ============================================================================
// COMPUTED VALUES
// ============================================================================

/**
 * Current energy amount
 */
export const currentEnergy = computed(() => {
  return energyState.value?.currentEnergy ?? ENERGY_CONFIG.MAX_ENERGY;
});

/**
 * Maximum energy capacity
 */
export const maxEnergy = computed(() => {
  return energyState.value?.maxEnergy ?? ENERGY_CONFIG.MAX_ENERGY;
});

/**
 * Energy as percentage (0-100)
 */
export const energyPercent = computed(() => {
  const max = maxEnergy.value;
  if (max === 0) return 100;
  return Math.round((currentEnergy.value / max) * 100);
});

/**
 * Whether user has enough energy to play
 */
export const hasEnergy = computed(() => {
  return currentEnergy.value >= ENERGY_CONFIG.ENERGY_PER_WAVE;
});

/**
 * Whether energy is full
 */
export const isEnergyFull = computed(() => {
  return currentEnergy.value >= maxEnergy.value;
});

/**
 * Whether user can refill (has dust and not full)
 */
export const canRefill = computed(() => {
  if (isEnergyFull.value) return false;
  return baseDust.value >= ENERGY_CONFIG.REFILL_DUST_COST;
});

/**
 * Time until next energy point regenerates (formatted)
 * Uses currentTimeTick to update every second
 */
export const nextRegenIn = computed(() => {
  const state = energyState.value;
  if (!state || !state.nextRegenAt) return '';

  const nextRegen = new Date(state.nextRegenAt).getTime();
  // Use currentTimeTick signal to force re-computation every second
  const now = currentTimeTick.value;
  const diffMs = nextRegen - now;

  // Auto-refresh when timer hits zero
  if (diffMs <= 0) {
    if (!pendingRefresh) {
      pendingRefresh = true;
      // Delay slightly to avoid rapid re-fetches
      setTimeout(() => {
        fetchEnergy().finally(() => {
          pendingRefresh = false;
        });
      }, 500);
    }
    return 'Now';
  }

  const minutes = Math.floor(diffMs / (1000 * 60));
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
});

/**
 * Time until full energy regenerates (formatted)
 */
export const timeToFullRegen = computed(() => {
  const state = energyState.value;
  if (!state || state.timeToFullRegen <= 0) return '';

  const totalSeconds = state.timeToFullRegen;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
});

/**
 * Refill cost in dust
 */
export const refillCost = computed(() => ENERGY_CONFIG.REFILL_DUST_COST);

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * Fetch energy status from server
 */
export async function fetchEnergy(): Promise<void> {
  energyLoading.value = true;
  energyError.value = null;

  try {
    const response = await getEnergy();
    energyState.value = response;
  } catch (error) {
    energyError.value = error instanceof Error ? error.message : 'Failed to fetch energy';
    energyState.value = null;
  } finally {
    energyLoading.value = false;
  }
}

/**
 * Refill energy using dust
 */
export async function refillEnergyAction(): Promise<boolean> {
  if (refilling.value) return false;
  if (!canRefill.value) return false;

  refilling.value = true;
  energyError.value = null;

  try {
    const response = await apiRefillEnergy();

    if (!response.success) {
      energyError.value = response.error || 'Failed to refill energy';
      return false;
    }

    // Update dust in profile
    if (response.newDust !== undefined) {
      baseDust.value = response.newDust;
    }

    // Refresh energy state
    await fetchEnergy();

    return true;
  } catch (error) {
    energyError.value = error instanceof Error ? error.message : 'Failed to refill energy';
    return false;
  } finally {
    refilling.value = false;
  }
}

/**
 * Consume energy locally after starting a wave
 * Called from game code when session starts successfully
 */
export function consumeEnergyLocal(): void {
  if (energyState.value) {
    energyState.value = {
      ...energyState.value,
      currentEnergy: Math.max(0, energyState.value.currentEnergy - ENERGY_CONFIG.ENERGY_PER_WAVE),
      canPlay: energyState.value.currentEnergy - ENERGY_CONFIG.ENERGY_PER_WAVE >= ENERGY_CONFIG.ENERGY_PER_WAVE,
    };
  }
}

/**
 * Reset energy state (on logout)
 */
export function resetEnergyState(): void {
  energyState.value = null;
  energyLoading.value = false;
  energyError.value = null;
  refilling.value = false;
}
