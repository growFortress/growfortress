/**
 * Battle Pass service tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  mockPrisma,
  createMockBattlePassSeason,
  createMockBattlePassProgress,
  createMockInventory,
} from '../../mocks/prisma.js';
import '../../helpers/setup.js';

// Mock the stripe module
vi.mock('../../../lib/stripe.js', () => ({
  createCheckoutSession: vi.fn().mockResolvedValue({
    id: 'cs_test_123',
    url: 'https://checkout.stripe.com/test',
  }),
  isStripeConfigured: vi.fn().mockReturnValue(true),
}));

// Import service functions after setup
import {
  getActiveSeason,
  getUserProgress,
  addPoints,
  claimTierReward,
  claimAllRewards,
  purchaseTiers,
  grantPremiumStatus,
} from '../../../services/battlepass.js';

describe('Battle Pass Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // getActiveSeason tests
  // ============================================================================

  describe('getActiveSeason', () => {
    it('should return null if no active season', async () => {
      mockPrisma.battlePassSeason.findFirst.mockResolvedValue(null);

      const result = await getActiveSeason();

      expect(result).toBeNull();
      expect(mockPrisma.battlePassSeason.findFirst).toHaveBeenCalled();
    });

    it('should return active season within date range', async () => {
      const mockSeason = createMockBattlePassSeason();
      mockPrisma.battlePassSeason.findFirst.mockResolvedValue(mockSeason);

      const result = await getActiveSeason();

      expect(result).toEqual(mockSeason);
      expect(mockPrisma.battlePassSeason.findFirst).toHaveBeenCalledWith({
        where: {
          isActive: true,
          startsAt: { lte: expect.any(Date) },
          endsAt: { gt: expect.any(Date) },
        },
      });
    });

    it('should not return expired or future seasons', async () => {
      // First call returns null (no matching seasons)
      mockPrisma.battlePassSeason.findFirst.mockResolvedValue(null);

      const result = await getActiveSeason();

      expect(result).toBeNull();
      // The query ensures only current active seasons are returned
      expect(mockPrisma.battlePassSeason.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            startsAt: { lte: expect.any(Date) },
            endsAt: { gt: expect.any(Date) },
          }),
        })
      );
    });
  });

  // ============================================================================
  // getUserProgress tests
  // ============================================================================

  describe('getUserProgress', () => {
    it('should return null if no active season', async () => {
      mockPrisma.battlePassSeason.findFirst.mockResolvedValue(null);

      const result = await getUserProgress('user-123');

      expect(result).toBeNull();
    });

    it('should create new progress if none exists', async () => {
      const mockSeason = createMockBattlePassSeason();
      const newProgress = createMockBattlePassProgress({
        userId: 'user-123',
        seasonId: mockSeason.id,
        currentTier: 0,
        currentPoints: 0,
      });

      mockPrisma.battlePassSeason.findFirst.mockResolvedValue(mockSeason);
      mockPrisma.battlePassProgress.findUnique.mockResolvedValue(null);
      mockPrisma.battlePassProgress.create.mockResolvedValue(newProgress);

      const result = await getUserProgress('user-123');

      expect(result).not.toBeNull();
      expect(mockPrisma.battlePassProgress.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          seasonId: mockSeason.id,
          currentTier: 0,
          currentPoints: 0,
          isPremium: false,
          claimedFreeTiers: [],
          claimedPremiumTiers: [],
        },
      });
      expect(result!.progress.currentTier).toBe(0);
    });

    it('should return existing progress', async () => {
      const mockSeason = createMockBattlePassSeason();
      const existingProgress = createMockBattlePassProgress({
        userId: 'user-123',
        seasonId: mockSeason.id,
        currentTier: 15,
        currentPoints: 50,
      });

      mockPrisma.battlePassSeason.findFirst.mockResolvedValue(mockSeason);
      mockPrisma.battlePassProgress.findUnique.mockResolvedValue(existingProgress);

      const result = await getUserProgress('user-123');

      expect(result).not.toBeNull();
      expect(result!.progress.currentTier).toBe(15);
      expect(result!.progress.currentPoints).toBe(50);
      expect(mockPrisma.battlePassProgress.create).not.toHaveBeenCalled();
    });

    it('should calculate pointsToNextTier correctly', async () => {
      const mockSeason = createMockBattlePassSeason();
      const existingProgress = createMockBattlePassProgress({
        userId: 'user-123',
        seasonId: mockSeason.id,
        currentTier: 10,
        currentPoints: 75, // 75 points into tier, 100 per tier
      });

      mockPrisma.battlePassSeason.findFirst.mockResolvedValue(mockSeason);
      mockPrisma.battlePassProgress.findUnique.mockResolvedValue(existingProgress);

      const result = await getUserProgress('user-123');

      expect(result).not.toBeNull();
      // pointsToNextTier = 100 - 75 = 25
      expect(result!.progress.pointsToNextTier).toBe(25);
    });

    it('should include season and rewards data', async () => {
      const mockSeason = createMockBattlePassSeason();
      const existingProgress = createMockBattlePassProgress({
        userId: 'user-123',
        seasonId: mockSeason.id,
      });

      mockPrisma.battlePassSeason.findFirst.mockResolvedValue(mockSeason);
      mockPrisma.battlePassProgress.findUnique.mockResolvedValue(existingProgress);

      const result = await getUserProgress('user-123');

      expect(result).not.toBeNull();
      expect(result!.season).toBeDefined();
      expect(result!.season.id).toBe(mockSeason.id);
      expect(result!.season.name).toBe(mockSeason.name);
      expect(result!.freeRewards).toBeDefined();
      expect(result!.premiumRewards).toBeDefined();
      expect(result!.timeRemaining).toBeDefined();
    });
  });

  // ============================================================================
  // addPoints tests
  // ============================================================================

  describe('addPoints', () => {
    it('should return null if no active season', async () => {
      mockPrisma.battlePassSeason.findFirst.mockResolvedValue(null);

      const result = await addPoints('user-123', 'daily_quest');

      expect(result).toBeNull();
    });

    it('should create progress if not exists', async () => {
      const mockSeason = createMockBattlePassSeason();
      const newProgress = createMockBattlePassProgress({
        id: 'bp-new',
        userId: 'user-123',
        seasonId: mockSeason.id,
        currentTier: 0,
        currentPoints: 0,
      });

      mockPrisma.battlePassSeason.findFirst.mockResolvedValue(mockSeason);
      mockPrisma.battlePassProgress.findUnique.mockResolvedValue(null);
      mockPrisma.battlePassProgress.create.mockResolvedValue(newProgress);
      mockPrisma.battlePassProgress.update.mockResolvedValue({
        ...newProgress,
        currentPoints: 50,
      });

      const result = await addPoints('user-123', 'daily_quest');

      expect(result).not.toBeNull();
      expect(mockPrisma.battlePassProgress.create).toHaveBeenCalled();
    });

    it('should add points correctly', async () => {
      const mockSeason = createMockBattlePassSeason();
      const existingProgress = createMockBattlePassProgress({
        id: 'bp-123',
        userId: 'user-123',
        seasonId: mockSeason.id,
        currentTier: 5,
        currentPoints: 30,
      });

      mockPrisma.battlePassSeason.findFirst.mockResolvedValue(mockSeason);
      mockPrisma.battlePassProgress.findUnique.mockResolvedValue(existingProgress);
      mockPrisma.battlePassProgress.update.mockResolvedValue({
        ...existingProgress,
        currentPoints: 80, // 30 + 50 from daily_quest
      });

      const result = await addPoints('user-123', 'daily_quest');

      expect(result).not.toBeNull();
      expect(result!.success).toBe(true);
      expect(result!.pointsAdded).toBe(50); // daily_quest = 50 points
    });

    it('should tier up when threshold reached', async () => {
      const mockSeason = createMockBattlePassSeason();
      const existingProgress = createMockBattlePassProgress({
        id: 'bp-123',
        userId: 'user-123',
        seasonId: mockSeason.id,
        currentTier: 5,
        currentPoints: 80, // 80 + 50 = 130, should tier up
      });

      mockPrisma.battlePassSeason.findFirst.mockResolvedValue(mockSeason);
      mockPrisma.battlePassProgress.findUnique.mockResolvedValue(existingProgress);
      mockPrisma.battlePassProgress.update.mockResolvedValue({
        ...existingProgress,
        currentTier: 6,
        currentPoints: 30,
      });

      const result = await addPoints('user-123', 'daily_quest');

      expect(result).not.toBeNull();
      expect(result!.tieredUp).toBe(true);
      expect(result!.newTier).toBe(6);
      expect(result!.tiersGained).toBe(1);
    });

    it('should handle multiple tier ups', async () => {
      const mockSeason = createMockBattlePassSeason();
      const existingProgress = createMockBattlePassProgress({
        id: 'bp-123',
        userId: 'user-123',
        seasonId: mockSeason.id,
        currentTier: 5,
        currentPoints: 50, // 50 + 200 = 250, should tier up twice
      });

      mockPrisma.battlePassSeason.findFirst.mockResolvedValue(mockSeason);
      mockPrisma.battlePassProgress.findUnique.mockResolvedValue(existingProgress);
      mockPrisma.battlePassProgress.update.mockResolvedValue({
        ...existingProgress,
        currentTier: 7,
        currentPoints: 50,
      });

      const result = await addPoints('user-123', 'weekly_challenge'); // 200 points

      expect(result).not.toBeNull();
      expect(result!.tieredUp).toBe(true);
      expect(result!.newTier).toBe(7);
      expect(result!.tiersGained).toBe(2);
    });

    it('should not add points at max tier', async () => {
      const mockSeason = createMockBattlePassSeason();
      const existingProgress = createMockBattlePassProgress({
        id: 'bp-123',
        userId: 'user-123',
        seasonId: mockSeason.id,
        currentTier: 50, // Max tier
        currentPoints: 0,
      });

      mockPrisma.battlePassSeason.findFirst.mockResolvedValue(mockSeason);
      mockPrisma.battlePassProgress.findUnique.mockResolvedValue(existingProgress);

      const result = await addPoints('user-123', 'daily_quest');

      expect(result).not.toBeNull();
      expect(result!.pointsAdded).toBe(0);
      expect(result!.newTier).toBe(50);
      expect(result!.tieredUp).toBe(false);
    });

    it('should calculate tiersGained correctly', async () => {
      const mockSeason = createMockBattlePassSeason();
      const existingProgress = createMockBattlePassProgress({
        id: 'bp-123',
        userId: 'user-123',
        seasonId: mockSeason.id,
        currentTier: 10,
        currentPoints: 0,
      });

      mockPrisma.battlePassSeason.findFirst.mockResolvedValue(mockSeason);
      mockPrisma.battlePassProgress.findUnique.mockResolvedValue(existingProgress);
      mockPrisma.battlePassProgress.update.mockResolvedValue({
        ...existingProgress,
        currentTier: 12,
        currentPoints: 0,
      });

      // Adding 200 points should result in 2 tiers gained
      const result = await addPoints('user-123', 'weekly_challenge');

      expect(result).not.toBeNull();
      expect(result!.tiersGained).toBe(2);
    });
  });

  // ============================================================================
  // claimTierReward tests
  // ============================================================================

  describe('claimTierReward', () => {
    it('should return error if no active season', async () => {
      mockPrisma.battlePassSeason.findFirst.mockResolvedValue(null);

      const result = await claimTierReward('user-123', 5, 'free');

      expect(result.success).toBe(false);
      expect(result.error).toBe('NO_ACTIVE_SEASON');
    });

    it('should return error if tier not reached', async () => {
      const mockSeason = createMockBattlePassSeason();
      const progress = createMockBattlePassProgress({
        userId: 'user-123',
        seasonId: mockSeason.id,
        currentTier: 3, // Lower than tier 5
      });

      mockPrisma.battlePassSeason.findFirst.mockResolvedValue(mockSeason);
      mockPrisma.battlePassProgress.findUnique.mockResolvedValue(progress);

      const result = await claimTierReward('user-123', 5, 'free');

      expect(result.success).toBe(false);
      expect(result.error).toBe('TIER_NOT_REACHED');
    });

    it('should return error if not premium for premium track', async () => {
      const mockSeason = createMockBattlePassSeason();
      const progress = createMockBattlePassProgress({
        userId: 'user-123',
        seasonId: mockSeason.id,
        currentTier: 10,
        isPremium: false,
      });

      mockPrisma.battlePassSeason.findFirst.mockResolvedValue(mockSeason);
      mockPrisma.battlePassProgress.findUnique.mockResolvedValue(progress);

      const result = await claimTierReward('user-123', 5, 'premium');

      expect(result.success).toBe(false);
      expect(result.error).toBe('NOT_PREMIUM');
    });

    it('should return error if already claimed', async () => {
      const mockSeason = createMockBattlePassSeason();
      const progress = createMockBattlePassProgress({
        userId: 'user-123',
        seasonId: mockSeason.id,
        currentTier: 10,
        claimedFreeTiers: [5], // Already claimed tier 5
      });

      mockPrisma.battlePassSeason.findFirst.mockResolvedValue(mockSeason);
      mockPrisma.battlePassProgress.findUnique.mockResolvedValue(progress);

      const result = await claimTierReward('user-123', 5, 'free');

      expect(result.success).toBe(false);
      expect(result.error).toBe('ALREADY_CLAIMED');
    });

    it('should grant dust rewards', async () => {
      const mockSeason = createMockBattlePassSeason();
      const progress = createMockBattlePassProgress({
        id: 'bp-123',
        userId: 'user-123',
        seasonId: mockSeason.id,
        currentTier: 15,
        claimedFreeTiers: [],
      });
      const inventory = createMockInventory({ userId: 'user-123', dust: 100 });

      mockPrisma.battlePassSeason.findFirst.mockResolvedValue(mockSeason);
      mockPrisma.battlePassProgress.findUnique.mockResolvedValue(progress);
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        // Mock transaction to return updated values
        mockPrisma.battlePassProgress.update.mockResolvedValue({
          ...progress,
          claimedFreeTiers: [10],
        });
        mockPrisma.inventory.findUnique.mockResolvedValue(inventory);
        mockPrisma.inventory.update.mockResolvedValue({
          ...inventory,
          dust: 150, // 100 + 50 from tier 10 reward
        });
        return fn(mockPrisma);
      });

      const result = await claimTierReward('user-123', 10, 'free');

      expect(result.success).toBe(true);
      expect(result.rewardType).toBe('dust');
      expect(result.amount).toBe(50);
    });

    it('should grant gold rewards', async () => {
      const mockSeason = createMockBattlePassSeason();
      const progress = createMockBattlePassProgress({
        id: 'bp-123',
        userId: 'user-123',
        seasonId: mockSeason.id,
        currentTier: 10,
        claimedFreeTiers: [],
      });
      const inventory = createMockInventory({ userId: 'user-123', gold: 500 });

      mockPrisma.battlePassSeason.findFirst.mockResolvedValue(mockSeason);
      mockPrisma.battlePassProgress.findUnique.mockResolvedValue(progress);
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        mockPrisma.battlePassProgress.update.mockResolvedValue({
          ...progress,
          claimedFreeTiers: [5],
        });
        mockPrisma.inventory.findUnique.mockResolvedValue(inventory);
        mockPrisma.inventory.update.mockResolvedValue({
          ...inventory,
          gold: 600, // 500 + 100 from tier 5 reward
        });
        return fn(mockPrisma);
      });

      const result = await claimTierReward('user-123', 5, 'free');

      expect(result.success).toBe(true);
      expect(result.rewardType).toBe('gold');
      expect(result.amount).toBe(100);
    });

    it('should grant material rewards', async () => {
      const mockSeason = createMockBattlePassSeason();
      const progress = createMockBattlePassProgress({
        id: 'bp-123',
        userId: 'user-123',
        seasonId: mockSeason.id,
        currentTier: 20,
        claimedFreeTiers: [],
      });
      const inventory = createMockInventory({ userId: 'user-123', materials: {} });

      mockPrisma.battlePassSeason.findFirst.mockResolvedValue(mockSeason);
      mockPrisma.battlePassProgress.findUnique.mockResolvedValue(progress);
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        mockPrisma.battlePassProgress.update.mockResolvedValue({
          ...progress,
          claimedFreeTiers: [15],
        });
        mockPrisma.inventory.findUnique.mockResolvedValue(inventory);
        mockPrisma.inventory.update.mockResolvedValue(inventory);
        return fn(mockPrisma);
      });

      const result = await claimTierReward('user-123', 15, 'free');

      expect(result.success).toBe(true);
      expect(result.rewardType).toBe('material');
    });

    it('should update claimedTiers array', async () => {
      const mockSeason = createMockBattlePassSeason();
      const progress = createMockBattlePassProgress({
        id: 'bp-123',
        userId: 'user-123',
        seasonId: mockSeason.id,
        currentTier: 10,
        claimedFreeTiers: [],
        isPremium: true,
        claimedPremiumTiers: [],
      });
      const inventory = createMockInventory({ userId: 'user-123', dust: 100 });

      mockPrisma.battlePassSeason.findFirst.mockResolvedValue(mockSeason);
      mockPrisma.battlePassProgress.findUnique.mockResolvedValue(progress);
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        mockPrisma.battlePassProgress.update.mockResolvedValue({
          ...progress,
          claimedPremiumTiers: [5],
        });
        mockPrisma.inventory.findUnique.mockResolvedValue(inventory);
        mockPrisma.inventory.update.mockResolvedValue({
          ...inventory,
          dust: 600, // 100 + 500 from premium tier 5
        });
        return fn(mockPrisma);
      });

      await claimTierReward('user-123', 5, 'premium');

      expect(mockPrisma.battlePassProgress.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'bp-123' },
          data: { claimedPremiumTiers: { push: 5 } },
        })
      );
    });
  });

  // ============================================================================
  // claimAllRewards tests
  // ============================================================================

  describe('claimAllRewards', () => {
    it('should return empty if no progress', async () => {
      const mockSeason = createMockBattlePassSeason();
      mockPrisma.battlePassSeason.findFirst.mockResolvedValue(mockSeason);
      mockPrisma.battlePassProgress.findUnique.mockResolvedValue(null);

      const result = await claimAllRewards('user-123');

      expect(result.claimedRewards).toHaveLength(0);
      expect(result.totalDustGained).toBe(0);
      expect(result.totalGoldGained).toBe(0);
    });

    it('should claim all unclaimed free rewards', async () => {
      const mockSeason = createMockBattlePassSeason();
      const progress = createMockBattlePassProgress({
        id: 'bp-123',
        userId: 'user-123',
        seasonId: mockSeason.id,
        currentTier: 15, // Has access to tiers 5, 10, 15 on free track
        isPremium: false,
        claimedFreeTiers: [], // None claimed yet
      });
      const inventory = createMockInventory({ userId: 'user-123', dust: 100, gold: 200 });

      mockPrisma.battlePassSeason.findFirst.mockResolvedValue(mockSeason);
      mockPrisma.battlePassProgress.findUnique.mockResolvedValue(progress);
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        mockPrisma.battlePassProgress.update.mockResolvedValue({
          ...progress,
          claimedFreeTiers: [5, 10, 15],
        });
        mockPrisma.inventory.findUnique.mockResolvedValue({
          ...inventory,
          dust: 150, // After claiming
          gold: 300,
        });
        mockPrisma.inventory.update.mockResolvedValue({
          ...inventory,
          dust: 150,
          gold: 300,
        });
        return fn(mockPrisma);
      });

      const result = await claimAllRewards('user-123');

      expect(result.claimedRewards.length).toBeGreaterThan(0);
      // Should claim tiers 5, 10, 15
      const claimedTiers = result.claimedRewards.map(r => r.tier);
      expect(claimedTiers).toContain(5);
      expect(claimedTiers).toContain(10);
      expect(claimedTiers).toContain(15);
    });

    it('should claim premium rewards if isPremium', async () => {
      const mockSeason = createMockBattlePassSeason();
      const progress = createMockBattlePassProgress({
        id: 'bp-123',
        userId: 'user-123',
        seasonId: mockSeason.id,
        currentTier: 10,
        isPremium: true,
        claimedFreeTiers: [5, 10], // Free already claimed
        claimedPremiumTiers: [], // Premium not claimed
      });
      const inventory = createMockInventory({ userId: 'user-123', dust: 100, gold: 200 });

      mockPrisma.battlePassSeason.findFirst.mockResolvedValue(mockSeason);
      mockPrisma.battlePassProgress.findUnique.mockResolvedValue(progress);
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        mockPrisma.battlePassProgress.update.mockResolvedValue({
          ...progress,
          claimedPremiumTiers: [1, 5, 10],
        });
        mockPrisma.inventory.findUnique.mockResolvedValue({
          ...inventory,
          dust: 700, // After claiming premium rewards
        });
        mockPrisma.inventory.update.mockResolvedValue(inventory);
        mockPrisma.userCosmetic.upsert.mockResolvedValue({});
        return fn(mockPrisma);
      });

      const result = await claimAllRewards('user-123');

      // Should claim premium tiers 1, 5, 10
      const premiumClaims = result.claimedRewards.filter(r => r.track === 'premium');
      expect(premiumClaims.length).toBeGreaterThan(0);
    });

    it('should return correct totals', async () => {
      const mockSeason = createMockBattlePassSeason();
      const progress = createMockBattlePassProgress({
        id: 'bp-123',
        userId: 'user-123',
        seasonId: mockSeason.id,
        currentTier: 10, // Access to tier 5 (100 gold), tier 10 (50 dust)
        isPremium: false,
        claimedFreeTiers: [],
      });
      const inventory = createMockInventory({ userId: 'user-123', dust: 1000, gold: 500 });

      mockPrisma.battlePassSeason.findFirst.mockResolvedValue(mockSeason);
      mockPrisma.battlePassProgress.findUnique.mockResolvedValue(progress);
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        mockPrisma.battlePassProgress.update.mockResolvedValue({
          ...progress,
          claimedFreeTiers: [5, 10],
        });
        mockPrisma.inventory.findUnique.mockResolvedValue({
          ...inventory,
          dust: 1050, // 1000 + 50
          gold: 600, // 500 + 100
        });
        mockPrisma.inventory.update.mockResolvedValue(inventory);
        return fn(mockPrisma);
      });

      const result = await claimAllRewards('user-123');

      expect(result.totalDustGained).toBe(50); // tier 10 gives 50 dust
      expect(result.totalGoldGained).toBe(100); // tier 5 gives 100 gold
      expect(result.newDustBalance).toBe(1050);
      expect(result.newGoldBalance).toBe(600);
    });
  });

  // ============================================================================
  // purchaseTiers tests
  // ============================================================================

  describe('purchaseTiers', () => {
    it('should return error if no active season', async () => {
      mockPrisma.battlePassSeason.findFirst.mockResolvedValue(null);

      const result = await purchaseTiers('user-123', 5);

      expect(result.success).toBe(false);
      expect(result.error).toBe('NO_ACTIVE_SEASON');
    });

    it('should return error if at max tier', async () => {
      const mockSeason = createMockBattlePassSeason();
      const progress = createMockBattlePassProgress({
        userId: 'user-123',
        seasonId: mockSeason.id,
        currentTier: 50, // Max tier
      });

      mockPrisma.battlePassSeason.findFirst.mockResolvedValue(mockSeason);
      mockPrisma.battlePassProgress.findUnique.mockResolvedValue(progress);

      const result = await purchaseTiers('user-123', 5);

      expect(result.success).toBe(false);
      expect(result.error).toBe('MAX_TIER_REACHED');
    });

    it('should return error if insufficient dust', async () => {
      const mockSeason = createMockBattlePassSeason();
      const progress = createMockBattlePassProgress({
        userId: 'user-123',
        seasonId: mockSeason.id,
        currentTier: 10,
      });
      const inventory = createMockInventory({
        userId: 'user-123',
        dust: 200, // Need 500 dust for 5 tiers (100 each)
      });

      mockPrisma.battlePassSeason.findFirst.mockResolvedValue(mockSeason);
      mockPrisma.battlePassProgress.findUnique.mockResolvedValue(progress);
      mockPrisma.inventory.findUnique.mockResolvedValue(inventory);

      const result = await purchaseTiers('user-123', 5);

      expect(result.success).toBe(false);
      expect(result.error).toBe('INSUFFICIENT_DUST');
      expect(result.newDustBalance).toBe(200);
    });

    it('should deduct dust and increase tier', async () => {
      const mockSeason = createMockBattlePassSeason();
      const progress = createMockBattlePassProgress({
        id: 'bp-123',
        userId: 'user-123',
        seasonId: mockSeason.id,
        currentTier: 10,
      });
      const inventory = createMockInventory({
        userId: 'user-123',
        dust: 1000,
      });

      mockPrisma.battlePassSeason.findFirst.mockResolvedValue(mockSeason);
      mockPrisma.battlePassProgress.findUnique.mockResolvedValue(progress);
      mockPrisma.inventory.findUnique.mockResolvedValue(inventory);
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        mockPrisma.inventory.update.mockResolvedValue({
          ...inventory,
          dust: 500, // 1000 - 500 (5 tiers * 100)
        });
        mockPrisma.battlePassProgress.update.mockResolvedValue({
          ...progress,
          currentTier: 15,
        });
        return fn(mockPrisma);
      });

      const result = await purchaseTiers('user-123', 5);

      expect(result.success).toBe(true);
      expect(result.tiersGained).toBe(5);
      expect(result.dustSpent).toBe(500);
      expect(result.newTier).toBe(15);
      expect(result.newDustBalance).toBe(500);
    });

    it('should cap at max tier', async () => {
      const mockSeason = createMockBattlePassSeason();
      const progress = createMockBattlePassProgress({
        id: 'bp-123',
        userId: 'user-123',
        seasonId: mockSeason.id,
        currentTier: 48, // 2 away from max
      });
      const inventory = createMockInventory({
        userId: 'user-123',
        dust: 1000,
      });

      mockPrisma.battlePassSeason.findFirst.mockResolvedValue(mockSeason);
      mockPrisma.battlePassProgress.findUnique.mockResolvedValue(progress);
      mockPrisma.inventory.findUnique.mockResolvedValue(inventory);
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        mockPrisma.inventory.update.mockResolvedValue({
          ...inventory,
          dust: 800, // 1000 - 200 (only 2 tiers * 100, capped)
        });
        mockPrisma.battlePassProgress.update.mockResolvedValue({
          ...progress,
          currentTier: 50,
        });
        return fn(mockPrisma);
      });

      const result = await purchaseTiers('user-123', 10); // Requested 10, but only 2 available

      expect(result.success).toBe(true);
      expect(result.tiersGained).toBe(2); // Only 2 tiers gained (capped at 50)
      expect(result.dustSpent).toBe(200); // Only charged for 2 tiers
      expect(result.newTier).toBe(50);
    });
  });

  // ============================================================================
  // grantPremiumStatus tests
  // ============================================================================

  describe('grantPremiumStatus', () => {
    it('should return false if no active season', async () => {
      mockPrisma.battlePassSeason.findFirst.mockResolvedValue(null);

      const result = await grantPremiumStatus('user-123');

      expect(result).toBe(false);
    });

    it('should create progress if not exists', async () => {
      const mockSeason = createMockBattlePassSeason();
      mockPrisma.battlePassSeason.findFirst.mockResolvedValue(mockSeason);
      mockPrisma.battlePassProgress.upsert.mockResolvedValue(
        createMockBattlePassProgress({
          userId: 'user-123',
          seasonId: mockSeason.id,
          isPremium: true,
          purchasedAt: new Date(),
        })
      );

      const result = await grantPremiumStatus('user-123');

      expect(result).toBe(true);
      expect(mockPrisma.battlePassProgress.upsert).toHaveBeenCalledWith({
        where: {
          userId_seasonId: {
            userId: 'user-123',
            seasonId: mockSeason.id,
          },
        },
        create: expect.objectContaining({
          userId: 'user-123',
          seasonId: mockSeason.id,
          isPremium: true,
        }),
        update: expect.objectContaining({
          isPremium: true,
        }),
      });
    });

    it('should update isPremium to true', async () => {
      const mockSeason = createMockBattlePassSeason();
      const existingProgress = createMockBattlePassProgress({
        userId: 'user-123',
        seasonId: mockSeason.id,
        isPremium: false,
        currentTier: 20,
      });

      mockPrisma.battlePassSeason.findFirst.mockResolvedValue(mockSeason);
      mockPrisma.battlePassProgress.upsert.mockResolvedValue({
        ...existingProgress,
        isPremium: true,
        purchasedAt: new Date(),
      });

      const result = await grantPremiumStatus('user-123');

      expect(result).toBe(true);
      expect(mockPrisma.battlePassProgress.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            isPremium: true,
            purchasedAt: expect.any(Date),
          }),
        })
      );
    });
  });
});
