/**
 * Infinity Stones (Kamienie Nieskończoności)
 *
 * 6 Kamieni Nieskończoności do zbierania podczas gry:
 * - Power (Moc) - Fioletowy
 * - Space (Przestrzeń) - Niebieski
 * - Time (Czas) - Zielony
 * - Reality (Rzeczywistość) - Czerwony
 * - Soul (Dusza) - Pomarańczowy
 * - Mind (Umysł) - Żółty
 *
 * Każdy bohater może nosić max 1 kamień.
 * Zebranie wszystkich 6 + Infinity Gauntlet = SNAP ability.
 */

import { InfinityStoneType, FP, PillarId } from '../types';

// ============================================================================
// INTERFEJSY
// ============================================================================

export interface InfinityStoneEffect {
  type: 'stat_boost' | 'ability' | 'passive';
  stat?: string;
  value?: FP;
  abilityId?: string;
  description: string;
}

export interface InfinityStoneDefinition {
  id: InfinityStoneType;
  name: string;
  polishName: string;
  color: number;
  glowColor: number;

  // Efekty gdy kamień jest equipowany
  effects: InfinityStoneEffect[];

  // Gdzie można zdobyć
  dropLocations: {
    pillarId: PillarId;
    bossId: string;
    dropChance: FP; // Szansa w fixed-point (16384 = 1%)
  }[];

  // Koszt zakupu za dust (alternatywa)
  dustCost: number;

  // Koszt przeniesienia między bohaterami
  transferCost: {
    gold: number;
  };

  // Efekty fragmentów (5 fragmentów = pełny kamień)
  fragmentEffect: {
    stat: string;
    valuePerFragment: FP; // 1/5 pełnego efektu
  };
}

export interface InfinityGauntletDefinition {
  name: string;
  description: string;

  // Wymagania do aktywacji
  requirements: {
    allSixStones: boolean;
    gauntletArtifact: boolean;
    heroTier: number; // Minimalny tier bohatera
    minCommanderLevel: number; // Minimalny Commander Level
  };

  // Bonusy gdy wszystkie kamienie są zebrane
  fullSetBonus: {
    allStatsMultiplier: FP; // +200% = 49152
    allEffectsActive: boolean;
  };

  // SNAP ability
  snapAbility: {
    name: string;
    description: string;
    effect: 'kill_half_enemies';
    cooldownWaves: number; // Bohater niedostępny przez X fal
  };
}

// ============================================================================
// KAMIENIE NIESKOŃCZONOŚCI
// ============================================================================

const POWER_STONE: InfinityStoneDefinition = {
  id: 'power',
  name: 'Power Stone',
  polishName: 'Kamień Mocy',
  color: 0x9932cc, // Fioletowy
  glowColor: 0xda70d6,

  effects: [
    {
      type: 'stat_boost',
      stat: 'damageMultiplier',
      value: 24576 as FP, // +50% DMG
      description: '+50% obrażeń wszystkich ataków',
    },
    {
      type: 'ability',
      abilityId: 'power_blast',
      description: 'Power Blast: Potężny atak obszarowy (cooldown 30s)',
    },
  ],

  dropLocations: [
    { pillarId: 'cosmos', bossId: 'corvus_glaive', dropChance: 820 as FP }, // 5%
    { pillarId: 'cosmos', bossId: 'ronan', dropChance: 1638 as FP }, // 10%
  ],

  dustCost: 10000,
  transferCost: { gold: 500 },

  fragmentEffect: {
    stat: 'damageMultiplier',
    valuePerFragment: 1638 as FP, // +10% per fragment
  },
};

const SPACE_STONE: InfinityStoneDefinition = {
  id: 'space',
  name: 'Space Stone',
  polishName: 'Kamień Przestrzeni',
  color: 0x0000ff, // Niebieski
  glowColor: 0x87ceeb,

  effects: [
    {
      type: 'stat_boost',
      stat: 'range',
      value: 32768 as FP, // +100% range
      description: '+100% zasięg wszystkich ataków',
    },
    {
      type: 'ability',
      abilityId: 'teleport',
      description: 'Teleport: Natychmiastowa teleportacja do dowolnego miejsca (cooldown 20s)',
    },
    {
      type: 'passive',
      description: 'Portal Strike: Ataki ignorują przeszkody',
    },
  ],

  dropLocations: [
    { pillarId: 'cosmos', bossId: 'ronan', dropChance: 820 as FP },
  ],

  dustCost: 10000,
  transferCost: { gold: 500 },

  fragmentEffect: {
    stat: 'range',
    valuePerFragment: 3277 as FP, // +20% per fragment
  },
};

const TIME_STONE: InfinityStoneDefinition = {
  id: 'time',
  name: 'Time Stone',
  polishName: 'Kamień Czasu',
  color: 0x00ff00, // Zielony
  glowColor: 0x98fb98,

  effects: [
    {
      type: 'stat_boost',
      stat: 'cooldownReduction',
      value: 24576 as FP, // -50% cooldowns
      description: '-50% cooldown wszystkich umiejętności',
    },
    {
      type: 'ability',
      abilityId: 'time_rewind',
      description: 'Time Rewind: Cofa czas o 5 sekund (przywraca HP, pozycje) (cooldown 60s)',
    },
    {
      type: 'passive',
      description: 'Temporal Shield: 20% szansa na uniknięcie ataku przez "cofnięcie" go',
    },
  ],

  dropLocations: [
    { pillarId: 'magic', bossId: 'dormammu', dropChance: 820 as FP },
  ],

  dustCost: 10000,
  transferCost: { gold: 500 },

  fragmentEffect: {
    stat: 'cooldownReduction',
    valuePerFragment: 1638 as FP, // -10% per fragment
  },
};

const REALITY_STONE: InfinityStoneDefinition = {
  id: 'reality',
  name: 'Reality Stone',
  polishName: 'Kamień Rzeczywistości',
  color: 0xff0000, // Czerwony
  glowColor: 0xff6347,

  effects: [
    {
      type: 'passive',
      description: 'Reality Shift: Ataki zmieniają typ obrażeń na najbardziej efektywny vs cel',
    },
    {
      type: 'ability',
      abilityId: 'reality_warp',
      description: 'Reality Warp: Zamienia wrogów w bezbronne bąbelki na 5s (cooldown 45s)',
    },
    {
      type: 'stat_boost',
      stat: 'luck',
      value: 8192 as FP, // +50% luck
      description: '+50% szansa na lepsze dropy',
    },
  ],

  dropLocations: [
    { pillarId: 'magic', bossId: 'dormammu', dropChance: 820 as FP },
  ],

  dustCost: 10000,
  transferCost: { gold: 500 },

  fragmentEffect: {
    stat: 'luck',
    valuePerFragment: 1638 as FP, // +10% per fragment
  },
};

const SOUL_STONE: InfinityStoneDefinition = {
  id: 'soul',
  name: 'Soul Stone',
  polishName: 'Kamień Duszy',
  color: 0xffa500, // Pomarańczowy
  glowColor: 0xffd700,

  effects: [
    {
      type: 'stat_boost',
      stat: 'lifesteal',
      value: 4915 as FP, // 30% lifesteal
      description: '30% lifesteal z wszystkich ataków',
    },
    {
      type: 'ability',
      abilityId: 'resurrection',
      description: 'Soul Resurrection: Wskrzesza bohatera z 50% HP po śmierci (raz na filar)',
    },
    {
      type: 'passive',
      description: 'Soul Sight: Widzi ukrytych wrogów i ich słabe punkty (+15% crit)',
    },
  ],

  dropLocations: [
    { pillarId: 'gods', bossId: 'hela', dropChance: 820 as FP },
  ],

  dustCost: 10000,
  transferCost: { gold: 500 },

  fragmentEffect: {
    stat: 'lifesteal',
    valuePerFragment: 983 as FP, // 6% per fragment
  },
};

const MIND_STONE: InfinityStoneDefinition = {
  id: 'mind',
  name: 'Mind Stone',
  polishName: 'Kamień Umysłu',
  color: 0xffff00, // Żółty
  glowColor: 0xfffacd,

  effects: [
    {
      type: 'passive',
      description: 'Mind Shield: +100% odporność na kontrolę umysłu i stun',
    },
    {
      type: 'ability',
      abilityId: 'mind_control',
      description: 'Mind Control: Przejmuje kontrolę nad wrogiem na 10s (cooldown 30s)',
    },
    {
      type: 'stat_boost',
      stat: 'xpMultiplier',
      value: 24576 as FP, // +50% XP
      description: '+50% XP zdobywanego przez bohatera',
    },
  ],

  dropLocations: [
    { pillarId: 'science', bossId: 'ultron', dropChance: 820 as FP },
  ],

  dustCost: 10000,
  transferCost: { gold: 500 },

  fragmentEffect: {
    stat: 'xpMultiplier',
    valuePerFragment: 1638 as FP, // +10% per fragment
  },
};

// ============================================================================
// INFINITY GAUNTLET
// ============================================================================

export const INFINITY_GAUNTLET: InfinityGauntletDefinition = {
  name: 'Infinity Gauntlet',
  description: 'Rękawica Nieskończoności - artefakt zdolny pomieścić wszystkie 6 kamieni i uwolnić ich pełną moc.',

  requirements: {
    allSixStones: true,
    gauntletArtifact: true, // Musi mieć artefakt "Infinity Gauntlet"
    heroTier: 3, // Tylko Tier 3 bohater może użyć
    minCommanderLevel: 40, // Wymaga Commander Level 40+
  },

  fullSetBonus: {
    allStatsMultiplier: 49152 as FP, // +200% wszystkie statystyki
    allEffectsActive: true, // Wszystkie efekty kamieni aktywne jednocześnie
  },

  snapAbility: {
    name: 'THE SNAP',
    description: 'Pstryknięcie palcami zadaje 30% HP wszystkim wrogom na ekranie.',
    effect: 'kill_half_enemies',
    cooldownWaves: 25, // Bohater niedostępny przez 25 fal po użyciu
  },
};

// ============================================================================
// EKSPORT
// ============================================================================

export const INFINITY_STONE_DEFINITIONS: InfinityStoneDefinition[] = [
  POWER_STONE,
  SPACE_STONE,
  TIME_STONE,
  REALITY_STONE,
  SOUL_STONE,
  MIND_STONE,
];

// ============================================================================
// FRAGMENTY
// ============================================================================

export const FRAGMENTS_PER_STONE = 10;

export interface StoneFragmentState {
  stoneType: InfinityStoneType;
  fragments: number; // 0-5, 5 = pełny kamień
}

// ============================================================================
// FUNKCJE POMOCNICZE
// ============================================================================

/**
 * Pobiera definicję kamienia po typie
 */
export function getStoneById(type: InfinityStoneType): InfinityStoneDefinition | undefined {
  return INFINITY_STONE_DEFINITIONS.find(s => s.id === type);
}

/**
 * Sprawdza czy bohater może użyć Gauntleta
 */
export function canUseInfinityGauntlet(
  heroTier: number,
  hasGauntletArtifact: boolean,
  equippedStones: InfinityStoneType[],
  commanderLevel: number = 1
): boolean {
  const hasAllStones = INFINITY_STONE_DEFINITIONS.every(stone =>
    equippedStones.includes(stone.id)
  );

  return (
    heroTier >= INFINITY_GAUNTLET.requirements.heroTier &&
    hasGauntletArtifact &&
    hasAllStones &&
    commanderLevel >= INFINITY_GAUNTLET.requirements.minCommanderLevel
  );
}

/**
 * Oblicza bonus z fragmentów kamienia
 */
export function calculateFragmentBonus(
  stoneType: InfinityStoneType,
  fragmentCount: number
): { stat: string; value: FP } | undefined {
  const stone = getStoneById(stoneType);
  if (!stone || fragmentCount <= 0) return undefined;

  const cappedFragments = Math.min(fragmentCount, FRAGMENTS_PER_STONE - 1); // Max 4 fragmenty dają bonus, 5 = pełny kamień

  return {
    stat: stone.fragmentEffect.stat,
    value: (stone.fragmentEffect.valuePerFragment * cappedFragments) as FP,
  };
}

/**
 * Sprawdza czy fragmenty wystarczają na pełny kamień
 */
export function canCraftFullStone(fragmentCount: number): boolean {
  return fragmentCount >= FRAGMENTS_PER_STONE;
}

/**
 * Pobiera lokacje dropów dla kamienia
 */
export function getStoneDropLocations(stoneType: InfinityStoneType): {
  pillarId: PillarId;
  bossId: string;
  dropChance: FP;
}[] {
  const stone = getStoneById(stoneType);
  return stone?.dropLocations ?? [];
}

/**
 * Oblicza szansę na drop fragmentu (1/5 szansy na pełny kamień)
 */
export function getFragmentDropChance(stoneType: InfinityStoneType, bossId: string): FP {
  const stone = getStoneById(stoneType);
  if (!stone) return 0 as FP;

  const location = stone.dropLocations.find(l => l.bossId === bossId);
  if (!location) return 0 as FP;

  // Fragment ma 5x większą szansę niż pełny kamień
  return (location.dropChance * 5) as FP;
}

/**
 * Oblicza łączne bonusy z wszystkich equipowanych kamieni
 */
export function calculateStoneBonuses(equippedStones: InfinityStoneType[]): {
  damageMultiplier: FP;
  range: FP;
  cooldownReduction: FP;
  lifesteal: FP;
  luck: FP;
  xpMultiplier: FP;
  abilities: string[];
  passives: string[];
} {
  const bonuses = {
    damageMultiplier: 16384 as FP, // Base 1.0
    range: 16384 as FP,
    cooldownReduction: 0 as FP,
    lifesteal: 0 as FP,
    luck: 16384 as FP,
    xpMultiplier: 16384 as FP,
    abilities: [] as string[],
    passives: [] as string[],
  };

  for (const stoneType of equippedStones) {
    const stone = getStoneById(stoneType);
    if (!stone) continue;

    for (const effect of stone.effects) {
      if (effect.type === 'stat_boost' && effect.stat && effect.value) {
        switch (effect.stat) {
          case 'damageMultiplier':
            bonuses.damageMultiplier = (bonuses.damageMultiplier + effect.value - 16384) as FP;
            break;
          case 'range':
            bonuses.range = (bonuses.range + effect.value - 16384) as FP;
            break;
          case 'cooldownReduction':
            bonuses.cooldownReduction = (bonuses.cooldownReduction + effect.value) as FP;
            break;
          case 'lifesteal':
            bonuses.lifesteal = (bonuses.lifesteal + effect.value) as FP;
            break;
          case 'luck':
            bonuses.luck = (bonuses.luck + effect.value - 16384) as FP;
            break;
          case 'xpMultiplier':
            bonuses.xpMultiplier = (bonuses.xpMultiplier + effect.value - 16384) as FP;
            break;
        }
      } else if (effect.type === 'ability' && effect.abilityId) {
        bonuses.abilities.push(effect.abilityId);
      } else if (effect.type === 'passive') {
        bonuses.passives.push(effect.description);
      }
    }
  }

  return bonuses;
}

/**
 * Kolory kamieni do renderowania
 */
export const STONE_COLORS: Record<InfinityStoneType, { main: number; glow: number }> = {
  power: { main: 0x9932cc, glow: 0xda70d6 },
  space: { main: 0x0000ff, glow: 0x87ceeb },
  time: { main: 0x00ff00, glow: 0x98fb98 },
  reality: { main: 0xff0000, glow: 0xff6347 },
  soul: { main: 0xffa500, glow: 0xffd700 },
  mind: { main: 0xffff00, glow: 0xfffacd },
};

/**
 * Kolejność kamieni na Gauntlecie
 */
export const GAUNTLET_STONE_ORDER: InfinityStoneType[] = [
  'power',   // Kciuk
  'space',   // Palec wskazujący
  'reality', // Palec środkowy
  'soul',    // Palec serdeczny
  'time',    // Mały palec
  'mind',    // Grzbiet dłoni (środek)
];

// ============================================================================
// BOSS TO STONE MAPPING
// ============================================================================

/**
 * Mapowanie bossów filarów do możliwych drop-ów kamieni
 */
export const BOSS_STONE_DROPS: Record<string, {
  pillarId: PillarId;
  stoneType: InfinityStoneType;
  fragmentChance: FP; // Szansa na fragment (5x większa niż na pełny kamień)
  fullStoneChance: FP; // Szansa na pełny kamień
}[]> = {
  // Science pillar bosses - DROP RATES SIGNIFICANTLY REDUCED
  // 2% fragment chance = 328 FP, 0.2% full stone = 33 FP
  ultron: [
    { pillarId: 'science', stoneType: 'mind', fragmentChance: 328 as FP, fullStoneChance: 33 as FP },
  ],
  modok: [],

  // Cosmos pillar bosses
  corvus_glaive: [
    { pillarId: 'cosmos', stoneType: 'power', fragmentChance: 328 as FP, fullStoneChance: 33 as FP },
  ],
  ronan: [
    { pillarId: 'cosmos', stoneType: 'power', fragmentChance: 492 as FP, fullStoneChance: 49 as FP }, // 3% / 0.3%
    { pillarId: 'cosmos', stoneType: 'space', fragmentChance: 328 as FP, fullStoneChance: 33 as FP },
  ],

  // Magic pillar bosses
  dormammu: [
    { pillarId: 'magic', stoneType: 'time', fragmentChance: 328 as FP, fullStoneChance: 33 as FP },
    { pillarId: 'magic', stoneType: 'reality', fragmentChance: 328 as FP, fullStoneChance: 33 as FP },
  ],
  baron_mordo: [],

  // Gods pillar bosses
  hela: [
    { pillarId: 'gods', stoneType: 'soul', fragmentChance: 328 as FP, fullStoneChance: 33 as FP },
  ],
  surtur: [],

  // Streets pillar bosses
  kingpin: [],
  bullseye: [],

  // Mutants pillar bosses
  master_mold: [],
  nimrod: [],
};

/**
 * Typy wrogów które są bossami
 */
export const BOSS_ENEMY_TYPES = [
  'mafia_boss',
  'ai_core',
  'sentinel',
  'cosmic_beast',
  'dimensional_being',
  'god',
  'titan',
] as const;

/**
 * Mapowanie typów wrogów-bossów do ID bossów
 */
export const ENEMY_TYPE_TO_BOSS_ID: Record<string, string[]> = {
  mafia_boss: ['kingpin', 'bullseye'],
  ai_core: ['ultron', 'modok'],
  sentinel: ['master_mold', 'nimrod'],
  cosmic_beast: ['corvus_glaive', 'ronan'],
  dimensional_being: ['dormammu', 'baron_mordo'],
  god: ['hela'],
  titan: ['surtur'],
};

/**
 * Sprawdza czy typ wroga jest bossem
 */
export function isBossEnemy(enemyType: string): boolean {
  return BOSS_ENEMY_TYPES.includes(enemyType as typeof BOSS_ENEMY_TYPES[number]);
}

/**
 * Losuje drop kamienia/fragmentu dla bossa
 * @returns null jeśli nic nie wypadło, lub obiekt z typem kamienia i czy to pełny kamień
 */
export function rollStoneDrop(
  bossId: string,
  pillarId: PillarId,
  rngValue: number // 0-1 normalized
): { stoneType: InfinityStoneType; isFullStone: boolean } | null {
  const drops = BOSS_STONE_DROPS[bossId];
  if (!drops || drops.length === 0) return null;

  // Filtruj do odpowiedniego filaru
  const validDrops = drops.filter(d => d.pillarId === pillarId);
  if (validDrops.length === 0) return null;

  // Konwertuj rngValue (0-1) do fixed-point (0-16384)
  const roll = Math.floor(rngValue * 16384);

  for (const drop of validDrops) {
    // Najpierw sprawdź pełny kamień (niższa szansa)
    if (roll < drop.fullStoneChance) {
      return { stoneType: drop.stoneType, isFullStone: true };
    }
    // Potem sprawdź fragment (wyższa szansa)
    if (roll < drop.fragmentChance) {
      return { stoneType: drop.stoneType, isFullStone: false };
    }
  }

  return null;
}

/**
 * Pobiera losowe ID bossa dla danego typu wroga i fali
 */
export function getBossIdForEnemy(enemyType: string, wave: number): string | null {
  const bossIds = ENEMY_TYPE_TO_BOSS_ID[enemyType];
  if (!bossIds || bossIds.length === 0) return null;

  // Deterministyczny wybór bossa na podstawie fali
  return bossIds[wave % bossIds.length];
}
