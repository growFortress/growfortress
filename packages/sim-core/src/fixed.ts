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
 * - All operations use standardized truncation: always truncate to i32 immediately after operation
 * - Critical operations (mul/div/sqrt) use WASM with 64-bit intermediate when available,
 *   falling back to BigInt for maximum determinism and overflow safety
 */

// Import WASM wrapper (lazy loading, fallback to BigInt if not available)
import {
  mulWasmSync,
  divWasmSync,
  sqrtWasmSync,
  initWasm,
} from './fixed-wasm.js';

// Initialize WASM (non-blocking, will use fallback if WASM not available)
initWasm();

/**
 * BigInt fallback for mul operation
 * Uses 64-bit intermediate to avoid overflow
 * Standardized truncation: always truncate immediately after operation
 */
function mulBigInt(a: number, b: number): number {
  // Convert to BigInt for 64-bit arithmetic
  const aBig = BigInt(a);
  const bBig = BigInt(b);
  
  // Multiply in 64-bit, then shift right by 16 bits
  const result = (aBig * bBig) >> 16n;
  
  // Truncate to i32 (standardized truncation moment)
  return Number(result) | 0;
}

/**
 * BigInt fallback for div operation
 * Uses 64-bit intermediate to avoid overflow when shifting
 * Standardized truncation: always truncate immediately after operation
 */
function divBigInt(a: number, b: number): number {
  if (b === 0) return a >= 0 ? FP.MAX : FP.MIN;
  
  // Convert to BigInt for 64-bit arithmetic
  const aBig = BigInt(a);
  const bBig = BigInt(b);
  
  // Shift left by 16 bits in 64-bit, then divide
  const result = (aBig << 16n) / bBig;
  
  // Truncate to i32 (standardized truncation moment)
  return Number(result) | 0;
}

/**
 * BigInt fallback for sqrt operation
 * Uses 64-bit intermediate precision
 * Standardized truncation: always truncate immediately after operation
 */
function sqrtBigInt(fp: number): number {
  if (fp <= 0) return 0;
  
  // Convert to BigInt for 64-bit arithmetic
  const fpBig = BigInt(fp);
  
  // Use integer square root with Newton's method
  let x = fpBig;
  let y = (x + 1n) >> 1n;
  
  // Newton's method iteration
  while (y < x) {
    x = y;
    y = (x + (fpBig / x)) >> 1n;
  }
  
  // Scale result to fixed-point: multiply by 2^8 (sqrt of 2^16)
  const result = (x << 8n);
  
  // Truncate to i32 (standardized truncation moment)
  return Number(result) | 0;
}

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
   * Epsilon for distance comparisons and normalization
   * Very small distances below this threshold are treated as zero
   * Prevents division by near-zero values that cause desync
   * Value: ~0.001 units (65536 / 65536 = 1.0, so 65 = ~0.001)
   */
  EPSILON: 65, // ~0.001 in fixed-point

  /**
   * Convert integer to fixed-point
   * Standardized truncation: always truncate immediately after operation
   */
  fromInt(n: number): number {
    return (n << 16) | 0;
  },

  /**
   * Convert float to fixed-point
   * Standardized truncation: always truncate immediately after operation
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
   * Standardized truncation: always truncate immediately after operation
   */
  add(a: number, b: number): number {
    return (a + b) | 0;
  },

  /**
   * Subtract fixed-point numbers (a - b)
   * Standardized truncation: always truncate immediately after operation
   */
  sub(a: number, b: number): number {
    return (a - b) | 0;
  },

  /**
   * Multiply two fixed-point numbers (Q16.16)
   * 
   * Uses WASM with 64-bit intermediate when available, falls back to BigInt.
   * Formula: (a * b) >> 16
   * 
   * Standardized truncation: always truncate to i32 immediately after operation.
   * This ensures deterministic results across all platforms and prevents
   * differences from implicit float64 conversions.
   */
  mul(a: number, b: number): number {
    // Try WASM first (synchronous, already loaded if available)
    const wasmResult = mulWasmSync(a, b);
    if (wasmResult !== null) {
      return wasmResult;
    }
    
    // Fallback to BigInt for 64-bit precision
    return mulBigInt(a, b);
  },

  /**
   * Divide fixed-point numbers (a / b) (Q16.16)
   * 
   * Uses WASM with 64-bit intermediate when available, falls back to BigInt.
   * Formula: (a << 16) / b
   * 
   * Standardized truncation: always truncate to i32 immediately after operation.
   * This ensures deterministic results and prevents overflow when shifting large values.
   */
  div(a: number, b: number): number {
    if (b === 0) return a >= 0 ? FP.MAX : FP.MIN;
    
    // Try WASM first (synchronous, already loaded if available)
    const wasmResult = divWasmSync(a, b);
    if (wasmResult !== null) {
      return wasmResult;
    }
    
    // Fallback to BigInt for 64-bit precision
    return divBigInt(a, b);
  },

  /**
   * Floor to nearest integer (in fixed-point)
   * Standardized truncation: always truncate immediately after operation
   */
  floor(fp: number): number {
    return (fp & ~0xFFFF) | 0;
  },

  /**
   * Ceiling to nearest integer (in fixed-point)
   * Standardized truncation: always truncate immediately after operation
   */
  ceil(fp: number): number {
    return ((fp + 0xFFFF) & ~0xFFFF) | 0;
  },

  /**
   * Round to nearest integer (in fixed-point)
   * Standardized truncation: always truncate immediately after operation
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
   * Fixed-point square root (Q16.16)
   * 
   * Uses WASM with 64-bit intermediate when available, falls back to BigInt.
   * Uses Newton's method for integer square root.
   * 
   * Input and output are fixed-point (Q16.16 format).
   * Standardized truncation: always truncate to i32 immediately after operation.
   */
  sqrt(fp: number): number {
    if (fp <= 0) return 0;
    
    // Try WASM first (synchronous, already loaded if available)
    const wasmResult = sqrtWasmSync(fp);
    if (wasmResult !== null) {
      return wasmResult;
    }
    
    // Fallback to BigInt for 64-bit precision
    return sqrtBigInt(fp);
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
   * 
   * For very small distances (<= EPSILON), returns deterministic (1, 0) to prevent desync
   * from division by near-zero values and micro-differences in sqrt precision.
   */
  normalize2D(x: number, y: number): { x: number; y: number } {
    const lenSq = FP.lengthSq2D(x, y);
    if (lenSq === 0) return { x: 0, y: 0 };
    
    // Check if distance is very small (below epsilon threshold)
    // Use squared comparison to avoid sqrt for the check
    const epsilonSq = FP.mul(FP.EPSILON, FP.EPSILON);
    if (lenSq <= epsilonSq) {
      // Deterministic fallback: return (1, 0) for very small distances
      // This prevents desync from micro-differences in sqrt precision
      return { x: FP.ONE, y: 0 };
    }
    
    const len = FP.sqrt(lenSq);
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
