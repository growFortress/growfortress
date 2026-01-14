/**
 * Boss Rush Mode Unit Tests
 * Tests for boss scaling, rewards, milestones, and state management
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getBossRushBossStats,
  getBossAtIndex,
  getCycleForBossIndex,
  getBossRushBossRewards,
  getAchievedMilestones,
  getNextMilestone,
  createBossRushState,
  recordBossRushDamage,
  processBossKill,
  startIntermission,
  endIntermission,
  generateBossRushSummary,
  BOSS_RUSH_SEQUENCE,
  BOSS_RUSH_CYCLE_LENGTH,
  BOSS_RUSH_MILESTONES,
  DEFAULT_BOSS_RUSH_CONFIG,
  BossRushState,
} from '../../boss-rush.js';

// ============================================================================
// BOSS SEQUENCE TESTS
// ============================================================================

describe('Boss Sequence', () => {
  it('has 7 bosses in the cycle', () => {
    expect(BOSS_RUSH_CYCLE_LENGTH).toBe(7);
    expect(BOSS_RUSH_SEQUENCE).toHaveLength(7);
  });

  it('starts with streets pillar boss', () => {
    expect(BOSS_RUSH_SEQUENCE[0].pillarId).toBe('streets');
    expect(BOSS_RUSH_SEQUENCE[0].bossType).toBe('mafia_boss');
  });

  it('ends with god boss from gods pillar', () => {
    expect(BOSS_RUSH_SEQUENCE[6].pillarId).toBe('gods');
    expect(BOSS_RUSH_SEQUENCE[6].bossType).toBe('god');
  });

  it('contains all pillar bosses', () => {
    const pillars = BOSS_RUSH_SEQUENCE.map(b => b.pillarId);
    expect(pillars).toContain('streets');
    expect(pillars).toContain('science');
    expect(pillars).toContain('mutants');
    expect(pillars).toContain('cosmos');
    expect(pillars).toContain('magic');
    expect(pillars).toContain('gods');
  });
});

// ============================================================================
// BOSS STATS SCALING TESTS
// ============================================================================

describe('Boss Stats Scaling', () => {
  describe('getBossRushBossStats', () => {
    it('returns correct stats for boss #0 (first boss)', () => {
      const stats = getBossRushBossStats(0);
      expect(stats.bossIndex).toBe(0);
      expect(stats.cycle).toBe(0);
      expect(stats.type).toBe('mafia_boss');
      expect(stats.pillarId).toBe('streets');
      expect(stats.hp).toBeGreaterThan(0);
      expect(stats.damage).toBeGreaterThan(0);
      expect(stats.speed).toBeGreaterThan(0);
    });

    it('returns correct stats for boss #7 (first boss of second cycle)', () => {
      const stats = getBossRushBossStats(7);
      expect(stats.bossIndex).toBe(7);
      expect(stats.cycle).toBe(1);
      // Should be same boss type as #0 (mafia_boss)
      expect(stats.type).toBe('mafia_boss');
    });

    it('scales HP exponentially with boss index (1.10^bossIndex)', () => {
      // Compare same boss type across cycles to isolate scaling factor
      // Boss 0 is mafia_boss at cycle 0, boss 7 is mafia_boss at cycle 1
      const boss0 = getBossRushBossStats(0);
      const boss7 = getBossRushBossStats(7);
      const boss14 = getBossRushBossStats(14);

      // Boss 7 has positionScale = 1.10^7 and cycleScale = 2.0^1
      // Boss 0 has positionScale = 1.10^0 = 1 and cycleScale = 2.0^0 = 1
      // Expected ratio = 1.10^7 * 2.0 ≈ 3.897
      const positionScale7 = Math.pow(DEFAULT_BOSS_RUSH_CONFIG.scalingPerBoss, 7);
      const cycleScale1 = DEFAULT_BOSS_RUSH_CONFIG.cycleScaling;
      const expectedRatio7 = positionScale7 * cycleScale1;

      const actualRatio7 = boss7.hp / boss0.hp;
      expect(actualRatio7).toBeCloseTo(expectedRatio7, 0);

      // Boss 14 has positionScale = 1.10^14 and cycleScale = 2.0^2
      const positionScale14 = Math.pow(DEFAULT_BOSS_RUSH_CONFIG.scalingPerBoss, 14);
      const cycleScale2 = Math.pow(DEFAULT_BOSS_RUSH_CONFIG.cycleScaling, 2);
      const expectedRatio14 = positionScale14 * cycleScale2;

      const actualRatio14 = boss14.hp / boss0.hp;
      expect(actualRatio14).toBeCloseTo(expectedRatio14, 0);
    });

    it('scales HP per cycle (2.0^cycle)', () => {
      const boss0Cycle0 = getBossRushBossStats(0); // Cycle 0
      const boss0Cycle1 = getBossRushBossStats(7); // Cycle 1, same position

      // Position scaling: 1.10^7 and cycle scaling: 2.0^1
      const positionScale = Math.pow(DEFAULT_BOSS_RUSH_CONFIG.scalingPerBoss, 7);

      // Boss at index 7 should have ~2x the stats of a similarly scaled boss (cycle scaling applied)
      expect(boss0Cycle1.hp).toBeGreaterThan(boss0Cycle0.hp * positionScale);
    });

    it('applies boss multipliers (5x HP, 2x damage, 0.5x speed)', () => {
      const config = DEFAULT_BOSS_RUSH_CONFIG;
      expect(config.bossHpMultiplier).toBe(5.0);
      expect(config.bossDamageMultiplier).toBe(2.0);
      expect(config.bossSpeedMultiplier).toBe(0.5);
    });

    it('calculates cycle number correctly for boss #14', () => {
      const stats = getBossRushBossStats(14);
      expect(stats.cycle).toBe(2);
      expect(stats.bossIndex).toBe(14);
    });

    it('calculates cycle number correctly for boss #21', () => {
      const stats = getBossRushBossStats(21);
      expect(stats.cycle).toBe(3);
    });

    it('calculates cycle number correctly for boss #28', () => {
      const stats = getBossRushBossStats(28);
      expect(stats.cycle).toBe(4);
    });
  });

  describe('getBossAtIndex', () => {
    it('returns first boss for index 0', () => {
      const boss = getBossAtIndex(0);
      expect(boss.bossType).toBe('mafia_boss');
    });

    it('wraps around to first boss at index 7', () => {
      const boss = getBossAtIndex(7);
      expect(boss.bossType).toBe('mafia_boss');
    });

    it('returns correct boss for any index', () => {
      for (let i = 0; i < 21; i++) {
        const boss = getBossAtIndex(i);
        const expectedBoss = BOSS_RUSH_SEQUENCE[i % BOSS_RUSH_CYCLE_LENGTH];
        expect(boss.bossType).toBe(expectedBoss.bossType);
      }
    });
  });

  describe('getCycleForBossIndex', () => {
    it('returns 0 for bosses 0-6', () => {
      for (let i = 0; i < 7; i++) {
        expect(getCycleForBossIndex(i)).toBe(0);
      }
    });

    it('returns 1 for bosses 7-13', () => {
      for (let i = 7; i < 14; i++) {
        expect(getCycleForBossIndex(i)).toBe(1);
      }
    });

    it('returns 2 for bosses 14-20', () => {
      for (let i = 14; i < 21; i++) {
        expect(getCycleForBossIndex(i)).toBe(2);
      }
    });
  });
});

// ============================================================================
// REWARDS TESTS
// ============================================================================

describe('Boss Rush Rewards', () => {
  describe('getBossRushBossRewards', () => {
    it('returns positive rewards for first boss', () => {
      const rewards = getBossRushBossRewards(0);
      expect(rewards.gold).toBeGreaterThan(0);
      expect(rewards.dust).toBeGreaterThan(0);
      expect(rewards.xp).toBeGreaterThan(0);
    });

    it('rewards scale with boss index', () => {
      const rewards0 = getBossRushBossRewards(0);
      const rewards5 = getBossRushBossRewards(5);
      expect(rewards5.gold).toBeGreaterThan(rewards0.gold);
      expect(rewards5.dust).toBeGreaterThan(rewards0.dust);
      expect(rewards5.xp).toBeGreaterThan(rewards0.xp);
    });

    it('rewards scale with cycle (+50% per cycle)', () => {
      const rewards0Cycle0 = getBossRushBossRewards(0);
      const rewards0Cycle1 = getBossRushBossRewards(7);

      // Same position, but cycle 1 should have higher base rewards
      // Plus 50% cycle bonus
      expect(rewards0Cycle1.gold).toBeGreaterThan(rewards0Cycle0.gold);
    });

    it('essence drop chance is 30% base', () => {
      const rewards = getBossRushBossRewards(0);
      expect(rewards.essenceDropChance).toBe(0.3);
    });

    it('essence drop chance increases with cycle (+10% per cycle)', () => {
      const rewardsCycle0 = getBossRushBossRewards(0);
      const rewardsCycle1 = getBossRushBossRewards(7);
      const rewardsCycle2 = getBossRushBossRewards(14);

      expect(rewardsCycle0.essenceDropChance).toBe(0.3);
      expect(rewardsCycle1.essenceDropChance).toBe(0.4);
      expect(rewardsCycle2.essenceDropChance).toBe(0.5);
    });

    it('essence drop chance caps at 80%', () => {
      const rewards = getBossRushBossRewards(70); // Cycle 10
      expect(rewards.essenceDropChance).toBe(0.8);
    });

    it('returns correct essence material ID based on pillar', () => {
      const rewardsStreets = getBossRushBossRewards(0);
      expect(rewardsStreets.essenceMaterialId).toBe('boss_essence_streets');

      const rewardsScience = getBossRushBossRewards(1);
      expect(rewardsScience.essenceMaterialId).toBe('boss_essence_science');
    });
  });
});

// ============================================================================
// MILESTONE TESTS
// ============================================================================

describe('Boss Rush Milestones', () => {
  it('has milestones at 3, 7, 14, 21 boss kills', () => {
    const bossCountMilestones = BOSS_RUSH_MILESTONES.map(m => m.bossCount);
    expect(bossCountMilestones).toContain(3);
    expect(bossCountMilestones).toContain(7);
    expect(bossCountMilestones).toContain(14);
    expect(bossCountMilestones).toContain(21);
  });

  describe('getAchievedMilestones', () => {
    it('returns empty array for 0 bosses killed', () => {
      expect(getAchievedMilestones(0)).toHaveLength(0);
    });

    it('returns empty array for 2 bosses killed', () => {
      expect(getAchievedMilestones(2)).toHaveLength(0);
    });

    it('returns first milestone for 3 bosses killed', () => {
      const milestones = getAchievedMilestones(3);
      expect(milestones).toHaveLength(1);
      expect(milestones[0].bossCount).toBe(3);
    });

    it('returns first two milestones for 7 bosses killed', () => {
      const milestones = getAchievedMilestones(7);
      expect(milestones).toHaveLength(2);
    });

    it('returns all milestones for 21+ bosses killed', () => {
      const milestones = getAchievedMilestones(25);
      expect(milestones).toHaveLength(BOSS_RUSH_MILESTONES.length);
    });
  });

  describe('getNextMilestone', () => {
    it('returns first milestone for 0 bosses killed', () => {
      const next = getNextMilestone(0);
      expect(next?.bossCount).toBe(3);
    });

    it('returns second milestone for 5 bosses killed', () => {
      const next = getNextMilestone(5);
      expect(next?.bossCount).toBe(7);
    });

    it('returns null when all milestones achieved', () => {
      const next = getNextMilestone(25);
      expect(next).toBeNull();
    });
  });
});

// ============================================================================
// STATE MANAGEMENT TESTS
// ============================================================================

describe('Boss Rush State', () => {
  let state: BossRushState;

  beforeEach(() => {
    state = createBossRushState();
  });

  describe('createBossRushState', () => {
    it('creates initial state with zeroed values', () => {
      expect(state.currentBossIndex).toBe(0);
      expect(state.currentCycle).toBe(0);
      expect(state.bossesKilled).toBe(0);
      expect(state.totalDamageDealt).toBe(0);
      expect(state.goldEarned).toBe(0);
      expect(state.dustEarned).toBe(0);
      expect(state.xpEarned).toBe(0);
    });

    it('creates state without intermission active', () => {
      expect(state.inIntermission).toBe(false);
    });

    it('creates state with empty materials', () => {
      expect(Object.keys(state.materialsEarned)).toHaveLength(0);
    });

    it('creates state with empty achieved milestones', () => {
      expect(state.achievedMilestones).toHaveLength(0);
    });

    it('creates state with null fastest kill time', () => {
      expect(state.fastestBossKillTicks).toBeNull();
    });
  });

  describe('recordBossRushDamage', () => {
    it('adds damage to current boss damage', () => {
      recordBossRushDamage(state, 1000);
      expect(state.currentBossDamage).toBe(1000);
    });

    it('adds damage to total damage dealt', () => {
      recordBossRushDamage(state, 1000);
      expect(state.totalDamageDealt).toBe(1000);
    });

    it('accumulates damage correctly', () => {
      recordBossRushDamage(state, 1000);
      recordBossRushDamage(state, 500);
      recordBossRushDamage(state, 250);
      expect(state.currentBossDamage).toBe(1750);
      expect(state.totalDamageDealt).toBe(1750);
    });
  });

  describe('processBossKill', () => {
    it('increments bossesKilled', () => {
      processBossKill(state, 100);
      expect(state.bossesKilled).toBe(1);
    });

    it('increments currentBossIndex', () => {
      processBossKill(state, 100);
      expect(state.currentBossIndex).toBe(1);
    });

    it('resets currentBossDamage', () => {
      state.currentBossDamage = 5000;
      processBossKill(state, 100);
      expect(state.currentBossDamage).toBe(0);
    });

    it('adds gold rewards', () => {
      processBossKill(state, 100);
      expect(state.goldEarned).toBeGreaterThan(0);
    });

    it('adds dust rewards', () => {
      processBossKill(state, 100);
      expect(state.dustEarned).toBeGreaterThan(0);
    });

    it('adds XP rewards', () => {
      processBossKill(state, 100);
      expect(state.xpEarned).toBeGreaterThan(0);
    });

    it('tracks fastest boss kill time', () => {
      state.currentBossStartTick = 0;
      processBossKill(state, 100);
      expect(state.fastestBossKillTicks).toBe(100);
    });

    it('updates fastest time when new kill is faster', () => {
      state.currentBossStartTick = 0;
      processBossKill(state, 100);
      state.currentBossStartTick = 100;
      processBossKill(state, 150); // 50 ticks
      expect(state.fastestBossKillTicks).toBe(50);
    });

    it('does not update fastest time when new kill is slower', () => {
      state.currentBossStartTick = 0;
      processBossKill(state, 50);
      state.currentBossStartTick = 50;
      processBossKill(state, 200); // 150 ticks
      expect(state.fastestBossKillTicks).toBe(50);
    });

    it('updates cycle when crossing cycle boundary', () => {
      // Kill 7 bosses to enter cycle 1
      for (let i = 0; i < 7; i++) {
        processBossKill(state, i * 100);
      }
      expect(state.currentCycle).toBe(1);
    });

    it('awards milestone at 3 kills', () => {
      for (let i = 0; i < 3; i++) {
        processBossKill(state, i * 100);
      }
      expect(state.achievedMilestones).toContain(3);
    });

    it('awards milestone at 7 kills', () => {
      for (let i = 0; i < 7; i++) {
        processBossKill(state, i * 100);
      }
      expect(state.achievedMilestones).toContain(7);
    });

    it('does not double-award milestones', () => {
      for (let i = 0; i < 5; i++) {
        processBossKill(state, i * 100);
      }
      const countOf3 = state.achievedMilestones.filter(m => m === 3).length;
      expect(countOf3).toBe(1);
    });

    it('awards milestone materials', () => {
      for (let i = 0; i < 7; i++) {
        processBossKill(state, i * 100);
      }
      expect(state.materialsEarned['boss_trophy_gold']).toBe(1);
    });
  });

  describe('intermission', () => {
    it('startIntermission sets inIntermission to true', () => {
      startIntermission(state, 100);
      expect(state.inIntermission).toBe(true);
    });

    it('startIntermission sets correct end tick', () => {
      startIntermission(state, 100);
      expect(state.intermissionEndTick).toBe(100 + DEFAULT_BOSS_RUSH_CONFIG.intermissionTicks);
    });

    it('endIntermission sets inIntermission to false', () => {
      startIntermission(state, 100);
      endIntermission(state, 190);
      expect(state.inIntermission).toBe(false);
    });

    it('endIntermission sets currentBossStartTick', () => {
      endIntermission(state, 200);
      expect(state.currentBossStartTick).toBe(200);
    });
  });

  describe('generateBossRushSummary', () => {
    it('generates accurate summary', () => {
      recordBossRushDamage(state, 10000);
      processBossKill(state, 100);
      processBossKill(state, 200);
      processBossKill(state, 300);

      const summary = generateBossRushSummary(state);
      expect(summary.totalDamageDealt).toBe(10000);
      expect(summary.bossesKilled).toBe(3);
      expect(summary.goldEarned).toBeGreaterThan(0);
      expect(summary.achievedMilestones).toContain(3);
    });

    it('copies materialsEarned without reference', () => {
      for (let i = 0; i < 7; i++) {
        processBossKill(state, i * 100);
      }
      const summary = generateBossRushSummary(state);
      summary.materialsEarned['test'] = 100;
      expect(state.materialsEarned['test']).toBeUndefined();
    });

    it('copies achievedMilestones without reference', () => {
      for (let i = 0; i < 3; i++) {
        processBossKill(state, i * 100);
      }
      const summary = generateBossRushSummary(state);
      summary.achievedMilestones.push(999);
      expect(state.achievedMilestones).not.toContain(999);
    });
  });
});

// ============================================================================
// CONFIGURATION TESTS
// ============================================================================

describe('Boss Rush Configuration', () => {
  it('has default intermission of 90 ticks (3 seconds at 30Hz)', () => {
    expect(DEFAULT_BOSS_RUSH_CONFIG.intermissionTicks).toBe(90);
  });

  it('has default scaling of 1.10 per boss (+10%)', () => {
    expect(DEFAULT_BOSS_RUSH_CONFIG.scalingPerBoss).toBe(1.10);
  });

  it('has default cycle scaling of 2.0 (2x per cycle)', () => {
    expect(DEFAULT_BOSS_RUSH_CONFIG.cycleScaling).toBe(2.0);
  });

  it('has boss HP multiplier of 5.0', () => {
    expect(DEFAULT_BOSS_RUSH_CONFIG.bossHpMultiplier).toBe(5.0);
  });

  it('has boss damage multiplier of 2.0', () => {
    expect(DEFAULT_BOSS_RUSH_CONFIG.bossDamageMultiplier).toBe(2.0);
  });

  it('has boss speed multiplier of 0.5 (half speed)', () => {
    expect(DEFAULT_BOSS_RUSH_CONFIG.bossSpeedMultiplier).toBe(0.5);
  });
});
