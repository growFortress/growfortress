# Simulation Core Engine

## Overview

The simulation engine (`packages/sim-core`) is a deterministic game engine using fixed-point math for cross-platform replay compatibility.

- **Tick Rate**: 30 Hz (configurable)
- **Math Format**: Q16.16 Fixed-Point (FP.ONE = 65536)
- **RNG**: Xorshift32 (seeded, deterministic)

---

## Fixed-Point Math (`fixed.ts`)

### Format: Q16.16
| Property | Value |
|----------|-------|
| Integer bits | 16 |
| Fractional bits | 16 |
| FP.ONE | 65536 (represents 1.0) |
| FP.HALF | 32768 (represents 0.5) |
| Range | -32768.0 to 32767.99998 |
| Precision | 1/65536 ≈ 0.0000153 |

### Core Operations

| Operation | Formula |
|-----------|---------|
| `fromInt(n)` | `n << 16` |
| `fromFloat(n)` | `(n * 65536) \| 0` |
| `toInt(fp)` | `fp >> 16` |
| `toFloat(fp)` | `fp / 65536` |
| `add(a, b)` | `(a + b) \| 0` |
| `sub(a, b)` | `(a - b) \| 0` |
| `mul(a, b)` | `((a * b) / 65536) \| 0` |
| `div(a, b)` | `((a * 65536) / b) \| 0` |

### 2D Vector Operations
- Dot product: `x1*x2 + y1*y2`
- Cross product: `x1*y2 - y1*x2`
- Normalize: `len = sqrt(x² + y²); return { x/len, y/len }`
- Distance: `sqrt((x2-x1)² + (y2-y1)²)`

---

## RNG System (`rng.ts`)

### Xorshift32 Algorithm
```
x ^= x << 13
x ^= x >>> 17
x ^= x << 5
state = x >>> 0
```

### Methods

| Method | Range | Description |
|--------|-------|-------------|
| `next()` | [0, 2³²) | Raw state |
| `nextFloat()` | [0, 1) | `state / 0x100000000` |
| `nextInt(min, max)` | [min, max] | `min + (state % range)` |
| `nextBool(p)` | true/false | `nextFloat() < p` |
| `shuffle(arr)` | - | Fisher-Yates in-place |
| `pick(arr)` | element | Random selection |
| `pickN(arr, n)` | elements | N unique random |

### State Management
- `getState()` - Save RNG state for checkpoints
- `setState(state)` - Restore RNG state
- `clone()` - Create identical copy

---

## Physics System (`physics.ts`)

### Field Dimensions
```
Width: 40 units
Height: 15 units
Lanes: 3 (top, center, bottom)
Lane Height: 3.0 units
```

### Physics Constants

**Hero Physics**:
| Property | Value |
|----------|-------|
| Acceleration | 0.02 units/tick² |
| Friction | 0.9 (90% velocity retained) |
| Default Radius | 1.0 units |
| Default Mass | 1.0 |
| Separation Force | 0.3 |

**Enemy Physics**:
| Property | Value |
|----------|-------|
| Friction | 0.95 (95% velocity retained) |
| Default Radius | 0.8 units |
| Default Mass | 1.0 |

### Spatial Hash Grid
- Cell size: 4 units
- O(n) collision detection (vs O(n²) brute force)
- Uses 3x3 neighbor search
- Threshold: Simple O(n²) for ≤20 bodies

### Collision Detection
```
dist = sqrt((dx)² + (dy)²)
minDist = radius_a + radius_b
collision = dist < minDist
overlap = minDist - dist
normal = (dx/dist, dy/dist)
```

### Collision Resolution
- Separation based on inverse mass ratios
- Higher mass moves less: `ratio_A = mass_B / total_mass`
- Velocity damped in collision direction

### Knockback System
```
resistance range: 0.0 to 0.9
effective_multiplier = 1 - resistance
velocity += knockback * effective_multiplier
```

### CC Duration
```
effective_duration = base_duration * (1 - cc_resistance)
cc_resistance capped at 0.9
```

---

## Modifier System (`modifiers.ts`)

### Additive Bonus Formula
```
final = base × (1 + sum_of_bonuses)
```

### Diminishing Returns

**Crit Chance**:
```
Soft cap: 50%, Hard cap: 75%
if crit <= 0.5: return crit
else: return min(0.5 + (crit - 0.5) * 0.5, 0.75)
```

**Damage Bonus**:
```
Soft cap: 200%, Hard cap: 500%
if bonus <= 2.0: return bonus
else: return min(2.0 + (bonus - 2.0) * 0.3, 5.0)
```

**Attack Speed**:
```
Soft cap: 100%, Hard cap: 300%
if speed <= 1.0: return speed
else: return min(1.0 + (speed - 1.0) * 0.4, 3.0)
```

**Hard Caps**:
- CDR: 75%
- Knockback Resistance: 90%
- CC Resistance: 90%
- Splash Damage: 100%
- Chain Chance: 100%

### Bonus Categories

**Core Stats** (Additive):
- damageBonus, attackSpeedBonus, cooldownReduction
- maxHpBonus, eliteDamageBonus

**Combat**:
- critChance (diminishing), critDamageBonus
- splashRadiusBonus, splashDamagePercent
- chainChance, chainDamagePercent
- executeBonusDamage

**Defense**:
- incomingDamageReduction, massBonus
- knockbackResistance, ccResistance

**Meta/Luck**:
- dropRateBonus, relicQualityBonus, goldFindBonus

**Conditional**:
- waveDamageBonus (per wave)
- lowHpDamageBonus (when HP ≤ threshold)

---

## Combat Systems

### Damage System (`damage.ts`)

**Fortress Damage**:
```
reduction = clamp(-1.0, 0.9)
finalDamage = floor(damage * (1 - reduction))
```

**CC Application**:
```
effectiveDuration = calculateCCDuration(base, ccResist)
if duration > 0: apply buff marker
```

### Projectile System (`projectile.ts`)

**Movement**:
- Tracks target position each tick
- Hit detection: distance ≤ speed
- Timeout: 300 ticks max lifetime

**Base Speeds**:
| Source | Speed |
|--------|-------|
| Hero | 1.0 |
| Turret | 1.2 |
| Chain (Storm) | 1.5 |

**Pierce Mechanic**:
```
PIERCE_HIT_RADIUS: collision radius
PIERCE_DAMAGE_MULTIPLIER: 0.75 (75% to pierced)
hitEnemyIds[]: prevents double-hit
```

**Status Effects**:
- burn: DOT every 30 ticks
- poison: DOT every 30 ticks
- slow: multiplicative speed reduction
- freeze: speed = 0
- stun: speed = 0 (harder CC)

**Lifesteal**:
```
totalLifesteal = stoneLifesteal + artifactLifesteal
healAmount = floor(damageDealt * totalLifesteal)
```

### Combo System (`combos.ts`)

**Combo Window**: 30 ticks (1 second)
**Combo Cooldown**: 60 ticks (2 seconds)

| Combo | Elements | Effect |
|-------|----------|--------|
| Steam Burst | Fire + Ice | +30% bonus damage |
| Electrocute | Lightning + Ice | 1s stun |
| Shatter | Natural + Tech | Armor break (+50% next hit) |

---

## Synergy System (`synergy.ts`)

### Hero-Fortress Synergy
Per matching hero class:
- +30% damage
- +15% attack speed

### Turret-Fortress Synergy
Per matching turret class:
- +25% attack speed
- +15% damage

### Full Synergy Bonus
Requirements: ≥2 matching heroes AND ≥3 matching turrets

Bonus:
- +50% damage
- +15% crit chance
- +20% cooldown reduction

### Turret Adjacency Synergy

**Layout**:
```
[0] [1] [2]
  FORTRESS
[3] [4] [5]
```

**Adjacency Map**:
- 0: [1, 3], 1: [0, 2, 4], 2: [1, 5]
- 3: [0, 4], 4: [1, 3, 5], 5: [2, 4]

Per adjacent same-type: +15% damage, +10% attack speed

### Hero Pair Synergies

| Pair | Range | Effect |
|------|-------|--------|
| Storm + Forge | 4.5u | +25% AS each |
| Medic + Vanguard | 5.0u | +50% heal, +20% DR |
| Pyro + Frost | - | +100% DMG to burn+freeze |
| Storm + Frost | - | +2 chain targets, 80% decay |
| Omega + Titan | - | +25% DMG, +5% execute |

### Hero Trio Synergy
**Medic + Pyro + Vanguard**: +20% DMG, +20% heal, +15% DR

---

## Wall System

### Wall Types

| Type | HP | Cost | Slow | Notes |
|------|-----|------|------|-------|
| basic | 100 | 50g | 50% | Cyan energy barrier |
| reinforced | 300 | 150g | 75% | Magenta plasma shield |
| gate | 150 | 100g | 25% | Allows friendlies through |

### Mechanics
- AABB collision detection
- Damage interval: 30 ticks (1 second)
- Enemies attack wall periodically
- Slow applied while colliding

---

## Fortress Auras (`fortress-auras.ts`)

### Universal Auras

| Aura | Level | Radius | Target | Effect |
|------|-------|--------|--------|--------|
| Commander Presence | 1 | 10 | both | +10% DMG, +5% AS |
| Defensive Ward | 10 | 8 | turret | +15% HP, +10% DR |
| Battle Momentum | 15 | 9 | hero | +15% AS |
| Critical Focus | 25 | 8 | both | +10% crit chance |

### Class-Specific Auras (Level 20)

| Class | Effect |
|-------|--------|
| Fire | +20% DMG, burn DOT |
| Ice | +15% CDR |
| Lightning | +30% AS |
| Tech | +20% range, +15% DMG |
| Natural | +20% HP, +10% lifesteal |
| Void | +25% crit DMG, +15% execute |
| Plasma | +15% DMG, +1 pierce |

---

## Enemy Abilities (`enemy-abilities.ts`)

| Type | Range | Cooldown | Effect |
|------|-------|----------|--------|
| Catapult | 12u | 105 ticks | Ranged siege attack |
| Healer | 4u | 30 ticks | Heal 2% maxHP to nearby |
| Shielder | 3u | Passive | 30% DR aura |
| Teleporter | - | 150 ticks | Random lane teleport |
| Sapper | - | Passive | 4x damage to walls |

---

## Wave Modifiers

### Modifier Types

| Type | Effect | Reward |
|------|--------|--------|
| speedy | +25% speed | 1.15x |
| armored | +30% HP | 1.20x |
| berserker | +20% damage | 1.15x |
| swarm | 2x count, 0.5x HP | 1.25x |
| elite_rush | 3x elite chance | 1.30x |
| boss_guard | Boss + elite guards | 1.50x |
| regenerating | 2% HP/sec regen | 1.20x |
| shielded | 50% shield | 1.35x |

### Wave Thresholds
- Wave < 20: No modifiers
- Wave 20+: 1 modifier every 5th wave
- Wave 50+: +1 additional every 10th wave
- Wave 101+: +1 additional every 25th wave
- Max: 3 modifiers

---

## Checkpoints & Replay

### FNV-1a 32-bit Hash
```
hash = 0x811c9dc5  // offset basis
for byte in data:
  hash ^= byte
  hash *= 0x01000193  // prime
```

### Chain Hash
```
chainHash = fnv1a32(prevChainHash | tick | currentHash)
```

### Verification Process
1. Validate event ticks are monotonic
2. Run simulation with events
3. Compare generated checkpoints
4. Verify hash32 and chainHash32 match
5. Return success/failure

---

## Constants Summary

### Timing (30Hz)
| Constant | Ticks | Seconds |
|----------|-------|---------|
| HIT_FLASH_TICKS | 3 | 0.1s |
| DEFAULT_EFFECT_DURATION | 90 | 3.0s |
| COMBO_WINDOW | 30 | 1.0s |
| COMBO_COOLDOWN | 60 | 2.0s |
| REGEN_INTERVAL | 150 | 5.0s |
| WALL_DAMAGE_INTERVAL | 30 | 1.0s |

### Combat
| Constant | Value |
|----------|-------|
| PIERCE_DAMAGE_MULT | 0.75 |
| PIERCE_HIT_RADIUS | 1.5 |
| CHAIN_DAMAGE_DECAY | 0.70 |
| CHAIN_RANGE | 4.0 |
