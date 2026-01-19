import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { FortressClass, EnemyType } from '@arcade/sim-core';
import { graphicsSettings } from '../../state/settings.signals.js';
import { filterManager } from '../effects/FilterManager';

type ParticleShape = 'circle' | 'square' | 'spark' | 'ring' | 'diamond' | 'star' | 'smoke' | 'confetti';

// Class-specific colors for VFX (7 classes)
const CLASS_VFX_COLORS: Record<FortressClass, { primary: number; secondary: number; glow: number }> = {
  natural: { primary: 0x228b22, secondary: 0x32cd32, glow: 0x44ff44 },
  ice: { primary: 0x00bfff, secondary: 0x87ceeb, glow: 0xadd8e6 },
  fire: { primary: 0xff4500, secondary: 0xff6600, glow: 0xffaa00 },
  lightning: { primary: 0x9932cc, secondary: 0xda70d6, glow: 0xffffff },
  tech: { primary: 0x00f0ff, secondary: 0x00ffff, glow: 0xffffff },
  void: { primary: 0x4b0082, secondary: 0x8b008b, glow: 0x9400d3 },
  plasma: { primary: 0x00ffff, secondary: 0xff00ff, glow: 0xffffff },
};

// Enemy category colors for death VFX
type EnemyCategory = 'streets' | 'science' | 'mutants' | 'cosmos' | 'magic' | 'gods' | 'default';

const ENEMY_DEATH_COLORS: Record<EnemyCategory, { primary: number; secondary: number; particles: ParticleShape }> = {
  streets: { primary: 0xcc0000, secondary: 0x880000, particles: 'circle' },      // Red blood
  science: { primary: 0x00aaff, secondary: 0xffff00, particles: 'spark' },       // Blue-yellow sparks
  mutants: { primary: 0x44ff44, secondary: 0x00aa00, particles: 'smoke' },       // Green toxic
  cosmos: { primary: 0xffffaa, secondary: 0xffd700, particles: 'star' },         // White-gold shimmer
  magic: { primary: 0x9933ff, secondary: 0xff33ff, particles: 'diamond' },       // Purple wisps
  gods: { primary: 0xffd700, secondary: 0xffaa00, particles: 'star' },           // Golden rays
  default: { primary: 0xff4444, secondary: 0xaa0000, particles: 'circle' },      // Default red
};

// Map enemy types to categories
function getEnemyCategory(enemyType?: EnemyType): EnemyCategory {
  if (!enemyType) return 'default';
  switch (enemyType) {
    case 'gangster': case 'thug': case 'mafia_boss':
      return 'streets';
    case 'robot': case 'drone': case 'ai_core':
      return 'science';
    case 'sentinel': case 'mutant_hunter':
      return 'mutants';
    case 'kree_soldier': case 'skrull': case 'cosmic_beast':
      return 'cosmos';
    case 'demon': case 'sorcerer': case 'dimensional_being':
      return 'magic';
    case 'einherjar': case 'titan': case 'god':
      return 'gods';
    default:
      return 'default';
  }
}

export interface FloatingText {
  text: Text;
  life: number;
  maxLife: number;
  vy: number;
}


interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: number;
  shape?: ParticleShape;
  rotation?: number;
  rotationSpeed?: number;
  gravity?: number;
  // Enhanced properties
  startSize?: number;
  endSize?: number;
  alpha?: number;
  startAlpha?: number;
  endAlpha?: number;
  drag?: number;
  scaleX?: number;
  scaleY?: number;
  // For staged effects
  stage?: number;
  spawnSecondary?: boolean;
}

// Screen shake callback type
type ScreenShakeCallback = (intensity: number, duration: number) => void;

// Particle pool for performance
class ParticlePool {
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
      x: 0, y: 0, vx: 0, vy: 0,
      life: 0, maxLife: 1, size: 1, color: 0xffffff,
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
      // Reset particle
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
}

// Callback type for lighting system integration
type LightingCallback = (x: number, y: number, color: number, radius: number) => void;

export class VFXSystem {
  public container: Container;
  private particles: Particle[] = [];
  private floatingTexts: FloatingText[] = [];
  private graphics: Graphics;
  private pool: ParticlePool;
  private screenShakeCallback: ScreenShakeCallback | null = null;
  private lightingCallback: LightingCallback | null = null;

  // Staged effects queue
  private stagedEffects: Array<{
    x: number;
    y: number;
    fortressClass: FortressClass;
    intensity: number;
    elapsed: number;
    stages: number[];
  }> = [];

  constructor() {
    this.container = new Container();
    this.graphics = new Graphics();
    this.container.addChild(this.graphics);
    this.pool = new ParticlePool(2000);
  }

  // --- SETTINGS INTEGRATION ---
  private get particleMultiplier(): number {
    const { particles, quality } = graphicsSettings.value;
    
    // Combine explicit particle setting with quality preset fallbacks if needed
    // (Current implementation uses explicit multiplier, but we could add logic here)
    if (quality === 'low') return Math.min(particles, 0.5);
    
    return particles;
  }




  public setScreenShakeCallback(callback: ScreenShakeCallback) {
    this.screenShakeCallback = callback;
  }

  public setLightingCallback(callback: LightingCallback) {
    this.lightingCallback = callback;
  }

  private triggerScreenShake(intensity: number, duration: number) {
    if (this.screenShakeCallback) {
      this.screenShakeCallback(intensity, duration);
    }
  }

  private triggerLightingFlash(x: number, y: number, color: number, radius: number = 80) {
    if (this.lightingCallback) {
      this.lightingCallback(x, y, color, radius);
    }
  }

  public update(delta: number) {
    const dt = delta / 1000; // Convert to seconds

    // Update staged effects
    this.updateStagedEffects(dt);

    // Update Floating Texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= dt;
      
      // Move up
      ft.text.y += ft.vy * dt;
      // Fade out
      ft.text.alpha = Math.max(0, ft.life / ft.maxLife);

      if (ft.life <= 0) {
        this.container.removeChild(ft.text);
        ft.text.destroy();
        this.floatingTexts.splice(i, 1);
      }
    }

    // Update particles using swap-and-pop for performance
    let i = this.particles.length;
    while (i--) {
      const p = this.particles[i];
      p.life -= dt;

      if (p.life <= 0) {
        // Swap with last and pop
        this.pool.release(p);
        this.particles[i] = this.particles[this.particles.length - 1];
        this.particles.pop();
        continue;
      }

      // Apply velocity
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Apply gravity if specified
      if (p.gravity) {
        p.vy += p.gravity * dt;
      }

      // Apply rotation if specified
      // For confetti: chaotic rotation
      if (p.shape === 'confetti') {
        p.rotation = (p.rotation || 0) + (p.rotationSpeed || 5) * dt;
        p.scaleX = Math.cos(p.rotation); // Flip effect
      } else if (p.rotation !== undefined && p.rotationSpeed) {
        p.rotation += p.rotationSpeed * dt;
      }

      // Apply drag (air resistance)
      const drag = p.drag ?? 0.95;
      p.vx *= drag;
      p.vy *= drag;

      // Spawn secondary particles if flagged
      if (p.spawnSecondary && p.life < p.maxLife * 0.7 && Math.random() < 0.1) {
        this.spawnSecondaryParticle(p);
        p.spawnSecondary = false;
      }
    }

    // Redraw particles
    this.drawParticles();
  }

  private updateStagedEffects(dt: number) {
    for (let i = this.stagedEffects.length - 1; i >= 0; i--) {
      const effect = this.stagedEffects[i];
      effect.elapsed += dt * 1000; // Convert to ms

      const colors = CLASS_VFX_COLORS[effect.fortressClass];

      // Stage 1: Flash (0-50ms)
      if (!effect.stages.includes(1) && effect.elapsed >= 0) {
        effect.stages.push(1);
        this.spawnFlash(effect.x, effect.y, colors.glow, 25 * effect.intensity);
      }

      // Stage 2: Shockwave (0-50ms)
      if (!effect.stages.includes(2) && effect.elapsed >= 0) {
        effect.stages.push(2);
        this.spawnShockwaveRing(effect.x, effect.y, colors.secondary, effect.intensity);
      }

      // Stage 3: Primary debris (0ms)
      if (!effect.stages.includes(3) && effect.elapsed >= 0) {
        effect.stages.push(3);
        this.spawnDebris(effect.x, effect.y, colors, effect.intensity, effect.fortressClass);
      }

      // Stage 4: Secondary particles (100ms)
      if (!effect.stages.includes(4) && effect.elapsed >= 100) {
        effect.stages.push(4);
        this.spawnSecondaryBurst(effect.x, effect.y, colors, effect.intensity);
      }

      // Stage 5: Smoke (200ms)
      if (!effect.stages.includes(5) && effect.elapsed >= 200) {
        effect.stages.push(5);
        this.spawnSmoke(effect.x, effect.y, effect.intensity);
      }

      // Remove completed effects
      if (effect.elapsed >= 800) {
        this.stagedEffects.splice(i, 1);
      }
    }
  }

  private spawnSecondaryParticle(parent: Particle) {
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

  private drawParticles() {
    const g = this.graphics;
    g.clear();

    for (const p of this.particles) {
      const lifeRatio = p.life / p.maxLife;

      // Calculate alpha
      let alpha: number;
      if (p.startAlpha !== undefined && p.endAlpha !== undefined) {
        alpha = p.startAlpha + (p.endAlpha - p.startAlpha) * (1 - lifeRatio);
      } else {
        alpha = (p.alpha ?? 1) * lifeRatio;
      }

      // Calculate size
      let size: number;
      if (p.startSize !== undefined && p.endSize !== undefined) {
        size = p.startSize + (p.endSize - p.startSize) * (1 - lifeRatio);
      } else {
        size = p.size * lifeRatio;
      }

      if (size < 0.3 || alpha < 0.01) continue;

      const shape = p.shape || 'circle';

      switch (shape) {
        case 'circle':
          g.circle(p.x, p.y, size).fill({ color: p.color, alpha: alpha * 0.8 });
          break;

        case 'square':
          if (p.rotation !== undefined) {
            const cos = Math.cos(p.rotation);
            const sin = Math.sin(p.rotation);
            g.poly([
              p.x + (-size * cos - -size * sin),
              p.y + (-size * sin + -size * cos),
              p.x + (size * cos - -size * sin),
              p.y + (size * sin + -size * cos),
              p.x + (size * cos - size * sin),
              p.y + (size * sin + size * cos),
              p.x + (-size * cos - size * sin),
              p.y + (-size * sin + size * cos),
            ]).fill({ color: p.color, alpha: alpha * 0.8 });
          } else {
            g.rect(p.x - size, p.y - size, size * 2, size * 2)
              .fill({ color: p.color, alpha: alpha * 0.8 });
          }
          break;

        case 'spark': {
          const angle = Math.atan2(p.vy, p.vx);
          const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
          const sparkLength = size * (2 + Math.min(speed / 50, 3));
          const sparkWidth = size * 0.3;
          g.poly([
            p.x - Math.cos(angle) * sparkLength,
            p.y - Math.sin(angle) * sparkLength,
            p.x + Math.cos(angle + Math.PI / 2) * sparkWidth,
            p.y + Math.sin(angle + Math.PI / 2) * sparkWidth,
            p.x + Math.cos(angle) * sparkLength,
            p.y + Math.sin(angle) * sparkLength,
            p.x + Math.cos(angle - Math.PI / 2) * sparkWidth,
            p.y + Math.sin(angle - Math.PI / 2) * sparkWidth,
          ]).fill({ color: p.color, alpha: alpha * 0.9 });
          break;
        }

        case 'ring': {
          const strokeWidth = Math.max(1, 3 * lifeRatio);
          g.circle(p.x, p.y, size).stroke({ width: strokeWidth, color: p.color, alpha: alpha * 0.8 });
          break;
        }

        case 'diamond': {
          const rot = p.rotation ?? 0;
          const cos = Math.cos(rot);
          const sin = Math.sin(rot);
          const hw = size * 0.6;
          const hh = size;
          g.poly([
            p.x + hh * cos, p.y + hh * sin,
            p.x - hw * sin, p.y + hw * cos,
            p.x - hh * cos, p.y - hh * sin,
            p.x + hw * sin, p.y - hw * cos,
          ]).fill({ color: p.color, alpha: alpha * 0.85 });
          break;
        }

        case 'star': {
          const points = 5;
          const outerRadius = size;
          const innerRadius = size * 0.4;
          const rot = p.rotation ?? 0;
          const starPoints: number[] = [];
          for (let i = 0; i < points * 2; i++) {
            const r = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = (i * Math.PI) / points + rot - Math.PI / 2;
            starPoints.push(p.x + Math.cos(angle) * r);
            starPoints.push(p.y + Math.sin(angle) * r);
          }
          g.poly(starPoints).fill({ color: p.color, alpha: alpha * 0.9 });
          break;
        }

        case 'smoke': {
          // Large soft circle with low alpha
          g.circle(p.x, p.y, size * 1.5).fill({ color: p.color, alpha: alpha * 0.3 });
          g.circle(p.x, p.y, size).fill({ color: p.color, alpha: alpha * 0.4 });
          break;
        }
      }
    }
  }

  // --- FLASH EFFECT ---
  private spawnFlash(x: number, y: number, color: number, size: number) {
    const p = this.pool.acquire();
    p.x = x;
    p.y = y;
    p.vx = 0;
    p.vy = 0;
    p.life = 0.08;
    p.maxLife = 0.08;
    p.startSize = size * 0.5;
    p.endSize = size * 2;
    p.size = size;
    p.color = 0xffffff;
    p.startAlpha = 1;
    p.endAlpha = 0;
    p.shape = 'circle';
    this.particles.push(p);

    // Secondary colored flash
    const p2 = this.pool.acquire();
    p2.x = x;
    p2.y = y;
    p2.vx = 0;
    p2.vy = 0;
    p2.life = 0.12;
    p2.maxLife = 0.12;
    p2.startSize = size * 0.3;
    p2.endSize = size * 1.5;
    p2.size = size;
    p2.color = color;
    p2.startAlpha = 0.8;
    p2.endAlpha = 0;
    p2.shape = 'circle';
    this.particles.push(p2);
  }

  // --- SHOCKWAVE RING ---
  private spawnShockwaveRing(x: number, y: number, color: number, intensity: number) {
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

  // --- DEBRIS ---
  private spawnDebris(
    x: number,
    y: number,
    colors: { primary: number; secondary: number; glow: number },
    intensity: number,
    fortressClass: FortressClass
  ) {
    const particleCount = Math.floor(25 * intensity * this.particleMultiplier);

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.4;
      const speed = (80 + Math.random() * 150) * intensity;
      const p = this.pool.acquire();

      p.x = x + (Math.random() - 0.5) * 10;
      p.y = y + (Math.random() - 0.5) * 10;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = 0.4 + Math.random() * 0.4;
      p.maxLife = p.life;
      p.size = (3 + Math.random() * 5) * intensity;
      p.color = Math.random() > 0.5 ? colors.primary : (Math.random() > 0.5 ? colors.secondary : colors.glow);
      p.gravity = 150 + Math.random() * 100;
      p.drag = 0.96;
      p.spawnSecondary = Math.random() > 0.6;

      // Class-specific shapes
      switch (fortressClass) {
        case 'natural':
          p.shape = Math.random() > 0.5 ? 'square' : 'circle';
          p.rotation = Math.random() * Math.PI;
          p.rotationSpeed = (Math.random() - 0.5) * 8;
          break;
        case 'ice':
          p.shape = Math.random() > 0.3 ? 'diamond' : 'spark';
          p.rotation = Math.random() * Math.PI;
          p.rotationSpeed = (Math.random() - 0.5) * 4;
          break;
        case 'fire':
          p.shape = 'circle';
          p.gravity = -80 - Math.random() * 60; // Fire rises
          break;
        case 'lightning':
          p.shape = Math.random() > 0.5 ? 'spark' : 'star';
          p.rotation = Math.random() * Math.PI;
          break;
        case 'tech':
          p.shape = 'square';
          p.rotation = 0;
          p.rotationSpeed = 0;
          break;
      }

      this.particles.push(p);
    }
  }

  // --- SECONDARY BURST ---
  private spawnSecondaryBurst(
    x: number,
    y: number,
    colors: { primary: number; secondary: number; glow: number },
    intensity: number
  ) {
    const particleCount = Math.floor(12 * intensity * this.particleMultiplier);

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 20 + Math.random() * 30;
      const p = this.pool.acquire();

      p.x = x + Math.cos(angle) * distance;
      p.y = y + Math.sin(angle) * distance;
      p.vx = (Math.random() - 0.5) * 60;
      p.vy = (Math.random() - 0.5) * 60;
      p.life = 0.3 + Math.random() * 0.3;
      p.maxLife = p.life;
      p.size = 2 + Math.random() * 3;
      p.color = colors.glow;
      p.gravity = 80;
      p.drag = 0.92;
      p.shape = 'circle';

      this.particles.push(p);
    }
  }

  // --- SMOKE ---
  private spawnSmoke(x: number, y: number, intensity: number) {
    const particleCount = Math.floor(8 * intensity * this.particleMultiplier);

    for (let i = 0; i < particleCount; i++) {
      const p = this.pool.acquire();

      p.x = x + (Math.random() - 0.5) * 30;
      p.y = y + (Math.random() - 0.5) * 20;
      p.vx = (Math.random() - 0.5) * 20;
      p.vy = -30 - Math.random() * 40; // Rise up
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

  // --- PUBLIC API ---

  public spawnExplosion(x: number, y: number, color: number = 0xffaa00) {
    const particleCount = Math.floor(12 * this.particleMultiplier);

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.5;
      const speed = 80 + Math.random() * 120;
      const p = this.pool.acquire();

      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = 0.3 + Math.random() * 0.3;
      p.maxLife = 0.6;
      p.size = 4 + Math.random() * 4;
      p.color = color;
      p.shape = 'circle';

      this.particles.push(p);
    }
  }

  /**
   * Spawn enemy death VFX - clean sci-fi disintegration style.
   * Simple expanding ring + small flash, no chaotic particles.
   */
  public spawnEnemyDeathVFX(x: number, y: number, enemyType?: EnemyType) {
    const category = getEnemyCategory(enemyType);
    const colors = ENEMY_DEATH_COLORS[category];

    // Simple flash at death point (smaller)
    this.spawnFlash(x, y, colors.primary, 10);

    // Single expanding ring - clean disintegration effect
    const ring = this.pool.acquire();
    ring.x = x;
    ring.y = y;
    ring.vx = 0;
    ring.vy = 0;
    ring.life = 0.25;
    ring.maxLife = 0.25;
    ring.startSize = 5;
    ring.endSize = 25;
    ring.size = ring.startSize;
    ring.color = colors.primary;
    ring.shape = 'ring';
    ring.startAlpha = 0.6;
    ring.endAlpha = 0;
    this.particles.push(ring);

    // Optional: tiny core flash (white)
    const core = this.pool.acquire();
    core.x = x;
    core.y = y;
    core.vx = 0;
    core.vy = 0;
    core.life = 0.1;
    core.maxLife = 0.1;
    core.startSize = 8;
    core.endSize = 0;
    core.size = core.startSize;
    core.color = 0xffffff;
    core.shape = 'circle';
    core.startAlpha = 0.8;
    core.endAlpha = 0;
    this.particles.push(core);

    // For elite enemies only - add a second outer ring
    // (detected by checking if the position is used for elite tracking - simplified here)
    // No extra effects for regular enemies to keep it clean
  }

  public spawnShockwave(x: number, y: number) {
    // Use FilterManager for shockwave effect
    filterManager.applyScreenShockwave(x, y, 600);
  }

  // --- ENHANCED CLASS-SPECIFIC VFX ---

  /**
   * Spawn enhanced multi-stage explosion with class-specific effects
   */
  public spawnEnhancedExplosion(x: number, y: number, fortressClass: FortressClass, intensity: number = 1) {
    // Add to staged effects queue
    this.stagedEffects.push({
      x, y, fortressClass, intensity,
      elapsed: 0,
      stages: [],
    });

    // Trigger screen shake for large explosions
    if (intensity >= 1) {
      this.triggerScreenShake(3 * intensity, 150);
    }

    // Apply filter effects for dramatic explosions
    if (intensity >= 1.5) {
      // Large explosions get shockwave
      filterManager.applyScreenShockwave(x, y, 800);
    }
    if (intensity >= 1) {
      // Screen flash based on class
      const flashColor = fortressClass === 'fire' ? 'yellow' :
                        fortressClass === 'ice' ? 'white' :
                        fortressClass === 'lightning' ? 'white' : 'white';
      filterManager.applyScreenFlash(flashColor, 150, 0.3 * intensity);
    }
  }

  /**
   * Spawn explosion with class-specific colors and particle behavior
   */
  public spawnClassExplosion(x: number, y: number, fortressClass: FortressClass) {
    // Use enhanced explosion by default
    this.spawnEnhancedExplosion(x, y, fortressClass, 1);
  }

  /**
   * Spawn projectile impact effect with class-specific visuals
   */
  public spawnClassImpact(x: number, y: number, fortressClass: FortressClass) {
    const colors = CLASS_VFX_COLORS[fortressClass];
    const particleCount = Math.floor(8 * this.particleMultiplier);

    // Small particle flash
    this.spawnFlash(x, y, colors.glow, 12);

    // Lighting system flash for dynamic illumination
    this.triggerLightingFlash(x, y, colors.glow, 60);

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.3;
      const speed = 50 + Math.random() * 80;
      const p = this.pool.acquire();

      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = 0.15 + Math.random() * 0.15;
      p.maxLife = 0.3;
      p.size = 2 + Math.random() * 3;
      p.color = Math.random() > 0.5 ? colors.primary : colors.glow;
      p.drag = 0.9;

      // Class-specific shapes for impact
      switch (fortressClass) {
        case 'ice':
          p.shape = 'diamond';
          p.rotation = Math.random() * Math.PI;
          break;
        case 'lightning':
          p.shape = 'spark';
          break;
        case 'tech':
          p.shape = 'square';
          break;
        default:
          p.shape = 'circle';
      }

      this.particles.push(p);
    }
  }

  // --- CHAIN LIGHTNING ---
  public spawnChainLightning(points: { x: number; y: number }[]) {
    if (points.length < 2) return;

    const colors = CLASS_VFX_COLORS.lightning;

    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i];
      const end = points[i + 1];

      // Generate jagged bolt path
      const segments = 8 + Math.floor(Math.random() * 4);
      const dx = (end.x - start.x) / segments;
      const dy = (end.y - start.y) / segments;

      for (let j = 1; j <= segments; j++) {
        const jitter = 15 * (1 - j / segments);
        const nextX = start.x + dx * j + (Math.random() - 0.5) * jitter;
        const nextY = start.y + dy * j + (Math.random() - 0.5) * jitter;

        // Spawn spark particles along the bolt
        if (Math.random() > 0.5) {
          const p = this.pool.acquire();
          p.x = nextX;
          p.y = nextY;
          p.vx = (Math.random() - 0.5) * 100;
          p.vy = (Math.random() - 0.5) * 100;
          p.life = 0.1 + Math.random() * 0.1;
          p.maxLife = p.life;
          p.size = 2 + Math.random() * 2;
          p.color = Math.random() > 0.3 ? colors.glow : colors.primary;
          p.shape = 'spark';
          this.particles.push(p);
        }
      }

      // Flash at each connection point
      this.spawnFlash(end.x, end.y, colors.glow, 15);

      // Small branch at random points
      if (Math.random() > 0.5 && i < points.length - 2) {
        const branchX = start.x + dx * (3 + Math.random() * 3);
        const branchY = start.y + dy * (3 + Math.random() * 3);
        const branchEndX = branchX + (Math.random() - 0.5) * 40;
        const branchEndY = branchY + (Math.random() - 0.5) * 40;

        for (let k = 0; k < 3; k++) {
          const p = this.pool.acquire();
          p.x = branchX + (branchEndX - branchX) * (k / 3);
          p.y = branchY + (branchEndY - branchY) * (k / 3);
          p.vx = (Math.random() - 0.5) * 60;
          p.vy = (Math.random() - 0.5) * 60;
          p.life = 0.08;
          p.maxLife = 0.08;
          p.size = 1.5;
          p.color = colors.glow;
          p.shape = 'spark';
          this.particles.push(p);
        }
      }
    }

    // Screen shake for chain lightning
    this.triggerScreenShake(2, 100);
  }

  // --- AREA INDICATORS ---
  public spawnAreaIndicator(
    x: number,
    y: number,
    radius: number,
    type: 'warning' | 'damage' | 'buff',
    duration: number = 0.5
  ) {
    const colors = {
      warning: 0xff4444,
      damage: 0xff6600,
      buff: 0x44ff44,
    };

    // Expanding ring
    const p = this.pool.acquire();
    p.x = x;
    p.y = y;
    p.vx = 0;
    p.vy = 0;
    p.life = duration;
    p.maxLife = duration;
    p.startSize = radius * 0.2;
    p.endSize = radius;
    p.size = p.startSize;
    p.color = colors[type];
    p.startAlpha = 0.6;
    p.endAlpha = 0;
    p.shape = 'ring';
    this.particles.push(p);

    // Ground particles
    const particleCount = Math.floor((radius / 5) * this.particleMultiplier);
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * radius * 0.8;
      const gp = this.pool.acquire();

      gp.x = x + Math.cos(angle) * dist;
      gp.y = y + Math.sin(angle) * dist;
      gp.vx = (Math.random() - 0.5) * 20;
      gp.vy = type === 'buff' ? -40 - Math.random() * 30 : (Math.random() - 0.5) * 20;
      gp.life = duration * 0.8;
      gp.maxLife = gp.life;
      gp.size = 2 + Math.random() * 2;
      gp.color = colors[type];
      gp.shape = 'circle';
      gp.alpha = 0.6;

      this.particles.push(gp);
    }
  }

  // --- FLOATING TEXT ---
  public spawnFloatingText(x: number, y: number, text: string, color: number = 0xffffff) {
    if (!graphicsSettings.value.damageNumbers) return;

    const style = new TextStyle({
      fontFamily: 'Arial Black, Impact, sans-serif',
      fontSize: 22,
      fontWeight: 'bold',
      fill: color,
      stroke: { width: 4, color: '#000000' },
      dropShadow: {
        color: '#000000',
        blur: 4,
        angle: Math.PI / 4,
        distance: 3,
        alpha: 0.85,
      },
    });

    const pixiText = new Text({ text, style });
    pixiText.x = x;
    pixiText.y = y;
    pixiText.anchor.set(0.5);
    pixiText.scale.set(0.6); // Slightly bigger start

    this.container.addChild(pixiText);
    this.floatingTexts.push({
      text: pixiText,
      life: 1.0,  // Longer visibility
      maxLife: 1.0,
      vy: -40, // Slower float for readability
    });
  }

  /**
   * Spawn damage number with scaling based on damage amount.
   * Bigger damage = bigger text for more satisfying feedback.
   */
  public spawnDamageNumber(
    x: number,
    y: number,
    damage: number,
    options: {
      isCrit?: boolean;
      color?: number;
    } = {}
  ) {
    if (!graphicsSettings.value.damageNumbers) return;

    const { isCrit = false, color } = options;

    // Scale font size with damage (logarithmic scaling for balance)
    // Base: 18, scales up to ~36 for 1000+ damage
    const baseSize = 18;
    const scaledSize = baseSize + Math.pow(damage, 0.25) * 2.5;
    const fontSize = Math.min(scaledSize, 42); // Cap at 42

    // Crit gets yellow color and "!" suffix, otherwise use provided or default orange
    const textColor = isCrit ? 0xffff00 : (color ?? 0xffaa00);
    const displayText = isCrit ? `${Math.round(damage)}!` : Math.round(damage).toString();

    const style = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: fontSize,
      fontWeight: 'bold',
      fill: textColor,
      stroke: { width: isCrit ? 5 : 4, color: '#000000' },
      dropShadow: {
        color: '#000000',
        blur: isCrit ? 5 : 3,
        angle: Math.PI / 4,
        distance: isCrit ? 4 : 2,
        alpha: 0.85,
      },
    });

    const pixiText = new Text({ text: displayText, style });
    pixiText.x = x + (Math.random() - 0.5) * 8; // Slight random offset
    pixiText.y = y;
    pixiText.anchor.set(0.5);

    // Crits start bigger and have a pop-in effect
    const startScale = isCrit ? 0.7 : 0.4;
    pixiText.scale.set(startScale);

    this.container.addChild(pixiText);
    this.floatingTexts.push({
      text: pixiText,
      life: isCrit ? 1.0 : 0.8, // Crits last slightly longer
      maxLife: isCrit ? 1.0 : 0.8,
      vy: isCrit ? -40 : -50, // Crits float slower
    });

    // Screen shake for very high damage (1000+)
    if (damage >= 1000) {
      this.triggerScreenShake(2, 100);
    }
  }

  // --- CONFETTI ---
  public spawnConfetti(x: number, y: number) {
    const particleCount = Math.floor(50 * this.particleMultiplier);
    const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff];

    for (let i = 0; i < particleCount; i++) {
      const p = this.pool.acquire();
      p.x = x;
      p.y = y;
      
      const angle = Math.random() * Math.PI * 2;
      const speed = 100 + Math.random() * 200;
      
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 100; // Upward bias
      
      p.life = 1.5 + Math.random();
      p.maxLife = p.life;
      p.size = 4 + Math.random() * 4;
      p.color = colors[Math.floor(Math.random() * colors.length)];
      p.shape = 'confetti';
      p.gravity = 100;
      p.drag = 0.95;
      
      p.rotation = Math.random() * Math.PI * 2;
      p.rotationSpeed = (Math.random() - 0.5) * 10;
      
      this.particles.push(p);
    }
  }

  // --- KILL STREAK ---
  /**
   * Spawn kill streak effects based on streak count.
   * Escalating feedback: text → flash → shake → confetti
   */
  public spawnKillStreakEffect(x: number, y: number, streak: number) {
    // Define streak thresholds and names
    const STREAK_CONFIG: Array<{ threshold: number; name: string; color: number }> = [
      { threshold: 3, name: 'DOUBLE KILL!', color: 0xffcc00 },
      { threshold: 5, name: 'TRIPLE KILL!', color: 0xff8800 },
      { threshold: 10, name: 'RAMPAGE!', color: 0xff4400 },
      { threshold: 15, name: 'DOMINATING!', color: 0xff0066 },
      { threshold: 20, name: 'GODLIKE!', color: 0xff00ff },
    ];

    // Find the highest matching streak tier
    let matchedConfig: { threshold: number; name: string; color: number } | null = null;
    for (const config of STREAK_CONFIG) {
      if (streak >= config.threshold) {
        matchedConfig = config;
      }
    }

    if (!matchedConfig) return; // Streak too low for any effect

    // Always show floating text for any streak milestone
    const style = new TextStyle({
      fontFamily: 'Arial Black, Impact, sans-serif',
      fontSize: 28 + (streak * 0.8), // Bigger text for bigger streaks
      fontWeight: 'bold',
      fill: matchedConfig.color,
      stroke: { width: 5, color: '#000000' },
      dropShadow: {
        color: '#000000',
        blur: 6,
        angle: Math.PI / 4,
        distance: 4,
        alpha: 0.9,
      },
      letterSpacing: 1,
    });

    const pixiText = new Text({ text: matchedConfig.name, style });
    pixiText.x = x;
    pixiText.y = y - 40; // Higher above the kill for better visibility
    pixiText.anchor.set(0.5);
    pixiText.scale.set(0.5); // Start slightly bigger for better readability

    this.container.addChild(pixiText);
    this.floatingTexts.push({
      text: pixiText,
      life: 1.2, // Longer than normal floating text
      maxLife: 1.2,
      vy: -30, // Slower float
    });

    // Add screen flash for 5+ kills
    if (streak >= 5) {
      // Map streak to flash color (yellow for most, red for high streaks)
      const flashColor: 'yellow' | 'red' | 'white' = streak >= 15 ? 'red' : 'yellow';
      filterManager.applyScreenFlash(flashColor, 150, 0.2);
    }

    // Add screen shake for 10+ kills
    if (streak >= 10) {
      this.triggerScreenShake(3 + Math.floor(streak / 5), 200);
    }

    // Confetti and burst particles removed for cleaner visuals
    // The text effect alone is more readable and less chaotic
  }

  // --- COMBO EFFECTS ---
  /**
   * Spawn combo effect when elemental combo triggers.
   * Shows combo name and burst of particles.
   */
  public spawnComboEffect(
    x: number,
    y: number,
    comboId: string,
    bonusDamage?: number
  ) {
    // Combo visual config - simplified colors
    const COMBO_CONFIG: Record<string, { name: string; color: number }> = {
      steam_burst: { name: 'STEAM BURST!', color: 0xff8844 },
      electrocute: { name: 'ELECTROCUTE!', color: 0x44aaff },
      shatter: { name: 'SHATTER!', color: 0xcc88ff },
    };

    const config = COMBO_CONFIG[comboId];
    if (!config) return;

    // Floating combo text
    this.spawnFloatingText(x, y - 20, config.name, config.color);

    // If bonus damage, show it too
    if (bonusDamage && bonusDamage > 0) {
      setTimeout(() => {
        this.spawnDamageNumber(x, y, bonusDamage, { isCrit: true });
      }, 100);
    }

    // Subtle screen flash for combo
    filterManager.applyScreenFlash('white', 80, 0.1);

    // Simple expanding ring instead of particle burst
    const ring = this.pool.acquire();
    ring.x = x;
    ring.y = y;
    ring.vx = 0;
    ring.vy = 0;
    ring.life = 0.3;
    ring.maxLife = 0.3;
    ring.startSize = 10;
    ring.endSize = 40;
    ring.size = ring.startSize;
    ring.color = config.color;
    ring.shape = 'ring';
    ring.startAlpha = 0.7;
    ring.endAlpha = 0;
    this.particles.push(ring);
  }

  // --- HEAL/BUFF EFFECTS ---
  public spawnHealEffect(x: number, y: number, type: 'heal' | 'shield' | 'buff') {
    const colors = {
      heal: { primary: 0x44ff44, secondary: 0x88ff88 },
      shield: { primary: 0x4488ff, secondary: 0x88bbff },
      buff: { primary: 0xffaa00, secondary: 0xffcc44 },
    };

    const c = colors[type];

    // Rising particles
    for (let i = 0; i < 15; i++) {
      const p = this.pool.acquire();
      p.x = x + (Math.random() - 0.5) * 30;
      p.y = y + (Math.random() - 0.5) * 20;
      p.vx = (Math.random() - 0.5) * 30;
      p.vy = -60 - Math.random() * 40;
      p.life = 0.5 + Math.random() * 0.3;
      p.maxLife = p.life;
      p.size = 3 + Math.random() * 3;
      p.color = Math.random() > 0.5 ? c.primary : c.secondary;
      p.shape = type === 'shield' ? 'diamond' : 'circle';
      p.gravity = -30;
      p.startAlpha = 0.8;
      p.endAlpha = 0;
      this.particles.push(p);
    }

    // Burst ring
    this.spawnShockwaveRing(x, y, c.primary, 0.8);
  }

  // --- CRITICAL HIT ---
  public spawnCriticalHit(x: number, y: number) {
    // Large flash
    this.spawnFlash(x, y, 0xffff00, 30);

    // Radial sparks
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12;
      const p = this.pool.acquire();
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * 150;
      p.vy = Math.sin(angle) * 150;
      p.life = 0.2;
      p.maxLife = 0.2;
      p.size = 4;
      p.color = 0xffff00;
      p.shape = 'spark';
      this.particles.push(p);
    }

    // Star burst
    const star = this.pool.acquire();
    star.x = x;
    star.y = y;
    star.vx = 0;
    star.vy = 0;
    star.life = 0.15;
    star.maxLife = 0.15;
    star.startSize = 5;
    star.endSize = 25;
    star.size = star.startSize;
    star.color = 0xffffff;
    star.shape = 'star';
    star.rotation = 0;
    star.rotationSpeed = 10;
    this.particles.push(star);

    // Screen shake
    this.triggerScreenShake(4, 120);
  }

  // --- SKILL VFX ---

  /**
   * Spawn skill activation effect
   */
  public spawnSkillActivation(x: number, y: number, fortressClass: FortressClass, skillLevel: number = 1) {
    const colors = CLASS_VFX_COLORS[fortressClass];
    const intensity = 1 + skillLevel * 0.5;
    const particleCount = Math.floor(24 * intensity);

    // Expanding waves
    for (let i = 0; i < 3; i++) {
      const p = this.pool.acquire();
      p.x = x;
      p.y = y;
      p.vx = 0;
      p.vy = 0;
      p.life = 0.4 + i * 0.15;
      p.maxLife = p.life;
      p.startSize = 20 * intensity;
      p.endSize = (60 + i * 25) * intensity;
      p.size = p.startSize;
      p.color = colors.secondary;
      p.startAlpha = 0.5;
      p.endAlpha = 0;
      p.shape = 'ring';
      this.particles.push(p);
    }

    // Burst particles
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount;
      const speed = (100 + Math.random() * 150) * intensity;
      const p = this.pool.acquire();

      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = 0.5 + Math.random() * 0.3;
      p.maxLife = 0.8;
      p.size = (4 + Math.random() * 4) * intensity;
      p.color = Math.random() > 0.5 ? colors.primary : colors.glow;
      p.shape = fortressClass === 'tech' ? 'square' : 'circle';
      p.drag = 0.94;

      this.particles.push(p);
    }

    // Central flash
    this.spawnFlash(x, y, colors.glow, 20 * intensity);

    // Screen shake for powerful skills
    if (skillLevel >= 2) {
      this.triggerScreenShake(2 * skillLevel, 100);
    }
  }

  /**
   * Spawn hero deployment effect
   */
  public spawnHeroDeployment(x: number, y: number, fortressClass: FortressClass) {
    const colors = CLASS_VFX_COLORS[fortressClass];

    // Circular burst
    for (let i = 0; i < 20; i++) {
      const angle = (Math.PI * 2 * i) / 20;
      const speed = 80 + Math.random() * 60;
      const p = this.pool.acquire();

      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = 0.4 + Math.random() * 0.3;
      p.maxLife = 0.7;
      p.size = 4 + Math.random() * 4;
      p.color = colors.glow;
      p.drag = 0.95;

      this.particles.push(p);
    }

    // Ground ring
    const ring = this.pool.acquire();
    ring.x = x;
    ring.y = y;
    ring.vx = 0;
    ring.vy = 0;
    ring.life = 0.5;
    ring.maxLife = 0.5;
    ring.startSize = 10;
    ring.endSize = 60;
    ring.size = ring.startSize;
    ring.color = colors.primary;
    ring.startAlpha = 0.7;
    ring.endAlpha = 0;
    ring.shape = 'ring';
    this.particles.push(ring);

    // Flash
    this.spawnFlash(x, y, colors.glow, 25);
  }

  /**
   * Spawn turret firing effect
   */
  public spawnTurretFire(x: number, y: number, angle: number, fortressClass: FortressClass) {
    const colors = CLASS_VFX_COLORS[fortressClass];
    const particleCount = 8;

    // Muzzle flash
    const flash = this.pool.acquire();
    flash.x = x + Math.cos(angle) * 5;
    flash.y = y + Math.sin(angle) * 5;
    flash.vx = 0;
    flash.vy = 0;
    flash.life = 0.06;
    flash.maxLife = 0.06;
    flash.size = 8;
    flash.color = colors.glow;
    flash.shape = 'circle';
    this.particles.push(flash);

    for (let i = 0; i < particleCount; i++) {
      const spreadAngle = angle + (Math.random() - 0.5) * 0.6;
      const speed = 180 + Math.random() * 120;
      const p = this.pool.acquire();

      p.x = x;
      p.y = y;
      p.vx = Math.cos(spreadAngle) * speed;
      p.vy = Math.sin(spreadAngle) * speed;
      p.life = 0.08 + Math.random() * 0.08;
      p.maxLife = 0.16;
      p.size = 2 + Math.random() * 2;
      p.color = colors.glow;
      p.shape = fortressClass === 'lightning' || fortressClass === 'tech' ? 'spark' : 'circle';
      p.drag = 0.85;

      this.particles.push(p);
    }
  }

  // --- STATUS EFFECT AURAS ---

  /**
   * Spawn status effect particles around a position
   */
  public spawnStatusAura(
    x: number,
    y: number,
    effectType: 'slow' | 'freeze' | 'burn' | 'poison' | 'stun',
    intensity: number = 1
  ) {
    switch (effectType) {
      case 'slow':
      case 'freeze':
        this.spawnIceAura(x, y, effectType === 'freeze', intensity);
        break;
      case 'burn':
        this.spawnFireAura(x, y, intensity);
        break;
      case 'poison':
        this.spawnPoisonAura(x, y, intensity);
        break;
      case 'stun':
        this.spawnStunAura(x, y, intensity);
        break;
    }
  }

  private spawnIceAura(x: number, y: number, isFrozen: boolean, intensity: number) {
    const colors = CLASS_VFX_COLORS.ice;
    const count = isFrozen ? 4 : 2;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 10 + Math.random() * 15;
      const p = this.pool.acquire();

      p.x = x + Math.cos(angle) * dist;
      p.y = y + Math.sin(angle) * dist;
      p.vx = (Math.random() - 0.5) * 15;
      p.vy = -20 - Math.random() * 20;
      p.life = 0.4 + Math.random() * 0.3;
      p.maxLife = p.life;
      p.size = (2 + Math.random() * 2) * intensity;
      p.color = isFrozen ? colors.glow : colors.secondary;
      p.shape = 'diamond';
      p.rotation = Math.random() * Math.PI;
      p.rotationSpeed = (Math.random() - 0.5) * 3;
      p.alpha = 0.7;

      this.particles.push(p);
    }
  }

  private spawnFireAura(x: number, y: number, intensity: number) {
    const colors = CLASS_VFX_COLORS.fire;

    for (let i = 0; i < 3; i++) {
      const p = this.pool.acquire();
      p.x = x + (Math.random() - 0.5) * 20;
      p.y = y + (Math.random() - 0.5) * 10;
      p.vx = (Math.random() - 0.5) * 20;
      p.vy = -40 - Math.random() * 30;
      p.life = 0.3 + Math.random() * 0.2;
      p.maxLife = p.life;
      p.size = (3 + Math.random() * 3) * intensity;
      p.color = Math.random() > 0.3 ? colors.primary : colors.glow;
      p.shape = 'circle';
      p.gravity = -50;
      p.startAlpha = 0.7;
      p.endAlpha = 0;

      this.particles.push(p);
    }
  }

  private spawnPoisonAura(x: number, y: number, intensity: number) {
    for (let i = 0; i < 2; i++) {
      const p = this.pool.acquire();
      p.x = x + (Math.random() - 0.5) * 25;
      p.y = y + 5;
      p.vx = (Math.random() - 0.5) * 10;
      p.vy = -25 - Math.random() * 20;
      p.life = 0.5 + Math.random() * 0.3;
      p.maxLife = p.life;
      p.startSize = (3 + Math.random() * 2) * intensity;
      p.endSize = p.startSize * 1.5;
      p.size = p.startSize;
      p.color = 0x44ff44;
      p.shape = 'circle';
      p.startAlpha = 0.6;
      p.endAlpha = 0;

      this.particles.push(p);
    }
  }

  private spawnStunAura(x: number, y: number, intensity: number) {
    const colors = CLASS_VFX_COLORS.lightning;

    // Electric sparks
    for (let i = 0; i < 2; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 8 + Math.random() * 12;
      const p = this.pool.acquire();

      p.x = x + Math.cos(angle) * dist;
      p.y = y + Math.sin(angle) * dist;
      p.vx = (Math.random() - 0.5) * 80;
      p.vy = (Math.random() - 0.5) * 80;
      p.life = 0.1 + Math.random() * 0.1;
      p.maxLife = p.life;
      p.size = (2 + Math.random() * 2) * intensity;
      p.color = Math.random() > 0.5 ? colors.glow : 0xffff00;
      p.shape = 'spark';

      this.particles.push(p);
    }

    // Occasional star flash
    if (Math.random() > 0.7) {
      const star = this.pool.acquire();
      star.x = x + (Math.random() - 0.5) * 15;
      star.y = y + (Math.random() - 0.5) * 15;
      star.vx = 0;
      star.vy = 0;
      star.life = 0.15;
      star.maxLife = 0.15;
      star.size = 6 * intensity;
      star.color = 0xffff00;
      star.shape = 'star';
      star.rotation = Math.random() * Math.PI;

      this.particles.push(star);
    }
  }

  // ============================================================
  // HERO-SPECIFIC SKILL VFX
  // ============================================================

  // --- UNIT-7 "STORM" - LIGHTNING CLASS ---

  /**
   * Storm's Plasma Hammer Throw - spinning hammer with lightning trail
   */
  public spawnHammerThrow(startX: number, startY: number, targetX: number, targetY: number) {
    const colors = { primary: 0x4169e1, secondary: 0x87ceeb, glow: 0xffff00 };
    const dist = Math.sqrt((targetX - startX) ** 2 + (targetY - startY) ** 2);
    const steps = Math.floor(dist / 15);

    // Hammer path with spinning effect
    for (let i = 0; i < steps; i++) {
      const progress = i / steps;
      const x = startX + (targetX - startX) * progress;
      const y = startY + (targetY - startY) * progress;
      const delay = i * 0.02;

      // Hammer head (square, rotating)
      const hammer = this.pool.acquire();
      hammer.x = x;
      hammer.y = y;
      hammer.vx = 0;
      hammer.vy = 0;
      hammer.life = 0.3 - delay;
      hammer.maxLife = 0.3;
      hammer.size = 12 - progress * 4;
      hammer.color = 0x888899;
      hammer.shape = 'square';
      hammer.rotation = progress * Math.PI * 8; // Spin!
      hammer.rotationSpeed = 20;
      this.particles.push(hammer);

      // Lightning trail
      if (i % 2 === 0) {
        const spark = this.pool.acquire();
        spark.x = x + (Math.random() - 0.5) * 15;
        spark.y = y + (Math.random() - 0.5) * 15;
        spark.vx = (Math.random() - 0.5) * 100;
        spark.vy = (Math.random() - 0.5) * 100;
        spark.life = 0.15;
        spark.maxLife = 0.15;
        spark.size = 3;
        spark.color = colors.glow;
        spark.shape = 'spark';
        this.particles.push(spark);
      }
    }

    // Impact explosion at target
    this.spawnLightningStrike(targetX, targetY, 0.8);
  }

  /**
   * Lightning Strike from sky - dramatic bolt hitting ground
   */
  public spawnLightningStrike(x: number, y: number, intensity: number = 1) {
    const colors = CLASS_VFX_COLORS.lightning;

    // Screen shake
    this.triggerScreenShake(5 * intensity, 200);

    // Bright flash at impact point
    this.spawnFlash(x, y, 0xffffff, 40 * intensity);
    this.spawnFlash(x, y, colors.glow, 60 * intensity);

    // Main lightning bolt from sky
    const boltHeight = 300;
    const segments = 12;
    let prevX = x + (Math.random() - 0.5) * 30;
    let prevY = y - boltHeight;

    for (let i = 1; i <= segments; i++) {
      const progress = i / segments;
      const jitter = 40 * (1 - progress * 0.5);
      const nextX = x + (Math.random() - 0.5) * jitter;
      const nextY = y - boltHeight + boltHeight * progress;

      // Main bolt particles
      const boltParticle = this.pool.acquire();
      boltParticle.x = (prevX + nextX) / 2;
      boltParticle.y = (prevY + nextY) / 2;
      boltParticle.vx = 0;
      boltParticle.vy = 0;
      boltParticle.life = 0.2;
      boltParticle.maxLife = 0.2;
      boltParticle.size = 8 * intensity * (1 - progress * 0.3);
      boltParticle.color = 0xffffff;
      boltParticle.shape = 'circle';
      this.particles.push(boltParticle);

      // Glow around bolt
      const glowParticle = this.pool.acquire();
      glowParticle.x = (prevX + nextX) / 2;
      glowParticle.y = (prevY + nextY) / 2;
      glowParticle.vx = 0;
      glowParticle.vy = 0;
      glowParticle.life = 0.25;
      glowParticle.maxLife = 0.25;
      glowParticle.size = 20 * intensity;
      glowParticle.color = colors.primary;
      glowParticle.startAlpha = 0.6;
      glowParticle.endAlpha = 0;
      glowParticle.shape = 'circle';
      this.particles.push(glowParticle);

      // Branch lightning
      if (Math.random() > 0.6 && i > 2 && i < segments - 2) {
        const branchAngle = (Math.random() > 0.5 ? 1 : -1) * (Math.PI / 4 + Math.random() * Math.PI / 4);
        const branchLen = 30 + Math.random() * 40;
        for (let j = 0; j < 4; j++) {
          const bp = this.pool.acquire();
          bp.x = nextX + Math.cos(branchAngle) * branchLen * (j / 4);
          bp.y = nextY + Math.sin(branchAngle) * branchLen * (j / 4);
          bp.vx = 0;
          bp.vy = 0;
          bp.life = 0.15;
          bp.maxLife = 0.15;
          bp.size = 4 * (1 - j / 4);
          bp.color = colors.glow;
          bp.shape = 'circle';
          this.particles.push(bp);
        }
      }

      prevX = nextX;
      prevY = nextY;
    }

    // Ground impact - electric sparks radiating outward
    for (let i = 0; i < 20; i++) {
      const angle = (Math.PI * 2 * i) / 20;
      const speed = 150 + Math.random() * 100;
      const spark = this.pool.acquire();
      spark.x = x;
      spark.y = y;
      spark.vx = Math.cos(angle) * speed;
      spark.vy = Math.sin(angle) * speed * 0.5; // Flatten for ground effect
      spark.life = 0.3;
      spark.maxLife = 0.3;
      spark.size = 4 * intensity;
      spark.color = Math.random() > 0.3 ? colors.glow : 0xffffff;
      spark.shape = 'spark';
      spark.drag = 0.92;
      this.particles.push(spark);
    }

    // Electric ground ring
    const ring = this.pool.acquire();
    ring.x = x;
    ring.y = y;
    ring.vx = 0;
    ring.vy = 0;
    ring.life = 0.4;
    ring.maxLife = 0.4;
    ring.startSize = 10;
    ring.endSize = 100 * intensity;
    ring.size = 10;
    ring.color = colors.primary;
    ring.startAlpha = 0.8;
    ring.endAlpha = 0;
    ring.shape = 'ring';
    this.particles.push(ring);
  }

  /**
   * Storm's EMP Blast Ultimate - massive electromagnetic pulse
   */
  public spawnEmpBlast(x: number, y: number) {
    // Massive screen shake
    this.triggerScreenShake(12, 400);

    // Multiple lightning strikes
    for (let i = 0; i < 5; i++) {
      const strikeX = x + (Math.random() - 0.5) * 150;
      const strikeY = y + (Math.random() - 0.5) * 80;
      // Stagger the strikes
      setTimeout(() => {
        this.spawnLightningStrike(strikeX, strikeY, 1.2);
      }, i * 80);
    }

    // Central massive flash
    this.spawnFlash(x, y, 0xffffff, 100);

    // Expanding lightning ring
    for (let i = 0; i < 3; i++) {
      const ring = this.pool.acquire();
      ring.x = x;
      ring.y = y;
      ring.vx = 0;
      ring.vy = 0;
      ring.life = 0.6 + i * 0.15;
      ring.maxLife = ring.life;
      ring.startSize = 20;
      ring.endSize = 200 + i * 50;
      ring.size = 20;
      ring.color = i === 0 ? 0xffffff : CLASS_VFX_COLORS.lightning.primary;
      ring.startAlpha = 0.9 - i * 0.2;
      ring.endAlpha = 0;
      ring.shape = 'ring';
      this.particles.push(ring);
    }

    // Electric storm particles everywhere
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 120;
      const spark = this.pool.acquire();
      spark.x = x + Math.cos(angle) * dist;
      spark.y = y + Math.sin(angle) * dist;
      spark.vx = (Math.random() - 0.5) * 200;
      spark.vy = (Math.random() - 0.5) * 200;
      spark.life = 0.4 + Math.random() * 0.3;
      spark.maxLife = spark.life;
      spark.size = 3 + Math.random() * 4;
      spark.color = Math.random() > 0.5 ? 0xffffff : 0xffff00;
      spark.shape = 'star';
      spark.rotation = Math.random() * Math.PI;
      spark.rotationSpeed = 10;
      this.particles.push(spark);
    }
  }

  // --- UNIT-3 "FORGE" - TECH CLASS ---

  /**
   * Laser Beam - energy blast from hand
   */
  public spawnLaserBeam(startX: number, startY: number, targetX: number, targetY: number) {
    const colors = CLASS_VFX_COLORS.tech;
    const angle = Math.atan2(targetY - startY, targetX - startX);
    const dist = Math.sqrt((targetX - startX) ** 2 + (targetY - startY) ** 2);

    // Muzzle flash at hand
    this.spawnFlash(startX, startY, colors.glow, 15);

    // Beam core
    const steps = Math.floor(dist / 8);
    for (let i = 0; i < steps; i++) {
      const progress = i / steps;
      const x = startX + Math.cos(angle) * dist * progress;
      const y = startY + Math.sin(angle) * dist * progress;

      // Core beam
      const core = this.pool.acquire();
      core.x = x;
      core.y = y;
      core.vx = 0;
      core.vy = 0;
      core.life = 0.15;
      core.maxLife = 0.15;
      core.size = 6 * (1 - progress * 0.3);
      core.color = 0xffffff;
      core.shape = 'circle';
      this.particles.push(core);

      // Outer glow
      const glow = this.pool.acquire();
      glow.x = x;
      glow.y = y;
      glow.vx = 0;
      glow.vy = 0;
      glow.life = 0.2;
      glow.maxLife = 0.2;
      glow.size = 12 * (1 - progress * 0.3);
      glow.color = colors.primary;
      glow.startAlpha = 0.5;
      glow.endAlpha = 0;
      glow.shape = 'circle';
      this.particles.push(glow);
    }

    // Impact
    this.spawnFlash(targetX, targetY, colors.glow, 25);
    this.spawnClassImpact(targetX, targetY, 'tech');
  }

  /**
   * Missile Barrage - multiple missiles with smoke trails
   */
  public spawnMissileBarrage(startX: number, startY: number, targets: { x: number; y: number }[]) {
    const colors = { primary: 0xb22222, secondary: 0xffd700, smoke: 0x666666 };

    for (let m = 0; m < Math.min(targets.length, 6); m++) {
      const target = targets[m] || targets[0];
      const delay = m * 0.1;

      // Missile launch flash
      setTimeout(() => {
        this.spawnFlash(startX, startY, colors.secondary, 10);

        // Missile trail
        const dist = Math.sqrt((target.x - startX) ** 2 + (target.y - startY) ** 2);
        const angle = Math.atan2(target.y - startY, target.x - startX);
        const steps = Math.floor(dist / 12);

        for (let i = 0; i < steps; i++) {
          const progress = i / steps;
          const x = startX + Math.cos(angle) * dist * progress;
          const y = startY + Math.sin(angle) * dist * progress;

          // Missile body
          const missile = this.pool.acquire();
          missile.x = x;
          missile.y = y;
          missile.vx = 0;
          missile.vy = 0;
          missile.life = 0.25 - progress * 0.15;
          missile.maxLife = 0.25;
          missile.size = 5;
          missile.color = colors.primary;
          missile.shape = 'spark';
          this.particles.push(missile);

          // Smoke trail
          if (i % 2 === 0) {
            const smoke = this.pool.acquire();
            smoke.x = x + (Math.random() - 0.5) * 8;
            smoke.y = y + (Math.random() - 0.5) * 8;
            smoke.vx = -Math.cos(angle) * 20 + (Math.random() - 0.5) * 20;
            smoke.vy = -Math.sin(angle) * 20 + (Math.random() - 0.5) * 20 - 15;
            smoke.life = 0.4;
            smoke.maxLife = 0.4;
            smoke.startSize = 4;
            smoke.endSize = 12;
            smoke.size = 4;
            smoke.color = colors.smoke;
            smoke.startAlpha = 0.5;
            smoke.endAlpha = 0;
            smoke.shape = 'smoke';
            this.particles.push(smoke);
          }

          // Fire trail
          const fire = this.pool.acquire();
          fire.x = x - Math.cos(angle) * 5;
          fire.y = y - Math.sin(angle) * 5;
          fire.vx = -Math.cos(angle) * 30;
          fire.vy = -Math.sin(angle) * 30;
          fire.life = 0.15;
          fire.maxLife = 0.15;
          fire.size = 4 * (1 - progress);
          fire.color = colors.secondary;
          fire.shape = 'circle';
          this.particles.push(fire);
        }

        // Missile explosion at target
        this.spawnEnhancedExplosion(target.x, target.y, 'fire', 0.7);
      }, delay * 1000);
    }
  }

  /**
   * Proton Cannon Ultimate - massive energy beam
   */
  public spawnProtonCannon(startX: number, startY: number, targetX: number, targetY: number) {
    const colors = CLASS_VFX_COLORS.tech;

    // Massive screen shake
    this.triggerScreenShake(10, 500);

    const angle = Math.atan2(targetY - startY, targetX - startX);
    const dist = Math.sqrt((targetX - startX) ** 2 + (targetY - startY) ** 2);

    // Charging effect at source
    for (let i = 0; i < 20; i++) {
      const chargeAngle = Math.random() * Math.PI * 2;
      const chargeDist = 30 + Math.random() * 30;
      const charge = this.pool.acquire();
      charge.x = startX + Math.cos(chargeAngle) * chargeDist;
      charge.y = startY + Math.sin(chargeAngle) * chargeDist;
      charge.vx = -Math.cos(chargeAngle) * 100;
      charge.vy = -Math.sin(chargeAngle) * 100;
      charge.life = 0.3;
      charge.maxLife = 0.3;
      charge.size = 4;
      charge.color = colors.glow;
      charge.shape = 'circle';
      this.particles.push(charge);
    }

    // Main beam - very wide
    const beamWidth = 40;
    const steps = Math.floor(dist / 10);

    for (let i = 0; i < steps; i++) {
      const progress = i / steps;
      const x = startX + Math.cos(angle) * dist * progress;
      const y = startY + Math.sin(angle) * dist * progress;

      // Outer glow
      const outer = this.pool.acquire();
      outer.x = x;
      outer.y = y;
      outer.vx = 0;
      outer.vy = 0;
      outer.life = 0.4;
      outer.maxLife = 0.4;
      outer.size = beamWidth * 1.5;
      outer.color = colors.glow;
      outer.startAlpha = 0.3;
      outer.endAlpha = 0;
      outer.shape = 'circle';
      this.particles.push(outer);

      // Core beam
      const core = this.pool.acquire();
      core.x = x;
      core.y = y;
      core.vx = 0;
      core.vy = 0;
      core.life = 0.35;
      core.maxLife = 0.35;
      core.size = beamWidth;
      core.color = colors.primary;
      core.startAlpha = 0.7;
      core.endAlpha = 0;
      core.shape = 'circle';
      this.particles.push(core);

      // Inner white core
      const inner = this.pool.acquire();
      inner.x = x;
      inner.y = y;
      inner.vx = 0;
      inner.vy = 0;
      inner.life = 0.3;
      inner.maxLife = 0.3;
      inner.size = beamWidth * 0.4;
      inner.color = 0xffffff;
      inner.shape = 'circle';
      this.particles.push(inner);

      // Data fragments along beam
      if (i % 3 === 0) {
        const frag = this.pool.acquire();
        frag.x = x + (Math.random() - 0.5) * beamWidth;
        frag.y = y + (Math.random() - 0.5) * beamWidth;
        frag.vx = (Math.random() - 0.5) * 50;
        frag.vy = (Math.random() - 0.5) * 50;
        frag.life = 0.3;
        frag.maxLife = 0.3;
        frag.size = 4;
        frag.color = colors.glow;
        frag.shape = 'square';
        this.particles.push(frag);
      }
    }

    // Massive impact explosion
    this.spawnFlash(targetX, targetY, 0xffffff, 80);
    this.spawnFlash(targetX, targetY, colors.glow, 100);

    // Impact ring
    for (let i = 0; i < 3; i++) {
      const ring = this.pool.acquire();
      ring.x = targetX;
      ring.y = targetY;
      ring.vx = 0;
      ring.vy = 0;
      ring.life = 0.5 + i * 0.1;
      ring.maxLife = ring.life;
      ring.startSize = 20;
      ring.endSize = 150 + i * 30;
      ring.size = 20;
      ring.color = i === 0 ? 0xffffff : colors.primary;
      ring.startAlpha = 0.8;
      ring.endAlpha = 0;
      ring.shape = 'ring';
      this.particles.push(ring);
    }
  }

  // --- UNIT-1 "TITAN" - NATURAL CLASS ---

  /**
   * Ground Smash - powerful ground pound
   */
  public spawnGroundSmash(x: number, y: number, intensity: number = 1) {
    const colors = CLASS_VFX_COLORS.natural;

    // Screen shake
    this.triggerScreenShake(8 * intensity, 300);

    // Impact flash
    this.spawnFlash(x, y, colors.glow, 30 * intensity);

    // Ground crack lines radiating outward
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const crackLen = 60 + Math.random() * 40;

      for (let j = 0; j < 6; j++) {
        const progress = j / 6;
        const crack = this.pool.acquire();
        crack.x = x + Math.cos(angle) * crackLen * progress;
        crack.y = y + Math.sin(angle) * crackLen * progress * 0.3; // Flatten for ground
        crack.vx = Math.cos(angle) * 20;
        crack.vy = Math.sin(angle) * 10;
        crack.life = 0.5 - progress * 0.2;
        crack.maxLife = 0.5;
        crack.size = 5 * (1 - progress * 0.5) * intensity;
        crack.color = 0x8b4513; // Brown for dirt
        crack.shape = 'spark';
        this.particles.push(crack);
      }
    }

    // Debris flying up
    for (let i = 0; i < 25 * intensity; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 120;
      const debris = this.pool.acquire();
      debris.x = x + (Math.random() - 0.5) * 30;
      debris.y = y + (Math.random() - 0.5) * 15;
      debris.vx = Math.cos(angle) * speed * 0.5;
      debris.vy = -Math.abs(Math.sin(angle) * speed) - 50; // Always up
      debris.life = 0.6 + Math.random() * 0.3;
      debris.maxLife = debris.life;
      debris.size = 4 + Math.random() * 6;
      debris.color = Math.random() > 0.5 ? 0x8b4513 : 0x654321;
      debris.shape = 'square';
      debris.rotation = Math.random() * Math.PI;
      debris.rotationSpeed = (Math.random() - 0.5) * 10;
      debris.gravity = 200;
      this.particles.push(debris);
    }

    // Dust cloud
    for (let i = 0; i < 15; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dust = this.pool.acquire();
      dust.x = x + (Math.random() - 0.5) * 40;
      dust.y = y + (Math.random() - 0.5) * 20;
      dust.vx = Math.cos(angle) * 40;
      dust.vy = -20 - Math.random() * 30;
      dust.life = 0.8;
      dust.maxLife = 0.8;
      dust.startSize = 10;
      dust.endSize = 30;
      dust.size = 10;
      dust.color = 0x999988;
      dust.startAlpha = 0.4;
      dust.endAlpha = 0;
      dust.shape = 'smoke';
      this.particles.push(dust);
    }

    // Shockwave ring
    const ring = this.pool.acquire();
    ring.x = x;
    ring.y = y;
    ring.vx = 0;
    ring.vy = 0;
    ring.life = 0.4;
    ring.maxLife = 0.4;
    ring.startSize = 15;
    ring.endSize = 120 * intensity;
    ring.size = 15;
    ring.color = colors.primary;
    ring.startAlpha = 0.6;
    ring.endAlpha = 0;
    ring.shape = 'ring';
    this.particles.push(ring);
  }

  /**
   * Kinetic Burst - green kinetic energy explosion
   */
  public spawnKineticBurst(x: number, y: number, intensity: number = 1) {
    const colors = CLASS_VFX_COLORS.natural;

    // Screen shake
    this.triggerScreenShake(10 * intensity, 350);

    // Massive green flash
    this.spawnFlash(x, y, 0xffffff, 50 * intensity);
    this.spawnFlash(x, y, colors.glow, 80 * intensity);

    // Kinetic energy rings
    for (let i = 0; i < 4; i++) {
      const ring = this.pool.acquire();
      ring.x = x;
      ring.y = y;
      ring.vx = 0;
      ring.vy = 0;
      ring.life = 0.5 + i * 0.12;
      ring.maxLife = ring.life;
      ring.startSize = 10 + i * 10;
      ring.endSize = 150 + i * 40;
      ring.size = ring.startSize;
      ring.color = i % 2 === 0 ? colors.glow : colors.primary;
      ring.startAlpha = 0.7 - i * 0.1;
      ring.endAlpha = 0;
      ring.shape = 'ring';
      this.particles.push(ring);
    }

    // Kinetic particles radiating
    for (let i = 0; i < 35 * intensity; i++) {
      const angle = (Math.PI * 2 * i) / 35;
      const speed = 150 + Math.random() * 150;
      const p = this.pool.acquire();
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = 0.5 + Math.random() * 0.3;
      p.maxLife = p.life;
      p.size = 5 + Math.random() * 5;
      p.color = Math.random() > 0.3 ? colors.glow : 0xffffff;
      p.shape = Math.random() > 0.5 ? 'circle' : 'star';
      p.rotation = Math.random() * Math.PI;
      p.drag = 0.95;
      this.particles.push(p);
    }

    // Green lightning arcs
    for (let i = 0; i < 6; i++) {
      const arcAngle = (Math.PI * 2 * i) / 6;
      const arcLen = 80 + Math.random() * 50;
      for (let j = 0; j < 5; j++) {
        const arc = this.pool.acquire();
        arc.x = x + Math.cos(arcAngle) * arcLen * (j / 5) + (Math.random() - 0.5) * 15;
        arc.y = y + Math.sin(arcAngle) * arcLen * (j / 5) + (Math.random() - 0.5) * 15;
        arc.vx = (Math.random() - 0.5) * 50;
        arc.vy = (Math.random() - 0.5) * 50;
        arc.life = 0.2;
        arc.maxLife = 0.2;
        arc.size = 4 * (1 - j / 5);
        arc.color = colors.glow;
        arc.shape = 'spark';
        this.particles.push(arc);
      }
    }
  }

  /**
   * Worldbreaker Ultimate - massive destruction
   */
  public spawnWorldbreaker(x: number, y: number) {
    // Massive screen shake
    this.triggerScreenShake(15, 600);

    // Multiple ground smashes
    this.spawnGroundSmash(x, y, 1.5);

    // Kinetic burst overlay
    setTimeout(() => {
      this.spawnKineticBurst(x, y, 1.3);
    }, 150);

    // Additional debris waves
    for (let wave = 0; wave < 3; wave++) {
      setTimeout(() => {
        for (let i = 0; i < 15; i++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = 30 + wave * 40;
          const debris = this.pool.acquire();
          debris.x = x + Math.cos(angle) * dist;
          debris.y = y + Math.sin(angle) * dist * 0.3;
          debris.vx = Math.cos(angle) * 60;
          debris.vy = -100 - Math.random() * 80;
          debris.life = 0.8;
          debris.maxLife = 0.8;
          debris.size = 6 + Math.random() * 8;
          debris.color = 0x654321;
          debris.shape = 'square';
          debris.rotation = Math.random() * Math.PI;
          debris.rotationSpeed = (Math.random() - 0.5) * 8;
          debris.gravity = 250;
          this.particles.push(debris);
        }
      }, wave * 100);
    }
  }

  // --- UNIT-0 "VANGUARD" - NATURAL CLASS ---

  /**
   * Shield Throw - spinning shield bouncing between enemies
   */
  public spawnShieldThrow(points: { x: number; y: number }[]) {
    if (points.length < 2) return;

    const shieldColors = { red: 0xdc143c, white: 0xffffff, blue: 0x4169e1 };

    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i];
      const end = points[i + 1];
      const dist = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2);
      const steps = Math.floor(dist / 10);

      for (let j = 0; j < steps; j++) {
        const progress = j / steps;
        const x = start.x + (end.x - start.x) * progress;
        const y = start.y + (end.y - start.y) * progress;
        const rotation = progress * Math.PI * 6 + i * Math.PI * 2;

        // Shield outer ring (red)
        const outer = this.pool.acquire();
        outer.x = x;
        outer.y = y;
        outer.vx = 0;
        outer.vy = 0;
        outer.life = 0.2;
        outer.maxLife = 0.2;
        outer.size = 15;
        outer.color = shieldColors.red;
        outer.shape = 'ring';
        outer.rotation = rotation;
        this.particles.push(outer);

        // White ring
        const white = this.pool.acquire();
        white.x = x;
        white.y = y;
        white.vx = 0;
        white.vy = 0;
        white.life = 0.2;
        white.maxLife = 0.2;
        white.size = 10;
        white.color = shieldColors.white;
        white.shape = 'circle';
        this.particles.push(white);

        // Blue center
        const blue = this.pool.acquire();
        blue.x = x;
        blue.y = y;
        blue.vx = 0;
        blue.vy = 0;
        blue.life = 0.2;
        blue.maxLife = 0.2;
        blue.size = 5;
        blue.color = shieldColors.blue;
        blue.shape = 'circle';
        this.particles.push(blue);

        // Star in center
        const star = this.pool.acquire();
        star.x = x;
        star.y = y;
        star.vx = 0;
        star.vy = 0;
        star.life = 0.2;
        star.maxLife = 0.2;
        star.size = 4;
        star.color = shieldColors.white;
        star.shape = 'star';
        star.rotation = rotation;
        this.particles.push(star);

        // Motion trail
        if (j % 2 === 0) {
          const trail = this.pool.acquire();
          trail.x = x;
          trail.y = y;
          trail.vx = (Math.random() - 0.5) * 20;
          trail.vy = (Math.random() - 0.5) * 20;
          trail.life = 0.15;
          trail.maxLife = 0.15;
          trail.size = 3;
          trail.color = shieldColors.white;
          trail.startAlpha = 0.5;
          trail.endAlpha = 0;
          trail.shape = 'circle';
          this.particles.push(trail);
        }
      }

      // Impact flash at each bounce point
      this.spawnFlash(end.x, end.y, shieldColors.white, 20);

      // Metal clang sparks
      for (let s = 0; s < 8; s++) {
        const angle = Math.random() * Math.PI * 2;
        const spark = this.pool.acquire();
        spark.x = end.x;
        spark.y = end.y;
        spark.vx = Math.cos(angle) * 80;
        spark.vy = Math.sin(angle) * 80;
        spark.life = 0.2;
        spark.maxLife = 0.2;
        spark.size = 2;
        spark.color = 0xffffcc;
        spark.shape = 'spark';
        this.particles.push(spark);
      }
    }
  }

  /**
   * Rally Ultimate - buff all units
   */
  public spawnRallyUltimate(x: number, y: number, heroPositions: { x: number; y: number }[]) {
    const colors = { gold: 0xffd700, white: 0xffffff, blue: 0x4169e1 };

    // Central burst from Vanguard
    this.spawnFlash(x, y, colors.gold, 60);
    this.triggerScreenShake(6, 300);

    // Expanding golden ring
    for (let i = 0; i < 3; i++) {
      const ring = this.pool.acquire();
      ring.x = x;
      ring.y = y;
      ring.vx = 0;
      ring.vy = 0;
      ring.life = 0.8 + i * 0.2;
      ring.maxLife = ring.life;
      ring.startSize = 20;
      ring.endSize = 250 + i * 50;
      ring.size = 20;
      ring.color = i === 0 ? colors.white : colors.gold;
      ring.startAlpha = 0.8 - i * 0.2;
      ring.endAlpha = 0;
      ring.shape = 'ring';
      this.particles.push(ring);
    }

    // Star burst
    for (let i = 0; i < 20; i++) {
      const angle = (Math.PI * 2 * i) / 20;
      const star = this.pool.acquire();
      star.x = x;
      star.y = y;
      star.vx = Math.cos(angle) * 120;
      star.vy = Math.sin(angle) * 120;
      star.life = 0.6;
      star.maxLife = 0.6;
      star.size = 8;
      star.color = colors.gold;
      star.shape = 'star';
      star.rotation = angle;
      star.rotationSpeed = 5;
      star.drag = 0.95;
      this.particles.push(star);
    }

    // Connect to each hero with golden beam
    for (const hero of heroPositions) {
      const dist = Math.sqrt((hero.x - x) ** 2 + (hero.y - y) ** 2);
      const angle = Math.atan2(hero.y - y, hero.x - x);
      const steps = Math.floor(dist / 15);

      for (let j = 0; j < steps; j++) {
        const progress = j / steps;
        const bx = x + Math.cos(angle) * dist * progress;
        const by = y + Math.sin(angle) * dist * progress;

        const beam = this.pool.acquire();
        beam.x = bx;
        beam.y = by;
        beam.vx = 0;
        beam.vy = 0;
        beam.life = 0.4;
        beam.maxLife = 0.4;
        beam.size = 6 * (1 - progress * 0.5);
        beam.color = colors.gold;
        beam.startAlpha = 0.8;
        beam.endAlpha = 0;
        beam.shape = 'circle';
        this.particles.push(beam);
      }

      // Buff aura at each hero
      this.spawnHealEffect(hero.x, hero.y, 'buff');
    }
  }

  // --- UNIT-9 "RIFT" - FIRE CLASS ---

  /**
   * Plasma Bolt - high-temperature plasma projectile
   */
  public spawnPlasmaBolt(startX: number, startY: number, targetX: number, targetY: number) {
    const colors = { primary: 0xdc143c, secondary: 0xff69b4, dark: 0x8b0000 };
    const angle = Math.atan2(targetY - startY, targetX - startX);
    const dist = Math.sqrt((targetX - startX) ** 2 + (targetY - startY) ** 2);

    // Casting effect at source
    for (let i = 0; i < 10; i++) {
      const castAngle = Math.random() * Math.PI * 2;
      const cast = this.pool.acquire();
      cast.x = startX + Math.cos(castAngle) * 20;
      cast.y = startY + Math.sin(castAngle) * 20;
      cast.vx = -Math.cos(castAngle) * 50;
      cast.vy = -Math.sin(castAngle) * 50;
      cast.life = 0.3;
      cast.maxLife = 0.3;
      cast.size = 4;
      cast.color = colors.secondary;
      cast.shape = 'diamond';
      cast.rotation = Math.random() * Math.PI;
      cast.rotationSpeed = 5;
      this.particles.push(cast);
    }

    // Plasma bolt path
    const steps = Math.floor(dist / 10);
    for (let i = 0; i < steps; i++) {
      const progress = i / steps;
      const wobble = Math.sin(progress * Math.PI * 4) * 10;
      const perpAngle = angle + Math.PI / 2;
      const x = startX + Math.cos(angle) * dist * progress + Math.cos(perpAngle) * wobble;
      const y = startY + Math.sin(angle) * dist * progress + Math.sin(perpAngle) * wobble;

      // Core plasma energy
      const hex = this.pool.acquire();
      hex.x = x;
      hex.y = y;
      hex.vx = 0;
      hex.vy = 0;
      hex.life = 0.25;
      hex.maxLife = 0.25;
      hex.size = 10 * (1 - progress * 0.3);
      hex.color = colors.primary;
      hex.shape = 'circle';
      this.particles.push(hex);

      // Swirling chaos particles
      if (i % 2 === 0) {
        const swirl1 = this.pool.acquire();
        swirl1.x = x + Math.cos(progress * Math.PI * 8) * 15;
        swirl1.y = y + Math.sin(progress * Math.PI * 8) * 15;
        swirl1.vx = (Math.random() - 0.5) * 40;
        swirl1.vy = (Math.random() - 0.5) * 40;
        swirl1.life = 0.2;
        swirl1.maxLife = 0.2;
        swirl1.size = 4;
        swirl1.color = colors.secondary;
        swirl1.shape = 'diamond';
        swirl1.rotation = Math.random() * Math.PI;
        swirl1.rotationSpeed = 8;
        this.particles.push(swirl1);
      }

      // Dark energy trail
      const dark = this.pool.acquire();
      dark.x = x;
      dark.y = y;
      dark.vx = 0;
      dark.vy = 0;
      dark.life = 0.3;
      dark.maxLife = 0.3;
      dark.size = 15;
      dark.color = colors.dark;
      dark.startAlpha = 0.3;
      dark.endAlpha = 0;
      dark.shape = 'circle';
      this.particles.push(dark);
    }

    // Impact
    this.spawnThermalImpact(targetX, targetY, 1);
  }

  /**
   * Thermal Impact - high-temperature explosion
   */
  public spawnThermalImpact(x: number, y: number, intensity: number = 1) {
    const colors = { primary: 0xdc143c, secondary: 0xff69b4, dark: 0x8b0000 };

    // Flash
    this.spawnFlash(x, y, colors.secondary, 30 * intensity);

    // Thermal rings - distorted
    for (let i = 0; i < 3; i++) {
      const ring = this.pool.acquire();
      ring.x = x + (Math.random() - 0.5) * 10;
      ring.y = y + (Math.random() - 0.5) * 10;
      ring.vx = 0;
      ring.vy = 0;
      ring.life = 0.4 + i * 0.1;
      ring.maxLife = ring.life;
      ring.startSize = 10;
      ring.endSize = 70 + i * 20;
      ring.size = 10;
      ring.color = i % 2 === 0 ? colors.primary : colors.secondary;
      ring.startAlpha = 0.7;
      ring.endAlpha = 0;
      ring.shape = 'ring';
      this.particles.push(ring);
    }

    // Thermal particles
    for (let i = 0; i < 20 * intensity; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 80;
      const chaos = this.pool.acquire();
      chaos.x = x;
      chaos.y = y;
      chaos.vx = Math.cos(angle) * speed;
      chaos.vy = Math.sin(angle) * speed;
      chaos.life = 0.4 + Math.random() * 0.2;
      chaos.maxLife = chaos.life;
      chaos.size = 4 + Math.random() * 4;
      chaos.color = Math.random() > 0.5 ? colors.primary : colors.secondary;
      chaos.shape = 'diamond';
      chaos.rotation = Math.random() * Math.PI;
      chaos.rotationSpeed = (Math.random() - 0.5) * 10;
      chaos.drag = 0.94;
      this.particles.push(chaos);
    }
  }

  /**
   * No More Enemies Ultimate - reality warp
   */
  public spawnRealityWarp(x: number, y: number) {
    const colors = { primary: 0xdc143c, secondary: 0xff69b4, dark: 0x8b0000 };

    // Massive screen shake
    this.triggerScreenShake(12, 500);

    // Central chaos explosion
    this.spawnFlash(x, y, 0xffffff, 80);
    this.spawnFlash(x, y, colors.primary, 120);

    // Reality fracture lines
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12;
      const len = 150 + Math.random() * 80;

      for (let j = 0; j < 10; j++) {
        const progress = j / 10;
        const jitter = (Math.random() - 0.5) * 20;
        const fx = x + Math.cos(angle) * len * progress + Math.cos(angle + Math.PI / 2) * jitter;
        const fy = y + Math.sin(angle) * len * progress + Math.sin(angle + Math.PI / 2) * jitter;

        const frac = this.pool.acquire();
        frac.x = fx;
        frac.y = fy;
        frac.vx = Math.cos(angle) * 30;
        frac.vy = Math.sin(angle) * 30;
        frac.life = 0.5 - progress * 0.2;
        frac.maxLife = 0.5;
        frac.size = 6 * (1 - progress * 0.5);
        frac.color = colors.primary;
        frac.shape = 'spark';
        this.particles.push(frac);
      }
    }

    // Massive chaos rings
    for (let i = 0; i < 5; i++) {
      const ring = this.pool.acquire();
      ring.x = x;
      ring.y = y;
      ring.vx = 0;
      ring.vy = 0;
      ring.life = 0.8 + i * 0.15;
      ring.maxLife = ring.life;
      ring.startSize = 20 + i * 15;
      ring.endSize = 250 + i * 40;
      ring.size = ring.startSize;
      ring.color = i % 2 === 0 ? colors.primary : colors.secondary;
      ring.startAlpha = 0.8 - i * 0.1;
      ring.endAlpha = 0;
      ring.shape = 'ring';
      this.particles.push(ring);
    }

    // Swirling plasma orbs
    for (let i = 0; i < 30; i++) {
      const orbitAngle = Math.random() * Math.PI * 2;
      const orbitDist = 50 + Math.random() * 100;
      const hex = this.pool.acquire();
      hex.x = x + Math.cos(orbitAngle) * orbitDist;
      hex.y = y + Math.sin(orbitAngle) * orbitDist;
      hex.vx = Math.cos(orbitAngle + Math.PI / 2) * 80;
      hex.vy = Math.sin(orbitAngle + Math.PI / 2) * 80;
      hex.life = 0.8;
      hex.maxLife = 0.8;
      hex.size = 8 + Math.random() * 6;
      hex.color = Math.random() > 0.3 ? colors.secondary : colors.primary;
      hex.shape = 'star';
      hex.rotation = Math.random() * Math.PI;
      hex.rotationSpeed = 8;
      hex.drag = 0.96;
      this.particles.push(hex);
    }
  }

  // --- UNIT-5 "FROST" - ICE CLASS ---

  /**
   * Frost Arrow - ice arrow with freezing trail
   */
  public spawnFrostArrow(startX: number, startY: number, targetX: number, targetY: number) {
    const colors = CLASS_VFX_COLORS.ice;
    const angle = Math.atan2(targetY - startY, targetX - startX);
    const dist = Math.sqrt((targetX - startX) ** 2 + (targetY - startY) ** 2);

    // Arrow path
    const steps = Math.floor(dist / 8);
    for (let i = 0; i < steps; i++) {
      const progress = i / steps;
      const x = startX + Math.cos(angle) * dist * progress;
      const y = startY + Math.sin(angle) * dist * progress;

      // Arrow head
      const arrow = this.pool.acquire();
      arrow.x = x;
      arrow.y = y;
      arrow.vx = 0;
      arrow.vy = 0;
      arrow.life = 0.15;
      arrow.maxLife = 0.15;
      arrow.size = 8 * (1 - progress * 0.3);
      arrow.color = colors.primary;
      arrow.shape = 'spark';
      this.particles.push(arrow);

      // Ice trail
      if (i % 2 === 0) {
        const ice = this.pool.acquire();
        ice.x = x + (Math.random() - 0.5) * 10;
        ice.y = y + (Math.random() - 0.5) * 10;
        ice.vx = (Math.random() - 0.5) * 20;
        ice.vy = Math.random() * 20 + 10; // Fall down
        ice.life = 0.4;
        ice.maxLife = 0.4;
        ice.size = 3 + Math.random() * 3;
        ice.color = colors.glow;
        ice.shape = 'diamond';
        ice.rotation = Math.random() * Math.PI;
        ice.rotationSpeed = 3;
        this.particles.push(ice);
      }

      // Frost particles
      const frost = this.pool.acquire();
      frost.x = x;
      frost.y = y;
      frost.vx = 0;
      frost.vy = 0;
      frost.life = 0.2;
      frost.maxLife = 0.2;
      frost.size = 12;
      frost.color = colors.glow;
      frost.startAlpha = 0.3;
      frost.endAlpha = 0;
      frost.shape = 'circle';
      this.particles.push(frost);
    }

    // Freeze impact
    this.spawnFreezeImpact(targetX, targetY, 1);
  }

  /**
   * Freeze Impact - ice crystals forming
   */
  public spawnFreezeImpact(x: number, y: number, intensity: number = 1) {
    const colors = CLASS_VFX_COLORS.ice;

    // Flash
    this.spawnFlash(x, y, colors.glow, 25 * intensity);

    // Ice crystals forming
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const crystal = this.pool.acquire();
      crystal.x = x + Math.cos(angle) * 5;
      crystal.y = y + Math.sin(angle) * 5;
      crystal.vx = Math.cos(angle) * 40;
      crystal.vy = Math.sin(angle) * 40;
      crystal.life = 0.5;
      crystal.maxLife = 0.5;
      crystal.startSize = 3;
      crystal.endSize = 12 * intensity;
      crystal.size = 3;
      crystal.color = colors.primary;
      crystal.shape = 'diamond';
      crystal.rotation = angle;
      crystal.drag = 0.9;
      this.particles.push(crystal);
    }

    // Frost ring
    const ring = this.pool.acquire();
    ring.x = x;
    ring.y = y;
    ring.vx = 0;
    ring.vy = 0;
    ring.life = 0.4;
    ring.maxLife = 0.4;
    ring.startSize = 10;
    ring.endSize = 60 * intensity;
    ring.size = 10;
    ring.color = colors.secondary;
    ring.startAlpha = 0.6;
    ring.endAlpha = 0;
    ring.shape = 'ring';
    this.particles.push(ring);

    // Snow particles
    for (let i = 0; i < 15 * intensity; i++) {
      const snow = this.pool.acquire();
      snow.x = x + (Math.random() - 0.5) * 40;
      snow.y = y + (Math.random() - 0.5) * 40;
      snow.vx = (Math.random() - 0.5) * 30;
      snow.vy = 20 + Math.random() * 30;
      snow.life = 0.6;
      snow.maxLife = 0.6;
      snow.size = 2 + Math.random() * 2;
      snow.color = 0xffffff;
      snow.startAlpha = 0.8;
      snow.endAlpha = 0;
      snow.shape = 'circle';
      this.particles.push(snow);
    }
  }

  /**
   * Multi-Shot - multiple arrows
   */
  public spawnMultiShot(startX: number, startY: number, targets: { x: number; y: number }[]) {
    for (const target of targets) {
      this.spawnFrostArrow(startX, startY, target.x, target.y);
    }
  }

  /**
   * Blizzard Barrage Ultimate - ice storm
   */
  public spawnBlizzardBarrage(x: number, y: number, radius: number = 150) {
    const colors = CLASS_VFX_COLORS.ice;

    // Screen shake
    this.triggerScreenShake(8, 400);

    // Central flash
    this.spawnFlash(x, y, colors.glow, 50);

    // Ice rings expanding
    for (let i = 0; i < 4; i++) {
      const ring = this.pool.acquire();
      ring.x = x;
      ring.y = y;
      ring.vx = 0;
      ring.vy = 0;
      ring.life = 0.6 + i * 0.15;
      ring.maxLife = ring.life;
      ring.startSize = 20 + i * 10;
      ring.endSize = radius + i * 30;
      ring.size = ring.startSize;
      ring.color = i % 2 === 0 ? colors.primary : colors.glow;
      ring.startAlpha = 0.7 - i * 0.1;
      ring.endAlpha = 0;
      ring.shape = 'ring';
      this.particles.push(ring);
    }

    // Massive snowfall
    for (let i = 0; i < 60; i++) {
      const snowX = x + (Math.random() - 0.5) * radius * 2;
      const snowY = y - 100 - Math.random() * 100;
      const snow = this.pool.acquire();
      snow.x = snowX;
      snow.y = snowY;
      snow.vx = (Math.random() - 0.5) * 40;
      snow.vy = 80 + Math.random() * 60;
      snow.life = 1.0 + Math.random() * 0.5;
      snow.maxLife = snow.life;
      snow.size = 2 + Math.random() * 3;
      snow.color = 0xffffff;
      snow.startAlpha = 0.9;
      snow.endAlpha = 0;
      snow.shape = 'circle';
      this.particles.push(snow);
    }

    // Ice spikes from ground
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12;
      const dist = 30 + Math.random() * (radius - 30);
      const spikeX = x + Math.cos(angle) * dist;
      const spikeY = y + Math.sin(angle) * dist * 0.3;

      // Spike
      const spike = this.pool.acquire();
      spike.x = spikeX;
      spike.y = spikeY;
      spike.vx = 0;
      spike.vy = -60 - Math.random() * 40;
      spike.life = 0.5;
      spike.maxLife = 0.5;
      spike.startSize = 5;
      spike.endSize = 15;
      spike.size = 5;
      spike.color = colors.primary;
      spike.shape = 'diamond';
      spike.rotation = -Math.PI / 2;
      spike.drag = 0.95;
      this.particles.push(spike);

      // Spike shatter
      setTimeout(() => {
        for (let j = 0; j < 5; j++) {
          const shard = this.pool.acquire();
          shard.x = spikeX;
          shard.y = spikeY - 20;
          shard.vx = (Math.random() - 0.5) * 80;
          shard.vy = -30 - Math.random() * 50;
          shard.life = 0.4;
          shard.maxLife = 0.4;
          shard.size = 3 + Math.random() * 3;
          shard.color = colors.glow;
          shard.shape = 'diamond';
          shard.rotation = Math.random() * Math.PI;
          shard.rotationSpeed = 5;
          shard.gravity = 150;
          this.particles.push(shard);
        }
      }, 300 + i * 50);
    }

    // Freeze effect on entire area
    const freezeCloud = this.pool.acquire();
    freezeCloud.x = x;
    freezeCloud.y = y;
    freezeCloud.vx = 0;
    freezeCloud.vy = 0;
    freezeCloud.life = 1.0;
    freezeCloud.maxLife = 1.0;
    freezeCloud.startSize = radius * 0.5;
    freezeCloud.endSize = radius;
    freezeCloud.size = radius * 0.5;
    freezeCloud.color = colors.glow;
    freezeCloud.startAlpha = 0.3;
    freezeCloud.endAlpha = 0;
    freezeCloud.shape = 'circle';
    this.particles.push(freezeCloud);
  }

  // ============================================================
  // UNIT-4 "SPECTRE" - PLASMA CLASS (EXCLUSIVE)
  // ============================================================

  /**
   * Spectre's Plasma Burst - focused energy blast
   */
  public spawnPlasmaBurst(x: number, y: number, targetX: number, targetY: number) {
    const colors = CLASS_VFX_COLORS.plasma;

    // Calculate distance
    const dist = Math.sqrt((targetX - x) ** 2 + (targetY - y) ** 2);

    // Charging effect at source
    for (let i = 0; i < 15; i++) {
      const chargeAngle = (Math.PI * 2 * i) / 15;
      const chargeDist = 30 + Math.random() * 20;
      const p = this.pool.acquire();
      p.x = x + Math.cos(chargeAngle) * chargeDist;
      p.y = y + Math.sin(chargeAngle) * chargeDist;
      p.vx = -Math.cos(chargeAngle) * 150;
      p.vy = -Math.sin(chargeAngle) * 150;
      p.life = 0.2;
      p.maxLife = 0.2;
      p.size = 3 + Math.random() * 2;
      p.color = i % 2 === 0 ? colors.primary : colors.secondary;
      p.shape = 'circle';
      p.startAlpha = 0.8;
      p.endAlpha = 0;
      this.particles.push(p);
    }

    // Main beam trail
    const steps = Math.floor(dist / 10);
    for (let i = 0; i < steps; i++) {
      const progress = i / steps;
      const beamX = x + (targetX - x) * progress;
      const beamY = y + (targetY - y) * progress;
      const delay = i * 0.01;

      // Core beam particle
      const core = this.pool.acquire();
      core.x = beamX;
      core.y = beamY;
      core.vx = (Math.random() - 0.5) * 20;
      core.vy = (Math.random() - 0.5) * 20;
      core.life = 0.3 - delay;
      core.maxLife = 0.3;
      core.size = 6 - progress * 2;
      core.color = 0xffffff;
      core.shape = 'circle';
      core.startAlpha = 1.0;
      core.endAlpha = 0;
      this.particles.push(core);

      // Plasma glow
      const glow = this.pool.acquire();
      glow.x = beamX + (Math.random() - 0.5) * 10;
      glow.y = beamY + (Math.random() - 0.5) * 10;
      glow.vx = (Math.random() - 0.5) * 40;
      glow.vy = (Math.random() - 0.5) * 40;
      glow.life = 0.25 - delay;
      glow.maxLife = 0.25;
      glow.size = 4 + Math.random() * 3;
      glow.color = colors.primary;
      glow.shape = 'circle';
      glow.startAlpha = 0.7;
      glow.endAlpha = 0;
      this.particles.push(glow);

      // Secondary plasma (magenta)
      if (i % 3 === 0) {
        const secondary = this.pool.acquire();
        secondary.x = beamX + (Math.random() - 0.5) * 15;
        secondary.y = beamY + (Math.random() - 0.5) * 15;
        secondary.vx = (Math.random() - 0.5) * 60;
        secondary.vy = (Math.random() - 0.5) * 60;
        secondary.life = 0.2;
        secondary.maxLife = 0.2;
        secondary.size = 3;
        secondary.color = colors.secondary;
        secondary.shape = 'spark';
        this.particles.push(secondary);
      }
    }

    // Impact explosion at target
    setTimeout(() => {
      this.spawnPlasmaImpact(targetX, targetY);
    }, steps * 10);

    // Source flash
    this.spawnFlash(x, y, colors.primary, 25);
  }

  /**
   * Plasma impact explosion
   */
  public spawnPlasmaImpact(x: number, y: number) {
    const colors = CLASS_VFX_COLORS.plasma;

    // Central flash
    this.spawnFlash(x, y, colors.glow, 35);

    // Expanding plasma rings
    for (let i = 0; i < 3; i++) {
      const ring = this.pool.acquire();
      ring.x = x;
      ring.y = y;
      ring.vx = 0;
      ring.vy = 0;
      ring.life = 0.4 + i * 0.1;
      ring.maxLife = ring.life;
      ring.startSize = 15;
      ring.endSize = 60 + i * 20;
      ring.size = 15;
      ring.color = i % 2 === 0 ? colors.primary : colors.secondary;
      ring.startAlpha = 0.6;
      ring.endAlpha = 0;
      ring.shape = 'ring';
      this.particles.push(ring);
    }

    // Radial plasma sparks
    for (let i = 0; i < 20; i++) {
      const angle = (Math.PI * 2 * i) / 20;
      const speed = 100 + Math.random() * 80;
      const p = this.pool.acquire();
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = 0.3 + Math.random() * 0.2;
      p.maxLife = 0.5;
      p.size = 4 + Math.random() * 3;
      p.color = Math.random() > 0.5 ? colors.primary : colors.secondary;
      p.shape = 'spark';
      p.drag = 0.93;
      this.particles.push(p);
    }

    // Screen shake
    this.triggerScreenShake(5, 150);
  }

  /**
   * Plasma glow aura effect (for passive/buff)
   */
  public spawnPlasmaGlow(x: number, y: number, intensity: number = 1) {
    const colors = CLASS_VFX_COLORS.plasma;

    // Orbiting plasma particles
    for (let i = 0; i < 4; i++) {
      const angle = (Math.PI * 2 * i) / 4 + Date.now() * 0.003;
      const dist = 15 + Math.sin(Date.now() * 0.005 + i) * 5;
      const p = this.pool.acquire();
      p.x = x + Math.cos(angle) * dist;
      p.y = y + Math.sin(angle) * dist;
      p.vx = (Math.random() - 0.5) * 20;
      p.vy = (Math.random() - 0.5) * 20 - 10;
      p.life = 0.3;
      p.maxLife = 0.3;
      p.size = (2 + Math.random() * 2) * intensity;
      p.color = i % 2 === 0 ? colors.primary : colors.secondary;
      p.shape = 'circle';
      p.startAlpha = 0.6;
      p.endAlpha = 0;
      this.particles.push(p);
    }

    // Occasional energy spark
    if (Math.random() > 0.6) {
      const spark = this.pool.acquire();
      spark.x = x + (Math.random() - 0.5) * 20;
      spark.y = y + (Math.random() - 0.5) * 20;
      spark.vx = (Math.random() - 0.5) * 80;
      spark.vy = (Math.random() - 0.5) * 80;
      spark.life = 0.15;
      spark.maxLife = 0.15;
      spark.size = 3 * intensity;
      spark.color = colors.glow;
      spark.shape = 'spark';
      this.particles.push(spark);
    }
  }

  /**
   * Stealth activation effect
   */
  public spawnStealthActivation(x: number, y: number) {
    const colors = CLASS_VFX_COLORS.plasma;

    // Fading shimmer effect
    for (let i = 0; i < 15; i++) {
      const shimmer = this.pool.acquire();
      shimmer.x = x + (Math.random() - 0.5) * 30;
      shimmer.y = y + (Math.random() - 0.5) * 40;
      shimmer.vx = (Math.random() - 0.5) * 30;
      shimmer.vy = -20 - Math.random() * 20;
      shimmer.life = 0.5 + Math.random() * 0.3;
      shimmer.maxLife = shimmer.life;
      shimmer.size = 3 + Math.random() * 4;
      shimmer.color = Math.random() > 0.5 ? colors.primary : 0xffffff;
      shimmer.shape = 'diamond';
      shimmer.startAlpha = 0.7;
      shimmer.endAlpha = 0;
      shimmer.rotation = Math.random() * Math.PI;
      shimmer.rotationSpeed = (Math.random() - 0.5) * 5;
      this.particles.push(shimmer);
    }

    // Central distortion ring
    const ring = this.pool.acquire();
    ring.x = x;
    ring.y = y;
    ring.vx = 0;
    ring.vy = 0;
    ring.life = 0.4;
    ring.maxLife = 0.4;
    ring.startSize = 40;
    ring.endSize = 10;
    ring.size = 40;
    ring.color = colors.primary;
    ring.startAlpha = 0.5;
    ring.endAlpha = 0;
    ring.shape = 'ring';
    this.particles.push(ring);
  }

  // ============================================================
  // UNIT-X "OMEGA" - VOID CLASS (LEGENDARY EXCLUSIVE)
  // ============================================================

  /**
   * Omega's Execute Strike - devastating golden slash
   */
  public spawnExecuteStrike(startX: number, startY: number, targetX: number, targetY: number) {
    const colors = { primary: 0xffd700, secondary: 0x1a1a2a, glow: 0xffaa00 };

    // Calculate direction
    const angle = Math.atan2(targetY - startY, targetX - startX);
    const perpAngle = angle + Math.PI / 2;

    // Dash trail with afterimages
    const dist = Math.sqrt((targetX - startX) ** 2 + (targetY - startY) ** 2);
    const steps = Math.floor(dist / 8);

    for (let i = 0; i < steps; i++) {
      const progress = i / steps;
      const x = startX + (targetX - startX) * progress;
      const y = startY + (targetY - startY) * progress;

      // Dark void trail
      const void_p = this.pool.acquire();
      void_p.x = x + (Math.random() - 0.5) * 10;
      void_p.y = y + (Math.random() - 0.5) * 10;
      void_p.vx = (Math.random() - 0.5) * 30;
      void_p.vy = (Math.random() - 0.5) * 30;
      void_p.life = 0.3;
      void_p.maxLife = 0.3;
      void_p.size = 8 - progress * 4;
      void_p.color = colors.secondary;
      void_p.shape = 'circle';
      void_p.startAlpha = 0.6;
      void_p.endAlpha = 0;
      this.particles.push(void_p);

      // Gold spark trail
      if (i % 2 === 0) {
        const gold = this.pool.acquire();
        gold.x = x;
        gold.y = y;
        gold.vx = Math.cos(perpAngle) * (Math.random() > 0.5 ? 1 : -1) * 50;
        gold.vy = Math.sin(perpAngle) * (Math.random() > 0.5 ? 1 : -1) * 50;
        gold.life = 0.2;
        gold.maxLife = 0.2;
        gold.size = 3;
        gold.color = colors.primary;
        gold.shape = 'spark';
        this.particles.push(gold);
      }
    }

    // Slash arc at impact
    this.spawnGoldenSlash(targetX, targetY, angle);

    // Screen shake
    this.triggerScreenShake(6, 180);
  }

  /**
   * Golden slash arc effect
   */
  public spawnGoldenSlash(x: number, y: number, angle: number) {
    const colors = { primary: 0xffd700, secondary: 0x1a1a2a, glow: 0xffaa00 };

    // Main slash arc particles
    const slashAngle = angle + Math.PI / 4;
    const slashLength = 50;

    for (let i = 0; i < 20; i++) {
      const progress = i / 20;
      const arcAngle = slashAngle - Math.PI / 3 + progress * (Math.PI * 2 / 3);
      const dist = slashLength * (0.8 + Math.sin(progress * Math.PI) * 0.4);
      const px = x + Math.cos(arcAngle) * dist;
      const py = y + Math.sin(arcAngle) * dist;

      // Golden slash particle
      const slash = this.pool.acquire();
      slash.x = px;
      slash.y = py;
      slash.vx = Math.cos(arcAngle) * 80;
      slash.vy = Math.sin(arcAngle) * 80;
      slash.life = 0.25;
      slash.maxLife = 0.25;
      slash.size = 6 - Math.abs(progress - 0.5) * 8;
      slash.color = colors.primary;
      slash.shape = 'spark';
      slash.startAlpha = 1.0;
      slash.endAlpha = 0;
      this.particles.push(slash);
    }

    // Central impact flash
    this.spawnFlash(x, y, colors.primary, 40);

    // Void particles swirling
    for (let i = 0; i < 12; i++) {
      const voidAngle = (Math.PI * 2 * i) / 12;
      const void_p = this.pool.acquire();
      void_p.x = x + Math.cos(voidAngle) * 20;
      void_p.y = y + Math.sin(voidAngle) * 20;
      void_p.vx = Math.cos(voidAngle + Math.PI / 2) * 60;
      void_p.vy = Math.sin(voidAngle + Math.PI / 2) * 60;
      void_p.life = 0.35;
      void_p.maxLife = 0.35;
      void_p.size = 4;
      void_p.color = colors.secondary;
      void_p.shape = 'circle';
      void_p.startAlpha = 0.7;
      void_p.endAlpha = 0;
      this.particles.push(void_p);
    }

    // Cross-shaped golden glint
    for (let i = 0; i < 4; i++) {
      const glintAngle = (Math.PI / 2 * i);
      const glint = this.pool.acquire();
      glint.x = x;
      glint.y = y;
      glint.vx = Math.cos(glintAngle) * 120;
      glint.vy = Math.sin(glintAngle) * 120;
      glint.life = 0.15;
      glint.maxLife = 0.15;
      glint.size = 4;
      glint.color = 0xffffff;
      glint.shape = 'spark';
      this.particles.push(glint);
    }
  }

  /**
   * Gold sparks aura effect (for passive/crit)
   */
  public spawnGoldSparks(x: number, y: number, intensity: number = 1) {
    const colors = { primary: 0xffd700, secondary: 0x1a1a2a, glow: 0xffaa00 };

    // Rising gold sparks
    for (let i = 0; i < 3; i++) {
      const spark = this.pool.acquire();
      spark.x = x + (Math.random() - 0.5) * 25;
      spark.y = y + (Math.random() - 0.5) * 15;
      spark.vx = (Math.random() - 0.5) * 40;
      spark.vy = -50 - Math.random() * 30;
      spark.life = 0.4 + Math.random() * 0.2;
      spark.maxLife = spark.life;
      spark.size = (2 + Math.random() * 2) * intensity;
      spark.color = Math.random() > 0.3 ? colors.primary : colors.glow;
      spark.shape = 'spark';
      spark.gravity = -20;
      spark.startAlpha = 0.9;
      spark.endAlpha = 0;
      this.particles.push(spark);
    }

    // Dark void wisps
    if (Math.random() > 0.5) {
      const wisp = this.pool.acquire();
      wisp.x = x + (Math.random() - 0.5) * 20;
      wisp.y = y;
      wisp.vx = (Math.random() - 0.5) * 20;
      wisp.vy = -30;
      wisp.life = 0.3;
      wisp.maxLife = 0.3;
      wisp.size = 5 * intensity;
      wisp.color = colors.secondary;
      wisp.shape = 'circle';
      wisp.startAlpha = 0.4;
      wisp.endAlpha = 0;
      this.particles.push(wisp);
    }
  }

  /**
   * Omega critical hit - enhanced crit with gold explosion
   */
  public spawnOmegaCritical(x: number, y: number) {
    const colors = { primary: 0xffd700, secondary: 0x1a1a2a, glow: 0xffaa00 };

    // Large golden flash
    this.spawnFlash(x, y, colors.primary, 45);

    // Void explosion ring
    const voidRing = this.pool.acquire();
    voidRing.x = x;
    voidRing.y = y;
    voidRing.vx = 0;
    voidRing.vy = 0;
    voidRing.life = 0.3;
    voidRing.maxLife = 0.3;
    voidRing.startSize = 10;
    voidRing.endSize = 80;
    voidRing.size = 10;
    voidRing.color = colors.secondary;
    voidRing.startAlpha = 0.5;
    voidRing.endAlpha = 0;
    voidRing.shape = 'ring';
    this.particles.push(voidRing);

    // Radial gold sparks
    for (let i = 0; i < 16; i++) {
      const angle = (Math.PI * 2 * i) / 16;
      const spark = this.pool.acquire();
      spark.x = x;
      spark.y = y;
      spark.vx = Math.cos(angle) * 180;
      spark.vy = Math.sin(angle) * 180;
      spark.life = 0.25;
      spark.maxLife = 0.25;
      spark.size = 5;
      spark.color = colors.primary;
      spark.shape = 'spark';
      spark.drag = 0.92;
      this.particles.push(spark);
    }

    // Golden star burst
    const star = this.pool.acquire();
    star.x = x;
    star.y = y;
    star.vx = 0;
    star.vy = 0;
    star.life = 0.2;
    star.maxLife = 0.2;
    star.startSize = 8;
    star.endSize = 35;
    star.size = 8;
    star.color = colors.primary;
    star.shape = 'star';
    star.rotation = 0;
    star.rotationSpeed = 15;
    this.particles.push(star);

    // Heal effect (Lethal Precision restores HP on crit)
    setTimeout(() => {
      this.spawnHealEffect(x, y, 'heal');
    }, 150);

    // Strong screen shake
    this.triggerScreenShake(8, 200);
  }

  /**
   * Execute bonus damage indicator (when target < 30% HP)
   */
  public spawnExecuteBonus(x: number, y: number) {
    const colors = { primary: 0xffd700, secondary: 0xff0000, glow: 0xffaa00 };

    // Red/gold warning flash
    this.spawnFlash(x, y, colors.secondary, 30);

    // Skull-like warning particles (X shape)
    for (let i = 0; i < 8; i++) {
      const isX = i < 4;
      const angle = isX
        ? Math.PI / 4 + (i % 2) * Math.PI / 2 + Math.floor(i / 2) * Math.PI
        : Math.PI / 4 * (2 * (i - 4) + 1);
      const p = this.pool.acquire();
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * 100;
      p.vy = Math.sin(angle) * 100;
      p.life = 0.3;
      p.maxLife = 0.3;
      p.size = 6;
      p.color = i % 2 === 0 ? colors.primary : colors.secondary;
      p.shape = 'spark';
      p.drag = 0.9;
      this.particles.push(p);
    }

    // "EXECUTE" text effect (rising particles in pattern)
    for (let i = 0; i < 10; i++) {
      const execP = this.pool.acquire();
      execP.x = x + (Math.random() - 0.5) * 40;
      execP.y = y;
      execP.vx = 0;
      execP.vy = -80 - Math.random() * 40;
      execP.life = 0.5;
      execP.maxLife = 0.5;
      execP.size = 3;
      execP.color = colors.primary;
      execP.shape = 'diamond';
      execP.startAlpha = 1.0;
      execP.endAlpha = 0;
      this.particles.push(execP);
    }
  }
}
