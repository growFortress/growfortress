# Synergy Visibility System

## Overview

The Synergy Visibility System makes hero synergies discoverable and impactful for players. Instead of hidden bonuses, players can now see:
- Which heroes work together
- What bonuses they get from combinations
- Which synergies they're close to unlocking

## Components

### 1. SynergyPanel (Enhanced)

Located in the game HUD, the SynergyPanel now displays three sections:

**Fortress Class Synergies** (existing)
- Hero-Fortress synergy bonuses
- Turret-Fortress synergy bonuses
- Full synergy bonuses

**Active Hero Synergies** (new)
- Shows currently active pair/trio synergies
- Displays synergy name and all bonus effects
- Green highlighting for active synergies

**Almost Active Synergies** (new)
- Shows synergies that are 1 hero away from activation
- Displays which hero is needed to complete the synergy
- Amber/warning styling to create "near-miss" psychology

### 2. HeroDetailsModal

When viewing hero details, players now see a "Works With" section showing:
- Other heroes that synergize with the selected hero
- The synergy name and bonuses for each combination
- Both pair and trio synergies

### 3. SynergyToast

A celebratory notification that appears when a synergy is activated:

**Features:**
- Centered modal overlay with pop-in animation
- Different styling for pair vs trio synergies (green vs gold)
- Shows synergy name and all bonuses
- Auto-dismisses after 3 seconds
- Queue system for multiple activations
- Only shows once per session per synergy
- Sound effects (ascending chimes for pairs, full chord for trios)

**Styling:**
- Pair synergies: Green border/glow with success colors
- Trio synergies: Gold border/glow with premium feeling

### 4. Audio Feedback

New procedural sounds added to AudioManager:

| Sound ID | Description | Trigger |
|----------|-------------|---------|
| `synergy_unlocked` | Ascending C-E-G chord | Pair synergy activated |
| `synergy_trio` | Full chord + sparkle arpeggio | Trio synergy activated |

## Defined Synergies

### Hero Pair Synergies

| ID | Name | Heroes | Bonuses |
|----|------|--------|---------|
| `storm-forge` | Storm Forge | Storm + Forge | +25% AS |
| `medic-vanguard` | Frontline Support | Medic + Vanguard | +50% heal, +20% DR |
| `pyro-frost` | Thermal Shock | Pyro + Frost | +100% DMG (to debuffed enemies) |
| `storm-frost` | Superconductor | Storm + Frost | +2 chain targets |
| `omega-titan` | Void Resonance | Omega + Titan | +25% DMG, +5% execute |

### Hero Trio Synergies

| ID | Name | Heroes | Bonuses |
|----|------|--------|---------|
| `balanced-squad` | Balanced Squad | Medic + Pyro + Vanguard | +20% DMG, +20% heal, +15% DR |

## API Reference

### sim-core Functions

```typescript
// Get synergies for a specific hero
getHeroSynergies(heroId: string): {
  pairs: Array<HeroPairSynergyDef & { partner: string }>;
  trios: Array<HeroTrioSynergyDef & { partners: string[] }>;
}

// Check active synergies for current hero lineup
getActiveSynergiesForHeroes(heroIds: string[]): {
  active: Array<HeroPairSynergyDef | HeroTrioSynergyDef>;
  almostActive: Array<{
    synergy: HeroPairSynergyDef | HeroTrioSynergyDef;
    missing: string[]
  }>;
}
```

### UI Signals

```typescript
// Show synergy toast (from state/ui.signals.ts)
showSynergyToast(
  synergyId: string,
  name: string,
  bonuses: string[],
  type: 'pair' | 'trio'
): void

// Reset shown synergies for new session
resetShownSynergies(): void

// Active toast data (reactive signal)
activeSynergyToast: Signal<SynergyToastData | null>
```

## Data Types

```typescript
interface HeroPairSynergyDef {
  id: string;
  name: string;
  nameKey: string;           // i18n key
  heroes: [string, string];
  description: string;
  descriptionKey: string;    // i18n key
  bonuses: string[];         // Display strings like "+25% AS"
}

interface HeroTrioSynergyDef {
  id: string;
  name: string;
  nameKey: string;
  heroes: [string, string, string];
  description: string;
  descriptionKey: string;
  bonuses: string[];
}

interface SynergyToastData {
  id: string;
  name: string;
  bonuses: string[];
  type: 'pair' | 'trio';
  timestamp: number;
}
```

## Files

### Core Logic
- `packages/sim-core/src/systems/synergy.ts` - Synergy definitions and calculation

### UI Components
- `apps/web/src/components/game/SynergyPanel.tsx` - Main synergy display panel
- `apps/web/src/components/game/SynergyPanel.module.css` - Panel styles
- `apps/web/src/components/toasts/SynergyToast.tsx` - Toast notification
- `apps/web/src/components/toasts/SynergyToast.module.css` - Toast styles
- `apps/web/src/components/modals/HeroDetailsModal.tsx` - "Works With" section

### State Management
- `apps/web/src/state/ui.signals.ts` - Toast queue and signals

### Audio
- `apps/web/src/game/AudioManager.ts` - Synergy sounds

### Localization
- `apps/web/src/locales/en/common.json` - English strings
- `apps/web/src/locales/pl/common.json` - Polish strings

## Testing

Tests are located in `packages/sim-core/src/__tests__/unit/synergy.test.ts`:

```bash
# Run synergy tests
cd packages/sim-core
npm test -- --run src/__tests__/unit/synergy.test.ts
```

**Test Coverage:**
- `HERO_PAIR_SYNERGIES` data validation
- `HERO_TRIO_SYNERGIES` data validation
- `getHeroSynergies()` function
- `getActiveSynergiesForHeroes()` function
- Edge cases (empty arrays, non-existent heroes)

## Design Philosophy

### "Near-Miss" Psychology
The "Almost Active" section leverages near-miss psychology - when players see they're just one hero away from a synergy, they're more motivated to try that combination.

### Discoverable Depth
New players start with no synergies but gradually discover them as they unlock heroes. The system rewards experimentation and team building.

### Session-Based Toasts
Synergy toasts only show once per session to avoid notification fatigue while still celebrating the achievement on first activation.

## Future Considerations

1. **More Synergies**: Add more pair and trio combinations as new heroes are added
2. **Synergy Skins**: Visual indicators on heroes when synergies are active
3. **Synergy Quests**: Daily/weekly quests to activate specific synergies
4. **Synergy Preview**: Pre-game team builder that shows expected synergies
