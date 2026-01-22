# Analiza Async PvP Arena

Dokument stanowi szczegółową analizę systemu asynchronicznego PvP w Grow Fortress: architektura, przepływ danych, symulacja, API, frontend oraz rozbieżności i rekomendacje.

---

## 1. Przegląd i koncepcja „async”

**Async PvP** oznacza, że gracze **nie muszą być online jednocześnie**:

1. **Challenger** wysyła wyzwanie do wybranego przeciwnika (POST `/v1/pvp/challenges`).
2. Wyzwanie ma status `PENDING` i wygasa po **24 h** (`CHALLENGE_EXPIRY_HOURS`).
3. **Challenged** loguje się kiedy indziej, widzi wyzwania w zakładce „Wyzwania”, może **zaakceptować** lub **odrzucić**.
4. Dopiero **akceptacja** uruchamia symulację na serwerze. Seed jest generowany przy accept, walka jest deterministyczna.
5. Obie strony mogą później obejrzeć **replay** (GET `/v1/pvp/replay/:id`) — ten sam seed + buildy daje identyczną symulację.

Walki są **auto-battle**: bez interakcji gracza podczas samej bitwy. Decyzje „kiedy wysłać wyzwanie” i „czy zaakceptować” są jedynymi interakcjami.

---

## 2. Architektura warstw

```
┌─────────────────────────────────────────────────────────────────────────┐
│  FRONTEND (Preact)                                                       │
│  • PvpPanel, OpponentsList, ChallengesList, PvpBattleResult,             │
│    PvpReplayViewer                                                       │
│  • pvp.signals.ts (Preact signals)                                       │
│  • api/pvp.ts (HTTP client)                                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  SERVER (Fastify)                                                        │
│  • routes/pvp.ts (REST)                                                  │
│  • services/pvp.ts (logika biznesowa, Prisma, symulacja)                 │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ┌───────────┐   ┌───────────────┐   ┌─────────────────────┐
            │  Prisma   │   │  @arcade/     │   │  Redis (rate limit,  │
            │  (PG)     │   │  sim-core     │   │  leaderboard cache)  │
            │  PvP      │   │  arena        │   │                      │
            └───────────┘   └───────────────┘   └─────────────────────┘
```

- **Protocol** (`@arcade/protocol`): schematy Zod, stałe, kody błędów PvP.
- **sim-core arena**: `ArenaSimulation`, `runArenaBattle`, `ArenaBuildConfig`, AI targetowania, stan areny.

---

## 3. Przepływ wyzwania (flow)

### 3.1 Tworzenie wyzwania (challenger)

1. User wybiera przeciwnika z **OpponentsList** (lista z GET `/v1/pvp/opponents`).
2. Klika „Walcz” → `createChallenge(opponent.userId)`.
3. **Serwer** (`createChallenge`):
   - Sprawdza: nie siebie, cooldown (max 3 wyzwania na przeciwnika / 24 h), oba buildy istnieją.
   - Opcjonalnie `enforcePowerRange`: moc challenged w ±20% mocy challengera.
   - Tworzy `PvpChallenge` (status `PENDING`), ustawia `expiresAt` = now + 24 h.
   - **Nie** uruchamia symulacji. **Nie** zwraca `result` ani `rewards`.
4. Odpowiedź: `{ challenge }` (201).

### 3.2 Akceptacja wyzwania (challenged)

1. Challenged otwiera PvP Arena → zakładka „Wyzwania” (filter `pending`).
2. Klika „✓ Akceptuj” przy wyzwaniu → `acceptChallenge(challengeId)`.
3. **Serwer** (`acceptChallenge`):
   - Weryfikuje: użytkownik to `challenged`, status `PENDING`, brak ekspiracji.
   - Pobiera buildy obu graczy (`getUserBuildData`).
   - Generuje **seed**: `randomInt(2147483647)` (Node crypto).
   - Mapuje buildy na `ArenaBuildConfig` (`toBuildConfig`) i wywołuje `runArenaBattle(seed, challengerConfig, challengedConfig)`.
   - Zapisuje wynik w transakcji: aktualizacja `PvpChallenge` (status `RESOLVED`, `winnerId`, `seed`, `acceptedAt`, `resolvedAt`), utworzenie `PvpResult`, aktualizacja `User` (pvpWins/pvpLosses, honor).
   - Dla dodatniego honoru: `recordWeeklyHonorGain` (fire-and-forget).
4. Odpowiedź: `{ challenge, battleData, result }`. Frontend pokazuje **PvpBattleResult** i może odświeżyć listę wyzwań.

### 3.3 Odtwarzanie replay

1. User klika „🎬 Replay” przy rozstrzygniętym wyzwaniu.
2. `openReplayViewer(challenge)` → **PvpReplayViewer**.
3. Pobierane są dane: `getReplayData(challengeId)` → GET `/v1/pvp/replay/:id` (seed, buildy, result, `replayEvents`).
4. Na froncie tworzona jest `ArenaSimulation(seed, challengerBuild, challengedBuild)` i odtwarzana tick po ticku (przycisk play, prędkości 0.5×–8×). Deterministyczność gwarantuje identyczną walkę jak na serwerze.

---

## 4. Matchmaking i przeciwnicy

### 4.1 Zakres mocy

- **Źródło mocy** (dla matchmakingu): `cachedTotalPower` z `PowerUpgrades` (indeksowane) lub `getUserArenaPower(userId)`.
- **Zakres**: `matchingPower * (1 ± POWER_RANGE_PERCENT)` (domyślnie ±20%).
- **Minimum**: `MIN_POWER_RANGE = 1000` — gracze z mocą 0 mają zakres [0, 1000].

### 4.2 Zapytanie o przeciwników

- `getOpponents(userId, { limit, offset })`:
  - Filtruje: `id != userId`, `banned == false`, `power` w zakresie (lub `powerUpgrades == null` dla nowych).
  - `findMany` z `take`/`skip` **bez `orderBy`** — kolejność zależy od bazy, **nie ma losowości** mimo komentarza „random opponents”.
  - Dla każdego przeciwnika: `canChallengeUser` (cooldown 24 h, max 3 wyzwania na parę).
  - Zwraca również `isOnline` (WebSocket) oraz `myPower`.

### 4.3 Stałe (protocol)

```ts
PVP_CONSTANTS = {
  MAX_CHALLENGES_PER_OPPONENT: 3,
  COOLDOWN_HOURS: 24,
  CHALLENGE_EXPIRY_HOURS: 24,
  POWER_RANGE_PERCENT: 0.20,
}
```

---

## 5. Symulacja areny (sim-core)

### 5.1 Konfiguracja buildu

**ArenaBuildConfig** (używany w arenie):

- `ownerId`, `ownerName`, `fortressClass`, `commanderLevel`, `heroIds[]`, `damageBonus`, `hpBonus`.

**Brak w buildzie areny**: turretów, artefaktów, tierów bohaterów, hero-specific power upgrades.  
`toBuildConfig` mapuje tylko: `heroIds`, fortress class/level, oraz `damageBonus` / `hpBonus` z fortress upgrades (np. statUpgrades.hp/damage × 0.02).

### 5.2 Inicjalizacja bohaterów w arenie

W `createArenaSide` wywoływane jest:

```ts
initializeHeroes(build.heroIds.slice(0, maxHeroSlots), heroSpawnX);
```

**Tylko** `heroIds` i pozycja. Brak `powerData`, `heroTiers`, `equippedArtifacts`.  
Efekt: w arenie używane są **domyślne** tier 1, brak artefaktów i hero-specific upgrades. Moc używana do **matchmakingu** (`getUserArenaPower`) uwzględnia artefakty i power upgrades — **build w walce jest uboższy niż „moc”**. To rozbieżność między matchmakingiem a symulacją.

### 5.3 Zasady walki

- **Bohaterowie**: cel – twierdza (priorytet) > bohaterowie wroga; ruch w stronę twierdzy.
- **Twierdza**: atakuje wrogich bohaterów w zasięgu (`FORTRESS_ATTACK_RANGE`), nie twierdzę.
- **Warunek wygranej**: zniszczenie wrogiej twierdzy (HP ≤ 0).
- **Remis**: obie twierdze zniszczone w tym samym ticku **lub** timeout.
- **Timeout**: `maxTicks` = 18_000 (≈10 min @ 30 Hz). Wygrywa strona z wyższym % HP twierdzy; przy równości — remis.

### 5.4 „Nieśmiertelni” bohaterowie

W `arena-simulation.ts`:

```ts
private damageHero(...): void {
  // Heroes are immortal in arena - they only attack, fortress HP determines winner
}
```

Obrażenia od twierdzy do bohaterów **nie są stosowane**. Liczy się wyłącznie HP twierdz. Bohaterowie wpływają tylko poprzez damage do twierdzy i „obecność” (np. targetowanie przez fortece).

### 5.5 Deterministyczność

- **RNG**: Xorshift32, stan zapisany w `ArenaState.rngState` co tick.
- **Matematyka**: Q16.16 fixed-point (`FP`).
- Ten sam `seed` + te same buildy → identyczny wynik i replay.

### 5.6 Kolejność update’ów

- Parzyste ticki: left → right.
- Nieparzyste: right → left.
- Zmniejsza bias związany z kolejnością ruchu.

---

## 6. Honor i statystyki

### 6.1 Zmiana honoru

`calculateHonorChange(winnerPower, loserPower, isWinner)`:

- **Wygrana**: zysk zależny od tego, czy przeciwnik był silniejszy (więcej za pokonanie „mocniejszego”).
- **Przegrana**: strata mniejsza, gdy przegrywamy z silniejszym.
- Ograniczenia: np. `HONOR_MIN_GAIN`/`HONOR_MAX_GAIN`, `HONOR_MIN_LOSS`/`HONOR_MAX_LOSS`.  
Szczegóły w `services/pvp.ts`.

### 6.2 Statystyki użytkownika

- `User.pvpWins`, `User.pvpLosses`, `User.honor`.
- `getUserPvpStats`: wins, losses, winRate, totalBattles, `pendingChallenges` (liczba PENDING received, nie wygasłych).

---

## 7. API i baza danych

### 7.1 Endpointy

| Metoda | Endpoint | Opis |
|--------|----------|------|
| GET | `/v1/pvp/opponents` | Lista przeciwników (limit, offset) |
| POST | `/v1/pvp/challenges` | Utworzenie wyzwania `{ challengedId }` |
| GET | `/v1/pvp/challenges` | Lista wyzwań (type, status, limit, offset) |
| GET | `/v1/pvp/challenges/:id` | Szczegóły wyzwania (+ result gdy RESOLVED) |
| POST | `/v1/pvp/challenges/:id/accept` | Akceptacja + symulacja, zwrot wyniku |
| POST | `/v1/pvp/challenges/:id/decline` | Odrzucenie |
| POST | `/v1/pvp/challenges/:id/cancel` | Anulowanie (tylko challenger) |
| GET | `/v1/pvp/replay/:id` | Dane do replayu |
| GET | `/v1/pvp/stats` | Statystyki PvP użytkownika |

Wszystkie wymagają autentykacji.

### 7.2 Modele Prisma

- **PvpChallenge**: challenger/challenged, snapshot mocy, status, `expiresAt`, `acceptedAt`, `resolvedAt`, `winnerId`, `seed`, relacja do `PvpResult`.
- **PvpResult**: `winnerId`, `winReason`, statystyki obu stron, `duration`, `challengerBuild`/`challengedBuild` (JSON), `replayEvents` (JSON).

### 7.3 Rate limiting

- Trasy PvP **nie** używają `withRateLimit` — obowiązuje limit **globalny** (config).
- W README jest informacja „`/v1/pvp/challenges` 20/min per user” — **nie ma** dedykowanego limitu dla PvP w `rateLimit.ts`. Rozbieżność docs vs implementacja.

---

## 8. Frontend

### 8.1 Stan (pvp.signals)

- Stats: `pvpWins`, `pvpLosses`, `pvpWinRate`, `pvpTotalBattles`, `pvpPendingChallenges`, `userPower`.
- Opponents: `pvpOpponents`, `pvpOpponentsTotal`, loading/error.
- Challenges: `pvpSentChallenges`, `pvpReceivedChallenges`, pochodne (np. `pvpPendingReceivedChallenges`), loading/error.
- UI: `showPvpPanel`, `pvpActiveTab` (opponents / challenges / history), `showPvpResultModal`, `showPvpReplay`, itd.
- Battle: `pvpBattleData`, `pvpBattleResult`, `pvpBattleRewards`, `pvpAcceptingChallenge`.

### 8.2 OpponentsList vs createChallenge

W **OpponentsList** po `createChallenge`:

```ts
if (response.result && response.rewards) {
  showBattleResult(..., response.rewards);
}
```

**Serwer przy tworzeniu wyzwania zwraca tylko `{ challenge }`.**  
Nie ma `result` ani `rewards` — te powstają dopiero przy **accept**. Ten fragment UI („auto-accept” / natychmiastowy wynik po „Walcz”) **nigdy się nie wykona**. Logika jest dostosowana do flow z acceptem, ale warunek jest nieosiągalny.

### 8.3 ChallengesList

- **Pending**: akceptuj / odrzuć (challenged), anuluj (challenger).
- **Resolved**: „Szczegóły” (modal wyniku), „Replay” (PvpReplayViewer).

### 8.4 Replay

- Pobiera `getReplayData` → seed + buildy + result + events.
- Tworzy `ArenaSimulation`, odtwarza `step()` w pętli `requestAnimationFrame` z wybraną prędkością.  
Spójne z deterministyczną symulacją.

---

## 9. Rozbieżności i ryzyka

### 9.1 Build vs matchmaking

- **Matchmaking**: `getUserArenaPower` (heroes + fortress, z artefaktami i power upgrades).
- **Arena**: `ArenaBuildConfig` bez artefaktów, tierów, turretów; `initializeHeroes` tylko po `heroIds`.
- **Konsekwencja**: Moc pokazywana i używana do doboru przeciwników **nie** odpowiada temu, co faktycznie idzie do walki. Możliwy przewidywalny dysonans i poczucie niesprawiedliwości.

### 9.2 „Random” opponents

- Komentarz w kodzie mówi o „random opponents”, ale `getOpponents` nie stosuje `orderBy` ani shuffle.
- W praktyce: stała (niekoniecznie „losowa”) kolejność z bazy.

### 9.3 Rate limit PvP

- README: 20/min dla `/v1/pvp/challenges`.
- Brak osobnego limitu w `rateLimit.ts` — tylko global.

### 9.4 Nieśmiertelni bohaterowie

- Celowanie fortecy w bohaterów i „damage” do nich istnieje w logice, ale `damageHero` nic nie robi.
- De facto walka jest „tylko” o HP twierdz, przy zachowaniu targetowania i ruchu bohaterów.

### 9.5 Turrety w buildzie

- `getUserBuildData` pobiera `turretConfigs`, ale `toBuildConfig` ich nie przekazuje.  
Arena i tak nie korzysta z turretów — spójne z `ArenaBuildConfig`, ale warto to wyraźnie udokumentować („tylko fortress + heroes”).

### 9.6 Ekspiracja wyzwań

- Wyzwania wygasają po 24 h. Serwer przy accept sprawdza `expiresAt`.  
Brak osobnego crona/joba czyszczącego stare PENDING — można rozważyć okresowe oznaczanie EXPIRED.

---

## 10. Rekomendacje

1. **Ujednolicenie build vs matchmaking**
   - Albo rozszerzyć `ArenaBuildConfig` i `createArenaSide` o artefakty/tier/hero upgrades (i używać ich w symulacji),  
   - Albo liczyć „moc” do matchmakingu w ten sam sposób, co build areny (bez artefaktów itd.), żeby nie było rozjazdu.

2. **OpponentsList**
   - Usunąć lub zmienić warunek `response.result && response.rewards` po `createChallenge`.  
   - Np. po utworzeniu wyzwania: komunikat „Wyzwanie wysłane” + ewentualne przełączenie na zakładkę „Wyzwania”, zamiast oczekiwania na wynik.

3. **Losowość przeciwników**
   - Dodać `orderBy: { id: 'asc' }` (lub inny stabilny klucz) + losowe `skip` w wąskim przedziale,  
   - Lub `ORDER BY random()` (np. `raw` w Prisma) / shuffle po stronie serwera, żeby realnie „randomizować” listę.

4. **Rate limiting**
   - Dodać w `rateLimit.ts` osobny limit dla PvP (np. challenges 20/min per user) i użyć `withRateLimit` na trasach PvP,  
   - Albo zaktualizować README, jeśli celowo zostaje limit globalny.

5. **Dokumentacja**
   - W `pvp-arena.md` doprecyzować: brak turretów w arenie, że „moc” matchmakingu może różnić się od buildu walki (dopóki nie ujednolicimy), oraz że bohaterowie nie tracą HP w arenie.

6. **Ekspiracja**
   - Rozważyć job okresowo ustawiający `PENDING` → `EXPIRED` dla `expiresAt < now()`.

7. **Testy**
   - `packages/sim-core`: testy areny (`pnpm test arena`).  
   - `apps/server`: testy integracyjne tras PvP w `__tests__/integration/routes/pvp.test.ts`.

---

## 11. Podsumowanie

System **async PvP** w Grow Fortress realizuje typowy flow „wyzwanie → późniejsza akceptacja → symulacja na serwerze → replay”. Kluczowe elementy:

- **Async**: brak wymogu jednoczesnej obecności; wyzwania żyją 24 h, rozstrzygane przy accept.
- **Deterministyczna symulacja**: seed + buildy, Xorshift32, fixed-point; replay klienta = wynik serwera.
- **Honor**: hybrydowy system zależny od różnicy mocy.
- **Rest API + Preact signals + sim-core arena** są sensownie podzielone.

Do dopracowania: spójność buildu vs matchmaking, obsługa „result/rewards” w UI po create, rzeczywista losowość przeciwników, rate limiting PvP oraz doprecyzowanie dokumentacji i roli bohaterów/turretów w arenie.
