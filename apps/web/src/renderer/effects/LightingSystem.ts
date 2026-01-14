import { Container, Graphics } from 'pixi.js';

interface LightSource {
  id: string;
  x: number;
  y: number;
  color: number;
  radius: number;
  intensity: number;
  // Animation properties
  pulse?: {
    speed: number;
    minIntensity: number;
    maxIntensity: number;
    phase: number;
  };
  flicker?: {
    speed: number;
    amount: number;
  };
  // Lifecycle
  lifetime?: number;
  elapsed?: number;
  fadeIn?: number;
  fadeOut?: number;
}

interface AmbientLight {
  color: number;
  intensity: number;
}

/**
 * LightingSystem - Creates procedural lighting effects using radial gradients.
 * Uses additive blending for a realistic glow effect.
 */
export class LightingSystem {
  public container: Container;
  private graphics: Graphics;
  private lightSources: Map<string, LightSource> = new Map();
  private _ambientLight: AmbientLight = { color: 0x202040, intensity: 0.3 };
  private nextId: number = 0;
  private enabled: boolean = true;

  constructor() {
    this.container = new Container();
    this.graphics = new Graphics();
    this.graphics.blendMode = 'add';
    this.container.addChild(this.graphics);
  }

  /**
   * Enable/disable lighting system
   */
  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
    this.container.visible = enabled;
  }

  /**
   * Set ambient light color and intensity
   */
  public setAmbientLight(color: number, intensity: number) {
    this._ambientLight = { color, intensity };
  }

  /**
   * Get current ambient light settings
   */
  public get ambientLight(): AmbientLight {
    return this._ambientLight;
  }

  /**
   * Add a static light source
   */
  public addLight(
    x: number,
    y: number,
    color: number,
    radius: number = 100,
    intensity: number = 1
  ): string {
    const id = `light_${this.nextId++}`;
    this.lightSources.set(id, {
      id,
      x,
      y,
      color,
      radius,
      intensity,
    });
    return id;
  }

  /**
   * Add a pulsing light source
   */
  public addPulsingLight(
    x: number,
    y: number,
    color: number,
    radius: number = 100,
    options: {
      minIntensity?: number;
      maxIntensity?: number;
      speed?: number;
    } = {}
  ): string {
    const id = `light_${this.nextId++}`;
    const { minIntensity = 0.5, maxIntensity = 1.0, speed = 2 } = options;

    this.lightSources.set(id, {
      id,
      x,
      y,
      color,
      radius,
      intensity: maxIntensity,
      pulse: {
        speed,
        minIntensity,
        maxIntensity,
        phase: Math.random() * Math.PI * 2,
      },
    });
    return id;
  }

  /**
   * Add a flickering light source (like fire/torch)
   */
  public addFlickeringLight(
    x: number,
    y: number,
    color: number,
    radius: number = 80,
    intensity: number = 1,
    flickerAmount: number = 0.3
  ): string {
    const id = `light_${this.nextId++}`;
    this.lightSources.set(id, {
      id,
      x,
      y,
      color,
      radius,
      intensity,
      flicker: {
        speed: 10 + Math.random() * 10,
        amount: flickerAmount,
      },
    });
    return id;
  }

  /**
   * Add a temporary light (auto-removes after duration)
   */
  public addTemporaryLight(
    x: number,
    y: number,
    color: number,
    radius: number = 100,
    duration: number = 500,
    options: {
      intensity?: number;
      fadeIn?: number;
      fadeOut?: number;
    } = {}
  ): string {
    const id = `light_${this.nextId++}`;
    const { intensity = 1, fadeIn = 50, fadeOut = 200 } = options;

    this.lightSources.set(id, {
      id,
      x,
      y,
      color,
      radius,
      intensity,
      lifetime: duration,
      elapsed: 0,
      fadeIn,
      fadeOut,
    });
    return id;
  }

  /**
   * Spawn a flash effect (quick bright burst)
   */
  public spawnFlash(x: number, y: number, color: number, radius: number = 150) {
    this.addTemporaryLight(x, y, color, radius, 200, {
      intensity: 1.5,
      fadeIn: 20,
      fadeOut: 180,
    });
  }

  /**
   * Spawn skill activation glow
   */
  public spawnSkillGlow(x: number, y: number, color: number) {
    this.addTemporaryLight(x, y, color, 120, 400, {
      intensity: 1.2,
      fadeIn: 50,
      fadeOut: 350,
    });
  }

  /**
   * Create boss aura effect (large pulsing glow)
   */
  public addBossAura(x: number, y: number, color: number): string {
    return this.addPulsingLight(x, y, color, 200, {
      minIntensity: 0.6,
      maxIntensity: 1.0,
      speed: 1.5,
    });
  }

  /**
   * Update light source position
   */
  public updateLightPosition(id: string, x: number, y: number) {
    const light = this.lightSources.get(id);
    if (light) {
      light.x = x;
      light.y = y;
    }
  }

  /**
   * Update light source properties
   */
  public updateLight(id: string, props: Partial<Pick<LightSource, 'color' | 'radius' | 'intensity'>>) {
    const light = this.lightSources.get(id);
    if (light) {
      Object.assign(light, props);
    }
  }

  /**
   * Remove a light source
   */
  public removeLight(id: string) {
    this.lightSources.delete(id);
  }

  /**
   * Clear all light sources
   */
  public clearLights() {
    this.lightSources.clear();
  }

  /**
   * Update lighting system - call from game loop
   */
  public update(deltaMS: number) {
    if (!this.enabled) return;

    const dt = deltaMS / 1000;

    // Update light sources
    for (const [id, light] of this.lightSources) {
      // Update pulse animation
      if (light.pulse) {
        light.pulse.phase += light.pulse.speed * dt;
        const t = (Math.sin(light.pulse.phase) + 1) / 2;
        light.intensity = light.pulse.minIntensity + t * (light.pulse.maxIntensity - light.pulse.minIntensity);
      }

      // Update flicker animation
      if (light.flicker) {
        const flicker = Math.sin(light.pulse?.phase ?? 0 * light.flicker.speed) *
                       Math.cos((light.pulse?.phase ?? 0) * light.flicker.speed * 1.3);
        light.intensity = Math.max(0.1, 1 + flicker * light.flicker.amount);
      }

      // Update temporary lights
      if (light.lifetime !== undefined && light.elapsed !== undefined) {
        light.elapsed += deltaMS;

        // Calculate fade
        let fadeMultiplier = 1;
        if (light.fadeIn && light.elapsed < light.fadeIn) {
          fadeMultiplier = light.elapsed / light.fadeIn;
        } else if (light.fadeOut && light.elapsed > light.lifetime - light.fadeOut) {
          fadeMultiplier = (light.lifetime - light.elapsed) / light.fadeOut;
        }
        light.intensity *= fadeMultiplier;

        // Remove expired lights
        if (light.elapsed >= light.lifetime) {
          this.lightSources.delete(id);
        }
      }
    }

    // Redraw lights
    this.drawLights();
  }

  /**
   * Draw all light sources
   */
  private drawLights() {
    this.graphics.clear();

    for (const light of this.lightSources.values()) {
      this.drawRadialGlow(light.x, light.y, light.color, light.radius, light.intensity);
    }
  }

  /**
   * Draw a radial gradient glow effect
   */
  private drawRadialGlow(
    x: number,
    y: number,
    color: number,
    radius: number,
    intensity: number
  ) {
    // Extract RGB components
    const r = ((color >> 16) & 0xff) / 255;
    const g = ((color >> 8) & 0xff) / 255;
    const b = (color & 0xff) / 255;

    // Draw multiple concentric circles with decreasing alpha to simulate radial gradient
    const rings = 8;
    for (let i = rings - 1; i >= 0; i--) {
      const ringRadius = radius * ((i + 1) / rings);
      const ringAlpha = (1 - i / rings) * intensity * 0.3;

      // Adjust color brightness based on ring
      const brightness = 1 - (i / rings) * 0.5;
      const ringColor =
        (Math.round(r * brightness * 255) << 16) |
        (Math.round(g * brightness * 255) << 8) |
        Math.round(b * brightness * 255);

      this.graphics.circle(x, y, ringRadius).fill({ color: ringColor, alpha: ringAlpha });
    }

    // Bright core
    this.graphics.circle(x, y, radius * 0.15).fill({ color: 0xffffff, alpha: intensity * 0.4 });
  }

  /**
   * Get number of active lights (for debugging/performance monitoring)
   */
  public getLightCount(): number {
    return this.lightSources.size;
  }

  /**
   * Destroy and cleanup
   */
  public destroy() {
    this.lightSources.clear();
    this.graphics.destroy();
    this.container.destroy({ children: true });
  }
}

// Export singleton instance
export const lightingSystem = new LightingSystem();
