import type { JSX } from 'preact';
import { useState, useMemo } from 'preact/hooks';
import { useTranslation } from 'react-i18next';
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
import { DustIcon, GoldIcon, SpeedIcon, ArmorIcon, HpIcon, DamageIcon, RangeIcon } from '../icons/index.js';
import type { ComponentChildren } from 'preact';
import { HeroPreviewModal } from './HeroPreviewModal.js';
import styles from './HeroRecruitmentModal.module.css';

// Rarity configuration (colors and order only - labels come from i18n)
const RARITY_CONFIG: Record<string, { color: string; order: number }> = {
  starter: { color: '#6b7280', order: 0 },
  common: { color: '#22c55e', order: 1 },
  rare: { color: '#3b82f6', order: 2 },
  epic: { color: '#a855f7', order: 3 },
  legendary: { color: '#fbbf24', order: 4 },
};

// Class icons and labels - using SVG for lightning and natural
function getClassIcon(className: string, size: number = 20): ComponentChildren {
  switch (className) {
    case 'lightning':
      return <SpeedIcon size={size} />;
    case 'natural':
      return <ArmorIcon size={size} />;
    case 'tech':
      return '⚙️';
    case 'void':
      return '🌀';
    case 'fire':
      return '🔥';
    case 'ice':
      return '❄️';
    case 'plasma':
      return '⚛️';
    default:
      return '🏰';
  }
}


type HeroStatus = 'owned' | 'available' | 'locked' | 'premium';

interface CategorizedHero {
  hero: typeof HEROES[0];
  status: HeroStatus;
  requiredLevel: number;
}

export function HeroRecruitmentModal() {
  const { t } = useTranslation('modals');
  const visible = heroRecruitmentModalVisible.value;

  const onClose = () => {
    heroRecruitmentModalVisible.value = false;
  };
  const [recruiting, setRecruiting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewHero, setPreviewHero] = useState<CategorizedHero | null>(null);

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
        setError(result.error || t('heroRecruitment.errors.failed'));
      }
    } catch (err) {
      setError(t('heroRecruitment.errors.connection'));
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

  const renderHeroCard = (categorizedHero: CategorizedHero) => {
    const { hero, status, requiredLevel } = categorizedHero;
    const isOwned = status === 'owned';
    const isLocked = status === 'locked';
    const isPremium = status === 'premium';
    const cost = getHeroUnlockCost(hero.id) || { gold: 0, dust: 0 };
    const canAfford = gold >= cost.gold && dust >= cost.dust;
    const isRecruiting = recruiting === hero.id;
    const isFree = hero.rarity === 'starter';
    const classLabel = t(`heroRecruitment.classes.${hero.class}`, { defaultValue: hero.class });
    const roleLabel = t(`heroRecruitment.roles.${hero.role}`, { defaultValue: hero.role });
    const rarityLabel = t(`heroRecruitment.rarity.${hero.rarity}`, { defaultValue: hero.rarity });
    const rarityConfig = RARITY_CONFIG[hero.rarity] || RARITY_CONFIG.common;

    const progressPercent = isLocked
      ? Math.min(100, Math.floor((currentFortressLevel / requiredLevel) * 100))
      : 100;

    const handleCardClick = () => {
      setPreviewHero(categorizedHero);
    };

    return (
      <div
        key={hero.id}
        class={`${styles.heroCard} ${isOwned ? styles.owned : ''} ${isLocked || isPremium ? styles.locked : ''}`}
        style={{ '--rarity-color': rarityConfig.color } as JSX.CSSProperties}
        onClick={handleCardClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCardClick(); }}
      >
        <div class={styles.rarityBadge}>
          {rarityLabel}
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
            <span class={styles.classIcon}>{getClassIcon(hero.class, 18)}</span>
            {classLabel}
          </div>
          <div class={styles.heroRole}>{roleLabel}</div>
        </div>

        <div class={styles.statsRow}>
          <div class={styles.stat} title={t('heroRecruitment.stats.hp')}>
            <HpIcon size={16} className={styles.statIcon} style={{ color: '#ef4444' }} />
            <span class={styles.statValue}>{hero.baseStats.hp}</span>
          </div>
          <div class={styles.stat} title={t('heroRecruitment.stats.damage')}>
            <DamageIcon size={16} className={styles.statIcon} style={{ color: '#f59e0b' }} />
            <span class={styles.statValue}>{hero.baseStats.damage}</span>
          </div>
        </div>

        <div class={styles.cardFooter}>
          {isPremium ? (
            <div class={styles.lockedContent}>
              <div class={styles.lockBadge}>
                <span class={styles.lockIcon}>💎</span>
                {t('heroRecruitment.status.premium')}
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
                  {t('heroRecruitment.progress.levelShort', { current: currentFortressLevel, required: requiredLevel })}
                </div>
              </div>
              <div class={styles.lockBadge}>
                <span class={styles.lockIcon}>🔒</span>
                {t('heroRecruitment.levelRequired', { level: requiredLevel })}
              </div>
            </div>
          ) : isOwned ? (
            <div class={styles.ownedContent}>
              <div class={styles.ownedLabel}>
                <span>✓</span> {t('heroRecruitment.status.owned')}
              </div>
            </div>
          ) : (
            <div class={styles.recruitContent}>
              <div class={styles.costRow}>
                {isFree ? (
                  <span class={styles.freeLabel}>{t('heroRecruitment.status.free')}</span>
                ) : (
                  <>
                    {cost.gold > 0 && (
                      <div class={`${styles.costItem} ${gold < cost.gold ? styles.insufficient : ''}`}>
                        <GoldIcon size={16} className={styles.costIcon} />
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
                onClick={(e) => {
                  e.stopPropagation();
                  handleRecruit(hero.id);
                }}
                disabled={!canAfford || isRecruiting}
              >
                {isRecruiting ? t('heroRecruitment.recruiting') : isFree ? t('heroRecruitment.unlock') : t('heroRecruitment.recruit')}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Modal visible={visible} onClose={onClose} title={t('heroRecruitment.title')} size="fullscreen" class={styles.recruitmentModal} bodyClass={styles.modalBody}>
      <div class={styles.container}>
        <div class={styles.resourceBar}>
          <div class={styles.resource}>
            <GoldIcon size={20} className={styles.goldIcon} />
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
                <span class={styles.sectionTitle}>{t('heroRecruitment.sections.yourHeroes')}</span>
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
                <RangeIcon size={20} className={styles.sectionIcon} />
                <span class={styles.sectionTitle}>{t('heroRecruitment.sections.availableForRecruitment')}</span>
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
                <span class={styles.sectionTitle}>{t('heroRecruitment.sections.locked')}</span>
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
                <span class={styles.sectionTitle}>{t('heroRecruitment.sections.premium')}</span>
                <span class={styles.sectionCount}>{premiumHeroes.length}</span>
              </div>
              <div class={styles.heroGrid}>
                {premiumHeroes.map(renderHeroCard)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hero Preview Modal */}
      <HeroPreviewModal
        visible={previewHero !== null}
        heroDefinition={previewHero?.hero ?? null}
        status={previewHero?.status ?? 'locked'}
        requiredLevel={previewHero?.requiredLevel ?? 1}
        onClose={() => setPreviewHero(null)}
        onRecruit={() => {
          if (previewHero) {
            handleRecruit(previewHero.hero.id);
            setPreviewHero(null);
          }
        }}
      />
    </Modal>
  );
}
