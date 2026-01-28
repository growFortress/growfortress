import { useTranslation } from '../../../i18n/useTranslation.js';
import { XpIcon, HpIcon, DamageIcon, SpeedIcon } from '../../icons/index.js';
import styles from './HeroStatsCard.module.css';
import cardStyles from './cards.module.css';

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
      <div class={cardStyles.cardHeader}>{t('heroDetails.statsWithLevel', { level })}</div>

      <div class={styles.statsGrid}>
        {/* HP */}
        <div class={cardStyles.statBox}>
          <HpIcon size={20} className={cardStyles.statIcon} />
          <span class={cardStyles.statLabel}>{t('heroDetails.statsShort.hp')}</span>
          <span class={cardStyles.statValue}>{currentHp}/{maxHp}</span>
        </div>

        {/* Damage */}
        <div class={cardStyles.statBox}>
          <DamageIcon size={20} className={cardStyles.statIcon} />
          <span class={cardStyles.statLabel}>{t('heroDetails.statsShort.damage')}</span>
          <span class={cardStyles.statValue}>{damage}</span>
        </div>

        {/* Attack Speed */}
        <div class={cardStyles.statBox}>
          <SpeedIcon size={20} className={cardStyles.statIcon} />
          <span class={cardStyles.statLabel}>{t('heroDetails.statsShort.attackSpeed')}</span>
          <span class={cardStyles.statValue}>{attackSpeed.toFixed(2)}</span>
        </div>

        {/* XP */}
        <div class={cardStyles.statBox}>
          <XpIcon size={20} className={cardStyles.statIcon} />
          <span class={cardStyles.statLabel}>{t('resources.xp')}</span>
          <span class={cardStyles.statValue}>{xp}</span>
        </div>
      </div>

      {/* XP Progress Bar */}
      <div class={styles.xpSection}>
        <div class={styles.xpHeader}>
          <span class={styles.xpLabel}>{t('heroDetails.nextLevel')}</span>
          <span class={styles.xpValue}>{xp} / {xpForNextLevel}</span>
        </div>
        <div class={styles.xpBarContainer}>
          <div class={styles.xpBar} style={{ width: `${xpProgress}%` }} />
        </div>
      </div>
    </div>
  );
}
