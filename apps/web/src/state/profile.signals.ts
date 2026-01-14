import { signal, computed } from '@preact/signals';
import type { FortressClass } from '@arcade/sim-core';
import type { TurretType } from '@arcade/sim-core';
import type { UserRole } from '@arcade/protocol';

// Base inventory values (from server profile)
export const baseGold = signal(0);
export const baseDust = signal(0);
export const currentWave = signal(0);
export const baseLevel = signal(1);
export const baseXp = signal(0);
export const baseTotalXp = signal(0);
export const baseXpToNextLevel = signal(0);
export const displayName = signal<string | null>(null);
export const playerDescription = signal<string>('');
export const descriptionUpdating = signal(false);
export const userRole = signal<UserRole>('USER');
export const isAdmin = computed(() => userRole.value === 'ADMIN');

// Onboarding status
export const onboardingCompleted = signal(false);

// Default loadout (from server profile)
export interface DefaultLoadout {
  fortressClass: FortressClass | null;
  heroId: string | null;
  turretType: TurretType | null;
}

export const defaultLoadout = signal<DefaultLoadout>({
  fortressClass: null,
  heroId: null,
  turretType: null,
});

// Show onboarding modal
export const showOnboardingModal = signal(false);

// Computed: XP progress percentage (0-100)
export const xpProgress = computed(() => {
  const totalNeeded = baseXp.value + baseXpToNextLevel.value;
  if (totalNeeded === 0) return 0;
  return Math.min((baseXp.value / totalNeeded) * 100, 100);
});

/**
 * Get XP progress with additional segment XP.
 */
export function getXpProgressWithSegment(segmentXpEarned: number): number {
  const currentXp = baseXp.value + segmentXpEarned;
  const totalNeeded = currentXp + baseXpToNextLevel.value;
  if (totalNeeded === 0) return 0;
  return Math.min((currentXp / totalNeeded) * 100, 100);
}

/**
 * Reset all profile state (on logout)
 */
export function resetProfileState(): void {
  baseGold.value = 0;
  baseDust.value = 0;
  currentWave.value = 0;
  baseLevel.value = 1;
  baseXp.value = 0;
  baseTotalXp.value = 0;
  baseXpToNextLevel.value = 0;
  displayName.value = null;
  playerDescription.value = '';
  descriptionUpdating.value = false;
  userRole.value = 'USER';
  onboardingCompleted.value = false;
  defaultLoadout.value = {
    fortressClass: null,
    heroId: null,
    turretType: null,
  };
  showOnboardingModal.value = false;
}
