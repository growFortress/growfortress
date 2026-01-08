/**
 * Xorshift32 - Deterministic 32-bit PRNG
 * Same implementation on client and server ensures identical random sequences.
 */
export class Xorshift32 {
  private state: number;

  constructor(seed: number) {
    // Ensure non-zero state (xorshift produces 0 forever if state is 0)
    this.state = (seed >>> 0) || 1;
  }

  /**
   * Generate next 32-bit unsigned integer
   */
  next(): number {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state;
  }

  /**
   * Generate float in range [0, 1)
   */
  nextFloat(): number {
    return this.next() / 0x100000000;
  }

  /**
   * Generate integer in range [min, max] (inclusive)
   */
  nextInt(min: number, max: number): number {
    const range = max - min + 1;
    return min + (this.next() % range);
  }

  /**
   * Generate boolean with given probability (default 0.5)
   */
  nextBool(probability = 0.5): boolean {
    return this.nextFloat() < probability;
  }

  /**
   * Shuffle array in place using Fisher-Yates
   */
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * Pick random element from array
   */
  pick<T>(array: T[]): T {
    return array[this.nextInt(0, array.length - 1)];
  }

  /**
   * Pick N unique random elements from array
   */
  pickN<T>(array: T[], n: number): T[] {
    const copy = [...array];
    this.shuffle(copy);
    return copy.slice(0, Math.min(n, copy.length));
  }

  /**
   * Get current RNG state (for checkpointing)
   */
  getState(): number {
    return this.state;
  }

  /**
   * Set RNG state (for restoring from checkpoint)
   */
  setState(state: number): void {
    this.state = state >>> 0 || 1;
  }

  /**
   * Clone RNG with same state
   */
  clone(): Xorshift32 {
    const rng = new Xorshift32(1);
    rng.state = this.state;
    return rng;
  }
}
