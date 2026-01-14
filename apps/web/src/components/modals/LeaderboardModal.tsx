/**
 * LeaderboardModal - Main modal component for leaderboard system
 */
import { useEffect, useCallback } from 'preact/hooks';
import { openHubPreview } from '../../state/hubPreview.signals.js';
import { Modal } from '../shared/Modal.js';
import { GuildTag } from '../shared/GuildTag.js';
import { useTranslation } from '../../i18n/useTranslation.js';
import type { PlayerLeaderboardEntry, PlayerLeaderboardCategory, AvailableReward, ExclusiveItem, GuildLeaderboardEntry } from '@arcade/protocol';
import { getGuildLeaderboard } from '../../api/guild.js';
import {
  showLeaderboardModal,
  activeMainTab,
  activeSubTab,
  leaderboardEntries,
  leaderboardOffset,
  leaderboardLimit,
  leaderboardLoading,
  leaderboardError,
  availableRewards,
  hasUnclaimedRewards,
  currentWeekKey,
  selectedWeek,
  hasNextPage,
  hasPrevPage,
  currentPage,
  totalPages,
  closeLeaderboardModal,
  setMainTab,
  setSubTab,
  nextPage,
  prevPage,
  getUserRankForCategory,
  getExclusiveItemById,
  guildLeaderboardEntries,
  myGuildRank,
  setGuildLeaderboardData,
  type MainTab,
  type SubTab,
} from '../../state/leaderboard.signals.js';
import { displayName } from '../../state/profile.signals.js';
import {
  fetchPlayerLeaderboard,
  fetchUserRanks,
  fetchAvailableRewards,
  loadLeaderboardData,
  claimReward,
} from '../../api/leaderboard.js';
import styles from './LeaderboardModal.module.css';

// Tab configurations (labels are translation keys)
const MAIN_TABS: { id: MainTab; labelKey: string; icon: string }[] = [
  { id: 'permanent', labelKey: 'leaderboard.tabs.permanent', icon: '🏛️' },
  { id: 'weekly', labelKey: 'leaderboard.tabs.weekly', icon: '📅' },
  { id: 'guild', labelKey: 'leaderboard.tabs.guild', icon: '🏰' },
];

const SUB_TABS: Record<MainTab, { id: SubTab; labelKey: string; icon: string }[]> = {
  permanent: [
    { id: 'totalWaves', labelKey: 'leaderboard.subTabs.waves', icon: '🌊' },
    { id: 'honor', labelKey: 'leaderboard.subTabs.honor', icon: '⚔️' },
    { id: 'level', labelKey: 'leaderboard.subTabs.level', icon: '⭐' },
  ],
  weekly: [
    { id: 'weeklyWaves', labelKey: 'leaderboard.subTabs.waves', icon: '🌊' },
    { id: 'weeklyHonor', labelKey: 'leaderboard.subTabs.honor', icon: '⚔️' },
  ],
  guild: [
    { id: 'guildHonor', labelKey: 'leaderboard.subTabs.honor', icon: '⚔️' },
    { id: 'guildTrophies', labelKey: 'leaderboard.subTabs.trophies', icon: '🏆' },
  ],
};

// Score label keys mapping to translation keys
const SCORE_LABEL_KEYS: Record<string, string> = {
  totalWaves: 'leaderboard.scoreLabels.totalWaves',
  honor: 'leaderboard.scoreLabels.honor',
  level: 'leaderboard.scoreLabels.level',
  weeklyWaves: 'leaderboard.scoreLabels.weeklyWaves',
  weeklyHonor: 'leaderboard.scoreLabels.weeklyHonor',
  guildHonor: 'leaderboard.scoreLabels.guildHonor',
  guildTrophies: 'leaderboard.scoreLabels.guildTrophies',
};

export function LeaderboardModal() {
  const { t } = useTranslation('common');
  const isVisible = showLeaderboardModal.value;
  const mainTab = activeMainTab.value;
  const subTab = activeSubTab.value;
  const entries = leaderboardEntries.value;
  const loading = leaderboardLoading.value;
  const error = leaderboardError.value;
  const rewards = availableRewards.value;
  const hasRewards = hasUnclaimedRewards.value;
  const currentWeek = currentWeekKey.value;
  const week = selectedWeek.value || currentWeek;
  const userName = displayName.value;

  // Load data when modal opens
  useEffect(() => {
    if (isVisible) {
      loadLeaderboardData();
    }
  }, [isVisible]);

  // Fetch leaderboard when tab or page changes
  useEffect(() => {
    if (!isVisible) return;

    // Handle guild leaderboard separately
    if (subTab === 'guildHonor' || subTab === 'guildTrophies') {
      leaderboardLoading.value = true;
      getGuildLeaderboard({
        limit: leaderboardLimit.value,
        offset: leaderboardOffset.value,
      })
        .then((response) => {
          setGuildLeaderboardData(response.entries, response.total, response.myGuildRank);
        })
        .catch((err) => {
          leaderboardError.value = err.message || t('leaderboard.guildLoadError');
        })
        .finally(() => {
          leaderboardLoading.value = false;
        });
      return;
    }

    const category = subTab as PlayerLeaderboardCategory;
    fetchPlayerLeaderboard(category, {
      limit: leaderboardLimit.value,
      offset: leaderboardOffset.value,
      week: mainTab === 'weekly' ? week : undefined,
    });
  }, [isVisible, subTab, leaderboardOffset.value, week, mainTab]);

  // Handle main tab change
  const handleMainTabChange = useCallback((tab: MainTab) => {
    setMainTab(tab);
  }, []);

  // Handle sub tab change
  const handleSubTabChange = useCallback((tab: SubTab) => {
    setSubTab(tab);
  }, []);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    if (subTab === 'guildHonor' || subTab === 'guildTrophies') {
      leaderboardLoading.value = true;
      getGuildLeaderboard({
        limit: leaderboardLimit.value,
        offset: leaderboardOffset.value,
      })
        .then((response) => {
          setGuildLeaderboardData(response.entries, response.total, response.myGuildRank);
        })
        .catch((err) => {
          leaderboardError.value = err.message || t('leaderboard.guildLoadError');
        })
        .finally(() => {
          leaderboardLoading.value = false;
        });
      return;
    }

    fetchPlayerLeaderboard(subTab as PlayerLeaderboardCategory, {
      limit: leaderboardLimit.value,
      offset: leaderboardOffset.value,
      week: mainTab === 'weekly' ? week : undefined,
    });
    fetchUserRanks(mainTab === 'weekly' ? week : undefined);
  }, [subTab, mainTab, week]);

  // Handle claim reward
  const handleClaimReward = useCallback(async (rewardId: string) => {
    try {
      await claimReward(rewardId);
      // Refresh rewards after claiming
      await fetchAvailableRewards();
    } catch (error) {
      console.error('Failed to claim reward:', error);
    }
  }, []);

  // Get user's rank for current category
  const userRank = getUserRankForCategory(subTab as PlayerLeaderboardCategory);

  if (!isVisible) return null;

  return (
    <Modal isOpen={isVisible} onClose={closeLeaderboardModal} title={`🏆 ${t('leaderboard.title')}`} size="large" bodyClass={styles.modalBody}>
      <div class={styles.modalPanel}>

        {/* Main Tab Bar */}
        <div class={styles.tabBar}>
          {MAIN_TABS.map((tab) => (
            <button
              key={tab.id}
              class={`${styles.tab} ${mainTab === tab.id ? styles.active : ''}`}
              onClick={() => handleMainTabChange(tab.id)}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>

        {/* Sub Tab Bar */}
        <div class={styles.subTabBar}>
          {SUB_TABS[mainTab].map((tab) => (
            <button
              key={tab.id}
              class={`${styles.subTab} ${subTab === tab.id ? styles.active : ''}`}
              onClick={() => handleSubTabChange(tab.id)}
            >
              <span class={styles.subTabIcon}>{tab.icon}</span>
              {t(tab.labelKey)}
            </button>
          ))}
        </div>


        {/* Rewards Panel (if has unclaimed rewards) */}
        {hasRewards && (
          <RewardsPanel rewards={rewards} onClaim={handleClaimReward} t={t} />
        )}

        {/* User Rank Card */}
        {userRank && userName && (
          <UserRankCard
            rank={userRank.rank}
            score={userRank.score}
            userName={userName}
            category={subTab}
            t={t}
          />
        )}

        {/* Leaderboard Content */}
        <div class={styles.leaderboardContent}>
          <div class={styles.listHeader}>
            <span class={styles.listTitle}>TOP 100</span>
            <button class={styles.refreshButton} onClick={handleRefresh}>
              {t('leaderboard.refresh')}
            </button>
          </div>

          {loading ? (
            <div class={styles.loadingContainer}>
              <div class={styles.loadingSpinner} />
              <span>{t('leaderboard.loading')}</span>
            </div>
          ) : error ? (
            <div class={styles.emptyState}>
              <span class={styles.emptyIcon}>⚠️</span>
              <span class={styles.emptyTitle}>{t('leaderboard.error')}</span>
              <span class={styles.emptyMessage}>{error}</span>
            </div>
          ) : mainTab === 'guild' ? (
            // Guild leaderboard
            guildLeaderboardEntries.value.length === 0 ? (
              <div class={styles.emptyState}>
                <span class={styles.emptyIcon}>🏰</span>
                <span class={styles.emptyTitle}>{t('leaderboard.noGuilds')}</span>
                <span class={styles.emptyMessage}>
                  {t('leaderboard.noGuildsMessage')}
                </span>
              </div>
            ) : (
              <>
                {guildLeaderboardEntries.value.map((entry) => (
                  <GuildLeaderboardEntryRow
                    key={entry.guildId}
                    entry={entry}
                    isMyGuild={entry.rank === myGuildRank.value}
                    t={t}
                  />
                ))}
              </>
            )
          ) : entries.length === 0 ? (
            <div class={styles.emptyState}>
              <span class={styles.emptyIcon}>📊</span>
              <span class={styles.emptyTitle}>{t('leaderboard.noData')}</span>
              <span class={styles.emptyMessage}>
                {t('leaderboard.noDataMessage')}
              </span>
            </div>
          ) : (
            <>
              {entries.map((entry) => (
                <LeaderboardEntry
                  key={entry.userId}
                  entry={entry}
                  category={subTab}
                  isCurrentUser={userName === entry.displayName}
                  t={t}
                />
              ))}
            </>
          )}
        </div>

        {/* Pagination */}
        {!loading && entries.length > 0 && (
          <div class={styles.pagination}>
            <button
              class={styles.pageButton}
              onClick={prevPage}
              disabled={!hasPrevPage.value}
            >
              {t('leaderboard.previous')}
            </button>
            <span class={styles.pageInfo}>
              {t('leaderboard.pageOf', { current: currentPage.value, total: totalPages.value })}
            </span>
            <button
              class={styles.pageButton}
              onClick={nextPage}
              disabled={!hasNextPage.value}
            >
              {t('leaderboard.next')}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface UserRankCardProps {
  rank: number | null;
  score: number;
  userName: string;
  category: SubTab;
  t: (key: string, params?: Record<string, unknown>) => string;
}

function UserRankCard({ rank, score, userName, category, t }: UserRankCardProps) {
  const scoreLabelKey = SCORE_LABEL_KEYS[category] || 'leaderboard.scoreLabels.points';
  const scoreLabel = t(scoreLabelKey);

  return (
    <div class={styles.userRankCard}>
      <div class={styles.userRankHeader}>{t('leaderboard.yourPosition')}</div>
      <div class={styles.userRankContent}>
        <div class={styles.userRank}>
          {rank ? `#${rank}` : <span class={styles.userRankUnranked}>—</span>}
        </div>
        <div class={styles.userAvatar}>👤</div>
        <div class={styles.userInfo}>
          <div class={styles.userName}>{userName}</div>
        </div>
        <div class={styles.userScoreSection}>
          <div class={styles.userScore}>
            {score.toLocaleString()} {scoreLabel}
          </div>
        </div>
      </div>
    </div>
  );
}

interface LeaderboardEntryProps {
  entry: PlayerLeaderboardEntry;
  category: SubTab;
  isCurrentUser: boolean;
  t: (key: string, params?: Record<string, unknown>) => string;
}

function LeaderboardEntry({ entry, category, isCurrentUser, t }: LeaderboardEntryProps) {
  const isPodium = entry.rank <= 3;
  const podiumClass = entry.rank === 1
    ? styles.first
    : entry.rank === 2
    ? styles.second
    : entry.rank === 3
    ? styles.third
    : '';

  const scoreLabelKey = SCORE_LABEL_KEYS[category] || 'leaderboard.scoreLabels.points';
  const scoreLabel = t(scoreLabelKey);

  // Get exclusive items info
  const exclusiveItemsInfo = entry.exclusiveItems
    .map((id) => getExclusiveItemById(id))
    .filter((item): item is ExclusiveItem => item !== undefined)
    .slice(0, 3); // Show max 3 items

  // Handle click to open hub preview (only for other players)
  const handleClick = useCallback(() => {
    if (!isCurrentUser) {
      openHubPreview(entry.userId);
    }
  }, [entry.userId, isCurrentUser]);

  return (
    <div
      class={`${styles.entry} ${isPodium ? styles.podium : ''} ${podiumClass} ${
        isCurrentUser ? styles.isCurrentUser : ''
      } ${!isCurrentUser ? styles.clickable : ''}`}
      onClick={handleClick}
      role={!isCurrentUser ? 'button' : undefined}
      tabIndex={!isCurrentUser ? 0 : undefined}
      onKeyDown={!isCurrentUser ? (e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); } : undefined}
    >
      <div class={styles.entryRank}>
        {entry.rank === 1 ? '👑' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`}
      </div>
      <div class={styles.entryAvatar}>
        👤
        {entry.isOnline && <span class={styles.onlineIndicator} title="Online" />}
      </div>
      <div class={styles.entryInfo}>
        <div class={styles.entryNameRow}>
          <span class={styles.entryName}>{entry.displayName}</span>
          {entry.guildId && entry.guildTag && (
            <GuildTag guildId={entry.guildId} tag={entry.guildTag} className={styles.entryGuild} />
          )}
        </div>
        {exclusiveItemsInfo.length > 0 && (
          <div class={styles.entryExclusives}>
            {exclusiveItemsInfo.map((item) => (
              <span
                key={item.id}
                class={`${styles.exclusiveTag} ${styles[item.rarity]}`}
                title={item.polishName}
              >
                {item.icon} {item.polishName}
              </span>
            ))}
          </div>
        )}
      </div>
      <div class={styles.entryScore}>
        {entry.score.toLocaleString()} {scoreLabel}
      </div>
      <div class={styles.entryLevel}>Lv.{entry.level}</div>
    </div>
  );
}

interface GuildLeaderboardEntryRowProps {
  entry: GuildLeaderboardEntry;
  isMyGuild: boolean;
  t: (key: string, params?: Record<string, unknown>) => string;
}

function GuildLeaderboardEntryRow({ entry, isMyGuild, t }: GuildLeaderboardEntryRowProps) {
  const isPodium = entry.rank <= 3;
  const podiumClass = entry.rank === 1
    ? styles.first
    : entry.rank === 2
    ? styles.second
    : entry.rank === 3
    ? styles.third
    : '';

  return (
    <div
      class={`${styles.entry} ${isPodium ? styles.podium : ''} ${podiumClass} ${
        isMyGuild ? styles.isCurrentUser : ''
      }`}
    >
      <div class={styles.entryRank}>
        {entry.rank === 1 ? '👑' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`}
      </div>
      <div class={styles.entryAvatar}>🏰</div>
      <div class={styles.entryInfo}>
        <div class={styles.entryNameRow}>
          <span class={styles.entryName}>{entry.guildName}</span>
          <span class={styles.guildTagBadge}>[{entry.guildTag}]</span>
        </div>
        <div class={styles.entryMeta}>
          <span>👥 {entry.memberCount} {t('leaderboard.members')}</span>
          <span>⚔️ {t('leaderboard.wins')}: {entry.battlesWon} / {t('leaderboard.losses')}: {entry.battlesLost}</span>
        </div>
      </div>
      <div class={styles.entryScore}>
        {entry.honor.toLocaleString()} {t('leaderboard.scoreLabels.honor')}
      </div>
      <div class={styles.entryLevel}>Lv.{entry.level}</div>
    </div>
  );
}

interface RewardsPanelProps {
  rewards: AvailableReward[];
  onClaim: (rewardId: string) => void;
  t: (key: string, params?: Record<string, unknown>) => string;
}

function RewardsPanel({ rewards, onClaim, t }: RewardsPanelProps) {
  return (
    <div class={styles.rewardsPanel}>
      <div class={styles.rewardsPanelHeader}>
        <span class={styles.rewardsIcon}>🎁</span>
        <span class={styles.rewardsTitle}>{t('leaderboard.rewardsToClaim')}</span>
        <span class={styles.rewardsBadge}>{rewards.length}</span>
      </div>
      {rewards.map((reward) => (
        <RewardCard key={reward.id} reward={reward} onClaim={onClaim} t={t} />
      ))}
    </div>
  );
}

interface RewardCardProps {
  reward: AvailableReward;
  onClaim: (rewardId: string) => void;
  t: (key: string, params?: Record<string, unknown>) => string;
}

function RewardCard({ reward, onClaim, t }: RewardCardProps) {
  const categoryLabel = reward.category === 'waves' ? t('leaderboard.subTabs.waves') : t('leaderboard.subTabs.honor');
  const categoryIcon = reward.category === 'waves' ? '🌊' : '⚔️';

  // Get exclusive items info
  const exclusiveItemsInfo = reward.itemIds
    .map((id) => getExclusiveItemById(id))
    .filter((item): item is ExclusiveItem => item !== undefined);

  return (
    <div class={styles.rewardCard}>
      <div class={styles.rewardHeader}>
        <div class={styles.rewardCategory}>
          {categoryIcon} {categoryLabel}
          <span class={styles.rewardRank}>#{reward.rank}</span>
        </div>
        <div class={styles.rewardWeek}>{reward.weekKey}</div>
      </div>
      <div class={styles.rewardItems}>
        {reward.goldAmount > 0 && (
          <span class={`${styles.rewardItem} ${styles.gold}`}>
            💰 {reward.goldAmount.toLocaleString()}
          </span>
        )}
        {reward.dustAmount > 0 && (
          <span class={`${styles.rewardItem} ${styles.dust}`}>
            💎 {reward.dustAmount.toLocaleString()}
          </span>
        )}
      </div>
      {exclusiveItemsInfo.length > 0 && (
        <div class={styles.rewardExclusiveItems}>
          {exclusiveItemsInfo.map((item) => (
            <span
              key={item.id}
              class={`${styles.exclusiveTag} ${styles[item.rarity]}`}
            >
              {item.icon} {item.polishName}
            </span>
          ))}
        </div>
      )}
      <button
        class={styles.claimButton}
        onClick={() => onClaim(reward.id)}
      >
        {t('leaderboard.claimReward')}
      </button>
    </div>
  );
}

export default LeaderboardModal;
