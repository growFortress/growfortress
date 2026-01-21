import { useState, useEffect } from 'preact/hooks';
import { Button } from '../shared/Button.js';
import {
  showBossRushSetup,
  closeBossRushSetup,
  bossRushLoading,
  userBestDamage,
  userBestBossesKilled,
  formatDamage,
} from '../../state/index.js';
import { BOSS_RUSH_SEQUENCE, BOSS_RUSH_MILESTONES } from '@arcade/sim-core';
import { getBossRushHistory, getBossRushLeaderboard } from '../../api/boss-rush.js';
import { PILLAR_INFO } from '../../state/game.signals.js';
import { useTranslation } from '../../i18n/useTranslation.js';
import styles from './BossRushSetupModal.module.css';

/** Pillar emoji lookup */
const PILLAR_EMOJIS: Record<string, string> = {
  streets: '🏙️',
  science: '🔬',
  mutants: '🧬',
  cosmos: '🌌',
  magic: '✨',
  gods: '⚡',
};

interface BossRushSetupModalProps {
  onStart: () => Promise<void>;
}

export function BossRushSetupModal({ onStart }: BossRushSetupModalProps) {
  const { t } = useTranslation('modals');
  const [showBossSequence, setShowBossSequence] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Load user's best score on mount
  useEffect(() => {
    let cancelled = false;

    if (showBossRushSetup.value) {
      (async () => {
        setLoadingHistory(true);
        try {
          const history = await getBossRushHistory(1);
          if (cancelled) return;

          if (history.sessions.length > 0) {
            let bestDamage = 0;
            let bestBosses = 0;
            for (const session of history.sessions) {
              if (session.totalDamageDealt > bestDamage) {
                bestDamage = session.totalDamageDealt;
                bestBosses = session.bossesKilled;
              }
            }
            userBestDamage.value = bestDamage;
            userBestBossesKilled.value = bestBosses;
          }

          const leaderboard = await getBossRushLeaderboard(undefined, 1);
          if (cancelled) return;

          if (leaderboard.userTotalDamage && leaderboard.userTotalDamage > userBestDamage.value) {
            userBestDamage.value = leaderboard.userTotalDamage;
          }
        } catch (error) {
          console.warn('Failed to load boss rush history:', error);
        } finally {
          if (!cancelled) {
            setLoadingHistory(false);
          }
        }
      })();
    }

    return () => {
      cancelled = true;
    };
  }, [showBossRushSetup.value]);

  async function handleStart() {
    bossRushLoading.value = true;
    try {
      await onStart();
      closeBossRushSetup();
    } catch (error) {
      console.error('Failed to start boss rush:', error);
    } finally {
      bossRushLoading.value = false;
    }
  }

  function handleCancel() {
    closeBossRushSetup();
  }

  if (!showBossRushSetup.value) {
    return null;
  }

  return (
    <div class={styles.overlay}>
      <div class={styles.modal}>
        <div class={styles.header}>
          <span class={styles.icon}>⚔️</span>
          <h2>{t('bossRushSetup.title')}</h2>
          <span class={styles.icon}>⚔️</span>
        </div>

        <p class={styles.description}>
          {t('bossRushSetup.descriptionLine1')}
          <br />
          {t('bossRushSetup.descriptionLine2')}
        </p>

        {/* Best score box */}
        <div class={styles.bestScore}>
          <div class={styles.bestScoreHeader}>{t('bossRushSetup.bestScore')}</div>
          {loadingHistory ? (
            <div class={styles.bestScoreValues}>{t('bossRushSetup.loading')}</div>
          ) : userBestDamage.value > 0 ? (
            <div class={styles.bestScoreValues}>
              <span class={styles.damage}>{t('bossRushSetup.bestDamage', { damage: formatDamage(userBestDamage.value) })}</span>
              <span class={styles.separator}>|</span>
              <span class={styles.bosses}>{t('bossRushSetup.bestBosses', { count: userBestBossesKilled.value })}</span>
            </div>
          ) : (
            <div class={styles.bestScoreValues}>{t('bossRushSetup.noScores')}</div>
          )}
        </div>

        {/* Boss sequence */}
        <div class={styles.sequenceSection}>
          <button
            class={styles.sequenceToggle}
            onClick={() => setShowBossSequence(!showBossSequence)}
          >
            <span>{t('bossRushSetup.sequenceTitle', { count: BOSS_RUSH_SEQUENCE.length })}</span>
            <span class={styles.chevron}>{showBossSequence ? '▲' : '▼'}</span>
          </button>

          {showBossSequence && (
            <div class={styles.sequenceList}>
              {BOSS_RUSH_SEQUENCE.map((boss, index) => (
                <div key={boss.bossType} class={styles.bossItem}>
                  <span class={styles.bossNumber}>{index + 1}.</span>
                  <span class={styles.bossEmoji}>{PILLAR_EMOJIS[boss.pillarId] || '👹'}</span>
                  <span class={styles.bossName}>{boss.name}</span>
                  <span class={styles.bossPillar}>
                    ({PILLAR_INFO[boss.pillarId]?.name || boss.pillarId})
                  </span>
                </div>
              ))}
              <div class={styles.cycleNote}>
                {t('bossRushSetup.cycleNote')}
              </div>
            </div>
          )}
        </div>

        {/* Milestones info */}
        <div class={styles.milestonesSection}>
          <div class={styles.milestonesHeader}>{t('bossRushSetup.milestonesTitle')}</div>
          <div class={styles.milestonesList}>
            {BOSS_RUSH_MILESTONES.slice(0, 3).map((milestone) => (
              <div key={milestone.bossCount} class={styles.milestoneItem}>
                <span class={styles.milestoneCount}>{t('bossRushSetup.milestoneCount', { count: milestone.bossCount })}</span>
                <span class={styles.milestoneReward}>
                  {milestone.materials.map((m) => m.id.replace('boss_', '').replace('_', ' ')).join(', ')}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Buttons */}
        <div class={styles.buttons}>
          <Button variant="secondary" onClick={handleCancel}>
            {t('bossRushSetup.cancel')}
          </Button>
          <Button
            variant="skill"
            onClick={handleStart}
            disabled={bossRushLoading.value}
          >
            {bossRushLoading.value ? t('bossRushSetup.loading') : t('bossRushSetup.start')}
          </Button>
        </div>
      </div>
    </div>
  );
}
