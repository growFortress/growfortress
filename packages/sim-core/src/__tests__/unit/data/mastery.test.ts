/**
 * Mastery data tests
 */
import { describe, it, expect } from 'vitest';
import {
  createDefaultMasteryProgress,
  createEmptyMasteryModifiers,
  getPointsRequiredForTier,
  isTierUnlocked,
  canUnlockNode,
  calculateRespecReturn,
  MASTERY_ECONOMY,
  MASTERY_POINT_SOURCES,
  type MasteryNodeDefinition,
  type ClassMasteryProgress,
} from '../../../data/mastery.js';

describe('Mastery Data', () => {
  describe('createDefaultMasteryProgress', () => {
    it('returns progress with zero available points', () => {
      const progress = createDefaultMasteryProgress();
      expect(progress.availablePoints).toBe(0);
    });

    it('returns progress with zero total points earned', () => {
      const progress = createDefaultMasteryProgress();
      expect(progress.totalPointsEarned).toBe(0);
    });

    it('initializes all class progress to empty', () => {
      const progress = createDefaultMasteryProgress();
      const classes = ['natural', 'ice', 'fire', 'lightning', 'tech', 'void', 'plasma'] as const;

      for (const cls of classes) {
        expect(progress.classProgress[cls]).toBeDefined();
        expect(progress.classProgress[cls].pointsSpent).toBe(0);
        expect(progress.classProgress[cls].unlockedNodes).toEqual([]);
      }
    });

    it('includes updatedAt timestamp', () => {
      const progress = createDefaultMasteryProgress();
      expect(progress.updatedAt).toBeDefined();
      expect(() => new Date(progress.updatedAt)).not.toThrow();
    });
  });

  describe('createEmptyMasteryModifiers', () => {
    it('returns empty stat bonuses', () => {
      const modifiers = createEmptyMasteryModifiers();
      expect(modifiers.statBonuses).toEqual({});
    });

    it('returns zero synergy amplifiers', () => {
      const modifiers = createEmptyMasteryModifiers();
      expect(modifiers.synergyAmplifiers.heroSynergyBonus).toBe(0);
      expect(modifiers.synergyAmplifiers.turretSynergyBonus).toBe(0);
      expect(modifiers.synergyAmplifiers.fullSynergyBonus).toBe(0);
    });

    it('returns empty active perks', () => {
      const modifiers = createEmptyMasteryModifiers();
      expect(modifiers.activePerks).toEqual([]);
    });
  });

  describe('getPointsRequiredForTier', () => {
    it('returns 0 for tier 1', () => {
      expect(getPointsRequiredForTier(1)).toBe(0);
    });

    it('returns correct threshold for tier 2', () => {
      expect(getPointsRequiredForTier(2)).toBe(MASTERY_ECONOMY.TIER_THRESHOLDS.tier2);
    });

    it('returns correct threshold for tier 3', () => {
      expect(getPointsRequiredForTier(3)).toBe(MASTERY_ECONOMY.TIER_THRESHOLDS.tier3);
    });

    it('returns correct threshold for tier 4', () => {
      expect(getPointsRequiredForTier(4)).toBe(MASTERY_ECONOMY.TIER_THRESHOLDS.tier4);
    });

    it('returns correct threshold for tier 5', () => {
      expect(getPointsRequiredForTier(5)).toBe(MASTERY_ECONOMY.TIER_THRESHOLDS.tier5);
    });

    it('thresholds increase with each tier', () => {
      for (let tier = 2; tier <= 5; tier++) {
        const prevTier = (tier - 1) as 1 | 2 | 3 | 4 | 5;
        const currentTier = tier as 1 | 2 | 3 | 4 | 5;
        expect(getPointsRequiredForTier(currentTier)).toBeGreaterThan(
          getPointsRequiredForTier(prevTier)
        );
      }
    });
  });

  describe('isTierUnlocked', () => {
    it('tier 1 is always unlocked', () => {
      expect(isTierUnlocked(0, 1)).toBe(true);
    });

    it('tier 2 requires 5 points', () => {
      expect(isTierUnlocked(4, 2)).toBe(false);
      expect(isTierUnlocked(5, 2)).toBe(true);
    });

    it('tier 3 requires 15 points', () => {
      expect(isTierUnlocked(14, 3)).toBe(false);
      expect(isTierUnlocked(15, 3)).toBe(true);
    });

    it('tier 4 requires 35 points', () => {
      expect(isTierUnlocked(34, 4)).toBe(false);
      expect(isTierUnlocked(35, 4)).toBe(true);
    });

    it('tier 5 requires 60 points', () => {
      expect(isTierUnlocked(59, 5)).toBe(false);
      expect(isTierUnlocked(60, 5)).toBe(true);
    });
  });

  describe('canUnlockNode', () => {
    const createMockNode = (overrides: Partial<MasteryNodeDefinition> = {}): MasteryNodeDefinition => ({
      id: 'test_node',
      name: 'Test Node',
      description: 'A test node',
      class: 'natural',
      tier: 1,
      type: 'stat_bonus',
      cost: 2,
      requires: [],
      position: { x: 0, y: 0 },
      effects: {},
      icon: 'test',
      ...overrides,
    });

    const createMockProgress = (overrides: Partial<ClassMasteryProgress> = {}): ClassMasteryProgress => ({
      pointsSpent: 0,
      unlockedNodes: [],
      ...overrides,
    });

    it('returns false if node already unlocked', () => {
      const node = createMockNode({ id: 'already_unlocked' });
      const progress = createMockProgress({ unlockedNodes: ['already_unlocked'] });

      const result = canUnlockNode(node, progress, 10);

      expect(result.canUnlock).toBe(false);
      expect(result.reason).toContain('odblokowane');
    });

    it('returns false if not enough points', () => {
      const node = createMockNode({ cost: 5 });
      const progress = createMockProgress();

      const result = canUnlockNode(node, progress, 4);

      expect(result.canUnlock).toBe(false);
      expect(result.reason).toContain('Potrzebujesz');
    });

    it('returns false if tier not unlocked', () => {
      const node = createMockNode({ tier: 2, cost: 2 });
      const progress = createMockProgress({ pointsSpent: 4 }); // Need 5 for tier 2

      const result = canUnlockNode(node, progress, 10);

      expect(result.canUnlock).toBe(false);
      expect(result.reason).toContain('Tier');
    });

    it('returns false if prerequisites not met', () => {
      const node = createMockNode({ requires: ['prereq_node'] });
      const progress = createMockProgress();

      const result = canUnlockNode(node, progress, 10);

      expect(result.canUnlock).toBe(false);
      expect(result.reason).toContain('Wymagane');
    });

    it('returns true when all conditions met', () => {
      const node = createMockNode({ tier: 1, cost: 2 });
      const progress = createMockProgress();

      const result = canUnlockNode(node, progress, 10);

      expect(result.canUnlock).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('returns true with prerequisites met', () => {
      const node = createMockNode({ requires: ['prereq_node'] });
      const progress = createMockProgress({ unlockedNodes: ['prereq_node'] });

      const result = canUnlockNode(node, progress, 10);

      expect(result.canUnlock).toBe(true);
    });

    it('returns true for higher tier with enough points spent', () => {
      const node = createMockNode({ tier: 3, cost: 4 });
      const progress = createMockProgress({ pointsSpent: 15 }); // Exactly at threshold

      const result = canUnlockNode(node, progress, 10);

      expect(result.canUnlock).toBe(true);
    });
  });

  describe('calculateRespecReturn', () => {
    it('returns 50% of points spent (rounded down)', () => {
      expect(calculateRespecReturn(10)).toBe(5);
      expect(calculateRespecReturn(11)).toBe(5);
      expect(calculateRespecReturn(20)).toBe(10);
    });

    it('returns at least 1 point if points were spent', () => {
      expect(calculateRespecReturn(1)).toBe(1);
      expect(calculateRespecReturn(2)).toBe(1);
    });

    it('returns 0 for 0 points spent', () => {
      expect(calculateRespecReturn(0)).toBe(0);
    });

    it('applies 50% penalty correctly', () => {
      const penalty = MASTERY_ECONOMY.RESPEC_PENALTY;
      expect(penalty).toBe(0.5);

      // 100 points * (1 - 0.5) = 50
      expect(calculateRespecReturn(100)).toBe(50);
    });
  });

  describe('MASTERY_ECONOMY', () => {
    it('has reasonable max points estimate', () => {
      expect(MASTERY_ECONOMY.ESTIMATED_MAX_POINTS).toBeGreaterThan(0);
      expect(MASTERY_ECONOMY.ESTIMATED_MAX_POINTS).toBeLessThanOrEqual(500);
    });

    it('has positive points per tree full', () => {
      expect(MASTERY_ECONOMY.POINTS_PER_TREE_FULL).toBeGreaterThan(0);
    });

    it('has increasing tier thresholds', () => {
      expect(MASTERY_ECONOMY.TIER_THRESHOLDS.tier2).toBeLessThan(
        MASTERY_ECONOMY.TIER_THRESHOLDS.tier3
      );
      expect(MASTERY_ECONOMY.TIER_THRESHOLDS.tier3).toBeLessThan(
        MASTERY_ECONOMY.TIER_THRESHOLDS.tier4
      );
      expect(MASTERY_ECONOMY.TIER_THRESHOLDS.tier4).toBeLessThan(
        MASTERY_ECONOMY.TIER_THRESHOLDS.tier5
      );
    });

    it('has increasing node costs', () => {
      expect(MASTERY_ECONOMY.NODE_COSTS.tier1).toBeLessThan(
        MASTERY_ECONOMY.NODE_COSTS.tier2
      );
      expect(MASTERY_ECONOMY.NODE_COSTS.tier2).toBeLessThan(
        MASTERY_ECONOMY.NODE_COSTS.tier3
      );
      expect(MASTERY_ECONOMY.NODE_COSTS.tier3).toBeLessThan(
        MASTERY_ECONOMY.NODE_COSTS.tier4
      );
      expect(MASTERY_ECONOMY.NODE_COSTS.tier4).toBeLessThan(
        MASTERY_ECONOMY.NODE_COSTS.tier5
      );
    });

    it('has respec penalty between 0 and 1', () => {
      expect(MASTERY_ECONOMY.RESPEC_PENALTY).toBeGreaterThan(0);
      expect(MASTERY_ECONOMY.RESPEC_PENALTY).toBeLessThan(1);
    });

    it('has positive minimum respec return', () => {
      expect(MASTERY_ECONOMY.MIN_RESPEC_RETURN).toBeGreaterThan(0);
    });
  });

  describe('MASTERY_POINT_SOURCES', () => {
    it('has defined point sources', () => {
      expect(MASTERY_POINT_SOURCES.length).toBeGreaterThan(0);
    });

    it('all sources have positive points awarded', () => {
      for (const source of MASTERY_POINT_SOURCES) {
        expect(source.pointsAwarded).toBeGreaterThan(0);
      }
    });

    it('all sources have valid conditions', () => {
      const validConditions = [
        'wave_milestone',
        'boss_kill',
        'class_usage',
        'achievement',
        'weekly_challenge',
        'guild_activity',
      ];

      for (const source of MASTERY_POINT_SOURCES) {
        expect(validConditions).toContain(source.condition);
      }
    });

    it('has wave milestone sources', () => {
      const waveSources = MASTERY_POINT_SOURCES.filter(
        (s) => s.condition === 'wave_milestone'
      );
      expect(waveSources.length).toBeGreaterThan(0);
    });

    it('wave milestones have increasing thresholds', () => {
      const waveSources = MASTERY_POINT_SOURCES.filter(
        (s) => s.condition === 'wave_milestone' && s.threshold
      ).sort((a, b) => (a.threshold ?? 0) - (b.threshold ?? 0));

      for (let i = 1; i < waveSources.length; i++) {
        expect(waveSources[i].threshold).toBeGreaterThan(waveSources[i - 1].threshold!);
      }
    });
  });
});
