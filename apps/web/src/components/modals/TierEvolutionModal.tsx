import { useMemo, useState, useCallback } from 'preact/hooks';
import {
  getFortressTier,
  getFortressTierName,
  FORTRESS_TIER_THRESHOLDS,
  MAX_FORTRESS_LEVEL,
  MAX_HERO_SLOTS,
  MAX_TURRET_SLOTS,
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
import { SlotUnlockModal } from './SlotUnlockModal.js';
import styles from './TierEvolutionModal.module.css';

interface TierEvolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  fortressLevel: number;
}

// Tier icons
const TIER_ICONS: Record<number, string> = {
  1: '🏠',
  2: '🏰',
  3: '⚔️',
};

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

// Helper function to translate reward descriptions
function translateRewardDescription(description: string, t: (key: string, params?: any) => string): string {
  // Map Polish descriptions to translation keys
  // This is a temporary solution until reward descriptions are moved to i18n
  const descriptionMap: Record<string, string> = {
    'Odblokowano podstawową umiejętność konfiguracji': 'tierEvolution.rewards.skill1',
    'Odblokowano Wieżę Kriogeniczną': 'tierEvolution.rewards.turretCryo',
    'Odblokowano drugą umiejętność konfiguracji': 'tierEvolution.rewards.skill2',
    'Odblokowano Unit-3 "Forge"': 'tierEvolution.rewards.heroForge',
    'Odblokowano trzecią umiejętność konfiguracji': 'tierEvolution.rewards.skill3',
    'Odblokowano Sektor: Nauka i Technologia': 'tierEvolution.rewards.pillarScience',
    'Odblokowano Wieżę Artyleryjską': 'tierEvolution.rewards.turretArtillery',
    '+10% DMG twierdzy': 'tierEvolution.rewards.damageBonus10',
    'Odblokowano Konfigurację Kriogeniczną': 'tierEvolution.rewards.classIce',
    'Odblokowano Unit-5 "Frost"': 'tierEvolution.rewards.heroFrost',
    'Odblokowano Ultimate konfiguracji': 'tierEvolution.rewards.skillUltimate',
    '+5% HP twierdzy': 'tierEvolution.rewards.hpBonus5',
    'Odblokowano Sektor: Mutanci': 'tierEvolution.rewards.pillarMutants',
    'Odblokowano Unit-9 "Rift"': 'tierEvolution.rewards.heroRift',
    'Odblokowano Wieżę Łukową': 'tierEvolution.rewards.turretArc',
    'Odblokowano Unit-1 "Titan"': 'tierEvolution.rewards.heroTitan',
    'Odblokowano Konfigurację Termiczną': 'tierEvolution.rewards.classFire',
    'Odblokowano Sektor: Kosmos': 'tierEvolution.rewards.pillarCosmos',
    'Odblokowano Wieżę Fotonową': 'tierEvolution.rewards.turretLaser',
    'Odblokowano Matrycę Kryształów': 'tierEvolution.rewards.featureCrystalMatrix',
    'Odblokowano Protokół Anihilacji': 'tierEvolution.rewards.featureTrueEnding',
    'Odblokowano Sektor: Magia i Wymiary': 'tierEvolution.rewards.pillarMagic',
    'Odblokowano Konfigurację Elektryczną': 'tierEvolution.rewards.classLightning',
    'Odblokowano Sektor: Bogowie': 'tierEvolution.rewards.pillarGods',
    'Odblokowano Konfigurację Próżniową': 'tierEvolution.rewards.classVoid',
    'Odblokowano Konfigurację Kwantową': 'tierEvolution.rewards.classTech',
  };

  const key = descriptionMap[description];
  if (key) {
    return t(key, { defaultValue: description });
  }
  return description;
}

export function TierEvolutionModal({ isOpen, onClose, fortressLevel }: TierEvolutionModalProps) {
  const { t } = useTranslation(['common', 'modals']);
  const currentTier = getFortressTier(fortressLevel);
  const currentTierName = t(`fortressPanel.tierNames.${currentTier}`, {
    defaultValue: getFortressTierName(currentTier),
  });
  const isMaxLevel = fortressLevel >= MAX_FORTRESS_LEVEL;

  // Slot purchase state
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [slotUnlockModal, setSlotUnlockModal] = useState<{ type: 'hero' | 'turret'; slotNumber: number } | null>(null);

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
          // Show unlock modal
          setSlotUnlockModal({ type: 'hero', slotNumber: response.newSlotCount });
        }
        if (response.newGold !== undefined) {
          baseGold.value = response.newGold;
        }
      } else {
        setPurchaseError(response.error || t('tierEvolution.purchaseError'));
      }
    } catch (err) {
      setPurchaseError(t('tierEvolution.connectionError'));
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
          // Show unlock modal
          setSlotUnlockModal({ type: 'turret', slotNumber: response.newSlotCount });
        }
        if (response.newGold !== undefined) {
          baseGold.value = response.newGold;
        }
      } else {
        setPurchaseError(response.error || t('tierEvolution.purchaseError'));
      }
    } catch (err) {
      setPurchaseError(t('tierEvolution.connectionError'));
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
      title={t('tierEvolution.title')}
      size="medium"
    >
      <div class={styles.content}>
        {/* Current Status */}
        <div class={styles.currentStatus}>
          <div class={styles.currentTierIcon}>
            {TIER_ICONS[currentTier] || '🏰'}
          </div>
          <div class={styles.currentInfo}>
            <span class={styles.currentTierName}>{currentTierName}</span>
            <span class={styles.currentLevel}>{t('tierEvolution.currentLevel', { level: fortressLevel })}</span>
          </div>
          <div class={styles.tierBadge}>{t('tierEvolution.tierBadge', { tier: currentTier })}</div>
        </div>

        {/* Tier Timeline */}
        <div class={styles.timeline}>
          {[1, 2, 3].map((tierNum, index) => {
            const isCompleted = currentTier > tierNum;
            const isCurrent = currentTier === tierNum;
            const isLocked = currentTier < tierNum;

            const minLevel = tierNum === 1
              ? 1
              : tierNum === 2
                ? FORTRESS_TIER_THRESHOLDS.TIER_2_LEVEL
                : FORTRESS_TIER_THRESHOLDS.TIER_3_LEVEL;
            const maxLevel = tierNum === 1
              ? FORTRESS_TIER_THRESHOLDS.TIER_2_LEVEL - 1
              : tierNum === 2
                ? FORTRESS_TIER_THRESHOLDS.TIER_3_LEVEL - 1
                : MAX_FORTRESS_LEVEL;

            const tierName = t(`tierEvolution.tierNames.${tierNum}`);
            const levelRange = maxLevel !== minLevel
              ? `${t('tierEvolution.levelLabel')} ${minLevel}–${maxLevel}`
              : `${t('tierEvolution.levelLabel')} ${minLevel}`;

            return (
              <div
                key={tierNum}
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
                  <span class={styles.nodeIcon}>{TIER_ICONS[tierNum] || '🏰'}</span>
                </div>

                {/* Info */}
                <div class={styles.nodeInfo}>
                  <span class={styles.nodeName}>{tierName}</span>
                  <span class={styles.nodeLevel}>{levelRange}</span>
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
          {t(`tierEvolution.tierDescriptions.${currentTier}`)}
        </p>

        {/* Slot Purchase Section */}
        <div class={styles.slotsSection}>
          <h3 class={styles.slotsSectionTitle}>{t('tierEvolution.availableSlots')}</h3>

          {purchaseError && (
            <div class={styles.purchaseError}>{purchaseError}</div>
          )}

          <div class={styles.slotsList}>
            {/* Hero Slots */}
            <div class={styles.slotItem}>
              <div class={styles.slotIcon}>🦸</div>
              <div class={styles.slotInfo}>
                <span class={styles.slotName}>{t('tierEvolution.heroSlots')}</span>
                <span class={styles.slotCount}>
                  {t('tierEvolution.slotCount', { current: purchasedHeroSlots.value, max: MAX_HERO_SLOTS })}
                </span>
                {heroSlotInfo && (
                  <span class={styles.slotNextInfo}>
                    {t('tierEvolution.nextSlot', { slot: heroSlotInfo.slot.slot })}
                  </span>
                )}
              </div>
              {heroSlotInfo ? (
                <div class={styles.slotPurchase}>
                  <div class={styles.slotCost}>
                    <span class={styles.slotCostGold}>
                      {t('tierEvolution.costGold', { amount: heroSlotInfo.slot.goldCost.toLocaleString() })}
                    </span>
                    <span class={styles.slotCostLevel}>
                      {t('tierEvolution.costLevel', { level: heroSlotInfo.slot.levelRequired })}
                    </span>
                  </div>
                  {!heroSlotInfo.canPurchase && (
                    <div class={styles.slotRequirements}>
                      {heroSlotInfo.reason === 'level_too_low' && (
                        <div class={styles.slotRequirement}>
                          <span class={styles.slotRequirementLabel}>{t('tierEvolution.missingLevels')}</span>
                          <span class={styles.slotRequirementValue}>
                            {heroSlotInfo.slot.levelRequired - fortressLevel}
                          </span>
                        </div>
                      )}
                      {heroSlotInfo.reason === 'insufficient_gold' && (
                        <div class={styles.slotRequirement}>
                          <span class={styles.slotRequirementLabel}>{t('tierEvolution.missingGold')}</span>
                          <span class={styles.slotRequirementValue}>
                            {(heroSlotInfo.slot.goldCost - baseGold.value).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  <Button
                    variant={heroSlotInfo.canPurchase ? "primary" : "secondary"}
                    size="sm"
                    disabled={!heroSlotInfo.canPurchase || isPurchasing}
                    onClick={handlePurchaseHeroSlot}
                    aria-label={t('tierEvolution.purchaseHeroSlot', { amount: heroSlotInfo.slot.goldCost })}
                  >
                    {isPurchasing ? t('tierEvolution.purchasing') : heroSlotInfo.canPurchase ? t('tierEvolution.purchase') : t('tierEvolution.unavailable')}
                  </Button>
                </div>
              ) : (
                <span class={styles.slotMaxed}>{t('tierEvolution.maxed')}</span>
              )}
            </div>

            {/* Turret Slots */}
            <div class={styles.slotItem}>
              <div class={styles.slotIcon}>🗼</div>
              <div class={styles.slotInfo}>
                <span class={styles.slotName}>{t('tierEvolution.turretSlots')}</span>
                <span class={styles.slotCount}>
                  {t('tierEvolution.slotCount', { current: purchasedTurretSlots.value, max: MAX_TURRET_SLOTS })}
                </span>
                {turretSlotInfo && (
                  <span class={styles.slotNextInfo}>
                    {t('tierEvolution.nextSlot', { slot: turretSlotInfo.slot.slot })}
                  </span>
                )}
              </div>
              {turretSlotInfo ? (
                <div class={styles.slotPurchase}>
                  <div class={styles.slotCost}>
                    <span class={styles.slotCostGold}>
                      {t('tierEvolution.costGold', { amount: turretSlotInfo.slot.goldCost.toLocaleString() })}
                    </span>
                    <span class={styles.slotCostLevel}>
                      {t('tierEvolution.costLevel', { level: turretSlotInfo.slot.levelRequired })}
                    </span>
                  </div>
                  {!turretSlotInfo.canPurchase && (
                    <div class={styles.slotRequirements}>
                      {turretSlotInfo.reason === 'level_too_low' && (
                        <div class={styles.slotRequirement}>
                          <span class={styles.slotRequirementLabel}>{t('tierEvolution.missingLevels')}</span>
                          <span class={styles.slotRequirementValue}>
                            {turretSlotInfo.slot.levelRequired - fortressLevel}
                          </span>
                        </div>
                      )}
                      {turretSlotInfo.reason === 'insufficient_gold' && (
                        <div class={styles.slotRequirement}>
                          <span class={styles.slotRequirementLabel}>{t('tierEvolution.missingGold')}</span>
                          <span class={styles.slotRequirementValue}>
                            {(turretSlotInfo.slot.goldCost - baseGold.value).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  <Button
                    variant={turretSlotInfo.canPurchase ? "primary" : "secondary"}
                    size="sm"
                    disabled={!turretSlotInfo.canPurchase || isPurchasing}
                    onClick={handlePurchaseTurretSlot}
                    aria-label={t('tierEvolution.purchaseTurretSlot', { amount: turretSlotInfo.slot.goldCost })}
                  >
                    {isPurchasing ? t('tierEvolution.purchasing') : turretSlotInfo.canPurchase ? t('tierEvolution.purchase') : t('tierEvolution.unavailable')}
                  </Button>
                </div>
              ) : (
                <span class={styles.slotMaxed}>{t('tierEvolution.maxed')}</span>
              )}
            </div>
          </div>
        </div>

        {/* Upcoming Unlocks */}
        {!isMaxLevel && upcomingUnlocks.length > 0 && (
          <div class={styles.unlocksSection}>
            <h3 class={styles.unlocksSectionTitle}>{t('tierEvolution.upcomingUnlocks')}</h3>
            <div class={styles.unlocksList}>
              {upcomingUnlocks.map(({ level, rewards }) => (
                <div key={level} class={styles.unlockItem}>
                  <div class={styles.unlockLevel}>
                    <span class={styles.unlockLevelLabel}>{t('tierEvolution.levelLabel')}</span>
                    <span class={styles.unlockLevelValue}>{level}</span>
                  </div>
                  <div class={styles.unlockRewards}>
                    {rewards.map((reward, idx) => (
                      <div key={idx} class={styles.unlockReward}>
                        <span class={styles.unlockRewardIcon}>
                          {REWARD_ICONS[reward.type] || '🎁'}
                        </span>
                        <span class={styles.unlockRewardText}>{translateRewardDescription(reward.description, t)}</span>
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
              {t('tierEvolution.maxLevelMessage')}
            </span>
          </div>
        )}
      </div>

      {/* Slot Unlock Modal */}
      {slotUnlockModal && (
        <SlotUnlockModal
          isOpen={!!slotUnlockModal}
          onClose={() => setSlotUnlockModal(null)}
          slotType={slotUnlockModal.type}
          slotNumber={slotUnlockModal.slotNumber}
        />
      )}
    </Modal>
  );
}
