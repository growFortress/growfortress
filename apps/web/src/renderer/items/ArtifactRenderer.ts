/**
 * ArtifactRenderer
 *
 * Procedural rendering of artifacts using PixiJS Graphics.
 * Generates visual representations based on ArtifactVisualDefinition.
 *
 * Features:
 * - 9 shape types (hexagon, diamond, circle, star, gear, crystal, blade, shield, ring)
 * - 5 animation types (pulse, rotate, shimmer, float, static)
 * - 7 particle types (sparkles, flames, frost, void, lightning, plasma, none)
 * - Rarity-based effects (outer ring for legendary, inner glow for epic+)
 */

import { Container, Graphics } from 'pixi.js';
import type { ArtifactVisualDefinition, ArtifactShapeType, ArtifactAnimationType, ArtifactParticleType } from '@arcade/sim-core';
import { ARTIFACT_DEFINITIONS } from '@arcade/sim-core';

// ============================================================================
// TYPES
// ============================================================================

export interface ArtifactRenderOptions {
  /** Size of the artifact icon in pixels (default: 64) */
  size?: number;
  /** Whether to animate (set false for static renders) */
  animated?: boolean;
  /** Quality level (affects particle count) */
  quality?: 'low' | 'medium' | 'high';
  /** Show tooltip on hover */
  interactive?: boolean;
  /** Whether to show glow effects (default: true) */
  showGlow?: boolean;
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
  alpha: number;
}

interface ArtifactVisualState {
  container: Container;
  bodyGraphics: Graphics;
  glowGraphics: Graphics;
  particleGraphics: Graphics;
  ringGraphics?: Graphics;
  particles: Particle[];
  time: number;
  animationOffset: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_OPTIONS: Required<ArtifactRenderOptions> = {
  size: 64,
  animated: true,
  quality: 'medium',
  interactive: false,
  showGlow: true,
};

const PARTICLE_COUNTS = {
  low: 5,
  medium: 10,
  high: 20,
};

// ============================================================================
// ARTIFACT RENDERER CLASS
// ============================================================================

export class ArtifactRenderer {
  private visuals: Map<string, ArtifactVisualState> = new Map();
  private globalTime = 0;

  /**
   * Creates a visual container for an artifact
   */
  public createArtifact(
    id: string,
    definition: ArtifactVisualDefinition,
    options: ArtifactRenderOptions = {}
  ): Container {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const size = opts.size * (definition.iconScale ?? 1.0);

    // Create container hierarchy
    const container = new Container();
    container.label = `artifact_${id}`;

    // Glow layer (background)
    const glowGraphics = new Graphics();
    glowGraphics.label = 'glow';
    container.addChild(glowGraphics);

    // Outer ring (legendary only)
    let ringGraphics: Graphics | undefined;
    if (definition.hasOuterRing) {
      ringGraphics = new Graphics();
      ringGraphics.label = 'ring';
      container.addChild(ringGraphics);
    }

    // Main body
    const bodyGraphics = new Graphics();
    bodyGraphics.label = 'body';
    container.addChild(bodyGraphics);

    // Particles layer (foreground)
    const particleGraphics = new Graphics();
    particleGraphics.label = 'particles';
    container.addChild(particleGraphics);

    // Create visual state
    const state: ArtifactVisualState = {
      container,
      bodyGraphics,
      glowGraphics,
      particleGraphics,
      ringGraphics,
      particles: [],
      time: 0,
      animationOffset: Math.random() * Math.PI * 2,
    };

    // Initialize particles
    if (definition.particles !== 'none' && opts.animated) {
      const count = PARTICLE_COUNTS[opts.quality] * (definition.particleIntensity ?? 0.5);
      this.initParticles(state, definition, Math.floor(count), size);
    }

    // Initial draw
    this.drawArtifact(state, definition, size, 0);

    this.visuals.set(id, state);
    return container;
  }

  /**
   * Updates all artifacts (call in animation loop)
   */
  public update(deltaTime: number): void {
    this.globalTime += deltaTime;

    for (const [_id, state] of this.visuals) {
      state.time += deltaTime;
    }
  }

  /**
   * Updates a specific artifact's visuals
   */
  public updateArtifact(
    id: string,
    definition: ArtifactVisualDefinition,
    size: number
  ): void {
    const state = this.visuals.get(id);
    if (!state) return;

    this.drawArtifact(state, definition, size, state.time);
  }

  /**
   * Removes an artifact
   */
  public removeArtifact(id: string): void {
    const state = this.visuals.get(id);
    if (state) {
      state.container.parent?.removeChild(state.container);
      state.container.destroy({ children: true });
      this.visuals.delete(id);
    }
  }

  /**
   * Clears all artifacts
   */
  public clear(): void {
    for (const [id] of this.visuals) {
      this.removeArtifact(id);
    }
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  private drawArtifact(
    state: ArtifactVisualState,
    def: ArtifactVisualDefinition,
    size: number,
    time: number
  ): void {
    const animSpeed = def.animationSpeed ?? 1.0;
    const t = time * animSpeed + state.animationOffset;

    // Clear all graphics
    state.glowGraphics.clear();
    state.bodyGraphics.clear();
    state.particleGraphics.clear();
    state.ringGraphics?.clear();

    // Calculate animation values
    const anim = this.calculateAnimation(def.animation, t);

    // Draw glow
    this.drawGlow(state.glowGraphics, def, size, anim);

    // Draw outer ring (legendary)
    if (state.ringGraphics && def.hasOuterRing) {
      this.drawOuterRing(state.ringGraphics, def, size, t);
    }

    // Draw body shape
    this.drawShape(state.bodyGraphics, def.shape, def, size, anim);

    // Draw inner glow (epic+)
    if (def.hasInnerGlow) {
      this.drawInnerGlow(state.bodyGraphics, def, size, anim);
    }

    // Update and draw particles
    if (def.particles !== 'none') {
      this.updateParticles(state, def, size, time);
      this.drawParticles(state.particleGraphics, state.particles, def.particles);
    }
  }

  private calculateAnimation(
    type: ArtifactAnimationType,
    time: number
  ): { scale: number; rotation: number; alpha: number; offsetY: number } {
    switch (type) {
      case 'pulse':
        return {
          scale: 1 + Math.sin(time * 3) * 0.05,
          rotation: 0,
          alpha: 0.8 + Math.sin(time * 2) * 0.2,
          offsetY: 0,
        };
      case 'rotate':
        return {
          scale: 1,
          rotation: time * 0.5,
          alpha: 1,
          offsetY: 0,
        };
      case 'shimmer':
        return {
          scale: 1 + Math.sin(time * 5) * 0.02,
          rotation: 0,
          alpha: 0.9 + Math.sin(time * 8) * 0.1,
          offsetY: 0,
        };
      case 'float':
        return {
          scale: 1,
          rotation: Math.sin(time * 0.5) * 0.1,
          alpha: 1,
          offsetY: Math.sin(time * 2) * 3,
        };
      case 'static':
      default:
        return {
          scale: 1,
          rotation: 0,
          alpha: 1,
          offsetY: 0,
        };
    }
  }

  private drawGlow(
    g: Graphics,
    def: ArtifactVisualDefinition,
    size: number,
    anim: { scale: number; alpha: number }
  ): void {
    const glowSize = size * 0.6 * anim.scale;
    const glowAlpha = 0.3 * anim.alpha;

    // Outer glow
    g.circle(0, 0, glowSize * 1.3)
      .fill({ color: def.glowColor, alpha: glowAlpha * 0.3 });

    // Middle glow
    g.circle(0, 0, glowSize * 1.1)
      .fill({ color: def.glowColor, alpha: glowAlpha * 0.5 });

    // Inner glow
    g.circle(0, 0, glowSize * 0.9)
      .fill({ color: def.glowColor, alpha: glowAlpha * 0.7 });
  }

  private drawOuterRing(
    g: Graphics,
    def: ArtifactVisualDefinition,
    size: number,
    time: number
  ): void {
    const ringRadius = size * 0.55;
    const ringWidth = 2;
    const rotation = time * 0.3;

    // Main ring
    g.circle(0, 0, ringRadius)
      .stroke({ width: ringWidth, color: def.accentColor ?? def.glowColor, alpha: 0.8 });

    // Rotating accents (4 points)
    for (let i = 0; i < 4; i++) {
      const angle = rotation + (i * Math.PI / 2);
      const x = Math.cos(angle) * ringRadius;
      const y = Math.sin(angle) * ringRadius;

      g.circle(x, y, 3)
        .fill({ color: def.accentColor ?? 0xffffff, alpha: 0.9 });
    }

    // Pulsing outer ring
    const pulseRadius = ringRadius * (1.1 + Math.sin(time * 4) * 0.05);
    g.circle(0, 0, pulseRadius)
      .stroke({ width: 1, color: def.glowColor, alpha: 0.4 });
  }

  private drawShape(
    g: Graphics,
    shape: ArtifactShapeType,
    def: ArtifactVisualDefinition,
    size: number,
    anim: { scale: number; rotation: number; offsetY: number }
  ): void {
    const s = size * 0.4 * anim.scale;

    // Apply transformations
    g.rotation = anim.rotation;
    g.position.y = anim.offsetY;

    switch (shape) {
      case 'hexagon':
        this.drawHexagon(g, s, def);
        break;
      case 'diamond':
        this.drawDiamond(g, s, def);
        break;
      case 'circle':
        this.drawCircle(g, s, def);
        break;
      case 'star':
        this.drawStar(g, s, def);
        break;
      case 'gear':
        this.drawGear(g, s, def);
        break;
      case 'crystal':
        this.drawCrystal(g, s, def);
        break;
      case 'blade':
        this.drawBlade(g, s, def);
        break;
      case 'shield':
        this.drawShield(g, s, def);
        break;
      case 'ring':
        this.drawRing(g, s, def);
        break;
    }
  }

  // Shape drawing methods
  private drawHexagon(g: Graphics, s: number, def: ArtifactVisualDefinition): void {
    const points: number[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI / 3) - Math.PI / 6;
      points.push(Math.cos(angle) * s, Math.sin(angle) * s);
    }
    g.poly(points, true)
      .fill({ color: def.primaryColor })
      .stroke({ width: 2, color: def.secondaryColor });

    // Inner detail
    const innerS = s * 0.6;
    const innerPoints: number[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI / 3) - Math.PI / 6;
      innerPoints.push(Math.cos(angle) * innerS, Math.sin(angle) * innerS);
    }
    g.poly(innerPoints, true)
      .stroke({ width: 1, color: def.secondaryColor, alpha: 0.5 });
  }

  private drawDiamond(g: Graphics, s: number, def: ArtifactVisualDefinition): void {
    const points = [0, -s * 1.2, s * 0.7, 0, 0, s * 1.2, -s * 0.7, 0];
    g.poly(points, true)
      .fill({ color: def.primaryColor })
      .stroke({ width: 2, color: def.secondaryColor });

    // Inner facets
    g.moveTo(0, -s * 0.8).lineTo(s * 0.4, 0).lineTo(0, s * 0.8).lineTo(-s * 0.4, 0).closePath()
      .stroke({ width: 1, color: def.secondaryColor, alpha: 0.6 });
  }

  private drawCircle(g: Graphics, s: number, def: ArtifactVisualDefinition): void {
    g.circle(0, 0, s)
      .fill({ color: def.primaryColor })
      .stroke({ width: 2, color: def.secondaryColor });

    // Inner rings
    g.circle(0, 0, s * 0.7)
      .stroke({ width: 1, color: def.secondaryColor, alpha: 0.5 });
    g.circle(0, 0, s * 0.4)
      .fill({ color: def.secondaryColor, alpha: 0.3 });
  }

  private drawStar(g: Graphics, s: number, def: ArtifactVisualDefinition): void {
    const points: number[] = [];
    const spikes = 5;
    const outerR = s;
    const innerR = s * 0.5;

    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = (i * Math.PI / spikes) - Math.PI / 2;
      points.push(Math.cos(angle) * r, Math.sin(angle) * r);
    }

    g.poly(points, true)
      .fill({ color: def.primaryColor })
      .stroke({ width: 2, color: def.secondaryColor });

    // Center glow
    g.circle(0, 0, innerR * 0.6)
      .fill({ color: def.glowColor, alpha: 0.5 });
  }

  private drawGear(g: Graphics, s: number, def: ArtifactVisualDefinition): void {
    const teeth = 8;
    const outerR = s;
    const innerR = s * 0.75;
    const points: number[] = [];

    for (let i = 0; i < teeth; i++) {
      const angle1 = (i * Math.PI * 2 / teeth);
      const angle2 = ((i + 0.3) * Math.PI * 2 / teeth);
      const angle3 = ((i + 0.7) * Math.PI * 2 / teeth);
      const angle4 = ((i + 1) * Math.PI * 2 / teeth);

      points.push(Math.cos(angle1) * innerR, Math.sin(angle1) * innerR);
      points.push(Math.cos(angle2) * outerR, Math.sin(angle2) * outerR);
      points.push(Math.cos(angle3) * outerR, Math.sin(angle3) * outerR);
      points.push(Math.cos(angle4) * innerR, Math.sin(angle4) * innerR);
    }

    g.poly(points, true)
      .fill({ color: def.primaryColor })
      .stroke({ width: 2, color: def.secondaryColor });

    // Center hole
    g.circle(0, 0, s * 0.3)
      .fill({ color: def.secondaryColor });
    g.circle(0, 0, s * 0.15)
      .fill({ color: def.glowColor, alpha: 0.7 });
  }

  private drawCrystal(g: Graphics, s: number, def: ArtifactVisualDefinition): void {
    // Main crystal shape (elongated hexagon)
    const points = [
      0, -s * 1.3,
      s * 0.5, -s * 0.4,
      s * 0.5, s * 0.4,
      0, s * 1.3,
      -s * 0.5, s * 0.4,
      -s * 0.5, -s * 0.4,
    ];

    g.poly(points, true)
      .fill({ color: def.primaryColor })
      .stroke({ width: 2, color: def.secondaryColor });

    // Facet lines
    g.moveTo(0, -s * 1.3).lineTo(0, s * 1.3)
      .stroke({ width: 1, color: def.secondaryColor, alpha: 0.5 });
    g.moveTo(-s * 0.5, -s * 0.4).lineTo(s * 0.5, s * 0.4)
      .stroke({ width: 1, color: def.secondaryColor, alpha: 0.3 });
    g.moveTo(s * 0.5, -s * 0.4).lineTo(-s * 0.5, s * 0.4)
      .stroke({ width: 1, color: def.secondaryColor, alpha: 0.3 });
  }

  private drawBlade(g: Graphics, s: number, def: ArtifactVisualDefinition): void {
    // Blade shape
    const points = [
      0, -s * 1.4,
      s * 0.2, -s * 0.8,
      s * 0.3, s * 0.2,
      s * 0.15, s * 0.8,
      0, s * 1.0,
      -s * 0.15, s * 0.8,
      -s * 0.3, s * 0.2,
      -s * 0.2, -s * 0.8,
    ];

    g.poly(points, true)
      .fill({ color: def.primaryColor })
      .stroke({ width: 2, color: def.secondaryColor });

    // Center line (blade edge)
    g.moveTo(0, -s * 1.3).lineTo(0, s * 0.9)
      .stroke({ width: 2, color: def.glowColor, alpha: 0.8 });

    // Guard
    g.rect(-s * 0.5, s * 0.7, s * 1.0, s * 0.15)
      .fill({ color: def.secondaryColor });
  }

  private drawShield(g: Graphics, s: number, def: ArtifactVisualDefinition): void {
    // Shield shape (rounded top, pointed bottom)
    const points = [
      -s * 0.8, -s * 0.8,
      s * 0.8, -s * 0.8,
      s * 0.8, s * 0.2,
      0, s * 1.2,
      -s * 0.8, s * 0.2,
    ];

    g.poly(points, true)
      .fill({ color: def.primaryColor })
      .stroke({ width: 3, color: def.secondaryColor });

    // Inner shield design
    g.moveTo(0, -s * 0.6).lineTo(0, s * 0.8)
      .stroke({ width: 2, color: def.secondaryColor, alpha: 0.6 });
    g.moveTo(-s * 0.5, 0).lineTo(s * 0.5, 0)
      .stroke({ width: 2, color: def.secondaryColor, alpha: 0.6 });

    // Center emblem
    g.circle(0, -s * 0.1, s * 0.25)
      .fill({ color: def.glowColor, alpha: 0.6 });
  }

  private drawRing(g: Graphics, s: number, def: ArtifactVisualDefinition): void {
    // Outer ring
    g.circle(0, 0, s)
      .stroke({ width: s * 0.3, color: def.primaryColor });

    // Ring detail
    g.circle(0, 0, s * 0.85)
      .stroke({ width: 2, color: def.secondaryColor });
    g.circle(0, 0, s * 1.15)
      .stroke({ width: 1, color: def.secondaryColor, alpha: 0.5 });

    // Gem on top
    g.circle(0, -s, s * 0.2)
      .fill({ color: def.glowColor })
      .stroke({ width: 1, color: def.secondaryColor });
  }

  private drawInnerGlow(
    g: Graphics,
    def: ArtifactVisualDefinition,
    size: number,
    anim: { alpha: number }
  ): void {
    const glowSize = size * 0.15;
    const alpha = 0.5 * anim.alpha;

    // Central bright spot
    g.circle(0, 0, glowSize)
      .fill({ color: def.glowColor, alpha: alpha * 0.8 });
    g.circle(0, 0, glowSize * 0.5)
      .fill({ color: 0xffffff, alpha: alpha * 0.6 });
  }

  // Particle system
  private initParticles(
    state: ArtifactVisualState,
    def: ArtifactVisualDefinition,
    count: number,
    size: number
  ): void {
    for (let i = 0; i < count; i++) {
      state.particles.push(this.createParticle(def, size));
    }
  }

  private createParticle(def: ArtifactVisualDefinition, size: number): Particle {
    const angle = Math.random() * Math.PI * 2;
    const distance = (Math.random() * 0.5 + 0.3) * size;

    return {
      x: Math.cos(angle) * distance * 0.5,
      y: Math.sin(angle) * distance * 0.5,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5 - 0.3, // Slight upward bias
      life: Math.random(),
      maxLife: 1 + Math.random(),
      size: 2 + Math.random() * 3,
      color: def.glowColor,
      alpha: 0.5 + Math.random() * 0.5,
    };
  }

  private updateParticles(
    state: ArtifactVisualState,
    def: ArtifactVisualDefinition,
    size: number,
    deltaTime: number
  ): void {
    for (const p of state.particles) {
      p.life += deltaTime * 0.5;

      if (p.life >= p.maxLife) {
        // Reset particle
        const newP = this.createParticle(def, size);
        Object.assign(p, newP);
      } else {
        // Update position based on particle type
        this.updateParticleByType(p, def.particles, deltaTime);
      }
    }
  }

  private updateParticleByType(
    p: Particle,
    type: ArtifactParticleType,
    deltaTime: number
  ): void {
    switch (type) {
      case 'sparkles':
        p.x += p.vx * deltaTime * 30;
        p.y += p.vy * deltaTime * 30;
        p.alpha = Math.max(0, (1 - p.life / p.maxLife) * 0.8);
        break;

      case 'flames':
        p.y -= deltaTime * 20; // Rise up
        p.x += Math.sin(p.life * 10) * 0.5; // Flicker
        p.alpha = Math.max(0, (1 - p.life / p.maxLife) * 0.9);
        p.size *= 0.99; // Shrink
        break;

      case 'frost':
        p.y += Math.sin(p.life * 3) * 0.3; // Float gently
        p.x += Math.cos(p.life * 2) * 0.2;
        p.alpha = 0.3 + Math.sin(p.life * 5) * 0.2;
        break;

      case 'void':
        const angle = p.life * 2;
        p.x = Math.cos(angle) * (p.life * 10);
        p.y = Math.sin(angle) * (p.life * 10);
        p.alpha = Math.max(0, 1 - p.life / p.maxLife);
        break;

      case 'lightning':
        if (Math.random() < 0.1) {
          p.x = (Math.random() - 0.5) * 30;
          p.y = (Math.random() - 0.5) * 30;
        }
        p.alpha = Math.random() * 0.8;
        break;

      case 'plasma':
        p.x += p.vx * deltaTime * 20;
        p.y += p.vy * deltaTime * 20;
        p.vx += (Math.random() - 0.5) * 0.5;
        p.vy += (Math.random() - 0.5) * 0.5;
        p.alpha = 0.5 + Math.sin(p.life * 8) * 0.3;
        break;
    }
  }

  private drawParticles(
    g: Graphics,
    particles: Particle[],
    type: ArtifactParticleType
  ): void {
    for (const p of particles) {
      if (p.alpha <= 0) continue;

      switch (type) {
        case 'sparkles':
          // Star shape
          this.drawSparkle(g, p.x, p.y, p.size, p.color, p.alpha);
          break;

        case 'flames':
          // Teardrop shape
          g.circle(p.x, p.y, p.size)
            .fill({ color: p.color, alpha: p.alpha });
          g.circle(p.x, p.y - p.size * 0.5, p.size * 0.6)
            .fill({ color: 0xffff00, alpha: p.alpha * 0.7 });
          break;

        case 'frost':
          // Snowflake-ish
          g.circle(p.x, p.y, p.size)
            .fill({ color: 0xffffff, alpha: p.alpha });
          break;

        case 'void':
          // Dark with purple edge
          g.circle(p.x, p.y, p.size)
            .fill({ color: 0x000000, alpha: p.alpha })
            .stroke({ width: 1, color: p.color, alpha: p.alpha * 0.5 });
          break;

        case 'lightning':
          // Bright flash
          g.circle(p.x, p.y, p.size)
            .fill({ color: 0xffffff, alpha: p.alpha });
          g.circle(p.x, p.y, p.size * 1.5)
            .fill({ color: p.color, alpha: p.alpha * 0.3 });
          break;

        case 'plasma':
          // Glowing orb
          g.circle(p.x, p.y, p.size * 1.2)
            .fill({ color: p.color, alpha: p.alpha * 0.3 });
          g.circle(p.x, p.y, p.size)
            .fill({ color: p.color, alpha: p.alpha });
          break;
      }
    }
  }

  private drawSparkle(
    g: Graphics,
    x: number,
    y: number,
    size: number,
    color: number,
    alpha: number
  ): void {
    // 4-point star sparkle using PixiJS star primitive
    g.star(x, y, 4, size, size * 0.3)
      .fill({ color, alpha });
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const artifactRenderer = new ArtifactRenderer();

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Creates a static artifact icon for UI use
 */
export function createStaticArtifactIcon(
  definition: ArtifactVisualDefinition,
  size: number = 48
): Container {
  const renderer = new ArtifactRenderer();
  return renderer.createArtifact(
    `static_${Date.now()}`,
    definition,
    { size, animated: false, quality: 'high' }
  );
}

/**
 * Gets rarity-based default visual properties
 */
export function getRarityVisualDefaults(rarity: 'common' | 'rare' | 'epic' | 'legendary'): Partial<ArtifactVisualDefinition> {
  switch (rarity) {
    case 'common':
      return {
        animation: 'pulse',
        particles: 'none',
        hasOuterRing: false,
        hasInnerGlow: false,
        particleIntensity: 0,
      };
    case 'rare':
      return {
        animation: 'pulse',
        particles: 'sparkles',
        hasOuterRing: false,
        hasInnerGlow: false,
        particleIntensity: 0.3,
      };
    case 'epic':
      return {
        animation: 'shimmer',
        particles: 'sparkles',
        hasOuterRing: false,
        hasInnerGlow: true,
        particleIntensity: 0.5,
      };
    case 'legendary':
      return {
        animation: 'float',
        particles: 'sparkles',
        hasOuterRing: true,
        hasInnerGlow: true,
        particleIntensity: 0.8,
      };
  }
}

// ============================================================================
// ARTIFACT VISUALS MAP
// ============================================================================

/**
 * Map of artifact ID to visual definition, built from ARTIFACT_DEFINITIONS
 */
export const ARTIFACT_VISUALS: Record<string, ArtifactVisualDefinition> = {};

// Populate the map from definitions
for (const artifact of ARTIFACT_DEFINITIONS) {
  ARTIFACT_VISUALS[artifact.id] = artifact.visuals;
}
