/**
 * Power Upgrades System - Types & Interfaces
 *
 * System permanentnej meta-progresji oparty na gold:
 * - Ulepszenia statystyk twierdzy, bohaterów i wieżyczek
 * - Item tier system (Common → Legendary)
 * - Multiplikatywna formuła Power Level
 */

// Types imported from parent module when needed

// ============================================================================
// ITEM TIER SYSTEM
// ============================================================================

export type ItemTier = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export const ITEM_TIERS: readonly ItemTier[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const;

export const ITEM_TIER_INDEX: Record<ItemTier, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
};

export function getNextItemTier(tier: ItemTier): ItemTier | null {
  const index = ITEM_TIER_INDEX[tier];
  if (index >= ITEM_TIERS.length - 1) return null;
  return ITEM_TIERS[index + 1];
}

export function isMaxItemTier(tier: ItemTier): boolean {
  return tier === 'legendary';
}

// ============================================================================
// UPGRADABLE STATS
// ============================================================================

export type UpgradableStat =
  | 'hp'
  | 'damage'
  | 'attackSpeed'
  | 'range'
  | 'critChance'
  | 'critMultiplier'
  | 'armor'
  | 'dodge';

// Simplified stat types - fewer upgrades for easier progression
export type FortressUpgradableStat = 'hp' | 'damage' | 'armor';
export type HeroUpgradableStat = 'hp' | 'damage';
export type TurretUpgradableStat = 'damage' | 'attackSpeed';

// ============================================================================
// STAT UPGRADES STRUCTURE
// ============================================================================

/**
 * Poziomy ulepszeń dla każdej statystyki (0 = brak ulepszenia)
 */
export interface StatUpgrades {
  hp: number;
  damage: number;
  attackSpeed: number;
  range: number;
  critChance: number;
  critMultiplier: number;
  armor: number;
  dodge: number;
}

export function createDefaultStatUpgrades(): StatUpgrades {
  return {
    hp: 0,
    damage: 0,
    attackSpeed: 0,
    range: 0,
    critChance: 0,
    critMultiplier: 0,
    armor: 0,
    dodge: 0,
  };
}

// ============================================================================
// ENTITY-SPECIFIC UPGRADES
// ============================================================================

/**
 * Ulepszenia twierdzy (globalne)
 */
export interface FortressUpgrades {
  statUpgrades: StatUpgrades;
}

export function createDefaultFortressUpgrades(): FortressUpgrades {
  return {
    statUpgrades: createDefaultStatUpgrades(),
  };
}

/**
 * Ulepszenia konkretnego bohatera
 */
export interface HeroUpgrades {
  heroId: string;
  statUpgrades: StatUpgrades;
}

/**
 * Ulepszenia konkretnego typu wieżyczki
 */
export interface TurretUpgrades {
  turretType: string;
  statUpgrades: StatUpgrades;
}

/**
 * Tier itemu/artefaktu
 */
export interface ItemTierUpgrade {
  itemId: string;
  tier: ItemTier;
}

// ============================================================================
// PLAYER POWER DATA (Complete Structure)
// ============================================================================

/**
 * Kompletne dane power upgrades dla gracza
 * Przechowywane w bazie danych jako JSON
 */
export interface PlayerPowerData {
  fortressUpgrades: FortressUpgrades;
  heroUpgrades: HeroUpgrades[];
  turretUpgrades: TurretUpgrades[];
  itemTiers: ItemTierUpgrade[];
}

export function createDefaultPlayerPowerData(): PlayerPowerData {
  return {
    fortressUpgrades: createDefaultFortressUpgrades(),
    heroUpgrades: [],
    turretUpgrades: [],
    itemTiers: [],
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Pobiera ulepszenia bohatera lub zwraca domyślne
 */
export function getHeroUpgrades(powerData: PlayerPowerData, heroId: string): StatUpgrades {
  const heroUpgrade = powerData.heroUpgrades.find(h => h.heroId === heroId);
  return heroUpgrade?.statUpgrades ?? createDefaultStatUpgrades();
}

/**
 * Pobiera ulepszenia wieżyczki lub zwraca domyślne
 */
export function getTurretUpgrades(powerData: PlayerPowerData, turretType: string): StatUpgrades {
  const turretUpgrade = powerData.turretUpgrades.find(t => t.turretType === turretType);
  return turretUpgrade?.statUpgrades ?? createDefaultStatUpgrades();
}

/**
 * Pobiera tier itemu lub zwraca common
 */
export function getItemTier(powerData: PlayerPowerData, itemId: string): ItemTier {
  const itemTier = powerData.itemTiers.find(i => i.itemId === itemId);
  return itemTier?.tier ?? 'common';
}

/**
 * Ustawia level ulepszenia dla bohatera (immutable update)
 */
export function setHeroStatLevel(
  powerData: PlayerPowerData,
  heroId: string,
  stat: UpgradableStat,
  level: number
): PlayerPowerData {
  const existingIndex = powerData.heroUpgrades.findIndex(h => h.heroId === heroId);

  if (existingIndex >= 0) {
    // Update existing
    const updatedHeroUpgrades = [...powerData.heroUpgrades];
    updatedHeroUpgrades[existingIndex] = {
      ...updatedHeroUpgrades[existingIndex],
      statUpgrades: {
        ...updatedHeroUpgrades[existingIndex].statUpgrades,
        [stat]: level,
      },
    };
    return { ...powerData, heroUpgrades: updatedHeroUpgrades };
  } else {
    // Create new
    const newUpgrade: HeroUpgrades = {
      heroId,
      statUpgrades: { ...createDefaultStatUpgrades(), [stat]: level },
    };
    return { ...powerData, heroUpgrades: [...powerData.heroUpgrades, newUpgrade] };
  }
}

/**
 * Ustawia level ulepszenia dla wieżyczki (immutable update)
 */
export function setTurretStatLevel(
  powerData: PlayerPowerData,
  turretType: string,
  stat: UpgradableStat,
  level: number
): PlayerPowerData {
  const existingIndex = powerData.turretUpgrades.findIndex(t => t.turretType === turretType);

  if (existingIndex >= 0) {
    const updatedTurretUpgrades = [...powerData.turretUpgrades];
    updatedTurretUpgrades[existingIndex] = {
      ...updatedTurretUpgrades[existingIndex],
      statUpgrades: {
        ...updatedTurretUpgrades[existingIndex].statUpgrades,
        [stat]: level,
      },
    };
    return { ...powerData, turretUpgrades: updatedTurretUpgrades };
  } else {
    const newUpgrade: TurretUpgrades = {
      turretType,
      statUpgrades: { ...createDefaultStatUpgrades(), [stat]: level },
    };
    return { ...powerData, turretUpgrades: [...powerData.turretUpgrades, newUpgrade] };
  }
}

/**
 * Ustawia tier itemu (immutable update)
 */
export function setItemTier(
  powerData: PlayerPowerData,
  itemId: string,
  tier: ItemTier
): PlayerPowerData {
  const existingIndex = powerData.itemTiers.findIndex(i => i.itemId === itemId);

  if (existingIndex >= 0) {
    const updatedItemTiers = [...powerData.itemTiers];
    updatedItemTiers[existingIndex] = { itemId, tier };
    return { ...powerData, itemTiers: updatedItemTiers };
  } else {
    return { ...powerData, itemTiers: [...powerData.itemTiers, { itemId, tier }] };
  }
}

// ============================================================================
// POWER BREAKDOWN (for display)
// ============================================================================

export interface PowerBreakdown {
  basePower: number;
  upgradeMultiplier: number;
  tierMultiplier: number;
  totalPower: number;
}

export interface EntityPower {
  id: string;
  power: PowerBreakdown;
}

export interface TotalPowerSummary {
  fortressPower: PowerBreakdown;
  heroPower: EntityPower[];
  turretPower: EntityPower[];
  itemPower: number;
  totalPower: number;
}
