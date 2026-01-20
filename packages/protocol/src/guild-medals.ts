/**
 * Guild Tower Race Medals - Weekly ranking rewards
 * Inspired by Grow Castle's guild ranking system
 */
import { z } from 'zod';

// ============================================================================
// MEDAL TYPE DEFINITIONS
// ============================================================================

export type MedalType = 'gold' | 'silver' | 'bronze' | 'top10' | 'top25' | 'top50';

export interface MedalDefinition {
  id: MedalType;
  name: string;
  polishName: string;
  description: string;
  icon: string;
  color: string;
  glowColor?: string;
  minRank: number;
  maxRank: number;
  guildCoinsReward: number;
  wavesBonus: number; // Percentage bonus for next week (e.g., 0.10 = +10%)
}

/**
 * Tower Race Medal definitions
 * Awards for weekly guild wave rankings
 */
export const TOWER_RACE_MEDALS: Record<MedalType, MedalDefinition> = {
  gold: {
    id: 'gold',
    name: 'Gold Medal',
    polishName: 'Zloty Medal',
    description: '1st place in Tower Race',
    icon: '🥇',
    color: '#FFD700',
    glowColor: 'rgba(255, 215, 0, 0.6)',
    minRank: 1,
    maxRank: 1,
    guildCoinsReward: 500,
    wavesBonus: 0.10, // +10% waves next week
  },
  silver: {
    id: 'silver',
    name: 'Silver Medal',
    polishName: 'Srebrny Medal',
    description: '2nd place in Tower Race',
    icon: '🥈',
    color: '#C0C0C0',
    glowColor: 'rgba(192, 192, 192, 0.5)',
    minRank: 2,
    maxRank: 2,
    guildCoinsReward: 300,
    wavesBonus: 0.07, // +7% waves
  },
  bronze: {
    id: 'bronze',
    name: 'Bronze Medal',
    polishName: 'Brazowy Medal',
    description: '3rd place in Tower Race',
    icon: '🥉',
    color: '#CD7F32',
    glowColor: 'rgba(205, 127, 50, 0.4)',
    minRank: 3,
    maxRank: 3,
    guildCoinsReward: 200,
    wavesBonus: 0.05, // +5% waves
  },
  top10: {
    id: 'top10',
    name: 'Top 10',
    polishName: 'Top 10',
    description: 'Finished in Top 10',
    icon: '🏅',
    color: '#00BFFF',
    minRank: 4,
    maxRank: 10,
    guildCoinsReward: 100,
    wavesBonus: 0.03, // +3% waves
  },
  top25: {
    id: 'top25',
    name: 'Top 25',
    polishName: 'Top 25',
    description: 'Finished in Top 25',
    icon: '📜',
    color: '#4169E1',
    minRank: 11,
    maxRank: 25,
    guildCoinsReward: 50,
    wavesBonus: 0.02, // +2% waves
  },
  top50: {
    id: 'top50',
    name: 'Top 50',
    polishName: 'Top 50',
    description: 'Finished in Top 50',
    icon: '✨',
    color: '#6B7280',
    minRank: 26,
    maxRank: 50,
    guildCoinsReward: 25,
    wavesBonus: 0.01, // +1% waves
  },
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get medal type based on rank
 */
export function getMedalTypeForRank(rank: number): MedalType | null {
  if (rank === 1) return 'gold';
  if (rank === 2) return 'silver';
  if (rank === 3) return 'bronze';
  if (rank >= 4 && rank <= 10) return 'top10';
  if (rank >= 11 && rank <= 25) return 'top25';
  if (rank >= 26 && rank <= 50) return 'top50';
  return null;
}

/**
 * Get medal definition for a rank
 */
export function getMedalForRank(rank: number): MedalDefinition | null {
  const medalType = getMedalTypeForRank(rank);
  return medalType ? TOWER_RACE_MEDALS[medalType] : null;
}

// ============================================================================
// ZOD SCHEMAS
// ============================================================================

export const MedalTypeSchema = z.enum(['gold', 'silver', 'bronze', 'top10', 'top25', 'top50']);

export const GuildMedalSchema = z.object({
  id: z.string(),
  guildId: z.string(),
  weekKey: z.string(),
  raceId: z.string(),
  medalType: MedalTypeSchema,
  rank: z.number().int().min(1).max(50),
  totalWaves: z.number().int().min(0),
  coinsAwarded: z.number().int().min(0),
  awardedAt: z.string().datetime(),
});
export type GuildMedal = z.infer<typeof GuildMedalSchema>;

export const GuildMedalBonusSchema = z.object({
  wavesBonus: z.number().min(0).max(1),
  sourceMedalType: MedalTypeSchema.nullable(),
  sourceWeekKey: z.string().nullable(),
  expiresAt: z.string().datetime().nullable(),
  isActive: z.boolean(),
});
export type GuildMedalBonus = z.infer<typeof GuildMedalBonusSchema>;

export const GuildMedalStatsSchema = z.object({
  goldCount: z.number().int().min(0),
  silverCount: z.number().int().min(0),
  bronzeCount: z.number().int().min(0),
  top10Count: z.number().int().min(0),
  top25Count: z.number().int().min(0),
  top50Count: z.number().int().min(0),
  totalMedals: z.number().int().min(0),
  bestRank: z.number().int().min(1).nullable(),
});
export type GuildMedalStats = z.infer<typeof GuildMedalStatsSchema>;

// ============================================================================
// API RESPONSE SCHEMAS
// ============================================================================

export const GuildMedalCollectionResponseSchema = z.object({
  medals: z.array(GuildMedalSchema),
  stats: GuildMedalStatsSchema,
  activeBonus: GuildMedalBonusSchema,
});
export type GuildMedalCollectionResponse = z.infer<typeof GuildMedalCollectionResponseSchema>;

export const GuildActiveBonusResponseSchema = z.object({
  activeBonus: GuildMedalBonusSchema,
});
export type GuildActiveBonusResponse = z.infer<typeof GuildActiveBonusResponseSchema>;
