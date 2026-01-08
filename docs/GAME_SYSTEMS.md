# Game Systems Overview

## Core Gameplay Loop

1. **Wave Start**: Enemies spawn from the right
2. **Combat**: Fortress, heroes, and turrets attack automatically
3. **Wave End**: Choose 1 of 3 relics as reward
4. **Repeat**: Progress through 10 waves
5. **Run End**: Earn gold, dust, and XP

## Combat System

### Damage Calculation

```
finalDamage = baseDamage
  × classModifier
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
- Modified by class and relics

## Fixed-Point Math (FP)

All game calculations use Q16.16 fixed-point integers for determinism:

```typescript
const FP_ONE = 16384;  // 1.0 in fixed-point
const FP_HALF = 8192;  // 0.5 in fixed-point

// Convert float to FP: Math.round(float * 16384)
// Convert FP to float: fp / 16384
```

## AI System (Simple Role-Based)

Heroes use a simple state machine based on role:

```
States: idle | moving | attacking | retreating

Roles:
- DPS: Attack closest enemy in range
- Tank: Move to front line, block enemies
- Support: Stay near allies, apply buffs
```

### Hero Behavior

1. **Retreat Check**: If HP < 30%, retreat to safe zone
2. **Role Action**: Execute role-based behavior
3. **Basic Attack**: Attack if enemy in range

### Enemy Behavior

- Move toward fortress
- Attack anything in range
- Elites have same behavior with better stats

## Determinism

The simulation is fully deterministic:

- **Seeded RNG**: Xorshift32 algorithm
- **Fixed Timestep**: 30 ticks/second
- **Integer Math**: No floating-point operations
- **Event-Based**: Player actions are timestamped events

This allows server replay for anti-cheat verification.

## Tick Rate

- **30 Hz**: 30 ticks per second
- **Tick Duration**: 33.33ms per tick
- **Wave Duration**: ~30-60 seconds per wave

## Cooldowns

All cooldowns are in ticks:

| System | Cooldown |
|--------|----------|
| Hero Skill | 150-300 ticks (5-10s) |
| Turret Attack | Based on attack speed |
| Relic Reroll | 1 per wave |

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
| Wave Clear | 50 + wave×10 | 5 + wave×2 | 100 + wave×20 |
| Enemy Kill | 5-15 | 0 | 10 |
| Elite Kill | 25 | 5 | 50 |
| Boss Kill | 100 | 25 | 200 |

## Infinity Stones

End-game content requiring:
- 10 fragments per stone (2% drop from bosses)
- Or purchase for 500 Sigils (premium currency)
- Level 40+ for Gauntlet
- SNAP ability: 30% damage to all enemies, 25 wave cooldown

## Pillars (Roguelite Branches)

6 Pillars with unique boss encounters:
- War, Science, Magic, Nature, Cosmic, Shadow

Each pillar has specific relic bonuses and challenges.
