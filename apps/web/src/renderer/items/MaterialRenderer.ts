/**
 * MaterialRenderer
 *
 * Procedural rendering of crafting materials using PixiJS Graphics.
 * Each material type has a unique visual representation.
 */

import { Container, Graphics } from 'pixi.js';
import type { MaterialType } from '@arcade/sim-core';

// ============================================================================
// TYPES
// ============================================================================

export interface MaterialVisualDefinition {
  shape: 'cube' | 'sphere' | 'crystal' | 'vial' | 'shard' | 'essence' | 'ingot' | 'powder';
  primaryColor: number;
  secondaryColor: number;
  glowColor: number;
  rarity: 'common' | 'rare' | 'very_rare';
}

export interface MaterialRenderOptions {
  size: number;
  animated?: boolean;
  showGlow?: boolean;
}

// ============================================================================
// MATERIAL VISUAL DEFINITIONS
// ============================================================================

export const MATERIAL_VISUALS: Record<MaterialType, MaterialVisualDefinition> = {
  // Core materials
  adamantium: {
    shape: 'ingot',
    primaryColor: 0x4a5568,
    secondaryColor: 0x718096,
    glowColor: 0x63b3ed,
    rarity: 'very_rare',
  },
  vibranium: {
    shape: 'crystal',
    primaryColor: 0x805ad5,
    secondaryColor: 0xb794f4,
    glowColor: 0xe9d8fd,
    rarity: 'rare',
  },
  uru: {
    shape: 'shard',
    primaryColor: 0x718096,
    secondaryColor: 0xa0aec0,
    glowColor: 0xfbd38d,
    rarity: 'rare',
  },
  darkforce: {
    shape: 'essence',
    primaryColor: 0x1a202c,
    secondaryColor: 0x4a5568,
    glowColor: 0x9f7aea,
    rarity: 'rare',
  },
  cosmic_dust: {
    shape: 'powder',
    primaryColor: 0x2b6cb0,
    secondaryColor: 0x4299e1,
    glowColor: 0x90cdf4,
    rarity: 'common',
  },
  mutant_dna: {
    shape: 'vial',
    primaryColor: 0x48bb78,
    secondaryColor: 0x68d391,
    glowColor: 0x9ae6b4,
    rarity: 'common',
  },
  pym_particles: {
    shape: 'sphere',
    primaryColor: 0xed8936,
    secondaryColor: 0xf6ad55,
    glowColor: 0xfbd38d,
    rarity: 'common',
  },
  extremis: {
    shape: 'vial',
    primaryColor: 0xe53e3e,
    secondaryColor: 0xfc8181,
    glowColor: 0xfeb2b2,
    rarity: 'rare',
  },
  super_soldier_serum: {
    shape: 'vial',
    primaryColor: 0x3182ce,
    secondaryColor: 0x63b3ed,
    glowColor: 0xbee3f8,
    rarity: 'very_rare',
  },

  // Boss essence materials
  boss_essence_streets: {
    shape: 'essence',
    primaryColor: 0xed8936,
    secondaryColor: 0xf6ad55,
    glowColor: 0xfbd38d,
    rarity: 'rare',
  },
  boss_essence_science: {
    shape: 'essence',
    primaryColor: 0x00bcd4,
    secondaryColor: 0x4dd0e1,
    glowColor: 0x80deea,
    rarity: 'rare',
  },
  boss_essence_mutants: {
    shape: 'essence',
    primaryColor: 0x9c27b0,
    secondaryColor: 0xba68c8,
    glowColor: 0xce93d8,
    rarity: 'rare',
  },
  boss_essence_cosmos: {
    shape: 'essence',
    primaryColor: 0x3f51b5,
    secondaryColor: 0x7986cb,
    glowColor: 0x9fa8da,
    rarity: 'rare',
  },
  boss_essence_magic: {
    shape: 'essence',
    primaryColor: 0x673ab7,
    secondaryColor: 0x9575cd,
    glowColor: 0xb39ddb,
    rarity: 'rare',
  },
  boss_essence_gods: {
    shape: 'essence',
    primaryColor: 0xffc107,
    secondaryColor: 0xffca28,
    glowColor: 0xffd54f,
    rarity: 'very_rare',
  },
  boss_essence_random: {
    shape: 'essence',
    primaryColor: 0x607d8b,
    secondaryColor: 0x90a4ae,
    glowColor: 0xb0bec5,
    rarity: 'rare',
  },
  boss_trophy_gold: {
    shape: 'cube',
    primaryColor: 0xffc107,
    secondaryColor: 0xffca28,
    glowColor: 0xffe082,
    rarity: 'very_rare',
  },
  boss_trophy_platinum: {
    shape: 'cube',
    primaryColor: 0xe0e0e0,
    secondaryColor: 0xf5f5f5,
    glowColor: 0xffffff,
    rarity: 'very_rare',
  },
};

// ============================================================================
// RARITY COLORS
// ============================================================================

const RARITY_GLOW_COLORS = {
  common: 0x9ca3af,
  rare: 0x3b82f6,
  very_rare: 0xa855f7,
};

// ============================================================================
// MATERIAL RENDERER CLASS
// ============================================================================

export class MaterialRenderer {
  private visuals: Map<string, { container: Container; time: number }> = new Map();

  /**
   * Creates a visual container for a material
   */
  public createMaterial(
    id: string,
    materialType: MaterialType,
    options: MaterialRenderOptions = { size: 32 }
  ): Container {
    const def = MATERIAL_VISUALS[materialType];
    if (!def) {
      console.warn(`Unknown material type: ${materialType}`);
      return new Container();
    }

    const container = new Container();
    container.label = `material_${id}`;

    const graphics = new Graphics();
    this.drawMaterial(graphics, def, options);
    container.addChild(graphics);

    this.visuals.set(id, { container, time: 0 });
    return container;
  }

  /**
   * Updates animated materials
   */
  public update(deltaTime: number): void {
    for (const [, visual] of this.visuals) {
      visual.time += deltaTime;
    }
  }

  /**
   * Removes a material
   */
  public removeMaterial(id: string): void {
    const visual = this.visuals.get(id);
    if (visual) {
      visual.container.destroy({ children: true });
      this.visuals.delete(id);
    }
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  private drawMaterial(
    g: Graphics,
    def: MaterialVisualDefinition,
    options: MaterialRenderOptions
  ): void {
    const s = options.size / 2;

    // Draw glow if enabled
    if (options.showGlow !== false) {
      const glowColor = RARITY_GLOW_COLORS[def.rarity];
      g.circle(0, 0, s * 1.2)
        .fill({ color: glowColor, alpha: 0.2 });
      g.circle(0, 0, s * 1.0)
        .fill({ color: def.glowColor, alpha: 0.3 });
    }

    // Draw shape
    switch (def.shape) {
      case 'cube':
        this.drawCube(g, s, def);
        break;
      case 'sphere':
        this.drawSphere(g, s, def);
        break;
      case 'crystal':
        this.drawCrystal(g, s, def);
        break;
      case 'vial':
        this.drawVial(g, s, def);
        break;
      case 'shard':
        this.drawShard(g, s, def);
        break;
      case 'essence':
        this.drawEssence(g, s, def);
        break;
      case 'ingot':
        this.drawIngot(g, s, def);
        break;
      case 'powder':
        this.drawPowder(g, s, def);
        break;
    }
  }

  private drawCube(g: Graphics, s: number, def: MaterialVisualDefinition): void {
    // Isometric cube
    const h = s * 0.6;

    // Top face
    g.poly([0, -s, s * 0.8, -s + h, 0, -s + h * 2, -s * 0.8, -s + h], true)
      .fill({ color: this.lightenColor(def.primaryColor, 0.2) });

    // Left face
    g.poly([-s * 0.8, -s + h, 0, -s + h * 2, 0, s * 0.3, -s * 0.8, s * 0.3 - h], true)
      .fill({ color: def.primaryColor });

    // Right face
    g.poly([s * 0.8, -s + h, 0, -s + h * 2, 0, s * 0.3, s * 0.8, s * 0.3 - h], true)
      .fill({ color: this.darkenColor(def.primaryColor, 0.2) });

    // Highlight
    g.circle(0, -s + h, s * 0.15)
      .fill({ color: 0xffffff, alpha: 0.4 });
  }

  private drawSphere(g: Graphics, s: number, def: MaterialVisualDefinition): void {
    // Base sphere
    g.circle(0, 0, s * 0.8)
      .fill({ color: def.primaryColor });

    // Highlight
    g.circle(-s * 0.2, -s * 0.2, s * 0.3)
      .fill({ color: this.lightenColor(def.primaryColor, 0.3) });
    g.circle(-s * 0.25, -s * 0.25, s * 0.15)
      .fill({ color: 0xffffff, alpha: 0.6 });

    // Shadow
    g.ellipse(0, s * 0.4, s * 0.5, s * 0.15)
      .fill({ color: 0x000000, alpha: 0.2 });
  }

  private drawCrystal(g: Graphics, s: number, def: MaterialVisualDefinition): void {
    // Main crystal
    const points = [
      0, -s,
      s * 0.4, -s * 0.3,
      s * 0.3, s * 0.6,
      0, s * 0.8,
      -s * 0.3, s * 0.6,
      -s * 0.4, -s * 0.3,
    ];

    g.poly(points, true)
      .fill({ color: def.primaryColor })
      .stroke({ width: 1, color: def.secondaryColor });

    // Facets
    g.moveTo(0, -s).lineTo(0, s * 0.8)
      .stroke({ width: 1, color: def.secondaryColor, alpha: 0.5 });

    // Glow at center
    g.circle(0, -s * 0.2, s * 0.2)
      .fill({ color: def.glowColor, alpha: 0.5 });
  }

  private drawVial(g: Graphics, s: number, def: MaterialVisualDefinition): void {
    // Vial body
    g.roundRect(-s * 0.3, -s * 0.2, s * 0.6, s * 1.0, s * 0.1)
      .fill({ color: 0x88ccff, alpha: 0.3 })
      .stroke({ width: 1, color: 0xaaddff });

    // Liquid
    g.roundRect(-s * 0.25, s * 0.1, s * 0.5, s * 0.6, s * 0.05)
      .fill({ color: def.primaryColor, alpha: 0.8 });

    // Cork
    g.roundRect(-s * 0.2, -s * 0.5, s * 0.4, s * 0.35, s * 0.05)
      .fill({ color: 0x8b4513 });

    // Highlight on glass
    g.rect(-s * 0.15, -s * 0.15, s * 0.08, s * 0.5)
      .fill({ color: 0xffffff, alpha: 0.3 });
  }

  private drawShard(g: Graphics, s: number, def: MaterialVisualDefinition): void {
    // Jagged shard shape
    const points = [
      0, -s,
      s * 0.5, -s * 0.3,
      s * 0.3, s * 0.2,
      s * 0.4, s * 0.7,
      -s * 0.1, s * 0.5,
      -s * 0.4, s * 0.3,
      -s * 0.3, -s * 0.4,
    ];

    g.poly(points, true)
      .fill({ color: def.primaryColor })
      .stroke({ width: 2, color: def.secondaryColor });

    // Crack lines
    g.moveTo(0, -s * 0.8).lineTo(-s * 0.1, s * 0.3)
      .stroke({ width: 1, color: def.glowColor, alpha: 0.6 });
  }

  private drawEssence(g: Graphics, s: number, def: MaterialVisualDefinition): void {
    // Floating essence orb
    g.circle(0, 0, s * 0.5)
      .fill({ color: def.primaryColor, alpha: 0.6 });

    // Inner glow
    g.circle(0, 0, s * 0.35)
      .fill({ color: def.glowColor, alpha: 0.4 });
    g.circle(0, 0, s * 0.2)
      .fill({ color: 0xffffff, alpha: 0.3 });

    // Orbiting particles (static representation)
    for (let i = 0; i < 3; i++) {
      const angle = (i * Math.PI * 2 / 3);
      const x = Math.cos(angle) * s * 0.7;
      const y = Math.sin(angle) * s * 0.7;
      g.circle(x, y, s * 0.1)
        .fill({ color: def.glowColor, alpha: 0.8 });
    }
  }

  private drawIngot(g: Graphics, s: number, def: MaterialVisualDefinition): void {
    // Trapezoidal ingot (3D perspective)
    // Top face
    g.poly([
      -s * 0.5, -s * 0.3,
      s * 0.5, -s * 0.3,
      s * 0.3, -s * 0.6,
      -s * 0.3, -s * 0.6,
    ], true).fill({ color: this.lightenColor(def.primaryColor, 0.2) });

    // Front face
    g.poly([
      -s * 0.5, -s * 0.3,
      s * 0.5, -s * 0.3,
      s * 0.5, s * 0.3,
      -s * 0.5, s * 0.3,
    ], true).fill({ color: def.primaryColor });

    // Side face
    g.poly([
      s * 0.5, -s * 0.3,
      s * 0.3, -s * 0.6,
      s * 0.3, 0,
      s * 0.5, s * 0.3,
    ], true).fill({ color: this.darkenColor(def.primaryColor, 0.2) });

    // Stamp mark
    g.circle(0, 0, s * 0.15)
      .stroke({ width: 1, color: def.secondaryColor, alpha: 0.5 });
  }

  private drawPowder(g: Graphics, s: number, def: MaterialVisualDefinition): void {
    // Pile of powder (multiple small circles)
    const positions = [
      { x: 0, y: s * 0.2, r: s * 0.4 },
      { x: -s * 0.3, y: s * 0.3, r: s * 0.3 },
      { x: s * 0.3, y: s * 0.3, r: s * 0.3 },
      { x: 0, y: -s * 0.1, r: s * 0.35 },
      { x: -s * 0.2, y: 0, r: s * 0.25 },
      { x: s * 0.2, y: 0, r: s * 0.25 },
    ];

    // Shadow
    g.ellipse(0, s * 0.4, s * 0.6, s * 0.15)
      .fill({ color: 0x000000, alpha: 0.2 });

    // Powder particles
    for (const pos of positions) {
      g.circle(pos.x, pos.y, pos.r)
        .fill({ color: def.primaryColor });
    }

    // Sparkles
    for (let i = 0; i < 5; i++) {
      const x = (Math.random() - 0.5) * s;
      const y = (Math.random() - 0.5) * s * 0.5;
      g.circle(x, y, s * 0.05)
        .fill({ color: def.glowColor, alpha: 0.8 });
    }
  }

  // Color utilities
  private lightenColor(color: number, factor: number): number {
    const r = Math.min(255, ((color >> 16) & 0xff) + 255 * factor);
    const g = Math.min(255, ((color >> 8) & 0xff) + 255 * factor);
    const b = Math.min(255, (color & 0xff) + 255 * factor);
    return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
  }

  private darkenColor(color: number, factor: number): number {
    const r = ((color >> 16) & 0xff) * (1 - factor);
    const g = ((color >> 8) & 0xff) * (1 - factor);
    const b = (color & 0xff) * (1 - factor);
    return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const materialRenderer = new MaterialRenderer();

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Creates a static material icon for UI use
 */
export function createStaticMaterialIcon(
  materialType: MaterialType,
  size: number = 32
): Container {
  const renderer = new MaterialRenderer();
  return renderer.createMaterial(
    `static_${materialType}_${Date.now()}`,
    materialType,
    { size, animated: false, showGlow: true }
  );
}

/**
 * Gets rarity color for a material
 */
export function getMaterialRarityColor(materialType: MaterialType): number {
  const def = MATERIAL_VISUALS[materialType];
  if (!def) return 0x9ca3af;
  return RARITY_GLOW_COLORS[def.rarity];
}
