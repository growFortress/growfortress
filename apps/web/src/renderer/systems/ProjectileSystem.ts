import { Container, Graphics } from 'pixi.js';
import type { GameState, ActiveProjectile, FortressClass, ProjectileType } from '@arcade/sim-core';
import { FP } from '@arcade/sim-core';

// --- CLASS COLORS (simplified: 5 classes) ---
const CLASS_COLORS: Record<FortressClass, { primary: number; secondary: number; glow: number }> = {
  natural: { primary: 0x228b22, secondary: 0x32cd32, glow: 0x44ff44 },
  ice: { primary: 0x00bfff, secondary: 0x87ceeb, glow: 0xadd8e6 },
  fire: { primary: 0xff4500, secondary: 0xff6600, glow: 0xffaa00 },
  lightning: { primary: 0x9932cc, secondary: 0xda70d6, glow: 0xffffff },
  tech: { primary: 0x00f0ff, secondary: 0x00ffff, glow: 0xffffff },
};

// --- PROJECTILE VISUAL CONFIG (enhanced with longer trails) ---
const PROJECTILE_CONFIG: Record<ProjectileType, {
  size: number;
  trailLength: number;
  shape: 'circle' | 'spike' | 'bolt' | 'orb';
  emissionRate: number; // particles per second
  motionBlur: number; // stretch factor
}> = {
  physical: { size: 8, trailLength: 8, shape: 'circle', emissionRate: 15, motionBlur: 1.5 },
  icicle: { size: 12, trailLength: 12, shape: 'spike', emissionRate: 20, motionBlur: 2.0 },
  fireball: { size: 14, trailLength: 15, shape: 'circle', emissionRate: 40, motionBlur: 1.8 },
  bolt: { size: 6, trailLength: 18, shape: 'bolt', emissionRate: 30, motionBlur: 3.0 },
  laser: { size: 4, trailLength: 25, shape: 'bolt', emissionRate: 25, motionBlur: 4.0 },
};

// Map FortressClass to ProjectileType (simplified: 5 classes)
const CLASS_TO_PROJECTILE: Record<FortressClass, ProjectileType> = {
  natural: 'physical',
  ice: 'icicle',
  fire: 'fireball',
  lightning: 'bolt',
  tech: 'laser',
};

interface ProjectileVisual {
  container: Container;
  trail: { x: number; y: number }[];
  lastEmissionTime: number;
}

// Callback type for spawning VFX particles
type VFXCallback = (x: number, y: number, fortressClass: FortressClass) => void;

export class ProjectileSystem {
  public container: Container;
  private graphics: Graphics;
  private visuals: Map<number, ProjectileVisual> = new Map();
  private time: number = 0;
  private vfxCallback: VFXCallback | null = null;

  constructor() {
    this.container = new Container();
    this.graphics = new Graphics();
    this.container.addChild(this.graphics);
  }

  /**
   * Set callback for spawning flight particles via VFXSystem
   */
  public setVFXCallback(callback: VFXCallback) {
    this.vfxCallback = callback;
  }

  public update(state: GameState, viewWidth: number, viewHeight: number) {
    const g = this.graphics;
    g.clear();

    this.time += 16.66; // Approximate frame time in ms

    const currentIds = new Set<number>();

    for (const projectile of state.projectiles) {
      currentIds.add(projectile.id);

      // Get or create visual data
      let visual = this.visuals.get(projectile.id);
      if (!visual) {
        visual = {
          container: new Container(),
          trail: [],
          lastEmissionTime: this.time,
        };
        this.visuals.set(projectile.id, visual);
      }

      // Calculate screen X position from simulation
      const screenX = this.toScreenX(projectile.x, viewWidth);

      // Calculate screen Y by interpolating between start and target lane
      const startScreenY = this.getSourceScreenY(projectile, viewHeight);
      const targetScreenY = this.calculateEnemyLaneY(projectile.targetEnemyId, viewHeight);

      // Calculate progress (0 = at start, 1 = at target)
      const startX = FP.toFloat(projectile.startX);
      const currentX = FP.toFloat(projectile.x);
      const targetX = FP.toFloat(projectile.targetX);
      const totalDist = Math.abs(targetX - startX);
      const traveledDist = Math.abs(currentX - startX);
      const progress = totalDist > 0 ? Math.min(1, traveledDist / totalDist) : 1;

      // Interpolate Y position for smooth trajectory
      const screenY = startScreenY + (targetScreenY - startScreenY) * progress;

      // Update trail
      visual.trail.unshift({ x: screenX, y: screenY });
      const projectileType = CLASS_TO_PROJECTILE[projectile.class] || 'physical';
      const config = PROJECTILE_CONFIG[projectileType];
      while (visual.trail.length > config.trailLength) {
        visual.trail.pop();
      }

      // Emit flight particles
      this.emitFlightParticles(projectile, screenX, screenY, visual, config);

      // Draw projectile based on class
      this.drawProjectile(g, projectile, screenX, screenY, visual.trail);
    }

    // Remove dead projectiles
    for (const [id, visual] of this.visuals) {
      if (!currentIds.has(id)) {
        visual.container.destroy({ children: true });
        this.visuals.delete(id);
      }
    }
  }

  private emitFlightParticles(
    projectile: ActiveProjectile,
    x: number,
    y: number,
    visual: ProjectileVisual,
    config: typeof PROJECTILE_CONFIG[ProjectileType]
  ) {
    if (!this.vfxCallback) return;

    const emissionInterval = 1000 / config.emissionRate;
    if (this.time - visual.lastEmissionTime >= emissionInterval) {
      visual.lastEmissionTime = this.time;

      // Emit particle at slightly offset position
      const offsetX = (Math.random() - 0.5) * 10;
      const offsetY = (Math.random() - 0.5) * 10;
      this.vfxCallback(x + offsetX, y + offsetY, projectile.class);
    }
  }

  // Get screen Y for projectile source (fortress, turret, or hero)
  private getSourceScreenY(projectile: ActiveProjectile, viewHeight: number): number {
    // Use the stored start Y position
    return this.toScreenY(projectile.startY, viewHeight);
  }

  private drawProjectile(
    g: Graphics,
    projectile: ActiveProjectile,
    x: number,
    y: number,
    trail: { x: number; y: number }[]
  ) {
    const colors = CLASS_COLORS[projectile.class] || CLASS_COLORS.natural;
    const projectileType = CLASS_TO_PROJECTILE[projectile.class] || 'physical';
    const config = PROJECTILE_CONFIG[projectileType];

    // Draw enhanced gradient trail
    this.drawGradientTrail(g, trail, colors, config);

    // Draw main projectile based on type (simplified: 5 classes)
    switch (projectile.class) {
      case 'natural':
        this.drawNaturalProjectile(g, x, y, config.size, colors, trail);
        break;
      case 'ice':
        this.drawIceProjectile(g, x, y, config.size, colors, projectile, trail);
        break;
      case 'fire':
        this.drawFireProjectile(g, x, y, config.size, colors, trail);
        break;
      case 'lightning':
        this.drawLightningProjectile(g, x, y, trail, colors);
        break;
      case 'tech':
        this.drawTechProjectile(g, x, y, trail, colors);
        break;
      default:
        this.drawNaturalProjectile(g, x, y, config.size, colors, trail);
    }
  }

  /**
   * Draw enhanced gradient trail with fading alpha and decreasing width
   */
  private drawGradientTrail(
    g: Graphics,
    trail: { x: number; y: number }[],
    colors: { primary: number; secondary: number; glow: number },
    config: typeof PROJECTILE_CONFIG[ProjectileType]
  ) {
    if (trail.length < 2) return;

    // Draw trail as connected segments with gradient
    for (let i = 1; i < trail.length; i++) {
      const progress = i / trail.length;
      const alpha = (1 - progress) * 0.6;
      const width = config.size * (1 - progress * 0.7);

      if (width < 0.5 || alpha < 0.05) continue;

      // Outer glow
      g.moveTo(trail[i - 1].x, trail[i - 1].y);
      g.lineTo(trail[i].x, trail[i].y);
      g.stroke({ width: width * 2, color: colors.glow, alpha: alpha * 0.3 });

      // Inner trail
      g.moveTo(trail[i - 1].x, trail[i - 1].y);
      g.lineTo(trail[i].x, trail[i].y);
      g.stroke({ width: width, color: colors.primary, alpha: alpha * 0.6 });

      // Core line
      g.moveTo(trail[i - 1].x, trail[i - 1].y);
      g.lineTo(trail[i].x, trail[i].y);
      g.stroke({ width: width * 0.4, color: colors.secondary, alpha: alpha * 0.8 });
    }

    // Add sparkle particles along trail
    for (let i = 2; i < trail.length; i += 3) {
      const progress = i / trail.length;
      const alpha = (1 - progress) * 0.5;
      const size = config.size * (1 - progress) * 0.3;

      if (size > 0.5 && Math.random() > 0.5) {
        g.circle(trail[i].x + (Math.random() - 0.5) * 5, trail[i].y + (Math.random() - 0.5) * 5, size)
          .fill({ color: colors.glow, alpha });
      }
    }
  }

  // Natural: Green glowing sphere with motion blur
  private drawNaturalProjectile(
    g: Graphics,
    x: number,
    y: number,
    size: number,
    colors: { primary: number; secondary: number; glow: number },
    trail: { x: number; y: number }[]
  ) {
    // Calculate motion blur direction
    const speed = trail.length > 1 ? Math.sqrt((x - trail[1].x) ** 2 + (y - trail[1].y) ** 2) : 0;
    const stretch = 1 + Math.min(speed / 30, 1.5);

    // Outer glow (stretched)
    g.ellipse(x, y, size * 1.8 * stretch, size * 1.5)
      .fill({ color: colors.glow, alpha: 0.25 });

    // Mid glow
    g.ellipse(x, y, size * 1.3 * stretch, size * 1.2)
      .fill({ color: colors.secondary, alpha: 0.4 });

    // Core
    g.circle(x, y, size)
      .fill({ color: colors.primary });

    // Inner highlight
    g.circle(x - size * 0.3, y - size * 0.3, size * 0.4)
      .fill({ color: colors.glow, alpha: 0.7 });

    // Leaf particles trailing behind
    if (trail.length > 2) {
      for (let i = 1; i < Math.min(4, trail.length); i++) {
        const leafSize = size * 0.3 * (1 - i / 5);
        const leafAlpha = 0.6 * (1 - i / 5);
        const leafX = trail[i].x + (Math.random() - 0.5) * 8;
        const leafY = trail[i].y + (Math.random() - 0.5) * 8;

        // Diamond-shaped leaf
        g.poly([
          leafX, leafY - leafSize,
          leafX + leafSize * 0.6, leafY,
          leafX, leafY + leafSize,
          leafX - leafSize * 0.6, leafY,
        ]).fill({ color: colors.secondary, alpha: leafAlpha });
      }
    }
  }

  // Ice: Sharp icicle spike with crystal trail
  private drawIceProjectile(
    g: Graphics,
    x: number,
    y: number,
    size: number,
    colors: { primary: number; secondary: number; glow: number },
    projectile: ActiveProjectile,
    trail: { x: number; y: number }[]
  ) {
    // Calculate direction
    const dx = projectile.targetX - projectile.x;
    const dy = projectile.targetY - projectile.y;
    const angle = Math.atan2(FP.toFloat(dy), FP.toFloat(dx));

    // Outer frost glow
    g.circle(x, y, size * 1.5)
      .fill({ color: colors.glow, alpha: 0.2 });

    // Ice spike shape (elongated)
    const tipX = x + Math.cos(angle) * size * 2;
    const tipY = y + Math.sin(angle) * size * 2;
    const backX = x - Math.cos(angle) * size * 0.8;
    const backY = y - Math.sin(angle) * size * 0.8;
    const perpX = Math.cos(angle + Math.PI / 2);
    const perpY = Math.sin(angle + Math.PI / 2);

    // Main spike
    g.poly([
      tipX, tipY,
      backX + perpX * size * 0.5, backY + perpY * size * 0.5,
      backX - perpX * size * 0.5, backY - perpY * size * 0.5,
    ])
      .fill({ color: colors.primary })
      .stroke({ width: 1, color: colors.glow, alpha: 0.8 });

    // Inner bright core
    g.poly([
      tipX - (tipX - x) * 0.3, tipY - (tipY - y) * 0.3,
      backX + perpX * size * 0.2, backY + perpY * size * 0.2,
      backX - perpX * size * 0.2, backY - perpY * size * 0.2,
    ])
      .fill({ color: 0xffffff, alpha: 0.6 });

    // Ice crystal particles in trail
    if (trail.length > 2) {
      for (let i = 2; i < Math.min(6, trail.length); i += 2) {
        const crystalSize = size * 0.25 * (1 - i / 8);
        const crystalAlpha = 0.5 * (1 - i / 8);
        const cx = trail[i].x + (Math.random() - 0.5) * 12;
        const cy = trail[i].y + (Math.random() - 0.5) * 12;

        // Small diamond crystal
        g.poly([
          cx, cy - crystalSize,
          cx + crystalSize * 0.6, cy,
          cx, cy + crystalSize,
          cx - crystalSize * 0.6, cy,
        ]).fill({ color: colors.glow, alpha: crystalAlpha });
      }
    }
  }

  // Fire: Flickering fireball with ember trail
  private drawFireProjectile(
    g: Graphics,
    x: number,
    y: number,
    size: number,
    colors: { primary: number; secondary: number; glow: number },
    trail: { x: number; y: number }[]
  ) {
    const time = this.time / 80;
    const flicker = Math.sin(time) * 0.15 + Math.sin(time * 2.3) * 0.1 + 1;

    // Calculate direction for flame stretch
    const angle = trail.length > 1 ? Math.atan2(y - trail[1].y, x - trail[1].x) : 0;
    const stretch = 1.3;

    // Outer heat distortion
    g.ellipse(x, y, size * 2.5 * flicker, size * 2 * flicker)
      .fill({ color: colors.glow, alpha: 0.15 });

    // Outer flame glow
    g.ellipse(x - Math.cos(angle) * size * 0.3, y - Math.sin(angle) * size * 0.3, size * 2 * flicker * stretch, size * 1.5 * flicker)
      .fill({ color: colors.glow, alpha: 0.25 });

    // Mid flame
    g.ellipse(x, y, size * 1.4 * flicker * stretch, size * 1.2 * flicker)
      .fill({ color: colors.secondary, alpha: 0.7 });

    // Core flame
    g.circle(x, y, size * flicker)
      .fill({ color: colors.primary });

    // Hot white center
    g.circle(x, y, size * 0.5)
      .fill({ color: 0xffff88 });

    g.circle(x, y, size * 0.25)
      .fill({ color: 0xffffff });

    // Ember particles trailing behind
    if (trail.length > 2) {
      for (let i = 1; i < Math.min(8, trail.length); i++) {
        const emberSize = size * 0.3 * (1 - i / 10);
        const emberAlpha = 0.7 * (1 - i / 10);
        const emberX = trail[i].x + (Math.random() - 0.5) * 15;
        const emberY = trail[i].y + (Math.random() - 0.5) * 10 - i * 2; // Rise up

        // Ember with varying colors
        const emberColor = Math.random() > 0.5 ? colors.primary : colors.glow;
        g.circle(emberX, emberY, emberSize)
          .fill({ color: emberColor, alpha: emberAlpha });
      }
    }

    // Smoke wisps at tail
    if (trail.length > 4) {
      for (let i = 4; i < Math.min(10, trail.length); i += 2) {
        const smokeSize = size * 0.5 * (1 - (i - 4) / 8);
        const smokeAlpha = 0.2 * (1 - (i - 4) / 8);
        const smokeX = trail[i].x + (Math.random() - 0.5) * 10;
        const smokeY = trail[i].y - (i - 4) * 3; // Rise up

        g.circle(smokeX, smokeY, smokeSize)
          .fill({ color: 0x444444, alpha: smokeAlpha });
      }
    }
  }

  // Lightning: Electric bolt with branches
  private drawLightningProjectile(
    g: Graphics,
    x: number,
    y: number,
    trail: { x: number; y: number }[],
    colors: { primary: number; secondary: number; glow: number }
  ) {
    // Large glow at current position
    g.circle(x, y, 15)
      .fill({ color: colors.glow, alpha: 0.4 });

    g.circle(x, y, 8)
      .fill({ color: 0xffffff, alpha: 0.6 });

    // Draw jagged bolt through trail with random jitter
    if (trail.length > 1) {
      // Regenerate jitter each frame for flickering effect
      const jitterPoints: { x: number; y: number }[] = trail.map((p, i) => ({
        x: p.x + (i > 0 && i < trail.length - 1 ? (Math.random() - 0.5) * 15 : 0),
        y: p.y + (i > 0 && i < trail.length - 1 ? (Math.random() - 0.5) * 15 : 0),
      }));

      // Outer glow bolt
      g.moveTo(jitterPoints[0].x, jitterPoints[0].y);
      for (let i = 1; i < jitterPoints.length; i++) {
        g.lineTo(jitterPoints[i].x, jitterPoints[i].y);
      }
      g.stroke({ width: 8, color: colors.glow, alpha: 0.3 });

      // Main bolt
      g.moveTo(jitterPoints[0].x, jitterPoints[0].y);
      for (let i = 1; i < jitterPoints.length; i++) {
        g.lineTo(jitterPoints[i].x, jitterPoints[i].y);
      }
      g.stroke({ width: 4, color: colors.primary, alpha: 0.8 });

      // Inner bright line
      g.moveTo(jitterPoints[0].x, jitterPoints[0].y);
      for (let i = 1; i < jitterPoints.length; i++) {
        g.lineTo(jitterPoints[i].x, jitterPoints[i].y);
      }
      g.stroke({ width: 2, color: 0xffffff });

      // Random branches
      for (let i = 2; i < jitterPoints.length - 2; i += 3) {
        if (Math.random() > 0.4) {
          const branchLen = 20 + Math.random() * 20;
          const branchAngle = Math.random() * Math.PI * 2;
          const bx = jitterPoints[i].x + Math.cos(branchAngle) * branchLen;
          const by = jitterPoints[i].y + Math.sin(branchAngle) * branchLen;

          g.moveTo(jitterPoints[i].x, jitterPoints[i].y);
          g.lineTo(bx, by);
          g.stroke({ width: 2, color: colors.glow, alpha: 0.5 });

          g.moveTo(jitterPoints[i].x, jitterPoints[i].y);
          g.lineTo(bx, by);
          g.stroke({ width: 1, color: 0xffffff, alpha: 0.6 });
        }
      }

      // Spark particles along bolt
      for (let i = 1; i < jitterPoints.length; i += 2) {
        const sparkSize = 2 + Math.random() * 2;
        g.circle(jitterPoints[i].x, jitterPoints[i].y, sparkSize)
          .fill({ color: 0xffffff, alpha: 0.8 });
      }
    }

    // Central spark at tip
    g.circle(x, y, 5)
      .fill({ color: 0xffffff });

    // Electric arc effect at tip
    for (let i = 0; i < 3; i++) {
      const arcAngle = (i / 3) * Math.PI * 2 + this.time / 50;
      const arcLen = 8 + Math.random() * 5;
      const ax = x + Math.cos(arcAngle) * arcLen;
      const ay = y + Math.sin(arcAngle) * arcLen;

      g.moveTo(x, y);
      g.lineTo(ax, ay);
      g.stroke({ width: 1.5, color: colors.glow, alpha: 0.6 });
    }
  }

  // Tech: Laser beam with data fragments
  private drawTechProjectile(
    g: Graphics,
    x: number,
    y: number,
    trail: { x: number; y: number }[],
    colors: { primary: number; secondary: number; glow: number }
  ) {
    // Draw laser line through trail
    if (trail.length > 1) {
      // Outer glow beam
      g.moveTo(trail[trail.length - 1].x, trail[trail.length - 1].y);
      for (const point of trail) {
        g.lineTo(point.x, point.y);
      }
      g.stroke({ width: 10, color: colors.glow, alpha: 0.2 });

      // Mid beam
      g.moveTo(trail[trail.length - 1].x, trail[trail.length - 1].y);
      for (const point of trail) {
        g.lineTo(point.x, point.y);
      }
      g.stroke({ width: 5, color: colors.primary, alpha: 0.6 });

      // Main beam
      g.moveTo(trail[trail.length - 1].x, trail[trail.length - 1].y);
      for (const point of trail) {
        g.lineTo(point.x, point.y);
      }
      g.stroke({ width: 3, color: colors.secondary });

      // Inner bright core
      g.moveTo(trail[trail.length - 1].x, trail[trail.length - 1].y);
      for (const point of trail) {
        g.lineTo(point.x, point.y);
      }
      g.stroke({ width: 1.5, color: 0xffffff });

      // Data fragment particles (squares)
      for (let i = 2; i < trail.length; i += 3) {
        const fragSize = 3 * (1 - i / trail.length);
        const fragAlpha = 0.6 * (1 - i / trail.length);
        const fx = trail[i].x + (Math.random() - 0.5) * 8;
        const fy = trail[i].y + (Math.random() - 0.5) * 8;

        g.rect(fx - fragSize / 2, fy - fragSize / 2, fragSize, fragSize)
          .fill({ color: colors.glow, alpha: fragAlpha });
      }

      // Scan line effect
      const scanPos = (this.time / 100) % 1;
      const scanIndex = Math.floor(scanPos * trail.length);
      if (scanIndex < trail.length) {
        g.circle(trail[scanIndex].x, trail[scanIndex].y, 4)
          .fill({ color: 0xffffff, alpha: 0.8 });
      }
    }

    // Impact point with pulse
    const pulse = Math.sin(this.time / 50) * 0.3 + 1;
    g.circle(x, y, 6 * pulse)
      .fill({ color: colors.glow, alpha: 0.5 });

    g.circle(x, y, 4)
      .fill({ color: colors.primary });

    g.circle(x, y, 2)
      .fill({ color: 0xffffff });

    // Cross-hair at impact
    const crossSize = 8;
    g.moveTo(x - crossSize, y);
    g.lineTo(x + crossSize, y);
    g.stroke({ width: 1, color: colors.glow, alpha: 0.4 });

    g.moveTo(x, y - crossSize);
    g.lineTo(x, y + crossSize);
    g.stroke({ width: 1, color: colors.glow, alpha: 0.4 });
  }

  // --- Helpers ---
  private toScreenX(fpX: number, viewWidth: number): number {
    const unitX = FP.toFloat(fpX);
    const fieldWidth = 40;
    return (unitX / fieldWidth) * viewWidth;
  }

  private toScreenY(fpY: number, viewHeight: number): number {
    const unitY = FP.toFloat(fpY);
    const fieldHeight = 15;
    // Map to path area (35% to 65% of screen height - narrower path with turret lanes)
    const pathTop = viewHeight * 0.35;
    const pathBottom = viewHeight * 0.65;
    return pathTop + (unitY / fieldHeight) * (pathBottom - pathTop);
  }

  // Calculate enemy lane Y position (must match EnemySystem)
  private calculateEnemyLaneY(enemyId: number, viewHeight: number): number {
    const enemyVerticalLanes = 7;
    const enemyVerticalSpread = 40;
    const laneOffset = (enemyId % enemyVerticalLanes) - Math.floor(enemyVerticalLanes / 2);
    return viewHeight / 2 + laneOffset * enemyVerticalSpread;
  }
}
