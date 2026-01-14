/**
 * Prisma mock for testing
 */
import { vi } from 'vitest';

// Type for mock Prisma operations
interface MockPrismaOperations {
  findUnique: ReturnType<typeof vi.fn>;
  findFirst: ReturnType<typeof vi.fn>;
  findMany: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  updateMany: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  deleteMany: ReturnType<typeof vi.fn>;
  count: ReturnType<typeof vi.fn>;
  groupBy: ReturnType<typeof vi.fn>;
  aggregate: ReturnType<typeof vi.fn>;
}

function createMockOperations(): MockPrismaOperations {
  return {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
    aggregate: vi.fn(),
  };
}

// Define the mock type first
interface MockPrisma {
  user: MockPrismaOperations;
  session: MockPrismaOperations;
  inventory: MockPrismaOperations;
  progression: MockPrismaOperations;
  relicUnlock: MockPrismaOperations;
  run: MockPrismaOperations;
  runEvent: MockPrismaOperations;
  leaderboardEntry: MockPrismaOperations;
  telemetryEvent: MockPrismaOperations;
  gameSession: MockPrismaOperations;
  segment: MockPrismaOperations;
  playerArtifact: MockPrismaOperations;
  bulkReward: MockPrismaOperations;
  playerRewardClaim: MockPrismaOperations;
  bossRushSession: MockPrismaOperations;
  bossRushLeaderboardEntry: MockPrismaOperations;
  powerUpgrades: MockPrismaOperations;
  scheduledEvent: MockPrismaOperations;
  gameConfig: MockPrismaOperations;
  dailyQuestProgress: MockPrismaOperations;
  // Guild system
  guild: MockPrismaOperations;
  guildMember: MockPrismaOperations;
  guildInvitation: MockPrismaOperations;
  guildTreasury: MockPrismaOperations;
  guildTreasuryLog: MockPrismaOperations;
  guildUpgrade: MockPrismaOperations;
  guildLeaderboardEntry: MockPrismaOperations;
  guildBattle: MockPrismaOperations;
  guildBattleResult: MockPrismaOperations;
  guildTowerRace: MockPrismaOperations;
  guildTowerRaceEntry: MockPrismaOperations;
  guildBoss: MockPrismaOperations;
  guildBossAttempt: MockPrismaOperations;
  guildShield: MockPrismaOperations;
  // PvP system
  pvpChallenge: MockPrismaOperations;
  pvpResult: MockPrismaOperations;
  // Messaging system
  messageThread: MockPrismaOperations;
  messageParticipant: MockPrismaOperations;
  message: MockPrismaOperations;
  messageReport: MockPrismaOperations;
  userBlock: MockPrismaOperations;
  userMute: MockPrismaOperations;
  // Player leaderboard system
  weeklyPlayerLeaderboard: MockPrismaOperations;
  playerWeeklyReward: MockPrismaOperations;
  // IAP
  iAPTransaction: MockPrismaOperations;
  // Mastery system
  masteryProgress: MockPrismaOperations;
  // Pillar Challenge system
  pillarChallengeSession: MockPrismaOperations;
  pillarChallengeLimits: MockPrismaOperations;
  crystalProgress: MockPrismaOperations;
  $transaction: ReturnType<typeof vi.fn>;
  $connect: ReturnType<typeof vi.fn>;
  $disconnect: ReturnType<typeof vi.fn>;
  $queryRaw: ReturnType<typeof vi.fn>;
}

export const mockPrisma: MockPrisma = {
  user: createMockOperations(),
  session: createMockOperations(),
  inventory: createMockOperations(),
  progression: createMockOperations(),
  relicUnlock: createMockOperations(),
  run: createMockOperations(),
  runEvent: createMockOperations(),
  leaderboardEntry: createMockOperations(),
  telemetryEvent: createMockOperations(),
  gameSession: createMockOperations(),
  segment: createMockOperations(),
  playerArtifact: createMockOperations(),
  bulkReward: createMockOperations(),
  playerRewardClaim: createMockOperations(),
  bossRushSession: createMockOperations(),
  bossRushLeaderboardEntry: createMockOperations(),
  powerUpgrades: createMockOperations(),
  scheduledEvent: createMockOperations(),
  gameConfig: createMockOperations(),
  dailyQuestProgress: createMockOperations(),
  // Guild system
  guild: createMockOperations(),
  guildMember: createMockOperations(),
  guildInvitation: createMockOperations(),
  guildTreasury: createMockOperations(),
  guildTreasuryLog: createMockOperations(),
  guildUpgrade: createMockOperations(),
  guildLeaderboardEntry: createMockOperations(),
  guildBattle: createMockOperations(),
  guildBattleResult: createMockOperations(),
  guildTowerRace: createMockOperations(),
  guildTowerRaceEntry: createMockOperations(),
  guildBoss: createMockOperations(),
  guildBossAttempt: createMockOperations(),
  guildShield: createMockOperations(),
  // PvP system
  pvpChallenge: createMockOperations(),
  pvpResult: createMockOperations(),
  // Messaging system
  messageThread: createMockOperations(),
  messageParticipant: createMockOperations(),
  message: createMockOperations(),
  messageReport: createMockOperations(),
  userBlock: createMockOperations(),
  userMute: createMockOperations(),
  // Player leaderboard system
  weeklyPlayerLeaderboard: createMockOperations(),
  playerWeeklyReward: createMockOperations(),
  // IAP
  iAPTransaction: createMockOperations(),
  // Mastery system
  masteryProgress: createMockOperations(),
  // Pillar Challenge system
  pillarChallengeSession: createMockOperations(),
  pillarChallengeLimits: createMockOperations(),
  crystalProgress: createMockOperations(),
  $transaction: vi.fn(async (input: unknown): Promise<unknown> => {
    if (typeof input === 'function') {
      return input(mockPrisma);
    }
    // Handle array of promises (batch transaction)
    if (Array.isArray(input)) {
      return Promise.all(input);
    }
    return [];
  }) as unknown as ReturnType<typeof vi.fn>,
  $connect: vi.fn(),
  $disconnect: vi.fn(),
  $queryRaw: vi.fn(),
};

/**
 * Reset all Prisma mocks
 */
export function resetPrismaMock(): void {
  Object.values(mockPrisma).forEach(model => {
    if (typeof model === 'object' && model !== null) {
      Object.values(model).forEach(method => {
        if (typeof method === 'function' && 'mockReset' in method) {
          (method as ReturnType<typeof vi.fn>).mockReset();
        }
      });
    }
  });
  mockPrisma.$transaction.mockReset();
  mockPrisma.$transaction.mockImplementation(async (input: unknown): Promise<unknown> => {
    if (typeof input === 'function') {
      return input(mockPrisma);
    }
    // Handle array of promises (batch transaction)
    if (Array.isArray(input)) {
      return Promise.all(input);
    }
    return [];
  });
  mockPrisma.$queryRaw.mockReset();
}

/**
 * Helper to create mock user data
 */
export function createMockUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-123',
    username: 'testuser',
    passwordHash: '$2b$12$test-hashed-password',
    displayName: 'TestUser',
    role: 'USER',
    createdAt: new Date(),
    currentWave: 0,
    highestWave: 0,
    activeGameSessionId: null,
    onboardingCompleted: false,
    defaultFortressClass: null,
    defaultHeroId: null,
    defaultTurretType: null,
    ...overrides,
  };
}

/**
 * Helper to create mock inventory data
 */
export function createMockInventory(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv-123',
    userId: 'user-123',
    gold: 100,
    dust: 50,
    materials: {},
    items: {},
    unlockedHeroIds: [],
    unlockedTurretIds: [],
    version: 1,
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Helper to create mock progression data
 */
export function createMockProgression(overrides: Record<string, unknown> = {}) {
  return {
    id: 'progression-123',
    userId: 'user-123',
    level: 1,
    xp: 0,
    totalXp: 0,
    version: 1,
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Helper to create mock session data
 */
export function createMockSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-123',
    userId: 'user-123',
    refreshToken: 'test-refresh-token',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    revoked: false,
    createdAt: new Date(),
    ...overrides,
  };
}

/**
 * Helper to create mock run data
 */
export function createMockRun(overrides: Record<string, unknown> = {}) {
  return {
    id: 'run-123',
    userId: 'user-123',
    seed: 12345,
    simVersion: 1,
    tickHz: 30,
    maxWaves: 10,
    auditTicks: [100, 200, 300],
    issuedAt: new Date(),
    endedAt: null,
    verified: null,
    rejectReason: null,
    finalHash: null,
    score: null,
    summaryJson: null,
    ...overrides,
  };
}

/**
 * Helper to create mock game session data
 */
export function createMockGameSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'gs-123',
    userId: 'user-123',
    seed: 12345,
    startedAt: new Date(),
    lastActivityAt: new Date(),
    startingWave: 0,
    currentWave: 0,
    relicsJson: '[]',
    lastVerifiedWave: 0,
    lastSegmentHash: 0,
    endedAt: null,
    endReason: null,
    ...overrides,
  };
}

/**
 * Helper to create mock leaderboard entry
 */
export function createMockLeaderboardEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lb-123',
    weekKey: '2024-01',
    userId: 'user-123',
    score: 10000,
    runId: 'run-123',
    createdAt: new Date(),
    ...overrides,
  };
}

/**
 * Helper to create mock relic unlock
 */
export function createMockRelicUnlock(relicId: string, overrides: Record<string, unknown> = {}) {
  return {
    id: `unlock-${relicId}`,
    userId: 'user-123',
    relicId,
    unlockedAt: new Date(),
    ...overrides,
  };
}

/**
 * Helper to create mock player artifact
 */
export function createMockPlayerArtifact(artifactId: string, overrides: Record<string, unknown> = {}) {
  return {
    id: `artifact-${artifactId}`,
    userId: 'user-123',
    artifactId,
    equippedToHeroId: null,
    acquiredAt: new Date(),
    ...overrides,
  };
}

// ============================================================================
// GUILD SYSTEM MOCKS
// ============================================================================

/**
 * Helper to create mock guild data
 */
export function createMockGuild(overrides: Record<string, unknown> = {}) {
  return {
    id: 'guild-123',
    name: 'Test Guild',
    tag: 'TEST',
    description: 'A test guild',
    level: 1,
    xp: 0,
    totalXp: 0,
    honor: 1000,
    trophies: [],
    settings: { minLevel: 1, autoAcceptInvites: false, battleCooldownHours: 24 },
    disbanded: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Helper to create mock guild member data
 */
export function createMockGuildMember(overrides: Record<string, unknown> = {}) {
  return {
    id: 'member-123',
    guildId: 'guild-123',
    userId: 'user-123',
    role: 'MEMBER',
    totalGoldDonated: 0,
    totalDustDonated: 0,
    weeklyXpContributed: 0,
    battlesParticipated: 0,
    battlesWon: 0,
    joinedAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Helper to create mock guild invitation data
 */
export function createMockGuildInvitation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'invitation-123',
    guildId: 'guild-123',
    inviterId: 'user-123',
    inviteeId: 'user-456',
    status: 'PENDING',
    message: null,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
    respondedAt: null,
    ...overrides,
  };
}

/**
 * Helper to create mock guild treasury data
 */
export function createMockGuildTreasury(overrides: Record<string, unknown> = {}) {
  return {
    id: 'treasury-123',
    guildId: 'guild-123',
    gold: 0,
    dust: 0,
    totalGoldDeposited: BigInt(0),
    totalDustDeposited: BigInt(0),
    version: 1,
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Helper to create mock guild treasury log entry
 */
export function createMockGuildTreasuryLog(overrides: Record<string, unknown> = {}) {
  return {
    id: 'treasury-log-123',
    guildId: 'guild-123',
    userId: 'user-123',
    transactionType: 'DEPOSIT_GOLD' as const,
    goldAmount: 0,
    dustAmount: 0,
    description: 'Test transaction',
    referenceId: null,
    balanceAfterGold: 1000,
    balanceAfterDust: 100,
    createdAt: new Date(),
    user: {
      displayName: 'TestUser',
    },
    ...overrides,
  };
}

/**
 * Helper to create mock guild battle data
 */
export function createMockGuildBattle(overrides: Record<string, unknown> = {}) {
  return {
    id: 'battle-123',
    attackerGuildId: 'guild-123',
    defenderGuildId: 'guild-456',
    attackerUserId: 'user-123',
    attackerMemberIds: ['user-123', 'user-124', 'user-125', 'user-126', 'user-127'],
    defenderMemberIds: ['user-456', 'user-457', 'user-458', 'user-459', 'user-460'],
    attackerHeroes: '[]',
    defenderHeroes: '[]',
    seed: 12345,
    status: 'RESOLVED',
    createdAt: new Date(),
    resolvedAt: new Date(),
    winnerGuildId: 'guild-123',
    isRevenge: false,
    ...overrides,
  };
}

// ============================================================================
// PVP SYSTEM MOCKS
// ============================================================================

/**
 * Helper to create mock PvP challenge data
 */
export function createMockPvpChallenge(overrides: Record<string, unknown> = {}) {
  return {
    id: 'challenge-123',
    challengerId: 'user-123',
    challengedId: 'user-456',
    challengerPower: 1000,
    challengedPower: 950,
    status: 'PENDING',
    seed: null,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    acceptedAt: null,
    resolvedAt: null,
    winnerId: null,
    ...overrides,
  };
}

/**
 * Helper to create mock PvP result data
 */
export function createMockPvpResult(overrides: Record<string, unknown> = {}) {
  return {
    id: 'result-123',
    challengeId: 'challenge-123',
    winnerId: 'user-123',
    winReason: 'fortress_destroyed',
    challengerFinalHp: 500,
    challengerDamageDealt: 15000,
    challengerHeroesAlive: 2,
    challengedFinalHp: 0,
    challengedDamageDealt: 12000,
    challengedHeroesAlive: 0,
    duration: 180,
    challengerBuild: {},
    challengedBuild: {},
    replayEvents: [],
    resolvedAt: new Date(),
    ...overrides,
  };
}

/**
 * Helper to create mock power upgrades data
 */
export function createMockPowerUpgrades(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'user-123',
    cachedTotalPower: 1000,
    fortressUpgrades: { statUpgrades: { hp: 5, damage: 5 } },
    heroUpgrades: {},
    turretUpgrades: {},
    updatedAt: new Date(),
    ...overrides,
  };
}

// ============================================================================
// GUILD BOSS MOCKS
// ============================================================================

/**
 * Helper to create mock guild boss data
 */
export function createMockGuildBoss(overrides: Record<string, unknown> = {}) {
  const endsAt = new Date();
  endsAt.setDate(endsAt.getDate() + 7); // Boss ends in 7 days

  return {
    id: 'boss-123',
    weekKey: '2026-W02',
    bossType: 'dragon',
    totalHp: BigInt(50000000),
    currentHp: BigInt(50000000),
    weakness: 'castle',
    endsAt,
    createdAt: new Date(),
    ...overrides,
  };
}

/**
 * Helper to create mock guild boss attempt data
 */
export function createMockGuildBossAttempt(overrides: Record<string, unknown> = {}) {
  return {
    id: 'attempt-123',
    guildBossId: 'boss-123',
    guildId: 'guild-123',
    userId: 'user-123',
    damage: BigInt(100000),
    heroId: 'THUNDERLORD',
    heroTier: 2,
    heroPower: 1500,
    attemptedAt: new Date(),
    ...overrides,
  };
}

/**
 * Helper to create mock guild tower race data
 */
export function createMockGuildTowerRace(overrides: Record<string, unknown> = {}) {
  const endsAt = new Date();
  endsAt.setDate(endsAt.getDate() + 7);

  return {
    id: 'race-123',
    weekKey: '2026-W02',
    status: 'active',
    startedAt: new Date(),
    endsAt,
    createdAt: new Date(),
    ...overrides,
  };
}

/**
 * Helper to create mock guild tower race entry data
 */
export function createMockGuildTowerRaceEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'entry-123',
    raceId: 'race-123',
    guildId: 'guild-123',
    totalWaves: 1000,
    memberContributions: { 'user-123': 500, 'user-456': 500 },
    lastUpdatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Helper to create mock guild shield data
 */
export function createMockGuildShield(overrides: Record<string, unknown> = {}) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 1);

  // Generate current week key (YYYY-Www format) - must match guildBattle.ts getCurrentWeekKey()
  const now = new Date();
  const year = now.getFullYear();
  const oneJan = new Date(year, 0, 1);
  const dayOfYear = Math.floor((now.getTime() - oneJan.getTime()) / 86400000) + 1;
  const weekNumber = Math.ceil(dayOfYear / 7);
  const weekKey = `${year}-W${weekNumber.toString().padStart(2, '0')}`;

  return {
    id: 'shield-123',
    guildId: 'guild-123',
    activatedAt: new Date(),
    expiresAt,
    activatedBy: 'user-123',
    weekKey,
    weeklyCount: 1,
    goldCost: 5000,
    ...overrides,
  };
}

// ============================================================================
// BOSS RUSH MOCKS
// ============================================================================

/**
 * Helper to create mock boss rush session data
 */
export function createMockBossRushSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'brs-123',
    userId: 'user-123',
    sessionToken: 'mock-session-token',
    seed: 12345,
    loadoutJson: {
      fortressClass: 'natural',
      heroIds: ['vanguard'],
      turretTypes: ['railgun'],
    },
    startedAt: new Date(),
    endedAt: null,
    verified: null,
    rejectReason: null,
    bossesKilled: 0,
    totalDamageDealt: BigInt(0),
    goldEarned: 0,
    dustEarned: 0,
    xpEarned: 0,
    materialsEarned: {},
    finalHash: null,
    ...overrides,
  };
}

/**
 * Helper to create mock boss rush leaderboard entry data
 */
export function createMockBossRushLeaderboardEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'brle-123',
    weekKey: '2026-W02',
    userId: 'user-123',
    sessionId: 'brs-123',
    totalDamageDealt: BigInt(1000000),
    bossesKilled: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ============================================================================
// MASTERY SYSTEM MOCKS
// ============================================================================

/**
 * Helper to create mock mastery progress data
 */
export function createMockMasteryProgress(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mastery-123',
    userId: 'user-123',
    availablePoints: 10,
    totalEarned: 15,
    classProgress: {
      natural: { pointsSpent: 5, unlockedNodes: ['natural_t1_hp1', 'natural_t1_hp2'] },
      ice: { pointsSpent: 0, unlockedNodes: [] },
      fire: { pointsSpent: 0, unlockedNodes: [] },
      lightning: { pointsSpent: 0, unlockedNodes: [] },
      tech: { pointsSpent: 0, unlockedNodes: [] },
      void: { pointsSpent: 0, unlockedNodes: [] },
      plasma: { pointsSpent: 0, unlockedNodes: [] },
    },
    version: 1,
    updatedAt: new Date(),
    ...overrides,
  };
}

// ============================================================================
// PILLAR CHALLENGE MOCKS
// ============================================================================

/**
 * Helper to create mock pillar challenge session data
 */
export function createMockPillarChallengeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pcs-123',
    userId: 'user-123',
    pillarId: 'streets',
    tier: 1,
    seed: 12345,
    loadoutJson: {
      fortressClass: 'natural',
      heroes: [{ heroId: 'vanguard', artifacts: [] }],
      turrets: [{ turretId: 'railgun', slotIndex: 0 }],
    },
    startedAt: new Date(),
    endedAt: null,
    wavesCleared: 0,
    fortressDamageTaken: 0,
    heroesLost: 0,
    fragmentsEarned: 0,
    fullCrystalEarned: false,
    crystalType: null,
    goldEarned: 0,
    materialsEarned: {},
    bonusesAchieved: [],
    finalHash: null,
    verified: null,
    ...overrides,
  };
}

/**
 * Helper to create mock pillar challenge limits data
 */
export function createMockPillarChallengeLimits(overrides: Record<string, unknown> = {}) {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);

  return {
    id: 'pcl-123',
    userId: 'user-123',
    dailyAttempts: 0,
    dailyPaidAttempts: 0,
    lastAttemptAt: null,
    dailyResetAt: tomorrow,
    ...overrides,
  };
}

/**
 * Helper to create mock crystal progress data
 */
export function createMockCrystalProgress(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cp-123',
    userId: 'user-123',
    powerFragments: 0,
    spaceFragments: 0,
    timeFragments: 0,
    realityFragments: 0,
    soulFragments: 0,
    mindFragments: 0,
    fullCrystals: [] as string[],
    matrixAssembled: false,
    updatedAt: new Date(),
    ...overrides,
  };
}
