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
  getUnlockedClasses,
  isClassUnlockedAtLevel,
  getClassUnlockLevel,
  getUnlockedHeroes,
  isHeroUnlockedAtLevel,
  getHeroUnlockLevel,
  getUnlockedTurretTypes,
  isTurretUnlockedAtLevel,
  getTurretUnlockLevel,
  isPillarUnlockedAtLevel,
  getUnlockedPillarsAtLevel,
  getPillarUnlockLevel,
  PILLAR_LEVEL_REQUIREMENTS,
  checkLevelUp,
  getProgressionBonuses,
  calculateTotalHpBonus,
  calculateTotalDamageBonus,
  getRewardsForLevel,
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
    // Nowy system slotów - legacy fallback (bez purchasedSlots)
    it('returns 2 slots for level 1 (base)', () => {
      expect(getMaxHeroSlots(1)).toBe(2);
    });

    it('returns 3 slots for levels 2-4', () => {
      expect(getMaxHeroSlots(2)).toBe(3);
      expect(getMaxHeroSlots(4)).toBe(3);
    });

    it('returns 4 slots for levels 5-14', () => {
      expect(getMaxHeroSlots(5)).toBe(4);
      expect(getMaxHeroSlots(14)).toBe(4);
    });

    it('returns 5 slots for levels 15-24', () => {
      expect(getMaxHeroSlots(15)).toBe(5);
      expect(getMaxHeroSlots(24)).toBe(5);
    });

    it('returns 6 slots for levels 25-34', () => {
      expect(getMaxHeroSlots(25)).toBe(6);
      expect(getMaxHeroSlots(34)).toBe(6);
    });

    it('returns 7 slots for levels 35-49', () => {
      expect(getMaxHeroSlots(35)).toBe(7);
      expect(getMaxHeroSlots(49)).toBe(7);
    });

    it('returns 8 slots for level 50+', () => {
      expect(getMaxHeroSlots(50)).toBe(8);
      expect(getMaxHeroSlots(100)).toBe(8);
    });
  });

  describe('getMaxTurretSlots', () => {
    // Nowy system slotów - legacy fallback (bez purchasedSlots)
    it('returns 1 slot for levels 1-2 (base)', () => {
      expect(getMaxTurretSlots(1)).toBe(1);
      expect(getMaxTurretSlots(2)).toBe(1);
    });

    it('returns 2 slots for levels 3-4', () => {
      expect(getMaxTurretSlots(3)).toBe(2);
      expect(getMaxTurretSlots(4)).toBe(2);
    });

    it('returns 3 slots for levels 5-9', () => {
      expect(getMaxTurretSlots(5)).toBe(3);
      expect(getMaxTurretSlots(9)).toBe(3);
    });

    it('returns 4 slots for levels 10-19', () => {
      expect(getMaxTurretSlots(10)).toBe(4);
      expect(getMaxTurretSlots(19)).toBe(4);
    });

    it('returns 5 slots for levels 20-29', () => {
      expect(getMaxTurretSlots(20)).toBe(5);
      expect(getMaxTurretSlots(29)).toBe(5);
    });

    it('returns 6 slots for level 30+', () => {
      expect(getMaxTurretSlots(30)).toBe(6);
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

  describe('isPillarUnlockedAtLevel (Level-Gated)', () => {
    it('streets is always unlocked (level 1)', () => {
      expect(isPillarUnlockedAtLevel('streets', 1)).toBe(true);
      expect(isPillarUnlockedAtLevel('streets', 100)).toBe(true);
    });

    it('science requires level 15', () => {
      expect(isPillarUnlockedAtLevel('science', 14)).toBe(false);
      expect(isPillarUnlockedAtLevel('science', 15)).toBe(true);
      expect(isPillarUnlockedAtLevel('science', 16)).toBe(true);
    });

    it('mutants requires level 30', () => {
      expect(isPillarUnlockedAtLevel('mutants', 29)).toBe(false);
      expect(isPillarUnlockedAtLevel('mutants', 30)).toBe(true);
      expect(isPillarUnlockedAtLevel('mutants', 31)).toBe(true);
    });

    it('cosmos requires level 45', () => {
      expect(isPillarUnlockedAtLevel('cosmos', 44)).toBe(false);
      expect(isPillarUnlockedAtLevel('cosmos', 45)).toBe(true);
      expect(isPillarUnlockedAtLevel('cosmos', 46)).toBe(true);
    });

    it('magic requires level 60', () => {
      expect(isPillarUnlockedAtLevel('magic', 59)).toBe(false);
      expect(isPillarUnlockedAtLevel('magic', 60)).toBe(true);
      expect(isPillarUnlockedAtLevel('magic', 61)).toBe(true);
    });

    it('gods requires level 80', () => {
      expect(isPillarUnlockedAtLevel('gods', 79)).toBe(false);
      expect(isPillarUnlockedAtLevel('gods', 80)).toBe(true);
      expect(isPillarUnlockedAtLevel('gods', 81)).toBe(true);
    });

    it('returns false for invalid pillar ID', () => {
      expect(isPillarUnlockedAtLevel('invalid' as any, 100)).toBe(false);
    });
  });

  describe('getUnlockedPillarsAtLevel', () => {
    it('returns only streets at level 1', () => {
      expect(getUnlockedPillarsAtLevel(1)).toEqual(['streets']);
    });

    it('returns streets and science at level 15', () => {
      expect(getUnlockedPillarsAtLevel(15)).toEqual(['streets', 'science']);
    });

    it('returns 3 pillars at level 30', () => {
      const pillars = getUnlockedPillarsAtLevel(30);
      expect(pillars).toHaveLength(3);
      expect(pillars).toContain('streets');
      expect(pillars).toContain('science');
      expect(pillars).toContain('mutants');
    });

    it('returns 4 pillars at level 45', () => {
      const pillars = getUnlockedPillarsAtLevel(45);
      expect(pillars).toHaveLength(4);
      expect(pillars).toContain('cosmos');
    });

    it('returns 5 pillars at level 60', () => {
      const pillars = getUnlockedPillarsAtLevel(60);
      expect(pillars).toHaveLength(5);
      expect(pillars).toContain('magic');
    });

    it('returns all 6 pillars at level 80', () => {
      const pillars = getUnlockedPillarsAtLevel(80);
      expect(pillars).toHaveLength(6);
      expect(pillars).toContain('gods');
    });
  });

  describe('getPillarUnlockLevel', () => {
    it('returns correct unlock levels for all pillars', () => {
      expect(getPillarUnlockLevel('streets')).toBe(1);
      expect(getPillarUnlockLevel('science')).toBe(15);
      expect(getPillarUnlockLevel('mutants')).toBe(30);
      expect(getPillarUnlockLevel('cosmos')).toBe(45);
      expect(getPillarUnlockLevel('magic')).toBe(60);
      expect(getPillarUnlockLevel('gods')).toBe(80);
    });

    it('returns 999 for invalid pillar', () => {
      expect(getPillarUnlockLevel('invalid' as any)).toBe(999);
    });
  });

  describe('PILLAR_LEVEL_REQUIREMENTS', () => {
    it('has all 6 pillars defined', () => {
      expect(Object.keys(PILLAR_LEVEL_REQUIREMENTS)).toHaveLength(6);
    });

    it('has correct level requirements', () => {
      expect(PILLAR_LEVEL_REQUIREMENTS.streets).toBe(1);
      expect(PILLAR_LEVEL_REQUIREMENTS.science).toBe(15);
      expect(PILLAR_LEVEL_REQUIREMENTS.mutants).toBe(30);
      expect(PILLAR_LEVEL_REQUIREMENTS.cosmos).toBe(45);
      expect(PILLAR_LEVEL_REQUIREMENTS.magic).toBe(60);
      expect(PILLAR_LEVEL_REQUIREMENTS.gods).toBe(80);
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
      expect(bonuses.maxHeroSlots).toBe(2); // 2 slots at start (legacy fallback)
      expect(bonuses.maxTurretSlots).toBe(1); // 1 slot at start (legacy fallback)
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

    it('returns level-gated pillars', () => {
      // Level 1: only streets
      expect(getProgressionBonuses(1).unlockedPillars).toEqual(['streets']);
      // Level 15: streets + science
      expect(getProgressionBonuses(15).unlockedPillars).toHaveLength(2);
      // Level 30: +mutants
      expect(getProgressionBonuses(30).unlockedPillars).toHaveLength(3);
      // Level 80: all 6 pillars
      expect(getProgressionBonuses(80).unlockedPillars).toHaveLength(6);
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

  it('level 10 has hero unlock (forge)', () => {
    const level10 = FORTRESS_LEVELS.find(l => l.level === 10);
    expect(level10?.rewards.some(r => r.type === 'hero_unlock' && r.heroId === 'forge')).toBe(true);
  });

  it('level 15 has pillar unlock (science)', () => {
    const level15 = FORTRESS_LEVELS.find(l => l.level === 15);
    expect(level15?.rewards.some(r => r.type === 'pillar_unlock' && r.pillarId === 'science')).toBe(true);
  });

  it('level 80 has pillar unlock (gods)', () => {
    // Level 80 is beyond FORTRESS_LEVELS array, use getRewardsForLevel
    const rewards80 = getRewardsForLevel(80);
    expect(rewards80.some(r => r.type === 'pillar_unlock' && r.pillarId === 'gods')).toBe(true);
  });
});

// ============================================================================
// CLASS UNLOCK TESTS
// ============================================================================

describe('Class Unlocks', () => {
  describe('getUnlockedClasses', () => {
    it('returns only natural at level 1', () => {
      const classes = getUnlockedClasses(1);
      expect(classes).toEqual(['natural']);
    });

    it('does not include ice before level 20', () => {
      expect(getUnlockedClasses(19)).not.toContain('ice');
    });

    it('includes ice exactly at level 20', () => {
      expect(getUnlockedClasses(20)).toContain('ice');
    });

    it('includes ice at level 21', () => {
      expect(getUnlockedClasses(21)).toContain('ice');
    });

    it('includes fire exactly at level 40', () => {
      expect(getUnlockedClasses(39)).not.toContain('fire');
      expect(getUnlockedClasses(40)).toContain('fire');
    });

    it('includes lightning exactly at level 60', () => {
      expect(getUnlockedClasses(59)).not.toContain('lightning');
      expect(getUnlockedClasses(60)).toContain('lightning');
    });

    it('includes void exactly at level 80', () => {
      expect(getUnlockedClasses(79)).not.toContain('void');
      expect(getUnlockedClasses(80)).toContain('void');
    });

    it('includes tech exactly at level 100', () => {
      expect(getUnlockedClasses(99)).not.toContain('tech');
      expect(getUnlockedClasses(100)).toContain('tech');
    });

    it('returns all 6 classes at level 100', () => {
      const classes = getUnlockedClasses(100);
      expect(classes).toHaveLength(6);
      expect(classes).toContain('natural');
      expect(classes).toContain('ice');
      expect(classes).toContain('fire');
      expect(classes).toContain('lightning');
      expect(classes).toContain('void');
      expect(classes).toContain('tech');
    });

    it('natural is always first (starter kit)', () => {
      expect(getUnlockedClasses(1)[0]).toBe('natural');
      expect(getUnlockedClasses(100)[0]).toBe('natural');
    });
  });

  describe('isClassUnlockedAtLevel', () => {
    it('returns true for natural at any level', () => {
      expect(isClassUnlockedAtLevel('natural', 1)).toBe(true);
      expect(isClassUnlockedAtLevel('natural', 50)).toBe(true);
      expect(isClassUnlockedAtLevel('natural', 100)).toBe(true);
    });

    it('returns false for ice at level 19', () => {
      expect(isClassUnlockedAtLevel('ice', 19)).toBe(false);
    });

    it('returns true for ice at level 20', () => {
      expect(isClassUnlockedAtLevel('ice', 20)).toBe(true);
    });

    it('returns false for void at level 79', () => {
      expect(isClassUnlockedAtLevel('void', 79)).toBe(false);
    });

    it('returns true for void at level 80', () => {
      expect(isClassUnlockedAtLevel('void', 80)).toBe(true);
    });

    it('returns false for tech at level 99', () => {
      expect(isClassUnlockedAtLevel('tech', 99)).toBe(false);
    });

    it('returns true for tech at level 100', () => {
      expect(isClassUnlockedAtLevel('tech', 100)).toBe(true);
    });

    it('returns false for unknown class', () => {
      expect(isClassUnlockedAtLevel('unknown', 100)).toBe(false);
    });
  });

  describe('getClassUnlockLevel', () => {
    it('returns 1 for natural', () => {
      expect(getClassUnlockLevel('natural')).toBe(1);
    });

    it('returns 20 for ice', () => {
      expect(getClassUnlockLevel('ice')).toBe(20);
    });

    it('returns 40 for fire', () => {
      expect(getClassUnlockLevel('fire')).toBe(40);
    });

    it('returns 60 for lightning', () => {
      expect(getClassUnlockLevel('lightning')).toBe(60);
    });

    it('returns 80 for void', () => {
      expect(getClassUnlockLevel('void')).toBe(80);
    });

    it('returns 100 for tech', () => {
      expect(getClassUnlockLevel('tech')).toBe(100);
    });

    it('returns 999 for unknown class', () => {
      expect(getClassUnlockLevel('unknown')).toBe(999);
    });
  });
});

// ============================================================================
// HERO UNLOCK TESTS
// ============================================================================

describe('Hero Unlocks', () => {
  describe('getUnlockedHeroes', () => {
    it('returns starters and exclusive heroes at level 1', () => {
      const heroes = getUnlockedHeroes(1);
      // 4 starters
      expect(heroes).toContain('vanguard');
      expect(heroes).toContain('storm');
      expect(heroes).toContain('medic');
      expect(heroes).toContain('pyro');
      // 3 exclusive (available from level 1 at premium cost)
      expect(heroes).toContain('spectre'); // Exclusive rare
      expect(heroes).toContain('omega');   // Exclusive legendary
      expect(heroes).toContain('scout');   // Early game hero
      expect(heroes).toHaveLength(7);
    });

    it('includes forge at level 10', () => {
      expect(getUnlockedHeroes(9)).not.toContain('forge');
      expect(getUnlockedHeroes(10)).toContain('forge');
    });

    it('includes frost at level 20', () => {
      expect(getUnlockedHeroes(19)).not.toContain('frost');
      expect(getUnlockedHeroes(20)).toContain('frost');
    });

    it('includes rift at level 30', () => {
      expect(getUnlockedHeroes(29)).not.toContain('rift');
      expect(getUnlockedHeroes(30)).toContain('rift');
    });

    it('includes titan at level 40', () => {
      expect(getUnlockedHeroes(39)).not.toContain('titan');
      expect(getUnlockedHeroes(40)).toContain('titan');
    });

    it('returns all 11 heroes at level 50', () => {
      const heroes = getUnlockedHeroes(50);
      expect(heroes).toHaveLength(11);
      // 4 starters
      expect(heroes).toContain('vanguard');
      expect(heroes).toContain('storm');
      expect(heroes).toContain('medic');
      expect(heroes).toContain('pyro');
      // 3 exclusive
      expect(heroes).toContain('spectre');
      expect(heroes).toContain('omega');
      expect(heroes).toContain('scout');
      // 4 level-gated
      expect(heroes).toContain('forge');
      expect(heroes).toContain('frost');
      expect(heroes).toContain('rift');
      expect(heroes).toContain('titan');
    });

    it('vanguard is always first (starter kit)', () => {
      expect(getUnlockedHeroes(1)[0]).toBe('vanguard');
      expect(getUnlockedHeroes(50)[0]).toBe('vanguard');
    });
  });

  describe('isHeroUnlockedAtLevel', () => {
    it('returns true for vanguard at any level', () => {
      expect(isHeroUnlockedAtLevel('vanguard', 1)).toBe(true);
      expect(isHeroUnlockedAtLevel('vanguard', 100)).toBe(true);
    });

    it('returns true for storm at any level (starter hero)', () => {
      expect(isHeroUnlockedAtLevel('storm', 1)).toBe(true);
      expect(isHeroUnlockedAtLevel('storm', 100)).toBe(true);
    });

    it('returns true for medic at any level (starter hero)', () => {
      expect(isHeroUnlockedAtLevel('medic', 1)).toBe(true);
      expect(isHeroUnlockedAtLevel('medic', 100)).toBe(true);
    });

    it('returns true for pyro at any level (starter hero)', () => {
      expect(isHeroUnlockedAtLevel('pyro', 1)).toBe(true);
      expect(isHeroUnlockedAtLevel('pyro', 100)).toBe(true);
    });

    it('returns false for unknown hero', () => {
      expect(isHeroUnlockedAtLevel('unknown_hero', 100)).toBe(false);
    });
  });

  describe('getHeroUnlockLevel', () => {
    it('returns 1 for vanguard', () => {
      expect(getHeroUnlockLevel('vanguard')).toBe(1);
    });

    it('returns 1 for storm (starter hero)', () => {
      expect(getHeroUnlockLevel('storm')).toBe(1);
    });

    it('returns 1 for medic (starter hero)', () => {
      expect(getHeroUnlockLevel('medic')).toBe(1);
    });

    it('returns 1 for pyro (starter hero)', () => {
      expect(getHeroUnlockLevel('pyro')).toBe(1);
    });

    it('returns 10 for forge', () => {
      expect(getHeroUnlockLevel('forge')).toBe(10);
    });

    it('returns 20 for frost', () => {
      expect(getHeroUnlockLevel('frost')).toBe(20);
    });

    it('returns 30 for rift', () => {
      expect(getHeroUnlockLevel('rift')).toBe(30);
    });

    it('returns 40 for titan', () => {
      expect(getHeroUnlockLevel('titan')).toBe(40);
    });

    it('returns 99 for unknown hero', () => {
      expect(getHeroUnlockLevel('unknown_hero')).toBe(99);
    });
  });
});

// ============================================================================
// TURRET UNLOCK TESTS
// ============================================================================

describe('Turret Unlocks', () => {
  describe('getUnlockedTurretTypes', () => {
    it('returns only railgun at level 1', () => {
      const turrets = getUnlockedTurretTypes(1);
      expect(turrets).toEqual(['railgun']);
    });

    it('includes cryo at level 5', () => {
      expect(getUnlockedTurretTypes(4)).not.toContain('cryo');
      expect(getUnlockedTurretTypes(5)).toContain('cryo');
    });

    it('includes cannon at level 15', () => {
      expect(getUnlockedTurretTypes(14)).not.toContain('cannon');
      expect(getUnlockedTurretTypes(15)).toContain('cannon');
    });

    it('includes arc at level 30', () => {
      expect(getUnlockedTurretTypes(29)).not.toContain('arc');
      expect(getUnlockedTurretTypes(30)).toContain('arc');
    });

    it('includes laser at level 45', () => {
      expect(getUnlockedTurretTypes(44)).not.toContain('laser');
      expect(getUnlockedTurretTypes(45)).toContain('laser');
    });

    it('returns all 5 turrets at level 50', () => {
      const turrets = getUnlockedTurretTypes(50);
      expect(turrets).toHaveLength(5);
      expect(turrets).toContain('railgun');
      expect(turrets).toContain('cryo');
      expect(turrets).toContain('cannon');
      expect(turrets).toContain('arc');
      expect(turrets).toContain('laser');
    });

    it('railgun is always first (starter kit)', () => {
      expect(getUnlockedTurretTypes(1)[0]).toBe('railgun');
      expect(getUnlockedTurretTypes(50)[0]).toBe('railgun');
    });
  });

  describe('isTurretUnlockedAtLevel', () => {
    it('returns true for railgun at any level', () => {
      expect(isTurretUnlockedAtLevel('railgun', 1)).toBe(true);
      expect(isTurretUnlockedAtLevel('railgun', 100)).toBe(true);
    });

    it('returns false for cryo at level 4', () => {
      expect(isTurretUnlockedAtLevel('cryo', 4)).toBe(false);
    });

    it('returns true for cryo at level 5', () => {
      expect(isTurretUnlockedAtLevel('cryo', 5)).toBe(true);
    });

    it('returns false for unknown turret', () => {
      expect(isTurretUnlockedAtLevel('unknown_turret', 100)).toBe(false);
    });
  });

  describe('getTurretUnlockLevel', () => {
    it('returns 1 for railgun', () => {
      expect(getTurretUnlockLevel('railgun')).toBe(1);
    });

    it('returns 5 for cryo', () => {
      expect(getTurretUnlockLevel('cryo')).toBe(5);
    });

    it('returns 15 for cannon', () => {
      expect(getTurretUnlockLevel('cannon')).toBe(15);
    });

    it('returns 30 for arc', () => {
      expect(getTurretUnlockLevel('arc')).toBe(30);
    });

    it('returns 45 for laser', () => {
      expect(getTurretUnlockLevel('laser')).toBe(45);
    });

    it('returns 99 for unknown turret', () => {
      expect(getTurretUnlockLevel('unknown_turret')).toBe(99);
    });
  });
});

// ============================================================================
// SLOT EDGE CASES TESTS
// ============================================================================

describe('Slot Edge Cases', () => {
  describe('getMaxHeroSlots - Edge Cases', () => {
    it('returns 2 slots at level 1 (base)', () => {
      expect(getMaxHeroSlots(1)).toBe(2);
    });

    it('returns 3 slots at level 2 (first upgrade)', () => {
      expect(getMaxHeroSlots(2)).toBe(3);
    });

    it('returns 4 slots at level 5', () => {
      expect(getMaxHeroSlots(5)).toBe(4);
    });

    it('returns 6 slots at level 25', () => {
      expect(getMaxHeroSlots(25)).toBe(6);
    });

    it('returns 7 slots at level 35', () => {
      expect(getMaxHeroSlots(35)).toBe(7);
    });

    it('returns 8 slots at level 50 (MAX)', () => {
      expect(getMaxHeroSlots(50)).toBe(8);
    });

    it('returns 8 slots at level 100 (caps at MAX)', () => {
      expect(getMaxHeroSlots(100)).toBe(8);
    });

    it('slot count never decreases with level', () => {
      let previousSlots = 0;
      for (let level = 1; level <= 100; level++) {
        const currentSlots = getMaxHeroSlots(level);
        expect(currentSlots).toBeGreaterThanOrEqual(previousSlots);
        previousSlots = currentSlots;
      }
    });
  });

  describe('getMaxTurretSlots - Edge Cases', () => {
    it('returns 1 slot at level 1', () => {
      expect(getMaxTurretSlots(1)).toBe(1);
    });

    it('returns 2 slots at level 3', () => {
      expect(getMaxTurretSlots(3)).toBe(2);
    });

    it('returns 3 slots at level 5', () => {
      expect(getMaxTurretSlots(5)).toBe(3);
    });

    it('returns 4 slots at level 10', () => {
      expect(getMaxTurretSlots(10)).toBe(4);
    });

    it('returns 5 slots at level 20', () => {
      expect(getMaxTurretSlots(20)).toBe(5);
    });

    it('returns 6 slots at level 30 (MAX)', () => {
      expect(getMaxTurretSlots(30)).toBe(6);
    });

    it('returns 6 slots at level 100 (caps at MAX)', () => {
      expect(getMaxTurretSlots(100)).toBe(6);
    });

    it('slot count never decreases with level', () => {
      let previousSlots = 0;
      for (let level = 1; level <= 100; level++) {
        const currentSlots = getMaxTurretSlots(level);
        expect(currentSlots).toBeGreaterThanOrEqual(previousSlots);
        previousSlots = currentSlots;
      }
    });
  });
});

// ============================================================================
// REWARDS CONSISTENCY TESTS
// ============================================================================

describe('Rewards Consistency', () => {
  it('class unlock rewards match unlock functions', () => {
    // Classes unlocked within FORTRESS_LEVELS (1-50)
    const level20 = FORTRESS_LEVELS.find(l => l.level === 20);
    const iceReward = level20?.rewards.find(r => r.type === 'class_unlock' && r.classId === 'ice');
    expect(iceReward).toBeDefined();
    expect(getClassUnlockLevel('ice')).toBe(20);

    const level40 = FORTRESS_LEVELS.find(l => l.level === 40);
    const fireReward = level40?.rewards.find(r => r.type === 'class_unlock' && r.classId === 'fire');
    expect(fireReward).toBeDefined();
    expect(getClassUnlockLevel('fire')).toBe(40);

    // Classes unlocked beyond level 50 (use getRewardsForLevel directly)
    const rewards60 = getRewardsForLevel(60);
    const lightningReward = rewards60.find(r => r.type === 'class_unlock' && r.classId === 'lightning');
    expect(lightningReward).toBeDefined();
    expect(getClassUnlockLevel('lightning')).toBe(60);

    const rewards80 = getRewardsForLevel(80);
    const voidReward = rewards80.find(r => r.type === 'class_unlock' && r.classId === 'void');
    expect(voidReward).toBeDefined();
    expect(getClassUnlockLevel('void')).toBe(80);

    const rewards100 = getRewardsForLevel(100);
    const techReward = rewards100.find(r => r.type === 'class_unlock' && r.classId === 'tech');
    expect(techReward).toBeDefined();
    expect(getClassUnlockLevel('tech')).toBe(100);
  });

  it('all class rewards in FORTRESS_LEVELS match unlock functions', () => {
    const classRewardLevels: Record<string, number> = {};

    for (const levelInfo of FORTRESS_LEVELS) {
      for (const reward of levelInfo.rewards) {
        if (reward.type === 'class_unlock' && reward.classId) {
          classRewardLevels[reward.classId] = levelInfo.level;
        }
      }
    }

    for (const [classId, level] of Object.entries(classRewardLevels)) {
      expect(getClassUnlockLevel(classId)).toBe(level);
      expect(isClassUnlockedAtLevel(classId, level)).toBe(true);
      expect(isClassUnlockedAtLevel(classId, level - 1)).toBe(false);
    }
  });

  it('all hero rewards match unlock functions', () => {
    const heroRewardLevels: Record<string, number> = {};

    for (const levelInfo of FORTRESS_LEVELS) {
      for (const reward of levelInfo.rewards) {
        if (reward.type === 'hero_unlock' && reward.heroId) {
          heroRewardLevels[reward.heroId] = levelInfo.level;
        }
      }
    }

    for (const [heroId, level] of Object.entries(heroRewardLevels)) {
      expect(getHeroUnlockLevel(heroId)).toBe(level);
      expect(isHeroUnlockedAtLevel(heroId, level)).toBe(true);
      expect(isHeroUnlockedAtLevel(heroId, level - 1)).toBe(false);
    }
  });

  it('all turret rewards match unlock functions', () => {
    const turretRewardLevels: Record<string, number> = {};

    for (const levelInfo of FORTRESS_LEVELS) {
      for (const reward of levelInfo.rewards) {
        if (reward.type === 'turret_unlock' && reward.turretType) {
          turretRewardLevels[reward.turretType] = levelInfo.level;
        }
      }
    }

    for (const [turretType, level] of Object.entries(turretRewardLevels)) {
      expect(getTurretUnlockLevel(turretType)).toBe(level);
      expect(isTurretUnlockedAtLevel(turretType, level)).toBe(true);
      expect(isTurretUnlockedAtLevel(turretType, level - 1)).toBe(false);
    }
  });
});
