/**
 * Stat Points Modal
 *
 * Full modal for allocating free stat points earned from gameplay.
 * Includes tabs for Fortress and Hero stats with allocation controls.
 */

import { useState } from 'preact/hooks';
import { signal } from '@preact/signals';
import {
  availableStatPoints,
  totalStatPointsEarned,
  totalStatPointsSpent,
  fortressStatAllocations,
  heroStatAllocations,
  activeHeroes,
} from '../../state/index.js';
import {
  allocateFortressStatPoints,
  allocateHeroStatPoints,
  resetFortressAllocations,
  resetHeroAllocations,
} from '../../api/stat-points.js';
import {
  FORTRESS_STAT_POINT_BONUSES,
  HERO_STAT_POINT_BONUSES,
} from '@arcade/sim-core';
import { Modal } from '../shared/Modal.js';
import { FreeStatRow } from '../shared/FreeStatRow.js';
import { useTranslation } from '../../i18n/useTranslation.js';
import { showErrorToast } from '../../state/ui.signals.js';
import { audioManager } from '../../game/AudioManager.js';
import styles from './StatPointsModal.module.css';

// Modal visibility signal
export const statPointsModalVisible = signal(false);

export function showStatPointsModal() {
  statPointsModalVisible.value = true;
}

export function hideStatPointsModal() {
  statPointsModalVisible.value = false;
}

type Tab = 'fortress' | 'heroes';

// Stat name mapping
const STAT_NAMES: Record<string, { nameKey: string; descKey: string }> = {
  hp: { nameKey: 'statPoints.stats.hp', descKey: 'statPoints.stats.hpDesc' },
  damage: { nameKey: 'statPoints.stats.damage', descKey: 'statPoints.stats.damageDesc' },
  armor: { nameKey: 'statPoints.stats.armor', descKey: 'statPoints.stats.armorDesc' },
  attackSpeed: { nameKey: 'statPoints.stats.attackSpeed', descKey: 'statPoints.stats.attackSpeedDesc' },
  critChance: { nameKey: 'statPoints.stats.critChance', descKey: 'statPoints.stats.critChanceDesc' },
};

export function StatPointsModal() {
  const { t } = useTranslation('game');
  const [activeTab, setActiveTab] = useState<Tab>('fortress');
  const [selectedHeroId, setSelectedHeroId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const visible = statPointsModalVisible.value;
  const available = availableStatPoints.value;
  const earned = totalStatPointsEarned.value;
  const spent = totalStatPointsSpent.value;
  const fortressAllocs = fortressStatAllocations.value;
  const heroAllocs = heroStatAllocations.value;
  const heroes = activeHeroes.value;

  const handleClose = () => {
    hideStatPointsModal();
    setShowResetConfirm(false);
  };

  // Fortress allocation handler
  const handleFortressAllocate = async (stat: string, points: number) => {
    if (points === 0) return;
    setIsLoading(true);
    try {
      if (points > 0) {
        await allocateFortressStatPoints(stat, points);
        audioManager.playSfx('upgrade');
      } else {
        // Negative = deallocate (handled through reset for now)
        // Could implement partial reset in future
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t('statPoints.errors.allocateFailed');
      showErrorToast(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Hero allocation handler
  const handleHeroAllocate = async (heroId: string, stat: string, points: number) => {
    if (points === 0) return;
    setIsLoading(true);
    try {
      if (points > 0) {
        await allocateHeroStatPoints(heroId, stat, points);
        audioManager.playSfx('upgrade');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t('statPoints.errors.allocateFailed');
      showErrorToast(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Reset handler
  const handleReset = async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'fortress') {
        await resetFortressAllocations();
      } else if (selectedHeroId) {
        await resetHeroAllocations(selectedHeroId);
      } else {
        await resetHeroAllocations(); // Reset all heroes
      }
      audioManager.playSfx('cancel');
      setShowResetConfirm(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('statPoints.errors.resetFailed');
      showErrorToast(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Get allocations for selected hero
  const getHeroAllocationsForId = (heroId: string): Record<string, number> => {
    const hero = heroAllocs.find(h => h.heroId === heroId);
    return hero?.allocations ?? {};
  };

  // Calculate total allocated for current tab
  const getCurrentTabTotal = (): number => {
    if (activeTab === 'fortress') {
      return Object.values(fortressAllocs).reduce((sum, v) => sum + v, 0);
    } else if (selectedHeroId) {
      const allocs = getHeroAllocationsForId(selectedHeroId);
      return Object.values(allocs).reduce((sum, v) => sum + v, 0);
    }
    return heroAllocs.reduce(
      (sum, h) => sum + Object.values(h.allocations).reduce((s, v) => s + v, 0),
      0
    );
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} onClose={handleClose} showCloseButton={false} size="large">
      <div class={styles.modal}>
        {/* Header */}
        <div class={styles.header}>
          <h2 class={styles.title}>{t('statPoints.title')}</h2>
          <button class={styles.closeBtn} onClick={handleClose} type="button">
            &times;
          </button>
        </div>

        {/* Points summary */}
        <div class={styles.summary}>
          <div class={styles.summaryItem}>
            <span class={styles.summaryLabel}>{t('statPoints.available')}</span>
            <span class={styles.summaryValue}>{available}</span>
          </div>
          <div class={styles.summaryDivider} />
          <div class={styles.summaryItem}>
            <span class={styles.summaryLabel}>{t('statPoints.earned')}</span>
            <span class={styles.summaryValueSmall}>{earned}</span>
          </div>
          <div class={styles.summaryItem}>
            <span class={styles.summaryLabel}>{t('statPoints.spent')}</span>
            <span class={styles.summaryValueSmall}>{spent}</span>
          </div>
        </div>

        {/* Tabs */}
        <div class={styles.tabs}>
          <button
            class={`${styles.tab} ${activeTab === 'fortress' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('fortress')}
            type="button"
          >
            {t('statPoints.fortress')}
          </button>
          <button
            class={`${styles.tab} ${activeTab === 'heroes' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('heroes')}
            type="button"
          >
            {t('statPoints.heroes')}
          </button>
        </div>

        {/* Content */}
        <div class={styles.content}>
          {activeTab === 'fortress' && (
            <div class={styles.statList}>
              {FORTRESS_STAT_POINT_BONUSES.map(config => {
                const info = STAT_NAMES[config.stat] || {
                  nameKey: `statPoints.stats.${config.stat}`,
                  descKey: `statPoints.stats.${config.stat}Desc`,
                };
                return (
                  <FreeStatRow
                    key={config.stat}
                    stat={config.stat}
                    name={t(info.nameKey)}
                    description={t(info.descKey)}
                    currentAllocation={fortressAllocs[config.stat as keyof typeof fortressAllocs] || 0}
                    maxAllocation={config.maxPoints}
                    bonusPerPoint={config.bonusPerPoint}
                    availablePoints={available}
                    onAllocate={(pts) => handleFortressAllocate(config.stat, pts)}
                    isLoading={isLoading}
                  />
                );
              })}
            </div>
          )}

          {activeTab === 'heroes' && (
            <div class={styles.heroSection}>
              {/* Hero selector */}
              <div class={styles.heroSelector}>
                {heroes.map(hero => (
                  <button
                    key={hero.definitionId}
                    class={`${styles.heroBtn} ${selectedHeroId === hero.definitionId ? styles.heroBtnActive : ''}`}
                    onClick={() => setSelectedHeroId(hero.definitionId)}
                    type="button"
                  >
                    {hero.definitionId}
                  </button>
                ))}
              </div>

              {selectedHeroId ? (
                <div class={styles.statList}>
                  {HERO_STAT_POINT_BONUSES.map(config => {
                    const allocs = getHeroAllocationsForId(selectedHeroId);
                    const info = STAT_NAMES[config.stat] || {
                      nameKey: `statPoints.stats.${config.stat}`,
                      descKey: `statPoints.stats.${config.stat}Desc`,
                    };
                    return (
                      <FreeStatRow
                        key={config.stat}
                        stat={config.stat}
                        name={t(info.nameKey)}
                        description={t(info.descKey)}
                        currentAllocation={allocs[config.stat] || 0}
                        maxAllocation={config.maxPoints}
                        bonusPerPoint={config.bonusPerPoint}
                        availablePoints={available}
                        onAllocate={(pts) => handleHeroAllocate(selectedHeroId, config.stat, pts)}
                        isLoading={isLoading}
                      />
                    );
                  })}
                </div>
              ) : (
                <div class={styles.selectHeroPrompt}>
                  {t('statPoints.selectHero')}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer with reset */}
        <div class={styles.footer}>
          {showResetConfirm ? (
            <div class={styles.resetConfirm}>
              <span class={styles.resetWarning}>{t('statPoints.resetConfirm')}</span>
              <button
                class={styles.resetConfirmBtn}
                onClick={handleReset}
                disabled={isLoading}
                type="button"
              >
                {t('statPoints.resetYes')}
              </button>
              <button
                class={styles.resetCancelBtn}
                onClick={() => setShowResetConfirm(false)}
                type="button"
              >
                {t('statPoints.resetNo')}
              </button>
            </div>
          ) : (
            <button
              class={styles.resetBtn}
              onClick={() => setShowResetConfirm(true)}
              disabled={getCurrentTabTotal() === 0 || isLoading}
              type="button"
            >
              {t('statPoints.reset')}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
