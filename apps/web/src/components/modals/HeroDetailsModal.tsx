import type { JSX } from 'preact';
import type { FortressClass } from '@arcade/sim-core';
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
}: HeroStatRowProps) {
  const hasUpgrade = upgradeLevel !== undefined && maxLevel !== undefined;
  const isMaxed = hasUpgrade && upgradeLevel >= maxLevel;

  return (
    <div class={styles.statRow}>
      <span class={styles.statIcon}>{icon}</span>
      <span class={styles.statLabel}>{label}</span>
      <span class={styles.statValue}>{value}</span>
      {hasUpgrade && (
        <>
          <span class={styles.statLevel}>Lv {upgradeLevel}{maxLevel !== Infinity && `/${maxLevel}`}</span>
          {isMaxed ? (
            <span class={styles.maxBadge}>MAX</span>
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
  const { t } = useTranslation('common');
  const target = upgradeTarget.value;
  const visible = upgradePanelVisible.value;
  const gold = displayGold.value;
  const dust = displayDust.value;

  const [loadingStat, setLoadingStat] = useState<string | null>(null);
  const [showTierPreview, setShowTierPreview] = useState(false);
  const [showArtifactPicker, setShowArtifactPicker] = useState(false);
  const [equipmentLoading, setEquipmentLoading] = useState(false);

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

  // Calculate hero power (with equipped artifact)
  const heroPowerBreakdown = calculateHeroPower(
    hero.definitionId,
    heroUpgrades?.statUpgrades || createDefaultStatUpgrades(),
    hero.tier,
    equippedArtifact?.artifactId
  );

  return (
    <Modal visible={visible} size="fullscreen" class={styles.heroDetailsModal} onClick={handleBackdropClick}>
      <div class={styles.heroDetailsPanel} style={{ '--class-color': classColor } as JSX.CSSProperties}>
        {/* Header */}
        <div class={styles.modalHeader}>
          <h2 class={styles.modalTitle}>{t('heroDetails.title')}</h2>
          <button class={styles.closeButton} onClick={handleClose}>×</button>
        </div>

        {/* Main Content Grid */}
        <div class={styles.mainContent}>
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

          {/* Right Column - Stats, Skills, Tier Upgrade */}
          <div class={styles.rightColumn}>
            {/* Stats Section */}
            <div class={styles.section}>
              <h4 class={styles.sectionTitle}>{t('heroDetails.stats')}</h4>
              <div class={styles.statList}>
                {/* HP with upgrade */}
                {hpConfig && (
                  <HeroStatRow
                    icon={STAT_ICONS.hp}
                    label="HP"
                    value={upgradedHp}
                    upgradeLevel={hpLevel}
                    maxLevel={hpConfig.maxLevel}
                    bonusPercent={getStatBonusPercent(hpConfig, hpLevel).toFixed(1)}
                    upgradeCost={getUpgradeCost(hpConfig, hpLevel)}
                    canAfford={gold >= getUpgradeCost(hpConfig, hpLevel)}
                    onUpgrade={() => handleStatUpgrade('hp')}
                    isLoading={loadingStat === 'hp'}
                  />
                )}
                {/* Damage with upgrade */}
                {dmgConfig && (
                  <HeroStatRow
                    icon={STAT_ICONS.damage}
                    label="DMG"
                    value={upgradedDamage}
                    upgradeLevel={dmgLevel}
                    maxLevel={dmgConfig.maxLevel}
                    bonusPercent={getStatBonusPercent(dmgConfig, dmgLevel).toFixed(1)}
                    upgradeCost={getUpgradeCost(dmgConfig, dmgLevel)}
                    canAfford={gold >= getUpgradeCost(dmgConfig, dmgLevel)}
                    onUpgrade={() => handleStatUpgrade('damage')}
                    isLoading={loadingStat === 'damage'}
                  />
                )}
                {/* Attack Speed (no upgrade) */}
                <HeroStatRow
                  icon="⚡"
                  label="AS"
                  value={upgradedAttackSpeed.toFixed(2)}
                />
              </div>
              {/* XP Progress */}
              <div class={styles.xpRow}>
                <span class={styles.xpLabel}>✨ XP</span>
                <div class={styles.xpBarContainer}>
                  <div class={styles.xpBar} style={{ width: `${xpProgress}%` }} />
                </div>
                <span class={styles.xpValue}>{hero.xp}/{xpForNextLevel}</span>
              </div>
            </div>

            {/* Equipment Section */}
            <div class={styles.equipmentSection}>
              <h4 class={styles.sectionTitle}>{t('heroDetails.equipment')}</h4>
              {equippedArtifact ? (
                <div class={`${styles.artifactCard} ${styles[equippedArtifact.definition.rarity]}`}>
                  <span class={styles.artifactIcon}>
                    {SLOT_ICONS[equippedArtifact.definition.slot] || '📦'}
                  </span>
                  <div class={styles.artifactInfo}>
                    <span class={styles.artifactName}>{equippedArtifact.definition.polishName}</span>
                    <span class={styles.artifactSlot}>{equippedArtifact.definition.slot}</span>
                    <div class={styles.artifactEffects}>
                      {equippedArtifact.definition.effects.slice(0, 2).map((effect, idx) => (
                        <span key={idx} class={styles.effectTag}>{effect.description}</span>
                      ))}
                    </div>
                  </div>
                  <span class={styles.rarityBadge}>{equippedArtifact.definition.rarity}</span>
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
              <h4 class={styles.sectionTitle}>{t('heroDetails.skills')} (Tier {hero.tier})</h4>
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
