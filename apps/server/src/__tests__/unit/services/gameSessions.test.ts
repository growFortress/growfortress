/**
 * Game sessions service tests
 *
 * Note: This file tests the core functionality that can be reliably mocked.
 * Complex integration scenarios with multiple dependencies are better tested
 * in integration tests.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  endGameSession,
  getActiveSession,
  GameSessionError,
} from '../../../services/gameSessions.js';
import {
  mockPrisma,
  createMockUser,
  createMockGameSession,
} from '../../mocks/prisma.js';

// Mock achievements service to avoid database dependencies
vi.mock('../../../services/achievements.js', () => ({
  updateLifetimeStats: vi.fn().mockResolvedValue(undefined),
}));

describe('Game Sessions Service', () => {
  describe('endGameSession', () => {
    it('returns null if session not found', async () => {
      mockPrisma.gameSession.findUnique.mockResolvedValue(null);

      const result = await endGameSession('nonexistent', 'user-123');

      expect(result).toBeNull();
    });

    it('calculates totals from verified segments', async () => {
      const mockUser = createMockUser();
      const mockSession = createMockGameSession({ currentWave: 10 });

      mockPrisma.gameSession.findUnique.mockResolvedValue({
        ...mockSession,
        segments: [
          { goldEarned: 100, dustEarned: 10, xpEarned: 50 },
          { goldEarned: 150, dustEarned: 15, xpEarned: 75 },
        ],
        user: mockUser,
      });

      // Mock progression for level-up calculation
      mockPrisma.progression.findUnique.mockResolvedValue({
        userId: 'user-123',
        level: 1,
        xp: 0,
        totalXp: 0,
        purchasedHeroSlots: 0,
        purchasedTurretSlots: 0,
      });

      mockPrisma.$transaction.mockImplementation(async (callback: unknown) => {
        if (typeof callback === 'function') {
          // Mock inventory.findUnique inside transaction
          mockPrisma.inventory.findUnique.mockResolvedValue({ gold: 1000, dust: 100 });
          // Mock progression.update inside transaction
          mockPrisma.progression.update.mockResolvedValue({
            level: 1,
            xp: 0,
            totalXp: 0,
          });
          return callback(mockPrisma);
        }
        return [];
      });

      const result = await endGameSession('gs-123', 'user-123');

      expect(result!.totalGoldEarned).toBe(250);
      expect(result!.totalDustEarned).toBe(25);
      expect(result!.totalXpEarned).toBe(125);
      expect(result!.finalWave).toBe(10);
      expect(result!.newProgression).toBeDefined();
      expect(result!.newProgression.level).toBe(1);
    });

    it('adds partial rewards if provided', async () => {
      const mockUser = createMockUser();
      const mockSession = createMockGameSession({ currentWave: 8 });

      mockPrisma.gameSession.findUnique.mockResolvedValue({
        ...mockSession,
        segments: [
          { goldEarned: 100, dustEarned: 10, xpEarned: 50 },
        ],
        user: mockUser,
      });

      // Mock progression for level-up calculation
      mockPrisma.progression.findUnique.mockResolvedValue({
        userId: 'user-123',
        level: 1,
        xp: 50,
        totalXp: 50,
        purchasedHeroSlots: 0,
        purchasedTurretSlots: 0,
      });

      mockPrisma.$transaction.mockImplementation(async (callback: unknown) => {
        if (typeof callback === 'function') {
          mockPrisma.inventory.findUnique.mockResolvedValue({ gold: 1150, dust: 115 });
          mockPrisma.progression.update.mockResolvedValue({
            level: 1,
            xp: 75,
            totalXp: 75,
          });
          return callback(mockPrisma);
        }
        return [];
      });

      // Mock scheduledEvent for getActiveMultipliers
      mockPrisma.scheduledEvent.findMany.mockResolvedValue([]);

      const result = await endGameSession('gs-123', 'user-123', 'death', {
        gold: 50,
        dust: 5,
        xp: 25,
        finalWave: 9,
      });

      expect(result!.totalGoldEarned).toBe(150);
      expect(result!.totalDustEarned).toBe(15);
      expect(result!.totalXpEarned).toBe(75);
      expect(result!.finalWave).toBe(9);
      expect(result!.newProgression).toBeDefined();
    });

    it('uses higher wave from partial rewards', async () => {
      const mockUser = createMockUser();
      const mockSession = createMockGameSession({ currentWave: 5 });

      mockPrisma.gameSession.findUnique.mockResolvedValue({
        ...mockSession,
        segments: [],
        user: mockUser,
      });

      // Mock progression for level-up calculation
      mockPrisma.progression.findUnique.mockResolvedValue({
        userId: 'user-123',
        level: 1,
        xp: 0,
        totalXp: 0,
        purchasedHeroSlots: 0,
        purchasedTurretSlots: 0,
      });

      mockPrisma.$transaction.mockImplementation(async (callback: unknown) => {
        if (typeof callback === 'function') {
          mockPrisma.inventory.findUnique.mockResolvedValue({ gold: 1000, dust: 100 });
          mockPrisma.progression.update.mockResolvedValue({
            level: 1,
            xp: 0,
            totalXp: 0,
          });
          return callback(mockPrisma);
        }
        return [];
      });

      // Mock scheduledEvent for getActiveMultipliers
      mockPrisma.scheduledEvent.findMany.mockResolvedValue([]);

      const result = await endGameSession('gs-123', 'user-123', 'death', {
        gold: 0,
        dust: 0,
        xp: 0,
        finalWave: 7,
      });

      expect(result!.finalWave).toBe(7);
    });

    it('handles empty segments', async () => {
      const mockUser = createMockUser();
      const mockSession = createMockGameSession({ currentWave: 2 });

      mockPrisma.gameSession.findUnique.mockResolvedValue({
        ...mockSession,
        segments: [],
        user: mockUser,
      });

      // Mock progression for level-up calculation
      mockPrisma.progression.findUnique.mockResolvedValue({
        userId: 'user-123',
        level: 1,
        xp: 0,
        totalXp: 0,
        purchasedHeroSlots: 0,
        purchasedTurretSlots: 0,
      });

      mockPrisma.$transaction.mockImplementation(async (callback: unknown) => {
        if (typeof callback === 'function') {
          mockPrisma.inventory.findUnique.mockResolvedValue({ gold: 1000, dust: 100 });
          mockPrisma.progression.update.mockResolvedValue({
            level: 1,
            xp: 0,
            totalXp: 0,
          });
          return callback(mockPrisma);
        }
        return [];
      });

      const result = await endGameSession('gs-123', 'user-123');

      expect(result!.totalGoldEarned).toBe(0);
      expect(result!.totalDustEarned).toBe(0);
      expect(result!.totalXpEarned).toBe(0);
    });

    it('throws SESSION_FORBIDDEN when user does not own the session', async () => {
      const mockUser = createMockUser({ id: 'user-999' });
      const mockSession = createMockGameSession({ userId: 'user-999' });

      mockPrisma.gameSession.findUnique.mockResolvedValue({
        ...mockSession,
        segments: [],
        user: mockUser,
      });

      await expect(endGameSession('gs-123', 'user-123')).rejects.toMatchObject({
        code: 'SESSION_FORBIDDEN',
      });
    });

    it('ignores invalid partial rewards', async () => {
      const mockUser = createMockUser();
      const mockSession = createMockGameSession({ currentWave: 5 });

      mockPrisma.gameSession.findUnique.mockResolvedValue({
        ...mockSession,
        segments: [
          { goldEarned: 100, dustEarned: 10, xpEarned: 50 },
        ],
        user: mockUser,
      });

      // Mock progression for level-up calculation
      mockPrisma.progression.findUnique.mockResolvedValue({
        userId: 'user-123',
        level: 1,
        xp: 0,
        totalXp: 0,
        purchasedHeroSlots: 0,
        purchasedTurretSlots: 0,
      });

      mockPrisma.$transaction.mockImplementation(async (callback: unknown) => {
        if (typeof callback === 'function') {
          mockPrisma.inventory.findUnique.mockResolvedValue({ gold: 1000, dust: 100 });
          mockPrisma.progression.update.mockResolvedValue({
            level: 1,
            xp: 0,
            totalXp: 0,
          });
          return callback(mockPrisma);
        }
        return [];
      });

      const result = await endGameSession('gs-123', 'user-123', 'death', {
        gold: -5,
        dust: 5,
        xp: 25,
        finalWave: 99,
      });

      // Invalid partial rewards (negative gold, wave > currentWave + 10) should be rejected
      expect(result!.totalGoldEarned).toBe(100);
      expect(result!.totalDustEarned).toBe(10);
      expect(result!.totalXpEarned).toBe(50);
      expect(result!.finalWave).toBe(5);
    });
  });

  describe('getActiveSession', () => {
    it('returns null if user has no active session', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        activeGameSessionId: null,
      });

      const result = await getActiveSession('user-123');

      expect(result).toBeNull();
    });

    it('returns null if session not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        activeGameSessionId: 'gs-123',
      });
      mockPrisma.gameSession.findUnique.mockResolvedValue(null);

      const result = await getActiveSession('user-123');

      expect(result).toBeNull();
    });

    it('returns null if session already ended', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        activeGameSessionId: 'gs-123',
      });
      mockPrisma.gameSession.findUnique.mockResolvedValue(
        createMockGameSession({ endedAt: new Date() })
      );

      const result = await getActiveSession('user-123');

      expect(result).toBeNull();
    });

    it('returns active session details', async () => {
      const startedAt = new Date();
      mockPrisma.user.findUnique.mockResolvedValue({
        activeGameSessionId: 'gs-123',
      });
      mockPrisma.gameSession.findUnique.mockResolvedValue(
        createMockGameSession({
          id: 'gs-123',
          currentWave: 15,
          startedAt,
        })
      );

      const result = await getActiveSession('user-123');

      expect(result).not.toBeNull();
      expect(result!.sessionId).toBe('gs-123');
      expect(result!.currentWave).toBe(15);
      // startedAt is now returned as ISO string for protocol compatibility
      expect(result!.startedAt).toBe(startedAt.toISOString());
    });

    it('queries with correct userId', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        activeGameSessionId: null,
      });

      await getActiveSession('user-456');

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-456' },
        select: { activeGameSessionId: true },
      });
    });
  });

  describe('GameSessionError', () => {
    it('has correct name and code', () => {
      const error = new GameSessionError('Test message', 'SESSION_NOT_FOUND');

      expect(error.name).toBe('GameSessionError');
      expect(error.code).toBe('SESSION_NOT_FOUND');
      expect(error.message).toBe('Test message');
    });

    it('extends Error', () => {
      const error = new GameSessionError('Test', 'SESSION_NOT_FOUND');

      expect(error instanceof Error).toBe(true);
    });

    it('supports SESSION_NOT_FOUND code', () => {
      const error = new GameSessionError('Test', 'SESSION_NOT_FOUND');
      expect(error.code).toBe('SESSION_NOT_FOUND');
    });

    it('supports USER_NOT_FOUND code', () => {
      const error = new GameSessionError('Test', 'USER_NOT_FOUND');
      expect(error.code).toBe('USER_NOT_FOUND');
    });

    it('supports SESSION_FORBIDDEN code', () => {
      const error = new GameSessionError('Test', 'SESSION_FORBIDDEN');
      expect(error.code).toBe('SESSION_FORBIDDEN');
    });
  });
});
