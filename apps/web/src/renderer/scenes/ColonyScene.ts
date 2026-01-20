/**
 * ColonyScene - Full-screen Pixi scene for space station colony management
 *
 * A complete scene showing an isometric space station with colony buildings,
 * production flows, and interactive upgrade system.
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { ColonyStatus } from '@arcade/protocol';
import { easeOutBack, easeOutElastic } from '../animation/easing.js';

// Theme colors matching game style
const THEME = {
  background: 0x0a0a12,
  station: {
    floor: 0x1a2530,
    floorLight: 0x2a3540,
    floorAccent: 0x3a4550,
    wall: 0x15202a,
    wallAccent: 0x253545,
    glow: 0x00ccff,
  },
  ui: {
    panel: 0x0d1117,
    panelBorder: 0x30363d,
    text: 0xffffff,
    textMuted: 0x8b949e,
    gold: 0xffd700,
    success: 0x00ff9d,
  },
};

// Colony visual configurations - positioned around planet edge
const COLONY_CONFIG: Record<string, {
  name: string;
  icon: string;
  colors: { primary: number; secondary: number; glow: number; accent: number };
  angle: number; // Position angle on planet edge (degrees, 0 = right, 90 = bottom)
}> = {
  farm: {
    name: 'Farma',
    icon: '🌾',
    colors: { primary: 0x228b22, secondary: 0x32cd32, glow: 0x44ff44, accent: 0x90ee90 },
    angle: 225, // bottom-left
  },
  mine: {
    name: 'Kopalnia',
    icon: '⛏️',
    colors: { primary: 0x4a5568, secondary: 0x718096, glow: 0x63b3ed, accent: 0xa0aec0 },
    angle: 135, // top-left
  },
  market: {
    name: 'Targ',
    icon: '🏪',
    colors: { primary: 0xed8936, secondary: 0xf6ad55, glow: 0xfbd38d, accent: 0xfeebc8 },
    angle: 315, // bottom-right
  },
  factory: {
    name: 'Fabryka',
    icon: '🏭',
    colors: { primary: 0x3182ce, secondary: 0x63b3ed, glow: 0xbee3f8, accent: 0x90cdf4 },
    angle: 45, // top-right
  },
};

// Planet and building dimensions
const PLANET = {
  radius: 140, // Larger planet
  buildingSize: 36, // Icon size
};

// Gold particle for production flow
interface GoldParticle {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  progress: number;
  speed: number;
  size: number;
  alpha: number;
  controlX: number;
  controlY: number;
  sourceId: string;
}

// Building visual state
interface BuildingVisual {
  container: Container;
  baseGraphics: Graphics;
  buildingGraphics: Graphics;
  glowGraphics: Graphics;
  detailGraphics: Graphics;
  labelContainer: Container;
  colony: ColonyStatus | null;
  config: typeof COLONY_CONFIG[string];
  pulsePhase: number;
  hovered: boolean;
  selected: boolean;
  animationTime: number;
}

export class ColonyScene {
  public container: Container;

  // Callbacks
  public onBuildingClick: ((colonyId: string, colony: ColonyStatus | null) => void) | null = null;
  public onBackClick: (() => void) | null = null;

  // Layers (back to front)
  private backgroundLayer: Container;
  private stationLayer: Container;
  private buildingsLayer: Container;
  private particlesLayer: Container;
  private effectsLayer: Container;

  // State
  private buildings: Map<string, BuildingVisual> = new Map();
  private particles: GoldParticle[] = [];
  private particleGraphics: Graphics;
  private time = 0;
  private width = 0;
  private height = 0;

  // Station center and collection point
  private centerX = 0;
  private centerY = 0;
  private collectionPoint = { x: 0, y: 0 };

  // Star field
  private stars: { x: number; y: number; size: number; speed: number; alpha: number }[] = [];
  private starsGraphics: Graphics;

  // Planet graphics
  private planetGraphics: Graphics;

  constructor() {
    this.container = new Container();

    // Create layers
    this.backgroundLayer = new Container();
    this.stationLayer = new Container();
    this.buildingsLayer = new Container();
    this.particlesLayer = new Container();
    this.effectsLayer = new Container();

    this.container.addChild(this.backgroundLayer);
    this.container.addChild(this.stationLayer);
    this.container.addChild(this.buildingsLayer);
    this.container.addChild(this.particlesLayer);
    this.container.addChild(this.effectsLayer);

    // Background elements
    this.starsGraphics = new Graphics();
    this.backgroundLayer.addChild(this.starsGraphics);

    // Planet
    this.planetGraphics = new Graphics();
    this.stationLayer.addChild(this.planetGraphics);

    // Particle graphics
    this.particleGraphics = new Graphics();
    this.particlesLayer.addChild(this.particleGraphics);

    // Generate stars
    this.generateStars();

    // Create buildings immediately (they will be locked by default)
    this.initBuildings();
  }

  /**
   * Initialize buildings (creates all building visuals)
   */
  private initBuildings() {
    console.log('[ColonyScene] Initializing buildings...');
    for (const [id, config] of Object.entries(COLONY_CONFIG)) {
      if (!this.buildings.has(id)) {
        this.createBuilding(id, config);
      }
    }
    console.log('[ColonyScene] Buildings initialized:', this.buildings.size);
  }

  /**
   * Initialize/resize the scene
   */
  public onResize(width: number, height: number) {
    console.log('[ColonyScene] onResize:', width, 'x', height);
    this.width = width;
    this.height = height;
    this.centerX = width / 2;
    this.centerY = height / 2 + 20;

    // Collection point at center of planet
    this.collectionPoint = {
      x: this.centerX,
      y: this.centerY,
    };

    // Redraw static elements
    this.drawBackground();
    this.drawPlanet();

    // Reposition buildings around planet
    this.repositionBuildings();

    // Draw buildings (they may have been created before resize)
    for (const [, visual] of this.buildings) {
      this.drawBuilding(visual);
    }
  }

  /**
   * Generate star field
   */
  private generateStars() {
    this.stars = [];
    const count = 150;

    for (let i = 0; i < count; i++) {
      this.stars.push({
        x: Math.random(),
        y: Math.random(),
        size: 0.5 + Math.random() * 2,
        speed: 0.0001 + Math.random() * 0.0003,
        alpha: 0.3 + Math.random() * 0.7,
      });
    }
  }

  /**
   * Draw background (space)
   */
  private drawBackground() {
    const g = this.starsGraphics;
    g.clear();

    // Deep space background
    g.rect(0, 0, this.width, this.height)
      .fill({ color: THEME.background });

    // Nebula effect (subtle gradient)
    const nebulaSize = Math.max(this.width, this.height) * 0.4;
    g.circle(this.width * 0.2, this.height * 0.3, nebulaSize)
      .fill({ color: 0x1a0a2e, alpha: 0.3 });
    g.circle(this.width * 0.8, this.height * 0.7, nebulaSize * 0.7)
      .fill({ color: 0x0a1a2e, alpha: 0.2 });
  }

  /**
   * Draw twinkling stars
   */
  private drawStars() {
    const g = this.starsGraphics;

    // Clear and redraw background
    this.drawBackground();

    // Draw stars with twinkling
    for (const star of this.stars) {
      const x = star.x * this.width;
      const y = star.y * this.height;
      const twinkle = star.alpha * (0.7 + Math.sin(this.time * 3 + star.x * 100) * 0.3);

      g.circle(x, y, star.size)
        .fill({ color: 0xffffff, alpha: twinkle });
    }
  }

  /**
   * Draw the planet - simple clean sphere
   */
  private drawPlanet() {
    const g = this.planetGraphics;
    g.clear();

    const r = PLANET.radius;
    const cx = this.centerX;
    const cy = this.centerY;

    // Outer glow
    g.circle(cx, cy, r + 15)
      .fill({ color: 0x3a6090, alpha: 0.1 });
    g.circle(cx, cy, r + 8)
      .fill({ color: 0x4a80b0, alpha: 0.15 });

    // Planet base - blue-green color
    g.circle(cx, cy, r)
      .fill({ color: 0x2a4a6a });

    // 3D shading - darker on bottom right
    g.circle(cx + r * 0.2, cy + r * 0.2, r * 0.9)
      .fill({ color: 0x1a3050, alpha: 0.4 });

    // Highlight on top left
    g.circle(cx - r * 0.3, cy - r * 0.3, r * 0.6)
      .fill({ color: 0x4a7090, alpha: 0.3 });
    g.circle(cx - r * 0.35, cy - r * 0.35, r * 0.3)
      .fill({ color: 0x6090b0, alpha: 0.25 });

    // Surface features - continents
    g.circle(cx - r * 0.2, cy - r * 0.1, r * 0.35)
      .fill({ color: 0x3a6050, alpha: 0.5 });
    g.circle(cx + r * 0.3, cy + r * 0.2, r * 0.25)
      .fill({ color: 0x3a5a48, alpha: 0.4 });
    g.circle(cx - r * 0.1, cy + r * 0.35, r * 0.2)
      .fill({ color: 0x406050, alpha: 0.35 });

    // Clouds/atmosphere wisps
    g.circle(cx + r * 0.1, cy - r * 0.4, r * 0.15)
      .fill({ color: 0xffffff, alpha: 0.1 });
    g.circle(cx - r * 0.3, cy + r * 0.1, r * 0.12)
      .fill({ color: 0xffffff, alpha: 0.08 });

    // Bright highlight (sun reflection)
    g.circle(cx - r * 0.5, cy - r * 0.45, r * 0.12)
      .fill({ color: 0xffffff, alpha: 0.3 });
    g.circle(cx - r * 0.55, cy - r * 0.5, r * 0.06)
      .fill({ color: 0xffffff, alpha: 0.5 });

    // Atmosphere edge glow
    g.circle(cx, cy, r)
      .stroke({ width: 2, color: 0x80c0ff, alpha: 0.3 });
  }

  /**
   * Get position ON the planet surface for a given angle (buildings sit on edge)
   */
  private getPositionOnPlanet(angleDeg: number): { x: number; y: number; scale: number } {
    const angleRad = angleDeg * Math.PI / 180;
    const r = PLANET.radius;

    // Position buildings at 85% of radius (slightly inside edge, visually on surface)
    const surfaceOffset = r * 0.82;
    const x = this.centerX + Math.cos(angleRad) * surfaceOffset;
    const y = this.centerY + Math.sin(angleRad) * surfaceOffset;

    return { x, y, scale: 1 };
  }

  /**
   * Set colonies to display
   */
  public setColonies(colonies: ColonyStatus[]) {
    console.log('[ColonyScene] setColonies called with:', colonies.length, 'colonies');

    // Create buildings for all colony types
    for (const [id, config] of Object.entries(COLONY_CONFIG)) {
      if (!this.buildings.has(id)) {
        console.log('[ColonyScene] Creating building:', id);
        this.createBuilding(id, config);
      }
    }

    // Update building states
    for (const colony of colonies) {
      const visual = this.buildings.get(colony.id);
      if (visual) {
        console.log('[ColonyScene] Updating building:', colony.id, 'unlocked:', colony.unlocked);
        visual.colony = colony;
        this.updateBuildingVisual(visual);
      }
    }

    // Reposition after creating
    this.repositionBuildings();
    this.sortBuildingsByDepth();

    console.log('[ColonyScene] Buildings created:', this.buildings.size);
  }

  /**
   * Create a building visual
   */
  private createBuilding(id: string, config: typeof COLONY_CONFIG[string]) {
    const container = new Container();
    container.eventMode = 'static';
    container.cursor = 'pointer';

    // Graphics layers
    const baseGraphics = new Graphics();
    const glowGraphics = new Graphics();
    const buildingGraphics = new Graphics();
    const detailGraphics = new Graphics();
    const labelContainer = new Container();

    container.addChild(glowGraphics);
    container.addChild(baseGraphics);
    container.addChild(buildingGraphics);
    container.addChild(detailGraphics);
    container.addChild(labelContainer);

    const visual: BuildingVisual = {
      container,
      baseGraphics,
      buildingGraphics,
      glowGraphics,
      detailGraphics,
      labelContainer,
      colony: null,
      config,
      pulsePhase: Math.random() * Math.PI * 2,
      hovered: false,
      selected: false,
      animationTime: 0,
    };

    // Events
    container.on('pointerover', () => {
      visual.hovered = true;
    });

    container.on('pointerout', () => {
      visual.hovered = false;
    });

    container.on('pointertap', () => {
      // Deselect others
      for (const [, v] of this.buildings) {
        v.selected = false;
      }
      visual.selected = true;
      this.onBuildingClick?.(id, visual.colony);
    });

    this.buildings.set(id, visual);
    this.buildingsLayer.addChild(container);

    // Initial draw
    this.drawBuilding(visual);
  }

  /**
   * Reposition all buildings around the planet
   */
  private repositionBuildings() {
    for (const [, visual] of this.buildings) {
      const pos = this.getPositionOnPlanet(visual.config.angle);
      visual.container.x = pos.x;
      visual.container.y = pos.y;
      visual.container.scale.set(pos.scale);
    }
    this.sortBuildingsByDepth();
  }

  /**
   * Draw a building with distinctive shape and platform base
   */
  private drawBuilding(visual: BuildingVisual) {
    const { baseGraphics: base, buildingGraphics: building, glowGraphics: glow, detailGraphics: detail, config, colony } = visual;
    const colors = config.colors;
    const unlocked = colony?.unlocked ?? false;
    const level = colony?.level ?? 0;
    const colonyId = colony?.id ?? '';

    base.clear();
    building.clear();
    glow.clear();
    detail.clear();

    const baseSize = PLANET.buildingSize;
    const size = baseSize + (unlocked ? level * 2 : 0);

    // Colors based on state
    const primaryColor = unlocked ? colors.primary : 0x2a2a35;
    const secondaryColor = unlocked ? colors.secondary : 0x3a3a45;
    const glowColor = unlocked ? colors.glow : 0x444455;

    // === GLOW EFFECT ===
    if (visual.hovered || visual.selected) {
      const intensity = visual.selected ? 0.5 : 0.3;
      glow.circle(0, -size * 0.3, size * 1.2)
        .fill({ color: glowColor, alpha: intensity });
    } else if (unlocked) {
      const pulse = 0.15 + Math.sin(visual.pulsePhase + this.time * 1.5) * 0.08;
      glow.circle(0, -size * 0.3, size)
        .fill({ color: glowColor, alpha: pulse });
    }

    // === PLATFORM BASE ===
    // Circular platform the building sits on
    base.ellipse(0, size * 0.1, size * 0.7, size * 0.25)
      .fill({ color: 0x1a1a25 })
      .stroke({ width: 2, color: unlocked ? colors.glow : 0x444455, alpha: 0.5 });

    // === BUILDING SHAPE (unique per type) ===
    if (colonyId === 'farm') {
      this.drawFarmBuilding(building, size, primaryColor, secondaryColor, glowColor, unlocked, level);
    } else if (colonyId === 'mine') {
      this.drawMineBuilding(building, size, primaryColor, secondaryColor, glowColor, unlocked, level);
    } else if (colonyId === 'market') {
      this.drawMarketBuilding(building, size, primaryColor, secondaryColor, glowColor, unlocked, level);
    } else if (colonyId === 'factory') {
      this.drawFactoryBuilding(building, size, primaryColor, secondaryColor, glowColor, unlocked, level);
    } else {
      // Default hexagon
      this.drawDefaultBuilding(building, size, primaryColor, glowColor, unlocked);
    }

    // === LOCK OVERLAY for locked buildings ===
    if (!unlocked) {
      this.drawSmallLock(detail, 0, -size * 0.3);
    }

    // Update labels
    this.updateBuildingLabels(visual);
  }

  /**
   * Farm - Bio-dome with glass panels
   */
  private drawFarmBuilding(g: Graphics, size: number, primary: number, _secondary: number, glow: number, unlocked: boolean, level: number) {
    const h = size * 0.8;
    const w = size * 0.6;

    // Dome shape
    g.moveTo(-w, 0)
      .bezierCurveTo(-w, -h * 0.7, w, -h * 0.7, w, 0)
      .closePath()
      .fill({ color: primary });

    // Glass segments
    if (unlocked) {
      const pulse = 0.5 + Math.sin(this.time * 2) * 0.2;
      g.moveTo(-w * 0.5, -h * 0.1)
        .bezierCurveTo(-w * 0.5, -h * 0.5, 0, -h * 0.6, 0, -h * 0.1)
        .closePath()
        .fill({ color: glow, alpha: pulse * 0.4 });
      g.moveTo(0, -h * 0.1)
        .bezierCurveTo(0, -h * 0.6, w * 0.5, -h * 0.5, w * 0.5, -h * 0.1)
        .closePath()
        .fill({ color: glow, alpha: pulse * 0.3 });
    }

    // Border
    g.moveTo(-w, 0)
      .bezierCurveTo(-w, -h * 0.7, w, -h * 0.7, w, 0)
      .stroke({ width: 2, color: glow, alpha: 0.6 });

    // Level indicators
    for (let i = 0; i < Math.min(level, 5); i++) {
      g.circle(-w * 0.4 + i * w * 0.2, -h * 0.15, 3)
        .fill({ color: glow, alpha: 0.8 });
    }
  }

  /**
   * Mine - Tower with drilling equipment
   */
  private drawMineBuilding(g: Graphics, size: number, primary: number, secondary: number, glow: number, unlocked: boolean, level: number) {
    const h = size;
    const w = size * 0.4;

    // Main tower
    g.rect(-w, -h, w * 2, h)
      .fill({ color: primary });

    // Tower top (pyramid)
    g.moveTo(-w * 1.2, -h)
      .lineTo(0, -h * 1.4)
      .lineTo(w * 1.2, -h)
      .closePath()
      .fill({ color: secondary });

    // Drill frame
    g.moveTo(-w * 0.8, 0)
      .lineTo(0, -h * 0.3)
      .lineTo(w * 0.8, 0)
      .stroke({ width: 3, color: glow, alpha: 0.5 });

    if (unlocked) {
      // Animated window lights
      const pulse = 0.5 + Math.sin(this.time * 3) * 0.3;
      for (let i = 0; i < Math.min(level + 1, 4); i++) {
        g.rect(-w * 0.5, -h * 0.9 + i * h * 0.2, w, h * 0.12)
          .fill({ color: glow, alpha: pulse });
      }
    }

    // Border
    g.rect(-w, -h, w * 2, h)
      .stroke({ width: 2, color: glow, alpha: 0.6 });
  }

  /**
   * Market - Open platform with canopy
   */
  private drawMarketBuilding(g: Graphics, size: number, primary: number, secondary: number, glow: number, unlocked: boolean, level: number) {
    const h = size * 0.7;
    const w = size * 0.8;

    // Platform base
    g.rect(-w, -h * 0.3, w * 2, h * 0.3)
      .fill({ color: primary });

    // Canopy roof
    g.moveTo(-w * 1.1, -h * 0.3)
      .lineTo(-w * 0.8, -h)
      .lineTo(w * 0.8, -h)
      .lineTo(w * 1.1, -h * 0.3)
      .closePath()
      .fill({ color: secondary });

    // Support poles
    g.rect(-w * 0.7, -h, 4, h * 0.7)
      .fill({ color: glow, alpha: 0.5 });
    g.rect(w * 0.7 - 4, -h, 4, h * 0.7)
      .fill({ color: glow, alpha: 0.5 });

    if (unlocked) {
      // Stall lights
      const pulse = 0.6 + Math.sin(this.time * 2.5) * 0.2;
      for (let i = 0; i < Math.min(level + 1, 3); i++) {
        const x = -w * 0.5 + i * w * 0.5;
        g.circle(x, -h * 0.5, 5)
          .fill({ color: glow, alpha: pulse });
      }
    }

    // Border
    g.moveTo(-w * 1.1, -h * 0.3)
      .lineTo(-w * 0.8, -h)
      .lineTo(w * 0.8, -h)
      .lineTo(w * 1.1, -h * 0.3)
      .stroke({ width: 2, color: glow, alpha: 0.6 });
  }

  /**
   * Factory - Industrial complex with chimneys
   */
  private drawFactoryBuilding(g: Graphics, size: number, primary: number, secondary: number, glow: number, unlocked: boolean, level: number) {
    const h = size * 0.8;
    const w = size * 0.7;

    // Main building
    g.rect(-w, -h * 0.6, w * 2, h * 0.6)
      .fill({ color: primary });

    // Saw-tooth roof
    const segments = 3;
    for (let i = 0; i < segments; i++) {
      const x = -w + (i * w * 2) / segments;
      const segW = (w * 2) / segments;
      g.moveTo(x, -h * 0.6)
        .lineTo(x + segW * 0.3, -h)
        .lineTo(x + segW, -h * 0.6)
        .closePath()
        .fill({ color: secondary });
    }

    // Chimney
    g.rect(w * 0.5, -h * 1.2, w * 0.25, h * 0.5)
      .fill({ color: 0x3a3a45 });

    if (unlocked) {
      // Smoke animation
      const smokePhase = this.time * 2;
      for (let i = 0; i < 3; i++) {
        const y = -h * 1.3 - i * 8 - (smokePhase % 20);
        const alpha = 0.3 - i * 0.1;
        if (alpha > 0) {
          g.circle(w * 0.625, y, 4 + i * 2)
            .fill({ color: 0x888888, alpha });
        }
      }

      // Window lights
      const pulse = 0.5 + Math.sin(this.time * 2) * 0.2;
      for (let i = 0; i < Math.min(level + 1, 4); i++) {
        g.rect(-w * 0.7 + i * w * 0.4, -h * 0.4, w * 0.25, h * 0.2)
          .fill({ color: glow, alpha: pulse });
      }
    }

    // Border
    g.rect(-w, -h * 0.6, w * 2, h * 0.6)
      .stroke({ width: 2, color: glow, alpha: 0.6 });
  }

  /**
   * Default building (fallback)
   */
  private drawDefaultBuilding(g: Graphics, size: number, primary: number, glow: number, unlocked: boolean) {
    // Simple rounded rect
    g.roundRect(-size * 0.5, -size * 0.7, size, size * 0.7, 4)
      .fill({ color: primary })
      .stroke({ width: 2, color: glow, alpha: 0.6 });

    if (unlocked) {
      g.circle(0, -size * 0.35, size * 0.2)
        .fill({ color: glow, alpha: 0.5 });
    }
  }

  /**
   * Draw small lock icon for locked buildings
   */
  private drawSmallLock(g: Graphics, x: number, y: number) {
    const pulse = 0.6 + Math.sin(this.time * 2) * 0.2;

    // Lock body
    g.roundRect(x - 8, y - 2, 16, 14, 2)
      .fill({ color: 0x4a5568, alpha: pulse * 0.8 })
      .stroke({ width: 1, color: 0x6b7280, alpha: pulse });

    // Shackle
    g.moveTo(x - 5, y - 2)
      .lineTo(x - 5, y - 10)
      .bezierCurveTo(x - 5, y - 16, x + 5, y - 16, x + 5, y - 10)
      .lineTo(x + 5, y - 2)
      .stroke({ width: 2, color: 0x6b7280, alpha: pulse });
  }

  /**
   * Update building labels
   */
  private updateBuildingLabels(visual: BuildingVisual) {
    const { labelContainer, colony, config } = visual;
    labelContainer.removeChildren();

    const level = colony?.level ?? 0;
    const baseSize = PLANET.buildingSize + (colony?.unlocked ? level * 2 : 0);
    const labelY = baseSize * 0.4; // Below the building

    const nameStyle = new TextStyle({
      fontFamily: 'monospace',
      fontSize: 14,
      fontWeight: 'bold',
      fill: colony?.unlocked ? 0xffffff : 0x666666,
      dropShadow: {
        color: 0x000000,
        blur: 4,
        distance: 1,
        alpha: 0.8,
      },
    });

    const infoStyle = new TextStyle({
      fontFamily: 'monospace',
      fontSize: 11,
      fontWeight: 'bold',
      fill: colony?.unlocked ? config.colors.glow : 0x555555,
      dropShadow: {
        color: 0x000000,
        blur: 3,
        distance: 1,
        alpha: 0.7,
      },
    });

    const goldStyle = new TextStyle({
      fontFamily: 'monospace',
      fontSize: 13,
      fontWeight: 'bold',
      fill: THEME.ui.gold,
      dropShadow: {
        color: 0x000000,
        blur: 4,
        distance: 1,
        alpha: 0.8,
      },
    });

    // Name
    const nameText = new Text({
      text: config.name.toUpperCase(),
      style: nameStyle,
    });
    nameText.anchor.set(0.5, 0);
    nameText.y = labelY;
    labelContainer.addChild(nameText);

    if (colony?.unlocked) {
      // Level and production
      const levelText = new Text({
        text: `Lv.${colony.level} • ${colony.goldPerHour} 🪙/h`,
        style: infoStyle,
      });
      levelText.anchor.set(0.5, 0);
      levelText.y = labelY + 16;
      labelContainer.addChild(levelText);

      // Pending gold (more prominent)
      if (colony.pendingGold > 0) {
        const pendingText = new Text({
          text: `+${colony.pendingGold} 🪙`,
          style: goldStyle,
        });
        pendingText.anchor.set(0.5, 0);
        pendingText.y = labelY + 32;
        labelContainer.addChild(pendingText);
      }
    } else if (colony) {
      // Unlock requirement
      const unlockText = new Text({
        text: `Lv.${colony.unlockLevel} wymagany`,
        style: infoStyle,
      });
      unlockText.anchor.set(0.5, 0);
      unlockText.y = PLANET.buildingSize * 0.5 + 14;
      labelContainer.addChild(unlockText);
    }
  }

  /**
   * Update building visual state
   */
  private updateBuildingVisual(visual: BuildingVisual) {
    this.drawBuilding(visual);
  }

  /**
   * Sort buildings by depth (based on angle - lower Y should render first)
   */
  private sortBuildingsByDepth() {
    const children = [...this.buildingsLayer.children] as Container[];
    children.sort((a, b) => a.y - b.y);
    // Re-add in sorted order
    for (const child of children) {
      this.buildingsLayer.addChild(child);
    }
  }

  /**
   * Spawn production particles
   */
  private spawnProductionParticles() {
    for (const [id, visual] of this.buildings) {
      if (!visual.colony?.unlocked || visual.colony.goldPerHour <= 0) continue;

      // Spawn rate based on production
      const spawnChance = Math.min(visual.colony.goldPerHour / 30, 1) * 0.015;

      if (Math.random() < spawnChance) {
        const startX = visual.container.x;
        const startY = visual.container.y - PLANET.buildingSize * 0.6;

        // Control point for arc
        const midX = (startX + this.collectionPoint.x) / 2;
        const midY = Math.min(startY, this.collectionPoint.y) - 60 - Math.random() * 40;

        this.particles.push({
          x: startX,
          y: startY,
          targetX: this.collectionPoint.x,
          targetY: this.collectionPoint.y,
          progress: 0,
          speed: 0.006 + Math.random() * 0.003,
          size: 4 + Math.random() * 3,
          alpha: 0.9,
          controlX: midX + (Math.random() - 0.5) * 60,
          controlY: midY,
          sourceId: id,
        });
      }
    }
  }

  /**
   * Update and draw particles
   */
  private updateParticles() {
    const g = this.particleGraphics;
    g.clear();

    this.spawnProductionParticles();

    // Max particles
    if (this.particles.length > 100) {
      this.particles.splice(0, this.particles.length - 100);
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.progress += p.speed;

      if (p.progress >= 1) {
        this.particles.splice(i, 1);
        continue;
      }

      // Quadratic bezier
      const t = p.progress;
      const invT = 1 - t;

      const x = invT * invT * p.x + 2 * invT * t * p.controlX + t * t * p.targetX;
      const y = invT * invT * p.y + 2 * invT * t * p.controlY + t * t * p.targetY;

      // Fade at end
      const alpha = p.progress > 0.8 ? p.alpha * (1 - (p.progress - 0.8) / 0.2) : p.alpha;

      // Draw particle
      g.circle(x, y, p.size)
        .fill({ color: 0xffd700, alpha });
      g.circle(x, y, p.size * 0.5)
        .fill({ color: 0xffec8b, alpha: alpha * 0.7 });
    }

    // Collection point glow based on particles
    const activeParticles = this.particles.length;
    if (activeParticles > 0) {
      const intensity = Math.min(activeParticles / 20, 1);
      g.circle(this.collectionPoint.x, this.collectionPoint.y, 25 + intensity * 10)
        .fill({ color: 0xffd700, alpha: 0.15 * intensity });
    }
  }

  /**
   * Play claim animation
   */
  public async playClaimAnimation(): Promise<void> {
    return new Promise((resolve) => {
      // Accelerate particles
      for (const p of this.particles) {
        p.speed = 0.04;
      }

      // Flash at collection
      setTimeout(() => {
        const flash = new Graphics();
        this.effectsLayer.addChild(flash);

        let size = 10;
        let alpha = 1;

        const animate = () => {
          flash.clear();
          size += 8;
          alpha -= 0.04;

          if (alpha > 0) {
            flash.circle(this.collectionPoint.x, this.collectionPoint.y, size)
              .fill({ color: 0xffd700, alpha });
            flash.circle(this.collectionPoint.x, this.collectionPoint.y, size * 0.6)
              .fill({ color: 0xffffff, alpha: alpha * 0.5 });
            requestAnimationFrame(animate);
          } else {
            flash.destroy();
            resolve();
          }
        };

        animate();
      }, 300);
    });
  }

  /**
   * Play upgrade animation
   */
  public playUpgradeAnimation(colonyId: string) {
    const visual = this.buildings.get(colonyId);
    if (!visual) return;

    // Bounce animation
    const container = visual.container;
    const startScale = 1;
    const targetScale = 1.15;
    const duration = 400;
    const startTime = performance.now();

    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      let scale: number;
      if (progress < 0.4) {
        const t = progress / 0.4;
        scale = startScale + (targetScale - startScale) * easeOutBack(t);
      } else {
        const t = (progress - 0.4) / 0.6;
        scale = targetScale + (startScale - targetScale) * easeOutElastic(t);
      }

      container.scale.set(scale);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        container.scale.set(1);
        // Redraw with new level
        this.drawBuilding(visual);
      }
    };

    animate();

    // Particle burst
    const pos = { x: container.x, y: container.y - PLANET.buildingSize * 0.5 };
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const dist = 40 + Math.random() * 30;

      this.particles.push({
        x: pos.x,
        y: pos.y,
        targetX: pos.x + Math.cos(angle) * dist,
        targetY: pos.y + Math.sin(angle) * dist * 0.5,
        progress: 0,
        speed: 0.025,
        size: 5,
        alpha: 1,
        controlX: pos.x + Math.cos(angle) * dist * 0.5,
        controlY: pos.y - 30,
        sourceId: colonyId,
      });
    }
  }

  /**
   * Deselect all buildings
   */
  public deselectAll() {
    for (const [, visual] of this.buildings) {
      visual.selected = false;
    }
  }

  /**
   * Update scene
   */
  public update(deltaMS: number) {
    this.time += deltaMS / 1000;

    // Update stars
    this.drawStars();

    // Update reactor glow
    this.drawPlanet();

    // Update buildings
    for (const [, visual] of this.buildings) {
      visual.pulsePhase += deltaMS / 1000;
      visual.animationTime += deltaMS / 1000;

      // Hover/select scale
      const targetScale = visual.selected ? 1.08 : (visual.hovered ? 1.04 : 1);
      const currentScale = visual.container.scale.x;
      const newScale = currentScale + (targetScale - currentScale) * 0.15;
      visual.container.scale.set(newScale);

      // Redraw for animations
      this.drawBuilding(visual);
    }

    // Update particles
    this.updateParticles();
  }

  /**
   * Destroy scene
   */
  public destroy() {
    this.buildings.clear();
    this.particles = [];
    this.container.destroy({ children: true });
  }
}
