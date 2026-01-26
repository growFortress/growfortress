/**
 * Directed Wave Signals
 *
 * State management for the scripted first wave experience.
 * Tracks scripted events and triggers "wow moments" during wave 1.
 */

import { signal, computed } from '@preact/signals';
import type { ScriptedEvent } from '@arcade/sim-core';
import { triggerSlowMotion, endSlowMotion } from './time.signals.js';
import { enableSynergyShowcase, disableSynergyShowcase, liveSynergyPanelExpanded } from './synergy-tags.signals.js';

/**
 * Minimal state interface for processing scripted events
 * Compatible with GameStateSnapshot from game.signals.ts
 */
interface DirectedWaveState {
  tick: number;
  wave: number;
  kills: number;
  enemyCount: number;
  fortressHp?: number;
  fortressMaxHp?: number;
}

// ============================================================================
// DIRECTED WAVE STATE
// ============================================================================

/**
 * Whether the directed wave 1 experience is currently active
 */
export const directedWaveActive = signal(false);

/**
 * Queue of scripted events that haven't triggered yet
 */
export const scriptedEventQueue = signal<ScriptedEvent[]>([]);

/**
 * Set of event IDs that have been triggered (to prevent re-triggering)
 */
export const triggeredEventIds = signal<Set<string>>(new Set());

/**
 * The most recently triggered event (for UI reactions)
 */
export const lastTriggeredEvent = signal<ScriptedEvent | null>(null);

/**
 * Time when last event was triggered (for timing VFX)
 */
export const lastEventTriggerTime = signal(0);

// ============================================================================
// EVENT CALLBACKS
// ============================================================================

/**
 * Callback for VFX burst events
 */
export type VFXBurstCallback = (data: {
  intensity: number;
  confetti?: boolean;
  screenShake?: boolean;
}) => void;

/**
 * Callback for synergy highlight events
 */
export type SynergyHighlightCallback = (data: {
  duration: number;
  pulseHUD?: boolean;
}) => void;

/**
 * Callback for tutorial tip events
 */
export type TutorialTipCallback = (data: {
  message: string;
  position?: 'top' | 'bottom' | 'center';
}) => void;

let vfxBurstCallback: VFXBurstCallback | null = null;
let synergyHighlightCallback: SynergyHighlightCallback | null = null;
let tutorialTipCallback: TutorialTipCallback | null = null;

/**
 * Register callback for VFX burst events
 */
export function onVFXBurst(callback: VFXBurstCallback): void {
  vfxBurstCallback = callback;
}

/**
 * Register callback for synergy highlight events
 */
export function onSynergyHighlight(callback: SynergyHighlightCallback): void {
  synergyHighlightCallback = callback;
}

/**
 * Register callback for tutorial tip events
 */
export function onTutorialTip(callback: TutorialTipCallback): void {
  tutorialTipCallback = callback;
}

// ============================================================================
// COMPUTED VALUES
// ============================================================================

/**
 * Number of pending events
 */
export const pendingEventsCount = computed(() => scriptedEventQueue.value.length);

/**
 * Whether any events are pending
 */
export const hasPendingEvents = computed(() => scriptedEventQueue.value.length > 0);

// ============================================================================
// EVENT MANAGEMENT
// ============================================================================

/**
 * Initialize directed wave with scripted events
 */
export function initDirectedWave(events: ScriptedEvent[]): void {
  directedWaveActive.value = true;
  scriptedEventQueue.value = [...events];
  triggeredEventIds.value = new Set();
  lastTriggeredEvent.value = null;
  lastEventTriggerTime.value = 0;
}

/**
 * End directed wave mode
 */
export function endDirectedWave(): void {
  directedWaveActive.value = false;
  scriptedEventQueue.value = [];
  triggeredEventIds.value = new Set();
  lastTriggeredEvent.value = null;
  endSlowMotion(); // Ensure any active slow motion ends
  disableSynergyShowcase(); // Disable showcase mode when directed wave ends
}

/**
 * Check if an event should trigger based on current game state
 */
function shouldTriggerEvent(event: ScriptedEvent, state: DirectedWaveState): boolean {
  // Don't trigger if already triggered
  if (triggeredEventIds.value.has(event.id)) {
    return false;
  }

  switch (event.triggerType) {
    case 'tick':
      return state.tick >= event.triggerValue;

    case 'kill_count':
      return state.kills >= event.triggerValue;

    case 'hp_percent': {
      const fortressHp = state.fortressHp ?? 100;
      const fortressMaxHp = state.fortressMaxHp ?? 100;
      const hpPercent = (fortressHp / fortressMaxHp) * 100;
      return hpPercent <= event.triggerValue;
    }

    case 'enemies_remaining':
      return state.enemyCount <= event.triggerValue && state.enemyCount > 0;

    default:
      return false;
  }
}

/**
 * Execute a scripted event
 */
function executeEvent(event: ScriptedEvent, currentTick: number): void {
  // Mark as triggered
  const newTriggered = new Set(triggeredEventIds.value);
  newTriggered.add(event.id);
  triggeredEventIds.value = newTriggered;

  // Update last triggered
  lastTriggeredEvent.value = event;
  lastEventTriggerTime.value = Date.now();

  // Execute based on event type
  switch (event.event) {
    case 'vfx_burst':
      if (vfxBurstCallback && event.data) {
        vfxBurstCallback({
          intensity: event.data.intensity ?? 1.0,
          confetti: event.data.confetti ?? false,
          screenShake: event.data.screenShake ?? false,
        });
      }
      break;

    case 'synergy_highlight':
      if (event.data) {
        const duration = event.data.duration ?? 2000;

        // Enable showcase mode for synergy highlight
        enableSynergyShowcase();

        // Also expand the panel
        liveSynergyPanelExpanded.value = true;

        // Auto-disable after duration
        setTimeout(() => {
          disableSynergyShowcase();
        }, duration);

        // Notify callback if registered
        if (synergyHighlightCallback) {
          synergyHighlightCallback({
            duration,
            pulseHUD: event.data.pulseHUD ?? false,
          });
        }
      }
      break;

    case 'tutorial_tip':
      if (tutorialTipCallback && event.data) {
        // Tutorial tips use tipId to identify the tip to show
        const tipData = event.data as { tipId?: string; message?: string; position?: 'top' | 'bottom' | 'center' };
        tutorialTipCallback({
          message: tipData.message ?? tipData.tipId ?? '',
          position: tipData.position ?? 'bottom',
        });
      }
      break;

    case 'slow_motion':
      if (event.data) {
        const duration = event.data.duration ?? 45; // ~1.5s default
        const factor = event.data.factor ?? 0.3; // 30% speed default
        triggerSlowMotion(duration, factor, currentTick);
      }
      break;
  }
}

/**
 * Process scripted events based on current game state
 * Call this every tick (or every few ticks) to check and trigger events
 */
export function processScriptedEvents(state: DirectedWaveState): void {
  if (!directedWaveActive.value) return;
  if (state.wave !== 1) return; // Only process during wave 1

  const events = scriptedEventQueue.value;
  const eventsToTrigger: ScriptedEvent[] = [];

  for (const event of events) {
    if (shouldTriggerEvent(event, state)) {
      eventsToTrigger.push(event);
    }
  }

  // Execute triggered events
  for (const event of eventsToTrigger) {
    executeEvent(event, state.tick);
  }

  // Remove triggered events from queue
  if (eventsToTrigger.length > 0) {
    scriptedEventQueue.value = events.filter(
      (e) => !eventsToTrigger.some((t) => t.id === e.id)
    );
  }
}

/**
 * Reset all directed wave state
 */
export function resetDirectedWaveState(): void {
  directedWaveActive.value = false;
  scriptedEventQueue.value = [];
  triggeredEventIds.value = new Set();
  lastTriggeredEvent.value = null;
  lastEventTriggerTime.value = 0;
  endSlowMotion();
  disableSynergyShowcase();
}
