import type { HeroWeakness } from '@arcade/sim-core';
import styles from './HeroWeaknessCard.module.css';
import cardStyles from './cards.module.css';
import { useTranslation } from '../../../i18n/useTranslation.js';

interface HeroWeaknessCardProps {
  heroId: string;
  weaknesses: HeroWeakness[];
}

export function HeroWeaknessCard({ heroId, weaknesses }: HeroWeaknessCardProps) {
  const { t } = useTranslation(['common', 'game']);

  if (weaknesses.length === 0) {
    return (
      <div class={`${cardStyles.card} ${styles.weaknessCard}`}>
        <div class={cardStyles.cardHeader}>{t('common:heroDetails.weaknessHeader')}</div>
        <div class={styles.noWeaknesses}>
          {t('common:heroDetails.noWeaknesses')}
        </div>
      </div>
    );
  }

  return (
    <div class={`${cardStyles.card} ${styles.weaknessCard}`}>
      <div class={cardStyles.cardHeader}>{t('common:heroDetails.weaknessHeader')}</div>

      <div class={styles.weaknessList}>
        {weaknesses.map((weakness) => (
          <div key={weakness.id} class={cardStyles.weaknessItem}>
            <span class={cardStyles.weaknessIcon}>⚠️</span>
            <div class={cardStyles.weaknessInfo}>
              <span class={cardStyles.weaknessName}>
                {t(`game:heroes.${heroId}.weaknesses.${weakness.id}.name`)}
              </span>
              <span class={cardStyles.weaknessDesc}>
                {t(`game:heroes.${heroId}.weaknesses.${weakness.id}.description`)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
