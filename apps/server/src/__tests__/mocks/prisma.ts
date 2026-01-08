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
  $transaction: ReturnType<typeof vi.fn>;
  $connect: ReturnType<typeof vi.fn>;
  $disconnect: ReturnType<typeof vi.fn>;
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
  $transaction: vi.fn((callback: unknown) => typeof callback === 'function' ? callback(mockPrisma) : []),
  $connect: vi.fn(),
  $disconnect: vi.fn(),
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
  mockPrisma.$transaction.mockImplementation((callback: unknown) => typeof callback === 'function' ? callback(mockPrisma) : []);
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
    createdAt: new Date(),
    currentWave: 0,
    highestWave: 0,
    activeGameSessionId: null,
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
    sigils: 0,
    materials: {},
    items: {},
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
