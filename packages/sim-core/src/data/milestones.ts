/**
 * Milestone System
 *
 * Permanent unlocks and bonuses for reaching wave thresholds.
 * Provides long-term goals and meaningful rewards.
 */

export type MilestoneReward =
  | { type: 'global_multiplier'; stat: 'gold' | 'damage' | 'hp'; value: number }
  | { type: 'unlock_feature'; feature: string }
  | { type: 'permanent_upgrade'; upgrade: string }
  | { type: 'hero_slot'; count: number };

export interface Milestone {
  id: string;
  wave: number;
  name: string;
  description: string;
  reward: MilestoneReward;
}

/**
 * All milestones in the game
 * Spacing follows logarithmic pattern - bigger gaps at higher waves
 */
export const MILESTONES: Milestone[] = [
  // Early game (Wave 1-100)
  {
    id: 'first_blood',
    wave: 10,
    name: 'Pierwsza Krew',
    description: 'Ukończ falę 10',
    reward: { type: 'global_multiplier', stat: 'gold', value: 1.05 },
  },
  {
    id: 'survivor',
    wave: 25,
    name: 'Przetrwaniec',
    description: '+10% gold permanentnie',
    reward: { type: 'global_multiplier', stat: 'gold', value: 1.10 },
  },
  {
    id: 'defender',
    wave: 50,
    name: 'Obrońca',
    description: 'Odblokuj 4. slot bohatera',
    reward: { type: 'hero_slot', count: 1 },
  },
  {
    id: 'centurion',
    wave: 100,
    name: 'Centurion',
    description: 'Odblokuj tryby wyzwań',
    reward: { type: 'unlock_feature', feature: 'challenge_modes' },
  },

  // Mid game (Wave 101-500)
  {
    id: 'elite_slayer',
    wave: 150,
    name: 'Pogromca Elit',
    description: '+10% damage do elit',
    reward: { type: 'global_multiplier', stat: 'damage', value: 1.10 },
  },
  {
    id: 'veteran',
    wave: 250,
    name: 'Weteran',
    description: '+15% damage permanentnie',
    reward: { type: 'global_multiplier', stat: 'damage', value: 1.15 },
  },
  {
    id: 'fortress_master',
    wave: 350,
    name: 'Mistrz Twierdzy',
    description: '+10% HP twierdzy',
    reward: { type: 'global_multiplier', stat: 'hp', value: 1.10 },
  },
  {
    id: 'legend',
    wave: 500,
    name: 'Legenda',
    description: 'Odblokuj Kopalnię (offline gold)',
    reward: { type: 'unlock_feature', feature: 'colony_mine' },
  },

  // Late game (Wave 501-1000)
  {
    id: 'epoch_hero',
    wave: 750,
    name: 'Bohater Epoki',
    description: 'Odblokuj 5. slot bohatera',
    reward: { type: 'hero_slot', count: 1 },
  },
  {
    id: 'thousander',
    wave: 1000,
    name: 'Tysiącznik',
    description: '+25% gold permanentnie',
    reward: { type: 'global_multiplier', stat: 'gold', value: 1.25 },
  },

  // End game (Wave 1001+)
  {
    id: 'demigod',
    wave: 2500,
    name: 'Półbóg',
    description: '+20% HP wszystkim jednostkom',
    reward: { type: 'global_multiplier', stat: 'hp', value: 1.20 },
  },
  {
    id: 'transcendent',
    wave: 5000,
    name: 'Transcendentny',
    description: 'Auto-aktywacja skilli',
    reward: { type: 'permanent_upgrade', upgrade: 'auto_ability' },
  },
  {
    id: 'god',
    wave: 10000,
    name: 'Bóg',
    description: '+50% damage permanentnie',
    reward: { type: 'global_multiplier', stat: 'damage', value: 1.50 },
  },
  {
    id: 'eternal',
    wave: 25000,
    name: 'Wieczny',
    description: 'Odblokuj 6. slot bohatera',
    reward: { type: 'hero_slot', count: 1 },
  },
  {
    id: 'primordial',
    wave: 50000,
    name: 'Prastary',
    description: '+100% gold permanentnie',
    reward: { type: 'global_multiplier', stat: 'gold', value: 2.0 },
  },
];

/**
 * Get milestone by ID
 */
export function getMilestoneById(id: string): Milestone | undefined {
  return MILESTONES.find(m => m.id === id);
}

/**
 * Get milestone for a specific wave
 */
export function getMilestoneForWave(wave: number): Milestone | undefined {
  return MILESTONES.find(m => m.wave === wave);
}

/**
 * Get all milestones up to a wave
 */
export function getMilestonesUpToWave(wave: number): Milestone[] {
  return MILESTONES.filter(m => m.wave <= wave);
}

/**
 * Get next milestone after current wave
 */
export function getNextMilestone(currentWave: number): Milestone | undefined {
  return MILESTONES.find(m => m.wave > currentWave);
}

/**
 * Check if a milestone is achieved
 */
export function isMilestoneAchieved(milestone: Milestone, highestWave: number): boolean {
  return highestWave >= milestone.wave;
}

/**
 * Calculate total gold multiplier from achieved milestones
 */
export function calculateGoldMultiplierFromMilestones(highestWave: number): number {
  let multiplier = 1.0;
  for (const milestone of getMilestonesUpToWave(highestWave)) {
    if (milestone.reward.type === 'global_multiplier' && milestone.reward.stat === 'gold') {
      multiplier *= milestone.reward.value;
    }
  }
  return multiplier;
}

/**
 * Calculate total damage multiplier from achieved milestones
 */
export function calculateDamageMultiplierFromMilestones(highestWave: number): number {
  let multiplier = 1.0;
  for (const milestone of getMilestonesUpToWave(highestWave)) {
    if (milestone.reward.type === 'global_multiplier' && milestone.reward.stat === 'damage') {
      multiplier *= milestone.reward.value;
    }
  }
  return multiplier;
}

/**
 * Calculate total HP multiplier from achieved milestones
 */
export function calculateHpMultiplierFromMilestones(highestWave: number): number {
  let multiplier = 1.0;
  for (const milestone of getMilestonesUpToWave(highestWave)) {
    if (milestone.reward.type === 'global_multiplier' && milestone.reward.stat === 'hp') {
      multiplier *= milestone.reward.value;
    }
  }
  return multiplier;
}

/**
 * Get total hero slots from milestones
 */
export function getHeroSlotsFromMilestones(highestWave: number): number {
  let slots = 0;
  for (const milestone of getMilestonesUpToWave(highestWave)) {
    if (milestone.reward.type === 'hero_slot') {
      slots += milestone.reward.count;
    }
  }
  return slots;
}

/**
 * Get unlocked features from milestones
 */
export function getUnlockedFeaturesFromMilestones(highestWave: number): string[] {
  const features: string[] = [];
  for (const milestone of getMilestonesUpToWave(highestWave)) {
    if (milestone.reward.type === 'unlock_feature') {
      features.push(milestone.reward.feature);
    }
  }
  return features;
}

/**
 * Check if a feature is unlocked
 */
export function isFeatureUnlocked(feature: string, highestWave: number): boolean {
  return getUnlockedFeaturesFromMilestones(highestWave).includes(feature);
}
