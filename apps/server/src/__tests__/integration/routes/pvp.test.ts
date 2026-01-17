/**
 * PvP Routes Integration Tests
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildTestApp, generateTestToken } from '../../helpers/testApp.js';
import {
  mockPrisma,
  createMockUser,
  createMockPvpChallenge,
  createMockPvpResult,
  createMockPowerUpgrades,
} from '../../mocks/prisma.js';

// Mock sim-core to avoid complex simulation dependencies
vi.mock('@arcade/sim-core', () => ({
  runArenaBattle: vi.fn(() => ({
    winner: 'left',
    winReason: 'fortress_destroyed',
    duration: 180,
    leftStats: {
      finalHp: 500,
      damageDealt: 15000,
      heroesAlive: 2,
    },
    rightStats: {
      finalHp: 0,
      damageDealt: 12000,
      heroesAlive: 0,
    },
    replayEvents: [],
  })),
  getProgressionBonuses: vi.fn(() => ({
    damageMultiplier: 1.0,
    maxHeroSlots: 3,
    maxTurretSlots: 4,
  })),
  getMaxHeroSlots: vi.fn(() => 3),
  getMaxTurretSlots: vi.fn(() => 4),
  isClassUnlockedAtLevel: vi.fn(() => true),
  calculateArenaPower: vi.fn(() => 1000),
  createDefaultStatUpgrades: vi.fn(() => ({
    hp: 0, damage: 0, attackSpeed: 0, range: 0,
    critChance: 0, critMultiplier: 0, armor: 0, dodge: 0,
  })),
}));

describe('PvP Routes Integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // GET /v1/pvp/opponents
  // ============================================================================

  describe('GET /v1/pvp/opponents', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/pvp/opponents',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return opponents within power range', async () => {
      // Note: Mock auth plugin doesn't call prisma.user.findUnique
      // First call: getUserArenaPower (user lookup with includes)
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-123',
        displayName: 'TestUser',
        defaultHeroId: 'vanguard',
        progression: { level: 10 },
        powerUpgrades: {
          fortressUpgrades: { statUpgrades: { hp: 0, damage: 0 } },
          heroUpgrades: [],
        },
        inventory: { unlockedHeroIds: ['vanguard'] },
        artifacts: [],
      });

      // Mock for powerUpgrades lookup (for opponent matching)
      mockPrisma.powerUpgrades.findUnique.mockResolvedValue({
        cachedTotalPower: 1000,
      });

      const mockUsers = [
        {
          id: 'user-456',
          displayName: 'Opponent1',
          pvpWins: 5,
          pvpLosses: 3,
          powerUpgrades: { cachedTotalPower: 950 },
        },
      ];

      mockPrisma.user.findMany.mockResolvedValue(mockUsers);
      mockPrisma.user.count.mockResolvedValue(1);
      mockPrisma.pvpChallenge.findMany.mockResolvedValue([]);

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'GET',
        url: '/v1/pvp/opponents',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.opponents).toBeDefined();
      expect(body.total).toBe(1);
      expect(body.myPower).toBe(1000);
    });

    it('should respect limit and offset parameters', async () => {
      // Note: Mock auth plugin doesn't call prisma.user.findUnique
      // First call: getUserArenaPower (user lookup with includes)
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-123',
        displayName: 'TestUser',
        defaultHeroId: 'vanguard',
        progression: { level: 10 },
        powerUpgrades: {
          fortressUpgrades: { statUpgrades: { hp: 0, damage: 0 } },
          heroUpgrades: [],
        },
        inventory: { unlockedHeroIds: ['vanguard'] },
        artifacts: [],
      });

      mockPrisma.powerUpgrades.findUnique.mockResolvedValue({
        cachedTotalPower: 1000,
      });
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'GET',
        url: '/v1/pvp/opponents?limit=10&offset=5',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5,
          take: 10,
        })
      );
    });
  });

  // ============================================================================
  // POST /v1/pvp/challenges
  // ============================================================================

  describe('POST /v1/pvp/challenges', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/pvp/challenges',
        payload: { challengedId: 'user-456' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should create a new challenge', async () => {
      const challenger = createMockUser({ id: 'user-123', displayName: 'Challenger' });
      const challenged = createMockUser({ id: 'user-456', displayName: 'Challenged' });

      mockPrisma.user.findUnique.mockImplementation(({ where }) => {
        if (where.id === 'user-123') return { ...challenger, powerUpgrades: { cachedTotalPower: 1000 } };
        if (where.id === 'user-456') return { ...challenged, powerUpgrades: { cachedTotalPower: 950 } };
        return null;
      });

      mockPrisma.pvpChallenge.findMany.mockResolvedValue([]);
      mockPrisma.pvpChallenge.create.mockResolvedValue(
        createMockPvpChallenge({
          challengerId: 'user-123',
          challengedId: 'user-456',
        })
      );

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'POST',
        url: '/v1/pvp/challenges',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: { challengedId: 'user-456' },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.challenge).toBeDefined();
      expect(body.challenge.challengerId).toBe('user-123');
    });

    it('should return 400 for self-challenge', async () => {
      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'POST',
        url: '/v1/pvp/challenges',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: { challengedId: 'user-123' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('CANNOT_CHALLENGE_SELF');
    });

    it('should return 429 when cooldown active', async () => {
      const challenger = createMockUser({ id: 'user-123' });
      const challenged = createMockUser({ id: 'user-456' });

      mockPrisma.user.findUnique.mockImplementation(({ where }) => {
        if (where.id === 'user-123') return { ...challenger, powerUpgrades: { cachedTotalPower: 1000 } };
        if (where.id === 'user-456') return { ...challenged, powerUpgrades: { cachedTotalPower: 950 } };
        return null;
      });

      // 3 recent challenges = cooldown active
      mockPrisma.pvpChallenge.findMany.mockResolvedValue([
        createMockPvpChallenge({ createdAt: new Date(Date.now() - 1000) }),
        createMockPvpChallenge({ createdAt: new Date(Date.now() - 2000) }),
        createMockPvpChallenge({ createdAt: new Date(Date.now() - 3000) }),
      ]);

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'POST',
        url: '/v1/pvp/challenges',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: { challengedId: 'user-456' },
      });

      expect(response.statusCode).toBe(429);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('COOLDOWN_ACTIVE');
    });

    it('should return 404 when opponent not found', async () => {
      const challenger = createMockUser({ id: 'user-123' });

      mockPrisma.user.findUnique.mockImplementation(({ where }) => {
        if (where.id === 'user-123') return { ...challenger, powerUpgrades: { cachedTotalPower: 1000 } };
        return null;
      });

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'POST',
        url: '/v1/pvp/challenges',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: { challengedId: 'nonexistent' },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('OPPONENT_NOT_FOUND');
    });

    it('should return 400 when power out of range', async () => {
      const challenger = createMockUser({ id: 'user-123' });
      const challenged = createMockUser({ id: 'user-456' });

      mockPrisma.user.findUnique.mockImplementation(({ where }) => {
        if (where.id === 'user-123') return { ...challenger, powerUpgrades: { cachedTotalPower: 1000 } };
        if (where.id === 'user-456') return { ...challenged, powerUpgrades: { cachedTotalPower: 2000 } }; // 100% higher
        return null;
      });

      mockPrisma.pvpChallenge.findMany.mockResolvedValue([]);

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'POST',
        url: '/v1/pvp/challenges',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: { challengedId: 'user-456' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('POWER_OUT_OF_RANGE');
    });
  });

  // ============================================================================
  // GET /v1/pvp/challenges
  // ============================================================================

  describe('GET /v1/pvp/challenges', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/pvp/challenges',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return user challenges', async () => {
      const challenge = createMockPvpChallenge({ challengerId: 'user-123' });
      mockPrisma.pvpChallenge.findMany.mockResolvedValue([
        {
          ...challenge,
          challenger: { displayName: 'Challenger' },
          challenged: { displayName: 'Challenged' },
        },
      ]);
      mockPrisma.pvpChallenge.count.mockResolvedValue(1);

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'GET',
        url: '/v1/pvp/challenges',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.challenges).toBeDefined();
      expect(body.total).toBe(1);
    });

    it('should filter by type (sent/received/all)', async () => {
      mockPrisma.pvpChallenge.findMany.mockResolvedValue([]);
      mockPrisma.pvpChallenge.count.mockResolvedValue(0);

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'GET',
        url: '/v1/pvp/challenges?type=sent',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockPrisma.pvpChallenge.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            challengerId: 'user-123',
          }),
        })
      );
    });

    it('should filter by status', async () => {
      mockPrisma.pvpChallenge.findMany.mockResolvedValue([]);
      mockPrisma.pvpChallenge.count.mockResolvedValue(0);

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'GET',
        url: '/v1/pvp/challenges?status=PENDING',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockPrisma.pvpChallenge.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'PENDING',
          }),
        })
      );
    });

    it('should paginate results', async () => {
      mockPrisma.pvpChallenge.findMany.mockResolvedValue([]);
      mockPrisma.pvpChallenge.count.mockResolvedValue(0);

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'GET',
        url: '/v1/pvp/challenges?limit=10&offset=5',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockPrisma.pvpChallenge.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5,
          take: 10,
        })
      );
    });
  });

  // ============================================================================
  // GET /v1/pvp/challenges/:id
  // ============================================================================

  describe('GET /v1/pvp/challenges/:id', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/pvp/challenges/challenge-123',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return challenge details', async () => {
      const challenge = createMockPvpChallenge({ challengerId: 'user-123' });
      mockPrisma.pvpChallenge.findUnique.mockResolvedValue({
        ...challenge,
        challenger: { displayName: 'Challenger' },
        challenged: { displayName: 'Challenged' },
        result: null,
      });

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'GET',
        url: '/v1/pvp/challenges/challenge-123',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe('challenge-123');
    });

    it('should return 404 for non-existent challenge', async () => {
      mockPrisma.pvpChallenge.findUnique.mockResolvedValue(null);

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'GET',
        url: '/v1/pvp/challenges/nonexistent',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('CHALLENGE_NOT_FOUND');
    });

    it('should return 403 for non-participant', async () => {
      const challenge = createMockPvpChallenge({
        challengerId: 'user-456',
        challengedId: 'user-789',
      });
      mockPrisma.pvpChallenge.findUnique.mockResolvedValue({
        ...challenge,
        challenger: { displayName: 'Challenger' },
        challenged: { displayName: 'Challenged' },
        result: null,
      });

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'GET',
        url: '/v1/pvp/challenges/challenge-123',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('CHALLENGE_FORBIDDEN');
    });
  });

  // ============================================================================
  // POST /v1/pvp/challenges/:id/accept
  // ============================================================================

  describe('POST /v1/pvp/challenges/:id/accept', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/pvp/challenges/challenge-123/accept',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should accept and resolve challenge', async () => {
      const challenge = createMockPvpChallenge({
        challengerId: 'user-456',
        challengedId: 'user-123',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      mockPrisma.pvpChallenge.findUnique.mockResolvedValue(challenge);

      const challenger = createMockUser({ id: 'user-456', displayName: 'Challenger' });
      const challenged = createMockUser({ id: 'user-123', displayName: 'Challenged' });

      mockPrisma.user.findUnique.mockImplementation(({ where }) => {
        if (where.id === 'user-456') {
          return {
            ...challenger,
            progression: { level: 10 },
            powerUpgrades: createMockPowerUpgrades({ userId: 'user-456' }),
            inventory: { unlockedHeroIds: [], unlockedTurretIds: [] },
          };
        }
        if (where.id === 'user-123') {
          return {
            ...challenged,
            progression: { level: 10 },
            powerUpgrades: createMockPowerUpgrades({ userId: 'user-123' }),
            inventory: { unlockedHeroIds: [], unlockedTurretIds: [] },
          };
        }
        return null;
      });

      mockPrisma.$transaction.mockResolvedValue([]);

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'POST',
        url: '/v1/pvp/challenges/challenge-123/accept',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.challenge.status).toBe('RESOLVED');
      expect(body.result).toBeDefined();
    });

    it('should return 404 for non-existent challenge', async () => {
      mockPrisma.pvpChallenge.findUnique.mockResolvedValue(null);

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'POST',
        url: '/v1/pvp/challenges/nonexistent/accept',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('CHALLENGE_NOT_FOUND');
    });

    it('should return 403 when not challenged player', async () => {
      const challenge = createMockPvpChallenge({
        challengerId: 'user-456',
        challengedId: 'user-789',
      });
      mockPrisma.pvpChallenge.findUnique.mockResolvedValue(challenge);

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'POST',
        url: '/v1/pvp/challenges/challenge-123/accept',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('CHALLENGE_FORBIDDEN');
    });

    it('should return 400 when not pending', async () => {
      const challenge = createMockPvpChallenge({
        challengerId: 'user-456',
        challengedId: 'user-123',
        status: 'RESOLVED',
      });
      mockPrisma.pvpChallenge.findUnique.mockResolvedValue(challenge);

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'POST',
        url: '/v1/pvp/challenges/challenge-123/accept',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('CHALLENGE_NOT_PENDING');
    });

    it('should return 410 when expired', async () => {
      const challenge = createMockPvpChallenge({
        challengerId: 'user-456',
        challengedId: 'user-123',
        status: 'PENDING',
        expiresAt: new Date(Date.now() - 1000), // Expired
      });
      mockPrisma.pvpChallenge.findUnique.mockResolvedValue(challenge);
      mockPrisma.pvpChallenge.update.mockResolvedValue({ ...challenge, status: 'EXPIRED' });

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'POST',
        url: '/v1/pvp/challenges/challenge-123/accept',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(410);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('CHALLENGE_EXPIRED');
    });
  });

  // ============================================================================
  // POST /v1/pvp/challenges/:id/decline
  // ============================================================================

  describe('POST /v1/pvp/challenges/:id/decline', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/pvp/challenges/challenge-123/decline',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should decline challenge', async () => {
      const challenge = createMockPvpChallenge({
        challengerId: 'user-456',
        challengedId: 'user-123',
        status: 'PENDING',
      });
      mockPrisma.pvpChallenge.findUnique.mockResolvedValue(challenge);
      mockPrisma.pvpChallenge.update.mockResolvedValue({
        ...challenge,
        status: 'DECLINED',
      });

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'POST',
        url: '/v1/pvp/challenges/challenge-123/decline',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('DECLINED');
    });

    it('should return 404 for non-existent challenge', async () => {
      mockPrisma.pvpChallenge.findUnique.mockResolvedValue(null);

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'POST',
        url: '/v1/pvp/challenges/nonexistent/decline',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('CHALLENGE_NOT_FOUND');
    });

    it('should return 403 when not challenged player', async () => {
      const challenge = createMockPvpChallenge({
        challengerId: 'user-456',
        challengedId: 'user-789',
      });
      mockPrisma.pvpChallenge.findUnique.mockResolvedValue(challenge);

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'POST',
        url: '/v1/pvp/challenges/challenge-123/decline',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('CHALLENGE_FORBIDDEN');
    });

    it('should return 400 when not pending', async () => {
      const challenge = createMockPvpChallenge({
        challengerId: 'user-456',
        challengedId: 'user-123',
        status: 'RESOLVED',
      });
      mockPrisma.pvpChallenge.findUnique.mockResolvedValue(challenge);

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'POST',
        url: '/v1/pvp/challenges/challenge-123/decline',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('CHALLENGE_NOT_PENDING');
    });
  });

  // ============================================================================
  // POST /v1/pvp/challenges/:id/cancel
  // ============================================================================

  describe('POST /v1/pvp/challenges/:id/cancel', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/pvp/challenges/challenge-123/cancel',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should cancel challenge', async () => {
      const challenge = createMockPvpChallenge({
        challengerId: 'user-123',
        challengedId: 'user-456',
        status: 'PENDING',
      });
      mockPrisma.pvpChallenge.findUnique.mockResolvedValue(challenge);
      mockPrisma.pvpChallenge.update.mockResolvedValue({
        ...challenge,
        status: 'CANCELLED',
      });

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'POST',
        url: '/v1/pvp/challenges/challenge-123/cancel',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('CANCELLED');
    });

    it('should return 404 for non-existent challenge', async () => {
      mockPrisma.pvpChallenge.findUnique.mockResolvedValue(null);

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'POST',
        url: '/v1/pvp/challenges/nonexistent/cancel',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('CHALLENGE_NOT_FOUND');
    });

    it('should return 403 when not challenger', async () => {
      const challenge = createMockPvpChallenge({
        challengerId: 'user-456',
        challengedId: 'user-789',
      });
      mockPrisma.pvpChallenge.findUnique.mockResolvedValue(challenge);

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'POST',
        url: '/v1/pvp/challenges/challenge-123/cancel',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('CHALLENGE_FORBIDDEN');
    });

    it('should return 400 when not pending', async () => {
      const challenge = createMockPvpChallenge({
        challengerId: 'user-123',
        challengedId: 'user-456',
        status: 'RESOLVED',
      });
      mockPrisma.pvpChallenge.findUnique.mockResolvedValue(challenge);

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'POST',
        url: '/v1/pvp/challenges/challenge-123/cancel',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('CHALLENGE_NOT_PENDING');
    });
  });

  // ============================================================================
  // GET /v1/pvp/replay/:id
  // ============================================================================

  describe('GET /v1/pvp/replay/:id', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/pvp/replay/challenge-123',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return replay data', async () => {
      const challenge = createMockPvpChallenge({
        challengerId: 'user-123',
        status: 'RESOLVED',
        seed: 12345,
      });
      const pvpResult = createMockPvpResult();

      mockPrisma.pvpChallenge.findUnique.mockResolvedValue({
        ...challenge,
        result: pvpResult,
      });

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'GET',
        url: '/v1/pvp/replay/challenge-123',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.seed).toBe(12345);
      expect(body.result).toBeDefined();
    });

    it('should return 404 for non-existent challenge', async () => {
      mockPrisma.pvpChallenge.findUnique.mockResolvedValue(null);

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'GET',
        url: '/v1/pvp/replay/nonexistent',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('CHALLENGE_NOT_FOUND');
    });

    it('should return 403 for non-participant', async () => {
      const challenge = createMockPvpChallenge({
        challengerId: 'user-456',
        challengedId: 'user-789',
        status: 'RESOLVED',
      });

      mockPrisma.pvpChallenge.findUnique.mockResolvedValue({
        ...challenge,
        result: createMockPvpResult(),
      });

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'GET',
        url: '/v1/pvp/replay/challenge-123',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('CHALLENGE_FORBIDDEN');
    });

    it('should return 400 when not resolved', async () => {
      const challenge = createMockPvpChallenge({
        challengerId: 'user-123',
        status: 'PENDING',
      });

      mockPrisma.pvpChallenge.findUnique.mockResolvedValue({
        ...challenge,
        result: null,
      });

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'GET',
        url: '/v1/pvp/replay/challenge-123',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('CHALLENGE_NOT_PENDING');
    });
  });

  // ============================================================================
  // GET /v1/pvp/stats
  // ============================================================================

  describe('GET /v1/pvp/stats', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/pvp/stats',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return user PvP stats', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        pvpWins: 10,
        pvpLosses: 5,
      });
      mockPrisma.pvpChallenge.count.mockResolvedValue(2);

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'GET',
        url: '/v1/pvp/stats',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.wins).toBe(10);
      expect(body.losses).toBe(5);
      expect(body.totalBattles).toBe(15);
      expect(body.pendingChallenges).toBe(2);
    });

    it('should return correct win rate calculation', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        pvpWins: 7,
        pvpLosses: 3,
      });
      mockPrisma.pvpChallenge.count.mockResolvedValue(0);

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'GET',
        url: '/v1/pvp/stats',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.winRate).toBe(70);
    });
  });
});
