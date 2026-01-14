
import { describe, it, expect } from 'vitest';
import {
  calculateWeaknessDamageMultiplier,
  calculateWeaknessStatPenalty,
  checkBehavioralWeaknesses
} from '../../systems.js';
import { HeroWeakness } from '../../types.js';

describe('Weakness System Verification', () => {

  describe('Damage Vulnerability', () => {
    it('should multiply damage correctly when vulnerability matches', () => {
      const weaknesses: HeroWeakness[] = [{
        id: 'w1',
        name: 'Fire Vulnerability',
        description: 'Takes 50% more fire damage',
        effect: {
          type: 'damage_vulnerability',
          damageClass: 'fire',
          multiplier: 1.5
        }
      }];

      const multiplier = calculateWeaknessDamageMultiplier(weaknesses, 'fire');
      expect(multiplier).toBe(1.5);
    });

    it('should NOT multiply damage when vulnerability class does not match', () => {
      const weaknesses: HeroWeakness[] = [{
        id: 'w1',
        name: 'Fire Vulnerability',
        description: 'Takes 50% more fire damage',
        effect: {
          type: 'damage_vulnerability',
          damageClass: 'fire',
          multiplier: 1.5
        }
      }];

      const multiplier = calculateWeaknessDamageMultiplier(weaknesses, 'ice');
      expect(multiplier).toBe(1.0);
    });
  });

  describe('Stat Penalty', () => {
    it('should apply stat penalty correctly', () => {
       const weaknesses: HeroWeakness[] = [{
        id: 'w2',
        name: 'Weakened',
        description: '30% less damage',
        effect: {
           type: 'stat_penalty',
           stat: 'damageBonus',
           amount: 0.7
        }
      }];

      const multiplier = calculateWeaknessStatPenalty(weaknesses, 'damageBonus');
      expect(multiplier).toBe(0.7);
    });

    it('should return 1.0 if stat is not penalized', () => {
       const weaknesses: HeroWeakness[] = [{
        id: 'w2',
        name: 'Weakened',
        description: '30% less damage',
        effect: {
           type: 'stat_penalty',
           stat: 'damageBonus',
           amount: 0.7
        }
      }];

      const multiplier = calculateWeaknessStatPenalty(weaknesses, 'attackSpeedBonus');
      expect(multiplier).toBe(1.0);
    });
  });

  describe('Behavioral Weakness', () => {
    it('should detect no_killing_blow behavioral weakness', () => {
      const weaknesses: HeroWeakness[] = [{
        id: 'w3',
        name: 'Merciful',
        description: 'Cannot deliver killing blows',
        effect: {
          type: 'behavioral',
          behavior: 'no_killing_blow'
        }
      }];

      const result = checkBehavioralWeaknesses(weaknesses);
      expect(result.noKillingBlow).toBe(true);
    });

    it('should detect random_target behavioral weakness', () => {
      const weaknesses: HeroWeakness[] = [{
        id: 'w4',
        name: 'Confused',
        description: 'Attacks random targets',
        effect: {
          type: 'behavioral',
          behavior: 'random_target'
        }
      }];

      const result = checkBehavioralWeaknesses(weaknesses);
      expect(result.randomTarget).toBe(true);
    });
  });
});
