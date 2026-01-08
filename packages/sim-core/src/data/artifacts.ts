/**
 * Artifacts and Items
 *
 * System artefaktów i przedmiotów:
 * - Artefakty Legendarne: Unikalne, 1 na bohatera (Mjolnir, Stormbreaker, etc.)
 * - Przedmioty zwykłe: Konsumowalne i equipowalne, max 3 na bohatera
 *
 * Artefakty są inspirowane przedmiotami z Marvel Comics.
 */

import { FortressClass, FP, MaterialType, PillarId } from '../types';

// ============================================================================
// TYPY
// ============================================================================

export type ArtifactRarity = 'legendary' | 'epic' | 'rare' | 'common';
export type ArtifactSlot = 'weapon' | 'armor' | 'accessory' | 'gadget' | 'book' | 'special';
export type ItemType = 'consumable' | 'equipment';

// ============================================================================
// INTERFEJSY - ARTEFAKTY
// ============================================================================

export interface ArtifactEffect {
  type: 'stat_boost' | 'ability' | 'passive' | 'class_bonus';
  stat?: string;
  value?: FP;
  abilityId?: string;
  classRequired?: FortressClass;
  description: string;
}

export interface ArtifactRequirement {
  heroId?: string;          // Specyficzny bohater
  heroClass?: FortressClass; // Wymagana klasa bohatera
  heroTier?: number;         // Minimalny tier
  materials?: { type: MaterialType; amount: number }[]; // Do craftingu
}

export interface ArtifactDefinition {
  id: string;
  name: string;
  polishName: string;
  description: string;
  lore: string; // Opis fabularny

  rarity: ArtifactRarity;
  slot: ArtifactSlot;

  // Wymagania
  requirements: ArtifactRequirement;

  // Efekty
  effects: ArtifactEffect[];

  // Wizualizacja
  visuals: {
    color: number;
    glowColor: number;
    icon: string; // Nazwa ikony do renderowania
  };

  // Źródło zdobycia
  source: {
    type: 'drop' | 'craft' | 'quest' | 'shop';
    location?: string;
    dropChance?: FP;
    craftRecipe?: { material: MaterialType; amount: number }[];
    goldCost?: number;
  };
}

// ============================================================================
// INTERFEJSY - PRZEDMIOTY
// ============================================================================

export interface ItemEffect {
  type: 'instant' | 'duration' | 'permanent';
  stat?: string;
  value?: FP;
  duration?: number; // w tickach, tylko dla 'duration'
  description: string;
}

export interface ItemDefinition {
  id: string;
  name: string;
  polishName: string;
  description: string;

  itemType: ItemType;
  stackable: boolean;
  maxStack: number;

  effects: ItemEffect[];

  cost: {
    gold: number;
  };

  visuals: {
    color: number;
    icon: string;
  };
}

// ============================================================================
// ARTEFAKTY LEGENDARNE
// ============================================================================

const MJOLNIR: ArtifactDefinition = {
  id: 'mjolnir',
  name: 'Mjolnir',
  polishName: 'Mjolnir',
  description: 'Młot Thora - ten, kto jest godzien, posiada moc Thora.',
  lore: 'Wykuty przez krasnoludy z Nidavellir, Mjolnir to jeden z najpotężniejszych artefaktów w Dziewięciu Światach.',

  rarity: 'legendary',
  slot: 'weapon',

  requirements: {
    heroClass: 'lightning',
    heroTier: 2,
  },

  effects: [
    {
      type: 'stat_boost',
      stat: 'damageMultiplier',
      value: 22938 as FP, // +40%
      description: '+40% obrażeń Lightning',
    },
    {
      type: 'passive',
      description: 'Worthy: Bohater może przyzywać pioruny (dodatkowy atak co 5s)',
    },
    {
      type: 'ability',
      abilityId: 'mjolnir_throw',
      description: 'Rzut Mjolnirem: Młot wraca do właściciela, trafiając wszystkich na drodze',
    },
  ],

  visuals: {
    color: 0xc0c0c0,
    glowColor: 0x00bfff,
    icon: 'hammer',
  },

  source: {
    type: 'drop',
    location: 'Filar: Bogowie',
    dropChance: 328 as FP, // 2%
  },
};

const STORMBREAKER: ArtifactDefinition = {
  id: 'stormbreaker',
  name: 'Stormbreaker',
  polishName: 'Stormbreaker',
  description: 'Topór-młot zdolny przyzwać Bifrost i pokonać nawet bogów.',
  lore: 'Wykuty z Uru w sercu umierającej gwiazdy, Stormbreaker jest jeszcze potężniejszy niż Mjolnir.',

  rarity: 'legendary',
  slot: 'weapon',

  requirements: {
    heroClass: 'lightning',
    heroTier: 3,
    materials: [{ type: 'uru', amount: 5 }],
  },

  effects: [
    {
      type: 'stat_boost',
      stat: 'damageMultiplier',
      value: 26214 as FP, // +60%
      description: '+60% obrażeń',
    },
    {
      type: 'ability',
      abilityId: 'bifrost',
      description: 'Bifrost: Teleportacja do dowolnego miejsca na mapie',
    },
    {
      type: 'passive',
      description: 'God Slayer: +100% DMG vs bossów',
    },
  ],

  visuals: {
    color: 0x8b4513,
    glowColor: 0xffd700,
    icon: 'axe',
  },

  source: {
    type: 'craft',
    craftRecipe: [
      { material: 'uru', amount: 5 },
      { material: 'cosmic_dust', amount: 3 },
    ],
    goldCost: 5000,
  },
};

const CAPTAIN_SHIELD: ArtifactDefinition = {
  id: 'captain_shield',
  name: "Captain's Shield",
  polishName: 'Tarcza Kapitana',
  description: 'Niezniszczalna tarcza z czystego Vibranium.',
  lore: 'Dar od króla Wakandy, ta tarcza absorbuje i odbija całą energię kinetyczną.',

  rarity: 'legendary',
  slot: 'armor',

  requirements: {
    heroClass: 'natural',
  },

  effects: [
    {
      type: 'stat_boost',
      stat: 'blockChance',
      value: 24576 as FP, // +50% block
      description: '+50% szansa na blok',
    },
    {
      type: 'ability',
      abilityId: 'shield_throw',
      description: 'Rzut tarczą: Tarcza odbija się od 5 wrogów',
    },
    {
      type: 'passive',
      description: 'Vibranium Absorption: Zablokowane ataki regenerują HP',
    },
  ],

  visuals: {
    color: 0x0000cd,
    glowColor: 0xff0000,
    icon: 'shield',
  },

  source: {
    type: 'craft',
    craftRecipe: [{ material: 'vibranium', amount: 3 }],
    goldCost: 2000,
  },
};

const IRON_MAN_ARMOR: ArtifactDefinition = {
  id: 'iron_man_armor_mk50',
  name: 'Iron Man Armor MK50',
  polishName: 'Zbroja Iron Mana MK50',
  description: 'Najnowsza wersja zbroi z nanotechnologią Bleeding Edge.',
  lore: 'Zbroja składająca się z miliardów nanitów, zdolna do natychmiastowej naprawy i transformacji.',

  rarity: 'legendary',
  slot: 'armor',

  requirements: {
    heroId: 'iron_sentinel',
    heroTier: 3,
  },

  effects: [
    {
      type: 'stat_boost',
      stat: 'allStats',
      value: 21299 as FP, // +30%
      description: '+30% wszystkie statystyki',
    },
    {
      type: 'passive',
      description: 'Nano-Repair: +20 HP regeneracji na sekundę',
    },
    {
      type: 'passive',
      description: 'Weapon Morph: Może zmieniać broń w locie (laser/rakiety/tarcza)',
    },
  ],

  visuals: {
    color: 0xb22222,
    glowColor: 0xffd700,
    icon: 'armor_suit',
  },

  source: {
    type: 'craft',
    craftRecipe: [
      { material: 'extremis', amount: 3 },
      { material: 'vibranium', amount: 2 },
    ],
    goldCost: 4000,
  },
};

const WEB_SHOOTERS: ArtifactDefinition = {
  id: 'web_shooters_mk2',
  name: 'Web Shooters MK2',
  polishName: 'Miotacze Sieci MK2',
  description: 'Ulepszone miotacze sieci z nieskończonym zapasem.',
  lore: 'Zaprojektowane przez Petera Parkera i ulepszone przez Tony\'ego Starka.',

  rarity: 'epic',
  slot: 'gadget',

  requirements: {
    heroClass: 'tech',
  },

  effects: [
    {
      type: 'passive',
      description: 'Unlimited Webs: Brak limitu użyć sieci',
    },
    {
      type: 'stat_boost',
      stat: 'slowEffect',
      value: 20480 as FP, // +25%
      description: '+25% efekt spowolnienia sieci',
    },
    {
      type: 'ability',
      abilityId: 'web_bomb',
      description: 'Web Bomb: Pęta wszystkich wrogów w obszarze',
    },
  ],

  visuals: {
    color: 0xff0000,
    glowColor: 0xffffff,
    icon: 'web',
  },

  source: {
    type: 'craft',
    craftRecipe: [{ material: 'pym_particles', amount: 2 }],
    goldCost: 1500,
  },
};

const CLOAK_OF_LEVITATION: ArtifactDefinition = {
  id: 'cloak_of_levitation',
  name: 'Cloak of Levitation',
  polishName: 'Płaszcz Lewitacji',
  description: 'Magiczny płaszcz o własnej woli, zdolny do lotu.',
  lore: 'Jeden z artefaktów Sanctum Sanctorum, płaszcz wybiera swojego właściciela.',

  rarity: 'legendary',
  slot: 'accessory',

  requirements: {
    heroClass: 'fire',
  },

  effects: [
    {
      type: 'passive',
      description: 'Flight: Bohater może latać (ignoruje przeszkody naziemne)',
    },
    {
      type: 'stat_boost',
      stat: 'dodgeChance',
      value: 21299 as FP, // +30%
      description: '+30% szansa na unik',
    },
    {
      type: 'passive',
      description: 'Sentient Protection: Płaszcz automatycznie blokuje 1 śmiertelny cios na falę',
    },
  ],

  visuals: {
    color: 0x8b0000,
    glowColor: 0xff6347,
    icon: 'cloak',
  },

  source: {
    type: 'drop',
    location: 'Filar: Magia',
    dropChance: 492 as FP, // 3%
  },
};

const EYE_OF_AGAMOTTO: ArtifactDefinition = {
  id: 'eye_of_agamotto',
  name: 'Eye of Agamotto',
  polishName: 'Oko Agamotto',
  description: 'Starożytny artefakt zawierający slot na Kamień Czasu.',
  lore: 'Stworzony przez Agamotto, pierwszy Sorcerer Supreme, oko jest kluczem do manipulacji czasem.',

  rarity: 'legendary',
  slot: 'accessory',

  requirements: {
    heroClass: 'fire',
    heroTier: 2,
  },

  effects: [
    {
      type: 'passive',
      description: 'Time Stone Slot: Może przechowywać Kamień Czasu z podwójnym efektem',
    },
    {
      type: 'stat_boost',
      stat: 'spellPower',
      value: 19661 as FP, // +20%
      description: '+20% mocy zaklęć',
    },
    {
      type: 'ability',
      abilityId: 'time_peek',
      description: 'Time Peek: Widzi ruchy wrogów 3s w przyszłość',
    },
  ],

  visuals: {
    color: 0x00ff00,
    glowColor: 0x98fb98,
    icon: 'eye',
  },

  source: {
    type: 'quest',
    location: 'Quest: Secrets of Kamar-Taj',
  },
};

const DARKHOLD: ArtifactDefinition = {
  id: 'darkhold',
  name: 'Darkhold',
  polishName: 'Darkhold',
  description: 'Księga przeklętych zaklęć - potężna, ale korumpująca.',
  lore: 'Napisana przez boga Chthona, Darkhold zawiera najpotężniejsze i najniebezpieczniejsze zaklęcia.',

  rarity: 'legendary',
  slot: 'book',

  requirements: {
    heroClass: 'fire',
  },

  effects: [
    {
      type: 'stat_boost',
      stat: 'chaosMagic',
      value: 24576 as FP, // +50%
      description: '+50% obrażeń magii chaosu',
    },
    {
      type: 'passive',
      description: 'Corruption Risk: 10% szansa na uszkodzenie siebie przy każdym zaklęciu',
    },
    {
      type: 'ability',
      abilityId: 'chaos_wave',
      description: 'Chaos Wave: Potężna fala chaosu (wysokie DMG, losowe efekty)',
    },
  ],

  visuals: {
    color: 0x4b0082,
    glowColor: 0x9400d3,
    icon: 'book_dark',
  },

  source: {
    type: 'drop',
    location: 'Filar: Magia - Boss Dormammu',
    dropChance: 164 as FP, // 1%
  },
};

const BOOK_OF_VISHANTI: ArtifactDefinition = {
  id: 'book_of_vishanti',
  name: 'Book of Vishanti',
  polishName: 'Księga Vishanti',
  description: 'Przeciwwaga dla Darkholdu - księga białej magii.',
  lore: 'Kompendium najpotężniejszych zaklęć ochronnych i oczyszczających.',

  rarity: 'legendary',
  slot: 'book',

  requirements: {
    heroClass: 'fire',
  },

  effects: [
    {
      type: 'stat_boost',
      stat: 'defensiveSpells',
      value: 22938 as FP, // +40%
      description: '+40% efektywność zaklęć ochronnych',
    },
    {
      type: 'passive',
      description: 'Purification: Oczyszcza negatywne efekty z sojuszników',
    },
    {
      type: 'ability',
      abilityId: 'shield_of_seraphim',
      description: 'Shield of Seraphim: Tworzy nieprzeniknioną tarczę na 5s',
    },
  ],

  visuals: {
    color: 0xffd700,
    glowColor: 0xfffacd,
    icon: 'book_light',
  },

  source: {
    type: 'quest',
    location: 'Quest: Trials of the Vishanti',
  },
};

const CASKET_OF_ANCIENT_WINTERS: ArtifactDefinition = {
  id: 'casket_of_ancient_winters',
  name: 'Casket of Ancient Winters',
  polishName: 'Szkatuła Pradawnych Zim',
  description: 'Artefakt lodowych gigantów, zamrażający wszystko na swojej drodze.',
  lore: 'Skradziony z Jotunheim, zawiera moc wszystkich zim, które kiedykolwiek były.',

  rarity: 'legendary',
  slot: 'special',

  requirements: {
    heroClass: 'ice',
  },

  effects: [
    {
      type: 'stat_boost',
      stat: 'iceDamage',
      value: 26214 as FP, // +60%
      description: '+60% obrażeń Ice',
    },
    {
      type: 'ability',
      abilityId: 'eternal_winter',
      description: 'Eternal Winter: Zamraża wszystkich wrogów na 10s',
    },
    {
      type: 'passive',
      description: 'Frost Aura: Wrogowie w pobliżu są automatycznie spowalniani',
    },
  ],

  visuals: {
    color: 0x00bfff,
    glowColor: 0xe0ffff,
    icon: 'casket',
  },

  source: {
    type: 'drop',
    location: 'Filar: Bogowie - Boss Hela',
    dropChance: 328 as FP, // 2%
  },
};

const EBONY_BLADE: ArtifactDefinition = {
  id: 'ebony_blade',
  name: 'Ebony Blade',
  polishName: 'Hebanowy Miecz',
  description: 'Przeklęty miecz, który żywi się krwią. Ogromna moc za straszną cenę.',
  lore: 'Wykuty przez Merlina z meteorytu, miecz jest niezniszczalny, ale przeklina każdego właściciela.',

  rarity: 'legendary',
  slot: 'weapon',

  requirements: {
    heroClass: 'natural',
  },

  effects: [
    {
      type: 'stat_boost',
      stat: 'damageMultiplier',
      value: 29491 as FP, // +80%
      description: '+80% obrażeń',
    },
    {
      type: 'passive',
      description: 'Blood Curse: Każdy atak kosztuje 1% HP',
    },
    {
      type: 'passive',
      description: 'Indestructible: Nie można zniszczyć, nie można stracić',
    },
  ],

  visuals: {
    color: 0x000000,
    glowColor: 0x8b0000,
    icon: 'sword_dark',
  },

  source: {
    type: 'quest',
    location: 'Quest: The Black Knight Legacy',
  },
};

const INFINITY_GAUNTLET_ARTIFACT: ArtifactDefinition = {
  id: 'infinity_gauntlet',
  name: 'Infinity Gauntlet',
  polishName: 'Rękawica Nieskończoności',
  description: 'Rękawica zdolna pomieścić wszystkie Kamienie Nieskończoności.',
  lore: 'Wykuta przez Eitri na rozkaz Thanosa, może kontrolować całą rzeczywistość.',

  rarity: 'legendary',
  slot: 'special',

  requirements: {
    heroTier: 3,
  },

  effects: [
    {
      type: 'passive',
      description: 'Stone Slots: Może przechowywać wszystkie 6 Kamieni Nieskończoności',
    },
    {
      type: 'passive',
      description: 'Full Set Bonus: +200% wszystkie statystyki gdy wszystkie kamienie są zebrane',
    },
    {
      type: 'ability',
      abilityId: 'the_snap',
      description: 'THE SNAP: Eliminuje 50% wszystkich wrogów (wymaga 6 kamieni)',
    },
  ],

  visuals: {
    color: 0xffd700,
    glowColor: 0xffffff,
    icon: 'gauntlet',
  },

  source: {
    type: 'drop',
    location: 'Filar: Bogowie - Boss Surtur (Final)',
    dropChance: 82 as FP, // 0.5%
  },
};

// ============================================================================
// PRZEDMIOTY ZWYKŁE
// ============================================================================

const HEALTH_POTION: ItemDefinition = {
  id: 'health_potion',
  name: 'Health Potion',
  polishName: 'Mikstura Zdrowia',
  description: 'Natychmiastowo przywraca 50 HP.',

  itemType: 'consumable',
  stackable: true,
  maxStack: 10,

  effects: [
    {
      type: 'instant',
      stat: 'hp',
      value: 819200 as FP, // 50 HP
      description: '+50 HP natychmiastowo',
    },
  ],

  cost: { gold: 50 },

  visuals: {
    color: 0xff0000,
    icon: 'potion_red',
  },
};

const DAMAGE_BOOST: ItemDefinition = {
  id: 'damage_boost',
  name: 'Damage Boost',
  polishName: 'Wzmocnienie Obrażeń',
  description: 'Zwiększa obrażenia o 20% na 30 sekund.',

  itemType: 'consumable',
  stackable: true,
  maxStack: 5,

  effects: [
    {
      type: 'duration',
      stat: 'damageMultiplier',
      value: 19661 as FP, // +20%
      duration: 900, // 30 sekund
      description: '+20% DMG przez 30s',
    },
  ],

  cost: { gold: 100 },

  visuals: {
    color: 0xff4500,
    icon: 'buff_damage',
  },
};

const SPEED_ELIXIR: ItemDefinition = {
  id: 'speed_elixir',
  name: 'Speed Elixir',
  polishName: 'Eliksir Szybkości',
  description: 'Zwiększa szybkość ataku o 30% na 30 sekund.',

  itemType: 'consumable',
  stackable: true,
  maxStack: 5,

  effects: [
    {
      type: 'duration',
      stat: 'attackSpeed',
      value: 21299 as FP, // +30%
      duration: 900,
      description: '+30% AS przez 30s',
    },
  ],

  cost: { gold: 100 },

  visuals: {
    color: 0x00ff00,
    icon: 'buff_speed',
  },
};

const SHIELD_CHARM: ItemDefinition = {
  id: 'shield_charm',
  name: 'Shield Charm',
  polishName: 'Amulet Tarczy',
  description: 'Tworzy tarczę absorbującą 100 obrażeń.',

  itemType: 'consumable',
  stackable: true,
  maxStack: 5,

  effects: [
    {
      type: 'instant',
      stat: 'shield',
      value: 1638400 as FP, // 100 shield
      description: '+100 tarcza',
    },
  ],

  cost: { gold: 150 },

  visuals: {
    color: 0x4169e1,
    icon: 'shield_magic',
  },
};

const XP_TOME: ItemDefinition = {
  id: 'xp_tome',
  name: 'XP Tome',
  polishName: 'Księga Doświadczenia',
  description: 'Natychmiastowo daje 100 XP bohaterowi.',

  itemType: 'consumable',
  stackable: true,
  maxStack: 10,

  effects: [
    {
      type: 'instant',
      stat: 'xp',
      value: 1638400 as FP, // 100 XP
      description: '+100 XP',
    },
  ],

  cost: { gold: 200 },

  visuals: {
    color: 0x9932cc,
    icon: 'book_xp',
  },
};

const CRIT_CRYSTAL: ItemDefinition = {
  id: 'crit_crystal',
  name: 'Crit Crystal',
  polishName: 'Kryształ Krytyka',
  description: '+15% szansa na krytyczne trafienie na 60 sekund.',

  itemType: 'consumable',
  stackable: true,
  maxStack: 5,

  effects: [
    {
      type: 'duration',
      stat: 'critChance',
      value: 2458 as FP, // +15%
      duration: 1800, // 60 sekund
      description: '+15% crit przez 60s',
    },
  ],

  cost: { gold: 120 },

  visuals: {
    color: 0xffd700,
    icon: 'crystal',
  },
};

// ============================================================================
// EKSPORT
// ============================================================================

export const ARTIFACT_DEFINITIONS: ArtifactDefinition[] = [
  MJOLNIR,
  STORMBREAKER,
  CAPTAIN_SHIELD,
  IRON_MAN_ARMOR,
  WEB_SHOOTERS,
  CLOAK_OF_LEVITATION,
  EYE_OF_AGAMOTTO,
  DARKHOLD,
  BOOK_OF_VISHANTI,
  CASKET_OF_ANCIENT_WINTERS,
  EBONY_BLADE,
  INFINITY_GAUNTLET_ARTIFACT,
];

export const ITEM_DEFINITIONS: ItemDefinition[] = [
  HEALTH_POTION,
  DAMAGE_BOOST,
  SPEED_ELIXIR,
  SHIELD_CHARM,
  XP_TOME,
  CRIT_CRYSTAL,
];

// ============================================================================
// FUNKCJE POMOCNICZE
// ============================================================================

/**
 * Pobiera artefakt po ID
 */
export function getArtifactById(id: string): ArtifactDefinition | undefined {
  return ARTIFACT_DEFINITIONS.find(a => a.id === id);
}

/**
 * Pobiera przedmiot po ID
 */
export function getItemById(id: string): ItemDefinition | undefined {
  return ITEM_DEFINITIONS.find(i => i.id === id);
}

/**
 * Pobiera artefakty według slotu
 */
export function getArtifactsBySlot(slot: ArtifactSlot): ArtifactDefinition[] {
  return ARTIFACT_DEFINITIONS.filter(a => a.slot === slot);
}

/**
 * Pobiera artefakty według rzadkości
 */
export function getArtifactsByRarity(rarity: ArtifactRarity): ArtifactDefinition[] {
  return ARTIFACT_DEFINITIONS.filter(a => a.rarity === rarity);
}

/**
 * Sprawdza czy bohater może użyć artefaktu
 */
export function canHeroEquipArtifact(
  artifactId: string,
  heroId: string,
  heroClass: FortressClass,
  heroTier: number
): boolean {
  const artifact = getArtifactById(artifactId);
  if (!artifact) return false;

  const req = artifact.requirements;

  if (req.heroId && req.heroId !== heroId) return false;
  if (req.heroClass && req.heroClass !== heroClass) return false;
  if (req.heroTier && heroTier < req.heroTier) return false;

  return true;
}

/**
 * Pobiera artefakty dostępne dla bohatera
 */
export function getAvailableArtifactsForHero(
  heroId: string,
  heroClass: FortressClass,
  heroTier: number
): ArtifactDefinition[] {
  return ARTIFACT_DEFINITIONS.filter(a =>
    canHeroEquipArtifact(a.id, heroId, heroClass, heroTier)
  );
}

/**
 * Pobiera przedmioty konsumowalne
 */
export function getConsumableItems(): ItemDefinition[] {
  return ITEM_DEFINITIONS.filter(i => i.itemType === 'consumable');
}

/**
 * Oblicza koszt artefaktu (crafting)
 */
export function calculateArtifactCraftCost(artifactId: string): {
  materials: { material: MaterialType; amount: number }[];
  gold: number;
} | undefined {
  const artifact = getArtifactById(artifactId);
  if (!artifact || artifact.source.type !== 'craft') return undefined;

  return {
    materials: artifact.source.craftRecipe ?? [],
    gold: artifact.source.goldCost ?? 0,
  };
}

/**
 * Max przedmiotów equipowanych na bohatera
 */
export const MAX_ITEMS_PER_HERO = 3;

/**
 * Max artefaktów na bohatera (zazwyczaj 1)
 */
export const MAX_ARTIFACTS_PER_HERO = 1;

// ============================================================================
// SYSTEM DROPÓW ARTEFAKTÓW
// ============================================================================

/**
 * Entry dla dropu artefaktu z bossa
 */
export interface ArtifactBossDropEntry {
  pillarId: PillarId;
  artifactId: string;
  dropChance: FP; // Fixed-point: 16384 = 100%
}

/**
 * Entry dla dropu artefaktu z fali (pillar-wide)
 */
export interface ArtifactPillarDropEntry {
  pillarId: PillarId;
  artifactId: string;
  dropChance: FP; // Base chance, increases with wave
}

/**
 * Mapowanie bossów do możliwych dropów artefaktów
 * Derived from source.location strings in artifact definitions
 */
export const BOSS_ARTIFACT_DROPS: Record<string, ArtifactBossDropEntry[]> = {
  // Gods pillar bosses
  hela: [
    { pillarId: 'gods', artifactId: 'casket_of_ancient_winters', dropChance: 328 as FP }, // 2%
  ],
  surtur: [
    { pillarId: 'gods', artifactId: 'infinity_gauntlet', dropChance: 82 as FP }, // 0.5%
  ],

  // Magic pillar bosses
  dormammu: [
    { pillarId: 'magic', artifactId: 'darkhold', dropChance: 164 as FP }, // 1%
  ],

  // Other bosses (no artifact drops defined yet)
  baron_mordo: [],
  ultron: [],
  modok: [],
  corvus_glaive: [],
  ronan: [],
  kingpin: [],
  bullseye: [],
  master_mold: [],
  nimrod: [],
};

/**
 * Mapowanie filarów do możliwych dropów z fal
 * For artifacts that drop from wave completion (not boss-specific)
 */
export const PILLAR_ARTIFACT_DROPS: Record<PillarId, ArtifactPillarDropEntry[]> = {
  streets: [],
  science: [],
  mutants: [],
  cosmos: [],
  magic: [
    { pillarId: 'magic', artifactId: 'cloak_of_levitation', dropChance: 164 as FP }, // 1% base
  ],
  gods: [
    { pillarId: 'gods', artifactId: 'mjolnir', dropChance: 82 as FP }, // 0.5% base
  ],
};

/**
 * Wartość dust za duplikat artefaktu według rzadkości
 */
export const ARTIFACT_DUPLICATE_DUST: Record<ArtifactRarity, number> = {
  common: 500,
  rare: 1000,
  epic: 1500,
  legendary: 2000,
};

/**
 * Pobiera wartość dust za duplikat artefaktu
 */
export function getArtifactDuplicateDustValue(artifactId: string): number {
  const artifact = getArtifactById(artifactId);
  if (!artifact) return 500; // Default to common
  return ARTIFACT_DUPLICATE_DUST[artifact.rarity];
}

/**
 * Result of artifact drop roll
 */
export interface ArtifactDropResult {
  artifactId: string;
  isDuplicate: boolean;
  dustValue: number;
}

/**
 * Roll for artifact drop from a killed boss
 * @param bossId - The boss that was killed
 * @param pillarId - Current pillar
 * @param rngValue - Random value 0-1 from simulation RNG
 * @param ownedArtifacts - Array of artifact IDs already owned by player
 * @returns Drop result or null if nothing dropped
 */
export function rollArtifactDropFromBoss(
  bossId: string,
  pillarId: PillarId,
  rngValue: number,
  ownedArtifacts: string[]
): ArtifactDropResult | null {
  const drops = BOSS_ARTIFACT_DROPS[bossId];
  if (!drops || drops.length === 0) return null;

  // Filter to matching pillar
  const validDrops = drops.filter(d => d.pillarId === pillarId);
  if (validDrops.length === 0) return null;

  // Convert rngValue to fixed-point (0-16384 range)
  const roll = Math.floor(rngValue * 16384);

  for (const drop of validDrops) {
    if (roll < drop.dropChance) {
      const isDuplicate = ownedArtifacts.includes(drop.artifactId);
      const dustValue = isDuplicate ? getArtifactDuplicateDustValue(drop.artifactId) : 0;

      return {
        artifactId: drop.artifactId,
        isDuplicate,
        dustValue,
      };
    }
  }

  return null;
}

/**
 * Roll for artifact drop from wave completion
 * @param pillarId - Current pillar
 * @param wave - Current wave number (for scaling)
 * @param rngValue - Random value 0-1 from simulation RNG
 * @param ownedArtifacts - Array of artifact IDs already owned by player
 * @returns Drop result or null if nothing dropped
 */
export function rollArtifactDropFromWave(
  pillarId: PillarId,
  wave: number,
  rngValue: number,
  ownedArtifacts: string[]
): ArtifactDropResult | null {
  const drops = PILLAR_ARTIFACT_DROPS[pillarId];
  if (!drops || drops.length === 0) return null;

  // Convert rngValue to fixed-point
  const roll = Math.floor(rngValue * 16384);

  for (const drop of drops) {
    // Wave scaling: +0.5% per 10 waves, max +5%
    const waveBonus = Math.min(Math.floor(wave / 10) * 82, 820);
    // Cap at 25% total chance
    const adjustedChance = Math.min(drop.dropChance + waveBonus, 4096);

    if (roll < adjustedChance) {
      const isDuplicate = ownedArtifacts.includes(drop.artifactId);
      const dustValue = isDuplicate ? getArtifactDuplicateDustValue(drop.artifactId) : 0;

      return {
        artifactId: drop.artifactId,
        isDuplicate,
        dustValue,
      };
    }
  }

  return null;
}
