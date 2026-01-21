/**
 * CrystalRenderer
 *
 * Procedural rendering of Crystals (formerly Infinity Stones) using PixiJS Graphics.
 * Each crystal has a unique color scheme and visual effects.
 *
 * Crystal Types:
 * - Power (Red) - Raw destructive energy
 * - Space (Blue) - Teleportation and portals
 * - Time (Green) - Temporal manipulation
 * - Reality (Yellow/Orange) - Matter manipulation
 * - Soul (Orange) - Life force control
 * - Mind (Yellow) - Psychic powers
 */

import { Container, Graphics } from 'pixi.js';
import type { CrystalType } from '@arcade/sim-core';

// ============================================================================
// TYPES
// ============================================================================

export interface CrystalVisualDefinition {
  primaryColor: number;
  secondaryColor: number;
  glowColor: number;
  innerColor: number;
  particleColor: number;
  name: string;
  polishName: string;
}

export interface CrystalRenderOptions {
  /** Size of the crystal in pixels */
  size: number;
  /** Whether to animate */
  animated?: boolean;
  /** Show fragment count (0-10) */
  fragmentCount?: number;
  /** Is this a full crystal or just fragments */
  isFullCrystal?: boolean;
  /** Quality level */
  quality?: 'low' | 'medium' | 'high';
}

interface CrystalVisualState {
  container: Container;
  crystalGraphics: Graphics;
  glowGraphics: Graphics;
  particleGraphics: Graphics;
  fragmentGraphics?: Graphics;
  particles: CrystalParticle[];
  time: number;
  pulsePhase: number;
}

interface CrystalParticle {
  angle: number;
  distance: number;
  speed: number;
  size: number;
  alpha: number;
  orbitSpeed: number;
}

// ============================================================================
// CRYSTAL VISUAL DEFINITIONS
// ============================================================================

export const CRYSTAL_VISUALS: Record<CrystalType, CrystalVisualDefinition> = {
  power: {
    primaryColor: 0x9b2335,
    secondaryColor: 0xdc143c,
    glowColor: 0xff4444,
    innerColor: 0xff6b6b,
    particleColor: 0xffaaaa,
    name: 'Power Crystal',
    polishName: 'Kryształ Mocy',
  },
  space: {
    primaryColor: 0x1e3a8a,
    secondaryColor: 0x3b82f6,
    glowColor: 0x60a5fa,
    innerColor: 0x93c5fd,
    particleColor: 0xbfdbfe,
    name: 'Space Crystal',
    polishName: 'Kryształ Przestrzeni',
  },
  time: {
    primaryColor: 0x166534,
    secondaryColor: 0x22c55e,
    glowColor: 0x4ade80,
    innerColor: 0x86efac,
    particleColor: 0xbbf7d0,
    name: 'Time Crystal',
    polishName: 'Kryształ Czasu',
  },
  reality: {
    primaryColor: 0xb45309,
    secondaryColor: 0xf59e0b,
    glowColor: 0xfbbf24,
    innerColor: 0xfcd34d,
    particleColor: 0xfde68a,
    name: 'Reality Crystal',
    polishName: 'Kryształ Rzeczywistości',
  },
  soul: {
    primaryColor: 0xc2410c,
    secondaryColor: 0xf97316,
    glowColor: 0xfb923c,
    innerColor: 0xfdba74,
    particleColor: 0xfed7aa,
    name: 'Soul Crystal',
    polishName: 'Kryształ Duszy',
  },
  mind: {
    primaryColor: 0xa16207,
    secondaryColor: 0xeab308,
    glowColor: 0xfacc15,
    innerColor: 0xfde047,
    particleColor: 0xfef08a,
    name: 'Mind Crystal',
    polishName: 'Kryształ Umysłu',
  },
};

// ============================================================================
// CONSTANTS
// ============================================================================

const FRAGMENTS_FOR_FULL_CRYSTAL = 10;

const PARTICLE_COUNTS = {
  low: 4,
  medium: 8,
  high: 16,
};

// ============================================================================
// CRYSTAL RENDERER CLASS
// ============================================================================

export class CrystalRenderer {
  private visuals: Map<string, CrystalVisualState> = new Map();

  /**
   * Creates a visual container for a crystal
   */
  public createCrystal(
    id: string,
    crystalType: CrystalType,
    options: CrystalRenderOptions = { size: 48 }
  ): Container {
    const def = CRYSTAL_VISUALS[crystalType];
    const opts = {
      animated: true,
      fragmentCount: 0,
      isFullCrystal: false,
      quality: 'medium' as const,
      ...options,
    };

    const container = new Container();
    container.label = `crystal_${id}`;

    // Glow layer
    const glowGraphics = new Graphics();
    glowGraphics.label = 'glow';
    container.addChild(glowGraphics);

    // Main crystal
    const crystalGraphics = new Graphics();
    crystalGraphics.label = 'crystal';
    container.addChild(crystalGraphics);

    // Particles
    const particleGraphics = new Graphics();
    particleGraphics.label = 'particles';
    container.addChild(particleGraphics);

    // Fragment indicator (if not full)
    let fragmentGraphics: Graphics | undefined;
    if (!opts.isFullCrystal && opts.fragmentCount !== undefined) {
      fragmentGraphics = new Graphics();
      fragmentGraphics.label = 'fragments';
      container.addChild(fragmentGraphics);
    }

    // Initialize particles
    const particles: CrystalParticle[] = [];
    if (opts.animated) {
      const count = PARTICLE_COUNTS[opts.quality];
      for (let i = 0; i < count; i++) {
        particles.push({
          angle: Math.random() * Math.PI * 2,
          distance: 0.6 + Math.random() * 0.3,
          speed: 0.3 + Math.random() * 0.4,
          size: 2 + Math.random() * 3,
          alpha: 0.4 + Math.random() * 0.4,
          orbitSpeed: (Math.random() - 0.5) * 2,
        });
      }
    }

    const state: CrystalVisualState = {
      container,
      crystalGraphics,
      glowGraphics,
      particleGraphics,
      fragmentGraphics,
      particles,
      time: 0,
      pulsePhase: Math.random() * Math.PI * 2,
    };

    // Initial draw
    this.drawCrystal(state, def, opts, 0);

    this.visuals.set(id, state);
    return container;
  }

  /**
   * Updates all crystals
   */
  public update(deltaTime: number): void {
    for (const [, state] of this.visuals) {
      state.time += deltaTime;
    }
  }

  /**
   * Updates a specific crystal
   */
  public updateCrystal(
    id: string,
    crystalType: CrystalType,
    options: CrystalRenderOptions
  ): void {
    const state = this.visuals.get(id);
    if (!state) return;

    const def = CRYSTAL_VISUALS[crystalType];
    this.drawCrystal(state, def, options, state.time);
  }

  /**
   * Removes a crystal
   */
  public removeCrystal(id: string): void {
    const state = this.visuals.get(id);
    if (state) {
      state.container.parent?.removeChild(state.container);
      state.container.destroy({ children: true });
      this.visuals.delete(id);
    }
  }

  /**
   * Clears all crystals
   */
  public clear(): void {
    for (const [id] of this.visuals) {
      this.removeCrystal(id);
    }
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  private drawCrystal(
    state: CrystalVisualState,
    def: CrystalVisualDefinition,
    options: CrystalRenderOptions,
    time: number
  ): void {
    const s = options.size / 2;
    const t = time + state.pulsePhase;

    // Clear all
    state.glowGraphics.clear();
    state.crystalGraphics.clear();
    state.particleGraphics.clear();
    state.fragmentGraphics?.clear();

    const isFullCrystal = options.isFullCrystal ||
      (options.fragmentCount !== undefined && options.fragmentCount >= FRAGMENTS_FOR_FULL_CRYSTAL);

    // Animation values
    const pulseScale = 1 + Math.sin(t * 3) * 0.05;
    const glowAlpha = 0.4 + Math.sin(t * 2) * 0.2;

    // Draw glow
    this.drawGlow(state.glowGraphics, def, s, glowAlpha, isFullCrystal);

    // Draw crystal body
    if (isFullCrystal) {
      this.drawFullCrystal(state.crystalGraphics, def, s, pulseScale, t);
    } else {
      this.drawFragmentedCrystal(
        state.crystalGraphics,
        def,
        s,
        options.fragmentCount ?? 0,
        t
      );
    }

    // Draw particles
    if (options.animated) {
      this.updateAndDrawParticles(state, def, s, time);
    }

    // Draw fragment counter
    if (state.fragmentGraphics && !isFullCrystal && options.fragmentCount !== undefined) {
      this.drawFragmentCounter(state.fragmentGraphics, options.fragmentCount, s);
    }
  }

  private drawGlow(
    g: Graphics,
    def: CrystalVisualDefinition,
    size: number,
    alpha: number,
    isFullCrystal: boolean
  ): void {
    const glowSize = size * (isFullCrystal ? 1.4 : 1.0);

    // Outer glow
    g.circle(0, 0, glowSize)
      .fill({ color: def.glowColor, alpha: alpha * 0.2 });

    // Middle glow
    g.circle(0, 0, glowSize * 0.8)
      .fill({ color: def.glowColor, alpha: alpha * 0.3 });

    // Inner glow
    if (isFullCrystal) {
      g.circle(0, 0, glowSize * 0.6)
        .fill({ color: def.innerColor, alpha: alpha * 0.4 });
    }
  }

  private drawFullCrystal(
    g: Graphics,
    def: CrystalVisualDefinition,
    size: number,
    scale: number,
    time: number
  ): void {
    const s = size * 0.8 * scale;

    // Crystal gem shape (elongated hexagonal)
    const points = [
      0, -s * 1.2,
      s * 0.6, -s * 0.4,
      s * 0.6, s * 0.4,
      0, s * 1.2,
      -s * 0.6, s * 0.4,
      -s * 0.6, -s * 0.4,
    ];

    // Main body
    g.poly(points, true)
      .fill({ color: def.primaryColor })
      .stroke({ width: 2, color: def.secondaryColor });

    // Facets
    g.moveTo(0, -s * 1.2).lineTo(0, s * 1.2)
      .stroke({ width: 1, color: def.secondaryColor, alpha: 0.6 });
    g.moveTo(-s * 0.6, -s * 0.4).lineTo(s * 0.6, s * 0.4)
      .stroke({ width: 1, color: def.secondaryColor, alpha: 0.4 });
    g.moveTo(s * 0.6, -s * 0.4).lineTo(-s * 0.6, s * 0.4)
      .stroke({ width: 1, color: def.secondaryColor, alpha: 0.4 });

    // Inner glow core
    const coreAlpha = 0.6 + Math.sin(time * 4) * 0.2;
    g.circle(0, 0, s * 0.25)
      .fill({ color: def.innerColor, alpha: coreAlpha });
    g.circle(0, 0, s * 0.12)
      .fill({ color: 0xffffff, alpha: coreAlpha * 0.7 });

    // Highlight
    g.ellipse(-s * 0.2, -s * 0.5, s * 0.15, s * 0.08)
      .fill({ color: 0xffffff, alpha: 0.5 });
  }

  private drawFragmentedCrystal(
    g: Graphics,
    def: CrystalVisualDefinition,
    size: number,
    fragmentCount: number,
    time: number
  ): void {
    const s = size * 0.6;
    const fillRatio = fragmentCount / FRAGMENTS_FOR_FULL_CRYSTAL;

    // Empty shell outline
    const points = [
      0, -s * 1.1,
      s * 0.5, -s * 0.35,
      s * 0.5, s * 0.35,
      0, s * 1.1,
      -s * 0.5, s * 0.35,
      -s * 0.5, -s * 0.35,
    ];

    // Draw shell
    g.poly(points, true)
      .fill({ color: def.primaryColor, alpha: 0.3 })
      .stroke({ width: 2, color: def.secondaryColor, alpha: 0.5 });

    // Draw filled portion based on fragment count
    if (fragmentCount > 0) {
      const fillHeight = s * 2.2 * fillRatio;
      const yOffset = s * 1.1 - fillHeight;

      // Clip to crystal shape by drawing partial fill
      g.rect(-s * 0.45, yOffset, s * 0.9, fillHeight)
        .fill({ color: def.primaryColor, alpha: 0.7 });

      // Glow at fill level
      const glowY = yOffset;
      g.ellipse(0, glowY, s * 0.4, s * 0.1)
        .fill({ color: def.glowColor, alpha: 0.5 + Math.sin(time * 3) * 0.2 });
    }

    // Draw individual fragment sparkles
    for (let i = 0; i < fragmentCount; i++) {
      const angle = (i / FRAGMENTS_FOR_FULL_CRYSTAL) * Math.PI * 2 + time * 0.5;
      const dist = s * 0.3;
      const x = Math.cos(angle) * dist;
      const y = Math.sin(angle) * dist * 0.5;

      g.circle(x, y, 2 + Math.sin(time * 4 + i) * 1)
        .fill({ color: def.glowColor, alpha: 0.8 });
    }
  }

  private drawFragmentCounter(g: Graphics, count: number, size: number): void {
    const s = size;

    // Background pill
    g.roundRect(s * 0.4, s * 0.6, s * 0.6, s * 0.35, s * 0.1)
      .fill({ color: 0x000000, alpha: 0.7 })
      .stroke({ width: 1, color: 0xffffff, alpha: 0.3 });

    // Text would be rendered via PIXI.Text, but for Graphics we show dots
    const filled = Math.min(count, 10);
    for (let i = 0; i < 10; i++) {
      const col = i % 5;
      const row = Math.floor(i / 5);
      const x = s * 0.48 + col * s * 0.1;
      const y = s * 0.68 + row * s * 0.12;
      const isFilled = i < filled;

      g.circle(x, y, 2)
        .fill({ color: isFilled ? 0x4ade80 : 0x374151, alpha: isFilled ? 1 : 0.5 });
    }
  }

  private updateAndDrawParticles(
    state: CrystalVisualState,
    def: CrystalVisualDefinition,
    size: number,
    time: number
  ): void {
    const g = state.particleGraphics;

    for (const p of state.particles) {
      // Update orbit
      p.angle += p.orbitSpeed * 0.02;

      // Calculate position
      const dist = size * p.distance;
      const x = Math.cos(p.angle) * dist;
      const y = Math.sin(p.angle) * dist * 0.6; // Elliptical orbit

      // Pulsing alpha
      const alpha = p.alpha * (0.7 + Math.sin(time * p.speed * 5) * 0.3);

      // Draw particle
      g.circle(x, y, p.size)
        .fill({ color: def.particleColor, alpha });

      // Glow
      g.circle(x, y, p.size * 1.5)
        .fill({ color: def.glowColor, alpha: alpha * 0.3 });
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const crystalRenderer = new CrystalRenderer();

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Creates a static crystal icon for UI use
 */
export function createStaticCrystalIcon(
  crystalType: CrystalType,
  size: number = 48,
  fragmentCount?: number
): Container {
  const renderer = new CrystalRenderer();
  return renderer.createCrystal(
    `static_${crystalType}_${Date.now()}`,
    crystalType,
    {
      size,
      animated: false,
      fragmentCount,
      isFullCrystal: fragmentCount === undefined || fragmentCount >= FRAGMENTS_FOR_FULL_CRYSTAL,
      quality: 'high',
    }
  );
}

/**
 * Creates a crystal matrix display (all 6 crystals arranged)
 */
export function createCrystalMatrixDisplay(
  crystalStates: Record<CrystalType, { fragments: number; isFull: boolean }>,
  iconSize: number = 40
): Container {
  const container = new Container();
  const renderer = new CrystalRenderer();

  const types: CrystalType[] = ['power', 'space', 'time', 'reality', 'soul', 'mind'];
  const positions = [
    { x: 0, y: -iconSize * 1.2 },      // Top
    { x: iconSize * 1.0, y: -iconSize * 0.4 },   // Top right
    { x: iconSize * 1.0, y: iconSize * 0.4 },    // Bottom right
    { x: 0, y: iconSize * 1.2 },       // Bottom
    { x: -iconSize * 1.0, y: iconSize * 0.4 },   // Bottom left
    { x: -iconSize * 1.0, y: -iconSize * 0.4 },  // Top left
  ];

  types.forEach((type, i) => {
    const state = crystalStates[type];
    const crystal = renderer.createCrystal(
      `matrix_${type}`,
      type,
      {
        size: iconSize,
        animated: true,
        fragmentCount: state.fragments,
        isFullCrystal: state.isFull,
        quality: 'medium',
      }
    );
    crystal.position.set(positions[i].x, positions[i].y);
    container.addChild(crystal);
  });

  return container;
}

/**
 * Gets crystal visual definition
 */
export function getCrystalVisual(crystalType: CrystalType): CrystalVisualDefinition {
  return CRYSTAL_VISUALS[crystalType];
}

/**
 * Gets crystal display name
 */
export function getCrystalName(crystalType: CrystalType, polish: boolean = false): string {
  const def = CRYSTAL_VISUALS[crystalType];
  return polish ? def.polishName : def.name;
}
