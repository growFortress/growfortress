# Discovery System - "Playable Moments & Embeddable Challenges"

## Problem

Nikt nie wie, że gra istnieje. Standardowe metody (marketing, SEO) nie działają przy zerowym budżecie i zerowej bazie użytkowników.

## Rozwiązanie: Embeddable Playable Moments

System, który **automatycznie generuje małe, embeddable wersje gry** - "playable moments" - które można osadzić na dowolnej stronie, w social media, lub udostępnić jako standalone mini-gry.

### Kluczowe założenia

1. **Embeddable** - Można osadzić na dowolnej stronie (iframe)
2. **Playable** - Pełna funkcjonalność w mini-wersji
3. **Shareable** - Automatyczne generowanie shareable contentu
4. **Zero-effort** - System sam generuje momenty
5. **Viral potential** - Każdy moment może przyciągnąć nowych graczy

---

## Mechanika: Playable Moments

### 1. Challenge Embeds

**Małe, embeddable wyzwania** - można osadzić na dowolnej stronie.

```typescript
interface PlayableChallenge {
  id: string;
  challengeType: 'waves' | 'kills' | 'damage' | 'speed' | 'survival';
  target: number;
  rules: ChallengeRules;
  
  // Embed info
  embedUrl: string; // growfortress.com/embed/challenge/{id}
  embedCode: string; // HTML do osadzenia
  previewImage: string; // Auto-generated preview
  
  // Stats (publiczne)
  attempts: number;
  completions: number;
  topScore: {
    displayName: string;
    score: number;
  } | null;
  
  createdAt: Date;
  expiresAt: Date;
}
```

**Przykład embed code:**
```html
<iframe 
  src="https://growfortress.com/embed/challenge/ABC123" 
  width="800" 
  height="600" 
  frameborder="0"
  allow="gamepad; fullscreen">
</iframe>
```

**Gdzie można osadzić:**
- Reddit posts (embed w komentarzach)
- Discord messages (embed w kanałach)
- Blog posts
- Social media (Twitter, Facebook - jeśli wspierają iframe)
- itch.io game pages
- Własne strony

### 2. Replay Embeds

**Embeddable replaye** z spektakularnych momentów.

```typescript
interface PlayableReplay {
  id: string;
  replayType: 'pvp' | 'boss' | 'record' | 'epic';
  title: string;
  description: string;
  
  // Replay data
  replayData: ReplayData;
  seed: number;
  
  // Embed info
  embedUrl: string; // growfortress.com/embed/replay/{id}
  embedCode: string;
  previewImage: string;
  
  // Stats
  views: number;
  likes: number;
  
  createdAt: Date;
}
```

**Przykład:**
- Epic PvP battle → embeddable replay
- Record-breaking run → embeddable replay
- Perfect boss kill → embeddable replay

### 3. Mini-Game Embeds

**Standalone mini-gry** - pełna funkcjonalność w embeddable formacie.

```typescript
interface PlayableMiniGame {
  id: string;
  gameType: 'endless' | 'boss_rush' | 'challenge';
  config: GameConfig;
  
  // Embed info
  embedUrl: string; // growfortress.com/embed/game/{id}
  embedCode: string;
  previewImage: string;
  
  // Stats
  plays: number;
  averageScore: number;
  
  createdAt: Date;
}
```

---

## Automatyczne Generowanie

### 1. Daily Challenge Embeds

**System automatycznie generuje codzienne wyzwanie jako embed.**

```typescript
async function generateDailyChallengeEmbed(): Promise<PlayableChallenge> {
  // 1. Stwórz dzienne wyzwanie
  const challenge = await createDailyChallenge();
  
  // 2. Wygeneruj embed URL
  const embedUrl = `https://growfortress.com/embed/challenge/${challenge.id}`;
  
  // 3. Wygeneruj preview image
  const previewImage = await generateChallengePreview(challenge);
  
  // 4. Wygeneruj embed code
  const embedCode = generateEmbedCode(embedUrl, challenge);
  
  // 5. Zapisz w bazie
  return await prisma.playableChallenge.create({
    data: {
      id: challenge.id,
      challengeType: challenge.challengeType,
      target: challenge.target,
      rules: challenge.rules,
      embedUrl,
      embedCode,
      previewImage,
      expiresAt: challenge.expiresAt,
    },
  });
}
```

### 2. Auto-Generated Challenge Embeds

**System automatycznie tworzy embeddable wyzwania z rekordów.**

```typescript
async function generateChallengeFromRecord(record: Record): Promise<PlayableChallenge> {
  // Gracz "ProPlayer" osiągnął 200 fal
  // → System tworzy wyzwanie "Czy możesz osiągnąć 200 fal?"
  
  const challenge = await createChallenge({
    name: `Czy możesz osiągnąć ${record.value} ${record.category}?`,
    description: `${record.displayName} właśnie osiągnął ${record.value} ${record.category}! Podejmij wyzwanie!`,
    target: record.value,
    rules: extractRulesFromRecord(record),
  });
  
  return await generateChallengeEmbed(challenge);
}
```

### 3. Epic Moment Embeds

**System automatycznie tworzy embeddable replaye z spektakularnych momentów.**

```typescript
async function generateReplayEmbed(moment: EpicMoment): Promise<PlayableReplay> {
  // Epic PvP battle → embeddable replay
  // Record-breaking run → embeddable replay
  
  const replay = await createReplay(moment);
  
  return await generateReplayEmbed(replay);
}
```

---

## Embeddable UI

### Challenge Embed Page

```tsx
// apps/web/src/pages/embed/ChallengeEmbed.tsx

export function ChallengeEmbed({ challengeId }: { challengeId: string }) {
  const challenge = useChallenge(challengeId);
  
  return (
    <EmbedContainer>
      {/* Compact header */}
      <EmbedHeader>
        <Logo />
        <Title>{challenge.name}</Title>
        <Stats>
          <Stat label="Próby" value={challenge.attempts} />
          <Stat label="Ukończenia" value={challenge.completions} />
        </Stats>
      </EmbedHeader>
      
      {/* Game container - pełna funkcjonalność */}
      <GameContainer>
        <Game challenge={challenge} />
      </GameContainer>
      
      {/* CTA footer */}
      <EmbedFooter>
        <Text>Zagraj pełną wersję na</Text>
        <Link href="https://growfortress.com">growfortress.com</Link>
      </EmbedFooter>
    </EmbedContainer>
  );
}
```

### Replay Embed Page

```tsx
// apps/web/src/pages/embed/ReplayEmbed.tsx

export function ReplayEmbed({ replayId }: { replayId: string }) {
  const replay = useReplay(replayId);
  
  return (
    <EmbedContainer>
      <EmbedHeader>
        <Title>{replay.title}</Title>
        <Description>{replay.description}</Description>
      </EmbedHeader>
      
      <ReplayViewer replay={replay} />
      
      <EmbedFooter>
        <Button onClick={playFullVersion}>Zagraj pełną wersję</Button>
      </EmbedFooter>
    </EmbedContainer>
  );
}
```

---

## Shareable Content Generation

### Auto-Generated Social Posts

**System automatycznie generuje posty do social media z embed code.**

```typescript
interface SocialPost {
  platform: 'reddit' | 'discord' | 'twitter' | 'facebook';
  title: string;
  content: string;
  embedCode: string;
  previewImage: string;
  hashtags: string[];
}

async function generateSocialPost(challenge: PlayableChallenge): Promise<SocialPost> {
  return {
    platform: 'reddit',
    title: `Dzienne Wyzwanie: ${challenge.name} - Zagraj teraz!`,
    content: `
# ${challenge.name}

${challenge.description}

**Zagraj teraz (embed):**

${challenge.embedCode}

**Lub zagraj pełną wersję:** https://growfortress.com

**Statystyki:**
- Próby: ${challenge.attempts}
- Ukończenia: ${challenge.completions}
- Top wynik: ${challenge.topScore?.score || 'Brak'}

#growfortress #towerdefense #webgame #browsergame
    `,
    embedCode: challenge.embedCode,
    previewImage: challenge.previewImage,
    hashtags: ['growfortress', 'towerdefense', 'webgame', 'browsergame'],
  };
}
```

---

## Platform Distribution

### 1. itch.io Integration

**Automatyczne publikowanie codziennych wyzwań na itch.io.**

```typescript
async function publishToItchIO(challenge: PlayableChallenge): Promise<void> {
  // 1. Wygeneruj post na itch.io
  const post = {
    title: `Grow Fortress - ${challenge.name}`,
    body: `
${challenge.description}

**Zagraj teraz:**

${challenge.embedCode}

**Lub zagraj pełną wersję:** https://growfortress.com
    `,
    tags: ['tower-defense', 'web-game', 'browser-game', 'free'],
  };
  
  // 2. Opublikuj na itch.io (przez API lub webhook)
  await publishItchIOPost(post);
}
```

### 2. Reddit Auto-Posting

**Automatyczne publikowanie codziennych wyzwań na Reddit.**

```typescript
async function postToReddit(challenge: PlayableChallenge): Promise<void> {
  const subreddits = [
    'r/WebGames',
    'r/TowerDefense',
    'r/IndieGaming',
    'r/playmygame',
  ];
  
  for (const subreddit of subreddits) {
    await postToSubreddit(subreddit, {
      title: `[Playable] ${challenge.name} - Tower Defense Challenge`,
      text: generateRedditPost(challenge),
    });
  }
}
```

### 3. Discord Webhooks

**Automatyczne wysyłanie codziennych wyzwań do Discord.**

```typescript
async function sendToDiscord(challenge: PlayableChallenge): Promise<void> {
  const webhook = new DiscordWebhook(DISCORD_WEBHOOK_URL);
  
  await webhook.send({
    title: challenge.name,
    description: challenge.description,
    fields: [
      { name: 'Próby', value: challenge.attempts.toString() },
      { name: 'Ukończenia', value: challenge.completions.toString() },
    ],
    image: { url: challenge.previewImage },
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            label: 'Zagraj teraz',
            style: 5,
            url: challenge.embedUrl,
          },
        ],
      },
    ],
  });
}
```

---

## SEO & Discovery Optimization

### 1. Challenge Landing Pages

**Każde wyzwanie ma własną stronę z SEO.**

```tsx
// apps/web/src/pages/challenge/[id].tsx

export function ChallengePage({ challengeId }: { challengeId: string }) {
  const challenge = useChallenge(challengeId);
  
  return (
    <>
      <Head>
        <title>{challenge.name} - Grow Fortress</title>
        <meta name="description" content={challenge.description} />
        <meta property="og:title" content={challenge.name} />
        <meta property="og:description" content={challenge.description} />
        <meta property="og:image" content={challenge.previewImage} />
        <meta property="og:type" content="game" />
      </Head>
      
      <ChallengePageContent challenge={challenge} />
    </>
  );
}
```

### 2. Sitemap Generation

**Automatyczne generowanie sitemap z wszystkich wyzwań.**

```typescript
async function generateSitemap(): Promise<string> {
  const challenges = await getAllPublicChallenges();
  const replays = await getAllPublicReplays();
  
  const urls = [
    ...challenges.map(c => ({
      loc: `https://growfortress.com/challenge/${c.id}`,
      lastmod: c.updatedAt,
      changefreq: 'daily',
      priority: 0.8,
    })),
    ...replays.map(r => ({
      loc: `https://growfortress.com/replay/${r.id}`,
      lastmod: r.updatedAt,
      changefreq: 'weekly',
      priority: 0.6,
    })),
  ];
  
  return generateXMLSitemap(urls);
}
```

### 3. Open Graph Optimization

**Każde wyzwanie ma zoptymalizowane Open Graph tags.**

```tsx
<Head>
  <meta property="og:title" content={challenge.name} />
  <meta property="og:description" content={challenge.description} />
  <meta property="og:image" content={challenge.previewImage} />
  <meta property="og:type" content="game" />
  <meta property="og:url" content={`https://growfortress.com/challenge/${challenge.id}`} />
  <meta property="game:play_time" content="5-30 minutes" />
</Head>
```

---

## Viral Mechanics

### 1. Challenge Sharing

**Gracze mogą udostępniać swoje wyzwania.**

```typescript
interface ChallengeShare {
  challengeId: string;
  shareType: 'embed' | 'link' | 'screenshot';
  shareUrl: string;
  embedCode?: string;
}

async function shareChallenge(
  challengeId: string,
  shareType: 'embed' | 'link' | 'screenshot'
): Promise<ChallengeShare> {
  const challenge = await getChallenge(challengeId);
  
  if (shareType === 'embed') {
    return {
      challengeId,
      shareType: 'embed',
      shareUrl: challenge.embedUrl,
      embedCode: challenge.embedCode,
    };
  }
  
  // ... other share types
}
```

### 2. Leaderboard Sharing

**Gracze mogą udostępniać swoje wyniki.**

```typescript
async function shareLeaderboardEntry(
  entry: LeaderboardEntry
): Promise<ShareableContent> {
  // Generuj obrazek z wynikiem
  const image = await generateLeaderboardImage(entry);
  
  // Generuj embed code
  const embedCode = generateLeaderboardEmbed(entry);
  
  return {
    image,
    embedCode,
    shareUrl: `https://growfortress.com/leaderboard/${entry.userId}`,
  };
}
```

### 3. Replay Sharing

**Gracze mogą udostępniać swoje replaye.**

```typescript
async function shareReplay(replayId: string): Promise<ShareableContent> {
  const replay = await getReplay(replayId);
  
  return {
    embedCode: replay.embedCode,
    shareUrl: replay.embedUrl,
    previewImage: replay.previewImage,
  };
}
```

---

## Implementation

### 1. Database Schema

```prisma
model PlayableChallenge {
  id          String   @id @default(cuid())
  challengeId String   @unique // Link to PublicChallenge
  challenge   PublicChallenge @relation(fields: [challengeId], references: [id])
  
  embedUrl    String   @unique
  embedCode   String   @db.Text
  previewImage String
  
  // Stats
  embedViews  Int      @default(0)
  embedPlays  Int      @default(0)
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@index([embedUrl])
}

model PlayableReplay {
  id          String   @id @default(cuid())
  replayId    String   @unique
  replay      Replay   @relation(fields: [replayId], references: [id])
  
  embedUrl    String   @unique
  embedCode   String   @db.Text
  previewImage String
  
  // Stats
  embedViews  Int      @default(0)
  embedPlays  Int      @default(0)
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@index([embedUrl])
}
```

### 2. Embed Routes

```typescript
// apps/server/src/routes/embeds.ts

// Public endpoint - embeddable challenge
fastify.get('/embed/challenge/:id', { config: { public: true } }, async (request, reply) => {
  const challenge = await getPlayableChallenge(request.params.id);
  if (!challenge) return reply.status(404).send({ error: 'Challenge not found' });
  
  // Zwiększ licznik views
  await incrementEmbedViews('challenge', challenge.id);
  
  // Zwróć HTML dla embed
  return reply.type('text/html').send(generateEmbedHTML(challenge));
});

// Public endpoint - embeddable replay
fastify.get('/embed/replay/:id', { config: { public: true } }, async (request, reply) => {
  const replay = await getPlayableReplay(request.params.id);
  if (!replay) return reply.status(404).send({ error: 'Replay not found' });
  
  await incrementEmbedViews('replay', replay.id);
  
  return reply.type('text/html').send(generateReplayEmbedHTML(replay));
});
```

### 3. Frontend Embed Pages

```tsx
// apps/web/src/pages/embed/ChallengeEmbed.tsx

export function ChallengeEmbedPage() {
  const { challengeId } = useParams();
  const challenge = useChallenge(challengeId);
  
  return (
    <EmbedLayout>
      <ChallengeEmbed challenge={challenge} />
    </EmbedLayout>
  );
}
```

---

## Why This Works

### 1. Zero Friction Discovery

**Ludzie znajdują grę przez embedy, nie przez linki:**

- Reddit post z embedem → ludzie grają bezpośrednio w Reddit
- Discord message z embedem → ludzie grają bezpośrednio w Discord
- Blog post z embedem → ludzie grają bezpośrednio na blogu

**Nie wymaga klikania w linki** - wszystko działa w embedzie.

### 2. Viral Potential

**Każdy embed może przyciągnąć nowych graczy:**

- Gracz osadza wyzwanie na swojej stronie → jego widzowie grają
- Gracz udostępnia replay → inni widzą i grają
- Gracz udostępnia wynik → inni chcą spróbować

### 3. SEO Benefits

**Każde wyzwanie to nowa strona z SEO:**

- 365 codziennych wyzwań = 365 nowych stron rocznie
- Każda strona ma własne SEO
- Każda strona może być znaleziona przez Google

### 4. Platform Distribution

**Automatyczne publikowanie na platformach:**

- itch.io → codzienne posty z embedami
- Reddit → codzienne posty na subredditach
- Discord → codzienne webhooki z embedami

### 5. Network Effects

**Im więcej embedów, tym więcej graczy:**

- Więcej embedów = więcej miejsc gdzie gra jest widoczna
- Więcej miejsc = więcej graczy
- Więcej graczy = więcej embedów

---

## Metrics

1. **Embed Views** - Ile razy embed został wyświetlony
2. **Embed Plays** - Ile razy ktoś zagrał w embedzie
3. **Embed to Full Game Conversion** - % graczy którzy przeszli do pełnej wersji
4. **Platform Distribution** - Gdzie embedy są osadzane
5. **SEO Traffic** - Traffic z wyszukiwarek do challenge pages
6. **Viral Coefficient** - Średnia liczba nowych graczy per embed

---

## Roadmap

### Faza 1: Basic Embeds (Tydzień 1)
- Challenge embed page
- Replay embed page
- Basic embed code generation
- Preview image generation

### Faza 2: Auto-Generation (Tydzień 2)
- Automatyczne generowanie codziennych wyzwań jako embedy
- Automatyczne generowanie replay embedów
- Automatyczne generowanie preview images

### Faza 3: Platform Distribution (Tydzień 3)
- itch.io integration
- Reddit auto-posting
- Discord webhooks

### Faza 4: SEO Optimization (Tydzień 4)
- Challenge landing pages
- Sitemap generation
- Open Graph optimization

### Faza 5: Sharing Features (Tydzień 5)
- Challenge sharing
- Leaderboard sharing
- Replay sharing

---

*System zaprojektowany specjalnie dla Grow Fortress - discovery przez embeddable playable moments, bez wymagania klikania w linki.*
