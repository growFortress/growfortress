/**
 * Artifacts and Items
 *
 * System artefaktów i przedmiotów:
 * - Artefakty Legendarne: Unikalne, 1 na jednostkę (Młot Plazmowy, Rozcinacz Burzy, etc.)
 * - Przedmioty zwykłe: Konsumowalne i equipowalne, max 3 na jednostkę
 *
 * Artefakty oparte na zaawansowanej technologii Sci-Fi.
 */

import {
  FortressClass,
  FP,
  MaterialType,
  PillarId,
  ArtifactSlotType,
  ArtifactSynergyBonus,
  ArtifactVisualDefinition,
} from '../types';

// ============================================================================
// TYPY
// ============================================================================

export type ArtifactRarity = 'legendary' | 'epic' | 'rare' | 'common';
/** @deprecated Use ArtifactSlotType from types.ts - simplified to weapon/armor/accessory */
export type ArtifactSlot = 'weapon' | 'armor' | 'accessory' | 'gadget' | 'book' | 'special';
export type ItemType = 'consumable' | 'equipment';

// ============================================================================
// INTERFEJSY - ARTEFAKTY
// ============================================================================

export interface ArtifactEffect {
  type: 'stat_boost' | 'passive' | 'class_bonus';
  stat?: string;
  value?: FP;
  classRequired?: FortressClass;
  description: string;
}

export interface ArtifactRequirement {
  heroId?: string;          // Specyficzny bohater (legacy)
  heroClass?: FortressClass; // @deprecated - use synergy instead
  heroTier?: number;         // Minimalny tier
  materials?: { type: MaterialType; amount: number }[]; // Do craftingu
}

export interface ArtifactDefinition {
  id: string;
  name: string;
  polishName: string;
  description: string;
  lore: string; // Opis fabularny

  rarity: ArtifactRarity;
  slot: ArtifactSlot;
  /** Normalized slot type for 3-slot system */
  slotType: ArtifactSlotType;

  // Wymagania (legacy - tier only)
  requirements: ArtifactRequirement;

  // System synergii (zamiast restrykcji klas)
  synergy: ArtifactSynergyBonus;

  // Efekty
  effects: ArtifactEffect[];

  // Wizualizacja proceduralna
  visuals: ArtifactVisualDefinition;

  // Legacy visuals (for backwards compatibility)
  legacyVisuals?: {
    color: number;
    glowColor: number;
    icon: string;
  };

  // Źródło zdobycia
  source: {
    type: 'drop' | 'craft' | 'quest' | 'shop';
    location?: string;
    dropChance?: FP;
    craftRecipe?: { material: MaterialType; amount: number }[];
    goldCost?: number;
  };
}

// ============================================================================
// INTERFEJSY - PRZEDMIOTY
// ============================================================================

export interface ItemEffect {
  type: 'instant' | 'duration' | 'permanent';
  stat?: string;
  value?: FP;
  duration?: number; // w tickach, tylko dla 'duration'
  description: string;
}

export interface ItemDefinition {
  id: string;
  name: string;
  polishName: string;
  description: string;

  itemType: ItemType;
  stackable: boolean;
  maxStack: number;

  effects: ItemEffect[];

  cost: {
    gold: number;
  };

  visuals: {
    color: number;
    icon: string;
  };
}

// ============================================================================
// ARTEFAKTY LEGENDARNE
// ============================================================================

const PLASMA_HAMMER: ArtifactDefinition = {
  id: 'plasma_hammer',
  name: 'Plasma Hammer',
  polishName: 'Młot Plazmowy',
  description: 'Starożytna broń z reaktorem plazmowym - symbol dowódców jednostek elektrycznych.',
  lore: 'Wykuty w kuźni orbitalnej z ultra-gęstego stopu, zdolny kanalizować energię elektryczną.',

  rarity: 'legendary',
  slot: 'weapon',
  slotType: 'weapon',

  requirements: {
    heroTier: 2,
  },

  synergy: {
    synergyClasses: ['lightning'],
    bonusMultiplier: 1.15,
    bonusDescription: '+15% efektywności dla klasy Lightning',
  },

  effects: [
    {
      type: 'stat_boost',
      stat: 'damageMultiplier',
      value: 20480 as FP, // +25%
      description: '+25% obrażeń Elektrycznych',
    },
    {
      type: 'stat_boost',
      stat: 'attackSpeed',
      value: 18842 as FP, // +15%
      description: '+15% szybkość ataku',
    },
  ],

  visuals: {
    shape: 'star',
    primaryColor: 0xc0c0c0,
    secondaryColor: 0x00bfff,
    glowColor: 0xffffff,
    animation: 'float',
    particles: 'lightning',
    particleIntensity: 0.7,
    hasOuterRing: true,
    hasInnerGlow: true,
  },

  legacyVisuals: {
    color: 0xc0c0c0,
    glowColor: 0x00bfff,
    icon: 'hammer',
  },

  source: {
    type: 'drop',
    location: 'Sektor: Apex',
    dropChance: 328 as FP, // 2%
  },
};

const STORM_CLEAVER: ArtifactDefinition = {
  id: 'storm_cleaver',
  name: 'Storm Cleaver',
  polishName: 'Rozcinacz Burzy',
  description: 'Topór-młot z generatorem teleportacyjnym i mocą przebicia osłon.',
  lore: 'Wykuty z ultra-gęstego stopu w sercu umierającej gwiazdy, potężniejszy niż Młot Plazmowy.',

  rarity: 'legendary',
  slot: 'weapon',
  slotType: 'weapon',

  requirements: {
    heroTier: 3,
  },

  synergy: {
    synergyClasses: ['lightning'],
    bonusMultiplier: 1.15,
    bonusDescription: '+15% efektywności dla klasy Lightning',
  },

  effects: [
    {
      type: 'stat_boost',
      stat: 'damageMultiplier',
      value: 22118 as FP, // +35%
      description: '+35% obrażeń',
    },
    {
      type: 'stat_boost',
      stat: 'eliteDamageBonus',
      value: 24576 as FP, // +50% (cap)
      description: '+50% obrażeń vs bossów',
    },
  ],

  visuals: {
    shape: 'star',
    primaryColor: 0x8b4513,
    secondaryColor: 0xffd700,
    glowColor: 0xffffff,
    animation: 'float',
    particles: 'lightning',
    particleIntensity: 0.8,
    hasOuterRing: true,
    hasInnerGlow: true,
  },

  legacyVisuals: {
    color: 0x8b4513,
    glowColor: 0xffd700,
    icon: 'axe',
  },

  source: {
    type: 'craft',
    craftRecipe: [
      { material: 'uru', amount: 5 },
      { material: 'cosmic_dust', amount: 3 },
    ],
    goldCost: 5000,
  },
};

const KINETIC_DEFLECTOR: ArtifactDefinition = {
  id: 'kinetic_deflector',
  name: 'Kinetic Deflector',
  polishName: 'Deflektor Kinetyczny',
  description: 'Niezniszczalna tarcza z Fazowego Stopu.',
  lore: 'Zaprojektowana w najlepszych wojskowych laboratoriach, ta tarcza absorbuje i odbija całą energię kinetyczną.',

  rarity: 'legendary',
  slot: 'armor',
  slotType: 'armor',

  requirements: {},

  synergy: {
    synergyClasses: ['natural'],
    bonusMultiplier: 1.15,
    bonusDescription: '+15% efektywności dla klasy Natural',
  },

  effects: [
    {
      type: 'stat_boost',
      stat: 'blockChance',
      value: 24576 as FP, // +50% block
      description: '+50% szansa na blok',
    },
    {
      type: 'passive',
      description: 'Absorpcja Fazowa: Zablokowane ataki regenerują HP',
    },
  ],

  visuals: {
    shape: 'star',
    primaryColor: 0x0000cd,
    secondaryColor: 0xff0000,
    glowColor: 0xffffff,
    animation: 'float',
    particles: 'sparkles',
    particleIntensity: 0.6,
    hasOuterRing: true,
    hasInnerGlow: true,
  },

  legacyVisuals: {
    color: 0x0000cd,
    glowColor: 0xff0000,
    icon: 'shield',
  },

  source: {
    type: 'craft',
    craftRecipe: [{ material: 'vibranium', amount: 3 }],
    goldCost: 2000,
  },
};

const QUANTUM_ARMOR: ArtifactDefinition = {
  id: 'quantum_armor_mk50',
  name: 'Quantum Armor MK50',
  polishName: 'Pancerz Kwantowy MK50',
  description: 'Najnowsza wersja pancerza z nanotechnologią adaptacyjną.',
  lore: 'Pancerz składający się z miliardów nanitów, zdolny do natychmiastowej naprawy i transformacji.',

  rarity: 'legendary',
  slot: 'armor',
  slotType: 'armor',

  requirements: {
    heroTier: 3,
  },

  synergy: {
    synergyClasses: ['tech'],
    bonusMultiplier: 1.15,
    bonusDescription: '+15% efektywności dla klasy Tech',
  },

  effects: [
    {
      type: 'stat_boost',
      stat: 'allStats',
      value: 19661 as FP, // +20%
      description: '+20% wszystkie statystyki',
    },
    {
      type: 'passive',
      description: 'Nano-Naprawa: +20 HP regeneracji na sekundę',
    },
  ],

  visuals: {
    shape: 'star',
    primaryColor: 0x00f0ff,
    secondaryColor: 0xff00aa,
    glowColor: 0xffffff,
    animation: 'float',
    particles: 'plasma',
    particleIntensity: 0.8,
    hasOuterRing: true,
    hasInnerGlow: true,
  },

  legacyVisuals: {
    color: 0x00f0ff,
    glowColor: 0xff00aa,
    icon: 'armor_suit',
  },

  source: {
    type: 'craft',
    craftRecipe: [
      { material: 'extremis', amount: 3 },
      { material: 'vibranium', amount: 2 },
    ],
    goldCost: 4000,
  },
};

const GRAPPLE_LAUNCHER: ArtifactDefinition = {
  id: 'grapple_launcher_mk2',
  name: 'Grapple Launcher MK2',
  polishName: 'Miotacz Linek MK2',
  description: 'Ulepszone miotacze linek hakowych z nieskończonym zapasem.',
  lore: 'Zaprojektowane w laboratoriach wojskowych dla jednostek mobilnych.',

  rarity: 'epic',
  slot: 'gadget',
  slotType: 'armor', // gadget → armor slot

  requirements: {},

  synergy: {
    synergyClasses: ['tech'],
    bonusMultiplier: 1.15,
    bonusDescription: '+15% efektywności dla klasy Tech',
  },

  effects: [
    {
      type: 'stat_boost',
      stat: 'damageMultiplier',
      value: 20480 as FP, // +25%
      description: '+25% obrażeń',
    },
    {
      type: 'stat_boost',
      stat: 'cooldownReduction',
      value: 19661 as FP, // +20%
      description: '-20% cooldown umiejętności',
    },
  ],

  visuals: {
    shape: 'gear',
    primaryColor: 0xff0000,
    secondaryColor: 0xffffff,
    glowColor: 0xff6666,
    animation: 'shimmer',
    particles: 'none',
    particleIntensity: 0.3,
    hasOuterRing: false,
    hasInnerGlow: true,
  },

  legacyVisuals: {
    color: 0xff0000,
    glowColor: 0xffffff,
    icon: 'grapple',
  },

  source: {
    type: 'craft',
    craftRecipe: [{ material: 'pym_particles', amount: 2 }],
    goldCost: 1500,
  },
};

const GRAVITY_HARNESS: ArtifactDefinition = {
  id: 'gravity_harness',
  name: 'Gravity Harness',
  polishName: 'Uprząż Grawitacyjna',
  description: 'Zaawansowany system antygrawitacyjny z AI wspomagającą.',
  lore: 'Opracowany z technologii odzyskanej z wraków Roju, ten moduł pozwala na lot i posiada autonomiczny system obronny.',

  rarity: 'legendary',
  slot: 'accessory',
  slotType: 'accessory',

  requirements: {},

  synergy: {
    synergyClasses: ['fire'],
    bonusMultiplier: 1.15,
    bonusDescription: '+15% efektywności dla klasy Fire',
  },

  effects: [
    {
      type: 'stat_boost',
      stat: 'dodgeChance',
      value: 20480 as FP, // +25%
      description: '+25% szansa na unik',
    },
    {
      type: 'stat_boost',
      stat: 'critChance',
      value: 18842 as FP, // +15%
      description: '+15% szansa na krytyczne',
    },
  ],

  visuals: {
    shape: 'star',
    primaryColor: 0x8b0000,
    secondaryColor: 0xff6347,
    glowColor: 0xffffff,
    animation: 'float',
    particles: 'flames',
    particleIntensity: 0.6,
    hasOuterRing: true,
    hasInnerGlow: true,
  },

  legacyVisuals: {
    color: 0x8b0000,
    glowColor: 0xff6347,
    icon: 'harness',
  },

  source: {
    type: 'drop',
    location: 'Sektor: Wymiary',
    dropChance: 492 as FP, // 3%
  },
};

const TEMPORAL_SCANNER: ArtifactDefinition = {
  id: 'temporal_scanner',
  name: 'Temporal Scanner',
  polishName: 'Skaner Temporalny',
  description: 'Starożytny artefakt zawierający slot na Kryształ Czasu.',
  lore: 'Odzyskany z ruin wymarłej cywilizacji, skaner jest kluczem do manipulacji czasem.',

  rarity: 'legendary',
  slot: 'accessory',
  slotType: 'accessory',

  requirements: {
    heroTier: 2,
  },

  synergy: {
    synergyClasses: ['fire', 'void'],
    bonusMultiplier: 1.15,
    bonusDescription: '+15% efektywności dla klasy Fire lub Void',
  },

  effects: [
    {
      type: 'stat_boost',
      stat: 'cooldownReduction',
      value: 21299 as FP, // +30%
      description: '-30% cooldown umiejętności',
    },
    {
      type: 'stat_boost',
      stat: 'damageMultiplier',
      value: 19661 as FP, // +20%
      description: '+20% obrażeń',
    },
  ],

  visuals: {
    shape: 'star',
    primaryColor: 0x00ff00,
    secondaryColor: 0x98fb98,
    glowColor: 0xffffff,
    animation: 'float',
    particles: 'sparkles',
    particleIntensity: 0.7,
    hasOuterRing: true,
    hasInnerGlow: true,
  },

  legacyVisuals: {
    color: 0x00ff00,
    glowColor: 0x98fb98,
    icon: 'scanner',
  },

  source: {
    type: 'quest',
    location: 'Quest: Tajemnice Ruin',
  },
};

const VOID_CODEX: ArtifactDefinition = {
  id: 'void_codex',
  name: 'Void Codex',
  polishName: 'Kodeks Próżni',
  description: 'Dane z Wyrwy - potężne, ale niestabilne.',
  lore: 'Zapisane przez pierwszych badaczy Wyrwy, kodeks zawiera niebezpieczną wiedzę o manipulacji wymiarowej.',

  rarity: 'legendary',
  slot: 'book',
  slotType: 'accessory', // book → accessory slot

  requirements: {},

  synergy: {
    synergyClasses: ['void', 'fire'],
    bonusMultiplier: 1.15,
    bonusDescription: '+15% efektywności dla klasy Void lub Fire',
  },

  effects: [
    {
      type: 'stat_boost',
      stat: 'damageMultiplier',
      value: 21299 as FP, // +30%
      description: '+30% obrażeń',
    },
    {
      type: 'stat_boost',
      stat: 'cooldownReduction',
      value: 22118 as FP, // +35%
      description: '-35% cooldown umiejętności',
    },
  ],

  visuals: {
    shape: 'star',
    primaryColor: 0x4b0082,
    secondaryColor: 0x9400d3,
    glowColor: 0xffffff,
    animation: 'float',
    particles: 'void',
    particleIntensity: 0.8,
    hasOuterRing: true,
    hasInnerGlow: true,
  },

  legacyVisuals: {
    color: 0x4b0082,
    glowColor: 0x9400d3,
    icon: 'codex_dark',
  },

  source: {
    type: 'drop',
    location: 'Sektor: Wymiary - Boss Władca Wyrwy',
    dropChance: 164 as FP, // 1%
  },
};

const GUARDIAN_PROTOCOLS: ArtifactDefinition = {
  id: 'guardian_protocols',
  name: 'Guardian Protocols',
  polishName: 'Protokoły Strażników',
  description: 'Przeciwwaga dla Kodeksu Próżni - ochronne algorytmy.',
  lore: 'Kompendium najpotężniejszych protokołów obronnych opracowanych przez Straż Ludzkości.',

  rarity: 'legendary',
  slot: 'book',
  slotType: 'accessory', // book → accessory slot

  requirements: {},

  synergy: {
    synergyClasses: ['fire', 'natural'],
    bonusMultiplier: 1.15,
    bonusDescription: '+15% efektywności dla klasy Fire lub Natural',
  },

  effects: [
    {
      type: 'stat_boost',
      stat: 'maxHpBonus',
      value: 22118 as FP, // +35%
      description: '+35% HP',
    },
    {
      type: 'stat_boost',
      stat: 'ccResistance',
      value: 20480 as FP, // +25%
      description: '+25% odporność na CC',
    },
  ],

  visuals: {
    shape: 'star',
    primaryColor: 0xffd700,
    secondaryColor: 0xfffacd,
    glowColor: 0xffffff,
    animation: 'float',
    particles: 'sparkles',
    particleIntensity: 0.7,
    hasOuterRing: true,
    hasInnerGlow: true,
  },

  legacyVisuals: {
    color: 0xffd700,
    glowColor: 0xfffacd,
    icon: 'protocols',
  },

  source: {
    type: 'quest',
    location: 'Quest: Próby Strażników',
  },
};

const CRYO_MATRIX: ArtifactDefinition = {
  id: 'cryo_matrix',
  name: 'Cryo Matrix',
  polishName: 'Matryca Kriogeniczna',
  description: 'Artefakt z technologią kriogeniczną, zamrażający wszystko na swojej drodze.',
  lore: 'Odzyskana z ruin stacji polarnej, zawiera skondensowaną moc absolutnego zera.',

  rarity: 'legendary',
  slot: 'special',
  slotType: 'accessory', // special → accessory slot

  requirements: {},

  synergy: {
    synergyClasses: ['ice'],
    bonusMultiplier: 1.15,
    bonusDescription: '+15% efektywności dla klasy Ice',
  },

  effects: [
    {
      type: 'stat_boost',
      stat: 'damageMultiplier',
      value: 22118 as FP, // +35%
      description: '+35% obrażeń',
    },
    {
      type: 'stat_boost',
      stat: 'ccResistance',
      value: 21299 as FP, // +30%
      description: '+30% odporność na CC',
    },
  ],

  visuals: {
    shape: 'star',
    primaryColor: 0x00bfff,
    secondaryColor: 0xe0ffff,
    glowColor: 0xffffff,
    animation: 'float',
    particles: 'frost',
    particleIntensity: 0.8,
    hasOuterRing: true,
    hasInnerGlow: true,
  },

  legacyVisuals: {
    color: 0x00bfff,
    glowColor: 0xe0ffff,
    icon: 'cryo_core',
  },

  source: {
    type: 'drop',
    location: 'Sektor: Apex - Boss Lodowy Tytan',
    dropChance: 328 as FP, // 2%
  },
};

const OBSIDIAN_EDGE: ArtifactDefinition = {
  id: 'obsidian_edge',
  name: 'Obsidian Edge',
  polishName: 'Obsydianowe Ostrze',
  description: 'Przeklęty miecz, który żywi się energią życiową. Ogromna moc za straszną cenę.',
  lore: 'Wykuty z meteorytu przesiąkniętego energią Wyrwy, miecz jest niezniszczalny, ale druzgocze psychikę właściciela.',

  rarity: 'legendary',
  slot: 'weapon',
  slotType: 'weapon',

  requirements: {},

  synergy: {
    synergyClasses: ['natural', 'void'],
    bonusMultiplier: 1.15,
    bonusDescription: '+15% efektywności dla klasy Natural lub Void',
  },

  effects: [
    {
      type: 'stat_boost',
      stat: 'damageMultiplier',
      value: 22938 as FP, // +40%
      description: '+40% obrażeń',
    },
    {
      type: 'passive',
      description: 'Klątwa Krwi: Każdy atak kosztuje 1% HP',
    },
  ],

  visuals: {
    shape: 'star',
    primaryColor: 0x000000,
    secondaryColor: 0x8b0000,
    glowColor: 0xff0000,
    animation: 'float',
    particles: 'void',
    particleIntensity: 0.9,
    hasOuterRing: true,
    hasInnerGlow: true,
  },

  legacyVisuals: {
    color: 0x000000,
    glowColor: 0x8b0000,
    icon: 'sword_obsidian',
  },

  source: {
    type: 'quest',
    location: 'Quest: Dziedzictwo Mrocznego Rycerza',
  },
};

const CRYSTAL_MATRIX: ArtifactDefinition = {
  id: 'crystal_matrix',
  name: 'Crystal Matrix',
  polishName: 'Matryca Kryształów',
  description: 'Urządzenie zdolne pomieścić wszystkie Starożytne Kryształy.',
  lore: 'Starożytna technologia obcej cywilizacji, może kontrolować całą rzeczywistość.',

  rarity: 'legendary',
  slot: 'special',
  slotType: 'accessory', // special → accessory slot

  requirements: {
    heroTier: 3,
  },

  synergy: {
    synergyClasses: ['natural', 'ice', 'fire', 'lightning', 'tech', 'void', 'plasma'],
    bonusMultiplier: 1.0, // No synergy bonus - already ultimate
    bonusDescription: 'Uniwersalny - pasuje do każdej klasy',
  },

  effects: [
    {
      type: 'stat_boost',
      stat: 'allStats',
      value: 22118 as FP, // +35% (capped from 200%)
      description: '+35% wszystkie statystyki',
    },
    {
      type: 'stat_boost',
      stat: 'cooldownReduction',
      value: 20480 as FP, // +25%
      description: '-25% cooldown umiejętności',
    },
  ],

  visuals: {
    shape: 'star',
    primaryColor: 0xffd700,
    secondaryColor: 0xffffff,
    glowColor: 0xffffff,
    accentColor: 0xff00ff,
    animation: 'float',
    animationSpeed: 0.6,
    particles: 'sparkles',
    particleIntensity: 1.0,
    hasOuterRing: true,
    hasInnerGlow: true,
  },

  legacyVisuals: {
    color: 0xffd700,
    glowColor: 0xffffff,
    icon: 'matrix',
  },

  source: {
    type: 'drop',
    location: 'Sektor: Apex - Final Boss',
    dropChance: 82 as FP, // 0.5%
  },
};

// ============================================================================
// NOWE ARTEFAKTY - COMMON
// ============================================================================

// --- BRONIE COMMON ---

const PULSE_RIFLE: ArtifactDefinition = {
  id: 'pulse_rifle',
  name: 'Pulse Rifle',
  polishName: 'Karabin Pulsowy',
  description: 'Standardowy karabin energetyczny używany przez jednostki techniczne.',
  lore: 'Masowo produkowany w fabrykach obronnych, niezawodny i skuteczny.',

  rarity: 'common',
  slot: 'weapon',
  slotType: 'weapon',

  requirements: {},

  synergy: {
    synergyClasses: ['tech', 'plasma'],
    bonusMultiplier: 1.15,
    bonusDescription: '+15% efektywności dla klasy Tech lub Plasma',
  },

  effects: [
    { type: 'stat_boost', stat: 'damageMultiplier', value: 18350 as FP, description: '+12% obrażeń' },
    { type: 'stat_boost', stat: 'attackSpeed', value: 17203 as FP, description: '+5% szybkości ataku' },
  ],

  visuals: {
    shape: 'blade',
    primaryColor: 0x00ffff,
    secondaryColor: 0x0080ff,
    glowColor: 0x00ffff,
    animation: 'pulse',
    particles: 'plasma',
    particleIntensity: 0.3,
    hasOuterRing: false,
    hasInnerGlow: false,
  },

  source: {
    type: 'craft',
    craftRecipe: [{ material: 'pym_particles', amount: 3 }],
    goldCost: 500,
  },
};

const CRYO_BLADE: ArtifactDefinition = {
  id: 'cryo_blade',
  name: 'Cryo Blade',
  polishName: 'Ostrze Kriogeniczne',
  description: 'Ostrze pokryte lodową powłoką, spowalniające trafione cele.',
  lore: 'Wykute w kriogenicznych komorach polarnych baz wojskowych.',

  rarity: 'common',
  slot: 'weapon',
  slotType: 'weapon',

  requirements: {},

  synergy: {
    synergyClasses: ['ice'],
    bonusMultiplier: 1.15,
    bonusDescription: '+15% efektywności dla klasy Ice',
  },

  effects: [
    { type: 'stat_boost', stat: 'damageMultiplier', value: 18022 as FP, description: '+10% obrażeń' },
    { type: 'passive', description: '15% szansa na spowolnienie przy trafieniu' },
  ],

  visuals: {
    shape: 'blade',
    primaryColor: 0x00bfff,
    secondaryColor: 0xe0ffff,
    glowColor: 0x87ceeb,
    animation: 'pulse',
    particles: 'frost',
    particleIntensity: 0.3,
    hasOuterRing: false,
    hasInnerGlow: false,
  },

  source: {
    type: 'craft',
    craftRecipe: [{ material: 'cosmic_dust', amount: 2 }],
    goldCost: 400,
  },
};

const THUNDER_LANCE: ArtifactDefinition = {
  id: 'thunder_lance',
  name: 'Thunder Lance',
  polishName: 'Lanca Piorunowa',
  description: 'Lanca generująca wyładowania elektryczne przy trafieniu.',
  lore: 'Używana przez elitarne jednostki szturmowe w walkach z maszynami.',

  rarity: 'common',
  slot: 'weapon',
  slotType: 'weapon',

  requirements: {},

  synergy: {
    synergyClasses: ['lightning'],
    bonusMultiplier: 1.15,
    bonusDescription: '+15% efektywności dla klasy Lightning',
  },

  effects: [
    { type: 'stat_boost', stat: 'damageMultiplier', value: 17695 as FP, description: '+8% obrażeń' },
    { type: 'stat_boost', stat: 'chainChance', value: 19661 as FP, description: '20% szansa na łańcuch' },
  ],

  visuals: {
    shape: 'blade',
    primaryColor: 0x9932cc,
    secondaryColor: 0xda70d6,
    glowColor: 0xffff00,
    animation: 'pulse',
    particles: 'lightning',
    particleIntensity: 0.4,
    hasOuterRing: false,
    hasInnerGlow: false,
  },

  source: {
    type: 'craft',
    craftRecipe: [{ material: 'uru', amount: 2 }],
    goldCost: 450,
  },
};

const FLAME_EDGE: ArtifactDefinition = {
  id: 'flame_edge',
  name: 'Flame Edge',
  polishName: 'Płomienna Krawędź',
  description: 'Miecz z płonącym ostrzem, zadający obrażenia od ognia.',
  lore: 'Wykuty w wulkanicznych kuźniach, wiecznie płonący.',

  rarity: 'common',
  slot: 'weapon',
  slotType: 'weapon',

  requirements: {},

  synergy: {
    synergyClasses: ['fire'],
    bonusMultiplier: 1.15,
    bonusDescription: '+15% efektywności dla klasy Fire',
  },

  effects: [
    { type: 'stat_boost', stat: 'damageMultiplier', value: 18022 as FP, description: '+10% obrażeń' },
    { type: 'passive', description: 'Podpalenie: 3 DMG/s przez 3s' },
  ],

  visuals: {
    shape: 'blade',
    primaryColor: 0xff4500,
    secondaryColor: 0xff6600,
    glowColor: 0xffaa00,
    animation: 'pulse',
    particles: 'flames',
    particleIntensity: 0.4,
    hasOuterRing: false,
    hasInnerGlow: false,
  },

  source: {
    type: 'craft',
    craftRecipe: [{ material: 'darkforce', amount: 3 }],
    goldCost: 400,
  },
};

// --- ZBROJE COMMON ---

const REACTIVE_PLATING: ArtifactDefinition = {
  id: 'reactive_plating',
  name: 'Reactive Plating',
  polishName: 'Płyty Reaktywne',
  description: 'Standardowe opancerzenie z warstwą absorpcyjną.',
  lore: 'Podstawowy pancerz wojskowy, sprawdzony na wielu polach bitwy.',

  rarity: 'common',
  slot: 'armor',
  slotType: 'armor',

  requirements: {},

  synergy: {
    synergyClasses: ['tech', 'natural'],
    bonusMultiplier: 1.15,
    bonusDescription: '+15% efektywności dla klasy Tech lub Natural',
  },

  effects: [
    { type: 'stat_boost', stat: 'maxHpBonus', value: 18022 as FP, description: '+10% HP' },
    { type: 'stat_boost', stat: 'incomingDamageReduction', value: 17203 as FP, description: '+5% redukcja obrażeń' },
  ],

  visuals: {
    shape: 'shield',
    primaryColor: 0x808080,
    secondaryColor: 0xc0c0c0,
    glowColor: 0x808080,
    animation: 'pulse',
    particles: 'none',
    particleIntensity: 0.2,
    hasOuterRing: false,
    hasInnerGlow: false,
  },

  source: {
    type: 'craft',
    craftRecipe: [{ material: 'vibranium', amount: 3 }],
    goldCost: 400,
  },
};

const CRYO_SHELL: ArtifactDefinition = {
  id: 'cryo_shell',
  name: 'Cryo Shell',
  polishName: 'Skorupa Kriogeniczna',
  description: 'Lodowa zbroja emitująca aurę spowolnienia.',
  lore: 'Zbroja z lodowych kryształów, utrzymująca temperaturę absolutnego zera.',

  rarity: 'common',
  slot: 'armor',
  slotType: 'armor',

  requirements: {},

  synergy: {
    synergyClasses: ['ice'],
    bonusMultiplier: 1.15,
    bonusDescription: '+15% efektywności dla klasy Ice',
  },

  effects: [
    { type: 'stat_boost', stat: 'maxHpBonus', value: 17695 as FP, description: '+8% HP' },
    { type: 'stat_boost', stat: 'incomingDamageReduction', value: 17695 as FP, description: '+8% redukcja obrażeń' },
  ],

  visuals: {
    shape: 'shield',
    primaryColor: 0x00bfff,
    secondaryColor: 0xe0ffff,
    glowColor: 0xadd8e6,
    animation: 'pulse',
    particles: 'frost',
    particleIntensity: 0.3,
    hasOuterRing: false,
    hasInnerGlow: false,
  },

  source: {
    type: 'craft',
    craftRecipe: [{ material: 'cosmic_dust', amount: 2 }],
    goldCost: 350,
  },
};

const FLAME_WARD: ArtifactDefinition = {
  id: 'flame_ward',
  name: 'Flame Ward',
  polishName: 'Płomienna Osłona',
  description: 'Ognista zbroja odbijająca część obrażeń.',
  lore: 'Zaklęta w ogniu, odpłaca się atakującym.',

  rarity: 'common',
  slot: 'armor',
  slotType: 'armor',

  requirements: {},

  synergy: {
    synergyClasses: ['fire'],
    bonusMultiplier: 1.15,
    bonusDescription: '+15% efektywności dla klasy Fire',
  },

  effects: [
    { type: 'stat_boost', stat: 'maxHpBonus', value: 17695 as FP, description: '+8% HP' },
    { type: 'stat_boost', stat: 'incomingDamageReduction', value: 17203 as FP, description: '+5% redukcja obrażeń' },
  ],

  visuals: {
    shape: 'shield',
    primaryColor: 0xff4500,
    secondaryColor: 0xff6600,
    glowColor: 0xffaa00,
    animation: 'pulse',
    particles: 'flames',
    particleIntensity: 0.3,
    hasOuterRing: false,
    hasInnerGlow: false,
  },

  source: {
    type: 'craft',
    craftRecipe: [{ material: 'darkforce', amount: 2 }],
    goldCost: 380,
  },
};

const VOID_SHROUD: ArtifactDefinition = {
  id: 'void_shroud',
  name: 'Void Shroud',
  polishName: 'Całun Próżni',
  description: 'Płaszcz z energii próżni, zwiększający uniki.',
  lore: 'Zrobiony z materii międzywymiarowej, częściowo niewidoczny.',

  rarity: 'common',
  slot: 'armor',
  slotType: 'armor',

  requirements: {},

  synergy: {
    synergyClasses: ['void'],
    bonusMultiplier: 1.15,
    bonusDescription: '+15% efektywności dla klasy Void',
  },

  effects: [
    { type: 'stat_boost', stat: 'maxHpBonus', value: 17367 as FP, description: '+6% HP' },
    { type: 'stat_boost', stat: 'dodgeChance', value: 18022 as FP, description: '+10% unik' },
  ],

  visuals: {
    shape: 'shield',
    primaryColor: 0x4b0082,
    secondaryColor: 0x8b008b,
    glowColor: 0x9400d3,
    animation: 'pulse',
    particles: 'void',
    particleIntensity: 0.3,
    hasOuterRing: false,
    hasInnerGlow: false,
  },

  source: {
    type: 'craft',
    craftRecipe: [{ material: 'darkforce', amount: 3 }],
    goldCost: 420,
  },
};

// --- AKCESORIA COMMON ---

const ENERGY_CELL: ArtifactDefinition = {
  id: 'energy_cell',
  name: 'Energy Cell',
  polishName: 'Ogniwo Energetyczne',
  description: 'Kompaktowe źródło energii zwiększające szybkość.',
  lore: 'Miniaturowy reaktor zasilający systemy bojowe.',

  rarity: 'common',
  slot: 'accessory',
  slotType: 'accessory',

  requirements: {},

  synergy: {
    synergyClasses: ['tech', 'lightning'],
    bonusMultiplier: 1.15,
    bonusDescription: '+15% efektywności dla klasy Tech lub Lightning',
  },

  effects: [
    { type: 'stat_boost', stat: 'attackSpeed', value: 18022 as FP, description: '+10% szybkość ataku' },
    { type: 'stat_boost', stat: 'damageMultiplier', value: 17203 as FP, description: '+5% obrażeń' },
  ],

  visuals: {
    shape: 'ring',
    primaryColor: 0x00ffff,
    secondaryColor: 0xffff00,
    glowColor: 0x00ffff,
    animation: 'pulse',
    particles: 'lightning',
    particleIntensity: 0.3,
    hasOuterRing: false,
    hasInnerGlow: false,
  },

  source: {
    type: 'craft',
    craftRecipe: [{ material: 'pym_particles', amount: 2 }],
    goldCost: 350,
  },
};

const FROST_CHARM: ArtifactDefinition = {
  id: 'frost_charm',
  name: 'Frost Charm',
  polishName: 'Amulet Mrozu',
  description: 'Lodowy amulet wzmacniający efekty spowolnienia.',
  lore: 'Kryształowy amulet z wiecznego lodu.',

  rarity: 'common',
  slot: 'accessory',
  slotType: 'accessory',

  requirements: {},

  synergy: {
    synergyClasses: ['ice'],
    bonusMultiplier: 1.15,
    bonusDescription: '+15% efektywności dla klasy Ice',
  },

  effects: [
    { type: 'stat_boost', stat: 'damageMultiplier', value: 17695 as FP, description: '+8% obrażeń' },
    { type: 'stat_boost', stat: 'critChance', value: 17695 as FP, description: '+8% szansa na krytyczne' },
  ],

  visuals: {
    shape: 'ring',
    primaryColor: 0x00bfff,
    secondaryColor: 0xe0ffff,
    glowColor: 0xadd8e6,
    animation: 'pulse',
    particles: 'frost',
    particleIntensity: 0.3,
    hasOuterRing: false,
    hasInnerGlow: false,
  },

  source: {
    type: 'craft',
    craftRecipe: [{ material: 'cosmic_dust', amount: 2 }],
    goldCost: 380,
  },
};

const FLAME_CORE: ArtifactDefinition = {
  id: 'flame_core',
  name: 'Flame Core',
  polishName: 'Rdzeń Płomieni',
  description: 'Ognisty rdzeń wzmacniający obrażenia od ognia.',
  lore: 'Serce wulkanu, wiecznie płonące.',

  rarity: 'common',
  slot: 'accessory',
  slotType: 'accessory',

  requirements: {},

  synergy: {
    synergyClasses: ['fire'],
    bonusMultiplier: 1.15,
    bonusDescription: '+15% efektywności dla klasy Fire',
  },

  effects: [
    { type: 'stat_boost', stat: 'damageMultiplier', value: 18022 as FP, description: '+10% obrażeń' },
    { type: 'stat_boost', stat: 'critDamageBonus', value: 17695 as FP, description: '+8% obrażeń krytycznych' },
  ],

  visuals: {
    shape: 'ring',
    primaryColor: 0xff4500,
    secondaryColor: 0xff6600,
    glowColor: 0xffaa00,
    animation: 'pulse',
    particles: 'flames',
    particleIntensity: 0.3,
    hasOuterRing: false,
    hasInnerGlow: false,
  },

  source: {
    type: 'craft',
    craftRecipe: [{ material: 'darkforce', amount: 2 }],
    goldCost: 360,
  },
};

const LIFE_PENDANT: ArtifactDefinition = {
  id: 'life_pendant',
  name: 'Life Pendant',
  polishName: 'Wisiorek Życia',
  description: 'Wisiorek regenerujący siły życiowe.',
  lore: 'Starożytny artefakt pulsujący energią życia.',

  rarity: 'common',
  slot: 'accessory',
  slotType: 'accessory',

  requirements: {},

  synergy: {
    synergyClasses: ['natural'],
    bonusMultiplier: 1.15,
    bonusDescription: '+15% efektywności dla klasy Natural',
  },

  effects: [
    { type: 'stat_boost', stat: 'hpRegen', value: 81920 as FP, description: '+5 HP/s regeneracji' },
    { type: 'stat_boost', stat: 'maxHpBonus', value: 18022 as FP, description: '+10% HP' },
  ],

  visuals: {
    shape: 'ring',
    primaryColor: 0x228b22,
    secondaryColor: 0x32cd32,
    glowColor: 0x44ff44,
    animation: 'pulse',
    particles: 'sparkles',
    particleIntensity: 0.3,
    hasOuterRing: false,
    hasInnerGlow: false,
  },

  source: {
    type: 'craft',
    craftRecipe: [{ material: 'mutant_dna', amount: 3 }],
    goldCost: 400,
  },
};

// ============================================================================
// NOWE ARTEFAKTY - RARE
// ============================================================================

// --- BRONIE RARE ---

const VOID_REAVER: ArtifactDefinition = {
  id: 'void_reaver',
  name: 'Void Reaver',
  polishName: 'Żniwiarz Próżni',
  description: 'Broń nasycona energią próżni, szczególnie skuteczna przeciw elitom.',
  lore: 'Wykuty w sercu wyrwy międzywymiarowej.',

  rarity: 'rare',
  slot: 'weapon',
  slotType: 'weapon',

  requirements: {},

  synergy: {
    synergyClasses: ['void'],
    bonusMultiplier: 1.15,
    bonusDescription: '+15% efektywności dla klasy Void',
  },

  effects: [
    { type: 'stat_boost', stat: 'damageMultiplier', value: 19333 as FP, description: '+18% obrażeń' },
    { type: 'stat_boost', stat: 'eliteDamageBonus', value: 18022 as FP, description: '+10% vs elity' },
  ],

  visuals: {
    shape: 'blade',
    primaryColor: 0x4b0082,
    secondaryColor: 0x8b008b,
    glowColor: 0x9400d3,
    animation: 'pulse',
    particles: 'void',
    particleIntensity: 0.5,
    hasOuterRing: false,
    hasInnerGlow: false,
  },

  source: {
    type: 'craft',
    craftRecipe: [
      { material: 'darkforce', amount: 3 },
      { material: 'cosmic_dust', amount: 2 },
    ],
    goldCost: 1000,
  },
};

const BIO_LANCE: ArtifactDefinition = {
  id: 'bio_lance',
  name: 'Bio Lance',
  polishName: 'Bio-Lanca',
  description: 'Organiczna lanca z właściwościami regeneracyjnymi.',
  lore: 'Stworzona z tkanki mutantów, żyje i rośnie.',

  rarity: 'rare',
  slot: 'weapon',
  slotType: 'weapon',

  requirements: {},

  synergy: {
    synergyClasses: ['natural'],
    bonusMultiplier: 1.15,
    bonusDescription: '+15% efektywności dla klasy Natural',
  },

  effects: [
    { type: 'stat_boost', stat: 'damageMultiplier', value: 18842 as FP, description: '+15% obrażeń' },
    { type: 'passive', description: '8% kradzieży życia' },
  ],

  visuals: {
    shape: 'blade',
    primaryColor: 0x228b22,
    secondaryColor: 0x32cd32,
    glowColor: 0x44ff44,
    animation: 'pulse',
    particles: 'sparkles',
    particleIntensity: 0.4,
    hasOuterRing: false,
    hasInnerGlow: false,
  },

  source: {
    type: 'craft',
    craftRecipe: [
      { material: 'mutant_dna', amount: 4 },
      { material: 'super_soldier_serum', amount: 2 },
    ],
    goldCost: 1200,
  },
};

const PLASMA_CUTTER: ArtifactDefinition = {
  id: 'plasma_cutter',
  name: 'Plasma Cutter',
  polishName: 'Przecinacz Plazmowy',
  description: 'Narzędzie przemysłowe przerobione na broń, przebija cele.',
  lore: 'Używane pierwotnie do cięcia statków, teraz do cięcia wrogów.',

  rarity: 'rare',
  slot: 'weapon',
  slotType: 'weapon',

  requirements: {},

  synergy: {
    synergyClasses: ['plasma', 'tech'],
    bonusMultiplier: 1.15,
    bonusDescription: '+15% efektywności dla klasy Plasma lub Tech',
  },

  effects: [
    { type: 'stat_boost', stat: 'damageMultiplier', value: 19661 as FP, description: '+20% obrażeń' },
    { type: 'stat_boost', stat: 'pierceCount', value: 32768 as FP, description: 'Przebija 2 cele' },
  ],

  visuals: {
    shape: 'blade',
    primaryColor: 0x00ffff,
    secondaryColor: 0xff00ff,
    glowColor: 0xffffff,
    animation: 'pulse',
    particles: 'plasma',
    particleIntensity: 0.5,
    hasOuterRing: false,
    hasInnerGlow: false,
  },

  source: {
    type: 'craft',
    craftRecipe: [
      { material: 'pym_particles', amount: 3 },
      { material: 'extremis', amount: 3 },
    ],
    goldCost: 1100,
  },
};

const FROST_HAMMER: ArtifactDefinition = {
  id: 'frost_hammer',
  name: 'Frost Hammer',
  polishName: 'Młot Mrozu',
  description: 'Ciężki młot zamrażający cele przy trafieniu.',
  lore: 'Wykuty z wiecznego lodu, nigdy się nie topi.',

  rarity: 'rare',
  slot: 'weapon',
  slotType: 'weapon',

  requirements: {},

  synergy: {
    synergyClasses: ['ice', 'natural'],
    bonusMultiplier: 1.15,
    bonusDescription: '+15% efektywności dla klasy Ice lub Natural',
  },

  effects: [
    { type: 'stat_boost', stat: 'damageMultiplier', value: 18842 as FP, description: '+15% obrażeń' },
    { type: 'passive', description: '25% szansa na zamrożenie' },
  ],

  visuals: {
    shape: 'blade',
    primaryColor: 0x00bfff,
    secondaryColor: 0xe0ffff,
    glowColor: 0xadd8e6,
    animation: 'pulse',
    particles: 'frost',
    particleIntensity: 0.5,
    hasOuterRing: false,
    hasInnerGlow: false,
  },

  source: {
    type: 'craft',
    craftRecipe: [
      { material: 'vibranium', amount: 4 },
      { material: 'cosmic_dust', amount: 2 },
    ],
    goldCost: 1500,
  },
};

// --- ZBROJE RARE ---

const STORM_AEGIS: ArtifactDefinition = {
  id: 'storm_aegis',
  name: 'Storm Aegis',
  polishName: 'Tarcza Burzowa',
  description: 'Tarcza generująca pole elektryczne odporne na łańcuchy.',
  lore: 'Stworzona do ochrony przed atakami elektrycznymi.',

  rarity: 'rare',
  slot: 'armor',
  slotType: 'armor',

  requirements: {},

  synergy: {
    synergyClasses: ['lightning'],
    bonusMultiplier: 1.15,
    bonusDescription: '+15% efektywności dla klasy Lightning',
  },

  effects: [
    { type: 'stat_boost', stat: 'maxHpBonus', value: 18842 as FP, description: '+15% HP' },
    { type: 'stat_boost', stat: 'incomingDamageReduction', value: 18842 as FP, description: '+15% redukcja obrażeń' },
  ],

  visuals: {
    shape: 'shield',
    primaryColor: 0x9932cc,
    secondaryColor: 0xda70d6,
    glowColor: 0xffff00,
    animation: 'pulse',
    particles: 'lightning',
    particleIntensity: 0.4,
    hasOuterRing: false,
    hasInnerGlow: false,
  },

  source: {
    type: 'craft',
    craftRecipe: [
      { material: 'uru', amount: 4 },
      { material: 'vibranium', amount: 2 },
    ],
    goldCost: 1100,
  },
};

const BIO_ARMOR: ArtifactDefinition = {
  id: 'bio_armor',
  name: 'Bio Armor',
  polishName: 'Bio-Zbroja',
  description: 'Żywa zbroja z regenerującymi się tkankami.',
  lore: 'Symbiotyczna zbroja, która rośnie razem z właścicielem.',

  rarity: 'rare',
  slot: 'armor',
  slotType: 'armor',

  requirements: {},

  synergy: {
    synergyClasses: ['natural', 'void'],
    bonusMultiplier: 1.15,
    bonusDescription: '+15% efektywności dla klasy Natural lub Void',
  },

  effects: [
    { type: 'stat_boost', stat: 'maxHpBonus', value: 19661 as FP, description: '+20% HP' },
    { type: 'stat_boost', stat: 'hpRegen', value: 49152 as FP, description: '+3 HP/s regeneracji' },
  ],

  visuals: {
    shape: 'shield',
    primaryColor: 0x228b22,
    secondaryColor: 0x4b0082,
    glowColor: 0x44ff44,
    animation: 'pulse',
    particles: 'sparkles',
    particleIntensity: 0.4,
    hasOuterRing: false,
    hasInnerGlow: false,
  },

  source: {
    type: 'craft',
    craftRecipe: [
      { material: 'mutant_dna', amount: 5 },
      { material: 'super_soldier_serum', amount: 3 },
    ],
    goldCost: 1400,
  },
};

const QUANTUM_BARRIER: ArtifactDefinition = {
  id: 'quantum_barrier',
  name: 'Quantum Barrier',
  polishName: 'Bariera Kwantowa',
  description: 'Pole siłowe odporne na efekty kontroli tłumu.',
  lore: 'Technologia kwantowa tworząca niestabilną, ale skuteczną barierę.',

  rarity: 'rare',
  slot: 'armor',
  slotType: 'armor',

  requirements: {},

  synergy: {
    synergyClasses: ['tech', 'plasma'],
    bonusMultiplier: 1.15,
    bonusDescription: '+15% efektywności dla klasy Tech lub Plasma',
  },

  effects: [
    { type: 'stat_boost', stat: 'maxHpBonus', value: 18350 as FP, description: '+12% HP' },
    { type: 'stat_boost', stat: 'ccResistance', value: 19661 as FP, description: '+20% odporność na CC' },
  ],

  visuals: {
    shape: 'shield',
    primaryColor: 0x00ffff,
    secondaryColor: 0xff00ff,
    glowColor: 0xffffff,
    animation: 'pulse',
    particles: 'plasma',
    particleIntensity: 0.4,
    hasOuterRing: false,
    hasInnerGlow: false,
  },

  source: {
    type: 'craft',
    craftRecipe: [
      { material: 'pym_particles', amount: 4 },
      { material: 'extremis', amount: 3 },
    ],
    goldCost: 1300,
  },
};

const ICE_FORTRESS: ArtifactDefinition = {
  id: 'ice_fortress',
  name: 'Ice Fortress',
  polishName: 'Lodowa Twierdza',
  description: 'Masywna lodowa zbroja zapewniająca ogromną wytrzymałość.',
  lore: 'Zbroja z lodu tak twardego jak stal, ale spowalniająca ruch.',

  rarity: 'rare',
  slot: 'armor',
  slotType: 'armor',

  requirements: {},

  synergy: {
    synergyClasses: ['ice', 'natural'],
    bonusMultiplier: 1.15,
    bonusDescription: '+15% efektywności dla klasy Ice lub Natural',
  },

  effects: [
    { type: 'stat_boost', stat: 'maxHpBonus', value: 20480 as FP, description: '+25% HP' },
    { type: 'stat_boost', stat: 'knockbackResistance', value: 19661 as FP, description: '+20% odporność na knockback' },
  ],

  visuals: {
    shape: 'shield',
    primaryColor: 0x00bfff,
    secondaryColor: 0xe0ffff,
    glowColor: 0xffffff,
    animation: 'pulse',
    particles: 'frost',
    particleIntensity: 0.5,
    hasOuterRing: false,
    hasInnerGlow: false,
  },

  source: {
    type: 'craft',
    craftRecipe: [
      { material: 'vibranium', amount: 5 },
      { material: 'cosmic_dust', amount: 3 },
    ],
    goldCost: 1600,
  },
};

// --- AKCESORIA RARE ---

const VOID_LENS: ArtifactDefinition = {
  id: 'void_lens',
  name: 'Void Lens',
  polishName: 'Soczewka Próżni',
  description: 'Soczewka pozwalająca widzieć i atakować przez wymiary.',
  lore: 'Artefakt z innego wymiaru, otwierający nowe możliwości.',

  rarity: 'rare',
  slot: 'accessory',
  slotType: 'accessory',

  requirements: {},

  synergy: {
    synergyClasses: ['void', 'plasma'],
    bonusMultiplier: 1.15,
    bonusDescription: '+15% efektywności dla klasy Void lub Plasma',
  },

  effects: [
    { type: 'stat_boost', stat: 'damageMultiplier', value: 18842 as FP, description: '+15% zasięg' },
    { type: 'stat_boost', stat: 'eliteDamageBonus', value: 18022 as FP, description: '+10% vs elity' },
  ],

  visuals: {
    shape: 'ring',
    primaryColor: 0x4b0082,
    secondaryColor: 0xff00ff,
    glowColor: 0x9400d3,
    animation: 'pulse',
    particles: 'void',
    particleIntensity: 0.4,
    hasOuterRing: false,
    hasInnerGlow: false,
  },

  source: {
    type: 'craft',
    craftRecipe: [
      { material: 'darkforce', amount: 4 },
      { material: 'cosmic_dust', amount: 2 },
    ],
    goldCost: 1000,
  },
};

const CHRONO_MODULE: ArtifactDefinition = {
  id: 'chrono_module',
  name: 'Chrono Module',
  polishName: 'Moduł Chronologiczny',
  description: 'Urządzenie manipulujące czasem, redukujące cooldowny.',
  lore: 'Technologia czasowa zamknięta w kompaktowym urządzeniu.',

  rarity: 'rare',
  slot: 'accessory',
  slotType: 'accessory',

  requirements: {},

  synergy: {
    synergyClasses: ['tech', 'ice'],
    bonusMultiplier: 1.15,
    bonusDescription: '+15% efektywności dla klasy Tech lub Ice',
  },

  effects: [
    { type: 'stat_boost', stat: 'cooldownReduction', value: 19661 as FP, description: '-20% cooldown' },
    { type: 'stat_boost', stat: 'attackSpeed', value: 18022 as FP, description: '+10% szybkość ataku' },
  ],

  visuals: {
    shape: 'ring',
    primaryColor: 0x00ff00,
    secondaryColor: 0x00ffff,
    glowColor: 0x98fb98,
    animation: 'rotate',
    particles: 'sparkles',
    particleIntensity: 0.4,
    hasOuterRing: false,
    hasInnerGlow: false,
  },

  source: {
    type: 'craft',
    craftRecipe: [
      { material: 'pym_particles', amount: 4 },
      { material: 'extremis', amount: 3 },
    ],
    goldCost: 1200,
  },
};

const LIGHTNING_COIL: ArtifactDefinition = {
  id: 'lightning_coil',
  name: 'Lightning Coil',
  polishName: 'Cewka Błyskawic',
  description: 'Cewka wzmacniająca ataki łańcuchowe.',
  lore: 'Generuje potężne pole elektromagnetyczne.',

  rarity: 'rare',
  slot: 'accessory',
  slotType: 'accessory',

  requirements: {},

  synergy: {
    synergyClasses: ['lightning'],
    bonusMultiplier: 1.15,
    bonusDescription: '+15% efektywności dla klasy Lightning',
  },

  effects: [
    { type: 'stat_boost', stat: 'chainDamagePercent', value: 21299 as FP, description: '+30% obrażeń łańcuchowych' },
    { type: 'stat_boost', stat: 'chainCount', value: 32768 as FP, description: '+2 cele łańcuchowe' },
  ],

  visuals: {
    shape: 'ring',
    primaryColor: 0x9932cc,
    secondaryColor: 0xffff00,
    glowColor: 0xffffff,
    animation: 'pulse',
    particles: 'lightning',
    particleIntensity: 0.5,
    hasOuterRing: false,
    hasInnerGlow: false,
  },

  source: {
    type: 'craft',
    craftRecipe: [
      { material: 'uru', amount: 5 },
      { material: 'extremis', amount: 2 },
    ],
    goldCost: 1400,
  },
};

const BERSERKER_SIGIL: ArtifactDefinition = {
  id: 'berserker_sigil',
  name: 'Berserker Sigil',
  polishName: 'Sigil Berserkera',
  description: 'Starożytny symbol wzmacniający w desperacji.',
  lore: 'Aktywuje się gdy właściciel jest bliski śmierci.',

  rarity: 'rare',
  slot: 'accessory',
  slotType: 'accessory',

  requirements: {},

  synergy: {
    synergyClasses: ['natural', 'fire'],
    bonusMultiplier: 1.15,
    bonusDescription: '+15% efektywności dla klasy Natural lub Fire',
  },

  effects: [
    { type: 'stat_boost', stat: 'lowHpDamageBonus', value: 20480 as FP, description: '+25% DMG przy niskim HP' },
    { type: 'stat_boost', stat: 'critDamageBonus', value: 18842 as FP, description: '+15% obrażeń krytycznych' },
  ],

  visuals: {
    shape: 'ring',
    primaryColor: 0x8b0000,
    secondaryColor: 0xff4500,
    glowColor: 0xff0000,
    animation: 'pulse',
    particles: 'flames',
    particleIntensity: 0.5,
    hasOuterRing: false,
    hasInnerGlow: false,
  },

  source: {
    type: 'craft',
    craftRecipe: [
      { material: 'super_soldier_serum', amount: 4 },
      { material: 'darkforce', amount: 4 },
    ],
    goldCost: 1500,
  },
};

// ============================================================================
// NOWE ARTEFAKTY - EPIC
// ============================================================================

// --- BRONIE EPIC ---

const ION_CANNON: ArtifactDefinition = {
  id: 'ion_cannon',
  name: 'Ion Cannon',
  polishName: 'Działo Jonowe',
  description: 'Potężne działo strzelające łańcuchowymi wyładowaniami.',
  lore: 'Broń klasy kapitańskiej, zdolna zniszczyć całe eskadry.',

  rarity: 'epic',
  slot: 'weapon',
  slotType: 'weapon',

  requirements: {},

  synergy: {
    synergyClasses: ['lightning', 'tech'],
    bonusMultiplier: 1.15,
    bonusDescription: '+15% efektywności dla klasy Lightning lub Tech',
  },

  effects: [
    { type: 'stat_boost', stat: 'damageMultiplier', value: 20480 as FP, description: '+25% obrażeń' },
    { type: 'stat_boost', stat: 'chainCount', value: 49152 as FP, description: 'Łańcuch do 3 celów' },
  ],

  visuals: {
    shape: 'blade',
    primaryColor: 0x9932cc,
    secondaryColor: 0x00ffff,
    glowColor: 0xffffff,
    animation: 'shimmer',
    particles: 'lightning',
    particleIntensity: 0.6,
    hasOuterRing: false,
    hasInnerGlow: true,
  },

  source: {
    type: 'craft',
    craftRecipe: [
      { material: 'uru', amount: 4 },
      { material: 'extremis', amount: 3 },
    ],
    goldCost: 2500,
  },
};

const INFERNO_BLADE: ArtifactDefinition = {
  id: 'inferno_blade',
  name: 'Inferno Blade',
  polishName: 'Ostrze Inferno',
  description: 'Miecz z czystego ognia, zadający niszczycielskie podpalenia.',
  lore: 'Wykuty w sercu supernowej, płonie wiecznie.',

  rarity: 'epic',
  slot: 'weapon',
  slotType: 'weapon',

  requirements: {},

  synergy: {
    synergyClasses: ['fire', 'plasma'],
    bonusMultiplier: 1.15,
    bonusDescription: '+15% efektywności dla klasy Fire lub Plasma',
  },

  effects: [
    { type: 'stat_boost', stat: 'damageMultiplier', value: 20971 as FP, description: '+28% obrażeń' },
    { type: 'passive', description: 'Podpalenie: 8 DMG/s przez 4s' },
  ],

  visuals: {
    shape: 'blade',
    primaryColor: 0xff4500,
    secondaryColor: 0xffff00,
    glowColor: 0xffffff,
    animation: 'shimmer',
    particles: 'flames',
    particleIntensity: 0.7,
    hasOuterRing: false,
    hasInnerGlow: true,
  },

  source: {
    type: 'craft',
    craftRecipe: [
      { material: 'darkforce', amount: 5 },
      { material: 'cosmic_dust', amount: 3 },
    ],
    goldCost: 2800,
  },
};

const QUANTUM_EDGE: ArtifactDefinition = {
  id: 'quantum_edge',
  name: 'Quantum Edge',
  polishName: 'Ostrze Kwantowe',
  description: 'Ostrze istniejące w wielu stanach jednocześnie, ignorujące zbroję.',
  lore: 'Broń z innego wymiaru, gdzie fizyka działa inaczej.',

  rarity: 'epic',
  slot: 'weapon',
  slotType: 'weapon',

  requirements: {},

  synergy: {
    synergyClasses: ['tech', 'void'],
    bonusMultiplier: 1.15,
    bonusDescription: '+15% efektywności dla klasy Tech lub Void',
  },

  effects: [
    { type: 'stat_boost', stat: 'damageMultiplier', value: 21299 as FP, description: '+30% obrażeń' },
    { type: 'stat_boost', stat: 'critChance', value: 18842 as FP, description: '+15% szansa na krytyczne' },
  ],

  visuals: {
    shape: 'blade',
    primaryColor: 0x00ffff,
    secondaryColor: 0x4b0082,
    glowColor: 0xffffff,
    animation: 'shimmer',
    particles: 'plasma',
    particleIntensity: 0.6,
    hasOuterRing: false,
    hasInnerGlow: true,
  },

  source: {
    type: 'craft',
    craftRecipe: [
      { material: 'pym_particles', amount: 4 },
      { material: 'extremis', amount: 4 },
    ],
    goldCost: 3000,
  },
};

// --- ZBROJE EPIC ---

const PLASMA_SHIELD: ArtifactDefinition = {
  id: 'plasma_shield',
  name: 'Plasma Shield',
  polishName: 'Tarcza Plazmowa',
  description: 'Tarcza z czystej plazmy, odbijająca ataki.',
  lore: 'Technologia generująca pole plazmowe jako tarczę.',

  rarity: 'epic',
  slot: 'armor',
  slotType: 'armor',

  requirements: {},

  synergy: {
    synergyClasses: ['plasma', 'fire'],
    bonusMultiplier: 1.15,
    bonusDescription: '+15% efektywności dla klasy Plasma lub Fire',
  },

  effects: [
    { type: 'stat_boost', stat: 'maxHpBonus', value: 19333 as FP, description: '+18% HP' },
    { type: 'stat_boost', stat: 'incomingDamageReduction', value: 18022 as FP, description: '+10% redukcja obrażeń' },
    { type: 'stat_boost', stat: 'dodgeChance', value: 18022 as FP, description: '+10% unik' },
  ],

  visuals: {
    shape: 'shield',
    primaryColor: 0x00ffff,
    secondaryColor: 0xff00ff,
    glowColor: 0xffffff,
    animation: 'shimmer',
    particles: 'plasma',
    particleIntensity: 0.6,
    hasOuterRing: false,
    hasInnerGlow: true,
  },

  source: {
    type: 'craft',
    craftRecipe: [
      { material: 'extremis', amount: 5 },
      { material: 'darkforce', amount: 4 },
    ],
    goldCost: 2600,
  },
};

const NANO_SUIT: ArtifactDefinition = {
  id: 'nano_suit',
  name: 'Nano Suit',
  polishName: 'Nano-Zbroja',
  description: 'Zbroja z nanitów, samonaprawiająca się i redukująca cooldowny.',
  lore: 'Miliardy nanitów tworzących żywą zbroję.',

  rarity: 'epic',
  slot: 'armor',
  slotType: 'armor',

  requirements: {},

  synergy: {
    synergyClasses: ['tech'],
    bonusMultiplier: 1.15,
    bonusDescription: '+15% efektywności dla klasy Tech',
  },

  effects: [
    { type: 'stat_boost', stat: 'maxHpBonus', value: 19989 as FP, description: '+22% HP' },
    { type: 'stat_boost', stat: 'hpRegen', value: 163840 as FP, description: '+10 HP/s regeneracji' },
    { type: 'stat_boost', stat: 'cooldownReduction', value: 20480 as FP, description: '-25% cooldown' },
  ],

  visuals: {
    shape: 'shield',
    primaryColor: 0x00f0ff,
    secondaryColor: 0xff00aa,
    glowColor: 0xffffff,
    animation: 'shimmer',
    particles: 'plasma',
    particleIntensity: 0.6,
    hasOuterRing: false,
    hasInnerGlow: true,
  },

  source: {
    type: 'craft',
    craftRecipe: [
      { material: 'extremis', amount: 6 },
      { material: 'pym_particles', amount: 4 },
    ],
    goldCost: 3200,
  },
};

const DIMENSIONAL_MAIL: ArtifactDefinition = {
  id: 'dimensional_mail',
  name: 'Dimensional Mail',
  polishName: 'Zbroja Wymiarowa',
  description: 'Zbroja istniejąca częściowo w innym wymiarze.',
  lore: 'Ataki czasami trafiają w pustkę między wymiarami.',

  rarity: 'epic',
  slot: 'armor',
  slotType: 'armor',

  requirements: {},

  synergy: {
    synergyClasses: ['void', 'lightning'],
    bonusMultiplier: 1.15,
    bonusDescription: '+15% efektywności dla klasy Void lub Lightning',
  },

  effects: [
    { type: 'stat_boost', stat: 'maxHpBonus', value: 19661 as FP, description: '+20% HP' },
    { type: 'stat_boost', stat: 'dodgeChance', value: 20480 as FP, description: '+25% szansa na unik' },
  ],

  visuals: {
    shape: 'shield',
    primaryColor: 0x4b0082,
    secondaryColor: 0x9932cc,
    glowColor: 0xffffff,
    animation: 'shimmer',
    particles: 'void',
    particleIntensity: 0.6,
    hasOuterRing: false,
    hasInnerGlow: true,
  },

  source: {
    type: 'craft',
    craftRecipe: [
      { material: 'darkforce', amount: 5 },
      { material: 'uru', amount: 5 },
    ],
    goldCost: 3500,
  },
};

// --- AKCESORIA EPIC ---

const PLASMA_AMPLIFIER: ArtifactDefinition = {
  id: 'plasma_amplifier',
  name: 'Plasma Amplifier',
  polishName: 'Wzmacniacz Plazmowy',
  description: 'Urządzenie wzmacniające wszystkie aspekty bojowe.',
  lore: 'Zaawansowana technologia wzmacniająca każdy atak.',

  rarity: 'epic',
  slot: 'accessory',
  slotType: 'accessory',

  requirements: {},

  synergy: {
    synergyClasses: ['plasma', 'lightning'],
    bonusMultiplier: 1.15,
    bonusDescription: '+15% efektywności dla klasy Plasma lub Lightning',
  },

  effects: [
    { type: 'stat_boost', stat: 'damageMultiplier', value: 19661 as FP, description: '+20% obrażeń' },
    { type: 'stat_boost', stat: 'attackSpeed', value: 19661 as FP, description: '+20% szybkość ataku' },
    { type: 'stat_boost', stat: 'critChance', value: 18842 as FP, description: '+15% szansa na krytyczne' },
  ],

  visuals: {
    shape: 'ring',
    primaryColor: 0x00ffff,
    secondaryColor: 0x9932cc,
    glowColor: 0xffffff,
    animation: 'shimmer',
    particles: 'plasma',
    particleIntensity: 0.6,
    hasOuterRing: false,
    hasInnerGlow: true,
  },

  source: {
    type: 'craft',
    craftRecipe: [
      { material: 'extremis', amount: 5 },
      { material: 'uru', amount: 5 },
    ],
    goldCost: 2800,
  },
};

const VOID_HEART: ArtifactDefinition = {
  id: 'void_heart',
  name: 'Void Heart',
  polishName: 'Serce Próżni',
  description: 'Rdzeń z czystej energii próżni, druzgocący bossów.',
  lore: 'Serce wyrwy między wymiarami, pulsujące ciemną energią.',

  rarity: 'epic',
  slot: 'accessory',
  slotType: 'accessory',

  requirements: {},

  synergy: {
    synergyClasses: ['void', 'fire'],
    bonusMultiplier: 1.15,
    bonusDescription: '+15% efektywności dla klasy Void lub Fire',
  },

  effects: [
    { type: 'stat_boost', stat: 'eliteDamageBonus', value: 20480 as FP, description: '+25% vs bossy' },
    { type: 'stat_boost', stat: 'damageMultiplier', value: 19661 as FP, description: '+20% obrażeń' },
  ],

  visuals: {
    shape: 'ring',
    primaryColor: 0x4b0082,
    secondaryColor: 0x8b0000,
    glowColor: 0x9400d3,
    animation: 'shimmer',
    particles: 'void',
    particleIntensity: 0.7,
    hasOuterRing: false,
    hasInnerGlow: true,
  },

  source: {
    type: 'craft',
    craftRecipe: [
      { material: 'darkforce', amount: 6 },
      { material: 'cosmic_dust', amount: 4 },
    ],
    goldCost: 3200,
  },
};

const TACTICAL_PROCESSOR: ArtifactDefinition = {
  id: 'tactical_processor',
  name: 'Tactical Processor',
  polishName: 'Procesor Taktyczny',
  description: 'Zaawansowany procesor AI wspomagający walkę i zbieranie zasobów.',
  lore: 'Sztuczna inteligencja optymalizująca każdy aspekt misji.',

  rarity: 'epic',
  slot: 'accessory',
  slotType: 'accessory',

  requirements: {},

  synergy: {
    synergyClasses: ['tech'],
    bonusMultiplier: 1.15,
    bonusDescription: '+15% efektywności dla klasy Tech',
  },

  effects: [
    { type: 'stat_boost', stat: 'cooldownReduction', value: 21299 as FP, description: '-30% cooldown' },
    { type: 'stat_boost', stat: 'goldBonus', value: 18842 as FP, description: '+15% złota' },
    { type: 'stat_boost', stat: 'dropRateBonus', value: 18022 as FP, description: '+10% XP' },
  ],

  visuals: {
    shape: 'gear',
    primaryColor: 0x00f0ff,
    secondaryColor: 0x00ff00,
    glowColor: 0xffffff,
    animation: 'rotate',
    particles: 'sparkles',
    particleIntensity: 0.5,
    hasOuterRing: false,
    hasInnerGlow: true,
  },

  source: {
    type: 'craft',
    craftRecipe: [
      { material: 'pym_particles', amount: 6 },
      { material: 'extremis', amount: 4 },
    ],
    goldCost: 3000,
  },
};

// ============================================================================
// PRZEDMIOTY ZWYKŁE
// ============================================================================

const HEALTH_POTION: ItemDefinition = {
  id: 'health_potion',
  name: 'Health Potion',
  polishName: 'Mikstura Zdrowia',
  description: 'Natychmiastowo przywraca 50 HP.',

  itemType: 'consumable',
  stackable: true,
  maxStack: 10,

  effects: [
    {
      type: 'instant',
      stat: 'hp',
      value: 819200 as FP, // 50 HP
      description: '+50 HP natychmiastowo',
    },
  ],

  cost: { gold: 50 },

  visuals: {
    color: 0xff0000,
    icon: 'potion_red',
  },
};

const DAMAGE_BOOST: ItemDefinition = {
  id: 'damage_boost',
  name: 'Damage Boost',
  polishName: 'Wzmocnienie Obrażeń',
  description: 'Zwiększa obrażenia o 20% na 30 sekund.',

  itemType: 'consumable',
  stackable: true,
  maxStack: 5,

  effects: [
    {
      type: 'duration',
      stat: 'damageMultiplier',
      value: 19661 as FP, // +20%
      duration: 900, // 30 sekund
      description: '+20% DMG przez 30s',
    },
  ],

  cost: { gold: 100 },

  visuals: {
    color: 0xff4500,
    icon: 'buff_damage',
  },
};

const SPEED_ELIXIR: ItemDefinition = {
  id: 'speed_elixir',
  name: 'Speed Elixir',
  polishName: 'Eliksir Szybkości',
  description: 'Zwiększa szybkość ataku o 30% na 30 sekund.',

  itemType: 'consumable',
  stackable: true,
  maxStack: 5,

  effects: [
    {
      type: 'duration',
      stat: 'attackSpeed',
      value: 21299 as FP, // +30%
      duration: 900,
      description: '+30% AS przez 30s',
    },
  ],

  cost: { gold: 100 },

  visuals: {
    color: 0x00ff00,
    icon: 'buff_speed',
  },
};

const SHIELD_CHARM: ItemDefinition = {
  id: 'shield_charm',
  name: 'Shield Charm',
  polishName: 'Amulet Tarczy',
  description: 'Tworzy tarczę absorbującą 100 obrażeń.',

  itemType: 'consumable',
  stackable: true,
  maxStack: 5,

  effects: [
    {
      type: 'instant',
      stat: 'shield',
      value: 1638400 as FP, // 100 shield
      description: '+100 tarcza',
    },
  ],

  cost: { gold: 150 },

  visuals: {
    color: 0x4169e1,
    icon: 'shield_magic',
  },
};

const XP_TOME: ItemDefinition = {
  id: 'xp_tome',
  name: 'XP Tome',
  polishName: 'Księga Doświadczenia',
  description: 'Natychmiastowo daje 100 XP bohaterowi.',

  itemType: 'consumable',
  stackable: true,
  maxStack: 10,

  effects: [
    {
      type: 'instant',
      stat: 'xp',
      value: 1638400 as FP, // 100 XP
      description: '+100 XP',
    },
  ],

  cost: { gold: 200 },

  visuals: {
    color: 0x9932cc,
    icon: 'book_xp',
  },
};

const CRIT_CRYSTAL: ItemDefinition = {
  id: 'crit_crystal',
  name: 'Crit Crystal',
  polishName: 'Kryształ Krytyka',
  description: '+15% szansa na krytyczne trafienie na 60 sekund.',

  itemType: 'consumable',
  stackable: true,
  maxStack: 5,

  effects: [
    {
      type: 'duration',
      stat: 'critChance',
      value: 2458 as FP, // +15%
      duration: 1800, // 60 sekund
      description: '+15% crit przez 60s',
    },
  ],

  cost: { gold: 120 },

  visuals: {
    color: 0xffd700,
    icon: 'crystal',
  },
};

// ============================================================================
// SPECIAL / EVENT ARTIFACTS
// ============================================================================

/**
 * Founders Medal - Limited edition artifact for launch players
 * Cannot be obtained through normal gameplay
 */
const FOUNDERS_MEDAL: ArtifactDefinition = {
  id: 'founders_medal',
  name: "Founder's Medal",
  polishName: 'Medal Założyciela',
  description: 'Ekskluzywny medal dla pierwszych obrońców Fortrecy. Daje bonus do wszystkich statystyk.',
  lore: 'Przyznawany tylko pionierom, którzy dołączyli do obrony w pierwszych dniach. Symbol oddania i honoru.',

  rarity: 'legendary',
  slot: 'accessory',
  slotType: 'accessory',

  requirements: {
    heroTier: 1, // Można używać od razu
  },

  synergy: {
    synergyClasses: ['natural', 'ice', 'fire', 'lightning', 'tech', 'void', 'plasma'],
    bonusMultiplier: 1.1,
    bonusDescription: '+10% efektywności dla wszystkich klas',
  },

  effects: [
    {
      type: 'stat_boost',
      stat: 'damageMultiplier',
      value: 18022 as FP, // 1.1x multiplier (16384 * 1.1 = 18022)
      description: '+10% obrażeń',
    },
    {
      type: 'stat_boost',
      stat: 'maxHpBonus',
      value: 18022 as FP, // +10%
      description: '+10% HP',
    },
    {
      type: 'stat_boost',
      stat: 'attackSpeed',
      value: 17695 as FP, // +8%
      description: '+8% szybkość ataku',
    },
  ],

  visuals: {
    shape: 'star',
    primaryColor: 0xffd700, // Gold
    secondaryColor: 0xc0c0c0, // Silver
    glowColor: 0xfffacd, // Lemon chiffon
    animation: 'pulse',
    particles: 'sparkles',
    particleIntensity: 0.8,
    hasOuterRing: true,
    hasInnerGlow: true,
  },

  legacyVisuals: {
    color: 0xffd700,
    glowColor: 0xfffacd,
    icon: 'medal',
  },

  source: {
    type: 'quest', // Special - not available through normal drops
    location: 'Launch Event',
  },
};

// ============================================================================
// EKSPORT
// ============================================================================

export const ARTIFACT_DEFINITIONS: ArtifactDefinition[] = [
  // ============ SPECIAL / EVENT ============
  FOUNDERS_MEDAL,

  // ============ LEGENDARY (12) ============
  PLASMA_HAMMER,
  STORM_CLEAVER,
  KINETIC_DEFLECTOR,
  QUANTUM_ARMOR,
  GRAPPLE_LAUNCHER,
  GRAVITY_HARNESS,
  TEMPORAL_SCANNER,
  VOID_CODEX,
  GUARDIAN_PROTOCOLS,
  CRYO_MATRIX,
  OBSIDIAN_EDGE,
  CRYSTAL_MATRIX,

  // ============ EPIC (9) ============
  // Weapons
  ION_CANNON,
  INFERNO_BLADE,
  QUANTUM_EDGE,
  // Armors
  PLASMA_SHIELD,
  NANO_SUIT,
  DIMENSIONAL_MAIL,
  // Accessories
  PLASMA_AMPLIFIER,
  VOID_HEART,
  TACTICAL_PROCESSOR,

  // ============ RARE (12) ============
  // Weapons
  VOID_REAVER,
  BIO_LANCE,
  PLASMA_CUTTER,
  FROST_HAMMER,
  // Armors
  STORM_AEGIS,
  BIO_ARMOR,
  QUANTUM_BARRIER,
  ICE_FORTRESS,
  // Accessories
  VOID_LENS,
  CHRONO_MODULE,
  LIGHTNING_COIL,
  BERSERKER_SIGIL,

  // ============ COMMON (12) ============
  // Weapons
  PULSE_RIFLE,
  CRYO_BLADE,
  THUNDER_LANCE,
  FLAME_EDGE,
  // Armors
  REACTIVE_PLATING,
  CRYO_SHELL,
  FLAME_WARD,
  VOID_SHROUD,
  // Accessories
  ENERGY_CELL,
  FROST_CHARM,
  FLAME_CORE,
  LIFE_PENDANT,
];

export const ITEM_DEFINITIONS: ItemDefinition[] = [
  HEALTH_POTION,
  DAMAGE_BOOST,
  SPEED_ELIXIR,
  SHIELD_CHARM,
  XP_TOME,
  CRIT_CRYSTAL,
];

// ============================================================================
// FUNKCJE POMOCNICZE
// ============================================================================

/**
 * Pobiera artefakt po ID
 */
export function getArtifactById(id: string): ArtifactDefinition | undefined {
  return ARTIFACT_DEFINITIONS.find(a => a.id === id);
}

/**
 * Pobiera przedmiot po ID
 */
export function getItemById(id: string): ItemDefinition | undefined {
  return ITEM_DEFINITIONS.find(i => i.id === id);
}

/**
 * Pobiera artefakty według slotu (legacy)
 * @deprecated Use getArtifactsBySlotType instead
 */
export function getArtifactsBySlot(slot: ArtifactSlot): ArtifactDefinition[] {
  return ARTIFACT_DEFINITIONS.filter(a => a.slot === slot);
}

/**
 * Pobiera artefakty według nowego typu slotu (weapon/armor/accessory)
 */
export function getArtifactsBySlotType(slotType: ArtifactSlotType): ArtifactDefinition[] {
  return ARTIFACT_DEFINITIONS.filter(a => a.slotType === slotType);
}

/**
 * Pobiera artefakty według rzadkości
 */
export function getArtifactsByRarity(rarity: ArtifactRarity): ArtifactDefinition[] {
  return ARTIFACT_DEFINITIONS.filter(a => a.rarity === rarity);
}

/**
 * Sprawdza czy bohater może użyć artefaktu
 * W nowym systemie każdy bohater może używać każdego artefaktu,
 * jedynym ograniczeniem jest minimalny tier.
 */
export function canHeroEquipArtifact(
  artifactId: string,
  _heroId: string, // unused in new system
  _heroClass: FortressClass, // unused - synergy gives bonus, not restriction
  heroTier: number
): boolean {
  const artifact = getArtifactById(artifactId);
  if (!artifact) return false;

  const req = artifact.requirements;

  // W nowym systemie tylko tier jest wymagany
  // heroId i heroClass są ignorowane (synergy zamiast restrykcji)
  if (req.heroTier && heroTier < req.heroTier) return false;

  return true;
}

/**
 * Sprawdza czy bohater ma bonus synergii z artefaktem
 */
export function hasSynergyBonus(artifactId: string, heroClass: FortressClass): boolean {
  const artifact = getArtifactById(artifactId);
  if (!artifact) return false;

  return artifact.synergy.synergyClasses.includes(heroClass);
}

/**
 * Oblicza mnożnik synergii dla bohatera i artefaktu
 * @returns 1.0 jeśli brak synergii, lub synergy.bonusMultiplier jeśli jest
 */
export function calculateSynergyMultiplier(artifactId: string, heroClass: FortressClass): number {
  const artifact = getArtifactById(artifactId);
  if (!artifact) return 1.0;

  if (artifact.synergy.synergyClasses.includes(heroClass)) {
    return artifact.synergy.bonusMultiplier;
  }

  return 1.0;
}

/**
 * Oblicza całkowity mnożnik synergii dla zestawu artefaktów bohatera
 * @param artifactIds - tablica ID artefaktów (max 3)
 * @param heroClass - klasa bohatera
 * @returns Sumaryczny mnożnik (np. 1.45 dla 3 artefaktów z synergią +15%)
 */
export function calculateTotalSynergyMultiplier(
  artifactIds: (string | null)[],
  heroClass: FortressClass
): number {
  let totalBonus = 0;

  for (const id of artifactIds) {
    if (id) {
      const multiplier = calculateSynergyMultiplier(id, heroClass);
      totalBonus += multiplier - 1.0; // Dodajemy tylko bonus (0.15, nie 1.15)
    }
  }

  return 1.0 + totalBonus; // Bazowy 1.0 + suma bonusów
}

/**
 * Pobiera artefakty dostępne dla bohatera
 * W nowym systemie zwraca wszystkie artefakty spełniające wymagania tier
 */
export function getAvailableArtifactsForHero(
  _heroId: string,
  _heroClass: FortressClass,
  heroTier: number
): ArtifactDefinition[] {
  return ARTIFACT_DEFINITIONS.filter(a => {
    const req = a.requirements;
    if (req.heroTier && heroTier < req.heroTier) return false;
    return true;
  });
}

/**
 * Pobiera artefakty dostępne dla konkretnego slotu bohatera
 */
export function getAvailableArtifactsForSlot(
  slotType: ArtifactSlotType,
  heroTier: number
): ArtifactDefinition[] {
  return ARTIFACT_DEFINITIONS.filter(a => {
    if (a.slotType !== slotType) return false;
    const req = a.requirements;
    if (req.heroTier && heroTier < req.heroTier) return false;
    return true;
  });
}

/**
 * Sprawdza czy artefakt można założyć do konkretnego slotu
 */
export function canEquipToSlot(artifactId: string, slotType: ArtifactSlotType): boolean {
  const artifact = getArtifactById(artifactId);
  if (!artifact) return false;
  return artifact.slotType === slotType;
}

/**
 * Pobiera przedmioty konsumowalne
 */
export function getConsumableItems(): ItemDefinition[] {
  return ITEM_DEFINITIONS.filter(i => i.itemType === 'consumable');
}

/**
 * Oblicza koszt artefaktu (crafting)
 */
export function calculateArtifactCraftCost(artifactId: string): {
  materials: { material: MaterialType; amount: number }[];
  gold: number;
} | undefined {
  const artifact = getArtifactById(artifactId);
  if (!artifact || artifact.source.type !== 'craft') return undefined;

  return {
    materials: artifact.source.craftRecipe ?? [],
    gold: artifact.source.goldCost ?? 0,
  };
}

// ============================================================================
// CRAFTING 2.0 - UPGRADE / FUSE / DISMANTLE
// ============================================================================

/**
 * Base gold cost per rarity for upgrades
 */
const UPGRADE_BASE_GOLD: Record<ArtifactRarity, number> = {
  common: 100,
  rare: 250,
  epic: 500,
  legendary: 1000,
};

/**
 * Rarity multiplier for material costs
 */
const RARITY_MATERIAL_MULTIPLIER: Record<ArtifactRarity, number> = {
  common: 1,
  rare: 2,
  epic: 3,
  legendary: 5,
};

/**
 * Oblicza koszt upgrade'u artefaktu z poziomu X do Y
 * Formula: baseGold * 1.2^targetLevel
 *
 * @param artifactId - ID artefaktu
 * @param currentLevel - Obecny poziom (1-19)
 * @param targetLevel - Docelowy poziom (2-20)
 * @returns Koszt upgrade'u lub undefined jeśli artefakt nie istnieje
 */
export function calculateUpgradeCost(
  artifactId: string,
  currentLevel: number,
  targetLevel: number
): {
  gold: number;
  materials: { material: MaterialType; amount: number }[];
} | undefined {
  const artifact = getArtifactById(artifactId);
  if (!artifact) return undefined;

  if (currentLevel < 1 || currentLevel >= 20) return undefined;
  if (targetLevel <= currentLevel || targetLevel > 20) return undefined;

  const baseGold = UPGRADE_BASE_GOLD[artifact.rarity];
  const materialMultiplier = RARITY_MATERIAL_MULTIPLIER[artifact.rarity];

  let totalGold = 0;
  const materialsNeeded: Record<string, number> = {};

  // Calculate cumulative cost for each level
  for (let level = currentLevel + 1; level <= targetLevel; level++) {
    // Gold: base * 1.2^level (exponential scaling)
    const levelGold = Math.floor(baseGold * Math.pow(1.2, level));
    totalGold += levelGold;

    // Materials: every 5 levels requires materials from craft recipe
    if (level % 5 === 0 && artifact.source.craftRecipe) {
      const materialCount = Math.ceil(level / 5); // 1 at lv5, 2 at lv10, etc.
      for (const { material, amount } of artifact.source.craftRecipe) {
        const needed = Math.ceil((amount * materialMultiplier * materialCount) / 3);
        materialsNeeded[material] = (materialsNeeded[material] ?? 0) + needed;
      }
    }
  }

  return {
    gold: totalGold,
    materials: Object.entries(materialsNeeded).map(([material, amount]) => ({
      material: material as MaterialType,
      amount,
    })),
  };
}

/**
 * Oblicza bonus statystyk z poziomu artefaktu
 * Level 1 = +0%, Level 10 = +50%, Level 20 = +100%
 *
 * @param level - Poziom artefaktu (1-20)
 * @returns Mnożnik bonusu (1.0 do 2.0)
 */
export function calculateLevelStatMultiplier(level: number): number {
  if (level < 1) level = 1;
  if (level > 20) level = 20;

  // Linear scaling: 5% per level above 1
  return 1.0 + (level - 1) * 0.05263; // ~100% at level 20
}

/**
 * Oblicza materiały odzyskane z dismantle (50% kosztu craftingu)
 *
 * @param artifactId - ID artefaktu
 * @param level - Poziom artefaktu (wyższy poziom = więcej materiałów)
 * @returns Odzyskane materiały i złoto
 */
export function calculateDismantleReturn(
  artifactId: string,
  level: number = 1
): {
  gold: number;
  materials: { material: MaterialType; amount: number }[];
} | undefined {
  const artifact = getArtifactById(artifactId);
  if (!artifact) return undefined;

  const craftCost = calculateArtifactCraftCost(artifactId);
  if (!craftCost) {
    // Non-craftable artifacts return minimal resources based on rarity
    const rarityGold: Record<ArtifactRarity, number> = {
      common: 50,
      rare: 150,
      epic: 400,
      legendary: 1000,
    };
    return {
      gold: rarityGold[artifact.rarity] * level,
      materials: [],
    };
  }

  // Level bonus: higher level artifacts return more
  const levelBonus = 1.0 + (level - 1) * 0.1; // +10% per level

  return {
    gold: Math.floor((craftCost.gold * 0.5) * levelBonus),
    materials: craftCost.materials.map(({ material, amount }) => ({
      material,
      amount: Math.floor((amount * 0.5) * levelBonus),
    })).filter(m => m.amount > 0),
  };
}

/**
 * Mapowanie rzadkości dla fuzji: 3 niższej → 1 wyższej
 */
const FUSE_RARITY_MAP: Record<ArtifactRarity, ArtifactRarity | null> = {
  common: 'rare',
  rare: 'epic',
  epic: 'legendary',
  legendary: null, // Cannot fuse legendary
};

/**
 * Pobiera możliwe artefakty wyniku fuzji
 *
 * @param inputRarity - Rzadkość artefaktów wejściowych
 * @param slotType - Typ slotu (weapon/armor/accessory)
 * @returns Lista możliwych artefaktów wyniku lub undefined
 */
export function getFusionResults(
  inputRarity: ArtifactRarity,
  slotType?: ArtifactSlotType
): ArtifactDefinition[] | undefined {
  const targetRarity = FUSE_RARITY_MAP[inputRarity];
  if (!targetRarity) return undefined; // Cannot fuse legendary

  let candidates = ARTIFACT_DEFINITIONS.filter(a => a.rarity === targetRarity);

  // Optionally filter by slot type
  if (slotType) {
    candidates = candidates.filter(a => a.slotType === slotType);
  }

  return candidates.length > 0 ? candidates : undefined;
}

/**
 * Sprawdza czy 3 artefakty można fuzjować
 *
 * @param artifactIds - Tablica 3 ID artefaktów
 * @returns Informacje o fuzji lub błąd
 */
export function validateFusion(artifactIds: string[]): {
  valid: boolean;
  rarity?: ArtifactRarity;
  slotType?: ArtifactSlotType;
  error?: string;
} {
  if (artifactIds.length !== 3) {
    return { valid: false, error: 'Fusion requires exactly 3 artifacts' };
  }

  const artifacts = artifactIds.map(id => getArtifactById(id));

  // Check all artifacts exist
  if (artifacts.some(a => !a)) {
    return { valid: false, error: 'One or more artifacts not found' };
  }

  const validArtifacts = artifacts as ArtifactDefinition[];

  // Check all same rarity
  const rarities = new Set(validArtifacts.map(a => a.rarity));
  if (rarities.size !== 1) {
    return { valid: false, error: 'All artifacts must have the same rarity' };
  }

  const rarity = validArtifacts[0].rarity;

  // Check not legendary
  if (rarity === 'legendary') {
    return { valid: false, error: 'Legendary artifacts cannot be fused' };
  }

  // Get dominant slot type (majority wins, or undefined if mixed)
  const slotCounts: Record<string, number> = {};
  for (const a of validArtifacts) {
    slotCounts[a.slotType] = (slotCounts[a.slotType] ?? 0) + 1;
  }

  const dominantSlot = Object.entries(slotCounts)
    .sort((a, b) => b[1] - a[1])[0];

  const slotType = dominantSlot[1] >= 2
    ? dominantSlot[0] as ArtifactSlotType
    : undefined;

  return { valid: true, rarity, slotType };
}

/**
 * Max przedmiotów equipowanych na bohatera
 */
export const MAX_ITEMS_PER_HERO = 3;

/**
 * Max artefaktów na bohatera (3-slot system: weapon, armor, accessory)
 * Każdy bohater może nosić jeden artefakt każdego typu slotu.
 */
export const MAX_ARTIFACTS_PER_HERO = 3;

// ============================================================================
// SYSTEM DROPÓW ARTEFAKTÓW
// ============================================================================

/**
 * Entry dla dropu artefaktu z bossa
 */
export interface ArtifactBossDropEntry {
  pillarId: PillarId;
  artifactId: string;
  dropChance: FP; // Fixed-point: 16384 = 100%
}

/**
 * Entry dla dropu artefaktu z fali (pillar-wide)
 */
export interface ArtifactPillarDropEntry {
  pillarId: PillarId;
  artifactId: string;
  dropChance: FP; // Base chance, increases with wave
}

/**
 * Mapowanie bossów do możliwych dropów artefaktów
 * Derived from source.location strings in artifact definitions
 */
export const BOSS_ARTIFACT_DROPS: Record<string, ArtifactBossDropEntry[]> = {
  // Apex sector bosses
  ice_titan: [
    { pillarId: 'gods', artifactId: 'cryo_matrix', dropChance: 328 as FP }, // 2%
  ],
  apex_guardian: [
    { pillarId: 'gods', artifactId: 'crystal_matrix', dropChance: 82 as FP }, // 0.5%
  ],

  // Dimensions sector bosses
  rift_lord: [
    { pillarId: 'magic', artifactId: 'void_codex', dropChance: 164 as FP }, // 1%
  ],

  // Other bosses (no artifact drops defined yet)
  void_walker: [],
  ai_overlord: [],
  rogue_ai: [],
  cosmic_beast: [],
  hive_queen: [],
  crime_lord: [],
  mafia_boss: [],
  bio_titan: [],
  sentinel: [],
};

/**
 * Mapowanie sektorów do możliwych dropów z fal
 * For artifacts that drop from wave completion (not boss-specific)
 */
export const PILLAR_ARTIFACT_DROPS: Record<PillarId, ArtifactPillarDropEntry[]> = {
  streets: [],
  science: [],
  mutants: [],
  cosmos: [],
  magic: [
    { pillarId: 'magic', artifactId: 'gravity_harness', dropChance: 164 as FP }, // 1% base
  ],
  gods: [
    { pillarId: 'gods', artifactId: 'plasma_hammer', dropChance: 82 as FP }, // 0.5% base
  ],
};

/**
 * Wartość dust za duplikat artefaktu według rzadkości
 * (Premium currency - reduced values for rarity)
 */
export const ARTIFACT_DUPLICATE_DUST: Record<ArtifactRarity, number> = {
  common: 25,
  rare: 50,
  epic: 100,
  legendary: 200,
};

/**
 * Pobiera wartość dust za duplikat artefaktu
 */
export function getArtifactDuplicateDustValue(artifactId: string): number {
  const artifact = getArtifactById(artifactId);
  if (!artifact) return 25; // Default to common (reduced for premium economy)
  return ARTIFACT_DUPLICATE_DUST[artifact.rarity];
}

/**
 * Result of artifact drop roll
 */
export interface ArtifactDropResult {
  artifactId: string;
  isDuplicate: boolean;
  dustValue: number;
}

/**
 * Roll for artifact drop from a killed boss
 * @param bossId - The boss that was killed
 * @param pillarId - Current pillar
 * @param rngValue - Random value 0-1 from simulation RNG
 * @param ownedArtifacts - Array of artifact IDs already owned by player
 * @returns Drop result or null if nothing dropped
 */
export function rollArtifactDropFromBoss(
  bossId: string,
  pillarId: PillarId,
  rngValue: number,
  ownedArtifacts: string[]
): ArtifactDropResult | null {
  const drops = BOSS_ARTIFACT_DROPS[bossId];
  if (!drops || drops.length === 0) return null;

  // Filter to matching pillar
  const validDrops = drops.filter(d => d.pillarId === pillarId);
  if (validDrops.length === 0) return null;

  // Convert rngValue to fixed-point (0-16384 range)
  const roll = Math.floor(rngValue * 16384);

  for (const drop of validDrops) {
    if (roll < drop.dropChance) {
      const isDuplicate = ownedArtifacts.includes(drop.artifactId);
      const dustValue = isDuplicate ? getArtifactDuplicateDustValue(drop.artifactId) : 0;

      return {
        artifactId: drop.artifactId,
        isDuplicate,
        dustValue,
      };
    }
  }

  return null;
}

/**
 * Roll for artifact drop from wave completion
 * @param pillarId - Current pillar
 * @param wave - Current wave number (for scaling)
 * @param rngValue - Random value 0-1 from simulation RNG
 * @param ownedArtifacts - Array of artifact IDs already owned by player
 * @returns Drop result or null if nothing dropped
 */
export function rollArtifactDropFromWave(
  pillarId: PillarId,
  wave: number,
  rngValue: number,
  ownedArtifacts: string[]
): ArtifactDropResult | null {
  const drops = PILLAR_ARTIFACT_DROPS[pillarId];
  if (!drops || drops.length === 0) return null;

  // Convert rngValue to fixed-point
  const roll = Math.floor(rngValue * 16384);

  for (const drop of drops) {
    // Wave scaling: +0.5% per 10 waves, max +5%
    const waveBonus = Math.min(Math.floor(wave / 10) * 82, 820);
    // Cap at 25% total chance
    const adjustedChance = Math.min(drop.dropChance + waveBonus, 4096);

    if (roll < adjustedChance) {
      const isDuplicate = ownedArtifacts.includes(drop.artifactId);
      const dustValue = isDuplicate ? getArtifactDuplicateDustValue(drop.artifactId) : 0;

      return {
        artifactId: drop.artifactId,
        isDuplicate,
        dustValue,
      };
    }
  }

  return null;
}
