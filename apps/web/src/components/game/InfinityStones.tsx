import { gameState } from '../../state/index.js';
import styles from './InfinityStones.module.css';

/**
 * Infinity Stones colors and names
 */
const STONE_INFO: Record<string, { name: string; color: string; glowColor: string }> = {
  power: { name: 'Power', color: '#9932cc', glowColor: '#da70d6' },
  space: { name: 'Space', color: '#0000ff', glowColor: '#87ceeb' },
  time: { name: 'Time', color: '#00ff00', glowColor: '#98fb98' },
  reality: { name: 'Reality', color: '#ff0000', glowColor: '#ff6347' },
  soul: { name: 'Soul', color: '#ffa500', glowColor: '#ffd700' },
  mind: { name: 'Mind', color: '#ffff00', glowColor: '#fffacd' },
};

const STONE_ORDER = ['power', 'space', 'reality', 'soul', 'time', 'mind'] as const;

interface InfinityStonesProps {
  onSnapClick?: () => void;
}

/**
 * Display collected Infinity Stones and fragments
 */
export function InfinityStones({ onSnapClick }: InfinityStonesProps) {
  const state = gameState.value;
  if (!state) return null;

  const { collectedStones, infinityStoneFragments, gauntletState } = state;

  // Check if any stones or fragments collected
  const hasAnyProgress = collectedStones.length > 0 || infinityStoneFragments.length > 0;
  if (!hasAnyProgress) return null;

  return (
    <div class={styles.container}>
      <div class={styles.header}>
        <span class={styles.title}>Infinity Stones</span>
        {gauntletState?.isAssembled && (
          <span class={styles.gauntletBadge}>GAUNTLET READY</span>
        )}
      </div>

      <div class={styles.stonesRow}>
        {STONE_ORDER.map((stoneType) => {
          const info = STONE_INFO[stoneType];
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
              title={`${info.name} Stone${isCollected ? ' (Collected)' : fragmentCount > 0 ? ` (${fragmentCount}/5 fragments)` : ''}`}
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
          {gauntletState.snapCooldown > 0 ? (
            <span class={styles.cooldown}>
              SNAP cooldown: {gauntletState.snapCooldown} waves
            </span>
          ) : (
            <button
              class={styles.snapButton}
              onClick={onSnapClick}
              disabled={state.enemyCount === 0}
              title="Activate SNAP - eliminates 50% of all enemies"
            >
              SNAP
            </button>
          )}
        </div>
      )}
    </div>
  );
}
