/**
 * Daily Quests service tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getDailyQuests,
  updateQuestProgress,
  updateQuestsFromRun,
  claimQuestReward,
  claimAllQuestRewards,
  cleanupOldQuestProgress,
  getNextResetTime,
  getCurrentResetTime,
} from '../../../services/dailyQuests.js';
import { mockPrisma, createMockInventory } from '../../mocks/prisma.js';
import { DAILY_QUEST_DEFINITIONS, DAILY_QUEST_ERROR_CODES } from '@arcade/protocol';

describe('Daily Quests Service', () => {
  describe('getNextResetTime', () => {
    it('returns midnight UTC of the next day', () => {
      const result = getNextResetTime();

      expect(result.getUTCHours()).toBe(0);
      expect(result.getUTCMinutes()).toBe(0);
      expect(result.getUTCSeconds()).toBe(0);
      expect(result.getUTCMilliseconds()).toBe(0);

      // Should be tomorrow
      const now = new Date();
      const expectedDate = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1
      ));
      expect(result.getUTCDate()).toBe(expectedDate.getUTCDate());
    });
  });

  describe('getCurrentResetTime', () => {
    it('returns midnight UTC of today', () => {
      const result = getCurrentResetTime();

      expect(result.getUTCHours()).toBe(0);
      expect(result.getUTCMinutes()).toBe(0);
      expect(result.getUTCSeconds()).toBe(0);
      expect(result.getUTCMilliseconds()).toBe(0);

      // Should be today
      const now = new Date();
      expect(result.getUTCDate()).toBe(now.getUTCDate());
      expect(result.getUTCMonth()).toBe(now.getUTCMonth());
      expect(result.getUTCFullYear()).toBe(now.getUTCFullYear());
    });
  });

  describe('getDailyQuests', () => {
    it('returns all quests with zero progress when no existing data', async () => {
      mockPrisma.dailyQuestProgress.findMany.mockResolvedValue([]);

      const result = await getDailyQuests('user-123');

      expect(result.quests).toHaveLength(DAILY_QUEST_DEFINITIONS.length);
      expect(result.quests.every(q => q.progress === 0)).toBe(true);
      expect(result.quests.every(q => q.completed === false)).toBe(true);
      expect(result.quests.every(q => q.claimed === false)).toBe(true);
      expect(result.totalDustEarned).toBe(0);
      expect(result.allCompleted).toBe(false);
      expect(result.allClaimed).toBe(false);
    });

    it('returns existing progress from database', async () => {
      const currentReset = getCurrentResetTime();
      mockPrisma.dailyQuestProgress.findMany.mockResolvedValue([
        {
          id: 'progress-1',
          userId: 'user-123',
          questId: 'first_blood',
          progress: 1,
          completed: true,
          claimed: false,
          resetAt: currentReset,
        },
        {
          id: 'progress-2',
          userId: 'user-123',
          questId: 'wave_hunter',
          progress: 250,
          completed: false,
          claimed: false,
          resetAt: currentReset,
        },
      ]);

      const result = await getDailyQuests('user-123');

      const firstBlood = result.quests.find(q => q.questId === 'first_blood');
      const waveHunter = result.quests.find(q => q.questId === 'wave_hunter');

      expect(firstBlood?.progress).toBe(1);
      expect(firstBlood?.completed).toBe(true);
      expect(firstBlood?.claimed).toBe(false);

      expect(waveHunter?.progress).toBe(250);
      expect(waveHunter?.completed).toBe(false);
    });

    it('calculates totalDustEarned from claimed quests', async () => {
      const currentReset = getCurrentResetTime();
      const firstBloodDef = DAILY_QUEST_DEFINITIONS.find(q => q.id === 'first_blood');
      const waveHunterDef = DAILY_QUEST_DEFINITIONS.find(q => q.id === 'wave_hunter');

      mockPrisma.dailyQuestProgress.findMany.mockResolvedValue([
        {
          id: 'progress-1',
          userId: 'user-123',
          questId: 'first_blood',
          progress: 1,
          completed: true,
          claimed: true,
          resetAt: currentReset,
        },
        {
          id: 'progress-2',
          userId: 'user-123',
          questId: 'wave_hunter',
          progress: 500,
          completed: true,
          claimed: true,
          resetAt: currentReset,
        },
      ]);

      const result = await getDailyQuests('user-123');

      expect(result.totalDustEarned).toBe(
        (firstBloodDef?.dustReward ?? 0) + (waveHunterDef?.dustReward ?? 0)
      );
    });

    it('sets allCompleted when all quests are completed', async () => {
      const currentReset = getCurrentResetTime();
      const allProgress = DAILY_QUEST_DEFINITIONS.map((q, i) => ({
        id: `progress-${i}`,
        userId: 'user-123',
        questId: q.id,
        progress: q.target,
        completed: true,
        claimed: false,
        resetAt: currentReset,
      }));

      mockPrisma.dailyQuestProgress.findMany.mockResolvedValue(allProgress);

      const result = await getDailyQuests('user-123');

      expect(result.allCompleted).toBe(true);
      expect(result.allClaimed).toBe(false);
    });

    it('sets allClaimed when all quests are claimed', async () => {
      const currentReset = getCurrentResetTime();
      const allProgress = DAILY_QUEST_DEFINITIONS.map((q, i) => ({
        id: `progress-${i}`,
        userId: 'user-123',
        questId: q.id,
        progress: q.target,
        completed: true,
        claimed: true,
        resetAt: currentReset,
      }));

      mockPrisma.dailyQuestProgress.findMany.mockResolvedValue(allProgress);

      const result = await getDailyQuests('user-123');

      expect(result.allCompleted).toBe(true);
      expect(result.allClaimed).toBe(true);
    });

    it('includes quest reward info in response', async () => {
      mockPrisma.dailyQuestProgress.findMany.mockResolvedValue([]);

      const result = await getDailyQuests('user-123');

      const waveHunter = result.quests.find(q => q.questId === 'wave_hunter');
      expect(waveHunter?.dustReward).toBe(18);
      expect(waveHunter?.bonusType).toBe('gold');
      expect(waveHunter?.bonusValue).toBe(100);
    });
  });

  describe('updateQuestProgress', () => {
    it('creates new progress record if none exists', async () => {
      mockPrisma.dailyQuestProgress.upsert.mockResolvedValue({
        id: 'progress-1',
        userId: 'user-123',
        questId: 'first_blood',
        progress: 1,
        completed: true,
        claimed: false,
        resetAt: getCurrentResetTime(),
      });
      mockPrisma.dailyQuestProgress.findUnique.mockResolvedValue(null);

      await updateQuestProgress('user-123', 'first_blood', 1);

      expect(mockPrisma.dailyQuestProgress.upsert).toHaveBeenCalled();
    });

    it('updates existing progress with increment', async () => {
      mockPrisma.dailyQuestProgress.upsert.mockResolvedValue({
        id: 'progress-1',
        userId: 'user-123',
        questId: 'wave_hunter',
        progress: 350,
        completed: false,
        claimed: false,
        resetAt: getCurrentResetTime(),
      });
      mockPrisma.dailyQuestProgress.findUnique.mockResolvedValue({
        id: 'progress-1',
        progress: 350,
        completed: false,
      });

      await updateQuestProgress('user-123', 'wave_hunter', 100);

      const upsertCall = mockPrisma.dailyQuestProgress.upsert.mock.calls[0][0];
      expect(upsertCall.update.progress.increment).toBe(100);
    });

    it('marks quest as completed when target is reached', async () => {
      const questDef = DAILY_QUEST_DEFINITIONS.find(q => q.id === 'wave_hunter');

      mockPrisma.dailyQuestProgress.upsert.mockResolvedValue({
        id: 'progress-1',
        userId: 'user-123',
        questId: 'wave_hunter',
        progress: questDef!.target,
        completed: false,
        claimed: false,
        resetAt: getCurrentResetTime(),
      });
      mockPrisma.dailyQuestProgress.findUnique.mockResolvedValue({
        id: 'progress-1',
        progress: questDef!.target,
        completed: false,
      });
      mockPrisma.dailyQuestProgress.update.mockResolvedValue({});

      await updateQuestProgress('user-123', 'wave_hunter', questDef!.target);

      expect(mockPrisma.dailyQuestProgress.update).toHaveBeenCalledWith({
        where: { id: 'progress-1' },
        data: { completed: true },
      });
    });

    it('does nothing for invalid quest ID', async () => {
      await updateQuestProgress('user-123', 'invalid_quest' as any, 1);

      expect(mockPrisma.dailyQuestProgress.upsert).not.toHaveBeenCalled();
    });
  });

  describe('updateQuestsFromRun', () => {
    beforeEach(() => {
      mockPrisma.dailyQuestProgress.upsert.mockResolvedValue({});
      mockPrisma.dailyQuestProgress.findUnique.mockResolvedValue(null);
    });

    it('updates first_blood for runs completed', async () => {
      await updateQuestsFromRun('user-123', { runsCompleted: 1 });

      const calls = mockPrisma.dailyQuestProgress.upsert.mock.calls;
      const firstBloodCall = calls.find(c => c[0].where.userId_questId_resetAt.questId === 'first_blood');
      expect(firstBloodCall).toBeDefined();
    });

    it('updates wave_hunter for enemies killed', async () => {
      await updateQuestsFromRun('user-123', { enemiesKilled: 100 });

      const calls = mockPrisma.dailyQuestProgress.upsert.mock.calls;
      const waveHunterCall = calls.find(c => c[0].where.userId_questId_resetAt.questId === 'wave_hunter');
      expect(waveHunterCall).toBeDefined();
    });

    it('updates elite_slayer for elites killed', async () => {
      await updateQuestsFromRun('user-123', { elitesKilled: 5 });

      const calls = mockPrisma.dailyQuestProgress.upsert.mock.calls;
      const eliteSlayerCall = calls.find(c => c[0].where.userId_questId_resetAt.questId === 'elite_slayer');
      expect(eliteSlayerCall).toBeDefined();
    });

    it('updates boss_rush_daily for bosses killed', async () => {
      await updateQuestsFromRun('user-123', { bossesKilled: 3 });

      const calls = mockPrisma.dailyQuestProgress.upsert.mock.calls;
      const bossRushCall = calls.find(c => c[0].where.userId_questId_resetAt.questId === 'boss_rush_daily');
      expect(bossRushCall).toBeDefined();
    });

    it('updates pillar_master for pillars completed', async () => {
      await updateQuestsFromRun('user-123', { pillarsCompleted: 1 });

      const calls = mockPrisma.dailyQuestProgress.upsert.mock.calls;
      const pillarMasterCall = calls.find(c => c[0].where.userId_questId_resetAt.questId === 'pillar_master');
      expect(pillarMasterCall).toBeDefined();
    });

    it('updates multiple quests at once', async () => {
      await updateQuestsFromRun('user-123', {
        runsCompleted: 1,
        enemiesKilled: 100,
        elitesKilled: 2,
      });

      expect(mockPrisma.dailyQuestProgress.upsert).toHaveBeenCalledTimes(3);
    });

    it('skips updates for zero values', async () => {
      await updateQuestsFromRun('user-123', {
        runsCompleted: 0,
        enemiesKilled: 0,
      });

      expect(mockPrisma.dailyQuestProgress.upsert).not.toHaveBeenCalled();
    });
  });

  describe('claimQuestReward', () => {
    it('returns error for invalid quest ID', async () => {
      const result = await claimQuestReward('user-123', 'invalid_quest' as any);

      expect(result.success).toBe(false);
      expect(result.error).toBe(DAILY_QUEST_ERROR_CODES.QUEST_NOT_FOUND);
    });

    it('returns error if quest not completed', async () => {
      mockPrisma.dailyQuestProgress.findUnique.mockResolvedValue(null);

      const result = await claimQuestReward('user-123', 'first_blood');

      expect(result.success).toBe(false);
      expect(result.error).toBe(DAILY_QUEST_ERROR_CODES.QUEST_NOT_COMPLETED);
    });

    it('returns error if quest already claimed', async () => {
      mockPrisma.dailyQuestProgress.findUnique.mockResolvedValue({
        id: 'progress-1',
        completed: true,
        claimed: true,
      });

      const result = await claimQuestReward('user-123', 'first_blood');

      expect(result.success).toBe(false);
      expect(result.error).toBe(DAILY_QUEST_ERROR_CODES.QUEST_ALREADY_CLAIMED);
    });

    it('awards dust reward on successful claim', async () => {
      const questDef = DAILY_QUEST_DEFINITIONS.find(q => q.id === 'first_blood');

      mockPrisma.dailyQuestProgress.findUnique.mockResolvedValue({
        id: 'progress-1',
        completed: true,
        claimed: false,
      });

      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return callback(mockPrisma);
      });

      mockPrisma.dailyQuestProgress.update.mockResolvedValue({});
      mockPrisma.inventory.findUnique.mockResolvedValue(createMockInventory());
      mockPrisma.inventory.update.mockResolvedValue({
        dust: 75,
        gold: 100,
        materials: {},
      });

      const result = await claimQuestReward('user-123', 'first_blood');

      expect(result.success).toBe(true);
      expect(result.dustAwarded).toBe(questDef!.dustReward);
    });

    it('awards gold bonus when applicable', async () => {
      mockPrisma.dailyQuestProgress.findUnique.mockResolvedValue({
        id: 'progress-1',
        completed: true,
        claimed: false,
      });

      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return callback(mockPrisma);
      });

      mockPrisma.dailyQuestProgress.update.mockResolvedValue({});
      mockPrisma.inventory.findUnique.mockResolvedValue(createMockInventory());
      mockPrisma.inventory.update.mockResolvedValue({
        dust: 85,
        gold: 200,
        materials: {},
      });

      const result = await claimQuestReward('user-123', 'wave_hunter');

      expect(result.success).toBe(true);
      expect(result.bonusAwarded).toEqual({ type: 'gold', value: 100 });
    });

    it('awards material bonus when applicable', async () => {
      mockPrisma.dailyQuestProgress.findUnique.mockResolvedValue({
        id: 'progress-1',
        completed: true,
        claimed: false,
      });

      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return callback(mockPrisma);
      });

      mockPrisma.dailyQuestProgress.update.mockResolvedValue({});
      mockPrisma.inventory.findUnique.mockResolvedValue(createMockInventory());
      mockPrisma.inventory.update.mockResolvedValue({
        dust: 125,
        gold: 100,
        materials: { rare_essence: 1 },
      });

      const result = await claimQuestReward('user-123', 'boss_rush_daily');

      expect(result.success).toBe(true);
      expect(result.bonusAwarded).toEqual({ type: 'material', value: 'rare_essence' });
    });

    it('returns updated inventory in response', async () => {
      mockPrisma.dailyQuestProgress.findUnique.mockResolvedValue({
        id: 'progress-1',
        completed: true,
        claimed: false,
      });

      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return callback(mockPrisma);
      });

      mockPrisma.dailyQuestProgress.update.mockResolvedValue({});
      mockPrisma.inventory.findUnique.mockResolvedValue(createMockInventory());
      mockPrisma.inventory.update.mockResolvedValue({
        dust: 75,
        gold: 100,
        materials: { cosmic_dust: 5 },
      });

      const result = await claimQuestReward('user-123', 'first_blood');

      expect(result.newInventory.dust).toBe(75);
      expect(result.newInventory.gold).toBe(100);
      expect(result.newInventory.materials).toEqual({ cosmic_dust: 5 });
    });
  });

  describe('claimAllQuestRewards', () => {
    it('returns error when no quests to claim', async () => {
      mockPrisma.dailyQuestProgress.findMany.mockResolvedValue([]);
      mockPrisma.inventory.findUnique.mockResolvedValue(createMockInventory());

      const result = await claimAllQuestRewards('user-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe(DAILY_QUEST_ERROR_CODES.NO_QUESTS_TO_CLAIM);
      expect(result.claimedCount).toBe(0);
    });

    it('claims all completed unclaimed quests', async () => {
      mockPrisma.dailyQuestProgress.findMany.mockResolvedValue([
        { id: 'p1', questId: 'first_blood', completed: true, claimed: false },
        { id: 'p2', questId: 'wave_hunter', completed: true, claimed: false },
      ]);

      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return callback(mockPrisma);
      });

      mockPrisma.dailyQuestProgress.updateMany.mockResolvedValue({ count: 2 });
      mockPrisma.inventory.findUnique.mockResolvedValue(createMockInventory());
      mockPrisma.inventory.update.mockResolvedValue({
        dust: 110,
        gold: 200,
        materials: {},
      });

      const result = await claimAllQuestRewards('user-123');

      expect(result.success).toBe(true);
      expect(result.claimedCount).toBe(2);
    });

    it('calculates total rewards from all claimed quests', async () => {
      const firstBloodDef = DAILY_QUEST_DEFINITIONS.find(q => q.id === 'first_blood');
      const waveHunterDef = DAILY_QUEST_DEFINITIONS.find(q => q.id === 'wave_hunter');

      mockPrisma.dailyQuestProgress.findMany.mockResolvedValue([
        { id: 'p1', questId: 'first_blood', completed: true, claimed: false },
        { id: 'p2', questId: 'wave_hunter', completed: true, claimed: false },
      ]);

      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return callback(mockPrisma);
      });

      mockPrisma.dailyQuestProgress.updateMany.mockResolvedValue({ count: 2 });
      mockPrisma.inventory.findUnique.mockResolvedValue(createMockInventory());
      mockPrisma.inventory.update.mockResolvedValue({
        dust: 110,
        gold: 200,
        materials: {},
      });

      const result = await claimAllQuestRewards('user-123');

      expect(result.totalDustAwarded).toBe(
        (firstBloodDef?.dustReward ?? 0) + (waveHunterDef?.dustReward ?? 0)
      );
      expect(result.totalGoldAwarded).toBe(100); // wave_hunter gold bonus
    });

    it('returns updated inventory', async () => {
      mockPrisma.dailyQuestProgress.findMany.mockResolvedValue([
        { id: 'p1', questId: 'first_blood', completed: true, claimed: false },
      ]);

      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return callback(mockPrisma);
      });

      mockPrisma.dailyQuestProgress.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.inventory.findUnique.mockResolvedValue(createMockInventory());
      mockPrisma.inventory.update.mockResolvedValue({
        dust: 75,
        gold: 100,
        materials: { rare_crystal: 3 },
      });

      const result = await claimAllQuestRewards('user-123');

      expect(result.newInventory.dust).toBe(75);
      expect(result.newInventory.gold).toBe(100);
      expect(result.newInventory.materials).toEqual({ rare_crystal: 3 });
    });
  });

  describe('cleanupOldQuestProgress', () => {
    it('deletes records older than specified days', async () => {
      mockPrisma.dailyQuestProgress.deleteMany.mockResolvedValue({ count: 50 });

      const result = await cleanupOldQuestProgress(7);

      expect(result).toBe(50);
      expect(mockPrisma.dailyQuestProgress.deleteMany).toHaveBeenCalledWith({
        where: {
          resetAt: {
            lt: expect.any(Date),
          },
        },
      });
    });

    it('uses default 7 days if not specified', async () => {
      mockPrisma.dailyQuestProgress.deleteMany.mockResolvedValue({ count: 10 });

      await cleanupOldQuestProgress();

      const call = mockPrisma.dailyQuestProgress.deleteMany.mock.calls[0][0];
      const cutoffDate = call.where.resetAt.lt;

      const now = new Date();
      const expectedCutoff = new Date();
      expectedCutoff.setDate(now.getDate() - 7);

      // Should be roughly 7 days ago
      const diffDays = Math.round((now.getTime() - cutoffDate.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(7);
    });

    it('returns count of deleted records', async () => {
      mockPrisma.dailyQuestProgress.deleteMany.mockResolvedValue({ count: 123 });

      const result = await cleanupOldQuestProgress(30);

      expect(result).toBe(123);
    });
  });
});
