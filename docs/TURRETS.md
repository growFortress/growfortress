# Defense Towers (Wieżyczki)

The game features 5 defense tower types: 4 core turrets + 1 late-game unlock. Each tower has 3 tiers.

## Overview

| Tower | Role | Base Cost | Unlock Level | Description |
|-------|------|-----------|--------------|-------------|
| Wieża Railgun | DPS | 3,000g | 1 (Starter) | Fast, single-target damage |
| Wieża Kriogeniczna | Crowd Control | 3,500g | 5 | Slow enemies and freeze groups |
| Wieża Artyleryjska | AOE | 8,000g | 15 | Slow but powerful splash damage |
| Wieża Łukowa | AOE | 7,000g | 30 | Chain lightning between enemies |
| Wieża Fotonowa | DPS | 10,000g | 45 | Advanced laser technology |

---

## Wieża Railgun

**Role**: DPS (Single-Target) | **Unlock**: Level 1 (Starter)

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
- Class Change: 150g + 20 dust

### Ability: Rapid Fire
- **Effect**: Doubles attack speed for 5 seconds
- **Cooldown**: 30 seconds

### Projectile Type
Arrow (energy bolt)

### Colors
- Primary: Slate Gray (#4A5568)
- Secondary: Gray-blue (#718096)
- Projectile: Deep Sky Blue (#00BFFF)

---

## Wieża Kriogeniczna

**Role**: Crowd Control | **Unlock**: Level 5

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
- Slow Duration: 2 seconds

### Costs
- Base Cost: 3,500g
- Tier Cost Multiplier: 2.0x per tier
- Class Change: 150g + 20 dust

### Ability: Flash Freeze
- **Effect**: Freezes all enemies in range for 3 seconds
- **Cooldown**: 30 seconds

### Projectile Type
Ice Shard

### Colors
- Primary: Dark Turquoise (#00CED1)
- Secondary: Sky Blue (#87CEEB)
- Projectile: Light Blue (#ADD8E6)

---

## Wieża Artyleryjska

**Role**: AOE | **Unlock**: Level 15

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
- Class Change: 150g + 20 dust

### Ability: Explosive Shell
- **Effect**: Next shot deals 200% damage with larger splash
- **Splash Radius**: 3 units
- **Cooldown**: 20 seconds

### Projectile Type
Cannonball

### Colors
- Primary: Dark Slate Gray (#2F4F4F)
- Secondary: Dim Gray (#696969)
- Projectile: Dark (#1C1C1C)

---

## Wieża Łukowa

**Role**: AOE (Chain) | **Unlock**: Level 30

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
- Class Change: 150g + 20 dust

### Ability: Overload
- **Effect**: Next attack hits ALL enemies in range
- **Cooldown**: 25 seconds

### Projectile Type
Lightning

### Colors
- Primary: Indigo (#4B0082)
- Secondary: Dark Orchid (#9932CC)
- Projectile: Cyan (#00FFFF)

---

## Wieża Fotonowa

**Role**: DPS (Advanced) | **Unlock**: Level 45

### Description
Advanced photon laser technology with piercing beams.

### Base Stats
| Stat | Value |
|------|-------|
| Damage | 20.0 |
| Attack Speed | 2.0/s |
| Range | 12 units |
| Crit Chance | 15% |
| Crit Multiplier | 1.75x |
| HP | 160 |

### Special Effects
- Pierce: Hits through multiple enemies
- Pierce Count: 2

### Costs
- Base Cost: 10,000g
- Tier Cost Multiplier: 2.0x per tier
- Class Change: 200g + 25 dust

### Ability: Photon Surge
- **Effect**: Continuous beam dealing damage over time for 4 seconds
- **DPS**: 30 damage/second
- **Cooldown**: 25 seconds

### Projectile Type
Laser

### Colors
- Primary: Cyan (#00F0FF)
- Secondary: Magenta (#FF00FF)
- Projectile: White (#FFFFFF)

---

## Tower Slots

### Standard Slots (6)
Always available, unlocked by fortress level:

| Level | Slots Available |
|-------|-----------------|
| 1 | 1 |
| 5 | 2 |
| 15 | 3 |
| 25 | 4 |
| 35 | 5 |
| 40 | 6 |

### Layout
```
    [SLOT 1]    [SLOT 2]    [SLOT 3]
        \_________|_________/
              ZAMEK
        /_________|_________\
    [SLOT 4]    [SLOT 5]    [SLOT 6]
```

### Extra Slots (7-8)
Can be unlocked with dust:
- Slot 7: 1,000 dust
- Slot 8: 1,000 dust

---

## Class Modifiers

When a tower matches the fortress configuration class, it receives bonuses:

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

| Tier | Stat Multiplier | Cost Multiplier |
|------|-----------------|-----------------|
| 1 | 1.0x | 1.0x (base) |
| 2 | 1.25x | 2.0x |
| 3 | 1.5x | 4.0x |

HP scales the same: Tier 1 = 1.0x, Tier 2 = 1.25x, Tier 3 = 1.5x

### Example Costs (Railgun)
| Tier | Gold Cost |
|------|-----------|
| 1 | 3,000g |
| 2 | 6,000g |
| 3 | 12,000g |

---

## Targeting Modes

All towers can use these targeting priorities:
1. **Closest** - Target nearest enemy
2. **First** - Target enemy closest to fortress
3. **Strongest** - Target highest HP enemy
4. **Weakest** - Target lowest HP enemy

---

## Recommended Loadouts

### Early Game (Level 1-15)
- 1-2x Railgun (reliable damage)

### Mid Game (Level 15-30)
- 1x Railgun (single-target)
- 1x Kriogeniczna (crowd control)
- 1x Artyleryjska (AOE damage)

### Late Game (Level 30-45)
- 1x Railgun
- 1x Kriogeniczna
- 1x Artyleryjska
- 1x Łukowa (chain damage)

### End Game (Level 45+)
- 2x Fotonowa (DPS)
- 1x Kriogeniczna (CC)
- 1x Łukowa (AOE)
- 2x Artyleryjska (AOE)
