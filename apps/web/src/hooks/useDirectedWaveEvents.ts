/**
 * useDirectedWaveEvents Hook
 *
 * Processes scripted events during the directed wave 1 experience.
 * Monitors game state and triggers VFX, slow motion, and other effects.
 */

import { useEffect, useRef } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import {
  gameState,
  directedWaveActive,
  processScriptedEvents,
  initDirectedWave,
  endDirectedWave,
  onVFXBurst,
  onSynergyHighlight,
  liveSynergyPanelExpanded,
} from '../state/index.js';
import type { ScriptedEvent } from '@arcade/sim-core';

// VFX burst effect configuration
interface VFXBurstConfig {
  active: boolean;
  intensity: number;
  confetti: boolean;
  screenShake: boolean;
  startTime: number;
}

// Synergy highlight configuration
interface SynergyHighlightConfig {
  active: boolean;
  duration: number;
  pulseHUD: boolean;
  startTime: number;
}

/**
 * Hook to manage directed wave events and VFX
 *
 * @param events - Array of scripted events from DirectedWave1Config
 * @param enabled - Whether directed wave is enabled
 * @param onVFXBurstTrigger - Optional callback when VFX burst triggers
 */
export function useDirectedWaveEvents(
  events: ScriptedEvent[] | undefined,
  enabled: boolean,
  onVFXBurstTrigger?: (config: { intensity: number; confetti: boolean; screenShake: boolean }) => void
) {
  const vfxBurst = useSignal<VFXBurstConfig>({
    active: false,
    intensity: 1.0,
    confetti: false,
    screenShake: false,
    startTime: 0,
  });

  const synergyHighlight = useSignal<SynergyHighlightConfig>({
    active: false,
    duration: 2000,
    pulseHUD: false,
    startTime: 0,
  });

  const initializedRef = useRef(false);
  const lastProcessedTick = useRef(-1);

  // Initialize directed wave when enabled and events are provided
  useEffect(() => {
    if (!enabled || !events || events.length === 0) {
      if (directedWaveActive.value) {
        endDirectedWave();
      }
      initializedRef.current = false;
      return;
    }

    if (!initializedRef.current) {
      initDirectedWave(events);
      initializedRef.current = true;
    }

    return () => {
      if (directedWaveActive.value) {
        endDirectedWave();
      }
      initializedRef.current = false;
    };
  }, [enabled, events]);

  // Register VFX callbacks
  useEffect(() => {
    onVFXBurst((data) => {
      vfxBurst.value = {
        active: true,
        intensity: data.intensity,
        confetti: data.confetti ?? false,
        screenShake: data.screenShake ?? false,
        startTime: Date.now(),
      };

      // Notify external handler if provided
      if (onVFXBurstTrigger) {
        onVFXBurstTrigger({
          intensity: data.intensity,
          confetti: data.confetti ?? false,
          screenShake: data.screenShake ?? false,
        });
      }

      // Auto-clear VFX after duration
      setTimeout(() => {
        vfxBurst.value = {
          ...vfxBurst.value,
          active: false,
        };
      }, 500 * data.intensity); // Duration scales with intensity
    });

    onSynergyHighlight((data) => {
      synergyHighlight.value = {
        active: true,
        duration: data.duration,
        pulseHUD: data.pulseHUD ?? false,
        startTime: Date.now(),
      };

      // Expand synergy panel if pulseHUD is true
      if (data.pulseHUD) {
        liveSynergyPanelExpanded.value = true;
      }

      // Auto-clear after duration
      setTimeout(() => {
        synergyHighlight.value = {
          ...synergyHighlight.value,
          active: false,
        };
      }, data.duration);
    });
  }, [onVFXBurstTrigger]);

  // Process events on game state changes
  useEffect(() => {
    if (!directedWaveActive.value) return;

    const state = gameState.value;
    if (!state) return;

    // Throttle processing - only run every few ticks to avoid performance hit
    if (state.tick - lastProcessedTick.current < 5) return;
    lastProcessedTick.current = state.tick;

    // Only process during wave 1
    if (state.wave !== 1) {
      // End directed wave when wave 1 ends
      if (state.wave > 1) {
        endDirectedWave();
      }
      return;
    }

    // Pass only the fields needed for event processing
    processScriptedEvents({
      tick: state.tick,
      wave: state.wave,
      kills: state.kills,
      enemyCount: state.enemyCount,
    });
  }, [gameState.value?.tick, gameState.value?.kills, gameState.value?.enemyCount]);

  return {
    vfxBurst,
    synergyHighlight,
    isActive: directedWaveActive.value,
  };
}

/**
 * Simple hook for components that just need to know if directed wave is active
 */
export function useIsDirectedWave(): boolean {
  return directedWaveActive.value;
}
