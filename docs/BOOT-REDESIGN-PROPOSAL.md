# Propozycja przeprojektowania uruchamiania gry (Boot / Game Startup)

**Status:** Propozycja (do dyskusji i wdrożenia etapami)  
**Data:** 2026-01-25

---

## 1. Obecne problemy

| Obszar | Problem |
|--------|---------|
| **App.tsx** | ~530 linii, 14+ `useEffect`/`useState`. Łączy: splash, auth, loading stages, profile sync, WebSocket, session recovery, sync status, handlery logowania. Trudne testy i zmiany. |
| **useGameLoop** | ~620 linii. Miesza: lifecycle Game/GameApp/GameLoop, obsługę inputu (klawiatura, kliknięcia), hub loop, game actions. Jedna zmiana = ryzyko regresji w wielu miejscach. |
| **GameContainer** | Dużo odpowiedzialności: UI scale, auto-resume sesji, force reset, auto-start dla nowych, start/upgrade/end session, modale. |
| **Sekwencja ładowania** | Splash **zawsze** 4 s, nawet gdy auth+profile są gotowe w 1 s. Profil ładuje się **przed** montowaniem canvasa → użytkownik długo widzi "Ładowanie..." zamiast hubu. |
| **Błędna ścieżka** | Brak spójnego modelu dla: błąd ładowania profilu, błąd init renderera, brak energii przy starcie. Różne toasty, bez jasnego "retry" czy stanu błędu. |

---

## 2. Kierunki ulepszeń

### 2.1 Jawny autom stanów bootu (`useBootSequence`)

**Cel:** Jedna, czytelna maszyna stanów dla startu aplikacji.

**Stany:**  
`splash` → `checking_session` → `verifying_tokens` | `loading_profile` | `auth_required` → `initializing` → `ready` | `error`

**Implementacja:**

- Nowy hook `useBootSequence()` zwracający `{ stage, error, retry }`.
- Przejścia opisane w jednym miejscu (np. `switch` / reducer lub mały FSM).
- `App` tylko renderuje wg `stage` (SplashScreen / AuthScreen / LoadingScreen / GameShell / ErrorScreen).

**Korzyści:** Łatwiejsze debugowanie, testy jednostkowe bootu, możliwość dodania nowych etapów (np. "checking_update") bez rozrzucania logiki po wielu `useEffect`.

---

### 2.2 Splash „max(splashMin, criticalPath)”

**Cel:** Nie blokować gotowości na sztywny 4 s.

**Propozycja:**

- `SplashScreen` przyjmuje `minDurationMs` (np. 1500) i `onReady(): Promise<void>`.
- Boot: `await Promise.all([onReady(), delay(minDurationMs)])` → `onComplete`.
- `onReady` = np. równoległe: `refreshTokens` (lub stwierdzenie braku sesji) + ewentualnie minimalne init (i18n już jest w main).

**Efekt:** Przy szybkim auth splash trwa tylko `minDurationMs` zamiast 4 s.

---

### 2.3 Canvas-first: pokazać grę wcześniej

**Cel:** Szybsze wrażenie „gra działa” – canvas + hub możliwie wcześnie.

**Obecny przepływ:**  
splash → auth → profile → **ready** → GameContainer → canvas → GameApp.init → hub loop.

**Propozycja:**

1. Po `checking_session` + stwierdzeniu „mamy auth” przechodzimy do **`loading_profile`**.
2. **Równolegle** montujemy **GameContainer z canvasem** (np. nowy stan `loading_profile_with_canvas`).
3. GameContainer jak dziś: `useGameLoop` → GameApp.init, hub loop. Overlay „Ładowanie profilu…” na wierzchu.
4. Gdy profile + artifacts (i ewent. inne krytyczne dane) są gotowe → `updateFromProfile`, `initializeHubFromLoadout` → **ready**. Zdejmujemy overlay, zostaje hub.

**Uwaga:** Trzeba zapewnić, że hub nie renderuje hero/turretów z loadoutu przed `updateFromProfile` (np. `hubInitialized` jak teraz). To już jest ugrane.

**Korzyści:** Użytkownik wcześniej widzi canvas (nawet pusty lub z placeholderem), a nie sam ekran „Ładowanie…”. Subiektywnie szybszy start.

---

### 2.4 Rozbicie `useGameLoop` na mniejsze moduły

**Cel:** Mniejsze, testowalne kawałki; czytelny podział odpowiedzialności.

| Moduł | Odpowiedzialność |
|-------|------------------|
| **`useGameEngine`** | Ref na canvas + `canvasReady`. Tworzy `Game`, `GameLoop`, `GameApp`. Init renderera, hub loop, start/stop. Zwraca `{ startSession, resumeSession, endSession, … }` (api sesji) + `game`, `loop` w refach. **Bez** obsługi inputu. |
| **`useGameInput`** | Przyjmuje `game`, `loop`, `phase`. Reaguje na `manualControlHeroId`, `gamePhase`. Rejestruje keydown/keyup, blur, contextmenu. Wywołuje `game.setHeroManualControl`, `setManualMoveInput`, `triggerManualAttack*`, itd. Cleanup w unmount. |
| **`useGameCanvasActions`** | Przyjmuje `game`, `renderer`. Ustawia `renderer.setOnHeroClick`, `setOnTurretClick`, `setOnFieldClick`, `setOnFieldRightClick`, `setOnHeroDrag` i w środku wywołuje `game.*` / signals (`upgradeTarget`, `commandTarget`, itd.). Ewent. `setTurretTargetingFn`, `placeWallFn`, … |

**GameContainer:** używa `useGameEngine` + `useGameInput` + `useGameCanvasActions`. Dalej trzyma logikę „kiedy start/resume”, upgrade, modale.

**Korzyści:** Testy `useGameEngine` z mock canvas; testy inputu z mock `game`; mniejsze zmiany przy dodawaniu nowych akcji (np. nowy shortcut).

---

### 2.5 Wydzielenie logiki auth z App

**Cel:** App nie musi znać szczegółów logowania/rejestracji/gościa.

**Propozycja:**

- **`useAuth()`**: wewnętrznie `checkAuth`, `refreshTokensApi`, `createGuestSession`, `onAuthInvalidated`. Zwraca `{ isAuthenticated, login, register, guestLogin, logout, loading, error }`.
- **`useProfileSync()`**: włączone gdy `isAuthenticated`. React Query: profile, leaderboard, power, artifacts. Sync do signals (`updateFromProfile`, `updateLeaderboard`, …). Zwraca `{ profile, isReady, refetch }`.
- Boot sequence korzysta z `useAuth` + `useProfileSync` i ustawia `stage` w zależności od `isAuthenticated` / `isReady` / błędów.

**App:** głównie `useBootSequence` + `useAuth` + `useProfileSync` i renderowanie ekranów. Handlery logowania delegation do `useAuth`.

---

### 2.6 Spójna obsługa błędów bootu i gry

**Propozycja:**

- **Boot:** stan `error` w `useBootSequence` z `{ code, message, retry? }`. Np. `profile_fetch_failed`, `auth_invalidated`. Ekran błędu z przyciskiem „Spróbuj ponownie” wywołującym `retry`.
- **Renderer init:** Jeśli `GameApp.init()` się wywali, nie tylko log + fallback hub: ustawić np. `rendererInitError` w state. GameContainer pokazuje overlay „Błąd renderera” + „Odśwież stronę” zamiast cichego degrade.
- **Start sesji:** np. `INSUFFICIENT_ENERGY` już obsługiwane; reszta w jednym miejscu (np. `handleStartSession`) z mapowaniem kodu na komunikat i ewent. akcję (np. „Doładuj energię” → link do shopu).

---

## 3. Proponowana kolejność wdrożenia

| Krok | Zmiana | Wysiłek | Ryzyko |
|------|--------|---------|--------|
| 1 | Splash „max(minDuration, criticalPath)” | Niski | Niskie |
| 2 | `useBootSequence` + przeniesienie logiki stanów z App | Średni | Średnie |
| 3 | `useAuth` + `useProfileSync`, App korzysta z nich | Średni | Niskie |
| 4 | Canvas-first: montowanie GameContainer w trakcie `loading_profile` | Średni | Średnie |
| 5 | Rozbicie `useGameLoop` → `useGameEngine` + `useGameInput` + `useGameCanvasActions` | Wysoki | Średnie |
| 6 | Spójne stany błędów (boot + renderer + start sesji) | Średni | Niskie |

Sugerowane podejście: **1 → 2 → 3** jako pierwsza fala (szybszy, czytelniejszy boot), potem **4** (percepcja), na koniec **5–6** (architektura silnika i błędów).

---

## 4. Zależności i uwagi

- **React Query:** `useProfileSync` powinien korzystać z tego samego `QueryClient` co dziś (provider w App).
- **Signals:** Sync profilu → signals pozostaje w `useProfileSync` albo w dedicated `syncProfileToSignals(profile)` wywoływanym z boot sequence. Nie duplikować.
- **WebSocket (messaging):** Init po `profile` jest OK; można zostawić w App lub przenieść do `useProfileSync` / boot sequence jako krok „post-profile”.
- **Session recovery:** Nadal po stwierdzeniu auth; `getActiveSession` → `showSessionRecoveryModal`. Może żyć w `useBootSequence` albo w `useProfileSync` („po profile, przed ready”).
- **GameContainer:** Przy canvas-first nadal unmount przy `!ready` może być kłopotliwy (niszczenie WebGL context). Alternatywa: GameContainer zawsze montowany po „auth OK”, a overlay ładowania nad canvasem do „profile ready”. Wtedy canvas nie jest tworzony n razy.

---

## 5. Podsumowanie

- **Boot:** Jawna maszyna stanów (`useBootSequence`), splash zależny od critical path, auth/profile w hookach.
- **Gra:** Canvas wcześniej ( równolegle z profile), mniejsze hooki (engine / input / canvas actions), spójna obsługa błędów.

To pozwala utrzymać obecne API (startSession, resumeSession, profile, signals) i ulepszyć czytelność, testowalność i odczucie szybkości startu bez wielkiej rewolucji.
