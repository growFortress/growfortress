# Boss Rush Roguelike Mode

## Overview

Boss Rush has been transformed into a full roguelike experience where every decision matters. After each boss kill, players enter an intermission phase where they can:

1. **Choose a Relic** - Pick from 3 offered relics to build your run
2. **Visit the Shop** - Spend gold on healing, stat boosts, or relic rerolls
3. **Prepare for the next boss** - 10 seconds of strategic decision-making

## Core Mechanics

### Extended Intermission (300 ticks / 10 seconds)

The intermission between bosses has been extended from 3 seconds to 10 seconds, giving players time to:
- Review relic options
- Consider shop purchases
- Plan their build strategy

### Relic Selection Every Wave

After killing each boss, 3 relics are offered. Players must choose one before the next boss spawns. This creates meaningful build decisions every wave.

**Key functions:**
- `chooseBossRushRelic(state, relicId)` - Select a relic from available options
- `rerollBossRushRelics(state, newOptions)` - Replace current options (costs gold)

### Shop System

The shop offers items purchasable with gold earned from killing bosses.

**Available Items:**

| Item | Cost | Type | Effect |
|------|------|------|--------|
| Minor Repair | 100g | Heal | +25% max HP |
| Major Repair | 250g | Heal | +50% max HP |
| Relic Reroll | 75g | Reroll | New relic options |
| Power Cell | 200g | Stat Boost | +10% damage |
| Overclocker | 175g | Stat Boost | +15% attack speed |
| Precision Module | 225g | Stat Boost | +5% crit chance |
| Reinforced Core | 150g | Heal | +15% max HP |

**Key functions:**
- `purchaseBossRushShopItem(state, itemId, fortressHp, fortressMaxHp)` - Purchase a shop item
- `getAvailableGold(state)` - Get current spendable gold

## State Tracking

The `BossRushState` now tracks roguelike-specific data:

```typescript
interface BossRushState {
  // ... existing fields ...

  // Roguelike additions
  relicOptions: string[];           // Current relic choices
  relicChosen: boolean;             // Has player chosen this wave's relic
  collectedRelics: string[];        // All relics acquired this run
  rerollsUsed: number;              // Total rerolls purchased
  shopPurchases: Record<string, number>;  // Item purchase counts
  shopStatBoosts: {
    damageBonus: number;
    attackSpeedBonus: number;
    critChance: number;
  };
  synergiesActivated: number;       // Synergies triggered
  synergyDamage: Record<string, number>; // Damage per synergy
  bestSingleHit: number;            // Highest single damage instance
  totalHealing: number;             // Total HP healed from shop
  goldSpent: number;                // Total gold spent
}
```

## Events

### CHOOSE_RELIC Event

Players send this event to select a relic during intermission.

```typescript
{
  type: 'CHOOSE_RELIC',
  tick: number,
  relicId: string  // The ID of the chosen relic
}
```

### REROLL_RELICS Event

Players send this event to reroll relic options (costs gold).

```typescript
{
  type: 'REROLL_RELICS',
  tick: number
}
```

### SHOP_PURCHASE Event

Players send this event to purchase a shop item.

```typescript
{
  type: 'SHOP_PURCHASE',
  tick: number,
  itemId: string  // The shop item ID to purchase
}
```

## Summary Stats

The `BossRushSummary` now includes roguelike statistics:

```typescript
interface BossRushSummary {
  // ... existing fields ...

  // Roguelike stats
  collectedRelics: string[];
  rerollsUsed: number;
  shopPurchases: Record<string, number>;
  synergiesActivated: number;
  synergyDamage: Record<string, number>;
  bestSingleHit: number;
  totalHealing: number;
}
```

## Integration with Synergies

The roguelike mode synergizes with the synergy system:
- `synergiesActivated` tracks how many synergies triggered
- `synergyDamage` records damage per synergy type
- Relics can enhance synergy effects

## Files Modified

- `packages/sim-core/src/boss-rush.ts` - Core roguelike logic
- `packages/sim-core/src/boss-rush-simulation.ts` - Event handling
- `packages/protocol/src/events.ts` - New event schemas
- `packages/sim-core/src/events.ts` - Event validation/application

## Usage Example

```typescript
import {
  createBossRushState,
  chooseBossRushRelic,
  purchaseBossRushShopItem,
  getAvailableGold,
  BOSS_RUSH_SHOP_ITEMS
} from '@arcade/sim-core';

// Create initial state
const state = createBossRushState(Date.now());

// After boss is killed and intermission starts...
// state.relicOptions = ['relic_iron_skin', 'relic_swift_strike', 'relic_gold_rush']

// Player chooses a relic
chooseBossRushRelic(state, 'relic_swift_strike');

// Player buys healing
const goldAvailable = getAvailableGold(state);
if (goldAvailable >= 100) {
  const result = purchaseBossRushShopItem(state, 'heal_small', 500, 1000);
  if (result.success) {
    console.log(`Healed to ${result.newFortressHp} HP`);
  }
}

// Player buys damage boost
const damageResult = purchaseBossRushShopItem(state, 'damage_boost', 750, 1000);
if (damageResult.success && damageResult.statBonus) {
  console.log(`Gained ${damageResult.statBonus.value * 100}% ${damageResult.statBonus.stat}`);
}
```

## Future Enhancements

1. **Weekly Seed Leaderboards** - Same seed for all players, fair competition
2. **Run Stats Screen** - Detailed breakdown after death
3. **Meta-progression** - Unlock permanent bonuses between runs
4. **Daily Challenges** - Special modifiers for variety

---

*Part of the Grow Fortress Strategic Pivot - Week 3-4 Roguelike Mode*
