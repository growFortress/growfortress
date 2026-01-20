import styles from './HeroStatsCard.module.css';
import cardStyles from './cards.module.css';
import { useTranslation } from '../../../i18n/useTranslation.js';

interface HeroStatsCardProps {
  currentHp: number;
  maxHp: number;
  damage: number;
  attackSpeed: number;
  level: number;
  xp: number;
}

export function HeroStatsCard({ currentHp, maxHp, damage, attackSpeed, level, xp }: HeroStatsCardProps) {
  const { t } = useTranslation('common');
  // Calculate XP needed for next level (simplified formula)
  const xpForNextLevel = Math.floor(100 * Math.pow(1.5, level - 1));
  const xpProgress = Math.min((xp / xpForNextLevel) * 100, 100);

  return (
    <div class={`${cardStyles.card} ${styles.statsCard}`}>
      <div class={cardStyles.cardHeader}>{t('heroDetails.statsHeader', { level })}</div>

      <div class={styles.statsGrid}>
        {/* HP */}
        <div class={cardStyles.statBox}>
          <span class={cardStyles.statIcon}>❤️</span>
          <span class={cardStyles.statLabel}>{t('heroDetails.hp')}</span>
          <span class={cardStyles.statValue}>{currentHp}/{maxHp}</span>
        </div>

        {/* Damage */}
        <div class={cardStyles.statBox}>
          <span class={cardStyles.statIcon}>⚔️</span>
          <span class={cardStyles.statLabel}>{t('heroDetails.dmg')}</span>
          <span class={cardStyles.statValue}>{damage}</span>
        </div>

        {/* Attack Speed */}
        <div class={cardStyles.statBox}>
          <span class={cardStyles.statIcon}>⚡</span>
          <span class={cardStyles.statLabel}>{t('heroDetails.as')}</span>
          <span class={cardStyles.statValue}>{attackSpeed.toFixed(2)}</span>
        </div>

        {/* XP */}
        <div class={cardStyles.statBox}>
          <span class={cardStyles.statIcon}>🌫️</span>
          <span class={cardStyles.statLabel}>{t('heroDetails.xpLabel')}</span>
          <span class={cardStyles.statValue}>{xp}</span>
        </div>
      </div>

      {/* XP Progress Bar */}
      <div class={styles.xpSection}>
        <div class={styles.xpHeader}>
          <span class={styles.xpLabel}>{t('heroDetails.nextLevelLabel')}</span>
          <span class={styles.xpValue}>{xp} / {xpForNextLevel}</span>
        </div>
        <div class={styles.xpBarContainer}>
          <div class={styles.xpBar} style={{ width: `${xpProgress}%` }} />
        </div>
      </div>
    </div>
  );
}
