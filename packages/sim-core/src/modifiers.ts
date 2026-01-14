import { ActiveRelic, ModifierSet, Enemy, GameState } from './types.js';
import { DEFAULT_MODIFIERS, getRelicById, ExtendedRelicDef } from './data/relics.js';

/**
 * Apply diminishing returns to crit chance
 * First 50% is linear, then soft cap with diminishing returns
 * Hard cap at 75%
 */
function applyCritDiminishingReturns(rawCritChance: number): number {
  const SOFT_CAP = 0.5;
  const HARD_CAP = 0.75;

  if (rawCritChance <= SOFT_CAP) {
    return rawCritChance;
  }

  const excessCrit = rawCritChance - SOFT_CAP;
  // Each point above soft cap gives 50% value
  const diminishedExcess = excessCrit * 0.5;

  return Math.min(SOFT_CAP + diminishedExcess, HARD_CAP);
}

/**
 * Apply curse penalty to bonus accumulators
 */
function applyCurse(
  curse: { stat: string; value: number; description: string },
  bonuses: {
    damage: number;
    maxHp: number;
    incomingDamageReduction: number;
  },
  result: ModifierSet
): void {
  switch (curse.stat) {
    case 'maxHpBonus':
    case 'maxHpMultiplier':
      // Convert multiplier to bonus: 0.8 becomes -0.2
      bonuses.maxHp += (curse.value - 1);
      break;
    case 'hpRegen':
      result.hpRegen = curse.value; // Set to 0 for vampiric touch
      break;
    case 'incomingDamage':
      // +25% incoming damage = -25% reduction
      bonuses.incomingDamageReduction -= (curse.value - 1);
      break;
    case 'damageBonus':
    case 'damageMultiplier':
      // Convert multiplier to bonus: 0.85 becomes -0.15
      bonuses.damage += (curse.value - 1);
      break;
    default:
      break;
  }
}

/**
 * Compute combined modifiers from active relics
 * Uses additive bonus system: base × (1 + sum of bonuses)
 * No more multiplicative power creep!
 */
export function computeModifiers(relics: ActiveRelic[]): ModifierSet {
  // Start with defaults
  const result: ModifierSet = { ...DEFAULT_MODIFIERS };

  // Accumulators for additive bonuses
  const bonuses = {
    damage: 0,
    attackSpeed: 0,
    cooldown: 0,
    gold: 0,
    dust: 0,
    maxHp: 0,
    eliteDamage: 0,
    incomingDamageReduction: 0,
    splashRadius: 0,
    splashDamage: 0,
    chainDamage: 0,
    executeDamage: 0,
    critDamage: 0,
    mass: 0,
    knockbackResist: 0,
    ccResist: 0,
    dropRate: 0,
    relicQuality: 0,
    goldFind: 0,
    lowHpDamage: 0,
  };

  let rawCritChance = 0;

  for (const activeRelic of relics) {
    const def = getRelicById(activeRelic.id) as ExtendedRelicDef | undefined;
    if (!def) continue;
    if (def.category === 'synergy') continue;

    const mods = def.modifiers;

    // === ADDITIVE BONUSES ===
    if (mods.damageBonus !== undefined) {
      bonuses.damage += mods.damageBonus;
    }
    if (mods.attackSpeedBonus !== undefined) {
      bonuses.attackSpeed += mods.attackSpeedBonus;
    }
    if (mods.cooldownReduction !== undefined) {
      bonuses.cooldown += mods.cooldownReduction;
    }
    if (mods.goldBonus !== undefined) {
      bonuses.gold += mods.goldBonus;
    }
    if (mods.dustBonus !== undefined) {
      bonuses.dust += mods.dustBonus;
    }
    if (mods.maxHpBonus !== undefined) {
      bonuses.maxHp += mods.maxHpBonus;
    }
    if (mods.eliteDamageBonus !== undefined) {
      bonuses.eliteDamage += mods.eliteDamageBonus;
    }

    // === STACKABLE SECONDARY STATS ===
    // Splash - additive stacking (no more Math.max!)
    if (mods.splashRadiusBonus !== undefined) {
      bonuses.splashRadius += mods.splashRadiusBonus;
    }
    if (mods.splashDamagePercent !== undefined) {
      bonuses.splashDamage += mods.splashDamagePercent;
    }

    // Pierce - additive (unchanged)
    if (mods.pierceCount !== undefined) {
      result.pierceCount += mods.pierceCount;
    }

    // Chain - additive stacking
    if (mods.chainChance !== undefined) {
      result.chainChance += mods.chainChance;
    }
    if (mods.chainCount !== undefined) {
      result.chainCount += mods.chainCount;
    }
    if (mods.chainDamagePercent !== undefined) {
      bonuses.chainDamage += mods.chainDamagePercent;
    }

    // Execute - threshold uses max (logical), damage is additive
    if (mods.executeThreshold !== undefined) {
      result.executeThreshold = Math.max(result.executeThreshold, mods.executeThreshold);
    }
    if (mods.executeBonusDamage !== undefined) {
      bonuses.executeDamage += mods.executeBonusDamage;
    }

    // Crit - accumulate raw chance, apply DR later
    if (mods.critChance !== undefined) {
      rawCritChance += mods.critChance;
    }
    if (mods.critDamageBonus !== undefined) {
      bonuses.critDamage += mods.critDamageBonus;
    }

    // HP Regen - additive (unchanged)
    if (mods.hpRegen !== undefined) {
      result.hpRegen += mods.hpRegen;
    }

    // Incoming damage reduction
    if (mods.incomingDamageReduction !== undefined) {
      bonuses.incomingDamageReduction += mods.incomingDamageReduction;
    }

    // === PHYSICS-BASED DEFENSE ===
    if (mods.massBonus !== undefined) {
      bonuses.mass += mods.massBonus;
    }
    if (mods.knockbackResistance !== undefined) {
      bonuses.knockbackResist += mods.knockbackResistance;
    }
    if (mods.ccResistance !== undefined) {
      bonuses.ccResist += mods.ccResistance;
    }

    // === LUCK (META-REWARDS) ===
    if (mods.dropRateBonus !== undefined) {
      bonuses.dropRate += mods.dropRateBonus;
    }
    if (mods.relicQualityBonus !== undefined) {
      bonuses.relicQuality += mods.relicQualityBonus;
    }
    if (mods.goldFindBonus !== undefined) {
      bonuses.goldFind += mods.goldFindBonus;
    }

    // === CONDITIONAL ===
    if (mods.waveDamageBonus !== undefined) {
      result.waveDamageBonus += mods.waveDamageBonus;
    }
    if (mods.lowHpDamageBonus !== undefined) {
      bonuses.lowHpDamage += mods.lowHpDamageBonus;
    }
    if (mods.lowHpThreshold !== undefined) {
      result.lowHpThreshold = Math.max(result.lowHpThreshold, mods.lowHpThreshold);
    }

    // Apply curse penalties (unified handling)
    if (def.curse) {
      applyCurse(def.curse, bonuses, result);
    }
  }

  // === ASSIGN FINAL VALUES WITH CAPS ===

  // Additive bonuses (no caps unless specified)
  result.damageBonus = bonuses.damage;
  result.attackSpeedBonus = bonuses.attackSpeed;
  result.cooldownReduction = Math.min(bonuses.cooldown, 0.75); // Cap at 75% CDR
  result.goldBonus = bonuses.gold;
  result.dustBonus = bonuses.dust;
  result.maxHpBonus = bonuses.maxHp;
  result.eliteDamageBonus = bonuses.eliteDamage;

  // Stackable stats with caps
  result.splashRadiusBonus = bonuses.splashRadius;
  result.splashDamagePercent = Math.min(bonuses.splashDamage, 1.0); // Cap at 100%
  result.chainChance = Math.min(result.chainChance, 1.0); // Cap at 100%
  result.chainDamagePercent = Math.min(bonuses.chainDamage, 1.0); // Cap at 100%
  result.executeBonusDamage = bonuses.executeDamage;

  // Crit with diminishing returns
  result.critChance = applyCritDiminishingReturns(rawCritChance);
  result.critDamageBonus = DEFAULT_MODIFIERS.critDamageBonus + bonuses.critDamage;

  // Defense
  result.incomingDamageReduction = bonuses.incomingDamageReduction;

  // Physics defense with caps
  result.massBonus = bonuses.mass;
  result.knockbackResistance = Math.min(bonuses.knockbackResist, 0.9); // Cap at 90%
  result.ccResistance = Math.min(bonuses.ccResist, 0.9); // Cap at 90%

  // Luck (meta-rewards)
  result.dropRateBonus = bonuses.dropRate;
  result.relicQualityBonus = bonuses.relicQuality;
  result.goldFindBonus = bonuses.goldFind;

  // Conditional
  result.lowHpDamageBonus = bonuses.lowHpDamage;

  return result;
}

/**
 * Calculate final damage against a target
 * Uses additive bonus system: base × (1 + sum of bonuses)
 */
export function calculateDamage(
  baseDamage: number,
  state: GameState,
  target: Enemy,
  isCrit: boolean
): number {
  const mods = state.modifiers;
  let damage = baseDamage;

  // Base damage bonus (additive)
  damage *= (1 + mods.damageBonus);

  // Wave damage bonus (additive per wave)
  damage *= (1 + mods.waveDamageBonus * state.wavesCleared);

  // Elite damage bonus (additive)
  if (target.isElite) {
    damage *= (1 + mods.eliteDamageBonus);
  }

  // Execute bonus damage (additive)
  const hpPercent = target.hp / target.maxHp;
  if (mods.executeThreshold > 0 && hpPercent <= mods.executeThreshold) {
    damage *= (1 + mods.executeBonusDamage);
  }

  // Low HP fortress bonus (additive)
  const fortressHpPercent = state.fortressHp / state.fortressMaxHp;
  if (fortressHpPercent <= mods.lowHpThreshold) {
    damage *= (1 + mods.lowHpDamageBonus);
  }

  // Critical hit (uses critDamageBonus which includes base 0.5)
  if (isCrit) {
    damage *= (1 + mods.critDamageBonus);
  }

  return Math.floor(damage);
}

/**
 * Check if attack should crit (deterministic based on RNG)
 * Luck no longer affects combat - crit chance already has diminishing returns applied
 */
export function shouldCrit(critChance: number, rngValue: number): boolean {
  return rngValue < critChance;
}

/**
 * Check if attack should chain (deterministic based on RNG)
 * Luck no longer affects combat - chain chance is capped at 100%
 */
export function shouldChain(chainChance: number, rngValue: number): boolean {
  return rngValue < chainChance;
}

/**
 * Calculate drop chance with luck bonus
 * Used for materials, artifacts, relic quality
 */
export function calculateDropChance(baseChance: number, dropRateBonus: number): number {
  return Math.min(baseChance * (1 + dropRateBonus), 1.0);
}

/**
 * Calculate gold earned with all bonuses
 */
export function calculateGoldEarned(
  baseGold: number,
  goldBonus: number,
  goldFindBonus: number
): number {
  return Math.floor(baseGold * (1 + goldBonus + goldFindBonus));
}

/**
 * Calculate dust earned with bonus
 */
export function calculateDustEarned(baseDust: number, dustBonus: number): number {
  return Math.floor(baseDust * (1 + dustBonus));
}

/**
 * Calculate incoming damage after reduction
 * Negative reduction = more damage taken (from curses)
 */
export function calculateIncomingDamage(
  baseDamage: number,
  incomingDamageReduction: number
): number {
  return Math.floor(baseDamage * (1 - incomingDamageReduction));
}
