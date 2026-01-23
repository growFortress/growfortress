/**
 * Simplified Relic System
 * ~25 relics across 7 categories
 */

import { RelicDef, ModifierSet, FortressClass, PillarId } from '../types.js';

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
  | 'cursed'
  | 'support';

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
 * Default modifier values (neutral - all bonuses start at 0)
 * Formula: base × (1 + bonus)
 */
export const DEFAULT_MODIFIERS: ModifierSet = {
  // Additive bonuses (0 = no change)
  damageBonus: 0,
  attackSpeedBonus: 0,
  cooldownReduction: 0,
  goldBonus: 0,
  dustBonus: 0,
  maxHpBonus: 0,
  eliteDamageBonus: 0,

  // Stackable secondary stats
  splashRadiusBonus: 0,
  splashDamagePercent: 0,
  pierceCount: 0,
  chainChance: 0,
  chainCount: 0,
  chainDamagePercent: 0,
  executeThreshold: 0,
  executeBonusDamage: 0,
  critChance: 0,
  critDamageBonus: 0.5,        // Base 150% crit damage

  // Defense
  hpRegen: 0,
  incomingDamageReduction: 0,
  lifesteal: 0,
  reflectDamage: 0,

  // Physics-based defense
  massBonus: 0,
  knockbackResistance: 0,
  ccResistance: 0,

  // Luck (meta-rewards)
  dropRateBonus: 0,
  relicQualityBonus: 0,
  goldFindBonus: 0,

  // Conditional
  waveDamageBonus: 0,
  lowHpDamageBonus: 0,
  lowHpThreshold: 0.3,
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
    rarity: 'legendary',
    isBuildDefining: true,
    modifiers: {
      ...DEFAULT_MODIFIERS,
      splashRadiusBonus: 3,
      splashDamagePercent: 0.35,
    },
    synergies: [],
  },
  {
    id: 'splash-burst',
    name: 'Splash Burst',
    description: 'Critical hits deal 50% splash damage (+1 radius)',
    category: 'build_defining',
    rarity: 'epic',
    isBuildDefining: true,
    modifiers: {
      ...DEFAULT_MODIFIERS,
      splashRadiusBonus: 1,
      splashDamagePercent: 0.5,
      // Note: Only triggers on crit - handled in simulation logic
    },
    synergies: [],
  },
  {
    id: 'splash-wave',
    name: 'Splash Wave',
    description: 'Splash damage increases with each enemy hit (+5 radius, stacks)',
    category: 'build_defining',
    rarity: 'epic',
    isBuildDefining: true,
    modifiers: {
      ...DEFAULT_MODIFIERS,
      splashRadiusBonus: 5,
      splashDamagePercent: 0.25,
      // Note: Stacking logic handled in simulation
    },
    synergies: [],
  },
  {
    id: 'chain-lightning',
    name: 'Chain Lightning',
    description: '+40% chain chance, +2 chains',
    category: 'build_defining',
    rarity: 'legendary',
    isBuildDefining: true,
    modifiers: {
      ...DEFAULT_MODIFIERS,
      chainChance: 0.4,
      chainCount: 2,
      chainDamagePercent: 0.6,
    },
    synergies: [],
  },
  {
    id: 'chain-focus',
    name: 'Chain Focus',
    description: '+60% chain chance, +1 chain, +80% chain damage',
    category: 'build_defining',
    rarity: 'epic',
    isBuildDefining: true,
    modifiers: {
      ...DEFAULT_MODIFIERS,
      chainChance: 0.6,
      chainCount: 1,
      chainDamagePercent: 0.8,
    },
    synergies: [],
  },
  {
    id: 'chain-cascade',
    name: 'Chain Cascade',
    description: '+20% chain chance, +4 chains, 40% chain damage',
    category: 'build_defining',
    rarity: 'epic',
    isBuildDefining: true,
    modifiers: {
      ...DEFAULT_MODIFIERS,
      chainChance: 0.2,
      chainCount: 4,
      chainDamagePercent: 0.4,
    },
    synergies: [],
  },
  {
    id: 'executioner',
    name: 'Executioner',
    description: 'Execute enemies below 15% HP for +200% damage',
    category: 'build_defining',
    rarity: 'legendary',
    isBuildDefining: true,
    modifiers: {
      ...DEFAULT_MODIFIERS,
      executeThreshold: 0.15,
      executeBonusDamage: 2.0,  // +200% = 3x total
    },
    synergies: [],
  },
  {
    id: 'glass-cannon',
    name: 'Glass Cannon',
    description: '+60% damage, -50% max HP (high risk, high reward)',
    category: 'build_defining',
    rarity: 'legendary',
    isBuildDefining: true,
    modifiers: {
      ...DEFAULT_MODIFIERS,
      damageBonus: 0.6,      // +60% (nerfed from +100%, lifesteal doesn't fully compensate)
      maxHpBonus: -0.5,      // -50% (increased from -40%)
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
      maxHpBonus: 0.25,
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
      damageBonus: 0.2,
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
      attackSpeedBonus: 0.15,
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
      critDamageBonus: 0.5,  // +50% on top of base
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
      eliteDamageBonus: 0.5,
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
      maxHpBonus: 0.3,
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
      damageBonus: 0.25,
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
      chainDamagePercent: 0.3,
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
      attackSpeedBonus: 0.25,
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
      damageBonus: 0.3,
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
    description: 'Cosmos Pillar: +40% damage, +20% drop rates',
    category: 'pillar',
    rarity: 'epic',
    isBuildDefining: false,
    requirements: { pillarId: 'cosmos' },
    modifiers: {
      ...DEFAULT_MODIFIERS,
      damageBonus: 0.4,
      dropRateBonus: 0.2,  // Luck now affects drops, not combat
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
      attackSpeedBonus: 0.3,
      critChance: 0.2,
    },
    synergies: [],
  },
  {
    id: 'magic-arts',
    name: 'Magic Arts',
    description: 'Magic Pillar: +50% damage, 20% cooldown reduction',
    category: 'pillar',
    rarity: 'epic',
    isBuildDefining: false,
    requirements: { pillarId: 'magic' },
    modifiers: {
      ...DEFAULT_MODIFIERS,
      damageBonus: 0.5,
      cooldownReduction: 0.2,
    },
    synergies: [],
  },
];

// ============================================================================
// SYNERGY RELICS (3)
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
      cooldownReduction: 0.4,  // 40% CDR
      critChance: 0.15,
    },
    synergies: [],
  },
  {
    id: 'team-spirit',
    name: 'Team Spirit',
    description: '+15% damage and +5% HP per hero matching fortress class',
    category: 'synergy',
    rarity: 'epic',
    isBuildDefining: false,
    modifiers: {
      ...DEFAULT_MODIFIERS,
      damageBonus: 0.15,
      maxHpBonus: 0.05,
    },
    synergies: [],
  },
  {
    id: 'unity-crystal',
    name: 'Unity Crystal',
    description: '+50% to all synergy bonuses (additive)',
    category: 'synergy',
    rarity: 'legendary',
    isBuildDefining: true,
    modifiers: {
      ...DEFAULT_MODIFIERS,
      // No direct modifiers - effect is applied in synergy calculation
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
    description: '+30% gold from all sources',
    category: 'economy',
    rarity: 'rare',
    isBuildDefining: false,
    modifiers: {
      ...DEFAULT_MODIFIERS,
      goldBonus: 0.3,  // Reduced from 0.5 for economy balance
    },
    synergies: [],
  },
  {
    id: 'dust-collector',
    name: 'Dust Collector',
    description: '+10% dust from all sources',
    category: 'economy',
    rarity: 'rare',
    isBuildDefining: false,
    modifiers: {
      ...DEFAULT_MODIFIERS,
      dustBonus: 0.10,  // Premium currency - reduced from 0.3
    },
    synergies: [],
  },
  {
    id: 'lucky-charm',
    name: 'Lucky Charm',
    description: '+30% drop rates, +20% relic quality',
    category: 'economy',
    rarity: 'epic',
    isBuildDefining: false,
    modifiers: {
      ...DEFAULT_MODIFIERS,
      dropRateBonus: 0.3,
      relicQualityBonus: 0.2,
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
      lowHpDamageBonus: 0.8,
      lowHpThreshold: 0.3,
    },
    curse: {
      stat: 'maxHpBonus',
      value: 0.8,  // Will be converted to -0.2 in applyCurse
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
      goldBonus: 1.0,
    },
    curse: {
      stat: 'damageBonus',
      value: 0.85,  // Will be converted to -0.15 in applyCurse
      description: '-15% damage',
    },
    synergies: [],
  },
  {
    id: 'desperate-measures',
    name: 'Desperate Measures',
    description: '+100% damage when HP below 20%, +25% incoming damage',
    category: 'cursed',
    rarity: 'legendary',
    isBuildDefining: true,
    modifiers: {
      ...DEFAULT_MODIFIERS,
      lowHpDamageBonus: 1.0,
      lowHpThreshold: 0.2,
    },
    curse: {
      stat: 'incomingDamage',
      value: 1.25,  // Will set incomingDamageReduction to -0.25
      description: '+25% incoming damage',
    },
    synergies: [],
  },
];

// ============================================================================
// PHYSICS DEFENSE RELICS (2) - NEW
// ============================================================================

const PHYSICS_DEFENSE_RELICS: ExtendedRelicDef[] = [
  {
    id: 'immovable-object',
    name: 'Immovable Object',
    description: '+50% mass, +30% knockback resistance',
    category: 'standard',
    rarity: 'rare',
    isBuildDefining: false,
    modifiers: {
      ...DEFAULT_MODIFIERS,
      massBonus: 0.5,
      knockbackResistance: 0.3,
    },
    synergies: [],
  },
  {
    id: 'crowd-breaker',
    name: 'Crowd Breaker',
    description: '+40% CC resistance, +20% mass',
    category: 'standard',
    rarity: 'rare',
    isBuildDefining: false,
    modifiers: {
      ...DEFAULT_MODIFIERS,
      ccResistance: 0.4,
      massBonus: 0.2,
    },
    synergies: [],
  },
];

// ============================================================================
// SUPPORT RELICS (6) - Build-enhancing relics
// ============================================================================

const SUPPORT_RELICS: ExtendedRelicDef[] = [
  // Splash Support
  {
    id: 'splash-amplifier',
    name: 'Splash Amplifier',
    description: '+15% splash damage, +1 splash radius',
    category: 'support',
    rarity: 'rare',
    isBuildDefining: false,
    modifiers: {
      ...DEFAULT_MODIFIERS,
      splashRadiusBonus: 1,
      splashDamagePercent: 0.15,
    },
    synergies: ['splash'],
  },
  {
    id: 'area-dominance',
    name: 'Area Dominance',
    description: '+10% damage vs grouped enemies (3+ in radius 5)',
    category: 'support',
    rarity: 'rare',
    isBuildDefining: false,
    modifiers: {
      ...DEFAULT_MODIFIERS,
      // Note: Conditional logic handled in simulation
      damageBonus: 0.1,
    },
    synergies: ['splash'],
  },
  {
    id: 'explosive-impact',
    name: 'Explosive Impact',
    description: 'First hit on grouped enemy deals +30% damage',
    category: 'support',
    rarity: 'epic',
    isBuildDefining: false,
    modifiers: {
      ...DEFAULT_MODIFIERS,
      // Note: Conditional logic handled in simulation
      damageBonus: 0.3,
    },
    synergies: ['splash'],
  },
  // Chain Support
  {
    id: 'chain-resonance',
    name: 'Chain Resonance',
    description: '+10% chain chance, +20% chain damage',
    category: 'support',
    rarity: 'rare',
    isBuildDefining: false,
    modifiers: {
      ...DEFAULT_MODIFIERS,
      chainChance: 0.1,
      chainDamagePercent: 0.2,
    },
    synergies: ['chain'],
  },
  {
    id: 'lightning-rod',
    name: 'Lightning Rod',
    description: 'Chains prefer low HP enemies',
    category: 'support',
    rarity: 'rare',
    isBuildDefining: false,
    modifiers: {
      ...DEFAULT_MODIFIERS,
      // Note: Targeting logic handled in simulation
    },
    synergies: ['chain'],
  },
  {
    id: 'voltage-surge',
    name: 'Voltage Surge',
    description: 'Each chain increases next chain damage by +10% (stacks)',
    category: 'support',
    rarity: 'epic',
    isBuildDefining: false,
    modifiers: {
      ...DEFAULT_MODIFIERS,
      // Note: Stacking logic handled in simulation
      chainDamagePercent: 0.1,
    },
    synergies: ['chain'],
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
  ...PHYSICS_DEFENSE_RELICS,
  ...SUPPORT_RELICS,
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
  detectedBuildType?: BuildType;
  fortressHpPercent?: number;
}

export type BuildType = 'splash' | 'chain' | 'execute' | 'crit' | 'tank' | 'economy' | 'balanced';

export function detectBuildType(ownedRelicIds: string[]): BuildType {
  // Check for build-defining relics (including variants)
  if (ownedRelicIds.includes('splash-master') || 
      ownedRelicIds.includes('splash-burst') || 
      ownedRelicIds.includes('splash-wave')) return 'splash';
  if (ownedRelicIds.includes('chain-lightning') || 
      ownedRelicIds.includes('chain-focus') || 
      ownedRelicIds.includes('chain-cascade')) return 'chain';
  if (ownedRelicIds.includes('executioner')) return 'execute';
  if (ownedRelicIds.includes('critical-eye')) return 'crit';
  if (ownedRelicIds.includes('iron-hide')) return 'tank';
  if (ownedRelicIds.includes('gold-rush') || ownedRelicIds.includes('dust-collector')) return 'economy';
  return 'balanced';
}

/**
 * Check if player has a build-defining relic
 */
export function hasBuildDefiningRelic(ownedRelicIds: string[]): boolean {
  const buildDefiningIds = [
    'splash-master', 'splash-burst', 'splash-wave',
    'chain-lightning', 'chain-focus', 'chain-cascade',
    'executioner', 'glass-cannon',
    'harmonic-resonance', 'unity-crystal',
    'berserkers-rage', 'desperate-measures',
  ];
  return ownedRelicIds.some(id => buildDefiningIds.includes(id));
}

/**
 * Get support relics for a specific build type
 */
export function getSupportRelicsForBuild(buildType: BuildType): ExtendedRelicDef[] {
  if (buildType === 'splash') {
    return RELICS.filter(r => 
      r.category === 'support' && 
      (r.id === 'splash-amplifier' || r.id === 'area-dominance' || r.id === 'explosive-impact')
    );
  }
  if (buildType === 'chain') {
    return RELICS.filter(r => 
      r.category === 'support' && 
      (r.id === 'chain-resonance' || r.id === 'lightning-rod' || r.id === 'voltage-surge')
    );
  }
  return [];
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

  const ownedRelicIds = context.ownedRelicIds || [];
  const hasBuildDefining = hasBuildDefiningRelic(ownedRelicIds);
  const detectedBuildType = context.detectedBuildType || detectBuildType(ownedRelicIds);
  const supportRelicsForBuild = getSupportRelicsForBuild(detectedBuildType);

  // Calculate weights based on rarity and context
  const weighted: { relic: ExtendedRelicDef; weight: number }[] = available.map(relic => {
    let weight = RELIC_RARITY_CONFIG[relic.rarity].baseWeight;

    // Reduce weight for build-defining relics if player doesn't have one yet
    if (relic.isBuildDefining && !hasBuildDefining) {
      weight *= 0.5; // 50% less likely
    }

    // Increase weight for support relics if player has matching build-defining
    if (relic.category === 'support' && hasBuildDefining) {
      const isMatchingSupport = supportRelicsForBuild.some(sr => sr.id === relic.id);
      if (isMatchingSupport) {
        weight *= 1.5; // 50% more likely
      }
    }

    return { relic, weight };
  });

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
