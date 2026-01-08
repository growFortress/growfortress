/**
 * Events schema tests
 */
import { describe, it, expect } from 'vitest';
import {
  ChooseRelicEventSchema,
  RerollRelicsEventSchema,
  GameEventSchema,
  CheckpointSchema,
} from '../events.js';

describe('Events Schemas', () => {
  describe('ChooseRelicEventSchema', () => {
    it('validates correct event', () => {
      const result = ChooseRelicEventSchema.safeParse({
        type: 'CHOOSE_RELIC',
        tick: 1000,
        wave: 1,
        optionIndex: 0,
      });

      expect(result.success).toBe(true);
    });

    it('rejects missing tick', () => {
      const result = ChooseRelicEventSchema.safeParse({
        type: 'CHOOSE_RELIC',
        wave: 1,
        optionIndex: 0,
      });

      expect(result.success).toBe(false);
    });

    it('rejects negative tick', () => {
      const result = ChooseRelicEventSchema.safeParse({
        type: 'CHOOSE_RELIC',
        tick: -1,
        wave: 1,
        optionIndex: 0,
      });

      expect(result.success).toBe(false);
    });

    it('rejects wave below 1', () => {
      const result = ChooseRelicEventSchema.safeParse({
        type: 'CHOOSE_RELIC',
        tick: 1000,
        wave: 0,
        optionIndex: 0,
      });

      expect(result.success).toBe(false);
    });

    it('rejects optionIndex above 2', () => {
      const result = ChooseRelicEventSchema.safeParse({
        type: 'CHOOSE_RELIC',
        tick: 1000,
        wave: 1,
        optionIndex: 3,
      });

      expect(result.success).toBe(false);
    });

    it('rejects negative optionIndex', () => {
      const result = ChooseRelicEventSchema.safeParse({
        type: 'CHOOSE_RELIC',
        tick: 1000,
        wave: 1,
        optionIndex: -1,
      });

      expect(result.success).toBe(false);
    });

    it('accepts optionIndex 0, 1, 2', () => {
      for (const optionIndex of [0, 1, 2]) {
        const result = ChooseRelicEventSchema.safeParse({
          type: 'CHOOSE_RELIC',
          tick: 1000,
          wave: 1,
          optionIndex,
        });
        expect(result.success).toBe(true);
      }
    });
  });

  describe('RerollRelicsEventSchema', () => {
    it('validates correct event', () => {
      const result = RerollRelicsEventSchema.safeParse({
        type: 'REROLL_RELICS',
        tick: 1200,
      });

      expect(result.success).toBe(true);
    });

    it('accepts tick of 0', () => {
      const result = RerollRelicsEventSchema.safeParse({
        type: 'REROLL_RELICS',
        tick: 0,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('GameEventSchema (discriminated union)', () => {
    it('validates CHOOSE_RELIC event', () => {
      const result = GameEventSchema.safeParse({
        type: 'CHOOSE_RELIC',
        tick: 1000,
        wave: 1,
        optionIndex: 0,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('CHOOSE_RELIC');
      }
    });

    it('validates REROLL_RELICS event', () => {
      const result = GameEventSchema.safeParse({
        type: 'REROLL_RELICS',
        tick: 1200,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('REROLL_RELICS');
      }
    });

    it('rejects unknown event type', () => {
      const result = GameEventSchema.safeParse({
        type: 'UNKNOWN_EVENT',
        tick: 100,
      });

      expect(result.success).toBe(false);
    });

    it('rejects event missing required fields for type', () => {
      // CHOOSE_RELIC requires wave and optionIndex
      const result = GameEventSchema.safeParse({
        type: 'CHOOSE_RELIC',
        tick: 1000,
        // missing wave and optionIndex
      });

      expect(result.success).toBe(false);
    });
  });

  describe('CheckpointSchema', () => {
    it('validates correct checkpoint', () => {
      const result = CheckpointSchema.safeParse({
        tick: 1000,
        hash32: 123456789,
        chainHash32: 987654321,
      });

      expect(result.success).toBe(true);
    });

    it('rejects negative tick', () => {
      const result = CheckpointSchema.safeParse({
        tick: -1,
        hash32: 123456789,
        chainHash32: 987654321,
      });

      expect(result.success).toBe(false);
    });

    it('accepts tick of 0', () => {
      const result = CheckpointSchema.safeParse({
        tick: 0,
        hash32: 0,
        chainHash32: 0,
      });

      expect(result.success).toBe(true);
    });

    it('accepts negative hash values', () => {
      // Hash values are int32, can be negative
      const result = CheckpointSchema.safeParse({
        tick: 1000,
        hash32: -123456789,
        chainHash32: -987654321,
      });

      expect(result.success).toBe(true);
    });

    it('rejects missing fields', () => {
      const result = CheckpointSchema.safeParse({
        tick: 1000,
        hash32: 123456789,
        // missing chainHash32
      });

      expect(result.success).toBe(false);
    });

    it('rejects non-integer tick', () => {
      const result = CheckpointSchema.safeParse({
        tick: 1000.5,
        hash32: 123456789,
        chainHash32: 987654321,
      });

      expect(result.success).toBe(false);
    });
  });
});
