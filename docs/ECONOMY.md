# Economy System

## Overview

The game features multiple currencies and resource systems:

- **Gold** - Primary currency (earned in-game)
- **Dust** - Premium currency (daily quests, purchases)
- **Honor** - PvP rating currency
- **Sigils** - Leaderboard reward currency
- **Materials** - Crafting resources
- **Energy** - Session limit system

---

## Gold Economy

### Earning Gold

| Source | Amount | Notes |
|--------|--------|-------|
| Enemy Kill | 1-70 gold | Based on enemy type |
| Elite Kill | 2.5× base | Elite multiplier |
| Wave Complete | 10-50 gold | Scales with wave |
| Boss Kill | 18-70 gold | Based on boss type |
| Level Up | 100 gold | Per level gained |
| Idle Rewards | Variable | Colony production |
| Daily Quests | Bonus gold | Quest rewards |

### Gold Scaling Formula
```
effectiveWave = ((wave - 1) % 100) + 1
cycle = floor((wave - 1) / 100)

waveMult = 1 + (effectiveWave - 1) × 0.05  // +5% per wave
cycleMult = 1.4^cycle                        // Exponential: 1x, 1.4x, 1.96x, 2.74x...
finalGold = baseGold × eliteMult × goldFindBonus × waveMult × cycleMult
```

### Spending Gold

| Use | Cost Range |
|-----|------------|
| Power Upgrades | 60-1000+ gold |
| Hero Unlocks | 3,000-50,000 gold |
| Turret Unlocks | 1,500-5,000 gold |
| Wall Placement | 50-150 gold |
| Relic Reroll | 10 gold |
| Crafting | 300-5,000 gold |
| Colony Upgrades | 100-10,000+ gold |

---

## Dust Economy

### Earning Dust

| Source | Amount |
|--------|--------|
| Daily Quest: First Blood | 10 dust |
| Daily Quest: Wave Hunter | 25 dust |
| Daily Quest: Elite Slayer | 15 dust |
| Daily Quest: Boss Slayer | 20 dust |
| Daily Quest: Dedicated | 30 dust |
| **Total Daily** | **100 dust** |

| Source | Amount |
|--------|--------|
| Pillar First Clear | 50-375 dust |
| Pillar Regular Clear | 12-88 dust |
| Leaderboard Rewards | 20-500 dust |
| Battle Pass | Variable |
| Shop Purchase | 100-2000+ dust |

### Spending Dust

| Use | Cost |
|-----|------|
| Hero Gacha Single | 300 dust |
| Hero Gacha Ten | 2,700 dust |
| Artifact Chest (Common) | 100 dust |
| Artifact Chest (Premium) | 300 dust |
| Artifact Chest (Legendary) | 500 dust |
| Extra Hero Slot | 700 dust |
| Extra Turret Slot | 700 dust |
| Energy Refill | 50 dust |
| Battle Pass Tier Skip | 100 dust |
| Configuration Unlock | 50-100 dust |
| Unit Tier Upgrade | 35-140 dust |

---

## Honor System (PvP)

### Earning Honor
| Result | Honor Change |
|--------|--------------|
| PvP Win | +15-30 honor |
| PvP Loss | -5-15 honor |
| Draw | +5 honor |

### Honor Decay
- Inactive for 7 days: -10% honor per day
- Minimum: 0 honor

### Honor Tiers
| Tier | Honor Required |
|------|----------------|
| Bronze | 0-499 |
| Silver | 500-999 |
| Gold | 1000-1999 |
| Platinum | 2000-3499 |
| Diamond | 3500-4999 |
| Champion | 5000+ |

---

## Energy System

### Configuration
| Property | Value |
|----------|-------|
| Max Energy | 100 |
| Regen Rate | 1 per 3 minutes |
| Full Refill Time | 5 hours |
| Refill Cost | 50 dust |

### Energy Costs
| Action | Energy |
|--------|--------|
| Start Endless Session | 10 |
| Start Boss Rush | 15 |
| Start Pillar Challenge | 20 |

### Free Refills
- Level up: Full refill
- Daily login: +20 energy

---

## Gacha System

### Hero Gacha

| Pull Type | Cost | Guarantee |
|-----------|------|-----------|
| Single | 300 dust | - |
| Ten Pull | 2,700 dust | 1+ Rare |

**Pity System**:
- Pity counter: 50 pulls
- Spark counter: 100 pulls
- At 50 pulls: Guaranteed Epic+
- At 100 sparks: Choose any hero

**Base Rates**:
| Rarity | Rate |
|--------|------|
| Common | 60% |
| Rare | 30% |
| Epic | 8% |
| Legendary | 2% |

### Artifact Gacha

| Chest Type | Cost | Epic+ Rate |
|------------|------|------------|
| Common | 100 dust | 5% |
| Premium | 300 dust | 15% |
| Legendary | 500 dust | 30% |
| Weapon | 400 dust | 20% |
| Armor | 800 dust | 25% |

### Shard System
- Duplicate heroes convert to shards
- Shards can upgrade hero tier
- Required shards scale with rarity

---

## Shop System

### Dust Packages

| Package | Dust | Price (PLN) | Bonus |
|---------|------|-------------|-------|
| Small | 100 | 4.99 | - |
| Medium | 500 | 19.99 | +10% |
| Large | 1000 | 34.99 | +15% |
| Mega | 2000 | 59.99 | +20% |

### Boosters

| Booster | Effect | Duration | Cost |
|---------|--------|----------|------|
| XP Boost | 1.5× XP | 24 hours | 100 dust |
| Gold Boost | 1.5× Gold | 24 hours | 100 dust |
| Material Boost | 1.5× Materials | 24 hours | 150 dust |
| Ultimate Boost | 1.5× All | 24 hours | 300 dust |

### Convenience Items

| Item | Effect | Cost |
|------|--------|------|
| Skip Token | Skip wave | 50 dust |
| Instant Claim | Claim all idle | 25 dust |
| Relic Respec | Reset relics | 100 dust |

---

## Battle Pass

### Configuration
| Property | Value |
|----------|-------|
| Season Length | 30 days |
| Total Tiers | 50 |
| Points per Tier | 100 |

### Point Sources
| Source | Points |
|--------|--------|
| Daily Quest Complete | 10 |
| Wave 50 Reached | 25 |
| Boss Kill | 5 |
| PvP Win | 15 |
| Daily Login | 20 |

### Free Track Rewards (Sample)
| Tier | Reward |
|------|--------|
| 5 | 500 gold |
| 10 | 50 dust |
| 15 | Random material |
| 20 | Common artifact |
| 25 | 100 dust |
| 30 | Rare material |
| 40 | Rare artifact |
| 50 | Epic artifact |

### Premium Track Rewards (Sample)
| Tier | Reward |
|------|--------|
| 1 | Exclusive frame |
| 10 | 200 dust |
| 20 | Epic artifact |
| 30 | Exclusive title |
| 40 | 500 dust |
| 50 | Exclusive hero skin |

---

## Daily Quests

### Quest Definitions

| Quest | Target | Dust |
|-------|--------|------|
| First Blood | Complete 1 wave | 10 |
| Wave Hunter | Complete 50 waves | 25 |
| Elite Slayer | Kill 20 elites | 15 |
| Boss Slayer | Kill 5 bosses | 20 |
| Dedicated | Play 30 minutes | 30 |

### Reset Time
- Daily reset: 00:00 UTC
- All quests refresh

---

## Idle Rewards (Colonies)

### Production Formula
```
hourlyGold = Σ(colonyBase × colonyLevel)
fortressBonus = 1 + (fortressLevel - 1) × 0.01
totalHourly = hourlyGold × fortressBonus
```

### Offline Accumulation
- Maximum: 8 hours
- Claim required to reset timer

### Colony Efficiency
| Colony | Gold/Hour/Level | Best For |
|--------|-----------------|----------|
| Farm | 10 | Early game |
| Mine | 25 | Mid game |
| Market | 50 | Late game |
| Factory | 100 | Endgame |

---

## Resource Conversion

### Dust to Gold
- Not directly convertible
- Dust purchases in shop include gold

### Gold to Dust
- Not directly convertible
- Must earn dust through gameplay

### Material Conversion
- Craft higher tier materials
- Recipe: 3× lower tier → 1× higher tier
- Cost: Gold varies by tier
