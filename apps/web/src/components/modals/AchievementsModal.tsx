/**
 * Achievements Modal
 *
 * Displays permanent achievements (Hero Zero style "Heroic Deeds"):
 * - Category tabs for filtering
 * - Achievement cards with progress bars and tier indicators
 * - Reward claiming (single and bulk)
 * - Title management
 */

import type { AchievementCategory } from '@arcade/protocol';
import {
  achievementsData,
  achievementsLoading,
  achievementsError,
  achievementsModalVisible,
  hideAchievementsModal,
  claimingAchievement,
  claimingAll,
  settingTitle,
  selectedCategory,
  setSelectedCategory,
  filteredAchievements,
  totalUnclaimedCount,
  unlockedTitles,
  activeTitle,
  claimReward,
  claimAllRewards,
  setActiveTitle,
  getTierRomanNumeral,
  formatStatNumber,
} from '../../state/achievements.signals.js';
import { Modal } from '../shared/Modal.js';
import styles from './AchievementsModal.module.css';

// Category display names (Polish)
const CATEGORY_NAMES: Record<AchievementCategory | 'all', string> = {
  all: 'Wszystkie',
  combat: 'Walka',
  progression: 'Progres',
  collection: 'Kolekcja',
  economy: 'Ekonomia',
  pvp: 'PvP',
  guild: 'Gildia',
  challenge: 'Wyzwania',
  mastery: 'Mistrzostwo',
};

// Category icons
const CATEGORY_ICONS: Record<AchievementCategory | 'all', string> = {
  all: '\u2605',       // star
  combat: '\u2694',    // crossed swords
  progression: '\u2B06', // up arrow
  collection: '\u{1F3C6}', // trophy
  economy: '\u{1F4B0}',    // money bag
  pvp: '\u{1F94A}',        // boxing glove
  guild: '\u{1F3E0}',      // house
  challenge: '\u{1F3AF}',  // target
  mastery: '\u{1F9D9}',    // mage
};

// Rarity colors for materials
const RARITY_COLORS: Record<string, string> = {
  common: '#808080',
  uncommon: '#00ff00',
  rare: '#0088ff',
  epic: '#9932cc',
  legendary: '#ffd700',
};

export function AchievementsModal() {
  const isVisible = achievementsModalVisible.value;
  const data = achievementsData.value;
  const loading = achievementsLoading.value;
  const error = achievementsError.value;
  const claiming = claimingAchievement.value;
  const claimAllInProgress = claimingAll.value;
  const settingTitleInProgress = settingTitle.value;
  const currentCategory = selectedCategory.value;
  const achievements = filteredAchievements.value;
  const unclaimedCount = totalUnclaimedCount.value;
  const titles = unlockedTitles.value;
  const currentTitle = activeTitle.value;

  if (!isVisible) return null;

  const categories: (AchievementCategory | 'all')[] = [
    'all', 'combat', 'progression', 'collection', 'economy', 'pvp', 'guild', 'challenge', 'mastery'
  ];

  const handleClaimReward = async (achievementId: string, tier: number) => {
    await claimReward(achievementId as any, tier);
  };

  const handleClaimAll = async () => {
    await claimAllRewards();
  };

  const handleSetTitle = async (title: string | null) => {
    await setActiveTitle(title);
  };

  return (
    <Modal
      visible={isVisible}
      title="Osiagniecia"
      onClose={hideAchievementsModal}
      size="large"
      ariaLabel="Okno osiagniec"
    >
      {/* Title selector */}
      {titles.length > 0 && (
        <div class={styles.titleSelector}>
          <span class={styles.titleLabel}>Aktywny tytul:</span>
          <select
            class={styles.titleSelect}
            value={currentTitle ?? ''}
            onChange={(e) => handleSetTitle(e.currentTarget.value || null)}
            disabled={settingTitleInProgress}
          >
            <option value="">Brak</option>
            {titles.map(title => (
              <option key={title} value={title}>{title}</option>
            ))}
          </select>
        </div>
      )}

      {/* Category tabs */}
      <div class={styles.categoryTabs}>
        {categories.map(cat => (
          <button
            key={cat}
            class={`${styles.categoryTab} ${currentCategory === cat ? styles.active : ''}`}
            onClick={() => setSelectedCategory(cat)}
          >
            <span class={styles.categoryIcon}>{CATEGORY_ICONS[cat]}</span>
            <span class={styles.categoryName}>{CATEGORY_NAMES[cat]}</span>
            {cat !== 'all' && data?.categoryProgress?.[cat] && (
              <span class={styles.categoryProgress}>
                {data.categoryProgress[cat].completed}/{data.categoryProgress[cat].total}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {loading && (
        <div class={styles.loading}>
          <div class={styles.spinner} />
          <span>Ladowanie osiagniec...</span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div class={styles.error}>
          <span class={styles.errorIcon}>\u26A0</span>
          <span>{error}</span>
        </div>
      )}

      {/* Achievements list */}
      {!loading && !error && (
        <div class={styles.achievementsList}>
          {achievements.length === 0 ? (
            <div class={styles.noAchievements}>
              Brak osiagniec w tej kategorii
            </div>
          ) : (
            achievements.map(({ definition, progress }) => {
              const nextTierDef = progress.nextTier ? definition.tiers.find(t => t.tier === progress.nextTier) : null;
              const progressPercent = nextTierDef
                ? Math.min(100, (progress.currentProgress / nextTierDef.target) * 100)
                : 100;

              return (
                <div
                  key={definition.id}
                  class={`${styles.achievementCard} ${progress.hasUnclaimedReward ? styles.hasReward : ''}`}
                >
                  {/* Header */}
                  <div class={styles.achievementHeader}>
                    <div class={styles.achievementInfo}>
                      <span class={styles.achievementIcon}>{CATEGORY_ICONS[definition.category]}</span>
                      <div class={styles.achievementTitles}>
                        <span class={styles.achievementName}>{definition.name}</span>
                        <span class={styles.achievementDesc}>{definition.description}</span>
                      </div>
                    </div>
                    <div class={styles.tierBadge}>
                      {progress.currentTier > 0 ? getTierRomanNumeral(progress.currentTier) : '-'}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div class={styles.progressSection}>
                    <div class={styles.progressBar}>
                      <div
                        class={styles.progressFill}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <div class={styles.progressText}>
                      <span>{formatStatNumber(progress.currentProgress)}</span>
                      <span class={styles.progressSeparator}>/</span>
                      <span>{formatStatNumber(progress.currentTarget)}</span>
                    </div>
                  </div>

                  {/* Tier rewards list */}
                  <div class={styles.tiersList}>
                    {definition.tiers.map(tierDef => {
                      const isReached = progress.currentProgress >= tierDef.target;
                      const isClaimed = progress.claimedTiers.includes(tierDef.tier);
                      const canClaim = isReached && !isClaimed;
                      const isClaiming = claiming?.id === definition.id && claiming?.tier === tierDef.tier;

                      return (
                        <div
                          key={tierDef.tier}
                          class={`${styles.tierItem} ${isReached ? styles.reached : ''} ${isClaimed ? styles.claimed : ''}`}
                        >
                          <span class={styles.tierNumber}>{getTierRomanNumeral(tierDef.tier)}</span>
                          <span class={styles.tierTarget}>{formatStatNumber(tierDef.target)}</span>
                          <div class={styles.tierRewards}>
                            {tierDef.dustReward > 0 && (
                              <span class={styles.rewardBadge} title="Dust">
                                💎 {tierDef.dustReward}
                              </span>
                            )}
                            {tierDef.goldReward > 0 && (
                              <span class={styles.rewardBadge} title="Gold">
                                🪙 {formatStatNumber(tierDef.goldReward)}
                              </span>
                            )}
                            {tierDef.materialReward && (
                              <span
                                class={styles.rewardBadge}
                                style={{ borderColor: RARITY_COLORS[tierDef.materialReward.rarity] }}
                                title={`${tierDef.materialReward.rarity} material`}
                              >
                                📦 {tierDef.materialReward.count}
                              </span>
                            )}
                            {tierDef.titleReward && (
                              <span class={styles.rewardBadge} title="Title">
                                👑 {tierDef.titleReward}
                              </span>
                            )}
                          </div>
                          {canClaim && (
                            <button
                              class={styles.claimTierBtn}
                              onClick={() => handleClaimReward(definition.id, tierDef.tier)}
                              disabled={!!claiming || claimAllInProgress}
                            >
                              {isClaiming ? '...' : 'Odbierz'}
                            </button>
                          )}
                          {isClaimed && (
                            <span class={styles.claimedBadge}>\u2713</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Footer with Claim All button */}
      {unclaimedCount > 0 && (
        <div class={styles.footer}>
          <button
            class={styles.claimAllBtn}
            onClick={handleClaimAll}
            disabled={!!claiming || claimAllInProgress}
          >
            {claimAllInProgress ? 'Odbieranie...' : `Odbierz wszystkie (${unclaimedCount})`}
          </button>
        </div>
      )}
    </Modal>
  );
}
