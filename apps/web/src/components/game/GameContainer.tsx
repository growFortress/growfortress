import { useRef, useState, useCallback, useEffect } from 'preact/hooks';
import type { FortressClass } from '@arcade/sim-core';
import { useGameLoop } from '../../hooks/useGameLoop.js';
import './GameContainer.css';
import { Hud } from './Hud.js';
import { Controls } from './Controls.js';
import { HubOverlay } from './HubOverlay.js';
import { ChoiceModal } from '../modals/ChoiceModal.js';
import { EndScreen } from '../modals/EndScreen.js';
import { ClassSelectionModal } from '../modals/ClassSelectionModal.js';
import { UpgradeModal } from '../modals/UpgradeModal.js';
import { HeroDetailsModal } from '../modals/HeroDetailsModal.js';
import { TurretPlacementModal } from '../modals/TurretPlacementModal.js';
import { ConfirmModal } from '../modals/ConfirmModal.js';
import { MaterialsInventory } from '../modals/MaterialsInventory.js';
import { IdleRewardsModal } from '../modals/IdleRewardsModal.js';
import { MaterialDrop } from './MaterialDrop.js';
import { ArtifactDrop } from './ArtifactDrop.js';
import { ArtifactsModal } from '../modals/ArtifactsModal.js';
import { CraftingModal } from '../modals/CraftingModal.js';
import { HeroRecruitmentModal } from '../modals/HeroRecruitmentModal.js';
import { BossRushSetupModal } from '../modals/BossRushSetupModal.js';
import { BossRushEndScreen } from '../modals/BossRushEndScreen.js';
import { BossHealthBar } from './BossHealthBar.js';
import { BossRushHUD } from './BossRushHUD.js';
import type { ActiveSessionSnapshot } from '../../storage/idb.js';
import {
  updateLeaderboard,
  setLeaderboardError,
  classSelectionVisible,
  selectedFortressClass,
  unlockedHeroIds,
  unlockedTurretIds,
  showSessionRecoveryModal,
  showEndSessionConfirm,
} from '../../state/index.js';
import { getLeaderboard, upgradeHero, upgradeTurret } from '../../api/client.js';
import { baseGold, baseDust, activeTurrets, hubTurrets, gamePhase, activeHeroes, hubHeroes, showErrorToast, resetBossRushState } from '../../state/index.js';

interface GameContainerProps {
  onLoadProfile: () => Promise<void>;
  savedSession?: ActiveSessionSnapshot | null;
  onSessionResumeFailed: () => void | Promise<void>;
  onSessionResumed: () => void;
}

export function GameContainer({ onLoadProfile, savedSession, onSessionResumeFailed, onSessionResumed }: GameContainerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasReady, setCanvasReady] = useState(false);
  const [sessionStarting, setSessionStarting] = useState(false);
  const sessionRecoveryVisible = showSessionRecoveryModal.value;

  const canvasCallbackRef = useCallback((node: HTMLCanvasElement | null) => {
    canvasRef.current = node;
    if (node) {
      setCanvasReady(true);
    }
  }, []);

  const { startSession, resumeSession, endSession, chooseRelic, activateSnap, reset, startBossRush, endBossRush } = useGameLoop(canvasRef, canvasReady);

  // Auto-start session when recovery modal is confirmed
  useEffect(() => {
    if (savedSession && !sessionRecoveryVisible && !sessionStarting) {
      setSessionStarting(true);
      // User clicked "Continue session" - start with saved session data
      resumeSession(savedSession)
        .then((sessionInfo) => {
          if (!sessionInfo) {
            showErrorToast('Nie udało się wznowić sesji. Rozpocznij nową.');
            void onSessionResumeFailed();
            return;
          }
          onSessionResumed();
        })
        .catch(() => {
          showErrorToast('Nie udało się wznowić sesji. Rozpocznij nową.');
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
    // Get the selected fortress class and unlocked units
    const fortressClass = selectedFortressClass.value || 'natural';
    const startingHeroes = unlockedHeroIds.value;
    const startingTurrets = unlockedTurretIds.value;

    const sessionInfo = await startSession({
      fortressClass,
      startingHeroes,
      startingTurrets,
    });

    if (!sessionInfo) {
      showErrorToast('Nie udało się rozpocząć sesji. Spróbuj ponownie.');
    }
  };

  const handleUpgrade = async (target: { type: 'hero' | 'turret'; id: string | number }) => {
    try {
      if (target.type === 'hero') {
        // Find the hero and get current tier
        const isIdle = gamePhase.value === 'idle';
        const heroes = isIdle ? hubHeroes.value : activeHeroes.value;
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
          const updateHeroes = (list: typeof heroes) =>
            list.map(h => h.definitionId === target.id ? { ...h, tier: result.newTier as 1 | 2 | 3 } : h);

          if (isIdle) {
            hubHeroes.value = updateHeroes(hubHeroes.value);
          } else {
            activeHeroes.value = updateHeroes(activeHeroes.value);
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
  };

  // Boss Rush handlers
  const handleBossRushStart = async () => {
    const fortressClass = selectedFortressClass.value || 'natural';
    const startingHeroes = unlockedHeroIds.value;
    const startingTurrets = unlockedTurretIds.value;

    const sessionInfo = await startBossRush({
      fortressClass,
      startingHeroes,
      startingTurrets,
    });

    if (!sessionInfo) {
      showErrorToast('Nie udało się rozpocząć Boss Rush. Spróbuj ponownie.');
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

  return (
    <div id="game-container">
      <canvas ref={canvasCallbackRef} id="game-canvas" />

      {/* Hub overlay for clicking heroes/turrets before session */}
      <HubOverlay />

      <div id="ui-overlay">
        <Hud onSnapClick={activateSnap} />
        <Controls
          onStartClick={handleStartClick}
          onEndSessionClick={handleEndSessionClick}
          onBossRushEndClick={handleBossRushEnd}
          startDisabled={sessionStarting || sessionRecoveryVisible}
        />
        <UpgradeModal onUpgrade={handleUpgrade} />
        <TurretPlacementModal onPlace={handleTurretPlace} />
      </div>

      {/* Modals outside ui-overlay to allow full pointer interactions */}
      <ClassSelectionModal onSelect={handleClassSelect} />
      <ChoiceModal onSelect={chooseRelic} />
      <EndScreen onPlayAgain={handlePlayAgain} />
      <HeroDetailsModal onUpgrade={handleUpgrade} />
      <ConfirmModal
        visible={showEndSessionConfirm.value}
        title="Zakończ sesję"
        message="Czy na pewno chcesz zakończyć bieżącą sesję? Twój postęp z obecnego segmentu zostanie zapisany."
        confirmText="Zakończ"
        cancelText="Kontynuuj grę"
        variant="danger"
        onConfirm={handleEndSessionConfirm}
        onCancel={handleEndSessionCancel}
      />

      {/* Materials & Artifacts drop notifications */}
      <MaterialDrop />
      <ArtifactDrop />
      <MaterialsInventory />
      <IdleRewardsModal />

      {/* Artifacts system */}
      <ArtifactsModal />
      <CraftingModal />

      {/* Hero recruitment */}
      <HeroRecruitmentModal />

      {/* Boss Rush mode */}
      <BossRushSetupModal onStart={handleBossRushStart} />
      <BossRushEndScreen
        onPlayAgain={handleBossRushPlayAgain}
        onMenu={handleBossRushMenu}
      />
      <BossHealthBar />
      <BossRushHUD />
    </div>
  );
}
