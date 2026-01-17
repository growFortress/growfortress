/**
 * Boss Rush Service Unit Tests
 *
 * Tests for session lifecycle, verification, anti-cheat, and rewards
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  mockPrisma,
  createMockUser,
  createMockInventory,
  createMockProgression,
  createMockBossRushSession,
} from '../../mocks/prisma.js';

// Mock prisma
vi.mock('../../../lib/prisma.js', () => ({
  prisma: mockPrisma,
}));

// Mock tokens
vi.mock('../../../lib/tokens.js', () => ({
  createBossRushToken: vi.fn().mockResolvedValue('mock-session-token'),
  verifyBossRushToken: vi.fn(),
  resetTokenSecrets: vi.fn(),
}));

// Mock auth service
vi.mock('../../../services/auth.js', () => ({
  getUserProfile: vi.fn(),
}));

// Mock leaderboard
vi.mock('../../../services/bossRushLeaderboard.js', () => ({
  upsertBossRushLeaderboardEntry: vi.fn().mockResolvedValue(undefined),
  getUserBossRushRank: vi.fn().mockResolvedValue({ rank: 1 }),
}));

// Mock queue
vi.mock('../../../lib/queue.js', () => ({
  getCurrentWeekKey: vi.fn().mockReturnValue('2026-W02'),
}));

import {
  startBossRushSession,
  finishBossRushSession,
  getBossRushSession,
  getBossRushHistory,
  BossRushError,
} from '../../../services/bossRush.js';
import { verifyBossRushToken, createBossRushToken } from '../../../lib/tokens.js';
import { getUserProfile } from '../../../services/auth.js';

describe('Boss Rush Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-establish default mock implementations after clearing
    (createBossRushToken as ReturnType<typeof vi.fn>).mockResolvedValue('mock-session-token');
  });

  // ============================================================================
  // START SESSION TESTS
  // ============================================================================

  describe('startBossRushSession', () => {
    it('creates session with correct seed', async () => {
      const mockUser = createMockUser();
      const mockInventory = createMockInventory({ gold: 500, dust: 100 });
      const mockProgression = createMockProgression({ level: 10 });

      (getUserProfile as ReturnType<typeof vi.fn>).mockResolvedValue({
        userId: 'user-123',
        displayName: 'TestUser',
      });

      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        inventory: mockInventory,
        progression: mockProgression,
      });

      mockPrisma.bossRushSession.create.mockResolvedValue(
        createMockBossRushSession({ seed: 12345 })
      );

      const result = await startBossRushSession('user-123');

      expect(result).not.toBeNull();
      expect(result!.seed).toBeDefined();
      expect(typeof result!.seed).toBe('number');
      expect(result!.seed).toBeGreaterThan(0);
    });

    it('generates unique sessionToken', async () => {
      const mockUser = createMockUser();
      const mockInventory = createMockInventory();
      const mockProgression = createMockProgression();

      (getUserProfile as ReturnType<typeof vi.fn>).mockResolvedValue({
        userId: 'user-123',
        displayName: 'TestUser',
      });

      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        inventory: mockInventory,
        progression: mockProgression,
      });

      mockPrisma.bossRushSession.create.mockResolvedValue(
        createMockBossRushSession()
      );

      const result = await startBossRushSession('user-123');

      expect(result).not.toBeNull();
      expect(result!.sessionToken).toBe('mock-session-token');
    });

    it('returns progression bonuses', async () => {
      const mockUser = createMockUser();
      const mockInventory = createMockInventory();
      const mockProgression = createMockProgression({ level: 30 });

      (getUserProfile as ReturnType<typeof vi.fn>).mockResolvedValue({
        userId: 'user-123',
        displayName: 'TestUser',
      });

      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        inventory: mockInventory,
        progression: mockProgression,
      });

      mockPrisma.bossRushSession.create.mockResolvedValue(
        createMockBossRushSession()
      );

      const result = await startBossRushSession('user-123');

      expect(result).not.toBeNull();
      expect(result!.progressionBonuses).toBeDefined();
      expect(result!.progressionBonuses.maxHeroSlots).toBeGreaterThanOrEqual(3);
      expect(result!.progressionBonuses.maxTurretSlots).toBeGreaterThanOrEqual(2);
    });

    it('uses default loadout when not provided', async () => {
      const mockUser = createMockUser({
        defaultFortressClass: 'ice',
        defaultHeroId: 'thunder_lord',
        defaultTurretType: 'artillery',
      });
      const mockInventory = createMockInventory();
      const mockProgression = createMockProgression();

      (getUserProfile as ReturnType<typeof vi.fn>).mockResolvedValue({
        userId: 'user-123',
        displayName: 'TestUser',
      });

      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        inventory: mockInventory,
        progression: mockProgression,
      });

      mockPrisma.bossRushSession.create.mockResolvedValue(
        createMockBossRushSession()
      );

      await startBossRushSession('user-123');

      expect(mockPrisma.bossRushSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            loadoutJson: expect.objectContaining({
              fortressClass: 'ice',
              heroIds: ['thunder_lord'],
              turretTypes: ['artillery'],
            }),
          }),
        })
      );
    });

    it('returns null when user does not exist', async () => {
      (getUserProfile as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await startBossRushSession('nonexistent-user');

      expect(result).toBeNull();
    });

    it('returns null when user has no inventory', async () => {
      (getUserProfile as ReturnType<typeof vi.fn>).mockResolvedValue({
        userId: 'user-123',
        displayName: 'TestUser',
      });

      mockPrisma.user.findUnique.mockResolvedValue({
        ...createMockUser(),
        inventory: null,
        progression: createMockProgression(),
      });

      const result = await startBossRushSession('user-123');

      expect(result).toBeNull();
    });

    it('returns correct inventory values', async () => {
      const mockInventory = createMockInventory({ gold: 1000, dust: 500 });

      (getUserProfile as ReturnType<typeof vi.fn>).mockResolvedValue({
        userId: 'user-123',
        displayName: 'TestUser',
      });

      mockPrisma.user.findUnique.mockResolvedValue({
        ...createMockUser(),
        inventory: mockInventory,
        progression: createMockProgression(),
      });

      mockPrisma.bossRushSession.create.mockResolvedValue(
        createMockBossRushSession()
      );

      const result = await startBossRushSession('user-123');

      expect(result!.inventory.gold).toBe(1000);
      expect(result!.inventory.dust).toBe(500);
    });

    it('returns correct commander level', async () => {
      (getUserProfile as ReturnType<typeof vi.fn>).mockResolvedValue({
        userId: 'user-123',
        displayName: 'TestUser',
      });

      mockPrisma.user.findUnique.mockResolvedValue({
        ...createMockUser(),
        inventory: createMockInventory(),
        progression: createMockProgression({ level: 25 }),
      });

      mockPrisma.bossRushSession.create.mockResolvedValue(
        createMockBossRushSession()
      );

      const result = await startBossRushSession('user-123');

      expect(result!.commanderLevel).toBe(25);
    });
  });

  // ============================================================================
  // FINISH SESSION TESTS
  // ============================================================================

  describe('finishBossRushSession', () => {
    const validFinishRequest = {
      sessionToken: 'valid-token',
      events: [],
      checkpoints: [],
      summary: {
        totalDamageDealt: 500000,
        bossesKilled: 5,
        cyclesCompleted: 0,
        goldEarned: 1000,
        dustEarned: 500,
        materialsEarned: {},
        timeSurvived: 9000, // 5 minutes at 30Hz
      },
      finalHash: 12345,
    };

    it('verifies token', async () => {
      (verifyBossRushToken as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await finishBossRushSession(
        'brs-123',
        'user-123',
        validFinishRequest
      );

      expect(result.verified).toBe(false);
      expect(result.rejectReason).toBe('TOKEN_INVALID');
    });

    it('blocks double finish', async () => {
      (verifyBossRushToken as ReturnType<typeof vi.fn>).mockResolvedValue({
        sessionId: 'brs-123',
      });

      mockPrisma.bossRushSession.findUnique.mockResolvedValue(
        createMockBossRushSession({ endedAt: new Date() })
      );

      const result = await finishBossRushSession(
        'brs-123',
        'user-123',
        validFinishRequest
      );

      expect(result.verified).toBe(false);
      expect(result.rejectReason).toBe('SESSION_ALREADY_FINISHED');
    });

    it('rejects session from another user', async () => {
      (verifyBossRushToken as ReturnType<typeof vi.fn>).mockResolvedValue({
        sessionId: 'brs-123',
      });

      mockPrisma.bossRushSession.findUnique.mockResolvedValue(
        createMockBossRushSession({ userId: 'user-999' })
      );

      const result = await finishBossRushSession(
        'brs-123',
        'user-123',
        validFinishRequest
      );

      expect(result.verified).toBe(false);
      expect(result.rejectReason).toBe('SESSION_FORBIDDEN');
    });

    it('returns SESSION_NOT_FOUND for non-existent session', async () => {
      (verifyBossRushToken as ReturnType<typeof vi.fn>).mockResolvedValue({
        sessionId: 'brs-123',
      });

      mockPrisma.bossRushSession.findUnique.mockResolvedValue(null);

      const result = await finishBossRushSession(
        'brs-123',
        'user-123',
        validFinishRequest
      );

      expect(result.verified).toBe(false);
      expect(result.rejectReason).toBe('SESSION_NOT_FOUND');
    });

    it('rejects mismatched session token', async () => {
      (verifyBossRushToken as ReturnType<typeof vi.fn>).mockResolvedValue({
        sessionId: 'brs-different',
      });

      const result = await finishBossRushSession(
        'brs-123',
        'user-123',
        validFinishRequest
      );

      expect(result.verified).toBe(false);
      expect(result.rejectReason).toBe('TOKEN_INVALID');
    });
  });

  // ============================================================================
  // ANTI-CHEAT VALIDATION TESTS
  // ============================================================================

  describe('Anti-cheat Validation', () => {
    const baseFinishRequest = {
      sessionToken: 'valid-token',
      events: [],
      checkpoints: [],
      finalHash: 12345,
    };

    beforeEach(() => {
      (verifyBossRushToken as ReturnType<typeof vi.fn>).mockResolvedValue({
        sessionId: 'brs-123',
      });

      mockPrisma.bossRushSession.findUnique.mockResolvedValue(
        createMockBossRushSession()
      );

      mockPrisma.user.findUnique.mockResolvedValue({
        ...createMockUser(),
        inventory: createMockInventory(),
        progression: createMockProgression(),
      });
    });

    it('rejects damage > 10M per boss (average)', async () => {
      const result = await finishBossRushSession('brs-123', 'user-123', {
        ...baseFinishRequest,
        summary: {
          totalDamageDealt: 100000000, // 100M total
          bossesKilled: 5, // Average 20M per boss
          cyclesCompleted: 0,
          goldEarned: 1000,
          dustEarned: 500,
          materialsEarned: {},
          timeSurvived: 9000,
        },
      });

      expect(result.verified).toBe(false);
      expect(result.rejectReason).toBeDefined();
    });

    it('rejects total damage > 1B', async () => {
      const result = await finishBossRushSession('brs-123', 'user-123', {
        ...baseFinishRequest,
        summary: {
          totalDamageDealt: 2000000000, // 2B
          bossesKilled: 50,
          cyclesCompleted: 0,
          goldEarned: 1000,
          dustEarned: 500,
          materialsEarned: {},
          timeSurvived: 9000,
        },
      });

      expect(result.verified).toBe(false);
      expect(result.rejectReason).toBeDefined();
    });

    it('rejects bosses killed > 100', async () => {
      const result = await finishBossRushSession('brs-123', 'user-123', {
        ...baseFinishRequest,
        summary: {
          totalDamageDealt: 5000000,
          bossesKilled: 150, // Way too many
          cyclesCompleted: 0,
          goldEarned: 1000,
          dustEarned: 500,
          materialsEarned: {},
          timeSurvived: 9000,
        },
      });

      expect(result.verified).toBe(false);
      expect(result.rejectReason).toBeDefined();
    });

    it('rejects time > 2h (216000 ticks at 30Hz)', async () => {
      const result = await finishBossRushSession('brs-123', 'user-123', {
        ...baseFinishRequest,
        summary: {
          totalDamageDealt: 500000,
          bossesKilled: 5,
          cyclesCompleted: 0,
          goldEarned: 1000,
          dustEarned: 500,
          materialsEarned: {},
          timeSurvived: 300000, // ~2.8 hours at 30Hz
        },
      });

      expect(result.verified).toBe(false);
      expect(result.rejectReason).toBeDefined();
    });

    it('rejects negative damage', async () => {
      const result = await finishBossRushSession('brs-123', 'user-123', {
        ...baseFinishRequest,
        summary: {
          totalDamageDealt: -1000,
          bossesKilled: 5,
          cyclesCompleted: 0,
          goldEarned: 1000,
          dustEarned: 500,
          materialsEarned: {},
          timeSurvived: 9000,
        },
      });

      expect(result.verified).toBe(false);
      expect(result.rejectReason).toBeDefined();
    });

    it('rejects negative bosses killed', async () => {
      const result = await finishBossRushSession('brs-123', 'user-123', {
        ...baseFinishRequest,
        summary: {
          totalDamageDealt: 500000,
          bossesKilled: -5,
          cyclesCompleted: 0,
          goldEarned: 1000,
          dustEarned: 500,
          materialsEarned: {},
          timeSurvived: 9000,
        },
      });

      expect(result.verified).toBe(false);
      expect(result.rejectReason).toBeDefined();
    });

    it('rejects negative gold earned', async () => {
      const result = await finishBossRushSession('brs-123', 'user-123', {
        ...baseFinishRequest,
        summary: {
          totalDamageDealt: 500000,
          bossesKilled: 5,
          cyclesCompleted: 0,
          goldEarned: -1000,
          dustEarned: 500,
          materialsEarned: {},
          timeSurvived: 9000,
        },
      });

      expect(result.verified).toBe(false);
      expect(result.rejectReason).toBeDefined();
    });

    it('rejects negative time survived', async () => {
      const result = await finishBossRushSession('brs-123', 'user-123', {
        ...baseFinishRequest,
        summary: {
          totalDamageDealt: 500000,
          bossesKilled: 5,
          cyclesCompleted: 0,
          goldEarned: 1000,
          dustEarned: 500,
          materialsEarned: {},
          timeSurvived: -100,
        },
      });

      expect(result.verified).toBe(false);
      expect(result.rejectReason).toBeDefined();
    });
  });

  // ============================================================================
  // GET SESSION TESTS
  // ============================================================================

  describe('getBossRushSession', () => {
    it('returns session for correct user', async () => {
      mockPrisma.bossRushSession.findUnique.mockResolvedValue(
        createMockBossRushSession({
          bossesKilled: 10,
          totalDamageDealt: BigInt(1500000),
          goldEarned: 2000,
        })
      );

      const result = await getBossRushSession('brs-123', 'user-123');

      expect(result).not.toBeNull();
      expect(result!.sessionId).toBe('brs-123');
      expect(result!.bossesKilled).toBe(10);
      expect(result!.totalDamageDealt).toBe(1500000);
      expect(result!.goldEarned).toBe(2000);
    });

    it('returns null for session belonging to another user', async () => {
      mockPrisma.bossRushSession.findUnique.mockResolvedValue(
        createMockBossRushSession({ userId: 'user-999' })
      );

      const result = await getBossRushSession('brs-123', 'user-123');

      expect(result).toBeNull();
    });

    it('returns null for non-existent session', async () => {
      mockPrisma.bossRushSession.findUnique.mockResolvedValue(null);

      const result = await getBossRushSession('nonexistent', 'user-123');

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // GET HISTORY TESTS
  // ============================================================================

  describe('getBossRushHistory', () => {
    it('returns paginated history', async () => {
      const sessions = [
        createMockBossRushSession({ id: 'brs-1', bossesKilled: 5 }),
        createMockBossRushSession({ id: 'brs-2', bossesKilled: 10 }),
      ];

      mockPrisma.bossRushSession.findMany.mockResolvedValue(sessions);
      mockPrisma.bossRushSession.count.mockResolvedValue(5);

      const result = await getBossRushHistory('user-123', 2, 0);

      expect(result.sessions).toHaveLength(2);
      expect(result.total).toBe(5);
    });

    it('respects limit and offset', async () => {
      mockPrisma.bossRushSession.findMany.mockResolvedValue([]);
      mockPrisma.bossRushSession.count.mockResolvedValue(0);

      await getBossRushHistory('user-123', 5, 10);

      expect(mockPrisma.bossRushSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 5,
        })
      );
    });

    it('orders by startedAt descending', async () => {
      mockPrisma.bossRushSession.findMany.mockResolvedValue([]);
      mockPrisma.bossRushSession.count.mockResolvedValue(0);

      await getBossRushHistory('user-123');

      expect(mockPrisma.bossRushSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { startedAt: 'desc' },
        })
      );
    });

    it('only returns ended sessions', async () => {
      mockPrisma.bossRushSession.findMany.mockResolvedValue([]);
      mockPrisma.bossRushSession.count.mockResolvedValue(0);

      await getBossRushHistory('user-123');

      expect(mockPrisma.bossRushSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-123', endedAt: { not: null } },
        })
      );
    });
  });

  // ============================================================================
  // ERROR CLASS TESTS
  // ============================================================================

  describe('BossRushError', () => {
    it('has correct name and code', () => {
      const error = new BossRushError('Test message', 'SESSION_NOT_FOUND');

      expect(error.name).toBe('BossRushError');
      expect(error.code).toBe('SESSION_NOT_FOUND');
      expect(error.message).toBe('Test message');
    });

    it('extends Error', () => {
      const error = new BossRushError('Test', 'SESSION_NOT_FOUND');

      expect(error instanceof Error).toBe(true);
    });

    it('supports all error codes', () => {
      const codes = [
        'SESSION_NOT_FOUND',
        'USER_NOT_FOUND',
        'SESSION_FORBIDDEN',
        'INVALID_LOADOUT',
        'SESSION_ALREADY_FINISHED',
        'TOKEN_INVALID',
      ] as const;

      for (const code of codes) {
        const error = new BossRushError('Test', code);
        expect(error.code).toBe(code);
      }
    });
  });
});
