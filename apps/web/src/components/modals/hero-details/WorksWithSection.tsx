import { getHeroById, getHeroSynergies } from '@arcade/sim-core';
import { useTranslation } from '../../../i18n/useTranslation.js';
import styles from './WorksWithSection.module.css';

interface WorksWithSectionProps {
  heroId: string;
}

export function WorksWithSection({ heroId }: WorksWithSectionProps) {
  const { t } = useTranslation(['common', 'data']);
  const heroSynergies = getHeroSynergies(heroId);

  if (heroSynergies.pairs.length === 0 && heroSynergies.trios.length === 0) {
    return null;
  }

  const getHeroName = (id: string): string => {
    const heroDef = getHeroById(id);
    return heroDef ? t(`data:heroes.${id}.name`, { defaultValue: heroDef.name }) : id;
  };

  return (
    <div class={styles.worksWithSection}>
      <h4 class={styles.sectionTitle}>🤝 {t('heroDetails.worksWith', { defaultValue: 'Works With' })}</h4>

      {/* Pair synergies */}
      {heroSynergies.pairs.map(synergy => (
        <div key={synergy.id} class={styles.synergyComboPair}>
          <div class={styles.synergyComboHeader}>
            <span class={styles.synergyComboIcon}>⚡</span>
            <span class={styles.synergyComboName}>
              {t(synergy.nameKey, { defaultValue: synergy.name })}
            </span>
          </div>
          <div class={styles.synergyComboPartner}>
            + {getHeroName(synergy.partner)}
          </div>
          <div class={styles.synergyComboDesc}>
            {t(synergy.descriptionKey, { defaultValue: synergy.description })}
          </div>
          <div class={styles.synergyComboBonuses}>
            {synergy.bonuses.map((bonus, i) => (
              <span key={i} class={styles.synergyComboBonusTag}>{bonus}</span>
            ))}
          </div>
        </div>
      ))}

      {/* Trio synergies */}
      {heroSynergies.trios.map(synergy => (
        <div key={synergy.id} class={styles.synergyComboTrio}>
          <div class={styles.synergyComboHeader}>
            <span class={styles.synergyComboIcon}>⭐</span>
            <span class={styles.synergyComboName}>
              {t(synergy.nameKey, { defaultValue: synergy.name })}
            </span>
          </div>
          <div class={styles.synergyComboPartner}>
            + {synergy.partners.map(p => getHeroName(p)).join(' + ')}
          </div>
          <div class={styles.synergyComboDesc}>
            {t(synergy.descriptionKey, { defaultValue: synergy.description })}
          </div>
          <div class={styles.synergyComboBonuses}>
            {synergy.bonuses.map((bonus, i) => (
              <span key={i} class={styles.synergyComboBonusTag}>{bonus}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
