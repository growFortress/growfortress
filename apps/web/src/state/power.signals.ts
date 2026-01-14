/**
 * Power Upgrades State
 *
 * Client-side state management for the power upgrade system.
 */

import { signal, computed, Signal, ReadonlySignal } from '@preact/signals';
import type {
  PowerStatUpgrades,
  PowerItemTier,
  PowerSummaryResponse,
  PowerBreakdown,
  EntityPower,
} from '@arcade/protocol';

// ============================================================================
// STATE TYPES
// ============================================================================

export interface PowerState {
  // Loaded from server
  fortressPower: PowerBreakdown | null;
  heroPower: EntityPower[];
  turretPower: EntityPower[];
  itemPower: number;
  totalPower: number;

  // Upgrade levels
  fortressUpgrades: PowerStatUpgrades;
  heroUpgrades: { heroId: string; statUpgrades: PowerStatUpgrades }[];
  turretUpgrades: { turretType: string; statUpgrades: PowerStatUpgrades }[];
  itemTiers: { itemId: string; tier: PowerItemTier }[];

  // UI state
  isLoading: boolean;
  error: string | null;
}

const DEFAULT_STAT_UPGRADES: PowerStatUpgrades = {
  hp: 0,
  damage: 0,
  attackSpeed: 0,
  range: 0,
  critChance: 0,
  critMultiplier: 0,
  armor: 0,
  dodge: 0,
};

// ============================================================================
// SIGNALS
// ============================================================================

/**
 * Main power state
 */
export const powerState: Signal<PowerState> = signal<PowerState>({
  fortressPower: null,
  heroPower: [],
  turretPower: [],
  itemPower: 0,
  totalPower: 0,
  fortressUpgrades: { ...DEFAULT_STAT_UPGRADES },
  heroUpgrades: [],
  turretUpgrades: [],
  itemTiers: [],
  isLoading: false,
  error: null,
});

// ============================================================================
// COMPUTED VALUES
// ============================================================================

/**
 * Total power as a display string
 */
export const totalPowerDisplay: ReadonlySignal<string> = computed(() => {
  const power = powerState.value.totalPower;
  if (power >= 1_000_000) return `${(power / 1_000_000).toFixed(1)}M`;
  if (power >= 1_000) return `${(power / 1_000).toFixed(1)}K`;
  return power.toLocaleString();
});

/**
 * Is power data loaded?
 */
export const isPowerLoaded: ReadonlySignal<boolean> = computed(() => {
  return powerState.value.fortressPower !== null;
});

// ============================================================================
// POWER UPGRADE MODAL STATE
// ============================================================================

export type PowerUpgradeTab = 'fortress' | 'heroes' | 'turrets' | 'items';

/** Whether the power upgrade modal is visible */
export const powerUpgradeModalVisible: Signal<boolean> = signal(false);

/** Currently selected tab in the power upgrade modal */
export const powerUpgradeModalTab: Signal<PowerUpgradeTab> = signal<PowerUpgradeTab>('fortress');

/**
 * Open the power upgrade modal with a specific tab
 */
export function openPowerUpgradeModal(tab: PowerUpgradeTab = 'fortress'): void {
  powerUpgradeModalTab.value = tab;
  powerUpgradeModalVisible.value = true;
}

/**
 * Close the power upgrade modal
 */
export function closePowerUpgradeModal(): void {
  powerUpgradeModalVisible.value = false;
}

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * Update power state from server response
 */
export function setPowerSummary(summary: PowerSummaryResponse): void {
  powerState.value = {
    ...powerState.value,
    fortressPower: summary.fortressPower,
    heroPower: summary.heroPower,
    turretPower: summary.turretPower,
    itemPower: summary.itemPower,
    totalPower: summary.totalPower,
    fortressUpgrades: summary.fortressUpgrades,
    heroUpgrades: summary.heroUpgrades,
    turretUpgrades: summary.turretUpgrades,
    itemTiers: summary.itemTiers,
    isLoading: false,
    error: null,
  };
}

/**
 * Set loading state
 */
export function setPowerLoading(loading: boolean): void {
  powerState.value = {
    ...powerState.value,
    isLoading: loading,
  };
}

/**
 * Set error state
 */
export function setPowerError(error: string): void {
  powerState.value = {
    ...powerState.value,
    isLoading: false,
    error,
  };
}

/**
 * Update total power after an upgrade
 */
export function updateTotalPower(newTotalPower: number): void {
  powerState.value = {
    ...powerState.value,
    totalPower: newTotalPower,
  };
}

/**
 * Update fortress stat level after upgrade
 */
export function updateFortressStatLevel(
  stat: keyof PowerStatUpgrades,
  newLevel: number
): void {
  powerState.value = {
    ...powerState.value,
    fortressUpgrades: {
      ...powerState.value.fortressUpgrades,
      [stat]: newLevel,
    },
  };
}

/**
 * Update hero stat level after upgrade
 */
export function updateHeroStatLevel(
  heroId: string,
  stat: keyof PowerStatUpgrades,
  newLevel: number
): void {
  const heroUpgrades = [...powerState.value.heroUpgrades];
  const index = heroUpgrades.findIndex(h => h.heroId === heroId);

  if (index >= 0) {
    heroUpgrades[index] = {
      ...heroUpgrades[index],
      statUpgrades: {
        ...heroUpgrades[index].statUpgrades,
        [stat]: newLevel,
      },
    };
  } else {
    heroUpgrades.push({
      heroId,
      statUpgrades: { ...DEFAULT_STAT_UPGRADES, [stat]: newLevel },
    });
  }

  powerState.value = {
    ...powerState.value,
    heroUpgrades,
  };
}

/**
 * Update turret stat level after upgrade
 */
export function updateTurretStatLevel(
  turretType: string,
  stat: keyof PowerStatUpgrades,
  newLevel: number
): void {
  const turretUpgrades = [...powerState.value.turretUpgrades];
  const index = turretUpgrades.findIndex(t => t.turretType === turretType);

  if (index >= 0) {
    turretUpgrades[index] = {
      ...turretUpgrades[index],
      statUpgrades: {
        ...turretUpgrades[index].statUpgrades,
        [stat]: newLevel,
      },
    };
  } else {
    turretUpgrades.push({
      turretType,
      statUpgrades: { ...DEFAULT_STAT_UPGRADES, [stat]: newLevel },
    });
  }

  powerState.value = {
    ...powerState.value,
    turretUpgrades,
  };
}

/**
 * Update item tier after upgrade
 */
export function updateItemTier(itemId: string, newTier: PowerItemTier): void {
  const itemTiers = [...powerState.value.itemTiers];
  const index = itemTiers.findIndex(i => i.itemId === itemId);

  if (index >= 0) {
    itemTiers[index] = { itemId, tier: newTier };
  } else {
    itemTiers.push({ itemId, tier: newTier });
  }

  powerState.value = {
    ...powerState.value,
    itemTiers,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get fortress stat upgrade level
 */
export function getFortressStatLevel(stat: keyof PowerStatUpgrades): number {
  return powerState.value.fortressUpgrades[stat] || 0;
}

/**
 * Get hero stat upgrade level
 */
export function getHeroStatLevel(
  heroId: string,
  stat: keyof PowerStatUpgrades
): number {
  const heroUpgrade = powerState.value.heroUpgrades.find(h => h.heroId === heroId);
  return heroUpgrade?.statUpgrades[stat] || 0;
}

/**
 * Get turret stat upgrade level
 */
export function getTurretStatLevel(
  turretType: string,
  stat: keyof PowerStatUpgrades
): number {
  const turretUpgrade = powerState.value.turretUpgrades.find(
    t => t.turretType === turretType
  );
  return turretUpgrade?.statUpgrades[stat] || 0;
}

/**
 * Get item tier
 */
export function getItemTierLevel(itemId: string): PowerItemTier {
  const itemTier = powerState.value.itemTiers.find(i => i.itemId === itemId);
  return itemTier?.tier || 'common';
}

/**
 * Reset all power state (on logout)
 */
export function resetPowerState(): void {
  powerState.value = {
    fortressPower: null,
    heroPower: [],
    turretPower: [],
    itemPower: 0,
    totalPower: 0,
    fortressUpgrades: {
      hp: 0,
      damage: 0,
      attackSpeed: 0,
      range: 0,
      critChance: 0,
      critMultiplier: 0,
      armor: 0,
      dodge: 0,
    },
    heroUpgrades: [],
    turretUpgrades: [],
    itemTiers: [],
    isLoading: false,
    error: null,
  };
  powerUpgradeModalVisible.value = false;
  powerUpgradeModalTab.value = 'fortress';
}
