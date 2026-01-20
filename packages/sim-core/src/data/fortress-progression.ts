/**
 * Unified Progression System (Commander Level)
 *
 * Zunifikowany system progresji (persystuje między runami):
 * - XP zdobywane z zabijania wrogów, ukończenia fal/filarów + bonusy post-run
 * - Poziomy 1-50: główne odblokowania (skills, slots, pillary)
 * - Poziomy 51+: bonusy pasywne (damage%, gold%, starting gold)
 * - Umiejętności klasy odblokowywane z poziomem
 * - Sloty bohaterów/wieżyczek odblokowywane z poziomem
 */

import { FP, PillarId } from '../types';

// ============================================================================
// PILLAR LEVEL REQUIREMENTS - Single source of truth
// ============================================================================

/**
 * Level-gated pillar unlock requirements.
 * This is the single source of truth for all pillar unlocking in the game.
 */
export const PILLAR_LEVEL_REQUIREMENTS: Record<PillarId, number> = {
  streets: 1,
  science: 15,
  mutants: 30,
  cosmos: 45,
  magic: 60,
  gods: 80,
};

// ============================================================================
// INTERFEJSY
// ============================================================================

export interface FortressLevelReward {
  type: 'hp_bonus' | 'damage_bonus' | 'skill_unlock' | 'hero_slot' | 'turret_slot' | 'pillar_unlock' | 'feature_unlock' | 'hero_unlock' | 'turret_unlock' | 'class_unlock';
  value?: number | FP;
  skillId?: string;
  pillarId?: PillarId;
  featureId?: string;
  heroId?: string;
  turretType?: string;
  classId?: string;
  description: string;
}

export interface FortressLevel {
  level: number;
  xpRequired: number; // Łączne XP do osiągnięcia tego poziomu
  xpToNext: number;   // XP potrzebne do następnego poziomu
  rewards: FortressLevelReward[];
}

export interface XPSource {
  type: 'enemy_kill' | 'wave_complete' | 'pillar_complete' | 'pillar_first' | 'boss_kill';
  baseXp: number;
  scaling?: {
    perWave?: number;      // Bonus XP za wyższe fale
    perDifficulty?: FP;    // Mnożnik za trudność
  };
}

/**
 * Konfiguracja odblokowywania slotów (bohater/wieżyczka)
 */
export interface SlotUnlockConfig {
  slot: number;
  levelRequired: number;
  goldCost: number;
  isFree: boolean;
}

// ============================================================================
// KONFIGURACJA XP
// ============================================================================

export const XP_SOURCES: Record<string, XPSource> = {
  enemy_kill: {
    type: 'enemy_kill',
    baseXp: 0.75,  // Rebalanced from 1
    scaling: {
      perWave: 0.075, // Rebalanced from 0.1
    },
  },
  elite_enemy_kill: {
    type: 'enemy_kill',
    baseXp: 3,  // Rebalanced from 5
    scaling: {
      perWave: 0.3,  // Rebalanced from 0.5
    },
  },
  boss_kill: {
    type: 'boss_kill',
    baseXp: 35,  // Rebalanced from 50
    scaling: {
      perWave: 1.5,  // Rebalanced from 2
    },
  },
  wave_complete: {
    type: 'wave_complete',
    baseXp: 7,  // Rebalanced from 10
    scaling: {
      perWave: 1.5, // Rebalanced from 2
    },
  },
  pillar_complete: {
    type: 'pillar_complete',
    baseXp: 350,  // Rebalanced from 500
  },
  pillar_first_complete: {
    type: 'pillar_first',
    baseXp: 700,  // Rebalanced from 1000
  },
};

// ============================================================================
// KONFIGURACJA SLOTÓW (ZAKUP ZA ZŁOTO + POZIOM)
// ============================================================================

/**
 * Konfiguracja odblokowywania slotów bohaterów
 * Gracz zaczyna z 2 darmowymi slotami, kolejne kupuje za złoto
 */
export const HERO_SLOT_UNLOCKS: SlotUnlockConfig[] = [
  { slot: 1, levelRequired: 1, goldCost: 0, isFree: true },
  { slot: 2, levelRequired: 1, goldCost: 0, isFree: true },
  { slot: 3, levelRequired: 15, goldCost: 3000, isFree: false },
  { slot: 4, levelRequired: 25, goldCost: 8000, isFree: false },
  { slot: 5, levelRequired: 35, goldCost: 20000, isFree: false },
  { slot: 6, levelRequired: 50, goldCost: 50000, isFree: false },
];

export const MAX_HERO_SLOTS = 6;

/**
 * Konfiguracja odblokowywania slotów wieżyczek
 * Gracz zaczyna z 1 darmowym slotem, kolejne kupuje za złoto
 */
export const TURRET_SLOT_UNLOCKS: SlotUnlockConfig[] = [
  { slot: 1, levelRequired: 1, goldCost: 0, isFree: true },
  { slot: 2, levelRequired: 5, goldCost: 1000, isFree: false },
  { slot: 3, levelRequired: 15, goldCost: 3000, isFree: false },
  { slot: 4, levelRequired: 25, goldCost: 8000, isFree: false },
  { slot: 5, levelRequired: 35, goldCost: 15000, isFree: false },
  { slot: 6, levelRequired: 40, goldCost: 25000, isFree: false },
];

export const MAX_TURRET_SLOTS = 6;

/**
 * Pobiera następny slot do kupienia dla bohaterów
 * Zwraca null jeśli gracz ma max slotów lub nie spełnia wymagań poziomu
 */
export function getNextPurchasableHeroSlot(
  currentPurchased: number,
  commanderLevel: number
): SlotUnlockConfig | null {
  if (currentPurchased >= MAX_HERO_SLOTS) return null;
  const nextSlot = HERO_SLOT_UNLOCKS[currentPurchased];
  if (!nextSlot) return null;
  if (commanderLevel < nextSlot.levelRequired) return null;
  return nextSlot;
}

/**
 * Pobiera następny slot do kupienia dla wieżyczek
 */
export function getNextPurchasableTurretSlot(
  currentPurchased: number,
  commanderLevel: number
): SlotUnlockConfig | null {
  if (currentPurchased >= MAX_TURRET_SLOTS) return null;
  const nextSlot = TURRET_SLOT_UNLOCKS[currentPurchased];
  if (!nextSlot) return null;
  if (commanderLevel < nextSlot.levelRequired) return null;
  return nextSlot;
}

/**
 * Pobiera info o następnym slocie (do wyświetlenia w UI)
 * Zwraca slot nawet jeśli gracz nie spełnia wymagań (dla podglądu)
 */
export function getNextHeroSlotInfo(
  currentPurchased: number,
  commanderLevel: number,
  currentGold: number
): { slot: SlotUnlockConfig; canPurchase: boolean; reason?: string } | null {
  if (currentPurchased >= MAX_HERO_SLOTS) return null;
  const nextSlot = HERO_SLOT_UNLOCKS[currentPurchased];
  if (!nextSlot) return null;

  const levelOk = commanderLevel >= nextSlot.levelRequired;
  const goldOk = currentGold >= nextSlot.goldCost;
  const canPurchase = levelOk && goldOk && !nextSlot.isFree;

  let reason: string | undefined;
  if (!levelOk) reason = 'level_too_low';
  else if (!goldOk) reason = 'insufficient_gold';
  else if (nextSlot.isFree) reason = 'already_free';

  return { slot: nextSlot, canPurchase, reason };
}

/**
 * Pobiera info o następnym slocie wieżyczki
 */
export function getNextTurretSlotInfo(
  currentPurchased: number,
  commanderLevel: number,
  currentGold: number
): { slot: SlotUnlockConfig; canPurchase: boolean; reason?: string } | null {
  if (currentPurchased >= MAX_TURRET_SLOTS) return null;
  const nextSlot = TURRET_SLOT_UNLOCKS[currentPurchased];
  if (!nextSlot) return null;

  const levelOk = commanderLevel >= nextSlot.levelRequired;
  const goldOk = currentGold >= nextSlot.goldCost;
  const canPurchase = levelOk && goldOk && !nextSlot.isFree;

  let reason: string | undefined;
  if (!levelOk) reason = 'level_too_low';
  else if (!goldOk) reason = 'insufficient_gold';
  else if (nextSlot.isFree) reason = 'already_free';

  return { slot: nextSlot, canPurchase, reason };
}

// ============================================================================
// POZIOMY TWIERDZY
// ============================================================================

/**
 * Zunifikowana formuła XP dla danego poziomu
 * Używana zarówno przez klienta jak i serwer
 */
export function getXpForLevel(level: number): number {
  if (level <= 10) return level * 200;           // 200-2000 XP (rebalanced from 150)
  if (level <= 30) return level * level * 18;    // 1980-16200 XP (rebalanced from 12)
  if (level <= 50) return level * level * 40;    // 38440-100000 XP (rebalanced from 25)
  return 100000 + (level - 50) * 8000;           // Post-50: liniowy (rebalanced from 5000)
}

/**
 * Oblicza łączne XP potrzebne do osiągnięcia danego poziomu (od poziomu 1)
 */
export function getTotalXpForLevel(level: number): number {
  let total = 0;
  for (let i = 1; i < level; i++) {
    total += getXpForLevel(i);
  }
  return total;
}

/**
 * Oblicza poziom na podstawie łącznego XP
 */
export function getLevelFromTotalXp(totalXp: number): { level: number; xpInLevel: number } {
  let level = 1;
  let remaining = totalXp;
  while (remaining >= getXpForLevel(level)) {
    remaining -= getXpForLevel(level);
    level++;
  }
  return { level, xpInLevel: remaining };
}

function generateFortressLevels(): FortressLevel[] {
  const levels: FortressLevel[] = [];
  let totalXp = 0;

  for (let level = 1; level <= 50; level++) {
    const xpToNext = getXpForLevel(level);
    const rewards = getFortressLevelRewards(level);

    levels.push({
      level,
      xpRequired: totalXp,
      xpToNext,
      rewards,
    });

    totalXp += xpToNext;
  }

  return levels;
}

function getFortressLevelRewards(level: number): FortressLevelReward[] {
  const rewards: FortressLevelReward[] = [];

  // === NOWY UPROSZCZONY SYSTEM PROGRESJI ===
  // Nowi gracze zaczynają z Starter Kit (natural, vanguard, arrow)
  // Stopniowe odblokowania sprawiają, że gra jest przystępna

  switch (level) {
    // Level 1: Starter Kit (automatyczny w onboardingu)
    case 1:
      rewards.push({
        type: 'skill_unlock',
        skillId: 'skill_1',
        description: 'Odblokowano podstawową umiejętność konfiguracji',
      });
      break;

    // Level 5: Drugi slot wieży + CRYO turret
    case 5:
      rewards.push({
        type: 'turret_slot',
        value: 2,
        description: 'Odblokowano 2. slot wieży',
      });
      rewards.push({
        type: 'turret_unlock',
        turretType: 'cryo',
        description: 'Odblokowano Wieżę Kriogeniczną',
      });
      rewards.push({
        type: 'skill_unlock',
        skillId: 'skill_2',
        description: 'Odblokowano drugą umiejętność konfiguracji',
      });
      break;

    // Level 10: Drugi slot jednostki + Forge
    case 10:
      rewards.push({
        type: 'hero_slot',
        value: 2,
        description: 'Odblokowano 2. slot jednostki',
      });
      rewards.push({
        type: 'hero_unlock',
        heroId: 'forge',
        description: 'Odblokowano Unit-3 "Forge"',
      });
      rewards.push({
        type: 'skill_unlock',
        skillId: 'skill_3',
        description: 'Odblokowano trzecią umiejętność konfiguracji',
      });
      break;

    // Level 15: Trzeci slot wieży + ARTILLERY turret + Science pillar
    case 15:
      rewards.push({
        type: 'pillar_unlock',
        pillarId: 'science',
        description: 'Odblokowano Sektor: Nauka i Technologia',
      });
      rewards.push({
        type: 'turret_slot',
        value: 3,
        description: 'Odblokowano 3. slot wieży',
      });
      rewards.push({
        type: 'turret_unlock',
        turretType: 'cannon',
        description: 'Odblokowano Wieżę Artyleryjską',
      });
      rewards.push({
        type: 'damage_bonus',
        value: 16384 as FP, // +10%
        description: '+10% DMG twierdzy',
      });
      break;

    // Level 20: Druga konfiguracja (CRYO) + Ultimate skill + Frost
    case 20:
      rewards.push({
        type: 'class_unlock',
        classId: 'ice',
        description: 'Odblokowano Konfigurację Kriogeniczną',
      });
      rewards.push({
        type: 'hero_unlock',
        heroId: 'frost',
        description: 'Odblokowano Unit-5 "Frost"',
      });
      rewards.push({
        type: 'skill_unlock',
        skillId: 'skill_4',
        description: 'Odblokowano Ultimate konfiguracji',
      });
      break;

    // Level 25: slot wieży
    case 25:
      rewards.push({
        type: 'turret_slot',
        value: 4,
        description: 'Odblokowano 4. slot wieży',
      });
      break;

    // Level 30: Trzeci slot jednostki + Rift + Mutants pillar
    case 30:
      rewards.push({
        type: 'pillar_unlock',
        pillarId: 'mutants',
        description: 'Odblokowano Sektor: Mutanci',
      });
      rewards.push({
        type: 'hero_slot',
        value: 3,
        description: 'Odblokowano 3. slot jednostki',
      });
      rewards.push({
        type: 'hero_unlock',
        heroId: 'rift',
        description: 'Odblokowano Unit-9 "Rift"',
      });
      rewards.push({
        type: 'turret_unlock',
        turretType: 'arc',
        description: 'Odblokowano Wieżę Łukową',
      });
      break;

    // Level 35: Nowy slot wieżyczki
    case 35:
      rewards.push({
        type: 'turret_slot',
        value: 5,
        description: 'Odblokowano 5. slot wieżyczki',
      });
      break;

    // Level 40: Titan + Fire class + slot wieżyczki
    case 40:
      rewards.push({
        type: 'hero_unlock',
        heroId: 'titan',
        description: 'Odblokowano Unit-1 "Titan"',
      });
      rewards.push({
        type: 'class_unlock',
        classId: 'fire',
        description: 'Odblokowano Konfigurację Termiczną',
      });
      rewards.push({
        type: 'turret_slot',
        value: 6,
        description: 'Odblokowano 6. slot wieżyczki',
      });
      break;

    // Level 45: Czwarty slot jednostki + Cosmos pillar
    case 45:
      rewards.push({
        type: 'pillar_unlock',
        pillarId: 'cosmos',
        description: 'Odblokowano Sektor: Kosmos',
      });
      rewards.push({
        type: 'hero_slot',
        value: 4,
        description: 'Odblokowano 4. slot jednostki (max)',
      });
      rewards.push({
        type: 'turret_unlock',
        turretType: 'laser',
        description: 'Odblokowano Wieżę Fotonową',
      });
      break;

    // Level 50: Endgame content
    case 50:
      rewards.push({
        type: 'feature_unlock',
        featureId: 'crystal_matrix',
        description: 'Odblokowano Matrycę Kryształów',
      });
      rewards.push({
        type: 'feature_unlock',
        featureId: 'true_ending',
        description: 'Odblokowano Protokół Anihilacji',
      });
      break;

    // Level 60: Konfiguracja Elektryczna + Magic pillar
    case 60:
      rewards.push({
        type: 'pillar_unlock',
        pillarId: 'magic',
        description: 'Odblokowano Sektor: Magia i Wymiary',
      });
      rewards.push({
        type: 'class_unlock',
        classId: 'lightning',
        description: 'Odblokowano Konfigurację Elektryczną',
      });
      break;

    // Level 80: Konfiguracja Próżniowa + Gods pillar
    case 80:
      rewards.push({
        type: 'pillar_unlock',
        pillarId: 'gods',
        description: 'Odblokowano Sektor: Bogowie',
      });
      rewards.push({
        type: 'class_unlock',
        classId: 'void',
        description: 'Odblokowano Konfigurację Próżniową',
      });
      break;

    // Level 100: Konfiguracja Kwantowa
    case 100:
      rewards.push({
        type: 'class_unlock',
        classId: 'tech',
        description: 'Odblokowano Konfigurację Kwantową',
      });
      break;
  }

  // Małe bonusy HP co 5 poziomów (jeśli nie ma większych nagród)
  if (level > 0 && level % 5 === 0 && rewards.length === 0) {
    rewards.push({
      type: 'hp_bonus',
      value: 8192 as FP, // +5%
      description: '+5% HP twierdzy',
    });
  }

  return rewards;
}

export const FORTRESS_LEVELS: FortressLevel[] = generateFortressLevels();

// ============================================================================
// FUNKCJE POMOCNICZE
// ============================================================================

/**
 * Pobiera poziom twierdzy dla danego XP
 */
export function getFortressLevelForXp(xp: number): number {
  for (let i = FORTRESS_LEVELS.length - 1; i >= 0; i--) {
    if (xp >= FORTRESS_LEVELS[i].xpRequired) {
      return FORTRESS_LEVELS[i].level;
    }
  }
  return 1;
}

/**
 * Pobiera informacje o poziomie
 */
export function getFortressLevelInfo(level: number): FortressLevel | undefined {
  return FORTRESS_LEVELS.find(l => l.level === level);
}

/**
 * Oblicza XP do następnego poziomu
 */
export function getXpToNextLevel(currentXp: number): { xpNeeded: number; progress: FP } {
  const currentLevel = getFortressLevelForXp(currentXp);
  const levelInfo = getFortressLevelInfo(currentLevel);
  const nextLevelInfo = getFortressLevelInfo(currentLevel + 1);

  if (!levelInfo || !nextLevelInfo) {
    return { xpNeeded: 0, progress: 16384 as FP }; // Max level
  }

  const xpInCurrentLevel = currentXp - levelInfo.xpRequired;
  const xpNeeded = levelInfo.xpToNext - xpInCurrentLevel;
  const progress = Math.floor((xpInCurrentLevel / levelInfo.xpToNext) * 16384) as FP;

  return { xpNeeded, progress };
}

/**
 * Oblicza XP za zabicie wroga
 */
export function calculateEnemyKillXp(wave: number, isElite: boolean = false): number {
  const source = isElite ? XP_SOURCES.elite_enemy_kill : XP_SOURCES.enemy_kill;
  const waveBonus = source.scaling?.perWave ?? 0;
  return Math.floor(source.baseXp + (wave * waveBonus));
}

/**
 * Oblicza XP za ukończenie fali
 */
export function calculateWaveCompleteXp(wave: number): number {
  const source = XP_SOURCES.wave_complete;
  const waveBonus = source.scaling?.perWave ?? 0;
  return Math.floor(source.baseXp + (wave * waveBonus));
}

/**
 * Oblicza XP za zabicie bossa
 */
export function calculateBossKillXp(wave: number): number {
  const source = XP_SOURCES.boss_kill;
  const waveBonus = source.scaling?.perWave ?? 0;
  return Math.floor(source.baseXp + (wave * waveBonus));
}

/**
 * Oblicza XP za ukończenie filaru
 */
export function calculatePillarCompleteXp(isFirst: boolean): number {
  return isFirst
    ? XP_SOURCES.pillar_first_complete.baseXp
    : XP_SOURCES.pillar_complete.baseXp;
}

/**
 * Pobiera maksymalną liczbę bohaterów
 * Nowy system: używa purchasedSlots jeśli podane (zakup za złoto)
 * Legacy: oblicza na podstawie poziomu (dla kompatybilności wstecznej)
 */
export function getMaxHeroSlots(fortressLevel: number, purchasedSlots?: number): number {
  // Nowy system: użyj zakupionych slotów
  if (purchasedSlots !== undefined) {
    return Math.min(purchasedSlots, MAX_HERO_SLOTS);
  }
  // Legacy fallback (dla starych zapisów bez purchasedSlots)
  if (fortressLevel >= 45) return 4;
  if (fortressLevel >= 30) return 3;
  if (fortressLevel >= 10) return 2;
  return 2; // Zmienione z 1 na 2 - nowi gracze zaczynają z 2 slotami
}

/**
 * Pobiera maksymalną liczbę wieżyczek
 * Nowy system: używa purchasedSlots jeśli podane (zakup za złoto)
 * Legacy: oblicza na podstawie poziomu (dla kompatybilności wstecznej)
 */
export function getMaxTurretSlots(fortressLevel: number, purchasedSlots?: number): number {
  // Nowy system: użyj zakupionych slotów
  if (purchasedSlots !== undefined) {
    return Math.min(purchasedSlots, MAX_TURRET_SLOTS);
  }
  // Legacy fallback
  if (fortressLevel >= 40) return 6;
  if (fortressLevel >= 35) return 5;
  if (fortressLevel >= 25) return 4;
  if (fortressLevel >= 15) return 3;
  if (fortressLevel >= 5) return 2;
  return 1; // Base: 1 slot
}

/**
 * Pobiera odblokowane umiejętności dla poziomu
 */
export function getUnlockedSkills(fortressLevel: number): string[] {
  const skills: string[] = [];

  if (fortressLevel >= 1) skills.push('skill_1');
  if (fortressLevel >= 5) skills.push('skill_2');
  if (fortressLevel >= 10) skills.push('skill_3');
  if (fortressLevel >= 20) skills.push('skill_4');

  return skills;
}

/**
 * Pobiera odblokowane klasy dla poziomu
 * natural jest zawsze odblokowana (starter kit)
 */
export function getUnlockedClasses(fortressLevel: number): string[] {
  const classes: string[] = ['natural']; // Starter Kit

  if (fortressLevel >= 20) classes.push('ice');
  if (fortressLevel >= 40) classes.push('fire');
  if (fortressLevel >= 60) classes.push('lightning');
  if (fortressLevel >= 80) classes.push('void');
  if (fortressLevel >= 100) classes.push('tech');

  return classes;
}

/**
 * Sprawdza czy klasa jest odblokowana
 */
export function isClassUnlockedAtLevel(classId: string, fortressLevel: number): boolean {
  return getUnlockedClasses(fortressLevel).includes(classId);
}

/**
 * Pobiera poziom wymagany do odblokowania klasy
 */
export function getClassUnlockLevel(classId: string): number {
  switch (classId) {
    case 'natural': return 1;
    case 'ice': return 20;
    case 'fire': return 40;
    case 'lightning': return 60;
    case 'void': return 80;
    case 'tech': return 100;
    default: return 999;
  }
}

/**
 * Pobiera odblokowane typy wieżyczek dla poziomu
 * railgun jest zawsze odblokowana (starter kit)
 */
export function getUnlockedTurretTypes(fortressLevel: number): string[] {
  const turrets: string[] = ['railgun']; // Starter Kit

  if (fortressLevel >= 5) turrets.push('cryo');
  if (fortressLevel >= 15) turrets.push('cannon');
  if (fortressLevel >= 30) turrets.push('arc');
  if (fortressLevel >= 45) turrets.push('laser');

  return turrets;
}

/**
 * Sprawdza czy typ wieżyczki jest odblokowany
 */
export function isTurretUnlockedAtLevel(turretType: string, fortressLevel: number): boolean {
  return getUnlockedTurretTypes(fortressLevel).includes(turretType);
}

/**
 * Pobiera poziom wymagany do odblokowania wieżyczki
 */
export function getTurretUnlockLevel(turretType: string): number {
  switch (turretType) {
    case 'railgun': return 1;  // Starter turret
    case 'cryo': return 5;
    case 'cannon': return 15;
    case 'arc': return 30;
    case 'laser': return 45;
    default: return 99;
  }
}

/**
 * Pobiera odblokowane jednostki dla poziomu
 * vanguard i storm są zawsze odblokowane (starter kit)
 * spectre i omega są ekskluzywne - dostępne od poziomu 1 ale za premium koszt
 */
export function getUnlockedHeroes(fortressLevel: number): string[] {
  const heroes: string[] = ['vanguard', 'storm']; // Starter Kit

  // Exclusive heroes - available from level 1 (premium cost)
  heroes.push('spectre'); // Rare exclusive - 25,000 gold
  heroes.push('omega');   // Legendary exclusive - 5,000 dust

  if (fortressLevel >= 10) heroes.push('forge');
  if (fortressLevel >= 20) heroes.push('frost');
  if (fortressLevel >= 30) heroes.push('rift');
  if (fortressLevel >= 40) heroes.push('titan');

  return heroes;
}

/**
 * Sprawdza czy bohater jest odblokowany
 */
export function isHeroUnlockedAtLevel(heroId: string, fortressLevel: number): boolean {
  return getUnlockedHeroes(fortressLevel).includes(heroId);
}

/**
 * Pobiera poziom wymagany do odblokowania jednostki
 */
export function getHeroUnlockLevel(heroId: string): number {
  switch (heroId) {
    case 'vanguard': return 1;  // Starter
    case 'storm': return 1;     // Starter
    case 'spectre': return 1;   // Exclusive rare - available from level 1
    case 'omega': return 1;     // Exclusive legendary - available from level 1
    case 'forge': return 10;
    case 'frost': return 20;
    case 'rift': return 30;
    case 'titan': return 40;
    default: return 99;
  }
}

/**
 * Sprawdza czy filar jest odblokowany na danym poziomie twierdzy
 */
export function isPillarUnlockedAtLevel(pillarId: PillarId, fortressLevel: number): boolean {
  const requiredLevel = PILLAR_LEVEL_REQUIREMENTS[pillarId];
  if (requiredLevel === undefined) return false;
  return fortressLevel >= requiredLevel;
}

/**
 * Pobiera listę odblokowanych filarów na danym poziomie twierdzy
 */
export function getUnlockedPillarsAtLevel(fortressLevel: number): PillarId[] {
  return (Object.entries(PILLAR_LEVEL_REQUIREMENTS) as [PillarId, number][])
    .filter(([_, level]) => fortressLevel >= level)
    .map(([pillarId]) => pillarId);
}

/**
 * Pobiera wymagany poziom do odblokowania filara
 */
export function getPillarUnlockLevel(pillarId: PillarId): number {
  return PILLAR_LEVEL_REQUIREMENTS[pillarId] ?? 999;
}

// ============================================================================
// ZUNIFIKOWANE BONUSY PROGRESJI
// ============================================================================

export interface ProgressionBonuses {
  damageMultiplier: number;
  goldMultiplier: number;
  startingGold: number;
  maxHeroSlots: number;
  maxTurretSlots: number;
  unlockedSkills: string[];
  unlockedPillars: PillarId[];
}

/**
 * Pobiera wszystkie bonusy progresji dla danego poziomu
 * Integruje bonusy z dawnego systemu mastery + odblokowania fortress
 */
export function getProgressionBonuses(level: number): ProgressionBonuses {
  // Bazowe bonusy z poziomów 1-50
  let damageBonus = 0;
  let goldBonus = 0;
  let startingGold = 0;

  // Bonusy z nagród poziomów (HP/DMG już są w calculateTotalHpBonus/calculateTotalDamageBonus)
  // Tu liczymy dodatkowe bonusy pasywne (dawne mastery)

  // Level 5: +5 starting gold
  if (level >= 5) startingGold += 5;

  // Level 15: +10% damage (już jest w rewards, ale dodajemy tu dla czytelności API)
  // Level 30: +5% gold
  if (level >= 30) goldBonus += 0.05;

  // Post-50: bonuses for continued play (rebalanced for slower progression)
  if (level > 50) {
    const postCapLevels = level - 50;
    damageBonus += postCapLevels * 0.01;      // +1% damage per level (rebalanced from +2%)
    goldBonus += postCapLevels * 0.005;       // +0.5% gold per level (rebalanced from +1%)
    startingGold += postCapLevels * 3;        // +3 starting gold per level (rebalanced from +5)
  }

  // Level-gated pillar unlocking
  const unlockedPillars = getUnlockedPillarsAtLevel(level);

  return {
    damageMultiplier: 1 + damageBonus,
    goldMultiplier: 1 + goldBonus,
    startingGold,
    maxHeroSlots: getMaxHeroSlots(level),
    maxTurretSlots: getMaxTurretSlots(level),
    unlockedSkills: getUnlockedSkills(level),
    unlockedPillars,
  };
}

/**
 * Oblicza łączne bonusy HP z poziomów
 */
export function calculateTotalHpBonus(fortressLevel: number): FP {
  let totalBonus = 16384 as FP; // Base 1.0

  for (const levelInfo of FORTRESS_LEVELS) {
    if (levelInfo.level > fortressLevel) break;

    for (const reward of levelInfo.rewards) {
      if (reward.type === 'hp_bonus' && typeof reward.value === 'number') {
        totalBonus = (totalBonus + (reward.value as FP) - 16384) as FP;
      }
    }
  }

  return totalBonus;
}

/**
 * Oblicza łączne bonusy DMG z poziomów
 */
export function calculateTotalDamageBonus(fortressLevel: number): FP {
  let totalBonus = 16384 as FP; // Base 1.0

  for (const levelInfo of FORTRESS_LEVELS) {
    if (levelInfo.level > fortressLevel) break;

    for (const reward of levelInfo.rewards) {
      if (reward.type === 'damage_bonus' && typeof reward.value === 'number') {
        totalBonus = (totalBonus + (reward.value as FP) - 16384) as FP;
      }
    }
  }

  return totalBonus;
}

/**
 * Pobiera nagrody za osiągnięcie poziomu
 */
export function getRewardsForLevel(level: number): FortressLevelReward[] {
  // For levels in FORTRESS_LEVELS array (1-50), use cached data
  const levelInfo = getFortressLevelInfo(level);
  if (levelInfo) {
    return levelInfo.rewards;
  }
  // For levels beyond 50, compute rewards directly
  return getFortressLevelRewards(level);
}

/**
 * Sprawdza czy gracz właśnie awansował
 */
export function checkLevelUp(previousXp: number, currentXp: number): {
  leveledUp: boolean;
  newLevel: number;
  rewards: FortressLevelReward[];
} {
  const previousLevel = getFortressLevelForXp(previousXp);
  const currentLevel = getFortressLevelForXp(currentXp);

  if (currentLevel > previousLevel) {
    const allRewards: FortressLevelReward[] = [];

    // Zbierz nagrody za wszystkie poziomy między
    for (let level = previousLevel + 1; level <= currentLevel; level++) {
      allRewards.push(...getRewardsForLevel(level));
    }

    return {
      leveledUp: true,
      newLevel: currentLevel,
      rewards: allRewards,
    };
  }

  return {
    leveledUp: false,
    newLevel: currentLevel,
    rewards: [],
  };
}

// ============================================================================
// PRESTIGE SYSTEM (opcjonalny)
// ============================================================================

export interface PrestigeBonus {
  id: string;
  name: string;
  description: string;
  effect: {
    type: 'permanent_stat' | 'starting_resource' | 'unlock';
    stat?: string;
    value?: FP | number;
  };
}

export const PRESTIGE_BONUSES: PrestigeBonus[] = [
  {
    id: 'prestige_hp_1',
    name: 'Wzmocnione Mury I',
    description: '+5% HP twierdzy na start',
    effect: { type: 'permanent_stat', stat: 'maxHp', value: 17203 as FP },
  },
  {
    id: 'prestige_damage_1',
    name: 'Lepsze Uzbrojenie I',
    description: '+5% DMG twierdzy na start',
    effect: { type: 'permanent_stat', stat: 'damage', value: 17203 as FP },
  },
  {
    id: 'prestige_gold_1',
    name: 'Skarbiec I',
    description: '+100 złota na start',
    effect: { type: 'starting_resource', stat: 'gold', value: 100 },
  },
  {
    id: 'prestige_dust_1',
    name: 'Kopalnia Pyłu I',
    description: '+10% więcej dust z fal',
    effect: { type: 'permanent_stat', stat: 'dustMultiplier', value: 18022 as FP },
  },
];

/**
 * Max poziom twierdzy
 */
export const MAX_FORTRESS_LEVEL = 50;

/**
 * Łączne XP potrzebne do max poziomu
 */
export const MAX_FORTRESS_XP = FORTRESS_LEVELS[FORTRESS_LEVELS.length - 1].xpRequired +
                               FORTRESS_LEVELS[FORTRESS_LEVELS.length - 1].xpToNext;

// ============================================================================
// FORTRESS VISUAL TIERS
// ============================================================================

/**
 * Visual tier of the fortress based on level
 * Tier 1 (1-9): Basic Outpost - simple structure
 * Tier 2 (10-24): Stone Keep - fortified with battlements
 * Tier 3 (25-50): Class Citadel - elemental theming and effects
 */
export type FortressTier = 1 | 2 | 3;

/**
 * Tier thresholds
 */
export const FORTRESS_TIER_THRESHOLDS = {
  TIER_2_LEVEL: 10,
  TIER_3_LEVEL: 25,
} as const;

/**
 * Get fortress visual tier based on level
 */
export function getFortressTier(level: number): FortressTier {
  if (level >= FORTRESS_TIER_THRESHOLDS.TIER_3_LEVEL) return 3;
  if (level >= FORTRESS_TIER_THRESHOLDS.TIER_2_LEVEL) return 2;
  return 1;
}

/**
 * Get tier name for display
 */
export function getFortressTierName(tier: FortressTier): string {
  switch (tier) {
    case 1: return 'Podstawowa Twierdza';
    case 2: return 'Warownia';
    case 3: return 'Cytadela';
  }
}

/**
 * Get description of next tier upgrade
 */
export function getNextTierDescription(currentLevel: number): string | null {
  const currentTier = getFortressTier(currentLevel);
  
  switch (currentTier) {
    case 1:
      return `Poziom ${FORTRESS_TIER_THRESHOLDS.TIER_2_LEVEL}: Ulepsz do Warowni - solidniejsza struktura z blankami`;
    case 2:
      return `Poziom ${FORTRESS_TIER_THRESHOLDS.TIER_3_LEVEL}: Ulepsz do Cytadeli - elementarna przemiana`;
    case 3:
      return null; // Max tier
  }
}
