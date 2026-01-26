/**
 * Time Control Signals
 *
 * Provides slow-motion effects for dramatic moments during gameplay.
 * Used by the directed wave system for "wow moments" like elite spawns.
 */

import { signal, computed } from '@preact/signals';

// ============================================================================
// TIME SCALE STATE
// ============================================================================

/**
 * Current time scale factor (1.0 = normal speed, 0.3 = 30% speed)
 */
export const timeScale = signal(1.0);

/**
 * Whether slow motion effect is currently active
 */
export const slowMotionActive = signal(false);

/**
 * The game tick at which slow motion should end
 */
export const slowMotionEndTick = signal(0);

/**
 * Duration of current slow motion in ticks (for UI display)
 */
export const slowMotionDuration = signal(0);

/**
 * Starting tick of current slow motion (for progress calculation)
 */
export const slowMotionStartTick = signal(0);

// ============================================================================
// COMPUTED VALUES
// ============================================================================

/**
 * Progress of slow motion effect (0.0 to 1.0)
 * Useful for UI animations or gradual effects
 */
export const slowMotionProgress = computed(() => {
  if (!slowMotionActive.value || slowMotionDuration.value === 0) {
    return 0;
  }
  const elapsed = slowMotionEndTick.value - slowMotionStartTick.value - slowMotionDuration.value;
  return Math.min(1, Math.max(0, elapsed / slowMotionDuration.value));
});

// ============================================================================
// SLOW MOTION CONTROL
// ============================================================================

/**
 * Trigger a slow motion effect
 * @param durationTicks - How long the effect lasts in game ticks
 * @param scale - Time scale factor (default: 0.3 = 30% speed)
 * @param currentTick - Current game tick (needed to calculate end time)
 */
export function triggerSlowMotion(
  durationTicks: number,
  scale: number = 0.3,
  currentTick: number
): void {
  // Don't start a new slow-mo if one is already active with more time remaining
  if (slowMotionActive.value && slowMotionEndTick.value > currentTick + durationTicks) {
    return;
  }

  timeScale.value = Math.max(0.1, Math.min(1.0, scale)); // Clamp between 0.1 and 1.0
  slowMotionActive.value = true;
  slowMotionStartTick.value = currentTick;
  slowMotionDuration.value = durationTicks;
  slowMotionEndTick.value = currentTick + durationTicks;
}

/**
 * End slow motion effect immediately
 */
export function endSlowMotion(): void {
  timeScale.value = 1.0;
  slowMotionActive.value = false;
  slowMotionEndTick.value = 0;
  slowMotionDuration.value = 0;
  slowMotionStartTick.value = 0;
}

/**
 * Update slow motion state - call this each tick
 * @param currentTick - Current game tick
 * @returns true if slow motion just ended this tick
 */
export function updateSlowMotion(currentTick: number): boolean {
  if (!slowMotionActive.value) {
    return false;
  }

  if (currentTick >= slowMotionEndTick.value) {
    endSlowMotion();
    return true; // Slow motion just ended
  }

  return false;
}

/**
 * Reset all time control state (for game restart)
 */
export function resetTimeControl(): void {
  endSlowMotion();
}

// ============================================================================
// EASING UTILITIES
// ============================================================================

/**
 * Get an eased time scale that smoothly transitions in/out
 * Uses ease-in-out for smooth feel
 * @param currentTick - Current game tick
 * @param easeDuration - Ticks for ease in/out transition (default: 10)
 */
export function getEasedTimeScale(currentTick: number, easeDuration: number = 10): number {
  if (!slowMotionActive.value) {
    return 1.0;
  }

  const targetScale = timeScale.value;
  const elapsed = currentTick - slowMotionStartTick.value;
  const remaining = slowMotionEndTick.value - currentTick;

  // Ease in at start
  if (elapsed < easeDuration) {
    const t = elapsed / easeDuration;
    const eased = t * t * (3 - 2 * t); // Smoothstep
    return 1.0 + (targetScale - 1.0) * eased;
  }

  // Ease out at end
  if (remaining < easeDuration) {
    const t = remaining / easeDuration;
    const eased = t * t * (3 - 2 * t); // Smoothstep
    return 1.0 + (targetScale - 1.0) * eased;
  }

  // Full effect in middle
  return targetScale;
}
