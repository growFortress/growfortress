# Monitoring & Alerting

System monitoringu i alertów dla Arcade TD Server.

## Metryki zbierane

### Podstawowe metryki (co minutę)
- **CCU** (Concurrent Users) - użytkownicy aktywni w ostatnich 2 minutach
- **Active Sessions** - wszystkie aktywne sesje gry
- **Error Count** - liczba błędów w ostatniej godzinie

### Nowe metryki (od wersji z monitoringiem)
- **Response Time** - statystyki czasu odpowiedzi API:
  - Average (średnia)
  - P50 (mediana)
  - P95 (95 percentyl)
  - P99 (99 percentyl)
  - Max (maksymalny)

- **Queue Metrics** - metryki kolejek BullMQ:
  - Waiting - zadania oczekujące
  - Active - zadania w trakcie wykonywania
  - Delayed - zadania opóźnione
  - Failed - zadania zakończone niepowodzeniem
  - Szczegółowe metryki per kolejka (leaderboard, cleanup, metrics, player-leaderboard, guild-weekly)

## Gdzie są przechowywane metryki

Wszystkie metryki są zapisywane w bazie danych PostgreSQL w tabeli `MetricSnapshot`:
- Snapshot co minutę przez `metricsJob`
- Historia dostępna przez `/admin/dashboard/charts`
- Aktualne metryki przez `/admin/dashboard/stats`

## System alertów

### Konfiguracja progów alertów

Domyślne progi (można zmienić w kodzie `apps/server/src/services/alerts.ts`):

```typescript
{
  errorRatePerMinute: 10,      // 10 błędów na minutę
  responseTimeP95: 2000,        // 2 sekundy (P95)
  responseTimeP99: 5000,        // 5 sekund (P99)
  queueBacklog: 1000,          // 1000 oczekujących zadań
  queueFailedRate: 50,         // 50 nieudanych zadań w ostatniej godzinie
}
```

### Typy alertów

1. **Error Rate** - wysoki wskaźnik błędów
   - Warning: ≥ 10 błędów/minutę
   - Critical: ≥ 20 błędów/minutę

2. **Response Time** - długi czas odpowiedzi
   - Warning: P95 ≥ 2000ms
   - Critical: P95 ≥ 5000ms lub P99 ≥ 5000ms

3. **Queue Backlog** - duża kolejka zadań
   - Warning: ≥ 1000 oczekujących zadań
   - Critical: ≥ 2000 oczekujących zadań

4. **Queue Failed** - wysoki wskaźnik nieudanych zadań
   - Warning: ≥ 50 nieudanych zadań
   - Critical: ≥ 100 nieudanych zadań

### Konfiguracja webhooków

Aby otrzymywać alerty przez webhook, ustaw zmienną środowiskową:

```bash
ALERTS_WEBHOOK_URL=https://your-webhook-url.com/alerts
```

Webhook otrzyma POST request z JSON:
```json
{
  "alerts": [
    {
      "type": "error_rate",
      "severity": "critical",
      "message": "High error rate: 25 errors in the last minute",
      "value": 25,
      "threshold": 10,
      "timestamp": "2026-01-23T18:00:00.000Z"
    }
  ],
  "timestamp": "2026-01-23T18:00:00.000Z"
}
```

## Dashboard Admin

Dashboard dostępny pod `/admin/dashboard` pokazuje:
- Aktualne metryki (CCU, sesje, błędy)
- Response time (P95, P99, avg, max)
- Queue metrics (backlog, active, failed, delayed)
- Wykresy z ostatnich 24 godzin

## Monitoring Response Time

Response time jest mierzony przez middleware Fastify (`responseTimePlugin`):
- Mierzy czas każdego requestu
- Przechowuje ostatnie 1000 próbek w pamięci
- Oblicza statystyki (avg, p50, p95, p99, max)
- Dodaje header `X-Response-Time` do odpowiedzi

## Monitoring Queue

Metryki kolejek są zbierane przez `getQueueMetrics()`:
- Sprawdza wszystkie kolejki BullMQ
- Zwraca statystyki per kolejka i łączne
- Automatycznie sprawdzane co minutę w `metricsJob`

## Przykłady użycia

### Sprawdzenie aktualnych metryk (API)

```bash
curl -H "Authorization: Bearer <admin-token>" \
  http://localhost:3000/api/admin/dashboard/stats
```

### Sprawdzenie historii metryk

```bash
curl -H "Authorization: Bearer <admin-token>" \
  http://localhost:3000/api/admin/dashboard/charts
```

### Integracja z zewnętrznym monitoringiem

Możesz skonfigurować webhook, który będzie wysyłał metryki do:
- Prometheus (przez Pushgateway)
- Datadog (przez webhook)
- Grafana (przez webhook)
- Slack/Discord (przez webhook)
- Własny system monitoringu

Przykład webhook handler dla Slack:

```typescript
// apps/server/src/services/alerts.ts - można rozszerzyć sendAlertsWebhook
if (webhookUrl.includes('slack.com')) {
  const slackMessage = {
    text: `🚨 ${alerts.length} alert(s) detected`,
    attachments: alerts.map(alert => ({
      color: alert.severity === 'critical' ? 'danger' : 'warning',
      title: alert.message,
      fields: [
        { title: 'Type', value: alert.type, short: true },
        { title: 'Value', value: alert.value.toString(), short: true },
        { title: 'Threshold', value: alert.threshold.toString(), short: true },
      ],
    })),
  };
  // ... wysłanie do Slack
}
```

## Migracja bazy danych

Po dodaniu nowych metryk, uruchom migrację:

```bash
cd apps/server
npx prisma migrate deploy
```

Lub w development:

```bash
npx prisma migrate dev
```

## Troubleshooting

### Metryki nie są zbierane
- Sprawdź czy `metricsJob` jest uruchomiony
- Sprawdź logi serwera pod kątem błędów
- Sprawdź połączenie z bazą danych

### Alerty nie działają
- Sprawdź czy `ALERTS_WEBHOOK_URL` jest ustawione (jeśli używasz webhooków)
- Sprawdź logi serwera - alerty są logowane do konsoli
- Sprawdź progi w `apps/server/src/services/alerts.ts`

### Response time nie jest mierzony
- Sprawdź czy `responseTimePlugin` jest zarejestrowany w `app.ts`
- Sprawdź czy middleware jest przed innymi pluginami
