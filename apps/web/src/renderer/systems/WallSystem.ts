import { Container, Graphics } from 'pixi.js';
import type { GameState, Wall, WallType } from '@arcade/sim-core';
import { FP } from '@arcade/sim-core';
import { VFXSystem } from './VFXSystem.js';
import { fpXToScreen, fpYToScreen } from '../CoordinateSystem.js';

// --- CONSTANTS (Sci-Fi Theme) ---
const WALL_COLORS: Record<WallType, { primary: number; secondary: number; damaged: number; glow: number }> = {
  basic: {
    primary: 0x001a33,    // Dark blue base
    secondary: 0x00ccff,  // Cyan energy
    damaged: 0x004466,    // Damaged blue
    glow: 0x00ccff,       // Cyan glow
  },
  reinforced: {
    primary: 0x1a0033,    // Dark purple base
    secondary: 0xff00ff,  // Magenta plasma
    damaged: 0x330066,    // Damaged purple
    glow: 0xff00ff,       // Magenta glow
  },
  gate: {
    primary: 0x001a0d,    // Dark green base
    secondary: 0x00ff88,  // Green phase
    damaged: 0x003319,    // Damaged green
    glow: 0x00ff88,       // Green glow
  },
};

const SIZES = {
  hpBar: {
    width: 50,
    height: 6,
    offsetY: -5,
    borderWidth: 1,
  },
};

// --- VISUAL BUNDLE ---
export interface WallVisualBundle {
  container: Container;
  body: Graphics;
  details: Graphics;
  hpBar: Graphics;
  damageOverlay: Graphics;
}

// --- WALL VISUAL POOL ---
export class WallVisualPool {
  private pool: WallVisualBundle[] = [];
  private activeCount = 0;
  private readonly maxSize: number;

  constructor(maxSize = 50) {
    this.maxSize = maxSize;
  }

  acquire(): WallVisualBundle {
    this.activeCount++;

    const pooled = this.pool.pop();
    if (pooled) {
      pooled.container.visible = true;
      pooled.container.alpha = 1;
      pooled.container.scale.set(1, 1);
      return pooled;
    }

    // Create new bundle
    const container = new Container();

    const body = new Graphics();
    body.label = 'body';
    container.addChild(body);

    const details = new Graphics();
    details.label = 'details';
    container.addChild(details);

    const damageOverlay = new Graphics();
    damageOverlay.label = 'damageOverlay';
    container.addChild(damageOverlay);

    const hpBar = new Graphics();
    hpBar.label = 'hpBar';
    container.addChild(hpBar);

    return { container, body, details, hpBar, damageOverlay };
  }

  release(bundle: WallVisualBundle): void {
    this.activeCount--;

    if (this.pool.length >= this.maxSize) {
      bundle.container.destroy({ children: true });
      return;
    }

    bundle.body.clear();
    bundle.details.clear();
    bundle.hpBar.clear();
    bundle.damageOverlay.clear();
    bundle.container.position.set(0, 0);
    bundle.container.scale.set(1, 1);
    bundle.container.visible = false;

    this.pool.push(bundle);
  }

  prewarm(count: number): void {
    for (let i = 0; i < count && this.pool.length < this.maxSize; i++) {
      const bundle = this.acquire();
      this.release(bundle);
    }
  }

  clear(): void {
    for (const bundle of this.pool) {
      bundle.container.destroy({ children: true });
    }
    this.pool.length = 0;
    this.activeCount = 0;
  }
}

// --- WALL SYSTEM ---
export class WallSystem {
  public container: Container;

  private visuals: Map<number, WallVisualBundle> = new Map();
  private visualPool = new WallVisualPool(50);

  // Track state for dirty flag optimization
  private lastHp: Map<number, number> = new Map();
  private visualHp: Map<number, number> = new Map();

  constructor() {
    this.container = new Container();
    this.visualPool.prewarm(10);
  }

  public update(state: GameState, viewWidth: number, viewHeight: number, vfx?: VFXSystem) {
    const currentIds = new Set<number>();

    // 1. Update / Create Visuals
    for (const wall of state.walls) {
      currentIds.add(wall.id);

      let bundle = this.visuals.get(wall.id);
      if (!bundle) {
        bundle = this.createWallVisual(wall, viewWidth, viewHeight);
        this.container.addChild(bundle.container);
        this.visuals.set(wall.id, bundle);
        this.lastHp.set(wall.id, wall.maxHp);
        this.visualHp.set(wall.id, wall.currentHp);
      }

      // Update position (walls are static but we need screen coords)
      const x = fpXToScreen(wall.x, viewWidth);
      const y = fpYToScreen(wall.y, viewHeight);
      const width = FP.toFloat(wall.width) * (viewWidth / 40); // Scale to screen
      const height = FP.toFloat(wall.height) * (viewHeight / 15);

      bundle.container.position.set(x + width / 2, y + height / 2);

      // Handle damage visual
      const previousHp = this.lastHp.get(wall.id) ?? wall.currentHp;
      if (previousHp > wall.currentHp && vfx) {
        const damage = previousHp - wall.currentHp;
        if (damage >= 1) {
          vfx.spawnDamageNumber(bundle.container.x, bundle.container.y - 20, damage);
          // Shake effect on damage
          bundle.container.position.x += (Math.random() - 0.5) * 4;
        }
      }
      this.lastHp.set(wall.id, wall.currentHp);

      // Smooth HP bar lerp
      let currentVisualHp = this.visualHp.get(wall.id) ?? wall.currentHp;
      if (Math.abs(currentVisualHp - wall.currentHp) > 0.5) {
        currentVisualHp += (wall.currentHp - currentVisualHp) * 0.15;
        this.visualHp.set(wall.id, currentVisualHp);
        this.updateHpBar(bundle.hpBar, currentVisualHp / wall.maxHp, width);
      }

      // Update damage overlay based on HP
      this.updateDamageOverlay(bundle, wall, width, height);
    }

    // 2. Remove destroyed walls
    for (const [id, bundle] of this.visuals) {
      if (!currentIds.has(id)) {
        // Spawn destruction VFX
        if (vfx) {
          vfx.spawnExplosion(bundle.container.x, bundle.container.y, 0x8b7355);
        }
        this.container.removeChild(bundle.container);
        this.visualPool.release(bundle);
        this.visuals.delete(id);
        this.lastHp.delete(id);
        this.visualHp.delete(id);
      }
    }
  }

  private createWallVisual(wall: Wall, viewWidth: number, viewHeight: number): WallVisualBundle {
    const bundle = this.visualPool.acquire();
    const colors = WALL_COLORS[wall.type];

    const width = FP.toFloat(wall.width) * (viewWidth / 40);
    const height = FP.toFloat(wall.height) * (viewHeight / 15);

    // Draw body (centered) - Sci-Fi Energy Barrier
    const body = bundle.body;
    body.clear();

    // Glow effect (outer)
    body.roundRect(-width / 2 - 3, -height / 2 - 3, width + 6, height + 6, 6);
    body.fill({ color: colors.glow, alpha: 0.2 });

    // Dark base panel
    body.roundRect(-width / 2, -height / 2, width, height, 4);
    body.fill({ color: colors.primary, alpha: 0.9 });

    // Energy border (glowing edge)
    body.roundRect(-width / 2, -height / 2, width, height, 4);
    body.stroke({ width: 2, color: colors.secondary, alpha: 0.9 });

    // Draw details based on wall type (Sci-Fi patterns)
    const details = bundle.details;
    details.clear();

    if (wall.type === 'basic') {
      // Energy field - horizontal scan lines
      for (let i = 0; i < 4; i++) {
        const lineY = -height / 2 + (i + 1) * (height / 5);
        details.moveTo(-width / 2 + 4, lineY);
        details.lineTo(width / 2 - 4, lineY);
        details.stroke({ width: 1, color: colors.secondary, alpha: 0.4 });
      }
      // Center energy core
      details.circle(0, 0, 4);
      details.fill({ color: colors.secondary, alpha: 0.6 });
    } else if (wall.type === 'reinforced') {
      // Plasma shield - hexagon pattern
      const hexSize = 8;
      for (let row = -1; row <= 1; row++) {
        for (let col = -1; col <= 1; col++) {
          const hx = col * hexSize * 1.5;
          const hy = row * hexSize * 1.2 + (col % 2) * hexSize * 0.6;
          this.drawHexagon(details, hx, hy, hexSize * 0.5, colors.secondary, 0.4);
        }
      }
      // Power nodes at corners
      const nodeSize = 4;
      const corners = [
        [-width / 2 + 8, -height / 2 + 8],
        [width / 2 - 8, -height / 2 + 8],
        [-width / 2 + 8, height / 2 - 8],
        [width / 2 - 8, height / 2 - 8],
      ];
      for (const [cx, cy] of corners) {
        details.circle(cx, cy, nodeSize);
        details.fill({ color: colors.secondary, alpha: 0.8 });
      }
    } else if (wall.type === 'gate') {
      // Phase gate - vertical energy streams
      const streamCount = 3;
      for (let i = 0; i < streamCount; i++) {
        const streamX = -width / 2 + (i + 1) * (width / (streamCount + 1));
        details.moveTo(streamX, -height / 2 + 6);
        details.lineTo(streamX, height / 2 - 6);
        details.stroke({ width: 3, color: colors.secondary, alpha: 0.5 });
      }
      // Center portal ring
      details.circle(0, 0, Math.min(width, height) / 4);
      details.stroke({ width: 2, color: colors.secondary, alpha: 0.7 });
      details.circle(0, 0, 3);
      details.fill({ color: colors.secondary, alpha: 0.9 });
    }

    // Initialize HP bar
    this.updateHpBar(bundle.hpBar, 1, width);

    return bundle;
  }

  private drawHexagon(g: Graphics, x: number, y: number, size: number, color: number, alpha: number): void {
    const points: number[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      points.push(x + size * Math.cos(angle), y + size * Math.sin(angle));
    }
    g.poly(points);
    g.stroke({ width: 1, color, alpha });
  }

  private updateHpBar(hpBar: Graphics, hpPercent: number, width: number): void {
    hpBar.clear();

    const barWidth = Math.min(width, SIZES.hpBar.width);
    const barHeight = SIZES.hpBar.height;
    const offsetY = SIZES.hpBar.offsetY;

    // Background
    hpBar.roundRect(-barWidth / 2, -barHeight / 2 + offsetY - 30, barWidth, barHeight, 2);
    hpBar.fill({ color: 0x000000, alpha: 0.6 });

    // HP fill
    const fillWidth = Math.max(0, (barWidth - 2) * hpPercent);
    const hpColor = hpPercent > 0.6 ? 0x00ff00 : hpPercent > 0.3 ? 0xffff00 : 0xff4444;

    if (fillWidth > 0) {
      hpBar.roundRect(-barWidth / 2 + 1, -barHeight / 2 + 1 + offsetY - 30, fillWidth, barHeight - 2, 1);
      hpBar.fill({ color: hpColor });
    }
  }

  private updateDamageOverlay(bundle: WallVisualBundle, wall: Wall, width: number, height: number): void {
    const hpPercent = wall.currentHp / wall.maxHp;
    const overlay = bundle.damageOverlay;
    overlay.clear();

    if (hpPercent < 0.7) {
      const colors = WALL_COLORS[wall.type];
      const glitchAlpha = Math.min(0.8, (0.7 - hpPercent) * 2);

      // Sci-fi damage: electrical interference/glitch lines
      if (hpPercent < 0.5) {
        // Electric arcs / interference
        const arcPoints = [
          [-width / 4, -height / 3],
          [-width / 8, -height / 6],
          [width / 6, 0],
          [width / 4, height / 4],
        ];
        for (let i = 0; i < arcPoints.length - 1; i++) {
          overlay.moveTo(arcPoints[i][0], arcPoints[i][1]);
          overlay.lineTo(arcPoints[i + 1][0], arcPoints[i + 1][1]);
        }
        overlay.stroke({ width: 2, color: colors.secondary, alpha: glitchAlpha * 0.7 });

        // Flickering damage squares
        overlay.rect(-width / 6, -height / 4, width / 8, height / 8);
        overlay.fill({ color: colors.damaged, alpha: glitchAlpha * 0.5 });
      }

      if (hpPercent < 0.3) {
        // Critical damage - red warning glow
        overlay.roundRect(-width / 2 + 2, -height / 2 + 2, width - 4, height - 4, 3);
        overlay.stroke({ width: 2, color: 0xff0000, alpha: glitchAlpha * 0.4 });
        // Warning triangle
        overlay.poly([0, -8, -6, 4, 6, 4]);
        overlay.fill({ color: 0xff0000, alpha: glitchAlpha * 0.6 });
      }
    }
  }

  public clearAll(): void {
    for (const bundle of this.visuals.values()) {
      this.container.removeChild(bundle.container);
      this.visualPool.release(bundle);
    }
    this.visuals.clear();
    this.lastHp.clear();
    this.visualHp.clear();
  }
}
