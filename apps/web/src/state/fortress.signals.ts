import { signal, computed } from '@preact/signals';
import type { FortressClass, ActiveHero, ActiveTurret, TurretSlot } from '@arcade/sim-core';
import { getHeroById, getMaxTurretSlots } from '@arcade/sim-core';
import { baseLevel } from './profile.signals.js';

// --- FORTRESS CLASS ---

/**
 * Currently selected fortress class (null = not selected yet)
 */
export const selectedFortressClass = signal<FortressClass | null>(null);

/**
 * Whether the class selection modal is visible
 */
export const classSelectionVisible = signal(false);

// --- HEROES ---

/**
 * Active heroes in the current session
 */
export const activeHeroes = signal<ActiveHero[]>([]);

/**
 * Unlocked hero IDs (meta-progression)
 * Populated from server profile, initially empty
 */
export const unlockedHeroIds = signal<string[]>([]);

/**
 * Unlocked turret IDs (meta-progression)
 * Populated from server profile, initially empty
 */
export const unlockedTurretIds = signal<string[]>([]);

/**
 * Currently selected hero for upgrade/info panel
 */
export const selectedHeroId = signal<string | null>(null);

/**
 * Whether the hero panel is visible
 */
export const heroPanelVisible = signal(false);

/**
 * Max hero slots available
 */
export const maxHeroSlots = signal(2);

/**
 * Purchased hero slots count (new slot purchase system)
 */
export const purchasedHeroSlots = signal(2);

/**
 * Purchased turret slots count (new slot purchase system)
 */
export const purchasedTurretSlots = signal(1);

/**
 * Next hero slot available for purchase (null if at max or can't afford)
 */
export const nextHeroSlotInfo = signal<{
  slot: number;
  levelRequired: number;
  goldCost: number;
  canPurchase: boolean;
  reason?: string;
} | null>(null);

/**
 * Next turret slot available for purchase
 */
export const nextTurretSlotInfo = signal<{
  slot: number;
  levelRequired: number;
  goldCost: number;
  canPurchase: boolean;
  reason?: string;
} | null>(null);

// --- TURRETS ---

/**
 * Fixed point scale (65536 = 1.0 unit, using Q16.16 format)
 */
const FP_SCALE = 1 << 16; // 65536

/**
 * Default turret slots configuration.
 * Positions are in fixed-point format matching the simulation.
 * Field is 40 units wide, path height is 15 units (y: 0-15)
 * Slots are positioned at terrain edges for clear visibility
 * isUnlocked is set to false by default - actual unlock is based on getMaxTurretSlots(level)
 */
export const DEFAULT_TURRET_SLOTS: TurretSlot[] = [
  // Top row - 3px from top yellow edge, positioned left and closer together
  { index: 1, x: 6 * FP_SCALE, y: 2 * FP_SCALE, isUnlocked: true },  // Starter slot
  { index: 2, x: 11 * FP_SCALE, y: 2 * FP_SCALE, isUnlocked: false }, // Lvl 5
  { index: 3, x: 16 * FP_SCALE, y: 2 * FP_SCALE, isUnlocked: false }, // Lvl 15
  // Bottom row - 3px from bottom yellow edge, positioned left and closer together
  { index: 4, x: 6 * FP_SCALE, y: 13 * FP_SCALE, isUnlocked: false }, // Lvl 25
  { index: 5, x: 11 * FP_SCALE, y: 13 * FP_SCALE, isUnlocked: false }, // Lvl 35
  { index: 6, x: 16 * FP_SCALE, y: 13 * FP_SCALE, isUnlocked: false }, // Lvl 40
];

/**
 * Turret slots configuration
 * Automatically updated based on purchasedTurretSlots and baseLevel
 */
export const turretSlots = computed<TurretSlot[]>(() => {
  const purchased = purchasedTurretSlots.value;
  const level = baseLevel.value;
  const maxSlots = getMaxTurretSlots(level, purchased);
  
  // Update isUnlocked for each slot based on purchased slots
  return DEFAULT_TURRET_SLOTS.map(slot => ({
    ...slot,
    isUnlocked: slot.index <= maxSlots
  }));
});

/**
 * Active turrets in slots
 */
export const activeTurrets = signal<ActiveTurret[]>([]);

/**
 * Currently selected turret slot for placing/upgrading
 */
export const selectedTurretSlot = signal<number | null>(null);

/**
 * Whether the turret panel is visible
 */
export const turretPanelVisible = signal(false);

/**
 * Whether the turret placement modal is visible (for empty slots)
 */
export const turretPlacementModalVisible = signal(false);

/**
 * Slot index where new turret will be placed
 */
export const turretPlacementSlotIndex = signal<number | null>(null);

/**
 * Whether the hero recruitment modal is visible
 */
export const heroRecruitmentModalVisible = signal(false);

/**
 * Whether the hero placement modal is visible (for changing hero slots)
 */
export const heroPlacementModalVisible = signal(false);

/**
 * Slot index where hero will be placed/replaced
 */
export const heroPlacementSlotIndex = signal<number | null>(null);

// --- SYNERGY ---

export interface SynergyBonus {
  type: 'hero-fortress' | 'turret-fortress' | 'full';
  description: string;
  bonuses: string[];
  active: boolean;
}

/**
 * Active synergy bonuses
 */
export const activeSynergies = computed<SynergyBonus[]>(() => {
  const fortressClass = selectedFortressClass.value;
  const heroes = activeHeroes.value;
  const turrets = activeTurrets.value;

  if (!fortressClass) return [];

  const synergies: SynergyBonus[] = [];

  // Check hero-fortress synergy - heroes whose class matches fortress class
  const heroesMatchingClass = heroes.filter(hero => {
    const def = getHeroById(hero.definitionId);
    return def && def.class === fortressClass;
  });

  if (heroesMatchingClass.length > 0) {
    synergies.push({
      type: 'hero-fortress',
      description: `${heroesMatchingClass.length} Hero${heroesMatchingClass.length > 1 ? 'es' : ''} matching ${fortressClass}`,
      bonuses: ['+30% DMG', '+15% AS'],
      active: true,
    });
  }

  // Check turret-fortress synergy
  const turretsMatchingClass = turrets.filter(t => t.currentClass === fortressClass);
  if (turretsMatchingClass.length > 0) {
    synergies.push({
      type: 'turret-fortress',
      description: 'Turret-Fortress Synergy',
      bonuses: ['+25% AS', '+15% DMG'],
      active: true,
    });
  }

  // Check full synergy
  if (heroesMatchingClass.length >= 2 && turretsMatchingClass.length >= 3) {
    synergies.push({
      type: 'full',
      description: 'Full Class Synergy',
      bonuses: ['+50% DMG', '+15% crit', '-20% CD'],
      active: true,
    });
  }

  return synergies;
});

// --- UPGRADE PANEL ---

export type UpgradeTarget =
  | { type: 'hero'; heroId: string }
  | { type: 'turret'; turretId: string; slotIndex: number }
  | { type: 'fortress' }
  | null;

/**
 * Currently selected upgrade target
 */
export const upgradeTarget = signal<UpgradeTarget>(null);

/**
 * Whether the upgrade panel is visible
 */
export const upgradePanelVisible = signal(false);

// --- HUB STATE (for idle phase rendering) ---

/**
 * Hub heroes - heroes to display in the hub before session starts
 * These are initialized from defaultLoadout
 * null indicates an empty slot that can be filled
 */
export const hubHeroes = signal<(ActiveHero | null)[]>([]);

/**
 * Hub turrets - turrets to display in the hub before session starts
 * These are initialized from defaultLoadout
 */
export const hubTurrets = signal<ActiveTurret[]>([]);

/**
 * Whether the hub is initialized with default loadout
 */
export const hubInitialized = signal(false);

// --- OPTIMIZED COMPUTED SIGNALS ---

/**
 * HeroPanel data - single computed signal instead of multiple subscriptions.
 * Reduces re-renders by batching all hero panel state into one subscription.
 */
export const heroPanelData = computed(() => ({
  heroes: activeHeroes.value,
  slots: maxHeroSlots.value,
  selectedId: selectedHeroId.value,
  isUpgradePanelVisible: upgradePanelVisible.value,
  upgradeTarget: upgradeTarget.value,
}));

/**
 * TurretPanel data - single computed signal for turret panel state.
 */
export const turretPanelData = computed(() => ({
  turrets: activeTurrets.value,
  slots: turretSlots.value,
  selectedSlot: selectedTurretSlot.value,
  isPlacementModalVisible: turretPlacementModalVisible.value,
  placementSlotIndex: turretPlacementSlotIndex.value,
}));
