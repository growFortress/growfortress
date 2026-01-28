import type { JSX } from 'preact';
import { useRef, useEffect } from 'preact/hooks';
import { activeSynergies, selectedFortressClass, activeHeroes, showSynergyToast } from '../../state/index.js';
import { getActiveSynergiesForHeroes, getHeroById } from '@arcade/sim-core';
import { useTranslation } from '../../i18n/useTranslation.js';
import { SpeedIcon } from '../icons/index.js';
import styles from './SynergyPanel.module.css';

// Class colors
const CLASS_COLORS: Record<string, string> = {
  natural: '#228b22',
  ice: '#00bfff',
  fire: '#ff4500',
  lightning: '#9932cc',
  poison: '#9acd32',
  magic: '#8a2be2',
  tech: '#00f0ff',
};

// Class icons
const CLASS_ICONS: Record<string, string> = {
  natural: '🌿',
  ice: '❄️',
  fire: '🔥',
  lightning: '⚡',
  poison: '☠️',
  magic: '✨',
  tech: '🔧',
};

interface SynergyPanelProps {
  compact?: boolean;
}

export function SynergyPanel({ compact = false }: SynergyPanelProps) {
  const { t } = useTranslation(['common', 'data']);
  const fortressClass = selectedFortressClass.value;
  const synergies = activeSynergies.value;
  const heroes = activeHeroes.value;

  if (!fortressClass) return null;

  const classColor = CLASS_COLORS[fortressClass];
  const classIcon = CLASS_ICONS[fortressClass];

  // Get hero pair/trio synergies
  const heroIds = heroes.map(h => h.definitionId);
  const { active: activeHeroSynergies, almostActive } = getActiveSynergiesForHeroes(heroIds);

  // Track previous active synergies to detect new activations
  const prevActiveIds = useRef<Set<string>>(new Set());

  // Detect newly activated synergies and show toasts
  useEffect(() => {
    const currentActiveIds = new Set(activeHeroSynergies.map(s => s.id));

    // Find synergies that just became active
    for (const synergy of activeHeroSynergies) {
      if (!prevActiveIds.current.has(synergy.id)) {
        // New synergy activated - show toast
        const type = synergy.heroes.length >= 3 ? 'trio' : 'pair';
        showSynergyToast(synergy.id, synergy.name, synergy.bonuses, type);
      }
    }

    // Update previous state
    prevActiveIds.current = currentActiveIds;
  }, [activeHeroSynergies]);

  // Helper to get hero name
  const getHeroName = (id: string): string => {
    const heroDef = getHeroById(id);
    return heroDef ? t(`data:heroes.${id}.name`, { defaultValue: heroDef.name }) : id;
  };

  return (
    <div
      class={`${styles.synergyPanel} ${compact ? styles.compact : ''}`}
      style={{ '--class-color': classColor } as JSX.CSSProperties}
    >
      {/* Current class indicator - only show in full mode, compact uses FortressClassBadge */}
      {!compact && (
        <div class={styles.classIndicator}>
          <span class={styles.classIcon}>{classIcon}</span>
          <span class={styles.className}>{fortressClass}</span>
        </div>
      )}

      {/* Fortress Synergy list */}
      {synergies.length > 0 ? (
        <div class={styles.synergyList}>
          {synergies.map((synergy, index) => (
            <div
              key={index}
              class={`${styles.synergyItem} ${synergy.active ? styles.active : styles.inactive}`}
            >
              <div class={styles.synergyHeader}>
                <span class={styles.synergyIcon}>
                  {synergy.type === 'hero-fortress' && '🦸'}
                  {synergy.type === 'turret-fortress' && '🗼'}
                  {synergy.type === 'full' && '⭐'}
                </span>
                {!compact && (
                  <span class={styles.synergyName}>{synergy.description}</span>
                )}
              </div>

              {!compact && (
                <div class={styles.bonusList}>
                  {synergy.bonuses.map((bonus, i) => (
                    <span key={i} class={styles.bonus}>{bonus}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div class={styles.noSynergy}>
          <span class={styles.noSynergyText}>
            {compact ? 'No synergy' : 'Match hero/turret classes for bonuses'}
          </span>
        </div>
      )}

      {/* Active Hero Pair/Trio Synergies */}
      {!compact && activeHeroSynergies.length > 0 && (
        <div class={styles.heroSynergiesSection}>
          <div class={styles.heroSynergiesHeader}>
            <SpeedIcon size={18} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
            {t('synergyPanel.activeHeroSynergies', { defaultValue: 'Hero Combos' })}
          </div>
          {activeHeroSynergies.map(synergy => (
            <div key={synergy.id} class={styles.heroSynergyActive}>
              <span class={styles.heroSynergyName}>
                {t(synergy.nameKey, { defaultValue: synergy.name })}
              </span>
              <div class={styles.heroSynergyBonuses}>
                {synergy.bonuses.map((bonus, i) => (
                  <span key={i} class={styles.heroSynergyBonus}>{bonus}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Almost Active Hero Synergies (1 hero away) */}
      {!compact && almostActive.length > 0 && (
        <div class={styles.almostActiveSection}>
          <div class={styles.almostActiveHeader}>
            🔓 {t('synergyPanel.almostActive', { defaultValue: 'Almost Active' })}
          </div>
          {almostActive.slice(0, 2).map(({ synergy, missing }) => (
            <div key={synergy.id} class={styles.almostActiveItem}>
              <span class={styles.almostActiveName}>
                {t(synergy.nameKey, { defaultValue: synergy.name })}
              </span>
              <span class={styles.almostActiveMissing}>
                {t('synergyPanel.needHero', {
                  hero: missing.map(id => getHeroName(id)).join(', '),
                  defaultValue: `Need: ${missing.map(id => getHeroName(id)).join(', ')}`
                })}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Synergy tips */}
      {!compact && synergies.length < 3 && almostActive.length === 0 && (
        <div class={styles.tips}>
          {synergies.every(s => s.type !== 'hero-fortress') && (
            <div class={styles.tip}>
              Deploy {fortressClass} heroes for +30% DMG
            </div>
          )}
          {synergies.every(s => s.type !== 'turret-fortress') && (
            <div class={styles.tip}>
              Build {fortressClass} turrets for +25% AS
            </div>
          )}
        </div>
      )}
    </div>
  );
}
