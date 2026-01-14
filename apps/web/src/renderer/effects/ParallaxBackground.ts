import { Container, Graphics } from 'pixi.js';

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
}

interface DustParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
}

const COLORS = {
  sky: {
    top: 0x050510,
    bottom: 0x0a0a18,
  },
  stars: 0xffffff,
  clouds: 0x15152a,
  dust: 0x404060,
};

/**
 * ParallaxBackground - Animated multi-layer background system.
 * Includes twinkling stars, drifting clouds, and floating dust particles.
 */
export class ParallaxBackground {
  public container: Container;

  // Layers (back to front)
  private starsLayer: Graphics;
  private cloudsLayer: Graphics;
  private dustLayer: Graphics;

  // Animated elements
  private stars: Star[] = [];
  private clouds: Cloud[] = [];
  private dustParticles: DustParticle[] = [];

  // Dimensions
  private width: number = 0;
  private height: number = 0;

  // Animation time
  private time: number = 0;

  // Settings
  private enabled: boolean = true;
  private starCount: number = 100;
  private cloudCount: number = 8;
  private maxDustParticles: number = 30;

  constructor() {
    this.container = new Container();

    // Create layers (order matters for depth)
    this.starsLayer = new Graphics();
    this.cloudsLayer = new Graphics();
    this.dustLayer = new Graphics();

    this.container.addChild(this.starsLayer);
    this.container.addChild(this.cloudsLayer);
    this.container.addChild(this.dustLayer);
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
        this.maxDustParticles = 10;
        break;
      case 'medium':
        this.starCount = 80;
        this.cloudCount = 6;
        this.maxDustParticles = 20;
        break;
      case 'high':
        this.starCount = 120;
        this.cloudCount = 10;
        this.maxDustParticles = 40;
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

    // Initialize dust particles (will be spawned dynamically)
    this.dustParticles = [];

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

    return {
      x: seedX * this.width,
      y: this.height * 0.05 + seedY * this.height * 0.45,
      width: 100 + seedWidth * 200,
      height: 15 + seedWidth * 15,
      speed: 3 + seedSpeed * 7, // pixels per second
      alpha: 0.08 + seedSpeed * 0.12,
    };
  }

  /**
   * Spawn a dust particle
   */
  private spawnDustParticle(): DustParticle {
    const side = Math.random() > 0.5;
    return {
      x: side ? -10 : this.width + 10,
      y: this.height * 0.3 + Math.random() * this.height * 0.4,
      vx: (side ? 1 : -1) * (10 + Math.random() * 20),
      vy: -5 + Math.random() * 10,
      size: 1 + Math.random() * 2,
      alpha: 0.1 + Math.random() * 0.2,
      life: 5 + Math.random() * 5,
      maxLife: 10,
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

    // Spawn new dust particles occasionally
    if (this.dustParticles.length < this.maxDustParticles && Math.random() < dt * 0.5) {
      this.dustParticles.push(this.spawnDustParticle());
    }

    // Update dust particles
    for (let i = this.dustParticles.length - 1; i >= 0; i--) {
      const dust = this.dustParticles[i];
      dust.x += dust.vx * dt;
      dust.y += dust.vy * dt;
      dust.life -= dt;

      // Fade out
      const lifeRatio = dust.life / dust.maxLife;
      dust.alpha = Math.min(0.3, lifeRatio * 0.3);

      // Remove dead particles
      if (dust.life <= 0 || dust.x < -20 || dust.x > this.width + 20) {
        this.dustParticles.splice(i, 1);
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
    this.drawDust();
  }

  /**
   * Draw twinkling stars
   */
  private drawStars() {
    this.starsLayer.clear();

    for (const star of this.stars) {
      // Calculate twinkle
      const twinkle = Math.sin(star.twinklePhase) * 0.3 + 0.7;
      const alpha = star.baseAlpha * twinkle;

      // Main star
      this.starsLayer.circle(star.x, star.y, star.size).fill({
        color: COLORS.stars,
        alpha,
      });

      // Larger stars get a subtle glow
      if (star.size > 1.5) {
        this.starsLayer.circle(star.x, star.y, star.size * 2).fill({
          color: COLORS.stars,
          alpha: alpha * 0.2,
        });
      }
    }
  }

  /**
   * Draw drifting clouds
   */
  private drawClouds() {
    this.cloudsLayer.clear();

    for (const cloud of this.clouds) {
      // Main cloud body
      this.cloudsLayer.ellipse(cloud.x, cloud.y, cloud.width, cloud.height).fill({
        color: COLORS.clouds,
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
          color: COLORS.clouds,
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
          color: COLORS.clouds,
          alpha: cloud.alpha * 0.5,
        });
    }
  }

  /**
   * Draw floating dust particles
   */
  private drawDust() {
    this.dustLayer.clear();

    for (const dust of this.dustParticles) {
      this.dustLayer.circle(dust.x, dust.y, dust.size).fill({
        color: COLORS.dust,
        alpha: dust.alpha,
      });
    }
  }

  /**
   * Get current element counts (for debugging)
   */
  public getStats(): { stars: number; clouds: number; dust: number } {
    return {
      stars: this.stars.length,
      clouds: this.clouds.length,
      dust: this.dustParticles.length,
    };
  }

  /**
   * Destroy and cleanup
   */
  public destroy() {
    this.stars = [];
    this.clouds = [];
    this.dustParticles = [];
    this.starsLayer.destroy();
    this.cloudsLayer.destroy();
    this.dustLayer.destroy();
    this.container.destroy({ children: true });
  }
}

// Export singleton instance
export const parallaxBackground = new ParallaxBackground();
