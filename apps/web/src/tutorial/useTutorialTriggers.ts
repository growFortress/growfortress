import { useEffect, useRef, useMemo } from "preact/hooks";
import {
  gameState,
  gamePhase,
  showChoiceModal,
  manualControlHeroId,
  commandSelectedHeroId,
  hubInitialized,
  selectedFortressClass,
  upgradePanelVisible,
  upgradeTarget,
} from "../state/index.js";
import {
  showTutorialTip,
  isTipCompleted,
  activeTutorialTip,
  tutorialProgress,
} from "../state/tutorial.signals.js";
import { getTutorialSteps } from "./tutorialSteps.js";
import { useTranslation } from "../i18n/useTranslation.js";

/**
 * Hook that monitors game state and triggers contextual tutorial tips.
 * Should be called in GameContainer.
 */
export function useTutorialTriggers(): void {
  const { t } = useTranslation("game");
  
  // Memoize tutorial steps with current translations
  const tutorialSteps = useMemo(() => getTutorialSteps(t), [t]);
  
  const hasTriggeredWave1 = useRef(false);
  const hasTriggeredWave2 = useRef(false);
  const hasTriggeredRelicTip = useRef(false);
  const hasTriggeredSynergyTip = useRef(false);
  const hasTriggeredFortressUpgradesTip = useRef(false);
  const hasTriggeredFortressUnlocksTip = useRef(false);
  const hasTriggeredHeroStatTip = useRef(false);
  const hasTriggeredHeroTierTip = useRef(false);
  const hasTriggeredManualTip = useRef(false);
  const hasTriggeredDragTip = useRef(false);
  const bombSkillTimeoutRef = useRef<number | null>(null);
  const synergyTimeoutRef = useRef<number | null>(null);
  const fortressTipTimeoutRef = useRef<number | null>(null);
  const heroTipTimeoutRef = useRef<number | null>(null);

  // Reset refs when returning to idle
  useEffect(() => {
    if (gamePhase.value === "idle") {
      hasTriggeredWave1.current = false;
      hasTriggeredWave2.current = false;
      hasTriggeredRelicTip.current = false;
      hasTriggeredSynergyTip.current = false;
      hasTriggeredFortressUpgradesTip.current = false;
      hasTriggeredFortressUnlocksTip.current = false;
      hasTriggeredManualTip.current = false;
      hasTriggeredDragTip.current = false;
      if (bombSkillTimeoutRef.current) {
        clearTimeout(bombSkillTimeoutRef.current);
        bombSkillTimeoutRef.current = null;
      }
      if (synergyTimeoutRef.current) {
        clearTimeout(synergyTimeoutRef.current);
        synergyTimeoutRef.current = null;
      }
      if (fortressTipTimeoutRef.current) {
        clearTimeout(fortressTipTimeoutRef.current);
        fortressTipTimeoutRef.current = null;
      }
      if (heroTipTimeoutRef.current) {
        clearTimeout(heroTipTimeoutRef.current);
        heroTipTimeoutRef.current = null;
      }
    }
  }, [gamePhase.value]);

  // Reset hero upgrade tips when closing the hero details panel
  useEffect(() => {
    if (!upgradePanelVisible.value) {
      hasTriggeredHeroStatTip.current = false;
      hasTriggeredHeroTierTip.current = false;
      if (heroTipTimeoutRef.current) {
        clearTimeout(heroTipTimeoutRef.current);
        heroTipTimeoutRef.current = null;
      }
    }
  }, [upgradePanelVisible.value]);

  // Wave-based triggers
  useEffect(() => {
    const state = gameState.value;
    const phase = gamePhase.value;

    if (!state || phase !== "playing") return;

    const wave = state.wave;

    // Wave 1: Show fortress auto-attack tip, then bomb skill tip
    if (wave === 1 && !hasTriggeredWave1.current) {
      hasTriggeredWave1.current = true;

      if (!isTipCompleted("fortress_auto_attack")) {
        showTutorialTip(tutorialSteps.fortress_auto_attack);

        // Queue bomb skill tip after delay (when first tip dismisses or timeout)
        bombSkillTimeoutRef.current = window.setTimeout(() => {
          // Only show if no tip is currently active
          if (!activeTutorialTip.value && !isTipCompleted("bomb_skill")) {
            showTutorialTip(tutorialSteps.bomb_skill);
          }
        }, 10000); // 10 seconds after wave 1 starts
      } else if (!isTipCompleted("bomb_skill")) {
        // If fortress tip already completed, show bomb tip with shorter delay
        bombSkillTimeoutRef.current = window.setTimeout(() => {
          if (!activeTutorialTip.value && !isTipCompleted("bomb_skill")) {
            showTutorialTip(tutorialSteps.bomb_skill);
          }
        }, 3000);
      }
    }

    // Wave 2: Show speed controls tip
    if (wave === 2 && !hasTriggeredWave2.current) {
      hasTriggeredWave2.current = true;

      if (!isTipCompleted("speed_controls")) {
        // Small delay to let player settle into wave 2
        setTimeout(() => {
          if (!activeTutorialTip.value && !isTipCompleted("speed_controls")) {
            showTutorialTip(tutorialSteps.speed_controls);
          }
        }, 2000);
      }
    }
  }, [gameState.value?.wave, gamePhase.value, tutorialSteps]);

  // Hub tips: fortress upgrades and tier unlocks
  useEffect(() => {
    if (gamePhase.value !== "idle") return;
    if (!hubInitialized.value || !selectedFortressClass.value) return;

    if (!hasTriggeredFortressUpgradesTip.current && !isTipCompleted("fortress_upgrades")) {
      hasTriggeredFortressUpgradesTip.current = true;

      fortressTipTimeoutRef.current = window.setTimeout(() => {
        if (!activeTutorialTip.value && !isTipCompleted("fortress_upgrades")) {
          showTutorialTip(tutorialSteps.fortress_upgrades);
        }
      }, 800);
      return;
    }

    if (
      !hasTriggeredFortressUnlocksTip.current
      && isTipCompleted("fortress_upgrades")
      && !isTipCompleted("fortress_unlocks")
    ) {
      hasTriggeredFortressUnlocksTip.current = true;

      fortressTipTimeoutRef.current = window.setTimeout(() => {
        if (!activeTutorialTip.value && !isTipCompleted("fortress_unlocks")) {
          showTutorialTip(tutorialSteps.fortress_unlocks);
        }
      }, 800);
    }
  }, [gamePhase.value, hubInitialized.value, selectedFortressClass.value, tutorialSteps, tutorialProgress.value]);

  // Manual control tip (when player takes over a hero)
  useEffect(() => {
    if (gamePhase.value !== "playing") return;
    if (!manualControlHeroId.value || hasTriggeredManualTip.current) return;

    hasTriggeredManualTip.current = true;

    if (!isTipCompleted("manual_control") && !activeTutorialTip.value) {
      showTutorialTip(tutorialSteps.manual_control);
    } else if (!isTipCompleted("hero_drag") && !activeTutorialTip.value) {
      showTutorialTip(tutorialSteps.hero_drag);
      hasTriggeredDragTip.current = true;
    }
  }, [manualControlHeroId.value, gamePhase.value, tutorialSteps]);

  // Hero upgrade tips (when hero details modal opens)
  useEffect(() => {
    const target = upgradeTarget.value;
    if (!upgradePanelVisible.value || target?.type !== "hero") return;

    if (!hasTriggeredHeroStatTip.current && !isTipCompleted("hero_stat_upgrades")) {
      hasTriggeredHeroStatTip.current = true;

      heroTipTimeoutRef.current = window.setTimeout(() => {
        if (!activeTutorialTip.value && !isTipCompleted("hero_stat_upgrades")) {
          showTutorialTip(tutorialSteps.hero_stat_upgrades);
        }
      }, 400);
      return;
    }

    if (
      !hasTriggeredHeroTierTip.current
      && isTipCompleted("hero_stat_upgrades")
      && !isTipCompleted("hero_tiers")
    ) {
      hasTriggeredHeroTierTip.current = true;

      heroTipTimeoutRef.current = window.setTimeout(() => {
        if (!activeTutorialTip.value && !isTipCompleted("hero_tiers")) {
          showTutorialTip(tutorialSteps.hero_tiers);
        }
      }, 400);
    }
  }, [upgradePanelVisible.value, upgradeTarget.value, tutorialSteps, tutorialProgress.value]);

  // Drag tip (when selecting a hero for commands)
  useEffect(() => {
    if (gamePhase.value !== "playing") return;
    if (!commandSelectedHeroId.value || hasTriggeredDragTip.current) return;

    hasTriggeredDragTip.current = true;

    if (!isTipCompleted("hero_drag")) {
      setTimeout(() => {
        if (!activeTutorialTip.value && !isTipCompleted("hero_drag")) {
          showTutorialTip(tutorialSteps.hero_drag);
        }
      }, 800);
    }
  }, [commandSelectedHeroId.value, gamePhase.value, tutorialSteps]);

  // Drag tip after manual control was completed
  useEffect(() => {
    if (gamePhase.value !== "playing") return;
    if (hasTriggeredDragTip.current) return;
    if (!tutorialProgress.value.has("manual_control")) return;
    if (isTipCompleted("hero_drag") || activeTutorialTip.value) return;

    hasTriggeredDragTip.current = true;
    showTutorialTip(tutorialSteps.hero_drag);
  }, [tutorialProgress.value, gamePhase.value, tutorialSteps]);

  // Relic selection trigger (when choice modal opens)
  useEffect(() => {
    if (showChoiceModal.value && !hasTriggeredRelicTip.current) {
      hasTriggeredRelicTip.current = true;

      if (!isTipCompleted("relic_selection")) {
        // Small delay to let modal appear
        setTimeout(() => {
          if (!activeTutorialTip.value && !isTipCompleted("relic_selection")) {
            showTutorialTip(tutorialSteps.relic_selection);
          }
        }, 500);
      }
    }

    // Show build synergy tip after the first relic choice modal closes
    // This is a good moment because the player just made their first build decision
    if (!showChoiceModal.value && hasTriggeredRelicTip.current && !hasTriggeredSynergyTip.current) {
      hasTriggeredSynergyTip.current = true;

      if (!isTipCompleted("build_synergy")) {
        // Show synergy tip shortly after relic selection
        synergyTimeoutRef.current = window.setTimeout(() => {
          if (!activeTutorialTip.value && !isTipCompleted("build_synergy")) {
            showTutorialTip(tutorialSteps.build_synergy);
          }
        }, 2000);
      }
    }
  }, [showChoiceModal.value, tutorialSteps]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (bombSkillTimeoutRef.current) {
        clearTimeout(bombSkillTimeoutRef.current);
      }
      if (synergyTimeoutRef.current) {
        clearTimeout(synergyTimeoutRef.current);
      }
      if (fortressTipTimeoutRef.current) {
        clearTimeout(fortressTipTimeoutRef.current);
      }
      if (heroTipTimeoutRef.current) {
        clearTimeout(heroTipTimeoutRef.current);
      }
    };
  }, []);
}
