/**
 * VFXSystem - Re-exports the refactored modular VFX system.
 * 
 * The VFX system has been refactored into modules under ./vfx/:
 * - types.ts: Core type definitions
 * - config.ts: Color configs and effect parameters
 * - particlePool.ts: Object pooling for particles
 * - particleFactory.ts: Data-driven particle creation
 * - effects/: Specialized effect handlers (explosions, deaths, text, skills)
 * - index.ts: Main VFXSystem class
 */
export { VFXSystem, type FloatingText } from './vfx/index.js';
