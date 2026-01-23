# Ancient Crystals (Starożytne Kryształy)

Collectible endgame artifacts that drop from sector bosses. Collecting all 6 crystals enables the Annihilation Wave ability via the Crystal Matrix.

## Overview

| Crystal | English Name | Polish Name | Color | Primary Effect |
|---------|--------------|-------------|-------|----------------|
| Power | Power Crystal | Kryształ Mocy | Purple (#9932CC) | +50% damage |
| Space | Void Crystal | Kryształ Próżni | Blue (#0000FF) | +100% range |
| Time | Chrono Crystal | Kryształ Czasu | Green (#00FF00) | -50% cooldowns |
| Reality | Matter Crystal | Kryształ Materii | Red (#FF0000) | Adaptive damage |
| Soul | Vitae Crystal | Kryształ Życia | Orange (#FFA500) | 30% lifesteal |
| Mind | Psi Crystal | Kryształ Umysłu | Yellow (#FFFF00) | +50% XP |

---

## Crystal Definitions

### Power Crystal (Kryształ Mocy)

**Color**: Purple | **Glow**: Orchid (#DA70D6)

#### Effects
1. **Stat Boost**: +50% obrażeń wszystkich ataków
2. **Ability - Wybuch Mocy**: Potężny atak obszarowy (cooldown 30s)

#### Drop Locations
| Boss | Pillar | Fragment Chance | Full Crystal Chance |
|------|--------|-----------------|---------------------|
| Corvus Glaive | Cosmos | 2% | 0.2% |
| Ronan | Cosmos | 3% | 0.3% |

#### Fragment Effect
- **Per Fragment**: +10% damage (max 9 fragments = +90% before full crystal)

---

### Void Crystal (Kryształ Próżni)

**Color**: Blue | **Glow**: Sky Blue (#87CEEB)

#### Effects
1. **Stat Boost**: +100% zasięg wszystkich ataków
2. **Ability - Teleport**: Natychmiastowa teleportacja do dowolnego miejsca (cooldown 20s)
3. **Passive - Uderzenie z Próżni**: Ataki ignorują przeszkody

#### Drop Locations
| Boss | Pillar | Fragment Chance | Full Crystal Chance |
|------|--------|-----------------|---------------------|
| Ronan | Cosmos | 2% | 0.2% |

#### Fragment Effect
- **Per Fragment**: +20% range

---

### Chrono Crystal (Kryształ Czasu)

**Color**: Green | **Glow**: Pale Green (#98FB98)

#### Effects
1. **Stat Boost**: -50% cooldown wszystkich umiejętności
2. **Ability - Cofnięcie Czasu**: Cofa czas o 5 sekund (przywraca HP, pozycje) (cooldown 60s)
3. **Passive - Tarcza Temporalna**: 20% szansa na uniknięcie ataku przez "cofnięcie" go

#### Drop Locations
| Boss | Pillar | Fragment Chance | Full Crystal Chance |
|------|--------|-----------------|---------------------|
| Dormammu | Magic | 2% | 0.2% |

#### Fragment Effect
- **Per Fragment**: -10% cooldown

---

### Matter Crystal (Kryształ Materii)

**Color**: Red | **Glow**: Tomato (#FF6347)

#### Effects
1. **Passive - Zmiana Materii**: Ataki zmieniają typ obrażeń na najbardziej efektywny vs cel
2. **Ability - Destabilizacja**: Zamienia wrogów w bezbronne cele na 5s (cooldown 45s)
3. **Stat Boost**: +50% szansa na lepsze dropy (luck)

#### Drop Locations
| Boss | Pillar | Fragment Chance | Full Crystal Chance |
|------|--------|-----------------|---------------------|
| Dormammu | Magic | 2% | 0.2% |

#### Fragment Effect
- **Per Fragment**: +10% luck

---

### Vitae Crystal (Kryształ Życia)

**Color**: Orange | **Glow**: Gold (#FFD700)

#### Effects
1. **Stat Boost**: 30% lifesteal z wszystkich ataków
2. **Ability - Odrodzenie**: Wskrzesza jednostkę z 50% HP po śmierci (raz na sektor)
3. **Passive - Wzmocnione Zmysły**: Widzi ukrytych wrogów i ich słabe punkty (+15% crit)

#### Drop Locations
| Boss | Pillar | Fragment Chance | Full Crystal Chance |
|------|--------|-----------------|---------------------|
| Hela | Gods | 2% | 0.2% |

#### Fragment Effect
- **Per Fragment**: +6% lifesteal

---

### Psi Crystal (Kryształ Umysłu)

**Color**: Yellow | **Glow**: Lemon Chiffon (#FFFACD)

#### Effects
1. **Passive - Tarcza Mentalna**: +100% odporność na kontrolę umysłu i stun
2. **Ability - Kontrola Umysłu**: Przejmuje kontrolę nad wrogiem na 10s (cooldown 30s)
3. **Stat Boost**: +50% XP zdobywanego przez jednostkę

#### Drop Locations
| Boss | Pillar | Fragment Chance | Full Crystal Chance |
|------|--------|-----------------|---------------------|
| Ultron | Science | 2% | 0.2% |

#### Fragment Effect
- **Per Fragment**: +10% XP

---

## Fragment System

- **10 fragments = 1 full crystal**
- Each fragment gives partial stat bonus (1/10 of full effect)
- **Dust cost to buy full crystal**: 10,000 dust each
- **Transfer cost between units**: 500 gold

### Fragment Sources

| Source | Type | Notes |
|--------|------|-------|
| Boss Drops | Random | 2% chance per boss kill |
| Pillar Challenge | Deterministic | Guaranteed fragments based on tier |
| Shop | Purchase | 10,000 dust per full crystal |

---

## Crystal Matrix (Matryca Kryształów)

Special artifact that enables Annihilation Wave when equipped with all 6 crystals.

### Requirements
- Commander Level 40+
- Tier 3 unit (APEX)
- All 6 Ancient Crystals
- Crystal Matrix artifact

### Full Set Bonus
- **+200% all stats**
- All crystal effects active simultaneously

### Annihilation Wave (Fala Anihilacji)
- **Effect**: Deals 30% of max HP to ALL enemies on screen
- **Cooldown**: 25 waves (unit unavailable during cooldown)

---

## Boss Crystal Drops

### By Pillar

| Pillar | Boss 1 | Boss 2 | Crystal Drops |
|--------|--------|--------|---------------|
| Streets | Kingpin | Bullseye | - |
| Science | Ultron | M.O.D.O.K. | Mind (Psi) |
| Mutants | Master Mold | Nimrod | - |
| Cosmos | Corvus Glaive | Ronan | Power, Void |
| Magic | Dormammu | Baron Mordo | Chrono, Matter |
| Gods | Hela | Surtur | Vitae |

### Crystal Drop Mapping

| Crystal | Primary Boss | Secondary Boss |
|---------|--------------|----------------|
| Power | Ronan | Corvus Glaive |
| Space | Ronan | - |
| Time | Dormammu | - |
| Reality | Dormammu | - |
| Soul | Hela | - |
| Mind | Ultron | - |

---

## Matrix Crystal Slots

The Crystal Matrix has 6 slots arranged in a specific order:

```
    [1. Power]    [2. Void]
         \          /
          [6. Mind]
         /          \
    [5. Time]    [3. Matter]
         \          /
         [4. Vitae]
```

| Slot | Crystal Type |
|------|--------------|
| 1 | Power |
| 2 | Space (Void) |
| 3 | Reality (Matter) |
| 4 | Soul (Vitae) |
| 5 | Time (Chrono) |
| 6 | Mind (Psi) - Center |

---

## Crystal Progression Strategy

### Early Game (Level 1-30)
- Focus on farming fragments from accessible bosses
- Don't spend dust on crystals - save for unit upgrades

### Mid Game (Level 30-50)
- Start completing Pillar Challenges for guaranteed fragments
- Target specific crystals based on your build

### Late Game (Level 50+)
- Complete fragment sets for full crystals
- Consider purchasing missing crystals with dust
- Work toward Crystal Matrix requirements

### Crystal Priority by Build

| Build Type | Priority Crystals |
|------------|-------------------|
| DPS | Power, Time, Mind |
| Tank | Soul, Reality |
| Support | Time, Soul, Mind |
| Economy | Mind, Reality |
