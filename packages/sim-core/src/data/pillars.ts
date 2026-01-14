/**
 * Sectors (Sektory) - Rozdziały gry
 *
 * 6 Sektorów reprezentujących różne strefy walki:
 * 1. Ulice (Streets) - Gangi, najemnicy, lokalni przeciwnicy
 * 2. Nauka i Technologia (Science) - Roboty, AI, drony bojowe
 * 3. Mutanci (Mutants) - Biomodyfikowane jednostki, łowcy
 * 4. Kosmos (Cosmos) - Kosmici, stacje orbitalne, imperia
 * 5. Magia (Magic) - Anomalie, byty wymiarowe
 * 6. Nexus (Gods) - Elite, tytani, kosmiczne zagrożenia
 *
 * Każdy sektor ma modyfikatory dla konfiguracji, wpływające na efektywność.
 */

import { FortressClass, PillarId, FP } from '../types';

// ============================================================================
// INTERFEJSY
// ============================================================================

export interface PillarClassModifier {
  class: FortressClass;
  damageMultiplier: FP; // 16384 = 1.0
  description: string;
}

export interface PillarEnemy {
  type: string;
  name: string;
  description: string;
}

export interface PillarBoss {
  id: string;
  name: string;
  inspiration: string; // Boss archetype/theme
  abilities: string[];
  drops: string[]; // Możliwe dropy (materiały, kryształy, etc.)
}

export interface PillarDefinition {
  id: PillarId;
  name: string;
  subtitle: string;
  description: string;

  // Zakres fal
  waveRange: {
    start: number;
    end: number;
  };

  // Wymagany poziom twierdzy do odblokowania
  unlockRequirement: {
    fortressLevel: number;
  };

  // Sceneria
  scenery: {
    background: string;
    ambiance: string;
    colors: {
      primary: number;
      secondary: number;
      accent: number;
    };
  };

  // Modyfikatory klas
  classModifiers: PillarClassModifier[];

  // Typy wrogów
  enemies: PillarEnemy[];

  // Bossowie
  bosses: PillarBoss[];

  // Naturalni bohaterowie dla tego filaru (bonus gdy są używani)
  naturalHeroes: string[];

  // Specjalne mechaniki filaru
  specialMechanics?: {
    id: string;
    name: string;
    description: string;
  }[];

  // Nagrody za ukończenie
  rewards: {
    firstCompletion: {
      dust: number;
      fortressXp: number;
      unlocks?: string[];
    };
    regularCompletion: {
      dust: number;
      fortressXp: number;
    };
  };
}

// ============================================================================
// FILAR 1: ULICE (Street Level)
// ============================================================================

const PILLAR_STREETS: PillarDefinition = {
  id: 'streets',
  name: 'Ulice',
  subtitle: 'Street Level',
  description: 'Miasto nocą. Gangsterzy, złodzieje i uliczni przestępcy czekają w mrocznych zaułkach.',

  waveRange: { start: 1, end: 10 },

  unlockRequirement: { fortressLevel: 1 },

  scenery: {
    background: 'Nocne miasto, neonowe światła, deszcz',
    ambiance: 'Uliczne dźwięki, syreny policyjne',
    colors: {
      primary: 0x1a1a2e,   // Ciemnoniebieski (noc)
      secondary: 0x16213e, // Granatowy
      accent: 0xff6b6b,    // Neonowy czerwony
    },
  },

  classModifiers: [
    { class: 'natural', damageMultiplier: 19661 as FP, description: 'Siła fizyczna dominuje na ulicach (+20% DMG)' },
    { class: 'tech', damageMultiplier: 18842 as FP, description: 'Gadżety przydatne w mieście (+15% DMG)' },
    { class: 'ice', damageMultiplier: 16384 as FP, description: 'Neutralne' },
    { class: 'lightning', damageMultiplier: 16384 as FP, description: 'Neutralne' },
    { class: 'fire', damageMultiplier: 14746 as FP, description: 'Ryzyko pożaru ogranicza użycie (-10% DMG)' },
  ],

  enemies: [
    { type: 'thug', name: 'Bandyta', description: 'Podstawowy przestępca z bronią białą' },
    { type: 'gunner', name: 'Strzelec', description: 'Przestępca z bronią palną' },
    { type: 'gang_leader', name: 'Szef gangu', description: 'Silniejszy bandyta z ochroniarzami' },
    { type: 'ninja', name: 'Ninja Hand', description: 'Zwinny zabójca z kataną' },
  ],

  bosses: [
    {
      id: 'kingpin',
      name: 'Kingpin',
      inspiration: 'Wilson Fisk',
      abilities: ['Crushing Blow', 'Call Reinforcements', 'Armored Suit'],
      drops: ['gold', 'dust', 'rare: super_soldier_serum'],
    },
    {
      id: 'bullseye',
      name: 'Bullseye',
      inspiration: 'Bullseye',
      abilities: ['Perfect Aim', 'Ricochet Shot', 'Deadly Precision'],
      drops: ['gold', 'dust'],
    },
  ],

  naturalHeroes: ['vanguard'],

  rewards: {
    firstCompletion: {
      dust: 50,
      fortressXp: 1000,
      unlocks: ['pillar_science'],
    },
    regularCompletion: {
      dust: 12,
      fortressXp: 200,
    },
  },
};

// ============================================================================
// FILAR 2: NAUKA I TECHNOLOGIA
// ============================================================================

const PILLAR_SCIENCE: PillarDefinition = {
  id: 'science',
  name: 'Nauka i Technologia',
  subtitle: 'Science & Tech',
  description: 'Laboratoria, fabryki i kompleksy badawcze. Roboty i AI stanowią główne zagrożenie.',

  waveRange: { start: 11, end: 25 },

  unlockRequirement: { fortressLevel: 25 },

  scenery: {
    background: 'Sterylne laboratoria, hologramy, maszyny',
    ambiance: 'Buczenie maszyn, cyfrowe alarmy',
    colors: {
      primary: 0x0a192f,   // Ciemny tech blue
      secondary: 0x00f0ff, // Cyan
      accent: 0x64ffda,    // Neonowy zielony
    },
  },

  classModifiers: [
    { class: 'tech', damageMultiplier: 20480 as FP, description: 'Dominacja technologiczna (+25% DMG)' },
    { class: 'lightning', damageMultiplier: 18842 as FP, description: 'Skuteczne vs elektronika (+15% DMG)' },
    { class: 'ice', damageMultiplier: 16384 as FP, description: 'Neutralne' },
    { class: 'fire', damageMultiplier: 16384 as FP, description: 'Neutralne' },
    { class: 'natural', damageMultiplier: 13926 as FP, description: 'Siła fizyczna mniej skuteczna vs roboty (-15% DMG)' },
  ],

  enemies: [
    { type: 'drone', name: 'Dron bojowy', description: 'Latający robot z laserem' },
    { type: 'robot', name: 'Robot ochronny', description: 'Ciężki robot bojowy' },
    { type: 'scientist', name: 'Szalony naukowiec', description: 'Naukowiec z eksperymentalną bronią' },
    { type: 'ai_unit', name: 'Jednostka AI', description: 'Autonomiczna jednostka bojowa' },
  ],

  bosses: [
    {
      id: 'ultron',
      name: 'Ultron Prime',
      inspiration: 'Ultron',
      abilities: ['Laser Beam', 'Drone Swarm', 'Self-Repair', 'Upgrade Protocol'],
      drops: ['gold', 'dust', 'rare: extremis', 'very_rare: mind_stone_fragment'],
    },
    {
      id: 'modok',
      name: 'M.O.D.O.K.',
      inspiration: 'M.O.D.O.K.',
      abilities: ['Psionic Blast', 'Force Field', 'Mind Control'],
      drops: ['gold', 'dust', 'rare: pym_particles'],
    },
  ],

  naturalHeroes: ['forge'],

  specialMechanics: [
    {
      id: 'emp_vulnerability',
      name: 'Podatność na EMP',
      description: 'Wrogowie typu robot otrzymują +50% obrażeń od Lightning',
    },
    {
      id: 'self_repair',
      name: 'Autoreperacja',
      description: 'Niektórzy wrogowie regenerują HP gdy nie są atakowani',
    },
  ],

  rewards: {
    firstCompletion: {
      dust: 100,
      fortressXp: 2000,
      unlocks: ['pillar_mutants'],
    },
    regularCompletion: {
      dust: 25,
      fortressXp: 400,
    },
  },
};

// ============================================================================
// FILAR 3: MUTANCI
// ============================================================================

const PILLAR_MUTANTS: PillarDefinition = {
  id: 'mutants',
  name: 'Mutanci i Dyskryminacja',
  subtitle: 'Mutant World',
  description: 'Akademia X-Men, podziemne bunkry i obozy dla mutantów. Sentinele polują na wszystkich.',

  waveRange: { start: 26, end: 40 },

  unlockRequirement: { fortressLevel: 35 },

  scenery: {
    background: 'Zrujnowane budynki, Akademia, Sentinel Factory',
    ambiance: 'Alarmy Sentineli, krzyki mutantów',
    colors: {
      primary: 0x2d132c,   // Ciemny fiolet
      secondary: 0x801336, // Bordowy
      accent: 0xee4540,    // Czerwony (Sentinele)
    },
  },

  classModifiers: [
    { class: 'natural', damageMultiplier: 19661 as FP, description: 'Mutacje wzmacniają naturę (+20% DMG)' },
    { class: 'fire', damageMultiplier: 18022 as FP, description: 'Ogień skuteczny vs organiczne cele (+10% DMG)' },
    { class: 'ice', damageMultiplier: 16384 as FP, description: 'Neutralne' },
    { class: 'lightning', damageMultiplier: 16384 as FP, description: 'Neutralne' },
    { class: 'tech', damageMultiplier: 14746 as FP, description: 'Sentinele adaptują się do tech (-10% DMG)' },
  ],

  enemies: [
    { type: 'sentinel', name: 'Sentinel', description: 'Gigantyczny robot łowca mutantów' },
    { type: 'purifier', name: 'Purifier', description: 'Fanatyk anty-mutancki' },
    { type: 'mutant_beast', name: 'Zmutowana bestia', description: 'Dzika zmutowana kreatura' },
    { type: 'prime_sentinel', name: 'Prime Sentinel', description: 'Sentinel z ludzkimi komponentami' },
  ],

  bosses: [
    {
      id: 'master_mold',
      name: 'Master Mold',
      inspiration: 'Master Mold',
      abilities: ['Spawn Sentinels', 'Adaptation', 'Mutant Detection', 'Omega Beam'],
      drops: ['gold', 'dust', 'rare: mutant_dna', 'very_rare: adamantium'],
    },
    {
      id: 'nimrod',
      name: 'Nimrod',
      inspiration: 'Nimrod',
      abilities: ['Time Displacement', 'Full Adaptation', 'Perfect Counter'],
      drops: ['gold', 'dust', 'rare: mutant_dna'],
    },
  ],

  naturalHeroes: ['titan', 'rift'],

  specialMechanics: [
    {
      id: 'sentinel_adaptation',
      name: 'Adaptacja Sentineli',
      description: 'Po 3 trafieniach tego samego typu, Sentinele zyskują 50% odporności',
    },
    {
      id: 'mutant_detection',
      name: 'Wykrywanie mutantów',
      description: 'Sentinele priorytetowo atakują bohaterów z klasą Natural i Magic',
    },
  ],

  rewards: {
    firstCompletion: {
      dust: 150,
      fortressXp: 3000,
      unlocks: ['pillar_cosmos'],
    },
    regularCompletion: {
      dust: 38,
      fortressXp: 600,
    },
  },
};

// ============================================================================
// FILAR 4: KOSMOS
// ============================================================================

const PILLAR_COSMOS: PillarDefinition = {
  id: 'cosmos',
  name: 'Kosmos i Imperia',
  subtitle: 'Cosmic Level',
  description: 'Statki kosmiczne, obce planety i asteroidy. Wojny galaktyczne między imperiami Kree i Skrull.',

  waveRange: { start: 41, end: 60 },

  unlockRequirement: { fortressLevel: 45 },

  scenery: {
    background: 'Przestrzeń kosmiczna, planety, statki',
    ambiance: 'Silniki kosmiczne, eksplozje, próżnia',
    colors: {
      primary: 0x0c0032,   // Głęboka przestrzeń
      secondary: 0x190061, // Kosmiczny fiolet
      accent: 0x3500d3,    // Neonowy fiolet
    },
  },

  classModifiers: [
    { class: 'tech', damageMultiplier: 19661 as FP, description: 'Zaawansowana technologia kosmiczna (+20% DMG)' },
    { class: 'lightning', damageMultiplier: 18842 as FP, description: 'Energia kosmiczna (+15% DMG)' },
    { class: 'fire', damageMultiplier: 18842 as FP, description: 'Słońca i wybuchy (+15% DMG)' },
    { class: 'ice', damageMultiplier: 14746 as FP, description: 'W próżni lód jest mniej skuteczny (-10% DMG)' },
    { class: 'natural', damageMultiplier: 12288 as FP, description: 'Siła fizyczna niewystarczająca (-25% DMG)' },
  ],

  enemies: [
    { type: 'kree_soldier', name: 'Żołnierz Kree', description: 'Wojownik niebieskiego imperium' },
    { type: 'skrull', name: 'Skrull', description: 'Zmiennokształtny infiltrator' },
    { type: 'chitauri', name: 'Chitauri', description: 'Kosmiczny żołnierz-dron' },
    { type: 'cosmic_beast', name: 'Kosmiczna bestia', description: 'Ogromna kosmiczna kreatura' },
  ],

  bosses: [
    {
      id: 'thanos_lieutenant',
      name: 'Corvus Glaive',
      inspiration: 'Black Order',
      abilities: ['Glaive Strike', 'Immortality', 'Dark Charge'],
      drops: ['gold', 'dust', 'rare: cosmic_dust', 'very_rare: power_stone_fragment'],
    },
    {
      id: 'ronan',
      name: 'Ronan the Accuser',
      inspiration: 'Ronan',
      abilities: ['Universal Weapon', 'Kree Judgment', 'Power Stone Beam'],
      drops: ['gold', 'dust', 'rare: cosmic_dust', 'rare: space_stone_fragment'],
    },
  ],

  naturalHeroes: ['storm'],

  specialMechanics: [
    {
      id: 'zero_gravity',
      name: 'Zero Grawitacji',
      description: 'Niektóre fale odbywają się w zerowej grawitacji - zmienione trajektorie pocisków',
    },
    {
      id: 'cosmic_radiation',
      name: 'Promieniowanie kosmiczne',
      description: 'Wszyscy otrzymują +10% DMG, ale -10% HP regen',
    },
  ],

  rewards: {
    firstCompletion: {
      dust: 200,
      fortressXp: 4000,
      unlocks: ['pillar_magic', 'pillar_gods'],
    },
    regularCompletion: {
      dust: 50,
      fortressXp: 800,
    },
  },
};

// ============================================================================
// FILAR 5: MAGIA
// ============================================================================

const PILLAR_MAGIC: PillarDefinition = {
  id: 'magic',
  name: 'Magia i Wymiary',
  subtitle: 'Mystic Realms',
  description: 'Wymiary alternatywne, Sanctum Sanctorum i Dark Dimension. Demony i byty wymiarowe.',

  waveRange: { start: 61, end: 80 },

  unlockRequirement: { fortressLevel: 50 },

  scenery: {
    background: 'Wymiary, portale, runy, Mirror Dimension',
    ambiance: 'Mistyczne szepty, dźwięki zaklęć',
    colors: {
      primary: 0x1a0a2e,   // Ciemny magiczny fiolet
      secondary: 0x6b21a8, // Fioletowy
      accent: 0xfbbf24,    // Złoto (runy)
    },
  },

  classModifiers: [
    { class: 'fire', damageMultiplier: 21299 as FP, description: 'Oczyszczający ogień dominuje vs demony (+30% DMG)' },
    { class: 'ice', damageMultiplier: 18022 as FP, description: 'Zamrażanie bytów wymiarowych (+10% DMG)' },
    { class: 'lightning', damageMultiplier: 16384 as FP, description: 'Neutralne' },
    { class: 'natural', damageMultiplier: 13107 as FP, description: 'Prawa fizyki nie obowiązują (-20% DMG)' },
    { class: 'tech', damageMultiplier: 11469 as FP, description: 'Technologia nie działa w innych wymiarach (-30% DMG)' },
  ],

  enemies: [
    { type: 'demon', name: 'Demon', description: 'Piekielna istota z Dark Dimension' },
    { type: 'mindless_one', name: 'Mindless One', description: 'Bezrozumna magiczna bestia' },
    { type: 'sorcerer', name: 'Czarnoksiężnik', description: 'Wróg władający czarną magią' },
    { type: 'dimensional_being', name: 'Byt wymiarowy', description: 'Istota z innego wymiaru' },
  ],

  bosses: [
    {
      id: 'dormammu',
      name: 'Dormammu',
      inspiration: 'Dormammu',
      abilities: ['Dark Dimension Power', 'Eternal Flame', 'Dimension Shift', 'Corruption'],
      drops: ['gold', 'dust', 'rare: darkforce', 'very_rare: time_stone_fragment', 'very_rare: reality_stone_fragment'],
    },
    {
      id: 'baron_mordo',
      name: 'Baron Mordo',
      inspiration: 'Mordo',
      abilities: ['Staff of Living Tribunal', 'Dark Magic', 'Sorcerer Duel'],
      drops: ['gold', 'dust', 'rare: darkforce'],
    },
  ],

  naturalHeroes: ['rift'],

  specialMechanics: [
    {
      id: 'reality_flux',
      name: 'Fluktuacja rzeczywistości',
      description: 'Co kilka fal losowo zmienia się modyfikator klasy (±10%)',
    },
    {
      id: 'dimension_shift',
      name: 'Przesunięcie wymiarowe',
      description: 'Wrogowie mogą teleportować się bliżej zamku',
    },
  ],

  rewards: {
    firstCompletion: {
      dust: 250,
      fortressXp: 5000,
    },
    regularCompletion: {
      dust: 62,
      fortressXp: 1000,
    },
  },
};

// ============================================================================
// FILAR 6: BOGOWIE
// ============================================================================

const PILLAR_GODS: PillarDefinition = {
  id: 'gods',
  name: 'Bogowie',
  subtitle: 'Divine Level',
  description: 'Asgard, Olympus, Hel i Valhalla. Bogowie, tytani i mityczne bestie czekają na wyzwanie.',

  waveRange: { start: 81, end: 100 },

  unlockRequirement: { fortressLevel: 50 },

  scenery: {
    background: 'Asgard, Rainbow Bridge, złote pałace',
    ambiance: 'Grzmoty, boskie chóry, epicki soundtrack',
    colors: {
      primary: 0x1a1a0f,   // Ciemne złoto
      secondary: 0xd4af37, // Złoty
      accent: 0xffd700,    // Jasne złoto
    },
  },

  classModifiers: [
    { class: 'lightning', damageMultiplier: 20480 as FP, description: 'Moc bogów burzy (+25% DMG)' },
    { class: 'fire', damageMultiplier: 19661 as FP, description: 'Boskie płomienie (+20% DMG)' },
    { class: 'natural', damageMultiplier: 18022 as FP, description: 'Prymitywna siła bogów (+10% DMG)' },
    { class: 'ice', damageMultiplier: 16384 as FP, description: 'Neutralne' },
    { class: 'tech', damageMultiplier: 9830 as FP, description: 'Technologia to zabawki dla bogów (-40% DMG)' },
  ],

  enemies: [
    { type: 'einherjar', name: 'Einherjar', description: 'Nieśmiertelny wojownik Valhalli' },
    { type: 'dark_elf', name: 'Mroczny Elf', description: 'Wojownik z Svartalfheim' },
    { type: 'fire_demon', name: 'Demon ognia', description: 'Istota z Muspelheim' },
    { type: 'frost_giant', name: 'Lodowy Olbrzym', description: 'Gigant z Jotunheim' },
  ],

  bosses: [
    {
      id: 'hela',
      name: 'Hela',
      inspiration: 'Hela',
      abilities: ['Necrosword', 'Army of the Dead', 'Goddess of Death', 'Asgardian Power'],
      drops: ['gold', 'dust', 'rare: uru', 'very_rare: soul_stone_fragment'],
    },
    {
      id: 'surtur',
      name: 'Surtur',
      inspiration: 'Surtur',
      abilities: ['Twilight Sword', 'Ragnarok Flame', 'Giant Form', 'Eternal Fire'],
      drops: ['gold', 'dust', 'rare: uru', 'legendary: infinity_gauntlet_fragment'],
    },
  ],

  naturalHeroes: ['storm', 'frost'],

  specialMechanics: [
    {
      id: 'divine_intervention',
      name: 'Boska interwencja',
      description: 'Raz na filar, losowy bóg może pomóc lub przeszkodzić',
    },
    {
      id: 'ragnarok_building',
      name: 'Nadchodzący Ragnarok',
      description: 'Z każdą falą rośnie moc Fire (kumulatywne +2% DMG)',
    },
  ],

  rewards: {
    firstCompletion: {
      dust: 375,
      fortressXp: 7500,
      unlocks: ['true_ending'],
    },
    regularCompletion: {
      dust: 88,
      fortressXp: 1500,
    },
  },
};

// ============================================================================
// EKSPORT
// ============================================================================

export const PILLAR_DEFINITIONS: PillarDefinition[] = [
  PILLAR_STREETS,
  PILLAR_SCIENCE,
  PILLAR_MUTANTS,
  PILLAR_COSMOS,
  PILLAR_MAGIC,
  PILLAR_GODS,
];

// ============================================================================
// FUNKCJE POMOCNICZE
// ============================================================================

/**
 * Pobiera filar po ID
 */
export function getPillarById(id: PillarId): PillarDefinition | undefined {
  return PILLAR_DEFINITIONS.find(p => p.id === id);
}

/**
 * Pobiera filar dla danej fali (obsługuje endless mode - fale 101+)
 */
export function getPillarForWave(wave: number): PillarDefinition | undefined {
  if (wave <= 0) return undefined;

  // Dla fal 101+, cykl przez filary (1-100 powtarza się)
  const effectiveWave = ((wave - 1) % 100) + 1;
  return PILLAR_DEFINITIONS.find(p =>
    effectiveWave >= p.waveRange.start && effectiveWave <= p.waveRange.end
  );
}

/**
 * Sprawdza czy filar jest odblokowany
 * W trybie Endless wszystkie filary są zawsze odblokowane
 */
export function isPillarUnlocked(pillarId: PillarId, _fortressLevel?: number): boolean {
  // Endless mode: wszystkie filary zawsze odblokowane
  return getPillarById(pillarId) !== undefined;
}

/**
 * Pobiera modyfikator klasy dla danego filaru
 */
export function getPillarClassModifier(
  pillarId: PillarId,
  fortressClass: FortressClass
): PillarClassModifier | undefined {
  const pillar = getPillarById(pillarId);
  if (!pillar) return undefined;
  return pillar.classModifiers.find(m => m.class === fortressClass);
}

/**
 * Oblicza efektywny mnożnik obrażeń dla klasy w danym filarze
 */
export function calculatePillarDamageMultiplier(
  pillarId: PillarId,
  fortressClass: FortressClass
): FP {
  const modifier = getPillarClassModifier(pillarId, fortressClass);
  return modifier?.damageMultiplier ?? 16384 as FP; // 1.0 default
}

/**
 * Pobiera naturalnych bohaterów dla filaru
 */
export function getNaturalHeroesForPillar(pillarId: PillarId): string[] {
  const pillar = getPillarById(pillarId);
  return pillar?.naturalHeroes ?? [];
}

/**
 * Sprawdza czy bohater jest naturalny dla filaru (bonus)
 */
export function isHeroNaturalForPillar(pillarId: PillarId, heroId: string): boolean {
  const naturalHeroes = getNaturalHeroesForPillar(pillarId);
  return naturalHeroes.includes(heroId);
}

/**
 * Pobiera odblokowane filary dla danego poziomu twierdzy
 * W trybie Endless wszystkie filary są zawsze odblokowane
 */
export function getUnlockedPillars(_fortressLevel?: number): PillarDefinition[] {
  // Endless mode: wszystkie filary zawsze dostępne
  return PILLAR_DEFINITIONS;
}

/**
 * Pobiera następny filar do odblokowania
 * W trybie Endless zwraca undefined (wszystko odblokowane)
 */
export function getNextPillarToUnlock(_fortressLevel?: number): PillarDefinition | undefined {
  // Endless mode: nic do odblokowania
  return undefined;
}

/**
 * Zwraca bonus dla naturalnego bohatera w filarze
 */
export const NATURAL_HERO_PILLAR_BONUS = {
  damageMultiplier: 19661 as FP, // +20% DMG
  xpMultiplier: 24576 as FP,     // +50% XP
};

// ============================================================================
// ENDLESS MODE HELPERS
// ============================================================================

/**
 * Pobiera numer cyklu endless (0 dla fal 1-100, 1 dla 101-200, etc.)
 */
export function getEndlessCycle(wave: number): number {
  if (wave <= 0) return 0;
  return Math.floor((wave - 1) / 100);
}

/**
 * Pobiera efektywną falę w ramach cyklu (1-100)
 */
export function getEffectiveWaveInCycle(wave: number): number {
  if (wave <= 0) return 0;
  return ((wave - 1) % 100) + 1;
}
