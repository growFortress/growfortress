/**
 * Fortress Progression System Tests
 * Tests for XP calculation, level progression, and rewards
 */
import { describe, it, expect } from 'vitest';
import {
  getXpForLevel,
  getTotalXpForLevel,
  getLevelFromTotalXp,
  getFortressLevelForXp,
  getXpToNextLevel,
  calculateEnemyKillXp,
  calculateWaveCompleteXp,
  calculateBossKillXp,
  calculatePillarCompleteXp,
  getMaxHeroSlots,
  getMaxTurretSlots,
  getUnlockedSkills,
  isPillarUnlockedAtLevel,
  checkLevelUp,
  getProgressionBonuses,
  calculateTotalHpBonus,
  calculateTotalDamageBonus,
  FORTRESS_LEVELS,
  MAX_FORTRESS_LEVEL,
  XP_SOURCES,
} from '../../../data/fortress-progression.js';

describe('XP Calculation Functions', () => {
  describe('getXpForLevel', () => {
    it('returns correct XP for levels 1-10 (linear scaling)', () => {
      expect(getXpForLevel(1)).toBe(200);
      expect(getXpForLevel(5)).toBe(1000);
      expect(getXpForLevel(10)).toBe(2000);
    });

    it('returns correct XP for levels 11-30 (quadratic scaling)', () => {
      expect(getXpForLevel(11)).toBe(11 * 11 * 18); // 2178
      expect(getXpForLevel(20)).toBe(20 * 20 * 18); // 7200
      expect(getXpForLevel(30)).toBe(30 * 30 * 18); // 16200
    });

    it('returns correct XP for levels 31-50 (higher quadratic)', () => {
      expect(getXpForLevel(31)).toBe(31 * 31 * 40); // 38440
      expect(getXpForLevel(40)).toBe(40 * 40 * 40); // 64000
      expect(getXpForLevel(50)).toBe(50 * 50 * 40); // 100000
    });

    it('returns correct XP for levels 51+ (linear post-cap)', () => {
      expect(getXpForLevel(51)).toBe(100000 + (51 - 50) * 8000); // 108000
      expect(getXpForLevel(60)).toBe(100000 + (60 - 50) * 8000); // 180000
    });

    it('XP requirements increase with level', () => {
      for (let level = 1; level < 60; level++) {
        expect(getXpForLevel(level + 1)).toBeGreaterThanOrEqual(getXpForLevel(level));
      }
    });
  });

  describe('getTotalXpForLevel', () => {
    it('returns 0 for level 1', () => {
      expect(getTotalXpForLevel(1)).toBe(0);
    });

    it('returns cumulative XP for higher levels', () => {
      // Level 2 needs XP from level 1
      expect(getTotalXpForLevel(2)).toBe(getXpForLevel(1));

      // Level 3 needs XP from levels 1 and 2
      expect(getTotalXpForLevel(3)).toBe(getXpForLevel(1) + getXpForLevel(2));
    });

    it('matches sum of all previous levels', () => {
      let expectedTotal = 0;
      for (let level = 1; level <= 10; level++) {
        expect(getTotalXpForLevel(level)).toBe(expectedTotal);
        expectedTotal += getXpForLevel(level);
      }
    });
  });

  describe('getLevelFromTotalXp', () => {
    it('returns level 1 for 0 XP', () => {
      const result = getLevelFromTotalXp(0);
      expect(result.level).toBe(1);
      expect(result.xpInLevel).toBe(0);
    });

    it('returns correct level and remaining XP', () => {
      // At exactly the threshold for level 2
      const xpForLevel1 = getXpForLevel(1);
      const result = getLevelFromTotalXp(xpForLevel1);
      expect(result.level).toBe(2);
      expect(result.xpInLevel).toBe(0);
    });

    it('returns partial progress within level', () => {
      const xpForLevel1 = getXpForLevel(1);
      const result = getLevelFromTotalXp(xpForLevel1 + 50);
      expect(result.level).toBe(2);
      expect(result.xpInLevel).toBe(50);
    });

    it('handles high level calculations', () => {
      const totalXpForLevel10 = getTotalXpForLevel(10);
      const result = getLevelFromTotalXp(totalXpForLevel10);
      expect(result.level).toBe(10);
      expect(result.xpInLevel).toBe(0);
    });
  });

  describe('getFortressLevelForXp', () => {
    it('returns 1 for 0 XP', () => {
      expect(getFortressLevelForXp(0)).toBe(1);
    });

    it('returns correct level based on XP thresholds', () => {
      const xpForLevel5 = getTotalXpForLevel(5);
      expect(getFortressLevelForXp(xpForLevel5)).toBe(5);
      expect(getFortressLevelForXp(xpForLevel5 + 1)).toBe(5);
    });

    it('does not exceed max level', () => {
      expect(getFortressLevelForXp(999999999)).toBeLessThanOrEqual(MAX_FORTRESS_LEVEL);
    });
  });

  describe('getXpToNextLevel', () => {
    it('returns correct XP needed and progress for level 1', () => {
      const result = getXpToNextLevel(0);
      expect(result.xpNeeded).toBe(getXpForLevel(1));
      expect(result.progress).toBe(0);
    });

    it('calculates progress correctly', () => {
      const xpForLevel1 = getXpForLevel(1);
      const halfXp = Math.floor(xpForLevel1 / 2);
      const result = getXpToNextLevel(halfXp);

      // Progress should be around 50% (8192 in fixed point = 0.5 * 16384)
      expect(result.progress).toBeGreaterThan(0);
      expect(result.progress).toBeLessThan(16384);
    });

    it('returns full progress at max level', () => {
      const result = getXpToNextLevel(getTotalXpForLevel(MAX_FORTRESS_LEVEL) + getXpForLevel(MAX_FORTRESS_LEVEL));
      expect(result.progress).toBe(16384); // 100% in fixed point
    });
  });
});

describe('XP Earning Functions', () => {
  describe('calculateEnemyKillXp', () => {
    it('returns XP for regular enemy (may be 0 at low waves due to floor)', () => {
      // At wave 1: floor(0.75 + 1 * 0.075) = floor(0.825) = 0
      // At wave 10: floor(0.75 + 10 * 0.075) = floor(1.5) = 1
      const xpWave1 = calculateEnemyKillXp(1, false);
      const xpWave10 = calculateEnemyKillXp(10, false);
      expect(xpWave1).toBeGreaterThanOrEqual(0);
      expect(xpWave10).toBeGreaterThan(0);
    });

    it('returns more XP for elite enemies', () => {
      const regularXp = calculateEnemyKillXp(1, false);
      const eliteXp = calculateEnemyKillXp(1, true);
      expect(eliteXp).toBeGreaterThan(regularXp);
    });

    it('XP scales with wave number', () => {
      const wave1Xp = calculateEnemyKillXp(1, false);
      const wave10Xp = calculateEnemyKillXp(10, false);
      expect(wave10Xp).toBeGreaterThan(wave1Xp);
    });

    it('uses correct source configuration', () => {
      const source = XP_SOURCES.enemy_kill;
      const expectedXp = Math.floor(source.baseXp + (5 * (source.scaling?.perWave ?? 0)));
      expect(calculateEnemyKillXp(5, false)).toBe(expectedXp);
    });
  });

  describe('calculateWaveCompleteXp', () => {
    it('returns positive XP for completing a wave', () => {
      expect(calculateWaveCompleteXp(1)).toBeGreaterThan(0);
    });

    it('XP scales with wave number', () => {
      const wave1Xp = calculateWaveCompleteXp(1);
      const wave20Xp = calculateWaveCompleteXp(20);
      expect(wave20Xp).toBeGreaterThan(wave1Xp);
    });

    it('uses correct source configuration', () => {
      const source = XP_SOURCES.wave_complete;
      const expectedXp = Math.floor(source.baseXp + (10 * (source.scaling?.perWave ?? 0)));
      expect(calculateWaveCompleteXp(10)).toBe(expectedXp);
    });
  });

  describe('calculateBossKillXp', () => {
    it('returns significant XP for boss kill', () => {
      const bossXp = calculateBossKillXp(1);
      const regularXp = calculateEnemyKillXp(1, false);
      expect(bossXp).toBeGreaterThan(regularXp * 10);
    });

    it('XP scales with wave number', () => {
      const wave1Xp = calculateBossKillXp(1);
      const wave10Xp = calculateBossKillXp(10);
      expect(wave10Xp).toBeGreaterThan(wave1Xp);
    });
  });

  describe('calculatePillarCompleteXp', () => {
    it('returns more XP for first completion', () => {
      const firstXp = calculatePillarCompleteXp(true);
      const repeatXp = calculatePillarCompleteXp(false);
      expect(firstXp).toBeGreaterThan(repeatXp);
    });

    it('returns significant XP', () => {
      expect(calculatePillarCompleteXp(false)).toBeGreaterThan(100);
      expect(calculatePillarCompleteXp(true)).toBeGreaterThan(500);
    });
  });
});

describe('Level-Based Unlocks', () => {
  describe('getMaxHeroSlots', () => {
    it('returns 1 slot for levels 1-9', () => {
      expect(getMaxHeroSlots(1)).toBe(1);
      expect(getMaxHeroSlots(9)).toBe(1);
    });

    it('returns 2 slots for levels 10-29', () => {
      expect(getMaxHeroSlots(10)).toBe(2);
      expect(getMaxHeroSlots(29)).toBe(2);
    });

    it('returns 3 slots for levels 30-44', () => {
      expect(getMaxHeroSlots(30)).toBe(3);
      expect(getMaxHeroSlots(44)).toBe(3);
    });

    it('returns 4 slots for level 45+', () => {
      expect(getMaxHeroSlots(45)).toBe(4);
      expect(getMaxHeroSlots(50)).toBe(4);
      expect(getMaxHeroSlots(100)).toBe(4);
    });
  });

  describe('getMaxTurretSlots', () => {
    it('returns 1 slot for levels 1-4', () => {
      expect(getMaxTurretSlots(1)).toBe(1);
      expect(getMaxTurretSlots(4)).toBe(1);
    });

    it('returns 2 slots for levels 5-14', () => {
      expect(getMaxTurretSlots(5)).toBe(2);
      expect(getMaxTurretSlots(14)).toBe(2);
    });

    it('returns 6 slots for level 40+', () => {
      expect(getMaxTurretSlots(40)).toBe(6);
      expect(getMaxTurretSlots(50)).toBe(6);
    });
  });

  describe('getUnlockedSkills', () => {
    it('unlocks skill_1 at level 1', () => {
      expect(getUnlockedSkills(1)).toContain('skill_1');
    });

    it('unlocks skill_2 at level 5', () => {
      expect(getUnlockedSkills(4)).not.toContain('skill_2');
      expect(getUnlockedSkills(5)).toContain('skill_2');
    });

    it('unlocks skill_3 at level 10', () => {
      expect(getUnlockedSkills(9)).not.toContain('skill_3');
      expect(getUnlockedSkills(10)).toContain('skill_3');
    });

    it('unlocks skill_4 (ultimate) at level 20', () => {
      expect(getUnlockedSkills(19)).not.toContain('skill_4');
      expect(getUnlockedSkills(20)).toContain('skill_4');
    });

    it('returns all 4 skills at level 20+', () => {
      const skills = getUnlockedSkills(20);
      expect(skills).toHaveLength(4);
      expect(skills).toEqual(['skill_1', 'skill_2', 'skill_3', 'skill_4']);
    });
  });

  describe('isPillarUnlockedAtLevel (Pure Endless Mode)', () => {
    it('all pillars are always unlocked (Endless mode)', () => {
      // In Pure Endless mode, all pillars are always available
      const allPillars = ['streets', 'science', 'mutants', 'cosmos', 'magic', 'gods'] as const;
      for (const pillarId of allPillars) {
        expect(isPillarUnlockedAtLevel(pillarId, 1)).toBe(true);
        expect(isPillarUnlockedAtLevel(pillarId, 10)).toBe(true);
        expect(isPillarUnlockedAtLevel(pillarId, 50)).toBe(true);
      }
    });

    it('fortressLevel parameter is ignored (backward compatibility)', () => {
      // Level parameter doesn't matter in Endless mode
      expect(isPillarUnlockedAtLevel('gods', 1)).toBe(true);
      expect(isPillarUnlockedAtLevel('magic', 1)).toBe(true);
      expect(isPillarUnlockedAtLevel('cosmos', 1)).toBe(true);
    });

    it('returns false for invalid pillar ID', () => {
      expect(isPillarUnlockedAtLevel('invalid' as any, 50)).toBe(false);
    });
  });
});

describe('Level Up Detection', () => {
  describe('checkLevelUp', () => {
    it('detects no level up when XP is insufficient', () => {
      const result = checkLevelUp(0, 50);
      expect(result.leveledUp).toBe(false);
      expect(result.newLevel).toBe(1);
      expect(result.rewards).toHaveLength(0);
    });

    it('detects level up when XP crosses threshold', () => {
      const xpForLevel1 = getXpForLevel(1);
      const result = checkLevelUp(0, xpForLevel1);
      expect(result.leveledUp).toBe(true);
      expect(result.newLevel).toBe(2);
    });

    it('detects multiple level ups', () => {
      const xpForLevel1To5 = getTotalXpForLevel(5) + getXpForLevel(5);
      const result = checkLevelUp(0, xpForLevel1To5);
      expect(result.leveledUp).toBe(true);
      expect(result.newLevel).toBeGreaterThanOrEqual(5);
    });

    it('collects rewards from all levels gained', () => {
      // Level 5 has rewards
      const xpForLevel5 = getTotalXpForLevel(5) + getXpForLevel(5);
      const result = checkLevelUp(0, xpForLevel5);
      expect(result.rewards.length).toBeGreaterThan(0);
    });

    it('returns empty rewards when no level up', () => {
      const result = checkLevelUp(10, 20);
      expect(result.rewards).toHaveLength(0);
    });
  });
});

describe('Progression Bonuses', () => {
  describe('getProgressionBonuses', () => {
    it('returns base bonuses at level 1', () => {
      const bonuses = getProgressionBonuses(1);
      expect(bonuses.damageMultiplier).toBe(1);
      expect(bonuses.goldMultiplier).toBe(1);
      expect(bonuses.startingGold).toBe(0);
      expect(bonuses.maxHeroSlots).toBe(1);
      expect(bonuses.maxTurretSlots).toBe(1);
    });

    it('includes starting gold bonus at level 5', () => {
      const bonuses = getProgressionBonuses(5);
      expect(bonuses.startingGold).toBeGreaterThan(0);
    });

    it('includes gold bonus at level 30', () => {
      const bonuses = getProgressionBonuses(30);
      expect(bonuses.goldMultiplier).toBeGreaterThan(1);
    });

    it('provides post-50 bonuses', () => {
      const level50Bonuses = getProgressionBonuses(50);
      const level60Bonuses = getProgressionBonuses(60);

      expect(level60Bonuses.damageMultiplier).toBeGreaterThan(level50Bonuses.damageMultiplier);
      expect(level60Bonuses.goldMultiplier).toBeGreaterThan(level50Bonuses.goldMultiplier);
      expect(level60Bonuses.startingGold).toBeGreaterThan(level50Bonuses.startingGold);
    });

    it('returns all pillars unlocked at any level (Pure Endless mode)', () => {
      // In Pure Endless mode, all pillars are always unlocked
      const expectedPillars = ['streets', 'science', 'mutants', 'cosmos', 'magic', 'gods'];
      expect(getProgressionBonuses(1).unlockedPillars).toEqual(expectedPillars);
      expect(getProgressionBonuses(25).unlockedPillars).toEqual(expectedPillars);
      expect(getProgressionBonuses(50).unlockedPillars).toEqual(expectedPillars);
    });
  });

  describe('calculateTotalHpBonus', () => {
    it('returns base multiplier at level 1', () => {
      expect(calculateTotalHpBonus(1)).toBe(16384); // 1.0 in fixed point
    });

    it('increases with level', () => {
      const level1Bonus = calculateTotalHpBonus(1);
      const level10Bonus = calculateTotalHpBonus(10);
      expect(level10Bonus).toBeGreaterThanOrEqual(level1Bonus);
    });
  });

  describe('calculateTotalDamageBonus', () => {
    it('returns base multiplier at level 1', () => {
      expect(calculateTotalDamageBonus(1)).toBe(16384); // 1.0 in fixed point
    });

    it('increases with level', () => {
      const level1Bonus = calculateTotalDamageBonus(1);
      const level20Bonus = calculateTotalDamageBonus(20);
      expect(level20Bonus).toBeGreaterThanOrEqual(level1Bonus);
    });
  });
});

describe('FORTRESS_LEVELS data', () => {
  it('has correct number of levels', () => {
    expect(FORTRESS_LEVELS.length).toBe(MAX_FORTRESS_LEVEL);
  });

  it('levels are in order', () => {
    for (let i = 0; i < FORTRESS_LEVELS.length; i++) {
      expect(FORTRESS_LEVELS[i].level).toBe(i + 1);
    }
  });

  it('xpRequired is cumulative', () => {
    expect(FORTRESS_LEVELS[0].xpRequired).toBe(0);

    let expectedXp = 0;
    for (let i = 0; i < FORTRESS_LEVELS.length; i++) {
      expect(FORTRESS_LEVELS[i].xpRequired).toBe(expectedXp);
      expectedXp += FORTRESS_LEVELS[i].xpToNext;
    }
  });

  it('level 5 has skill unlock reward', () => {
    const level5 = FORTRESS_LEVELS.find(l => l.level === 5);
    expect(level5?.rewards.some(r => r.type === 'skill_unlock')).toBe(true);
  });

  it('level 10 has hero slot unlock', () => {
    const level10 = FORTRESS_LEVELS.find(l => l.level === 10);
    expect(level10?.rewards.some(r => r.type === 'hero_slot')).toBe(true);
  });

  it('level 50 has pillar unlocks', () => {
    const level50 = FORTRESS_LEVELS.find(l => l.level === 50);
    expect(level50?.rewards.some(r => r.type === 'pillar_unlock')).toBe(true);
  });
});
