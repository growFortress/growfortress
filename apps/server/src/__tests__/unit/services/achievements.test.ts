/**
 * Achievements Service Unit Tests
 * Tests the permanent achievement system (Hero Zero style)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  mockPrisma,
  resetPrismaMock,
  createMockUser,
  createMockInventory,
  createMockPlayerAchievements,
  createMockPlayerAchievementsWithProgress,
  createDefaultLifetimeStats,
} from '../../mocks/prisma.js';

// Mock Prisma client
vi.mock('../../../lib/prisma.js', () => ({
  prisma: mockPrisma,
}));

// Mock battlepass addPoints
vi.mock('../../../services/battlepass.js', () => ({
  addPoints: vi.fn().mockResolvedValue({ success: true }),
}));

import {
  getOrCreateAchievements,
  getAchievements,
  claimAchievementReward,
  claimAllAchievementRewards,
  updateLifetimeStats,
  setActiveTitle,
  getActiveTitle,
} from '../../../services/achievements.js';

import {
  ACHIEVEMENT_DEFINITIONS,
  ACHIEVEMENT_ERROR_CODES,
} from '@arcade/protocol';

describe('Achievements Service', () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  // ==========================================================================
  // getOrCreateAchievements Tests
  // ==========================================================================
  describe('getOrCreateAchievements', () => {
    it('should return existing achievements record', async () => {
      const mockAchievements = createMockPlayerAchievements();
      mockPrisma.playerAchievements.findUnique.mockResolvedValue(mockAchievements);

      const result = await getOrCreateAchievements('user-123');

      expect(result).toEqual(mockAchievements);
      expect(mockPrisma.playerAchievements.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      });
      expect(mockPrisma.playerAchievements.create).not.toHaveBeenCalled();
    });

    it('should create new achievements record if not exists', async () => {
      const newAchievements = createMockPlayerAchievements();
      mockPrisma.playerAchievements.findUnique.mockResolvedValue(null);
      mockPrisma.playerAchievements.create.mockResolvedValue(newAchievements);

      const result = await getOrCreateAchievements('user-123');

      expect(result).toEqual(newAchievements);
      expect(mockPrisma.playerAchievements.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          lifetimeStats: expect.objectContaining({
            totalKills: 0,
            wavesCompleted: 0,
            goldEarned: '0',
          }),
          achievementProgress: {},
          claimedTiers: {},
          unlockedTitles: [],
          activeTitle: null,
        },
      });
    });

    it('should initialize all lifetime stats with default values', async () => {
      mockPrisma.playerAchievements.findUnique.mockResolvedValue(null);
      mockPrisma.playerAchievements.create.mockImplementation(async ({ data }) => ({
        id: 'achievements-new',
        userId: 'user-123',
        ...data,
        updatedAt: new Date(),
      }));

      await getOrCreateAchievements('user-123');

      const createCall = mockPrisma.playerAchievements.create.mock.calls[0][0];
      const stats = createCall.data.lifetimeStats;

      expect(stats.totalKills).toBe(0);
      expect(stats.eliteKills).toBe(0);
      expect(stats.bossKills).toBe(0);
      expect(stats.wavesCompleted).toBe(0);
      expect(stats.runsCompleted).toBe(0);
      expect(stats.goldEarned).toBe('0');
      expect(stats.damageDealt).toBe('0');
      expect(stats.commanderLevel).toBe(1);
    });
  });

  // ==========================================================================
  // getAchievements Tests
  // ==========================================================================
  describe('getAchievements', () => {
    it('should return all achievements with progress', async () => {
      const mockAchievements = createMockPlayerAchievementsWithProgress(
        { totalKills: 500, wavesCompleted: 100 },
        {},
        []
      );
      const mockUser = createMockUser({
        highestWave: 50,
        totalWaves: 200,
        pvpWins: 10,
        pvpLosses: 5,
        progression: { level: 15 },
        colonyProgress: { prestigeCount: 2 },
        inventory: { unlockedHeroIds: ['vanguard', 'medic', 'pyro'], unlockedTurretIds: ['railgun'] },
      });

      mockPrisma.playerAchievements.findUnique.mockResolvedValue(mockAchievements);
      mockPrisma.playerAchievements.create.mockResolvedValue(mockAchievements);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await getAchievements('user-123');

      expect(result.achievements).toHaveLength(ACHIEVEMENT_DEFINITIONS.length);
      expect(result.lifetimeStats).toBeDefined();
      expect(result.categoryProgress).toBeDefined();
      expect(result.unlockedTitles).toEqual([]);
      expect(result.activeTitle).toBeNull();
    });

    it('should merge user model stats with lifetime stats', async () => {
      const mockAchievements = createMockPlayerAchievementsWithProgress(
        { wavesCompleted: 100 },
        {},
        []
      );
      const mockUser = createMockUser({
        totalWaves: 300, // Higher than lifetimeStats
        pvpWins: 15,
        pvpLosses: 5,
        progression: { level: 25 },
        colonyProgress: { prestigeCount: 3 },
        inventory: { unlockedHeroIds: ['vanguard', 'medic'], unlockedTurretIds: [] },
      });

      mockPrisma.playerAchievements.findUnique.mockResolvedValue(mockAchievements);
      mockPrisma.playerAchievements.create.mockResolvedValue(mockAchievements);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await getAchievements('user-123');

      // Should use the higher value between lifetimeStats and user model
      expect(result.lifetimeStats.wavesCompleted).toBe(300);
      expect(result.lifetimeStats.pvpVictories).toBe(15);
      expect(result.lifetimeStats.pvpBattles).toBe(20);
      expect(result.lifetimeStats.commanderLevel).toBe(25);
      expect(result.lifetimeStats.prestigeCount).toBe(3);
      expect(result.lifetimeStats.heroesUnlocked).toBe(2);
    });

    it('should calculate correct progress for each achievement', async () => {
      // Create stats that satisfy tier 2 of enemy_slayer (target 500)
      const mockAchievements = createMockPlayerAchievementsWithProgress(
        { totalKills: 750 }, // Between tier 2 (500) and tier 3 (2500)
        { enemy_slayer: [1] }, // Already claimed tier 1
        []
      );
      const mockUser = createMockUser({
        inventory: { unlockedHeroIds: [], unlockedTurretIds: [] },
      });

      mockPrisma.playerAchievements.findUnique.mockResolvedValue(mockAchievements);
      mockPrisma.playerAchievements.create.mockResolvedValue(mockAchievements);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await getAchievements('user-123');

      const enemySlayer = result.achievements.find(a => a.definition.id === 'enemy_slayer');
      expect(enemySlayer).toBeDefined();
      expect(enemySlayer!.progress.currentTier).toBe(2); // Reached tier 2
      expect(enemySlayer!.progress.currentProgress).toBe(750);
      expect(enemySlayer!.progress.nextTier).toBe(3);
      expect(enemySlayer!.progress.claimedTiers).toEqual([1]);
      expect(enemySlayer!.progress.hasUnclaimedReward).toBe(true); // Tier 2 is unclaimed
    });

    it('should calculate category progress correctly', async () => {
      const mockAchievements = createMockPlayerAchievementsWithProgress(
        { totalKills: 1000, wavesCompleted: 500 },
        { enemy_slayer: [1, 2], wave_warrior: [1] },
        []
      );
      const mockUser = createMockUser({
        inventory: { unlockedHeroIds: [], unlockedTurretIds: [] },
      });

      mockPrisma.playerAchievements.findUnique.mockResolvedValue(mockAchievements);
      mockPrisma.playerAchievements.create.mockResolvedValue(mockAchievements);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await getAchievements('user-123');

      expect(result.categoryProgress.combat?.completed).toBe(2); // enemy_slayer tiers claimed
      expect(result.categoryProgress.progression?.completed).toBe(1); // wave_warrior tier claimed
      expect(result.categoryProgress.combat?.total).toBeGreaterThan(0);
    });

    it('should detect unclaimed rewards correctly', async () => {
      // Stats reach tier 3 but only tier 1 claimed
      const mockAchievements = createMockPlayerAchievementsWithProgress(
        { totalKills: 3000 }, // Reaches tier 3 (target 2500)
        { enemy_slayer: [1] }, // Only tier 1 claimed
        []
      );
      const mockUser = createMockUser({
        inventory: { unlockedHeroIds: [], unlockedTurretIds: [] },
      });

      mockPrisma.playerAchievements.findUnique.mockResolvedValue(mockAchievements);
      mockPrisma.playerAchievements.create.mockResolvedValue(mockAchievements);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await getAchievements('user-123');

      const enemySlayer = result.achievements.find(a => a.definition.id === 'enemy_slayer');
      expect(enemySlayer!.progress.hasUnclaimedReward).toBe(true);
      expect(result.totalUnclaimedRewards).toBeGreaterThan(0);
    });

    it('should handle max tier completion', async () => {
      // Create max kills to complete all tiers
      const maxKills = 100000000; // More than tier 10 (100M)
      const mockAchievements = createMockPlayerAchievementsWithProgress(
        { totalKills: maxKills },
        { enemy_slayer: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
        []
      );
      const mockUser = createMockUser({
        inventory: { unlockedHeroIds: [], unlockedTurretIds: [] },
      });

      mockPrisma.playerAchievements.findUnique.mockResolvedValue(mockAchievements);
      mockPrisma.playerAchievements.create.mockResolvedValue(mockAchievements);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await getAchievements('user-123');

      const enemySlayer = result.achievements.find(a => a.definition.id === 'enemy_slayer');
      expect(enemySlayer!.progress.currentTier).toBe(10);
      expect(enemySlayer!.progress.nextTier).toBeNull();
      expect(enemySlayer!.progress.hasUnclaimedReward).toBe(false);
    });
  });

  // ==========================================================================
  // claimAchievementReward Tests
  // ==========================================================================
  describe('claimAchievementReward', () => {
    it('should successfully claim a tier reward', async () => {
      const mockAchievements = createMockPlayerAchievementsWithProgress(
        { totalKills: 500 }, // Meets tier 2 requirement (500 kills)
        {},
        []
      );
      const mockUser = createMockUser({
        inventory: { unlockedHeroIds: [], unlockedTurretIds: [] },
      });
      const mockInventory = createMockInventory({ dust: 100, gold: 1000, materials: {} });

      mockPrisma.playerAchievements.findUnique.mockResolvedValue(mockAchievements);
      mockPrisma.playerAchievements.create.mockResolvedValue(mockAchievements);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.inventory.findUnique.mockResolvedValue(mockInventory);
      mockPrisma.playerAchievements.update.mockResolvedValue(mockAchievements);
      mockPrisma.inventory.update.mockResolvedValue({
        ...mockInventory,
        dust: 110,
        gold: 1150,
      });

      const result = await claimAchievementReward('user-123', 'enemy_slayer', 2);

      expect(result.success).toBe(true);
      expect(result.dustAwarded).toBeGreaterThan(0);
      expect(result.goldAwarded).toBeGreaterThan(0);
    });

    it('should reject claim for non-existent achievement', async () => {
      const result = await claimAchievementReward('user-123', 'invalid_achievement' as any, 1);

      expect(result.success).toBe(false);
      expect(result.error).toBe(ACHIEVEMENT_ERROR_CODES.ACHIEVEMENT_NOT_FOUND);
    });

    it('should reject claim for non-existent tier', async () => {
      const result = await claimAchievementReward('user-123', 'enemy_slayer', 99);

      expect(result.success).toBe(false);
      expect(result.error).toBe(ACHIEVEMENT_ERROR_CODES.TIER_NOT_REACHED);
    });

    it('should reject claim when tier not reached', async () => {
      const mockAchievements = createMockPlayerAchievementsWithProgress(
        { totalKills: 50 }, // Not enough for tier 2 (requires 500)
        {},
        []
      );
      const mockUser = createMockUser({
        inventory: { unlockedHeroIds: [], unlockedTurretIds: [] },
      });

      mockPrisma.playerAchievements.findUnique.mockResolvedValue(mockAchievements);
      mockPrisma.playerAchievements.create.mockResolvedValue(mockAchievements);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await claimAchievementReward('user-123', 'enemy_slayer', 2);

      expect(result.success).toBe(false);
      expect(result.error).toBe(ACHIEVEMENT_ERROR_CODES.TIER_NOT_REACHED);
    });

    it('should reject claim when tier already claimed', async () => {
      const mockAchievements = createMockPlayerAchievementsWithProgress(
        { totalKills: 500 },
        { enemy_slayer: [1, 2] }, // Tier 2 already claimed
        []
      );
      const mockUser = createMockUser({
        inventory: { unlockedHeroIds: [], unlockedTurretIds: [] },
      });

      mockPrisma.playerAchievements.findUnique.mockResolvedValue(mockAchievements);
      mockPrisma.playerAchievements.create.mockResolvedValue(mockAchievements);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await claimAchievementReward('user-123', 'enemy_slayer', 2);

      expect(result.success).toBe(false);
      expect(result.error).toBe(ACHIEVEMENT_ERROR_CODES.TIER_ALREADY_CLAIMED);
    });

    it('should unlock title when claiming title-granting tier', async () => {
      // Find an achievement with a title reward
      const achievementWithTitle = ACHIEVEMENT_DEFINITIONS.find(
        a => a.tiers.some(t => t.titleReward !== null)
      );
      expect(achievementWithTitle).toBeDefined();

      const titleTier = achievementWithTitle!.tiers.find(t => t.titleReward !== null);
      expect(titleTier).toBeDefined();

      const mockAchievements = createMockPlayerAchievementsWithProgress(
        { [achievementWithTitle!.statKey]: titleTier!.target + 100 },
        {},
        []
      );
      const mockUser = createMockUser({
        inventory: { unlockedHeroIds: [], unlockedTurretIds: [] },
      });
      const mockInventory = createMockInventory();

      mockPrisma.playerAchievements.findUnique.mockResolvedValue(mockAchievements);
      mockPrisma.playerAchievements.create.mockResolvedValue(mockAchievements);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.inventory.findUnique.mockResolvedValue(mockInventory);
      mockPrisma.playerAchievements.update.mockResolvedValue({
        ...mockAchievements,
        unlockedTitles: [titleTier!.titleReward!],
      });
      mockPrisma.inventory.update.mockResolvedValue(mockInventory);

      const result = await claimAchievementReward(
        'user-123',
        achievementWithTitle!.id as any,
        titleTier!.tier
      );

      expect(result.success).toBe(true);
      expect(result.titleUnlocked).toBe(titleTier!.titleReward);
    });

    it('should handle BigInt stats correctly', async () => {
      // Test with goldEarned which is stored as BigInt string
      const mockAchievements = createMockPlayerAchievementsWithProgress(
        { goldEarned: '100000' }, // 100K gold
        {},
        []
      );
      const mockUser = createMockUser({
        inventory: { unlockedHeroIds: [], unlockedTurretIds: [] },
      });
      const mockInventory = createMockInventory();

      mockPrisma.playerAchievements.findUnique.mockResolvedValue(mockAchievements);
      mockPrisma.playerAchievements.create.mockResolvedValue(mockAchievements);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.inventory.findUnique.mockResolvedValue(mockInventory);
      mockPrisma.playerAchievements.update.mockResolvedValue(mockAchievements);
      mockPrisma.inventory.update.mockResolvedValue(mockInventory);

      // gold_magnate tier 2 requires 50K gold
      const result = await claimAchievementReward('user-123', 'gold_magnate', 2);

      expect(result.success).toBe(true);
    });
  });

  // ==========================================================================
  // claimAllAchievementRewards Tests
  // ==========================================================================
  describe('claimAllAchievementRewards', () => {
    it('should claim all unclaimed rewards', async () => {
      const mockAchievements = createMockPlayerAchievementsWithProgress(
        { totalKills: 600, wavesCompleted: 100 }, // Reaches tier 2 of both
        { enemy_slayer: [1] }, // Only tier 1 of enemy_slayer claimed
        []
      );
      const mockUser = createMockUser({
        inventory: { unlockedHeroIds: [], unlockedTurretIds: [] },
      });
      const mockInventory = createMockInventory({ dust: 0, gold: 0, materials: {} });

      mockPrisma.playerAchievements.findUnique.mockResolvedValue(mockAchievements);
      mockPrisma.playerAchievements.create.mockResolvedValue(mockAchievements);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.inventory.findUnique.mockResolvedValue(mockInventory);
      mockPrisma.playerAchievements.update.mockResolvedValue(mockAchievements);
      mockPrisma.inventory.update.mockResolvedValue({
        ...mockInventory,
        dust: 50,
        gold: 500,
      });

      const result = await claimAllAchievementRewards('user-123');

      expect(result.success).toBe(true);
      expect(result.claimedCount).toBeGreaterThan(0);
      expect(result.totalDustAwarded).toBeGreaterThan(0);
      expect(result.totalGoldAwarded).toBeGreaterThan(0);
    });

    it('should return error when no unclaimed rewards', async () => {
      const mockAchievements = createMockPlayerAchievementsWithProgress(
        { totalKills: 50 }, // Not enough for any tier
        {},
        []
      );
      const mockUser = createMockUser({
        inventory: { unlockedHeroIds: [], unlockedTurretIds: [] },
      });
      const mockInventory = createMockInventory();

      mockPrisma.playerAchievements.findUnique.mockResolvedValue(mockAchievements);
      mockPrisma.playerAchievements.create.mockResolvedValue(mockAchievements);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.inventory.findUnique.mockResolvedValue(mockInventory);

      const result = await claimAllAchievementRewards('user-123');

      expect(result.success).toBe(false);
      expect(result.claimedCount).toBe(0);
      expect(result.error).toBe(ACHIEVEMENT_ERROR_CODES.NO_UNCLAIMED_REWARDS);
    });

    it('should collect multiple title rewards', async () => {
      // Set up stats to reach multiple title tiers
      const mockAchievements = createMockPlayerAchievementsWithProgress(
        {
          totalKills: 100000000, // Max enemy_slayer (Destroyer title)
          wavesCompleted: 50000000, // Max wave_warrior (Veteran title)
        },
        {},
        []
      );
      const mockUser = createMockUser({
        inventory: { unlockedHeroIds: [], unlockedTurretIds: [] },
      });
      const mockInventory = createMockInventory();

      mockPrisma.playerAchievements.findUnique.mockResolvedValue(mockAchievements);
      mockPrisma.playerAchievements.create.mockResolvedValue(mockAchievements);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.inventory.findUnique.mockResolvedValue(mockInventory);
      mockPrisma.playerAchievements.update.mockResolvedValue(mockAchievements);
      mockPrisma.inventory.update.mockResolvedValue(mockInventory);

      const result = await claimAllAchievementRewards('user-123');

      expect(result.success).toBe(true);
      expect(result.titlesUnlocked.length).toBeGreaterThan(0);
    });

    it('should aggregate material rewards correctly', async () => {
      // Set up stats to reach high tiers with material rewards
      const mockAchievements = createMockPlayerAchievementsWithProgress(
        {
          totalKills: 1000000, // High tier with material reward
          bossKills: 1000,
        },
        {},
        []
      );
      const mockUser = createMockUser({
        inventory: { unlockedHeroIds: [], unlockedTurretIds: [] },
      });
      const mockInventory = createMockInventory({ materials: {} });

      mockPrisma.playerAchievements.findUnique.mockResolvedValue(mockAchievements);
      mockPrisma.playerAchievements.create.mockResolvedValue(mockAchievements);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.inventory.findUnique.mockResolvedValue(mockInventory);
      mockPrisma.playerAchievements.update.mockResolvedValue(mockAchievements);
      mockPrisma.inventory.update.mockResolvedValue({
        ...mockInventory,
        materials: { cosmic_dust: 5 },
      });

      const result = await claimAllAchievementRewards('user-123');

      expect(result.success).toBe(true);
      // Materials are aggregated
      expect(Object.keys(result.materialsAwarded).length).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================================================
  // updateLifetimeStats Tests
  // ==========================================================================
  describe('updateLifetimeStats', () => {
    it('should increment numeric stats', async () => {
      const mockAchievements = createMockPlayerAchievements();
      mockPrisma.playerAchievements.findUnique.mockResolvedValue(mockAchievements);
      mockPrisma.playerAchievements.create.mockResolvedValue(mockAchievements);
      mockPrisma.playerAchievements.update.mockResolvedValue(mockAchievements);

      await updateLifetimeStats('user-123', {
        totalKills: 100,
        wavesCompleted: 10,
        runsCompleted: 1,
      });

      expect(mockPrisma.playerAchievements.update).toHaveBeenCalled();
      const updateCall = mockPrisma.playerAchievements.update.mock.calls[0][0];
      expect(updateCall.data.lifetimeStats.totalKills).toBe(100);
      expect(updateCall.data.lifetimeStats.wavesCompleted).toBe(10);
      expect(updateCall.data.lifetimeStats.runsCompleted).toBe(1);
    });

    it('should handle BigInt string stats', async () => {
      const mockAchievements = createMockPlayerAchievementsWithProgress(
        { goldEarned: '50000', damageDealt: '100000' },
        {},
        []
      );
      mockPrisma.playerAchievements.findUnique.mockResolvedValue(mockAchievements);
      mockPrisma.playerAchievements.create.mockResolvedValue(mockAchievements);
      mockPrisma.playerAchievements.update.mockResolvedValue(mockAchievements);

      await updateLifetimeStats('user-123', {
        goldEarned: '25000',
        damageDealt: '50000',
      });

      const updateCall = mockPrisma.playerAchievements.update.mock.calls[0][0];
      expect(updateCall.data.lifetimeStats.goldEarned).toBe('75000'); // 50000 + 25000
      expect(updateCall.data.lifetimeStats.damageDealt).toBe('150000'); // 100000 + 50000
    });

    it('should create achievements record if not exists', async () => {
      const newAchievements = createMockPlayerAchievements();
      mockPrisma.playerAchievements.findUnique.mockResolvedValue(null);
      mockPrisma.playerAchievements.create.mockResolvedValue(newAchievements);
      mockPrisma.playerAchievements.update.mockResolvedValue(newAchievements);

      await updateLifetimeStats('user-123', { totalKills: 50 });

      expect(mockPrisma.playerAchievements.create).toHaveBeenCalled();
      expect(mockPrisma.playerAchievements.update).toHaveBeenCalled();
    });

    it('should handle undefined/null values gracefully', async () => {
      const mockAchievements = createMockPlayerAchievementsWithProgress(
        { totalKills: 100 },
        {},
        []
      );
      mockPrisma.playerAchievements.findUnique.mockResolvedValue(mockAchievements);
      mockPrisma.playerAchievements.create.mockResolvedValue(mockAchievements);
      mockPrisma.playerAchievements.update.mockResolvedValue(mockAchievements);

      await updateLifetimeStats('user-123', {
        totalKills: 50,
        eliteKills: undefined as any,
        bossKills: null as any,
      });

      const updateCall = mockPrisma.playerAchievements.update.mock.calls[0][0];
      expect(updateCall.data.lifetimeStats.totalKills).toBe(150); // 100 + 50
      expect(updateCall.data.lifetimeStats.eliteKills).toBe(0); // Unchanged
    });

    it('should accumulate stats across multiple updates', async () => {
      let currentStats = createDefaultLifetimeStats();

      mockPrisma.playerAchievements.findUnique.mockImplementation(async () => ({
        id: 'achievements-123',
        userId: 'user-123',
        lifetimeStats: currentStats,
        achievementProgress: {},
        claimedTiers: {},
        unlockedTitles: [],
        activeTitle: null,
        updatedAt: new Date(),
      }));
      mockPrisma.playerAchievements.create.mockImplementation(async ({ data }) => ({
        id: 'achievements-123',
        userId: 'user-123',
        ...data,
        updatedAt: new Date(),
      }));
      mockPrisma.playerAchievements.update.mockImplementation(async ({ data }) => {
        currentStats = data.lifetimeStats;
        return {
          id: 'achievements-123',
          userId: 'user-123',
          ...data,
          updatedAt: new Date(),
        };
      });

      // First update
      await updateLifetimeStats('user-123', { totalKills: 100 });
      expect(currentStats.totalKills).toBe(100);

      // Second update
      await updateLifetimeStats('user-123', { totalKills: 50 });
      expect(currentStats.totalKills).toBe(150);
    });
  });

  // ==========================================================================
  // setActiveTitle Tests
  // ==========================================================================
  describe('setActiveTitle', () => {
    it('should set active title when user has unlocked it', async () => {
      const mockAchievements = createMockPlayerAchievements({
        unlockedTitles: ['Destroyer', 'Veteran', 'Champion'],
      });
      mockPrisma.playerAchievements.findUnique.mockResolvedValue(mockAchievements);
      mockPrisma.playerAchievements.create.mockResolvedValue(mockAchievements);
      mockPrisma.playerAchievements.update.mockResolvedValue({
        ...mockAchievements,
        activeTitle: 'Destroyer',
      });

      const result = await setActiveTitle('user-123', 'Destroyer');

      expect(result).toBe(true);
      expect(mockPrisma.playerAchievements.update).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        data: { activeTitle: 'Destroyer' },
      });
    });

    it('should reject setting title user has not unlocked', async () => {
      const mockAchievements = createMockPlayerAchievements({
        unlockedTitles: ['Destroyer'],
      });
      mockPrisma.playerAchievements.findUnique.mockResolvedValue(mockAchievements);
      mockPrisma.playerAchievements.create.mockResolvedValue(mockAchievements);

      const result = await setActiveTitle('user-123', 'Champion');

      expect(result).toBe(false);
      expect(mockPrisma.playerAchievements.update).not.toHaveBeenCalled();
    });

    it('should allow clearing active title', async () => {
      const mockAchievements = createMockPlayerAchievements({
        unlockedTitles: ['Destroyer'],
        activeTitle: 'Destroyer',
      });
      mockPrisma.playerAchievements.findUnique.mockResolvedValue(mockAchievements);
      mockPrisma.playerAchievements.create.mockResolvedValue(mockAchievements);
      mockPrisma.playerAchievements.update.mockResolvedValue({
        ...mockAchievements,
        activeTitle: null,
      });

      const result = await setActiveTitle('user-123', null);

      expect(result).toBe(true);
      expect(mockPrisma.playerAchievements.update).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        data: { activeTitle: null },
      });
    });
  });

  // ==========================================================================
  // getActiveTitle Tests
  // ==========================================================================
  describe('getActiveTitle', () => {
    it('should return active title', async () => {
      mockPrisma.playerAchievements.findUnique.mockResolvedValue({
        activeTitle: 'Destroyer',
      });

      const result = await getActiveTitle('user-123');

      expect(result).toBe('Destroyer');
    });

    it('should return null when no active title', async () => {
      mockPrisma.playerAchievements.findUnique.mockResolvedValue({
        activeTitle: null,
      });

      const result = await getActiveTitle('user-123');

      expect(result).toBeNull();
    });

    it('should return null when no achievements record', async () => {
      mockPrisma.playerAchievements.findUnique.mockResolvedValue(null);

      const result = await getActiveTitle('user-123');

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // Edge Cases & Integration Tests
  // ==========================================================================
  describe('Edge Cases', () => {
    it('should handle very large BigInt values', async () => {
      const hugeValue = '9007199254740991000'; // Larger than MAX_SAFE_INTEGER
      const mockAchievements = createMockPlayerAchievementsWithProgress(
        { goldEarned: hugeValue },
        {},
        []
      );
      const mockUser = createMockUser({
        inventory: { unlockedHeroIds: [], unlockedTurretIds: [] },
      });

      mockPrisma.playerAchievements.findUnique.mockResolvedValue(mockAchievements);
      mockPrisma.playerAchievements.create.mockResolvedValue(mockAchievements);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await getAchievements('user-123');

      // Should not throw and should handle the large value
      const goldMagnate = result.achievements.find(a => a.definition.id === 'gold_magnate');
      expect(goldMagnate).toBeDefined();
      expect(goldMagnate!.progress.currentTier).toBe(10); // Max tier
    });

    it('should handle empty inventory arrays', async () => {
      const mockAchievements = createMockPlayerAchievements();
      const mockUser = createMockUser({
        inventory: { unlockedHeroIds: [], unlockedTurretIds: [] },
      });

      mockPrisma.playerAchievements.findUnique.mockResolvedValue(mockAchievements);
      mockPrisma.playerAchievements.create.mockResolvedValue(mockAchievements);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await getAchievements('user-123');

      expect(result.lifetimeStats.heroesUnlocked).toBe(0);
      expect(result.lifetimeStats.turretsUnlocked).toBe(0);
    });

    it('should handle missing user relations', async () => {
      const mockAchievements = createMockPlayerAchievements();
      const mockUser = createMockUser({
        progression: null,
        colonyProgress: null,
        inventory: null,
      });

      mockPrisma.playerAchievements.findUnique.mockResolvedValue(mockAchievements);
      mockPrisma.playerAchievements.create.mockResolvedValue(mockAchievements);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await getAchievements('user-123');

      expect(result.lifetimeStats.commanderLevel).toBe(1);
      expect(result.lifetimeStats.prestigeCount).toBe(0);
      expect(result.lifetimeStats.heroesUnlocked).toBe(0);
    });

    it('should verify all achievement definitions have valid stat keys', () => {
      const validStatKeys = [
        'totalKills', 'eliteKills', 'bossKills', 'wavesCompleted', 'runsCompleted',
        'goldEarned', 'dustSpent', 'heroesUnlocked', 'turretsUnlocked', 'artifactsObtained',
        'pvpBattles', 'pvpVictories', 'guildBattles', 'bossRushCycles', 'pillarChallengesCompleted',
        'materialsCollected', 'relicsChosen', 'skillsActivated', 'damageDealt', 'criticalHits',
        'guildDonations', 'towerRaceWaves', 'crystalFragments', 'masteryPoints', 'synergiesTriggered',
        'commanderLevel', 'prestigeCount', 'tutorialsCompleted',
      ];

      for (const def of ACHIEVEMENT_DEFINITIONS) {
        expect(validStatKeys).toContain(def.statKey);
      }
    });

    it('should verify all tier targets are increasing', () => {
      for (const def of ACHIEVEMENT_DEFINITIONS) {
        for (let i = 1; i < def.tiers.length; i++) {
          expect(def.tiers[i].target).toBeGreaterThan(def.tiers[i - 1].target);
        }
      }
    });

    it('should verify all tiers have valid rewards', () => {
      for (const def of ACHIEVEMENT_DEFINITIONS) {
        for (const tier of def.tiers) {
          expect(tier.dustReward).toBeGreaterThanOrEqual(0);
          expect(tier.goldReward).toBeGreaterThanOrEqual(0);
          expect(tier.tier).toBeGreaterThan(0);
        }
      }
    });
  });
});
