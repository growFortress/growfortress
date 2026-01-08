
import { describe, it, expect } from 'vitest';
import {
  calculateWeaknessDamageMultiplier,
  calculateWeaknessStatPenalty,
  checkBehavioralWeaknesses
} from '../../systems.js';
import { HeroWeakness } from '../../types.js';
import { Xorshift32 } from '../../rng.js';

describe('Weakness System Verification', () => {

  const rng = new Xorshift32(12345);

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
           stat: 'damageMultiplier',
           amount: 0.7
        }
      }];

      const multiplier = calculateWeaknessStatPenalty(weaknesses, 'damageMultiplier');
      expect(multiplier).toBe(0.7);
    });

    it('should return 1.0 if stat is not penalized', () => {
       const weaknesses: HeroWeakness[] = [{
        id: 'w2',
        name: 'Weakened',
        description: '30% less damage',
        effect: {
           type: 'stat_penalty',
           stat: 'damageMultiplier',
           amount: 0.7
        }
      }];

      const multiplier = calculateWeaknessStatPenalty(weaknesses, 'attackSpeedMultiplier');
      expect(multiplier).toBe(1.0);
    });
  });

  describe('Behavioral Weakness', () => {
    it('should detect behavioral weaknesses', () => {
      const weaknesses: HeroWeakness[] = [{
        id: 'w3',
        name: 'Traitor',
        description: 'Chance to betray',
        effect: {
          type: 'behavioral',
          behavior: 'betray',
          chance: 1.0 // 100% chance for test
        }
      }];

      const result = checkBehavioralWeaknesses(weaknesses, rng);
      expect(result.isBetray).toBe(true);
    });
  });
});
