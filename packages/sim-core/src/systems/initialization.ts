/**
 * Initialization System
 *
 * Creates game entities at the start of a session:
 * - Hero initialization with formation positioning
 * - Turret initialization
 * - Skill unlocking based on fortress level
 */

import { FP } from '../fixed.js';
import type { ActiveHero, ActiveTurret, FortressClass } from '../types.js';
import { getHeroById, calculateHeroStats } from '../data/heroes.js';
import { getTurretById, calculateTurretHp } from '../data/turrets.js';
import { getClassById } from '../data/classes.js';
import { HERO_PHYSICS } from '../physics.js';
import { calculateHeroArtifactHealthBonus } from './artifacts.js';
import { getFormationPosition } from './helpers.js';
import { getHeroPowerMultipliers } from './apply-power-upgrades.js';
import { createDefaultPlayerPowerData, type PlayerPowerData } from '../data/power-upgrades.js';

/**
 * Initialize heroes from config
 * @param heroIds - Array of hero definition IDs to initialize
 * @param fortressX - X position of the fortress (for formation positioning)
 * @param powerData - Player's power upgrade data (stat bonuses)
 * @param heroTiers - Map of heroId -> tier (1-3) for tier progression
 * @param equippedArtifacts - Map of heroId -> artifactId for equipped artifacts
 * @param guildStatBoost - Guild stat boost (0-0.20 = 0-20% HP bonus)
 */
export function initializeHeroes(
  heroIds: string[],
  fortressX: number,
  powerData?: PlayerPowerData,
  heroTiers?: Record<string, number>,
  equippedArtifacts?: Record<string, string>,
  guildStatBoost?: number
): ActiveHero[] {
  const heroes: ActiveHero[] = [];
  const heroCount = heroIds.filter(id => getHeroById(id)).length;

  // Use default power data if none provided
  const effectivePowerData = powerData || createDefaultPlayerPowerData();
  const effectiveHeroTiers = heroTiers || {};
  const guildBoost = 1 + (guildStatBoost ?? 0);

  let validHeroIndex = 0;

  for (const heroId of heroIds) {
    const heroDef = getHeroById(heroId);
    if (!heroDef) continue;

    // Get formation position for this hero
    const formation = getFormationPosition(validHeroIndex, heroCount);

    // Get hero tier (default to 1 if not upgraded)
    const tier = (effectiveHeroTiers[heroId] || 1) as 1 | 2 | 3;

    // Calculate base stats for this tier
    const tierStats = calculateHeroStats(heroDef, tier, 1);

    // Apply power upgrades to hero stats (multiplicative with tier bonus)
    const powerMultipliers = getHeroPowerMultipliers(effectivePowerData, heroId);
    // Apply guild stat boost to HP
    let modifiedHp = Math.floor(tierStats.hp * powerMultipliers.hpMultiplier * guildBoost);

    // Apply artifact bonuses
    const artifactId = equippedArtifacts?.[heroId];
    if (artifactId) {
      const artifactHealthBonus = calculateHeroArtifactHealthBonus(artifactId);
      modifiedHp = Math.floor(modifiedHp * artifactHealthBonus);
    }

    const hero: ActiveHero = {
      definitionId: heroId,
      tier,
      level: 1,
      xp: 0,
      currentHp: modifiedHp,
      maxHp: modifiedHp,

      // Position in formation
      x: fortressX + FP.fromFloat(formation.xOffset),
      y: FP.fromFloat(formation.yOffset),

      // Physics
      vx: 0,
      vy: 0,
      radius: HERO_PHYSICS.defaultRadius,
      mass: HERO_PHYSICS.defaultMass,
      movementModifiers: [],

      state: 'idle',
      lastAttackTick: -1000, // Ready to attack immediately when entering combat
      lastDeployTick: -1000, // Ready to deploy immediately
      skillCooldowns: {},
      buffs: [],
      equippedArtifact: artifactId,
      equippedItems: [],
    };

    validHeroIndex++;

    // Initialize skill cooldowns
    for (const tier of heroDef.tiers) {
      for (const skill of tier.skills) {
        hero.skillCooldowns[skill.id] = 0;
      }
    }

    heroes.push(hero);
  }

  return heroes;
}

/**
 * Initialize turrets from config
 * Note: Turret power upgrades (damage/attackSpeed/range) are applied during combat, not at initialization
 * @param guildStatBoost - Guild stat boost (0-0.20 = 0-20% HP bonus)
 */
export function initializeTurrets(
  turretConfigs: Array<{ definitionId: string; slotIndex: number; class: FortressClass; tier?: 1 | 2 | 3 }>,
  guildStatBoost?: number
): ActiveTurret[] {
  const turrets: ActiveTurret[] = [];
  const guildBoost = 1 + (guildStatBoost ?? 0);

  for (const config of turretConfigs) {
    const turretDef = getTurretById(config.definitionId);
    const tier = config.tier || 1;
    const baseHp = turretDef ? calculateTurretHp(turretDef, tier) : 150;
    const maxHp = Math.floor(baseHp * guildBoost);

    const turret: ActiveTurret = {
      definitionId: config.definitionId,
      tier,
      currentClass: config.class,
      slotIndex: config.slotIndex,
      lastAttackTick: -1000, // Ready to attack immediately
      specialCooldown: 0,
      targetingMode: 'closest_to_fortress',
      currentHp: maxHp,
      maxHp,
    };

    turrets.push(turret);
  }

  return turrets;
}

/**
 * Initialize active skills based on fortress level
 */
export function initializeActiveSkills(
  fortressClass: FortressClass,
  fortressLevel: number
): string[] {
  const classDef = getClassById(fortressClass);
  if (!classDef) return [];

  return classDef.skills
    .filter(skill => skill.unlockedAtFortressLevel <= fortressLevel)
    .map(skill => skill.id);
}
