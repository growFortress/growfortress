import { z } from 'zod';

// ============================================================================
// ENUMS
// ============================================================================

export const GuildRoleSchema = z.enum(['LEADER', 'OFFICER', 'MEMBER']);
export type GuildRole = z.infer<typeof GuildRoleSchema>;

export const GuildInvitationStatusSchema = z.enum([
  'PENDING',
  'ACCEPTED',
  'DECLINED',
  'EXPIRED',
  'CANCELLED',
]);
export type GuildInvitationStatus = z.infer<typeof GuildInvitationStatusSchema>;

export const GuildAccessModeSchema = z.enum([
  'OPEN', // Anyone can join directly if meets minLevel
  'APPLY', // Players must send application
  'INVITE_ONLY', // Only through invitations (default)
  'CLOSED', // Not accepting new members
]);
export type GuildAccessMode = z.infer<typeof GuildAccessModeSchema>;

export const GuildApplicationStatusSchema = z.enum([
  'PENDING',
  'ACCEPTED',
  'DECLINED',
  'EXPIRED',
  'CANCELLED',
]);
export type GuildApplicationStatus = z.infer<typeof GuildApplicationStatusSchema>;

export const GuildBattleStatusSchema = z.enum(['RESOLVED']);
export type GuildBattleStatus = z.infer<typeof GuildBattleStatusSchema>;

export const ArenaWinnerSideSchema = z.enum(['attacker', 'defender', 'draw']);
export type ArenaWinnerSide = z.infer<typeof ArenaWinnerSideSchema>;

export const ArenaWinReasonSchema = z.enum(['elimination', 'timeout', 'draw']);
export type ArenaWinReason = z.infer<typeof ArenaWinReasonSchema>;

export const TreasuryTransactionTypeSchema = z.enum([
  'DEPOSIT_GOLD',
  'DEPOSIT_DUST',
  'WITHDRAW_GOLD',
  'WITHDRAW_DUST',
  'BATTLE_COST',
  'UPGRADE_COST',
  'REWARD_DISTRIBUTION',
  'SHIELD_PURCHASE',
  'STRUCTURE_UPGRADE',
]);
export type TreasuryTransactionType = z.infer<typeof TreasuryTransactionTypeSchema>;

// ============================================================================
// BATTLE HERO
// ============================================================================

export const BattleHeroSchema = z.object({
  heroId: z.string(),
  tier: z.number().int().min(1).max(3),
  power: z.number().int().min(0),
});
export type BattleHero = z.infer<typeof BattleHeroSchema>;

export const BattleHeroSnapshotSchema = z.object({
  userId: z.string(),
  displayName: z.string(),
  heroId: z.string(),
  tier: z.number().int().min(1).max(3),
  power: z.number().int().min(0),
  equippedArtifactId: z.string().nullable().optional(),
});
export type BattleHeroSnapshot = z.infer<typeof BattleHeroSnapshotSchema>;

export const SetBattleHeroRequestSchema = z.object({
  heroId: z.string().min(1),
});
export type SetBattleHeroRequest = z.infer<typeof SetBattleHeroRequestSchema>;

// ============================================================================
// GUILD SCHEMAS
// ============================================================================

export const GuildSettingsSchema = z.object({
  minLevel: z.number().int().min(1).max(100).default(1),
  autoAcceptInvites: z.boolean().default(false),
  battleCooldownHours: z.number().int().min(1).max(168).default(24),
  accessMode: GuildAccessModeSchema.default('INVITE_ONLY'),
});
export type GuildSettings = z.infer<typeof GuildSettingsSchema>;

export const GuildMemberSchema = z.object({
  id: z.string(),
  guildId: z.string(),
  userId: z.string(),
  displayName: z.string(),
  role: GuildRoleSchema,
  // Battle Hero for guild battles
  battleHero: BattleHeroSchema.nullable(),
  battleHeroUpdatedAt: z.string().datetime().nullable(),
  // Contributions
  totalGoldDonated: z.number().int().min(0),
  totalDustDonated: z.number().int().min(0),
  // Participation
  battlesParticipated: z.number().int().min(0),
  battlesWon: z.number().int().min(0),
  joinedAt: z.string().datetime(),
  // Total power (cached)
  power: z.number().int().min(0).optional(),
});
export type GuildMember = z.infer<typeof GuildMemberSchema>;

// Guild Structure types
export const GuildStructureTypeSchema = z.enum([
  'kwatera',    // Barracks - member capacity (+1 per level, base 10, max 30)
  'skarbiec',   // Treasury - gold bonus (+1% per level, max 20%)
  'akademia',   // Academy - XP bonus (+1% per level, max 20%)
  'zbrojownia', // Armory - stat bonus (+1% per level, max 20%)
]);
export type GuildStructureType = z.infer<typeof GuildStructureTypeSchema>;

// Structure levels stored in Guild
export const GuildStructureLevelsSchema = z.object({
  kwatera: z.number().int().min(0).max(20).default(0),
  skarbiec: z.number().int().min(0).max(20).default(0),
  akademia: z.number().int().min(0).max(20).default(0),
  zbrojownia: z.number().int().min(0).max(20).default(0),
});
export type GuildStructureLevels = z.infer<typeof GuildStructureLevelsSchema>;

// Structure info for display
export const GuildStructureInfoSchema = z.object({
  type: GuildStructureTypeSchema,
  level: z.number().int().min(0).max(20),
  maxLevel: z.number().int().default(20),
  currentBonus: z.number(), // Current bonus value (members for kwatera, % for others)
  nextBonus: z.number().nullable(), // Bonus at next level (null if max)
  upgradeCost: z.object({
    gold: z.number().int(),
    dust: z.number().int(),
  }).nullable(), // null if max level
  canAfford: z.boolean(),
});
export type GuildStructureInfo = z.infer<typeof GuildStructureInfoSchema>;

// Upgrade structure request
export const UpgradeStructureRequestSchema = z.object({
  structure: GuildStructureTypeSchema,
});
export type UpgradeStructureRequest = z.infer<typeof UpgradeStructureRequestSchema>;

// Upgrade structure response
export const UpgradeStructureResponseSchema = z.object({
  success: z.boolean(),
  newLevel: z.number().int(),
  goldSpent: z.number().int(),
  dustSpent: z.number().int(),
  treasuryBalance: z.object({
    gold: z.number().int(),
    dust: z.number().int(),
  }),
});
export type UpgradeStructureResponse = z.infer<typeof UpgradeStructureResponseSchema>;

// Structures response (list all structures with upgrade info)
export const StructuresResponseSchema = z.object({
  structures: z.array(GuildStructureInfoSchema),
});
export type StructuresResponse = z.infer<typeof StructuresResponseSchema>;

export const GuildSchema = z.object({
  id: z.string(),
  name: z.string(),
  tag: z.string(),
  description: z.string().nullable(),
  // Structure levels (0-20 each)
  structures: GuildStructureLevelsSchema,
  honor: z.number().int().min(0),
  trophies: z.array(z.string()),
  settings: GuildSettingsSchema,
  disbanded: z.boolean(),
  createdAt: z.string().datetime(),
  memberCount: z.number().int().min(0).optional(),
  maxMembers: z.number().int().min(10).max(30).optional(),
});
export type Guild = z.infer<typeof GuildSchema>;

export const GuildWithMembersSchema = GuildSchema.extend({
  members: z.array(GuildMemberSchema),
});
export type GuildWithMembers = z.infer<typeof GuildWithMembersSchema>;

// ============================================================================
// GUILD MANAGEMENT
// ============================================================================

export const CreateGuildRequestSchema = z.object({
  name: z.string().min(3).max(24),
  tag: z.string().min(3).max(5).regex(/^[A-Z0-9]+$/, 'Tag must be uppercase letters and numbers only'),
  description: z.string().max(200).optional(),
  settings: GuildSettingsSchema.partial().optional(),
});
export type CreateGuildRequest = z.infer<typeof CreateGuildRequestSchema>;

export const CreateGuildResponseSchema = z.object({
  guild: GuildSchema,
});
export type CreateGuildResponse = z.infer<typeof CreateGuildResponseSchema>;

export const UpdateGuildRequestSchema = z.object({
  name: z.string().min(3).max(24).optional(),
  tag: z.string().min(3).max(5).regex(/^[A-Z0-9]+$/, 'Tag must be uppercase letters and numbers only').optional(),
  description: z.string().max(200).optional(),
  settings: GuildSettingsSchema.partial().optional(),
});
export type UpdateGuildRequest = z.infer<typeof UpdateGuildRequestSchema>;

export const GuildSearchQuerySchema = z.object({
  search: z.string().min(1).max(50).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type GuildSearchQuery = z.infer<typeof GuildSearchQuerySchema>;

export const GuildSearchResponseSchema = z.object({
  guilds: z.array(GuildSchema),
  total: z.number().int().min(0),
});
export type GuildSearchResponse = z.infer<typeof GuildSearchResponseSchema>;

// ============================================================================
// MEMBERSHIP
// ============================================================================

export const MyGuildResponseSchema = z.object({
  guild: GuildWithMembersSchema.nullable(),
  membership: GuildMemberSchema.nullable(),
  bonuses: z.object({
    goldBoost: z.number().min(0).max(1),
    statBoost: z.number().min(0).max(1),
    xpBoost: z.number().min(0).max(1),
  }).nullable(),
});
export type MyGuildResponse = z.infer<typeof MyGuildResponseSchema>;

export const UpdateMemberRoleRequestSchema = z.object({
  role: z.enum(['OFFICER', 'MEMBER']),
});
export type UpdateMemberRoleRequest = z.infer<typeof UpdateMemberRoleRequestSchema>;

export const TransferLeadershipRequestSchema = z.object({
  newLeaderId: z.string().min(1),
});
export type TransferLeadershipRequest = z.infer<typeof TransferLeadershipRequestSchema>;

// ============================================================================
// INVITATIONS
// ============================================================================

export const GuildInvitationSchema = z.object({
  id: z.string(),
  guildId: z.string(),
  guildName: z.string(),
  guildTag: z.string(),
  inviterId: z.string(),
  inviterName: z.string(),
  inviteeId: z.string(),
  inviteeName: z.string(),
  status: GuildInvitationStatusSchema,
  message: z.string().nullable(),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});
export type GuildInvitation = z.infer<typeof GuildInvitationSchema>;

export const CreateInvitationRequestSchema = z.object({
  userId: z.string().min(1),
  message: z.string().max(200).optional(),
});
export type CreateInvitationRequest = z.infer<typeof CreateInvitationRequestSchema>;

export const InvitationsQuerySchema = z.object({
  status: GuildInvitationStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type InvitationsQuery = z.infer<typeof InvitationsQuerySchema>;

export const InvitationsResponseSchema = z.object({
  invitations: z.array(GuildInvitationSchema),
  total: z.number().int().min(0),
});
export type InvitationsResponse = z.infer<typeof InvitationsResponseSchema>;

// ============================================================================
// APPLICATIONS
// ============================================================================

export const GuildApplicationSchema = z.object({
  id: z.string(),
  guildId: z.string(),
  guildName: z.string(),
  guildTag: z.string(),
  guildMemberCount: z.number().int().min(0),
  applicantId: z.string(),
  applicantName: z.string(),
  applicantLevel: z.number().int().min(0), // highestWave
  applicantPower: z.number().int().min(0),
  status: GuildApplicationStatusSchema,
  message: z.string().max(200).nullable(),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  respondedAt: z.string().datetime().nullable(),
  respondedBy: z.string().nullable(),
  responderName: z.string().nullable(),
});
export type GuildApplication = z.infer<typeof GuildApplicationSchema>;

export const CreateApplicationRequestSchema = z.object({
  message: z.string().max(200).optional(),
});
export type CreateApplicationRequest = z.infer<typeof CreateApplicationRequestSchema>;

export const ApplicationsQuerySchema = z.object({
  status: GuildApplicationStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ApplicationsQuery = z.infer<typeof ApplicationsQuerySchema>;

export const ApplicationsResponseSchema = z.object({
  applications: z.array(GuildApplicationSchema),
  total: z.number().int().min(0),
});
export type ApplicationsResponse = z.infer<typeof ApplicationsResponseSchema>;

// Direct join request (for OPEN guilds)
export const JoinGuildDirectRequestSchema = z.object({});
export type JoinGuildDirectRequest = z.infer<typeof JoinGuildDirectRequestSchema>;

// ============================================================================
// TREASURY
// ============================================================================

export const GuildTreasurySchema = z.object({
  gold: z.number().int().min(0),
  dust: z.number().int().min(0),
  totalGoldDeposited: z.number().int().min(0),
  totalDustDeposited: z.number().int().min(0),
});
export type GuildTreasury = z.infer<typeof GuildTreasurySchema>;

export const TreasuryLogEntrySchema = z.object({
  id: z.string(),
  userId: z.string(),
  userName: z.string(),
  transactionType: TreasuryTransactionTypeSchema,
  goldAmount: z.number().int(),
  dustAmount: z.number().int(),
  description: z.string().nullable(),
  balanceAfterGold: z.number().int().min(0),
  balanceAfterDust: z.number().int().min(0),
  createdAt: z.string().datetime(),
});
export type TreasuryLogEntry = z.infer<typeof TreasuryLogEntrySchema>;

export const TreasuryResponseSchema = z.object({
  treasury: GuildTreasurySchema,
  recentLogs: z.array(TreasuryLogEntrySchema),
  canWithdraw: z.boolean(),
  nextWithdrawAt: z.string().datetime().nullable(),
});
export type TreasuryResponse = z.infer<typeof TreasuryResponseSchema>;

export const TreasuryDepositRequestSchema = z.object({
  gold: z.number().int().min(0).max(50000).optional(),
  dust: z.number().int().min(0).max(500).optional(),
});
export type TreasuryDepositRequest = z.infer<typeof TreasuryDepositRequestSchema>;

export const TreasuryWithdrawRequestSchema = z.object({
  gold: z.number().int().min(0).optional(),
  dust: z.number().int().min(0).optional(),
  reason: z.string().min(1).max(200),
});
export type TreasuryWithdrawRequest = z.infer<typeof TreasuryWithdrawRequestSchema>;

export const TreasuryLogsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type TreasuryLogsQuery = z.infer<typeof TreasuryLogsQuerySchema>;

export const TreasuryLogsResponseSchema = z.object({
  logs: z.array(TreasuryLogEntrySchema),
  total: z.number().int().min(0),
});
export type TreasuryLogsResponse = z.infer<typeof TreasuryLogsResponseSchema>;

// ============================================================================
// ARENA 5v5 BATTLES
// ============================================================================

// Key moment types for battle animation replay
export const ArenaKeyMomentSchema = z.object({
  tick: z.number().int().min(0),
  type: z.enum(['battle_start', 'kill', 'skill_used', 'critical_hit', 'battle_end']),
  data: z.record(z.unknown()), // Flexible data depending on type
});
export type ArenaKeyMoment = z.infer<typeof ArenaKeyMomentSchema>;

// Kill log entry
export const ArenaKillLogEntrySchema = z.object({
  tick: z.number().int().min(0),
  killerHeroId: z.string(),
  killerUserId: z.string(),
  victimHeroId: z.string(),
  victimUserId: z.string(),
});
export type ArenaKillLogEntry = z.infer<typeof ArenaKillLogEntrySchema>;

// MVP info
export const ArenaMvpSchema = z.object({
  userId: z.string(),
  displayName: z.string(),
  heroId: z.string(),
  damage: z.number().int().min(0),
  kills: z.number().int().min(0),
});
export type ArenaMvp = z.infer<typeof ArenaMvpSchema>;

// Guild battle (instant attack, Arena 5v5)
export const GuildBattleSchema = z.object({
  id: z.string(),
  // Guilds
  attackerGuildId: z.string(),
  attackerGuildName: z.string(),
  attackerGuildTag: z.string(),
  defenderGuildId: z.string(),
  defenderGuildName: z.string(),
  defenderGuildTag: z.string(),
  // Who initiated
  attackerUserId: z.string(),
  attackerUserName: z.string(),
  // Participants (5 from each side)
  attackerHeroes: z.array(BattleHeroSnapshotSchema),
  defenderHeroes: z.array(BattleHeroSnapshotSchema),
  // Status
  status: GuildBattleStatusSchema,
  // Timestamps
  createdAt: z.string().datetime(),
  resolvedAt: z.string().datetime(),
  // Result
  winnerGuildId: z.string().nullable(),
  // Revenge info
  isRevenge: z.boolean(),
  revengeForBattleId: z.string().nullable(),
});
export type GuildBattle = z.infer<typeof GuildBattleSchema>;

// Battle result (Arena 5v5 simulation result)
export const GuildBattleResultSchema = z.object({
  id: z.string(),
  battleId: z.string(),
  // Winner
  winnerGuildId: z.string().nullable(),
  winnerSide: ArenaWinnerSideSchema,
  winReason: ArenaWinReasonSchema,
  // Honor changes
  attackerHonorChange: z.number().int(),
  defenderHonorChange: z.number().int(),
  // Arena 5v5 stats
  attackerSurvivors: z.number().int().min(0).max(5),
  defenderSurvivors: z.number().int().min(0).max(5),
  attackerTotalDamage: z.number().int().min(0),
  defenderTotalDamage: z.number().int().min(0),
  // MVP
  mvp: ArenaMvpSchema.nullable(),
  // Replay data for animation
  keyMoments: z.array(ArenaKeyMomentSchema),
  killLog: z.array(ArenaKillLogEntrySchema),
  // Duration
  duration: z.number().int().min(0),
  resolvedAt: z.string().datetime(),
});
export type GuildBattleResult = z.infer<typeof GuildBattleResultSchema>;

export const GuildBattleWithResultSchema = GuildBattleSchema.extend({
  result: GuildBattleResultSchema.nullable(),
});
export type GuildBattleWithResult = z.infer<typeof GuildBattleWithResultSchema>;

// Instant attack request (Arena 5v5)
export const InstantAttackRequestSchema = z.object({
  defenderGuildId: z.string().min(1),
  selectedMemberIds: z.array(z.string()).length(5), // Exactly 5 members
});
export type InstantAttackRequest = z.infer<typeof InstantAttackRequestSchema>;

// Instant attack response
export const InstantAttackResponseSchema = z.object({
  battle: GuildBattleWithResultSchema,
  attackerHonorChange: z.number().int(),
  defenderHonorChange: z.number().int(),
});
export type InstantAttackResponse = z.infer<typeof InstantAttackResponseSchema>;

export const BattlesQuerySchema = z.object({
  type: z.enum(['sent', 'received', 'all']).default('all'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type BattlesQuery = z.infer<typeof BattlesQuerySchema>;

export const BattlesResponseSchema = z.object({
  battles: z.array(GuildBattleWithResultSchema),
  total: z.number().int().min(0),
});
export type BattlesResponse = z.infer<typeof BattlesResponseSchema>;

// Battle roster - members available for selection (with extended stats for Leader view)
export const BattleRosterMemberSchema = z.object({
  userId: z.string(),
  displayName: z.string(),
  role: GuildRoleSchema,
  battleHero: BattleHeroSchema.nullable(),
  // Extended stats for roster view
  totalPower: z.number().int().min(0),
  highestWave: z.number().int().min(0),
  unlockedHeroCount: z.number().int().min(0),
  lastActiveAt: z.string().datetime().nullable(),
});
export type BattleRosterMember = z.infer<typeof BattleRosterMemberSchema>;

export const BattleRosterResponseSchema = z.object({
  members: z.array(BattleRosterMemberSchema),
  availableAttacks: z.number().int().min(0), // Remaining attacks today
  maxDailyAttacks: z.number().int(),
  nextAttackResetAt: z.string().datetime(),
});
export type BattleRosterResponse = z.infer<typeof BattleRosterResponseSchema>;

// ============================================================================
// GUILD SHIELD
// ============================================================================

export const GuildShieldSchema = z.object({
  guildId: z.string(),
  activatedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  activatedBy: z.string(),
  weeklyCount: z.number().int().min(0).max(2),
  goldCost: z.number().int().min(0),
});
export type GuildShield = z.infer<typeof GuildShieldSchema>;

export const ActivateShieldRequestSchema = z.object({});
export type ActivateShieldRequest = z.infer<typeof ActivateShieldRequestSchema>;

export const ShieldStatusResponseSchema = z.object({
  isActive: z.boolean(),
  shield: GuildShieldSchema.nullable(),
  canActivate: z.boolean(),
  activationCost: z.number().int(),
  weeklyUsed: z.number().int().min(0).max(2),
  maxWeekly: z.number().int(),
});
export type ShieldStatusResponse = z.infer<typeof ShieldStatusResponseSchema>;

// ============================================================================
// LEADERBOARD
// ============================================================================

export const GuildLeaderboardEntrySchema = z.object({
  rank: z.number().int().min(1),
  guildId: z.string(),
  guildName: z.string(),
  guildTag: z.string(),
  honor: z.number().int().min(0),
  totalScore: z.number().int().min(0),
  battlesWon: z.number().int().min(0),
  battlesLost: z.number().int().min(0),
  memberCount: z.number().int().min(0),
});
export type GuildLeaderboardEntry = z.infer<typeof GuildLeaderboardEntrySchema>;

export const GuildLeaderboardQuerySchema = z.object({
  week: z.string().optional(), // Format: 2024-W01
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type GuildLeaderboardQuery = z.infer<typeof GuildLeaderboardQuerySchema>;

export const GuildLeaderboardResponseSchema = z.object({
  weekKey: z.string(),
  entries: z.array(GuildLeaderboardEntrySchema),
  total: z.number().int().min(0),
  myGuildRank: z.number().int().min(1).nullable(),
});
export type GuildLeaderboardResponse = z.infer<typeof GuildLeaderboardResponseSchema>;

export const GuildRankResponseSchema = z.object({
  rank: z.number().int().min(1).nullable(),
  honor: z.number().int().min(0),
  weekKey: z.string(),
});
export type GuildRankResponse = z.infer<typeof GuildRankResponseSchema>;

export const MemberContributionSchema = z.object({
  userId: z.string(),
  displayName: z.string(),
  goldDonated: z.number().int().min(0),
  dustDonated: z.number().int().min(0),
  battlesParticipated: z.number().int().min(0),
  battlesWon: z.number().int().min(0),
});
export type MemberContribution = z.infer<typeof MemberContributionSchema>;

export const ContributionsResponseSchema = z.object({
  weekKey: z.string(),
  contributions: z.array(MemberContributionSchema),
});
export type ContributionsResponse = z.infer<typeof ContributionsResponseSchema>;

// ============================================================================
// TROPHIES
// ============================================================================

export const GuildTrophySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  requirement: z.string(),
  bonus: z.string(),
  earnedAt: z.string().datetime().nullable(),
});
export type GuildTrophy = z.infer<typeof GuildTrophySchema>;

// ============================================================================
// WEEKLY TOWER RACE
// ============================================================================

export const TowerRaceContributionSchema = z.object({
  userId: z.string(),
  displayName: z.string(),
  wavesContributed: z.number().int().min(0),
});
export type TowerRaceContribution = z.infer<typeof TowerRaceContributionSchema>;

export const TowerRaceEntrySchema = z.object({
  guildId: z.string(),
  guildName: z.string(),
  guildTag: z.string(),
  totalWaves: z.number().int().min(0),
  rank: z.number().int().min(1),
});
export type TowerRaceEntry = z.infer<typeof TowerRaceEntrySchema>;

export const TowerRaceSchema = z.object({
  id: z.string(),
  weekKey: z.string(),
  startedAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  status: z.enum(['active', 'completed']),
});
export type TowerRace = z.infer<typeof TowerRaceSchema>;

export const TowerRaceLeaderboardResponseSchema = z.object({
  race: TowerRaceSchema,
  entries: z.array(TowerRaceEntrySchema),
  myGuildEntry: TowerRaceEntrySchema.nullable(),
  myContribution: z.number().int().min(0),
});
export type TowerRaceLeaderboardResponse = z.infer<typeof TowerRaceLeaderboardResponseSchema>;

export const TowerRaceGuildDetailsResponseSchema = z.object({
  race: TowerRaceSchema,
  guildEntry: TowerRaceEntrySchema.nullable(), // null if guild hasn't participated yet
  contributions: z.array(TowerRaceContributionSchema),
});
export type TowerRaceGuildDetailsResponse = z.infer<typeof TowerRaceGuildDetailsResponseSchema>;

// ============================================================================
// GUILD BOSS
// ============================================================================

export const GuildBossSchema = z.object({
  id: z.string(),
  weekKey: z.string(),
  bossType: z.string(),
  totalHp: z.number().int().min(0),
  currentHp: z.number().int().min(0),
  weakness: z.string().nullable(),
  endsAt: z.string().datetime(),
});
export type GuildBoss = z.infer<typeof GuildBossSchema>;

// BigInt helper for damage values that can exceed JS safe integer limit
const BigIntStringSchema = z.union([z.number().int().min(0), z.string()]);

export const GuildBossAttemptSchema = z.object({
  id: z.string(),
  userId: z.string(),
  displayName: z.string(),
  guildId: z.string(),
  damage: BigIntStringSchema, // BigInt serialized as string for large values
  heroId: z.string(),
  heroTier: z.number().int().min(1).max(3),
  heroPower: z.number().int().min(0),
  attemptedAt: z.string().datetime(),
});
export type GuildBossAttempt = z.infer<typeof GuildBossAttemptSchema>;

export const GuildBossStatusResponseSchema = z.object({
  boss: GuildBossSchema,
  myTodaysAttempt: GuildBossAttemptSchema.nullable(),
  canAttack: z.boolean(),
  myTotalDamage: z.number().int().min(0),
  guildTotalDamage: z.number().int().min(0),
  guildRank: z.number().int().min(1).nullable(),
});
export type GuildBossStatusResponse = z.infer<typeof GuildBossStatusResponseSchema>;

export const GuildBossLeaderboardEntrySchema = z.object({
  rank: z.number().int().min(1),
  guildId: z.string(),
  guildName: z.string(),
  guildTag: z.string(),
  totalDamage: z.number().int().min(0),
  participantCount: z.number().int().min(0),
});
export type GuildBossLeaderboardEntry = z.infer<typeof GuildBossLeaderboardEntrySchema>;

export const GuildBossLeaderboardResponseSchema = z.object({
  boss: GuildBossSchema,
  entries: z.array(GuildBossLeaderboardEntrySchema),
  myGuildEntry: GuildBossLeaderboardEntrySchema.nullable(),
});
export type GuildBossLeaderboardResponse = z.infer<typeof GuildBossLeaderboardResponseSchema>;

export const GuildBossAttackResponseSchema = z.object({
  attempt: GuildBossAttemptSchema,
  bossCurrentHp: BigIntStringSchema, // BigInt serialized as string
});
export type GuildBossAttackResponse = z.infer<typeof GuildBossAttackResponseSchema>;

// ============================================================================
// CONSTANTS
// ============================================================================

export const GUILD_CONSTANTS = {
  // Name/tag constraints
  MIN_NAME_LENGTH: 3,
  MAX_NAME_LENGTH: 24,
  TAG_MIN_LENGTH: 3,
  TAG_MAX_LENGTH: 5,
  MAX_DESCRIPTION_LENGTH: 200,

  // Member limits (based on Kwatera structure level)
  MEMBER_BASE_CAPACITY: 10,
  MEMBER_MAX_CAPACITY: 30,

  // Donation limits
  MIN_DONATION_GOLD: 100,
  MIN_DONATION_DUST: 10,
  MAX_DAILY_DONATION_GOLD: 50000,
  MAX_DAILY_DONATION_DUST: 500,

  // Time limits
  INVITATION_EXPIRY_HOURS: 72,
  APPLICATION_EXPIRY_HOURS: 72,
  BATTLE_COOLDOWN_HOURS: 24,
  WITHDRAWAL_COOLDOWN_HOURS: 24,

  // Applications
  MAX_ACTIVE_APPLICATIONS_PER_PLAYER: 5,
  MAX_APPLICATION_MESSAGE_LENGTH: 200,

  // Treasury
  MAX_WITHDRAWAL_PERCENT: 0.20,

  // Arena 5v5 Battles
  ARENA_PARTICIPANTS: 5,
  MAX_DAILY_ATTACKS: 10,
  ATTACK_COOLDOWN_SAME_GUILD_HOURS: 24,
  MAX_ATTACKS_RECEIVED_PER_DAY: 3,
  ARENA_DURATION_TICKS: 1800, // 60 seconds at 30Hz

  // Shield
  SHIELD_DURATION_HOURS: 24,
  SHIELD_GOLD_COST: 5000,
  MAX_SHIELDS_PER_WEEK: 2,

  // Honor (ELO)
  BASE_HONOR: 1000,
  MIN_HONOR: 100,
  HONOR_K_FACTOR: 32,

  // Structure upgrades
  STRUCTURE_MAX_LEVEL: 20,
  STRUCTURE_UPGRADE_BASE_GOLD: 500, // Cost = 500 × (level + 1)²
  STRUCTURE_UPGRADE_BASE_DUST: 25,  // Cost = 25 × (level + 1)
  STRUCTURE_BONUS_PER_LEVEL: 0.01,  // +1% per level for skarbiec/akademia/zbrojownia

  // Guild Boss
  BOSS_TOTAL_HP: 50_000_000,
  BOSS_ATTACKS_PER_DAY: 1,

  // Guild Coins (earned from battles/boss)
  COINS_ARENA_WIN: 50,
  COINS_ARENA_LOSS: 10,
  COINS_BOSS_PARTICIPATION: 5,
  COINS_BOSS_TOP_DAMAGE: 25,
} as const;

// ============================================================================
// ERROR CODES
// ============================================================================

export const GUILD_ERROR_CODES = {
  // Guild errors
  GUILD_NOT_FOUND: 'GUILD_NOT_FOUND',
  GUILD_DISBANDED: 'GUILD_DISBANDED',
  NAME_TAKEN: 'NAME_TAKEN',
  TAG_TAKEN: 'TAG_TAKEN',
  INVALID_TAG: 'INVALID_TAG',

  // Membership errors
  ALREADY_IN_GUILD: 'ALREADY_IN_GUILD',
  NOT_IN_GUILD: 'NOT_IN_GUILD',
  GUILD_FULL: 'GUILD_FULL',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  CANNOT_KICK_LEADER: 'CANNOT_KICK_LEADER',
  CANNOT_LEAVE_AS_LEADER: 'CANNOT_LEAVE_AS_LEADER',
  TARGET_NOT_IN_GUILD: 'TARGET_NOT_IN_GUILD',

  // Invitation errors
  INVITATION_NOT_FOUND: 'INVITATION_NOT_FOUND',
  INVITATION_EXPIRED: 'INVITATION_EXPIRED',
  INVITATION_NOT_PENDING: 'INVITATION_NOT_PENDING',
  ALREADY_INVITED: 'ALREADY_INVITED',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_ALREADY_IN_GUILD: 'USER_ALREADY_IN_GUILD',

  // Application errors
  APPLICATION_NOT_FOUND: 'APPLICATION_NOT_FOUND',
  APPLICATION_EXPIRED: 'APPLICATION_EXPIRED',
  APPLICATION_NOT_PENDING: 'APPLICATION_NOT_PENDING',
  ALREADY_APPLIED: 'ALREADY_APPLIED',
  MAX_APPLICATIONS_REACHED: 'MAX_APPLICATIONS_REACHED',
  GUILD_NOT_ACCEPTING_APPLICATIONS: 'GUILD_NOT_ACCEPTING_APPLICATIONS',
  GUILD_NOT_ACCEPTING_DIRECT_JOIN: 'GUILD_NOT_ACCEPTING_DIRECT_JOIN',
  GUILD_CLOSED: 'GUILD_CLOSED',
  LEVEL_TOO_LOW: 'LEVEL_TOO_LOW',

  // Treasury errors
  TREASURY_INSUFFICIENT: 'TREASURY_INSUFFICIENT',
  WITHDRAWAL_COOLDOWN: 'WITHDRAWAL_COOLDOWN',
  WITHDRAWAL_LIMIT_EXCEEDED: 'WITHDRAWAL_LIMIT_EXCEEDED',
  DONATION_LIMIT_EXCEEDED: 'DONATION_LIMIT_EXCEEDED',
  INSUFFICIENT_PERSONAL_FUNDS: 'INSUFFICIENT_PERSONAL_FUNDS',
  INVALID_AMOUNT: 'INVALID_AMOUNT',

  // Battle Hero errors
  HERO_NOT_UNLOCKED: 'HERO_NOT_UNLOCKED',
  NO_BATTLE_HERO_SET: 'NO_BATTLE_HERO_SET',
  MEMBER_NO_BATTLE_HERO: 'MEMBER_NO_BATTLE_HERO',

  // Arena Battle errors
  BATTLE_NOT_FOUND: 'BATTLE_NOT_FOUND',
  BATTLE_COOLDOWN: 'BATTLE_COOLDOWN',
  CANNOT_ATTACK_SELF: 'CANNOT_ATTACK_SELF',
  DAILY_ATTACK_LIMIT: 'DAILY_ATTACK_LIMIT',
  DEFENDER_SHIELD_ACTIVE: 'DEFENDER_SHIELD_ACTIVE',
  ATTACKER_SHIELD_ACTIVE: 'ATTACKER_SHIELD_ACTIVE',
  NOT_ENOUGH_BATTLE_HEROES: 'NOT_ENOUGH_BATTLE_HEROES',
  INVALID_MEMBER_SELECTION: 'INVALID_MEMBER_SELECTION',
  DEFENDER_MAX_ATTACKS_RECEIVED: 'DEFENDER_MAX_ATTACKS_RECEIVED',

  // Shield errors
  SHIELD_ALREADY_ACTIVE: 'SHIELD_ALREADY_ACTIVE',
  SHIELD_WEEKLY_LIMIT: 'SHIELD_WEEKLY_LIMIT',
  SHIELD_INSUFFICIENT_GOLD: 'SHIELD_INSUFFICIENT_GOLD',

  // Guild Boss errors
  BOSS_NOT_FOUND: 'BOSS_NOT_FOUND',
  ALREADY_ATTACKED_BOSS_TODAY: 'ALREADY_ATTACKED_BOSS_TODAY',
  BOSS_EXPIRED: 'BOSS_EXPIRED',

  // Structure upgrade errors
  STRUCTURE_MAX_LEVEL: 'STRUCTURE_MAX_LEVEL',
  STRUCTURE_INVALID: 'STRUCTURE_INVALID',
} as const;

export type GuildErrorCode = keyof typeof GUILD_ERROR_CODES;
