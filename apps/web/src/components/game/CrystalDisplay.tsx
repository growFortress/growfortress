import { gameState } from '../../state/index.js';
import { useTranslation } from '../../i18n/useTranslation.js';
import styles from './CrystalDisplay.module.css';

/**
 * Ancient Crystal colors and names (Starożytne Kryształy)
 */
const CRYSTAL_INFO: Record<string, { nameKey: string; color: string; glowColor: string }> = {
  power: { nameKey: 'game:crystalDisplay.crystals.power', color: '#9932cc', glowColor: '#da70d6' },
  void: { nameKey: 'game:crystalDisplay.crystals.void', color: '#0000ff', glowColor: '#87ceeb' },
  chrono: { nameKey: 'game:crystalDisplay.crystals.chrono', color: '#00ff00', glowColor: '#98fb98' },
  matter: { nameKey: 'game:crystalDisplay.crystals.matter', color: '#ff0000', glowColor: '#ff6347' },
  vitae: { nameKey: 'game:crystalDisplay.crystals.vitae', color: '#ffa500', glowColor: '#ffd700' },
  psi: { nameKey: 'game:crystalDisplay.crystals.psi', color: '#ffff00', glowColor: '#fffacd' },
};

// Legacy mapping for backwards compatibility
const LEGACY_CRYSTAL_MAP: Record<string, string> = {
  space: 'void',
  time: 'chrono',
  reality: 'matter',
  soul: 'vitae',
  mind: 'psi',
};

const CRYSTAL_ORDER = ['power', 'void', 'matter', 'vitae', 'chrono', 'psi'] as const;

interface CrystalDisplayProps {
  onAnnihilationClick?: () => void;
}

/**
 * Display collected Ancient Crystals (Starożytne Kryształy) and fragments
 */
export function CrystalDisplay({ onAnnihilationClick }: CrystalDisplayProps) {
  const { t } = useTranslation('game');
  const state = gameState.value;
  if (!state) return null;

  const { collectedStones, infinityStoneFragments, gauntletState } = state;

  // Map legacy stone names to crystal names
  const collectedCrystals = collectedStones.map((s) => LEGACY_CRYSTAL_MAP[s] || s);

  // Check if any crystals or fragments collected
  const hasAnyProgress = collectedCrystals.length > 0 || infinityStoneFragments.length > 0;
  if (!hasAnyProgress) return null;

  return (
    <div class={styles.container}>
      <div class={styles.header}>
        <span class={styles.title}>{t('crystalDisplay.ancientCrystals')}</span>
        {gauntletState?.isAssembled && (
          <span class={styles.matrixBadge}>{t('crystalDisplay.matrixActive')}</span>
        )}
      </div>

      <div class={styles.crystalsRow}>
        {CRYSTAL_ORDER.map((crystalType) => {
          const info = CRYSTAL_INFO[crystalType];
          const crystalName = t(info.nameKey);
          const isCollected = collectedCrystals.includes(crystalType);
          // Check both new and legacy fragment names
          const fragment = infinityStoneFragments.find((f) => {
            const stoneType = f.stoneType ?? f.crystalType;
            if (!stoneType) return false;
            const mappedType = LEGACY_CRYSTAL_MAP[stoneType] || stoneType;
            return mappedType === crystalType;
          });
          const fragmentCount = fragment?.count ?? 0;

          return (
            <div
              key={crystalType}
              class={`${styles.crystal} ${isCollected ? styles.collected : ''}`}
              style={{
                '--crystal-color': info.color,
                '--crystal-glow': info.glowColor,
              }}
              title={`${crystalName}${isCollected ? t('crystalDisplay.collected') : fragmentCount > 0 ? t('crystalDisplay.fragments', { count: fragmentCount }) : ''}`}
            >
              <div class={styles.crystalGem} />
              {!isCollected && fragmentCount > 0 && (
                <div class={styles.fragmentCount}>{fragmentCount}/10</div>
              )}
            </div>
          );
        })}
      </div>

      {gauntletState?.isAssembled && (
        <div class={styles.annihilationSection}>
          {gauntletState.annihilationCooldown > 0 ? (
            <span class={styles.cooldown}>
              {t('crystalDisplay.annihilationCooldown', { count: gauntletState.annihilationCooldown })}
            </span>
          ) : (
            <button
              class={styles.annihilationButton}
              onClick={onAnnihilationClick}
              disabled={state.enemyCount === 0}
              title={t('crystalDisplay.annihilationTooltip')}
            >
              {t('crystalDisplay.annihilationWave')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Re-export with legacy name for backwards compatibility
export { CrystalDisplay as InfinityStones };
