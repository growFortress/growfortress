# Progression System

## Overview

The game features multiple progression systems:

1. **Fortress Level (Commander Level)** - Main progression (1-50+)
2. **Unit Tiers** - Individual unit upgrades (1-3)
3. **Tower Tiers** - Tower upgrades (1-3)
4. **Power Upgrades** - Stat investments
5. **Unlocks** - Configurations, units, towers

---

## Fortress Level

### XP Sources

| Source | Base XP | Scaling |
|--------|---------|---------|
| Enemy Kill | 0.75 | +0.075 per wave |
| Elite Kill | 3 | +0.3 per wave |
| Boss Kill | 35 | +1.5 per wave |
| Wave Complete | 7 | +1.5 per wave |
| Pillar Complete | 350 | - |
| Pillar First Complete | 700 | - |

### XP Formula

```
Level 1-10:  XP = level × 200
Level 11-30: XP = level² × 18
Level 31-50: XP = level² × 40
Level 51+:   XP = 100,000 + (level - 50) × 8,000
```

### Example XP Requirements

| Level | XP to Next | Total XP |
|-------|------------|----------|
| 1→2 | 200 | 200 |
| 5→6 | 1,000 | 3,000 |
| 10→11 | 2,000 | 11,000 |
| 20→21 | 7,200 | ~55,000 |
| 30→31 | 16,200 | ~220,000 |
| 50 | 100,000 | ~1.2M |

---

## Slot Unlocks

### Unit Slots

| Fortress Level | Unit Slots |
|----------------|------------|
| 1 | 1 |
| 10 | 2 |
| 30 | 3 |
| 45 | 4 (max) |

### Tower Slots

| Fortress Level | Tower Slots |
|----------------|-------------|
| 1 | 1 |
| 5 | 2 |
| 15 | 3 |
| 25 | 4 |
| 35 | 5 |
| 40 | 6 |

**Extra Slots** (purchasable):
- Slot 7: 1,000 dust
- Slot 8: 1,000 dust

---

## Configuration Unlocks

| Fortress Level | Configuration | Cost |
|----------------|---------------|------|
| 1 | Standardowa | Free (Starter) |
| 20 | Kriogeniczna | 500g + 50 dust |
| 25 | Termiczna | 500g + 50 dust |
| 30 | Elektryczna | 750g + 75 dust |
| 40 | Próżniowa | 1,000g + 100 dust |
| 45 | Kwantowa | 750g + 75 dust |

---

## Unit Unlocks

| Unit | Unlock Level | Rarity | Unlock Cost |
|------|--------------|--------|-------------|
| Vanguard | 1 | Starter | Free |
| Storm | 1 | Starter | Free |
| Spectre | 1* | Rare (Exclusive) | 25,000g |
| Omega | 1* | Legendary (Exclusive) | 5,000 dust |
| Forge | 10 | Common | 3,000g + 500 dust |
| Frost | 20 | Common | 3,000g + 500 dust |
| Rift | 30 | Rare | 6,000g + 1,000 dust |
| Titan | 40 | Epic | 12,000g + 2,000 dust |

*Exclusive units are available from level 1 but require premium purchase.

---

## Tower Unlocks

| Tower | Unlock Level |
|-------|--------------|
| Wieża Railgun | 1 (Starter) |
| Wieża Kriogeniczna | 5 |
| Wieża Artyleryjska | 15 |
| Wieża Łukowa | 30 |
| Wieża Fotonowa | 45 |

---

## Power Upgrades

Permanent stat bonuses purchased with gold. Stored per-player.

### Fortress Stats

| Stat | Bonus/Level | Max Level |
|------|-------------|-----------|
| HP | +5% | 20 |
| Damage | +4% | 20 |
| Armor | +3% | 20 |

### Unit Stats (per unit)

| Stat | Bonus/Level | Max Level |
|------|-------------|-----------|
| HP | +3% | 20 |
| Damage | +3% | 20 |

### Tower Stats (per tower type)

| Stat | Bonus/Level | Max Level |
|------|-------------|-----------|
| Damage | +3% | 20 |
| Attack Speed | +2% | 20 |

---

## Tier Upgrade Costs

### Unit Tiers

| Upgrade | Gold | Dust | Level Required |
|---------|------|------|----------------|
| Tier 1→2 | 500 | 50 | 10 |
| Tier 2→3 | 2,000 | 200 | 20 |

*Tier 3 may require special materials (Vibranium, Uru, Extremis, etc.)*

### Tower Tiers

Towers use a tier cost multiplier (2.0x per tier):

| Tier | Cost Multiplier |
|------|-----------------|
| 1 | 1.0x (base cost) |
| 2 | 2.0x |
| 3 | 4.0x |

---

## Fortress Tiers (Visual)

Based on fortress level, your fortress has a visual tier:

| Level Range | Tier | Name | Description |
|-------------|------|------|-------------|
| 1-9 | 1 | Podstawowa Twierdza | Simple structure |
| 10-24 | 2 | Warownia | Fortified with battlements |
| 25-50 | 3 | Cytadela | Elemental theming and effects |

---

## Level Rewards

Specific rewards at milestone levels:

| Level | Rewards |
|-------|---------|
| 1 | Starter Kit (Standardowa, Vanguard, Storm, Railgun), Skill 1 |
| 5 | 2nd Tower Slot, Wieża Kriogeniczna, Skill 2 |
| 10 | 2nd Unit Slot, Unit "Forge", Skill 3 |
| 15 | 3rd Tower Slot, Wieża Artyleryjska, +10% DMG bonus |
| 20 | Konfiguracja Kriogeniczna, Unit "Frost", Ultimate Skill (Skill 4) |
| 25 | Konfiguracja Termiczna, 4th Tower Slot |
| 30 | 3rd Unit Slot, Unit "Rift", Konfiguracja Elektryczna, Wieża Łukowa |
| 35 | 5th Tower Slot |
| 40 | Unit "Titan", Konfiguracja Próżniowa, 6th Tower Slot, Magic Pillar |
| 45 | 4th Unit Slot (max), Konfiguracja Kwantowa, Wieża Fotonowa |
| 50 | Nexus Sector unlock, Crystal Matrix eligibility, Annihilation Protocol |

---

## Ancient Crystals (Starożytne Kryształy)

End-game progression for level 40+ players.

### Fragment Collection
- 2% fragment drop rate from sector bosses (5x more common than full crystals)
- 0.2% full crystal drop rate
- 10 fragments = 1 crystal
- 6 crystals = Crystal Matrix activation

### Crystal Types

| Crystal | Polish Name | Color | Primary Effect |
|---------|-------------|-------|----------------|
| Power | Kryształ Mocy | Purple | +50% damage |
| Void | Kryształ Próżni | Blue | +100% range |
| Chrono | Kryształ Czasu | Green | -50% cooldowns |
| Matter | Kryształ Materii | Red | Adaptive damage type, +50% luck |
| Vitae | Kryształ Życia | Orange | 30% lifesteal, +15% crit |
| Psi | Kryształ Umysłu | Yellow | +50% XP, CC immunity |

### Crystal Matrix Requirements
- Commander Level 40+
- Tier 3 unit (APEX)
- All 6 Ancient Crystals equipped
- Crystal Matrix artifact

### Annihilation Wave (Fala Anihilacji)
- Effect: Deals 30% of max HP to ALL enemies on screen
- Cooldown: 25 waves (unit unavailable during cooldown)

---

## Post-50 Progression

After reaching level 50, players can continue earning XP:

| Bonus | Per Level |
|-------|-----------|
| Damage | +1% |
| Gold | +0.5% |
| Starting Gold | +3 |

---

## Prestige System (Future)

Planned system for level 50+ players:
- Reset to level 1 with permanent bonuses
- +5% base stats per prestige
- Unlock exclusive cosmetics
- Starting gold bonus
- Dust multiplier
