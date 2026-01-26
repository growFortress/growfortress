/**
 * Synergy Tags System
 *
 * Each hero, turret, and perk has tags that determine synergy bonuses.
 * When multiple units share the same tag, synergy bonuses activate.
 */

// ============================================================================
// TAG DEFINITIONS
// ============================================================================

/**
 * All available synergy tags
 */
export type SynergyTag =
  // Element-based tags (from class)
  | 'fire'
  | 'ice'
  | 'lightning'
  | 'tech'
  | 'void'
  | 'natural'
  // Role-based tags
  | 'dps'
  | 'tank'
  | 'support'
  | 'crowd_control'
  | 'assassin'
  // Mechanic-based tags
  | 'burn'         // Applies burn DOT
  | 'freeze'       // Applies freeze/slow
  | 'chain'        // Chain attacks
  | 'splash'       // Area damage
  | 'execute'      // Execute low HP enemies
  | 'heal'         // Healing abilities
  | 'shield'       // Provides shields
  | 'crit'         // Critical hit focused
  | 'speed'        // Attack speed focused
  | 'range'        // Long range
  | 'aoe'          // Area of effect
  // Origin-based tags
  | 'starter'      // Starter units
  | 'elite'        // Rare/Epic units
  | 'legendary';   // Legendary units

/**
 * Tag category for UI grouping
 */
export type TagCategory = 'element' | 'role' | 'mechanic' | 'origin';

/**
 * Tag metadata for display
 */
export interface TagDefinition {
  id: SynergyTag;
  name: string;
  nameKey: string;
  description: string;
  descriptionKey: string;
  category: TagCategory;
  color: string;
  icon: string;
}

/**
 * All tag definitions
 */
export const TAG_DEFINITIONS: TagDefinition[] = [
  // Element tags
  { id: 'fire', name: 'Fire', nameKey: 'tags.fire.name', description: 'Fire element units', descriptionKey: 'tags.fire.desc', category: 'element', color: '#ff4500', icon: '🔥' },
  { id: 'ice', name: 'Ice', nameKey: 'tags.ice.name', description: 'Ice element units', descriptionKey: 'tags.ice.desc', category: 'element', color: '#00bfff', icon: '❄️' },
  { id: 'lightning', name: 'Lightning', nameKey: 'tags.lightning.name', description: 'Lightning element units', descriptionKey: 'tags.lightning.desc', category: 'element', color: '#9932cc', icon: '⚡' },
  { id: 'tech', name: 'Tech', nameKey: 'tags.tech.name', description: 'Technology based units', descriptionKey: 'tags.tech.desc', category: 'element', color: '#00f0ff', icon: '🔧' },
  { id: 'void', name: 'Void', nameKey: 'tags.void.name', description: 'Void/Dark units', descriptionKey: 'tags.void.desc', category: 'element', color: '#4b0082', icon: '🌀' },
  { id: 'natural', name: 'Natural', nameKey: 'tags.natural.name', description: 'Natural element units', descriptionKey: 'tags.natural.desc', category: 'element', color: '#228b22', icon: '🌿' },

  // Role tags
  { id: 'dps', name: 'DPS', nameKey: 'tags.dps.name', description: 'Damage focused units', descriptionKey: 'tags.dps.desc', category: 'role', color: '#ff6b6b', icon: '⚔️' },
  { id: 'tank', name: 'Tank', nameKey: 'tags.tank.name', description: 'Defensive units', descriptionKey: 'tags.tank.desc', category: 'role', color: '#4a90d9', icon: '🛡️' },
  { id: 'support', name: 'Support', nameKey: 'tags.support.name', description: 'Support/Utility units', descriptionKey: 'tags.support.desc', category: 'role', color: '#50c878', icon: '💚' },
  { id: 'crowd_control', name: 'CC', nameKey: 'tags.cc.name', description: 'Crowd control units', descriptionKey: 'tags.cc.desc', category: 'role', color: '#87ceeb', icon: '🎯' },
  { id: 'assassin', name: 'Assassin', nameKey: 'tags.assassin.name', description: 'High burst damage', descriptionKey: 'tags.assassin.desc', category: 'role', color: '#8b0000', icon: '🗡️' },

  // Mechanic tags
  { id: 'burn', name: 'Burn', nameKey: 'tags.burn.name', description: 'Applies burn damage', descriptionKey: 'tags.burn.desc', category: 'mechanic', color: '#ff6347', icon: '🔥' },
  { id: 'freeze', name: 'Freeze', nameKey: 'tags.freeze.name', description: 'Freezes/slows enemies', descriptionKey: 'tags.freeze.desc', category: 'mechanic', color: '#b0e0e6', icon: '🧊' },
  { id: 'chain', name: 'Chain', nameKey: 'tags.chain.name', description: 'Chain attacks', descriptionKey: 'tags.chain.desc', category: 'mechanic', color: '#daa520', icon: '⛓️' },
  { id: 'splash', name: 'Splash', nameKey: 'tags.splash.name', description: 'Area damage', descriptionKey: 'tags.splash.desc', category: 'mechanic', color: '#ffa500', icon: '💥' },
  { id: 'execute', name: 'Execute', nameKey: 'tags.execute.name', description: 'Execute low HP', descriptionKey: 'tags.execute.desc', category: 'mechanic', color: '#dc143c', icon: '☠️' },
  { id: 'heal', name: 'Heal', nameKey: 'tags.heal.name', description: 'Healing abilities', descriptionKey: 'tags.heal.desc', category: 'mechanic', color: '#00ff7f', icon: '💖' },
  { id: 'shield', name: 'Shield', nameKey: 'tags.shield.name', description: 'Provides shields', descriptionKey: 'tags.shield.desc', category: 'mechanic', color: '#87ceeb', icon: '🛡️' },
  { id: 'crit', name: 'Crit', nameKey: 'tags.crit.name', description: 'Critical hit focused', descriptionKey: 'tags.crit.desc', category: 'mechanic', color: '#ffd700', icon: '💢' },
  { id: 'speed', name: 'Speed', nameKey: 'tags.speed.name', description: 'Attack speed focused', descriptionKey: 'tags.speed.desc', category: 'mechanic', color: '#00ced1', icon: '⚡' },
  { id: 'range', name: 'Range', nameKey: 'tags.range.name', description: 'Long range attacks', descriptionKey: 'tags.range.desc', category: 'mechanic', color: '#9370db', icon: '🎯' },
  { id: 'aoe', name: 'AoE', nameKey: 'tags.aoe.name', description: 'Area of effect', descriptionKey: 'tags.aoe.desc', category: 'mechanic', color: '#ff8c00', icon: '🌟' },

  // Origin tags
  { id: 'starter', name: 'Starter', nameKey: 'tags.starter.name', description: 'Starter units', descriptionKey: 'tags.starter.desc', category: 'origin', color: '#808080', icon: '🌱' },
  { id: 'elite', name: 'Elite', nameKey: 'tags.elite.name', description: 'Rare/Epic units', descriptionKey: 'tags.elite.desc', category: 'origin', color: '#9932cc', icon: '⭐' },
  { id: 'legendary', name: 'Legendary', nameKey: 'tags.legendary.name', description: 'Legendary units', descriptionKey: 'tags.legendary.desc', category: 'origin', color: '#ffd700', icon: '👑' },
];

/**
 * Get tag definition by ID
 */
export function getTagById(tagId: SynergyTag): TagDefinition | undefined {
  return TAG_DEFINITIONS.find(t => t.id === tagId);
}

/**
 * Get tags by category
 */
export function getTagsByCategory(category: TagCategory): TagDefinition[] {
  return TAG_DEFINITIONS.filter(t => t.category === category);
}

// ============================================================================
// HERO TAGS
// ============================================================================

/**
 * Tags for each hero
 */
export const HERO_TAGS: Record<string, SynergyTag[]> = {
  // Starter heroes
  storm: ['lightning', 'dps', 'chain', 'speed', 'starter'],
  vanguard: ['natural', 'tank', 'shield', 'starter'],
  medic: ['tech', 'support', 'heal', 'starter'],
  pyro: ['fire', 'dps', 'burn', 'aoe', 'starter'],

  // Common/Rare heroes
  scout: ['natural', 'dps', 'crit', 'range', 'speed'],
  forge: ['tech', 'dps', 'range', 'splash', 'elite'],
  frost: ['ice', 'crowd_control', 'freeze', 'crit', 'range'],
  rift: ['fire', 'support', 'aoe', 'elite'],
  spectre: ['tech', 'dps', 'crit', 'speed', 'elite'],

  // Epic heroes
  titan: ['void', 'tank', 'aoe', 'elite'],
  inferno: ['fire', 'dps', 'burn', 'aoe', 'elite'],
  glacier: ['ice', 'tank', 'freeze', 'shield', 'elite'],

  // Legendary heroes
  omega: ['void', 'assassin', 'execute', 'crit', 'legendary'],
};

/**
 * Get tags for a hero
 */
export function getHeroTags(heroId: string): SynergyTag[] {
  return HERO_TAGS[heroId] || [];
}

// ============================================================================
// TURRET TAGS
// ============================================================================

/**
 * Tags for each turret type
 */
export const TURRET_TAGS: Record<string, SynergyTag[]> = {
  railgun: ['dps', 'speed', 'crit', 'range', 'starter'],
  cryo: ['ice', 'crowd_control', 'freeze'],
  artillery: ['splash', 'aoe', 'range'],
  arc: ['lightning', 'chain', 'aoe'],
};

/**
 * Get tags for a turret
 */
export function getTurretTags(turretId: string): SynergyTag[] {
  return TURRET_TAGS[turretId] || [];
}

// ============================================================================
// PERK TAGS
// ============================================================================

/**
 * Tags for each perk
 */
export const PERK_TAGS: Record<string, SynergyTag[]> = {
  fortress_regen: ['tank', 'heal'],
  gold_surge: ['dps'],
  xp_boost: ['support'],
  material_hunter: ['support'],
  energy_efficiency: ['support'],
  expedition_master: ['support'],
  critical_mastery: ['crit', 'dps'],
  armor_plating: ['tank', 'shield'],
  attack_speed_boost: ['speed', 'dps'],
  boss_slayer: ['dps', 'execute'],
  double_dust: ['support'],
  infinite_potential: ['dps', 'tank', 'support'],
};

/**
 * Get tags for a perk
 */
export function getPerkTags(perkId: string): SynergyTag[] {
  return PERK_TAGS[perkId] || [];
}

// ============================================================================
// SYNERGY BONUSES
// ============================================================================

/**
 * Synergy bonus definition
 */
export interface TagSynergyBonus {
  tag: SynergyTag;
  requiredCount: number;
  bonuses: {
    stat: string;
    value: number;
    isPercent: boolean;
  }[];
  name: string;
  nameKey: string;
  description: string;
  descriptionKey: string;
}

/**
 * All tag synergy bonuses
 * These bonuses activate when you have enough units with the same tag
 */
export const TAG_SYNERGY_BONUSES: TagSynergyBonus[] = [
  // Element synergies (2+ matching)
  {
    tag: 'fire',
    requiredCount: 2,
    bonuses: [{ stat: 'damageBonus', value: 0.15, isPercent: true }],
    name: 'Fire Affinity',
    nameKey: 'synergy.fireAffinity.name',
    description: '+15% damage with 2+ fire units',
    descriptionKey: 'synergy.fireAffinity.desc',
  },
  {
    tag: 'ice',
    requiredCount: 2,
    bonuses: [
      { stat: 'slowDuration', value: 0.20, isPercent: true },
      { stat: 'damageBonus', value: 0.10, isPercent: true },
    ],
    name: 'Frozen Heart',
    nameKey: 'synergy.frozenHeart.name',
    description: '+20% slow duration, +10% damage with 2+ ice units',
    descriptionKey: 'synergy.frozenHeart.desc',
  },
  {
    tag: 'lightning',
    requiredCount: 2,
    bonuses: [
      { stat: 'attackSpeedBonus', value: 0.15, isPercent: true },
      { stat: 'chainCount', value: 1, isPercent: false },
    ],
    name: 'Storm Surge',
    nameKey: 'synergy.stormSurge.name',
    description: '+15% attack speed, +1 chain target with 2+ lightning units',
    descriptionKey: 'synergy.stormSurge.desc',
  },
  {
    tag: 'tech',
    requiredCount: 2,
    bonuses: [
      { stat: 'rangeBonus', value: 0.10, isPercent: true },
      { stat: 'critChance', value: 0.05, isPercent: false },
    ],
    name: 'Tech Sync',
    nameKey: 'synergy.techSync.name',
    description: '+10% range, +5% crit chance with 2+ tech units',
    descriptionKey: 'synergy.techSync.desc',
  },
  {
    tag: 'void',
    requiredCount: 2,
    bonuses: [
      { stat: 'damageBonus', value: 0.20, isPercent: true },
      { stat: 'executeThreshold', value: 0.05, isPercent: false },
    ],
    name: 'Void Resonance',
    nameKey: 'synergy.voidResonance.name',
    description: '+20% damage, +5% execute threshold with 2+ void units',
    descriptionKey: 'synergy.voidResonance.desc',
  },
  {
    tag: 'natural',
    requiredCount: 2,
    bonuses: [
      { stat: 'maxHpBonus', value: 0.15, isPercent: true },
      { stat: 'hpRegen', value: 0.01, isPercent: true },
    ],
    name: 'Nature\'s Gift',
    nameKey: 'synergy.naturesGift.name',
    description: '+15% max HP, +1% HP regen with 2+ natural units',
    descriptionKey: 'synergy.naturesGift.desc',
  },

  // Role synergies (2+ matching)
  {
    tag: 'dps',
    requiredCount: 3,
    bonuses: [{ stat: 'damageBonus', value: 0.25, isPercent: true }],
    name: 'Firepower',
    nameKey: 'synergy.firepower.name',
    description: '+25% damage with 3+ DPS units',
    descriptionKey: 'synergy.firepower.desc',
  },
  {
    tag: 'tank',
    requiredCount: 2,
    bonuses: [
      { stat: 'incomingDamageReduction', value: 0.15, isPercent: true },
      { stat: 'maxHpBonus', value: 0.10, isPercent: true },
    ],
    name: 'Fortress Wall',
    nameKey: 'synergy.fortressWall.name',
    description: '+15% damage reduction, +10% HP with 2+ tanks',
    descriptionKey: 'synergy.fortressWall.desc',
  },
  {
    tag: 'support',
    requiredCount: 2,
    bonuses: [
      { stat: 'healBonus', value: 0.25, isPercent: true },
      { stat: 'cooldownReduction', value: 0.10, isPercent: true },
    ],
    name: 'Team Spirit',
    nameKey: 'synergy.teamSpirit.name',
    description: '+25% healing, +10% cooldown reduction with 2+ supports',
    descriptionKey: 'synergy.teamSpirit.desc',
  },

  // Mechanic synergies
  {
    tag: 'burn',
    requiredCount: 2,
    bonuses: [{ stat: 'burnDamageBonus', value: 0.30, isPercent: true }],
    name: 'Inferno',
    nameKey: 'synergy.inferno.name',
    description: '+30% burn damage with 2+ burn units',
    descriptionKey: 'synergy.inferno.desc',
  },
  {
    tag: 'crit',
    requiredCount: 2,
    bonuses: [
      { stat: 'critChance', value: 0.10, isPercent: false },
      { stat: 'critDamageBonus', value: 0.25, isPercent: true },
    ],
    name: 'Deadly Precision',
    nameKey: 'synergy.deadlyPrecision.name',
    description: '+10% crit chance, +25% crit damage with 2+ crit units',
    descriptionKey: 'synergy.deadlyPrecision.desc',
  },
  {
    tag: 'chain',
    requiredCount: 2,
    bonuses: [
      { stat: 'chainCount', value: 2, isPercent: false },
      { stat: 'chainDamagePercent', value: 0.10, isPercent: true },
    ],
    name: 'Chain Reaction',
    nameKey: 'synergy.chainReaction.name',
    description: '+2 chain targets, +10% chain damage with 2+ chain units',
    descriptionKey: 'synergy.chainReaction.desc',
  },
  {
    tag: 'aoe',
    requiredCount: 2,
    bonuses: [
      { stat: 'splashRadiusBonus', value: 0.20, isPercent: true },
      { stat: 'splashDamagePercent', value: 0.15, isPercent: true },
    ],
    name: 'Devastation',
    nameKey: 'synergy.devastation.name',
    description: '+20% splash radius, +15% splash damage with 2+ AoE units',
    descriptionKey: 'synergy.devastation.desc',
  },
  {
    tag: 'speed',
    requiredCount: 2,
    bonuses: [{ stat: 'attackSpeedBonus', value: 0.20, isPercent: true }],
    name: 'Rapid Assault',
    nameKey: 'synergy.rapidAssault.name',
    description: '+20% attack speed with 2+ speed units',
    descriptionKey: 'synergy.rapidAssault.desc',
  },

  // Origin synergies
  {
    tag: 'starter',
    requiredCount: 2,
    bonuses: [
      { stat: 'damageBonus', value: 0.10, isPercent: true },
      { stat: 'maxHpBonus', value: 0.05, isPercent: true },
    ],
    name: 'Starter Synergy',
    nameKey: 'synergy.starterSynergy.name',
    description: '+10% damage, +5% HP with 2+ starter units',
    descriptionKey: 'synergy.starterSynergy.desc',
  },
  {
    tag: 'elite',
    requiredCount: 3,
    bonuses: [
      { stat: 'damageBonus', value: 0.15, isPercent: true },
      { stat: 'attackSpeedBonus', value: 0.10, isPercent: true },
    ],
    name: 'Elite Force',
    nameKey: 'synergy.eliteForce.name',
    description: '+15% damage, +10% attack speed with 3+ elite units',
    descriptionKey: 'synergy.eliteForce.desc',
  },
  {
    tag: 'legendary',
    requiredCount: 2,
    bonuses: [
      { stat: 'damageBonus', value: 0.25, isPercent: true },
      { stat: 'critChance', value: 0.10, isPercent: false },
    ],
    name: 'Legendary Power',
    nameKey: 'synergy.legendaryPower.name',
    description: '+25% damage, +10% crit chance with 2+ legendary units',
    descriptionKey: 'synergy.legendaryPower.desc',
  },
];

/**
 * Get synergy bonuses for a tag
 */
export function getSynergyBonusesForTag(tag: SynergyTag): TagSynergyBonus[] {
  return TAG_SYNERGY_BONUSES.filter(b => b.tag === tag);
}

// ============================================================================
// SYNERGY CALCULATION
// ============================================================================

/**
 * Active synergy result
 */
export interface ActiveTagSynergy {
  synergy: TagSynergyBonus;
  count: number;
  isActive: boolean;
  contributors: Array<{
    type: 'hero' | 'turret' | 'perk';
    id: string;
  }>;
}

/**
 * Calculate active tag synergies based on current units
 */
export function calculateActiveTagSynergies(
  heroIds: string[],
  turretIds: string[],
  perkIds: string[]
): ActiveTagSynergy[] {
  // Count tags from all sources
  const tagCounts = new Map<SynergyTag, Array<{ type: 'hero' | 'turret' | 'perk'; id: string }>>();

  // Add hero tags
  for (const heroId of heroIds) {
    const tags = getHeroTags(heroId);
    for (const tag of tags) {
      const contributors = tagCounts.get(tag) || [];
      contributors.push({ type: 'hero', id: heroId });
      tagCounts.set(tag, contributors);
    }
  }

  // Add turret tags
  for (const turretId of turretIds) {
    const tags = getTurretTags(turretId);
    for (const tag of tags) {
      const contributors = tagCounts.get(tag) || [];
      contributors.push({ type: 'turret', id: turretId });
      tagCounts.set(tag, contributors);
    }
  }

  // Add perk tags
  for (const perkId of perkIds) {
    const tags = getPerkTags(perkId);
    for (const tag of tags) {
      const contributors = tagCounts.get(tag) || [];
      contributors.push({ type: 'perk', id: perkId });
      tagCounts.set(tag, contributors);
    }
  }

  // Check which synergies are active
  const activeSynergies: ActiveTagSynergy[] = [];

  for (const synergy of TAG_SYNERGY_BONUSES) {
    const contributors = tagCounts.get(synergy.tag) || [];
    const count = contributors.length;
    const isActive = count >= synergy.requiredCount;

    activeSynergies.push({
      synergy,
      count,
      isActive,
      contributors,
    });
  }

  return activeSynergies;
}

/**
 * Get only active synergies (for DPS display)
 */
export function getActiveSynergiesOnly(
  heroIds: string[],
  turretIds: string[],
  perkIds: string[]
): ActiveTagSynergy[] {
  return calculateActiveTagSynergies(heroIds, turretIds, perkIds)
    .filter(s => s.isActive);
}

/**
 * Calculate total bonuses from all active synergies
 */
export function calculateTotalSynergyBonuses(
  heroIds: string[],
  turretIds: string[],
  perkIds: string[]
): Record<string, number> {
  const bonuses: Record<string, number> = {};

  const activeSynergies = getActiveSynergiesOnly(heroIds, turretIds, perkIds);

  for (const { synergy } of activeSynergies) {
    for (const bonus of synergy.bonuses) {
      bonuses[bonus.stat] = (bonuses[bonus.stat] || 0) + bonus.value;
    }
  }

  return bonuses;
}

/**
 * Get synergies that are close to activating (need 1 more unit)
 */
export function getAlmostActiveSynergies(
  heroIds: string[],
  turretIds: string[],
  perkIds: string[]
): ActiveTagSynergy[] {
  return calculateActiveTagSynergies(heroIds, turretIds, perkIds)
    .filter(s => !s.isActive && s.count === s.synergy.requiredCount - 1);
}
