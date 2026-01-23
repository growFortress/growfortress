/**
 * Artifact System
 *
 * Handles artifact and item effects:
 * - Damage bonuses (base and class-specific)
 * - Defensive effects (dodge, block)
 * - Passive abilities
 * - Consumable items
 */

import type { ActiveHero, FortressClass, ModifierSet, SkillEffect } from '../types.js';
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
 * Calculate attack speed bonus from an equipped Artifact
 * @returns Multiplier (1.0 = no bonus, 1.2 = +20% attack speed)
 */
export function calculateHeroArtifactAttackSpeedBonus(artifactId: string | undefined): number {
  if (!artifactId) return 1.0;

  const artifact = getArtifactById(artifactId);
  if (!artifact) return 1.0;

  for (const effect of artifact.effects) {
    if (effect.type === 'stat_boost' && effect.stat === 'attackSpeed' && effect.value) {
      return effect.value / FP_BASE;
    }
    // Handle 'allStats' which boosts everything including attack speed
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

/**
 * Calculate lifesteal from an equipped Artifact
 * @returns Lifesteal percentage (0.08 = 8%)
 */
export function calculateArtifactLifesteal(artifactId: string | undefined): number {
  if (!artifactId) return 0;

  const artifact = getArtifactById(artifactId);
  if (!artifact) return 0;

  // Check for lifesteal passive
  for (const effect of artifact.effects) {
    if (effect.type === 'passive' && effect.description) {
      // Parse lifesteal from description like "8% kradzieży życia" or "20% kradzieży życia"
      const lifestealMatch = effect.description.match(/(\d+)%\s*kradzież/i);
      if (lifestealMatch) {
        return parseInt(lifestealMatch[1], 10) / 100;
      }
    }
  }

  return 0;
}

/**
 * Calculate reflect damage from an equipped Artifact
 * @returns Reflect percentage (0.10 = 10% of incoming damage reflected)
 */
export function getArtifactReflectDamage(artifactId: string | undefined): number {
  if (!artifactId) return 0;

  const artifact = getArtifactById(artifactId);
  if (!artifact) return 0;

  // Check for reflect passive
  for (const effect of artifact.effects) {
    if (effect.type === 'passive' && effect.description) {
      // Parse reflect from description like "Odbija 10% obrażeń" or "15% odbicie obrażeń"
      const reflectMatch = effect.description.match(/(\d+)%\s*(?:odbij|odbicie)/i);
      if (reflectMatch) {
        return parseInt(reflectMatch[1], 10) / 100;
      }
    }
  }

  return 0;
}

/**
 * Get on-hit effect from an equipped Artifact (slow, freeze, burn)
 * @param artifactId - Equipped artifact ID
 * @param rngValue - Random value 0-1 for chance-based effects
 * @returns SkillEffect to apply on projectile hit, or null if no on-hit effect
 */
export function getArtifactOnHitEffect(
  artifactId: string | undefined,
  rngValue: number
): SkillEffect | null {
  if (!artifactId) return null;

  const artifact = getArtifactById(artifactId);
  if (!artifact) return null;

  // Check for on-hit passives
  for (const effect of artifact.effects) {
    if (effect.type === 'passive' && effect.description) {
      const desc = effect.description.toLowerCase();

      // Slow on hit: "15% szansa na spowolnienie" or "slow 25%"
      const slowMatch = desc.match(/(\d+)%\s*(?:szansa\s*na\s*)?(?:spowolnienie|slow)/i);
      if (slowMatch) {
        const chance = parseInt(slowMatch[1], 10) / 100;
        // Only trigger based on chance
        if (rngValue < chance) {
          return {
            type: 'slow',
            percent: 0.25, // 25% slow
            duration: 60,  // 2 seconds at 30Hz
          };
        }
        return null;
      }

      // Freeze on hit: "25% szansa na zamrożenie" or "freeze chance"
      const freezeMatch = desc.match(/(\d+)%\s*(?:szansa\s*na\s*)?(?:zamrożenie|freeze)/i);
      if (freezeMatch) {
        const chance = parseInt(freezeMatch[1], 10) / 100;
        if (rngValue < chance) {
          return {
            type: 'freeze',
            duration: 30, // 1 second at 30Hz
          };
        }
        return null;
      }

      // Burn on hit: "Podpalenie: 3 DMG/s przez 3s" or "burn X DMG"
      const burnMatch = desc.match(/(?:podpalenie|burn)[:\s]*(\d+)\s*(?:dmg|damage|obrażeń)/i);
      if (burnMatch) {
        const dps = parseInt(burnMatch[1], 10);
        return {
          type: 'burn',
          damagePerTick: dps,
          duration: 90, // 3 seconds at 30Hz
        };
      }
    }
  }

  return null;
}
