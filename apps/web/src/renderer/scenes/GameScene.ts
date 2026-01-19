import { Application, Container, Graphics } from "pixi.js";
import type {
  GameState,
  EnemyType,
  FortressClass,
  ActiveHero,
  ActiveTurret,
  TurretSlot,
} from "@arcade/sim-core";
import { FP } from "@arcade/sim-core";
import { VFXSystem } from "../systems/VFXSystem.js";
import { EnemySystem } from "../systems/EnemySystem.js";
import { ProjectileSystem } from "../systems/ProjectileSystem.js";
import { HeroSystem } from "../systems/HeroSystem.js";
import { TurretSystem } from "../systems/TurretSystem.js";
import { WallSystem } from "../systems/WallSystem.js";
import { MilitiaSystem } from "../systems/MilitiaSystem.js";
import { lightingSystem, LightingSystem } from "../effects/LightingSystem.js";
import {
  parallaxBackground,
  ParallaxBackground,
} from "../effects/ParallaxBackground.js";
import { filterManager } from "../effects/FilterManager.js";
import {
  LAYOUT,
  screenXToGameUnit,
  screenYToGameUnit,
  fpXToScreen,
} from "../CoordinateSystem.js";

// Hub state type for idle phase rendering
export interface HubState {
  heroes: ActiveHero[];
  turrets: ActiveTurret[];
  turretSlots: TurretSlot[];
}

// --- THEME & CONSTANTS ---
const THEME = {
  background: 0x0a0a12, // Midnight Ink
  fortress: 0x00ccff, // Energy Blue (Tech Base)
  fortressAccent: 0xffcc00, // Hero Gold
  fortressGlow: 0x00ccff,
  text: 0xffffff,
  elite: 0xffcc00, // Gold
  hitFlash: 0xffffff,
  hpBar: {
    background: 0x000000,
    border: 0xff2222, // Red danger border
    high: 0x00ff9d, // Success Green
    mid: 0xffcc00, // Warning Yellow
    low: 0xff2222, // Danger Red
  },
  // Helicarrier theme
  sky: {
    top: 0x050510, // Bardzo ciemne niebo (góra)
    bottom: 0x0a0a18, // Ciemne niebo (dół)
    stars: 0xffffff, // Gwiazdy
    clouds: 0x15152a, // Ciemne chmury
  },
  deck: {
    plate: 0x1a2530, // Metalowa płyta pokładu
    plateDark: 0x151c22, // Ciemniejsza płyta
    line: 0x2a3540, // Linie między płytami
    edge: 0x3a4550, // Krawędź pokładu
    warning: 0xffaa00, // Pasy ostrzegawcze (pomarańcz)
    warningDark: 0x332200, // Ciemny pas ostrzegawczy
    railing: 0x4a5a6a, // Barierki
  },
  bridge: {
    body: 0x1a2a3a, // Główna struktura mostka
    window: 0x00ccff, // Świecące okna
    accent: 0xffcc00, // Złote akcenty
    antenna: 0x3a4a5a, // Antena
    light: 0xff3333, // Czerwone światło
  },
};

// LAYOUT imported from CoordinateSystem.js

// --- CLASS COLORS for Tesla Tower (7 fortress classes) ---
const CLASS_COLORS: Record<FortressClass, { primary: number; secondary: number; glow: number; core: number }> = {
  natural: { primary: 0x228b22, secondary: 0x32cd32, glow: 0x44ff44, core: 0x88ff88 },
  ice: { primary: 0x00bfff, secondary: 0x87ceeb, glow: 0xadd8e6, core: 0xffffff },
  fire: { primary: 0xff4500, secondary: 0xff6600, glow: 0xffaa00, core: 0xffff88 },
  lightning: { primary: 0x9932cc, secondary: 0xda70d6, glow: 0xffffff, core: 0xffffff },
  tech: { primary: 0x00f0ff, secondary: 0x00ffff, glow: 0xffffff, core: 0xaaffff },
  void: { primary: 0x4b0082, secondary: 0x8b008b, glow: 0x9400d3, core: 0xda70d6 },
  plasma: { primary: 0x00ffff, secondary: 0xff00ff, glow: 0xffffff, core: 0xffaaff },
};

export class GameScene {
  public container: Container;
  private staticGraphics: Graphics; // Cached static background
  private graphics: Graphics; // Dynamic overlays (if any)
  private vfx: VFXSystem;
  private enemySystem: EnemySystem;
  private projectileSystem: ProjectileSystem;
  private heroSystem: HeroSystem;
  private turretSystem: TurretSystem;
  private wallSystem: WallSystem;
  private militiaSystem: MilitiaSystem;
  public lighting: LightingSystem;
  public parallax: ParallaxBackground;

  private width = 0;
  private height = 0;

  // Track waves for wave complete effects
  private prevWavesCleared = 0;

  // Track elite kills for hitstop effect
  private prevEliteKills = 0;
  private hitstopRemaining = 0; // Frames to skip for hitstop

  // Animation time for running lights
  private animTime = 0;

  // Track fortress class for Tesla Tower rendering
  private currentFortressClass: FortressClass = 'natural';
  private currentFortressTier = 1;

  // Click callback for tactical commands
  private onFieldClick: ((worldX: number, worldY: number) => void) | null =
    null;
  private interactiveLayer: Graphics;

  constructor(_app: Application) {
    this.container = new Container();
    this.container.interactiveChildren = true;

    // Parallax Background (behind everything)
    this.parallax = parallaxBackground;
    this.container.addChild(this.parallax.container);

    // Background / Fortress Graphics (Static Layer)
    this.staticGraphics = new Graphics();
    this.container.addChild(this.staticGraphics);

    // Dynamic Graphics (if needed for overlaid effects not handled by systems)
    this.graphics = new Graphics();
    this.container.addChild(this.graphics);

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

    // Initialize VFX System (on top of gameplay but below UI effectively)
    this.vfx = new VFXSystem();
    this.container.addChild(this.vfx.container);

    // Connect projectile impacts to VFX system
    this.projectileSystem.setImpactCallback((x, y, fortressClass) => {
      this.vfx.spawnClassImpact(x, y, fortressClass);
    });

    // Initialize Lighting System (additive blend, on top of VFX)
    this.lighting = lightingSystem;

    // Connect VFX to lighting system for dynamic flashes
    this.vfx.setLightingCallback((x, y, color, radius) => {
      this.lighting.spawnFlash(x, y, color, radius);
    });
    this.container.addChild(this.lighting.container);

    // Interactive layer for click detection (on top)
    this.interactiveLayer = new Graphics();
    this.interactiveLayer.eventMode = "static";
    this.interactiveLayer.cursor = "pointer";
    this.interactiveLayer.on("pointerdown", this.handleFieldClick.bind(this));
    this.container.addChild(this.interactiveLayer);
  }

  /**
   * Handle clicks on the game field for tactical commands
   */
  private handleFieldClick(event: { global: { x: number; y: number } }): void {
    if (!this.onFieldClick) return;
    if (this.width === 0 || this.height === 0) return;

    // Convert screen coordinates to local container coordinates
    const localX = event.global.x;
    const localY = event.global.y;

    // Convert to world coordinates
    const worldX = screenXToGameUnit(localX, this.width);
    const worldY = screenYToGameUnit(localY, this.height);

    this.onFieldClick(worldX, worldY);
  }

  public onResize(width: number, height: number) {
    this.width = width;
    this.height = height;

    // Initialize parallax with new dimensions
    this.parallax.initialize(width, height);

    // Recreate lighting graphics to ensure valid context
    this.lighting.recreateGraphics();

    // Recreate static graphics to ensure valid context
    if (this.staticGraphics) {
      this.staticGraphics.parent?.removeChild(this.staticGraphics);
      this.staticGraphics.destroy();
    }
    this.staticGraphics = new Graphics();
    this.container.addChildAt(this.staticGraphics, 1); // Add after parallax

    // Recreate interactive layer to ensure valid context
    if (this.interactiveLayer) {
      this.interactiveLayer.removeAllListeners();
      this.interactiveLayer.parent?.removeChild(this.interactiveLayer);
      this.interactiveLayer.destroy();
    }
    this.interactiveLayer = new Graphics();
    this.interactiveLayer.eventMode = "static";
    this.interactiveLayer.cursor = "pointer";
    this.interactiveLayer.on("pointerdown", this.handleFieldClick.bind(this));
    this.container.addChild(this.interactiveLayer);

    // Redraw static elements on resize
    this.redrawStaticLayer();

    // Update interactive layer hit area
    try {
      this.interactiveLayer
        .rect(0, 0, width, height)
        .fill({ color: 0x000000, alpha: 0 });
    } catch (e) {
      console.warn("Failed to draw interactive layer:", e);
    }
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
    this.onFieldClick = callback;
  }

  /**
   * Set callback for screen shake effects (connected to VFXSystem)
   */
  public setScreenShakeCallback(
    callback: (intensity: number, duration: number) => void,
  ) {
    this.vfx.setScreenShakeCallback(callback);
  }

  private redrawStaticLayer() {
    const g = this.staticGraphics;

    // Safety check: ensure Graphics object has valid context
    if (!g || g.destroyed) {
      return;
    }

    try {
      g.clear();
    } catch (e) {
      console.warn("Failed to clear static graphics:", e);
      return;
    }

    if (this.width === 0 || this.height === 0) return;

    // Helicarrier scene layers (back to front)
    this.drawSky(g); // 1. Nocne niebo z gwiazdami
    this.drawHelicarrierDeck(g); // 2. Metalowy pokład platformy
    this.drawTeslaTower(g, this.currentFortressClass, this.currentFortressTier); // 3. Wieża Tesli
  }

  public update(state: GameState | null, alpha: number, hubState?: HubState) {
    void alpha;

    // Update animation time
    this.animTime += 16.66 / 1000; // Approximate frame time in seconds

    // Clear dynamic graphics (if any usages are added later)
    // Safety check: ensure Graphics object has valid context
    if (this.graphics && !this.graphics.destroyed) {
      try {
        this.graphics.clear();
        // Draw spawn portal at right edge (active during waves with enemies)
        const hasActiveEnemies = state?.enemies && state.enemies.length > 0;
        this.drawSpawnPortal(this.graphics, hasActiveEnemies);
      } catch (e) {
        // Silently fail if context is invalid
      }
    }

    // Ensure we have dimensions
    if (this.width === 0 || this.height === 0) return;

    if (state) {
      // Enable interactive layer during gameplay for tactical commands
      this.interactiveLayer.eventMode = "static";

      // Wave complete effect - trigger when wavesCleared increases
      if (state.wavesCleared > this.prevWavesCleared && this.prevWavesCleared > 0) {
        this.triggerWaveCompleteEffect(state.wavesCleared);
      }
      this.prevWavesCleared = state.wavesCleared;

      // Low HP warning effect
      const hpPercent = state.fortressHp / state.fortressMaxHp;
      if (hpPercent < 0.15) {
        filterManager.setLowHpWarning(2); // Critical
      } else if (hpPercent < 0.30) {
        filterManager.setLowHpWarning(1); // Warning
      } else {
        filterManager.setLowHpWarning(0); // Clear
      }

      // Hitstop on elite kill - freeze visuals for a brief moment
      if (state.eliteKills > this.prevEliteKills) {
        this.hitstopRemaining = 3; // ~50ms at 60fps (3 frames)
      }
      this.prevEliteKills = state.eliteKills;

      // Track fortress class and tier changes - redraw Tesla Tower when changed
      const newTier = state.commanderLevel < 10 ? 1 : state.commanderLevel < 25 ? 2 : 3;
      if (state.fortressClass !== this.currentFortressClass || newTier !== this.currentFortressTier) {
        this.currentFortressClass = state.fortressClass;
        this.currentFortressTier = newTier;
        this.redrawStaticLayer();
      }

      // Skip visual updates during hitstop for dramatic pause effect
      if (this.hitstopRemaining > 0) {
        this.hitstopRemaining--;
        // Still update VFX and particles (they look better continuing)
        this.vfx.update(16.66);
        return; // Skip rest of update - freeze frame effect
      }

      // Update Turret System (platforms and turrets)
      this.turretSystem.update(state, this.width, this.height);

      // Update Wall System (defensive barriers)
      this.wallSystem.update(state, this.width, this.height, this.vfx);

      // Update Enemy System (Handles rendering + VFX triggers)
      this.enemySystem.update(state, this.width, this.height, this.vfx);

      // Update Militia System (friendly units)
      this.militiaSystem.update(state, this.width, this.height, this.vfx);

      // Update Hero System (heroes on battlefield + skill VFX triggers)
      this.heroSystem.update(state, this.width, this.height, this.vfx);

      // Update Projectile System (all projectiles in flight)
      this.projectileSystem.update(state, this.width, this.height);
    } else {
      // Disable interactive layer in hub mode so heroes can be clicked
      this.interactiveLayer.eventMode = "none";

      // Clear any lingering filters from previous game session
      filterManager.setLowHpWarning(0);

      if (hubState) {
        // Render hub state when in idle phase (before session starts)
        this.updateHub(hubState);
      }
      this.clearCombatVisuals();
    }

    // Update Parallax background
    this.parallax.update(16.66);

    // Update VFX
    this.vfx.update(16.66);

    // Update Lighting effects
    this.lighting.update(16.66);
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
    const screenX = fpXToScreen(FP.fromInt(x), this.width); // Assume we get FixedPoint x
    void y;
    void type;
    // For now this method is unused by internal logic as we use polling in update()
    // But we maintain API compatibility.
    this.spawnExplosion(screenX, 500, 0xffcc00); // Placeholder y
  }

  public spawnExplosion(x: number, y: number, color: number) {
    this.vfx.spawnExplosion(x, y, color);
  }

  /**
   * Spawn class-specific explosion effect
   */
  public spawnClassExplosion(
    x: number,
    y: number,
    fortressClass: FortressClass,
  ) {
    this.vfx.spawnClassExplosion(x, y, fortressClass);
  }

  /**
   * Spawn class-specific projectile impact effect
   */
  public spawnClassImpact(x: number, y: number, fortressClass: FortressClass) {
    this.vfx.spawnClassImpact(x, y, fortressClass);
  }

  /**
   * Spawn skill activation effect
   */
  public spawnSkillActivation(
    x: number,
    y: number,
    fortressClass: FortressClass,
    skillLevel?: number,
  ) {
    this.vfx.spawnSkillActivation(x, y, fortressClass, skillLevel);
  }

  /**
   * Spawn hero deployment effect
   */
  public spawnHeroDeployment(
    x: number,
    y: number,
    fortressClass: FortressClass,
  ) {
    this.vfx.spawnHeroDeployment(x, y, fortressClass);
  }

  /**
   * Spawn turret firing effect
   */
  public spawnTurretFire(
    x: number,
    y: number,
    angle: number,
    fortressClass: FortressClass,
  ) {
    this.vfx.spawnTurretFire(x, y, angle, fortressClass);
  }

  // --- DRAWING ---

  /**
   * Rysuje nocne niebo z gwiazdami
   */
  private drawSky(g: Graphics) {
    const { width, height } = this;

    // Gradient tła - od ciemniejszego na górze do jaśniejszego na dole
    g.rect(0, 0, width, height).fill({ color: THEME.sky.top });

    // Dolna część nieba - jaśniejsza (gradient effect)
    g.rect(0, height * 0.6, width, height * 0.4).fill({
      color: THEME.sky.bottom,
      alpha: 0.5,
    });

    // Gwiazdy - deterministycznie rozmieszczone (seed oparty na pozycji)
    const starCount = 80;
    for (let i = 0; i < starCount; i++) {
      // Pseudo-losowe pozycje oparte na indeksie
      const seedX = ((i * 7919) % 1000) / 1000; // Prime number for distribution
      const seedY = ((i * 6271) % 1000) / 1000;
      const seedSize = ((i * 3571) % 100) / 100;
      const seedAlpha = ((i * 2341) % 100) / 100;

      const x = seedX * width;
      const y = seedY * height * 0.7; // Gwiazdy tylko w górnej części
      const size = 0.5 + seedSize * 1.5;
      const alpha = 0.3 + seedAlpha * 0.7;

      g.circle(x, y, size).fill({ color: THEME.sky.stars, alpha });
    }

    // Chmury w tle - bardzo subtelne
    const cloudCount = 5;
    for (let i = 0; i < cloudCount; i++) {
      const seedX = ((i * 4523) % 1000) / 1000;
      const seedY = ((i * 8761) % 1000) / 1000;
      const cloudWidth = 150 + ((i * 3217) % 200);

      const x = seedX * width;
      const y = height * 0.1 + seedY * height * 0.5;

      g.ellipse(x, y, cloudWidth, 20).fill({
        color: THEME.sky.clouds,
        alpha: 0.15,
      });
    }
  }

  /**
   * Rysuje metalowy pokład Helicarriera
   */
  private drawHelicarrierDeck(g: Graphics) {
    const { width, height } = this;
    const turretLaneH = height * LAYOUT.turretLaneHeight;
    const topTurretLaneY = height * LAYOUT.groundY - turretLaneH;
    const pathTop = height * LAYOUT.groundY;
    const pathBottom = pathTop + height * LAYOUT.pathHeight;
    const bottomTurretLaneY = pathBottom;
    const pathCenterY = (pathTop + pathBottom) / 2;

    // === KRAWĘDŹ PLATFORMY (góra) ===
    // Niebo widoczne nad platformą - już narysowane w drawSky

    // === GÓRNY PAS WIEŻYCZEK ===
    g.rect(0, topTurretLaneY, width, turretLaneH).fill({
      color: THEME.deck.plateDark,
    });

    // Linia barierki na górze
    g.rect(0, topTurretLaneY, width, 3).fill({ color: THEME.deck.railing });

    // === PASY OSTRZEGAWCZE (góra ścieżki) ===
    this.drawWarningStripe(g, 0, pathTop - 6, width, 6);

    // === GŁÓWNA ŚCIEŻKA WROGÓW (pokład) ===
    g.rect(0, pathTop, width, pathBottom - pathTop).fill({
      color: THEME.deck.plate,
    });

    // Płyty pokładu - linie podziału
    const plateWidth = 120;
    for (let x = plateWidth; x < width; x += plateWidth) {
      g.moveTo(x, pathTop)
        .lineTo(x, pathBottom)
        .stroke({ width: 1, color: THEME.deck.line, alpha: 0.5 });
    }

    // Centralna linia ścieżki - przerywana
    const dashLength = 50;
    const gapLength = 30;
    for (let x = 100; x < width; x += dashLength + gapLength) {
      g.rect(x, pathCenterY - 2, dashLength, 4).fill({
        color: THEME.deck.edge,
        alpha: 0.4,
      });
    }

    // === PASY OSTRZEGAWCZE (dół ścieżki) ===
    this.drawWarningStripe(g, 0, pathBottom, width, 6);

    // === DOLNY PAS WIEŻYCZEK ===
    g.rect(0, bottomTurretLaneY, width, turretLaneH).fill({
      color: THEME.deck.plateDark,
    });

    // === KRAWĘDŹ PLATFORMY (dół) ===
    const deckEdgeY = bottomTurretLaneY + turretLaneH;

    // Metalowa krawędź pokładu
    g.rect(0, deckEdgeY, width, 8).fill({ color: THEME.deck.edge });

    // Barierka dolna
    g.rect(0, deckEdgeY + 8, width, 3).fill({ color: THEME.deck.railing });

    // Widok na niebo poniżej platformy (cień/głębia)
    g.rect(0, deckEdgeY + 11, width, height - deckEdgeY - 11).fill({
      color: THEME.sky.top,
      alpha: 0.8,
    });
  }

  /**
   * Rysuje pasy ostrzegawcze (żółto-czarne)
   */
  private drawWarningStripe(
    g: Graphics,
    x: number,
    y: number,
    stripeWidth: number,
    stripeHeight: number,
  ) {
    // Tło pasa
    g.rect(x, y, stripeWidth, stripeHeight).fill({
      color: THEME.deck.warningDark,
    });

    // Ukośne żółte paski
    const segmentWidth = 20;
    for (
      let sx = x - stripeHeight;
      sx < x + stripeWidth;
      sx += segmentWidth * 2
    ) {
      g.moveTo(sx, y + stripeHeight)
        .lineTo(sx + stripeHeight, y)
        .lineTo(sx + stripeHeight + segmentWidth, y)
        .lineTo(sx + segmentWidth, y + stripeHeight)
        .closePath()
        .fill({ color: THEME.deck.warning, alpha: 0.8 });
    }
  }

  /**
   * Rysuje Wieżę Tesli - główna struktura twierdzy
   * Adaptuje kolory do klasy twierdzy, różnice wizualne zależą od tieru
   */
  private drawTeslaTower(g: Graphics, fortressClass: FortressClass, tier: number) {
    const colors = CLASS_COLORS[fortressClass] || CLASS_COLORS.natural;
    const x = fpXToScreen(FP.fromInt(LAYOUT.fortressPositionX), this.width) + 50;
    const pathTop = this.height * LAYOUT.groundY;
    const pathBottom = pathTop + this.height * LAYOUT.pathHeight;
    const pathCenterY = (pathTop + pathBottom) / 2;

    const towerWidth = 70;
    const towerHeight = 160;
    const baseY = pathCenterY + 50;

    // === 1. PLATFORMA / FUNDAMENT ===
    const platformWidth = towerWidth + 40;
    const platformHeight = 12;
    // Ciemna metalowa platforma
    g.roundRect(x - platformWidth / 2, baseY - platformHeight / 2, platformWidth, platformHeight, 3)
      .fill({ color: THEME.deck.plate })
      .stroke({ width: 2, color: THEME.deck.edge });
    // Linie na platformie
    g.rect(x - platformWidth / 2 + 10, baseY - 1, platformWidth - 20, 2)
      .fill({ color: THEME.deck.line, alpha: 0.5 });

    // === 2. PODSTAWA (trapezoid rozszerzający się w dół) ===
    const baseHeight = towerHeight * 0.25;
    const baseTopWidth = towerWidth * 0.5;
    const baseBottomWidth = towerWidth * 0.8;
    const baseTop = baseY - platformHeight / 2;

    g.moveTo(x - baseBottomWidth / 2, baseTop)
      .lineTo(x + baseBottomWidth / 2, baseTop)
      .lineTo(x + baseTopWidth / 2, baseTop - baseHeight)
      .lineTo(x - baseTopWidth / 2, baseTop - baseHeight)
      .closePath()
      .fill({ color: THEME.bridge.body })
      .stroke({ width: 2, color: THEME.deck.edge });

    // Detale na podstawie - poziome paski
    for (let ly = baseTop - 8; ly > baseTop - baseHeight + 5; ly -= 12) {
      const progress = (baseTop - ly) / baseHeight;
      const lineWidth = baseBottomWidth - (baseBottomWidth - baseTopWidth) * progress - 10;
      g.rect(x - lineWidth / 2, ly, lineWidth, 2).fill({ color: THEME.deck.line, alpha: 0.4 });
    }

    // === 3. KOLUMNA Z PIERŚCIENIAMI CEWEK ===
    const columnBottom = baseTop - baseHeight;
    const columnTop = columnBottom - towerHeight * 0.45;
    const columnWidth = towerWidth * 0.15;

    // Główna kolumna (wieża)
    g.rect(x - columnWidth / 2, columnTop, columnWidth, columnBottom - columnTop)
      .fill({ color: THEME.bridge.body })
      .stroke({ width: 1, color: THEME.deck.edge });

    // Pierścienie cewek (ilość zależy od tieru: 2, 3, 4)
    const ringCount = tier + 1;
    const ringSpacing = (columnBottom - columnTop) / (ringCount + 1);
    const ringWidth = towerWidth * 0.35;
    const ringHeight = 8;

    for (let i = 1; i <= ringCount; i++) {
      const ringY = columnBottom - i * ringSpacing;
      // Zewnętrzny pierścień (ciemniejszy)
      g.ellipse(x, ringY, ringWidth / 2, ringHeight / 2)
        .fill({ color: colors.primary, alpha: 0.6 })
        .stroke({ width: 2, color: colors.secondary });
      // Wewnętrzny glow
      g.ellipse(x, ringY, ringWidth / 2 - 4, ringHeight / 2 - 2)
        .fill({ color: colors.glow, alpha: 0.3 });
    }

    // === 4. ELEKTRODA GÓRNA (łącznik do toroidu) ===
    const electrodeBottom = columnTop;
    const electrodeTop = electrodeBottom - 20;
    const electrodeWidth = columnWidth * 0.6;

    g.rect(x - electrodeWidth / 2, electrodeTop, electrodeWidth, electrodeBottom - electrodeTop)
      .fill({ color: THEME.bridge.antenna })
      .stroke({ width: 1, color: THEME.deck.edge });

    // === 5. TOROID / KULA ENERGETYCZNA ===
    const toroidY = electrodeTop - 25;
    const toroidRadiusX = towerWidth * 0.35;
    const toroidRadiusY = 18;

    // Zewnętrzny glow (efekt świecenia)
    g.ellipse(x, toroidY, toroidRadiusX + 8, toroidRadiusY + 6)
      .fill({ color: colors.glow, alpha: 0.15 });
    g.ellipse(x, toroidY, toroidRadiusX + 4, toroidRadiusY + 3)
      .fill({ color: colors.glow, alpha: 0.25 });

    // Główny toroid
    g.ellipse(x, toroidY, toroidRadiusX, toroidRadiusY)
      .fill({ color: colors.primary })
      .stroke({ width: 2, color: colors.secondary });

    // Wewnętrzne szczegóły toroidu
    g.ellipse(x, toroidY, toroidRadiusX - 6, toroidRadiusY - 4)
      .stroke({ width: 1, color: colors.glow, alpha: 0.5 });

    // === 6. RDZEŃ ENERGETYCZNY (pulsujący punkt w środku) ===
    const coreRadius = 8;
    // Glow rdzenia
    g.circle(x, toroidY, coreRadius + 4).fill({ color: colors.core, alpha: 0.4 });
    g.circle(x, toroidY, coreRadius + 2).fill({ color: colors.core, alpha: 0.6 });
    // Rdzeń
    g.circle(x, toroidY, coreRadius).fill({ color: colors.core });

    // === 7. SZCZYT / ELEKTRODA GÓRNA ===
    const spikeHeight = 15 + tier * 3;
    g.moveTo(x, toroidY - toroidRadiusY - spikeHeight)
      .lineTo(x - 4, toroidY - toroidRadiusY + 2)
      .lineTo(x + 4, toroidY - toroidRadiusY + 2)
      .closePath()
      .fill({ color: colors.secondary })
      .stroke({ width: 1, color: colors.glow });

    // Świecący punkt na szczycie
    g.circle(x, toroidY - toroidRadiusY - spikeHeight, 3)
      .fill({ color: colors.core });
    g.circle(x, toroidY - toroidRadiusY - spikeHeight, 5)
      .fill({ color: colors.glow, alpha: 0.4 });

    // === 8. EFEKTY ZALEŻNE OD TIERU ===
    if (tier >= 2) {
      // Tier 2+: Dodatkowe panele boczne
      const panelWidth = 8;
      const panelHeight = baseHeight * 0.6;
      const panelY = baseTop - baseHeight + 10;

      // Lewy panel
      g.rect(x - baseTopWidth / 2 - panelWidth - 2, panelY, panelWidth, panelHeight)
        .fill({ color: THEME.bridge.body })
        .stroke({ width: 1, color: colors.primary, alpha: 0.6 });
      // Światełka na panelu
      for (let ly = panelY + 5; ly < panelY + panelHeight - 5; ly += 12) {
        g.circle(x - baseTopWidth / 2 - panelWidth / 2 - 2, ly, 2)
          .fill({ color: colors.glow, alpha: 0.7 });
      }

      // Prawy panel
      g.rect(x + baseTopWidth / 2 + 2, panelY, panelWidth, panelHeight)
        .fill({ color: THEME.bridge.body })
        .stroke({ width: 1, color: colors.primary, alpha: 0.6 });
      for (let ly = panelY + 5; ly < panelY + panelHeight - 5; ly += 12) {
        g.circle(x + baseTopWidth / 2 + panelWidth / 2 + 2, ly, 2)
          .fill({ color: colors.glow, alpha: 0.7 });
      }
    }

    if (tier >= 3) {
      // Tier 3: Łuki energetyczne z toroidu
      const arcCount = 4;
      const arcRadius = toroidRadiusX + 15;

      for (let i = 0; i < arcCount; i++) {
        const angle = (i / arcCount) * Math.PI * 2 + this.animTime * 0.5;
        const arcX = x + Math.cos(angle) * arcRadius;
        const arcY = toroidY + Math.sin(angle) * (toroidRadiusY + 10);

        // Linia energii
        g.moveTo(x + Math.cos(angle) * toroidRadiusX * 0.8, toroidY + Math.sin(angle) * toroidRadiusY * 0.8)
          .lineTo(arcX, arcY)
          .stroke({ width: 2, color: colors.glow, alpha: 0.6 });

        // Punkt końcowy
        g.circle(arcX, arcY, 3).fill({ color: colors.core, alpha: 0.8 });
      }

      // Dodatkowy pierścień glow wokół toroidu
      g.ellipse(x, toroidY, toroidRadiusX + 12, toroidRadiusY + 8)
        .stroke({ width: 2, color: colors.glow, alpha: 0.3 });
    }

    // === 9. ŚWIATŁA STATUSU (na podstawie) ===
    g.circle(x - baseBottomWidth / 2 + 8, baseTop - 8, 3)
      .fill({ color: 0x00ff00 }); // Zielone - status OK
    g.circle(x + baseBottomWidth / 2 - 8, baseTop - 8, 3)
      .fill({ color: colors.glow }); // Kolor klasy
  }

  /**
   * Draw spawn portal at the right edge of the battlefield.
   * Sci-fi dimensional rift style - dark tear in space with subtle glow.
   */
  private drawSpawnPortal(g: Graphics, isActive: boolean = false) {
    if (this.width === 0 || this.height === 0) return;

    const pathTop = this.height * LAYOUT.groundY;
    const pathBottom = pathTop + this.height * LAYOUT.pathHeight;
    const centerY = (pathTop + pathBottom) / 2;
    const portalX = this.width + 5;

    // Portal dimensions - vertical rift
    const riftHeight = 80;
    const riftWidth = 25;

    // Subtle pulsing (very slow)
    const pulse = isActive
      ? 0.8 + Math.sin(this.animTime * 1.5) * 0.2
      : 0.4 + Math.sin(this.animTime * 0.8) * 0.1;

    // Outer glow - soft purple/void color
    const glowColor = isActive ? 0x6622aa : 0x331155;
    g.ellipse(portalX, centerY, riftWidth * 2, riftHeight * 0.8)
      .fill({ color: glowColor, alpha: pulse * 0.15 });

    // Main rift shape - dark vertical ellipse
    g.ellipse(portalX, centerY, riftWidth, riftHeight * 0.6)
      .fill({ color: 0x110022, alpha: 0.9 });

    // Inner darker core
    g.ellipse(portalX, centerY, riftWidth * 0.6, riftHeight * 0.45)
      .fill({ color: 0x000000, alpha: 0.95 });

    // Edge glow - thin bright line
    const edgeColor = isActive ? 0x8844cc : 0x442266;
    g.ellipse(portalX, centerY, riftWidth, riftHeight * 0.6)
      .stroke({ width: 2, color: edgeColor, alpha: pulse * 0.6 });

    // Inner edge highlight
    g.ellipse(portalX, centerY, riftWidth * 0.7, riftHeight * 0.5)
      .stroke({ width: 1, color: 0xaa66ff, alpha: pulse * 0.3 });

    // When active - add subtle energy wisps (not spinning)
    if (isActive) {
      // Just a brighter inner glow
      g.ellipse(portalX, centerY, riftWidth * 0.4, riftHeight * 0.35)
        .fill({ color: 0x220044, alpha: 0.5 });

      // Small bright core
      g.ellipse(portalX, centerY, riftWidth * 0.15, riftHeight * 0.1)
        .fill({ color: 0x6633aa, alpha: pulse * 0.4 });
    }
  }

  /**
   * Trigger visual effects when a wave is completed.
   * White screen flash + "WAVE X COMPLETE" floating text.
   */
  private triggerWaveCompleteEffect(wave: number) {
    // Screen flash
    filterManager.applyScreenFlash("white", 200, 0.3);

    // Floating text in center of screen
    const centerX = this.width / 2;
    const centerY = this.height / 3;
    this.vfx.spawnFloatingText(centerX, centerY, `WAVE ${wave} COMPLETE!`, 0x00ff9d);
  }
}
