import { prisma } from '../lib/prisma.js';
import { HERO_UNLOCK_COSTS, FREE_STARTER_HEROES, TURRET_UNLOCK_COST, FREE_STARTER_TURRETS } from '@arcade/protocol';
import { getHeroById } from '@arcade/sim-core';
import type { HeroRarity } from '@arcade/protocol';

// Map legacy hero IDs to new canonical IDs (keep in sync with auth.ts)
const LEGACY_HERO_ID_MAP: Record<string, string> = {
  shield_captain: 'vanguard',
  thunderlord: 'storm',
  scarlet_mage: 'rift',
  iron_sentinel: 'forge',
  jade_titan: 'titan',
  frost_archer: 'frost_unit',
};

/**
 * Normalize a hero ID, mapping legacy IDs to their canonical versions
 */
function normalizeHeroId(heroId: string): string {
  return LEGACY_HERO_ID_MAP[heroId] ?? heroId;
}

/**
 * Unlock a hero for the user
 */
export async function unlockHero(
  userId: string,
  heroId: string
): Promise<{
  success: boolean;
  heroId: string;
  unlockedHeroIds: string[];
  inventory: { gold: number; dust: number };
  error?: string;
}> {
  // Normalize legacy hero IDs to canonical versions
  const normalizedHeroId = normalizeHeroId(heroId);

  // Validate hero exists
  const hero = getHeroById(normalizedHeroId);
  if (!hero) {
    return {
      success: false,
      heroId: normalizedHeroId,
      unlockedHeroIds: [],
      inventory: { gold: 0, dust: 0 },
      error: 'Hero not found',
    };
  }

  // Get user inventory
  const inventory = await prisma.inventory.findUnique({
    where: { userId },
  });

  if (!inventory) {
    return {
      success: false,
      heroId: normalizedHeroId,
      unlockedHeroIds: [],
      inventory: { gold: 0, dust: 0 },
      error: 'Inventory not found',
    };
  }

  // Check if already unlocked (check both legacy and canonical IDs)
  const currentUnlocked = inventory.unlockedHeroIds || [];
  if (currentUnlocked.includes(normalizedHeroId)) {
    return {
      success: false,
      heroId: normalizedHeroId,
      unlockedHeroIds: currentUnlocked,
      inventory: { gold: inventory.gold, dust: inventory.dust },
      error: 'Hero already unlocked',
    };
  }

  // Check if it's a free starter hero
  const isStarterHero = (FREE_STARTER_HEROES as readonly string[]).includes(normalizedHeroId);

  // Get unlock cost based on rarity
  const cost = HERO_UNLOCK_COSTS[hero.rarity as HeroRarity] || { gold: 0, dust: 0 };

  // If not a starter, check if user can afford
  if (!isStarterHero) {
    if (inventory.gold < cost.gold || inventory.dust < cost.dust) {
      return {
        success: false,
        heroId: normalizedHeroId,
        unlockedHeroIds: currentUnlocked,
        inventory: { gold: inventory.gold, dust: inventory.dust },
        error: 'Not enough resources',
      };
    }
  }

  // Deduct cost and add hero to unlocked list (always store canonical ID)
  const newUnlockedHeroIds = [...currentUnlocked, normalizedHeroId];
  const updatedInventory = await prisma.inventory.update({
    where: { userId },
    data: {
      gold: isStarterHero ? inventory.gold : inventory.gold - cost.gold,
      dust: isStarterHero ? inventory.dust : inventory.dust - cost.dust,
      unlockedHeroIds: newUnlockedHeroIds,
    },
  });

  return {
    success: true,
    heroId: normalizedHeroId,
    unlockedHeroIds: updatedInventory.unlockedHeroIds,
    inventory: {
      gold: updatedInventory.gold,
      dust: updatedInventory.dust,
    },
  };
}

/**
 * Unlock a turret for the user
 */
export async function unlockTurret(
  userId: string,
  turretType: string
): Promise<{
  success: boolean;
  turretType: string;
  unlockedTurretIds: string[];
  inventory: { gold: number; dust: number };
  error?: string;
}> {
  // Get user inventory
  const inventory = await prisma.inventory.findUnique({
    where: { userId },
  });

  if (!inventory) {
    return {
      success: false,
      turretType,
      unlockedTurretIds: [],
      inventory: { gold: 0, dust: 0 },
      error: 'Inventory not found',
    };
  }

  // Check if already unlocked
  const currentUnlocked = inventory.unlockedTurretIds || [];
  if (currentUnlocked.includes(turretType)) {
    return {
      success: false,
      turretType,
      unlockedTurretIds: currentUnlocked,
      inventory: { gold: inventory.gold, dust: inventory.dust },
      error: 'Turret already unlocked',
    };
  }

  // Check if it's a free starter turret
  const isStarterTurret = (FREE_STARTER_TURRETS as readonly string[]).includes(turretType);

  const cost = isStarterTurret ? { gold: 0, dust: 0 } : TURRET_UNLOCK_COST;

  // If not a starter, check if user can afford
  if (!isStarterTurret) {
    if (inventory.gold < cost.gold || inventory.dust < cost.dust) {
      return {
        success: false,
        turretType,
        unlockedTurretIds: currentUnlocked,
        inventory: { gold: inventory.gold, dust: inventory.dust },
        error: 'Not enough resources',
      };
    }
  }

  // Deduct cost and add turret to unlocked list
  const newUnlockedTurretIds = [...currentUnlocked, turretType];
  const updatedInventory = await prisma.inventory.update({
    where: { userId },
    data: {
      gold: isStarterTurret ? inventory.gold : inventory.gold - cost.gold,
      dust: isStarterTurret ? inventory.dust : inventory.dust - cost.dust,
      unlockedTurretIds: newUnlockedTurretIds,
    },
  });

  return {
    success: true,
    turretType,
    unlockedTurretIds: updatedInventory.unlockedTurretIds,
    inventory: {
      gold: updatedInventory.gold,
      dust: updatedInventory.dust,
    },
  };
}

/**
 * Get unlocked heroes for a user (includes free starters)
 */
export async function getUnlockedHeroes(userId: string): Promise<string[]> {
  const inventory = await prisma.inventory.findUnique({
    where: { userId },
    select: { unlockedHeroIds: true },
  });

  const unlocked = inventory?.unlockedHeroIds || [];

  // Always include free starter heroes
  const allUnlocked = new Set([...unlocked, ...FREE_STARTER_HEROES]);
  return Array.from(allUnlocked);
}

/**
 * Get unlocked turrets for a user (includes free starters)
 */
export async function getUnlockedTurrets(userId: string): Promise<string[]> {
  const inventory = await prisma.inventory.findUnique({
    where: { userId },
    select: { unlockedTurretIds: true },
  });

  const unlocked = inventory?.unlockedTurretIds || [];

  // Always include free starter turrets
  const allUnlocked = new Set([...unlocked, ...FREE_STARTER_TURRETS]);
  return Array.from(allUnlocked);
}
