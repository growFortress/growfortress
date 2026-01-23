# Defense Towers (Wieżyczki)

The game features 4 defense tower types. Each tower has 3 tiers and can be assigned to fortress class for bonuses.

## Overview

| Tower | Role | Base Cost | Description |
|-------|------|-----------|-------------|
| Wieża Railgun | DPS | 3,000g | Fast, single-target damage |
| Wieża Kriogeniczna | Crowd Control | 3,500g | Slow enemies and freeze groups |
| Wieża Artyleryjska | AOE | 8,000g | Slow but powerful splash damage |
| Wieża Łukowa | AOE | 7,000g | Chain lightning between enemies |

---

## Wieża Railgun

**Role**: DPS (Single-Target)

### Description
Fast electromagnetic rail turret. Ideal for eliminating single high-priority targets.

### Base Stats
| Stat | Value |
|------|-------|
| Damage | 8.0 |
| Attack Speed | 2.5/s |
| Range | 10 units |
| Crit Chance | 10% |
| Crit Multiplier | 1.5x |
| HP | 150 |

### Costs
- Base Cost: 3,000g
- Tier Cost Multiplier: 2.0x per tier
- Class Change: 150g + 15 dust

### Ability: Rapid Fire
- **Effect**: Doubles attack speed for 5 seconds
- **Cooldown**: 30 seconds (900 ticks)

### Projectile Type
Arrow (energy bolt)

### Colors
- Primary: Slate Gray (#4A5568)
- Secondary: Gray-blue (#718096)
- Projectile: Deep Sky Blue (#00BFFF)

### Legacy ID
`arrow`

---

## Wieża Kriogeniczna

**Role**: Crowd Control

### Description
Cryogenic tower that slows and freezes enemies in place.

### Base Stats
| Stat | Value |
|------|-------|
| Damage | 12.0 |
| Attack Speed | 1.0/s |
| Range | 8 units |
| Crit Chance | 10% |
| Crit Multiplier | 1.5x |
| HP | 200 |

### Special Effects
- Slow Amount: 50%
- Slow Duration: 2 seconds (60 ticks)

### Costs
- Base Cost: 3,500g
- Tier Cost Multiplier: 2.0x per tier
- Class Change: 150g + 15 dust

### Ability: Flash Freeze
- **Effect**: Freezes all enemies in range for 3 seconds
- **Cooldown**: 30 seconds (900 ticks)

### Projectile Type
Ice Shard

### Colors
- Primary: Dark Turquoise (#00CED1)
- Secondary: Sky Blue (#87CEEB)
- Projectile: Light Blue (#ADD8E6)

### Legacy ID
`frost`

---

## Wieża Artyleryjska

**Role**: AOE

### Description
Slow but powerful artillery with area damage.

### Base Stats
| Stat | Value |
|------|-------|
| Damage | 45.0 |
| Attack Speed | 0.5/s |
| Range | 8 units |
| Crit Chance | 5% |
| Crit Multiplier | 2.0x |
| HP | 200 |

### Special Effects
- Splash: Yes
- Splash Radius: 1.5 units

### Costs
- Base Cost: 8,000g
- Tier Cost Multiplier: 2.0x per tier
- Class Change: 150g + 15 dust

### Ability: Explosive Shell
- **Effect**: Next shot deals 200% damage with larger splash
- **Splash Radius**: 3 units
- **Cooldown**: 20 seconds (600 ticks)

### Projectile Type
Cannonball

### Colors
- Primary: Dark Slate Gray (#2F4F4F)
- Secondary: Dim Gray (#696969)
- Projectile: Dark (#1C1C1C)

### Legacy ID
`cannon`

---

## Wieża Łukowa

**Role**: AOE (Chain)

### Description
Electric tower with arc energy that chains between enemies.

### Base Stats
| Stat | Value |
|------|-------|
| Damage | 15.0 |
| Attack Speed | 1.2/s |
| Range | 7 units |
| Crit Chance | 10% |
| Crit Multiplier | 1.5x |
| HP | 180 |

### Special Effects
- Chain Targets: 3
- Chain Damage Reduction: -30% per jump

### Costs
- Base Cost: 7,000g
- Tier Cost Multiplier: 2.0x per tier
- Class Change: 150g + 15 dust

### Ability: Overload
- **Effect**: Next attack hits ALL enemies in range
- **Cooldown**: 25 seconds (750 ticks)

### Projectile Type
Lightning

### Colors
- Primary: Indigo (#4B0082)
- Secondary: Dark Orchid (#9932CC)
- Projectile: Cyan (#00FFFF)

### Legacy ID
`tesla`

---

## Tower Slots

### Standard Slots (6)
Always available:

```
    [SLOT 1]    [SLOT 2]    [SLOT 3]
        \_________|_________/
              ZAMEK
        /_________|_________\
    [SLOT 4]    [SLOT 5]    [SLOT 6]
```

### Slot Positions (relative to fortress)

| Slot | Position | X Offset | Y Offset |
|------|----------|----------|----------|
| 1 | Top | 4 | -3 |
| 2 | Top | 7 | -3.5 |
| 3 | Top | 10 | -3 |
| 4 | Bottom | 4 | 3 |
| 5 | Bottom | 7 | 3.5 |
| 6 | Bottom | 10 | 3 |

### Extra Slots (7-8)
Can be unlocked with dust:
- Slot 7: 700 dust (position: x=13, y=-2.5)
- Slot 8: 700 dust (position: x=13, y=2.5)

---

## Class Modifiers

When a tower is assigned to a fortress configuration class, it receives bonuses:

| Class | Damage | Attack Speed | Range | Special |
|-------|--------|--------------|-------|---------|
| Natural | 1.0x | 1.0x | 1.0x | - |
| Ice | 0.9x | 1.0x | 1.0x | +30% slow duration |
| Fire | 1.2x | 1.0x | 1.0x | +20% DOT damage |
| Lightning | 1.0x | 1.3x | 1.0x | +1 chain target |
| Tech | 1.0x | 1.0x | 1.2x | +1 pierce |

---

## Tier Upgrades

Towers can be upgraded to increase their stats:

| Tier | Stat Multiplier | HP Multiplier | Cost Multiplier |
|------|-----------------|---------------|-----------------|
| 1 | 1.0x | 1.0x | 1.0x (base) |
| 2 | 1.25x | 1.25x | 2.0x |
| 3 | 1.5x | 1.5x | 4.0x |

### Example Costs

| Tower | Tier 1 | Tier 2 | Tier 3 |
|-------|--------|--------|--------|
| Railgun | 3,000g | 6,000g | 12,000g |
| Kriogeniczna | 3,500g | 7,000g | 14,000g |
| Artyleryjska | 8,000g | 16,000g | 32,000g |
| Łukowa | 7,000g | 14,000g | 28,000g |

---

## Targeting Modes

All towers can use these targeting priorities:
1. **Closest** - Target nearest enemy
2. **First** - Target enemy closest to fortress
3. **Strongest** - Target highest HP enemy
4. **Weakest** - Target lowest HP enemy

---

## Recommended Loadouts

### Early Game
- 1-2x Railgun (reliable single-target damage)

### Mid Game
- 1x Railgun (single-target)
- 1x Kriogeniczna (crowd control)
- 1x Artyleryjska (AOE damage)

### Late Game
- 1x Railgun
- 1x Kriogeniczna
- 1-2x Artyleryjska
- 1x Łukowa (chain damage)

### End Game (Full 6 slots)
- 2x Artyleryjska (AOE)
- 2x Łukowa (chain)
- 1x Kriogeniczna (CC)
- 1x Railgun (priority targets)

---

## Tower ID Migration

The game uses new tower IDs but maintains backwards compatibility with legacy IDs:

| New ID | Legacy ID |
|--------|-----------|
| railgun | arrow |
| cryo | frost |
| artillery | cannon |
| arc | tesla |
