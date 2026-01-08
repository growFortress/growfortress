/**
 * Fortress Class Definitions
 * 5 unique classes with 2 skills each
 */

import type { FortressClass, FortressClassDefinition, SkillDefinition } from '../types.js';

// ============================================================================
// SKILL DEFINITIONS FOR EACH CLASS (2 skills per class)
// ============================================================================

const NATURAL_SKILLS: SkillDefinition[] = [
  {
    id: 'earthquake',
    name: 'Trzęsienie Ziemi',
    description: 'Zadaje obrażenia wszystkim wrogom w obszarze i spowalnia ich',
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
    name: 'Pnącza Sidła',
    description: 'Unieruchamia wrogów w obszarze',
    cooldownTicks: 600, // 20s
    damage: 0,
    radius: 8,
    unlockedAtFortressLevel: 5,
    effects: [
      { type: 'stun', duration: 60 }
    ]
  }
];

const ICE_SKILLS: SkillDefinition[] = [
  {
    id: 'blizzard',
    name: 'Zamieć',
    description: 'Lodowa burza zadająca obrażenia w czasie i spowalniająca',
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
    name: 'Lodowy Kolec',
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

const FIRE_SKILLS: SkillDefinition[] = [
  {
    id: 'meteor_strike',
    name: 'Uderzenie Meteoru',
    description: 'Ogromny meteor zadający masowe obrażenia i podpalający',
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
    name: 'Fala Ognia',
    description: 'Fala ognia przechodząca przez wszystkich wrogów',
    cooldownTicks: 360, // 12s
    damage: 50,
    unlockedAtFortressLevel: 5,
    effects: [
      { type: 'damage', amount: 50, target: 'all' },
      { type: 'burn', damagePerTick: 3, duration: 90 }
    ]
  }
];

const LIGHTNING_SKILLS: SkillDefinition[] = [
  {
    id: 'thunderstorm',
    name: 'Burza z Piorunami',
    description: 'Losowe uderzenia piorunów w obszarze',
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
    name: 'Łańcuch Błyskawic',
    description: 'Błyskawica skacząca między wrogami',
    cooldownTicks: 240, // 8s
    damage: 45,
    unlockedAtFortressLevel: 5,
    effects: [
      { type: 'damage', amount: 45, target: 'single' }
      // Chain effect handled by modifier system
    ]
  }
];

const TECH_SKILLS: SkillDefinition[] = [
  {
    id: 'laser_barrage',
    name: 'Salwa Laserowa',
    description: 'Wiele precyzyjnych laserowych strzałów',
    cooldownTicks: 300, // 10s
    damage: 35,
    unlockedAtFortressLevel: 1,
    effects: [
      { type: 'damage', amount: 35, target: 'area' }
    ]
  },
  {
    id: 'emp_blast',
    name: 'Impuls EMP',
    description: 'Obniża obronę wrogów i zadaje obrażenia',
    cooldownTicks: 480, // 16s
    damage: 40,
    unlockedAtFortressLevel: 5,
    effects: [
      { type: 'damage', amount: 40, target: 'all' },
      { type: 'buff', stat: 'damageMultiplier', amount: 1.3, duration: 240 }
    ]
  }
];

// ============================================================================
// CLASS DEFINITIONS (5 classes)
// ============================================================================

export const FORTRESS_CLASSES: FortressClassDefinition[] = [
  // NATURAL - Base class, balanced with regeneration
  {
    id: 'natural',
    name: 'Twierdza Natury',
    description: 'Surowa siła fizyczna i regeneracja. Zbalansowana klasa startowa.',
    colors: {
      primary: 0x228b22,     // Forest Green
      secondary: 0x8fbc8f,   // Dark Sea Green
      glow: 0x98fb98,        // Pale Green
      projectile: 0x32cd32   // Lime Green
    },
    passiveModifiers: {
      damageMultiplier: 1.1,        // +10% damage
      maxHpMultiplier: 1.15,        // +15% HP
      hpRegen: 2                    // +2 HP/5s
    },
    skills: NATURAL_SKILLS,
    projectileType: 'physical',
    unlockCost: { gold: 0, dust: 0 }  // Free, starting class
  },

  // ICE - Crowd control and slow
  {
    id: 'ice',
    name: 'Lodowa Cytadela',
    description: 'Kontrola terenu i spowolnienie wrogów. Wolniejsze ale mocniejsze ataki.',
    colors: {
      primary: 0x00bfff,     // Deep Sky Blue
      secondary: 0xe0ffff,   // Light Cyan
      glow: 0x87ceeb,        // Sky Blue
      projectile: 0xadd8e6   // Light Blue
    },
    passiveModifiers: {
      attackSpeedMultiplier: 0.9,   // -10% attack speed
      damageMultiplier: 1.2,        // +20% damage
      critDamage: 1.75              // +25% crit damage (1.5 base)
    },
    skills: ICE_SKILLS,
    projectileType: 'icicle',
    unlockCost: { gold: 500, dust: 50 }
  },

  // FIRE - Maximum damage and DOT
  {
    id: 'fire',
    name: 'Ognista Forteca',
    description: 'Maksymalne obrażenia i efekty podpalenia. Klasa dla agresywnych graczy.',
    colors: {
      primary: 0xff4500,     // Orange Red
      secondary: 0xff8c00,   // Dark Orange
      glow: 0xffd700,        // Gold
      projectile: 0xff6347   // Tomato
    },
    passiveModifiers: {
      damageMultiplier: 1.2,        // +20% damage
      critChance: 0.08,             // +8% crit chance
      splashDamage: 0.25,           // 25% splash damage
      splashRadius: 2               // 2 unit splash radius
    },
    skills: FIRE_SKILLS,
    projectileType: 'fireball',
    unlockCost: { gold: 500, dust: 50 }
  },

  // LIGHTNING - Fast attacks and chain
  {
    id: 'lightning',
    name: 'Bastion Burzy',
    description: 'Szybkie ataki i efekty łańcuchowe. Doskonały przeciwko grupom wrogów.',
    colors: {
      primary: 0x9932cc,     // Dark Orchid
      secondary: 0xdda0dd,   // Plum
      glow: 0xffff00,        // Yellow
      projectile: 0xe6e6fa   // Lavender
    },
    passiveModifiers: {
      attackSpeedMultiplier: 1.4,   // +40% attack speed
      chainChance: 0.25,            // +25% chain chance
      chainCount: 2,                // +2 chain targets
      chainDamage: 0.6              // 60% chain damage
    },
    skills: LIGHTNING_SKILLS,
    projectileType: 'bolt',
    unlockCost: { gold: 750, dust: 75 }
  },

  // TECH - Precision and economy
  {
    id: 'tech',
    name: 'Cyber Forteca',
    description: 'Precyzja, przebicie i bonusy ekonomiczne. Dominuje w filarze Nauki.',
    colors: {
      primary: 0x00f0ff,     // Cyan (game theme)
      secondary: 0xff00aa,   // Pink (game theme)
      glow: 0xccff00,        // Lime (game theme)
      projectile: 0x00ffff   // Aqua
    },
    passiveModifiers: {
      pierceCount: 2,               // +2 pierce
      critChance: 0.15,             // +15% crit
      goldMultiplier: 1.15          // +15% gold
    },
    skills: TECH_SKILLS,
    projectileType: 'laser',
    unlockCost: { gold: 750, dust: 75 }
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

/**
 * Check if a class is unlocked (has been purchased)
 */
export function isClassUnlocked(classId: FortressClass, unlockedClasses: FortressClass[]): boolean {
  if (classId === 'natural') return true; // Always unlocked
  return unlockedClasses.includes(classId);
}

/**
 * Get all classes that can be unlocked
 */
export function getUnlockableClasses(): FortressClassDefinition[] {
  return FORTRESS_CLASSES.filter(c => c.id !== 'natural');
}

/**
 * Calculate total unlock cost for a class
 */
export function getClassUnlockCost(classId: FortressClass): { gold: number; dust: number } {
  const classDef = getClassById(classId);
  return classDef?.unlockCost ?? { gold: 0, dust: 0 };
}
