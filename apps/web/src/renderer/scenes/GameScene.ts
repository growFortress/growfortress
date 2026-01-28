import { Application, Container, Graphics } from "pixi.js";
import type {
  GameState,
  EnemyType,
  FortressClass,
  ActiveHero,
  ActiveTurret,
  TurretSlot,
  PillarId,
} from "@arcade/sim-core";
import { FP, getSkillById, popDeathPhysics } from "@arcade/sim-core";
import { EnemySystem } from "../systems/EnemySystem.js";
import { ProjectileSystem } from "../systems/ProjectileSystem.js";
import { HeroSystem } from "../systems/HeroSystem.js";
import { TurretSystem } from "../systems/TurretSystem.js";
import { WallSystem } from "../systems/WallSystem.js";
import { MilitiaSystem } from "../systems/MilitiaSystem.js";
import { RagdollSystem } from "../systems/RagdollSystem.js";
import { LightingSystem } from "../effects/LightingSystem.js";
import {
  parallaxBackground,
  ParallaxBackground,
} from "../effects/ParallaxBackground.js";
import { fpXToScreen, fpYToScreen } from "../CoordinateSystem.js";
import { lastSkillTargetPositions, currentPillar } from "../../state/index.js";
import {
  bossRushActive,
  bossPosition,
  bossHp,
  bossMaxHp,
} from "../../state/boss-rush.signals.js";

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
interface GameSceneOptions {
  enableParallax?: boolean;
}

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
  private ragdollSystem: RagdollSystem;

  // Exposed for external access
  public lighting: LightingSystem;
  private parallax: ParallaxBackground | null = null;

  private width = 0;
  private height = 0;
  private wasInGame = false;
  private lastUpdateTime = 0;

  // Track current pillar for theme changes
  private currentPillar: PillarId = "streets";
  private hasInitializedTheme = false;
  private hasInitializedHubTheme = false;

  // Track fortress skill activations for VFX
  private lastSkillCooldowns: Record<string, number> = {};

  // Preview mode for viewing other players' hubs
  private isPreviewMode = false;
  private previewStaticTerrain = false;

  // Boss Rush rendering
  private bossGraphics: Graphics;

  constructor(_app: Application, options: GameSceneOptions = {}) {
    this.container = new Container();
    this.container.interactiveChildren = true;

    // Parallax Background (behind everything)
    if (options.enableParallax !== false) {
      this.parallax = parallaxBackground;
      this.container.addChild(this.parallax.container);
    }

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

    // Ragdoll System (flying dead enemies, above heroes)
    this.ragdollSystem = new RagdollSystem();
    this.container.addChild(this.ragdollSystem.container);

    // Projectile System (above entities)
    this.projectileSystem = new ProjectileSystem();
    this.container.addChild(this.projectileSystem.container);

    // Boss Graphics for stationary Boss Rush boss
    this.bossGraphics = new Graphics();
    this.container.addChild(this.bossGraphics);

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
    this.parallax?.initialize(width, height);

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
   * Set callback for hero click events during gameplay (tactical selection).
   */
  public setOnHeroSelect(callback: ((heroId: string) => void) | null) {
    this.inputController.setOnHeroClick(callback);
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
   * Set callback for field right click events (manual attack)
   */
  public setOnFieldRightClick(
    callback: ((worldX: number, worldY: number) => void) | null,
  ) {
    this.inputController.setOnFieldRightClick(callback);
  }

  /**
   * Set callback for hero drag events (tactical repositioning)
   */
  public setOnHeroDrag(
    callback: ((heroId: string, worldX: number, worldY: number) => void) | null,
  ) {
    this.inputController.setOnHeroDrag(callback);
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
      this.inputController.setManualAimActive(
        state.heroes.some((hero) => hero.isManualControlled === true),
      );

      // Check for pillar/theme change or initialize theme on first render
      if (!this.hasInitializedTheme || state.currentPillar !== this.currentPillar) {
        this.currentPillar = state.currentPillar;
        // Force theme update on first initialization to ensure correct theme is applied
        this.updateTheme(state.currentPillar, !this.hasInitializedTheme);
        this.hasInitializedTheme = true;
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
      this.environment.setFortressHp(hpPercent);

      // Update environment (static + dynamic layers)
      const hasActiveEnemies = state.enemies && state.enemies.length > 0;
      this.environment.update(deltaMs, hasActiveEnemies);

      // Detect fortress skill activations and trigger VFX
      this.detectFortressSkillActivations(state);

      // Update entity systems
      this.inputController.updateHeroTargets(
        state.heroes,
        this.width,
        this.height,
        renderAlpha,
      );
      this.turretSystem.update(state, this.width, this.height);
      this.wallSystem.update(state, this.width, this.height, this.effects.vfx);
      this.enemySystem.update(state, this.width, this.height, this.effects.vfx, renderAlpha, deltaMs);
      this.militiaSystem.update(state, this.width, this.height, this.effects.vfx, renderAlpha);
      this.heroSystem.update(state, this.width, this.height, this.effects.vfx, renderAlpha);
      this.projectileSystem.update(state, this.width, this.height, renderAlpha, deltaMs);

      // Boss Rush: Render stationary boss and its projectiles
      if (bossRushActive.value) {
        this.renderStationaryBoss(state.tick);
        // Fortress is at ~5 fixed-point units from left (about 12.5% of field)
        const fortressScreenX = fpXToScreen(FP.fromInt(5), this.width);
        this.projectileSystem.renderBossProjectiles(
          this.width,
          this.height,
          fortressScreenX
        );
      }

      // Process death physics events and spawn ragdolls
      this.processDeathPhysics(state);

      // Update ragdoll physics
      this.ragdollSystem.update(deltaMs, this.width, this.height);

      // Check domino effect - ragdolls hitting living enemies
      // Convert enemy positions to screen coordinates
      const enemyScreenPositions = state.enemies.map(e => ({
        x: fpXToScreen(e.x, this.width),
        y: fpYToScreen(e.y, this.height),
      }));

      const dominoHits = this.ragdollSystem.checkDominoEffect(enemyScreenPositions);

      // Spawn chain explosions for domino hits
      for (const hit of dominoHits) {
        this.effects.vfx.spawnChainExplosion(hit.x, hit.y, 'natural', 0.6);
        this.effects.triggerHitstop('minor');
      }

      // Update camera effects (punch zoom, shake, slow-mo)
      this.effects.updateCameraEffects(deltaMs);

      // Apply camera transform to scene
      const cameraTransform = this.effects.getCameraTransform();
      this.container.scale.set(cameraTransform.scale);
      this.container.position.set(
        cameraTransform.offsetX + (this.width * (1 - cameraTransform.scale)) / 2,
        cameraTransform.offsetY + (this.height * (1 - cameraTransform.scale)) / 2
      );
    } else {
      // Disable interactive layer in hub mode so heroes can be clicked
      this.inputController.disableInteraction();
      this.inputController.setManualAimActive(false);
      this.inputController.clearHeroTargets();

      // Hard reset effects on transition to hub
      if (this.wasInGame) {
        this.effects.resetForHub();
        this.ragdollSystem.clear();
        // Reset camera transform
        this.container.scale.set(1);
        this.container.position.set(0, 0);
        this.wasInGame = false;
        // Reset theme initialization flags so they update on next game start
        this.hasInitializedTheme = false;
        this.hasInitializedHubTheme = false;
      }

      // Update theme in hub mode based on currentPillar signal
      // Initialize theme on first hub render or when pillar changes
      const hubPillar = currentPillar.value || 'streets';
      if (!this.hasInitializedHubTheme || hubPillar !== this.currentPillar) {
        this.currentPillar = hubPillar;
        this.updateTheme(hubPillar, true);
        this.hasInitializedHubTheme = true;
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
    this.parallax?.update(deltaMs);

    // Update effects (VFX + lighting)
    this.effects.update(deltaMs);
  }

  /**
   * Update environment theme based on pillar.
   * Updates both EnvironmentRenderer and ParallaxBackground.
   */
  private updateTheme(pillarId: PillarId, force: boolean = false): void {
    // Update environment renderer theme
    this.environment.setTheme(pillarId, force);

    // Update parallax background with pillar-based cosmic config
    if (this.parallax) {
      // CosmicBackground supports setThemeByPillar for full cosmic effects
      // The setTheme method also works (auto-detects pillar from colors)
      const parallax = this.parallax as ParallaxBackground & {
        setThemeByPillar?: (pillarId: PillarId) => void;
      };
      if (parallax.setThemeByPillar) {
        parallax.setThemeByPillar(pillarId);
      } else {
        const theme = themeManager.getThemeForPillar(pillarId);
        parallax.setTheme(theme.parallax);
      }
    }
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

  /**
   * Configure preview mode for viewing another player's hub.
   * Sets fortress appearance and theme without running game logic.
   */
  public setPreviewMode(
    enabled: boolean,
    fortressClass?: FortressClass,
    fortressTier?: 1 | 2 | 3
  ): void {
    this.isPreviewMode = enabled;
    this.previewStaticTerrain = enabled;
    this.environment.setPreviewMode(enabled);

    if (enabled && fortressClass) {
      // Set fortress visual based on class and tier
      this.environment.setFortressState(fortressClass, fortressTier || 1);

      // Use streets theme as default for previews
      this.environment.setTheme('streets', true);
      if (this.parallax) {
        const theme = themeManager.getThemeForPillar('streets');
        this.parallax.setTheme(theme.parallax);
      }
    }
  }

  /**
   * Render a hub state for preview mode (static, no game loop).
   * Used for viewing other players' hub configurations.
   */
  public renderPreview(hubState: HubState, deltaMs: number = 16): void {
    if (this.width === 0 || this.height === 0) return;

    // Disable interactions in preview mode
    this.inputController.disableInteraction();

    const terrainDeltaMs = this.previewStaticTerrain ? 0 : deltaMs;

    // Update environment animations
    this.environment.update(terrainDeltaMs, false);

    // Render the hub state
    this.updateHub(hubState);

    // Clear any combat visuals
    this.clearCombatVisuals();

    // Update parallax
    this.parallax?.update(terrainDeltaMs);

    // Update effects (for environment animations)
    this.effects.update(terrainDeltaMs);
  }

  /**
   * Check if scene is in preview mode.
   */
  public getIsPreviewMode(): boolean {
    return this.isPreviewMode;
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
    skillId?: string,
  ) {
    this.effects.spawnSkillActivation(x, y, fortressClass, skillLevel, skillId);

    // Trigger light flicker for electrical skills
    if (fortressClass === "lightning") {
      const intensity = skillLevel ? Math.min(1.0, 0.5 + skillLevel * 0.1) : 0.7;
      this.environment.triggerLightFlicker(intensity);
    }

    // Strong skills can cause ground cracks (earthquake already has its own cracks)
    if (skillLevel && skillLevel >= 2 && skillId !== 'earthquake') {
      this.environment.spawnCrack(x, y);
    }

    // Earthquake always spawns ground cracks (in addition to VFX cracks)
    if (skillId === 'earthquake') {
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

  /**
   * Detect fortress skill activations and trigger VFX
   */
  private detectFortressSkillActivations(state: GameState): void {
    for (const skillId of Object.keys(state.skillCooldowns)) {
      const currentCooldown = state.skillCooldowns[skillId] || 0;
      const lastCooldown = this.lastSkillCooldowns[skillId] ?? 0;

      // Skill was just activated: cooldown went from 0 to > 0
      if (currentCooldown > 0 && lastCooldown === 0) {
        // Get skill definition to determine level
        const skill = getSkillById(state.fortressClass, skillId);
        if (!skill) continue;

        // Get target position from signal (stored when skill was activated)
        const position = lastSkillTargetPositions.value[skillId];
        if (!position) continue;

        // Convert fixed-point to screen coordinates
        const screenX = fpXToScreen(position.x, this.width);
        const screenY = fpYToScreen(position.y, this.height);

        // Determine skill level based on commander level
        const skillLevel = state.commanderLevel < 10 ? 1 : state.commanderLevel < 25 ? 2 : 3;

        // Trigger visual effect
        this.spawnSkillActivation(screenX, screenY, state.fortressClass, skillLevel, skillId);
      }

      // Update tracked cooldown
      this.lastSkillCooldowns[skillId] = currentCooldown;
    }
  }

  /**
   * Process death physics events from simulation and spawn ragdolls.
   * This creates the satisfying flying corpse effect when enemies are killed.
   */
  private processDeathPhysics(state: GameState): void {
    void state; // Used for context, not directly needed here

    const deathEvents = popDeathPhysics();

    for (const event of deathEvents) {
      // Spawn ragdoll with physics from the kill
      // RagdollSystem handles coordinate conversion internally
      this.ragdollSystem.spawnFromDeathPhysics(event, this.width, this.height);

      // Convert fixed-point position to screen coordinates for VFX
      const screenX = fpXToScreen(event.x, this.width);
      const screenY = fpYToScreen(event.y, this.height);

      // Trigger camera effects for big kills
      if (event.isBigKill) {
        // Check if boss (very high damage or special type)
        const isBoss = event.damage > 500 || event.enemyType === 'mafia_boss' ||
                       event.enemyType === 'ai_core' || event.enemyType === 'cosmic_beast' ||
                       event.enemyType === 'dimensional_being' || event.enemyType === 'titan' ||
                       event.enemyType === 'god';

        this.effects.triggerBigKillEffects(screenX, screenY, isBoss);

        // Spawn enhanced explosion for big kills
        this.effects.vfx.spawnBigKillExplosion(
          screenX,
          screenY,
          event.sourceClass,
          Math.min(2, 1 + event.damage / 200) // Scale with damage
        );
      }
    }

    // Track multi-kills for slow-motion effect
    if (deathEvents.length >= 3) {
      this.effects.triggerMultiKillEffects(deathEvents.length);
    }
  }

  /**
   * Render stationary boss for Boss Rush mode.
   * Boss is positioned at a fixed location (right side of arena)
   * and only performs attack animations.
   */
  private renderStationaryBoss(currentTick: number): void {
    this.bossGraphics.clear();

    const pos = bossPosition.value;
    if (!pos) return;

    // Convert fixed-point coordinates to screen space
    const screenX = fpXToScreen(FP.fromFloat(pos.x), this.width);
    const screenY = fpYToScreen(FP.fromFloat(pos.y), this.height);

    // Boss size based on HP (visual indicator of boss tier)
    const hp = bossHp.value;
    const maxHp = bossMaxHp.value;
    const hpPercent = maxHp > 0 ? hp / maxHp : 1;

    // Base size scales with boss tier (indicated by max HP)
    const baseSize = Math.min(80, 40 + Math.log10(maxHp + 1) * 10);
    const size = baseSize * (0.8 + hpPercent * 0.2); // Shrink slightly as damaged

    // Color based on HP - red when low, orange when mid, yellow when full
    const r = Math.floor(255);
    const g = Math.floor(100 + hpPercent * 155);
    const b = Math.floor(50 * hpPercent);
    const bossColor = (r << 16) | (g << 8) | b;

    // Draw boss body (menacing shape)
    this.bossGraphics.beginFill(bossColor, 0.9);

    // Main body - octagon for intimidating look
    const sides = 8;
    const points: number[] = [];
    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
      points.push(screenX + Math.cos(angle) * size);
      points.push(screenY + Math.sin(angle) * size);
    }
    this.bossGraphics.drawPolygon(points);
    this.bossGraphics.endFill();

    // Inner glow/core
    this.bossGraphics.beginFill(0xffffff, 0.3);
    this.bossGraphics.drawCircle(screenX, screenY, size * 0.4);
    this.bossGraphics.endFill();

    // Pulsing attack indicator (when about to fire)
    const attackCooldown = 60; // Should match config
    const ticksSinceLastAttack = currentTick % attackCooldown;
    const chargeProgress = ticksSinceLastAttack / attackCooldown;

    if (chargeProgress > 0.7) {
      // Charging up for next attack
      const chargeIntensity = (chargeProgress - 0.7) / 0.3;
      this.bossGraphics.lineStyle(3 + chargeIntensity * 4, 0xff4400, chargeIntensity);
      this.bossGraphics.drawCircle(screenX, screenY, size + 10 + chargeIntensity * 15);
      this.bossGraphics.lineStyle(0);
    }

    // HP bar above boss
    const barWidth = size * 2;
    const barHeight = 8;
    const barY = screenY - size - 20;

    // Background
    this.bossGraphics.beginFill(0x333333, 0.8);
    this.bossGraphics.drawRect(screenX - barWidth / 2, barY, barWidth, barHeight);
    this.bossGraphics.endFill();

    // HP fill
    this.bossGraphics.beginFill(hpPercent > 0.3 ? 0x44ff44 : 0xff4444, 0.9);
    this.bossGraphics.drawRect(
      screenX - barWidth / 2,
      barY,
      barWidth * hpPercent,
      barHeight
    );
    this.bossGraphics.endFill();

    // Border
    this.bossGraphics.lineStyle(1, 0xffffff, 0.5);
    this.bossGraphics.drawRect(screenX - barWidth / 2, barY, barWidth, barHeight);
    this.bossGraphics.lineStyle(0);
  }
}
