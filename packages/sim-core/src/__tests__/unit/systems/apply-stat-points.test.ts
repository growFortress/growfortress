/**
 * Tests for Apply Stat Points System
 *
 * Verifies that free stat point allocations are correctly applied
 * to fortress and hero modifiers during simulation.
 */

import { describe, it, expect } from 'vitest';
import { DEFAULT_MODIFIERS } from '../../../data/relics.js';
import {
  applyFortressStatPointBonuses,
  applyAllStatPointBonuses,
  getHeroStatPointBonuses,
  hasAnyStatPointAllocations,
  calculateTotalStatPointsAllocated,
  type StatPointAllocationData,
} from '../../../systems/apply-stat-points.js';
import {
  FORTRESS_STAT_POINT_BONUSES,
  HERO_STAT_POINT_BONUSES,
} from '../../../data/stat-points-config.js';

describe('Apply Stat Points System', () => {
  describe('applyFortressStatPointBonuses', () => {
    it('should return unchanged modifiers when no allocations', () => {
      const base = { ...DEFAULT_MODIFIERS };
      const result = applyFortressStatPointBonuses(base, {});

      expect(result.maxHpBonus).toBe(base.maxHpBonus);
      expect(result.damageBonus).toBe(base.damageBonus);
      expect(result.incomingDamageReduction).toBe(base.incomingDamageReduction);
    });

    it('should apply HP bonus correctly', () => {
      const base = { ...DEFAULT_MODIFIERS };
      const allocations = { hp: 10 }; // 10 points

      const result = applyFortressStatPointBonuses(base, allocations);

      // HP config: 2% per point, so 10 points = 20% bonus = 0.2
      const hpConfig = FORTRESS_STAT_POINT_BONUSES.find(c => c.stat === 'hp');
      expect(hpConfig).toBeDefined();
      const expectedBonus = 10 * hpConfig!.bonusPerPoint;
      expect(result.maxHpBonus).toBeCloseTo(base.maxHpBonus + expectedBonus, 5);
    });

    it('should apply damage bonus correctly', () => {
      const base = { ...DEFAULT_MODIFIERS };
      const allocations = { damage: 20 }; // 20 points

      const result = applyFortressStatPointBonuses(base, allocations);

      const damageConfig = FORTRESS_STAT_POINT_BONUSES.find(c => c.stat === 'damage');
      expect(damageConfig).toBeDefined();
      const expectedBonus = 20 * damageConfig!.bonusPerPoint;
      expect(result.damageBonus).toBeCloseTo(base.damageBonus + expectedBonus, 5);
    });

    it('should apply armor bonus correctly', () => {
      const base = { ...DEFAULT_MODIFIERS };
      const allocations = { armor: 15 }; // 15 points

      const result = applyFortressStatPointBonuses(base, allocations);

      const armorConfig = FORTRESS_STAT_POINT_BONUSES.find(c => c.stat === 'armor');
      expect(armorConfig).toBeDefined();
      const expectedBonus = 15 * armorConfig!.bonusPerPoint;
      expect(result.incomingDamageReduction).toBeCloseTo(
        base.incomingDamageReduction + expectedBonus,
        5
      );
    });

    it('should stack additively with existing modifiers', () => {
      const base = { ...DEFAULT_MODIFIERS, damageBonus: 0.5 }; // 50% existing bonus
      const allocations = { damage: 10 };

      const result = applyFortressStatPointBonuses(base, allocations);

      const damageConfig = FORTRESS_STAT_POINT_BONUSES.find(c => c.stat === 'damage');
      const expectedBonus = 10 * damageConfig!.bonusPerPoint;
      expect(result.damageBonus).toBeCloseTo(0.5 + expectedBonus, 5);
    });

    it('should respect max point limits in bonus calculation', () => {
      const base = { ...DEFAULT_MODIFIERS };
      const hpConfig = FORTRESS_STAT_POINT_BONUSES.find(c => c.stat === 'hp');
      const maxPoints = hpConfig!.maxPoints;

      // Allocate more than max
      const allocations = { hp: maxPoints + 50 };

      const result = applyFortressStatPointBonuses(base, allocations);

      // Should cap at maxPoints worth of bonus
      const expectedBonus = maxPoints * hpConfig!.bonusPerPoint;
      expect(result.maxHpBonus).toBeCloseTo(base.maxHpBonus + expectedBonus, 5);
    });

    it('should apply multiple stat allocations simultaneously', () => {
      const base = { ...DEFAULT_MODIFIERS };
      const allocations = { hp: 10, damage: 15, armor: 5 };

      const result = applyFortressStatPointBonuses(base, allocations);

      const hpConfig = FORTRESS_STAT_POINT_BONUSES.find(c => c.stat === 'hp');
      const damageConfig = FORTRESS_STAT_POINT_BONUSES.find(c => c.stat === 'damage');
      const armorConfig = FORTRESS_STAT_POINT_BONUSES.find(c => c.stat === 'armor');

      expect(result.maxHpBonus).toBeCloseTo(
        base.maxHpBonus + 10 * hpConfig!.bonusPerPoint,
        5
      );
      expect(result.damageBonus).toBeCloseTo(
        base.damageBonus + 15 * damageConfig!.bonusPerPoint,
        5
      );
      expect(result.incomingDamageReduction).toBeCloseTo(
        base.incomingDamageReduction + 5 * armorConfig!.bonusPerPoint,
        5
      );
    });
  });

  describe('getHeroStatPointBonuses', () => {
    it('should return zero bonuses for non-allocated hero', () => {
      const heroAllocations: StatPointAllocationData['heroAllocations'] = [];

      const result = getHeroStatPointBonuses(heroAllocations, 'storm');

      expect(result.damageBonus).toBe(0);
      expect(result.attackSpeedBonus).toBe(0);
      expect(result.critChanceBonus).toBe(0);
    });

    it('should return correct bonuses for allocated hero', () => {
      const heroAllocations: StatPointAllocationData['heroAllocations'] = [
        {
          heroId: 'storm',
          allocations: { damage: 10, attackSpeed: 5, critChance: 3 },
        },
      ];

      const result = getHeroStatPointBonuses(heroAllocations, 'storm');

      const damageConfig = HERO_STAT_POINT_BONUSES.find(c => c.stat === 'damage');
      const attackSpeedConfig = HERO_STAT_POINT_BONUSES.find(c => c.stat === 'attackSpeed');
      const critConfig = HERO_STAT_POINT_BONUSES.find(c => c.stat === 'critChance');

      expect(result.damageBonus).toBeCloseTo(10 * damageConfig!.bonusPerPoint, 5);
      expect(result.attackSpeedBonus).toBeCloseTo(5 * attackSpeedConfig!.bonusPerPoint, 5);
      expect(result.critChanceBonus).toBeCloseTo(3 * critConfig!.bonusPerPoint, 5);
    });

    it('should return zero for different hero when only one is allocated', () => {
      const heroAllocations: StatPointAllocationData['heroAllocations'] = [
        {
          heroId: 'storm',
          allocations: { damage: 10 },
        },
      ];

      const result = getHeroStatPointBonuses(heroAllocations, 'vanguard');

      expect(result.damageBonus).toBe(0);
      expect(result.attackSpeedBonus).toBe(0);
      expect(result.critChanceBonus).toBe(0);
    });

    it('should handle multiple heroes with different allocations', () => {
      const heroAllocations: StatPointAllocationData['heroAllocations'] = [
        { heroId: 'storm', allocations: { damage: 10 } },
        { heroId: 'vanguard', allocations: { damage: 5, critChance: 2 } },
      ];

      const stormResult = getHeroStatPointBonuses(heroAllocations, 'storm');
      const vanguardResult = getHeroStatPointBonuses(heroAllocations, 'vanguard');

      const damageConfig = HERO_STAT_POINT_BONUSES.find(c => c.stat === 'damage');
      const critConfig = HERO_STAT_POINT_BONUSES.find(c => c.stat === 'critChance');

      expect(stormResult.damageBonus).toBeCloseTo(10 * damageConfig!.bonusPerPoint, 5);
      expect(vanguardResult.damageBonus).toBeCloseTo(5 * damageConfig!.bonusPerPoint, 5);
      expect(vanguardResult.critChanceBonus).toBeCloseTo(2 * critConfig!.bonusPerPoint, 5);
    });
  });

  describe('applyAllStatPointBonuses', () => {
    it('should return unchanged modifiers when no data provided', () => {
      const base = { ...DEFAULT_MODIFIERS };

      const result = applyAllStatPointBonuses(base, undefined);

      expect(result).toEqual(base);
    });

    it('should apply fortress allocations from data', () => {
      const base = { ...DEFAULT_MODIFIERS };
      const data: StatPointAllocationData = {
        fortressAllocations: { hp: 10, damage: 5 },
        heroAllocations: [],
      };

      const result = applyAllStatPointBonuses(base, data);

      const hpConfig = FORTRESS_STAT_POINT_BONUSES.find(c => c.stat === 'hp');
      const damageConfig = FORTRESS_STAT_POINT_BONUSES.find(c => c.stat === 'damage');

      expect(result.maxHpBonus).toBeCloseTo(
        base.maxHpBonus + 10 * hpConfig!.bonusPerPoint,
        5
      );
      expect(result.damageBonus).toBeCloseTo(
        base.damageBonus + 5 * damageConfig!.bonusPerPoint,
        5
      );
    });
  });

  describe('hasAnyStatPointAllocations', () => {
    it('should return false for empty allocations', () => {
      const data: StatPointAllocationData = {
        fortressAllocations: {},
        heroAllocations: [],
      };

      expect(hasAnyStatPointAllocations(data)).toBe(false);
    });

    it('should return true when fortress has allocations', () => {
      const data: StatPointAllocationData = {
        fortressAllocations: { hp: 5 },
        heroAllocations: [],
      };

      expect(hasAnyStatPointAllocations(data)).toBe(true);
    });

    it('should return true when hero has allocations', () => {
      const data: StatPointAllocationData = {
        fortressAllocations: {},
        heroAllocations: [{ heroId: 'storm', allocations: { damage: 3 } }],
      };

      expect(hasAnyStatPointAllocations(data)).toBe(true);
    });

    it('should return false when allocations are all zero', () => {
      const data: StatPointAllocationData = {
        fortressAllocations: { hp: 0, damage: 0 },
        heroAllocations: [{ heroId: 'storm', allocations: { damage: 0 } }],
      };

      expect(hasAnyStatPointAllocations(data)).toBe(false);
    });
  });

  describe('calculateTotalStatPointsAllocated', () => {
    it('should return zero for empty allocations', () => {
      const data: StatPointAllocationData = {
        fortressAllocations: {},
        heroAllocations: [],
      };

      const result = calculateTotalStatPointsAllocated(data);

      expect(result.fortressPoints).toBe(0);
      expect(result.heroPoints).toBe(0);
      expect(result.totalPoints).toBe(0);
    });

    it('should sum fortress points correctly', () => {
      const data: StatPointAllocationData = {
        fortressAllocations: { hp: 10, damage: 15, armor: 5 },
        heroAllocations: [],
      };

      const result = calculateTotalStatPointsAllocated(data);

      expect(result.fortressPoints).toBe(30);
      expect(result.heroPoints).toBe(0);
      expect(result.totalPoints).toBe(30);
    });

    it('should sum hero points correctly', () => {
      const data: StatPointAllocationData = {
        fortressAllocations: {},
        heroAllocations: [
          { heroId: 'storm', allocations: { damage: 10, attackSpeed: 5 } },
          { heroId: 'vanguard', allocations: { damage: 7 } },
        ],
      };

      const result = calculateTotalStatPointsAllocated(data);

      expect(result.fortressPoints).toBe(0);
      expect(result.heroPoints).toBe(22);
      expect(result.totalPoints).toBe(22);
    });

    it('should sum both fortress and hero points', () => {
      const data: StatPointAllocationData = {
        fortressAllocations: { hp: 20, damage: 10 },
        heroAllocations: [
          { heroId: 'storm', allocations: { damage: 15 } },
        ],
      };

      const result = calculateTotalStatPointsAllocated(data);

      expect(result.fortressPoints).toBe(30);
      expect(result.heroPoints).toBe(15);
      expect(result.totalPoints).toBe(45);
    });
  });
});
