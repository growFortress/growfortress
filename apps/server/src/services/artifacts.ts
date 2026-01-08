import { prisma } from '../lib/prisma.js';
import {
  getArtifactById,
  calculateArtifactCraftCost,
  canHeroEquipArtifact,
  getHeroById,
} from '@arcade/sim-core';
import type { PlayerArtifact, PlayerItem } from '@arcade/protocol';

/**
 * Get all player artifacts
 */
export async function getPlayerArtifacts(userId: string): Promise<PlayerArtifact[]> {
  const artifacts = await prisma.playerArtifact.findMany({
    where: { userId },
    orderBy: { acquiredAt: 'desc' },
  });

  return artifacts.map((a) => ({
    id: a.id,
    artifactId: a.artifactId,
    equippedToHeroId: a.equippedToHeroId,
    acquiredAt: a.acquiredAt.toISOString(),
  }));
}

/**
 * Get all player items
 */
export async function getPlayerItems(userId: string): Promise<PlayerItem[]> {
  const inventory = await prisma.inventory.findUnique({
    where: { userId },
    select: { items: true },
  });

  if (!inventory) return [];

  const items =
    typeof inventory.items === 'object' && inventory.items !== null
      ? (inventory.items as Record<string, number>)
      : {};

  return Object.entries(items)
    .filter(([_, amount]) => amount > 0)
    .map(([itemId, amount]) => ({ itemId, amount }));
}

/**
 * Craft an artifact
 */
export async function craftArtifact(
  userId: string,
  artifactId: string
): Promise<{
  success: boolean;
  artifact?: PlayerArtifact;
  newInventory?: { gold: number; dust: number; materials: Record<string, number> };
  error?: string;
}> {
  // Get artifact definition
  const artifactDef = getArtifactById(artifactId);
  if (!artifactDef) {
    return { success: false, error: 'Artifact not found' };
  }

  // Check if artifact is craftable
  if (artifactDef.source.type !== 'craft') {
    return { success: false, error: 'Artifact is not craftable' };
  }

  // Get craft cost
  const craftCost = calculateArtifactCraftCost(artifactId);
  if (!craftCost) {
    return { success: false, error: 'Could not determine craft cost' };
  }

  // Check if player already has this artifact
  const existingArtifact = await prisma.playerArtifact.findUnique({
    where: { userId_artifactId: { userId, artifactId } },
  });

  if (existingArtifact) {
    return { success: false, error: 'You already own this artifact' };
  }

  // Get player inventory
  const inventory = await prisma.inventory.findUnique({
    where: { userId },
  });

  if (!inventory) {
    return { success: false, error: 'Inventory not found' };
  }

  // Check gold
  if (inventory.gold < craftCost.gold) {
    return { success: false, error: 'Not enough gold' };
  }

  // Check materials
  const materials =
    typeof inventory.materials === 'object' && inventory.materials !== null
      ? (inventory.materials as Record<string, number>)
      : {};

  for (const { material, amount } of craftCost.materials) {
    const playerAmount = materials[material] ?? 0;
    if (playerAmount < amount) {
      return {
        success: false,
        error: `Not enough ${material}. Required: ${amount}, Have: ${playerAmount}`,
      };
    }
  }

  // Deduct costs and create artifact
  const updatedMaterials = { ...materials };
  for (const { material, amount } of craftCost.materials) {
    updatedMaterials[material] = (updatedMaterials[material] ?? 0) - amount;
    if (updatedMaterials[material] <= 0) {
      delete updatedMaterials[material];
    }
  }

  const [updatedInventory, newArtifact] = await prisma.$transaction([
    prisma.inventory.update({
      where: { userId },
      data: {
        gold: { decrement: craftCost.gold },
        materials: updatedMaterials,
      },
    }),
    prisma.playerArtifact.create({
      data: {
        userId,
        artifactId,
      },
    }),
  ]);

  return {
    success: true,
    artifact: {
      id: newArtifact.id,
      artifactId: newArtifact.artifactId,
      equippedToHeroId: newArtifact.equippedToHeroId,
      acquiredAt: newArtifact.acquiredAt.toISOString(),
    },
    newInventory: {
      gold: updatedInventory.gold,
      dust: updatedInventory.dust,
      materials:
        typeof updatedInventory.materials === 'object' && updatedInventory.materials !== null
          ? (updatedInventory.materials as Record<string, number>)
          : {},
    },
  };
}

/**
 * Equip an artifact to a hero
 */
export async function equipArtifact(
  userId: string,
  artifactInstanceId: string,
  heroId: string
): Promise<{
  success: boolean;
  artifact?: PlayerArtifact;
  error?: string;
}> {
  // Get the artifact instance
  const artifact = await prisma.playerArtifact.findFirst({
    where: { id: artifactInstanceId, userId },
  });

  if (!artifact) {
    return { success: false, error: 'Artifact not found' };
  }

  // Get artifact definition
  const artifactDef = getArtifactById(artifact.artifactId);
  if (!artifactDef) {
    return { success: false, error: 'Artifact definition not found' };
  }

  // Get hero definition
  const heroDef = getHeroById(heroId);
  if (!heroDef) {
    return { success: false, error: 'Hero not found' };
  }

  // Check if hero can equip this artifact
  // For now, assume tier 1 - in real implementation, get hero tier from player data
  const heroTier = 1;
  if (!canHeroEquipArtifact(artifact.artifactId, heroId, heroDef.class, heroTier)) {
    return { success: false, error: 'Hero cannot equip this artifact' };
  }

  // Unequip any artifact currently equipped to this hero
  await prisma.playerArtifact.updateMany({
    where: { userId, equippedToHeroId: heroId },
    data: { equippedToHeroId: null },
  });

  // Equip the artifact
  const updatedArtifact = await prisma.playerArtifact.update({
    where: { id: artifactInstanceId },
    data: { equippedToHeroId: heroId },
  });

  return {
    success: true,
    artifact: {
      id: updatedArtifact.id,
      artifactId: updatedArtifact.artifactId,
      equippedToHeroId: updatedArtifact.equippedToHeroId,
      acquiredAt: updatedArtifact.acquiredAt.toISOString(),
    },
  };
}

/**
 * Unequip an artifact from a hero
 */
export async function unequipArtifact(
  userId: string,
  artifactInstanceId: string
): Promise<{
  success: boolean;
  artifact?: PlayerArtifact;
  error?: string;
}> {
  // Get the artifact instance
  const artifact = await prisma.playerArtifact.findFirst({
    where: { id: artifactInstanceId, userId },
  });

  if (!artifact) {
    return { success: false, error: 'Artifact not found' };
  }

  // Unequip the artifact
  const updatedArtifact = await prisma.playerArtifact.update({
    where: { id: artifactInstanceId },
    data: { equippedToHeroId: null },
  });

  return {
    success: true,
    artifact: {
      id: updatedArtifact.id,
      artifactId: updatedArtifact.artifactId,
      equippedToHeroId: updatedArtifact.equippedToHeroId,
      acquiredAt: updatedArtifact.acquiredAt.toISOString(),
    },
  };
}

/**
 * Use an item
 */
export async function useItem(
  userId: string,
  itemId: string,
  amount: number = 1
): Promise<{
  success: boolean;
  items?: PlayerItem[];
  error?: string;
}> {
  // Get player inventory
  const inventory = await prisma.inventory.findUnique({
    where: { userId },
    select: { items: true },
  });

  if (!inventory) {
    return { success: false, error: 'Inventory not found' };
  }

  const items =
    typeof inventory.items === 'object' && inventory.items !== null
      ? (inventory.items as Record<string, number>)
      : {};

  const currentAmount = items[itemId] ?? 0;
  if (currentAmount < amount) {
    return { success: false, error: 'Not enough items' };
  }

  // Deduct item
  const updatedItems = { ...items };
  updatedItems[itemId] = currentAmount - amount;
  if (updatedItems[itemId] <= 0) {
    delete updatedItems[itemId];
  }

  await prisma.inventory.update({
    where: { userId },
    data: { items: updatedItems },
  });

  return {
    success: true,
    items: Object.entries(updatedItems)
      .filter(([_, amt]) => amt > 0)
      .map(([id, amt]) => ({ itemId: id, amount: amt })),
  };
}

/**
 * Add an artifact to player (for drops, quests, etc.)
 */
export async function addArtifact(
  userId: string,
  artifactId: string
): Promise<{
  success: boolean;
  artifact?: PlayerArtifact;
  error?: string;
}> {
  // Check if player already has this artifact
  const existing = await prisma.playerArtifact.findUnique({
    where: { userId_artifactId: { userId, artifactId } },
  });

  if (existing) {
    return { success: false, error: 'You already own this artifact' };
  }

  const artifact = await prisma.playerArtifact.create({
    data: { userId, artifactId },
  });

  return {
    success: true,
    artifact: {
      id: artifact.id,
      artifactId: artifact.artifactId,
      equippedToHeroId: artifact.equippedToHeroId,
      acquiredAt: artifact.acquiredAt.toISOString(),
    },
  };
}

/**
 * Add items to player inventory
 */
export async function addItems(
  userId: string,
  itemsToAdd: Record<string, number>
): Promise<{
  success: boolean;
  items?: PlayerItem[];
  error?: string;
}> {
  const inventory = await prisma.inventory.findUnique({
    where: { userId },
    select: { items: true },
  });

  if (!inventory) {
    return { success: false, error: 'Inventory not found' };
  }

  const currentItems =
    typeof inventory.items === 'object' && inventory.items !== null
      ? (inventory.items as Record<string, number>)
      : {};

  const updatedItems = { ...currentItems };
  for (const [itemId, amount] of Object.entries(itemsToAdd)) {
    updatedItems[itemId] = (updatedItems[itemId] ?? 0) + amount;
  }

  await prisma.inventory.update({
    where: { userId },
    data: { items: updatedItems },
  });

  return {
    success: true,
    items: Object.entries(updatedItems)
      .filter(([_, amt]) => amt > 0)
      .map(([id, amt]) => ({ itemId: id, amount: amt })),
  };
}
