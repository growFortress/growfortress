import { batch } from '@preact/signals';
import type { ProfileResponse, SegmentSubmitResponse } from '@arcade/protocol';
import type { ActiveHero, ActiveTurret } from '@arcade/sim-core';
import { getTurretById, getRewardsForLevel } from '@arcade/sim-core';
import type { Game } from '../game/Game.js';
import type { GameStateSnapshot } from './game.signals.js';
import type { LeaderboardEntry, GameEndState } from './ui.signals.js';
import * as profile from './profile.signals.js';
import * as game from './game.signals.js';
import * as ui from './ui.signals.js';
import * as fortress from './fortress.signals.js';
import { addArtifactDrop } from './artifacts.signals.js';
import { getProfile } from '../api/client.js';

// Track processed artifact drops to avoid duplicates
let lastProcessedArtifactDropTick = -1;

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
    profile.displayName.value = data.displayName;

    // Onboarding status
    profile.onboardingCompleted.value = data.onboardingCompleted;
    profile.defaultLoadout.value = {
      fortressClass: data.defaultLoadout.fortressClass as profile.DefaultLoadout['fortressClass'],
      heroId: data.defaultLoadout.heroId,
      turretType: data.defaultLoadout.turretType as profile.DefaultLoadout['turretType'],
    };

    // If onboarding is completed, set the fortress class
    if (data.onboardingCompleted && data.defaultLoadout.fortressClass) {
      fortress.selectedFortressClass.value = data.defaultLoadout.fortressClass as typeof fortress.selectedFortressClass.value;
    }

    // Update unlocked heroes and turrets from profile
    fortress.unlockedHeroIds.value = data.unlockedHeroes || [];
    fortress.unlockedTurretIds.value = data.unlockedTurrets || [];
  });
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

  batch(() => {
    game.gamePhase.value = phase;

    if (state) {
      const snapshot: GameStateSnapshot = {
        tick: state.tick,
        wave: state.wave,
        wavesCleared: state.wavesCleared,
        kills: state.kills,
        eliteKills: state.eliteKills,
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
        // Infinity Stones
        collectedStones: state.collectedStones || [],
        infinityStoneFragments: state.infinityStoneFragments || [],
        gauntletState: state.gauntletState || null,
        // Fortress class skills
        fortressActiveSkills: state.activeSkills || [],
        fortressSkillCooldowns: state.skillCooldowns || {},
      };
      game.gameState.value = snapshot;

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
    // Position heroes spread vertically like in the game
    const FP_SCALE = 1 << 16; // 65536 - Q16.16 fixed point format
    const centerY = 7.5;
    const spreadRange = 5; // Total spread range (units from top to bottom)

    const heroIds = unlockedHeroes.length > 0 ? unlockedHeroes : [loadout.heroId!];
    const heroCount = heroIds.length;
    const hubHeroes: ActiveHero[] = [];

    for (let i = 0; i < heroCount; i++) {
      const heroId = heroIds[i];

      // Calculate Y position based on hero count (same logic as sim-core)
      let heroY: number;
      if (heroCount === 1) {
        heroY = centerY;
      } else {
        const spreadStep = spreadRange / (heroCount - 1);
        heroY = (centerY - spreadRange / 2) + (i * spreadStep);
      }

      const hubHero: ActiveHero = {
        definitionId: heroId,
        tier: 1,
        state: 'idle',
        x: 6 * FP_SCALE, // Fixed point: to the right of fortress (fortress is at X=2)
        y: Math.round(heroY * FP_SCALE), // Fixed point: spread vertically
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
