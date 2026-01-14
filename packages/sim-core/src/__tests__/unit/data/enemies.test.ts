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
    expect(runner.baseHp).toBe(23);
    expect(runner.baseSpeed).toBe(2.8);
    expect(runner.baseDamage).toBe(6);
    expect(runner.goldReward).toBe(2);
    expect(runner.dustReward).toBe(1);
  });

  it('bruiser has correct base stats', () => {
    const bruiser = ENEMY_ARCHETYPES.bruiser;
    expect(bruiser.type).toBe('bruiser');
    expect(bruiser.baseHp).toBe(115);
    expect(bruiser.baseSpeed).toBe(1.0);
    expect(bruiser.baseDamage).toBe(17);
    expect(bruiser.goldReward).toBe(7);
    expect(bruiser.dustReward).toBe(2);  // Reduced from 3
  });

  it('leech has correct base stats', () => {
    const leech = ENEMY_ARCHETYPES.leech;
    expect(leech.type).toBe('leech');
    expect(leech.baseHp).toBe(46);
    expect(leech.baseSpeed).toBe(2.0);
    expect(leech.baseDamage).toBe(4);
    expect(leech.goldReward).toBe(5);
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
      expect(stats.hp).toBe(23); // No scaling at wave 1
      expect(stats.damage).toBe(6);
    });

    it('returns correct base stats for bruiser at wave 1', () => {
      const stats = getEnemyStats('bruiser', 1, false);
      expect(stats.hp).toBe(115);
      expect(stats.damage).toBe(17);
    });

    it('returns correct base stats for leech at wave 1', () => {
      const stats = getEnemyStats('leech', 1, false);
      expect(stats.hp).toBe(46);
      expect(stats.damage).toBe(4);
    });
  });

  describe('wave scaling', () => {
    it('applies wave scaling (12% per wave)', () => {
      const wave2 = getEnemyStats('runner', 2, false);
      const wave11 = getEnemyStats('runner', 11, false);

      // Wave 2: 23 * 1.12 = 25.76, floored to 25
      expect(wave2.hp).toBe(25);

      // Wave 11: 23 * 2.2 = 50.6, floored to 50
      expect(wave11.hp).toBe(50);
    });

    it('scales damage with wave', () => {
      const wave6 = getEnemyStats('bruiser', 6, false);

      // Wave 6: 17 * 1.6 = 27.2, floored to 27
      expect(wave6.damage).toBe(27);
    });
  });

  describe('elite multipliers', () => {
    it('applies elite HP multiplier (3.5x)', () => {
      const normal = getEnemyStats('runner', 1, false);
      const elite = getEnemyStats('runner', 1, true);

      // 23 * 3.5 = 80.5, floored to 80
      expect(elite.hp).toBe(Math.floor(normal.hp * 3.5));
    });

    it('applies elite damage multiplier (2.5x)', () => {
      const normal = getEnemyStats('runner', 1, false);
      const elite = getEnemyStats('runner', 1, true);

      // 6 * 2.5 = 15
      expect(elite.damage).toBe(Math.floor(normal.damage * 2.5));
    });

    it('combines wave scaling and elite multipliers', () => {
      const elite = getEnemyStats('runner', 5, true);
      // Wave 5: 1 + (5-1) * 0.12 = 1.48
      // HP: 23 * 1.48 * 3.5 = 119.14, floored to 119
      expect(elite.hp).toBe(119);
      // Damage: 6 * 1.48 * 2.5 = 22.2, floored to 22
      expect(elite.damage).toBe(22);
    });
  });

  describe('speed', () => {
    it('returns speed as fixed-point', () => {
      const stats = getEnemyStats('runner', 1, false);
      // 2.8 units/tick / 30 Hz in fixed-point
      expect(stats.speed).toBe(FP.fromFloat(2.8 / 30));
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
  // Note: Base rewards are halved (economyBalanceMult = 0.5) since enemy count is doubled
  describe('base rewards (halved for economy balance)', () => {
    it('returns correct base rewards for runner', () => {
      const rewards = getEnemyRewards('runner', false, 1.0, 1.0);
      // Base: gold=2, dust=1 * 0.5 = gold=1, dust=0
      expect(rewards.gold).toBe(1);
      expect(rewards.dust).toBe(0);
    });

    it('returns correct base rewards for bruiser', () => {
      const rewards = getEnemyRewards('bruiser', false, 1.0, 1.0);
      // Base: gold=7, dust=3 * 0.5 = gold=3, dust=1
      expect(rewards.gold).toBe(3);
      expect(rewards.dust).toBe(1);
    });

    it('returns correct base rewards for leech', () => {
      const rewards = getEnemyRewards('leech', false, 1.0, 1.0);
      // Base: gold=5, dust=1 * 0.5 = gold=2, dust=0
      expect(rewards.gold).toBe(2);
      expect(rewards.dust).toBe(0);
    });
  });

  describe('elite multiplier', () => {
    it('applies elite multiplier (approximately 3x)', () => {
      // Use mafia_boss for higher base values to avoid floor() issues
      const normal = getEnemyRewards('mafia_boss', false, 1.0, 1.0);
      const elite = getEnemyRewards('mafia_boss', true, 1.0, 1.0);

      // Elite gives significantly more (close to 3x, accounting for floor())
      expect(elite.gold).toBeGreaterThan(normal.gold * 2);
      expect(elite.gold).toBeLessThanOrEqual(normal.gold * 3 + 1);
      expect(elite.dust).toBeGreaterThan(normal.dust * 2);
      expect(elite.dust).toBeLessThanOrEqual(normal.dust * 3 + 1);
    });
  });

  describe('gold/dust multipliers', () => {
    it('applies gold multiplier', () => {
      const rewards = getEnemyRewards('runner', false, 2.0, 1.0);
      // Base: 2 * 0.5 * 2.0 = 2
      expect(rewards.gold).toBe(2);
      expect(rewards.dust).toBe(0); // Unaffected
    });

    it('applies dust multiplier', () => {
      const rewards = getEnemyRewards('runner', false, 1.0, 2.0);
      expect(rewards.gold).toBe(1); // Unaffected
      // Base: 1 * 0.5 * 2.0 = 1
      expect(rewards.dust).toBe(1);
    });

    it('combines all multipliers', () => {
      const rewards = getEnemyRewards('runner', true, 1.5, 2.0);
      // Gold: 2 * 3 (elite) * 1.5 * 0.5 = 4.5 = 4
      expect(rewards.gold).toBe(4);
      // Dust: 1 * 3 (elite) * 2.0 * 0.5 = 3
      expect(rewards.dust).toBe(3);
    });
  });

  describe('floor behavior', () => {
    it('floors gold reward', () => {
      const rewards = getEnemyRewards('runner', false, 1.1, 1.0);
      // 2 * 0.5 * 1.1 = 1.1, floored to 1
      expect(rewards.gold).toBe(1);
    });

    it('floors dust reward', () => {
      const rewards = getEnemyRewards('runner', false, 1.0, 1.3);
      // 1 * 0.5 * 1.3 = 0.65, floored to 0
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

    it('elite chance starts at 5.5% (Endless mode formula)', () => {
      const composition = getWaveComposition(1, 30);
      // 0.05 + 1 * 0.005 = 0.055
      expect(composition.eliteChance).toBe(0.055);
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

    it('baseEnemies follows formula: 10 + wave * 6, distributed by composition', () => {
      const wave1 = getWaveComposition(1, 30);
      const wave10 = getWaveComposition(10, 30);

      const count1 = wave1.enemies.reduce((sum, e) => sum + e.count, 0);
      const count10 = wave10.enemies.reduce((sum, e) => sum + e.count, 0);

      // Base: 10 + wave * 6, but distributed with floor() can lose some
      // Wave 1: base 16, distributed: floor(16*0.6) + floor(16*0.4) = 9+6 = 15
      // Wave 10 is a boss wave with different composition
      expect(count1).toBe(15);
      expect(count10).toBeGreaterThan(count1);
    });
  });
});
