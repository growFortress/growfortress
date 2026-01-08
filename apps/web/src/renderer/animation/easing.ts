/**
 * Easing functions for smooth animations.
 * All functions take a normalized time t (0-1) and return a normalized value (0-1).
 */

export type EasingFunction = (t: number) => number;

/**
 * Linear easing - no acceleration
 */
export function linear(t: number): number {
  return t;
}

// ============================================================================
// Quadratic easings (power of 2)
// ============================================================================

export function easeInQuad(t: number): number {
  return t * t;
}

export function easeOutQuad(t: number): number {
  return t * (2 - t);
}

export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// ============================================================================
// Cubic easings (power of 3)
// ============================================================================

export function easeInCubic(t: number): number {
  return t * t * t;
}

export function easeOutCubic(t: number): number {
  const t1 = t - 1;
  return t1 * t1 * t1 + 1;
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
}

// ============================================================================
// Quartic easings (power of 4)
// ============================================================================

export function easeInQuart(t: number): number {
  return t * t * t * t;
}

export function easeOutQuart(t: number): number {
  const t1 = t - 1;
  return 1 - t1 * t1 * t1 * t1;
}

export function easeInOutQuart(t: number): number {
  const t1 = t - 1;
  return t < 0.5 ? 8 * t * t * t * t : 1 - 8 * t1 * t1 * t1 * t1;
}

// ============================================================================
// Quint easings (power of 5)
// ============================================================================

export function easeInQuint(t: number): number {
  return t * t * t * t * t;
}

export function easeOutQuint(t: number): number {
  const t1 = t - 1;
  return 1 + t1 * t1 * t1 * t1 * t1;
}

export function easeInOutQuint(t: number): number {
  const t1 = t - 1;
  return t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * t1 * t1 * t1 * t1 * t1;
}

// ============================================================================
// Sine easings
// ============================================================================

export function easeInSine(t: number): number {
  return 1 - Math.cos((t * Math.PI) / 2);
}

export function easeOutSine(t: number): number {
  return Math.sin((t * Math.PI) / 2);
}

export function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

// ============================================================================
// Exponential easings
// ============================================================================

export function easeInExpo(t: number): number {
  return t === 0 ? 0 : Math.pow(2, 10 * (t - 1));
}

export function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export function easeInOutExpo(t: number): number {
  if (t === 0) return 0;
  if (t === 1) return 1;
  if (t < 0.5) return Math.pow(2, 20 * t - 10) / 2;
  return (2 - Math.pow(2, -20 * t + 10)) / 2;
}

// ============================================================================
// Circular easings
// ============================================================================

export function easeInCirc(t: number): number {
  return 1 - Math.sqrt(1 - t * t);
}

export function easeOutCirc(t: number): number {
  const t1 = t - 1;
  return Math.sqrt(1 - t1 * t1);
}

export function easeInOutCirc(t: number): number {
  if (t < 0.5) {
    return (1 - Math.sqrt(1 - 4 * t * t)) / 2;
  }
  return (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2;
}

// ============================================================================
// Back easings (overshoot)
// ============================================================================

const BACK_OVERSHOOT = 1.70158;
const BACK_OVERSHOOT_IN_OUT = BACK_OVERSHOOT * 1.525;

export function easeInBack(t: number): number {
  return t * t * ((BACK_OVERSHOOT + 1) * t - BACK_OVERSHOOT);
}

export function easeOutBack(t: number): number {
  const t1 = t - 1;
  return t1 * t1 * ((BACK_OVERSHOOT + 1) * t1 + BACK_OVERSHOOT) + 1;
}

export function easeInOutBack(t: number): number {
  if (t < 0.5) {
    return (Math.pow(2 * t, 2) * ((BACK_OVERSHOOT_IN_OUT + 1) * 2 * t - BACK_OVERSHOOT_IN_OUT)) / 2;
  }
  return (
    (Math.pow(2 * t - 2, 2) * ((BACK_OVERSHOOT_IN_OUT + 1) * (t * 2 - 2) + BACK_OVERSHOOT_IN_OUT) + 2) / 2
  );
}

// ============================================================================
// Elastic easings (spring-like)
// ============================================================================

const ELASTIC_PERIOD = 0.3;
const ELASTIC_AMPLITUDE = 1;

export function easeInElastic(t: number): number {
  if (t === 0) return 0;
  if (t === 1) return 1;
  const s = (ELASTIC_PERIOD / (2 * Math.PI)) * Math.asin(1 / ELASTIC_AMPLITUDE);
  return -(ELASTIC_AMPLITUDE * Math.pow(2, 10 * (t - 1)) * Math.sin(((t - 1 - s) * (2 * Math.PI)) / ELASTIC_PERIOD));
}

export function easeOutElastic(t: number): number {
  if (t === 0) return 0;
  if (t === 1) return 1;
  const s = (ELASTIC_PERIOD / (2 * Math.PI)) * Math.asin(1 / ELASTIC_AMPLITUDE);
  return ELASTIC_AMPLITUDE * Math.pow(2, -10 * t) * Math.sin(((t - s) * (2 * Math.PI)) / ELASTIC_PERIOD) + 1;
}

export function easeInOutElastic(t: number): number {
  if (t === 0) return 0;
  if (t === 1) return 1;
  const period = ELASTIC_PERIOD * 1.5;
  if (t < 0.5) {
    return -(ELASTIC_AMPLITUDE * Math.pow(2, 20 * t - 10) * Math.sin(((20 * t - 11.125) * (2 * Math.PI)) / period)) / 2;
  }
  return (ELASTIC_AMPLITUDE * Math.pow(2, -20 * t + 10) * Math.sin(((20 * t - 11.125) * (2 * Math.PI)) / period)) / 2 + 1;
}

// ============================================================================
// Bounce easings
// ============================================================================

export function easeOutBounce(t: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;

  if (t < 1 / d1) {
    return n1 * t * t;
  } else if (t < 2 / d1) {
    const t1 = t - 1.5 / d1;
    return n1 * t1 * t1 + 0.75;
  } else if (t < 2.5 / d1) {
    const t1 = t - 2.25 / d1;
    return n1 * t1 * t1 + 0.9375;
  } else {
    const t1 = t - 2.625 / d1;
    return n1 * t1 * t1 + 0.984375;
  }
}

export function easeInBounce(t: number): number {
  return 1 - easeOutBounce(1 - t);
}

export function easeInOutBounce(t: number): number {
  return t < 0.5
    ? (1 - easeOutBounce(1 - 2 * t)) / 2
    : (1 + easeOutBounce(2 * t - 1)) / 2;
}

// ============================================================================
// Easing presets for common use cases
// ============================================================================

export const Easing = {
  // Linear
  linear,

  // Quadratic
  easeInQuad,
  easeOutQuad,
  easeInOutQuad,

  // Cubic
  easeInCubic,
  easeOutCubic,
  easeInOutCubic,

  // Quartic
  easeInQuart,
  easeOutQuart,
  easeInOutQuart,

  // Quint
  easeInQuint,
  easeOutQuint,
  easeInOutQuint,

  // Sine
  easeInSine,
  easeOutSine,
  easeInOutSine,

  // Exponential
  easeInExpo,
  easeOutExpo,
  easeInOutExpo,

  // Circular
  easeInCirc,
  easeOutCirc,
  easeInOutCirc,

  // Back (overshoot)
  easeInBack,
  easeOutBack,
  easeInOutBack,

  // Elastic (spring)
  easeInElastic,
  easeOutElastic,
  easeInOutElastic,

  // Bounce
  easeInBounce,
  easeOutBounce,
  easeInOutBounce,
} as const;

/**
 * Create a custom bezier curve easing function.
 * Control points p1 and p2 define the curve shape.
 */
export function bezier(p1x: number, p1y: number, p2x: number, p2y: number): EasingFunction {
  // Newton-Raphson iteration for finding t given x
  const NEWTON_ITERATIONS = 4;
  const NEWTON_MIN_SLOPE = 0.001;

  function getSlope(aT: number, aA1: number, aA2: number): number {
    return 3 * aA1 * (1 - aT) * (1 - aT) + 6 * aA2 * (1 - aT) * aT + 3 * aT * aT * (1 - aA1 - aA2);
  }

  function calcBezier(aT: number, aA1: number, aA2: number): number {
    return 3 * aA1 * (1 - aT) * (1 - aT) * aT + 3 * aA2 * (1 - aT) * aT * aT + aT * aT * aT;
  }

  return function (x: number): number {
    if (x === 0) return 0;
    if (x === 1) return 1;

    let t = x;
    for (let i = 0; i < NEWTON_ITERATIONS; ++i) {
      const slope = getSlope(t, p1x, p2x);
      if (slope === 0) return calcBezier(t, p1y, p2y);
      if (Math.abs(slope) < NEWTON_MIN_SLOPE) break;
      const currentX = calcBezier(t, p1x, p2x) - x;
      t -= currentX / slope;
    }

    return calcBezier(t, p1y, p2y);
  };
}
