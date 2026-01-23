/**
 * HubPreviewRenderer - Lightweight renderer for viewing other players' hub configurations.
 * Creates a standalone PixiJS instance for rendering hub previews in modals.
 */
import { Application } from 'pixi.js';
import { GameScene, type HubState } from './scenes/GameScene.js';
import type { FortressClass } from '@arcade/sim-core';
import { logger } from '../utils/logger.js';
import { getFortressTierFromLevel } from '../utils/hubPreviewTransform.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Minimum canvas dimension in pixels */
const MIN_CANVAS_SIZE = 100;

/** Target framerate for preview animation (lower to save resources) */
const PREVIEW_FPS = 15;

/** Maximum delta time to prevent large jumps on tab focus */
const MAX_DELTA_MS = 50;

/** Default delta time for first frame */
const DEFAULT_DELTA_MS = 16;

export class HubPreviewRenderer {
  private app: Application;
  private gameScene: GameScene | null = null;
  private canvas: HTMLCanvasElement;
  private animationFrameId: number | null = null;
  private isInitialized = false;
  private isDestroyed = false;
  private lastTime = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.app = new Application();
  }

  /**
   * Initialize the renderer. Must be called before rendering.
   */
  async init(): Promise<void> {
    if (this.isInitialized || this.isDestroyed) return;

    try {
      const rect = this.canvas.getBoundingClientRect();
      const width = Math.max(rect.width, MIN_CANVAS_SIZE);
      const height = Math.max(rect.height, MIN_CANVAS_SIZE);

      await this.app.init({
        canvas: this.canvas,
        width,
        height,
        backgroundColor: '#161622',
        antialias: true,
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        preference: 'webgl',
      });

      // Create game scene
      this.gameScene = new GameScene(this.app, { enableParallax: false });
      this.app.stage.addChild(this.gameScene.container);

      // Notify scene of initial size
      this.gameScene.onResize(width, height);

      this.isInitialized = true;
      logger.debug('[HubPreviewRenderer] Initialized');
    } catch (error) {
      logger.error('[HubPreviewRenderer] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Configure the preview with fortress class and tier.
   * @param fortressClass - The fortress class to display
   * @param level - Commander level (used to calculate fortress tier)
   */
  configure(fortressClass: FortressClass, level: number): void {
    if (!this.gameScene || !this.isInitialized) return;

    const tier = getFortressTierFromLevel(level);
    this.gameScene.setPreviewMode(true, fortressClass, tier);
  }

  /**
   * Render a hub state (single frame).
   * @param hubState - The hub state to render (heroes, turrets, slots)
   */
  renderFrame(hubState: HubState): void {
    if (!this.gameScene || !this.isInitialized || this.isDestroyed) return;

    const now = performance.now();
    const deltaMs = this.lastTime > 0
      ? Math.min(MAX_DELTA_MS, now - this.lastTime)
      : DEFAULT_DELTA_MS;
    this.lastTime = now;

    this.gameScene.renderPreview(hubState, deltaMs);
  }

  /**
   * Start animation loop for continuous preview updates.
   * Runs at reduced framerate since preview is mostly static.
   * @param hubState - The hub state to animate
   */
  startAnimation(hubState: HubState): void {
    if (this.isDestroyed) return;

    // Stop any existing animation to prevent leaks
    this.stopAnimation();

    const targetFrameTime = 1000 / PREVIEW_FPS;
    let lastFrameTime = 0;

    const animate = (currentTime: number) => {
      if (this.isDestroyed) return;

      const elapsed = currentTime - lastFrameTime;
      if (elapsed >= targetFrameTime) {
        lastFrameTime = currentTime - (elapsed % targetFrameTime);
        this.renderFrame(hubState);
      }

      this.animationFrameId = requestAnimationFrame(animate);
    };

    this.animationFrameId = requestAnimationFrame(animate);
  }

  /**
   * Stop animation loop.
   */
  stopAnimation(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Handle canvas resize. Updates renderer and scene dimensions.
   */
  resize(): void {
    if (!this.gameScene || !this.isInitialized || this.isDestroyed) return;

    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(rect.width, MIN_CANVAS_SIZE);
    const height = Math.max(rect.height, MIN_CANVAS_SIZE);

    this.app.renderer.resize(width, height);
    this.gameScene.onResize(width, height);
  }

  /**
   * Clean up and destroy the renderer.
   */
  destroy(): void {
    if (this.isDestroyed) return;

    this.stopAnimation();
    this.isDestroyed = true;
    this.isInitialized = false;

    try {
      if (this.gameScene) {
        this.gameScene.setPreviewMode(false);
      }
      this.app.destroy(true, { children: true, texture: false });
    } catch (error) {
      logger.warn('[HubPreviewRenderer] Error during destroy:', error);
    }

    logger.debug('[HubPreviewRenderer] Destroyed');
  }

  /**
   * Check if renderer is ready.
   */
  isReady(): boolean {
    return this.isInitialized && !this.isDestroyed;
  }
}
