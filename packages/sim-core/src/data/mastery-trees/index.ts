/**
 * Mastery Trees Index
 *
 * Exports all class mastery tree definitions
 */

import type { FortressClass } from '../../types.js';
import type { MasteryTreeDefinition, MasteryNodeDefinition } from '../mastery.js';
import { FIRE_MASTERY_TREE } from './fire.js';
import { LIGHTNING_MASTERY_TREE } from './lightning.js';
import { ICE_MASTERY_TREE } from './ice.js';
import { NATURAL_MASTERY_TREE } from './natural.js';
import { TECH_MASTERY_TREE } from './tech.js';
import { VOID_MASTERY_TREE } from './void.js';
import { PLASMA_MASTERY_TREE } from './plasma.js';

// Export individual trees
export { FIRE_MASTERY_TREE } from './fire.js';
export { LIGHTNING_MASTERY_TREE } from './lightning.js';
export { ICE_MASTERY_TREE } from './ice.js';
export { NATURAL_MASTERY_TREE } from './natural.js';
export { TECH_MASTERY_TREE } from './tech.js';
export { VOID_MASTERY_TREE } from './void.js';
export { PLASMA_MASTERY_TREE } from './plasma.js';

/**
 * All mastery trees indexed by class
 */
export const MASTERY_TREES: Record<FortressClass, MasteryTreeDefinition> = {
  fire: FIRE_MASTERY_TREE,
  lightning: LIGHTNING_MASTERY_TREE,
  ice: ICE_MASTERY_TREE,
  natural: NATURAL_MASTERY_TREE,
  tech: TECH_MASTERY_TREE,
  void: VOID_MASTERY_TREE,
  plasma: PLASMA_MASTERY_TREE,
};

/**
 * Get mastery tree for a specific class
 */
export function getMasteryTree(classId: FortressClass): MasteryTreeDefinition {
  return MASTERY_TREES[classId];
}

/**
 * Get a specific node by ID
 */
export function getMasteryNodeById(nodeId: string): MasteryNodeDefinition | undefined {
  for (const tree of Object.values(MASTERY_TREES)) {
    const node = tree.nodes.find((n) => n.id === nodeId);
    if (node) return node;
  }
  return undefined;
}

/**
 * Get all nodes for a specific class
 */
export function getMasteryNodesForClass(classId: FortressClass): MasteryNodeDefinition[] {
  return MASTERY_TREES[classId].nodes;
}

/**
 * Get nodes by tier for a specific class
 */
export function getMasteryNodesByTier(
  classId: FortressClass,
  tier: 1 | 2 | 3 | 4 | 5
): MasteryNodeDefinition[] {
  return MASTERY_TREES[classId].nodes.filter((n) => n.tier === tier);
}

/**
 * Get all class IDs
 */
export function getAllMasteryClasses(): FortressClass[] {
  return Object.keys(MASTERY_TREES) as FortressClass[];
}
