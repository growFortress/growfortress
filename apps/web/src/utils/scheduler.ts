/**
 * Scheduler utilities for deferring non-critical work to idle periods.
 *
 * Uses requestIdleCallback when available, falls back to setTimeout.
 * This helps keep the main thread responsive during gameplay.
 */

// Check for requestIdleCallback support
const hasIdleCallback = typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function';

/**
 * Schedule a callback to run during browser idle time.
 * Falls back to setTimeout if requestIdleCallback is not available.
 *
 * @param callback - Function to execute during idle time
 * @param options - Optional timeout (max wait time in ms)
 * @returns Handle that can be used to cancel the callback
 */
export function scheduleIdleTask(
  callback: () => void,
  options: { timeout?: number } = {}
): number {
  if (hasIdleCallback) {
    return window.requestIdleCallback(
      () => callback(),
      options.timeout ? { timeout: options.timeout } : undefined
    );
  }
  // Fallback for browsers without requestIdleCallback (Safari)
  return setTimeout(callback, 1) as unknown as number;
}

/**
 * Cancel a scheduled idle task.
 */
export function cancelIdleTask(handle: number): void {
  if (hasIdleCallback) {
    window.cancelIdleCallback(handle);
  } else {
    clearTimeout(handle);
  }
}

/**
 * Queue of deferred tasks that will be processed during idle periods.
 * Useful for batching multiple low-priority operations.
 */
class IdleTaskQueue {
  private queue: Array<() => void> = [];
  private isProcessing = false;
  private handle: number | null = null;

  /**
   * Add a task to the queue. Tasks are processed in order during idle periods.
   */
  enqueue(task: () => void): void {
    this.queue.push(task);
    this.scheduleProcessing();
  }

  /**
   * Process tasks from the queue during idle time.
   */
  private scheduleProcessing(): void {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;
    this.handle = scheduleIdleTask(() => {
      this.processQueue();
    }, { timeout: 1000 }); // Max 1 second wait
  }

  private processQueue(): void {
    const startTime = performance.now();
    const maxProcessTime = 5; // Max 5ms per idle callback

    while (this.queue.length > 0) {
      const elapsed = performance.now() - startTime;
      if (elapsed > maxProcessTime) {
        // Yield to main thread, schedule continuation
        this.isProcessing = false;
        this.scheduleProcessing();
        return;
      }

      const task = this.queue.shift();
      if (task) {
        try {
          task();
        } catch (error) {
          console.error('[IdleTaskQueue] Task failed:', error);
        }
      }
    }

    this.isProcessing = false;
    this.handle = null;
  }

  /**
   * Clear all pending tasks.
   */
  clear(): void {
    this.queue = [];
    if (this.handle !== null) {
      cancelIdleTask(this.handle);
      this.handle = null;
    }
    this.isProcessing = false;
  }

  /**
   * Get the number of pending tasks.
   */
  get size(): number {
    return this.queue.length;
  }
}

// Singleton instance for app-wide use
export const idleTaskQueue = new IdleTaskQueue();

/**
 * Defer a non-critical operation to run during idle time.
 * Convenience wrapper around idleTaskQueue.enqueue.
 *
 * Use this for:
 * - Analytics tracking
 * - Checkpoint saves
 * - Non-urgent state updates
 * - Telemetry
 */
export function deferTask(task: () => void): void {
  idleTaskQueue.enqueue(task);
}

/**
 * Execute a task immediately if we have idle time, otherwise defer it.
 * Checks if we have at least `minTime` ms of idle time available.
 */
export function executeOrDefer(task: () => void, minTime = 2): void {
  // Simple heuristic: if requestAnimationFrame callback takes less than 16ms,
  // we probably have time. Otherwise, defer.
  const start = performance.now();

  // Use a microtask to check timing
  queueMicrotask(() => {
    const elapsed = performance.now() - start;
    if (elapsed < minTime) {
      task();
    } else {
      deferTask(task);
    }
  });
}
