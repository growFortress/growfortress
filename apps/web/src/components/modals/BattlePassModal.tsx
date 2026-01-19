/**
 * Battle Pass Modal
 *
 * Displays battle pass season progress, rewards, and upgrade options.
 * Two tracks: Free and Premium with rewards at specific tiers.
 */

import {
  BATTLE_PASS_CONFIG,
  BATTLE_PASS_FREE_TRACK,
  BATTLE_PASS_PREMIUM_TRACK,
  type BattlePassReward,
} from '@arcade/protocol';
import {
  battlepassData,
  battlepassModalVisible,
  battlepassLoading,
  battlepassError,
  hideBattlePassModal,
  claimReward,
  claimAllRewards,
  purchaseTier,
  startPremiumUpgrade,
  claimingTier,
  claimingAll,
  purchasingTiers,
  upgradingPremium,
  currentTier,
  currentPoints,
  isPremium,
  tierProgress,
  timeRemainingFormatted,
  totalUnclaimedCount,
  isMaxTier,
  fetchBattlePass,
  isTierClaimable,
  isFreeTierClaimed,
  isPremiumTierClaimed,
} from '../../state/battlepass.signals.js';
import { baseDust } from '../../state/profile.signals.js';
import { Modal } from '../shared/Modal.js';
import { ProgressBar } from '../shared/ProgressBar.js';
import { useEffect } from 'preact/hooks';
import styles from './BattlePassModal.module.css';

function getRewardIcon(type: string): string {
  const icons: Record<string, string> = {
    dust: '\u2728',
    gold: '\uD83E\uDEE7',
    material: '\uD83D\uDCE6',
    legendary_material: '\uD83D\uDC8E',
    artifact: '\uD83D\uDDC1',
    hero_summon: '\uD83C\uDFB0',
    cosmetic: '\uD83C\uDFA8',
    hero: '\u2694\uFE0F',
  };
  return icons[type] || '\uD83C\uDF81';
}

interface RewardCardProps {
  reward: BattlePassReward;
  currentTier: number;
  isPremiumUser: boolean;
  isClaimed: boolean;
  isClaimable: boolean;
  isClaiming: boolean;
  onClaim: () => void;
}

function RewardCard({
  reward,
  currentTier,
  isPremiumUser,
  isClaimed,
  isClaimable,
  isClaiming,
  onClaim,
}: RewardCardProps) {
  const isReached = currentTier >= reward.tier;
  const isLocked = reward.track === 'premium' && !isPremiumUser;

  let cardState = styles.locked;
  if (isClaimed) {
    cardState = styles.claimed;
  } else if (isClaimable) {
    cardState = styles.claimable;
  } else if (isReached && !isLocked) {
    cardState = styles.reached;
  } else if (!isReached) {
    cardState = styles.unreached;
  }

  return (
    <div class={`${styles.rewardCard} ${cardState}`}>
      <div class={styles.rewardTier}>T{reward.tier}</div>
      <div class={styles.rewardContent}>
        <span class={styles.rewardIcon}>{getRewardIcon(reward.rewardType)}</span>
        <span class={styles.rewardDesc}>{reward.description}</span>
      </div>
      <div class={styles.rewardAction}>
        {isClaimed ? (
          <span class={styles.claimedCheck}>\u2713</span>
        ) : isClaimable ? (
          <button
            class={styles.claimBtn}
            onClick={onClaim}
            disabled={isClaiming}
          >
            {isClaiming ? '...' : 'Claim'}
          </button>
        ) : isLocked ? (
          <span class={styles.lockIcon}>\uD83D\uDD12</span>
        ) : !isReached ? (
          <span class={styles.tierRequired}>Tier {reward.tier}</span>
        ) : null}
      </div>
    </div>
  );
}

export function BattlePassModal() {
  const isVisible = battlepassModalVisible.value;
  const data = battlepassData.value;
  const loading = battlepassLoading.value;
  const error = battlepassError.value;
  const tier = currentTier.value;
  const points = currentPoints.value;
  const premium = isPremium.value;
  const progress = tierProgress.value;
  const timeRemaining = timeRemainingFormatted.value;
  const unclaimedCount = totalUnclaimedCount.value;
  const maxTierReached = isMaxTier.value;
  const claiming = claimingTier.value;
  const claimingAllRewards = claimingAll.value;
  const purchasing = purchasingTiers.value;
  const upgrading = upgradingPremium.value;
  const dust = baseDust.value;

  // Fetch data when modal opens
  useEffect(() => {
    if (isVisible && !data) {
      fetchBattlePass();
    }
  }, [isVisible, data]);

  const handleClaimReward = async (rewardTier: number, track: 'free' | 'premium') => {
    await claimReward(rewardTier, track);
  };

  const handleClaimAll = async () => {
    await claimAllRewards();
  };

  const handleBuyTier = async () => {
    await purchaseTier(1);
  };

  const handleUpgradePremium = async () => {
    await startPremiumUpgrade();
  };

  const canBuyTier = dust >= BATTLE_PASS_CONFIG.tierPurchaseDustCost && !maxTierReached;

  if (!isVisible) return null;

  return (
    <Modal
      visible={isVisible}
      title="Battle Pass"
      onClose={hideBattlePassModal}
      class={styles.modal}
      ariaLabel="Battle Pass"
    >
      {loading ? (
        <div class={styles.loading}>Loading Battle Pass...</div>
      ) : error || !data ? (
        <div class={styles.noSeason}>
          <span class={styles.noSeasonIcon}>🎖️</span>
          <span class={styles.noSeasonTitle}>Brak aktywnego sezonu</span>
          <span class={styles.noSeasonDesc}>
            Aktualnie nie ma żadnego aktywnego sezonu Battle Pass. Sprawdź ponownie później!
          </span>
        </div>
      ) : (
        <>
          {/* Header Section */}
          <div class={styles.header}>
            <div class={styles.headerTop}>
              <span class={styles.seasonName}>{data.season.name}</span>
              <span class={styles.timeRemaining}>
                <span class={styles.timerIcon}>\u23F0</span>
                {timeRemaining} left
              </span>
            </div>

            {/* Progress Bar */}
            <div class={styles.progressSection}>
              <div class={styles.tierInfo}>
                <span class={styles.tierLabel}>Tier</span>
                <span class={styles.tierValue}>
                  {tier}/{BATTLE_PASS_CONFIG.maxTier}
                </span>
              </div>
              <div class={styles.progressBarContainer}>
                <ProgressBar
                  percent={maxTierReached ? 100 : progress}
                  class={styles.progressBar}
                  variant="primary"
                  glow
                />
                <span class={styles.pointsLabel}>
                  {maxTierReached ? 'MAX' : `${points}/${BATTLE_PASS_CONFIG.pointsPerTier} BP`}
                </span>
              </div>
            </div>
          </div>

          {/* Premium Upgrade Banner */}
          {!premium && (
            <div class={styles.premiumBanner}>
              <div class={styles.premiumInfo}>
                <span class={styles.premiumTitle}>\u2B50 Unlock Premium</span>
                <span class={styles.premiumDesc}>
                  Exclusive rewards, skins & 5,000+ Dust!
                </span>
              </div>
              <button
                class={styles.premiumButton}
                onClick={handleUpgradePremium}
                disabled={upgrading}
              >
                {upgrading ? 'Loading...' : `${BATTLE_PASS_CONFIG.premiumPricePLN} PLN`}
              </button>
            </div>
          )}

          {/* Rewards Section */}
          <div class={styles.rewardsSection}>
            {/* Free Track */}
            <div class={styles.track}>
              <div class={styles.trackHeader}>
                <span class={styles.trackTitle}>Free Track</span>
              </div>
              <div class={styles.trackRewards}>
                {BATTLE_PASS_FREE_TRACK.map((reward) => (
                  <RewardCard
                    key={`free-${reward.tier}`}
                    reward={reward}
                    currentTier={tier}
                    isPremiumUser={premium}
                    isClaimed={isFreeTierClaimed(reward.tier)}
                    isClaimable={isTierClaimable(reward.tier, 'free')}
                    isClaiming={claiming?.tier === reward.tier && claiming?.track === 'free'}
                    onClaim={() => handleClaimReward(reward.tier, 'free')}
                  />
                ))}
              </div>
            </div>

            {/* Premium Track */}
            <div class={`${styles.track} ${premium ? styles.premiumUnlocked : styles.premiumLocked}`}>
              <div class={styles.trackHeader}>
                <span class={styles.trackTitle}>
                  Premium Track {!premium && '\uD83D\uDD12'}
                </span>
              </div>
              <div class={styles.trackRewards}>
                {BATTLE_PASS_PREMIUM_TRACK.map((reward) => (
                  <RewardCard
                    key={`premium-${reward.tier}`}
                    reward={reward}
                    currentTier={tier}
                    isPremiumUser={premium}
                    isClaimed={isPremiumTierClaimed(reward.tier)}
                    isClaimable={isTierClaimable(reward.tier, 'premium')}
                    isClaiming={claiming?.tier === reward.tier && claiming?.track === 'premium'}
                    onClaim={() => handleClaimReward(reward.tier, 'premium')}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div class={styles.footer}>
            {unclaimedCount > 0 && (
              <button
                class={styles.claimAllButton}
                onClick={handleClaimAll}
                disabled={claimingAllRewards || claiming !== null}
              >
                {claimingAllRewards ? 'Claiming...' : `Claim All (${unclaimedCount})`}
              </button>
            )}

            <button
              class={styles.buyTierButton}
              onClick={handleBuyTier}
              disabled={!canBuyTier || purchasing}
            >
              {purchasing
                ? 'Buying...'
                : `Buy Tier (${BATTLE_PASS_CONFIG.tierPurchaseDustCost} \u2728)`}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
