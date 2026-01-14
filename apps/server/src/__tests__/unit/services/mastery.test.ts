/**
 * Mastery service tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getMasteryProgress,
  unlockMasteryNode,
  respecMasteryTree,
  awardMasteryPoints,
  getClassProgressSummaries,
  getSessionMasteryModifiers,
} from '../../../services/mastery.js';
import { mockPrisma, createMockMasteryProgress } from '../../mocks/prisma.js';
import { createDefaultMasteryProgress } from '@arcade/sim-core';

// Mock sim-core mastery functions
vi.mock('@arcade/sim-core', async () => {
  const actual = await vi.importActual('@arcade/sim-core');
  return {
    ...actual,
    getMasteryNodeById: vi.fn((nodeId: string) => {
      // Return mock nodes for testing
      const nodes: Record<string, any> = {
        'natural_t1_hp1': {
          id: 'natural_t1_hp1',
          name: 'Natura HP I',
          class: 'natural',
          tier: 1,
          cost: 1,
          requires: [],
          effects: { modifiers: { hpBonus: 0.05 } },
        },
        'natural_t1_hp2': {
          id: 'natural_t1_hp2',
          name: 'Natura HP II',
          class: 'natural',
          tier: 1,
          cost: 2,
          requires: ['natural_t1_hp1'],
          effects: { modifiers: { hpBonus: 0.1 } },
        },
        'natural_t2_regen': {
          id: 'natural_t2_regen',
          name: 'Regeneracja',
          class: 'natural',
          tier: 2,
          cost: 3,
          requires: ['natural_t1_hp2'],
          effects: { modifiers: { hpRegen: 0.02 } },
        },
        'ice_t1_damage': {
          id: 'ice_t1_damage',
          name: 'Lód Obrażenia I',
          class: 'ice',
          tier: 1,
          cost: 1,
          requires: [],
          effects: { modifiers: { damageBonus: 0.05 } },
        },
        'fire_t1_capstone': {
          id: 'fire_t1_capstone',
          name: 'Płonące Ostrza',
          class: 'fire',
          tier: 5,
          type: 'capstone',
          cost: 10,
          requires: [],
          effects: {
            classPerk: { id: 'burning_blades', description: 'Ataki podpalają' },
          },
        },
      };
      return nodes[nodeId];
    }),
    getMasteryTree: vi.fn((classId: string) => {
      // Return different nodes based on class
      const treeNodes: Record<string, any[]> = {
        natural: [
          { id: 'natural_t1_hp1', name: 'HP I', tier: 1, type: 'stat_bonus', effects: { modifiers: { hpBonus: 0.05 } } },
          { id: 'natural_t1_hp2', name: 'HP II', tier: 1, type: 'stat_bonus', effects: { modifiers: { hpBonus: 0.1 } } },
          { id: 'natural_t2_regen', name: 'Regen', tier: 2, type: 'stat_bonus', effects: { modifiers: { hpRegen: 0.02 } } },
        ],
        ice: [
          { id: 'ice_t1_damage', name: 'Damage I', tier: 1, type: 'stat_bonus', effects: { modifiers: { damageBonus: 0.05 } } },
        ],
        fire: [
          { id: 'fire_t1_capstone', name: 'Burning Blades', tier: 5, type: 'capstone', effects: { classPerk: { id: 'burning_blades', description: 'Attacks set enemies on fire' } } },
        ],
        lightning: [],
        tech: [],
        void: [],
        plasma: [],
      };
      return {
        class: classId,
        name: `${classId} Tree`,
        description: `Mastery tree for ${classId}`,
        nodes: treeNodes[classId] || [],
        totalNodes: 20,
        maxPointsToComplete: 100,
      };
    }),
  };
});

describe('Mastery Service', () => {
  describe('getMasteryProgress', () => {
    it('returns existing progress if found', async () => {
      const mockProgress = createMockMasteryProgress();
      mockPrisma.masteryProgress.findUnique.mockResolvedValue(mockProgress);

      const result = await getMasteryProgress('user-123');

      expect(result.availablePoints).toBe(10);
      expect(result.totalPointsEarned).toBe(15);
      expect(result.classProgress.natural.pointsSpent).toBe(5);
    });

    it('creates default progress if none exists', async () => {
      mockPrisma.masteryProgress.findUnique.mockResolvedValue(null);
      mockPrisma.masteryProgress.create.mockResolvedValue({
        id: 'new-mastery-123',
        userId: 'user-123',
        availablePoints: 0,
        totalEarned: 0,
        classProgress: createDefaultMasteryProgress().classProgress,
        version: 1,
        updatedAt: new Date(),
      });

      const result = await getMasteryProgress('user-123');

      expect(result.availablePoints).toBe(0);
      expect(result.totalPointsEarned).toBe(0);
      expect(mockPrisma.masteryProgress.create).toHaveBeenCalled();
    });

    it('ensures all classes exist in progress', async () => {
      // Missing some classes in database
      mockPrisma.masteryProgress.findUnique.mockResolvedValue({
        id: 'mastery-123',
        userId: 'user-123',
        availablePoints: 5,
        totalEarned: 5,
        classProgress: {
          natural: { pointsSpent: 5, unlockedNodes: [] },
          // Missing other classes
        },
        version: 1,
        updatedAt: new Date(),
      });

      const result = await getMasteryProgress('user-123');

      // All classes should exist with defaults
      expect(result.classProgress.natural).toBeDefined();
      expect(result.classProgress.ice).toBeDefined();
      expect(result.classProgress.fire).toBeDefined();
      expect(result.classProgress.lightning).toBeDefined();
      expect(result.classProgress.tech).toBeDefined();
      expect(result.classProgress.void).toBeDefined();
      expect(result.classProgress.plasma).toBeDefined();
    });
  });

  describe('unlockMasteryNode', () => {
    beforeEach(() => {
      mockPrisma.masteryProgress.findUnique.mockResolvedValue(
        createMockMasteryProgress({
          availablePoints: 10,
          classProgress: {
            natural: { pointsSpent: 0, unlockedNodes: [] },
            ice: { pointsSpent: 0, unlockedNodes: [] },
            fire: { pointsSpent: 0, unlockedNodes: [] },
            lightning: { pointsSpent: 0, unlockedNodes: [] },
            tech: { pointsSpent: 0, unlockedNodes: [] },
            void: { pointsSpent: 0, unlockedNodes: [] },
            plasma: { pointsSpent: 0, unlockedNodes: [] },
          },
        })
      );
    });

    it('fails for non-existent node', async () => {
      const result = await unlockMasteryNode('user-123', 'invalid_node');

      expect(result.success).toBe(false);
      expect(result.message).toContain('nie istnieje');
    });

    it('fails if node already unlocked', async () => {
      mockPrisma.masteryProgress.findUnique.mockResolvedValue(
        createMockMasteryProgress({
          availablePoints: 10,
          classProgress: {
            natural: { pointsSpent: 1, unlockedNodes: ['natural_t1_hp1'] },
            ice: { pointsSpent: 0, unlockedNodes: [] },
            fire: { pointsSpent: 0, unlockedNodes: [] },
            lightning: { pointsSpent: 0, unlockedNodes: [] },
            tech: { pointsSpent: 0, unlockedNodes: [] },
            void: { pointsSpent: 0, unlockedNodes: [] },
            plasma: { pointsSpent: 0, unlockedNodes: [] },
          },
        })
      );

      const result = await unlockMasteryNode('user-123', 'natural_t1_hp1');

      expect(result.success).toBe(false);
      expect(result.message).toContain('odblokowane');
    });

    it('fails if not enough points', async () => {
      mockPrisma.masteryProgress.findUnique.mockResolvedValue(
        createMockMasteryProgress({
          availablePoints: 0,
          classProgress: {
            natural: { pointsSpent: 0, unlockedNodes: [] },
            ice: { pointsSpent: 0, unlockedNodes: [] },
            fire: { pointsSpent: 0, unlockedNodes: [] },
            lightning: { pointsSpent: 0, unlockedNodes: [] },
            tech: { pointsSpent: 0, unlockedNodes: [] },
            void: { pointsSpent: 0, unlockedNodes: [] },
            plasma: { pointsSpent: 0, unlockedNodes: [] },
          },
        })
      );

      const result = await unlockMasteryNode('user-123', 'natural_t1_hp1');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Potrzebujesz');
    });

    it('fails if prerequisites not met', async () => {
      const result = await unlockMasteryNode('user-123', 'natural_t1_hp2');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Wymaga');
    });

    it('fails if tier requirements not met', async () => {
      // natural_t2_regen requires tier 2 (5 points spent)
      mockPrisma.masteryProgress.findUnique.mockResolvedValue(
        createMockMasteryProgress({
          availablePoints: 10,
          classProgress: {
            natural: { pointsSpent: 3, unlockedNodes: ['natural_t1_hp1', 'natural_t1_hp2'] },
            ice: { pointsSpent: 0, unlockedNodes: [] },
            fire: { pointsSpent: 0, unlockedNodes: [] },
            lightning: { pointsSpent: 0, unlockedNodes: [] },
            tech: { pointsSpent: 0, unlockedNodes: [] },
            void: { pointsSpent: 0, unlockedNodes: [] },
            plasma: { pointsSpent: 0, unlockedNodes: [] },
          },
        })
      );

      const result = await unlockMasteryNode('user-123', 'natural_t2_regen');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Tier');
    });

    it('successfully unlocks valid node', async () => {
      mockPrisma.masteryProgress.update.mockResolvedValue(
        createMockMasteryProgress({
          availablePoints: 9,
          classProgress: {
            natural: { pointsSpent: 1, unlockedNodes: ['natural_t1_hp1'] },
            ice: { pointsSpent: 0, unlockedNodes: [] },
            fire: { pointsSpent: 0, unlockedNodes: [] },
            lightning: { pointsSpent: 0, unlockedNodes: [] },
            tech: { pointsSpent: 0, unlockedNodes: [] },
            void: { pointsSpent: 0, unlockedNodes: [] },
            plasma: { pointsSpent: 0, unlockedNodes: [] },
          },
        })
      );

      const result = await unlockMasteryNode('user-123', 'natural_t1_hp1');

      expect(result.success).toBe(true);
      expect(mockPrisma.masteryProgress.update).toHaveBeenCalled();
    });

    it('deducts points and adds node on success', async () => {
      mockPrisma.masteryProgress.update.mockResolvedValue(
        createMockMasteryProgress({
          availablePoints: 9,
          classProgress: {
            natural: { pointsSpent: 1, unlockedNodes: ['natural_t1_hp1'] },
            ice: { pointsSpent: 0, unlockedNodes: [] },
            fire: { pointsSpent: 0, unlockedNodes: [] },
            lightning: { pointsSpent: 0, unlockedNodes: [] },
            tech: { pointsSpent: 0, unlockedNodes: [] },
            void: { pointsSpent: 0, unlockedNodes: [] },
            plasma: { pointsSpent: 0, unlockedNodes: [] },
          },
        })
      );

      const result = await unlockMasteryNode('user-123', 'natural_t1_hp1');

      expect(result.success).toBe(true);
      expect(result.progress.availablePoints).toBe(9);
      expect(result.progress.classProgress.natural.unlockedNodes).toContain('natural_t1_hp1');
    });
  });

  describe('respecMasteryTree', () => {
    it('fails if no points spent', async () => {
      mockPrisma.masteryProgress.findUnique.mockResolvedValue(
        createMockMasteryProgress({
          availablePoints: 10,
          classProgress: {
            natural: { pointsSpent: 0, unlockedNodes: [] },
            ice: { pointsSpent: 0, unlockedNodes: [] },
            fire: { pointsSpent: 0, unlockedNodes: [] },
            lightning: { pointsSpent: 0, unlockedNodes: [] },
            tech: { pointsSpent: 0, unlockedNodes: [] },
            void: { pointsSpent: 0, unlockedNodes: [] },
            plasma: { pointsSpent: 0, unlockedNodes: [] },
          },
        })
      );

      const result = await respecMasteryTree('user-123', 'natural');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Brak punktów');
      expect(result.pointsReturned).toBe(0);
    });

    it('applies respec penalty', async () => {
      mockPrisma.masteryProgress.findUnique.mockResolvedValue(
        createMockMasteryProgress({
          availablePoints: 5,
          classProgress: {
            natural: { pointsSpent: 10, unlockedNodes: ['node1', 'node2'] },
            ice: { pointsSpent: 0, unlockedNodes: [] },
            fire: { pointsSpent: 0, unlockedNodes: [] },
            lightning: { pointsSpent: 0, unlockedNodes: [] },
            tech: { pointsSpent: 0, unlockedNodes: [] },
            void: { pointsSpent: 0, unlockedNodes: [] },
            plasma: { pointsSpent: 0, unlockedNodes: [] },
          },
        })
      );

      mockPrisma.masteryProgress.update.mockResolvedValue(
        createMockMasteryProgress({
          availablePoints: 10, // 5 + 5 returned (50% of 10)
          classProgress: {
            natural: { pointsSpent: 0, unlockedNodes: [] },
            ice: { pointsSpent: 0, unlockedNodes: [] },
            fire: { pointsSpent: 0, unlockedNodes: [] },
            lightning: { pointsSpent: 0, unlockedNodes: [] },
            tech: { pointsSpent: 0, unlockedNodes: [] },
            void: { pointsSpent: 0, unlockedNodes: [] },
            plasma: { pointsSpent: 0, unlockedNodes: [] },
          },
        })
      );

      const result = await respecMasteryTree('user-123', 'natural');

      expect(result.success).toBe(true);
      // 50% penalty = 5 points returned from 10 spent
      expect(result.pointsReturned).toBe(5);
      expect(result.pointsLost).toBe(5);
    });

    it('resets class progress on success', async () => {
      mockPrisma.masteryProgress.findUnique.mockResolvedValue(
        createMockMasteryProgress({
          availablePoints: 0,
          classProgress: {
            natural: { pointsSpent: 20, unlockedNodes: ['a', 'b', 'c'] },
            ice: { pointsSpent: 0, unlockedNodes: [] },
            fire: { pointsSpent: 0, unlockedNodes: [] },
            lightning: { pointsSpent: 0, unlockedNodes: [] },
            tech: { pointsSpent: 0, unlockedNodes: [] },
            void: { pointsSpent: 0, unlockedNodes: [] },
            plasma: { pointsSpent: 0, unlockedNodes: [] },
          },
        })
      );

      mockPrisma.masteryProgress.update.mockResolvedValue(
        createMockMasteryProgress({
          availablePoints: 10,
          classProgress: {
            natural: { pointsSpent: 0, unlockedNodes: [] },
            ice: { pointsSpent: 0, unlockedNodes: [] },
            fire: { pointsSpent: 0, unlockedNodes: [] },
            lightning: { pointsSpent: 0, unlockedNodes: [] },
            tech: { pointsSpent: 0, unlockedNodes: [] },
            void: { pointsSpent: 0, unlockedNodes: [] },
            plasma: { pointsSpent: 0, unlockedNodes: [] },
          },
        })
      );

      const result = await respecMasteryTree('user-123', 'natural');

      expect(result.success).toBe(true);
      expect(result.progress.classProgress.natural.pointsSpent).toBe(0);
      expect(result.progress.classProgress.natural.unlockedNodes).toHaveLength(0);
    });
  });

  describe('awardMasteryPoints', () => {
    it('does nothing for zero or negative amount', async () => {
      mockPrisma.masteryProgress.findUnique.mockResolvedValue(
        createMockMasteryProgress({ availablePoints: 10, totalEarned: 10 })
      );

      const result = await awardMasteryPoints('user-123', 'test', 0);

      expect(result.success).toBe(false);
      expect(result.newAvailablePoints).toBe(10);
    });

    it('awards points successfully', async () => {
      mockPrisma.masteryProgress.findUnique.mockResolvedValue(
        createMockMasteryProgress({ availablePoints: 10, totalEarned: 10 })
      );
      mockPrisma.masteryProgress.update.mockResolvedValue({
        availablePoints: 15,
        totalEarned: 15,
      });

      const result = await awardMasteryPoints('user-123', 'wave_milestone', 5);

      expect(result.success).toBe(true);
      expect(result.newAvailablePoints).toBe(15);
      expect(result.newTotalEarned).toBe(15);
    });

    it('increments both available and total earned', async () => {
      mockPrisma.masteryProgress.findUnique.mockResolvedValue(
        createMockMasteryProgress()
      );
      mockPrisma.masteryProgress.update.mockResolvedValue({
        availablePoints: 13,
        totalEarned: 18,
      });

      await awardMasteryPoints('user-123', 'boss_kill', 3);

      const updateCall = mockPrisma.masteryProgress.update.mock.calls[0][0];
      expect(updateCall.data.availablePoints.increment).toBe(3);
      expect(updateCall.data.totalEarned.increment).toBe(3);
    });
  });

  describe('getClassProgressSummaries', () => {
    it('returns summaries for all classes', async () => {
      mockPrisma.masteryProgress.findUnique.mockResolvedValue(
        createMockMasteryProgress()
      );

      const result = await getClassProgressSummaries('user-123');

      expect(result.summaries).toHaveLength(7); // All 7 classes
      expect(result.summaries.map(s => s.class)).toContain('natural');
      expect(result.summaries.map(s => s.class)).toContain('ice');
      expect(result.summaries.map(s => s.class)).toContain('fire');
    });

    it('calculates total points spent', async () => {
      mockPrisma.masteryProgress.findUnique.mockResolvedValue(
        createMockMasteryProgress({
          classProgress: {
            natural: { pointsSpent: 10, unlockedNodes: [] },
            ice: { pointsSpent: 5, unlockedNodes: [] },
            fire: { pointsSpent: 0, unlockedNodes: [] },
            lightning: { pointsSpent: 0, unlockedNodes: [] },
            tech: { pointsSpent: 0, unlockedNodes: [] },
            void: { pointsSpent: 0, unlockedNodes: [] },
            plasma: { pointsSpent: 0, unlockedNodes: [] },
          },
        })
      );

      const result = await getClassProgressSummaries('user-123');

      expect(result.totalPointsSpent).toBe(15);
    });

    it('includes available points', async () => {
      mockPrisma.masteryProgress.findUnique.mockResolvedValue(
        createMockMasteryProgress({ availablePoints: 25 })
      );

      const result = await getClassProgressSummaries('user-123');

      expect(result.availablePoints).toBe(25);
    });
  });

  describe('getSessionMasteryModifiers', () => {
    it('returns empty modifiers for class with no progress', async () => {
      mockPrisma.masteryProgress.findUnique.mockResolvedValue(
        createMockMasteryProgress({
          classProgress: {
            natural: { pointsSpent: 0, unlockedNodes: [] },
            ice: { pointsSpent: 0, unlockedNodes: [] },
            fire: { pointsSpent: 0, unlockedNodes: [] },
            lightning: { pointsSpent: 0, unlockedNodes: [] },
            tech: { pointsSpent: 0, unlockedNodes: [] },
            void: { pointsSpent: 0, unlockedNodes: [] },
            plasma: { pointsSpent: 0, unlockedNodes: [] },
          },
        })
      );

      const result = await getSessionMasteryModifiers('user-123', 'natural');

      expect(result.statBonuses).toEqual({});
      expect(result.synergyAmplifiers.heroSynergyBonus).toBe(0);
      expect(result.activePerks).toHaveLength(0);
    });

    it('returns modifiers for unlocked nodes', async () => {
      mockPrisma.masteryProgress.findUnique.mockResolvedValue(
        createMockMasteryProgress({
          classProgress: {
            natural: { pointsSpent: 3, unlockedNodes: ['natural_t1_hp1', 'natural_t1_hp2'] },
            ice: { pointsSpent: 0, unlockedNodes: [] },
            fire: { pointsSpent: 0, unlockedNodes: [] },
            lightning: { pointsSpent: 0, unlockedNodes: [] },
            tech: { pointsSpent: 0, unlockedNodes: [] },
            void: { pointsSpent: 0, unlockedNodes: [] },
            plasma: { pointsSpent: 0, unlockedNodes: [] },
          },
        })
      );

      const result = await getSessionMasteryModifiers('user-123', 'natural');

      // HP bonuses from both nodes should be combined
      expect(result.statBonuses.hpBonus).toBeCloseTo(0.15); // 0.05 + 0.1
    });

    it('returns active perks from capstone nodes', async () => {
      mockPrisma.masteryProgress.findUnique.mockResolvedValue(
        createMockMasteryProgress({
          classProgress: {
            natural: { pointsSpent: 0, unlockedNodes: [] },
            ice: { pointsSpent: 0, unlockedNodes: [] },
            fire: { pointsSpent: 10, unlockedNodes: ['fire_t1_capstone'] },
            lightning: { pointsSpent: 0, unlockedNodes: [] },
            tech: { pointsSpent: 0, unlockedNodes: [] },
            void: { pointsSpent: 0, unlockedNodes: [] },
            plasma: { pointsSpent: 0, unlockedNodes: [] },
          },
        })
      );

      const result = await getSessionMasteryModifiers('user-123', 'fire');

      expect(result.activePerks).toContain('burning_blades');
    });

    it('only returns modifiers for the active class', async () => {
      mockPrisma.masteryProgress.findUnique.mockResolvedValue(
        createMockMasteryProgress({
          classProgress: {
            natural: { pointsSpent: 3, unlockedNodes: ['natural_t1_hp1'] },
            ice: { pointsSpent: 1, unlockedNodes: ['ice_t1_damage'] },
            fire: { pointsSpent: 0, unlockedNodes: [] },
            lightning: { pointsSpent: 0, unlockedNodes: [] },
            tech: { pointsSpent: 0, unlockedNodes: [] },
            void: { pointsSpent: 0, unlockedNodes: [] },
            plasma: { pointsSpent: 0, unlockedNodes: [] },
          },
        })
      );

      const result = await getSessionMasteryModifiers('user-123', 'ice');

      // Should only have ice modifiers
      expect(result.statBonuses.damageBonus).toBe(0.05);
      expect(result.statBonuses.hpBonus).toBeUndefined();
    });
  });
});
