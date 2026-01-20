import { Container, Graphics } from "pixi.js";
import { screenXToGameUnit, screenYToGameUnit } from "../../CoordinateSystem.js";

/**
 * SceneInputController handles all input-related functionality for the game scene:
 * - Interactive layer management
 * - Field click detection and world coordinate conversion
 * - Event mode toggling (gameplay vs hub mode)
 */
export class SceneInputController {
  public readonly container: Container;
  private interactiveLayer: Graphics;

  private width = 0;
  private height = 0;

  // Click callback for tactical commands
  private onFieldClickCallback: ((worldX: number, worldY: number) => void) | null = null;

  constructor() {
    this.container = new Container();

    // Interactive layer for click detection
    this.interactiveLayer = new Graphics();
    this.interactiveLayer.eventMode = "static";
    this.interactiveLayer.cursor = "pointer";
    this.interactiveLayer.on("pointerdown", this.handleFieldClick.bind(this));
    this.container.addChild(this.interactiveLayer);
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
    this.interactiveLayer = new Graphics();
    this.interactiveLayer.eventMode = "static";
    this.interactiveLayer.cursor = "pointer";
    this.interactiveLayer.on("pointerdown", this.handleFieldClick.bind(this));
    this.container.addChild(this.interactiveLayer);

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
  }

  /**
   * Handle clicks on the game field for tactical commands.
   */
  private handleFieldClick(event: { global: { x: number; y: number } }): void {
    if (!this.onFieldClickCallback) return;
    if (this.width === 0 || this.height === 0) return;

    // Convert screen coordinates to local container coordinates
    const localX = event.global.x;
    const localY = event.global.y;

    // Convert to world coordinates
    const worldX = screenXToGameUnit(localX, this.width);
    const worldY = screenYToGameUnit(localY, this.height);

    this.onFieldClickCallback(worldX, worldY);
  }
}
