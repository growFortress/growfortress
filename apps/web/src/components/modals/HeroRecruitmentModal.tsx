import type { JSX } from 'preact';
import { useState, useMemo } from 'preact/hooks';
import { HEROES, getHeroUnlockCost, isHeroUnlockedAtLevel, getHeroUnlockLevel, isPremiumShopHero } from '@arcade/sim-core';
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
import { DustIcon } from '../icons/index.js';
import styles from './HeroRecruitmentModal.module.css';

// Rarity configuration
const RARITY_CONFIG: Record<string, { color: string; label: string; order: number }> = {
  starter: { color: '#6b7280', label: 'Starter', order: 0 },
  common: { color: '#22c55e', label: 'Zwykły', order: 1 },
  rare: { color: '#3b82f6', label: 'Rzadki', order: 2 },
  epic: { color: '#a855f7', label: 'Epicki', order: 3 },
  legendary: { color: '#fbbf24', label: 'Legendarny', order: 4 },
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

type HeroStatus = 'owned' | 'available' | 'locked' | 'premium';

interface CategorizedHero {
  hero: typeof HEROES[0];
  status: HeroStatus;
  requiredLevel: number;
}

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
        unlockedHeroIds.value = result.unlockedHeroIds;
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

  // Categorize and sort heroes
  const { ownedHeroes, availableHeroes, lockedHeroes, premiumHeroes } = useMemo(() => {
    const categorized: CategorizedHero[] = HEROES.map(hero => {
      const isOwned = unlocked.includes(hero.id);
      const isPremium = isPremiumShopHero(hero.id);
      const isAvailableByLevel = isHeroUnlockedAtLevel(hero.id, currentFortressLevel);
      const requiredLevel = getHeroUnlockLevel(hero.id);

      let status: HeroStatus;
      if (isOwned) {
        status = 'owned';
      } else if (isPremium) {
        status = 'premium';
      } else if (isAvailableByLevel) {
        status = 'available';
      } else {
        status = 'locked';
      }

      return { hero, status, requiredLevel };
    });

    // Sort by rarity within each category
    const sortByRarity = (a: CategorizedHero, b: CategorizedHero) => {
      const rarityA = RARITY_CONFIG[a.hero.rarity]?.order ?? 99;
      const rarityB = RARITY_CONFIG[b.hero.rarity]?.order ?? 99;
      return rarityA - rarityB;
    };

    const owned = categorized.filter(c => c.status === 'owned').sort(sortByRarity);
    const available = categorized.filter(c => c.status === 'available').sort(sortByRarity);
    const premium = categorized.filter(c => c.status === 'premium').sort(sortByRarity);
    const locked = categorized.filter(c => c.status === 'locked').sort((a, b) => {
      // Sort locked heroes by required level first, then by rarity
      if (a.requiredLevel !== b.requiredLevel) {
        return a.requiredLevel - b.requiredLevel;
      }
      return sortByRarity(a, b);
    });

    return { ownedHeroes: owned, availableHeroes: available, lockedHeroes: locked, premiumHeroes: premium };
  }, [unlocked, currentFortressLevel]);

  const renderHeroCard = ({ hero, status, requiredLevel }: CategorizedHero) => {
    const isOwned = status === 'owned';
    const isLocked = status === 'locked';
    const isPremium = status === 'premium';
    const cost = getHeroUnlockCost(hero.id) || { gold: 0, dust: 0 };
    const canAfford = gold >= cost.gold && dust >= cost.dust;
    const isRecruiting = recruiting === hero.id;
    const isFree = hero.rarity === 'starter';
    const classConfig = CLASS_CONFIG[hero.class] || { icon: '⬡', label: hero.class };
    const roleLabel = ROLE_LABELS[hero.role] || hero.role;
    const rarityConfig = RARITY_CONFIG[hero.rarity] || RARITY_CONFIG.common;

    const progressPercent = isLocked
      ? Math.min(100, Math.floor((currentFortressLevel / requiredLevel) * 100))
      : 100;

    return (
      <div
        key={hero.id}
        class={`${styles.heroCard} ${isOwned ? styles.owned : ''} ${isLocked || isPremium ? styles.locked : ''}`}
        style={{ '--rarity-color': rarityConfig.color } as JSX.CSSProperties}
      >
        <div class={styles.rarityBadge}>
          {rarityConfig.label}
        </div>

        {isOwned && (
          <div class={styles.ownedBadge}>✓</div>
        )}

        <div class={styles.heroAvatar}>
          <HeroAvatar heroId={hero.id} tier={1} size={90} />
        </div>

        <div class={styles.heroName}>{hero.name}</div>

        <div class={styles.heroMeta}>
          <div class={styles.heroClass}>
            <span class={styles.classIcon}>{classConfig.icon}</span>
            {classConfig.label}
          </div>
          <div class={styles.heroRole}>{roleLabel}</div>
        </div>

        <div class={styles.statsRow}>
          <div class={styles.stat} title="HP">
            <span class={styles.statIcon} style={{ color: '#ef4444' }}>♥</span>
            <span class={styles.statValue}>{hero.baseStats.hp}</span>
          </div>
          <div class={styles.stat} title="Obrażenia">
            <span class={styles.statIcon} style={{ color: '#f59e0b' }}>⚔</span>
            <span class={styles.statValue}>{hero.baseStats.damage}</span>
          </div>
        </div>

        <div class={styles.cardFooter}>
          {isPremium ? (
            <div class={styles.lockedContent}>
              <div class={styles.lockBadge}>
                <span class={styles.lockIcon}>💎</span>
                Premium
              </div>
            </div>
          ) : isLocked ? (
            <div class={styles.lockedContent}>
              <div class={styles.progressContainer}>
                <div class={styles.progressBar}>
                  <div
                    class={styles.progressFill}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div class={styles.progressLabel}>
                  Poz. {currentFortressLevel} / {requiredLevel}
                </div>
              </div>
              <div class={styles.lockBadge}>
                <span class={styles.lockIcon}>🔒</span>
                Poziom {requiredLevel}
              </div>
            </div>
          ) : isOwned ? (
            <div class={styles.ownedContent}>
              <div class={styles.ownedLabel}>
                <span>✓</span> Posiadany
              </div>
            </div>
          ) : (
            <div class={styles.recruitContent}>
              <div class={styles.costRow}>
                {isFree ? (
                  <span class={styles.freeLabel}>Darmowy</span>
                ) : (
                  <>
                    {cost.gold > 0 && (
                      <div class={`${styles.costItem} ${gold < cost.gold ? styles.insufficient : ''}`}>
                        <span class={styles.costIcon}>🪙</span>
                        {cost.gold.toLocaleString()}
                      </div>
                    )}
                    {cost.dust > 0 && (
                      <div class={`${styles.costItem} ${dust < cost.dust ? styles.insufficient : ''}`}>
                        <DustIcon size={14} className={styles.costIcon} />
                        {cost.dust.toLocaleString()}
                      </div>
                    )}
                  </>
                )}
              </div>
              <button
                class={`${styles.recruitButton} ${hero.rarity === 'legendary' ? styles.legendaryBtn : ''}`}
                onClick={() => handleRecruit(hero.id)}
                disabled={!canAfford || isRecruiting}
              >
                {isRecruiting ? 'Rekrutacja...' : isFree ? 'Odblokuj' : 'Rekrutuj'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Modal visible={visible} onClose={onClose} title="Rekrutacja Bohaterów" size="fullscreen" bodyClass={styles.modalBody}>
      <div class={styles.container}>
        <div class={styles.resourceBar}>
          <div class={styles.resource}>
            <span class={styles.goldIcon}>🪙</span>
            <span class={styles.resourceValue}>{gold.toLocaleString()}</span>
          </div>
          <div class={styles.resource}>
            <DustIcon size={22} className={styles.dustIcon} />
            <span class={styles.resourceValue}>{dust.toLocaleString()}</span>
          </div>
        </div>

        {error && <div class={styles.errorBanner}>{error}</div>}

        <div class={styles.heroSections}>
          {/* Owned Heroes */}
          {ownedHeroes.length > 0 && (
            <div class={styles.section}>
              <div class={styles.sectionHeader}>
                <span class={styles.sectionIcon}>✓</span>
                <span class={styles.sectionTitle}>Twoi Bohaterowie</span>
                <span class={styles.sectionCount}>{ownedHeroes.length}</span>
              </div>
              <div class={styles.heroGrid}>
                {ownedHeroes.map(renderHeroCard)}
              </div>
            </div>
          )}

          {/* Available Heroes */}
          {availableHeroes.length > 0 && (
            <div class={styles.section}>
              <div class={styles.sectionHeader}>
                <span class={styles.sectionIcon}>🎯</span>
                <span class={styles.sectionTitle}>Dostępni do Rekrutacji</span>
                <span class={styles.sectionCount}>{availableHeroes.length}</span>
              </div>
              <div class={styles.heroGrid}>
                {availableHeroes.map(renderHeroCard)}
              </div>
            </div>
          )}

          {/* Locked Heroes */}
          {lockedHeroes.length > 0 && (
            <div class={styles.section}>
              <div class={styles.sectionHeader}>
                <span class={styles.sectionIcon}>🔒</span>
                <span class={styles.sectionTitle}>Zablokowane</span>
                <span class={styles.sectionCount}>{lockedHeroes.length}</span>
              </div>
              <div class={styles.heroGrid}>
                {lockedHeroes.map(renderHeroCard)}
              </div>
            </div>
          )}

          {/* Premium Heroes */}
          {premiumHeroes.length > 0 && (
            <div class={styles.section}>
              <div class={styles.sectionHeader}>
                <span class={styles.sectionIcon}>💎</span>
                <span class={styles.sectionTitle}>Premium</span>
                <span class={styles.sectionCount}>{premiumHeroes.length}</span>
              </div>
              <div class={styles.heroGrid}>
                {premiumHeroes.map(renderHeroCard)}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
