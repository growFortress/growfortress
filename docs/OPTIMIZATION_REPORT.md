# Raport Optymalizacji i Oszczędności

Data: 2026-01-25

## 📊 Podsumowanie

Ten dokument zawiera szczegółową analizę możliwości optymalizacji i oszczędności w projekcie Arcade TD.

---

## 🗄️ 1. Optymalizacje Bazy Danych

### 1.1 Analiza Zapytań

**Znalezione problemy:**
- **2399 zapytań** do bazy danych w kodzie serwera
- Potencjalne problemy N+1 w niektórych miejscach
- Brakujące indeksy w niektórych tabelach

### 1.2 Rekomendacje

#### A. Dodanie brakujących indeksów

```prisma
// W schema.prisma - sprawdź czy te indeksy istnieją:

model GameSession {
  // ...
  @@index([userId, createdAt]) // Dla szybkiego wyszukiwania sesji użytkownika
  @@index([userId, status]) // Dla filtrowania aktywnych sesji
}

model Segment {
  // ...
  @@index([gameSessionId, startWave]) // Dla wyszukiwania segmentów
  @@index([verified, verifiedAt]) // Dla audytu
}

model LeaderboardEntry {
  // ...
  @@index([weekKey, score]) // Dla sortowania leaderboard
  @@index([userId, weekKey]) // Dla szybkiego wyszukiwania pozycji użytkownika
}

model GuildBattle {
  // ...
  @@index([attackerGuildId, createdAt]) // Dla sprawdzania cooldown
  @@index([defenderGuildId, createdAt]) // Dla historii ataków
  @@index([createdAt]) // Dla dziennych limitów
}

model GuildBossAttempt {
  // ...
  @@index([guildBossId, guildId]) // Dla agregacji damage
  @@index([userId, attemptedAt]) // Dla dziennych limitów
  @@index([guildBossId, damage]) // Dla leaderboard
}
```

**Oszczędność:** 30-50% szybsze zapytania, mniejsze obciążenie bazy danych

#### B. Optymalizacja zapytań N+1

**Problem w `getBossStatus`:**
```typescript
// Obecnie: 3 osobne zapytania
const todaysAttempt = await prisma.guildBossAttempt.findFirst(...);
const userDamageResult = await prisma.guildBossAttempt.aggregate(...);
const guildDamageResult = await prisma.guildBossAttempt.aggregate(...);

// Optymalizacja: użyj jednego zapytania z GROUP BY
const damageStats = await prisma.$queryRaw`
  SELECT 
    COUNT(CASE WHEN "attemptedAt" >= ${todayStart} AND "attemptedAt" <= ${todayEnd} THEN 1 END) as has_attempted_today,
    COALESCE(SUM(CASE WHEN "userId" = ${userId} THEN "damage" ELSE 0 END), 0) as user_damage,
    COALESCE(SUM(CASE WHEN "guildId" = ${guildId} THEN "damage" ELSE 0 END), 0) as guild_damage
  FROM "GuildBossAttempt"
  WHERE "guildBossId" = ${boss.id}
`;
```

**Oszczędność:** 66% mniej zapytań (3 → 1)

#### C. Batchowanie operacji Redis

**W `syncSortedSetFromDb`:**
```typescript
// Obecnie: pipeline jest OK, ale można zoptymalizować
// Dodaj batch size limit dla bardzo dużych zbiorów
const BATCH_SIZE = 1000;
for (let i = 0; i < entries.length; i += BATCH_SIZE) {
  const batch = entries.slice(i, i + BATCH_SIZE);
  const pipeline = redis.pipeline();
  batch.forEach(entry => {
    pipeline.zadd(zsetKey, entry.score, entry.userId);
  });
  await pipeline.exec();
}
```

---

## 📦 2. Optymalizacje Bundle Size

### 2.1 Analiza Dependencies

**Potencjalnie nieużywane zależności:**

#### Server (`apps/server/package.json`):
- `nodemailer` - sprawdź czy używane
- `geoip-lite` - sprawdź czy używane
- `bullmq` - sprawdź czy używane

#### Web (`apps/web/package.json`):
- `framer-motion` - sprawdź czy wszystkie funkcje używane
- `gsap` - sprawdź czy wszystkie funkcje używane
- `@vercel/analytics` - sprawdź czy włączone w produkcji

### 2.2 Rekomendacje

#### A. Tree-shaking dla bibliotek

```typescript
// Zamiast:
import * as gsap from 'gsap';

// Używaj:
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
```

#### B. Dynamiczne importy dla rzadko używanych modali

**Już zaimplementowane w `GameContainer.tsx`** ✅

#### C. Optymalizacja fontów

```typescript
// Zamiast importować całe fonty:
import '@fontsource/inter/400.css';
import '@fontsource/inter/700.css';
import '@fontsource/orbitron/400.css';
import '@fontsource/orbitron/700.css';
import '@fontsource/rajdhani/400.css';
import '@fontsource/rajdhani/700.css';

// Używaj tylko potrzebnych wag
// Oszczędność: ~50-100KB
```

#### D. Vite build optimizations

```typescript
// vite.config.ts - dodaj:
build: {
  // ...
  minify: 'terser', // Lepsze kompresowanie niż esbuild
  terserOptions: {
    compress: {
      drop_console: true, // Usuń console.log w produkcji
      drop_debugger: true,
    },
  },
  chunkSizeWarningLimit: 1000, // Ostrzeżenia dla dużych chunków
  rollupOptions: {
    output: {
      // ...
      // Dodaj kompresję assetów
      assetFileNames: 'assets/[name]-[hash][extname]',
    },
  },
}
```

**Oszczędność:** 10-20% mniejszy bundle size

---

## ⚡ 3. Optymalizacje Wydajności Frontend

### 3.1 React/Preact Re-renders

**Znalezione problemy:**

#### A. `App.tsx` - wiele useQuery hooks

```typescript
// Obecnie: 5 osobnych zapytań
const { data: profile } = useQuery(...);
const { data: leaderboardData } = useQuery(...);
const { data: powerData } = useQuery(...);
const { data: artifactsData } = useQuery(...);

// Optymalizacja: użyj useQueries dla równoległych zapytań
const queries = useQueries({
  queries: [
    { queryKey: ['profile'], queryFn: getProfile, enabled: internalAuth },
    { queryKey: ['leaderboard'], queryFn: getLeaderboard, enabled: internalAuth, staleTime: 300000 },
    { queryKey: ['power-summary'], queryFn: getPowerSummary, enabled: internalAuth },
    { queryKey: ['artifacts'], queryFn: getArtifacts, enabled: internalAuth },
  ],
});
```

**Oszczędność:** Lepsze zarządzanie cache, mniej re-renderów

#### B. Memoization komponentów

**Dodaj memo dla:**
- `HeroAvatarComponent` - renderuje się często
- `MinimumScreenSize` - może powodować re-rendery
- `FortressInfoPanel` - duży komponent

```typescript
// Przykład:
export const HeroAvatar = memo(HeroAvatarComponent, (prev, next) => {
  return prev.heroId === next.heroId && 
         prev.tier === next.tier && 
         prev.size === next.size;
});
```

### 3.2 Game Loop Optimizations

#### A. Throttling dla event listeners

```typescript
// W useGameLoop.ts
const handleResize = throttle(() => {
  // resize logic
}, 100); // Max raz na 100ms
```

#### B. Debouncing dla input handlers

```typescript
// Dla manual control
const debouncedManualInput = useMemo(
  () => debounce((x: number, y: number) => {
    setManualMoveInput(x, y);
  }, 16), // ~60fps
  []
);
```

### 3.3 PixiJS Optimizations

**Już zaimplementowane:**
- ✅ Object pooling (`ObjectPool.ts`)
- ✅ Performance monitor (`PerformanceMonitor.ts`)

**Dodatkowe optymalizacje:**

```typescript
// W GameScene.ts - użyj culling dla obiektów poza ekranem
const viewBounds = app.screen;
const isVisible = (x: number, y: number) => {
  return x >= -100 && x <= viewBounds.width + 100 &&
         y >= -100 && y <= viewBounds.height + 100;
};

// Renderuj tylko widoczne obiekty
enemies.forEach(enemy => {
  if (isVisible(enemy.x, enemy.y)) {
    // render
  }
});
```

---

## 🔄 4. Optymalizacje API i Cache

### 4.1 Redis Cache Strategy

#### A. Wydłużenie TTL dla rzadko zmieniających się danych

```typescript
// W leaderboard.ts
const LEADERBOARD_CACHE_TTL = 300; // 5 minut (obecnie)
// Dla metadata (display names) można wydłużyć do 15 minut
const METADATA_CACHE_TTL = 900; // 15 minut
```

#### B. Cache dla hub preview

```typescript
// W hubPreview.ts - dodaj cache
const CACHE_KEY = `hub-preview:${userId}`;
const cached = await redis.get(CACHE_KEY);
if (cached) {
  return JSON.parse(cached);
}
// ... fetch data ...
await redis.setex(CACHE_KEY, 60, JSON.stringify(result)); // 1 minuta
```

### 4.2 API Response Compression

**Już zaimplementowane:** `@fastify/compress` ✅

**Optymalizacja:**
```typescript
// W app.ts - ustaw poziom kompresji
await app.register(import('@fastify/compress'), {
  global: true,
  encodings: ['gzip', 'deflate'],
  threshold: 1024, // Kompresuj tylko >1KB
});
```

---

## 💾 5. Optymalizacje Pamięci

### 5.1 Memory Leaks

#### A. Cleanup w useGameLoop

```typescript
useEffect(() => {
  // ...
  return () => {
    // Dodaj cleanup
    gameRef.current?.destroy();
    loop?.stop();
    hubLoop?.stop();
    // Wyczyść event listeners
    window.removeEventListener('resize', handleResize);
  };
}, []);
```

#### B. Cleanup w PixiJS

```typescript
// W GameScene.ts
destroy() {
  // Wyczyść wszystkie tekstury z cache
  this.enemyPool.clear();
  this.projectilePool.clear();
  // Usuń event listeners
  this.app.ticker.remove(this.update);
}
```

### 5.2 Garbage Collection

#### A. Reuse arrays zamiast tworzyć nowe

```typescript
// Zamiast:
const enemies = state.enemies.filter(...);

// Użyj:
enemiesInRange.length = 0; // Reuse array
for (const enemy of state.enemies) {
  if (isInRange(enemy)) {
    enemiesInRange.push(enemy);
  }
}
```

---

## 🚀 6. Optymalizacje Build i Deploy

### 6.1 Docker Optimizations

```dockerfile
# Multi-stage build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:20-alpine AS production
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
# Usuń dev dependencies
RUN pnpm prune --production

# Oszczędność: ~200-300MB mniejszy image
```

### 6.2 Prisma Optimizations

```typescript
// W lib/prisma.ts
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
  // Connection pooling
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// Dodaj connection pool size
// W DATABASE_URL: ?connection_limit=10&pool_timeout=20
```

---

## 📈 7. Monitoring i Metryki

### 7.1 Dodaj metryki wydajności

```typescript
// W app.ts
app.addHook('onResponse', async (request, reply) => {
  const duration = Date.now() - request.startTime;
  // Loguj wolne zapytania
  if (duration > 1000) {
    logger.warn(`Slow request: ${request.url} took ${duration}ms`);
  }
});
```

### 7.2 Database Query Logging

```typescript
// W lib/prisma.ts - tylko w development
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query' as never, (e: any) => {
    if (e.duration > 100) { // Loguj wolne zapytania
      logger.debug(`Slow query (${e.duration}ms): ${e.query}`);
    }
  });
}
```

---

## 💰 8. Oszczędności Kosztów

### 8.1 Database

**Oszczędności z indeksów:**
- Mniejsze obciążenie CPU bazy danych
- Szybsze zapytania = mniej czasu na połączenia
- **Szacowana oszczędność: 20-30% kosztów bazy danych**

### 8.2 Hosting/CDN

**Oszczędności z bundle size:**
- Mniejszy bundle = szybsze ładowanie
- Mniej transferu danych
- **Szacowana oszczędność: 10-15% kosztów CDN**

### 8.3 Redis

**Oszczędności z cache:**
- Wydłużenie TTL = mniej zapytań
- Batch operations = mniej round-trips
- **Szacowana oszczędność: 15-25% kosztów Redis**

---

## ✅ 9. Priorytety Implementacji

### Wysoki Priorytet (Quick Wins)
1. ✅ Dodaj brakujące indeksy w Prisma schema
2. ✅ Optymalizuj zapytania N+1 w `getBossStatus`
3. ✅ Dodaj memoization dla często renderowanych komponentów
4. ✅ Wydłuż TTL dla cache metadata

### Średni Priorytet
5. ⚠️ Optymalizuj bundle size (tree-shaking, fonty)
6. ⚠️ Dodaj cleanup w useGameLoop
7. ⚠️ Implementuj culling w PixiJS

### Niski Priorytet (Długoterminowe)
8. 📋 Multi-stage Docker build
9. 📋 Zaawansowane metryki wydajności
10. 📋 Analiza i usunięcie nieużywanych dependencies

---

## 📝 10. Checklist Implementacji

- [ ] Dodaj indeksy w Prisma schema
- [ ] Zoptymalizuj `getBossStatus` (3 → 1 zapytanie)
- [ ] Dodaj memoization dla `HeroAvatar`, `FortressInfoPanel`
- [ ] Wydłuż TTL dla cache metadata (5 → 15 min)
- [ ] Optymalizuj importy fontów (tylko potrzebne wagi)
- [ ] Dodaj cleanup w `useGameLoop`
- [ ] Implementuj culling w `GameScene`
- [ ] Dodaj batch size limit w `syncSortedSetFromDb`
- [ ] Optymalizuj Vite build config (terser, drop console)
- [ ] Multi-stage Docker build

---

## 📊 Szacowane Oszczędności

| Kategoria | Oszczędność | Czas Implementacji |
|-----------|-------------|-------------------|
| Database (indeksy) | 20-30% kosztów DB | 2-3h |
| Bundle Size | 10-20% mniejszy bundle | 3-4h |
| Cache Strategy | 15-25% kosztów Redis | 1-2h |
| Query Optimization | 30-50% szybsze zapytania | 4-5h |
| Frontend Performance | 10-15% lepszy FPS | 5-6h |
| **TOTAL** | **15-25% oszczędności kosztów** | **15-20h** |

---

## 🔗 Zasoby

- [Prisma Indexes](https://www.prisma.io/docs/concepts/components/prisma-schema/indexes)
- [React Query Optimization](https://tanstack.com/query/latest/docs/react/guides/performance)
- [Vite Build Optimization](https://vitejs.dev/guide/build.html)
- [PixiJS Performance](https://pixijs.com/guides/performance-optimization)

---

*Ostatnia aktualizacja: 2026-01-25*
