import { prisma } from '../lib/prisma.js';
import {
  getArtifactById,
  calculateArtifactCraftCost,
  calculateUpgradeCost,
  calculateDismantleReturn,
  validateFusion,
  getFusionResults,
  canHeroEquipArtifact,
  canEquipToSlot,
  getHeroById,
} from '@arcade/sim-core';
import type { PlayerArtifact, PlayerItem, ArtifactSlotType } from '@arcade/protocol';

/**
 * Get all player artifacts (with new level and slot fields)
 */
export async function getPlayerArtifacts(userId: string): Promise<PlayerArtifact[]> {
  const artifacts = await prisma.playerArtifact.findMany({
    where: { userId },
    orderBy: { acquiredAt: 'desc' },
  });

  return artifacts.map((a) => ({
    id: a.id,
    artifactId: a.artifactId,
    level: a.level,
    equippedSlot: a.equippedSlot as ArtifactSlotType | null,
    equippedToHeroId: a.equippedToHeroId,
    acquiredAt: a.acquiredAt.toISOString(),
    upgradedAt: a.upgradedAt?.toISOString() ?? null,
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

  // Get player inventory (optimized: select only needed fields)
  const inventory = await prisma.inventory.findUnique({
    where: { userId },
    select: { gold: true, dust: true, materials: true },
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
      level: newArtifact.level,
      equippedSlot: newArtifact.equippedSlot as 'weapon' | 'armor' | 'accessory' | null,
      equippedToHeroId: newArtifact.equippedToHeroId,
      acquiredAt: newArtifact.acquiredAt.toISOString(),
      upgradedAt: newArtifact.upgradedAt?.toISOString() ?? null,
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
 * Equip an artifact to a hero (3-slot system)
 */
export async function equipArtifact(
  userId: string,
  artifactInstanceId: string,
  heroId: string,
  slotType: ArtifactSlotType
): Promise<{
  success: boolean;
  artifact?: PlayerArtifact;
  unequippedArtifact?: PlayerArtifact;
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

  // Verify slot type matches artifact's slot type
  if (!canEquipToSlot(artifact.artifactId, slotType)) {
    return {
      success: false,
      error: `This artifact cannot be equipped to ${slotType} slot. It requires ${artifactDef.slotType} slot.`,
    };
  }

  // Get hero definition
  const heroDef = getHeroById(heroId);
  if (!heroDef) {
    return { success: false, error: 'Hero not found' };
  }

  // Check if hero can equip this artifact (tier check only in new system)
  const heroTier = 1; // TODO: Get actual hero tier from player data
  if (!canHeroEquipArtifact(artifact.artifactId, heroId, heroDef.class, heroTier)) {
    return { success: false, error: 'Hero does not meet tier requirements for this artifact' };
  }

  // Check if artifact is already equipped to another hero
  if (artifact.equippedToHeroId && artifact.equippedToHeroId !== heroId) {
    return { success: false, error: 'Artifact is equipped to another hero. Unequip it first.' };
  }

  // Find any artifact currently equipped in this slot on this hero
  const currentSlotArtifact = await prisma.playerArtifact.findFirst({
    where: {
      userId,
      equippedToHeroId: heroId,
      equippedSlot: slotType,
    },
  });

  let unequippedArtifact: PlayerArtifact | undefined;

  // Unequip current artifact in slot if different from the one being equipped
  if (currentSlotArtifact && currentSlotArtifact.id !== artifactInstanceId) {
    const unequipped = await prisma.playerArtifact.update({
      where: { id: currentSlotArtifact.id },
      data: { equippedToHeroId: null, equippedSlot: null },
    });
    unequippedArtifact = {
      id: unequipped.id,
      artifactId: unequipped.artifactId,
      level: unequipped.level,
      equippedSlot: null,
      equippedToHeroId: null,
      acquiredAt: unequipped.acquiredAt.toISOString(),
      upgradedAt: unequipped.upgradedAt?.toISOString() ?? null,
    };
  }

  // Equip the artifact to the specified slot
  const updatedArtifact = await prisma.playerArtifact.update({
    where: { id: artifactInstanceId },
    data: {
      equippedToHeroId: heroId,
      equippedSlot: slotType,
    },
  });

  return {
    success: true,
    artifact: {
      id: updatedArtifact.id,
      artifactId: updatedArtifact.artifactId,
      level: updatedArtifact.level,
      equippedSlot: updatedArtifact.equippedSlot as ArtifactSlotType | null,
      equippedToHeroId: updatedArtifact.equippedToHeroId,
      acquiredAt: updatedArtifact.acquiredAt.toISOString(),
      upgradedAt: updatedArtifact.upgradedAt?.toISOString() ?? null,
    },
    unequippedArtifact,
  };
}

/**
 * Unequip an artifact from a hero (clears both heroId and slot)
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

  // Unequip the artifact (clear both heroId and slot)
  const updatedArtifact = await prisma.playerArtifact.update({
    where: { id: artifactInstanceId },
    data: {
      equippedToHeroId: null,
      equippedSlot: null,
    },
  });

  return {
    success: true,
    artifact: {
      id: updatedArtifact.id,
      artifactId: updatedArtifact.artifactId,
      level: updatedArtifact.level,
      equippedSlot: null,
      equippedToHeroId: null,
      acquiredAt: updatedArtifact.acquiredAt.toISOString(),
      upgradedAt: updatedArtifact.upgradedAt?.toISOString() ?? null,
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
      level: artifact.level,
      equippedSlot: artifact.equippedSlot as 'weapon' | 'armor' | 'accessory' | null,
      equippedToHeroId: artifact.equippedToHeroId,
      acquiredAt: artifact.acquiredAt.toISOString(),
      upgradedAt: artifact.upgradedAt?.toISOString() ?? null,
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

// ============================================================================
// CRAFTING 2.0 - UPGRADE / FUSE / DISMANTLE
// ============================================================================

/**
 * Upgrade an artifact's level (1-20)
 */
export async function upgradeArtifact(
  userId: string,
  artifactInstanceId: string,
  targetLevel?: number
): Promise<{
  success: boolean;
  artifact?: PlayerArtifact;
  newLevel?: number;
  goldSpent?: number;
  materialsSpent?: Record<string, number>;
  newInventory?: { gold: number; dust: number; materials: Record<string, number> };
  error?: string;
}> {
  // Get the artifact instance
  const artifact = await prisma.playerArtifact.findFirst({
    where: { id: artifactInstanceId, userId },
  });

  if (!artifact) {
    return { success: false, error: 'Artifact not found' };
  }

  const currentLevel = artifact.level;
  const actualTargetLevel = targetLevel ?? currentLevel + 1;

  if (actualTargetLevel <= currentLevel) {
    return { success: false, error: 'Target level must be higher than current level' };
  }

  if (actualTargetLevel > 20) {
    return { success: false, error: 'Maximum artifact level is 20' };
  }

  // Calculate upgrade cost
  const upgradeCost = calculateUpgradeCost(artifact.artifactId, currentLevel, actualTargetLevel);
  if (!upgradeCost) {
    return { success: false, error: 'Could not calculate upgrade cost' };
  }

  // Get player inventory (optimized: select only needed fields)
  const inventory = await prisma.inventory.findUnique({
    where: { userId },
    select: { gold: true, dust: true, materials: true },
  });

  if (!inventory) {
    return { success: false, error: 'Inventory not found' };
  }

  // Check gold
  if (inventory.gold < upgradeCost.gold) {
    return { success: false, error: `Not enough gold. Need ${upgradeCost.gold}, have ${inventory.gold}` };
  }

  // Check materials
  const materials =
    typeof inventory.materials === 'object' && inventory.materials !== null
      ? (inventory.materials as Record<string, number>)
      : {};

  for (const { material, amount } of upgradeCost.materials) {
    const playerAmount = materials[material] ?? 0;
    if (playerAmount < amount) {
      return {
        success: false,
        error: `Not enough ${material}. Need ${amount}, have ${playerAmount}`,
      };
    }
  }

  // Deduct costs
  const updatedMaterials = { ...materials };
  const materialsSpent: Record<string, number> = {};

  for (const { material, amount } of upgradeCost.materials) {
    updatedMaterials[material] = (updatedMaterials[material] ?? 0) - amount;
    materialsSpent[material] = amount;
    if (updatedMaterials[material] <= 0) {
      delete updatedMaterials[material];
    }
  }

  // Update in transaction
  const [updatedInventory, updatedArtifact] = await prisma.$transaction([
    prisma.inventory.update({
      where: { userId },
      data: {
        gold: { decrement: upgradeCost.gold },
        materials: updatedMaterials,
      },
    }),
    prisma.playerArtifact.update({
      where: { id: artifactInstanceId },
      data: {
        level: actualTargetLevel,
        upgradedAt: new Date(),
      },
    }),
  ]);

  return {
    success: true,
    artifact: {
      id: updatedArtifact.id,
      artifactId: updatedArtifact.artifactId,
      level: updatedArtifact.level,
      equippedSlot: updatedArtifact.equippedSlot as ArtifactSlotType | null,
      equippedToHeroId: updatedArtifact.equippedToHeroId,
      acquiredAt: updatedArtifact.acquiredAt.toISOString(),
      upgradedAt: updatedArtifact.upgradedAt?.toISOString() ?? null,
    },
    newLevel: actualTargetLevel,
    goldSpent: upgradeCost.gold,
    materialsSpent,
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
 * Fuse 3 artifacts of same rarity into 1 of higher rarity
 */
export async function fuseArtifacts(
  userId: string,
  artifactInstanceIds: string[]
): Promise<{
  success: boolean;
  resultArtifact?: PlayerArtifact;
  consumedArtifactIds?: string[];
  error?: string;
}> {
  if (artifactInstanceIds.length !== 3) {
    return { success: false, error: 'Fusion requires exactly 3 artifacts' };
  }

  // Get all artifact instances
  const artifacts = await prisma.playerArtifact.findMany({
    where: {
      id: { in: artifactInstanceIds },
      userId,
    },
  });

  if (artifacts.length !== 3) {
    return { success: false, error: 'One or more artifacts not found' };
  }

  // Check if any are equipped
  if (artifacts.some(a => a.equippedToHeroId)) {
    return { success: false, error: 'Cannot fuse equipped artifacts. Unequip them first.' };
  }

  // Validate fusion rules
  const artifactIds = artifacts.map(a => a.artifactId);
  const validation = validateFusion(artifactIds);

  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Get possible results
  const possibleResults = getFusionResults(validation.rarity!, validation.slotType);
  if (!possibleResults || possibleResults.length === 0) {
    return { success: false, error: 'No valid fusion results available' };
  }

  // Pick a random result (deterministic based on artifact IDs for reproducibility)
  const seed = artifactInstanceIds.sort().join('').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const resultIndex = seed % possibleResults.length;
  const resultArtifactDef = possibleResults[resultIndex];

  // Check if player already owns this artifact
  const existingArtifact = await prisma.playerArtifact.findUnique({
    where: { userId_artifactId: { userId, artifactId: resultArtifactDef.id } },
  });

  if (existingArtifact) {
    return {
      success: false,
      error: `You already own ${resultArtifactDef.polishName}. Cannot fuse to create a duplicate.`,
    };
  }

  // Perform fusion in transaction
  const [, newArtifact] = await prisma.$transaction([
    // Delete the 3 consumed artifacts
    prisma.playerArtifact.deleteMany({
      where: {
        id: { in: artifactInstanceIds },
        userId,
      },
    }),
    // Create the new artifact
    prisma.playerArtifact.create({
      data: {
        userId,
        artifactId: resultArtifactDef.id,
        level: 1,
      },
    }),
  ]);

  return {
    success: true,
    resultArtifact: {
      id: newArtifact.id,
      artifactId: newArtifact.artifactId,
      level: newArtifact.level,
      equippedSlot: null,
      equippedToHeroId: null,
      acquiredAt: newArtifact.acquiredAt.toISOString(),
      upgradedAt: null,
    },
    consumedArtifactIds: artifactInstanceIds,
  };
}

/**
 * Dismantle an artifact to recover materials
 */
export async function dismantleArtifact(
  userId: string,
  artifactInstanceId: string
): Promise<{
  success: boolean;
  dismantledArtifactId?: string;
  materialsRecovered?: Record<string, number>;
  goldRecovered?: number;
  newInventory?: { gold: number; dust: number; materials: Record<string, number> };
  error?: string;
}> {
  // Get the artifact instance
  const artifact = await prisma.playerArtifact.findFirst({
    where: { id: artifactInstanceId, userId },
  });

  if (!artifact) {
    return { success: false, error: 'Artifact not found' };
  }

  // Check if equipped
  if (artifact.equippedToHeroId) {
    return { success: false, error: 'Cannot dismantle equipped artifact. Unequip it first.' };
  }

  // Calculate materials to recover
  const dismantleReturn = calculateDismantleReturn(artifact.artifactId, artifact.level);
  if (!dismantleReturn) {
    return { success: false, error: 'Could not calculate dismantle return' };
  }

  // Get current inventory
  const inventory = await prisma.inventory.findUnique({
    where: { userId },
  });

  if (!inventory) {
    return { success: false, error: 'Inventory not found' };
  }

  // Calculate new materials
  const currentMaterials =
    typeof inventory.materials === 'object' && inventory.materials !== null
      ? (inventory.materials as Record<string, number>)
      : {};

  const updatedMaterials = { ...currentMaterials };
  const materialsRecovered: Record<string, number> = {};

  for (const { material, amount } of dismantleReturn.materials) {
    updatedMaterials[material] = (updatedMaterials[material] ?? 0) + amount;
    materialsRecovered[material] = amount;
  }

  // Perform dismantle in transaction
  const [updatedInventory] = await prisma.$transaction([
    prisma.inventory.update({
      where: { userId },
      data: {
        gold: { increment: dismantleReturn.gold },
        materials: updatedMaterials,
      },
    }),
    prisma.playerArtifact.delete({
      where: { id: artifactInstanceId },
    }),
  ]);

  return {
    success: true,
    dismantledArtifactId: artifactInstanceId,
    materialsRecovered,
    goldRecovered: dismantleReturn.gold,
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
 * Get upgrade cost preview
 */
export async function getUpgradeCostPreview(
  userId: string,
  artifactInstanceId: string,
  targetLevel: number
): Promise<{
  success: boolean;
  currentLevel?: number;
  targetLevel?: number;
  cost?: { gold: number; materials: Record<string, number> };
  canAfford?: boolean;
  error?: string;
}> {
  // Get the artifact instance
  const artifact = await prisma.playerArtifact.findFirst({
    where: { id: artifactInstanceId, userId },
  });

  if (!artifact) {
    return { success: false, error: 'Artifact not found' };
  }

  if (targetLevel <= artifact.level) {
    return { success: false, error: 'Target level must be higher than current level' };
  }

  if (targetLevel > 20) {
    return { success: false, error: 'Maximum artifact level is 20' };
  }

  // Calculate upgrade cost
  const upgradeCost = calculateUpgradeCost(artifact.artifactId, artifact.level, targetLevel);
  if (!upgradeCost) {
    return { success: false, error: 'Could not calculate upgrade cost' };
  }

  // Get player inventory to check affordability
  const inventory = await prisma.inventory.findUnique({
    where: { userId },
  });

  if (!inventory) {
    return { success: false, error: 'Inventory not found' };
  }

  const materials =
    typeof inventory.materials === 'object' && inventory.materials !== null
      ? (inventory.materials as Record<string, number>)
      : {};

  // Check affordability
  let canAfford = inventory.gold >= upgradeCost.gold;

  if (canAfford) {
    for (const { material, amount } of upgradeCost.materials) {
      if ((materials[material] ?? 0) < amount) {
        canAfford = false;
        break;
      }
    }
  }

  // Convert materials array to record
  const materialsRecord: Record<string, number> = {};
  for (const { material, amount } of upgradeCost.materials) {
    materialsRecord[material] = amount;
  }

  return {
    success: true,
    currentLevel: artifact.level,
    targetLevel,
    cost: {
      gold: upgradeCost.gold,
      materials: materialsRecord,
    },
    canAfford,
  };
}
