import type { Particle } from '../types.js';
import type { ParticleFactory } from '../particleFactory.js';
import type { ParticlePool } from '../particlePool.js';
import { CLASS_VFX_COLORS, SKILL_COLORS } from '../config.js';

/**
 * Hero skill effect handlers.
 * Manages special abilities like lightning strikes, lasers, hammers, etc.
 */
export class SkillEffects {
  constructor(
    private pool: ParticlePool,
    private particles: Particle[],
    private factory: ParticleFactory,
    private triggerScreenShake: (intensity: number, duration: number) => void,
    _triggerLightingFlash: (x: number, y: number, color: number, radius: number) => void
  ) {}

  // ============================================================
  // LIGHTNING CLASS SKILLS
  // ============================================================

  /**
   * Lightning Strike from sky - dramatic bolt hitting ground
   */
  spawnLightningStrike(x: number, y: number, intensity: number = 1): void {
    const colors = CLASS_VFX_COLORS.lightning;

    this.triggerScreenShake(5 * intensity, 200);

    // Bright flash at impact point
    this.factory.flash({ x, y, color: 0xffffff, size: 40 * intensity });
    this.factory.flash({ x, y, color: colors.glow, size: 60 * intensity });

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
        this.spawnLightningBranch(nextX, nextY, colors, intensity);
      }

      prevX = nextX;
      prevY = nextY;
    }

    // Ground impact sparks
    this.spawnGroundSparks(x, y, colors, intensity);

    // Electric ground ring
    this.factory.ring({
      x, y,
      color: colors.primary,
      startSize: 10,
      endSize: 100 * intensity,
      life: 0.4,
      alpha: 0.8,
    });
  }

  private spawnLightningBranch(x: number, y: number, colors: typeof CLASS_VFX_COLORS.lightning, intensity: number): void {
    const branchAngle = (Math.random() > 0.5 ? 1 : -1) * (Math.PI / 4 + Math.random() * Math.PI / 4);
    const branchLen = 30 + Math.random() * 40;
    
    for (let j = 0; j < 4; j++) {
      const bp = this.pool.acquire();
      bp.x = x + Math.cos(branchAngle) * branchLen * (j / 4);
      bp.y = y + Math.sin(branchAngle) * branchLen * (j / 4);
      bp.vx = 0;
      bp.vy = 0;
      bp.life = 0.15;
      bp.maxLife = 0.15;
      bp.size = 4 * (1 - j / 4) * intensity;
      bp.color = colors.glow;
      bp.shape = 'circle';
      this.particles.push(bp);
    }
  }

  private spawnGroundSparks(x: number, y: number, colors: typeof CLASS_VFX_COLORS.lightning, intensity: number): void {
    for (let i = 0; i < 20; i++) {
      const angle = (Math.PI * 2 * i) / 20;
      const speed = 150 + Math.random() * 100;
      const spark = this.pool.acquire();
      spark.x = x;
      spark.y = y;
      spark.vx = Math.cos(angle) * speed;
      spark.vy = Math.sin(angle) * speed * 0.5;
      spark.life = 0.3;
      spark.maxLife = 0.3;
      spark.size = 4 * intensity;
      spark.color = Math.random() > 0.3 ? colors.glow : 0xffffff;
      spark.shape = 'spark';
      spark.drag = 0.92;
      this.particles.push(spark);
    }
  }

  /**
   * Chain Lightning effect between multiple points
   */
  spawnChainLightning(points: { x: number; y: number }[]): void {
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
      this.factory.flash({ x: end.x, y: end.y, color: colors.glow, size: 15 });

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

    this.triggerScreenShake(2, 100);
  }

  /**
   * EMP Blast Ultimate - massive electromagnetic pulse
   */
  spawnEmpBlast(x: number, y: number): void {
    this.triggerScreenShake(12, 400);

    // Multiple lightning strikes
    for (let i = 0; i < 5; i++) {
      const strikeX = x + (Math.random() - 0.5) * 150;
      const strikeY = y + (Math.random() - 0.5) * 80;
      setTimeout(() => {
        this.spawnLightningStrike(strikeX, strikeY, 1.2);
      }, i * 80);
    }

    // Central massive flash
    this.factory.flash({ x, y, color: 0xffffff, size: 100 });

    // Expanding lightning rings
    for (let i = 0; i < 3; i++) {
      this.factory.ring({
        x, y,
        color: i === 0 ? 0xffffff : CLASS_VFX_COLORS.lightning.primary,
        startSize: 20,
        endSize: 200 + i * 50,
        life: 0.6 + i * 0.15,
        alpha: 0.9 - i * 0.2,
      });
    }

    // Electric storm particles
    this.spawnElectricStorm(x, y, 40);
  }

  private spawnElectricStorm(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
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

  /**
   * Hammer Throw - spinning hammer with lightning trail
   */
  spawnHammerThrow(startX: number, startY: number, targetX: number, targetY: number): void {
    const colors = SKILL_COLORS.hammer;
    const dist = Math.sqrt((targetX - startX) ** 2 + (targetY - startY) ** 2);
    const steps = Math.floor(dist / 15);

    for (let i = 0; i < steps; i++) {
      const progress = i / steps;
      const x = startX + (targetX - startX) * progress;
      const y = startY + (targetY - startY) * progress;

      // Hammer head (square, rotating)
      const hammer = this.pool.acquire();
      hammer.x = x;
      hammer.y = y;
      hammer.vx = 0;
      hammer.vy = 0;
      hammer.life = 0.3 - i * 0.02;
      hammer.maxLife = 0.3;
      hammer.size = 12 - progress * 4;
      hammer.color = 0x888899;
      hammer.shape = 'square';
      hammer.rotation = progress * Math.PI * 8;
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

  // ============================================================
  // TECH CLASS SKILLS
  // ============================================================

  /**
   * Laser Beam - energy blast
   */
  spawnLaserBeam(startX: number, startY: number, targetX: number, targetY: number): void {
    const colors = CLASS_VFX_COLORS.tech;
    const angle = Math.atan2(targetY - startY, targetX - startX);
    const dist = Math.sqrt((targetX - startX) ** 2 + (targetY - startY) ** 2);

    // Muzzle flash
    this.factory.flash({ x: startX, y: startY, color: colors.glow, size: 15 });

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
    this.factory.flash({ x: targetX, y: targetY, color: colors.glow, size: 25 });
  }

  /**
   * Missile Barrage - multiple missiles with smoke trails
   */
  spawnMissileBarrage(startX: number, startY: number, targets: { x: number; y: number }[]): void {
    const colors = SKILL_COLORS.missile;

    for (let m = 0; m < Math.min(targets.length, 6); m++) {
      const target = targets[m] || targets[0];

      setTimeout(() => {
        this.factory.flash({ x: startX, y: startY, color: colors.secondary, size: 10 });
        this.spawnMissileTrail(startX, startY, target.x, target.y, colors);
      }, m * 100);
    }
  }

  private spawnMissileTrail(
    startX: number,
    startY: number,
    targetX: number,
    targetY: number,
    colors: typeof SKILL_COLORS.missile
  ): void {
    const dist = Math.sqrt((targetX - startX) ** 2 + (targetY - startY) ** 2);
    const angle = Math.atan2(targetY - startY, targetX - startX);
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
  }

  /**
   * Proton Cannon Ultimate - massive energy beam
   */
  spawnProtonCannon(startX: number, startY: number, targetX: number, targetY: number): void {
    const colors = CLASS_VFX_COLORS.tech;

    this.triggerScreenShake(10, 500);

    const angle = Math.atan2(targetY - startY, targetX - startX);
    const dist = Math.sqrt((targetX - startX) ** 2 + (targetY - startY) ** 2);

    // Charging effect
    this.spawnChargeEffect(startX, startY, colors, 20);

    // Main beam
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

      // Data fragments
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
    this.factory.flash({ x: targetX, y: targetY, color: 0xffffff, size: 80 });
    this.factory.flash({ x: targetX, y: targetY, color: colors.glow, size: 100 });

    // Impact rings
    for (let i = 0; i < 3; i++) {
      this.factory.ring({
        x: targetX,
        y: targetY,
        color: i === 0 ? 0xffffff : colors.primary,
        startSize: 20,
        endSize: 150 + i * 30,
        life: 0.5 + i * 0.1,
        alpha: 0.8,
      });
    }
  }

  private spawnChargeEffect(x: number, y: number, colors: typeof CLASS_VFX_COLORS.tech, count: number): void {
    for (let i = 0; i < count; i++) {
      const chargeAngle = Math.random() * Math.PI * 2;
      const chargeDist = 30 + Math.random() * 30;
      const charge = this.pool.acquire();
      charge.x = x + Math.cos(chargeAngle) * chargeDist;
      charge.y = y + Math.sin(chargeAngle) * chargeDist;
      charge.vx = -Math.cos(chargeAngle) * 100;
      charge.vy = -Math.sin(chargeAngle) * 100;
      charge.life = 0.3;
      charge.maxLife = 0.3;
      charge.size = 4;
      charge.color = colors.glow;
      charge.shape = 'circle';
      this.particles.push(charge);
    }
  }

  // ============================================================
  // NATURAL CLASS SKILLS
  // ============================================================

  /**
   * Earthquake Shockwave - massive ground wave with cracks and debris
   * Dedicated effect for "Fala Uderzeniowa" fortress skill
   */
  spawnEarthquakeShockwave(x: number, y: number, intensity: number = 1): void {
    const colors = CLASS_VFX_COLORS.natural;
    const radius = 450; // Scale to match skill radius 15 units (≈450px on screen)

    // Strong screen shake for earthquake
    this.triggerScreenShake(10 * intensity, 400);

    // Central flash
    this.factory.flash({ x, y, color: colors.glow, size: 40 * intensity });
    this.factory.flash({ x, y, color: 0xffffff, size: 30 * intensity });

    // Multiple expanding shockwave rings (scaled to actual radius)
    for (let i = 0; i < 4; i++) {
      this.factory.ring({
        x, y,
        color: i % 2 === 0 ? colors.glow : colors.primary,
        startSize: 20 + i * 15,
        endSize: radius * (0.3 + i * 0.2), // Scale to actual skill radius
        life: 0.5 + i * 0.1,
        alpha: 0.8 - i * 0.15,
      });
    }

    // Ground crack lines radiating outward (8 directions)
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const crackLen = radius * 0.8; // Scale to skill radius

      for (let j = 0; j < 10; j++) {
        const progress = j / 10;
        const crack = this.pool.acquire();
        crack.x = x + Math.cos(angle) * crackLen * progress;
        crack.y = y + Math.sin(angle) * crackLen * progress * 0.3; // Flattened for ground
        crack.vx = Math.cos(angle) * 30;
        crack.vy = Math.sin(angle) * 15;
        crack.life = 0.6 - progress * 0.3;
        crack.maxLife = 0.6;
        crack.size = 6 * (1 - progress * 0.6) * intensity;
        crack.color = 0x8b4513; // Brown for ground cracks
        crack.shape = 'spark';
        this.particles.push(crack);
      }
    }

    // Debris flying up and outward
    for (let i = 0; i < 40 * intensity; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * radius * 0.5;
      const speed = 100 + Math.random() * 150;
      const debris = this.pool.acquire();
      debris.x = x + Math.cos(angle) * dist;
      debris.y = y + Math.sin(angle) * dist * 0.3;
      debris.vx = Math.cos(angle) * speed * 0.6;
      debris.vy = -Math.abs(Math.sin(angle) * speed) - 60;
      debris.life = 0.7 + Math.random() * 0.4;
      debris.maxLife = debris.life;
      debris.size = 5 + Math.random() * 8;
      debris.color = Math.random() > 0.5 ? 0x8b4513 : 0x654321; // Brown debris
      debris.shape = 'square';
      debris.rotation = Math.random() * Math.PI;
      debris.rotationSpeed = (Math.random() - 0.5) * 12;
      debris.gravity = 200;
      this.particles.push(debris);
    }

    // Dust cloud expanding outward
    this.factory.smoke(x, y, intensity * 1.5);

    // Additional dust particles for ground effect
    for (let i = 0; i < 30 * intensity; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * radius * 0.6;
      const dust = this.pool.acquire();
      dust.x = x + Math.cos(angle) * dist;
      dust.y = y + Math.sin(angle) * dist * 0.3;
      dust.vx = Math.cos(angle) * (40 + Math.random() * 60);
      dust.vy = -20 - Math.random() * 40;
      dust.life = 0.8 + Math.random() * 0.4;
      dust.maxLife = dust.life;
      dust.startSize = 4;
      dust.endSize = 12;
      dust.size = 4;
      dust.color = 0xaaaaaa; // Gray dust
      dust.startAlpha = 0.6;
      dust.endAlpha = 0;
      dust.shape = 'circle';
      dust.gravity = 50;
      this.particles.push(dust);
    }

    // Radial energy particles (green natural energy)
    for (let i = 0; i < 20; i++) {
      const angle = (Math.PI * 2 * i) / 20;
      const p = this.pool.acquire();
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * 100 * intensity;
      p.vy = Math.sin(angle) * 100 * intensity;
      p.life = 0.5;
      p.maxLife = 0.5;
      p.size = 4 + Math.random() * 4;
      p.color = Math.random() > 0.5 ? colors.primary : colors.glow;
      p.shape = 'circle';
      p.drag = 0.92;
      this.particles.push(p);
    }
  }

  /**
   * Ground Smash - powerful ground pound
   */
  spawnGroundSmash(x: number, y: number, intensity: number = 1): void {
    const colors = CLASS_VFX_COLORS.natural;

    this.triggerScreenShake(8 * intensity, 300);
    this.factory.flash({ x, y, color: colors.glow, size: 30 * intensity });

    // Ground crack lines
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const crackLen = 60 + Math.random() * 40;

      for (let j = 0; j < 6; j++) {
        const progress = j / 6;
        const crack = this.pool.acquire();
        crack.x = x + Math.cos(angle) * crackLen * progress;
        crack.y = y + Math.sin(angle) * crackLen * progress * 0.3;
        crack.vx = Math.cos(angle) * 20;
        crack.vy = Math.sin(angle) * 10;
        crack.life = 0.5 - progress * 0.2;
        crack.maxLife = 0.5;
        crack.size = 5 * (1 - progress * 0.5) * intensity;
        crack.color = 0x8b4513;
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
      debris.vy = -Math.abs(Math.sin(angle) * speed) - 50;
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
    this.factory.smoke(x, y, intensity);

    // Shockwave ring
    this.factory.ring({
      x, y,
      color: colors.primary,
      startSize: 15,
      endSize: 120 * intensity,
      life: 0.4,
      alpha: 0.6,
    });
  }

  /**
   * Kinetic Burst - green kinetic energy explosion
   */
  spawnKineticBurst(x: number, y: number, intensity: number = 1): void {
    const colors = CLASS_VFX_COLORS.natural;

    this.triggerScreenShake(10 * intensity, 350);

    this.factory.flash({ x, y, color: 0xffffff, size: 50 * intensity });
    this.factory.flash({ x, y, color: colors.glow, size: 80 * intensity });

    // Kinetic energy rings
    for (let i = 0; i < 4; i++) {
      this.factory.ring({
        x, y,
        color: i % 2 === 0 ? colors.glow : colors.primary,
        startSize: 10 + i * 10,
        endSize: 150 + i * 40,
        life: 0.5 + i * 0.12,
        alpha: 0.7 - i * 0.1,
      });
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
   * Shield Throw - spinning shield bouncing between enemies
   */
  spawnShieldThrow(points: { x: number; y: number }[]): void {
    if (points.length < 2) return;

    const colors = SKILL_COLORS.shield;

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
        outer.color = colors.red;
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
        white.color = colors.white;
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
        blue.color = colors.blue;
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
        star.color = colors.white;
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
          trail.color = colors.white;
          trail.startAlpha = 0.5;
          trail.endAlpha = 0;
          trail.shape = 'circle';
          this.particles.push(trail);
        }
      }

      // Impact flash at each bounce point
      this.factory.flash({ x: end.x, y: end.y, color: colors.white, size: 20 });

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

  // ============================================================
  // ICE CLASS SKILLS
  // ============================================================

  /**
   * Frost Arrow - ice arrow with freezing trail
   */
  spawnFrostArrow(startX: number, startY: number, targetX: number, targetY: number): void {
    const colors = CLASS_VFX_COLORS.ice;
    const angle = Math.atan2(targetY - startY, targetX - startX);
    const dist = Math.sqrt((targetX - startX) ** 2 + (targetY - startY) ** 2);

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
        ice.vy = Math.random() * 20 + 10;
        ice.life = 0.4;
        ice.maxLife = 0.4;
        ice.size = 3 + Math.random() * 3;
        ice.color = colors.glow;
        ice.shape = 'diamond';
        ice.rotation = Math.random() * Math.PI;
        ice.rotationSpeed = 3;
        this.particles.push(ice);
      }

      // Frost glow
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
  spawnFreezeImpact(x: number, y: number, intensity: number = 1): void {
    const colors = CLASS_VFX_COLORS.ice;

    this.factory.flash({ x, y, color: colors.glow, size: 25 * intensity });

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
    this.factory.ring({
      x, y,
      color: colors.secondary,
      startSize: 10,
      endSize: 60 * intensity,
      life: 0.4,
      alpha: 0.6,
    });

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
   * Blizzard Barrage Ultimate - ice storm
   */
  spawnBlizzardBarrage(x: number, y: number, radius: number = 150): void {
    const colors = CLASS_VFX_COLORS.ice;

    this.triggerScreenShake(8, 400);
    this.factory.flash({ x, y, color: colors.glow, size: 50 });

    // Ice rings expanding
    for (let i = 0; i < 4; i++) {
      this.factory.ring({
        x, y,
        color: i % 2 === 0 ? colors.primary : colors.glow,
        startSize: 20 + i * 10,
        endSize: radius + i * 30,
        life: 0.6 + i * 0.15,
        alpha: 0.7 - i * 0.1,
      });
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

      // Spike shatter delayed
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

    // Freeze cloud
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
  // VOID/OMEGA CLASS SKILLS
  // ============================================================

  /**
   * Execute Strike - devastating golden slash
   */
  spawnExecuteStrike(startX: number, startY: number, targetX: number, targetY: number): void {
    const colors = SKILL_COLORS.omega;
    const angle = Math.atan2(targetY - startY, targetX - startX);
    const perpAngle = angle + Math.PI / 2;
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
    this.triggerScreenShake(6, 180);
  }

  /**
   * Golden slash arc effect
   */
  spawnGoldenSlash(x: number, y: number, angle: number): void {
    const colors = SKILL_COLORS.omega;
    const slashAngle = angle + Math.PI / 4;
    const slashLength = 50;

    for (let i = 0; i < 20; i++) {
      const progress = i / 20;
      const arcAngle = slashAngle - Math.PI / 3 + progress * (Math.PI * 2 / 3);
      const dist = slashLength * (0.8 + Math.sin(progress * Math.PI) * 0.4);
      const px = x + Math.cos(arcAngle) * dist;
      const py = y + Math.sin(arcAngle) * dist;

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

    this.factory.flash({ x, y, color: colors.primary, size: 40 });

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
   * Portal enemy spawn effect
   */
  spawnPortalEmit(portalX: number, portalY: number, targetX: number, targetY: number): void {
    const colors = SKILL_COLORS.portal;

    this.factory.flash({ x: portalX, y: portalY, color: colors.glow, size: 15 });

    const angle = Math.atan2(targetY - portalY, targetX - portalX);

    // Main void particles shooting towards enemy position
    for (let i = 0; i < 8; i++) {
      const p = this.pool.acquire();
      p.x = portalX + (Math.random() - 0.5) * 20;
      p.y = portalY + (Math.random() - 0.5) * 40;

      const spread = (Math.random() - 0.5) * 0.5;
      const speed = 150 + Math.random() * 100;
      p.vx = Math.cos(angle + spread) * speed;
      p.vy = Math.sin(angle + spread) * speed;

      p.life = 0.4 + Math.random() * 0.2;
      p.maxLife = p.life;
      p.size = 4 + Math.random() * 4;
      p.color = i % 3 === 0 ? colors.glow : (i % 3 === 1 ? colors.primary : colors.secondary);
      p.shape = 'circle';
      p.drag = 0.95;
      p.startAlpha = 0.9;
      p.endAlpha = 0;
      this.particles.push(p);
    }

    // Void wisps trailing behind
    for (let i = 0; i < 5; i++) {
      const wispP = this.pool.acquire();
      wispP.x = portalX + (Math.random() - 0.5) * 15;
      wispP.y = portalY + (Math.random() - 0.5) * 60;
      wispP.vx = -50 - Math.random() * 30;
      wispP.vy = (Math.random() - 0.5) * 40;
      wispP.life = 0.6;
      wispP.maxLife = 0.6;
      wispP.size = 6 + Math.random() * 6;
      wispP.color = colors.dark;
      wispP.shape = 'circle';
      wispP.drag = 0.92;
      wispP.startAlpha = 0.6;
      wispP.endAlpha = 0;
      this.particles.push(wispP);
    }

    // Energy sparks at portal edge
    for (let i = 0; i < 4; i++) {
      const sparkP = this.pool.acquire();
      const sparkAngle = Math.random() * Math.PI * 2;
      sparkP.x = portalX + Math.cos(sparkAngle) * 10;
      sparkP.y = portalY + Math.sin(sparkAngle) * 30;
      sparkP.vx = Math.cos(sparkAngle) * 60;
      sparkP.vy = Math.sin(sparkAngle) * 60;
      sparkP.life = 0.25;
      sparkP.maxLife = 0.25;
      sparkP.size = 3;
      sparkP.color = colors.glow;
      sparkP.shape = 'spark';
      sparkP.drag = 0.85;
      this.particles.push(sparkP);
    }
  }
}
