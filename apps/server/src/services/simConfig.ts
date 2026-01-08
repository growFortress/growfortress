import type { FortressClass, SimConfig } from '@arcade/sim-core';
import {
  getMaxHeroSlots,
  getMaxTurretSlots,
  isClassUnlockedAtLevel,
} from '@arcade/sim-core';
import type { SimConfigSnapshot } from '../lib/tokens.js';

export interface LoadoutDefaults {
  fortressClass: string | null;
  heroId: string | null;
  turretType: string | null;
}

export interface RequestedLoadout {
  fortressClass?: string;
  startingHeroes?: string[];
  startingTurrets?: string[];
}

export interface BuildSimConfigParams {
  commanderLevel: number;
  progressionBonuses: {
    damageMultiplier: number;
    goldMultiplier: number;
    startingGold: number;
    maxHeroSlots: number;
    maxTurretSlots: number;
  };
  unlockedHeroes: string[];
  unlockedTurrets: string[];
  requested?: RequestedLoadout;
  defaults?: LoadoutDefaults;
  remoteConfig?: {
    fortressBaseHp: number;
    fortressBaseDamage: number;
    waveIntervalTicks: number;
  };
}

export function buildSimConfigSnapshot(
  params: BuildSimConfigParams
): {
  simConfig: SimConfigSnapshot;
  resolvedLoadout: {
    fortressClass: FortressClass;
    startingHeroes: string[];
    startingTurrets: string[];
  };
} {
  const maxHeroSlots = Math.max(
    1,
    params.progressionBonuses.maxHeroSlots || getMaxHeroSlots(params.commanderLevel)
  );
  const maxTurretSlots = Math.max(
    1,
    params.progressionBonuses.maxTurretSlots || getMaxTurretSlots(params.commanderLevel)
  );

  const requestedClass =
    params.requested?.fortressClass ??
    params.defaults?.fortressClass ??
    'natural';
  const fortressClass = isClassUnlockedAtLevel(
    requestedClass,
    params.commanderLevel
  )
    ? (requestedClass as FortressClass)
    : 'natural';

  const requestedHeroes =
    params.requested?.startingHeroes ??
    (params.defaults?.heroId ? [params.defaults.heroId] : []);
  const startingHeroes = requestedHeroes
    .filter((id) => params.unlockedHeroes.includes(id))
    .slice(0, maxHeroSlots);

  const requestedTurrets =
    params.requested?.startingTurrets ??
    (params.defaults?.turretType ? [params.defaults.turretType] : []);
  const startingTurretIds = requestedTurrets
    .filter((id) => params.unlockedTurrets.includes(id))
    .slice(0, maxTurretSlots);

  const startingTurrets = startingTurretIds.map((definitionId, index) => ({
    definitionId,
    slotIndex: index + 1,
    class: fortressClass,
  }));

  const simConfig: SimConfigSnapshot = {
    commanderLevel: params.commanderLevel,
    progressionDamageBonus: params.progressionBonuses.damageMultiplier,
    progressionGoldBonus: params.progressionBonuses.goldMultiplier,
    startingGold: params.progressionBonuses.startingGold,
    maxHeroSlots,
    fortressClass,
    startingHeroes,
    startingTurrets,
    fortressBaseHp: params.remoteConfig?.fortressBaseHp ?? 100,
    fortressBaseDamage: params.remoteConfig?.fortressBaseDamage ?? 10,
    waveIntervalTicks: params.remoteConfig?.waveIntervalTicks ?? 90,
  };

  return {
    simConfig,
    resolvedLoadout: {
      fortressClass,
      startingHeroes,
      startingTurrets: startingTurretIds,
    },
  };
}

export function applySimConfigSnapshot(
  config: SimConfig,
  snapshot: SimConfigSnapshot
): SimConfig {
  config.commanderLevel = snapshot.commanderLevel;
  config.progressionDamageBonus = snapshot.progressionDamageBonus;
  config.progressionGoldBonus = snapshot.progressionGoldBonus;
  config.startingGold = snapshot.startingGold;
  config.maxHeroSlots = snapshot.maxHeroSlots;
  config.fortressClass = snapshot.fortressClass;
  config.startingHeroes = [...snapshot.startingHeroes];
  config.startingTurrets = snapshot.startingTurrets.map((turret) => ({
    ...turret,
  }));
  config.fortressBaseHp = snapshot.fortressBaseHp;
  config.fortressBaseDamage = snapshot.fortressBaseDamage;
  config.waveIntervalTicks = snapshot.waveIntervalTicks;
  return config;
}
