import { ActiveRelic, ModifierSet, Enemy, GameState } from './types.js';
import { DEFAULT_MODIFIERS, getRelicById, ExtendedRelicDef } from './data/relics.js';

/**
 * Compute combined modifiers from active relics
 * Also applies curse penalties from cursed relics
 */
export function computeModifiers(relics: ActiveRelic[]): ModifierSet {
  // Start with defaults
  const result: ModifierSet = { ...DEFAULT_MODIFIERS };

  for (const activeRelic of relics) {
    const def = getRelicById(activeRelic.id) as ExtendedRelicDef | undefined;
    if (!def) continue;
    if (def.category === 'synergy') continue;

    const mods = def.modifiers;

    // Multiplicative modifiers
    if (mods.damageMultiplier !== undefined) {
      result.damageMultiplier *= mods.damageMultiplier;
    }
    if (mods.goldMultiplier !== undefined) {
      result.goldMultiplier *= mods.goldMultiplier;
    }
    if (mods.dustMultiplier !== undefined) {
      result.dustMultiplier *= mods.dustMultiplier;
    }
    if (mods.maxHpMultiplier !== undefined) {
      result.maxHpMultiplier *= mods.maxHpMultiplier;
    }
    if (mods.cooldownMultiplier !== undefined) {
      result.cooldownMultiplier *= mods.cooldownMultiplier;
    }
    if (mods.attackSpeedMultiplier !== undefined) {
      result.attackSpeedMultiplier *= mods.attackSpeedMultiplier;
    }
    if (mods.eliteDamageMultiplier !== undefined) {
      result.eliteDamageMultiplier *= mods.eliteDamageMultiplier;
    }
    if (mods.lowHpDamageMultiplier !== undefined) {
      result.lowHpDamageMultiplier *= mods.lowHpDamageMultiplier;
    }
    if (mods.luckMultiplier !== undefined) {
      result.luckMultiplier *= mods.luckMultiplier;
    }

    // Additive modifiers
    if (mods.splashRadius !== undefined) {
      result.splashRadius = Math.max(result.splashRadius, mods.splashRadius);
    }
    if (mods.splashDamage !== undefined) {
      result.splashDamage = Math.max(result.splashDamage, mods.splashDamage);
    }
    if (mods.pierceCount !== undefined) {
      result.pierceCount += mods.pierceCount;
    }
    if (mods.chainChance !== undefined) {
      result.chainChance = Math.min(result.chainChance + mods.chainChance, 1.0);
    }
    if (mods.chainCount !== undefined) {
      result.chainCount += mods.chainCount;
    }
    if (mods.chainDamage !== undefined) {
      result.chainDamage = Math.max(result.chainDamage, mods.chainDamage);
    }
    if (mods.executeThreshold !== undefined) {
      result.executeThreshold = Math.max(result.executeThreshold, mods.executeThreshold);
    }
    if (mods.executeDamage !== undefined) {
      result.executeDamage = Math.max(result.executeDamage, mods.executeDamage);
    }
    if (mods.critChance !== undefined) {
      result.critChance = Math.min(result.critChance + mods.critChance, 1.0);
    }
    if (mods.critDamage !== undefined) {
      result.critDamage = Math.max(result.critDamage, mods.critDamage);
    }
    if (mods.hpRegen !== undefined) {
      result.hpRegen += mods.hpRegen;
    }
    if (mods.waveDamageBonus !== undefined) {
      result.waveDamageBonus += mods.waveDamageBonus;
    }
    if (mods.lowHpThreshold !== undefined) {
      result.lowHpThreshold = Math.max(result.lowHpThreshold, mods.lowHpThreshold);
    }

    // Apply curse penalties from cursed relics
    if (def.curse) {
      const curseStat = def.curse.stat as keyof ModifierSet;
      const curseValue = def.curse.value;

      // Handle known curse stats
      switch (curseStat) {
        case 'maxHpMultiplier':
          result.maxHpMultiplier *= curseValue;
          break;
        case 'hpRegen':
          result.hpRegen = curseValue; // Set to 0 for vampiric touch
          break;
        // Special curses that aren't direct modifiers
        // These are handled in simulation:
        // - 'random': random stat penalty
        // - 'corruption': chance for random debuff
        // - 'hpCost': HP cost per attack
        // - 'accuracy': chance to miss
        default:
          break;
      }
    }
  }

  return result;
}

/**
 * Calculate final damage against a target
 */
export function calculateDamage(
  baseDamage: number,
  state: GameState,
  target: Enemy,
  isCrit: boolean
): number {
  const mods = state.modifiers;
  let damage = baseDamage;

  // Base damage multiplier
  damage *= mods.damageMultiplier;

  // Wave damage bonus
  damage *= 1 + (mods.waveDamageBonus * state.wavesCleared);

  // Elite damage bonus
  if (target.isElite) {
    damage *= mods.eliteDamageMultiplier;
  }

  // Execute damage
  const hpPercent = target.hp / target.maxHp;
  if (mods.executeThreshold > 0 && hpPercent <= mods.executeThreshold) {
    damage *= mods.executeDamage;
  }

  // Low HP fortress bonus
  const fortressHpPercent = state.fortressHp / state.fortressMaxHp;
  if (fortressHpPercent <= mods.lowHpThreshold) {
    damage *= mods.lowHpDamageMultiplier;
  }

  // Critical hit
  if (isCrit) {
    damage *= mods.critDamage;
  }

  return Math.floor(damage);
}

/**
 * Check if attack should crit (deterministic based on RNG)
 */
export function shouldCrit(critChance: number, luckMult: number, rngValue: number): boolean {
  const effectiveChance = Math.min(critChance * luckMult, 1.0);
  return rngValue < effectiveChance;
}

/**
 * Check if attack should chain (deterministic based on RNG)
 */
export function shouldChain(chainChance: number, luckMult: number, rngValue: number): boolean {
  const effectiveChance = Math.min(chainChance * luckMult, 1.0);
  return rngValue < effectiveChance;
}
