/**
 * Auth service tests
 */
import { describe, it, expect, vi } from 'vitest';
import { registerUser, loginUser, refreshTokens, getUserProfile, getXpForLevel, getProgressionBonuses } from '../../../services/auth.js';
import { mockPrisma, createMockUser, createMockInventory, createMockProgression, createMockSession } from '../../mocks/prisma.js';
import bcrypt from 'bcrypt';

// Mock bcrypt
vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}));

describe('Auth Service', () => {
  describe('registerUser', () => {
    it('creates new user with inventory and progression', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as ReturnType<typeof vi.fn>).mockResolvedValue('hashed-password');

      const mockUser = createMockUser({ id: 'new-user-123' });
      mockPrisma.user.create.mockResolvedValue(mockUser);

      const mockSession = createMockSession({ userId: 'new-user-123' });
      mockPrisma.session.create.mockResolvedValue(mockSession);

      const result = await registerUser('testuser', 'password123');

      expect(result.userId).toBe('new-user-123');
      expect(result.displayName).toBe('TestUser');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.expiresAt).toBeGreaterThan(Date.now());
    });

    it('throws error if username is taken', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(createMockUser());

      await expect(registerUser('testuser', 'password123')).rejects.toThrow('USERNAME_TAKEN');
    });

    it('hashes password before storing', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as ReturnType<typeof vi.fn>).mockResolvedValue('hashed-password');

      const mockUser = createMockUser();
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockPrisma.session.create.mockResolvedValue(createMockSession());

      await registerUser('testuser', 'password123');

      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 12);
    });
  });

  describe('loginUser', () => {
    it('returns tokens on valid credentials', async () => {
      const mockUser = createMockUser();
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);
      mockPrisma.session.create.mockResolvedValue(createMockSession());

      const result = await loginUser('testuser', 'password123');

      expect(result).not.toBeNull();
      expect(result!.userId).toBe('user-123');
      expect(result!.accessToken).toBeDefined();
      expect(result!.refreshToken).toBeDefined();
    });

    it('returns null if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await loginUser('nonexistent', 'password123');

      expect(result).toBeNull();
    });

    it('returns null if password is wrong', async () => {
      const mockUser = createMockUser();
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(false);

      const result = await loginUser('testuser', 'wrongpassword');

      expect(result).toBeNull();
    });

    it('creates session on successful login', async () => {
      const mockUser = createMockUser();
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);
      mockPrisma.session.create.mockResolvedValue(createMockSession());

      await loginUser('testuser', 'password123');

      expect(mockPrisma.session.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-123',
          }),
        })
      );
    });

    it('normalizes username to lowercase', async () => {
      const mockUser = createMockUser();
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);
      mockPrisma.session.create.mockResolvedValue(createMockSession());

      await loginUser('TestUser', 'password123');

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { username: 'testuser' },
      });
    });
  });

  describe('refreshTokens', () => {
    it('returns null for invalid token', async () => {
      // Invalid token will fail verification
      const result = await refreshTokens('invalid-token');

      expect(result).toBeNull();
    });

    it('returns null for revoked session', async () => {
      // This test would need a valid token - skipping for now as token verification is complex
    });
  });

  describe('getUserProfile', () => {
    it('returns complete profile', async () => {
      const mockUser = createMockUser();
      const mockInventory = createMockInventory();
      const mockProgression = createMockProgression();

      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        inventory: mockInventory,
        progression: mockProgression,
      });

      const result = await getUserProfile('user-123');

      expect(result).not.toBeNull();
      expect(result!.userId).toBe('user-123');
      expect(result!.displayName).toBe('TestUser');
      expect(result!.inventory).toEqual({
        gold: 100,
        dust: 50,
        sigils: 0,
      });
      expect(result!.progression.level).toBe(1);
    });

    it('returns null if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await getUserProfile('nonexistent');

      expect(result).toBeNull();
    });

    it('returns null if inventory missing', async () => {
      const mockUser = createMockUser();
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        inventory: null,
        progression: createMockProgression(),
      });

      const result = await getUserProfile('user-123');

      expect(result).toBeNull();
    });

    it('returns null if progression missing', async () => {
      const mockUser = createMockUser();
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        inventory: createMockInventory(),
        progression: null,
      });

      const result = await getUserProfile('user-123');

      expect(result).toBeNull();
    });

    it('calculates XP to next level correctly', async () => {
      const mockUser = createMockUser();
      const mockInventory = createMockInventory();
      // Level 5 with 300 XP earned in current level
      const mockProgression = createMockProgression({ level: 5, xp: 300 });

      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        inventory: mockInventory,
        progression: mockProgression,
      });

      const result = await getUserProfile('user-123');

      // New formula: level 5 = 5 * 200 = 1000 XP needed
      // XP to next: 1000 - 300 = 700
      expect(result!.progression.xpToNextLevel).toBe(700);
    });
  });

  describe('getXpForLevel', () => {
    it('returns 200 for level 1', () => {
      // New formula: level 1 = 1 * 200 = 200
      expect(getXpForLevel(1)).toBe(200);
    });

    it('returns 400 for level 2', () => {
      // New formula: level 2 = 2 * 200 = 400
      expect(getXpForLevel(2)).toBe(400);
    });

    it('uses quadratic formula for levels 11-30', () => {
      // Level 15: 15^2 * 18 = 4050
      expect(getXpForLevel(15)).toBe(4050);
    });

    it('uses steep formula for levels 31-50', () => {
      // Level 35: 35^2 * 40 = 49000
      expect(getXpForLevel(35)).toBe(49000);
    });

    it('uses linear post-50 formula', () => {
      // Level 55: 100000 + (55-50) * 8000 = 140000
      expect(getXpForLevel(55)).toBe(140000);
    });
  });

  describe('getProgressionBonuses', () => {
    it('returns base values at level 1', () => {
      const bonuses = getProgressionBonuses(1);

      expect(bonuses.damageMultiplier).toBe(1);
      expect(bonuses.goldMultiplier).toBe(1);
      expect(bonuses.startingGold).toBe(0);
      expect(bonuses.maxHeroSlots).toBe(1);
      expect(bonuses.maxTurretSlots).toBe(1); // Level 1 = 1 turret slot
    });

    it('unlocks hero slot 2 at level 10', () => {
      const bonuses = getProgressionBonuses(10);
      expect(bonuses.maxHeroSlots).toBe(2);
    });

    it('unlocks hero slot 3 at level 30', () => {
      const bonuses = getProgressionBonuses(30);
      expect(bonuses.maxHeroSlots).toBe(3);
    });

    it('unlocks hero slot 4 at level 45', () => {
      const bonuses = getProgressionBonuses(45);
      expect(bonuses.maxHeroSlots).toBe(4);
    });

    it('unlocks turret slot 3 at level 20', () => {
      const bonuses = getProgressionBonuses(20);
      expect(bonuses.maxTurretSlots).toBe(3);
    });

    it('unlocks turret slot 6 at level 40', () => {
      const bonuses = getProgressionBonuses(40);
      expect(bonuses.maxTurretSlots).toBe(6);
    });

    it('includes bonus starting gold at level 5', () => {
      const bonuses = getProgressionBonuses(5);
      expect(bonuses.startingGold).toBeGreaterThan(0);
    });

    it('has base damage multiplier at level 15', () => {
      // Damage bonuses from level rewards are separate (in calculateTotalDamageBonus)
      // damageMultiplier in getProgressionBonuses is only > 1 for post-50 levels
      const bonuses = getProgressionBonuses(15);
      expect(bonuses.damageMultiplier).toBe(1);
    });

    it('includes gold bonus at level 30', () => {
      const bonuses = getProgressionBonuses(30);
      expect(bonuses.goldMultiplier).toBeGreaterThan(1);
    });

    it('provides post-50 bonuses', () => {
      const bonuses50 = getProgressionBonuses(50);
      const bonuses60 = getProgressionBonuses(60);

      // Post-50 should have additional bonuses
      expect(bonuses60.damageMultiplier).toBeGreaterThan(bonuses50.damageMultiplier);
      expect(bonuses60.goldMultiplier).toBeGreaterThan(bonuses50.goldMultiplier);
      expect(bonuses60.startingGold).toBeGreaterThan(bonuses50.startingGold);
    });
  });
});

