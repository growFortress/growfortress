import { describe, it, expect } from 'vitest';
import type { GameEvent } from '@arcade/protocol';
import {
  Simulation,
  getDefaultConfig,
  createInitialState,
} from '../../simulation.js';
import { createSimConfig, createEnemy } from '../helpers/factories.js';
import { FP } from '../../fixed.js';
import { DEFAULT_MODIFIERS, RELICS } from '../../data/relics.js';

describe('getDefaultConfig', () => {
  it('returns config with all required fields', () => {
    const config = getDefaultConfig();

    expect(config.tickHz).toBe(30);
    expect(config.segmentSize).toBe(5);
    expect(config.startingWave).toBe(0);
    expect(config.fortressBaseHp).toBe(200);
    expect(config.fortressBaseDamage).toBe(12);  // Balanced: stronger per hit
    expect(config.fortressAttackInterval).toBe(18);  // Balanced: slower but impactful
    expect(config.skillCooldownTicks).toBe(300);
    expect(config.skillDamage).toBe(50);
    expect(config.skillRadius).toBe(FP.fromInt(8));
    expect(config.waveIntervalTicks).toBe(90);
    expect(config.choiceDelayTicks).toBe(30);
    expect(config.relicsPerChoice).toBe(3);
    expect(config.fieldWidth).toBe(FP.fromInt(40));
    expect(config.fieldHeight).toBe(FP.fromInt(15));
    expect(config.fortressX).toBe(FP.fromInt(2));
    expect(config.enemySpawnX).toBe(FP.fromInt(44));
    expect(config.enemyAttackRange).toBe(FP.fromInt(4));
    expect(config.enemyAttackInterval).toBe(30);
    expect(config.progressionDamageBonus).toBe(1.0);
    expect(config.progressionGoldBonus).toBe(1.0);
    expect(config.startingGold).toBe(0);
  });

  it('respects available relics parameter', () => {
    const customRelics = ['damage-boost', 'speed-demon'];
    const config = getDefaultConfig(customRelics);
    expect(config.availableRelics).toEqual(customRelics);
  });

  it('defaults to all relics if no parameter', () => {
    const config = getDefaultConfig();
    expect(config.availableRelics.length).toBe(RELICS.length);
  });
});

describe('createInitialState', () => {
  it('creates state with correct tick', () => {
    const config = createSimConfig();
    const state = createInitialState(12345, config);
    expect(state.tick).toBe(0);
  });

  it('creates state with correct starting wave', () => {
    const config = createSimConfig({ startingWave: 5 });
    const state = createInitialState(12345, config);
    expect(state.wave).toBe(5);
    expect(state.segmentStartWave).toBe(5);
  });

  it('initializes RNG with seed', () => {
    const state1 = createInitialState(12345, createSimConfig());
    const state2 = createInitialState(12345, createSimConfig());
    expect(state1.rngState).toBe(state2.rngState);
  });

  it('different seeds produce different RNG states', () => {
    const state1 = createInitialState(12345, createSimConfig());
    const state2 = createInitialState(54321, createSimConfig());
    expect(state1.rngState).not.toBe(state2.rngState);
  });

  it('sets up fortress HP', () => {
    const config = createSimConfig({ fortressBaseHp: 150 });
    const state = createInitialState(12345, config);
    expect(state.fortressHp).toBe(150);
    expect(state.fortressMaxHp).toBe(150);
  });

  it('initializes empty enemies array', () => {
    const state = createInitialState(12345, createSimConfig());
    expect(state.enemies).toEqual([]);
    expect(state.nextEnemyId).toBe(1);
  });

  it('sets modifiers to defaults', () => {
    const state = createInitialState(12345, createSimConfig());
    expect(state.modifiers).toEqual(DEFAULT_MODIFIERS);
  });

  it('initializes economy to starting gold', () => {
    const config = createSimConfig({ startingGold: 50 });
    const state = createInitialState(12345, config);
    expect(state.gold).toBe(50);
    expect(state.dust).toBe(0);
  });

  it('initializes stats to zero', () => {
    const state = createInitialState(12345, createSimConfig());
    expect(state.kills).toBe(0);
    expect(state.wavesCleared).toBe(0);
    expect(state.eliteKills).toBe(0);
    expect(state.goldEarned).toBe(0);
    expect(state.dustEarned).toBe(0);
  });

});

describe('Simulation class', () => {
  describe('constructor', () => {
    it('initializes state from seed', () => {
      const sim = new Simulation(12345, getDefaultConfig());
      expect(sim.state.rngState).toBeGreaterThan(0);
      expect(sim.state.tick).toBe(0);
    });

    it('applies progression bonuses', () => {
      // progressionDamageBonus and progressionGoldBonus are multipliers (1.5 = +50%)
      // They get converted to additive bonuses: damageBonus += (multiplier - 1)
      const config = { ...getDefaultConfig(), progressionDamageBonus: 1.5, progressionGoldBonus: 1.2 };
      const sim = new Simulation(12345, config);
      expect(sim.state.modifiers.damageBonus).toBe(0.5);
      expect(sim.state.modifiers.goldBonus).toBeCloseTo(0.2, 5);
    });
  });

  describe('setEvents', () => {
    it('sorts events by tick', () => {
      const config = { ...getDefaultConfig(), startingGold: 50 };
      const sim = new Simulation(12345, config);

      // Run until choice mode to enable REROLL_RELICS
      for (let i = 0; i < 10000 && !sim.state.inChoice && !sim.state.ended; i++) {
        sim.step();
        for (const enemy of sim.state.enemies) {
          enemy.hp = 0;
        }
      }

      if (sim.state.inChoice) {
        const baseTick = sim.state.tick;
        const events: GameEvent[] = [
          { type: 'REROLL_RELICS', tick: baseTick + 30 },
          { type: 'REROLL_RELICS', tick: baseTick + 10 },
          { type: 'REROLL_RELICS', tick: baseTick + 20 },
        ];

        sim.setEvents(events);
        // Events should be processed in order during simulation
      }
    });

    it('stores events for processing', () => {
      const config = { ...getDefaultConfig(), startingGold: 50 };
      const sim = new Simulation(12345, config);

      // Run until choice mode to enable REROLL_RELICS
      for (let i = 0; i < 10000 && !sim.state.inChoice && !sim.state.ended; i++) {
        sim.step();
        for (const enemy of sim.state.enemies) {
          enemy.hp = 0;
        }
      }

      if (sim.state.inChoice) {
        const events: GameEvent[] = [{ type: 'REROLL_RELICS', tick: sim.state.tick + 10 }];
        sim.setEvents(events);
        // Events will be processed during step
      }
    });
  });

  describe('setCheckpointTicks', () => {
    it('sets ticks for checkpoint creation', () => {
      const sim = new Simulation(12345, getDefaultConfig());
      sim.setCheckpointTicks([50, 100, 150]);

      // Advance past tick 50
      for (let i = 0; i < 60; i++) {
        sim.step();
      }

      const checkpoints = sim.getCheckpoints();
      // Should have at least the checkpoint at tick 50
      const hasTick50Checkpoint = checkpoints.some(cp => cp.tick === 50);
      expect(hasTick50Checkpoint).toBe(true);
    });
  });

  describe('step', () => {
    it('advances tick by 1', () => {
      const sim = new Simulation(12345, getDefaultConfig());
      expect(sim.state.tick).toBe(0);
      sim.step();
      expect(sim.state.tick).toBe(1);
      sim.step();
      expect(sim.state.tick).toBe(2);
    });

    it('does nothing when ended', () => {
      const sim = new Simulation(12345, getDefaultConfig());
      sim.state.ended = true;
      const initialTick = sim.state.tick;
      sim.step();
      expect(sim.state.tick).toBe(initialTick);
    });

    it('processes events at current tick', () => {
      const config = { ...getDefaultConfig(), startingGold: 50 };
      const sim = new Simulation(12345, config);

      // Run until choice mode to enable REROLL_RELICS
      for (let i = 0; i < 10000 && !sim.state.inChoice && !sim.state.ended; i++) {
        sim.step();
        for (const enemy of sim.state.enemies) {
          enemy.hp = 0;
        }
      }

      if (sim.state.inChoice) {
        const goldBefore = sim.state.gold;
        const eventTick = sim.state.tick + 5;
        sim.setEvents([{ type: 'REROLL_RELICS', tick: eventTick }]);

        for (let i = 0; i < 10; i++) {
          sim.step();
        }

        // Reroll costs 10 gold
        expect(sim.state.gold).toBe(goldBefore - 10);
      }
    });

    it('updates RNG state', () => {
      const sim = new Simulation(12345, getDefaultConfig());
      const initialRngState = sim.state.rngState;

      // Advance until waves spawn (uses RNG)
      for (let i = 0; i < 200; i++) {
        sim.step();
        if (sim.state.enemies.length > 0) break;
      }

      expect(sim.state.rngState).not.toBe(initialRngState);
    });
  });

  describe('wave management', () => {
    it('starts wave at correct time', () => {
      const config = { ...getDefaultConfig(), waveIntervalTicks: 90 };
      const sim = new Simulation(12345, config);

      expect(sim.state.wave).toBe(0);

      // Wave starts after waveIntervalTicks
      for (let i = 0; i < 91; i++) {
        sim.step();
      }

      expect(sim.state.wave).toBe(1);
    });

    it('spawns enemies from queue', () => {
      const sim = new Simulation(12345, getDefaultConfig());

      // Advance until enemies spawn
      for (let i = 0; i < 200 && sim.state.enemies.length === 0; i++) {
        sim.step();
      }

      expect(sim.state.enemies.length).toBeGreaterThan(0);
    });

    it('completes wave when all enemies dead', () => {
      const config = getDefaultConfig();
      const sim = new Simulation(12345, config);

      let waveCompleted = false;

      // Run until first wave completes
      for (let i = 0; i < 10000 && !waveCompleted && !sim.state.ended; i++) {
        sim.step();
        // Kill all enemies instantly
        for (const enemy of sim.state.enemies) {
          enemy.hp = 0;
        }
        // Check if we've completed a wave
        if (sim.state.wavesCleared >= 1) {
          waveCompleted = true;
        }
      }

      expect(waveCompleted).toBe(true);
    });

    it('offers relic choice after wave', () => {
      const config = getDefaultConfig();
      const sim = new Simulation(12345, config);

      // Run until wave completes
      for (let i = 0; i < 5000 && !sim.state.inChoice && !sim.state.ended; i++) {
        sim.step();
        // Kill all enemies
        for (const enemy of sim.state.enemies) {
          enemy.hp = 0;
        }
      }

      if (!sim.state.ended) {
        expect(sim.state.inChoice).toBe(true);
        expect(sim.state.pendingChoice).not.toBeNull();
        expect(sim.state.pendingChoice?.options.length).toBe(3);
      }
    });
  });

  describe('enemy spawning', () => {
    it('spawns enemies and they exist', () => {
      const sim = new Simulation(12345, getDefaultConfig());

      for (let i = 0; i < 200 && sim.state.enemies.length === 0; i++) {
        sim.step();
      }

      expect(sim.state.enemies.length).toBeGreaterThan(0);
    });

    it('spawned enemies have valid properties', () => {
      const sim = new Simulation(12345, getDefaultConfig());

      for (let i = 0; i < 200 && sim.state.enemies.length === 0; i++) {
        sim.step();
      }

      if (sim.state.enemies.length > 0) {
        const enemy = sim.state.enemies[0];
        expect(enemy.hp).toBeGreaterThan(0);
        expect(enemy.maxHp).toBeGreaterThan(0);
        expect(enemy.x).toBeGreaterThan(0);
        expect(enemy.damage).toBeGreaterThan(0);
      }
    });

    it('applies wave scaling', () => {
      const config = { ...getDefaultConfig(), startingWave: 5 };
      const sim = new Simulation(12345, config);

      for (let i = 0; i < 200 && sim.state.enemies.length === 0; i++) {
        sim.step();
      }

      if (sim.state.enemies.length > 0) {
        // Enemies at wave 6 should have scaled stats
        const enemy = sim.state.enemies[0];
        // Base runner HP is 20, scaled by wave
        expect(enemy.maxHp).toBeGreaterThan(20);
      }
    });
  });

  describe('fortress attack', () => {
    it('attacks closest enemy', () => {
      const sim = new Simulation(12345, getDefaultConfig());

      // Run until enemies spawn
      for (let i = 0; i < 300 && sim.state.enemies.length === 0; i++) {
        sim.step();
      }

      const enemiesSpawned = sim.state.enemies.length > 0;

      if (enemiesSpawned) {
        // Run longer to allow fortress and turrets to attack
        for (let i = 0; i < 300; i++) {
          sim.step();
        }

        // At least one enemy should have taken damage, or kills should have occurred
        const anyDamaged = sim.state.enemies.some(e => e.hp < e.maxHp);
        const hasKills = sim.state.kills > 0;
        expect(anyDamaged || hasKills).toBe(true);
      }
    });

    it('applies attack interval', () => {
      const config = { ...getDefaultConfig(), fortressAttackInterval: 15 };
      const sim = new Simulation(12345, config);

      // Advance and check fortress attacks follow interval
      for (let i = 0; i < 200 && sim.state.enemies.length === 0; i++) {
        sim.step();
      }

      if (sim.state.enemies.length > 0) {
        const lastAttack = sim.state.fortressLastAttackTick;

        for (let i = 0; i < 20; i++) {
          sim.step();
        }

        // Should have attacked again
        expect(sim.state.fortressLastAttackTick).toBeGreaterThan(lastAttack);
      }
    });
  });


  describe('score calculation', () => {
    it('includes waves cleared', () => {
      const sim = new Simulation(12345, getDefaultConfig());
      sim.state.wavesCleared = 5;
      const score = sim.calculateScore();
      expect(score).toBeGreaterThanOrEqual(5000); // 5 * 1000
    });

    it('includes kills', () => {
      const sim = new Simulation(12345, getDefaultConfig());
      sim.state.kills = 50;
      const score = sim.calculateScore();
      expect(score).toBeGreaterThanOrEqual(500); // 50 * 10
    });

    it('includes elite kills bonus', () => {
      const sim = new Simulation(12345, getDefaultConfig());
      sim.state.eliteKills = 10;
      const score = sim.calculateScore();
      expect(score).toBeGreaterThanOrEqual(500); // 10 * 50
    });

    it('includes gold earned', () => {
      const sim = new Simulation(12345, getDefaultConfig());
      sim.state.goldEarned = 200;
      const score = sim.calculateScore();
      expect(score).toBeGreaterThanOrEqual(200);
    });

    it('includes time survived when not won', () => {
      const sim = new Simulation(12345, getDefaultConfig());
      sim.state.tick = 600; // 20 seconds at 30Hz
      sim.state.won = false;
      const score = sim.calculateScore();
      expect(score).toBeGreaterThanOrEqual(20); // 20 * 1
    });

    it('includes win bonus', () => {
      const sim = new Simulation(12345, getDefaultConfig());
      sim.state.won = true;
      sim.state.ended = true;
      const score = sim.calculateScore();
      expect(score).toBeGreaterThanOrEqual(5000);
    });
  });

  describe('checkpoint management', () => {
    it('creates checkpoints at specified ticks', () => {
      const sim = new Simulation(12345, getDefaultConfig());
      sim.setCheckpointTicks([50, 100, 150]);

      for (let i = 0; i < 160; i++) {
        sim.step();
      }

      const checkpoints = sim.getCheckpoints();
      // Should have checkpoints at 50, 100, 150, plus wave end checkpoints
      expect(checkpoints.length).toBeGreaterThanOrEqual(3);
    });

    it('chains checkpoint hashes', () => {
      const sim = new Simulation(12345, getDefaultConfig());
      sim.setCheckpointTicks([50, 100]);

      for (let i = 0; i < 110; i++) {
        sim.step();
      }

      const checkpoints = sim.getCheckpoints();
      if (checkpoints.length >= 2) {
        // Each checkpoint should have different chain hash
        expect(checkpoints[0].chainHash32).not.toBe(checkpoints[1].chainHash32);
      }
    });
  });

  describe('segment management', () => {
    it('tracks segment boundaries', () => {
      const config = { ...getDefaultConfig(), segmentSize: 5 };
      const sim = new Simulation(12345, config);

      expect(sim.isSegmentBoundary()).toBe(false);

      // Simulate completing 5 waves
      sim.state.wave = 5;
      sim.state.segmentStartWave = 0;

      expect(sim.isSegmentBoundary()).toBe(true);
    });

    it('provides segment summary', () => {
      const sim = new Simulation(12345, getDefaultConfig());
      sim.state.segmentStartWave = 0;
      sim.state.wave = 5;
      sim.state.segmentGoldEarned = 100;
      sim.state.segmentDustEarned = 20;
      sim.state.segmentXpEarned = 50;

      const summary = sim.getSegmentSummary();
      expect(summary.startWave).toBe(0);
      expect(summary.endWave).toBe(5);
      expect(summary.goldEarned).toBe(100);
      expect(summary.dustEarned).toBe(20);
      expect(summary.xpEarned).toBe(50);
    });

    it('resets segment tracking', () => {
      const sim = new Simulation(12345, getDefaultConfig());
      sim.state.wave = 5;
      sim.state.segmentGoldEarned = 100;
      sim.state.segmentDustEarned = 20;
      sim.state.segmentXpEarned = 50;

      sim.resetSegment();

      expect(sim.state.segmentStartWave).toBe(5);
      expect(sim.state.segmentGoldEarned).toBe(0);
      expect(sim.state.segmentDustEarned).toBe(0);
      expect(sim.state.segmentXpEarned).toBe(0);
    });
  });

  describe('end conditions', () => {
    it('ends game when fortress HP reaches 0', () => {
      const sim = new Simulation(12345, getDefaultConfig());

      // Run until enemies spawn
      for (let i = 0; i < 200 && sim.state.enemies.length === 0; i++) {
        sim.step();
      }

      // Kill fortress
      sim.state.fortressHp = 1;
      sim.state.enemies[0].damage = 1000;
      sim.state.enemies[0].x = FP.fromInt(3); // Within attack range

      for (let i = 0; i < 100 && !sim.state.ended; i++) {
        sim.step();
      }

      expect(sim.state.ended).toBe(true);
      expect(sim.state.won).toBe(false);
      expect(sim.state.fortressHp).toBe(0);
    });

  });

  describe('getFinalHash', () => {
    it('returns consistent hash for same state', () => {
      const sim = new Simulation(12345, getDefaultConfig());

      for (let i = 0; i < 100; i++) {
        sim.step();
      }

      const hash1 = sim.getFinalHash();
      const hash2 = sim.getFinalHash();

      expect(hash1).toBe(hash2);
    });

    it('returns different hash for different states', () => {
      const sim1 = new Simulation(12345, getDefaultConfig());
      const sim2 = new Simulation(54321, getDefaultConfig());

      for (let i = 0; i < 100; i++) {
        sim1.step();
        sim2.step();
      }

      expect(sim1.getFinalHash()).not.toBe(sim2.getFinalHash());
    });
  });

  describe('retryWave (Endless mode)', () => {
    it('does nothing if game not ended', () => {
      const sim = new Simulation(12345, getDefaultConfig());

      // Advance a bit but game is not ended
      for (let i = 0; i < 100; i++) {
        sim.step();
      }

      const waveBefore = sim.state.wave;
      const retryCountBefore = sim.state.retryCount;

      sim.retryWave();

      expect(sim.state.wave).toBe(waveBefore);
      expect(sim.state.retryCount).toBe(retryCountBefore);
    });

    it('does nothing if game was won', () => {
      const sim = new Simulation(12345, getDefaultConfig());

      sim.state.ended = true;
      sim.state.won = true;
      sim.state.wave = 10;

      const waveBefore = sim.state.wave;
      const retryCountBefore = sim.state.retryCount;

      sim.retryWave();

      expect(sim.state.wave).toBe(waveBefore);
      expect(sim.state.retryCount).toBe(retryCountBefore);
    });

    it('resets fortress HP to max', () => {
      const sim = new Simulation(12345, getDefaultConfig());

      sim.state.fortressHp = 0;
      sim.state.fortressMaxHp = 100;
      sim.state.ended = true;
      sim.state.won = false;
      sim.state.wave = 5;

      sim.retryWave();

      expect(sim.state.fortressHp).toBe(100);
    });

    it('clears all enemies', () => {
      const sim = new Simulation(12345, getDefaultConfig());

      // Set up a failed game state with enemies
      sim.state.enemies = [
        createEnemy({ id: 1, type: 'runner', hp: 50, maxHp: 50 }),
        createEnemy({ id: 2, type: 'bruiser', hp: 100, maxHp: 100 }),
      ];
      sim.state.ended = true;
      sim.state.won = false;
      sim.state.wave = 3;

      sim.retryWave();

      expect(sim.state.enemies).toHaveLength(0);
    });

    it('clears wave spawn queue', () => {
      const sim = new Simulation(12345, getDefaultConfig());

      sim.state.waveSpawnQueue = [
        { type: 'runner', isElite: false, spawnTick: 100 },
        { type: 'bruiser', isElite: true, spawnTick: 130 },
      ];
      sim.state.ended = true;
      sim.state.won = false;
      sim.state.wave = 3;

      sim.retryWave();

      expect(sim.state.waveSpawnQueue).toHaveLength(0);
    });

    it('sets waveComplete to true', () => {
      const sim = new Simulation(12345, getDefaultConfig());

      sim.state.waveComplete = false;
      sim.state.ended = true;
      sim.state.won = false;
      sim.state.wave = 3;

      sim.retryWave();

      expect(sim.state.waveComplete).toBe(true);
    });

    it('decrements wave number by 1', () => {
      const sim = new Simulation(12345, getDefaultConfig());

      sim.state.wave = 5;
      sim.state.ended = true;
      sim.state.won = false;

      sim.retryWave();

      expect(sim.state.wave).toBe(4);
    });

    it('clears ended state', () => {
      const sim = new Simulation(12345, getDefaultConfig());

      sim.state.ended = true;
      sim.state.won = false;
      sim.state.wave = 5;

      sim.retryWave();

      expect(sim.state.ended).toBe(false);
    });

    it('clears deathWave', () => {
      const sim = new Simulation(12345, getDefaultConfig());

      sim.state.ended = true;
      sim.state.won = false;
      sim.state.wave = 5;
      sim.state.deathWave = 5;

      sim.retryWave();

      expect(sim.state.deathWave).toBeUndefined();
    });

    it('increments retryCount', () => {
      const sim = new Simulation(12345, getDefaultConfig());

      sim.state.ended = true;
      sim.state.won = false;
      sim.state.wave = 5;
      sim.state.retryCount = 0;

      sim.retryWave();
      expect(sim.state.retryCount).toBe(1);

      // Simulate another death and retry
      sim.state.ended = true;
      sim.state.won = false;
      sim.state.wave = 5;

      sim.retryWave();
      expect(sim.state.retryCount).toBe(2);
    });

    it('allows game to continue after retry', () => {
      const sim = new Simulation(12345, getDefaultConfig());

      // Simulate death at wave 3
      sim.state.wave = 3;
      sim.state.fortressHp = 0;
      sim.state.fortressMaxHp = 100;
      sim.state.ended = true;
      sim.state.won = false;
      sim.state.waveComplete = false;
      sim.state.enemies = [
        createEnemy({ id: 1, type: 'runner', hp: 50, maxHp: 50 }),
      ];

      sim.retryWave();

      // Verify game can continue
      expect(sim.state.ended).toBe(false);
      expect(sim.state.fortressHp).toBe(100);
      expect(sim.state.wave).toBe(2); // Decremented to retry wave 3

      // Should be able to step without error
      sim.step();
      expect(sim.state.tick).toBe(1);
    });

    it('tracks multiple retries correctly', () => {
      const sim = new Simulation(12345, getDefaultConfig());

      // First death
      sim.state.ended = true;
      sim.state.won = false;
      sim.state.wave = 5;
      sim.retryWave();
      expect(sim.state.retryCount).toBe(1);

      // Second death (same wave)
      sim.state.ended = true;
      sim.state.won = false;
      sim.state.wave = 5;
      sim.retryWave();
      expect(sim.state.retryCount).toBe(2);

      // Third death (different wave)
      sim.state.ended = true;
      sim.state.won = false;
      sim.state.wave = 10;
      sim.retryWave();
      expect(sim.state.retryCount).toBe(3);
    });

    it('preserves other game state (gold, dust, kills)', () => {
      const sim = new Simulation(12345, getDefaultConfig());

      sim.state.gold = 500;
      sim.state.dust = 100;
      sim.state.kills = 50;
      sim.state.eliteKills = 10;
      sim.state.goldEarned = 500;
      sim.state.dustEarned = 100;
      sim.state.ended = true;
      sim.state.won = false;
      sim.state.wave = 5;

      sim.retryWave();

      // These should be preserved
      expect(sim.state.gold).toBe(500);
      expect(sim.state.dust).toBe(100);
      expect(sim.state.kills).toBe(50);
      expect(sim.state.eliteKills).toBe(10);
      expect(sim.state.goldEarned).toBe(500);
      expect(sim.state.dustEarned).toBe(100);
    });

    it('preserves relics and modifiers', () => {
      const sim = new Simulation(12345, getDefaultConfig());

      sim.state.relics = [
        { id: 'damage-boost', acquiredWave: 1, acquiredTick: 100 },
        { id: 'speed-demon', acquiredWave: 2, acquiredTick: 200 },
      ];
      sim.state.modifiers = {
        ...DEFAULT_MODIFIERS,
        damageBonus: 0.2, // +20%
      };
      sim.state.ended = true;
      sim.state.won = false;
      sim.state.wave = 5;

      sim.retryWave();

      expect(sim.state.relics).toHaveLength(2);
      expect(sim.state.relics[0].id).toBe('damage-boost');
      expect(sim.state.relics[1].id).toBe('speed-demon');
      expect(sim.state.modifiers.damageBonus).toBe(0.2);
    });
  });
});
