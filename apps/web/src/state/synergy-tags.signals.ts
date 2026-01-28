/**
 * Live Synergy Tags Signals
 *
 * Tracks active tag synergies in real-time during gameplay.
 * Shows breakdown of all bonuses and why DPS is increasing.
 */

import { signal, computed } from '@preact/signals';
import {
  calculateActiveTagSynergies,
  getHeroTags,
  getTurretTags,
  getTagById,
  type ActiveTagSynergy,
  type SynergyTag,
} from '@arcade/sim-core';
import { activeHeroes, activeTurrets } from './fortress.signals.js';
import { gamePhase } from './game.signals.js';

// ============================================================================
// ACTIVE PERKS (from profile)
// ============================================================================

/**
 * Active perk IDs from player's transcendence build
 */
export const activePerks = signal<string[]>([]);

// ============================================================================
// COMPUTED SYNERGIES
// ============================================================================

/**
 * Current hero IDs for synergy calculation
 */
const currentHeroIds = computed(() =>
  activeHeroes.value.map(h => h.definitionId)
);

/**
 * Current turret IDs for synergy calculation
 */
const currentTurretIds = computed(() =>
  activeTurrets.value.map(t => t.definitionId)
);

/**
 * All calculated tag synergies (active and inactive)
 */
export const allTagSynergies = computed<ActiveTagSynergy[]>(() => {
  return calculateActiveTagSynergies(
    currentHeroIds.value,
    currentTurretIds.value,
    activePerks.value
  );
});

/**
 * Only active tag synergies (for display)
 * Reuses allTagSynergies to avoid duplicate computation
 */
export const activeTagSynergies = computed<ActiveTagSynergy[]>(() => {
  return allTagSynergies.value.filter(s => s.isActive);
});

/**
 * Synergies that are almost active (need 1 more unit)
 * Reuses allTagSynergies to avoid duplicate computation
 */
export const almostActiveSynergies = computed<ActiveTagSynergy[]>(() => {
  return allTagSynergies.value.filter(
    s => !s.isActive && s.count === s.synergy.requiredCount - 1
  );
});

/**
 * Total bonuses from all active synergies
 * Reuses activeTagSynergies to avoid duplicate computation
 */
export const totalSynergyBonuses = computed<Record<string, number>>(() => {
  const bonuses: Record<string, number> = {};
  for (const { synergy } of activeTagSynergies.value) {
    for (const bonus of synergy.bonuses) {
      bonuses[bonus.stat] = (bonuses[bonus.stat] || 0) + bonus.value;
    }
  }
  return bonuses;
});

// ============================================================================
// DPS BREAKDOWN
// ============================================================================

/**
 * Formatted DPS bonus breakdown for UI
 */
export interface DPSBreakdownEntry {
  source: string;
  sourceIcon: string;
  bonus: string;
  value: number;
  color: string;
}

/**
 * Calculate DPS breakdown from all active synergies
 */
export const dpsBreakdown = computed<DPSBreakdownEntry[]>(() => {
  const breakdown: DPSBreakdownEntry[] = [];
  const active = activeTagSynergies.value;

  for (const { synergy } of active) {
    const tag = getTagById(synergy.tag);

    for (const bonus of synergy.bonuses) {
      // Only show damage-related bonuses
      if (
        bonus.stat === 'damageBonus' ||
        bonus.stat === 'attackSpeedBonus' ||
        bonus.stat === 'critChance' ||
        bonus.stat === 'critDamageBonus' ||
        bonus.stat === 'burnDamageBonus' ||
        bonus.stat === 'chainCount' ||
        bonus.stat === 'chainDamagePercent' ||
        bonus.stat === 'splashDamagePercent' ||
        bonus.stat === 'executeThreshold'
      ) {
        breakdown.push({
          source: synergy.name,
          sourceIcon: tag?.icon || '✨',
          bonus: formatBonusStat(bonus.stat),
          value: bonus.value,
          color: tag?.color || '#ffd700',
        });
      }
    }
  }

  return breakdown;
});

/**
 * Format bonus stat name for display
 */
function formatBonusStat(stat: string): string {
  const statNames: Record<string, string> = {
    damageBonus: 'DMG',
    attackSpeedBonus: 'AS',
    critChance: 'Crit',
    critDamageBonus: 'Crit DMG',
    burnDamageBonus: 'Burn',
    chainCount: 'Chain',
    chainDamagePercent: 'Chain DMG',
    splashDamagePercent: 'Splash',
    executeThreshold: 'Execute',
    maxHpBonus: 'HP',
    incomingDamageReduction: 'DR',
    healBonus: 'Heal',
    cooldownReduction: 'CDR',
    goldBonus: 'Gold',
  };
  return statNames[stat] || stat;
}

// ============================================================================
// UI STATE
// ============================================================================

/**
 * Whether the live synergy panel is expanded
 */
export const liveSynergyPanelExpanded = signal(false);

/**
 * Toggle the synergy panel expansion
 */
export function toggleLiveSynergyPanel(): void {
  liveSynergyPanelExpanded.value = !liveSynergyPanelExpanded.value;
}

/**
 * Currently hovered synergy for tooltip
 */
export const hoveredSynergyId = signal<string | null>(null);

/**
 * Set hovered synergy
 */
export function setHoveredSynergy(id: string | null): void {
  hoveredSynergyId.value = id;
}

/**
 * Showcase mode for directed wave 1 experience
 * When active, the synergy panel is auto-expanded and has pulsing border
 */
export const synergyShowcaseMode = signal(false);

/**
 * Timestamp when showcase mode was activated (for animation timing)
 */
export const showcaseStartTime = signal(0);

/**
 * Enable showcase mode for the directed wave experience
 */
export function enableSynergyShowcase(): void {
  synergyShowcaseMode.value = true;
  showcaseStartTime.value = Date.now();
  liveSynergyPanelExpanded.value = true; // Auto-expand when showcase starts
}

/**
 * Disable showcase mode
 */
export function disableSynergyShowcase(): void {
  synergyShowcaseMode.value = false;
  showcaseStartTime.value = 0;
}

// ============================================================================
// SUMMARY STATS
// ============================================================================

/**
 * Total damage bonus from all synergies
 */
export const totalDamageBonus = computed(() => {
  const bonuses = totalSynergyBonuses.value;
  return (bonuses['damageBonus'] || 0) * 100;
});

/**
 * Total attack speed bonus from all synergies
 */
export const totalAttackSpeedBonus = computed(() => {
  const bonuses = totalSynergyBonuses.value;
  return (bonuses['attackSpeedBonus'] || 0) * 100;
});

/**
 * Total crit chance bonus from all synergies
 */
export const totalCritBonus = computed(() => {
  const bonuses = totalSynergyBonuses.value;
  return (bonuses['critChance'] || 0) * 100;
});

/**
 * Count of active synergies
 */
export const activeSynergyCount = computed(() => activeTagSynergies.value.length);

/**
 * Whether synergies should be shown (only during combat)
 */
export const showSynergies = computed(() =>
  gamePhase.value === 'playing' || gamePhase.value === 'boss_rush'
);

// ============================================================================
// HERO TAG DISPLAY
// ============================================================================

/**
 * Get all tags for a hero with their definitions
 */
export function getHeroTagsWithDefs(heroId: string): Array<{
  tag: SynergyTag;
  name: string;
  icon: string;
  color: string;
}> {
  const tags = getHeroTags(heroId);
  return tags.map(tag => {
    const def = getTagById(tag);
    return {
      tag,
      name: def?.name || tag,
      icon: def?.icon || '✨',
      color: def?.color || '#808080',
    };
  });
}

/**
 * Get all tags for a turret with their definitions
 */
export function getTurretTagsWithDefs(turretId: string): Array<{
  tag: SynergyTag;
  name: string;
  icon: string;
  color: string;
}> {
  const tags = getTurretTags(turretId);
  return tags.map(tag => {
    const def = getTagById(tag);
    return {
      tag,
      name: def?.name || tag,
      icon: def?.icon || '✨',
      color: def?.color || '#808080',
    };
  });
}

// ============================================================================
// RESET
// ============================================================================

/**
 * Reset synergy state
 */
export function resetSynergyTagsState(): void {
  liveSynergyPanelExpanded.value = false;
  hoveredSynergyId.value = null;
}
