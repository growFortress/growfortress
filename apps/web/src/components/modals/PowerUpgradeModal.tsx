/**
 * Power Upgrade Modal
 *
 * Modal for managing power upgrades across all categories:
 * - Fortress stats
 * - Hero stats (per hero)
 * - Turret stats (per turret type)
 * - Item tiers
 */

import { useState } from 'preact/hooks';
import {
  FORTRESS_STAT_UPGRADES,
  HERO_STAT_UPGRADES,
  TURRET_STAT_UPGRADES,
  ITEM_TIER_CONFIG,
  getUpgradeCost,
  getStatBonusPercent,
  getNextItemTier,
  isMaxItemTier,
  HEROES,
  TURRET_DEFINITIONS,
  calculateHeroPower,
  type StatUpgradeConfig,
  type StatUpgrades,
} from '@arcade/sim-core';
import type { PowerItemTier, PowerStatUpgrades } from '@arcade/protocol';
import {
  powerState,
  showPowerUpgradeModal,
  activeUpgradeCategory,
  selectedEntityId,
  closePowerUpgradeModal,
  updateFortressStatLevel,
  updateHeroStatLevel,
  updateTurretStatLevel,
  updateItemTier,
  updateTotalPower,
  type UpgradeCategory,
} from '../../state/power.signals.js';
import { displayGold, baseGold } from '../../state/index.js';
import { Modal } from '../shared/Modal.js';
import { Button } from '../shared/Button.js';
import styles from './PowerUpgradeModal.module.css';

// API functions
async function upgradeFortressStat(stat: string): Promise<{
  success: boolean;
  newLevel?: number;
  goldSpent?: number;
  newGold?: number;
  newTotalPower?: number;
  error?: string;
}> {
  const response = await fetch('/api/v1/power/fortress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stat }),
    credentials: 'include',
  });
  return response.json();
}

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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ heroId, stat }),
    credentials: 'include',
  });
  return response.json();
}

async function upgradeTurretStat(turretType: string, stat: string): Promise<{
  success: boolean;
  newLevel?: number;
  goldSpent?: number;
  newGold?: number;
  newTotalPower?: number;
  error?: string;
}> {
  const response = await fetch('/api/v1/power/turret', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ turretType, stat }),
    credentials: 'include',
  });
  return response.json();
}

async function upgradeItem(itemId: string): Promise<{
  success: boolean;
  newTier?: PowerItemTier;
  goldSpent?: number;
  newGold?: number;
  newTotalPower?: number;
  error?: string;
}> {
  const response = await fetch('/api/v1/power/item', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemId }),
    credentials: 'include',
  });
  return response.json();
}

// Category tab data
const CATEGORY_TABS: { id: UpgradeCategory; label: string; icon: string }[] = [
  { id: 'fortress', label: 'Twierdza', icon: '🏰' },
  { id: 'hero', label: 'Bohaterowie', icon: '👤' },
  { id: 'turret', label: 'Wiezyczki', icon: '🗼' },
  { id: 'items', label: 'Przedmioty', icon: '💎' },
];

// Stat icons
const STAT_ICONS: Record<string, string> = {
  hp: '❤️',
  damage: '⚔️',
  attackSpeed: '⚡',
  range: '🎯',
  critChance: '💥',
  critMultiplier: '💀',
  armor: '🛡️',
  dodge: '💨',
};

interface StatUpgradeRowProps {
  config: StatUpgradeConfig;
  currentLevel: number;
  gold: number;
  onUpgrade: () => Promise<void>;
  isLoading: boolean;
}

function StatUpgradeRow({ config, currentLevel, gold, onUpgrade, isLoading }: StatUpgradeRowProps) {
  const cost = getUpgradeCost(config, currentLevel);
  const canAfford = gold >= cost && currentLevel < config.maxLevel;
  const isMaxed = currentLevel >= config.maxLevel;
  const bonusPercent = getStatBonusPercent(config, currentLevel).toFixed(1);
  const nextBonusPercent = getStatBonusPercent(config, currentLevel + 1).toFixed(1);

  return (
    <div class={styles.statRow}>
      <div class={styles.statInfo}>
        <span class={styles.statIcon}>{STAT_ICONS[config.stat] || '📊'}</span>
        <div class={styles.statDetails}>
          <span class={styles.statName}>{config.name}</span>
          <span class={styles.statDesc}>{config.description}</span>
        </div>
      </div>

      <div class={styles.statProgress}>
        <span class={styles.statLevel}>Lv. {currentLevel}/{config.maxLevel}</span>
        <span class={styles.statBonus}>+{bonusPercent}%</span>
        {!isMaxed && (
          <span class={styles.statNext}>→ +{nextBonusPercent}%</span>
        )}
      </div>

      <div class={styles.statAction}>
        {isMaxed ? (
          <span class={styles.maxLabel}>MAX</span>
        ) : (
          <Button
            variant="primary"
            disabled={!canAfford || isLoading}
            onClick={onUpgrade}
          >
            {isLoading ? '...' : `${cost} 💰`}
          </Button>
        )}
      </div>
    </div>
  );
}

// Fortress Panel
function FortressPanel() {
  const state = powerState.value;
  const gold = displayGold.value;
  const [loadingStat, setLoadingStat] = useState<string | null>(null);

  const handleUpgrade = async (stat: string) => {
    setLoadingStat(stat);
    try {
      const result = await upgradeFortressStat(stat);
      if (result.success && result.newLevel !== undefined) {
        updateFortressStatLevel(stat as keyof PowerStatUpgrades, result.newLevel);
        if (result.newGold !== undefined) baseGold.value = result.newGold;
        if (result.newTotalPower !== undefined) updateTotalPower(result.newTotalPower);
      }
    } finally {
      setLoadingStat(null);
    }
  };

  return (
    <div class={styles.panel}>
      <div class={styles.panelHeader}>
        <span class={styles.panelIcon}>🏰</span>
        <div>
          <h3 class={styles.panelTitle}>Ulepszenia Twierdzy</h3>
          <p class={styles.panelDesc}>Globalnie wzmacniaja cala twierdzę</p>
        </div>
      </div>

      <div class={styles.statList}>
        {FORTRESS_STAT_UPGRADES.map(config => (
          <StatUpgradeRow
            key={config.stat}
            config={config}
            currentLevel={state.fortressUpgrades[config.stat as keyof PowerStatUpgrades] || 0}
            gold={gold}
            onUpgrade={() => handleUpgrade(config.stat)}
            isLoading={loadingStat === config.stat}
          />
        ))}
      </div>
    </div>
  );
}

// Helper to convert PowerStatUpgrades to StatUpgrades
function toStatUpgrades(upgrades: PowerStatUpgrades | undefined): StatUpgrades {
  if (!upgrades) {
    return { hp: 0, damage: 0, attackSpeed: 0, range: 0, critChance: 0, critMultiplier: 0, armor: 0, dodge: 0 };
  }
  return {
    hp: upgrades.hp || 0,
    damage: upgrades.damage || 0,
    attackSpeed: upgrades.attackSpeed || 0,
    range: upgrades.range || 0,
    critChance: upgrades.critChance || 0,
    critMultiplier: upgrades.critMultiplier || 0,
    armor: upgrades.armor || 0,
    dodge: upgrades.dodge || 0,
  };
}

// Hero Panel
function HeroPanel() {
  const state = powerState.value;
  const gold = displayGold.value;
  const entityId = selectedEntityId.value;
  const [loadingStat, setLoadingStat] = useState<string | null>(null);

  // Get list of heroes with any upgrades + all available heroes
  const heroIds = new Set([
    ...state.heroUpgrades.map(h => h.heroId),
    ...HEROES.map(h => h.id),
  ]);

  const handleSelectHero = (heroId: string) => {
    selectedEntityId.value = heroId;
  };

  const handleUpgrade = async (stat: string) => {
    if (!entityId) return;
    setLoadingStat(stat);
    try {
      const result = await upgradeHeroStat(entityId, stat);
      if (result.success && result.newLevel !== undefined) {
        updateHeroStatLevel(entityId, stat as keyof PowerStatUpgrades, result.newLevel);
        if (result.newGold !== undefined) baseGold.value = result.newGold;
        if (result.newTotalPower !== undefined) updateTotalPower(result.newTotalPower);
      }
    } finally {
      setLoadingStat(null);
    }
  };

  const selectedHero = HEROES.find(h => h.id === entityId);
  const heroUpgrades = state.heroUpgrades.find(h => h.heroId === entityId);

  // Calculate hero power for display
  const getHeroPower = (heroId: string) => {
    const upgrades = state.heroUpgrades.find(h => h.heroId === heroId);
    const statUpgrades = toStatUpgrades(upgrades?.statUpgrades);
    // Assume tier 1 for base power calculation (actual tier would come from player data)
    return calculateHeroPower(heroId, statUpgrades, 1);
  };

  // Get selected hero power breakdown
  const selectedHeroPower = entityId ? getHeroPower(entityId) : null;

  return (
    <div class={styles.panel}>
      <div class={styles.panelHeader}>
        <span class={styles.panelIcon}>👤</span>
        <div>
          <h3 class={styles.panelTitle}>Ulepszenia Bohaterów</h3>
          <p class={styles.panelDesc}>Wybierz bohatera do ulepszenia</p>
        </div>
      </div>

      {/* Hero selector with power display */}
      <div class={styles.entitySelector}>
        {Array.from(heroIds).map(heroId => {
          const hero = HEROES.find(h => h.id === heroId);
          if (!hero) return null;
          const isSelected = entityId === heroId;
          const heroPower = getHeroPower(heroId);
          return (
            <button
              key={heroId}
              class={`${styles.entityButton} ${isSelected ? styles.selected : ''}`}
              onClick={() => handleSelectHero(heroId)}
            >
              <span class={styles.entityIcon}>{hero.name.charAt(0)}</span>
              <span class={styles.entityName}>{hero.name}</span>
              <span class={styles.entityPower}>⚡ {heroPower.totalPower}</span>
            </button>
          );
        })}
      </div>

      {/* Power breakdown for selected hero */}
      {selectedHero && selectedHeroPower && (
        <div class={styles.powerBreakdown}>
          <div class={styles.powerTotal}>
            <span class={styles.powerLabel}>Power</span>
            <span class={styles.powerValue}>⚡ {selectedHeroPower.totalPower}</span>
          </div>
          <div class={styles.powerDetails}>
            <span>Baza: {selectedHeroPower.basePower}</span>
            <span>Ulepszenia: x{selectedHeroPower.upgradeMultiplier.toFixed(2)}</span>
            <span>Tier: x{selectedHeroPower.tierMultiplier.toFixed(1)}</span>
          </div>
        </div>
      )}

      {/* Stats for selected hero */}
      {selectedHero && (
        <div class={styles.statList}>
          {HERO_STAT_UPGRADES.map(config => (
            <StatUpgradeRow
              key={config.stat}
              config={config}
              currentLevel={heroUpgrades?.statUpgrades[config.stat as keyof PowerStatUpgrades] || 0}
              gold={gold}
              onUpgrade={() => handleUpgrade(config.stat)}
              isLoading={loadingStat === config.stat}
            />
          ))}
        </div>
      )}

      {!selectedHero && (
        <div class={styles.emptyState}>
          Wybierz bohatera, aby zobaczyc ulepszenia
        </div>
      )}
    </div>
  );
}

// Turret Panel
function TurretPanel() {
  const state = powerState.value;
  const gold = displayGold.value;
  const entityId = selectedEntityId.value;
  const [loadingStat, setLoadingStat] = useState<string | null>(null);

  // Get list of turret types
  const turretTypes = TURRET_DEFINITIONS.map(t => t.id);

  const handleSelectTurret = (turretType: string) => {
    selectedEntityId.value = turretType;
  };

  const handleUpgrade = async (stat: string) => {
    if (!entityId) return;
    setLoadingStat(stat);
    try {
      const result = await upgradeTurretStat(entityId, stat);
      if (result.success && result.newLevel !== undefined) {
        updateTurretStatLevel(entityId, stat as keyof PowerStatUpgrades, result.newLevel);
        if (result.newGold !== undefined) baseGold.value = result.newGold;
        if (result.newTotalPower !== undefined) updateTotalPower(result.newTotalPower);
      }
    } finally {
      setLoadingStat(null);
    }
  };

  const selectedTurret = TURRET_DEFINITIONS.find(t => t.id === entityId);
  const turretUpgrades = state.turretUpgrades.find(t => t.turretType === entityId);

  const TURRET_NAMES: Record<string, string> = {
    arrow: 'Wieza Strzal',
    cannon: 'Wieza Armatnia',
    sniper: 'Wieza Snajpera',
    tesla: 'Wieza Tesli',
    frost: 'Wieza Mrozu',
    flame: 'Wieza Plomieni',
    support: 'Wieza Wsparcia',
    poison: 'Wieza Trucizny',
  };

  const TURRET_ICONS: Record<string, string> = {
    arrow: '🏹',
    cannon: '💣',
    sniper: '🎯',
    tesla: '⚡',
    frost: '❄️',
    flame: '🔥',
    support: '✨',
    poison: '☠️',
  };

  return (
    <div class={styles.panel}>
      <div class={styles.panelHeader}>
        <span class={styles.panelIcon}>🗼</span>
        <div>
          <h3 class={styles.panelTitle}>Ulepszenia Wiezyczek</h3>
          <p class={styles.panelDesc}>Wybierz typ wiezyczki do ulepszenia</p>
        </div>
      </div>

      {/* Turret selector */}
      <div class={styles.entitySelector}>
        {turretTypes.map(turretType => {
          const isSelected = entityId === turretType;
          return (
            <button
              key={turretType}
              class={`${styles.entityButton} ${isSelected ? styles.selected : ''}`}
              onClick={() => handleSelectTurret(turretType)}
            >
              <span class={styles.entityIcon}>{TURRET_ICONS[turretType] || '🗼'}</span>
              <span class={styles.entityName}>{TURRET_NAMES[turretType] || turretType}</span>
            </button>
          );
        })}
      </div>

      {/* Stats for selected turret */}
      {selectedTurret && (
        <div class={styles.statList}>
          {TURRET_STAT_UPGRADES.map(config => (
            <StatUpgradeRow
              key={config.stat}
              config={config}
              currentLevel={turretUpgrades?.statUpgrades[config.stat as keyof PowerStatUpgrades] || 0}
              gold={gold}
              onUpgrade={() => handleUpgrade(config.stat)}
              isLoading={loadingStat === config.stat}
            />
          ))}
        </div>
      )}

      {!selectedTurret && (
        <div class={styles.emptyState}>
          Wybierz wiezyczke, aby zobaczyc ulepszenia
        </div>
      )}
    </div>
  );
}

// Items Panel
function ItemsPanel() {
  const state = powerState.value;
  const gold = displayGold.value;
  const [loadingItem, setLoadingItem] = useState<string | null>(null);

  // For now, show items that have been added to power data
  // In a full implementation, this would show all available items
  const items = state.itemTiers;

  const handleUpgrade = async (itemId: string) => {
    setLoadingItem(itemId);
    try {
      const result = await upgradeItem(itemId);
      if (result.success && result.newTier) {
        updateItemTier(itemId, result.newTier);
        if (result.newGold !== undefined) baseGold.value = result.newGold;
        if (result.newTotalPower !== undefined) updateTotalPower(result.newTotalPower);
      }
    } finally {
      setLoadingItem(null);
    }
  };

  const getTierColor = (tier: PowerItemTier): string => {
    const colorHex = ITEM_TIER_CONFIG[tier].color.toString(16).padStart(6, '0');
    return `#${colorHex}`;
  };

  return (
    <div class={styles.panel}>
      <div class={styles.panelHeader}>
        <span class={styles.panelIcon}>💎</span>
        <div>
          <h3 class={styles.panelTitle}>Ulepszenia Przedmiotów</h3>
          <p class={styles.panelDesc}>Ulepszaj tiery przedmiotów</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div class={styles.emptyState}>
          Brak przedmiotów do ulepszenia. Przedmioty pojawia sie gdy je zdobedziesz w grze.
        </div>
      ) : (
        <div class={styles.itemList}>
          {items.map(item => {
            const tierConfig = ITEM_TIER_CONFIG[item.tier];
            const nextTier = getNextItemTier(item.tier);
            const isMaxed = isMaxItemTier(item.tier);
            const cost = tierConfig.upgradeCost;
            const canAfford = cost !== null && gold >= cost;

            return (
              <div key={item.itemId} class={styles.itemRow}>
                <div class={styles.itemInfo}>
                  <span class={styles.itemName}>{item.itemId}</span>
                  <span
                    class={styles.itemTier}
                    style={{ color: getTierColor(item.tier) }}
                  >
                    {tierConfig.name}
                  </span>
                </div>

                <div class={styles.itemBonus}>
                  <span>x{tierConfig.effectMultiplier.toFixed(2)}</span>
                  {nextTier && (
                    <span class={styles.itemNext}>
                      → x{ITEM_TIER_CONFIG[nextTier].effectMultiplier.toFixed(2)}
                    </span>
                  )}
                </div>

                <div class={styles.itemAction}>
                  {isMaxed ? (
                    <span class={styles.maxLabel}>MAX</span>
                  ) : (
                    <Button
                      variant="primary"
                      disabled={!canAfford || loadingItem === item.itemId}
                      onClick={() => handleUpgrade(item.itemId)}
                    >
                      {loadingItem === item.itemId ? '...' : `${cost} 💰`}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function PowerUpgradeModal() {
  const visible = showPowerUpgradeModal.value;
  const category = activeUpgradeCategory.value;
  const state = powerState.value;
  const gold = displayGold.value;

  const handleClose = () => {
    closePowerUpgradeModal();
  };

  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const handleCategoryChange = (newCategory: UpgradeCategory) => {
    activeUpgradeCategory.value = newCategory;
    selectedEntityId.value = null;
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} class={styles.powerModal} onClick={handleBackdropClick}>
      <div class={styles.modalContent}>
        {/* Header */}
        <div class={styles.modalHeader}>
          <div class={styles.headerLeft}>
            <span class={styles.powerIcon}>⚡</span>
            <div>
              <h2 class={styles.modalTitle}>Power Upgrades</h2>
              <span class={styles.totalPower}>
                Moc: {state.totalPower.toLocaleString()}
              </span>
            </div>
          </div>

          <div class={styles.headerRight}>
            <span class={styles.goldDisplay}>💰 {gold.toLocaleString()}</span>
            <button class={styles.closeButton} onClick={handleClose}>×</button>
          </div>
        </div>

        {/* Category tabs */}
        <div class={styles.categoryTabs}>
          {CATEGORY_TABS.map(tab => (
            <button
              key={tab.id}
              class={`${styles.categoryTab} ${category === tab.id ? styles.active : ''}`}
              onClick={() => handleCategoryChange(tab.id)}
            >
              <span class={styles.tabIcon}>{tab.icon}</span>
              <span class={styles.tabLabel}>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div class={styles.modalBody}>
          {category === 'fortress' && <FortressPanel />}
          {category === 'hero' && <HeroPanel />}
          {category === 'turret' && <TurretPanel />}
          {category === 'items' && <ItemsPanel />}
        </div>
      </div>
    </Modal>
  );
}
