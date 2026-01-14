/**
 * Fortress Configuration Definitions
 * 5 unique configurations with 2 skills each
 *
 * Rebranded to Military Sci-Fi theme (2347 lore)
 */

import type { FortressClass, FortressClassDefinition, SkillDefinition } from '../types.js';

// ============================================================================
// SKILL DEFINITIONS FOR EACH CONFIGURATION (2 skills per config)
// ============================================================================

const STANDARD_SKILLS: SkillDefinition[] = [
  {
    id: 'earthquake',
    name: 'Fala Uderzeniowa',
    description: 'Wysyła falę uderzeniową zadającą obrażenia i spowalniającą wrogów',
    cooldownTicks: 450, // 15s
    damage: 40,
    radius: 15,
    unlockedAtFortressLevel: 1,
    effects: [
      { type: 'damage', amount: 40, target: 'area' },
      { type: 'slow', percent: 30, duration: 90 }
    ]
  },
  {
    id: 'vine_snare',
    name: 'Pole Grawitacyjne',
    description: 'Tworzy pole unieruchamiające wrogów w obszarze',
    cooldownTicks: 600, // 20s
    damage: 0,
    radius: 8,
    unlockedAtFortressLevel: 5,
    effects: [
      { type: 'stun', duration: 60 }
    ]
  }
];

const CRYO_SKILLS: SkillDefinition[] = [
  {
    id: 'blizzard',
    name: 'Kriogeniczny Wir',
    description: 'Pole kriogeniczne zadające obrażenia w czasie i spowalniające',
    cooldownTicks: 480, // 16s
    damage: 15,
    radius: 12,
    duration: 180,
    unlockedAtFortressLevel: 1,
    effects: [
      { type: 'damage', amount: 15, target: 'area' },
      { type: 'slow', percent: 50, duration: 180 }
    ]
  },
  {
    id: 'ice_spike',
    name: 'Kriogeniczny Pocisk',
    description: 'Pojedynczy potężny atak zamrażający cel',
    cooldownTicks: 300, // 10s
    damage: 80,
    unlockedAtFortressLevel: 5,
    effects: [
      { type: 'damage', amount: 80, target: 'single' },
      { type: 'freeze', duration: 90 }
    ]
  }
];

const THERMAL_SKILLS: SkillDefinition[] = [
  {
    id: 'meteor_strike',
    name: 'Bombardowanie Orbitalne',
    description: 'Uderzenie kinetyczne z orbity zadające masowe obrażenia termiczne',
    cooldownTicks: 540, // 18s
    damage: 100,
    radius: 10,
    unlockedAtFortressLevel: 1,
    effects: [
      { type: 'damage', amount: 100, target: 'area' },
      { type: 'burn', damagePerTick: 5, duration: 150 }
    ]
  },
  {
    id: 'flame_wave',
    name: 'Fala Termiczna',
    description: 'Fala ciepła przechodząca przez wszystkich wrogów',
    cooldownTicks: 360, // 12s
    damage: 50,
    unlockedAtFortressLevel: 5,
    effects: [
      { type: 'damage', amount: 50, target: 'all' },
      { type: 'burn', damagePerTick: 3, duration: 90 }
    ]
  }
];

const ELECTRIC_SKILLS: SkillDefinition[] = [
  {
    id: 'thunderstorm',
    name: 'Pole Jonizacyjne',
    description: 'Generuje losowe wyładowania elektryczne w obszarze',
    cooldownTicks: 420, // 14s
    damage: 60,
    duration: 180,
    unlockedAtFortressLevel: 1,
    effects: [
      { type: 'damage', amount: 60, target: 'area' },
      { type: 'stun', duration: 30 }
    ]
  },
  {
    id: 'chain_lightning',
    name: 'Łańcuch Łukowy',
    description: 'Wyładowanie elektryczne skaczące między wrogami',
    cooldownTicks: 240, // 8s
    damage: 45,
    unlockedAtFortressLevel: 5,
    effects: [
      { type: 'damage', amount: 45, target: 'single' }
      // Chain effect handled by modifier system
    ]
  }
];

const QUANTUM_SKILLS: SkillDefinition[] = [
  {
    id: 'laser_barrage',
    name: 'Salwa Kwantowa',
    description: 'Wiele precyzyjnych wiązek fotonowych',
    cooldownTicks: 300, // 10s
    damage: 35,
    unlockedAtFortressLevel: 1,
    effects: [
      { type: 'damage', amount: 35, target: 'area' }
    ]
  },
  {
    id: 'emp_blast',
    name: 'Impuls Destabilizacyjny',
    description: 'Zakłóca pole ochronne wrogów i zadaje obrażenia',
    cooldownTicks: 480, // 16s
    damage: 40,
    unlockedAtFortressLevel: 5,
    effects: [
      { type: 'damage', amount: 40, target: 'all' },
      { type: 'buff', stat: 'damageBonus', amount: 0.3, duration: 240 }
    ]
  }
];

const VOID_SKILLS: SkillDefinition[] = [
  {
    id: 'dimensional_tear',
    name: 'Rozdarcie Wymiarowe',
    description: 'Otwiera portal zadający obrażenia w obszarze',
    cooldownTicks: 420, // 14s
    damage: 70,
    radius: 8,
    unlockedAtFortressLevel: 1,
    effects: [
      { type: 'damage', amount: 70, target: 'area' },
      { type: 'slow', percent: 35, duration: 120 }
    ]
  },
  {
    id: 'void_collapse',
    name: 'Kolaps Próżni',
    description: 'Implozja energii próżniowej wciągająca wrogów',
    cooldownTicks: 540, // 18s
    damage: 90,
    unlockedAtFortressLevel: 5,
    effects: [
      { type: 'damage', amount: 90, target: 'all' },
      { type: 'stun', duration: 45 }
    ]
  }
];

// ============================================================================
// CONFIGURATION DEFINITIONS (6 configs)
// ============================================================================

export const FORTRESS_CLASSES: FortressClassDefinition[] = [
  // STANDARD - Base configuration, balanced with regeneration
  {
    id: 'natural',
    name: 'Konfiguracja Standardowa',
    description: 'Zbalansowany profil z regeneracją tarczy. Rekomendowana dla nowych dowódców.',
    colors: {
      primary: 0x228b22,     // Forest Green
      secondary: 0x8fbc8f,   // Dark Sea Green
      glow: 0x98fb98,        // Pale Green
      projectile: 0x32cd32   // Lime Green
    },
    passiveModifiers: {
      damageBonus: 0.1,             // +10% damage
      maxHpBonus: 0.15,             // +15% HP
      hpRegen: 2                    // +2 HP/5s
    },
    skills: STANDARD_SKILLS,
    projectileType: 'physical',
  },

  // CRYO - Crowd control and slow
  {
    id: 'ice',
    name: 'Konfiguracja Kriogeniczna',
    description: 'Kontrola pola walki i spowolnienie wrogów. Wolniejsze ale mocniejsze ataki.',
    colors: {
      primary: 0x00bfff,     // Deep Sky Blue
      secondary: 0xe0ffff,   // Light Cyan
      glow: 0x87ceeb,        // Sky Blue
      projectile: 0xadd8e6   // Light Blue
    },
    passiveModifiers: {
      attackSpeedBonus: -0.1,       // -10% attack speed
      damageBonus: 0.2,             // +20% damage
      critDamageBonus: 0.25         // +25% crit damage (0.5 base)
    },
    skills: CRYO_SKILLS,
    projectileType: 'icicle',
  },

  // THERMAL - Maximum damage and DOT
  {
    id: 'fire',
    name: 'Konfiguracja Termiczna',
    description: 'Maksymalne obrażenia i efekty termiczne. Dla agresywnych taktyk.',
    colors: {
      primary: 0xff4500,     // Orange Red
      secondary: 0xff8c00,   // Dark Orange
      glow: 0xffd700,        // Gold
      projectile: 0xff6347   // Tomato
    },
    passiveModifiers: {
      damageBonus: 0.2,             // +20% damage
      critChance: 0.08,             // +8% crit chance
      splashDamagePercent: 0.25,    // 25% splash damage
      splashRadiusBonus: 2          // 2 unit splash radius
    },
    skills: THERMAL_SKILLS,
    projectileType: 'fireball',
  },

  // ELECTRIC - Fast attacks and chain
  {
    id: 'lightning',
    name: 'Konfiguracja Elektryczna',
    description: 'Szybkie ataki i efekty łańcuchowe. Doskonała przeciwko grupom wrogów.',
    colors: {
      primary: 0x9932cc,     // Dark Orchid
      secondary: 0xdda0dd,   // Plum
      glow: 0xffff00,        // Yellow
      projectile: 0xe6e6fa   // Lavender
    },
    passiveModifiers: {
      attackSpeedBonus: 0.4,        // +40% attack speed
      chainChance: 0.25,            // +25% chain chance
      chainCount: 2,                // +2 chain targets
      chainDamagePercent: 0.6       // 60% chain damage
    },
    skills: ELECTRIC_SKILLS,
    projectileType: 'bolt',
  },

  // QUANTUM - Precision and economy
  {
    id: 'tech',
    name: 'Konfiguracja Kwantowa',
    description: 'Precyzja, przebicie i bonusy zasobowe. Zaawansowana technologia.',
    colors: {
      primary: 0x00f0ff,     // Cyan (game theme)
      secondary: 0xff00aa,   // Pink (game theme)
      glow: 0xccff00,        // Lime (game theme)
      projectile: 0x00ffff   // Aqua
    },
    passiveModifiers: {
      pierceCount: 2,               // +2 pierce
      critChance: 0.15,             // +15% crit
      goldBonus: 0.15               // +15% gold
    },
    skills: QUANTUM_SKILLS,
    projectileType: 'laser',
  },

  // VOID - Dimensional damage and control
  {
    id: 'void',
    name: 'Konfiguracja Próżniowa',
    description: 'Energia wymiarowa z efektami chaosu. Dla doświadczonych dowódców.',
    colors: {
      primary: 0x4b0082,     // Indigo
      secondary: 0x8b008b,   // Dark Magenta
      glow: 0x9400d3,        // Dark Violet
      projectile: 0x7b68ee   // Medium Slate Blue
    },
    passiveModifiers: {
      damageBonus: 0.15,            // +15% damage
      maxHpBonus: 0.1,              // +10% HP
      critChance: 0.1,              // +10% crit
      cooldownReduction: 0.1        // +10% cooldown reduction
    },
    skills: VOID_SKILLS,
    projectileType: 'bolt',
  }
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get class definition by ID
 */
export function getClassById(classId: FortressClass): FortressClassDefinition | undefined {
  return FORTRESS_CLASSES.find(c => c.id === classId);
}

/**
 * Get all unlocked skills for a class at a given fortress level
 */
export function getUnlockedSkills(classId: FortressClass, fortressLevel: number): SkillDefinition[] {
  const classDef = getClassById(classId);
  if (!classDef) return [];

  return classDef.skills.filter(skill => skill.unlockedAtFortressLevel <= fortressLevel);
}

/**
 * Get skill by ID within a class
 */
export function getSkillById(classId: FortressClass, skillId: string): SkillDefinition | undefined {
  const classDef = getClassById(classId);
  if (!classDef) return undefined;

  return classDef.skills.find(s => s.id === skillId);
}

