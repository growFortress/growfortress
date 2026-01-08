import { Container, Graphics, Text } from 'pixi.js';
import type { GameState, ActiveTurret, TurretSlot, FortressClass, Enemy } from '@arcade/sim-core';
import { FP, getTurretById, calculateTurretStats } from '@arcade/sim-core';

// --- CLASS COLORS (simplified: 5 classes) ---
const CLASS_COLORS: Record<FortressClass, { primary: number; secondary: number; glow: number; barrel: number }> = {
  natural: { primary: 0x228b22, secondary: 0x32cd32, glow: 0x44ff44, barrel: 0x8b4513 },
  ice: { primary: 0x00bfff, secondary: 0x87ceeb, glow: 0xadd8e6, barrel: 0x4169e1 },
  fire: { primary: 0xff4500, secondary: 0xff6600, glow: 0xffaa00, barrel: 0x8b0000 },
  lightning: { primary: 0x9932cc, secondary: 0xda70d6, glow: 0xffffff, barrel: 0x4b0082 },
  tech: { primary: 0x00f0ff, secondary: 0x00ffff, glow: 0xffffff, barrel: 0x2f4f4f },
};

// Turret type visual configs (simplified: 4 turrets)
const TURRET_CONFIGS: Record<string, { shape: 'cannon' | 'tower' | 'dome' | 'tesla'; barrelCount: number }> = {
  arrow: { shape: 'tower', barrelCount: 1 },
  cannon: { shape: 'cannon', barrelCount: 1 },
  tesla: { shape: 'tesla', barrelCount: 0 },
  frost: { shape: 'dome', barrelCount: 1 },
};

const SIZES = {
  slotSize: 60,
  turretBase: 40,
  tierMultiplier: { 1: 1.0, 2: 1.1, 3: 1.2 },
};

interface TurretVisual {
  container: Container;
  rotation: number;
  lastAttackTick: number;
  rangeCircle: Graphics;
}

export class TurretSystem {
  public container: Container;
  private slotVisuals: Map<number, Container> = new Map();
  private turretVisuals: Map<number, TurretVisual> = new Map();

  constructor() {
    this.container = new Container();
  }

  public update(state: GameState, viewWidth: number, viewHeight: number) {
    // First, update/create slot visuals
    this.updateSlots(state.turretSlots, viewWidth, viewHeight);

    // Then, update turret visuals
    this.updateTurrets(state, viewWidth, viewHeight);
  }

  private updateSlots(slots: TurretSlot[], viewWidth: number, viewHeight: number) {
    const currentSlotIds = new Set<number>();

    for (const slot of slots) {
      currentSlotIds.add(slot.index);

      let visual = this.slotVisuals.get(slot.index);
      if (!visual) {
        visual = this.createSlotVisual(slot);
        this.container.addChild(visual);
        this.slotVisuals.set(slot.index, visual);
      }

      // Update position
      const screenX = this.toScreenX(slot.x, viewWidth);
      const screenY = this.toScreenY(slot.y, viewHeight);
      visual.position.set(screenX, screenY);

      // Update locked/unlocked visual
      const lockOverlay = visual.getChildByLabel('lock') as Graphics;
      if (lockOverlay) {
        lockOverlay.visible = !slot.isUnlocked;
      }
    }

    // Remove old slots
    for (const [id, visual] of this.slotVisuals) {
      if (!currentSlotIds.has(id)) {
        this.container.removeChild(visual);
        visual.destroy({ children: true });
        this.slotVisuals.delete(id);
      }
    }
  }

  private createSlotVisual(slot: TurretSlot): Container {
    const container = new Container();

    // Base platform
    const base = new Graphics();
    base.label = 'base';

    // Hexagonal platform
    const size = SIZES.slotSize / 2;
    const points: number[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 2;
      points.push(Math.cos(angle) * size, Math.sin(angle) * size);
    }
    base.poly(points)
      .fill({ color: 0x1a1a2e })
      .stroke({ width: 2, color: 0x00ccff, alpha: 0.5 });

    container.addChild(base);

    // Slot number indicator
    const slotNum = new Text({
      text: `${slot.index}`,
      style: {
        fontSize: 12,
        fill: 0x888888,
        fontFamily: 'Arial',
      },
    });
    slotNum.anchor.set(0.5);
    slotNum.position.y = size + 10;
    container.addChild(slotNum);

    // Lock overlay
    const lockOverlay = new Graphics();
    lockOverlay.label = 'lock';
    lockOverlay.poly(points)
      .fill({ color: 0x000000, alpha: 0.7 });
    // Lock icon
    lockOverlay.rect(-8, -8, 16, 16)
      .fill({ color: 0x666666 })
      .stroke({ width: 2, color: 0x888888 });
    lockOverlay.visible = !slot.isUnlocked;
    container.addChild(lockOverlay);

    return container;
  }

  private updateTurrets(state: GameState, viewWidth: number, viewHeight: number) {
    const currentTurretSlots = new Set<number>();
    const time = Date.now() / 1000;

    for (const turret of state.turrets) {
      currentTurretSlots.add(turret.slotIndex);

      // Find the slot for this turret
      const slot = state.turretSlots.find(s => s.index === turret.slotIndex);
      if (!slot) continue;

      let visual = this.turretVisuals.get(turret.slotIndex);
      if (!visual) {
        visual = this.createTurretVisual(turret);
        this.container.addChild(visual.container);
        this.turretVisuals.set(turret.slotIndex, visual);
      }

      // Update position
      const screenX = this.toScreenX(slot.x, viewWidth);
      const screenY = this.toScreenY(slot.y, viewHeight);
      visual.container.position.set(screenX, screenY);

      // Update visuals
      this.updateTurretVisual(visual, turret, state, time, viewWidth);
    }

    // Remove turrets no longer present
    for (const [slotIndex, visual] of this.turretVisuals) {
      if (!currentTurretSlots.has(slotIndex)) {
        this.container.removeChild(visual.container);
        visual.container.destroy({ children: true });
        this.turretVisuals.delete(slotIndex);
      }
    }
  }

  private createTurretVisual(_turret: ActiveTurret): TurretVisual {
    const container = new Container();

    // Range indicator circle (drawn first so it's behind turret)
    const rangeCircle = new Graphics();
    rangeCircle.label = 'rangeCircle';
    rangeCircle.alpha = 0.15;
    container.addChild(rangeCircle);

    // Turret body
    const body = new Graphics();
    body.label = 'body';
    container.addChild(body);

    // Barrel/weapon
    const barrel = new Graphics();
    barrel.label = 'barrel';
    container.addChild(barrel);

    // Class indicator ring
    const classRing = new Graphics();
    classRing.label = 'classRing';
    container.addChild(classRing);

    // Tier badge
    const tierBadge = new Graphics();
    tierBadge.label = 'tier';
    tierBadge.position.set(SIZES.turretBase * 0.6, -SIZES.turretBase * 0.6);
    container.addChild(tierBadge);

    return {
      container,
      rotation: 0,
      lastAttackTick: 0,
      rangeCircle,
    };
  }

  private updateTurretVisual(
    visual: TurretVisual,
    turret: ActiveTurret,
    state: GameState,
    time: number,
    viewWidth: number
  ) {
    const body = visual.container.getChildByLabel('body') as Graphics;
    const barrel = visual.container.getChildByLabel('barrel') as Graphics;
    const classRing = visual.container.getChildByLabel('classRing') as Graphics;
    const tierBadge = visual.container.getChildByLabel('tier') as Graphics;

    if (!body || !barrel || !classRing || !tierBadge) return;

    // Clear and redraw
    body.clear();
    barrel.clear();
    classRing.clear();
    tierBadge.clear();
    visual.rangeCircle.clear();

    // Draw range circle only during gameplay (when enemies exist)
    const isInGame = state.enemies && state.enemies.length > 0;
    if (isInGame) {
      this.drawRangeCircle(visual.rangeCircle, turret, viewWidth);
    }

    const colors = CLASS_COLORS[turret.currentClass];
    const config = TURRET_CONFIGS[turret.definitionId] || { shape: 'tower', barrelCount: 1 };
    const tierKey = turret.tier as 1 | 2 | 3;
    const size = SIZES.turretBase * SIZES.tierMultiplier[tierKey];

    // Find nearest enemy for targeting
    const targetAngle = this.findTargetAngle(visual.container.x, state.enemies, viewWidth);

    // Smooth rotation towards target (slower for less "jittery" appearance)
    if (targetAngle !== null) {
      let angleDiff = targetAngle - visual.rotation;
      // Normalize angle difference to -PI to PI range
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      // Slower rotation (was 0.1, now 0.05) for smoother tracking
      visual.rotation += angleDiff * 0.05;
    }

    // Draw turret based on shape
    switch (config.shape) {
      case 'cannon':
        this.drawCannonTurret(body, barrel, size, colors, visual.rotation, config.barrelCount);
        break;
      case 'tower':
        this.drawTowerTurret(body, barrel, size, colors, visual.rotation);
        break;
      case 'dome':
        this.drawDomeTurret(body, barrel, size, colors, visual.rotation, config.barrelCount > 0);
        break;
      case 'tesla':
        this.drawTeslaTurret(body, size, colors, time);
        break;
    }

    // Draw class ring
    classRing.circle(0, 0, size + 5)
      .stroke({ width: 2, color: colors.glow, alpha: 0.5 });

    // Draw tier badge
    this.drawTierBadge(tierBadge, turret.tier);

    // Attack animation
    if (turret.lastAttackTick > visual.lastAttackTick) {
      visual.lastAttackTick = turret.lastAttackTick;
      // Add muzzle flash effect
      body.circle(0, -size * 0.5, 8)
        .fill({ color: colors.glow, alpha: 0.8 });
    }
  }

  private drawCannonTurret(
    body: Graphics,
    barrel: Graphics,
    size: number,
    colors: { primary: number; secondary: number; glow: number; barrel: number },
    rotation: number,
    barrelCount: number
  ) {
    // Base platform
    body.circle(0, 0, size * 0.8)
      .fill({ color: colors.primary })
      .stroke({ width: 2, color: colors.secondary });

    // Rotating turret head
    body.circle(0, 0, size * 0.5)
      .fill({ color: colors.secondary });

    // Barrels
    const barrelLength = size * 1.2;
    const barrelWidth = size * 0.15;

    if (barrelCount === 1) {
      barrel.rect(-barrelWidth / 2, -barrelLength, barrelWidth, barrelLength)
        .fill({ color: colors.barrel })
        .stroke({ width: 1, color: colors.secondary });
    } else if (barrelCount === 2) {
      barrel.rect(-barrelWidth * 1.5, -barrelLength, barrelWidth, barrelLength)
        .fill({ color: colors.barrel });
      barrel.rect(barrelWidth * 0.5, -barrelLength, barrelWidth, barrelLength)
        .fill({ color: colors.barrel });
    }

    barrel.rotation = rotation;
  }

  private drawTowerTurret(
    body: Graphics,
    barrel: Graphics,
    size: number,
    colors: { primary: number; secondary: number; glow: number; barrel: number },
    rotation: number
  ) {
    // Tall tower base
    body.rect(-size * 0.4, -size * 0.3, size * 0.8, size * 0.6)
      .fill({ color: colors.primary })
      .stroke({ width: 2, color: colors.secondary });

    // Top platform
    body.circle(0, -size * 0.3, size * 0.35)
      .fill({ color: colors.secondary });

    // Long sniper barrel
    const barrelLength = size * 1.5;
    barrel.rect(-size * 0.08, -barrelLength, size * 0.16, barrelLength)
      .fill({ color: colors.barrel });
    // Scope
    barrel.circle(0, -barrelLength * 0.7, size * 0.1)
      .fill({ color: 0x111111 })
      .stroke({ width: 1, color: colors.glow });

    barrel.rotation = rotation;
  }

  private drawDomeTurret(
    body: Graphics,
    barrel: Graphics,
    size: number,
    colors: { primary: number; secondary: number; glow: number; barrel: number },
    rotation: number,
    hasBarrel: boolean
  ) {
    // Dome base
    body.ellipse(0, size * 0.2, size * 0.7, size * 0.3)
      .fill({ color: colors.primary });

    // Dome top
    body.ellipse(0, 0, size * 0.5, size * 0.4)
      .fill({ color: colors.secondary, alpha: 0.8 })
      .stroke({ width: 2, color: colors.glow, alpha: 0.5 });

    // Glowing core
    body.circle(0, 0, size * 0.2)
      .fill({ color: colors.glow, alpha: 0.6 });

    if (hasBarrel) {
      // Short nozzle
      barrel.rect(-size * 0.1, -size * 0.6, size * 0.2, size * 0.3)
        .fill({ color: colors.barrel });
      barrel.rotation = rotation;
    }
  }

  private drawTeslaTurret(
    body: Graphics,
    size: number,
    colors: { primary: number; secondary: number; glow: number; barrel: number },
    time: number
  ) {
    // Tesla coil base
    body.rect(-size * 0.4, 0, size * 0.8, size * 0.3)
      .fill({ color: colors.primary });

    // Coil tower
    body.rect(-size * 0.2, -size * 0.8, size * 0.4, size * 0.8)
      .fill({ color: colors.barrel });

    // Tesla coil top
    body.circle(0, -size * 0.8, size * 0.25)
      .fill({ color: colors.secondary })
      .stroke({ width: 2, color: colors.glow });

    // Electric arcs (animated)
    const arcCount = 4;
    for (let i = 0; i < arcCount; i++) {
      const angle = time * 3 + (i * Math.PI * 2) / arcCount;
      const arcLength = size * 0.4 + Math.sin(time * 10 + i) * 5;
      const endX = Math.cos(angle) * arcLength;
      const endY = -size * 0.8 + Math.sin(angle) * arcLength * 0.5;

      body.moveTo(0, -size * 0.8)
        .lineTo(endX, endY)
        .stroke({ width: 2, color: colors.glow, alpha: 0.7 });
    }
  }

  private drawTierBadge(g: Graphics, tier: 1 | 2 | 3) {
    const tierColors = {
      1: 0xcd7f32,
      2: 0xc0c0c0,
      3: 0xffd700,
    };

    g.circle(0, 0, 8)
      .fill({ color: tierColors[tier] })
      .stroke({ width: 1, color: 0xffffff });

    for (let i = 0; i < tier; i++) {
      g.circle(-3 + i * 3, 0, 1.5)
        .fill({ color: 0xffffff });
    }
  }

  private findTargetAngle(
    turretX: number,
    enemies: Enemy[],
    viewWidth: number
  ): number | null {
    if (enemies.length === 0) return null;

    // Find nearest enemy
    let nearest = enemies[0];
    let nearestDist = Infinity;

    for (const enemy of enemies) {
      const enemyScreenX = this.toScreenX(enemy.x, viewWidth);
      const dist = Math.abs(enemyScreenX - turretX);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = enemy;
      }
    }

    // Calculate angle to enemy (pointing right = 0, up = -PI/2)
    const enemyScreenX = this.toScreenX(nearest.x, viewWidth);
    const dx = enemyScreenX - turretX;
    // Assume enemies are roughly at same Y for simplicity
    return Math.atan2(0, dx) + Math.PI / 2;
  }

  // --- Helpers ---
  private toScreenX(fpX: number, viewWidth: number): number {
    const unitX = FP.toFloat(fpX);
    const fieldWidth = 40;
    return (unitX / fieldWidth) * viewWidth;
  }

  private toScreenY(fpY: number, viewHeight: number): number {
    const unitY = FP.toFloat(fpY);
    const fieldCenterY = 7.5;
    const turretLaneHeight = 0.06;
    const turretLaneH = viewHeight * turretLaneHeight;
    const pathTop = viewHeight * 0.35;
    const pathBottom = viewHeight * 0.65; // Path is 30% (35% to 65%)

    // Position turret slots in dedicated turret lanes (outside the enemy path)
    if (unitY < fieldCenterY) {
      // Top turret lane (above path)
      const topLaneY = pathTop - turretLaneH;
      const topLaneCenterY = topLaneY + turretLaneH / 2;
      return topLaneCenterY;
    } else {
      // Bottom turret lane (below path)
      const bottomLaneCenterY = pathBottom + turretLaneH / 2;
      return bottomLaneCenterY;
    }
  }

  private drawRangeCircle(
    rangeCircle: Graphics,
    turret: ActiveTurret,
    viewWidth: number
  ): void {
    // Get turret definition to access base stats
    const turretDef = getTurretById(turret.definitionId as any);
    if (!turretDef) return;

    // Calculate turret stats with class and tier modifiers
    const stats = calculateTurretStats(turretDef, turret.currentClass, turret.tier);

    // Convert range from fixed-point (16384 = 1.0) to game units
    const rangeInUnits = stats.range / 16384;

    // Convert game units to screen pixels
    const fieldWidth = 40;
    const rangeInPixels = (rangeInUnits / fieldWidth) * viewWidth;

    // Get class color for the range circle
    const colors = CLASS_COLORS[turret.currentClass];

    // Draw range circle
    rangeCircle.circle(0, 0, rangeInPixels)
      .stroke({ width: 2, color: colors.glow, alpha: 0.3 })
      .fill({ color: colors.primary, alpha: 0.05 });
  }
}
