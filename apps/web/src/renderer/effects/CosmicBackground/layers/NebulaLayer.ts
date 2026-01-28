/**
 * NebulaLayer - Procedural nebula rendering using Mesh with custom shader
 * Creates realistic cosmic nebulae with perlin noise and smooth gradients
 */

import { Container } from 'pixi.js';
import type { NebulaConfig, QualityLevel } from '../types.js';
import { NebulaMesh } from '../shaders/NebulaMesh.js';

export class NebulaLayer {
  private container: Container;
  private nebulaMesh: NebulaMesh | null = null;
  private config: NebulaConfig;

  constructor(config: NebulaConfig, _quality: QualityLevel) {
    this.container = new Container();
    this.config = config;
  }

  public getGraphics(): Container {
    return this.container;
  }

  public setConfig(config: NebulaConfig): void {
    this.config = config;
    this.updateMeshColors();
  }

  public setQuality(_quality: QualityLevel): void {
    // Quality adjustments can be added later
  }

  public initialize(width: number, height: number): void {
    if (!this.config.enabled) {
      return;
    }

    // Remove old mesh if exists
    if (this.nebulaMesh) {
      this.container.removeChild(this.nebulaMesh);
      this.nebulaMesh.destroy();
    }

    // Get colors from config
    const colors = this.config.colors;
    const color1 = colors[0] || 0x1a0a40;
    const color2 = colors[1] || colors[0] || 0x4020a0;
    const color3 = colors[2] || colors[1] || colors[0] || 0x8040ff;

    // Create nebula mesh with shader
    try {
      this.nebulaMesh = new NebulaMesh(width, height, {
        color1,
        color2,
        color3,
        intensity: this.config.opacity,
        scale: this.config.scale * 2,
      });

      this.container.addChild(this.nebulaMesh);
    } catch (e) {
      console.error('[NebulaLayer] Failed to create NebulaMesh:', e);
    }
  }

  private updateMeshColors(): void {
    if (!this.nebulaMesh || !this.config.enabled) return;

    const colors = this.config.colors;
    const color1 = colors[0] || 0x1a0a40;
    const color2 = colors[1] || colors[0] || 0x4020a0;
    const color3 = colors[2] || colors[1] || colors[0] || 0x8040ff;

    this.nebulaMesh.setColors(color1, color2, color3);
    this.nebulaMesh.intensity = this.config.opacity;
    this.nebulaMesh.nebulaScale = this.config.scale * 2;
  }

  public update(deltaMS: number): void {
    if (!this.config.enabled || !this.nebulaMesh) return;

    // Update shader time for animation
    this.nebulaMesh.update(deltaMS * this.config.animationSpeed);
  }

  public getNebulaCount(): number {
    return this.nebulaMesh ? 1 : 0;
  }

  public destroy(): void {
    if (this.nebulaMesh) {
      this.nebulaMesh.destroy();
      this.nebulaMesh = null;
    }
    this.container.destroy();
  }
}
