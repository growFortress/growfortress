/**
 * Colony Milestones - Production Goals with Rewards
 *
 * Players earn rewards for reaching production milestones.
 * These incentivize continued upgrades and provide a sense of progression.
 */

export interface ColonyMilestoneReward {
  gold?: number;
  dust?: number;
  material?: 'rare' | 'epic' | 'legendary';
  unlock?: string;
}

export interface ColonyMilestone {
  id: string;
  name: string;
  description: string;
  requirement: number; // gold/hour threshold
  reward: ColonyMilestoneReward;
}

export const COLONY_MILESTONES: ColonyMilestone[] = [
  {
    id: 'first_steps',
    name: 'First Steps',
    description: 'Reach 100 gold/hour production',
    requirement: 100,
    reward: { gold: 500 },
  },
  {
    id: 'growing_colony',
    name: 'Growing Colony',
    description: 'Reach 500 gold/hour production',
    requirement: 500,
    reward: { gold: 2000, dust: 50 },
  },
  {
    id: 'industrial_power',
    name: 'Industrial Power',
    description: 'Reach 2,000 gold/hour production',
    requirement: 2000,
    reward: { gold: 10000, material: 'rare' },
  },
  {
    id: 'economic_giant',
    name: 'Economic Giant',
    description: 'Reach 10,000 gold/hour production',
    requirement: 10000,
    reward: { gold: 50000, material: 'epic' },
  },
  {
    id: 'stellar_empire',
    name: 'Stellar Empire',
    description: 'Reach 50,000 gold/hour production',
    requirement: 50000,
    reward: { unlock: 'prestige', material: 'legendary' },
  },
];

/**
 * Get milestone by ID
 */
export function getColonyMilestoneById(id: string): ColonyMilestone | undefined {
  return COLONY_MILESTONES.find(m => m.id === id);
}

/**
 * Get all milestones that have been reached but not claimed
 */
export function getUnclaimedMilestones(
  goldPerHour: number,
  claimedIds: string[]
): ColonyMilestone[] {
  return COLONY_MILESTONES.filter(
    m => goldPerHour >= m.requirement && !claimedIds.includes(m.id)
  );
}

/**
 * Get the next milestone to reach
 */
export function getNextColonyMilestone(goldPerHour: number): ColonyMilestone | null {
  for (const milestone of COLONY_MILESTONES) {
    if (goldPerHour < milestone.requirement) {
      return milestone;
    }
  }
  return null;
}

/**
 * Get progress to next milestone (0-1)
 */
export function getMilestoneProgress(goldPerHour: number): { current: number; next: number; progress: number } | null {
  let previous = 0;
  for (const milestone of COLONY_MILESTONES) {
    if (goldPerHour < milestone.requirement) {
      return {
        current: goldPerHour,
        next: milestone.requirement,
        progress: (goldPerHour - previous) / (milestone.requirement - previous),
      };
    }
    previous = milestone.requirement;
  }
  // All milestones achieved
  return null;
}

/**
 * Check if prestige is unlocked via milestones
 */
export function isPrestigeUnlockedByMilestone(claimedIds: string[]): boolean {
  return claimedIds.includes('stellar_empire');
}

/**
 * Get all claimed milestones
 */
export function getClaimedMilestones(claimedIds: string[]): ColonyMilestone[] {
  return COLONY_MILESTONES.filter(m => claimedIds.includes(m.id));
}

/**
 * Check if a specific milestone can be claimed
 */
export function canClaimMilestone(milestoneId: string, goldPerHour: number, claimedIds: string[]): boolean {
  const milestone = getColonyMilestoneById(milestoneId);
  if (!milestone) return false;
  return goldPerHour >= milestone.requirement && !claimedIds.includes(milestone.id);
}
