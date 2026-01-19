import { Container, Graphics } from 'pixi.js';
import type { GameState, ActiveProjectile, FortressClass, ProjectileType } from '@arcade/sim-core';
import { FP } from '@arcade/sim-core';
import { fpXToScreen, fpYToScreen } from '../CoordinateSystem.js';

// --- CLASS COLORS (7 classes) ---
const CLASS_COLORS: Record<FortressClass, { primary: number; secondary: number; glow: number; core: number }> = {
  natural: { primary: 0x228b22, secondary: 0x32cd32, glow: 0x44ff44, core: 0x88ff88 },
  ice: { primary: 0x00bfff, secondary: 0x87ceeb, glow: 0xadd8e6, core: 0xffffff },
  fire: { primary: 0xff4500, secondary: 0xff6600, glow: 0xffaa00, core: 0xffff88 },
  lightning: { primary: 0x9932cc, secondary: 0xda70d6, glow: 0xffffff, core: 0xffffff },
  tech: { primary: 0x00f0ff, secondary: 0x00ffff, glow: 0xffffff, core: 0xaaffff },
  void: { primary: 0x4b0082, secondary: 0x8b008b, glow: 0x9400d3, core: 0xda70d6 },
  plasma: { primary: 0x00ffff, secondary: 0xff00ff, glow: 0xffffff, core: 0xffaaff },
};

// --- COLOR HELPERS ---
function lightenColor(color: number, factor: number): number {
  const r = Math.min(255, ((color >> 16) & 0xff) + 255 * factor);
  const g = Math.min(255, ((color >> 8) & 0xff) + 255 * factor);
  const b = Math.min(255, (color & 0xff) + 255 * factor);
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

function darkenColor(color: number, factor: number): number {
  const r = Math.max(0, ((color >> 16) & 0xff) * (1 - factor));
  const g = Math.max(0, ((color >> 8) & 0xff) * (1 - factor));
  const b = Math.max(0, (color & 0xff) * (1 - factor));
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

function blendColors(color1: number, color2: number, t: number): number {
  const r1 = (color1 >> 16) & 0xff;
  const g1 = (color1 >> 8) & 0xff;
  const b1 = color1 & 0xff;
  const r2 = (color2 >> 16) & 0xff;
  const g2 = (color2 >> 8) & 0xff;
  const b2 = color2 & 0xff;
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return (r << 16) | (g << 8) | b;
}

// --- PROJECTILE VISUAL CONFIG (enhanced with longer trails) ---
const PROJECTILE_CONFIG: Record<ProjectileType, {
  size: number;
  trailLength: number;
  shape: 'circle' | 'spike' | 'bolt' | 'orb' | 'plasma' | 'slash';
  emissionRate: number; // particles per second
  motionBlur: number; // stretch factor
  ghostCount: number; // afterimage count
  pulseSpeed: number; // core pulse frequency
  glowLayers: number; // number of glow rings
}> = {
  physical: { size: 8, trailLength: 8, shape: 'circle', emissionRate: 15, motionBlur: 1.5, ghostCount: 3, pulseSpeed: 4, glowLayers: 2 },
  icicle: { size: 12, trailLength: 12, shape: 'spike', emissionRate: 20, motionBlur: 2.0, ghostCount: 4, pulseSpeed: 3, glowLayers: 3 },
  fireball: { size: 14, trailLength: 15, shape: 'circle', emissionRate: 40, motionBlur: 1.8, ghostCount: 5, pulseSpeed: 8, glowLayers: 4 },
  bolt: { size: 6, trailLength: 18, shape: 'bolt', emissionRate: 30, motionBlur: 3.0, ghostCount: 6, pulseSpeed: 12, glowLayers: 2 },
  laser: { size: 4, trailLength: 25, shape: 'bolt', emissionRate: 25, motionBlur: 4.0, ghostCount: 8, pulseSpeed: 6, glowLayers: 3 },
  // Exclusive hero projectiles
  plasma_beam: { size: 10, trailLength: 22, shape: 'plasma', emissionRate: 50, motionBlur: 3.5, ghostCount: 7, pulseSpeed: 15, glowLayers: 4 },
  void_slash: { size: 16, trailLength: 12, shape: 'slash', emissionRate: 35, motionBlur: 2.5, ghostCount: 5, pulseSpeed: 10, glowLayers: 3 },
};

// Map FortressClass to ProjectileType (7 classes)
const CLASS_TO_PROJECTILE: Record<FortressClass, ProjectileType> = {
  natural: 'physical',
  ice: 'icicle',
  fire: 'fireball',
  lightning: 'bolt',
  tech: 'laser',
  void: 'void_slash',
  plasma: 'plasma_beam',
};

interface ProjectileVisual {
  container: Container;
  trail: { x: number; y: number }[];
  lastEmissionTime: number;
  // Animation state
  pulsePhase: number;
  rotationAngle: number;
  energyIntensity: number;
  birthTime: number;
  // Store class for impact VFX
  fortressClass: FortressClass;
}

// Callback type for spawning VFX particles
type VFXCallback = (x: number, y: number, fortressClass: FortressClass) => void;

// Callback type for impact VFX
type ImpactCallback = (x: number, y: number, fortressClass: FortressClass) => void;

export class ProjectileSystem {
  public container: Container;
  private graphics: Graphics;
  private ghostGraphics: Graphics; // Separate layer for afterimages
  private visuals: Map<number, ProjectileVisual> = new Map();
  private time: number = 0;
  private vfxCallback: VFXCallback | null = null;
  private impactCallback: ImpactCallback | null = null;
  private previousProjectileIds: Set<number> = new Set();

  constructor() {
    this.container = new Container();
    this.ghostGraphics = new Graphics(); // Behind main projectiles
    this.graphics = new Graphics();
    this.container.addChild(this.ghostGraphics);
    this.container.addChild(this.graphics);
  }

  /**
   * Set callback for spawning flight particles via VFXSystem
   */
  public setVFXCallback(callback: VFXCallback) {
    this.vfxCallback = callback;
  }

  /**
   * Set callback for spawning impact sparks when projectiles hit
   */
  public setImpactCallback(callback: ImpactCallback) {
    this.impactCallback = callback;
  }

  public update(state: GameState, viewWidth: number, viewHeight: number) {
    const g = this.graphics;
    const gg = this.ghostGraphics;
    g.clear();
    gg.clear();

    this.time += 16.66; // Approximate frame time in ms
    const dt = 16.66 / 1000;

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
          pulsePhase: Math.random() * Math.PI * 2,
          rotationAngle: 0,
          energyIntensity: 1,
          birthTime: this.time,
          fortressClass: projectile.class,
        };
        this.visuals.set(projectile.id, visual);
      }

      // Update animation state
      const projectileType = CLASS_TO_PROJECTILE[projectile.class] || 'physical';
      const config = PROJECTILE_CONFIG[projectileType];
      visual.pulsePhase += config.pulseSpeed * dt;
      visual.rotationAngle += dt * 3; // Slow rotation

      // Energy intensity fluctuation
      const age = (this.time - visual.birthTime) / 1000;
      visual.energyIntensity = 0.85 + Math.sin(visual.pulsePhase) * 0.15 + Math.min(age * 2, 0.15);

      // Calculate screen X position from simulation
      const screenX = fpXToScreen(projectile.x, viewWidth);

      // Calculate screen Y by interpolating between start and actual target position
      const startScreenY = this.getSourceScreenY(projectile, viewHeight);
      const targetScreenY = fpYToScreen(projectile.targetY, viewHeight);

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
      while (visual.trail.length > config.trailLength) {
        visual.trail.pop();
      }

      // Emit flight particles
      this.emitFlightParticles(projectile, screenX, screenY, visual, config);

      // Draw ghost afterimages (on separate graphics layer behind)
      this.drawGhostAfterimages(gg, projectile.class, visual.trail, config);

      // Draw projectile based on class
      this.drawProjectile(g, projectile, screenX, screenY, visual.trail, visual);
    }

    // Detect projectile impacts and spawn class-specific VFX
    for (const [id, visual] of this.visuals) {
      if (!currentIds.has(id) && this.previousProjectileIds.has(id)) {
        // Projectile was removed - it hit something!
        if (visual.trail.length > 0 && this.impactCallback) {
          const impactPos = visual.trail[0];
          this.impactCallback(impactPos.x, impactPos.y, visual.fortressClass);
        }
      }
    }

    // Remove dead projectiles
    for (const [id, visual] of this.visuals) {
      if (!currentIds.has(id)) {
        visual.container.destroy({ children: true });
        this.visuals.delete(id);
      }
    }

    // Store current IDs for next frame impact detection
    this.previousProjectileIds = new Set(currentIds);
  }

  /**
   * Draw ghost afterimages for motion blur effect
   */
  private drawGhostAfterimages(
    g: Graphics,
    fortressClass: FortressClass,
    trail: { x: number; y: number }[],
    config: typeof PROJECTILE_CONFIG[ProjectileType]
  ) {
    if (trail.length < 3) return;

    const colors = CLASS_COLORS[fortressClass] || CLASS_COLORS.natural;
    const ghostCount = config.ghostCount;
    const ghostSpacing = Math.max(1, Math.floor(trail.length / ghostCount));

    for (let i = 1; i < ghostCount && i * ghostSpacing < trail.length; i++) {
      const trailIndex = i * ghostSpacing;
      const pos = trail[trailIndex];
      if (!pos) continue;

      const ghostProgress = i / ghostCount;
      const ghostAlpha = (1 - ghostProgress) * 0.25;
      const ghostSize = config.size * (1 - ghostProgress * 0.5);

      if (ghostAlpha < 0.05 || ghostSize < 1) continue;

      // Outer glow ring
      g.circle(pos.x, pos.y, ghostSize * 1.5)
        .fill({ color: colors.glow, alpha: ghostAlpha * 0.3 });

      // Main ghost body
      g.circle(pos.x, pos.y, ghostSize)
        .fill({ color: colors.primary, alpha: ghostAlpha });

      // Inner core hint
      g.circle(pos.x, pos.y, ghostSize * 0.4)
        .fill({ color: colors.secondary, alpha: ghostAlpha * 0.6 });
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
    return fpYToScreen(projectile.startY, viewHeight);
  }

  private drawProjectile(
    g: Graphics,
    projectile: ActiveProjectile,
    x: number,
    y: number,
    trail: { x: number; y: number }[],
    visual: ProjectileVisual
  ) {
    const colors = CLASS_COLORS[projectile.class] || CLASS_COLORS.natural;
    const projectileType = CLASS_TO_PROJECTILE[projectile.class] || 'physical';
    const config = PROJECTILE_CONFIG[projectileType];

    // Draw enhanced gradient trail
    this.drawGradientTrail(g, trail, colors, config, visual);

    // Draw animated glow layers based on config
    this.drawPulsingGlowLayers(g, x, y, colors, config, visual);

    // Draw main projectile based on type (7 classes)
    switch (projectile.class) {
      case 'natural':
        this.drawNaturalProjectile(g, x, y, config.size, colors, trail, visual);
        break;
      case 'ice':
        this.drawIceProjectile(g, x, y, config.size, colors, projectile, trail, visual);
        break;
      case 'fire':
        this.drawFireProjectile(g, x, y, config.size, colors, trail, visual);
        break;
      case 'lightning':
        this.drawLightningProjectile(g, x, y, trail, colors, visual);
        break;
      case 'tech':
        this.drawTechProjectile(g, x, y, trail, colors, visual);
        break;
      case 'plasma':
        this.drawPlasmaProjectile(g, x, y, config.size, colors, trail, visual);
        break;
      case 'void':
        this.drawVoidProjectile(g, x, y, config.size, colors, trail, visual);
        break;
      default:
        this.drawNaturalProjectile(g, x, y, config.size, colors, trail, visual);
    }

    // Draw animated energy core
    this.drawEnergyCore(g, x, y, colors, config, visual);
  }

  /**
   * Draw pulsing glow layers around projectile
   */
  private drawPulsingGlowLayers(
    g: Graphics,
    x: number,
    y: number,
    colors: { primary: number; secondary: number; glow: number; core: number },
    config: typeof PROJECTILE_CONFIG[ProjectileType],
    visual: ProjectileVisual
  ) {
    const baseSize = config.size;
    const pulse = visual.energyIntensity;

    for (let i = config.glowLayers - 1; i >= 0; i--) {
      const layerProgress = i / config.glowLayers;
      const layerSize = baseSize * (2.5 + layerProgress * 1.5) * pulse;
      const layerAlpha = (1 - layerProgress) * 0.12 * pulse;

      // Blend color from glow to primary for inner layers
      const layerColor = blendColors(colors.glow, colors.primary, layerProgress * 0.5);

      g.circle(x, y, layerSize)
        .fill({ color: layerColor, alpha: layerAlpha });
    }
  }

  /**
   * Draw animated energy core at projectile center
   */
  private drawEnergyCore(
    g: Graphics,
    x: number,
    y: number,
    colors: { primary: number; secondary: number; glow: number; core: number },
    config: typeof PROJECTILE_CONFIG[ProjectileType],
    visual: ProjectileVisual
  ) {
    const baseSize = config.size * 0.25;
    const pulse = 0.8 + Math.sin(visual.pulsePhase * 2) * 0.2;

    // Bright core
    g.circle(x, y, baseSize * pulse * 1.2)
      .fill({ color: colors.core, alpha: 0.9 });

    // White hot center
    g.circle(x, y, baseSize * pulse * 0.6)
      .fill({ color: 0xffffff, alpha: 0.95 });
  }

  /**
   * Draw enhanced gradient trail with fading alpha and decreasing width
   */
  private drawGradientTrail(
    g: Graphics,
    trail: { x: number; y: number }[],
    colors: { primary: number; secondary: number; glow: number; core: number },
    config: typeof PROJECTILE_CONFIG[ProjectileType],
    visual: ProjectileVisual
  ) {
    if (trail.length < 2) return;

    const energyPulse = visual.energyIntensity;

    // Draw trail as connected segments with gradient
    for (let i = 1; i < trail.length; i++) {
      const progress = i / trail.length;
      const alpha = (1 - progress) * 0.6 * energyPulse;
      const width = config.size * (1 - progress * 0.7);

      if (width < 0.5 || alpha < 0.05) continue;

      // Calculate color shift along trail (hotter at front)
      const trailColor = blendColors(colors.glow, darkenColor(colors.primary, 0.3), progress);

      // Outer glow
      g.moveTo(trail[i - 1].x, trail[i - 1].y);
      g.lineTo(trail[i].x, trail[i].y);
      g.stroke({ width: width * 2.5, color: colors.glow, alpha: alpha * 0.25 });

      // Inner trail
      g.moveTo(trail[i - 1].x, trail[i - 1].y);
      g.lineTo(trail[i].x, trail[i].y);
      g.stroke({ width: width, color: trailColor, alpha: alpha * 0.6 });

      // Core line
      g.moveTo(trail[i - 1].x, trail[i - 1].y);
      g.lineTo(trail[i].x, trail[i].y);
      g.stroke({ width: width * 0.4, color: colors.secondary, alpha: alpha * 0.8 });
    }

    // Add sparkle particles along trail with pulsing animation
    const sparklePhase = visual.pulsePhase;
    for (let i = 2; i < trail.length; i += 2) {
      const progress = i / trail.length;
      const sparkleOffset = Math.sin(sparklePhase + i * 0.5) * 0.3 + 0.7;
      const alpha = (1 - progress) * 0.5 * sparkleOffset;
      const size = config.size * (1 - progress) * 0.35;

      if (size > 0.5 && Math.random() > 0.4) {
        const offsetX = (Math.random() - 0.5) * 8;
        const offsetY = (Math.random() - 0.5) * 8;

        // Sparkle glow
        g.circle(trail[i].x + offsetX, trail[i].y + offsetY, size * 1.5)
          .fill({ color: colors.glow, alpha: alpha * 0.4 });

        // Sparkle core
        g.circle(trail[i].x + offsetX, trail[i].y + offsetY, size)
          .fill({ color: colors.core, alpha });
      }
    }
  }

  // Natural: Green glowing sphere with motion blur
  private drawNaturalProjectile(
    g: Graphics,
    x: number,
    y: number,
    size: number,
    colors: { primary: number; secondary: number; glow: number; core: number },
    trail: { x: number; y: number }[],
    visual: ProjectileVisual
  ) {
    // Calculate motion blur direction
    const speed = trail.length > 1 ? Math.sqrt((x - trail[1].x) ** 2 + (y - trail[1].y) ** 2) : 0;
    const stretch = 1 + Math.min(speed / 30, 1.5);
    const pulse = visual.energyIntensity;

    // Outer glow (stretched, pulsing)
    g.ellipse(x, y, size * 1.8 * stretch * pulse, size * 1.5 * pulse)
      .fill({ color: colors.glow, alpha: 0.25 * pulse });

    // Mid glow
    g.ellipse(x, y, size * 1.3 * stretch * pulse, size * 1.2 * pulse)
      .fill({ color: colors.secondary, alpha: 0.4 * pulse });

    // Core with subtle rotation effect
    const rotOffset = Math.sin(visual.rotationAngle) * 0.1;
    g.circle(x + rotOffset, y, size)
      .fill({ color: colors.primary });

    // Inner highlight (animated position)
    const highlightOffset = Math.sin(visual.pulsePhase) * size * 0.1;
    g.circle(x - size * 0.3 + highlightOffset, y - size * 0.3, size * 0.4)
      .fill({ color: colors.core, alpha: 0.8 });

    // Leaf particles trailing behind with animated rotation
    if (trail.length > 2) {
      for (let i = 1; i < Math.min(5, trail.length); i++) {
        const leafSize = size * 0.35 * (1 - i / 6);
        const leafAlpha = 0.7 * (1 - i / 6) * pulse;
        const leafAngle = visual.rotationAngle + i * 0.8;
        const leafX = trail[i].x + Math.cos(leafAngle) * 5;
        const leafY = trail[i].y + Math.sin(leafAngle) * 5;

        // Diamond-shaped leaf with rotation
        const cos = Math.cos(leafAngle);
        const sin = Math.sin(leafAngle);
        const points = [
          { dx: 0, dy: -leafSize },
          { dx: leafSize * 0.6, dy: 0 },
          { dx: 0, dy: leafSize },
          { dx: -leafSize * 0.6, dy: 0 },
        ].map(p => ({
          x: leafX + p.dx * cos - p.dy * sin,
          y: leafY + p.dx * sin + p.dy * cos,
        }));

        g.poly([
          points[0].x, points[0].y,
          points[1].x, points[1].y,
          points[2].x, points[2].y,
          points[3].x, points[3].y,
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
    colors: { primary: number; secondary: number; glow: number; core: number },
    projectile: ActiveProjectile,
    trail: { x: number; y: number }[],
    visual: ProjectileVisual
  ) {
    // Calculate direction
    const dx = projectile.targetX - projectile.x;
    const dy = projectile.targetY - projectile.y;
    const angle = Math.atan2(FP.toFloat(dy), FP.toFloat(dx));
    const pulse = visual.energyIntensity;

    // Outer frost glow (pulsing)
    g.circle(x, y, size * 1.8 * pulse)
      .fill({ color: colors.glow, alpha: 0.15 * pulse });

    // Secondary frost ring
    g.circle(x, y, size * 1.4 * pulse)
      .fill({ color: lightenColor(colors.glow, 0.2), alpha: 0.2 * pulse });

    // Ice spike shape (elongated)
    const tipX = x + Math.cos(angle) * size * 2.2;
    const tipY = y + Math.sin(angle) * size * 2.2;
    const backX = x - Math.cos(angle) * size * 0.9;
    const backY = y - Math.sin(angle) * size * 0.9;
    const perpX = Math.cos(angle + Math.PI / 2);
    const perpY = Math.sin(angle + Math.PI / 2);

    // Outer spike glow
    g.poly([
      tipX + Math.cos(angle) * 3, tipY + Math.sin(angle) * 3,
      backX + perpX * size * 0.7, backY + perpY * size * 0.7,
      backX - perpX * size * 0.7, backY - perpY * size * 0.7,
    ])
      .fill({ color: colors.glow, alpha: 0.3 });

    // Main spike
    g.poly([
      tipX, tipY,
      backX + perpX * size * 0.5, backY + perpY * size * 0.5,
      backX - perpX * size * 0.5, backY - perpY * size * 0.5,
    ])
      .fill({ color: colors.primary })
      .stroke({ width: 1.5, color: colors.glow, alpha: 0.9 });

    // Inner bright core (animated)
    const coreOffset = Math.sin(visual.pulsePhase) * 0.1;
    g.poly([
      tipX - (tipX - x) * (0.25 + coreOffset), tipY - (tipY - y) * (0.25 + coreOffset),
      backX + perpX * size * 0.2, backY + perpY * size * 0.2,
      backX - perpX * size * 0.2, backY - perpY * size * 0.2,
    ])
      .fill({ color: colors.core, alpha: 0.7 });

    // Ice crystal particles in trail with rotation
    if (trail.length > 2) {
      for (let i = 2; i < Math.min(8, trail.length); i += 2) {
        const crystalSize = size * 0.3 * (1 - i / 10);
        const crystalAlpha = 0.6 * (1 - i / 10) * pulse;
        const crystalAngle = visual.rotationAngle * 2 + i * 0.5;
        const cx = trail[i].x + Math.cos(crystalAngle) * 8;
        const cy = trail[i].y + Math.sin(crystalAngle) * 8;

        // Rotating diamond crystal
        const cos = Math.cos(crystalAngle);
        const sin = Math.sin(crystalAngle);

        g.poly([
          cx + sin * crystalSize, cy - cos * crystalSize,
          cx + cos * crystalSize * 0.6, cy + sin * crystalSize * 0.6,
          cx - sin * crystalSize, cy + cos * crystalSize,
          cx - cos * crystalSize * 0.6, cy - sin * crystalSize * 0.6,
        ]).fill({ color: colors.glow, alpha: crystalAlpha });
      }
    }

    // Frost particles at tip
    const frostCount = 3;
    for (let i = 0; i < frostCount; i++) {
      const frostAngle = (i / frostCount) * Math.PI * 2 + visual.pulsePhase;
      const frostDist = size * 0.8 + Math.sin(visual.pulsePhase * 2 + i) * 2;
      const fx = tipX + Math.cos(frostAngle) * frostDist * 0.3;
      const fy = tipY + Math.sin(frostAngle) * frostDist * 0.3;

      g.circle(fx, fy, 1.5)
        .fill({ color: 0xffffff, alpha: 0.6 });
    }
  }

  // Fire: Flickering fireball with ember trail
  private drawFireProjectile(
    g: Graphics,
    x: number,
    y: number,
    size: number,
    colors: { primary: number; secondary: number; glow: number; core: number },
    trail: { x: number; y: number }[],
    visual: ProjectileVisual
  ) {
    const flicker = Math.sin(visual.pulsePhase) * 0.15 + Math.sin(visual.pulsePhase * 2.3) * 0.1 + 1;
    const pulse = visual.energyIntensity;

    // Calculate direction for flame stretch
    const angle = trail.length > 1 ? Math.atan2(y - trail[1].y, x - trail[1].x) : 0;
    const stretch = 1.4;

    // Heat shimmer rings (animated)
    for (let ring = 2; ring >= 0; ring--) {
      const ringPulse = Math.sin(visual.pulsePhase + ring * 0.5) * 0.1 + 1;
      const ringSize = size * (2.8 + ring * 0.4) * flicker * ringPulse;
      const ringAlpha = 0.08 * (1 - ring * 0.25) * pulse;

      g.ellipse(x, y, ringSize, ringSize * 0.8)
        .fill({ color: colors.glow, alpha: ringAlpha });
    }

    // Outer flame glow (pulsing, stretched)
    g.ellipse(
      x - Math.cos(angle) * size * 0.4,
      y - Math.sin(angle) * size * 0.4,
      size * 2.2 * flicker * stretch * pulse,
      size * 1.6 * flicker * pulse
    )
      .fill({ color: colors.glow, alpha: 0.3 * pulse });

    // Mid flame
    g.ellipse(x, y, size * 1.5 * flicker * stretch, size * 1.3 * flicker)
      .fill({ color: colors.secondary, alpha: 0.75 * pulse });

    // Core flame with animated wobble
    const wobbleX = Math.sin(visual.pulsePhase * 3) * size * 0.1;
    const wobbleY = Math.cos(visual.pulsePhase * 2.5) * size * 0.08;
    g.circle(x + wobbleX, y + wobbleY, size * flicker)
      .fill({ color: colors.primary });

    // Hot yellow center
    g.circle(x + wobbleX * 0.5, y + wobbleY * 0.5, size * 0.55)
      .fill({ color: colors.core });

    // White hot core
    g.circle(x, y, size * 0.28)
      .fill({ color: 0xffffff });

    // Animated flame tongues
    const tongueCount = 4;
    for (let i = 0; i < tongueCount; i++) {
      const tongueAngle = angle + Math.PI + (i / tongueCount - 0.5) * Math.PI * 0.8;
      const tonguePhase = visual.pulsePhase * 3 + i * 1.5;
      const tongueLen = size * (0.8 + Math.sin(tonguePhase) * 0.4);
      const tongueWidth = size * 0.25;

      const tx = x - Math.cos(tongueAngle) * tongueLen * 0.5;
      const ty = y - Math.sin(tongueAngle) * tongueLen * 0.5;
      const tipX = x - Math.cos(tongueAngle) * tongueLen;
      const tipY = y - Math.sin(tongueAngle) * tongueLen;

      g.moveTo(tx + Math.cos(tongueAngle + Math.PI / 2) * tongueWidth, ty + Math.sin(tongueAngle + Math.PI / 2) * tongueWidth);
      g.lineTo(tipX, tipY);
      g.lineTo(tx - Math.cos(tongueAngle + Math.PI / 2) * tongueWidth, ty - Math.sin(tongueAngle + Math.PI / 2) * tongueWidth);
      g.fill({ color: blendColors(colors.secondary, colors.glow, 0.5), alpha: 0.6 });
    }

    // Ember particles trailing behind with animated movement
    if (trail.length > 2) {
      for (let i = 1; i < Math.min(10, trail.length); i++) {
        const emberSize = size * 0.35 * (1 - i / 12);
        const emberAlpha = 0.8 * (1 - i / 12) * pulse;
        const emberPhase = visual.pulsePhase + i * 0.8;
        const emberOffsetX = Math.sin(emberPhase) * 8;
        const emberOffsetY = Math.cos(emberPhase * 0.7) * 6 - i * 2.5; // Rise up

        const emberX = trail[i].x + emberOffsetX;
        const emberY = trail[i].y + emberOffsetY;

        // Ember glow
        g.circle(emberX, emberY, emberSize * 1.5)
          .fill({ color: colors.glow, alpha: emberAlpha * 0.4 });

        // Ember core with color variation
        const emberColor = i % 2 === 0 ? colors.primary : colors.secondary;
        g.circle(emberX, emberY, emberSize)
          .fill({ color: emberColor, alpha: emberAlpha });
      }
    }

    // Smoke wisps at tail (improved)
    if (trail.length > 4) {
      for (let i = 4; i < Math.min(12, trail.length); i += 2) {
        const smokeProgress = (i - 4) / 8;
        const smokeSize = size * 0.6 * (1 - smokeProgress);
        const smokeAlpha = 0.25 * (1 - smokeProgress);
        const smokePhase = visual.pulsePhase * 0.5 + i * 0.3;
        const smokeX = trail[i].x + Math.sin(smokePhase) * 8;
        const smokeY = trail[i].y - (i - 4) * 3.5 + Math.cos(smokePhase) * 3;

        g.circle(smokeX, smokeY, smokeSize)
          .fill({ color: 0x555566, alpha: smokeAlpha });
      }
    }
  }

  // Lightning: Electric bolt with branches
  private drawLightningProjectile(
    g: Graphics,
    x: number,
    y: number,
    trail: { x: number; y: number }[],
    colors: { primary: number; secondary: number; glow: number; core: number },
    visual: ProjectileVisual
  ) {
    const pulse = visual.energyIntensity;
    const flickerIntensity = Math.sin(visual.pulsePhase * 10) > 0.5 ? 1 : 0.7;

    // Pulsing glow rings at current position
    g.circle(x, y, 20 * pulse)
      .fill({ color: colors.glow, alpha: 0.2 * flickerIntensity });

    g.circle(x, y, 14 * pulse)
      .fill({ color: colors.primary, alpha: 0.35 * flickerIntensity });

    g.circle(x, y, 9)
      .fill({ color: colors.core, alpha: 0.7 });

    // Draw jagged bolt through trail with animated jitter
    if (trail.length > 1) {
      // Use visual.pulsePhase to create semi-stable but animated jitter
      const jitterSeed = Math.sin(visual.pulsePhase * 20);
      const jitterPoints: { x: number; y: number }[] = trail.map((p, i) => {
        const jitterAmount = i > 0 && i < trail.length - 1 ? 18 : 0;
        const jitterPhase = visual.pulsePhase * 15 + i * 2;
        return {
          x: p.x + Math.sin(jitterPhase) * jitterAmount * jitterSeed,
          y: p.y + Math.cos(jitterPhase * 1.3) * jitterAmount * jitterSeed,
        };
      });

      // Outer glow bolt (widest)
      g.moveTo(jitterPoints[0].x, jitterPoints[0].y);
      for (let i = 1; i < jitterPoints.length; i++) {
        g.lineTo(jitterPoints[i].x, jitterPoints[i].y);
      }
      g.stroke({ width: 12 * flickerIntensity, color: colors.glow, alpha: 0.25 * pulse });

      // Secondary glow
      g.moveTo(jitterPoints[0].x, jitterPoints[0].y);
      for (let i = 1; i < jitterPoints.length; i++) {
        g.lineTo(jitterPoints[i].x, jitterPoints[i].y);
      }
      g.stroke({ width: 7 * flickerIntensity, color: lightenColor(colors.primary, 0.2), alpha: 0.4 * pulse });

      // Main bolt
      g.moveTo(jitterPoints[0].x, jitterPoints[0].y);
      for (let i = 1; i < jitterPoints.length; i++) {
        g.lineTo(jitterPoints[i].x, jitterPoints[i].y);
      }
      g.stroke({ width: 4, color: colors.primary, alpha: 0.9 });

      // Inner bright line
      g.moveTo(jitterPoints[0].x, jitterPoints[0].y);
      for (let i = 1; i < jitterPoints.length; i++) {
        g.lineTo(jitterPoints[i].x, jitterPoints[i].y);
      }
      g.stroke({ width: 2, color: 0xffffff });

      // Animated branches (based on visual state, not random)
      for (let i = 2; i < jitterPoints.length - 2; i += 2) {
        const branchChance = Math.sin(visual.pulsePhase * 8 + i * 3);
        if (branchChance > 0.2) {
          const branchLen = 15 + Math.abs(branchChance) * 25;
          const branchAngle = visual.rotationAngle * 3 + i * 1.5;

          // Primary branch
          const bx = jitterPoints[i].x + Math.cos(branchAngle) * branchLen;
          const by = jitterPoints[i].y + Math.sin(branchAngle) * branchLen;

          g.moveTo(jitterPoints[i].x, jitterPoints[i].y);
          g.lineTo(bx, by);
          g.stroke({ width: 3, color: colors.glow, alpha: 0.5 * flickerIntensity });

          g.moveTo(jitterPoints[i].x, jitterPoints[i].y);
          g.lineTo(bx, by);
          g.stroke({ width: 1.5, color: 0xffffff, alpha: 0.7 });

          // Sub-branch
          if (branchChance > 0.5) {
            const subAngle = branchAngle + (branchChance > 0.7 ? 0.5 : -0.5);
            const subLen = branchLen * 0.5;
            const sx = bx + Math.cos(subAngle) * subLen;
            const sy = by + Math.sin(subAngle) * subLen;

            g.moveTo(bx, by);
            g.lineTo(sx, sy);
            g.stroke({ width: 1, color: colors.glow, alpha: 0.4 });
          }
        }
      }

      // Spark particles along bolt with pulsing
      for (let i = 1; i < jitterPoints.length; i += 2) {
        const sparkPulse = Math.sin(visual.pulsePhase * 6 + i * 2) * 0.5 + 0.5;
        const sparkSize = (2 + sparkPulse * 3) * flickerIntensity;
        g.circle(jitterPoints[i].x, jitterPoints[i].y, sparkSize)
          .fill({ color: 0xffffff, alpha: 0.9 * sparkPulse });
      }
    }

    // Central spark at tip
    g.circle(x, y, 6)
      .fill({ color: 0xffffff });

    // Electric arc effect at tip (animated)
    const arcCount = 5;
    for (let i = 0; i < arcCount; i++) {
      const arcPhase = visual.pulsePhase * 4 + (i / arcCount) * Math.PI * 2;
      const arcLen = 10 + Math.sin(arcPhase * 2) * 6;
      const ax = x + Math.cos(arcPhase) * arcLen;
      const ay = y + Math.sin(arcPhase) * arcLen;

      // Arc glow
      g.moveTo(x, y);
      g.lineTo(ax, ay);
      g.stroke({ width: 2.5, color: colors.glow, alpha: 0.5 * flickerIntensity });

      // Arc core
      g.moveTo(x, y);
      g.lineTo(ax, ay);
      g.stroke({ width: 1, color: 0xffffff, alpha: 0.8 });

      // Arc tip spark
      g.circle(ax, ay, 2)
        .fill({ color: 0xffffff, alpha: 0.7 });
    }
  }

  // Tech: Laser beam with data fragments
  private drawTechProjectile(
    g: Graphics,
    x: number,
    y: number,
    trail: { x: number; y: number }[],
    colors: { primary: number; secondary: number; glow: number; core: number },
    visual: ProjectileVisual
  ) {
    const pulse = visual.energyIntensity;
    const scanPhase = (visual.pulsePhase * 2) % (Math.PI * 2);

    // Draw laser line through trail
    if (trail.length > 1) {
      // Calculate beam intensity fluctuation
      const beamIntensity = 0.8 + Math.sin(visual.pulsePhase * 4) * 0.2;

      // Outer glow beam (widest, most transparent)
      g.moveTo(trail[trail.length - 1].x, trail[trail.length - 1].y);
      for (const point of trail) {
        g.lineTo(point.x, point.y);
      }
      g.stroke({ width: 14 * beamIntensity, color: colors.glow, alpha: 0.15 * pulse });

      // Secondary glow
      g.moveTo(trail[trail.length - 1].x, trail[trail.length - 1].y);
      for (const point of trail) {
        g.lineTo(point.x, point.y);
      }
      g.stroke({ width: 8 * beamIntensity, color: lightenColor(colors.primary, 0.1), alpha: 0.3 * pulse });

      // Mid beam
      g.moveTo(trail[trail.length - 1].x, trail[trail.length - 1].y);
      for (const point of trail) {
        g.lineTo(point.x, point.y);
      }
      g.stroke({ width: 5, color: colors.primary, alpha: 0.7 });

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

      // Data fragment particles (animated rotating squares)
      for (let i = 2; i < trail.length; i += 2) {
        const fragProgress = i / trail.length;
        const fragSize = 4 * (1 - fragProgress);
        const fragAlpha = 0.7 * (1 - fragProgress) * pulse;
        const fragAngle = visual.rotationAngle * 2 + i * 0.5;
        const fragOffset = Math.sin(visual.pulsePhase + i * 0.7) * 6;
        const fx = trail[i].x + Math.cos(fragAngle) * fragOffset;
        const fy = trail[i].y + Math.sin(fragAngle) * fragOffset;

        // Rotated square
        const cos = Math.cos(fragAngle);
        const sin = Math.sin(fragAngle);
        const hs = fragSize / 2;

        g.poly([
          fx + (-hs * cos - -hs * sin), fy + (-hs * sin + -hs * cos),
          fx + (hs * cos - -hs * sin), fy + (hs * sin + -hs * cos),
          fx + (hs * cos - hs * sin), fy + (hs * sin + hs * cos),
          fx + (-hs * cos - hs * sin), fy + (-hs * sin + hs * cos),
        ]).fill({ color: colors.glow, alpha: fragAlpha });

        // Inner bright square
        const hs2 = hs * 0.5;
        g.poly([
          fx + (-hs2 * cos - -hs2 * sin), fy + (-hs2 * sin + -hs2 * cos),
          fx + (hs2 * cos - -hs2 * sin), fy + (hs2 * sin + -hs2 * cos),
          fx + (hs2 * cos - hs2 * sin), fy + (hs2 * sin + hs2 * cos),
          fx + (-hs2 * cos - hs2 * sin), fy + (-hs2 * sin + hs2 * cos),
        ]).fill({ color: colors.core, alpha: fragAlpha * 0.8 });
      }

      // Scan line effect (smoother animation)
      const scanPos = (Math.sin(scanPhase) + 1) / 2;
      const scanIndex = Math.floor(scanPos * (trail.length - 1));
      if (scanIndex < trail.length && scanIndex >= 0) {
        const scanPoint = trail[scanIndex];

        // Scan glow
        g.circle(scanPoint.x, scanPoint.y, 7)
          .fill({ color: colors.glow, alpha: 0.4 });

        // Scan core
        g.circle(scanPoint.x, scanPoint.y, 4)
          .fill({ color: 0xffffff, alpha: 0.9 });

        // Scan ring
        g.circle(scanPoint.x, scanPoint.y, 10)
          .stroke({ width: 1, color: colors.core, alpha: 0.5 });
      }

      // Binary data bits along beam
      for (let i = 3; i < trail.length; i += 4) {
        const bitPhase = visual.pulsePhase * 3 + i;
        const bitOn = Math.sin(bitPhase) > 0;
        if (bitOn) {
          const bitSize = 2;
          g.rect(trail[i].x - bitSize / 2, trail[i].y - bitSize / 2, bitSize, bitSize)
            .fill({ color: 0xffffff, alpha: 0.6 });
        }
      }
    }

    // Impact point with animated pulse
    const impactPulse = 0.8 + Math.sin(visual.pulsePhase * 3) * 0.3;
    g.circle(x, y, 8 * impactPulse)
      .fill({ color: colors.glow, alpha: 0.4 * pulse });

    g.circle(x, y, 5 * impactPulse)
      .fill({ color: colors.primary, alpha: 0.8 });

    g.circle(x, y, 3)
      .fill({ color: colors.core });

    g.circle(x, y, 1.5)
      .fill({ color: 0xffffff });

    // Animated cross-hair at impact
    const crossSize = 10 + Math.sin(visual.pulsePhase * 2) * 2;
    const crossAlpha = 0.5 * pulse;

    // Horizontal
    g.moveTo(x - crossSize, y);
    g.lineTo(x - 4, y);
    g.stroke({ width: 1.5, color: colors.glow, alpha: crossAlpha });

    g.moveTo(x + 4, y);
    g.lineTo(x + crossSize, y);
    g.stroke({ width: 1.5, color: colors.glow, alpha: crossAlpha });

    // Vertical
    g.moveTo(x, y - crossSize);
    g.lineTo(x, y - 4);
    g.stroke({ width: 1.5, color: colors.glow, alpha: crossAlpha });

    g.moveTo(x, y + 4);
    g.lineTo(x, y + crossSize);
    g.stroke({ width: 1.5, color: colors.glow, alpha: crossAlpha });

    // Corner brackets
    const bracketSize = 6;
    const bracketOffset = crossSize + 2;

    // Top-left bracket
    g.moveTo(x - bracketOffset, y - bracketOffset + bracketSize);
    g.lineTo(x - bracketOffset, y - bracketOffset);
    g.lineTo(x - bracketOffset + bracketSize, y - bracketOffset);
    g.stroke({ width: 1, color: colors.core, alpha: crossAlpha * 0.7 });

    // Top-right bracket
    g.moveTo(x + bracketOffset - bracketSize, y - bracketOffset);
    g.lineTo(x + bracketOffset, y - bracketOffset);
    g.lineTo(x + bracketOffset, y - bracketOffset + bracketSize);
    g.stroke({ width: 1, color: colors.core, alpha: crossAlpha * 0.7 });

    // Bottom-left bracket
    g.moveTo(x - bracketOffset, y + bracketOffset - bracketSize);
    g.lineTo(x - bracketOffset, y + bracketOffset);
    g.lineTo(x - bracketOffset + bracketSize, y + bracketOffset);
    g.stroke({ width: 1, color: colors.core, alpha: crossAlpha * 0.7 });

    // Bottom-right bracket
    g.moveTo(x + bracketOffset - bracketSize, y + bracketOffset);
    g.lineTo(x + bracketOffset, y + bracketOffset);
    g.lineTo(x + bracketOffset, y + bracketOffset - bracketSize);
    g.stroke({ width: 1, color: colors.core, alpha: crossAlpha * 0.7 });
  }

  // Plasma: Energy beam with plasma tendrils (Spectre exclusive)
  private drawPlasmaProjectile(
    g: Graphics,
    x: number,
    y: number,
    size: number,
    colors: { primary: number; secondary: number; glow: number; core: number },
    trail: { x: number; y: number }[],
    visual: ProjectileVisual
  ) {
    const pulse = visual.energyIntensity;
    const phase = visual.pulsePhase;

    // Draw plasma beam through trail
    if (trail.length > 1) {
      const beamIntensity = 0.7 + Math.sin(phase * 6) * 0.3;

      // Outer plasma glow (widest)
      g.moveTo(trail[trail.length - 1].x, trail[trail.length - 1].y);
      for (const point of trail) {
        g.lineTo(point.x, point.y);
      }
      g.lineTo(x, y);
      g.stroke({ width: 14, color: colors.glow, alpha: 0.15 * beamIntensity });

      // Secondary plasma layer (magenta)
      g.moveTo(trail[trail.length - 1].x, trail[trail.length - 1].y);
      for (const point of trail) {
        g.lineTo(point.x, point.y);
      }
      g.lineTo(x, y);
      g.stroke({ width: 8, color: colors.secondary, alpha: 0.3 * beamIntensity });

      // Primary beam core (cyan)
      g.moveTo(trail[trail.length - 1].x, trail[trail.length - 1].y);
      for (const point of trail) {
        g.lineTo(point.x, point.y);
      }
      g.lineTo(x, y);
      g.stroke({ width: 4, color: colors.primary, alpha: 0.7 * beamIntensity });

      // White hot core
      g.moveTo(trail[trail.length - 1].x, trail[trail.length - 1].y);
      for (const point of trail) {
        g.lineTo(point.x, point.y);
      }
      g.lineTo(x, y);
      g.stroke({ width: 2, color: 0xffffff, alpha: 0.9 * beamIntensity });

      // Plasma tendrils branching off the beam
      for (let i = 0; i < trail.length; i += 3) {
        const tendrilPhase = phase * 4 + i * 0.5;
        const tendrilIntensity = Math.sin(tendrilPhase) * 0.5 + 0.5;

        if (tendrilIntensity > 0.3) {
          const tendrilAngle1 = tendrilPhase * 1.5;
          const tendrilAngle2 = tendrilPhase * 1.5 + Math.PI;
          const tendrilLen = (8 + tendrilIntensity * 6) * pulse;

          // Tendril 1
          const tx1 = trail[i].x + Math.cos(tendrilAngle1) * tendrilLen;
          const ty1 = trail[i].y + Math.sin(tendrilAngle1) * tendrilLen;
          g.moveTo(trail[i].x, trail[i].y);
          g.lineTo(tx1, ty1);
          g.stroke({ width: 2, color: colors.secondary, alpha: 0.5 * tendrilIntensity });

          // Tendril 2
          const tx2 = trail[i].x + Math.cos(tendrilAngle2) * tendrilLen;
          const ty2 = trail[i].y + Math.sin(tendrilAngle2) * tendrilLen;
          g.moveTo(trail[i].x, trail[i].y);
          g.lineTo(tx2, ty2);
          g.stroke({ width: 2, color: colors.primary, alpha: 0.5 * tendrilIntensity });
        }
      }
    }

    // Plasma orb at tip with pulsing effect
    const orbSize = size * (0.8 + pulse * 0.4);

    // Outer glow
    g.circle(x, y, orbSize * 1.8)
      .fill({ color: colors.glow, alpha: 0.2 * pulse });

    // Secondary glow (magenta)
    g.circle(x, y, orbSize * 1.3)
      .fill({ color: colors.secondary, alpha: 0.4 * pulse });

    // Primary orb (cyan)
    g.circle(x, y, orbSize)
      .fill({ color: colors.primary, alpha: 0.8 });

    // White hot center
    g.circle(x, y, orbSize * 0.5)
      .fill({ color: 0xffffff, alpha: 0.95 });

    // Rotating plasma arcs around the orb
    const arcCount = 4;
    for (let i = 0; i < arcCount; i++) {
      const arcAngle = phase * 3 + (i / arcCount) * Math.PI * 2;
      const arcDist = orbSize * 1.4 + Math.sin(phase * 5 + i) * 3;
      const ax = x + Math.cos(arcAngle) * arcDist;
      const ay = y + Math.sin(arcAngle) * arcDist;

      // Arc spark
      g.circle(ax, ay, 3 * pulse)
        .fill({ color: i % 2 === 0 ? colors.primary : colors.secondary, alpha: 0.8 });
    }

    // Energy ring effect
    const ringPhase = (phase * 2) % 1;
    const ringRadius = orbSize * (1.5 + ringPhase * 1.5);
    const ringAlpha = (1 - ringPhase) * 0.4;
    g.circle(x, y, ringRadius)
      .stroke({ width: 2, color: colors.primary, alpha: ringAlpha });
  }

  // Void: Golden slash with dark energy (Omega exclusive)
  private drawVoidProjectile(
    g: Graphics,
    x: number,
    y: number,
    size: number,
    colors: { primary: number; secondary: number; glow: number; core: number },
    trail: { x: number; y: number }[],
    visual: ProjectileVisual
  ) {
    const pulse = visual.energyIntensity;
    const phase = visual.pulsePhase;

    // Calculate movement direction for slash orientation
    let angle = 0;
    if (trail.length > 0) {
      const lastTrail = trail[0];
      angle = Math.atan2(y - lastTrail.y, x - lastTrail.x);
    }

    // Draw slash trail with afterimages
    if (trail.length > 1) {
      for (let i = 0; i < trail.length - 1; i++) {
        const alpha = (1 - i / trail.length) * 0.6;
        const width = (trail.length - i) * 0.8;

        // Dark void trail
        g.moveTo(trail[i].x, trail[i].y);
        g.lineTo(trail[i + 1].x, trail[i + 1].y);
        g.stroke({ width: width + 4, color: colors.secondary, alpha: alpha * 0.3 });

        // Golden trail
        g.moveTo(trail[i].x, trail[i].y);
        g.lineTo(trail[i + 1].x, trail[i + 1].y);
        g.stroke({ width: width, color: colors.primary, alpha: alpha * 0.7 });
      }
    }

    // Main slash shape - curved arc
    const slashLength = size * 2.5;
    const slashWidth = size * 0.8;

    // Void aura behind slash
    g.ellipse(x, y, slashLength * 1.2, slashWidth * 2)
      .fill({ color: colors.secondary, alpha: 0.15 * pulse });

    // Golden slash glow
    g.ellipse(x, y, slashLength, slashWidth * 1.5)
      .fill({ color: colors.glow, alpha: 0.3 * pulse });

    // Main golden slash
    const slashAngle = angle + Math.PI / 4; // Diagonal slash
    const cos = Math.cos(slashAngle);
    const sin = Math.sin(slashAngle);

    // Draw crescent slash shape
    g.moveTo(x - cos * slashLength, y - sin * slashLength);
    g.quadraticCurveTo(
      x + sin * slashWidth * 2,
      y - cos * slashWidth * 2,
      x + cos * slashLength,
      y + sin * slashLength
    );
    g.quadraticCurveTo(
      x - sin * slashWidth,
      y + cos * slashWidth,
      x - cos * slashLength,
      y - sin * slashLength
    );
    g.fill({ color: colors.primary, alpha: 0.9 });

    // White edge highlight
    g.moveTo(x - cos * slashLength * 0.8, y - sin * slashLength * 0.8);
    g.quadraticCurveTo(
      x + sin * slashWidth * 1.5,
      y - cos * slashWidth * 1.5,
      x + cos * slashLength * 0.8,
      y + sin * slashLength * 0.8
    );
    g.stroke({ width: 2, color: 0xffffff, alpha: 0.8 });

    // Void particles swirling around
    const particleCount = 6;
    for (let i = 0; i < particleCount; i++) {
      const particlePhase = phase * 4 + (i / particleCount) * Math.PI * 2;
      const particleDist = slashLength * (0.5 + Math.sin(particlePhase * 2) * 0.3);
      const px = x + Math.cos(particlePhase) * particleDist;
      const py = y + Math.sin(particlePhase) * particleDist;

      // Void particle
      g.circle(px, py, 2 + Math.sin(particlePhase) * 1)
        .fill({ color: colors.secondary, alpha: 0.6 });

      // Golden spark
      if (i % 2 === 0) {
        g.circle(px, py, 1.5)
          .fill({ color: colors.primary, alpha: 0.9 });
      }
    }

    // Impact point golden spark
    const sparkSize = size * 0.6 * (0.8 + pulse * 0.4);
    g.circle(x, y, sparkSize)
      .fill({ color: 0xffffff, alpha: 0.95 });

    // Cross-shaped golden glint
    const glintSize = sparkSize * 2;
    const glintAlpha = 0.6 + Math.sin(phase * 8) * 0.3;

    g.moveTo(x - glintSize, y);
    g.lineTo(x + glintSize, y);
    g.stroke({ width: 2, color: colors.primary, alpha: glintAlpha });

    g.moveTo(x, y - glintSize);
    g.lineTo(x, y + glintSize);
    g.stroke({ width: 2, color: colors.primary, alpha: glintAlpha });
  }
}
