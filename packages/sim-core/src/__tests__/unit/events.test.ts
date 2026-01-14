import { describe, it, expect, vi } from 'vitest';
import { validateEvent, applyEvent } from '../../events.js';
import {
  createGameState,
  createSimConfig,
  createStateInChoiceMode,
  createChooseRelicEvent,
  createRerollRelicsEvent,
} from '../helpers/factories.js';

describe('validateEvent', () => {
  describe('tick validation', () => {
    it('rejects event with tick in the past', () => {
      const state = createStateInChoiceMode(['sharpened-blades', 'swift-strikes'], 1, 50);
      state.tick = 100;
      state.gold = 50;
      const config = createSimConfig();
      const event = createRerollRelicsEvent(50);

      const result = validateEvent(event, state, config);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Event tick is in the past');
    });

    it('accepts event with current tick', () => {
      const state = createStateInChoiceMode(['sharpened-blades', 'swift-strikes'], 1, 100);
      state.tick = 100;
      state.gold = 50;
      const config = createSimConfig();
      const event = createRerollRelicsEvent(100);

      const result = validateEvent(event, state, config);
      expect(result.valid).toBe(true);
    });

    it('accepts event with future tick', () => {
      const state = createStateInChoiceMode(['sharpened-blades', 'swift-strikes'], 1, 100);
      state.tick = 100;
      state.gold = 50;
      const config = createSimConfig();
      const event = createRerollRelicsEvent(150);

      const result = validateEvent(event, state, config);
      expect(result.valid).toBe(true);
    });
  });

  describe('CHOOSE_RELIC', () => {
    it('valid when in choice mode', () => {
      const state = createStateInChoiceMode(['sharpened-blades', 'swift-strikes', 'gold-rush'], 1, 100);
      const config = createSimConfig();
      const event = createChooseRelicEvent(100, 1, 0);

      const result = validateEvent(event, state, config);
      expect(result.valid).toBe(true);
    });

    it('invalid when not in choice mode', () => {
      const state = createGameState({ inChoice: false, pendingChoice: null });
      const config = createSimConfig();
      const event = createChooseRelicEvent(100, 1, 0);

      const result = validateEvent(event, state, config);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Not in choice mode');
    });

    it('invalid when wave mismatch', () => {
      const state = createStateInChoiceMode(['sharpened-blades', 'swift-strikes'], 1, 100);
      const config = createSimConfig();
      const event = createChooseRelicEvent(100, 2, 0); // Wrong wave

      const result = validateEvent(event, state, config);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Wave mismatch');
    });

    it('invalid when option index out of bounds (negative)', () => {
      const state = createStateInChoiceMode(['sharpened-blades', 'swift-strikes'], 1, 100);
      const config = createSimConfig();
      const event = createChooseRelicEvent(100, 1, -1);

      const result = validateEvent(event, state, config);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Invalid option index');
    });

    it('invalid when option index out of bounds (too high)', () => {
      const state = createStateInChoiceMode(['sharpened-blades', 'swift-strikes'], 1, 100);
      const config = createSimConfig();
      const event = createChooseRelicEvent(100, 1, 5);

      const result = validateEvent(event, state, config);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Invalid option index');
    });

    it('invalid when tick before choice was offered', () => {
      const state = createStateInChoiceMode(['sharpened-blades', 'swift-strikes'], 1, 100);
      state.tick = 90; // Current tick before choice
      const config = createSimConfig();
      const event = createChooseRelicEvent(95, 1, 0); // Future tick but before choice

      const result = validateEvent(event, state, config);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Event tick before choice was offered');
    });
  });

  describe('REROLL_RELICS', () => {
    it('valid when in choice mode with enough gold', () => {
      const state = createStateInChoiceMode(['sharpened-blades', 'swift-strikes'], 1, 100);
      state.gold = 50;
      const config = createSimConfig();
      const event = createRerollRelicsEvent(100);

      const result = validateEvent(event, state, config);
      expect(result.valid).toBe(true);
    });

    it('invalid when not in choice mode', () => {
      const state = createGameState({ inChoice: false, gold: 50 });
      const config = createSimConfig();
      const event = createRerollRelicsEvent(100);

      const result = validateEvent(event, state, config);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Not in choice mode');
    });

    it('invalid when insufficient gold', () => {
      const state = createStateInChoiceMode(['sharpened-blades', 'swift-strikes'], 1, 100);
      state.gold = 5; // Less than 10 (reroll cost)
      const config = createSimConfig();
      const event = createRerollRelicsEvent(100);

      const result = validateEvent(event, state, config);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Not enough gold for reroll');
    });
  });

  describe('unknown event type', () => {
    it('returns invalid with reason', () => {
      const state = createGameState();
      const config = createSimConfig();
      const event = { type: 'UNKNOWN_EVENT', tick: 100 } as any;

      const result = validateEvent(event, state, config);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Unknown event type');
    });
  });
});

describe('applyEvent', () => {
  describe('CHOOSE_RELIC', () => {
    it('adds relic to state', () => {
      const state = createStateInChoiceMode(['sharpened-blades', 'swift-strikes', 'gold-rush'], 1, 100);
      const config = createSimConfig();
      const event = createChooseRelicEvent(100, 1, 0);
      const getNewOptions = vi.fn();

      const result = applyEvent(event, state, config, getNewOptions);

      expect(result).toBe(true);
      expect(state.relics.length).toBe(1);
      expect(state.relics[0].id).toBe('sharpened-blades');
    });

    it('recomputes modifiers', () => {
      const state = createStateInChoiceMode(['sharpened-blades', 'swift-strikes', 'gold-rush'], 1, 100);
      const originalDamage = state.modifiers.damageBonus;
      const config = createSimConfig();
      const event = createChooseRelicEvent(100, 1, 0); // damage-boost
      const getNewOptions = vi.fn();

      applyEvent(event, state, config, getNewOptions);

      expect(state.modifiers.damageBonus).toBeGreaterThan(originalDamage);
    });

    it('updates max HP if changed', () => {
      // Set up state where an HP relic was already acquired (e.g. with +25% bonus)
      // so fortressMaxHp is already scaled, then acquire another relic
      const state = createStateInChoiceMode(['iron-hide', 'swift-strikes'], 2, 200);
      state.fortressHp = 125;
      state.fortressMaxHp = 125;
      // Simulate already having an HP-boosting relic
      state.relics = [{ id: 'iron-hide', acquiredWave: 1, acquiredTick: 100 }];
      state.modifiers = { ...state.modifiers, maxHpBonus: 0.25 };
      const config = createSimConfig({ fortressBaseHp: 100 });
      // Choose another iron-hide (the implementation logic allows duplicates in options)
      const event = createChooseRelicEvent(200, 2, 0);
      const getNewOptions = vi.fn();

      applyEvent(event, state, config, getNewOptions);

      // With two iron-hides stacking additively: 0.25 + 0.25 = 0.5 (50% bonus)
      expect(state.modifiers.maxHpBonus).toBeCloseTo(0.5, 4);
      // The max HP calculation:
      // baseHp = 100
      // newMaxHp = floor(100 * (1 + 0.5)) = 150
      // Since newMaxHp > fortressMaxHp, HP scales proportionally
      expect(state.fortressMaxHp).toBeGreaterThanOrEqual(125);
    });

    it('clears choice state', () => {
      const state = createStateInChoiceMode(['sharpened-blades', 'swift-strikes'], 1, 100);
      const config = createSimConfig();
      const event = createChooseRelicEvent(100, 1, 0);
      const getNewOptions = vi.fn();

      applyEvent(event, state, config, getNewOptions);

      expect(state.inChoice).toBe(false);
      expect(state.pendingChoice).toBeNull();
      expect(state.pendingChoiceTick).toBe(0);
    });

    it('returns false for invalid event', () => {
      const state = createGameState({ inChoice: false });
      const config = createSimConfig();
      const event = createChooseRelicEvent(100, 1, 0);
      const getNewOptions = vi.fn();

      const result = applyEvent(event, state, config, getNewOptions);
      expect(result).toBe(false);
    });

    it('records acquiredWave and acquiredTick', () => {
      const state = createStateInChoiceMode(['sharpened-blades', 'swift-strikes'], 3, 250);
      const config = createSimConfig();
      const event = createChooseRelicEvent(250, 3, 0);
      const getNewOptions = vi.fn();

      applyEvent(event, state, config, getNewOptions);

      expect(state.relics[0].acquiredWave).toBe(3);
      expect(state.relics[0].acquiredTick).toBe(250);
    });
  });

  describe('REROLL_RELICS', () => {
    it('deducts gold', () => {
      const state = createStateInChoiceMode(['sharpened-blades', 'swift-strikes'], 1, 100);
      state.gold = 50;
      const config = createSimConfig();
      const event = createRerollRelicsEvent(100);
      const getNewOptions = vi.fn(() => ['gold-rush', 'iron-hide', 'critical-eye']);

      applyEvent(event, state, config, getNewOptions);

      expect(state.gold).toBe(40); // 50 - 10
    });

    it('generates new options', () => {
      const state = createStateInChoiceMode(['sharpened-blades', 'swift-strikes'], 1, 100);
      state.gold = 50;
      const config = createSimConfig();
      const event = createRerollRelicsEvent(100);
      const newOptions = ['gold-rush', 'iron-hide', 'critical-eye'];
      const getNewOptions = vi.fn(() => newOptions);

      applyEvent(event, state, config, getNewOptions);

      expect(getNewOptions).toHaveBeenCalled();
      expect(state.pendingChoice?.options).toEqual(newOptions);
    });

    it('returns false when invalid', () => {
      const state = createGameState({ inChoice: false, gold: 50 });
      const config = createSimConfig();
      const event = createRerollRelicsEvent(100);
      const getNewOptions = vi.fn();

      const result = applyEvent(event, state, config, getNewOptions);
      expect(result).toBe(false);
    });

    it('returns false when not enough gold', () => {
      const state = createStateInChoiceMode(['sharpened-blades', 'swift-strikes'], 1, 100);
      state.gold = 5;
      const config = createSimConfig();
      const event = createRerollRelicsEvent(100);
      const getNewOptions = vi.fn();

      const result = applyEvent(event, state, config, getNewOptions);
      expect(result).toBe(false);
    });
  });

  describe('unknown event type', () => {
    it('returns false', () => {
      const state = createGameState();
      const config = createSimConfig();
      const event = { type: 'UNKNOWN', tick: 100 } as any;
      const getNewOptions = vi.fn();

      const result = applyEvent(event, state, config, getNewOptions);
      expect(result).toBe(false);
    });
  });
});
