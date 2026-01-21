import { Container, Graphics } from 'pixi.js';
import type { FortressClass, EnemyType } from '@arcade/sim-core';
import { graphicsSettings } from '../../../state/settings.signals.js';

import type {
  Particle,
  FloatingText,
  StagedEffect,
  ScreenShakeCallback,
  LightingCallback,
} from './types.js';
import { ParticlePool } from './particlePool.js';
import { ParticleFactory } from './particleFactory.js';
import { ExplosionEffects, DeathEffects, TextEffects, SkillEffects } from './effects/index.js';
import { CLASS_VFX_COLORS } from './config.js';

// Re-export types for external use
export type { FloatingText } from './types.js';

/**
 * VFXSystem - Modular visual effects system for particle rendering.
 * 
 * This is a refactored version split into:
 * - ParticlePool: Object pooling for particle reuse
 * - ParticleFactory: Data-driven particle creation
 * - ExplosionEffects: Explosions, impacts, shockwaves
 * - DeathEffects: Enemy death animations
 * - TextEffects: Damage numbers, combos, streaks
 * - SkillEffects: Hero skill visual effects
 */
export class VFXSystem {
  public container: Container;
  private particles: Particle[] = [];
  private floatingTexts: FloatingText[] = [];
  private graphics: Graphics;
  private pool: ParticlePool;
  private factory: ParticleFactory;
  
  // Effect handlers
  private explosions: ExplosionEffects;
  private deaths: DeathEffects;
  private text: TextEffects;
  private skills: SkillEffects;
  
  // Staged effects queue for multi-phase effects
  private stagedEffects: StagedEffect[] = [];
  
  // Callbacks
  private screenShakeCallback: ScreenShakeCallback | null = null;
  private lightingCallback: LightingCallback | null = null;

  constructor() {
    this.container = new Container();
    this.graphics = new Graphics();
    this.container.addChild(this.graphics);
    this.pool = new ParticlePool(2000);
    
    // Create factory with access to pool and particles
    this.factory = new ParticleFactory(
      this.pool,
      this.particles,
      () => this.particleMultiplier
    );
    
    // Initialize effect handlers
    this.explosions = new ExplosionEffects(
      this.pool,
      this.particles,
      this.factory,
      (intensity, duration) => this.triggerScreenShake(intensity, duration),
      (x, y, color, radius) => this.triggerLightingFlash(x, y, color, radius)
    );
    
    this.deaths = new DeathEffects(
      this.pool,
      this.particles,
      this.factory
    );
    
    this.text = new TextEffects(
      this.pool,
      this.particles,
      this.factory,
      this.container,
      this.floatingTexts,
      (intensity, duration) => this.triggerScreenShake(intensity, duration),
      () => graphicsSettings.value.damageNumbers
    );
    
    this.skills = new SkillEffects(
      this.pool,
      this.particles,
      this.factory,
      (intensity, duration) => this.triggerScreenShake(intensity, duration),
      (x, y, color, radius) => this.triggerLightingFlash(x, y, color, radius)
    );
  }

  // --- SETTINGS INTEGRATION ---
  private get particleMultiplier(): number {
    const { particles, quality } = graphicsSettings.value;
    if (quality === 'low') return Math.min(particles, 0.5);
    return particles;
  }

  // --- CALLBACKS ---
  public setScreenShakeCallback(callback: ScreenShakeCallback): void {
    this.screenShakeCallback = callback;
  }

  public setLightingCallback(callback: LightingCallback): void {
    this.lightingCallback = callback;
  }

  private triggerScreenShake(intensity: number, duration: number): void {
    if (this.screenShakeCallback) {
      this.screenShakeCallback(intensity, duration);
    }
  }

  private triggerLightingFlash(x: number, y: number, color: number, radius: number = 80): void {
    if (this.lightingCallback) {
      this.lightingCallback(x, y, color, radius);
    }
  }

  // --- UPDATE LOOP ---
  public update(delta: number): void {
    const dt = delta / 1000;

    // Update staged effects
    this.explosions.updateStagedEffects(dt, this.stagedEffects, this.particleMultiplier);

    // Update floating texts
    this.text.updateFloatingTexts(dt);

    // Update particles using swap-and-pop
    let i = this.particles.length;
    while (i--) {
      const p = this.particles[i];
      p.life -= dt;

      if (p.life <= 0) {
        this.pool.release(p);
        this.particles[i] = this.particles[this.particles.length - 1];
        this.particles.pop();
        continue;
      }

      // Apply velocity
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Apply gravity
      if (p.gravity) {
        p.vy += p.gravity * dt;
      }

      // Apply rotation
      if (p.shape === 'confetti') {
        p.rotation = (p.rotation || 0) + (p.rotationSpeed || 5) * dt;
        p.scaleX = Math.cos(p.rotation);
      } else if (p.rotation !== undefined && p.rotationSpeed) {
        p.rotation += p.rotationSpeed * dt;
      }

      // Apply drag
      const drag = p.drag ?? 0.95;
      p.vx *= drag;
      p.vy *= drag;

      // Spawn secondary particles
      if (p.spawnSecondary && p.life < p.maxLife * 0.7 && Math.random() < 0.1) {
        this.factory.spawnSecondary(p);
        p.spawnSecondary = false;
      }
    }

    // Redraw particles
    this.drawParticles();
  }

  /**
   * Clear all active VFX (particles, texts, staged effects).
   * Useful when transitioning to hub to avoid lingering visuals.
   */
  public clearAll(): void {
    for (const ft of this.floatingTexts) {
      this.container.removeChild(ft.text);
      ft.text.destroy();
    }
    this.floatingTexts.length = 0;

    for (const p of this.particles) {
      this.pool.release(p);
    }
    this.particles.length = 0;

    this.stagedEffects.length = 0;
    this.graphics.clear();
  }

  // --- PARTICLE RENDERING ---
  private drawParticles(): void {
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
          for (let j = 0; j < points * 2; j++) {
            const r = j % 2 === 0 ? outerRadius : innerRadius;
            const angle = (j * Math.PI) / points + rot - Math.PI / 2;
            starPoints.push(p.x + Math.cos(angle) * r);
            starPoints.push(p.y + Math.sin(angle) * r);
          }
          g.poly(starPoints).fill({ color: p.color, alpha: alpha * 0.9 });
          break;
        }

        case 'smoke': {
          g.circle(p.x, p.y, size * 1.5).fill({ color: p.color, alpha: alpha * 0.3 });
          g.circle(p.x, p.y, size).fill({ color: p.color, alpha: alpha * 0.4 });
          break;
        }

        case 'confetti': {
          const scaleX = p.scaleX ?? 1;
          const w = size * Math.abs(scaleX);
          const h = size;
          g.rect(p.x - w / 2, p.y - h / 2, w, h).fill({ color: p.color, alpha: alpha * 0.9 });
          break;
        }
      }
    }
  }

  // ============================================================
  // PUBLIC API - Explosions & Impacts
  // ============================================================

  public spawnExplosion(x: number, y: number, color: number = 0xffaa00): void {
    this.explosions.spawnExplosion(x, y, color, this.particleMultiplier);
  }

  public spawnEnhancedExplosion(x: number, y: number, fortressClass: FortressClass, intensity: number = 1): void {
    this.explosions.queueEnhancedExplosion(x, y, fortressClass, intensity, this.stagedEffects);
  }

  public spawnClassExplosion(x: number, y: number, fortressClass: FortressClass): void {
    this.spawnEnhancedExplosion(x, y, fortressClass, 1);
  }

  public spawnClassImpact(x: number, y: number, fortressClass: FortressClass): void {
    this.explosions.spawnClassImpact(x, y, fortressClass, this.particleMultiplier);
  }

  public spawnHitImpact(x: number, y: number, fortressClass: FortressClass): void {
    this.explosions.spawnHitImpact(x, y, fortressClass, this.particleMultiplier);
  }

  public spawnShockwave(x: number, y: number): void {
    this.explosions.spawnShockwave(x, y);
  }

  // ============================================================
  // PUBLIC API - Enemy Deaths
  // ============================================================

  public spawnEnemyDeathVFX(x: number, y: number, enemyType?: EnemyType, isElite: boolean = false): void {
    this.deaths.spawnEnemyDeathVFX(x, y, enemyType, isElite);
  }

  public spawnBossDeathVFX(x: number, y: number, enemyType?: EnemyType): void {
    this.deaths.spawnBossDeathVFX(x, y, enemyType);
  }

  // ============================================================
  // PUBLIC API - Text Effects
  // ============================================================

  public spawnFloatingText(x: number, y: number, text: string, color: number = 0xffffff): void {
    this.text.spawnFloatingText(x, y, text, color);
  }

  public spawnDamageNumber(
    x: number,
    y: number,
    damage: number,
    options: { isCrit?: boolean; color?: number } = {}
  ): void {
    this.text.spawnDamageNumber(x, y, damage, options);
  }

  public spawnKillStreakEffect(x: number, y: number, streak: number): void {
    this.text.spawnKillStreakEffect(x, y, streak);
  }

  public spawnComboEffect(x: number, y: number, comboId: string, bonusDamage?: number): void {
    this.text.spawnComboEffect(x, y, comboId, bonusDamage);
  }

  public spawnConfetti(x: number, y: number): void {
    this.text.spawnConfetti(x, y, this.particleMultiplier);
  }

  public spawnCriticalHit(x: number, y: number): void {
    this.text.spawnCriticalHit(x, y);
  }

  // ============================================================
  // PUBLIC API - Lightning Skills
  // ============================================================

  public spawnLightningStrike(x: number, y: number, intensity: number = 1): void {
    this.skills.spawnLightningStrike(x, y, intensity);
  }

  public spawnChainLightning(points: { x: number; y: number }[]): void {
    this.skills.spawnChainLightning(points);
  }

  public spawnEmpBlast(x: number, y: number): void {
    this.skills.spawnEmpBlast(x, y);
  }

  public spawnHammerThrow(startX: number, startY: number, targetX: number, targetY: number): void {
    this.skills.spawnHammerThrow(startX, startY, targetX, targetY);
  }

  // ============================================================
  // PUBLIC API - Tech Skills
  // ============================================================

  public spawnLaserBeam(startX: number, startY: number, targetX: number, targetY: number): void {
    this.skills.spawnLaserBeam(startX, startY, targetX, targetY);
  }

  public spawnMissileBarrage(startX: number, startY: number, targets: { x: number; y: number }[]): void {
    this.skills.spawnMissileBarrage(startX, startY, targets);
  }

  public spawnProtonCannon(startX: number, startY: number, targetX: number, targetY: number): void {
    this.skills.spawnProtonCannon(startX, startY, targetX, targetY);
  }

  // ============================================================
  // PUBLIC API - Natural Skills
  // ============================================================

  public spawnGroundSmash(x: number, y: number, intensity: number = 1): void {
    this.skills.spawnGroundSmash(x, y, intensity);
  }

  public spawnKineticBurst(x: number, y: number, intensity: number = 1): void {
    this.skills.spawnKineticBurst(x, y, intensity);
  }

  public spawnShieldThrow(points: { x: number; y: number }[]): void {
    this.skills.spawnShieldThrow(points);
  }

  public spawnWorldbreaker(x: number, y: number): void {
    this.triggerScreenShake(15, 600);
    this.skills.spawnGroundSmash(x, y, 1.5);
    setTimeout(() => {
      this.skills.spawnKineticBurst(x, y, 1.3);
    }, 150);
  }

  // ============================================================
  // PUBLIC API - Ice Skills
  // ============================================================

  public spawnFrostArrow(startX: number, startY: number, targetX: number, targetY: number): void {
    this.skills.spawnFrostArrow(startX, startY, targetX, targetY);
  }

  public spawnFreezeImpact(x: number, y: number, intensity: number = 1): void {
    this.skills.spawnFreezeImpact(x, y, intensity);
  }

  public spawnMultiShot(startX: number, startY: number, targets: { x: number; y: number }[]): void {
    for (const target of targets) {
      this.skills.spawnFrostArrow(startX, startY, target.x, target.y);
    }
  }

  public spawnBlizzardBarrage(x: number, y: number, radius: number = 150): void {
    this.skills.spawnBlizzardBarrage(x, y, radius);
  }

  // ============================================================
  // PUBLIC API - Void/Omega Skills
  // ============================================================

  public spawnExecuteStrike(startX: number, startY: number, targetX: number, targetY: number): void {
    this.skills.spawnExecuteStrike(startX, startY, targetX, targetY);
  }

  public spawnGoldenSlash(x: number, y: number, angle: number): void {
    this.skills.spawnGoldenSlash(x, y, angle);
  }

  public spawnPortalEmit(portalX: number, portalY: number, targetX: number, targetY: number): void {
    this.skills.spawnPortalEmit(portalX, portalY, targetX, targetY);
  }

  // ============================================================
  // PUBLIC API - Status Auras & Misc
  // ============================================================

  public spawnStatusAura(
    x: number,
    y: number,
    effectType: 'slow' | 'freeze' | 'burn' | 'poison' | 'stun',
    intensity: number = 1
  ): void {
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

  private spawnIceAura(x: number, y: number, isFrozen: boolean, intensity: number): void {
    const colors = CLASS_VFX_COLORS.ice;
    for (let i = 0; i < 3; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 10 + Math.random() * 15;
      const p = this.pool.acquire();
      p.x = x + Math.cos(angle) * dist;
      p.y = y + Math.sin(angle) * dist;
      p.vx = (Math.random() - 0.5) * 20;
      p.vy = -20 - Math.random() * 20;
      p.life = 0.3 + Math.random() * 0.2;
      p.maxLife = p.life;
      p.size = (2 + Math.random() * 2) * intensity;
      p.color = isFrozen ? colors.glow : colors.secondary;
      p.shape = 'diamond';
      p.rotation = Math.random() * Math.PI;
      p.rotationSpeed = 2;
      this.particles.push(p);
    }
  }

  private spawnFireAura(x: number, y: number, intensity: number): void {
    const colors = CLASS_VFX_COLORS.fire;
    for (let i = 0; i < 2; i++) {
      const p = this.pool.acquire();
      p.x = x + (Math.random() - 0.5) * 15;
      p.y = y + (Math.random() - 0.5) * 10;
      p.vx = (Math.random() - 0.5) * 20;
      p.vy = -30 - Math.random() * 30;
      p.life = 0.2 + Math.random() * 0.2;
      p.maxLife = p.life;
      p.size = (3 + Math.random() * 3) * intensity;
      p.color = Math.random() > 0.3 ? colors.primary : colors.glow;
      p.shape = 'circle';
      p.gravity = -50;
      this.particles.push(p);
    }
  }

  private spawnPoisonAura(x: number, y: number, intensity: number): void {
    const colors = CLASS_VFX_COLORS.natural;
    for (let i = 0; i < 2; i++) {
      const p = this.pool.acquire();
      p.x = x + (Math.random() - 0.5) * 20;
      p.y = y + (Math.random() - 0.5) * 15;
      p.vx = (Math.random() - 0.5) * 15;
      p.vy = -15 - Math.random() * 20;
      p.life = 0.4 + Math.random() * 0.3;
      p.maxLife = p.life;
      p.startSize = 3 * intensity;
      p.endSize = 8 * intensity;
      p.size = p.startSize;
      p.color = colors.secondary;
      p.startAlpha = 0.5;
      p.endAlpha = 0;
      p.shape = 'smoke';
      this.particles.push(p);
    }
  }

  private spawnStunAura(x: number, y: number, intensity: number): void {
    const colors = CLASS_VFX_COLORS.lightning;
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
  // PUBLIC API - Hero & Turret Effects
  // ============================================================

  public spawnHealEffect(x: number, y: number, type: 'heal' | 'shield' | 'buff'): void {
    const colorMap = {
      heal: { primary: 0x44ff44, secondary: 0x88ff88 },
      shield: { primary: 0x4488ff, secondary: 0x88bbff },
      buff: { primary: 0xffdd44, secondary: 0xffee88 },
    };
    const c = colorMap[type];

    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const p = this.pool.acquire();
      p.x = x + Math.cos(angle) * 15;
      p.y = y + Math.sin(angle) * 15;
      p.vx = Math.cos(angle) * 30;
      p.vy = -40 - Math.random() * 30;
      p.life = 0.5;
      p.maxLife = 0.5;
      p.size = 4;
      p.color = Math.random() > 0.5 ? c.primary : c.secondary;
      p.shape = type === 'buff' ? 'star' : 'circle';
      p.gravity = -30;
      this.particles.push(p);
    }

    this.factory.ring({
      x, y,
      color: c.primary,
      startSize: 10,
      endSize: 40,
      life: 0.4,
      alpha: 0.6,
    });
  }

  public spawnSkillActivation(x: number, y: number, fortressClass: FortressClass, skillLevel: number = 1): void {
    const colors = CLASS_VFX_COLORS[fortressClass];
    const intensity = 0.8 + skillLevel * 0.2;

    // Expanding rings
    for (let i = 0; i < 2; i++) {
      this.factory.ring({
        x, y,
        color: i === 0 ? colors.glow : colors.primary,
        startSize: 10 + i * 5,
        endSize: 50 + i * 20,
        life: 0.4 + i * 0.1,
        alpha: 0.7 - i * 0.2,
      });
    }

    // Radial particles
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12;
      const p = this.pool.acquire();
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * 60 * intensity;
      p.vy = Math.sin(angle) * 60 * intensity;
      p.life = 0.3;
      p.maxLife = 0.3;
      p.size = 3 + Math.random() * 2;
      p.color = Math.random() > 0.5 ? colors.primary : colors.glow;
      p.shape = fortressClass === 'lightning' ? 'spark' : 'circle';
      p.drag = 0.9;
      this.particles.push(p);
    }

    this.factory.flash({ x, y, color: colors.glow, size: 20 * intensity });
  }

  public spawnHeroDeployment(x: number, y: number, fortressClass: FortressClass): void {
    const colors = CLASS_VFX_COLORS[fortressClass];

    // Teleport-in ring
    for (let i = 0; i < 3; i++) {
      this.factory.ring({
        x, y,
        color: i === 0 ? 0xffffff : colors.glow,
        startSize: 30 - i * 5,
        endSize: 5,
        life: 0.4 + i * 0.1,
        alpha: 0.8 - i * 0.2,
      });
    }

    // Particle burst from ground
    for (let i = 0; i < 15; i++) {
      const angle = Math.random() * Math.PI * 2;
      const p = this.pool.acquire();
      p.x = x + Math.cos(angle) * 10;
      p.y = y;
      p.vx = Math.cos(angle) * 50;
      p.vy = -60 - Math.random() * 40;
      p.life = 0.4 + Math.random() * 0.2;
      p.maxLife = p.life;
      p.size = 3 + Math.random() * 3;
      p.color = colors.glow;
      p.shape = 'circle';
      p.gravity = 100;
      this.particles.push(p);
    }

    this.factory.flash({ x, y, color: colors.glow, size: 25 });
  }

  public spawnTurretFire(x: number, y: number, angle: number, fortressClass: FortressClass): void {
    const colors = CLASS_VFX_COLORS[fortressClass];

    // Muzzle flash
    const flash = this.pool.acquire();
    flash.x = x + Math.cos(angle) * 5;
    flash.y = y + Math.sin(angle) * 5;
    flash.vx = 0;
    flash.vy = 0;
    flash.life = 0.08;
    flash.maxLife = 0.08;
    flash.startSize = 8;
    flash.endSize = 15;
    flash.size = 8;
    flash.color = colors.glow;
    flash.startAlpha = 1;
    flash.endAlpha = 0;
    flash.shape = 'circle';
    this.particles.push(flash);

    // Small sparks
    for (let i = 0; i < 3; i++) {
      const spreadAngle = angle + (Math.random() - 0.5) * 0.5;
      const p = this.pool.acquire();
      p.x = x + Math.cos(angle) * 8;
      p.y = y + Math.sin(angle) * 8;
      p.vx = Math.cos(spreadAngle) * (40 + Math.random() * 30);
      p.vy = Math.sin(spreadAngle) * (40 + Math.random() * 30);
      p.life = 0.1 + Math.random() * 0.1;
      p.maxLife = p.life;
      p.size = 2 + Math.random() * 2;
      p.color = colors.glow;
      p.shape = fortressClass === 'lightning' || fortressClass === 'tech' ? 'spark' : 'circle';
      this.particles.push(p);
    }
  }

  public spawnSynergyBond(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    intensity: number = 1
  ): void {
    const lightning = CLASS_VFX_COLORS.lightning;
    const tech = CLASS_VFX_COLORS.tech;

    const dx = endX - startX;
    const dy = endY - startY;
    const length = Math.hypot(dx, dy);
    if (length < 1) return;

    const segments = Math.floor(length / 12);
    for (let i = 0; i <= segments; i++) {
      const progress = i / segments;
      const jitter = (1 - Math.abs(progress - 0.5) * 2) * 8;
      const x = startX + dx * progress + (Math.random() - 0.5) * jitter;
      const y = startY + dy * progress + (Math.random() - 0.5) * jitter;

      const p = this.pool.acquire();
      p.x = x;
      p.y = y;
      p.vx = (Math.random() - 0.5) * 30;
      p.vy = (Math.random() - 0.5) * 30;
      p.life = 0.15 + Math.random() * 0.1;
      p.maxLife = p.life;
      p.size = (2 + Math.random() * 2) * intensity;
      p.color = i % 2 === 0 ? lightning.glow : tech.primary;
      p.shape = 'spark';
      this.particles.push(p);
    }

    this.factory.flash({ x: startX, y: startY, color: lightning.glow, size: 8 * intensity });
    this.factory.flash({ x: endX, y: endY, color: tech.glow, size: 8 * intensity });
  }

  public spawnAreaIndicator(
    x: number,
    y: number,
    radius: number,
    type: 'warning' | 'damage' | 'buff',
    duration: number = 0.5
  ): void {
    const colorMap = {
      warning: 0xff4444,
      damage: 0xff6600,
      buff: 0x44ff44,
    };

    this.factory.ring({
      x, y,
      color: colorMap[type],
      startSize: radius * 0.2,
      endSize: radius,
      life: duration,
      alpha: 0.6,
    });

    const count = Math.floor((radius / 5) * this.particleMultiplier);
    for (let i = 0; i < count; i++) {
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
      gp.color = colorMap[type];
      gp.shape = 'circle';
      gp.alpha = 0.6;
      this.particles.push(gp);
    }
  }

  // ============================================================
  // PUBLIC API - Additional Fire/Plasma Skills
  // ============================================================

  public spawnPlasmaBolt(startX: number, startY: number, targetX: number, targetY: number): void {
    const colors = { primary: 0xdc143c, secondary: 0xff69b4, dark: 0x8b0000 };
    const angle = Math.atan2(targetY - startY, targetX - startX);
    const dist = Math.sqrt((targetX - startX) ** 2 + (targetY - startY) ** 2);

    // Casting effect
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

    // Bolt path
    const steps = Math.floor(dist / 10);
    for (let i = 0; i < steps; i++) {
      const progress = i / steps;
      const wobble = Math.sin(progress * Math.PI * 4) * 10;
      const perpAngle = angle + Math.PI / 2;
      const x = startX + Math.cos(angle) * dist * progress + Math.cos(perpAngle) * wobble;
      const y = startY + Math.sin(angle) * dist * progress + Math.sin(perpAngle) * wobble;

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

      if (i % 2 === 0) {
        const swirl = this.pool.acquire();
        swirl.x = x + Math.cos(progress * Math.PI * 8) * 15;
        swirl.y = y + Math.sin(progress * Math.PI * 8) * 15;
        swirl.vx = (Math.random() - 0.5) * 40;
        swirl.vy = (Math.random() - 0.5) * 40;
        swirl.life = 0.2;
        swirl.maxLife = 0.2;
        swirl.size = 4;
        swirl.color = colors.secondary;
        swirl.shape = 'diamond';
        swirl.rotation = Math.random() * Math.PI;
        swirl.rotationSpeed = 8;
        this.particles.push(swirl);
      }
    }

    this.spawnThermalImpact(targetX, targetY, 1);
  }

  public spawnThermalImpact(x: number, y: number, intensity: number = 1): void {
    const colors = { primary: 0xdc143c, secondary: 0xff69b4, dark: 0x8b0000 };

    this.factory.flash({ x, y, color: colors.secondary, size: 30 * intensity });

    for (let i = 0; i < 3; i++) {
      this.factory.ring({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        color: i % 2 === 0 ? colors.primary : colors.secondary,
        startSize: 10,
        endSize: 70 + i * 20,
        life: 0.4 + i * 0.1,
        alpha: 0.7,
      });
    }

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

  public spawnRealityWarp(x: number, y: number): void {
    const colors = { primary: 0xdc143c, secondary: 0xff69b4, dark: 0x8b0000 };

    this.triggerScreenShake(12, 500);

    this.factory.flash({ x, y, color: 0xffffff, size: 80 });
    this.factory.flash({ x, y, color: colors.primary, size: 120 });

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

    // Chaos rings
    for (let i = 0; i < 5; i++) {
      this.factory.ring({
        x, y,
        color: i % 2 === 0 ? colors.primary : colors.secondary,
        startSize: 20 + i * 15,
        endSize: 250 + i * 40,
        life: 0.8 + i * 0.15,
        alpha: 0.8 - i * 0.1,
      });
    }

    // Swirling orbs
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

  // ============================================================
  // PUBLIC API - Plasma Class Skills
  // ============================================================

  public spawnPlasmaBurst(x: number, y: number, targetX: number, targetY: number): void {
    const colors = CLASS_VFX_COLORS.plasma;
    const dist = Math.sqrt((targetX - x) ** 2 + (targetY - y) ** 2);

    // Charging effect
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

    // Beam trail
    const steps = Math.floor(dist / 10);
    for (let i = 0; i < steps; i++) {
      const progress = i / steps;
      const beamX = x + (targetX - x) * progress;
      const beamY = y + (targetY - y) * progress;

      const core = this.pool.acquire();
      core.x = beamX;
      core.y = beamY;
      core.vx = (Math.random() - 0.5) * 20;
      core.vy = (Math.random() - 0.5) * 20;
      core.life = 0.3 - i * 0.01;
      core.maxLife = 0.3;
      core.size = 6 - progress * 2;
      core.color = 0xffffff;
      core.shape = 'circle';
      core.startAlpha = 1.0;
      core.endAlpha = 0;
      this.particles.push(core);

      const glow = this.pool.acquire();
      glow.x = beamX + (Math.random() - 0.5) * 10;
      glow.y = beamY + (Math.random() - 0.5) * 10;
      glow.vx = (Math.random() - 0.5) * 40;
      glow.vy = (Math.random() - 0.5) * 40;
      glow.life = 0.25 - i * 0.01;
      glow.maxLife = 0.25;
      glow.size = 4 + Math.random() * 3;
      glow.color = colors.primary;
      glow.shape = 'circle';
      glow.startAlpha = 0.7;
      glow.endAlpha = 0;
      this.particles.push(glow);

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

    setTimeout(() => {
      this.spawnPlasmaImpact(targetX, targetY);
    }, steps * 10);

    this.factory.flash({ x, y, color: colors.primary, size: 25 });
  }

  public spawnPlasmaImpact(x: number, y: number): void {
    const colors = CLASS_VFX_COLORS.plasma;

    this.factory.flash({ x, y, color: colors.glow, size: 35 });

    for (let i = 0; i < 3; i++) {
      this.factory.ring({
        x, y,
        color: i % 2 === 0 ? colors.primary : colors.secondary,
        startSize: 15,
        endSize: 60 + i * 20,
        life: 0.4 + i * 0.1,
        alpha: 0.6,
      });
    }

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

    this.triggerScreenShake(5, 150);
  }

  public spawnPlasmaGlow(x: number, y: number, intensity: number = 1): void {
    const colors = CLASS_VFX_COLORS.plasma;

    for (let i = 0; i < 4; i++) {
      const now = performance.now();
      const angle = (Math.PI * 2 * i) / 4 + now * 0.003;
      const dist = 15 + Math.sin(now * 0.005 + i) * 5;
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

  public spawnStealthActivation(x: number, y: number): void {
    const colors = CLASS_VFX_COLORS.plasma;

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

    this.factory.ring({
      x, y,
      color: colors.primary,
      startSize: 40,
      endSize: 10,
      life: 0.4,
      alpha: 0.5,
    });
  }

  public spawnOmegaCritical(x: number, y: number): void {
    const colors = { primary: 0xffd700, secondary: 0x1a1a2a, glow: 0xffaa00 };

    this.factory.flash({ x, y, color: colors.primary, size: 45 });

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

    setTimeout(() => {
      this.spawnHealEffect(x, y, 'heal');
    }, 150);

    this.triggerScreenShake(8, 200);
  }

  public spawnGoldSparks(x: number, y: number, intensity: number = 1): void {
    const colors = { primary: 0xffd700, secondary: 0x1a1a2a, glow: 0xffaa00 };

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

  public spawnExecuteBonus(x: number, y: number): void {
    const colors = { primary: 0xffd700, secondary: 0xff0000, glow: 0xffaa00 };

    this.factory.flash({ x, y, color: colors.secondary, size: 30 });

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

  public spawnRallyUltimate(x: number, y: number, heroPositions: { x: number; y: number }[]): void {
    const colors = { gold: 0xffd700, white: 0xffffff, blue: 0x4169e1 };

    this.factory.flash({ x, y, color: colors.gold, size: 60 });
    this.triggerScreenShake(6, 300);

    for (let i = 0; i < 3; i++) {
      this.factory.ring({
        x, y,
        color: i === 0 ? colors.white : colors.gold,
        startSize: 20,
        endSize: 250 + i * 50,
        life: 0.8 + i * 0.2,
        alpha: 0.8 - i * 0.2,
      });
    }

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

      this.spawnHealEffect(hero.x, hero.y, 'buff');
    }
  }
}
