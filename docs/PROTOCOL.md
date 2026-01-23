# Protocol Package

## Overview

The protocol package (`packages/protocol`) defines all shared Zod schemas between client and server. These are the contract definitions for API requests/responses, WebSocket events, and game data structures.

- **Framework**: Zod v3 for runtime validation
- **Schema Version**: 2
- **Schema Files**: 35+ modules
- **Total Schemas**: 200+
- **TypeScript Types**: 300+

---

## Directory Structure

```
packages/protocol/src/
├── index.ts              # Main exports
├── version.ts            # Schema version (currently: 2)
├── auth.ts               # Authentication & profile
├── events.ts             # Game events (player actions)
├── websocket.ts          # WebSocket bidirectional events
├── sessions.ts           # Game session management
├── pvp.ts                # PvP arena system
├── artifacts.ts          # Artifact system
├── heroes.ts             # Hero system
├── power-upgrades.ts     # Power upgrade system
├── slots.ts              # Slot unlocking
├── boss-rush.ts          # Boss rush mode
├── leaderboard.ts        # Leaderboard system
├── guild.ts              # Guild system (largest module)
├── messages.ts           # Messaging & moderation
├── chat.ts               # Global/guild chat
├── gacha.ts              # Gacha/summon system
├── battlepass.ts         # Battle pass system
├── shop.ts               # Shop system
├── pillar-challenge.ts   # Pillar challenge mode
├── daily-quests.ts       # Daily quests
├── energy.ts             # Energy system
├── mastery.ts            # Mastery skill trees
├── hub-preview.ts        # Hub preview
├── guild-preview.ts      # Guild preview
├── telemetry.ts          # Analytics events
├── upgrades.ts           # Hero/turret upgrades
├── materials.ts          # Material management
├── idle.ts               # Idle rewards
├── rewards.ts            # Bulk rewards
├── iap.ts                # In-app purchases
├── referrals.ts          # Referral system
├── pillar-unlocks.ts     # World progression
├── guild-medals.ts       # Tower race rewards
└── guild-trophies.ts     # Arena achievements
```

---

## Core Schema Modules

### Authentication (`auth.ts`)

| Schema | Description |
|--------|-------------|
| `AuthRegisterRequestSchema` | Register with username/password/email/referral |
| `AuthLoginRequestSchema` | Login credentials |
| `AuthRefreshRequestSchema` | Token refresh |
| `InventorySchema` | Player inventory (gold, dust, materials) |
| `ProgressionSchema` | Player progression (level, XP, slots) |
| `FortressClassSchema` | natural, ice, fire, lightning, tech, void, plasma |
| `HeroIdSchema` | Hero identifiers |
| `TurretTypeSchema` | Turret type identifiers |
| `DefaultLoadoutSchema` | Player's default battle setup |
| `BuildPresetSchema` | Saved build configurations |
| `ProfileResponseSchema` | Complete player profile |
| `GameConfigSchema` | Remote game configuration |

### Game Events (`events.ts`)

Discriminated union on `type` field for player actions during gameplay.

| Event Type | Description |
|------------|-------------|
| `ChooseRelicEventSchema` | Select relic at wave (tick, wave, optionIndex) |
| `RerollRelicsEventSchema` | Reroll available relics |
| `ActivateSnapEventSchema` | Activate Annihilation Wave (Crystal Matrix) |
| `HeroCommandEventSchema` | Tactical orders (move, focus, retreat) |
| `HeroControlEventSchema` | Toggle manual hero control |
| `ActivateSkillEventSchema` | Fortress skill at target location |
| `PlaceWallEventSchema` | Defense wall placement |
| `RemoveWallEventSchema` | Remove wall by ID |
| `SetTurretTargetingEventSchema` | Change turret targeting mode |
| `ActivateOverchargeEventSchema` | Turret overcharge ability |
| `SpawnMilitiaEventSchema` | Spawn militia units |
| `CheckpointSchema` | Game state checkpoint (tick, hash32, chainHash32) |

### WebSocket Events (`websocket.ts`)

**Server -> Client Events (17 types)**:
| Event | Description |
|-------|-------------|
| `message:new` | New message in thread |
| `message:read` | Thread marked as read |
| `thread:new` | New conversation started |
| `thread:participant_added` | User added to group |
| `thread:participant_left` | User left group |
| `chat:global` | Global chat message |
| `chat:guild` | Guild chat message |
| `guild:chat:message` | Guild chat (new system) |
| `guild:invitation` | Invitation received |
| `guild:invitation_status` | Invitation status changed |
| `guild:kicked` | Removed from guild |
| `unread:update` | Unread counts changed |
| `moderation:muted` | User muted |
| `moderation:unmuted` | Mute lifted |
| `moderation:warning` | Warning issued |
| `pong` | Response to ping |
| `error` | Error notification |
| `connected` | Connection established |

**Client -> Server Events (3 types)**:
| Event | Description |
|-------|-------------|
| `ping` | Keep-alive |
| `subscribe` | Subscribe to channels |
| `unsubscribe` | Unsubscribe from channels |

### Session Management (`sessions.ts`)

| Schema | Description |
|--------|-------------|
| `SessionStartRequestSchema` | Begin game session (class, heroes, turrets, pillar) |
| `SessionStartResponseSchema` | Session init (sessionId, seed, simVersion, tickHz) |
| `SessionEndRequestSchema` | End session (reason, partial rewards) |
| `SessionEndResponseSchema` | End confirmation with rewards |
| `SegmentSubmitRequestSchema` | Submit game segment for validation |
| `SegmentSubmitResponseSchema` | Validation response |
| `ProgressionBonusesSchema` | Damage/gold multipliers, starting gold |
| `PartialRewardsSchema` | Rewards earned during session |

### PvP Arena (`pvp.ts`)

| Schema | Description |
|--------|-------------|
| `PvpChallengeStatusSchema` | PENDING, ACCEPTED, RESOLVED, DECLINED, EXPIRED, CANCELLED |
| `PvpWinReasonSchema` | fortress_destroyed, timeout, draw |
| `PvpBattleStatsSchema` | Final HP, damage dealt, heroes alive |
| `PvpBattleDataSchema` | Seed and build configs for both players |
| `PvpRewardsSchema` | Dust, gold, honor change, artifact drops |
| `PvpCreateChallengeRequestSchema` | Challenge opponent |
| `PvpChallengeSchema` | Challenge metadata and status |
| `PvpOpponentSchema` | Opponent preview info |
| `PvpReplayRequestSchema` | Request battle replay |
| `PvpUserStatsSchema` | Player PvP statistics |

**Constants**: `PVP_CONSTANTS`, `PVP_ERROR_CODES`

### Artifact System (`artifacts.ts`)

| Schema | Description |
|--------|-------------|
| `ArtifactSlotTypeSchema` | weapon, armor, accessory |
| `ArtifactRaritySchema` | common, rare, epic, legendary |
| `PlayerArtifactSchema` | Instance with ID, level (1-20), equipped status |
| `PlayerItemSchema` | Consumable item (itemId, amount) |
| `CraftArtifactRequestSchema` | Craft new artifact |
| `EquipArtifactRequestSchema` | Equip to hero slot |
| `UpgradeArtifactRequestSchema` | Level up artifact |
| `FuseArtifactsRequestSchema` | Combine artifacts |
| `DismantleArtifactRequestSchema` | Break down for materials |

### Power Upgrades (`power-upgrades.ts`)

| Schema | Description |
|--------|-------------|
| `StatUpgradesSchema` | HP, damage, attackSpeed, range, critChance, etc. |
| `FortressUpgradableStatSchema` | hp, damage, armor |
| `HeroUpgradableStatSchema` | hp, damage |
| `TurretUpgradableStatSchema` | damage, attackSpeed |
| `FortressPrestigeSchema` | Prestige levels (0-5) per stat |
| `PowerBreakdownSchema` | Power calculation breakdown |
| `PowerSummaryResponseSchema` | Total power summary |

**Constants**:
- `MAX_PRESTIGE_LEVEL = 5`
- `PRESTIGE_BONUS_PER_LEVEL = 0.05`
- `PRESTIGE_COSTS` - Gold costs per level

---

## Guild System (`guild.ts`)

The largest schema module covering all guild functionality.

### Enums

| Enum | Values |
|------|--------|
| `GuildRoleSchema` | LEADER, OFFICER, MEMBER |
| `GuildAccessModeSchema` | OPEN, APPLY, INVITE_ONLY, CLOSED |
| `GuildInvitationStatusSchema` | PENDING, ACCEPTED, DECLINED, EXPIRED, CANCELLED |
| `GuildApplicationStatusSchema` | PENDING, ACCEPTED, DECLINED, EXPIRED, CANCELLED |
| `GuildBattleStatusSchema` | RESOLVED |
| `ArenaWinnerSideSchema` | attacker, defender, draw |
| `ArenaWinReasonSchema` | elimination, timeout, draw |
| `TreasuryTransactionTypeSchema` | DEPOSIT_GOLD, DEPOSIT_DUST, WITHDRAW, BATTLE_COST, etc. |

### Constants (`GUILD_CONSTANTS`)

| Constant | Value |
|----------|-------|
| Name limits | Min/max length |
| Tag limits | Length restrictions |
| Member capacity | Max members per guild |
| Donation limits | Daily donation caps |
| Cooldowns | Action cooldowns |
| Arena config | Battle settings |

### Core Schemas

| Schema | Description |
|--------|-------------|
| `GuildSchema` | Guild data (name, tag, level, treasury) |
| `GuildMemberSchema` | Member info with role and contributions |
| `GuildStructureTypeSchema` | Structure types (Kwatera, Akademia, etc.) |
| `GuildSettingsSchema` | Guild configuration |

### Management Operations

| Schema | Description |
|--------|-------------|
| `CreateGuildRequestSchema` | Create new guild |
| `UpdateGuildRequestSchema` | Update settings |
| `UpdateGuildDescriptionRequestSchema` | Update public description |
| `UpdateGuildEmblemRequestSchema` | Update logo/emblem |
| `GuildSearchQuerySchema` | Search guilds |
| `TransferLeadershipRequestSchema` | Transfer guild ownership |

### Battle System

| Schema | Description |
|--------|-------------|
| `BattleHeroSchema` | Hero with tier and power |
| `SetBattleHeroRequestSchema` | Assign hero for arena |
| `BattleRosterMemberSchema` | Team roster |
| `GuildBattleSchema` | Battle metadata |
| `GuildBattleResultSchema` | Win/loss, stats, rewards |
| `InstantAttackRequestSchema` | Quick challenge |
| `ArenaKeyMomentSchema` | Key moments in battle |
| `ArenaKillLogEntrySchema` | Kill logs |
| `ArenaMvpSchema` | MVP data |

### Treasury System

| Schema | Description |
|--------|-------------|
| `GuildTreasurySchema` | Gold/dust balance |
| `TreasuryLogEntrySchema` | Transaction log entry |
| `TreasuryDepositRequestSchema` | Deposit resources |
| `TreasuryWithdrawRequestSchema` | Withdraw resources |

### Guild Boss

| Schema | Description |
|--------|-------------|
| `GuildBossSchema` | Boss metadata |
| `GuildBossAttemptSchema` | Individual attempt |
| `GuildBossStatusResponseSchema` | Current boss status |
| `GuildBossAttackResponseSchema` | Attack result |

### Tower Race

| Schema | Description |
|--------|-------------|
| `TowerRaceContributionSchema` | Individual contribution |
| `TowerRaceEntrySchema` | Race entry |
| `TowerRaceLeaderboardResponseSchema` | Race rankings |

---

## Gacha System (`gacha.ts`)

### Configuration

**Hero Gacha**:
| Setting | Value |
|---------|-------|
| Single pull cost | 300 dust |
| Ten pull cost | 2700 dust |
| Pity counter | 50 pulls |
| Spark counter | 100 pulls |

**Artifact Chests**:
| Chest Type | Cost |
|------------|------|
| Common | 100 dust |
| Premium | 300 dust |
| Legendary | 500 dust |
| Weapon | 400 dust |
| Armor | 800 dust |

### Schemas

| Schema | Description |
|--------|-------------|
| `GachaTypeSchema` | hero, artifact |
| `GachaRaritySchema` | common, rare, epic, legendary |
| `HeroGachaPullRequestSchema` | Single or ten pull |
| `HeroGachaPullResultSchema` | Result with rarity and heroId |
| `SparkRedeemRequestSchema` | Redeem spark for hero |
| `UseHeroShardsRequestSchema` | Convert shards to tier |
| `GachaBannerSchema` | Banner metadata |
| `GetActiveBannersResponseSchema` | Active banners list |

---

## Battle Pass (`battlepass.ts`)

### Configuration

| Setting | Value |
|---------|-------|
| Season length | 30 days |
| Total tiers | 50 |
| Points per tier | 100 |
| Free track | Gold, dust, materials, artifacts |
| Premium track | Cosmetics, exclusive hero, dust |

### Schemas

| Schema | Description |
|--------|-------------|
| `BattlePassRewardTypeSchema` | dust, gold, material, artifact, hero, cosmetic |
| `BattlePassRewardSchema` | Tier, track, type, amount |
| `BattlePassSeasonSchema` | Season metadata (dates) |
| `BattlePassProgressSchema` | Player progress (tier, points, claimed) |
| `ClaimBattlePassRewardRequestSchema` | Claim tier reward |
| `BuyBattlePassTiersRequestSchema` | Skip tiers with dust |

---

## Daily Quests (`daily-quests.ts`)

### Quest Definitions

| Quest ID | Target | Dust Reward |
|----------|--------|-------------|
| first_blood | Complete 1 wave | 10 |
| wave_hunter | Complete 50 waves | 25 |
| elite_slayer | Kill 20 elites | 15 |
| boss_slayer | Kill 5 bosses | 20 |
| dedicated | Play 30 minutes | 30 |

**Total daily dust**: 100

### Schemas

| Schema | Description |
|--------|-------------|
| `DailyQuestIdSchema` | Quest identifiers |
| `DailyQuestDefinitionSchema` | Quest config |
| `DailyQuestProgressSchema` | Progress (progress/target, claimed) |
| `DailyQuestsResponseSchema` | All quests with resetAt |
| `ClaimQuestRewardRequestSchema` | Claim single quest |

---

## Pillar Challenge (`pillar-challenge.ts`)

### Enums

| Enum | Values |
|------|--------|
| `PillarIdSchema` | streets, science, mutants, cosmos, magic, gods |
| `PillarChallengeTierSchema` | normal, hard, mythic |
| `CrystalTypeSchema` | power, space, time, reality, soul, mind |

### Loadout Schemas

| Schema | Description |
|--------|-------------|
| `ChallengeHeroConfigSchema` | Hero with level, tier, artifacts |
| `ChallengeTurretConfigSchema` | Turret with slot and level |
| `ChallengeLoadoutSchema` | Full loadout (class, heroes, turrets) |

### Progress Schemas

| Schema | Description |
|--------|-------------|
| `PillarChallengeProgressSchema` | Clears and times per tier |
| `CrystalProgressSchema` | Crystal acquisition progress |
| `StartPillarChallengeRequestSchema` | Begin challenge |
| `SubmitPillarChallengeRequestSchema` | End with events |
| `CraftCrystalRequestSchema` | Craft into usable items |
| `AssembleMatrixResponseSchema` | Combine crystals |

---

## Mastery System (`mastery.ts`)

### Node Types

| Type | Description |
|------|-------------|
| stat_bonus | Passive stat increase |
| synergy_amplifier | Synergy bonus multiplier |
| class_perk | Unique class ability |
| capstone | Tier 5 ultimate ability |

### Schemas

| Schema | Description |
|--------|-------------|
| `MasteryNodeIdSchema` | Node identifier |
| `MasteryTierSchema` | Tiers 1-5 |
| `ClassMasteryProgressSchema` | Points and unlocked nodes per class |
| `PlayerMasteryProgressSchema` | Total points, per-class progress |
| `MasteryNodeDefinitionSchema` | Complete node definition |
| `MasteryTreeDefinitionSchema` | Complete skill tree |
| `UnlockMasteryNodeRequestSchema` | Unlock node |
| `RespecMasteryTreeRequestSchema` | Reset class tree |

---

## Shop System (`shop.ts`)

### Product Types

| Type | Description |
|------|-------------|
| dust | Dust packages |
| starter_pack | Limited starter bundle |
| hero | Premium heroes |
| cosmetic | Visual items |
| battle_pass | Season pass |
| booster | XP/gold/material multipliers |
| convenience | Skip tokens, instant claims |
| gacha | Gacha bundles |
| bundle | Value packages |

### Currencies

`PLN`, `EUR`, `USD`

### Dust Packages

| Package | Dust | Price (PLN) |
|---------|------|-------------|
| Small | 100 | 4.99 |
| Medium | 500 | 19.99 |
| Large | 1000 | 34.99 |
| Mega | 2000 | 59.99 |

### Schemas

| Schema | Description |
|--------|-------------|
| `ShopProductSchema` | Product definition |
| `CreateCheckoutRequestSchema` | Create payment session |
| `PurchaseSchema` | Purchase history entry |
| `BuyWithDustRequestSchema` | In-game currency purchase |
| `ActiveBoosterSchema` | Active booster on player |

---

## Energy System (`energy.ts`)

### Configuration

| Setting | Value |
|---------|-------|
| Max energy | 100 |
| Regen rate | 1 per 3 minutes |
| Premium refill cost | 50 dust |

### Schemas

| Schema | Description |
|--------|-------------|
| `EnergyStatusSchema` | Current/max energy, regen status |
| `RefillEnergyResponseSchema` | Refill result |

---

## API Response Patterns

### Success Response
```typescript
{
  [data]: T,           // Request-specific data
  success?: boolean,
  message?: string
}
```

### Error Response
```typescript
{
  error: string,       // Error code
  message: string      // User-friendly message
}
```

### List Response
```typescript
{
  [items]: T[],
  total: number,
  limit: number,
  offset: number
}
```

### Query Schema Pattern
```typescript
{
  limit: number,       // 1-100
  offset: number,      // Pagination
  filter?: string,     // Search/category
  sortBy?: string,     // Sort field
  ascending?: boolean  // Sort direction
}
```

---

## Schema Versioning

**Current Version**: 2

**Version file**: `version.ts`

**Increment version when**:
- Field types change
- Required fields added
- Enum values removed
- Response structure changes

---

## Type Export Pattern

```typescript
// Schema definition
export const SchemaNameSchema = z.object({ ... });

// Type inference
export type SchemaName = z.infer<typeof SchemaNameSchema>;
```

---

## System Relationships

```
Authentication
└── Auth (credentials, tokens, profile)
    └── Sessions (session management, loadout)
        └── Game Events (player actions)
        └── Power Data (upgrades, progression)

Content & Progression
├── Heroes (unlock, upgrade)
├── Artifacts (craft, equip, fuse)
├── Mastery (skill trees)
├── Power Upgrades (stats, prestige)
└── Pillar Challenges (deterministic mode)

Multiplayer
├── PvP Arena (1v1 battles, honor)
├── Guilds (5v5 battles, treasury, boss)
└── Chat & Messaging

Monetization
├── Shop (products, purchases)
├── Gacha (hero/artifact summons)
├── Battle Pass (seasonal)
└── Boosters (multipliers)

Quality of Life
├── Daily Quests (dust rewards)
├── Energy System (session limits)
├── Idle Rewards (passive income)
├── Leaderboards (rankings)
└── Moderation (mutes, reports)
```
