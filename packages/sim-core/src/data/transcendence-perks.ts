/**
 * Transcendence Perks
 *
 * Permanent bonuses unlocked through the expanded prestige system.
 * Players can choose perks after reaching Transcendence Level 1+.
 */

export interface TranscendencePerk {
  id: string;
  name: string;
  description: string;
  effect: TranscendencePerkEffect;
  tier: 1 | 2 | 3; // Tier 1 = common, Tier 2 = rare, Tier 3 = legendary
  requiredTranscendence: number; // Minimum transcendence level to unlock
}

export type TranscendencePerkEffect =
  | { type: 'stat_bonus'; stat: string; value: number; isPercent: boolean }
  | { type: 'resource_multiplier'; resource: 'gold' | 'dust' | 'xp' | 'materials'; value: number }
  | { type: 'expedition_bonus'; bonus: number }
  | { type: 'energy_bonus'; bonus: number }
  | { type: 'special'; specialId: string };

export const TRANSCENDENCE_PERKS: TranscendencePerk[] = [
  // Tier 1 - Common perks (unlocked at Transcendence 1)
  {
    id: 'fortress_regen',
    name: 'Fortress Regeneration',
    description: 'Fortress regenerates 1% HP per second during battles',
    effect: { type: 'special', specialId: 'fortress_regen' },
    tier: 1,
    requiredTranscendence: 1,
  },
  {
    id: 'gold_surge',
    name: 'Gold Surge',
    description: '+50% gold from elite enemies',
    effect: { type: 'resource_multiplier', resource: 'gold', value: 0.5 },
    tier: 1,
    requiredTranscendence: 1,
  },
  {
    id: 'xp_boost',
    name: 'Experience Boost',
    description: '+25% commander XP from all sources',
    effect: { type: 'resource_multiplier', resource: 'xp', value: 0.25 },
    tier: 1,
    requiredTranscendence: 1,
  },
  {
    id: 'material_hunter',
    name: 'Material Hunter',
    description: '+25% material drop rate',
    effect: { type: 'resource_multiplier', resource: 'materials', value: 0.25 },
    tier: 1,
    requiredTranscendence: 1,
  },
  {
    id: 'energy_efficiency',
    name: 'Energy Efficiency',
    description: '+1 maximum energy capacity',
    effect: { type: 'energy_bonus', bonus: 1 },
    tier: 1,
    requiredTranscendence: 1,
  },

  // Tier 2 - Rare perks (unlocked at Transcendence 2)
  {
    id: 'expedition_master',
    name: 'Expedition Master',
    description: '+25% expedition rewards',
    effect: { type: 'expedition_bonus', bonus: 0.25 },
    tier: 2,
    requiredTranscendence: 2,
  },
  {
    id: 'critical_mastery',
    name: 'Critical Mastery',
    description: '+10% critical hit chance for all units',
    effect: { type: 'stat_bonus', stat: 'critChance', value: 10, isPercent: false },
    tier: 2,
    requiredTranscendence: 2,
  },
  {
    id: 'armor_plating',
    name: 'Armor Plating',
    description: '+15% armor for fortress',
    effect: { type: 'stat_bonus', stat: 'armor', value: 15, isPercent: true },
    tier: 2,
    requiredTranscendence: 2,
  },
  {
    id: 'attack_speed_boost',
    name: 'Rapid Fire',
    description: '+10% attack speed for all units',
    effect: { type: 'stat_bonus', stat: 'attackSpeed', value: 10, isPercent: true },
    tier: 2,
    requiredTranscendence: 2,
  },

  // Tier 3 - Legendary perks (unlocked at Transcendence 4)
  {
    id: 'boss_slayer',
    name: 'Boss Slayer',
    description: '+25% damage against bosses',
    effect: { type: 'special', specialId: 'boss_slayer' },
    tier: 3,
    requiredTranscendence: 4,
  },
  {
    id: 'double_dust',
    name: 'Dust Doubler',
    description: '+100% cosmic dust from all sources',
    effect: { type: 'resource_multiplier', resource: 'dust', value: 1.0 },
    tier: 3,
    requiredTranscendence: 4,
  },
  {
    id: 'infinite_potential',
    name: 'Infinite Potential',
    description: '+5% to all stats permanently',
    effect: { type: 'stat_bonus', stat: 'all', value: 5, isPercent: true },
    tier: 3,
    requiredTranscendence: 4,
  },
];

/**
 * Get perk by ID
 */
export function getPerkById(perkId: string): TranscendencePerk | undefined {
  return TRANSCENDENCE_PERKS.find((p) => p.id === perkId);
}

/**
 * Get perks available at a given transcendence level
 */
export function getAvailablePerks(transcendenceLevel: number): TranscendencePerk[] {
  return TRANSCENDENCE_PERKS.filter((p) => p.requiredTranscendence <= transcendenceLevel);
}

/**
 * Calculate total bonus from perks
 */
export function calculatePerkBonuses(perkIds: string[]): {
  statBonuses: Record<string, number>;
  resourceMultipliers: Record<string, number>;
  expeditionBonus: number;
  energyBonus: number;
  specialPerks: string[];
} {
  const result = {
    statBonuses: {} as Record<string, number>,
    resourceMultipliers: { gold: 0, dust: 0, xp: 0, materials: 0 },
    expeditionBonus: 0,
    energyBonus: 0,
    specialPerks: [] as string[],
  };

  for (const perkId of perkIds) {
    const perk = getPerkById(perkId);
    if (!perk) continue;

    switch (perk.effect.type) {
      case 'stat_bonus':
        result.statBonuses[perk.effect.stat] =
          (result.statBonuses[perk.effect.stat] || 0) + perk.effect.value;
        break;
      case 'resource_multiplier':
        result.resourceMultipliers[perk.effect.resource] += perk.effect.value;
        break;
      case 'expedition_bonus':
        result.expeditionBonus += perk.effect.bonus;
        break;
      case 'energy_bonus':
        result.energyBonus += perk.effect.bonus;
        break;
      case 'special':
        result.specialPerks.push(perk.effect.specialId);
        break;
    }
  }

  return result;
}

// Prestige system constants
export const MAX_PRESTIGE_LEVEL = 5; // Max prestige per stat
export const PRESTIGE_BONUS_PER_LEVEL = 0.05; // +5% per prestige level

export const MAX_ASCENSION_LEVEL = 10;
export const ASCENSION_BONUS_PER_LEVEL = 0.10; // +10% global per ascension

export const MAX_TRANSCENDENCE_LEVEL = 5;
export const TRANSCENDENCE_BONUS_PER_LEVEL = 0.05; // +5% all stats per transcendence

export const ESSENCE_PER_TRANSCENDENCE = 100; // Essence earned per transcendence
