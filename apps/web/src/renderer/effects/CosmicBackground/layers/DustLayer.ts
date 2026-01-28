/**
 * DustLayer - Space dust particles that drift across the screen
 * Lightweight particle system with wrap-around movement
 */

import { Graphics } from 'pixi.js';
import type { DustConfig, DustParticle, QualityLevel } from '../types.js';
import { QUALITY_MULTIPLIERS } from '../types.js';

export class DustLayer {
  private graphics: Graphics;
  private particles: DustParticle[] = [];
  private config: DustConfig;
  private quality: QualityLevel;
  private width: number = 0;
  private height: number = 0;

  constructor(config: DustConfig, quality: QualityLevel) {
    this.graphics = new Graphics();
    this.config = config;
    this.quality = quality;
  }

  public getGraphics(): Graphics {
    return this.graphics;
  }

  public setConfig(config: DustConfig): void {
    this.config = config;
  }

  public setQuality(quality: QualityLevel): void {
    this.quality = quality;
  }

  public initialize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.generateParticles();
  }

  private generateParticles(): void {
    const multiplier = QUALITY_MULTIPLIERS[this.quality].dustCount;
    const count = Math.floor(this.config.count * multiplier);
    this.particles = [];

    const [minSize, maxSize] = this.config.sizeRange;
    const sizeRange = maxSize - minSize;

    for (let i = 0; i < count; i++) {
      // Deterministic initial placement
      const seedX = ((i * 7331) % 10000) / 10000;
      const seedY = ((i * 9127) % 10000) / 10000;
      const seedSize = ((i * 4729) % 1000) / 1000;
      const seedSpeed = ((i * 3583) % 1000) / 1000;
      const seedAlpha = ((i * 6197) % 1000) / 1000;

      this.particles.push({
        x: seedX * this.width,
        y: seedY * this.height,
        size: minSize + seedSize * sizeRange,
        alpha: this.config.alpha * (0.5 + seedAlpha * 0.5),
        speed: this.config.speed * (0.6 + seedSpeed * 0.8),
      });
    }
  }

  public update(deltaMS: number): void {
    if (this.particles.length === 0 || this.width === 0) {
      this.graphics.clear();
      return;
    }

    const dt = deltaMS / 1000;
    this.graphics.clear();

    // Pre-calculate direction components
    const dirX = Math.cos(this.config.direction);
    const dirY = Math.sin(this.config.direction);

    // Padding for smooth wrap-around
    const padding = 20;

    for (const particle of this.particles) {
      // Update position
      particle.x += dirX * particle.speed * dt;
      particle.y += dirY * particle.speed * dt;

      // Wrap around screen edges
      if (particle.x < -padding) {
        particle.x = this.width + padding;
      } else if (particle.x > this.width + padding) {
        particle.x = -padding;
      }

      if (particle.y < -padding) {
        particle.y = this.height + padding;
      } else if (particle.y > this.height + padding) {
        particle.y = -padding;
      }

      // Draw particle
      this.graphics.circle(particle.x, particle.y, particle.size).fill({
        color: this.config.color,
        alpha: particle.alpha,
      });

      // Add subtle glow for larger particles
      if (particle.size > 2) {
        this.graphics.circle(particle.x, particle.y, particle.size * 1.8).fill({
          color: this.config.color,
          alpha: particle.alpha * 0.25,
        });
      }
    }
  }

  public getParticleCount(): number {
    return this.particles.length;
  }

  public destroy(): void {
    this.particles = [];
    this.graphics.destroy();
  }
}
