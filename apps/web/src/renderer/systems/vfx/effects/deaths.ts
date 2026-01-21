import type { Particle, EnemyType, EnemyCategory } from '../types.js';
import type { ParticleFactory } from '../particleFactory.js';
import type { ParticlePool } from '../particlePool.js';
import { ENEMY_DEATH_COLORS, CATEGORY_DEATH_CONFIG, getEnemyCategory } from '../config.js';

/**
 * Enemy death effect handlers.
 * Clean sci-fi disintegration style with category-specific variations.
 */
export class DeathEffects {
  constructor(
    private pool: ParticlePool,
    private particles: Particle[],
    private factory: ParticleFactory
  ) {}

  /**
   * Spawn enemy death VFX - clean sci-fi disintegration style.
   * Different visual styles based on enemy category.
   */
  spawnEnemyDeathVFX(x: number, y: number, enemyType?: EnemyType, isElite: boolean = false): void {
    const category = getEnemyCategory(enemyType);
    const colors = ENEMY_DEATH_COLORS[category];
    const config = CATEGORY_DEATH_CONFIG[category];

    // Simple flash at death point
    this.factory.flash({ x, y, color: colors.primary, size: config.flashSize });

    // Primary expanding ring - clean disintegration effect
    this.factory.ring({
      x, y,
      color: colors.primary,
      startSize: config.ringStartSize,
      endSize: config.ringEndSize,
      life: config.ringLife,
      alpha: 0.6,
    });

    // White core flash
    const core = this.pool.acquire();
    core.x = x;
    core.y = y;
    core.vx = 0;
    core.vy = 0;
    core.life = 0.1;
    core.maxLife = 0.1;
    core.startSize = 8;
    core.endSize = 0;
    core.size = 8;
    core.color = 0xffffff;
    core.shape = 'circle';
    core.startAlpha = 0.8;
    core.endAlpha = 0;
    this.particles.push(core);

    // Category-specific particles
    if (config.useDisintegration) {
      this.spawnDisintegrationParticles(x, y, colors, config, category);
    } else {
      this.spawnSimpleDeathParticles(x, y, colors, config, category);
    }

    // Elite enemies get extra effects
    if (isElite) {
      this.spawnEliteDeathEffect(x, y, colors, config);
    }
  }

  /**
   * Disintegration particles - for sci-fi/cosmic enemies
   */
  private spawnDisintegrationParticles(
    x: number,
    y: number,
    colors: typeof ENEMY_DEATH_COLORS[EnemyCategory],
    config: typeof CATEGORY_DEATH_CONFIG[EnemyCategory],
    category: EnemyCategory
  ): void {
    const count = config.particleCount;

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = config.particleSpeed + Math.random() * 30;
      const p = this.pool.acquire();

      p.x = x + (Math.random() - 0.5) * 8;
      p.y = y + (Math.random() - 0.5) * 8;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 20; // Slight upward bias
      p.life = 0.35 + Math.random() * 0.25;
      p.maxLife = p.life;
      p.size = 2 + Math.random() * 2;
      p.color = Math.random() > 0.4 ? colors.primary : colors.secondary;
      p.shape = colors.particles;
      p.drag = 0.94;
      p.startAlpha = 0.9;
      p.endAlpha = 0;

      // Add rotation for non-circle shapes
      if (colors.particles !== 'circle' && colors.particles !== 'smoke') {
        p.rotation = Math.random() * Math.PI;
        p.rotationSpeed = (Math.random() - 0.5) * 6;
      }

      // Category-specific modifications
      if (category === 'cosmos' || category === 'gods') {
        p.gravity = -30; // Float upward
      } else if (category === 'science') {
        p.gravity = 50; // Fall down
      }

      this.particles.push(p);
    }

    // Add shimmer trail for cosmic/magic
    if (category === 'cosmos' || category === 'magic' || category === 'gods') {
      this.spawnShimmerTrail(x, y, colors, 6);
    }
  }

  /**
   * Simple death particles - for basic enemies
   */
  private spawnSimpleDeathParticles(
    x: number,
    y: number,
    colors: typeof ENEMY_DEATH_COLORS[EnemyCategory],
    config: typeof CATEGORY_DEATH_CONFIG[EnemyCategory],
    _category: EnemyCategory
  ): void {
    const count = Math.floor(config.particleCount * 0.7);

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = config.particleSpeed * 0.7 + Math.random() * 20;
      const p = this.pool.acquire();

      p.x = x + (Math.random() - 0.5) * 10;
      p.y = y + (Math.random() - 0.5) * 10;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = 0.25 + Math.random() * 0.2;
      p.maxLife = p.life;
      p.size = 2 + Math.random() * 2;
      p.color = Math.random() > 0.5 ? colors.primary : colors.secondary;
      p.shape = 'circle';
      p.drag = 0.92;

      this.particles.push(p);
    }
  }

  /**
   * Elite death effect - larger ring + glow burst
   */
  private spawnEliteDeathEffect(
    x: number,
    y: number,
    colors: typeof ENEMY_DEATH_COLORS[EnemyCategory],
    config: typeof CATEGORY_DEATH_CONFIG[EnemyCategory]
  ): void {
    // Outer elite ring
    this.factory.ring({
      x, y,
      color: colors.secondary,
      startSize: config.ringEndSize * 0.5,
      endSize: config.ringEndSize * 1.8,
      life: config.ringLife * 1.5,
      alpha: 0.5,
    });

    // Glow burst
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const p = this.pool.acquire();
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * 80;
      p.vy = Math.sin(angle) * 80;
      p.life = 0.3;
      p.maxLife = 0.3;
      p.size = 4;
      p.color = 0xffffff;
      p.shape = 'star';
      p.rotation = angle;
      p.drag = 0.9;
      p.startAlpha = 0.9;
      p.endAlpha = 0;
      this.particles.push(p);
    }
  }

  /**
   * Shimmer trail for magical/cosmic deaths
   */
  private spawnShimmerTrail(
    x: number,
    y: number,
    colors: typeof ENEMY_DEATH_COLORS[EnemyCategory],
    count: number
  ): void {
    for (let i = 0; i < count; i++) {
      const p = this.pool.acquire();
      p.x = x + (Math.random() - 0.5) * 20;
      p.y = y + (Math.random() - 0.5) * 20;
      p.vx = (Math.random() - 0.5) * 30;
      p.vy = -40 - Math.random() * 30; // Float up
      p.life = 0.5 + Math.random() * 0.3;
      p.maxLife = p.life;
      p.size = 2 + Math.random() * 2;
      p.color = Math.random() > 0.5 ? colors.primary : 0xffffff;
      p.shape = 'star';
      p.rotation = Math.random() * Math.PI;
      p.rotationSpeed = 3;
      p.gravity = -20;
      p.startAlpha = 0.7;
      p.endAlpha = 0;
      this.particles.push(p);
    }
  }

  /**
   * Boss death effect - much larger and more dramatic
   */
  spawnBossDeathVFX(x: number, y: number, enemyType?: EnemyType): void {
    const category = getEnemyCategory(enemyType);
    const colors = ENEMY_DEATH_COLORS[category];

    // Large central flash
    this.factory.flash({ x, y, color: 0xffffff, size: 40 });
    this.factory.flash({ x, y, color: colors.primary, size: 60 });

    // Multiple expanding rings
    for (let i = 0; i < 3; i++) {
      this.factory.ring({
        x, y,
        color: i === 0 ? 0xffffff : colors.primary,
        startSize: 10 + i * 10,
        endSize: 80 + i * 40,
        life: 0.4 + i * 0.15,
        alpha: 0.7 - i * 0.15,
      });
    }

    // Massive particle burst
    const burstCount = 30;
    for (let i = 0; i < burstCount; i++) {
      const angle = (Math.PI * 2 * i) / burstCount + Math.random() * 0.3;
      const speed = 100 + Math.random() * 100;
      const p = this.pool.acquire();
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = 0.6 + Math.random() * 0.4;
      p.maxLife = p.life;
      p.size = 4 + Math.random() * 4;
      p.color = Math.random() > 0.3 ? colors.primary : colors.secondary;
      p.shape = colors.particles;
      p.drag = 0.95;
      p.gravity = 50;
      if (colors.particles !== 'circle') {
        p.rotation = Math.random() * Math.PI;
        p.rotationSpeed = (Math.random() - 0.5) * 8;
      }
      this.particles.push(p);
    }

    // Shimmer for all boss deaths
    this.spawnShimmerTrail(x, y, colors, 15);
  }
}
