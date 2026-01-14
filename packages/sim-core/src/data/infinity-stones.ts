/**
 * @deprecated This file is deprecated. Use crystals.ts instead.
 * This file re-exports from crystals.ts for backwards compatibility.
 */

// Re-export everything from crystals.ts for backwards compatibility
export * from './crystals.js';

// Type aliases for migration
export type {
  CrystalDefinition as InfinityStoneDefinition,
  CrystalEffect as InfinityStoneEffect,
  CrystalMatrixDefinition as InfinityGauntletDefinition,
  CrystalFragmentState as StoneFragmentState,
} from './crystals.js';
