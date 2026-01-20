/**
 * Guild Battle Trophies - Achievement system for Arena 5v5
 * Inspired by Hero Zero's guild trophy system
 */
import { z } from 'zod';

// ============================================================================
// TROPHY CATEGORIES & TYPES
// ============================================================================

export type TrophyCategory = 'wins' | 'streak' | 'combat' | 'rivalry';

export type TrophyBonusType = 'stat_boost' | 'coin_multiplier' | 'badge';

export interface TrophyBonus {
  type: TrophyBonusType;
  value: number;
  description: string;
  polishDescription: string;
}

export interface TrophyDefinition {
  id: string;
  name: string;
  polishName: string;
  description: string;
  polishDescription: string;
  category: TrophyCategory;
  icon: string;
  color: string;

  // Requirements
  requirementType: 'cumulative_wins' | 'win_streak' | 'single_battle' | 'rivalry';
  requirementValue: number;
  requirementCondition?: string; // Additional condition (e.g., 'survivors', 'comeback')

  // Bonus
  bonus: TrophyBonus;
}

// ============================================================================
// TROPHY DEFINITIONS
// ============================================================================

export const GUILD_BATTLE_TROPHIES: Record<string, TrophyDefinition> = {
  // === CUMULATIVE WINS ===
  FIRST_BLOOD: {
    id: 'FIRST_BLOOD',
    name: 'First Blood',
    polishName: 'Pierwsza Krew',
    description: 'Win your first guild battle',
    polishDescription: 'Wygraj pierwsza bitwe gildyjna',
    category: 'wins',
    icon: '🩸',
    color: '#DC2626',
    requirementType: 'cumulative_wins',
    requirementValue: 1,
    bonus: {
      type: 'stat_boost',
      value: 5,
      description: '+5 to all member stats',
      polishDescription: '+5 do wszystkich statystyk czlonkow',
    },
  },
  BATTLE_HARDENED: {
    id: 'BATTLE_HARDENED',
    name: 'Battle Hardened',
    polishName: 'Zahartowani w Boju',
    description: 'Win 10 guild battles',
    polishDescription: 'Wygraj 10 bitew gildyjnych',
    category: 'wins',
    icon: '⚔️',
    color: '#7C3AED',
    requirementType: 'cumulative_wins',
    requirementValue: 10,
    bonus: {
      type: 'stat_boost',
      value: 10,
      description: '+10 to all member stats',
      polishDescription: '+10 do wszystkich statystyk czlonkow',
    },
  },
  WAR_MACHINE: {
    id: 'WAR_MACHINE',
    name: 'War Machine',
    polishName: 'Machina Wojenna',
    description: 'Win 50 guild battles',
    polishDescription: 'Wygraj 50 bitew gildyjnych',
    category: 'wins',
    icon: '🤖',
    color: '#DC2626',
    requirementType: 'cumulative_wins',
    requirementValue: 50,
    bonus: {
      type: 'stat_boost',
      value: 20,
      description: '+20 to all member stats',
      polishDescription: '+20 do wszystkich statystyk czlonkow',
    },
  },
  LEGENDARY_WARRIORS: {
    id: 'LEGENDARY_WARRIORS',
    name: 'Legendary Warriors',
    polishName: 'Legendarni Wojownicy',
    description: 'Win 100 guild battles',
    polishDescription: 'Wygraj 100 bitew gildyjnych',
    category: 'wins',
    icon: '👑',
    color: '#FFD700',
    requirementType: 'cumulative_wins',
    requirementValue: 100,
    bonus: {
      type: 'stat_boost',
      value: 30,
      description: '+30 to all member stats',
      polishDescription: '+30 do wszystkich statystyk czlonkow',
    },
  },

  // === WIN STREAKS ===
  HOT_STREAK: {
    id: 'HOT_STREAK',
    name: 'Hot Streak',
    polishName: 'Goraca Passa',
    description: 'Win 3 battles in a row',
    polishDescription: 'Wygraj 3 bitwy z rzedu',
    category: 'streak',
    icon: '🔥',
    color: '#F97316',
    requirementType: 'win_streak',
    requirementValue: 3,
    bonus: {
      type: 'coin_multiplier',
      value: 1.1,
      description: '+10% Guild Coins from battles',
      polishDescription: '+10% Guild Coins z bitew',
    },
  },
  UNSTOPPABLE: {
    id: 'UNSTOPPABLE',
    name: 'Unstoppable',
    polishName: 'Nie do Zatrzymania',
    description: 'Win 5 battles in a row',
    polishDescription: 'Wygraj 5 bitew z rzedu',
    category: 'streak',
    icon: '💪',
    color: '#EF4444',
    requirementType: 'win_streak',
    requirementValue: 5,
    bonus: {
      type: 'coin_multiplier',
      value: 1.2,
      description: '+20% Guild Coins from battles',
      polishDescription: '+20% Guild Coins z bitew',
    },
  },
  INVINCIBLE: {
    id: 'INVINCIBLE',
    name: 'Invincible',
    polishName: 'Niezwyciezeni',
    description: 'Win 10 battles in a row',
    polishDescription: 'Wygraj 10 bitew z rzedu',
    category: 'streak',
    icon: '🌟',
    color: '#FFD700',
    requirementType: 'win_streak',
    requirementValue: 10,
    bonus: {
      type: 'coin_multiplier',
      value: 1.5,
      description: '+50% Guild Coins from battles',
      polishDescription: '+50% Guild Coins z bitew',
    },
  },

  // === COMBAT TROPHIES ===
  DOMINATION: {
    id: 'DOMINATION',
    name: 'Domination',
    polishName: 'Dominacja',
    description: 'Win a battle with all 5 heroes surviving',
    polishDescription: 'Wygraj bitwe z 5 ocalatymi bohaterami',
    category: 'combat',
    icon: '💀',
    color: '#7C3AED',
    requirementType: 'single_battle',
    requirementValue: 5,
    requirementCondition: 'survivors',
    bonus: {
      type: 'badge',
      value: 1,
      description: 'Domination badge on guild profile',
      polishDescription: 'Odznaka Dominacji na profilu gildii',
    },
  },
  COMEBACK_KINGS: {
    id: 'COMEBACK_KINGS',
    name: 'Comeback Kings',
    polishName: 'Krolowie Powrotow',
    description: 'Win a battle after losing 3+ heroes',
    polishDescription: 'Wygraj bitwe po stracie 3+ bohaterow',
    category: 'combat',
    icon: '🔄',
    color: '#22C55E',
    requirementType: 'single_battle',
    requirementValue: 3,
    requirementCondition: 'comeback',
    bonus: {
      type: 'badge',
      value: 1,
      description: 'Comeback badge on guild profile',
      polishDescription: 'Odznaka Powrotu na profilu gildii',
    },
  },
  UNDERDOG_VICTORY: {
    id: 'UNDERDOG_VICTORY',
    name: 'Underdog Victory',
    polishName: 'Zwyciestwo Slabszego',
    description: 'Win against a guild with 20%+ more honor',
    polishDescription: 'Pokonaj gildie z 20%+ wiekszym honorem',
    category: 'combat',
    icon: '🐕',
    color: '#3B82F6',
    requirementType: 'single_battle',
    requirementValue: 20,
    requirementCondition: 'honor_difference',
    bonus: {
      type: 'coin_multiplier',
      value: 1.25,
      description: '+25% bonus coins from underdog wins',
      polishDescription: '+25% bonus coinow ze zwyciestwa slabszego',
    },
  },

  // === RIVALRY TROPHIES ===
  RIVAL_CRUSHER: {
    id: 'RIVAL_CRUSHER',
    name: 'Rival Crusher',
    polishName: 'Pogromca Rywali',
    description: 'Beat the same guild 5 times',
    polishDescription: 'Pokonaj te sama gildie 5 razy',
    category: 'rivalry',
    icon: '👊',
    color: '#DC2626',
    requirementType: 'rivalry',
    requirementValue: 5,
    bonus: {
      type: 'badge',
      value: 1,
      description: 'Rival Crusher badge',
      polishDescription: 'Odznaka Pogromcy Rywali',
    },
  },
  NEMESIS: {
    id: 'NEMESIS',
    name: 'Nemesis',
    polishName: 'Nemezis',
    description: 'Beat the same guild 10 times',
    polishDescription: 'Pokonaj te sama gildie 10 razy',
    category: 'rivalry',
    icon: '😈',
    color: '#7C3AED',
    requirementType: 'rivalry',
    requirementValue: 10,
    bonus: {
      type: 'stat_boost',
      value: 5,
      description: '+5 stats bonus vs that rival',
      polishDescription: '+5 statystyk vs ten rywal',
    },
  },
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get all trophies that can be earned from cumulative wins
 */
export function getWinTrophies(): TrophyDefinition[] {
  return Object.values(GUILD_BATTLE_TROPHIES).filter(t => t.requirementType === 'cumulative_wins');
}

/**
 * Get all trophies that can be earned from win streaks
 */
export function getStreakTrophies(): TrophyDefinition[] {
  return Object.values(GUILD_BATTLE_TROPHIES).filter(t => t.requirementType === 'win_streak');
}

/**
 * Get trophy definition by ID
 */
export function getTrophyById(trophyId: string): TrophyDefinition | undefined {
  return GUILD_BATTLE_TROPHIES[trophyId];
}

/**
 * Calculate total stat bonus from trophy IDs
 */
export function calculateTotalStatBonus(trophyIds: string[]): number {
  return trophyIds.reduce((total, id) => {
    const trophy = GUILD_BATTLE_TROPHIES[id];
    if (trophy && trophy.bonus.type === 'stat_boost') {
      return total + trophy.bonus.value;
    }
    return total;
  }, 0);
}

/**
 * Calculate coin multiplier from trophy IDs (multiplicative)
 */
export function calculateCoinMultiplier(trophyIds: string[]): number {
  return trophyIds.reduce((multiplier, id) => {
    const trophy = GUILD_BATTLE_TROPHIES[id];
    if (trophy && trophy.bonus.type === 'coin_multiplier') {
      return multiplier * trophy.bonus.value;
    }
    return multiplier;
  }, 1);
}

// ============================================================================
// ZOD SCHEMAS
// ============================================================================

export const TrophyCategorySchema = z.enum(['wins', 'streak', 'combat', 'rivalry']);

export const GuildBattleTrophySchema = z.object({
  id: z.string(),
  guildId: z.string(),
  trophyId: z.string(),
  progress: z.number().int().min(0),
  tier: z.number().int().min(1),
  maxTier: z.number().int().min(1),
  earnedAt: z.string().datetime(),
  upgradedAt: z.string().datetime().nullable(),
  isActive: z.boolean(),
});
export type GuildBattleTrophy = z.infer<typeof GuildBattleTrophySchema>;

export const GuildBattleStreakSchema = z.object({
  currentWinStreak: z.number().int().min(0),
  currentLossStreak: z.number().int().min(0),
  bestWinStreak: z.number().int().min(0),
  bestLossStreak: z.number().int().min(0),
});
export type GuildBattleStreakData = z.infer<typeof GuildBattleStreakSchema>;

export const RivalryStatsSchema = z.record(z.string(), z.object({
  wins: z.number().int().min(0),
  losses: z.number().int().min(0),
}));
export type RivalryStats = z.infer<typeof RivalryStatsSchema>;

// ============================================================================
// API RESPONSE SCHEMAS
// ============================================================================

export const GuildTrophyProgressSchema = z.object({
  trophyId: z.string(),
  name: z.string(),
  polishName: z.string(),
  icon: z.string(),
  color: z.string(),
  category: TrophyCategorySchema,
  progress: z.number().int(),
  target: z.number().int(),
  isEarned: z.boolean(),
  earnedAt: z.string().datetime().nullable(),
  bonus: z.object({
    type: z.enum(['stat_boost', 'coin_multiplier', 'badge']),
    value: z.number(),
    description: z.string(),
  }),
});
export type GuildTrophyProgress = z.infer<typeof GuildTrophyProgressSchema>;

export const GuildTrophiesResponseSchema = z.object({
  earned: z.array(GuildTrophyProgressSchema),
  inProgress: z.array(GuildTrophyProgressSchema),
  totalStatBonus: z.number().int(),
  coinMultiplier: z.number(),
  streak: GuildBattleStreakSchema,
});
export type GuildTrophiesResponse = z.infer<typeof GuildTrophiesResponseSchema>;

export const BattleRewardSchema = z.object({
  baseCoins: z.number().int(),
  bonusCoins: z.number().int(),
  totalCoins: z.number().int(),
  bonusReasons: z.array(z.string()),
  newTrophies: z.array(z.string()),
  streakStatus: GuildBattleStreakSchema,
});
export type BattleReward = z.infer<typeof BattleRewardSchema>;
