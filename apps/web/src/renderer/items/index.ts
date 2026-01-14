/**
 * Item Renderers - PixiJS procedural rendering for game items
 *
 * Exports all item renderer classes and utilities for:
 * - Artifacts (equipment with visual effects)
 * - Materials (crafting components)
 * - Crystals (Infinity Stones with fragment states)
 */

export { ArtifactRenderer, ARTIFACT_VISUALS } from './ArtifactRenderer.js';
export type { ArtifactRenderOptions } from './ArtifactRenderer.js';

export { MaterialRenderer, MATERIAL_VISUALS } from './MaterialRenderer.js';
export type { MaterialRenderOptions } from './MaterialRenderer.js';

export {
  CrystalRenderer,
  CRYSTAL_VISUALS,
  createCrystalMatrixDisplay,
} from './CrystalRenderer.js';
export type { CrystalRenderOptions } from './CrystalRenderer.js';
