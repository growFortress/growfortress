import { gameState } from '../../state/index.js';
import { useTranslation } from '../../i18n/useTranslation.js';
import styles from './InfinityStones.module.css';

/**
 * Infinity Stones colors and names
 */
const STONE_INFO: Record<string, { nameKey: string; color: string; glowColor: string }> = {
  power: { nameKey: 'game:infinityStones.stones.power', color: '#9932cc', glowColor: '#da70d6' },
  space: { nameKey: 'game:infinityStones.stones.space', color: '#0000ff', glowColor: '#87ceeb' },
  time: { nameKey: 'game:infinityStones.stones.time', color: '#00ff00', glowColor: '#98fb98' },
  reality: { nameKey: 'game:infinityStones.stones.reality', color: '#ff0000', glowColor: '#ff6347' },
  soul: { nameKey: 'game:infinityStones.stones.soul', color: '#ffa500', glowColor: '#ffd700' },
  mind: { nameKey: 'game:infinityStones.stones.mind', color: '#ffff00', glowColor: '#fffacd' },
};

const STONE_ORDER = ['power', 'space', 'reality', 'soul', 'time', 'mind'] as const;

interface InfinityStonesProps {
  onSnapClick?: () => void;
}

/**
 * Display collected Infinity Stones and fragments
 */
export function InfinityStones({ onSnapClick }: InfinityStonesProps) {
  const { t } = useTranslation('game');
  const state = gameState.value;
  if (!state) return null;

  const { collectedStones, infinityStoneFragments, gauntletState } = state;

  // Check if any stones or fragments collected
  const hasAnyProgress = collectedStones.length > 0 || infinityStoneFragments.length > 0;
  if (!hasAnyProgress) return null;

  return (
    <div class={styles.container}>
      <div class={styles.header}>
        <span class={styles.title}>{t('infinityStones.title')}</span>
        {gauntletState?.isAssembled && (
          <span class={styles.gauntletBadge}>{t('infinityStones.gauntletReady')}</span>
        )}
      </div>

      <div class={styles.stonesRow}>
        {STONE_ORDER.map((stoneType) => {
          const info = STONE_INFO[stoneType];
          const stoneName = t(info.nameKey);
          const isCollected = collectedStones.includes(stoneType);
          const fragment = infinityStoneFragments.find((f) => f.stoneType === stoneType);
          const fragmentCount = fragment?.count ?? 0;

          return (
            <div
              key={stoneType}
              class={`${styles.stone} ${isCollected ? styles.collected : ''}`}
              style={{
                '--stone-color': info.color,
                '--stone-glow': info.glowColor,
              }}
              title={`${stoneName}${isCollected ? t('infinityStones.collected') : fragmentCount > 0 ? t('infinityStones.fragments', { count: fragmentCount }) : ''}`}
            >
              <div class={styles.stoneGem} />
              {!isCollected && fragmentCount > 0 && (
                <div class={styles.fragmentCount}>{fragmentCount}/5</div>
              )}
            </div>
          );
        })}
      </div>

      {gauntletState?.isAssembled && (
        <div class={styles.snapSection}>
          {gauntletState.annihilationCooldown > 0 ? (
            <span class={styles.cooldown}>
              {t('infinityStones.annihilationCooldown', { count: gauntletState.annihilationCooldown })}
            </span>
          ) : (
            <button
              class={styles.snapButton}
              onClick={onSnapClick}
              disabled={state.enemyCount === 0}
              title={t('infinityStones.annihilationTooltip')}
            >
              {t('infinityStones.annihilationWave')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
