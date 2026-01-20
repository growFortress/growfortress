import { Container, Graphics } from "pixi.js";
import type { FortressClass, PillarId } from "@arcade/sim-core";
import { FP } from "@arcade/sim-core";
import { LAYOUT, fpXToScreen } from "../../CoordinateSystem.js";
import { themeManager, type EnvironmentTheme } from "./ThemeManager.js";

// --- THEME & CONSTANTS (legacy, used for tower rendering) ---
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

// --- DYNAMIC EFFECT TYPES ---
interface GroundCrack {
  x: number;
  y: number;
  size: number;
  angle: number;
  alpha: number;
  lifetime: number;    // Total lifetime in ms
  elapsed: number;     // Elapsed time in ms
}

interface LightFlicker {
  intensity: number;   // 0-1, current flicker intensity
  duration: number;    // Total duration in ms
  elapsed: number;     // Elapsed time in ms
}

// Max active effects
const MAX_CRACKS = 15;
const CRACK_LIFETIME = 3000; // 3 seconds
const FLICKER_DURATION = 200; // 200ms

/**
 * EnvironmentRenderer handles all static background rendering:
 * - Night sky with stars (theme-dependent)
 * - Ground/deck (theme-dependent)
 * - Tesla Tower (fortress)
 * 
 * Also manages dynamic environmental effects:
 * - Ground cracks from explosions
 * - Light flickering from electrical skills
 * 
 * Uses a dirty flag to only redraw when necessary (resize, theme change, tier change).
 */
export class EnvironmentRenderer {
  public readonly container: Container;
  private staticGraphics: Graphics;
  private dynamicGraphics: Graphics;
  private effectsGraphics: Graphics; // Layer for dynamic environment effects

  private width = 0;
  private height = 0;

  // Current state for static layer
  private currentFortressClass: FortressClass = "natural";
  private currentFortressTier = 1;

  // Current environment theme (pillar-based)
  private currentTheme: EnvironmentTheme;
  private currentPillarId: PillarId = "streets";

  // Dirty flag - when true, static layer needs redraw
  private dirty = true;

  // Animation time for tier 3 effects
  private animTime = 0;

  // Dynamic effects
  private cracks: GroundCrack[] = [];
  private lightFlicker: LightFlicker | null = null;

  constructor() {
    this.container = new Container();

    // Initialize with default theme
    this.currentTheme = themeManager.getCurrentTheme();

    // Static layer (sky, deck, tower)
    this.staticGraphics = new Graphics();
    this.container.addChild(this.staticGraphics);

    // Effects layer (cracks, ambient effects) - above static, below dynamic
    this.effectsGraphics = new Graphics();
    this.container.addChild(this.effectsGraphics);

    // Dynamic layer (spawn portal)
    this.dynamicGraphics = new Graphics();
    this.container.addChild(this.dynamicGraphics);
  }

  /**
   * Set the environment theme based on pillar.
   * Returns true if theme changed (and marks dirty).
   */
  public setTheme(pillarId: PillarId): boolean {
    if (pillarId === this.currentPillarId) {
      return false;
    }
    this.currentPillarId = pillarId;
    this.currentTheme = themeManager.getThemeForPillar(pillarId);
    this.dirty = true;
    return true;
  }

  /**
   * Get current theme.
   */
  public getTheme(): EnvironmentTheme {
    return this.currentTheme;
  }

  /**
   * Get current pillar ID.
   */
  public getPillarId(): PillarId {
    return this.currentPillarId;
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

    // Clear all children and recreate in proper order
    this.container.removeChildren();

    // Recreate static graphics (layer 0 - bottom)
    if (this.staticGraphics) {
      this.staticGraphics.destroy();
    }
    this.staticGraphics = new Graphics();
    this.container.addChild(this.staticGraphics);

    // Recreate effects graphics (layer 1 - above static)
    if (this.effectsGraphics) {
      this.effectsGraphics.destroy();
    }
    this.effectsGraphics = new Graphics();
    this.container.addChild(this.effectsGraphics);

    // Recreate dynamic graphics (layer 2 - top)
    if (this.dynamicGraphics) {
      this.dynamicGraphics.destroy();
    }
    this.dynamicGraphics = new Graphics();
    this.container.addChild(this.dynamicGraphics);

    // Clear dynamic effects on resize
    this.cracks = [];
    this.lightFlicker = null;

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

    // Update and draw dynamic effects (cracks, flicker)
    this.updateEffectsLayer(deltaMs);

    // Always update dynamic elements (spawn portal)
    this.updateDynamicLayer(hasActiveEnemies);
  }

  // ============================================================================
  // DYNAMIC EFFECTS API
  // ============================================================================

  /**
   * Spawn a ground crack effect at the given position.
   * Only works if current theme supports cracks.
   */
  public spawnCrack(x: number, y: number): void {
    if (!this.currentTheme.effects.supportsCracks) return;
    if (this.cracks.length >= MAX_CRACKS) {
      // Remove oldest crack
      this.cracks.shift();
    }

    // Clamp y to ground area
    const pathTop = this.height * LAYOUT.groundY;
    const pathBottom = pathTop + this.height * LAYOUT.pathHeight;
    const clampedY = Math.max(pathTop, Math.min(pathBottom, y));

    this.cracks.push({
      x,
      y: clampedY,
      size: 15 + Math.random() * 20,
      angle: Math.random() * Math.PI * 2,
      alpha: 0.8,
      lifetime: CRACK_LIFETIME,
      elapsed: 0,
    });
  }

  /**
   * Trigger a light flicker effect (for electrical skills).
   * Only works if current theme supports flicker.
   */
  public triggerLightFlicker(intensity: number = 1.0): void {
    if (!this.currentTheme.effects.supportsFlicker) return;

    // Either start new or intensify existing
    if (this.lightFlicker) {
      // Intensify and reset
      this.lightFlicker.intensity = Math.min(1.0, this.lightFlicker.intensity + intensity * 0.3);
      this.lightFlicker.elapsed = 0;
    } else {
      this.lightFlicker = {
        intensity: Math.min(1.0, intensity),
        duration: FLICKER_DURATION,
        elapsed: 0,
      };
    }
  }

  /**
   * Check if theme supports cracks.
   */
  public supportsCracks(): boolean {
    return this.currentTheme.effects.supportsCracks;
  }

  /**
   * Check if theme supports light flicker.
   */
  public supportsFlicker(): boolean {
    return this.currentTheme.effects.supportsFlicker;
  }

  // ============================================================================
  // EFFECTS UPDATE & RENDERING
  // ============================================================================

  /**
   * Update and render dynamic effects layer.
   */
  private updateEffectsLayer(deltaMs: number): void {
    const g = this.effectsGraphics;
    if (!g || g.destroyed) return;

    try {
      g.clear();

      // Update and draw cracks
      this.updateCracks(deltaMs);
      this.drawCracks(g);

      // Update and draw light flicker
      this.updateLightFlicker(deltaMs);
      this.drawLightFlicker(g);
    } catch {
      // Silently fail if context is invalid
    }
  }

  /**
   * Update crack lifetimes and remove expired ones.
   */
  private updateCracks(deltaMs: number): void {
    for (let i = this.cracks.length - 1; i >= 0; i--) {
      const crack = this.cracks[i];
      crack.elapsed += deltaMs;

      // Calculate fade out (alpha decreases over time)
      const progress = crack.elapsed / crack.lifetime;
      crack.alpha = 0.8 * (1 - progress);

      // Remove expired cracks
      if (crack.elapsed >= crack.lifetime) {
        this.cracks.splice(i, 1);
      }
    }
  }

  /**
   * Draw all active cracks.
   */
  private drawCracks(g: Graphics): void {
    if (this.cracks.length === 0) return;

    const crackColor = this.currentTheme.effects.crackColor;

    for (const crack of this.cracks) {
      // Draw crack as multiple radiating lines
      const lineCount = 3 + Math.floor(Math.random() * 2);
      for (let i = 0; i < lineCount; i++) {
        const lineAngle = crack.angle + (i / lineCount) * Math.PI * 0.6 - Math.PI * 0.3;
        const lineLength = crack.size * (0.5 + Math.random() * 0.5);
        const endX = crack.x + Math.cos(lineAngle) * lineLength;
        const endY = crack.y + Math.sin(lineAngle) * lineLength;

        g.moveTo(crack.x, crack.y)
          .lineTo(endX, endY)
          .stroke({ width: 2, color: crackColor, alpha: crack.alpha });

        // Secondary smaller cracks branching off
        if (Math.random() > 0.5) {
          const branchAngle = lineAngle + (Math.random() - 0.5) * Math.PI * 0.5;
          const branchLength = lineLength * 0.4;
          const midX = crack.x + Math.cos(lineAngle) * lineLength * 0.6;
          const midY = crack.y + Math.sin(lineAngle) * lineLength * 0.6;
          const branchEndX = midX + Math.cos(branchAngle) * branchLength;
          const branchEndY = midY + Math.sin(branchAngle) * branchLength;

          g.moveTo(midX, midY)
            .lineTo(branchEndX, branchEndY)
            .stroke({ width: 1, color: crackColor, alpha: crack.alpha * 0.7 });
        }
      }

      // Small debris particles near crack center
      for (let i = 0; i < 3; i++) {
        const debrisX = crack.x + (Math.random() - 0.5) * crack.size * 0.5;
        const debrisY = crack.y + (Math.random() - 0.5) * crack.size * 0.3;
        g.circle(debrisX, debrisY, 1 + Math.random()).fill({
          color: crackColor,
          alpha: crack.alpha * 0.5,
        });
      }
    }
  }

  /**
   * Update light flicker effect.
   */
  private updateLightFlicker(deltaMs: number): void {
    if (!this.lightFlicker) return;

    this.lightFlicker.elapsed += deltaMs;

    // Fade out intensity over duration
    const progress = this.lightFlicker.elapsed / this.lightFlicker.duration;
    if (progress >= 1) {
      this.lightFlicker = null;
    }
  }

  /**
   * Draw light flicker effect (overlay on accent elements).
   */
  private drawLightFlicker(g: Graphics): void {
    if (!this.lightFlicker) return;

    const progress = this.lightFlicker.elapsed / this.lightFlicker.duration;
    const flickerAlpha = this.lightFlicker.intensity * (1 - progress) * 0.3;

    const pathTop = this.height * LAYOUT.groundY;
    const pathBottom = pathTop + this.height * LAYOUT.pathHeight;
    const flickerType = this.currentTheme.effects.flickerElements;
    const accentColor = this.currentTheme.deck.accentGlow;

    switch (flickerType) {
      case 'neon': // Flash neon-style lights
        // Top and bottom edge flashes
        g.rect(0, pathTop - 8, this.width, 4).fill({ color: accentColor, alpha: flickerAlpha });
        g.rect(0, pathBottom + 4, this.width, 4).fill({ color: accentColor, alpha: flickerAlpha });
        // Random spot flashes
        for (let i = 0; i < 5; i++) {
          const flashX = ((i * 3847) % 1000) / 1000 * this.width;
          const flashY = pathTop + Math.random() * (pathBottom - pathTop);
          g.circle(flashX, flashY, 8).fill({ color: accentColor, alpha: flickerAlpha * 0.5 });
        }
        break;

      case 'hologram': // Flash holographic elements
        // Vertical scan line effect
        const scanX = (this.animTime * 500) % this.width;
        g.rect(scanX - 2, pathTop, 4, pathBottom - pathTop).fill({
          color: accentColor,
          alpha: flickerAlpha,
        });
        // Grid flicker
        for (let x = 0; x < this.width; x += 100) {
          g.moveTo(x, pathTop)
            .lineTo(x, pathBottom)
            .stroke({ width: 1, color: accentColor, alpha: flickerAlpha * 0.3 });
        }
        break;

      case 'runes': // Flash magical runes
        for (let i = 0; i < 8; i++) {
          const runeX = ((i * 5347) % 1000) / 1000 * this.width;
          const runeY = pathTop + ((i * 2917) % 100) / 100 * (pathBottom - pathTop);
          // Rune glow pulse
          g.circle(runeX, runeY, 12).fill({ color: accentColor, alpha: flickerAlpha * 0.6 });
          g.circle(runeX, runeY, 6).fill({ color: 0xffffff, alpha: flickerAlpha * 0.3 });
        }
        break;

      case 'lightning': // Flash lightning/energy
        // Multiple lightning bolts
        for (let i = 0; i < 3; i++) {
          const boltX = ((i * 4721 + this.animTime * 100) % 1000) / 1000 * this.width;
          let y = pathTop;
          g.moveTo(boltX, y);
          while (y < pathBottom) {
            const nextY = y + 15 + Math.random() * 20;
            const offsetX = (Math.random() - 0.5) * 30;
            g.lineTo(boltX + offsetX, Math.min(nextY, pathBottom));
            y = nextY;
          }
          g.stroke({ width: 2, color: accentColor, alpha: flickerAlpha * 0.8 });
        }
        break;
    }
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
   * Rysuje niebo z gwiazdami (theme-dependent)
   */
  private drawSky(g: Graphics): void {
    const { width, height } = this;
    const sky = this.currentTheme.sky;

    // Gradient tła - od ciemniejszego na górze do jaśniejszego na dole
    g.rect(0, 0, width, height).fill({ color: sky.top });

    // Dolna część nieba - jaśniejsza (gradient effect)
    g.rect(0, height * 0.6, width, height * 0.4).fill({
      color: sky.bottom,
      alpha: 0.5,
    });

    // Gwiazdy - deterministycznie rozmieszczone (seed oparty na pozycji)
    const starCount = sky.starCount;
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

      g.circle(x, y, size).fill({ color: sky.stars, alpha });
    }

    // Chmury/mgła w tle
    const cloudCount = sky.cloudCount;
    for (let i = 0; i < cloudCount; i++) {
      const seedX = ((i * 4523) % 1000) / 1000;
      const seedY = ((i * 8761) % 1000) / 1000;
      const cloudWidth = 150 + ((i * 3217) % 200);

      const x = seedX * width;
      const y = height * 0.1 + seedY * height * 0.5;

      g.ellipse(x, y, cloudWidth, 20).fill({
        color: sky.clouds,
        alpha: sky.cloudAlpha,
      });
    }

    // Theme-specific sky decorations
    this.drawThemeSkyDecorations(g);
  }

  /**
   * Draw theme-specific sky decorations (neons for streets, hologram lines for science, etc.)
   */
  private drawThemeSkyDecorations(g: Graphics): void {
    const { width, height } = this;
    const style = this.currentTheme.style;
    const accent = this.currentTheme.deck.accent;

    switch (style) {
      case 'industrial': // Streets - distant neon signs
        for (let i = 0; i < 5; i++) {
          const seedX = ((i * 5347) % 1000) / 1000;
          const seedY = ((i * 2917) % 100) / 100;
          const neonX = seedX * width;
          const neonY = height * 0.15 + seedY * height * 0.25;
          const neonW = 20 + ((i * 1231) % 40);
          // Distant neon glow
          g.rect(neonX, neonY, neonW, 3).fill({ color: accent, alpha: 0.3 });
          g.rect(neonX, neonY, neonW, 3).fill({ color: 0xffffff, alpha: 0.1 });
        }
        break;

      case 'tech': // Science - data streams / grid lines
        for (let i = 0; i < 8; i++) {
          const seedX = ((i * 3847) % 1000) / 1000;
          const lineX = seedX * width;
          const lineHeight = height * 0.4;
          g.moveTo(lineX, 0)
            .lineTo(lineX, lineHeight)
            .stroke({ width: 1, color: accent, alpha: 0.1 });
        }
        break;

      case 'cosmic': // Cosmos - subtle starlines/nebula wisps
        for (let i = 0; i < 3; i++) {
          const seedX = ((i * 6217) % 1000) / 1000;
          const seedY = ((i * 4129) % 1000) / 1000;
          const nebulaX = seedX * width;
          const nebulaY = seedY * height * 0.5;
          g.ellipse(nebulaX, nebulaY, 200, 50).fill({
            color: this.currentTheme.sky.clouds,
            alpha: 0.15,
          });
        }
        break;

      case 'mystical': // Magic - floating rune particles
        for (let i = 0; i < 12; i++) {
          const seedX = ((i * 7331) % 1000) / 1000;
          const seedY = ((i * 5197) % 1000) / 1000;
          const runeX = seedX * width;
          const runeY = seedY * height * 0.6;
          const runeSize = 2 + ((i * 1723) % 3);
          // Golden rune particles
          g.circle(runeX, runeY, runeSize).fill({ color: accent, alpha: 0.4 });
        }
        break;

      case 'divine': // Gods - golden light rays
        for (let i = 0; i < 4; i++) {
          const seedX = ((i * 4721) % 1000) / 1000;
          const rayX = seedX * width;
          const rayWidth = 30 + ((i * 2347) % 50);
          g.moveTo(rayX, 0)
            .lineTo(rayX - rayWidth / 2, height * 0.5)
            .lineTo(rayX + rayWidth / 2, height * 0.5)
            .closePath()
            .fill({ color: accent, alpha: 0.05 });
        }
        break;

      case 'ruined': // Mutants - smoke/debris particles
        for (let i = 0; i < 8; i++) {
          const seedX = ((i * 5923) % 1000) / 1000;
          const seedY = ((i * 3847) % 1000) / 1000;
          const debrisX = seedX * width;
          const debrisY = seedY * height * 0.4;
          g.circle(debrisX, debrisY, 3).fill({
            color: this.currentTheme.sky.clouds,
            alpha: 0.2,
          });
        }
        break;
    }
  }

  /**
   * Rysuje pokład/platformę (theme-dependent)
   */
  private drawHelicarrierDeck(g: Graphics): void {
    const { width, height } = this;
    const deck = this.currentTheme.deck;
    const sky = this.currentTheme.sky;
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
      color: deck.plateDark,
    });

    // Linia barierki na górze (theme-specific style)
    this.drawRailing(g, 0, topTurretLaneY, width, 3);

    // === PASY OSTRZEGAWCZE (góra ścieżki) ===
    this.drawWarningStripe(g, 0, pathTop - 6, width, 6);

    // === GŁÓWNA ŚCIEŻKA WROGÓW (pokład) ===
    g.rect(0, pathTop, width, pathBottom - pathTop).fill({
      color: deck.plate,
    });

    // Theme-specific ground details
    this.drawGroundDetails(g, pathTop, pathBottom);

    // Płyty pokładu - linie podziału
    const plateWidth = 120;
    for (let x = plateWidth; x < width; x += plateWidth) {
      g.moveTo(x, pathTop)
        .lineTo(x, pathBottom)
        .stroke({ width: 1, color: deck.line, alpha: 0.5 });
    }

    // Centralna linia ścieżki - przerywana
    const dashLength = 50;
    const gapLength = 30;
    for (let x = 100; x < width; x += dashLength + gapLength) {
      g.rect(x, pathCenterY - 2, dashLength, 4).fill({
        color: deck.edge,
        alpha: 0.4,
      });
    }

    // === PASY OSTRZEGAWCZE (dół ścieżki) ===
    this.drawWarningStripe(g, 0, pathBottom, width, 6);

    // === DOLNY PAS WIEŻYCZEK ===
    g.rect(0, bottomTurretLaneY, width, turretLaneH).fill({
      color: deck.plateDark,
    });

    // === KRAWĘDŹ PLATFORMY (dół) ===
    const deckEdgeY = bottomTurretLaneY + turretLaneH;

    // Metalowa krawędź pokładu
    g.rect(0, deckEdgeY, width, 8).fill({ color: deck.edge });

    // Barierka dolna
    this.drawRailing(g, 0, deckEdgeY + 8, width, 3);

    // Widok na niebo poniżej platformy (cień/głębia)
    g.rect(0, deckEdgeY + 11, width, height - deckEdgeY - 11).fill({
      color: sky.top,
      alpha: 0.8,
    });

    // Theme-specific ambient lights/decorations on ground
    this.drawGroundAccents(g, pathTop, pathBottom);
  }

  /**
   * Draw railing with theme-specific style
   */
  private drawRailing(g: Graphics, x: number, y: number, w: number, h: number): void {
    const style = this.currentTheme.style;
    const deck = this.currentTheme.deck;

    switch (style) {
      case 'tech': // Holographic barrier
        g.rect(x, y, w, h).fill({ color: deck.railing, alpha: 0.6 });
        g.rect(x, y + 1, w, 1).fill({ color: deck.accent, alpha: 0.3 });
        break;

      case 'mystical': // Magical barrier
        g.rect(x, y, w, h).fill({ color: deck.railing, alpha: 0.5 });
        // Faint rune glow
        for (let rx = x + 50; rx < x + w; rx += 100) {
          g.circle(rx, y + h / 2, 2).fill({ color: deck.accent, alpha: 0.4 });
        }
        break;

      case 'divine': // Golden divine barrier
        g.rect(x, y, w, h).fill({ color: deck.railing });
        g.rect(x, y, w, 1).fill({ color: deck.accent, alpha: 0.5 });
        break;

      default: // Metal railing (industrial, ruined, cosmic)
        g.rect(x, y, w, h).fill({ color: deck.railing });
        break;
    }
  }

  /**
   * Draw theme-specific ground details (texture/patterns)
   */
  private drawGroundDetails(g: Graphics, pathTop: number, pathBottom: number): void {
    const { width } = this;
    const style = this.currentTheme.style;
    const deck = this.currentTheme.deck;

    switch (style) {
      case 'mystical': // Stone texture with cracks
        for (let i = 0; i < 15; i++) {
          const seedX = ((i * 4127) % 1000) / 1000;
          const seedY = ((i * 3571) % 1000) / 1000;
          const crackX = seedX * width;
          const crackY = pathTop + seedY * (pathBottom - pathTop);
          const crackLen = 10 + ((i * 1847) % 20);
          const crackAngle = ((i * 2341) % 360) * Math.PI / 180;
          g.moveTo(crackX, crackY)
            .lineTo(crackX + Math.cos(crackAngle) * crackLen, crackY + Math.sin(crackAngle) * crackLen)
            .stroke({ width: 1, color: deck.line, alpha: 0.3 });
        }
        break;

      case 'ruined': // Damage marks and rust stains
        for (let i = 0; i < 10; i++) {
          const seedX = ((i * 5923) % 1000) / 1000;
          const seedY = ((i * 2917) % 1000) / 1000;
          const stainX = seedX * width;
          const stainY = pathTop + seedY * (pathBottom - pathTop);
          const stainR = 5 + ((i * 1723) % 15);
          g.circle(stainX, stainY, stainR).fill({ color: deck.plateDark, alpha: 0.3 });
        }
        break;

      case 'divine': // Golden floor highlights
        for (let i = 0; i < 6; i++) {
          const seedX = ((i * 6217) % 1000) / 1000;
          const highlightX = seedX * width;
          const highlightW = 40 + ((i * 2347) % 60);
          g.rect(highlightX, pathTop + 5, highlightW, pathBottom - pathTop - 10).fill({
            color: deck.accent,
            alpha: 0.05,
          });
        }
        break;
    }
  }

  /**
   * Draw ambient lights/decorations on the ground (neons, holograms, runes, etc.)
   */
  private drawGroundAccents(g: Graphics, pathTop: number, pathBottom: number): void {
    const { width } = this;
    const style = this.currentTheme.style;
    const deck = this.currentTheme.deck;

    switch (style) {
      case 'industrial': // Neon floor lights
        for (let i = 0; i < 4; i++) {
          const seedX = ((i * 3847) % 1000) / 1000;
          const neonX = 100 + seedX * (width - 200);
          // Small neon strip on the floor
          g.rect(neonX, pathTop + 2, 30, 2).fill({ color: deck.accent, alpha: 0.5 });
          g.rect(neonX, pathBottom - 4, 30, 2).fill({ color: deck.accent, alpha: 0.5 });
        }
        break;

      case 'tech': // Holographic floor markers
        for (let i = 0; i < 6; i++) {
          const seedX = ((i * 4721) % 1000) / 1000;
          const markerX = 80 + seedX * (width - 160);
          // Holographic diamond marker
          const markerY = (pathTop + pathBottom) / 2;
          g.moveTo(markerX, markerY - 8)
            .lineTo(markerX + 6, markerY)
            .lineTo(markerX, markerY + 8)
            .lineTo(markerX - 6, markerY)
            .closePath()
            .fill({ color: deck.accent, alpha: 0.2 });
        }
        break;

      case 'mystical': // Glowing runes on floor
        for (let i = 0; i < 8; i++) {
          const seedX = ((i * 5347) % 1000) / 1000;
          const runeX = 60 + seedX * (width - 120);
          const runeY = pathTop + ((i * 2341) % 100) / 100 * (pathBottom - pathTop);
          // Simple rune glow
          g.circle(runeX, runeY, 4).fill({ color: deck.accent, alpha: 0.3 });
          g.circle(runeX, runeY, 8).fill({ color: deck.accentGlow, alpha: 0.1 });
        }
        break;

      case 'cosmic': // Energy lines
        for (let i = 0; i < 3; i++) {
          const seedX = ((i * 6127) % 1000) / 1000;
          const lineX = 150 + seedX * (width - 300);
          g.moveTo(lineX, pathTop + 5)
            .lineTo(lineX, pathBottom - 5)
            .stroke({ width: 1, color: deck.accent, alpha: 0.2 });
        }
        break;

      case 'divine': // Divine light pillars
        for (let i = 0; i < 2; i++) {
          const seedX = ((i * 7331) % 1000) / 1000;
          const pillarX = 200 + seedX * (width - 400);
          const pillarH = pathBottom - pathTop;
          g.rect(pillarX - 2, pathTop, 4, pillarH).fill({ color: deck.accent, alpha: 0.1 });
        }
        break;
    }
  }

  /**
   * Rysuje pasy ostrzegawcze (theme-dependent colors)
   */
  private drawWarningStripe(
    g: Graphics,
    x: number,
    y: number,
    stripeWidth: number,
    stripeHeight: number,
  ): void {
    const deck = this.currentTheme.deck;

    // Tło pasa
    g.rect(x, y, stripeWidth, stripeHeight).fill({
      color: deck.warningDark,
    });

    // Ukośne paski (color depends on theme)
    const segmentWidth = 20;
    for (let sx = x - stripeHeight; sx < x + stripeWidth; sx += segmentWidth * 2) {
      g.moveTo(sx, y + stripeHeight)
        .lineTo(sx + stripeHeight, y)
        .lineTo(sx + stripeHeight + segmentWidth, y)
        .lineTo(sx + segmentWidth, y + stripeHeight)
        .closePath()
        .fill({ color: deck.warning, alpha: 0.8 });
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
