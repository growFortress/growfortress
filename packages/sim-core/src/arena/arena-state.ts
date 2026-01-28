/**
 * Arena PvP State Types and Initialization
 *
 * Defines the state structure for 1v1 arena battles where two fortresses
 * fight each other with their heroes. No turrets in arena.
 */

import { Xorshift32 } from '../rng.js';
import { FP } from '../fixed.js';
import type {
  FortressClass,
  ActiveHero,
  ActiveProjectile,
  ModifierSet,
} from '../types.js';
import { DEFAULT_MODIFIERS } from '../data/relics.js';
import { initializeHeroes } from '../systems.js';
import {
  calculateTotalHpBonus,
  calculateTotalDamageBonus,
  getMaxHeroSlots,
} from '../data/fortress-progression.js';
import {
  createDefaultPlayerPowerData,
  createDefaultStatUpgrades,
  type PlayerPowerData,
  type StatUpgrades,
  type HeroUpgrades,
} from '../data/power-upgrades.js';
import { getHeroPowerMultipliers } from '../systems/apply-power-upgrades.js';
import {
  calculateHeroArtifactDamageBonus,
  calculateHeroArtifactClassDamageBonus,
  calculateHeroArtifactAttackSpeedBonus,
} from '../systems/artifacts.js';
import { getHeroById } from '../data/heroes.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Fortress state in arena
 */
export interface ArenaFortress {
  hp: number;
  maxHp: number;
  class: FortressClass;
  damage: number;
  lastAttackTick: number;
  /** Position on the field (fixed-point) */
  x: number;
  y: number;
  /** Armor for damage reduction (diminishing returns formula) */
  armor: number;
}

/**
 * One side of the arena (left or right)
 */
export interface ArenaSide {
  ownerId: string;
  ownerName: string;
  fortress: ArenaFortress;
  heroes: ActiveHero[];
  projectiles: ActiveProjectile[];
  /** Computed modifiers for this side */
  modifiers: ModifierSet;
  /** Stats tracked during battle */
  stats: ArenaStats;
}

/**
 * Statistics for one side during battle
 */
export interface ArenaStats {
  damageDealt: number;
  damageReceived: number;
  heroesKilled: number;
  heroesLost: number;
}

/**
 * Win reason
 */
export type ArenaWinReason = 'fortress_destroyed' | 'timeout' | 'draw';

/**
 * Main arena state
 */
export interface ArenaState {
  mode: 'pvp_arena';
  tick: number;
  maxTicks: number; // Safety timeout (e.g., 18000 = 10 minutes at 30Hz)

  /** RNG state for determinism */
  rngState: number;

  /** Left side (challenger) */
  left: ArenaSide;

  /** Right side (challenged) */
  right: ArenaSide;

  /** Battle result */
  winner: 'left' | 'right' | null;
  winReason: ArenaWinReason | null;
  ended: boolean;
}

/**
 * Per-hero config for arena (aligns with matchmaking power: tier, upgrades, artifacts).
 * Omitting = tier 1, no upgrades, no artifact.
 */
export interface ArenaHeroConfig {
  heroId: string;
  tier?: 1 | 2 | 3;
  statUpgrades?: StatUpgrades;
  equippedArtifactId?: string | null;
}

/**
 * Configuration for one player's build.
 * Arena uses heroes + fortress only; no turrets.
 */
export interface ArenaBuildConfig {
  ownerId: string;
  ownerName: string;
  fortressClass: FortressClass;
  commanderLevel: number;
  /** Hero definition IDs */
  heroIds: string[];
  /** Power upgrade bonuses (additive bonuses, e.g., 0.2 = +20%) */
  damageBonus?: number;
  hpBonus?: number;
  /** Per-hero config (tier, upgrades, artifacts). When set, used for init; else defaults. */
  heroConfigs?: ArenaHeroConfig[];
}

/**
 * Arena simulation configuration
 */
export interface ArenaConfig {
  tickHz: number;
  maxTicks: number; // Safety timeout
  fieldWidth: number; // Fixed-point
  fieldHeight: number; // Fixed-point
  fortressBaseHp: number;
  fortressBaseDamage: number;
  fortressAttackInterval: number;
  /** Distance between fortresses (each fortress is this far from center) */
  fortressDistanceFromCenter: number; // Fixed-point
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Fortress exclusion zone radius - heroes cannot enter this area */
export const FORTRESS_EXCLUSION_RADIUS = FP.fromInt(3);

// ============================================================================
// ARMOR SYSTEM CONSTANTS
// ============================================================================

/** Base armor for tier 1 heroes */
const HERO_BASE_ARMOR = 5;

/** Armor bonus per tier (tier 2 = +5, tier 3 = +10) - reduced from 15 */
const HERO_ARMOR_PER_TIER = 5;

/** Base armor for fortress */
const FORTRESS_BASE_ARMOR = 15;

/** Fortress armor bonus per 10 commander levels - reduced from 10 */
const FORTRESS_ARMOR_PER_10_LEVELS = 5;

/** Arena damage reduction multiplier - heroes deal less damage in arena */
export const ARENA_DAMAGE_MULTIPLIER = 0.45; // 45% of normal damage for longer battles

/** Default arena configuration */
export const DEFAULT_ARENA_CONFIG: ArenaConfig = {
  tickHz: 30,
  maxTicks: 9000, // 5 minutes at 30Hz
  fieldWidth: FP.fromInt(50), // Large arena for tactical movement
  fieldHeight: FP.fromInt(15),
  fortressBaseHp: 2500, // High base HP for longer, strategic battles
  fortressBaseDamage: 30, // Fortress damage
  fortressAttackInterval: 12, // Faster fortress attacks (2.5/sec)
  fortressDistanceFromCenter: FP.fromInt(18), // 18 units from center, 36 total distance
};

// ============================================================================
// INITIALIZATION
// ============================================================================

function applyArenaHeroMultipliers(
  heroes: ActiveHero[],
  powerData: PlayerPowerData | undefined,
  armorBonus: number = 0
): void {
  for (const hero of heroes) {
    const heroDef = getHeroById(hero.definitionId);
    const powerMultipliers = powerData
      ? getHeroPowerMultipliers(powerData, hero.definitionId)
      : {
          damageMultiplier: 1,
          attackSpeedMultiplier: 1,
          rangeMultiplier: 1,
          critChanceBonus: 0,
        };

    const artifactDamageMultiplier = heroDef
      ? calculateHeroArtifactDamageBonus(hero.equippedArtifact) *
        calculateHeroArtifactClassDamageBonus(hero.equippedArtifact, heroDef.class)
      : 1;
    const artifactAttackSpeedMultiplier = calculateHeroArtifactAttackSpeedBonus(
      hero.equippedArtifact
    );

    hero.arenaDamageMultiplier =
      powerMultipliers.damageMultiplier * artifactDamageMultiplier;
    hero.arenaAttackSpeedMultiplier =
      powerMultipliers.attackSpeedMultiplier * artifactAttackSpeedMultiplier;
    hero.arenaRangeMultiplier = powerMultipliers.rangeMultiplier;
    hero.arenaCritChanceBonus = powerMultipliers.critChanceBonus;

    // Calculate hero armor based on tier
    // Tier 1: 10, Tier 2: 25, Tier 3: 40, plus bonuses from build
    const tierBonus = (hero.tier - 1) * HERO_ARMOR_PER_TIER;
    hero.arenaArmor = Math.floor((HERO_BASE_ARMOR + tierBonus) * (1 + armorBonus));
  }
}

/**
 * Create initial state for one side of the arena
 */
function createArenaSide(
  build: ArenaBuildConfig,
  side: 'left' | 'right',
  fortressX: number,
  config: ArenaConfig
): ArenaSide {
  // Calculate HP with commander level bonus
  const hpBonusFP = calculateTotalHpBonus(build.commanderLevel);
  const baseMaxHp = Math.floor((config.fortressBaseHp * hpBonusFP) / 16384);
  const maxHp = build.hpBonus
    ? Math.floor(baseMaxHp * (1 + build.hpBonus))
    : baseMaxHp;

  // Calculate damage with commander level bonus
  const damageBonus = calculateTotalDamageBonus(build.commanderLevel);
  const baseDamage = Math.floor((config.fortressBaseDamage * damageBonus) / 16384);

  // Initialize heroes - position them in front of their fortress
  // Spawn 6 units from fortress - heroes need to march to engage
  const heroSpawnX = side === 'left'
    ? FP.add(fortressX, FP.fromInt(6)) // 6 units right of left fortress
    : FP.sub(fortressX, FP.fromInt(6)); // 6 units left of right fortress

  const maxHeroSlots = getMaxHeroSlots(build.commanderLevel);
  const heroIds = build.heroIds.slice(0, maxHeroSlots);

  let powerData: PlayerPowerData | undefined;
  let heroTiers: Record<string, number> | undefined;
  let equippedArtifacts: Record<string, string> | undefined;

  if (build.heroConfigs?.length) {
    const configMap = new Map(build.heroConfigs.map((c) => [c.heroId, c]));
    heroTiers = {};
    equippedArtifacts = {};
    const heroUpgrades: HeroUpgrades[] = [];

    for (const heroId of heroIds) {
      const c = configMap.get(heroId);
      if (c) {
        if (c.tier) heroTiers![heroId] = c.tier;
        if (c.equippedArtifactId) equippedArtifacts![heroId] = c.equippedArtifactId;
        heroUpgrades.push({
          heroId,
          statUpgrades: c.statUpgrades ?? createDefaultStatUpgrades(),
        });
      }
    }

    powerData = {
      ...createDefaultPlayerPowerData(),
      heroUpgrades,
    };
  }

  const heroes = initializeHeroes(
    heroIds,
    heroSpawnX,
    powerData,
    heroTiers,
    equippedArtifacts
  );

  // Flip hero positions and facing direction for right side
  if (side === 'right') {
    for (const hero of heroes) {
      // Flip velocity direction (heroes should move towards enemy)
      hero.vx = FP.mul(hero.vx, FP.fromInt(-1));
      // Fix X position: initializeHeroes adds formation.xOffset, but for right side
      // we need to subtract it to place heroes in front of their fortress (towards enemy)
      // Calculate the offset that was added and subtract twice to flip it
      const currentOffset = FP.sub(hero.x, heroSpawnX);
      hero.x = FP.sub(heroSpawnX, currentOffset);
    }
  }

  // Apply hero multipliers including armor bonus from build
  const armorBonus = build.hpBonus ?? 0; // Armor scales with HP bonus
  applyArenaHeroMultipliers(heroes, powerData, armorBonus);

  // Build modifiers
  const modifiers: ModifierSet = { ...DEFAULT_MODIFIERS };
  if (build.damageBonus) {
    modifiers.damageBonus += build.damageBonus;
  }

  // Calculate fortress armor based on commander level
  // Base 20 + 10 per 10 levels + bonus from build
  const fortressLevelBonus = Math.floor(build.commanderLevel / 10) * FORTRESS_ARMOR_PER_10_LEVELS;
  const fortressArmor = Math.floor((FORTRESS_BASE_ARMOR + fortressLevelBonus) * (1 + armorBonus));

  return {
    ownerId: build.ownerId,
    ownerName: build.ownerName,
    fortress: {
      hp: maxHp,
      maxHp,
      class: build.fortressClass,
      damage: baseDamage,
      lastAttackTick: 0,
      x: fortressX,
      y: FP.fromInt(7), // Center Y
      armor: fortressArmor,
    },
    heroes,
    projectiles: [],
    modifiers,
    stats: {
      damageDealt: 0,
      damageReceived: 0,
      heroesKilled: 0,
      heroesLost: 0,
    },
  };
}

/**
 * Create initial arena state for a PvP battle
 */
export function createArenaState(
  seed: number,
  leftBuild: ArenaBuildConfig,
  rightBuild: ArenaBuildConfig,
  config: ArenaConfig = DEFAULT_ARENA_CONFIG
): ArenaState {
  const rng = new Xorshift32(seed);

  // Calculate fortress positions (symmetric around center)
  const centerX = FP.div(config.fieldWidth, FP.fromInt(2));
  const leftFortressX = FP.sub(centerX, config.fortressDistanceFromCenter);
  const rightFortressX = FP.add(centerX, config.fortressDistanceFromCenter);

  return {
    mode: 'pvp_arena',
    tick: 0,
    maxTicks: config.maxTicks,
    rngState: rng.getState(),
    left: createArenaSide(leftBuild, 'left', leftFortressX, config),
    right: createArenaSide(rightBuild, 'right', rightFortressX, config),
    winner: null,
    winReason: null,
    ended: false,
  };
}

/**
 * Get the enemy side for a given side
 */
export function getEnemySide(state: ArenaState, side: 'left' | 'right'): ArenaSide {
  return side === 'left' ? state.right : state.left;
}

/**
 * Get own side
 */
export function getOwnSide(state: ArenaState, side: 'left' | 'right'): ArenaSide {
  return side === 'left' ? state.left : state.right;
}
