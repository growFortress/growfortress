import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { GameEvent, Checkpoint } from '@arcade/protocol';
import type { GameState } from '@arcade/sim-core';
import type { GamePhase } from '../game/Game.js';

interface ArcadeDB extends DBSchema {
  pendingFinishes: {
    key: string;
    value: {
      runId: string;
      runToken: string;
      payload: unknown;
      createdAt: number;
      retryCount: number;
    };
    indexes: { 'by-created': number };
  };
  telemetryQueue: {
    key: string;
    value: {
      id: string;
      events: unknown[];
      createdAt: number;
    };
    indexes: { 'by-created': number };
  };
  localSettings: {
    key: string;
    value: unknown;
  };
}

const DB_NAME = 'arcade-td';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<ArcadeDB>> | null = null;

export async function getDB(): Promise<IDBPDatabase<ArcadeDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ArcadeDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Pending finishes store
        const pendingStore = db.createObjectStore('pendingFinishes', {
          keyPath: 'runId',
        });
        pendingStore.createIndex('by-created', 'createdAt');

        // Telemetry queue store
        const telemetryStore = db.createObjectStore('telemetryQueue', {
          keyPath: 'id',
        });
        telemetryStore.createIndex('by-created', 'createdAt');

        // Local settings store
        db.createObjectStore('localSettings');
      },
    });
  }
  return dbPromise;
}

// Pending finishes
export async function savePendingFinish(
  runId: string,
  runToken: string,
  payload: unknown
): Promise<void> {
  const db = await getDB();
  await db.put('pendingFinishes', {
    runId,
    runToken,
    payload,
    createdAt: Date.now(),
    retryCount: 0,
  });
}

export async function getPendingFinishes(): Promise<Array<{
  runId: string;
  runToken: string;
  payload: unknown;
  createdAt: number;
  retryCount: number;
}>> {
  const db = await getDB();
  return db.getAllFromIndex('pendingFinishes', 'by-created');
}

export async function deletePendingFinish(runId: string): Promise<void> {
  const db = await getDB();
  await db.delete('pendingFinishes', runId);
}

export async function updatePendingFinishRetry(
  runId: string,
  retryCount: number
): Promise<void> {
  const db = await getDB();
  const item = await db.get('pendingFinishes', runId);
  if (item) {
    item.retryCount = retryCount;
    await db.put('pendingFinishes', item);
  }
}

// Telemetry
export async function queueTelemetry(events: unknown[]): Promise<void> {
  const db = await getDB();
  await db.put('telemetryQueue', {
    id: crypto.randomUUID(),
    events,
    createdAt: Date.now(),
  });
}

export async function getTelemetryQueue(): Promise<Array<{
  id: string;
  events: unknown[];
  createdAt: number;
}>> {
  const db = await getDB();
  return db.getAllFromIndex('telemetryQueue', 'by-created');
}

export async function deleteTelemetryBatch(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('telemetryQueue', id);
}

// Settings
export async function getSetting<T>(key: string): Promise<T | undefined> {
  const db = await getDB();
  return db.get('localSettings', key) as Promise<T | undefined>;
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  const db = await getDB();
  await db.put('localSettings', value, key);
}

// Active Session Persistence (for page refresh recovery)
export interface ActiveSessionSnapshot {
  userId?: string;
  sessionId: string;
  sessionToken: string;
  seed: number;
  simVersion: number;
  tickHz: number;
  startingWave: number;
  commanderLevel: number;
  progressionBonuses: {
    damageMultiplier: number;
    goldMultiplier: number;
    startingGold: number;
    maxHeroSlots: number;
    maxTurretSlots: number;
  };
  inventory?: { gold: number; dust: number };
  segmentAuditTicks: number[];
  fortressClass: string;
  startingHeroes: string[];
  startingTurrets: string[];
  // Remote config values for simulation determinism
  fortressBaseHp: number;
  fortressBaseDamage: number;
  waveIntervalTicks: number;
  // Power upgrades data for permanent stat bonuses
  powerData?: {
    fortressUpgrades: {
      statUpgrades: {
        hp: number;
        damage: number;
        attackSpeed: number;
        range: number;
        critChance: number;
        critMultiplier: number;
        armor: number;
        dodge: number;
      };
    };
    heroUpgrades: Array<{
      heroId: string;
      statUpgrades: {
        hp: number;
        damage: number;
        attackSpeed: number;
        range: number;
        critChance: number;
        critMultiplier: number;
        armor: number;
        dodge: number;
      };
    }>;
    turretUpgrades: Array<{
      turretType: string;
      statUpgrades: {
        hp: number;
        damage: number;
        attackSpeed: number;
        range: number;
        critChance: number;
        critMultiplier: number;
        armor: number;
        dodge: number;
      };
    }>;
    itemTiers: Array<{
      itemId: string;
      tier: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
    }>;
    // Hero tier progression (1-3)
    heroTiers: Record<string, number>;
    // Turret tier progression (1-3)
    turretTiers: Record<string, number>;
  };
  simulationState?: GameState;
  events?: GameEvent[];
  checkpoints?: Checkpoint[];
  lastChainHash?: number;
  lastCheckpointTick?: number;
  pendingSegmentSubmit?: boolean;
  phase?: GamePhase;
  lastSnapshotTick?: number;
  savedAt: number;
}

const ACTIVE_SESSION_KEY = 'activeSession';
const SESSION_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

export async function saveActiveSession(snapshot: ActiveSessionSnapshot): Promise<void> {
  await setSetting(ACTIVE_SESSION_KEY, {
    ...snapshot,
    savedAt: Date.now(),
  });
}

export async function getActiveSession(
  userId?: string | null,
): Promise<ActiveSessionSnapshot | null> {
  const snapshot = await getSetting<ActiveSessionSnapshot>(ACTIVE_SESSION_KEY);
  if (!snapshot) return null;

  // Check if session expired
  if (Date.now() - snapshot.savedAt > SESSION_EXPIRY_MS) {
    await clearActiveSession();
    return null;
  }

  if (!snapshot.simulationState) {
    await clearActiveSession();
    return null;
  }

  if (userId && snapshot.userId && snapshot.userId !== userId) {
    await clearActiveSession();
    return null;
  }

  return snapshot;
}

export async function clearActiveSession(): Promise<void> {
  const db = await getDB();
  await db.delete('localSettings', ACTIVE_SESSION_KEY);
}
