# Server Architecture

## Overview

The game server is built with:
- **Framework**: Fastify (TypeScript)
- **Database**: PostgreSQL (via Prisma ORM)
- **Caching/Queue**: Redis + BullMQ
- **Authentication**: JWT tokens (access/refresh)
- **WebSocket**: Real-time messaging

---

## Directory Structure

```
apps/server/
├── src/
│   ├── index.ts           # Main entry point
│   ├── app.ts             # Fastify application factory
│   ├── config.ts          # Environment configuration
│   ├── routes/            # 31 API route modules
│   ├── services/          # 50+ business logic modules
│   ├── plugins/           # Fastify plugins (auth, rate limit, etc.)
│   ├── middleware/        # Custom middleware
│   ├── lib/               # Shared utilities
│   └── jobs/              # Background job processors
├── prisma/
│   └── schema.prisma      # Database schema (1955 lines)
└── package.json
```

---

## Authentication System

### Token Types

| Token Type | Algorithm | Expiry | Purpose |
|------------|-----------|--------|---------|
| Access Token | HS256 JWT | 15 min | API authentication |
| Refresh Token | JWT | 7 days | Token renewal (stored in Redis) |
| Admin Token | HS256 JWT | 15 min | Admin panel access |
| Run Token | HMAC | 10 min | Game run verification |
| Session Token | HMAC | 10 min | Endless mode persistence |
| Boss Rush Token | HMAC | 10 min | Boss rush mode |

### Auth Endpoints

**Public Endpoints** (Rate Limited):
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/auth/register` | POST | Account creation with referral support |
| `/v1/auth/guest` | POST | Create guest session (30-day expiry) |
| `/v1/auth/convert-guest` | POST | Upgrade guest to registered user |
| `/v1/auth/login` | POST | Login (5 attempts/10 min limit) |
| `/v1/auth/refresh` | POST | Token refresh via cookie or body |
| `/v1/auth/forgot-password` | POST | Password reset request |
| `/v1/auth/reset-password` | POST | Complete password reset |
| `/v1/auth/logout` | POST | Revoke session |

**Authenticated Endpoints**:
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/profile` | GET | Get user profile |
| `/v1/profile` | PATCH | Update display name |
| `/v1/profile/description` | PATCH | Update bio (500 char max) |
| `/v1/profile/loadout` | PATCH | Set default fortress/hero/turret |
| `/v1/profile/build-presets` | PATCH | Save build configurations |
| `/v1/profile/currency` | PATCH | Set preferred currency |
| `/v1/auth/change-password` | POST | Password change |
| `/v1/auth/account` | DELETE | Account deletion |
| `/v1/bonus-code/redeem` | POST | Redeem promotional codes |

---

## API Routes (31 Modules)

### Game Progression

| Route File | Endpoints | Description |
|------------|-----------|-------------|
| `sessions.ts` | Session lifecycle | Game session management |
| `runs.ts` | Run tracking | Tower Defense run completion |
| `upgrades.ts` | Skill upgrades | Player stat investments |
| `heroes.ts` | Hero management | Hero unlocking/leveling |
| `artifacts.ts` | Artifact system | Artifact acquisition |
| `power-upgrades.ts` | Power system | Power progression |

### Leaderboards & Competition

| Route File | Size | Description |
|------------|------|-------------|
| `leaderboard.ts` | 6 KB | Weekly player rankings |
| `pvp.ts` | 8.9 KB | PvP Arena challenges |
| `boss-rush.ts` | 4.6 KB | Boss Rush mode |

### Guild System

| Route File | Size | Description |
|------------|------|-------------|
| `guilds.ts` | 53 KB | Core guild operations (largest route) |
| `guildPreview.ts` | - | Public guild previews |

### Marketplace & Economy

| Route File | Description |
|------------|-------------|
| `shop.ts` | Shop UI and purchases |
| `iap.ts` | In-app purchase handling |
| `gacha.ts` | Gacha banner system |
| `energy.ts` | Premium energy currency |

### Quest & Challenge Systems

| Route File | Size | Description |
|------------|------|-------------|
| `dailyQuests.ts` | 2.9 KB | Daily quest system |
| `pillarChallenge.ts` | 8.4 KB | Pillar Challenge mode |
| `pillarUnlocks.ts` | - | Dust-gated progression |
| `battlepass.ts` | - | Battle pass progression |

### Content & Progression

| Route File | Description |
|------------|-------------|
| `mastery.ts` | Class skill trees |
| `materials.ts` | Material crafting |
| `idle.ts` | Idle rewards |
| `hubPreview.ts` | Player hub previews |

### Social & Moderation

| Route File | Size | Description |
|------------|------|-------------|
| `messages.ts` | 5.9 KB | Player messaging |
| `moderation.ts` | 7.2 KB | Report and block system |
| `bugReports.ts` | - | Bug report submission |

### Admin & System

| Route File | Size | Description |
|------------|------|-------------|
| `admin.ts` | 35 KB | Admin dashboard operations |
| `health.ts` | - | Health check endpoint |
| `telemetry.ts` | - | Analytics collection |
| `referrals.ts` | - | Referral code handling |
| `supportTickets.ts` | - | Support ticket system |

---

## Services (50+ Modules)

### Authentication & User Management
- `auth.ts` - Registration, login, password reset
- Starter pack: 1000 gold, 100 dust

### Game Session Management
- `gameSessions.ts` (29 KB) - Endless mode tracking
- `runs.ts` - Run lifecycle
- `power-upgrades.ts` (28 KB) - Power calculation

### Leaderboards & Rankings
- `leaderboard.ts` - Leaderboard queries
- `playerLeaderboard.ts` (23 KB) - Weekly rewards/resets
- `bossRushLeaderboard.ts` - Boss Rush rankings
- `guildLeaderboard.ts` - Guild rankings

### Guild Subsystem (14 Services)
| Service | Size | Description |
|---------|------|-------------|
| `guild.ts` | 22 KB | Core guild operations |
| `guildBattle.ts` | 24 KB | Guild vs Guild battles |
| `guildBoss.ts` | 17 KB | Guild boss encounters |
| `guildTowerRace.ts` | 12 KB | Tower race events |
| `guildTreasury.ts` | 12 KB | Resource management |
| `guildBattleTrophies.ts` | 13 KB | Trophy system |
| `guildBattleHero.ts` | 11 KB | Hero assignment |
| `guildMedals.ts` | 9.5 KB | Medal awards |
| `guildInvitation.ts` | 11 KB | Invitations |
| `guildApplication.ts` | 13 KB | Applications |
| `guildPreview.ts` | 4.4 KB | Public info |
| `guildProgression.ts` | 2.5 KB | XP tracking |
| `guildStructures.ts` | 8.2 KB | Building upgrades |
| `guildChat.ts` | 4.8 KB | Messaging |

### Combat & Simulation
| Service | Size | Description |
|---------|------|-------------|
| `pvp.ts` | 47 KB | PvP logic (largest service) |
| `bossRush.ts` | 15 KB | Boss Rush mode |
| `pillarChallenge.ts` | 34 KB | Pillar Challenge |

### Rewards & Economy
- `rewards.ts` - Reward calculation
- `bulkRewards.ts` (4.5 KB) - Batch claiming
- `idleRewards.ts` (16 KB) - Offline rewards
- `battlepass.ts` - Battle pass

### Content Management
- `heroes.ts` (6.3 KB) - Hero system
- `artifacts.ts` - Artifacts
- `mastery.ts` (11 KB) - Skill trees
- `dailyQuests.ts` (13 KB) - Daily quests
- `materials.ts` - Material drops
- `energy.ts` (4.6 KB) - Energy currency

### Marketplace
- `shop.ts` (29 KB) - Shop logic
- `gacha.ts` (11 KB) - Gacha system
- `iap.ts` (3.8 KB) - IAP handling
- `banners.ts` - Banner config

### Social Systems
- `messages.ts` (26 KB) - Direct messaging
- `moderation.ts` (15 KB) - Reports/blocks

---

## Background Jobs (5 Workers)

| Job | Schedule | Description |
|-----|----------|-------------|
| `leaderboardSnapshot` | Hourly | Snapshot top 100, cache in Redis |
| `cleanupExpiredRuns` | Every 5 min | Remove stale session data |
| `metricsJob` | Every 1 min | Collect system metrics |
| `weeklyPlayerReset` | Monday 00:00 UTC | Distribute rewards, reset honor |
| `weeklyGuildReset` | Monday 00:05 UTC | Guild-specific weekly reset |

### Queue Infrastructure
- Uses BullMQ with Redis backend
- 5 named queues defined in `lib/queue.ts`

---

## Plugins

### Auth Plugin (`plugins/auth.ts`)
- OnRequest hook for token verification
- Sets `request.userId`, `request.isAdmin`, `request.isGuest`
- Handles Bearer token extraction
- Routes to different token verifiers (user vs admin)
- Checks ban status

### Rate Limit Plugin (`plugins/rateLimit.ts`)
11 per-endpoint rate limit profiles:

| Profile | Limit | Use Case |
|---------|-------|----------|
| Auth endpoints | 5 req/min | Brute force protection |
| PvP challenges | 20 req/min | Challenge spam prevention |
| Guild battles | 20 req/min | Battle spam prevention |
| Leaderboard | 120 req/min | High read frequency |
| Default | 100 req/min | General endpoints |

Headers returned:
- `x-ratelimit-limit`
- `x-ratelimit-remaining`
- `retry-after`

### Error Handler Plugin (`plugins/errorHandler.ts`)
- Zod validation error formatting
- Rate limit error handling (429)
- SystemError database logging
- Custom error responses with requestId

### WebSocket Plugin (`plugins/websocket.ts`)
- Real-time messaging for:
  - Guild chat
  - Direct messages
  - System broadcasts
- Token auth via protocol header
- Connection pooling per userId
- Redis pub/sub for scaling

---

## Database Schema (Prisma)

### Core User Tables
| Table | Fields | Description |
|-------|--------|-------------|
| User | 35 | Authentication, profile, progression |
| Session | - | JWT refresh token storage |
| PasswordResetToken | - | Password reset with expiry |
| Inventory | - | Gold, dust, materials, items |
| Progression | - | Level, XP, slots |

### Game Systems
| Table | Description |
|-------|-------------|
| Run | Tower Defense run records |
| GameSession | Endless mode sessions |
| BossRushSession | Boss Rush tracking |
| PvpChallenge | Battle records |
| LeaderboardEntry | Weekly rankings |

### Guild System
| Table | Description |
|-------|-------------|
| Guild | Guild metadata and treasury |
| GuildMember | Member records with roles |
| GuildInvitation | Join invitations |
| GuildApplication | Application records |
| GuildBattle | Guild vs Guild battles |
| GuildBoss | Boss encounter state |
| GuildTowerRace | Tower race events |
| GuildStructures | Building upgrades |
| GuildMedals | Medal awards |
| GuildChat | Guild messages |

### Social & Moderation
| Table | Description |
|-------|-------------|
| Message | Direct messages |
| ChatMessage | Chat room messages |
| MessageParticipant | Chat participants |
| MessageReport | Message reports |
| UserBlock | Block relationships |
| UserMute | Mute relationships |

### Economy
| Table | Description |
|-------|-------------|
| ShopPurchase | Purchase records |
| GachaPull | Gacha pull history |
| BattlePassProgress | Battle pass state |
| UserEnergy | Premium energy |
| ActiveBooster | Passive bonuses |
| UserCosmetic | Cosmetic items |

---

## Configuration

### Required Environment Variables

```env
# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://...

# Redis
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=<min 32 chars>
# Optional: For secret rotation - set to previous secret to allow old tokens to still be verified
# After all refresh tokens expire (7 days), you can remove this variable
JWT_SECRET_PREVIOUS=<min 32 chars>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Run Tokens
RUN_TOKEN_SECRET=<min 32 chars>
RUN_TOKEN_EXPIRY_SECONDS=600

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=60000

# Stripe (optional)
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
```

---

## Security Features

1. **JWT-based authentication** with separate token types
2. **Brute-force protection** on login (5 attempts/10 min)
3. **Rate limiting** per endpoint with Redis backing
4. **Content filtering** on user-generated content
5. **Security headers** (CSP, HSTS, X-Frame-Options)
6. **Ban system** at auth level
7. **Guest user restrictions** for PvP/premium features

### Content Filtering Details

System filtrowania treści jest **regex-based z listami słów** (nie ML-based). Używany w czacie gildyjnym, wiadomościach prywatnych i systemowych.

**Implementacja:** `apps/server/src/lib/contentFilter.ts`

#### 1. Profanity Filter (Filtr Wulgaryzmów)

- **Metoda:** Regex patterns z word boundaries
- **Języki:** Polski + Angielski
- **Mechanizm:**
  - Lista słów zakazanych (25+ polskich, 20+ angielskich)
  - Każde słowo konwertowane na regex pattern z:
    - Word boundaries (`\b`)
    - Character substitutions (a→@/4, e→3, i→1/!, o→0, s→$/5, t→7, u→v)
  - Zastępowanie: wulgaryzmy zamieniane na `*` (zachowana długość)
- **Przykład:** `kurwa` → `*****`, `fuck` → `****`

**Listy słów:**
- Polskie: kurwa, chuj, pierdol, jebac, skurwysyn, dupa, cipa, gowno, pedal, debil, etc.
- Angielskie: fuck, shit, ass, bitch, dick, cunt, nigger, etc.

#### 2. Link Validation (Walidacja Linków)

- **Whitelist domains:** Discord, YouTube, Twitter/X, Reddit, Twitch, domeny gry
- **Phishing detection:** Regex patterns wykrywające lookalike domeny:
  - PayPal lookalikes (`paypa[l1]`, `pavpal`)
  - Steam lookalikes (`ste[a@4]m`, `steamcornmunity`)
  - Discord lookalikes (`disc[o0]rd`, `dlscord`)
  - Suspicious TLDs: `.ru`, `.cn`, `.tk`, `.ml`, `.ga`, `.cf`, `.gq`
- **Akcja:** Linki phishing = hard block (błąd), nie-whitelisted = hard block

#### 3. Spam Pattern Detection

- **Metoda:** Regex patterns dla typowych scam/spam treści
- **Wykrywane wzorce:**
  - "Darmowe gold/gems/coins" (free stuff scams)
  - "Kliknij tutaj/link" (click bait)
  - "Podaj hasło/password" (account phishing)
  - "Zarabiaj online" (money scams)
  - "Zweryfikuj konto" (verification phishing)
  - Powtarzające się znaki (aaaaaaa, !!!!!!)
- **Akcja:** Warning (nie blokuje, ale oznacza jako spam)

#### 4. Rate Limiting (Ograniczenia Częstotliwości)

- **Wiadomości:** 30/h per user
- **Wątki:** 10/h per user
- **Cooldown:** 5 sekund między wiadomościami
- **Flood protection:** Max 3 identyczne wiadomości w 60s

#### 5. Workflow Walidacji

```
1. Sprawdź phishing links → HARD BLOCK jeśli znaleziono
2. Sprawdź blocked links → HARD BLOCK jeśli nie-whitelisted
3. Wykryj spam patterns → WARNING (nie blokuje)
4. Filtruj profanity → Zastąp gwiazdkami + WARNING
5. Zwróć filteredContent + warnings/errors
```

#### 6. Użycie w Systemie

- **Guild Chat:** `guildChat.ts` - filtruje przed zapisem
- **Private Messages:** `messages.ts` - filtruje przed wysłaniem
- **System Messages:** Nawet admin messages są filtrowane (bezpieczeństwo)

**Response format:**
```typescript
{
  isValid: boolean,
  filteredContent: string,  // Oczyszczona treść
  errors: string[],          // Hard blocks
  warnings: string[]         // Soft warnings (spam, cenzura)
}
```

**Limitations:**
- Nie wykrywa kontekstu (np. "kurwa" w "kurwa mać" vs "kurwa" jako przekleństwo)
- Nie obsługuje leetspeak złożonego (tylko podstawowe substytucje)
- Listy słów wymagają ręcznej aktualizacji
- Brak ML-based detection dla zaawansowanych przypadków

---

## Performance Features

1. **Redis caching** for leaderboard snapshots
2. **Job queue** for heavy operations (BullMQ)
3. **Horizontal scaling** ready (Redis pub/sub for WebSocket)
4. **Connection pooling** via Prisma and IORedis
5. **Graceful shutdown** with resource cleanup

---

## Statistics

- **Total TypeScript Files**: 111 (excluding tests)
- **Route Modules**: 31
- **Service Modules**: 50+
- **Database Models**: 50+
- **Background Jobs**: 5 workers
- **Plugins**: 4
- **Authentication Token Types**: 6
- **Rate Limit Profiles**: 11
- **API Endpoints**: 150+
