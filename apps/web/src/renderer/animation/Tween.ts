/**
 * Tween system for smooth interpolation between values.
 * Supports numbers, objects with numeric properties, and arrays.
 */

import { EasingFunction, linear } from './easing.js';

export type TweenableValue = number | { [key: string]: number } | number[];

export interface TweenOptions {
  /** Easing function to use (default: linear) */
  easing?: EasingFunction;
  /** Delay before starting in milliseconds */
  delay?: number;
  /** Number of times to repeat (0 = no repeat, -1 = infinite) */
  repeat?: number;
  /** Whether to reverse on each repeat (yoyo) */
  yoyo?: boolean;
  /** Callback when tween starts */
  onStart?: () => void;
  /** Callback on each update with current value */
  onUpdate?: (value: TweenableValue) => void;
  /** Callback when tween completes */
  onComplete?: () => void;
  /** Callback when a repeat cycle completes */
  onRepeat?: (repeatCount: number) => void;
}

export class Tween<T extends TweenableValue> {
  private startValue: T;
  private endValue: T;
  private currentValue: T;
  private duration: number;
  private elapsed: number = 0;
  private delayRemaining: number;
  private easing: EasingFunction;
  private repeatCount: number;
  private currentRepeat: number = 0;
  private yoyo: boolean;
  private reversed: boolean = false;
  private started: boolean = false;
  private completed: boolean = false;
  private paused: boolean = false;

  private onStart?: () => void;
  private onUpdate?: (value: TweenableValue) => void;
  private onComplete?: () => void;
  private onRepeat?: (repeatCount: number) => void;

  constructor(from: T, to: T, durationMs: number, options: TweenOptions = {}) {
    this.startValue = this.cloneValue(from);
    this.endValue = this.cloneValue(to);
    this.currentValue = this.cloneValue(from);
    this.duration = durationMs;
    this.delayRemaining = options.delay ?? 0;
    this.easing = options.easing ?? linear;
    this.repeatCount = options.repeat ?? 0;
    this.yoyo = options.yoyo ?? false;
    this.onStart = options.onStart;
    this.onUpdate = options.onUpdate;
    this.onComplete = options.onComplete;
    this.onRepeat = options.onRepeat;
  }

  /**
   * Update the tween by delta time in milliseconds.
   * Returns the current interpolated value.
   */
  update(deltaMs: number): T {
    if (this.completed || this.paused) {
      return this.currentValue;
    }

    // Handle delay
    if (this.delayRemaining > 0) {
      this.delayRemaining -= deltaMs;
      if (this.delayRemaining > 0) {
        return this.currentValue;
      }
      // Overflow from delay goes into elapsed
      deltaMs = -this.delayRemaining;
      this.delayRemaining = 0;
    }

    // Fire start callback on first update
    if (!this.started) {
      this.started = true;
      this.onStart?.();
    }

    this.elapsed += deltaMs;

    // Calculate progress
    let progress = Math.min(1, this.elapsed / this.duration);
    const easedProgress = this.easing(this.reversed ? 1 - progress : progress);

    // Interpolate values
    this.interpolate(easedProgress);
    this.onUpdate?.(this.currentValue);

    // Check if this cycle is complete
    if (progress >= 1) {
      // Handle repeat
      if (this.repeatCount === -1 || this.currentRepeat < this.repeatCount) {
        this.currentRepeat++;
        this.elapsed = 0;

        if (this.yoyo) {
          this.reversed = !this.reversed;
        }

        this.onRepeat?.(this.currentRepeat);
      } else {
        // Tween complete
        this.completed = true;
        this.onComplete?.();
      }
    }

    return this.currentValue;
  }

  /**
   * Get the current interpolated value without updating.
   */
  getValue(): T {
    return this.currentValue;
  }

  /**
   * Check if the tween has completed.
   */
  isComplete(): boolean {
    return this.completed;
  }

  /**
   * Check if the tween is currently running.
   */
  isRunning(): boolean {
    return this.started && !this.completed && !this.paused;
  }

  /**
   * Pause the tween.
   */
  pause(): void {
    this.paused = true;
  }

  /**
   * Resume a paused tween.
   */
  resume(): void {
    this.paused = false;
  }

  /**
   * Stop the tween immediately.
   */
  stop(): void {
    this.completed = true;
  }

  /**
   * Reset the tween to its initial state.
   */
  reset(): void {
    this.elapsed = 0;
    this.currentRepeat = 0;
    this.started = false;
    this.completed = false;
    this.paused = false;
    this.reversed = false;
    this.currentValue = this.cloneValue(this.startValue);
  }

  /**
   * Get the elapsed time in milliseconds.
   */
  getElapsed(): number {
    return this.elapsed;
  }

  /**
   * Get the progress (0-1) of the current cycle.
   */
  getProgress(): number {
    return Math.min(1, this.elapsed / this.duration);
  }

  private cloneValue(value: T): T {
    if (typeof value === 'number') {
      return value as T;
    }
    if (Array.isArray(value)) {
      return [...value] as T;
    }
    // For object types, use Object.assign for proper spreading
    return Object.assign({}, value) as T;
  }

  private interpolate(t: number): void {
    if (typeof this.startValue === 'number' && typeof this.endValue === 'number') {
      (this.currentValue as number) = this.startValue + (this.endValue - this.startValue) * t;
    } else if (Array.isArray(this.startValue) && Array.isArray(this.endValue)) {
      const current = this.currentValue as number[];
      const start = this.startValue as number[];
      const end = this.endValue as number[];
      for (let i = 0; i < start.length; i++) {
        current[i] = start[i] + (end[i] - start[i]) * t;
      }
    } else if (typeof this.startValue === 'object' && typeof this.endValue === 'object') {
      const current = this.currentValue as { [key: string]: number };
      const start = this.startValue as { [key: string]: number };
      const end = this.endValue as { [key: string]: number };
      for (const key of Object.keys(start)) {
        current[key] = start[key] + (end[key] - start[key]) * t;
      }
    }
  }
}

/**
 * Manager for handling multiple tweens.
 */
export class TweenManager {
  private tweens: Set<Tween<TweenableValue>> = new Set();

  /**
   * Add a tween to be managed.
   */
  add<T extends TweenableValue>(tween: Tween<T>): Tween<T> {
    this.tweens.add(tween as Tween<TweenableValue>);
    return tween;
  }

  /**
   * Create and add a new tween.
   */
  create<T extends TweenableValue>(
    from: T,
    to: T,
    durationMs: number,
    options?: TweenOptions
  ): Tween<T> {
    const tween = new Tween(from, to, durationMs, options);
    this.add(tween);
    return tween;
  }

  /**
   * Update all managed tweens.
   * Removes completed tweens automatically.
   */
  update(deltaMs: number): void {
    for (const tween of this.tweens) {
      tween.update(deltaMs);
      if (tween.isComplete()) {
        this.tweens.delete(tween);
      }
    }
  }

  /**
   * Remove a specific tween.
   */
  remove(tween: Tween<TweenableValue>): void {
    this.tweens.delete(tween);
  }

  /**
   * Remove all tweens.
   */
  clear(): void {
    this.tweens.clear();
  }

  /**
   * Get the number of active tweens.
   */
  get count(): number {
    return this.tweens.size;
  }
}

/**
 * Sequence multiple tweens to run one after another.
 */
export class TweenSequence {
  private tweens: Tween<TweenableValue>[] = [];
  private currentIndex: number = 0;
  private completed: boolean = false;
  private onComplete?: () => void;

  constructor(onComplete?: () => void) {
    this.onComplete = onComplete;
  }

  /**
   * Add a tween to the sequence.
   */
  add<T extends TweenableValue>(tween: Tween<T>): this {
    this.tweens.push(tween as Tween<TweenableValue>);
    return this;
  }

  /**
   * Update the sequence.
   */
  update(deltaMs: number): void {
    if (this.completed || this.tweens.length === 0) return;

    const current = this.tweens[this.currentIndex];
    current.update(deltaMs);

    if (current.isComplete()) {
      this.currentIndex++;
      if (this.currentIndex >= this.tweens.length) {
        this.completed = true;
        this.onComplete?.();
      }
    }
  }

  /**
   * Check if the sequence is complete.
   */
  isComplete(): boolean {
    return this.completed;
  }

  /**
   * Reset the sequence to the beginning.
   */
  reset(): void {
    this.currentIndex = 0;
    this.completed = false;
    for (const tween of this.tweens) {
      tween.reset();
    }
  }
}

/**
 * Run multiple tweens in parallel.
 */
export class TweenParallel {
  private tweens: Tween<TweenableValue>[] = [];
  private completed: boolean = false;
  private onComplete?: () => void;

  constructor(onComplete?: () => void) {
    this.onComplete = onComplete;
  }

  /**
   * Add a tween to run in parallel.
   */
  add<T extends TweenableValue>(tween: Tween<T>): this {
    this.tweens.push(tween as Tween<TweenableValue>);
    return this;
  }

  /**
   * Update all tweens in parallel.
   */
  update(deltaMs: number): void {
    if (this.completed) return;

    let allComplete = true;
    for (const tween of this.tweens) {
      tween.update(deltaMs);
      if (!tween.isComplete()) {
        allComplete = false;
      }
    }

    if (allComplete) {
      this.completed = true;
      this.onComplete?.();
    }
  }

  /**
   * Check if all tweens are complete.
   */
  isComplete(): boolean {
    return this.completed;
  }

  /**
   * Reset all tweens.
   */
  reset(): void {
    this.completed = false;
    for (const tween of this.tweens) {
      tween.reset();
    }
  }
}

// Convenience factory functions
export const TweenFactory = {
  /**
   * Create a number tween.
   */
  number(from: number, to: number, durationMs: number, options?: TweenOptions): Tween<number> {
    return new Tween(from, to, durationMs, options);
  },

  /**
   * Create a position tween (x, y).
   */
  position(
    from: { x: number; y: number },
    to: { x: number; y: number },
    durationMs: number,
    options?: TweenOptions
  ): Tween<{ x: number; y: number }> {
    return new Tween(from, to, durationMs, options);
  },

  /**
   * Create a color tween (r, g, b).
   */
  color(
    from: { r: number; g: number; b: number },
    to: { r: number; g: number; b: number },
    durationMs: number,
    options?: TweenOptions
  ): Tween<{ r: number; g: number; b: number }> {
    return new Tween(from, to, durationMs, options);
  },

  /**
   * Create a scale tween.
   */
  scale(from: number, to: number, durationMs: number, options?: TweenOptions): Tween<number> {
    return new Tween(from, to, durationMs, options);
  },

  /**
   * Create an alpha/opacity tween.
   */
  alpha(from: number, to: number, durationMs: number, options?: TweenOptions): Tween<number> {
    return new Tween(from, to, durationMs, options);
  },
};
