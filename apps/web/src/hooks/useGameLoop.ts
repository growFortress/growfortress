import { useRef, useLayoutEffect, useCallback } from 'preact/hooks';
import type { FortressClass } from '@arcade/sim-core';
import { Game, type SessionStartOptions } from '../game/Game.js';
import { GameLoop } from '../game/loop.js';
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
  type GameEndState,
} from '../state/index.js';
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
  activateSnap: () => void;
  reset: () => void;
  startBossRush: (options?: StartSessionOptions) => Promise<BossRushStartResponse | null>;
  endBossRush: () => Promise<void>;
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
    const renderer = new GameApp(canvas);
    rendererRef.current = renderer;

    const game = new Game({
      onStateChange: () => {
        syncGameState(game);
      },
      onChoiceRequired: (options: string[]) => {
        showChoice(options);
      },
      onGameEnd: (won: boolean) => {
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
        // Reinitialize hub state from loadout for proper display
        initializeHubFromLoadout();

        // Restart hub rendering after Boss Rush ends
        startHubLoop();
      },
    });
    gameRef.current = game;

    const loop = new GameLoop(game, (alpha) => {
      renderer.render(game.getState(), alpha);
    });
    loopRef.current = loop;

    // Hub rendering loop for idle phase
    const renderHub = () => {
      if (destroyed || loop.isRunning()) {
        hubRafId = null;
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

    // Initialize renderer asynchronously
    renderer.init().then(() => {
      if (destroyed) return;

      // Set up hero click handler for hub mode
      renderer.setOnHeroClick((heroId: string) => {
        upgradeTarget.value = { type: 'hero', heroId };
        upgradePanelVisible.value = true;
      });

      // Set up field click handler for tactical commands during waves
      renderer.setOnFieldClick((worldX: number, worldY: number) => {
        // Only handle if a hero is selected for command
        if (!commandSelectedHeroId.value) return;

        // Convert world coordinates to fixed-point
        const fpX = FP.fromFloat(worldX);
        const fpY = FP.fromFloat(worldY);

        // Set the target position
        setCommandTarget(fpX, fpY);

        // Issue command to game
        if (game) {
          game.issueHeroCommand(commandSelectedHeroId.value, fpX, fpY);
        }

        // Clear selection after issuing command
        cancelCommand();
      });

      // Initial sync
      syncGameState(game);

      // Start hub rendering loop
      startHubLoop();
    });

    return () => {
      destroyed = true;
      stopHubLoop();
      loop.destroy();
      renderer.destroy();
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

    const sessionInfo = await game.startEndlessSession(sessionOptions);
    if (sessionInfo) {
      updateFromSessionStart(sessionInfo.inventory);
      loop.start();
    }
    return sessionInfo;
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

  const activateSnap = useCallback((): void => {
    const game = gameRef.current;
    if (!game) return;
    game.activateSnap();
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

  return {
    game: gameRef.current,
    startSession,
    resumeSession,
    endSession,
    chooseRelic,
    activateSnap,
    reset,
    startBossRush,
    endBossRush,
  };
}
