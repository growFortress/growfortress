/**
 * Verification service tests
 */
import { describe, it, expect } from 'vitest';
import { verifyRunSubmission } from '../../../services/verification.js';
import type { RunTokenPayload } from '../../../lib/tokens.js';
import type { RunFinishRequest } from '@arcade/protocol';
import { SIM_VERSION } from '@arcade/sim-core';

// Create base token payload
function createTokenPayload(overrides: Partial<RunTokenPayload> = {}): RunTokenPayload {
  return {
    runId: 'run-123',
    userId: 'user-123',
    seed: 12345,
    simVersion: SIM_VERSION,
    tickHz: 30,
    maxWaves: 10,
    auditTicks: [100, 200, 300],
    simConfig: {
      fortressClass: 'natural' as const,
      startingHeroes: [] as string[],
      startingTurrets: [] as { definitionId: string; slotIndex: number; class: 'natural' | 'fire' | 'ice' | 'lightning' }[],
      commanderLevel: 1,
      progressionDamageBonus: 1,
      progressionGoldBonus: 1,
      startingGold: 0,
      maxHeroSlots: 1,
      fortressBaseHp: 100,
      fortressBaseDamage: 10,
      waveIntervalTicks: 90,
    },
    issuedAt: Math.floor(Date.now() / 1000) - 60,
    exp: Math.floor(Date.now() / 1000) + 540,
    ...overrides,
  };
}

// Create base request
function createRequest(overrides: Partial<RunFinishRequest> = {}): RunFinishRequest {
  return {
    runToken: 'token-123',
    events: [],
    checkpoints: [
      { tick: 100, hash32: 123, chainHash32: 456 },
      { tick: 200, hash32: 789, chainHash32: 101 },
      { tick: 300, hash32: 111, chainHash32: 222 },
    ],
    finalHash: 12345678,
    score: 1000,
    summary: {
      wavesCleared: 5,
      kills: 100,
      eliteKills: 10,
      goldEarned: 500,
      dustEarned: 50,
      timeSurvived: 300,
      relicsCollected: ['damage-boost'],
    },
    ...overrides,
  };
}

describe('Verification Service', () => {
  describe('verifyRunSubmission', () => {
    describe('payload validation', () => {
      it('rejects too many events', () => {
        const manyEvents = Array(1001).fill(null).map((_, i) => ({
          type: 'REROLL_RELICS' as const,
          tick: i * 300,
        }));

        const result = verifyRunSubmission(
          createRequest({ events: manyEvents }),
          createTokenPayload()
        );

        expect(result.verified).toBe(false);
        expect(result.reason).toBe('PAYLOAD_TOO_LARGE');
      });

      it('accepts 1000 events', () => {
        const events = Array(1000).fill(null).map((_, i) => ({
          type: 'REROLL_RELICS' as const,
          tick: i * 300,
        }));

        // This will likely fail hash verification but not payload size
        const result = verifyRunSubmission(
          createRequest({ events }),
          createTokenPayload({ auditTicks: [] })
        );

        // Should not reject for payload size
        expect(result.reason).not.toBe('PAYLOAD_TOO_LARGE');
      });

      it('rejects too many checkpoints', () => {
        const manyCheckpoints = Array(501).fill(null).map((_, i) => ({
          tick: i * 10,
          hash32: 123 + i,
          chainHash32: 456 + i,
        }));

        const result = verifyRunSubmission(
          createRequest({ checkpoints: manyCheckpoints }),
          createTokenPayload({ auditTicks: [] })
        );

        expect(result.verified).toBe(false);
        expect(result.reason).toBe('PAYLOAD_TOO_LARGE');
      });

      it('accepts 500 checkpoints', () => {
        const checkpoints = Array(500).fill(null).map((_, i) => ({
          tick: i * 10,
          hash32: 123 + i,
          chainHash32: 456 + i,
        }));

        const result = verifyRunSubmission(
          createRequest({ checkpoints }),
          createTokenPayload({ auditTicks: [] })
        );

        // Should not reject for payload size
        expect(result.reason).not.toBe('PAYLOAD_TOO_LARGE');
      });
    });

    describe('tick validation', () => {
      it('rejects non-monotonic ticks', () => {
        const events = [
          { type: 'REROLL_RELICS' as const, tick: 100 },
          { type: 'REROLL_RELICS' as const, tick: 50 }, // Goes backwards
        ];

        const result = verifyRunSubmission(
          createRequest({ events }),
          createTokenPayload({ auditTicks: [] })
        );

        expect(result.verified).toBe(false);
        expect(result.reason).toBe('TICKS_NOT_MONOTONIC');
      });

      it('accepts monotonic ticks', () => {
        const events = [
          { type: 'REROLL_RELICS' as const, tick: 50 },
          { type: 'REROLL_RELICS' as const, tick: 100 },
          { type: 'REROLL_RELICS' as const, tick: 150 },
        ];

        // Will fail hash verification but not tick order
        const result = verifyRunSubmission(
          createRequest({ events }),
          createTokenPayload({ auditTicks: [] })
        );

        expect(result.reason).not.toBe('TICKS_NOT_MONOTONIC');
      });

      it('accepts equal ticks', () => {
        const events = [
          { type: 'REROLL_RELICS' as const, tick: 100 },
          { type: 'CHOOSE_RELIC' as const, tick: 100, wave: 1, optionIndex: 0 },
        ];

        const result = verifyRunSubmission(
          createRequest({ events }),
          createTokenPayload({ auditTicks: [] })
        );

        expect(result.reason).not.toBe('TICKS_NOT_MONOTONIC');
      });
    });

    describe('audit tick validation', () => {
      it('rejects missing audit tick checkpoint', () => {
        const checkpoints = [
          { tick: 100, hash32: 123, chainHash32: 456 },
          // Missing tick 200 checkpoint
          { tick: 300, hash32: 111, chainHash32: 222 },
        ];

        const result = verifyRunSubmission(
          createRequest({ checkpoints }),
          createTokenPayload({ auditTicks: [100, 200, 300] })
        );

        expect(result.verified).toBe(false);
        expect(result.reason).toBe('AUDIT_TICK_MISSING');
      });

      it('accepts all audit ticks present', () => {
        const checkpoints = [
          { tick: 100, hash32: 123, chainHash32: 456 },
          { tick: 200, hash32: 789, chainHash32: 101 },
          { tick: 300, hash32: 111, chainHash32: 222 },
        ];

        const result = verifyRunSubmission(
          createRequest({ checkpoints }),
          createTokenPayload({ auditTicks: [100, 200, 300] })
        );

        // Should not reject for missing audit ticks
        expect(result.reason).not.toBe('AUDIT_TICK_MISSING');
      });

      it('accepts empty audit ticks', () => {
        const result = verifyRunSubmission(
          createRequest({ checkpoints: [] }),
          createTokenPayload({ auditTicks: [] })
        );

        // Should not reject for missing audit ticks
        expect(result.reason).not.toBe('AUDIT_TICK_MISSING');
      });
    });

    describe('result structure', () => {
      it('returns summary even on failure', () => {
        const manyEvents = Array(1001).fill(null).map((_, i) => ({
          type: 'REROLL_RELICS' as const,
          tick: i * 300,
        }));

        const result = verifyRunSubmission(
          createRequest({ events: manyEvents }),
          createTokenPayload()
        );

        expect(result.summary).toBeDefined();
        expect(result.summary.wavesCleared).toBeDefined();
        expect(result.summary.kills).toBeDefined();
        expect(result.summary.goldEarned).toBeDefined();
      });

      it('returns score on failure', () => {
        const result = verifyRunSubmission(
          createRequest({ events: [] }),
          createTokenPayload({ auditTicks: [999] }) // Missing checkpoint
        );

        expect(result.score).toBeDefined();
        expect(typeof result.score).toBe('number');
      });
    });

    describe('integration with replay', () => {
      it('rejects hash mismatch', () => {
        // Run a simulation and provide wrong hash
        const result = verifyRunSubmission(
          createRequest({
            events: [],
            checkpoints: [],
            finalHash: 99999999, // Wrong hash
          }),
          createTokenPayload({ auditTicks: [] })
        );

        expect(result.verified).toBe(false);
        expect(result.reason).toBe('FINAL_HASH_MISMATCH');
      });
    });
  });
});
