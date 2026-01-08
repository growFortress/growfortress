# @arcade/admin

Panel administracyjny dla gry **Grow Fortress: Age of Super Hero**. Aplikacja pozwala na zarządzanie graczami, ich statystykami oraz monitorowanie stanu gry.

## 🚀 Technologie

- **Framework**: [Preact](https://preactjs.com/) (lekka alternatywa dla React)
- **Bundler**: [Vite](https://vitejs.dev/)
- **State Management**: [@preact/signals](https://preactjs.com/guide/v10/signals/)
- **Routing**: `preact-router`
- **Język**: TypeScript

## 🛠️ Instalacja i uruchomienie

Aplikacja jest częścią monorepo. Najlepiej uruchamiać ją z głównego katalogu projektu.

### Wymagania

- Node.js
- pnpm

### Komendy

```bash
# Instalacja zależności (w głównym katalogu)
pnpm install

# Uruchomienie w trybie deweloperskim
pnpm dev --filter @arcade/admin
# lub bezpośrednio w tym katalogu:
pnpm dev

# Budowa wersji produkcyjnej
pnpm build
```

Domyslnie aplikacja działa pod adresem: `http://localhost:5174`

## 📋 Główne Funkcje

1.  **Dashboard (Real-time)**:
    - Monitorowanie błędów systemowych w czasie rzeczywistym.
    - Wykresy CCU (Concurrent Users) i aktywnych sesji.
    - Snapshoty metryk wydajnościowych.
2.  **Lista Graczy & Detale**:
    - Przeglądanie zarejestrowanych użytkowników.
    - Zarządzanie statusem (Banowanie / Odblokowywanie).
    - Resetowanie postępu i nadawanie surowców (Złoto, Gwiezdny Pył).
3.  **Wydarzenia (Event Manager)**:
    - Planowanie i aktywacja ograniczonych czasowo bonusów (np. 2x XP).
    - Zarządzanie listą aktywnych i przyszłych eventów.
4.  **Nagrody Zbiorcze (Bulk Rewards)**:
    - Wysyłanie nagród do wszystkich lub wybranych grup graczy jednocześnie.
5.  **Logi Audytowe**:
    - Pełna historia akcji wykonanych przez administratorów dla celów bezpieczeństwa.
6.  **Konfiguracja Systemowa**:
    - Zarządzanie globalnymi parametrami gry bez konieczności restartu serwera.
7.  **System Powtórek**:
    - Przeglądanie i analiza przebiegu sesji graczy (Replay System).
8.  **Autoryzacja**:
    - Logowanie zabezpieczone tokenem JWT z weryfikacją ról po stronie serwera.

## 📂 Struktura Projektu

- `src/api/` - Klient HTTP i definicje typów dla API administratora.
- `src/components/` - Współdzielone komponenty UI.
- `src/hooks/` - Niestandardowe hooki (np. `useAuth`).
- `src/layouts/` - Układy stron (np. `DashboardLayout`).
- `src/pages/` - Widoki aplikacji (Login, Dashboard, Players).

## 🔌 Konfiguracja API

Aplikacja domyślnie komunikuje się z API pod adresem `http://localhost:3000`. Można to zmienić ustawiając zmienną środowiskową `VITE_API_URL` w pliku `.env`.

```env
VITE_API_URL=https://twoje-api.com
```

Wszystkie zapytania do `/admin/*` wymagają nagłówka `Authorization: Bearer <token>`, który jest automatycznie dodawany przez `fetchWithAuth`.
