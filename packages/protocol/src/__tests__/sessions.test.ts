/**
 * Sessions schema tests
 */
import { describe, it, expect } from 'vitest';
import {
  ProgressionBonusesSchema,
  SessionStartResponseSchema,
  SegmentSubmitRequestSchema,
  SegmentSubmitResponseSchema,
  PartialRewardsSchema,
  SessionEndResponseSchema,
} from '../sessions.js';

describe('Sessions Schemas', () => {
  describe('ProgressionBonusesSchema', () => {
    it('validates correct bonuses', () => {
      const result = ProgressionBonusesSchema.safeParse({
        damageMultiplier: 1.2,
        goldMultiplier: 1.1,
        startingGold: 50,
        maxHeroSlots: 2,
        maxTurretSlots: 6,
      });

      expect(result.success).toBe(true);
    });

    it('accepts base values (1.0 multipliers, 0 gold)', () => {
      const result = ProgressionBonusesSchema.safeParse({
        damageMultiplier: 1,
        goldMultiplier: 1,
        startingGold: 0,
        maxHeroSlots: 1,
        maxTurretSlots: 6,
      });

      expect(result.success).toBe(true);
    });

    it('rejects missing fields', () => {
      const result = ProgressionBonusesSchema.safeParse({
        damageMultiplier: 1.2,
      });

      expect(result.success).toBe(false);
    });
  });

  describe('SessionStartResponseSchema', () => {
    it('validates correct response', () => {
      const result = SessionStartResponseSchema.safeParse({
        sessionId: 'gs-123',
        sessionToken: 'token-abc',
        seed: 12345,
        simVersion: 1,
        tickHz: 30,
        startingWave: 10,
        segmentAuditTicks: [100, 200, 300],
        inventory: { gold: 500, dust: 100, sigils: 0 },
        commanderLevel: 5,
        progressionBonuses: {
          damageMultiplier: 1.1,
          goldMultiplier: 1.05,
          startingGold: 25,
          maxHeroSlots: 2,
          maxTurretSlots: 6,
        },
        fortressBaseHp: 100,
        fortressBaseDamage: 10,
        waveIntervalTicks: 450,
        powerData: {
          fortressUpgrades: {
            statUpgrades: { hp: 0, damage: 0, attackSpeed: 0, range: 0, critChance: 0, critMultiplier: 0, armor: 0, dodge: 0 },
          },
          heroUpgrades: [],
          turretUpgrades: [],
          itemTiers: [],
          heroTiers: {},
          turretTiers: {},
        },
      });

      expect(result.success).toBe(true);
    });

    it('rejects invalid inventory', () => {
      const result = SessionStartResponseSchema.safeParse({
        sessionId: 'gs-123',
        sessionToken: 'token-abc',
        seed: 12345,
        simVersion: 1,
        tickHz: 30,
        startingWave: 0,
        segmentAuditTicks: [],
        inventory: { gold: -100, dust: 0, sigils: 0 }, // negative gold
        commanderLevel: 1,
        progressionBonuses: {
          damageMultiplier: 1,
          goldMultiplier: 1,
          startingGold: 0,
          maxHeroSlots: 1,
          maxTurretSlots: 6,
        },
        fortressBaseHp: 100,
        fortressBaseDamage: 10,
        waveIntervalTicks: 450,
      });

      expect(result.success).toBe(false);
    });
  });

  describe('SegmentSubmitRequestSchema', () => {
    it('validates correct request', () => {
      const result = SegmentSubmitRequestSchema.safeParse({
        sessionToken: 'token-abc',
        startWave: 0,
        endWave: 5,
        events: [
          { type: 'ACTIVATE_SKILL', tick: 100 },
          { type: 'CHOOSE_RELIC', tick: 500, wave: 1, optionIndex: 0 },
        ],
        checkpoints: [
          { tick: 100, hash32: 123, chainHash32: 456 },
        ],
        finalHash: 987654321,
      });

      expect(result.success).toBe(true);
    });

    it('rejects negative startWave', () => {
      const result = SegmentSubmitRequestSchema.safeParse({
        sessionToken: 'token-abc',
        startWave: -1,
        endWave: 5,
        events: [],
        checkpoints: [],
        finalHash: 0,
      });

      expect(result.success).toBe(false);
    });

    it('rejects endWave less than 1', () => {
      const result = SegmentSubmitRequestSchema.safeParse({
        sessionToken: 'token-abc',
        startWave: 0,
        endWave: 0,
        events: [],
        checkpoints: [],
        finalHash: 0,
      });

      expect(result.success).toBe(false);
    });

    it('accepts events as unknown array', () => {
      const result = SegmentSubmitRequestSchema.safeParse({
        sessionToken: 'token-abc',
        startWave: 0,
        endWave: 5,
        events: [{ anything: 'goes' }, { type: 'custom' }], // unknown events
        checkpoints: [],
        finalHash: 0,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('SegmentSubmitResponseSchema', () => {
    it('validates verified response', () => {
      const result = SegmentSubmitResponseSchema.safeParse({
        verified: true,
        goldEarned: 100,
        dustEarned: 10,
        xpEarned: 50,
        nextSegmentAuditTicks: [200, 300],
        newInventory: { gold: 600, dust: 110, sigils: 0 },
        newProgression: { level: 5, xp: 250, totalXp: 1300, xpToNextLevel: 500 },
      });

      expect(result.success).toBe(true);
    });

    it('validates rejected response with reason', () => {
      const result = SegmentSubmitResponseSchema.safeParse({
        verified: false,
        rejectReason: 'Hash mismatch',
        goldEarned: 0,
        dustEarned: 0,
        xpEarned: 0,
        nextSegmentAuditTicks: [],
        newInventory: { gold: 500, dust: 100, sigils: 0 },
        newProgression: { level: 1, xp: 0, totalXp: 0, xpToNextLevel: 150 },
      });

      expect(result.success).toBe(true);
    });

    it('rejects missing newInventory', () => {
      const result = SegmentSubmitResponseSchema.safeParse({
        verified: true,
        goldEarned: 100,
        dustEarned: 10,
        xpEarned: 50,
        nextSegmentAuditTicks: [],
      });

      expect(result.success).toBe(false);
    });
  });

  describe('PartialRewardsSchema', () => {
    it('validates correct partial rewards', () => {
      const result = PartialRewardsSchema.safeParse({
        gold: 50,
        dust: 5,
        xp: 25,
        finalWave: 7,
      });

      expect(result.success).toBe(true);
    });

    it('accepts zero values', () => {
      const result = PartialRewardsSchema.safeParse({
        gold: 0,
        dust: 0,
        xp: 0,
        finalWave: 0,
      });

      expect(result.success).toBe(true);
    });

    it('rejects missing fields', () => {
      const result = PartialRewardsSchema.safeParse({
        gold: 50,
        dust: 5,
        // missing xp and finalWave
      });

      expect(result.success).toBe(false);
    });
  });

  describe('SessionEndResponseSchema', () => {
    it('validates correct response', () => {
      const result = SessionEndResponseSchema.safeParse({
        finalWave: 15,
        totalGoldEarned: 500,
        totalDustEarned: 50,
        totalXpEarned: 250,
        newInventory: { gold: 1500, dust: 150 },
        newProgression: { level: 5, xp: 100, totalXp: 1000, xpToNextLevel: 400 },
      });

      expect(result.success).toBe(true);
    });

    it('accepts zero values', () => {
      const result = SessionEndResponseSchema.safeParse({
        finalWave: 0,
        totalGoldEarned: 0,
        totalDustEarned: 0,
        totalXpEarned: 0,
        newInventory: { gold: 0, dust: 0 },
        newProgression: { level: 1, xp: 0, totalXp: 0, xpToNextLevel: 200 },
      });

      expect(result.success).toBe(true);
    });

    it('validates level-up progression', () => {
      const result = SessionEndResponseSchema.safeParse({
        finalWave: 50,
        totalGoldEarned: 5000,
        totalDustEarned: 500,
        totalXpEarned: 2500,
        newInventory: { gold: 10000, dust: 1000 },
        newProgression: { level: 10, xp: 150, totalXp: 5000, xpToNextLevel: 1850 },
      });

      expect(result.success).toBe(true);
    });
  });

});
