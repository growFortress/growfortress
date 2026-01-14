import { Application, Container, Graphics } from 'pixi.js';
import type { GameState, EnemyType, FortressClass, ActiveHero, ActiveTurret, TurretSlot } from '@arcade/sim-core';
import { FP } from '@arcade/sim-core';
import { VFXSystem } from '../systems/VFXSystem.js';
import { EnemySystem } from '../systems/EnemySystem.js';
import { ProjectileSystem } from '../systems/ProjectileSystem.js';
import { HeroSystem } from '../systems/HeroSystem.js';
import { TurretSystem } from '../systems/TurretSystem.js';
import { lightingSystem, LightingSystem } from '../effects/LightingSystem.js';
import { parallaxBackground, ParallaxBackground } from '../effects/ParallaxBackground.js';
import { LAYOUT, screenXToGameUnit, screenYToGameUnit, fpXToScreen } from '../CoordinateSystem.js';

// Hub state type for idle phase rendering
export interface HubState {
  heroes: ActiveHero[];
  turrets: ActiveTurret[];
  turretSlots: TurretSlot[];
}

// --- THEME & CONSTANTS ---
const THEME = {
  background: 0x0a0a12, // Midnight Ink
  fortress: 0x00ccff,   // Energy Blue (Tech Base)
  fortressAccent: 0xffcc00, // Hero Gold
  fortressGlow: 0x00ccff,
  text: 0xffffff,
  elite: 0xffcc00, // Gold
  hitFlash: 0xffffff,
  hpBar: {
    background: 0x000000,
    border: 0xff2222, // Red danger border
    high: 0x00ff9d, // Success Green
    mid: 0xffcc00,  // Warning Yellow
    low: 0xff2222,  // Danger Red
  },
  // Helicarrier theme
  sky: {
    top: 0x050510,        // Bardzo ciemne niebo (góra)
    bottom: 0x0a0a18,     // Ciemne niebo (dół)
    stars: 0xffffff,      // Gwiazdy
    clouds: 0x15152a,     // Ciemne chmury
  },
  deck: {
    plate: 0x1a2530,      // Metalowa płyta pokładu
    plateDark: 0x151c22,  // Ciemniejsza płyta
    line: 0x2a3540,       // Linie między płytami
    edge: 0x3a4550,       // Krawędź pokładu
    warning: 0xffaa00,    // Pasy ostrzegawcze (pomarańcz)
    warningDark: 0x332200, // Ciemny pas ostrzegawczy
    railing: 0x4a5a6a,    // Barierki
  },
  bridge: {
    body: 0x1a2a3a,       // Główna struktura mostka
    window: 0x00ccff,     // Świecące okna
    accent: 0xffcc00,     // Złote akcenty
    antenna: 0x3a4a5a,    // Antena
    light: 0xff3333,      // Czerwone światło
  },
};

// LAYOUT imported from CoordinateSystem.js



export class GameScene {
  public container: Container;
  private staticGraphics: Graphics; // Cached static background
  private graphics: Graphics; // Dynamic overlays (if any)
  private vfx: VFXSystem;
  private enemySystem: EnemySystem;
  private projectileSystem: ProjectileSystem;
  private heroSystem: HeroSystem;
  private turretSystem: TurretSystem;
  public lighting: LightingSystem;
  public parallax: ParallaxBackground;

  private width = 0;
  private height = 0;

  // Click callback for tactical commands
  private onFieldClick: ((worldX: number, worldY: number) => void) | null = null;
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

    // Enemy System (Retained Mode)
    this.enemySystem = new EnemySystem();
    this.container.addChild(this.enemySystem.container);

    // Hero System (heroes on battlefield)
    this.heroSystem = new HeroSystem();
    this.container.addChild(this.heroSystem.container);

    // Projectile System (above entities)
    this.projectileSystem = new ProjectileSystem();
    this.container.addChild(this.projectileSystem.container);

    // Initialize VFX System (on top of gameplay but below UI effectively)
    this.vfx = new VFXSystem();
    this.container.addChild(this.vfx.container);

    // Initialize Lighting System (additive blend, on top of VFX)
    this.lighting = lightingSystem;
    this.container.addChild(this.lighting.container);

    // Interactive layer for click detection (on top)
    this.interactiveLayer = new Graphics();
    this.interactiveLayer.eventMode = 'static';
    this.interactiveLayer.cursor = 'pointer';
    this.interactiveLayer.on('pointerdown', this.handleFieldClick.bind(this));
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

    // Redraw static elements on resize
    this.redrawStaticLayer();

    // Update interactive layer hit area
    this.interactiveLayer.clear();
    this.interactiveLayer.rect(0, 0, width, height).fill({ color: 0x000000, alpha: 0 });
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
  public setOnTurretClick(callback: (turretId: string, slotIndex: number) => void) {
    this.turretSystem.setOnTurretClick(callback);
  }

  /**
   * Set callback for field click events (tactical commands)
   */
  public setOnFieldClick(callback: ((worldX: number, worldY: number) => void) | null) {
    this.onFieldClick = callback;
  }

  /**
   * Set callback for screen shake effects (connected to VFXSystem)
   */
  public setScreenShakeCallback(callback: (intensity: number, duration: number) => void) {
    this.vfx.setScreenShakeCallback(callback);
  }

  private redrawStaticLayer() {
    const g = this.staticGraphics;
    g.clear();

    if (this.width === 0 || this.height === 0) return;

    // Helicarrier scene layers (back to front)
    this.drawSky(g);              // 1. Nocne niebo z gwiazdami
    this.drawHelicarrierDeck(g);  // 2. Metalowy pokład platformy
    this.drawCommandBridge(g);    // 3. Mostek dowodzenia
  }

  public update(state: GameState | null, alpha: number, hubState?: HubState) {
    void alpha;

    // Clear dynamic graphics (if any usages are added later)
    this.graphics.clear();

    // Ensure we have dimensions
    if (this.width === 0 || this.height === 0) return;

    if (state) {
        // Enable interactive layer during gameplay for tactical commands
        this.interactiveLayer.eventMode = 'static';

        // Update Turret System (platforms and turrets)
        this.turretSystem.update(state, this.width, this.height);

        // Update Enemy System (Handles rendering + VFX triggers)
        this.enemySystem.update(state, this.width, this.height, this.vfx);

        // Update Hero System (heroes on battlefield + skill VFX triggers)
        this.heroSystem.update(state, this.width, this.height, this.vfx);

        // Update Projectile System (all projectiles in flight)
        this.projectileSystem.update(state, this.width, this.height);
    } else {
        // Disable interactive layer in hub mode so heroes can be clicked
        this.interactiveLayer.eventMode = 'none';

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
      kills: 0,
    } as unknown as GameState;

    this.enemySystem.update(emptyState, this.width, this.height);
    this.projectileSystem.update(emptyState, this.width, this.height);
  }

  // Called by external controller when an enemy dies
  public onEnemyKilled(x: number, y: number, type: EnemyType = 'runner') {
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
  public spawnClassExplosion(x: number, y: number, fortressClass: FortressClass) {
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
  public spawnSkillActivation(x: number, y: number, fortressClass: FortressClass, skillLevel?: number) {
      this.vfx.spawnSkillActivation(x, y, fortressClass, skillLevel);
  }

  /**
   * Spawn hero deployment effect
   */
  public spawnHeroDeployment(x: number, y: number, fortressClass: FortressClass) {
      this.vfx.spawnHeroDeployment(x, y, fortressClass);
  }

  /**
   * Spawn turret firing effect
   */
  public spawnTurretFire(x: number, y: number, angle: number, fortressClass: FortressClass) {
      this.vfx.spawnTurretFire(x, y, angle, fortressClass);
  }

  // --- DRAWING ---

  /**
   * Rysuje nocne niebo z gwiazdami
   */
  private drawSky(g: Graphics) {
    const { width, height } = this;

    // Gradient tła - od ciemniejszego na górze do jaśniejszego na dole
    g.rect(0, 0, width, height)
     .fill({ color: THEME.sky.top });

    // Dolna część nieba - jaśniejsza (gradient effect)
    g.rect(0, height * 0.6, width, height * 0.4)
     .fill({ color: THEME.sky.bottom, alpha: 0.5 });

    // Gwiazdy - deterministycznie rozmieszczone (seed oparty na pozycji)
    const starCount = 80;
    for (let i = 0; i < starCount; i++) {
      // Pseudo-losowe pozycje oparte na indeksie
      const seedX = (i * 7919) % 1000 / 1000; // Prime number for distribution
      const seedY = (i * 6271) % 1000 / 1000;
      const seedSize = (i * 3571) % 100 / 100;
      const seedAlpha = (i * 2341) % 100 / 100;

      const x = seedX * width;
      const y = seedY * height * 0.7; // Gwiazdy tylko w górnej części
      const size = 0.5 + seedSize * 1.5;
      const alpha = 0.3 + seedAlpha * 0.7;

      g.circle(x, y, size)
       .fill({ color: THEME.sky.stars, alpha });
    }

    // Chmury w tle - bardzo subtelne
    const cloudCount = 5;
    for (let i = 0; i < cloudCount; i++) {
      const seedX = (i * 4523) % 1000 / 1000;
      const seedY = (i * 8761) % 1000 / 1000;
      const cloudWidth = 150 + (i * 3217) % 200;

      const x = seedX * width;
      const y = height * 0.1 + seedY * height * 0.5;

      g.ellipse(x, y, cloudWidth, 20)
       .fill({ color: THEME.sky.clouds, alpha: 0.15 });
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
    g.rect(0, topTurretLaneY, width, turretLaneH)
     .fill({ color: THEME.deck.plateDark });

    // Linia barierki na górze
    g.rect(0, topTurretLaneY, width, 3)
     .fill({ color: THEME.deck.railing });

    // === PASY OSTRZEGAWCZE (góra ścieżki) ===
    this.drawWarningStripe(g, 0, pathTop - 6, width, 6);

    // === GŁÓWNA ŚCIEŻKA WROGÓW (pokład) ===
    g.rect(0, pathTop, width, pathBottom - pathTop)
     .fill({ color: THEME.deck.plate });

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
      g.rect(x, pathCenterY - 2, dashLength, 4)
       .fill({ color: THEME.deck.edge, alpha: 0.4 });
    }

    // === PASY OSTRZEGAWCZE (dół ścieżki) ===
    this.drawWarningStripe(g, 0, pathBottom, width, 6);

    // === DOLNY PAS WIEŻYCZEK ===
    g.rect(0, bottomTurretLaneY, width, turretLaneH)
     .fill({ color: THEME.deck.plateDark });

    // === KRAWĘDŹ PLATFORMY (dół) ===
    const deckEdgeY = bottomTurretLaneY + turretLaneH;

    // Metalowa krawędź pokładu
    g.rect(0, deckEdgeY, width, 8)
     .fill({ color: THEME.deck.edge });

    // Barierka dolna
    g.rect(0, deckEdgeY + 8, width, 3)
     .fill({ color: THEME.deck.railing });

    // Widok na niebo poniżej platformy (cień/głębia)
    g.rect(0, deckEdgeY + 11, width, height - deckEdgeY - 11)
     .fill({ color: THEME.sky.top, alpha: 0.8 });
  }

  /**
   * Rysuje pasy ostrzegawcze (żółto-czarne)
   */
  private drawWarningStripe(g: Graphics, x: number, y: number, stripeWidth: number, stripeHeight: number) {
    // Tło pasa
    g.rect(x, y, stripeWidth, stripeHeight)
     .fill({ color: THEME.deck.warningDark });

    // Ukośne żółte paski
    const segmentWidth = 20;
    for (let sx = x - stripeHeight; sx < x + stripeWidth; sx += segmentWidth * 2) {
      g.moveTo(sx, y + stripeHeight)
       .lineTo(sx + stripeHeight, y)
       .lineTo(sx + stripeHeight + segmentWidth, y)
       .lineTo(sx + segmentWidth, y + stripeHeight)
       .closePath()
       .fill({ color: THEME.deck.warning, alpha: 0.8 });
    }
  }

  /**
   * Rysuje mostek dowodzenia Helicarriera (zamiast twierdzy)
   */
  private drawCommandBridge(g: Graphics) {
    const x = fpXToScreen(FP.fromInt(LAYOUT.fortressPositionX), this.width) + 50;
    const pathTop = this.height * LAYOUT.groundY;
    const pathBottom = pathTop + this.height * LAYOUT.pathHeight;
    const pathCenterY = (pathTop + pathBottom) / 2;

    // Mostek osadzony na pokładzie
    const bridgeWidth = 80;
    const bridgeHeight = 140;
    const baseY = pathCenterY + 40; // Podstawa mostka

    // === PODSTAWA MOSTKA ===
    // Metalowa platforma
    g.rect(x - bridgeWidth/2 - 10, baseY - 10, bridgeWidth + 20, 20)
     .fill({ color: THEME.deck.edge });

    // === GŁÓWNA STRUKTURA ===
    // Dolna część - szersza
    const lowerHeight = bridgeHeight * 0.4;
    g.moveTo(x - bridgeWidth/2, baseY - 10)
     .lineTo(x + bridgeWidth/2, baseY - 10)
     .lineTo(x + bridgeWidth/2 - 10, baseY - 10 - lowerHeight)
     .lineTo(x - bridgeWidth/2 + 10, baseY - 10 - lowerHeight)
     .closePath()
     .fill({ color: THEME.bridge.body })
     .stroke({ width: 2, color: THEME.deck.edge });

    // Górna część - kabina z oknami (zwężająca się)
    const upperWidth = bridgeWidth - 20;
    const upperHeight = bridgeHeight * 0.35;
    const upperY = baseY - 10 - lowerHeight;

    g.moveTo(x - upperWidth/2, upperY)
     .lineTo(x + upperWidth/2, upperY)
     .lineTo(x + upperWidth/2 - 15, upperY - upperHeight)
     .lineTo(x - upperWidth/2 + 15, upperY - upperHeight)
     .closePath()
     .fill({ color: THEME.bridge.body })
     .stroke({ width: 2, color: THEME.deck.edge });

    // === OKNA KABINY ===
    const windowY = upperY - upperHeight * 0.3;
    const windowWidth = 12;
    const windowHeight = upperHeight * 0.5;
    const windowSpacing = 18;

    // Trzy okna
    for (let i = -1; i <= 1; i++) {
      const wx = x + i * windowSpacing;
      g.roundRect(wx - windowWidth/2, windowY, windowWidth, windowHeight, 2)
       .fill({ color: THEME.bridge.window, alpha: 0.8 })
       .stroke({ width: 1, color: 0xffffff, alpha: 0.3 });
    }

    // === DACH / KOPUŁA ===
    const roofY = upperY - upperHeight;
    const roofWidth = upperWidth - 30;

    g.moveTo(x - roofWidth/2, roofY)
     .lineTo(x + roofWidth/2, roofY)
     .lineTo(x, roofY - 25)
     .closePath()
     .fill({ color: THEME.deck.edge });

    // === ANTENA ===
    const antennaBaseY = roofY - 25;
    g.moveTo(x, antennaBaseY)
     .lineTo(x, antennaBaseY - 35)
     .stroke({ width: 3, color: THEME.bridge.antenna });

    // Światło na antenie (migające - symulowane przez stałą jasność)
    g.circle(x, antennaBaseY - 35, 4)
     .fill({ color: THEME.bridge.light });

    // Mniejsze światło
    g.circle(x, antennaBaseY - 35, 6)
     .fill({ color: THEME.bridge.light, alpha: 0.3 });

    // === ŚWIATŁA STATUSU ===
    // Po bokach mostka
    g.circle(x - bridgeWidth/2 + 5, baseY - 30, 3)
     .fill({ color: 0x00ff00 }); // Zielone - status OK

    g.circle(x + bridgeWidth/2 - 5, baseY - 30, 3)
     .fill({ color: THEME.bridge.accent }); // Złote

    // === DETALE - paski na strukturze ===
    // Poziome linie na dolnej części
    for (let ly = baseY - 25; ly > baseY - 10 - lowerHeight + 10; ly -= 15) {
      const lineWidth = bridgeWidth - 20 - (baseY - 10 - ly) * 0.15;
      g.rect(x - lineWidth/2, ly, lineWidth, 2)
       .fill({ color: THEME.deck.line, alpha: 0.5 });
    }
  }
}
