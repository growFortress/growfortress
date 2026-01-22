import { Container, Graphics, type FederatedPointerEvent } from "pixi.js";
import type { ActiveHero } from "@arcade/sim-core";
import { FP } from "@arcade/sim-core";
import {
  fpXToScreen,
  fpYToScreen,
  screenXToGameUnit,
  screenYToGameUnit,
} from "../../CoordinateSystem.js";

const HERO_PICK_BASE_RADIUS = 28;
const HERO_TIER_RADIUS_MULTIPLIER: Record<1 | 2 | 3, number> = {
  1: 1.0,
  2: 1.15,
  3: 1.3,
};
const DRAG_START_DISTANCE = 8;
const DRAG_INDICATOR_RADIUS = 18;
const DRAG_INDICATOR_COLOR = 0x00ffff;
const AIM_INDICATOR_RADIUS = 14;
const AIM_INDICATOR_COLOR = 0x00f5ff;

interface HeroDragTarget {
  id: string;
  x: number;
  y: number;
  radius: number;
}

/**
 * SceneInputController handles all input-related functionality for the game scene:
 * - Interactive layer management
 * - Field click detection and world coordinate conversion
 * - Event mode toggling (gameplay vs hub mode)
 */
export class SceneInputController {
  public readonly container: Container;
  private interactiveLayer: Graphics;
  private dragIndicator: Graphics;
  private aimIndicator: Graphics;

  private width = 0;
  private height = 0;

  // Click callback for tactical commands
  private onFieldClickCallback: ((worldX: number, worldY: number) => void) | null = null;
  private onFieldRightClickCallback: ((worldX: number, worldY: number) => void) | null = null;
  private onHeroClickCallback: ((heroId: string) => void) | null = null;
  private onHeroDragCallback: ((heroId: string, worldX: number, worldY: number) => void) | null = null;
  private heroTargets: HeroDragTarget[] = [];
  private draggingHeroId: string | null = null;
  private draggingPointerId: number | null = null;
  private dragStart: { x: number; y: number } | null = null;
  private dragMoved = false;
  private aimActive = false;
  private aimPosition = { x: 0, y: 0 };

  constructor() {
    this.container = new Container();

    // Interactive layer for click detection
    this.interactiveLayer = this.createInteractiveLayer();
    this.container.addChild(this.interactiveLayer);

    this.dragIndicator = this.createDragIndicator();
    this.container.addChild(this.dragIndicator);

    this.aimIndicator = this.createAimIndicator();
    this.container.addChild(this.aimIndicator);
  }

  /**
   * Handle resize - recreates interactive layer.
   */
  public onResize(width: number, height: number): void {
    this.width = width;
    this.height = height;

    // Recreate interactive layer to ensure valid context
    if (this.interactiveLayer) {
      this.interactiveLayer.removeAllListeners();
      this.interactiveLayer.parent?.removeChild(this.interactiveLayer);
      this.interactiveLayer.destroy();
    }
    this.interactiveLayer = this.createInteractiveLayer();
    this.container.addChild(this.interactiveLayer);
    this.ensureIndicatorOrder();
    this.resetDragState();

    // Update interactive layer hit area
    try {
      this.interactiveLayer.rect(0, 0, width, height).fill({ color: 0x000000, alpha: 0 });
    } catch (e) {
      console.warn("Failed to draw interactive layer:", e);
    }
  }

  /**
   * Set callback for field click events (tactical commands).
   */
  public setOnFieldClick(callback: ((worldX: number, worldY: number) => void) | null): void {
    this.onFieldClickCallback = callback;
  }

  /**
   * Set callback for field right click events (manual attack).
   */
  public setOnFieldRightClick(
    callback: ((worldX: number, worldY: number) => void) | null,
  ): void {
    this.onFieldRightClickCallback = callback;
  }

  /**
   * Set callback for hero click events (tactical selection).
   */
  public setOnHeroClick(callback: ((heroId: string) => void) | null): void {
    this.onHeroClickCallback = callback;
  }

  /**
   * Set callback for hero drag events (tactical hero repositioning).
   */
  public setOnHeroDrag(
    callback: ((heroId: string, worldX: number, worldY: number) => void) | null,
  ): void {
    this.onHeroDragCallback = callback;
  }

  /**
   * Update cached hero screen positions for drag hit testing.
   */
  public updateHeroTargets(
    heroes: ActiveHero[],
    viewWidth: number,
    viewHeight: number,
    alpha: number,
  ): void {
    if (viewWidth === 0 || viewHeight === 0) {
      this.heroTargets = [];
      return;
    }

    const clampedAlpha = Math.max(0, Math.min(1, alpha));
    this.heroTargets = heroes.map((hero) => {
      const position = this.getInterpolatedPosition(hero, clampedAlpha);
      const tierKey = this.getTierKey(hero.tier);
      const radius = HERO_PICK_BASE_RADIUS * HERO_TIER_RADIUS_MULTIPLIER[tierKey];
      return {
        id: hero.definitionId,
        x: fpXToScreen(position.x, viewWidth),
        y: fpYToScreen(position.y, viewHeight),
        radius,
      };
    });
  }

  public clearHeroTargets(): void {
    this.heroTargets = [];
  }

  public setManualAimActive(active: boolean): void {
    if (this.aimActive === active) return;
    this.aimActive = active;
    this.aimIndicator.visible = active;
    if (active) {
      this.aimIndicator.position.set(this.aimPosition.x, this.aimPosition.y);
    }
    this.updateCursor();
  }

  /**
   * Enable interactive layer for gameplay mode.
   */
  public enableInteraction(): void {
    this.interactiveLayer.eventMode = "static";
  }

  /**
   * Disable interactive layer (e.g., for hub mode so heroes can be clicked).
   */
  public disableInteraction(): void {
    this.interactiveLayer.eventMode = "none";
    this.resetDragState();
  }

  /**
   * Handle pointer down for tactical commands and hero dragging.
   */
  private handlePointerDown(event: FederatedPointerEvent): void {
    if (this.width === 0 || this.height === 0) return;

    const localX = event.global.x;
    const localY = event.global.y;
    const isRightClick = event.button === 2 || (event.buttons & 2) === 2;

    if (isRightClick && this.onFieldRightClickCallback) {
      this.updateAimIndicator(localX, localY);
      this.handleFieldRightClickAt(localX, localY);
      return;
    }

    const heroTarget = this.onHeroDragCallback || this.onHeroClickCallback
      ? this.findHeroTarget(localX, localY)
      : null;
    if (heroTarget) {
      this.draggingHeroId = heroTarget.id;
      this.draggingPointerId = event.pointerId ?? null;
      this.dragStart = { x: localX, y: localY };
      this.dragMoved = false;
      this.updateCursor();
      return;
    }

    this.handleFieldClickAt(localX, localY);
  }

  private handlePointerMove(event: FederatedPointerEvent): void {
    this.updateAimIndicator(event.global.x, event.global.y);
    if (!this.draggingHeroId || !this.dragStart) {
      return;
    }
    if (this.draggingPointerId !== null && event.pointerId !== this.draggingPointerId) {
      return;
    }

    const dx = event.global.x - this.dragStart.x;
    const dy = event.global.y - this.dragStart.y;
    if (!this.dragMoved && Math.hypot(dx, dy) >= DRAG_START_DISTANCE) {
      this.dragMoved = true;
      if (this.onHeroDragCallback) {
        this.updateDragIndicator(event.global.x, event.global.y);
      }
      return;
    }

    if (this.dragMoved && this.onHeroDragCallback) {
      this.updateDragIndicator(event.global.x, event.global.y);
    }
  }

  private handlePointerUp(event: FederatedPointerEvent): void {
    if (!this.draggingHeroId) {
      return;
    }
    if (this.draggingPointerId !== null && event.pointerId !== this.draggingPointerId) {
      return;
    }

    const localX = event.global.x;
    const localY = event.global.y;
    const heroId = this.draggingHeroId;
    const wasDragged = this.dragMoved;
    this.resetDragState();

    if (wasDragged) {
      if (this.onHeroDragCallback) {
        this.handleHeroDrag(heroId, localX, localY);
      }
      return;
    }

    if (this.onHeroClickCallback) {
      this.onHeroClickCallback(heroId);
      return;
    }

    this.handleFieldClickAt(localX, localY);
  }

  private handleFieldClickAt(localX: number, localY: number): void {
    if (!this.onFieldClickCallback) return;
    if (this.width === 0 || this.height === 0) return;

    // Convert screen coordinates to local container coordinates
    // Convert to world coordinates
    const worldX = screenXToGameUnit(localX, this.width);
    const worldY = screenYToGameUnit(localY, this.height);

    this.onFieldClickCallback(worldX, worldY);
  }

  private handleFieldRightClickAt(localX: number, localY: number): void {
    if (!this.onFieldRightClickCallback) return;
    if (this.width === 0 || this.height === 0) return;

    const worldX = screenXToGameUnit(localX, this.width);
    const worldY = screenYToGameUnit(localY, this.height);
    this.onFieldRightClickCallback(worldX, worldY);
  }

  private handleHeroDrag(heroId: string, localX: number, localY: number): void {
    if (!this.onHeroDragCallback) return;
    if (this.width === 0 || this.height === 0) return;

    const worldX = screenXToGameUnit(localX, this.width);
    const worldY = screenYToGameUnit(localY, this.height);
    this.onHeroDragCallback(heroId, worldX, worldY);
  }

  private findHeroTarget(x: number, y: number): HeroDragTarget | null {
    if (this.heroTargets.length === 0) return null;
    let closest: HeroDragTarget | null = null;
    let closestDistSq = Infinity;

    for (const target of this.heroTargets) {
      const dx = x - target.x;
      const dy = y - target.y;
      const distSq = dx * dx + dy * dy;
      const radiusSq = target.radius * target.radius;
      if (distSq <= radiusSq && distSq < closestDistSq) {
        closest = target;
        closestDistSq = distSq;
      }
    }

    return closest;
  }

  private getInterpolatedPosition(hero: ActiveHero, alpha: number): { x: number; y: number } {
    if (alpha >= 1) {
      return { x: hero.x, y: hero.y };
    }
    const backstep = FP.fromFloat(1 - alpha);
    return {
      x: FP.sub(hero.x, FP.mul(hero.vx, backstep)),
      y: FP.sub(hero.y, FP.mul(hero.vy, backstep)),
    };
  }

  private getTierKey(tier: number): 1 | 2 | 3 {
    if (tier === 1 || tier === 2 || tier === 3) {
      return tier;
    }
    return 1;
  }

  private resetDragState(): void {
    this.draggingHeroId = null;
    this.draggingPointerId = null;
    this.dragStart = null;
    this.dragMoved = false;
    this.updateCursor();
    this.hideDragIndicator();
  }

  private updateDragIndicator(x: number, y: number): void {
    this.dragIndicator.position.set(x, y);
    this.dragIndicator.visible = true;
  }

  private hideDragIndicator(): void {
    this.dragIndicator.visible = false;
  }

  private ensureIndicatorOrder(): void {
    if (this.dragIndicator.parent === this.container) {
      this.container.removeChild(this.dragIndicator);
    }
    this.container.addChild(this.dragIndicator);
    if (this.aimIndicator.parent === this.container) {
      this.container.removeChild(this.aimIndicator);
    }
    this.container.addChild(this.aimIndicator);
  }

  private updateCursor(): void {
    if (this.draggingHeroId && this.onHeroDragCallback) {
      this.interactiveLayer.cursor = "grabbing";
      return;
    }
    if (this.aimActive) {
      this.interactiveLayer.cursor = "crosshair";
      return;
    }
    this.interactiveLayer.cursor = "pointer";
  }

  private updateAimIndicator(x: number, y: number): void {
    this.aimPosition = { x, y };
    if (!this.aimActive) return;
    this.aimIndicator.position.set(x, y);
  }

  private createInteractiveLayer(): Graphics {
    const layer = new Graphics();
    layer.eventMode = "static";
    layer.cursor = "pointer";
    layer.on("pointerdown", this.handlePointerDown, this);
    layer.on("pointermove", this.handlePointerMove, this);
    layer.on("pointerup", this.handlePointerUp, this);
    layer.on("pointerupoutside", this.handlePointerUp, this);
    return layer;
  }

  private createDragIndicator(): Graphics {
    const indicator = new Graphics();
    indicator.eventMode = "none";
    indicator.visible = false;
    indicator
      .circle(0, 0, DRAG_INDICATOR_RADIUS)
      .stroke({ width: 2, color: DRAG_INDICATOR_COLOR, alpha: 0.75 });
    indicator
      .circle(0, 0, DRAG_INDICATOR_RADIUS * 0.35)
      .fill({ color: DRAG_INDICATOR_COLOR, alpha: 0.2 });
    indicator
      .moveTo(-DRAG_INDICATOR_RADIUS, 0)
      .lineTo(-DRAG_INDICATOR_RADIUS * 0.5, 0)
      .stroke({ width: 2, color: DRAG_INDICATOR_COLOR, alpha: 0.75 });
    indicator
      .moveTo(DRAG_INDICATOR_RADIUS, 0)
      .lineTo(DRAG_INDICATOR_RADIUS * 0.5, 0)
      .stroke({ width: 2, color: DRAG_INDICATOR_COLOR, alpha: 0.75 });
    indicator
      .moveTo(0, -DRAG_INDICATOR_RADIUS)
      .lineTo(0, -DRAG_INDICATOR_RADIUS * 0.5)
      .stroke({ width: 2, color: DRAG_INDICATOR_COLOR, alpha: 0.75 });
    indicator
      .moveTo(0, DRAG_INDICATOR_RADIUS)
      .lineTo(0, DRAG_INDICATOR_RADIUS * 0.5)
      .stroke({ width: 2, color: DRAG_INDICATOR_COLOR, alpha: 0.75 });
    return indicator;
  }

  private createAimIndicator(): Graphics {
    const indicator = new Graphics();
    indicator.eventMode = "none";
    indicator.visible = false;
    indicator
      .circle(0, 0, AIM_INDICATOR_RADIUS)
      .stroke({ width: 2, color: AIM_INDICATOR_COLOR, alpha: 0.8 });
    indicator
      .moveTo(-AIM_INDICATOR_RADIUS, 0)
      .lineTo(-AIM_INDICATOR_RADIUS * 0.45, 0)
      .stroke({ width: 2, color: AIM_INDICATOR_COLOR, alpha: 0.9 });
    indicator
      .moveTo(AIM_INDICATOR_RADIUS, 0)
      .lineTo(AIM_INDICATOR_RADIUS * 0.45, 0)
      .stroke({ width: 2, color: AIM_INDICATOR_COLOR, alpha: 0.9 });
    indicator
      .moveTo(0, -AIM_INDICATOR_RADIUS)
      .lineTo(0, -AIM_INDICATOR_RADIUS * 0.45)
      .stroke({ width: 2, color: AIM_INDICATOR_COLOR, alpha: 0.9 });
    indicator
      .moveTo(0, AIM_INDICATOR_RADIUS)
      .lineTo(0, AIM_INDICATOR_RADIUS * 0.45)
      .stroke({ width: 2, color: AIM_INDICATOR_COLOR, alpha: 0.9 });
    return indicator;
  }
}
