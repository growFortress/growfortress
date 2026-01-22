/**
 * Unit Definitions (Jednostki bojowe)
 * 6 Units with 3 tiers each, 2 skills per tier, 1 weakness
 *
 * Rok 2347 - Elitarne jednostki bojowe broniące ludzkości przed Rojem
 */

import type { HeroDefinition, HeroTier } from '../types.js';
import { FP } from '../fixed.js';

// ============================================================================
// UNIT 1: STORM (Unit-7 "Storm" - Electric/DPS)
// ============================================================================

const UNIT_STORM: HeroDefinition = {
  id: 'storm',
  name: 'Unit-7 "Storm"',
  class: 'lightning',
  role: 'dps',
  rarity: 'starter',
  baseStats: {
    hp: 320,      // Buffed: było 280 (+14%)
    damage: 32,   // Buffed: było 25 (+28%)
    attackSpeed: 1.3, // Buffed: było 1.2 (+8%)
    range: FP.fromInt(6),
    moveSpeed: FP.fromFloat(0.14),
    deployCooldown: 300
  },
  colors: { primary: 0x4169e1, secondary: 0x87ceeb, glow: 0xffff00 },
  shape: 'hexagon',
  weaknesses: [
    {
      id: 'fire_vulnerability',
      name: 'Wrażliwość na Ogień',
      description: '+30% otrzymywanych obrażeń od Fire',
      effect: { type: 'damage_vulnerability', damageClass: 'fire', multiplier: 1.30 }
    }
  ],
  tiers: [
    {
      tier: 1,
      name: 'Unit-7 "Storm"',
      statMultiplier: 1.0,
      skills: [
        {
          id: 'arc_strike',
          name: 'Uderzenie Łukowe',
          description: 'Wystrzeliwuje łuk elektryczny zadający obrażenia',
          cooldownTicks: 180,
          isPassive: false,
          isUltimate: false,
          unlockedAtLevel: 1,
          effects: [{ type: 'damage', amount: 40, target: 'single' }]
        },
        {
          id: 'storm_passive',
          name: 'Protokół Burzowy',
          description: 'Ataki łańcuchują do 3 dodatkowych celów (75% DMG per skok). Łańcuchy nakładają Szok: -15% move speed na 2s',
          cooldownTicks: 0,
          isPassive: true,
          isUltimate: false,
          unlockedAtLevel: 1,
          effects: [
            { type: 'slow', percent: 15, duration: 60 }
          ]
        }
      ],
      visualChanges: { sizeMultiplier: 1.0, glowIntensity: 0.3, particleEffects: [] },
      unlockRequirements: { level: 1, gold: 0, dust: 0 }
    },
    {
      tier: 2,
      name: 'Unit-7 "Storm" Mk.II',
      statMultiplier: 1.5,
      skills: [
        {
          id: 'chain_lightning',
          name: 'Łańcuch Błyskawic',
          description: 'Potężniejszy atak z łańcuchem elektrycznym',
          cooldownTicks: 150,
          isPassive: false,
          isUltimate: false,
          unlockedAtLevel: 10,
          effects: [{ type: 'damage', amount: 60, target: 'single' }]
        },
        {
          id: 'storm_lord',
          name: 'Władca Piorunów',
          description: 'Chain: +1 cel (3 total), 80% DMG per skok zamiast 70%',
          cooldownTicks: 0,
          isPassive: true,
          isUltimate: false,
          unlockedAtLevel: 10,
          effects: []
        }
      ],
      visualChanges: { sizeMultiplier: 1.2, glowIntensity: 0.5, particleEffects: ['lightning_sparks'] },
      unlockRequirements: { level: 10, gold: 500, dust: 35 }
    },
    {
      tier: 3,
      name: 'Unit-7 "Storm" APEX',
      statMultiplier: 2.0,
      skills: [
        {
          id: 'ion_cannon',
          name: 'Działo Jonowe',
          description: 'Ultimatywna broń energetyczna',
          cooldownTicks: 120,
          isPassive: false,
          isUltimate: false,
          unlockedAtLevel: 20,
          effects: [{ type: 'damage', amount: 100, target: 'single' }]
        },
        {
          id: 'emp_storm',
          name: 'Burza EMP',
          description: 'ULTIMATE: Masywna eksplozja elektromagnetyczna. Wrogowie z Szokiem otrzymują podwójne obrażenia.',
          cooldownTicks: 840,  // Buffed: było 900 (-7%)
          isPassive: false,
          isUltimate: true,
          unlockedAtLevel: 25,
          effects: [
            { type: 'damage', amount: 250, target: 'all' },  // Buffed: było 200 (+25%)
            { type: 'stun', duration: 120 }  // Buffed: było 90 (+33%)
          ]
        }
      ],
      visualChanges: {
        sizeMultiplier: 1.4,
        glowIntensity: 0.8,
        particleEffects: ['lightning_sparks', 'rune_glow'],
        colorShift: 0xffd700
      },
      unlockRequirements: { level: 20, gold: 2000, dust: 140, material: 'uru' }
    }
  ]
};

// ============================================================================
// UNIT 2: FORGE (Unit-3 "Forge" - Tech/DPS)
// ============================================================================

const UNIT_FORGE: HeroDefinition = {
  id: 'forge',
  name: 'Unit-3 "Forge"',
  class: 'tech',
  role: 'dps',
  rarity: 'common',
  baseStats: {
    hp: 220,
    damage: 30,
    attackSpeed: 1.5,
    range: FP.fromInt(8),
    moveSpeed: FP.fromFloat(0.16),
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
      name: 'Unit-3 "Forge"',
      statMultiplier: 1.0,
      skills: [
        {
          id: 'laser_burst',
          name: 'Impuls Laserowy',
          description: 'Strzał z lasera precyzyjnego',
          cooldownTicks: 90,
          isPassive: false,
          isUltimate: false,
          unlockedAtLevel: 1,
          effects: [{ type: 'damage', amount: 25, target: 'single' }]
        },
        {
          id: 'thrusters',
          name: 'Silniki Odrzutowe',
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
      name: 'Unit-3 "Forge" Mk.II',
      statMultiplier: 1.5,
      skills: [
        {
          id: 'missile_barrage',
          name: 'Salwa Rakietowa',
          description: 'Wiele rakiet kierowanych w obszarze',
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
      unlockRequirements: { level: 10, gold: 500, dust: 35 }
    },
    {
      tier: 3,
      name: 'Unit-3 "Forge" APEX',
      statMultiplier: 2.0,
      skills: [
        {
          id: 'nano_swarm',
          name: 'Rój Nanorobotów',
          description: 'Adaptacyjne nano-bronie bojowe',
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
          id: 'orbital_strike',
          name: 'Uderzenie Orbitalne',
          description: 'ULTIMATE: 300 DMG + strefa "Spalona Ziemia" (50 DMG/s przez 5s, -50% armor wrogów w strefie)',
          cooldownTicks: 720,
          isPassive: false,
          isUltimate: true,
          unlockedAtLevel: 25,
          effects: [
            { type: 'damage', amount: 300, target: 'area' },
            { type: 'burn', damagePerTick: 50, duration: 150 }
            // -50% armor debuff - wymaga osobnej implementacji w systemie walki
          ]
        }
      ],
      visualChanges: {
        sizeMultiplier: 1.2,
        glowIntensity: 1.0,
        particleEffects: ['nano_particles', 'arc_glow'],
        colorShift: 0x00ffff
      },
      unlockRequirements: { level: 20, gold: 2000, dust: 140, material: 'extremis' }
    }
  ]
};

// ============================================================================
// UNIT 2: SCOUT (Unit-2 "Scout" - Natural/DPS) - EARLY GAME HERO
// ============================================================================

const UNIT_SCOUT: HeroDefinition = {
  id: 'scout',
  name: 'Unit-2 "Scout"',
  class: 'natural',
  role: 'dps',
  rarity: 'common',
  baseStats: {
    hp: 180,
    damage: 28,
    attackSpeed: 1.4,
    range: FP.fromInt(8),
    moveSpeed: FP.fromFloat(0.16),
    deployCooldown: 240
  },
  colors: { primary: 0x228b22, secondary: 0x90ee90, glow: 0x32cd32 },
  shape: 'hexagon',
  weaknesses: [
    {
      id: 'light_armor',
      name: 'Lekka Zbroja',
      description: '+25% otrzymywanych obrażeń od Fire',
      effect: { type: 'damage_vulnerability', damageClass: 'fire', multiplier: 1.25 }
    }
  ],
  tiers: [
    {
      tier: 1,
      name: 'Unit-2 "Scout"',
      statMultiplier: 1.0,
      skills: [
        {
          id: 'rapid_shot',
          name: 'Szybki Strzał',
          description: 'Szybki atak zadający obrażenia pojedynczemu celowi',
          cooldownTicks: 120,
          isPassive: false,
          isUltimate: false,
          unlockedAtLevel: 1,
          effects: [{ type: 'damage', amount: 45, target: 'single' }]
        },
        {
          id: 'keen_eye',
          name: 'Bystre Oko',
          description: '+15% szansa na trafienie krytyczne',
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
      name: 'Unit-2 "Scout" Mk.II',
      statMultiplier: 1.5,
      skills: [
        {
          id: 'double_shot',
          name: 'Podwójny Strzał',
          description: 'Wystrzeliwuje dwa pociski jednocześnie',
          cooldownTicks: 150,
          isPassive: false,
          isUltimate: false,
          unlockedAtLevel: 10,
          effects: [{ type: 'damage', amount: 35, target: 'single' }, { type: 'damage', amount: 35, target: 'single' }]
        },
        {
          id: 'marksman',
          name: 'Strzelec Wyborowy',
          description: '+25% crit chance, +30% crit damage',
          cooldownTicks: 0,
          isPassive: true,
          isUltimate: false,
          unlockedAtLevel: 10,
          effects: []
        }
      ],
      visualChanges: { sizeMultiplier: 1.15, glowIntensity: 0.5, particleEffects: ['energy_trail'] },
      unlockRequirements: { level: 10, gold: 500, dust: 35 }
    },
    {
      tier: 3,
      name: 'Unit-2 "Scout" APEX',
      statMultiplier: 2.0,
      skills: [
        {
          id: 'sniper_shot',
          name: 'Strzał Snajperski',
          description: 'Potężny precyzyjny strzał z wysokim crit',
          cooldownTicks: 180,
          isPassive: false,
          isUltimate: false,
          unlockedAtLevel: 20,
          effects: [{ type: 'damage', amount: 120, target: 'single' }]
        },
        {
          id: 'perfect_aim',
          name: 'Idealne Celowanie',
          description: 'ULTIMATE: Tryb "Zone" na 8s - 100% crit, +100% crit DMG. Każde zabójstwo wydłuża czas o 2s (max 20s).',
          cooldownTicks: 600,
          isPassive: false,
          isUltimate: true,
          unlockedAtLevel: 25,
          effects: [
            { type: 'buff', stat: 'critChance', amount: 1.0, duration: 240 },
            { type: 'buff', stat: 'critDamageBonus', amount: 1.0, duration: 240 }
            // Kill extension mechanic - wymaga osobnej implementacji w systemie walki
          ]
        }
      ],
      visualChanges: {
        sizeMultiplier: 1.3,
        glowIntensity: 0.8,
        particleEffects: ['energy_trail', 'sniper_glow'],
        colorShift: 0x32cd32
      },
      unlockRequirements: { level: 20, gold: 2000, dust: 140, material: 'vibranium' }
    }
  ]
};

// ============================================================================
// UNIT 3: TITAN (Unit-1 "Titan" - Void/Tank)
// ============================================================================

const UNIT_TITAN: HeroDefinition = {
  id: 'titan',
  name: 'Unit-1 "Titan"',
  class: 'void',
  role: 'tank',
  rarity: 'epic',
  baseStats: {
    hp: 500,
    damage: 35,
    attackSpeed: 0.7,
    range: FP.fromInt(3),
    moveSpeed: FP.fromFloat(0.17),
    deployCooldown: 360
  },
  colors: { primary: 0x4b0082, secondary: 0x8b008b, glow: 0x9400d3 },
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
      name: 'Unit-1 "Titan"',
      statMultiplier: 1.0,
      skills: [
        {
          id: 'void_strike',
          name: 'Uderzenie Próżni',
          description: 'Potężne uderzenie energią wymiarową',
          cooldownTicks: 240,
          isPassive: false,
          isUltimate: false,
          unlockedAtLevel: 1,
          effects: [
            { type: 'damage', amount: 50, target: 'area' },
            { type: 'stun', duration: 45 }
          ]
        },
        {
          id: 'void_absorption',
          name: 'Absorpcja Próżni',
          description: 'Obrażenia rosną wraz z utratą HP',
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
      name: 'Unit-1 "Titan" Mk.II',
      statMultiplier: 1.6,
      skills: [
        {
          id: 'dimensional_rift',
          name: 'Szczelina Wymiarowa',
          description: 'Otwiera rozdarcie w przestrzeni wciągające wrogów',
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
          id: 'void_resonance',
          name: 'Rezonans Próżni',
          description: '+100% obrażeń przy HP poniżej 30%',
          cooldownTicks: 0,
          isPassive: true,
          isUltimate: false,
          unlockedAtLevel: 10,
          effects: []
        }
      ],
      visualChanges: { sizeMultiplier: 1.6, glowIntensity: 0.5, particleEffects: ['void_particles'] },
      unlockRequirements: { level: 10, gold: 500, dust: 35 }
    },
    {
      tier: 3,
      name: 'Unit-1 "Titan" APEX',
      statMultiplier: 2.2,
      skills: [
        {
          id: 'void_burst',
          name: 'Eksplozja Próżniowa',
          description: 'Potężna eksplozja energii wymiarowej',
          cooldownTicks: 360,
          isPassive: false,
          isUltimate: false,
          unlockedAtLevel: 20,
          effects: [{ type: 'damage', amount: 120, target: 'area' }]
        },
        {
          id: 'dimensional_collapse',
          name: 'Kolaps Wymiarowy',
          description: 'ULTIMATE: Tworzy czarną dziurę niszczącą wszystko',
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
        particleEffects: ['void_particles', 'dark_energy'],
        colorShift: 0x9400d3
      },
      unlockRequirements: { level: 20, gold: 2000, dust: 140, material: 'dark_matter' }
    }
  ]
};

// ============================================================================
// UNIT 4: VANGUARD (Unit-0 "Vanguard" - Natural/Tank)
// ============================================================================

const UNIT_VANGUARD: HeroDefinition = {
  id: 'vanguard',
  name: 'Unit-0 "Vanguard"',
  class: 'natural',
  role: 'tank',
  rarity: 'starter',
  baseStats: {
    hp: 450,      // Buffed: było 380 (+18%)
    damage: 24,   // Buffed: było 18 (+33%)
    attackSpeed: 1.0,
    range: FP.fromInt(5),
    moveSpeed: FP.fromFloat(0.15),
    deployCooldown: 270
  },
  colors: { primary: 0x4169e1, secondary: 0xdc143c, glow: 0xf0f0f0 },
  shape: 'circle',
  weaknesses: [
    {
      id: 'only_human',
      name: 'Tylko Człowiek',
      description: 'Lightning zadaje +30% DMG',
      effect: { type: 'damage_vulnerability', damageClass: 'lightning', multiplier: 1.30 }
    }
  ],
  tiers: [
    {
      tier: 1,
      name: 'Unit-0 "Vanguard"',
      statMultiplier: 1.0,
      skills: [
        {
          id: 'barrier_pulse',
          name: 'Impuls Tarczy',
          description: 'Wystrzeliwuje pole siłowe odbijające się od wrogów',
          cooldownTicks: 150,
          isPassive: false,
          isUltimate: false,
          unlockedAtLevel: 1,
          effects: [{ type: 'damage', amount: 30, target: 'area' }]
        },
        {
          id: 'command_aura',
          name: 'Aura Dowodzenia',
          description: '+15% damage dla sojuszników w zasięgu 5, taunts wrogów w zasięgu 4, +10% DMG reduction dla siebie',
          cooldownTicks: 0,
          isPassive: true,
          isUltimate: false,
          unlockedAtLevel: 1,
          effects: [
            { type: 'buff', stat: 'damageBonus', amount: 0.15, duration: 0 },
            { type: 'buff', stat: 'incomingDamageReduction', amount: 0.10, duration: 0 }
          ]
        }
      ],
      visualChanges: { sizeMultiplier: 1.0, glowIntensity: 0.3, particleEffects: [] },
      unlockRequirements: { level: 1, gold: 0, dust: 0 }
    },
    {
      tier: 2,
      name: 'Unit-0 "Vanguard" Mk.II',
      statMultiplier: 1.4,
      skills: [
        {
          id: 'dual_barrier',
          name: 'Podwójna Bariera',
          description: 'Dwa pola siłowe wystrzeliwane jednocześnie',
          cooldownTicks: 180,
          isPassive: false,
          isUltimate: false,
          unlockedAtLevel: 10,
          effects: [{ type: 'damage', amount: 45, target: 'area' }]
        },
        {
          id: 'veteran',
          name: 'Weteran',
          description: '+25% damage reduction, +20% armor dla sojuszników, 5% DMG twierdzy absorbowane',
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
      unlockRequirements: { level: 10, gold: 500, dust: 35 }
    },
    {
      tier: 3,
      name: 'Unit-0 "Vanguard" APEX',
      statMultiplier: 1.8,
      skills: [
        {
          id: 'kinetic_hammer',
          name: 'Młot Kinetyczny',
          description: 'Operuje bronią kinetyczną wysokiej mocy',
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
          id: 'rally_command',
          name: 'Rozkaz Natarcia',
          description: 'ULTIMATE: Wszystkie jednostki zyskują +50% DMG, +30% AS i 100 HP tarczy na 10s. Vanguard staje się nietykalny na 3s.',
          cooldownTicks: 840,  // Buffed: było 900 (-7%)
          isPassive: false,
          isUltimate: true,
          unlockedAtLevel: 25,
          effects: [
            { type: 'buff', stat: 'damageBonus', amount: 0.5, duration: 300 },
            { type: 'buff', stat: 'attackSpeedBonus', amount: 0.3, duration: 300 },
            { type: 'shield', amount: 100, duration: 300 }
            // Vanguard 3s invulnerability - wymaga osobnej implementacji w systemie walki
          ]
        }
      ],
      visualChanges: {
        sizeMultiplier: 1.2,
        glowIntensity: 0.9,
        particleEffects: ['lightning_sparks', 'stars'],
        colorShift: 0xffd700
      },
      unlockRequirements: { level: 20, gold: 2000, dust: 140, material: 'vibranium' }
    }
  ]
};

// ============================================================================
// UNIT 5: RIFT (Unit-9 "Rift" - Fire/Support)
// ============================================================================

const UNIT_RIFT: HeroDefinition = {
  id: 'rift',
  name: 'Unit-9 "Rift"',
  class: 'fire',
  role: 'support',
  rarity: 'rare',
  baseStats: {
    hp: 180,
    damage: 35,
    attackSpeed: 0.8,
    range: FP.fromInt(10),
    moveSpeed: FP.fromFloat(0.12),
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
      name: 'Unit-9 "Rift"',
      statMultiplier: 1.0,
      skills: [
        {
          id: 'plasma_bolt',
          name: 'Impuls Plazmowy',
          description: 'Pocisk plazmowy wysokiej temperatury',
          cooldownTicks: 120,
          isPassive: false,
          isUltimate: false,
          unlockedAtLevel: 1,
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
      name: 'Unit-9 "Rift" Mk.II',
      statMultiplier: 1.5,
      skills: [
        {
          id: 'plasma_wave',
          name: 'Fala Plazmowa',
          description: 'Obszarowe obrażenia termiczne',
          cooldownTicks: 180,
          isPassive: false,
          isUltimate: false,
          unlockedAtLevel: 10,
          effects: [{ type: 'damage', amount: 60, target: 'area' }]
        },
        {
          id: 'thermal_flux',
          name: 'Fluktuacja Termiczna',
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
      unlockRequirements: { level: 10, gold: 500, dust: 35 }
    },
    {
      tier: 3,
      name: 'Unit-9 "Rift" APEX',
      statMultiplier: 2.0,
      skills: [
        {
          id: 'plasma_shield',
          name: 'Tarcza Plazmowa',
          description: 'Ochronna sfera plazmowa',
          cooldownTicks: 240,
          isPassive: false,
          isUltimate: false,
          unlockedAtLevel: 20,
          effects: [{ type: 'shield', amount: 100, duration: 240 }]
        },
        {
          id: 'thermal_annihilation',
          name: 'Anihilacja Termiczna',
          description: 'ULTIMATE: Zadaje 50% HP wrogom (max 500+10/lv)',
          cooldownTicks: 1200,
          isPassive: false,
          isUltimate: true,
          unlockedAtLevel: 25,
          effects: [{ type: 'percent_current_hp_damage', percent: 50, target: 'all', maxBaseDamage: 500, scalingPerLevel: 10 }]
        }
      ],
      visualChanges: {
        sizeMultiplier: 1.1,
        glowIntensity: 1.0,
        particleEffects: ['chaos_particles', 'reality_tear'],
        colorShift: 0xff1493
      },
      unlockRequirements: { level: 20, gold: 2000, dust: 140, material: 'darkforce' }
    }
  ]
};

// ============================================================================
// UNIT 6: FROST (Unit-5 "Frost" - Ice/Crowd Control)
// ============================================================================

const UNIT_FROST: HeroDefinition = {
  id: 'frost',
  name: 'Unit-5 "Frost"',
  class: 'ice',
  role: 'crowd_control',
  rarity: 'common',
  baseStats: {
    hp: 170, damage: 28, attackSpeed: 1.8, range: FP.fromInt(12),
    moveSpeed: FP.fromFloat(0.16), deployCooldown: 210
  },
  colors: { primary: 0x00bfff, secondary: 0xe0ffff, glow: 0xadd8e6 },
  shape: 'triangle',
  weaknesses: [
    {
      id: 'no_powers',
      name: 'Brak Mocy',
      description: '-30% max HP',
      effect: { type: 'stat_penalty', stat: 'maxHpMultiplier', amount: 0.70 }
    }
  ],
  tiers: [
    {
      tier: 1,
      name: 'Unit-5 "Frost"',
      statMultiplier: 1.0,
      skills: [
        {
          id: 'cryo_shot',
          name: 'Strzał Kriogeniczny',
          description: 'Pocisk kriogeniczny spowalniający cel',
          cooldownTicks: 120,
          isPassive: false,
          isUltimate: false,
          unlockedAtLevel: 1,
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
      name: 'Unit-5 "Frost" Mk.II',
      statMultiplier: 1.5,
      skills: [
        {
          id: 'multi_shot',
          name: 'Wielostrzał',
          description: 'Wystrzeliwuje 3 pociski jednocześnie',
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
      unlockRequirements: { level: 10, gold: 500, dust: 35 }
    },
    {
      tier: 3,
      name: 'Unit-5 "Frost" APEX',
      statMultiplier: 2.0,
      skills: [
        {
          id: 'shatter_shot',
          name: 'Strzał Kruszący',
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
      unlockRequirements: { level: 20, gold: 2000, dust: 140, material: 'vibranium' }
    }
  ]
};

// ============================================================================
// UNIT 7: SPECTRE (Unit-4 "Spectre" - Plasma/DPS) - EXCLUSIVE
// ============================================================================

const UNIT_SPECTRE: HeroDefinition = {
  id: 'spectre',
  name: 'Unit-4 "Spectre"',
  class: 'tech',  // Zmieniono z 'plasma' - brak twierdzy plasma, synergia z Kwantową
  role: 'dps',
  rarity: 'rare', // Exclusive rare - costs only gold
  baseStats: {
    hp: 260,
    damage: 33,
    attackSpeed: 1.6,
    range: FP.fromInt(9),
    moveSpeed: FP.fromFloat(0.15),
    deployCooldown: 240
  },
  colors: { primary: 0x00ffff, secondary: 0xff00ff, glow: 0x00ffff },
  shape: 'diamond',
  weaknesses: [
    {
      id: 'energy_instability',
      name: 'Niestabilność Energii',
      description: 'Void zadaje +35% DMG',
      effect: { type: 'damage_vulnerability', damageClass: 'void', multiplier: 1.35 }
    }
  ],
  tiers: [
    {
      tier: 1,
      name: 'Unit-4 "Spectre"',
      statMultiplier: 1.0,
      skills: [
        {
          id: 'plasma_burst',
          name: 'Impuls Plazmowy',
          description: 'Wystrzeliwuje koncentrowany impuls plazmy',
          cooldownTicks: 120,
          isPassive: false,
          isUltimate: false,
          unlockedAtLevel: 1,
          effects: [{ type: 'damage', amount: 45, target: 'single' }]
        },
        {
          id: 'stealth_protocol',
          name: 'Protokół Kamuflażu',
          description: '+20% crit chance',
          cooldownTicks: 0,
          isPassive: true,
          isUltimate: false,
          unlockedAtLevel: 1,
          effects: []
        }
      ],
      visualChanges: { sizeMultiplier: 1.0, glowIntensity: 0.5, particleEffects: ['plasma_glow'] },
      unlockRequirements: { level: 1, gold: 0, dust: 0 }
    },
    {
      tier: 2,
      name: 'Unit-4 "Spectre" Mk.II',
      statMultiplier: 1.6,
      skills: [
        {
          id: 'plasma_lance',
          name: 'Lanca Plazmowa',
          description: 'Przebijający atak plazmowy trafiający wiele celów',
          cooldownTicks: 150,
          isPassive: false,
          isUltimate: false,
          unlockedAtLevel: 10,
          effects: [{ type: 'damage', amount: 65, target: 'area' }]
        },
        {
          id: 'phase_shift',
          name: 'Przesunięcie Fazowe',
          description: '+30% crit chance, +15% attack speed',
          cooldownTicks: 0,
          isPassive: true,
          isUltimate: false,
          unlockedAtLevel: 10,
          effects: []
        }
      ],
      visualChanges: { sizeMultiplier: 1.2, glowIntensity: 0.7, particleEffects: ['plasma_glow', 'phase_particles'] },
      unlockRequirements: { level: 10, gold: 750, dust: 50 }
    },
    {
      tier: 3,
      name: 'Unit-4 "Spectre" APEX',
      statMultiplier: 2.1,
      skills: [
        {
          id: 'plasma_overload',
          name: 'Przeciążenie Plazmowe',
          description: 'Masywna eksplozja plazmy z wysokim crit',
          cooldownTicks: 180,
          isPassive: false,
          isUltimate: false,
          unlockedAtLevel: 20,
          effects: [{ type: 'damage', amount: 100, target: 'area' }]
        },
        {
          id: 'ghost_protocol',
          name: 'Protokół Widmo',
          description: 'ULTIMATE: Staje się niewidzialny, następny atak zadaje 300% DMG',
          cooldownTicks: 720,
          isPassive: false,
          isUltimate: true,
          unlockedAtLevel: 25,
          effects: [{ type: 'damage', amount: 150, target: 'single' }]
        }
      ],
      visualChanges: {
        sizeMultiplier: 1.3,
        glowIntensity: 1.0,
        particleEffects: ['plasma_glow', 'phase_particles', 'ghost_trail'],
        colorShift: 0xff00ff
      },
      unlockRequirements: { level: 20, gold: 2500, dust: 175, material: 'cosmic_dust' }
    }
  ]
};

// ============================================================================
// UNIT 8: OMEGA (Unit-X "Omega" - Void/Assassin) - LEGENDARY EXCLUSIVE
// ============================================================================

const UNIT_OMEGA: HeroDefinition = {
  id: 'omega',
  name: 'Unit-X "Omega"',
  class: 'void',
  role: 'assassin',
  rarity: 'legendary', // Exclusive legendary - costs only dust
  baseStats: {
    hp: 220,
    damage: 45,
    attackSpeed: 1.1,
    range: FP.fromInt(7),
    moveSpeed: FP.fromFloat(0.17),
    deployCooldown: 300
  },
  colors: { primary: 0xffd700, secondary: 0x1a1a2a, glow: 0xffd700 },
  shape: 'star',
  weaknesses: [
    {
      id: 'unstable_power',
      name: 'Niestabilna Moc',
      description: 'Lightning zadaje +35% DMG',
      effect: { type: 'damage_vulnerability', damageClass: 'lightning', multiplier: 1.35 }
    }
  ],
  tiers: [
    {
      tier: 1,
      name: 'Unit-X "Omega"',
      statMultiplier: 1.0,
      skills: [
        {
          id: 'execute_strike',
          name: 'Egzekucja',
          description: 'Zadaje 80 DMG + 100% bonus vs cele <30% HP',
          cooldownTicks: 180,
          isPassive: false,
          isUltimate: false,
          unlockedAtLevel: 1,
          effects: [{ type: 'damage', amount: 80, target: 'single' }]
        },
        {
          id: 'lethal_precision',
          name: 'Śmiertelna Precyzja',
          description: '+25% crit damage, trafienia krytyczne leczą 10 HP',
          cooldownTicks: 0,
          isPassive: true,
          isUltimate: false,
          unlockedAtLevel: 1,
          effects: []
        }
      ],
      visualChanges: { sizeMultiplier: 1.0, glowIntensity: 0.6, particleEffects: ['gold_sparks'] },
      unlockRequirements: { level: 1, gold: 0, dust: 0 }
    },
    {
      tier: 2,
      name: 'Unit-X "Omega" Mk.II',
      statMultiplier: 1.7,
      skills: [
        {
          id: 'void_slash',
          name: 'Cięcie Próżni',
          description: 'Przechodzi przez wrogów zadając obrażenia wszystkim na ścieżce',
          cooldownTicks: 150,
          isPassive: false,
          isUltimate: false,
          unlockedAtLevel: 10,
          effects: [
            { type: 'damage', amount: 100, target: 'area' },
            { type: 'slow', percent: 30, duration: 90 }
          ]
        },
        {
          id: 'hunter_instinct',
          name: 'Instynkt Łowcy',
          description: '+40% crit damage, execute threshold 25%/20%/15% (regular/elite/boss)',
          cooldownTicks: 0,
          isPassive: true,
          isUltimate: false,
          unlockedAtLevel: 10,
          effects: []
        }
      ],
      visualChanges: { sizeMultiplier: 1.2, glowIntensity: 0.8, particleEffects: ['gold_sparks', 'void_trail'] },
      unlockRequirements: { level: 10, gold: 1000, dust: 70 }
    },
    {
      tier: 3,
      name: 'Unit-X "Omega" APEX',
      statMultiplier: 2.3,
      skills: [
        {
          id: 'death_mark',
          name: 'Znak Śmierci',
          description: 'Oznacza cel - otrzymuje +50% DMG przez 5s',
          cooldownTicks: 240,
          isPassive: false,
          isUltimate: false,
          unlockedAtLevel: 20,
          effects: [
            { type: 'damage', amount: 120, target: 'single' },
            { type: 'buff', stat: 'damageBonus', amount: 0.5, duration: 300 }
          ]
        },
        {
          id: 'omega_protocol',
          name: 'Protokół Omega',
          description: 'ULTIMATE: Natychmiastowa eliminacja celu <25% HP, inaczej 400 DMG',
          cooldownTicks: 900,
          isPassive: false,
          isUltimate: true,
          unlockedAtLevel: 25,
          effects: [{ type: 'damage', amount: 400, target: 'single' }]
        }
      ],
      visualChanges: {
        sizeMultiplier: 1.4,
        glowIntensity: 1.0,
        particleEffects: ['gold_sparks', 'void_trail', 'omega_aura'],
        colorShift: 0xffd700
      },
      unlockRequirements: { level: 20, gold: 3000, dust: 210, material: 'dark_matter' }
    }
  ]
};

// ============================================================================
// UNIT 9: INFERNO (Unit-6 "Inferno" - Fire/DPS) - PREMIUM SHOP EXCLUSIVE
// ============================================================================

const UNIT_INFERNO: HeroDefinition = {
  id: 'inferno',
  name: 'Unit-6 "Inferno"',
  class: 'fire',
  role: 'dps',
  rarity: 'epic',
  baseStats: {
    hp: 240,
    damage: 42,
    attackSpeed: 1.3,
    range: FP.fromInt(7),
    moveSpeed: FP.fromFloat(0.15),
    deployCooldown: 270
  },
  colors: { primary: 0xff4500, secondary: 0xff8c00, glow: 0xffd700 },
  shape: 'star',
  weaknesses: [
    {
      id: 'thermal_instability',
      name: 'Niestabilnosc Termiczna',
      description: 'Ice zadaje +30% DMG',
      effect: { type: 'damage_vulnerability', damageClass: 'ice', multiplier: 1.3 }
    }
  ],
  tiers: [
    {
      tier: 1,
      name: 'Unit-6 "Inferno"',
      statMultiplier: 1.0,
      skills: [
        {
          id: 'flame_strike',
          name: 'Plomien Uderzeniowy',
          description: 'Ognisty atak zadajacy podpalenie',
          cooldownTicks: 150,
          isPassive: false,
          isUltimate: false,
          unlockedAtLevel: 1,
          effects: [
            { type: 'damage', amount: 55, target: 'single' },
            { type: 'burn', damagePerTick: 5, duration: 90 }
          ]
        },
        {
          id: 'burning_heart',
          name: 'Gorace Serce',
          description: '+20% DMG vs podpalone cele',
          cooldownTicks: 0,
          isPassive: true,
          isUltimate: false,
          unlockedAtLevel: 1,
          effects: []
        }
      ],
      visualChanges: { sizeMultiplier: 1.0, glowIntensity: 0.5, particleEffects: ['fire_sparks'] },
      unlockRequirements: { level: 1, gold: 0, dust: 0 }
    },
    {
      tier: 2,
      name: 'Unit-6 "Inferno" Mk.II',
      statMultiplier: 1.6,
      skills: [
        {
          id: 'plasma_explosion',
          name: 'Eksplozja Plazmowa',
          description: 'Obszarowa eksplozja podpalajaca wszystkich wrogow',
          cooldownTicks: 210,
          isPassive: false,
          isUltimate: false,
          unlockedAtLevel: 10,
          effects: [
            { type: 'damage', amount: 75, target: 'area' },
            { type: 'burn', damagePerTick: 8, duration: 120 }
          ]
        },
        {
          id: 'fire_mastery',
          name: 'Mistrz Ognia',
          description: '+35% fire DMG, +15% szansa na kryt',
          cooldownTicks: 0,
          isPassive: true,
          isUltimate: false,
          unlockedAtLevel: 10,
          effects: []
        }
      ],
      visualChanges: { sizeMultiplier: 1.2, glowIntensity: 0.7, particleEffects: ['fire_sparks', 'flame_trail'] },
      unlockRequirements: { level: 10, gold: 500, dust: 35 }
    },
    {
      tier: 3,
      name: 'Unit-6 "Inferno" APEX',
      statMultiplier: 2.2,
      skills: [
        {
          id: 'pillar_of_fire',
          name: 'Filar Ognia',
          description: 'Tworzy slup ognia zadajacy ciagle obrazenia',
          cooldownTicks: 270,
          isPassive: false,
          isUltimate: false,
          unlockedAtLevel: 20,
          effects: [
            { type: 'damage', amount: 120, target: 'area' },
            { type: 'burn', damagePerTick: 15, duration: 180 }
          ]
        },
        {
          id: 'thermal_apocalypse',
          name: 'Apokalipsa Termiczna',
          description: 'ULTIMATE: 200 DMG + 50% HP wroga (max 500+10/lv) do wszystkich',
          cooldownTicks: 840,
          isPassive: false,
          isUltimate: true,
          unlockedAtLevel: 25,
          effects: [
            { type: 'damage', amount: 200, target: 'all' },
            { type: 'percent_current_hp_damage', percent: 50, target: 'all', maxBaseDamage: 500, scalingPerLevel: 10 },
            { type: 'slow', percent: 50, duration: 150 }
          ]
        }
      ],
      visualChanges: {
        sizeMultiplier: 1.4,
        glowIntensity: 1.0,
        particleEffects: ['fire_sparks', 'flame_trail', 'inferno_aura'],
        colorShift: 0xffd700
      },
      unlockRequirements: { level: 20, gold: 2000, dust: 140, material: 'extremis' }
    }
  ]
};

// ============================================================================
// UNIT 10: GLACIER (Unit-8 "Glacier" - Ice/Tank) - PREMIUM SHOP EXCLUSIVE
// ============================================================================

const UNIT_GLACIER: HeroDefinition = {
  id: 'glacier',
  name: 'Unit-8 "Glacier"',
  class: 'ice',
  role: 'tank',
  rarity: 'epic',
  baseStats: {
    hp: 460,
    damage: 44,
    attackSpeed: 0.8,
    range: FP.fromInt(4),
    moveSpeed: FP.fromFloat(0.115),
    deployCooldown: 330
  },
  colors: { primary: 0x1e90ff, secondary: 0xb0e0e6, glow: 0x87ceeb },
  shape: 'hexagon',
  weaknesses: [
    {
      id: 'slow_metabolism',
      name: 'Wolny Metabolizm',
      description: 'Fire zadaje +35% DMG',
      effect: { type: 'damage_vulnerability', damageClass: 'fire', multiplier: 1.35 }
    }
  ],
  tiers: [
    {
      tier: 1,
      name: 'Unit-8 "Glacier"',
      statMultiplier: 1.0,
      skills: [
        {
          id: 'ice_barrier',
          name: 'Lodowa Bariera',
          description: 'Tarcza lodowa spowalniajaca atakujacych',
          cooldownTicks: 240,
          isPassive: false,
          isUltimate: false,
          unlockedAtLevel: 1,
          effects: [
            { type: 'shield', amount: 60, duration: 180 },
            { type: 'slow', percent: 30, duration: 90 }
          ]
        },
        {
          id: 'cryo_armor',
          name: 'Kriogeniczna Zbroja',
          description: '+20% redukcja obrazen, atakujacy sa spowalniani',
          cooldownTicks: 0,
          isPassive: true,
          isUltimate: false,
          unlockedAtLevel: 1,
          effects: []
        }
      ],
      visualChanges: { sizeMultiplier: 1.3, glowIntensity: 0.3, particleEffects: ['frost_particles'] },
      unlockRequirements: { level: 1, gold: 0, dust: 0 }
    },
    {
      tier: 2,
      name: 'Unit-8 "Glacier" Mk.II',
      statMultiplier: 1.65,
      skills: [
        {
          id: 'frost_strike',
          name: 'Mrozne Uderzenie',
          description: 'Obszarowy atak zamrazajacy wrogow',
          cooldownTicks: 180,
          isPassive: false,
          isUltimate: false,
          unlockedAtLevel: 10,
          effects: [
            { type: 'damage', amount: 50, target: 'area' },
            { type: 'freeze', duration: 75 }
          ]
        },
        {
          id: 'heart_of_winter',
          name: 'Serce Zimy',
          description: '+30% max HP, regeneracja gdy niezaatakowany',
          cooldownTicks: 0,
          isPassive: true,
          isUltimate: false,
          unlockedAtLevel: 10,
          effects: []
        }
      ],
      visualChanges: { sizeMultiplier: 1.5, glowIntensity: 0.5, particleEffects: ['frost_particles', 'ice_shield'] },
      unlockRequirements: { level: 10, gold: 500, dust: 35 }
    },
    {
      tier: 3,
      name: 'Unit-8 "Glacier" APEX',
      statMultiplier: 2.15,
      skills: [
        {
          id: 'eternal_winter',
          name: 'Wieczna Zima',
          description: 'Strefa wiecznego mroku zamrazajaca wrogow',
          cooldownTicks: 300,
          isPassive: false,
          isUltimate: false,
          unlockedAtLevel: 20,
          effects: [
            { type: 'damage', amount: 40, target: 'area' },
            { type: 'slow', percent: 60, duration: 150 }
          ]
        },
        {
          id: 'absolute_zero',
          name: 'Absolutne Zero',
          description: 'ULTIMATE: Zamraza wszystkich wrogow i wzmacnia obrone',
          cooldownTicks: 900,
          isPassive: false,
          isUltimate: true,
          unlockedAtLevel: 25,
          effects: [
            { type: 'freeze', duration: 150 },
            { type: 'damage', amount: 180, target: 'all' },
            { type: 'shield', amount: 200, duration: 300 }
          ]
        }
      ],
      visualChanges: {
        sizeMultiplier: 1.8,
        glowIntensity: 0.9,
        particleEffects: ['frost_particles', 'ice_shield', 'blizzard_aura'],
        colorShift: 0x87ceeb
      },
      unlockRequirements: { level: 20, gold: 2000, dust: 140, material: 'vibranium' }
    }
  ]
};

// ============================================================================
// UNIT 11: MEDIC (Unit-M "Medic" - Tech/Support) - NEW STARTER HEALER
// ============================================================================

const UNIT_MEDIC: HeroDefinition = {
  id: 'medic',
  name: 'Unit-M "Medic"',
  class: 'tech',
  role: 'support',
  rarity: 'starter',
  baseStats: {
    hp: 220,
    damage: 15,
    attackSpeed: 0.8,
    range: FP.fromInt(8),
    moveSpeed: FP.fromFloat(0.14),
    deployCooldown: 240
  },
  colors: { primary: 0x00ff7f, secondary: 0x98fb98, glow: 0x00ff00 },
  shape: 'circle',
  weaknesses: [
    {
      id: 'fragile_frame',
      name: 'Delikatna Konstrukcja',
      description: 'Fire zadaje +25% DMG',
      effect: { type: 'damage_vulnerability', damageClass: 'fire', multiplier: 1.25 }
    }
  ],
  tiers: [
    {
      tier: 1,
      name: 'Unit-M "Medic"',
      statMultiplier: 1.0,
      skills: [
        {
          id: 'healing_pulse',
          name: 'Impuls Leczniczy',
          description: 'Leczy najniższego HP sojusznika za 50 HP',
          cooldownTicks: 180,
          isPassive: false,
          isUltimate: false,
          unlockedAtLevel: 1,
          effects: [{ type: 'heal', amount: 50, target: 'single' }]
        },
        {
          id: 'triage_protocol',
          name: 'Protokół Triażu',
          description: 'Automatycznie leczy sojuszników poniżej 50% HP za 5 HP/s',
          cooldownTicks: 0,
          isPassive: true,
          isUltimate: false,
          unlockedAtLevel: 1,
          effects: []
        }
      ],
      visualChanges: { sizeMultiplier: 1.0, glowIntensity: 0.4, particleEffects: ['heal_particles'] },
      unlockRequirements: { level: 1, gold: 0, dust: 0 }
    },
    {
      tier: 2,
      name: 'Unit-M "Medic" Mk.II',
      statMultiplier: 1.5,
      skills: [
        {
          id: 'nanite_swarm',
          name: 'Rój Nanitów',
          description: 'Leczy wszystkich sojuszników za 40 HP',
          cooldownTicks: 240,
          isPassive: false,
          isUltimate: false,
          unlockedAtLevel: 10,
          effects: [{ type: 'heal', amount: 40, target: 'all' }]
        },
        {
          id: 'enhanced_triage',
          name: 'Rozszerzony Triaż',
          description: 'Auto-heal teraz +10 HP/s, zakres +3 jednostki',
          cooldownTicks: 0,
          isPassive: true,
          isUltimate: false,
          unlockedAtLevel: 10,
          effects: []
        }
      ],
      visualChanges: { sizeMultiplier: 1.1, glowIntensity: 0.6, particleEffects: ['heal_particles', 'nanite_swarm'] },
      unlockRequirements: { level: 10, gold: 500, dust: 35 }
    },
    {
      tier: 3,
      name: 'Unit-M "Medic" APEX',
      statMultiplier: 2.0,
      skills: [
        {
          id: 'resurrection_field',
          name: 'Pole Reanimacyjne',
          description: 'Tworzy strefę leczącą 20 HP/s przez 10s w obszarze',
          cooldownTicks: 300,
          isPassive: false,
          isUltimate: false,
          unlockedAtLevel: 20,
          effects: [
            { type: 'heal', amount: 20, target: 'area' }
          ]
        },
        {
          id: 'emergency_protocol',
          name: 'Protokół Awaryjny',
          description: 'ULTIMATE: Natychmiast leczy wszystkich sojuszników do pełnego HP i daje 5s nietykalności najniższemu HP',
          cooldownTicks: 900,
          isPassive: false,
          isUltimate: true,
          unlockedAtLevel: 25,
          effects: [
            { type: 'heal', amount: 9999, target: 'all' }
            // + invulnerability for lowest HP ally - wymaga osobnej implementacji
          ]
        }
      ],
      visualChanges: {
        sizeMultiplier: 1.2,
        glowIntensity: 0.9,
        particleEffects: ['heal_particles', 'nanite_swarm', 'resurrection_glow'],
        colorShift: 0x00ff7f
      },
      unlockRequirements: { level: 20, gold: 2000, dust: 140, material: 'extremis' }
    }
  ]
};

// ============================================================================
// UNIT 12: PYRO (Unit-P "Pyro" - Fire/DPS) - NEW STARTER FIRE DPS
// ============================================================================

const UNIT_PYRO: HeroDefinition = {
  id: 'pyro',
  name: 'Unit-P "Pyro"',
  class: 'fire',
  role: 'dps',
  rarity: 'starter',
  baseStats: {
    hp: 260,
    damage: 28,
    attackSpeed: 1.0,
    range: FP.fromInt(6),
    moveSpeed: FP.fromFloat(0.13),
    deployCooldown: 300
  },
  colors: { primary: 0xff4500, secondary: 0xff6347, glow: 0xffa500 },
  shape: 'triangle',
  weaknesses: [
    {
      id: 'ice_vulnerability',
      name: 'Wrażliwość na Lód',
      description: 'Ice zadaje +30% DMG',
      effect: { type: 'damage_vulnerability', damageClass: 'ice', multiplier: 1.30 }
    }
  ],
  tiers: [
    {
      tier: 1,
      name: 'Unit-P "Pyro"',
      statMultiplier: 1.0,
      skills: [
        {
          id: 'flame_burst',
          name: 'Wybuch Płomieni',
          description: 'Obszarowy atak zadający 35 DMG + podpalenie (10 DMG/s przez 3s)',
          cooldownTicks: 150,
          isPassive: false,
          isUltimate: false,
          unlockedAtLevel: 1,
          effects: [
            { type: 'damage', amount: 35, target: 'area' },
            { type: 'burn', damagePerTick: 10, duration: 90 }
          ]
        },
        {
          id: 'burning_touch',
          name: 'Płonący Dotyk',
          description: 'Podstawowe ataki podpalają cele na 2s (5 DMG/s)',
          cooldownTicks: 0,
          isPassive: true,
          isUltimate: false,
          unlockedAtLevel: 1,
          effects: []
        }
      ],
      visualChanges: { sizeMultiplier: 1.0, glowIntensity: 0.5, particleEffects: ['fire_sparks'] },
      unlockRequirements: { level: 1, gold: 0, dust: 0 }
    },
    {
      tier: 2,
      name: 'Unit-P "Pyro" Mk.II',
      statMultiplier: 1.5,
      skills: [
        {
          id: 'inferno_wave',
          name: 'Fala Inferno',
          description: 'Obszarowa fala ognia zadająca 60 DMG + podpalenie (15 DMG/s przez 4s)',
          cooldownTicks: 210,
          isPassive: false,
          isUltimate: false,
          unlockedAtLevel: 10,
          effects: [
            { type: 'damage', amount: 60, target: 'area' },
            { type: 'burn', damagePerTick: 15, duration: 120 }
          ]
        },
        {
          id: 'fire_mastery',
          name: 'Mistrzostwo Ognia',
          description: '+25% obrażeń od ognia, +10% szansa na kryt',
          cooldownTicks: 0,
          isPassive: true,
          isUltimate: false,
          unlockedAtLevel: 10,
          effects: []
        }
      ],
      visualChanges: { sizeMultiplier: 1.2, glowIntensity: 0.7, particleEffects: ['fire_sparks', 'flame_trail'] },
      unlockRequirements: { level: 10, gold: 500, dust: 35 }
    },
    {
      tier: 3,
      name: 'Unit-P "Pyro" APEX',
      statMultiplier: 2.0,
      skills: [
        {
          id: 'hellfire',
          name: 'Piekielny Ogień',
          description: 'Potężny atak obszarowy zadający 100 DMG + intensywne podpalenie (25 DMG/s przez 5s)',
          cooldownTicks: 270,
          isPassive: false,
          isUltimate: false,
          unlockedAtLevel: 20,
          effects: [
            { type: 'damage', amount: 100, target: 'area' },
            { type: 'burn', damagePerTick: 25, duration: 150 }
          ]
        },
        {
          id: 'combustion',
          name: 'Samozapłon',
          description: 'ULTIMATE: Detonuje wszystkie podpalenia - 200 DMG + natychmiastowe obrażenia równe pozostałemu burn DMG',
          cooldownTicks: 720,
          isPassive: false,
          isUltimate: true,
          unlockedAtLevel: 25,
          effects: [
            { type: 'damage', amount: 200, target: 'all' }
            // + instant burn damage - wymaga osobnej implementacji
          ]
        }
      ],
      visualChanges: {
        sizeMultiplier: 1.3,
        glowIntensity: 1.0,
        particleEffects: ['fire_sparks', 'flame_trail', 'inferno_aura'],
        colorShift: 0xff4500
      },
      unlockRequirements: { level: 20, gold: 2000, dust: 140, material: 'extremis' }
    }
  ]
};

// ============================================================================
// ALL UNITS EXPORT (13 Units)
// ============================================================================

export const HEROES: HeroDefinition[] = [
  UNIT_STORM,
  UNIT_SCOUT,
  UNIT_FORGE,
  UNIT_TITAN,
  UNIT_VANGUARD,
  UNIT_RIFT,
  UNIT_FROST,
  UNIT_SPECTRE,
  UNIT_OMEGA,
  UNIT_INFERNO,
  UNIT_GLACIER,
  UNIT_MEDIC,
  UNIT_PYRO
];

// Legacy aliases for migration
export const THUNDERLORD = UNIT_STORM;
export const IRON_SENTINEL = UNIT_FORGE;
export const JADE_TITAN = UNIT_TITAN;
export const SHIELD_CAPTAIN = UNIT_VANGUARD;
export const SCARLET_MAGE = UNIT_RIFT;
export const FROST_ARCHER = UNIT_FROST;

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

// Premium shop heroes - not available via regular unlock
export const PREMIUM_SHOP_HERO_IDS = ['inferno', 'glacier'] as const;

export function isPremiumShopHero(heroId: string): boolean {
  return PREMIUM_SHOP_HERO_IDS.includes(heroId as typeof PREMIUM_SHOP_HERO_IDS[number]);
}

export function getHeroUnlockCost(heroId: string): { gold: number; dust: number } | undefined {
  const hero = getHeroById(heroId);
  if (!hero) return undefined;

  // Premium shop exclusive heroes - cannot be unlocked with gold/dust
  if (isPremiumShopHero(heroId)) {
    return undefined; // Must be purchased from shop with PLN
  }

  // Special exclusive heroes (available from level 1 with special pricing)
  if (heroId === 'spectre') {
    return { gold: 25000, dust: 0 }; // Exclusive rare - gold only
  }
  if (heroId === 'omega') {
    return { gold: 50000, dust: 50 }; // Legendary exclusive - expensive
  }
  if (heroId === 'scout') {
    return { gold: 7500, dust: 0 }; // Early game hero - available from level 1, gold only
  }

  switch (hero.rarity) {
    case 'starter': return { gold: 0, dust: 0 };
    case 'common': return { gold: 3000, dust: 0 };      // No dust for commons
    case 'rare': return { gold: 6000, dust: 0 };
    case 'epic': return { gold: 12000, dust: 0 };
    case 'legendary': return { gold: 25000, dust: 50 };
    default: return { gold: 0, dust: 0 };
  }
}

export function getHeroTier(heroId: string, tier: 1 | 2 | 3): HeroTier | undefined {
  const hero = getHeroById(heroId);
  if (!hero) return undefined;
  return hero.tiers[tier - 1];
}

/**
 * Check if a hero has a specific passive skill unlocked
 * @param heroId - Hero definition ID
 * @param passiveId - Passive skill ID to check for
 * @param heroTier - Current tier (1-3)
 * @param heroLevel - Current level
 * @returns true if the passive is unlocked and available
 */
export function hasHeroPassive(heroId: string, passiveId: string, heroTier: 1 | 2 | 3, heroLevel: number): boolean {
  const hero = getHeroById(heroId);
  if (!hero) return false;

  // Check all tiers up to current tier
  for (let t = 0; t < heroTier; t++) {
    const tier = hero.tiers[t];
    if (!tier) continue;

    for (const skill of tier.skills) {
      if (skill.id === passiveId && skill.isPassive) {
        // Check if level requirement is met
        if (heroLevel >= skill.unlockedAtLevel) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Get all unlocked passive skills for a hero
 * @param heroId - Hero definition ID
 * @param heroTier - Current tier (1-3)
 * @param heroLevel - Current level
 * @returns Array of passive skill IDs
 */
export function getHeroPassives(heroId: string, heroTier: 1 | 2 | 3, heroLevel: number): string[] {
  const hero = getHeroById(heroId);
  if (!hero) return [];

  const passives: string[] = [];

  // Check all tiers up to current tier
  for (let t = 0; t < heroTier; t++) {
    const tier = hero.tiers[t];
    if (!tier) continue;

    for (const skill of tier.skills) {
      if (skill.isPassive && heroLevel >= skill.unlockedAtLevel) {
        passives.push(skill.id);
      }
    }
  }

  return passives;
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
