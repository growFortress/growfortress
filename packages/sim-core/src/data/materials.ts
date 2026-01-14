/**
 * Materials and Crafting System
 *
 * Rok 2347 - System materiałów rzadkich do craftingu artefaktów i ulepszeń:
 * - Adamantium: Niezniszczalne bronie (syntetyczny stop wojskowy)
 * - Fazowy Stop: Absorbująca zbroja (obcy metal z wraków)
 * - Krystaliczny Rdzeń: Bronie energetyczne (z Starożytnych Kryształów)
 * - Katalizator Próżni: Artefakty wymiarowe (z Wyrwy)
 * - Pył Kosmiczny: Kosmiczne ulepszenia
 * - Genom Adaptacyjny: Biomodyfikacje
 * - Destabilizator Molekularny: Manipulacja rozmiarem
 * - Nanowirusy Extremis: Tech ulepszenia z regeneracją
 * - Serum Elitarne: Buff dla jednostek Natural
 */

import { MaterialType, FP, PillarId } from '../types';

// ============================================================================
// INTERFEJSY
// ============================================================================

export type MaterialRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface MaterialDropSource {
  type: 'pillar' | 'boss' | 'wave' | 'quest' | 'event';
  pillarId?: PillarId;
  bossId?: string;
  waveRange?: { start: number; end: number };
  dropChance: FP; // 16384 = 100%
}

export interface MaterialDefinition {
  id: MaterialType;
  name: string;
  polishName: string;
  description: string;
  lore: string;

  rarity: MaterialRarity;
  maxStack: number;

  // Źródła zdobycia
  sources: MaterialDropSource[];

  // Alternatywny zakup za dust
  dustCost?: number;

  // Wizualizacja
  visuals: {
    color: number;
    glowColor: number;
    icon: string;
  };
}

export interface CraftingRecipe {
  id: string;
  name: string;
  description: string;

  // Wymagane materiały
  materials: { type: MaterialType; amount: number }[];

  // Koszt w gold
  goldCost: number;

  // Wynik
  result: {
    type: 'artifact' | 'item' | 'upgrade' | 'buff';
    itemId: string;
    amount?: number;
  };

  // Wymagania
  requirements?: {
    fortressLevel?: number;
    heroClass?: string;
  };
}

// ============================================================================
// MATERIAŁY
// ============================================================================

const ADAMANTIUM: MaterialDefinition = {
  id: 'adamantium',
  name: 'Adamantium',
  polishName: 'Adamantium',
  description: 'Niezniszczalny metal, idealny do tworzenia broni.',
  lore: 'Syntetyczny stop metalu, którego proces tworzenia jest ściśle strzeżony. Raz utwardzony, jest praktycznie niezniszczalny.',

  rarity: 'legendary',
  maxStack: 10,

  sources: [
    { type: 'boss', pillarId: 'mutants', bossId: 'master_mold', dropChance: 1638 as FP }, // 10%
    { type: 'pillar', pillarId: 'science', dropChance: 82 as FP }, // 0.5% per wave
  ],

  dustCost: 2000,

  visuals: {
    color: 0xc0c0c0,
    glowColor: 0xe8e8e8,
    icon: 'metal_adamantium',
  },
};

const VIBRANIUM: MaterialDefinition = {
  id: 'vibranium',
  name: 'Phase-Locked Alloy',
  polishName: 'Fazowy Stop',
  description: 'Obcy metal absorbujący energię, odzyskany z wraków statków Roju.',
  lore: 'Stop metalu odkryty we wrakach pierwszych statków inwazyjnych Roju. Zdolny absorbować i przekierowywać energię kinetyczną. Kluczowy element w technologii obronnej ludzkości.',

  rarity: 'legendary',
  maxStack: 10,

  sources: [
    { type: 'event', pillarId: 'streets', dropChance: 3277 as FP }, // Salvage event - 20%
    { type: 'pillar', pillarId: 'streets', dropChance: 41 as FP }, // 0.25% per wave
  ],

  dustCost: 2000,

  visuals: {
    color: 0x4169e1,
    glowColor: 0x87ceeb,
    icon: 'metal_phase',
  },
};

const URU: MaterialDefinition = {
  id: 'uru',
  name: 'Crystalline Core',
  polishName: 'Krystaliczny Rdzeń',
  description: 'Rdzeń energetyczny z rozbitych Starożytnych Kryształów.',
  lore: 'Fragmenty rdzeni Starożytnych Kryształów, pozostawione przez wymarłą cywilizację. Zawierają ogromne ilości skondensowanej energii, idealnej do tworzenia broni energetycznych.',

  rarity: 'legendary',
  maxStack: 5,

  sources: [
    { type: 'boss', pillarId: 'gods', bossId: 'nexus_guardian', dropChance: 1638 as FP },
    { type: 'boss', pillarId: 'magic', bossId: 'void_entity', dropChance: 2458 as FP },
  ],

  dustCost: 3000,

  visuals: {
    color: 0x8b4513,
    glowColor: 0xffd700,
    icon: 'crystal_core',
  },
};

const DARKFORCE: MaterialDefinition = {
  id: 'darkforce',
  name: 'Void Catalyst',
  polishName: 'Katalizator Próżni',
  description: 'Esencja z Wyrwy - portalu, przez który wdziera się Rój.',
  lore: 'Czysta energia wymiarowa pobierana z krawędzi Wyrwy. Niestabilna i niebezpieczna, ale niezbędna do tworzenia broni zdolnych przebić pancerze Roju.',

  rarity: 'epic',
  maxStack: 15,

  sources: [
    { type: 'pillar', pillarId: 'magic', dropChance: 328 as FP }, // 2% per wave
    { type: 'boss', pillarId: 'magic', bossId: 'rift_lord', dropChance: 4915 as FP },
    { type: 'boss', pillarId: 'magic', bossId: 'void_walker', dropChance: 2458 as FP },
  ],

  dustCost: 1000,

  visuals: {
    color: 0x4b0082,
    glowColor: 0x9400d3,
    icon: 'essence_void',
  },
};

const COSMIC_DUST: MaterialDefinition = {
  id: 'cosmic_dust',
  name: 'Cosmic Dust',
  polishName: 'Kosmiczny Pył',
  description: 'Pył z kosmicznych eksplozji, do kosmicznych ulepszeń.',
  lore: 'Pozostałości po eksplozjach gwiazd i kosmicznych zdarzeniach. Zawiera esencję samego kosmosu.',

  rarity: 'epic',
  maxStack: 20,

  sources: [
    { type: 'pillar', pillarId: 'cosmos', dropChance: 492 as FP }, // 3% per wave
    { type: 'boss', pillarId: 'cosmos', bossId: 'corvus_glaive', dropChance: 4915 as FP },
    { type: 'boss', pillarId: 'cosmos', bossId: 'ronan', dropChance: 4915 as FP },
  ],

  dustCost: 800,

  visuals: {
    color: 0x9932cc,
    glowColor: 0xda70d6,
    icon: 'dust_cosmic',
  },
};

const MUTANT_DNA: MaterialDefinition = {
  id: 'mutant_dna',
  name: 'Adaptive Genome',
  polishName: 'Genom Adaptacyjny',
  description: 'Zmodyfikowane DNA do biomodyfikacji jednostek bojowych.',
  lore: 'Syntetyczny genom opracowany w wojskowych laboratoriach. Pozwala na adaptacyjne modyfikacje organizmu, zwiększające zdolności bojowe.',

  rarity: 'rare',
  maxStack: 25,

  sources: [
    { type: 'pillar', pillarId: 'mutants', dropChance: 656 as FP }, // 4% per wave
    { type: 'boss', pillarId: 'mutants', bossId: 'bio_titan', dropChance: 4915 as FP },
    { type: 'boss', pillarId: 'mutants', bossId: 'hive_queen', dropChance: 3277 as FP },
  ],

  dustCost: 500,

  visuals: {
    color: 0x9acd32,
    glowColor: 0xadff2f,
    icon: 'genome_helix',
  },
};

const PYM_PARTICLES: MaterialDefinition = {
  id: 'pym_particles',
  name: 'Molecular Destabilizer',
  polishName: 'Destabilizator Molekularny',
  description: 'Cząsteczki do manipulacji rozmiarem i strukturą molekularną.',
  lore: 'Odkryte w laboratoriach Sektora Nauki, te subatomowe cząsteczki destabilizują więzi molekularne, pozwalając na zmianę rozmiaru i gęstości obiektów.',

  rarity: 'rare',
  maxStack: 20,

  sources: [
    { type: 'pillar', pillarId: 'science', dropChance: 492 as FP }, // 3% per wave
    { type: 'boss', pillarId: 'science', bossId: 'ai_overlord', dropChance: 3277 as FP },
  ],

  dustCost: 600,

  visuals: {
    color: 0xff0000,
    glowColor: 0xff6347,
    icon: 'particles_molecular',
  },
};

const EXTREMIS: MaterialDefinition = {
  id: 'extremis',
  name: 'Extremis Nanovirus',
  polishName: 'Nanowirus Extremis',
  description: 'Nanowirus do ulepszeń technologicznych z regeneracją.',
  lore: 'Wojskowy nanowirus opracowany w Fortecy Nauki. Integruje się z systemami jednostki, zapewniając zaawansowaną regenerację i ulepszenia cybernetyczne.',

  rarity: 'rare',
  maxStack: 15,

  sources: [
    { type: 'boss', pillarId: 'science', bossId: 'rogue_ai', dropChance: 2458 as FP },
    { type: 'pillar', pillarId: 'science', dropChance: 246 as FP }, // 1.5% per wave
  ],

  dustCost: 700,

  visuals: {
    color: 0xff4500,
    glowColor: 0xffa500,
    icon: 'nanovirus',
  },
};

const SUPER_SOLDIER_SERUM: MaterialDefinition = {
  id: 'super_soldier_serum',
  name: 'Elite Combat Serum',
  polishName: 'Serum Elitarne',
  description: 'Wojskowe serum zwiększające wszystkie fizyczne zdolności.',
  lore: 'Zaawansowana formuła opracowana przez wojskowych naukowców. Zwiększa siłę, szybkość i wytrzymałość do maksimum ludzkiego potencjału. Stosowane tylko u jednostek elitarnych.',

  rarity: 'epic',
  maxStack: 5,

  sources: [
    { type: 'quest', pillarId: 'streets', dropChance: 16384 as FP }, // Quest reward - 100%
    { type: 'boss', pillarId: 'streets', bossId: 'crime_lord', dropChance: 820 as FP },
  ],

  dustCost: 1500,

  visuals: {
    color: 0x0000cd,
    glowColor: 0x4169e1,
    icon: 'serum_elite',
  },
};

// ============================================================================
// BOSS RUSH MATERIAŁY
// ============================================================================

const BOSS_ESSENCE_STREETS: MaterialDefinition = {
  id: 'boss_essence_streets',
  name: 'Street Boss Essence',
  polishName: 'Esencja Bossa Ulic',
  description: 'Skoncentrowana moc bossów ulicznych.',
  lore: 'Esencja pokonanych lordów przestępczości. Przesiąknięta ambicją i brutalnością.',

  rarity: 'uncommon',
  maxStack: 50,

  sources: [
    { type: 'boss', pillarId: 'streets', bossId: 'mafia_boss', dropChance: 4915 as FP }, // 30%
  ],

  dustCost: 200,

  visuals: {
    color: 0xff6b6b,
    glowColor: 0xff8888,
    icon: 'essence_streets',
  },
};

const BOSS_ESSENCE_SCIENCE: MaterialDefinition = {
  id: 'boss_essence_science',
  name: 'Science Boss Essence',
  polishName: 'Esencja Bossa Nauki',
  description: 'Skoncentrowana moc bossów naukowych.',
  lore: 'Esencja zaawansowanej AI i technologii. Brzęczy energią cyfrową.',

  rarity: 'uncommon',
  maxStack: 50,

  sources: [
    { type: 'boss', pillarId: 'science', bossId: 'ai_core', dropChance: 4915 as FP },
  ],

  dustCost: 200,

  visuals: {
    color: 0x00bfff,
    glowColor: 0x87ceeb,
    icon: 'essence_science',
  },
};

const BOSS_ESSENCE_MUTANTS: MaterialDefinition = {
  id: 'boss_essence_mutants',
  name: 'Mutant Boss Essence',
  polishName: 'Esencja Bossa Mutantów',
  description: 'Skoncentrowana moc bossów mutantów.',
  lore: 'Esencja potężnych mutantów. Pulsuje niestabilną energią genetyczną.',

  rarity: 'uncommon',
  maxStack: 50,

  sources: [
    { type: 'boss', pillarId: 'mutants', bossId: 'sentinel', dropChance: 4915 as FP },
  ],

  dustCost: 200,

  visuals: {
    color: 0x9acd32,
    glowColor: 0xadff2f,
    icon: 'essence_mutants',
  },
};

const BOSS_ESSENCE_COSMOS: MaterialDefinition = {
  id: 'boss_essence_cosmos',
  name: 'Cosmic Boss Essence',
  polishName: 'Esencja Bossa Kosmosu',
  description: 'Skoncentrowana moc bossów kosmicznych.',
  lore: 'Esencja kosmicznych potworów. Zawiera moc odległych galaktyk.',

  rarity: 'uncommon',
  maxStack: 50,

  sources: [
    { type: 'boss', pillarId: 'cosmos', bossId: 'cosmic_beast', dropChance: 4915 as FP },
  ],

  dustCost: 200,

  visuals: {
    color: 0x9932cc,
    glowColor: 0xda70d6,
    icon: 'essence_cosmos',
  },
};

const BOSS_ESSENCE_MAGIC: MaterialDefinition = {
  id: 'boss_essence_magic',
  name: 'Magic Boss Essence',
  polishName: 'Esencja Bossa Magii',
  description: 'Skoncentrowana moc bossów magicznych.',
  lore: 'Esencja wymiarowych istot. Przepełniona archaiczną mocą.',

  rarity: 'uncommon',
  maxStack: 50,

  sources: [
    { type: 'boss', pillarId: 'magic', bossId: 'dimensional_being', dropChance: 4915 as FP },
  ],

  dustCost: 200,

  visuals: {
    color: 0x8b008b,
    glowColor: 0xff00ff,
    icon: 'essence_magic',
  },
};

const BOSS_ESSENCE_GODS: MaterialDefinition = {
  id: 'boss_essence_gods',
  name: 'Apex Boss Essence',
  polishName: 'Esencja Bossa Apeksu',
  description: 'Skoncentrowana moc bossów z Sektora Bogów.',
  lore: 'Esencja najpotężniejszych strażników - ostatniej linii obrony przed Rojem. Pulsuje energią wymiarową.',

  rarity: 'rare',
  maxStack: 30,

  sources: [
    { type: 'boss', pillarId: 'gods', bossId: 'apex_guardian', dropChance: 4915 as FP },
    { type: 'boss', pillarId: 'gods', bossId: 'void_titan', dropChance: 4915 as FP },
  ],

  dustCost: 350,

  visuals: {
    color: 0xffd700,
    glowColor: 0xffec8b,
    icon: 'essence_gods',
  },
};

const BOSS_ESSENCE_RANDOM: MaterialDefinition = {
  id: 'boss_essence_random',
  name: 'Mystery Boss Essence',
  polishName: 'Tajemnicza Esencja Bossa',
  description: 'Losowa esencja z dowolnego pillara.',
  lore: 'Mieszanka esencji z różnych pillarów. Nieprzewidywalna, ale potężna.',

  rarity: 'uncommon',
  maxStack: 50,

  sources: [],

  dustCost: 250,

  visuals: {
    color: 0x808080,
    glowColor: 0xc0c0c0,
    icon: 'essence_random',
  },
};

const BOSS_TROPHY_GOLD: MaterialDefinition = {
  id: 'boss_trophy_gold',
  name: 'Golden Boss Trophy',
  polishName: 'Złote Trofeum Bossa',
  description: 'Rzadkie trofeum za pokonanie wielu bossów.',
  lore: 'Złote trofeum przyznawane wojownikom, którzy pokonali pełną rotację bossów w trybie Boss Rush.',

  rarity: 'epic',
  maxStack: 10,

  sources: [],

  dustCost: 1000,

  visuals: {
    color: 0xffd700,
    glowColor: 0xffec8b,
    icon: 'trophy_gold',
  },
};

const BOSS_TROPHY_PLATINUM: MaterialDefinition = {
  id: 'boss_trophy_platinum',
  name: 'Platinum Boss Trophy',
  polishName: 'Platynowe Trofeum Bossa',
  description: 'Niezwykle rzadkie trofeum za wielokrotne pokonanie rotacji bossów.',
  lore: 'Platynowe trofeum - symbol prawdziwego mistrzostwa. Przyznawane tylko tym, którzy pokonali bossów w wielu cyklach.',

  rarity: 'legendary',
  maxStack: 5,

  sources: [],

  dustCost: 3000,

  visuals: {
    color: 0xe5e4e2,
    glowColor: 0xffffff,
    icon: 'trophy_platinum',
  },
};

// ============================================================================
// EKSPORT MATERIAŁÓW
// ============================================================================

export const MATERIAL_DEFINITIONS: MaterialDefinition[] = [
  ADAMANTIUM,
  VIBRANIUM,
  URU,
  DARKFORCE,
  COSMIC_DUST,
  MUTANT_DNA,
  PYM_PARTICLES,
  EXTREMIS,
  SUPER_SOLDIER_SERUM,
  // Boss Rush materials
  BOSS_ESSENCE_STREETS,
  BOSS_ESSENCE_SCIENCE,
  BOSS_ESSENCE_MUTANTS,
  BOSS_ESSENCE_COSMOS,
  BOSS_ESSENCE_MAGIC,
  BOSS_ESSENCE_GODS,
  BOSS_ESSENCE_RANDOM,
  BOSS_TROPHY_GOLD,
  BOSS_TROPHY_PLATINUM,
];

// ============================================================================
// RECEPTURY CRAFTINGU
// ============================================================================

export const CRAFTING_RECIPES: CraftingRecipe[] = [
  // Bronie z Adamantium
  {
    id: 'adamantium_blade',
    name: 'Adamantium Blade',
    description: 'Niezniszczalne ostrze z +30% DMG.',
    materials: [{ type: 'adamantium', amount: 3 }],
    goldCost: 500,
    result: { type: 'artifact', itemId: 'adamantium_blade' },
  },
  {
    id: 'adamantium_claws',
    name: 'Adamantium Claws',
    description: 'Wysuwane pazury dla bohaterów Natural.',
    materials: [{ type: 'adamantium', amount: 5 }],
    goldCost: 1000,
    result: { type: 'artifact', itemId: 'adamantium_claws' },
    requirements: { heroClass: 'natural' },
  },

  // Zbroje z Fazowego Stopu
  {
    id: 'vibranium_armor',
    name: 'Phase Armor',
    description: 'Zbroja absorbująca 50% obrażeń.',
    materials: [{ type: 'vibranium', amount: 3 }],
    goldCost: 800,
    result: { type: 'artifact', itemId: 'vibranium_armor' },
  },
  {
    id: 'captain_shield',
    name: 'Kinetic Deflector',
    description: 'Tarcza kinetyczna jednostki dowodzenia.',
    materials: [{ type: 'vibranium', amount: 3 }],
    goldCost: 2000,
    result: { type: 'artifact', itemId: 'captain_shield' },
    requirements: { heroClass: 'natural' },
  },

  // Bronie z Krystalicznego Rdzenia
  {
    id: 'uru_weapon',
    name: 'Crystal Core Weapon',
    description: 'Broń energetyczna z +45% DMG.',
    materials: [
      { type: 'uru', amount: 3 },
      { type: 'cosmic_dust', amount: 2 },
    ],
    goldCost: 2000,
    result: { type: 'artifact', itemId: 'uru_weapon' },
  },
  {
    id: 'stormbreaker',
    name: 'Void Edge',
    description: 'Topór energetyczny z generatorem teleportacyjnym.',
    materials: [
      { type: 'uru', amount: 5 },
      { type: 'cosmic_dust', amount: 3 },
    ],
    goldCost: 5000,
    result: { type: 'artifact', itemId: 'stormbreaker' },
    requirements: { heroClass: 'lightning', fortressLevel: 45 },
  },

  // Artefakty Próżni
  {
    id: 'darkforce_amulet',
    name: 'Void Amulet',
    description: 'Amulet z mocą Wyrwy.',
    materials: [{ type: 'darkforce', amount: 3 }],
    goldCost: 600,
    result: { type: 'artifact', itemId: 'darkforce_amulet' },
    requirements: { heroClass: 'fire' },
  },

  // Serumy i ulepszenia
  {
    id: 'mutation_serum',
    name: 'Mutation Serum',
    description: 'Losowy bonus +10-30% do statystyki.',
    materials: [{ type: 'mutant_dna', amount: 3 }],
    goldCost: 500,
    result: { type: 'buff', itemId: 'mutation_buff' },
  },
  {
    id: 'extremis_injection',
    name: 'Extremis Injection',
    description: 'Permanentny +10% HP regen dla Tech heroes.',
    materials: [{ type: 'extremis', amount: 2 }],
    goldCost: 300,
    result: { type: 'buff', itemId: 'extremis_buff' },
    requirements: { heroClass: 'tech' },
  },
  {
    id: 'super_soldier_treatment',
    name: 'Super Soldier Treatment',
    description: 'Permanentny +15% wszystkie statystyki dla Natural heroes.',
    materials: [{ type: 'super_soldier_serum', amount: 1 }],
    goldCost: 1000,
    result: { type: 'buff', itemId: 'super_soldier_buff' },
    requirements: { heroClass: 'natural' },
  },

  // Gadżety z Destabilizatora Molekularnego
  {
    id: 'size_shifter',
    name: 'Molecular Shifter',
    description: 'Gadżet pozwalający manipulować rozmiarem.',
    materials: [{ type: 'pym_particles', amount: 2 }],
    goldCost: 400,
    result: { type: 'artifact', itemId: 'size_shifter' },
    requirements: { heroClass: 'tech' },
  },
  {
    id: 'web_shooters_mk2',
    name: 'Grapple Launcher MK2',
    description: 'Ulepszone miotacze linek hakowych.',
    materials: [{ type: 'pym_particles', amount: 2 }],
    goldCost: 1500,
    result: { type: 'artifact', itemId: 'web_shooters_mk2' },
    requirements: { heroClass: 'tech' },
  },

  // Pancerz Bojowy
  {
    id: 'iron_man_armor_mk50',
    name: 'Siege Exosuit MK50',
    description: 'Najnowszy egzoszkielet z nanotechnologią.',
    materials: [
      { type: 'extremis', amount: 3 },
      { type: 'vibranium', amount: 2 },
    ],
    goldCost: 4000,
    result: { type: 'artifact', itemId: 'iron_man_armor_mk50' },
    requirements: { fortressLevel: 40 },
  },

  // Kosmiczne ulepszenia
  {
    id: 'cosmic_enhancement',
    name: 'Cosmic Enhancement',
    description: '+20% do wszystkich statystyk w Filarze Kosmos.',
    materials: [{ type: 'cosmic_dust', amount: 5 }],
    goldCost: 1000,
    result: { type: 'buff', itemId: 'cosmic_buff' },
  },
];

// ============================================================================
// FUNKCJE POMOCNICZE
// ============================================================================

/**
 * Pobiera materiał po ID
 */
export function getMaterialById(id: MaterialType): MaterialDefinition | undefined {
  return MATERIAL_DEFINITIONS.find(m => m.id === id);
}

/**
 * Pobiera materiały według rzadkości
 */
export function getMaterialsByRarity(rarity: MaterialRarity): MaterialDefinition[] {
  return MATERIAL_DEFINITIONS.filter(m => m.rarity === rarity);
}

/**
 * Pobiera recepturę po ID
 */
export function getRecipeById(id: string): CraftingRecipe | undefined {
  return CRAFTING_RECIPES.find(r => r.id === id);
}

/**
 * Sprawdza czy gracz ma wystarczające materiały do craftingu
 */
export function canCraft(
  recipeId: string,
  playerMaterials: Map<MaterialType, number>,
  playerGold: number
): boolean {
  const recipe = getRecipeById(recipeId);
  if (!recipe) return false;

  if (playerGold < recipe.goldCost) return false;

  for (const req of recipe.materials) {
    const playerAmount = playerMaterials.get(req.type) ?? 0;
    if (playerAmount < req.amount) return false;
  }

  return true;
}

/**
 * Sprawdza czy gracz spełnia wymagania receptury
 */
export function meetsRecipeRequirements(
  recipeId: string,
  heroClass?: string,
  fortressLevel?: number
): boolean {
  const recipe = getRecipeById(recipeId);
  if (!recipe || !recipe.requirements) return true;

  const req = recipe.requirements;

  if (req.heroClass && heroClass !== req.heroClass) return false;
  if (req.fortressLevel && (fortressLevel ?? 0) < req.fortressLevel) return false;

  return true;
}

/**
 * Pobiera receptury dostępne dla danego poziomu twierdzy
 */
export function getAvailableRecipes(fortressLevel: number): CraftingRecipe[] {
  return CRAFTING_RECIPES.filter(r => {
    if (!r.requirements?.fortressLevel) return true;
    return fortressLevel >= r.requirements.fortressLevel;
  });
}

/**
 * Pobiera źródła materiału
 */
export function getMaterialSources(materialId: MaterialType): MaterialDropSource[] {
  const material = getMaterialById(materialId);
  return material?.sources ?? [];
}

/**
 * Oblicza szansę na drop materiału z danego filaru
 */
export function getMaterialDropChanceForPillar(
  materialId: MaterialType,
  pillarId: PillarId
): FP {
  const material = getMaterialById(materialId);
  if (!material) return 0 as FP;

  const source = material.sources.find(
    s => s.type === 'pillar' && s.pillarId === pillarId
  );

  return source?.dropChance ?? (0 as FP);
}

/**
 * Kolory materiałów według rzadkości
 */
export const RARITY_COLORS: Record<MaterialRarity, number> = {
  common: 0x808080,    // Szary
  uncommon: 0x00ff00,  // Zielony
  rare: 0x0000ff,      // Niebieski
  epic: 0x9932cc,      // Fioletowy
  legendary: 0xffd700, // Złoty
};

/**
 * Pobiera kolor dla rzadkości
 */
export function getRarityColor(rarity: MaterialRarity): number {
  return RARITY_COLORS[rarity];
}

// ============================================================================
// DROP SYSTEM
// ============================================================================

/**
 * Losuje drop materiału z bossa
 * @returns null jeśli nic nie wypadło, lub obiekt z ID materiału i ilością
 */
export function rollMaterialDropFromBoss(
  bossId: string,
  pillarId: PillarId,
  rngValue: number // 0-1 normalized
): { materialId: MaterialType; amount: number } | null {
  // Konwertuj rngValue do fixed-point
  const roll = Math.floor(rngValue * 16384);

  // Sprawdź każdy materiał
  for (const material of MATERIAL_DEFINITIONS) {
    for (const source of material.sources) {
      if (source.type === 'boss' && source.bossId === bossId && source.pillarId === pillarId) {
        if (roll < source.dropChance) {
          // Ilość zależy od rzadkości
          const amount = material.rarity === 'legendary' ? 1 :
                         material.rarity === 'epic' ? 1 :
                         material.rarity === 'rare' ? 2 : 3;
          return { materialId: material.id, amount };
        }
      }
    }
  }

  return null;
}

/**
 * Losuje drop materiału z fali w filarze
 * @returns null jeśli nic nie wypadło, lub obiekt z ID materiału i ilością
 */
export function rollMaterialDropFromWave(
  pillarId: PillarId,
  wave: number,
  rngValue: number // 0-1 normalized
): { materialId: MaterialType; amount: number } | null {
  const roll = Math.floor(rngValue * 16384);

  for (const material of MATERIAL_DEFINITIONS) {
    for (const source of material.sources) {
      if (source.type === 'pillar' && source.pillarId === pillarId) {
        // Zwiększ szansę w wyższych falach (+1% co 10 fal)
        const waveBonus = Math.floor(wave / 10) * 164; // ~1% per 10 waves
        const adjustedChance = Math.min(source.dropChance + waveBonus, 8192); // Max 50%

        if (roll < adjustedChance) {
          return { materialId: material.id, amount: 1 };
        }
      }
    }
  }

  return null;
}

/**
 * Pobiera wszystkie możliwe dropy materiałów z bossa
 */
export function getBossMaterialDrops(bossId: string): { material: MaterialDefinition; dropChance: FP }[] {
  const drops: { material: MaterialDefinition; dropChance: FP }[] = [];

  for (const material of MATERIAL_DEFINITIONS) {
    for (const source of material.sources) {
      if (source.type === 'boss' && source.bossId === bossId) {
        drops.push({ material, dropChance: source.dropChance });
      }
    }
  }

  return drops;
}
