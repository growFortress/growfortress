/**
 * Stat Points State Signals
 *
 * Manages client-side state for the free stat points system.
 * Stat points are earned through gameplay (+1/wave, +4/level up) and
 * can be allocated to fortress or hero stats for permanent bonuses.
 */

import { signal, computed } from '@preact/signals';
import type {
  StatPointsSummaryResponse,
  FortressStatAllocations,
  HeroStatAllocations,
} from '@arcade/protocol';

// ============================================================================
// RAW STATE SIGNALS
// ============================================================================

/** Total stat points earned by the player */
export const totalStatPointsEarned = signal(0);

/** Total stat points spent (allocated) */
export const totalStatPointsSpent = signal(0);

/** Fortress stat allocations: { hp: 5, damage: 10, armor: 3 } */
export const fortressStatAllocations = signal<FortressStatAllocations>({
  hp: 0,
  damage: 0,
  armor: 0,
});

/** Hero stat allocations: [{ heroId: 'storm', allocations: { damage: 10 }}] */
export const heroStatAllocations = signal<HeroStatAllocations>([]);

// ============================================================================
// COMPUTED SIGNALS
// ============================================================================

/** Available stat points (earned - spent) */
export const availableStatPoints = computed(
  () => totalStatPointsEarned.value - totalStatPointsSpent.value
);

/** Whether the player has any available stat points */
export const hasAvailableStatPoints = computed(
  () => availableStatPoints.value > 0
);

/** Get allocations for a specific hero */
export function getHeroAllocations(heroId: string): Record<string, number> {
  const hero = heroStatAllocations.value.find(
    (h: { heroId: string; allocations: Record<string, number> }) => h.heroId === heroId
  );
  return hero?.allocations ?? {};
}

/** Get allocation for a specific fortress stat */
export function getFortressAllocation(stat: string): number {
  return (fortressStatAllocations.value as Record<string, number>)[stat] ?? 0;
}

/** Get allocation for a specific hero stat */
export function getHeroStatAllocation(heroId: string, stat: string): number {
  const allocations = getHeroAllocations(heroId);
  return allocations[stat] ?? 0;
}

// ============================================================================
// UPDATE FUNCTIONS
// ============================================================================

/**
 * Update state from server response
 */
export function updateStatPointsFromServer(data: StatPointsSummaryResponse): void {
  totalStatPointsEarned.value = data.totalEarned;
  totalStatPointsSpent.value = data.totalSpent;
  fortressStatAllocations.value = {
    hp: data.fortressAllocations.hp ?? 0,
    damage: data.fortressAllocations.damage ?? 0,
    armor: data.fortressAllocations.armor ?? 0,
  };
  heroStatAllocations.value = data.heroAllocations.map((h) => ({
    heroId: h.heroId,
    allocations: { ...h.allocations },
  }));
}

/**
 * Optimistically update fortress allocation (before server confirms)
 */
export function optimisticAllocateFortress(
  stat: string,
  pointsToAllocate: number
): void {
  // Update allocations
  const current = { ...fortressStatAllocations.value };
  const currentValue = (current as Record<string, number>)[stat] ?? 0;
  (current as Record<string, number>)[stat] = currentValue + pointsToAllocate;
  fortressStatAllocations.value = current as FortressStatAllocations;

  // Update spent count
  totalStatPointsSpent.value += pointsToAllocate;
}

/**
 * Optimistically update hero allocation (before server confirms)
 */
export function optimisticAllocateHero(
  heroId: string,
  stat: string,
  pointsToAllocate: number
): void {
  // Update allocations
  const heroes = [...heroStatAllocations.value];
  const heroIndex = heroes.findIndex((h) => h.heroId === heroId);

  if (heroIndex >= 0) {
    const hero = { ...heroes[heroIndex] };
    const allocations = { ...hero.allocations };
    allocations[stat] = (allocations[stat] ?? 0) + pointsToAllocate;
    hero.allocations = allocations;
    heroes[heroIndex] = hero;
  } else {
    heroes.push({
      heroId,
      allocations: { [stat]: pointsToAllocate },
    });
  }

  heroStatAllocations.value = heroes;

  // Update spent count
  totalStatPointsSpent.value += pointsToAllocate;
}

/**
 * Reset all state (on logout or error)
 */
export function resetStatPointsState(): void {
  totalStatPointsEarned.value = 0;
  totalStatPointsSpent.value = 0;
  fortressStatAllocations.value = { hp: 0, damage: 0, armor: 0 };
  heroStatAllocations.value = [];
}

// ============================================================================
// SIMULATION DATA EXPORT
// ============================================================================

/**
 * Get stat point data formatted for simulation config
 */
export function getStatPointDataForSimulation(): {
  fortressAllocations: Record<string, number>;
  heroAllocations: Array<{ heroId: string; allocations: Record<string, number> }>;
} {
  return {
    fortressAllocations: { ...fortressStatAllocations.value },
    heroAllocations: heroStatAllocations.value.map(
      (h: { heroId: string; allocations: Record<string, number> }) => ({
        heroId: h.heroId,
        allocations: { ...h.allocations },
      })
    ),
  };
}
