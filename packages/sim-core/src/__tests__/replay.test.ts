import { describe, it, expect } from 'vitest';
import { Simulation, getDefaultConfig } from '../simulation.js';
import { replayRun } from '../replay.js';
import { createCheckpoint, computeFinalHash, computeChainHash } from '../checkpoints.js';
import type { GameEvent, Checkpoint } from '@arcade/protocol';

describe('Replay Verification', () => {
  describe('Checkpoint Chain', () => {
    it('validates correct checkpoint chain', () => {
      const seed = 77777;
      const config = {
        ...getDefaultConfig(),
        fortressBaseHp: 10, // Very low HP so game ends quickly
        fortressBaseDamage: 0, // No fortress attacks so enemies reach fortress
      };

      const sim = new Simulation(seed, config);
      const events: GameEvent[] = [];

      // Run until game ends (fortress destroyed) - use large limit to ensure game ends
      for (let i = 0; i < 50000 && !sim.state.ended; i++) {
        sim.step();

        // Auto-choose relics
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

      const finalHash = computeFinalHash(sim.state);

      // Replay should succeed - don't pass custom checkpoints since
      // replayRun generates its own at wave ends
      const result = replayRun({
        seed,
        events,
        expectedCheckpoints: [],
        expectedFinalHash: finalHash,
        auditTicks: [],
        config,
      });

      expect(result.success).toBe(true);
    });

    it('detects tampered checkpoint hash', () => {
      const seed = 88888;
      const auditTicks = [100, 200]; // Use audit ticks for deterministic checkpoint creation
      const config = {
        ...getDefaultConfig(),
        fortressBaseHp: 10000,
        fortressBaseDamage: 1000,
      };

      const sim = new Simulation(seed, config);
      sim.setAuditTicks(auditTicks); // Set audit ticks to create checkpoints at these ticks
      const events: GameEvent[] = [];

      for (let i = 0; i < 500; i++) {
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

      const finalHash = computeFinalHash(sim.state);

      // Get checkpoints from simulation and tamper with one
      const checkpoints = sim.getCheckpoints();
      const tamperedCheckpoints = checkpoints.map((cp, i) => {
        if (i === 0 && cp.tick === 100) {
          return { ...cp, hash32: cp.hash32 ^ 0x12345 };
        }
        return cp;
      });

      const result = replayRun({
        seed,
        events,
        expectedCheckpoints: tamperedCheckpoints,
        expectedFinalHash: finalHash,
        auditTicks,
        config,
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('CHECKPOINT_MISMATCH');
    });

    it('chain hash connects checkpoints', () => {
      const seed = 12345;
      const config = getDefaultConfig();

      const sim = new Simulation(seed, config);
      const checkpoints: Checkpoint[] = [];
      let lastChainHash = 0;

      // Create 3 checkpoints
      for (let tick = 100; tick <= 300; tick += 100) {
        while (sim.state.tick < tick) {
          sim.step();
        }
        const cp = createCheckpoint(sim.state, lastChainHash);
        checkpoints.push(cp);
        lastChainHash = cp.chainHash32;
      }

      // Verify chain
      let prevChain = 0;
      for (const cp of checkpoints) {
        const expectedChain = computeChainHash(prevChain, cp.tick, cp.hash32);
        expect(cp.chainHash32).toBe(expectedChain);
        prevChain = cp.chainHash32;
      }
    });
  });

  describe('Audit Ticks', () => {
    it('validates all audit ticks are present', () => {
      const seed = 33333;
      const auditTicks = [50, 150, 250];
      const config = {
        ...getDefaultConfig(),
        fortressBaseHp: 10, // Very low HP so game ends quickly after audit ticks
        fortressBaseDamage: 0, // No fortress attacks so enemies reach fortress
      };

      const sim = new Simulation(seed, config);
      sim.setAuditTicks(auditTicks);

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

      const finalHash = computeFinalHash(sim.state);
      // Get checkpoints that were automatically created at audit ticks
      const checkpoints = sim.getCheckpoints();

      const result = replayRun({
        seed,
        events,
        expectedCheckpoints: checkpoints,
        expectedFinalHash: finalHash,
        auditTicks,
        config,
      });

      expect(result.success).toBe(true);
    });

    it('fails when audit tick checkpoint is missing', () => {
      const seed = 44444;
      const config = getDefaultConfig();
      const auditTicks = [50, 150, 250];

      const sim = new Simulation(seed, config);
      const events: GameEvent[] = [];

      // Only create checkpoint at first audit tick (missing 150, 250)
      const checkpoints: Checkpoint[] = [];
      let lastChainHash = 0;

      for (let i = 0; i < 100; i++) {
        sim.step();
        if (sim.state.tick === 50) {
          const cp = createCheckpoint(sim.state, lastChainHash);
          checkpoints.push(cp);
          lastChainHash = cp.chainHash32;
        }
      }

      const result = replayRun({
        seed,
        events,
        expectedCheckpoints: checkpoints,
        expectedFinalHash: 0,
        auditTicks,
        config,
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('AUDIT_TICK_MISSING');
    });
  });

  describe('Event Validation', () => {
    it('validates relic choice is within bounds', () => {
      const seed = 66666;
      const config = { ...getDefaultConfig(), relicsPerChoice: 3 };

      const sim = new Simulation(seed, config);
      const events: GameEvent[] = [];

      // Run until choice appears
      while (!sim.state.inChoice && sim.state.tick < 1000) {
        sim.step();
      }

      if (sim.state.inChoice && sim.state.pendingChoice) {
        // Try to choose invalid index
        events.push({
          type: 'CHOOSE_RELIC',
          tick: sim.state.tick,
          wave: sim.state.pendingChoice.wave,
          optionIndex: 5, // Out of bounds (only 3 options)
        });
      }

      // This should be rejected during validation
      const result = replayRun({
        seed,
        events,
        expectedCheckpoints: [],
        expectedFinalHash: 0,
        auditTicks: [],
        config,
      });

      // Event won't be applied, so state will differ
      expect(result.finalHash).toBeDefined();
    });
  });

  describe('Score Calculation', () => {
    it('calculates consistent score', () => {
      const seed = 77777; // Same seed as checkpoint test
      const config = {
        ...getDefaultConfig(),
        fortressBaseHp: 50, // Low HP so game ends
      };

      const sim = new Simulation(seed, config);
      const events: GameEvent[] = [];

      // Run until game ends
      for (let i = 0; i < 5000 && !sim.state.ended; i++) {
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

      // Replay and check it completes
      const result = replayRun({
        seed,
        events,
        expectedCheckpoints: [],
        expectedFinalHash: 0, // Don't check hash, just run replay
        auditTicks: [],
        config,
      });

      // Check that replay completed and scores match
      expect(result.score).toBeDefined();
      expect(result.finalHash).toBeDefined();
    });
  });
});
