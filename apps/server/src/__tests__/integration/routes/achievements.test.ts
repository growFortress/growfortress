/**
 * Integration tests for achievements routes
 * Tests the permanent achievement system API endpoints.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildTestApp, generateTestToken } from '../../helpers/testApp.js';
import {
  mockPrisma,
  createMockUser,
  createMockInventory,
  createMockPlayerAchievements,
  createMockPlayerAchievementsWithProgress,
} from '../../mocks/prisma.js';

// Import test setup (mocks prisma, redis, config)
import '../../helpers/setup.js';

import {
  ACHIEVEMENT_DEFINITIONS,
  ACHIEVEMENT_ERROR_CODES,
} from '@arcade/protocol';

describe('Achievements Routes', () => {
  let app: FastifyInstance;
  let authToken: string;

  beforeEach(async () => {
    app = await buildTestApp();
    authToken = await generateTestToken('user-123');
  });

  afterEach(async () => {
    await app.close();
  });

  // ==========================================================================
  // GET /v1/achievements
  // ==========================================================================
  describe('GET /v1/achievements', () => {
    it('should return 401 without auth token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/achievements',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return achievements for authenticated user', async () => {
      const mockAchievements = createMockPlayerAchievements();
      const mockUser = createMockUser({
        inventory: { unlockedHeroIds: [], unlockedTurretIds: [] },
      });

      mockPrisma.playerAchievements.findUnique.mockResolvedValue(mockAchievements);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/achievements',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.achievements).toBeDefined();
      expect(body.achievements).toHaveLength(ACHIEVEMENT_DEFINITIONS.length);
      expect(body.lifetimeStats).toBeDefined();
      expect(body.categoryProgress).toBeDefined();
      expect(body.unlockedTitles).toBeDefined();
      expect(body.totalUnclaimedRewards).toBeDefined();
    });

    it('should create achievements record for new user', async () => {
      const mockUser = createMockUser({
        inventory: { unlockedHeroIds: [], unlockedTurretIds: [] },
      });
      const newAchievements = createMockPlayerAchievements();

      mockPrisma.playerAchievements.findUnique.mockResolvedValue(null);
      mockPrisma.playerAchievements.create.mockResolvedValue(newAchievements);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/achievements',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockPrisma.playerAchievements.create).toHaveBeenCalled();
    });

    it('should return correct progress for achievements', async () => {
      const mockAchievements = createMockPlayerAchievementsWithProgress(
        { totalKills: 600, wavesCompleted: 75 },
        { enemy_slayer: [1] },
        []
      );
      const mockUser = createMockUser({
        totalWaves: 100,
        inventory: { unlockedHeroIds: ['vanguard', 'medic'], unlockedTurretIds: ['railgun'] },
      });

      mockPrisma.playerAchievements.findUnique.mockResolvedValue(mockAchievements);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/achievements',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      // Find enemy_slayer achievement
      const enemySlayer = body.achievements.find((a: any) => a.definition.id === 'enemy_slayer');
      expect(enemySlayer).toBeDefined();
      expect(enemySlayer.progress.currentProgress).toBe(600);
      expect(enemySlayer.progress.claimedTiers).toContain(1);
      expect(enemySlayer.progress.hasUnclaimedReward).toBe(true); // Tier 2 (500) reached but unclaimed
    });

    it('should return category progress counts', async () => {
      const mockAchievements = createMockPlayerAchievementsWithProgress(
        { totalKills: 1000, eliteKills: 100 },
        { enemy_slayer: [1, 2], elite_hunter: [1] },
        []
      );
      const mockUser = createMockUser({
        inventory: { unlockedHeroIds: [], unlockedTurretIds: [] },
      });

      mockPrisma.playerAchievements.findUnique.mockResolvedValue(mockAchievements);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/achievements',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      expect(body.categoryProgress.combat).toBeDefined();
      expect(body.categoryProgress.combat.completed).toBe(3); // 2 enemy_slayer + 1 elite_hunter
      expect(body.categoryProgress.combat.total).toBeGreaterThan(0);
    });

    it('should return unlocked titles', async () => {
      const mockAchievements = createMockPlayerAchievements({
        unlockedTitles: ['Destroyer', 'Champion'],
        activeTitle: 'Destroyer',
      });
      const mockUser = createMockUser({
        inventory: { unlockedHeroIds: [], unlockedTurretIds: [] },
      });

      mockPrisma.playerAchievements.findUnique.mockResolvedValue(mockAchievements);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/achievements',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.unlockedTitles).toContain('Destroyer');
      expect(body.unlockedTitles).toContain('Champion');
      expect(body.activeTitle).toBe('Destroyer');
    });
  });

  // ==========================================================================
  // POST /v1/achievements/:id/claim/:tier
  // ==========================================================================
  describe('POST /v1/achievements/:id/claim/:tier', () => {
    it('should return 401 without auth token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/achievements/enemy_slayer/claim/1',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 400 for invalid achievement ID', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/achievements/invalid_achievement/claim/1',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toBe(ACHIEVEMENT_ERROR_CODES.ACHIEVEMENT_NOT_FOUND);
    });

    it('should return 400 for invalid tier number', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/achievements/enemy_slayer/claim/invalid',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for negative tier number', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/achievements/enemy_slayer/claim/-1',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for zero tier number', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/achievements/enemy_slayer/claim/0',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should successfully claim a tier reward', async () => {
      const mockAchievements = createMockPlayerAchievementsWithProgress(
        { totalKills: 150 }, // Meets tier 1 (100 kills)
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
      mockPrisma.playerAchievements.update.mockResolvedValue({
        ...mockAchievements,
        claimedTiers: { enemy_slayer: [1] },
      });
      mockPrisma.inventory.update.mockResolvedValue({
        ...mockInventory,
        dust: 105,
        gold: 1100,
      });
      mockPrisma.battlePassSeason.findFirst.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/achievements/enemy_slayer/claim/1',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.dustAwarded).toBeGreaterThan(0);
      expect(body.goldAwarded).toBeGreaterThan(0);
      expect(body.newInventory).toBeDefined();
    });

    it('should return 400 when tier not reached', async () => {
      const mockAchievements = createMockPlayerAchievementsWithProgress(
        { totalKills: 50 }, // Not enough for tier 1 (100)
        {},
        []
      );
      const mockUser = createMockUser({
        inventory: { unlockedHeroIds: [], unlockedTurretIds: [] },
      });

      mockPrisma.playerAchievements.findUnique.mockResolvedValue(mockAchievements);
      mockPrisma.playerAchievements.create.mockResolvedValue(mockAchievements);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/achievements/enemy_slayer/claim/1',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe(ACHIEVEMENT_ERROR_CODES.TIER_NOT_REACHED);
    });

    it('should return 400 when tier already claimed', async () => {
      const mockAchievements = createMockPlayerAchievementsWithProgress(
        { totalKills: 150 },
        { enemy_slayer: [1] }, // Already claimed
        []
      );
      const mockUser = createMockUser({
        inventory: { unlockedHeroIds: [], unlockedTurretIds: [] },
      });

      mockPrisma.playerAchievements.findUnique.mockResolvedValue(mockAchievements);
      mockPrisma.playerAchievements.create.mockResolvedValue(mockAchievements);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/achievements/enemy_slayer/claim/1',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe(ACHIEVEMENT_ERROR_CODES.TIER_ALREADY_CLAIMED);
    });

    it('should unlock title when claiming title tier', async () => {
      // Find an achievement with a title in tier 10 (enemy_slayer has "Destroyer")
      const mockAchievements = createMockPlayerAchievementsWithProgress(
        { totalKills: 100000001 }, // More than tier 10 target
        { enemy_slayer: [1, 2, 3, 4, 5, 6, 7, 8, 9] }, // All but 10 claimed
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
        claimedTiers: { enemy_slayer: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
        unlockedTitles: ['Destroyer'],
      });
      mockPrisma.inventory.update.mockResolvedValue(mockInventory);
      mockPrisma.battlePassSeason.findFirst.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/achievements/enemy_slayer/claim/10',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.titleUnlocked).toBe('Destroyer');
    });
  });

  // ==========================================================================
  // POST /v1/achievements/claim-all
  // ==========================================================================
  describe('POST /v1/achievements/claim-all', () => {
    it('should return 401 without auth token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/achievements/claim-all',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should claim all unclaimed rewards', async () => {
      const mockAchievements = createMockPlayerAchievementsWithProgress(
        { totalKills: 600, wavesCompleted: 100 },
        {},
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
      mockPrisma.battlePassSeason.findFirst.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/achievements/claim-all',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.claimedCount).toBeGreaterThan(0);
      expect(body.totalDustAwarded).toBeGreaterThan(0);
      expect(body.totalGoldAwarded).toBeGreaterThan(0);
      expect(body.newInventory).toBeDefined();
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

      const response = await app.inject({
        method: 'POST',
        url: '/v1/achievements/claim-all',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200); // Still 200 but success: false
      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.claimedCount).toBe(0);
      expect(body.error).toBe(ACHIEVEMENT_ERROR_CODES.NO_UNCLAIMED_REWARDS);
    });

    it('should collect multiple titles when claiming all', async () => {
      const mockAchievements = createMockPlayerAchievementsWithProgress(
        {
          totalKills: 100000001, // Max enemy_slayer
          wavesCompleted: 50000001, // Max wave_warrior
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
      mockPrisma.playerAchievements.update.mockResolvedValue({
        ...mockAchievements,
        unlockedTitles: ['Destroyer', 'Veteran'],
      });
      mockPrisma.inventory.update.mockResolvedValue(mockInventory);
      mockPrisma.battlePassSeason.findFirst.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/achievements/claim-all',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.titlesUnlocked.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // POST /v1/achievements/title
  // ==========================================================================
  describe('POST /v1/achievements/title', () => {
    it('should return 401 without auth token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/achievements/title',
        payload: { title: 'Destroyer' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 400 with invalid request body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/achievements/title',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: { title: 123 }, // Invalid type
      });

      expect(response.statusCode).toBe(400);
    });

    it('should set active title when user has unlocked it', async () => {
      const mockAchievements = createMockPlayerAchievements({
        unlockedTitles: ['Destroyer', 'Champion'],
        activeTitle: null,
      });

      mockPrisma.playerAchievements.findUnique.mockResolvedValue(mockAchievements);
      mockPrisma.playerAchievements.create.mockResolvedValue(mockAchievements);
      mockPrisma.playerAchievements.update.mockResolvedValue({
        ...mockAchievements,
        activeTitle: 'Destroyer',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/v1/achievements/title',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: { title: 'Destroyer' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.activeTitle).toBe('Destroyer');
    });

    it('should return 400 when title not unlocked', async () => {
      const mockAchievements = createMockPlayerAchievements({
        unlockedTitles: ['Destroyer'],
        activeTitle: null,
      });

      mockPrisma.playerAchievements.findUnique.mockResolvedValue(mockAchievements);
      mockPrisma.playerAchievements.create.mockResolvedValue(mockAchievements);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/achievements/title',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: { title: 'Champion' }, // Not unlocked
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe(ACHIEVEMENT_ERROR_CODES.TITLE_NOT_UNLOCKED);
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

      const response = await app.inject({
        method: 'POST',
        url: '/v1/achievements/title',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: { title: null },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.activeTitle).toBeNull();
    });

    it('should change active title', async () => {
      const mockAchievements = createMockPlayerAchievements({
        unlockedTitles: ['Destroyer', 'Champion', 'Veteran'],
        activeTitle: 'Destroyer',
      });

      mockPrisma.playerAchievements.findUnique.mockResolvedValue(mockAchievements);
      mockPrisma.playerAchievements.create.mockResolvedValue(mockAchievements);
      mockPrisma.playerAchievements.update.mockResolvedValue({
        ...mockAchievements,
        activeTitle: 'Champion',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/v1/achievements/title',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: { title: 'Champion' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.activeTitle).toBe('Champion');
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================
  describe('Edge Cases', () => {
    it('should handle claiming rewards when user has no inventory', async () => {
      const mockAchievements = createMockPlayerAchievementsWithProgress(
        { totalKills: 150 },
        {},
        []
      );
      const mockUser = createMockUser({
        inventory: null,
      });

      mockPrisma.playerAchievements.findUnique.mockResolvedValue(mockAchievements);
      mockPrisma.playerAchievements.create.mockResolvedValue(mockAchievements);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.inventory.findUnique.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/achievements/enemy_slayer/claim/1',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      // Should handle gracefully (might error but shouldn't crash)
      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });

    it('should handle very high tier numbers', async () => {
      // Tier 999 doesn't exist for enemy_slayer, should return error
      const mockAchievements = createMockPlayerAchievementsWithProgress(
        { totalKills: Number.MAX_SAFE_INTEGER },
        {},
        []
      );
      const mockUser = createMockUser({
        inventory: { unlockedHeroIds: [], unlockedTurretIds: [] },
      });

      mockPrisma.playerAchievements.findUnique.mockResolvedValue(mockAchievements);
      mockPrisma.playerAchievements.create.mockResolvedValue(mockAchievements);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/achievements/enemy_slayer/claim/999',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      // Tier 999 doesn't exist, should return 400 with TIER_NOT_REACHED error
      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.success).toBe(false);
    });

    it('should handle invalid tier format gracefully', async () => {
      // Using a non-numeric tier value (encoded)
      const response = await app.inject({
        method: 'POST',
        url: '/v1/achievements/enemy_slayer/claim/abc',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      // Should return 400 for invalid tier format
      expect(response.statusCode).toBe(400);
    });

    it('should handle requests after achievements are claimed', async () => {
      // First, set up a scenario where achievement is already claimed
      const mockAchievements = createMockPlayerAchievementsWithProgress(
        { totalKills: 150 },
        { enemy_slayer: [1] }, // Tier 1 already claimed
        []
      );
      const mockUser = createMockUser({
        inventory: { unlockedHeroIds: [], unlockedTurretIds: [] },
      });

      mockPrisma.playerAchievements.findUnique.mockResolvedValue(mockAchievements);
      mockPrisma.playerAchievements.create.mockResolvedValue(mockAchievements);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      // Try to claim the same tier again
      const response = await app.inject({
        method: 'POST',
        url: '/v1/achievements/enemy_slayer/claim/1',
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe(ACHIEVEMENT_ERROR_CODES.TIER_ALREADY_CLAIMED);
    });
  });
});
