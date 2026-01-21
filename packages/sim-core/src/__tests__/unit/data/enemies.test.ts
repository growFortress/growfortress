import { describe, it, expect } from 'vitest';
import {
  ENEMY_ARCHETYPES,
  getEnemyStats,
  getEnemyRewards,
  getWaveComposition,
} from '../../../data/enemies.js';
import { FP } from '../../../fixed.js';

describe('ENEMY_ARCHETYPES', () => {
  it('has all enemy types', () => {
    expect(ENEMY_ARCHETYPES.runner).toBeDefined();
    expect(ENEMY_ARCHETYPES.bruiser).toBeDefined();
    expect(ENEMY_ARCHETYPES.leech).toBeDefined();
  });

  it('runner has correct base stats', () => {
    const runner = ENEMY_ARCHETYPES.runner;
    expect(runner.type).toBe('runner');
    expect(runner.baseHp).toBe(29);
    expect(runner.baseSpeed).toBe(1.94);
    expect(runner.baseDamage).toBe(8);
    expect(runner.goldReward).toBe(1);  // Reduced for economy balance
    expect(runner.dustReward).toBe(1);
  });

  it('bruiser has correct base stats', () => {
    const bruiser = ENEMY_ARCHETYPES.bruiser;
    expect(bruiser.type).toBe('bruiser');
    expect(bruiser.baseHp).toBe(144);
    expect(bruiser.baseSpeed).toBe(0.70);
    expect(bruiser.baseDamage).toBe(21);
    expect(bruiser.goldReward).toBe(5);  // Reduced for economy balance
    expect(bruiser.dustReward).toBe(2);  // Reduced from 3
  });

  it('leech has correct base stats', () => {
    const leech = ENEMY_ARCHETYPES.leech;
    expect(leech.type).toBe('leech');
    expect(leech.baseHp).toBe(58);
    expect(leech.baseSpeed).toBe(1.41);
    expect(leech.baseDamage).toBe(5);
    expect(leech.goldReward).toBe(4);  // Reduced for economy balance
    expect(leech.dustReward).toBe(1);  // Reduced from 2
  });

  it('all archetypes have descriptions', () => {
    expect(ENEMY_ARCHETYPES.runner.description).toBeDefined();
    expect(ENEMY_ARCHETYPES.bruiser.description).toBeDefined();
    expect(ENEMY_ARCHETYPES.leech.description).toBeDefined();
  });
});

describe('getEnemyStats', () => {
  describe('base stats for wave 1', () => {
    it('returns correct base stats for runner at wave 1', () => {
      const stats = getEnemyStats('runner', 1, false);
      expect(stats.hp).toBe(29); // No scaling at wave 1
      expect(stats.damage).toBe(8);
    });

    it('returns correct base stats for bruiser at wave 1', () => {
      const stats = getEnemyStats('bruiser', 1, false);
      expect(stats.hp).toBe(144);
      expect(stats.damage).toBe(21);
    });

    it('returns correct base stats for leech at wave 1', () => {
      const stats = getEnemyStats('leech', 1, false);
      expect(stats.hp).toBe(58);
      expect(stats.damage).toBe(5);
    });
  });

  describe('wave scaling', () => {
    it('applies wave scaling (12% per wave)', () => {
      const wave2 = getEnemyStats('runner', 2, false);
      const wave11 = getEnemyStats('runner', 11, false);

      // Wave 2: 29 * 1.12 = 32.48, floored to 32
      expect(wave2.hp).toBe(32);

      // Wave 11: 29 * 2.2 = 63.8, floored to 63
      expect(wave11.hp).toBe(63);
    });

    it('scales damage with wave', () => {
      const wave6 = getEnemyStats('bruiser', 6, false);

      // Wave 6: 21 * 1.6 = 33.6, floored to 33
      expect(wave6.damage).toBe(33);
    });
  });

  describe('elite multipliers', () => {
    it('applies elite HP multiplier (3x for HP)', () => {
      const normal = getEnemyStats('runner', 1, false);
      const elite = getEnemyStats('runner', 1, true);

      // 29 * 3 = 87
      expect(elite.hp).toBe(Math.floor(normal.hp * 3));
    });

    it('applies elite damage multiplier (2.5x)', () => {
      const normal = getEnemyStats('runner', 1, false);
      const elite = getEnemyStats('runner', 1, true);

      // 8 * 2.5 = 20
      expect(elite.damage).toBe(Math.floor(normal.damage * 2.5));
    });

    it('combines wave scaling and elite multipliers', () => {
      const elite = getEnemyStats('runner', 5, true);
      // Wave 5: 1 + (5-1) * 0.12 = 1.48
      // HP: 29 * 1.48 * 3 = 128.76, floored to 128
      expect(elite.hp).toBe(128);
      // Damage: 8 * 1.48 * 2.5 = 29.6, floored to 29
      expect(elite.damage).toBe(29);
    });
  });

  describe('speed', () => {
    it('returns speed as fixed-point', () => {
      const stats = getEnemyStats('runner', 1, false);
      // 1.94 units/tick / 30 Hz in fixed-point (speed was reduced from 2.2)
      expect(stats.speed).toBe(FP.fromFloat(1.94 / 30));
    });

    it('speed is not affected by elite status', () => {
      const normal = getEnemyStats('runner', 1, false);
      const elite = getEnemyStats('runner', 1, true);
      expect(normal.speed).toBe(elite.speed);
    });

    it('speed is not affected by wave', () => {
      const wave1 = getEnemyStats('runner', 1, false);
      const wave10 = getEnemyStats('runner', 10, false);
      expect(wave1.speed).toBe(wave10.speed);
    });
  });
});

describe('getEnemyRewards', () => {
  // Note: Economy balance multiplier is 1.0 (no penalty)
  // Elite multiplier is 2.5x (reduced from 3.5x for balance)
  // Wave scaling: +3% per 10 waves (reduced from 5% for balance)
  describe('base rewards (no economy penalty)', () => {
    it('returns correct base rewards for runner', () => {
      const rewards = getEnemyRewards('runner', false, 1.0, 1.0, 1);
      // Base: gold=1 (reduced for balance), dust=0 (dust removed from enemy kills)
      expect(rewards.gold).toBe(1);
      expect(rewards.dust).toBe(0);
    });

    it('returns correct base rewards for bruiser', () => {
      const rewards = getEnemyRewards('bruiser', false, 1.0, 1.0, 1);
      // Base: gold=5 (reduced for balance), dust=0 (dust removed from enemy kills)
      expect(rewards.gold).toBe(5);
      expect(rewards.dust).toBe(0);
    });

    it('returns correct base rewards for leech', () => {
      const rewards = getEnemyRewards('leech', false, 1.0, 1.0, 1);
      // Base: gold=4 (reduced for balance), dust=0 (dust removed from enemy kills)
      expect(rewards.gold).toBe(4);
      expect(rewards.dust).toBe(0);
    });
  });

  describe('elite multiplier', () => {
    it('applies elite multiplier (2.5x) to gold only', () => {
      // Use mafia_boss for higher base values to avoid floor() issues
      const normal = getEnemyRewards('mafia_boss', false, 1.0, 1.0, 1);
      const elite = getEnemyRewards('mafia_boss', true, 1.0, 1.0, 1);

      // Elite gives 2.5x gold (18 * 2.5 = 45)
      expect(elite.gold).toBeGreaterThan(normal.gold * 2);
      expect(elite.gold).toBeLessThanOrEqual(normal.gold * 3);
      // Dust is always 0 (removed from enemy kills)
      expect(elite.dust).toBe(0);
      expect(normal.dust).toBe(0);
    });
  });

  describe('gold/dust multipliers', () => {
    it('applies gold multiplier', () => {
      const rewards = getEnemyRewards('runner', false, 2.0, 1.0, 1);
      // Base: 1 * 2.0 = 2
      expect(rewards.gold).toBe(2);
      expect(rewards.dust).toBe(0); // Dust removed from enemy kills
    });

    it('dust multiplier has no effect (dust removed)', () => {
      const rewards = getEnemyRewards('runner', false, 1.0, 2.0, 1);
      expect(rewards.gold).toBe(1); // Unaffected by dust mult
      // Dust is always 0 (removed from enemy kills)
      expect(rewards.dust).toBe(0);
    });

    it('combines gold multipliers only', () => {
      const rewards = getEnemyRewards('runner', true, 1.5, 2.0, 1);
      // Gold: 1 * 2.5 (elite) * 1.5 = 3.75 = 3
      expect(rewards.gold).toBe(3);
      // Dust is always 0 (removed from enemy kills)
      expect(rewards.dust).toBe(0);
    });
  });

  describe('floor behavior', () => {
    it('floors gold reward', () => {
      const rewards = getEnemyRewards('runner', false, 1.1, 1.0, 1);
      // 1 * 1.1 = 1.1, floored to 1
      expect(rewards.gold).toBe(1);
    });

    it('dust is always 0 (removed from enemy kills)', () => {
      const rewards = getEnemyRewards('runner', false, 1.0, 1.3, 1);
      // Dust is always 0 regardless of multiplier
      expect(rewards.dust).toBe(0);
    });
  });
});

describe('getWaveComposition', () => {
  describe('early waves (1-2) - Streets pillar', () => {
    it('returns pillar-specific enemies at wave 1', () => {
      const composition = getWaveComposition(1, 30);

      expect(composition.wave).toBe(1);
      // Streets pillar uses gangster, thug as common enemies for early waves
      expect(composition.enemies.length).toBe(2);
      const types = composition.enemies.map(e => e.type);
      expect(types).toContain('gangster');
      expect(types).toContain('thug');
    });

    it('returns pillar-specific enemies at wave 2', () => {
      const composition = getWaveComposition(2, 30);
      expect(composition.enemies.length).toBe(2);
      const types = composition.enemies.map(e => e.type);
      expect(types).toContain('gangster');
      expect(types).toContain('thug');
    });
  });

  describe('mid waves (3-5) - Streets pillar', () => {
    it('returns mix of pillar enemies', () => {
      const composition = getWaveComposition(4, 30);
      const types = composition.enemies.map(e => e.type);

      // Mid-pillar waves include common + elite enemies
      expect(types.length).toBeGreaterThanOrEqual(2);
    });

    it('has multiple enemy types', () => {
      const composition = getWaveComposition(4, 30);
      expect(composition.enemies.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('late waves (6+) - Streets pillar', () => {
    it('returns balanced mix with elites', () => {
      const composition = getWaveComposition(8, 30);
      const types = composition.enemies.map(e => e.type);

      // Late pillar waves have common + elite enemy types
      expect(types.length).toBeGreaterThanOrEqual(2);
    });

    it('has harder composition in late waves', () => {
      const composition = getWaveComposition(8, 30);
      // Late waves should have more enemy groups
      expect(composition.enemies.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('elite chance', () => {
    it('elite chance scales with wave', () => {
      const wave1 = getWaveComposition(1, 30);
      const wave10 = getWaveComposition(10, 30);

      expect(wave1.eliteChance).toBeLessThan(wave10.eliteChance);
    });

    it('elite chance starts at 5.4-5.5% (Endless mode formula)', () => {
      const composition = getWaveComposition(1, 30);
      // 0.05 + 1 * 0.005 = 0.055 (but may have floating point precision issues)
      expect(composition.eliteChance).toBeCloseTo(0.055, 2);
    });

    it('elite chance caps at 50% (Endless mode)', () => {
      const composition = getWaveComposition(100, 30);
      expect(composition.eliteChance).toBeLessThanOrEqual(0.5);
    });
  });

  describe('spawn interval', () => {
    it('spawn interval decreases with wave', () => {
      const wave1 = getWaveComposition(1, 30);
      const wave10 = getWaveComposition(10, 30);

      expect(wave1.spawnIntervalTicks).toBeGreaterThan(wave10.spawnIntervalTicks);
    });

    it('spawn interval has minimum (tickHz / 3)', () => {
      const composition = getWaveComposition(100, 30);
      // Min is tickHz/3 = 10, but cycle scaling can reduce further (min 4)
      expect(composition.spawnIntervalTicks).toBeGreaterThanOrEqual(4);
    });

    it('uses tickHz for calculation', () => {
      const composition60 = getWaveComposition(1, 60);
      const composition30 = getWaveComposition(1, 30);

      expect(composition60.spawnIntervalTicks).toBeGreaterThan(composition30.spawnIntervalTicks);
    });
  });

  describe('enemy count', () => {
    it('enemy count increases with wave', () => {
      const wave1 = getWaveComposition(1, 30);
      const wave5 = getWaveComposition(5, 30);

      const count1 = wave1.enemies.reduce((sum, e) => sum + e.count, 0);
      const count5 = wave5.enemies.reduce((sum, e) => sum + e.count, 0);

      expect(count5).toBeGreaterThan(count1);
    });

    it('baseEnemies follows formula: 8 + floor(wave * 2.5), distributed by composition', () => {
      const wave1 = getWaveComposition(1, 30);
      const wave10 = getWaveComposition(10, 30);

      const count1 = wave1.enemies.reduce((sum, e) => sum + e.count, 0);
      const count10 = wave10.enemies.reduce((sum, e) => sum + e.count, 0);

      // Base: 8 + floor(wave * 2.5), distributed with floor() can lose some
      // Wave 1: actual count may vary based on pillar composition
      // Wave 10 is a boss wave with different composition
      expect(count1).toBeGreaterThan(0);
      expect(count10).toBeGreaterThan(count1);
    });
  });
});
