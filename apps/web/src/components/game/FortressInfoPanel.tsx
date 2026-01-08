import type { JSX } from 'preact';
import type { FortressClass } from '@arcade/sim-core';
import {
  getFortressLevelInfo,
  getUnlockedSkills,
  calculateTotalHpBonus,
  calculateTotalDamageBonus,
  MAX_FORTRESS_LEVEL,
  getFortressTier,
  getFortressTierName,
  getNextTierDescription,
} from '@arcade/sim-core';
import {
  selectedFortressClass,
  baseLevel,
  xpProgress,
} from '../../state/index.js';
import styles from './FortressInfoPanel.module.css';

// Class colors
const CLASS_COLORS: Record<FortressClass, string> = {
  natural: '#228b22',
  ice: '#00bfff',
  fire: '#ff4500',
  lightning: '#9932cc',
  tech: '#00f0ff',
};

export function FortressInfoPanel() {
  const fortressClass = selectedFortressClass.value;
  const fortressLevel = baseLevel.value;
  const xpProgressValue = xpProgress.value;

  const levelInfo = getFortressLevelInfo(fortressLevel);
  const unlockedSkills = getUnlockedSkills(fortressLevel);

  const hpBonus = calculateTotalHpBonus(fortressLevel);
  const dmgBonus = calculateTotalDamageBonus(fortressLevel);
  const hpBonusPercent = Math.round(((hpBonus / 16384) - 1) * 100);
  const dmgBonusPercent = Math.round(((dmgBonus / 16384) - 1) * 100);

  const classColor = fortressClass ? CLASS_COLORS[fortressClass] : '#888888';
  const isMaxLevel = fortressLevel >= MAX_FORTRESS_LEVEL;

  const xpToNext = levelInfo ? Math.round(levelInfo.xpToNext * (1 - xpProgressValue / 100)) : 0;

  return (
    <div class={styles.panel} style={{ '--class-color': classColor } as JSX.CSSProperties}>
      {/* Header */}
      <div class={styles.header}>
        <div class={styles.icon}>🏰</div>
        <div class={styles.info}>
          <h3 class={styles.name}>
            {fortressClass ? fortressClass.charAt(0).toUpperCase() + fortressClass.slice(1) : 'Twierdza'}
          </h3>
          <div class={styles.meta}>
            <span class={styles.class}>{fortressClass?.toUpperCase() || 'BRAK'}</span>
            <span class={styles.role}>Obrona</span>
          </div>
        </div>
        <div class={styles.levelDisplay}>
          <span class={styles.levelLabel}>POZIOM</span>
          <span class={styles.levelValue}>{fortressLevel}</span>
        </div>
      </div>

      {/* XP Progress */}
      {!isMaxLevel && (
        <div class={styles.xpSection}>
          <div class={styles.xpHeader}>
            <span>XP do poziomu {fortressLevel + 1}</span>
            <span>{xpToNext} XP</span>
          </div>
          <div class={styles.xpBar}>
            <div class={styles.xpFill} style={{ width: `${Math.min(100, xpProgressValue)}%` }} />
          </div>
        </div>
      )}

      {/* Bonuses */}
      <div class={styles.section}>
        <h4 class={styles.sectionTitle}>BONUSY Z POZIOMU</h4>
        <div class={styles.bonusRow}>
          <div class={styles.bonusStat}>
            <span class={styles.bonusLabel}>HP BONUS</span>
            <span class={styles.bonusValue}>+{hpBonusPercent}%</span>
          </div>
          <div class={styles.bonusStat}>
            <span class={styles.bonusLabel}>DMG BONUS</span>
            <span class={styles.bonusValue}>+{dmgBonusPercent}%</span>
          </div>
        </div>
      </div>


      {/* Skills */}
      <div class={styles.section}>
        <h4 class={styles.sectionTitle}>ODBLOKOWANE UMIEJĘTNOŚCI</h4>
        <div class={styles.skillList}>
          {unlockedSkills.map((skillId: string, index: number) => (
            <span key={skillId} class={styles.skillBadge}>
              {index === 0 ? 'PODSTAWOWA' : index === 1 ? 'WZMOCNIONA' : index === 2 ? 'ZAAWANSOWANA' : 'ULTIMATE'}
            </span>
          ))}
          {unlockedSkills.length === 0 && (
            <span class={styles.noSkills}>Brak</span>
          )}
        </div>
      </div>

      {/* Tier Info */}
      <div class={styles.section}>
        <h4 class={styles.sectionTitle}>TIER TWIERDZY</h4>
        <div class={styles.tierInfo}>
          <span class={styles.tierLabel}>OBECNY TIER</span>
          <span class={styles.tierValue}>{getFortressTierName(getFortressTier(fortressLevel))}</span>
        </div>
        {getNextTierDescription(fortressLevel) && (
          <div class={styles.tierHint}>
            🏰 {getNextTierDescription(fortressLevel)}
          </div>
        )}
      </div>

      {/* Info text */}
      <div class={styles.infoText}>
        Zdobywaj XP pokonując wrogów i ukończając fale, aby awansować twierdzę.
      </div>
    </div>
  );
}
