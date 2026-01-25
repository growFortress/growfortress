# Grow Fortress Documentation

## Quick Links

| Category | Document | Description |
|----------|----------|-------------|
| **Architecture** | [SERVER.md](SERVER.md) | Backend server (Fastify, Prisma, Redis) |
| | [WEB.md](WEB.md) | Web client (Preact, Pixi.js, Signals) |
| | [ADMIN.md](ADMIN.md) | Admin panel pages and features |
| | [PROTOCOL.md](PROTOCOL.md) | Shared schemas (Zod, TypeScript) |
| | [SIM-CORE.md](SIM-CORE.md) | Simulation engine (physics, combat) |
| | [BACKUP-STRATEGY.md](BACKUP-STRATEGY.md) | Backup and recovery procedures |
| | [BACKUP-SETUP.md](BACKUP-SETUP.md) | Quick setup guide for backups |
| | [RENDER-BACKUP-CONFIG.md](RENDER-BACKUP-CONFIG.md) | Render production backup configuration |
| **Gameplay** | [GAME-MODES.md](GAME-MODES.md) | Game modes (Endless, Boss Rush, Challenge) |
| | [PILLARS.md](PILLARS.md) | World sectors and enemies |
| | [ENEMIES.md](ENEMIES.md) | Enemy types and boss mechanics |
| **Units** | [HEROES.md](HEROES.md) | 13 playable units |
| | [TURRETS.md](TURRETS.md) | 4 tower types |
| | [CLASSES.md](CLASSES.md) | 7 fortress configurations |
| **Progression** | [PROGRESSION.md](PROGRESSION.md) | Leveling, unlocks, tiers |
| | [ACHIEVEMENTS.md](ACHIEVEMENTS.md) | Permanent achievements (24 achievements, ~226 tiers) |
| | [MASTERY.md](MASTERY.md) | 7 class skill trees |
| | [CRYSTALS.md](CRYSTALS.md) | Crystal Matrix system |
| **Items** | [RELICS.md](RELICS.md) | 27 wave rewards |
| | [ARTIFACTS.md](ARTIFACTS.md) | Equipment, materials, colonies |
| **Economy** | [ECONOMY.md](ECONOMY.md) | Currencies, gacha, shop |
| **Multiplayer** | [guild-system.md](guild-system.md) | Guild system (PL) |
| | [pvp-arena.md](pvp-arena.md) | PvP arena (PL) |
| **Systems** | [GAME_SYSTEMS.md](GAME_SYSTEMS.md) | General overview (PL) |

---

## Technical Overview

### Stack

**Server** (`apps/server`):
- Fastify + TypeScript
- PostgreSQL (Prisma ORM)
- Redis + BullMQ (caching, jobs)
- JWT authentication (6 token types)

**Web Client** (`apps/web`):
- Preact + Preact Signals
- Pixi.js v8 (WebGPU/WebGL)
- TanStack Query
- i18next (EN/PL)

**Simulation** (`packages/sim-core`):
- Deterministic physics
- Q16.16 fixed-point math
- Xorshift32 seeded RNG
- 30 Hz tick rate

**Protocol** (`packages/protocol`):
- Zod schemas (200+)
- Shared types (300+)
- Schema version: 2

### Key Numbers

| Metric | Count |
|--------|-------|
| Heroes | 13 |
| Turrets | 4 |
| Fortress Classes | 7 |
| Relics | 27 |
| Enemies | 27 |
| Pillars | 6 |
| Achievements | 24 (~226 tiers) |
| Mastery Nodes | 126 (18×7) |
| API Routes | 31 modules |
| Services | 50+ |
| Signals | 32 domains |
| Modals | 45+ |

---

## Game Concepts

### Core Loop
1. Start session (select class, heroes, turrets)
2. Defend fortress against waves
3. Choose relics after each wave
4. Progress through 6 pillars (100 waves)
5. Endless mode cycles with scaling

### Progression Systems
- **Commander Level** (1-50+): XP from kills/waves
- **Unit Tiers** (1-3): Gold + dust upgrades
- **Power Upgrades**: Permanent stat bonuses
- **Mastery Trees**: 100 points per class
- **Crystal Matrix**: 6 crystals for ultimate ability

### Multiplayer
- **PvP Arena**: 1v1 fortress battles (async)
- **Guild System**: 10-30 players, 5v5 arena
- **Leaderboards**: Weekly rankings with rewards

---

## Directory Structure

```
/
├── apps/
│   ├── server/          # Backend API
│   ├── web/             # Game client
│   └── admin/           # Admin panel
├── packages/
│   ├── sim-core/        # Game simulation
│   └── protocol/        # Shared schemas
└── docs/                # Documentation
```

---

## Formulas Reference

### XP Requirements
```
Level 1-10:  XP = level × 200
Level 11-30: XP = level² × 18
Level 31-50: XP = level² × 40
Level 51+:   XP = 100,000 + (level - 50) × 8,000
```

### Wave Scaling
```
waveScale = 1 + (wave - 1) × 0.12      // +12% per wave
cycleScale = 1.6^cycle                  // ×1.6 per 100 waves
```

### Damage Formula
```
finalDamage = baseDamage
  × (1 + damageBonus)
  × classModifier
  × pillarModifier
  × critMultiplier
  × weaknessMultiplier
```

### Diminishing Returns
| Stat | Soft Cap | Hard Cap |
|------|----------|----------|
| Crit Chance | 50% | 75% |
| Damage Bonus | 200% | 500% |
| Attack Speed | 100% | 300% |
| CDR | - | 75% |
| Resistances | - | 90% |

---

## Contributing

When adding new documentation:
1. Use English for new files
2. Follow existing format/structure
3. Include formulas and constants
4. Reference source files when applicable
5. Update this index

---

## Glossary

| Term | Definition |
|------|------------|
| FP | Fixed-point (Q16.16: 65536 = 1.0) |
| Tick | Game update (30/second) |
| Pillar | World sector (10 waves each) |
| Cycle | 100-wave rotation through all pillars |
| Synergy | Bonus for matching hero/turret to class |
| Crystal Matrix | All 6 crystals equipped |
| Honor | PvP rating (ELO-based) |
| Dust | Premium currency |
| Guild Coins | Guild activity currency |
