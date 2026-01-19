import { useRef, useLayoutEffect, useCallback } from 'preact/hooks';
import type { FortressClass } from '@arcade/sim-core';
import { Game, type SessionStartOptions } from '../game/Game.js';
import { GameLoop, type GameSpeed } from '../game/loop.js';
import { GameApp, type HubState } from '../renderer/GameApp.js';

// Force full page reload for game loop changes to avoid WebGL context issues
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    import.meta.hot?.invalidate();
  });
}
import type { SessionStartResponse, SegmentSubmitResponse } from '../api/client.js';
import type { BossRushStartResponse } from '../api/boss-rush.js';
import type { ActiveSessionSnapshot } from '../storage/idb.js';
import {
  syncGameState,
  showChoice,
  showEndScreenWithStats,
  showRewardsToast,
  updateFromSegment,
  updateFromSessionStart,
  resetGameState,
  initializeHubFromLoadout,
  hubHeroes,
  hubTurrets,
  turretSlots,
  hubInitialized,
  upgradeTarget,
  upgradePanelVisible,
  commandSelectedHeroId,
  setCommandTarget,
  cancelCommand,
  selectedTargetedSkill,
  clearSelectedSkill,
  baseGold,
  baseDust,
  baseLevel,
  baseXp,
  baseTotalXp,
  baseXpToNextLevel,
  currentWave,
  gameSpeed,
  type GameEndState,
} from '../state/index.js';
import {
  setTurretTargetingFn,
  activateOverchargeFn,
  placeWallFn,
  removeWallFn,
  spawnMilitiaFn,
  resetGameActions,
} from '../state/gameActions.signals.js';
import { consumeEnergyLocal } from '../state/energy.signals.js';
import { selectedWallType, clearWallSelection } from '../components/game/WallPlacementPanel.js';
import { selectedMilitiaType, clearMilitiaSelection } from '../components/game/MilitiaSpawnPanel.js';
import { FP } from '@arcade/sim-core';

interface StartSessionOptions {
  fortressClass?: FortressClass;
  startingHeroes?: string[];
  startingTurrets?: string[];
}

interface UseGameLoopReturn {
  game: Game | null;
  startSession: (options?: StartSessionOptions) => Promise<SessionStartResponse | null>;
  resumeSession: (snapshot: ActiveSessionSnapshot) => Promise<SessionStartResponse | null>;
  endSession: () => Promise<void>;
  chooseRelic: (index: number) => void;
  activateAnnihilation: () => void;
  reset: () => void;
  startBossRush: (options?: StartSessionOptions) => Promise<BossRushStartResponse | null>;
  endBossRush: () => Promise<void>;
  setGameSpeed: (speed: GameSpeed) => void;
  // New game system methods
  placeWall: (wallType: 'basic' | 'reinforced' | 'gate', x: number, y: number) => void;
  removeWall: (wallId: number) => void;
  setTurretTargeting: (slotIndex: number, mode: 'closest_to_fortress' | 'weakest' | 'strongest' | 'nearest_to_turret' | 'fastest') => void;
  activateOvercharge: (slotIndex: number) => void;
  spawnMilitia: (militiaType: 'infantry' | 'archer' | 'shield_bearer', x: number, y: number, count?: number) => void;
  // Colony scene methods
  showColonyScene: () => void;
  hideColonyScene: () => void;
  updateColonies: (colonies: import('@arcade/protocol').ColonyStatus[]) => void;
  playColonyClaimAnimation: () => Promise<void>;
  playColonyUpgradeAnimation: (colonyId: string) => void;
}

export function useGameLoop(
  canvasRef: { current: HTMLCanvasElement | null },
  canvasReady: boolean
): UseGameLoopReturn {
  const gameRef = useRef<Game | null>(null);
  const loopRef = useRef<GameLoop | null>(null);
  const rendererRef = useRef<GameApp | null>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvasReady) {
      return;
    }

    let destroyed = false;
    let hubRafId: number | null = null;
    let lastHubStateKey = ''; // Track state changes to avoid unnecessary renders
    let hubIdleFrames = 0; // Count idle frames to throttle when nothing changes
    const HUB_THROTTLE_THRESHOLD = 5; // After 5 idle frames, slow down to 10fps
    const renderer = new GameApp(canvas);
    rendererRef.current = renderer;

    const game = new Game({
      onStateChange: () => {
        syncGameState(game);
      },
      onChoiceRequired: (options: string[]) => {
        showChoice(options);
      },
      onGameEnd: (
        won: boolean,
        newInventory?: { gold: number; dust: number },
        newProgression?: { level: number; xp: number; totalXp: number; xpToNextLevel: number },
        finalWave?: number
      ) => {
        const state = game.getState();
        const endState: GameEndState | null = state
          ? {
              wavesCleared: state.wavesCleared,
              kills: state.kills,
              eliteKills: state.eliteKills,
              goldEarned: state.goldEarned,
              dustEarned: state.dustEarned,
              relics: state.relics.map((r) => r.id),
              sessionXpEarned: state.sessionXpEarned,
            }
          : null;
        showEndScreenWithStats(won, endState);

        // Update inventory from session end response
        if (newInventory) {
          baseGold.value = newInventory.gold;
          baseDust.value = newInventory.dust;
        }

        // Update progression from session end response
        if (newProgression) {
          baseLevel.value = newProgression.level;
          baseXp.value = newProgression.xp;
          baseTotalXp.value = newProgression.totalXp;
          baseXpToNextLevel.value = newProgression.xpToNextLevel;
        }

        // Update wave from session end response
        if (finalWave !== undefined) {
          currentWave.value = finalWave;
        }

        // CRITICAL: Stop the game loop so hub loop can take over
        loop.stop();

        // Reinitialize hub state from loadout for proper display
        initializeHubFromLoadout();

        // Restart hub rendering after game ends
        startHubLoop();
      },
      onSegmentComplete: (result: SegmentSubmitResponse) => {
        updateFromSegment(result);
      },
      onRewardsReceived: (gold: number, dust: number, xp: number) => {
        showRewardsToast(gold, dust, xp);
      },
      onBossRushEnd: () => {
        // CRITICAL: Stop the game loop so hub loop can take over
        loop.stop();

        // Reinitialize hub state from loadout for proper display
        initializeHubFromLoadout();

        // Restart hub rendering after Boss Rush ends
        startHubLoop();
      },
    });
    gameRef.current = game;

    // Set up game action callbacks for UI components
    setTurretTargetingFn.value = (slotIndex, mode) => game.setTurretTargeting(slotIndex, mode);
    activateOverchargeFn.value = (slotIndex) => game.activateOvercharge(slotIndex);
    placeWallFn.value = (wallType, x, y) => game.placeWall(wallType, x, y);
    removeWallFn.value = (wallId) => game.removeWall(wallId);
    spawnMilitiaFn.value = (militiaType, x, y, count) => game.spawnMilitia(militiaType, x, y, count);

    const loop = new GameLoop(game, (alpha) => {
      renderer.render(game.getState(), alpha);
    });
    loopRef.current = loop;

    // Hub rendering loop for idle phase - with throttling for performance
    let lastHubRenderTime = 0;
    const renderHub = (timestamp: number = 0) => {
      if (destroyed || loop.isRunning()) {
        hubRafId = null;
        lastHubStateKey = '';
        hubIdleFrames = 0;
        return;
      }

      // Get hub state from signals
      const hubState: HubState | undefined = hubInitialized.value
        ? {
            heroes: hubHeroes.value,
            turrets: hubTurrets.value,
            turretSlots: turretSlots.value,
          }
        : undefined;

      // Create a simple state key to detect changes
      const stateKey = hubState
        ? `${hubState.heroes.length}-${hubState.turrets.length}-${hubState.turretSlots}`
        : 'none';

      const stateChanged = stateKey !== lastHubStateKey;
      lastHubStateKey = stateKey;

      // Throttle when nothing changes - render at ~10fps instead of 60fps
      if (!stateChanged) {
        hubIdleFrames++;
        if (hubIdleFrames > HUB_THROTTLE_THRESHOLD) {
          const elapsed = timestamp - lastHubRenderTime;
          if (elapsed < 100) { // 100ms = 10fps
            hubRafId = requestAnimationFrame(renderHub);
            return;
          }
        }
      } else {
        hubIdleFrames = 0;
      }

      lastHubRenderTime = timestamp;
      renderer.render(null, 0, hubState);
      hubRafId = requestAnimationFrame(renderHub);
    };

    const startHubLoop = () => {
      if (hubRafId !== null) return;
      hubRafId = requestAnimationFrame(renderHub);
    };

    const stopHubLoop = () => {
      if (hubRafId !== null) {
        cancelAnimationFrame(hubRafId);
        hubRafId = null;
      }
    };

    // Initialize renderer asynchronously with proper error handling
    renderer.init()
      .then(() => {
        if (destroyed) return;

        console.log('[GameLoop] Renderer initialized successfully');

        // Set up hero click handler for hub mode
        renderer.setOnHeroClick((heroId: string) => {
          upgradeTarget.value = { type: 'hero', heroId };
          upgradePanelVisible.value = true;
        });

        // Set up turret click handler for hub mode
        renderer.setOnTurretClick((turretId: string, slotIndex: number) => {
          upgradeTarget.value = { type: 'turret', turretId, slotIndex };
          upgradePanelVisible.value = true;
        });

        // Set up field click handler for tactical commands and targeted skills
        renderer.setOnFieldClick((worldX: number, worldY: number) => {
          // Convert world coordinates to fixed-point
          const fpX = FP.fromFloat(worldX);
          const fpY = FP.fromFloat(worldY);

          // Priority 1: Handle targeted fortress skill activation
          if (selectedTargetedSkill.value) {
            if (game) {
              game.activateFortressSkill(selectedTargetedSkill.value, fpX, fpY);
            }
            clearSelectedSkill();
            return;
          }

          // Priority 2: Handle wall placement
          if (selectedWallType.value) {
            if (game) {
              game.placeWall(selectedWallType.value, fpX, fpY);
            }
            clearWallSelection();
            return;
          }

          // Priority 3: Handle militia spawning (always from fortress position)
          if (selectedMilitiaType.value) {
            if (game) {
              // Spawn militia at fortress position (X=2, Y=7 center of path)
              const fortressSpawnX = FP.fromInt(3); // Slightly in front of fortress
              const fortressSpawnY = FP.fromFloat(7.5); // Center of path
              game.spawnMilitia(selectedMilitiaType.value, fortressSpawnX, fortressSpawnY);
            }
            clearMilitiaSelection();
            return;
          }

          // Priority 4: Handle hero tactical command
          if (commandSelectedHeroId.value) {
            // Set the target position
            setCommandTarget(fpX, fpY);

            // Issue command to game
            if (game) {
              game.issueHeroCommand(commandSelectedHeroId.value, fpX, fpY);
            }

            // Clear selection after issuing command
            cancelCommand();
          }
        });

        // Initial sync
        syncGameState(game);

        // Start hub rendering loop
        startHubLoop();
      })
      .catch((error) => {
        console.error('[GameLoop] Failed to initialize renderer:', error);
        // Still try to start the hub loop - some rendering is better than none
        startHubLoop();
      });

    return () => {
      destroyed = true;
      stopHubLoop();
      loop.destroy();
      renderer.destroy();
      resetGameActions();
    };
  }, [canvasReady]);

  const startSession = useCallback(async (options: StartSessionOptions = {}): Promise<SessionStartResponse | null> => {
    const game = gameRef.current;
    const loop = loopRef.current;
    if (!game || !loop) return null;

    const sessionOptions: SessionStartOptions = {
      fortressClass: options.fortressClass || 'natural',
      startingHeroes: options.startingHeroes || [],
      startingTurrets: options.startingTurrets || [],
    };

    try {
      const sessionInfo = await game.startEndlessSession(sessionOptions);
      if (sessionInfo) {
        updateFromSessionStart(sessionInfo.inventory);
        consumeEnergyLocal(); // Deduct 1 energy locally after successful session start
        loop.start();
      }
      return sessionInfo;
    } catch (error) {
      // Re-throw to allow GameContainer to handle specific errors
      throw error;
    }
  }, []);

  const resumeSession = useCallback(async (snapshot: ActiveSessionSnapshot): Promise<SessionStartResponse | null> => {
    const game = gameRef.current;
    const loop = loopRef.current;
    if (!game || !loop) return null;

    const sessionInfo = await game.resumeEndlessSession(snapshot);
    if (sessionInfo) {
      loop.start();
    }
    return sessionInfo;
  }, []);

  const endSession = useCallback(async (): Promise<void> => {
    const game = gameRef.current;
    const loop = loopRef.current;
    if (!game || !loop) return;

    loop.stop();
    await game.endCurrentSession();
  }, []);

  const chooseRelic = useCallback((index: number): void => {
    const game = gameRef.current;
    if (!game) return;
    game.chooseRelic(index);
  }, []);

  const activateAnnihilation = useCallback((): void => {
    const game = gameRef.current;
    if (!game) return;
    game.activateAnnihilation();
  }, []);

  const reset = useCallback((): void => {
    const game = gameRef.current;
    if (!game) return;
    game.reset();
    game.resetBossRush();
    resetGameState();
  }, []);

  const startBossRush = useCallback(async (options: StartSessionOptions = {}): Promise<BossRushStartResponse | null> => {
    const game = gameRef.current;
    const loop = loopRef.current;
    if (!game || !loop) return null;

    const sessionOptions: SessionStartOptions = {
      fortressClass: options.fortressClass || 'natural',
      startingHeroes: options.startingHeroes || [],
      startingTurrets: options.startingTurrets || [],
    };

    const sessionInfo = await game.startBossRushSession(sessionOptions);
    if (sessionInfo) {
      loop.start();
    }
    return sessionInfo;
  }, []);

  const endBossRush = useCallback(async (): Promise<void> => {
    const game = gameRef.current;
    const loop = loopRef.current;
    if (!game || !loop) return;

    loop.stop();
    await game.endBossRushSession();
    game.resetBossRush();
  }, []);

  const setGameSpeed = useCallback((speed: GameSpeed): void => {
    const loop = loopRef.current;
    if (!loop) return;

    loop.setSpeed(speed);
    gameSpeed.value = speed;
  }, []);

  // New game system methods
  const placeWall = useCallback((wallType: 'basic' | 'reinforced' | 'gate', x: number, y: number): void => {
    const game = gameRef.current;
    if (!game) return;
    game.placeWall(wallType, x, y);
  }, []);

  const removeWall = useCallback((wallId: number): void => {
    const game = gameRef.current;
    if (!game) return;
    game.removeWall(wallId);
  }, []);

  const setTurretTargeting = useCallback((slotIndex: number, mode: 'closest_to_fortress' | 'weakest' | 'strongest' | 'nearest_to_turret' | 'fastest'): void => {
    const game = gameRef.current;
    if (!game) return;
    game.setTurretTargeting(slotIndex, mode);
  }, []);

  const activateOvercharge = useCallback((slotIndex: number): void => {
    const game = gameRef.current;
    if (!game) return;
    game.activateOvercharge(slotIndex);
  }, []);

  const spawnMilitia = useCallback((militiaType: 'infantry' | 'archer' | 'shield_bearer', x: number, y: number, count?: number): void => {
    const game = gameRef.current;
    if (!game) return;
    game.spawnMilitia(militiaType, x, y, count);
  }, []);

  // Colony scene methods
  const showColonyScene = useCallback((): void => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.showColonyScene();
  }, []);

  const hideColonyScene = useCallback((): void => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.hideColonyScene();
  }, []);

  const updateColonies = useCallback((colonies: import('@arcade/protocol').ColonyStatus[]): void => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.setColonies(colonies);
  }, []);

  const playColonyClaimAnimation = useCallback(async (): Promise<void> => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    await renderer.playColonyClaimAnimation();
  }, []);

  const playColonyUpgradeAnimation = useCallback((colonyId: string): void => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.playColonyUpgradeAnimation(colonyId);
  }, []);

  return {
    game: gameRef.current,
    startSession,
    resumeSession,
    endSession,
    chooseRelic,
    activateAnnihilation,
    reset,
    startBossRush,
    endBossRush,
    setGameSpeed,
    // New game system methods
    placeWall,
    removeWall,
    setTurretTargeting,
    activateOvercharge,
    spawnMilitia,
    // Colony scene methods
    showColonyScene,
    hideColonyScene,
    updateColonies,
    playColonyClaimAnimation,
    playColonyUpgradeAnimation,
  };
}
