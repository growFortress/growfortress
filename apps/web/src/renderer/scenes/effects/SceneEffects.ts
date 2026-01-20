import type { FortressClass } from "@arcade/sim-core";
import { VFXSystem } from "../../systems/VFXSystem.js";
import { lightingSystem, LightingSystem } from "../../effects/LightingSystem.js";
import { filterManager } from "../../effects/FilterManager.js";

/**
 * SceneEffects coordinates all visual effects for the game scene:
 * - VFX system (explosions, impacts, skill activations, etc.)
 * - Lighting system (dynamic flashes)
 * - Screen effects (hitstop, low HP warning, wave complete)
 * - Filter manager integration
 */
export class SceneEffects {
  public readonly vfx: VFXSystem;
  public readonly lighting: LightingSystem;

  // Track waves for wave complete effects
  private prevWavesCleared = 0;

  // Track elite kills for hitstop effect
  private prevEliteKills = 0;
  private hitstopRemaining = 0; // Frames to skip for hitstop

  // Screen dimensions for effect positioning
  private width = 0;
  private height = 0;

  constructor() {
    // Initialize VFX System
    this.vfx = new VFXSystem();

    // Initialize Lighting System
    this.lighting = lightingSystem;

    // Connect VFX to lighting system for dynamic flashes
    this.vfx.setLightingCallback((x, y, color, radius) => {
      this.lighting.spawnFlash(x, y, color, radius);
    });
  }

  /**
   * Get VFX container for scene hierarchy.
   */
  public get vfxContainer() {
    return this.vfx.container;
  }

  /**
   * Get lighting container for scene hierarchy.
   */
  public get lightingContainer() {
    return this.lighting.container;
  }

  /**
   * Update screen dimensions for effect positioning.
   */
  public setDimensions(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  /**
   * Handle resize - recreates lighting graphics.
   */
  public onResize(): void {
    this.lighting.recreateGraphics();
  }

  /**
   * Set callback for screen shake effects.
   */
  public setScreenShakeCallback(callback: (intensity: number, duration: number) => void): void {
    this.vfx.setScreenShakeCallback(callback);
  }

  /**
   * Set callback for projectile impacts.
   */
  public setImpactCallback(callback: (x: number, y: number, fortressClass: FortressClass) => void): void {
    // This will be called by ProjectileSystem
    void callback; // Callback is set directly on projectile system
  }

  /**
   * Check and trigger wave complete effect.
   * Returns true if wave complete was triggered.
   */
  public checkWaveComplete(wavesCleared: number): boolean {
    if (wavesCleared > this.prevWavesCleared && this.prevWavesCleared > 0) {
      this.triggerWaveCompleteEffect(wavesCleared);
      this.prevWavesCleared = wavesCleared;
      return true;
    }
    this.prevWavesCleared = wavesCleared;
    return false;
  }

  /**
   * Check and apply low HP warning effect.
   */
  public checkLowHpWarning(hpPercent: number): void {
    if (hpPercent < 0.15) {
      filterManager.setLowHpWarning(2); // Critical
    } else if (hpPercent < 0.3) {
      filterManager.setLowHpWarning(1); // Warning
    } else {
      filterManager.setLowHpWarning(0); // Clear
    }
  }

  /**
   * Clear low HP warning (e.g., when entering hub mode).
   */
  public clearLowHpWarning(): void {
    filterManager.setLowHpWarning(0);
  }

  /**
   * Check and trigger hitstop on elite kill.
   * Returns true if currently in hitstop (should skip visual updates).
   */
  public checkHitstop(eliteKills: number): boolean {
    // Trigger new hitstop on elite kill
    if (eliteKills > this.prevEliteKills) {
      this.hitstopRemaining = Math.max(this.hitstopRemaining, 3); // ~50ms at 60fps (3 frames)
    }
    this.prevEliteKills = eliteKills;

    // Process hitstop countdown
    if (this.hitstopRemaining > 0) {
      this.hitstopRemaining--;
      // Still update VFX during hitstop (they look better continuing)
      this.vfx.update(16.66);
      return true; // In hitstop
    }
    return false; // Not in hitstop
  }

  /**
   * Update effects (VFX and lighting).
   */
  public update(deltaMs: number): void {
    this.vfx.update(deltaMs);
    this.lighting.update(deltaMs);
  }

  // --- Spawn methods (delegate to VFX) ---

  public spawnExplosion(x: number, y: number, color: number): void {
    this.vfx.spawnExplosion(x, y, color);
  }

  public spawnClassExplosion(x: number, y: number, fortressClass: FortressClass): void {
    this.vfx.spawnClassExplosion(x, y, fortressClass);
  }

  public spawnClassImpact(x: number, y: number, fortressClass: FortressClass): void {
    this.vfx.spawnClassImpact(x, y, fortressClass);
  }

  public spawnHitImpact(x: number, y: number, fortressClass: FortressClass): void {
    this.vfx.spawnHitImpact(x, y, fortressClass);
    this.hitstopRemaining = Math.max(this.hitstopRemaining, 2); // Short hit-stop for tactile hits
  }

  public spawnSkillActivation(
    x: number,
    y: number,
    fortressClass: FortressClass,
    skillLevel?: number,
  ): void {
    this.vfx.spawnSkillActivation(x, y, fortressClass, skillLevel);
  }

  public spawnHeroDeployment(x: number, y: number, fortressClass: FortressClass): void {
    this.vfx.spawnHeroDeployment(x, y, fortressClass);
  }

  public spawnTurretFire(x: number, y: number, angle: number, fortressClass: FortressClass): void {
    this.vfx.spawnTurretFire(x, y, angle, fortressClass);
  }

  /**
   * Trigger visual effects when a wave is completed.
   * White screen flash + "WAVE X COMPLETE" floating text.
   */
  private triggerWaveCompleteEffect(wave: number): void {
    // Screen flash
    filterManager.applyScreenFlash("white", 200, 0.3);

    // Floating text in center of screen
    const centerX = this.width / 2;
    const centerY = this.height / 3;
    this.vfx.spawnFloatingText(centerX, centerY, `WAVE ${wave} COMPLETE!`, 0x00ff9d);
  }
}
