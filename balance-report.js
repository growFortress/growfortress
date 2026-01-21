const fs = require('fs');
const path = require('path');

const TICK_HZ = 30;
const HERO_BASE_ATTACK_INTERVAL = 24;
const TURRET_ATTACK_INTERVAL_BASE = 30;
const MIN_TURRET_ATTACK_INTERVAL = 5;

// --- Enemy archetypes (subset for analysis) ---
const ENEMY_ARCHETYPES = {
  runner: { baseHp: 23, baseSpeed: 2.2, baseDamage: 6 },
  bruiser: { baseHp: 115, baseSpeed: 0.8, baseDamage: 17 },
  mafia_boss: { baseHp: 345, baseSpeed: 0.65, baseDamage: 29 },
};

function getEnemyStats(type, wave, isElite = false) {
  const archetype = ENEMY_ARCHETYPES[type];
  const cycle = Math.floor((wave - 1) / 100);
  const effectiveWave = ((wave - 1) % 100) + 1;
  const waveScale = 1 + (effectiveWave - 1) * 0.12;
  const cycleScale = Math.pow(1.6, cycle);
  const totalScale = waveScale * cycleScale;
  const eliteHpMult = isElite ? 3.0 : 1;
  const eliteDmgMult = isElite ? 2.5 : 1;

  return {
    hp: Math.floor(archetype.baseHp * totalScale * eliteHpMult),
    damage: Math.floor(archetype.baseDamage * totalScale * eliteDmgMult),
  };
}

// --- Hero data (subset) ---
const HEROES = {
  inferno: { damage: 42, attackSpeed: 1.3 },
  rift: { damage: 35, attackSpeed: 0.8 },
};

function heroAttackInterval(attackSpeed) {
  return Math.max(1, Math.floor(HERO_BASE_ATTACK_INTERVAL / attackSpeed));
}

function heroDps(damage, attackSpeed) {
  const interval = heroAttackInterval(attackSpeed);
  const attacksPerSecond = TICK_HZ / interval;
  return damage * attacksPerSecond;
}

// --- Turret data (subset, FP=16384) ---
const FP = 16384;
const TURRETS = {
  railgun: { damage: 8 * FP, attackSpeed: 2.5 * FP },
  artillery: { damage: 45 * FP, attackSpeed: 0.5 * FP },
  arc: { damage: 15 * FP, attackSpeed: 1.2 * FP },
};

const FIRE_CLASS = {
  damageMultiplier: Math.round(1.2 * FP),
  attackSpeedMultiplier: Math.round(1.0 * FP),
};

function calculateTurretStats(base, tier = 1) {
  const tierMultiplier = FP + (tier - 1) * 4096;
  const damage = Math.floor((base.damage * FIRE_CLASS.damageMultiplier * tierMultiplier) / (FP * FP));
  const attackSpeed = Math.floor((base.attackSpeed * FIRE_CLASS.attackSpeedMultiplier * tierMultiplier) / (FP * FP));
  return {
    damage,
    attackSpeed,
  };
}

function turretAttackInterval(attackSpeed) {
  return Math.max(MIN_TURRET_ATTACK_INTERVAL, Math.floor(TURRET_ATTACK_INTERVAL_BASE / attackSpeed));
}

function turretDps(stats) {
  const damage = stats.damage / FP;
  const attackSpeed = stats.attackSpeed / FP;
  const interval = turretAttackInterval(attackSpeed);
  const attacksPerSecond = TICK_HZ / interval;
  return damage * attacksPerSecond;
}

// --- Fortress (fire class with synergy) ---
function calculateSynergyBonuses(heroMatches, turretMatches) {
  const bonuses = {
    damageBonus: 0,
    attackSpeedBonus: 0,
    critChance: 0,
  };

  if (heroMatches > 0) {
    bonuses.damageBonus += 0.30 * heroMatches;
    bonuses.attackSpeedBonus += 0.15 * heroMatches;
  }
  if (turretMatches > 0) {
    bonuses.damageBonus += 0.15 * turretMatches;
    bonuses.attackSpeedBonus += 0.25 * turretMatches;
  }
  if (heroMatches >= 2 && turretMatches >= 3) {
    bonuses.damageBonus += 0.50;
    bonuses.critChance += 0.15;
  }

  return bonuses;
}

function fortressDps({ damageBonus, attackSpeedBonus, critChance }) {
  const baseAttackInterval = 15;
  const baseDamage = 10;
  const critDamageBonus = 0.5; // default

  const attackInterval = Math.max(1, Math.floor(baseAttackInterval / (1 + attackSpeedBonus)));
  const attacksPerSecond = TICK_HZ / attackInterval;
  const damagePerShot = Math.floor(baseDamage * (1 + damageBonus));
  const expectedCritMult = 1 + critChance * critDamageBonus;
  return damagePerShot * attacksPerSecond * expectedCritMult;
}

// --- Build definition: Fire + 3 turrets + 2 heroes (Inferno + Rift) ---
const build = {
  heroes: ['inferno', 'rift'],
  turrets: ['railgun', 'artillery', 'arc'],
  heroTier: 1,
  heroLevel: 1,
  turretTier: 1,
};

function computeBuildDps() {
  const heroDpsList = build.heroes.map((id) => heroDps(HEROES[id].damage, HEROES[id].attackSpeed));
  const turretDpsList = build.turrets.map((id) => turretDps(calculateTurretStats(TURRETS[id], build.turretTier)));

  const synergy = calculateSynergyBonuses(build.heroes.length, build.turrets.length);
  const fortress = fortressDps(synergy);

  return {
    heroDpsList,
    turretDpsList,
    fortressDps: fortress,
    totalDps: heroDpsList.reduce((a, b) => a + b, 0)
      + turretDpsList.reduce((a, b) => a + b, 0)
      + fortress,
  };
}

function format(num) {
  return Number(num.toFixed(2));
}

function buildTtkTable(waves, enemyTypes) {
  const dps = computeBuildDps();
  const rows = [];
  for (const wave of waves) {
    for (const type of enemyTypes) {
      const stats = getEnemyStats(type, wave, false);
      const ttk = stats.hp / dps.totalDps;
      rows.push({
        wave,
        enemy: type,
        hp: stats.hp,
        dmg: stats.damage,
        ttk: ttk,
      });
    }
  }
  return { dps, rows };
}

function writeProgressionCsv(waves, enemyTypes, outputPath) {
  const header = ['wave', 'enemy', 'hp', 'damage'].join(',');
  const lines = [header];
  for (const wave of waves) {
    for (const type of enemyTypes) {
      const stats = getEnemyStats(type, wave, false);
      lines.push([wave, type, stats.hp, stats.damage].join(','));
    }
  }
  fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');
}

function writeMarkdownReport(outputPath, dps, ttkRows) {
  const lines = [];
  lines.push('# Balance Report');
  lines.push('');
  lines.push('## Build assumptions');
  lines.push('- Fortress class: fire');
  lines.push('- Heroes: inferno + rift (tier 1, level 1)');
  lines.push('- Turrets: railgun + artillery + arc (tier 1, fire class)');
  lines.push('- No relics, artifacts, guild boosts, power upgrades');
  lines.push('- No active skills, no AoE/chain splash in DPS/TTK');
  lines.push('');
  lines.push('## DPS breakdown (single-target, sustained)');
  lines.push(`- Heroes DPS: ${format(dps.heroDpsList[0])} + ${format(dps.heroDpsList[1])}`);
  lines.push(`- Turrets DPS: ${dps.turretDpsList.map(v => format(v)).join(' + ')}`);
  lines.push(`- Fortress DPS (with synergy): ${format(dps.fortressDps)}`);
  lines.push(`- Total DPS: ${format(dps.totalDps)}`);
  lines.push('');
  lines.push('## TTK by wave (seconds)');
  lines.push('| Wave | Enemy | HP | DMG | TTK |');
  lines.push('|---:|---|---:|---:|---:|');
  for (const row of ttkRows) {
    lines.push(`| ${row.wave} | ${row.enemy} | ${row.hp} | ${row.dmg} | ${format(row.ttk)} |`);
  }
  lines.push('');

  fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');
}

function main() {
  const waves = [1, 5, 10, 15, 20, 25, 30, 40, 50];
  const enemyTypes = ['runner', 'bruiser', 'mafia_boss'];
  const { dps, rows } = buildTtkTable([1, 10, 20, 30], enemyTypes);

  const csvPath = path.resolve(__dirname, 'docs', 'enemy-progression.csv');
  const mdPath = path.resolve(__dirname, 'docs', 'balance-report.md');

  writeProgressionCsv(waves, enemyTypes, csvPath);
  writeMarkdownReport(mdPath, dps, rows);

  // Console summary for quick view
  console.log('DPS summary:', {
    heroes: dps.heroDpsList.map(format),
    turrets: dps.turretDpsList.map(format),
    fortress: format(dps.fortressDps),
    total: format(dps.totalDps),
  });
  console.log('Wrote:', { csvPath, mdPath });
}

main();
