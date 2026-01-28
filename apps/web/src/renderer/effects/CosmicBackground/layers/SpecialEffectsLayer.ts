/**
 * SpecialEffectsLayer - Theme-specific special effects
 * Implements: smoke, data_streams, lightning, runes, portals, divine_rays
 */

import { Graphics } from 'pixi.js';
import type {
  SpecialEffectConfig,
  QualityLevel,
  SmokeCloud,
  DataStream,
  LightningBolt,
  FloatingRune,
  Portal,
  DivineRay,
} from '../types.js';
import { QUALITY_MULTIPLIERS } from '../types.js';

export class SpecialEffectsLayer {
  private graphics: Graphics;
  private config: SpecialEffectConfig;
  private quality: QualityLevel;
  private width: number = 0;
  private height: number = 0;
  private time: number = 0;

  // Effect-specific state
  private smokeClouds: SmokeCloud[] = [];
  private dataStreams: DataStream[] = [];
  private lightningBolts: LightningBolt[] = [];
  private floatingRunes: FloatingRune[] = [];
  private portals: Portal[] = [];
  private divineRays: DivineRay[] = [];

  constructor(config: SpecialEffectConfig, quality: QualityLevel) {
    this.graphics = new Graphics();
    // SimplexNoise available for future effects if needed
    this.config = config;
    this.quality = quality;
  }

  public getGraphics(): Graphics {
    return this.graphics;
  }

  public setConfig(config: SpecialEffectConfig): void {
    this.config = config;
    this.clearAllEffects();
  }

  public setQuality(quality: QualityLevel): void {
    this.quality = quality;
  }

  public initialize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.clearAllEffects();
    this.initializeEffects();
  }

  private clearAllEffects(): void {
    this.smokeClouds = [];
    this.dataStreams = [];
    this.lightningBolts = [];
    this.floatingRunes = [];
    this.portals = [];
    this.divineRays = [];
  }

  private initializeEffects(): void {
    // Pre-populate some effects based on type
    switch (this.config.type) {
      case 'smoke':
        this.initializeSmoke();
        break;
      case 'runes':
        this.initializeRunes();
        break;
      case 'portals':
        this.initializePortals();
        break;
      case 'divine_rays':
        this.initializeDivineRays();
        break;
    }
  }

  public update(deltaMS: number): void {
    if (this.config.type === 'none' || this.width === 0) {
      this.graphics.clear();
      return;
    }

    // Skip special effects on low quality
    if (!QUALITY_MULTIPLIERS[this.quality].specialEffects) {
      this.graphics.clear();
      return;
    }

    const dt = deltaMS / 1000;
    this.time += dt;
    this.graphics.clear();

    switch (this.config.type) {
      case 'smoke':
        this.updateSmoke(dt);
        break;
      case 'data_streams':
        this.updateDataStreams(dt);
        break;
      case 'lightning':
        this.updateLightning(dt);
        break;
      case 'runes':
        this.updateRunes(dt);
        break;
      case 'portals':
        this.updatePortals(dt);
        break;
      case 'divine_rays':
        this.updateDivineRays(dt);
        break;
    }
  }

  // ========================================================================
  // SMOKE EFFECT
  // ========================================================================

  private initializeSmoke(): void {
    const count = Math.floor(6 * this.config.frequency);
    for (let i = 0; i < count; i++) {
      this.spawnSmokeCloud();
    }
  }

  private spawnSmokeCloud(): void {
    this.smokeClouds.push({
      x: Math.random() * this.width,
      y: this.height * (0.3 + Math.random() * 0.5),
      radius: 50 + Math.random() * 100,
      alpha: 0.08 + Math.random() * 0.12,
      vx: (Math.random() - 0.5) * 15,
      vy: -5 - Math.random() * 10,
      life: 8 + Math.random() * 6,
    });
  }

  private updateSmoke(dt: number): void {
    // Spawn new clouds
    if (Math.random() < this.config.frequency * 0.03) {
      this.spawnSmokeCloud();
    }

    // Update and draw
    for (let i = this.smokeClouds.length - 1; i >= 0; i--) {
      const cloud = this.smokeClouds[i];

      cloud.x += cloud.vx * dt;
      cloud.y += cloud.vy * dt;
      cloud.life -= dt;
      cloud.radius += dt * 8; // Expand slowly

      if (cloud.life <= 0 || cloud.y < -cloud.radius) {
        this.smokeClouds.splice(i, 1);
        continue;
      }

      const lifeRatio = Math.min(1, cloud.life / 4);
      const alpha = cloud.alpha * lifeRatio * this.config.intensity;

      // Draw layered smoke
      this.graphics
        .ellipse(cloud.x, cloud.y, cloud.radius, cloud.radius * 0.6)
        .fill({ color: this.config.color, alpha });

      this.graphics
        .ellipse(cloud.x + cloud.radius * 0.3, cloud.y - cloud.radius * 0.2,
          cloud.radius * 0.7, cloud.radius * 0.5)
        .fill({ color: this.config.secondaryColor || this.config.color, alpha: alpha * 0.7 });
    }
  }

  // ========================================================================
  // DATA STREAMS EFFECT
  // ========================================================================

  private updateDataStreams(dt: number): void {
    // Spawn new streams
    if (Math.random() < this.config.frequency * 0.08) {
      const isVertical = Math.random() > 0.3;
      this.dataStreams.push({
        x: isVertical ? Math.random() * this.width : -50,
        y: isVertical ? -50 : Math.random() * this.height * 0.7,
        length: 30 + Math.random() * 80,
        speed: 200 + Math.random() * 300,
        alpha: 0.15 + Math.random() * 0.25,
        isVertical,
      });
    }

    // Update and draw
    for (let i = this.dataStreams.length - 1; i >= 0; i--) {
      const stream = this.dataStreams[i];

      if (stream.isVertical) {
        stream.y += stream.speed * dt;
        if (stream.y > this.height + stream.length) {
          this.dataStreams.splice(i, 1);
          continue;
        }
      } else {
        stream.x += stream.speed * dt;
        if (stream.x > this.width + stream.length) {
          this.dataStreams.splice(i, 1);
          continue;
        }
      }

      const alpha = stream.alpha * this.config.intensity;

      // Draw stream with gradient
      if (stream.isVertical) {
        const startY = stream.y - stream.length;
        this.graphics
          .moveTo(stream.x, startY)
          .lineTo(stream.x, stream.y)
          .stroke({ color: this.config.color, alpha, width: 2 });

        // Bright head
        this.graphics.circle(stream.x, stream.y, 3).fill({
          color: this.config.secondaryColor || 0xffffff,
          alpha: alpha * 1.5,
        });
      } else {
        const startX = stream.x - stream.length;
        this.graphics
          .moveTo(startX, stream.y)
          .lineTo(stream.x, stream.y)
          .stroke({ color: this.config.color, alpha, width: 2 });

        this.graphics.circle(stream.x, stream.y, 3).fill({
          color: this.config.secondaryColor || 0xffffff,
          alpha: alpha * 1.5,
        });
      }
    }
  }

  // ========================================================================
  // LIGHTNING EFFECT
  // ========================================================================

  private updateLightning(dt: number): void {
    // Randomly spawn lightning
    if (Math.random() < this.config.frequency * 0.005) {
      this.spawnLightning();
    }

    // Update and draw
    for (let i = this.lightningBolts.length - 1; i >= 0; i--) {
      const bolt = this.lightningBolts[i];
      bolt.life -= dt;

      if (bolt.life <= 0) {
        this.lightningBolts.splice(i, 1);
        continue;
      }

      const alpha = (bolt.life / 0.15) * bolt.alpha * this.config.intensity;

      // Draw lightning segments
      for (let s = 0; s < bolt.segments.length - 1; s++) {
        const seg = bolt.segments[s];
        const nextSeg = bolt.segments[s + 1];

        this.graphics
          .moveTo(seg.x, seg.y)
          .lineTo(nextSeg.x, nextSeg.y)
          .stroke({ color: bolt.color, alpha, width: 2 });

        // Glow
        this.graphics
          .moveTo(seg.x, seg.y)
          .lineTo(nextSeg.x, nextSeg.y)
          .stroke({ color: bolt.color, alpha: alpha * 0.3, width: 6 });
      }
    }
  }

  private spawnLightning(): void {
    const startX = this.width * (0.2 + Math.random() * 0.6);
    const segments: Array<{ x: number; y: number }> = [{ x: startX, y: 0 }];

    let x = startX;
    let y = 0;
    const targetY = this.height * (0.4 + Math.random() * 0.3);

    while (y < targetY) {
      y += 20 + Math.random() * 40;
      x += (Math.random() - 0.5) * 60;
      segments.push({ x, y });
    }

    this.lightningBolts.push({
      segments,
      alpha: 0.6 + Math.random() * 0.4,
      life: 0.1 + Math.random() * 0.1,
      color: this.config.color,
    });
  }

  // ========================================================================
  // RUNES EFFECT
  // ========================================================================

  private initializeRunes(): void {
    const count = Math.floor(8 * this.config.frequency);
    for (let i = 0; i < count; i++) {
      this.spawnRune();
    }
  }

  private spawnRune(): void {
    this.floatingRunes.push({
      x: Math.random() * this.width,
      y: Math.random() * this.height * 0.7,
      size: 8 + Math.random() * 12,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.5,
      alpha: 0.15 + Math.random() * 0.25,
      shape: Math.floor(Math.random() * 6),
      pulsePhase: Math.random() * Math.PI * 2,
    });
  }

  private updateRunes(dt: number): void {
    // Spawn new runes occasionally
    if (this.floatingRunes.length < 12 && Math.random() < 0.01) {
      this.spawnRune();
    }

    for (const rune of this.floatingRunes) {
      rune.rotation += rune.rotationSpeed * dt;
      rune.pulsePhase += dt * 2;
      rune.y -= dt * 5; // Slow float upward

      // Wrap around
      if (rune.y < -rune.size * 2) {
        rune.y = this.height + rune.size;
        rune.x = Math.random() * this.width;
      }

      const pulse = Math.sin(rune.pulsePhase) * 0.3 + 0.7;
      const alpha = rune.alpha * pulse * this.config.intensity;

      // Draw rune shape
      this.drawRuneShape(rune.x, rune.y, rune.size, rune.rotation, rune.shape, alpha);
    }
  }

  private drawRuneShape(
    x: number, y: number, size: number, rotation: number, shape: number, alpha: number
  ): void {
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);

    const rotatePoint = (px: number, py: number) => ({
      x: x + px * cos - py * sin,
      y: y + px * sin + py * cos,
    });

    switch (shape) {
      case 0: // Triangle
        {
          const p1 = rotatePoint(0, -size);
          const p2 = rotatePoint(-size * 0.866, size * 0.5);
          const p3 = rotatePoint(size * 0.866, size * 0.5);
          this.graphics
            .moveTo(p1.x, p1.y)
            .lineTo(p2.x, p2.y)
            .lineTo(p3.x, p3.y)
            .closePath()
            .stroke({ color: this.config.color, alpha, width: 2 });
        }
        break;
      case 1: // Diamond
        {
          const p1 = rotatePoint(0, -size);
          const p2 = rotatePoint(-size * 0.6, 0);
          const p3 = rotatePoint(0, size);
          const p4 = rotatePoint(size * 0.6, 0);
          this.graphics
            .moveTo(p1.x, p1.y)
            .lineTo(p2.x, p2.y)
            .lineTo(p3.x, p3.y)
            .lineTo(p4.x, p4.y)
            .closePath()
            .stroke({ color: this.config.color, alpha, width: 2 });
        }
        break;
      case 2: // Circle with cross
        this.graphics.circle(x, y, size * 0.8).stroke({ color: this.config.color, alpha, width: 2 });
        {
          const h1 = rotatePoint(-size, 0);
          const h2 = rotatePoint(size, 0);
          const v1 = rotatePoint(0, -size);
          const v2 = rotatePoint(0, size);
          this.graphics
            .moveTo(h1.x, h1.y).lineTo(h2.x, h2.y)
            .moveTo(v1.x, v1.y).lineTo(v2.x, v2.y)
            .stroke({ color: this.config.color, alpha: alpha * 0.8, width: 1.5 });
        }
        break;
      case 3: // Star
        for (let i = 0; i < 5; i++) {
          const angle1 = (i / 5) * Math.PI * 2 - Math.PI / 2;
          const angle2 = ((i + 2) / 5) * Math.PI * 2 - Math.PI / 2;
          const p1 = rotatePoint(Math.cos(angle1) * size, Math.sin(angle1) * size);
          const p2 = rotatePoint(Math.cos(angle2) * size, Math.sin(angle2) * size);
          this.graphics
            .moveTo(p1.x, p1.y)
            .lineTo(p2.x, p2.y)
            .stroke({ color: this.config.color, alpha, width: 2 });
        }
        break;
      case 4: // Hexagon
        for (let i = 0; i < 6; i++) {
          const angle1 = (i / 6) * Math.PI * 2;
          const angle2 = ((i + 1) / 6) * Math.PI * 2;
          const p1 = rotatePoint(Math.cos(angle1) * size, Math.sin(angle1) * size);
          const p2 = rotatePoint(Math.cos(angle2) * size, Math.sin(angle2) * size);
          this.graphics
            .moveTo(p1.x, p1.y)
            .lineTo(p2.x, p2.y)
            .stroke({ color: this.config.color, alpha, width: 2 });
        }
        break;
      case 5: // Eye shape
        this.graphics
          .ellipse(x, y, size, size * 0.5)
          .stroke({ color: this.config.color, alpha, width: 2 });
        this.graphics.circle(x, y, size * 0.3).fill({ color: this.config.color, alpha: alpha * 0.6 });
        break;
    }

    // Glow
    this.graphics.circle(x, y, size * 1.5).fill({ color: this.config.color, alpha: alpha * 0.1 });
  }

  // ========================================================================
  // PORTALS EFFECT
  // ========================================================================

  private initializePortals(): void {
    const count = Math.floor(3 * this.config.frequency);
    for (let i = 0; i < count; i++) {
      this.portals.push({
        x: this.width * (0.15 + Math.random() * 0.7),
        y: this.height * (0.1 + Math.random() * 0.4),
        radius: 20 + Math.random() * 30,
        rotation: Math.random() * Math.PI * 2,
        alpha: 0.1 + Math.random() * 0.15,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }
  }

  private updatePortals(dt: number): void {
    for (const portal of this.portals) {
      portal.rotation += dt * 0.5;
      portal.pulsePhase += dt * 1.5;

      const pulse = Math.sin(portal.pulsePhase) * 0.3 + 0.7;
      const alpha = portal.alpha * pulse * this.config.intensity;

      // Draw concentric ellipses
      for (let ring = 0; ring < 3; ring++) {
        const ringScale = 1 - ring * 0.25;
        const ringAlpha = alpha * (1 - ring * 0.3);

        this.graphics
          .ellipse(
            portal.x,
            portal.y,
            portal.radius * ringScale,
            portal.radius * ringScale * 0.4
          )
          .stroke({ color: this.config.color, alpha: ringAlpha, width: 2 });
      }

      // Central glow
      this.graphics
        .ellipse(portal.x, portal.y, portal.radius * 0.3, portal.radius * 0.12)
        .fill({ color: this.config.secondaryColor || this.config.color, alpha: alpha * 0.5 });

      // Outer glow
      this.graphics
        .ellipse(portal.x, portal.y, portal.radius * 1.5, portal.radius * 0.6)
        .fill({ color: this.config.color, alpha: alpha * 0.15 });
    }
  }

  // ========================================================================
  // DIVINE RAYS EFFECT
  // ========================================================================

  private initializeDivineRays(): void {
    const count = Math.floor(5 * this.config.frequency);
    for (let i = 0; i < count; i++) {
      this.divineRays.push({
        x: this.width * (0.1 + (i / count) * 0.8),
        angle: Math.PI / 2 + (Math.random() - 0.5) * 0.3,
        width: 30 + Math.random() * 50,
        alpha: 0.05 + Math.random() * 0.1,
        length: this.height * (0.5 + Math.random() * 0.4),
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }
  }

  private updateDivineRays(dt: number): void {
    for (const ray of this.divineRays) {
      ray.pulsePhase += dt * 0.8;

      const pulse = Math.sin(ray.pulsePhase) * 0.4 + 0.6;
      const alpha = ray.alpha * pulse * this.config.intensity;

      // Draw ray as a gradient triangle
      const endX = ray.x + Math.cos(ray.angle) * ray.length;
      const endY = Math.sin(ray.angle) * ray.length;

      const perpX = Math.cos(ray.angle + Math.PI / 2);
      // perpY not needed for this simple vertical ray implementation

      // Wide at top, narrow at bottom
      const topLeft = { x: ray.x - perpX * ray.width / 2, y: 0 };
      const topRight = { x: ray.x + perpX * ray.width / 2, y: 0 };
      const bottom = { x: endX, y: endY };

      this.graphics
        .moveTo(topLeft.x, topLeft.y)
        .lineTo(topRight.x, topRight.y)
        .lineTo(bottom.x, bottom.y)
        .closePath()
        .fill({ color: this.config.color, alpha });

      // Brighter center line
      this.graphics
        .moveTo(ray.x, 0)
        .lineTo(endX, endY)
        .stroke({ color: this.config.secondaryColor || 0xffffff, alpha: alpha * 2, width: 2 });
    }
  }

  public destroy(): void {
    this.clearAllEffects();
    this.graphics.destroy();
  }
}
