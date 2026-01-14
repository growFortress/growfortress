/**
 * Turret Definitions (Simplified)
 *
 * 4 core turret types for the defense system.
 * Each turret starts with Natural class and can be upgraded to fortress class.
 *
 * Layout slotów (6 stałych):
 * [SLOT 1] [SLOT 2] [SLOT 3]
 *     |________|________|
 *          ZAMEK
 *     |________|________|
 * [SLOT 4] [SLOT 5] [SLOT 6]
 */

import { FortressClass, FP } from '../types';

// ============================================================================
// TYPY WIEŻYCZEK (4 core turrets)
// ============================================================================

export type TurretType =
  | 'railgun'    // Fast, single-target DPS (formerly arrow)
  | 'cryo'       // Crowd control, slow (formerly frost)
  | 'artillery'  // AOE damage (formerly cannon)
  | 'arc';       // Chain lightning (formerly tesla)

// Legacy aliases for backwards compatibility
export type LegacyTurretType = 'arrow' | 'frost' | 'cannon' | 'tesla';
export const TURRET_ID_MAP: Record<LegacyTurretType, TurretType> = {
  'arrow': 'railgun',
  'frost': 'cryo',
  'cannon': 'artillery',
  'tesla': 'arc',
};
export const REVERSE_TURRET_ID_MAP: Record<TurretType, LegacyTurretType> = {
  'railgun': 'arrow',
  'cryo': 'frost',
  'artillery': 'cannon',
  'arc': 'tesla',
};

export type TurretRole = 'dps' | 'aoe' | 'crowd_control';

// ============================================================================
// INTERFEJSY
// ============================================================================

export interface TurretAbility {
  id: string;
  name: string;
  description: string;
  cooldown: number; // w tickach
  effect: TurretAbilityEffect;
}

export interface TurretAbilityEffect {
  type: 'damage_boost' | 'aoe_attack' | 'chain_all' | 'freeze_all';
  value?: number;
  duration?: number; // w tickach
  radius?: number;
}

export interface TurretDefinition {
  id: TurretType;
  name: string;
  description: string;
  role: TurretRole;

  // Bazowe statystyki (klasa Natural)
  baseStats: {
    damage: FP;
    attackSpeed: FP; // ataki na sekundę
    range: FP;       // jednostki dystansu
    critChance: FP;
    critMultiplier: FP;
    hp: number;      // bazowe HP wieżyczki
  };

  // Koszt bazowy (tier 1)
  baseCost: {
    gold: number;
  };

  // Mnożnik kosztu za tier (cena × 2.0 za każdy tier)
  tierCostMultiplier: FP;

  // Koszt zmiany klasy
  classChangeCost: {
    gold: number;
    dust: number;
  };

  // Specjalna zdolność
  ability: TurretAbility;

  // Typ pocisku bazowy
  projectileType: 'arrow' | 'cannonball' | 'lightning' | 'ice_shard';

  // Kolory (Natural)
  colors: {
    primary: number;
    secondary: number;
    projectile: number;
  };

  // Efekty specjalne
  specialEffects?: {
    splash?: boolean;     // Czy ma splash damage
    splashRadius?: FP;    // Promień splash
    slowAmount?: FP;      // Jak mocno spowalnia (0-1)
    slowDuration?: number; // Czas spowolnienia w tickach
    chainTargets?: number; // Ile celów chain
    chainDamageReduction?: FP; // Redukcja obrażeń przy chain
  };
}

export interface TurretClassModifier {
  class: FortressClass;
  damageMultiplier: FP;
  attackSpeedMultiplier: FP;
  rangeMultiplier: FP;
  specialBonus?: string;
}

// ============================================================================
// MODYFIKATORY KLAS DLA WIEŻYCZEK
// ============================================================================

export const TURRET_CLASS_MODIFIERS: TurretClassModifier[] = [
  {
    class: 'natural',
    damageMultiplier: 16384 as FP, // 1.0
    attackSpeedMultiplier: 16384 as FP,
    rangeMultiplier: 16384 as FP,
  },
  {
    class: 'ice',
    damageMultiplier: 14746 as FP, // 0.9
    attackSpeedMultiplier: 16384 as FP,
    rangeMultiplier: 16384 as FP,
    specialBonus: '+30% slow duration',
  },
  {
    class: 'fire',
    damageMultiplier: 19661 as FP, // 1.2
    attackSpeedMultiplier: 16384 as FP,
    rangeMultiplier: 16384 as FP,
    specialBonus: '+20% DOT damage',
  },
  {
    class: 'lightning',
    damageMultiplier: 16384 as FP, // 1.0
    attackSpeedMultiplier: 21299 as FP, // 1.3
    rangeMultiplier: 16384 as FP,
    specialBonus: '+1 chain target',
  },
  {
    class: 'tech',
    damageMultiplier: 16384 as FP, // 1.0
    attackSpeedMultiplier: 16384 as FP,
    rangeMultiplier: 19661 as FP, // 1.2
    specialBonus: '+1 pierce',
  },
];

// ============================================================================
// DEFINICJE WIEŻYCZEK
// ============================================================================

const RAILGUN_TOWER: TurretDefinition = {
  id: 'railgun',
  name: 'Wieża Railgun',
  description: 'Szybka wieża strzelająca pociskami elektromagnetycznymi. Idealna do eliminacji pojedynczych celów.',
  role: 'dps',

  baseStats: {
    damage: 131072 as FP,        // 8.0
    attackSpeed: 40960 as FP,    // 2.5 ataki/s
    range: 163840 as FP,         // 10 jednostek
    critChance: 1638 as FP,      // 10%
    critMultiplier: 24576 as FP, // 1.5x
    hp: 150,                     // Fragile, high DPS
  },

  baseCost: { gold: 3000 },
  tierCostMultiplier: 32768 as FP, // 2.0
  classChangeCost: { gold: 150, dust: 15 },

  ability: {
    id: 'rapid_fire',
    name: 'Rapid Fire',
    description: 'Podwaja szybkość ataku na 5 sekund.',
    cooldown: 900, // 30 sekund
    effect: {
      type: 'damage_boost',
      value: 32768, // 2.0x attack speed
      duration: 150, // 5 sekund
    },
  },

  projectileType: 'arrow',

  colors: {
    primary: 0x4A5568,   // Slate Gray (Sci-Fi)
    secondary: 0x718096, // Gray-blue
    projectile: 0x00BFFF, // Deep Sky Blue (energy projectile)
  },
};

const ARTILLERY_TOWER: TurretDefinition = {
  id: 'artillery',
  name: 'Wieża Artyleryjska',
  description: 'Powolna ale potężna wieża z obrażeniami obszarowymi.',
  role: 'aoe',

  baseStats: {
    damage: 737280 as FP,        // 45.0
    attackSpeed: 8192 as FP,     // 0.5 ataki/s
    range: 131072 as FP,         // 8 jednostek
    critChance: 819 as FP,       // 5%
    critMultiplier: 32768 as FP, // 2.0x
    hp: 200,                     // Medium durability
  },

  baseCost: { gold: 8000 },  // Increased from 5500 for economy balance
  tierCostMultiplier: 32768 as FP,
  classChangeCost: { gold: 150, dust: 15 },

  ability: {
    id: 'explosive_shell',
    name: 'Explosive Shell',
    description: 'Następny strzał zadaje 200% obrażeń z większym splashem.',
    cooldown: 600, // 20 sekund
    effect: {
      type: 'aoe_attack',
      value: 32768, // 2.0x damage
      radius: 3,
    },
  },

  projectileType: 'cannonball',

  colors: {
    primary: 0x2F4F4F,   // DarkSlateGray
    secondary: 0x696969, // DimGray
    projectile: 0x1C1C1C, // Ciemna kula
  },

  specialEffects: {
    splash: true,
    splashRadius: 24576 as FP, // 1.5 jednostki
  },
};

const ARC_TOWER: TurretDefinition = {
  id: 'arc',
  name: 'Wieża Łukowa',
  description: 'Elektryczna wieża, której łuki energetyczne przeskakują między wrogami.',
  role: 'aoe',

  baseStats: {
    damage: 245760 as FP,        // 15.0
    attackSpeed: 19661 as FP,    // 1.2 ataki/s
    range: 114688 as FP,         // 7 jednostek
    critChance: 1638 as FP,      // 10%
    critMultiplier: 24576 as FP, // 1.5x
    hp: 180,                     // Medium
  },

  baseCost: { gold: 7000 },
  tierCostMultiplier: 32768 as FP,
  classChangeCost: { gold: 150, dust: 15 },

  ability: {
    id: 'overload',
    name: 'Overload',
    description: 'Następny atak uderza we WSZYSTKICH wrogów w zasięgu.',
    cooldown: 750, // 25 sekund
    effect: {
      type: 'chain_all',
    },
  },

  projectileType: 'lightning',

  colors: {
    primary: 0x4B0082,   // Indigo
    secondary: 0x9932CC, // DarkOrchid
    projectile: 0x00FFFF, // Cyan (energy arc)
  },

  specialEffects: {
    chainTargets: 3,
    chainDamageReduction: 4915 as FP, // -30% na każdy skok
  },
};

const CRYO_TOWER: TurretDefinition = {
  id: 'cryo',
  name: 'Wieża Kriogeniczna',
  description: 'Kriogeniczna wieża spowalniająca wrogów i zamrażająca ich na miejscu.',
  role: 'crowd_control',

  baseStats: {
    damage: 196608 as FP,        // 12.0
    attackSpeed: 16384 as FP,    // 1.0 ataki/s
    range: 131072 as FP,         // 8 jednostek
    critChance: 1638 as FP,      // 10%
    critMultiplier: 24576 as FP, // 1.5x
    hp: 200,                     // Sturdy CC
  },

  baseCost: { gold: 3500 },
  tierCostMultiplier: 32768 as FP,
  classChangeCost: { gold: 150, dust: 15 },

  ability: {
    id: 'flash_freeze',
    name: 'Flash Freeze',
    description: 'Zamraża wszystkich wrogów w zasięgu na 3 sekundy.',
    cooldown: 900, // 30 sekund
    effect: {
      type: 'freeze_all',
      duration: 90, // 3 sekundy
    },
  },

  projectileType: 'ice_shard',

  colors: {
    primary: 0x00CED1,   // DarkTurquoise
    secondary: 0x87CEEB, // SkyBlue
    projectile: 0xADD8E6, // LightBlue
  },

  specialEffects: {
    slowAmount: 8192 as FP, // 50% slow
    slowDuration: 60, // 2 sekundy
  },
};

// ============================================================================
// EKSPORT
// ============================================================================

export const TURRET_DEFINITIONS: TurretDefinition[] = [
  RAILGUN_TOWER,
  CRYO_TOWER,
  ARTILLERY_TOWER,
  ARC_TOWER,
];

// Legacy exports for backwards compatibility
export const ARROW_TOWER = RAILGUN_TOWER;
export const FROST_TOWER = CRYO_TOWER;
export const CANNON_TOWER = ARTILLERY_TOWER;
export const TESLA_TOWER = ARC_TOWER;

// ============================================================================
// SLOTY WIEŻYCZEK
// ============================================================================

export interface TurretSlot {
  id: number;
  position: 'top' | 'bottom';
  index: number; // 0, 1, 2 w każdym rzędzie
  offsetX: number; // Relatywna pozycja od zamku
  offsetY: number;
}

export const TURRET_SLOTS: TurretSlot[] = [
  // Górne sloty (nad ścieżką, PRZED zamkiem - w kierunku wrogów)
  { id: 1, position: 'top', index: 0, offsetX: 4, offsetY: -3 },
  { id: 2, position: 'top', index: 1, offsetX: 7, offsetY: -3.5 },
  { id: 3, position: 'top', index: 2, offsetX: 10, offsetY: -3 },

  // Dolne sloty (pod ścieżką, PRZED zamkiem - w kierunku wrogów)
  { id: 4, position: 'bottom', index: 0, offsetX: 4, offsetY: 3 },
  { id: 5, position: 'bottom', index: 1, offsetX: 7, offsetY: 3.5 },
  { id: 6, position: 'bottom', index: 2, offsetX: 10, offsetY: 3 },
];

// Dodatkowe sloty (odblokowywane za dust)
export const EXTRA_TURRET_SLOTS: TurretSlot[] = [
  { id: 7, position: 'top', index: 3, offsetX: 13, offsetY: -2.5 },
  { id: 8, position: 'bottom', index: 3, offsetX: 13, offsetY: 2.5 },
];

// ============================================================================
// FUNKCJE POMOCNICZE
// ============================================================================

/**
 * Normalizes turret ID from legacy to new format
 */
export function normalizeTurretId(id: string): TurretType | undefined {
  if (id in TURRET_ID_MAP) {
    return TURRET_ID_MAP[id as LegacyTurretType];
  }
  if (['railgun', 'cryo', 'artillery', 'arc'].includes(id)) {
    return id as TurretType;
  }
  return undefined;
}

/**
 * Pobiera definicję wieżyczki po ID
 * Przyjmuje string dla kompatybilności z typami runtime - zwraca undefined dla nieznanych ID
 * Supports both legacy IDs (arrow, frost, cannon, tesla) and new IDs (railgun, cryo, artillery, arc)
 */
export function getTurretById(id: string): TurretDefinition | undefined {
  const normalizedId = normalizeTurretId(id);
  if (!normalizedId) return undefined;
  return TURRET_DEFINITIONS.find(t => t.id === normalizedId);
}

/**
 * Pobiera wieżyczki według roli
 */
export function getTurretsByRole(role: TurretRole): TurretDefinition[] {
  return TURRET_DEFINITIONS.filter(t => t.role === role);
}

/**
 * Oblicza koszt wieżyczki na danym tierze
 */
export function calculateTurretCost(turret: TurretDefinition, tier: number): number {
  // Tier 1 = base cost; each tier multiplies by tierCostMultiplier (16384 = 1.0)
  const effectiveTier = Math.max(1, tier);
  const multiplier = turret.tierCostMultiplier / 16384;
  return Math.floor(
    turret.baseCost.gold * Math.pow(multiplier, effectiveTier - 1)
  );
}

/**
 * Pobiera modyfikator klasy dla wieżyczki
 */
export function getTurretClassModifier(fortressClass: FortressClass): TurretClassModifier | undefined {
  return TURRET_CLASS_MODIFIERS.find(m => m.class === fortressClass);
}

/**
 * Oblicza finalne statystyki wieżyczki z uwzględnieniem klasy i tieru
 */
export function calculateTurretStats(
  turret: TurretDefinition,
  fortressClass: FortressClass,
  tier: number
): {
  damage: FP;
  attackSpeed: FP;
  range: FP;
  critChance: FP;
  critMultiplier: FP;
} {
  const classModifier = getTurretClassModifier(fortressClass);
  const tierMultiplier = 16384 + (tier - 1) * 4096; // 1.0, 1.25, 1.5 per tier

  if (!classModifier) {
    return { ...turret.baseStats };
  }

  return {
    damage: Math.floor((turret.baseStats.damage * classModifier.damageMultiplier * tierMultiplier) / (16384 * 16384)) as FP,
    attackSpeed: Math.floor((turret.baseStats.attackSpeed * classModifier.attackSpeedMultiplier * tierMultiplier) / (16384 * 16384)) as FP,
    range: Math.floor((turret.baseStats.range * classModifier.rangeMultiplier * tierMultiplier) / (16384 * 16384)) as FP,
    critChance: turret.baseStats.critChance,
    critMultiplier: turret.baseStats.critMultiplier,
  };
}

/**
 * Sprawdza czy slot jest odblokowany
 */
export function isSlotUnlocked(slotId: number, unlockedExtraSlots: number[]): boolean {
  // Sloty 1-6 są zawsze odblokowane
  if (slotId <= 6) return true;

  // Sloty 7-8 wymagają odblokowania
  return unlockedExtraSlots.includes(slotId);
}

/**
 * Pobiera dostępne sloty
 */
export function getAvailableSlots(unlockedExtraSlots: number[] = []): TurretSlot[] {
  const baseSlots = [...TURRET_SLOTS];
  const extraSlots = EXTRA_TURRET_SLOTS.filter(slot =>
    unlockedExtraSlots.includes(slot.id)
  );

  return [...baseSlots, ...extraSlots];
}

/**
 * Koszt odblokowania dodatkowego slotu
 */
export const EXTRA_SLOT_UNLOCK_COST = {
  slot7: { dust: 700 },
  slot8: { dust: 700 },
};

/**
 * Oblicza HP wieżyczki na podstawie tieru
 * HP skaluje się: tier 1 = 1.0x, tier 2 = 1.25x, tier 3 = 1.5x
 */
export function calculateTurretHp(turret: TurretDefinition, tier: number): number {
  const tierMultiplier = 1 + (tier - 1) * 0.25;
  return Math.floor(turret.baseStats.hp * tierMultiplier);
}
