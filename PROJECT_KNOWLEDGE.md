# Grow Fortress: Age of Super Hero - Dokumentacja Architektury

## Spis Treści
1. [Przegląd Projektu](#przegląd-projektu)
2. [Architektura Techniczna](#architektura-techniczna)
3. [Silnik Symulacji](#silnik-symulacji)
4. [Systemy Gry](#systemy-gry)
5. [Dane Gry](#dane-gry)
6. [Frontend](#frontend)
7. [Backend](#backend)
8. [Protokół Komunikacji](#protokół-komunikacji)
9. [Tryby Gry](#tryby-gry)
10. [Systemy Progresji](#systemy-progresji)

---

## Przegląd Projektu

**Grow Fortress: Age of Super Hero** to mid-core'owa gra tower defense z zarządzaniem jednostkami, inspirowana uniwersum superbohaterów.

### Główny Hook
- **Hybryda TD + RPG**: Gracze nie tylko stawiają wieżyczki, ale aktywnie zarządzają drużyną 4 bohaterów z unikalnymi skillami
- **Progresja superbohaterów**: 13 bohaterów z 3-poziomowym systemem tier (Basic → Epic → Legendary) odblokowującym nowe umiejętności
- **6 tematycznych filarów**: Streets, Science, Mutants, Cosmos, Magic, Gods - każdy z unikalnymi przeciwnikami i mechanikami
- **Systemy synergii**: Bonusy za dopasowanie klas bohaterów, turretów i aur twierdzy
- **Crafting artefaktów**: 68+ artefaktów z systemem fuzji, demontażu i socketów

---

## Architektura Techniczna

### Struktura Monorepo

```
arcade/
├── apps/
│   ├── server/          # Backend Fastify
│   └── web/             # Frontend Preact + PixiJS
├── packages/
│   ├── sim-core/        # Deterministyczny silnik symulacji
│   └── shared/          # Współdzielone typy i narzędzia
```

### Kluczowe Zasady Architektury

1. **Determinizm**: Symulacja jest w 100% deterministyczna - ten sam seed + input = identyczny wynik
2. **Fixed-Point Math**: Wszystkie obliczenia używają Q16.16 fixed-point (moduł FP) zamiast float
3. **Seeded RNG**: Xorshift32 z seedem przekazywanym z serwera
4. **Tick-based**: 30Hz tick rate (33.33ms per tick)
5. **Segment Verification**: Serwer weryfikuje segmenty gry przez hash comparison (anti-cheat)

---

## Silnik Symulacji

### Lokalizacja: `packages/sim-core/src/simulation.ts` (1947 linii)

### 6-Fazowy Cykl Aktualizacji

```typescript
step(dt: number): void {
  // Faza 1: EVENTS - przetwarzanie inputów gracza
  this.processEvents();

  // Faza 2: AI - aktualizacja bohaterów, turretów, milicji
  updateHeroes(state, config, rng);
  updateTurrets(state, config, rng);
  updateMilitia(state, config);

  // Faza 3: PHYSICS - ruch wrogów, kolizje, ściany
  this.updateEnemies();
  updateWalls(state);

  // Faza 4: PROJECTILES - ruch pocisków, trafienia
  updateProjectiles(state, config, rng);
  updateEnemyStatusEffects(state);

  // Faza 5: DAMAGE - obliczenia obrażeń, efekty
  this.updateFortressAttack();
  updateFortressSkills(state, config, rng);
  updateFortressAuras(state, config);
  updateEnemyAbilities(state, config, rng);

  // Faza 6: CLEANUP - usuwanie martwych, spawn nowych fal
  this.cleanupDeadEnemies();
  this.updateWaves();
  this.checkGameOver();
}
```

### Kluczowe Stałe

```typescript
tickHz = 30                    // 30 ticków na sekundę
waveIntervalTicks = 90         // 3 sekundy między falami
skillCooldownTicks = 300       // 10 sekund cooldown skilli
fortressAttackInterval = 30    // 1 atak twierdzy na sekundę
```

### System Fal

- Wrogowie spawnują się w falach z rosnącą trudnością
- Każda fala ma określoną liczbę i typy wrogów
- Boss waves co określoną liczbę fal
- Wave completion triggers: nagrody, bonus HP, progresja

---

## Systemy Gry

### 1. System Bohaterów (`systems/hero.ts` - 863 linie)

#### Maszyna Stanów AI
```
idle → combat → commanded
  ↑       ↓         ↓
  └───────┴─────────┘
```

- **idle**: Bohater szuka wrogów w zasięgu
- **combat**: Aktywna walka z wybranym celem
- **commanded**: Wykonywanie polecenia gracza (move/attack)

#### Fizyka Ruchu
- Steering behaviors z separation force
- Kolizje między bohaterami
- Arrival radius dla smooth stopping

#### Pasywne Umiejętności
| Pasywka | Efekt |
|---------|-------|
| `void_absorption` | Absorbuje obrażenia, konwertuje na damage |
| `burning_heart` | Zwiększa damage przy niskim HP |
| `hunter_instinct` | Bonus damage do osłabionych wrogów |
| `command_aura` | Buff dla pobliskich sojuszników |
| `elemental_mastery` | Wzmocnienie efektów elementalnych |

#### Progresja Tier
```
Basic (Tier 0) → Epic (Tier 1) → Legendary (Tier 2)
     ↓                ↓               ↓
  2 skille       +2 skille       +2 skille
  Base stats     +50% stats      +100% stats
```

### 2. System Turretów (`systems/turret.ts` - 325 linii)

#### 5 Trybów Celowania
1. `closest_to_fortress` - Wróg najbliżej twierdzy (domyślny)
2. `weakest` - Wróg z najniższym HP
3. `strongest` - Wróg z najwyższym HP
4. `nearest_to_turret` - Najbliższy turretowi
5. `fastest` - Wróg z najwyższą prędkością

#### 4 Typy Turretów
| Turret | Specialność |
|--------|-------------|
| Railgun | Wysoki single-target damage |
| Artillery | AoE splash damage |
| Arc | Chain lightning |
| Cryo | Slow + freeze effects |

#### System Overcharge
- **Aktywacja**: Manualna przez gracza
- **Efekt**: 2x damage, 1.5x attack speed
- **Czas trwania**: 5 sekund (150 ticków)
- **Cooldown**: 60 sekund (1800 ticków)

#### Specjalne Umiejętności Turretów
- `damage_boost` - Buff własnego damage
- `aoe_attack` - Atak wszystkich w zasięgu
- `chain_all` - Chain do wszystkich wrogów
- `freeze_all` - Zamrożenie wszystkich
- `buff_allies` - Buff bohaterów
- `poison_all` - Poison DoT na wszystkich

### 3. System Pocisków (`systems/projectile.ts` - 728 linii)

#### Ray-March Hit Detection
- Deterministyczny system wykrywania trafień
- Interpolacja pozycji dla smooth collision
- Pierce mechanic (twierdza: 3 pierce)

#### Efekty Statusów
| Efekt | Działanie |
|-------|-----------|
| `slow` | Zmniejsza prędkość ruchu |
| `burn` | DoT fire damage |
| `poison` | DoT poison damage |
| `freeze` | Całkowite zatrzymanie ruchu |
| `stun` | Zatrzymanie ruchu + ataków |
| `armor_break` | Zwiększone otrzymywane obrażenia |

#### Chain Lightning (Storm)
- 2-3 cele w chain
- 70-80% damage decay per jump
- Priorytet: najbliższe cele

### 4. System Combo (`systems/combos.ts`)

#### Zdefiniowane Combo
| Combo | Trigger | Efekt |
|-------|---------|-------|
| Steam Burst | Fire + Ice | AoE explosion |
| Electrocute | Lightning + Water | Stun + bonus damage |
| Shatter | Ice + Physical | Critical hit |

### 5. System Synergii (`systems/synergy.ts`)

#### Synergie Klas
- Dopasowanie klas bohaterów daje global bonus
- 2+ tej samej klasy = 10% bonus
- 3+ = 20%, 4 = 30%

#### Adjacency Bonus (Turrety)
- Sąsiadujące turrety tej samej klasy
- +5% damage, +5% attack speed per adjacent

### 6. System Aur Twierdzy (`systems/fortress-auras.ts`)

- Pasywne bonusy w określonym promieniu
- Stackujące się efekty
- Cache invalidation przy zmianach

### 7. System Ścian (`systems/walls.ts`)

- Placeable barriers
- Blokują ruch wrogów
- HP-based destruction
- Collision detection

### 8. System Milicji (`systems/militia.ts`)

- Spawnable units
- Squad-based deployment
- Temporary allies

### 9. Umiejętności Wrogów (`systems/enemy-abilities.ts`)

#### Specjalne Typy Wrogów
- Shielded enemies (damage reduction)
- Sappers (bonus vs buildings)
- Healers (heal nearby)
- Summoners (spawn minions)

---

## Dane Gry

### Lokalizacja: `packages/sim-core/src/data/`

### Bohaterowie (13 postaci)

| Bohater | Klasa | Specjalność |
|---------|-------|-------------|
| Iron Knight | Tech | Tanky, armor buffs |
| Storm | Mutant | Chain lightning |
| Void Walker | Cosmic | Teleport, void damage |
| Flame | Science | Fire DoT, AoE |
| Frost | Mutant | Slow, freeze |
| Shadow | Street | Stealth, crit |
| Guardian | Cosmic | Shield, protect |
| Berserker | Street | Rage, lifesteal |
| Sage | Magic | Buffs, debuffs |
| Archer | Street | Range, pierce |
| Healer | Magic | Heal, cleanse |
| Summoner | Magic | Summon minions |
| Titan | Cosmic | High HP, slam |

### Wrogowie (29 typów, 6 filarów)

#### Filary
1. **Streets** - Gang members, thugs
2. **Science** - Robots, experiments
3. **Mutants** - Mutated creatures
4. **Cosmos** - Aliens, cosmic beings
5. **Magic** - Demons, sorcerers
6. **Gods** - Divine entities

### Reliki (~39, 8 kategorii)

- Offensive relics
- Defensive relics
- Utility relics
- Resource relics
- Combo relics
- Synergy relics
- Boss relics
- Legendary relics

---

## Frontend

### Lokalizacja: `apps/web/`

### Stack Technologiczny
- **Framework**: Preact (React-like, mniejszy bundle)
- **Rendering**: PixiJS (WebGL 2D)
- **State Management**: Preact Signals
- **Bundler**: Vite

### Kluczowe Komponenty

#### GameApp.ts
- Orchestrator PixiJS
- Scene management
- Asset loading

#### GameScene.ts
- Layered rendering pipeline
- Entity management
- Camera controls

#### System Sygnałów (11+ modułów)
```
signals/
├── game.signals.ts       # Stan gry
├── heroes.signals.ts     # Bohaterowie
├── turrets.signals.ts    # Turrety
├── enemies.signals.ts    # Wrogowie
├── combat.signals.ts     # Walka
├── resources.signals.ts  # Zasoby
├── ui.signals.ts         # UI state
├── settings.signals.ts   # Ustawienia
└── ...
```

#### System Modali (30+ lazy-loaded)
- HeroModal
- TurretModal
- InventoryModal
- CraftingModal
- ShopModal
- SettingsModal
- ...

#### System VFX
- **ParticlePool**: 2000 particles max
- Efekty: explosions, projectile trails, hit effects
- Optimized batching

---

## Backend

### Lokalizacja: `apps/server/`

### Stack Technologiczny
- **Framework**: Fastify (Node.js)
- **ORM**: Prisma
- **Database**: PostgreSQL
- **Cache**: Redis
- **Queue**: Bull

### Struktura Routes (33+ modułów)

```
routes/
├── auth/           # Autentykacja
├── game/           # Core gameplay
├── heroes/         # Hero management
├── turrets/        # Turret management
├── inventory/      # Inventory system
├── crafting/       # Crafting system
├── shop/           # In-game shop
├── guild/          # Guild system
├── pvp/            # PvP arena
├── idle/           # Idle rewards
├── leaderboard/    # Rankings
└── ...
```

### Autentykacja
- **JWT**: Access token (15 min) + Refresh token (7 dni)
- Session management
- Rate limiting per endpoint

### Anti-Cheat System

#### Segment Verification
```typescript
// Klient wysyła:
{
  segmentIndex: number,
  hash: string,
  finalState: GameState
}

// Serwer:
1. Replay segment z zapisanymi inputami
2. Oblicz własny hash
3. Porównaj z hashem klienta
4. Odrzuć jeśli mismatch
```

#### Checkpoint Hashing
- Periodic state snapshots
- Hash comparison
- Replay validation

---

## Protokół Komunikacji

### Lokalizacja: `packages/shared/`

### Validation: Zod Schemas
```typescript
const GameEventSchema = z.discriminatedUnion('type', [
  HeroMoveEventSchema,
  TurretPlaceEventSchema,
  SkillActivateEventSchema,
  // ...
]);
```

### WebSocket Events
- Real-time game updates
- Bi-directional communication
- Heartbeat/keepalive

### Session Management
```typescript
interface GameSession {
  sessionId: string;
  seed: number;           // RNG seed
  startedAt: number;
  config: SimConfig;
  events: GameEvent[];
}
```

---

## Tryby Gry

### 1. Endless Mode
- Nieskończone fale
- Rosnąca trudność
- Leaderboard ranking
- High score chase

### 2. Boss Rush
- Sekwencja bossów
- Limited lives
- Speed bonuses
- Special rewards

### 3. PvP Arena
- Asynchronous battles
- Ranking system
- Seasonal rewards
- Matchmaking

### 4. Pillar Challenge
- Per-pillar challenges
- Unique modifiers
- Mastery rewards
- Unlock progression

### 5. Idle Mode
- Offline progression
- Auto-battle
- Resource generation
- Time-limited bonuses

---

## Systemy Progresji

### 1. System Artefaktów (68+ artefaktów)

#### Rarities
- Common (biały)
- Uncommon (zielony)
- Rare (niebieski)
- Epic (fioletowy)
- Legendary (pomarańczowy)

#### 3-Slot System
Każdy bohater ma 3 sloty na artefakty:
- Slot 1: Weapon
- Slot 2: Armor
- Slot 3: Accessory

#### Crafting System
```
Materials + Blueprint → Artifact
Artifact + Artifact → Upgraded Artifact (Fusion)
Artifact → Materials (Dismantle)
```

### 2. System Materiałów (18 typów)

#### Kategorie
- **Basic**: Common drops
- **Elemental**: Fire, Ice, Lightning, etc.
- **Rare**: Boss drops
- **Legendary**: Event drops

#### Sources
- Enemy drops
- Boss kills
- Daily rewards
- Crafting dismantle
- Shop purchases

### 3. System Kryształów (Infinity Stones)

#### 6 Kryształów
1. **Power Crystal** - Damage boost
2. **Time Crystal** - Cooldown reduction
3. **Space Crystal** - Range increase
4. **Mind Crystal** - XP boost
5. **Soul Crystal** - Lifesteal
6. **Reality Crystal** - Crit chance

#### Crystal Matrix
- Kombinacja wszystkich 6 kryształów
- Odblokowuje "Annihilation Wave" - ultimate ability
- Massive AoE damage + temporary invincibility

### 4. System Bohaterów

#### Unlock Methods
- Story progression
- Shop purchase
- Gacha/summon
- Event rewards

#### Leveling
- XP from battles
- Level cap per tier
- Stat scaling

#### Skills
- 2 skille per tier
- 6 skilli total (Tier 2)
- Cooldown-based
- Upgradeable

### 5. System Twierdzy

#### Fortress Classes
- Defender (HP focus)
- Striker (Damage focus)
- Support (Buff focus)
- Balanced

#### Power Upgrades
- Fortress HP
- Fortress Damage
- Fortress Attack Speed
- Aura Range
- Skill Power

#### Presets
- Save/load configurations
- Hero + Turret layouts
- Quick swap

#### Commander Level
- Global progression
- Permanent bonuses
- Unlock content

---

## Podsumowanie Techniczne

### Mocne Strony Architektury

1. **Determinizm** - Umożliwia replay, anti-cheat, debugging
2. **Modularność** - Systemy są niezależne i łatwe do testowania
3. **Skalowalność** - Architektura przygotowana na rozszerzenia
4. **Performance** - Fixed-point math, object pooling, batching

### Kluczowe Pliki do Dalszej Analizy

| Plik | Cel |
|------|-----|
| `simulation.ts` | Core game loop |
| `systems/hero.ts` | Hero AI & combat |
| `systems/turret.ts` | Turret targeting |
| `systems/projectile.ts` | Hit detection |
| `data/heroes.ts` | Hero definitions |
| `data/enemies.ts` | Enemy definitions |
| `routes/game/` | Server game logic |

---

## Schemat Bazy Danych

### Lokalizacja: `apps/server/prisma/schema.prisma`

**Baza danych**: PostgreSQL
**Migracje**: 35+ plików migracji (styczeń 2026)

### Kluczowe Modele (60+)

#### System Użytkowników
```
User
├── Authentication: username, email, passwordHash, role
├── Progression: currentWave, highestWave, level
├── Referrals: referralCode, referredById
├── Guest Mode: isGuest, guestExpiresAt
├── Loadout: defaultFortressClass, defaultHeroId, buildPresets
├── PvP: pvpWins, pvpLosses, honor
└── Localization: country, preferredCurrency
```

#### Powiązane Modele 1:1
| Model | Opis |
|-------|------|
| `Inventory` | gold, dust, materials (JSON), unlockedHeroIds[] |
| `Progression` | level, xp, purchasedHeroSlots, purchasedTurretSlots |
| `PowerUpgrades` | fortressUpgrades, heroTiers, turretPrestige (JSON) |
| `MasteryProgress` | availablePoints, classProgress (JSON) |
| `ColonyProgress` | colonyLevels, lastClaimAt, pendingGold |
| `CrystalProgress` | fragmenty (6 typów), fullCrystals[], matrixAssembled |
| `UserEnergy` | currentEnergy, maxEnergy, lastRegenAt |
| `GachaProgress` | heroPityCount, heroSparkCount, heroShards |

#### System Sesji Gry
```
GameSession
├── seed, startedAt, lastActivityAt
├── currentWave, lastVerifiedWave
├── lastSegmentHash, configJson
└── Segment[] (startWave, endWave, eventsJson, finalHash, verified)
```

#### System Gildii
```
Guild
├── name, tag (unique), description
├── Structures: Kwatera, Skarbiec, Akademia, Zbrojownia (0-20)
├── honor (ELO), trophies[]
└── Relations: members[], battles[], treasury, chat[]
```

#### Inne Kluczowe Modele
- `GuildBattle`, `GuildBattleResult` - 5v5 Arena
- `PvpChallenge`, `PvpResult` - PvP 1v1
- `ShopPurchase`, `GachaPull`, `GachaBanner` - Monetyzacja
- `LeaderboardEntry`, `WeeklyPlayerLeaderboard` - Rankingi
- `MessageThread`, `Message`, `ChatMessage` - Komunikacja
- `TelemetryEvent`, `MetricSnapshot`, `SystemError` - Analytics

---

## System Ekonomii

### Waluty

| Waluta | Typ | Źródła |
|--------|-----|--------|
| **Gold** | Soft | Runy, idle, questy, nagrody |
| **Dust** | Premium | Questy, idle, zakup |
| **Spark** | Gacha pity | 1 per pull, 100 = wybór bohatera |
| **Shards** | Duplikaty | Duplikaty gacha → upgrade tier |

### System Energii

```
Max Energy: 50
Regen Rate: 1 / 10 minut
Cost per Wave: 1 energia
Refill Cost: 30 dust
```

### Daily Quests (5 questów/dzień)

| Quest | Cel | Dust | Gold |
|-------|-----|------|------|
| First Blood | 1 run | 5 | 50 |
| Dedicated | 5 runs | 8 | 100 |
| Wave Hunter | 300 kills | 7 | 150 |
| Elite Slayer | 10 elites | 5 | 200 |
| Boss Slayer | 2 bosses | 5 | 300 |
| **Total** | - | **30** | **800** |

### Idle Rewards

```
Max Accrual: 8 godzin
Min Claim Interval: 5 minut

Materials:
  Base: 0.75 drops/h (level 1)
  Scaling: +0.03 per level

Dust:
  Base: 1 dust/h (level 1)
  Scaling: +0.05 per level
  8h at level 1 = 8 dust
```

### Shop (Stripe)

**Dust Packages:**
- Mini: 100 dust @ 4.99 PLN
- Small: 450 dust @ 19.99 PLN
- Large: 1200 dust @ 49.99 PLN
- Mega: 2800 dust @ 99.99 PLN

**Bundles:**
- Starter Pack: 600 dust + 3000 gold @ 20 PLN (one-time)
- Bronze: 250 dust + 2000 gold + 3 artifacts @ 29.99 PLN
- Silver: 700 dust + 5000 gold + 1 hero @ 69.99 PLN
- Gold: 1500 dust + 12000 gold + 2 heroes @ 119.99 PLN

**Boosters (3h, 1.5x):**
- XP: 110 dust
- Gold: 110 dust
- Material: 150 dust
- Ultimate: 300 dust

---

## System Gildii

### Tworzenie i Dołączanie

**Access Modes:**
1. **OPEN** - Bezpośrednie dołączenie
2. **INVITE_ONLY** - Zaproszenia (48h expiry)
3. **APPLY** - Aplikacje (48h expiry, max 3 aktywne)

### Role i Uprawnienia

| Akcja | Leader | Officer | Member |
|-------|--------|---------|--------|
| manage | ✓ | ✗ | ✗ |
| invite | ✓ | ✓ | ✗ |
| kick | ✓ | ✓ | ✗ |
| battle | ✓ | ✓ | ✗ |
| withdraw | ✓ | ✗ | ✗ |

### Guild Battles (5v5 Arena)

```
Format: 5v5 Instant Attack
Selection: Attacker wybiera, Defender auto-top5
Resolution: Natychmiastowa (seed-based simulation)

Limits:
  - Max 5 ataków/dzień (atakujący)
  - Max 10 ataków/dzień (broniący)
  - 12h cooldown na tego samego przeciwnika

Honor System (ELO):
  K-factor: 32
  Underdog bonus: 1.2x
  Minimum: 1000
```

### Shield Protection
- Czas: 24h
- Koszt: 5000 gold
- Limit: 2/tydzień
- Blokuje ataki i bycie atakowanym

### Struktury Gildii

| Struktura | Efekt per Level | Max |
|-----------|-----------------|-----|
| Kwatera | +1 member capacity | 30 |
| Skarbiec | +1% gold bonus | 20% |
| Akademia | +1% XP bonus | 20% |
| Zbrojownia | +1% stat bonus | 20% |

### Dodatkowe Systemy

- **Treasury**: Gold, Dust, Guild Coins z audit logiem
- **Tower Race**: Tygodniowy wyścig fal z medalami
- **Guild Boss**: 50M HP boss, 1 atak/dzień/gracz
- **Trophies**: Achievementy (FIRST_BLOOD, WIN_STREAK_5, etc.)
- **Chat**: Real-time, max 10 msg/min, moderacja

---

## System Gacha

### Koszty Pulls

```
Single Pull: 300 Dust
Ten Pull: 2700 Dust (10% zniżka)
```

### Drop Rates (Hero Gacha)

| Rarity | Szansa |
|--------|--------|
| Common | 60% |
| Rare | 30% |
| Epic | 8% |
| Legendary | 2% |

### Pity System

```
Pity Threshold: 50 pulls
  → Gwarantowany Epic+ (80% Epic, 20% Legendary)
  → Reset na Epic+ pull

Spark Threshold: 100 pulls
  → Wybór DOWOLNEGO bohatera
  → 1 spark per pull
```

### Shard Conversion (Duplikaty)

| Rarity | Shards |
|--------|--------|
| Common | 50 |
| Rare | 100 |
| Epic | 200 |
| Legendary | 500 |

**100 shards = 1 tier upgrade**

### Banner System

- Czas aktywacji (startsAt → endsAt)
- Featured items z rate-up (domyślnie 2.0x)
- Priority ordering (wyższy = pierwszy)
- Typy: HERO, ARTIFACT

### Artifact Gacha

| Chest | Koszt | Rates |
|-------|-------|-------|
| Common | 100 dust | 70% C, 25% R, 5% E |
| Premium | 300 dust | 40% R, 45% E, 15% L |
| Legendary | 800 dust | 100% Legendary |

---

## System Analytics

### Damage Attribution

```typescript
interface DamageAttribution {
  ownerType: 'hero' | 'turret' | 'fortress' | 'system'
  ownerId: string  // np. 'storm', 'arc_turret'
  mechanicType: 'basic' | 'skill' | 'ability' | 'dot'
  mechanicId: string  // np. 'storm_burst', 'burn'
}
```

Enkodowanie: `ownerType|ownerId|mechanicType|mechanicId`

### Wave-Level Analytics

```typescript
interface WaveStats {
  waveNumber, durationTicks
  enemiesSpawned, enemiesKilled, enemiesLeaked
  fortressDamageTaken, fortressHealthEnd
  totalDamageDealt

  // Agregaty
  damageBySource: Record<DamageSourceType, number>
  damageByHero: Record<string, number>
  damageByTurret: Record<string, number>
  damageByAttribution: Record<string, number>

  economy: { goldEarned, goldSpent, dustEarned, dustSpent }
}
```

### Telemetry Events

| Event | Opis |
|-------|------|
| RUN_STARTED | Start sesji |
| RUN_FINISHED | Koniec sesji |
| WAVE_COMPLETED | Fala ukończona |
| ENEMY_KILLED | Wróg zabity |
| SKILL_USED | Skill użyty |
| CLIENT_ERROR | Błąd klienta |

**Batch processing**: Max 100 events/request

### Server Metrics

```
CCU (Concurrent Users) - aktywni w ostatnich 2 min
Active Sessions
Error Count (last hour)
Response Time: avg, P50, P95, P99, max
Queue: waiting, active, delayed, failed
```

### Alert Thresholds

- Error rate: 10 errors/min → Warning
- P95 response: ≥2000ms → Warning, ≥5000ms → Critical
- Webhook notifications

---

## Infrastruktura Testów

### Frameworki

| Framework | Użycie |
|-----------|--------|
| **Vitest** | Unit + Integration tests |
| **Playwright** | E2E tests |

### Struktura Testów

```
apps/server/src/__tests__/
├── helpers/
│   ├── setup.ts          # Global mocks
│   ├── testApp.ts        # Fastify test builder
│   └── mockAuthPlugin.ts # Auth bypass
├── mocks/
│   ├── prisma.ts         # 1087 linii - pełny mock
│   └── redis.ts          # 299 linii - in-memory mock
├── unit/services/        # 60 plików
└── integration/routes/   # 13 plików

packages/sim-core/src/__tests__/
├── helpers/factories.ts  # 330 linii - state builders
├── unit/                 # 22+ plików
└── integration/          # full-game.test.ts

apps/web/e2e/
└── app.spec.ts           # Playwright spec
```

### Statystyki

| Kategoria | Liczba |
|-----------|--------|
| Server test files | 63 |
| sim-core test files | 38 |
| Protocol test files | 7 |
| E2E test files | 1 |
| **Total** | ~109 |

### Kluczowe Mocki

**Prisma Mock** (1087 linii):
- 60+ operacji modeli
- 30+ helper functions (createMockUser, createMockGuild, etc.)
- $transaction support

**Redis Mock** (299 linii):
- String: get, set, setex, del, exists
- Hash: hset, hget, hgetall
- Sorted Set: zadd, zrange, zrank
- Pipeline support

**Factories** (330 linii):
- `createGameState()` - 60+ properties
- `createEnemy()` - physics, status, AI
- `createSimConfig()` - simulation config

---

## Rendering Pipeline (PixiJS)

### Architektura

```
PixiJS Application (WebGPU/WebGL2/WebGL fallback)
└── Stage (root container, 1920x1080 responsive)
    ├── CRT Filter (global post-processing)
    └── gameContainer (screen shake offset)
        └── GameScene
            ├── ParallaxBackground (stars, clouds)
            ├── EnvironmentRenderer (sky, tower, effects)
            ├── TurretSystem (Graphics-based)
            ├── WallSystem
            ├── EnemySystem (150-unit pool)
            ├── MilitiaSystem
            ├── HeroSystem (tweened animations)
            ├── ProjectileSystem (motion trails)
            ├── VFXSystem (2000-particle pool)
            └── LightingSystem (additive)
```

### System Współrzędnych

| Level | Skala | Użycie |
|-------|-------|--------|
| Fixed-Point | Q16.16 (65536) | Symulacja |
| Game Units | 0-40 × 0-15 | Logika gry |
| Screen Pixels | Responsive | Rendering |

### Proceduralne Renderowanie

Gra **nie używa** sprite atlasów - wszystko jest rysowane proceduralnie:
- `Graphics.circle()` dla wrogów (kolory per typ)
- `Graphics.rect()` dla HP bars
- 26 typów wrogów z predefiniowanymi kolorami
- Kształty turretów: cannon, tower, dome, tesla

### Object Pooling

| Pool | Max Size | Użycie |
|------|----------|--------|
| EnemyVisualPool | 150 | Visual bundles (6 graphics layers) |
| ParticlePool | 2000 | VFX particles |
| GraphicsPool | 200 | Temporary objects |

**Performance**: 15-25% szybsze frame times podczas dużych fal

### Render Loop

```
30 Hz Fixed Timestep (symulacja)
60 FPS Rendering (interpolacja)

Loop:
1. Measure delta (cap to 100ms)
2. Accumulate: accumulator += delta * speedMultiplier
3. Fixed step: while (accumulator >= 33.33ms) → sim.step()
4. Interpolation: alpha = accumulator / tickMs
5. Render(alpha) dla smooth motion
```

### Quality Levels

| Level | Particles | Filters | Shadows |
|-------|-----------|---------|---------|
| Ultra | 1.5x | 3 | ✓ |
| High | 1.0x | 2 | ✓ |
| Medium | 0.75x | 1 | ✗ |
| Low | 0.5x | 0 | ✗ |

---

## System Animacji i VFX

### Easing Functions (24+)

- Linear, Quad, Cubic, Quart, Quint
- Sine, Expo, Circ, Back, Elastic, Bounce
- Każda z wariantami: In, Out, InOut
- Custom Bézier curves (Newton-Raphson, 4 iteracje)

### Spring Physics

| Preset | Stiffness | Damping | Use Case |
|--------|-----------|---------|----------|
| snappy | 400 | 30 | Quick response |
| bouncy | 300 | 10 | Playful overshoot |
| gentle | 120 | 14 | Soft modals |
| responsive | 500 | 35 | Hover states |
| wobbly | 200 | 8 | Celebrations |

### Particle System

```
ParticlePool (2000 max, 200 preallocated)
├── Position: x, y
├── Velocity: vx, vy
├── Lifecycle: life, maxLife
├── Visuals: size, color, shape, rotation, alpha
├── Physics: gravity, drag
└── Advanced: spawnSecondary, stage
```

**Kształty (8 typów)**:
circle, square, spark, ring, diamond, star, smoke, confetti

### Explosion Effects (5 faz)

| Faza | Timing | Efekt |
|------|--------|-------|
| 1 | 0ms | Radial burst |
| 2 | 80ms | Fire plume (upward) |
| 3 | 160ms | Colored smoke |
| 4 | 260ms | Splash + secondary particles |
| 5 | 360ms | Falling debris (gravity) |

**Total duration**: 950ms

### Projectile Types

| Type | Class | Trail | Shape |
|------|-------|-------|-------|
| physical | natural | 6 | circle |
| icicle | ice | 8 | spike |
| fireball | fire | 10 | circle |
| bolt | lightning | 12 | bolt |
| laser | tech | 14 | bolt |
| plasma_beam | plasma | 12 | plasma |
| void_slash | void | 8 | slash |

### Skill VFX

- **Lightning Strike**: 12-segment bolt + branches + ground sparks
- **Chain Lightning**: Links between targets
- **EMP Blast**: Concentric rings
- **Hammer Throw**: Arc trajectory + trail

---

## CI/CD i Deployment

### Docker

**Multi-stage build** (`Dockerfile`):
```
Builder Stage:
  - node:20-bookworm-slim
  - pnpm via corepack
  - Build: protocol → sim-core → server
  - Prisma client generation

Production Stage:
  - Same base image
  - NODE_ENV=production, PORT=3000
  - Health check: wget /health (30s interval)
```

**docker-compose.yml**:
- PostgreSQL 15-alpine (port 5433)
- Redis 7-alpine (port 6379)
- WAL archiving for PITR
- Persistence volumes

### Deployment Targets

| Target | Use | Config |
|--------|-----|--------|
| **Railway** | Backend | Dockerfile, /health, 1 replica |
| **Vercel** | Frontend | SPA, CDN, API rewrites |

### Turbo Orchestration

```json
{
  "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
  "dev": { "cache": false, "persistent": true },
  "test": { "dependsOn": ["build"] }
}
```

### Test Infrastructure

| Package | Tests | Pass Rate | Time |
|---------|-------|-----------|------|
| protocol | 168 | 100% | 1.30s |
| server | 1,381 | 99.71% | 19.86s |
| sim-core | 1,826 | 99.89% | 28.62s |
| web (e2e) | 7 | 100% | 28.2s |
| **Total** | **3,382** | **99.73%** | **~77s** |

### Migrations (28+)

Kluczowe migracje:
- `20260102_init` - Core schema
- `20260109_guild_system` - Guilds
- `20260108_pvp_arena` - PvP
- `20260115_shop_tables` - Shop
- `20260120_build_presets` - Presets

---

## Job Queue (BullMQ) i Caching (Redis)

### Queues (5)

| Queue | Purpose | Retention |
|-------|---------|-----------|
| leaderboard | Weekly snapshots | 100 max |
| cleanup | Expired run cleanup | 100 max |
| metrics | System metrics (1min) | 100 max |
| player-leaderboard | Weekly rewards | 50 max |
| guild-weekly | Tower race medals | 50 max |

### Scheduled Jobs

| Job | Schedule | Purpose |
|-----|----------|---------|
| Leaderboard Snapshot | `0 * * * *` | Hourly historical |
| Cleanup Expired | `*/5 * * * *` | Every 5 min |
| Metrics Snapshot | `* * * * *` | Every minute |
| Player Weekly | `0 0 * * 1` | Monday 00:00 |
| Guild Weekly | `5 0 * * 1` | Monday 00:05 |

### Caching Strategies

| Pattern | TTL | Use |
|---------|-----|-----|
| Sorted Sets | - | Real-time leaderboards |
| Hub Preview | 2 min | Player fortress config |
| Guild Preview | 5 min | Guild info |
| Leaderboard Metadata | 1 hour | Display names |
| Historical Snapshots | 7 days | Past week data |
| In-Memory (Map) | 60 sec | Guild bonuses |

### Rate Limiting

| Endpoint Type | Limit |
|---------------|-------|
| auth | 5/min |
| passwordReset | 3/hour |
| runStart | 20/min |
| leaderboard | 120/min |
| guildCreate | 3/hour |
| guildBattle | 20/min |
| default | 200/min |

---

## System Autentykacji

### Tokeny JWT

| Token | Payload | Expiry |
|-------|---------|--------|
| Access | `{sub, type: "access", isGuest?}` | 15 min |
| Refresh | `{sub, sessionId, type: "refresh"}` | 7 dni |
| Admin Access | `{sub, type: "admin_access"}` | 15 min |
| Admin Refresh | `{sub, sessionId, type: "admin_refresh"}` | 7 dni |

### Security Features

- **Password**: bcrypt, 12 salt rounds
- **Sessions**: DB-backed, revoked on refresh
- **Cookies**: HttpOnly, Secure, SameSite=lax
- **Secret Rotation**: Previous secret support
- **Rate Limiting**: Per-endpoint with Redis

### Guest Mode

```
- Random 5-byte ID → username: guest_<hex>
- isGuest: true w tokenie
- guestExpiresAt: +30 dni
- Starter pack: 1000 gold, 100 dust
- Konwersja: username + email + password → full user
```

### Role-Based Access

| Role | Permissions |
|------|-------------|
| USER | Standard gameplay |
| ADMIN | `/admin/*` routes, moderation |

---

## System Anti-Cheat

### Segment Verification

```
Segment Size: 5 waves
Flow:
1. Client submits: events, checkpoints, finalHash
2. Server validates segment boundaries
3. Server replays entire segment deterministically
4. Server compares hash → accept/reject
```

### Hash Algorithm: FNV-1a 32-bit

```typescript
let hash = 0x811c9dc5;  // FNV offset basis
for (byte of data) {
  hash ^= byte & 0xFF;
  hash = Math.imul(hash, 0x01000193);  // FNV prime
}
```

### Chained Checkpoints

```
chainHash = fnv1a(prevChainHash + tick + currentHash)
```

Zapobiega wstawianiu/usuwaniu checkpointów.

### Checkpoint Data (337 linii serializacji)

- Core: tick, wave, ended, won
- RNG state (critical!)
- Fortress: HP, class, commander level
- Enemies (sorted by ID)
- Heroes, Turrets, Projectiles
- Economy, Relics, Skills
- Analytics stats

### Random Audit Ticks

```
- 2-3 checkpoints per segment (losowe)
- Client musi dostarczyć exact checkpoints
- Cheater nie wie które ticki weryfikować
```

### Validation Rules

| Check | Limit |
|-------|-------|
| Max ticks/segment | 9,000 (5 waves × 30Hz × 60s) |
| Max reward | 1,000,000 |
| Max wave advance | +5 (SEGMENT_SIZE) |
| Event order | Monotonic ticks |

### Rejection Reasons

- `TICKS_NOT_MONOTONIC` - Events not chronological
- `AUDIT_TICK_MISSING` - Missing checkpoint
- `CHECKPOINT_MISMATCH` - Hash mismatch
- `FINAL_HASH_MISMATCH` - Final state wrong
- `SEGMENT_TICK_CAP` - Exceeded tick limit
- `SIM_VERSION_MISMATCH` - Version incompatible

### Gaps (Do Poprawy)

- Brak automatycznego ban system
- Brak logowania failed segments
- Brak anomaly detection
- Brak escalating penalties

---

## System Generowania Fal

### Kompozycja Fal

**Rotacja Filarów**: Co 10 fal zmiana filaru (Streets → Science → Mutants → Cosmos → Magic → Gods)

**Rozkład Wrogów w Cyklu 10-Falowym**:
| Pozycja | Skład |
|---------|-------|
| Fale 1-2 | 60% common + 40% common |
| Fale 3-5 | 40% common + 35% common + 25% elite |
| Fale 6-9 | 30% common + 35% elite + 35% elite |
| Fala 10 | 1 boss + 30% elite + 40% common |

### Skalowanie Trudności

```
waveScale = 1 + (effectiveWave - 1) × 0.12  // +12% per wave
cycleScale = 1.6^cycle                       // 1.6x per 100 waves

Cycle 0 (1-100):   1.0x
Cycle 1 (101-200): 1.6x
Cycle 2 (201-300): 2.56x
```

### Liczba Wrogów

```
wave ≤ 30: (8 + wave × 2.5) × 2
wave > 30: (8 + 75 + (wave - 30) × 1.8) × 2

Wave 1:  20 enemies
Wave 10: 66 enemies
Wave 50: 238 enemies
```

### Elite Spawn

```
eliteChance = min(0.05 + wave × 0.004, eliteCap)
eliteCap = wave < 60 ? 0.35 : 0.50

Wave 1:  5.4%
Wave 50: 25%
Wave 60+: max 50%
```

### Wave Modifiers (12 typów)

| Modifier | Efekt | Reward Bonus |
|----------|-------|--------------|
| speedy | +25% speed | 1.15x |
| armored | +30% HP | 1.20x |
| swarm | 2x enemies, 0.5x HP | 1.25x |
| elite_rush | 3x elite chance | 1.30x |
| boss_guard | 0.5x enemies, 5x elite | 1.50x |
| shielded | 50% damage absorb | 1.35x |

---

## System Bossów

### Typy Bossów (7)

| Boss | Pillar | Base HP | Speed | Damage |
|------|--------|---------|-------|--------|
| mafia_boss | Streets | 431 | 0.68 | 36 |
| ai_core | Science | 719 | 0.42 | 44 |
| sentinel | Mutants | 288 | 1.06 | 29 |
| cosmic_beast | Cosmos | 575 | 0.84 | 50 |
| dimensional_being | Magic | 863 | 0.53 | 58 |
| titan | Gods | 1150 | 0.37 | 73 |
| god | Gods | 1438 | 0.84 | 86 |

### Boss Phases (HP-based)

| Boss | 75% | 50% | 25% |
|------|-----|-----|-----|
| Mafia Boss | Summon 5 gangsters | Shield 50% | Enrage 1.5x |
| AI Core | Summon 8 drones | Stun aura | Heal 15% |
| Titan | Stun aura | Enrage 1.8x | Heal 25% |
| God | Shield 75% (90%) | Summon 3 einherjar (60%) | Enrage 2.0x (30%) |

### Boss Abilities (5 typów)

1. **summon_minions** - Spawn wrogów
2. **damage_shield** - 50-75% damage reduction
3. **enrage** - 1.3-2.0x damage, 1.0-1.5x speed
4. **heal_burst** - 15-25% max HP restore
5. **stun_aura** - 5-6 unit radius stun

### Boss Rush Mode

```
Sekwencja: 7 bossów (wszystkie filary)
Intermission: 90 ticków (3s) między bossami
Scaling: +10% per pozycja, 2x per cycle
HP Multiplier: 5x base
Milestones: 3/7/14/21 bossów → trophies
```

---

## Combat Math

### Damage Chain

```
Base Damage
  × Stone Bonus (Power Crystal: up to 1.5x)
  × Artifact Bonus (up to 1.4x)
  × Hero Passive (e.g., Void Resonance: +100%)
  × Buff Bonuses (additive per buff)
  × Global Damage Bonus
  = Final Damage
```

### Fixed-Point Scale

```
FP_BASE = 16384 (turrets, stones)
FP_SCALE = 65536 (physics, positions)
```

### Combo System

| Combo | Elements | Effect | Cooldown |
|-------|----------|--------|----------|
| Steam Burst | Fire + Ice | +30% damage | 60 ticks |
| Electrocute | Lightning + Ice | 1s stun | 60 ticks |
| Shatter | Physical + Tech | Armor break (+50% next hit) | 60 ticks |

**Detection Window**: 30 ticks (1 sekunda)

### Lifesteal

```
Base: 10% damage dealt → HP
Stone Bonus: +calculateHeroStoneLifesteal()
Artifact Bonus: parsed from passive
Cap: 30% max
```

### Stat Caps

| Stat | Max |
|------|-----|
| Damage Reduction | 80% |
| Dodge Chance | 50% |
| Block Chance | 60% |
| Crit Chance | 75% |
| Crit Damage | 500% |
| Lifesteal | 30% |

**Note**: Crit i Dodge/Block zdefiniowane ale **NIE zaimplementowane** w damage loop.

---

## System Mastery

### Struktura

- **7 drzewek** (fire, ice, lightning, natural, tech, void, plasma)
- **18 nodes per tree**
- **5 tierów** (rosnące koszty i moc)

### Typy Nodes

1. **stat_bonus** - Bezpośrednie statystyki
2. **synergy_amplifier** - Wzmocnienie synergii
3. **class_perk** - Unikalne mechaniki klasy
4. **capstone** - Ultimate powers (Tier 5)

### Punkty Mastery

| Source | Points |
|--------|--------|
| Wave 10 | 1 |
| Wave 25 | 2 |
| Wave 50 | 3 |
| Wave 100 | 5 |
| Boss Kill | 1-2 |
| Weekly Challenge | 3 |

**Soft Cap**: ~150 punktów

### Tier Thresholds

| Tier | Points Spent Required |
|------|----------------------|
| 1 | 0 |
| 2 | 5 |
| 3 | 15 |
| 4 | 35 |
| 5 | 60 |

### Node Costs

- Tier 1: 1 MP
- Tier 2: 2 MP
- Tier 3: 4 MP
- Tier 4: 6 MP
- Tier 5: 10 MP (Capstones)

### Respec

```
Penalty: 50% punktów utraconych
Minimum return: 1 punkt
Reset: tylko wybrany class tree
```

### Przykładowe Efekty (Fire Tree)

- T1: +10% damage
- T2: +15% damage, +3% crit
- T3: Fire heroes +20% damage, +10% attack speed
- T4: Execute enemies <10% HP with +150% damage
- T5 Capstone: Phoenix Protocol (+100% damage when HP <20%)

---

## System Kolonii

### 4 Budynki

| Building | Unlock | Base Gold/h | Max Level |
|----------|--------|-------------|-----------|
| Farm | Level 5 | 10 | 50 |
| Mine | Level 15 | 25 | 40 |
| Market | Level 30 | 50 | 30 |
| Factory | Level 50 | 100 | 20 |

### Formuła Produkcji

```
goldPerHour = baseGold × colonyLevel × (1 + (commanderLevel - 1) × 0.01)
```

### Upgrade Cost

```
cost = baseCost × (costMultiplier ^ currentLevel)

Farm:    base 100, mult 1.15
Mine:    base 500, mult 1.18
Market:  base 2000, mult 1.20
Factory: base 10000, mult 1.25
```

### Idle Rewards

```
Max Accrual: 8 godzin
Min Claim: 5 minut cooldown

Materials:
  Base: 0.75 drops/h
  Scaling: +0.03 per commander level

Dust:
  Base: 1 dust/h
  Scaling: +0.05 per commander level

Legendary Chance:
  Base: 15%
  Scaling: +0.5% per level
  Cap: 40%
```

---

## Power Upgrades

### Fortress Stats

| Stat | Bonus/Level | Base Cost | Cost/Level |
|------|-------------|-----------|------------|
| HP | +5% | 60 | +45 |
| Damage | +4% | 90 | +60 |
| Armor | +3% | 120 | +75 |

### Hero Stats

| Stat | Bonus/Level | Base Cost | Cost/Level |
|------|-------------|-----------|------------|
| HP | +10% | 15 | +10 |
| Damage | +10% | 25 | +15 |

### Turret Stats

| Stat | Bonus/Level | Max Level | Base Cost |
|------|-------------|-----------|-----------|
| Damage | +3% | 20 | 40 + 25/lvl |
| Attack Speed | +2.5% | 20 | 60 + 35/lvl |

### Prestige System

```
Max Level: 5
Requirement: Stat at level 20
Bonus: +5% permanent per prestige
Cost: 5000 gold + 500 dust × 1.5^level

Effect: Reset stat to 0, keep permanent bonus
```

### Item Tiers

| Tier | Effect Multiplier | Upgrade Cost |
|------|-------------------|--------------|
| Common → Uncommon | 1.15x | 800 gold |
| Uncommon → Rare | 1.35x | 1,750 gold |
| Rare → Epic | 1.60x | 4,000 gold |
| Epic → Legendary | 2.00x | 8,000 gold |

### Total Power Formula

```
fortressPower = basePower × upgradeMultiplier
heroPower = (base + artifacts) × tier × upgrades
turretPower = base × tier × upgrades
itemPower = ∑(tierBase × effectMultiplier)

totalPower = fortress + ∑heroes + ∑turrets + items
```

**Power Weights**:
- HP: 0.5
- Damage: 1.0
- Armor: 0.5
- Attack Speed: 0.8

---

*Dokument wygenerowany na podstawie analizy kodu źródłowego projektu Grow Fortress.*
*Data: 2026-01-24*
*Wersja: 4.0 (gameplay, progresja, combat math)*
