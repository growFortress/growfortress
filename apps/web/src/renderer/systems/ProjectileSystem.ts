import { Container, Graphics } from 'pixi.js';
import type { GameState, ActiveProjectile, FortressClass, ProjectileType } from '@arcade/sim-core';
import { FP } from '@arcade/sim-core';
import { fpXToScreen, fpYToScreen } from '../CoordinateSystem.js';
import { graphicsSettings } from '../../state/settings.signals.js';
import {
  bossRushActive,
  bossPosition,
  bossProjectiles,
  type BossProjectile,
} from '../../state/boss-rush.signals.js';

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

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// --- PROJECTILE VISUAL CONFIG (larger, more visible effects) ---
const PROJECTILE_CONFIG: Record<ProjectileType, {
  size: number;
  trailLength: number;
  shape: 'circle' | 'spike' | 'bolt' | 'orb' | 'plasma' | 'slash';
  emissionRate: number;
  motionBlur: number;
  ghostCount: number;
  pulseSpeed: number;
  glowLayers: number;
}> = {
  physical: { size: 8, trailLength: 10, shape: 'circle', emissionRate: 6, motionBlur: 1.2, ghostCount: 3, pulseSpeed: 3, glowLayers: 2 },
  icicle: { size: 10, trailLength: 12, shape: 'spike', emissionRate: 7, motionBlur: 1.5, ghostCount: 3, pulseSpeed: 2, glowLayers: 2 },
  fireball: { size: 12, trailLength: 14, shape: 'circle', emissionRate: 10, motionBlur: 1.4, ghostCount: 4, pulseSpeed: 5, glowLayers: 3 },
  bolt: { size: 6, trailLength: 16, shape: 'bolt', emissionRate: 8, motionBlur: 2.0, ghostCount: 4, pulseSpeed: 8, glowLayers: 2 },
  laser: { size: 5, trailLength: 18, shape: 'bolt', emissionRate: 7, motionBlur: 2.5, ghostCount: 4, pulseSpeed: 4, glowLayers: 2 },
  plasma_beam: { size: 10, trailLength: 16, shape: 'plasma', emissionRate: 12, motionBlur: 2.0, ghostCount: 5, pulseSpeed: 10, glowLayers: 3 },
  void_slash: { size: 14, trailLength: 12, shape: 'slash', emissionRate: 10, motionBlur: 1.8, ghostCount: 4, pulseSpeed: 6, glowLayers: 3 },
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
  prevX: number;
  prevY: number;
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

  public update(
    state: GameState,
    viewWidth: number,
    viewHeight: number,
    alpha: number = 1,
    deltaMs: number = 16.66
  ) {
    const g = this.graphics;
    const gg = this.ghostGraphics;
    g.clear();
    gg.clear();

    const safeDeltaMs = Math.min(50, Math.max(8, deltaMs));
    this.time += safeDeltaMs;
    const dt = safeDeltaMs / 1000;
    const effectIntensity = this.getEffectIntensity();
    const renderAlpha = Math.max(0, Math.min(1, alpha));

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
          prevX: projectile.x,
          prevY: projectile.y,
          fortressClass: projectile.class,
        };
        this.visuals.set(projectile.id, visual);
      }

      // Update animation state
      const projectileType = CLASS_TO_PROJECTILE[projectile.class] || 'physical';
      const config = this.getScaledConfig(PROJECTILE_CONFIG[projectileType], effectIntensity);
      visual.pulsePhase += config.pulseSpeed * dt;
      visual.rotationAngle += dt * 3; // Slow rotation

      // Energy intensity fluctuation
      const age = (this.time - visual.birthTime) / 1000;
      visual.energyIntensity = 0.85 + Math.sin(visual.pulsePhase) * 0.15 + Math.min(age * 2, 0.15);

      // Calculate screen X position from simulation
      const interpolated = this.getInterpolatedPosition(projectile, visual, renderAlpha);
      const screenX = fpXToScreen(interpolated.x, viewWidth);

      // Calculate screen Y by interpolating between start and actual target position
      const startScreenY = this.getSourceScreenY(projectile, viewHeight);
      const targetScreenY = fpYToScreen(projectile.targetY, viewHeight);

      // Calculate progress (0 = at start, 1 = at target)
      const startX = FP.toFloat(projectile.startX);
      const currentX = FP.toFloat(interpolated.x);
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

      // Store previous simulation position for next-frame interpolation
      visual.prevX = projectile.x;
      visual.prevY = projectile.y;
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
    if (trail.length < 2 || config.ghostCount === 0) return;

    const colors = CLASS_COLORS[fortressClass] || CLASS_COLORS.natural;
    const ghostCount = Math.min(config.ghostCount, trail.length - 1);

    for (let i = 1; i <= ghostCount && i < trail.length; i++) {
      const pos = trail[i];
      if (!pos) continue;

      const ghostProgress = i / (ghostCount + 1);
      const ghostAlpha = (1 - ghostProgress) * 0.2;
      const ghostSize = config.size * (0.9 - ghostProgress * 0.5);

      if (ghostAlpha < 0.02 || ghostSize < 0.4) continue;

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

    // Sparse sparkle particles (reduced frequency, deterministic)
    const sparklePhase = visual.pulsePhase;
    for (let i = 3; i < trail.length; i += 3) {
      const progress = i / trail.length;
      const sparkleOffset = Math.sin(sparklePhase + i * 0.5) * 0.3 + 0.7;
      const alpha = (1 - progress) * 0.4 * sparkleOffset;
      const size = config.size * (1 - progress) * 0.25;

      const seedBase = visual.birthTime * 0.001 + i * 1.37 + Math.floor(sparklePhase * 2);
      if (size > 0.3 && seededRandom(seedBase) > 0.6) {
        const offsetX = (seededRandom(seedBase + 1.11) - 0.5) * 4;
        const offsetY = (seededRandom(seedBase + 2.22) - 0.5) * 4;

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

  // Fire: Dramatic blazing fireball with intense flames
  private drawFireProjectile(
    g: Graphics,
    x: number,
    y: number,
    size: number,
    colors: { primary: number; secondary: number; glow: number; core: number },
    trail: { x: number; y: number }[],
    visual: ProjectileVisual
  ) {
    const flicker = Math.sin(visual.pulsePhase * 8) * 0.15 + 1;
    const flicker2 = Math.sin(visual.pulsePhase * 12 + 1.5) * 0.1 + 1;
    const pulse = visual.energyIntensity;
    const time = visual.pulsePhase;

    // Outer heat distortion glow (large, subtle)
    g.circle(x, y, size * 2.2 * flicker * pulse)
      .fill({ color: colors.glow, alpha: 0.08 * pulse });

    // Middle heat glow layer
    g.circle(x, y, size * 1.6 * flicker2 * pulse)
      .fill({ color: colors.glow, alpha: 0.15 * pulse });

    // Flame tendrils reaching outward (4 directions)
    for (let i = 0; i < 4; i++) {
      const tendrilAngle = time * 3 + (Math.PI * 2 * i) / 4;
      const tendrilLen = size * (0.6 + Math.sin(time * 6 + i) * 0.3);
      const tx = x + Math.cos(tendrilAngle) * tendrilLen;
      const ty = y + Math.sin(tendrilAngle) * tendrilLen;
      g.circle(tx, ty, size * 0.35 * flicker)
        .fill({ color: colors.secondary, alpha: 0.5 * pulse });
    }

    // Secondary flame layer (orange)
    const wobbleX = Math.sin(time * 5) * size * 0.15;
    const wobbleY = Math.cos(time * 4) * size * 0.1;
    g.circle(x + wobbleX, y + wobbleY, size * 1.1 * flicker)
      .fill({ color: colors.secondary, alpha: 0.7 * pulse });

    // Primary flame core (red-orange)
    g.circle(x - wobbleX * 0.5, y - wobbleY * 0.5, size * 0.85 * flicker2)
      .fill({ color: colors.primary });

    // Inner hot core (yellow)
    g.circle(x, y, size * 0.5 * flicker)
      .fill({ color: colors.core });

    // White hot center
    g.circle(x, y, size * 0.25)
      .fill({ color: 0xffffff });

    // Bright white spark at center (pulsing)
    const sparkSize = size * 0.12 * (1 + Math.sin(time * 15) * 0.3);
    g.circle(x, y, sparkSize)
      .fill({ color: 0xffffff, alpha: 0.9 });

    // Flame trail with embers rising
    if (trail.length > 2) {
      for (let i = 1; i < Math.min(8, trail.length); i++) {
        const progress = i / 8;
        const emberSize = size * 0.4 * (1 - progress * 0.8);
        const emberAlpha = 0.7 * (1 - progress * 0.9) * pulse;
        const emberPhase = time + i * 0.6;

        // Embers rise and drift
        const emberOffsetX = Math.sin(emberPhase * 2) * (3 + i * 0.5);
        const emberOffsetY = Math.cos(emberPhase * 1.5) * 2 - i * 2;

        // Main ember
        g.circle(trail[i].x + emberOffsetX, trail[i].y + emberOffsetY, emberSize)
          .fill({ color: i % 2 === 0 ? colors.primary : colors.secondary, alpha: emberAlpha });

        // Small spark alongside ember
        if (i % 2 === 0) {
          const sparkOff = Math.sin(emberPhase * 4) * 4;
          g.circle(trail[i].x + sparkOff, trail[i].y + emberOffsetY - 2, emberSize * 0.4)
            .fill({ color: colors.glow, alpha: emberAlpha * 0.6 });
        }
      }

      // Smoke wisps at trail end
      if (trail.length > 4) {
        for (let i = 4; i < Math.min(7, trail.length); i++) {
          const smokeAlpha = 0.15 * (1 - (i - 4) / 3);
          const smokeSize = size * 0.5 * (1 + (i - 4) * 0.3);
          const smokeY = trail[i].y - (i - 4) * 3;
          g.circle(trail[i].x, smokeY, smokeSize)
            .fill({ color: 0x444444, alpha: smokeAlpha });
        }
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
    if (trail.length > 1) {
      const lastTrail = trail[1];
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

  private getInterpolatedPosition(
    projectile: ActiveProjectile,
    visual: ProjectileVisual,
    alpha: number
  ): { x: number; y: number } {
    const clampedAlpha = Math.max(0, Math.min(1, alpha));
    if (clampedAlpha >= 1) {
      return { x: projectile.x, y: projectile.y };
    }

    if (clampedAlpha <= 0) {
      return { x: visual.prevX, y: visual.prevY };
    }

    const t = FP.fromFloat(clampedAlpha);
    return {
      x: FP.lerp(visual.prevX, projectile.x, t),
      y: FP.lerp(visual.prevY, projectile.y, t),
    };
  }

  private getEffectIntensity(): number {
    const { particles, quality } = graphicsSettings.value;
    const qualityScale = quality === 'low' ? 0.5 : quality === 'medium' ? 0.75 : 1;
    return Math.max(0.35, Math.min(1, particles * qualityScale));
  }

  private getScaledConfig(
    config: typeof PROJECTILE_CONFIG[ProjectileType],
    intensity: number
  ): typeof PROJECTILE_CONFIG[ProjectileType] {
    const trailLength = Math.max(2, Math.round(config.trailLength * intensity));
    const ghostCount = Math.max(0, Math.round(config.ghostCount * intensity));
    const glowLayers = Math.max(1, Math.round(config.glowLayers * intensity));
    const emissionRate = Math.max(4, config.emissionRate * intensity);
    return {
      ...config,
      trailLength,
      ghostCount,
      glowLayers,
      emissionRate,
    };
  }

  // ============================================================================
  // BOSS RUSH PROJECTILE RENDERING
  // ============================================================================

  /**
   * Render boss projectiles with arc trajectory in Boss Rush mode.
   * Called separately from regular projectile update.
   */
  public renderBossProjectiles(
    viewWidth: number,
    viewHeight: number,
    fortressScreenX: number
  ): void {
    if (!bossRushActive.value || !bossPosition.value) return;

    const g = this.graphics;
    const projectiles = bossProjectiles.value;

    // Convert boss position from fixed-point to screen coordinates
    const bossScreenX = fpXToScreen(FP.fromFloat(bossPosition.value.x), viewWidth);
    const bossScreenY = fpYToScreen(FP.fromFloat(bossPosition.value.y), viewHeight);

    for (const proj of projectiles) {
      this.drawBossProjectile(
        g,
        proj,
        bossScreenX,
        bossScreenY,
        fortressScreenX,
        viewHeight * 0.5, // Fortress Y (center)
        viewWidth,
        viewHeight
      );
    }
  }

  /**
   * Draw a single boss projectile with parabolic arc trajectory.
   * Creates a large, menacing fireball-like projectile.
   */
  private drawBossProjectile(
    g: Graphics,
    proj: BossProjectile,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    _viewWidth: number,
    viewHeight: number
  ): void {
    const progress = proj.progress;

    // Parabolic arc trajectory
    // At progress=0.5 (apex), arc reaches maximum height
    const arcHeight = viewHeight * 0.15; // 15% of screen height
    const arcOffset = -4 * arcHeight * progress * (1 - progress);

    // Linear interpolation for X and Y base position
    const x = startX + (endX - startX) * progress;
    const baseY = startY + (endY - startY) * progress;
    const y = baseY + arcOffset; // Subtract because Y goes down

    // Boss projectile uses fire-like colors (ominous red/orange)
    const colors = {
      primary: 0xcc0000,   // Dark red
      secondary: 0xff4400, // Orange-red
      glow: 0xff6600,      // Orange glow
      core: 0xffaa00,      // Yellow-orange core
    };

    // Size based on progress (gets slightly larger as it approaches)
    const baseSize = 18;
    const size = baseSize * (0.8 + progress * 0.4);

    // Pulsing effect
    const pulse = 0.9 + Math.sin(this.time * 0.01 + proj.id) * 0.1;

    // Outer fiery aura (large, scary)
    g.circle(x, y, size * 2.5 * pulse)
      .fill({ color: colors.glow, alpha: 0.1 * pulse });

    g.circle(x, y, size * 1.8 * pulse)
      .fill({ color: colors.secondary, alpha: 0.2 * pulse });

    // Fire trail effect (behind the projectile)
    const trailCount = 8;
    for (let i = 1; i <= trailCount; i++) {
      const trailProgress = progress - i * 0.015;
      if (trailProgress < 0) continue;

      const trailArcOffset = -4 * arcHeight * trailProgress * (1 - trailProgress);
      const trailX = startX + (endX - startX) * trailProgress;
      const trailBaseY = startY + (endY - startY) * trailProgress;
      const trailY = trailBaseY + trailArcOffset;

      const trailAlpha = (1 - i / trailCount) * 0.4;
      const trailSize = size * (1 - i / trailCount * 0.5);

      // Ember/smoke trail
      g.circle(trailX, trailY, trailSize)
        .fill({ color: i % 2 === 0 ? colors.primary : colors.secondary, alpha: trailAlpha });
    }

    // Main fireball body (layered for depth)
    g.circle(x, y, size * 1.2)
      .fill({ color: colors.primary });

    g.circle(x, y, size * 0.9)
      .fill({ color: colors.secondary });

    g.circle(x, y, size * 0.5)
      .fill({ color: colors.core });

    // White hot center
    g.circle(x, y, size * 0.25)
      .fill({ color: 0xffffff, alpha: 0.95 });

    // Sparks around the fireball
    const sparkCount = 4;
    for (let i = 0; i < sparkCount; i++) {
      const sparkAngle = (this.time * 0.005 + proj.id * 0.1) + (Math.PI * 2 * i) / sparkCount;
      const sparkDist = size * 1.1;
      const sparkX = x + Math.cos(sparkAngle) * sparkDist;
      const sparkY = y + Math.sin(sparkAngle) * sparkDist;
      const sparkSize = 3 + Math.sin(this.time * 0.02 + i) * 1.5;

      g.circle(sparkX, sparkY, sparkSize)
        .fill({ color: colors.glow, alpha: 0.7 });
    }

    // Impact warning - draw target marker when close to hitting
    if (progress > 0.7) {
      const warningAlpha = (progress - 0.7) / 0.3 * 0.5;
      const warningPulse = 1 + Math.sin(this.time * 0.03) * 0.2;

      // Target circle at impact point
      g.circle(endX, endY, 20 * warningPulse)
        .stroke({ width: 2, color: 0xff0000, alpha: warningAlpha });

      g.circle(endX, endY, 30 * warningPulse)
        .stroke({ width: 1, color: 0xff0000, alpha: warningAlpha * 0.5 });
    }
  }
}
