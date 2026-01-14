import type { Checkpoint } from '@arcade/protocol';
import type { GameState, SkillEffect } from './types.js';

/**
 * FNV-1a 32-bit hash
 * Deterministic hash function for checkpoint computation
 */
export function fnv1a32(data: number[]): number {
  let hash = 0x811c9dc5; // FNV offset basis

  for (const byte of data) {
    hash ^= byte & 0xFF;
    hash = Math.imul(hash, 0x01000193); // FNV prime
    hash >>>= 0; // Keep as unsigned 32-bit
  }

  return hash >>> 0;
}

/**
 * Convert number to bytes (little-endian)
 */
function numberToBytes(n: number, byteCount: number): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < byteCount; i++) {
    bytes.push((n >>> (i * 8)) & 0xFF);
  }
  return bytes;
}

function appendNumber(data: number[], value: number, byteCount = 4): void {
  data.push(...numberToBytes(value, byteCount));
}

const FIXED_SCALE = 65536;

function toFixed(value: number): number {
  return Math.round(value * FIXED_SCALE);
}

function appendBool(data: number[], value: boolean): void {
  data.push(value ? 1 : 0);
}

function appendString(data: number[], value: string): void {
  appendNumber(data, value.length);
  for (let i = 0; i < value.length; i++) {
    data.push(value.charCodeAt(i) & 0xFF);
  }
}

function appendStringArray(data: number[], values: string[]): void {
  appendNumber(data, values.length);
  for (const value of values) {
    appendString(data, value);
  }
}

function appendStringRecord(data: number[], record: Record<string, number>): void {
  const keys = Object.keys(record).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  appendNumber(data, keys.length);
  for (const key of keys) {
    appendString(data, key);
    appendNumber(data, record[key] ?? 0);
  }
}

function appendOptionalString(data: number[], value: string | undefined): void {
  appendBool(data, value !== undefined);
  if (value !== undefined) {
    appendString(data, value);
  }
}

function appendOptionalNumber(data: number[], value: number | undefined): void {
  appendBool(data, value !== undefined);
  if (value !== undefined) {
    appendNumber(data, value);
  }
}

function appendSkillEffects(data: number[], effects: SkillEffect[]): void {
  appendNumber(data, effects.length);
  for (const effect of effects) {
    appendString(data, effect.type);
    appendNumber(data, toFixed(effect.amount ?? 0));
    appendNumber(data, toFixed(effect.percent ?? 0));
    appendNumber(data, effect.duration ?? 0);
    appendString(data, effect.target ?? '');
    appendNumber(data, effect.damagePerTick ?? 0);
    appendNumber(data, effect.stacks ?? 0);
    appendString(data, effect.stat ? String(effect.stat) : '');
    appendString(data, effect.unitType ?? '');
    appendNumber(data, effect.count ?? 0);
    appendNumber(data, effect.damage ?? 0);
  }
}

function appendSourceId(data: number[], sourceId: number | string): void {
  const isNumber = typeof sourceId === 'number';
  appendBool(data, isNumber);
  if (isNumber) {
    appendNumber(data, sourceId as number);
  } else {
    appendString(data, sourceId as string);
  }
}

/**
 * Compute checkpoint hash from game state
 * Includes all determinism-critical state
 */
export function computeCheckpointHash(state: GameState): number {
  const data: number[] = [];

  // Core state
  appendNumber(data, state.tick);
  appendNumber(data, state.wave);
  appendBool(data, state.ended);
  appendBool(data, state.won);

  // Segment tracking
  appendNumber(data, state.segmentStartWave);
  appendNumber(data, state.segmentGoldEarned);
  appendNumber(data, state.segmentDustEarned);
  appendNumber(data, state.segmentXpEarned);
  appendStringRecord(data, state.segmentMaterialsEarned);
  appendOptionalNumber(data, state.deathWave);
  appendNumber(data, state.retryCount);

  // RNG state
  appendNumber(data, state.rngState);

  // Fortress
  appendNumber(data, state.fortressHp);
  appendNumber(data, state.fortressMaxHp);
  appendNumber(data, state.fortressLastAttackTick);
  appendString(data, state.fortressClass);
  appendNumber(data, state.commanderLevel);
  appendNumber(data, state.sessionXpEarned);
  appendNumber(data, state.xpAtSessionStart);

  // Enemies (sorted by ID for determinism)
  const sortedEnemies = [...state.enemies].sort((a, b) => a.id - b.id);
  appendNumber(data, sortedEnemies.length);
  for (const enemy of sortedEnemies) {
    appendNumber(data, enemy.id);
    appendString(data, enemy.type);
    appendNumber(data, enemy.hp);
    appendNumber(data, enemy.maxHp);
    appendNumber(data, enemy.x);
    appendNumber(data, enemy.y);
    appendNumber(data, enemy.vx);
    appendNumber(data, enemy.vy);
    appendNumber(data, enemy.speed);
    appendNumber(data, enemy.radius);
    appendNumber(data, enemy.mass);
    appendNumber(data, enemy.damage);
    appendBool(data, enemy.isElite);
    appendNumber(data, enemy.hitFlashTicks);
    appendNumber(data, enemy.lastAttackTick);
    appendNumber(data, enemy.lane);
    appendNumber(data, enemy.activeEffects.length);
    for (const effect of enemy.activeEffects) {
      appendString(data, effect.type);
      appendNumber(data, effect.remainingTicks);
      appendNumber(data, toFixed(effect.strength));
      appendNumber(data, effect.appliedTick);
    }
  }

  appendNumber(data, state.nextEnemyId);

  // Economy
  appendNumber(data, state.gold);
  appendNumber(data, state.dust);
  appendNumber(data, state.goldEarned);
  appendNumber(data, state.dustEarned);

  // Relics (sorted by ID)
  const sortedRelics = [...state.relics].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  );
  appendNumber(data, sortedRelics.length);
  for (const relic of sortedRelics) {
    appendString(data, relic.id);
    appendNumber(data, relic.acquiredWave);
    appendNumber(data, relic.acquiredTick);
  }

  // Skills and choices
  appendNumber(data, state.skillCooldown);
  appendNumber(data, state.lastSkillTick);
  appendStringArray(data, state.activeSkills);
  appendStringRecord(data, state.skillCooldowns);
  appendBool(data, state.inChoice);
  appendNumber(data, state.pendingChoiceTick);
  if (state.pendingChoice) {
    appendNumber(data, state.pendingChoice.wave);
    appendNumber(data, state.pendingChoice.offeredTick);
    appendStringArray(data, state.pendingChoice.options);
  } else {
    appendNumber(data, -1);
  }

  // Wave spawning state
  appendNumber(data, state.waveTotalEnemies);
  appendNumber(data, state.waveSpawnedEnemies);
  appendNumber(data, state.lastSpawnTick);
  appendBool(data, state.waveComplete);
  appendNumber(data, state.waveSpawnQueue.length);
  for (const entry of state.waveSpawnQueue) {
    appendString(data, entry.type);
    appendBool(data, entry.isElite);
    appendNumber(data, entry.spawnTick);
  }

  // Stats
  appendNumber(data, state.kills);
  appendNumber(data, state.wavesCleared);
  appendNumber(data, state.eliteKills);

  // Pillar
  appendString(data, state.currentPillar);

  // Heroes
  appendNumber(data, state.nextHeroId);
  appendNumber(data, state.heroSlots);
  appendNumber(data, state.heroes.length);
  for (const hero of state.heroes) {
    appendString(data, hero.definitionId);
    appendNumber(data, hero.tier);
    appendNumber(data, hero.level);
    appendNumber(data, hero.xp);
    appendNumber(data, hero.currentHp);
    appendNumber(data, hero.maxHp);
    appendNumber(data, hero.x);
    appendNumber(data, hero.y);
    appendNumber(data, hero.vx);
    appendNumber(data, hero.vy);
    appendNumber(data, hero.radius);
    appendNumber(data, hero.mass);
    appendString(data, hero.state);
    appendNumber(data, hero.lastAttackTick);
    appendNumber(data, hero.lastDeployTick);
    appendOptionalNumber(data, hero.currentTargetId);
    appendOptionalString(data, hero.equippedArtifact);
    appendStringArray(data, hero.equippedItems);
    appendOptionalString(data, hero.infinityStone);
    appendNumber(data, hero.movementModifiers.length);
    for (const modifier of hero.movementModifiers) {
      appendString(data, modifier.id);
      appendNumber(data, modifier.multiplier);
      appendNumber(data, modifier.expirationTick);
    }
    appendNumber(data, hero.buffs.length);
    for (const buff of hero.buffs) {
      appendString(data, buff.id);
      appendString(data, String(buff.stat));
      appendNumber(data, toFixed(buff.amount));
      appendNumber(data, buff.expirationTick);
    }
    appendStringRecord(data, hero.skillCooldowns);
  }

  // Turrets
  appendNumber(data, state.turrets.length);
  for (const turret of state.turrets) {
    appendString(data, turret.definitionId);
    appendNumber(data, turret.tier);
    appendString(data, turret.currentClass);
    appendNumber(data, turret.slotIndex);
    appendNumber(data, turret.lastAttackTick);
    appendNumber(data, turret.specialCooldown);
    appendString(data, turret.targetingMode);
    appendNumber(data, turret.currentHp);
    appendNumber(data, turret.maxHp);
  }

  // Turret slots
  appendNumber(data, state.turretSlots.length);
  for (const slot of state.turretSlots) {
    appendNumber(data, slot.index);
    appendNumber(data, slot.x);
    appendNumber(data, slot.y);
    appendBool(data, slot.isUnlocked);
  }

  // Projectiles
  appendNumber(data, state.nextProjectileId);
  appendNumber(data, state.projectiles.length);
  for (const projectile of state.projectiles) {
    appendNumber(data, projectile.id);
    appendString(data, projectile.type);
    appendString(data, projectile.sourceType);
    appendSourceId(data, projectile.sourceId);
    appendNumber(data, projectile.targetEnemyId);
    appendNumber(data, projectile.x);
    appendNumber(data, projectile.y);
    appendNumber(data, projectile.startX);
    appendNumber(data, projectile.startY);
    appendNumber(data, projectile.targetX);
    appendNumber(data, projectile.targetY);
    appendNumber(data, projectile.speed);
    appendNumber(data, projectile.damage);
    appendNumber(data, projectile.spawnTick);
    appendString(data, projectile.class);
    appendSkillEffects(data, projectile.effects);
  }

  // Crystal system (ancient artifacts)
  appendNumber(data, state.crystalFragments.length);
  for (const fragment of state.crystalFragments) {
    appendString(data, fragment.crystalType);
    appendNumber(data, fragment.count);
  }
  appendStringArray(data, state.collectedCrystals);
  appendBool(data, !!state.matrixState);
  if (state.matrixState) {
    appendBool(data, state.matrixState.isAssembled);
    appendOptionalString(data, state.matrixState.heroId);
    appendStringArray(data, state.matrixState.crystalsCollected);
    appendNumber(data, state.matrixState.annihilationCooldown);
    appendNumber(data, state.matrixState.annihilationUsedCount);
  }

  // Materials
  appendStringRecord(data, state.materials);

  // Analytics stats
  appendNumber(data, state.stats.totalDamageDealt);
  appendNumber(data, state.stats.enemiesKilledByHero);
  appendNumber(data, state.stats.enemiesKilledByTurret);
  appendNumber(data, state.stats.enemiesKilledByFortress);

  return fnv1a32(data);
}

/**
 * Compute chain hash from previous chain hash, tick, and current hash
 */
export function computeChainHash(
  prevChainHash: number,
  tick: number,
  currentHash: number
): number {
  const data: number[] = [];
  data.push(...numberToBytes(prevChainHash, 4));
  data.push(...numberToBytes(tick, 4));
  data.push(...numberToBytes(currentHash, 4));
  return fnv1a32(data);
}

/**
 * Create checkpoint at current state
 */
export function createCheckpoint(
  state: GameState,
  prevChainHash: number
): Checkpoint {
  const hash32 = computeCheckpointHash(state);
  const chainHash32 = computeChainHash(prevChainHash, state.tick, hash32);

  return {
    tick: state.tick,
    hash32,
    chainHash32,
  };
}

/**
 * Verify a checkpoint against computed values
 */
export function verifyCheckpoint(
  checkpoint: Checkpoint,
  state: GameState,
  prevChainHash: number
): boolean {
  const expectedHash = computeCheckpointHash(state);
  const expectedChain = computeChainHash(prevChainHash, state.tick, expectedHash);

  return (
    checkpoint.hash32 === expectedHash &&
    checkpoint.chainHash32 === expectedChain
  );
}

/**
 * Compute final hash for run verification
 * Includes summary stats
 */
export function computeFinalHash(state: GameState): number {
  const data: number[] = [];

  // Include checkpoint hash
  data.push(...numberToBytes(computeCheckpointHash(state), 4));

  // Add final stats
  data.push(...numberToBytes(state.wavesCleared, 4));
  data.push(...numberToBytes(state.kills, 4));
  data.push(...numberToBytes(state.eliteKills, 4));
  data.push(...numberToBytes(state.goldEarned, 4));
  data.push(...numberToBytes(state.dustEarned, 4));
  data.push(...numberToBytes(state.tick, 4)); // Time survived
  data.push(state.won ? 1 : 0);

  return fnv1a32(data);
}
