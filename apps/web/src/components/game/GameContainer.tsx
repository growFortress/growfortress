import { useRef, useState, useCallback, useEffect, lazy, Suspense } from 'preact/compat';
import type { FortressClass, ActiveHero } from '@arcade/sim-core';
import { DIRECTED_WAVE_1_EVENTS } from '@arcade/sim-core';
import { useGameLoop } from '../../hooks/useGameLoop.js';
import { useTranslation } from '../../i18n/useTranslation.js';
import { useTutorialTriggers } from '../../tutorial/useTutorialTriggers.js';
import { useTutorialPause } from '../../hooks/useTutorialPause.js';
import { useDirectedWaveEvents } from '../../hooks/useDirectedWaveEvents.js';
import './GameContainer.css';
import { Hud } from './Hud.js';
import { Controls } from './Controls.js';
import { HubOverlay } from './HubOverlay.js';
import { GameSidePanel } from './GameSidePanel.js';
import { GameBottomPanel } from './GameBottomPanel.js';
import { ColonyTerminal, PrestigeModal, MilestonePopup } from '../colony/index.js';
import { TutorialHighlight } from './TutorialHighlight.js';
// Critical modals - loaded eagerly (needed immediately on game start)
import { ChoiceModal } from '../modals/ChoiceModal.js';
import { EndScreen } from '../modals/EndScreen.js';
import { ClassSelectionModal } from '../modals/ClassSelectionModal.js';
import { UpgradeModal } from '../modals/UpgradeModal.js';
import { TurretPlacementModal } from '../modals/TurretPlacementModal.js';
import { ConfirmModal } from '../modals/ConfirmModal.js';
import { MaterialDrop } from './MaterialDrop.js';
import { ArtifactDrop } from './ArtifactDrop.js';
import { BossHealthBar } from './BossHealthBar.js';
import { BossRushHUD } from './BossRushHUD.js';
import { BossRushShopPanel } from './BossRushShopPanel.js';
import { LiveSynergyHUD } from './LiveSynergyHUD.js';

// Lazy-loaded modals - loaded on demand (20-30% bundle size reduction)
const HeroDetailsModal = lazy(() => import('../modals/HeroDetailsModal.js').then(m => ({ default: m.HeroDetailsModal })));
const MaterialsInventory = lazy(() => import('../modals/MaterialsInventory.js').then(m => ({ default: m.MaterialsInventory })));
// IdleRewardsModal removed - replaced by full-screen ColonyScene
const ArtifactsModal = lazy(() => import('../modals/ArtifactsModal.js').then(m => ({ default: m.ArtifactsModal })));
const CraftingModal = lazy(() => import('../modals/CraftingModal.js').then(m => ({ default: m.CraftingModal })));
const HeroRecruitmentModal = lazy(() => import('../modals/HeroRecruitmentModal.js').then(m => ({ default: m.HeroRecruitmentModal })));
const HeroPlacementModal = lazy(() => import('../modals/HeroPlacementModal.js').then(m => ({ default: m.HeroPlacementModal })));
const BossRushSetupModal = lazy(() => import('../modals/BossRushSetupModal.js').then(m => ({ default: m.BossRushSetupModal })));
const BossRushEndScreen = lazy(() => import('../modals/BossRushEndScreen.js').then(m => ({ default: m.BossRushEndScreen })));
import type { ActiveSessionSnapshot } from '../../storage/idb.js';
import {
  updateLeaderboard,
  setLeaderboardError,
  classSelectionVisible,
  selectedFortressClass,
  buildPresets,
  activePresetId,
  unlockedHeroIds,
  unlockedTurretIds,
  purchasedHeroSlots,
  showSessionRecoveryModal,
  showEndSessionConfirm,
  upgradeTarget,
  upgradePanelVisible,
  materialsModalVisible,
  artifactsModalVisible,
  craftingModalVisible,
  heroRecruitmentModalVisible,
  heroPlacementModalVisible,
  showBossRushSetup,
  showBossRushEndScreen,
  showOnboardingModal,
  onboardingCompleted,
} from '../../state/index.js';
// Colony state is managed internally by ColonyTerminal
import { getLeaderboard, upgradeHero, upgradeTurret } from '../../api/client.js';
import { ApiError } from '../../api/base.js';
import { baseGold, baseDust, activeTurrets, hubTurrets, gamePhase, activeHeroes, hubHeroes, showErrorToast, resetBossRushState, forceResetToHub, currentPillar, isFirstSession, isDirectedWave1Enabled } from '../../state/index.js';
import { fetchEnergy, hasEnergy } from '../../state/energy.signals.js';
import { speedSettings } from '../../state/settings.signals.js';
import { useAutoPlay } from '../../hooks/useAutoPlay.js';
import { bossRushActive } from '../../state/boss-rush.signals.js';
import type { GameSpeed } from '../../game/loop.js';

interface GameContainerProps {
  onLoadProfile: () => Promise<void>;
  savedSession?: ActiveSessionSnapshot | null;
  onSessionResumeFailed: () => void | Promise<void>;
  onSessionResumed: () => void;
}

export function GameContainer({ onLoadProfile, savedSession, onSessionResumeFailed, onSessionResumed }: GameContainerProps) {
  const { t } = useTranslation('game');
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasReady, setCanvasReady] = useState(false);
  const [sessionStarting, setSessionStarting] = useState(false);
  const [uiScale, setUiScale] = useState(1);
  const sessionRecoveryVisible = showSessionRecoveryModal.value;

  const canvasCallbackRef = useCallback((node: HTMLCanvasElement | null) => {
    canvasRef.current = node;
    if (node) {
      setCanvasReady(true);
    }
  }, []);

  const {
    startSession,
    resumeSession,
    endSession,
    chooseRelic,
    reset,
    startBossRush,
    endBossRush,
    setGameSpeed,
    pauseForTutorial,
    resumeFromTutorial,
  } = useGameLoop(canvasRef, canvasReady);

  // Tutorial triggers - monitors game state and shows contextual tips
  useTutorialTriggers();

  // Tutorial pause - pauses game when tutorial tip is active
  useTutorialPause(pauseForTutorial, resumeFromTutorial);

  // Directed wave events - processes scripted VFX and slow-mo moments during wave 1
  const directedWaveEnabled = isDirectedWave1Enabled();
  useDirectedWaveEvents(
    DIRECTED_WAVE_1_EVENTS,
    directedWaveEnabled && isFirstSession.value
  );

  // Auto-play integration for Boss Rush mode
  const handleAutoPlayHealFortress = useCallback((healPercent: number) => {
    // The heal is already applied through the boss-rush signals
    // This callback is just for any additional effects
    console.log(`[AutoPlay] Healing fortress by ${healPercent * 100}%`);
  }, []);

  const handleAutoPlayRerollRelics = useCallback(() => {
    // Reroll is handled through boss-rush signals
    console.log('[AutoPlay] Rerolling relics');
  }, []);

  useAutoPlay({
    chooseRelicByIndex: chooseRelic,
    healFortress: handleAutoPlayHealFortress,
    rerollRelics: handleAutoPlayRerollRelics,
  });

  // Sync speed settings with game speed
  useEffect(() => {
    if (bossRushActive.value) {
      const speed = speedSettings.value.speedMultiplier as GameSpeed;
      setGameSpeed(speed);
    }
  }, [speedSettings.value.speedMultiplier, setGameSpeed]);

  // Auto-start session when recovery modal is confirmed
  useEffect(() => {
    if (savedSession && !sessionRecoveryVisible && !sessionStarting) {
      setSessionStarting(true);
      // User clicked "Continue session" - start with saved session data
      resumeSession(savedSession)
        .then((sessionInfo) => {
          if (!sessionInfo) {
            showErrorToast(t('gameContainer.resumeFailed'));
            void onSessionResumeFailed();
            return;
          }
          onSessionResumed();
        })
        .catch(() => {
          showErrorToast(t('gameContainer.resumeFailed'));
          void onSessionResumeFailed();
        })
        .finally(() => setSessionStarting(false));
    }
  }, [
    savedSession,
    resumeSession,
    sessionStarting,
    sessionRecoveryVisible,
    onSessionResumeFailed,
    onSessionResumed,
  ]);

  // Handle force reset to hub (from session abandon)
  useEffect(() => {
    if (forceResetToHub.value) {
      forceResetToHub.value = false;
      reset();
    }
  }, [forceResetToHub.value, reset]);

  // Auto-start game for ALL new players (guests and registered) who haven't completed onboarding
  useEffect(() => {
    if (
      gamePhase.value === 'idle' &&
      !onboardingCompleted.value &&
      canvasReady &&
      !sessionStarting &&
      !sessionRecoveryVisible &&
      !showOnboardingModal.value
    ) {
      console.log('[GameContainer] Auto-starting game for new player...');
      // Set natural fortress class as default
      if (!selectedFortressClass.value) {
        selectedFortressClass.value = 'natural';
      }

      // Enable enhanced VFX for first session - creates impactful first impression
      isFirstSession.value = true;

      // Start the session immediately - let them play first, learn later
      handleStartSession();

      // Show simplified onboarding after a short delay (5 seconds into gameplay)
      const onboardingTimer = setTimeout(() => {
        if (gamePhase.value === 'playing' && !onboardingCompleted.value) {
          showOnboardingModal.value = true;
        }
      }, 5000);

      return () => clearTimeout(onboardingTimer);
    }
    return undefined;
  }, [gamePhase.value, onboardingCompleted.value, canvasReady, sessionStarting, sessionRecoveryVisible]);

  const updateUiScale = useCallback((width: number, height: number) => {
    const baseWidth = 1920;
    const baseHeight = 1080;
    const nextScale = Math.min(width / baseWidth, height / baseHeight, 1);
    setUiScale((prev) => (Math.abs(prev - nextScale) < 0.001 ? prev : nextScale));
  }, []);

  useEffect(() => {
    const target = gameAreaRef.current;
    if (!target) {
      return;
    }

    const updateFromRect = () => {
      const rect = target.getBoundingClientRect();
      updateUiScale(rect.width, rect.height);
    };

    updateFromRect();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateFromRect);
      return () => window.removeEventListener('resize', updateFromRect);
    }

    const observer = new ResizeObserver((entries) => {
      if (!entries.length) {
        return;
      }
      const rect = entries[0].contentRect;
      updateUiScale(rect.width, rect.height);
    });

    observer.observe(target);
    return () => observer.disconnect();
  }, [updateUiScale]);

  const handleStartClick = async () => {
    // First, show class selection if not already selected
    if (!selectedFortressClass.value) {
      classSelectionVisible.value = true;
      return;
    }

    // Start session directly
    await handleStartSession();
  };

  const handleClassSelect = async (_fortressClass: FortressClass) => {
    // Class is now selected, start session directly
    await handleStartSession();
  };

  const handleStartSession = async () => {
    const activePreset = activePresetId.value
      ? buildPresets.value.find((preset) => preset.id === activePresetId.value)
      : null;
    const fortressClass =
      activePreset?.fortressClass || selectedFortressClass.value || 'natural';
    // Use preset heroes or fall back to unlocked heroes, but limit to purchased slots
    const maxSlots = purchasedHeroSlots.value;
    const allHeroes = activePreset?.startingHeroes || unlockedHeroIds.value;
    const startingHeroes = allHeroes.slice(0, maxSlots);
    const startingTurrets = activePreset?.startingTurrets || unlockedTurretIds.value;
    const pillarId = currentPillar.value;

    try {
      const sessionInfo = await startSession({
        fortressClass,
        startingHeroes,
        startingTurrets,
        pillarId,
      });

      if (!sessionInfo) {
        showErrorToast(t('gameContainer.startFailed'));
      }
    } catch (error) {
      // Handle specific error codes
      if (error instanceof ApiError && error.code === 'INSUFFICIENT_ENERGY') {
        showErrorToast('Brak energii! Poczekaj na regenerację lub doładuj za dust.', 'warning');
        // Refresh energy state to show current status
        fetchEnergy();
      } else {
        showErrorToast(t('gameContainer.startFailed'));
      }
    }
  };

  const handleUpgrade = async (target: { type: 'hero' | 'turret'; id: string | number }) => {
    try {
      if (target.type === 'hero') {
        // Find the hero and get current tier
        const isIdle = gamePhase.value === 'idle';
        const heroes = isIdle ? hubHeroes.value.filter((h): h is ActiveHero => h !== null) : activeHeroes.value;
        const hero = heroes.find(h => h.definitionId === target.id);
        if (!hero) return;

        const result = await upgradeHero({
          heroId: target.id as string,
          currentTier: hero.tier,
        });

        if (result.success) {
          // Update local state
          baseGold.value = result.newInventory.gold;
          baseDust.value = result.newInventory.dust;

          // Update hero tier in local state
          if (isIdle) {
            hubHeroes.value = hubHeroes.value.map(h => 
              h !== null && h.definitionId === target.id 
                ? { ...h, tier: result.newTier as 1 | 2 | 3 } 
                : h
            );
          } else {
            activeHeroes.value = activeHeroes.value.map(h => 
              h.definitionId === target.id 
                ? { ...h, tier: result.newTier as 1 | 2 | 3 } 
                : h
            );
          }
        }
      } else if (target.type === 'turret') {
        // Find the turret and get current tier
        const isIdle = gamePhase.value === 'idle';
        const turrets = isIdle ? hubTurrets.value : activeTurrets.value;
        const turret = turrets.find(t => t.slotIndex === target.id);
        if (!turret) return;

        const result = await upgradeTurret({
          turretType: turret.definitionId,
          slotIndex: target.id as number,
          currentTier: turret.tier,
        });

        if (result.success) {
          // Update local state
          baseGold.value = result.newInventory.gold;
          baseDust.value = result.newInventory.dust;

          // Update turret tier in local state
          const updateTurrets = (list: typeof turrets) =>
            list.map(t => t.slotIndex === target.id ? { ...t, tier: result.newTier as 1 | 2 | 3 } : t);

          if (isIdle) {
            hubTurrets.value = updateTurrets(hubTurrets.value);
          } else {
            activeTurrets.value = updateTurrets(activeTurrets.value);
          }
        }
      }
    } catch {
      showErrorToast('Upgrade failed. Please try again.');
    }
  };

  const handleTurretPlace = (_turretType: string, _slotIndex: number) => {
    // Turret is added to activeTurrets in the modal
    // This callback can be used for additional game logic like spending gold
  };

  const handleEndSessionClick = () => {
    showEndSessionConfirm.value = true;
  };

  const handleEndSessionConfirm = async () => {
    showEndSessionConfirm.value = false;
    await endSession();
  };

  const handleEndSessionCancel = () => {
    showEndSessionConfirm.value = false;
  };

  const handlePlayAgain = async () => {
    reset();
    await onLoadProfile();

    // Load leaderboard
    try {
      const data = await getLeaderboard();
      updateLeaderboard(data.entries);
    } catch {
      setLeaderboardError();
    }

    // Start a new session
    await handleStartSession();
  };

  // Boss Rush handlers
  const handleBossRushStart = async () => {
    const activePreset = activePresetId.value
      ? buildPresets.value.find((preset) => preset.id === activePresetId.value)
      : null;
    const fortressClass =
      activePreset?.fortressClass || selectedFortressClass.value || 'natural';
    // Use preset heroes or fall back to unlocked heroes, but limit to purchased slots
    const maxSlots = purchasedHeroSlots.value;
    const allHeroes = activePreset?.startingHeroes || unlockedHeroIds.value;
    const startingHeroes = allHeroes.slice(0, maxSlots);
    const startingTurrets = activePreset?.startingTurrets || unlockedTurretIds.value;

    const sessionInfo = await startBossRush({
      fortressClass,
      startingHeroes,
      startingTurrets,
    });

    if (!sessionInfo) {
      showErrorToast(t('gameContainer.bossRushFailed'));
    }
  };

  const handleBossRushEnd = async () => {
    await endBossRush();
  };

  const handleBossRushPlayAgain = async () => {
    reset();
    await handleBossRushStart();
  };

  const handleBossRushMenu = () => {
    resetBossRushState();
    reset();
  };

  const handleReturnToHub = () => {
    reset();
  };

  // Check if game is in playing state for side panel
  const isPlaying = gamePhase.value !== 'idle';

  return (
    <div
      id="game-container"
      class={isPlaying ? 'playing' : ''}
      style={{ '--ui-scale': uiScale.toString() } as Record<string, string>}
    >
      {/* Game area - contains canvas and hub overlay */}
      <div id="game-area" ref={gameAreaRef}>
        <canvas ref={canvasCallbackRef} id="game-canvas" data-tutorial="game-canvas" />

        {/* Hub overlay for clicking heroes/turrets before session */}
        <HubOverlay />

        <div id="ui-overlay">
          <Hud />
          <Controls
            onStartClick={handleStartClick}
            onEndSessionClick={handleEndSessionClick}
            onBossRushEndClick={handleBossRushEnd}
            startDisabled={sessionStarting || sessionRecoveryVisible || !hasEnergy.value}
          />
          <UpgradeModal onUpgrade={handleUpgrade} />
          <TurretPlacementModal onPlace={handleTurretPlace} />
        </div>
      </div>

      {/* Side panel - only during gameplay */}
      <GameSidePanel onSpeedChange={setGameSpeed} onMenuClick={handleEndSessionClick} />

      {/* Bottom panel - actions (walls, militia) during gameplay */}
      <GameBottomPanel />

      {/* Modals outside ui-overlay to allow full pointer interactions */}
      <ClassSelectionModal onSelect={handleClassSelect} />
      <ChoiceModal onSelect={chooseRelic} />
      <EndScreen onPlayAgain={handlePlayAgain} onReturnToHub={handleReturnToHub} />
      <ConfirmModal
        visible={showEndSessionConfirm.value}
        title={t('gameContainer.endSessionTitle')}
        message={t('gameContainer.endSessionMessage')}
        confirmText={t('gameContainer.endSessionConfirm')}
        cancelText={t('gameContainer.endSessionCancel')}
        variant="danger"
        onConfirm={handleEndSessionConfirm}
        onCancel={handleEndSessionCancel}
      />

      {/* Materials & Artifacts drop notifications */}
      <MaterialDrop />
      <ArtifactDrop />

      {/* Lazy-loaded modals - only mounted when visible to prevent memory leaks */}
      {upgradePanelVisible.value && upgradeTarget.value?.type === 'hero' && <Suspense fallback={null}><HeroDetailsModal onUpgrade={handleUpgrade} /></Suspense>}
      {materialsModalVisible.value && <Suspense fallback={null}><MaterialsInventory /></Suspense>}
      {artifactsModalVisible.value && <Suspense fallback={null}><ArtifactsModal /></Suspense>}
      {craftingModalVisible.value && <Suspense fallback={null}><CraftingModal /></Suspense>}
      {heroRecruitmentModalVisible.value && <Suspense fallback={null}><HeroRecruitmentModal /></Suspense>}
      {heroPlacementModalVisible.value && <Suspense fallback={null}><HeroPlacementModal /></Suspense>}
      {showBossRushSetup.value && <Suspense fallback={null}><BossRushSetupModal onStart={handleBossRushStart} /></Suspense>}
      {showBossRushEndScreen.value && <Suspense fallback={null}><BossRushEndScreen onPlayAgain={handleBossRushPlayAgain} onMenu={handleBossRushMenu} /></Suspense>}

      {/* Boss Rush HUD (eagerly loaded - visible during gameplay) */}
      <BossHealthBar />
      <BossRushHUD />
      <BossRushShopPanel />

      {/* Live Synergy HUD - shows active synergies and DPS breakdown */}
      <LiveSynergyHUD />

      {/* Colony Terminal (full-screen colony management) */}
      <ColonyTerminal />
      <PrestigeModal />
      <MilestonePopup />

      {/* Tutorial highlight overlay (renders via portal) */}
      <TutorialHighlight />
    </div>
  );
}
