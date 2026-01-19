import { signal } from '@preact/signals';
import { gamePhase, displayGold } from '../../state/index.js';
import styles from './MilitiaSpawnPanel.module.css';

// Militia type definitions (sci-fi themed)
const MILITIA_TYPES = {
  infantry: {
    name: 'Dron Bojowy',
    icon: '🤖',
    hp: 50,
    damage: 15,
    cost: 30,
    duration: '10s',
    description: 'Dron szturmowy. Blokuje natarcie wroga.',
  },
  archer: {
    name: 'Dron Snajper',
    icon: '🎯',
    hp: 30,
    damage: 20,
    cost: 40,
    duration: '10s',
    description: 'Dron laserowy. Atakuje z dystansu.',
  },
  shield_bearer: {
    name: 'Ciężki Mech',
    icon: '🦾',
    hp: 100,
    damage: 5,
    cost: 60,
    duration: '15s',
    description: 'Opancerzony mech. Wysoka wytrzymałość.',
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
        <span class={styles.title}>Drony</span>
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
              title={`${militia.name}: ${militia.description}\nHP: ${militia.hp} | DMG: ${militia.damage} | Czas: ${militia.duration}`}
            >
              <span class={styles.militiaIcon}>{militia.icon}</span>
              <div class={styles.militiaInfo}>
                <span class={styles.militiaName}>{militia.name}</span>
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
          Kliknij na mapę aby przywołać jednostkę
        </div>
      )}
    </div>
  );
}
