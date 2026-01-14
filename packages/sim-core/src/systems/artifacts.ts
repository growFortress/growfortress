/**
 * Artifact System
 *
 * Handles artifact and item effects:
 * - Damage bonuses (base and class-specific)
 * - Defensive effects (dodge, block)
 * - Passive abilities
 * - Consumable items
 */

import type { ActiveHero, FortressClass, ModifierSet } from '../types.js';
import { getArtifactById, getItemById } from '../data/artifacts.js';
import { analytics } from '../analytics.js';
import { FP_BASE } from './constants.js';

/**
 * Calculate damage bonus from an equipped Artifact
 * @returns Multiplier (1.0 = no bonus, 1.4 = +40% damage)
 */
export function calculateHeroArtifactDamageBonus(artifactId: string | undefined): number {
  if (!artifactId) return 1.0;

  const artifact = getArtifactById(artifactId);
  if (!artifact) return 1.0;

  for (const effect of artifact.effects) {
    if (effect.type === 'stat_boost' && effect.stat === 'damageMultiplier' && effect.value) {
      return effect.value / FP_BASE;
    }
    // Handle 'allStats' which boosts everything including damage
    if (effect.type === 'stat_boost' && effect.stat === 'allStats' && effect.value) {
      return effect.value / FP_BASE;
    }
  }

  return 1.0;
}

/**
 * Calculate health bonus from an equipped Artifact
 * @returns Multiplier (1.0 = no bonus, 1.1 = +10% HP)
 */
export function calculateHeroArtifactHealthBonus(artifactId: string | undefined): number {
  if (!artifactId) return 1.0;

  const artifact = getArtifactById(artifactId);
  if (!artifact) return 1.0;

  for (const effect of artifact.effects) {
    if (effect.type === 'stat_boost' && effect.stat === 'healthMultiplier' && effect.value) {
      return effect.value / FP_BASE;
    }
    // Handle 'allStats' which boosts everything including health
    if (effect.type === 'stat_boost' && effect.stat === 'allStats' && effect.value) {
      return effect.value / FP_BASE;
    }
  }

  return 1.0;
}

/**
 * Calculate class-specific damage bonus from Artifact (iceDamage, chaosMagic, etc.)
 */
export function calculateHeroArtifactClassDamageBonus(
  artifactId: string | undefined,
  heroClass: FortressClass
): number {
  if (!artifactId) return 1.0;

  const artifact = getArtifactById(artifactId);
  if (!artifact) return 1.0;

  // Map hero class to relevant stat
  const classStatMap: Record<string, string[]> = {
    ice: ['iceDamage'],
    magic: ['chaosMagic', 'spellPower', 'defensiveSpells'],
    lightning: ['lightningDamage'],
    fire: ['fireDamage'],
    poison: ['poisonDamage'],
    natural: ['physicalDamage'],
    tech: ['techDamage'],
  };

  const relevantStats = classStatMap[heroClass] || [];

  for (const effect of artifact.effects) {
    if (effect.type === 'stat_boost' && effect.stat && relevantStats.includes(effect.stat) && effect.value) {
      return effect.value / FP_BASE;
    }
  }

  return 1.0;
}

/**
 * Calculate dodge chance from Artifact (Cloak of Levitation)
 */
export function calculateHeroArtifactDodgeChance(artifactId: string | undefined): number {
  if (!artifactId) return 0;

  const artifact = getArtifactById(artifactId);
  if (!artifact) return 0;

  for (const effect of artifact.effects) {
    if (effect.type === 'stat_boost' && effect.stat === 'dodgeChance' && effect.value) {
      return (effect.value / FP_BASE) - 1; // Convert from multiplier to percentage
    }
  }

  return 0;
}

/**
 * Calculate block chance from Artifact (Captain's Shield)
 */
export function calculateHeroArtifactBlockChance(artifactId: string | undefined): number {
  if (!artifactId) return 0;

  const artifact = getArtifactById(artifactId);
  if (!artifact) return 0;

  for (const effect of artifact.effects) {
    if (effect.type === 'stat_boost' && effect.stat === 'blockChance' && effect.value) {
      return (effect.value / FP_BASE) - 1;
    }
  }

  return 0;
}

/**
 * Check if artifact has a specific passive effect
 */
export function hasArtifactPassive(artifactId: string | undefined, passiveKeyword: string): boolean {
  if (!artifactId) return false;

  const artifact = getArtifactById(artifactId);
  if (!artifact) return false;

  for (const effect of artifact.effects) {
    if (effect.type === 'passive' && effect.description.toLowerCase().includes(passiveKeyword.toLowerCase())) {
      return true;
    }
  }

  return false;
}

/**
 * Apply item effects to hero (consumables with duration)
 */
export function applyItemToHero(
  hero: ActiveHero,
  itemId: string,
  currentTick: number
): void {
  const item = getItemById(itemId);
  if (!item) return;

  for (const effect of item.effects) {
    switch (effect.type) {
      case 'instant':
        // Apply instant effects
        if (effect.stat === 'hp' && effect.value) {
          const healAmount = effect.value / FP_BASE;
          hero.currentHp = Math.min(hero.currentHp + healAmount, hero.maxHp);
        }
        if (effect.stat === 'xp' && effect.value) {
          hero.xp += effect.value / FP_BASE;
        }
        if (effect.stat === 'shield' && effect.value) {
          // Add as temporary HP
          hero.currentHp += effect.value / FP_BASE;
        }
        break;

      case 'duration':
        // Add buff with duration - only if stat is valid ModifierSet key
        if (effect.stat && effect.value && effect.duration) {
          // Map item stats to ModifierSet stats (using new additive bonus names)
          const statMapping: Record<string, keyof ModifierSet> = {
            'damageMultiplier': 'damageBonus',
            'attackSpeed': 'attackSpeedBonus',
            'critChance': 'critChance',
          };

          const modifierStat = statMapping[effect.stat];
          if (modifierStat) {
            hero.buffs.push({
              id: `item_${itemId}_${currentTick}`,
              stat: modifierStat,
              amount: (effect.value / FP_BASE) - 1, // Convert to bonus amount
              expirationTick: currentTick + effect.duration,
            });
          }
        }
        break;
    }
  }

  // Remove item from inventory
  const itemIndex = hero.equippedItems.indexOf(itemId);
  if (itemIndex !== -1) {
    hero.equippedItems.splice(itemIndex, 1);
  }
}

/**
 * Calculate all artifact damage bonuses combined
 */
export function calculateTotalArtifactDamageMultiplier(
  hero: ActiveHero,
  heroClass: FortressClass
): number {
  let multiplier = 1.0;

  // Base artifact damage bonus
  multiplier *= calculateHeroArtifactDamageBonus(hero.equippedArtifact);

  // Class-specific damage bonus
  multiplier *= calculateHeroArtifactClassDamageBonus(hero.equippedArtifact, heroClass);

  if (hero.definitionId) {
    analytics.trackDamage('hero', hero.definitionId, 0); // Checkpoint hero presence
  }

  return multiplier;
}

/**
 * Calculate hero stats with artifact bonuses applied
 * @param baseStats - Base stats from calculateHeroStats
 * @param artifactId - Equipped artifact ID (optional)
 * @returns Stats with artifact bonuses applied
 */
export function applyArtifactBonusesToStats(
  baseStats: { hp: number; damage: number; attackSpeed: number; range: number; moveSpeed: number },
  artifactId: string | undefined
): { hp: number; damage: number; attackSpeed: number; range: number; moveSpeed: number } {
  if (!artifactId) return baseStats;

  const healthMultiplier = calculateHeroArtifactHealthBonus(artifactId);
  const damageMultiplier = calculateHeroArtifactDamageBonus(artifactId);

  return {
    hp: Math.floor(baseStats.hp * healthMultiplier),
    damage: Math.floor(baseStats.damage * damageMultiplier),
    attackSpeed: baseStats.attackSpeed,
    range: baseStats.range,
    moveSpeed: baseStats.moveSpeed,
  };
}
