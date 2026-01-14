/**
 * Pillar Challenge - Deterministyczny tryb zdobywania kryształów
 *
 * Tryb challenge dla każdego filaru, gdzie nagrody są 100% deterministyczne
 * (żadnych losowych dropów). Gracz zdobywa fragmenty kryształów poprzez
 * ukończenie wyzwań i spełnienie warunków bonusowych.
 *
 * Zasady balansu:
 * - Wcześniejsze pilary (Streets, Mutants) dają 50% normalnej ilości fragmentów
 * - Późniejsze pilary dają pełne nagrody
 * - Magic i Gods dają po 2 typy kryształów (podzielone)
 * - Pełny kryształ można zdobyć tylko za Perfect Clear na Hard/Mythic
 */

import { FP, PillarId, CrystalType } from './types';

// ============================================================================
// TYPY
// ============================================================================

export type PillarChallengeTier = 'normal' | 'hard' | 'mythic';

/**
 * Mapowanie filaru do typów kryształów
 */
export interface PillarCrystalReward {
  /** Główny typ kryształu */
  primaryCrystal: CrystalType;
  /** Opcjonalny drugi kryształ (dla Magic, Gods) */
  secondaryCrystal?: CrystalType;
  /** Mnożnik ilości fragmentów (0.5 dla wczesnych pilarów) */
  fragmentMultiplier: number;
}

/**
 * Konfiguracja tieru trudności
 */
export interface TierConfig {
  /** Nazwa tieru */
  name: string;
  /** Opis tieru */
  description: string;
  /** Liczba fal do ukończenia */
  waveCount: number;
  /** Limit czasu w sekundach */
  timeLimit: number;
  /** Mnożnik HP wrogów (FP: 16384 = 1.0) */
  enemyHpMultiplier: FP;
  /** Mnożnik DMG wrogów */
  enemyDmgMultiplier: FP;
  /** Mnożnik prędkości wrogów */
  enemySpeedMultiplier: FP;
  /** Bazowa liczba fragmentów za ukończenie */
  baseFragments: number;
  /** Maksymalna liczba fragmentów bonusowych */
  maxBonusFragments: number;
  /** Czy można zdobyć pełny kryształ za Perfect Clear */
  canEarnFullCrystal: boolean;
  /** Wymaganie do odblokowania tieru */
  unlockRequirement: {
    /** Liczba ukończeń poprzedniego tieru */
    previousTierClears?: number;
    /** Czy wymagane jest Perfect Clear poprzedniego tieru */
    previousTierPerfect?: boolean;
  };
}

/**
 * Warunek bonusowy (performance bonus)
 */
export interface PerformanceBonus {
  id: string;
  name: string;
  description: string;
  /** Liczba dodatkowych fragmentów */
  fragmentReward: number;
  /** Czy daje pełny kryształ (tylko Hard/Mythic Perfect) */
  grantsFullCrystal: boolean;
  /** Funkcja sprawdzająca czy bonus został osiągnięty */
  condition: PerfBonusCondition;
}

export type PerfBonusCondition =
  | { type: 'time_under'; seconds: number }
  | { type: 'fortress_hp_above'; percent: number }
  | { type: 'no_fortress_damage' }
  | { type: 'no_hero_deaths' }
  | { type: 'all_waves_perfect'; damageThreshold: number };

/**
 * Konfiguracja wejścia do Challenge
 */
export interface ChallengeEntryConfig {
  /** Darmowe próby dziennie */
  freeAttemptsPerDay: number;
  /** Maksymalna liczba płatnych prób */
  maxPaidAttempts: number;
  /** Koszt płatnej próby w goldzie */
  paidAttemptCost: number;
  /** Cooldown między próbami w minutach */
  cooldownMinutes: number;
}

/**
 * Stan sesji Pillar Challenge
 */
export interface PillarChallengeState {
  /** ID sesji */
  sessionId: string;
  /** ID użytkownika */
  userId: string;
  /** ID filaru */
  pillarId: PillarId;
  /** Tier trudności */
  tier: PillarChallengeTier;
  /** Seed dla determinizmu */
  seed: number;

  /** Fala startowa (zawsze 1) */
  startWave: number;
  /** Aktualna fala */
  currentWave: number;
  /** Fale ukończone */
  wavesCleared: number;
  /** Docelowa liczba fal */
  targetWaves: number;

  /** Czas rozpoczęcia */
  startedAt: number;
  /** Czas zakończenia (null jeśli w toku) */
  endedAt: number | null;
  /** Czy ukończono */
  completed: boolean;
  /** Czy zwyciężono */
  victory: boolean;

  /** Obrażenia zadane twierdzy */
  fortressDamageTaken: number;
  /** Maksymalne HP twierdzy na starcie */
  fortressMaxHp: number;
  /** Aktualne HP twierdzy */
  fortressCurrentHp: number;
  /** Bohaterowie straceni */
  heroesLost: number;
  /** Całkowite obrażenia zadane wrogom */
  totalDamageDealt: number;

  /** Osiągnięte bonusy */
  achievedBonuses: string[];

  /** Nagrody */
  rewards: {
    /** Fragmenty głównego kryształu */
    primaryFragments: number;
    /** Fragmenty drugiego kryształu (opcjonalnie) */
    secondaryFragments: number;
    /** Czy zdobyto pełny kryształ */
    fullCrystalEarned: boolean;
    /** Typ zdobytego pełnego kryształu */
    fullCrystalType: CrystalType | null;
    /** Gold */
    gold: number;
    /** XP twierdzy */
    fortressXp: number;
    /** Materiały */
    materials: Record<string, number>;
  };
}

/**
 * Podsumowanie sesji
 */
export interface PillarChallengeSummary {
  sessionId: string;
  pillarId: PillarId;
  tier: PillarChallengeTier;
  victory: boolean;
  wavesCleared: number;
  targetWaves: number;
  timeElapsed: number;
  fortressHpPercent: number;
  heroesLost: number;
  achievedBonuses: {
    id: string;
    name: string;
    fragmentReward: number;
  }[];
  totalFragmentsEarned: number;
  fullCrystalEarned: boolean;
  crystalType: CrystalType;
  secondaryCrystalType?: CrystalType;
}

// ============================================================================
// STAŁE KONFIGURACYJNE
// ============================================================================

/**
 * Mapowanie filarów do kryształów
 *
 * BALANS:
 * - Streets/Mutants: 50% fragment rate (wczesne pilary, łatwiejsze)
 * - Science/Cosmos: 100% fragment rate (średnie pilary)
 * - Magic: Time + Reality (50% każdy, razem 100%)
 * - Gods: Power + Soul (50% każdy, razem 100%, premium pillar)
 */
export const PILLAR_CRYSTAL_REWARDS: Record<PillarId, PillarCrystalReward> = {
  streets: {
    primaryCrystal: 'power',
    fragmentMultiplier: 0.5, // Wczesny pillar - 50%
  },
  science: {
    primaryCrystal: 'mind',
    fragmentMultiplier: 1.0, // Pełne nagrody
  },
  mutants: {
    primaryCrystal: 'soul',
    fragmentMultiplier: 0.5, // Wczesny pillar - 50%
  },
  cosmos: {
    primaryCrystal: 'space',
    fragmentMultiplier: 1.0, // Pełne nagrody
  },
  magic: {
    primaryCrystal: 'time',
    secondaryCrystal: 'reality',
    fragmentMultiplier: 1.0, // 50% każdy = 100% total
  },
  gods: {
    primaryCrystal: 'power',
    secondaryCrystal: 'soul',
    fragmentMultiplier: 1.0, // 50% każdy = 100% total (premium rewards)
  },
};

/**
 * Konfiguracja tierów trudności
 *
 * BALANS TIERÓW:
 * - Normal: Wprowadzenie, niskie nagrody, bez pełnego kryształu
 * - Hard: Główny grind, dobre nagrody, pełny kryształ za Perfect
 * - Mythic: Endgame challenge, najlepsze nagrody, każdy Perfect = pełny kryształ
 */
export const TIER_CONFIGS: Record<PillarChallengeTier, TierConfig> = {
  normal: {
    name: 'Normal',
    description: 'Standardowe wyzwanie. Idealne na początek.',
    waveCount: 10,
    timeLimit: 300, // 5 minut
    enemyHpMultiplier: 16384 as FP, // 1.0x
    enemyDmgMultiplier: 16384 as FP, // 1.0x
    enemySpeedMultiplier: 16384 as FP, // 1.0x
    baseFragments: 1,
    maxBonusFragments: 2,
    canEarnFullCrystal: false,
    unlockRequirement: {},
  },
  hard: {
    name: 'Hard',
    description: 'Wzmocnieni wrogowie. Główne źródło fragmentów.',
    waveCount: 15,
    timeLimit: 420, // 7 minut
    enemyHpMultiplier: 24576 as FP, // 1.5x
    enemyDmgMultiplier: 20480 as FP, // 1.25x
    enemySpeedMultiplier: 18022 as FP, // 1.1x
    baseFragments: 2,
    maxBonusFragments: 3,
    canEarnFullCrystal: true, // Tylko za pierwszy Perfect Clear
    unlockRequirement: {
      previousTierClears: 3,
    },
  },
  mythic: {
    name: 'Mythic',
    description: 'Ekstremalne wyzwanie dla najlepszych.',
    waveCount: 20,
    timeLimit: 600, // 10 minut
    enemyHpMultiplier: 32768 as FP, // 2.0x
    enemyDmgMultiplier: 26214 as FP, // 1.6x
    enemySpeedMultiplier: 19661 as FP, // 1.2x
    baseFragments: 3,
    maxBonusFragments: 5,
    canEarnFullCrystal: true, // Każdy Perfect Clear
    unlockRequirement: {
      previousTierClears: 5,
      previousTierPerfect: true,
    },
  },
};

/**
 * Bonusy za wydajność (performance bonuses)
 *
 * BALANS BONUSÓW:
 * - Speed Clear: Nagroda za szybkie granie (wymaga optymalizacji buildu)
 * - Fortress Intact: Nagroda za defensywę (HP > 75%)
 * - Perfect Clear: Nagroda za brak obrażeń (bardzo trudne)
 * - Heroes Triumphant: Nagroda za utrzymanie bohaterów
 */
export const PERFORMANCE_BONUSES: PerformanceBonus[] = [
  {
    id: 'speed_clear',
    name: 'Błyskawiczne Zwycięstwo',
    description: 'Ukończ wyzwanie w mniej niż 2 minuty',
    fragmentReward: 1,
    grantsFullCrystal: false,
    condition: { type: 'time_under', seconds: 120 },
  },
  {
    id: 'fortress_intact',
    name: 'Niezłomna Twierdza',
    description: 'Ukończ z HP twierdzy powyżej 75%',
    fragmentReward: 1,
    grantsFullCrystal: false,
    condition: { type: 'fortress_hp_above', percent: 75 },
  },
  {
    id: 'perfect_clear',
    name: 'Perfekcyjne Ukończenie',
    description: 'Ukończ bez obrażeń twierdzy',
    fragmentReward: 2,
    grantsFullCrystal: true, // Tylko na Hard/Mythic
    condition: { type: 'no_fortress_damage' },
  },
  {
    id: 'heroes_triumphant',
    name: 'Bohaterowie Triumfują',
    description: 'Żaden bohater nie zginął',
    fragmentReward: 1,
    grantsFullCrystal: false,
    condition: { type: 'no_hero_deaths' },
  },
];

/**
 * Konfiguracja systemu wejścia
 */
export const CHALLENGE_ENTRY_CONFIG: ChallengeEntryConfig = {
  freeAttemptsPerDay: 3,
  maxPaidAttempts: 2,
  paidAttemptCost: 1000, // 1000 gold
  cooldownMinutes: 30,
};

/**
 * Nagrody materiałowe za tier (bazowe, skalowane przez pillar)
 */
export const TIER_MATERIAL_REWARDS: Record<PillarChallengeTier, Record<string, { min: number; max: number }>> = {
  normal: {
    gold: { min: 500, max: 800 },
    dust: { min: 25, max: 50 },
  },
  hard: {
    gold: { min: 1000, max: 1500 },
    dust: { min: 50, max: 100 },
  },
  mythic: {
    gold: { min: 2000, max: 3000 },
    dust: { min: 100, max: 200 },
  },
};

/**
 * Materiały specyficzne dla filaru (drop z bossów w challenge)
 */
export const PILLAR_SPECIFIC_MATERIALS: Record<PillarId, { material: string; dropChance: number }[]> = {
  streets: [
    { material: 'super_soldier_serum', dropChance: 0.15 },
    { material: 'vibranium', dropChance: 0.1 },
  ],
  science: [
    { material: 'pym_particles', dropChance: 0.2 },
    { material: 'extremis', dropChance: 0.15 },
  ],
  mutants: [
    { material: 'mutant_dna', dropChance: 0.2 },
    { material: 'adamantium', dropChance: 0.08 },
  ],
  cosmos: [
    { material: 'cosmic_dust', dropChance: 0.2 },
    { material: 'uru', dropChance: 0.1 },
  ],
  magic: [
    { material: 'darkforce', dropChance: 0.2 },
    { material: 'mystic_runes', dropChance: 0.15 },
  ],
  gods: [
    { material: 'uru', dropChance: 0.25 },
    { material: 'asgardian_steel', dropChance: 0.1 },
  ],
};

/**
 * XP twierdzy za ukończenie
 */
export const TIER_FORTRESS_XP: Record<PillarChallengeTier, number> = {
  normal: 500,
  hard: 1000,
  mythic: 2000,
};

/**
 * Mnożnik XP według filaru (późniejsze filary dają więcej XP)
 */
export const PILLAR_XP_MULTIPLIERS: Record<PillarId, number> = {
  streets: 1.0,
  science: 1.2,
  mutants: 1.3,
  cosmos: 1.5,
  magic: 1.7,
  gods: 2.0,
};

// ============================================================================
// FUNKCJE POMOCNICZE
// ============================================================================

/**
 * Sprawdza czy bonus został osiągnięty
 */
export function checkPerformanceBonus(
  bonus: PerformanceBonus,
  state: PillarChallengeState
): boolean {
  const condition = bonus.condition;

  switch (condition.type) {
    case 'time_under': {
      const elapsed = state.endedAt
        ? (state.endedAt - state.startedAt) / 1000
        : Infinity;
      return elapsed < condition.seconds;
    }
    case 'fortress_hp_above': {
      const hpPercent = (state.fortressCurrentHp / state.fortressMaxHp) * 100;
      return hpPercent >= condition.percent;
    }
    case 'no_fortress_damage': {
      return state.fortressDamageTaken === 0;
    }
    case 'no_hero_deaths': {
      return state.heroesLost === 0;
    }
    case 'all_waves_perfect': {
      // To wymaga śledzenia per-wave damage, na razie uproszczone
      return state.fortressDamageTaken < condition.damageThreshold;
    }
    default:
      return false;
  }
}

/**
 * Oblicza nagrody fragmentowe dla sesji
 */
export function calculateFragmentRewards(
  pillarId: PillarId,
  tier: PillarChallengeTier,
  achievedBonuses: string[],
  isFirstPerfectClear: boolean
): {
  primaryFragments: number;
  secondaryFragments: number;
  fullCrystalEarned: boolean;
  fullCrystalType: CrystalType | null;
} {
  const pillarReward = PILLAR_CRYSTAL_REWARDS[pillarId];
  const tierConfig = TIER_CONFIGS[tier];

  // Bazowe fragmenty (skalowane przez mnożnik filaru)
  let baseFragments = Math.ceil(tierConfig.baseFragments * pillarReward.fragmentMultiplier);

  // Bonusowe fragmenty
  let bonusFragments = 0;
  let earnedFullCrystal = false;

  for (const bonusId of achievedBonuses) {
    const bonus = PERFORMANCE_BONUSES.find(b => b.id === bonusId);
    if (bonus) {
      bonusFragments += bonus.fragmentReward;

      // Pełny kryształ za Perfect Clear
      if (bonus.grantsFullCrystal && tierConfig.canEarnFullCrystal) {
        // Na Hard - tylko pierwszy Perfect Clear daje pełny kryształ
        // Na Mythic - każdy Perfect Clear daje pełny kryształ
        if (tier === 'mythic' || (tier === 'hard' && isFirstPerfectClear)) {
          earnedFullCrystal = true;
        }
      }
    }
  }

  // Skaluj bonusy przez mnożnik filaru
  bonusFragments = Math.ceil(bonusFragments * pillarReward.fragmentMultiplier);

  // Limit bonusów
  bonusFragments = Math.min(bonusFragments, tierConfig.maxBonusFragments);

  const totalFragments = baseFragments + bonusFragments;

  // Dla pilarów z dwoma kryształami, dziel po połowie
  let primaryFragments = totalFragments;
  let secondaryFragments = 0;

  if (pillarReward.secondaryCrystal) {
    primaryFragments = Math.floor(totalFragments / 2);
    secondaryFragments = Math.ceil(totalFragments / 2);
  }

  return {
    primaryFragments,
    secondaryFragments,
    fullCrystalEarned: earnedFullCrystal,
    fullCrystalType: earnedFullCrystal ? pillarReward.primaryCrystal : null,
  };
}

/**
 * Oblicza nagrody materiałowe dla sesji
 */
export function calculateMaterialRewards(
  pillarId: PillarId,
  tier: PillarChallengeTier,
  seed: number,
  wavesCleared: number,
  targetWaves: number
): { gold: number; dust: number; materials: Record<string, number> } {
  const tierMaterials = TIER_MATERIAL_REWARDS[tier];
  const pillarMaterials = PILLAR_SPECIFIC_MATERIALS[pillarId];

  // Prosty pseudo-random oparty na seedzie
  const rng = (s: number) => {
    const x = Math.sin(s) * 10000;
    return x - Math.floor(x);
  };

  // Mnożnik za postęp (pełne ukończenie = 100%, częściowe = proporcjonalnie)
  const progressMultiplier = wavesCleared / targetWaves;

  // Gold
  const goldRange = tierMaterials.gold;
  const gold = Math.floor(
    (goldRange.min + rng(seed) * (goldRange.max - goldRange.min)) * progressMultiplier
  );

  // Dust
  const dustRange = tierMaterials.dust;
  const dust = Math.floor(
    (dustRange.min + rng(seed + 1) * (dustRange.max - dustRange.min)) * progressMultiplier
  );

  // Materiały specyficzne dla filaru
  const materials: Record<string, number> = {};

  for (let i = 0; i < pillarMaterials.length; i++) {
    const mat = pillarMaterials[i];
    // Szansa na drop rośnie z tierem
    const tierBonus = tier === 'mythic' ? 1.5 : tier === 'hard' ? 1.2 : 1.0;
    const effectiveChance = mat.dropChance * tierBonus * progressMultiplier;

    if (rng(seed + 2 + i) < effectiveChance) {
      // Ilość: 1 na Normal, 1-2 na Hard, 1-3 na Mythic
      const maxAmount = tier === 'mythic' ? 3 : tier === 'hard' ? 2 : 1;
      const amount = Math.floor(rng(seed + 100 + i) * maxAmount) + 1;
      materials[mat.material] = (materials[mat.material] || 0) + amount;
    }
  }

  return { gold, dust, materials };
}

/**
 * Tworzy nowy stan sesji Pillar Challenge
 */
export function createPillarChallengeState(
  sessionId: string,
  userId: string,
  pillarId: PillarId,
  tier: PillarChallengeTier,
  seed: number,
  fortressMaxHp: number
): PillarChallengeState {
  const tierConfig = TIER_CONFIGS[tier];

  return {
    sessionId,
    userId,
    pillarId,
    tier,
    seed,
    startWave: 1,
    currentWave: 1,
    wavesCleared: 0,
    targetWaves: tierConfig.waveCount,
    startedAt: Date.now(),
    endedAt: null,
    completed: false,
    victory: false,
    fortressDamageTaken: 0,
    fortressMaxHp,
    fortressCurrentHp: fortressMaxHp,
    heroesLost: 0,
    totalDamageDealt: 0,
    achievedBonuses: [],
    rewards: {
      primaryFragments: 0,
      secondaryFragments: 0,
      fullCrystalEarned: false,
      fullCrystalType: null,
      gold: 0,
      fortressXp: 0,
      materials: {},
    },
  };
}

/**
 * Przetwarza zakończenie fali
 */
export function processWaveComplete(
  state: PillarChallengeState,
  fortressDamageTaken: number
): PillarChallengeState {
  return {
    ...state,
    currentWave: state.currentWave + 1,
    wavesCleared: state.wavesCleared + 1,
    fortressDamageTaken: state.fortressDamageTaken + fortressDamageTaken,
    fortressCurrentHp: state.fortressMaxHp - state.fortressDamageTaken - fortressDamageTaken,
  };
}

/**
 * Przetwarza śmierć bohatera
 */
export function processHeroDeath(state: PillarChallengeState): PillarChallengeState {
  return {
    ...state,
    heroesLost: state.heroesLost + 1,
  };
}

/**
 * Kończy sesję (zwycięstwo lub porażka)
 */
export function finishChallengeSession(
  state: PillarChallengeState,
  victory: boolean,
  isFirstPerfectClear: boolean
): PillarChallengeState {
  const endedAt = Date.now();

  // Oblicz osiągnięte bonusy
  const updatedState: PillarChallengeState = {
    ...state,
    endedAt,
    completed: true,
    victory,
  };

  const achievedBonuses: string[] = [];

  if (victory) {
    for (const bonus of PERFORMANCE_BONUSES) {
      if (checkPerformanceBonus(bonus, updatedState)) {
        achievedBonuses.push(bonus.id);
      }
    }
  }

  // Oblicz nagrody tylko przy zwycięstwie
  let rewards = updatedState.rewards;

  if (victory) {
    const fragmentRewards = calculateFragmentRewards(
      state.pillarId,
      state.tier,
      achievedBonuses,
      isFirstPerfectClear
    );

    const materialRewards = calculateMaterialRewards(
      state.pillarId,
      state.tier,
      state.seed,
      state.wavesCleared,
      state.targetWaves
    );

    // XP
    const baseXp = TIER_FORTRESS_XP[state.tier];
    const xpMultiplier = PILLAR_XP_MULTIPLIERS[state.pillarId];
    const fortressXp = Math.floor(baseXp * xpMultiplier);

    rewards = {
      ...fragmentRewards,
      gold: materialRewards.gold,
      fortressXp,
      materials: materialRewards.materials,
    };
  }

  return {
    ...updatedState,
    achievedBonuses,
    rewards,
  };
}

/**
 * Generuje podsumowanie sesji
 */
export function generateChallengeSummary(state: PillarChallengeState): PillarChallengeSummary {
  const pillarReward = PILLAR_CRYSTAL_REWARDS[state.pillarId];
  const timeElapsed = state.endedAt
    ? (state.endedAt - state.startedAt) / 1000
    : 0;

  const achievedBonusDetails = state.achievedBonuses.map(id => {
    const bonus = PERFORMANCE_BONUSES.find(b => b.id === id)!;
    return {
      id: bonus.id,
      name: bonus.name,
      fragmentReward: bonus.fragmentReward,
    };
  });

  return {
    sessionId: state.sessionId,
    pillarId: state.pillarId,
    tier: state.tier,
    victory: state.victory,
    wavesCleared: state.wavesCleared,
    targetWaves: state.targetWaves,
    timeElapsed,
    fortressHpPercent: (state.fortressCurrentHp / state.fortressMaxHp) * 100,
    heroesLost: state.heroesLost,
    achievedBonuses: achievedBonusDetails,
    totalFragmentsEarned: state.rewards.primaryFragments + state.rewards.secondaryFragments,
    fullCrystalEarned: state.rewards.fullCrystalEarned,
    crystalType: pillarReward.primaryCrystal,
    secondaryCrystalType: pillarReward.secondaryCrystal,
  };
}

/**
 * Sprawdza czy tier jest odblokowany
 */
export function isTierUnlocked(
  tier: PillarChallengeTier,
  _pillarId: PillarId,
  playerProgress: {
    normalClears: number;
    hardClears: number;
    normalPerfect: boolean;
    hardPerfect: boolean;
  }
): boolean {
  const tierConfig = TIER_CONFIGS[tier];
  const req = tierConfig.unlockRequirement;

  if (tier === 'normal') return true;

  if (tier === 'hard') {
    return playerProgress.normalClears >= (req.previousTierClears || 0);
  }

  if (tier === 'mythic') {
    return (
      playerProgress.hardClears >= (req.previousTierClears || 0) &&
      (!req.previousTierPerfect || playerProgress.hardPerfect)
    );
  }

  return false;
}

/**
 * Oblicza ile prób pozostało dziś
 */
export function calculateRemainingAttempts(
  usedFreeAttempts: number,
  usedPaidAttempts: number
): { freeRemaining: number; paidRemaining: number; totalRemaining: number } {
  const config = CHALLENGE_ENTRY_CONFIG;

  const freeRemaining = Math.max(0, config.freeAttemptsPerDay - usedFreeAttempts);
  const paidRemaining = Math.max(0, config.maxPaidAttempts - usedPaidAttempts);

  return {
    freeRemaining,
    paidRemaining,
    totalRemaining: freeRemaining + paidRemaining,
  };
}

/**
 * Sprawdza czy cooldown minął
 */
export function isCooldownExpired(lastAttemptTime: number | null): boolean {
  if (!lastAttemptTime) return true;

  const cooldownMs = CHALLENGE_ENTRY_CONFIG.cooldownMinutes * 60 * 1000;
  return Date.now() - lastAttemptTime >= cooldownMs;
}

/**
 * Zwraca czas do końca cooldownu w sekundach
 */
export function getCooldownRemaining(lastAttemptTime: number | null): number {
  if (!lastAttemptTime) return 0;

  const cooldownMs = CHALLENGE_ENTRY_CONFIG.cooldownMinutes * 60 * 1000;
  const elapsed = Date.now() - lastAttemptTime;
  const remaining = cooldownMs - elapsed;

  return Math.max(0, Math.ceil(remaining / 1000));
}

/**
 * Zwraca informacje o kryształach dla filaru
 */
export function getCrystalInfoForPillar(pillarId: PillarId): {
  primary: { type: CrystalType; name: string };
  secondary?: { type: CrystalType; name: string };
  fragmentMultiplier: number;
} {
  const reward = PILLAR_CRYSTAL_REWARDS[pillarId];

  const crystalNames: Record<CrystalType, string> = {
    power: 'Kryształ Mocy',
    space: 'Kryształ Przestrzeni',
    time: 'Kryształ Czasu',
    reality: 'Kryształ Rzeczywistości',
    soul: 'Kryształ Duszy',
    mind: 'Kryształ Umysłu',
  };

  return {
    primary: {
      type: reward.primaryCrystal,
      name: crystalNames[reward.primaryCrystal],
    },
    secondary: reward.secondaryCrystal
      ? {
          type: reward.secondaryCrystal,
          name: crystalNames[reward.secondaryCrystal],
        }
      : undefined,
    fragmentMultiplier: reward.fragmentMultiplier,
  };
}

