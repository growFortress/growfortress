# Arcade Roguelite Tower Defense

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
│   └── web/              # Vite + Canvas2D frontend (IndexedDB)
├── docs/                 # Game documentation
├── docker-compose.yml    # PostgreSQL + Redis
└── pnpm-workspace.yaml
```

## Architecture

### Deterministic Simulation (`packages/sim-core`)

The game uses a fully deterministic simulation that produces identical results on client and server:

- **Xorshift32 RNG**: Custom seeded PRNG, no `Math.random()`
- **Fixed 30Hz Tick Rate**: Simulation advances in fixed timesteps
- **Q16.16 Fixed-Point Math**: Integer-based calculations for precision
- **Checkpoint Hashing**: FNV-1a 32-bit hash of game state
- **Replay Support**: Server can replay any run from events

### Anti-Cheat System

Multiple layers prevent cheating and reward manipulation:

1. **Run Token (HMAC SHA-256)**
   - Server generates signed token with: `runId`, `userId`, `seed`, `simVersion`, `auditTicks`, `exp`
   - Token required to finish run, expires after 10 minutes

2. **Event Log with Tick Validation**
   - All player actions include tick number
   - Server validates: monotonic ticks, cooldowns, valid choices
   - Events: `CHOOSE_RELIC`, `REROLL_RELICS`

3. **Checkpoint Chain**
   - Hash chain: `chainHash = H(prevChain || tick || stateHash)`
   - Created every 300 ticks + at wave end
   - Server replays and compares all checkpoints

4. **Audit Ticks**
   - Server generates 3-5 random tick numbers on run start
   - Client MUST provide checkpoints at these exact ticks
   - Prevents "perfect play" injection after the fact

### Offline Support

The web client works offline:

- **IndexedDB Storage**: Pending finishes queued locally
- **Sync Manager**: Monitors online/offline status
- **Exponential Backoff**: Retries with increasing delays
- **Max 5 Retries**: Gives up after persistent failures

## Game Content Overview

### Fortress Classes (5)

| Class | Description | Bonuses |
|-------|-------------|---------|
| **Natural** | Balanced starter class | +10% DMG, +15% HP, +2 HP regen |
| **Ice** | Crowd control & slow | +20% DMG, +25% crit DMG, -10% AS |
| **Fire** | Maximum damage & DOT | +20% DMG, +8% crit, 25% splash |
| **Lightning** | Fast attacks & chains | +40% AS, +25% chain, 2 chains |
| **Tech** | Precision & economy | +2 pierce, +15% crit, +15% gold |

### Heroes (6)

| Hero | Class | Role | Marvel Inspiration |
|------|-------|------|-------------------|
| **Thunderlord** | Lightning | DPS | Thor |
| **Iron Sentinel** | Tech | Tank | Iron Man |
| **Jade Titan** | Natural | Tank | Hulk |
| **Shield Captain** | Natural | Tank | Captain America |
| **Scarlet Mage** | Fire | DPS | Scarlet Witch |
| **Frost Archer** | Ice | DPS | Hawkeye |

Each hero has 3 tiers with 2 skills per tier.

### Turrets (4)

| Turret | Role | Description |
|--------|------|-------------|
| **Arrow Tower** | DPS | Fast, single-target damage |
| **Frost Tower** | Crowd Control | Slows enemies |
| **Cannon Tower** | AoE | Area damage |
| **Tesla Tower** | Chain | Lightning chains between enemies |

### Relics (~25)

Categories: Build-Defining, Standard, Class, Pillar, Synergy, Economy, Cursed

See [docs/RELICS.md](docs/RELICS.md) for full list.

### Enemy Types

| Type | HP | Speed | Damage | Special |
|------|-----|-------|--------|---------|
| Runner | 20 | Fast (3) | 5 | Quick but fragile |
| Bruiser | 100 | Slow (1) | 15 | Tanky, hits hard |
| Leech | 40 | Medium (2) | 3 | Heals 20% HP on hit |

- Elites spawn randomly (5-30% chance, scaling with wave)
- Elites have 3x HP, 2x damage, gold border

## Documentation

- [Game Systems](docs/GAME_SYSTEMS.md) - Core mechanics overview
- [Classes](docs/CLASSES.md) - Fortress class details
- [Heroes](docs/HEROES.md) - Hero definitions and skills
- [Turrets](docs/TURRETS.md) - Turret types and stats
- [Relics](docs/RELICS.md) - All relics by category
- [Progression](docs/PROGRESSION.md) - Level unlocks and bonuses

## Versioning

Three-tier versioning ensures compatibility:

| Version | Location | Purpose |
|---------|----------|---------|
| `SIM_VERSION` | `packages/sim-core` | Simulation logic version |
| `SCHEMA_VERSION` | `packages/protocol` | API payload version |
| `inventory.version` | Database | Meta schema migrations |

When updating simulation logic:
1. Increment `SIM_VERSION`
2. Server stores version with each run
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

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | Health check |
| POST | `/v1/auth/guest` | No | Create guest account |
| POST | `/v1/auth/refresh` | No | Rotate refresh token |
| GET | `/v1/profile` | Yes | Get user profile |
| POST | `/v1/runs/start` | Yes | Start new run |
| POST | `/v1/runs/:runId/finish` | Yes | Finish and verify run |
| GET | `/v1/leaderboards/weekly` | Optional | Get weekly leaderboard |
| POST | `/v1/unlocks/relic` | Yes | Unlock relic (spend dust) |
| POST | `/v1/telemetry/batch` | Optional | Batch telemetry events |

### Run Finish Flow

1. Client sends: `{ runToken, events[], checkpoints[], finalHash, score, summary }`
2. Server validates:
   - Run token signature and expiry
   - Event ticks are monotonic
   - All audit tick checkpoints present
3. Server replays simulation
4. Compares checkpoint chain hashes
5. Compares final hash
6. If verified:
   - Calculates rewards deterministically
   - Updates inventory (gold, dust)
   - Updates mastery (XP, level)
   - Upserts leaderboard entry
7. If rejected: saves reason, no rewards

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

**Replay Verification Tests:**
- Valid run is verified successfully
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

# Run Token (change in production!)
RUN_TOKEN_SECRET="min-32-characters-secret-key-here"
RUN_TOKEN_EXPIRY_SECONDS=600

# Server
PORT=3000
NODE_ENV="development"
```

## Rate Limiting

| Endpoint | Limit |
|----------|-------|
| Global | 100 req/min per IP |
| `/v1/runs/start` | 10/min per user |
| `/v1/runs/:id/finish` | 20/min per user |

## Background Jobs (BullMQ)

| Job | Schedule | Description |
|-----|----------|-------------|
| `leaderboard-snapshot` | Hourly | Cache top 100 in Redis |
| `cleanup-expired-runs` | Every 5 min | Mark expired runs as rejected |

## License

MIT
