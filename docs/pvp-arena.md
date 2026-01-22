# PvP Arena - Dokumentacja Systemu

## Przegląd

System Async PvP Arena umożliwia graczom wyzywanie się nawzajem do walk między twierdzami. Walki są w pełni automatyczne (auto-battle) i deterministyczne, co pozwala na odtwarzanie replay'ów.

## Koncepcja

```
┌─────────────────────────────────────────────────────────────────┐
│                         ARENA                                   │
│                                                                 │
│     GRACZ A (LEFT)                    GRACZ B (RIGHT)           │
│     ┌─────┐                                  ┌─────┐            │
│     │ 🏰 │  🦸→              ←🦸            │ 🏰 │            │
│     │    │  🦸→    ⚔️        ←🦸            │    │            │
│     └─────┘                                  └─────┘            │
│     🗼 🗼 🗼                                  🗼 🗼 🗼            │
│                                                                 │
│     Bohaterowie A ──────────────────► Atakują twierdzę B        │
│     Bohaterowie B ◄────────────────── Atakują twierdzę A        │
│                                                                 │
│              🏆 KTO ZNISZCZY WROGĄ TWIERDZĘ - WYGRYWA           │
└─────────────────────────────────────────────────────────────────┘
```

## Zasady walki

| Element | Zachowanie |
|---------|------------|
| **Bohaterowie** | Idą w stronę wrogiej twierdzy, atakują ją (priorytet) lub wrogich bohaterów; mogą ginąć |
| **Wieżyczki** | Brak w arenie (tylko twierdza + bohaterowie) |
| **Warunek wygranej** | Zniszczenie wrogiej twierdzy |
| **Remis** | Obie twierdze zniszczone jednocześnie LUB timeout (10 min) |
| **Timeout** | Po 18000 ticków (10 min) wygrywa strona z większym HP twierdzy |

## Flow wyzwania

```
CHALLENGER                         CHALLENGED
1. Wybiera przeciwnika
2. Wysyla wyzwanie -> serwer natychmiast uruchamia symulacje
3. Wynik + replay dostepne w historii dla obu graczy
```

## Stałe konfiguracyjne

```typescript
// packages/protocol/src/pvp.ts
export const PVP_CONSTANTS = {
  MAX_CHALLENGES_PER_OPPONENT: 3,  // Max wyzwań do tego samego gracza
  COOLDOWN_HOURS: 24,              // Okres cooldown
  CHALLENGE_EXPIRY_HOURS: 24,      // Czas wygaśnięcia wyzwania
  POWER_RANGE_PERCENT: 0.20,       // ±20% mocy dla matchmakingu
};
```

## API Endpoints

### Opponents

```
GET /v1/pvp/opponents?limit=8&offset=0
```

Zwraca listę przeciwników w zakresie mocy gracza (±20%).

**Response:**
```json
{
  "opponents": [
    {
      "userId": "clx...",
      "displayName": "Player1",
      "power": 5000,
      "pvpWins": 10,
      "pvpLosses": 5,
      "canChallenge": true,
      "challengeCooldownEndsAt": null
    }
  ],
  "total": 15,
  "myPower": 4800
}
```

### Challenges

```
POST /v1/pvp/challenges
Body: { "challengedId": "user-id" }
```

Tworzy nowe wyzwanie i natychmiast uruchamia symulacjÄ™ (status RESOLVED).

```
GET /v1/pvp/challenges?type=sent|received|all&status=RESOLVED&limit=20&offset=0
```

Pobiera listę wyzwań.

```
GET /v1/pvp/challenges/:id
```

Pobiera szczegóły wyzwania wraz z wynikiem.

```
POST /v1/pvp/challenges/:id/accept
```

Legacy: endpoint z poprzedniego flow. W async PvP wyzwanie rozwiazuje sie przy create.

**Response:**
```json
{
  "challenge": {
    "id": "challenge-id",
    "status": "RESOLVED",
    "winnerId": "user-id"
  },
  "battleData": {
    "seed": 123456789,
    "challengerBuild": { ... },
    "challengedBuild": { ... }
  },
  "result": {
    "winnerId": "user-id",
    "winReason": "fortress_destroyed",
    "challengerStats": {
      "finalHp": 0,
      "damageDealt": 15000,
      "heroesAlive": 2
    },
    "challengedStats": {
      "finalHp": 500,
      "damageDealt": 12000,
      "heroesAlive": 1
    },
    "duration": 5400
  }
}
```

```
POST /v1/pvp/challenges/:id/decline
POST /v1/pvp/challenges/:id/cancel
```

Odrzuca lub anuluje wyzwanie.

### Replay

```
GET /v1/pvp/replay/:challengeId
```

Pobiera dane do odtworzenia walki.

**Response:**
```json
{
  "seed": 123456789,
  "challengerBuild": { ... },
  "challengedBuild": { ... },
  "result": { ... },
  "replayEvents": []
}
```

### Stats

```
GET /v1/pvp/stats
```

Pobiera statystyki PvP gracza.

**Response:**
```json
{
  "wins": 10,
  "losses": 5,
  "winRate": 66.7,
  "totalBattles": 15,
  "pendingChallenges": 2
}
```

## Model danych (Prisma)

```prisma
enum PvpChallengeStatus {
  PENDING
  ACCEPTED
  RESOLVED
  DECLINED
  EXPIRED
  CANCELLED
}

model PvpChallenge {
  id              String              @id @default(cuid())
  challengerId    String
  challenger      User                @relation("pvpChallenger", ...)
  challengedId    String
  challenged      User                @relation("pvpChallenged", ...)
  challengerPower Int
  challengedPower Int
  status          PvpChallengeStatus  @default(PENDING)
  seed            Int?
  createdAt       DateTime            @default(now())
  expiresAt       DateTime
  acceptedAt      DateTime?
  resolvedAt      DateTime?
  winnerId        String?
  result          PvpResult?
}

model PvpResult {
  id                    String       @id @default(cuid())
  challengeId           String       @unique
  challenge             PvpChallenge @relation(...)
  winnerId              String?
  winReason             String
  challengerFinalHp     Int
  challengerDamageDealt Int
  challengerHeroesAlive Int
  challengedFinalHp     Int
  challengedDamageDealt Int
  challengedHeroesAlive Int
  duration              Int
  challengerBuild       Json
  challengedBuild       Json
  replayEvents          Json?
  resolvedAt            DateTime     @default(now())
}
```

## Komponenty Frontend

### Struktura plików

```
apps/web/src/
├── api/
│   └── pvp.ts                    # Klient API
├── state/
│   └── pvp.signals.ts            # Stan Preact signals
└── components/pvp/
    ├── index.ts                  # Eksporty
    ├── PvpPanel.tsx              # Główny panel z zakładkami
    ├── PvpPanel.module.css       # Style panelu
    ├── OpponentsList.tsx         # Lista przeciwników
    ├── ChallengesList.tsx        # Lista wyzwań
    ├── PvpBattleResult.tsx       # Modal wyniku walki
    ├── PvpBattleResult.module.css
    ├── PvpReplayViewer.tsx       # Odtwarzacz replay
    └── PvpReplayViewer.module.css
```

### Użycie

```tsx
// W App.tsx
import { PvpPanel, PvpBattleResult, PvpReplayViewer } from './components/pvp/index.js';

// W renderze
<PvpPanel />
<PvpBattleResult />
<PvpReplayViewer />
```

```tsx
// Otwieranie panelu (np. z Controls.tsx)
import { openPvpPanel, pvpPendingChallenges } from '../../state/index.js';

<Button variant="skill" onClick={openPvpPanel}>
  🏆 PvP Arena
  {pvpPendingChallenges.value > 0 && (
    <span className="badge">{pvpPendingChallenges.value}</span>
  )}
</Button>
```

## Symulacja Arena (sim-core)

### Struktura

```
packages/sim-core/src/arena/
├── index.ts                # Eksporty
├── arena-state.ts          # ArenaState, ArenaSide
├── arena-ai.ts             # AI bohaterów i wieżyczek
└── arena-simulation.ts     # Główna klasa ArenaSimulation
```

### Użycie

```typescript
import { ArenaSimulation, type ArenaBuildConfig } from '@arcade/sim-core';

// Konfiguracja buildu
const buildA: ArenaBuildConfig = {
visibleConfigId: 'user-a',
  ownerName: 'Player A',
  fortressClass: 'natural',
  commanderLevel: 10,
  heroIds: ['thunderlord', 'iron_sentinel'],
  turrets: [
    { definitionId: 'arrow', slotIndex: 0, class: 'natural' }
  ],
  damageMultiplier: 1.5,
  hpMultiplier: 1.2,
};

// Uruchomienie symulacji
const sim = new ArenaSimulation(seed, buildA, buildB);
const result = sim.run();

console.log(result.winner);      // 'left' | 'right' | null
console.log(result.winReason);   // 'fortress_destroyed' | 'timeout' | 'draw'
console.log(result.duration);    // ticks
console.log(result.leftStats);   // { finalHp, damageDealt, heroesAlive }
console.log(result.rightStats);
```

### Deterministyczność

Symulacja używa:
- **Q16.16 fixed-point math** - dla identycznych wyników na różnych platformach
- **Xorshift32 RNG** - deterministyczny generator losowy z seed

```typescript
// Ten sam seed + buildy = identyczny wynik
const sim1 = new ArenaSimulation(12345, buildA, buildB);
const sim2 = new ArenaSimulation(12345, buildA, buildB);

sim1.run().winner === sim2.run().winner; // true
```

## Testy

```bash
# Testy symulacji areny
cd packages/sim-core
pnpm test arena

# Wszystkie testy sim-core
pnpm test
```

## Kody błędów

```typescript
// packages/protocol/src/pvp.ts
export const PVP_ERROR_CODES = {
  CHALLENGE_NOT_FOUND: 'CHALLENGE_NOT_FOUND',
  CHALLENGE_FORBIDDEN: 'CHALLENGE_FORBIDDEN',
  CHALLENGE_EXPIRED: 'CHALLENGE_EXPIRED',
  CHALLENGE_ALREADY_RESOLVED: 'CHALLENGE_ALREADY_RESOLVED',
  CHALLENGE_NOT_PENDING: 'CHALLENGE_NOT_PENDING',
  CANNOT_CHALLENGE_SELF: 'CANNOT_CHALLENGE_SELF',
  COOLDOWN_ACTIVE: 'COOLDOWN_ACTIVE',
  OPPONENT_NOT_FOUND: 'OPPONENT_NOT_FOUND',
  POWER_OUT_OF_RANGE: 'POWER_OUT_OF_RANGE',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
};
```

## Przyszłe rozszerzenia

- [ ] Rankingi PvP (ELO/MMR)
- [ ] Turnieje
- [ ] Drużyny/Gildie
- [ ] Sezonowe nagrody
- [ ] Spectator mode (oglądanie walk na żywo)


