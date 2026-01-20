/**
 * Guild Trophies Tab - Arena 5v5 battle trophies and streak tracking
 */
import { useState, useEffect, useCallback } from 'preact/hooks';
import { playerGuild } from '../../state/guild.signals.js';
import {
  getGuildTrophies,
  type GuildTrophyProgress,
  type GuildBattleStreak,
} from '../../api/guild.js';
import { Spinner } from '../shared/Spinner.js';
import styles from './GuildPanel.module.css';

interface GuildTrophiesTabProps {
  onRefresh: () => void;
}

interface TrophiesData {
  earned: GuildTrophyProgress[];
  inProgress: GuildTrophyProgress[];
  totalStatBonus: number;
  coinMultiplier: number;
  streak: GuildBattleStreak;
}

// Category display info
const CATEGORY_INFO: Record<string, { label: string; icon: string; color: string }> = {
  wins: { label: 'Wygrane', icon: '⚔️', color: '#7C3AED' },
  streak: { label: 'Serie', icon: '🔥', color: '#F97316' },
  combat: { label: 'Walka', icon: '💪', color: '#22C55E' },
  rivalry: { label: 'Rywalizacja', icon: '👊', color: '#DC2626' },
};

export function GuildTrophiesTab({ onRefresh: _onRefresh }: GuildTrophiesTabProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trophiesData, setTrophiesData] = useState<TrophiesData | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const guild = playerGuild.value;

  const loadTrophiesData = useCallback(async () => {
    if (!guild) return;

    setLoading(true);
    setError(null);

    try {
      const data = await getGuildTrophies(guild.id);
      setTrophiesData(data);
    } catch (err: any) {
      console.error('Failed to load trophies:', err);
      setError(err.message || 'Nie udalo sie zaladowac trofow');
    } finally {
      setLoading(false);
    }
  }, [guild]);

  useEffect(() => {
    loadTrophiesData();
  }, [loadTrophiesData]);

  if (!guild) return null;

  if (loading) {
    return (
      <div class={styles.loading}>
        <Spinner />
      </div>
    );
  }

  if (error && !trophiesData) {
    return <div class={styles.error}>{error}</div>;
  }

  if (!trophiesData) {
    return <div class={styles.emptyState}>Brak danych trofow</div>;
  }

  const { earned, inProgress } = trophiesData;

  // Filter by category if selected
  const filteredEarned = selectedCategory
    ? earned.filter((t) => t.category === selectedCategory)
    : earned;
  const filteredInProgress = selectedCategory
    ? inProgress.filter((t) => t.category === selectedCategory)
    : inProgress;

  return (
    <div class={styles.tabContent}>
      {/* Category Filter */}
      <section class={styles.infoSection}>
        <div class={styles.categoryFilter}>
          <button
            class={`${styles.categoryBtn} ${selectedCategory === null ? styles.categoryBtnActive : ''}`}
            onClick={() => setSelectedCategory(null)}
          >
            Wszystkie
          </button>
          {Object.entries(CATEGORY_INFO).map(([key, info]) => (
            <button
              key={key}
              class={`${styles.categoryBtn} ${selectedCategory === key ? styles.categoryBtnActive : ''}`}
              style={{ '--cat-color': info.color } as any}
              onClick={() => setSelectedCategory(key)}
            >
              {info.icon} {info.label}
            </button>
          ))}
        </div>
      </section>

      {/* Earned Trophies */}
      <section class={styles.infoSection}>
        <div class={styles.sectionHeader}>
          <span class={styles.sectionTitle}>Zdobyte Trofea</span>
          <span class={styles.sectionCount}>{filteredEarned.length}</span>
        </div>

        {filteredEarned.length === 0 ? (
          <div class={styles.emptyState}>
            <span class={styles.emptyIcon}>🏆</span>
            <span class={styles.emptyText}>Brak zdobytych trofow</span>
            <span class={styles.emptySubtext}>
              Wygrywaj bitwy Arena 5v5, aby zdobywac trofea!
            </span>
          </div>
        ) : (
          <div class={styles.trophiesGrid}>
            {filteredEarned.map((trophy) => (
              <TrophyCard key={trophy.trophyId} trophy={trophy} earned />
            ))}
          </div>
        )}
      </section>

      {/* In Progress Trophies */}
      <section class={styles.infoSection}>
        <div class={styles.sectionHeader}>
          <span class={styles.sectionTitle}>W Trakcie</span>
          <span class={styles.sectionCount}>{filteredInProgress.length}</span>
        </div>

        {filteredInProgress.length === 0 ? (
          <div class={styles.emptyState}>
            <span class={styles.emptyIcon}>🎯</span>
            <span class={styles.emptyText}>Wszystkie trofea zdobyte!</span>
          </div>
        ) : (
          <div class={styles.trophiesGrid}>
            {filteredInProgress.map((trophy) => (
              <TrophyCard key={trophy.trophyId} trophy={trophy} earned={false} />
            ))}
          </div>
        )}
      </section>

      {/* Trophy Bonuses Info */}
      <section class={styles.infoSection}>
        <div class={styles.sectionHeader}>
          <span class={styles.sectionTitle}>System Nagrod</span>
        </div>
        <div class={styles.trophyInfoGrid}>
          <div class={styles.trophyInfoCard}>
            <span class={styles.trophyInfoIcon}>⚔️</span>
            <div class={styles.trophyInfoContent}>
              <span class={styles.trophyInfoTitle}>Wygrana</span>
              <span class={styles.trophyInfoValue}>50 Guild Coins</span>
            </div>
          </div>
          <div class={styles.trophyInfoCard}>
            <span class={styles.trophyInfoIcon}>💔</span>
            <div class={styles.trophyInfoContent}>
              <span class={styles.trophyInfoTitle}>Przegrana</span>
              <span class={styles.trophyInfoValue}>10 Guild Coins</span>
            </div>
          </div>
          <div class={styles.trophyInfoCard}>
            <span class={styles.trophyInfoIcon}>💀</span>
            <div class={styles.trophyInfoContent}>
              <span class={styles.trophyInfoTitle}>Dominacja (5 ocalonych)</span>
              <span class={styles.trophyInfoValue}>+25 Guild Coins</span>
            </div>
          </div>
          <div class={styles.trophyInfoCard}>
            <span class={styles.trophyInfoIcon}>🔥</span>
            <div class={styles.trophyInfoContent}>
              <span class={styles.trophyInfoTitle}>Bonus za serie</span>
              <span class={styles.trophyInfoValue}>+10% za kazda wygrana (max +100%)</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

interface TrophyCardProps {
  trophy: GuildTrophyProgress;
  earned: boolean;
}

function TrophyCard({ trophy, earned }: TrophyCardProps) {
  const categoryInfo = CATEGORY_INFO[trophy.category] || { label: trophy.category, icon: '🏆', color: '#6B7280' };
  const progress = earned ? 100 : Math.min(100, (trophy.progress / trophy.target) * 100);

  return (
    <div
      class={`${styles.trophyCard} ${earned ? styles.trophyCardEarned : styles.trophyCardLocked}`}
      style={{ '--trophy-color': trophy.color } as any}
    >
      <div class={styles.trophyCardHeader}>
        <span class={styles.trophyCardIcon}>{trophy.icon}</span>
        <span class={styles.trophyCardCategory} style={{ color: categoryInfo.color }}>
          {categoryInfo.icon} {categoryInfo.label}
        </span>
      </div>
      <div class={styles.trophyCardBody}>
        <div class={styles.trophyCardTitle}>{trophy.polishName}</div>
        <div class={styles.trophyCardProgress}>
          <div class={styles.trophyProgressBar}>
            <div
              class={styles.trophyProgressFill}
              style={{ width: `${progress}%`, backgroundColor: trophy.color }}
            />
          </div>
          <span class={styles.trophyProgressText}>
            {trophy.progress}/{trophy.target}
          </span>
        </div>
      </div>
      <div class={styles.trophyCardBonus}>
        {trophy.bonus.type === 'stat_boost' && (
          <span class={styles.trophyBonusStat}>+{trophy.bonus.value}% mocy w Arena</span>
        )}
        {trophy.bonus.type === 'coin_multiplier' && (
          <span class={styles.trophyBonusCoin}>x{trophy.bonus.value} Guild Coins</span>
        )}
        {trophy.bonus.type === 'badge' && (
          <span class={styles.trophyBonusBadge}>🏅 Odznaka</span>
        )}
      </div>
      {earned && trophy.earnedAt && (
        <div class={styles.trophyCardDate}>
          {new Date(trophy.earnedAt).toLocaleDateString('pl-PL')}
        </div>
      )}
    </div>
  );
}
