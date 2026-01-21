import { Application, Container } from "pixi.js";
import type {
  GameState,
  EnemyType,
  FortressClass,
  ActiveHero,
  ActiveTurret,
  TurretSlot,
  PillarId,
} from "@arcade/sim-core";
import { FP } from "@arcade/sim-core";
import { EnemySystem } from "../systems/EnemySystem.js";
import { ProjectileSystem } from "../systems/ProjectileSystem.js";
import { HeroSystem } from "../systems/HeroSystem.js";
import { TurretSystem } from "../systems/TurretSystem.js";
import { WallSystem } from "../systems/WallSystem.js";
import { MilitiaSystem } from "../systems/MilitiaSystem.js";
import { LightingSystem } from "../effects/LightingSystem.js";
import {
  parallaxBackground,
  ParallaxBackground,
} from "../effects/ParallaxBackground.js";
import { fpXToScreen } from "../CoordinateSystem.js";

// Import extracted components
import { EnvironmentRenderer, themeManager } from "./environment/index.js";
import { SceneInputController } from "./input/SceneInputController.js";
import { SceneEffects } from "./effects/SceneEffects.js";

// Hub state type for idle phase rendering
export interface HubState {
  heroes: ActiveHero[];
  turrets: ActiveTurret[];
  turretSlots: TurretSlot[];
}

/**
 * GameScene orchestrates all rendering systems for the game.
 * 
 * Composed of:
 * - EnvironmentRenderer: Static background (sky, deck, tower)
 * - SceneInputController: Interactive layer and field clicks
 * - SceneEffects: VFX, lighting, hitstop, wave effects
 * - Entity systems: Enemies, heroes, turrets, projectiles, walls, militia
 */
export class GameScene {
  public container: Container;

  // Composed components
  private environment: EnvironmentRenderer;
  private inputController: SceneInputController;
  private effects: SceneEffects;

  // Entity rendering systems
  private enemySystem: EnemySystem;
  private projectileSystem: ProjectileSystem;
  private heroSystem: HeroSystem;
  private turretSystem: TurretSystem;
  private wallSystem: WallSystem;
  private militiaSystem: MilitiaSystem;

  // Exposed for external access
  public lighting: LightingSystem;
  public parallax: ParallaxBackground;

  private width = 0;
  private height = 0;
  private wasInGame = false;
  private lastUpdateTime = 0;

  // Track current pillar for theme changes
  private currentPillar: PillarId = "streets";

  constructor(_app: Application) {
    this.container = new Container();
    this.container.interactiveChildren = true;

    // Parallax Background (behind everything)
    this.parallax = parallaxBackground;
    this.container.addChild(this.parallax.container);

    // Environment Renderer (static background: sky, deck, tower)
    this.environment = new EnvironmentRenderer();
    this.container.addChild(this.environment.container);

    // Turret System (behind other entities, part of environment)
    this.turretSystem = new TurretSystem();
    this.container.addChild(this.turretSystem.container);

    // Wall System (defensive barriers, below enemies)
    this.wallSystem = new WallSystem();
    this.container.addChild(this.wallSystem.container);

    // Enemy System (Retained Mode)
    this.enemySystem = new EnemySystem();
    this.container.addChild(this.enemySystem.container);

    // Militia System (friendly units, same level as enemies)
    this.militiaSystem = new MilitiaSystem();
    this.container.addChild(this.militiaSystem.container);

    // Hero System (heroes on battlefield)
    this.heroSystem = new HeroSystem();
    this.container.addChild(this.heroSystem.container);

    // Projectile System (above entities)
    this.projectileSystem = new ProjectileSystem();
    this.container.addChild(this.projectileSystem.container);

    // Scene Effects (VFX + Lighting)
    this.effects = new SceneEffects();
    this.container.addChild(this.effects.vfxContainer);

    // Connect projectile impacts to VFX system
    this.projectileSystem.setImpactCallback((x, y, fortressClass) => {
      this.effects.spawnHitImpact(x, y, fortressClass);
    });

    // Lighting System (additive blend, on top of VFX)
    this.lighting = this.effects.lighting;
    this.container.addChild(this.effects.lightingContainer);

    // Input Controller (interactive layer on top)
    this.inputController = new SceneInputController();
    this.container.addChild(this.inputController.container);
  }

  public onResize(width: number, height: number) {
    this.width = width;
    this.height = height;

    // Initialize parallax with new dimensions
    this.parallax.initialize(width, height);

    // Resize components
    this.effects.onResize();
    this.effects.setDimensions(width, height);
    this.environment.onResize(width, height);
    this.inputController.onResize(width, height);
  }

  /**
   * Set callback for hero click events in hub mode
   */
  public setOnHeroClick(callback: (heroId: string) => void) {
    this.heroSystem.setOnHeroClick(callback);
  }

  /**
   * Set callback for turret click events in hub mode
   */
  public setOnTurretClick(
    callback: (turretId: string, slotIndex: number) => void,
  ) {
    this.turretSystem.setOnTurretClick(callback);
  }

  /**
   * Set callback for field click events (tactical commands)
   */
  public setOnFieldClick(
    callback: ((worldX: number, worldY: number) => void) | null,
  ) {
    this.inputController.setOnFieldClick(callback);
  }

  /**
   * Set callback for screen shake effects (connected to VFXSystem)
   */
  public setScreenShakeCallback(
    callback: (intensity: number, duration: number) => void,
  ) {
    this.effects.setScreenShakeCallback(callback);
  }

  public update(state: GameState | null, alpha: number, hubState?: HubState) {
    const now = performance.now();
    const deltaMs =
      this.lastUpdateTime > 0 ? Math.min(50, Math.max(8, now - this.lastUpdateTime)) : 16.66;
    this.lastUpdateTime = now;
    const renderAlpha = Math.max(0, Math.min(1, alpha));

    // Ensure we have dimensions
    if (this.width === 0 || this.height === 0) return;

    if (state) {
      this.wasInGame = true;
      // Enable interactive layer during gameplay for tactical commands
      this.inputController.enableInteraction();

      // Check for pillar/theme change
      if (state.currentPillar !== this.currentPillar) {
        this.currentPillar = state.currentPillar;
        this.updateTheme(state.currentPillar);
      }

      // Wave complete effect
      this.effects.checkWaveComplete(state.wavesCleared);

      // Low HP warning effect
      const hpPercent = state.fortressHp / state.fortressMaxHp;
      this.effects.checkLowHpWarning(hpPercent);

      // Hitstop on elite kill - returns true if in hitstop (should skip updates)
      if (this.effects.checkHitstop(state.eliteKills, deltaMs)) {
        // Update environment (for dynamic portal)
        const hasActiveEnemies = state.enemies && state.enemies.length > 0;
        this.environment.update(deltaMs, hasActiveEnemies);
        return; // Skip rest of update - freeze frame effect
      }

      // Track fortress class and tier changes
      const newTier = state.commanderLevel < 10 ? 1 : state.commanderLevel < 25 ? 2 : 3;
      this.environment.setFortressState(state.fortressClass, newTier);

      // Update environment (static + dynamic layers)
      const hasActiveEnemies = state.enemies && state.enemies.length > 0;
      this.environment.update(deltaMs, hasActiveEnemies);

      // Update entity systems
      this.turretSystem.update(state, this.width, this.height);
      this.wallSystem.update(state, this.width, this.height, this.effects.vfx);
      this.enemySystem.update(state, this.width, this.height, this.effects.vfx, renderAlpha);
      this.militiaSystem.update(state, this.width, this.height, this.effects.vfx, renderAlpha);
      this.heroSystem.update(state, this.width, this.height, this.effects.vfx, renderAlpha);
      this.projectileSystem.update(state, this.width, this.height, renderAlpha, deltaMs);
    } else {
      // Disable interactive layer in hub mode so heroes can be clicked
      this.inputController.disableInteraction();

      // Hard reset effects on transition to hub
      if (this.wasInGame) {
        this.effects.resetForHub();
        this.wasInGame = false;
      }

      // Clear any lingering filters from previous game session
      this.effects.clearLowHpWarning();

      // Update environment (no active enemies in hub mode)
      this.environment.update(deltaMs, false);

      if (hubState) {
        // Render hub state when in idle phase (before session starts)
        this.updateHub(hubState);
      }
      this.clearCombatVisuals();
    }

    // Update Parallax background
    this.parallax.update(deltaMs);

    // Update effects (VFX + lighting)
    this.effects.update(deltaMs);
  }

  /**
   * Update environment theme based on pillar.
   * Updates both EnvironmentRenderer and ParallaxBackground.
   */
  private updateTheme(pillarId: PillarId): void {
    // Update environment renderer theme
    this.environment.setTheme(pillarId);

    // Update parallax background with theme config
    const theme = themeManager.getThemeForPillar(pillarId);
    this.parallax.setTheme(theme.parallax);
  }

  /**
   * Update hub visuals when in idle phase (before session starts).
   * Renders heroes and turrets on canvas, HTML overlay handles empty slots only.
   */
  private updateHub(hubState: HubState) {
    // Create state object with heroes and turrets for rendering
    const hubGameState = {
      heroes: hubState.heroes,
      turrets: hubState.turrets,
      turretSlots: hubState.turretSlots,
      enemies: [],
    } as unknown as GameState;

    // Render turrets on canvas
    this.turretSystem.update(hubGameState, this.width, this.height);

    // Render heroes
    this.heroSystem.update(hubGameState, this.width, this.height);
  }

  private clearCombatVisuals() {
    const emptyState = {
      enemies: [],
      projectiles: [],
      walls: [],
      militia: [],
      kills: 0,
      tick: 0,
    } as unknown as GameState;

    this.enemySystem.update(emptyState, this.width, this.height);
    this.projectileSystem.update(emptyState, this.width, this.height);
    this.wallSystem.update(emptyState, this.width, this.height);
    this.militiaSystem.update(emptyState, this.width, this.height);
  }

  // Called by external controller when an enemy dies
  public onEnemyKilled(x: number, y: number, type: EnemyType = "runner") {
    const screenX = fpXToScreen(FP.fromInt(x), this.width);
    void y;
    void type;
    // For now this method is unused by internal logic as we use polling in update()
    // But we maintain API compatibility.
    this.spawnExplosion(screenX, 500, 0xffcc00); // Placeholder y
  }

  // --- Effect spawn methods (delegate to SceneEffects) ---

  public spawnExplosion(x: number, y: number, color: number) {
    this.effects.spawnExplosion(x, y, color);
    // Spawn ground crack at explosion location
    this.environment.spawnCrack(x, y);
  }

  public spawnClassExplosion(
    x: number,
    y: number,
    fortressClass: FortressClass,
  ) {
    this.effects.spawnClassExplosion(x, y, fortressClass);
    // Spawn ground crack at explosion location
    this.environment.spawnCrack(x, y);
  }

  public spawnClassImpact(x: number, y: number, fortressClass: FortressClass) {
    this.effects.spawnClassImpact(x, y, fortressClass);
    // Small chance of crack on impact (less frequent than explosions)
    if (Math.random() < 0.2) {
      this.environment.spawnCrack(x, y);
    }
  }

  public spawnSkillActivation(
    x: number,
    y: number,
    fortressClass: FortressClass,
    skillLevel?: number,
  ) {
    this.effects.spawnSkillActivation(x, y, fortressClass, skillLevel);

    // Trigger light flicker for electrical skills
    if (fortressClass === "lightning") {
      const intensity = skillLevel ? Math.min(1.0, 0.5 + skillLevel * 0.1) : 0.7;
      this.environment.triggerLightFlicker(intensity);
    }

    // Strong skills can cause ground cracks
    if (skillLevel && skillLevel >= 2) {
      this.environment.spawnCrack(x, y);
    }
  }

  public spawnHeroDeployment(
    x: number,
    y: number,
    fortressClass: FortressClass,
  ) {
    this.effects.spawnHeroDeployment(x, y, fortressClass);
    // Lightning heroes cause flicker on deployment
    if (fortressClass === "lightning") {
      this.environment.triggerLightFlicker(0.5);
    }
  }

  public spawnTurretFire(
    x: number,
    y: number,
    angle: number,
    fortressClass: FortressClass,
  ) {
    this.effects.spawnTurretFire(x, y, angle, fortressClass);
    // Lightning turrets cause subtle flicker
    if (fortressClass === "lightning") {
      this.environment.triggerLightFlicker(0.3);
    }
  }
}
