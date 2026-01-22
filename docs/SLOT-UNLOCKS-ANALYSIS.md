# Analiza Systemu Odblokowywania Slotów

## Przegląd

System odblokowywania slotów bohaterów i wieżyczek został zmigrowany z automatycznego systemu opartego na poziomach na system **zakupu za złoto** z wymaganiami poziomowymi. To daje graczom większą kontrolę nad progresją i pozwala na lepsze zarządzanie zasobami.

**Ostatnia aktualizacja:** Zwiększono maksymalną liczbę slotów do 8, obniżono wymagania dla slotów 3-4 (slot 3 bohatera dostępny po pierwszej sesji), usunięto redundantne nagrody poziomowe i poprawiono wizualizację w UI.

---

## Architektura Systemu

### Źródło Prawdy

Konfiguracja slotów znajduje się w:
- **`packages/sim-core/src/data/fortress-progression.ts`** - definicje konfiguracji
- **`apps/server/src/services/slots.ts`** - logika zakupu
- **`packages/protocol/src/slots.ts`** - schematy API

### Model Danych

W bazie danych (`Progression` tabela):
```prisma
purchasedHeroSlots   Int @default(2)  // Start z 2 darmowymi slotami
purchasedTurretSlots Int @default(1) // Start z 1 darmowym slotem
```

---

## Sloty Bohaterów

### Konfiguracja

```typescript
HERO_SLOT_UNLOCKS: SlotUnlockConfig[] = [
  { slot: 1, levelRequired: 1, goldCost: 0, isFree: true },   // Darmowy
  { slot: 2, levelRequired: 1, goldCost: 0, isFree: true },   // Darmowy
  { slot: 3, levelRequired: 2, goldCost: 500, isFree: false },   // Dostępny po pierwszej sesji
  { slot: 4, levelRequired: 5, goldCost: 1000, isFree: false },  // Szybko dostępny
  { slot: 5, levelRequired: 8, goldCost: 2000, isFree: false },  // Wczesna mid-game
  { slot: 6, levelRequired: 12, goldCost: 4000, isFree: false }, // Mid-game
  { slot: 7, levelRequired: 18, goldCost: 7000, isFree: false }, // Późna mid-game
  { slot: 8, levelRequired: 25, goldCost: 12000, isFree: false }, // Pełny skład
]
```

### Tabela Odblokowań

| Slot | Poziom Wymagany | Koszt Złota | Status | Uwagi |
|------|----------------|-------------|--------|-------|
| 1 | 1 | 0 | Darmowy | Start gry |
| 2 | 1 | 0 | Darmowy | Start gry |
| 3 | 2 | 500 | Płatny | **Dostępny po pierwszej sesji** |
| 4 | 5 | 1,000 | Płatny | Szybko dostępny |
| 5 | 8 | 2,000 | Płatny | Wczesna mid-game |
| 6 | 12 | 4,000 | Płatny | Mid-game |
| 7 | 18 | 7,000 | Płatny | Późna mid-game |
| 8 | 25 | 12,000 | Płatny | Pełny skład |

**Maksymalna liczba slotów:** 8

### Analiza Kosztów

- **Łączny koszt wszystkich slotów:** 26,500 złota
- **Progresja kosztów:** Płynna liniowa (500 → 1k → 2k → 4k → 7k → 12k)
- **Średni koszt na slot (płatne):** 4,417 złota
- **Wszystkie sloty dostępne do poziomu 25**

### Nagrody Poziomowe

**Uwaga:** Redundantne nagrody slotów zostały usunięte z nagród poziomowych. Sloty są teraz dostępne wyłącznie przez zakup za złoto, co daje graczom pełną kontrolę nad progresją.

---

## Sloty Wieżyczek

### Konfiguracja

```typescript
TURRET_SLOT_UNLOCKS: SlotUnlockConfig[] = [
  { slot: 1, levelRequired: 1, goldCost: 0, isFree: true },    // Darmowy
  { slot: 2, levelRequired: 3, goldCost: 500, isFree: false },   // Wczesna gra
  { slot: 3, levelRequired: 5, goldCost: 1000, isFree: false },  // Szybko dostępny
  { slot: 4, levelRequired: 8, goldCost: 2000, isFree: false },  // Wczesna mid-game
  { slot: 5, levelRequired: 12, goldCost: 4000, isFree: false }, // Mid-game
  { slot: 6, levelRequired: 18, goldCost: 7000, isFree: false }, // Pełny skład
]
```

### Tabela Odblokowań

| Slot | Poziom Wymagany | Koszt Złota | Status | Uwagi |
|------|----------------|-------------|--------|-------|
| 1 | 1 | 0 | Darmowy | Start gry |
| 2 | 3 | 500 | Płatny | Wczesna gra |
| 3 | 5 | 1,000 | Płatny | Szybko dostępny |
| 4 | 8 | 2,000 | Płatny | Wczesna mid-game |
| 5 | 12 | 4,000 | Płatny | Mid-game |
| 6 | 18 | 7,000 | Płatny | Pełny skład |

**Maksymalna liczba slotów:** 6

### Analiza Kosztów

- **Łączny koszt wszystkich slotów:** 14,500 złota
- **Progresja kosztów:** Płynna liniowa (500 → 1k → 2k → 4k → 7k)
- **Średni koszt na slot (płatne):** 2,900 złota
- **Wszystkie sloty dostępne do poziomu 18**

### Nagrody Poziomowe

**Uwaga:** Redundantne nagrody slotów zostały usunięte z nagród poziomowych. Sloty są teraz dostępne wyłącznie przez zakup za złoto.

---

## Mechanika Zakupu

### Proces Zakupu

1. **Sprawdzenie maksimum:** Czy gracz ma już maksymalną liczbę slotów?
2. **Pobranie konfiguracji:** Pobierz następny slot z tablicy `HERO_SLOT_UNLOCKS` lub `TURRET_SLOT_UNLOCKS`
3. **Walidacja darmowego slotu:** Jeśli slot jest darmowy (`isFree: true`), zwróć błąd
4. **Walidacja poziomu:** Czy gracz osiągnął wymagany poziom?
5. **Walidacja złota:** Czy gracz ma wystarczająco złota?
6. **Transakcja:** 
   - Zwiększ `purchasedHeroSlots` lub `purchasedTurretSlots` o 1
   - Odejmij koszt od `inventory.gold`
   - Zwiększ `version` o 1 (dla synchronizacji)

### Funkcje Pomocnicze

#### `getNextHeroSlotInfo(currentPurchased, commanderLevel, currentGold)`
Zwraca informacje o następnym slocie do kupienia, nawet jeśli gracz nie spełnia wymagań (dla podglądu w UI).

**Zwraca:**
- `slot: SlotUnlockConfig` - konfiguracja slotu
- `canPurchase: boolean` - czy można kupić
- `reason?: string` - powód, jeśli nie można kupić (`level_too_low`, `insufficient_gold`, `already_free`)

#### `getNextTurretSlotInfo(currentPurchased, commanderLevel, currentGold)`
Analogiczna funkcja dla wieżyczek.

---

## Porównanie z Poprzednim Systemem

### Stary System (Legacy)

**Sloty Bohaterów:**
- Poziom 1: 1 slot
- Poziom 10: 2 sloty
- Poziom 30: 3 sloty
- Poziom 45: 4 sloty (max)

**Sloty Wieżyczek:**
- Poziom 1: 1 slot
- Poziom 5: 2 sloty
- Poziom 15: 3 sloty
- Poziom 25: 4 sloty
- Poziom 35: 5 slotów
- Poziom 40: 6 slotów

### Nowy System

**Zalety:**
- ✅ Większa kontrola gracza nad progresją
- ✅ Możliwość wcześniejszego odblokowania (jeśli ma złoto)
- ✅ Lepsze zarządzanie zasobami
- ✅ Start z 2 slotami bohaterów (zamiast 1)

**Wady:**
- ⚠️ Wymaga zarządzania złotem
- ⚠️ Może być mylące dla nowych graczy (zakup vs. automatyczne odblokowanie)

### Migracja

Stary system został zmigrowany w migracji `20260114_add_purchasable_slots`:
- Istniejący gracze otrzymali sloty na podstawie ich poziomu
- Nowi gracze zaczynają z 2 slotami bohaterów i 1 slotem wieżyczek

---

## Funkcje Obliczania Slotów

### `getMaxHeroSlots(fortressLevel, purchasedSlots?)`

```typescript
// Nowy system: użyj zakupionych slotów
if (purchasedSlots !== undefined) {
  return Math.min(purchasedSlots, MAX_HERO_SLOTS);
}
// Legacy fallback (dla starych zapisów bez purchasedSlots)
if (fortressLevel >= 45) return 4;
if (fortressLevel >= 30) return 3;
if (fortressLevel >= 10) return 2;
return 2; // Zmienione z 1 na 2 - nowi gracze zaczynają z 2 slotami
```

### `getMaxTurretSlots(fortressLevel, purchasedSlots?)`

```typescript
// Nowy system: użyj zakupionych slotów
if (purchasedSlots !== undefined) {
  return Math.min(purchasedSlots, MAX_TURRET_SLOTS);
}
// Legacy fallback
if (fortressLevel >= 40) return 6;
if (fortressLevel >= 35) return 5;
if (fortressLevel >= 25) return 4;
if (fortressLevel >= 15) return 3;
if (fortressLevel >= 5) return 2;
return 1; // Base: 1 slot
```

**Uwaga:** Funkcje mają fallback do starego systemu dla kompatybilności wstecznej.

---

## API Endpoints

### `POST /v1/slots/hero`
Kupuje następny dostępny slot bohatera.

**Request:** `{}` (pusty body)

**Response:**
```typescript
{
  success: boolean;
  newSlotCount?: number;  // Nowa liczba slotów
  goldSpent?: number;     // Wydane złoto
  newGold?: number;      // Nowa ilość złota
  error?: string;        // Komunikat błędu
}
```

### `POST /v1/slots/turret`
Kupuje następny dostępny slot wieżyczki.

**Request/Response:** Analogiczne do slotów bohaterów.

### `GET /v1/slots/status`
Pobiera status slotów gracza.

**Response:**
```typescript
{
  currentHeroSlots: number;
  currentTurretSlots: number;
  nextHeroSlot: NextSlotInfo | null;
  nextTurretSlot: NextSlotInfo | null;
}
```

---

## Zrealizowane Ulepszenia

### ✅ Wdrożone Zmiany

1. **Usunięcie redundantnych nagród:**
   - ✅ Usunięto sloty z nagród poziomowych (poziomy 5, 10, 15, 25, 30, 35, 40, 45)
   - ✅ Zastąpiono je innymi nagrodami (HP bonus, inne unlocki)

2. **Lepsze komunikaty błędów:**
   - ✅ Dodano szczegółowe komunikaty pokazujące dokładnie ile brakuje poziomów lub złota
   - ✅ UI pokazuje "Brakuje poziomów: X" lub "Brakuje złota: X"

3. **Wizualizacja w UI:**
   - ✅ Dodano wskaźniki pokazujące następny dostępny slot
   - ✅ Dodano szczegółowe wymagania z wartościami liczbowymi
   - ✅ Przycisk zmienia kolor w zależności od dostępności (primary/secondary)
   - ✅ Wyświetlanie maksymalnej liczby slotów (8) zamiast hardcoded wartości

4. **Balans ekonomiczny:**
   - ✅ Zwiększono maksymalną liczbę slotów do 8
   - ✅ Obniżono wymagania dla slotów 3-4 (slot 3 bohatera dostępny na poziomie 2 za 500 złota)
   - ✅ Slot 3 bohatera dostępny po pierwszej sesji gry
   - ✅ Slot 4 bohatera dostępny na poziomie 5 za 1,500 złota
   - ✅ Zredukowano koszty wczesnych slotów dla lepszej dostępności

---

## Testy

### Lokalizacja Testów

- **Unit tests:** `packages/sim-core/src/__tests__/unit/data/fortress-progression.test.ts`
- **Integration tests:** `apps/server/src/__tests__/unit/services/slots.test.ts` (jeśli istnieje)

### Scenariusze do Przetestowania

1. ✅ Zakup slotu gdy spełnione są wszystkie wymagania
2. ✅ Próba zakupu gdy brakuje poziomu
3. ✅ Próba zakupu gdy brakuje złota
4. ✅ Próba zakupu darmowego slotu (powinna zwrócić błąd)
5. ✅ Próba zakupu gdy osiągnięto maksimum
6. ✅ Migracja starych graczy (backfill)
7. ✅ Nowi gracze zaczynają z poprawną liczbą slotów

---

## Podsumowanie

System odblokowywania slotów został pomyślnie zmigrowany na model zakupu za złoto z wymaganiami poziomowymi. System jest funkcjonalny, ale może wymagać:

1. **Czyszczenia redundantnych nagród poziomowych**
2. **Lepszej wizualizacji w UI**
3. **Możliwego balansu ekonomicznego** dla późniejszych slotów

System jest dobrze zintegrowany z resztą kodu i ma odpowiednie fallbacki dla kompatybilności wstecznej.
