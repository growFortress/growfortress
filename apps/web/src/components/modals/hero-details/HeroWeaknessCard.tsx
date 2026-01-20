import type { HeroWeakness } from '@arcade/sim-core';
import styles from './HeroWeaknessCard.module.css';
import cardStyles from './cards.module.css';

interface HeroWeaknessCardProps {
  weaknesses: HeroWeakness[];
}

export function HeroWeaknessCard({ weaknesses }: HeroWeaknessCardProps) {
  if (weaknesses.length === 0) {
    return (
      <div class={`${cardStyles.card} ${styles.weaknessCard}`}>
        <div class={cardStyles.cardHeader}>Słabości</div>
        <div class={styles.noWeaknesses}>
          Brak słabości
        </div>
      </div>
    );
  }

  return (
    <div class={`${cardStyles.card} ${styles.weaknessCard}`}>
      <div class={cardStyles.cardHeader}>Słabości</div>

      <div class={styles.weaknessList}>
        {weaknesses.map((weakness) => (
          <div key={weakness.id} class={cardStyles.weaknessItem}>
            <span class={cardStyles.weaknessIcon}>⚠️</span>
            <div class={cardStyles.weaknessInfo}>
              <span class={cardStyles.weaknessName}>{weakness.name}</span>
              <span class={cardStyles.weaknessDesc}>{weakness.description}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
