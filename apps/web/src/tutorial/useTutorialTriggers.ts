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
  type TutorialStepId,
} from "../state/tutorial.signals.js";
import { getTutorialSteps } from "./tutorialSteps.js";
import { useTranslation } from "../i18n/useTranslation.js";

// Tick thresholds for tutorial triggers (at 30 ticks/second)
const WAVE_1_WELCOME_TICK = 0;
const WAVE_1_FORTRESS_TICK = 60; // 2 seconds
const WAVE_1_SKILL_TICK = 150; // 5 seconds
const WAVE_2_SPEED_TICK = 30; // 1 second
const WAVE_2_TURRET_TICK = 120; // 4 seconds
const WAVE_3_MILITIA_TICK = 60; // 2 seconds

/**
 * Ordered tutorial sequence for wave 1.
 * Each step must complete before next can show.
 */
const WAVE_1_SEQUENCE: TutorialStepId[] = [
  "welcome_intro",
  "fortress_auto_attack",
  "fortress_health",
  "gold_resource",
  "bomb_skill",
];

/**
 * Hook that monitors game state and triggers contextual tutorial tips.
 * Tutorials now pause the game and show in a strict sequence.
 * Should be called in GameContainer.
 */
export function useTutorialTriggers(): void {
  const { t } = useTranslation("game");

  // Memoize tutorial steps with current translations
  const tutorialSteps = useMemo(() => getTutorialSteps(t), [t]);

  // Track which tutorials have been triggered this session
  const triggeredThisSession = useRef<Set<TutorialStepId>>(new Set());
  const lastKillCount = useRef(0);
  const hasShownFirstKillTip = useRef(false);

  // Hub tip tracking
  const hasTriggeredFortressUpgradesTip = useRef(false);
  const hasTriggeredFortressUnlocksTip = useRef(false);
  const hasTriggeredHeroStatTip = useRef(false);
  const hasTriggeredHeroTierTip = useRef(false);
  const hasTriggeredManualTip = useRef(false);
  const hasTriggeredDragTip = useRef(false);
  const hasTriggeredRelicTip = useRef(false);
  const hasTriggeredSynergyTip = useRef(false);

  // Reset tracking when returning to idle
  useEffect(() => {
    if (gamePhase.value === "idle") {
      triggeredThisSession.current.clear();
      lastKillCount.current = 0;
      hasShownFirstKillTip.current = false;
      hasTriggeredFortressUpgradesTip.current = false;
      hasTriggeredFortressUnlocksTip.current = false;
      hasTriggeredManualTip.current = false;
      hasTriggeredDragTip.current = false;
      hasTriggeredRelicTip.current = false;
      hasTriggeredSynergyTip.current = false;
    }
  }, [gamePhase.value]);

  // Reset hero upgrade tips when closing the hero details panel
  useEffect(() => {
    if (!upgradePanelVisible.value) {
      hasTriggeredHeroStatTip.current = false;
      hasTriggeredHeroTierTip.current = false;
    }
  }, [upgradePanelVisible.value]);

  /**
   * Helper: Try to show a tutorial tip if conditions are met.
   * Returns true if tip was shown.
   */
  const tryShowTip = (stepId: TutorialStepId): boolean => {
    // Don't show if already active tip or already completed
    if (activeTutorialTip.value !== null) return false;
    if (isTipCompleted(stepId)) return false;
    if (triggeredThisSession.current.has(stepId)) return false;

    triggeredThisSession.current.add(stepId);
    showTutorialTip(tutorialSteps[stepId]);
    return true;
  };

  /**
   * Helper: Check if a step in sequence is ready to show.
   * A step is ready if all previous steps in sequence are completed.
   */
  const isSequenceReady = (stepId: TutorialStepId, sequence: TutorialStepId[]): boolean => {
    const stepIndex = sequence.indexOf(stepId);
    if (stepIndex === -1) return true; // Not in sequence, always ready

    // Check all previous steps are completed
    for (let i = 0; i < stepIndex; i++) {
      if (!isTipCompleted(sequence[i])) return false;
    }
    return true;
  };

  // ============ WAVE-BASED TRIGGERS ============

  useEffect(() => {
    const state = gameState.value;
    const phase = gamePhase.value;

    if (!state || phase !== "playing") return;

    // Don't trigger new tips if one is already showing
    if (activeTutorialTip.value !== null) return;

    const wave = state.wave;
    const tick = state.tick;
    const kills = state.kills;

    // ============ WAVE 1 SEQUENCE ============
    if (wave === 1) {
      // Step 1: Welcome intro at start
      if (tick >= WAVE_1_WELCOME_TICK && isSequenceReady("welcome_intro", WAVE_1_SEQUENCE)) {
        if (tryShowTip("welcome_intro")) return;
      }

      // Step 2: Fortress auto-attack after 2 seconds
      if (tick >= WAVE_1_FORTRESS_TICK && isSequenceReady("fortress_auto_attack", WAVE_1_SEQUENCE)) {
        if (tryShowTip("fortress_auto_attack")) return;
      }

      // Step 3: Fortress health - show after fortress tip
      if (tick >= WAVE_1_FORTRESS_TICK + 30 && isSequenceReady("fortress_health", WAVE_1_SEQUENCE)) {
        if (tryShowTip("fortress_health")) return;
      }

      // Step 4: Gold resource - after first kill
      if (kills > lastKillCount.current && !hasShownFirstKillTip.current) {
        lastKillCount.current = kills;
        if (isSequenceReady("gold_resource", WAVE_1_SEQUENCE)) {
          hasShownFirstKillTip.current = true;
          if (tryShowTip("gold_resource")) return;
        }
      }

      // Step 5: Bomb skill - after 5 seconds
      if (tick >= WAVE_1_SKILL_TICK && isSequenceReady("bomb_skill", WAVE_1_SEQUENCE)) {
        if (tryShowTip("bomb_skill")) return;
      }
    }

    // ============ WAVE 2 ============
    if (wave === 2) {
      // Speed controls
      if (tick >= WAVE_2_SPEED_TICK && !isTipCompleted("speed_controls")) {
        if (tryShowTip("speed_controls")) return;
      }

      // Turret targeting
      if (tick >= WAVE_2_TURRET_TICK && isTipCompleted("speed_controls") && !isTipCompleted("turret_targeting")) {
        if (tryShowTip("turret_targeting")) return;
      }
    }

    // ============ WAVE 3+ ============
    if (wave === 3) {
      // Militia spawn
      if (tick >= WAVE_3_MILITIA_TICK && !isTipCompleted("militia_spawn")) {
        if (tryShowTip("militia_spawn")) return;
      }
    }

    // ============ WAVE 5 END (dust resource) ============
    // This is triggered by relic selection, see below

  }, [gameState.value?.wave, gameState.value?.tick, gameState.value?.kills, gamePhase.value, tutorialSteps]);

  // ============ HUB TIPS ============

  useEffect(() => {
    if (gamePhase.value !== "idle") return;
    if (!hubInitialized.value || !selectedFortressClass.value) return;
    if (activeTutorialTip.value !== null) return;

    // Fortress upgrades tip
    if (!hasTriggeredFortressUpgradesTip.current && !isTipCompleted("fortress_upgrades")) {
      hasTriggeredFortressUpgradesTip.current = true;
      const timer = setTimeout(() => {
        if (!activeTutorialTip.value && !isTipCompleted("fortress_upgrades")) {
          showTutorialTip(tutorialSteps.fortress_upgrades);
        }
      }, 800);
      return () => clearTimeout(timer);
    }

    // Fortress unlocks tip (after fortress_upgrades completed)
    if (
      !hasTriggeredFortressUnlocksTip.current &&
      isTipCompleted("fortress_upgrades") &&
      !isTipCompleted("fortress_unlocks")
    ) {
      hasTriggeredFortressUnlocksTip.current = true;
      const timer = setTimeout(() => {
        if (!activeTutorialTip.value && !isTipCompleted("fortress_unlocks")) {
          showTutorialTip(tutorialSteps.fortress_unlocks);
        }
      }, 800);
      return () => clearTimeout(timer);
    }

    return undefined;
  }, [gamePhase.value, hubInitialized.value, selectedFortressClass.value, tutorialSteps, tutorialProgress.value]);

  // ============ MANUAL CONTROL TIP ============

  useEffect(() => {
    if (gamePhase.value !== "playing") return;
    if (!manualControlHeroId.value || hasTriggeredManualTip.current) return;
    if (activeTutorialTip.value !== null) return;

    hasTriggeredManualTip.current = true;

    if (!isTipCompleted("manual_control")) {
      showTutorialTip(tutorialSteps.manual_control);
    } else if (!isTipCompleted("hero_drag")) {
      showTutorialTip(tutorialSteps.hero_drag);
      hasTriggeredDragTip.current = true;
    }
  }, [manualControlHeroId.value, gamePhase.value, tutorialSteps]);

  // ============ HERO UPGRADE TIPS ============

  useEffect(() => {
    const target = upgradeTarget.value;
    if (!upgradePanelVisible.value || target?.type !== "hero") return;
    if (activeTutorialTip.value !== null) return;

    if (!hasTriggeredHeroStatTip.current && !isTipCompleted("hero_stat_upgrades")) {
      hasTriggeredHeroStatTip.current = true;
      const timer = setTimeout(() => {
        if (!activeTutorialTip.value && !isTipCompleted("hero_stat_upgrades")) {
          showTutorialTip(tutorialSteps.hero_stat_upgrades);
        }
      }, 400);
      return () => clearTimeout(timer);
    }

    if (
      !hasTriggeredHeroTierTip.current &&
      isTipCompleted("hero_stat_upgrades") &&
      !isTipCompleted("hero_tiers")
    ) {
      hasTriggeredHeroTierTip.current = true;
      const timer = setTimeout(() => {
        if (!activeTutorialTip.value && !isTipCompleted("hero_tiers")) {
          showTutorialTip(tutorialSteps.hero_tiers);
        }
      }, 400);
      return () => clearTimeout(timer);
    }

    return undefined;
  }, [upgradePanelVisible.value, upgradeTarget.value, tutorialSteps, tutorialProgress.value]);

  // ============ HERO DRAG TIP ============

  useEffect(() => {
    if (gamePhase.value !== "playing") return;
    if (!commandSelectedHeroId.value || hasTriggeredDragTip.current) return;
    if (activeTutorialTip.value !== null) return;

    hasTriggeredDragTip.current = true;

    if (!isTipCompleted("hero_drag")) {
      const timer = setTimeout(() => {
        if (!activeTutorialTip.value && !isTipCompleted("hero_drag")) {
          showTutorialTip(tutorialSteps.hero_drag);
        }
      }, 800);
      return () => clearTimeout(timer);
    }

    return undefined;
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

  // ============ RELIC SELECTION TRIGGER ============

  useEffect(() => {
    if (!showChoiceModal.value) {
      // Modal just closed - check for synergy tip
      if (hasTriggeredRelicTip.current && !hasTriggeredSynergyTip.current) {
        hasTriggeredSynergyTip.current = true;

        if (!isTipCompleted("build_synergy")) {
          const timer = setTimeout(() => {
            if (!activeTutorialTip.value && !isTipCompleted("build_synergy")) {
              showTutorialTip(tutorialSteps.build_synergy);
            }
          }, 2000);
          return () => clearTimeout(timer);
        }
      }
      return undefined;
    }

    // Modal is open
    if (!hasTriggeredRelicTip.current) {
      hasTriggeredRelicTip.current = true;

      if (!isTipCompleted("relic_selection")) {
        const timer = setTimeout(() => {
          if (!activeTutorialTip.value && !isTipCompleted("relic_selection")) {
            showTutorialTip(tutorialSteps.relic_selection);
          }
        }, 500);
        return () => clearTimeout(timer);
      }
    }

    // Show dust_resource tip on wave 5's first relic choice
    const state = gameState.value;
    if (state && state.wave === 5 && !isTipCompleted("dust_resource")) {
      const timer = setTimeout(() => {
        if (!activeTutorialTip.value && !isTipCompleted("dust_resource")) {
          showTutorialTip(tutorialSteps.dust_resource);
        }
      }, 1500);
      return () => clearTimeout(timer);
    }

    return undefined;
  }, [showChoiceModal.value, tutorialSteps, gameState.value?.wave]);
}
