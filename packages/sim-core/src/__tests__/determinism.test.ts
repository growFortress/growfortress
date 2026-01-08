import { describe, it, expect } from 'vitest';
import { Xorshift32 } from '../rng.js';
import { Simulation, getDefaultConfig } from '../simulation.js';
import { replayRun } from '../replay.js';
import { computeCheckpointHash, computeFinalHash } from '../checkpoints.js';
import type { GameEvent } from '@arcade/protocol';

describe('Determinism', () => {
  describe('Xorshift32 RNG', () => {
    it('produces same sequence from same seed', () => {
      const rng1 = new Xorshift32(12345);
      const rng2 = new Xorshift32(12345);

      for (let i = 0; i < 1000; i++) {
        expect(rng1.next()).toBe(rng2.next());
      }
    });

    it('produces different sequences from different seeds', () => {
      const rng1 = new Xorshift32(12345);
      const rng2 = new Xorshift32(54321);

      let sameCount = 0;
      for (let i = 0; i < 100; i++) {
        if (rng1.next() === rng2.next()) sameCount++;
      }

      expect(sameCount).toBeLessThan(5); // Very unlikely to have many matches
    });

    it('state can be saved and restored', () => {
      const rng = new Xorshift32(12345);

      // Advance some
      for (let i = 0; i < 100; i++) rng.next();

      const savedState = rng.getState();
      const next1 = rng.next();
      const next2 = rng.next();

      // Restore and verify same sequence
      rng.setState(savedState);
      expect(rng.next()).toBe(next1);
      expect(rng.next()).toBe(next2);
    });
  });

  describe('Simulation Determinism', () => {
    it('same seed produces same initial state', () => {
      const seed = 42;
      const config = getDefaultConfig();

      const sim1 = new Simulation(seed, config);
      const sim2 = new Simulation(seed, config);

      expect(sim1.state.rngState).toBe(sim2.state.rngState);
      expect(sim1.state.fortressHp).toBe(sim2.state.fortressHp);
      expect(sim1.state.tick).toBe(sim2.state.tick);
    });

    it('same seed + steps produces identical states', () => {
      const seed = 12345;
      const config = getDefaultConfig();

      const sim1 = new Simulation(seed, config);
      const sim2 = new Simulation(seed, config);

      // Run for 500 ticks
      for (let i = 0; i < 500; i++) {
        sim1.step();
        sim2.step();

        // Verify critical state matches
        expect(sim1.state.tick).toBe(sim2.state.tick);
        expect(sim1.state.rngState).toBe(sim2.state.rngState);
        expect(sim1.state.fortressHp).toBe(sim2.state.fortressHp);
        expect(sim1.state.enemies.length).toBe(sim2.state.enemies.length);
        expect(sim1.state.kills).toBe(sim2.state.kills);
      }
    });

    it('same seed + events produces same checkpoint hash', () => {
      const seed = 99999;
      const config = getDefaultConfig();

      const sim1 = new Simulation(seed, config);
      const sim2 = new Simulation(seed, config);

      // Run until first choice or 300 ticks
      for (let i = 0; i < 300 && !sim1.state.ended; i++) {
        sim1.step();
        sim2.step();
      }

      const hash1 = computeCheckpointHash(sim1.state);
      const hash2 = computeCheckpointHash(sim2.state);

      expect(hash1).toBe(hash2);
    });

    it('different events produce different hashes', () => {
      const seed = 11111;
      const config = {
        ...getDefaultConfig(),
        fortressBaseHp: 10000,
        fortressBaseDamage: 1000,
      };

      const sim1 = new Simulation(seed, config);
      const sim2 = new Simulation(seed, config);

      // Run until both simulations are in choice mode
      for (let i = 0; i < 3000 && (!sim1.state.inChoice || !sim2.state.inChoice); i++) {
        if (!sim1.state.inChoice) sim1.step();
        if (!sim2.state.inChoice) sim2.step();
      }

      // Verify both are in choice mode
      expect(sim1.state.inChoice).toBe(true);
      expect(sim2.state.inChoice).toBe(true);

      // Choose different relics - this directly affects the relics array which IS hashed
      const events1: GameEvent[] = [{
        type: 'CHOOSE_RELIC',
        tick: sim1.state.tick,
        wave: sim1.state.pendingChoice!.wave,
        optionIndex: 0, // First option
      }];
      const events2: GameEvent[] = [{
        type: 'CHOOSE_RELIC',
        tick: sim2.state.tick,
        wave: sim2.state.pendingChoice!.wave,
        optionIndex: 1, // Second option (different relic)
      }];

      sim1.setEvents(events1);
      sim2.setEvents(events2);

      // Step once to process the events
      sim1.step();
      sim2.step();

      const hash1 = computeCheckpointHash(sim1.state);
      const hash2 = computeCheckpointHash(sim2.state);

      // Hashes should differ due to different relics chosen
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Replay Determinism', () => {
    it('replay produces identical final hash', () => {
      const seed = 54321;
      const config = {
        ...getDefaultConfig(),
        fortressBaseHp: 10, // Very low HP so game ends quickly
        fortressBaseDamage: 0, // No fortress attacks so enemies reach fortress
      };

      // First run
      const sim1 = new Simulation(seed, config);
      const events: GameEvent[] = [];

      // Run until game ends (fortress destroyed) - use large limit to ensure game ends
      for (let i = 0; i < 50000 && !sim1.state.ended; i++) {
        sim1.step();

        // Auto-choose first relic if choice pending
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

      // Ensure game actually ended (not just iteration limit)
      expect(sim1.state.ended).toBe(true);

      const finalHash1 = computeFinalHash(sim1.state);

      // Replay with same events
      const result = replayRun({
        seed,
        events,
        expectedCheckpoints: [],
        expectedFinalHash: finalHash1,
        auditTicks: [],
        config,
      });

      expect(result.success).toBe(true);
      expect(result.finalHash).toBe(finalHash1);
    });

    it('replay with different events fails', () => {
      const seed = 11111;
      const config = getDefaultConfig();

      // First run - get valid hash
      const sim = new Simulation(seed, config);
      const events: GameEvent[] = [];

      for (let i = 0; i < 1000 && !sim.state.ended; i++) {
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

      const validHash = computeFinalHash(sim.state);

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
      const config = getDefaultConfig();

      // Use CHOOSE_RELIC events to test tick ordering
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
});
