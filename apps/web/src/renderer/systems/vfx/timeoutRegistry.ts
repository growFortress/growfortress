/**
 * TimeoutRegistry - Tracks and manages setTimeout calls for VFX system.
 *
 * Problem: VFX effects use setTimeout for staggered particle spawning,
 * but these timers are never cancelled when the game ends or transitions
 * to hub mode. This causes memory leaks as closures retain references
 * to VFXSystem and continue spawning particles after cleanup.
 *
 * Solution: All setTimeout calls in VFX go through this registry,
 * which tracks timer IDs and can cancel them all on cleanup.
 */
export class TimeoutRegistry {
  private pendingTimeouts: Set<ReturnType<typeof setTimeout>> = new Set();

  /**
   * Schedule a callback with automatic tracking.
   * The timer ID is stored and will be cancelled on clearAll().
   */
  public setTimeout(callback: () => void, delayMs: number): ReturnType<typeof setTimeout> {
    const id = setTimeout(() => {
      this.pendingTimeouts.delete(id);
      callback();
    }, delayMs);
    this.pendingTimeouts.add(id);
    return id;
  }

  /**
   * Cancel a specific timeout.
   */
  public clearTimeout(id: ReturnType<typeof setTimeout>): void {
    clearTimeout(id);
    this.pendingTimeouts.delete(id);
  }

  /**
   * Cancel all pending timeouts.
   * Called when transitioning to hub mode or destroying VFX system.
   */
  public clearAll(): void {
    for (const id of this.pendingTimeouts) {
      clearTimeout(id);
    }
    this.pendingTimeouts.clear();
  }

  /**
   * Get count of pending timeouts (for debugging).
   */
  public get pendingCount(): number {
    return this.pendingTimeouts.size;
  }
}
