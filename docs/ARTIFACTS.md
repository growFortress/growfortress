# Artifacts System

## Overview

Artifacts are equippable items providing stat bonuses and special effects. Each hero has 3 artifact slots: weapon, armor, accessory.

---

## Artifact Rarities

| Rarity | Multiplier | Color |
|--------|------------|-------|
| Common | 1.0× | Gray |
| Rare | 1.35-1.50× | Blue |
| Epic | 1.50-1.75× | Purple |
| Legendary | 1.75-2.0× | Orange |

---

## Legendary Artifacts

| Artifact | Stats | Special Effect |
|----------|-------|----------------|
| Plasma Hammer | +35% damage | Fire immunity |
| Storm Cleaver | +30% damage | Chain lightning on hit |
| Kinetic Deflector | +50% armor | Kinetic absorption |
| Quantum Armor MK50 | +40% HP | Phase shift ability |
| Grapple Launcher MK2 | +20% AS | Grapple hook pull |
| Gravity Harness | +25% movement | Gravity manipulation |
| Temporal Scanner | +15% crit chance | Time detection |
| Void Codex | +30% void damage | Dimension shift |
| Guardian Protocols | +20% fortress defense | Ally protection |
| Cryo Matrix | +25% ice damage | Freeze effects |
| Obsidian Edge | +40% physical damage | Darkness aura |
| Crystal Matrix | +35% energy damage | Amplification field |

---

## Epic Artifacts

| Artifact | Primary Stat | Secondary |
|----------|--------------|-----------|
| Void Reaver | +25% damage | Void piercing |
| Bio Lance | +20% damage | Lifesteal |
| Plasma Cutter | +22% damage | Armor ignore |
| Frost Hammer | +25% ice damage | Slow on hit |
| Storm Aegis | +30% armor | Lightning reflect |
| Bio Armor | +25% HP | Regen boost |
| Quantum Barrier | +35% armor | Damage absorb |
| Ice Fortress | +30% HP | Freeze resist |
| Void Lens | +15% crit | Void amplify |

---

## Rare Artifacts

| Artifact | Stats |
|----------|-------|
| Void Edge | +18% damage |
| Tech Blade | +15% damage, +5% crit |
| Frost Lance | +15% ice damage |
| Storm Pike | +12% damage, +8% AS |
| Heavy Plate | +20% armor |
| Cryo Shell | +15% HP, cold resist |
| Flux Core | +10% all stats |

---

## Common Artifacts

| Artifact | Stats |
|----------|-------|
| Pulse Rifle | +10% damage |
| Cryo Blade | +8% ice damage |
| Thunder Lance | +10% lightning damage |
| Flame Edge | +10% fire damage |
| Reactive Plating | +12% armor |
| Flame Ward | +10% HP, fire resist |
| Void Shroud | +8% DR |
| Energy Cell | +8% AS |
| Frost Charm | +5% slow effect |
| Flame Core | +5% burn damage |
| Life Pendant | +5% lifesteal |

---

## Artifact Progression

### Leveling (1-20)
- Each level increases base stats
- Cost: Gold + materials
- Level 20 = max level

### Upgrading Cost Formula
```
goldCost = baseGold × (1 + level × 0.15)
materialCost = baseMaterial × ceil(level / 5)
```

### Fusing
- Combine 3 same-rarity artifacts
- Result: Next rarity artifact
- Example: 3 Common → 1 Rare

### Dismantling
- Break down for materials
- Returns: 50% of invested materials
- Legendary → Epic materials

---

## Artifact Effects

### On-Hit Effects
- Pseudo-random seeding for fairness
- `rngSeed = ((projectileId × 2654435761) ^ tick) >>> 0`
- Prevents lucky/unlucky streaks

### Effect Types
| Type | Description |
|------|-------------|
| Stat Bonus | Flat stat increase |
| Damage Type | Element-specific damage |
| Lifesteal | Heal on damage dealt |
| On-Hit | Proc chance effects |
| Aura | Passive area effects |

---

# Materials System

## Material Rarities

| Rarity | Max Stack | Dust Cost |
|--------|-----------|-----------|
| Common | 99 | 50-100 |
| Uncommon | 50 | 100-300 |
| Rare | 25 | 300-600 |
| Epic | 10 | 600-1500 |
| Legendary | 5 | 1500-3000 |

---

## Legendary Materials

| Material | Source | Drop Rate | Use |
|----------|--------|-----------|-----|
| Adamantium | Master Mold boss | 10% | Indestructible weapons (+30% DMG) |
| Vibranium | Streets events | 20% event, 0.25% pillar | Energy absorption (+50% DR) |
| Uru | Nexus Guardian, Void Entity | 10% | Energy weapons (+45% DMG) |
| Darkforce | Magic pillar | 2% pillar, 15-30% boss | Dimensional artifacts |
| Cosmic Dust | Cosmos pillar | 3% pillar, 30% boss | Cosmic enhancements |
| Mutant DNA | Mutants pillar | 4% pillar, 20-30% boss | Biomodifications |
| Pym Particles | Science pillar | 3% pillar, 20% boss | Size manipulation |
| Extremis | Science pillar | 1.5% pillar, 15% boss | Tech with regen |
| Super Soldier Serum | Quest reward, Streets boss | 100% quest, 5% boss | +15% all stats (Natural) |

---

## Crafting Recipes

### Legendary Items

| Recipe | Materials | Cost | Requirements |
|--------|-----------|------|--------------|
| Adamantium Blade | 3× Adamantium | 500g | - |
| Phase Armor | 3× Vibranium | 800g | - |
| Void Edge | 5× Uru, 3× Cosmic Dust | 5000g | Lightning class, Fort 45 |
| Siege Exosuit MK50 | 3× Extremis, 2× Vibranium | 4000g | Fort 40+ |

### Epic Items

| Recipe | Materials | Cost |
|--------|-----------|------|
| Mutation Serum | 3× Mutant DNA | 500g |
| Extremis Injection | 2× Extremis | 300g |
| Super Soldier Treatment | 1× Elite Serum | 1000g |

---

## Boss Essences

Each pillar boss drops essence materials:

| Pillar | Essence | Rarity | Drop Rate |
|--------|---------|--------|-----------|
| Streets | Boss Essence Streets | Uncommon | 30% |
| Science | Boss Essence Science | Uncommon | 30% |
| Mutants | Boss Essence Mutants | Uncommon | 30% |
| Cosmos | Boss Essence Cosmos | Uncommon | 30% |
| Magic | Boss Essence Magic | Uncommon | 30% |
| Gods | Boss Essence Gods | Rare | 30% |

### Trophy Materials
| Trophy | Rarity | Source |
|--------|--------|--------|
| Boss Trophy Gold | Epic | Boss Rush milestones |
| Boss Trophy Platinum | Legendary | Boss Rush milestones |

---

# Colonies (Idle System)

## Colony Types

| Colony | Unlock | Base Gold/hr | Max Level | Upgrade Cost |
|--------|--------|--------------|-----------|--------------|
| Farm | Level 5 | 10 | 50 | 100 × 1.15^level |
| Mine | Level 15 | 25 | 40 | 500 × 1.18^level |
| Market | Level 30 | 50 | 30 | 2000 × 1.20^level |
| Factory | Level 50 | 100 | 20 | 10000 × 1.25^level |

## Production Formula
```
production = baseGoldPerHour × colonyLevel × (1 + (fortressLevel - 1) × 0.01)
totalProduction = sum(all colonies)
```

## Offline Cap
- Maximum accumulation: 8 hours
- Fortress level bonus: +1% per level above 1

---

# Milestones

## Progression Milestones

### Early Game (Waves 1-100)
| Wave | Milestone | Reward |
|------|-----------|--------|
| 10 | First Blood | +5% gold multiplier |
| 25 | Survivor | +10% gold multiplier |
| 50 | Defender | Unlock 4th hero slot |
| 100 | Centurion | Unlock challenge modes |

### Mid Game (Waves 101-500)
| Wave | Milestone | Reward |
|------|-----------|--------|
| 150 | Elite Slayer | +10% damage multiplier |
| 250 | Veteran | +15% damage multiplier |
| 350 | Fortress Master | +10% HP multiplier |
| 500 | Legend | Unlock Mine colony |

### Late Game (Waves 501-5000)
| Wave | Milestone | Reward |
|------|-----------|--------|
| 750 | Epoch Hero | Unlock 5th hero slot |
| 1000 | Thousander | +25% gold multiplier |
| 2500 | Demigod | +20% HP multiplier |
| 5000 | Transcendent | Auto-activate skills |

### Endgame (Waves 5001+)
| Wave | Milestone | Reward |
|------|-----------|--------|
| 10000 | God | +50% damage multiplier |
| 25000 | Eternal | Unlock 6th hero slot |
| 50000 | Primordial | +100% gold multiplier |

---

# Leaderboard Exclusive Items

## Waves Leaderboard Rewards

| Rank | Gold | Dust | Items |
|------|------|------|-------|
| #1 | 50,000 | 500 | Champion Frame, Wavebreaker Title, Golden Tide Aura |
| #2 | 35,000 | 350 | Silver Wave Frame, Tidemaster Title |
| #3 | 25,000 | 250 | Bronze Wave Frame, Wave Veteran Badge |
| #4-10 | 15,000 | 150 | Elite Defender Badge |
| #11-25 | 8,000 | 80 | Wave Warrior Badge |
| #26-50 | 4,000 | 40 | - |
| #51-100 | 2,000 | 20 | - |

## Honor Leaderboard Rewards

| Rank | Gold | Dust | Items |
|------|------|------|-------|
| #1 | 40,000 | 400 | Gladiator Frame, Supreme Gladiator Title, Arena Fire Effect |
| #2 | 28,000 | 280 | Silver Arena Frame, Master Duelist Title |
| #3 | 20,000 | 200 | Bronze Arena Frame, Arena Champion Badge |
| #4-10 | 12,000 | 120 | Elite Fighter Badge |
| #11-25 | 6,000 | 60 | Arena Warrior Badge |
| #26-50 | 3,000 | 30 | - |

## Item Types
| Type | Description |
|------|-------------|
| Frame | Avatar border cosmetic |
| Title | Display name prefix/suffix |
| Badge | Achievement indicator |
| Aura | Special glow effect |
| Effect | Animation enhancement |
