/**
 * Power Config Tests
 */
import { describe, it, expect } from 'vitest';
import {
  FORTRESS_STAT_UPGRADES,
  HERO_STAT_UPGRADES,
  TURRET_STAT_UPGRADES,
  ITEM_TIER_CONFIG,
  getUpgradeCost,
  getStatMultiplier,
  getStatBonusPercent,
  getFortressStatConfig,
  getHeroStatConfig,
  getTurretStatConfig,
  getItemUpgradeCost,
  getTotalSpentOnStat,
  getAffordableLevels,
} from '../../../data/power-config.js';

describe('Power Config Constants', () => {
  describe('FORTRESS_STAT_UPGRADES', () => {
    it('has all expected stats (simplified)', () => {
      const stats = FORTRESS_STAT_UPGRADES.map(c => c.stat);
      expect(stats).toContain('hp');
      expect(stats).toContain('damage');
      expect(stats).toContain('armor');
      expect(stats).toHaveLength(3);
    });

    it('all configs have positive maxLevel', () => {
      for (const config of FORTRESS_STAT_UPGRADES) {
        expect(config.maxLevel).toBeGreaterThan(0);
      }
    });

    it('all configs have positive baseCost', () => {
      for (const config of FORTRESS_STAT_UPGRADES) {
        expect(config.baseCost).toBeGreaterThan(0);
      }
    });

    it('all configs have non-negative costPerLevel', () => {
      for (const config of FORTRESS_STAT_UPGRADES) {
        expect(config.costPerLevel).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('HERO_STAT_UPGRADES', () => {
    it('has expected stats for heroes (simplified)', () => {
      const stats = HERO_STAT_UPGRADES.map(c => c.stat);
      expect(stats).toContain('hp');
      expect(stats).toContain('damage');
      expect(stats).toHaveLength(2);
    });
  });

  describe('TURRET_STAT_UPGRADES', () => {
    it('has expected stats for turrets (simplified)', () => {
      const stats = TURRET_STAT_UPGRADES.map(c => c.stat);
      expect(stats).toContain('damage');
      expect(stats).toContain('attackSpeed');
      expect(stats).toHaveLength(2);
    });
  });

  describe('ITEM_TIER_CONFIG', () => {
    it('has all tiers defined', () => {
      expect(ITEM_TIER_CONFIG.common).toBeDefined();
      expect(ITEM_TIER_CONFIG.uncommon).toBeDefined();
      expect(ITEM_TIER_CONFIG.rare).toBeDefined();
      expect(ITEM_TIER_CONFIG.epic).toBeDefined();
      expect(ITEM_TIER_CONFIG.legendary).toBeDefined();
    });

    it('legendary has null upgradeCost (max tier)', () => {
      expect(ITEM_TIER_CONFIG.legendary.upgradeCost).toBeNull();
    });

    it('effect multipliers increase with tier', () => {
      expect(ITEM_TIER_CONFIG.uncommon.effectMultiplier).toBeGreaterThan(ITEM_TIER_CONFIG.common.effectMultiplier);
      expect(ITEM_TIER_CONFIG.rare.effectMultiplier).toBeGreaterThan(ITEM_TIER_CONFIG.uncommon.effectMultiplier);
      expect(ITEM_TIER_CONFIG.epic.effectMultiplier).toBeGreaterThan(ITEM_TIER_CONFIG.rare.effectMultiplier);
      expect(ITEM_TIER_CONFIG.legendary.effectMultiplier).toBeGreaterThan(ITEM_TIER_CONFIG.epic.effectMultiplier);
    });
  });
});

describe('getUpgradeCost', () => {
  const testConfig = {
    stat: 'hp' as const,
    name: 'Test',
    description: 'Test',
    bonusPerLevel: 0.05,
    maxLevel: 10,
    baseCost: 100,
    costPerLevel: 50,
  };

  it('returns baseCost at level 0', () => {
    const cost = getUpgradeCost(testConfig, 0);
    expect(cost).toBe(100);
  });

  it('returns baseCost + costPerLevel at level 1', () => {
    const cost = getUpgradeCost(testConfig, 1);
    expect(cost).toBe(150); // 100 + 1*50
  });

  it('calculates cost correctly at level 5', () => {
    const cost = getUpgradeCost(testConfig, 5);
    expect(cost).toBe(350); // 100 + 5*50
  });

  it('returns Infinity when at max level', () => {
    const cost = getUpgradeCost(testConfig, 10);
    expect(cost).toBe(Infinity);
  });

  it('returns Infinity when above max level', () => {
    const cost = getUpgradeCost(testConfig, 15);
    expect(cost).toBe(Infinity);
  });
});

describe('getStatMultiplier', () => {
  const testConfig = {
    stat: 'damage' as const,
    name: 'Test',
    description: 'Test',
    bonusPerLevel: 0.05, // +5% per level
    maxLevel: 10,
    baseCost: 100,
    costPerLevel: 50,
  };

  it('returns 1.0 at level 0', () => {
    const multiplier = getStatMultiplier(testConfig, 0);
    expect(multiplier).toBe(1.0);
  });

  it('returns 1.0 at negative level', () => {
    const multiplier = getStatMultiplier(testConfig, -1);
    expect(multiplier).toBe(1.0);
  });

  it('returns correct multiplier at level 1', () => {
    const multiplier = getStatMultiplier(testConfig, 1);
    expect(multiplier).toBeCloseTo(1.05, 5); // (1 + 0.05)^1
  });

  it('returns correct multiplier at level 10', () => {
    const multiplier = getStatMultiplier(testConfig, 10);
    // (1.05)^10 = 1.6288...
    expect(multiplier).toBeCloseTo(1.6288946, 5);
  });

  it('compounds multiplicatively', () => {
    const level5 = getStatMultiplier(testConfig, 5);
    const level10 = getStatMultiplier(testConfig, 10);
    // level10 should be approximately level5^2
    expect(level10).toBeCloseTo(level5 * level5, 5);
  });
});

describe('getStatBonusPercent', () => {
  const testConfig = {
    stat: 'hp' as const,
    name: 'Test',
    description: 'Test',
    bonusPerLevel: 0.03, // +3% per level
    maxLevel: 30,
    baseCost: 50,
    costPerLevel: 25,
  };

  it('returns 0 at level 0', () => {
    const bonus = getStatBonusPercent(testConfig, 0);
    expect(bonus).toBe(0);
  });

  it('returns positive bonus at level 1', () => {
    const bonus = getStatBonusPercent(testConfig, 1);
    // (1.03 - 1) * 100 = 3
    expect(bonus).toBeCloseTo(3, 1);
  });

  it('returns correct bonus at level 10', () => {
    const bonus = getStatBonusPercent(testConfig, 10);
    // (1.03^10 - 1) * 100 = 34.39%
    expect(bonus).toBeCloseTo(34.39, 1);
  });
});

describe('Stat Config Getters', () => {
  describe('getFortressStatConfig', () => {
    it('returns config for valid stat', () => {
      const config = getFortressStatConfig('hp');
      expect(config).toBeDefined();
      expect(config?.stat).toBe('hp');
    });

    it('returns undefined for invalid stat', () => {
      const config = getFortressStatConfig('range' as any);
      expect(config).toBeUndefined();
    });
  });

  describe('getHeroStatConfig', () => {
    it('returns config for valid stat', () => {
      const config = getHeroStatConfig('damage');
      expect(config).toBeDefined();
      expect(config?.stat).toBe('damage');
    });
  });

  describe('getTurretStatConfig', () => {
    it('returns config for valid stat', () => {
      const config = getTurretStatConfig('damage');
      expect(config).toBeDefined();
      expect(config?.stat).toBe('damage');
    });

    it('returns undefined for removed stat', () => {
      const config = getTurretStatConfig('range' as any);
      expect(config).toBeUndefined();
    });
  });
});

describe('getItemUpgradeCost', () => {
  it('returns cost for common tier', () => {
    const cost = getItemUpgradeCost('common');
    expect(cost).toBe(800); // rebalanced from 500
  });

  it('returns cost for epic tier', () => {
    const cost = getItemUpgradeCost('epic');
    expect(cost).toBe(8000); // rebalanced from 5000
  });

  it('returns null for legendary tier', () => {
    const cost = getItemUpgradeCost('legendary');
    expect(cost).toBeNull();
  });
});

describe('getTotalSpentOnStat', () => {
  const testConfig = {
    stat: 'hp' as const,
    name: 'Test',
    description: 'Test',
    bonusPerLevel: 0.05,
    maxLevel: 10,
    baseCost: 100,
    costPerLevel: 50,
  };

  it('returns 0 at level 0', () => {
    const total = getTotalSpentOnStat(testConfig, 0);
    expect(total).toBe(0);
  });

  it('returns baseCost at level 1', () => {
    const total = getTotalSpentOnStat(testConfig, 1);
    expect(total).toBe(100);
  });

  it('returns correct total at level 3', () => {
    const total = getTotalSpentOnStat(testConfig, 3);
    // Level 0->1: 100, Level 1->2: 150, Level 2->3: 200
    // Total: 100 + 150 + 200 = 450
    expect(total).toBe(450);
  });
});

describe('getAffordableLevels', () => {
  const testConfig = {
    stat: 'hp' as const,
    name: 'Test',
    description: 'Test',
    bonusPerLevel: 0.05,
    maxLevel: 10,
    baseCost: 100,
    costPerLevel: 50,
  };

  it('returns 0 with insufficient gold', () => {
    const levels = getAffordableLevels(testConfig, 0, 50);
    expect(levels).toBe(0);
  });

  it('returns 1 with exact gold for one upgrade', () => {
    const levels = getAffordableLevels(testConfig, 0, 100);
    expect(levels).toBe(1);
  });

  it('returns correct number with enough gold for multiple upgrades', () => {
    // From level 0: need 100, 150, 200 = 450 for 3 levels
    const levels = getAffordableLevels(testConfig, 0, 450);
    expect(levels).toBe(3);
  });

  it('does not exceed max level', () => {
    const levels = getAffordableLevels(testConfig, 8, 10000);
    expect(levels).toBe(2); // Can only go from 8 to 10
  });

  it('returns 0 when already at max level', () => {
    const levels = getAffordableLevels(testConfig, 10, 10000);
    expect(levels).toBe(0);
  });
});
