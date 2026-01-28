/**
 * LeaderboardModal - Main modal component for leaderboard system
 */
import { useEffect, useCallback, useRef, useState } from 'preact/hooks';
import { openHubPreview } from '../../state/hubPreview.signals.js';
import { Modal } from '../shared/Modal.js';
import { GuildTag } from '../shared/GuildTag.js';
import { OnlineStatusIndicator } from '../shared/OnlineStatusIndicator.js';
import { useTranslation, currentLanguage } from '../../i18n/useTranslation.js';
import { DamageIcon } from '../icons/index.js';
import type { ComponentChildren } from 'preact';
import type { PlayerLeaderboardEntry, PlayerLeaderboardCategory, AvailableReward, ExclusiveItem, GuildLeaderboardEntry } from '@arcade/protocol';
import { WAVES_REWARD_TIERS, HONOR_REWARD_TIERS, type RewardTier } from '@arcade/sim-core';
import { getGuildLeaderboard } from '../../api/guild.js';
import {
  showLeaderboardModal,
  activeMainTab,
  activeSubTab,
  leaderboardEntries,
  leaderboardOffset,
  leaderboardLimit,
  leaderboardLoading,
  leaderboardLoadingMore,
  leaderboardError,
  availableRewards,
  hasUnclaimedRewards,
  currentWeekKey,
  selectedWeek,
  leaderboardSearchQuery,
  hasMoreEntries,
  hasMoreGuildEntries,
  hasMoreGuildTrophyEntries,
  closeLeaderboardModal,
  setMainTab,
  setSubTab,
  setLeaderboardSearch,
  getUserRankForCategory,
  getExclusiveItemById,
  guildLeaderboardEntries,
  guildTrophyLeaderboardEntries,
  myGuildRank,
  setGuildLeaderboardData,
  setGuildTrophyLeaderboardData,
  setLeaderboardData,
  formattedTimeUntilReset,
  type MainTab,
  type SubTab,
} from '../../state/leaderboard.signals.js';
import { displayName } from '../../state/profile.signals.js';
import { getUserId } from '../../api/auth.js';
import { playerGuild } from '../../state/guild.signals.js';
import {
  fetchPlayerLeaderboard,
  fetchAvailableRewards,
  loadLeaderboardData,
  claimReward,
  fetchGuildTrophyLeaderboard,
  type GuildTrophyLeaderboardEntry,
} from '../../api/leaderboard.js';
import styles from './LeaderboardModal.module.css';

// Tab configurations (labels are translation keys)
const MAIN_TABS: { id: MainTab; labelKey: string; icon: string }[] = [
  { id: 'permanent', labelKey: 'leaderboard.tabs.permanent', icon: '🏛️' },
  { id: 'weekly', labelKey: 'leaderboard.tabs.weekly', icon: '📅' },
  { id: 'guild', labelKey: 'leaderboard.tabs.guild', icon: '🏰' },
];

// Helper to get sub tab icon
function getSubTabIcon(tabId: string, size: number = 18): ComponentChildren {
  if (tabId.includes('honor')) {
    return <DamageIcon size={size} />;
  }
  switch (tabId) {
    case 'totalWaves':
    case 'weeklyWaves':
      return '🌊';
    case 'level':
      return '⭐';
    case 'guildTrophies':
      return '🏆';
    default:
      return '📊';
  }
}

const SUB_TABS: Record<MainTab, { id: SubTab; labelKey: string; icon?: string }[]> = {
  permanent: [
    { id: 'totalWaves', labelKey: 'leaderboard.subTabs.waves', icon: '🌊' },
    { id: 'honor', labelKey: 'leaderboard.subTabs.honor' },
    { id: 'level', labelKey: 'leaderboard.subTabs.level', icon: '⭐' },
  ],
  weekly: [
    { id: 'weeklyWaves', labelKey: 'leaderboard.subTabs.waves', icon: '🌊' },
    { id: 'weeklyHonor', labelKey: 'leaderboard.subTabs.honor' },
  ],
  guild: [
    { id: 'guildHonor', labelKey: 'leaderboard.subTabs.honor' },
    { id: 'guildTrophies', labelKey: 'leaderboard.subTabs.guildTrophies', icon: '🏆' },
  ],
};

// Helper to get localized item name
function getLocalizedItemName(item: ExclusiveItem): string {
  return currentLanguage.value === 'pl' ? item.polishName : item.name;
}

// Score label keys mapping to translation keys
const SCORE_LABEL_KEYS: Record<string, string> = {
  totalWaves: 'leaderboard.scoreLabels.totalWaves',
  honor: 'leaderboard.scoreLabels.honor',
  level: 'leaderboard.scoreLabels.level',
  weeklyWaves: 'leaderboard.scoreLabels.weeklyWaves',
  weeklyHonor: 'leaderboard.scoreLabels.weeklyHonor',
  guildHonor: 'leaderboard.scoreLabels.guildHonor',
};

export function LeaderboardModal() {
  const { t } = useTranslation('common');
  const isVisible = showLeaderboardModal.value;
  const mainTab = activeMainTab.value;
  const subTab = activeSubTab.value;
  const entries = leaderboardEntries.value;
  const guildEntries = guildLeaderboardEntries.value;
  const loading = leaderboardLoading.value;
  const loadingMore = leaderboardLoadingMore.value;
  const error = leaderboardError.value;
  const rewards = availableRewards.value;
  const hasRewards = hasUnclaimedRewards.value;
  const currentWeek = currentWeekKey.value;
  const week = selectedWeek.value || currentWeek;
  const userName = displayName.value;
  const searchQuery = leaderboardSearchQuery.value;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [showRewardsPreview, setShowRewardsPreview] = useState(false);

  // Get week dates from weekKey (format: YYYY-Www)
  const getWeekDates = useCallback((weekKey: string) => {
    if (!weekKey) return { start: '', end: '' };
    const match = weekKey.match(/^(\d{4})-W(\d{2})$/);
    if (!match) return { start: '', end: '' };

    const year = parseInt(match[1], 10);
    const weekNum = parseInt(match[2], 10);

    // Get first day of the year
    const jan1 = new Date(year, 0, 1);
    // Get the day of week for jan 1 (0=Sun, 1=Mon, etc)
    const jan1Day = jan1.getDay();
    // Calculate days to add to get to the Monday of week 1
    const daysToMonday = jan1Day <= 1 ? 1 - jan1Day : 8 - jan1Day;
    const week1Monday = new Date(year, 0, 1 + daysToMonday);

    // Calculate the Monday of the target week
    const mondayOfWeek = new Date(week1Monday);
    mondayOfWeek.setDate(week1Monday.getDate() + (weekNum - 1) * 7);

    // Calculate Sunday
    const sundayOfWeek = new Date(mondayOfWeek);
    sundayOfWeek.setDate(mondayOfWeek.getDate() + 6);

    const formatDate = (date: Date) => {
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      return `${day}.${month}`;
    };

    return {
      start: formatDate(mondayOfWeek),
      end: formatDate(sundayOfWeek),
    };
  }, []);

  // Load initial data when modal opens or tab/search changes
  const loadData = useCallback((append = false) => {
    const offset = append ? leaderboardOffset.value : 0;
    const isLoadingMore = append;

    if (subTab === 'guildHonor') {
      if (isLoadingMore) {
        leaderboardLoadingMore.value = true;
      } else {
        leaderboardLoading.value = true;
      }
      getGuildLeaderboard({
        limit: leaderboardLimit.value,
        offset,
      })
        .then((response) => {
          setGuildLeaderboardData(response.entries, response.total, response.myGuildRank, append);
        })
        .catch((err) => {
          leaderboardError.value = err.message || t('leaderboard.guildLoadError');
        })
        .finally(() => {
          leaderboardLoading.value = false;
          leaderboardLoadingMore.value = false;
        });
      return;
    }

    if (subTab === 'guildTrophies') {
      if (isLoadingMore) {
        leaderboardLoadingMore.value = true;
      } else {
        leaderboardLoading.value = true;
      }
      fetchGuildTrophyLeaderboard({
        limit: leaderboardLimit.value,
        offset,
      })
        .then((response) => {
          setGuildTrophyLeaderboardData(response.entries, response.total, append);
        })
        .catch((err) => {
          leaderboardError.value = err.message || t('leaderboard.guildLoadError');
        })
        .finally(() => {
          leaderboardLoading.value = false;
          leaderboardLoadingMore.value = false;
        });
      return;
    }

    const category = subTab as PlayerLeaderboardCategory;
    if (isLoadingMore) {
      leaderboardLoadingMore.value = true;
    } else {
      leaderboardLoading.value = true;
    }

    fetchPlayerLeaderboard(category, {
      limit: leaderboardLimit.value,
      offset,
      week: mainTab === 'weekly' ? week : undefined,
      search: searchQuery || undefined,
    })
      .then((response) => {
        if (response) {
          setLeaderboardData(response.entries, response.total, response.timeUntilReset, append);
        }
      })
      .catch((err) => {
        leaderboardError.value = err?.message || t('leaderboard.error');
      })
      .finally(() => {
        leaderboardLoading.value = false;
        leaderboardLoadingMore.value = false;
      });
  }, [subTab, mainTab, week, searchQuery, t]);

  // Load data when modal opens
  useEffect(() => {
    if (isVisible) {
      loadLeaderboardData();
      loadData(false);
    }
  }, [isVisible]);

  // Reload when tab or search changes
  useEffect(() => {
    if (!isVisible) return;
    loadData(false);
  }, [subTab, mainTab, searchQuery]);

  // Handle scroll for infinite loading
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || loading || loadingMore) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const isNearBottom = scrollTop + clientHeight >= scrollHeight - 100;

    if (isNearBottom) {
      let hasMore = hasMoreEntries.value;
      if (subTab === 'guildHonor') {
        hasMore = hasMoreGuildEntries.value;
      } else if (subTab === 'guildTrophies') {
        hasMore = hasMoreGuildTrophyEntries.value;
      }
      if (hasMore) {
        loadData(true);
      }
    }
  }, [loading, loadingMore, mainTab, loadData]);

  // Handle main tab change
  const handleMainTabChange = useCallback((tab: MainTab) => {
    setMainTab(tab);
  }, []);

  // Handle sub tab change
  const handleSubTabChange = useCallback((tab: SubTab) => {
    setSubTab(tab);
  }, []);

  // Handle search input with debounce
  const handleSearchChange = useCallback((e: Event) => {
    const value = (e.target as HTMLInputElement).value;
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = window.setTimeout(() => {
      setLeaderboardSearch(value);
    }, 300);
  }, []);

  // Handle clear search
  const handleClearSearch = useCallback(() => {
    if (searchInputRef.current) {
      searchInputRef.current.value = '';
    }
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    setLeaderboardSearch('');
  }, []);

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
    <Modal isOpen={isVisible} onClose={closeLeaderboardModal} title={`🏆 ${t('leaderboard.title')}`} size="large" class={styles.modalContent} bodyClass={styles.modalBody}>
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
              <span class={styles.subTabIcon}>
                {tab.icon ? tab.icon : getSubTabIcon(tab.id, 18)}
              </span>
              {t(tab.labelKey)}
            </button>
          ))}
        </div>

        {/* Week Info Banner (for weekly leaderboards) */}
        {mainTab === 'weekly' && (
          <WeekInfoBanner
            weekDates={getWeekDates(week)}
            timeUntilReset={formattedTimeUntilReset.value}
            t={t}
          />
        )}

        {/* Rewards Preview Panel (for weekly leaderboards) */}
        {mainTab === 'weekly' && (
          <RewardsPreviewPanel
            category={subTab === 'weeklyHonor' ? 'honor' : 'waves'}
            userRank={userRank?.rank ?? null}
            isOpen={showRewardsPreview}
            onToggle={() => setShowRewardsPreview(!showRewardsPreview)}
            t={t}
          />
        )}

        {/* Rewards Panel (if has unclaimed rewards) */}
        {hasRewards && (
          <RewardsPanel rewards={rewards} onClaim={handleClaimReward} t={t} />
        )}

        {/* User Rank Card (for player leaderboards) */}
        {mainTab !== 'guild' && userRank && userName && (
          <UserRankCard
            rank={userRank.rank}
            score={userRank.score}
            userName={userName}
            category={subTab}
            t={t}
          />
        )}

        {/* Guild Rank Card (for guild leaderboards) */}
        {mainTab === 'guild' && playerGuild.value && (
          <GuildRankCard
            rank={myGuildRank.value}
            guildName={playerGuild.value.name}
            guildTag={playerGuild.value.tag}
            honor={playerGuild.value.honor}
            t={t}
          />
        )}

        {/* Leaderboard Content */}
        <div
          class={styles.leaderboardContent}
          ref={scrollContainerRef}
          onScroll={handleScroll}
        >
          {/* Search Input */}
          <div class={styles.searchContainer}>
            <input
              ref={searchInputRef}
              type="text"
              class={styles.searchInput}
              placeholder={t('leaderboard.searchPlaceholder')}
              onInput={handleSearchChange}
              defaultValue={searchQuery}
            />
            {searchQuery ? (
              <button
                type="button"
                class={styles.clearButton}
                onClick={handleClearSearch}
                aria-label={t('shared.close')}
              >
                ×
              </button>
            ) : (
              <span class={styles.searchIcon}>🔍</span>
            )}
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
          ) : subTab === 'guildTrophies' ? (
            // Guild trophy leaderboard
            guildTrophyLeaderboardEntries.value.length === 0 ? (
              <div class={styles.emptyState}>
                <span class={styles.emptyIcon}>🏆</span>
                <span class={styles.emptyTitle}>{t('leaderboard.noTrophies')}</span>
                <span class={styles.emptyMessage}>
                  {t('leaderboard.noTrophiesMessage')}
                </span>
              </div>
            ) : (
              <>
                {guildTrophyLeaderboardEntries.value.map((entry) => (
                  <GuildTrophyEntryRow
                    key={entry.guildId}
                    entry={entry}
                    isMyGuild={playerGuild.value?.id === entry.guildId}
                    t={t}
                  />
                ))}
                {loadingMore && (
                  <div class={styles.loadingMore}>
                    <div class={styles.loadingSpinner} />
                  </div>
                )}
              </>
            )
          ) : mainTab === 'guild' ? (
            // Guild honor leaderboard
            guildEntries.length === 0 ? (
              <div class={styles.emptyState}>
                <span class={styles.emptyIcon}>🏰</span>
                <span class={styles.emptyTitle}>{t('leaderboard.noGuilds')}</span>
                <span class={styles.emptyMessage}>
                  {t('leaderboard.noGuildsMessage')}
                </span>
              </div>
            ) : (
              <>
                {guildEntries.map((entry) => (
                  <GuildLeaderboardEntryRow
                    key={entry.guildId}
                    entry={entry}
                    isMyGuild={entry.rank === myGuildRank.value}
                    t={t}
                  />
                ))}
                {loadingMore && (
                  <div class={styles.loadingMore}>
                    <div class={styles.loadingSpinner} />
                  </div>
                )}
              </>
            )
          ) : entries.length === 0 ? (
            <div class={styles.emptyState}>
              <span class={styles.emptyIcon}>📊</span>
              <span class={styles.emptyTitle}>{t('leaderboard.noData')}</span>
              <span class={styles.emptyMessage}>
                {searchQuery ? t('leaderboard.noSearchResults') : t('leaderboard.noDataMessage')}
              </span>
            </div>
          ) : (
            <>
              {entries.map((entry) => (
                <LeaderboardEntry
                  key={entry.userId}
                  entry={entry}
                  category={subTab}
                  isCurrentUser={getUserId() === entry.userId}
                  t={t}
                />
              ))}
              {loadingMore && (
                <div class={styles.loadingMore}>
                  <div class={styles.loadingSpinner} />
                </div>
              )}
            </>
          )}
        </div>
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

interface GuildRankCardProps {
  rank: number | null;
  guildName: string;
  guildTag: string;
  honor: number;
  t: (key: string, params?: Record<string, unknown>) => string;
}

function GuildRankCard({ rank, guildName, guildTag, honor, t }: GuildRankCardProps) {
  return (
    <div class={styles.userRankCard}>
      <div class={styles.userRankHeader}>{t('leaderboard.yourGuildPosition')}</div>
      <div class={styles.userRankContent}>
        <div class={styles.userRank}>
          {rank ? `#${rank}` : <span class={styles.userRankUnranked}>—</span>}
        </div>
        <div class={styles.userInfo}>
          <div class={styles.userName}>{guildName}</div>
          <div class={styles.userGuildTag}>[{guildTag}]</div>
        </div>
        <div class={styles.userScoreSection}>
          <div class={styles.userScore}>
            {honor.toLocaleString()} {t('leaderboard.scoreLabels.honor')}
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
      <div class={styles.entryInfo}>
        <div class={styles.entryNameRow}>
          <span class={styles.entryName}>
            {entry.displayName}
            <OnlineStatusIndicator isOnline={entry.isOnline} />
          </span>
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
                title={getLocalizedItemName(item)}
              >
                {item.icon} {getLocalizedItemName(item)}
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
      <div class={styles.entryInfo}>
        <div class={styles.entryNameRow}>
          <span class={styles.entryName}>{entry.guildName}</span>
          <span class={styles.guildTagBadge}>[{entry.guildTag}]</span>
        </div>
        <div class={styles.entryMeta}>
          <span>👥 {entry.memberCount} {t('leaderboard.members')}</span>
        </div>
      </div>
      <div class={styles.entryScore}>
        {entry.honor.toLocaleString()} {t('leaderboard.scoreLabels.honor')}
      </div>
    </div>
  );
}

interface GuildTrophyEntryRowProps {
  entry: GuildTrophyLeaderboardEntry;
  isMyGuild: boolean;
  t: (key: string, params?: Record<string, unknown>) => string;
}

function GuildTrophyEntryRow({ entry, isMyGuild, t }: GuildTrophyEntryRowProps) {
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
      <div class={styles.entryInfo}>
        <div class={styles.entryNameRow}>
          <span class={styles.entryName}>{entry.guildName}</span>
          <span class={styles.guildTagBadge}>[{entry.guildTag}]</span>
        </div>
        <div class={styles.entryMeta}>
          <span>🏆 {entry.trophyCount} {t('leaderboard.trophies')}</span>
          <span style={{ marginLeft: '8px' }}>👥 {entry.memberCount}</span>
        </div>
      </div>
      <div class={styles.entryScore}>
        +{entry.totalStatBonus}% {t('leaderboard.scoreLabels.statBonus')}
      </div>
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
  const categoryIcon = reward.category === 'waves' ? '🌊' : <DamageIcon size={18} />;

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
            🪙 {reward.goldAmount.toLocaleString()}
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
              {item.icon} {getLocalizedItemName(item)}
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

// ============================================================================
// WEEK INFO BANNER
// ============================================================================

interface WeekInfoBannerProps {
  weekDates: { start: string; end: string };
  timeUntilReset: string;
  t: (key: string, params?: Record<string, unknown>) => string;
}

function WeekInfoBanner({ weekDates, timeUntilReset, t }: WeekInfoBannerProps) {
  if (!weekDates.start || !weekDates.end) return null;

  return (
    <div class={styles.weekInfoBanner}>
      <div class={styles.weekPeriod}>
        <span class={styles.weekPeriodIcon}>📅</span>
        <span class={styles.weekPeriodText}>
          {t('leaderboard.weekPeriod', { start: weekDates.start, end: weekDates.end })}
        </span>
      </div>
      {timeUntilReset && (
        <div class={styles.weekResetTime}>
          <span class={styles.resetLabel}>{t('leaderboard.resetsIn')}</span>
          <span class={styles.resetTime}>{timeUntilReset}</span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// REWARDS PREVIEW PANEL
// ============================================================================

interface RewardsPreviewPanelProps {
  category: 'waves' | 'honor';
  userRank: number | null;
  isOpen: boolean;
  onToggle: () => void;
  t: (key: string, params?: Record<string, unknown>) => string;
}

function RewardsPreviewPanel({ category, userRank, isOpen, onToggle, t }: RewardsPreviewPanelProps) {
  const tiers = category === 'waves' ? WAVES_REWARD_TIERS : HONOR_REWARD_TIERS;

  const getTierLabel = (tier: RewardTier): string => {
    if (tier.maxRank === 1) return '#1';
    if (tier.maxRank === 2) return '#2';
    if (tier.maxRank === 3) return '#3';
    // For ranges, show "Top X"
    return t('leaderboard.top', { rank: tier.maxRank });
  };

  const getTierBadgeClass = (tier: RewardTier): string => {
    if (tier.maxRank === 1) return styles.gold;
    if (tier.maxRank === 2) return styles.silver;
    if (tier.maxRank === 3) return styles.bronze;
    if (tier.maxRank <= 10) return styles.elite;
    if (tier.maxRank <= 25) return styles.veteran;
    return styles.default;
  };

  const isUserInTier = (tier: RewardTier, prevMaxRank: number): boolean => {
    if (!userRank) return false;
    return userRank > prevMaxRank && userRank <= tier.maxRank;
  };

  return (
    <div class={styles.rewardsPreviewPanel}>
      <div class={styles.rewardsPreviewHeader} onClick={onToggle}>
        <div class={styles.rewardsPreviewTitle}>
          <span class={styles.rewardsPreviewIcon}>🏆</span>
          {t('leaderboard.availableRewards')}
        </div>
        <div class={styles.rewardsPreviewToggle}>
          {isOpen ? t('leaderboard.hideRewards') : t('leaderboard.viewRewards')}
          <span class={`${styles.rewardsPreviewToggleIcon} ${isOpen ? styles.expanded : ''}`}>▼</span>
        </div>
      </div>
      <div class={`${styles.rewardsPreviewContent} ${isOpen ? styles.expanded : ''}`}>
        {tiers.map((tier, index) => {
          const prevMaxRank = index > 0 ? tiers[index - 1].maxRank : 0;
          const isHighlighted = isUserInTier(tier, prevMaxRank);
          const exclusiveItems = tier.items
            .map((id) => getExclusiveItemById(id))
            .filter((item): item is ExclusiveItem => item !== undefined);

          return (
            <div
              key={tier.maxRank}
              class={`${styles.rewardTierRow} ${isHighlighted ? styles.highlighted : ''}`}
            >
              <div class={`${styles.tierRankBadge} ${getTierBadgeClass(tier)}`}>
                {getTierLabel(tier)}
              </div>
              <div class={styles.tierRewards}>
                {tier.gold > 0 && (
                  <span class={`${styles.tierRewardItem} ${styles.gold}`}>
                    🪙 {tier.gold.toLocaleString()}
                  </span>
                )}
                {tier.dust > 0 && (
                  <span class={`${styles.tierRewardItem} ${styles.dust}`}>
                    💎 {tier.dust.toLocaleString()}
                  </span>
                )}
                {exclusiveItems.length > 0 && (
                  <div class={styles.tierExclusiveItems}>
                    {exclusiveItems.slice(0, 2).map((item) => (
                      <span
                        key={item.id}
                        class={`${styles.exclusiveTag} ${styles[item.rarity]}`}
                        title={currentLanguage.value === 'pl' ? item.polishName : item.name}
                      >
                        {item.icon} {currentLanguage.value === 'pl' ? item.polishName : item.name}
                      </span>
                    ))}
                    {exclusiveItems.length > 2 && (
                      <span class={styles.exclusiveTag}>
                        {t('leaderboard.andMore', { count: exclusiveItems.length - 2 })}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default LeaderboardModal;
