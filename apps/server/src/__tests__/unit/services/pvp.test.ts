/**
 * PvP service unit tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '../../../__tests__/helpers/setup.js';
import {
  getOpponents,
  createChallenge,
  getChallenges,
  getChallenge,
  acceptChallenge,
  declineChallenge,
  cancelChallenge,
  getReplayData,
  getUserPvpStats,
  PvpError,
} from '../../../services/pvp.js';
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

// Default user data for getUserArenaPower mock
const defaultUserForArenaPower = {
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
};

describe('PvP Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock for getUserArenaPower
    mockPrisma.user.findUnique.mockResolvedValue(defaultUserForArenaPower);
  });

  // ============================================================================
  // PvpError
  // ============================================================================

  describe('PvpError', () => {
    it('has correct name and code', () => {
      const error = new PvpError('Test message', 'CHALLENGE_NOT_FOUND');

      expect(error.name).toBe('PvpError');
      expect(error.code).toBe('CHALLENGE_NOT_FOUND');
      expect(error.message).toBe('Test message');
    });

    it('extends Error', () => {
      const error = new PvpError('Test', 'CHALLENGE_NOT_FOUND');

      expect(error instanceof Error).toBe(true);
    });

    it('supports CANNOT_CHALLENGE_SELF code', () => {
      const error = new PvpError('Test', 'CANNOT_CHALLENGE_SELF');
      expect(error.code).toBe('CANNOT_CHALLENGE_SELF');
    });

    it('supports COOLDOWN_ACTIVE code', () => {
      const error = new PvpError('Test', 'COOLDOWN_ACTIVE');
      expect(error.code).toBe('COOLDOWN_ACTIVE');
    });

    it('supports POWER_OUT_OF_RANGE code', () => {
      const error = new PvpError('Test', 'POWER_OUT_OF_RANGE');
      expect(error.code).toBe('POWER_OUT_OF_RANGE');
    });

    it('supports USER_NOT_FOUND code', () => {
      const error = new PvpError('Test', 'USER_NOT_FOUND');
      expect(error.code).toBe('USER_NOT_FOUND');
    });

    it('supports OPPONENT_NOT_FOUND code', () => {
      const error = new PvpError('Test', 'OPPONENT_NOT_FOUND');
      expect(error.code).toBe('OPPONENT_NOT_FOUND');
    });

    it('supports CHALLENGE_FORBIDDEN code', () => {
      const error = new PvpError('Test', 'CHALLENGE_FORBIDDEN');
      expect(error.code).toBe('CHALLENGE_FORBIDDEN');
    });

    it('supports CHALLENGE_NOT_PENDING code', () => {
      const error = new PvpError('Test', 'CHALLENGE_NOT_PENDING');
      expect(error.code).toBe('CHALLENGE_NOT_PENDING');
    });

    it('supports CHALLENGE_EXPIRED code', () => {
      const error = new PvpError('Test', 'CHALLENGE_EXPIRED');
      expect(error.code).toBe('CHALLENGE_EXPIRED');
    });
  });

  // ============================================================================
  // getOpponents
  // ============================================================================

  describe('getOpponents', () => {
    it('returns opponents within ±20% power range', async () => {
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
        {
          id: 'user-789',
          displayName: 'Opponent2',
          pvpWins: 10,
          pvpLosses: 2,
          powerUpgrades: { cachedTotalPower: 1100 },
        },
      ];

      mockPrisma.user.findMany.mockResolvedValue(mockUsers);
      mockPrisma.user.count.mockResolvedValue(2);
      mockPrisma.pvpChallenge.findMany.mockResolvedValue([]);

      const result = await getOpponents('user-123');

      expect(result.myPower).toBe(1000); // From mocked calculateArenaPower
      expect(result.total).toBe(2);
      expect(result.opponents.length).toBeLessThanOrEqual(6); // Max 6 random opponents
      expect(result.opponents[0].canChallenge).toBe(true);
    });

    it('excludes self from opponents', async () => {
      mockPrisma.powerUpgrades.findUnique.mockResolvedValue({
        cachedTotalPower: 1000,
      });
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      await getOpponents('user-123');

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { not: 'user-123' },
          }),
        })
      );
    });

    it('excludes banned users', async () => {
      mockPrisma.powerUpgrades.findUnique.mockResolvedValue({
        cachedTotalPower: 1000,
      });
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      await getOpponents('user-123');

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            banned: false,
          }),
        })
      );
    });

    it('checks cooldown for each opponent', async () => {
      mockPrisma.powerUpgrades.findUnique.mockResolvedValue({
        cachedTotalPower: 1000,
      });

      mockPrisma.user.findMany.mockResolvedValue([
        {
          id: 'user-456',
          displayName: 'Opponent1',
          pvpWins: 5,
          pvpLosses: 3,
          powerUpgrades: { cachedTotalPower: 950 },
        },
      ]);
      mockPrisma.user.count.mockResolvedValue(1);

      // Simulate 3 recent challenges (cooldown should be active)
      const recentChallenges = [
        createMockPvpChallenge({ createdAt: new Date(Date.now() - 1000) }),
        createMockPvpChallenge({ createdAt: new Date(Date.now() - 2000) }),
        createMockPvpChallenge({ createdAt: new Date(Date.now() - 3000) }),
      ];
      mockPrisma.pvpChallenge.findMany.mockResolvedValue(recentChallenges);

      const result = await getOpponents('user-123');

      expect(result.opponents[0].canChallenge).toBe(false);
      expect(result.opponents[0].challengeCooldownEndsAt).toBeDefined();
    });

    it('returns max 6 random opponents', async () => {
      mockPrisma.powerUpgrades.findUnique.mockResolvedValue({
        cachedTotalPower: 1000,
      });
      // Mock 10 users but expect only 6 to be returned
      const manyUsers = Array.from({ length: 10 }, (_, i) => ({
        id: `user-${i}`,
        displayName: `Opponent${i}`,
        pvpWins: 5,
        pvpLosses: 3,
        powerUpgrades: { cachedTotalPower: 900 + i * 10 },
      }));
      mockPrisma.user.findMany.mockResolvedValue(manyUsers);
      mockPrisma.user.count.mockResolvedValue(10);
      mockPrisma.pvpChallenge.findMany.mockResolvedValue([]);

      const result = await getOpponents('user-123');

      expect(result.opponents.length).toBeLessThanOrEqual(6);
      expect(result.total).toBe(10);
    });

    it('returns empty array when no matching opponents', async () => {
      mockPrisma.powerUpgrades.findUnique.mockResolvedValue({
        cachedTotalPower: 1000,
      });
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      const result = await getOpponents('user-123');

      expect(result.opponents).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('returns 0 power when user has no progression', async () => {
      // Override default mock - user without progression returns 0 arena power
      mockPrisma.user.findUnique.mockResolvedValue({
        ...defaultUserForArenaPower,
        progression: null,
      });
      mockPrisma.powerUpgrades.findUnique.mockResolvedValue(null);
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      const result = await getOpponents('user-123');

      expect(result.myPower).toBe(0);
    });
  });

  // ============================================================================
  // createChallenge
  // ============================================================================

  describe('createChallenge', () => {
    it('creates challenge with valid parameters', async () => {
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
          challengerPower: 1000,
          challengedPower: 950,
        })
      );

      const result = await createChallenge('user-123', 'user-456');

      expect(result.challenge.challengerId).toBe('user-123');
      expect(result.challenge.challengedId).toBe('user-456');
      expect(result.challenge.status).toBe('RESOLVED');
      expect(result.challenge.challengerPower).toBe(1000);
      expect(result.challenge.challengedPower).toBe(950);
    });

    it('throws CANNOT_CHALLENGE_SELF for self-challenge', async () => {
      await expect(createChallenge('user-123', 'user-123')).rejects.toMatchObject({
        code: 'CANNOT_CHALLENGE_SELF',
      });
    });

    it('throws USER_NOT_FOUND when challenger not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(createChallenge('user-123', 'user-456')).rejects.toMatchObject({
        code: 'USER_NOT_FOUND',
      });
    });

    it('throws OPPONENT_NOT_FOUND when opponent not found', async () => {
      mockPrisma.user.findUnique.mockImplementation(({ where }) => {
        if (where.id === 'user-123') return createMockUser({ id: 'user-123' });
        return null;
      });

      await expect(createChallenge('user-123', 'user-456')).rejects.toMatchObject({
        code: 'OPPONENT_NOT_FOUND',
      });
    });

    it('throws COOLDOWN_ACTIVE when cooldown is active', async () => {
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

      await expect(createChallenge('user-123', 'user-456')).rejects.toMatchObject({
        code: 'COOLDOWN_ACTIVE',
      });
    });

    it('allows challenge regardless of power difference (from rankings/profile)', async () => {
      const challenger = createMockUser({ id: 'user-123' });
      const challenged = createMockUser({ id: 'user-456' });

      // 100% higher power - should still work (no power range check)
      mockPrisma.user.findUnique.mockImplementation(({ where }) => {
        if (where.id === 'user-123') return { ...challenger, powerUpgrades: { cachedTotalPower: 1000 } };
        if (where.id === 'user-456') return { ...challenged, powerUpgrades: { cachedTotalPower: 2000 } };
        return null;
      });

      mockPrisma.pvpChallenge.findMany.mockResolvedValue([]);
      mockPrisma.pvpChallenge.create.mockResolvedValue(
        createMockPvpChallenge({
          challengerPower: 1000,
          challengedPower: 2000,
        })
      );

      const result = await createChallenge('user-123', 'user-456');

      expect(result.challenge.challengedPower).toBe(2000);
    });

    it('allows challenge with lower power opponent', async () => {
      const challenger = createMockUser({ id: 'user-123' });
      const challenged = createMockUser({ id: 'user-456' });

      mockPrisma.user.findUnique.mockImplementation(({ where }) => {
        if (where.id === 'user-123') return { ...challenger, powerUpgrades: { cachedTotalPower: 1000 } };
        if (where.id === 'user-456') return { ...challenged, powerUpgrades: { cachedTotalPower: 100 } };
        return null;
      });

      mockPrisma.pvpChallenge.findMany.mockResolvedValue([]);
      mockPrisma.pvpChallenge.create.mockResolvedValue(
        createMockPvpChallenge({
          challengerPower: 1000,
          challengedPower: 800,
        })
      );

      const result = await createChallenge('user-123', 'user-456');

      expect(result.challenge.challengedPower).toBe(800);
    });

    it('calculates correct expiry time (24h)', async () => {
      const challenger = createMockUser({ id: 'user-123', displayName: 'Challenger' });
      const challenged = createMockUser({ id: 'user-456', displayName: 'Challenged' });

      mockPrisma.user.findUnique.mockImplementation(({ where }) => {
        if (where.id === 'user-123') return { ...challenger, powerUpgrades: { cachedTotalPower: 1000 } };
        if (where.id === 'user-456') return { ...challenged, powerUpgrades: { cachedTotalPower: 950 } };
        return null;
      });

      mockPrisma.pvpChallenge.findMany.mockResolvedValue([]);

      const now = Date.now();
      mockPrisma.pvpChallenge.create.mockImplementation(({ data }) => {
        const expiresAt = data.expiresAt as Date;
        const expectedExpiry = now + 24 * 60 * 60 * 1000;
        // Allow 5 second tolerance
        expect(expiresAt.getTime()).toBeGreaterThanOrEqual(expectedExpiry - 5000);
        expect(expiresAt.getTime()).toBeLessThanOrEqual(expectedExpiry + 5000);

        return createMockPvpChallenge({
          ...data,
          id: 'challenge-new',
        });
      });

      await createChallenge('user-123', 'user-456');
    });
  });

  // ============================================================================
  // getChallenges
  // ============================================================================

  describe('getChallenges', () => {
    it('returns sent challenges when type is "sent"', async () => {
      const challenge = createMockPvpChallenge();
      mockPrisma.pvpChallenge.findMany.mockResolvedValue([
        {
          ...challenge,
          challenger: { displayName: 'Challenger' },
          challenged: { displayName: 'Challenged' },
        },
      ]);
      mockPrisma.pvpChallenge.count.mockResolvedValue(1);

      await getChallenges('user-123', 'sent');

      expect(mockPrisma.pvpChallenge.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            challengerId: 'user-123',
          }),
        })
      );
    });

    it('returns received challenges when type is "received"', async () => {
      mockPrisma.pvpChallenge.findMany.mockResolvedValue([]);
      mockPrisma.pvpChallenge.count.mockResolvedValue(0);

      await getChallenges('user-123', 'received');

      expect(mockPrisma.pvpChallenge.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            challengedId: 'user-123',
          }),
        })
      );
    });

    it('returns all challenges when type is "all"', async () => {
      mockPrisma.pvpChallenge.findMany.mockResolvedValue([]);
      mockPrisma.pvpChallenge.count.mockResolvedValue(0);

      await getChallenges('user-123', 'all');

      expect(mockPrisma.pvpChallenge.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { challengerId: 'user-123' },
              { challengedId: 'user-123' },
            ],
          }),
        })
      );
    });

    it('filters by status when provided', async () => {
      mockPrisma.pvpChallenge.findMany.mockResolvedValue([]);
      mockPrisma.pvpChallenge.count.mockResolvedValue(0);

      await getChallenges('user-123', 'all', 'PENDING');

      expect(mockPrisma.pvpChallenge.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'PENDING',
          }),
        })
      );
    });

    it('respects pagination parameters', async () => {
      mockPrisma.pvpChallenge.findMany.mockResolvedValue([]);
      mockPrisma.pvpChallenge.count.mockResolvedValue(0);

      await getChallenges('user-123', 'all', undefined, 10, 5);

      expect(mockPrisma.pvpChallenge.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5,
          take: 10,
        })
      );
    });

    it('includes challenger and challenged names', async () => {
      const challenge = createMockPvpChallenge();
      mockPrisma.pvpChallenge.findMany.mockResolvedValue([
        {
          ...challenge,
          challenger: { displayName: 'ChallengerName' },
          challenged: { displayName: 'ChallengedName' },
        },
      ]);
      mockPrisma.pvpChallenge.count.mockResolvedValue(1);

      const result = await getChallenges('user-123', 'all');

      expect(result.challenges[0].challengerName).toBe('ChallengerName');
      expect(result.challenges[0].challengedName).toBe('ChallengedName');
    });
  });

  // ============================================================================
  // getChallenge
  // ============================================================================

  describe('getChallenge', () => {
    it('returns challenge details for participant', async () => {
      const challenge = createMockPvpChallenge({ challengerId: 'user-123' });
      mockPrisma.pvpChallenge.findUnique.mockResolvedValue({
        ...challenge,
        challenger: { displayName: 'Challenger' },
        challenged: { displayName: 'Challenged' },
        result: null,
      });

      const result = await getChallenge('challenge-123', 'user-123');

      expect(result.id).toBe('challenge-123');
      expect(result.challengerName).toBe('Challenger');
    });

    it('throws CHALLENGE_NOT_FOUND for non-existent challenge', async () => {
      mockPrisma.pvpChallenge.findUnique.mockResolvedValue(null);

      await expect(getChallenge('nonexistent', 'user-123')).rejects.toMatchObject({
        code: 'CHALLENGE_NOT_FOUND',
      });
    });

    it('throws CHALLENGE_FORBIDDEN for non-participant', async () => {
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

      await expect(getChallenge('challenge-123', 'user-123')).rejects.toMatchObject({
        code: 'CHALLENGE_FORBIDDEN',
      });
    });

    it('includes result when challenge is resolved', async () => {
      const challenge = createMockPvpChallenge({
        challengerId: 'user-123',
        status: 'RESOLVED',
      });
      const result = createMockPvpResult();

      mockPrisma.pvpChallenge.findUnique.mockResolvedValue({
        ...challenge,
        challenger: { displayName: 'Challenger' },
        challenged: { displayName: 'Challenged' },
        result,
      });

      const response = await getChallenge('challenge-123', 'user-123');

      expect(response.result).toBeDefined();
      expect(response.result?.winnerId).toBe('user-123');
      expect(response.result?.winReason).toBe('fortress_destroyed');
    });
  });

  // ============================================================================
  // acceptChallenge
  // ============================================================================

  describe('acceptChallenge', () => {
    it('throws CHALLENGE_NOT_FOUND for non-existent challenge', async () => {
      mockPrisma.pvpChallenge.findUnique.mockResolvedValue(null);

      await expect(acceptChallenge('nonexistent', 'user-456')).rejects.toMatchObject({
        code: 'CHALLENGE_NOT_FOUND',
      });
    });

    it('throws CHALLENGE_FORBIDDEN when not challenged player', async () => {
      const challenge = createMockPvpChallenge({ challengedId: 'user-789' });
      mockPrisma.pvpChallenge.findUnique.mockResolvedValue(challenge);

      await expect(acceptChallenge('challenge-123', 'user-456')).rejects.toMatchObject({
        code: 'CHALLENGE_FORBIDDEN',
      });
    });

    it('throws CHALLENGE_NOT_PENDING for non-pending challenge', async () => {
      const challenge = createMockPvpChallenge({
        challengedId: 'user-456',
        status: 'RESOLVED',
      });
      mockPrisma.pvpChallenge.findUnique.mockResolvedValue(challenge);

      await expect(acceptChallenge('challenge-123', 'user-456')).rejects.toMatchObject({
        code: 'CHALLENGE_NOT_PENDING',
      });
    });

    it('throws CHALLENGE_EXPIRED for expired challenge', async () => {
      const challenge = createMockPvpChallenge({
        challengedId: 'user-456',
        status: 'PENDING',
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      });
      mockPrisma.pvpChallenge.findUnique.mockResolvedValue(challenge);
      mockPrisma.pvpChallenge.update.mockResolvedValue({ ...challenge, status: 'EXPIRED' });

      await expect(acceptChallenge('challenge-123', 'user-456')).rejects.toMatchObject({
        code: 'CHALLENGE_EXPIRED',
      });

      // Verify the challenge was marked as expired
      expect(mockPrisma.pvpChallenge.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'EXPIRED' },
        })
      );
    });

    it('runs battle simulation and resolves challenge', async () => {
      const challenge = createMockPvpChallenge({
        challengerId: 'user-123',
        challengedId: 'user-456',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      mockPrisma.pvpChallenge.findUnique.mockResolvedValue(challenge);

      // Mock user builds
      const challenger = createMockUser({ id: 'user-123', displayName: 'Challenger' });
      const challenged = createMockUser({ id: 'user-456', displayName: 'Challenged' });

      mockPrisma.user.findUnique.mockImplementation(({ where }) => {
        if (where.id === 'user-123') {
          return {
            ...challenger,
            progression: { level: 10 },
            powerUpgrades: createMockPowerUpgrades({ userId: 'user-123' }),
            inventory: { unlockedHeroIds: [], unlockedTurretIds: [] },
          };
        }
        if (where.id === 'user-456') {
          return {
            ...challenged,
            progression: { level: 10 },
            powerUpgrades: createMockPowerUpgrades({ userId: 'user-456' }),
            inventory: { unlockedHeroIds: [], unlockedTurretIds: [] },
          };
        }
        return null;
      });

      mockPrisma.$transaction.mockResolvedValue([]);

      const result = await acceptChallenge('challenge-123', 'user-456');

      expect(result.challenge.status).toBe('RESOLVED');
      expect(result.result.winnerId).toBe('user-123');
      expect(result.result.winReason).toBe('fortress_destroyed');
      expect(result.battleData.seed).toBeDefined();
    });

    it('updates win/loss stats for both players', async () => {
      const challenge = createMockPvpChallenge({
        challengerId: 'user-123',
        challengedId: 'user-456',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      mockPrisma.pvpChallenge.findUnique.mockResolvedValue(challenge);

      const challenger = createMockUser({ id: 'user-123', displayName: 'Challenger' });
      const challenged = createMockUser({ id: 'user-456', displayName: 'Challenged' });

      mockPrisma.user.findUnique.mockImplementation(({ where }) => {
        if (where.id === 'user-123') {
          return {
            ...challenger,
            progression: { level: 10 },
            powerUpgrades: createMockPowerUpgrades({ userId: 'user-123' }),
            inventory: { unlockedHeroIds: [], unlockedTurretIds: [] },
          };
        }
        if (where.id === 'user-456') {
          return {
            ...challenged,
            progression: { level: 10 },
            powerUpgrades: createMockPowerUpgrades({ userId: 'user-456' }),
            inventory: { unlockedHeroIds: [], unlockedTurretIds: [] },
          };
        }
        return null;
      });

      mockPrisma.$transaction.mockResolvedValue([]);

      await acceptChallenge('challenge-123', 'user-456');

      // Check transaction was called with stats updates
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('throws USER_NOT_FOUND when player build cannot be loaded', async () => {
      const challenge = createMockPvpChallenge({
        challengerId: 'user-123',
        challengedId: 'user-456',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      mockPrisma.pvpChallenge.findUnique.mockResolvedValue(challenge);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(acceptChallenge('challenge-123', 'user-456')).rejects.toMatchObject({
        code: 'USER_NOT_FOUND',
      });
    });
  });

  // ============================================================================
  // declineChallenge
  // ============================================================================

  describe('declineChallenge', () => {
    it('updates status to DECLINED', async () => {
      const challenge = createMockPvpChallenge({
        challengedId: 'user-456',
        status: 'PENDING',
      });
      mockPrisma.pvpChallenge.findUnique.mockResolvedValue(challenge);
      mockPrisma.pvpChallenge.update.mockResolvedValue({
        ...challenge,
        status: 'DECLINED',
      });

      const result = await declineChallenge('challenge-123', 'user-456');

      expect(result.status).toBe('DECLINED');
      expect(mockPrisma.pvpChallenge.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'DECLINED' },
        })
      );
    });

    it('throws CHALLENGE_NOT_FOUND for non-existent challenge', async () => {
      mockPrisma.pvpChallenge.findUnique.mockResolvedValue(null);

      await expect(declineChallenge('nonexistent', 'user-456')).rejects.toMatchObject({
        code: 'CHALLENGE_NOT_FOUND',
      });
    });

    it('throws CHALLENGE_FORBIDDEN when not challenged player', async () => {
      const challenge = createMockPvpChallenge({ challengedId: 'user-789' });
      mockPrisma.pvpChallenge.findUnique.mockResolvedValue(challenge);

      await expect(declineChallenge('challenge-123', 'user-456')).rejects.toMatchObject({
        code: 'CHALLENGE_FORBIDDEN',
      });
    });

    it('throws CHALLENGE_NOT_PENDING for non-pending challenge', async () => {
      const challenge = createMockPvpChallenge({
        challengedId: 'user-456',
        status: 'RESOLVED',
      });
      mockPrisma.pvpChallenge.findUnique.mockResolvedValue(challenge);

      await expect(declineChallenge('challenge-123', 'user-456')).rejects.toMatchObject({
        code: 'CHALLENGE_NOT_PENDING',
      });
    });
  });

  // ============================================================================
  // cancelChallenge
  // ============================================================================

  describe('cancelChallenge', () => {
    it('updates status to CANCELLED', async () => {
      const challenge = createMockPvpChallenge({
        challengerId: 'user-123',
        status: 'PENDING',
      });
      mockPrisma.pvpChallenge.findUnique.mockResolvedValue(challenge);
      mockPrisma.pvpChallenge.update.mockResolvedValue({
        ...challenge,
        status: 'CANCELLED',
      });

      const result = await cancelChallenge('challenge-123', 'user-123');

      expect(result.status).toBe('CANCELLED');
      expect(mockPrisma.pvpChallenge.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'CANCELLED' },
        })
      );
    });

    it('throws CHALLENGE_NOT_FOUND for non-existent challenge', async () => {
      mockPrisma.pvpChallenge.findUnique.mockResolvedValue(null);

      await expect(cancelChallenge('nonexistent', 'user-123')).rejects.toMatchObject({
        code: 'CHALLENGE_NOT_FOUND',
      });
    });

    it('throws CHALLENGE_FORBIDDEN when not challenger', async () => {
      const challenge = createMockPvpChallenge({ challengerId: 'user-789' });
      mockPrisma.pvpChallenge.findUnique.mockResolvedValue(challenge);

      await expect(cancelChallenge('challenge-123', 'user-123')).rejects.toMatchObject({
        code: 'CHALLENGE_FORBIDDEN',
      });
    });

    it('throws CHALLENGE_NOT_PENDING for non-pending challenge', async () => {
      const challenge = createMockPvpChallenge({
        challengerId: 'user-123',
        status: 'RESOLVED',
      });
      mockPrisma.pvpChallenge.findUnique.mockResolvedValue(challenge);

      await expect(cancelChallenge('challenge-123', 'user-123')).rejects.toMatchObject({
        code: 'CHALLENGE_NOT_PENDING',
      });
    });
  });

  // ============================================================================
  // getReplayData
  // ============================================================================

  describe('getReplayData', () => {
    it('returns replay data for resolved challenge', async () => {
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

      const result = await getReplayData('challenge-123', 'user-123');

      expect(result.seed).toBe(12345);
      expect(result.result.winnerId).toBe('user-123');
      expect(result.replayEvents).toEqual([]);
    });

    it('throws CHALLENGE_NOT_FOUND for non-existent challenge', async () => {
      mockPrisma.pvpChallenge.findUnique.mockResolvedValue(null);

      await expect(getReplayData('nonexistent', 'user-123')).rejects.toMatchObject({
        code: 'CHALLENGE_NOT_FOUND',
      });
    });

    it('throws CHALLENGE_FORBIDDEN for non-participant', async () => {
      const challenge = createMockPvpChallenge({
        challengerId: 'user-456',
        challengedId: 'user-789',
        status: 'RESOLVED',
      });

      mockPrisma.pvpChallenge.findUnique.mockResolvedValue({
        ...challenge,
        result: createMockPvpResult(),
      });

      await expect(getReplayData('challenge-123', 'user-123')).rejects.toMatchObject({
        code: 'CHALLENGE_FORBIDDEN',
      });
    });

    it('throws CHALLENGE_NOT_PENDING for unresolved challenge', async () => {
      const challenge = createMockPvpChallenge({
        challengerId: 'user-123',
        status: 'PENDING',
      });

      mockPrisma.pvpChallenge.findUnique.mockResolvedValue({
        ...challenge,
        result: null,
      });

      await expect(getReplayData('challenge-123', 'user-123')).rejects.toMatchObject({
        code: 'CHALLENGE_NOT_PENDING',
      });
    });

    it('includes build configs and replay events', async () => {
      const challenge = createMockPvpChallenge({
        challengerId: 'user-123',
        status: 'RESOLVED',
        seed: 12345,
      });
      const pvpResult = createMockPvpResult({
        challengerBuild: { fortressClass: 'natural' },
        challengedBuild: { fortressClass: 'fire' },
        replayEvents: [{ tick: 1, event: 'test' }],
      });

      mockPrisma.pvpChallenge.findUnique.mockResolvedValue({
        ...challenge,
        result: pvpResult,
      });

      const result = await getReplayData('challenge-123', 'user-123');

      expect(result.challengerBuild).toEqual({ fortressClass: 'natural' });
      expect(result.challengedBuild).toEqual({ fortressClass: 'fire' });
      expect(result.replayEvents).toEqual([{ tick: 1, event: 'test' }]);
    });
  });

  // ============================================================================
  // getUserPvpStats
  // ============================================================================

  describe('getUserPvpStats', () => {
    it('returns wins, losses, and calculated win rate', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        pvpWins: 10,
        pvpLosses: 5,
      });
      mockPrisma.pvpChallenge.count.mockResolvedValue(2);

      const result = await getUserPvpStats('user-123');

      expect(result.wins).toBe(10);
      expect(result.losses).toBe(5);
      expect(result.totalBattles).toBe(15);
      expect(result.winRate).toBeCloseTo(66.7, 1);
    });

    it('returns 0 win rate when no battles', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        pvpWins: 0,
        pvpLosses: 0,
      });
      mockPrisma.pvpChallenge.count.mockResolvedValue(0);

      const result = await getUserPvpStats('user-123');

      expect(result.wins).toBe(0);
      expect(result.losses).toBe(0);
      expect(result.winRate).toBe(0);
      expect(result.totalBattles).toBe(0);
    });

    it('counts pending challenges', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        pvpWins: 5,
        pvpLosses: 3,
      });
      mockPrisma.pvpChallenge.count.mockResolvedValue(3);

      const result = await getUserPvpStats('user-123');

      expect(result.pendingChallenges).toBe(3);
    });

    it('excludes expired challenges from pending count', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        pvpWins: 5,
        pvpLosses: 3,
      });
      mockPrisma.pvpChallenge.count.mockResolvedValue(0);

      await getUserPvpStats('user-123');

      // Check that count query includes expiry filter
      expect(mockPrisma.pvpChallenge.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'PENDING',
            expiresAt: { gt: expect.any(Date) },
          }),
        })
      );
    });

    it('handles missing user gracefully', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.pvpChallenge.count.mockResolvedValue(0);

      const result = await getUserPvpStats('nonexistent');

      expect(result.wins).toBe(0);
      expect(result.losses).toBe(0);
      expect(result.winRate).toBe(0);
    });
  });
});
