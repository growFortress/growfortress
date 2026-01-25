import type { FortressClass } from "@arcade/sim-core";
import { VFXSystem } from "../../systems/VFXSystem.js";
import { lightingSystem, LightingSystem } from "../../effects/LightingSystem.js";
import { filterManager } from "../../effects/FilterManager.js";
import i18n from "../../../i18n/index.js";
import { speedSettings } from "../../../state/settings.signals.js";

// Hitstop intensity levels
export type HitstopIntensity = 'minor' | 'major' | 'epic';

// Hitstop frame counts per intensity
const HITSTOP_FRAMES: Record<HitstopIntensity, number> = {
  minor: 2,  // Quick pause for regular hits
  major: 4,  // Noticeable pause for crits/elite kills
  epic: 8,   // Dramatic pause for boss kills/multi-kills
};

/**
 * SceneEffects coordinates all visual effects for the game scene:
 * - VFX system (explosions, impacts, skill activations, etc.)
 * - Lighting system (dynamic flashes)
 * - Screen effects (hitstop, low HP warning, wave complete)
 * - Camera effects (punch zoom, slow motion)
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

  // Camera effects state
  private cameraScale = 1;
  private targetCameraScale = 1;
  private cameraShakeX = 0;
  private cameraShakeY = 0;
  private cameraShakeIntensity = 0;
  private cameraShakeDuration = 0;
  private cameraShakeDirectionX = 0;
  private cameraShakeDirectionY = 0;

  // Slow motion state
  private slowMotionScale = 1;
  private slowMotionDuration = 0;

  // Punch zoom state
  private punchZoomPhase = 0; // 0 = inactive, 1 = zoom out, 2 = zoom in
  private punchZoomProgress = 0;
  private punchZoomIntensity = 0;

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
      // Skip animation if setting is enabled (for faster gameplay)
      if (!speedSettings.value.skipWaveAnimations) {
        this.triggerWaveCompleteEffect(wavesCleared);
      }
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
  public checkHitstop(eliteKills: number, deltaMs: number): boolean {
    // Trigger new hitstop on elite kill
    if (eliteKills > this.prevEliteKills) {
      this.hitstopRemaining = Math.max(this.hitstopRemaining, 3); // ~50ms at 60fps (3 frames)
    }
    this.prevEliteKills = eliteKills;

    // Process hitstop countdown
    if (this.hitstopRemaining > 0) {
      this.hitstopRemaining--;
      // Still update VFX during hitstop (they look better continuing)
      this.vfx.update(deltaMs);
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

  /**
   * Hard reset of all active effects when entering hub.
   */
  public resetForHub(): void {
    this.vfx.clearAll();
    this.lighting.clearLights();
    filterManager.clearAll();
    filterManager.setLowHpWarning(0);
    this.hitstopRemaining = 0;
    this.prevEliteKills = 0;
    this.prevWavesCleared = 0;
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
    skillId?: string,
  ): void {
    this.vfx.spawnSkillActivation(x, y, fortressClass, skillLevel ?? 1, skillId);
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
    this.vfx.spawnFloatingText(
      centerX,
      centerY,
      i18n.t("game:waveComplete", { wave }),
      0x00ff9d,
    );
  }

  // ============================================================================
  // CAMERA EFFECTS - Epic combat feedback
  // ============================================================================

  /**
   * Trigger hitstop with variable intensity
   * Reduced or skipped at higher game speeds
   */
  public triggerHitstop(intensity: HitstopIntensity): void {
    // Skip hitstop at 5x speed for smoother fast gameplay
    if (speedSettings.value.speedMultiplier >= 5) return;

    let frames = HITSTOP_FRAMES[intensity];
    // Reduce hitstop at 2x speed
    if (speedSettings.value.speedMultiplier >= 2) {
      frames = Math.ceil(frames / 2);
    }
    this.hitstopRemaining = Math.max(this.hitstopRemaining, frames);
  }

  /**
   * Trigger a punch zoom effect (quick zoom out then in)
   * Creates satisfying impact feel on big kills
   */
  public triggerPunchZoom(intensity: number = 1.0): void {
    if (this.punchZoomPhase !== 0) return; // Already animating
    this.punchZoomPhase = 1;
    this.punchZoomProgress = 0;
    this.punchZoomIntensity = Math.min(intensity, 1.5);
  }

  /**
   * Trigger directional camera shake
   * Shakes primarily in the direction of impact
   */
  public triggerDirectionalShake(
    dirX: number,
    dirY: number,
    intensity: number,
    duration: number = 200
  ): void {
    // Normalize direction
    const len = Math.sqrt(dirX * dirX + dirY * dirY);
    if (len > 0) {
      this.cameraShakeDirectionX = dirX / len;
      this.cameraShakeDirectionY = dirY / len;
    } else {
      this.cameraShakeDirectionX = 1;
      this.cameraShakeDirectionY = 0;
    }
    this.cameraShakeIntensity = Math.max(this.cameraShakeIntensity, intensity);
    this.cameraShakeDuration = Math.max(this.cameraShakeDuration, duration);
  }

  /**
   * Trigger slow motion effect
   * Time scale goes from 1 to target over duration
   * Reduced or skipped at higher game speeds
   */
  public triggerSlowMotion(duration: number, scale: number = 0.3): void {
    // Skip slow motion at 5x speed - would be jarring
    if (speedSettings.value.speedMultiplier >= 5) return;

    // Reduce slow motion at 2x speed
    if (speedSettings.value.speedMultiplier >= 2) {
      duration = Math.ceil(duration / 2);
      scale = 1 - (1 - scale) / 2; // Halve the slowdown effect
    }

    this.slowMotionDuration = duration;
    this.slowMotionScale = scale;
  }

  /**
   * Get current time scale (for slow motion)
   */
  public getTimeScale(): number {
    return this.slowMotionScale;
  }

  /**
   * Get camera transform (scale and offset from shake)
   */
  public getCameraTransform(): { scale: number; offsetX: number; offsetY: number } {
    return {
      scale: this.cameraScale,
      offsetX: this.cameraShakeX,
      offsetY: this.cameraShakeY,
    };
  }

  /**
   * Update camera effects (call every frame)
   */
  public updateCameraEffects(deltaMs: number): void {
    const dt = deltaMs / 1000;

    // Update punch zoom
    if (this.punchZoomPhase > 0) {
      const punchSpeed = 15; // Speed of punch animation
      this.punchZoomProgress += dt * punchSpeed;

      if (this.punchZoomPhase === 1) {
        // Zoom out phase
        const zoomOut = 1 - this.punchZoomIntensity * 0.08;
        this.targetCameraScale = zoomOut;
        if (this.punchZoomProgress >= 0.3) {
          this.punchZoomPhase = 2;
          this.punchZoomProgress = 0;
        }
      } else if (this.punchZoomPhase === 2) {
        // Zoom in phase (overshoot then settle)
        const t = Math.min(this.punchZoomProgress / 0.5, 1);
        const overshoot = 1 + this.punchZoomIntensity * 0.03 * (1 - t);
        this.targetCameraScale = overshoot;
        if (this.punchZoomProgress >= 0.5) {
          this.punchZoomPhase = 0;
          this.targetCameraScale = 1;
        }
      }
    }

    // Smooth camera scale
    const scaleLerp = 1 - Math.pow(0.001, dt);
    this.cameraScale += (this.targetCameraScale - this.cameraScale) * scaleLerp;

    // Update camera shake
    if (this.cameraShakeDuration > 0) {
      this.cameraShakeDuration -= deltaMs;
      const progress = Math.max(0, this.cameraShakeDuration / 200);
      const intensity = this.cameraShakeIntensity * progress;

      // Combine directional shake with random shake
      const randomX = (Math.random() - 0.5) * 2;
      const randomY = (Math.random() - 0.5) * 2;
      const dirWeight = 0.6; // How much shake follows direction

      this.cameraShakeX = intensity * (
        this.cameraShakeDirectionX * dirWeight +
        randomX * (1 - dirWeight)
      );
      this.cameraShakeY = intensity * (
        this.cameraShakeDirectionY * dirWeight +
        randomY * (1 - dirWeight)
      );

      if (this.cameraShakeDuration <= 0) {
        this.cameraShakeX = 0;
        this.cameraShakeY = 0;
        this.cameraShakeIntensity = 0;
      }
    }

    // Update slow motion
    if (this.slowMotionDuration > 0) {
      this.slowMotionDuration -= deltaMs;
      if (this.slowMotionDuration <= 0) {
        // Ease back to normal speed
        this.slowMotionScale = 1;
      }
    } else {
      // Ease slow motion scale back to 1
      const slowLerp = 1 - Math.pow(0.01, dt);
      this.slowMotionScale += (1 - this.slowMotionScale) * slowLerp;
    }
  }

  /**
   * Trigger effects for a big kill (high damage or elite)
   */
  public triggerBigKillEffects(
    _x: number,
    _y: number,
    isBoss: boolean = false
  ): void {
    // x, y reserved for future position-based effects (directional shake)
    if (isBoss) {
      // Boss kill - epic treatment
      this.triggerHitstop('epic');
      this.triggerPunchZoom(1.3);
      this.triggerSlowMotion(300, 0.2);
      filterManager.applyScreenFlash("white", 300, 0.5);
    } else {
      // Elite/big kill
      this.triggerHitstop('major');
      this.triggerPunchZoom(0.8);
      filterManager.applyScreenFlash("white", 150, 0.2);
    }
  }

  /**
   * Trigger effects for multi-kill
   */
  public triggerMultiKillEffects(killCount: number): void {
    if (killCount >= 5) {
      this.triggerHitstop('major');
      this.triggerSlowMotion(200, 0.4);
    } else if (killCount >= 3) {
      this.triggerHitstop('minor');
    }
  }
}
