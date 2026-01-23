/**
 * Guild Battle Trophies service tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockPrisma, resetPrismaMock, createMockGuild } from '../../mocks/prisma.js';
import '../../helpers/setup.js';
import {
  getOrCreateStreak,
  updateBattleStreak,
  getStreakData,
  getGuildTotalWins,
  checkAndAwardTrophies,
  calculateBattleRewards,
  getGuildTrophies,
  getTrophyStatBonus,
  type BattleOutcome,
} from '../../../services/guildBattleTrophies.js';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function createMockStreak(overrides: Record<string, unknown> = {}) {
  return {
    id: 'streak-123',
    guildId: 'guild-123',
    currentWinStreak: 0,
    currentLossStreak: 0,
    bestWinStreak: 0,
    bestLossStreak: 0,
    rivalryStats: {},
    ...overrides,
  };
}

function createMockTrophy(overrides: Record<string, unknown> = {}) {
  return {
    id: 'trophy-123',
    guildId: 'guild-123',
    trophyId: 'FIRST_BLOOD',
    progress: 1,
    tier: 1,
    maxTier: 1,
    isActive: true,
    earnedAt: new Date(),
    upgradedAt: null,
    ...overrides,
  };
}

function createBattleOutcome(overrides: Partial<BattleOutcome> = {}): BattleOutcome {
  return {
    guildId: 'guild-123',
    opponentGuildId: 'guild-456',
    opponentHonor: 1000,
    guildHonor: 1000,
    won: true,
    survivors: 3,
    totalHeroes: 5,
    heroesLost: 2,
    ...overrides,
  };
}

describe('Guild Battle Trophies Service', () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  // ============================================================================
  // GET OR CREATE STREAK
  // ============================================================================

  describe('getOrCreateStreak', () => {
    it('returns existing streak if found', async () => {
      const existingStreak = createMockStreak({ currentWinStreak: 5 });
      mockPrisma.guildBattleStreak.findUnique.mockResolvedValue(existingStreak);

      const result = await getOrCreateStreak('guild-123');

      expect(result.currentWinStreak).toBe(5);
      expect(mockPrisma.guildBattleStreak.create).not.toHaveBeenCalled();
    });

    it('creates new streak if none exists', async () => {
      mockPrisma.guildBattleStreak.findUnique.mockResolvedValue(null);
      const newStreak = createMockStreak();
      mockPrisma.guildBattleStreak.create.mockResolvedValue(newStreak);

      const result = await getOrCreateStreak('guild-123');

      expect(mockPrisma.guildBattleStreak.create).toHaveBeenCalledWith({
        data: {
          guildId: 'guild-123',
          currentWinStreak: 0,
          currentLossStreak: 0,
          bestWinStreak: 0,
          bestLossStreak: 0,
          rivalryStats: {},
        },
      });
      expect(result.guildId).toBe('guild-123');
    });
  });

  // ============================================================================
  // UPDATE BATTLE STREAK
  // ============================================================================

  describe('updateBattleStreak', () => {
    it('increments win streak on win', async () => {
      const streak = createMockStreak({ currentWinStreak: 2, currentLossStreak: 0 });
      mockPrisma.guildBattleStreak.findUnique.mockResolvedValue(streak);
      mockPrisma.guildBattleStreak.update.mockResolvedValue({
        ...streak,
        currentWinStreak: 3,
      });

      const result = await updateBattleStreak('guild-123', 'guild-456', true);

      expect(mockPrisma.guildBattleStreak.update).toHaveBeenCalledWith({
        where: { guildId: 'guild-123' },
        data: expect.objectContaining({
          currentWinStreak: 3,
          currentLossStreak: 0,
        }),
      });
      expect(result.currentWinStreak).toBe(3);
    });

    it('resets win streak and increments loss streak on loss', async () => {
      const streak = createMockStreak({ currentWinStreak: 5, currentLossStreak: 0 });
      mockPrisma.guildBattleStreak.findUnique.mockResolvedValue(streak);
      mockPrisma.guildBattleStreak.update.mockResolvedValue({
        ...streak,
        currentWinStreak: 0,
        currentLossStreak: 1,
      });

      await updateBattleStreak('guild-123', 'guild-456', false);

      expect(mockPrisma.guildBattleStreak.update).toHaveBeenCalledWith({
        where: { guildId: 'guild-123' },
        data: expect.objectContaining({
          currentWinStreak: 0,
          currentLossStreak: 1,
        }),
      });
    });

    it('updates best win streak when current exceeds best', async () => {
      const streak = createMockStreak({
        currentWinStreak: 4,
        bestWinStreak: 4,
      });
      mockPrisma.guildBattleStreak.findUnique.mockResolvedValue(streak);
      mockPrisma.guildBattleStreak.update.mockResolvedValue({
        ...streak,
        currentWinStreak: 5,
        bestWinStreak: 5,
      });

      await updateBattleStreak('guild-123', 'guild-456', true);

      expect(mockPrisma.guildBattleStreak.update).toHaveBeenCalledWith({
        where: { guildId: 'guild-123' },
        data: expect.objectContaining({
          currentWinStreak: 5,
          bestWinStreak: 5,
        }),
      });
    });

    it('tracks rivalry stats for opponent', async () => {
      const streak = createMockStreak({
        rivalryStats: { 'guild-456': { wins: 2, losses: 1 } },
      });
      mockPrisma.guildBattleStreak.findUnique.mockResolvedValue(streak);
      mockPrisma.guildBattleStreak.update.mockResolvedValue(streak);

      await updateBattleStreak('guild-123', 'guild-456', true);

      expect(mockPrisma.guildBattleStreak.update).toHaveBeenCalledWith({
        where: { guildId: 'guild-123' },
        data: expect.objectContaining({
          rivalryStats: { 'guild-456': { wins: 3, losses: 1 } },
        }),
      });
    });

    it('creates new rivalry entry for new opponent', async () => {
      const streak = createMockStreak({ rivalryStats: {} });
      mockPrisma.guildBattleStreak.findUnique.mockResolvedValue(streak);
      mockPrisma.guildBattleStreak.update.mockResolvedValue(streak);

      await updateBattleStreak('guild-123', 'guild-new', true);

      expect(mockPrisma.guildBattleStreak.update).toHaveBeenCalledWith({
        where: { guildId: 'guild-123' },
        data: expect.objectContaining({
          rivalryStats: { 'guild-new': { wins: 1, losses: 0 } },
        }),
      });
    });
  });

  // ============================================================================
  // GET STREAK DATA
  // ============================================================================

  describe('getStreakData', () => {
    it('returns streak data for guild', async () => {
      const streak = createMockStreak({
        currentWinStreak: 3,
        currentLossStreak: 0,
        bestWinStreak: 7,
        bestLossStreak: 2,
      });
      mockPrisma.guildBattleStreak.findUnique.mockResolvedValue(streak);

      const result = await getStreakData('guild-123');

      expect(result.currentWinStreak).toBe(3);
      expect(result.currentLossStreak).toBe(0);
      expect(result.bestWinStreak).toBe(7);
      expect(result.bestLossStreak).toBe(2);
    });
  });

  // ============================================================================
  // GET GUILD TOTAL WINS
  // ============================================================================

  describe('getGuildTotalWins', () => {
    it('returns count of won battles', async () => {
      mockPrisma.guildBattle.count.mockResolvedValue(25);

      const result = await getGuildTotalWins('guild-123');

      expect(result).toBe(25);
      expect(mockPrisma.guildBattle.count).toHaveBeenCalledWith({
        where: { winnerGuildId: 'guild-123' },
      });
    });
  });

  // ============================================================================
  // CHECK AND AWARD TROPHIES
  // ============================================================================

  describe('checkAndAwardTrophies', () => {
    it('returns empty array for losses', async () => {
      const outcome = createBattleOutcome({ won: false });

      const result = await checkAndAwardTrophies(outcome);

      expect(result).toHaveLength(0);
    });

    it('awards FIRST_BLOOD trophy on first win', async () => {
      mockPrisma.guildBattle.count.mockResolvedValue(1);
      mockPrisma.guildBattleStreak.findUnique.mockResolvedValue(createMockStreak());
      mockPrisma.guildBattleTrophy.findMany.mockResolvedValue([]);
      mockPrisma.guildBattleTrophy.upsert.mockResolvedValue(createMockTrophy());

      const outcome = createBattleOutcome();
      const result = await checkAndAwardTrophies(outcome);

      expect(result).toContain('FIRST_BLOOD');
    });

    it('awards streak trophy when streak requirement met', async () => {
      mockPrisma.guildBattle.count.mockResolvedValue(5);
      mockPrisma.guildBattleStreak.findUnique.mockResolvedValue(
        createMockStreak({ currentWinStreak: 2 }) // Will be 3 after this win
      );
      mockPrisma.guildBattleTrophy.findMany.mockResolvedValue([
        createMockTrophy({ trophyId: 'FIRST_BLOOD' }),
      ]);
      mockPrisma.guildBattleTrophy.upsert.mockResolvedValue(createMockTrophy());

      const outcome = createBattleOutcome();
      const result = await checkAndAwardTrophies(outcome);

      expect(result).toContain('HOT_STREAK');
    });

    it('awards DOMINATION trophy when all 5 heroes survive', async () => {
      mockPrisma.guildBattle.count.mockResolvedValue(10);
      mockPrisma.guildBattleStreak.findUnique.mockResolvedValue(createMockStreak());
      mockPrisma.guildBattleTrophy.findMany.mockResolvedValue([
        createMockTrophy({ trophyId: 'FIRST_BLOOD' }),
        createMockTrophy({ trophyId: 'BATTLE_HARDENED' }),
      ]);
      mockPrisma.guildBattleTrophy.upsert.mockResolvedValue(createMockTrophy());

      const outcome = createBattleOutcome({ survivors: 5, heroesLost: 0 });
      const result = await checkAndAwardTrophies(outcome);

      expect(result).toContain('DOMINATION');
    });

    it('awards COMEBACK_KINGS trophy when winning after losing 3+ heroes', async () => {
      mockPrisma.guildBattle.count.mockResolvedValue(10);
      mockPrisma.guildBattleStreak.findUnique.mockResolvedValue(createMockStreak());
      mockPrisma.guildBattleTrophy.findMany.mockResolvedValue([]);
      mockPrisma.guildBattleTrophy.upsert.mockResolvedValue(createMockTrophy());

      const outcome = createBattleOutcome({ survivors: 2, heroesLost: 3 });
      const result = await checkAndAwardTrophies(outcome);

      expect(result).toContain('COMEBACK_KINGS');
    });

    it('awards UNDERDOG_VICTORY when beating guild with 20%+ more honor', async () => {
      mockPrisma.guildBattle.count.mockResolvedValue(5);
      mockPrisma.guildBattleStreak.findUnique.mockResolvedValue(createMockStreak());
      mockPrisma.guildBattleTrophy.findMany.mockResolvedValue([]);
      mockPrisma.guildBattleTrophy.upsert.mockResolvedValue(createMockTrophy());

      const outcome = createBattleOutcome({
        guildHonor: 1000,
        opponentHonor: 1250, // 25% more
      });
      const result = await checkAndAwardTrophies(outcome);

      expect(result).toContain('UNDERDOG_VICTORY');
    });

    it('awards RIVAL_CRUSHER when beating same guild 5 times', async () => {
      mockPrisma.guildBattle.count.mockResolvedValue(10);
      mockPrisma.guildBattleStreak.findUnique.mockResolvedValue(
        createMockStreak({
          rivalryStats: { 'guild-456': { wins: 4, losses: 2 } }, // Will be 5 after this
        })
      );
      mockPrisma.guildBattleTrophy.findMany.mockResolvedValue([]);
      mockPrisma.guildBattleTrophy.upsert.mockResolvedValue(createMockTrophy());

      const outcome = createBattleOutcome();
      const result = await checkAndAwardTrophies(outcome);

      expect(result).toContain('RIVAL_CRUSHER');
    });

    it('does not award already earned trophies', async () => {
      mockPrisma.guildBattle.count.mockResolvedValue(100);
      mockPrisma.guildBattleStreak.findUnique.mockResolvedValue(
        createMockStreak({ currentWinStreak: 15 })
      );
      mockPrisma.guildBattleTrophy.findMany.mockResolvedValue([
        createMockTrophy({ trophyId: 'FIRST_BLOOD' }),
        createMockTrophy({ trophyId: 'BATTLE_HARDENED' }),
        createMockTrophy({ trophyId: 'WAR_MACHINE' }),
        createMockTrophy({ trophyId: 'LEGENDARY_WARRIORS' }),
        createMockTrophy({ trophyId: 'HOT_STREAK' }),
        createMockTrophy({ trophyId: 'UNSTOPPABLE' }),
        createMockTrophy({ trophyId: 'INVINCIBLE' }),
      ]);

      const outcome = createBattleOutcome();
      const result = await checkAndAwardTrophies(outcome);

      expect(result).toHaveLength(0);
    });
  });

  // ============================================================================
  // CALCULATE BATTLE REWARDS
  // ============================================================================

  describe('calculateBattleRewards', () => {
    it('returns base coins for win without bonuses', async () => {
      mockPrisma.guildBattleStreak.findUnique.mockResolvedValue(createMockStreak());
      mockPrisma.guildBattleTrophy.findMany.mockResolvedValue([]);

      const result = await calculateBattleRewards('guild-123', true, 3, []);

      expect(result.baseCoins).toBe(50); // WIN_BASE_COINS
      expect(result.totalCoins).toBe(50);
    });

    it('returns reduced coins for loss', async () => {
      mockPrisma.guildBattleStreak.findUnique.mockResolvedValue(createMockStreak());
      mockPrisma.guildBattleTrophy.findMany.mockResolvedValue([]);

      const result = await calculateBattleRewards('guild-123', false, 0, []);

      expect(result.baseCoins).toBe(10); // LOSS_BASE_COINS
      expect(result.totalCoins).toBe(10);
    });

    it('adds domination bonus for 5 survivors', async () => {
      mockPrisma.guildBattleStreak.findUnique.mockResolvedValue(createMockStreak());
      mockPrisma.guildBattleTrophy.findMany.mockResolvedValue([]);

      const result = await calculateBattleRewards('guild-123', true, 5, []);

      expect(result.totalCoins).toBe(75); // 50 base + 25 domination
      expect(result.bonusReasons).toContain('+25 Domination (5 survivors)');
    });

    it('applies streak bonus (10% per win)', async () => {
      mockPrisma.guildBattleStreak.findUnique.mockResolvedValue(
        createMockStreak({ currentWinStreak: 3 })
      );
      mockPrisma.guildBattleTrophy.findMany.mockResolvedValue([]);

      const result = await calculateBattleRewards('guild-123', true, 3, []);

      // 50 base + 15 streak bonus (30% of 50 = 15)
      expect(result.totalCoins).toBe(65);
    });

    it('caps streak bonus at 100%', async () => {
      mockPrisma.guildBattleStreak.findUnique.mockResolvedValue(
        createMockStreak({ currentWinStreak: 15 }) // Would be 150% but capped
      );
      mockPrisma.guildBattleTrophy.findMany.mockResolvedValue([]);

      const result = await calculateBattleRewards('guild-123', true, 3, []);

      // 50 base + 50 max streak bonus (100%)
      expect(result.totalCoins).toBe(100);
    });

    it('applies trophy coin multiplier', async () => {
      mockPrisma.guildBattleStreak.findUnique.mockResolvedValue(createMockStreak());
      mockPrisma.guildBattleTrophy.findMany.mockResolvedValue([
        createMockTrophy({ trophyId: 'HOT_STREAK' }), // +10% multiplier
      ]);

      const result = await calculateBattleRewards('guild-123', true, 3, []);

      // 50 base * 1.1 = 55
      expect(result.totalCoins).toBe(55);
    });

    it('returns correct streak status after win', async () => {
      mockPrisma.guildBattleStreak.findUnique.mockResolvedValue(
        createMockStreak({
          currentWinStreak: 2,
          bestWinStreak: 5,
        })
      );
      mockPrisma.guildBattleTrophy.findMany.mockResolvedValue([]);

      const result = await calculateBattleRewards('guild-123', true, 3, []);

      expect(result.streakStatus.currentWinStreak).toBe(3);
      expect(result.streakStatus.currentLossStreak).toBe(0);
    });

    it('returns correct streak status after loss', async () => {
      mockPrisma.guildBattleStreak.findUnique.mockResolvedValue(
        createMockStreak({
          currentWinStreak: 5,
          currentLossStreak: 0,
        })
      );
      mockPrisma.guildBattleTrophy.findMany.mockResolvedValue([]);

      const result = await calculateBattleRewards('guild-123', false, 0, []);

      expect(result.streakStatus.currentWinStreak).toBe(0);
      expect(result.streakStatus.currentLossStreak).toBe(1);
    });
  });

  // ============================================================================
  // GET GUILD TROPHIES
  // ============================================================================

  describe('getGuildTrophies', () => {
    it('returns earned and in-progress trophies', async () => {
      mockPrisma.guildBattleTrophy.findMany.mockResolvedValue([
        createMockTrophy({ trophyId: 'FIRST_BLOOD' }),
        createMockTrophy({ trophyId: 'BATTLE_HARDENED' }),
      ]);
      mockPrisma.guildBattleStreak.findUnique.mockResolvedValue(createMockStreak());
      mockPrisma.guildBattle.count.mockResolvedValue(15);

      const result = await getGuildTrophies('guild-123');

      expect(result.earned.length).toBe(2);
      expect(result.inProgress.length).toBeGreaterThan(0);
    });

    it('calculates total stat bonus from earned trophies', async () => {
      mockPrisma.guildBattleTrophy.findMany.mockResolvedValue([
        createMockTrophy({ trophyId: 'FIRST_BLOOD' }), // +5
        createMockTrophy({ trophyId: 'BATTLE_HARDENED' }), // +10
      ]);
      mockPrisma.guildBattleStreak.findUnique.mockResolvedValue(createMockStreak());
      mockPrisma.guildBattle.count.mockResolvedValue(15);

      const result = await getGuildTrophies('guild-123');

      expect(result.totalStatBonus).toBe(15); // 5 + 10
    });

    it('calculates coin multiplier from earned trophies', async () => {
      mockPrisma.guildBattleTrophy.findMany.mockResolvedValue([
        createMockTrophy({ trophyId: 'HOT_STREAK' }), // 1.1x
        createMockTrophy({ trophyId: 'UNSTOPPABLE' }), // 1.2x
      ]);
      mockPrisma.guildBattleStreak.findUnique.mockResolvedValue(createMockStreak());
      mockPrisma.guildBattle.count.mockResolvedValue(15);

      const result = await getGuildTrophies('guild-123');

      expect(result.coinMultiplier).toBeCloseTo(1.32); // 1.1 * 1.2
    });

    it('includes streak data in response', async () => {
      mockPrisma.guildBattleTrophy.findMany.mockResolvedValue([]);
      mockPrisma.guildBattleStreak.findUnique.mockResolvedValue(
        createMockStreak({
          currentWinStreak: 4,
          bestWinStreak: 8,
        })
      );
      mockPrisma.guildBattle.count.mockResolvedValue(20);

      const result = await getGuildTrophies('guild-123');

      expect(result.streak.currentWinStreak).toBe(4);
      expect(result.streak.bestWinStreak).toBe(8);
    });
  });

  // ============================================================================
  // GET TROPHY STAT BONUS
  // ============================================================================

  describe('getTrophyStatBonus', () => {
    it('returns total stat bonus for active trophies', async () => {
      mockPrisma.guildBattleTrophy.findMany.mockResolvedValue([
        createMockTrophy({ trophyId: 'FIRST_BLOOD', isActive: true }), // +5
        createMockTrophy({ trophyId: 'WAR_MACHINE', isActive: true }), // +20
      ]);

      const result = await getTrophyStatBonus('guild-123');

      expect(result).toBe(25);
    });

    it('returns 0 when no trophies earned', async () => {
      mockPrisma.guildBattleTrophy.findMany.mockResolvedValue([]);

      const result = await getTrophyStatBonus('guild-123');

      expect(result).toBe(0);
    });

    it('only queries active trophies', async () => {
      mockPrisma.guildBattleTrophy.findMany.mockResolvedValue([]);

      await getTrophyStatBonus('guild-123');

      expect(mockPrisma.guildBattleTrophy.findMany).toHaveBeenCalledWith({
        where: { guildId: 'guild-123', isActive: true },
        select: { trophyId: true },
      });
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('edge cases', () => {
    it('handles null rivalry stats gracefully', async () => {
      const streak = createMockStreak({ rivalryStats: null as any });
      mockPrisma.guildBattleStreak.findUnique.mockResolvedValue(streak);
      mockPrisma.guildBattleStreak.update.mockResolvedValue(streak);

      await updateBattleStreak('guild-123', 'guild-456', true);

      expect(mockPrisma.guildBattleStreak.update).toHaveBeenCalledWith({
        where: { guildId: 'guild-123' },
        data: expect.objectContaining({
          rivalryStats: { 'guild-456': { wins: 1, losses: 0 } },
        }),
      });
    });

    it('handles very long win streaks', async () => {
      const streak = createMockStreak({
        currentWinStreak: 999,
        bestWinStreak: 999,
      });
      mockPrisma.guildBattleStreak.findUnique.mockResolvedValue(streak);
      mockPrisma.guildBattleStreak.update.mockResolvedValue({
        ...streak,
        currentWinStreak: 1000,
        bestWinStreak: 1000,
      });

      const result = await updateBattleStreak('guild-123', 'guild-456', true);

      expect(result.currentWinStreak).toBe(1000);
    });

    it('handles negative honor difference (guild has more honor)', async () => {
      mockPrisma.guildBattle.count.mockResolvedValue(5);
      mockPrisma.guildBattleStreak.findUnique.mockResolvedValue(createMockStreak());
      mockPrisma.guildBattleTrophy.findMany.mockResolvedValue([]);
      mockPrisma.guildBattleTrophy.upsert.mockResolvedValue(createMockTrophy());

      const outcome = createBattleOutcome({
        guildHonor: 1500,
        opponentHonor: 1000, // We have more honor
      });
      const result = await checkAndAwardTrophies(outcome);

      // Should NOT award UNDERDOG_VICTORY
      expect(result).not.toContain('UNDERDOG_VICTORY');
    });

    it('awards multiple trophies in single battle', async () => {
      mockPrisma.guildBattle.count.mockResolvedValue(1);
      mockPrisma.guildBattleStreak.findUnique.mockResolvedValue(
        createMockStreak({ currentWinStreak: 2 }) // Will be 3
      );
      mockPrisma.guildBattleTrophy.findMany.mockResolvedValue([]);
      mockPrisma.guildBattleTrophy.upsert.mockResolvedValue(createMockTrophy());

      const outcome = createBattleOutcome({
        survivors: 5,
        heroesLost: 0,
      });
      const result = await checkAndAwardTrophies(outcome);

      // Should get FIRST_BLOOD, HOT_STREAK, and DOMINATION
      expect(result).toContain('FIRST_BLOOD');
      expect(result).toContain('HOT_STREAK');
      expect(result).toContain('DOMINATION');
    });
  });
});
