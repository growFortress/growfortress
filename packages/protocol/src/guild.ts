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
  'GUILD_TECH_UPGRADE',
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
  weeklyXpContributed: z.number().int().min(0),
  earnedGuildCoins: z.number().int().min(0),
  // Participation
  battlesParticipated: z.number().int().min(0),
  battlesWon: z.number().int().min(0),
  joinedAt: z.string().datetime(),
  // Total power (cached)
  power: z.number().int().min(0).optional(),
});
export type GuildMember = z.infer<typeof GuildMemberSchema>;

// Guild Tech tree structure
export const GuildTechLevelsSchema = z.object({
  fortress: z.object({
    hp: z.number().int().min(0).max(10).default(0),
    damage: z.number().int().min(0).max(10).default(0),
    regen: z.number().int().min(0).max(5).default(0),
  }),
  hero: z.object({
    hp: z.number().int().min(0).max(10).default(0),
    damage: z.number().int().min(0).max(10).default(0),
    cooldown: z.number().int().min(0).max(5).default(0),
  }),
  turret: z.object({
    damage: z.number().int().min(0).max(10).default(0),
    speed: z.number().int().min(0).max(10).default(0),
    range: z.number().int().min(0).max(5).default(0),
  }),
  economy: z.object({
    gold: z.number().int().min(0).max(10).default(0),
    dust: z.number().int().min(0).max(10).default(0),
    xp: z.number().int().min(0).max(5).default(0),
  }),
});
export type GuildTechLevels = z.infer<typeof GuildTechLevelsSchema>;

export const GuildSchema = z.object({
  id: z.string(),
  name: z.string(),
  tag: z.string(),
  description: z.string().nullable(),
  level: z.number().int().min(1).max(20),
  xp: z.number().int().min(0),
  totalXp: z.number().int().min(0),
  honor: z.number().int().min(0),
  guildCoins: z.number().int().min(0),
  techLevels: GuildTechLevelsSchema,
  trophies: z.array(z.string()),
  settings: GuildSettingsSchema,
  disbanded: z.boolean(),
  createdAt: z.string().datetime(),
  memberCount: z.number().int().min(0).optional(),
  maxMembers: z.number().int().min(10).max(20).optional(),
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
  guildLevel: z.number().int().min(1).max(20),
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
  level: z.number().int().min(1).max(20),
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
  xpContributed: z.number().int().min(0),
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
// PROGRESSION
// ============================================================================

export const GuildLevelInfoSchema = z.object({
  level: z.number().int().min(1).max(20),
  xp: z.number().int().min(0),
  xpToNextLevel: z.number().int().min(0),
  totalXp: z.number().int().min(0),
  memberCapacity: z.number().int().min(10).max(20),
  bonuses: z.object({
    goldBoost: z.number().min(0).max(1),
    statBoost: z.number().min(0).max(1),
    xpBoost: z.number().min(0).max(1),
  }),
});
export type GuildLevelInfo = z.infer<typeof GuildLevelInfoSchema>;

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
  guildCoinsEarned: z.number().int().min(0),
});
export type GuildBossAttackResponse = z.infer<typeof GuildBossAttackResponseSchema>;

// ============================================================================
// GUILD TECH
// ============================================================================

export const GuildTechTreeTypeSchema = z.enum(['fortress', 'hero', 'turret', 'economy']);
export type GuildTechTreeType = z.infer<typeof GuildTechTreeTypeSchema>;

export const GuildTechStatTypeSchema = z.enum([
  'hp', 'damage', 'regen', 'cooldown', 'speed', 'range', 'gold', 'dust', 'xp'
]);
export type GuildTechStatType = z.infer<typeof GuildTechStatTypeSchema>;

export const UpgradeTechRequestSchema = z.object({
  tree: GuildTechTreeTypeSchema,
  stat: GuildTechStatTypeSchema,
});
export type UpgradeTechRequest = z.infer<typeof UpgradeTechRequestSchema>;

export const GuildTechBonusesSchema = z.object({
  fortress: z.object({
    hpPercent: z.number().min(0).max(0.2),
    damagePercent: z.number().min(0).max(0.2),
    regenPercent: z.number().min(0).max(0.1),
  }),
  hero: z.object({
    hpPercent: z.number().min(0).max(0.2),
    damagePercent: z.number().min(0).max(0.2),
    cooldownReductionPercent: z.number().min(0).max(0.1),
  }),
  turret: z.object({
    damagePercent: z.number().min(0).max(0.2),
    speedPercent: z.number().min(0).max(0.2),
    rangePercent: z.number().min(0).max(0.1),
  }),
  economy: z.object({
    goldPercent: z.number().min(0).max(0.2),
    dustPercent: z.number().min(0).max(0.2),
    xpPercent: z.number().min(0).max(0.1),
  }),
});
export type GuildTechBonuses = z.infer<typeof GuildTechBonusesSchema>;

export const GuildTechResponseSchema = z.object({
  techLevels: GuildTechLevelsSchema,
  bonuses: GuildTechBonusesSchema,
  guildCoins: z.number().int().min(0),
  canUpgrade: z.boolean(),
});
export type GuildTechResponse = z.infer<typeof GuildTechResponseSchema>;

export const TechUpgradeCostSchema = z.object({
  tree: GuildTechTreeTypeSchema,
  stat: GuildTechStatTypeSchema,
  currentLevel: z.number().int().min(0),
  maxLevel: z.number().int().min(1),
  cost: z.number().int().min(0),
  canAfford: z.boolean(),
});
export type TechUpgradeCost = z.infer<typeof TechUpgradeCostSchema>;

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

  // Member limits
  MAX_MEMBERS_BASE: 10,
  MAX_MEMBERS_CAP: 20,

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

  // XP sources
  XP_PER_WAVE: 5,
  XP_PER_RUN: 25,
  XP_PER_100_GOLD_DONATED: 1,
  XP_PER_10_DUST_DONATED: 2,
  XP_PER_BATTLE_WIN: 500,
  XP_PER_BATTLE_PARTICIPATION: 100,
  XP_WEEKLY_ACTIVITY_BONUS: 1000,
  XP_PER_1000_BOSS_DAMAGE: 1,

  // Guild Coins rewards
  COINS_ARENA_WIN: 100,
  COINS_ARENA_LOSS: 30,
  COINS_BOSS_PARTICIPATION: 50,
  COINS_BOSS_TOP_DAMAGE: 200,
  COINS_TOWER_RACE_TOP_3: [500, 300, 100] as readonly number[],

  // Guild Tech
  TECH_COST_BASE: 100, // Cost = 100 × (currentLevel + 1)
  TECH_BONUS_PER_LEVEL: 0.02, // +2% per level

  // Guild Boss
  BOSS_TOTAL_HP: 50_000_000,
  BOSS_ATTACKS_PER_DAY: 1,
} as const;

// Guild level progression table
// Bonuses: goldBoost, statBoost (HP/damage for fortress/heroes), xpBoost - all 0-20% at level 20
export const GUILD_LEVEL_TABLE = [
  { level: 1, xpRequired: 0, memberCap: 10, goldBoost: 0, statBoost: 0, xpBoost: 0 },
  { level: 2, xpRequired: 1000, memberCap: 10, goldBoost: 0.01, statBoost: 0.01, xpBoost: 0.01 },
  { level: 3, xpRequired: 2500, memberCap: 11, goldBoost: 0.02, statBoost: 0.02, xpBoost: 0.02 },
  { level: 4, xpRequired: 5000, memberCap: 11, goldBoost: 0.03, statBoost: 0.03, xpBoost: 0.03 },
  { level: 5, xpRequired: 10000, memberCap: 12, goldBoost: 0.04, statBoost: 0.04, xpBoost: 0.04 },
  { level: 6, xpRequired: 17500, memberCap: 12, goldBoost: 0.05, statBoost: 0.05, xpBoost: 0.05 },
  { level: 7, xpRequired: 27500, memberCap: 13, goldBoost: 0.06, statBoost: 0.06, xpBoost: 0.06 },
  { level: 8, xpRequired: 40000, memberCap: 13, goldBoost: 0.07, statBoost: 0.07, xpBoost: 0.07 },
  { level: 9, xpRequired: 55000, memberCap: 14, goldBoost: 0.08, statBoost: 0.08, xpBoost: 0.08 },
  { level: 10, xpRequired: 75000, memberCap: 14, goldBoost: 0.10, statBoost: 0.10, xpBoost: 0.10 },
  { level: 11, xpRequired: 100000, memberCap: 15, goldBoost: 0.11, statBoost: 0.11, xpBoost: 0.11 },
  { level: 12, xpRequired: 130000, memberCap: 15, goldBoost: 0.12, statBoost: 0.12, xpBoost: 0.12 },
  { level: 13, xpRequired: 165000, memberCap: 16, goldBoost: 0.13, statBoost: 0.13, xpBoost: 0.13 },
  { level: 14, xpRequired: 205000, memberCap: 16, goldBoost: 0.14, statBoost: 0.14, xpBoost: 0.14 },
  { level: 15, xpRequired: 250000, memberCap: 17, goldBoost: 0.15, statBoost: 0.15, xpBoost: 0.15 },
  { level: 16, xpRequired: 300000, memberCap: 17, goldBoost: 0.16, statBoost: 0.16, xpBoost: 0.16 },
  { level: 17, xpRequired: 360000, memberCap: 18, goldBoost: 0.17, statBoost: 0.17, xpBoost: 0.17 },
  { level: 18, xpRequired: 430000, memberCap: 18, goldBoost: 0.18, statBoost: 0.18, xpBoost: 0.18 },
  { level: 19, xpRequired: 510000, memberCap: 19, goldBoost: 0.19, statBoost: 0.19, xpBoost: 0.19 },
  { level: 20, xpRequired: 600000, memberCap: 20, goldBoost: 0.20, statBoost: 0.20, xpBoost: 0.20 },
] as const;

// Trophy definitions
export const GUILD_TROPHIES = {
  FIRST_BLOOD: {
    id: 'FIRST_BLOOD',
    name: 'First Blood',
    description: 'Win your first guild battle',
    requirement: '1 battle win',
    bonus: '+5 to all member stats',
  },
  BATTLE_HARDENED: {
    id: 'BATTLE_HARDENED',
    name: 'Battle Hardened',
    description: 'Win 10 guild battles',
    requirement: '10 battle wins',
    bonus: '+10 to all member stats',
  },
  WAR_MACHINE: {
    id: 'WAR_MACHINE',
    name: 'War Machine',
    description: 'Win 50 guild battles',
    requirement: '50 battle wins',
    bonus: '+20 to all member stats',
  },
  WEALTHY: {
    id: 'WEALTHY',
    name: 'Wealthy',
    description: 'Accumulate 1M gold in treasury (lifetime)',
    requirement: '1,000,000 gold deposited',
    bonus: '+5% gold from all sources',
  },
  UNITED: {
    id: 'UNITED',
    name: 'United',
    description: 'Reach maximum member capacity',
    requirement: '20 members',
    bonus: '+5% XP from all sources',
  },
  ANCIENT: {
    id: 'ANCIENT',
    name: 'Ancient',
    description: 'Guild exists for 90 days',
    requirement: '90 days since creation',
    bonus: '+5% dust from all sources',
  },
  CHAMPIONS: {
    id: 'CHAMPIONS',
    name: 'Champions',
    description: 'Reach top 10 in weekly leaderboard',
    requirement: 'Top 10 weekly ranking',
    bonus: 'Champion badge display',
  },
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

  // Guild Tech errors
  TECH_MAX_LEVEL: 'TECH_MAX_LEVEL',
  TECH_INSUFFICIENT_COINS: 'TECH_INSUFFICIENT_COINS',
  TECH_INVALID_STAT: 'TECH_INVALID_STAT',
} as const;

export type GuildErrorCode = keyof typeof GUILD_ERROR_CODES;
