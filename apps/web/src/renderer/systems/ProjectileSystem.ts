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

// --- PROJECTILE VISUAL CONFIG (compact, refined design) ---
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
  physical: { size: 4, trailLength: 6, shape: 'circle', emissionRate: 10, motionBlur: 1.2, ghostCount: 2, pulseSpeed: 4, glowLayers: 1 },
  icicle: { size: 5, trailLength: 8, shape: 'spike', emissionRate: 12, motionBlur: 1.5, ghostCount: 2, pulseSpeed: 3, glowLayers: 1 },
  fireball: { size: 6, trailLength: 10, shape: 'circle', emissionRate: 20, motionBlur: 1.4, ghostCount: 3, pulseSpeed: 8, glowLayers: 2 },
  bolt: { size: 3, trailLength: 12, shape: 'bolt', emissionRate: 15, motionBlur: 2.0, ghostCount: 3, pulseSpeed: 12, glowLayers: 1 },
  laser: { size: 2, trailLength: 16, shape: 'bolt', emissionRate: 12, motionBlur: 2.5, ghostCount: 4, pulseSpeed: 6, glowLayers: 1 },
  // Exclusive hero projectiles
  plasma_beam: { size: 5, trailLength: 14, shape: 'plasma', emissionRate: 25, motionBlur: 2.0, ghostCount: 4, pulseSpeed: 15, glowLayers: 2 },
  void_slash: { size: 8, trailLength: 8, shape: 'slash', emissionRate: 18, motionBlur: 1.8, ghostCount: 3, pulseSpeed: 10, glowLayers: 2 },
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
   * Draw ghost afterimages for motion blur effect (compact version)
   */
  private drawGhostAfterimages(
    g: Graphics,
    fortressClass: FortressClass,
    trail: { x: number; y: number }[],
    config: typeof PROJECTILE_CONFIG[ProjectileType]
  ) {
    if (trail.length < 3 || config.ghostCount === 0) return;

    const colors = CLASS_COLORS[fortressClass] || CLASS_COLORS.natural;
    const ghostCount = config.ghostCount;
    const ghostSpacing = Math.max(1, Math.floor(trail.length / ghostCount));

    for (let i = 1; i < ghostCount && i * ghostSpacing < trail.length; i++) {
      const trailIndex = i * ghostSpacing;
      const pos = trail[trailIndex];
      if (!pos) continue;

      const ghostProgress = i / ghostCount;
      const ghostAlpha = (1 - ghostProgress) * 0.15;
      const ghostSize = config.size * (0.8 - ghostProgress * 0.4);

      if (ghostAlpha < 0.03 || ghostSize < 0.5) continue;

      // Single subtle ghost circle (no extra glow ring)
      g.circle(pos.x, pos.y, ghostSize)
        .fill({ color: colors.primary, alpha: ghostAlpha });
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
   * Draw pulsing glow layers around projectile (compact version)
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
      const layerProgress = i / Math.max(config.glowLayers, 1);
      // Reduced multiplier: 1.4 base instead of 2.5
      const layerSize = baseSize * (1.4 + layerProgress * 0.6) * pulse;
      const layerAlpha = (1 - layerProgress) * 0.1 * pulse;

      const layerColor = blendColors(colors.glow, colors.primary, layerProgress * 0.5);

      g.circle(x, y, layerSize)
        .fill({ color: layerColor, alpha: layerAlpha });
    }
  }

  /**
   * Draw animated energy core at projectile center (compact version)
   */
  private drawEnergyCore(
    g: Graphics,
    x: number,
    y: number,
    colors: { primary: number; secondary: number; glow: number; core: number },
    config: typeof PROJECTILE_CONFIG[ProjectileType],
    visual: ProjectileVisual
  ) {
    const baseSize = config.size * 0.2;
    const pulse = 0.85 + Math.sin(visual.pulsePhase * 2) * 0.15;

    // Bright core
    g.circle(x, y, baseSize * pulse)
      .fill({ color: colors.core, alpha: 0.85 });

    // White hot center (smaller)
    g.circle(x, y, baseSize * pulse * 0.4)
      .fill({ color: 0xffffff, alpha: 0.9 });
  }

  /**
   * Draw compact gradient trail with fading alpha and decreasing width
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
      const alpha = (1 - progress) * 0.5 * energyPulse;
      // Thinner trail width
      const width = config.size * 0.6 * (1 - progress * 0.8);

      if (width < 0.3 || alpha < 0.03) continue;

      const trailColor = blendColors(colors.glow, darkenColor(colors.primary, 0.3), progress);

      // Subtle outer glow (thinner)
      g.moveTo(trail[i - 1].x, trail[i - 1].y);
      g.lineTo(trail[i].x, trail[i].y);
      g.stroke({ width: width * 1.8, color: colors.glow, alpha: alpha * 0.2 });

      // Inner trail
      g.moveTo(trail[i - 1].x, trail[i - 1].y);
      g.lineTo(trail[i].x, trail[i].y);
      g.stroke({ width: width, color: trailColor, alpha: alpha * 0.5 });
    }

    // Sparse sparkle particles (reduced frequency)
    const sparklePhase = visual.pulsePhase;
    for (let i = 3; i < trail.length; i += 3) {
      const progress = i / trail.length;
      const sparkleOffset = Math.sin(sparklePhase + i * 0.5) * 0.3 + 0.7;
      const alpha = (1 - progress) * 0.4 * sparkleOffset;
      const size = config.size * (1 - progress) * 0.25;

      if (size > 0.3 && Math.random() > 0.6) {
        const offsetX = (Math.random() - 0.5) * 4;
        const offsetY = (Math.random() - 0.5) * 4;

        // Single sparkle (no extra glow)
        g.circle(trail[i].x + offsetX, trail[i].y + offsetY, size)
          .fill({ color: colors.core, alpha });
      }
    }
  }

  // Natural: Compact green energy orb
  private drawNaturalProjectile(
    g: Graphics,
    x: number,
    y: number,
    size: number,
    colors: { primary: number; secondary: number; glow: number; core: number },
    trail: { x: number; y: number }[],
    visual: ProjectileVisual
  ) {
    const speed = trail.length > 1 ? Math.sqrt((x - trail[1].x) ** 2 + (y - trail[1].y) ** 2) : 0;
    const stretch = 1 + Math.min(speed / 40, 0.8);
    const pulse = visual.energyIntensity;

    // Subtle outer glow
    g.ellipse(x, y, size * 1.3 * stretch * pulse, size * 1.1 * pulse)
      .fill({ color: colors.glow, alpha: 0.15 * pulse });

    // Core orb
    g.circle(x, y, size * 0.9)
      .fill({ color: colors.primary });

    // Inner highlight
    g.circle(x - size * 0.2, y - size * 0.2, size * 0.3)
      .fill({ color: colors.core, alpha: 0.7 });

    // Minimal leaf particles (only 2)
    if (trail.length > 3) {
      for (let i = 2; i < Math.min(4, trail.length); i += 2) {
        const leafSize = size * 0.25 * (1 - i / 6);
        const leafAlpha = 0.5 * (1 - i / 6) * pulse;
        const leafAngle = visual.rotationAngle + i * 0.8;
        const leafX = trail[i].x + Math.cos(leafAngle) * 2;
        const leafY = trail[i].y + Math.sin(leafAngle) * 2;

        g.circle(leafX, leafY, leafSize)
          .fill({ color: colors.secondary, alpha: leafAlpha });
      }
    }
  }

  // Ice: Compact icicle spike
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
    const dx = projectile.targetX - projectile.x;
    const dy = projectile.targetY - projectile.y;
    const angle = Math.atan2(FP.toFloat(dy), FP.toFloat(dx));
    const pulse = visual.energyIntensity;

    // Subtle frost glow
    g.circle(x, y, size * 1.2 * pulse)
      .fill({ color: colors.glow, alpha: 0.12 * pulse });

    // Ice spike shape (compact)
    const tipX = x + Math.cos(angle) * size * 1.6;
    const tipY = y + Math.sin(angle) * size * 1.6;
    const backX = x - Math.cos(angle) * size * 0.5;
    const backY = y - Math.sin(angle) * size * 0.5;
    const perpX = Math.cos(angle + Math.PI / 2);
    const perpY = Math.sin(angle + Math.PI / 2);

    // Main spike
    g.poly([
      tipX, tipY,
      backX + perpX * size * 0.35, backY + perpY * size * 0.35,
      backX - perpX * size * 0.35, backY - perpY * size * 0.35,
    ])
      .fill({ color: colors.primary })
      .stroke({ width: 1, color: colors.glow, alpha: 0.7 });

    // Inner bright core
    g.poly([
      tipX - (tipX - x) * 0.3, tipY - (tipY - y) * 0.3,
      backX + perpX * size * 0.12, backY + perpY * size * 0.12,
      backX - perpX * size * 0.12, backY - perpY * size * 0.12,
    ])
      .fill({ color: colors.core, alpha: 0.6 });

    // Minimal ice crystals (only 2)
    if (trail.length > 3) {
      for (let i = 2; i < Math.min(5, trail.length); i += 3) {
        const crystalSize = size * 0.2 * (1 - i / 8);
        const crystalAlpha = 0.4 * (1 - i / 8) * pulse;
        
        g.circle(trail[i].x, trail[i].y, crystalSize)
          .fill({ color: colors.glow, alpha: crystalAlpha });
      }
    }
  }

  // Fire: Compact flickering fireball
  private drawFireProjectile(
    g: Graphics,
    x: number,
    y: number,
    size: number,
    colors: { primary: number; secondary: number; glow: number; core: number },
    trail: { x: number; y: number }[],
    visual: ProjectileVisual
  ) {
    const flicker = Math.sin(visual.pulsePhase) * 0.12 + 1;
    const pulse = visual.energyIntensity;

    // Single heat glow
    g.circle(x, y, size * 1.4 * flicker * pulse)
      .fill({ color: colors.glow, alpha: 0.15 * pulse });

    // Mid flame
    g.circle(x, y, size * 1.1 * flicker)
      .fill({ color: colors.secondary, alpha: 0.6 * pulse });

    // Core flame
    const wobbleX = Math.sin(visual.pulsePhase * 3) * size * 0.05;
    g.circle(x + wobbleX, y, size * 0.85 * flicker)
      .fill({ color: colors.primary });

    // Hot center
    g.circle(x, y, size * 0.4)
      .fill({ color: colors.core });

    // White hot core
    g.circle(x, y, size * 0.18)
      .fill({ color: 0xffffff });

    // Minimal ember particles (only 3)
    if (trail.length > 2) {
      for (let i = 1; i < Math.min(4, trail.length); i++) {
        const emberSize = size * 0.2 * (1 - i / 5);
        const emberAlpha = 0.5 * (1 - i / 5) * pulse;
        const emberPhase = visual.pulsePhase + i * 0.8;
        const emberOffsetY = Math.cos(emberPhase * 0.7) * 2 - i * 1.5;

        g.circle(trail[i].x, trail[i].y + emberOffsetY, emberSize)
          .fill({ color: colors.primary, alpha: emberAlpha });
      }
    }
  }

  // Lightning: Compact electric bolt
  private drawLightningProjectile(
    g: Graphics,
    x: number,
    y: number,
    trail: { x: number; y: number }[],
    colors: { primary: number; secondary: number; glow: number; core: number },
    visual: ProjectileVisual
  ) {
    const pulse = visual.energyIntensity;
    const flickerIntensity = Math.sin(visual.pulsePhase * 10) > 0.5 ? 1 : 0.75;

    // Compact glow at tip
    g.circle(x, y, 8 * pulse)
      .fill({ color: colors.glow, alpha: 0.15 * flickerIntensity });

    g.circle(x, y, 5 * pulse)
      .fill({ color: colors.primary, alpha: 0.3 * flickerIntensity });

    // Draw jagged bolt through trail
    if (trail.length > 1) {
      const jitterSeed = Math.sin(visual.pulsePhase * 20);
      const jitterPoints: { x: number; y: number }[] = trail.map((p, i) => {
        const jitterAmount = i > 0 && i < trail.length - 1 ? 6 : 0;
        const jitterPhase = visual.pulsePhase * 15 + i * 2;
        return {
          x: p.x + Math.sin(jitterPhase) * jitterAmount * jitterSeed,
          y: p.y + Math.cos(jitterPhase * 1.3) * jitterAmount * jitterSeed,
        };
      });

      // Outer glow bolt
      g.moveTo(jitterPoints[0].x, jitterPoints[0].y);
      for (let i = 1; i < jitterPoints.length; i++) {
        g.lineTo(jitterPoints[i].x, jitterPoints[i].y);
      }
      g.stroke({ width: 4 * flickerIntensity, color: colors.glow, alpha: 0.2 * pulse });

      // Main bolt
      g.moveTo(jitterPoints[0].x, jitterPoints[0].y);
      for (let i = 1; i < jitterPoints.length; i++) {
        g.lineTo(jitterPoints[i].x, jitterPoints[i].y);
      }
      g.stroke({ width: 2, color: colors.primary, alpha: 0.85 });

      // Inner bright line
      g.moveTo(jitterPoints[0].x, jitterPoints[0].y);
      for (let i = 1; i < jitterPoints.length; i++) {
        g.lineTo(jitterPoints[i].x, jitterPoints[i].y);
      }
      g.stroke({ width: 1, color: 0xffffff, alpha: 0.9 });

      // Minimal branches (only 1-2)
      for (let i = 3; i < jitterPoints.length - 2; i += 4) {
        const branchChance = Math.sin(visual.pulsePhase * 8 + i * 3);
        if (branchChance > 0.3) {
          const branchLen = 6 + Math.abs(branchChance) * 8;
          const branchAngle = visual.rotationAngle * 3 + i * 1.5;

          const bx = jitterPoints[i].x + Math.cos(branchAngle) * branchLen;
          const by = jitterPoints[i].y + Math.sin(branchAngle) * branchLen;

          g.moveTo(jitterPoints[i].x, jitterPoints[i].y);
          g.lineTo(bx, by);
          g.stroke({ width: 1, color: colors.glow, alpha: 0.4 * flickerIntensity });
        }
      }
    }

    // Central spark at tip
    g.circle(x, y, 3)
      .fill({ color: colors.core, alpha: 0.8 });

    g.circle(x, y, 1.5)
      .fill({ color: 0xffffff });
  }

  // Tech: Compact laser beam
  private drawTechProjectile(
    g: Graphics,
    x: number,
    y: number,
    trail: { x: number; y: number }[],
    colors: { primary: number; secondary: number; glow: number; core: number },
    visual: ProjectileVisual
  ) {
    const pulse = visual.energyIntensity;

    // Draw laser line through trail
    if (trail.length > 1) {
      const beamIntensity = 0.85 + Math.sin(visual.pulsePhase * 4) * 0.15;

      // Outer glow beam
      g.moveTo(trail[trail.length - 1].x, trail[trail.length - 1].y);
      for (const point of trail) {
        g.lineTo(point.x, point.y);
      }
      g.stroke({ width: 4 * beamIntensity, color: colors.glow, alpha: 0.12 * pulse });

      // Main beam
      g.moveTo(trail[trail.length - 1].x, trail[trail.length - 1].y);
      for (const point of trail) {
        g.lineTo(point.x, point.y);
      }
      g.stroke({ width: 2, color: colors.primary, alpha: 0.7 });

      // Inner bright core
      g.moveTo(trail[trail.length - 1].x, trail[trail.length - 1].y);
      for (const point of trail) {
        g.lineTo(point.x, point.y);
      }
      g.stroke({ width: 1, color: 0xffffff, alpha: 0.85 });

      // Minimal data fragments (every 4th point)
      for (let i = 2; i < trail.length; i += 4) {
        const fragProgress = i / trail.length;
        const fragSize = 1.5 * (1 - fragProgress);
        const fragAlpha = 0.5 * (1 - fragProgress) * pulse;

        g.circle(trail[i].x, trail[i].y, fragSize)
          .fill({ color: colors.glow, alpha: fragAlpha });
      }
    }

    // Compact impact point
    const impactPulse = 0.85 + Math.sin(visual.pulsePhase * 3) * 0.15;
    g.circle(x, y, 3 * impactPulse)
      .fill({ color: colors.glow, alpha: 0.3 * pulse });

    g.circle(x, y, 2 * impactPulse)
      .fill({ color: colors.primary, alpha: 0.7 });

    g.circle(x, y, 1)
      .fill({ color: 0xffffff });

    // Minimal cross-hair
    const crossSize = 4;
    const crossAlpha = 0.4 * pulse;

    g.moveTo(x - crossSize, y);
    g.lineTo(x - 1.5, y);
    g.stroke({ width: 1, color: colors.glow, alpha: crossAlpha });

    g.moveTo(x + 1.5, y);
    g.lineTo(x + crossSize, y);
    g.stroke({ width: 1, color: colors.glow, alpha: crossAlpha });

    g.moveTo(x, y - crossSize);
    g.lineTo(x, y - 1.5);
    g.stroke({ width: 1, color: colors.glow, alpha: crossAlpha });

    g.moveTo(x, y + 1.5);
    g.lineTo(x, y + crossSize);
    g.stroke({ width: 1, color: colors.glow, alpha: crossAlpha });
  }

  // Plasma: Compact energy beam (Spectre exclusive)
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
      const beamIntensity = 0.8 + Math.sin(phase * 6) * 0.2;

      // Outer plasma glow
      g.moveTo(trail[trail.length - 1].x, trail[trail.length - 1].y);
      for (const point of trail) {
        g.lineTo(point.x, point.y);
      }
      g.lineTo(x, y);
      g.stroke({ width: 5, color: colors.glow, alpha: 0.12 * beamIntensity });

      // Primary beam core (cyan)
      g.moveTo(trail[trail.length - 1].x, trail[trail.length - 1].y);
      for (const point of trail) {
        g.lineTo(point.x, point.y);
      }
      g.lineTo(x, y);
      g.stroke({ width: 2, color: colors.primary, alpha: 0.6 * beamIntensity });

      // White hot core
      g.moveTo(trail[trail.length - 1].x, trail[trail.length - 1].y);
      for (const point of trail) {
        g.lineTo(point.x, point.y);
      }
      g.lineTo(x, y);
      g.stroke({ width: 1, color: 0xffffff, alpha: 0.8 * beamIntensity });

      // Minimal tendrils (every 5th point)
      for (let i = 2; i < trail.length; i += 5) {
        const tendrilPhase = phase * 4 + i * 0.5;
        const tendrilIntensity = Math.sin(tendrilPhase) * 0.5 + 0.5;

        if (tendrilIntensity > 0.4) {
          const tendrilAngle = tendrilPhase * 1.5;
          const tendrilLen = (3 + tendrilIntensity * 3) * pulse;

          const tx = trail[i].x + Math.cos(tendrilAngle) * tendrilLen;
          const ty = trail[i].y + Math.sin(tendrilAngle) * tendrilLen;
          g.moveTo(trail[i].x, trail[i].y);
          g.lineTo(tx, ty);
          g.stroke({ width: 1, color: colors.secondary, alpha: 0.4 * tendrilIntensity });
        }
      }
    }

    // Compact plasma orb at tip
    const orbSize = size * (0.8 + pulse * 0.2);

    // Subtle outer glow
    g.circle(x, y, orbSize * 1.3)
      .fill({ color: colors.glow, alpha: 0.15 * pulse });

    // Primary orb (cyan)
    g.circle(x, y, orbSize)
      .fill({ color: colors.primary, alpha: 0.75 });

    // White hot center
    g.circle(x, y, orbSize * 0.4)
      .fill({ color: 0xffffff, alpha: 0.9 });
  }

  // Void: Compact slash with dark energy (Omega exclusive)
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

    // Minimal slash trail
    if (trail.length > 1) {
      for (let i = 0; i < Math.min(trail.length - 1, 4); i++) {
        const alpha = (1 - i / trail.length) * 0.4;
        const width = (trail.length - i) * 0.4;

        g.moveTo(trail[i].x, trail[i].y);
        g.lineTo(trail[i + 1].x, trail[i + 1].y);
        g.stroke({ width: width, color: colors.primary, alpha: alpha * 0.6 });
      }
    }

    // Compact slash shape
    const slashLength = size * 1.5;
    const slashWidth = size * 0.5;

    // Subtle void aura
    g.ellipse(x, y, slashLength * 1.1, slashWidth * 1.3)
      .fill({ color: colors.secondary, alpha: 0.1 * pulse });

    // Main golden slash
    const slashAngle = angle + Math.PI / 4;
    const cos = Math.cos(slashAngle);
    const sin = Math.sin(slashAngle);

    // Draw crescent slash shape (compact)
    g.moveTo(x - cos * slashLength, y - sin * slashLength);
    g.quadraticCurveTo(
      x + sin * slashWidth * 1.2,
      y - cos * slashWidth * 1.2,
      x + cos * slashLength,
      y + sin * slashLength
    );
    g.quadraticCurveTo(
      x - sin * slashWidth * 0.6,
      y + cos * slashWidth * 0.6,
      x - cos * slashLength,
      y - sin * slashLength
    );
    g.fill({ color: colors.primary, alpha: 0.85 });

    // White edge highlight
    g.moveTo(x - cos * slashLength * 0.7, y - sin * slashLength * 0.7);
    g.quadraticCurveTo(
      x + sin * slashWidth,
      y - cos * slashWidth,
      x + cos * slashLength * 0.7,
      y + sin * slashLength * 0.7
    );
    g.stroke({ width: 1, color: 0xffffff, alpha: 0.7 });

    // Minimal void particles (only 3)
    for (let i = 0; i < 3; i++) {
      const particlePhase = phase * 4 + (i / 3) * Math.PI * 2;
      const particleDist = slashLength * 0.4;
      const px = x + Math.cos(particlePhase) * particleDist;
      const py = y + Math.sin(particlePhase) * particleDist;

      g.circle(px, py, 1)
        .fill({ color: colors.secondary, alpha: 0.5 });
    }

    // Small impact spark
    g.circle(x, y, size * 0.25)
      .fill({ color: 0xffffff, alpha: 0.9 });
  }
}
