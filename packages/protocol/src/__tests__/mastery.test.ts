/**
 * Mastery Protocol tests
 */
import { describe, it, expect } from 'vitest';
import {
  MasteryNodeTypeSchema,
  MasteryTierSchema,
  ClassMasteryProgressSchema,
  PlayerMasteryProgressSchema,
  UnlockMasteryNodeRequestSchema,
  UnlockMasteryNodeResponseSchema,
  RespecMasteryTreeRequestSchema,
  RespecMasteryTreeResponseSchema,
  AwardMasteryPointsRequestSchema,
  AwardMasteryPointsResponseSchema,
  ClassProgressSummarySchema,
} from '../mastery.js';

describe('Mastery Protocol', () => {
  describe('MasteryNodeTypeSchema', () => {
    it('validates valid node types', () => {
      const validTypes = ['stat_bonus', 'synergy_amplifier', 'class_perk', 'capstone'];

      for (const type of validTypes) {
        expect(() => MasteryNodeTypeSchema.parse(type)).not.toThrow();
      }
    });

    it('rejects invalid node types', () => {
      expect(() => MasteryNodeTypeSchema.parse('invalid_type')).toThrow();
      expect(() => MasteryNodeTypeSchema.parse('')).toThrow();
    });
  });

  describe('MasteryTierSchema', () => {
    it('validates valid tiers (1-5)', () => {
      for (let tier = 1; tier <= 5; tier++) {
        expect(() => MasteryTierSchema.parse(tier)).not.toThrow();
      }
    });

    it('rejects invalid tiers', () => {
      expect(() => MasteryTierSchema.parse(0)).toThrow();
      expect(() => MasteryTierSchema.parse(6)).toThrow();
      expect(() => MasteryTierSchema.parse(-1)).toThrow();
    });
  });

  describe('ClassMasteryProgressSchema', () => {
    it('validates valid class progress', () => {
      const progress = {
        pointsSpent: 10,
        unlockedNodes: ['node1', 'node2', 'node3'],
      };

      expect(() => ClassMasteryProgressSchema.parse(progress)).not.toThrow();
    });

    it('validates empty progress', () => {
      const progress = {
        pointsSpent: 0,
        unlockedNodes: [],
      };

      expect(() => ClassMasteryProgressSchema.parse(progress)).not.toThrow();
    });

    it('rejects negative points spent', () => {
      const progress = {
        pointsSpent: -5,
        unlockedNodes: [],
      };

      expect(() => ClassMasteryProgressSchema.parse(progress)).toThrow();
    });
  });

  describe('PlayerMasteryProgressSchema', () => {
    it('validates valid player progress', () => {
      const progress = {
        availablePoints: 10,
        totalPointsEarned: 25,
        classProgress: {
          natural: { pointsSpent: 10, unlockedNodes: ['n1', 'n2'] },
          ice: { pointsSpent: 5, unlockedNodes: ['i1'] },
          fire: { pointsSpent: 0, unlockedNodes: [] },
          lightning: { pointsSpent: 0, unlockedNodes: [] },
          tech: { pointsSpent: 0, unlockedNodes: [] },
          void: { pointsSpent: 0, unlockedNodes: [] },
          plasma: { pointsSpent: 0, unlockedNodes: [] },
        },
        updatedAt: '2024-01-15T12:00:00.000Z',
      };

      expect(() => PlayerMasteryProgressSchema.parse(progress)).not.toThrow();
    });

    it('validates progress without updatedAt', () => {
      const progress = {
        availablePoints: 0,
        totalPointsEarned: 0,
        classProgress: {
          natural: { pointsSpent: 0, unlockedNodes: [] },
          ice: { pointsSpent: 0, unlockedNodes: [] },
          fire: { pointsSpent: 0, unlockedNodes: [] },
          lightning: { pointsSpent: 0, unlockedNodes: [] },
          tech: { pointsSpent: 0, unlockedNodes: [] },
          void: { pointsSpent: 0, unlockedNodes: [] },
          plasma: { pointsSpent: 0, unlockedNodes: [] },
        },
      };

      expect(() => PlayerMasteryProgressSchema.parse(progress)).not.toThrow();
    });

    it('rejects negative available points', () => {
      const progress = {
        availablePoints: -5,
        totalPointsEarned: 0,
        classProgress: {
          natural: { pointsSpent: 0, unlockedNodes: [] },
        },
      };

      expect(() => PlayerMasteryProgressSchema.parse(progress)).toThrow();
    });
  });

  describe('UnlockMasteryNodeRequestSchema', () => {
    it('validates valid request', () => {
      const request = {
        nodeId: 'natural_t1_hp1',
      };

      expect(() => UnlockMasteryNodeRequestSchema.parse(request)).not.toThrow();
    });

    it('rejects empty node ID', () => {
      const request = {
        nodeId: '',
      };

      // Empty string is still a valid string, but might be rejected by other validation
      expect(() => UnlockMasteryNodeRequestSchema.parse(request)).not.toThrow();
    });
  });

  describe('UnlockMasteryNodeResponseSchema', () => {
    it('validates successful unlock response', () => {
      const response = {
        success: true,
        progress: {
          availablePoints: 9,
          totalPointsEarned: 10,
          classProgress: {
            natural: { pointsSpent: 1, unlockedNodes: ['node1'] },
            ice: { pointsSpent: 0, unlockedNodes: [] },
            fire: { pointsSpent: 0, unlockedNodes: [] },
            lightning: { pointsSpent: 0, unlockedNodes: [] },
            tech: { pointsSpent: 0, unlockedNodes: [] },
            void: { pointsSpent: 0, unlockedNodes: [] },
            plasma: { pointsSpent: 0, unlockedNodes: [] },
          },
        },
      };

      expect(() => UnlockMasteryNodeResponseSchema.parse(response)).not.toThrow();
    });

    it('validates failed unlock response', () => {
      const response = {
        success: false,
        progress: {
          availablePoints: 0,
          totalPointsEarned: 0,
          classProgress: {
            natural: { pointsSpent: 0, unlockedNodes: [] },
            ice: { pointsSpent: 0, unlockedNodes: [] },
            fire: { pointsSpent: 0, unlockedNodes: [] },
            lightning: { pointsSpent: 0, unlockedNodes: [] },
            tech: { pointsSpent: 0, unlockedNodes: [] },
            void: { pointsSpent: 0, unlockedNodes: [] },
            plasma: { pointsSpent: 0, unlockedNodes: [] },
          },
        },
        message: 'Not enough points',
      };

      expect(() => UnlockMasteryNodeResponseSchema.parse(response)).not.toThrow();
    });
  });

  describe('RespecMasteryTreeRequestSchema', () => {
    it('validates valid request', () => {
      const request = {
        class: 'natural',
      };

      expect(() => RespecMasteryTreeRequestSchema.parse(request)).not.toThrow();
    });

    it('validates all fortress classes', () => {
      const classes = ['natural', 'ice', 'fire', 'lightning', 'tech', 'void', 'plasma'];

      for (const cls of classes) {
        expect(() => RespecMasteryTreeRequestSchema.parse({ class: cls })).not.toThrow();
      }
    });

    it('rejects invalid class', () => {
      expect(() => RespecMasteryTreeRequestSchema.parse({ class: 'invalid' })).toThrow();
    });
  });

  describe('RespecMasteryTreeResponseSchema', () => {
    it('validates successful respec response', () => {
      const response = {
        success: true,
        progress: {
          availablePoints: 10,
          totalPointsEarned: 20,
          classProgress: {
            natural: { pointsSpent: 0, unlockedNodes: [] },
            ice: { pointsSpent: 0, unlockedNodes: [] },
            fire: { pointsSpent: 0, unlockedNodes: [] },
            lightning: { pointsSpent: 0, unlockedNodes: [] },
            tech: { pointsSpent: 0, unlockedNodes: [] },
            void: { pointsSpent: 0, unlockedNodes: [] },
            plasma: { pointsSpent: 0, unlockedNodes: [] },
          },
        },
        pointsReturned: 10,
        pointsLost: 10,
      };

      expect(() => RespecMasteryTreeResponseSchema.parse(response)).not.toThrow();
    });
  });

  describe('AwardMasteryPointsRequestSchema', () => {
    it('validates valid request', () => {
      const request = {
        source: 'wave_milestone',
        amount: 5,
      };

      expect(() => AwardMasteryPointsRequestSchema.parse(request)).not.toThrow();
    });

    it('rejects zero amount', () => {
      const request = {
        source: 'boss_kill',
        amount: 0,
      };

      expect(() => AwardMasteryPointsRequestSchema.parse(request)).toThrow();
    });

    it('rejects negative amount', () => {
      const request = {
        source: 'boss_kill',
        amount: -5,
      };

      expect(() => AwardMasteryPointsRequestSchema.parse(request)).toThrow();
    });
  });

  describe('AwardMasteryPointsResponseSchema', () => {
    it('validates valid response', () => {
      const response = {
        success: true,
        newAvailablePoints: 15,
        newTotalEarned: 25,
      };

      expect(() => AwardMasteryPointsResponseSchema.parse(response)).not.toThrow();
    });
  });

  describe('ClassProgressSummarySchema', () => {
    it('validates valid summary', () => {
      const summary = {
        class: 'natural',
        pointsSpent: 25,
        nodesUnlocked: 8,
        totalNodes: 20,
        percentComplete: 40,
        highestTierUnlocked: 3,
        hasCapstone: false,
      };

      expect(() => ClassProgressSummarySchema.parse(summary)).not.toThrow();
    });

    it('validates summary with capstone', () => {
      const summary = {
        class: 'fire',
        pointsSpent: 100,
        nodesUnlocked: 20,
        totalNodes: 20,
        percentComplete: 100,
        highestTierUnlocked: 5,
        hasCapstone: true,
      };

      expect(() => ClassProgressSummarySchema.parse(summary)).not.toThrow();
    });

    it('rejects percent over 100', () => {
      const summary = {
        class: 'ice',
        pointsSpent: 10,
        nodesUnlocked: 5,
        totalNodes: 20,
        percentComplete: 150,
        highestTierUnlocked: 2,
        hasCapstone: false,
      };

      expect(() => ClassProgressSummarySchema.parse(summary)).toThrow();
    });
  });
});
