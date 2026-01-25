import { CONFIG } from '../config.js';

const TICK_MS = 1000 / CONFIG.TICK_RATE;
const MAX_DELTA_MS = 100; // Prevent spiral of death

/** Valid game speed multipliers */
export type GameSpeed = 1 | 2 | 5;

/** Interface for objects that can be stepped in the game loop */
export interface Steppable {
  step(): void;
}

export class GameLoop {
  private game: Steppable;
  private render: (alpha: number) => void;
  private running = false;
  private paused = false;
  private lastTime = 0;
  private accumulator = 0;
  private rafId: number | null = null;
  private speedMultiplier: GameSpeed = 1;

  constructor(game: Steppable, render: (alpha: number) => void) {
    this.game = game;
    this.render = render;
    // Handle visibility change to pause when tab is hidden
    document.addEventListener('visibilitychange', this.handleVisibility);
  }

  private handleVisibility = (): void => {
    if (document.hidden) {
      this.pause();
    } else {
      this.resume();
    }
  };

  start(): void {
    if (this.running) return;
    this.running = true;
    this.paused = false;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.tick(this.lastTime);
  }

  stop(): void {
    this.running = false;
    this.paused = false;
    this.cancelFrame();
  }

  pause(): void {
    if (!this.running || this.paused) return;
    this.paused = true;
    this.cancelFrame();
  }

  resume(): void {
    if (!this.running || !this.paused) return;
    this.paused = false;
    this.lastTime = performance.now(); // Reset to avoid large delta
    this.tick(this.lastTime);
  }

  private cancelFrame(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private tick = (currentTime: number): void => {
    if (!this.running || this.paused) return;

    const delta = currentTime - this.lastTime;
    this.lastTime = currentTime;

    const cappedDelta = Math.min(delta, MAX_DELTA_MS);
    // Apply speed multiplier to delta time
    this.accumulator += cappedDelta * this.speedMultiplier;

    // Fixed timestep for simulation
    while (this.accumulator >= TICK_MS) {
      this.game.step();
      this.accumulator -= TICK_MS;
    }

    // Interpolation alpha for smooth rendering
    const alpha = this.accumulator / TICK_MS;
    this.render(alpha);

    this.rafId = requestAnimationFrame(this.tick);
  };

  isRunning(): boolean {
    return this.running;
  }

  isPaused(): boolean {
    return this.paused;
  }

  /** Get current game speed multiplier */
  getSpeed(): GameSpeed {
    return this.speedMultiplier;
  }

  /** Set game speed multiplier (1x, 2x) */
  setSpeed(speed: GameSpeed): void {
    this.speedMultiplier = speed;
  }

  /** Clean up and release resources */
  destroy(): void {
    this.stop();
    document.removeEventListener('visibilitychange', this.handleVisibility);
  }
}
