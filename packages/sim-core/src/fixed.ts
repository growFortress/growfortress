/**
 * Q16.16 Fixed-Point Math Library
 * ================================
 *
 * This library provides deterministic fixed-point arithmetic to avoid
 * floating-point precision issues across different platforms.
 *
 * FORMAT: Q16.16 (16 bits integer, 16 bits fractional)
 * - Range: -32768.0 to 32767.99998 (approximately)
 * - Precision: 1/65536 ≈ 0.0000153
 * - FP.ONE = 65536 (represents 1.0)
 *
 * USAGE EXAMPLES:
 * ```typescript
 * // Convert values
 * const fp5 = FP.fromInt(5);        // 5 → 327680 (5 * 65536)
 * const fp025 = FP.fromFloat(0.25); // 0.25 → 16384
 * const back = FP.toFloat(fp025);   // 16384 → 0.25
 *
 * // Arithmetic
 * const sum = FP.add(fp5, fp025);   // 5.25 in FP
 * const product = FP.mul(fp5, fp025); // 1.25 in FP
 *
 * // Position/velocity in game
 * const position = FP.fromFloat(10.5); // x = 10.5 units
 * const velocity = FP.fromFloat(0.1);  // speed = 0.1 units/tick
 * const newPos = FP.add(position, velocity); // move
 * ```
 *
 * IMPORTANT NOTES:
 * - All physics and game state use FP for deterministic replay
 * - Some systems use a different scale (16384 = 1.0) for stats - see systems.ts
 * - Always use FP functions, never raw arithmetic on FP values
 * - Overflow can occur with large multiplications - use FP.mulSafe if needed
 */

export const FP = {
  /** Number of fractional bits */
  SHIFT: 16,

  /** Fixed-point representation of 1.0 */
  ONE: 1 << 16,

  /** Fixed-point representation of 0.5 */
  HALF: 1 << 15,

  /** Maximum safe integer value */
  MAX: 0x7FFFFFFF,

  /** Minimum safe integer value */
  MIN: -0x80000000,

  /**
   * Convert integer to fixed-point
   */
  fromInt(n: number): number {
    return (n << 16) | 0;
  },

  /**
   * Convert float to fixed-point
   */
  fromFloat(n: number): number {
    return (n * (1 << 16)) | 0;
  },

  /**
   * Convert fixed-point to integer (truncates)
   */
  toInt(fp: number): number {
    return fp >> 16;
  },

  /**
   * Convert fixed-point to float
   */
  toFloat(fp: number): number {
    return fp / (1 << 16);
  },

  /**
   * Add two fixed-point numbers
   */
  add(a: number, b: number): number {
    return (a + b) | 0;
  },

  /**
   * Subtract fixed-point numbers (a - b)
   */
  sub(a: number, b: number): number {
    return (a - b) | 0;
  },

  /**
   * Multiply two fixed-point numbers
   */
  mul(a: number, b: number): number {
    // Use 64-bit intermediate to avoid overflow
    const result = (a * b) / (1 << 16);
    return result | 0;
  },

  /**
   * Divide fixed-point numbers (a / b)
   */
  div(a: number, b: number): number {
    if (b === 0) return a >= 0 ? FP.MAX : FP.MIN;
    // Use multiplication instead of shift to avoid 32-bit overflow
    return ((a * (1 << 16)) / b) | 0;
  },

  /**
   * Floor to nearest integer (in fixed-point)
   */
  floor(fp: number): number {
    return (fp & ~0xFFFF) | 0;
  },

  /**
   * Ceiling to nearest integer (in fixed-point)
   */
  ceil(fp: number): number {
    return ((fp + 0xFFFF) & ~0xFFFF) | 0;
  },

  /**
   * Round to nearest integer (in fixed-point)
   */
  round(fp: number): number {
    return ((fp + FP.HALF) & ~0xFFFF) | 0;
  },

  /**
   * Absolute value
   */
  abs(fp: number): number {
    return fp < 0 ? -fp : fp;
  },

  /**
   * Minimum of two values
   */
  min(a: number, b: number): number {
    return a < b ? a : b;
  },

  /**
   * Maximum of two values
   */
  max(a: number, b: number): number {
    return a > b ? a : b;
  },

  /**
   * Clamp value between min and max
   */
  clamp(value: number, min: number, max: number): number {
    if (value < min) return min;
    if (value > max) return max;
    return value;
  },

  /**
   * Linear interpolation
   * t should be in range [0, FP.ONE]
   */
  lerp(a: number, b: number, t: number): number {
    return FP.add(a, FP.mul(FP.sub(b, a), t));
  },

  /**
   * Integer square root (returns integer, not fixed-point)
   * Uses Newton's method
   */
  isqrt(n: number): number {
    if (n < 0) return 0;
    if (n < 2) return n;

    let x = n;
    let y = (x + 1) >> 1;

    while (y < x) {
      x = y;
      y = (x + (n / x | 0)) >> 1;
    }

    return x;
  },

  /**
   * Distance squared between two points (avoids sqrt)
   * Inputs are fixed-point, output is fixed-point
   */
  distSq(x1: number, y1: number, x2: number, y2: number): number {
    const dx = FP.sub(x2, x1);
    const dy = FP.sub(y2, y1);
    return FP.add(FP.mul(dx, dx), FP.mul(dy, dy));
  },

  // ============================================================================
  // 2D VECTOR OPERATIONS
  // ============================================================================

  /**
   * Fixed-point square root using Newton's method
   * Input and output are fixed-point
   */
  sqrt(fp: number): number {
    if (fp <= 0) return 0;

    // Scale up by FP.ONE to maintain precision after sqrt
    // sqrt(x * 2^16) = sqrt(x) * 2^8, so we need to scale result
    const scaled = fp;

    // Use integer sqrt on the raw value, then adjust
    let x = scaled;
    let y = (x + 1) >> 1;

    while (y < x) {
      x = y;
      y = (x + ((scaled / x) | 0)) >> 1;
    }

    // Scale result to fixed-point: multiply by 2^8 (sqrt of 2^16)
    return (x << 8) | 0;
  },

  /**
   * Length squared of a 2D vector (avoids sqrt)
   * Inputs are fixed-point, output is fixed-point
   */
  lengthSq2D(x: number, y: number): number {
    return FP.add(FP.mul(x, x), FP.mul(y, y));
  },

  /**
   * Length of a 2D vector
   * Inputs are fixed-point, output is fixed-point
   */
  length2D(x: number, y: number): number {
    const lenSq = FP.lengthSq2D(x, y);
    return FP.sqrt(lenSq);
  },

  /**
   * Distance between two points
   * Inputs are fixed-point, output is fixed-point
   */
  dist(x1: number, y1: number, x2: number, y2: number): number {
    const dx = FP.sub(x2, x1);
    const dy = FP.sub(y2, y1);
    return FP.length2D(dx, dy);
  },

  /**
   * Normalize a 2D vector (returns unit vector)
   * Inputs are fixed-point, outputs are fixed-point
   * Returns {x: 0, y: 0} for zero-length vectors
   */
  normalize2D(x: number, y: number): { x: number; y: number } {
    const len = FP.length2D(x, y);
    if (len === 0) return { x: 0, y: 0 };
    return {
      x: FP.div(x, len),
      y: FP.div(y, len),
    };
  },

  /**
   * Dot product of two 2D vectors
   * Inputs are fixed-point, output is fixed-point
   */
  dot2D(x1: number, y1: number, x2: number, y2: number): number {
    return FP.add(FP.mul(x1, x2), FP.mul(y1, y2));
  },

  /**
   * Scale a 2D vector by a scalar
   * Inputs are fixed-point, outputs are fixed-point
   */
  scale2D(x: number, y: number, scalar: number): { x: number; y: number } {
    return {
      x: FP.mul(x, scalar),
      y: FP.mul(y, scalar),
    };
  },

  /**
   * Add two 2D vectors
   * Inputs are fixed-point, outputs are fixed-point
   */
  add2D(x1: number, y1: number, x2: number, y2: number): { x: number; y: number } {
    return {
      x: FP.add(x1, x2),
      y: FP.add(y1, y2),
    };
  },

  /**
   * Subtract two 2D vectors (a - b)
   * Inputs are fixed-point, outputs are fixed-point
   */
  sub2D(x1: number, y1: number, x2: number, y2: number): { x: number; y: number } {
    return {
      x: FP.sub(x1, x2),
      y: FP.sub(y1, y2),
    };
  },

  /**
   * Reflect a vector off a surface with given normal
   * Inputs are fixed-point, outputs are fixed-point
   */
  reflect2D(
    vx: number,
    vy: number,
    nx: number,
    ny: number
  ): { x: number; y: number } {
    // r = v - 2(v·n)n
    const dot = FP.dot2D(vx, vy, nx, ny);
    const twoTimeDot = FP.mul(dot, FP.fromInt(2));
    return {
      x: FP.sub(vx, FP.mul(twoTimeDot, nx)),
      y: FP.sub(vy, FP.mul(twoTimeDot, ny)),
    };
  },

  /**
   * Rotate a 2D vector by an angle (in fixed-point radians)
   * Uses approximation for sin/cos
   * Inputs are fixed-point, outputs are fixed-point
   */
  rotate2D(x: number, y: number, angle: number): { x: number; y: number } {
    // Taylor series approximation for small angles
    // For larger angles, use lookup table in real implementation
    const cos = FP.cos(angle);
    const sin = FP.sin(angle);
    return {
      x: FP.sub(FP.mul(x, cos), FP.mul(y, sin)),
      y: FP.add(FP.mul(x, sin), FP.mul(y, cos)),
    };
  },

  /**
   * Approximate cosine using Taylor series
   * Input angle in fixed-point (where FP.ONE = 1 radian)
   */
  cos(angle: number): number {
    // Normalize angle to [-PI, PI] range
    const PI = FP.fromFloat(3.14159265);
    const TWO_PI = FP.mul(PI, FP.fromInt(2));

    // Reduce angle to [-PI, PI]
    while (angle > PI) angle = FP.sub(angle, TWO_PI);
    while (angle < -PI) angle = FP.add(angle, TWO_PI);

    // Taylor series: cos(x) ≈ 1 - x²/2! + x⁴/4!
    const x2 = FP.mul(angle, angle);
    const x4 = FP.mul(x2, x2);

    // 1/2! = 0.5, 1/4! = 0.0417
    const term1 = FP.div(x2, FP.fromInt(2));
    const term2 = FP.div(x4, FP.fromInt(24));

    return FP.sub(FP.add(FP.ONE, term2), term1);
  },

  /**
   * Approximate sine using Taylor series
   * Input angle in fixed-point (where FP.ONE = 1 radian)
   */
  sin(angle: number): number {
    // sin(x) = cos(x - PI/2)
    const HALF_PI = FP.fromFloat(1.5707963);
    return FP.cos(FP.sub(angle, HALF_PI));
  },
};
