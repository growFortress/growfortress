/**
 * Slot Purchase Service
 *
 * Handles purchasing hero and turret slots with gold.
 */

import { prisma } from '../lib/prisma.js';
import {
  HERO_SLOT_UNLOCKS,
  TURRET_SLOT_UNLOCKS,
  MAX_HERO_SLOTS,
  MAX_TURRET_SLOTS,
  getNextHeroSlotInfo,
  getNextTurretSlotInfo,
} from '@arcade/sim-core';
import type { PurchaseHeroSlotResponse, PurchaseTurretSlotResponse, SlotStatus } from '@arcade/protocol';

/**
 * Purchase the next available hero slot
 */
export async function purchaseHeroSlot(userId: string): Promise<PurchaseHeroSlotResponse> {
  // Get user data
  const [progression, inventory] = await Promise.all([
    prisma.progression.findUnique({ where: { userId } }),
    prisma.inventory.findUnique({ where: { userId } }),
  ]);

  if (!progression || !inventory) {
    return {
      success: false,
      error: 'User data not found',
    };
  }

  const currentSlots = progression.purchasedHeroSlots;
  const currentGold = inventory.gold;
  const currentLevel = progression.level;

  // Check if already at max
  if (currentSlots >= MAX_HERO_SLOTS) {
    return {
      success: false,
      error: 'Osiągnięto maksymalną liczbę slotów bohaterów',
    };
  }

  // Get next slot config
  const nextSlot = HERO_SLOT_UNLOCKS[currentSlots];
  if (!nextSlot) {
    return {
      success: false,
      error: 'Brak dostępnych slotów do kupienia',
    };
  }

  // Check level requirement
  if (currentLevel < nextSlot.levelRequired) {
    return {
      success: false,
      error: `Wymagany poziom ${nextSlot.levelRequired}`,
    };
  }

  // Check gold requirement
  if (currentGold < nextSlot.goldCost) {
    return {
      success: false,
      error: `Niewystarczająca ilość złota (potrzeba ${nextSlot.goldCost})`,
    };
  }

  // Purchase the slot
  const [updatedProgression, updatedInventory] = await prisma.$transaction([
    prisma.progression.update({
      where: { userId },
      data: {
        purchasedHeroSlots: currentSlots + 1,
        version: { increment: 1 },
      },
    }),
    prisma.inventory.update({
      where: { userId },
      data: {
        gold: currentGold - nextSlot.goldCost,
      },
    }),
  ]);

  return {
    success: true,
    newSlotCount: updatedProgression.purchasedHeroSlots,
    goldSpent: nextSlot.goldCost,
    newGold: updatedInventory.gold,
  };
}

/**
 * Purchase the next available turret slot
 */
export async function purchaseTurretSlot(userId: string): Promise<PurchaseTurretSlotResponse> {
  // Get user data
  const [progression, inventory] = await Promise.all([
    prisma.progression.findUnique({ where: { userId } }),
    prisma.inventory.findUnique({ where: { userId } }),
  ]);

  if (!progression || !inventory) {
    return {
      success: false,
      error: 'User data not found',
    };
  }

  const currentSlots = progression.purchasedTurretSlots;
  const currentGold = inventory.gold;
  const currentLevel = progression.level;

  // Check if already at max
  if (currentSlots >= MAX_TURRET_SLOTS) {
    return {
      success: false,
      error: 'Osiągnięto maksymalną liczbę slotów wieżyczek',
    };
  }

  // Get next slot config
  const nextSlot = TURRET_SLOT_UNLOCKS[currentSlots];
  if (!nextSlot) {
    return {
      success: false,
      error: 'Brak dostępnych slotów do kupienia',
    };
  }

  // Check level requirement
  if (currentLevel < nextSlot.levelRequired) {
    return {
      success: false,
      error: `Wymagany poziom ${nextSlot.levelRequired}`,
    };
  }

  // Check gold requirement
  if (currentGold < nextSlot.goldCost) {
    return {
      success: false,
      error: `Niewystarczająca ilość złota (potrzeba ${nextSlot.goldCost})`,
    };
  }

  // Purchase the slot
  const [updatedProgression, updatedInventory] = await prisma.$transaction([
    prisma.progression.update({
      where: { userId },
      data: {
        purchasedTurretSlots: currentSlots + 1,
        version: { increment: 1 },
      },
    }),
    prisma.inventory.update({
      where: { userId },
      data: {
        gold: currentGold - nextSlot.goldCost,
      },
    }),
  ]);

  return {
    success: true,
    newSlotCount: updatedProgression.purchasedTurretSlots,
    goldSpent: nextSlot.goldCost,
    newGold: updatedInventory.gold,
  };
}

/**
 * Get current slot status for a user
 */
export async function getSlotStatus(userId: string): Promise<SlotStatus | null> {
  const [progression, inventory] = await Promise.all([
    prisma.progression.findUnique({ where: { userId } }),
    prisma.inventory.findUnique({ where: { userId } }),
  ]);

  if (!progression || !inventory) {
    return null;
  }

  const heroSlotInfo = getNextHeroSlotInfo(
    progression.purchasedHeroSlots,
    progression.level,
    inventory.gold
  );

  const turretSlotInfo = getNextTurretSlotInfo(
    progression.purchasedTurretSlots,
    progression.level,
    inventory.gold
  );

  return {
    currentHeroSlots: progression.purchasedHeroSlots,
    currentTurretSlots: progression.purchasedTurretSlots,
    nextHeroSlot: heroSlotInfo
      ? {
          slot: heroSlotInfo.slot.slot,
          levelRequired: heroSlotInfo.slot.levelRequired,
          goldCost: heroSlotInfo.slot.goldCost,
          canPurchase: heroSlotInfo.canPurchase,
          reason: heroSlotInfo.reason as 'level_too_low' | 'insufficient_gold' | 'max_slots' | 'already_free' | undefined,
        }
      : null,
    nextTurretSlot: turretSlotInfo
      ? {
          slot: turretSlotInfo.slot.slot,
          levelRequired: turretSlotInfo.slot.levelRequired,
          goldCost: turretSlotInfo.slot.goldCost,
          canPurchase: turretSlotInfo.canPurchase,
          reason: turretSlotInfo.reason as 'level_too_low' | 'insufficient_gold' | 'max_slots' | 'already_free' | undefined,
        }
      : null,
  };
}
