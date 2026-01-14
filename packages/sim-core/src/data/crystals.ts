/**
 * Starożytne Kryształy (Ancient Crystals)
 *
 * 6 Kryształów do zbierania podczas gry:
 * - Power (Moc) - Fioletowy
 * - Void (Próżnia) - Niebieski
 * - Chrono (Czas) - Zielony
 * - Matter (Materia) - Czerwony
 * - Vitae (Życie) - Pomarańczowy
 * - Psi (Umysł) - Żółty
 *
 * Każda jednostka może nosić max 1 kryształ.
 * Zebranie wszystkich 6 + Matryca Kryształów = Fala Anihilacji.
 */

import { CrystalType, FP, PillarId } from '../types';

// ============================================================================
// INTERFEJSY
// ============================================================================

export interface CrystalEffect {
  type: 'stat_boost' | 'ability' | 'passive';
  stat?: string;
  value?: FP;
  abilityId?: string;
  description: string;
}

export interface CrystalDefinition {
  id: CrystalType;
  name: string;
  polishName: string;
  color: number;
  glowColor: number;

  // Efekty gdy kryształ jest equipowany
  effects: CrystalEffect[];

  // Gdzie można zdobyć
  dropLocations: {
    pillarId: PillarId;
    bossId: string;
    dropChance: FP; // Szansa w fixed-point (16384 = 1%)
  }[];

  // Koszt zakupu za dust (alternatywa)
  dustCost: number;

  // Koszt przeniesienia między jednostkami
  transferCost: {
    gold: number;
  };

  // Efekty fragmentów (10 fragmentów = pełny kryształ)
  fragmentEffect: {
    stat: string;
    valuePerFragment: FP; // 1/10 pełnego efektu
  };
}

export interface CrystalMatrixDefinition {
  name: string;
  description: string;

  // Wymagania do aktywacji
  requirements: {
    allSixCrystals: boolean;
    matrixArtifact: boolean;
    unitTier: number; // Minimalny tier jednostki
    minCommanderLevel: number; // Minimalny Commander Level
  };

  // Bonusy gdy wszystkie kryształy są zebrane
  fullSetBonus: {
    allStatsMultiplier: FP; // +200% = 49152
    allEffectsActive: boolean;
  };

  // Fala Anihilacji
  annihilationWave: {
    name: string;
    description: string;
    effect: 'massive_damage';
    cooldownWaves: number; // Jednostka niedostępna przez X fal
  };

  // Legacy alias
  snapAbility?: {
    name: string;
    description: string;
    effect: string;
    cooldownWaves: number;
  };
}

// ============================================================================
// DEFINICJE KRYSZTAŁÓW
// ============================================================================

const POWER_CRYSTAL: CrystalDefinition = {
  id: 'power',  // Keep original ID for DB compatibility
  name: 'Power Crystal',
  polishName: 'Kryształ Mocy',
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
      description: 'Wybuch Mocy: Potężny atak obszarowy (cooldown 30s)',
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

const SPACE_CRYSTAL: CrystalDefinition = {
  id: 'space',  // Keep original ID for DB compatibility
  name: 'Void Crystal',
  polishName: 'Kryształ Próżni',
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
      description: 'Uderzenie z Próżni: Ataki ignorują przeszkody',
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

const TIME_CRYSTAL: CrystalDefinition = {
  id: 'time',  // Keep original ID for DB compatibility
  name: 'Chrono Crystal',
  polishName: 'Kryształ Czasu',
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
      description: 'Cofnięcie Czasu: Cofa czas o 5 sekund (przywraca HP, pozycje) (cooldown 60s)',
    },
    {
      type: 'passive',
      description: 'Tarcza Temporalna: 20% szansa na uniknięcie ataku przez "cofnięcie" go',
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

const REALITY_CRYSTAL: CrystalDefinition = {
  id: 'reality',  // Keep original ID for DB compatibility
  name: 'Matter Crystal',
  polishName: 'Kryształ Materii',
  color: 0xff0000, // Czerwony
  glowColor: 0xff6347,

  effects: [
    {
      type: 'passive',
      description: 'Zmiana Materii: Ataki zmieniają typ obrażeń na najbardziej efektywny vs cel',
    },
    {
      type: 'ability',
      abilityId: 'matter_warp',
      description: 'Destabilizacja: Zamienia wrogów w bezbronne cele na 5s (cooldown 45s)',
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

const SOUL_CRYSTAL: CrystalDefinition = {
  id: 'soul',  // Keep original ID for DB compatibility
  name: 'Vitae Crystal',
  polishName: 'Kryształ Życia',
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
      description: 'Odrodzenie: Wskrzesza jednostkę z 50% HP po śmierci (raz na sektor)',
    },
    {
      type: 'passive',
      description: 'Wzmocnione Zmysły: Widzi ukrytych wrogów i ich słabe punkty (+15% crit)',
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

const MIND_CRYSTAL: CrystalDefinition = {
  id: 'mind',  // Keep original ID for DB compatibility
  name: 'Psi Crystal',
  polishName: 'Kryształ Umysłu',
  color: 0xffff00, // Żółty
  glowColor: 0xfffacd,

  effects: [
    {
      type: 'passive',
      description: 'Tarcza Mentalna: +100% odporność na kontrolę umysłu i stun',
    },
    {
      type: 'ability',
      abilityId: 'mind_control',
      description: 'Kontrola Umysłu: Przejmuje kontrolę nad wrogiem na 10s (cooldown 30s)',
    },
    {
      type: 'stat_boost',
      stat: 'xpMultiplier',
      value: 24576 as FP, // +50% XP
      description: '+50% XP zdobywanego przez jednostkę',
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
// MATRYCA KRYSZTAŁÓW (CRYSTAL MATRIX)
// ============================================================================

export const CRYSTAL_MATRIX: CrystalMatrixDefinition = {
  name: 'Matryca Kryształów',
  description: 'Starożytne urządzenie zdolne pomieścić wszystkie 6 kryształów i uwolnić ich pełną moc.',

  requirements: {
    allSixCrystals: true,
    matrixArtifact: true, // Musi mieć artefakt "Matryca Kryształów"
    unitTier: 3, // Tylko Tier 3 jednostka może użyć
    minCommanderLevel: 40, // Wymaga Commander Level 40+
  },

  fullSetBonus: {
    allStatsMultiplier: 49152 as FP, // +200% wszystkie statystyki
    allEffectsActive: true, // Wszystkie efekty kryształów aktywne jednocześnie
  },

  annihilationWave: {
    name: 'FALA ANIHILACJI',
    description: 'Uwalnia niszczycielską falę energii, która zadaje 30% HP wszystkim wrogom na ekranie.',
    effect: 'massive_damage',
    cooldownWaves: 25, // Jednostka niedostępna przez 25 fal po użyciu
  },

  // Legacy alias for backwards compatibility
  snapAbility: {
    name: 'Fala Anihilacji',
    description: 'Deals 30% HP damage to all enemies.',
    effect: 'kill_half_enemies',
    cooldownWaves: 25,
  },
};

// ============================================================================
// EKSPORT
// ============================================================================

export const CRYSTAL_DEFINITIONS: CrystalDefinition[] = [
  POWER_CRYSTAL,
  SPACE_CRYSTAL,
  TIME_CRYSTAL,
  REALITY_CRYSTAL,
  SOUL_CRYSTAL,
  MIND_CRYSTAL,
];

// Legacy export for backwards compatibility
export const INFINITY_STONE_DEFINITIONS = CRYSTAL_DEFINITIONS;
export const INFINITY_GAUNTLET = CRYSTAL_MATRIX;

// ============================================================================
// FRAGMENTY
// ============================================================================

export const FRAGMENTS_PER_CRYSTAL = 10;

// Legacy alias
export const FRAGMENTS_PER_STONE = FRAGMENTS_PER_CRYSTAL;

export interface CrystalFragmentState {
  crystalType: CrystalType;
  fragments: number; // 0-10, 10 = pełny kryształ
}

// ============================================================================
// FUNKCJE POMOCNICZE
// ============================================================================

/**
 * Pobiera definicję kryształu po typie
 */
export function getCrystalById(type: CrystalType): CrystalDefinition | undefined {
  return CRYSTAL_DEFINITIONS.find(c => c.id === type);
}

// Legacy alias
export const getStoneById = getCrystalById;

/**
 * Sprawdza czy jednostka może użyć Matrycy
 */
export function canUseCrystalMatrix(
  unitTier: number,
  hasMatrixArtifact: boolean,
  equippedCrystals: CrystalType[],
  commanderLevel: number = 1
): boolean {
  const hasAllCrystals = CRYSTAL_DEFINITIONS.every(crystal =>
    equippedCrystals.includes(crystal.id)
  );

  return (
    unitTier >= CRYSTAL_MATRIX.requirements.unitTier &&
    hasMatrixArtifact &&
    hasAllCrystals &&
    commanderLevel >= CRYSTAL_MATRIX.requirements.minCommanderLevel
  );
}

// Legacy alias
export const canUseInfinityGauntlet = canUseCrystalMatrix;

/**
 * Oblicza bonus z fragmentów kryształu
 */
export function calculateFragmentBonus(
  crystalType: CrystalType,
  fragmentCount: number
): { stat: string; value: FP } | undefined {
  const crystal = getCrystalById(crystalType);
  if (!crystal || fragmentCount <= 0) return undefined;

  const cappedFragments = Math.min(fragmentCount, FRAGMENTS_PER_CRYSTAL - 1); // Max 9 fragmentów dają bonus, 10 = pełny kryształ

  return {
    stat: crystal.fragmentEffect.stat,
    value: (crystal.fragmentEffect.valuePerFragment * cappedFragments) as FP,
  };
}

/**
 * Sprawdza czy fragmenty wystarczają na pełny kryształ
 */
export function canCraftFullCrystal(fragmentCount: number): boolean {
  return fragmentCount >= FRAGMENTS_PER_CRYSTAL;
}

// Legacy alias
export const canCraftFullStone = canCraftFullCrystal;

/**
 * Pobiera lokacje dropów dla kryształu
 */
export function getCrystalDropLocations(crystalType: CrystalType): {
  pillarId: PillarId;
  bossId: string;
  dropChance: FP;
}[] {
  const crystal = getCrystalById(crystalType);
  return crystal?.dropLocations ?? [];
}

// Legacy alias
export const getStoneDropLocations = getCrystalDropLocations;

/**
 * Oblicza szansę na drop fragmentu (1/10 szansy na pełny kryształ)
 */
export function getFragmentDropChance(crystalType: CrystalType, bossId: string): FP {
  const crystal = getCrystalById(crystalType);
  if (!crystal) return 0 as FP;

  const location = crystal.dropLocations.find(l => l.bossId === bossId);
  if (!location) return 0 as FP;

  // Fragment ma 5x większą szansę niż pełny kryształ
  return (location.dropChance * 5) as FP;
}

/**
 * Oblicza łączne bonusy z wszystkich equipowanych kryształów
 */
export function calculateCrystalBonuses(equippedCrystals: CrystalType[]): {
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

  for (const crystalType of equippedCrystals) {
    const crystal = getCrystalById(crystalType);
    if (!crystal) continue;

    for (const effect of crystal.effects) {
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

// Legacy alias
export const calculateStoneBonuses = calculateCrystalBonuses;

/**
 * Kolory kryształów do renderowania
 */
export const CRYSTAL_COLORS: Record<CrystalType, { main: number; glow: number }> = {
  power: { main: 0x9932cc, glow: 0xda70d6 },
  space: { main: 0x0000ff, glow: 0x87ceeb },
  time: { main: 0x00ff00, glow: 0x98fb98 },
  reality: { main: 0xff0000, glow: 0xff6347 },
  soul: { main: 0xffa500, glow: 0xffd700 },
  mind: { main: 0xffff00, glow: 0xfffacd },
};

// Legacy alias
export const STONE_COLORS = CRYSTAL_COLORS;

/**
 * Kolejność kryształów na Matrycy
 */
export const MATRIX_CRYSTAL_ORDER: CrystalType[] = [
  'power',   // Slot 1
  'space',   // Slot 2
  'reality', // Slot 3
  'soul',    // Slot 4
  'time',    // Slot 5
  'mind',    // Slot 6 (centrum)
];

// Legacy alias
export const GAUNTLET_STONE_ORDER = MATRIX_CRYSTAL_ORDER;

// ============================================================================
// BOSS TO CRYSTAL MAPPING
// ============================================================================

/**
 * Mapowanie bossów sektorów do możliwych drop-ów kryształów
 */
export const BOSS_CRYSTAL_DROPS: Record<string, {
  pillarId: PillarId;
  crystalType: CrystalType;
  fragmentChance: FP; // Szansa na fragment (5x większa niż na pełny kryształ)
  fullCrystalChance: FP; // Szansa na pełny kryształ
}[]> = {
  // Science sector bosses - DROP RATES SIGNIFICANTLY REDUCED
  // 2% fragment chance = 328 FP, 0.2% full crystal = 33 FP
  ultron: [
    { pillarId: 'science', crystalType: 'mind', fragmentChance: 328 as FP, fullCrystalChance: 33 as FP },
  ],
  modok: [],

  // Cosmos sector bosses
  corvus_glaive: [
    { pillarId: 'cosmos', crystalType: 'power', fragmentChance: 328 as FP, fullCrystalChance: 33 as FP },
  ],
  ronan: [
    { pillarId: 'cosmos', crystalType: 'power', fragmentChance: 492 as FP, fullCrystalChance: 49 as FP }, // 3% / 0.3%
    { pillarId: 'cosmos', crystalType: 'space', fragmentChance: 328 as FP, fullCrystalChance: 33 as FP },
  ],

  // Magic sector bosses
  dormammu: [
    { pillarId: 'magic', crystalType: 'time', fragmentChance: 328 as FP, fullCrystalChance: 33 as FP },
    { pillarId: 'magic', crystalType: 'reality', fragmentChance: 328 as FP, fullCrystalChance: 33 as FP },
  ],
  baron_mordo: [],

  // Gods sector bosses
  hela: [
    { pillarId: 'gods', crystalType: 'soul', fragmentChance: 328 as FP, fullCrystalChance: 33 as FP },
  ],
  surtur: [],

  // Streets sector bosses
  kingpin: [],
  bullseye: [],

  // Mutants sector bosses
  master_mold: [],
  nimrod: [],
};

// Legacy alias
export const BOSS_STONE_DROPS = BOSS_CRYSTAL_DROPS;

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
 * Losuje drop kryształu/fragmentu dla bossa
 * @returns null jeśli nic nie wypadło, lub obiekt z typem kryształu i czy to pełny kryształ
 */
export function rollCrystalDrop(
  bossId: string,
  pillarId: PillarId,
  rngValue: number // 0-1 normalized
): { crystalType: CrystalType; isFullCrystal: boolean; stoneType: CrystalType; isFullStone: boolean } | null {
  const drops = BOSS_CRYSTAL_DROPS[bossId];
  if (!drops || drops.length === 0) return null;

  // Filtruj do odpowiedniego sektora
  const validDrops = drops.filter(d => d.pillarId === pillarId);
  if (validDrops.length === 0) return null;

  // Konwertuj rngValue (0-1) do fixed-point (0-16384)
  const roll = Math.floor(rngValue * 16384);

  for (const drop of validDrops) {
    // Najpierw sprawdź pełny kryształ (niższa szansa)
    if (roll < drop.fullCrystalChance) {
      return {
        crystalType: drop.crystalType,
        isFullCrystal: true,
        // Legacy aliases
        stoneType: drop.crystalType,
        isFullStone: true,
      };
    }
    // Potem sprawdź fragment (wyższa szansa)
    if (roll < drop.fragmentChance) {
      return {
        crystalType: drop.crystalType,
        isFullCrystal: false,
        // Legacy aliases
        stoneType: drop.crystalType,
        isFullStone: false,
      };
    }
  }

  return null;
}

// Legacy alias
export const rollStoneDrop = rollCrystalDrop;

/**
 * Pobiera losowe ID bossa dla danego typu wroga i fali
 */
export function getBossIdForEnemy(enemyType: string, wave: number): string | null {
  const bossIds = ENEMY_TYPE_TO_BOSS_ID[enemyType];
  if (!bossIds || bossIds.length === 0) return null;

  // Deterministyczny wybór bossa na podstawie fali
  return bossIds[wave % bossIds.length];
}
