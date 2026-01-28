/**
 * ParallaxBackground - Re-export from CosmicBackground for backwards compatibility
 *
 * This file maintains backwards compatibility with existing imports.
 * The actual implementation is now in CosmicBackground/index.ts
 */

export {
  cosmicBackground as parallaxBackground,
  CosmicBackground as ParallaxBackground,
  type ParallaxConfig,
} from './CosmicBackground/index.js';
