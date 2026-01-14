/**
 * Guild Tower Race Tab - Weekly competition where guilds compete based on total waves cleared
 */
import { useState, useEffect, useCallback } from 'preact/hooks';
import { playerGuild } from '../../state/guild.signals.js';
import {
  getTowerRaceLeaderboard,
  getTowerRaceDetails,
  type TowerRace,
  type TowerRaceEntry,
  type TowerRaceContribution,
} from '../../api/guild.js';
import { Spinner } from '../shared/Spinner.js';
import { GuildTag } from '../shared/GuildTag.js';
import styles from './GuildPanel.module.css';

interface GuildTowerRaceTabProps {
  onRefresh: () => void;
}

interface RaceData {
  race: TowerRace;
  entries: TowerRaceEntry[];
  myGuildEntry: TowerRaceEntry | null;
  myContribution: number;
  guildContributions: TowerRaceContribution[];
}

export function GuildTowerRaceTab({ onRefresh: _onRefresh }: GuildTowerRaceTabProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [raceData, setRaceData] = useState<RaceData | null>(null);
  const [showGuildBreakdown, setShowGuildBreakdown] = useState(false);

  const guild = playerGuild.value;

  const loadRaceData = useCallback(async () => {
    if (!guild) return;

    setLoading(true);
    setError(null);

    try {
      const [leaderboard, details] = await Promise.all([
        getTowerRaceLeaderboard(undefined, 20, 0),
        getTowerRaceDetails(guild.id),
      ]);

      setRaceData({
        race: leaderboard.race,
        entries: leaderboard.entries,
        myGuildEntry: leaderboard.myGuildEntry,
        myContribution: leaderboard.myContribution,
        guildContributions: details.contributions || [],
      });
    } catch (err: any) {
      console.error('Failed to load tower race data:', err);
      setError(err.message || 'Nie udalo sie zaladowac danych wyscigu');
    } finally {
      setLoading(false);
    }
  }, [guild]);

  useEffect(() => {
    loadRaceData();
  }, [loadRaceData]);

  if (!guild) return null;

  if (loading) {
    return (
      <div class={styles.loading}>
        <Spinner />
      </div>
    );
  }

  if (error) {
    return <div class={styles.error}>{error}</div>;
  }

  if (!raceData) {
    return <div class={styles.empty}>Brak danych wyscigu</div>;
  }

  const { race, entries, myGuildEntry, myContribution, guildContributions } = raceData;
  const timeRemaining = new Date(race.endsAt).getTime() - Date.now();
  const isActive = race.status === 'active' && timeRemaining > 0;

  return (
    <div class={styles.tabContent}>
      {/* Race Header */}
      <div class={styles.raceHeader}>
        <div class={styles.raceInfo}>
          <h3 class={styles.raceTitle}>Tower Race</h3>
          <span class={styles.raceWeek}>{race.weekKey}</span>
        </div>
        <div class={styles.raceStatus}>
          <span class={`${styles.statusBadge} ${isActive ? styles.statusActive : styles.statusEnded}`}>
            {isActive ? 'AKTYWNY' : 'ZAKONCZONY'}
          </span>
          {isActive && (
            <span class={styles.timeRemaining}>
              {formatTimeRemaining(timeRemaining)}
            </span>
          )}
        </div>
      </div>

      {/* My Guild Stats */}
      {myGuildEntry && (
        <div class={styles.myGuildStats}>
          <div class={styles.myGuildRow}>
            <span class={styles.myGuildLabel}>Twoja gildia</span>
            <span class={styles.myGuildRank}>#{myGuildEntry.rank}</span>
          </div>
          <div class={styles.myGuildRow}>
            <span class={styles.myGuildLabel}>Suma fal</span>
            <span class={styles.myGuildWaves}>{myGuildEntry.totalWaves.toLocaleString()}</span>
          </div>
          <div class={styles.myGuildRow}>
            <span class={styles.myGuildLabel}>Twoj wklad</span>
            <span class={styles.myContribution}>{myContribution.toLocaleString()} fal</span>
          </div>
        </div>
      )}

      {/* Toggle for guild breakdown */}
      {guildContributions.length > 0 && (
        <button
          class={styles.toggleBtn}
          onClick={() => setShowGuildBreakdown(!showGuildBreakdown)}
        >
          {showGuildBreakdown ? 'Ukryj wklad czlonkow' : 'Pokaz wklad czlonkow'}
        </button>
      )}

      {/* Guild Member Contributions */}
      {showGuildBreakdown && guildContributions.length > 0 && (
        <div class={styles.contributionsList}>
          <div class={styles.sectionHeader}>
            <h4>Wklad czlonkow</h4>
          </div>
          <div class={styles.contributionsTable}>
            {guildContributions.map((contrib, index) => (
              <div key={contrib.userId} class={styles.contributionRow}>
                <span class={styles.contributionRank}>#{index + 1}</span>
                <span class={styles.contributionName}>{contrib.displayName}</span>
                <span class={styles.contributionWaves}>
                  {contrib.wavesContributed.toLocaleString()} fal
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <div class={styles.sectionHeader}>
        <h4>Ranking Gildii</h4>
        <span class={styles.badge}>{entries.length}</span>
      </div>

      {entries.length === 0 ? (
        <div class={styles.empty}>
          <p>Brak uczestnikow w tym tygodniu</p>
          <p class={styles.hint}>
            Graj w trybie Endless aby zbierac fale dla swojej gildii!
          </p>
        </div>
      ) : (
        <div class={styles.leaderboardList}>
          {entries.map((entry) => (
            <LeaderboardEntry
              key={entry.guildId}
              entry={entry}
              isMyGuild={entry.guildId === guild.id}
            />
          ))}
        </div>
      )}

      {/* Rewards Info */}
      <div class={styles.rewardsInfo}>
        <h4>Nagrody</h4>
        <div class={styles.rewardsList}>
          <div class={styles.rewardRow}>
            <span class={styles.rewardRank}>1 miejsce</span>
            <span class={styles.rewardAmount}>500 Guild Coins</span>
          </div>
          <div class={styles.rewardRow}>
            <span class={styles.rewardRank}>2 miejsce</span>
            <span class={styles.rewardAmount}>300 Guild Coins</span>
          </div>
          <div class={styles.rewardRow}>
            <span class={styles.rewardRank}>3 miejsce</span>
            <span class={styles.rewardAmount}>200 Guild Coins</span>
          </div>
          <div class={styles.rewardRow}>
            <span class={styles.rewardRank}>4-10 miejsce</span>
            <span class={styles.rewardAmount}>100 Guild Coins</span>
          </div>
          <div class={styles.rewardRow}>
            <span class={styles.rewardRank}>11-20 miejsce</span>
            <span class={styles.rewardAmount}>50 Guild Coins</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface LeaderboardEntryProps {
  entry: TowerRaceEntry;
  isMyGuild: boolean;
}

function LeaderboardEntry({ entry, isMyGuild }: LeaderboardEntryProps) {
  const getRankStyle = (rank: number) => {
    if (rank === 1) return styles.rankGold;
    if (rank === 2) return styles.rankSilver;
    if (rank === 3) return styles.rankBronze;
    return '';
  };

  return (
    <div class={`${styles.leaderboardEntry} ${isMyGuild ? styles.leaderboardEntryMine : ''}`}>
      <span class={`${styles.entryRank} ${getRankStyle(entry.rank)}`}>
        #{entry.rank}
      </span>
      <div class={styles.entryGuild}>
        <span class={styles.entryGuildName}>{entry.guildName}</span>
        <GuildTag guildId={entry.guildId} tag={entry.guildTag} clickable={!isMyGuild} />
      </div>
      <span class={styles.entryWaves}>{entry.totalWaves.toLocaleString()}</span>
    </div>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return 'Zakonczony';

  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}
