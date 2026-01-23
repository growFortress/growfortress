# Analiza Indeksów Bazy Danych

## Podsumowanie

Przeanalizowano schemat bazy danych i częste zapytania w aplikacji. Większość kluczowych zapytań ma odpowiednie indeksy, ale zidentyfikowano kilka obszarów do poprawy.

## ✅ Dobrze Zaindeksowane Zapytania

### 1. Leaderboardy
- `LeaderboardEntry`: `@@index([weekKey, score(sort: Desc)])` ✅
- `GuildLeaderboardEntry`: `@@index([weekKey, honor(sort: Desc)])` ✅
- `WeeklyPlayerLeaderboard`: `@@index([weekKey, wavesThisWeek(sort: Desc)])` ✅
- `BossRushLeaderboard`: `@@index([weekKey, totalDamage(sort: Desc)])` ✅

### 2. Relacje Użytkowników
- `Session.userId` ✅
- `GuildMember.userId` i `guildId` ✅
- `MessageParticipant.userId` ✅
- `Run.userId` ✅
- `GameSession.userId` ✅

### 3. System Wiadomości
- `Message.threadId, createdAt` (composite) ✅
- `MessageThread.lastMessageAt` (DESC) ✅
- `MessageParticipant.userId, unreadCount` (composite) ✅

### 4. System Gildii
- `Guild.honor` (DESC) ✅
- `GuildBattle.attackerGuildId, defenderGuildId, status` ✅
- `GuildInvitation.guildId, inviteeId, status` ✅
- `GuildTreasuryLog.guildId, userId, transactionType, createdAt` ✅

### 5. PvP Arena
- `PvpChallenge.challengerId, challengedId, status` ✅
- `PvpChallenge.challengerId, challengedId, createdAt` (composite dla cooldown) ✅

### 6. Inne
- `TelemetryEvent.createdAt, eventType` ✅
- `SupportTicket.userId, status, createdAt` ✅
- `AuditLog.adminId, targetId, action` ✅

## ⚠️ Potencjalne Braki Indeksów

### 1. User Model

#### `User.banned`
**Problem**: Często używane w zapytaniach filtrujących aktywnych użytkowników
```typescript
// Przykład z messages.ts:843
where: { banned: false }
```
**Rekomendacja**: Dodaj indeks
```prisma
@@index([banned])
```

#### `User.displayName`
**Problem**: Używane w wyszukiwaniu użytkowników (case-insensitive)
```typescript
// Przykład z messages.ts:750
{ displayName: { contains: query, mode: 'insensitive' } }
```
**Rekomendacja**: Rozważ indeks GIN dla pełnotekstowego wyszukiwania lub indeks na `LOWER(displayName)` dla PostgreSQL

#### `User.username` (wyszukiwanie)
**Status**: Ma `@unique`, ale wyszukiwanie z `contains` może być wolne
**Rekomendacja**: Rozważ indeks GIN dla pełnotekstowego wyszukiwania

### 2. Guild Model

#### `Guild.disbanded`
**Problem**: Często używane w zapytaniach filtrujących aktywne gildie
```typescript
// Przykład z guildPreview.ts:41
where: { id: guildId, disbanded: false }
```
**Rekomendacja**: Dodaj indeks
```prisma
@@index([disbanded])
```
**Lub lepiej**: Composite index dla częstych zapytań
```prisma
@@index([disbanded, honor(sort: Desc)])
```

### 3. MessageParticipant Model

#### `MessageParticipant.deletedAt`
**Problem**: Często używane w zapytaniach filtrujących nieusunięte uczestnictwa
```typescript
// Przykład z messages.ts:52
deletedAt: null
```
**Rekomendacja**: Dodaj composite index
```prisma
@@index([userId, deletedAt])
```

### 4. PillarChallengeSession Model

#### `PillarChallengeSession.verified, pillarId, tier, wavesCleared`
**Problem**: Composite query w leaderboardzie
```typescript
// Przykład z pillarChallenge.ts:1032
where: {
  pillarId,
  tier: tierNum,
  verified: true,
  wavesCleared: tierConfig.waveCount,
}
orderBy: [{ endedAt: 'asc' }]
```
**Rekomendacja**: Dodaj composite index
```prisma
@@index([pillarId, tier, verified, wavesCleared, endedAt])
```

### 5. Run Model

#### `Run.verified` (już istnieje)
**Status**: ✅ Ma indeks `@@index([verified])`

### 6. ChatMessage Model

**Status**: ✅ Dobrze zindeksowane
- `@@index([scope, createdAt(sort: Desc)])` ✅
- `@@index([guildId, createdAt(sort: Desc)])` ✅

### 7. GuildTowerRaceEntry Model

**Status**: ✅ Dobrze zindeksowane
- `@@index([totalWaves(sort: Desc)])` ✅

### 8. ActiveBooster Model

**Status**: ✅ Dobrze zindeksowane
- `@@index([expiresAt])` ✅ (dla cleanup jobów)

### 9. UserMute Model

**Status**: ✅ Dobrze zindeksowane
- `@@index([expiresAt])` ✅ (dla cleanup jobów)

## 📊 Rekomendacje Priorytetowe

### Wysoki Priorytet

1. **`User.banned`** - Często używane w wielu zapytaniach
2. **`Guild.disbanded`** - Używane w preview i wyszukiwaniu gildii
3. **`MessageParticipant.deletedAt`** - Używane w każdym zapytaniu o wątki

### Średni Priorytet

4. **`PillarChallengeSession` composite index** - Dla leaderboardów challenge
5. **`User.displayName`** - Dla wyszukiwania użytkowników (jeśli tabela rośnie)

### Niski Priorytet

6. **`User.username` GIN index** - Tylko jeśli wyszukiwanie staje się wolne

## 🔧 Migracja Utworzona

Migracja została utworzona: `20260123173312_add_missing_indexes`

### Zawartość migracji:

```sql
-- Wysoki priorytet
CREATE INDEX "User_banned_idx" ON "User"("banned");
CREATE INDEX "Guild_disbanded_idx" ON "Guild"("disbanded");
CREATE INDEX "MessageParticipant_userId_deletedAt_idx" ON "MessageParticipant"("userId", "deletedAt");

-- Średni priorytet
CREATE INDEX "PillarChallengeSession_pillarId_tier_verified_wavesCleared_endedAt_idx" 
  ON "PillarChallengeSession"("pillarId", "tier", "verified", "wavesCleared", "endedAt");
```

### Aby zastosować migrację:

```bash
cd apps/server
npx prisma migrate deploy
```

Lub w środowisku deweloperskim:
```bash
cd apps/server
npx prisma migrate dev
```

### Opcjonalne (niezaimplementowane - tylko jeśli potrzebne):

```sql
-- Dla wyszukiwania użytkowników (jeśli tabela rośnie i wyszukiwanie staje się wolne)
CREATE INDEX "User_displayName_lower_idx" ON "User"(LOWER("displayName"));
```

## 📝 Uwagi

1. **Indeksy boolean**: W PostgreSQL indeksy na kolumnach boolean mogą być mniej efektywne jeśli mają niską selektywność (np. większość użytkowników nie jest zbanowana). Rozważ użycie partial index:
   ```sql
   CREATE INDEX "User_banned_idx" ON "User"("banned") WHERE "banned" = true;
   ```

2. **Composite indexes**: Kolejność kolumn w composite index jest ważna. Ustaw najpierw kolumny z najwyższą selektywnością.

3. **Monitorowanie**: Po dodaniu indeksów, monitoruj:
   - Czas wykonywania zapytań
   - Rozmiar bazy danych
   - Czas INSERT/UPDATE (indeksy spowalniają zapisy)

4. **EXPLAIN ANALYZE**: Użyj `EXPLAIN ANALYZE` w PostgreSQL, aby zweryfikować użycie indeksów w rzeczywistych zapytaniach.

## ✅ Podsumowanie

**Ogólna ocena**: **8/10**

Większość kluczowych zapytań ma odpowiednie indeksy. Główne obszary do poprawy:
- Filtrowanie po boolean flagach (`banned`, `disbanded`)
- Soft delete patterns (`deletedAt`)
- Composite queries w leaderboardach challenge

Po dodaniu rekomendowanych indeksów, wydajność zapytań powinna być optymalna.
