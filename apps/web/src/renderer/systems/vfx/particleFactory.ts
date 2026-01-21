import type { Particle, ParticleSpec, BurstConfig, FlashConfig, RingConfig, ClassColors } from './types.js';
import type { ParticlePool } from './particlePool.js';

/**
 * Factory for creating particles from specs.
 * Centralizes particle creation logic for consistency.
 */
export class ParticleFactory {
  constructor(
    private pool: ParticlePool,
    private particles: Particle[],
    private particleMultiplier: () => number
  ) {}

  /**
   * Create a single particle from a spec
   */
  createFromSpec(spec: ParticleSpec): Particle {
    const p = this.pool.acquire();
    
    // Position with optional offset
    p.x = spec.x + (spec.offsetX ?? 0) + (Math.random() - 0.5) * (spec.offsetX ? 0 : 0);
    p.y = spec.y + (spec.offsetY ?? 0);
    
    // Velocity - either direct or from angle/speed
    if (spec.angle !== undefined && spec.speed !== undefined) {
      const angleVariance = spec.angleSpread ? (Math.random() - 0.5) * spec.angleSpread : 0;
      const finalAngle = spec.angle + angleVariance;
      p.vx = Math.cos(finalAngle) * spec.speed;
      p.vy = Math.sin(finalAngle) * spec.speed;
    } else {
      p.vx = spec.vx ?? 0;
      p.vy = spec.vy ?? 0;
    }
    
    // Lifecycle
    const lifeVariance = spec.lifeVariance ? Math.random() * spec.lifeVariance : 0;
    p.life = spec.life + lifeVariance;
    p.maxLife = p.life;
    
    // Size
    const sizeVariance = spec.sizeVariance ? Math.random() * spec.sizeVariance : 0;
    p.size = spec.size + sizeVariance;
    p.startSize = spec.startSize;
    p.endSize = spec.endSize;
    
    // Color - pick random from array if provided
    if (spec.colors && spec.colors.length > 0) {
      p.color = spec.colors[Math.floor(Math.random() * spec.colors.length)];
    } else {
      p.color = spec.color;
    }
    
    // Shape
    p.shape = spec.shape ?? 'circle';
    
    // Alpha
    p.alpha = spec.alpha;
    p.startAlpha = spec.startAlpha;
    p.endAlpha = spec.endAlpha;
    
    // Physics
    p.gravity = spec.gravity;
    p.drag = spec.drag;
    
    // Rotation
    p.rotation = spec.rotation;
    p.rotationSpeed = spec.rotationSpeed;
    
    // Advanced
    p.spawnSecondary = spec.spawnSecondary;
    
    return p;
  }

  /**
   * Emit multiple particles from a spec
   */
  emit(spec: ParticleSpec, count: number): void {
    const adjustedCount = Math.floor(count * this.particleMultiplier());
    for (let i = 0; i < adjustedCount; i++) {
      const p = this.createFromSpec(spec);
      this.particles.push(p);
    }
  }

  /**
   * Create a radial burst of particles
   */
  burst(config: BurstConfig): void {
    const count = Math.floor(config.count * this.particleMultiplier());
    
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const speedVariance = config.speedVariance ? Math.random() * config.speedVariance : 0;
      const speed = config.speed + speedVariance;
      
      const p = this.pool.acquire();
      p.x = config.x;
      p.y = config.y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      
      const lifeVariance = config.lifeVariance ? Math.random() * config.lifeVariance : 0;
      p.life = config.life + lifeVariance;
      p.maxLife = p.life;
      
      const sizeVariance = config.sizeVariance ? Math.random() * config.sizeVariance : 0;
      p.size = config.size + sizeVariance;
      
      p.color = config.colors[Math.floor(Math.random() * config.colors.length)];
      p.shape = config.shape ?? 'circle';
      p.gravity = config.gravity;
      p.drag = config.drag;
      p.startAlpha = config.startAlpha;
      p.endAlpha = config.endAlpha;
      
      this.particles.push(p);
    }
  }

  /**
   * Create a flash effect (expanding bright circle)
   */
  flash(config: FlashConfig): void {
    const life = config.life ?? 0.08;
    
    // White core flash
    const core = this.pool.acquire();
    core.x = config.x;
    core.y = config.y;
    core.vx = 0;
    core.vy = 0;
    core.life = life;
    core.maxLife = life;
    core.startSize = config.size * 0.5;
    core.endSize = config.size * 2;
    core.size = config.size;
    core.color = 0xffffff;
    core.startAlpha = 1;
    core.endAlpha = 0;
    core.shape = 'circle';
    this.particles.push(core);

    // Colored outer flash
    const outer = this.pool.acquire();
    outer.x = config.x;
    outer.y = config.y;
    outer.vx = 0;
    outer.vy = 0;
    outer.life = life * 1.5;
    outer.maxLife = outer.life;
    outer.startSize = config.size * 0.3;
    outer.endSize = config.size * 1.5;
    outer.size = config.size;
    outer.color = config.color;
    outer.startAlpha = 0.8;
    outer.endAlpha = 0;
    outer.shape = 'circle';
    this.particles.push(outer);
  }

  /**
   * Create an expanding ring (shockwave)
   */
  ring(config: RingConfig): void {
    const p = this.pool.acquire();
    p.x = config.x;
    p.y = config.y;
    p.vx = 0;
    p.vy = 0;
    p.life = config.life;
    p.maxLife = config.life;
    p.startSize = config.startSize;
    p.endSize = config.endSize;
    p.size = config.startSize;
    p.color = config.color;
    p.startAlpha = config.alpha ?? 0.6;
    p.endAlpha = 0;
    p.shape = 'ring';
    this.particles.push(p);
  }

  /**
   * Create dual rings (for shockwave with inner white ring)
   */
  shockwaveRings(x: number, y: number, color: number, intensity: number): void {
    for (let i = 0; i < 2; i++) {
      const p = this.pool.acquire();
      p.x = x;
      p.y = y;
      p.vx = 0;
      p.vy = 0;
      p.life = 0.25 + i * 0.1;
      p.maxLife = p.life;
      p.startSize = 10 * intensity;
      p.endSize = 80 * intensity;
      p.size = p.startSize;
      p.color = i === 0 ? color : 0xffffff;
      p.startAlpha = i === 0 ? 0.6 : 0.4;
      p.endAlpha = 0;
      p.shape = 'ring';
      this.particles.push(p);
    }
  }

  /**
   * Create smoke particles rising up
   */
  smoke(x: number, y: number, intensity: number): void {
    const count = Math.floor(8 * intensity * this.particleMultiplier());
    
    for (let i = 0; i < count; i++) {
      const p = this.pool.acquire();
      p.x = x + (Math.random() - 0.5) * 30;
      p.y = y + (Math.random() - 0.5) * 20;
      p.vx = (Math.random() - 0.5) * 20;
      p.vy = -30 - Math.random() * 40;
      p.life = 0.6 + Math.random() * 0.4;
      p.maxLife = p.life;
      p.startSize = 8 + Math.random() * 8;
      p.endSize = 20 + Math.random() * 15;
      p.size = p.startSize;
      p.color = 0x333333 + Math.floor(Math.random() * 0x333333);
      p.startAlpha = 0.4;
      p.endAlpha = 0;
      p.gravity = -20;
      p.drag = 0.98;
      p.shape = 'smoke';
      this.particles.push(p);
    }
  }

  /**
   * Create debris particles with class-specific shapes
   */
  debris(
    x: number,
    y: number,
    colors: ClassColors,
    intensity: number,
    shape: import('./types.js').ParticleShape,
    gravity: number
  ): void {
    const count = Math.floor(25 * intensity * this.particleMultiplier());
    
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const speed = (80 + Math.random() * 150) * intensity;
      const p = this.pool.acquire();
      
      p.x = x + (Math.random() - 0.5) * 10;
      p.y = y + (Math.random() - 0.5) * 10;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = 0.4 + Math.random() * 0.4;
      p.maxLife = p.life;
      p.size = (3 + Math.random() * 5) * intensity;
      
      // Random color from class palette
      const r = Math.random();
      p.color = r > 0.66 ? colors.glow : (r > 0.33 ? colors.primary : colors.secondary);
      
      p.gravity = gravity + Math.random() * 50;
      p.drag = 0.96;
      p.shape = shape;
      p.spawnSecondary = Math.random() > 0.6;
      
      if (shape === 'square' || shape === 'diamond') {
        p.rotation = Math.random() * Math.PI;
        p.rotationSpeed = (Math.random() - 0.5) * 8;
      }
      
      this.particles.push(p);
    }
  }

  /**
   * Spawn a secondary particle from parent (for trails)
   */
  spawnSecondary(parent: Particle): void {
    const p = this.pool.acquire();
    p.x = parent.x + (Math.random() - 0.5) * 5;
    p.y = parent.y + (Math.random() - 0.5) * 5;
    p.vx = parent.vx * 0.3 + (Math.random() - 0.5) * 30;
    p.vy = parent.vy * 0.3 + (Math.random() - 0.5) * 30;
    p.life = 0.2 + Math.random() * 0.2;
    p.maxLife = p.life;
    p.size = parent.size * 0.4;
    p.color = parent.color;
    p.shape = 'circle';
    p.gravity = 50;
    this.particles.push(p);
  }

  /**
   * Blend two colors by ratio
   */
  static blendColor(colorA: number, colorB: number, t: number): number {
    const ar = (colorA >> 16) & 0xff;
    const ag = (colorA >> 8) & 0xff;
    const ab = colorA & 0xff;
    const br = (colorB >> 16) & 0xff;
    const bg = (colorB >> 8) & 0xff;
    const bb = colorB & 0xff;
    const r = Math.round(ar + (br - ar) * t);
    const g = Math.round(ag + (bg - ag) * t);
    const b = Math.round(ab + (bb - ab) * t);
    return (r << 16) | (g << 8) | b;
  }
}
