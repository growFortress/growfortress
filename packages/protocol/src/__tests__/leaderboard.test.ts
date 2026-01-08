/**
 * Leaderboard schema tests
 */
import { describe, it, expect } from 'vitest';
import {
  LeaderboardEntrySchema,
  LeaderboardQuerySchema,
  LeaderboardResponseSchema,
} from '../leaderboard.js';

describe('Leaderboard Schemas', () => {
  describe('LeaderboardEntrySchema', () => {
    it('validates correct entry', () => {
      const result = LeaderboardEntrySchema.safeParse({
        rank: 1,
        userId: 'user-123',
        score: 50000,
        wavesCleared: 25,
        createdAt: '2024-01-15T12:00:00Z',
      });

      expect(result.success).toBe(true);
    });

    it('rejects rank below 1', () => {
      const result = LeaderboardEntrySchema.safeParse({
        rank: 0,
        userId: 'user-123',
        score: 50000,
        wavesCleared: 25,
        createdAt: '2024-01-15T12:00:00Z',
      });

      expect(result.success).toBe(false);
    });

    it('rejects negative score', () => {
      const result = LeaderboardEntrySchema.safeParse({
        rank: 1,
        userId: 'user-123',
        score: -100,
        wavesCleared: 25,
        createdAt: '2024-01-15T12:00:00Z',
      });

      expect(result.success).toBe(false);
    });

    it('rejects negative wavesCleared', () => {
      const result = LeaderboardEntrySchema.safeParse({
        rank: 1,
        userId: 'user-123',
        score: 50000,
        wavesCleared: -1,
        createdAt: '2024-01-15T12:00:00Z',
      });

      expect(result.success).toBe(false);
    });

    it('rejects invalid datetime format', () => {
      const result = LeaderboardEntrySchema.safeParse({
        rank: 1,
        userId: 'user-123',
        score: 50000,
        wavesCleared: 25,
        createdAt: 'not-a-date',
      });

      expect(result.success).toBe(false);
    });

    it('accepts ISO datetime with milliseconds', () => {
      const result = LeaderboardEntrySchema.safeParse({
        rank: 1,
        userId: 'user-123',
        score: 50000,
        wavesCleared: 25,
        createdAt: '2024-01-15T12:00:00.000Z',
      });

      expect(result.success).toBe(true);
    });

    it('accepts score of 0', () => {
      const result = LeaderboardEntrySchema.safeParse({
        rank: 1,
        userId: 'user-123',
        score: 0,
        wavesCleared: 0,
        createdAt: '2024-01-15T12:00:00Z',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('LeaderboardQuerySchema', () => {
    it('validates correct query', () => {
      const result = LeaderboardQuerySchema.safeParse({
        week: '2024-W01',
        limit: 50,
        offset: 10,
      });

      expect(result.success).toBe(true);
    });

    it('applies default limit of 10', () => {
      const result = LeaderboardQuerySchema.safeParse({});

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(10);
      }
    });

    it('applies default offset of 0', () => {
      const result = LeaderboardQuerySchema.safeParse({});

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.offset).toBe(0);
      }
    });

    it('accepts empty query (all defaults)', () => {
      const result = LeaderboardQuerySchema.safeParse({});

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.week).toBeUndefined();
        expect(result.data.limit).toBe(10);
        expect(result.data.offset).toBe(0);
      }
    });

    it('rejects limit below 1', () => {
      const result = LeaderboardQuerySchema.safeParse({
        limit: 0,
      });

      expect(result.success).toBe(false);
    });

    it('rejects limit above 100', () => {
      const result = LeaderboardQuerySchema.safeParse({
        limit: 101,
      });

      expect(result.success).toBe(false);
    });

    it('accepts limit at boundaries (1 and 100)', () => {
      const result1 = LeaderboardQuerySchema.safeParse({ limit: 1 });
      const result100 = LeaderboardQuerySchema.safeParse({ limit: 100 });

      expect(result1.success).toBe(true);
      expect(result100.success).toBe(true);
    });

    it('rejects negative offset', () => {
      const result = LeaderboardQuerySchema.safeParse({
        offset: -1,
      });

      expect(result.success).toBe(false);
    });

    it('coerces string values to numbers', () => {
      const result = LeaderboardQuerySchema.safeParse({
        limit: '25',
        offset: '5',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(25);
        expect(result.data.offset).toBe(5);
      }
    });
  });

  describe('LeaderboardResponseSchema', () => {
    it('validates correct response', () => {
      const result = LeaderboardResponseSchema.safeParse({
        weekKey: '2024-W01',
        entries: [
          {
            rank: 1,
            userId: 'user-123',
            score: 100000,
            wavesCleared: 50,
            createdAt: '2024-01-15T12:00:00Z',
          },
          {
            rank: 2,
            userId: 'user-456',
            score: 90000,
            wavesCleared: 45,
            createdAt: '2024-01-14T10:00:00Z',
          },
        ],
        total: 100,
        userRank: 5,
        userScore: 75000,
      });

      expect(result.success).toBe(true);
    });

    it('accepts response without user ranking', () => {
      const result = LeaderboardResponseSchema.safeParse({
        weekKey: '2024-W01',
        entries: [],
        total: 0,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.userRank).toBeUndefined();
        expect(result.data.userScore).toBeUndefined();
      }
    });

    it('accepts empty entries array', () => {
      const result = LeaderboardResponseSchema.safeParse({
        weekKey: '2024-W01',
        entries: [],
        total: 0,
      });

      expect(result.success).toBe(true);
    });

    it('rejects negative total', () => {
      const result = LeaderboardResponseSchema.safeParse({
        weekKey: '2024-W01',
        entries: [],
        total: -1,
      });

      expect(result.success).toBe(false);
    });

    it('rejects userRank below 1', () => {
      const result = LeaderboardResponseSchema.safeParse({
        weekKey: '2024-W01',
        entries: [],
        total: 0,
        userRank: 0,
      });

      expect(result.success).toBe(false);
    });

    it('rejects negative userScore', () => {
      const result = LeaderboardResponseSchema.safeParse({
        weekKey: '2024-W01',
        entries: [],
        total: 0,
        userRank: 1,
        userScore: -100,
      });

      expect(result.success).toBe(false);
    });
  });
});
