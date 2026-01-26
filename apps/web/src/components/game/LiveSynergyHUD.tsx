/**
 * Live Synergy HUD
 *
 * Shows active synergies during gameplay with live tooltips
 * explaining why DPS is increasing.
 */

import type { JSX } from 'preact';
import { useCallback } from 'preact/hooks';
import {
  activeTagSynergies,
  almostActiveSynergies,
  dpsBreakdown,
  liveSynergyPanelExpanded,
  toggleLiveSynergyPanel,
  hoveredSynergyId,
  setHoveredSynergy,
  totalDamageBonus,
  totalAttackSpeedBonus,
  totalCritBonus,
  activeSynergyCount,
  showSynergies,
  synergyShowcaseMode,
} from '../../state/index.js';
import { getTagById, getHeroById, getTurretById } from '@arcade/sim-core';
import { useTranslation } from '../../i18n/useTranslation.js';
import styles from './LiveSynergyHUD.module.css';

export function LiveSynergyHUD() {
  const { t } = useTranslation(['common', 'data']);

  const isExpanded = liveSynergyPanelExpanded.value;
  const active = activeTagSynergies.value;
  const almostActive = almostActiveSynergies.value;
  const breakdown = dpsBreakdown.value;
  const hovered = hoveredSynergyId.value;
  const isShowcaseMode = synergyShowcaseMode.value;

  // Don't show during idle
  if (!showSynergies.value) return null;

  // Don't show if no synergies (unless in showcase mode - show anyway to highlight almost-active)
  if (active.length === 0 && almostActive.length === 0 && !isShowcaseMode) return null;

  const handleToggle = useCallback(() => {
    toggleLiveSynergyPanel();
  }, []);

  const handleMouseEnter = useCallback((id: string) => {
    setHoveredSynergy(id);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredSynergy(null);
  }, []);

  // Get contributor name
  const getContributorName = (type: 'hero' | 'turret' | 'perk', id: string): string => {
    if (type === 'hero') {
      const hero = getHeroById(id);
      return hero ? t(`data:heroes.${id}.name`, { defaultValue: hero.name }) : id;
    }
    if (type === 'turret') {
      const turret = getTurretById(id);
      return turret ? t(`data:turrets.${id}.name`, { defaultValue: turret.name }) : id;
    }
    return id;
  };

  // Build container class with showcase mode
  const containerClass = [
    styles.container,
    isExpanded ? styles.expanded : '',
    isShowcaseMode ? styles.showcase : '',
  ].filter(Boolean).join(' ');

  return (
    <div class={containerClass}>
      {/* Showcase mode banner */}
      {isShowcaseMode && (
        <div class={styles.showcaseBanner}>
          {t('liveSynergy.showcaseBanner', { defaultValue: 'Synergy Boost Active!' })}
        </div>
      )}

      {/* Collapsed view - summary bar */}
      <div class={styles.summaryBar} onClick={handleToggle}>
        <div class={styles.summaryLeft}>
          <span class={styles.synergyIcon}>⚡</span>
          <span class={styles.synergyCount}>{activeSynergyCount.value}</span>
          <span class={styles.synergyLabel}>
            {t('liveSynergy.activeSynergies', { defaultValue: 'Synergies' })}
          </span>
        </div>

        <div class={styles.summaryStats}>
          {totalDamageBonus.value > 0 && (
            <span class={styles.statBadge} style={{ '--stat-color': '#ff6b6b' } as JSX.CSSProperties}>
              +{Math.round(totalDamageBonus.value)}% DMG
            </span>
          )}
          {totalAttackSpeedBonus.value > 0 && (
            <span class={styles.statBadge} style={{ '--stat-color': '#4ecdc4' } as JSX.CSSProperties}>
              +{Math.round(totalAttackSpeedBonus.value)}% AS
            </span>
          )}
          {totalCritBonus.value > 0 && (
            <span class={styles.statBadge} style={{ '--stat-color': '#ffd700' } as JSX.CSSProperties}>
              +{Math.round(totalCritBonus.value)}% Crit
            </span>
          )}
        </div>

        <button class={styles.expandButton}>
          {isExpanded ? '▲' : '▼'}
        </button>
      </div>

      {/* Expanded view - full synergy list */}
      {isExpanded && (
        <div class={styles.expandedContent}>
          {/* Active Synergies */}
          {active.length > 0 && (
            <div class={styles.section}>
              <div class={styles.sectionHeader}>
                ✨ {t('liveSynergy.active', { defaultValue: 'Active Synergies' })}
              </div>

              <div class={styles.synergyList}>
                {active.map(({ synergy, count, contributors }) => {
                  const tag = getTagById(synergy.tag);
                  const isHovered = hovered === synergy.tag;

                  return (
                    <div
                      key={synergy.tag}
                      class={`${styles.synergyItem} ${isHovered ? styles.hovered : ''}`}
                      onMouseEnter={() => handleMouseEnter(synergy.tag)}
                      onMouseLeave={handleMouseLeave}
                      style={{ '--synergy-color': tag?.color || '#ffd700' } as JSX.CSSProperties}
                    >
                      <div class={styles.synergyHeader}>
                        <span class={styles.tagIcon}>{tag?.icon || '✨'}</span>
                        <span class={styles.synergyName}>
                          {t(synergy.nameKey, { defaultValue: synergy.name })}
                        </span>
                        <span class={styles.synergyCount}>
                          {count}/{synergy.requiredCount}
                        </span>
                      </div>

                      <div class={styles.synergyBonuses}>
                        {synergy.bonuses.map((bonus, i) => (
                          <span key={i} class={styles.bonusChip}>
                            {bonus.isPercent
                              ? `+${Math.round(bonus.value * 100)}%`
                              : `+${bonus.value}`}{' '}
                            {formatStatName(bonus.stat)}
                          </span>
                        ))}
                      </div>

                      {/* Tooltip with contributors */}
                      {isHovered && (
                        <div class={styles.tooltip}>
                          <div class={styles.tooltipTitle}>
                            {t(synergy.descriptionKey, { defaultValue: synergy.description })}
                          </div>
                          <div class={styles.tooltipContributors}>
                            {contributors.map((c, i) => (
                              <span key={i} class={styles.contributor}>
                                {c.type === 'hero' && '🦸'}
                                {c.type === 'turret' && '🗼'}
                                {c.type === 'perk' && '⭐'}
                                {' '}
                                {getContributorName(c.type, c.id)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* DPS Breakdown */}
          {breakdown.length > 0 && (
            <div class={styles.section}>
              <div class={styles.sectionHeader}>
                📊 {t('liveSynergy.dpsBreakdown', { defaultValue: 'DPS Breakdown' })}
              </div>

              <div class={styles.breakdownList}>
                {breakdown.map((entry, i) => (
                  <div
                    key={i}
                    class={styles.breakdownItem}
                    style={{ '--entry-color': entry.color } as JSX.CSSProperties}
                  >
                    <span class={styles.breakdownIcon}>{entry.sourceIcon}</span>
                    <span class={styles.breakdownSource}>{entry.source}</span>
                    <span class={styles.breakdownBonus}>
                      +{entry.value >= 1 ? entry.value : Math.round(entry.value * 100) + '%'}{' '}
                      {entry.bonus}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Almost Active Synergies */}
          {almostActive.length > 0 && (
            <div class={styles.section}>
              <div class={styles.sectionHeader}>
                🔓 {t('liveSynergy.almostActive', { defaultValue: 'Almost Active' })}
              </div>

              <div class={styles.almostActiveList}>
                {almostActive.slice(0, 3).map(({ synergy, count }) => {
                  const tag = getTagById(synergy.tag);
                  const needed = synergy.requiredCount - count;

                  return (
                    <div
                      key={synergy.tag}
                      class={styles.almostActiveItem}
                      style={{ '--synergy-color': tag?.color || '#808080' } as JSX.CSSProperties}
                    >
                      <span class={styles.tagIcon}>{tag?.icon || '✨'}</span>
                      <span class={styles.almostActiveName}>
                        {t(synergy.nameKey, { defaultValue: synergy.name })}
                      </span>
                      <span class={styles.almostActiveNeeded}>
                        {t('liveSynergy.needMore', {
                          count: needed,
                          tag: tag?.name || synergy.tag,
                          defaultValue: `Need ${needed} more ${tag?.name || synergy.tag}`,
                        })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Format stat name for display
 */
function formatStatName(stat: string): string {
  const names: Record<string, string> = {
    damageBonus: 'DMG',
    attackSpeedBonus: 'AS',
    critChance: 'Crit',
    critDamageBonus: 'Crit DMG',
    burnDamageBonus: 'Burn',
    chainCount: 'Chain',
    chainDamagePercent: 'Chain',
    splashDamagePercent: 'Splash',
    splashRadiusBonus: 'Splash Radius',
    executeThreshold: 'Execute',
    maxHpBonus: 'HP',
    incomingDamageReduction: 'DR',
    healBonus: 'Heal',
    cooldownReduction: 'CDR',
    goldBonus: 'Gold',
    slowDuration: 'Slow',
    rangeBonus: 'Range',
    hpRegen: 'Regen',
  };
  return names[stat] || stat;
}
