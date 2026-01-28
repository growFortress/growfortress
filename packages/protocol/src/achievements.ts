import { z } from 'zod';

// ============================================================================
// ACHIEVEMENT CATEGORIES
// ============================================================================

export const AchievementCategorySchema = z.enum([
  'combat',      // Kills, damage, crits
  'progression', // Waves, levels, prestiges
  'collection',  // Heroes, artifacts, materials
  'economy',     // Gold earned, dust spent
  'pvp',         // Arena battles, wins
  'guild',       // Guild activities
  'challenge',   // Boss Rush, Pillar Challenge
  'mastery',     // Class mastery, skills
]);

export type AchievementCategory = z.infer<typeof AchievementCategorySchema>;

// ============================================================================
// ACHIEVEMENT IDS
// ============================================================================

export const AchievementIdSchema = z.enum([
  // Combat Category
  'enemy_slayer',        // Kill enemies
  'elite_hunter',        // Kill elite enemies
  'boss_destroyer',      // Kill bosses
  'critical_master',     // Land critical hits
  'damage_dealer',       // Deal total damage

  // Progression Category
  'wave_warrior',        // Complete waves
  'dedicated_player',    // Complete runs
  'level_up',            // Reach commander levels
  'prestige_master',     // Prestige count
  'tutorial_complete',   // Complete all tutorial steps

  // Collection Category
  'hero_collector',      // Unlock heroes
  'turret_engineer',     // Unlock turrets
  'artifact_hunter',     // Obtain artifacts
  'material_gatherer',   // Collect materials

  // Economy Category
  'gold_magnate',        // Earn gold lifetime
  'dust_investor',       // Spend dust

  // PvP Category
  'arena_fighter',       // Complete PvP battles
  'arena_champion',      // Win PvP battles

  // Guild Category
  'guild_contributor',   // Donate to guild
  'tower_climber',       // Contribute waves to Tower Race

  // Challenge Category
  'boss_rush_survivor',  // Complete Boss Rush cycles
  'pillar_conqueror',    // Complete Pillar Challenges
  'crystal_collector',   // Collect crystal fragments

  // Mastery Category
  'class_master',        // Spend mastery points
  'skill_activator',     // Activate skills in combat
  'synergy_user',        // Trigger hero synergies
]);

export type AchievementId = z.infer<typeof AchievementIdSchema>;

// ============================================================================
// TIER DEFINITIONS
// ============================================================================

export const AchievementTierSchema = z.object({
  tier: z.number().int().min(1).max(30),
  target: z.number().int().positive(),
  dustReward: z.number().int().min(0),
  goldReward: z.number().int().min(0),
  materialReward: z.object({
    rarity: z.enum(['rare', 'epic', 'legendary']),
    count: z.number().int().min(0),
  }).nullable(),
  titleReward: z.string().nullable(),
});

export type AchievementTier = z.infer<typeof AchievementTierSchema>;

// ============================================================================
// ACHIEVEMENT DEFINITION
// ============================================================================

export const AchievementDefinitionSchema = z.object({
  id: AchievementIdSchema,
  category: AchievementCategorySchema,
  name: z.string(),
  description: z.string(),
  icon: z.string(),
  statKey: z.string(),
  tiers: z.array(AchievementTierSchema),
});

export type AchievementDefinition = z.infer<typeof AchievementDefinitionSchema>;

// ============================================================================
// PLAYER PROGRESS
// ============================================================================

export const AchievementProgressSchema = z.object({
  achievementId: AchievementIdSchema,
  currentTier: z.number().int().min(0),
  currentProgress: z.number().int().min(0),
  currentTarget: z.number().int().positive(),
  nextTier: z.number().int().nullable(),
  claimedTiers: z.array(z.number().int().min(1)),
  hasUnclaimedReward: z.boolean(),
});

export type AchievementProgress = z.infer<typeof AchievementProgressSchema>;

// ============================================================================
// LIFETIME STATS
// ============================================================================

export const LifetimeStatsSchema = z.object({
  totalKills: z.number().int().min(0).default(0),
  eliteKills: z.number().int().min(0).default(0),
  bossKills: z.number().int().min(0).default(0),
  wavesCompleted: z.number().int().min(0).default(0),
  runsCompleted: z.number().int().min(0).default(0),
  goldEarned: z.string().default('0'),
  dustSpent: z.number().int().min(0).default(0),
  heroesUnlocked: z.number().int().min(0).default(0),
  turretsUnlocked: z.number().int().min(0).default(0),
  artifactsObtained: z.number().int().min(0).default(0),
  pvpBattles: z.number().int().min(0).default(0),
  pvpVictories: z.number().int().min(0).default(0),
  guildBattles: z.number().int().min(0).default(0),
  bossRushCycles: z.number().int().min(0).default(0),
  pillarChallengesCompleted: z.number().int().min(0).default(0),
  materialsCollected: z.number().int().min(0).default(0),
  relicsChosen: z.number().int().min(0).default(0),
  skillsActivated: z.number().int().min(0).default(0),
  damageDealt: z.string().default('0'),
  criticalHits: z.number().int().min(0).default(0),
  guildDonations: z.number().int().min(0).default(0),
  towerRaceWaves: z.number().int().min(0).default(0),
  crystalFragments: z.number().int().min(0).default(0),
  masteryPoints: z.number().int().min(0).default(0),
  synergiesTriggered: z.number().int().min(0).default(0),
  commanderLevel: z.number().int().min(1).default(1),
  prestigeCount: z.number().int().min(0).default(0),
  tutorialsCompleted: z.number().int().min(0).default(0),
});

export type LifetimeStats = z.infer<typeof LifetimeStatsSchema>;

// ============================================================================
// API SCHEMAS
// ============================================================================

export const GetAchievementsResponseSchema = z.object({
  achievements: z.array(z.object({
    definition: AchievementDefinitionSchema,
    progress: AchievementProgressSchema,
  })),
  lifetimeStats: LifetimeStatsSchema,
  unlockedTitles: z.array(z.string()),
  activeTitle: z.string().nullable(),
  totalUnclaimedRewards: z.number().int().min(0),
  categoryProgress: z.record(AchievementCategorySchema, z.object({
    completed: z.number().int().min(0),
    total: z.number().int().min(0),
  })),
});

export type GetAchievementsResponse = z.infer<typeof GetAchievementsResponseSchema>;

export const ClaimAchievementRewardRequestSchema = z.object({
  achievementId: AchievementIdSchema,
  tier: z.number().int().min(1),
});

export type ClaimAchievementRewardRequest = z.infer<typeof ClaimAchievementRewardRequestSchema>;

export const ClaimAchievementRewardResponseSchema = z.object({
  success: z.boolean(),
  dustAwarded: z.number().int().min(0),
  goldAwarded: z.number().int().min(0),
  materialsAwarded: z.record(z.string(), z.number().int().min(0)),
  titleUnlocked: z.string().nullable(),
  newInventory: z.object({
    dust: z.number().int().min(0),
    gold: z.number().int().min(0),
    materials: z.record(z.string(), z.number().int().min(0)),
  }),
  error: z.string().optional(),
});

export type ClaimAchievementRewardResponse = z.infer<typeof ClaimAchievementRewardResponseSchema>;

export const ClaimAllAchievementsResponseSchema = z.object({
  success: z.boolean(),
  claimedCount: z.number().int().min(0),
  totalDustAwarded: z.number().int().min(0),
  totalGoldAwarded: z.number().int().min(0),
  materialsAwarded: z.record(z.string(), z.number().int().min(0)),
  titlesUnlocked: z.array(z.string()),
  newInventory: z.object({
    dust: z.number().int().min(0),
    gold: z.number().int().min(0),
    materials: z.record(z.string(), z.number().int().min(0)),
  }),
  error: z.string().optional(),
});

export type ClaimAllAchievementsResponse = z.infer<typeof ClaimAllAchievementsResponseSchema>;

export const SetActiveTitleRequestSchema = z.object({
  title: z.string().nullable(),
});

export type SetActiveTitleRequest = z.infer<typeof SetActiveTitleRequestSchema>;

export const SetActiveTitleResponseSchema = z.object({
  success: z.boolean(),
  activeTitle: z.string().nullable(),
  error: z.string().optional(),
});

export type SetActiveTitleResponse = z.infer<typeof SetActiveTitleResponseSchema>;

// ============================================================================
// ERROR CODES
// ============================================================================

export const ACHIEVEMENT_ERROR_CODES = {
  ACHIEVEMENT_NOT_FOUND: 'ACHIEVEMENT_NOT_FOUND',
  TIER_NOT_REACHED: 'TIER_NOT_REACHED',
  TIER_ALREADY_CLAIMED: 'TIER_ALREADY_CLAIMED',
  NO_UNCLAIMED_REWARDS: 'NO_UNCLAIMED_REWARDS',
  TITLE_NOT_UNLOCKED: 'TITLE_NOT_UNLOCKED',
} as const;

export type AchievementErrorCode = keyof typeof ACHIEVEMENT_ERROR_CODES;

// ============================================================================
// ACHIEVEMENT DEFINITIONS (STATIC DATA)
// ============================================================================

/**
 * Generate tiered targets using logarithmic scaling
 * Hero Zero style: 100, 500, 2500, 10000, 50000...
 */
function generateTiers(
  baseTarget: number,
  multipliers: number[],
  dustBase: number,
  goldBase: number,
  titleTier?: number,
  titleName?: string
): AchievementTier[] {
  return multipliers.map((mult, index) => ({
    tier: index + 1,
    target: Math.round(baseTarget * mult),
    dustReward: Math.round(dustBase * (index + 1)),
    goldReward: Math.round(goldBase * Math.pow(1.5, index)),
    materialReward: index >= 4
      ? { rarity: (index >= 8 ? 'legendary' : index >= 6 ? 'epic' : 'rare') as 'rare' | 'epic' | 'legendary', count: 1 }
      : null,
    titleReward: titleTier && index + 1 === titleTier ? titleName! : null,
  }));
}

// Standard multipliers for 10 tiers
const STANDARD_MULTIPLIERS = [1, 5, 25, 100, 500, 2000, 10000, 50000, 200000, 1000000];

export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  // ===== COMBAT CATEGORY =====
  {
    id: 'enemy_slayer',
    category: 'combat',
    name: 'Enemy Slayer',
    description: 'Defeat {current}/{target} enemies',
    icon: 'sword',
    statKey: 'totalKills',
    tiers: generateTiers(100, STANDARD_MULTIPLIERS, 5, 100, 10, 'Destroyer'),
  },
  {
    id: 'elite_hunter',
    category: 'combat',
    name: 'Elite Hunter',
    description: 'Defeat {current}/{target} elite enemies',
    icon: 'skull',
    statKey: 'eliteKills',
    tiers: generateTiers(10, [1, 5, 20, 75, 250, 1000, 5000, 20000, 100000, 500000], 8, 150, 8, 'Elite Hunter'),
  },
  {
    id: 'boss_destroyer',
    category: 'combat',
    name: 'Boss Destroyer',
    description: 'Defeat {current}/{target} bosses',
    icon: 'dragon',
    statKey: 'bossKills',
    tiers: generateTiers(5, [1, 4, 15, 50, 150, 500, 2000, 10000, 50000, 200000], 10, 200, 7, 'Slayer'),
  },
  {
    id: 'critical_master',
    category: 'combat',
    name: 'Critical Master',
    description: 'Land {current}/{target} critical hits',
    icon: 'lightning',
    statKey: 'criticalHits',
    tiers: generateTiers(50, STANDARD_MULTIPLIERS, 4, 80),
  },
  {
    id: 'damage_dealer',
    category: 'combat',
    name: 'Damage Dealer',
    description: 'Deal {current}/{target} total damage',
    icon: 'fire',
    statKey: 'damageDealt',
    tiers: generateTiers(10000, [1, 10, 100, 1000, 10000, 100000, 1000000, 10000000, 100000000, 1000000000], 6, 120, 10, 'Annihilator'),
  },

  // ===== PROGRESSION CATEGORY =====
  {
    id: 'wave_warrior',
    category: 'progression',
    name: 'Wave Warrior',
    description: 'Complete {current}/{target} waves',
    icon: 'waves',
    statKey: 'wavesCompleted',
    tiers: generateTiers(50, STANDARD_MULTIPLIERS, 5, 100, 10, 'Veteran'),
  },
  {
    id: 'dedicated_player',
    category: 'progression',
    name: 'Dedicated Player',
    description: 'Complete {current}/{target} runs',
    icon: 'gamepad',
    statKey: 'runsCompleted',
    tiers: generateTiers(5, [1, 5, 20, 50, 150, 500, 1500, 5000, 15000, 50000], 6, 150, 6, 'Devoted'),
  },
  {
    id: 'level_up',
    category: 'progression',
    name: 'Level Up',
    description: 'Reach Commander Level {target}',
    icon: 'arrow-up',
    statKey: 'commanderLevel',
    tiers: [
      { tier: 1, target: 5, dustReward: 10, goldReward: 200, materialReward: null, titleReward: null },
      { tier: 2, target: 10, dustReward: 15, goldReward: 400, materialReward: null, titleReward: null },
      { tier: 3, target: 25, dustReward: 25, goldReward: 800, materialReward: null, titleReward: 'Commander' },
      { tier: 4, target: 50, dustReward: 40, goldReward: 1500, materialReward: { rarity: 'rare', count: 1 }, titleReward: null },
      { tier: 5, target: 100, dustReward: 60, goldReward: 3000, materialReward: { rarity: 'epic', count: 1 }, titleReward: 'General' },
      { tier: 6, target: 150, dustReward: 80, goldReward: 5000, materialReward: { rarity: 'epic', count: 2 }, titleReward: null },
      { tier: 7, target: 200, dustReward: 100, goldReward: 8000, materialReward: { rarity: 'legendary', count: 1 }, titleReward: 'Legendary Commander' },
    ],
  },
  {
    id: 'prestige_master',
    category: 'progression',
    name: 'Prestige Master',
    description: 'Prestige {current}/{target} times',
    icon: 'star',
    statKey: 'prestigeCount',
    tiers: [
      { tier: 1, target: 1, dustReward: 20, goldReward: 500, materialReward: null, titleReward: 'Reborn' },
      { tier: 2, target: 3, dustReward: 35, goldReward: 1000, materialReward: { rarity: 'rare', count: 1 }, titleReward: null },
      { tier: 3, target: 5, dustReward: 50, goldReward: 2000, materialReward: { rarity: 'epic', count: 1 }, titleReward: 'Eternal' },
      { tier: 4, target: 10, dustReward: 75, goldReward: 4000, materialReward: { rarity: 'legendary', count: 1 }, titleReward: 'Transcendent' },
    ],
  },
  {
    id: 'tutorial_complete',
    category: 'progression',
    name: 'Tutorial Master',
    description: 'Complete all tutorial steps',
    icon: 'graduation-cap',
    statKey: 'tutorialsCompleted',
    tiers: [
      { tier: 1, target: 17, dustReward: 25, goldReward: 500, materialReward: null, titleReward: 'Tutorial Master' },
    ],
  },

  // ===== COLLECTION CATEGORY =====
  {
    id: 'hero_collector',
    category: 'collection',
    name: 'Hero Collector',
    description: 'Unlock {current}/{target} heroes',
    icon: 'users',
    statKey: 'heroesUnlocked',
    tiers: [
      { tier: 1, target: 3, dustReward: 10, goldReward: 200, materialReward: null, titleReward: null },
      { tier: 2, target: 5, dustReward: 15, goldReward: 400, materialReward: null, titleReward: null },
      { tier: 3, target: 10, dustReward: 25, goldReward: 800, materialReward: { rarity: 'rare', count: 1 }, titleReward: 'Hero Gatherer' },
      { tier: 4, target: 15, dustReward: 40, goldReward: 1500, materialReward: { rarity: 'epic', count: 1 }, titleReward: null },
      { tier: 5, target: 20, dustReward: 60, goldReward: 3000, materialReward: { rarity: 'legendary', count: 1 }, titleReward: 'Hero Master' },
    ],
  },
  {
    id: 'turret_engineer',
    category: 'collection',
    name: 'Turret Engineer',
    description: 'Unlock {current}/{target} turrets',
    icon: 'turret',
    statKey: 'turretsUnlocked',
    tiers: [
      { tier: 1, target: 2, dustReward: 10, goldReward: 200, materialReward: null, titleReward: null },
      { tier: 2, target: 4, dustReward: 15, goldReward: 400, materialReward: null, titleReward: null },
      { tier: 3, target: 6, dustReward: 25, goldReward: 800, materialReward: { rarity: 'rare', count: 1 }, titleReward: 'Engineer' },
      { tier: 4, target: 8, dustReward: 40, goldReward: 1500, materialReward: { rarity: 'epic', count: 1 }, titleReward: null },
    ],
  },
  {
    id: 'artifact_hunter',
    category: 'collection',
    name: 'Artifact Hunter',
    description: 'Obtain {current}/{target} artifacts',
    icon: 'artifact',
    statKey: 'artifactsObtained',
    tiers: generateTiers(5, [1, 2, 5, 10, 20, 40, 80, 150, 300, 500], 8, 150, 7, 'Relic Keeper'),
  },
  {
    id: 'material_gatherer',
    category: 'collection',
    name: 'Material Gatherer',
    description: 'Collect {current}/{target} materials',
    icon: 'package',
    statKey: 'materialsCollected',
    tiers: generateTiers(50, STANDARD_MULTIPLIERS, 4, 80),
  },

  // ===== ECONOMY CATEGORY =====
  {
    id: 'gold_magnate',
    category: 'economy',
    name: 'Gold Magnate',
    description: 'Earn {current}/{target} gold lifetime',
    icon: 'coins',
    statKey: 'goldEarned',
    tiers: generateTiers(10000, [1, 5, 25, 100, 500, 2500, 10000, 50000, 250000, 1000000], 5, 0, 10, 'Tycoon'),
  },
  {
    id: 'dust_investor',
    category: 'economy',
    name: 'Dust Investor',
    description: 'Spend {current}/{target} dust',
    icon: 'sparkles',
    statKey: 'dustSpent',
    tiers: generateTiers(100, [1, 5, 25, 100, 500, 2000, 10000, 50000, 200000, 1000000], 3, 150, 8, 'Big Spender'),
  },

  // ===== PVP CATEGORY =====
  {
    id: 'arena_fighter',
    category: 'pvp',
    name: 'Arena Fighter',
    description: 'Complete {current}/{target} PvP battles',
    icon: 'swords',
    statKey: 'pvpBattles',
    tiers: generateTiers(10, [1, 5, 20, 50, 150, 500, 1500, 5000, 15000, 50000], 6, 150, 5, 'Gladiator'),
  },
  {
    id: 'arena_champion',
    category: 'pvp',
    name: 'Arena Champion',
    description: 'Win {current}/{target} PvP battles',
    icon: 'trophy',
    statKey: 'pvpVictories',
    tiers: generateTiers(5, [1, 5, 15, 40, 100, 300, 1000, 3000, 10000, 30000], 8, 200, 7, 'Champion'),
  },

  // ===== GUILD CATEGORY =====
  {
    id: 'guild_contributor',
    category: 'guild',
    name: 'Guild Contributor',
    description: 'Donate {current}/{target} gold to your guild',
    icon: 'handshake',
    statKey: 'guildDonations',
    tiers: generateTiers(1000, [1, 5, 25, 100, 500, 2000, 10000, 50000, 200000, 1000000], 5, 0, 6, 'Benefactor'),
  },
  {
    id: 'tower_climber',
    category: 'guild',
    name: 'Tower Climber',
    description: 'Contribute {current}/{target} waves to Tower Race',
    icon: 'tower',
    statKey: 'towerRaceWaves',
    tiers: generateTiers(100, STANDARD_MULTIPLIERS, 6, 120, 8, 'Tower Champion'),
  },

  // ===== CHALLENGE CATEGORY =====
  {
    id: 'boss_rush_survivor',
    category: 'challenge',
    name: 'Boss Rush Survivor',
    description: 'Complete {current}/{target} Boss Rush cycles',
    icon: 'flame',
    statKey: 'bossRushCycles',
    tiers: generateTiers(1, [1, 3, 10, 30, 100, 300, 1000, 3000, 10000, 30000], 10, 250, 5, 'Rush Master'),
  },
  {
    id: 'pillar_conqueror',
    category: 'challenge',
    name: 'Pillar Conqueror',
    description: 'Complete {current}/{target} Pillar Challenges',
    icon: 'pillar',
    statKey: 'pillarChallengesCompleted',
    tiers: generateTiers(5, [1, 3, 10, 30, 100, 300, 1000, 3000, 10000, 30000], 10, 250, 6, 'Pillar Master'),
  },
  {
    id: 'crystal_collector',
    category: 'challenge',
    name: 'Crystal Collector',
    description: 'Collect {current}/{target} crystal fragments',
    icon: 'gem',
    statKey: 'crystalFragments',
    tiers: generateTiers(10, [1, 5, 20, 60, 200, 600, 2000, 6000, 20000, 60000], 8, 200, 8, 'Crystal Keeper'),
  },

  // ===== MASTERY CATEGORY =====
  {
    id: 'class_master',
    category: 'mastery',
    name: 'Class Master',
    description: 'Spend {current}/{target} mastery points',
    icon: 'book',
    statKey: 'masteryPoints',
    tiers: generateTiers(10, [1, 5, 20, 50, 150, 500, 1500, 5000, 15000, 50000], 6, 150, 6, 'Scholar'),
  },
  {
    id: 'skill_activator',
    category: 'mastery',
    name: 'Skill Activator',
    description: 'Activate skills {current}/{target} times',
    icon: 'target',
    statKey: 'skillsActivated',
    tiers: generateTiers(50, STANDARD_MULTIPLIERS, 4, 80),
  },
  {
    id: 'synergy_user',
    category: 'mastery',
    name: 'Synergy User',
    description: 'Trigger hero synergies {current}/{target} times',
    icon: 'link',
    statKey: 'synergiesTriggered',
    tiers: generateTiers(25, [1, 4, 15, 50, 200, 750, 3000, 12000, 50000, 200000], 5, 100, 7, 'Synergist'),
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getAchievementById(id: AchievementId): AchievementDefinition | undefined {
  return ACHIEVEMENT_DEFINITIONS.find(a => a.id === id);
}

export function getAchievementsByCategory(category: AchievementCategory): AchievementDefinition[] {
  return ACHIEVEMENT_DEFINITIONS.filter(a => a.category === category);
}

export function getTotalTiers(): number {
  return ACHIEVEMENT_DEFINITIONS.reduce((sum, a) => sum + a.tiers.length, 0);
}

export function getTotalDustRewards(): number {
  return ACHIEVEMENT_DEFINITIONS.reduce(
    (sum, a) => sum + a.tiers.reduce((tierSum, t) => tierSum + t.dustReward, 0),
    0
  );
}

export function getAllTitles(): string[] {
  const titles: string[] = [];
  for (const achievement of ACHIEVEMENT_DEFINITIONS) {
    for (const tier of achievement.tiers) {
      if (tier.titleReward) {
        titles.push(tier.titleReward);
      }
    }
  }
  return titles;
}
