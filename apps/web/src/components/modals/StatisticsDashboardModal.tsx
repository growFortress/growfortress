import { useMemo, useState } from 'preact/hooks';
import { decodeDamageAttribution, type DamageOwnerType } from '@arcade/sim-core';
import { useTranslation } from '../../i18n/useTranslation.js';
import {
  closeStatisticsDashboard,
  showStatisticsDashboard,
  lastSessionAnalytics,
} from '../../state/index.js';
import { Modal } from '../shared/Modal.js';
import styles from './StatisticsDashboardModal.module.css';

type OwnerFilter = 'all' | DamageOwnerType;

interface HeroRow {
  heroId: string;
  damage: number;
  dps: number;
  sharePct: number;
}

interface MechanicRow {
  mechanicType: string;
  mechanicId: string;
  damage: number;
  sharePct: number;
}

interface OwnerRow {
  ownerId: string;
  damage: number;
  sharePct: number;
  mechanics: MechanicRow[];
}

interface OwnerTypeRow {
  ownerType: DamageOwnerType;
  damage: number;
  sharePct: number;
  owners: OwnerRow[];
}

function formatNumber(value: number): string {
  return Math.floor(value).toLocaleString();
}

function formatDps(value: number): string {
  return value.toFixed(1);
}

function getTotalTicks(waves: { durationTicks: number }[]): number {
  return waves.reduce((sum, wave) => sum + wave.durationTicks, 0);
}

function aggregateHeroes(
  waves: { damageByHero?: Record<string, number>; damageByAttribution?: Record<string, number> }[],
  totalSeconds: number,
  totalDamage: number
): HeroRow[] {
  const totals = new Map<string, number>();
  const useAttribution = waves.some((wave) => Object.keys(wave.damageByAttribution || {}).length > 0);

  if (useAttribution) {
    for (const wave of waves) {
      for (const [key, damage] of Object.entries(wave.damageByAttribution || {})) {
        const attribution = decodeDamageAttribution(key);
        if (attribution.ownerType !== 'hero') continue;
        totals.set(attribution.ownerId, (totals.get(attribution.ownerId) || 0) + damage);
      }
    }
  } else {
    for (const wave of waves) {
      for (const [heroId, damage] of Object.entries(wave.damageByHero || {})) {
        totals.set(heroId, (totals.get(heroId) || 0) + damage);
      }
    }
  }

  return Array.from(totals.entries())
    .map(([heroId, damage]) => ({
      heroId,
      damage,
      dps: totalSeconds > 0 ? damage / totalSeconds : 0,
      sharePct: totalDamage > 0 ? (damage / totalDamage) * 100 : 0,
    }))
    .sort((a, b) => b.damage - a.damage);
}

function aggregateAttribution(
  waves: { damageByAttribution?: Record<string, number> }[],
  totalDamage: number,
  ownerFilter: OwnerFilter
): OwnerTypeRow[] {
  const totalsByType = new Map<DamageOwnerType, Map<string, Map<string, Map<string, number>>>>();
  const totalsByOwnerType = new Map<DamageOwnerType, number>();
  const totalsByOwner = new Map<string, number>();
  const totalsByMechanic = new Map<string, number>();

  for (const wave of waves) {
    for (const [key, damage] of Object.entries(wave.damageByAttribution || {})) {
      const attribution = decodeDamageAttribution(key);
      if (ownerFilter !== 'all' && attribution.ownerType !== ownerFilter) continue;

      const typeMap = totalsByType.get(attribution.ownerType) || new Map();
      const ownerMap = typeMap.get(attribution.ownerId) || new Map();
      const mechanicMap = ownerMap.get(attribution.mechanicType) || new Map();

      mechanicMap.set(attribution.mechanicId, (mechanicMap.get(attribution.mechanicId) || 0) + damage);
      ownerMap.set(attribution.mechanicType, mechanicMap);
      typeMap.set(attribution.ownerId, ownerMap);
      totalsByType.set(attribution.ownerType, typeMap);

      const ownerKey = `${attribution.ownerType}:${attribution.ownerId}`;
      const mechanicKey = `${ownerKey}:${attribution.mechanicType}`;
      totalsByOwnerType.set(
        attribution.ownerType,
        (totalsByOwnerType.get(attribution.ownerType) || 0) + damage
      );
      totalsByOwner.set(ownerKey, (totalsByOwner.get(ownerKey) || 0) + damage);
      totalsByMechanic.set(mechanicKey, (totalsByMechanic.get(mechanicKey) || 0) + damage);
    }
  }

  return Array.from(totalsByType.entries())
    .map(([ownerType, owners]) => {
      const ownerRows: OwnerRow[] = Array.from(owners.entries()).map(([ownerId, mechanics]) => {
        const ownerKey = `${ownerType}:${ownerId}`;
        const ownerTotal = totalsByOwner.get(ownerKey) || 0;
        const mechanicRows: MechanicRow[] = Array.from(mechanics.entries()).flatMap(([mechanicType, ids]) => {
          const mechanicKey = `${ownerKey}:${mechanicType}`;
          const mechanicTotal = totalsByMechanic.get(mechanicKey) || 0;
          return Array.from(ids.entries()).map(([mechanicId, damage]) => ({
            mechanicType,
            mechanicId,
            damage,
            sharePct: mechanicTotal > 0 ? (damage / mechanicTotal) * 100 : 0,
          }));
        });

        const sortedMechanics = mechanicRows.sort((a, b) => b.damage - a.damage);
        return {
          ownerId,
          damage: ownerTotal,
          sharePct: totalDamage > 0 ? (ownerTotal / totalDamage) * 100 : 0,
          mechanics: sortedMechanics,
        };
      });

      const ownerTypeTotal = totalsByOwnerType.get(ownerType) || 0;
      return {
        ownerType,
        damage: ownerTypeTotal,
        sharePct: totalDamage > 0 ? (ownerTypeTotal / totalDamage) * 100 : 0,
        owners: ownerRows.sort((a, b) => b.damage - a.damage),
      };
    })
    .sort((a, b) => b.damage - a.damage);
}

export function StatisticsDashboardModal() {
  const { t } = useTranslation(['modals', 'common']);
  const snapshot = lastSessionAnalytics.value;
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>('all');

  const { totalDamage, totalSeconds, overallDps, heroRows, ownerRows } = useMemo(() => {
    const waves = snapshot?.waves || [];
    const damage = waves.reduce((sum, wave) => sum + wave.totalDamageDealt, 0);
    const ticks = getTotalTicks(waves);
    const seconds = snapshot?.tickHz ? ticks / snapshot.tickHz : 0;
    return {
      totalDamage: damage,
      totalSeconds: seconds,
      overallDps: seconds > 0 ? damage / seconds : 0,
      heroRows: aggregateHeroes(waves, seconds, damage),
      ownerRows: aggregateAttribution(waves, damage, ownerFilter),
    };
  }, [snapshot?.endedAt, snapshot?.tickHz, ownerFilter]);

  return (
    <Modal
      visible={showStatisticsDashboard.value}
      onClose={closeStatisticsDashboard}
      size="xlarge"
      title={t('modals:statistics.title')}
      ariaLabel={t('modals:statistics.ariaLabel')}
      class={styles.modal}
      bodyClass={styles.body}
    >
      {!snapshot && (
        <div class={styles.emptyState}>
          <span class={styles.emptyTitle}>{t('modals:statistics.emptyTitle')}</span>
          <span class={styles.emptySubtitle}>{t('modals:statistics.emptySubtitle')}</span>
        </div>
      )}

      {snapshot && (
        <div class={styles.content}>
          <section class={styles.section}>
            <h3 class={styles.sectionTitle}>{t('modals:statistics.overview')}</h3>
            <div class={styles.overviewGrid}>
              <div class={styles.overviewCard}>
                <span class={styles.overviewLabel}>{t('modals:statistics.totalDamage')}</span>
                <span class={styles.overviewValue}>{formatNumber(totalDamage)}</span>
              </div>
              <div class={styles.overviewCard}>
                <span class={styles.overviewLabel}>{t('modals:statistics.duration')}</span>
                <span class={styles.overviewValue}>
                  {totalSeconds.toFixed(1)}s
                </span>
              </div>
              <div class={styles.overviewCard}>
                <span class={styles.overviewLabel}>{t('modals:statistics.overallDps')}</span>
                <span class={styles.overviewValue}>{formatDps(overallDps)}</span>
              </div>
              <div class={styles.overviewCard}>
                <span class={styles.overviewLabel}>{t('modals:statistics.waves')}</span>
                <span class={styles.overviewValue}>{snapshot.waves.length}</span>
              </div>
            </div>
          </section>

          <section class={styles.section}>
            <h3 class={styles.sectionTitle}>{t('modals:statistics.heroDps')}</h3>
            {heroRows.length === 0 ? (
              <div class={styles.emptyInline}>{t('modals:statistics.noHeroDamage')}</div>
            ) : (
              <div class={styles.table}>
                <div class={styles.tableHeader}>
                  <span>{t('modals:statistics.hero')}</span>
                  <span>{t('modals:statistics.damage')}</span>
                  <span>{t('modals:statistics.dps')}</span>
                  <span>{t('modals:statistics.share')}</span>
                </div>
                {heroRows.map((row) => (
                  <div key={row.heroId} class={styles.tableRow}>
                    <span>{row.heroId}</span>
                    <span>{formatNumber(row.damage)}</span>
                    <span>{formatDps(row.dps)}</span>
                    <span>{row.sharePct.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section class={styles.section}>
            <div class={styles.sectionHeader}>
              <h3 class={styles.sectionTitle}>{t('modals:statistics.damageSources')}</h3>
              <label class={styles.filter}>
                <span>{t('modals:statistics.filterOwner')}</span>
                <select
                  value={ownerFilter}
                  onChange={(event) => setOwnerFilter((event.target as HTMLSelectElement).value as OwnerFilter)}
                >
                  <option value="all">{t('modals:statistics.filterAll')}</option>
                  <option value="hero">{t('modals:statistics.filterHero')}</option>
                  <option value="turret">{t('modals:statistics.filterTurret')}</option>
                  <option value="fortress">{t('modals:statistics.filterFortress')}</option>
                  <option value="system">{t('modals:statistics.filterSystem')}</option>
                </select>
              </label>
            </div>

            {ownerRows.length === 0 ? (
              <div class={styles.emptyInline}>{t('modals:statistics.noAttribution')}</div>
            ) : (
              <div class={styles.attributionList}>
                {ownerRows.map((ownerType) => (
                  <details key={ownerType.ownerType} class={styles.attributionGroup} open>
                    <summary class={styles.attributionSummary}>
                      <span class={styles.attributionTitle}>{ownerType.ownerType}</span>
                      <span class={styles.attributionValue}>
                        {formatNumber(ownerType.damage)} ({ownerType.sharePct.toFixed(1)}%)
                      </span>
                    </summary>
                    <div class={styles.attributionBody}>
                      {ownerType.owners.map((owner) => (
                        <details key={`${ownerType.ownerType}-${owner.ownerId}`} class={styles.ownerGroup}>
                          <summary class={styles.ownerSummary}>
                            <span>{owner.ownerId}</span>
                            <span>{formatNumber(owner.damage)} ({owner.sharePct.toFixed(1)}%)</span>
                          </summary>
                          <div class={styles.mechanicList}>
                            {owner.mechanics.map((mechanic) => (
                              <div
                                key={`${owner.ownerId}-${mechanic.mechanicType}-${mechanic.mechanicId}`}
                                class={styles.mechanicRow}
                              >
                                <span class={styles.mechanicId}>
                                  {mechanic.mechanicType}:{mechanic.mechanicId}
                                </span>
                                <span>
                                  {formatNumber(mechanic.damage)} ({mechanic.sharePct.toFixed(1)}%)
                                </span>
                              </div>
                            ))}
                          </div>
                        </details>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}
