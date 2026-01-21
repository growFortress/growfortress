# Game Systems Overview

## Game Modes

### 1. Endless Session (Main Mode)

The primary game mode. Defend your fortress against infinite waves of enemies.

**Core Loop:**
1. **Wave Start**: Enemies spawn from the right
2. **Combat**: Fortress, heroes, and turrets attack automatically
3. **Wave End**: Choose 1 of 3 relics as reward
4. **Repeat**: Progress through endless waves (cycles every 100 waves)

**Features:**
- Segment-based server verification (anti-cheat)
- Session persistence (can resume after disconnect)
- Sectors change every ~10-20 waves
- Ancient Crystals drop from sector bosses

### 2. Boss Rush

Endless boss-only mode. Fight increasingly difficult bosses for materials and leaderboard ranking.

**Features:**
- Only bosses, no regular enemies
- Cycles through all pillar boss types
- Weekly leaderboard (total damage dealt)
- Unique material drops (boss essences)

### 3. Pillar Challenge

Deterministic crystal farming mode. Complete pillar-specific challenges for guaranteed crystal fragments.

**Features:**
- Fixed wave count based on difficulty tier (10/15/20 waves)
- Time limit for completion
- Deterministic rewards (no RNG for crystal drops)
- Performance bonuses for speed, fortress HP, and zero deaths
- Server-side verification via replay

**Difficulty Tiers:**

| Tier | Waves | Time Limit | Fragment Rewards | Unlock Requirement |
|------|-------|------------|------------------|-------------------|
| Normal | 10 | 5 min | 1 base + 2 bonus | Pillar unlocked |
| Hard | 15 | 7 min | 2 base + 3 bonus | 3× Normal clears |
| Mythic | 20 | 10 min | 3 base + 5 bonus | Perfect Hard clear |

**Crystal Mapping by Pillar:**

| Pillar | Crystal Type(s) | Fragment Multiplier |
|--------|-----------------|---------------------|
| Streets | Power | 50% |
| Science | Mind | 100% |
| Mutants | Soul | 50% |
| Cosmos | Space | 100% |
| Magic | Time + Reality | 50% each |
| Gods | Power + Soul | 50% each |

**Performance Bonuses:**

| Bonus | Condition | Reward |
|-------|-----------|--------|
| Speed Clear | Complete in < 2 min | +1 fragment |
| Fortress Intact | Fortress HP > 75% | +1 fragment |
| Perfect Clear | Zero fortress damage | +2 fragments |
| Heroes Triumphant | Zero hero deaths | +1 fragment |

**Entry System:**
- 3 free attempts per day
- 2 paid attempts (1000 gold each)
- 30-minute cooldown between attempts

### 4. PvP Arena

Asynchronous player vs player battles. See [pvp-arena.md](./pvp-arena.md) for full documentation.

**Features:**
- Challenge other players to fortress duels
- Fully deterministic auto-battle with replays
- ELO-based matchmaking (±20% power range)
- Win condition: destroy enemy fortress

### 5. Guild Battles

Team vs team PvP for guilds. See [guild-system.md](./guild-system.md) for full documentation.

**Features:**
- Guild vs Guild battles for honor
- Shared treasury system
- Guild progression (levels 1-20)
- Weekly guild leaderboards

---

## Sectors (Pillars)

Sectors are thematic chapters that cycle during endless mode. Each sector has unique enemies, bosses, and configuration modifiers.

| Sector | Waves | Theme | Best Configurations |
|--------|-------|-------|---------------------|
| **Ulice (Streets)** | 1-10 | Urban, gangsters, nightlife | Standardowa (+20%), Kwantowa (+15%) |
| **Nauka (Science)** | 11-25 | Labs, robots, AI | Kwantowa (+25%), Elektryczna (+15%) |
| **Mutanci (Mutants)** | 26-40 | Sentinels, biotech | Standardowa (+20%), Termiczna (+10%) |
| **Kosmos (Cosmos)** | 41-60 | Aliens, space stations | Kwantowa (+20%), Elektryczna/Termiczna (+15%) |
| **Magia (Magic)** | 61-80 | Dimensions, demons | Termiczna (+30%), Kriogeniczna (+10%) |
| **Bogowie (Nexus)** | 81-100 | Gods, titans, Asgard | Elektryczna (+25%), Termiczna (+20%) |

After wave 100, sectors cycle back to Streets (wave 101 = effective wave 1 with scaled difficulty).

### Sector Bosses

| Sector | Boss 1 | Boss 2 | Crystal Drops |
|--------|--------|--------|---------------|
| Streets | Kingpin | Bullseye | - |
| Science | Ultron Prime | M.O.D.O.K. | Psi (Mind) |
| Mutants | Master Mold | Nimrod | - |
| Cosmos | Corvus Glaive | Ronan | Power, Void |
| Magic | Dormammu | Baron Mordo | Chrono, Matter |
| Nexus | Hela | Surtur | Vitae |

---

## Ancient Crystals (Starożytne Kryształy)

Collectible endgame artifacts that drop from sector bosses. Collecting all 6 crystals enables the Annihilation Wave ability.

### Crystals

| Crystal | English | Polish | Color | Primary Effect | Secondary Effects |
|---------|---------|--------|-------|----------------|-------------------|
| **Power** | Power Crystal | Kryształ Mocy | Purple | +50% damage | Power Blast ability |
| **Space** | Void Crystal | Kryształ Próżni | Blue | +100% range | Teleport, ignore obstacles |
| **Time** | Chrono Crystal | Kryształ Czasu | Green | -50% cooldowns | Time Rewind, 20% dodge |
| **Reality** | Matter Crystal | Kryształ Materii | Red | Adaptive damage | +50% luck |
| **Soul** | Vitae Crystal | Kryształ Życia | Orange | 30% lifesteal | Resurrection, +15% crit |
| **Mind** | Psi Crystal | Kryształ Umysłu | Yellow | +50% XP | Mind Control, CC immunity |

### Fragment System

- 10 fragments = 1 full crystal
- Each fragment gives partial stat bonus (1/10 of full effect)
- Dust cost to buy full crystal: 10,000 dust each
- Transfer cost between units: 500 gold

**Fragment Sources:**

| Source | Type | Notes |
|--------|------|-------|
| Boss Drops | Random | 2% chance per boss kill |
| Pillar Challenge | Deterministic | Guaranteed fragments based on tier |
| Shop | Purchase | 10,000 dust per full crystal |

### Crystal Matrix (Matryca Kryształów)

Special artifact that enables Annihilation Wave when equipped with all 6 crystals.

**Requirements:**
- Commander Level 40+
- Tier 3 unit (APEX)
- All 6 Ancient Crystals
- Crystal Matrix artifact

**Full Set Bonus:**
- +200% all stats
- All crystal effects active simultaneously

**Annihilation Wave (Fala Anihilacji):**
- Deals 30% of max HP to ALL enemies on screen
- 25 wave cooldown after use (unit unavailable)

---

## Combat System

### Damage Calculation

```
finalDamage = baseDamage
  × classModifier
  × pillarModifier
  × relicModifiers
  × critMultiplier (if crit)
  × targetWeakness (if applicable)
```

### Attack Types

| Type | Description |
|------|-------------|
| **Single Target** | Standard attack on one enemy |
| **Splash/AoE** | Damages enemies in radius |
| **Chain** | Lightning jumps between enemies |
| **Pierce** | Passes through multiple enemies |

### Critical Hits

- Base crit chance: 5%
- Base crit damage: 150%
- Modified by class, relics, and crystals

---

## AI System (Role-Based)

Heroes use a simple state machine based on role:

```
States: idle | moving | attacking | retreating

Roles:
- DPS: Attack closest enemy in range
- Tank: Move to front line, block enemies
- Support: Stay near allies, apply buffs
- Assassin: Target low-HP enemies, high mobility
- Crowd Control: Apply slows/freezes to groups
```

### Hero Behavior

1. **Retreat Check**: If HP < 30%, retreat to safe zone
2. **Role Action**: Execute role-based behavior
3. **Basic Attack**: Attack if enemy in range
4. **Skill Use**: Use skills when available and appropriate

### Enemy Behavior

- Move toward fortress
- Attack anything in range
- Elites have same behavior with better stats
- Bosses have unique abilities and phases

---

## Technical Systems

### Simulation Architecture

The game simulation is split into modular systems in `packages/sim-core/src/systems/`:

```
systems/
├── index.ts              # Re-exports for backward compatibility
├── constants.ts          # FP math, attack intervals, physics config
├── hero.ts               # Unit AI, movement, combat, skills
├── turret.ts             # Tower targeting and attacks
├── projectile.ts         # Projectile movement, collision, status effects
├── fortress-skills.ts    # Fortress configuration skill execution
├── damage.ts             # Damage application (dodge, block, weakness)
├── weakness.ts           # Unit weakness calculations
├── synergy.ts            # Configuration synergy bonuses
├── infinity-stones.ts    # Crystal bonus calculations
├── artifacts.ts          # Artifact/item effects
├── helpers.ts            # Shared utilities (findClosestEnemy, formations)
└── initialization.ts     # Entity creation (units, towers, skills)
```

**Dependency Graph:**
```
constants (leaf)
    ↑
weakness, synergy (leaves)
    ↑
crystals, artifacts, helpers
    ↑
damage ← weakness, artifacts
    ↑
projectile ← crystals, helpers
    ↑
turret, fortress-skills ← projectile
    ↑
hero ← weakness, crystals, artifacts, projectile, helpers
    ↑
initialization ← helpers
```

Each module is focused on a single responsibility, making it safe to modify one system without breaking others.

### Fixed-Point Math (FP)

All game calculations use Q14.14 fixed-point integers for determinism:

```typescript
const FP_ONE = 16384;  // 1.0 in fixed-point
const FP_HALF = 8192;  // 0.5 in fixed-point

// Convert float to FP: Math.round(float * 16384)
// Convert FP to float: fp / 16384
```

### Determinism

The simulation is fully deterministic:

- **Seeded RNG**: Xorshift32 algorithm
- **Fixed Timestep**: 30 ticks/second
- **Integer Math**: No floating-point operations
- **Event-Based**: Player actions are timestamped events

This allows server replay for anti-cheat verification.

### Tick Rate

- **30 Hz**: 30 ticks per second
- **Tick Duration**: 33.33ms per tick
- **Wave Duration**: ~30-60 seconds per wave

### Cooldowns

All cooldowns are in ticks:

| System | Cooldown |
|--------|----------|
| Hero Skill | 150-300 ticks (5-10s) |
| Turret Attack | Based on attack speed |
| Turret Ability | 600-900 ticks (20-30s) |
| Fortress Skill | 450-600 ticks (15-20s) |
| Relic Reroll | 1 per wave |
| Annihilation Wave | 25 waves |

---

## Scoring

```
score = (wavesCleared × 100)
      + (totalKills × 10)
      + (eliteKills × 50)
      + (goldEarned)
```

## Rewards

| Source | Gold | Dust | XP |
|--------|------|------|-----|
| Wave Clear | 50 + wave×10 | 5 + wave×2 | 7 + wave×1.5 |
| Enemy Kill | 5-15 | 0 | 0.75 + wave×0.075 |
| Elite Kill | 25 | 5 | 3 + wave×0.3 |
| Boss Kill | 100 | 25 | 35 + wave×1.5 |

---

## Guild System

Multiplayer team system for 10-30 players. See [guild-system.md](./guild-system.md) for full documentation.

### Key Features

| Feature | Description |
|---------|-------------|
| **Team Leaderboard** | Weekly ranking based on honor (ELO) |
| **Shared Treasury** | Gold, dust with full audit trail |
| **Guild Battles** | Team vs Team PvP for honor |
| **Progression** | Levels 1-20 with member bonuses |

### Guild Bonuses (Level 20)

- +20% Gold from sessions (Skarbiec)
- +20% XP from sessions (Akademia)
- +20% stats (Zbrojownia)
- 30 member capacity (Kwatera)

### Hierarchy

| Role | Permissions |
|------|-------------|
| LEADER | Full control, treasury withdraw |
| OFFICER | Invite, kick members, start battles |
| MEMBER | Deposit to treasury |
