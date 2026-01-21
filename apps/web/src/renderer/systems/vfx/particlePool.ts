import type { Particle } from './types.js';

/**
 * Object pool for particles to reduce GC pressure.
 * Pre-allocates particles and reuses them when possible.
 */
export class ParticlePool {
  private available: Particle[] = [];
  private maxSize: number;

  constructor(maxSize: number = 2000) {
    this.maxSize = maxSize;
    // Pre-allocate some particles
    for (let i = 0; i < 200; i++) {
      this.available.push(this.createParticle());
    }
  }

  private createParticle(): Particle {
    return {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1,
      size: 1,
      color: 0xffffff,
    };
  }

  acquire(): Particle {
    if (this.available.length > 0) {
      return this.available.pop()!;
    }
    return this.createParticle();
  }

  release(particle: Particle): void {
    if (this.available.length < this.maxSize) {
      // Reset particle to default state
      particle.shape = undefined;
      particle.rotation = undefined;
      particle.rotationSpeed = undefined;
      particle.gravity = undefined;
      particle.startSize = undefined;
      particle.endSize = undefined;
      particle.alpha = undefined;
      particle.startAlpha = undefined;
      particle.endAlpha = undefined;
      particle.drag = undefined;
      particle.scaleX = undefined;
      particle.scaleY = undefined;
      particle.stage = undefined;
      particle.spawnSecondary = undefined;
      this.available.push(particle);
    }
  }

  /** Get current pool stats for debugging */
  getStats(): { available: number; maxSize: number } {
    return {
      available: this.available.length,
      maxSize: this.maxSize,
    };
  }

  /** Pre-warm the pool with more particles */
  prewarm(count: number): void {
    const toCreate = Math.min(count, this.maxSize - this.available.length);
    for (let i = 0; i < toCreate; i++) {
      this.available.push(this.createParticle());
    }
  }

  /** Clear all pooled particles */
  clear(): void {
    this.available.length = 0;
  }
}
