import type { Particle, StagedEffect, ClassColors, FortressClass } from '../types.js';
import { ParticleFactory } from '../particleFactory.js';
import type { ParticlePool } from '../particlePool.js';
import type { TimeoutRegistry } from '../timeoutRegistry.js';
import { CLASS_VFX_COLORS, CLASS_EXPLOSION_CONFIG } from '../config.js';
import { filterManager } from '../../../effects/FilterManager.js';

/**
 * Explosion and impact effect handlers.
 * Manages staged explosions, class-specific impacts, and shockwaves.
 */
export class ExplosionEffects {
  constructor(
    private pool: ParticlePool,
    private particles: Particle[],
    private factory: ParticleFactory,
    private triggerScreenShake: (intensity: number, duration: number) => void,
    private triggerLightingFlash: (x: number, y: number, color: number, radius: number) => void,
    private timeoutRegistry: TimeoutRegistry
  ) {}

  /**
   * Basic explosion with uniform particles
   */
  spawnExplosion(x: number, y: number, color: number, particleMultiplier: number): void {
    const count = Math.floor(12 * particleMultiplier);

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
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
   * Enhanced multi-stage explosion with class-specific effects
   */
  queueEnhancedExplosion(
    x: number,
    y: number,
    fortressClass: FortressClass,
    intensity: number,
    stagedEffects: StagedEffect[]
  ): void {
    stagedEffects.push({
      x,
      y,
      fortressClass,
      intensity,
      elapsed: 0,
      stages: [],
      kind: 'staggered',
    });

    // Trigger screen shake for large explosions
    if (intensity >= 1) {
      this.triggerScreenShake(3 * intensity, 150);
    }

    // Apply filter effects for dramatic explosions
    if (intensity >= 1.5) {
      filterManager.applyScreenShockwave(x, y, 800);
    }
    if (intensity >= 1) {
      const flashColor = fortressClass === 'fire' ? 'yellow' :
                        fortressClass === 'ice' ? 'white' :
                        fortressClass === 'lightning' ? 'white' : 'white';
      filterManager.applyScreenFlash(flashColor, 150, 0.3 * intensity);
    }
  }

  /**
   * Process staged effects during update loop
   */
  updateStagedEffects(dt: number, stagedEffects: StagedEffect[], particleMultiplier: number): void {
    for (let i = stagedEffects.length - 1; i >= 0; i--) {
      const effect = stagedEffects[i];
      effect.elapsed += dt * 1000;

      const colors = CLASS_VFX_COLORS[effect.fortressClass];
      const config = CLASS_EXPLOSION_CONFIG[effect.fortressClass];

      if (effect.kind === 'staggered') {
        // Stage 1: Explosion burst (0ms)
        if (!effect.stages.includes(1) && effect.elapsed >= 0) {
          effect.stages.push(1);
          this.spawnExplosionBurst(effect.x, effect.y, colors, effect.intensity, config, particleMultiplier);
        }

        // Stage 2: Fire plume (80ms)
        if (!effect.stages.includes(2) && effect.elapsed >= 80) {
          effect.stages.push(2);
          this.spawnFirePlume(effect.x, effect.y, colors, effect.intensity, effect.fortressClass, particleMultiplier);
        }

        // Stage 3: Colored smoke (160ms)
        if (!effect.stages.includes(3) && effect.elapsed >= 160) {
          effect.stages.push(3);
          this.spawnColoredSmoke(effect.x, effect.y, colors, effect.intensity, particleMultiplier);
        }

        // Stage 4: Splash burst (260ms)
        if (!effect.stages.includes(4) && effect.elapsed >= 260) {
          effect.stages.push(4);
          this.spawnSplashBurst(effect.x, effect.y, colors, effect.intensity, effect.fortressClass, particleMultiplier);
        }

        // Stage 5: Falling debris (360ms)
        if (!effect.stages.includes(5) && effect.elapsed >= 360) {
          effect.stages.push(5);
          this.spawnFallingDebris(effect.x, effect.y, colors, effect.intensity, effect.fortressClass, particleMultiplier);
        }

        // Remove completed effects
        if (effect.elapsed >= 950) {
          stagedEffects.splice(i, 1);
        }
      } else {
        // Enhanced kind - simpler staging
        if (!effect.stages.includes(1) && effect.elapsed >= 0) {
          effect.stages.push(1);
          this.factory.flash({ x: effect.x, y: effect.y, color: colors.glow, size: 25 * effect.intensity });
        }

        if (!effect.stages.includes(2) && effect.elapsed >= 0) {
          effect.stages.push(2);
          this.factory.shockwaveRings(effect.x, effect.y, colors.secondary, effect.intensity);
        }

        if (!effect.stages.includes(3) && effect.elapsed >= 0) {
          effect.stages.push(3);
          this.factory.debris(effect.x, effect.y, colors, effect.intensity, config.debrisShape, config.debrisGravity);
        }

        if (!effect.stages.includes(4) && effect.elapsed >= 100) {
          effect.stages.push(4);
          this.spawnSecondaryBurst(effect.x, effect.y, colors, effect.intensity, particleMultiplier);
        }

        if (!effect.stages.includes(5) && effect.elapsed >= 200) {
          effect.stages.push(5);
          this.factory.smoke(effect.x, effect.y, effect.intensity);
        }

        if (effect.elapsed >= 800) {
          stagedEffects.splice(i, 1);
        }
      }
    }
  }

  /**
   * Class-specific impact effect - subtle sparks without flash
   */
  spawnClassImpact(x: number, y: number, fortressClass: FortressClass, particleMultiplier: number): void {
    const colors = CLASS_VFX_COLORS[fortressClass];
    const count = Math.floor(5 * particleMultiplier);

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = 40 + Math.random() * 60;
      const p = this.pool.acquire();

      p.x = x + (Math.random() - 0.5) * 4;
      p.y = y + (Math.random() - 0.5) * 4;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = 0.12 + Math.random() * 0.1;
      p.maxLife = p.life;
      p.size = 1.5 + Math.random() * 2;
      p.color = Math.random() > 0.6 ? colors.glow : colors.primary;
      p.drag = 0.92;
      p.startAlpha = 0.8;
      p.endAlpha = 0;

      switch (fortressClass) {
        case 'ice':
          p.shape = 'diamond';
          p.rotation = Math.random() * Math.PI;
          p.rotationSpeed = 3;
          break;
        case 'lightning':
          p.shape = 'spark';
          break;
        case 'tech':
          p.shape = 'square';
          p.size *= 0.8;
          break;
        default:
          p.shape = 'circle';
      }

      this.particles.push(p);
    }
  }

  /**
   * Hit impact - subtle effect without overwhelming glow
   */
  spawnHitImpact(x: number, y: number, fortressClass: FortressClass, particleMultiplier: number): void {
    const colors = CLASS_VFX_COLORS[fortressClass];

    this.spawnClassImpact(x, y, fortressClass, particleMultiplier);

    const ring = this.pool.acquire();
    ring.x = x;
    ring.y = y;
    ring.vx = 0;
    ring.vy = 0;
    ring.life = 0.12;
    ring.maxLife = 0.12;
    ring.startSize = 4;
    ring.endSize = 20;
    ring.size = 4;
    ring.color = colors.primary;
    ring.shape = 'ring';
    ring.startAlpha = 0.4;
    ring.endAlpha = 0;
    this.particles.push(ring);
  }

  /**
   * Shockwave effect using FilterManager
   */
  spawnShockwave(x: number, y: number): void {
    filterManager.applyScreenShockwave(x, y, 600);
  }

  // --- Private staged effect helpers ---

  private spawnExplosionBurst(
    x: number,
    y: number,
    colors: ClassColors,
    intensity: number,
    config: typeof CLASS_EXPLOSION_CONFIG[FortressClass],
    particleMultiplier: number
  ): void {
    const count = Math.floor(10 * intensity * particleMultiplier);

    this.factory.flash({ x, y, color: colors.glow, size: config.flashSize * intensity });
    this.factory.shockwaveRings(x, y, colors.secondary, 0.9 * intensity);
    this.triggerLightingFlash(x, y, colors.glow, 90 * intensity);

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const speed = 120 + Math.random() * 160;
      const p = this.pool.acquire();
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = 0.2 + Math.random() * 0.2;
      p.maxLife = p.life;
      p.size = 2.5 + Math.random() * 2.5;
      p.color = Math.random() > 0.6 ? colors.glow : colors.primary;
      p.shape = Math.random() > 0.5 ? 'spark' : 'circle';
      p.drag = 0.9;
      this.particles.push(p);
    }
  }

  private spawnFirePlume(
    x: number,
    y: number,
    colors: ClassColors,
    intensity: number,
    fortressClass: FortressClass,
    particleMultiplier: number
  ): void {
    const count = Math.floor(16 * intensity * particleMultiplier);
    const shape = fortressClass === 'lightning' ? 'spark'
      : fortressClass === 'ice' ? 'diamond'
      : fortressClass === 'tech' ? 'square'
      : 'circle';

    for (let i = 0; i < count; i++) {
      const p = this.pool.acquire();
      p.x = x + (Math.random() - 0.5) * 12;
      p.y = y + (Math.random() - 0.5) * 10;
      p.vx = (Math.random() - 0.5) * 50;
      p.vy = -90 - Math.random() * 90;
      p.life = 0.35 + Math.random() * 0.25;
      p.maxLife = p.life;
      p.startSize = 4 + Math.random() * 3;
      p.endSize = 14 + Math.random() * 8;
      p.size = p.startSize;
      p.color = Math.random() > 0.6 ? colors.glow : (Math.random() > 0.5 ? colors.primary : colors.secondary);
      p.startAlpha = 0.75;
      p.endAlpha = 0;
      p.gravity = -80;
      p.drag = 0.9;
      p.shape = shape;
      if (shape === 'diamond' || shape === 'square') {
        p.rotation = Math.random() * Math.PI;
        p.rotationSpeed = (Math.random() - 0.5) * 6;
      }
      this.particles.push(p);
    }
  }

  private spawnColoredSmoke(
    x: number,
    y: number,
    colors: ClassColors,
    intensity: number,
    particleMultiplier: number
  ): void {
    const count = Math.floor(10 * intensity * particleMultiplier);

    for (let i = 0; i < count; i++) {
      const p = this.pool.acquire();
      p.x = x + (Math.random() - 0.5) * 30;
      p.y = y + (Math.random() - 0.5) * 20;
      p.vx = (Math.random() - 0.5) * 30;
      p.vy = -25 - Math.random() * 35;
      p.life = 0.55 + Math.random() * 0.35;
      p.maxLife = p.life;
      p.startSize = 10 + Math.random() * 6;
      p.endSize = 25 + Math.random() * 15;
      p.size = p.startSize;
      
      // Blend class color with smoke grey
      const t = Math.random() * 0.4;
      p.color = ParticleFactory.blendColor(0x444444, colors.secondary, t);
      
      p.startAlpha = 0.45;
      p.endAlpha = 0;
      p.gravity = -15;
      p.drag = 0.97;
      p.shape = 'smoke';
      this.particles.push(p);
    }
  }

  private spawnSplashBurst(
    x: number,
    y: number,
    colors: ClassColors,
    intensity: number,
    fortressClass: FortressClass,
    particleMultiplier: number
  ): void {
    const count = Math.floor(14 * intensity * particleMultiplier);

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = 50 + Math.random() * 70;
      const p = this.pool.acquire();
      p.x = x + (Math.random() - 0.5) * 8;
      p.y = y + (Math.random() - 0.5) * 8;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 20;
      p.life = 0.3 + Math.random() * 0.25;
      p.maxLife = p.life;
      p.size = 3 + Math.random() * 3;
      p.color = Math.random() > 0.5 ? colors.primary : colors.glow;
      p.gravity = 100;
      p.drag = 0.94;
      
      switch (fortressClass) {
        case 'ice':
          p.shape = 'diamond';
          p.rotation = Math.random() * Math.PI;
          break;
        case 'lightning':
          p.shape = 'spark';
          break;
        default:
          p.shape = 'circle';
      }
      
      this.particles.push(p);
    }
  }

  private spawnFallingDebris(
    x: number,
    y: number,
    colors: ClassColors,
    intensity: number,
    fortressClass: FortressClass,
    particleMultiplier: number
  ): void {
    const count = Math.floor(12 * intensity * particleMultiplier);

    for (let i = 0; i < count; i++) {
      const p = this.pool.acquire();
      p.x = x + (Math.random() - 0.5) * 50;
      p.y = y - 30 - Math.random() * 40;
      p.vx = (Math.random() - 0.5) * 40;
      p.vy = 40 + Math.random() * 80;
      p.life = 0.5 + Math.random() * 0.35;
      p.maxLife = p.life;
      p.size = 2 + Math.random() * 3;
      p.color = Math.random() > 0.6 ? colors.secondary : colors.primary;
      p.gravity = 200;
      p.drag = 0.96;

      switch (fortressClass) {
        case 'ice':
          p.shape = 'diamond';
          p.rotation = Math.random() * Math.PI;
          p.rotationSpeed = (Math.random() - 0.5) * 5;
          break;
        case 'lightning':
          p.shape = 'spark';
          break;
        case 'tech':
          p.shape = 'square';
          p.rotation = Math.random() * Math.PI;
          p.rotationSpeed = (Math.random() - 0.5) * 4;
          break;
        default:
          p.shape = 'circle';
      }

      this.particles.push(p);
    }
  }

  private spawnSecondaryBurst(
    x: number,
    y: number,
    colors: ClassColors,
    intensity: number,
    particleMultiplier: number
  ): void {
    const count = Math.floor(12 * intensity * particleMultiplier);

    for (let i = 0; i < count; i++) {
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

  // ============================================================================
  // ENHANCED DESTRUCTION EFFECTS
  // ============================================================================

  /**
   * Big kill explosion - dramatically enhanced version for high damage kills
   * Multiple rings, more debris, crater mark effect
   */
  spawnBigKillExplosion(
    x: number,
    y: number,
    fortressClass: FortressClass,
    damageMultiplier: number,
    particleMultiplier: number,
    stagedEffects: StagedEffect[]
  ): void {
    const colors = CLASS_VFX_COLORS[fortressClass];
    const config = CLASS_EXPLOSION_CONFIG[fortressClass];
    const intensity = Math.min(2.0, 1.0 + damageMultiplier * 0.5);

    // Massive flash
    this.factory.flash({ x, y, color: 0xffffff, size: 50 * intensity });
    this.factory.flash({ x, y, color: colors.glow, size: 40 * intensity });

    // Triple shockwave rings
    for (let i = 0; i < 3; i++) {
      const delay = i * 50;
      this.timeoutRegistry.setTimeout(() => {
        this.factory.shockwaveRings(x, y, colors.secondary, intensity * (1 - i * 0.2));
      }, delay);
    }

    // Extra debris - double the normal amount
    const debrisCount = Math.floor(40 * particleMultiplier);
    for (let i = 0; i < debrisCount; i++) {
      const angle = (Math.PI * 2 * i) / debrisCount + Math.random() * 0.3;
      const speed = 150 + Math.random() * 200;
      const p = this.pool.acquire();

      p.x = x + (Math.random() - 0.5) * 10;
      p.y = y + (Math.random() - 0.5) * 10;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 50; // Upward bias
      p.life = 0.6 + Math.random() * 0.4;
      p.maxLife = p.life;
      p.size = 3 + Math.random() * 4;
      p.color = Math.random() > 0.5 ? colors.primary : colors.secondary;
      p.gravity = config.debrisGravity;
      p.drag = 0.95;
      p.shape = config.debrisShape;
      p.rotation = Math.random() * Math.PI * 2;
      p.rotationSpeed = (Math.random() - 0.5) * 12;

      this.particles.push(p);
    }

    // Crater mark (ground darkening)
    const crater = this.pool.acquire();
    crater.x = x;
    crater.y = y + 20; // Below explosion
    crater.vx = 0;
    crater.vy = 0;
    crater.life = 5.0; // Long lasting
    crater.maxLife = 5.0;
    crater.size = 30 * intensity;
    crater.startSize = 30 * intensity;
    crater.endSize = 35 * intensity;
    crater.color = 0x222222;
    crater.shape = 'circle';
    crater.startAlpha = 0.4;
    crater.endAlpha = 0;
    this.particles.push(crater);

    // Heavy screen shake
    this.triggerScreenShake(config.screenShake * intensity * 1.5, 250);

    // Dynamic lighting
    this.triggerLightingFlash(x, y, colors.glow, 150 * intensity);

    // Filter effects
    filterManager.applyScreenShockwave(x, y, 1000);
    filterManager.applyScreenFlash('white', 200, 0.4);

    // Queue additional staged effects
    stagedEffects.push({
      x,
      y,
      fortressClass,
      intensity,
      elapsed: 0,
      stages: [],
      kind: 'staggered',
    });
  }

  /**
   * Chain explosion - smaller explosion triggered by domino effect
   * Propagates from ragdoll collision
   */
  spawnChainExplosion(
    x: number,
    y: number,
    fortressClass: FortressClass,
    intensity: number,
    particleMultiplier: number
  ): void {
    const colors = CLASS_VFX_COLORS[fortressClass];
    const baseIntensity = Math.min(intensity, 0.7);

    // Quick flash
    this.factory.flash({ x, y, color: colors.glow, size: 20 * baseIntensity });

    // Single shockwave
    this.factory.shockwaveRings(x, y, colors.secondary, baseIntensity * 0.6);

    // Debris burst
    const debrisCount = Math.floor(15 * particleMultiplier);
    for (let i = 0; i < debrisCount; i++) {
      const angle = (Math.PI * 2 * i) / debrisCount + Math.random() * 0.5;
      const speed = 80 + Math.random() * 100;
      const p = this.pool.acquire();

      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = 0.3 + Math.random() * 0.2;
      p.maxLife = p.life;
      p.size = 2 + Math.random() * 2;
      p.color = colors.primary;
      p.gravity = 150;
      p.drag = 0.9;
      p.shape = 'circle';

      this.particles.push(p);
    }

    // Small shake
    this.triggerScreenShake(1.5, 80);
  }

  /**
   * Ice shatter effect - crystalline fragments exploding outward
   * For ice class kills or frozen enemy deaths
   */
  spawnShatterEffect(
    x: number,
    y: number,
    pieceCount: number,
    particleMultiplier: number
  ): void {
    const iceColors = CLASS_VFX_COLORS.ice;
    const count = Math.floor(pieceCount * particleMultiplier);

    // Central flash (cold blue)
    this.factory.flash({ x, y, color: 0x88ddff, size: 25 });
    this.factory.flash({ x, y, color: 0xffffff, size: 15 });

    // Ice crystal fragments
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const speed = 100 + Math.random() * 150;
      const p = this.pool.acquire();

      p.x = x + (Math.random() - 0.5) * 8;
      p.y = y + (Math.random() - 0.5) * 8;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 30;
      p.life = 0.5 + Math.random() * 0.3;
      p.maxLife = p.life;
      p.size = 4 + Math.random() * 6;
      p.color = Math.random() > 0.3 ? iceColors.primary : 0xffffff;
      p.gravity = 120;
      p.drag = 0.94;
      p.shape = 'diamond';
      p.rotation = Math.random() * Math.PI * 2;
      p.rotationSpeed = (Math.random() - 0.5) * 15;
      p.startAlpha = 0.9;
      p.endAlpha = 0;

      this.particles.push(p);
    }

    // Frost mist
    for (let i = 0; i < Math.floor(8 * particleMultiplier); i++) {
      const p = this.pool.acquire();
      p.x = x + (Math.random() - 0.5) * 20;
      p.y = y + (Math.random() - 0.5) * 15;
      p.vx = (Math.random() - 0.5) * 30;
      p.vy = -20 - Math.random() * 30;
      p.life = 0.6 + Math.random() * 0.4;
      p.maxLife = p.life;
      p.startSize = 8;
      p.endSize = 20;
      p.size = 8;
      p.color = 0xaaddff;
      p.shape = 'smoke';
      p.startAlpha = 0.5;
      p.endAlpha = 0;
      p.drag = 0.96;

      this.particles.push(p);
    }

    // Expanding frost ring
    const ring = this.pool.acquire();
    ring.x = x;
    ring.y = y;
    ring.vx = 0;
    ring.vy = 0;
    ring.life = 0.25;
    ring.maxLife = 0.25;
    ring.startSize = 10;
    ring.endSize = 60;
    ring.size = 10;
    ring.color = iceColors.glow;
    ring.shape = 'ring';
    ring.startAlpha = 0.7;
    ring.endAlpha = 0;
    this.particles.push(ring);

    // Sound/shake
    this.triggerScreenShake(2, 100);
  }

  /**
   * Persistent debris that accumulates on the ground
   * Returns particle references for the system to track
   */
  spawnPersistentDebris(
    x: number,
    y: number,
    color: number,
    count: number,
    _groundY: number
  ): void {
    for (let i = 0; i < count; i++) {
      const p = this.pool.acquire();
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 50;

      p.x = x + (Math.random() - 0.5) * 10;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 40;
      p.life = 8.0 + Math.random() * 4.0; // Long lasting
      p.maxLife = p.life;
      p.size = 2 + Math.random() * 3;
      p.color = color;
      p.gravity = 180;
      p.drag = 0.92;
      p.shape = 'square';
      p.rotation = Math.random() * Math.PI * 2;
      p.rotationSpeed = (Math.random() - 0.5) * 8;
      p.startAlpha = 1.0;
      p.endAlpha = 0; // Fade out at end

      this.particles.push(p);
    }
  }

  /**
   * Impact mark on ground (crater-like visual)
   */
  spawnImpactMark(
    x: number,
    y: number,
    radius: number,
    color: number
  ): void {
    const mark = this.pool.acquire();
    mark.x = x;
    mark.y = y;
    mark.vx = 0;
    mark.vy = 0;
    mark.life = 10.0; // 10 second lifetime
    mark.maxLife = 10.0;
    mark.size = radius;
    mark.startSize = radius;
    mark.endSize = radius * 1.1;
    mark.color = color;
    mark.shape = 'circle';
    mark.startAlpha = 0.3;
    mark.endAlpha = 0;

    this.particles.push(mark);
  }
}
