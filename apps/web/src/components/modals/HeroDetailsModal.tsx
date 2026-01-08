import type { JSX } from 'preact';
import type { FortressClass } from '@arcade/sim-core';
import { useState } from 'preact/hooks';
import { getHeroById, calculateHeroStats } from '@arcade/sim-core';
import {
  upgradeTarget,
  upgradePanelVisible,
  activeHeroes,
  hubHeroes,
  gamePhase,
  displayGold,
  displayDust,
} from '../../state/index.js';
import { Modal } from '../shared/Modal.js';
import {
  HeroIdentityCard,
  HeroStatsCard,
  HeroWeaknessCard,
  TierTabs,
  TierContent,
  TierComparison,
  UpgradeSection,
} from './hero-details/index.js';
import styles from './HeroDetailsModal.module.css';

// Class colors (simplified: 5 classes)
const CLASS_COLORS: Record<FortressClass, string> = {
  natural: '#228b22',
  ice: '#00bfff',
  fire: '#ff4500',
  lightning: '#9932cc',
  tech: '#00f0ff',
};

interface HeroDetailsModalProps {
  onUpgrade: (target: { type: 'hero'; id: string }) => void;
}

export function HeroDetailsModal({ onUpgrade }: HeroDetailsModalProps) {
  const target = upgradeTarget.value;
  const visible = upgradePanelVisible.value;
  const gold = displayGold.value;
  const dust = displayDust.value;

  // Local state for selected tier tab
  const [selectedTier, setSelectedTier] = useState<1 | 2 | 3>(1);

  const handleClose = () => {
    upgradePanelVisible.value = false;
    upgradeTarget.value = null;
  };

  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  if (!visible || target?.type !== 'hero') return null;

  // Get hero data
  const heroes = gamePhase.value === 'idle' ? hubHeroes.value : activeHeroes.value;
  const hero = heroes.find(h => h.definitionId === target.heroId);
  if (!hero) return null;

  const heroDef = getHeroById(hero.definitionId);
  if (!heroDef) return null;

  const classColor = CLASS_COLORS[heroDef.class];
  const currentStats = calculateHeroStats(heroDef, hero.tier, hero.level);

  // Sync selected tier with current tier on mount
  if (selectedTier !== hero.tier && selectedTier === 1) {
    setSelectedTier(hero.tier);
  }

  const handleTierSelect = (tier: 1 | 2 | 3) => {
    setSelectedTier(tier);
  };

  const handleUpgrade = () => {
    onUpgrade({ type: 'hero', id: hero.definitionId });
  };

  // Get selected tier definition
  const selectedTierDef = heroDef.tiers[selectedTier - 1];

  return (
    <Modal visible={visible} class={styles.heroDetailsModal} onClick={handleBackdropClick}>
      <div class={styles.heroDetailsPanel} style={{ '--class-color': classColor } as JSX.CSSProperties}>
        {/* Header */}
        <div class={styles.modalHeader}>
          <h2 class={styles.modalTitle}>Szczegóły Bohatera</h2>
          <button class={styles.closeButton} onClick={handleClose}>×</button>
        </div>

        {/* Main Content Grid */}
        <div class={styles.mainContent}>
          {/* Left Column - Hero Identity & Upgrade */}
          <div class={styles.leftColumn}>
            <HeroIdentityCard
              heroDefinition={heroDef}
              currentTier={hero.tier}
              level={hero.level}
            />
            <UpgradeSection
              currentTier={hero.tier}
              playerGold={gold}
              playerDust={dust}
              onUpgrade={handleUpgrade}
            />
          </div>

          {/* Right Side - Stats, Weaknesses, Tiers */}
          <div class={styles.rightColumn}>
            {/* Top Row - Stats & Weaknesses */}
            <div class={styles.topRow}>
              <HeroStatsCard
                currentHp={hero.currentHp}
                maxHp={hero.maxHp}
                damage={currentStats.damage}
                attackSpeed={currentStats.attackSpeed}
                level={hero.level}
                xp={hero.xp}
              />
              <HeroWeaknessCard weaknesses={heroDef.weaknesses} />
            </div>

            {/* Tier Tabs */}
            <TierTabs
              tiers={heroDef.tiers}
              currentTier={hero.tier}
              selectedTier={selectedTier}
              onTierSelect={handleTierSelect}
            />

            {/* Selected Tier Content */}
            <div class={styles.tierContentWrapper}>
              <TierContent
                tier={selectedTierDef}
                isCurrentTier={selectedTier === hero.tier}
                isLocked={selectedTier > hero.tier}
                classColor={classColor}
              />
            </div>

            {/* Tier Comparison */}
            <div class={styles.comparisonWrapper}>
              <TierComparison
                heroDefinition={heroDef}
                currentTier={hero.tier}
                selectedTier={selectedTier}
                level={hero.level}
              />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
