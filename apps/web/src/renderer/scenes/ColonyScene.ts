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

// Colony visual configurations
const COLONY_CONFIG: Record<string, {
  name: string;
  icon: string;
  colors: { primary: number; secondary: number; glow: number; accent: number };
  gridPos: { x: number; y: number };
}> = {
  farm: {
    name: 'Farma',
    icon: '🌾',
    colors: { primary: 0x228b22, secondary: 0x32cd32, glow: 0x44ff44, accent: 0x90ee90 },
    gridPos: { x: 1, y: 2 },
  },
  mine: {
    name: 'Kopalnia',
    icon: '⛏️',
    colors: { primary: 0x4a5568, secondary: 0x718096, glow: 0x63b3ed, accent: 0xa0aec0 },
    gridPos: { x: 0, y: 1 },
  },
  market: {
    name: 'Targ',
    icon: '🏪',
    colors: { primary: 0xed8936, secondary: 0xf6ad55, glow: 0xfbd38d, accent: 0xfeebc8 },
    gridPos: { x: 2, y: 1 },
  },
  factory: {
    name: 'Fabryka',
    icon: '🏭',
    colors: { primary: 0x3182ce, secondary: 0x63b3ed, glow: 0xbee3f8, accent: 0x90cdf4 },
    gridPos: { x: 1, y: 0 },
  },
};

// Isometric tile dimensions
const ISO = {
  tileWidth: 140,
  tileHeight: 70,
  buildingHeight: 100,
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

  // Station floor graphics
  private floorGraphics: Graphics;

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

    // Station floor
    this.floorGraphics = new Graphics();
    this.stationLayer.addChild(this.floorGraphics);

    // Particle graphics
    this.particleGraphics = new Graphics();
    this.particlesLayer.addChild(this.particleGraphics);

    // Generate stars
    this.generateStars();
  }

  /**
   * Initialize/resize the scene
   */
  public onResize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.centerX = width / 2;
    this.centerY = height / 2 + 30;

    // Collection point at center of station
    this.collectionPoint = {
      x: this.centerX,
      y: this.centerY + 20,
    };

    // Redraw static elements
    this.drawBackground();
    this.drawStationFloor();

    // Reposition buildings
    this.repositionBuildings();
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
   * Draw the station floor (isometric platform)
   */
  private drawStationFloor() {
    const g = this.floorGraphics;
    g.clear();

    const tileW = ISO.tileWidth;
    const tileH = ISO.tileHeight;

    // Draw a 5x5 isometric floor grid
    const gridSize = 5;
    const halfGrid = Math.floor(gridSize / 2);

    for (let gy = -halfGrid; gy <= halfGrid; gy++) {
      for (let gx = -halfGrid; gx <= halfGrid; gx++) {
        const { x, y } = this.gridToScreen(gx, gy);

        // Distance from center for lighting
        const dist = Math.sqrt(gx * gx + gy * gy);
        const brightness = Math.max(0.4, 1 - dist * 0.15);

        // Tile color based on position
        const isAccent = (gx + gy) % 2 === 0;
        const baseColor = isAccent ? THEME.station.floor : THEME.station.floorLight;

        // Draw isometric tile
        g.moveTo(x, y - tileH / 2)  // top
          .lineTo(x + tileW / 2, y)  // right
          .lineTo(x, y + tileH / 2)  // bottom
          .lineTo(x - tileW / 2, y)  // left
          .closePath()
          .fill({ color: baseColor, alpha: brightness });

        // Tile border
        g.moveTo(x, y - tileH / 2)
          .lineTo(x + tileW / 2, y)
          .lineTo(x, y + tileH / 2)
          .lineTo(x - tileW / 2, y)
          .closePath()
          .stroke({ width: 1, color: THEME.station.floorAccent, alpha: 0.3 });
      }
    }

    // Station edge glow
    const platformWidth = tileW * gridSize * 0.7;
    const platformHeight = tileH * gridSize * 0.7;

    g.ellipse(this.centerX, this.centerY, platformWidth, platformHeight)
      .stroke({ width: 2, color: THEME.station.glow, alpha: 0.2 });
    g.ellipse(this.centerX, this.centerY, platformWidth + 10, platformHeight + 5)
      .stroke({ width: 1, color: THEME.station.glow, alpha: 0.1 });

    // Central reactor/collection point
    this.drawReactor(g, this.centerX, this.centerY + 10);
  }

  /**
   * Draw central reactor (collection point)
   */
  private drawReactor(g: Graphics, x: number, y: number) {
    const pulse = 0.7 + Math.sin(this.time * 2) * 0.3;

    // Base platform
    g.ellipse(x, y, 40, 20)
      .fill({ color: THEME.station.wall })
      .stroke({ width: 2, color: THEME.station.glow, alpha: 0.5 });

    // Core glow
    g.ellipse(x, y - 5, 25 * pulse, 12 * pulse)
      .fill({ color: THEME.station.glow, alpha: 0.2 * pulse });

    // Core
    g.ellipse(x, y - 5, 15, 8)
      .fill({ color: THEME.station.glow, alpha: 0.6 })
      .stroke({ width: 1, color: 0xffffff, alpha: 0.3 });

    // Central bright point
    g.circle(x, y - 5, 5)
      .fill({ color: 0xffffff, alpha: 0.8 });
  }

  /**
   * Convert grid coordinates to screen position
   */
  private gridToScreen(gx: number, gy: number): { x: number; y: number } {
    const isoX = (gx - gy) * (ISO.tileWidth / 2);
    const isoY = (gx + gy) * (ISO.tileHeight / 2);

    return {
      x: this.centerX + isoX,
      y: this.centerY + isoY - 40,
    };
  }

  /**
   * Set colonies to display
   */
  public setColonies(colonies: ColonyStatus[]) {
    // Create buildings for all colony types
    for (const [id, config] of Object.entries(COLONY_CONFIG)) {
      if (!this.buildings.has(id)) {
        this.createBuilding(id, config);
      }
    }

    // Update building states
    for (const colony of colonies) {
      const visual = this.buildings.get(colony.id);
      if (visual) {
        visual.colony = colony;
        this.updateBuildingVisual(visual);
      }
    }

    this.sortBuildingsByDepth();
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
   * Reposition all buildings after resize
   */
  private repositionBuildings() {
    for (const [, visual] of this.buildings) {
      const pos = this.gridToScreen(visual.config.gridPos.x - 1, visual.config.gridPos.y - 1);
      visual.container.x = pos.x;
      visual.container.y = pos.y;
    }
  }

  /**
   * Draw a building
   */
  private drawBuilding(visual: BuildingVisual) {
    const { baseGraphics: base, buildingGraphics: building, glowGraphics: glow, detailGraphics: detail, config, colony } = visual;
    const colors = config.colors;
    const unlocked = colony?.unlocked ?? false;
    const level = colony?.level ?? 0;

    base.clear();
    building.clear();
    glow.clear();
    detail.clear();

    // Dimensions
    const w = ISO.tileWidth * 0.7;
    const h = ISO.tileHeight * 0.7;
    const buildH = ISO.buildingHeight * (unlocked ? 0.8 + level * 0.02 : 0.5);

    // Colors (dimmed if locked)
    const primaryColor = unlocked ? colors.primary : 0x2a2a2a;
    const secondaryColor = unlocked ? colors.secondary : 0x3a3a3a;
    const glowColor = unlocked ? colors.glow : 0x444444;

    // Glow effect
    if (unlocked && (visual.hovered || visual.selected)) {
      const glowIntensity = visual.selected ? 0.4 : 0.25;
      glow.ellipse(0, h * 0.3, w * 0.7, h * 0.5)
        .fill({ color: glowColor, alpha: glowIntensity });
    }

    // Production glow (pulsing)
    if (unlocked && colony && colony.goldPerHour > 0) {
      const pulse = 0.1 + Math.sin(visual.pulsePhase + this.time * 1.5) * 0.08;
      glow.ellipse(0, h * 0.2, w * 0.5, h * 0.35)
        .fill({ color: glowColor, alpha: pulse });
    }

    // Base platform (isometric)
    base.moveTo(0, 0)
      .lineTo(w / 2, h / 2)
      .lineTo(0, h)
      .lineTo(-w / 2, h / 2)
      .closePath()
      .fill({ color: THEME.station.wall })
      .stroke({ width: 1, color: THEME.station.wallAccent });

    // Building body - left wall
    building.moveTo(-w / 2, h / 2)
      .lineTo(-w / 2, h / 2 - buildH)
      .lineTo(0, -buildH)
      .lineTo(0, 0)
      .closePath()
      .fill({ color: primaryColor, alpha: 0.85 });

    // Building body - right wall
    building.moveTo(w / 2, h / 2)
      .lineTo(w / 2, h / 2 - buildH)
      .lineTo(0, -buildH)
      .lineTo(0, 0)
      .closePath()
      .fill({ color: primaryColor });

    // Roof
    building.moveTo(0, -buildH)
      .lineTo(w / 2, h / 2 - buildH)
      .lineTo(0, h - buildH)
      .lineTo(-w / 2, h / 2 - buildH)
      .closePath()
      .fill({ color: secondaryColor })
      .stroke({ width: 1, color: glowColor, alpha: unlocked ? 0.5 : 0.2 });

    // Type-specific details
    if (unlocked) {
      this.drawBuildingDetails(detail, config.name.toLowerCase(), colors, w, h, buildH);
    } else {
      // Lock icon
      this.drawLockIcon(detail, 0, -buildH / 2);
    }

    // Update labels
    this.updateBuildingLabels(visual);
  }

  /**
   * Draw building-specific details
   */
  private drawBuildingDetails(
    g: Graphics,
    type: string,
    colors: { primary: number; secondary: number; glow: number; accent: number },
    w: number,
    _h: number,
    buildH: number
  ) {
    switch (type) {
      case 'farma':
        // Bio-dome on roof
        g.ellipse(0, -buildH - 10, w * 0.25, 15)
          .fill({ color: colors.glow, alpha: 0.4 })
          .stroke({ width: 1, color: colors.accent, alpha: 0.6 });
        // Plants
        g.circle(-8, -buildH + 15, 4).fill({ color: 0x228b22, alpha: 0.8 });
        g.circle(8, -buildH + 12, 5).fill({ color: 0x32cd32, alpha: 0.8 });
        g.circle(0, -buildH + 18, 3).fill({ color: 0x44ff44, alpha: 0.6 });
        break;

      case 'kopalnia':
        // Mining elevator
        g.rect(-5, -buildH - 30, 10, 35)
          .fill({ color: 0x2d3748 })
          .stroke({ width: 1, color: colors.glow, alpha: 0.4 });
        // Wheel
        g.circle(0, -buildH - 32, 8)
          .stroke({ width: 2, color: colors.secondary });
        // Cable
        g.moveTo(0, -buildH - 24)
          .lineTo(0, -buildH + 10)
          .stroke({ width: 1, color: colors.accent, alpha: 0.5 });
        break;

      case 'targ':
        // Satellite dish
        g.ellipse(0, -buildH - 15, 15, 8)
          .stroke({ width: 2, color: colors.secondary });
        g.moveTo(0, -buildH - 15)
          .lineTo(0, -buildH)
          .stroke({ width: 2, color: colors.accent });
        // Signal waves
        const wavePhase = Math.sin(this.time * 3);
        g.circle(0, -buildH - 18, 8 + wavePhase * 2)
          .stroke({ width: 1, color: colors.glow, alpha: 0.3 });
        g.circle(0, -buildH - 18, 14 + wavePhase * 3)
          .stroke({ width: 1, color: colors.glow, alpha: 0.15 });
        break;

      case 'fabryka':
        // Chimney
        g.rect(10, -buildH - 35, 12, 40)
          .fill({ color: 0x2d3748 })
          .stroke({ width: 1, color: colors.glow, alpha: 0.3 });
        // Smoke
        const smokeOffset = Math.sin(this.time * 2) * 3;
        g.circle(16, -buildH - 40 + smokeOffset, 6)
          .fill({ color: 0x4a5568, alpha: 0.4 });
        g.circle(18, -buildH - 48 + smokeOffset * 0.7, 5)
          .fill({ color: 0x4a5568, alpha: 0.25 });
        g.circle(15, -buildH - 55 + smokeOffset * 0.5, 4)
          .fill({ color: 0x4a5568, alpha: 0.15 });
        // Gears (animated)
        const gearAngle = this.time * 2;
        g.circle(-12, -buildH + 20, 8)
          .stroke({ width: 2, color: colors.secondary });
        for (let i = 0; i < 6; i++) {
          const a = gearAngle + (i / 6) * Math.PI * 2;
          g.moveTo(-12 + Math.cos(a) * 5, -buildH + 20 + Math.sin(a) * 5)
            .lineTo(-12 + Math.cos(a) * 10, -buildH + 20 + Math.sin(a) * 10)
            .stroke({ width: 2, color: colors.secondary, alpha: 0.7 });
        }
        break;
    }
  }

  /**
   * Draw lock icon
   */
  private drawLockIcon(g: Graphics, x: number, y: number) {
    // Lock body
    g.roundRect(x - 12, y - 5, 24, 20, 3)
      .fill({ color: 0x4a5568 })
      .stroke({ width: 1, color: 0x718096 });

    // Shackle
    g.moveTo(x - 7, y - 5)
      .lineTo(x - 7, y - 15)
      .bezierCurveTo(x - 7, y - 25, x + 7, y - 25, x + 7, y - 15)
      .lineTo(x + 7, y - 5)
      .stroke({ width: 3, color: 0x718096 });

    // Keyhole
    g.circle(x, y + 3, 3)
      .fill({ color: 0x2d3748 });
    g.rect(x - 1.5, y + 3, 3, 6)
      .fill({ color: 0x2d3748 });
  }

  /**
   * Update building labels
   */
  private updateBuildingLabels(visual: BuildingVisual) {
    const { labelContainer, colony, config } = visual;
    labelContainer.removeChildren();

    const nameStyle = new TextStyle({
      fontFamily: 'monospace',
      fontSize: 12,
      fontWeight: 'bold',
      fill: colony?.unlocked ? 0xffffff : 0x888888,
    });

    const infoStyle = new TextStyle({
      fontFamily: 'monospace',
      fontSize: 10,
      fill: colony?.unlocked ? config.colors.glow : 0x666666,
    });

    const goldStyle = new TextStyle({
      fontFamily: 'monospace',
      fontSize: 11,
      fontWeight: 'bold',
      fill: THEME.ui.gold,
    });

    // Name
    const nameText = new Text({
      text: config.name.toUpperCase(),
      style: nameStyle,
    });
    nameText.anchor.set(0.5, 0);
    nameText.y = ISO.buildingHeight * 0.5;
    labelContainer.addChild(nameText);

    if (colony?.unlocked) {
      // Level and production
      const levelText = new Text({
        text: `Lv.${colony.level} • ${colony.goldPerHour}/h`,
        style: infoStyle,
      });
      levelText.anchor.set(0.5, 0);
      levelText.y = ISO.buildingHeight * 0.5 + 14;
      labelContainer.addChild(levelText);

      // Pending gold
      if (colony.pendingGold > 0) {
        const pendingText = new Text({
          text: `+${colony.pendingGold} 🪙`,
          style: goldStyle,
        });
        pendingText.anchor.set(0.5, 0);
        pendingText.y = ISO.buildingHeight * 0.5 + 28;
        labelContainer.addChild(pendingText);
      }
    } else if (colony) {
      // Unlock requirement
      const unlockText = new Text({
        text: `Lv.${colony.unlockLevel} wymagany`,
        style: infoStyle,
      });
      unlockText.anchor.set(0.5, 0);
      unlockText.y = ISO.buildingHeight * 0.5 + 14;
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
   * Sort buildings by depth (Y position)
   */
  private sortBuildingsByDepth() {
    const children = [...this.buildingsLayer.children] as Container[];
    children.sort((a, b) => {
      const visualA = [...this.buildings.values()].find(v => v.container === a);
      const visualB = [...this.buildings.values()].find(v => v.container === b);
      if (!visualA || !visualB) return 0;
      return (visualA.config.gridPos.x + visualA.config.gridPos.y) -
             (visualB.config.gridPos.x + visualB.config.gridPos.y);
    });
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
        const startY = visual.container.y - ISO.buildingHeight * 0.6;

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
    const pos = { x: container.x, y: container.y - ISO.buildingHeight * 0.5 };
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
    this.drawStationFloor();

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
