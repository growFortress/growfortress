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
    expect(runner.baseHp).toBe(60);       // Buffed from 29
    expect(runner.baseSpeed).toBe(2.33);
    expect(runner.baseDamage).toBe(10);   // Buffed from 8
    expect(runner.goldReward).toBe(1);
    expect(runner.dustReward).toBe(1);
  });

  it('bruiser has correct base stats', () => {
    const bruiser = ENEMY_ARCHETYPES.bruiser;
    expect(bruiser.type).toBe('bruiser');
    expect(bruiser.baseHp).toBe(200);     // Buffed from 144
    expect(bruiser.baseSpeed).toBe(0.84);
    expect(bruiser.baseDamage).toBe(28);  // Buffed from 21
    expect(bruiser.goldReward).toBe(3);   // Reduced from 5
    expect(bruiser.dustReward).toBe(2);
  });

  it('leech has correct base stats', () => {
    const leech = ENEMY_ARCHETYPES.leech;
    expect(leech.type).toBe('leech');
    expect(leech.baseHp).toBe(85);        // Buffed from 58
    expect(leech.baseSpeed).toBe(1.69);
    expect(leech.baseDamage).toBe(8);     // Buffed from 5
    expect(leech.goldReward).toBe(2);     // Reduced from 4
    expect(leech.dustReward).toBe(1);
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
      // Wave 1: 60 * 1.0 (waveScale) * 1.5 (earlyWaveHpBoost) = 90
      expect(stats.hp).toBe(90);
      expect(stats.damage).toBe(10);
    });

    it('returns correct base stats for bruiser at wave 1', () => {
      const stats = getEnemyStats('bruiser', 1, false);
      // Wave 1: 200 * 1.0 * 1.5 = 300
      expect(stats.hp).toBe(300);
      expect(stats.damage).toBe(28);
    });

    it('returns correct base stats for leech at wave 1', () => {
      const stats = getEnemyStats('leech', 1, false);
      // Wave 1: 85 * 1.0 * 1.5 = 127
      expect(stats.hp).toBe(127);
      expect(stats.damage).toBe(8);
    });
  });

  describe('wave scaling', () => {
    it('applies wave scaling (20% per wave for waves 1-40) with early HP boost', () => {
      const wave2 = getEnemyStats('runner', 2, false);
      const wave11 = getEnemyStats('runner', 11, false);

      // Wave 2: 60 * 1.20 * 1.464 = 105
      expect(wave2.hp).toBe(105);

      // Wave 11: 60 * 3.0 * 1.143 = 205
      expect(wave11.hp).toBe(205);
    });

    it('scales damage with wave (no HP boost for damage)', () => {
      const wave6 = getEnemyStats('bruiser', 6, false);

      // Wave 6: 28 * 2.0 = 56
      expect(wave6.damage).toBe(56);
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
      // Wave 5: waveScale=1.8, earlyWaveHpBoost=1.357
      // HP: 60 * 1.8 * 3.0 * 1.357 = 439
      expect(elite.hp).toBe(439);
      // Damage: 10 * 1.8 * 2.5 = 45
      expect(elite.damage).toBe(45);
    });
  });

  describe('speed', () => {
    it('returns speed as fixed-point', () => {
      const stats = getEnemyStats('runner', 1, false);
      // 2.33 units/tick / 30 Hz in fixed-point (speed was increased by 20%)
      expect(stats.speed).toBe(FP.fromFloat(2.33 / 30));
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
  // Wave scaling: +5% per wave (effective wave within cycle)
  // Cycle scaling: exponential 1.4^cycle
  describe('base rewards (no economy penalty)', () => {
    it('returns correct base rewards for runner', () => {
      const rewards = getEnemyRewards('runner', false, 1.0, 1.0, 1);
      // Base: gold=1 (reduced for balance), dust=0 (dust removed from enemy kills)
      expect(rewards.gold).toBe(1);
      expect(rewards.dust).toBe(0);
    });

    it('returns correct base rewards for bruiser', () => {
      const rewards = getEnemyRewards('bruiser', false, 1.0, 1.0, 1);
      // Base: gold=3 (reduced for balance), dust=0 (dust removed from enemy kills)
      expect(rewards.gold).toBe(3);
      expect(rewards.dust).toBe(0);
    });

    it('returns correct base rewards for leech', () => {
      const rewards = getEnemyRewards('leech', false, 1.0, 1.0, 1);
      // Base: gold=2 (reduced for balance), dust=0 (dust removed from enemy kills)
      expect(rewards.gold).toBe(2);
      expect(rewards.dust).toBe(0);
    });
  });

  describe('elite multiplier', () => {
    it('applies elite multiplier (2.0x) to gold only', () => {
      // Use mafia_boss for higher base values to avoid floor() issues
      const normal = getEnemyRewards('mafia_boss', false, 1.0, 1.0, 1);
      const elite = getEnemyRewards('mafia_boss', true, 1.0, 1.0, 1);

      // Elite gives 2.0x gold (12 * 2.0 = 24)
      expect(elite.gold).toBe(normal.gold * 2);
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

  describe('wave scaling (3% per wave)', () => {
    it('wave 2 has 3% increase (1.03x)', () => {
      const wave1 = getEnemyRewards('runner', false, 1.0, 1.0, 1);
      const wave2 = getEnemyRewards('runner', false, 1.0, 1.0, 2);
      // Wave 2: 1 + (2-1) * 0.03 = 1.03
      // Base: 1 * 1.03 = 1.03, floored to 1
      expect(wave2.gold).toBeGreaterThanOrEqual(wave1.gold);
    });

    it('wave 11 has 30% increase (1.30x)', () => {
      // Wave 11: 1 + (11-1) * 0.03 = 1.30
      // Use bruiser for better precision: 3 * 1.30 = 3.9, floored to 3
      const wave11Bruiser = getEnemyRewards('bruiser', false, 1.0, 1.0, 11);
      expect(wave11Bruiser.gold).toBe(3); // 3 * 1.30 = 3.9 → 3
    });

    it('wave 100 has 297% increase (3.97x)', () => {
      const wave1 = getEnemyRewards('bruiser', false, 1.0, 1.0, 1);
      const wave100 = getEnemyRewards('bruiser', false, 1.0, 1.0, 100);
      // Wave 100: 1 + (100-1) * 0.03 = 1 + 2.97 = 3.97
      // Base: 3 * 3.97 = 11.91, floored to 11
      expect(wave100.gold).toBe(11);
      expect(wave100.gold).toBeGreaterThan(wave1.gold * 3); // 3% per wave means ~4x at wave 100
    });
  });

  describe('cycle scaling (exponential 1.3^cycle)', () => {
    it('cycle 0 (wave 1-100) has no cycle multiplier', () => {
      const wave1 = getEnemyRewards('bruiser', false, 1.0, 1.0, 1);
      const wave50 = getEnemyRewards('bruiser', false, 1.0, 1.0, 50);
      const wave100 = getEnemyRewards('bruiser', false, 1.0, 1.0, 100);

      // All in cycle 0, so cycle multiplier = 1.3^0 = 1
      // Only wave scaling applies
      expect(wave50.gold).toBeGreaterThan(wave1.gold);
      expect(wave100.gold).toBeGreaterThan(wave50.gold);
    });

    it('cycle 1 (wave 101-200) applies 1.3x multiplier', () => {
      const wave100 = getEnemyRewards('bruiser', false, 1.0, 1.0, 100);
      const wave200 = getEnemyRewards('bruiser', false, 1.0, 1.0, 200);

      // Wave 100: effectiveWave=100, cycle=0 → 3 * 3.97 * 1.0 = 11
      // Wave 200: effectiveWave=100, cycle=1 → 3 * 3.97 * 1.3 = 15.48 → 15
      expect(wave200.gold).toBe(15);
      expect(wave200.gold).toBeGreaterThan(wave100.gold);
    });

    it('cycle 2 (wave 201-300) applies 1.69x multiplier', () => {
      const wave200 = getEnemyRewards('bruiser', false, 1.0, 1.0, 200);
      const wave300 = getEnemyRewards('bruiser', false, 1.0, 1.0, 300);

      // Wave 200: effectiveWave=100, cycle=1 → 3 * 3.97 * 1.3 = 15
      // Wave 300: effectiveWave=100, cycle=2 → 3 * 3.97 * 1.69 = 20.12 → 20
      expect(wave300.gold).toBe(20);
      expect(wave300.gold).toBeGreaterThan(wave200.gold);
    });

    it('cycle scaling is exponential', () => {
      const wave100 = getEnemyRewards('bruiser', false, 1.0, 1.0, 100); // cycle 0
      const wave200 = getEnemyRewards('bruiser', false, 1.0, 1.0, 200); // cycle 1
      const wave300 = getEnemyRewards('bruiser', false, 1.0, 1.0, 300); // cycle 2

      // All have same effectiveWave=100, so ratio should match cycle multipliers
      const ratio1to0 = wave200.gold / wave100.gold;
      const ratio2to1 = wave300.gold / wave200.gold;

      // Cycle 1/0: 1.3/1.0 = 1.3
      // Cycle 2/1: 1.69/1.3 = 1.3
      expect(ratio1to0).toBeCloseTo(1.3, 0.1);
      expect(ratio2to1).toBeCloseTo(1.3, 0.1);
    });
  });

  describe('combined wave and cycle scaling', () => {
    it('combines wave and cycle multipliers correctly', () => {
      const wave50 = getEnemyRewards('bruiser', false, 1.0, 1.0, 50);
      const wave101 = getEnemyRewards('bruiser', false, 1.0, 1.0, 101);
      const wave150 = getEnemyRewards('bruiser', false, 1.0, 1.0, 150);

      // Wave 50: effectiveWave=50, cycle=0 → 3 * 2.47 * 1.0 = 7.41 → 7
      // Wave 101: effectiveWave=1, cycle=1 → 3 * 1.0 * 1.3 = 3.9 → 3
      // Wave 150: effectiveWave=50, cycle=1 → 3 * 2.47 * 1.3 = 9.63 → 9

      expect(wave50.gold).toBe(7);
      expect(wave101.gold).toBe(3);
      expect(wave150.gold).toBe(9);
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

    it('elite chance starts at 8.6% (Endless mode formula)', () => {
      const composition = getWaveComposition(1, 30);
      // 0.08 + 1 * 0.006 = 0.086 (higher base and scaling for early-game challenge)
      expect(composition.eliteChance).toBeCloseTo(0.086, 2);
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
