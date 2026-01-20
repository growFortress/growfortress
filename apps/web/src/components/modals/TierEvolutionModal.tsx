import { useMemo, useState, useCallback } from 'preact/hooks';
import {
  getFortressTier,
  getFortressTierName,
  FORTRESS_TIER_THRESHOLDS,
  MAX_FORTRESS_LEVEL,
  getRewardsForLevel,
  getNextHeroSlotInfo,
  getNextTurretSlotInfo,
  type FortressLevelReward,
} from '@arcade/sim-core';
import { Modal } from '../shared/Modal.js';
import { Button } from '../shared/Button.js';
import {
  purchasedHeroSlots,
  purchasedTurretSlots,
} from '../../state/fortress.signals.js';
import { baseGold } from '../../state/profile.signals.js';
import { purchaseHeroSlot, purchaseTurretSlot } from '../../api/slots.js';
import { useTranslation } from '../../i18n/useTranslation.js';
import styles from './TierEvolutionModal.module.css';

interface TierEvolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  fortressLevel: number;
}

// Tier data configuration
const TIER_DATA = [
  {
    tier: 1,
    name: 'Wieza',
    minLevel: 1,
    maxLevel: FORTRESS_TIER_THRESHOLDS.TIER_2_LEVEL - 1,
    description: 'Podstawowa struktura obronna. Pierwszy krok na drodze do wielkosci.',
    icon: '🏠',
  },
  {
    tier: 2,
    name: 'Warownia',
    minLevel: FORTRESS_TIER_THRESHOLDS.TIER_2_LEVEL,
    maxLevel: FORTRESS_TIER_THRESHOLDS.TIER_3_LEVEL - 1,
    description: 'Wzmocniona fortyfikacja z blankami i wiezami straznniczymi.',
    icon: '🏰',
  },
  {
    tier: 3,
    name: 'Cytadela',
    minLevel: FORTRESS_TIER_THRESHOLDS.TIER_3_LEVEL,
    maxLevel: MAX_FORTRESS_LEVEL,
    description: 'Maksymalna ewolucja - potezna cytadela z elementarna moca!',
    icon: '⚔️',
  },
];

// Reward type icons
const REWARD_ICONS: Record<string, string> = {
  hp_bonus: '❤️',
  damage_bonus: '⚔️',
  skill_unlock: '✨',
  hero_slot: '🦸',
  turret_slot: '🗼',
  pillar_unlock: '🏛️',
  feature_unlock: '🎮',
  hero_unlock: '🦸',
  turret_unlock: '🗼',
  class_unlock: '🏰',
};

// Get all upcoming unlocks (up to maxCount)
function getAllUpcomingUnlocks(
  currentLevel: number,
  maxCount: number = 10
): Array<{ level: number; rewards: FortressLevelReward[] }> {
  const unlocks: Array<{ level: number; rewards: FortressLevelReward[] }> = [];

  for (let level = currentLevel + 1; level <= MAX_FORTRESS_LEVEL && unlocks.length < maxCount; level++) {
    const rewards = getRewardsForLevel(level);
    if (rewards.length > 0) {
      unlocks.push({ level, rewards });
    }
  }

  return unlocks;
}

export function TierEvolutionModal({ isOpen, onClose, fortressLevel }: TierEvolutionModalProps) {
  const { t } = useTranslation('common');
  const currentTier = getFortressTier(fortressLevel);
  const currentTierName = t(`fortressPanel.tierNames.${currentTier}`, {
    defaultValue: getFortressTierName(currentTier),
  });
  const isMaxLevel = fortressLevel >= MAX_FORTRESS_LEVEL;

  // Slot purchase state
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  // Get next purchasable slot info
  // Function signature: (currentPurchased, commanderLevel, currentGold)
  const heroSlotInfo = useMemo(
    () => getNextHeroSlotInfo(purchasedHeroSlots.value, fortressLevel, baseGold.value),
    [purchasedHeroSlots.value, fortressLevel, baseGold.value]
  );
  const turretSlotInfo = useMemo(
    () => getNextTurretSlotInfo(purchasedTurretSlots.value, fortressLevel, baseGold.value),
    [purchasedTurretSlots.value, fortressLevel, baseGold.value]
  );

  // Handle hero slot purchase
  const handlePurchaseHeroSlot = useCallback(async () => {
    if (!heroSlotInfo || !heroSlotInfo.canPurchase) return;

    setIsPurchasing(true);
    setPurchaseError(null);

    try {
      const response = await purchaseHeroSlot();
      if (response.success) {
        // Update local state
        if (response.newSlotCount !== undefined) {
          purchasedHeroSlots.value = response.newSlotCount;
        }
        if (response.newGold !== undefined) {
          baseGold.value = response.newGold;
        }
      } else {
        setPurchaseError(response.error || 'Nie udało się kupić slotu');
      }
    } catch (err) {
      setPurchaseError('Błąd połączenia z serwerem');
    } finally {
      setIsPurchasing(false);
    }
  }, [heroSlotInfo]);

  // Handle turret slot purchase
  const handlePurchaseTurretSlot = useCallback(async () => {
    if (!turretSlotInfo || !turretSlotInfo.canPurchase) return;

    setIsPurchasing(true);
    setPurchaseError(null);

    try {
      const response = await purchaseTurretSlot();
      if (response.success) {
        if (response.newSlotCount !== undefined) {
          purchasedTurretSlots.value = response.newSlotCount;
        }
        if (response.newGold !== undefined) {
          baseGold.value = response.newGold;
        }
      } else {
        setPurchaseError(response.error || 'Nie udało się kupić slotu');
      }
    } catch (err) {
      setPurchaseError('Błąd połączenia z serwerem');
    } finally {
      setIsPurchasing(false);
    }
  }, [turretSlotInfo]);

  // Calculate progress within current tier
  const tierProgress = useMemo(() => {
    const prevTierLevel = currentTier === 3
      ? FORTRESS_TIER_THRESHOLDS.TIER_3_LEVEL
      : currentTier === 2
        ? FORTRESS_TIER_THRESHOLDS.TIER_2_LEVEL
        : 1;
    const nextTierLevel = currentTier === 1
      ? FORTRESS_TIER_THRESHOLDS.TIER_2_LEVEL
      : currentTier === 2
        ? FORTRESS_TIER_THRESHOLDS.TIER_3_LEVEL
        : MAX_FORTRESS_LEVEL;

    return ((fortressLevel - prevTierLevel) / (nextTierLevel - prevTierLevel)) * 100;
  }, [fortressLevel, currentTier]);

  // Get upcoming unlocks
  const upcomingUnlocks = useMemo(
    () => getAllUpcomingUnlocks(fortressLevel, 10),
    [fortressLevel]
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Ewolucja Twierdzy"
      size="medium"
    >
      <div class={styles.content}>
        {/* Current Status */}
        <div class={styles.currentStatus}>
          <div class={styles.currentTierIcon}>
            {TIER_DATA[currentTier - 1]?.icon || '🏰'}
          </div>
          <div class={styles.currentInfo}>
            <span class={styles.currentTierName}>{currentTierName}</span>
            <span class={styles.currentLevel}>Poziom {fortressLevel}</span>
          </div>
          <div class={styles.tierBadge}>Tier {currentTier}/3</div>
        </div>

        {/* Tier Timeline */}
        <div class={styles.timeline}>
          {TIER_DATA.map((tier, index) => {
            const isCompleted = currentTier > tier.tier;
            const isCurrent = currentTier === tier.tier;
            const isLocked = currentTier < tier.tier;

            return (
              <div
                key={tier.tier}
                class={[
                  styles.tierNode,
                  isCompleted && styles.completed,
                  isCurrent && styles.current,
                  isLocked && styles.locked,
                ].filter(Boolean).join(' ')}
              >
                {/* Connector line */}
                {index > 0 && (
                  <div
                    class={[
                      styles.connector,
                      isCompleted && styles.connectorCompleted,
                      isCurrent && styles.connectorCurrent,
                    ].filter(Boolean).join(' ')}
                  />
                )}

                {/* Node */}
                <div class={styles.nodeCircle}>
                  <span class={styles.nodeIcon}>{tier.icon}</span>
                </div>

                {/* Info */}
                <div class={styles.nodeInfo}>
                  <span class={styles.nodeName}>{tier.name}</span>
                  <span class={styles.nodeLevel}>
                    Poz. {tier.minLevel}{tier.maxLevel !== tier.minLevel && `–${tier.maxLevel}`}
                  </span>
                </div>

                {/* Progress bar for current tier */}
                {isCurrent && !isMaxLevel && (
                  <div class={styles.nodeProgress}>
                    <div class={styles.nodeProgressBar}>
                      <div
                        class={styles.nodeProgressFill}
                        style={{ width: `${tierProgress}%` }}
                      />
                    </div>
                    <span class={styles.nodeProgressText}>{Math.round(tierProgress)}%</span>
                  </div>
                )}

                {/* Max badge */}
                {isCurrent && isMaxLevel && (
                  <span class={styles.maxBadge}>MAX</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Description */}
        <p class={styles.tierDescription}>
          {TIER_DATA[currentTier - 1]?.description}
        </p>

        {/* Slot Purchase Section */}
        <div class={styles.slotsSection}>
          <h3 class={styles.slotsSectionTitle}>Dostępne Sloty</h3>

          {purchaseError && (
            <div class={styles.purchaseError}>{purchaseError}</div>
          )}

          <div class={styles.slotsList}>
            {/* Hero Slots */}
            <div class={styles.slotItem}>
              <div class={styles.slotIcon}>🦸</div>
              <div class={styles.slotInfo}>
                <span class={styles.slotName}>Sloty Bohaterów</span>
                <span class={styles.slotCount}>
                  {purchasedHeroSlots.value} / 6
                </span>
              </div>
              {heroSlotInfo ? (
                <div class={styles.slotPurchase}>
                  <div class={styles.slotCost}>
                    <span class={styles.slotCostGold}>
                      🪙 {heroSlotInfo.slot.goldCost.toLocaleString()}
                    </span>
                    <span class={styles.slotCostLevel}>
                      Poz. {heroSlotInfo.slot.levelRequired}
                    </span>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={!heroSlotInfo.canPurchase || isPurchasing}
                    onClick={handlePurchaseHeroSlot}
                    aria-label={`Kup slot bohatera za ${heroSlotInfo.slot.goldCost} złota`}
                  >
                    {isPurchasing ? '...' : 'Kup'}
                  </Button>
                  {!heroSlotInfo.canPurchase && heroSlotInfo.reason && (
                    <span class={styles.slotReason}>{heroSlotInfo.reason === 'level_too_low' ? `Wymaga poziomu ${heroSlotInfo.slot.levelRequired}` : 'Brak złota'}</span>
                  )}
                </div>
              ) : (
                <span class={styles.slotMaxed}>MAX</span>
              )}
            </div>

            {/* Turret Slots */}
            <div class={styles.slotItem}>
              <div class={styles.slotIcon}>🗼</div>
              <div class={styles.slotInfo}>
                <span class={styles.slotName}>Sloty Wież</span>
                <span class={styles.slotCount}>
                  {purchasedTurretSlots.value} / 6
                </span>
              </div>
              {turretSlotInfo ? (
                <div class={styles.slotPurchase}>
                  <div class={styles.slotCost}>
                    <span class={styles.slotCostGold}>
                      🪙 {turretSlotInfo.slot.goldCost.toLocaleString()}
                    </span>
                    <span class={styles.slotCostLevel}>
                      Poz. {turretSlotInfo.slot.levelRequired}
                    </span>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={!turretSlotInfo.canPurchase || isPurchasing}
                    onClick={handlePurchaseTurretSlot}
                    aria-label={`Kup slot wieży za ${turretSlotInfo.slot.goldCost} złota`}
                  >
                    {isPurchasing ? '...' : 'Kup'}
                  </Button>
                  {!turretSlotInfo.canPurchase && turretSlotInfo.reason && (
                    <span class={styles.slotReason}>{turretSlotInfo.reason === 'level_too_low' ? `Wymaga poziomu ${turretSlotInfo.slot.levelRequired}` : 'Brak złota'}</span>
                  )}
                </div>
              ) : (
                <span class={styles.slotMaxed}>MAX</span>
              )}
            </div>
          </div>
        </div>

        {/* Upcoming Unlocks */}
        {!isMaxLevel && upcomingUnlocks.length > 0 && (
          <div class={styles.unlocksSection}>
            <h3 class={styles.unlocksSectionTitle}>Nastepne Odblokowania</h3>
            <div class={styles.unlocksList}>
              {upcomingUnlocks.map(({ level, rewards }) => (
                <div key={level} class={styles.unlockItem}>
                  <div class={styles.unlockLevel}>
                    <span class={styles.unlockLevelLabel}>Poz.</span>
                    <span class={styles.unlockLevelValue}>{level}</span>
                  </div>
                  <div class={styles.unlockRewards}>
                    {rewards.map((reward, idx) => (
                      <div key={idx} class={styles.unlockReward}>
                        <span class={styles.unlockRewardIcon}>
                          {REWARD_ICONS[reward.type] || '🎁'}
                        </span>
                        <span class={styles.unlockRewardText}>{reward.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Max level message */}
        {isMaxLevel && (
          <div class={styles.maxLevelMessage}>
            <span class={styles.maxLevelIcon}>🏆</span>
            <span class={styles.maxLevelText}>
              Osiagnales maksymalny poziom twierdzy!
            </span>
          </div>
        )}
      </div>
    </Modal>
  );
}
