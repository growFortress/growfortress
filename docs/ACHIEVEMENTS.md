# Achievements System

## Overview

Permanent progression system inspired by Hero Zero's "Heroic Deeds". Unlike daily quests, achievements never reset and track lifetime statistics across all gameplay.

**Key Features:**
- **Permanent progression** - Stats tracked forever, never reset
- **Tiered milestones** - Each achievement has 5-10 tiers (I, II, III... X)
- **8 categories** - Covering all gameplay aspects
- **24 achievements** - With ~226 total claimable tiers
- **Rich rewards** - Dust, Gold, Materials, and Titles

---

## Categories

| Category | Icon | Description | Tracked Stats |
|----------|------|-------------|---------------|
| Combat | ⚔️ | Battle performance | Kills, damage, crits |
| Progression | ⬆️ | Game advancement | Waves, runs, levels |
| Collection | 🏆 | Collecting items | Heroes, artifacts |
| Economy | 💰 | Resource management | Gold earned, dust spent |
| PvP | 🥊 | Arena battles | Battles, victories |
| Guild | 🏠 | Guild activities | Donations, Tower Race |
| Challenge | 🎯 | Special modes | Boss Rush, Pillar Challenge |
| Mastery | 🧙 | Skill usage | Skills, synergies |

---

## Achievement Definitions

### Combat Category

| ID | Name | Description | Tiers | Targets |
|----|------|-------------|-------|---------|
| `enemy_slayer` | Enemy Slayer | Kill enemies | 10 | 100 → 1,000,000 |
| `elite_hunter` | Elite Hunter | Kill elite enemies | 10 | 10 → 500,000 |
| `boss_destroyer` | Boss Destroyer | Kill bosses | 10 | 5 → 200,000 |
| `damage_dealer` | Damage Dealer | Deal total damage | 10 | 10K → 10B |
| `critical_striker` | Critical Striker | Land critical hits | 10 | 50 → 5,000,000 |

### Progression Category

| ID | Name | Description | Tiers | Targets |
|----|------|-------------|-------|---------|
| `wave_warrior` | Wave Warrior | Complete waves | 10 | 50 → 50,000,000 |
| `dedicated_player` | Dedicated Player | Complete runs | 10 | 5 → 50,000 |
| `level_master` | Level Master | Reach commander level | 7 | 5 → 200 |
| `prestige_master` | Prestige Master | Prestige count | 4 | 1 → 10 |

### Collection Category

| ID | Name | Description | Tiers | Targets |
|----|------|-------------|-------|---------|
| `hero_collector` | Hero Collector | Unlock heroes | 5 | 3 → 20 |
| `turret_collector` | Turret Collector | Unlock turrets | 5 | 3 → 15 |
| `artifact_hunter` | Artifact Hunter | Obtain artifacts | 8 | 5 → 500 |

### Economy Category

| ID | Name | Description | Tiers | Targets |
|----|------|-------------|-------|---------|
| `gold_magnate` | Gold Magnate | Earn gold (lifetime) | 10 | 10K → 10B |
| `dust_investor` | Dust Investor | Spend dust | 8 | 100 → 100,000 |
| `material_master` | Material Master | Collect materials | 8 | 50 → 50,000 |

### PvP Category

| ID | Name | Description | Tiers | Targets |
|----|------|-------------|-------|---------|
| `arena_fighter` | Arena Fighter | Complete PvP battles | 10 | 5 → 50,000 |
| `arena_champion` | Arena Champion | Win PvP battles | 10 | 5 → 30,000 |

### Guild Category

| ID | Name | Description | Tiers | Targets |
|----|------|-------------|-------|---------|
| `guild_donor` | Guild Donor | Donate to guild treasury | 8 | 1K → 10M |
| `tower_racer` | Tower Racer | Complete Tower Race waves | 8 | 10 → 100,000 |

### Challenge Category

| ID | Name | Description | Tiers | Targets |
|----|------|-------------|-------|---------|
| `boss_rush_survivor` | Boss Rush Survivor | Complete Boss Rush cycles | 10 | 1 → 30,000 |
| `pillar_conqueror` | Pillar Conqueror | Complete Pillar Challenges | 8 | 1 → 10,000 |

### Mastery Category

| ID | Name | Description | Tiers | Targets |
|----|------|-------------|-------|---------|
| `skill_master` | Skill Master | Activate skills | 10 | 100 → 1,000,000 |
| `synergy_expert` | Synergy Expert | Trigger synergies | 8 | 10 → 100,000 |

---

## Tier Rewards

### Reward Scaling

| Tier | Dust | Gold | Material | Title |
|------|------|------|----------|-------|
| I | 5 | 100 | - | - |
| II | 8 | 200 | - | - |
| III | 12 | 500 | - | - |
| IV | 20 | 1,000 | Rare | - |
| V | 30 | 2,000 | Rare | - |
| VI | 40 | 3,000 | Rare | - |
| VII | 50 | 5,000 | Epic | - |
| VIII | 75 | 8,000 | Epic | - |
| IX | 100 | 10,000 | Legendary | Yes |
| X | 150 | 15,000 | Legendary | Yes |

### Material Rewards

Materials are awarded based on achievement category:

| Category | Material Type |
|----------|---------------|
| Combat | Weapon components |
| Progression | XP crystals |
| Collection | Artifact shards |
| Economy | Trade goods |
| PvP | Arena tokens |
| Guild | Guild emblems |
| Challenge | Challenge orbs |
| Mastery | Skill essences |

### Title Rewards

Titles are unlocked at high tiers (IX-X) and can be displayed next to player name:

| Achievement | Tier IX Title | Tier X Title |
|-------------|---------------|--------------|
| Enemy Slayer | "Slayer" | "Annihilator" |
| Wave Warrior | "Veteran" | "Legend" |
| Gold Magnate | "Wealthy" | "Tycoon" |
| Arena Champion | "Gladiator" | "Champion" |
| Boss Rush Survivor | "Survivor" | "Immortal" |

---

## Lifetime Stats

Stats are tracked permanently in the `PlayerAchievements` model:

### Combat Stats
```typescript
totalKills: number      // All enemy kills
eliteKills: number      // Elite enemy kills
bossKills: number       // Boss kills
damageDealt: bigint     // Total damage dealt
criticalHits: number    // Critical hit count
```

### Progression Stats
```typescript
wavesCompleted: number  // Total waves cleared
runsCompleted: number   // Game sessions completed
commanderLevel: number  // Current commander level
prestigeCount: number   // Prestige resets
```

### Economy Stats
```typescript
goldEarned: bigint      // Lifetime gold earned
dustSpent: number       // Total dust spent
materialsCollected: number // Materials obtained
```

### Activity Stats
```typescript
pvpBattles: number      // PvP matches played
pvpVictories: number    // PvP wins
guildDonations: bigint  // Gold donated to guild
towerRaceWaves: number  // Tower Race waves
bossRushCycles: number  // Boss Rush cycles completed
pillarChallengesCompleted: number // Pillar clears
skillsActivated: number // Skills used
synergiesTriggered: number // Synergies activated
```

---

## Database Schema

```prisma
model PlayerAchievements {
  id                String   @id @default(cuid())
  userId            String   @unique
  lifetimeStats     Json     @default("{}")  // LifetimeStats object
  achievementProgress Json   @default("{}")  // { [achievementId]: currentTier }
  claimedTiers      Json     @default("{}")  // { [achievementId]: number[] }
  unlockedTitles    String[] @default([])
  activeTitle       String?
  updatedAt         DateTime @updatedAt
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

---

## API Endpoints

### Get Achievements
```
GET /v1/achievements
```
Returns all achievements with definitions, progress, and claimable rewards.

**Response:**
```typescript
{
  achievements: Array<{
    definition: AchievementDefinition
    progress: {
      currentTier: number
      currentProgress: number
      currentTarget: number
      nextTier: number | null
      claimedTiers: number[]
      hasUnclaimedReward: boolean
    }
  }>
  lifetimeStats: LifetimeStats
  unlockedTitles: string[]
  activeTitle: string | null
  totalUnclaimedRewards: number
  categoryProgress: Record<Category, { completed: number, total: number }>
}
```

### Claim Single Reward
```
POST /v1/achievements/:id/claim/:tier
```
Claim a specific tier reward for an achievement.

**Response:**
```typescript
{
  success: boolean
  rewards?: {
    dust: number
    gold: number
    material?: { id: string, count: number }
    title?: string
  }
  newInventory?: { dust: number, gold: number, materials: Material[] }
  error?: string
}
```

### Claim All Rewards
```
POST /v1/achievements/claim-all
```
Claim all unclaimed rewards at once.

**Response:**
```typescript
{
  success: boolean
  claimedCount: number
  totalRewards: {
    dust: number
    gold: number
    materials: Material[]
    titles: string[]
  }
  newInventory?: { dust: number, gold: number, materials: Material[] }
  error?: string
}
```

### Set Active Title
```
POST /v1/achievements/title
Body: { title: string | null }
```
Set or clear the active title.

**Response:**
```typescript
{
  success: boolean
  activeTitle: string | null
  error?: string
}
```

---

## Integration Points

### Game Sessions (`gameSessions.ts`)
```typescript
// After run completion:
await updateLifetimeStats(userId, {
  runsCompleted: 1,
  wavesCompleted: wavesCleared,
  goldEarned: totalGoldEarned.toString(),
});
```

### Boss Rush (`bossRush.ts`)
```typescript
// After boss rush completion:
await updateLifetimeStats(userId, {
  bossKills: bossesKilled,
  bossRushCycles: 1,
  damageDealt: totalDamage.toString(),
});
```

### PvP (`pvp.ts`)
```typescript
// After PvP battle:
await updateLifetimeStats(userId, {
  pvpBattles: 1,
  pvpVictories: isWinner ? 1 : 0,
});
```

### Pillar Challenge (`pillarChallenge.ts`)
```typescript
// After challenge completion:
await updateLifetimeStats(userId, {
  pillarChallengesCompleted: 1,
});
```

### Battle Pass (`battlepass.ts`)
```typescript
// Points for claiming achievement tiers:
achievement_claimed: 10  // Per tier claimed
```

---

## Client Implementation

### State Signals (`achievements.signals.ts`)

```typescript
// Core signals
achievementsData: Signal<GetAchievementsResponse | null>
achievementsLoading: Signal<boolean>
achievementsError: Signal<string | null>
achievementsModalVisible: Signal<boolean>
selectedCategory: Signal<AchievementCategory | 'all'>
claimingAchievement: Signal<{ id: string, tier: number } | null>
claimingAll: Signal<boolean>
settingTitle: Signal<boolean>

// Computed
totalUnclaimedCount: Computed<number>
hasUnclaimedAchievementRewards: Computed<boolean>
filteredAchievements: Computed<Achievement[]>
unlockedTitles: Computed<string[]>
activeTitle: Computed<string | null>
```

### Actions

```typescript
fetchAchievements()      // Load all achievements
claimReward(id, tier)    // Claim single tier
claimAllRewards()        // Claim all unclaimed
setActiveTitle(title)    // Set/clear title
showAchievementsModal()  // Open modal
hideAchievementsModal()  // Close modal
setSelectedCategory(cat) // Filter by category
```

### UI Components

**AchievementsModal.tsx:**
- Category tabs (8 + "All")
- Achievement cards with progress bars
- Tier indicators (Roman numerals I-X)
- Reward preview (dust/gold/material/title icons)
- Claim button per tier
- "Claim All" footer button
- Title selector dropdown

---

## Comparison: Daily Quests vs Achievements

| Aspect | Daily Quests | Achievements |
|--------|--------------|--------------|
| Reset | Daily at 00:00 UTC | Never |
| Duration | 24 hours | Permanent |
| Total dust | ~100/day | ~1,650 lifetime |
| Categories | 1 | 8 |
| Tasks | 5 | 24 |
| Claimable rewards | 5/day | ~226 total |
| Titles | 0 | ~25 |
| Long-term goals | No | Yes |
| Battle Pass points | 10/quest | 10/tier |

---

## Future Enhancements

1. **Secret Achievements** - Hidden until unlocked
2. **Achievement Showcase** - Display top achievements on profile
3. **Seasonal Achievements** - Time-limited achievements
4. **Guild Achievements** - Shared guild-wide progress
5. **Achievement Leaderboards** - Compete for most achievements
6. **Retroactive Stats** - Import existing player stats on first load
