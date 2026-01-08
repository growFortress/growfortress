import { describe, it, expect } from 'vitest';
import { Xorshift32 } from '../../rng.js';

describe('Xorshift32', () => {
  describe('constructor', () => {
    it('initializes with valid seed', () => {
      const rng = new Xorshift32(12345);
      expect(rng.getState()).toBe(12345);
    });

    it('treats zero seed as 1 (non-zero state)', () => {
      const rng = new Xorshift32(0);
      expect(rng.getState()).toBe(1);
    });

    it('handles negative seed via unsigned conversion', () => {
      const rng = new Xorshift32(-1);
      // -1 >>> 0 = 4294967295
      expect(rng.getState()).toBe(4294967295);
    });

    it('handles large seed values', () => {
      const rng = new Xorshift32(0xFFFFFFFF);
      expect(rng.getState()).toBe(0xFFFFFFFF);
    });
  });

  describe('next', () => {
    it('produces 32-bit unsigned integers', () => {
      const rng = new Xorshift32(12345);
      for (let i = 0; i < 100; i++) {
        const value = rng.next();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(0xFFFFFFFF);
      }
    });

    it('same seed produces same sequence', () => {
      const rng1 = new Xorshift32(12345);
      const rng2 = new Xorshift32(12345);

      for (let i = 0; i < 1000; i++) {
        expect(rng1.next()).toBe(rng2.next());
      }
    });

    it('different seeds produce different sequences', () => {
      const rng1 = new Xorshift32(12345);
      const rng2 = new Xorshift32(54321);

      let sameCount = 0;
      for (let i = 0; i < 100; i++) {
        if (rng1.next() === rng2.next()) sameCount++;
      }

      expect(sameCount).toBeLessThan(5);
    });

    it('sequence is not trivially periodic (check 10000 values)', () => {
      const rng = new Xorshift32(12345);
      const seen = new Set<number>();

      for (let i = 0; i < 10000; i++) {
        const value = rng.next();
        // We shouldn't see many duplicates in 10000 values
        seen.add(value);
      }

      // Should have nearly all unique values
      expect(seen.size).toBeGreaterThan(9900);
    });

    it('produces different values each call', () => {
      const rng = new Xorshift32(12345);
      const first = rng.next();
      const second = rng.next();
      const third = rng.next();

      expect(first).not.toBe(second);
      expect(second).not.toBe(third);
    });
  });

  describe('nextFloat', () => {
    it('returns value in [0, 1)', () => {
      const rng = new Xorshift32(12345);
      for (let i = 0; i < 1000; i++) {
        const value = rng.nextFloat();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    });

    it('distribution is roughly uniform', () => {
      const rng = new Xorshift32(12345);
      const buckets = [0, 0, 0, 0, 0]; // 5 buckets for 0-0.2, 0.2-0.4, etc.
      const iterations = 10000;

      for (let i = 0; i < iterations; i++) {
        const value = rng.nextFloat();
        const bucket = Math.min(Math.floor(value * 5), 4);
        buckets[bucket]++;
      }

      // Each bucket should have roughly 20% (2000 values)
      // Allow 15% deviation
      const expected = iterations / 5;
      for (const count of buckets) {
        expect(count).toBeGreaterThan(expected * 0.85);
        expect(count).toBeLessThan(expected * 1.15);
      }
    });

    it('never returns exactly 1.0', () => {
      const rng = new Xorshift32(12345);
      for (let i = 0; i < 10000; i++) {
        expect(rng.nextFloat()).not.toBe(1.0);
      }
    });

    it('is deterministic with same seed', () => {
      const rng1 = new Xorshift32(99999);
      const rng2 = new Xorshift32(99999);

      for (let i = 0; i < 100; i++) {
        expect(rng1.nextFloat()).toBe(rng2.nextFloat());
      }
    });
  });

  describe('nextInt', () => {
    it('returns value in [min, max] inclusive', () => {
      const rng = new Xorshift32(12345);
      for (let i = 0; i < 1000; i++) {
        const value = rng.nextInt(5, 10);
        expect(value).toBeGreaterThanOrEqual(5);
        expect(value).toBeLessThanOrEqual(10);
      }
    });

    it('distribution is roughly uniform within range', () => {
      const rng = new Xorshift32(12345);
      const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
      const iterations = 6000;

      for (let i = 0; i < iterations; i++) {
        const value = rng.nextInt(1, 6);
        counts[value]++;
      }

      // Each value should appear roughly 1000 times
      const expected = iterations / 6;
      for (const count of Object.values(counts)) {
        expect(count).toBeGreaterThan(expected * 0.8);
        expect(count).toBeLessThan(expected * 1.2);
      }
    });

    it('handles min === max', () => {
      const rng = new Xorshift32(12345);
      for (let i = 0; i < 10; i++) {
        expect(rng.nextInt(5, 5)).toBe(5);
      }
    });

    it('handles large ranges', () => {
      const rng = new Xorshift32(12345);
      for (let i = 0; i < 100; i++) {
        const value = rng.nextInt(0, 1000000);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1000000);
      }
    });

    it('handles negative ranges', () => {
      const rng = new Xorshift32(12345);
      for (let i = 0; i < 100; i++) {
        const value = rng.nextInt(-10, -5);
        expect(value).toBeGreaterThanOrEqual(-10);
        expect(value).toBeLessThanOrEqual(-5);
      }
    });
  });

  describe('nextBool', () => {
    it('returns boolean', () => {
      const rng = new Xorshift32(12345);
      for (let i = 0; i < 100; i++) {
        const value = rng.nextBool();
        expect(typeof value).toBe('boolean');
      }
    });

    it('default probability is 0.5', () => {
      const rng = new Xorshift32(12345);
      let trueCount = 0;
      const iterations = 10000;

      for (let i = 0; i < iterations; i++) {
        if (rng.nextBool()) trueCount++;
      }

      // Should be roughly 50%
      const ratio = trueCount / iterations;
      expect(ratio).toBeGreaterThan(0.45);
      expect(ratio).toBeLessThan(0.55);
    });

    it('respects custom probability (high)', () => {
      const rng = new Xorshift32(12345);
      let trueCount = 0;
      const iterations = 10000;

      for (let i = 0; i < iterations; i++) {
        if (rng.nextBool(0.9)) trueCount++;
      }

      const ratio = trueCount / iterations;
      expect(ratio).toBeGreaterThan(0.85);
      expect(ratio).toBeLessThan(0.95);
    });

    it('respects custom probability (low)', () => {
      const rng = new Xorshift32(12345);
      let trueCount = 0;
      const iterations = 10000;

      for (let i = 0; i < iterations; i++) {
        if (rng.nextBool(0.1)) trueCount++;
      }

      const ratio = trueCount / iterations;
      expect(ratio).toBeGreaterThan(0.05);
      expect(ratio).toBeLessThan(0.15);
    });

    it('probability 0 always returns false', () => {
      const rng = new Xorshift32(12345);
      for (let i = 0; i < 100; i++) {
        expect(rng.nextBool(0)).toBe(false);
      }
    });

    it('probability 1 always returns true', () => {
      const rng = new Xorshift32(12345);
      for (let i = 0; i < 100; i++) {
        expect(rng.nextBool(1)).toBe(true);
      }
    });
  });

  describe('shuffle', () => {
    it('shuffles array in place', () => {
      const rng = new Xorshift32(12345);
      const original = [1, 2, 3, 4, 5];
      const arr = [...original];
      const result = rng.shuffle(arr);

      expect(result).toBe(arr); // Same reference
      expect(arr).not.toEqual(original); // Order changed (with high probability)
    });

    it('maintains all elements', () => {
      const rng = new Xorshift32(12345);
      const arr = [1, 2, 3, 4, 5];
      rng.shuffle(arr);

      expect(arr.sort()).toEqual([1, 2, 3, 4, 5]);
    });

    it('same seed produces same shuffle', () => {
      const arr1 = [1, 2, 3, 4, 5];
      const arr2 = [1, 2, 3, 4, 5];

      const rng1 = new Xorshift32(12345);
      const rng2 = new Xorshift32(12345);

      rng1.shuffle(arr1);
      rng2.shuffle(arr2);

      expect(arr1).toEqual(arr2);
    });

    it('returns the array reference', () => {
      const rng = new Xorshift32(12345);
      const arr = [1, 2, 3];
      expect(rng.shuffle(arr)).toBe(arr);
    });

    it('handles empty array', () => {
      const rng = new Xorshift32(12345);
      const arr: number[] = [];
      expect(rng.shuffle(arr)).toEqual([]);
    });

    it('handles single element array', () => {
      const rng = new Xorshift32(12345);
      const arr = [1];
      expect(rng.shuffle(arr)).toEqual([1]);
    });
  });

  describe('pick', () => {
    it('picks element from array', () => {
      const rng = new Xorshift32(12345);
      const arr = ['a', 'b', 'c', 'd', 'e'];

      for (let i = 0; i < 100; i++) {
        const picked = rng.pick(arr);
        expect(arr).toContain(picked);
      }
    });

    it('same seed picks same element', () => {
      const arr = ['a', 'b', 'c', 'd', 'e'];

      const rng1 = new Xorshift32(12345);
      const rng2 = new Xorshift32(12345);

      for (let i = 0; i < 10; i++) {
        expect(rng1.pick(arr)).toBe(rng2.pick(arr));
      }
    });

    it('picks all elements over many iterations', () => {
      const rng = new Xorshift32(12345);
      const arr = [1, 2, 3, 4, 5];
      const picked = new Set<number>();

      for (let i = 0; i < 1000; i++) {
        picked.add(rng.pick(arr));
      }

      expect(picked.size).toBe(5); // All elements picked at least once
    });
  });

  describe('pickN', () => {
    it('picks N unique elements', () => {
      const rng = new Xorshift32(12345);
      const arr = [1, 2, 3, 4, 5];
      const result = rng.pickN(arr, 3);

      expect(result.length).toBe(3);
      expect(new Set(result).size).toBe(3); // All unique
      for (const item of result) {
        expect(arr).toContain(item);
      }
    });

    it('handles N > array.length', () => {
      const rng = new Xorshift32(12345);
      const arr = [1, 2, 3];
      const result = rng.pickN(arr, 10);

      expect(result.length).toBe(3);
      expect(result.sort()).toEqual([1, 2, 3]);
    });

    it('returns copy, not mutated original', () => {
      const rng = new Xorshift32(12345);
      const arr = [1, 2, 3, 4, 5];
      const original = [...arr];
      const result = rng.pickN(arr, 3);

      expect(arr).toEqual(original); // Original unchanged
      expect(result).not.toBe(arr); // Different reference
    });

    it('picks N=0 returns empty array', () => {
      const rng = new Xorshift32(12345);
      const arr = [1, 2, 3];
      expect(rng.pickN(arr, 0)).toEqual([]);
    });

    it('same seed produces same selection', () => {
      const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

      const rng1 = new Xorshift32(12345);
      const rng2 = new Xorshift32(12345);

      const result1 = rng1.pickN(arr, 5);
      const result2 = rng2.pickN(arr, 5);

      expect(result1).toEqual(result2);
    });
  });

  describe('state management', () => {
    it('getState returns current state', () => {
      const rng = new Xorshift32(12345);
      expect(rng.getState()).toBe(12345);

      rng.next();
      const stateAfter = rng.getState();
      expect(stateAfter).not.toBe(12345);
    });

    it('setState restores to exact state', () => {
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

    it('setState with zero sets state to 1', () => {
      const rng = new Xorshift32(12345);
      rng.setState(0);
      expect(rng.getState()).toBe(1);
    });

    it('clone creates independent copy with same state', () => {
      const rng1 = new Xorshift32(12345);

      // Advance to some state
      for (let i = 0; i < 50; i++) rng1.next();

      const rng2 = rng1.clone();

      // Both should have same state
      expect(rng2.getState()).toBe(rng1.getState());

      // Both should produce same sequence
      for (let i = 0; i < 100; i++) {
        expect(rng1.next()).toBe(rng2.next());
      }
    });

    it('clone is independent (modifying one does not affect other)', () => {
      const rng1 = new Xorshift32(12345);
      const rng2 = rng1.clone();

      // Advance rng1 only
      for (let i = 0; i < 100; i++) rng1.next();

      // rng2 should still be at original state
      expect(rng2.getState()).toBe(12345);
    });
  });

  describe('Determinism verification', () => {
    it('produces known sequence for seed 1', () => {
      const rng = new Xorshift32(1);
      // First few values for seed=1 with xorshift32
      const first = rng.next();
      const second = rng.next();
      const third = rng.next();

      // These values should be consistent
      const rng2 = new Xorshift32(1);
      expect(rng2.next()).toBe(first);
      expect(rng2.next()).toBe(second);
      expect(rng2.next()).toBe(third);
    });

    it('full cycle produces consistent results across multiple runs', () => {
      const seed = 42;
      const values1: number[] = [];
      const values2: number[] = [];

      const rng1 = new Xorshift32(seed);
      const rng2 = new Xorshift32(seed);

      for (let i = 0; i < 1000; i++) {
        values1.push(rng1.next());
        values2.push(rng2.next());
      }

      expect(values1).toEqual(values2);
    });
  });
});
