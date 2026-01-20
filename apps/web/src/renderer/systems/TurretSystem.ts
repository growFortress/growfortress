import { Container, Graphics, Text } from "pixi.js";
import type {
  GameState,
  ActiveTurret,
  TurretSlot,
  FortressClass,
  Enemy,
} from "@arcade/sim-core";
import {
  getTurretById,
  calculateTurretStats,
  TURRET_SLOT_UNLOCKS,
} from "@arcade/sim-core";
import {
  fpXToScreen,
  turretYToScreen,
  FIELD_WIDTH,
} from "../CoordinateSystem.js";

// --- CLASS COLORS (7 classes) ---
const CLASS_COLORS: Record<
  FortressClass,
  { primary: number; secondary: number; glow: number; barrel: number }
> = {
  natural: {
    primary: 0x228b22,
    secondary: 0x32cd32,
    glow: 0x44ff44,
    barrel: 0x8b4513,
  },
  ice: {
    primary: 0x00bfff,
    secondary: 0x87ceeb,
    glow: 0xadd8e6,
    barrel: 0x4169e1,
  },
  fire: {
    primary: 0xff4500,
    secondary: 0xff6600,
    glow: 0xffaa00,
    barrel: 0x8b0000,
  },
  lightning: {
    primary: 0x9932cc,
    secondary: 0xda70d6,
    glow: 0xffffff,
    barrel: 0x4b0082,
  },
  tech: {
    primary: 0x00f0ff,
    secondary: 0x00ffff,
    glow: 0xffffff,
    barrel: 0x2f4f4f,
  },
  void: {
    primary: 0x4b0082,
    secondary: 0x8b008b,
    glow: 0x9400d3,
    barrel: 0x2f0047,
  },
  plasma: {
    primary: 0x00ffff,
    secondary: 0xff00ff,
    glow: 0xffffff,
    barrel: 0x008b8b,
  },
};

// Turret type visual configs (simplified: 4 turrets)
// Supports both legacy IDs (arrow, cannon, tesla, frost) and new IDs (railgun, artillery, arc, cryo)
const TURRET_CONFIGS: Record<
  string,
  { shape: "cannon" | "tower" | "dome" | "tesla"; barrelCount: number }
> = {
  // Legacy IDs
  arrow: { shape: "tower", barrelCount: 1 },
  cannon: { shape: "cannon", barrelCount: 1 },
  tesla: { shape: "tesla", barrelCount: 0 },
  frost: { shape: "dome", barrelCount: 1 },
  // New IDs
  railgun: { shape: "tower", barrelCount: 1 },
  artillery: { shape: "cannon", barrelCount: 1 },
  arc: { shape: "tesla", barrelCount: 0 },
  cryo: { shape: "dome", barrelCount: 1 },
};

// Turret-specific colors (override class colors for unique appearance per turret type)
const TURRET_TYPE_COLORS: Record<
  string,
  { primary: number; secondary: number; glow: number; barrel: number }
> = {
  // Railgun: Slate gray with cyan energy
  railgun: { primary: 0x4a5568, secondary: 0x718096, glow: 0x00bfff, barrel: 0x2d3748 },
  // Cryo: Turquoise with ice blue glow
  cryo: { primary: 0x00ced1, secondary: 0x87ceeb, glow: 0xadd8e6, barrel: 0x1a5f5f },
  // Artillery: Brown/bronze with orange fire
  artillery: { primary: 0x8b4513, secondary: 0xa0522d, glow: 0xff6600, barrel: 0x5c3317 },
  // Arc: Indigo/purple with cyan electricity
  arc: { primary: 0x4b0082, secondary: 0x9932cc, glow: 0x00ffff, barrel: 0x2f0052 },
};

const SIZES = {
  slotSize: 60,
  turretBase: 52,
  tierMultiplier: { 1: 1.0, 2: 1.1, 3: 1.2 },
};

/**
 * Dirty flags for optimized turret rendering
 */
interface TurretDirtyFlags {
  body: boolean; // Tier or class changed
  tierBadge: boolean; // Tier level changed
  rangeCircle: boolean; // Range needs recalculation
}

interface TurretVisual {
  container: Container;
  rotation: number;
  lastAttackTick: number;
  rangeCircle: Graphics;
  turretId: string;
  // Track previous state for dirty detection
  lastTier: 1 | 2 | 3;
  lastClass: string;
  lastEnemyCount: number; // Track if enemies present for range circle
  dirty: TurretDirtyFlags;
  // Animation state
  recoilAmount: number; // Current barrel recoil (0-1)
  muzzleFlashAlpha: number; // Muzzle flash fade (0-1)
  energyPulse: number; // Energy core pulse phase
}

export class TurretSystem {
  public container: Container;
  private slotVisuals: Map<number, Container> = new Map();
  private turretVisuals: Map<number, TurretVisual> = new Map();
  private onTurretClick:
    | ((turretId: string, slotIndex: number) => void)
    | null = null;
  private lastViewWidth: number = 0;
  private lastViewHeight: number = 0;
  private stableDimensionsCount: number = 0;
  private needsRecreate: boolean = false;

  constructor() {
    this.container = new Container();
  }

  public setOnTurretClick(
    callback: (turretId: string, slotIndex: number) => void,
  ) {
    this.onTurretClick = callback;
  }

  public update(state: GameState, viewWidth: number, viewHeight: number) {
    // Detect resize - if dimensions changed, mark that we need to recreate
    const resized =
      this.lastViewWidth !== viewWidth || this.lastViewHeight !== viewHeight;

    if (resized && this.lastViewWidth !== 0) {
      this.needsRecreate = true;
      this.stableDimensionsCount = 0; // Reset stability counter
    } else if (this.needsRecreate) {
      // Dimensions are stable - increment counter
      this.stableDimensionsCount++;

      // After 3 stable frames (roughly 50ms), recreate Graphics
      if (this.stableDimensionsCount >= 3) {
        this.recreateAllSlotsAndTurrets(state.turretSlots, state.turrets);
        this.needsRecreate = false;
        this.stableDimensionsCount = 0;
      }
    }

    this.lastViewWidth = viewWidth;
    this.lastViewHeight = viewHeight;

    // Get set of slot indices that have turrets
    const occupiedSlots = new Set(state.turrets.map((t) => t.slotIndex));

    // First, update/create slot visuals
    this.updateSlots(state.turretSlots, viewWidth, viewHeight, occupiedSlots);

    // Then, update turret visuals
    this.updateTurrets(state, viewWidth, viewHeight);
  }

  private updateSlots(
    slots: TurretSlot[],
    viewWidth: number,
    viewHeight: number,
    occupiedSlots: Set<number>,
  ) {
    const currentSlotIds = new Set<number>();

    for (const slot of slots) {
      currentSlotIds.add(slot.index);

      let visual = this.slotVisuals.get(slot.index);

      if (!visual) {
        // Create new visual
        visual = this.createSlotVisual(slot);
        this.container.addChild(visual);
        this.slotVisuals.set(slot.index, visual);
      }

      // Hide slot if turret is placed on it
      visual.visible = !occupiedSlots.has(slot.index);

      // Update position
      const screenX = fpXToScreen(slot.x, viewWidth);
      const screenY = turretYToScreen(slot.y, viewHeight);
      visual.position.set(screenX, screenY);

      // Update locked/unlocked visual
      const lockOverlay = visual.getChildByLabel("lock") as Container;
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
    const size = SIZES.slotSize / 2;

    // Helper function to generate hexagon points
    const getHexPoints = (): number[] => {
      const pts: number[] = [];
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        pts.push(Math.cos(angle) * size, Math.sin(angle) * size);
      }
      return pts;
    };

    // Base platform
    const base = new Graphics();
    base.label = "base";
    base
      .poly(getHexPoints())
      .fill({ color: 0x1a1a2e })
      .stroke({ width: 2, color: 0x00ccff, alpha: 0.5 });
    container.addChild(base);

    // Slot number indicator
    const slotNum = new Text({
      text: `${slot.index}`,
      style: {
        fontSize: 12,
        fill: 0x888888,
        fontFamily: "Arial",
      },
    });
    slotNum.anchor.set(0.5);
    slotNum.position.y = size + 10;
    container.addChild(slotNum);

    // Lock overlay container - MUST be positioned at 0,0 (center of slot)
    const lockOverlay = new Container();
    lockOverlay.label = "lock";
    lockOverlay.position.set(0, 0);

    // Hexagonal dark overlay background
    const lockBg = new Graphics();
    lockBg.poly(getHexPoints()).fill({ color: 0x000000, alpha: 0.75 });
    lockOverlay.addChild(lockBg);

    // Draw proper padlock icon
    const lockIcon = new Graphics();
    const lockColor = 0x888888;
    const lockHighlight = 0xaaaaaa;

    // Padlock body (rounded rectangle)
    lockIcon
      .roundRect(-8, -2, 16, 12, 2)
      .fill({ color: lockColor })
      .stroke({ width: 1, color: lockHighlight });

    // Padlock shackle (U-shape arc)
    lockIcon
      .moveTo(-5, -2)
      .lineTo(-5, -6)
      .arcTo(-5, -10, 0, -10, 4)
      .arcTo(5, -10, 5, -6, 4)
      .lineTo(5, -2)
      .stroke({ width: 2.5, color: lockColor });

    // Keyhole
    lockIcon.circle(0, 4, 2).fill({ color: 0x333333 });
    lockIcon.rect(-1, 4, 2, 4).fill({ color: 0x333333 });

    lockOverlay.addChild(lockIcon);

    // Get unlock level for this slot
    const slotConfig = TURRET_SLOT_UNLOCKS[slot.index - 1];
    const unlockLevel = slotConfig?.levelRequired ?? 50;

    // Level text below lock icon
    const levelText = new Text({
      text: `Poz. ${unlockLevel}`,
      style: {
        fontSize: 9,
        fill: 0x888888,
        fontFamily: "Arial",
        fontWeight: "bold",
      },
    });
    levelText.anchor.set(0.5);
    levelText.position.set(0, 18);
    lockOverlay.addChild(levelText);

    lockOverlay.visible = !slot.isUnlocked;
    container.addChild(lockOverlay);

    return container;
  }

  private updateTurrets(
    state: GameState,
    viewWidth: number,
    viewHeight: number,
  ) {
    const currentTurretSlots = new Set<number>();
    const time = Date.now() / 1000;

    for (const turret of state.turrets) {
      currentTurretSlots.add(turret.slotIndex);

      // Find the slot for this turret
      const slot = state.turretSlots.find((s) => s.index === turret.slotIndex);
      if (!slot) continue;

      let visual = this.turretVisuals.get(turret.slotIndex);

      if (!visual) {
        // Create new visual
        visual = this.createTurretVisual(turret);
        this.container.addChild(visual.container);
        this.turretVisuals.set(turret.slotIndex, visual);
      }

      // Update position
      const screenX = fpXToScreen(slot.x, viewWidth);
      const screenY = turretYToScreen(slot.y, viewHeight);
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

  private createTurretVisual(turret: ActiveTurret): TurretVisual {
    const container = new Container();

    // Make turret clickable
    container.eventMode = "static";
    container.cursor = "pointer";
    container.on("pointerdown", () => {
      if (this.onTurretClick) {
        this.onTurretClick(turret.definitionId, turret.slotIndex);
      }
    });

    // Range indicator circle (drawn first so it's behind turret)
    const rangeCircle = new Graphics();
    rangeCircle.label = "rangeCircle";
    rangeCircle.alpha = 0.15;
    container.addChild(rangeCircle);

    // Base glow layer (behind turret)
    const baseGlow = new Graphics();
    baseGlow.label = "baseGlow";
    container.addChild(baseGlow);

    // Turret body
    const body = new Graphics();
    body.label = "body";
    container.addChild(body);

    // Barrel/weapon
    const barrel = new Graphics();
    barrel.label = "barrel";
    container.addChild(barrel);

    // Muzzle flash layer (on top of barrel)
    const muzzleFlash = new Graphics();
    muzzleFlash.label = "muzzleFlash";
    muzzleFlash.alpha = 0;
    container.addChild(muzzleFlash);

    // Tier badge
    const tierBadge = new Graphics();
    tierBadge.label = "tier";
    tierBadge.position.set(SIZES.turretBase * 0.6, -SIZES.turretBase * 0.6);
    container.addChild(tierBadge);

    // Hit area for click detection (updated when tier changes)
    const hitArea = new Graphics();
    hitArea.label = "hitArea";
    hitArea.circle(0, 0, SIZES.turretBase * 1.2);
    hitArea.fill({ color: 0x000000, alpha: 0.001 }); // Nearly invisible
    container.addChild(hitArea);

    return {
      container,
      rotation: 0,
      lastAttackTick: 0,
      rangeCircle,
      turretId: turret.definitionId,
      lastTier: turret.tier,
      lastClass: turret.currentClass,
      lastEnemyCount: 0,
      // Initialize all dirty to force initial draw
      dirty: {
        body: true,
        tierBadge: true,
        rangeCircle: true,
      },
      // Animation state
      recoilAmount: 0,
      muzzleFlashAlpha: 0,
      energyPulse: 0,
    };
  }

  private updateTurretVisual(
    visual: TurretVisual,
    turret: ActiveTurret,
    state: GameState,
    time: number,
    viewWidth: number,
  ) {
    const body = visual.container.getChildByLabel("body") as Graphics;
    const barrel = visual.container.getChildByLabel("barrel") as Graphics;
    const tierBadge = visual.container.getChildByLabel("tier") as Graphics;
    const baseGlow = visual.container.getChildByLabel("baseGlow") as Graphics;
    const muzzleFlash = visual.container.getChildByLabel(
      "muzzleFlash",
    ) as Graphics;

    if (!body || !barrel || !tierBadge) return;

    // Check for tier/class changes
    if (turret.tier !== visual.lastTier) {
      visual.lastTier = turret.tier;
      visual.dirty.body = true;
      visual.dirty.tierBadge = true;
      visual.dirty.rangeCircle = true;
    }
    if (turret.currentClass !== visual.lastClass) {
      visual.lastClass = turret.currentClass;
      visual.dirty.body = true;
      visual.dirty.rangeCircle = true;
    }

    // Check if enemy presence changed (for range circle visibility)
    const currentEnemyCount = state.enemies?.length ?? 0;
    const hadEnemies = visual.lastEnemyCount > 0;
    const hasEnemies = currentEnemyCount > 0;
    if (hadEnemies !== hasEnemies) {
      visual.dirty.rangeCircle = true;
    }
    visual.lastEnemyCount = currentEnemyCount;

    // Use turret-specific colors if available, otherwise fall back to class colors
    const turretTypeColors = TURRET_TYPE_COLORS[turret.definitionId];
    const colors = turretTypeColors || CLASS_COLORS[turret.currentClass];
    const config = TURRET_CONFIGS[turret.definitionId] || {
      shape: "tower",
      barrelCount: 1,
    };
    const tierKey = turret.tier as 1 | 2 | 3;
    const size = SIZES.turretBase * SIZES.tierMultiplier[tierKey];

    // Find nearest enemy for targeting
    const targetAngle = this.findTargetAngle(
      visual.container.x,
      state.enemies,
      viewWidth,
    );

    // Smooth rotation towards target (slower for less "jittery" appearance)
    const previousRotation = visual.rotation;
    if (targetAngle !== null) {
      let angleDiff = targetAngle - visual.rotation;
      // Normalize angle difference to -PI to PI range
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      // Slower rotation (was 0.1, now 0.05) for smoother tracking
      visual.rotation += angleDiff * 0.05;
    }

    // --- Animation updates ---
    const hasAttackFlash = turret.lastAttackTick > visual.lastAttackTick;

    // Trigger recoil and muzzle flash on attack
    if (hasAttackFlash) {
      visual.lastAttackTick = turret.lastAttackTick;
      visual.recoilAmount = 1.0; // Full recoil
      visual.muzzleFlashAlpha = 1.0; // Full flash
    }

    // Decay recoil (spring-like recovery)
    if (visual.recoilAmount > 0) {
      visual.recoilAmount *= 0.85; // Exponential decay
      if (visual.recoilAmount < 0.01) visual.recoilAmount = 0;
    }

    // Decay muzzle flash (faster than recoil)
    if (visual.muzzleFlashAlpha > 0) {
      visual.muzzleFlashAlpha *= 0.75;
      if (visual.muzzleFlashAlpha < 0.01) visual.muzzleFlashAlpha = 0;
    }

    // Update energy pulse phase
    visual.energyPulse = (visual.energyPulse + 0.05) % (Math.PI * 2);

    // Barrel needs redraw if rotation changed (always during combat)
    // Body needs redraw if dirty, attack animation, tesla (animated), or has active animations
    const isTesla = config.shape === "tesla";
    const rotationChanged =
      Math.abs(visual.rotation - previousRotation) > 0.001;
    const hasActiveAnimation =
      visual.recoilAmount > 0 || visual.muzzleFlashAlpha > 0;
    const needsBodyRedraw =
      visual.dirty.body ||
      isTesla ||
      hasAttackFlash ||
      rotationChanged ||
      hasActiveAnimation;

    // Update base glow (pulsing ambient glow)
    if (baseGlow) {
      baseGlow.clear();
      const glowPulse = 0.3 + Math.sin(time * 2) * 0.1;
      baseGlow
        .circle(0, 0, size * 0.8)
        .fill({ color: colors.glow, alpha: glowPulse * 0.15 });
      baseGlow
        .circle(0, 0, size * 0.5)
        .fill({ color: colors.glow, alpha: glowPulse * 0.1 });
    }

    if (needsBodyRedraw) {
      body.clear();
      barrel.clear();

      // Calculate recoil offset for barrel
      const recoilOffset = visual.recoilAmount * size * 0.15;

      // Draw turret based on shape
      switch (config.shape) {
        case "cannon":
          this.drawCannonTurret(
            body,
            barrel,
            size,
            colors,
            visual.rotation,
            config.barrelCount,
            recoilOffset,
            visual.energyPulse,
          );
          break;
        case "tower":
          this.drawTowerTurret(
            body,
            barrel,
            size,
            colors,
            visual.rotation,
            recoilOffset,
            visual.energyPulse,
          );
          break;
        case "dome":
          this.drawDomeTurret(
            body,
            barrel,
            size,
            colors,
            visual.rotation,
            config.barrelCount > 0,
            recoilOffset,
            visual.energyPulse,
          );
          break;
        case "tesla":
          this.drawTeslaTurret(body, size, colors, time, visual.energyPulse);
          break;
      }

      visual.dirty.body = false;
    }

    // Update muzzle flash
    if (muzzleFlash && config.shape !== "tesla") {
      muzzleFlash.clear();
      if (visual.muzzleFlashAlpha > 0.01) {
        const flashSize = size * 0.4 * (1 + visual.muzzleFlashAlpha * 0.5);
        // Outer glow
        muzzleFlash
          .circle(0, -size * 0.9, flashSize * 1.5)
          .fill({ color: colors.glow, alpha: visual.muzzleFlashAlpha * 0.3 });
        // Middle glow
        muzzleFlash
          .circle(0, -size * 0.9, flashSize)
          .fill({ color: colors.glow, alpha: visual.muzzleFlashAlpha * 0.5 });
        // Core flash
        muzzleFlash
          .circle(0, -size * 0.9, flashSize * 0.5)
          .fill({ color: 0xffffff, alpha: visual.muzzleFlashAlpha * 0.8 });
        // Spikes
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
          const spikeLength = flashSize * (0.8 + Math.random() * 0.4);
          muzzleFlash
            .moveTo(0, -size * 0.9)
            .lineTo(
              Math.cos(angle) * spikeLength,
              -size * 0.9 + Math.sin(angle) * spikeLength,
            )
            .stroke({
              width: 2,
              color: colors.glow,
              alpha: visual.muzzleFlashAlpha * 0.6,
            });
        }
        muzzleFlash.rotation = visual.rotation;
      }
    }

    // Tier badge - update position and redraw on tier change
    if (visual.dirty.tierBadge) {
      // Update badge position to match turret size (which changes with tier)
      const badgeOffset = size * 0.55;
      tierBadge.position.set(badgeOffset, -badgeOffset);
      tierBadge.clear();
      this.drawTierBadge(tierBadge, turret.tier, colors);

      // Update hit area to match turret size
      const hitArea = visual.container.getChildByLabel("hitArea") as Graphics;
      if (hitArea) {
        hitArea.clear();
        hitArea.circle(0, 0, size * 1.1);
        hitArea.fill({ color: 0x000000, alpha: 0.001 });
      }

      visual.dirty.tierBadge = false;
    }

    // Range circle only shown during gameplay when enemies present
    if (hasEnemies) {
      if (visual.dirty.rangeCircle) {
        visual.rangeCircle.clear();
        this.drawRangeCircle(visual.rangeCircle, turret, viewWidth);
        visual.dirty.rangeCircle = false;
      }
    } else {
      // Always clear range circle when no enemies (hub mode)
      visual.rangeCircle.clear();
      visual.dirty.rangeCircle = false;
    }
  }

  private drawCannonTurret(
    body: Graphics,
    barrel: Graphics,
    size: number,
    colors: {
      primary: number;
      secondary: number;
      glow: number;
      barrel: number;
    },
    rotation: number,
    _barrelCount: number,
    recoilOffset: number = 0,
    energyPulse: number = 0,
  ) {
    const highlight = this.lightenColor(colors.primary, 0.3);
    const shadow = this.darkenColor(colors.primary, 0.3);
    const barrelHighlight = this.lightenColor(colors.barrel, 0.2);
    const barrelShadow = this.darkenColor(colors.barrel, 0.3);

    // Hexagonal base platform (larger) with depth
    const basePoints: number[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 2;
      basePoints.push(
        Math.cos(angle) * size * 0.75,
        Math.sin(angle) * size * 0.75,
      );
    }
    // Shadow layer
    body
      .poly(basePoints.map((v, i) => (i % 2 === 1 ? v + 3 : v)))
      .fill({ color: 0x000000, alpha: 0.3 });
    body
      .poly(basePoints)
      .fill({ color: 0x2a2a3a })
      .stroke({ width: 2, color: colors.primary, alpha: 0.6 });

    // Inner rotating platform with gradient simulation
    body.circle(0, 2, size * 0.6).fill({ color: shadow, alpha: 0.5 });
    body
      .circle(0, 0, size * 0.6)
      .fill({ color: colors.primary })
      .stroke({ width: 2, color: colors.secondary });
    // Highlight arc
    body
      .arc(0, 0, size * 0.55, -Math.PI * 0.8, -Math.PI * 0.2)
      .stroke({ width: 3, color: highlight, alpha: 0.4 });

    // Armored turret housing (main body) with depth
    body.circle(0, 1, size * 0.48).fill({ color: shadow, alpha: 0.4 });
    body
      .circle(0, 0, size * 0.48)
      .fill({ color: colors.secondary })
      .stroke({ width: 2, color: colors.glow, alpha: 0.4 });

    // Center turret core with energy pulse
    const coreGlow = 0.5 + Math.sin(energyPulse) * 0.2;
    body
      .circle(0, 0, size * 0.32)
      .fill({ color: colors.glow, alpha: coreGlow * 0.3 });
    body
      .circle(0, 0, size * 0.3)
      .fill({ color: colors.primary })
      .stroke({ width: 1, color: colors.glow, alpha: 0.5 });
    // Inner core glow
    body
      .circle(0, -size * 0.05, size * 0.15)
      .fill({ color: highlight, alpha: 0.3 });

    // Heavy cannon barrel with recoil
    const barrelLength = size * 1.0;
    const barrelWidth = size * 0.28;
    const recoilY = recoilOffset;

    // Barrel base/housing
    barrel
      .roundRect(
        -barrelWidth * 0.65,
        -size * 0.2 + recoilY,
        barrelWidth * 1.3,
        size * 0.25,
        4,
      )
      .fill({ color: colors.barrel })
      .stroke({ width: 1, color: colors.secondary });

    // Main barrel shadow
    barrel
      .roundRect(
        -barrelWidth / 2 + 2,
        -barrelLength + recoilY + 2,
        barrelWidth,
        barrelLength * 0.85,
        4,
      )
      .fill({ color: barrelShadow, alpha: 0.4 });
    // Main barrel (thick)
    barrel
      .roundRect(
        -barrelWidth / 2,
        -barrelLength + recoilY,
        barrelWidth,
        barrelLength * 0.85,
        4,
      )
      .fill({ color: colors.barrel })
      .stroke({ width: 2, color: colors.secondary });
    // Barrel highlight
    barrel
      .roundRect(
        -barrelWidth / 2 + 2,
        -barrelLength + recoilY + 4,
        barrelWidth * 0.3,
        barrelLength * 0.7,
        2,
      )
      .fill({ color: barrelHighlight, alpha: 0.3 });

    // Barrel reinforcement bands with depth
    barrel
      .roundRect(
        -barrelWidth * 0.6,
        -barrelLength * 0.3 + recoilY,
        barrelWidth * 1.2,
        6,
        2,
      )
      .fill({ color: colors.secondary });
    barrel
      .roundRect(
        -barrelWidth * 0.55,
        -barrelLength * 0.55 + recoilY,
        barrelWidth * 1.1,
        5,
        2,
      )
      .fill({ color: colors.secondary });

    // Heavy muzzle brake with glow
    barrel
      .roundRect(
        -barrelWidth * 0.7,
        -barrelLength - 6 + recoilY,
        barrelWidth * 1.4,
        10,
        3,
      )
      .fill({ color: 0x333344 })
      .stroke({ width: 2, color: colors.glow, alpha: 0.5 });
    // Muzzle glow ring
    barrel
      .circle(0, -barrelLength - 1 + recoilY, barrelWidth * 0.35)
      .stroke({
        width: 2,
        color: colors.glow,
        alpha: 0.4 + Math.sin(energyPulse * 2) * 0.2,
      });

    // Muzzle vents (decorative)
    barrel
      .roundRect(
        -barrelWidth * 0.8,
        -barrelLength + 4 + recoilY,
        barrelWidth * 0.25,
        3,
        1,
      )
      .fill({ color: 0x222233 });
    barrel
      .roundRect(
        barrelWidth * 0.55,
        -barrelLength + 4 + recoilY,
        barrelWidth * 0.25,
        3,
        1,
      )
      .fill({ color: 0x222233 });

    barrel.rotation = rotation;
  }

  private drawTowerTurret(
    body: Graphics,
    barrel: Graphics,
    size: number,
    colors: {
      primary: number;
      secondary: number;
      glow: number;
      barrel: number;
    },
    rotation: number,
    recoilOffset: number = 0,
    energyPulse: number = 0,
  ) {
    const highlight = this.lightenColor(colors.primary, 0.3);
    const shadow = this.darkenColor(colors.primary, 0.3);
    const barrelHighlight = this.lightenColor(colors.barrel, 0.2);
    const barrelShadow = this.darkenColor(colors.barrel, 0.3);

    // Wide base platform shadow
    body
      .roundRect(-size * 0.55 + 2, size * 0.1 + 3, size * 1.1, size * 0.35, 6)
      .fill({ color: 0x000000, alpha: 0.3 });
    // Wide base platform
    body
      .roundRect(-size * 0.55, size * 0.1, size * 1.1, size * 0.35, 6)
      .fill({ color: 0x2a2a3a })
      .stroke({ width: 2, color: colors.primary, alpha: 0.6 });
    // Base highlight
    body
      .roundRect(-size * 0.5, size * 0.13, size * 0.4, size * 0.08, 2)
      .fill({ color: 0x3a3a4a, alpha: 0.5 });

    // Tower body shadow
    const towerShadowPoints = [
      -size * 0.45 + 2,
      size * 0.15 + 3,
      -size * 0.32 + 2,
      -size * 0.4 + 3,
      size * 0.32 + 2,
      -size * 0.4 + 3,
      size * 0.45 + 2,
      size * 0.15 + 3,
    ];
    body.poly(towerShadowPoints).fill({ color: 0x000000, alpha: 0.25 });

    // Tower body (wider, more solid trapezoid)
    const towerPoints = [
      -size * 0.45,
      size * 0.15,
      -size * 0.32,
      -size * 0.4,
      size * 0.32,
      -size * 0.4,
      size * 0.45,
      size * 0.15,
    ];
    body
      .poly(towerPoints)
      .fill({ color: colors.primary })
      .stroke({ width: 2, color: colors.secondary });

    // Tower highlight (left edge)
    body
      .moveTo(-size * 0.43, size * 0.1)
      .lineTo(-size * 0.31, -size * 0.35)
      .stroke({ width: 3, color: highlight, alpha: 0.35 });

    // Middle detail band with depth
    body
      .roundRect(-size * 0.38, -size * 0.15, size * 0.76, size * 0.12, 2)
      .fill({ color: shadow, alpha: 0.6 });
    body
      .roundRect(-size * 0.36, -size * 0.14, size * 0.72, size * 0.1, 2)
      .fill({ color: colors.secondary, alpha: 0.4 });

    // Top rotating turret head shadow
    body
      .circle(0, -size * 0.38, size * 0.36)
      .fill({ color: shadow, alpha: 0.4 });
    // Top rotating turret head (larger) with energy glow
    const headGlow = 0.6 + Math.sin(energyPulse) * 0.15;
    body
      .circle(0, -size * 0.4, size * 0.38)
      .fill({ color: colors.glow, alpha: headGlow * 0.15 });
    body
      .circle(0, -size * 0.4, size * 0.36)
      .fill({ color: colors.secondary })
      .stroke({ width: 2, color: colors.glow, alpha: 0.6 });

    // Inner turret detail with depth
    body
      .circle(0, -size * 0.4, size * 0.24)
      .fill({ color: shadow, alpha: 0.3 });
    body
      .circle(0, -size * 0.4, size * 0.22)
      .fill({ color: colors.primary })
      .stroke({ width: 1, color: colors.glow, alpha: 0.4 });
    // Inner highlight
    body
      .circle(-size * 0.06, -size * 0.46, size * 0.08)
      .fill({ color: highlight, alpha: 0.25 });

    // Barrel with recoil
    const barrelLength = size * 1.1;
    const barrelWidth = size * 0.18;
    const recoilY = recoilOffset;

    // Barrel base shadow
    barrel
      .roundRect(
        -barrelWidth * 0.7 + 1,
        -size * 0.15 + recoilY + 1,
        barrelWidth * 1.4,
        size * 0.18,
        2,
      )
      .fill({ color: barrelShadow, alpha: 0.4 });
    // Barrel base (where it connects to turret head)
    barrel
      .roundRect(
        -barrelWidth * 0.7,
        -size * 0.15 + recoilY,
        barrelWidth * 1.4,
        size * 0.18,
        2,
      )
      .fill({ color: colors.barrel })
      .stroke({ width: 1, color: colors.secondary });

    // Main barrel shadow
    barrel
      .roundRect(
        -barrelWidth / 2 + 1,
        -barrelLength + recoilY + 1,
        barrelWidth,
        barrelLength * 0.85,
        3,
      )
      .fill({ color: barrelShadow, alpha: 0.4 });
    // Main barrel
    barrel
      .roundRect(
        -barrelWidth / 2,
        -barrelLength + recoilY,
        barrelWidth,
        barrelLength * 0.85,
        3,
      )
      .fill({ color: colors.barrel })
      .stroke({ width: 1, color: colors.secondary });
    // Barrel highlight
    barrel
      .roundRect(
        -barrelWidth / 2 + 1,
        -barrelLength + recoilY + 3,
        barrelWidth * 0.25,
        barrelLength * 0.7,
        2,
      )
      .fill({ color: barrelHighlight, alpha: 0.25 });

    // Barrel reinforcement rings with metallic look
    barrel
      .roundRect(
        -barrelWidth * 0.65,
        -barrelLength * 0.35 + recoilY,
        barrelWidth * 1.3,
        5,
        2,
      )
      .fill({ color: colors.secondary });
    barrel
      .roundRect(
        -barrelWidth * 0.6,
        -barrelLength * 0.65 + recoilY,
        barrelWidth * 1.2,
        4,
        2,
      )
      .fill({ color: colors.secondary });

    // Muzzle tip with glow
    barrel
      .roundRect(
        -barrelWidth * 0.55,
        -barrelLength - 3 + recoilY,
        barrelWidth * 1.1,
        6,
        2,
      )
      .fill({ color: 0x333344 })
      .stroke({ width: 1, color: colors.glow, alpha: 0.5 });
    // Muzzle inner glow
    barrel
      .circle(0, -barrelLength + recoilY, barrelWidth * 0.3)
      .fill({
        color: colors.glow,
        alpha: 0.3 + Math.sin(energyPulse * 2) * 0.15,
      });

    barrel.rotation = rotation;
  }

  private drawDomeTurret(
    body: Graphics,
    barrel: Graphics,
    size: number,
    colors: {
      primary: number;
      secondary: number;
      glow: number;
      barrel: number;
    },
    rotation: number,
    hasBarrel: boolean,
    recoilOffset: number = 0,
    energyPulse: number = 0,
  ) {
    const highlight = this.lightenColor(colors.primary, 0.3);
    const shadow = this.darkenColor(colors.primary, 0.3);

    // Wide circular base platform shadow
    body
      .ellipse(2, size * 0.25 + 3, size * 0.7, size * 0.25)
      .fill({ color: 0x000000, alpha: 0.25 });
    // Wide circular base platform
    body
      .ellipse(0, size * 0.25, size * 0.7, size * 0.25)
      .fill({ color: 0x2a2a3a })
      .stroke({ width: 2, color: colors.primary, alpha: 0.6 });

    // Base ring shadow
    body
      .ellipse(1, size * 0.17, size * 0.6, size * 0.2)
      .fill({ color: shadow, alpha: 0.4 });
    // Base ring
    body
      .ellipse(0, size * 0.15, size * 0.6, size * 0.2)
      .fill({ color: colors.primary })
      .stroke({ width: 2, color: colors.secondary });

    // Main dome body shadow
    body
      .ellipse(2, -size * 0.03, size * 0.55, size * 0.45)
      .fill({ color: shadow, alpha: 0.3 });
    // Main dome body (taller, more spherical)
    body
      .ellipse(0, -size * 0.05, size * 0.55, size * 0.45)
      .fill({ color: colors.primary })
      .stroke({ width: 2, color: colors.secondary });

    // Dome highlight arc (upper left)
    body
      .arc(
        -size * 0.15,
        -size * 0.15,
        size * 0.4,
        -Math.PI * 0.9,
        -Math.PI * 0.4,
      )
      .stroke({ width: 4, color: highlight, alpha: 0.25 });

    // Upper dome layer (highlight) with energy pulse
    const domeGlow = 0.85 + Math.sin(energyPulse) * 0.1;
    body
      .ellipse(0, -size * 0.15, size * 0.45, size * 0.38)
      .fill({ color: colors.secondary, alpha: domeGlow })
      .stroke({ width: 1, color: colors.glow, alpha: 0.4 });

    // Dome cap with pulsing glow
    const capGlow = 0.25 + Math.sin(energyPulse * 1.5) * 0.1;
    body
      .ellipse(0, -size * 0.3, size * 0.34, size * 0.3)
      .fill({ color: colors.glow, alpha: capGlow * 0.5 });
    body
      .ellipse(0, -size * 0.3, size * 0.32, size * 0.28)
      .fill({ color: colors.glow, alpha: capGlow });

    // Inner energy core (glowing) with pulsing
    const coreGlow = 0.5 + Math.sin(energyPulse * 2) * 0.2;
    body
      .circle(0, -size * 0.2, size * 0.22)
      .fill({ color: colors.glow, alpha: coreGlow * 0.3 });
    body
      .circle(0, -size * 0.2, size * 0.18)
      .fill({ color: colors.glow, alpha: coreGlow });
    body
      .circle(0, -size * 0.2, size * 0.12)
      .fill({ color: 0xffffff, alpha: coreGlow * 0.8 });
    body
      .circle(0, -size * 0.22, size * 0.06)
      .fill({ color: 0xffffff, alpha: 0.9 });

    // Decorative panels around dome base with depth
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI / 4) * i;
      const px = Math.cos(angle) * size * 0.5;
      const py = Math.sin(angle) * size * 0.18 + size * 0.08;
      // Panel shadow
      body
        .circle(px + 1, py + 1, size * 0.06)
        .fill({ color: 0x000000, alpha: 0.3 });
      // Panel
      body
        .circle(px, py, size * 0.06)
        .fill({ color: colors.secondary, alpha: 0.6 })
        .stroke({ width: 1, color: colors.glow, alpha: 0.4 });
      // Panel highlight
      body
        .circle(px - 1, py - 1, size * 0.025)
        .fill({ color: highlight, alpha: 0.3 });
    }

    // Frost/ice particles effect (for frost dome specifically)
    for (let i = 0; i < 4; i++) {
      const angle = energyPulse + (i * Math.PI) / 2;
      const dist = size * 0.35;
      const px = Math.cos(angle) * dist;
      const py = -size * 0.2 + Math.sin(angle) * dist * 0.5;
      body
        .circle(px, py, size * 0.03)
        .fill({
          color: colors.glow,
          alpha: 0.4 + Math.sin(energyPulse * 3 + i) * 0.2,
        });
    }

    if (hasBarrel) {
      const recoilY = recoilOffset;

      // Emitter housing shadow
      barrel
        .roundRect(
          -size * 0.14 + 1,
          -size * 0.5 + recoilY + 1,
          size * 0.28,
          size * 0.22,
          4,
        )
        .fill({ color: shadow, alpha: 0.4 });
      // Emitter housing
      barrel
        .roundRect(
          -size * 0.14,
          -size * 0.5 + recoilY,
          size * 0.28,
          size * 0.22,
          4,
        )
        .fill({ color: colors.barrel })
        .stroke({ width: 1, color: colors.glow, alpha: 0.6 });

      // Emitter nozzle outer glow
      const nozzleGlow = 0.8 + Math.sin(energyPulse * 2) * 0.2;
      barrel
        .circle(0, -size * 0.55 + recoilY, size * 0.14)
        .fill({ color: colors.glow, alpha: nozzleGlow * 0.2 });
      // Emitter nozzle
      barrel
        .circle(0, -size * 0.55 + recoilY, size * 0.1)
        .fill({ color: colors.secondary })
        .stroke({ width: 2, color: colors.glow, alpha: nozzleGlow });

      // Glowing emitter core
      barrel
        .circle(0, -size * 0.55 + recoilY, size * 0.06)
        .fill({ color: colors.glow, alpha: 0.9 });
      barrel
        .circle(0, -size * 0.55 + recoilY, size * 0.03)
        .fill({ color: 0xffffff, alpha: 0.95 });

      barrel.rotation = rotation;
    }
  }

  private drawTeslaTurret(
    body: Graphics,
    size: number,
    colors: {
      primary: number;
      secondary: number;
      glow: number;
      barrel: number;
    },
    time: number,
    energyPulse: number = 0,
  ) {
    const highlight = this.lightenColor(colors.primary, 0.3);
    const shadow = this.darkenColor(colors.primary, 0.3);
    const barrelHighlight = this.lightenColor(colors.barrel, 0.2);

    // Wide octagonal base platform shadow
    const baseShadowPoints: number[] = [];
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI / 4) * i - Math.PI / 8;
      baseShadowPoints.push(
        Math.cos(angle) * size * 0.7 + 2,
        Math.sin(angle) * size * 0.28 + size * 0.22 + 3,
      );
    }
    body.poly(baseShadowPoints).fill({ color: 0x000000, alpha: 0.25 });

    // Wide octagonal base platform
    const basePoints: number[] = [];
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI / 4) * i - Math.PI / 8;
      basePoints.push(
        Math.cos(angle) * size * 0.7,
        Math.sin(angle) * size * 0.28 + size * 0.22,
      );
    }
    body
      .poly(basePoints)
      .fill({ color: 0x2a2a3a })
      .stroke({ width: 2, color: colors.primary, alpha: 0.6 });

    // Lower base ring shadow
    body
      .ellipse(1, size * 0.2, size * 0.55, size * 0.18)
      .fill({ color: shadow, alpha: 0.4 });
    // Lower base ring
    body
      .ellipse(0, size * 0.18, size * 0.55, size * 0.18)
      .fill({ color: colors.primary })
      .stroke({ width: 2, color: colors.secondary });

    // Coil base housing shadow
    body
      .ellipse(1, size * 0.1, size * 0.45, size * 0.15)
      .fill({ color: shadow, alpha: 0.4 });
    // Coil base housing (wider)
    body
      .ellipse(0, size * 0.08, size * 0.45, size * 0.15)
      .fill({ color: colors.secondary })
      .stroke({ width: 1, color: colors.glow, alpha: 0.4 });

    // Tesla coil pillar shadow
    const pillarShadowPoints = [
      -size * 0.28 + 2,
      size * 0.08 + 2,
      -size * 0.18 + 2,
      -size * 0.55 + 2,
      size * 0.18 + 2,
      -size * 0.55 + 2,
      size * 0.28 + 2,
      size * 0.08 + 2,
    ];
    body.poly(pillarShadowPoints).fill({ color: 0x000000, alpha: 0.25 });

    // Tesla coil pillar (wider, more solid)
    const pillarPoints = [
      -size * 0.28,
      size * 0.08,
      -size * 0.18,
      -size * 0.55,
      size * 0.18,
      -size * 0.55,
      size * 0.28,
      size * 0.08,
    ];
    body
      .poly(pillarPoints)
      .fill({ color: colors.barrel })
      .stroke({ width: 2, color: colors.secondary });

    // Pillar highlight (left edge)
    body
      .moveTo(-size * 0.26, size * 0.05)
      .lineTo(-size * 0.17, -size * 0.5)
      .stroke({ width: 2, color: barrelHighlight, alpha: 0.3 });

    // Coil windings along pillar (more prominent) with energy pulse
    for (let i = 0; i < 5; i++) {
      const y = -size * 0.05 - i * size * 0.11;
      const ringWidth = size * 0.32 - i * 0.025;
      const coilGlow = 0.3 + Math.sin(energyPulse * 2 + i * 0.5) * 0.15;
      // Coil shadow
      body
        .ellipse(1, y + 1, ringWidth, size * 0.06)
        .fill({ color: shadow, alpha: 0.3 });
      // Coil
      body
        .ellipse(0, y, ringWidth, size * 0.06)
        .fill({ color: colors.secondary, alpha: 0.8 })
        .stroke({ width: 1, color: colors.glow, alpha: coilGlow });
    }

    // Upper coil housing
    body
      .ellipse(0, -size * 0.55, size * 0.22, size * 0.08)
      .fill({ color: colors.secondary });

    // Tesla coil top sphere glow layers (pulsing)
    const sphereGlow = 0.8 + Math.sin(energyPulse * 1.5) * 0.2;
    body
      .circle(0, -size * 0.7, size * 0.32)
      .fill({ color: colors.glow, alpha: sphereGlow * 0.15 });
    // Tesla coil top sphere shadow
    body
      .circle(1, -size * 0.69, size * 0.26)
      .fill({ color: shadow, alpha: 0.3 });
    // Tesla coil top sphere (larger, more prominent)
    body
      .circle(0, -size * 0.7, size * 0.26)
      .fill({ color: colors.secondary })
      .stroke({ width: 3, color: colors.glow, alpha: sphereGlow });

    // Sphere highlight
    body
      .arc(
        -size * 0.08,
        -size * 0.78,
        size * 0.12,
        -Math.PI * 0.9,
        -Math.PI * 0.3,
      )
      .stroke({ width: 3, color: highlight, alpha: 0.3 });

    // Inner sphere glow layers (pulsing)
    const innerGlow = 0.4 + Math.sin(energyPulse * 2) * 0.2;
    body
      .circle(0, -size * 0.7, size * 0.18)
      .fill({ color: colors.glow, alpha: innerGlow });
    body
      .circle(0, -size * 0.7, size * 0.12)
      .fill({ color: colors.glow, alpha: innerGlow * 1.5 });
    body
      .circle(0, -size * 0.7, size * 0.06)
      .fill({ color: 0xffffff, alpha: 0.9 });
    body
      .circle(-size * 0.03, -size * 0.73, size * 0.025)
      .fill({ color: 0xffffff, alpha: 0.95 });

    // Electric arcs (animated) - more dramatic
    const arcCount = 8;
    for (let i = 0; i < arcCount; i++) {
      const baseAngle = (i * Math.PI * 2) / arcCount;
      const angle = baseAngle + Math.sin(time * 4 + i * 1.5) * 0.4;
      const arcLength = size * 0.5 + Math.sin(time * 8 + i * 2) * size * 0.15;

      const startX = 0;
      const startY = -size * 0.7;
      const endX = Math.cos(angle) * arcLength;
      const endY = -size * 0.7 + Math.sin(angle) * arcLength * 0.5;

      // Outer glow for arc
      body
        .moveTo(startX, startY)
        .lineTo(endX, endY)
        .stroke({ width: 6, color: colors.glow, alpha: 0.15 });

      // Jagged lightning with multiple segments
      const mid1X =
        startX + (endX - startX) * 0.33 + Math.sin(time * 12 + i) * size * 0.1;
      const mid1Y =
        startY + (endY - startY) * 0.33 + Math.cos(time * 10 + i) * size * 0.08;
      const mid2X =
        startX + (endX - startX) * 0.66 + Math.cos(time * 14 + i) * size * 0.1;
      const mid2Y =
        startY + (endY - startY) * 0.66 + Math.sin(time * 11 + i) * size * 0.08;

      // Main arc
      body
        .moveTo(startX, startY)
        .lineTo(mid1X, mid1Y)
        .lineTo(mid2X, mid2Y)
        .lineTo(endX, endY)
        .stroke({ width: 2, color: colors.glow, alpha: 0.85 });

      // Secondary branch (random)
      if (i % 2 === 0) {
        const branchX = mid1X + Math.cos(angle + Math.PI / 3) * size * 0.15;
        const branchY = mid1Y + Math.sin(angle + Math.PI / 3) * size * 0.1;
        body
          .moveTo(mid1X, mid1Y)
          .lineTo(branchX, branchY)
          .stroke({ width: 1.5, color: colors.glow, alpha: 0.6 });
      }

      // Glow at arc end
      body.circle(endX, endY, 5).fill({ color: colors.glow, alpha: 0.5 });
      body.circle(endX, endY, 3).fill({ color: 0xffffff, alpha: 0.7 });
    }

    // Ground crackling effect (sparks at base)
    for (let i = 0; i < 4; i++) {
      const sparkAngle = time * 3 + (i * Math.PI) / 2;
      const sparkX = Math.cos(sparkAngle) * size * 0.4;
      const sparkY = size * 0.15 + Math.sin(sparkAngle * 2) * size * 0.05;
      body
        .circle(sparkX, sparkY, 2 + Math.sin(time * 10 + i) * 1)
        .fill({
          color: colors.glow,
          alpha: 0.4 + Math.sin(time * 8 + i * 2) * 0.3,
        });
    }
  }

  private drawTierBadge(
    g: Graphics,
    tier: 1 | 2 | 3,
    colors: {
      primary: number;
      secondary: number;
      glow: number;
      barrel: number;
    },
  ) {
    const tierColors = {
      1: { base: 0xcd7f32, highlight: 0xe8a050, shadow: 0x8b5a2b }, // Bronze
      2: { base: 0xc0c0c0, highlight: 0xe8e8e8, shadow: 0x808080 }, // Silver
      3: { base: 0xffd700, highlight: 0xffec80, shadow: 0xb8860b }, // Gold
    };

    const tierColor = tierColors[tier];
    const badgeSize = 10;

    // Outer glow (class-colored)
    g.circle(0, 0, badgeSize + 3).fill({ color: colors.glow, alpha: 0.3 });

    // Shadow
    g.circle(1, 1, badgeSize).fill({ color: tierColor.shadow, alpha: 0.5 });

    // Main badge
    g.circle(0, 0, badgeSize)
      .fill({ color: tierColor.base })
      .stroke({ width: 1.5, color: tierColor.highlight, alpha: 0.8 });

    // Inner highlight (metallic effect)
    g.arc(
      -badgeSize * 0.3,
      -badgeSize * 0.3,
      badgeSize * 0.6,
      -Math.PI,
      -Math.PI * 0.3,
    ).stroke({ width: 2, color: tierColor.highlight, alpha: 0.5 });

    // Inner shadow
    g.arc(
      badgeSize * 0.2,
      badgeSize * 0.2,
      badgeSize * 0.5,
      0,
      Math.PI * 0.7,
    ).stroke({ width: 1.5, color: tierColor.shadow, alpha: 0.4 });

    // Tier stars/dots with glow
    const starSpacing = tier === 1 ? 0 : 3.5;
    const startX = (-(tier - 1) * starSpacing) / 2;

    for (let i = 0; i < tier; i++) {
      const x = startX + i * starSpacing;
      // Star glow
      g.circle(x, 0, 2.5).fill({ color: 0xffffff, alpha: 0.5 });
      // Star
      g.circle(x, 0, 1.8).fill({ color: 0xffffff });
    }
  }

  private findTargetAngle(
    turretX: number,
    enemies: Enemy[],
    viewWidth: number,
  ): number | null {
    if (enemies.length === 0) return null;

    // Find nearest enemy
    let nearest = enemies[0];
    let nearestDist = Infinity;

    for (const enemy of enemies) {
      const enemyScreenX = fpXToScreen(enemy.x, viewWidth);
      const dist = Math.abs(enemyScreenX - turretX);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = enemy;
      }
    }

    // Calculate angle to enemy (pointing right = 0, up = -PI/2)
    const enemyScreenX = fpXToScreen(nearest.x, viewWidth);
    const dx = enemyScreenX - turretX;
    // Assume enemies are roughly at same Y for simplicity
    return Math.atan2(0, dx) + Math.PI / 2;
  }

  private drawRangeCircle(
    rangeCircle: Graphics,
    turret: ActiveTurret,
    viewWidth: number,
  ): void {
    // Get turret definition to access base stats
    const turretDef = getTurretById(turret.definitionId as any);
    if (!turretDef) return;

    // Calculate turret stats with class and tier modifiers
    const stats = calculateTurretStats(
      turretDef,
      turret.currentClass,
      turret.tier,
    );

    // Convert range from fixed-point (16384 = 1.0) to game units
    const rangeInUnits = stats.range / 16384;

    // Convert game units to screen pixels
    const rangeInPixels = (rangeInUnits / FIELD_WIDTH) * viewWidth;

    // Get turret-specific or class color for the range circle
    const turretTypeColors = TURRET_TYPE_COLORS[turret.definitionId];
    const colors = turretTypeColors || CLASS_COLORS[turret.currentClass];

    // Draw gradient-like range circles (multiple rings fading out)
    const rings = 4;
    for (let i = rings - 1; i >= 0; i--) {
      const ringRadius = rangeInPixels * ((i + 1) / rings);
      const ringAlpha = 0.08 * (1 - i / rings);
      rangeCircle
        .circle(0, 0, ringRadius)
        .fill({ color: colors.primary, alpha: ringAlpha });
    }

    // Inner glow ring
    rangeCircle
      .circle(0, 0, rangeInPixels * 0.15)
      .fill({ color: colors.glow, alpha: 0.1 });

    // Outer border with glow
    rangeCircle
      .circle(0, 0, rangeInPixels + 2)
      .stroke({ width: 3, color: colors.glow, alpha: 0.15 });
    rangeCircle
      .circle(0, 0, rangeInPixels)
      .stroke({ width: 2, color: colors.glow, alpha: 0.4 });

    // Dashed inner ring for visual interest
    const dashCount = 24;
    for (let i = 0; i < dashCount; i++) {
      const startAngle = (i / dashCount) * Math.PI * 2;
      const endAngle = ((i + 0.5) / dashCount) * Math.PI * 2;
      rangeCircle
        .arc(0, 0, rangeInPixels * 0.7, startAngle, endAngle)
        .stroke({ width: 1, color: colors.secondary, alpha: 0.2 });
    }
  }

  /**
   * Recreate all slots and turrets (called on resize to ensure fresh Graphics context)
   */
  private recreateAllSlotsAndTurrets(
    _slots: TurretSlot[],
    _turrets: ActiveTurret[],
  ) {
    // CRITICAL: Destroy all Graphics objects BEFORE removing from parent
    // This ensures all WebGPU/WebGL resources are properly released
    for (const [_slotIndex, visual] of this.slotVisuals) {
      // Destroy all Graphics children first
      for (const child of visual.children) {
        if (child instanceof Graphics) {
          child.destroy({ children: true });
        }
      }
      // Then remove and destroy container
      this.container.removeChild(visual);
      visual.destroy({ children: true });
    }
    this.slotVisuals.clear();

    // Clear all existing turret visuals
    for (const [_slotIndex, visual] of this.turretVisuals) {
      // Destroy all Graphics children first
      for (const child of visual.container.children) {
        if (child instanceof Graphics) {
          child.destroy({ children: true });
        }
      }
      this.container.removeChild(visual.container);
      visual.container.destroy({ children: true });
    }
    this.turretVisuals.clear();

    // Next update() will recreate them all
  }

  // --- Color manipulation helpers ---

  /**
   * Lighten a color by a factor (0-1)
   */
  private lightenColor(color: number, factor: number): number {
    const r = Math.min(255, ((color >> 16) & 0xff) + 255 * factor);
    const g = Math.min(255, ((color >> 8) & 0xff) + 255 * factor);
    const b = Math.min(255, (color & 0xff) + 255 * factor);
    return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
  }

  /**
   * Darken a color by a factor (0-1)
   */
  private darkenColor(color: number, factor: number): number {
    const r = ((color >> 16) & 0xff) * (1 - factor);
    const g = ((color >> 8) & 0xff) * (1 - factor);
    const b = (color & 0xff) * (1 - factor);
    return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
  }

  /**
   * Clear all turret visuals - used when transitioning between scenes
   */
  public clearAll(): void {
    // Clear slot visuals
    for (const visual of this.slotVisuals.values()) {
      this.container.removeChild(visual);
      visual.destroy({ children: true });
    }
    this.slotVisuals.clear();

    // Clear turret visuals
    for (const visual of this.turretVisuals.values()) {
      this.container.removeChild(visual.container);
      visual.container.destroy({ children: true });
    }
    this.turretVisuals.clear();
  }
}
