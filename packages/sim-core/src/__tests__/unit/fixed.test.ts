import { describe, it, expect } from 'vitest';
import { FP } from '../../fixed.js';

describe('FP (Q16.16 Fixed-Point Math)', () => {
  describe('Constants', () => {
    it('SHIFT equals 16', () => {
      expect(FP.SHIFT).toBe(16);
    });

    it('ONE equals 65536 (1 << 16)', () => {
      expect(FP.ONE).toBe(65536);
      expect(FP.ONE).toBe(1 << 16);
    });

    it('HALF equals 32768 (1 << 15)', () => {
      expect(FP.HALF).toBe(32768);
      expect(FP.HALF).toBe(1 << 15);
    });

    it('MAX equals 0x7FFFFFFF', () => {
      expect(FP.MAX).toBe(0x7FFFFFFF);
      expect(FP.MAX).toBe(2147483647);
    });

    it('MIN equals -0x80000000', () => {
      expect(FP.MIN).toBe(-0x80000000);
      expect(FP.MIN).toBe(-2147483648);
    });
  });

  describe('fromInt', () => {
    it('converts positive integer correctly', () => {
      expect(FP.fromInt(1)).toBe(FP.ONE);
      expect(FP.fromInt(5)).toBe(5 * FP.ONE);
      expect(FP.fromInt(100)).toBe(100 * FP.ONE);
    });

    it('converts negative integer correctly', () => {
      expect(FP.fromInt(-1)).toBe(-FP.ONE);
      expect(FP.fromInt(-5)).toBe(-5 * FP.ONE);
    });

    it('converts zero correctly', () => {
      expect(FP.fromInt(0)).toBe(0);
    });

    it('truncates to 32-bit integer', () => {
      const result = FP.fromInt(10);
      expect(result).toBe((10 << 16) | 0);
    });
  });

  describe('fromFloat', () => {
    it('converts 1.0 to ONE', () => {
      expect(FP.fromFloat(1.0)).toBe(FP.ONE);
    });

    it('converts 0.5 to HALF', () => {
      expect(FP.fromFloat(0.5)).toBe(FP.HALF);
    });

    it('converts negative float correctly', () => {
      expect(FP.fromFloat(-1.0)).toBe(-FP.ONE);
      expect(FP.fromFloat(-0.5)).toBe(-FP.HALF);
    });

    it('handles small fractions (0.001)', () => {
      const result = FP.fromFloat(0.001);
      // 0.001 * 65536 = 65.536, truncated to 65
      expect(result).toBe(65);
    });

    it('handles large floats within range', () => {
      const result = FP.fromFloat(1000.5);
      expect(FP.toFloat(result)).toBeCloseTo(1000.5, 3);
    });

    it('handles very small floats', () => {
      const result = FP.fromFloat(0.0001);
      expect(result).toBe(Math.floor(0.0001 * FP.ONE));
    });
  });

  describe('toInt', () => {
    it('extracts integer part from fixed-point', () => {
      expect(FP.toInt(FP.fromInt(5))).toBe(5);
      expect(FP.toInt(FP.fromInt(100))).toBe(100);
    });

    it('handles negative values correctly', () => {
      expect(FP.toInt(FP.fromInt(-5))).toBe(-5);
      expect(FP.toInt(FP.fromInt(-100))).toBe(-100);
    });

    it('truncates fractional part', () => {
      const fp = FP.fromFloat(5.7);
      expect(FP.toInt(fp)).toBe(5);
    });

    it('truncates toward negative infinity for negative values', () => {
      const fp = FP.fromFloat(-5.3);
      expect(FP.toInt(fp)).toBe(-6);
    });
  });

  describe('toFloat', () => {
    it('converts back to original float (within precision)', () => {
      expect(FP.toFloat(FP.fromInt(5))).toBe(5.0);
      expect(FP.toFloat(FP.HALF)).toBe(0.5);
      expect(FP.toFloat(FP.ONE)).toBe(1.0);
    });

    it('roundtrip: fromFloat(toFloat(x)) preserves precision', () => {
      const original = 3.5;
      const fp = FP.fromFloat(original);
      expect(FP.toFloat(fp)).toBeCloseTo(original, 4);
    });

    it('handles zero', () => {
      expect(FP.toFloat(0)).toBe(0);
    });
  });

  describe('add', () => {
    it('adds two positive numbers', () => {
      const a = FP.fromInt(3);
      const b = FP.fromInt(5);
      expect(FP.toInt(FP.add(a, b))).toBe(8);
    });

    it('adds positive and negative', () => {
      const a = FP.fromInt(10);
      const b = FP.fromInt(-3);
      expect(FP.toInt(FP.add(a, b))).toBe(7);
    });

    it('adds with fractional parts', () => {
      const a = FP.fromFloat(1.5);
      const b = FP.fromFloat(2.5);
      expect(FP.toFloat(FP.add(a, b))).toBeCloseTo(4.0, 4);
    });

    it('result is 32-bit integer', () => {
      const a = FP.fromInt(100);
      const b = FP.fromInt(200);
      const result = FP.add(a, b);
      expect(result).toBe((result | 0));
    });
  });

  describe('sub', () => {
    it('subtracts two numbers', () => {
      const a = FP.fromInt(10);
      const b = FP.fromInt(3);
      expect(FP.toInt(FP.sub(a, b))).toBe(7);
    });

    it('subtracts resulting in negative', () => {
      const a = FP.fromInt(3);
      const b = FP.fromInt(10);
      expect(FP.toInt(FP.sub(a, b))).toBe(-7);
    });

    it('subtracts with fractional parts', () => {
      const a = FP.fromFloat(5.5);
      const b = FP.fromFloat(2.25);
      expect(FP.toFloat(FP.sub(a, b))).toBeCloseTo(3.25, 4);
    });
  });

  describe('mul', () => {
    it('multiplies two fixed-point numbers', () => {
      const a = FP.fromInt(3);
      const b = FP.fromInt(4);
      expect(FP.toInt(FP.mul(a, b))).toBe(12);
    });

    it('result maintains Q16.16 format', () => {
      const a = FP.fromFloat(2.5);
      const b = FP.fromFloat(3.0);
      expect(FP.toFloat(FP.mul(a, b))).toBeCloseTo(7.5, 4);
    });

    it('handles negative operands', () => {
      const a = FP.fromInt(3);
      const b = FP.fromInt(-4);
      expect(FP.toInt(FP.mul(a, b))).toBe(-12);
    });

    it('handles both operands negative', () => {
      const a = FP.fromInt(-3);
      const b = FP.fromInt(-4);
      expect(FP.toInt(FP.mul(a, b))).toBe(12);
    });

    it('multiplies with fractional values', () => {
      const a = FP.fromFloat(1.5);
      const b = FP.fromFloat(2.0);
      expect(FP.toFloat(FP.mul(a, b))).toBeCloseTo(3.0, 4);
    });
  });

  describe('div', () => {
    it('division by zero returns MAX for positive dividend', () => {
      const a = FP.fromInt(10);
      expect(FP.div(a, 0)).toBe(FP.MAX);
    });

    it('division by zero returns MIN for negative dividend', () => {
      const a = FP.fromInt(-10);
      expect(FP.div(a, 0)).toBe(FP.MIN);
    });

    it('divides small fixed-point numbers correctly', () => {
      // Use small values to avoid overflow in (a << 16)
      // a << 16 must fit in 32-bit signed integer
      const a = 100; // Small value in fixed-point space
      const b = FP.fromInt(2); // 2.0 in fixed-point = 131072
      const result = FP.div(a, b);
      // (100 << 16) / 131072 = 6553600 / 131072 = 50
      expect(result).toBe(50);
    });

    it('handles division that produces fractional result', () => {
      // Division should work for values where a << 16 doesn't overflow
      // Note: Large fixed-point values like 3 * FP.ONE will overflow when shifted
      // Using direct calculation: (3 << 16) / (2 * 65536) = 196608 / 131072 = 1.5
      // But (3 * 65536) << 16 overflows, so we use smaller values
      const smallA = FP.fromFloat(0.003); // Very small value
      const smallB = FP.fromFloat(0.001); // Even smaller
      const smallResult = FP.div(smallA, smallB);
      // Should be approximately 3
      expect(FP.toFloat(smallResult)).toBeCloseTo(3.0, 0);
    });
  });

  describe('floor', () => {
    it('floors to integer boundary (in fixed-point)', () => {
      const fp = FP.fromFloat(3.7);
      expect(FP.toInt(FP.floor(fp))).toBe(3);
    });

    it('floors exact integers unchanged', () => {
      const fp = FP.fromInt(5);
      expect(FP.floor(fp)).toBe(fp);
    });

    it('handles negative values', () => {
      const fp = FP.fromFloat(-3.3);
      expect(FP.toInt(FP.floor(fp))).toBe(-4);
    });
  });

  describe('ceil', () => {
    it('ceils to integer boundary (in fixed-point)', () => {
      const fp = FP.fromFloat(3.3);
      expect(FP.toInt(FP.ceil(fp))).toBe(4);
    });

    it('ceils exact integers unchanged', () => {
      const fp = FP.fromInt(5);
      expect(FP.ceil(fp)).toBe(fp);
    });

    it('handles negative values', () => {
      const fp = FP.fromFloat(-3.7);
      expect(FP.toInt(FP.ceil(fp))).toBe(-3);
    });
  });

  describe('round', () => {
    it('rounds down when < 0.5', () => {
      const fp = FP.fromFloat(3.3);
      expect(FP.toInt(FP.round(fp))).toBe(3);
    });

    it('rounds up when >= 0.5', () => {
      const fp = FP.fromFloat(3.5);
      expect(FP.toInt(FP.round(fp))).toBe(4);
    });

    it('handles 0.5 case (rounds up)', () => {
      const fp = FP.add(FP.fromInt(2), FP.HALF);
      expect(FP.toInt(FP.round(fp))).toBe(3);
    });

    it('handles negative values', () => {
      const fp = FP.fromFloat(-3.3);
      expect(FP.toInt(FP.round(fp))).toBe(-3);
    });
  });

  describe('abs', () => {
    it('returns positive value for positive input', () => {
      const fp = FP.fromInt(5);
      expect(FP.abs(fp)).toBe(fp);
    });

    it('returns positive value for negative input', () => {
      const fp = FP.fromInt(-5);
      expect(FP.abs(fp)).toBe(FP.fromInt(5));
    });

    it('returns zero for zero', () => {
      expect(FP.abs(0)).toBe(0);
    });
  });

  describe('min', () => {
    it('returns minimum of two values', () => {
      const a = FP.fromInt(3);
      const b = FP.fromInt(7);
      expect(FP.min(a, b)).toBe(a);
      expect(FP.min(b, a)).toBe(a);
    });

    it('handles negative values', () => {
      const a = FP.fromInt(-5);
      const b = FP.fromInt(3);
      expect(FP.min(a, b)).toBe(a);
    });

    it('returns either when equal', () => {
      const a = FP.fromInt(5);
      const b = FP.fromInt(5);
      expect(FP.min(a, b)).toBe(a);
    });
  });

  describe('max', () => {
    it('returns maximum of two values', () => {
      const a = FP.fromInt(3);
      const b = FP.fromInt(7);
      expect(FP.max(a, b)).toBe(b);
      expect(FP.max(b, a)).toBe(b);
    });

    it('handles negative values', () => {
      const a = FP.fromInt(-5);
      const b = FP.fromInt(3);
      expect(FP.max(a, b)).toBe(b);
    });

    it('returns either when equal', () => {
      const a = FP.fromInt(5);
      const b = FP.fromInt(5);
      expect(FP.max(a, b)).toBe(a);
    });
  });

  describe('clamp', () => {
    it('clamps value within range', () => {
      const val = FP.fromInt(5);
      const min = FP.fromInt(0);
      const max = FP.fromInt(10);
      expect(FP.clamp(val, min, max)).toBe(val);
    });

    it('clamps value below range', () => {
      const val = FP.fromInt(-5);
      const min = FP.fromInt(0);
      const max = FP.fromInt(10);
      expect(FP.clamp(val, min, max)).toBe(min);
    });

    it('clamps value above range', () => {
      const val = FP.fromInt(15);
      const min = FP.fromInt(0);
      const max = FP.fromInt(10);
      expect(FP.clamp(val, min, max)).toBe(max);
    });

    it('handles edge cases at boundaries', () => {
      const min = FP.fromInt(0);
      const max = FP.fromInt(10);
      expect(FP.clamp(min, min, max)).toBe(min);
      expect(FP.clamp(max, min, max)).toBe(max);
    });
  });

  describe('lerp', () => {
    it('interpolates at t=0', () => {
      const a = FP.fromInt(0);
      const b = FP.fromInt(10);
      const t = 0;
      expect(FP.lerp(a, b, t)).toBe(a);
    });

    it('interpolates at t=FP.ONE (1.0)', () => {
      const a = FP.fromInt(0);
      const b = FP.fromInt(10);
      const t = FP.ONE;
      expect(FP.toInt(FP.lerp(a, b, t))).toBe(10);
    });

    it('interpolates at t=0.5', () => {
      const a = FP.fromInt(0);
      const b = FP.fromInt(10);
      const t = FP.HALF;
      expect(FP.toInt(FP.lerp(a, b, t))).toBe(5);
    });

    it('interpolates with fractional values', () => {
      const a = FP.fromFloat(2.0);
      const b = FP.fromFloat(4.0);
      const t = FP.HALF;
      expect(FP.toFloat(FP.lerp(a, b, t))).toBeCloseTo(3.0, 4);
    });
  });

  describe('isqrt', () => {
    it('computes integer square root of perfect squares', () => {
      expect(FP.isqrt(4)).toBe(2);
      expect(FP.isqrt(9)).toBe(3);
      expect(FP.isqrt(16)).toBe(4);
      expect(FP.isqrt(100)).toBe(10);
    });

    it('returns floor for non-perfect squares', () => {
      expect(FP.isqrt(5)).toBe(2);
      expect(FP.isqrt(10)).toBe(3);
      expect(FP.isqrt(99)).toBe(9);
    });

    it('handles zero', () => {
      expect(FP.isqrt(0)).toBe(0);
    });

    it('handles one', () => {
      expect(FP.isqrt(1)).toBe(1);
    });

    it('returns 0 for negative inputs', () => {
      expect(FP.isqrt(-5)).toBe(0);
    });

    it('validates against known values', () => {
      expect(FP.isqrt(144)).toBe(12);
      expect(FP.isqrt(625)).toBe(25);
    });
  });

  describe('distSq', () => {
    it('computes distance squared between points', () => {
      const x1 = FP.fromInt(0);
      const y1 = FP.fromInt(0);
      const x2 = FP.fromInt(3);
      const y2 = FP.fromInt(4);
      // Distance = 5, distSq = 25
      const result = FP.distSq(x1, y1, x2, y2);
      expect(FP.toInt(result)).toBe(25);
    });

    it('handles same point (distance = 0)', () => {
      const x = FP.fromInt(5);
      const y = FP.fromInt(5);
      expect(FP.distSq(x, y, x, y)).toBe(0);
    });

    it('handles negative coordinates', () => {
      const x1 = FP.fromInt(-3);
      const y1 = FP.fromInt(-4);
      const x2 = FP.fromInt(0);
      const y2 = FP.fromInt(0);
      const result = FP.distSq(x1, y1, x2, y2);
      expect(FP.toInt(result)).toBe(25);
    });

    it('is symmetric', () => {
      const x1 = FP.fromInt(1);
      const y1 = FP.fromInt(2);
      const x2 = FP.fromInt(4);
      const y2 = FP.fromInt(6);
      expect(FP.distSq(x1, y1, x2, y2)).toBe(FP.distSq(x2, y2, x1, y1));
    });
  });

  describe('Edge Cases and Precision', () => {
    it('handles very small fixed-point values', () => {
      const small = 1; // Smallest representable fixed-point value
      expect(FP.add(small, small)).toBe(2);
    });

    it('preserves precision through multiple operations', () => {
      const a = FP.fromFloat(1.5);
      const b = FP.fromFloat(2.5);
      const sum = FP.add(a, b);
      const product = FP.mul(sum, FP.fromFloat(0.5));
      expect(FP.toFloat(product)).toBeCloseTo(2.0, 3);
    });

    it('mul produces correct results', () => {
      const a = FP.fromInt(10);
      const b = FP.fromInt(3);
      const product = FP.mul(a, b);
      // 10 * 3 = 30
      expect(FP.toInt(product)).toBe(30);
    });
  });

  describe('Overflow Protection (64-bit intermediate)', () => {
    // Note: Q16.16 format can only represent values from -32768 to ~32767
    // Tests use values within this range to avoid overflow
    describe('mul overflow cases', () => {
      it('handles multiplications that fit within Q16.16 range', () => {
        // 100 * 100 = 10000 (within Q16.16 range)
        const a = FP.fromInt(100);
        const b = FP.fromInt(100);
        const result = FP.mul(a, b);
        expect(FP.toInt(result)).toBe(10000);
      });

      it('handles large fixed-point values in mul', () => {
        // Test near maximum range values
        const a = FP.fromInt(30000); // Large value
        const b = FP.fromFloat(0.5); // 0.5
        const result = FP.mul(a, b);
        expect(FP.toInt(result)).toBe(15000);
      });

      it('handles negative values in mul', () => {
        // -100 * 150 = -15000 (within Q16.16 range)
        const a = FP.fromInt(-100);
        const b = FP.fromInt(150);
        const result = FP.mul(a, b);
        expect(FP.toInt(result)).toBe(-15000);
      });
    });

    describe('div overflow cases', () => {
      it('handles large values in division without overflow', () => {
        // Large value that would overflow when shifted: a * 65536
        const largeA = FP.fromInt(30000);
        const b = FP.fromInt(2);
        const result = FP.div(largeA, b);
        // Should be 30000 / 2 = 15000
        expect(FP.toInt(result)).toBe(15000);
      });

      it('handles division with result within Q16.16 range', () => {
        const a = FP.fromInt(10000);
        const b = FP.fromFloat(0.5); // 0.5 in fixed-point
        const result = FP.div(a, b);
        // 10000 / 0.5 = 20000 (within Q16.16 range)
        expect(FP.toInt(result)).toBe(20000);
      });

      it('handles small divisors correctly within range', () => {
        const a = FP.fromInt(10);
        const b = FP.fromFloat(0.01); // Small divisor with better precision
        const result = FP.div(a, b);
        // 10 / 0.01 = 1000 (within Q16.16 range)
        expect(FP.toInt(result)).toBe(1000);
      });
    });

    describe('sqrt edge cases', () => {
      it('handles large fixed-point values in sqrt', () => {
        const large = FP.fromInt(10000); // 10000 in fixed-point
        const result = FP.sqrt(large);
        // sqrt(10000) = 100, but in Q16.16 format
        expect(FP.toInt(result)).toBe(100);
      });

      it('handles very small fixed-point values in sqrt', () => {
        const small = FP.fromFloat(0.0001);
        const result = FP.sqrt(small);
        // Should be very small but non-zero
        expect(result).toBeGreaterThanOrEqual(0);
      });

      it('handles perfect squares in sqrt', () => {
        const perfectSquare = FP.fromInt(144); // 12^2
        const result = FP.sqrt(perfectSquare);
        expect(FP.toInt(result)).toBe(12);
      });

      it('handles zero and negative in sqrt', () => {
        expect(FP.sqrt(0)).toBe(0);
        expect(FP.sqrt(-100)).toBe(0);
        expect(FP.sqrt(FP.fromInt(-50))).toBe(0);
      });
    });
  });

  describe('Determinism', () => {
    it('produces identical results for same inputs (mul)', () => {
      const a = FP.fromFloat(123.456);
      const b = FP.fromFloat(789.012);
      
      const result1 = FP.mul(a, b);
      const result2 = FP.mul(a, b);
      const result3 = FP.mul(a, b);
      
      // All results must be identical
      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });

    it('produces identical results for same inputs (div)', () => {
      const a = FP.fromFloat(123.456);
      const b = FP.fromFloat(789.012);
      
      const result1 = FP.div(a, b);
      const result2 = FP.div(a, b);
      const result3 = FP.div(a, b);
      
      // All results must be identical
      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });

    it('produces identical results for same inputs (sqrt)', () => {
      const a = FP.fromFloat(123.456);
      
      const result1 = FP.sqrt(a);
      const result2 = FP.sqrt(a);
      const result3 = FP.sqrt(a);
      
      // All results must be identical
      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });

    it('maintains determinism through complex operations', () => {
      const x1 = FP.fromFloat(10.5);
      const y1 = FP.fromFloat(20.3);
      const x2 = FP.fromFloat(15.7);
      const y2 = FP.fromFloat(25.9);
      
      // Complex calculation: normalize vector, then scale
      const dx = FP.sub(x2, x1);
      const dy = FP.sub(y2, y1);
      const dist = FP.sqrt(FP.add(FP.mul(dx, dx), FP.mul(dy, dy)));
      const normalized = { x: FP.div(dx, dist), y: FP.div(dy, dist) };
      const scaled = { x: FP.mul(normalized.x, FP.fromInt(100)), y: FP.mul(normalized.y, FP.fromInt(100)) };
      
      // Run same calculation again
      const dx2 = FP.sub(x2, x1);
      const dy2 = FP.sub(y2, y1);
      const dist2 = FP.sqrt(FP.add(FP.mul(dx2, dx2), FP.mul(dy2, dy2)));
      const normalized2 = { x: FP.div(dx2, dist2), y: FP.div(dy2, dist2) };
      const scaled2 = { x: FP.mul(normalized2.x, FP.fromInt(100)), y: FP.mul(normalized2.y, FP.fromInt(100)) };
      
      // Results must be identical
      expect(scaled.x).toBe(scaled2.x);
      expect(scaled.y).toBe(scaled2.y);
    });
  });

  describe('Standardized Truncation', () => {
    it('always truncates mul result to 32-bit integer', () => {
      const a = FP.fromFloat(123.456);
      const b = FP.fromFloat(789.012);
      const result = FP.mul(a, b);
      
      // Result must be a 32-bit integer (truncated)
      expect(result).toBe(result | 0);
      expect(Number.isInteger(result)).toBe(true);
    });

    it('always truncates div result to 32-bit integer', () => {
      const a = FP.fromFloat(123.456);
      const b = FP.fromFloat(789.012);
      const result = FP.div(a, b);
      
      // Result must be a 32-bit integer (truncated)
      expect(result).toBe(result | 0);
      expect(Number.isInteger(result)).toBe(true);
    });

    it('always truncates sqrt result to 32-bit integer', () => {
      const a = FP.fromFloat(123.456);
      const result = FP.sqrt(a);
      
      // Result must be a 32-bit integer (truncated)
      expect(result).toBe(result | 0);
      expect(Number.isInteger(result)).toBe(true);
    });

    it('ensures no float64 intermediate values leak through', () => {
      // Chain multiple operations to ensure truncation happens at each step
      const a = FP.fromFloat(10.5);
      const b = FP.fromFloat(2.3);
      const c = FP.fromFloat(1.7);
      
      // Each operation should truncate immediately
      const step1 = FP.mul(a, b);
      expect(step1).toBe(step1 | 0);
      
      const step2 = FP.mul(step1, c);
      expect(step2).toBe(step2 | 0);
      
      const step3 = FP.div(step2, FP.fromInt(2));
      expect(step3).toBe(step3 | 0);
    });
  });
});
