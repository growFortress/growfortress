/**
 * GradientLayer - Animated deep space gradient background
 * Renders a smooth vertical gradient with subtle noise-based color variation
 */

import { Graphics } from 'pixi.js';
import type { GradientConfig } from '../types.js';
import { SimplexNoise } from '../utils/SimplexNoise.js';

export class GradientLayer {
  private graphics: Graphics;
  private noise: SimplexNoise;
  private time: number = 0;
  private config: GradientConfig;

  constructor(config: GradientConfig) {
    this.graphics = new Graphics();
    this.noise = new SimplexNoise(12345);
    this.config = config;
  }

  public getGraphics(): Graphics {
    return this.graphics;
  }

  public setConfig(config: GradientConfig): void {
    this.config = config;
  }

  public update(deltaMS: number, width: number, height: number): void {
    if (width === 0 || height === 0) return;

    this.time += (deltaMS / 1000) * this.config.shiftSpeed;
    this.graphics.clear();

    // Draw gradient with vertical stripes for smooth interpolation
    const steps = 24;
    const stepHeight = Math.ceil(height / steps) + 1;

    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const y = Math.floor(height * t);

      // Base color interpolation
      let color = this.lerpColor(this.config.topColor, this.config.bottomColor, t);

      // Add subtle noise variation
      if (this.config.noiseIntensity > 0) {
        const noiseVal = this.noise.noise2D(t * 3, this.time * 0.5);
        color = this.adjustBrightness(color, noiseVal * this.config.noiseIntensity);
      }

      this.graphics.rect(0, y, width, stepHeight).fill({ color });
    }
  }

  /**
   * Linear interpolation between two colors
   */
  private lerpColor(colorA: number, colorB: number, t: number): number {
    const rA = (colorA >> 16) & 0xff;
    const gA = (colorA >> 8) & 0xff;
    const bA = colorA & 0xff;

    const rB = (colorB >> 16) & 0xff;
    const gB = (colorB >> 8) & 0xff;
    const bB = colorB & 0xff;

    const r = Math.round(rA + (rB - rA) * t);
    const g = Math.round(gA + (gB - gA) * t);
    const b = Math.round(bA + (bB - bA) * t);

    return (r << 16) | (g << 8) | b;
  }

  /**
   * Adjust brightness of a color by a factor (-1 to 1)
   */
  private adjustBrightness(color: number, factor: number): number {
    const r = Math.max(0, Math.min(255, ((color >> 16) & 0xff) + factor * 30));
    const g = Math.max(0, Math.min(255, ((color >> 8) & 0xff) + factor * 30));
    const b = Math.max(0, Math.min(255, (color & 0xff) + factor * 30));

    return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
  }

  public destroy(): void {
    this.graphics.destroy();
  }
}
