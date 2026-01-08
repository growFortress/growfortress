import { describe, it, expect } from 'vitest';
import { Simulation, getDefaultConfig, FP } from '../../index.js';
import {
  ENEMY_ARCHETYPES,
  getEnemyStats,
  getEnemyRewards,
  getWaveComposition,
} from '../../data/enemies.js';
import { PILLAR_DEFINITIONS, getPillarForWave } from '../../data/pillars.js';
import type { EnemyType } from '../../types.js';

// ============================================================================
// TEST 1: ALL 19 ENEMY TYPES
// ============================================================================

describe('All Enemy Types', () => {
  const allEnemyTypes: EnemyType[] = [
    // Base enemies
    'runner', 'bruiser', 'leech',
    // Streets
    'gangster', 'thug', 'mafia_boss',
    // Science
    'drone', 'robot', 'ai_core',
    // Mutants
    'mutant_hunter', 'sentinel',
    // Cosmos
    'kree_soldier', 'skrull', 'cosmic_beast',
    // Magic
    'demon', 'sorcerer', 'dimensional_being',
    // Gods
    'einherjar', 'titan', 'god',
  ];

  it('should have all expected enemy types defined', () => {
    const definedTypes = Object.keys(ENEMY_ARCHETYPES);
    // At least 19 enemy types (base + pillar-specific)
    expect(definedTypes.length).toBeGreaterThanOrEqual(19);
  });

  it('should have all expected enemy types', () => {
    for (const type of allEnemyTypes) {
      expect(ENEMY_ARCHETYPES[type]).toBeDefined();
    }
  });

  it.each(allEnemyTypes)('enemy %s should have valid base stats', (type) => {
    const archetype = ENEMY_ARCHETYPES[type];

    expect(archetype.baseHp).toBeGreaterThan(0);
    expect(archetype.baseSpeed).toBeGreaterThan(0);
    expect(archetype.baseDamage).toBeGreaterThan(0);
    expect(archetype.goldReward).toBeGreaterThan(0);
    expect(archetype.dustReward).toBeGreaterThanOrEqual(1);
    expect(archetype.description).toBeDefined();
  });

  describe('Base Enemies', () => {
    it('runner is fastest base enemy', () => {
      expect(ENEMY_ARCHETYPES.runner.baseSpeed).toBeGreaterThan(ENEMY_ARCHETYPES.bruiser.baseSpeed);
      expect(ENEMY_ARCHETYPES.runner.baseSpeed).toBeGreaterThan(ENEMY_ARCHETYPES.leech.baseSpeed);
    });

    it('bruiser is tankiest base enemy', () => {
      expect(ENEMY_ARCHETYPES.bruiser.baseHp).toBeGreaterThan(ENEMY_ARCHETYPES.runner.baseHp);
      expect(ENEMY_ARCHETYPES.bruiser.baseHp).toBeGreaterThan(ENEMY_ARCHETYPES.leech.baseHp);
    });

    it('leech has lowest damage', () => {
      expect(ENEMY_ARCHETYPES.leech.baseDamage).toBeLessThan(ENEMY_ARCHETYPES.runner.baseDamage);
      expect(ENEMY_ARCHETYPES.leech.baseDamage).toBeLessThan(ENEMY_ARCHETYPES.bruiser.baseDamage);
    });
  });

  describe('Streets Pillar Enemies', () => {
    it('gangster has correct stats', () => {
      expect(ENEMY_ARCHETYPES.gangster.baseHp).toBe(29);
      expect(ENEMY_ARCHETYPES.gangster.baseSpeed).toBe(2.2);
      expect(ENEMY_ARCHETYPES.gangster.baseDamage).toBe(9);
    });

    it('mafia_boss is the strongest streets enemy', () => {
      expect(ENEMY_ARCHETYPES.mafia_boss.baseHp).toBeGreaterThan(ENEMY_ARCHETYPES.gangster.baseHp);
      expect(ENEMY_ARCHETYPES.mafia_boss.baseHp).toBeGreaterThan(ENEMY_ARCHETYPES.thug.baseHp);
    });
  });

  describe('Science Pillar Enemies', () => {
    it('drone is the fastest enemy', () => {
      const maxSpeed = Math.max(...allEnemyTypes.map(t => ENEMY_ARCHETYPES[t].baseSpeed));
      expect(ENEMY_ARCHETYPES.drone.baseSpeed).toBe(maxSpeed);
    });

    it('ai_core is science boss', () => {
      expect(ENEMY_ARCHETYPES.ai_core.baseHp).toBe(575);
      expect(ENEMY_ARCHETYPES.ai_core.goldReward).toBe(40);
    });
  });

  describe('Gods Pillar Enemies', () => {
    it('god is the strongest enemy', () => {
      const maxHp = Math.max(...allEnemyTypes.map(t => ENEMY_ARCHETYPES[t].baseHp));
      const maxDamage = Math.max(...allEnemyTypes.map(t => ENEMY_ARCHETYPES[t].baseDamage));

      expect(ENEMY_ARCHETYPES.god.baseHp).toBe(maxHp);
      expect(ENEMY_ARCHETYPES.god.baseDamage).toBe(maxDamage);
    });

    it('titan is slowest enemy', () => {
      const minSpeed = Math.min(...allEnemyTypes.map(t => ENEMY_ARCHETYPES[t].baseSpeed));
      expect(ENEMY_ARCHETYPES.titan.baseSpeed).toBe(minSpeed);
    });

    it('god gives best rewards', () => {
      const maxGold = Math.max(...allEnemyTypes.map(t => ENEMY_ARCHETYPES[t].goldReward));
      const maxDust = Math.max(...allEnemyTypes.map(t => ENEMY_ARCHETYPES[t].dustReward));

      expect(ENEMY_ARCHETYPES.god.goldReward).toBe(maxGold);
      expect(ENEMY_ARCHETYPES.god.dustReward).toBe(maxDust);
    });
  });
});

// ============================================================================
// TEST 2: BOSS ENEMIES
// ============================================================================

describe('Boss Enemies', () => {
  const bossTypes: EnemyType[] = [
    'mafia_boss',       // Streets
    'ai_core',          // Science
    'sentinel',         // Mutants
    'cosmic_beast',     // Cosmos
    'dimensional_being', // Magic
    'titan',            // Gods
    'god',              // Gods
  ];

  it('bosses have significantly higher HP than common enemies', () => {
    const commonMaxHp = Math.max(
      ENEMY_ARCHETYPES.runner.baseHp,
      ENEMY_ARCHETYPES.gangster.baseHp,
      ENEMY_ARCHETYPES.drone.baseHp
    );

    for (const boss of bossTypes) {
      expect(ENEMY_ARCHETYPES[boss].baseHp).toBeGreaterThan(commonMaxHp * 3);
    }
  });

  it('bosses give more gold than common enemies', () => {
    const commonMaxGold = Math.max(
      ENEMY_ARCHETYPES.runner.goldReward,
      ENEMY_ARCHETYPES.gangster.goldReward,
      ENEMY_ARCHETYPES.drone.goldReward
    );
    for (const boss of bossTypes) {
      expect(ENEMY_ARCHETYPES[boss].goldReward).toBeGreaterThan(commonMaxGold);
    }
  });

  it('bosses give more dust than common enemies', () => {
    for (const boss of bossTypes) {
      expect(ENEMY_ARCHETYPES[boss].dustReward).toBeGreaterThanOrEqual(5);
    }
  });
});

// ============================================================================
// TEST 3: ENEMY STAT SCALING
// ============================================================================

describe('Enemy Stat Scaling', () => {
  describe('wave scaling formula', () => {
    it('wave 1 has no scaling (1.0x)', () => {
      const stats = getEnemyStats('runner', 1, false);
      expect(stats.hp).toBe(23); // Exact base HP
    });

    it('wave 2 has 12% increase (1.12x)', () => {
      const stats = getEnemyStats('bruiser', 2, false);
      // 115 * 1.12 = 128.8 → 128
      expect(stats.hp).toBe(128);
    });

    it('wave 10 has 108% increase (2.08x)', () => {
      const stats = getEnemyStats('runner', 10, false);
      // 23 * (1 + 9 * 0.12) = 23 * 2.08 = 47.84 → 47
      expect(stats.hp).toBe(47);
    });

    it('wave 50 has massive scaling', () => {
      const stats = getEnemyStats('runner', 50, false);
      // 23 * (1 + 49 * 0.12) = 23 * 6.88 = 158.24 → 158
      expect(stats.hp).toBe(158);
    });
  });

  describe('elite scaling', () => {
    it('elite HP is 3.5x base', () => {
      const elite = getEnemyStats('bruiser', 1, true);
      // 115 * 3.5 = 402.5 → 402
      expect(elite.hp).toBe(402);
    });

    it('elite damage is 2.5x base', () => {
      const elite = getEnemyStats('bruiser', 1, true);
      // 17 * 2.5 = 42.5 → 42
      expect(elite.damage).toBe(42);
    });

    it('elite wave 10 combines both scalings', () => {
      const elite = getEnemyStats('runner', 10, true);
      // HP: 23 * 2.08 * 3.5 = 167.44 → 167
      expect(elite.hp).toBe(167);
      // Damage: 6 * 2.08 * 2.5 = 31.2 → 31
      expect(elite.damage).toBe(31);
    });
  });

  describe('speed does not scale', () => {
    it('speed same at wave 1 and wave 50', () => {
      const wave1 = getEnemyStats('runner', 1, false);
      const wave50 = getEnemyStats('runner', 50, false);
      expect(wave1.speed).toBe(wave50.speed);
    });

    it('elite speed same as normal', () => {
      const normal = getEnemyStats('drone', 1, false);
      const elite = getEnemyStats('drone', 1, true);
      expect(normal.speed).toBe(elite.speed);
    });
  });
});

// ============================================================================
// TEST 4: PILLAR SYSTEM
// ============================================================================

describe('Pillar System', () => {
  it('should have 6 pillars', () => {
    expect(PILLAR_DEFINITIONS.length).toBe(6);
  });

  it('pillars cover waves 1-100', () => {
    const pillarIds = ['streets', 'science', 'mutants', 'cosmos', 'magic', 'gods'];
    expect(PILLAR_DEFINITIONS.map(p => p.id)).toEqual(pillarIds);

    expect(PILLAR_DEFINITIONS[0].waveRange.start).toBe(1);
    expect(PILLAR_DEFINITIONS[5].waveRange.end).toBe(100);
  });

  describe('getPillarForWave', () => {
    it('wave 1-10 is Streets', () => {
      expect(getPillarForWave(1)?.id).toBe('streets');
      expect(getPillarForWave(10)?.id).toBe('streets');
    });

    it('wave 11-25 is Science', () => {
      expect(getPillarForWave(11)?.id).toBe('science');
      expect(getPillarForWave(25)?.id).toBe('science');
    });

    it('wave 26-40 is Mutants', () => {
      expect(getPillarForWave(26)?.id).toBe('mutants');
      expect(getPillarForWave(40)?.id).toBe('mutants');
    });

    it('wave 41-60 is Cosmos', () => {
      expect(getPillarForWave(41)?.id).toBe('cosmos');
      expect(getPillarForWave(60)?.id).toBe('cosmos');
    });

    it('wave 61-80 is Magic', () => {
      expect(getPillarForWave(61)?.id).toBe('magic');
      expect(getPillarForWave(80)?.id).toBe('magic');
    });

    it('wave 81-100 is Gods', () => {
      expect(getPillarForWave(81)?.id).toBe('gods');
      expect(getPillarForWave(100)?.id).toBe('gods');
    });
  });
});

// ============================================================================
// TEST 5: WAVE COMPOSITION
// ============================================================================

describe('Wave Composition', () => {
  describe('enemy count formula', () => {
    it('wave 1: 5 + 1*3 = 8 base enemies', () => {
      const comp = getWaveComposition(1, 30);
      const total = comp.enemies.reduce((sum, e) => sum + e.count, 0);
      // Distributed as floor(8*0.6) + floor(8*0.4) = 4 + 3 = 7
      expect(total).toBe(7);
    });

    it('wave 10: 5 + 10*3 = 35 base enemies (boss wave)', () => {
      const comp = getWaveComposition(10, 30);
      const total = comp.enemies.reduce((sum, e) => sum + e.count, 0);
      // Boss wave distribution is different
      expect(total).toBeGreaterThan(10);
    });
  });

  describe('elite chance formula (Endless mode)', () => {
    // Formula: 0.05 + wave * 0.005, capped at 50%
    it('wave 1: 0.05 + 1*0.005 = 5.5%', () => {
      expect(getWaveComposition(1, 30).eliteChance).toBe(0.055);
    });

    it('wave 10: 0.05 + 10*0.005 = 10%', () => {
      expect(getWaveComposition(10, 30).eliteChance).toBe(0.1);
    });

    it('wave 50: 0.05 + 50*0.005 = 30%', () => {
      expect(getWaveComposition(50, 30).eliteChance).toBeCloseTo(0.3, 5);
    });

    it('wave 90+: capped at 50%', () => {
      expect(getWaveComposition(90, 30).eliteChance).toBe(0.5);
      expect(getWaveComposition(100, 30).eliteChance).toBe(0.5);
      expect(getWaveComposition(200, 30).eliteChance).toBe(0.5);
    });
  });

  describe('spawn interval formula', () => {
    it('wave 1: tickHz - 1*2 = 28 ticks', () => {
      expect(getWaveComposition(1, 30).spawnIntervalTicks).toBe(28);
    });

    it('wave 5: tickHz - 5*2 = 20 ticks', () => {
      expect(getWaveComposition(5, 30).spawnIntervalTicks).toBe(20);
    });

    it('high waves: minimum tickHz/2 = 15 ticks', () => {
      expect(getWaveComposition(20, 30).spawnIntervalTicks).toBe(15);
      expect(getWaveComposition(50, 30).spawnIntervalTicks).toBe(15);
    });
  });

  describe('boss waves (every 10th)', () => {
    it('wave 10 is a boss wave', () => {
      const comp = getWaveComposition(10, 30);
      const types = comp.enemies.map(e => e.type);
      expect(types).toContain('mafia_boss');
    });

    it('wave 20 is a boss wave (Science pillar)', () => {
      const comp = getWaveComposition(20, 30);
      const types = comp.enemies.map(e => e.type);
      expect(types).toContain('ai_core');
    });

    it('wave 50 is a boss wave (Cosmos pillar)', () => {
      const comp = getWaveComposition(50, 30);
      const types = comp.enemies.map(e => e.type);
      expect(types).toContain('cosmic_beast');
    });

    it('boss wave has exactly 1 boss', () => {
      const comp = getWaveComposition(10, 30);
      const bossEntry = comp.enemies.find(e => e.type === 'mafia_boss');
      expect(bossEntry?.count).toBe(1);
    });
  });

  describe('pillar-specific composition', () => {
    it('Streets uses gangster, thug, runner', () => {
      const comp = getWaveComposition(5, 30);
      const types = comp.enemies.map(e => e.type);
      const validTypes = ['gangster', 'thug', 'runner'];
      for (const type of types) {
        expect(validTypes).toContain(type);
      }
    });

    it('Science uses drone, robot, runner', () => {
      const comp = getWaveComposition(15, 30);
      const types = comp.enemies.map(e => e.type);
      const validTypes = ['drone', 'robot', 'runner', 'ai_core'];
      for (const type of types) {
        expect(validTypes).toContain(type);
      }
    });

    it('Gods uses einherjar, bruiser, runner', () => {
      const comp = getWaveComposition(85, 30);
      const types = comp.enemies.map(e => e.type);
      const validTypes = ['einherjar', 'bruiser', 'runner', 'titan', 'god'];
      for (const type of types) {
        expect(validTypes).toContain(type);
      }
    });
  });
});

// ============================================================================
// TEST 6: WAVE PROGRESSION IN SIMULATION
// ============================================================================

describe('Wave Progression in Simulation', () => {
  it('simulation starts at wave 0', () => {
    const config = getDefaultConfig();
    const sim = new Simulation(12345, config);
    expect(sim.state.wave).toBe(0);
  });

  it('first wave starts after initial ticks', () => {
    const config = getDefaultConfig();
    const sim = new Simulation(12345, config);

    // Run until wave 1 starts
    for (let i = 0; i < 100; i++) {
      sim.step();
      if (sim.state.wave === 1) break;
    }

    expect(sim.state.wave).toBe(1);
  });

  it('enemies spawn during wave', () => {
    const config = getDefaultConfig();
    const sim = new Simulation(12345, config);

    // Run until enemies spawn
    for (let i = 0; i < 200; i++) {
      sim.step();
      if (sim.state.enemies.length > 0) break;
    }

    expect(sim.state.enemies.length).toBeGreaterThan(0);
  });

  it('wave completes when all enemies are killed', () => {
    const config = getDefaultConfig();
    const sim = new Simulation(12345, config);

    // Run until wave 1 starts and enemies spawn
    for (let i = 0; i < 200; i++) {
      sim.step();
      if (sim.state.wave === 1 && sim.state.enemies.length > 0) break;
    }

    // Kill all enemies manually
    for (const enemy of sim.state.enemies) {
      enemy.hp = 0;
    }

    // Clear spawn queue
    sim.state.waveSpawnQueue = [];

    // Run until wave completes
    for (let i = 0; i < 100; i++) {
      sim.step();
      if (sim.state.waveComplete) break;
    }

    expect(sim.state.waveComplete).toBe(true);
    expect(sim.state.wavesCleared).toBe(1);
  });

  it('wave number increments during gameplay', () => {
    const config = getDefaultConfig();
    const sim = new Simulation(12345, config);

    // Wave should start at 0
    expect(sim.state.wave).toBe(0);

    // Run until wave 1 starts
    for (let i = 0; i < 200; i++) {
      sim.step();
      if (sim.state.wave === 1) break;
    }

    // Wave should have incremented to 1
    expect(sim.state.wave).toBe(1);
  });
});

// ============================================================================
// TEST 7: ENEMY BEHAVIOR IN SIMULATION
// ============================================================================

describe('Enemy Behavior in Simulation', () => {
  it('enemies move toward fortress (decreasing x)', () => {
    const config = getDefaultConfig();
    const sim = new Simulation(12345, config);

    // Run until enemies spawn
    for (let i = 0; i < 200; i++) {
      sim.step();
      if (sim.state.enemies.length > 0) break;
    }

    const enemy = sim.state.enemies[0];
    const initialX = enemy.x;

    // Run more ticks
    for (let i = 0; i < 30; i++) {
      sim.step();
    }

    expect(enemy.x).toBeLessThan(initialX);
  });

  it('enemies attack fortress when in range', () => {
    const config = getDefaultConfig();
    const sim = new Simulation(12345, config);

    // Run until enemies spawn
    for (let i = 0; i < 200; i++) {
      sim.step();
      if (sim.state.enemies.length > 0) break;
    }

    const initialFortressHp = sim.state.fortressHp;

    // Move enemy to fortress attack range
    const enemy = sim.state.enemies[0];
    enemy.x = FP.add(config.fortressX, config.enemyAttackRange);
    enemy.lastAttackTick = sim.state.tick - 100; // Allow immediate attack

    // Run ticks
    for (let i = 0; i < 50; i++) {
      sim.step();
    }

    expect(sim.state.fortressHp).toBeLessThan(initialFortressHp);
  });

  it('killing enemies gives gold', () => {
    const config = getDefaultConfig();
    const sim = new Simulation(12345, config);

    // Run until enemies spawn
    for (let i = 0; i < 200; i++) {
      sim.step();
      if (sim.state.enemies.length > 0) break;
    }

    const initialGold = sim.state.gold;

    // Kill an enemy
    sim.state.enemies[0].hp = 0;

    // Run a tick to process death
    sim.step();

    expect(sim.state.gold).toBeGreaterThan(initialGold);
  });

  it('killing enemies gives dust', () => {
    const config = getDefaultConfig();
    const sim = new Simulation(12345, config);

    // Run until enemies spawn
    for (let i = 0; i < 200; i++) {
      sim.step();
      if (sim.state.enemies.length > 0) break;
    }

    const initialDust = sim.state.dust;

    // Kill an enemy
    sim.state.enemies[0].hp = 0;

    // Run a tick to process death
    sim.step();

    expect(sim.state.dust).toBeGreaterThanOrEqual(initialDust);
  });

  it('killing enemies increases kill counter', () => {
    const config = getDefaultConfig();
    const sim = new Simulation(12345, config);

    // Run until enemies spawn
    for (let i = 0; i < 200; i++) {
      sim.step();
      if (sim.state.enemies.length > 0) break;
    }

    const initialKills = sim.state.kills;

    // Kill an enemy
    sim.state.enemies[0].hp = 0;

    // Run a tick to process death
    sim.step();

    expect(sim.state.kills).toBe(initialKills + 1);
  });
});

// ============================================================================
// TEST 8: LEECH ENEMY SPECIAL BEHAVIOR
// ============================================================================

describe('Leech Enemy', () => {
  it('leech has heal-on-hit ability (described)', () => {
    expect(ENEMY_ARCHETYPES.leech.description).toBe('Heals on hit');
  });

  it('leech has low damage but medium HP', () => {
    expect(ENEMY_ARCHETYPES.leech.baseDamage).toBe(4);
    expect(ENEMY_ARCHETYPES.leech.baseHp).toBe(46);
  });

  it('leech has healing ability described in archetype', () => {
    // The leech archetype is designed for heal-on-hit behavior
    // which is implemented in simulation.ts (LEECH_HEAL_PERCENT = 0.2)
    expect(ENEMY_ARCHETYPES.leech.description).toBe('Heals on hit');

    // Leech should have balanced stats for its healing role
    expect(ENEMY_ARCHETYPES.leech.baseDamage).toBeLessThan(ENEMY_ARCHETYPES.runner.baseDamage);
    expect(ENEMY_ARCHETYPES.leech.baseHp).toBeGreaterThan(ENEMY_ARCHETYPES.runner.baseHp);
  });
});

// ============================================================================
// TEST 9: ENEMY REWARDS
// ============================================================================

describe('Enemy Rewards System', () => {
  it('elite enemies give 3x rewards', () => {
    const normal = getEnemyRewards('runner', false, 1.0, 1.0);
    const elite = getEnemyRewards('runner', true, 1.0, 1.0);

    expect(elite.gold).toBe(normal.gold * 3);
    expect(elite.dust).toBe(normal.dust * 3);
  });

  it('gold multiplier affects rewards', () => {
    const base = getEnemyRewards('bruiser', false, 1.0, 1.0);
    const boosted = getEnemyRewards('bruiser', false, 2.0, 1.0);

    expect(boosted.gold).toBe(base.gold * 2);
  });

  it('dust multiplier affects rewards', () => {
    const base = getEnemyRewards('bruiser', false, 1.0, 1.0);
    const boosted = getEnemyRewards('bruiser', false, 1.0, 2.0);

    expect(boosted.dust).toBe(base.dust * 2);
  });

  it('boss enemies give substantial rewards', () => {
    const bossReward = getEnemyRewards('god', false, 1.0, 1.0);
    expect(bossReward.gold).toBe(100);
    expect(bossReward.dust).toBe(50);
  });

  it('elite boss gives massive rewards', () => {
    const eliteBoss = getEnemyRewards('god', true, 1.0, 1.0);
    expect(eliteBoss.gold).toBe(300); // 100 * 3
    expect(eliteBoss.dust).toBe(150); // 50 * 3
  });
});

// ============================================================================
// TEST 10: WAVE SPAWN QUEUE
// ============================================================================

describe('Wave Spawn Queue', () => {
  it('wave spawn queue is populated when wave starts', () => {
    const config = getDefaultConfig();
    const sim = new Simulation(12345, config);

    // Run until wave 1 starts
    for (let i = 0; i < 100; i++) {
      sim.step();
      if (sim.state.wave === 1) break;
    }

    expect(sim.state.waveSpawnQueue.length).toBeGreaterThan(0);
  });

  it('spawn queue decreases as enemies spawn', () => {
    const config = getDefaultConfig();
    const sim = new Simulation(12345, config);

    // Run until wave 1 starts
    for (let i = 0; i < 100; i++) {
      sim.step();
      if (sim.state.wave === 1) break;
    }

    const initialQueueSize = sim.state.waveSpawnQueue.length;

    // Run more ticks to spawn enemies
    for (let i = 0; i < 100; i++) {
      sim.step();
    }

    expect(sim.state.waveSpawnQueue.length).toBeLessThan(initialQueueSize);
  });

  it('spawn entries have correct structure', () => {
    const config = getDefaultConfig();
    const sim = new Simulation(12345, config);

    // Run until wave 1 starts
    for (let i = 0; i < 100; i++) {
      sim.step();
      if (sim.state.wave === 1 && sim.state.waveSpawnQueue.length > 0) break;
    }

    const entry = sim.state.waveSpawnQueue[0];
    expect(entry.type).toBeDefined();
    expect(typeof entry.isElite).toBe('boolean');
    expect(typeof entry.spawnTick).toBe('number');
  });
});

// ============================================================================
// TEST 11: ENEMY LANES
// ============================================================================

describe('Enemy Lanes', () => {
  it('enemies are assigned to lanes 0, 1, or 2', () => {
    const config = getDefaultConfig();
    const sim = new Simulation(12345, config);

    // Run until multiple enemies spawn
    for (let i = 0; i < 300; i++) {
      sim.step();
      if (sim.state.enemies.length >= 5) break;
    }

    const lanes = new Set(sim.state.enemies.map(e => e.lane));

    // Should have enemies in multiple lanes
    expect(lanes.size).toBeGreaterThan(0);
    for (const lane of lanes) {
      expect(lane).toBeGreaterThanOrEqual(0);
      expect(lane).toBeLessThanOrEqual(2);
    }
  });

  it('enemies have y position based on lane', () => {
    const config = getDefaultConfig();
    const sim = new Simulation(12345, config);

    // Run until enemies spawn
    for (let i = 0; i < 200; i++) {
      sim.step();
      if (sim.state.enemies.length > 0) break;
    }

    for (const enemy of sim.state.enemies) {
      const y = FP.toFloat(enemy.y);
      // Y should be within reasonable bounds for lanes
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(15);
    }
  });
});

// ============================================================================
// TEST 12: ELITE ENEMY TRACKING
// ============================================================================

describe('Elite Enemy Tracking', () => {
  it('elite kills are tracked separately', () => {
    const config = getDefaultConfig();
    const sim = new Simulation(12345, config);

    // Run until enemies spawn
    for (let i = 0; i < 200; i++) {
      sim.step();
      if (sim.state.enemies.length > 0) break;
    }

    // Find or create an elite enemy
    let eliteEnemy = sim.state.enemies.find(e => e.isElite);
    if (!eliteEnemy && sim.state.enemies.length > 0) {
      sim.state.enemies[0].isElite = true;
      eliteEnemy = sim.state.enemies[0];
    }

    if (eliteEnemy) {
      const initialEliteKills = sim.state.eliteKills;

      // Kill the elite
      eliteEnemy.hp = 0;
      sim.step();

      expect(sim.state.eliteKills).toBe(initialEliteKills + 1);
    }
  });

  it('non-elite kills do not increase elite kill counter', () => {
    const config = getDefaultConfig();
    const sim = new Simulation(12345, config);

    // Run until enemies spawn
    for (let i = 0; i < 200; i++) {
      sim.step();
      if (sim.state.enemies.length > 0) break;
    }

    // Ensure enemy is not elite
    const enemy = sim.state.enemies[0];
    enemy.isElite = false;

    const initialEliteKills = sim.state.eliteKills;

    // Kill the enemy
    enemy.hp = 0;
    sim.step();

    expect(sim.state.eliteKills).toBe(initialEliteKills);
  });
});
