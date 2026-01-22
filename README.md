# Grow Fortress - Arcade Roguelite Tower Defense

A full-stack arcade roguelite tower defense game with deterministic simulation, server-side verification, and anti-cheat protection.

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Start database and cache
pnpm dev:db

# 3. Wait for containers to be ready, then run migrations
pnpm prisma:migrate

# 4. Generate Prisma client
pnpm prisma:generate

# 5. Start development servers
pnpm dev
```

- Server: http://localhost:3000
- Web client: http://localhost:5173

## Project Structure

```
arcade/
├── packages/
│   ├── protocol/         # Shared Zod schemas and types (SCHEMA_VERSION)
│   └── sim-core/         # Deterministic game simulation (SIM_VERSION)
├── apps/
│   ├── server/           # Fastify backend (Prisma, Redis, BullMQ)
│   ├── web/              # Vite + Canvas2D frontend (IndexedDB)
│   └── admin/            # Admin dashboard
├── docs/                 # Game documentation
├── docker-compose.yml    # PostgreSQL + Redis
└── pnpm-workspace.yaml
```

## Game Modes

### 1. Endless Session (Main Mode)
Defend your fortress against infinite waves of enemies. Pillars (thematic chapters) cycle every 100 waves.

### 2. Boss Rush
Endless boss-only mode with weekly leaderboards based on total damage dealt.

### 3. PvP Arena
Asynchronous 1v1 fortress battles with deterministic replays.

### 4. Guild Battles
Team vs team PvP for guilds with shared treasury and progression.

See [docs/GAME_SYSTEMS.md](docs/GAME_SYSTEMS.md) for full details.

## Architecture

### Deterministic Simulation (`packages/sim-core`)

The game uses a fully deterministic simulation that produces identical results on client and server:

- **Xorshift32 RNG**: Custom seeded PRNG, no `Math.random()`
- **Fixed 30Hz Tick Rate**: Simulation advances in fixed timesteps
- **Q16.16 Fixed-Point Math**: Integer-based calculations for precision
- **Checkpoint Hashing**: FNV-1a 32-bit hash of game state
- **Replay Support**: Server can replay any session from events

### Anti-Cheat System

Multiple layers prevent cheating and reward manipulation:

1. **Session Token (HMAC SHA-256)**
   - Server generates signed token with: `sessionId`, `userId`, `seed`, `simVersion`, `auditTicks`, `exp`
   - Token required for segment submission

2. **Segment-Based Verification**
   - Endless sessions are split into segments (every 5 waves)
   - Each segment submitted and verified independently
   - Rewards granted per verified segment

3. **Event Log with Tick Validation**
   - All player actions include tick number
   - Server validates: monotonic ticks, cooldowns, valid choices
   - Events: `CHOOSE_RELIC`, `REROLL_RELICS`, `ACTIVATE_ANNIHILATION`

4. **Checkpoint Chain**
   - Hash chain: `chainHash = H(prevChain || tick || stateHash)`
   - Created every 300 ticks + at wave end
   - Server replays and compares all checkpoints

5. **Audit Ticks**
   - Server generates random tick numbers per segment
   - Client MUST provide checkpoints at these exact ticks
   - Prevents "perfect play" injection after the fact

### Offline Support

The web client works offline:

- **IndexedDB Storage**: Active session state saved locally
- **Session Recovery**: Resume interrupted sessions
- **Sync Manager**: Monitors online/offline status for telemetry

## Game Content Overview

> **Lore**: Rok 2347. Ludzkość odkryła Starożytne Kryształy - sześć artefaktów nieznanej energii pozostawionych przez wymarłą cywilizację. Aktywacja ostatniego Kryształu otworzyła Wyrwę - portal, przez który wdziera się niekończący się Rój obcych istot. Ostatnie ludzkie twierdze bronią się za pomocą elitarnych jednostek bojowych i odzyskanej technologii.

### Fortress Configurations (5)

| Configuration | Description | Bonuses |
|---------------|-------------|---------|
| **Standardowa** | Balanced starter config | +10% DMG, +15% HP, +2 HP regen |
| **Kriogeniczna** | Crowd control & slow | +20% DMG, +25% crit DMG, -10% AS |
| **Termiczna** | Maximum damage & DOT | +20% DMG, +8% crit, 25% splash |
| **Elektryczna** | Fast attacks & chains | +40% AS, +25% chain, 2 chains |
| **Kwantowa** | Precision & economy | +2 pierce, +15% crit, +15% gold |

### Sectors (6 Chapters)

| Sector | Waves | Theme |
|--------|-------|-------|
| **Streets** | 1-10 | Urban combat zones |
| **Science** | 11-25 | Research facilities, drones |
| **Mutants** | 26-40 | Bioengineered threats |
| **Cosmos** | 41-60 | Orbital stations, alien tech |
| **Magic** | 61-80 | Dimensional rifts, anomalies |
| **Nexus** | 81-100 | Core breach, final defense |

After wave 100, sectors cycle back (wave 101 = Streets).

### Combat Units (6)

| Unit | Class | Role | Specialty |
|------|-------|------|-----------|
| **Unit-7 "Storm"** | Lightning | DPS | Electrical attacks |
| **Unit-3 "Forge"** | Tech | Tank | Shield systems |
| **Unit-1 "Titan"** | Natural | Tank | Physical resilience |
| **Unit-0 "Vanguard"** | Natural | Tank | Defensive protocols |
| **Unit-9 "Rift"** | Fire | Support | Thermal attacks |
| **Unit-5 "Frost"** | Ice | DPS | Cryo weapons |

Each unit has 3 tiers: Base → Mk.II → APEX.

### Defense Towers (4)

| Tower | Role | Description |
|-------|------|-------------|
| **Wieża Railgun** | DPS | Fast, single-target kinetic damage |
| **Wieża Kriogeniczna** | Crowd Control | Slows enemies with cryo field |
| **Wieża Artyleryjska** | AoE | Area explosive damage |
| **Wieża Łukowa** | Chain | Electric arcs between enemies |

### Relics (~25)

Categories: Build-Defining, Standard, Class, Sector, Synergy, Economy, Cursed

See [docs/RELICS.md](docs/RELICS.md) for full list.

### Ancient Crystals (6)

Endgame collectibles that drop from sector bosses. Collect all 6 + Crystal Matrix artifact for Annihilation Wave ability.

| Crystal | Effect | Drops From |
|---------|--------|------------|
| **Kryształ Mocy** | +50% damage | Cosmos bosses |
| **Kryształ Próżni** | +100% range | Cosmos bosses |
| **Kryształ Czasu** | -50% cooldowns | Magic bosses |
| **Kryształ Materii** | Adaptive damage | Magic bosses |
| **Kryształ Życia** | 30% lifesteal | Nexus bosses |
| **Kryształ Umysłu** | +50% XP | Science bosses |

## Documentation

- [Game Systems](docs/GAME_SYSTEMS.md) - Core mechanics and game modes
- [Classes](docs/CLASSES.md) - Fortress class details
- [Heroes](docs/HEROES.md) - Hero definitions and skills
- [Turrets](docs/TURRETS.md) - Turret types and stats
- [Relics](docs/RELICS.md) - All relics by category
- [Progression](docs/PROGRESSION.md) - Level unlocks and bonuses
- [PvP Arena](docs/pvp-arena.md) - PvP system documentation
- [Guild System](docs/guild-system.md) - Guild features

## Versioning

Three-tier versioning ensures compatibility:

| Version | Location | Purpose |
|---------|----------|---------|
| `SIM_VERSION` | `packages/sim-core` | Simulation logic version |
| `SCHEMA_VERSION` | `packages/protocol` | API payload version |
| `inventory.version` | Database | Meta schema migrations |

When updating simulation logic:
1. Increment `SIM_VERSION`
2. Server stores version with each session
3. Replay uses matching version logic

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm install` | Install all dependencies |
| `pnpm dev` | Start server + web (parallel) |
| `pnpm dev:db` | Start Postgres + Redis containers |
| `pnpm dev:server` | Start backend only |
| `pnpm dev:web` | Start frontend only |
| `pnpm build` | Build all packages |
| `pnpm typecheck` | TypeScript type checking |
| `pnpm test` | Run all tests |
| `pnpm prisma:migrate` | Run database migrations |
| `pnpm prisma:generate` | Generate Prisma client |
| `pnpm prisma:studio` | Open Prisma Studio GUI |

## API Endpoints

### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/v1/auth/register` | No | Create account |
| POST | `/v1/auth/login` | No | Login |
| POST | `/v1/auth/refresh` | No | Rotate refresh token |
| GET | `/v1/profile` | Yes | Get user profile |

### Sessions (Endless Mode)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/v1/sessions/start` | Yes | Start endless session |
| POST | `/v1/sessions/:id/segment` | Yes | Submit segment for verification |
| POST | `/v1/sessions/:id/end` | Yes | End session |
| GET | `/v1/sessions/active` | Yes | Get active session |

### Boss Rush
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/v1/boss-rush/start` | Yes | Start boss rush |
| POST | `/v1/boss-rush/:id/finish` | Yes | Finish boss rush |
| GET | `/v1/boss-rush/leaderboard` | Optional | Weekly leaderboard |

### PvP Arena
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/v1/pvp/opponents` | Yes | List matchable opponents |
| POST | `/v1/pvp/challenges` | Yes | Create and resolve challenge immediately |
| POST | `/v1/pvp/challenges/:id/accept` | Yes | Legacy accept (not used in async flow) |
| GET | `/v1/pvp/replay/:id` | Yes | Get battle replay |

### Other
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | Health check |
| GET | `/v1/leaderboards/weekly` | Optional | Weekly leaderboard |
| POST | `/v1/telemetry/batch` | Optional | Batch telemetry events |

## Testing

```bash
# Run all tests
pnpm test

# Run sim-core tests only
cd packages/sim-core && pnpm test
```

### Test Coverage

**Determinism Tests:**
- Same seed produces identical RNG sequence
- Same seed + events = identical final hash
- Same seed + events = identical checkpoint chain

**Verification Tests:**
- Valid segment is verified successfully
- Tampered event tick is rejected
- Missing audit tick checkpoint is rejected
- Tampered checkpoint hash is rejected
- Non-monotonic ticks are rejected

## Environment Variables

See `.env.example`:

```env
# Database
DATABASE_URL="postgresql://arcade:arcade@localhost:5432/arcade"

# Redis
REDIS_URL="redis://localhost:6379"

# Auth (change in production!)
JWT_SECRET="min-32-characters-secret-key-here"
JWT_ACCESS_EXPIRY="15m"
JWT_REFRESH_EXPIRY="7d"

# Session Token (change in production!)
SESSION_TOKEN_SECRET="min-32-characters-secret-key-here"

# Server
PORT=3000
NODE_ENV="development"
CORS_ORIGINS="http://localhost:5173"
```

## Rate Limiting

| Endpoint | Limit |
|----------|-------|
| Global | 100 req/min per IP |
| `/v1/sessions/start` | 10/min per user |
| `/v1/sessions/:id/segment` | 30/min per user |
| `/v1/pvp/challenges` | 20/min per user |

## Background Jobs (BullMQ)

| Job | Schedule | Description |
|-----|----------|-------------|
| `leaderboard-snapshot` | Hourly | Cache top 100 in Redis |
| `metrics-snapshot` | Every 5 min | Record system metrics |

## Community

Join the Grow Fortress community:

- 💬 **[Discord](https://discord.gg/tY87dwqE)** - Chat, strategy discussions, and support
- 🐦 **[X/Twitter](https://x.com/GrowFortress)** - Updates and announcements

## License

MIT
