import { useEffect, useCallback } from 'preact/hooks';
import {
  showPvpPanel,
  closePvpPanel,
  pvpActiveTab,
  setActivePvpTab,
  pvpWins,
  pvpLosses,
  pvpWinRate,
  userPower,
  pvpPendingChallenges,
  pvpOpponentsLoading,
  pvpChallengesLoading,
  setPvpOpponents,
  setPvpChallenges,
  updatePvpStats,
  formatPower,
} from '../../state/index.js';
import {
  getOpponents,
  getChallenges,
  getPvpStats,
} from '../../api/pvp.js';
import { OpponentsList } from './OpponentsList.js';
import { ChallengesList } from './ChallengesList.js';
import styles from './PvpPanel.module.css';

export function PvpPanel() {
  // Load data when panel opens
  useEffect(() => {
    if (showPvpPanel.value) {
      loadData();
    }
  }, [showPvpPanel.value]);

  const loadData = useCallback(async () => {
    try {
      // Load stats, opponents, and challenges in parallel
      const [statsData, opponentsData, sentData, receivedData] = await Promise.all([
        getPvpStats(),
        getOpponents(20, 0),
        getChallenges('sent', undefined, 20, 0),
        getChallenges('received', undefined, 20, 0),
      ]);

      updatePvpStats(
        statsData.wins,
        statsData.losses,
        statsData.pendingChallenges,
        opponentsData.myPower
      );

      setPvpOpponents(opponentsData.opponents, opponentsData.total);
      setPvpChallenges(sentData.challenges, receivedData.challenges);
    } catch (error) {
      console.error('Failed to load PvP data:', error);
    }
  }, []);

  const refreshData = useCallback(async () => {
    await loadData();
  }, [loadData]);

  if (!showPvpPanel.value) {
    return null;
  }

  const pendingCount = pvpPendingChallenges.value;
  const wins = pvpWins.value;
  const losses = pvpLosses.value;
  const isLoading = pvpOpponentsLoading.value || pvpChallengesLoading.value;

  return (
    <div class={styles.overlay} onClick={(e) => {
      if (e.target === e.currentTarget) closePvpPanel();
    }}>
      <div class={styles.panel}>
        {/* Header */}
        <div class={styles.header}>
          <div class={styles.headerContent}>
            <div class={styles.headerIcon}>⚔️</div>
            <div class={styles.headerText}>
              <h2 class={styles.title}>PVP Arena</h2>
              <span class={styles.subtitle}>Walcz z innymi graczami</span>
            </div>
          </div>
          <button class={styles.closeBtn} onClick={closePvpPanel} aria-label="Zamknij">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Stats Cards */}
        <div class={styles.statsGrid}>
          <div class={`${styles.statCard} ${styles.statCardWins}`}>
            <div class={styles.statIcon}>🏆</div>
            <div class={styles.statContent}>
              <span class={styles.statValue}>{wins}</span>
              <span class={styles.statLabel}>Wygrane</span>
            </div>
          </div>
          <div class={`${styles.statCard} ${styles.statCardLosses}`}>
            <div class={styles.statIcon}>💀</div>
            <div class={styles.statContent}>
              <span class={styles.statValue}>{losses}</span>
              <span class={styles.statLabel}>Przegrane</span>
            </div>
          </div>
          <div class={`${styles.statCard} ${styles.statCardRate}`}>
            <div class={styles.statIcon}>📊</div>
            <div class={styles.statContent}>
              <span class={styles.statValue}>{pvpWinRate.value}%</span>
              <span class={styles.statLabel}>Win Rate</span>
            </div>
          </div>
          <div class={`${styles.statCard} ${styles.statCardPower}`}>
            <div class={styles.statIcon}>⚡</div>
            <div class={styles.statContent}>
              <span class={styles.statValue}>{formatPower(userPower.value)}</span>
              <span class={styles.statLabel}>Twoja Moc</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div class={styles.tabs}>
          <button
            class={`${styles.tab} ${pvpActiveTab.value === 'opponents' ? styles.tabActive : ''}`}
            onClick={() => setActivePvpTab('opponents')}
          >
            <span class={styles.tabIcon}>👥</span>
            <span class={styles.tabText}>Przeciwnicy</span>
          </button>
          <button
            class={`${styles.tab} ${pvpActiveTab.value === 'challenges' ? styles.tabActive : ''}`}
            onClick={() => setActivePvpTab('challenges')}
          >
            <span class={styles.tabIcon}>📨</span>
            <span class={styles.tabText}>Wyzwania</span>
            {pendingCount > 0 && (
              <span class={styles.tabBadge}>{pendingCount}</span>
            )}
          </button>
          <button
            class={`${styles.tab} ${pvpActiveTab.value === 'history' ? styles.tabActive : ''}`}
            onClick={() => setActivePvpTab('history')}
          >
            <span class={styles.tabIcon}>📜</span>
            <span class={styles.tabText}>Historia</span>
          </button>
          <button
            class={`${styles.refreshBtn} ${isLoading ? styles.refreshBtnSpinning : ''}`}
            onClick={refreshData}
            title="Odśwież"
            disabled={isLoading}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div class={styles.content}>
          {pvpActiveTab.value === 'opponents' && (
            <OpponentsList onRefresh={refreshData} />
          )}
          {pvpActiveTab.value === 'challenges' && (
            <ChallengesList filter="pending" onRefresh={refreshData} />
          )}
          {pvpActiveTab.value === 'history' && (
            <ChallengesList filter="resolved" onRefresh={refreshData} />
          )}
        </div>
      </div>
    </div>
  );
}
