/**
 * Runs schema tests
 */
import { describe, it, expect } from 'vitest';
import {
  RunStartResponseSchema,
  RunFinishRequestSchema,
  RunRewardsSchema,
  RunFinishResponseSchema,
  RUN_REJECTION_REASONS,
} from '../runs.js';

describe('Runs Schemas', () => {
  describe('RunStartResponseSchema', () => {
    it('validates correct response', () => {
      const result = RunStartResponseSchema.safeParse({
        runId: 'run-123',
        runToken: 'token-abc',
        seed: 12345,
        simVersion: 1,
        tickHz: 30,
        maxWaves: 10,
        auditTicks: [100, 200, 300],
        progressionBonuses: {
          damageMultiplier: 1.1,
          goldMultiplier: 1.05,
          startingGold: 25,
          maxHeroSlots: 2,
          maxTurretSlots: 6,
        },
      });

      expect(result.success).toBe(true);
    });

    it('applies default tickHz of 30', () => {
      const result = RunStartResponseSchema.safeParse({
        runId: 'run-123',
        runToken: 'token-abc',
        seed: 12345,
        simVersion: 1,
        maxWaves: 10,
        auditTicks: [],
        progressionBonuses: {
          damageMultiplier: 1,
          goldMultiplier: 1,
          startingGold: 0,
          maxHeroSlots: 1,
          maxTurretSlots: 6,
        },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tickHz).toBe(30);
      }
    });

    it('accepts empty arrays', () => {
      const result = RunStartResponseSchema.safeParse({
        runId: 'run-123',
        runToken: 'token-abc',
        seed: 0,
        simVersion: 1,
        tickHz: 60,
        maxWaves: 10,
        auditTicks: [],
        progressionBonuses: {
          damageMultiplier: 1,
          goldMultiplier: 1,
          startingGold: 0,
          maxHeroSlots: 1,
          maxTurretSlots: 6,
        },
      });

      expect(result.success).toBe(true);
    });

    it('rejects missing progressionBonuses', () => {
      const result = RunStartResponseSchema.safeParse({
        runId: 'run-123',
        runToken: 'token-abc',
        seed: 12345,
        simVersion: 1,
        tickHz: 30,
        maxWaves: 10,
        auditTicks: [],
      });

      expect(result.success).toBe(false);
    });
  });

  describe('RunFinishRequestSchema', () => {
    it('validates correct request', () => {
      const result = RunFinishRequestSchema.safeParse({
        runToken: 'token-abc',
        events: [
          { type: 'REROLL_RELICS', tick: 100 },
          { type: 'CHOOSE_RELIC', tick: 500, wave: 1, optionIndex: 0 },
        ],
        checkpoints: [
          { tick: 100, hash32: 123, chainHash32: 456 },
        ],
        finalHash: 987654321,
        score: 5000,
        summary: {
          wavesCleared: 10,
          kills: 100,
          eliteKills: 5,
          goldEarned: 500,
          dustEarned: 25,
          timeSurvived: 9000,
          relicsCollected: ['sharpened-blades', 'swift-strikes'],
        },
      });

      expect(result.success).toBe(true);
    });

    it('rejects events array exceeding 1000', () => {
      const events = Array(1001).fill(null).map((_, i) => ({
        type: 'REROLL_RELICS',
        tick: i * 10,
      }));

      const result = RunFinishRequestSchema.safeParse({
        runToken: 'token-abc',
        events,
        checkpoints: [],
        finalHash: 0,
        score: 0,
        summary: {
          wavesCleared: 0,
          kills: 0,
          eliteKills: 0,
          goldEarned: 0,
          dustEarned: 0,
          timeSurvived: 0,
          relicsCollected: [],
        },
      });

      expect(result.success).toBe(false);
    });

    it('accepts exactly 1000 events', () => {
      const events = Array(1000).fill(null).map((_, i) => ({
        type: 'REROLL_RELICS',
        tick: i * 10,
      }));

      const result = RunFinishRequestSchema.safeParse({
        runToken: 'token-abc',
        events,
        checkpoints: [],
        finalHash: 0,
        score: 0,
        summary: {
          wavesCleared: 0,
          kills: 0,
          eliteKills: 0,
          goldEarned: 0,
          dustEarned: 0,
          timeSurvived: 0,
          relicsCollected: [],
        },
      });

      expect(result.success).toBe(true);
    });

    it('rejects checkpoints array exceeding 500', () => {
      const checkpoints = Array(501).fill(null).map((_, i) => ({
        tick: i * 10,
        hash32: 123 + i,
        chainHash32: 456 + i,
      }));

      const result = RunFinishRequestSchema.safeParse({
        runToken: 'token-abc',
        events: [],
        checkpoints,
        finalHash: 0,
        score: 0,
        summary: {
          wavesCleared: 0,
          kills: 0,
          eliteKills: 0,
          goldEarned: 0,
          dustEarned: 0,
          timeSurvived: 0,
          relicsCollected: [],
        },
      });

      expect(result.success).toBe(false);
    });

    it('rejects negative score', () => {
      const result = RunFinishRequestSchema.safeParse({
        runToken: 'token-abc',
        events: [],
        checkpoints: [],
        finalHash: 0,
        score: -100,
        summary: {
          wavesCleared: 0,
          kills: 0,
          eliteKills: 0,
          goldEarned: 0,
          dustEarned: 0,
          timeSurvived: 0,
          relicsCollected: [],
        },
      });

      expect(result.success).toBe(false);
    });

    it('rejects negative summary values', () => {
      const result = RunFinishRequestSchema.safeParse({
        runToken: 'token-abc',
        events: [],
        checkpoints: [],
        finalHash: 0,
        score: 0,
        summary: {
          wavesCleared: -1,
          kills: 0,
          eliteKills: 0,
          goldEarned: 0,
          dustEarned: 0,
          timeSurvived: 0,
          relicsCollected: [],
        },
      });

      expect(result.success).toBe(false);
    });
  });

  describe('RunRewardsSchema', () => {
    it('validates correct rewards', () => {
      const result = RunRewardsSchema.safeParse({
        gold: 100,
        dust: 25,
        xp: 200,
        levelUp: true,
        newLevel: 5,
      });

      expect(result.success).toBe(true);
    });

    it('accepts optional newLevel when levelUp is false', () => {
      const result = RunRewardsSchema.safeParse({
        gold: 100,
        dust: 25,
        xp: 200,
        levelUp: false,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.newLevel).toBeUndefined();
      }
    });

    it('rejects negative values', () => {
      const result = RunRewardsSchema.safeParse({
        gold: -100,
        dust: 25,
        xp: 200,
        levelUp: false,
      });

      expect(result.success).toBe(false);
    });

    it('accepts zero values', () => {
      const result = RunRewardsSchema.safeParse({
        gold: 0,
        dust: 0,
        xp: 0,
        levelUp: false,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('RunFinishResponseSchema', () => {
    it('validates verified response with rewards', () => {
      const result = RunFinishResponseSchema.safeParse({
        verified: true,
        rewards: {
          gold: 100,
          dust: 25,
          xp: 200,
          levelUp: false,
        },
        newInventory: {
          gold: 600,
          dust: 75,
          sigils: 0,
        },
        newProgression: {
          level: 5,
          xp: 300,
          totalXp: 900,
          xpToNextLevel: 459,
        },
      });

      expect(result.success).toBe(true);
    });

    it('validates rejected response with reason', () => {
      const result = RunFinishResponseSchema.safeParse({
        verified: false,
        reason: 'FINAL_HASH_MISMATCH',
      });

      expect(result.success).toBe(true);
    });

    it('accepts response with only verified field', () => {
      const result = RunFinishResponseSchema.safeParse({
        verified: false,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('RUN_REJECTION_REASONS', () => {
    it('contains all expected rejection reasons', () => {
      expect(RUN_REJECTION_REASONS.TOKEN_EXPIRED).toBe('TOKEN_EXPIRED');        
      expect(RUN_REJECTION_REASONS.TOKEN_INVALID).toBe('TOKEN_INVALID');        
      expect(RUN_REJECTION_REASONS.SIM_VERSION_MISMATCH).toBe('SIM_VERSION_MISMATCH');
      expect(RUN_REJECTION_REASONS.RUN_NOT_FOUND).toBe('RUN_NOT_FOUND');        
      expect(RUN_REJECTION_REASONS.RUN_ALREADY_FINISHED).toBe('RUN_ALREADY_FINISHED');
      expect(RUN_REJECTION_REASONS.EVENTS_INVALID).toBe('EVENTS_INVALID');
      expect(RUN_REJECTION_REASONS.TICKS_NOT_MONOTONIC).toBe('TICKS_NOT_MONOTONIC');
      expect(RUN_REJECTION_REASONS.CHECKPOINT_MISMATCH).toBe('CHECKPOINT_MISMATCH');
      expect(RUN_REJECTION_REASONS.AUDIT_TICK_MISSING).toBe('AUDIT_TICK_MISSING');
      expect(RUN_REJECTION_REASONS.FINAL_HASH_MISMATCH).toBe('FINAL_HASH_MISMATCH');
      expect(RUN_REJECTION_REASONS.PAYLOAD_TOO_LARGE).toBe('PAYLOAD_TOO_LARGE');
      expect(RUN_REJECTION_REASONS.RATE_LIMITED).toBe('RATE_LIMITED');
    });

    it('has correct number of rejection reasons', () => {
      expect(Object.keys(RUN_REJECTION_REASONS).length).toBe(12);
    });
  });
});
