/**
 * Guild Medals Tab - Tower Race medal collection and active bonus display
 */
import { useState, useEffect, useCallback } from 'preact/hooks';
import { playerGuild } from '../../state/guild.signals.js';
import {
  getGuildMedals,
  type GuildMedalData,
  type GuildMedalStats,
  type GuildMedalBonus,
} from '../../api/guild.js';
import { TOWER_RACE_MEDALS, type MedalType } from '@arcade/protocol';
import { Spinner } from '../shared/Spinner.js';
import styles from './GuildPanel.module.css';

interface GuildMedalsTabProps {
  onRefresh: () => void;
}

interface MedalsData {
  medals: GuildMedalData[];
  stats: GuildMedalStats;
  activeBonus: GuildMedalBonus;
}

export function GuildMedalsTab({ onRefresh: _onRefresh }: GuildMedalsTabProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [medalsData, setMedalsData] = useState<MedalsData | null>(null);

  const guild = playerGuild.value;

  const loadMedalsData = useCallback(async () => {
    if (!guild) return;

    setLoading(true);
    setError(null);

    try {
      const data = await getGuildMedals(guild.id);
      setMedalsData(data);
    } catch (err: any) {
      console.error('Failed to load medals:', err);
      setError(err.message || 'Nie udalo sie zaladowac medali');
    } finally {
      setLoading(false);
    }
  }, [guild]);

  useEffect(() => {
    loadMedalsData();
  }, [loadMedalsData]);

  if (!guild) return null;

  if (loading) {
    return (
      <div class={styles.loading}>
        <Spinner />
      </div>
    );
  }

  if (error && !medalsData) {
    return <div class={styles.error}>{error}</div>;
  }

  if (!medalsData) {
    return <div class={styles.emptyState}>Brak danych medali</div>;
  }

  const { medals, stats, activeBonus } = medalsData;

  return (
    <div class={styles.tabContent}>
      {/* Active Bonus Section */}
      {activeBonus.isActive && (
        <section class={styles.infoSection}>
          <div class={styles.sectionHeader}>
            <span class={styles.sectionTitle}>Aktywny Bonus</span>
            <span class={styles.sectionBadge} style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
              AKTYWNY
            </span>
          </div>
          <div class={styles.activeBonusCard}>
            <div class={styles.activeBonusIcon}>
              {activeBonus.sourceMedalType && TOWER_RACE_MEDALS[activeBonus.sourceMedalType as MedalType]?.icon}
            </div>
            <div class={styles.activeBonusInfo}>
              <div class={styles.activeBonusValue}>
                +{Math.round(activeBonus.wavesBonus * 100)}% do fal
              </div>
              <div class={styles.activeBonusSource}>
                z {activeBonus.sourceMedalType && TOWER_RACE_MEDALS[activeBonus.sourceMedalType as MedalType]?.polishName}
                {' '}({activeBonus.sourceWeekKey})
              </div>
              {activeBonus.expiresAt && (
                <div class={styles.activeBonusExpiry}>
                  Wygasa: {new Date(activeBonus.expiresAt).toLocaleDateString('pl-PL')}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Stats Overview */}
      <section class={styles.infoSection}>
        <div class={styles.sectionHeader}>
          <span class={styles.sectionTitle}>Statystyki Medali</span>
        </div>
        <div class={styles.medalStatsGrid}>
          <MedalStatCard
            icon="🥇"
            label="Zlote"
            value={stats.goldCount}
            color="#FFD700"
          />
          <MedalStatCard
            icon="🥈"
            label="Srebrne"
            value={stats.silverCount}
            color="#C0C0C0"
          />
          <MedalStatCard
            icon="🥉"
            label="Brazowe"
            value={stats.bronzeCount}
            color="#CD7F32"
          />
          <MedalStatCard
            icon="🏅"
            label="Top 10"
            value={stats.top10Count}
            color="#00BFFF"
          />
          <MedalStatCard
            icon="📜"
            label="Top 25"
            value={stats.top25Count}
            color="#4169E1"
          />
          <MedalStatCard
            icon="✨"
            label="Top 50"
            value={stats.top50Count}
            color="#6B7280"
          />
        </div>
        <div class={styles.totalMedalsRow}>
          <span>Lacznie medali:</span>
          <span class={styles.totalMedalsValue}>{stats.totalMedals}</span>
          {stats.bestRank && (
            <>
              <span class={styles.totalMedalsSeparator}>|</span>
              <span>Najlepsza pozycja:</span>
              <span class={styles.bestRankValue}>#{stats.bestRank}</span>
            </>
          )}
        </div>
      </section>

      {/* Medal Collection */}
      <section class={styles.infoSection}>
        <div class={styles.sectionHeader}>
          <span class={styles.sectionTitle}>Kolekcja Medali</span>
          <span class={styles.sectionCount}>{medals.length}</span>
        </div>

        {medals.length === 0 ? (
          <div class={styles.emptyState}>
            <span class={styles.emptyIcon}>🏅</span>
            <span class={styles.emptyText}>Brak medali</span>
            <span class={styles.emptySubtext}>
              Weź udzial w Tower Race, aby zdobyc medale!
            </span>
          </div>
        ) : (
          <div class={styles.medalsGrid}>
            {medals.map((medal) => (
              <MedalCard key={medal.id} medal={medal} />
            ))}
          </div>
        )}
      </section>

      {/* Medal Rewards Info */}
      <section class={styles.infoSection}>
        <div class={styles.sectionHeader}>
          <span class={styles.sectionTitle}>Nagrody za Medale</span>
        </div>
        <div class={styles.medalRewardsTable}>
          <div class={styles.medalRewardsHeader}>
            <span>Medal</span>
            <span>Pozycja</span>
            <span>Guild Coins</span>
            <span>Bonus</span>
          </div>
          {Object.values(TOWER_RACE_MEDALS).map((medalDef) => (
            <div key={medalDef.id} class={styles.medalRewardsRow}>
              <span class={styles.medalRewardsIcon}>
                {medalDef.icon} {medalDef.polishName}
              </span>
              <span>#{medalDef.minRank}{medalDef.minRank !== medalDef.maxRank ? `-${medalDef.maxRank}` : ''}</span>
              <span class={styles.coinsValue}>{medalDef.guildCoinsReward}</span>
              <span class={styles.bonusValue}>+{Math.round(medalDef.wavesBonus * 100)}%</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

interface MedalStatCardProps {
  icon: string;
  label: string;
  value: number;
  color: string;
}

function MedalStatCard({ icon, label, value, color }: MedalStatCardProps) {
  return (
    <div class={styles.medalStatCard} style={{ '--medal-color': color } as any}>
      <span class={styles.medalStatIcon}>{icon}</span>
      <span class={styles.medalStatValue}>{value}</span>
      <span class={styles.medalStatLabel}>{label}</span>
    </div>
  );
}

interface MedalCardProps {
  medal: GuildMedalData;
}

function MedalCard({ medal }: MedalCardProps) {
  const medalDef = TOWER_RACE_MEDALS[medal.medalType as MedalType];
  if (!medalDef) return null;

  return (
    <div
      class={styles.medalCard}
      style={{
        '--medal-color': medalDef.color,
        '--medal-glow': medalDef.glowColor || medalDef.color,
      } as any}
    >
      <div class={styles.medalCardIcon}>{medalDef.icon}</div>
      <div class={styles.medalCardInfo}>
        <div class={styles.medalCardTitle}>{medalDef.polishName}</div>
        <div class={styles.medalCardRank}>#{medal.rank}</div>
        <div class={styles.medalCardWeek}>{medal.weekKey}</div>
      </div>
      <div class={styles.medalCardStats}>
        <div class={styles.medalCardWaves}>{medal.totalWaves.toLocaleString()} fal</div>
        <div class={styles.medalCardCoins}>+{medal.coinsAwarded} GC</div>
      </div>
    </div>
  );
}
