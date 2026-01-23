# Enemies System

The game features 27 enemy archetypes across 6 pillars, with boss mechanics, elite variants, and special ability enemies.

## Overview

### Base Enemies (3)
| Type | HP | Speed | Damage | Gold | Description |
|------|-----|-------|--------|------|-------------|
| Runner | 29 | 2.33 | 8 | 1 | Fast but fragile |
| Bruiser | 144 | 0.84 | 21 | 5 | Slow and tanky |
| Leech | 58 | 1.69 | 5 | 4 | Heals on hit |

### Special Ability Enemies (5)
| Type | HP | Speed | Damage | Gold | Ability |
|------|-----|-------|--------|------|---------|
| Catapult | 100 | 0.68 | 50 | 11 | Ranged siege - attacks fortress/turrets from distance |
| Sapper | 56 | 2.33 | 10 | 7 | Targets walls - plants bombs that deal massive damage |
| Healer | 44 | 1.27 | 6 | 8 | Heals nearby enemies over time |
| Shielder | 75 | 1.06 | 13 | 10 | Creates damage-absorbing shield for nearby enemies |
| Teleporter | 38 | 1.69 | 15 | 6 | Randomly teleports between lanes |

---

## Pillar-Specific Enemies

### Streets Pillar (Waves 1-10)

| Type | HP | Speed | Damage | Gold | Description |
|------|-----|-------|--------|------|-------------|
| Gangster | 36 | 1.90 | 11 | 3 | Armed street criminal |
| Thug | 86 | 1.27 | 18 | 4 | Tough street enforcer |
| **Mafia Boss** | 431 | 0.68 | 36 | 18 | Crime lord with bodyguards |

**Wave Composition:**
- Common: gangster, thug, runner
- Elite: thug, gangster
- Boss: mafia_boss

---

### Science Pillar (Waves 11-25)

| Type | HP | Speed | Damage | Gold | Description |
|------|-----|-------|--------|------|-------------|
| Robot | 65 | 1.48 | 15 | 4 | Mechanical soldier |
| Drone | 21 | 2.53 | 8 | 2 | Fast flying unit |
| **AI Core** | 719 | 0.42 | 44 | 28 | Central AI consciousness |

**Wave Composition:**
- Common: drone, robot, runner
- Elite: robot, drone
- Boss: ai_core

---

### Mutants Pillar (Waves 26-40)

| Type | HP | Speed | Damage | Gold | Description |
|------|-----|-------|--------|------|-------------|
| Sentinel | 288 | 1.06 | 29 | 9 | Mutant-hunting robot |
| Mutant Hunter | 115 | 1.69 | 21 | 5 | Human mutant hunter |

**Wave Composition:**
- Common: mutant_hunter, runner, bruiser
- Elite: sentinel, mutant_hunter
- Boss: sentinel

---

### Cosmos Pillar (Waves 41-60)

| Type | HP | Speed | Damage | Gold | Description |
|------|-----|-------|--------|------|-------------|
| Kree Soldier | 100 | 1.48 | 18 | 5 | Kree Empire warrior |
| Skrull | 73 | 1.69 | 15 | 4 | Shape-shifting alien |
| **Cosmic Beast** | 575 | 0.84 | 50 | 21 | Massive space creature |

**Wave Composition:**
- Common: kree_soldier, skrull, runner
- Elite: kree_soldier, skrull
- Boss: cosmic_beast

---

### Magic Pillar (Waves 61-80)

| Type | HP | Speed | Damage | Gold | Description |
|------|-----|-------|--------|------|-------------|
| Demon | 130 | 1.27 | 26 | 6 | Hellish entity |
| Sorcerer | 58 | 1.06 | 36 | 7 | Dark magic user |
| **Dimensional Being** | 863 | 0.53 | 58 | 35 | Entity from another dimension |

**Wave Composition:**
- Common: demon, sorcerer, leech
- Elite: demon, sorcerer
- Boss: dimensional_being

---

### Gods Pillar (Waves 81-100)

| Type | HP | Speed | Damage | Gold | Description |
|------|-----|-------|--------|------|-------------|
| Einherjar | 173 | 1.27 | 31 | 9 | Fallen warrior of Valhalla |
| **Titan** | 1150 | 0.37 | 73 | 42 | Primordial giant |
| **God** | 1438 | 0.84 | 86 | 70 | Divine being of immense power |

**Wave Composition:**
- Common: einherjar, bruiser, runner
- Elite: einherjar, titan
- Boss: god, titan

---

## Boss Mechanics

Bosses have unique phase-based abilities that trigger at HP thresholds.

### Mafia Boss
| Phase | HP Threshold | Ability | Description |
|-------|--------------|---------|-------------|
| 1 | 75% | Summon Minions | Wzywa ochronę! (5 gangsters) |
| 2 | 50% | Damage Shield | Zakłada kamizelkę kuloodporną! (50% reduction, 60 ticks) |
| 3 | 25% | Enrage | Wścieka się! (+50% DMG, +30% speed) |

### AI Core
| Phase | HP Threshold | Ability | Description |
|-------|--------------|---------|-------------|
| 1 | 80% | Summon Minions | Aktywuje drony bojowe! (8 drones) |
| 2 | 50% | Stun Aura | EMP Burst! (radius 5, 30 ticks) |
| 3 | 20% | Heal Burst | Samonaprawa! (15% HP heal) |

### Cosmic Beast
| Phase | HP Threshold | Ability | Description |
|-------|--------------|---------|-------------|
| 1 | 70% | Enrage | Kosmiczna Furia! (+30% DMG, +20% speed) |
| 2 | 40% | Damage Shield | Aktywuje kosmiczną tarczę! (60% reduction, 90 ticks) |

### Dimensional Being
| Phase | HP Threshold | Ability | Description |
|-------|--------------|---------|-------------|
| 1 | 75% | Summon Minions | Otwiera portale! (4 demons) |
| 2 | 50% | Heal Burst | Absorbuje energię wymiarową! (20% HP heal) |
| 3 | 25% | Enrage | Wchodzi w szał wymiarowy! (+100% DMG, +40% speed) |

### God
| Phase | HP Threshold | Ability | Description |
|-------|--------------|---------|-------------|
| 1 | 90% | Damage Shield | Boska Bariera! (75% reduction, 120 ticks) |
| 2 | 60% | Summon Minions | Wzywa Einherjarów! (3 einherjar) |
| 3 | 30% | Enrage | Gniew Bogów! (+100% DMG, +50% speed) |

### Titan
| Phase | HP Threshold | Ability | Description |
|-------|--------------|---------|-------------|
| 1 | 80% | Stun Aura | Ziemia drży! (radius 6, 45 ticks) |
| 2 | 50% | Enrage | Tytaniczna moc! (+80% DMG) |
| 3 | 20% | Heal Burst | Regeneracja prymalnej siły! (25% HP heal) |

### Sentinel
| Phase | HP Threshold | Ability | Description |
|-------|--------------|---------|-------------|
| 1 | 60% | Damage Shield | Aktywuje pole siłowe! (50% reduction, 60 ticks) |
| 2 | 30% | Summon Minions | Wzywa wsparcie! (4 drones) |

---

## Boss Ability Types

| Ability | Effect |
|---------|--------|
| **Summon Minions** | Spawns additional enemies |
| **Damage Shield** | Reduces incoming damage for duration |
| **Enrage** | Increases damage and speed |
| **Heal Burst** | Heals percentage of max HP |
| **Stun Aura** | Stuns all units in radius |

---

## Wave Scaling

### Stats Scaling
```
finalHP = baseHP × waveScale × cycleScale × eliteMultiplier
finalDamage = baseDamage × waveScale × cycleScale × eliteMultiplier

waveScale = 1 + (effectiveWave - 1) × 0.12  // +12% per wave
cycleScale = 1.6^cycle                       // x1.6 per 100-wave cycle

eliteHpMultiplier = 3.0
eliteDamageMultiplier = 2.5
```

### Reward Scaling
```
effectiveWave = ((wave - 1) % 100) + 1
cycle = floor((wave - 1) / 100)

goldReward = baseGold × eliteMult × goldMult × waveMult × cycleMult

eliteMult = 2.5 (for elite enemies)
waveMult = 1 + (effectiveWave - 1) × 0.05  // +5% per wave
cycleMult = 1.4^cycle                        // Exponential: 1x, 1.4x, 1.96x, 2.74x...

Note: Dust is no longer earned from enemy kills (only via daily quests)
```

---

## Wave Composition

### Enemy Count
```
wave 1-30:  baseEnemies = 8 + floor(wave × 2.5)
wave 31+:   baseEnemies = 8 + floor(30 × 2.5 + (wave - 30) × 1.8)
```

### Elite Chance
```
wave < 60:  eliteChance = min(0.05 + wave × 0.004, 0.35)
wave 60+:   eliteChance = min(0.05 + wave × 0.004, 0.50)
```

### Spawn Interval
```
baseInterval = max(tickHz × 0.65 - effectiveWave × 0.22, tickHz × 0.35)
spawnInterval = max(baseInterval - cycle × 2, 12)  // Min ~0.4s at 30Hz
```

### Wave Types

**Boss Waves** (every 10th effective wave):
- 1 Boss
- 30% Elite guards
- 40% Common enemies

**Early Pillar Waves** (1-2 in cycle):
- 60% Common type 1
- 40% Common type 2

**Mid Pillar Waves** (3-5 in cycle):
- 40% Common type 1
- 35% Common type 2
- 25% Elite

**Late Pillar Waves** (6-9 in cycle):
- 30% Common
- 35% Elite type 1
- 35% Elite type 2

---

## Endless Mode (100+ waves)

After wave 100, the game cycles back to Streets pillar with increased difficulty:

- **Cycle 0** (waves 1-100): Base difficulty
- **Cycle 1** (waves 101-200): 1.6× stats
- **Cycle 2** (waves 201-300): 2.56× stats
- **Cycle 3** (waves 301-400): 4.1× stats
- And so on...

The effective wave determines pillar and composition:
```
cycle = floor((wave - 1) / 100)
effectiveWave = ((wave - 1) % 100) + 1
```
