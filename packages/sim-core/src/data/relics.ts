/**
 * Simplified Relic System
 * ~25 relics across 7 categories
 */

import { RelicDef, ModifierSet, FortressClass, PillarId } from '../types.js';
import { FP } from '../fixed.js';

// ============================================================================
// TYPES
// ============================================================================

export type RelicCategory =
  | 'build_defining'
  | 'standard'
  | 'class'
  | 'pillar'
  | 'synergy'
  | 'economy'
  | 'cursed';

export type RelicRarity = 'common' | 'rare' | 'epic' | 'legendary';

export const RELIC_RARITY_CONFIG = {
  common:    { baseWeight: 1.0,  color: 0x808080 },
  rare:      { baseWeight: 0.6,  color: 0x0066ff },
  epic:      { baseWeight: 0.3,  color: 0x9900cc },
  legendary: { baseWeight: 0.1,  color: 0xffaa00 },
} as const;

export interface ExtendedRelicDef extends RelicDef {
  category: RelicCategory;
  rarity: RelicRarity;
  synergies: string[];
  requirements?: {
    fortressClass?: FortressClass;
    pillarId?: PillarId;
    minFortressLevel?: number;
  };
  curse?: {
    stat: string;
    value: number;
    description: string;
  };
}

/**
 * Default modifier values (neutral)
 */
export const DEFAULT_MODIFIERS: ModifierSet = {
  damageMultiplier: 1.0,
  splashRadius: 0,
  splashDamage: 0,
  pierceCount: 0,
  chainChance: 0,
  chainCount: 0,
  chainDamage: 0,
  executeThreshold: 0,
  executeDamage: 1.0,
  critChance: 0,
  critDamage: 1.5,
  goldMultiplier: 1.0,
  dustMultiplier: 1.0,
  maxHpMultiplier: 1.0,
  hpRegen: 0,
  cooldownMultiplier: 1.0,
  attackSpeedMultiplier: 1.0,
  eliteDamageMultiplier: 1.0,
  waveDamageBonus: 0,
  lowHpDamageMultiplier: 1.0,
  lowHpThreshold: 0.3,
  luckMultiplier: 1.0,
};

// ============================================================================
// BUILD-DEFINING RELICS (4)
// ============================================================================

const BUILD_DEFINING_RELICS: ExtendedRelicDef[] = [
  {
    id: 'splash-master',
    name: 'Splash Master',
    description: 'Attacks deal 35% damage to nearby enemies',
    category: 'build_defining',
    rarity: 'epic',
    isBuildDefining: true,
    modifiers: {
      ...DEFAULT_MODIFIERS,
      splashRadius: FP.fromInt(3),
      splashDamage: 0.35,
    },
    synergies: [],
  },
  {
    id: 'chain-lightning',
    name: 'Chain Lightning',
    description: '+40% chain chance, +2 chains',
    category: 'build_defining',
    rarity: 'epic',
    isBuildDefining: true,
    modifiers: {
      ...DEFAULT_MODIFIERS,
      chainChance: 0.4,
      chainCount: 2,
      chainDamage: 0.6,
    },
    synergies: [],
  },
  {
    id: 'executioner',
    name: 'Executioner',
    description: 'Execute enemies below 15% HP for 3x damage',
    category: 'build_defining',
    rarity: 'legendary',
    isBuildDefining: true,
    modifiers: {
      ...DEFAULT_MODIFIERS,
      executeThreshold: 0.15,
      executeDamage: 3.0,
    },
    synergies: [],
  },
  {
    id: 'glass-cannon',
    name: 'Glass Cannon',
    description: '+100% damage, -40% max HP',
    category: 'build_defining',
    rarity: 'legendary',
    isBuildDefining: true,
    modifiers: {
      ...DEFAULT_MODIFIERS,
      damageMultiplier: 2.0,
      maxHpMultiplier: 0.6,
    },
    synergies: [],
  },
];

// ============================================================================
// STANDARD RELICS (5)
// ============================================================================

const STANDARD_RELICS: ExtendedRelicDef[] = [
  {
    id: 'iron-hide',
    name: 'Iron Hide',
    description: '+25% max HP',
    category: 'standard',
    rarity: 'common',
    isBuildDefining: false,
    modifiers: {
      ...DEFAULT_MODIFIERS,
      maxHpMultiplier: 1.25,
    },
    synergies: [],
  },
  {
    id: 'sharpened-blades',
    name: 'Sharpened Blades',
    description: '+20% damage',
    category: 'standard',
    rarity: 'common',
    isBuildDefining: false,
    modifiers: {
      ...DEFAULT_MODIFIERS,
      damageMultiplier: 1.2,
    },
    synergies: [],
  },
  {
    id: 'swift-strikes',
    name: 'Swift Strikes',
    description: '+15% attack speed',
    category: 'standard',
    rarity: 'common',
    isBuildDefining: false,
    modifiers: {
      ...DEFAULT_MODIFIERS,
      attackSpeedMultiplier: 1.15,
    },
    synergies: [],
  },
  {
    id: 'critical-eye',
    name: 'Critical Eye',
    description: '+10% crit chance, +50% crit damage',
    category: 'standard',
    rarity: 'rare',
    isBuildDefining: false,
    modifiers: {
      ...DEFAULT_MODIFIERS,
      critChance: 0.1,
      critDamage: 2.0,
    },
    synergies: [],
  },
  {
    id: 'elite-hunter',
    name: 'Elite Hunter',
    description: '+50% damage to elite enemies',
    category: 'standard',
    rarity: 'rare',
    isBuildDefining: false,
    modifiers: {
      ...DEFAULT_MODIFIERS,
      eliteDamageMultiplier: 1.5,
    },
    synergies: [],
  },
];

// ============================================================================
// CLASS RELICS (5)
// ============================================================================

const CLASS_RELICS: ExtendedRelicDef[] = [
  {
    id: 'natural-growth',
    name: 'Natural Growth',
    description: 'Natural class: +30% HP, +HP regen',
    category: 'class',
    rarity: 'rare',
    isBuildDefining: false,
    requirements: { fortressClass: 'natural' },
    modifiers: {
      ...DEFAULT_MODIFIERS,
      maxHpMultiplier: 1.3,
      hpRegen: 2,
    },
    synergies: ['natural'],
  },
  {
    id: 'ice-mastery',
    name: 'Ice Mastery',
    description: 'Ice class: +25% damage, enemies slow on hit',
    category: 'class',
    rarity: 'rare',
    isBuildDefining: false,
    requirements: { fortressClass: 'ice' },
    modifiers: {
      ...DEFAULT_MODIFIERS,
      damageMultiplier: 1.25,
    },
    synergies: ['ice'],
  },
  {
    id: 'lightning-surge',
    name: 'Lightning Surge',
    description: 'Lightning class: +30% chain damage, +1 chain',
    category: 'class',
    rarity: 'rare',
    isBuildDefining: false,
    requirements: { fortressClass: 'lightning' },
    modifiers: {
      ...DEFAULT_MODIFIERS,
      chainDamage: 0.3,
      chainCount: 1,
    },
    synergies: ['lightning'],
  },
  {
    id: 'tech-precision',
    name: 'Tech Precision',
    description: 'Tech class: +15% crit chance, +25% attack speed',
    category: 'class',
    rarity: 'rare',
    isBuildDefining: false,
    requirements: { fortressClass: 'tech' },
    modifiers: {
      ...DEFAULT_MODIFIERS,
      critChance: 0.15,
      attackSpeedMultiplier: 1.25,
    },
    synergies: ['tech'],
  },
  {
    id: 'fire-fury',
    name: 'Fire Fury',
    description: 'Fire class: +30% damage, +5% crit chance',
    category: 'class',
    rarity: 'rare',
    isBuildDefining: false,
    requirements: { fortressClass: 'fire' },
    modifiers: {
      ...DEFAULT_MODIFIERS,
      damageMultiplier: 1.3,
      critChance: 0.05,
    },
    synergies: ['fire'],
  },
];

// ============================================================================
// PILLAR RELICS (3)
// ============================================================================

const PILLAR_RELICS: ExtendedRelicDef[] = [
  {
    id: 'cosmos-blessing',
    name: 'Cosmos Blessing',
    description: 'Cosmos Pillar: +40% damage, +20% luck',
    category: 'pillar',
    rarity: 'epic',
    isBuildDefining: false,
    requirements: { pillarId: 'cosmos' },
    modifiers: {
      ...DEFAULT_MODIFIERS,
      damageMultiplier: 1.4,
      luckMultiplier: 1.2,
    },
    synergies: [],
  },
  {
    id: 'science-enhancement',
    name: 'Science Enhancement',
    description: 'Science Pillar: +30% attack speed, +20% crit',
    category: 'pillar',
    rarity: 'epic',
    isBuildDefining: false,
    requirements: { pillarId: 'science' },
    modifiers: {
      ...DEFAULT_MODIFIERS,
      attackSpeedMultiplier: 1.3,
      critChance: 0.2,
    },
    synergies: [],
  },
  {
    id: 'magic-arts',
    name: 'Magic Arts',
    description: 'Magic Pillar: +50% damage, -20% cooldowns',
    category: 'pillar',
    rarity: 'epic',
    isBuildDefining: false,
    requirements: { pillarId: 'magic' },
    modifiers: {
      ...DEFAULT_MODIFIERS,
      damageMultiplier: 1.5,
      cooldownMultiplier: 0.8,
    },
    synergies: [],
  },
];

// ============================================================================
// SYNERGY RELICS (2)
// ============================================================================

const SYNERGY_RELICS: ExtendedRelicDef[] = [
  {
    id: 'harmonic-resonance',
    name: 'Harmonic Resonance',
    description: 'Double synergy bonuses when all units match class',
    category: 'synergy',
    rarity: 'legendary',
    isBuildDefining: true,
    modifiers: {
      ...DEFAULT_MODIFIERS,
      cooldownMultiplier: 0.6,
      critChance: 0.15,
    },
    synergies: [],
  },
  {
    id: 'team-spirit',
    name: 'Team Spirit',
    description: '+5% damage and HP per hero matching fortress class',
    category: 'synergy',
    rarity: 'epic',
    isBuildDefining: false,
    modifiers: {
      ...DEFAULT_MODIFIERS,
      damageMultiplier: 1.15,
      maxHpMultiplier: 1.05,
    },
    synergies: [],
  },
];

// ============================================================================
// ECONOMY RELICS (3)
// ============================================================================

const ECONOMY_RELICS: ExtendedRelicDef[] = [
  {
    id: 'gold-rush',
    name: 'Gold Rush',
    description: '+50% gold from all sources',
    category: 'economy',
    rarity: 'rare',
    isBuildDefining: false,
    modifiers: {
      ...DEFAULT_MODIFIERS,
      goldMultiplier: 1.5,
    },
    synergies: [],
  },
  {
    id: 'dust-collector',
    name: 'Dust Collector',
    description: '+50% dust from all sources',
    category: 'economy',
    rarity: 'rare',
    isBuildDefining: false,
    modifiers: {
      ...DEFAULT_MODIFIERS,
      dustMultiplier: 1.5,
    },
    synergies: [],
  },
  {
    id: 'lucky-charm',
    name: 'Lucky Charm',
    description: '+30% luck for all drops',
    category: 'economy',
    rarity: 'epic',
    isBuildDefining: false,
    modifiers: {
      ...DEFAULT_MODIFIERS,
      luckMultiplier: 1.3,
    },
    synergies: [],
  },
];

// ============================================================================
// CURSED RELICS (3)
// ============================================================================

const CURSED_RELICS: ExtendedRelicDef[] = [
  {
    id: 'berserkers-rage',
    name: "Berserker's Rage",
    description: '+80% damage when below 30% HP, -20% max HP',
    category: 'cursed',
    rarity: 'epic',
    isBuildDefining: true,
    modifiers: {
      ...DEFAULT_MODIFIERS,
      lowHpDamageMultiplier: 1.8,
      lowHpThreshold: 0.3,
      maxHpMultiplier: 0.8,
    },
    curse: {
      stat: 'maxHpMultiplier',
      value: 0.8,
      description: '-20% max HP',
    },
    synergies: [],
  },
  {
    id: 'greedy-goblin',
    name: 'Greedy Goblin',
    description: '+100% gold, -15% damage',
    category: 'cursed',
    rarity: 'rare',
    isBuildDefining: false,
    modifiers: {
      ...DEFAULT_MODIFIERS,
      goldMultiplier: 2.0,
      damageMultiplier: 0.85,
    },
    curse: {
      stat: 'damageMultiplier',
      value: 0.85,
      description: '-15% damage',
    },
    synergies: [],
  },
  {
    id: 'desperate-measures',
    name: 'Desperate Measures',
    description: '+100% damage when HP below 20%, enemies deal +25% damage',
    category: 'cursed',
    rarity: 'legendary',
    isBuildDefining: true,
    modifiers: {
      ...DEFAULT_MODIFIERS,
      lowHpDamageMultiplier: 2.0,
      lowHpThreshold: 0.2,
    },
    curse: {
      stat: 'incomingDamage',
      value: 1.25,
      description: '+25% incoming damage',
    },
    synergies: [],
  },
];

// ============================================================================
// COMBINED RELICS ARRAY
// ============================================================================

export const RELICS: ExtendedRelicDef[] = [
  ...BUILD_DEFINING_RELICS,
  ...STANDARD_RELICS,
  ...CLASS_RELICS,
  ...PILLAR_RELICS,
  ...SYNERGY_RELICS,
  ...ECONOMY_RELICS,
  ...CURSED_RELICS,
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getRelicById(id: string): ExtendedRelicDef | undefined {
  return RELICS.find((r) => r.id === id);
}

export function getAllRelicIds(): string[] {
  return RELICS.map((r) => r.id);
}

export function getAvailableRelics(
  fortressClass?: FortressClass,
  pillarId?: PillarId,
  fortressLevel?: number
): ExtendedRelicDef[] {
  return RELICS.filter((relic) => {
    // Check class requirement
    if (relic.requirements?.fortressClass && relic.requirements.fortressClass !== fortressClass) {
      return false;
    }

    // Check pillar requirement
    if (relic.requirements?.pillarId && relic.requirements.pillarId !== pillarId) {
      return false;
    }

    // Check level requirement
    if (relic.requirements?.minFortressLevel && fortressLevel !== undefined) {
      if (fortressLevel < relic.requirements.minFortressLevel) {
        return false;
      }
    }

    return true;
  });
}

export function getRelicsByCategory(category: RelicCategory): ExtendedRelicDef[] {
  return RELICS.filter((r) => r.category === category);
}

export function getRelicsByRarity(rarity: RelicRarity): ExtendedRelicDef[] {
  return RELICS.filter((r) => r.rarity === rarity);
}

export function getBuildDefiningRelics(): ExtendedRelicDef[] {
  return RELICS.filter((r) => r.isBuildDefining);
}

export function getCursedRelics(): ExtendedRelicDef[] {
  return RELICS.filter((r) => r.category === 'cursed');
}

// ============================================================================
// RELIC SELECTION SYSTEM (V2)
// ============================================================================

export interface ExtendedRelicSelectionContext {
  fortressClass?: FortressClass;
  pillarId?: PillarId;
  heroIds?: string[];
  equippedStones?: string[];
  fortressLevel?: number;
  wave?: number;
  ownedRelicIds?: string[];
  gold?: number;
  detectedBuildType?: string;
  fortressHpPercent?: number;
}

export type BuildType = 'splash' | 'chain' | 'execute' | 'crit' | 'tank' | 'economy' | 'balanced';

export function detectBuildType(ownedRelicIds: string[]): BuildType {
  if (ownedRelicIds.includes('splash-master')) return 'splash';
  if (ownedRelicIds.includes('chain-lightning')) return 'chain';
  if (ownedRelicIds.includes('executioner')) return 'execute';
  if (ownedRelicIds.includes('critical-eye')) return 'crit';
  if (ownedRelicIds.includes('iron-hide')) return 'tank';
  if (ownedRelicIds.includes('gold-rush') || ownedRelicIds.includes('dust-collector')) return 'economy';
  return 'balanced';
}

interface RelicRng {
  nextFloat(): number;
  nextInt(min: number, max: number): number;
  pickN<T>(arr: T[], n: number): T[];
}

export function getRelicChoicesV2(
  count: number,
  context: ExtendedRelicSelectionContext,
  rng: RelicRng
): ExtendedRelicDef[] {
  // Get available relics that match requirements
  const available = getAvailableRelics(
    context.fortressClass,
    context.pillarId,
    context.fortressLevel
  ).filter(r => !context.ownedRelicIds?.includes(r.id));

  if (available.length === 0) {
    return [];
  }

  // Calculate weights based on rarity
  const weighted: { relic: ExtendedRelicDef; weight: number }[] = available.map(relic => ({
    relic,
    weight: RELIC_RARITY_CONFIG[relic.rarity].baseWeight,
  }));

  // Select relics using weighted random
  const selected: ExtendedRelicDef[] = [];
  const remaining = [...weighted];

  for (let i = 0; i < Math.min(count, remaining.length); i++) {
    const totalWeight = remaining.reduce((sum, w) => sum + w.weight, 0);
    let roll = rng.nextFloat() * totalWeight;

    for (let j = 0; j < remaining.length; j++) {
      roll -= remaining[j].weight;
      if (roll <= 0) {
        selected.push(remaining[j].relic);
        remaining.splice(j, 1);
        break;
      }
    }
  }

  return selected;
}
