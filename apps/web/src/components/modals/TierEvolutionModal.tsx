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
import { HpIcon, DamageIcon } from '../icons/index.js';
import type { ComponentChildren } from 'preact';
import styles from './TierEvolutionModal.module.css';

interface TierEvolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  fortressLevel: number;
}

// Reward type icons - using SVG for stats
function getRewardIcon(rewardType: string, size: number = 20): ComponentChildren {
  switch (rewardType) {
    case 'hp_bonus':
      return <HpIcon size={size} />;
    case 'damage_bonus':
      return <DamageIcon size={size} />;
    case 'skill_unlock':
      return '✨';
    case 'hero_slot':
      return '🦸';
    case 'turret_slot':
      return '🗼';
    case 'pillar_unlock':
      return '🏛️';
    case 'feature_unlock':
      return '🎮';
    case 'hero_unlock':
      return '🦸';
    case 'turret_unlock':
      return '🗼';
    case 'class_unlock':
      return '🏰';
    default:
      return '🎁';
  }
}

// Get all upcoming unlocks (up to maxCount)
function getAllUpcomingUnlocks(
  currentLevel: number,
  maxCount: number = 5
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
  const { t } = useTranslation('modals');
  const currentTier = getFortressTier(fortressLevel);
  const currentTierName = t(`tierEvolution.tierNames.${currentTier}`, {
    defaultValue: getFortressTierName(currentTier),
  });
  const isMaxLevel = fortressLevel >= MAX_FORTRESS_LEVEL;

  // Slot purchase state
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [slotUnlockModal, setSlotUnlockModal] = useState<{ type: 'hero' | 'turret'; slotNumber: number } | null>(null);

  // Get next purchasable slot info
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
        if (response.newSlotCount !== undefined) {
          purchasedHeroSlots.value = response.newSlotCount;
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
  }, [heroSlotInfo, t]);

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
  }, [turretSlotInfo, t]);

  // Calculate progress to next tier
  const tierProgress = useMemo(() => {
    if (currentTier >= 3) {
      // Already at max tier, show progress to max level
      const startLevel = FORTRESS_TIER_THRESHOLDS.TIER_3_LEVEL;
      return ((fortressLevel - startLevel) / (MAX_FORTRESS_LEVEL - startLevel)) * 100;
    }

    const nextTierLevel = currentTier === 1
      ? FORTRESS_TIER_THRESHOLDS.TIER_2_LEVEL
      : FORTRESS_TIER_THRESHOLDS.TIER_3_LEVEL;
    const prevTierLevel = currentTier === 1 ? 1 : FORTRESS_TIER_THRESHOLDS.TIER_2_LEVEL;

    return ((fortressLevel - prevTierLevel) / (nextTierLevel - prevTierLevel)) * 100;
  }, [fortressLevel, currentTier]);

  // Get upcoming unlocks
  const upcomingUnlocks = useMemo(
    () => getAllUpcomingUnlocks(fortressLevel, 5),
    [fortressLevel]
  );

  // Get next tier info
  const nextTierLevel = currentTier === 1
    ? FORTRESS_TIER_THRESHOLDS.TIER_2_LEVEL
    : currentTier === 2
      ? FORTRESS_TIER_THRESHOLDS.TIER_3_LEVEL
      : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('tierEvolution.title')}
      size="medium"
    >
      <div class={styles.content}>
        {/* Current Tier Status */}
        <div class={styles.header}>
          <div class={styles.tierDisplay}>
            <div class={styles.tierNumber}>{currentTier}</div>
            <div class={styles.tierInfo}>
              <span class={styles.tierName}>{currentTierName}</span>
              <span class={styles.levelDisplay}>
                {t('tierEvolution.currentLevel', { level: fortressLevel })}
              </span>
            </div>
          </div>

          {!isMaxLevel && nextTierLevel && (
            <div class={styles.progressSection}>
              <div class={styles.progressBar}>
                <div
                  class={styles.progressFill}
                  style={{ width: `${Math.min(tierProgress, 100)}%` }}
                />
              </div>
              <span class={styles.progressText}>
                {t('tierEvolution.levelLabel')} {nextTierLevel}
              </span>
            </div>
          )}

          {isMaxLevel && (
            <div class={styles.maxBadge}>MAX</div>
          )}
        </div>

        {/* Tier Evolution Track */}
        <div class={styles.evolutionTrack}>
          {[1, 2, 3].map((tierNum) => {
            const isCompleted = currentTier > tierNum;
            const isCurrent = currentTier === tierNum;
            const tierLabel = t(`tierEvolution.tierNames.${tierNum}`);

            return (
              <div
                key={tierNum}
                class={[
                  styles.trackNode,
                  isCompleted && styles.completed,
                  isCurrent && styles.current,
                ].filter(Boolean).join(' ')}
              >
                <div class={styles.nodeMarker}>
                  {isCompleted ? '✓' : tierNum}
                </div>
                <span class={styles.nodeLabel}>{tierLabel}</span>
              </div>
            );
          })}
          <div class={styles.trackLine}>
            <div
              class={styles.trackLineFill}
              style={{ width: `${((currentTier - 1) / 2) * 100}%` }}
            />
          </div>
        </div>

        {/* Slot Upgrades */}
        <div class={styles.slotsSection}>
          <h3 class={styles.sectionTitle}>{t('tierEvolution.availableSlots')}</h3>

          {purchaseError && (
            <div class={styles.error}>{purchaseError}</div>
          )}

          <div class={styles.slotsGrid}>
            {/* Hero Slots */}
            <div class={styles.slotCard}>
              <div class={styles.slotHeader}>
                <span class={styles.slotIcon}>🦸</span>
                <span class={styles.slotTitle}>{t('tierEvolution.heroSlots')}</span>
                <span class={styles.slotCounter}>
                  {purchasedHeroSlots.value}/{MAX_HERO_SLOTS}
                </span>
              </div>

              {heroSlotInfo ? (
                <div class={styles.slotBody}>
                  <div class={styles.slotCost}>
                    <span class={styles.goldCost}>🪙 {heroSlotInfo.slot.goldCost.toLocaleString()}</span>
                    <span class={styles.levelReq}>
                      {t('tierEvolution.costLevel', { level: heroSlotInfo.slot.levelRequired })}
                    </span>
                  </div>

                  {!heroSlotInfo.canPurchase && heroSlotInfo.reason === 'level_too_low' && (
                    <span class={styles.requirement}>
                      {t('tierEvolution.missingLevels')} {heroSlotInfo.slot.levelRequired - fortressLevel}
                    </span>
                  )}
                  {!heroSlotInfo.canPurchase && heroSlotInfo.reason === 'insufficient_gold' && (
                    <span class={styles.requirement}>
                      {t('tierEvolution.missingGold')} {(heroSlotInfo.slot.goldCost - baseGold.value).toLocaleString()}
                    </span>
                  )}

                  <Button
                    variant={heroSlotInfo.canPurchase ? 'primary' : 'secondary'}
                    size="sm"
                    fullWidth
                    disabled={!heroSlotInfo.canPurchase || isPurchasing}
                    onClick={handlePurchaseHeroSlot}
                  >
                    {isPurchasing
                      ? t('tierEvolution.purchasing')
                      : heroSlotInfo.canPurchase
                        ? t('tierEvolution.purchase')
                        : t('tierEvolution.unavailable')}
                  </Button>
                </div>
              ) : (
                <div class={styles.slotMaxed}>{t('tierEvolution.maxed')}</div>
              )}
            </div>

            {/* Turret Slots */}
            <div class={styles.slotCard}>
              <div class={styles.slotHeader}>
                <span class={styles.slotIcon}>🗼</span>
                <span class={styles.slotTitle}>{t('tierEvolution.turretSlots')}</span>
                <span class={styles.slotCounter}>
                  {purchasedTurretSlots.value}/{MAX_TURRET_SLOTS}
                </span>
              </div>

              {turretSlotInfo ? (
                <div class={styles.slotBody}>
                  <div class={styles.slotCost}>
                    <span class={styles.goldCost}>🪙 {turretSlotInfo.slot.goldCost.toLocaleString()}</span>
                    <span class={styles.levelReq}>
                      {t('tierEvolution.costLevel', { level: turretSlotInfo.slot.levelRequired })}
                    </span>
                  </div>

                  {!turretSlotInfo.canPurchase && turretSlotInfo.reason === 'level_too_low' && (
                    <span class={styles.requirement}>
                      {t('tierEvolution.missingLevels')} {turretSlotInfo.slot.levelRequired - fortressLevel}
                    </span>
                  )}
                  {!turretSlotInfo.canPurchase && turretSlotInfo.reason === 'insufficient_gold' && (
                    <span class={styles.requirement}>
                      {t('tierEvolution.missingGold')} {(turretSlotInfo.slot.goldCost - baseGold.value).toLocaleString()}
                    </span>
                  )}

                  <Button
                    variant={turretSlotInfo.canPurchase ? 'primary' : 'secondary'}
                    size="sm"
                    fullWidth
                    disabled={!turretSlotInfo.canPurchase || isPurchasing}
                    onClick={handlePurchaseTurretSlot}
                  >
                    {isPurchasing
                      ? t('tierEvolution.purchasing')
                      : turretSlotInfo.canPurchase
                        ? t('tierEvolution.purchase')
                        : t('tierEvolution.unavailable')}
                  </Button>
                </div>
              ) : (
                <div class={styles.slotMaxed}>{t('tierEvolution.maxed')}</div>
              )}
            </div>
          </div>
        </div>

        {/* Upcoming Unlocks */}
        {!isMaxLevel && upcomingUnlocks.length > 0 && (
          <div class={styles.unlocksSection}>
            <h3 class={styles.sectionTitle}>{t('tierEvolution.upcomingUnlocks')}</h3>
            <div class={styles.unlocksList}>
              {upcomingUnlocks.map(({ level, rewards }) => (
                <div key={level} class={styles.unlockRow}>
                  <span class={styles.unlockLevel}>{level}</span>
                  <div class={styles.unlockRewards}>
                    {rewards.map((reward, idx) => (
                      <span key={idx} class={styles.unlockReward}>
                        <span class={styles.rewardIcon}>{getRewardIcon(reward.type, 20)}</span>
                        {translateRewardDescription(reward.description, t)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Max level celebration */}
        {isMaxLevel && (
          <div class={styles.maxLevelCelebration}>
            <span class={styles.celebrationIcon}>🏆</span>
            <span class={styles.celebrationText}>
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
