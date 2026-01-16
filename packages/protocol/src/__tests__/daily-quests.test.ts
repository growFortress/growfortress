/**
 * Daily Quests Protocol tests
 */
import { describe, it, expect } from 'vitest';
import {
  DailyQuestIdSchema,
  DailyQuestProgressSchema,
  DailyQuestsResponseSchema,
  ClaimQuestRewardResponseSchema,
  ClaimAllQuestsResponseSchema,
  DAILY_QUEST_DEFINITIONS,
  TOTAL_DAILY_DUST,
  DAILY_QUEST_ERROR_CODES,
} from '../daily-quests.js';

describe('Daily Quests Protocol', () => {
  describe('DailyQuestIdSchema', () => {
    it('validates valid quest IDs', () => {
      const validIds = ['first_blood', 'wave_hunter', 'elite_slayer', 'boss_slayer', 'dedicated'];

      for (const id of validIds) {
        expect(() => DailyQuestIdSchema.parse(id)).not.toThrow();
      }
    });

    it('rejects invalid quest IDs', () => {
      expect(() => DailyQuestIdSchema.parse('invalid_id')).toThrow();
      expect(() => DailyQuestIdSchema.parse('')).toThrow();
      expect(() => DailyQuestIdSchema.parse(123)).toThrow();
    });
  });

  describe('DailyQuestProgressSchema', () => {
    it('validates valid quest progress', () => {
      const progress = {
        questId: 'first_blood',
        progress: 0,
        target: 1,
        completed: false,
        claimed: false,
        dustReward: 25,
        bonusType: null,
        bonusValue: null,
      };

      expect(() => DailyQuestProgressSchema.parse(progress)).not.toThrow();
    });

    it('validates progress with bonus', () => {
      const progress = {
        questId: 'wave_hunter',
        progress: 250,
        target: 500,
        completed: false,
        claimed: false,
        dustReward: 35,
        bonusType: 'gold',
        bonusValue: 100,
      };

      expect(() => DailyQuestProgressSchema.parse(progress)).not.toThrow();
    });

    it('validates progress with gold bonus (elite_slayer)', () => {
      const progress = {
        questId: 'elite_slayer',
        progress: 10,
        target: 10,
        completed: true,
        claimed: false,
        dustReward: 10,
        bonusType: 'gold',
        bonusValue: 150,
      };

      expect(() => DailyQuestProgressSchema.parse(progress)).not.toThrow();
    });

    it('validates progress with gold bonus', () => {
      const progress = {
        questId: 'boss_slayer',
        progress: 3,
        target: 3,
        completed: true,
        claimed: false,
        dustReward: 10,
        bonusType: 'gold',
        bonusValue: 200,
      };

      expect(() => DailyQuestProgressSchema.parse(progress)).not.toThrow();
    });

    it('rejects negative progress', () => {
      const progress = {
        questId: 'first_blood',
        progress: -1,
        target: 1,
        completed: false,
        claimed: false,
        dustReward: 25,
        bonusType: null,
        bonusValue: null,
      };

      expect(() => DailyQuestProgressSchema.parse(progress)).toThrow();
    });
  });

  describe('DailyQuestsResponseSchema', () => {
    it('validates valid response', () => {
      const response = {
        quests: [
          {
            questId: 'first_blood',
            progress: 1,
            target: 1,
            completed: true,
            claimed: true,
            dustReward: 25,
            bonusType: null,
            bonusValue: null,
          },
        ],
        resetAt: '2024-01-16T00:00:00.000Z',
        totalDustEarned: 25,
        allCompleted: false,
        allClaimed: false,
      };

      expect(() => DailyQuestsResponseSchema.parse(response)).not.toThrow();
    });

    it('requires valid datetime for resetAt', () => {
      const response = {
        quests: [],
        resetAt: 'invalid-date',
        totalDustEarned: 0,
        allCompleted: false,
        allClaimed: false,
      };

      expect(() => DailyQuestsResponseSchema.parse(response)).toThrow();
    });
  });

  describe('ClaimQuestRewardResponseSchema', () => {
    it('validates successful claim response', () => {
      const response = {
        success: true,
        dustAwarded: 25,
        bonusAwarded: null,
        newInventory: {
          dust: 100,
          gold: 500,
          materials: { iron: 10 },
        },
      };

      expect(() => ClaimQuestRewardResponseSchema.parse(response)).not.toThrow();
    });

    it('validates claim response with bonus', () => {
      const response = {
        success: true,
        dustAwarded: 35,
        bonusAwarded: {
          type: 'gold',
          value: 100,
        },
        newInventory: {
          dust: 135,
          gold: 600,
          materials: {},
        },
      };

      expect(() => ClaimQuestRewardResponseSchema.parse(response)).not.toThrow();
    });

    it('validates failed claim response', () => {
      const response = {
        success: false,
        dustAwarded: 0,
        bonusAwarded: null,
        newInventory: {
          dust: 100,
          gold: 500,
          materials: {},
        },
        error: 'QUEST_NOT_COMPLETED',
      };

      expect(() => ClaimQuestRewardResponseSchema.parse(response)).not.toThrow();
    });
  });

  describe('ClaimAllQuestsResponseSchema', () => {
    it('validates successful claim all response', () => {
      const response = {
        success: true,
        totalDustAwarded: 285,
        totalGoldAwarded: 100,
        materialsAwarded: { rare_essence: 1 },
        claimedCount: 5,
        newInventory: {
          dust: 385,
          gold: 600,
          materials: { rare_essence: 1 },
        },
      };

      expect(() => ClaimAllQuestsResponseSchema.parse(response)).not.toThrow();
    });

    it('validates no quests to claim response', () => {
      const response = {
        success: false,
        totalDustAwarded: 0,
        totalGoldAwarded: 0,
        materialsAwarded: {},
        claimedCount: 0,
        newInventory: {
          dust: 100,
          gold: 500,
          materials: {},
        },
        error: 'NO_QUESTS_TO_CLAIM',
      };

      expect(() => ClaimAllQuestsResponseSchema.parse(response)).not.toThrow();
    });
  });

  describe('DAILY_QUEST_DEFINITIONS', () => {
    it('contains all quest types', () => {
      const questIds = DAILY_QUEST_DEFINITIONS.map((q) => q.id);

      expect(questIds).toContain('first_blood');
      expect(questIds).toContain('wave_hunter');
      expect(questIds).toContain('elite_slayer');
      expect(questIds).toContain('boss_slayer');
      expect(questIds).toContain('dedicated');
    });

    it('has exactly 5 quests', () => {
      expect(DAILY_QUEST_DEFINITIONS.length).toBe(5);
    });

    it('has positive targets for all quests', () => {
      for (const quest of DAILY_QUEST_DEFINITIONS) {
        expect(quest.target).toBeGreaterThan(0);
      }
    });

    it('has positive dust rewards for all quests', () => {
      for (const quest of DAILY_QUEST_DEFINITIONS) {
        expect(quest.dustReward).toBeGreaterThan(0);
      }
    });

    it('has valid bonus types', () => {
      for (const quest of DAILY_QUEST_DEFINITIONS) {
        if (quest.bonusType !== null) {
          expect(['gold', 'material', 'random_material']).toContain(quest.bonusType);
        }
      }
    });
  });

  describe('TOTAL_DAILY_DUST', () => {
    it('equals sum of all quest rewards', () => {
      const expectedTotal = DAILY_QUEST_DEFINITIONS.reduce(
        (sum, q) => sum + q.dustReward,
        0
      );

      expect(TOTAL_DAILY_DUST).toBe(expectedTotal);
    });
  });

  describe('DAILY_QUEST_ERROR_CODES', () => {
    it('contains all error codes', () => {
      expect(DAILY_QUEST_ERROR_CODES.QUEST_NOT_FOUND).toBe('QUEST_NOT_FOUND');
      expect(DAILY_QUEST_ERROR_CODES.QUEST_NOT_COMPLETED).toBe('QUEST_NOT_COMPLETED');
      expect(DAILY_QUEST_ERROR_CODES.QUEST_ALREADY_CLAIMED).toBe('QUEST_ALREADY_CLAIMED');
      expect(DAILY_QUEST_ERROR_CODES.NO_QUESTS_TO_CLAIM).toBe('NO_QUESTS_TO_CLAIM');
    });
  });
});
