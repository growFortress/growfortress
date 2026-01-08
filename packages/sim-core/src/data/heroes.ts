/**
 * Hero Definitions (Simplified)
 * 6 Heroes with 3 tiers each, 2 skills per tier, 1 weakness
 */

import type { HeroDefinition, HeroTier } from '../types.js';
import { FP } from '../fixed.js';

// ============================================================================
// HERO 1: THUNDERLORD (Thor - Lightning/DPS)
// ============================================================================

const THUNDERLORD: HeroDefinition = {
  id: 'thunderlord',
  name: 'Thunderlord',
  marvelInspiration: 'Thor',
  class: 'lightning',
  role: 'dps',
  rarity: 'starter',
  baseStats: {
    hp: 150,
    damage: 25,
    attackSpeed: 1.2,
    range: FP.fromInt(6),
    moveSpeed: FP.fromFloat(0.08),
    deployCooldown: 300
  },
  colors: { primary: 0x4169e1, secondary: 0x87ceeb, glow: 0xffff00 },
  shape: 'hexagon',
  weaknesses: [
    {
      id: 'fire_vulnerability',
      name: 'Wrażliwość na Ogień',
      description: '+25% otrzymywanych obrażeń od Fire',
      effect: { type: 'damage_vulnerability', damageClass: 'fire', multiplier: 1.25 }
    }
  ],
  tiers: [
    {
      tier: 1,
      name: 'Thunderlord',
      statMultiplier: 1.0,
      skills: [
        {
          id: 'hammer_throw',
          name: 'Rzut Młotem',
          description: 'Rzuca młotem zadając obrażenia',
          cooldownTicks: 180,
          isPassive: false,
          isUltimate: false,
          unlockedAtLevel: 5,
          effects: [{ type: 'damage', amount: 40, target: 'single' }]
        },
        {
          id: 'storm_passive',
          name: 'Syn Burzy',
          description: '+15% chain damage',
          cooldownTicks: 0,
          isPassive: true,
          isUltimate: false,
          unlockedAtLevel: 1,
          effects: []
        }
      ],
      visualChanges: { sizeMultiplier: 1.0, glowIntensity: 0.3, particleEffects: [] },
      unlockRequirements: { level: 1, gold: 0, dust: 0 }
    },
    {
      tier: 2,
      name: 'God of Thunder',
      statMultiplier: 1.5,
      skills: [
        {
          id: 'mjolnir',
          name: 'Mjolnir',
          description: 'Potężniejszy rzut z łańcuchem błyskawic',
          cooldownTicks: 150,
          isPassive: false,
          isUltimate: false,
          unlockedAtLevel: 10,
          effects: [{ type: 'damage', amount: 60, target: 'single' }]
        },
        {
          id: 'storm_lord',
          name: 'Władca Burz',
          description: '+30% chain damage, +10% chain chance',
          cooldownTicks: 0,
          isPassive: true,
          isUltimate: false,
          unlockedAtLevel: 10,
          effects: []
        }
      ],
      visualChanges: { sizeMultiplier: 1.2, glowIntensity: 0.5, particleEffects: ['lightning_sparks'] },
      unlockRequirements: { level: 10, gold: 500, dust: 50 }
    },
    {
      tier: 3,
      name: 'Rune King',
      statMultiplier: 2.0,
      skills: [
        {
          id: 'stormbreaker',
          name: 'Stormbreaker',
          description: 'Ultimate throwing weapon',
          cooldownTicks: 120,
          isPassive: false,
          isUltimate: false,
          unlockedAtLevel: 20,
          effects: [{ type: 'damage', amount: 100, target: 'single' }]
        },
        {
          id: 'godblast',
          name: 'Godblast',
          description: 'ULTIMATE: Massive AOE lightning destruction',
          cooldownTicks: 900,
          isPassive: false,
          isUltimate: true,
          unlockedAtLevel: 25,
          effects: [
            { type: 'damage', amount: 200, target: 'all' },
            { type: 'stun', duration: 90 }
          ]
        }
      ],
      visualChanges: {
        sizeMultiplier: 1.4,
        glowIntensity: 0.8,
        particleEffects: ['lightning_sparks', 'rune_glow'],
        colorShift: 0xffd700
      },
      unlockRequirements: { level: 20, gold: 2000, dust: 200, material: 'uru' }
    }
  ]
};

// ============================================================================
// HERO 2: IRON SENTINEL (Iron Man - Tech/DPS)
// ============================================================================

const IRON_SENTINEL: HeroDefinition = {
  id: 'iron_sentinel',
  name: 'Iron Sentinel',
  marvelInspiration: 'Iron Man',
  class: 'tech',
  role: 'dps',
  rarity: 'common',
  baseStats: {
    hp: 120,
    damage: 30,
    attackSpeed: 1.5,
    range: FP.fromInt(8),
    moveSpeed: FP.fromFloat(0.1),
    deployCooldown: 240
  },
  colors: { primary: 0xb22222, secondary: 0xffd700, glow: 0x00ffff },
  shape: 'square',
  weaknesses: [
    {
      id: 'emp_vulnerability',
      name: 'Wrażliwość na EMP',
      description: 'Lightning zadaje +30% DMG',
      effect: { type: 'damage_vulnerability', damageClass: 'lightning', multiplier: 1.3 }
    }
  ],
  tiers: [
    {
      tier: 1,
      name: 'Mark I',
      statMultiplier: 1.0,
      skills: [
        {
          id: 'repulsor',
          name: 'Repulsor',
          description: 'Strzał repulsorem',
          cooldownTicks: 90,
          isPassive: false,
          isUltimate: false,
          unlockedAtLevel: 5,
          effects: [{ type: 'damage', amount: 25, target: 'single' }]
        },
        {
          id: 'flight',
          name: 'Lot',
          description: '+20% movement speed',
          cooldownTicks: 0,
          isPassive: true,
          isUltimate: false,
          unlockedAtLevel: 1,
          effects: []
        }
      ],
      visualChanges: { sizeMultiplier: 1.0, glowIntensity: 0.2, particleEffects: [] },
      unlockRequirements: { level: 1, gold: 0, dust: 0 }
    },
    {
      tier: 2,
      name: 'War Machine',
      statMultiplier: 1.5,
      skills: [
        {
          id: 'missile_barrage',
          name: 'Salwa Rakietowa',
          description: 'Wiele rakiet w obszarze',
          cooldownTicks: 240,
          isPassive: false,
          isUltimate: false,
          unlockedAtLevel: 10,
          effects: [{ type: 'damage', amount: 40, target: 'area' }]
        },
        {
          id: 'targeting_system',
          name: 'System Celowania',
          description: '+20% crit chance',
          cooldownTicks: 0,
          isPassive: true,
          isUltimate: false,
          unlockedAtLevel: 10,
          effects: []
        }
      ],
      visualChanges: { sizeMultiplier: 1.3, glowIntensity: 0.4, particleEffects: ['jet_flames'] },
      unlockRequirements: { level: 10, gold: 500, dust: 50 }
    },
    {
      tier: 3,
      name: 'Bleeding Edge',
      statMultiplier: 2.0,
      skills: [
        {
          id: 'nano_swarm',
          name: 'Rój Nanorobotów',
          description: 'Adaptacyjne nano-bronie',
          cooldownTicks: 180,
          isPassive: false,
          isUltimate: false,
          unlockedAtLevel: 20,
          effects: [
            { type: 'damage', amount: 60, target: 'area' },
            { type: 'heal', amount: 20 }
          ]
        },
        {
          id: 'proton_cannon',
          name: 'Proton Cannon',
          description: 'ULTIMATE: Ogromny promień energii',
          cooldownTicks: 720,
          isPassive: false,
          isUltimate: true,
          unlockedAtLevel: 25,
          effects: [{ type: 'damage', amount: 300, target: 'area' }]
        }
      ],
      visualChanges: {
        sizeMultiplier: 1.2,
        glowIntensity: 1.0,
        particleEffects: ['nano_particles', 'arc_glow'],
        colorShift: 0x00ffff
      },
      unlockRequirements: { level: 20, gold: 2000, dust: 200, material: 'extremis' }
    }
  ]
};

// ============================================================================
// HERO 3: JADE TITAN (Hulk - Natural/Tank)
// ============================================================================

const JADE_TITAN: HeroDefinition = {
  id: 'jade_titan',
  name: 'Jade Titan',
  marvelInspiration: 'Hulk',
  class: 'natural',
  role: 'tank',
  rarity: 'rare',
  baseStats: {
    hp: 300,
    damage: 35,
    attackSpeed: 0.7,
    range: FP.fromInt(3),
    moveSpeed: FP.fromFloat(0.06),
    deployCooldown: 360
  },
  colors: { primary: 0x228b22, secondary: 0x32cd32, glow: 0x7fff00 },
  shape: 'square',
  weaknesses: [
    {
      id: 'cc_vulnerable',
      name: 'Podatny na Kontrolę',
      description: 'Stun/Freeze trwa 50% dłużej',
      effect: { type: 'conditional', condition: 'cc_applied', effect: '+50% cc_duration' }
    }
  ],
  tiers: [
    {
      tier: 1,
      name: 'Jade Titan',
      statMultiplier: 1.0,
      skills: [
        {
          id: 'smash',
          name: 'Roztrzaskanie',
          description: 'Potężne uderzenie w ziemię',
          cooldownTicks: 240,
          isPassive: false,
          isUltimate: false,
          unlockedAtLevel: 5,
          effects: [
            { type: 'damage', amount: 50, target: 'area' },
            { type: 'stun', duration: 45 }
          ]
        },
        {
          id: 'rage',
          name: 'Furia',
          description: 'Damage scales with missing HP',
          cooldownTicks: 0,
          isPassive: true,
          isUltimate: false,
          unlockedAtLevel: 1,
          effects: []
        }
      ],
      visualChanges: { sizeMultiplier: 1.3, glowIntensity: 0.2, particleEffects: [] },
      unlockRequirements: { level: 1, gold: 0, dust: 0 }
    },
    {
      tier: 2,
      name: 'World Breaker',
      statMultiplier: 1.6,
      skills: [
        {
          id: 'worldbreaker_stomp',
          name: 'Stomp',
          description: 'Trzęsienie ziemi',
          cooldownTicks: 300,
          isPassive: false,
          isUltimate: false,
          unlockedAtLevel: 10,
          effects: [
            { type: 'damage', amount: 80, target: 'all' },
            { type: 'slow', percent: 40, duration: 120 }
          ]
        },
        {
          id: 'unlimited_rage',
          name: 'Nieograniczona Furia',
          description: '+100% damage below 30% HP',
          cooldownTicks: 0,
          isPassive: true,
          isUltimate: false,
          unlockedAtLevel: 10,
          effects: []
        }
      ],
      visualChanges: { sizeMultiplier: 1.6, glowIntensity: 0.5, particleEffects: ['ground_cracks'] },
      unlockRequirements: { level: 10, gold: 500, dust: 50 }
    },
    {
      tier: 3,
      name: 'Immortal Jade',
      statMultiplier: 2.2,
      skills: [
        {
          id: 'gamma_burst',
          name: 'Gamma Burst',
          description: 'Eksplozja promieniowania',
          cooldownTicks: 360,
          isPassive: false,
          isUltimate: false,
          unlockedAtLevel: 20,
          effects: [{ type: 'damage', amount: 120, target: 'area' }]
        },
        {
          id: 'worldbreaker_ultimate',
          name: 'Worldbreaker',
          description: 'ULTIMATE: Niszczy wszystko',
          cooldownTicks: 900,
          isPassive: false,
          isUltimate: true,
          unlockedAtLevel: 25,
          effects: [
            { type: 'damage', amount: 250, target: 'all' },
            { type: 'stun', duration: 120 }
          ]
        }
      ],
      visualChanges: {
        sizeMultiplier: 2.0,
        glowIntensity: 0.9,
        particleEffects: ['gamma_radiation', 'ground_cracks'],
        colorShift: 0x00ff00
      },
      unlockRequirements: { level: 20, gold: 2000, dust: 200, material: 'super_soldier_serum' }
    }
  ]
};

// ============================================================================
// HERO 4: SHIELD CAPTAIN (Captain America - Natural/Tank)
// ============================================================================

const SHIELD_CAPTAIN: HeroDefinition = {
  id: 'shield_captain',
  name: 'Shield Captain',
  marvelInspiration: 'Captain America',
  class: 'natural',
  role: 'tank',
  rarity: 'starter',
  baseStats: {
    hp: 200,
    damage: 18,
    attackSpeed: 1.0,
    range: FP.fromInt(5),
    moveSpeed: FP.fromFloat(0.09),
    deployCooldown: 270
  },
  colors: { primary: 0x4169e1, secondary: 0xdc143c, glow: 0xf0f0f0 },
  shape: 'circle',
  weaknesses: [
    {
      id: 'only_human',
      name: 'Tylko Człowiek',
      description: 'Brak odporności na kosmiczne energie',
      effect: { type: 'damage_vulnerability', damageClass: 'lightning', multiplier: 1.2 }
    }
  ],
  tiers: [
    {
      tier: 1,
      name: 'Shield Captain',
      statMultiplier: 1.0,
      skills: [
        {
          id: 'shield_throw',
          name: 'Rzut Tarczą',
          description: 'Bouncing shield attack',
          cooldownTicks: 150,
          isPassive: false,
          isUltimate: false,
          unlockedAtLevel: 5,
          effects: [{ type: 'damage', amount: 30, target: 'area' }]
        },
        {
          id: 'inspire',
          name: 'Inspiracja',
          description: '+10% damage to allies',
          cooldownTicks: 0,
          isPassive: true,
          isUltimate: false,
          unlockedAtLevel: 1,
          effects: []
        }
      ],
      visualChanges: { sizeMultiplier: 1.0, glowIntensity: 0.3, particleEffects: [] },
      unlockRequirements: { level: 1, gold: 0, dust: 0 }
    },
    {
      tier: 2,
      name: 'Nomad',
      statMultiplier: 1.4,
      skills: [
        {
          id: 'dual_shields',
          name: 'Podwójne Tarcze',
          description: 'Two shield throw',
          cooldownTicks: 180,
          isPassive: false,
          isUltimate: false,
          unlockedAtLevel: 10,
          effects: [{ type: 'damage', amount: 45, target: 'area' }]
        },
        {
          id: 'veteran',
          name: 'Weteran',
          description: '+25% damage reduction',
          cooldownTicks: 0,
          isPassive: true,
          isUltimate: false,
          unlockedAtLevel: 10,
          effects: []
        }
      ],
      visualChanges: {
        sizeMultiplier: 1.1,
        glowIntensity: 0.4,
        particleEffects: ['stars'],
        colorShift: 0x2f2f2f
      },
      unlockRequirements: { level: 10, gold: 500, dust: 50 }
    },
    {
      tier: 3,
      name: 'Worthy',
      statMultiplier: 1.8,
      skills: [
        {
          id: 'mjolnir_cap',
          name: 'Mjolnir',
          description: 'Wields the hammer',
          cooldownTicks: 240,
          isPassive: false,
          isUltimate: false,
          unlockedAtLevel: 20,
          effects: [
            { type: 'damage', amount: 80, target: 'area' },
            { type: 'stun', duration: 60 }
          ]
        },
        {
          id: 'assemble',
          name: 'Avengers Assemble',
          description: 'ULTIMATE: Buffs all heroes significantly',
          cooldownTicks: 900,
          isPassive: false,
          isUltimate: true,
          unlockedAtLevel: 25,
          effects: [{ type: 'buff', stat: 'damageMultiplier', amount: 1.5, duration: 300 }]
        }
      ],
      visualChanges: {
        sizeMultiplier: 1.2,
        glowIntensity: 0.9,
        particleEffects: ['lightning_sparks', 'stars'],
        colorShift: 0xffd700
      },
      unlockRequirements: { level: 20, gold: 2000, dust: 200, material: 'vibranium' }
    }
  ]
};

// ============================================================================
// HERO 5: SCARLET MAGE (Scarlet Witch - Magic/Support)
// ============================================================================

const SCARLET_MAGE: HeroDefinition = {
  id: 'scarlet_mage',
  name: 'Scarlet Mage',
  marvelInspiration: 'Scarlet Witch',
  class: 'fire',
  role: 'support',
  rarity: 'starter',
  baseStats: {
    hp: 90,
    damage: 35,
    attackSpeed: 0.8,
    range: FP.fromInt(10),
    moveSpeed: FP.fromFloat(0.07),
    deployCooldown: 300
  },
  colors: { primary: 0xdc143c, secondary: 0x8b0000, glow: 0xff69b4 },
  shape: 'star',
  weaknesses: [
    {
      id: 'fragile_psyche',
      name: 'Krucha Psychika',
      description: 'Stun zadaje dodatkowe obrażenia',
      effect: { type: 'conditional', condition: 'stunned', effect: '+50% damage taken' }
    }
  ],
  tiers: [
    {
      tier: 1,
      name: 'Scarlet Mage',
      statMultiplier: 1.0,
      skills: [
        {
          id: 'hex_bolt',
          name: 'Hex Bolt',
          description: 'Chaos magic projectile',
          cooldownTicks: 120,
          isPassive: false,
          isUltimate: false,
          unlockedAtLevel: 5,
          effects: [{ type: 'damage', amount: 40, target: 'single' }]
        },
        {
          id: 'probability',
          name: 'Probability Manipulation',
          description: '+15% luck',
          cooldownTicks: 0,
          isPassive: true,
          isUltimate: false,
          unlockedAtLevel: 1,
          effects: []
        }
      ],
      visualChanges: { sizeMultiplier: 0.9, glowIntensity: 0.4, particleEffects: ['chaos_particles'] },
      unlockRequirements: { level: 1, gold: 0, dust: 0 }
    },
    {
      tier: 2,
      name: 'Chaos Witch',
      statMultiplier: 1.5,
      skills: [
        {
          id: 'chaos_wave',
          name: 'Fala Chaosu',
          description: 'AOE chaos damage',
          cooldownTicks: 180,
          isPassive: false,
          isUltimate: false,
          unlockedAtLevel: 10,
          effects: [{ type: 'damage', amount: 60, target: 'area' }]
        },
        {
          id: 'reality_warp',
          name: 'Reality Warp',
          description: 'Random buffs/debuffs',
          cooldownTicks: 0,
          isPassive: true,
          isUltimate: false,
          unlockedAtLevel: 10,
          effects: []
        }
      ],
      visualChanges: {
        sizeMultiplier: 1.0,
        glowIntensity: 0.6,
        particleEffects: ['chaos_particles', 'red_glow']
      },
      unlockRequirements: { level: 10, gold: 500, dust: 50 }
    },
    {
      tier: 3,
      name: 'Nexus Being',
      statMultiplier: 2.0,
      skills: [
        {
          id: 'hex_sphere',
          name: 'Hex Sphere',
          description: 'Protective chaos sphere',
          cooldownTicks: 240,
          isPassive: false,
          isUltimate: false,
          unlockedAtLevel: 20,
          effects: [{ type: 'shield', amount: 100, duration: 240 }]
        },
        {
          id: 'no_more_enemies',
          name: 'No More Enemies',
          description: 'ULTIMATE: Instantly damages 50% of all enemy current HP',
          cooldownTicks: 1200,
          isPassive: false,
          isUltimate: true,
          unlockedAtLevel: 25,
          effects: [{ type: 'percent_current_hp_damage', percent: 50, target: 'all' }]
        }
      ],
      visualChanges: {
        sizeMultiplier: 1.1,
        glowIntensity: 1.0,
        particleEffects: ['chaos_particles', 'reality_tear'],
        colorShift: 0xff1493
      },
      unlockRequirements: { level: 20, gold: 2000, dust: 200, material: 'darkforce' }
    }
  ]
};

// ============================================================================
// HERO 6: FROST ARCHER (Hawkeye - Ice/DPS)
// ============================================================================

const FROST_ARCHER: HeroDefinition = {
  id: 'frost_archer',
  name: 'Frost Archer',
  marvelInspiration: 'Hawkeye',
  class: 'ice',
  role: 'dps',
  rarity: 'common',
  baseStats: {
    hp: 80, damage: 28, attackSpeed: 1.8, range: FP.fromInt(12),
    moveSpeed: FP.fromFloat(0.1), deployCooldown: 210
  },
  colors: { primary: 0x00bfff, secondary: 0xe0ffff, glow: 0xadd8e6 },
  shape: 'triangle',
  weaknesses: [
    {
      id: 'no_powers',
      name: 'Brak Mocy',
      description: '-40% HP',
      effect: { type: 'stat_penalty', stat: 'maxHpMultiplier', amount: 0.6 }
    }
  ],
  tiers: [
    {
      tier: 1,
      name: 'Frost Archer',
      statMultiplier: 1.0,
      skills: [
        {
          id: 'frost_arrow',
          name: 'Lodowa Strzała',
          description: 'Strzała spowalniająca wroga',
          cooldownTicks: 120,
          isPassive: false,
          isUltimate: false,
          unlockedAtLevel: 5,
          effects: [
            { type: 'damage', amount: 25, target: 'single' },
            { type: 'slow', percent: 40, duration: 90 }
          ]
        },
        {
          id: 'precision',
          name: 'Precyzja',
          description: '+15% crit chance',
          cooldownTicks: 0,
          isPassive: true,
          isUltimate: false,
          unlockedAtLevel: 1,
          effects: []
        }
      ],
      visualChanges: { sizeMultiplier: 1.0, glowIntensity: 0.2, particleEffects: [] },
      unlockRequirements: { level: 1, gold: 0, dust: 0 }
    },
    {
      tier: 2,
      name: 'Ice Marksman',
      statMultiplier: 1.5,
      skills: [
        {
          id: 'multi_shot',
          name: 'Wielostrzał',
          description: 'Strzela 3 strzałami jednocześnie',
          cooldownTicks: 180,
          isPassive: false,
          isUltimate: false,
          unlockedAtLevel: 10,
          effects: [{ type: 'damage', amount: 20, target: 'area' }]
        },
        {
          id: 'ice_mastery',
          name: 'Mistrzostwo Lodu',
          description: '+25% ice damage, +10% slow duration',
          cooldownTicks: 0,
          isPassive: true,
          isUltimate: false,
          unlockedAtLevel: 10,
          effects: []
        }
      ],
      visualChanges: { sizeMultiplier: 1.1, glowIntensity: 0.5, particleEffects: ['frost_trail'] },
      unlockRequirements: { level: 10, gold: 500, dust: 50 }
    },
    {
      tier: 3,
      name: 'Absolute Zero Archer',
      statMultiplier: 2.0,
      skills: [
        {
          id: 'shatter_shot',
          name: 'Roztrzaskujący Strzał',
          description: 'Zadaje podwójne obrażenia zamrożonym celom',
          cooldownTicks: 150,
          isPassive: false,
          isUltimate: false,
          unlockedAtLevel: 20,
          effects: [{ type: 'damage', amount: 60, target: 'single' }]
        },
        {
          id: 'blizzard_barrage',
          name: 'Nawałnica Lodowa',
          description: 'ULTIMATE: Deszcz lodowych strzał na wszystkich wrogów',
          cooldownTicks: 720,
          isPassive: false,
          isUltimate: true,
          unlockedAtLevel: 25,
          effects: [
            { type: 'damage', amount: 80, target: 'all' },
            { type: 'freeze', duration: 90 }
          ]
        }
      ],
      visualChanges: { sizeMultiplier: 1.2, glowIntensity: 0.9, particleEffects: ['frost_trail', 'ice_shards'], colorShift: 0x87ceeb },
      unlockRequirements: { level: 20, gold: 2000, dust: 200 }
    }
  ]
};

// ============================================================================
// ALL HEROES EXPORT (6 Heroes)
// ============================================================================

export const HEROES: HeroDefinition[] = [
  THUNDERLORD,
  IRON_SENTINEL,
  JADE_TITAN,
  SHIELD_CAPTAIN,
  SCARLET_MAGE,
  FROST_ARCHER
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getHeroById(heroId: string): HeroDefinition | undefined {
  return HEROES.find(h => h.id === heroId);
}

export function getHeroesByClass(classId: string): HeroDefinition[] {
  return HEROES.filter(h => h.class === classId);
}

export function getHeroesByRole(role: string): HeroDefinition[] {
  return HEROES.filter(h => h.role === role);
}

export function getHeroesByRarity(rarity: string): HeroDefinition[] {
  return HEROES.filter(h => h.rarity === rarity);
}

export function getStarterHeroes(): HeroDefinition[] {
  return HEROES.filter(h => h.rarity === 'starter');
}

export function getUnlockableHeroes(): HeroDefinition[] {
  return HEROES.filter(h => h.rarity !== 'starter');
}

export function getHeroUnlockCost(heroId: string): { gold: number; dust: number } | undefined {
  const hero = getHeroById(heroId);
  if (!hero) return undefined;

  switch (hero.rarity) {
    case 'starter': return { gold: 0, dust: 0 };
    case 'common': return { gold: 3000, dust: 500 };
    case 'rare': return { gold: 6000, dust: 1000 };
    case 'epic': return { gold: 12000, dust: 2000 };
    default: return { gold: 0, dust: 0 };
  }
}

export function getHeroTier(heroId: string, tier: 1 | 2 | 3): HeroTier | undefined {
  const hero = getHeroById(heroId);
  if (!hero) return undefined;
  return hero.tiers[tier - 1];
}

export function calculateHeroStats(hero: HeroDefinition, tier: 1 | 2 | 3, level: number) {
  const tierDef = hero.tiers[tier - 1];
  const levelBonus = 1 + (level - 1) * 0.02; // +2% per level

  return {
    hp: Math.floor(hero.baseStats.hp * tierDef.statMultiplier * levelBonus),
    damage: Math.floor(hero.baseStats.damage * tierDef.statMultiplier * levelBonus),
    attackSpeed: hero.baseStats.attackSpeed * tierDef.statMultiplier,
    range: hero.baseStats.range,
    moveSpeed: hero.baseStats.moveSpeed
  };
}

export function getXpRequiredForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

export function canUpgradeTier(hero: HeroDefinition, currentTier: 1 | 2 | 3, level: number): boolean {
  if (currentTier >= 3) return false;
  const nextTier = hero.tiers[currentTier as 0 | 1 | 2];
  if (!nextTier) return false;
  return level >= nextTier.unlockRequirements.level;
}
