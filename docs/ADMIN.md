# Admin Panel

## Overview

The admin panel is a separate application located at `/apps/admin` with its own routing and authentication system. It uses Preact, React Query, and Preact Router.

---

## Routes & Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | Dashboard | Real-time system metrics and activity monitoring |
| `/players` | Players Management | Browse and search all players with pagination |
| `/players/:id` | Player Details | Individual player profile, progression, and actions |
| `/events` | Event Manager | Create and manage game events (XP/Gold/Dust multipliers) |
| `/banners` | Gacha Banners | Manage gacha pull banners (Hero/Artifact) |
| `/rewards` | Bulk Rewards | Distribute rewards to all players |
| `/bug-reports` | Bug Reports | View and debug submitted player bug reports |
| `/debug/:sessionId` | Session Debugger | Advanced debugging with replay viewer and state inspector |
| `/support-tickets` | Support Tickets | Browse and respond to player support requests |
| `/support-tickets/:id` | Ticket Details | View full ticket conversation and update status |
| `/config` | Remote Config | Modify game balance parameters in real-time |
| `/replay/:id` | Replay Viewer | Watch recorded gameplay sessions |

---

## Player Management

### Player List Page (`/players`)

- **Search functionality** - Find players by username or ID
- **Pagination** - 20 players per page
- **Columns**: Username, display name, role (ADMIN/USER), ban status, creation date

### Player Details Page (`/players/:id`)

**Player Information**:
- Display name, username, user ID
- Ban status with toggle button
- User role badge
- Progression stats (level, XP, highest wave)

**Inventory Display**:
- Gold balance
- Dust balance
- Sigils count

**Player Actions**:
| Action | Description |
|--------|-------------|
| Ban/Unban User | Toggle ban status (revokes active sessions) |
| Reset Progress | Wipe player's level, XP, and inventory |
| Grant Rewards | Award gold and dust to specific player |

**Game History**:
- Standard Runs - Date, seed, max waves, replay link
- Endless Sessions - Start date, current wave, status, replay link

---

## Content Management

### Event Manager (`/events`)

Create and manage temporary game events with multipliers.

**Event Types**:
| Type | Description |
|------|-------------|
| MULTIPLIER_XP | Experience boost |
| MULTIPLIER_GOLD | Gold boost |
| MULTIPLIER_DUST | Dust boost |

**Event Properties**:
- Name and description
- Multiplier value (e.g., 2.0 = double)
- Start and end datetime (scheduled)

**Status Badges**:
| Status | Description |
|--------|-------------|
| LIVE (green, pulsing) | Currently active |
| SCHEDULED (yellow) | Upcoming |
| EXPIRED (gray) | Past event |
| DISABLED (red) | Inactive |

### Gacha Banners (`/banners`)

Manage gacha pull banners for hero/artifact summoning.

**Banner Properties**:
| Property | Description |
|----------|-------------|
| Name & Description | Banner display info |
| Type | HERO or ARTIFACT |
| Featured Items | Comma-separated IDs (e.g., "storm, frost_unit, rift") |
| Rate-up Multiplier | 1-10x boost for featured items |
| Schedule | Start and end datetime |
| Priority | Display order (higher = first) |
| Image URL | Optional banner image |

### Bulk Rewards (`/rewards`)

Distribute rewards to all players (compensation, promotions).

**Reward Types**:
| Type | Value Format |
|------|--------------|
| GOLD | Amount of gold |
| DUST | Amount of dust |
| SIGILS | Amount of sigils |
| ITEM | itemId:amount |
| ARTIFACT | Artifact ID |

---

## Support System

### Support Tickets (`/support-tickets`)

**Stats Summary**:
- Total open tickets
- In-progress tickets

**Filters**:
| Filter | Options |
|--------|---------|
| Status | OPEN, IN_PROGRESS, RESOLVED, CLOSED |
| Category | BUG_REPORT, ACCOUNT_ISSUE, PAYMENT, OTHER |
| Search | By user or subject |

**Category Icons**:
- Bug Report - Bug emoji
- Account Issue - User emoji
- Payment - Credit card emoji
- Other - Chat emoji

### Ticket Details (`/support-tickets/:id`)

- Full ticket conversation thread
- Update ticket status (OPEN -> IN_PROGRESS -> RESOLVED -> CLOSED)
- Add staff responses
- View all messages

---

## Debugging & Analytics

### Dashboard (`/`)

**Real-time Monitoring (updates every 30 seconds)**:
| Metric | Description |
|--------|-------------|
| CCU | Concurrent users (active players) |
| Active Sessions | Ongoing gameplay sessions |
| API Errors | Error count in past hour |
| Activity Chart | 24-hour CCU trend visualization |

### Bug Reports (`/bug-reports`)

| Column | Description |
|--------|-------------|
| User | Display name + username |
| Session ID | Abbreviated session identifier |
| Tick | Tick number when bug occurred |
| Description | Bug description text |
| Date | Report timestamp |
| Action | Debug button linking to session debugger |

### Session Debugger (`/debug/:sessionId`)

**Replay Viewer**:
- Visualize exact gameplay
- Scrub through timeline slider
- See seed, config, and all events

**State Inspector**:
- Input specific tick number
- Fetch server-side simulation state at that tick
- View JSON with all internal variables
- Inspect Fixed Point (FP) values

### Remote Config (`/config`)

Adjust game balance without redeployment.

**Editable Parameters**:
| Parameter | Default | Description |
|-----------|---------|-------------|
| fortressBaseHp | 100 | Starting health points |
| fortressBaseDamage | 10 | Starting damage output |
| waveIntervalTicks | 90 | Ticks between waves (30 ticks = 1 second) |

Changes take effect on NEW sessions only.

---

## In-Game Admin Panels

Accessible from Settings menu for ADMIN users.

### Admin Broadcast Panel

**Endpoint**: `/admin/messages/broadcast`

- Send system-wide or targeted messages
- Subject (max 100 chars)
- Content (max 2000 chars)
- Target: specific usernames or all players
- View broadcast history (last 20)

### Moderation Panel

**Endpoints**: `/v1/moderation/reports`, `/v1/moderation/reports/:id`

**Report Reasons**: SPAM, SCAM, OFFENSIVE, HARASSMENT, OTHER

**Report Statuses**: PENDING, REVIEWED, ACTIONED, DISMISSED

**Available Actions**:
| Action | Description |
|--------|-------------|
| Dismiss | Close without action |
| Warn User | Send warning to player |
| Mute User | Silence for 1h, 24h, 7d, 30d, or permanent |
| Permanent Ban | Ban user with confirmation |

---

## Authentication

- Separate authentication via `/api/v1/admin/auth/refresh`
- Bearer token authentication
- Token stored in Preact Signal `adminToken`
- Automatic token refresh on 401
- Only users with ADMIN role can access

---

## API Endpoints

### Players
```
GET  /users?page=X&limit=20&search=query
GET  /users/:id
POST /users/:id/ban (body: {banned: boolean})
POST /users/:id/reset
POST /users/:id/grant (body: {gold, dust})
```

### Events
```
GET  /events
POST /events
PATCH /events/:id (body: {isActive})
DELETE /events/:id
```

### Banners
```
GET  /banners
POST /banners
PATCH /banners/:id
DELETE /banners/:id
```

### Bulk Rewards
```
GET  /bulk-rewards
POST /bulk-rewards
```

### Bug Reports
```
GET  /bug-reports?page=X
GET  /bug-reports/:id
```

### Support
```
GET  /support-tickets?page=X&status=X&category=X&search=query
GET  /support-tickets/stats
GET  /support-tickets/:id
PATCH /support-tickets/:id/status (body: {status})
POST /support-tickets/:id/responses (body: {content})
```

### Config
```
GET  /config
POST /config/:key (body: {value, description})
```

### Debug
```
GET  /sessions/:id/replay-data
GET  /debug/session/:sessionId/state?tick=X
```

### Dashboard
```
GET  /dashboard/stats
GET  /dashboard/charts
```
