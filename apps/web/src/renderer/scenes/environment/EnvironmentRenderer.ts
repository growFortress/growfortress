import { Container, Graphics } from "pixi.js";
import type { FortressClass } from "@arcade/sim-core";
import { FP } from "@arcade/sim-core";
import { LAYOUT, fpXToScreen } from "../../CoordinateSystem.js";

// --- THEME & CONSTANTS ---
export const THEME = {
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

// --- CLASS COLORS for Tesla Tower (7 fortress classes) ---
export const CLASS_COLORS: Record<
  FortressClass,
  { primary: number; secondary: number; glow: number; core: number }
> = {
  natural: { primary: 0x228b22, secondary: 0x32cd32, glow: 0x44ff44, core: 0x88ff88 },
  ice: { primary: 0x00bfff, secondary: 0x87ceeb, glow: 0xadd8e6, core: 0xffffff },
  fire: { primary: 0xff4500, secondary: 0xff6600, glow: 0xffaa00, core: 0xffff88 },
  lightning: { primary: 0x9932cc, secondary: 0xda70d6, glow: 0xffffff, core: 0xffffff },
  tech: { primary: 0x00f0ff, secondary: 0x00ffff, glow: 0xffffff, core: 0xaaffff },
  void: { primary: 0x4b0082, secondary: 0x8b008b, glow: 0x9400d3, core: 0xda70d6 },
  plasma: { primary: 0x00ffff, secondary: 0xff00ff, glow: 0xffffff, core: 0xffaaff },
};

/**
 * EnvironmentRenderer handles all static background rendering:
 * - Night sky with stars
 * - Helicarrier deck
 * - Tesla Tower (fortress)
 * 
 * Uses a dirty flag to only redraw when necessary (resize, theme change, tier change).
 */
export class EnvironmentRenderer {
  public readonly container: Container;
  private staticGraphics: Graphics;
  private dynamicGraphics: Graphics;

  private width = 0;
  private height = 0;

  // Current state for static layer
  private currentFortressClass: FortressClass = "natural";
  private currentFortressTier = 1;

  // Dirty flag - when true, static layer needs redraw
  private dirty = true;

  // Animation time for tier 3 effects
  private animTime = 0;

  constructor() {
    this.container = new Container();

    // Static layer (sky, deck, tower)
    this.staticGraphics = new Graphics();
    this.container.addChild(this.staticGraphics);

    // Dynamic layer (spawn portal)
    this.dynamicGraphics = new Graphics();
    this.container.addChild(this.dynamicGraphics);
  }

  /**
   * Request a redraw of the static layer on next update.
   */
  public requestRedraw(): void {
    this.dirty = true;
  }

  /**
   * Handle resize - recreates graphics and marks dirty.
   */
  public onResize(width: number, height: number): void {
    this.width = width;
    this.height = height;

    // Recreate static graphics to ensure valid context
    if (this.staticGraphics) {
      this.staticGraphics.parent?.removeChild(this.staticGraphics);
      this.staticGraphics.destroy();
    }
    this.staticGraphics = new Graphics();
    this.container.addChildAt(this.staticGraphics, 0);

    // Recreate dynamic graphics
    if (this.dynamicGraphics) {
      this.dynamicGraphics.parent?.removeChild(this.dynamicGraphics);
      this.dynamicGraphics.destroy();
    }
    this.dynamicGraphics = new Graphics();
    this.container.addChild(this.dynamicGraphics);

    this.dirty = true;
  }

  /**
   * Update fortress class/tier. Returns true if changed (and marks dirty).
   */
  public setFortressState(fortressClass: FortressClass, tier: number): boolean {
    if (fortressClass !== this.currentFortressClass || tier !== this.currentFortressTier) {
      this.currentFortressClass = fortressClass;
      this.currentFortressTier = tier;
      this.dirty = true;
      return true;
    }
    return false;
  }

  /**
   * Get current fortress class.
   */
  public getFortressClass(): FortressClass {
    return this.currentFortressClass;
  }

  /**
   * Get current fortress tier.
   */
  public getFortressTier(): number {
    return this.currentFortressTier;
  }

  /**
   * Update environment rendering. Redraws static layer only if dirty.
   */
  public update(deltaMs: number, hasActiveEnemies: boolean): void {
    // Update animation time
    this.animTime += deltaMs / 1000;

    // Redraw static layer if dirty
    if (this.dirty) {
      this.redrawStaticLayer();
      this.dirty = false;
    }

    // Always update dynamic elements (spawn portal)
    this.updateDynamicLayer(hasActiveEnemies);
  }

  private redrawStaticLayer(): void {
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
    this.drawSky(g);
    this.drawHelicarrierDeck(g);
    this.drawTeslaTower(g, this.currentFortressClass, this.currentFortressTier);
  }

  private updateDynamicLayer(hasActiveEnemies: boolean): void {
    const g = this.dynamicGraphics;

    if (!g || g.destroyed) return;

    try {
      g.clear();
      this.drawSpawnPortal(g, hasActiveEnemies);
    } catch {
      // Silently fail if context is invalid
    }
  }

  // --- DRAWING METHODS ---

  /**
   * Rysuje nocne niebo z gwiazdami
   */
  private drawSky(g: Graphics): void {
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
  private drawHelicarrierDeck(g: Graphics): void {
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
  ): void {
    // Tło pasa
    g.rect(x, y, stripeWidth, stripeHeight).fill({
      color: THEME.deck.warningDark,
    });

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
   * Rysuje Wieżę Tesli - główna struktura twierdzy
   * Adaptuje kolory do klasy twierdzy, różnice wizualne zależą od tieru
   */
  private drawTeslaTower(g: Graphics, fortressClass: FortressClass, tier: number): void {
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
    g.rect(x - platformWidth / 2 + 10, baseY - 1, platformWidth - 20, 2).fill({
      color: THEME.deck.line,
      alpha: 0.5,
    });

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
      g.ellipse(x, ringY, ringWidth / 2 - 4, ringHeight / 2 - 2).fill({
        color: colors.glow,
        alpha: 0.3,
      });
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
    g.ellipse(x, toroidY, toroidRadiusX + 8, toroidRadiusY + 6).fill({
      color: colors.glow,
      alpha: 0.15,
    });
    g.ellipse(x, toroidY, toroidRadiusX + 4, toroidRadiusY + 3).fill({
      color: colors.glow,
      alpha: 0.25,
    });

    // Główny toroid
    g.ellipse(x, toroidY, toroidRadiusX, toroidRadiusY)
      .fill({ color: colors.primary })
      .stroke({ width: 2, color: colors.secondary });

    // Wewnętrzne szczegóły toroidu
    g.ellipse(x, toroidY, toroidRadiusX - 6, toroidRadiusY - 4).stroke({
      width: 1,
      color: colors.glow,
      alpha: 0.5,
    });

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
    g.circle(x, toroidY - toroidRadiusY - spikeHeight, 3).fill({ color: colors.core });
    g.circle(x, toroidY - toroidRadiusY - spikeHeight, 5).fill({
      color: colors.glow,
      alpha: 0.4,
    });

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
        g.circle(x - baseTopWidth / 2 - panelWidth / 2 - 2, ly, 2).fill({
          color: colors.glow,
          alpha: 0.7,
        });
      }

      // Prawy panel
      g.rect(x + baseTopWidth / 2 + 2, panelY, panelWidth, panelHeight)
        .fill({ color: THEME.bridge.body })
        .stroke({ width: 1, color: colors.primary, alpha: 0.6 });
      for (let ly = panelY + 5; ly < panelY + panelHeight - 5; ly += 12) {
        g.circle(x + baseTopWidth / 2 + panelWidth / 2 + 2, ly, 2).fill({
          color: colors.glow,
          alpha: 0.7,
        });
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
        g.moveTo(
          x + Math.cos(angle) * toroidRadiusX * 0.8,
          toroidY + Math.sin(angle) * toroidRadiusY * 0.8,
        )
          .lineTo(arcX, arcY)
          .stroke({ width: 2, color: colors.glow, alpha: 0.6 });

        // Punkt końcowy
        g.circle(arcX, arcY, 3).fill({ color: colors.core, alpha: 0.8 });
      }

      // Dodatkowy pierścień glow wokół toroidu
      g.ellipse(x, toroidY, toroidRadiusX + 12, toroidRadiusY + 8).stroke({
        width: 2,
        color: colors.glow,
        alpha: 0.3,
      });
    }

    // === 9. ŚWIATŁA STATUSU (na podstawie) ===
    g.circle(x - baseBottomWidth / 2 + 8, baseTop - 8, 3).fill({ color: 0x00ff00 }); // Zielone - status OK
    g.circle(x + baseBottomWidth / 2 - 8, baseTop - 8, 3).fill({ color: colors.glow }); // Kolor klasy
  }

  /**
   * Draw spawn portal at the right edge of the battlefield.
   * Sci-fi dimensional rift style - dark tear in space with subtle glow.
   */
  private drawSpawnPortal(g: Graphics, isActive: boolean = false): void {
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
    g.ellipse(portalX, centerY, riftWidth * 2, riftHeight * 0.8).fill({
      color: glowColor,
      alpha: pulse * 0.15,
    });

    // Main rift shape - dark vertical ellipse
    g.ellipse(portalX, centerY, riftWidth, riftHeight * 0.6).fill({
      color: 0x110022,
      alpha: 0.9,
    });

    // Inner darker core
    g.ellipse(portalX, centerY, riftWidth * 0.6, riftHeight * 0.45).fill({
      color: 0x000000,
      alpha: 0.95,
    });

    // Edge glow - thin bright line
    const edgeColor = isActive ? 0x8844cc : 0x442266;
    g.ellipse(portalX, centerY, riftWidth, riftHeight * 0.6).stroke({
      width: 2,
      color: edgeColor,
      alpha: pulse * 0.6,
    });

    // Inner edge highlight
    g.ellipse(portalX, centerY, riftWidth * 0.7, riftHeight * 0.5).stroke({
      width: 1,
      color: 0xaa66ff,
      alpha: pulse * 0.3,
    });

    // When active - add subtle energy wisps (not spinning)
    if (isActive) {
      // Just a brighter inner glow
      g.ellipse(portalX, centerY, riftWidth * 0.4, riftHeight * 0.35).fill({
        color: 0x220044,
        alpha: 0.5,
      });

      // Small bright core
      g.ellipse(portalX, centerY, riftWidth * 0.15, riftHeight * 0.1).fill({
        color: 0x6633aa,
        alpha: pulse * 0.4,
      });
    }
  }
}
