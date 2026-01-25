# Web Client Architecture

## Overview

The web client is built with:
- **Framework**: Preact (React alternative)
- **State Management**: Preact Signals
- **Data Fetching**: TanStack React Query
- **Rendering**: Pixi.js v8 (WebGPU/WebGL)
- **Build Tool**: Vite
- **i18n**: i18next (English, Polish)

---

## Directory Structure

```
apps/web/
├── src/
│   ├── components/
│   │   ├── App.tsx           # Main application entry
│   │   ├── game/             # Game UI components
│   │   ├── modals/           # Modal dialogs (45+)
│   │   ├── shared/           # Reusable UI components
│   │   ├── auth/             # Authentication forms
│   │   ├── guild/            # Guild system components
│   │   ├── pvp/              # PvP arena components
│   │   ├── messages/         # Messaging system
│   │   └── effects/          # Animation effects
│   ├── renderer/             # Pixi.js rendering
│   │   ├── GameApp.ts        # Pixi Application wrapper
│   │   ├── scenes/           # Game/Colony scenes
│   │   ├── animation/        # Tween/Spring animations
│   │   ├── effects/          # Filters, lighting, parallax
│   │   └── ObjectPool.ts     # Performance optimization
│   ├── game/
│   │   └── Game.ts           # Core game simulation
│   ├── state/                # Preact Signals (32 domains)
│   ├── api/                  # API clients (20 modules)
│   ├── hooks/                # React hooks
│   ├── storage/              # IndexedDB, sync
│   ├── utils/                # Utilities
│   └── locales/              # i18n translations
└── vite.config.ts
```

---

## Application Lifecycle

### Loading Stages
1. **splash** - Initial splash screen
2. **checking_session** - Check for existing session
3. **verifying_tokens** - Verify authentication tokens
4. **loading_profile** - Fetch user profile
5. **initializing** - Initialize game systems
6. **ready** - Application ready

> **Przeprojektowanie uruchamiania:** propozycje ulepszeń (splash, canvas-first, rozbicie useGameLoop, useBootSequence) opisane są w [BOOT-REDESIGN-PROPOSAL.md](./BOOT-REDESIGN-PROPOSAL.md).

### Game Phases
| Phase | Description |
|-------|-------------|
| `idle` | Hub screen |
| `shop` | Shop between waves |
| `playing` | Active gameplay |
| `choice` | Wave reward selection |
| `segment_submit` | Segment submission |
| `ended` | Game end screen |
| `boss_rush` | Boss rush mode |

---

## Game Rendering

### Renderer Architecture

| Component | Description |
|-----------|-------------|
| `GameApp.ts` | Pixi.js Application wrapper |
| `GameScene.ts` | Main game rendering scene |
| `ColonyScene.ts` | Idle rewards scene |
| WebGPU detection | 2-second timeout fallback |

### Coordinate System
```
Fixed-Point (Q16.16) ↔ Game Units (0-40 x 0-15) ↔ Screen Pixels
```

- Turret snapping to lanes
- Enemy lane-based Y positioning
- Reverse transformations for click detection

### Rendering Subsystems

| Directory | Purpose |
|-----------|---------|
| `animation/` | Tween.ts, Spring.ts, easing |
| `coordinates/` | FP to screen conversion |
| `effects/` | Filters, lighting, parallax |
| `items/` | Artifact/Crystal renderers |
| `systems/` | Wall system, VFX effects |
| `scenes/` | Game environment, input |

### Performance
- Object pooling for entities
- Particle system (pixi-particle-emitter)
- CRT filter via pixi-filters

---

## UI Components

### Game Components (`components/game/`)
| Component | Description |
|-----------|-------------|
| `Hud.tsx` | Heads-up display |
| `HubOverlay.tsx` | Hub interface |
| `Controls.tsx` | Input handlers |
| `GameContainer.tsx` | Main game wrapper |
| `GameSidePanel.tsx` | Side panel UI |
| `GameBottomPanel.tsx` | Bottom panel UI |
| `BossHealthBar.tsx` | Boss HP display |
| `BossRushHUD.tsx` | Boss rush UI |
| `EnergyBar.tsx` | Energy display |
| `ResourceDisplay.tsx` | Gold/dust/XP |
| `HeroPanel.tsx` | Hero info |
| `TurretPanel.tsx` | Turret info |
| `WaveProgress.tsx` | Wave indicator |
| `PillarDisplay.tsx` | Current pillar |
| `SynergyPanel.tsx` | Class synergies |

### Modals (45+)

**Eagerly Loaded (Critical):**
- `ChoiceModal.tsx` - Wave choices
- `EndScreen.tsx` - Session end
- `ClassSelectionModal.tsx` - Class selection
- `UpgradeModal.tsx` - Hero/turret upgrades
- `TurretPlacementModal.tsx` - Turret placement
- `ConfirmModal.tsx` - Confirmations

**Lazy Loaded (20-30% bundle reduction):**
- `HeroDetailsModal.tsx`
- `MaterialsInventory.tsx`
- `ArtifactsModal.tsx` / `CraftingModal.tsx`
- `HeroRecruitmentModal.tsx`
- `BossRushSetupModal.tsx`
- `BuildPresetsModal.tsx`
- `AchievementsModal.tsx`
- `LeaderboardModal.tsx`
- `StatisticsDashboardModal.tsx`
- `ShopModal.tsx`
- `GachaBannerModal.tsx`
- `MasteryTreeModal.tsx`
- `IdleRewardsModal.tsx`
- `SettingsMenu.tsx`
- `GuestRegistrationModal.tsx`
- `OnboardingModal.tsx`
- `SessionRecoveryModal.tsx`

### Shared Components (`components/shared/`)
| Component | Description |
|-----------|-------------|
| `Button.tsx` | Ripple effects |
| `Modal.tsx` | Base modal wrapper |
| `GlassPanel.tsx` | Frosted glass effect |
| `Tooltip.tsx` | Tooltips |
| `ProgressBar.tsx` | Progress bars |
| `Spinner.tsx` | Loading spinner |
| `Skeleton.tsx` | Loading skeleton |
| `ErrorBoundary.tsx` | Error handling |
| `LoadingScreen.tsx` | Loading UI |
| `ScreenReaderAnnouncer.tsx` | Accessibility |

### Feature Components
| Directory | Purpose |
|-----------|---------|
| `auth/` | Login, Register, ForgotPassword forms |
| `guild/` | 15+ guild components |
| `pvp/` | PvP panel, replay viewer |
| `messages/` | Messaging modal with threads |
| `toasts/` | Toast notifications |

---

## API Client

### Base Layer (`api/base.ts`)
- `ApiError` class with status, message, code
- `request<T>()` - authenticated HTTP requests
- Automatic token refresh on 401
- Singleton pattern for refresh

### API Modules (20)
| Module | Description |
|--------|-------------|
| `auth.ts` | Token management |
| `client.ts` | Auth, profile, leaderboard |
| `battlepass.ts` | Battle pass |
| `boss-rush.ts` | Boss rush sessions |
| `achievements.ts` | Achievements system |
| `energy.ts` | Energy management |
| `gacha.ts` | Gacha system |
| `guild.ts` | Guild operations |
| `guildPreview.ts` | Guild previews |
| `hubPreview.ts` | Hub previews |
| `leaderboard.ts` | Rankings |
| `mastery.ts` | Mastery tree |
| `messages.ts` | Messaging |
| `pillarUnlocks.ts` | Pillar unlocks |
| `pvp.ts` | PvP battles |
| `shop.ts` | Shop purchases |
| `slots.ts` | Slot unlocking |
| `supportTickets.ts` | Support system |
| `websocket.ts` | WebSocket connections |

---

## State Management

### Signal Domains (32)
| Signal File | Purpose |
|-------------|---------|
| `profile.signals.ts` | Player progression, loadout |
| `auth.signals.ts` | Authentication state |
| `game.signals.ts` | Game phase, wave, level |
| `ui.signals.ts` | Modals, toasts |
| `fortress.signals.ts` | Class, heroes, turrets |
| `materials.signals.ts` | Inventory, drops |
| `artifacts.signals.ts` | Artifacts, items |
| `idle.signals.ts` | Idle rewards, colony |
| `power.signals.ts` | Power levels, stats |
| `energy.signals.ts` | Energy system |
| `boss-rush.signals.ts` | Boss rush sessions |
| `pvp.signals.ts` | Arena battles |
| `guild.signals.ts` | Guild operations |
| `messages.signals.ts` | Messages, WebSocket |
| `leaderboard.signals.ts` | Leaderboard data |
| `battlepass.signals.ts` | Battle pass progress |
| `mastery.signals.ts` | Mastery tree |
| `achievements.signals.ts` | Achievements system |
| `pillar-challenge.signals.ts` | Pillar challenges |
| `pillarUnlocks.signals.ts` | Pillar unlocks |
| `shop.signals.ts` | Shop inventory |
| `settings.signals.ts` | Audio, graphics |
| `guest.signals.ts` | Guest mode |
| `tutorial.signals.ts` | Tutorial progress |
| `command.signals.ts` | Manual hero control |
| `gameActions.signals.ts` | Turret targeting, walls |
| `arenaBattle.signals.ts` | PvP visualization |
| `actions.ts` | Complex state mutations |

### State Categories
1. **Profile** - Gold, dust, XP, level, loadout
2. **Game** - Wave, level, phase, fortress HP, score
3. **Fortress** - Class, heroes, turrets, synergies
4. **UI** - Modal visibility, toasts, notifications
5. **Progress** - Materials, artifacts, power upgrades
6. **Social** - PvP, guild, leaderboard, messages
7. **Settings** - Audio, graphics, preferences

---

## Custom Hooks

| Hook | Purpose |
|------|---------|
| `useGameLoop.ts` | Game lifecycle management |
| `useCoordinates.ts` | Coordinate system utilities |
| `useFocusTrap.ts` | Modal accessibility |
| `useStaggeredEntrance.ts` | Animation effects |

---

## Storage Layer

### IndexedDB (`storage/idb.ts`)
| Store | Purpose |
|-------|---------|
| `pendingFinishes` | Game session finish retries |
| `telemetryQueue` | Analytics events queue |
| `localSettings` | Client-side preferences |

### Sync Manager (`storage/sync.ts`)
- Online/offline detection
- Auto-sync every 30 seconds
- Telemetry batch sending

---

## Internationalization

- Framework: i18next + react-i18next
- Languages: English (en), Polish (pl)
- Locales in `src/locales/`
- Browser preference detection

---

## Build Configuration

### Vite Config
```typescript
build: {
  target: 'es2020',
  rollupOptions: {
    output: {
      manualChunks: {
        'locale-en': [...],
        'locale-pl': [...],
        'i18n': ['i18next', 'react-i18next'],
        'pixi': ['pixi.js', 'pixi-filters'],
        'preact': ['preact', '@preact/signals'],
        'fonts': ['@fontsource/...'],
        'vendor': ['...'],
      }
    }
  }
}
```

### Environment Variables
| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API endpoint |
| `VITE_WS_URL` | WebSocket endpoint |
| `VITE_CDN_URL` | CDN base URL for assets |

### Development
- Port: 5173
- HMR with 30s timeout
- Proxy: `/api` → localhost:3000

---

## Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| preact | 10.28.1 | React alternative |
| @preact/signals | 2.5.1 | Reactive state |
| pixi.js | 8.14.3 | WebGL/WebGPU rendering |
| pixi-filters | 6.1.5 | Post-processing |
| @pixi/particle-emitter | 5.0.8 | Particles |
| @tanstack/react-query | 5.90.16 | Server state |
| idb | 8.0.0 | IndexedDB wrapper |
| i18next | 25.7.4 | i18n |

---

## Data Flow

### Authentication Flow
```
AuthScreen → login/register
→ setAuthData (token + userId)
→ App.tsx fetches profile
→ Profile hydrates signals
→ GameContainer initializes
```

### Game Session Flow
```
GameContainer.useGameLoop()
→ Game instance (sim-core)
→ Checkpoint every 300 ticks (10s)
→ submitSegment() API calls
→ Update signals from response
→ Render via Pixi.js
```

### State Update Pattern
```
API Response
→ Update signals
→ Signal subscribers notify
→ Preact re-renders
→ UI updates
```

### WebSocket Pattern
```
App.tsx initializes
→ initMessagesWebSocket()
→ Messages via WebSocket
→ Update signals
→ Toast/modal notifications
```

---

## Performance Patterns

1. **Object Pooling** - Entity reuse in renderer
2. **Lazy Loading** - Modals loaded on demand
3. **Code Splitting** - Separate chunks for i18n, pixi, vendor
4. **Signal Batching** - Computed signals for derived state
5. **Token Refresh Singleton** - Prevent duplicate refresh calls

---

## Accessibility

- `ScreenReaderAnnouncer` for live regions
- Skip links for keyboard navigation
- Focus trap for modals
- ARIA labels throughout UI
- `MinimumScreenSize` guard for mobile

---

## Error Boundary Strategy

### Placement Architecture

```
App.tsx
└── ErrorBoundary (top-level)
    └── Authenticated App Content
        ├── GameContainer
        ├── Modals (45+)
        └── UI Components
```

**Single Top-Level Boundary** (`components/shared/ErrorBoundary.tsx`):
- Wraps entire authenticated app in `App.tsx` (line 496)
- Catches all unhandled component errors
- Prevents white screen crashes

### Error UI Features

| Feature | Description |
|---------|-------------|
| Error Details | Expandable `<details>` with stack trace |
| Try Again | Resets error state, re-renders children |
| Reload Page | Full page refresh for unrecoverable errors |
| Custom Fallback | Optional `fallback` prop for specialized UIs |

### Implementation

```typescript
class ErrorBoundary extends Component<Props, State> {
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };
}
```

### Design Decisions

- **No nested boundaries**: Game state is interconnected; partial recovery risks inconsistency
- **Full reload preferred**: WebGL context + game simulation state too complex for partial recovery
- **Logging only**: No external error tracking (Sentry) integrated

---

## Testing Strategy

### Current Coverage

| Type | Framework | Location | Coverage |
|------|-----------|----------|----------|
| E2E | Playwright | `e2e/app.spec.ts` | 11 test cases |
| Unit | - | - | Not implemented |
| Integration | - | - | Not implemented |

### E2E Test Cases

```typescript
// e2e/app.spec.ts
test('should load the app')
test('should have correct title')
test('should show auth or game UI')
test('should handle keyboard navigation')
test('should render canvas for authenticated users')
test('should be responsive (mobile/desktop)')
test('should handle network errors gracefully')
test('should track page errors')
```

### Running Tests

```bash
# Run E2E tests headless
pnpm test:e2e

# Run with Playwright UI
pnpm test:e2e:ui
```

### Network Error Testing

```typescript
test('should handle network errors gracefully', async ({ page }) => {
  await page.route('**/api/**', (route) => route.abort());
  await page.goto('/');
  const html = page.locator('html');
  await expect(html).toBeAttached();
});
```

### What's Not Tested

- Unit tests for utility functions
- Component unit tests (no Jest/Vitest setup)
- API client mocking
- Signal state management
- Game simulation logic (tested via sim-core package)

---

## Monitoring & Observability

### Performance Monitor (`renderer/PerformanceMonitor.ts`)

**Tracked Metrics:**

| Metric | Description |
|--------|-------------|
| `fps` | Current frames per second |
| `fpsAverage` | 60-frame rolling average |
| `frameTime` | Current frame duration (ms) |
| `memoryUsed` | JS heap size (if available) |
| `drawCalls` | Pixi.js draw call count |
| `qualityLevel` | Current auto-quality setting |
| `isThrottling` | FPS below critical threshold |

### Auto-Quality Adjustment

```
Quality Levels: ultra → high → medium → low → potato

Downgrade Trigger: FPS < 30 for 60 consecutive frames
Upgrade Trigger: FPS > 50 for 120 consecutive frames
```

| Level | Particles | Shadows | Post-FX | Resolution |
|-------|-----------|---------|---------|------------|
| ultra | 100% | Yes | All | 1.0 |
| high | 75% | Yes | Most | 1.0 |
| medium | 50% | Yes | Some | 0.9 |
| low | 25% | No | None | 0.75 |
| potato | 10% | No | None | 0.5 |

### Event System

```typescript
performanceMonitor.on('fps-drop', ({ fps, threshold }) => { ... });
performanceMonitor.on('fps-recovery', ({ fps }) => { ... });
performanceMonitor.on('quality-change', ({ from, to }) => { ... });
performanceMonitor.on('memory-warning', ({ used, limit }) => { ... });
performanceMonitor.on('throttle-start', () => { ... });
performanceMonitor.on('throttle-end', () => { ... });
```

### Analytics Integration

- **Vercel Analytics**: User behavior tracking in `App.tsx`
- **Session Analytics**: Wave/combat stats via sim-core library
- **No Sentry**: External error tracking not integrated

---

## Memory Management (Pixi.js)

### Object Pooling System

**Generic Pool** (`renderer/ObjectPool.ts`):

```typescript
class ObjectPool<T> {
  acquire(): T           // Get object or create new
  release(obj: T): void  // Return to pool
  prewarm(count: number) // Pre-allocate objects
  clear(destroy?)        // Cleanup with optional destructor
  getStats()             // { pooled, active, maxSize }
}
```

**Performance Impact**: 15-25% faster frame times during high enemy waves

### Specialized Pools

| Pool | Max Size | Purpose |
|------|----------|---------|
| `GraphicsPool` | 200 | Reusable Graphics objects |
| `ContainerPool` | 200 | Reusable Containers |
| `EnemyVisualPool` | 200 | Complex enemy bundles |
| `ParticlePool` | 2000 | VFX particles |

### Enemy Visual Bundle Structure

```typescript
{
  container: Container,
  shadow: Graphics,
  body: Graphics,
  details: Graphics,
  hpBar: Graphics,
  statusEffects: Graphics,
  eliteGlow: Graphics | null  // Created only for elites
}
```

### Cleanup Patterns

**Container Destruction:**
```typescript
container.destroy({ children: true });
```

**Graphics Clearing:**
```typescript
graphics.clear();
graphics.visible = false;  // Before pooling
pool.release(graphics);
```

**Event Listener Removal:**
```typescript
sprite.off('pointerdown', handler);
sprite.removeAllListeners();
```

**Particle Pool Reset:**
```typescript
// particlePool.ts - resets all properties on release
particle.x = 0;
particle.y = 0;
particle.vx = 0;
particle.vy = 0;
particle.alpha = 1;
particle.scale = 1;
// ... clears all references
```

### Memory Leak Prevention Checklist

1. Always call `destroy()` on removed containers
2. Clear graphics before pooling with `clear()`
3. Remove event listeners before destruction
4. Set `visible = false` before pooling (prevents render)
5. Use pool's `clear(destroyFn)` on scene teardown
6. Don't hold references to pooled objects

---

## Hot Module Replacement (HMR)

### Strategy: Full Invalidation

**Files with HMR Handling:**
- `hooks/useGameLoop.ts` (lines 8-12)
- `renderer/GameApp.ts` (lines 109-114)

```typescript
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    import.meta.hot?.invalidate();
  });
}
```

### Why Full Reload?

| Challenge | Reason |
|-----------|--------|
| WebGL Context | Can't hot-swap WebGL state |
| Game Simulation | sim-core state not serializable mid-tick |
| Object Pools | Pool references become stale |
| Signals | Signal graph reconstruction complex |

### Vite Configuration

```typescript
// vite.config.ts
server: {
  hmr: {
    overlay: true,      // Show error overlay
    timeout: 30000,     // 30s reconnection timeout
  }
}
```

### Development Workflow

1. Code change triggers Vite HMR
2. `import.meta.hot.invalidate()` called
3. Full page reload occurs
4. Game state resets to initial
5. Player must restart session

**Note**: Game state is intentionally lost during development to ensure clean slate.

---

## Simulation/Renderer Synchronization

### Fixed Timestep Architecture (`game/loop.ts`)

```typescript
const TICK_MS = 1000 / CONFIG.TICK_RATE;  // ~33.33ms at 30 Hz
const MAX_DELTA_MS = 100;  // Prevents spiral of death
```

### Game Loop Implementation

```typescript
private tick = (currentTime: number): void => {
  const delta = currentTime - this.lastTime;
  const cappedDelta = Math.min(delta, MAX_DELTA_MS);  // Cap slow frames
  this.accumulator += cappedDelta * this.speedMultiplier;

  // Fixed timestep simulation (deterministic)
  while (this.accumulator >= TICK_MS) {
    this.game.step();  // sim-core tick
    this.accumulator -= TICK_MS;
  }

  // Interpolation alpha for smooth rendering
  const alpha = this.accumulator / TICK_MS;
  this.render(alpha);  // Render with interpolation
};
```

### Slow Frame Handling

| Mechanism | Purpose |
|-----------|---------|
| **MAX_DELTA_MS (100ms)** | Prevents spiral of death on very slow frames |
| **Accumulator** | Variable render rate, fixed physics rate |
| **Speed Multiplier** | 1x/2x game speed without affecting physics |
| **Tab Visibility** | Pauses when tab hidden, resumes on focus |

### Interpolation Rendering

```typescript
// alpha = fraction of tick elapsed (0.0 - 1.0)
const renderX = previousX + (currentX - previousX) * alpha;
const renderY = previousY + (currentY - previousY) * alpha;
```

### Hub Rendering Optimization

```typescript
// useGameLoop.ts (lines 494-545)
const HUB_THROTTLE_THRESHOLD = 5;  // After 5 idle frames

// Drops to 10fps (~100ms between frames) when no state changes
if (idleFrameCount > HUB_THROTTLE_THRESHOLD) {
  // Throttle rendering
}
```

### Configuration (`config.ts`)

| Constant | Value | Description |
|----------|-------|-------------|
| `TICK_RATE` | 30 | Fixed simulation Hz |
| `CHECKPOINT_INTERVAL` | 300 ticks | 10 seconds between saves |

---

## WebSocket Reconnection Strategy

### Connection Configuration (`api/websocket.ts`)

```typescript
class WebSocketClient {
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;     // Start: 1 second
  private maxReconnectDelay = 30000; // Max: 30 seconds
  private isConnecting = false;
  private isManualClose = false;
}
```

### Exponential Backoff

```typescript
delay = min(1000 * 2^attemptCount, 30000)

Attempt 1:  1 second
Attempt 2:  2 seconds
Attempt 3:  4 seconds
Attempt 4:  8 seconds
Attempt 5:  16 seconds
Attempt 6+: 30 seconds (capped)
```

### Connection States

| State | Reconnect? | Description |
|-------|------------|-------------|
| OPEN | No | Ready for messaging |
| CONNECTING | No | Awaiting establishment |
| CLOSED (auto) | Yes | Lost connection |
| CLOSED (manual) | No | User-initiated close |
| ERROR | Yes | Connection error |

### Features

| Feature | Implementation |
|---------|----------------|
| **Token Auth** | WebSocket subprotocol: `access.${token}` |
| **Message Queue** | Queues messages sent while disconnected |
| **Health Check** | Ping every 30 seconds |
| **Event System** | `on(type, handler)` returns unsubscribe function |
| **Auto-Cleanup** | Clears ping interval on disconnect |

### Usage Pattern

```typescript
// Subscribe
const unsubscribe = onWebSocketEvent('chat_message', (data) => {
  // Handle message
});

// Later: cleanup
unsubscribe();
```

---

## API Error Handling

### Error Class Hierarchy (`api/base.ts`)

```typescript
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public data?: unknown,
  ) {
    super(message);
  }
}

// Domain-specific errors
export function createDomainError(name: string) {
  return class DomainApiError extends ApiError { ... }
}
```

### Automatic Token Refresh

```typescript
// Singleton pattern prevents concurrent refresh requests
let refreshPromise: Promise<boolean> | null = null;

export async function tryRefreshToken(): Promise<boolean> {
  if (refreshPromise) {
    return refreshPromise;  // Reuse existing promise
  }

  refreshPromise = (async () => {
    // ... perform refresh ...
  })();

  const result = await refreshPromise;
  refreshPromise = null;  // Clear after settling
  return result;
}
```

### Base Request with Auto-Retry

```typescript
export async function request<T>(
  path: string,
  options: RequestOptions = {},
  retry = true,  // Internal flag
): Promise<T> {
  const response = await fetch(url, { ... });

  if (!response.ok) {
    if (response.status === 401 && retry && !skipAuthRefresh) {
      const refreshed = await tryRefreshToken();
      if (refreshed) {
        return request<T>(path, options, false);  // Retry once
      }
    }
    throw new ApiError(response.status, ...);
  }

  return response.json();
}
```

### Error Handling Patterns

**1. Expected 404 (null return):**
```typescript
export async function getActiveSession(): Promise<Session | null> {
  try {
    return await request<Session>("/v1/sessions/active");
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;  // Expected: no active session
    }
    throw error;
  }
}
```

**2. Success/Error Object:**
```typescript
export async function updateEmail(email: string): Promise<Result> {
  try {
    await request("/v1/profile/email", { ... });
    return { success: true };
  } catch (error) {
    if (error instanceof ApiError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Failed to update email" };
  }
}
```

**3. Silent Failure:**
```typescript
export async function getEmail(): Promise<string | null> {
  try {
    const response = await request<{ email: string }>("/v1/profile/email");
    return response.email;
  } catch {
    return null;  // Silently fail
  }
}
```

**4. UI-Level Status Handling (`App.tsx`):**
```typescript
const handleLogin = async (username: string, password: string) => {
  try {
    await login({ username, password });
  } catch (error) {
    if (error instanceof Error && "status" in error) {
      const status = (error as { status: number }).status;
      if (status === 401) {
        authError.value = t("errors.invalidCredentials");
      } else if (status === 403) {
        authError.value = t("errors.accountBanned");
      } else if (status === 429) {
        authError.value = t("errors.tooManyAttempts");
      }
    }
  }
};
```

### Request Options

```typescript
interface RequestOptions extends RequestInit {
  skipAuth?: boolean;         // Don't add Authorization header
  skipAuthRefresh?: boolean;  // Don't retry on 401
}
```
