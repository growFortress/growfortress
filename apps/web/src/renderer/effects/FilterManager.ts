import { Container, Filter, BlurFilter, ColorMatrixFilter } from 'pixi.js';
import {
  GlowFilter,
  ShockwaveFilter,
  MotionBlurFilter,
} from 'pixi-filters';

interface ActiveEffect {
  filter: Filter;
  duration: number;
  elapsed: number;
  onUpdate?: (progress: number, filter: Filter) => void;
  onComplete?: () => void;
  target: Container;
}

interface GlowOptions {
  color?: number;
  distance?: number;
  outerStrength?: number;
  innerStrength?: number;
  quality?: number;
}

interface HitFlashOptions {
  color?: 'red' | 'white' | 'yellow';
  intensity?: number;
}

interface ShockwaveOptions {
  x: number;
  y: number;
  amplitude?: number;
  wavelength?: number;
  speed?: number;
  radius?: number;
}

interface MotionBlurOptions {
  velocityX?: number;
  velocityY?: number;
  kernelSize?: number;
}

/**
 * FilterManager - Manages dynamic visual effects using PixiJS filters.
 * Supports temporary effects with automatic cleanup.
 */
export class FilterManager {
  private activeEffects: ActiveEffect[] = [];
  private filterCache: Map<string, Filter> = new Map();
  private globalContainer: Container | null = null;

  // Persistent filters for quality levels
  private qualityLevel: 'low' | 'medium' | 'high' = 'high';

  constructor() {}

  /**
   * Set the global container for stage-wide effects
   */
  public setGlobalContainer(container: Container) {
    this.globalContainer = container;
  }

  /**
   * Set quality level - affects filter intensity and performance
   */
  public setQualityLevel(level: 'low' | 'medium' | 'high') {
    this.qualityLevel = level;
  }

  /**
   * Update all active effects - call from game loop
   */
  public update(deltaMS: number) {
    for (let i = this.activeEffects.length - 1; i >= 0; i--) {
      const effect = this.activeEffects[i];
      effect.elapsed += deltaMS;

      const progress = Math.min(effect.elapsed / effect.duration, 1);

      // Call update callback if exists
      if (effect.onUpdate) {
        effect.onUpdate(progress, effect.filter);
      }

      // Check if effect is complete
      if (progress >= 1) {
        // Remove filter from target
        this.removeFilterFromContainer(effect.target, effect.filter);

        // Call completion callback
        if (effect.onComplete) {
          effect.onComplete();
        }

        // Remove from active effects
        this.activeEffects.splice(i, 1);
      }
    }
  }

  /**
   * Apply a temporary glow effect to a container
   */
  public applyGlow(
    target: Container,
    duration: number = 500,
    options: GlowOptions = {}
  ) {
    if (this.qualityLevel === 'low') return; // Skip on low quality

    const {
      color = 0xffffff,
      distance = 15,
      outerStrength = 4,
      innerStrength = 0,
      quality = this.qualityLevel === 'high' ? 0.5 : 0.3,
    } = options;

    const glow = new GlowFilter({
      color,
      distance,
      outerStrength,
      innerStrength,
      quality,
    });

    this.addFilterToContainer(target, glow);

    this.activeEffects.push({
      filter: glow,
      duration,
      elapsed: 0,
      target,
      onUpdate: (progress, filter) => {
        const glowFilter = filter as GlowFilter;
        // Fade in quickly, then fade out
        if (progress < 0.2) {
          glowFilter.outerStrength = outerStrength * (progress / 0.2);
        } else {
          glowFilter.outerStrength = outerStrength * (1 - (progress - 0.2) / 0.8);
        }
      },
    });
  }

  /**
   * Apply a hit flash effect (color overlay)
   */
  public applyHitFlash(
    target: Container,
    duration: number = 150,
    options: HitFlashOptions = {}
  ) {
    const { color = 'white', intensity = 0.8 } = options;

    const colorMatrix = new ColorMatrixFilter();

    // Set initial color based on type
    switch (color) {
      case 'red':
        colorMatrix.matrix = [
          1 + intensity, 0, 0, 0, intensity * 0.5,
          0, 1 - intensity * 0.5, 0, 0, 0,
          0, 0, 1 - intensity * 0.5, 0, 0,
          0, 0, 0, 1, 0,
        ];
        break;
      case 'yellow':
        colorMatrix.matrix = [
          1 + intensity * 0.5, 0, 0, 0, intensity * 0.3,
          0, 1 + intensity * 0.3, 0, 0, intensity * 0.2,
          0, 0, 1 - intensity * 0.3, 0, 0,
          0, 0, 0, 1, 0,
        ];
        break;
      case 'white':
      default:
        colorMatrix.brightness(1 + intensity, false);
        break;
    }

    this.addFilterToContainer(target, colorMatrix);

    this.activeEffects.push({
      filter: colorMatrix,
      duration,
      elapsed: 0,
      target,
      onUpdate: (progress, filter) => {
        const cm = filter as ColorMatrixFilter;
        const currentIntensity = intensity * (1 - progress);

        switch (color) {
          case 'red':
            cm.matrix = [
              1 + currentIntensity, 0, 0, 0, currentIntensity * 0.5,
              0, 1 - currentIntensity * 0.5, 0, 0, 0,
              0, 0, 1 - currentIntensity * 0.5, 0, 0,
              0, 0, 0, 1, 0,
            ];
            break;
          case 'yellow':
            cm.matrix = [
              1 + currentIntensity * 0.5, 0, 0, 0, currentIntensity * 0.3,
              0, 1 + currentIntensity * 0.3, 0, 0, currentIntensity * 0.2,
              0, 0, 1 - currentIntensity * 0.3, 0, 0,
              0, 0, 0, 1, 0,
            ];
            break;
          case 'white':
          default:
            cm.brightness(1 + currentIntensity, false);
            break;
        }
      },
    });
  }

  /**
   * Apply a blur effect (useful for depth of field or transitions)
   */
  public applyBlur(
    target: Container,
    duration: number = 300,
    strength: number = 4
  ) {
    if (this.qualityLevel === 'low') return;

    const blur = new BlurFilter({
      strength: 0,
      quality: this.qualityLevel === 'high' ? 4 : 2,
    });

    this.addFilterToContainer(target, blur);

    this.activeEffects.push({
      filter: blur,
      duration,
      elapsed: 0,
      target,
      onUpdate: (progress, filter) => {
        const blurFilter = filter as BlurFilter;
        // Bell curve - ramp up then down
        const bellCurve = Math.sin(progress * Math.PI);
        blurFilter.strength = strength * bellCurve;
      },
    });
  }

  /**
   * Apply a shockwave effect (radial distortion)
   */
  public applyShockwave(
    target: Container,
    duration: number = 1000,
    options: ShockwaveOptions
  ) {
    if (this.qualityLevel === 'low') return;

    const {
      x,
      y,
      amplitude = 30,
      wavelength = 160,
      speed = 500,
      radius = -1,
    } = options;

    // Normalize coordinates to 0-1 range based on target dimensions
    const bounds = target.getBounds();
    const normalizedX = (x - bounds.x) / bounds.width;
    const normalizedY = (y - bounds.y) / bounds.height;

    const shockwave = new ShockwaveFilter({
      center: { x: normalizedX, y: normalizedY },
      amplitude,
      wavelength,
      speed,
      radius,
    });

    this.addFilterToContainer(target, shockwave);

    this.activeEffects.push({
      filter: shockwave,
      duration,
      elapsed: 0,
      target,
      onUpdate: (progress, filter) => {
        const sw = filter as ShockwaveFilter;
        sw.time = progress * (duration / 1000);
        // Fade out amplitude at the end
        if (progress > 0.7) {
          sw.amplitude = amplitude * (1 - (progress - 0.7) / 0.3);
        }
      },
    });
  }

  /**
   * Apply motion blur effect
   */
  public applyMotionBlur(
    target: Container,
    duration: number = 200,
    options: MotionBlurOptions = {}
  ) {
    if (this.qualityLevel === 'low') return;

    const { velocityX = 20, velocityY = 0, kernelSize = 5 } = options;

    const motionBlur = new MotionBlurFilter({
      velocity: { x: velocityX, y: velocityY },
      kernelSize,
    });

    this.addFilterToContainer(target, motionBlur);

    this.activeEffects.push({
      filter: motionBlur,
      duration,
      elapsed: 0,
      target,
      onUpdate: (progress, filter) => {
        const mb = filter as MotionBlurFilter;
        // Fade out
        const fadeOut = 1 - progress;
        mb.velocity = { x: velocityX * fadeOut, y: velocityY * fadeOut };
      },
    });
  }

  /**
   * Apply screen flash effect (on global container)
   */
  public applyScreenFlash(
    color: 'white' | 'red' | 'yellow' = 'white',
    duration: number = 200,
    intensity: number = 0.6
  ) {
    if (!this.globalContainer) return;
    this.applyHitFlash(this.globalContainer, duration, { color, intensity });
  }

  /**
   * Apply screen shockwave (on global container)
   */
  public applyScreenShockwave(
    x: number,
    y: number,
    duration: number = 800
  ) {
    if (!this.globalContainer) return;
    this.applyShockwave(this.globalContainer, duration, { x, y });
  }

  /**
   * Get a cached filter or create a new one
   * @internal Reserved for future use with persistent filters
   */
  public getCachedFilter<T extends Filter>(
    key: string,
    factory: () => T
  ): T {
    if (!this.filterCache.has(key)) {
      this.filterCache.set(key, factory());
    }
    return this.filterCache.get(key) as T;
  }

  /**
   * Add a filter to a container safely
   */
  private addFilterToContainer(container: Container, filter: Filter) {
    if (!container.filters) {
      container.filters = [];
    }
    (container.filters as Filter[]).push(filter);
  }

  /**
   * Remove a filter from a container safely
   */
  private removeFilterFromContainer(container: Container, filter: Filter) {
    if (container.filters) {
      const index = (container.filters as Filter[]).indexOf(filter);
      if (index !== -1) {
        (container.filters as Filter[]).splice(index, 1);
      }
      // Clean up empty array
      if (container.filters.length === 0) {
        container.filters = null;
      }
    }
  }

  /**
   * Clear all active effects
   */
  public clearAll() {
    for (const effect of this.activeEffects) {
      this.removeFilterFromContainer(effect.target, effect.filter);
    }
    this.activeEffects = [];
  }

  // Persistent low HP warning filter
  private lowHpFilter: ColorMatrixFilter | null = null;
  private lowHpActive = false;

  /**
   * Set low HP warning effect - red vignette-like tint when HP is low.
   * @param level 0 = no warning, 1 = mild (< 30% HP), 2 = critical (< 15% HP)
   */
  public setLowHpWarning(level: 0 | 1 | 2) {
    if (!this.globalContainer) return;

    // Remove existing filter if any
    if (this.lowHpFilter && this.lowHpActive) {
      this.removeFilterFromContainer(this.globalContainer, this.lowHpFilter);
      this.lowHpActive = false;
    }

    if (level === 0) {
      this.lowHpFilter = null;
      return;
    }

    // Create or reuse filter
    if (!this.lowHpFilter) {
      this.lowHpFilter = new ColorMatrixFilter();
    }

    // Apply red tint based on warning level
    const intensity = level === 2 ? 0.4 : 0.2;
    this.lowHpFilter.reset();
    // Shift towards red and slightly desaturate
    this.lowHpFilter.saturate(-0.3 * intensity);
    this.lowHpFilter.brightness(1 - intensity * 0.1, false);
    // Add red tint by adjusting color matrix
    const matrix = this.lowHpFilter.matrix;
    matrix[0] = 1 + intensity * 0.5;  // Boost red
    matrix[6] = 1 - intensity * 0.2;  // Reduce green
    matrix[12] = 1 - intensity * 0.3; // Reduce blue

    this.addFilterToContainer(this.globalContainer, this.lowHpFilter);
    this.lowHpActive = true;
  }

  /**
   * Destroy and cleanup
   */
  public destroy() {
    this.clearAll();
    this.filterCache.clear();
    this.globalContainer = null;
  }
}

// Export singleton instance for easy access
export const filterManager = new FilterManager();

export type { GlowOptions, HitFlashOptions, ShockwaveOptions, MotionBlurOptions };
