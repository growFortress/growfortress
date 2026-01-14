/**
 * Spring Physics Animation System
 *
 * Provides natural, physics-based animations using spring dynamics.
 * Based on the equation: F = -kx - cv (spring force + damping)
 */

export interface SpringConfig {
  /** Spring stiffness (tension). Higher = faster oscillation. Range: 50-500 */
  stiffness: number;
  /** Damping coefficient. Higher = less oscillation. Range: 5-50 */
  damping: number;
  /** Mass of the object. Higher = more inertia. Range: 0.5-5 */
  mass: number;
  /** Velocity threshold to consider animation complete */
  restVelocity?: number;
  /** Displacement threshold to consider animation complete */
  restDisplacement?: number;
}

/** Preset spring configurations for common use cases */
export const springPresets: Record<string, SpringConfig> = {
  /** Quick, snappy response with minimal overshoot */
  snappy: { stiffness: 400, damping: 30, mass: 1 },
  /** Bouncy, playful motion with noticeable overshoot */
  bouncy: { stiffness: 300, damping: 10, mass: 1 },
  /** Soft, gentle motion - good for modals */
  gentle: { stiffness: 120, damping: 14, mass: 1 },
  /** Fast response for hover states */
  responsive: { stiffness: 500, damping: 35, mass: 0.8 },
  /** Slow, deliberate motion */
  slow: { stiffness: 80, damping: 20, mass: 2 },
  /** Very bouncy for celebrations/achievements */
  wobbly: { stiffness: 200, damping: 8, mass: 1 },
  /** Stiff with quick settle - good for toggles */
  stiff: { stiffness: 600, damping: 40, mass: 1 },
};

export interface SpringState {
  value: number;
  velocity: number;
  target: number;
  isAnimating: boolean;
}

/**
 * Calculates the next spring state using the semi-implicit Euler method.
 * More stable than explicit Euler for spring systems.
 */
export function stepSpring(
  state: SpringState,
  config: SpringConfig,
  deltaTime: number
): SpringState {
  const { stiffness, damping, mass, restVelocity = 0.001, restDisplacement = 0.001 } = config;

  // Clamp delta time to prevent instability with large gaps
  const dt = Math.min(deltaTime, 0.064); // Max 64ms

  const displacement = state.value - state.target;

  // Spring force: F = -kx
  const springForce = -stiffness * displacement;
  // Damping force: F = -cv
  const dampingForce = -damping * state.velocity;
  // Acceleration: a = F/m
  const acceleration = (springForce + dampingForce) / mass;

  // Semi-implicit Euler integration
  const newVelocity = state.velocity + acceleration * dt;
  const newValue = state.value + newVelocity * dt;

  // Check if we're at rest
  const isAtRest =
    Math.abs(newVelocity) < restVelocity && Math.abs(newValue - state.target) < restDisplacement;

  if (isAtRest) {
    return {
      value: state.target,
      velocity: 0,
      target: state.target,
      isAnimating: false,
    };
  }

  return {
    value: newValue,
    velocity: newVelocity,
    target: state.target,
    isAnimating: true,
  };
}

/**
 * Creates an initial spring state
 */
export function createSpringState(initialValue: number, target?: number): SpringState {
  return {
    value: initialValue,
    velocity: 0,
    target: target ?? initialValue,
    isAnimating: target !== undefined && target !== initialValue,
  };
}

/**
 * Updates the target of a spring state
 */
export function setSpringTarget(state: SpringState, target: number): SpringState {
  return {
    ...state,
    target,
    isAnimating: true,
  };
}

/**
 * Spring animation class for managing continuous spring animations
 */
export class SpringAnimation {
  private state: SpringState;
  private config: SpringConfig;
  private onUpdate?: (value: number) => void;
  private onComplete?: () => void;
  private animationFrame: number | null = null;
  private lastTime: number = 0;

  constructor(
    initialValue: number,
    config: SpringConfig | keyof typeof springPresets = 'snappy',
    onUpdate?: (value: number) => void,
    onComplete?: () => void
  ) {
    this.config = typeof config === 'string' ? springPresets[config] : config;
    this.state = createSpringState(initialValue);
    this.onUpdate = onUpdate;
    this.onComplete = onComplete;
  }

  /** Current animated value */
  get value(): number {
    return this.state.value;
  }

  /** Whether the spring is currently animating */
  get isAnimating(): boolean {
    return this.state.isAnimating;
  }

  /** Animate to a new target value */
  animateTo(target: number): this {
    this.state = setSpringTarget(this.state, target);
    this.startAnimation();
    return this;
  }

  /** Set value immediately without animation */
  set(value: number): this {
    this.stopAnimation();
    this.state = {
      value,
      velocity: 0,
      target: value,
      isAnimating: false,
    };
    this.onUpdate?.(value);
    return this;
  }

  /** Apply an impulse (velocity) to the spring */
  impulse(velocity: number): this {
    this.state.velocity += velocity;
    this.state.isAnimating = true;
    this.startAnimation();
    return this;
  }

  /** Stop the animation */
  stop(): this {
    this.stopAnimation();
    return this;
  }

  /** Clean up resources */
  dispose(): void {
    this.stopAnimation();
    this.onUpdate = undefined;
    this.onComplete = undefined;
  }

  private startAnimation(): void {
    if (this.animationFrame !== null) return;

    this.lastTime = performance.now();
    this.tick();
  }

  private stopAnimation(): void {
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  private tick = (): void => {
    const now = performance.now();
    const deltaTime = (now - this.lastTime) / 1000; // Convert to seconds
    this.lastTime = now;

    this.state = stepSpring(this.state, this.config, deltaTime);
    this.onUpdate?.(this.state.value);

    if (this.state.isAnimating) {
      this.animationFrame = requestAnimationFrame(this.tick);
    } else {
      this.animationFrame = null;
      this.onComplete?.();
    }
  };
}

/**
 * Creates a spring value hook-style interface for manual animation control
 */
export function createSpring(
  initialValue: number,
  config: SpringConfig | keyof typeof springPresets = 'snappy'
): {
  state: SpringState;
  config: SpringConfig;
  step: (deltaTime: number) => SpringState;
  setTarget: (target: number) => void;
  setValue: (value: number) => void;
} {
  const resolvedConfig = typeof config === 'string' ? springPresets[config] : config;
  let state = createSpringState(initialValue);

  return {
    get state() {
      return state;
    },
    config: resolvedConfig,
    step(deltaTime: number) {
      state = stepSpring(state, resolvedConfig, deltaTime);
      return state;
    },
    setTarget(target: number) {
      state = setSpringTarget(state, target);
    },
    setValue(value: number) {
      state = {
        value,
        velocity: 0,
        target: value,
        isAnimating: false,
      };
    },
  };
}

/**
 * Interpolates between springs for multi-dimensional animations
 */
export interface Vector2Spring {
  x: SpringState;
  y: SpringState;
}

export function createVector2Spring(
  initialX: number,
  initialY: number,
  config: SpringConfig | keyof typeof springPresets = 'snappy'
): {
  x: SpringState;
  y: SpringState;
  config: SpringConfig;
  step: (deltaTime: number) => { x: number; y: number; isAnimating: boolean };
  setTarget: (x: number, y: number) => void;
} {
  const resolvedConfig = typeof config === 'string' ? springPresets[config] : config;
  let stateX = createSpringState(initialX);
  let stateY = createSpringState(initialY);

  return {
    get x() {
      return stateX;
    },
    get y() {
      return stateY;
    },
    config: resolvedConfig,
    step(deltaTime: number) {
      stateX = stepSpring(stateX, resolvedConfig, deltaTime);
      stateY = stepSpring(stateY, resolvedConfig, deltaTime);
      return {
        x: stateX.value,
        y: stateY.value,
        isAnimating: stateX.isAnimating || stateY.isAnimating,
      };
    },
    setTarget(x: number, y: number) {
      stateX = setSpringTarget(stateX, x);
      stateY = setSpringTarget(stateY, y);
    },
  };
}
