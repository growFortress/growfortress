import { signal } from '@preact/signals';
import { gamePhase, displayGold } from '../../state/index.js';
import { useTranslation } from '../../i18n/useTranslation.js';
import styles from './MilitiaSpawnPanel.module.css';

// Militia type definitions (sci-fi themed)
const MILITIA_TYPES = {
  infantry: {
    nameKey: 'game:militia.infantry.name',
    icon: '🤖',
    hp: 50,
    damage: 15,
    cost: 10,  // Reduced from 30
    durationSeconds: 10,
    descriptionKey: 'game:militia.infantry.description',
  },
  archer: {
    nameKey: 'game:militia.archer.name',
    icon: '🎯',
    hp: 30,
    damage: 20,
    cost: 15,  // Reduced from 40
    durationSeconds: 10,
    descriptionKey: 'game:militia.archer.description',
  },
  shield_bearer: {
    nameKey: 'game:militia.shieldBearer.name',
    icon: '🦾',
    hp: 100,
    damage: 5,
    cost: 20,  // Reduced from 60
    durationSeconds: 15,
    descriptionKey: 'game:militia.shieldBearer.description',
  },
} as const;

type MilitiaType = keyof typeof MILITIA_TYPES;

// Selected militia type for spawning (null = not spawning)
export const selectedMilitiaType = signal<MilitiaType | null>(null);

// Toggle militia spawn mode
export function selectMilitiaForSpawn(type: MilitiaType | null): void {
  selectedMilitiaType.value = type;
}

export function clearMilitiaSelection(): void {
  selectedMilitiaType.value = null;
}

export function MilitiaSpawnPanel() {
  const { t } = useTranslation('game');
  const phase = gamePhase.value;
  const gold = displayGold.value;
  const selected = selectedMilitiaType.value;

  // Only show during gameplay
  if (phase === 'idle') {
    return null;
  }

  const handleMilitiaClick = (type: MilitiaType) => {
    const militiaDef = MILITIA_TYPES[type];

    // Check if player can afford it
    if (gold < militiaDef.cost) {
      return;
    }

    // Toggle selection
    if (selected === type) {
      clearMilitiaSelection();
    } else {
      selectMilitiaForSpawn(type);
    }
  };

  return (
    <div class={styles.panel}>
      <div class={styles.header}>
        <span class={styles.icon}>🤖</span>
        <span class={styles.title}>{t('militia.title')}</span>
      </div>

      <div class={styles.militiaList}>
        {(Object.keys(MILITIA_TYPES) as MilitiaType[]).map((type) => {
          const militia = MILITIA_TYPES[type];
          const canAfford = gold >= militia.cost;
          const isSelected = selected === type;

          return (
            <button
              key={type}
              class={`${styles.militiaButton} ${isSelected ? styles.selected : ''} ${!canAfford ? styles.disabled : ''}`}
              onClick={() => handleMilitiaClick(type)}
              disabled={!canAfford}
              title={t(militia.descriptionKey)}
            >
              <span class={styles.militiaIcon}>{militia.icon}</span>
              <div class={styles.militiaInfo}>
                <span class={styles.militiaName}>{t(militia.nameKey)}</span>
                <div class={styles.militiaStats}>
                  <span class={`${styles.stat} ${styles.statHp}`}>
                    ♥ {militia.hp}
                  </span>
                  <span class={`${styles.stat} ${styles.statDmg}`}>
                    ⚔ {militia.damage}
                  </span>
                </div>
                <span class={styles.militiaCost}>
                  <span class={styles.goldIcon}>🪙</span>
                  {militia.cost}
                </span>
              </div>
              {isSelected && <span class={styles.selectedBadge}>✓</span>}
            </button>
          );
        })}
      </div>

      {selected && (
        <div class={styles.hint}>
          <span class={styles.hintIcon}>👆</span>
          {t('militia.clickMapHint')}
        </div>
      )}
    </div>
  );
}
