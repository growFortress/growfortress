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

  return (
    <div class={styles.overlay} onClick={(e) => {
      if (e.target === e.currentTarget) closePvpPanel();
    }}>
      <div class={styles.panel}>
        {/* Header */}
        <div class={styles.header}>
          <div class={styles.headerLeft}>
            <span class={styles.icon}>⚔️</span>
            <h2 class={styles.title}>PVP Arena</h2>
          </div>
          <button class={styles.closeBtn} onClick={closePvpPanel}>×</button>
        </div>

        {/* Stats Bar */}
        <div class={styles.statsBar}>
          <div class={styles.statItem}>
            <span class={styles.statLabel}>Wygrane</span>
            <span class={`${styles.statValue} ${styles.statValueWins}`}>
              {pvpWins.value}
            </span>
          </div>
          <div class={styles.statItem}>
            <span class={styles.statLabel}>Przegrane</span>
            <span class={`${styles.statValue} ${styles.statValueLosses}`}>
              {pvpLosses.value}
            </span>
          </div>
          <div class={styles.statItem}>
            <span class={styles.statLabel}>Win Rate</span>
            <span class={styles.statValue}>
              {pvpWinRate.value}%
            </span>
          </div>
          <div class={styles.statItem}>
            <span class={styles.statLabel}>Moc</span>
            <span class={`${styles.statValue} ${styles.statValuePower}`}>
              {formatPower(userPower.value)}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div class={styles.tabs}>
          <button
            class={`${styles.tab} ${pvpActiveTab.value === 'opponents' ? styles.tabActive : ''}`}
            onClick={() => setActivePvpTab('opponents')}
          >
            Przeciwnicy
          </button>
          <button
            class={`${styles.tab} ${pvpActiveTab.value === 'challenges' ? styles.tabActive : ''}`}
            onClick={() => setActivePvpTab('challenges')}
          >
            Wyzwania
            {pendingCount > 0 && (
              <span class={styles.tabBadge}>{pendingCount}</span>
            )}
          </button>
          <button
            class={`${styles.tab} ${pvpActiveTab.value === 'history' ? styles.tabActive : ''}`}
            onClick={() => setActivePvpTab('history')}
          >
            Historia
          </button>
          <button
            class={`${styles.refreshBtn} ${pvpOpponentsLoading.value || pvpChallengesLoading.value ? styles.refreshBtnSpinning : ''}`}
            onClick={refreshData}
            title="Odśwież"
          >
            🔄
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
