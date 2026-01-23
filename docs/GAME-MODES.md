# Game Modes

## Overview

The game features multiple game modes beyond the standard endless tower defense:

1. **Endless Mode** - Standard tower defense with pillar progression
2. **Boss Rush** - Boss gauntlet for high scores
3. **Pillar Challenge** - Deterministic challenges for crystals
4. **Guild Arena** - 5v5 hero battles

---

## Endless Mode (Standard)

### Wave System
- **Pillar Cycle**: 6 pillars × 10 waves = 100 waves per cycle
- **Endless Scaling**: Cycle repeats with 1.6x stats per cycle
- **Wave Composition**: Based on pillar and wave number

### Cycle Calculation
```
cycle = floor((wave - 1) / 100)
effectiveWave = ((wave - 1) % 100) + 1
pillarIndex = floor((effectiveWave - 1) / 10) % 6
```

### Difficulty Scaling
```
waveScale = 1 + (effectiveWave - 1) × 0.12  // +12% per wave
cycleScale = 1.6^cycle                       // ×1.6 per cycle
finalHP = baseHP × waveScale × cycleScale
```

---

## Boss Rush Mode

### Format
- **Type**: Boss gauntlet (no waves, only bosses)
- **Score**: Total damage dealt
- **Progression**: 7 bosses per cycle, infinite cycles

### Boss Sequence

| Position | Boss | Pillar Origin |
|----------|------|---------------|
| 1 | Mafia Boss | Streets |
| 2 | AI Core | Science |
| 3 | Sentinel | Mutants |
| 4 | Cosmic Beast | Cosmos |
| 5 | Dimensional Being | Magic |
| 6 | Titan | Gods |
| 7 | God | Gods |

### Scaling Formula

```
positionScale = 1.10^bossIndex      // +10% per boss
cycleScale = 2.0^cycle              // ×2 per cycle
totalScale = positionScale × cycleScale

hp = baseHP × totalScale × 5.0      // 5× HP multiplier
damage = baseDamage × totalScale × 2.0
speed = baseSpeed × 0.5             // 50% speed
```

### Rewards

**Per-Boss**:
```
gold = (50 + bossIndex × 20) × (1 + cycle × 0.5)
dust = (12 + bossIndex × 5) × (1 + cycle × 0.5)
xp = (30 + bossIndex × 15) × (1 + cycle × 0.5)
essenceChance = min(0.3 + cycle × 0.1, 0.8)
```

### Milestones

| Kills | Milestone | Reward |
|-------|-----------|--------|
| 3 | First Blood | 1× Random Boss Essence |
| 7 | Full Cycle | 1× Gold Trophy |
| 14 | Double Trouble | 2× Gold + 1× Platinum Trophy |
| 21 | Triple Threat | 3× Gold + 2× Platinum Trophy |

### Intermission
- Duration: 90 ticks (3 seconds)
- Between each boss kill and next spawn
- Allows fortress/heroes to recover

---

## Pillar Challenge Mode

### Format
- **Type**: Per-pillar deterministic challenges
- **Reward**: Crystal fragments (no RNG drops)
- **Tiers**: Normal → Hard → Mythic

### Pillar-to-Crystal Mapping

| Pillar | Primary Crystal | Secondary | Multiplier |
|--------|-----------------|-----------|------------|
| Streets | Power | - | 0.5× |
| Science | Mind | - | 1.0× |
| Mutants | Soul | - | 0.5× |
| Cosmos | Space | - | 1.0× |
| Magic | Time | Reality | 1.0× (50% each) |
| Gods | Power | Soul | 1.0× (50% each) |

### Tier Configuration

| Tier | Waves | Time Limit | Enemy HP | Enemy DMG | Enemy Speed |
|------|-------|------------|----------|-----------|-------------|
| Normal | 10 | 300s | 1.0× | 1.0× | 1.0× |
| Hard | 15 | 420s | 1.5× | 1.25× | 1.1× |
| Mythic | 20 | 600s | 2.0× | 1.6× | 1.2× |

### Fragment Rewards

| Tier | Base Frags | Max Bonus | Full Crystal |
|------|------------|-----------|--------------|
| Normal | 1 | 2 | No |
| Hard | 3 | 3 | Yes (first clear) |
| Mythic | 4 | 5 | Yes (every clear) |

### Performance Bonuses

| Bonus | Condition | Reward |
|-------|-----------|--------|
| Speed Clear | Complete under time threshold | +1 fragment |
| Fortress Intact | HP > 75% at end | +1 fragment |
| Perfect Clear | No damage taken | +2 fragments + full crystal |
| Heroes Triumphant | No hero deaths | +1 fragment |

**Speed Clear Thresholds**:
- Normal: < 120s
- Hard: < 180s
- Mythic: < 240s

### Unlock Requirements
- Normal: Always available
- Hard: 3+ Normal clears
- Mythic: 3+ Hard clears

### Fragment Calculation

```
baseFrags = ceil(tierConfig.baseFragments × pillarMultiplier)
bonusFrags = sum(achieved_bonuses)
bonusFrags = min(bonusFrags, tierConfig.maxBonusFragments)
bonusFrags = ceil(bonusFrags × pillarMultiplier)

totalFrags = baseFrags + bonusFrags

// Dual-crystal pillars
primaryFrags = floor(totalFrags / 2)
secondaryFrags = ceil(totalFrags / 2)
```

---

## Guild Arena (5v5)

### Format
- **Type**: 5v5 hero-only battle
- **Arena**: 20×15 units
- **Duration**: Max 1800 ticks (60 seconds)
- **Win**: Eliminate all enemies OR higher HP at timeout

### Hero Initialization

```
stats = calculateHeroStats(heroDef, tier, level)
powerMult = max(1, heroPower / 1000)

hp = floor(stats.hp × powerMult)
damage = floor(stats.damage × powerMult)
attackSpeed = stats.attackSpeed
```

### Positioning
- Attackers: X = 2
- Defenders: X = 18
- Vertical: `spacing = 15 / (heroCount + 1)`
- Random ±1 unit jitter

### Combat Mechanics

| Property | Value |
|----------|-------|
| Move Speed | 0.15 units/tick |
| Attack Range | 3 units |
| Attack Interval | `floor(30 / attackSpeed)` ticks |
| Damage Variance | 90%-110% |
| Crit Chance | 15% |
| Crit Multiplier | 1.5× |

### Target Selection
- Initial: Random alive enemy
- Switch: When target dies
- Alternating update order to prevent bias

### Result Determination

| Condition | Result |
|-----------|--------|
| All attackers dead | Defender wins |
| All defenders dead | Attacker wins |
| Timeout, higher HP | That side wins |
| Timeout, equal HP | Draw |

### Recording

**Key Moments** (max 50):
- Battle start/end
- Critical hits
- Kills

**MVP Calculation**:
- Highest damage dealer from winning side
- Overall highest if draw

---

## Event System

### Event Types

| Event | Description |
|-------|-------------|
| `CHOOSE_RELIC` | Select from pending options |
| `REROLL_RELICS` | Reroll options (costs 10 gold) |
| `HERO_COMMAND` | Move/focus/retreat commands |
| `HERO_CONTROL` | Toggle manual control mode |
| `ACTIVATE_SNAP` | Trigger Annihilation Wave |
| `ACTIVATE_SKILL` | Use fortress class skill |
| `PLACE_WALL` | Build wall (costs gold) |
| `REMOVE_WALL` | Destroy existing wall |
| `SET_TURRET_TARGETING` | Change turret targeting |
| `ACTIVATE_OVERCHARGE` | Boost turret temporarily |
| `SPAWN_MILITIA` | Summon militia squad |

### Validation
- Tick not in past
- Resources sufficient
- Cooldowns respected
- Target exists
- Position valid

---

## Hero AI (`simple-ai.ts`)

### Role-Based Targeting

| Role | Priority |
|------|----------|
| Tank | Closest to fortress |
| DPS | Lowest HP (finish kills) |
| Crowd Control | Largest enemy cluster |
| Support | Stay near allies |

### Target Scoring

**Tank**:
```
score = max(0, 100 - distToFortress × 3)
+ enemy_type_bonus (leech: +30, bruiser: +25, boss: +20)
+ elite_bonus (+25)
```

**DPS**:
```
hpPercent = enemy.hp / enemy.maxHp
score = (1 - hpPercent) × 100
+ enemy_type_bonus
+ elite_bonus (+15)
- hardCC_penalty (-30)
```

**Distribution Bonus**:
```
existingTargeters = getTargetCount(enemyId)
bonus = max(0, (3 - existingTargeters) × 25)
```

---

## Analytics System

### Wave Stats Tracking
- Wave number, duration
- Damage by source (hero/turret/fortress)
- Damage attribution (mechanic type)
- Economy (gold/dust earned/spent)
- Kill counts (normal/elite/boss)

### Damage Attribution Format
```
ownerType|ownerId|mechanicType|mechanicId

ownerType: hero | turret | fortress | system
mechanicType: basic | secondary | skill | dot
```

### Report Generation
- Total damage by source
- MVP hero identification
- Economy summary
- Fortress damage taken
