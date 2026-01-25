# Organic Growth System - "Public Challenges & Social Proof"

## Problem

Nikt nie będzie wchodził w linki. Potrzebujemy systemu, który:
- **Nie wymaga klikania w linki** - wszystko działa w grze
- **Działa przy zerowej bazie użytkowników** - rozwiązuje "cold start"
- **Tworzy powody do grania** - które naturalnie przyciągają innych
- **Używa mechanizmów, które już działają** - leaderboardy, gildie, PvP

---

## Rozwiązanie: Public Challenge System

System **publicznych wyzwań**, które są **widoczne dla wszystkich** (nawet gości) i tworzą naturalne powody do grania i rywalizacji.

### Kluczowe założenia

1. **Wszystko w grze** - Nie ma linków, wszystko działa w przeglądarce
2. **Widoczne dla gości** - Goście widzą wyzwania i mogą je podjąć
3. **Automatyczne tworzenie** - System sam tworzy wyzwania na podstawie aktywności
4. **Social proof** - Widzisz innych graczy, chcesz być lepszy
5. **Network effects** - Im więcej graczy, tym więcej wyzwań i rywalizacji

---

## Mechanika: Public Challenges

### 1. Daily Global Challenge

**Codzienne wyzwanie dla wszystkich graczy** - widoczne na głównej stronie gry.

```typescript
interface DailyGlobalChallenge {
  id: string;
  date: string; // YYYY-MM-DD
  challengeType: 'waves' | 'kills' | 'damage' | 'speed' | 'survival';
  target: number; // Cel do osiągnięcia
  rules: {
    maxWaves?: number;
    noTurrets?: boolean;
    specificHeroes?: string[];
    timeLimit?: number;
  };
  
  // Stats
  participants: number;
  completions: number;
  topScore: {
    userId: string;
    displayName: string;
    score: number;
    timestamp: Date;
  } | null;
  
  // Rewards
  completionReward: { gold: number; dust: number };
  topReward: { gold: number; dust: number };
  
  createdAt: Date;
  expiresAt: Date;
}
```

**Przykłady:**
- "Dzisiaj: Przejdź 30 fal w 10 minut!"
- "Dzisiaj: Zdobądź 1000 zabójstw bez wieżyczek!"
- "Dzisiaj: Przetrwaj 20 fal z tylko 1 bohaterem!"

**Dlaczego to działa:**
- **Widoczne dla wszystkich** - nawet goście widzą wyzwanie
- **Codzienne** - powód do powrotu
- **Rywalizacja** - widzisz innych graczy, chcesz być lepszy
- **Nagrody** - motywacja do ukończenia

### 2. Community Challenges

**Wyzwania tworzone przez graczy** - widoczne publicznie.

```typescript
interface CommunityChallenge {
  id: string;
  creatorId: string;
  creatorName: string;
  name: string;
  description: string;
  challengeType: 'waves' | 'kills' | 'damage' | 'speed' | 'survival';
  rules: {
    maxWaves?: number;
    noTurrets?: boolean;
    specificHeroes?: string[];
    timeLimit?: number;
  };
  
  // Stats
  participants: number;
  completions: number;
  bestScore: {
    userId: string;
    displayName: string;
    score: number;
    timestamp: Date;
  } | null;
  
  // Rewards (opcjonalne - twórca może ustawić)
  reward: { gold: number; dust: number } | null;
  
  createdAt: Date;
  expiresAt: Date;
  featured: boolean; // Czy jest na głównej stronie
}
```

**Przykłady:**
- "Solo Hero Challenge" - użytkownik "Player123"
- "No Turrets Run" - użytkownik "ProGamer"
- "Speedrun: 50 fal w 15 minut" - użytkownik "SpeedRunner"

**Dlaczego to działa:**
- **Tworzone przez graczy** - content generowany przez społeczność
- **Widoczne publicznie** - nawet goście widzą wyzwania
- **Rywalizacja** - chcesz pokonać innych graczy
- **Social proof** - widzisz, że inni grają

### 3. Auto-Generated Challenges

**System automatycznie tworzy wyzwania** na podstawie aktywności graczy.

```typescript
interface AutoChallenge {
  id: string;
  source: 'record' | 'achievement' | 'trend';
  trigger: {
    userId: string;
    displayName: string;
    achievement: string; // Co osiągnął
  };
  challenge: {
    name: string;
    description: string;
    target: number;
    rules: ChallengeRules;
  };
  createdAt: Date;
  expiresAt: Date;
}
```

**Przykłady:**
- Gracz "ProPlayer" osiągnął 200 fal → System tworzy wyzwanie "Czy możesz osiągnąć 200 fal?"
- Gracz "SpeedKing" pobił rekord czasu → System tworzy wyzwanie "Pobij rekord: 50 fal w 12 minut!"
- Trend: Wiele osób gra bez wieżyczek → System tworzy wyzwanie "No Turrets Challenge"

**Dlaczego to działa:**
- **Automatyczne** - nie wymaga akcji gracza
- **Oparte na rzeczywistej aktywności** - wyzwania są realistyczne
- **Social proof** - "Ktoś to zrobił, możesz i ty!"

---

## UI/UX: Challenge Hub

### Główna strona gry (dla gości i zarejestrowanych)

```tsx
<ChallengeHub>
  {/* Daily Global Challenge - zawsze na górze */}
  <DailyChallenge challenge={dailyChallenge} />
  
  {/* Featured Community Challenges */}
  <FeaturedChallenges challenges={featuredChallenges} />
  
  {/* Leaderboard - top gracze w wyzwaniach */}
  <ChallengeLeaderboard entries={leaderboard} />
  
  {/* Recent Completions - kto właśnie ukończył wyzwanie */}
  <RecentCompletions completions={recentCompletions} />
  
  {/* CTA dla gości */}
  {isGuest && (
    <CallToAction>
      <Button>Zagraj teraz za darmo</Button>
      <Text>Nie wymaga rejestracji - zacznij od razu!</Text>
    </CallToAction>
  )}
</ChallengeHub>
```

### Challenge Card

```tsx
<ChallengeCard challenge={challenge}>
  <Header>
    <Title>{challenge.name}</Title>
    <Badge type={challenge.type}>Daily</Badge>
  </Header>
  
  <Description>{challenge.description}</Description>
  
  <Stats>
    <Stat label="Uczestnicy" value={challenge.participants} />
    <Stat label="Ukończenia" value={challenge.completions} />
    <Stat label="Najlepszy wynik" value={challenge.topScore?.score} />
  </Stats>
  
  <LeaderboardPreview entries={challenge.leaderboard.slice(0, 5)} />
  
  <Actions>
    <Button primary>Podejmij wyzwanie</Button>
    {!isGuest && <Button>Utwórz podobne</Button>}
  </Actions>
</ChallengeCard>
```

---

## Mechanika: Jak to przyciąga graczy

### 1. Social Proof

**Widzisz innych graczy, chcesz być lepszy:**

```
"123 graczy ukończyło to wyzwanie dzisiaj"
"Top wynik: 150 fal - Player123"
"Ostatnie ukończenie: 2 minuty temu - NewPlayer"
```

**Dlaczego działa:**
- **FOMO** - inni grają, ty też chcesz
- **Rywalizacja** - chcesz pokonać innych
- **Proof of concept** - widzisz, że gra działa

### 2. Low Barrier to Entry

**Goście mogą grać od razu:**

```
1. Otwierasz stronę
2. Widzisz wyzwanie: "Przejdź 20 fal"
3. Klikasz "Zagraj teraz"
4. Gra się zaczyna (guest mode)
5. Po ukończeniu widzisz swój wynik na leaderboardzie
6. Chcesz być lepszy → wracasz
```

**Dlaczego działa:**
- **Zero friction** - nie wymaga rejestracji
- **Natychmiastowa gratyfikacja** - od razu widzisz wyniki
- **Naturalna konwersja** - po kilku grach chcesz się zarejestrować

### 3. Network Effects

**Im więcej graczy, tym lepiej:**

```
Dzień 1: 10 graczy → 5 wyzwań
Dzień 7: 100 graczy → 50 wyzwań
Dzień 30: 1000 graczy → 500 wyzwań
```

**Dlaczego działa:**
- **Więcej contentu** - więcej wyzwań = więcej powodów do grania
- **Większa rywalizacja** - więcej graczy = większa konkurencja
- **Większa społeczność** - więcej graczy = więcej interakcji

### 4. Viral Moments (bez linków)

**Spektakularne momenty są widoczne w grze:**

```tsx
<Notification>
  <Icon type="trophy" />
  <Title>Nowy rekord!</Title>
  <Description>Player123 właśnie pobił rekord: 200 fal!</Description>
  <Button>Podejmij wyzwanie</Button>
</Notification>
```

**Dlaczego działa:**
- **Widoczne dla wszystkich** - nie wymaga sharingu
- **Natychmiastowa akcja** - możesz od razu podjąć wyzwanie
- **Social proof** - widzisz, że inni osiągają sukcesy

---

## Implementacja

### 1. Database Schema

```prisma
model PublicChallenge {
  id          String   @id @default(cuid())
  type        String   // 'daily' | 'community' | 'auto'
  name        String
  description String
  challengeType String // 'waves' | 'kills' | 'damage' | 'speed' | 'survival'
  target      Int
  rules       Json
  
  // Creator (null for daily/auto)
  creatorId   String?
  creator     User?   @relation(fields: [creatorId], references: [id])
  
  // Stats
  participants Int     @default(0)
  completions   Int     @default(0)
  topScore      Json?   // { userId, displayName, score, timestamp }
  
  // Rewards
  completionReward Json // { gold, dust }
  topReward        Json? // { gold, dust }
  
  // Status
  featured    Boolean  @default(false)
  active      Boolean  @default(true)
  
  createdAt   DateTime @default(now())
  expiresAt   DateTime
  
  attempts    ChallengeAttempt[]
  
  @@index([type, active, createdAt])
  @@index([featured, active])
  @@index([expiresAt])
}

model ChallengeAttempt {
  id          String   @id @default(cuid())
  challengeId String
  userId      String?  // null for guests
  guestId     String?  // For guest attempts
  displayName String   // User or guest name
  
  score       Int
  result      Json     // Full attempt data
  completed   Boolean  @default(false)
  
  completedAt DateTime @default(now())
  
  challenge   PublicChallenge @relation(fields: [challengeId], references: [id])
  user        User?           @relation(fields: [userId], references: [id])
  
  @@index([challengeId, score])
  @@index([userId, completedAt])
  @@index([guestId, completedAt])
}
```

### 2. Service: `publicChallenges.ts`

```typescript
// apps/server/src/services/publicChallenges.ts

/**
 * Pobierz dzienne wyzwanie globalne
 */
export async function getDailyGlobalChallenge(): Promise<PublicChallenge | null> {
  const today = new Date().toISOString().split('T')[0];
  
  let challenge = await prisma.publicChallenge.findFirst({
    where: {
      type: 'daily',
      active: true,
      expiresAt: { gte: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });
  
  // Jeśli nie ma dzisiejszego wyzwania, stwórz nowe
  if (!challenge) {
    challenge = await createDailyChallenge();
  }
  
  return challenge;
}

/**
 * Stwórz dzienne wyzwanie (automatyczne)
 */
async function createDailyChallenge(): Promise<PublicChallenge> {
  const challengeTypes = ['waves', 'kills', 'damage', 'speed', 'survival'];
  const randomType = challengeTypes[Math.floor(Math.random() * challengeTypes.length)];
  
  const challenge = await generateChallengeForType(randomType);
  
  return await prisma.publicChallenge.create({
    data: {
      type: 'daily',
      name: `Dzienne Wyzwanie: ${challenge.name}`,
      description: challenge.description,
      challengeType: randomType,
      target: challenge.target,
      rules: challenge.rules,
      completionReward: { gold: 500, dust: 25 },
      topReward: { gold: 1000, dust: 50 },
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
    },
  });
}

/**
 * Pobierz featured community challenges
 */
export async function getFeaturedChallenges(limit = 5): Promise<PublicChallenge[]> {
  return await prisma.publicChallenge.findMany({
    where: {
      type: 'community',
      featured: true,
      active: true,
      expiresAt: { gte: new Date() },
    },
    orderBy: [
      { participants: 'desc' },
      { createdAt: 'desc' },
    ],
    take: limit,
  });
}

/**
 * Podejmij wyzwanie (dla gości i zarejestrowanych)
 */
export async function attemptChallenge(
  challengeId: string,
  userId?: string,
  guestId?: string,
  displayName: string
): Promise<ChallengeAttempt> {
  const challenge = await prisma.publicChallenge.findUnique({
    where: { id: challengeId },
  });
  
  if (!challenge || !challenge.active) {
    throw new Error('CHALLENGE_NOT_FOUND');
  }
  
  if (challenge.expiresAt < new Date()) {
    throw new Error('CHALLENGE_EXPIRED');
  }
  
  // Zwiększ licznik uczestników
  await prisma.publicChallenge.update({
    where: { id: challengeId },
    data: { participants: { increment: 1 } },
  });
  
  // Stwórz próbę
  return await prisma.challengeAttempt.create({
    data: {
      challengeId,
      userId: userId || null,
      guestId: guestId || null,
      displayName,
      score: 0, // Będzie zaktualizowane po ukończeniu
      completed: false,
    },
  });
}

/**
 * Zakończ wyzwanie (po ukończeniu sesji)
 */
export async function completeChallenge(
  attemptId: string,
  score: number,
  result: any
): Promise<{ success: boolean; rewards?: Rewards; newTopScore?: boolean }> {
  const attempt = await prisma.challengeAttempt.findUnique({
    where: { id: attemptId },
    include: { challenge: true },
  });
  
  if (!attempt) {
    throw new Error('ATTEMPT_NOT_FOUND');
  }
  
  const challenge = attempt.challenge;
  
  // Sprawdź czy wyzwanie zostało ukończone
  const completed = score >= challenge.target;
  
  // Zaktualizuj próbę
  await prisma.challengeAttempt.update({
    where: { id: attemptId },
    data: {
      score,
      result,
      completed,
    },
  });
  
  let rewards: Rewards | undefined;
  let newTopScore = false;
  
  if (completed) {
    // Zwiększ licznik ukończeń
    await prisma.publicChallenge.update({
      where: { id: challenge.id },
      data: { completions: { increment: 1 } },
    });
    
    // Nagrody za ukończenie
    rewards = challenge.completionReward as Rewards;
    
    // Sprawdź czy to nowy top score
    const currentTop = challenge.topScore as { score: number } | null;
    if (!currentTop || score > currentTop.score) {
      newTopScore = true;
      
      // Zaktualizuj top score
      await prisma.publicChallenge.update({
        where: { id: challenge.id },
        data: {
          topScore: {
            userId: attempt.userId || attempt.guestId,
            displayName: attempt.displayName,
            score,
            timestamp: new Date(),
          },
        },
      });
      
      // Dodatkowe nagrody za top score
      if (challenge.topReward) {
        rewards = {
          gold: rewards.gold + (challenge.topReward as Rewards).gold,
          dust: rewards.dust + (challenge.topReward as Rewards).dust,
        };
      }
    }
    
    // Przyznaj nagrody (tylko dla zarejestrowanych)
    if (attempt.userId) {
      await grantRewards(attempt.userId, rewards);
    }
  }
  
  return { success: completed, rewards, newTopScore };
}
```

### 3. Routes

```typescript
// apps/server/src/routes/publicChallenges.ts

// Public endpoint - dostępne dla wszystkich (gości i zarejestrowanych)
fastify.get('/v1/challenges/daily', { config: { public: true } }, async (request, reply) => {
  const challenge = await getDailyGlobalChallenge();
  return reply.send({ challenge });
});

fastify.get('/v1/challenges/featured', { config: { public: true } }, async (request, reply) => {
  const challenges = await getFeaturedChallenges();
  return reply.send({ challenges });
});

fastify.get('/v1/challenges/:id', { config: { public: true } }, async (request, reply) => {
  const challenge = await getChallenge(request.params.id);
  if (!challenge) return reply.status(404).send({ error: 'Challenge not found' });
  return reply.send({ challenge });
});

fastify.post('/v1/challenges/:id/attempt', { config: { public: true } }, async (request, reply) => {
  const { displayName, guestId } = request.body as { displayName: string; guestId?: string };
  const attempt = await attemptChallenge(
    request.params.id,
    request.userId,
    guestId,
    displayName
  );
  return reply.send({ attempt });
});
```

---

## Dlaczego to działa (bez linków)

### 1. Wszystko w grze
- Nie ma linków do klikania
- Wszystko działa w przeglądarce
- Goście mogą grać od razu

### 2. Social Proof
- Widzisz innych graczy
- Widzisz ich wyniki
- Chcesz być lepszy

### 3. Network Effects
- Im więcej graczy, tym więcej wyzwań
- Im więcej wyzwań, tym więcej powodów do grania
- Im więcej powodów do grania, tym więcej graczy

### 4. Low Barrier to Entry
- Goście mogą grać bez rejestracji
- Natychmiastowa gratyfikacja
- Naturalna konwersja po kilku grach

### 5. Viral Moments (bez sharingu)
- Spektakularne momenty są widoczne w grze
- "Player123 właśnie pobił rekord!" → inni chcą spróbować
- Automatyczne tworzenie wyzwań z rekordów

---

## Metryki sukcesu

1. **Daily Challenge Participation** - Ile osób podejmuje dzienne wyzwanie
2. **Guest to Registered Conversion** - % gości którzy się rejestrują
3. **Challenge Completion Rate** - % prób które kończą się sukcesem
4. **Return Rate** - % graczy którzy wracają codziennie
5. **Community Challenge Creation** - Ile wyzwań tworzą gracze
6. **Network Growth** - Wzrost liczby graczy dzień po dniu

---

## Roadmap

### Faza 1: Daily Challenges (Tydzień 1)
- Automatyczne tworzenie dziennych wyzwań
- UI dla wyzwań
- System prób i ukończeń
- Leaderboardy

### Faza 2: Guest Support (Tydzień 2)
- Goście mogą podejmować wyzwania
- Goście widzą swoje wyniki
- Konwersja gości → zarejestrowani

### Faza 3: Community Challenges (Tydzień 3)
- Tworzenie wyzwań przez graczy
- Featured challenges
- System nagród

### Faza 4: Auto-Generated Challenges (Tydzień 4)
- Automatyczne tworzenie z rekordów
- Automatyczne tworzenie z achievementów
- Trend detection

### Faza 5: Optimization (Tydzień 5+)
- A/B testing typów wyzwań
- Optymalizacja nagród
- Social proof optimization

---

*System zaprojektowany specjalnie dla Grow Fortress - organiczny wzrost bez linków, poprzez publiczne wyzwania i social proof.*
