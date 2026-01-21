import { signal } from '@preact/signals';
import { gamePhase, displayGold } from '../../state/index.js';
import { useTranslation } from '../../i18n/useTranslation.js';
import styles from './WallPlacementPanel.module.css';

// Wall type definitions (sci-fi themed)
const WALL_TYPES = {
  basic: {
    nameKey: 'game:wallPlacement.basic.name',
    icon: '🔷',
    hp: 100,
    cost: 50,
    descriptionKey: 'game:wallPlacement.basic.description',
  },
  reinforced: {
    nameKey: 'game:wallPlacement.reinforced.name',
    icon: '🔶',
    hp: 300,
    cost: 150,
    descriptionKey: 'game:wallPlacement.reinforced.description',
  },
  gate: {
    nameKey: 'game:wallPlacement.gate.name',
    icon: '🌀',
    hp: 150,
    cost: 100,
    descriptionKey: 'game:wallPlacement.gate.description',
  },
} as const;

type WallType = keyof typeof WALL_TYPES;

// Selected wall type for placement (null = not placing)
export const selectedWallType = signal<WallType | null>(null);

// Toggle wall placement mode
export function selectWallForPlacement(type: WallType | null): void {
  selectedWallType.value = type;
}

export function clearWallSelection(): void {
  selectedWallType.value = null;
}

export function WallPlacementPanel() {
  const { t } = useTranslation('game');
  const phase = gamePhase.value;
  const gold = displayGold.value;
  const selected = selectedWallType.value;

  // Only show during gameplay
  if (phase === 'idle') {
    return null;
  }

  const handleWallClick = (type: WallType) => {
    const wallDef = WALL_TYPES[type];

    // Check if player can afford it
    if (gold < wallDef.cost) {
      return;
    }

    // Toggle selection
    if (selected === type) {
      clearWallSelection();
    } else {
      selectWallForPlacement(type);
    }
  };

  return (
    <div class={styles.panel}>
      <div class={styles.header}>
        <span class={styles.icon}>⚡</span>
        <span class={styles.title}>{t('wallPlacement.title')}</span>
      </div>

      <div class={styles.wallList}>
        {(Object.keys(WALL_TYPES) as WallType[]).map((type) => {
          const wall = WALL_TYPES[type];
          const canAfford = gold >= wall.cost;
          const isSelected = selected === type;

          return (
            <button
              key={type}
              class={`${styles.wallButton} ${isSelected ? styles.selected : ''} ${!canAfford ? styles.disabled : ''}`}
              onClick={() => handleWallClick(type)}
              disabled={!canAfford}
              title={t('wallPlacement.tooltip', {
                name: t(wall.nameKey),
                description: t(wall.descriptionKey),
                hp: wall.hp,
                cost: wall.cost,
              })}
            >
              <span class={styles.wallIcon}>{wall.icon}</span>
              <div class={styles.wallInfo}>
                <span class={styles.wallName}>{t(wall.nameKey)}</span>
                <span class={styles.wallCost}>
                  <span class={styles.goldIcon}>🪙</span>
                  {wall.cost}
                </span>
              </div>
              {isSelected && <span class={styles.selectedBadge}>✓</span>}
            </button>
          );
        })}
      </div>

      {selected && (
        <div class={styles.hint}>
          {t('wallPlacement.clickMapHint')}
        </div>
      )}
    </div>
  );
}
