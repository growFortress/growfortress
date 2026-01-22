# Szczegółowa Analiza Systemu Gildii

## Spis treści
1. [Przegląd architektury](#przegląd-architektury)
2. [Model danych](#model-danych)
3. [System członkostwa](#system-członkostwa)
4. [System struktur gildyjnych](#system-struktur-gildyjnych)
5. [Battle Hero System](#battle-hero-system)
6. [Arena 5v5 (Guild Siege)](#arena-5v5-guild-siege)
7. [Weekly Tower Race](#weekly-tower-race)
8. [Guild Boss](#guild-boss)
9. [System skarbca](#system-skarbca)
10. [System trofeów i medali](#system-trofeów-i-medali)
11. [System honoru i rankingów](#system-honoru-i-rankingów)
12. [API i endpointy](#api-i-endpointy)
13. [Frontend i komponenty](#frontend-i-komponenty)
14. [Bezpieczeństwo i walidacja](#bezpieczeństwo-i-walidacja)
15. [Optymalizacje i wydajność](#optymalizacje-i-wydajność)
16. [Potencjalne problemy i ulepszenia](#potencjalne-problemy-i-ulepszenia)

---

## Przegląd architektury

### Technologie
- **Backend**: Node.js + TypeScript
- **Baza danych**: PostgreSQL (Prisma ORM)
- **Frontend**: React + TypeScript
- **Symulacja**: Własny silnik symulacji (`@arcade/sim-core`)

### Struktura modułów
```
apps/server/src/services/
├── guild.ts              # CRUD, członkostwo, podstawowe operacje
├── guildBattle.ts        # Arena 5v5, shield system
├── guildBoss.ts          # Tygodniowy boss PvE
├── guildTowerRace.ts    # Weekly Tower Race
├── guildTreasury.ts      # Skarbiec, wpłaty/wypłaty
├── guildBattleHero.ts    # Battle Hero management
├── guildStructures.ts    # Struktury (Kwatera, Skarbiec, etc.)
├── guildBattleTrophies.ts # Trofea bitew
├── guildMedals.ts        # Medale Tower Race
├── guildInvitation.ts    # Zaproszenia
├── guildApplication.ts   # Aplikacje do gildii
├── guildLeaderboard.ts   # Rankingi
└── guildPreview.ts       # Publiczny podgląd gildii
```

### Kluczowe stałe konfiguracyjne
```typescript
GUILD_CONSTANTS = {
  // Limity członków
  MEMBER_BASE_CAPACITY: 10,
  MEMBER_MAX_CAPACITY: 30,
  
  // Limity bitew
  MAX_DAILY_ATTACKS: 10,
  ARENA_PARTICIPANTS: 5,
  ATTACK_COOLDOWN_SAME_GUILD_HOURS: 24,
  
  // Shield
  SHIELD_DURATION_HOURS: 24,
  SHIELD_GOLD_COST: 5000,
  MAX_SHIELDS_PER_WEEK: 2,
  
  // Honor (ELO)
  BASE_HONOR: 1000,
  HONOR_K_FACTOR: 32,
  
  // Struktury
  STRUCTURE_MAX_LEVEL: 20,
  STRUCTURE_BONUS_PER_LEVEL: 0.01, // +1% per level
}
```

---

## Model danych

### Tabele główne

#### `Guild`
```typescript
{
  id: string
  name: string (unique)
  tag: string (unique, 2-5 uppercase chars)
  description: string?
  
  // Struktury (0-20 każda)
  structureKwatera: Int    // +1 członek per level (base 10, max 30)
  structureSkarbiec: Int   // +1% gold bonus per level (max 20%)
  structureAkademia: Int   // +1% XP bonus per level (max 20%)
  structureZbrojownia: Int // +1% stat bonus per level (max 20%)
  
  // Ranking
  honor: Int (default: 1000, ELO-like)
  trophies: Json (array of trophy IDs)
  
  // Ustawienia
  settings: Json {
    minLevel: number
    autoAcceptInvites: boolean
    battleCooldownHours: number
    accessMode: 'OPEN' | 'APPLY' | 'INVITE_ONLY' | 'CLOSED'
  }
  
  disbanded: Boolean
  createdAt: DateTime
  updatedAt: DateTime
}
```

#### `GuildMember`
```typescript
{
  id: string
  guildId: string
  userId: string (unique) // User może być tylko w jednej gildii
  role: 'LEADER' | 'OFFICER' | 'MEMBER'
  
  // Battle Hero
  battleHeroId: string?
  battleHeroTier: Int? (1-3)
  battleHeroPower: Int? (cached)
  battleHeroUpdatedAt: DateTime?
  
  // Statystyki
  totalGoldDonated: Int
  totalDustDonated: Int
  battlesParticipated: Int
  battlesWon: Int
  
  joinedAt: DateTime
  updatedAt: DateTime
}
```

#### `GuildTreasury`
```typescript
{
  id: string
  guildId: string (unique)
  
  // Bieżące saldo
  gold: Int
  dust: Int
  guildCoins: Int // Waluta gildyjna
  
  // Lifetime totals
  totalGoldDeposited: BigInt
  totalDustDeposited: BigInt
  
  version: Int // Optimistic locking
  updatedAt: DateTime
}
```

#### `GuildBattle`
```typescript
{
  id: string
  
  // Gildie
  attackerGuildId: string
  defenderGuildId: string
  attackerUserId: string // Kto zainicjował
  
  // Uczestnicy (5 z każdej strony)
  attackerMemberIds: string[]
  defenderMemberIds: string[]
  
  // Snapshots bohaterów w momencie bitwy
  attackerHeroes: Json (BattleHeroSnapshot[])
  defenderHeroes: Json (BattleHeroSnapshot[])
  
  seed: Int // Dla deterministycznej symulacji
  
  status: 'RESOLVED' // Zawsze RESOLVED dla instant attacks
  winnerGuildId: string?
  
  createdAt: DateTime
  resolvedAt: DateTime
  
  isRevenge: Boolean
  revengeForBattleId: string?
}
```

#### `GuildBattleResult`
```typescript
{
  id: string
  battleId: string (unique)
  
  winnerGuildId: string?
  winnerSide: 'attacker' | 'defender' | 'draw'
  winReason: 'elimination' | 'timeout' | 'draw'
  
  // Zmiany honoru
  attackerHonorChange: Int
  defenderHonorChange: Int
  
  // Statystyki Arena 5v5
  attackerSurvivors: Int (0-5)
  defenderSurvivors: Int (0-5)
  attackerTotalDamage: BigInt
  defenderTotalDamage: BigInt
  
  // MVP
  mvpUserId: string?
  mvpHeroId: string?
  mvpDamage: BigInt
  mvpKills: Int
  
  // Replay data
  keyMoments: Json
  killLog: Json
  duration: Int (ticks)
  
  resolvedAt: DateTime
}
```

### Relacje
- `Guild` 1:N `GuildMember`
- `Guild` 1:1 `GuildTreasury`
- `Guild` 1:N `GuildBattle` (jako attacker i defender)
- `GuildMember` N:1 `User` (unique constraint)
- `GuildBattle` 1:1 `GuildBattleResult`

---

## System członkostwa

### Role i uprawnienia

| Rola | Zapraszanie | Wyrzucanie | Skarbiec | Ataki Arena | Roster View | Upgrade Structures |
|------|-------------|------------|----------|-------------|-------------|-------------------|
| **LEADER** | ✅ | ✅ (wszystkich) | ✅ Wpłata/Wypłata | ✅ | ✅ | ✅ |
| **OFFICER** | ✅ | ✅ (tylko MEMBER) | ✅ Wpłata | ✅ | ✅ | ❌ |
| **MEMBER** | ❌ | ❌ | ✅ Wpłata | ❌ | ❌ | ❌ |

### Tryby dostępu (`accessMode`)
1. **OPEN** - Każdy może dołączyć bezpośrednio (jeśli spełnia `minLevel`)
2. **APPLY** - Gracze muszą wysłać aplikację
3. **INVITE_ONLY** - Tylko przez zaproszenia (domyślne)
4. **CLOSED** - Nie przyjmuje nowych członków

### Limity członków
- **Bazowy**: 10 członków
- **Maksymalny**: 30 członków
- **Wzór**: `10 + structureKwatera` (max 20 poziomów = max 30 członków)

### Proces dołączania

#### 1. Zaproszenie (INVITE_ONLY)
```typescript
// Leader/Officer wysyła zaproszenie
POST /v1/guilds/:guildId/invitations
{
  userId: string
  message?: string
}

// Zaproszenie wygasa po 72h
// Gracz akceptuje/odrzuca
POST /v1/guilds/invitations/:id/accept
POST /v1/guilds/invitations/:id/decline
```

#### 2. Aplikacja (APPLY)
```typescript
// Gracz wysyła aplikację
POST /v1/guilds/:guildId/applications
{
  message?: string
}

// Leader/Officer akceptuje/odrzuca
POST /v1/guilds/applications/:id/accept
POST /v1/guilds/applications/:id/decline
```

#### 3. Bezpośrednie dołączenie (OPEN)
```typescript
// Gracz dołącza bezpośrednio
POST /v1/guilds/:guildId/join
```

### Walidacje
- ✅ Użytkownik nie może być w więcej niż jednej gildii
- ✅ Gildia nie może przekroczyć limitu członków
- ✅ Gracz musi spełniać `minLevel` (highestWave)
- ✅ Zaproszenia/aplikacje wygasają po 72h
- ✅ Maksymalnie 5 aktywnych aplikacji per gracz

---

## System struktur gildyjnych

### Cztery struktury

#### 1. Kwatera (Barracks)
- **Efekt**: +1 miejsce na członka per poziom
- **Bazowy limit**: 10 członków
- **Maksymalny limit**: 30 członków (poziom 20)
- **Koszt**: `gold = 500 × (level + 1)²`, `dust = 25 × (level + 1)`

#### 2. Skarbiec (Treasury)
- **Efekt**: +1% bonus do złota per poziom
- **Maksymalny bonus**: +20% (poziom 20)
- **Zastosowanie**: Wszystkie nagrody w złocie dla członków gildii
- **Koszt**: `gold = 500 × (level + 1)²`, `dust = 25 × (level + 1)`

#### 3. Akademia (Academy)
- **Efekt**: +1% bonus do XP per poziom
- **Maksymalny bonus**: +20% (poziom 20)
- **Zastosowanie**: Wszystkie nagrody XP dla członków gildii
- **Koszt**: `gold = 500 × (level + 1)²`, `dust = 25 × (level + 1)`

#### 4. Zbrojownia (Armory)
- **Efekt**: +1% bonus do statystyk per poziom
- **Maksymalny bonus**: +20% (poziom 20)
- **Zastosowanie**: Statystyki bohaterów w bitwach gildyjnych
- **Koszt**: `gold = 500 × (level + 1)²`, `dust = 25 × (level + 1)`

### Mechanika ulepszania
```typescript
// Tylko Leader może ulepszać struktury
POST /v1/guilds/:guildId/structures/upgrade
{
  structure: 'kwatera' | 'skarbiec' | 'akademia' | 'zbrojownia'
}

// Walidacje:
// - Leader permissions
// - Structure level < 20
// - Treasury ma wystarczające środki
// - Atomic transaction
```

### Przykładowe koszty
| Poziom | Gold | Dust |
|--------|------|------|
| 0→1 | 500 | 25 |
| 1→2 | 2,000 | 50 |
| 5→6 | 18,000 | 150 |
| 10→11 | 60,500 | 275 |
| 19→20 | 200,000 | 500 |

---

## Battle Hero System

### Koncepcja
Każdy członek gildii wybiera **jednego bohatera**, który reprezentuje go we wszystkich bitwach gildyjnych (Arena 5v5, Guild Boss).

### Mechanika

#### Ustawianie Battle Hero
```typescript
PUT /v1/guilds/:guildId/battle-hero
{
  heroId: string
}

// Walidacje:
// - Gracz musi mieć odblokowanego bohatera
// - Gracz musi być członkiem gildii
// - Automatyczne obliczenie tier i power
```

#### Cache'owanie statystyk
```typescript
// Statystyki są cache'owane w GuildMember:
battleHeroId: string
battleHeroTier: 1 | 2 | 3
battleHeroPower: number
battleHeroUpdatedAt: DateTime

// Power obliczany z:
// - Hero definition
// - Player's stat upgrades
// - Hero tier (1-3)
```

#### Odświeżanie power
- Automatyczne przy ustawieniu Battle Hero
- Ręczne odświeżenie: `POST /v1/guilds/:guildId/battle-hero/refresh`
- Powinno być wywoływane po upgrade'ach bohatera

### Wymagania
- ✅ Battle Hero **wymagany** do udziału w Arena 5v5
- ✅ Battle Hero **wymagany** do ataku na Guild Boss
- ✅ Bez Battle Hero członek nie może być wybrany do bitew

### Roster View (Leader/Officer)
```typescript
GET /v1/guilds/:guildId/battle-roster

// Zwraca:
{
  members: [{
    userId: string
    displayName: string
    role: 'LEADER' | 'OFFICER' | 'MEMBER'
    battleHero: {
      heroId: string
      tier: 1 | 2 | 3
      power: number
    } | null
    // Extended stats
    totalPower: number
    highestWave: number
    unlockedHeroCount: number
    lastActiveAt: DateTime
  }]
  availableAttacks: number
  maxDailyAttacks: 10
  nextAttackResetAt: DateTime
}
```

---

## Arena 5v5 (Guild Siege)

### Przegląd
System **instant PvP** - Leader/Officer wybiera 5 członków i atakuje inną gildię. Symulacja 5v5 jest rozwiązywana natychmiast.

### Mechanika ataku

#### 1. Inicjacja ataku
```typescript
POST /v1/guilds/:guildId/battles/attack
{
  defenderGuildId: string
  selectedMemberIds: string[] // Dokładnie 5 członków
}

// Walidacje:
// - Leader/Officer permissions
// - Dokładnie 5 członków wybranych
// - Wszyscy wybrani mają Battle Hero
// - Nie przekroczono dziennego limitu (10 ataków)
// - Cooldown na tę samą gildię (24h)
// - Shield nie aktywny (ani atakujący, ani broniący)
// - Broniący nie przekroczył limitu obron (3/dzień)
```

#### 2. Wybór obrońców
- System automatycznie wybiera **top 5 obrońców** według `battleHeroPower`
- Losowanie tylko jeśli więcej niż 5 członków ma Battle Hero

#### 3. Symulacja Arena
```typescript
// Używa silnika symulacji z @arcade/sim-core
runGuildArena(
  attackerHeroes: GuildBattleHero[],
  defenderHeroes: GuildBattleHero[],
  seed: number // Kryptograficznie bezpieczny seed
): GuildArenaResult

// Parametry symulacji:
// - Arena: 20×15 jednostek
// - Max czas: 60 sekund (1800 ticków @ 30Hz)
// - Zasięg ataku: 3 jednostki
// - Prędkość ruchu: 0.15 jednostek/tick
// - Szansa krytyka: 15%
// - Mnożnik krytyka: 1.5x
```

#### 4. Wynik bitwy
```typescript
{
  winnerSide: 'attacker' | 'defender' | 'draw'
  winReason: 'elimination' | 'timeout' | 'draw'
  attackerSurvivors: 0-5
  defenderSurvivors: 0-5
  attackerTotalDamage: number
  defenderTotalDamage: number
  mvp: {
    userId: string
    heroId: string
    damage: number
    kills: number
  }
  keyMoments: KeyMoment[] // Dla replay
  killLog: KillLogEntry[]
  duration: number (ticks)
}
```

### System honoru (ELO)

#### Obliczanie zmian
```typescript
function calculateHonorChange(
  winnerHonor: number,
  loserHonor: number,
  winnerPower: number,
  loserPower: number
): HonorChange {
  const expectedWin = 1 / (1 + Math.pow(10, (loserHonor - winnerHonor) / 400));
  const powerRatio = winnerPower / Math.max(loserPower, 1);
  const underdogBonus = powerRatio < 1 ? 1.2 : 1; // Bonus za pokonanie silniejszej gildii
  
  const winnerGain = Math.round(
    GUILD_CONSTANTS.HONOR_K_FACTOR * (1 - expectedWin) * underdogBonus
  );
  const loserLoss = Math.min(
    Math.round(GUILD_CONSTANTS.HONOR_K_FACTOR * expectedWin),
    loserHonor - GUILD_CONSTANTS.MIN_HONOR // Nie poniżej minimum
  );
  
  return { winnerGain, loserLoss };
}
```

#### Właściwości
- **Bazowy honor**: 1000
- **Minimum honor**: 100
- **K-factor**: 32
- **Underdog bonus**: +20% jeśli pokonasz silniejszą gildię (według power)
- **Remis**: Brak zmian honoru

### Limity i cooldowny

| Parametr | Wartość |
|----------|---------|
| Ataki dziennie | 10 per gildia |
| Cooldown na tę samą gildię | 24 godziny |
| Maksymalne obrony dziennie | 3 per gildia |
| Shield czas trwania | 24 godziny |
| Shield koszt | 5000 gold |
| Shield limit tygodniowy | 2 |

### Shield System

#### Aktywacja
```typescript
POST /v1/guilds/:guildId/shield

// Walidacje:
// - Leader/Officer permissions
// - Shield nie aktywny
// - Limit tygodniowy nie przekroczony (2/tydzień)
// - Treasury ma 5000 gold
```

#### Efekty
- ✅ Gildia **nie może być atakowana** przez 24h
- ❌ Gildia **nie może atakować** podczas shield (symetryczna blokada)
- ⏱️ Reset cooldownu co tydzień (poniedziałek 00:00 UTC)

### Nagrody (Guild Coins)

| Wynik | Base Coins | Bonusy |
|-------|------------|--------|
| **Wygrana** | 50 | +25 za Domination (5 survivors)<br>+10% per win streak (max +100%)<br>× Trophy multiplier |
| **Przegrana** | 10 | × Trophy multiplier |

#### Bonusy
- **Domination**: +25 coins jeśli wszystkie 5 bohaterów przeżyło
- **Win Streak**: +10% per wygrana w serii (max +100%)
- **Trophy Multiplier**: Mnożnik z trofeów (np. +20% za wszystkie trofea)

---

## Weekly Tower Race

### Koncepcja
Tygodniowa rywalizacja oparta na **sumie fal przejściowych** przez wszystkich członków gildii. Automatyczna - gracze po prostu grają normalnie.

### Mechanika

#### Cykl
- **Start**: Poniedziałek 00:00 UTC
- **Koniec**: Niedziela 23:59:59 UTC
- **Format tygodnia**: ISO week (YYYY-Www)

#### Zliczanie fal
```typescript
// Automatyczne przy zakończeniu fali w Endless TD
addWaveContribution(userId: string, wavesCleared: number)

// Proces:
// 1. Sprawdź członkostwo w gildii
// 2. Zastosuj medal bonus (jeśli aktywny)
// 3. Zaktualizuj totalWaves dla gildii
// 4. Zaktualizuj memberContributions (JSON)
```

#### Medal Bonus
- Gildie z medalami z poprzedniego tygodnia otrzymują bonus do fal
- **Gold medal**: +15% fal
- **Silver medal**: +10% fal
- **Bronze medal**: +5% fal
- **Top 10**: +8% fal
- **Top 25**: +5% fal
- **Top 50**: +3% fal
- **Czas trwania**: 7 dni od przyznania

### Ranking
```typescript
GET /v1/guilds/tower-race

// Sortowanie: totalWaves DESC
// Paginacja: limit, offset
```

### Nagrody (Guild Coins)

| Miejsce | Nagroda |
|---------|---------|
| 1 | 500 Guild Coins |
| 2 | 300 Guild Coins |
| 3 | 200 Guild Coins |
| 4-10 | 100 Guild Coins |
| 11-25 | 50 Guild Coins |
| 26-50 | 25 Guild Coins |

### Finalizacja
```typescript
// Wywoływane przez scheduled job po zakończeniu tygodnia
finalizeRace(weekKey: string)

// Proces:
// 1. Oznacz race jako 'completed'
// 2. Zwróć finalne rankingi
// 3. Rozdaj medale (wywołuje distributeTowerRaceMedals)
// 4. Ustaw bonusy na następny tydzień
```

---

## Guild Boss

### Koncepcja
Tygodniowy boss PvE dla całej gildii. Każdy członek może atakować **raz dziennie**.

### Mechanika

#### Boss
- **HP**: 50,000,000 (50M)
- **Cykl**: Poniedziałek - Niedziela
- **Typy bossów** (rotacja co tydzień):
  - `dragon` - Smok Chaosu
  - `titan` - Prastary Tytan
  - `demon` - Arcydiabeł
  - `leviathan` - Lewiatan
  - `phoenix` - Ognisty Feniks

#### Weakness System
- Każdy boss ma **weakness** (fortress class)
- Rotacja: `['castle', 'arcane', 'nature', 'shadow', 'forge']`
- Obecnie **nie używane** w obliczeniach damage (planowane)

#### Atak
```typescript
POST /v1/guilds/:guildId/boss/attack

// Walidacje:
// - Gracz jest członkiem gildii
// - Battle Hero ustawiony
// - Nie atakował dzisiaj
// - Boss jeszcze aktywny (nie wygasł)
```

#### Obliczanie damage
```typescript
const tierMultiplier = 1 + (heroTier - 1) * 0.5; // T1=1x, T2=1.5x, T3=2x
const randomMultiplier = 0.8 + Math.random() * 0.4; // 0.8-1.2
const baseDamage = Math.floor(
  heroPower * randomMultiplier * tierMultiplier * 100
);

// Obecnie weakness nie jest używany
// Planowane: +25% jeśli fortress class matches weakness
```

### Ranking
- **Globalny**: Wszystkie gildie rankowane według total damage
- **Gildyjny**: Członkowie rankowani według total damage w gildii

### Nagrody (Guild Coins)

| Akcja | Nagroda |
|-------|---------|
| Uczestnictwo (atak) | 5 Guild Coins |
| Top damage w gildii (tygodniowo) | +25 Guild Coins (planowane) |

### Finalizacja
```typescript
// Wywoływane przez scheduled job po zakończeniu tygodnia
finalizeBoss(weekKey: string)

// Zwraca top 20 gildii dla historii
```

---

## System skarbca

### Zasoby
- **Gold**: Główna waluta
- **Dust**: Materiał do ulepszania
- **Guild Coins**: Waluta gildyjna (osobne pole, nie w Treasury)

### Operacje

#### Wpłata (Deposit)
```typescript
POST /v1/guilds/:guildId/treasury/deposit
{
  gold?: number (min: 100, max: 50000/dzień)
  dust?: number (min: 10, max: 500/dzień)
}

// Kto: Wszyscy członkowie
// Limity dzienne:
// - Gold: 50,000
// - Dust: 500
// - Walidacja: Sprawdź dzisiejsze wpłaty
```

#### Wypłata (Withdraw)
```typescript
POST /v1/guilds/:guildId/treasury/withdraw
{
  gold?: number
  dust?: number
  reason: string (max 200 chars)
}

// Kto: Tylko Leader
// Limity:
// - Cooldown: 24h między wypłatami
// - Maksymalnie 20% każdego zasobu per wypłata
// - Walidacja: Sprawdź ostatnią wypłatę
```

### Audit Log
```typescript
GuildTreasuryLog {
  id: string
  guildId: string
  userId: string // Kto wykonał operację
  transactionType: 
    | 'DEPOSIT_GOLD'
    | 'DEPOSIT_DUST'
    | 'WITHDRAW_GOLD'
    | 'WITHDRAW_DUST'
    | 'BATTLE_COST'
    | 'UPGRADE_COST'
    | 'REWARD_DISTRIBUTION'
    | 'BATTLE_REWARD'
    | 'SHIELD_PURCHASE'
    | 'STRUCTURE_UPGRADE'
  
  goldAmount: Int (może być ujemne)
  dustAmount: Int (może być ujemne)
  guildCoinsAmount: Int
  
  description: string?
  referenceId: string? // ID bitew, upgrade'ów, etc.
  
  // Snapshot salda po transakcji
  balanceAfterGold: Int
  balanceAfterDust: Int
  balanceAfterGuildCoins: Int
  
  createdAt: DateTime
}
```

### Optimistic Locking
```typescript
// Treasury używa version field dla optimistic locking
version: Int @default(1)

// Przy każdej transakcji:
// 1. Odczytaj version
// 2. Wykonaj operację
// 3. Zwiększ version
// 4. Jeśli version się zmienił → retry
```

---

## System trofeów i medali

### Trofea bitew (Battle Trophies)

#### Kategorie trofeów

**1. Cumulative Wins** (Łączne wygrane)
- `FIRST_BLOOD`: 1 wygrana
- `BATTLE_HARDENED`: 10 wygranych
- `WAR_MACHINE`: 50 wygranych
- `LEGENDARY_WARRIORS`: 100 wygranych

**2. Win Streak** (Seria wygranych)
- `HOT_STREAK`: 3 wygrane z rzędu
- `UNSTOPPABLE`: 5 wygranych z rzędu
- `INVINCIBLE`: 10 wygranych z rzędu

**3. Combat** (Wydarzenia w bitwie)
- `DOMINATION`: Wygrana z wszystkimi 5 bohaterami żywymi
- `COMEBACK_KINGS`: Wygrana po stracie 3+ bohaterów
- `UNDERDOG_VICTORY`: Pokonanie gildii z 20%+ wyższym honorem

**4. Rivalry** (Walki z tą samą gildią)
- `RIVAL_CRUSHER`: 5 wygranych vs ta sama gildia
- `NEMESIS`: 10 wygranych vs ta sama gildia

#### Bonusy trofeów
```typescript
// Stat Bonus (dla bitew)
calculateTotalStatBonus(trophyIds: string[]): number
// Suma wszystkich stat bonusów z trofeów

// Coin Multiplier (dla nagród)
calculateCoinMultiplier(trophyIds: string[]): number
// Mnożnik nagród Guild Coins
```

### Medale Tower Race

#### Typy medali
- **Gold**: Miejsce 1
- **Silver**: Miejsce 2
- **Bronze**: Miejsce 3
- **Top 10**: Miejsca 4-10
- **Top 25**: Miejsca 11-25
- **Top 50**: Miejsca 26-50

#### Nagrody medali
| Medal | Guild Coins | Wave Bonus | Czas trwania |
|-------|-------------|------------|--------------|
| Gold | 500 | +15% | 7 dni |
| Silver | 300 | +10% | 7 dni |
| Bronze | 200 | +5% | 7 dni |
| Top 10 | 100 | +8% | 7 dni |
| Top 25 | 50 | +5% | 7 dni |
| Top 50 | 25 | +3% | 7 dni |

#### Rozdawanie medali
```typescript
// Wywoływane przez weeklyGuildReset job
distributeTowerRaceMedals(
  weekKey: string,
  rankings: { guildId, rank, totalWaves }[]
)

// Proces:
// 1. Dla każdej gildii w top 50:
//    - Utwórz medal record
//    - Ustaw wave bonus na następny tydzień
//    - Dodaj Guild Coins do treasury
//    - Utwórz audit log
```

---

## System honoru i rankingów

### Honor (ELO-like)
- **Bazowy**: 1000
- **Minimum**: 100
- **K-factor**: 32
- **Użycie**: Ranking gildii vs gildii

### Leaderboard
```typescript
GET /v1/guilds/leaderboard?week=2024-W01&limit=20&offset=0

// Sortowanie: honor DESC
// Tygodniowe snapshoty w GuildLeaderboardEntry
```

### Weekly Snapshots
```typescript
GuildLeaderboardEntry {
  id: string
  weekKey: string (YYYY-Www)
  guildId: string
  
  // Snapshot na koniec tygodnia
  honor: Int
  totalScore: Int
  battlesWon: Int
  battlesLost: Int
  memberCount: Int
  
  createdAt: DateTime
}
```

### Rivalry Stats
```typescript
// Śledzenie wyników vs konkretną gildię
GuildBattleStreak {
  guildId: string (unique)
  
  // Obecne serie
  currentWinStreak: Int
  currentLossStreak: Int
  
  // Najlepsze serie
  bestWinStreak: Int
  bestLossStreak: Int
  
  // Statystyki vs konkretne gildie
  rivalryStats: Json {
    [opponentGuildId]: {
      wins: number
      losses: number
    }
  }
}
```

---

## API i endpointy

### Zarządzanie gildią
```
POST   /v1/guilds                    # Tworzenie
GET    /v1/guilds/:id                # Pobranie
PATCH  /v1/guilds/:id                # Aktualizacja (Leader)
DELETE /v1/guilds/:id                # Rozwiązanie (Leader)
GET    /v1/guilds?search=            # Wyszukiwanie
GET    /v1/guilds/me                 # Moja gildia
```

### Członkostwo
```
POST   /v1/guilds/:id/leave          # Opuszczenie
DELETE /v1/guilds/:id/members/:uid  # Wyrzucenie
PATCH  /v1/guilds/:id/members/:uid/role # Zmiana roli
POST   /v1/guilds/:id/transfer      # Przekazanie liderstwa
```

### Zaproszenia
```
POST   /v1/guilds/:id/invitations              # Wysłanie
GET    /v1/guilds/:id/invitations              # Lista (gildia)
GET    /v1/guilds/invitations/received         # Otrzymane
POST   /v1/guilds/invitations/:id/accept       # Akceptacja
POST   /v1/guilds/invitations/:id/decline      # Odrzucenie
POST   /v1/guilds/invitations/:id/cancel       # Anulowanie
```

### Aplikacje
```
POST   /v1/guilds/:id/applications            # Wysłanie
GET    /v1/guilds/:id/applications            # Lista (gildia)
GET    /v1/guilds/applications/sent           # Wysłane
POST   /v1/guilds/applications/:id/accept    # Akceptacja
POST   /v1/guilds/applications/:id/decline   # Odrzucenie
POST   /v1/guilds/applications/:id/cancel    # Anulowanie
```

### Battle Hero
```
PUT    /v1/guilds/:guildId/battle-hero       # Ustawienie
GET    /v1/guilds/:guildId/battle-hero       # Pobranie
DELETE /v1/guilds/:guildId/battle-hero       # Wyczyszczenie
GET    /v1/guilds/:guildId/battle-roster     # Roster (Leader/Officer)
```

### Arena 5v5
```
POST   /v1/guilds/:guildId/battles/attack    # Atak
GET    /v1/guilds/:guildId/battles/status    # Status (limity)
GET    /v1/guilds/:guildId/battles           # Historia
GET    /v1/guilds/:guildId/battles/:id       # Szczegóły bitwy
```

### Shield
```
GET    /v1/guilds/:guildId/shield            # Status
POST   /v1/guilds/:guildId/shield            # Aktywacja
```

### Tower Race
```
GET    /v1/guilds/tower-race                 # Leaderboard (public)
GET    /v1/guilds/:guildId/tower-race        # Status dla gildii
GET    /v1/guilds/:guildId/tower-race/details # Breakdown per member
GET    /v1/guilds/tower-race/history         # Historia
```

### Guild Boss
```
GET    /v1/guilds/boss                       # Info o bossie (public)
GET    /v1/guilds/:guildId/boss              # Status dla członka
POST   /v1/guilds/:guildId/boss/attack      # Atak
GET    /v1/guilds/boss/leaderboard          # Ranking gildii
GET    /v1/guilds/:guildId/boss/breakdown   # Damage członków
GET    /v1/guilds/boss/top-damage           # Top damage globalnie
```

### Skarbiec
```
GET    /v1/guilds/:guildId/treasury          # Stan skarbca
POST   /v1/guilds/:guildId/treasury/deposit # Wpłata
POST   /v1/guilds/:guildId/treasury/withdraw # Wypłata (Leader)
GET    /v1/guilds/:guildId/treasury/logs    # Historia
```

### Struktury
```
GET    /v1/guilds/:guildId/structures       # Lista struktur
POST   /v1/guilds/:guildId/structures/upgrade # Ulepszenie (Leader)
```

### Trofea i medale
```
GET    /v1/guilds/:guildId/trophies         # Trofea bitew
GET    /v1/guilds/:guildId/medals           # Medale Tower Race
```

### Rankingi
```
GET    /v1/guilds/leaderboard               # Ranking honor
GET    /v1/guilds/:id/rank                  # Pozycja gildii
GET    /v1/guilds/:id/contributions         # Wkład członków
```

### Guild Preview
```
GET    /v1/guilds/:guildId/preview          # Publiczny podgląd
```

---

## Frontend i komponenty

### Struktura komponentów
```
apps/web/src/components/guild/
├── GuildPanel.tsx              # Główny panel z zakładkami
├── GuildInfoTab.tsx            # Info, bonusy, progresja
├── GuildMembersTab.tsx         # Członkowie + Battle Hero
├── GuildTreasuryTab.tsx        # Skarbiec
├── GuildBattlesTab.tsx         # Arena 5v5, historia bitew
├── GuildRosterTab.tsx          # Roster dla Leader/Officer
├── GuildTowerRaceTab.tsx       # Weekly Tower Race
├── GuildBossTab.tsx            # Guild Boss
├── GuildTrophiesTab.tsx        # Trofea
├── GuildMedalsTab.tsx          # Medale
├── GuildApplicationsTab.tsx     # Aplikacje
├── GuildCreateModal.tsx        # Tworzenie gildii
├── GuildSearchModal.tsx        # Szukanie gildii
└── ArenaReplay.tsx             # Replay bitwy Arena 5v5

apps/web/src/components/modals/
├── GuildPreviewModal.tsx       # Podgląd gildii (public info)
└── GuildPreviewModal.module.css

apps/web/src/components/shared/
├── GuildTag.tsx                # Klikalny tag gildii [TAG]
└── GuildTag.module.css
```

### State Management (Signals)
```typescript
// apps/web/src/state/guild.signals.ts
export const showGuildPanel = signal(false);
export const guildPanelTab = signal<TabType>('info');
export const playerGuild = signal<GuildWithMembers | null>(null);
export const playerMembership = signal<GuildMember | null>(null);
export const guildBonuses = signal<GuildBonuses | null>(null);
export const guildBattles = signal<GuildBattle[]>([]);

// Computed
export const isInGuild = computed(() => playerGuild.value !== null);
export const isGuildLeader = computed(() => 
  playerMembership.value?.role === 'LEADER'
);
export const isGuildOfficer = computed(() =>
  playerMembership.value?.role === 'LEADER' ||
  playerMembership.value?.role === 'OFFICER'
);
```

---

## Bezpieczeństwo i walidacja

### Walidacje po stronie serwera

#### Członkostwo
- ✅ User może być tylko w jednej gildii (`userId` unique w `GuildMember`)
- ✅ Sprawdzanie członkostwa przed każdą operacją
- ✅ Sprawdzanie roli przed operacjami wymagającymi uprawnień

#### Limity
- ✅ Limity dzienne (ataki, wpłaty, ataki bossa)
- ✅ Cooldowny (wypłaty, ataki na tę samą gildię)
- ✅ Limity tygodniowe (shield)
- ✅ Limity członków (dynamiczne wg poziomu Kwatery)

#### Atomic Transactions
- ✅ Wszystkie operacje modyfikujące stan używają transakcji
- ✅ Optimistic locking dla Treasury (`version` field)
- ✅ Race condition checks w bitwach (re-check w transakcji)

#### Walidacja danych
- ✅ Zod schemas dla wszystkich requestów
- ✅ Sprawdzanie istnienia zasobów (gildia, użytkownik, bohater)
- ✅ Sprawdzanie stanu (gildia nie rozwiązana, boss aktywny)

### Błędy i kody błędów
```typescript
GUILD_ERROR_CODES = {
  // Guild errors
  GUILD_NOT_FOUND: 'GUILD_NOT_FOUND',
  GUILD_DISBANDED: 'GUILD_DISBANDED',
  NAME_TAKEN: 'NAME_TAKEN',
  TAG_TAKEN: 'TAG_TAKEN',
  
  // Membership errors
  ALREADY_IN_GUILD: 'ALREADY_IN_GUILD',
  NOT_IN_GUILD: 'NOT_IN_GUILD',
  GUILD_FULL: 'GUILD_FULL',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  
  // Battle errors
  DAILY_ATTACK_LIMIT: 'DAILY_ATTACK_LIMIT',
  BATTLE_COOLDOWN: 'BATTLE_COOLDOWN',
  DEFENDER_SHIELD_ACTIVE: 'DEFENDER_SHIELD_ACTIVE',
  NOT_ENOUGH_BATTLE_HEROES: 'NOT_ENOUGH_BATTLE_HEROES',
  
  // Treasury errors
  TREASURY_INSUFFICIENT: 'TREASURY_INSUFFICIENT',
  WITHDRAWAL_COOLDOWN: 'WITHDRAWAL_COOLDOWN',
  DONATION_LIMIT_EXCEEDED: 'DONATION_LIMIT_EXCEEDED',
  
  // ... i wiele innych
}
```

---

## Optymalizacje i wydajność

### Cache'owanie

#### Guild Bonuses Cache
```typescript
// Cache dla bonusów gildyjnych (TTL: 60 sekund)
const userGuildBonusesCache = new Map<string, {
  bonuses: GuildBonuses | null;
  expiry: number;
}>();

// Używane podczas obliczania nagród
// Invalidacja przy: join/leave guild, upgrade structures
```

#### Guild Preview Cache
```typescript
// Redis cache dla publicznego podglądu
// Klucz: guild:preview:{guildId}
// TTL: 5 minut
// Invalidacja przy zmianach w gildii
```

### Optymalizacje zapytań

#### Batch Operations
- ✅ Używanie `Promise.all()` dla równoległych zapytań
- ✅ Batch updates dla statystyk bitew

#### Efficient Queries
- ✅ Używanie `count()` zamiast `findMany().length`
- ✅ Selective includes (tylko potrzebne pola)
- ✅ Indexy na często używanych polach:
  - `Guild.honor` (sorting)
  - `GuildMember.userId` (unique)
  - `GuildMember.guildId`
  - `GuildBattle.attackerGuildId`, `defenderGuildId`

#### N+1 Prevention
- ✅ Batch loading członków z Battle Heroes
- ✅ Batch loading guild details dla leaderboardów

### Database Indexes
```sql
-- Guild
CREATE INDEX idx_guild_honor ON "Guild" (honor DESC);

-- GuildMember
CREATE UNIQUE INDEX idx_guild_member_user_id ON "GuildMember" (userId);
CREATE INDEX idx_guild_member_guild_id ON "GuildMember" (guildId);

-- GuildBattle
CREATE INDEX idx_guild_battle_attacker ON "GuildBattle" (attackerGuildId);
CREATE INDEX idx_guild_battle_defender ON "GuildBattle" (defenderGuildId);
CREATE INDEX idx_guild_battle_cooldown ON "GuildBattle" 
  (attackerGuildId, defenderGuildId, createdAt);

-- GuildTreasuryLog
CREATE INDEX idx_treasury_log_guild ON "GuildTreasuryLog" (guildId);
CREATE INDEX idx_treasury_log_user ON "GuildTreasuryLog" (userId);
CREATE INDEX idx_treasury_log_type ON "GuildTreasuryLog" (transactionType);
CREATE INDEX idx_treasury_log_created ON "GuildTreasuryLog" (createdAt);
```

---

## Potencjalne problemy i ulepszenia

### Zidentyfikowane problemy

#### 1. Battle Hero Power Refresh ✅ ZAIMPLEMENTOWANE
**Problem**: Power nie jest automatycznie odświeżany po upgrade'ach bohatera.

**Rozwiązanie**: 
- ✅ Wywołanie `refreshBattleHeroPower()` po każdej zmianie stat upgrades w `upgradeHeroStat()`
- ✅ Wywołanie `refreshBattleHeroPower()` po upgrade tier bohatera w `upgradeHero()`
- Implementacja używa fire-and-forget pattern, aby nie blokować odpowiedzi

#### 2. Weakness System w Guild Boss ✅ ZAIMPLEMENTOWANE
**Problem**: Weakness jest zdefiniowane, ale nie używane w obliczeniach damage.

**Rozwiązanie**:
- ✅ Dodano mapowanie weakness string → FortressClass:
  - `'castle'` → `'natural'`
  - `'arcane'` → `'void'`
  - `'nature'` → `'natural'`
  - `'shadow'` → `'void'`
  - `'forge'` → `'tech'`
- ✅ Pobieranie `defaultFortressClass` z `User` podczas ataku
- ✅ Zastosowanie +25% bonus damage jeśli `userFortressClass === bossWeaknessClass`

#### 3. Shield Symmetry
**Problem**: Gildia ze shieldem nie może atakować (symetryczna blokada).

**Uwaga**: To może być zamierzone, ale warto to udokumentować.

#### 4. Tower Race Medal Bonus
**Problem**: Bonus jest aplikowany do `totalWaves`, ale `memberContributions` przechowuje base waves.

**Uwaga**: To jest poprawne - bonus jest tylko do total, nie do indywidualnych wkładów.

#### 5. Race Conditions w Bitwach
**Problem**: Mimo atomic checks, możliwe są race conditions przy równoczesnych atakach.

**Rozwiązanie**: 
- ✅ Już zaimplementowane: re-check w transakcji
- Można rozważyć row-level locking

### Sugerowane ulepszenia

#### 1. Battle Hero Auto-Refresh
```typescript
// Wywołać po upgrade'ach
await refreshBattleHeroPower(userId);

// Lub scheduled job co godzinę
```

#### 2. Guild Activity Tracking
```typescript
// Śledzenie aktywności członków
lastActiveAt: DateTime // Ostatnia aktywność
weeklyActivity: number // Aktywność w tym tygodniu
```

#### 3. Guild Chat Integration
```typescript
// Już istnieje w schema:
chatMessages: ChatMessage[]

// Można dodać:
// - Real-time chat
// - @mentions
// - Battle notifications
```

#### 4. Advanced Battle Analytics
```typescript
// Statystyki bitew:
// - Win rate vs różne gildie
// - Najlepsze kompozycje bohaterów
// - Najskuteczniejsze strategie
```

#### 5. Guild Events
```typescript
// Wydarzenia gildyjne:
// - Weekly challenges
// - Special boss events
// - Seasonal competitions
```

#### 6. Guild Alliances
```typescript
// Sojusze między gildiami:
// - Wspólne ataki
// - Współdzielone zasoby
// - Alliance wars
```

---

## Podsumowanie

System gildii w Grow Fortress jest **kompleksowym i dobrze zaprojektowanym** systemem, który obejmuje:

✅ **Zarządzanie członkostwem** z hierarchią rang i różnymi trybami dostępu  
✅ **System struktur** z 4 typami ulepszeń wpływającymi na pojemność i bonusy  
✅ **Battle Hero System** z cache'owaniem statystyk  
✅ **Arena 5v5** z instant symulacją i systemem honoru (ELO)  
✅ **Weekly Tower Race** z automatycznym zliczaniem i medalami  
✅ **Guild Boss** z tygodniową rotacją i rankingami  
✅ **Skarbiec** z pełnym auditowaniem i limitami  
✅ **System trofeów i medali** z bonusami do statystyk i nagród  
✅ **Bezpieczeństwo** z walidacjami, atomic transactions i optimistic locking  
✅ **Optymalizacje** z cache'owaniem i efektywnymi zapytaniami  

System jest **gotowy do produkcji** z zaimplementowanymi ulepszeniami:
- ✅ **Auto-refresh Battle Hero power** po upgrade'ach statów i tier bohatera
- ✅ **Pełna implementacja weakness system** w Guild Boss z bonusem +25% damage
