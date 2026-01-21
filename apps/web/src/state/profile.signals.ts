import { signal, computed, type Signal, type ReadonlySignal } from '@preact/signals';
import type { FortressClass } from '@arcade/sim-core';
import type { TurretType } from '@arcade/sim-core';
import type { UserRole, BuildPreset, Currency } from '@arcade/protocol';

// Base inventory values (from server profile)
export const baseGold: Signal<number> = signal(0);
export const baseDust: Signal<number> = signal(0);
export const currentWave: Signal<number> = signal(0);
export const baseLevel: Signal<number> = signal(1);
export const baseXp: Signal<number> = signal(0);
export const baseTotalXp: Signal<number> = signal(0);
export const baseXpToNextLevel: Signal<number> = signal(0);
export const displayName: Signal<string | null> = signal<string | null>(null);
export const playerDescription: Signal<string> = signal<string>('');
export const descriptionUpdating: Signal<boolean> = signal(false);
export const userRole: Signal<UserRole> = signal<UserRole>('USER');
export const isAdmin: ReadonlySignal<boolean> = computed(() => userRole.value === 'ADMIN');
export const country: Signal<string | null> = signal<string | null>(null);
export const preferredCurrency: Signal<Currency> = signal<Currency>('PLN');

// Onboarding status
export const onboardingCompleted: Signal<boolean> = signal(false);

// Game config (from server)
export interface GameConfig {
  fortressBaseHp: number;
  fortressBaseDamage: number;
}

export const gameConfig: Signal<GameConfig> = signal<GameConfig>({
  fortressBaseHp: 200, // Default, will be overwritten by server
  fortressBaseDamage: 10,
});

// Default loadout (from server profile)
export interface DefaultLoadout {
  fortressClass: FortressClass | null;
  heroId: string | null;
  turretType: TurretType | null;
}

export const defaultLoadout: Signal<DefaultLoadout> = signal<DefaultLoadout>({
  fortressClass: null,
  heroId: null,
  turretType: null,
});

// Build presets (from server profile)
export const buildPresets: Signal<BuildPreset[]> = signal<BuildPreset[]>([]);
export const activePresetId: Signal<string | null> = signal<string | null>(null);

// Show onboarding modal
export const showOnboardingModal: Signal<boolean> = signal(false);

// Computed: XP progress percentage (0-100)
export const xpProgress: ReadonlySignal<number> = computed(() => {
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
  country.value = null;
  preferredCurrency.value = 'PLN';
  onboardingCompleted.value = false;
  defaultLoadout.value = {
    fortressClass: null,
    heroId: null,
    turretType: null,
  };
  buildPresets.value = [];
  activePresetId.value = null;
  showOnboardingModal.value = false;
  gameConfig.value = {
    fortressBaseHp: 200,
    fortressBaseDamage: 10,
  };
}
