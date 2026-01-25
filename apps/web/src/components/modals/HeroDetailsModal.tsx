import type { JSX } from 'preact';
import type { FortressClass, HeroDefinition, ActiveHero } from '@arcade/sim-core';
import { useState } from 'preact/hooks';
import { useTranslation } from '../../i18n/useTranslation.js';
import {
  getHeroById,
  calculateHeroStats,
  calculateHeroPower,
  createDefaultStatUpgrades,
  HERO_STAT_UPGRADES,
  getUpgradeCost,
  getStatBonusPercent,
  getStatMultiplier,
  ARTIFACT_DEFINITIONS,
  applyArtifactBonusesToStats,
  getHeroSynergies,
} from '@arcade/sim-core';
import {
  upgradeTarget,
  upgradePanelVisible,
  activeHeroes,
  hubHeroes,
  gamePhase,
  displayGold,
  displayDust,
  powerState,
  baseGold,
  updateHeroStatLevel,
  updateTotalPower,
  showErrorToast,
  selectedFortressClass,
  activeSynergies,
  heroPlacementModalVisible,
  heroPlacementSlotIndex,
} from '../../state/index.js';
import {
  type PowerStatUpgrades,
} from '@arcade/protocol';
import { Modal } from '../shared/Modal.js';
import {
  HeroIdentityCard,
  SkillCard,
  UpgradeSection,
  TierPreviewModal,
  ArtifactPickerModal,
} from './hero-details/index.js';
import {
  getArtifactForHero,
  unequippedArtifacts,
  updateArtifact,
} from '../../state/artifacts.signals.js';
import { guildBonuses } from '../../state/guild.signals.js';
import { getAccessToken } from '../../api/auth.js';
import styles from './HeroDetailsModal.module.css';

// Timeout for async operations (10 seconds)
const ASYNC_TIMEOUT_MS = 10000;

/**
 * Wraps a promise with a timeout
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
    ),
  ]);
}

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

// Stat icons
const STAT_ICONS: Record<string, string> = {
  hp: '❤️',
  damage: '⚔️',
};

// Inline stat row component
interface HeroStatRowProps {
  icon: string;
  label: string;
  value: string | number;
  upgradeLevel?: number;
  maxLevel?: number;
  bonusPercent?: string;
  upgradeCost?: number;
  canAfford?: boolean;
  onUpgrade?: () => void;
  isLoading?: boolean;
  nextValue?: number; // Value after next upgrade
  compareValue?: number; // Value from comparison hero
}

function HeroStatRow({
  icon,
  label,
  value,
  upgradeLevel,
  maxLevel,
  bonusPercent: _bonusPercent,
  upgradeCost,
  canAfford,
  onUpgrade,
  isLoading,
  nextValue,
  compareValue,
}: HeroStatRowProps) {
  const { t } = useTranslation('common');
  const hasUpgrade = upgradeLevel !== undefined && maxLevel !== undefined;
  const isMaxed = hasUpgrade && upgradeLevel >= maxLevel;
  const numValue = typeof value === 'number' ? value : parseFloat(value);
  const delta = nextValue !== undefined && !isMaxed ? nextValue - numValue : undefined;
  const compareDiff = compareValue !== undefined ? numValue - compareValue : undefined;

  return (
    <div class={styles.statRow}>
      <span class={styles.statIcon}>{icon}</span>
      <span class={styles.statLabel}>{label}</span>
      <span class={styles.statValue}>{value}</span>
      {/* Delta badge: shows what you gain after next upgrade */}
      {delta !== undefined && delta > 0 && (
        <span class={styles.deltaBadge}>+{Math.round(delta)}</span>
      )}
      {/* Compare diff: shows difference vs comparison hero */}
      {compareValue !== undefined && compareDiff !== undefined && (
        <span class={`${styles.compareBadge} ${compareDiff > 0 ? styles.positive : compareDiff < 0 ? styles.negative : ''}`}>
          {compareDiff > 0 ? '+' : ''}{Math.round(compareDiff)}
        </span>
      )}
      {hasUpgrade && (
        <>
          <span class={styles.statLevel}>{t('labels.lv')} {upgradeLevel}{maxLevel !== Infinity && `/${maxLevel}`}</span>
          {isMaxed ? (
            <span class={styles.maxBadge}>{t('heroDetails.maxLabel')}</span>
          ) : (
            <button
              class={styles.upgradeBtn}
              disabled={!canAfford || isLoading}
              onClick={onUpgrade}
            >
              {isLoading ? '...' : `${upgradeCost}`}
              <span class={styles.goldIcon}>🪙</span>
            </button>
          )}
        </>
      )}
    </div>
  );
}

// Class icons
const CLASS_ICONS: Record<FortressClass, string> = {
  natural: '🌿',
  ice: '❄️',
  fire: '🔥',
  lightning: '⚡',
  tech: '🔧',
  void: '🌀',
  plasma: '⚛️',
};

// Works With section - shows hero pair/trio synergies
interface WorksWithSectionProps {
  heroId: string;
}

function WorksWithSection({ heroId }: WorksWithSectionProps) {
  const { t } = useTranslation(['common', 'data']);
  const heroSynergies = getHeroSynergies(heroId);

  if (heroSynergies.pairs.length === 0 && heroSynergies.trios.length === 0) {
    return null;
  }

  const getHeroName = (id: string): string => {
    const heroDef = getHeroById(id);
    return heroDef ? t(`data:heroes.${id}.name`, { defaultValue: heroDef.name }) : id;
  };

  return (
    <div class={styles.worksWithSection}>
      <h4 class={styles.sectionTitle}>🤝 {t('heroDetails.worksWith', { defaultValue: 'Works With' })}</h4>

      {/* Pair synergies */}
      {heroSynergies.pairs.map(synergy => (
        <div key={synergy.id} class={styles.synergyComboPair}>
          <div class={styles.synergyComboHeader}>
            <span class={styles.synergyComboIcon}>⚡</span>
            <span class={styles.synergyComboName}>
              {t(synergy.nameKey, { defaultValue: synergy.name })}
            </span>
          </div>
          <div class={styles.synergyComboPartner}>
            + {getHeroName(synergy.partner)}
          </div>
          <div class={styles.synergyComboDesc}>
            {t(synergy.descriptionKey, { defaultValue: synergy.description })}
          </div>
          <div class={styles.synergyComboBonuses}>
            {synergy.bonuses.map((bonus, i) => (
              <span key={i} class={styles.synergyComboBonusTag}>{bonus}</span>
            ))}
          </div>
        </div>
      ))}

      {/* Trio synergies */}
      {heroSynergies.trios.map(synergy => (
        <div key={synergy.id} class={styles.synergyComboTrio}>
          <div class={styles.synergyComboHeader}>
            <span class={styles.synergyComboIcon}>⭐</span>
            <span class={styles.synergyComboName}>
              {t(synergy.nameKey, { defaultValue: synergy.name })}
            </span>
          </div>
          <div class={styles.synergyComboPartner}>
            + {synergy.partners.map(p => getHeroName(p)).join(' + ')}
          </div>
          <div class={styles.synergyComboDesc}>
            {t(synergy.descriptionKey, { defaultValue: synergy.description })}
          </div>
          <div class={styles.synergyComboBonuses}>
            {synergy.bonuses.map((bonus, i) => (
              <span key={i} class={styles.synergyComboBonusTag}>{bonus}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Synergy section component
interface SynergySectionProps {
  heroDefinition: HeroDefinition;
}

function SynergySection({ heroDefinition }: SynergySectionProps) {
  const { t } = useTranslation('common');
  const fortressClass = selectedFortressClass.value;
  const synergies = activeSynergies.value;

  const heroMatchesFortress = fortressClass === heroDefinition.class;
  const heroSynergy = synergies.find(s => s.type === 'hero-fortress' && s.active);
  const roleKey = heroDefinition.role === 'crowd_control' ? 'control' : heroDefinition.role;

  return (
    <div class={styles.synergySection}>
      <h4 class={styles.sectionTitle}>{t('heroDetails.synergiesTitle')}</h4>

      {/* Best Use */}
      <div class={styles.synergyItem}>
        <span class={styles.synergyLabel}>{t('heroDetails.bestUse')}</span>
        <span class={styles.synergyValue}>
          {CLASS_ICONS[heroDefinition.class]} {t(`elements.${heroDefinition.class}`)} {t(`roles.${roleKey}`)}
        </span>
      </div>

      {/* Fortress Synergy */}
      <div class={styles.synergyItem}>
        <span class={styles.synergyLabel}>{t('heroDetails.fortressSynergy')}</span>
        <span class={`${styles.synergyValue} ${heroMatchesFortress ? styles.synergyActive : styles.synergyInactive}`}>
          {heroMatchesFortress ? (
            <>✓ {t('heroDetails.synergyActive')}{heroSynergy ? ` (+${heroSynergy.bonuses.join(', ')})` : ''}</>
          ) : (
            <>{t('heroDetails.synergyInactive', { class: t(`elements.${heroDefinition.class}`) })}</>
          )}
        </span>
      </div>

      {/* Anti-synergies (weaknesses) */}
      {heroDefinition.weaknesses.length > 0 && (
        <div class={styles.synergyItem}>
          <span class={styles.synergyLabel}>{t('heroDetails.antiSynergies')}</span>
          <div class={styles.weaknessTags}>
            {heroDefinition.weaknesses.map(w => (
              <span key={w.id} class={styles.weaknessTag}>
                ⚠️ {t(`data:weaknesses.${w.id}.name`, { defaultValue: w.name })}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Works With - Hero Pair/Trio Synergies */}
      <WorksWithSection heroId={heroDefinition.id} />
    </div>
  );
}

// Helper to create auth headers
function createAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getAccessToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// API functions
async function upgradeHeroStat(heroId: string, stat: string): Promise<{
  success: boolean;
  newLevel?: number;
  goldSpent?: number;
  newGold?: number;
  newTotalPower?: number;
  error?: string;
}> {
  const response = await fetch('/api/v1/power/hero', {
    method: 'POST',
    headers: createAuthHeaders(),
    body: JSON.stringify({ heroId, stat }),
  });
  return response.json();
}

interface ArtifactApiResponse {
  success: boolean;
  artifact?: {
    id: string;
    artifactId: string;
    level: number;
    equippedSlot: 'weapon' | 'armor' | 'accessory' | null;
    equippedToHeroId: string | null;
    acquiredAt: string;
    upgradedAt?: string | null;
  };
  error?: string;
}

async function equipArtifactToHero(
  artifactInstanceId: string,
  heroId: string,
  slotType: 'weapon' | 'armor' | 'accessory'
): Promise<ArtifactApiResponse> {
  const response = await fetch('/api/v1/artifacts/equip', {
    method: 'POST',
    headers: createAuthHeaders(),
    body: JSON.stringify({ artifactInstanceId, heroId, slotType }),
  });
  return response.json();
}

async function unequipArtifactFromHero(artifactInstanceId: string): Promise<ArtifactApiResponse> {
  const response = await fetch('/api/v1/artifacts/unequip', {
    method: 'POST',
    headers: createAuthHeaders(),
    body: JSON.stringify({ artifactInstanceId }),
  });
  return response.json();
}

// Artifact slot icons
const SLOT_ICONS: Record<string, string> = {
  weapon: '⚔️',
  armor: '🛡️',
  accessory: '💍',
  gadget: '🔧',
  book: '📖',
  special: '⭐',
};

interface HeroDetailsModalProps {
  onUpgrade: (target: { type: 'hero'; id: string }) => void;
}

export function HeroDetailsModal({ onUpgrade }: HeroDetailsModalProps) {
  const { t, language } = useTranslation(['common', 'data']);
  const target = upgradeTarget.value;
  const visible = upgradePanelVisible.value;
  const gold = displayGold.value;
  const dust = displayDust.value;

  const [loadingStat, setLoadingStat] = useState<string | null>(null);
  const [showTierPreview, setShowTierPreview] = useState(false);
  const [showArtifactPicker, setShowArtifactPicker] = useState(false);
  const [equipmentLoading, setEquipmentLoading] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareHeroId, setCompareHeroId] = useState<string | null>(null);

  const handleClose = () => {
    upgradePanelVisible.value = false;
    upgradeTarget.value = null;
    setCompareMode(false);
    setCompareHeroId(null);
  };

  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  if (!visible || target?.type !== 'hero') return null;

  // Get hero data
  const heroes = gamePhase.value === 'idle' ? hubHeroes.value.filter((h): h is ActiveHero => h !== null) : activeHeroes.value;
  const hero = heroes.find(h => h.definitionId === target.heroId);
  if (!hero) return null;

  const heroDef = getHeroById(hero.definitionId);
  if (!heroDef) return null;

  const classColor = CLASS_COLORS[heroDef.class];

  // Equipment handlers
  const equippedArtifact = getArtifactForHero(hero.definitionId);
  const availableArtifacts = unequippedArtifacts.value;

  // Calculate stats with artifact bonuses
  const baseStats = calculateHeroStats(heroDef, hero.tier, hero.level);
  const currentStats = applyArtifactBonusesToStats(baseStats, equippedArtifact?.artifactId);

  const heroUpgrades = powerState.value.heroUpgrades.find(h => h.heroId === hero.definitionId);
  const currentTierDef = heroDef.tiers[hero.tier - 1];

  // XP progress calculation
  const xpForNextLevel = Math.floor(100 * Math.pow(1.5, hero.level - 1));
  const xpProgress = Math.min((hero.xp / xpForNextLevel) * 100, 100);

  const handleUpgrade = () => {
    onUpgrade({ type: 'hero', id: hero.definitionId });
  };

  const handleStatUpgrade = async (stat: string) => {
    setLoadingStat(stat);
    try {
      const result = await withTimeout(
        upgradeHeroStat(hero.definitionId, stat),
        ASYNC_TIMEOUT_MS,
        t('heroDetails.operationTimeout')
      );
      if (result.success && result.newLevel !== undefined) {
        updateHeroStatLevel(hero.definitionId, stat as keyof PowerStatUpgrades, result.newLevel);
        if (result.newGold !== undefined) baseGold.value = result.newGold;
        if (result.newTotalPower !== undefined) updateTotalPower(result.newTotalPower);
      } else if (result.error) {
        showErrorToast(result.error);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t('heroDetails.upgradeStatFailed');
      showErrorToast(message);
    } finally {
      setLoadingStat(null);
    }
  };

  const handleEquipArtifact = async (artifactInstanceId: string) => {
    setEquipmentLoading(true);
    try {
      // Find the artifact instance to get its artifactId
      const artifactInstance = availableArtifacts.find(a => a.id === artifactInstanceId);
      if (!artifactInstance) {
        showErrorToast(t('heroDetails.artifactNotFound'));
        return;
      }

      // Find artifact definition to get slotType
      const artifactDef = ARTIFACT_DEFINITIONS.find(def => def.id === artifactInstance.artifactId);
      if (!artifactDef) {
        showErrorToast(t('heroDetails.artifactDefNotFound'));
        return;
      }

      const result = await withTimeout(
        equipArtifactToHero(artifactInstanceId, hero.definitionId, artifactDef.slotType),
        ASYNC_TIMEOUT_MS,
        t('heroDetails.operationTimeout')
      );
      if (result.success && result.artifact) {
        updateArtifact(result.artifact);
        setShowArtifactPicker(false);
      } else if (result.error) {
        showErrorToast(result.error);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t('heroDetails.equipArtifactFailed');
      showErrorToast(message);
    } finally {
      setEquipmentLoading(false);
    }
  };

  const handleUnequipArtifact = async () => {
    if (!equippedArtifact) return;
    setEquipmentLoading(true);
    try {
      const result = await withTimeout(
        unequipArtifactFromHero(equippedArtifact.id),
        ASYNC_TIMEOUT_MS,
        t('heroDetails.operationTimeout')
      );
      if (result.success && result.artifact) {
        updateArtifact(result.artifact);
      } else if (result.error) {
        showErrorToast(result.error);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t('heroDetails.unequipArtifactFailed');
      showErrorToast(message);
    } finally {
      setEquipmentLoading(false);
    }
  };

  // Get upgrade configs for HP and Damage
  const hpConfig = HERO_STAT_UPGRADES.find(c => c.stat === 'hp');
  const dmgConfig = HERO_STAT_UPGRADES.find(c => c.stat === 'damage');
  const hpLevel = heroUpgrades?.statUpgrades.hp || 0;
  const dmgLevel = heroUpgrades?.statUpgrades.damage || 0;

  // Calculate upgraded stats (base stats * upgrade multiplier * guild bonus)
  const hpMultiplier = hpConfig ? getStatMultiplier(hpConfig, hpLevel) : 1;
  const dmgMultiplier = dmgConfig ? getStatMultiplier(dmgConfig, dmgLevel) : 1;
  const guildStatBoost = 1 + (guildBonuses.value?.statBoost ?? 0);
  const upgradedHp = Math.floor(currentStats.hp * hpMultiplier * guildStatBoost);
  const upgradedDamage = Math.floor(currentStats.damage * dmgMultiplier * guildStatBoost);
  const upgradedAttackSpeed = currentStats.attackSpeed * guildStatBoost;

  // Calculate NEXT level stats for delta display
  const nextHpLevel = hpLevel + 1;
  const nextDmgLevel = dmgLevel + 1;
  const nextHpMultiplier = hpConfig ? getStatMultiplier(hpConfig, nextHpLevel) : 1;
  const nextDmgMultiplier = dmgConfig ? getStatMultiplier(dmgConfig, nextDmgLevel) : 1;
  const nextUpgradedHp = hpConfig && hpLevel < hpConfig.maxLevel
    ? Math.floor(currentStats.hp * nextHpMultiplier * guildStatBoost)
    : undefined;
  const nextUpgradedDamage = dmgConfig && dmgLevel < dmgConfig.maxLevel
    ? Math.floor(currentStats.damage * nextDmgMultiplier * guildStatBoost)
    : undefined;

  // Comparison hero data
  const otherHeroes = heroes.filter(h => h.definitionId !== hero.definitionId);
  const compareHero = compareHeroId ? heroes.find(h => h.definitionId === compareHeroId) : null;
  const compareHeroDef = compareHero ? getHeroById(compareHero.definitionId) : null;
  
  // Calculate compare hero stats if in compare mode
  let compareStats: { hp: number; damage: number; attackSpeed: number; power: number } | null = null;
  if (compareMode && compareHero && compareHeroDef) {
    const compareEquippedArtifact = getArtifactForHero(compareHero.definitionId);
    const compareBaseStats = calculateHeroStats(compareHeroDef, compareHero.tier, compareHero.level);
    const compareCurrentStats = applyArtifactBonusesToStats(compareBaseStats, compareEquippedArtifact?.artifactId);
    const compareHeroUpgrades = powerState.value.heroUpgrades.find(h => h.heroId === compareHero.definitionId);
    const compareHpLevel = compareHeroUpgrades?.statUpgrades.hp || 0;
    const compareDmgLevel = compareHeroUpgrades?.statUpgrades.damage || 0;
    const compareHpMultiplier = hpConfig ? getStatMultiplier(hpConfig, compareHpLevel) : 1;
    const compareDmgMultiplier = dmgConfig ? getStatMultiplier(dmgConfig, compareDmgLevel) : 1;
    
    const comparePower = calculateHeroPower(
      compareHero.definitionId,
      compareHeroUpgrades?.statUpgrades || createDefaultStatUpgrades(),
      compareHero.tier,
      compareEquippedArtifact?.artifactId
    );
    
    compareStats = {
      hp: Math.floor(compareCurrentStats.hp * compareHpMultiplier * guildStatBoost),
      damage: Math.floor(compareCurrentStats.damage * compareDmgMultiplier * guildStatBoost),
      attackSpeed: compareCurrentStats.attackSpeed * guildStatBoost,
      power: comparePower.totalPower,
    };
  }

  // Calculate hero power (with equipped artifact)
  const heroPowerBreakdown = calculateHeroPower(
    hero.definitionId,
    heroUpgrades?.statUpgrades || createDefaultStatUpgrades(),
    hero.tier,
    equippedArtifact?.artifactId
  );

  const getArtifactName = (artifactId: string, name: string, polishName: string) =>
    t(`data:artifacts.${artifactId}.name`, {
      defaultValue: language === 'pl' ? polishName : name,
    });

  const heroSlotIndex = gamePhase.value === 'idle'
    ? hubHeroes.value.findIndex((h) => h !== null && h.definitionId === hero.definitionId)
    : -1;

  const handleChangeHero = () => {
    if (gamePhase.value !== 'idle' || heroSlotIndex === -1) return;
    heroPlacementSlotIndex.value = heroSlotIndex;
    heroPlacementModalVisible.value = true;
    handleClose();
  };

  return (
    <Modal visible={visible} size="fullscreen" class={`${styles.heroDetailsModal} ${compareMode ? styles.compareMode : ''}`} onClick={handleBackdropClick}>
      <div class={styles.heroDetailsPanel} style={{ '--class-color': classColor } as JSX.CSSProperties}>
        {/* Header */}
        <div class={styles.modalHeader}>
          <h2 class={styles.modalTitle}>{t('heroDetails.title')}</h2>
          <div class={styles.headerActions}>
            {/* Compare Toggle */}
            <button
              class={`${styles.compareToggle} ${compareMode ? styles.active : ''}`}
              onClick={() => {
                setCompareMode(!compareMode);
                if (compareMode) setCompareHeroId(null);
              }}
              disabled={otherHeroes.length === 0}
              title={t('heroDetails.compareMode')}
            >
              ⚖️ {t('heroDetails.compare')}
            </button>
            {gamePhase.value === 'idle' && heroSlotIndex !== -1 && (
              <button
                class={styles.changeHeroButton}
                onClick={handleChangeHero}
                type="button"
              >
                {t('heroDetails.changeHero')}
              </button>
            )}
            <button class={styles.closeButton} onClick={handleClose}>×</button>
          </div>
        </div>
        
        {/* Compare Hero Selector */}
        {compareMode && (
          <div class={styles.compareSelector}>
            <span class={styles.compareSelectorLabel}>{t('heroDetails.compareWith')}:</span>
            <select
              class={styles.heroSelect}
              value={compareHeroId || ''}
              onChange={(e) => setCompareHeroId((e.target as HTMLSelectElement).value || null)}
            >
              <option value="">{t('heroDetails.selectHero')}</option>
              {otherHeroes.map(h => {
                const def = getHeroById(h.definitionId);
                return def ? (
                  <option key={h.definitionId} value={h.definitionId}>
                    {def.name} (T{h.tier} Lv{h.level})
                  </option>
                ) : null;
              })}
            </select>
          </div>
        )}

        {/* Main Content Grid */}
        <div class={`${styles.mainContent} ${compareMode && compareHeroDef ? styles.compareLayout : ''}`}>
          {/* Left Column - Hero Identity */}
          <div class={styles.leftColumn}>
            <HeroIdentityCard
              heroDefinition={heroDef}
              currentTier={hero.tier}
              level={hero.level}
              weaknesses={heroDef.weaknesses}
              power={heroPowerBreakdown.totalPower}
            />
          </div>
          
          {/* Compare Column - Only shown in compare mode with selected hero */}
          {compareMode && compareHero && compareHeroDef && compareStats && (
            <div class={styles.compareColumn}>
              <div class={styles.compareLabel}>{t('heroDetails.vsLabel')}</div>
              <HeroIdentityCard
                heroDefinition={compareHeroDef}
                currentTier={compareHero.tier}
                level={compareHero.level}
                weaknesses={compareHeroDef.weaknesses}
                power={compareStats.power}
              />
            </div>
          )}

          {/* Right Column - Stats, Skills, Tier Upgrade */}
          <div class={styles.rightColumn}>
            {/* Stats Section */}
            <div class={styles.section} data-tutorial="hero-stat-upgrades">
              <h4 class={styles.sectionTitle}>{t('heroDetails.stats')}</h4>
              <div class={styles.statList}>
                {/* HP with upgrade */}
                {hpConfig && (
                  <HeroStatRow
                    icon={STAT_ICONS.hp}
                    label={t('heroDetails.statsShort.hp')}
                    value={upgradedHp}
                    upgradeLevel={hpLevel}
                    maxLevel={hpConfig.maxLevel}
                    bonusPercent={getStatBonusPercent(hpConfig, hpLevel).toFixed(1)}
                    upgradeCost={getUpgradeCost(hpConfig, hpLevel)}
                    canAfford={gold >= getUpgradeCost(hpConfig, hpLevel)}
                    onUpgrade={() => handleStatUpgrade('hp')}
                    isLoading={loadingStat === 'hp'}
                    nextValue={nextUpgradedHp}
                    compareValue={compareStats?.hp}
                  />
                )}
                {/* Damage with upgrade */}
                {dmgConfig && (
                  <HeroStatRow
                    icon={STAT_ICONS.damage}
                    label={t('heroDetails.statsShort.damage')}
                    value={upgradedDamage}
                    upgradeLevel={dmgLevel}
                    maxLevel={dmgConfig.maxLevel}
                    bonusPercent={getStatBonusPercent(dmgConfig, dmgLevel).toFixed(1)}
                    upgradeCost={getUpgradeCost(dmgConfig, dmgLevel)}
                    canAfford={gold >= getUpgradeCost(dmgConfig, dmgLevel)}
                    onUpgrade={() => handleStatUpgrade('damage')}
                    isLoading={loadingStat === 'damage'}
                    nextValue={nextUpgradedDamage}
                    compareValue={compareStats?.damage}
                  />
                )}
                {/* Attack Speed (no upgrade) */}
                <HeroStatRow
                  icon="⚡"
                  label={t('heroDetails.statsShort.attackSpeed')}
                  value={upgradedAttackSpeed.toFixed(2)}
                  compareValue={compareStats?.attackSpeed}
                />
              </div>
              {/* XP Progress */}
              <div class={styles.xpRow}>
                <span class={styles.xpLabel}>✨ {t('resources.xp')}</span>
                <div class={styles.xpBarContainer}>
                  <div class={styles.xpBar} style={{ width: `${xpProgress}%` }} />
                </div>
                <span class={styles.xpValue}>{hero.xp}/{xpForNextLevel}</span>
              </div>
            </div>
            
            {/* Synergies Section */}
            <SynergySection heroDefinition={heroDef} />

            {/* Equipment Section */}
            <div class={styles.equipmentSection}>
              <h4 class={styles.sectionTitle}>{t('heroDetails.equipment')}</h4>
              {equippedArtifact ? (
                <div class={`${styles.artifactCard} ${styles[equippedArtifact.definition.rarity]}`}>
                  <span class={styles.artifactIcon}>
                    {SLOT_ICONS[equippedArtifact.definition.slot] || '📦'}
                  </span>
                  <div class={styles.artifactInfo}>
                    <span class={styles.artifactName}>
                      {getArtifactName(
                        equippedArtifact.definition.id,
                        equippedArtifact.definition.name,
                        equippedArtifact.definition.polishName
                      )}
                    </span>
                    <span class={styles.artifactSlot}>
                      {t(`heroDetails.artifactSlots.${equippedArtifact.definition.slot}`)}
                    </span>
                    <div class={styles.artifactEffects}>
                      {equippedArtifact.definition.effects.slice(0, 2).map((effect, idx) => (
                        <span key={idx} class={styles.effectTag}>
                          {t(`data:artifacts.${equippedArtifact.definition.id}.effects.${idx}`, {
                            defaultValue: effect.description,
                          })}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span class={styles.rarityBadge}>{t(`rarity.${equippedArtifact.definition.rarity}`)}</span>
                  <div class={styles.artifactActions}>
                    <button
                      class={styles.unequipBtn}
                      onClick={handleUnequipArtifact}
                      disabled={equipmentLoading}
                    >
                      {equipmentLoading ? '...' : t('heroDetails.unequip')}
                    </button>
                  </div>
                </div>
              ) : (
                <div class={styles.emptySlot}>
                  <span class={styles.emptySlotIcon}>📦</span>
                  <span class={styles.emptySlotText}>{t('heroDetails.noArtifact')}</span>
                  <button
                    class={styles.equipBtn}
                    onClick={() => setShowArtifactPicker(true)}
                    disabled={availableArtifacts.length === 0}
                  >
                    {availableArtifacts.length === 0 ? t('heroDetails.none') : t('heroDetails.equip')}
                  </button>
                </div>
              )}
            </div>

            {/* Skills Section */}
            <div class={styles.section}>
              <h4 class={styles.sectionTitle}>{t('heroDetails.skillsTier', { tier: hero.tier })}</h4>
              <div class={styles.skillsList}>
                {currentTierDef.skills.map(skill => (
                  <SkillCard key={skill.id} skill={skill} />
                ))}
              </div>
            </div>

            {/* Tier Upgrade Section */}
            <UpgradeSection
              currentTier={hero.tier}
              playerGold={gold}
              playerDust={dust}
              onUpgrade={handleUpgrade}
              onPreview={hero.tier < 3 ? () => setShowTierPreview(true) : undefined}
            />
          </div>
        </div>
      </div>

      {/* Tier Preview Modal */}
      {(() => {
        if (!showTierPreview || hero.tier >= 3) return null;
        const nextTierIndex = hero.tier; // tier 1 -> index 1, tier 2 -> index 2
        const nextTierDef = heroDef.tiers[nextTierIndex as 1 | 2];
        if (!nextTierDef) return null;
        return (
          <TierPreviewModal
            visible={showTierPreview}
            heroDefinition={heroDef}
            currentTier={hero.tier as 1 | 2}
            nextTier={nextTierDef}
            heroLevel={hero.level}
            playerGold={gold}
            playerDust={dust}
            onClose={() => setShowTierPreview(false)}
            onUpgrade={() => {
              handleUpgrade();
              setShowTierPreview(false);
            }}
          />
        );
      })()}

      {/* Artifact Picker Modal */}
      <ArtifactPickerModal
        visible={showArtifactPicker}
        heroId={hero.definitionId}
        heroTier={hero.tier}
        onClose={() => setShowArtifactPicker(false)}
        onEquip={handleEquipArtifact}
      />
    </Modal>
  );
}
