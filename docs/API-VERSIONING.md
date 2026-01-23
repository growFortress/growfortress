# API Versioning & Deprecation Strategy

## Overview

API używa wersjonowania URL-based (`/v1/`, `/v2/`, etc.) dla wszystkich endpointów. Ten dokument definiuje strategię zarządzania wersjami i proces deprecacji.

---

## Obecny Stan

- **Aktualna wersja API**: `v1`
- **Wszystkie endpointy**: Prefiks `/v1/`
- **Schema version**: 2 (w `packages/protocol/src/version.ts`)
- **Status**: Brak formalnej strategii deprecacji

---

## Zasady Wersjonowania

### Kiedy Tworzyć Nową Wersję?

Nowa wersja API (`/v2/`) powinna być utworzona gdy:

1. **Breaking changes w request/response**:
   - Usunięcie wymaganego pola
   - Zmiana typu pola (string → number)
   - Zmiana struktury odpowiedzi
   - Usunięcie wartości z enum

2. **Zmiany w zachowaniu**:
   - Endpoint zwraca inne dane dla tego samego inputu
   - Zmiana logiki biznesowej wpływająca na wynik

3. **Zmiany w autoryzacji**:
   - Nowe wymagania autoryzacyjne
   - Zmiana formatu tokenów

### Kiedy NIE Tworzyć Nowej Wersji?

- Dodanie nowych opcjonalnych pól
- Dodanie nowych endpointów
- Poprawki bugów (jeśli nie zmieniają kontraktu)
- Optymalizacje wydajności
- Dodanie nowych wartości do enum

---

## Strategia Deprecacji

### Timeline Deprecacji

| Faza | Czas | Akcja |
|------|------|-------|
| **Announcement** | T-6 miesięcy | Oznaczenie endpointu jako deprecated w dokumentacji |
| **Warning Headers** | T-3 miesiące | Dodanie `Deprecation` i `Sunset` headers |
| **Migration Period** | T-3 do T-0 | Wsparcie obu wersji równolegle |
| **Removal** | T-0 | Usunięcie starej wersji |

**Minimalny okres wsparcia**: **6 miesięcy** od ogłoszenia deprecacji

**Maksymalny okres wsparcia**: **12 miesięcy** (dla krytycznych endpointów)

### Proces Deprecacji

#### 1. Faza Announcement (T-6 miesięcy)

**Akcje:**
- Oznaczenie endpointu w dokumentacji jako `[DEPRECATED]`
- Dodanie komentarza w kodzie z datą usunięcia
- Powiadomienie w changelog/release notes
- Email do znanych integratorów (jeśli są)

**Przykład w kodzie:**
```typescript
/**
 * @deprecated This endpoint will be removed on 2026-07-23.
 * Use POST /v2/sessions/start instead.
 * Migration guide: https://docs.example.com/migration/v1-to-v2
 */
fastify.post('/v1/sessions/start', async (request, reply) => {
  // ... existing code
});
```

#### 2. Faza Warning Headers (T-3 miesiące)

**Akcje:**
- Dodanie HTTP headers do odpowiedzi:
  - `Deprecation: true`
  - `Sunset: <RFC 3339 date>` (data usunięcia)
  - `Link: <https://docs.example.com/migration/v1-to-v2>; rel="deprecation"`

**Implementacja:**
```typescript
fastify.post('/v1/sessions/start', async (request, reply) => {
  // Deprecation headers
  reply.header('Deprecation', 'true');
  reply.header('Sunset', 'Sat, 23 Jul 2026 00:00:00 GMT');
  reply.header('Link', '<https://docs.example.com/migration/v1-to-v2>; rel="deprecation"');
  
  // ... existing code
});
```

#### 3. Faza Migration (T-3 do T-0)

**Akcje:**
- Utrzymanie obu wersji równolegle
- Monitoring użycia starej wersji (logi, metryki)
- Komunikacja z użytkownikami używającymi starej wersji
- Dokumentacja migracji

**Monitoring:**
```typescript
// Log usage of deprecated endpoints
if (request.url.startsWith('/v1/')) {
  logger.warn({
    endpoint: request.url,
    userId: request.userId,
    userAgent: request.headers['user-agent'],
    message: 'Deprecated API version used'
  });
}
```

#### 4. Faza Removal (T-0)

**Akcje:**
- Usunięcie kodu endpointu
- Zwracanie `410 Gone` dla starych endpointów (opcjonalnie przez 30 dni)
- Aktualizacja dokumentacji
- Usunięcie z routingu

**Graceful removal:**
```typescript
// Option 1: Return 410 Gone
fastify.post('/v1/sessions/start', async (_request, reply) => {
  return reply.status(410).send({
    error: 'API_VERSION_DEPRECATED',
    message: 'This API version has been removed. Please migrate to /v2/sessions/start',
    migrationGuide: 'https://docs.example.com/migration/v1-to-v2'
  });
});

// Option 2: Remove route entirely (after grace period)
```

---

## Implementacja Techniczna

### 1. Deprecation Plugin

Utworzenie pluginu Fastify do automatycznego dodawania headers:

```typescript
// apps/server/src/plugins/deprecation.ts
import { FastifyPluginAsync } from 'fastify';

interface DeprecationConfig {
  version: string;
  sunsetDate: string;
  migrationGuide: string;
}

const DEPRECATED_ENDPOINTS: Record<string, DeprecationConfig> = {
  '/v1/sessions/start': {
    version: 'v1',
    sunsetDate: '2026-07-23T00:00:00Z',
    migrationGuide: 'https://docs.example.com/migration/v1-to-v2'
  }
};

export const deprecationPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onSend', async (request, reply, payload) => {
    const path = request.url.split('?')[0];
    const deprecation = DEPRECATED_ENDPOINTS[path];
    
    if (deprecation) {
      reply.header('Deprecation', 'true');
      reply.header('Sunset', new Date(deprecation.sunsetDate).toUTCString());
      reply.header(
        'Link',
        `<${deprecation.migrationGuide}>; rel="deprecation"`
      );
    }
    
    return payload;
  });
};
```

### 2. Monitoring i Alerting

**Metryki do śledzenia:**
- Liczba requestów do deprecated endpoints
- Unikalni użytkownicy używający starej wersji
- Trend spadkowy (czy migracja postępuje)

**Alerty:**
- > 10% ruchu na deprecated endpointy 1 miesiąc przed usunięciem
- Brak spadku użycia 2 miesiące przed usunięciem

### 3. Dokumentacja

**Wymagane sekcje:**
- Lista deprecated endpointów z datami usunięcia
- Migration guides dla każdej wersji
- Breaking changes changelog
- Timeline deprecacji

---

## Przykładowy Workflow

### Scenariusz: Deprecacja `/v1/sessions/start`

**2026-01-23** (Dzisiaj):
- Decyzja: Endpoint wymaga refaktoryzacji
- Plan: Nowy endpoint `/v2/sessions/start` z lepszą walidacją

**2026-01-23 - 2026-07-23** (6 miesięcy):
- ✅ Implementacja `/v2/sessions/start`
- ✅ Testy i dokumentacja
- ✅ Oznaczenie `/v1/sessions/start` jako deprecated w kodzie
- ✅ Aktualizacja dokumentacji

**2026-07-23** (T-6 miesięcy):
- ✅ Ogłoszenie w changelog
- ✅ Email do integratorów (jeśli są)

**2026-10-23** (T-3 miesiące):
- ✅ Dodanie deprecation headers
- ✅ Monitoring użycia

**2027-01-23** (T-0):
- ✅ Usunięcie `/v1/sessions/start`
- ✅ Zwracanie 410 Gone przez 30 dni (opcjonalnie)
- ✅ Usunięcie kodu

---

## Wyjątki i Specjalne Przypadki

### Krytyczne Endpointy

Dla endpointów krytycznych (np. autoryzacja, płatności):
- **Minimalny okres**: 12 miesięcy
- **Dodatkowe powiadomienia**: Email, in-app notifications
- **Fallback period**: 30 dni z 410 Gone przed całkowitym usunięciem

### Security Issues

Jeśli deprecacja wynika z problemów bezpieczeństwa:
- **Skrócony timeline**: Minimum 3 miesiące
- **Priorytetowe powiadomienia**: Natychmiastowe alerty
- **Wymuszenie migracji**: Możliwość wyłączenia starej wersji wcześniej

### Backward Compatibility

Gdy to możliwe, utrzymuj backward compatibility:
- Stare endpointy mogą przekierowywać do nowych
- Automatyczna konwersja requestów (jeśli bezpieczne)
- Graceful degradation

---

## Checklist Deprecacji

Przed usunięciem endpointu upewnij się:

- [ ] Nowa wersja jest w produkcji i stabilna
- [ ] Dokumentacja migracji jest kompletna
- [ ] Monitoring pokazuje < 1% użycia starej wersji
- [ ] Powiadomienia zostały wysłane
- [ ] Deprecation headers są dodane (min. 3 miesiące)
- [ ] Testy nowej wersji są przeszły
- [ ] Changelog jest zaktualizowany
- [ ] Data usunięcia jest jasno komunikowana

---

## Monitoring i Metryki

### Kluczowe Metryki

```typescript
// Przykładowe metryki do śledzenia
interface DeprecationMetrics {
  totalRequests: number;           // Całkowita liczba requestów
  deprecatedRequests: number;      // Requesty do deprecated endpoints
  uniqueUsers: number;             // Unikalni użytkownicy
  migrationRate: number;            // % użytkowników, którzy zmigrowali
  daysUntilSunset: number;          // Dni do usunięcia
}
```

### Dashboard

Zalecany dashboard z:
- Wykres użycia deprecated vs nowych endpointów
- Lista endpointów z datami sunset
- Alerty o wysokim użyciu deprecated endpoints
- Migration progress per endpoint

---

## Best Practices

1. **Komunikacja**: Zawsze komunikuj zmiany z wyprzedzeniem
2. **Dokumentacja**: Utrzymuj aktualne migration guides
3. **Monitoring**: Śledź użycie deprecated endpoints
4. **Graceful**: Zawsze daj czas na migrację
5. **Automatyzacja**: Użyj pluginów do automatycznego dodawania headers
6. **Testy**: Testuj zarówno starą jak i nową wersję
7. **Rollback plan**: Miej plan awaryjny na wypadek problemów

---

## Przykłady z Przemysłu

### GitHub API
- **Okres wsparcia**: 12 miesięcy
- **Headers**: `X-GitHub-Media-Type`, `Deprecation`, `Sunset`
- **Timeline**: 6 miesięcy warning, 6 miesięcy support

### Stripe API
- **Okres wsparcia**: Minimum 3 miesiące
- **Headers**: `Stripe-Version`, deprecation notices
- **Timeline**: Elastyczny, zależny od typu zmiany

### Twilio API
- **Okres wsparcia**: 12 miesięcy
- **Headers**: `Warning` header z datą
- **Timeline**: 6 miesięcy notice, 6 miesięcy support

---

## Rekomendacja dla Projektu

**Dla tego projektu rekomenduję:**

1. **Standardowy okres**: **6 miesięcy** od ogłoszenia do usunięcia
2. **Krytyczne endpointy**: **12 miesięcy**
3. **Security issues**: **3 miesiące** (minimum)
4. **Monitoring**: Automatyczne logowanie użycia deprecated endpoints
5. **Headers**: Implementacja deprecation plugin
6. **Dokumentacja**: Sekcja w README z listą deprecated endpoints

---

## Następne Kroki

1. ✅ Utworzenie tego dokumentu
2. ⬜ Implementacja deprecation plugin
3. ⬜ Dodanie monitoring dla deprecated endpoints
4. ⬜ Aktualizacja dokumentacji API z sekcją deprecation
5. ⬜ Utworzenie template dla migration guides
6. ⬜ Setup alertów dla wysokiego użycia deprecated endpoints

---

## FAQ

**Q: Co jeśli użytkownik nie zmigruje w czasie?**
A: Po okresie grace period (30 dni z 410 Gone), endpoint zostanie całkowicie usunięty. Użytkownicy muszą zaktualizować klienta.

**Q: Czy można przedłużyć okres deprecacji?**
A: Tak, jeśli jest uzasadnione (np. wysoki % użycia). Komunikuj zmianę timeline z wyprzedzeniem.

**Q: Co z WebSocket events?**
A: WebSocket events powinny mieć podobną strategię. Rozważ versioning w event names lub payload structure.

**Q: Jak obsługiwać breaking changes w schematach Zod?**
A: Użyj `SCHEMA_VERSION` w `packages/protocol/src/version.ts` i waliduj wersję w requestach.

---

**Ostatnia aktualizacja**: 2026-01-23
**Wersja dokumentu**: 1.0
