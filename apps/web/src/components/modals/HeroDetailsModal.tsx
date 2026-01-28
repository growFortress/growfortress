import type { JSX, ComponentChildren } from 'preact';
import type { FortressClass, HeroDefinition, ActiveHero } from '@arcade/sim-core';
import { useState } from 'preact/hooks';
import { useTranslation } from '../../i18n/useTranslation.js';
import { DamageIcon, SpeedIcon, RangeIcon, CritChanceIcon } from '../icons/index.js';
import { Tooltip } from '../shared/Tooltip.js';
import {
  getHeroById,
  calculateHeroStats,
  calculateHeroPower,
  createDefaultStatUpgrades,
  HERO_STAT_UPGRADES,
  getHeroUpgradeCost,
  getStatBonusPercent,
  getStatMultiplier,
  ARTIFACT_DEFINITIONS,
  applyArtifactBonusesToStats,
  FP,
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
  WorksWithSection,
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

// Stat icon components
function getStatIcon(statType?: 'damage' | 'attackSpeed' | 'range' | 'critChance', size: number = 24) {
  switch (statType) {
    case 'damage':
      return <DamageIcon size={size} />;
    case 'attackSpeed':
      return <SpeedIcon size={size} />;
    case 'range':
      return <RangeIcon size={size} />;
    case 'critChance':
      return <CritChanceIcon size={size} />;
    default:
      return null;
  }
}

// Inline stat row component
interface HeroStatRowProps {
  icon?: string | ComponentChildren;
  label: string;
  value: string | number;
  upgradeLevel?: number;
  unlimitedUpgrade?: boolean; // No max level
  bonusPercent?: string;
  upgradeCost?: number;
  canAfford?: boolean;
  onUpgrade?: () => void;
  isLoading?: boolean;
  nextValue?: number; // Value after next upgrade
  compareValue?: number; // Value from comparison hero
  statType?: 'damage' | 'attackSpeed' | 'range' | 'critChance'; // For color variants
}

function HeroStatRow({
  icon,
  label: _label,
  value,
  upgradeLevel,
  unlimitedUpgrade,
  bonusPercent: _bonusPercent,
  upgradeCost,
  canAfford,
  onUpgrade,
  isLoading,
  nextValue: _nextValue,
  compareValue: _compareValue,
  statType,
}: HeroStatRowProps) {
  const { t } = useTranslation('common');
  const hasUpgrade = upgradeLevel !== undefined && (unlimitedUpgrade || onUpgrade);

  // For unlimited upgrades, show progress based on level (soft cap at 50 for visual)
  const progressPercent = hasUpgrade && upgradeLevel !== undefined
    ? Math.min((upgradeLevel / 50) * 100, 100)
    : 50;

  const statTypeClass = statType ? styles[`stat_${statType}`] : '';

  // Use SVG icon if statType is provided, otherwise use provided icon
  const iconElement = statType ? getStatIcon(statType, 24) : (typeof icon === 'string' ? icon : icon);

  // Get tooltip content for the stat type
  const tooltipContent = statType ? t(`heroDetails.statsDescriptions.${statType}`) : null;

  return (
    <div class={`${styles.statRow} ${statTypeClass}`}>
      {tooltipContent ? (
        <Tooltip
          content={tooltipContent}
          position="right"
          size="sm"
          title={t(`heroDetails.statsShort.${statType}`)}
        >
          <span class={styles.statIcon}>{iconElement}</span>
        </Tooltip>
      ) : (
        <span class={styles.statIcon}>{iconElement}</span>
      )}
      <div class={styles.statBarContainer}>
        <div
          class={styles.statBarFill}
          style={{ width: `${progressPercent}%` }}
        />
        <span class={styles.statBarValue}>{value}</span>
      </div>
      {hasUpgrade && onUpgrade && (
        <button
          class={styles.statUpgradeBtn}
          disabled={!canAfford || isLoading}
          onClick={onUpgrade}
          title={`${upgradeCost} gold`}
        >
          {isLoading ? '...' : '+'}
        </button>
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
  const [detailsExpanded, setDetailsExpanded] = useState(false);

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

  // Get upgrade configs for all 4 hero stats: damage, attackSpeed, range, critChance
  const dmgConfig = HERO_STAT_UPGRADES.find(c => c.stat === 'damage');
  const asConfig = HERO_STAT_UPGRADES.find(c => c.stat === 'attackSpeed');
  const rangeConfig = HERO_STAT_UPGRADES.find(c => c.stat === 'range');
  const critConfig = HERO_STAT_UPGRADES.find(c => c.stat === 'critChance');

  const dmgLevel = heroUpgrades?.statUpgrades.damage || 0;
  const asLevel = heroUpgrades?.statUpgrades.attackSpeed || 0;
  const rangeLevel = heroUpgrades?.statUpgrades.range || 0;
  const critLevel = heroUpgrades?.statUpgrades.critChance || 0;

  // Calculate upgraded stats (base stats * upgrade multiplier * guild bonus)
  const dmgMultiplier = dmgConfig ? getStatMultiplier(dmgConfig, dmgLevel) : 1;
  const asMultiplier = asConfig ? getStatMultiplier(asConfig, asLevel) : 1;
  const rangeMultiplier = rangeConfig ? getStatMultiplier(rangeConfig, rangeLevel) : 1;
  const critBonus = critConfig ? critLevel * critConfig.bonusPerLevel : 0;

  const guildStatBoost = 1 + (guildBonuses.value?.statBoost ?? 0);
  const upgradedDamage = Math.floor(currentStats.damage * dmgMultiplier * guildStatBoost);
  const upgradedAttackSpeed = currentStats.attackSpeed * asMultiplier * guildStatBoost;
  const upgradedRange = FP.toFloat(currentStats.range) * rangeMultiplier;
  const upgradedCritChance = Math.min(critBonus * 100, 75); // Cap at 75%, display as %

  // Calculate "next" values (what stats will be after upgrade)
  const nextDmgMultiplier = dmgConfig ? getStatMultiplier(dmgConfig, dmgLevel + 1) : 1;
  const nextAsMultiplier = asConfig ? getStatMultiplier(asConfig, asLevel + 1) : 1;
  const nextRangeMultiplier = rangeConfig ? getStatMultiplier(rangeConfig, rangeLevel + 1) : 1;
  const nextCritBonus = critConfig ? (critLevel + 1) * critConfig.bonusPerLevel : 0;

  const nextUpgradedDamage = Math.floor(currentStats.damage * nextDmgMultiplier * guildStatBoost);
  const nextUpgradedAttackSpeed = currentStats.attackSpeed * nextAsMultiplier * guildStatBoost;
  const nextUpgradedRange = FP.toFloat(currentStats.range) * nextRangeMultiplier;
  const nextUpgradedCritChance = Math.min(nextCritBonus * 100, 75);

  // Comparison hero data
  const otherHeroes = heroes.filter(h => h.definitionId !== hero.definitionId);
  const compareHero = compareHeroId ? heroes.find(h => h.definitionId === compareHeroId) : null;
  const compareHeroDef = compareHero ? getHeroById(compareHero.definitionId) : null;

  // Calculate compare hero stats if in compare mode
  let compareStats: { damage: number; attackSpeed: number; range: number; critChance: number; power: number } | null = null;
  if (compareMode && compareHero && compareHeroDef) {
    const compareEquippedArtifact = getArtifactForHero(compareHero.definitionId);
    const compareBaseStats = calculateHeroStats(compareHeroDef, compareHero.tier, compareHero.level);
    const compareCurrentStats = applyArtifactBonusesToStats(compareBaseStats, compareEquippedArtifact?.artifactId);
    const compareHeroUpgrades = powerState.value.heroUpgrades.find(h => h.heroId === compareHero.definitionId);
    const compareDmgLevel = compareHeroUpgrades?.statUpgrades.damage || 0;
    const compareAsLevel = compareHeroUpgrades?.statUpgrades.attackSpeed || 0;
    const compareRangeLevel = compareHeroUpgrades?.statUpgrades.range || 0;
    const compareCritLevel = compareHeroUpgrades?.statUpgrades.critChance || 0;
    const compareDmgMultiplier = dmgConfig ? getStatMultiplier(dmgConfig, compareDmgLevel) : 1;
    const compareAsMultiplier = asConfig ? getStatMultiplier(asConfig, compareAsLevel) : 1;
    const compareRangeMultiplier = rangeConfig ? getStatMultiplier(rangeConfig, compareRangeLevel) : 1;
    const compareCritBonus = critConfig ? compareCritLevel * critConfig.bonusPerLevel : 0;

    const comparePower = calculateHeroPower(
      compareHero.definitionId,
      compareHeroUpgrades?.statUpgrades || createDefaultStatUpgrades(),
      compareHero.tier,
      compareEquippedArtifact?.artifactId
    );

    compareStats = {
      damage: Math.floor(compareCurrentStats.damage * compareDmgMultiplier * guildStatBoost),
      attackSpeed: compareCurrentStats.attackSpeed * compareAsMultiplier * guildStatBoost,
      range: FP.toFloat(compareCurrentStats.range) * compareRangeMultiplier,
      critChance: Math.min(compareCritBonus * 100, 75),
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
                {/* Damage with upgrade */}
                {dmgConfig && (
                  <HeroStatRow
                    statType="damage"
                    label={t('heroDetails.statsShort.damage')}
                    value={upgradedDamage}
                    upgradeLevel={dmgLevel}
                    unlimitedUpgrade
                    bonusPercent={getStatBonusPercent(dmgConfig, dmgLevel).toFixed(1)}
                    upgradeCost={getHeroUpgradeCost(dmgConfig, dmgLevel)}
                    canAfford={gold >= getHeroUpgradeCost(dmgConfig, dmgLevel)}
                    onUpgrade={() => handleStatUpgrade('damage')}
                    isLoading={loadingStat === 'damage'}
                    nextValue={nextUpgradedDamage}
                    compareValue={compareStats?.damage}
                  />
                )}
                {/* Attack Speed with upgrade */}
                {asConfig && (
                  <HeroStatRow
                    statType="attackSpeed"
                    label={t('heroDetails.statsShort.attackSpeed')}
                    value={upgradedAttackSpeed.toFixed(2)}
                    upgradeLevel={asLevel}
                    unlimitedUpgrade
                    bonusPercent={getStatBonusPercent(asConfig, asLevel).toFixed(1)}
                    upgradeCost={getHeroUpgradeCost(asConfig, asLevel)}
                    canAfford={gold >= getHeroUpgradeCost(asConfig, asLevel)}
                    onUpgrade={() => handleStatUpgrade('attackSpeed')}
                    isLoading={loadingStat === 'attackSpeed'}
                    nextValue={nextUpgradedAttackSpeed}
                    compareValue={compareStats?.attackSpeed}
                  />
                )}
                {/* Range with upgrade */}
                {rangeConfig && (
                  <HeroStatRow
                    statType="range"
                    label={t('heroDetails.statsShort.range')}
                    value={upgradedRange.toFixed(1)}
                    upgradeLevel={rangeLevel}
                    unlimitedUpgrade
                    bonusPercent={getStatBonusPercent(rangeConfig, rangeLevel).toFixed(1)}
                    upgradeCost={getHeroUpgradeCost(rangeConfig, rangeLevel)}
                    canAfford={gold >= getHeroUpgradeCost(rangeConfig, rangeLevel)}
                    onUpgrade={() => handleStatUpgrade('range')}
                    isLoading={loadingStat === 'range'}
                    nextValue={nextUpgradedRange}
                    compareValue={compareStats?.range}
                  />
                )}
                {/* Crit Chance with upgrade */}
                {critConfig && (
                  <HeroStatRow
                    statType="critChance"
                    label={t('heroDetails.statsShort.critChance')}
                    value={`${upgradedCritChance.toFixed(1)}%`}
                    upgradeLevel={critLevel}
                    unlimitedUpgrade
                    bonusPercent={getStatBonusPercent(critConfig, critLevel).toFixed(1)}
                    upgradeCost={getHeroUpgradeCost(critConfig, critLevel)}
                    canAfford={gold >= getHeroUpgradeCost(critConfig, critLevel)}
                    onUpgrade={() => handleStatUpgrade('critChance')}
                    isLoading={loadingStat === 'critChance'}
                    nextValue={nextUpgradedCritChance}
                    compareValue={compareStats?.critChance}
                  />
                )}
              </div>
              {/* XP Progress */}
              <div class={styles.xpRow}>
                <span class={styles.xpLabel}>✨ {t('resources.xp')}</span>
                <div class={styles.xpBarContainer}>
                  <div class={styles.xpBar} style={{ width: `${xpProgress}%` }} />
                </div>
                <span class={styles.xpValue}>{hero.xp}/{xpForNextLevel}</span>
              </div>

              {/* Collapsible Details Section */}
              <button
                class={styles.detailsToggle}
                onClick={() => setDetailsExpanded(!detailsExpanded)}
              >
                <span class={styles.detailsArrow}>{detailsExpanded ? '▼' : '▶'}</span>
                {t('heroDetails.details')}
              </button>
              {detailsExpanded && (
                <div class={styles.detailsSection}>
                  <div class={styles.detailRow}>
                    <span class={styles.detailLabel}>{t('heroDetails.detailStats.maxHp')}</span>
                    <span class={styles.detailValue}>{currentStats.hp}</span>
                  </div>
                  <div class={styles.detailRow}>
                    <span class={styles.detailLabel}>{t('heroDetails.detailStats.moveSpeed')}</span>
                    <span class={styles.detailValue}>{currentStats.moveSpeed}</span>
                  </div>
                  <div class={styles.detailRow}>
                    <span class={styles.detailLabel}>{t('heroDetails.detailStats.deployCooldown')}</span>
                    <span class={styles.detailValue}>{(heroDef.baseStats.deployCooldown / 30).toFixed(1)}s</span>
                  </div>
                  <div class={styles.detailRow}>
                    <span class={styles.detailLabel}>{t('heroDetails.detailStats.rarity')}</span>
                    <span class={styles.detailValue}>{t(`rarity.${heroDef.rarity}`)}</span>
                  </div>
                  <div class={styles.detailRow}>
                    <span class={styles.detailLabel}>{t('heroDetails.detailStats.role')}</span>
                    <span class={styles.detailValue}>{t(`roles.${heroDef.role === 'crowd_control' ? 'control' : heroDef.role}`)}</span>
                  </div>
                </div>
              )}
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
