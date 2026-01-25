/**
 * Expedition Service
 *
 * Handles offline wave progress (expedition mode).
 * Players can send their loadout on an "expedition" which clears waves
 * automatically while offline, earning reduced rewards.
 */

import { prisma } from '../lib/prisma.js';
import type { ExpeditionProgress, Prisma } from '@prisma/client';

// Base rates for expedition rewards (multiplied by wave count)
const BASE_GOLD_PER_WAVE = 100;
const BASE_DUST_PER_WAVE = 2;
const BASE_XP_PER_WAVE = 50;

// Multipliers compared to active gameplay (40% of active rewards)
const REWARD_MULTIPLIER = 0.4;

// Maximum hours of offline progress
const MAX_OFFLINE_HOURS = 8;

// Base waves per hour (modified by power level)
const BASE_WAVES_PER_HOUR = 10;

export interface ExpeditionStatus {
  isActive: boolean;
  startedAt: string | null;
  hoursElapsed: number;
  wavesCleared: number;
  maxWavesPerHour: number;
  pendingRewards: {
    gold: number;
    dust: number;
    xp: number;
    materials: Record<string, number>;
  };
  maxOfflineHours: number;
  canClaim: boolean;
}

export interface ExpeditionRewards {
  gold: number;
  dust: number;
  xp: number;
  materials: Record<string, number>;
  wavesCleared: number;
}

export interface LoadoutSnapshot {
  heroIds: string[];
  turretIds: string[];
  fortressClass: string;
  artifactIds: string[];
}

/**
 * Calculate waves per hour based on player power
 * Formula: baseRate * sqrt(power / 1000)
 * Capped at highest verified wave * 0.5
 */
function calculateWavesPerHour(power: number, highestWave: number): number {
  const baseRate = BASE_WAVES_PER_HOUR * Math.sqrt(Math.max(1, power) / 1000);
  const cap = Math.max(5, Math.floor(highestWave * 0.5));
  return Math.min(Math.ceil(baseRate), cap);
}

/**
 * Calculate rewards for cleared waves
 */
function calculateRewards(wavesCleared: number): ExpeditionRewards {
  const gold = Math.floor(wavesCleared * BASE_GOLD_PER_WAVE * REWARD_MULTIPLIER);
  const dust = Math.floor(wavesCleared * BASE_DUST_PER_WAVE * REWARD_MULTIPLIER);
  const xp = Math.floor(wavesCleared * BASE_XP_PER_WAVE * REWARD_MULTIPLIER);

  // Materials: 5% chance per wave to get a random material
  const materials: Record<string, number> = {};
  const materialChance = 0.05;
  const materialTypes = ['iron_ore', 'crystal_shard', 'magic_essence', 'tech_component'];

  for (let i = 0; i < wavesCleared; i++) {
    if (Math.random() < materialChance) {
      const material = materialTypes[Math.floor(Math.random() * materialTypes.length)];
      materials[material] = (materials[material] || 0) + 1;
    }
  }

  return { gold, dust, xp, materials, wavesCleared };
}

/**
 * Process accumulated expedition progress
 * Called when checking status or claiming rewards
 */
async function processExpeditionProgress(expedition: ExpeditionProgress): Promise<ExpeditionProgress> {
  if (!expedition.isActive || !expedition.startedAt) {
    return expedition;
  }

  const now = new Date();
  const lastProcessed = expedition.lastProcessedAt || expedition.startedAt;
  const hoursElapsed = (now.getTime() - lastProcessed.getTime()) / (1000 * 60 * 60);

  if (hoursElapsed < 0.1) {
    // Less than 6 minutes since last process, skip
    return expedition;
  }

  // Cap at max offline hours
  const totalHoursSinceStart = (now.getTime() - expedition.startedAt.getTime()) / (1000 * 60 * 60);
  if (totalHoursSinceStart >= expedition.maxOfflineHours) {
    // Expedition has reached max time, deactivate
    const effectiveHours = Math.min(hoursElapsed, expedition.maxOfflineHours);
    const newWaves = Math.floor(effectiveHours * expedition.maxWavesPerHour);
    const rewards = calculateRewards(newWaves);

    return await prisma.expeditionProgress.update({
      where: { id: expedition.id },
      data: {
        isActive: false,
        lastProcessedAt: now,
        wavesCleared: expedition.wavesCleared + rewards.wavesCleared,
        pendingGold: expedition.pendingGold + rewards.gold,
        pendingDust: expedition.pendingDust + rewards.dust,
        pendingXp: expedition.pendingXp + rewards.xp,
        pendingMaterials: mergeMaterials(
          expedition.pendingMaterials as Record<string, number> || {},
          rewards.materials
        ),
      },
    });
  }

  // Calculate new waves since last process
  const newWaves = Math.floor(hoursElapsed * expedition.maxWavesPerHour);
  if (newWaves === 0) {
    return expedition;
  }

  const rewards = calculateRewards(newWaves);

  return await prisma.expeditionProgress.update({
    where: { id: expedition.id },
    data: {
      lastProcessedAt: now,
      wavesCleared: expedition.wavesCleared + rewards.wavesCleared,
      pendingGold: expedition.pendingGold + rewards.gold,
      pendingDust: expedition.pendingDust + rewards.dust,
      pendingXp: expedition.pendingXp + rewards.xp,
      pendingMaterials: mergeMaterials(
        expedition.pendingMaterials as Record<string, number> || {},
        rewards.materials
      ),
    },
  });
}

function mergeMaterials(
  existing: Record<string, number>,
  incoming: Record<string, number>
): Record<string, number> {
  const merged = { ...existing };
  for (const [key, value] of Object.entries(incoming)) {
    merged[key] = (merged[key] || 0) + value;
  }
  return merged;
}

/**
 * Get or create expedition progress for a user
 */
export async function getOrCreateExpedition(userId: string): Promise<ExpeditionProgress> {
  let expedition = await prisma.expeditionProgress.findUnique({
    where: { userId },
  });

  if (!expedition) {
    expedition = await prisma.expeditionProgress.create({
      data: {
        userId,
        isActive: false,
        maxWavesPerHour: BASE_WAVES_PER_HOUR,
        maxOfflineHours: MAX_OFFLINE_HOURS,
      },
    });
  }

  return expedition;
}

/**
 * Get expedition status (processes pending progress first)
 */
export async function getExpeditionStatus(userId: string): Promise<ExpeditionStatus> {
  let expedition = await getOrCreateExpedition(userId);

  // Process any accumulated progress
  expedition = await processExpeditionProgress(expedition);

  const hoursElapsed = expedition.isActive && expedition.startedAt
    ? (Date.now() - expedition.startedAt.getTime()) / (1000 * 60 * 60)
    : 0;

  return {
    isActive: expedition.isActive,
    startedAt: expedition.startedAt?.toISOString() || null,
    hoursElapsed: Math.min(hoursElapsed, expedition.maxOfflineHours),
    wavesCleared: expedition.wavesCleared,
    maxWavesPerHour: expedition.maxWavesPerHour,
    pendingRewards: {
      gold: expedition.pendingGold,
      dust: expedition.pendingDust,
      xp: expedition.pendingXp,
      materials: expedition.pendingMaterials as Record<string, number> || {},
    },
    maxOfflineHours: expedition.maxOfflineHours,
    canClaim: expedition.pendingGold > 0 || expedition.pendingDust > 0 ||
              expedition.pendingXp > 0 || Object.keys(expedition.pendingMaterials as object || {}).length > 0,
  };
}

/**
 * Start an expedition
 */
export async function startExpedition(
  userId: string,
  loadout: LoadoutSnapshot,
  power: number,
  highestWave: number
): Promise<ExpeditionStatus> {
  const wavesPerHour = calculateWavesPerHour(power, highestWave);

  // Cast loadout to Prisma JSON-compatible type
  const loadoutJson = loadout as unknown as Prisma.InputJsonValue;

  await prisma.expeditionProgress.upsert({
    where: { userId },
    create: {
      userId,
      isActive: true,
      startedAt: new Date(),
      lastProcessedAt: new Date(),
      loadoutSnapshot: loadoutJson,
      powerSnapshot: power,
      maxWavesPerHour: wavesPerHour,
      maxOfflineHours: MAX_OFFLINE_HOURS,
      wavesCleared: 0,
      pendingGold: 0,
      pendingDust: 0,
      pendingXp: 0,
      pendingMaterials: {},
    },
    update: {
      isActive: true,
      startedAt: new Date(),
      lastProcessedAt: new Date(),
      loadoutSnapshot: loadoutJson,
      powerSnapshot: power,
      maxWavesPerHour: wavesPerHour,
      wavesCleared: 0,
      pendingGold: 0,
      pendingDust: 0,
      pendingXp: 0,
      pendingMaterials: {},
    },
  });

  return getExpeditionStatus(userId);
}

/**
 * Claim expedition rewards
 */
export async function claimExpeditionRewards(userId: string): Promise<ExpeditionRewards> {
  let expedition = await getOrCreateExpedition(userId);

  // Process any remaining progress before claiming
  expedition = await processExpeditionProgress(expedition);

  const rewards: ExpeditionRewards = {
    gold: expedition.pendingGold,
    dust: expedition.pendingDust,
    xp: expedition.pendingXp,
    materials: expedition.pendingMaterials as Record<string, number> || {},
    wavesCleared: expedition.wavesCleared,
  };

  if (rewards.gold === 0 && rewards.dust === 0 && rewards.xp === 0 &&
      Object.keys(rewards.materials).length === 0) {
    return rewards; // Nothing to claim
  }

  // Award rewards to player
  await prisma.$transaction(async (tx) => {
    // Update inventory
    await tx.inventory.update({
      where: { userId },
      data: {
        gold: { increment: rewards.gold },
        dust: { increment: rewards.dust },
      },
    });

    // Update progression XP
    await tx.progression.update({
      where: { userId },
      data: {
        xp: { increment: rewards.xp },
      },
    });

    // Clear expedition pending rewards
    await tx.expeditionProgress.update({
      where: { userId },
      data: {
        isActive: false,
        wavesCleared: 0,
        pendingGold: 0,
        pendingDust: 0,
        pendingXp: 0,
        pendingMaterials: {},
        startedAt: null,
        lastProcessedAt: null,
      },
    });
  });

  return rewards;
}

/**
 * Cancel an active expedition (no rewards)
 */
export async function cancelExpedition(userId: string): Promise<void> {
  await prisma.expeditionProgress.updateMany({
    where: { userId, isActive: true },
    data: {
      isActive: false,
      wavesCleared: 0,
      pendingGold: 0,
      pendingDust: 0,
      pendingXp: 0,
      pendingMaterials: {},
      startedAt: null,
      lastProcessedAt: null,
    },
  });
}
