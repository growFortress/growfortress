import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { HEROES, getHeroUnlockCost, isHeroUnlockedAtLevel, getHeroUnlockLevel } from '@arcade/sim-core';
import type { HeroIdType } from '@arcade/protocol';
import {
  unlockedHeroIds,
  displayGold,
  displayDust,
  heroRecruitmentModalVisible,
  baseLevel,
} from '../../state/index.js';
import { unlockHero } from '../../api/client.js';
import { updateProfileFromServer } from '../../state/index.js';
import { Modal } from '../shared/Modal.js';
import styles from './HeroRecruitmentModal.module.css';

// Hero icons
const HERO_ICONS: Record<string, string> = {
  thunderlord: '\u26A1',
  iron_sentinel: '\u{1F916}',
  jade_titan: '\u{1F4AA}',
  spider_sentinel: '\u{1F577}\uFE0F',
  shield_captain: '\u{1F6E1}\uFE0F',
  scarlet_mage: '\u{1F52E}',
  frost_archer: '\u{1F3F9}',
  flame_phoenix: '\u{1F525}',
  venom_assassin: '\u{1F5E1}\uFE0F',
  arcane_sorcerer: '\u{1F4D6}',
  frost_giant: '\u{1F9CA}',
  cosmic_guardian: '\u{1F31F}',
};

// Rarity colors
const RARITY_COLORS: Record<string, string> = {
  starter: '#888888',
  common: '#4CAF50',
  rare: '#2196F3',
  epic: '#9C27B0',
};

// Rarity labels
const RARITY_LABELS: Record<string, string> = {
  starter: 'Starter',
  common: 'Zwykły',
  rare: 'Rzadki',
  epic: 'Epicki',
};

export function HeroRecruitmentModal() {
  const visible = heroRecruitmentModalVisible.value;

  const onClose = () => {
    heroRecruitmentModalVisible.value = false;
  };
  const [recruiting, setRecruiting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const gold = displayGold.value;
  const dust = displayDust.value;
  const unlocked = unlockedHeroIds.value;
  const currentFortressLevel = baseLevel.value;

  const handleRecruit = async (heroId: string) => {
    setRecruiting(heroId);
    setError(null);

    try {
      const result = await unlockHero({ heroId: heroId as HeroIdType });

      if (result.success) {
        // Update local state
        unlockedHeroIds.value = result.unlockedHeroIds;
        // Refresh profile from server to get updated inventory
        await updateProfileFromServer();
      } else {
        setError(result.error || 'Nie udało się zrekrutować bohatera');
      }
    } catch (err) {
      setError('Błąd połączenia z serwerem');
      console.error('Failed to recruit hero:', err);
    } finally {
      setRecruiting(null);
    }
  };

  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Sort heroes by rarity
  const sortedHeroes = [...HEROES].sort((a, b) => {
    const rarityOrder = ['starter', 'common', 'rare', 'epic'];
    return rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity);
  });

  return (
    <Modal visible={visible} class={styles.modal} onClick={handleBackdropClick}>
      <div class={styles.container}>
        <div class={styles.header}>
          <h2 class={styles.title}>Rekrutacja Bohaterów</h2>
          <button class={styles.closeButton} onClick={onClose}>×</button>
        </div>

        <div class={styles.resourceBar}>
          <span class={styles.resource}>
            <span class={styles.goldIcon}>💰</span>
            {gold.toLocaleString()}
          </span>
          <span class={styles.resource}>
            <span class={styles.dustIcon}>✨</span>
            {dust.toLocaleString()}
          </span>
        </div>

        {error && <div class={styles.errorMessage}>{error}</div>}

        <div class={styles.heroGrid}>
          {sortedHeroes.map((hero) => {
            const icon = HERO_ICONS[hero.id] || '?';
            const isOwned = unlocked.includes(hero.id);
            const isAvailableByLevel = isHeroUnlockedAtLevel(hero.id, currentFortressLevel);
            const requiredLevel = getHeroUnlockLevel(hero.id);
            const cost = getHeroUnlockCost(hero.id) || { gold: 0, dust: 0 };
            const canAfford = gold >= cost.gold && dust >= cost.dust;
            const isRecruiting = recruiting === hero.id;
            const isFree = hero.rarity === 'starter';
            const isLocked = !isAvailableByLevel;

            return (
              <div
                key={hero.id}
                class={`${styles.heroCard} ${isOwned ? styles.unlocked : ''} ${isLocked ? styles.locked : ''}`}
                style={{ '--rarity-color': RARITY_COLORS[hero.rarity] } as JSX.CSSProperties}
              >
                <div class={styles.rarityBadge}>
                  {RARITY_LABELS[hero.rarity]}
                </div>

                <div class={styles.heroIcon}>{isLocked ? '🔒' : icon}</div>
                <div class={styles.heroName}>{hero.name}</div>
                <div class={styles.heroRole}>{hero.role}</div>

                {isLocked ? (
                  <div class={styles.lockedBadge}>
                    <span class={styles.lockIcon}>🔒</span>
                    Poziom {requiredLevel}
                  </div>
                ) : isOwned ? (
                  <div class={styles.unlockedBadge}>Odblokowany</div>
                ) : (
                  <div class={styles.costSection}>
                    {isFree ? (
                      <span class={styles.freeLabel}>Darmowy</span>
                    ) : (
                      <>
                        <div class={`${styles.cost} ${gold < cost.gold ? styles.insufficient : ''}`}>
                          <span class={styles.goldIcon}>💰</span>
                          {cost.gold.toLocaleString()}
                        </div>
                        <div class={`${styles.cost} ${dust < cost.dust ? styles.insufficient : ''}`}>
                          <span class={styles.dustIcon}>✨</span>
                          {cost.dust.toLocaleString()}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {!isOwned && !isLocked && (
                  <button
                    class={styles.recruitButton}
                    onClick={() => handleRecruit(hero.id)}
                    disabled={!canAfford || isRecruiting}
                  >
                    {isRecruiting ? 'Rekrutacja...' : isFree ? 'Odblokuj' : 'Rekrutuj'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
