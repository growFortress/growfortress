import { prisma } from '../lib/prisma.js';
import {
  ENERGY_CONFIG,
  ENERGY_ERROR_CODES,
  type EnergyStatus,
  type RefillEnergyResponse,
} from '@arcade/protocol';

/**
 * Get user's current energy status with regeneration calculated
 */
export async function getEnergyStatus(userId: string): Promise<EnergyStatus> {
  let energy = await prisma.userEnergy.findUnique({
    where: { userId },
  });

  // Initialize energy record if doesn't exist
  if (!energy) {
    energy = await prisma.userEnergy.create({
      data: {
        userId,
        currentEnergy: ENERGY_CONFIG.MAX_ENERGY,
        maxEnergy: ENERGY_CONFIG.MAX_ENERGY,
        lastRegenAt: new Date(),
      },
    });
  }

  // Calculate passive regeneration since last update
  const now = new Date();
  const elapsedMs = now.getTime() - energy.lastRegenAt.getTime();
  const elapsedMinutes = elapsedMs / (1000 * 60);
  const regenAmount = Math.floor(elapsedMinutes / ENERGY_CONFIG.REGEN_RATE_MINUTES);

  let currentEnergy = Math.min(
    energy.currentEnergy + regenAmount,
    energy.maxEnergy
  );

  // Update database if regeneration occurred
  if (regenAmount > 0 && energy.currentEnergy < energy.maxEnergy) {
    const newLastRegen = new Date(
      energy.lastRegenAt.getTime() +
        regenAmount * ENERGY_CONFIG.REGEN_RATE_MINUTES * 60 * 1000
    );

    await prisma.userEnergy.update({
      where: { userId },
      data: {
        currentEnergy,
        lastRegenAt: newLastRegen,
      },
    });
  }

  // Calculate next regeneration time
  const nextRegenAt =
    currentEnergy < energy.maxEnergy
      ? new Date(
          energy.lastRegenAt.getTime() +
            (regenAmount + 1) * ENERGY_CONFIG.REGEN_RATE_MINUTES * 60 * 1000
        )
      : null;

  // Calculate time to full regeneration
  const missingEnergy = energy.maxEnergy - currentEnergy;
  const timeToFullRegen = missingEnergy * ENERGY_CONFIG.REGEN_RATE_MINUTES * 60; // seconds

  return {
    currentEnergy,
    maxEnergy: energy.maxEnergy,
    nextRegenAt: nextRegenAt?.toISOString() ?? null,
    timeToFullRegen,
    canPlay: currentEnergy >= ENERGY_CONFIG.ENERGY_PER_WAVE,
  };
}

/**
 * Consume energy for starting a wave/run
 * Returns true if energy was successfully consumed, false if insufficient
 */
export async function consumeEnergy(
  userId: string,
  amount: number = ENERGY_CONFIG.ENERGY_PER_WAVE
): Promise<boolean> {
  const status = await getEnergyStatus(userId);

  if (status.currentEnergy < amount) {
    return false;
  }

  await prisma.userEnergy.update({
    where: { userId },
    data: {
      currentEnergy: { decrement: amount },
    },
  });

  return true;
}

/**
 * Refill energy to maximum using dust
 */
export async function refillEnergy(userId: string): Promise<RefillEnergyResponse> {
  // Get current inventory and energy
  const [inventory, energyStatus] = await Promise.all([
    prisma.inventory.findUnique({ where: { userId } }),
    getEnergyStatus(userId),
  ]);

  if (!inventory) {
    return {
      success: false,
      error: 'User not found',
    };
  }

  // Check if already at max energy
  if (energyStatus.currentEnergy >= energyStatus.maxEnergy) {
    return {
      success: false,
      error: ENERGY_ERROR_CODES.ENERGY_FULL,
    };
  }

  // Check if user has enough dust
  if (inventory.dust < ENERGY_CONFIG.REFILL_DUST_COST) {
    return {
      success: false,
      error: ENERGY_ERROR_CODES.INSUFFICIENT_DUST,
    };
  }

  // Transaction: deduct dust and refill energy
  const result = await prisma.$transaction(async (tx) => {
    const updatedInventory = await tx.inventory.update({
      where: { userId },
      data: { dust: { decrement: ENERGY_CONFIG.REFILL_DUST_COST } },
    });

    const updatedEnergy = await tx.userEnergy.update({
      where: { userId },
      data: {
        currentEnergy: ENERGY_CONFIG.MAX_ENERGY,
        lastRegenAt: new Date(),
      },
    });

    return { updatedInventory, updatedEnergy };
  });

  return {
    success: true,
    newEnergy: result.updatedEnergy.currentEnergy,
    dustSpent: ENERGY_CONFIG.REFILL_DUST_COST,
    newDust: result.updatedInventory.dust,
  };
}

/**
 * Add energy to user (for purchases, rewards, etc.)
 * Does not exceed max energy
 */
export async function addEnergy(userId: string, amount: number): Promise<number> {
  const status = await getEnergyStatus(userId);
  const newEnergy = Math.min(status.currentEnergy + amount, status.maxEnergy);

  await prisma.userEnergy.update({
    where: { userId },
    data: {
      currentEnergy: newEnergy,
      lastRegenAt: new Date(),
    },
  });

  return newEnergy;
}
