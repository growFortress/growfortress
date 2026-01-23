import { z } from 'zod';
import { FortressClassSchema, InventorySchema } from './auth.js';
import { PillarIdSchema } from './pillar-challenge.js';
import { CheckpointSchema } from './events.js';

// Session start request
export const SessionStartRequestSchema = z.object({
  fortressClass: FortressClassSchema.optional(),
  startingHeroes: z.array(z.string()).optional(),
  startingTurrets: z.array(z.string()).optional(),
  pillarId: PillarIdSchema.optional(),
});

export type SessionStartRequest = z.infer<typeof SessionStartRequestSchema>;

// Session end request
export const SessionEndRequestSchema = z.object({
  reason: z.string().optional().default('manual'),
  partialRewards: z.object({
    gold: z.number().int().min(0),
    dust: z.number().int().min(0),
    xp: z.number().int().min(0),
    finalWave: z.number().int().min(0),
  }).optional(),
});

export type SessionEndRequest = z.infer<typeof SessionEndRequestSchema>;

// Update default loadout request (aligned with actual implementation)
export const UpdateLoadoutRequestSchema = z.object({
  fortressClass: FortressClassSchema.optional(),
  heroId: z.string().optional(),
  turretType: z.string().optional(),
});

export type UpdateLoadoutRequest = z.infer<typeof UpdateLoadoutRequestSchema>;

// Progression bonuses for session start (unified system)
export const ProgressionBonusesSchema = z.object({
  damageMultiplier: z.number(),
  goldMultiplier: z.number(),
  startingGold: z.number(),
  maxHeroSlots: z.number().int().min(1).max(6),
  maxTurretSlots: z.number().int().min(1).max(6),
});

export type ProgressionBonuses = z.infer<typeof ProgressionBonusesSchema>;

// Stat upgrades schema for power data
const StatUpgradesSchema = z.object({
  hp: z.number().int().min(0),
  damage: z.number().int().min(0),
  attackSpeed: z.number().int().min(0),
  range: z.number().int().min(0),
  critChance: z.number().int().min(0),
  critMultiplier: z.number().int().min(0),
  armor: z.number().int().min(0),
  dodge: z.number().int().min(0),
});

// Power data schema for session start
export const PowerDataSchema = z.object({
  fortressUpgrades: z.object({
    statUpgrades: StatUpgradesSchema,
  }),
  heroUpgrades: z.array(z.object({
    heroId: z.string(),
    statUpgrades: StatUpgradesSchema,
  })),
  turretUpgrades: z.array(z.object({
    turretType: z.string(),
    statUpgrades: StatUpgradesSchema,
  })),
  itemTiers: z.array(z.object({
    itemId: z.string(),
    tier: z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary']),
  })),
  // Hero tier progression (1-3)
  heroTiers: z.record(z.string(), z.number().int().min(1).max(3)),
  // Turret tier progression (1-3)
  turretTiers: z.record(z.string(), z.number().int().min(1).max(3)),
});

export type PowerData = z.infer<typeof PowerDataSchema>;

// Session start response
export const SessionStartResponseSchema = z.object({
  sessionId: z.string(),
  sessionToken: z.string(),
  seed: z.number(),
  simVersion: z.number(),
  tickHz: z.number(),
  startingWave: z.number(),
  segmentAuditTicks: z.array(z.number()),
  inventory: InventorySchema,
  commanderLevel: z.number().int().min(1),
  progressionBonuses: ProgressionBonusesSchema,
  // Remote config values that must match between client and server for determinism
  fortressBaseHp: z.number().int().min(1),
  fortressBaseDamage: z.number().int().min(1),
  waveIntervalTicks: z.number().int().min(1),
  // Power upgrades data for permanent stat bonuses
  powerData: PowerDataSchema,
  // Starting relics for first-run synergy showcase (optional)
  startingRelics: z.array(z.string()).optional(),
  // Pillar selection for this session
  currentPillar: PillarIdSchema,
  pillarRotation: z.boolean(),
});

export type SessionStartResponse = z.infer<typeof SessionStartResponseSchema>;

// Segment submit request
export const SegmentSubmitRequestSchema = z.object({
  sessionToken: z.string(),
  startWave: z.number().int().min(0),
  endWave: z.number().int().min(1),
  events: z.array(z.unknown()),
  checkpoints: z.array(CheckpointSchema),
  finalHash: z.number().int(),
});

export type SegmentSubmitRequest = z.infer<typeof SegmentSubmitRequestSchema>;

// Extended inventory schema for session responses (includes materials)
export const SessionInventorySchema = z.object({
  gold: z.number().int().min(0),
  dust: z.number().int().min(0),
  materials: z.record(z.string(), z.number().int().min(0)).optional(),
});

export type SessionInventory = z.infer<typeof SessionInventorySchema>;

// Segment submit response
export const SegmentSubmitResponseSchema = z.object({
  verified: z.boolean(),
  rejectReason: z.string().optional(),
  goldEarned: z.number(),
  dustEarned: z.number(),
  xpEarned: z.number(),
  materialsEarned: z.record(z.string(), z.number().int().min(0)).optional(),
  nextSegmentAuditTicks: z.array(z.number()),
  sessionToken: z.string().optional(), // New session token for continued gameplay
  newInventory: SessionInventorySchema,
  newProgression: z.object({
    level: z.number().int().min(1),
    xp: z.number().int().min(0),
    totalXp: z.number().int().min(0),
    xpToNextLevel: z.number().int().min(0),
  }),
});

export type SegmentSubmitResponse = z.infer<typeof SegmentSubmitResponseSchema>;

// Partial rewards for session end
export const PartialRewardsSchema = z.object({
  gold: z.number().int().min(0),
  dust: z.number().int().min(0),
  xp: z.number().int().min(0),
  finalWave: z.number().int().min(0),
});

export type PartialRewards = z.infer<typeof PartialRewardsSchema>;

// Session end response
export const SessionEndResponseSchema = z.object({
  finalWave: z.number().int(),
  totalGoldEarned: z.number(),
  totalDustEarned: z.number(),
  totalXpEarned: z.number(),
  newInventory: z.object({
    gold: z.number(),
    dust: z.number(),
  }),
  newProgression: z.object({
    level: z.number().int().min(1),
    xp: z.number().int().min(0),
    totalXp: z.number().int().min(0),
    xpToNextLevel: z.number().int().min(0),
  }),
});

export type SessionEndResponse = z.infer<typeof SessionEndResponseSchema>;

// Active session response (for resuming sessions)
export const ActiveSessionResponseSchema = z.object({
  sessionId: z.string(),
  currentWave: z.number().int().min(0),
  startedAt: z.string().datetime(),
});

export type ActiveSessionResponse = z.infer<typeof ActiveSessionResponseSchema>;
