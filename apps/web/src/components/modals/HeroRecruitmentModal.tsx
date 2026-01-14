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
import { HeroAvatar } from '../shared/HeroAvatar.js';
import styles from './HeroRecruitmentModal.module.css';

// Rarity colors
const RARITY_COLORS: Record<string, string> = {
  starter: '#6b7280',
  common: '#22c55e',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#fbbf24', // Gold color for legendary
};

// Rarity labels
const RARITY_LABELS: Record<string, string> = {
  starter: 'Starter',
  common: 'Zwykły',
  rare: 'Rzadki',
  epic: 'Epicki',
  legendary: 'Legendarny',
};

// Role labels (Polish)
const ROLE_LABELS: Record<string, string> = {
  dps: 'Obrażenia',
  tank: 'Tank',
  support: 'Wsparcie',
  crowd_control: 'Kontrola',
  assassin: 'Zabójca',
};

// Class icons and labels
const CLASS_CONFIG: Record<string, { icon: string; label: string }> = {
  lightning: { icon: '⚡', label: 'Elektryczny' },
  tech: { icon: '⚙️', label: 'Technologia' },
  void: { icon: '🌀', label: 'Próżnia' },
  natural: { icon: '🛡️', label: 'Naturalny' },
  fire: { icon: '🔥', label: 'Ogień' },
  ice: { icon: '❄️', label: 'Lód' },
  plasma: { icon: '⚛️', label: 'Plazma' },
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

  // Sort heroes by rarity
  const sortedHeroes = [...HEROES].sort((a, b) => {
    const rarityOrder = ['starter', 'common', 'rare', 'epic'];
    return rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity);
  });

  return (
    <Modal visible={visible} onClose={onClose} title="Rekrutacja Bohaterów" size="xlarge" bodyClass={styles.modalBody}>
      <div class={styles.container}>

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
            const isOwned = unlocked.includes(hero.id);
            const isAvailableByLevel = isHeroUnlockedAtLevel(hero.id, currentFortressLevel);
            const requiredLevel = getHeroUnlockLevel(hero.id);
            const cost = getHeroUnlockCost(hero.id) || { gold: 0, dust: 0 };
            const canAfford = gold >= cost.gold && dust >= cost.dust;
            const isRecruiting = recruiting === hero.id;
            const isFree = hero.rarity === 'starter';
            const isLocked = !isAvailableByLevel;
            const classConfig = CLASS_CONFIG[hero.class] || { icon: '⬡', label: hero.class };
            const roleLabel = ROLE_LABELS[hero.role] || hero.role;

            // Progress calculation for locked heroes
            const progressPercent = isLocked
              ? Math.min(100, Math.floor((currentFortressLevel / requiredLevel) * 100))
              : 100;

            return (
              <div
                key={hero.id}
                class={`${styles.heroCard} ${isOwned ? styles.unlocked : ''} ${isLocked ? styles.locked : ''}`}
                style={{ '--rarity-color': RARITY_COLORS[hero.rarity] } as JSX.CSSProperties}
              >
                <div class={styles.rarityBadge}>
                  {RARITY_LABELS[hero.rarity]}
                </div>

                {isOwned && (
                  <div class={styles.ownedBadge}>✓</div>
                )}

                <div class={styles.heroAvatar}>
                  <HeroAvatar heroId={hero.id} tier={1} size={70} />
                </div>

                <div class={styles.heroName}>{hero.name}</div>

                <div class={styles.heroInfo}>
                  <div class={styles.heroClass}>
                    <span class={styles.classIcon}>{classConfig.icon}</span>
                    {classConfig.label}
                  </div>
                  <div class={styles.heroRole}>{roleLabel}</div>
                </div>

                <div class={styles.miniStats}>
                  <div class={styles.miniStat} title="HP">
                    <span class={styles.miniStatIcon} style={{ color: '#ef4444' }}>♥</span>
                    <span>{hero.baseStats.hp}</span>
                  </div>
                  <div class={styles.miniStat} title="Obrażenia">
                    <span class={styles.miniStatIcon} style={{ color: '#f59e0b' }}>⚔</span>
                    <span>{hero.baseStats.damage}</span>
                  </div>
                </div>

                {isLocked ? (
                  <div class={styles.lockedSection}>
                    <div class={styles.progressContainer}>
                      <div class={styles.progressBar}>
                        <div
                          class={styles.progressFill}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                      <div class={styles.progressText}>
                        Poz. {currentFortressLevel} / {requiredLevel}
                      </div>
                    </div>
                    <div class={styles.lockedBadge}>
                      <span class={styles.lockIcon}>🔒</span>
                      Poziom {requiredLevel}
                    </div>
                  </div>
                ) : isOwned ? (
                  <div class={styles.statusSection}>
                    <div class={styles.unlockedBadge}>
                      <span>✓</span> Posiadany
                    </div>
                  </div>
                ) : (
                  <div class={styles.statusSection}>
                    <div class={styles.costSection}>
                      {isFree ? (
                        <span class={styles.freeLabel}>Darmowy</span>
                      ) : (
                        <>
                          {cost.gold > 0 && (
                            <div class={`${styles.cost} ${gold < cost.gold ? styles.insufficient : ''}`}>
                              <span class={styles.costIcon}>💰</span>
                              {cost.gold.toLocaleString()}
                            </div>
                          )}
                          {cost.dust > 0 && (
                            <div class={`${styles.cost} ${dust < cost.dust ? styles.insufficient : ''}`}>
                              <span class={styles.costIcon}>✨</span>
                              {cost.dust.toLocaleString()}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    <button
                      class={`${styles.recruitButton} ${hero.rarity === 'legendary' ? styles.legendaryButton : ''}`}
                      onClick={() => handleRecruit(hero.id)}
                      disabled={!canAfford || isRecruiting}
                    >
                      <span>{isRecruiting ? 'Rekrutacja...' : isFree ? 'Odblokuj' : 'Rekrutuj'}</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
