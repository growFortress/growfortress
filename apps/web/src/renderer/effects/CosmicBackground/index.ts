/**
 * CosmicBackground - Advanced multi-layer animated background system
 *
 * Features:
 * - 100% procedural rendering (no external textures)
 * - 6 unique theme configurations for each pillar
 * - Animated layers: gradient, nebulae, stars, dust, special effects
 * - Quality levels for performance scaling
 * - Full backwards compatibility with ParallaxBackground API
 */

import { Container } from 'pixi.js';
import type { PillarId } from '@arcade/sim-core';
import type { QualityLevel, ParallaxConfig, CosmicConfig } from './types.js';
import { COSMIC_CONFIGS, DEFAULT_CONFIG, detectPillarFromConfig } from './config.js';
import { GradientLayer } from './layers/GradientLayer.js';
import { NebulaLayer } from './layers/NebulaLayer.js';
import { StarFieldLayer } from './layers/StarFieldLayer.js';
import { DustLayer } from './layers/DustLayer.js';
import { SpecialEffectsLayer } from './layers/SpecialEffectsLayer.js';

export class CosmicBackground {
  public container: Container;

  // Layers (back to front)
  private gradientLayer: GradientLayer;
  private nebulaLayer: NebulaLayer;
  private starFieldLayer: StarFieldLayer;
  private dustLayer: DustLayer;
  private specialEffectsLayer: SpecialEffectsLayer;

  // State
  private width: number = 0;
  private height: number = 0;
  private enabled: boolean = true;
  private quality: QualityLevel = 'medium';
  private currentConfig: CosmicConfig;
  private currentPillar: PillarId = 'streets';

  constructor() {
    this.container = new Container();
    this.currentConfig = DEFAULT_CONFIG;

    // Create initial layers
    this.gradientLayer = new GradientLayer(this.currentConfig.gradient);
    this.nebulaLayer = new NebulaLayer(this.currentConfig.nebula, this.quality);
    this.starFieldLayer = new StarFieldLayer(this.currentConfig.stars, this.quality);
    this.dustLayer = new DustLayer(this.currentConfig.dust, this.quality);
    this.specialEffectsLayer = new SpecialEffectsLayer(this.currentConfig.special, this.quality);

    // Add to container in z-order (back to front)
    this.container.addChild(this.gradientLayer.getGraphics());
    this.container.addChild(this.nebulaLayer.getGraphics());
    this.container.addChild(this.starFieldLayer.getGraphics());
    this.container.addChild(this.dustLayer.getGraphics());
    this.container.addChild(this.specialEffectsLayer.getGraphics());
  }

  // ==========================================================================
  // PUBLIC API (Backwards compatible with ParallaxBackground)
  // ==========================================================================

  /**
   * Initialize/reinitialize with dimensions.
   * Called on resize.
   */
  public initialize(width: number, height: number): void {
    this.width = width;
    this.height = height;

    if (width === 0 || height === 0) return;

    this.rebuildLayers();
  }

  /**
   * Update animation - called every frame.
   * @param deltaMS Time since last frame in milliseconds
   */
  public update(deltaMS: number): void {
    if (!this.enabled || this.width === 0 || this.height === 0) return;

    // Update all layers
    this.gradientLayer.update(deltaMS, this.width, this.height);
    this.nebulaLayer.update(deltaMS);
    this.starFieldLayer.update(deltaMS);
    this.dustLayer.update(deltaMS);
    this.specialEffectsLayer.update(deltaMS);
  }

  /**
   * Set theme configuration.
   * LEGACY API: Accepts ParallaxConfig for backwards compatibility.
   * Automatically detects pillar from colors.
   */
  public setTheme(config: ParallaxConfig): void {
    // Detect pillar from legacy config colors
    const detectedPillar = detectPillarFromConfig(config.starColor, config.cloudColor);
    this.setThemeByPillar(detectedPillar);
  }

  /**
   * Set theme by pillar ID (preferred API).
   * @param pillarId The pillar to use for theming
   */
  public setThemeByPillar(pillarId: PillarId): void {
    if (pillarId === this.currentPillar) return;

    this.currentPillar = pillarId;
    this.currentConfig = COSMIC_CONFIGS[pillarId] || DEFAULT_CONFIG;

    // Rebuild layers with new config if already initialized
    if (this.width > 0 && this.height > 0) {
      this.rebuildLayers();
    }
  }

  /**
   * Enable/disable the background.
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.container.visible = enabled;
  }

  /**
   * Set quality level for performance scaling.
   */
  public setQuality(quality: QualityLevel): void {
    if (this.quality === quality) return;

    this.quality = quality;

    // Update quality on layers
    this.nebulaLayer.setQuality(quality);
    this.starFieldLayer.setQuality(quality);
    this.dustLayer.setQuality(quality);
    this.specialEffectsLayer.setQuality(quality);

    // Rebuild if already initialized
    if (this.width > 0 && this.height > 0) {
      this.rebuildLayers();
    }
  }

  /**
   * Get current stats for debugging.
   */
  public getStats(): { stars: number; clouds: number } {
    return {
      stars: this.starFieldLayer.getStarCount(),
      clouds: this.nebulaLayer.getNebulaCount() + this.dustLayer.getParticleCount(),
    };
  }

  /**
   * Get current pillar (for debugging/inspection).
   */
  public getCurrentPillar(): PillarId {
    return this.currentPillar;
  }

  /**
   * Destroy and cleanup.
   */
  public destroy(): void {
    this.gradientLayer.destroy();
    this.nebulaLayer.destroy();
    this.starFieldLayer.destroy();
    this.dustLayer.destroy();
    this.specialEffectsLayer.destroy();
    this.container.destroy({ children: true });
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  /**
   * Rebuild all layers with current config and dimensions.
   * Called when config changes or on resize.
   */
  private rebuildLayers(): void {
    // Remove old graphics from container
    this.container.removeChildren();

    // Destroy old layers
    this.gradientLayer.destroy();
    this.nebulaLayer.destroy();
    this.starFieldLayer.destroy();
    this.dustLayer.destroy();
    this.specialEffectsLayer.destroy();

    // Create new layers with current config
    this.gradientLayer = new GradientLayer(this.currentConfig.gradient);
    this.nebulaLayer = new NebulaLayer(this.currentConfig.nebula, this.quality);
    this.starFieldLayer = new StarFieldLayer(this.currentConfig.stars, this.quality);
    this.dustLayer = new DustLayer(this.currentConfig.dust, this.quality);
    this.specialEffectsLayer = new SpecialEffectsLayer(this.currentConfig.special, this.quality);

    // Initialize layers that need dimensions
    this.nebulaLayer.initialize(this.width, this.height);
    this.starFieldLayer.initialize(this.width, this.height);
    this.dustLayer.initialize(this.width, this.height);
    this.specialEffectsLayer.initialize(this.width, this.height);

    // Add to container in z-order (back to front)
    this.container.addChild(this.gradientLayer.getGraphics());
    this.container.addChild(this.nebulaLayer.getGraphics());
    this.container.addChild(this.starFieldLayer.getGraphics());
    this.container.addChild(this.dustLayer.getGraphics());
    this.container.addChild(this.specialEffectsLayer.getGraphics());
  }
}

// ==========================================================================
// SINGLETON EXPORT (for drop-in replacement)
// ==========================================================================

/**
 * Singleton instance for direct usage.
 */
export const cosmicBackground = new CosmicBackground();

// ==========================================================================
// BACKWARDS COMPATIBILITY EXPORTS
// ==========================================================================

/**
 * Re-export as parallaxBackground for backwards compatibility.
 * Allows existing code to continue using:
 * import { parallaxBackground } from './ParallaxBackground'
 */
export { cosmicBackground as parallaxBackground };

/**
 * Re-export class as ParallaxBackground for type compatibility.
 */
export { CosmicBackground as ParallaxBackground };

/**
 * Re-export ParallaxConfig type for backwards compatibility.
 */
export type { ParallaxConfig } from './types.js';
