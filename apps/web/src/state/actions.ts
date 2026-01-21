import { batch } from '@preact/signals';
import type { ProfileResponse, SegmentSubmitResponse } from '@arcade/protocol';
import type { ActiveHero, ActiveTurret } from '@arcade/sim-core';
import {
  getTurretById,
  getRewardsForLevel,
  LEVEL_UP_DUST_REWARD,
  LEVEL_UP_GOLD_REWARD,
} from '@arcade/sim-core';
import type { Game } from '../game/Game.js';
import type { GameStateSnapshot } from './game.signals.js';
import type { LeaderboardEntry, GameEndState } from './ui.signals.js';
import * as profile from './profile.signals.js';
import * as game from './game.signals.js';
import * as ui from './ui.signals.js';
import * as fortress from './fortress.signals.js';
import { addArtifactDrop, resetArtifactsState } from './artifacts.signals.js';
import { resetMaterialsState, updatePlayerMaterials } from './materials.signals.js';
import { resetIdleState } from './idle.signals.js';
import { resetPowerState } from './power.signals.js';
import { resetGuildState } from './guild.signals.js';
import { resetMessagesState } from './messages.signals.js';
import { resetPvpState } from './pvp.signals.js';
import { resetBossRushState } from './boss-rush.signals.js';
import { resetDailyQuestsState } from './dailyQuests.signals.js';
import { resetEnergyState } from './energy.signals.js';
import { resetPillarUnlocksState } from './pillarUnlocks.signals.js';
import { getProfile } from '../api/client.js';
import { GameAnnouncements } from '../components/shared/ScreenReaderAnnouncer.js';
import { setLanguage } from '../i18n/useTranslation.js';

// Track processed artifact drops to avoid duplicates
let lastProcessedArtifactDropTick = -1;
let lastCommanderLevel = 0;

/**
 * Update state from a profile response.
 */
export function updateFromProfile(data: ProfileResponse): void {
  batch(() => {
    profile.baseGold.value = data.inventory.gold;
    profile.baseDust.value = data.inventory.dust;
    profile.currentWave.value = data.currentWave;
    profile.baseLevel.value = data.progression.level;
    profile.baseXp.value = data.progression.xp;
    profile.baseTotalXp.value = data.progression.totalXp;
    profile.baseXpToNextLevel.value = data.progression.xpToNextLevel;

    // Update purchased slots (new slot purchase system)
    if (data.progression.purchasedHeroSlots !== undefined) {
      fortress.purchasedHeroSlots.value = data.progression.purchasedHeroSlots;
      fortress.maxHeroSlots.value = data.progression.purchasedHeroSlots;
    }
    if (data.progression.purchasedTurretSlots !== undefined) {
      fortress.purchasedTurretSlots.value = data.progression.purchasedTurretSlots;
    }
    profile.displayName.value = data.displayName;
    profile.playerDescription.value = data.description || '';
    profile.userRole.value = data.role;
    profile.country.value = data.country ?? null;
    profile.preferredCurrency.value = data.preferredCurrency;

    // Onboarding status
    profile.onboardingCompleted.value = data.onboardingCompleted;
    profile.defaultLoadout.value = {
      fortressClass: data.defaultLoadout.fortressClass as profile.DefaultLoadout['fortressClass'],
      heroId: data.defaultLoadout.heroId,
      turretType: data.defaultLoadout.turretType as profile.DefaultLoadout['turretType'],
    };
    profile.buildPresets.value = data.buildPresets || [];
    profile.activePresetId.value = data.activePresetId ?? null;

    // If onboarding is completed, set the fortress class
    if (data.onboardingCompleted) {
      const activePreset = data.activePresetId
        ? data.buildPresets?.find((preset) => preset.id === data.activePresetId)
        : null;
      if (activePreset?.fortressClass) {
        fortress.selectedFortressClass.value = activePreset.fortressClass as typeof fortress.selectedFortressClass.value;
      } else if (data.defaultLoadout.fortressClass) {
        fortress.selectedFortressClass.value = data.defaultLoadout.fortressClass as typeof fortress.selectedFortressClass.value;
      } else {
        fortress.selectedFortressClass.value = null;
      }
    } else {
      fortress.selectedFortressClass.value = null;
    }

    // Update unlocked heroes and turrets from profile
    fortress.unlockedHeroIds.value = data.unlockedHeroes || [];
    fortress.unlockedTurretIds.value = data.unlockedTurrets || [];

    // Update materials from inventory
    if (data.inventory.materials) {
      updatePlayerMaterials(data.inventory.materials);
    }

    // Update game config from server
    if (data.gameConfig) {
      profile.gameConfig.value = {
        fortressBaseHp: data.gameConfig.fortressBaseHp,
        fortressBaseDamage: data.gameConfig.fortressBaseDamage,
      };
    }
  });

  if (typeof localStorage !== 'undefined') {
    const storedLanguage = localStorage.getItem('gf-language');
    if (!storedLanguage) {
      setLanguage(data.country === 'PL' ? 'pl' : 'en');
    }
  }
}

/**
 * Update state from a segment completion response.
 * Also checks for level-up and queues unlock notifications.
 */
export function updateFromSegment(result: SegmentSubmitResponse): void {
  const previousLevel = profile.baseLevel.value;
  const newLevel = result.newProgression.level;

  batch(() => {
    profile.baseGold.value = result.newInventory.gold;
    profile.baseDust.value = result.newInventory.dust;
    profile.baseLevel.value = result.newProgression.level;
    profile.baseXp.value = result.newProgression.xp;
    profile.baseTotalXp.value = result.newProgression.totalXp;
    profile.baseXpToNextLevel.value = result.newProgression.xpToNextLevel;
  });

  // Check for level-up and queue unlock notifications
  if (newLevel > previousLevel) {
    // Collect all rewards from levels between previous and new
    for (let level = previousLevel + 1; level <= newLevel; level++) {
      const rewards = getRewardsForLevel(level);
      if (rewards.length > 0) {
        ui.queueUnlockNotifications(level, rewards);
      }
    }
  }
}

/**
 * Update state after starting a session with relics.
 */
export function updateFromSessionStart(inventory: { gold: number; dust: number }): void {
  batch(() => {
    profile.baseGold.value = inventory.gold;
    profile.baseDust.value = inventory.dust;
  });
}

/**
 * Sync game state from Game instance.
 */
export function syncGameState(gameInstance: Game): void {
  const state = gameInstance.getState();
  const phase = gameInstance.getPhase();

  const previousCommanderLevel = lastCommanderLevel;

  batch(() => {
    game.gamePhase.value = phase;

    if (state) {
      const snapshot: GameStateSnapshot = {
        tick: state.tick,
        wave: state.wave,
        wavesCleared: state.wavesCleared,
        kills: state.kills,
        eliteKills: state.eliteKills,
        killStreak: state.killStreak,
        goldEarned: state.goldEarned,
        dustEarned: state.dustEarned,
        segmentXpEarned: state.segmentXpEarned,
        waveSpawnedEnemies: state.waveSpawnedEnemies,
        waveTotalEnemies: state.waveTotalEnemies,
        enemyCount: state.enemies.length,
        relics: state.relics,
        skillCooldown: state.skillCooldown,
        ended: state.ended,
        currentPillar: state.currentPillar,
        commanderLevel: state.commanderLevel,
        sessionXpEarned: state.sessionXpEarned,
        xpAtSessionStart: state.xpAtSessionStart,
        // Crystal system (ancient artifacts)
        collectedStones: state.collectedCrystals || [],
        infinityStoneFragments: state.crystalFragments || [],
        gauntletState: state.matrixState || null,
        // Fortress class skills
        fortressActiveSkills: state.activeSkills || [],
        fortressSkillCooldowns: state.skillCooldowns || {},
      };
      game.gameState.value = snapshot;

      if (previousCommanderLevel > 0 && state.commanderLevel > previousCommanderLevel) {
        for (let level = previousCommanderLevel + 1; level <= state.commanderLevel; level++) {
          ui.queueLevelUpNotification(level, LEVEL_UP_GOLD_REWARD, LEVEL_UP_DUST_REWARD);
          GameAnnouncements.levelUp(level);
        }
      }
      lastCommanderLevel = state.commanderLevel;

      // Sync fortress HP
      game.fortressHp.value = state.fortressHp ?? 100;
      game.fortressMaxHp.value = state.fortressMaxHp ?? 100;

      // Sync current pillar
      game.currentPillar.value = state.currentPillar;

      // Sync fortress class and related systems
      if (state.fortressClass) {
        fortress.selectedFortressClass.value = state.fortressClass;
      }

      // Sync heroes
      fortress.activeHeroes.value = state.heroes || [];
      fortress.maxHeroSlots.value = state.heroSlots || 4;

      // Sync turrets
      fortress.activeTurrets.value = state.turrets || [];
      fortress.turretSlots.value = state.turretSlots || [];

      // Process pending artifact drops for UI notifications
      if (state.pendingArtifactDrops && state.pendingArtifactDrops.length > 0) {
        for (const drop of state.pendingArtifactDrops) {
          // Only process drops we haven't seen yet
          if (drop.dropTick > lastProcessedArtifactDropTick) {
            addArtifactDrop(drop.artifactId, drop.isDuplicate, drop.dustValue);
            lastProcessedArtifactDropTick = drop.dropTick;
          }
        }
      }
    } else {
      game.gameState.value = null;
      // Reset tracking when game ends
      lastProcessedArtifactDropTick = -1;
      lastCommanderLevel = 0;
    }
  });
}

/**
 * Show rewards toast.
 */
export function showRewardsToast(gold: number, dust: number, xp: number): void {
  ui.toastMessage.value = { gold, dust, xp };
}

/**
 * Hide rewards toast.
 */
export function hideRewardsToast(): void {
  ui.toastMessage.value = null;
}

/**
 * Show choice modal with options.
 */
export function showChoice(options: string[]): void {
  batch(() => {
    ui.choiceOptions.value = options;
    ui.showChoiceModal.value = true;
  });
}

/**
 * Hide choice modal.
 */
export function hideChoice(): void {
  batch(() => {
    ui.showChoiceModal.value = false;
    ui.choiceOptions.value = [];
  });
}

/**
 * Show end screen.
 */
export function showEndScreenWithStats(won: boolean, stats: GameEndState | null): void {
  batch(() => {
    ui.endScreenWon.value = won;
    ui.endGameStats.value = stats;
    ui.showEndScreen.value = true;
  });
}

/**
 * Hide end screen.
 */
export function hideEndScreen(): void {
  ui.showEndScreen.value = false;
}

/**
 * Update leaderboard entries.
 */
export function updateLeaderboard(entries: LeaderboardEntry[]): void {
  batch(() => {
    ui.leaderboardEntries.value = entries;
    ui.leaderboardLoading.value = false;
    ui.leaderboardError.value = false;
  });
}

/**
 * Set leaderboard error state.
 */
export function setLeaderboardError(): void {
  batch(() => {
    ui.leaderboardLoading.value = false;
    ui.leaderboardError.value = true;
  });
}

/**
 * Reset game state to idle.
 */
export function resetGameState(): void {
  batch(() => {
    game.gamePhase.value = 'idle';
    game.gameState.value = null;

    // Reset fortress state but keep selected class for next game
    fortress.activeHeroes.value = [];
    fortress.activeTurrets.value = [];
    fortress.upgradePanelVisible.value = false;
    fortress.upgradeTarget.value = null;
    fortress.selectedHeroId.value = null;
    fortress.selectedTurretSlot.value = null;

    // Reset turret slots to default configuration
    fortress.turretSlots.value = [...fortress.DEFAULT_TURRET_SLOTS];
  });
}

/**
 * Reset fortress selection (for starting completely fresh).
 */
export function resetFortressSelection(): void {
  batch(() => {
    fortress.selectedFortressClass.value = null;
    fortress.classSelectionVisible.value = false;
    fortress.activeHeroes.value = [];
    fortress.activeTurrets.value = [];
  });
}

/**
 * Initialize hub state from default loadout.
 * Creates hero and turret objects for display in the idle phase.
 * Shows all unlocked heroes and turrets (same as during a run).
 */
export function initializeHubFromLoadout(): void {
  const loadout = profile.defaultLoadout.value;
  const fortressClass = fortress.selectedFortressClass.value;
  const unlockedHeroes = fortress.unlockedHeroIds.value;
  const unlockedTurrets = fortress.unlockedTurretIds.value;

  if (!loadout.turretType || !fortressClass) {
    fortress.hubInitialized.value = false;
    return;
  }

  // Need at least one hero to initialize
  if (unlockedHeroes.length === 0 && !loadout.heroId) {
    fortress.hubInitialized.value = false;
    return;
  }

  batch(() => {
    // Create hub heroes from all unlocked heroes
    // Position heroes in formation like in the game
    const FP_SCALE = 1 << 16; // 65536 - Q16.16 fixed point format

    // Formation position helper - aligned with turret slot positions
    // Turret slots are at offsetX: 4, 7, 10 from fortress
    const getFormationPosition = (index: number, totalCount: number): { xOffset: number; yOffset: number } => {
      const centerY = 7.5;
      // Use turret slot X positions for alignment
      const SLOT_X = [4, 7, 10]; // Same as turret offsetX values

      switch (totalCount) {
        case 1:
          // Single hero: centered at slot 1 position
          return { xOffset: SLOT_X[0], yOffset: centerY };
        case 2:
          // Two heroes: at slot 1, spread vertically
          return [
            { xOffset: SLOT_X[0], yOffset: centerY - 2 },
            { xOffset: SLOT_X[0], yOffset: centerY + 2 },
          ][index] || { xOffset: SLOT_X[0], yOffset: centerY };
        case 3:
          // Three heroes: leader at slot 2, two at slot 1
          return [
            { xOffset: SLOT_X[1], yOffset: centerY },      // Leader front (slot 2)
            { xOffset: SLOT_X[0], yOffset: centerY - 2 },  // Back-top (slot 1)
            { xOffset: SLOT_X[0], yOffset: centerY + 2 },  // Back-bottom (slot 1)
          ][index] || { xOffset: SLOT_X[0], yOffset: centerY };
        case 4:
          // Four heroes: diamond at slots 1 and 2
          return [
            { xOffset: SLOT_X[1], yOffset: centerY },      // Front (slot 2)
            { xOffset: SLOT_X[0], yOffset: centerY - 2 },  // Top (slot 1)
            { xOffset: SLOT_X[0], yOffset: centerY + 2 },  // Bottom (slot 1)
            { xOffset: SLOT_X[0], yOffset: centerY },      // Back center (slot 1)
          ][index] || { xOffset: SLOT_X[0], yOffset: centerY };
        case 5:
          // Five heroes: arrow formation using slots 1, 2
          return [
            { xOffset: SLOT_X[2], yOffset: centerY },      // Point (slot 3)
            { xOffset: SLOT_X[1], yOffset: centerY - 2 },  // Front wings (slot 2)
            { xOffset: SLOT_X[1], yOffset: centerY + 2 },
            { xOffset: SLOT_X[0], yOffset: centerY - 2 },  // Back wings (slot 1)
            { xOffset: SLOT_X[0], yOffset: centerY + 2 },
          ][index] || { xOffset: SLOT_X[0], yOffset: centerY };
        default: {
          // 6+ heroes: rows aligned with slots
          const row = Math.floor(index / 3);
          const col = index % 3;
          const ySpread = 2.5;
          const yPositions = [centerY - ySpread, centerY, centerY + ySpread];
          return {
            xOffset: SLOT_X[Math.min(row, 2)],
            yOffset: yPositions[col] || centerY
          };
        }
      }
    };

    const heroIds = unlockedHeroes.length > 0 ? unlockedHeroes : [loadout.heroId!];
    const heroCount = heroIds.length;
    const hubHeroes: ActiveHero[] = [];

    for (let i = 0; i < heroCount; i++) {
      const heroId = heroIds[i];

      // Get formation position for this hero
      const formation = getFormationPosition(i, heroCount);
      // fortressX is 2, add formation offset
      const heroX = 2 + formation.xOffset;
      const heroY = formation.yOffset;

      const hubHero: ActiveHero = {
        definitionId: heroId,
        tier: 1,
        state: 'idle',
        x: Math.round(heroX * FP_SCALE), // Fixed point: formation X position
        y: Math.round(heroY * FP_SCALE), // Fixed point: formation Y position
        vx: 0,
        vy: 0,
        radius: Math.round(1.0 * FP_SCALE),
        mass: Math.round(1.0 * FP_SCALE),
        movementModifiers: [],
        currentHp: 100,
        maxHp: 100,
        level: 1,
        xp: 0,
        lastAttackTick: 0,
        lastDeployTick: 0,
        skillCooldowns: {},
        buffs: [],
        equippedItems: [],
      };
      hubHeroes.push(hubHero);
    }
    fortress.hubHeroes.value = hubHeroes;

    // Create hub turrets from all unlocked turrets
    const turretIds = unlockedTurrets.length > 0 ? unlockedTurrets : [loadout.turretType!];
    const hubTurretTier = 1 as const;
    const hubTurrets: ActiveTurret[] = [];

    for (let i = 0; i < turretIds.length; i++) {
      const turretId = turretIds[i];
      const turretDefinition = getTurretById(turretId);
      const baseHp = turretDefinition?.baseStats.hp ?? 150;
      const hubTurretMaxHp = Math.floor(baseHp * (1 + (hubTurretTier - 1) * 0.25));

      const hubTurret: ActiveTurret = {
        definitionId: turretId,
        tier: hubTurretTier,
        currentClass: fortressClass,
        slotIndex: i + 1, // Sequential slots starting from 1
        lastAttackTick: 0,
        specialCooldown: 0,
        targetingMode: 'closest_to_fortress',
        currentHp: hubTurretMaxHp,
        maxHp: hubTurretMaxHp,
      };
      hubTurrets.push(hubTurret);
    }
    fortress.hubTurrets.value = hubTurrets;

    fortress.hubInitialized.value = true;
  });
}

/**
 * Refresh profile from server (used after purchases/unlocks).
 */
export async function updateProfileFromServer(): Promise<void> {
  try {
    const profileData = await getProfile();
    updateFromProfile(profileData);
  } catch (error) {
    console.error('Failed to refresh profile:', error);
  }
}

/**
 * Reset all application state on logout.
 * This cleans up all signals, disconnects WebSocket, and prepares for a fresh session.
 */
export function resetAllState(): void {
  batch(() => {
    // Reset profile state
    profile.resetProfileState();

    // Reset game state
    resetGameState();

    // Reset fortress selection
    resetFortressSelection();

    // Reset artifacts and items
    resetArtifactsState();

    // Reset materials
    resetMaterialsState();

    // Reset idle rewards
    resetIdleState();

    // Reset power upgrades
    resetPowerState();

    // Reset guild state
    resetGuildState();

    // Reset messages and disconnect WebSocket
    resetMessagesState();

    // Reset PvP state
    resetPvpState();

    // Reset Boss Rush state
    resetBossRushState();

    // Reset Daily Quests state
    resetDailyQuestsState();

    // Reset Energy state
    resetEnergyState();

    // Reset Pillar Unlocks state
    resetPillarUnlocksState();

    // Reset UI state
    ui.resetUIState();
  });

  // Reset artifact drop tracking
  lastProcessedArtifactDropTick = -1;
}
