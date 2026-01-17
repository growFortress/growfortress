/**
 * Wave Modifiers System
 *
 * Adds variety to waves through random modifiers that change enemy behavior
 * and increase rewards for added challenge.
 */

export type WaveModifierType =
  | 'speedy'       // +25% enemy speed
  | 'armored'      // +30% enemy HP
  | 'berserker'    // +20% enemy damage
  | 'swarm'        // 2x enemy count, 0.5x HP each
  | 'elite_rush'   // 3x elite chance
  | 'boss_guard'   // Boss + elite guards only
  | 'regenerating' // Enemies heal 2% HP/sec
  | 'shielded';    // First 50% damage absorbed

export interface WaveModifierEffect {
  speedMultiplier?: number;
  hpMultiplier?: number;
  damageMultiplier?: number;
  enemyCountMultiplier?: number;
  eliteChanceMultiplier?: number;
  regenerationPercent?: number;
  shieldPercent?: number;
}

export interface WaveModifier {
  type: WaveModifierType;
  name: string;
  description: string;
  icon: string;
  effect: WaveModifierEffect;
  rewardMultiplier: number;  // 1.2 = +20% rewards
}

export const WAVE_MODIFIERS: Record<WaveModifierType, WaveModifier> = {
  speedy: {
    type: 'speedy',
    name: 'Szybka Fala',
    description: 'Wrogowie poruszają się 25% szybciej',
    icon: '⚡',
    effect: { speedMultiplier: 1.25 },
    rewardMultiplier: 1.15,
  },
  armored: {
    type: 'armored',
    name: 'Opancerzeni',
    description: 'Wrogowie mają 30% więcej HP',
    icon: '🛡️',
    effect: { hpMultiplier: 1.30 },
    rewardMultiplier: 1.20,
  },
  berserker: {
    type: 'berserker',
    name: 'Berserkerzy',
    description: 'Wrogowie zadają 20% więcej obrażeń',
    icon: '💢',
    effect: { damageMultiplier: 1.20 },
    rewardMultiplier: 1.15,
  },
  swarm: {
    type: 'swarm',
    name: 'Rój',
    description: '2× więcej wrogów, ale słabszych',
    icon: '🐜',
    effect: {
      enemyCountMultiplier: 2.0,
      hpMultiplier: 0.5,
    },
    rewardMultiplier: 1.25,
  },
  elite_rush: {
    type: 'elite_rush',
    name: 'Elitarny Szturm',
    description: '3× większa szansa na elitę',
    icon: '⭐',
    effect: { eliteChanceMultiplier: 3.0 },
    rewardMultiplier: 1.30,
  },
  boss_guard: {
    type: 'boss_guard',
    name: 'Gwardia Bossa',
    description: 'Boss z elitarnymi strażnikami',
    icon: '👑',
    effect: {
      enemyCountMultiplier: 0.5,
      eliteChanceMultiplier: 5.0,
    },
    rewardMultiplier: 1.50,
  },
  regenerating: {
    type: 'regenerating',
    name: 'Regeneracja',
    description: 'Wrogowie leczą się 2% HP/sek',
    icon: '💚',
    effect: { regenerationPercent: 0.02 },
    rewardMultiplier: 1.20,
  },
  shielded: {
    type: 'shielded',
    name: 'Tarczowani',
    description: 'Pierwsze 50% obrażeń jest absorbowane',
    icon: '🔵',
    effect: { shieldPercent: 0.50 },
    rewardMultiplier: 1.35,
  },
};

/**
 * Get wave modifiers based on wave number
 * Higher waves have more and tougher modifiers
 */
export function getWaveModifiers(wave: number, rngValue: number): WaveModifierType[] {
  const modifiers: WaveModifierType[] = [];
  const allModifiers = Object.keys(WAVE_MODIFIERS) as WaveModifierType[];

  // No modifiers for early waves
  if (wave < 20) return [];

  // Single modifier starting wave 20, every 5th wave
  if (wave >= 20 && wave % 5 === 0) {
    const index = Math.floor(rngValue * allModifiers.length);
    modifiers.push(allModifiers[index]);
  }

  // Double modifiers starting wave 50, every 10th wave
  if (wave >= 50 && wave % 10 === 0) {
    const index = Math.floor(rngValue * 7 * allModifiers.length) % allModifiers.length;
    if (!modifiers.includes(allModifiers[index])) {
      modifiers.push(allModifiers[index]);
    }
  }

  // Triple modifiers in cycle 2+ (wave 101+), every 25th wave
  const cycle = Math.floor((wave - 1) / 100);
  if (cycle >= 1 && wave % 25 === 0) {
    const index = Math.floor(rngValue * 13 * allModifiers.length) % allModifiers.length;
    if (!modifiers.includes(allModifiers[index])) {
      modifiers.push(allModifiers[index]);
    }
  }

  return modifiers;
}

/**
 * Calculate combined effect from multiple modifiers
 */
export function getCombinedModifierEffect(modifiers: WaveModifierType[]): WaveModifierEffect {
  const combined: WaveModifierEffect = {
    speedMultiplier: 1.0,
    hpMultiplier: 1.0,
    damageMultiplier: 1.0,
    enemyCountMultiplier: 1.0,
    eliteChanceMultiplier: 1.0,
    regenerationPercent: 0,
    shieldPercent: 0,
  };

  for (const modType of modifiers) {
    const mod = WAVE_MODIFIERS[modType];
    if (mod.effect.speedMultiplier) {
      combined.speedMultiplier! *= mod.effect.speedMultiplier;
    }
    if (mod.effect.hpMultiplier) {
      combined.hpMultiplier! *= mod.effect.hpMultiplier;
    }
    if (mod.effect.damageMultiplier) {
      combined.damageMultiplier! *= mod.effect.damageMultiplier;
    }
    if (mod.effect.enemyCountMultiplier) {
      combined.enemyCountMultiplier! *= mod.effect.enemyCountMultiplier;
    }
    if (mod.effect.eliteChanceMultiplier) {
      combined.eliteChanceMultiplier! *= mod.effect.eliteChanceMultiplier;
    }
    if (mod.effect.regenerationPercent) {
      combined.regenerationPercent! += mod.effect.regenerationPercent;
    }
    if (mod.effect.shieldPercent) {
      combined.shieldPercent = Math.max(combined.shieldPercent!, mod.effect.shieldPercent);
    }
  }

  return combined;
}

/**
 * Calculate combined reward multiplier from modifiers
 */
export function getCombinedRewardMultiplier(modifiers: WaveModifierType[]): number {
  let multiplier = 1.0;
  for (const modType of modifiers) {
    multiplier *= WAVE_MODIFIERS[modType].rewardMultiplier;
  }
  return multiplier;
}

/**
 * Get modifier by type
 */
export function getWaveModifierByType(type: WaveModifierType): WaveModifier {
  return WAVE_MODIFIERS[type];
}
