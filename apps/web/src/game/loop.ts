import { CONFIG } from '../config.js';
import { timeScale, updateSlowMotion, slowMotionActive } from '../state/time.signals.js';

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
  private pausedForExternal = false; // Tracks if paused by external source (tutorial)
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
    // Don't cancel RAF - keep rendering the paused state
    // The tick function will skip game.step() but still render
  }

  resume(): void {
    if (!this.running || !this.paused) return;
    // Don't resume if externally paused (e.g., tutorial active)
    if (this.pausedForExternal) return;
    this.paused = false;
    this.lastTime = performance.now(); // Reset to avoid large delta
    // RAF loop is already running (continues during pause), just unpause
  }

  /** Pause from external source (tutorial, modal, etc.) - blocks visibility resume */
  pauseExternal(): void {
    if (!this.running) return;
    this.pausedForExternal = true;
    this.pause();
  }

  /** Resume from external pause */
  resumeExternal(): void {
    if (!this.pausedForExternal) return;
    this.pausedForExternal = false;
    // Only resume if not hidden
    if (!document.hidden) {
      this.resume();
    }
  }

  /** Check if paused by external source */
  isPausedExternal(): boolean {
    return this.pausedForExternal;
  }

  private cancelFrame(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private tick = (currentTime: number): void => {
    if (!this.running) return;

    // Always continue RAF loop for rendering, even when paused
    this.rafId = requestAnimationFrame(this.tick);

    // When paused, just render current state without advancing simulation
    if (this.paused) {
      this.render(0);
      return;
    }

    const delta = currentTime - this.lastTime;
    this.lastTime = currentTime;

    const cappedDelta = Math.min(delta, MAX_DELTA_MS);

    // Apply speed multiplier and slow motion time scale to delta time
    // timeScale < 1.0 = slow motion (e.g., 0.3 = 30% speed)
    // speedMultiplier > 1 = fast forward (e.g., 2 = 2x speed)
    const effectiveTimeScale = slowMotionActive.value ? timeScale.value : 1.0;
    this.accumulator += cappedDelta * this.speedMultiplier * effectiveTimeScale;

    // Track ticks processed this frame for slow motion updates
    let ticksProcessed = 0;

    // Fixed timestep for simulation
    while (this.accumulator >= TICK_MS) {
      this.game.step();
      this.accumulator -= TICK_MS;
      ticksProcessed++;

      // Update slow motion state after each tick
      // We need to get the current tick from game state
      if (slowMotionActive.value && ticksProcessed > 0) {
        // Get current tick from game - we'll use a counter approach
        // The actual tick is tracked in the simulation, but we update here
        updateSlowMotion(this.getCurrentTick());
      }
    }

    // Interpolation alpha for smooth rendering
    const alpha = this.accumulator / TICK_MS;
    this.render(alpha);
  };

  /** Get current tick from game (if available) */
  private getCurrentTick(): number {
    // The game interface is Steppable, which doesn't expose tick
    // We'll use a callback pattern instead, set by the consumer
    return this.tickGetter ? this.tickGetter() : 0;
  }

  /** Set a function to get current game tick */
  setTickGetter(getter: () => number): void {
    this.tickGetter = getter;
  }

  private tickGetter?: () => number;

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
