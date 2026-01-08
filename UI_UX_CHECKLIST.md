# UI/UX Checklist – Grow Fortress: Age of Super Hero

## 🔴 Critical (Day 1)

### Ujednolicenie języka
- [x] Wybrać PL lub EN dla całego UI
- [x] WAVE → Fala
- [x] KILLS → Zabicia
- [x] SCORE → Wynik
- [x] MATERIALS → Materiały
- [x] START SESSION → Rozpocznij
- [x] ARTIFACTS → Artefakty
- [x] IDLE → Zbieranie

### Waluty w top barze
- [x] Usunąć checkboxy przy ZŁOTO/PYŁ (nie znaleziono w kodzie - już OK)
- [x] Zamienić na czyste liczniki (ikona + wartość) - już OK

### Wyloguj
- [x] Przenieść WYLOGUJ do menu pauzy (ESC) - utworzono SettingsMenu
- [x] Usunąć czerwony przycisk z top bara - zamieniono na ⚙️

---

## 🟠 High Priority (Day 1-2)

### Rozróżnienie ULEPSZ vs ULEPSZENIA
- [x] ULEPSZ → "TWIERDZA" (jasne że dotyczy twierdzy)
- [x] ULEPSZENIA → "MOC" (jasne że dotyczy statystyk/perków)
- [x] Jasne rozdzielenie funkcji w UI

### Redukcja cyanu
- [x] Cyan tylko dla: Start, aktywny element, primary CTA
- [x] Dodano secondary color (#5a8a9a) dla pozostałych
- [x] Panele: prawy panel ma neutralną ramkę

### Rozdzielenie META UI i RUN UI
- [x] **META UI (poza walką):**
  - [x] Loadout (klasa/bohater/wieżyczka)
  - [x] Bohaterowie
  - [x] Artefakty
  - [x] Materiały
  - [x] Przyciski: Start Run, Boss Rush
- [x] **RUN UI (w trakcie walki):**
  - [x] Minimalny HUD: fala, HP bazy, zasoby runu
  - [x] Przyciski budowy/ulepszeń wież
  - [x] Bez zakładek meta (Materials/Artifacts/Idle)

---

## 🟡 Medium Priority (Day 2-3)

### Sloty budowy ("+ Dodaj")
- [x] Zamienić tekst na ikonę + z tooltipem
- [x] Pokazywać tylko w trybie budowy (poprzez opacity)
- [x] Usunąć wygląd "debug placeholder" - teraz neutral border, mniej widoczne
- [ ] Rozważyć: gniazda w świecie gry (platformy/hardpointy)

### Hierarchia wizualna (3 poziomy)
- [x] **Primary** (1-2 elementy/ekran): Start, aktywna akcja - cyan
- [x] **Secondary**: panele funkcyjne, przyciski akcji - muted teal
- [x] **Tertiary**: info pasywne (score, fala, liczniki) - neutral border

### Zróżnicowanie komponentów
- [x] **Przyciski**: secondary ma mniejszy font, muted hover
- [x] **Panele**: prawy panel ma neutralną ramkę zamiast primary
- [x] **Liczniki/info**: bez ramki lub minimalna, typografia

### Typografia
- [x] ALL CAPS tylko dla nagłówków i głównych CTA
- [x] Normal case dla reszty tekstu
- [x] Zwiększyć minimalny rozmiar tekstu w HUD (min 11-13px)
- [x] Zmniejszyć letter-spacing w mniejszych labelach (0.5px)

---

## 🟢 Lower Priority (Day 3+)

### Layout i siatka
- [x] Ustalić spójne marginesy (24px od krawędzi, 12px między elementami) - dodano zmienne CSS
- [x] Zgrupować elementy:
  - [x] Lewy górny: fala + HP bazy
  - [x] Prawy górny: zasoby + pauza/ustawienia
  - [x] Prawy boczny: wynik (tylko w trybie arcade)

### Oznaczenia na planszy
- [x] Wyraźne oznaczenie Spawn (skąd wchodzą wrogowie) - gradient + label
- [x] Wyraźne oznaczenie Cel (co bronią gracze) - target zone gradient
- [x] Kierunek fali / postęp fali - strzałki kierunkowe
- [x] Lepsze oznaczenie "lane" (subtelne paski zamiast żółto-czarnych linii)

### Nazewnictwo zakładek
- [x] Wybrać jedną konwencję:
  - [x] Rzeczowniki: Bohaterowie, Wieże, Artefakty, Materiały, MOC
  - [x] Czasowniki dla akcji: Rozpocznij, Ulepsz, Rekrutuj

---

## ⚡ Quick Wins (< 2h)

1. [x] Zmiana języka na spójny PL
2. [x] Usunięcie checkboxów przy walutach (już OK)
3. [x] Przeniesienie WYLOGUJ do menu pauzy
4. [x] Zmiana koloru ULEPSZENIA na inny niż cyan (teraz MOC z neutral border)
5. [x] Usunięcie tekstu "+ Dodaj" ze slotów budowy (teraz tylko "+")

---

## 📋 Notatki implementacyjne

### Kolory do ustalenia
| Element | Obecny | Docelowy |
|---------|--------|----------|
| Primary CTA | Cyan | Cyan (bez zmian) |
| Secondary buttons | Cyan | Ciemniejszy niebieski / szary |
| Panele | Cyan border + glow | Matowe tło, cienka ramka |
| Destrukcyjne akcje | Czerwony | Tylko w menu, nie w HUD |
| Waluty | Checkbox + tekst | Ikona + liczba |

### Stany UI do rozdzielenia
- **Ekran główny/META**: wybór loadoutu, start gry
- **RUN aktywny**: walka, budowa, ulepszenia w runie
- **Pauza**: ustawienia, wyloguj, wyjście
- **Sklep w runie**: zakup/ulepszenie wież
- **Podsumowanie runu**: wynik, zdobyte materiały

---

*Ostatnia aktualizacja: 2026-01-08 - Zaimplementowano wszystkie nieukończone punkty*
