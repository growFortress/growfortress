/**
 * A/B Testing / Experiments signals
 *
 * Tracks experiment assignments for feature testing and analytics.
 * Experiments are assigned server-side and persisted for the session.
 */

import { signal } from "@preact/signals";

/**
 * Experiment variant assignments
 * Key: experiment name (e.g., 'directed_wave_1')
 * Value: variant name (e.g., 'control', 'treatment')
 */
export const experiments = signal<Record<string, string>>({});

/**
 * Whether experiments have been loaded from server
 */
export const experimentsLoaded = signal(false);

// ============================================================================
// Experiment Names (Constants)
// ============================================================================

export const EXPERIMENT_DIRECTED_WAVE_1 = "directed_wave_1";

// ============================================================================
// Functions
// ============================================================================

/**
 * Set experiments from server response (called during boot)
 */
export function setExperiments(experimentAssignments: Record<string, string>): void {
  experiments.value = experimentAssignments;
  experimentsLoaded.value = true;
}

/**
 * Get the variant for a specific experiment
 * Returns null if experiment not assigned or not loaded
 */
export function getExperiment(name: string): string | null {
  return experiments.value[name] ?? null;
}

/**
 * Check if user is in the treatment group for an experiment
 */
export function isInTreatment(name: string): boolean {
  return experiments.value[name] === "treatment";
}

/**
 * Check if user is in the control group for an experiment
 */
export function isInControl(name: string): boolean {
  return experiments.value[name] === "control";
}

/**
 * Check if directed wave 1 is enabled for this user
 * Returns true if:
 * - User is in 'treatment' group for directed_wave_1 experiment, OR
 * - Experiments not loaded yet (default to treatment for new users)
 */
export function isDirectedWave1Enabled(): boolean {
  // If experiments haven't loaded, check if user is new
  // For now, default to treatment for new users
  if (!experimentsLoaded.value) {
    return true; // Default to enabled for new users
  }

  const variant = getExperiment(EXPERIMENT_DIRECTED_WAVE_1);

  // If no assignment, enable by default (new user flow)
  if (variant === null) {
    return true;
  }

  return variant === "treatment";
}

/**
 * Assign experiment locally (for testing/override)
 * Note: Server assignment takes precedence in production
 */
export function assignExperimentLocally(name: string, variant: string): void {
  experiments.value = {
    ...experiments.value,
    [name]: variant,
  };
}

/**
 * Clear all experiment assignments (for testing)
 */
export function clearExperiments(): void {
  experiments.value = {};
  experimentsLoaded.value = false;
}
