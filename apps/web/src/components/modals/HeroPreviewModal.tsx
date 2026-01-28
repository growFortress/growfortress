import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import type { HeroDefinition, FortressClass } from '@arcade/sim-core';
import { getHeroUnlockCost } from '@arcade/sim-core';
import { useTranslation } from '../../i18n/useTranslation.js';
import { displayGold, displayDust } from '../../state/index.js';
import { Modal } from '../shared/Modal.js';
import { GoldIcon, DustIcon, HpIcon, DamageIcon, SpeedIcon } from '../icons/index.js';
import {
  HeroIdentityCard,
  TierTabs,
  TierContent,
  WorksWithSection,
} from './hero-details/index.js';
import styles from './HeroPreviewModal.module.css';

// Class colors (7 classes)
const CLASS_COLORS: Record<FortressClass, string> = {
  natural: '#228b22',
  ice: '#00bfff',
  fire: '#ff4500',
  lightning: '#9932cc',
  tech: '#00f0ff',
  void: '#4b0082',
  plasma: '#00ffff',
};

export type HeroPreviewStatus = 'owned' | 'available' | 'locked' | 'premium';

interface HeroPreviewModalProps {
  visible: boolean;
  heroDefinition: HeroDefinition | null;
  status: HeroPreviewStatus;
  requiredLevel: number;
  onClose: () => void;
  onRecruit: () => void;
}

export function HeroPreviewModal({
  visible,
  heroDefinition,
  status,
  requiredLevel,
  onClose,
  onRecruit,
}: HeroPreviewModalProps) {
  const { t } = useTranslation(['common', 'data', 'modals']);
  const [selectedTier, setSelectedTier] = useState<1 | 2 | 3>(1);

  const gold = displayGold.value;
  const dust = displayDust.value;

  if (!visible || !heroDefinition) return null;

  const classColor = CLASS_COLORS[heroDefinition.class];
  const cost = getHeroUnlockCost(heroDefinition.id) || { gold: 0, dust: 0 };
  const canAfford = gold >= cost.gold && dust >= cost.dust;
  const isFree = heroDefinition.rarity === 'starter';

  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const renderActionButton = () => {
    switch (status) {
      case 'owned':
        return (
          <div class={styles.ownedBadge}>
            <span class={styles.ownedIcon}>✓</span>
            {t('modals:heroRecruitment.status.owned')}
          </div>
        );

      case 'available':
        return (
          <button
            class={styles.recruitButton}
            onClick={onRecruit}
            disabled={!canAfford && !isFree}
          >
            <span class={styles.recruitText}>
              {isFree
                ? t('modals:heroRecruitment.unlock')
                : t('modals:heroRecruitment.recruit')}
            </span>
            {!isFree && (
              <span class={styles.recruitCost}>
                {cost.gold > 0 && (
                  <span class={`${styles.costItem} ${gold < cost.gold ? styles.insufficient : ''}`}>
                    <GoldIcon size={16} />
                    {cost.gold.toLocaleString()}
                  </span>
                )}
                {cost.dust > 0 && (
                  <span class={`${styles.costItem} ${dust < cost.dust ? styles.insufficient : ''}`}>
                    <DustIcon size={14} />
                    {cost.dust.toLocaleString()}
                  </span>
                )}
              </span>
            )}
          </button>
        );

      case 'locked':
        return (
          <div class={styles.lockedBadge}>
            <span class={styles.lockIcon}>🔒</span>
            {t('modals:heroRecruitment.levelRequired', { level: requiredLevel })}
          </div>
        );

      case 'premium':
        return (
          <div class={styles.premiumBadge}>
            <span class={styles.premiumIcon}>💎</span>
            {t('modals:heroRecruitment.status.premium')}
          </div>
        );
    }
  };

  return (
    <Modal
      visible={visible}
      size="fullscreen"
      class={styles.heroPreviewModal}
      onClick={handleBackdropClick}
    >
      <div class={styles.heroPreviewPanel} style={{ '--class-color': classColor } as JSX.CSSProperties}>
        {/* Header */}
        <div class={styles.modalHeader}>
          <div class={styles.titleSection}>
            <span class={styles.modalSubtitle}>{t('modals:heroRecruitment.heroPreview')}</span>
            <h2 class={styles.modalTitle}>
              {t(`data:heroes.${heroDefinition.id}.name`, { defaultValue: heroDefinition.name })}
            </h2>
          </div>
          <button class={styles.closeButton} onClick={onClose}>×</button>
        </div>

        {/* Main Content Grid */}
        <div class={styles.mainContent}>
          {/* Left Column - Hero Identity */}
          <div class={styles.leftColumn}>
            <HeroIdentityCard
              heroDefinition={heroDefinition}
              currentTier={1}
              level={1}
            />

            {/* Base Stats */}
            <div class={styles.baseStatsSection}>
              <h4 class={styles.sectionTitle}>{t('modals:heroRecruitment.baseStats')}</h4>
              <div class={styles.statGrid}>
                <div class={styles.statItem}>
                  <HpIcon size={18} className={styles.statIcon} />
                  <span class={styles.statLabel}>HP</span>
                  <span class={styles.statValue}>{heroDefinition.baseStats.hp}</span>
                </div>
                <div class={styles.statItem}>
                  <DamageIcon size={18} className={styles.statIcon} />
                  <span class={styles.statLabel}>DMG</span>
                  <span class={styles.statValue}>{heroDefinition.baseStats.damage}</span>
                </div>
                <div class={styles.statItem}>
                  <SpeedIcon size={18} className={styles.statIcon} />
                  <span class={styles.statLabel}>ATK SPD</span>
                  <span class={styles.statValue}>{heroDefinition.baseStats.attackSpeed.toFixed(2)}</span>
                </div>
                <div class={styles.statItem}>
                  <span class={styles.statIcon}>🏃</span>
                  <span class={styles.statLabel}>MOVE</span>
                  <span class={styles.statValue}>{heroDefinition.baseStats.moveSpeed}</span>
                </div>
              </div>
            </div>

            {/* Works With (Synergies) */}
            <WorksWithSection heroId={heroDefinition.id} />
          </div>

          {/* Right Column - Tiers */}
          <div class={styles.rightColumn}>
            <TierTabs
              tiers={heroDefinition.tiers}
              currentTier={1}
              selectedTier={selectedTier}
              onTierSelect={setSelectedTier}
              compact
            />
            <TierContent
              tier={heroDefinition.tiers[selectedTier - 1]}
              isCurrentTier={selectedTier === 1}
              isLocked={selectedTier > 1}
              classColor={classColor}
            />
          </div>
        </div>

        {/* Footer with Action */}
        <div class={styles.footer}>
          {renderActionButton()}
        </div>
      </div>
    </Modal>
  );
}
