# Viral Distribution System - "Moment Engine"

## Problem

Gra nie ma graczy/społeczności. Standardowe metody pozyskiwania użytkowników (referral, marketing) nie działają przy zerowej bazie użytkowników.

## Rozwiązanie: Moment Engine

Unikalny system, który **automatycznie wykrywa spektakularne momenty** w grze i **generuje shareable content** z linkiem do gry. Każdy moment staje się potencjalnym wejściem dla nowych graczy.

### Kluczowe cechy

1. **Automatyczne wykrywanie** - System sam znajduje momenty warte udostępnienia
2. **Zero-effort sharing** - Gracz nie musi nic robić, system generuje content
3. **Unikalne linki** - Każdy moment ma swój link z kontekstem
4. **Network effects** - Im więcej graczy, tym więcej momentów
5. **Gamifikacja sharingu** - Nagrody za udostępnianie i za wejścia przez linki

---

## Mechanika: Moment Types

System wykrywa różne typy "momentów" w grze:

### 1. Achievement Moments
```typescript
interface AchievementMoment {
  type: 'achievement';
  achievementId: string;
  tier: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  timestamp: Date;
  stats: {
    // Kontekst osiągnięcia
    wavesCleared?: number;
    kills?: number;
    damage?: number;
  };
}
```

**Przykłady:**
- "Osiągnąłem 1000 fal!" → `growfortress.com/moment/ABC123`
- "Zabiłem 10,000 wrogów!" → `growfortress.com/moment/XYZ789`
- "Legendary drop!" → `growfortress.com/moment/DEF456`

### 2. Record Moments
```typescript
interface RecordMoment {
  type: 'record';
  category: 'waves' | 'damage' | 'kills' | 'time';
  value: number;
  previousRecord?: number;
  improvement: number; // % improvement
  timestamp: Date;
}
```

**Przykłady:**
- "Nowy rekord: 150 fal!" → `growfortress.com/moment/REC001`
- "Najwyższy damage: 1M!" → `growfortress.com/moment/REC002`

### 3. Epic Battle Moments
```typescript
interface BattleMoment {
  type: 'battle';
  battleType: 'pvp' | 'guild' | 'boss';
  result: 'victory' | 'defeat' | 'draw';
  highlights: {
    mvp?: string;
    clutchMoment?: boolean;
    comeback?: boolean;
    perfectWin?: boolean; // All heroes survived
  };
  replayId?: string;
  timestamp: Date;
}
```

**Przykłady:**
- "Wygrana w PvP z comeback!" → `growfortress.com/moment/BTL123`
- "Perfect win - wszyscy bohaterowie żywi!" → `growfortress.com/moment/BTL456`

### 4. Discovery Moments
```typescript
interface DiscoveryMoment {
  type: 'discovery';
  discoveryType: 'synergy' | 'combo' | 'secret' | 'build';
  description: string;
  screenshot?: string;
  timestamp: Date;
}
```

**Przykłady:**
- "Odkryłem nową synergię: Fire + Lightning!" → `growfortress.com/moment/DSC001`
- "Secret build: 6 synergii jednocześnie!" → `growfortress.com/moment/DSC002`

### 5. Challenge Moments
```typescript
interface ChallengeMoment {
  type: 'challenge';
  challengeId: string;
  challengeName: string;
  creatorId: string;
  participants: number;
  bestScore?: number;
  timestamp: Date;
}
```

**Przykłady:**
- "Wyzwanie: 50 fal bez wieżyczek!" → `growfortress.com/challenge/CHL001`
- "Podejmij wyzwanie!" → `growfortress.com/challenge/CHL002`

---

## Automatyczne Generowanie Momentów

### Trigger System

System automatycznie wykrywa momenty podczas gry:

```typescript
// apps/server/src/services/momentEngine.ts

interface MomentTrigger {
  condition: (gameState: GameState, user: User) => boolean;
  generateMoment: (context: MomentContext) => Promise<Moment>;
  priority: number; // Wyższy = ważniejszy moment
}

const MOMENT_TRIGGERS: MomentTrigger[] = [
  // Achievement triggers
  {
    condition: (state, user) => {
      // Sprawdź czy gracz właśnie osiągnął nowy tier achievementu
      return checkNewAchievementTier(user.id);
    },
    generateMoment: async (ctx) => {
      const achievement = await getLatestAchievement(ctx.userId);
      return {
        type: 'achievement',
        achievementId: achievement.id,
        tier: achievement.tier,
        rarity: getRarity(achievement.tier),
        // ...
      };
    },
    priority: 5,
  },
  
  // Record triggers
  {
    condition: (state, user) => {
      // Sprawdź czy gracz pobił swój rekord
      return checkPersonalRecord(user.id, 'waves', state.wave);
    },
    generateMoment: async (ctx) => {
      const record = await getPersonalRecord(ctx.userId, 'waves');
      return {
        type: 'record',
        category: 'waves',
        value: record.value,
        previousRecord: record.previous,
        improvement: calculateImprovement(record),
        // ...
      };
    },
    priority: 7,
  },
  
  // Epic battle triggers
  {
    condition: (state, user) => {
      // Sprawdź czy była spektakularna bitwa
      return state.battleResult?.perfectWin || state.battleResult?.comeback;
    },
    generateMoment: async (ctx) => {
      return {
        type: 'battle',
        battleType: ctx.battleType,
        result: ctx.battleResult.winner,
        highlights: {
          perfectWin: ctx.battleResult.perfectWin,
          comeback: ctx.battleResult.comeback,
        },
        replayId: ctx.replayId,
        // ...
      };
    },
    priority: 8,
  },
  
  // Discovery triggers
  {
    condition: (state, user) => {
      // Sprawdź czy gracz odkrył nową synergię
      return checkNewSynergyDiscovery(user.id, state.activeSynergies);
    },
    generateMoment: async (ctx) => {
      const synergy = await getLatestSynergyDiscovery(ctx.userId);
      return {
        type: 'discovery',
        discoveryType: 'synergy',
        description: `Odkryłem synergię: ${synergy.name}!`,
        // ...
      };
    },
    priority: 6,
  },
];
```

### Moment Generation Flow

```
1. Gracz kończy sesję / osiąga milestone
   ↓
2. System sprawdza wszystkie trigger conditions
   ↓
3. Wybiera najważniejszy moment (najwyższy priority)
   ↓
4. Generuje unikalny link: growfortress.com/moment/{momentId}
   ↓
5. Tworzy shareable content (obrazek + tekst)
   ↓
6. Pokazuje graczowi: "Chcesz się tym podzielić?"
   ↓
7. Jeśli TAK → automatycznie kopiuje link do schowka
   ↓
8. Jeśli ktoś wejdzie przez link → nagrody dla obu
```

---

## Shareable Content Generation

### Auto-Generated Images

System automatycznie generuje obrazy do udostępnienia:

```typescript
interface ShareableContent {
  momentId: string;
  imageUrl: string; // Auto-generated image
  text: string; // Auto-generated text
  link: string; // growfortress.com/moment/{momentId}
  metadata: {
    ogImage: string;
    ogTitle: string;
    ogDescription: string;
  };
}

async function generateShareableContent(moment: Moment): Promise<ShareableContent> {
  // 1. Generuj obrazek z osiągnięciem
  const image = await generateMomentImage(moment);
  
  // 2. Generuj tekst
  const text = generateMomentText(moment);
  
  // 3. Stwórz unikalny link
  const momentId = await createMoment(moment);
  const link = `https://growfortress.com/moment/${momentId}`;
  
  return {
    momentId,
    imageUrl: image.url,
    text,
    link,
    metadata: {
      ogImage: image.url,
      ogTitle: text,
      ogDescription: `Zobacz mój moment w Grow Fortress!`,
    },
  };
}
```

### Przykładowe obrazy

1. **Achievement Card**
   - Tło z gradientem (zależnie od rarity)
   - Ikona achievementu
   - Nazwa + tier
   - Statystyki (np. "1000 fal")
   - Logo gry na dole

2. **Record Card**
   - Tło z animacją
   - Duża liczba (rekord)
   - "Nowy rekord!"
   - Poprzedni rekord dla porównania
   - Logo gry

3. **Battle Replay Card**
   - Screenshot z bitwy
   - "Perfect Win!" lub "Epic Comeback!"
   - Statystyki (MVP, damage, etc.)
   - Link do replay
   - Logo gry

---

## Challenge System

Gracze mogą tworzyć wyzwania, które inni mogą podjąć:

```typescript
interface Challenge {
  id: string;
  creatorId: string;
  name: string;
  description: string;
  rules: {
    maxWaves?: number;
    noTurrets?: boolean;
    specificHeroes?: string[];
    timeLimit?: number;
  };
  reward: {
    gold: number;
    dust: number;
  };
  participants: number;
  bestScore?: {
    userId: string;
    displayName: string;
    score: number;
  };
  createdAt: Date;
  expiresAt: Date;
}

// API
POST /v1/challenges/create
GET  /v1/challenges/:id
POST /v1/challenges/:id/attempt
GET  /v1/challenges/trending
```

**Przykłady wyzwań:**
- "50 fal bez wieżyczek"
- "Solo hero run"
- "Speedrun: 30 fal w 5 minut"
- "No damage challenge"

**Viral potential:**
- Każde wyzwanie ma link: `growfortress.com/challenge/{id}`
- Gracze dzielą się wyzwaniami
- Najlepsze wyniki są widoczne publicznie
- Tworzy rywalizację i engagement

---

## Landing Pages dla Momentów

### Moment Page: `/moment/:momentId`

```tsx
<MomentPage>
  <MomentCard moment={moment} />
  <PlayerInfo player={moment.creator} />
  <Stats stats={moment.stats} />
  <CallToAction>
    <Button>Zagraj teraz za darmo</Button>
    <Button>Zobacz replay</Button>
  </CallToAction>
  <RelatedMoments />
</MomentPage>
```

**Funkcje:**
- Pokazuje moment gracza
- Informacje o graczu (opcjonalnie)
- Statystyki momentu
- **CTA: "Zagraj teraz"** - bezpośrednie wejście do gry
- Podobne momenty innych graczy
- Social sharing buttons

### Challenge Page: `/challenge/:challengeId`

```tsx
<ChallengePage>
  <ChallengeInfo challenge={challenge} />
  <Leaderboard entries={challenge.leaderboard} />
  <Rules rules={challenge.rules} />
  <CallToAction>
    <Button>Podejmij wyzwanie</Button>
  </CallToAction>
  <RecentAttempts />
</ChallengePage>
```

---

## Network Effects & Rewards

### Dla twórcy momentu

```typescript
interface MomentRewards {
  views: number;        // Ile osób zobaczyło moment
  clicks: number;      // Ile osób kliknęło "Zagraj"
  conversions: number;  // Ile osób zarejestrowało się
  rewards: {
    gold: number;       // 100 gold per conversion
    dust: number;       // 10 dust per conversion
    title?: string;     // "Viral Master" po 100 conversions
  };
}
```

### Dla osoby wchodzącej przez link

```typescript
interface ReferralRewards {
  // Standardowe referral rewards
  gold: 300;
  dust: 10;
  
  // Bonus za wejście przez moment
  bonusGold: 100;  // Dodatkowy bonus
  bonusDust: 5;
  
  // Unlock specjalnej zawartości
  unlockChallenge?: string; // Odblokuj wyzwanie z momentu
}
```

### Viral Multiplier

Im więcej osób wejdzie przez moment, tym większe nagrody dla twórcy:

```typescript
function calculateViralRewards(conversions: number): Rewards {
  const baseGold = 100;
  const baseDust = 10;
  
  // Multiplier: 1.1x per 10 conversions (max 5x)
  const multiplier = Math.min(1 + (conversions / 10) * 0.1, 5);
  
  return {
    gold: Math.floor(baseGold * multiplier * conversions),
    dust: Math.floor(baseDust * multiplier * conversions),
  };
}
```

---

## Implementacja

### 1. Database Schema

```prisma
model Moment {
  id          String   @id @default(cuid())
  userId      String
  type        String   // 'achievement' | 'record' | 'battle' | 'discovery' | 'challenge'
  momentData  Json     // Type-specific data
  shareableContent Json // Generated image/text
  
  // Stats
  views       Int      @default(0)
  clicks      Int      @default(0)
  conversions Int      @default(0)
  
  // Rewards
  rewardsClaimed Boolean @default(false)
  totalRewards   Json    // { gold, dust }
  
  createdAt   DateTime @default(now())
  expiresAt   DateTime? // Optional expiry
  
  user        User     @relation(fields: [userId], references: [id])
  visits      MomentVisit[]
  
  @@index([userId, createdAt])
  @@index([type, createdAt])
}

model MomentVisit {
  id        String   @id @default(cuid())
  momentId  String
  visitorId String?  // null for anonymous
  ipAddress String?
  userAgent String?
  clicked   Boolean  @default(false)
  converted Boolean  @default(false)
  visitedAt DateTime @default(now())
  
  moment    Moment   @relation(fields: [momentId], references: [id])
  
  @@index([momentId, visitedAt])
}

model Challenge {
  id          String   @id @default(cuid())
  creatorId  String
  name        String
  description String
  rules       Json
  reward      Json     // { gold, dust }
  
  participants Int     @default(0)
  bestScore    Json?   // { userId, displayName, score }
  
  createdAt   DateTime @default(now())
  expiresAt   DateTime
  
  creator     User     @relation(fields: [creatorId], references: [id])
  attempts    ChallengeAttempt[]
  
  @@index([creatorId, createdAt])
  @@index([expiresAt])
}

model ChallengeAttempt {
  id          String   @id @default(cuid())
  challengeId String
  userId      String
  score       Int
  result      Json     // Full attempt data
  completedAt DateTime @default(now())
  
  challenge   Challenge @relation(fields: [challengeId], references: [id])
  user        User      @relation(fields: [userId], references: [id])
  
  @@index([challengeId, score])
  @@index([userId, completedAt])
}
```

### 2. Service: `momentEngine.ts`

```typescript
// apps/server/src/services/momentEngine.ts

/**
 * Sprawdź czy powinien być wygenerowany moment po zakończeniu sesji
 */
export async function checkAndCreateMoment(
  userId: string,
  sessionResult: SessionResult
): Promise<Moment | null> {
  // Sprawdź wszystkie trigger conditions
  const triggers = MOMENT_TRIGGERS.filter(t => 
    t.condition(sessionResult.gameState, await getUser(userId))
  );
  
  if (triggers.length === 0) return null;
  
  // Wybierz najważniejszy (najwyższy priority)
  const bestTrigger = triggers.reduce((best, current) => 
    current.priority > best.priority ? current : best
  );
  
  // Generuj moment
  const moment = await bestTrigger.generateMoment({
    userId,
    gameState: sessionResult.gameState,
    sessionResult,
  });
  
  // Twórz shareable content
  const content = await generateShareableContent(moment);
  
  // Zapisz w bazie
  return await prisma.moment.create({
    data: {
      userId,
      type: moment.type,
      momentData: moment,
      shareableContent: content,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dni
    },
  });
}

/**
 * Pobierz moment po ID (dla landing page)
 */
export async function getMoment(momentId: string): Promise<Moment | null> {
  const moment = await prisma.moment.findUnique({
    where: { id: momentId },
    include: { user: { select: { displayName: true } } },
  });
  
  if (!moment) return null;
  
  // Zwiększ licznik views
  await prisma.moment.update({
    where: { id: momentId },
    data: { views: { increment: 1 } },
  });
  
  // Zapisz visit
  await prisma.momentVisit.create({
    data: {
      momentId,
      visitedAt: new Date(),
    },
  });
  
  return moment;
}

/**
 * Obsłuż kliknięcie "Zagraj" na moment page
 */
export async function handleMomentClick(
  momentId: string,
  visitorId?: string
): Promise<{ redirectUrl: string; rewards?: Rewards }> {
  const moment = await prisma.moment.findUnique({
    where: { id: momentId },
  });
  
  if (!moment) throw new Error('MOMENT_NOT_FOUND');
  
  // Zwiększ licznik clicks
  await prisma.moment.update({
    where: { id: momentId },
    data: { clicks: { increment: 1 } },
  });
  
  // Zapisz click
  await prisma.momentVisit.updateMany({
    where: { momentId, visitorId: visitorId || null },
    data: { clicked: true },
  });
  
  // Jeśli visitor się zarejestruje → conversion
  // (to będzie wywołane w auth service)
  
  return {
    redirectUrl: '/play?ref=moment',
    rewards: visitorId ? REFERRAL_REWARDS.invitee : undefined,
  };
}
```

### 3. Routes

```typescript
// apps/server/src/routes/moments.ts

fastify.get('/moment/:momentId', async (request, reply) => {
  const moment = await getMoment(request.params.momentId);
  if (!moment) return reply.status(404).send({ error: 'Moment not found' });
  return reply.send(moment);
});

fastify.post('/moment/:momentId/click', async (request, reply) => {
  const result = await handleMomentClick(
    request.params.momentId,
    request.userId
  );
  return reply.send(result);
});

fastify.get('/challenges/trending', async (request, reply) => {
  const challenges = await getTrendingChallenges();
  return reply.send({ challenges });
});
```

---

## UI/UX

### 1. Moment Notification (po sesji)

```tsx
<MomentNotification>
  <Icon type="trophy" />
  <Title>Osiągnąłeś nowy rekord!</Title>
  <Description>150 fal - gratulacje!</Description>
  <ShareButton onClick={copyMomentLink}>
    Udostępnij
  </ShareButton>
  <DismissButton />
</MomentNotification>
```

### 2. Share Modal

```tsx
<ShareModal moment={moment}>
  <Preview image={moment.shareableContent.imageUrl} />
  <Text>{moment.shareableContent.text}</Text>
  <LinkInput value={moment.link} readOnly />
  <CopyButton onClick={copyToClipboard}>
    Kopiuj link
  </CopyButton>
  <SocialButtons>
    <TwitterButton />
    <FacebookButton />
    <DiscordButton />
  </SocialButtons>
</ShareModal>
```

### 3. Challenge Creation

```tsx
<CreateChallengeModal>
  <Input name="name" placeholder="Nazwa wyzwania" />
  <Textarea name="description" />
  <RulesEditor rules={rules} />
  <RewardInput gold={100} dust={10} />
  <CreateButton>Utwórz wyzwanie</CreateButton>
</CreateChallengeModal>
```

---

## Unikalność Systemu

### Co czyni to unikalnym:

1. **Zero-effort** - Gracz nie musi nic robić, system sam wykrywa momenty
2. **Automatyczne generowanie** - Obrazki i tekst są generowane automatycznie
3. **Kontekstowe linki** - Każdy link prowadzi do konkretnego momentu, nie tylko do gry
4. **Challenge system** - Gracze tworzą content dla innych graczy
5. **Network effects** - Im więcej graczy, tym więcej momentów i wyzwań
6. **Gamifikacja sharingu** - Nagrody za udostępnianie i za conversions

### Porównanie z innymi systemami:

| System | Nasz | Standardowy Referral | Social Media |
|-------|------|---------------------|--------------|
| Wymaga akcji gracza | ❌ Automatyczny | ✅ Tak | ✅ Tak |
| Generuje content | ✅ Auto | ❌ Nie | ❌ Nie |
| Kontekstowe linki | ✅ Tak | ❌ Nie | ❌ Nie |
| Network effects | ✅ Tak | ⚠️ Ograniczone | ⚠️ Ograniczone |
| Gamifikacja | ✅ Tak | ⚠️ Podstawowa | ❌ Nie |

---

## Metryki sukcesu

1. **Moment Generation Rate** - Ile momentów na gracza/tydzień
2. **Share Rate** - % momentów które są udostępniane
3. **Click-Through Rate** - % views → clicks
4. **Conversion Rate** - % clicks → registrations
5. **Viral Coefficient** - Średnia liczba nowych graczy per moment
6. **Challenge Participation** - Ile osób podejmuje wyzwania

---

## Roadmap

### Faza 1: Basic Moments (Tydzień 1-2)
- Achievement moments
- Record moments
- Basic shareable content
- Landing pages

### Faza 2: Battle Moments (Tydzień 3)
- PvP battle moments
- Guild battle moments
- Replay integration

### Faza 3: Challenge System (Tydzień 4)
- Challenge creation
- Challenge leaderboards
- Challenge rewards

### Faza 4: Discovery Moments (Tydzień 5)
- Synergy discoveries
- Build discoveries
- Secret discoveries

### Faza 5: Optimization (Tydzień 6+)
- A/B testing moment types
- Optimization shareable content
- Viral multiplier tuning

---

*System zaprojektowany specjalnie dla Grow Fortress - unikalny algorytm pozyskiwania graczy poprzez automatyczne wykrywanie i udostępnianie spektakularnych momentów.*
