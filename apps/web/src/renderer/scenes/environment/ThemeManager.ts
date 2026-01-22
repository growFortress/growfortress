/**
 * ThemeManager - Dynamic environment theming based on pillar/sector
 * 
 * Each pillar has a distinct visual theme:
 * - Streets: Dark asphalt, neon lights, graffiti
 * - Science: Sterile white panels, holograms, cyan accents
 * - Mutants: Damaged/rusted plates, aggressive red accents
 * - Cosmos: Deep space gradient, starlines, purple tones
 * - Magic: Stone platforms, mystical runes, ethereal fog
 * - Gods: Golden divine realm, lightning, epic scale
 */

import type { PillarId } from "@arcade/sim-core";

// ============================================================================
// THEME TYPES
// ============================================================================

export interface SkyTheme {
  top: number;           // Upper sky gradient color
  bottom: number;        // Lower sky gradient color
  stars: number;         // Star color
  clouds: number;        // Cloud/fog color
  starCount: number;     // Number of stars (0-150)
  cloudCount: number;    // Number of clouds/fog patches (0-15)
  cloudAlpha: number;    // Cloud transparency (0-1)
}

export interface DeckTheme {
  plate: number;         // Main floor plate color
  plateDark: number;     // Darker plate variation
  line: number;          // Lines between plates
  edge: number;          // Platform edge
  warning: number;       // Warning stripe primary
  warningDark: number;   // Warning stripe secondary
  railing: number;       // Railings/barriers
  accent: number;        // Neon/hologram accent color
  accentGlow: number;    // Glow color for accents
}

export interface EffectsConfig {
  supportsCracks: boolean;      // Can show ground cracks from explosions
  supportsFlicker: boolean;     // Can show light flicker effects
  crackColor: number;           // Color for cracks
  flickerElements: 'neon' | 'hologram' | 'runes' | 'lightning' | 'none';
}

export interface ParallaxConfig {
  starColor: number;
  cloudColor: number;
  starCount: number;     // Override for parallax star count
  cloudCount: number;    // Override for parallax cloud count
  cloudSpeed: number;    // Cloud movement speed multiplier (1.0 = normal)
}

export interface EnvironmentTheme {
  id: PillarId;
  name: string;
  sky: SkyTheme;
  deck: DeckTheme;
  effects: EffectsConfig;
  parallax: ParallaxConfig;
  // Visual style hints for special rendering
  style: 'industrial' | 'tech' | 'ruined' | 'cosmic' | 'mystical' | 'divine';
}

// ============================================================================
// THEME DEFINITIONS
// ============================================================================

/**
 * STREETS - Nocne miasto, neonowe światła, deszcz
 * Dark urban environment with neon accents
 */
const THEME_STREETS: EnvironmentTheme = {
  id: 'streets',
  name: 'Ulice',
  sky: {
    top: 0x0a0a15,       // Very dark blue-black
    bottom: 0x151525,    // Slightly lighter urban sky
    stars: 0xffffff,
    clouds: 0x1a1a30,    // Dark smog clouds
    starCount: 30,       // Few stars (light pollution)
    cloudCount: 8,       // More clouds/smog
    cloudAlpha: 0.25,
  },
  deck: {
    plate: 0x2a2a35,     // Dark asphalt gray
    plateDark: 0x1f1f28, // Darker asphalt
    line: 0x3a3a45,      // Road markings
    edge: 0x4a4a55,      // Curb edge
    warning: 0xff6b6b,   // Neon red warning
    warningDark: 0x331a1a,
    railing: 0x5a5a6a,   // Metal barriers
    accent: 0xff6b6b,    // Neon red
    accentGlow: 0xff8888,
  },
  effects: {
    supportsCracks: true,
    supportsFlicker: true,
    crackColor: 0x1a1a20,
    flickerElements: 'neon',
  },
  parallax: {
    starColor: 0xffffff,
    cloudColor: 0x1a1a30,
    starCount: 40,
    cloudCount: 10,
    cloudSpeed: 0.5,     // Slow drifting smog
  },
  style: 'industrial',
};

/**
 * SCIENCE - Sterylne laboratoria, hologramy, maszyny
 * Clean tech environment with cyan/green accents
 */
const THEME_SCIENCE: EnvironmentTheme = {
  id: 'science',
  name: 'Nauka',
  sky: {
    top: 0x0a192f,       // Dark tech blue
    bottom: 0x0f2a4a,    // Slightly brighter
    stars: 0x64ffda,     // Cyan stars (digital)
    clouds: 0x0a2540,    // Tech blue fog
    starCount: 60,       // Moderate (data particles)
    cloudCount: 4,       // Few clouds
    cloudAlpha: 0.15,
  },
  deck: {
    plate: 0x4a4a5a,     // Dark tech panels (reduced brightness)
    plateDark: 0x3a3a4a, // Darker tech panels
    line: 0x00e0f0,      // Bright cyan grid lines (better contrast on dark)
    edge: 0x5a5a6a,      // Panel edges
    warning: 0x00d0e0,   // Brighter cyan warning (better visibility)
    warningDark: 0x1a2a3a, // Darker base for stripes
    railing: 0x88ccff,   // Holographic barriers
    accent: 0x00f0ff,    // Cyan hologram
    accentGlow: 0x88ffff,
  },
  effects: {
    supportsCracks: false, // Clean surfaces don't crack
    supportsFlicker: true,
    crackColor: 0xc0c0d0,
    flickerElements: 'hologram',
  },
  parallax: {
    starColor: 0x64ffda,
    cloudColor: 0x0a2540,
    starCount: 80,
    cloudCount: 3,
    cloudSpeed: 1.5,     // Fast data streams
  },
  style: 'tech',
};

/**
 * MUTANTS - Zrujnowane budynki, Sentinel Factory
 * Ruined, aggressive environment with red/orange accents
 */
const THEME_MUTANTS: EnvironmentTheme = {
  id: 'mutants',
  name: 'Mutanci',
  sky: {
    top: 0x1a0a0a,       // Dark red-tinted sky
    bottom: 0x2d1515,    // Smoky red
    stars: 0xffaaaa,     // Red-tinted stars
    clouds: 0x3a1a1a,    // Red smoke
    starCount: 40,
    cloudCount: 10,      // Heavy smoke/debris
    cloudAlpha: 0.3,
  },
  deck: {
    plate: 0x3a3530,     // Rusty metal
    plateDark: 0x2a2520, // Darker rust
    line: 0x4a4540,      // Damaged lines
    edge: 0x5a5550,      // Broken edges
    warning: 0xee4540,   // Sentinel red
    warningDark: 0x3a1510,
    railing: 0x6a6560,   // Damaged railings
    accent: 0xee4540,    // Alert red
    accentGlow: 0xff6660,
  },
  effects: {
    supportsCracks: true,  // Heavily damaged
    supportsFlicker: true,
    crackColor: 0x2a2520,
    flickerElements: 'neon', // Damaged emergency lights
  },
  parallax: {
    starColor: 0xffaaaa,
    cloudColor: 0x3a1a1a,
    starCount: 30,
    cloudCount: 12,
    cloudSpeed: 0.8,
  },
  style: 'ruined',
};

/**
 * COSMOS - Przestrzeń kosmiczna, planety, statki
 * Deep space with purple/blue cosmic colors
 */
const THEME_COSMOS: EnvironmentTheme = {
  id: 'cosmos',
  name: 'Kosmos',
  sky: {
    top: 0x050510,       // Deep space black
    bottom: 0x0c0032,    // Cosmic purple tint
    stars: 0xffffff,     // Bright stars
    clouds: 0x190061,    // Nebula purple
    starCount: 150,      // Many stars
    cloudCount: 6,       // Nebula patches
    cloudAlpha: 0.2,
  },
  deck: {
    plate: 0x1a1a2e,     // Dark space metal
    plateDark: 0x12121f, // Darker
    line: 0x3500d3,      // Purple energy lines
    edge: 0x2a2a4e,      // Edge
    warning: 0x8844cc,   // Purple warning
    warningDark: 0x220044,
    railing: 0x4a4a7a,   // Energy barriers
    accent: 0x3500d3,    // Cosmic purple
    accentGlow: 0x6622ff,
  },
  effects: {
    supportsCracks: false,
    supportsFlicker: true,
    crackColor: 0x12121f,
    flickerElements: 'lightning', // Energy fluctuations
  },
  parallax: {
    starColor: 0xffffff,
    cloudColor: 0x190061,
    starCount: 150,
    cloudCount: 8,
    cloudSpeed: 0.3,     // Slow nebula drift
  },
  style: 'cosmic',
};

/**
 * MAGIC - Wymiary alternatywne, portale, runy
 * Mystical environment with gold/purple magical colors
 */
const THEME_MAGIC: EnvironmentTheme = {
  id: 'magic',
  name: 'Magia',
  sky: {
    top: 0x1a0a2e,       // Dark mystical purple
    bottom: 0x2a1a4e,    // Lighter purple
    stars: 0xfbbf24,     // Golden magical sparks
    clouds: 0x3a2a5e,    // Mystical fog
    starCount: 80,       // Magical particles
    cloudCount: 12,      // Heavy mystical fog
    cloudAlpha: 0.35,
  },
  deck: {
    plate: 0x4a4a5a,     // Stone gray
    plateDark: 0x3a3a4a, // Darker stone
    line: 0xfbbf24,      // Golden rune lines
    edge: 0x5a5a6a,      // Stone edge
    warning: 0xfbbf24,   // Gold warning
    warningDark: 0x3a3010,
    railing: 0x6b21a8,   // Magical barriers
    accent: 0xfbbf24,    // Golden runes
    accentGlow: 0xffdd66,
  },
  effects: {
    supportsCracks: true,  // Stone can crack
    supportsFlicker: true,
    crackColor: 0x2a2a3a,
    flickerElements: 'runes', // Magical rune glow
  },
  parallax: {
    starColor: 0xfbbf24,
    cloudColor: 0x3a2a5e,
    starCount: 100,
    cloudCount: 15,
    cloudSpeed: 0.4,     // Slow mystical drift
  },
  style: 'mystical',
};

/**
 * GODS - Asgard, Rainbow Bridge, złote pałace
 * Divine realm with gold/lightning colors
 */
const THEME_GODS: EnvironmentTheme = {
  id: 'gods',
  name: 'Bogowie',
  sky: {
    top: 0x1a1a0f,       // Dark gold tint
    bottom: 0x2a2a1f,    // Lighter gold
    stars: 0xffd700,     // Bright gold stars
    clouds: 0x3a3a2a,    // Golden clouds
    starCount: 100,
    cloudCount: 8,
    cloudAlpha: 0.25,
  },
  deck: {
    plate: 0xd4af37,     // Golden floor
    plateDark: 0xb8962f, // Darker gold
    line: 0xffd700,      // Bright gold lines
    edge: 0xe8c547,      // Gold edge
    warning: 0xffd700,   // Gold warning
    warningDark: 0x4a4010,
    railing: 0xf0e060,   // Divine barriers
    accent: 0xffd700,    // Pure gold
    accentGlow: 0xffee88,
  },
  effects: {
    supportsCracks: true,
    supportsFlicker: true,
    crackColor: 0x8a7020,
    flickerElements: 'lightning', // Divine lightning
  },
  parallax: {
    starColor: 0xffd700,
    cloudColor: 0x3a3a2a,
    starCount: 120,
    cloudCount: 10,
    cloudSpeed: 0.6,
  },
  style: 'divine',
};

// ============================================================================
// THEME MAP
// ============================================================================

const THEMES: Record<PillarId, EnvironmentTheme> = {
  streets: THEME_STREETS,
  science: THEME_SCIENCE,
  mutants: THEME_MUTANTS,
  cosmos: THEME_COSMOS,
  magic: THEME_MAGIC,
  gods: THEME_GODS,
};

// Default theme (used in hub/idle state)
const DEFAULT_THEME = THEME_STREETS;

// ============================================================================
// THEME MANAGER CLASS
// ============================================================================

/**
 * ThemeManager provides centralized theme access and transition management.
 */
class ThemeManager {
  private currentTheme: EnvironmentTheme = DEFAULT_THEME;
  private listeners: Array<(theme: EnvironmentTheme) => void> = [];

  /**
   * Get theme for a specific pillar.
   */
  public getThemeForPillar(pillarId: PillarId): EnvironmentTheme {
    return THEMES[pillarId] ?? DEFAULT_THEME;
  }

  /**
   * Get the current active theme.
   */
  public getCurrentTheme(): EnvironmentTheme {
    return this.currentTheme;
  }

  /**
   * Set the current theme by pillar ID.
   * Returns true if theme changed.
   */
  public setTheme(pillarId: PillarId): boolean {
    const newTheme = this.getThemeForPillar(pillarId);
    if (newTheme.id !== this.currentTheme.id) {
      this.currentTheme = newTheme;
      this.notifyListeners();
      return true;
    }
    return false;
  }

  /**
   * Reset to default theme (for hub/idle state).
   */
  public resetToDefault(): void {
    if (this.currentTheme.id !== DEFAULT_THEME.id) {
      this.currentTheme = DEFAULT_THEME;
      this.notifyListeners();
    }
  }

  /**
   * Subscribe to theme changes.
   */
  public subscribe(callback: (theme: EnvironmentTheme) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.currentTheme);
    }
  }

  /**
   * Get all available themes.
   */
  public getAllThemes(): EnvironmentTheme[] {
    return Object.values(THEMES);
  }
}

// Export singleton instance
export const themeManager = new ThemeManager();

// Export types and constants
export { THEMES, DEFAULT_THEME };
export type { PillarId };
