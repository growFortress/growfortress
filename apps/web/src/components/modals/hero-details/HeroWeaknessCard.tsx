import type { HeroWeakness } from '@arcade/sim-core';
import { useTranslation } from '../../../i18n/useTranslation.js';
import styles from './HeroWeaknessCard.module.css';
import cardStyles from './cards.module.css';

interface HeroWeaknessCardProps {
  weaknesses: HeroWeakness[];
}

export function HeroWeaknessCard({ weaknesses }: HeroWeaknessCardProps) {
  const { t } = useTranslation(['common', 'data']);
  if (weaknesses.length === 0) {
    return (
      <div class={`${cardStyles.card} ${styles.weaknessCard}`}>
        <div class={cardStyles.cardHeader}>{t('heroDetails.weaknesses')}</div>
        <div class={styles.noWeaknesses}>
          {t('heroDetails.noWeaknesses')}
        </div>
      </div>
    );
  }

  return (
    <div class={`${cardStyles.card} ${styles.weaknessCard}`}>
      <div class={cardStyles.cardHeader}>{t('heroDetails.weaknesses')}</div>

      <div class={styles.weaknessList}>
        {weaknesses.map((weakness) => (
          <div key={weakness.id} class={cardStyles.weaknessItem}>
            <span class={cardStyles.weaknessIcon}>⚠️</span>
            <div class={cardStyles.weaknessInfo}>
              <span class={cardStyles.weaknessName}>
                {t(`data:weaknesses.${weakness.id}.name`, { defaultValue: weakness.name })}
              </span>
              <span class={cardStyles.weaknessDesc}>
                {t(`data:weaknesses.${weakness.id}.description`, { defaultValue: weakness.description })}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
