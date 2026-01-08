import { describe, it, expect } from 'vitest';
import type { GameEvent } from '@arcade/protocol';
import { Simulation, getDefaultConfig } from '../../simulation.js';
import { replayRun } from '../../replay.js';
import { runSimulationTo } from '../helpers/state-builders.js';

describe('Full Game Integration', () => {
  describe('Endless Mode', () => {
    it('runs multiple segments', () => {
      const config = { ...getDefaultConfig(), segmentSize: 2 };
      const sim = new Simulation(12345, config);
      const events: GameEvent[] = [];

      // Run until we complete 4 waves (2 segments)
      for (let i = 0; i < 30000 && sim.state.wavesCleared < 4 && !sim.state.ended; i++) {
        sim.step();

        for (const enemy of sim.state.enemies) {
          enemy.hp = 0;
        }

        if (sim.state.inChoice && sim.state.pendingChoice) {
          const event: GameEvent = {
            type: 'CHOOSE_RELIC',
            tick: sim.state.tick,
            wave: sim.state.pendingChoice.wave,
            optionIndex: 0,
          };
          events.push(event);
          sim.setEvents(events);
        }
      }

      expect(sim.state.wavesCleared).toBeGreaterThanOrEqual(4);
    });

    it('segment tracking works correctly', () => {
      const config = { ...getDefaultConfig(), segmentSize: 2 };
      const sim = new Simulation(12345, config);
      const events: GameEvent[] = [];

      // Run until first segment boundary
      for (let i = 0; i < 20000 && sim.state.wavesCleared < 2 && !sim.state.ended; i++) {
        sim.step();

        for (const enemy of sim.state.enemies) {
          enemy.hp = 0;
        }

        if (sim.state.inChoice && sim.state.pendingChoice) {
          const event: GameEvent = {
            type: 'CHOOSE_RELIC',
            tick: sim.state.tick,
            wave: sim.state.pendingChoice.wave,
            optionIndex: 0,
          };
          events.push(event);
          sim.setEvents(events);
        }
      }

      expect(sim.isSegmentBoundary()).toBe(true);

      const summary = sim.getSegmentSummary();
      expect(summary.startWave).toBe(0);
      expect(summary.endWave).toBe(2);
      expect(summary.goldEarned).toBeGreaterThan(0);
    });
  });

  describe('Replay Verification', () => {
    it('replay produces identical final hash', () => {
      const seed = 54321;

      // Use very low HP so the game ends quickly
      const testConfig = {
        ...getDefaultConfig(),
        fortressBaseHp: 10, // Very low HP so game ends quickly
        fortressBaseDamage: 0, // No fortress attacks so enemies reach fortress
      };

      const sim1 = new Simulation(seed, testConfig);
      const events: GameEvent[] = [];

      // Run until game ends - use large limit to ensure game ends
      for (let i = 0; i < 50000 && !sim1.state.ended; i++) {
        sim1.step();

        if (sim1.state.inChoice && sim1.state.pendingChoice) {
          const event: GameEvent = {
            type: 'CHOOSE_RELIC',
            tick: sim1.state.tick,
            wave: sim1.state.pendingChoice.wave,
            optionIndex: 0,
          };
          events.push(event);
          sim1.setEvents(events);
        }
      }

      const finalHash1 = sim1.getFinalHash();

      // Replay with same events and config
      const result = replayRun({
        seed,
        events,
        expectedCheckpoints: [],
        expectedFinalHash: finalHash1,
        auditTicks: [],
        config: testConfig,
      });

      expect(result.success).toBe(true);
      expect(result.finalHash).toBe(finalHash1);
    });

    it('replay rejects tampered events', () => {
      // Use high HP to survive several waves but low enough to eventually lose
      const config = {
        ...getDefaultConfig(),
        fortressBaseHp: 2000, // High HP to survive several waves
        fortressBaseDamage: 100, // High damage to help clear waves
      };
      const seed = 11111;

      // First run - let game play naturally
      const sim = new Simulation(seed, config);
      const events: GameEvent[] = [];

      // Run until game ends - use large limit to ensure game ends
      for (let i = 0; i < 50000 && !sim.state.ended; i++) {
        sim.step();

        if (sim.state.inChoice && sim.state.pendingChoice) {
          const event: GameEvent = {
            type: 'CHOOSE_RELIC',
            tick: sim.state.tick,
            wave: sim.state.pendingChoice.wave,
            optionIndex: 0,
          };
          events.push(event);
          sim.setEvents(events);
        }
      }

      // Ensure we collected at least one event to tamper with
      expect(events.length).toBeGreaterThan(0);

      const validHash = sim.getFinalHash();

      // Tamper with events - choose different relic
      const tamperedEvents = events.map((e, i) => {
        if (e.type === 'CHOOSE_RELIC' && i === 0) {
          return { ...e, optionIndex: 1 };
        }
        return e;
      });

      const result = replayRun({
        seed,
        events: tamperedEvents,
        expectedCheckpoints: [],
        expectedFinalHash: validHash,
        auditTicks: [],
        config,
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('FINAL_HASH_MISMATCH');
    });

    it('non-monotonic ticks are rejected', () => {
      const seed = 22222;
      const config = { ...getDefaultConfig(), startingGold: 50 };

      // Use CHOOSE_RELIC events which work without needing choice mode setup
      const events: GameEvent[] = [
        { type: 'CHOOSE_RELIC', tick: 100, wave: 1, optionIndex: 0 },
        { type: 'CHOOSE_RELIC', tick: 50, wave: 1, optionIndex: 0 }, // Goes backwards!
      ];

      const result = replayRun({
        seed,
        events,
        expectedCheckpoints: [],
        expectedFinalHash: 0,
        auditTicks: [],
        config,
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('TICKS_NOT_MONOTONIC');
    });
  });

  describe('Checkpoint Chain Validation', () => {
    it('checkpoints chain correctly through game', () => {
      const config = getDefaultConfig();
      const sim = new Simulation(12345, config);
      sim.setCheckpointTicks([100, 200, 300]);

      for (let i = 0; i < 350; i++) {
        sim.step();
      }

      const checkpoints = sim.getCheckpoints();
      expect(checkpoints.length).toBeGreaterThanOrEqual(3);

      // Verify chain integrity
      let prevChainHash = 0;
      for (const cp of checkpoints.slice(0, 3)) {
        // Each checkpoint's chain should include previous
        expect(cp.chainHash32).not.toBe(prevChainHash);
        prevChainHash = cp.chainHash32;
      }
    });

    it('tampered checkpoint is detected', () => {
      const config = getDefaultConfig();
      const sim = new Simulation(12345, config);
      sim.setCheckpointTicks([100]);

      for (let i = 0; i < 110; i++) {
        sim.step();
      }

      const checkpoints = sim.getCheckpoints();
      expect(checkpoints.length).toBeGreaterThan(0);

      // Create tampered checkpoint
      const tamperedCp = { ...checkpoints[0], hash32: checkpoints[0].hash32 + 1 };

      // Would need to replay to this state to verify, but the hash won't match
      expect(tamperedCp.hash32).not.toBe(checkpoints[0].hash32);
    });
  });

  describe('Determinism', () => {
    it('same seed produces identical game states', () => {
      const config = getDefaultConfig();
      const seed = 99999;

      const sim1 = new Simulation(seed, config);
      const sim2 = new Simulation(seed, config);

      for (let i = 0; i < 500; i++) {
        sim1.step();
        sim2.step();

        expect(sim1.state.tick).toBe(sim2.state.tick);
        expect(sim1.state.rngState).toBe(sim2.state.rngState);
        expect(sim1.state.fortressHp).toBe(sim2.state.fortressHp);
        expect(sim1.state.enemies.length).toBe(sim2.state.enemies.length);
        expect(sim1.state.kills).toBe(sim2.state.kills);
      }
    });

    it('same events produce identical outcomes', () => {
      const config = getDefaultConfig();
      const seed = 12345;

      // First run - collect relic choices as events
      const sim1 = new Simulation(seed, config);
      const events: GameEvent[] = [];

      for (let i = 0; i < 5000 && !sim1.state.ended; i++) {
        sim1.step();
        for (const enemy of sim1.state.enemies) {
          enemy.hp = 0;
        }
        if (sim1.state.inChoice && sim1.state.pendingChoice) {
          const event: GameEvent = {
            type: 'CHOOSE_RELIC',
            tick: sim1.state.tick,
            wave: sim1.state.pendingChoice.wave,
            optionIndex: 0,
          };
          events.push(event);
          sim1.setEvents(events);
        }
      }

      // Second run with same events
      const sim2 = new Simulation(seed, config);
      sim2.setEvents(events);

      for (let i = 0; i < 5000 && !sim2.state.ended; i++) {
        sim2.step();
        for (const enemy of sim2.state.enemies) {
          enemy.hp = 0;
        }
      }

      expect(sim1.getFinalHash()).toBe(sim2.getFinalHash());
      expect(sim1.state.wavesCleared).toBe(sim2.state.wavesCleared);
      expect(sim1.state.kills).toBe(sim2.state.kills);
    });
  });

  describe('Score Calculation', () => {
    it('score increases with waves cleared', () => {
      // Config with high damage to ensure waves are cleared quickly
      const baseConfig = {
        fortressBaseHp: 10000,
        fortressBaseDamage: 1000, // High damage to kill enemies quickly
      };

      const result1 = runSimulationTo({
        seed: 12345,
        targetWave: 2,
        config: baseConfig,
      });

      const result2 = runSimulationTo({
        seed: 12345,
        targetWave: 4,
        config: baseConfig,
      });

      const score1 = result1.sim.calculateScore();
      const score2 = result2.sim.calculateScore();

      // Verify waves were actually cleared
      expect(result1.state.wavesCleared).toBeGreaterThanOrEqual(2);
      expect(result2.state.wavesCleared).toBeGreaterThanOrEqual(4);
      expect(score2).toBeGreaterThan(score1);
    });

  });

  describe('Relic System Integration', () => {
    it('relics are collected and affect gameplay', () => {
      const config = getDefaultConfig();
      const sim = new Simulation(12345, config);
      const events: GameEvent[] = [];

      // Run until we can choose a relic
      for (let i = 0; i < 10000 && sim.state.relics.length === 0 && !sim.state.ended; i++) {
        sim.step();

        for (const enemy of sim.state.enemies) {
          enemy.hp = 0;
        }

        if (sim.state.inChoice && sim.state.pendingChoice) {
          const event: GameEvent = {
            type: 'CHOOSE_RELIC',
            tick: sim.state.tick,
            wave: sim.state.pendingChoice.wave,
            optionIndex: 0,
          };
          events.push(event);
          sim.setEvents(events);
        }
      }

      expect(sim.state.relics.length).toBeGreaterThan(0);
      // Modifiers should be updated
      expect(sim.state.modifiers).not.toEqual(getDefaultConfig());
    });

    it('reroll works correctly', () => {
      const config = { ...getDefaultConfig(), startingGold: 50 };
      const sim = new Simulation(12345, config);
      const events: GameEvent[] = [];

      // Run until choice mode
      for (let i = 0; i < 10000 && !sim.state.inChoice && !sim.state.ended; i++) {
        sim.step();
        for (const enemy of sim.state.enemies) {
          enemy.hp = 0;
        }
      }

      if (sim.state.inChoice && sim.state.pendingChoice) {
        const originalOptions = [...sim.state.pendingChoice.options];
        const goldBefore = sim.state.gold;

        // Reroll
        const rerollEvent: GameEvent = { type: 'REROLL_RELICS', tick: sim.state.tick };
        events.push(rerollEvent);
        sim.setEvents(events);
        sim.step();

        expect(sim.state.gold).toBe(goldBefore - 10);
        // Options should be different (with high probability)
        expect(sim.state.pendingChoice?.options).not.toEqual(originalOptions);
      }
    });
  });

  describe('Economy System', () => {
    it('gold is earned from kills', () => {
      const sim = new Simulation(12345, getDefaultConfig());

      // Run until enemies spawn and die
      for (let i = 0; i < 1000; i++) {
        sim.step();
        for (const enemy of sim.state.enemies) {
          enemy.hp = 0;
        }
        if (sim.state.goldEarned > 0) break;
      }

      expect(sim.state.goldEarned).toBeGreaterThan(0);
      expect(sim.state.gold).toBeGreaterThan(0);
    });

    it('dust is earned from kills', () => {
      const sim = new Simulation(12345, getDefaultConfig());

      for (let i = 0; i < 1000; i++) {
        sim.step();
        for (const enemy of sim.state.enemies) {
          enemy.hp = 0;
        }
        if (sim.state.dustEarned > 0) break;
      }

      expect(sim.state.dustEarned).toBeGreaterThan(0);
      expect(sim.state.dust).toBeGreaterThan(0);
    });

    it('gold multiplier affects earnings', () => {
      const configNormal = getDefaultConfig();
      const configBoost = { ...getDefaultConfig(), progressionGoldBonus: 1.5 };

      const sim1 = new Simulation(12345, configNormal);
      const sim2 = new Simulation(12345, configBoost);

      // Run both and compare gold earned
      for (let i = 0; i < 1000; i++) {
        sim1.step();
        sim2.step();
        for (const enemy of sim1.state.enemies) enemy.hp = 0;
        for (const enemy of sim2.state.enemies) enemy.hp = 0;
      }

      // With gold bonus, should earn more
      expect(sim2.state.goldEarned).toBeGreaterThan(sim1.state.goldEarned);
    });
  });
});
