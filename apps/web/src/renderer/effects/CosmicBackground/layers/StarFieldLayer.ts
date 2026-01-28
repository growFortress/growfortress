/**
 * StarFieldLayer - Dense star field with twinkle animation and shooting stars
 */

import { Graphics } from 'pixi.js';
import type { StarConfig, Star, ShootingStar, QualityLevel } from '../types.js';
import { QUALITY_MULTIPLIERS } from '../types.js';

export class StarFieldLayer {
  private graphics: Graphics;
  private stars: Star[] = [];
  private shootingStars: ShootingStar[] = [];
  private config: StarConfig;
  private quality: QualityLevel;
  private width: number = 0;
  private height: number = 0;

  constructor(config: StarConfig, quality: QualityLevel) {
    this.graphics = new Graphics();
    this.config = config;
    this.quality = quality;
  }

  public getGraphics(): Graphics {
    return this.graphics;
  }

  public setConfig(config: StarConfig): void {
    this.config = config;
  }

  public setQuality(quality: QualityLevel): void {
    this.quality = quality;
  }

  public initialize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.generateStars();
  }

  private generateStars(): void {
    const multiplier = QUALITY_MULTIPLIERS[this.quality].starCount;
    const count = Math.floor(this.config.count * multiplier);
    this.stars = [];

    for (let i = 0; i < count; i++) {
      // Deterministic placement using index-based seeding
      const seedX = ((i * 7919) % 10000) / 10000;
      const seedY = ((i * 6271) % 10000) / 10000;
      const seedSize = ((i * 3571) % 1000) / 1000;
      const seedAlpha = ((i * 2341) % 1000) / 1000;
      const seedTwinkle = ((i * 1847) % 1000) / 1000;
      const seedColor = ((i * 4253) % 1000) / 1000;

      // Determine if this is a bright constellation star
      const isBright = seedAlpha > (1 - this.config.constellationDensity);

      // Calculate size based on brightness
      const [minSize, maxSize] = this.config.sizeRange;
      const sizeRange = maxSize - minSize;
      const size = isBright
        ? maxSize * (0.8 + seedSize * 0.2)
        : minSize + seedSize * sizeRange * 0.7;

      // Calculate alpha
      const [minAlpha, maxAlpha] = this.config.brightnessRange;
      const alphaRange = maxAlpha - minAlpha;
      const baseAlpha = isBright
        ? maxAlpha * (0.85 + seedAlpha * 0.15)
        : minAlpha + seedAlpha * alphaRange;

      // Determine color
      const color =
        this.config.secondaryColor && seedColor > 0.7
          ? this.config.secondaryColor
          : this.config.color;

      this.stars.push({
        x: seedX * this.width,
        y: seedY * this.height * 0.85, // Stars mostly in upper 85%
        size,
        baseAlpha,
        twinkleSpeed: this.config.twinkleSpeed * (0.5 + seedTwinkle * 0.8),
        twinklePhase: seedTwinkle * Math.PI * 2,
        color,
        isBright,
      });
    }
  }

  public update(deltaMS: number): void {
    if (this.width === 0 || this.stars.length === 0) return;

    const dt = deltaMS / 1000;
    this.graphics.clear();

    // Update and draw stars
    for (const star of this.stars) {
      star.twinklePhase += star.twinkleSpeed * dt;

      // Calculate twinkle effect
      const twinkle = Math.sin(star.twinklePhase) * 0.35 + 0.65;
      const alpha = star.baseAlpha * twinkle;

      // Draw star body
      this.graphics.circle(star.x, star.y, star.size).fill({
        color: star.color,
        alpha,
      });

      // Add glow for bright stars
      if (star.isBright && star.size > 1.5) {
        this.graphics.circle(star.x, star.y, star.size * 2.5).fill({
          color: star.color,
          alpha: alpha * 0.15,
        });
        // Second glow layer for extra bright stars
        if (star.size > 2) {
          this.graphics.circle(star.x, star.y, star.size * 4).fill({
            color: star.color,
            alpha: alpha * 0.05,
          });
        }
      }
    }

    // Maybe spawn shooting star
    if (this.config.shootingStarChance > 0 && Math.random() < this.config.shootingStarChance) {
      this.spawnShootingStar();
    }

    // Update and draw shooting stars
    this.updateShootingStars(dt);
  }

  private spawnShootingStar(): void {
    // Angle between 15-75 degrees (downward diagonal)
    const angle = (Math.PI / 12) + Math.random() * (Math.PI / 3);
    const speed = 400 + Math.random() * 300;

    this.shootingStars.push({
      x: Math.random() * this.width * 0.8,
      y: Math.random() * this.height * 0.25,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      length: 40 + Math.random() * 60,
      life: 0.8 + Math.random() * 0.4,
      maxLife: 0.8 + Math.random() * 0.4,
      color: this.config.color,
    });
  }

  private updateShootingStars(dt: number): void {
    for (let i = this.shootingStars.length - 1; i >= 0; i--) {
      const star = this.shootingStars[i];

      // Update position
      star.x += star.vx * dt;
      star.y += star.vy * dt;
      star.life -= dt;

      // Remove dead stars
      if (star.life <= 0 || star.x > this.width || star.y > this.height) {
        this.shootingStars.splice(i, 1);
        continue;
      }

      // Calculate alpha based on life
      const lifeRatio = star.life / star.maxLife;
      const alpha = lifeRatio * 0.9;

      // Calculate trail direction
      const angle = Math.atan2(star.vy, star.vx);
      const tailX = star.x - Math.cos(angle) * star.length * lifeRatio;
      const tailY = star.y - Math.sin(angle) * star.length * lifeRatio;

      // Draw trail with gradient effect (multiple segments)
      const segments = 5;
      for (let s = 0; s < segments; s++) {
        const t = s / segments;
        const segX = tailX + (star.x - tailX) * t;
        const segY = tailY + (star.y - tailY) * t;
        const nextT = (s + 1) / segments;
        const nextX = tailX + (star.x - tailX) * nextT;
        const nextY = tailY + (star.y - tailY) * nextT;

        const segAlpha = alpha * t * 0.8;
        const width = 1 + t * 2;

        this.graphics
          .moveTo(segX, segY)
          .lineTo(nextX, nextY)
          .stroke({ color: star.color, alpha: segAlpha, width });
      }

      // Bright head
      this.graphics.circle(star.x, star.y, 2.5).fill({
        color: 0xffffff,
        alpha: alpha * 1.1,
      });

      // Head glow
      this.graphics.circle(star.x, star.y, 5).fill({
        color: star.color,
        alpha: alpha * 0.3,
      });
    }
  }

  public getStarCount(): number {
    return this.stars.length;
  }

  public destroy(): void {
    this.stars = [];
    this.shootingStars = [];
    this.graphics.destroy();
  }
}
