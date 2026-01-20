import { Container, Graphics } from 'pixi.js';
import type { ParallaxConfig } from '../scenes/environment/ThemeManager.js';

interface Star {
  x: number;
  y: number;
  size: number;
  baseAlpha: number;
  twinkleSpeed: number;
  twinklePhase: number;
}

interface Cloud {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  alpha: number;
  baseSpeed: number; // Store original speed for theme changes
}

// Default colors (used before theme is set)
const DEFAULT_COLORS = {
  stars: 0xffffff,
  clouds: 0x15152a,
};

/**
 * ParallaxBackground - Animated multi-layer background system.
 * Includes twinkling stars and drifting clouds.
 * Supports theme-based color and density changes.
 */
export class ParallaxBackground {
  public container: Container;

  // Layers (back to front)
  private starsLayer: Graphics;
  private cloudsLayer: Graphics;

  // Animated elements
  private stars: Star[] = [];
  private clouds: Cloud[] = [];

  // Dimensions
  private width: number = 0;
  private height: number = 0;

  // Animation time
  private time: number = 0;

  // Settings
  private enabled: boolean = true;
  private starCount: number = 100;
  private cloudCount: number = 8;

  // Theme colors
  private starColor: number = DEFAULT_COLORS.stars;
  private cloudColor: number = DEFAULT_COLORS.clouds;
  private cloudSpeedMultiplier: number = 1.0;

  constructor() {
    this.container = new Container();

    // Create layers (order matters for depth)
    this.starsLayer = new Graphics();
    this.cloudsLayer = new Graphics();

    this.container.addChild(this.starsLayer);
    this.container.addChild(this.cloudsLayer);
  }

  /**
   * Set theme configuration for parallax colors and density.
   * Call this when pillar/sector changes.
   */
  public setTheme(config: ParallaxConfig): void {
    const needsRegenerate =
      config.starCount !== this.starCount ||
      config.cloudCount !== this.cloudCount;

    this.starColor = config.starColor;
    this.cloudColor = config.cloudColor;
    this.starCount = config.starCount;
    this.cloudCount = config.cloudCount;
    this.cloudSpeedMultiplier = config.cloudSpeed;

    // Update existing cloud speeds
    for (const cloud of this.clouds) {
      cloud.speed = cloud.baseSpeed * this.cloudSpeedMultiplier;
    }

    // Regenerate if counts changed
    if (needsRegenerate && this.width > 0 && this.height > 0) {
      this.regenerateElements();
    }
  }

  /**
   * Regenerate stars and clouds without full reinitialization.
   */
  private regenerateElements(): void {
    // Regenerate stars
    this.stars = [];
    for (let i = 0; i < this.starCount; i++) {
      this.stars.push(this.createStar(i));
    }

    // Regenerate clouds
    this.clouds = [];
    for (let i = 0; i < this.cloudCount; i++) {
      this.clouds.push(this.createCloud(i));
    }
  }

  /**
   * Enable/disable parallax effects
   */
  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
    this.container.visible = enabled;
  }

  /**
   * Set quality level - affects particle count
   */
  public setQuality(quality: 'low' | 'medium' | 'high') {
    switch (quality) {
      case 'low':
        this.starCount = 50;
        this.cloudCount = 4;
        break;
      case 'medium':
        this.starCount = 80;
        this.cloudCount = 6;
        break;
      case 'high':
        this.starCount = 120;
        this.cloudCount = 10;
        break;
    }

    // Regenerate elements if already initialized
    if (this.width > 0 && this.height > 0) {
      this.initialize(this.width, this.height);
    }
  }

  /**
   * Initialize/reinitialize with dimensions
   */
  public initialize(width: number, height: number) {
    this.width = width;
    this.height = height;

    // Recreate Graphics objects to ensure valid context after resize
    this.starsLayer.destroy();
    this.cloudsLayer.destroy();

    this.starsLayer = new Graphics();
    this.cloudsLayer = new Graphics();

    // Re-add to container in correct order
    this.container.removeChildren();
    this.container.addChild(this.starsLayer);
    this.container.addChild(this.cloudsLayer);

    // Generate stars
    this.stars = [];
    for (let i = 0; i < this.starCount; i++) {
      this.stars.push(this.createStar(i));
    }

    // Generate clouds
    this.clouds = [];
    for (let i = 0; i < this.cloudCount; i++) {
      this.clouds.push(this.createCloud(i));
    }

    // Draw initial state
    this.draw();
  }

  /**
   * Create a star with deterministic but varied properties
   */
  private createStar(index: number): Star {
    const seedX = ((index * 7919) % 1000) / 1000;
    const seedY = ((index * 6271) % 1000) / 1000;
    const seedSize = ((index * 3571) % 100) / 100;
    const seedAlpha = ((index * 2341) % 100) / 100;
    const seedTwinkle = ((index * 1847) % 100) / 100;

    return {
      x: seedX * this.width,
      y: seedY * this.height * 0.65, // Stars only in upper portion
      size: 0.5 + seedSize * 1.8,
      baseAlpha: 0.3 + seedAlpha * 0.7,
      twinkleSpeed: 1 + seedTwinkle * 3,
      twinklePhase: seedTwinkle * Math.PI * 2,
    };
  }

  /**
   * Create a cloud with varied properties
   */
  private createCloud(index: number): Cloud {
    const seedX = ((index * 4523) % 1000) / 1000;
    const seedY = ((index * 8761) % 1000) / 1000;
    const seedWidth = ((index * 3217) % 100) / 100;
    const seedSpeed = ((index * 5647) % 100) / 100;

    const baseSpeed = 3 + seedSpeed * 7; // Base pixels per second
    return {
      x: seedX * this.width,
      y: this.height * 0.05 + seedY * this.height * 0.45,
      width: 100 + seedWidth * 200,
      height: 15 + seedWidth * 15,
      baseSpeed,
      speed: baseSpeed * this.cloudSpeedMultiplier, // Apply theme multiplier
      alpha: 0.08 + seedSpeed * 0.12,
    };
  }

  /**
   * Update parallax animation
   */
  public update(deltaMS: number) {
    if (!this.enabled || this.width === 0) return;

    const dt = deltaMS / 1000;
    this.time += dt;

    // Update star twinkle
    for (const star of this.stars) {
      star.twinklePhase += star.twinkleSpeed * dt;
    }

    // Update cloud positions (drift to the right)
    for (const cloud of this.clouds) {
      cloud.x += cloud.speed * dt;

      // Wrap around
      if (cloud.x > this.width + cloud.width / 2) {
        cloud.x = -cloud.width / 2;
      }
    }

    // Redraw
    this.draw();
  }

  /**
   * Draw all parallax layers
   */
  private draw() {
    this.drawStars();
    this.drawClouds();
  }

  /**
   * Draw twinkling stars
   */
  private drawStars() {
    // Safety check: ensure Graphics object has valid context
    if (!this.starsLayer || this.starsLayer.destroyed) {
      return;
    }

    try {
      this.starsLayer.clear();

      for (const star of this.stars) {
        // Calculate twinkle
        const twinkle = Math.sin(star.twinklePhase) * 0.3 + 0.7;
        const alpha = star.baseAlpha * twinkle;

        // Main star (uses theme color)
        this.starsLayer.circle(star.x, star.y, star.size).fill({
          color: this.starColor,
          alpha,
        });

        // Larger stars get a subtle glow
        if (star.size > 1.5) {
          this.starsLayer.circle(star.x, star.y, star.size * 2).fill({
            color: this.starColor,
            alpha: alpha * 0.2,
          });
        }
      }
    } catch (e) {
      // Silently fail if context is invalid
      console.warn('Failed to draw stars:', e);
    }
  }

  /**
   * Draw drifting clouds
   */
  private drawClouds() {
    // Safety check: ensure Graphics object has valid context
    if (!this.cloudsLayer || this.cloudsLayer.destroyed) {
      return;
    }

    try {
      this.cloudsLayer.clear();

      for (const cloud of this.clouds) {
        // Main cloud body (uses theme color)
        this.cloudsLayer.ellipse(cloud.x, cloud.y, cloud.width, cloud.height).fill({
          color: this.cloudColor,
          alpha: cloud.alpha,
        });

        // Secondary wisps
        this.cloudsLayer
          .ellipse(
            cloud.x - cloud.width * 0.3,
            cloud.y - cloud.height * 0.3,
            cloud.width * 0.5,
            cloud.height * 0.7
          )
          .fill({
            color: this.cloudColor,
            alpha: cloud.alpha * 0.6,
          });

        this.cloudsLayer
          .ellipse(
            cloud.x + cloud.width * 0.4,
            cloud.y + cloud.height * 0.2,
            cloud.width * 0.4,
            cloud.height * 0.6
          )
          .fill({
            color: this.cloudColor,
            alpha: cloud.alpha * 0.5,
          });
      }
    } catch (e) {
      // Silently fail if context is invalid
      console.warn('Failed to draw clouds:', e);
    }
  }

  /**
   * Get current element counts (for debugging)
   */
  public getStats(): { stars: number; clouds: number } {
    return {
      stars: this.stars.length,
      clouds: this.clouds.length,
    };
  }

  /**
   * Destroy and cleanup
   */
  public destroy() {
    this.stars = [];
    this.clouds = [];
    this.starsLayer.destroy();
    this.cloudsLayer.destroy();
    this.container.destroy({ children: true });
  }
}

// Export singleton instance
export const parallaxBackground = new ParallaxBackground();
