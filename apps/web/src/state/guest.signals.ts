/**
 * Guest mode signals
 *
 * Tracks guest user state for showing registration prompts
 * and managing guest-specific UI behavior.
 */

import { signal } from "@preact/signals";

// Whether the current user is a guest (not registered)
export const isGuestMode = signal(false);

// Whether to show the guest registration prompt/modal
export const showGuestRegistrationPrompt = signal(false);

// Countdown timer for auto-transition to hub (used in EndScreen)
export const guestAutoTransitionCountdown = signal<number | null>(null);

/**
 * Set guest mode from profile response
 */
export function setGuestMode(isGuest: boolean): void {
  isGuestMode.value = isGuest;
}

/**
 * Clear guest mode (after registration conversion)
 */
export function clearGuestMode(): void {
  isGuestMode.value = false;
  showGuestRegistrationPrompt.value = false;
  guestAutoTransitionCountdown.value = null;
}

/**
 * Show guest registration prompt (used after first run completes)
 */
export function promptGuestRegistration(): void {
  if (isGuestMode.value) {
    showGuestRegistrationPrompt.value = true;
  }
}

/**
 * Hide guest registration prompt
 */
export function dismissGuestRegistrationPrompt(): void {
  showGuestRegistrationPrompt.value = false;
}
