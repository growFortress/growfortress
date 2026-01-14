# Guild System (System Gildii)

System gildii dla Grow Fortress. Umozliwia tworzenie zespolow 10-20 graczy z hierarchia rang, wspolnym skarbcem, bitwami Arena 5v5, Weekly Tower Race i Guild Boss.

## Spis tresci

1. [Przeglad](#przeglad)
2. [Battle Hero System](#battle-hero-system)
3. [Arena 5v5 (Guild Siege)](#arena-5v5-guild-siege)
4. [Weekly Tower Race](#weekly-tower-race)
5. [Guild Boss](#guild-boss)
6. [Skarbiec](#skarbiec)
7. [Guild Preview](#guild-preview)
8. [API Endpoints](#api-endpoints)
9. [Komponenty frontendowe](#komponenty-frontendowe)
10. [Stale konfiguracyjne](#stale-konfiguracyjne)

---

## Przeglad

### Glowne funkcje

- **Gildie 10-20 osob** - dynamiczny limit czlonkow zalezny od poziomu gildii
- **Hierarchia rang** - Leader, Officer, Member z roznymi uprawnieniami
- **Battle Hero** - kazdy czlonek ustawia 1 bohatera do bitew gildyjnych
- **Arena 5v5** - instant PvP, Leader wybiera 5 czlonkow do ataku
- **Weekly Tower Race** - suma fal wszystkich czlonkow w tygodniu
- **Guild Boss** - tygodniowy boss PvE, 1 atak dziennie per czlonek
- **Skarbiec** - wspolne zasoby (gold, dust, sigils) z auditowaniem
- **Guild Coins** - waluta gildyjna za aktywnosci

### Role i uprawnienia

| Rola | Zapraszanie | Wyrzucanie | Skarbiec | Ataki Arena | Roster View |
|------|-------------|------------|----------|-------------|-------------|
| LEADER | Tak | Wszystkich | Wplata/Wyplata | Tak | Tak |
| OFFICER | Tak | Memberow | Wplata | Tak | Tak |
| MEMBER | Nie | Nie | Wplata | Nie | Nie |

### Tryby rywalizacji

| Tryb | Typ | Cykl | Nagrody |
|------|-----|------|---------|
| Arena 5v5 | PvP | Ciagly | Honor, Guild Coins |
| Tower Race | Pasywny | Tygodniowy | Guild Coins |
| Guild Boss | PvE | Tygodniowy | Guild Coins |

---

## Battle Hero System

Kazdy czlonek gildii moze ustawic jednego "Battle Hero" - bohatera ktory reprezentuje go w bitwach gildyjnych.

### Mechanika

- **Jeden bohater per czlonek** - staly wybor (mozna zmienic)
- **Wymaga odblokowanego bohatera** - gracz musi miec bohatera
- **Cached stats** - tier, power zapisywane dla szybkiego dostepu
- **Wymagany do bitew** - bez Battle Hero nie mozna byc wybranym do Arena 5v5
- **Wymagany do Guild Boss** - bez Battle Hero nie mozna atakowac bossa

### API

```
PUT  /v1/guilds/:guildId/battle-hero     - ustaw Battle Hero
GET  /v1/guilds/:guildId/battle-hero     - pobierz swojego Battle Hero
DELETE /v1/guilds/:guildId/battle-hero   - wyczysc Battle Hero
GET  /v1/guilds/:guildId/battle-roster   - roster dla Leader/Officer
```

### Dane Battle Hero

```typescript
interface BattleHero {
  odId: string;      // ID bohatera
  odName: string;    // Nazwa bohatera
  tier: 1 | 2 | 3;      // Tier bohatera
  power: number;        // Cached power
  equippedArtifact?: string;
}
```

---

## Arena 5v5 (Guild Siege)

System instant PvP - Leader/Officer wybiera 5 czlonkow i atakuje inna gildie. Symulacja 5 bohaterow vs 5 bohaterow.

### Mechanika ataku

1. **Leader/Officer inicjuje atak**
2. **Wybiera 5 czlonkow** z Battle Hero
3. **System losuje 5 obrocow** z atakowanej gildii
4. **Symulacja Arena 5v5** - instant wynik
5. **Honor update** - ELO system

### Limity i cooldowny

| Parametr | Wartosc |
|----------|---------|
| Ataki dziennie | 10 per gildia |
| Cooldown na ta sama gildie | 24 godziny |
| Shield (ochrona) | 24h, max 2/tydzien |
| Shield koszt | 5000 gold |

### Shield System

- **Aktywacja** - Leader moze aktywowac shield za gold
- **Czas trwania** - 24 godziny
- **Limit** - max 2 shieldy na tydzien
- **Blokada atakow** - gildia ze shieldem NIE moze tez atakowac

### Symulacja Arena

```typescript
interface ArenaSimulationResult {
  winnerSide: 'attacker' | 'defender' | 'draw';
  attackerSurvivors: number;
  defenderSurvivors: number;
  duration: number;  // ticks
  totalDamageDealt: { attacker: number; defender: number };
  mvp: { odId: string; odName: string; damage: number; kills: number };
  kills: Array<{ tick: number; killerHeroId: string; victimHeroId: string }>;
  keyMoments: KeyMoment[];  // dla replay
}
```

### Logika symulacji

- **Pole** - prostokat z pozycjami
- **Targeting** - losowy cel z przeciwnej druzyny
- **Skills** - bohaterowie uzywaja umiejetnosci
- **Weaknesses** - counter system (np. lightning slaby vs ice)
- **Czas** - max 60 sekund (1800 tickow)

### API

```
POST /v1/guilds/:guildId/battles/attack   - instant atak
GET  /v1/guilds/:guildId/battles/status   - status atakow (limity)
GET  /v1/guilds/:guildId/shield           - status shield
POST /v1/guilds/:guildId/shield           - aktywuj shield
GET  /v1/guilds/:guildId/battles          - historia bitew
GET  /v1/guilds/:guildId/battles/:id      - szczegoly bitwy
```

### Honor (ELO)

```typescript
// Obliczanie zmiany honoru
function calculateHonorChange(winnerHonor: number, loserHonor: number) {
  const kFactor = 32;
  const expectedWin = 1 / (1 + Math.pow(10, (loserHonor - winnerHonor) / 400));
  const change = Math.round(kFactor * (1 - expectedWin));
  return { winnerChange: change, loserChange: -change };
}
```

---

## Weekly Tower Race

Tygodniowa rywalizacja gildii oparta na sumie fal przejsciowych przez wszystkich czlonkow.

### Mechanika

- **Cykl** - Poniedzialek 00:00 UTC do Niedziela 23:59 UTC
- **Punkty** - kazda fala przejsciowa dodaje +1 do sumy gildii
- **Automatyczne** - granie normalnie (Endless TD) liczy sie
- **Ranking** - gildie rankowane po total waves

### Nagrody (Guild Coins)

| Miejsce | Nagroda |
|---------|---------|
| 1 | 500 Guild Coins |
| 2 | 300 Guild Coins |
| 3 | 200 Guild Coins |
| 4-10 | 100 Guild Coins |
| 11-20 | 50 Guild Coins |

### API

```
GET /v1/guilds/tower-race              - leaderboard (public)
GET /v1/guilds/:guildId/tower-race     - status dla gildii
GET /v1/guilds/:guildId/tower-race/details - breakdown per member
GET /v1/guilds/tower-race/history      - historia wyscigów
```

### Dane

```typescript
interface TowerRaceEntry {
  guildId: string;
  guildName: string;
  guildTag: string;
  totalWaves: number;
  rank: number;
}

interface TowerRaceContribution {
  userId: string;
  displayName: string;
  wavesContributed: number;
}
```

---

## Guild Boss

Tygodniowy boss PvE dla calej gildii. Kazdy czlonek moze atakowac raz dziennie.

### Mechanika

- **Cykl** - Poniedzialek do Niedziela
- **HP** - 50,000,000 (50M)
- **Ataki** - 1 per czlonek per dzien
- **Wymaga Battle Hero** - damage bazuje na Battle Hero
- **Slabosci** - kazdy boss ma weakness (fortress class)

### Typy bossow (rotacja)

| Typ | Nazwa |
|-----|-------|
| dragon | Smok Chaosu |
| titan | Prastarzy Tytan |
| demon | Arcydiabel |
| leviathan | Lewiatan |
| phoenix | Ognisty Feniks |

### Slabosci

- castle, arcane, nature, shadow, forge
- Slabosci rotuja co tydzien
- Info o weakness widoczne dla graczy

### Obliczanie damage

```typescript
const tierMultiplier = 1 + (heroTier - 1) * 0.5; // T1=1x, T2=1.5x, T3=2x
const randomMultiplier = 0.8 + Math.random() * 0.4;
const damage = Math.floor(heroPower * randomMultiplier * tierMultiplier * 100);
```

### Nagrody (Guild Coins)

| Akcja | Nagroda |
|-------|---------|
| Uczestnictwo (atak) | 50 Guild Coins |
| Top damage w gildii | +200 Guild Coins |
| 1 miejsce (gildia) | 500 Guild Coins |
| 2 miejsce | 300 Guild Coins |
| 3 miejsce | 200 Guild Coins |
| 4-10 miejsce | 100 Guild Coins |
| 11-20 miejsce | 50 Guild Coins |

### API

```
GET  /v1/guilds/boss                    - info o bossie (public)
GET  /v1/guilds/:guildId/boss           - status dla czlonka
POST /v1/guilds/:guildId/boss/attack    - atak na bossa
GET  /v1/guilds/boss/leaderboard        - ranking gildii
GET  /v1/guilds/:guildId/boss/breakdown - damage czlonkow
GET  /v1/guilds/boss/top-damage         - top damage globalnie
```

---

## Skarbiec

Wspolne zasoby gildii z pelnym auditowaniem.

### Zasoby

- **Gold** - glowna waluta
- **Dust** - material do ulepszania
- **Sigils** - rzadka waluta
- **Guild Coins** - waluta gildyjna (osobne pole w Guild)

### Operacje

| Operacja | Kto | Limit |
|----------|-----|-------|
| Wplata | Wszyscy | Bez limitu |
| Wyplata | Leader | 1 na 24h |

### API

```
GET  /v1/guilds/:guildId/treasury           - stan skarbca
POST /v1/guilds/:guildId/treasury/deposit   - wplata
POST /v1/guilds/:guildId/treasury/withdraw  - wyplata (Leader)
GET  /v1/guilds/:guildId/treasury/logs      - historia
```

---

## Guild Preview

System podgladu gildii pozwala na przeglad publicznych informacji o dowolnej gildii z kazdego miejsca gdzie widoczny jest tag gildii [TAG].

### Widoczne dane

| Kategoria | Dane |
|-----------|------|
| Podstawowe | Nazwa, tag, opis, data utworzenia |
| Statystyki | Poziom (z progress bar XP), honor, liczba czlonkow |
| Trofea | Lista zdobytych trofeow gildyjnych |
| Tech Levels | Poziomy w 4 kategoriach (Fortress/Hero/Turret/Economy) |
| Bonusy | Procentowe bonusy wynikajace z tech levels (2% per level) |
| TOP 5 | Najlepsi czlonkowie z rolami, poziomami i moca |

### Ukryte dane (prywatnosc)

- Stan skarbca (gold, dust, sigils)
- Pelna lista czlonkow
- Historia transakcji
- Szczegoly bitew

### Entry points (miejsca dostepu)

Klikniecie tagu gildii `[TAG]` otwiera podglad w nastepujacych miejscach:

| Lokalizacja | Komponent |
|-------------|-----------|
| Rankingi graczy | `LeaderboardModal.tsx` |
| Podglad gracza (Hub) | `HubPreviewModal.tsx` |
| Wyszukiwarka gildii | `GuildSearchModal.tsx` |
| Historia bitew Arena | `GuildBattlesTab.tsx` |

### Komponent GuildTag

Reużywalny komponent do wyswietlania klikalnego tagu gildii:

```typescript
interface GuildTagProps {
  guildId: string;     // ID gildii (wymagane do preview)
  tag: string;         // Tag do wyswietlenia
  clickable?: boolean; // Czy klikalny (default: true)
  className?: string;  // Dodatkowe klasy CSS
}

// Uzycie
<GuildTag guildId="guild-123" tag="EPIC" />
```

### Dane odpowiedzi API

```typescript
interface GuildPreviewResponse {
  guildId: string;
  name: string;
  tag: string;
  description: string | null;
  level: number;
  xp: number;
  xpToNextLevel: number;
  honor: number;
  memberCount: number;
  maxMembers: number;
  trophies: string[];
  techLevels: {
    fortress: { hp: number; damage: number; regen: number };
    hero: { hp: number; damage: number; cooldown: number };
    turret: { damage: number; speed: number; range: number };
    economy: { gold: number; dust: number; xp: number };
  };
  bonuses: {
    goldPercent: number;
    dustPercent: number;
    xpPercent: number;
    fortressHpPercent: number;
    fortressDamagePercent: number;
    fortressRegenPercent: number;
    heroHpPercent: number;
    heroDamagePercent: number;
    heroCooldownPercent: number;
    turretDamagePercent: number;
    turretSpeedPercent: number;
    turretRangePercent: number;
  };
  topMembers: Array<{
    userId: string;
    displayName: string;
    role: 'LEADER' | 'OFFICER' | 'MEMBER';
    level: number;
    power: number;
  }>;
  createdAt: string;
}
```

### Cache

- **Klucz Redis**: `guild:preview:{guildId}`
- **TTL**: 5 minut
- **Invalidacja**: Przy zmianach w gildii (nazwa, opis, tech, czlonkowie)

---

## API Endpoints

### Zarzadzanie gildia

```
POST   /v1/guilds                    - tworz gildie
GET    /v1/guilds/:id                - pobierz gildie
PATCH  /v1/guilds/:id                - aktualizuj (Leader)
DELETE /v1/guilds/:id                - rozwiaz (Leader)
GET    /v1/guilds?search=            - szukaj
```

### Czlonkostwo

```
GET    /v1/guilds/me                 - moja gildia
POST   /v1/guilds/:id/leave          - opusc
DELETE /v1/guilds/:id/members/:uid   - wyrzuc
PATCH  /v1/guilds/:id/members/:uid/role - zmien role
POST   /v1/guilds/:id/transfer       - przekaz liderstwo
```

### Zaproszenia

```
POST   /v1/guilds/:id/invitations              - wyslij
GET    /v1/guilds/:id/invitations              - lista (gildia)
GET    /v1/guilds/invitations/received         - otrzymane
POST   /v1/guilds/invitations/:id/accept       - akceptuj
POST   /v1/guilds/invitations/:id/decline      - odrzuc
POST   /v1/guilds/invitations/:id/cancel       - anuluj
```

### Leaderboard

```
GET /v1/guilds/leaderboard           - ranking honor
GET /v1/guilds/:id/rank              - pozycja gildii
GET /v1/guilds/:id/contributions     - wklad czlonkow
```

### Guild Preview

```
GET /v1/guilds/:guildId/preview      - podglad gildii (public info)
```

---

## Komponenty frontendowe

### Struktura

```
apps/web/src/components/guild/
├── GuildPanel.tsx              # Glowny panel z zakladkami
├── GuildPanel.module.css       # Style
├── GuildInfoTab.tsx            # Info, bonusy, progresja
├── GuildMembersTab.tsx         # Czlonkowie + Battle Hero
├── GuildTreasuryTab.tsx        # Skarbiec
├── GuildBattlesTab.tsx         # Arena 5v5, historia bitew
├── GuildRosterTab.tsx          # Roster dla Leader/Officer
├── GuildTowerRaceTab.tsx       # Weekly Tower Race
├── GuildBossTab.tsx            # Guild Boss
├── GuildCreateModal.tsx        # Tworzenie gildii
├── GuildSearchModal.tsx        # Szukanie gildii
└── ArenaReplay.tsx             # Replay bitwy Arena 5v5

apps/web/src/components/modals/
├── GuildPreviewModal.tsx       # Podglad gildii (public info)
└── GuildPreviewModal.module.css

apps/web/src/components/shared/
├── GuildTag.tsx                # Klikalny tag gildii [TAG]
└── GuildTag.module.css
```

### Zakladki w GuildPanel

| Tab | Widocznosc | Opis |
|-----|------------|------|
| Info | Wszyscy | Podstawowe info, bonusy |
| Czlonkowie | Wszyscy | Lista, Battle Hero |
| Skarbiec | Wszyscy | Zasoby, transakcje |
| Bitwy | Wszyscy | Arena 5v5, historia |
| Wyscig | Wszyscy | Tower Race |
| Boss | Wszyscy | Guild Boss |
| Roster | Leader/Officer | Pelne staty czlonkow |

### Signals (stan)

```typescript
// apps/web/src/state/guild.signals.ts

// Panel state
export const showGuildPanel = signal(false);
export const guildPanelTab = signal<TabType>('info');

// Guild data
export const playerGuild = signal<GuildWithMembers | null>(null);
export const playerMembership = signal<GuildMember | null>(null);
export const guildBonuses = signal<GuildBonuses | null>(null);

// Battles
export const guildBattles = signal<GuildBattle[]>([]);

// Computed
export const isInGuild = computed(() => playerGuild.value !== null);
export const isGuildLeader = computed(() => playerMembership.value?.role === 'LEADER');
export const isGuildOfficer = computed(() =>
  playerMembership.value?.role === 'LEADER' ||
  playerMembership.value?.role === 'OFFICER'
);
```

```typescript
// apps/web/src/state/guildPreview.signals.ts

// Modal state
export const guildPreviewModalOpen = signal(false);
export const guildPreviewGuildId = signal<string | null>(null);

// Data
export const guildPreviewData = signal<GuildPreviewResponse | null>(null);
export const guildPreviewLoading = signal(false);
export const guildPreviewError = signal<string | null>(null);

// Actions
export function openGuildPreview(guildId: string): void;
export function closeGuildPreview(): void;
```

---

## Stale konfiguracyjne

```typescript
// packages/protocol/src/guild.ts

export const GUILD_CONSTANTS = {
  // Nazwa i tag
  NAME_MIN_LENGTH: 3,
  NAME_MAX_LENGTH: 24,
  TAG_MIN_LENGTH: 2,
  TAG_MAX_LENGTH: 5,

  // Czlonkostwo
  BASE_MEMBER_CAPACITY: 10,
  MAX_MEMBER_CAPACITY: 20,
  MAX_LEVEL: 20,

  // Zaproszenia
  INVITATION_EXPIRY_HOURS: 72,

  // Skarbiec
  WITHDRAW_COOLDOWN_HOURS: 24,

  // Arena 5v5
  DAILY_ATTACK_LIMIT: 10,
  ATTACK_SAME_GUILD_COOLDOWN_HOURS: 24,
  SHIELD_DURATION_HOURS: 24,
  SHIELD_COST_GOLD: 5000,
  SHIELD_MAX_PER_WEEK: 2,
  ARENA_TEAM_SIZE: 5,

  // Honor (ELO)
  STARTING_HONOR: 1000,
  MIN_HONOR: 100,
  MAX_HONOR: 3000,
  K_FACTOR: 32,

  // Guild Coins
  COINS_ARENA_WIN: 100,
  COINS_ARENA_PARTICIPATION: 30,
  COINS_BOSS_PARTICIPATION: 50,
  COINS_BOSS_TOP_DAMAGE: 200,

  // Guild Boss
  BOSS_TOTAL_HP: 50_000_000,
} as const;
```

---

## Kody bledow

```typescript
export const GUILD_ERROR_CODES = {
  // Ogolne
  GUILD_NOT_FOUND: 'GUILD_NOT_FOUND',
  NOT_IN_GUILD: 'NOT_IN_GUILD',
  ALREADY_IN_GUILD: 'ALREADY_IN_GUILD',

  // Uprawnienia
  NOT_LEADER: 'NOT_GUILD_LEADER',
  NOT_OFFICER: 'NOT_GUILD_OFFICER',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_GUILD_PERMISSIONS',

  // Battle Hero
  NO_BATTLE_HERO_SET: 'NO_BATTLE_HERO_SET',
  HERO_NOT_UNLOCKED: 'HERO_NOT_UNLOCKED',

  // Arena
  DAILY_ATTACK_LIMIT_REACHED: 'DAILY_ATTACK_LIMIT_REACHED',
  ATTACK_ON_COOLDOWN: 'ATTACK_ON_COOLDOWN',
  GUILD_HAS_SHIELD: 'GUILD_HAS_SHIELD',
  OWN_GUILD_HAS_SHIELD: 'OWN_GUILD_HAS_SHIELD',
  NOT_ENOUGH_BATTLE_HEROES: 'NOT_ENOUGH_BATTLE_HEROES',
  INVALID_MEMBER_SELECTION: 'INVALID_MEMBER_SELECTION',

  // Shield
  SHIELD_ALREADY_ACTIVE: 'SHIELD_ALREADY_ACTIVE',
  SHIELD_WEEKLY_LIMIT: 'SHIELD_WEEKLY_LIMIT_REACHED',
  INSUFFICIENT_GOLD_FOR_SHIELD: 'INSUFFICIENT_GOLD_FOR_SHIELD',

  // Boss
  ALREADY_ATTACKED_BOSS_TODAY: 'ALREADY_ATTACKED_BOSS_TODAY',
  BOSS_EXPIRED: 'BOSS_EXPIRED',

  // Skarbiec
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_TREASURY_FUNDS',
  WITHDRAW_ON_COOLDOWN: 'WITHDRAW_ON_COOLDOWN',

  // Bitwy
  BATTLE_NOT_FOUND: 'BATTLE_NOT_FOUND',
  CANNOT_ATTACK_SELF: 'CANNOT_ATTACK_SELF',
} as const;
```

---

## Przyklady uzycia

### Ustawienie Battle Hero

```typescript
const handleSetBattleHero = async (heroId: string) => {
  try {
    await setBattleHero(guildId, heroId);
    showSuccess('Battle Hero ustawiony!');
  } catch (error) {
    if (error.code === 'HERO_NOT_UNLOCKED') {
      showError('Musisz najpierw odblokowac tego bohatera');
    }
  }
};
```

### Atak Arena 5v5

```typescript
const handleAttack = async (defenderGuildId: string, memberIds: string[]) => {
  try {
    const result = await instantAttack(myGuildId, {
      defenderGuildId,
      selectedMemberIds: memberIds, // 5 members
    });

    // Pokaz wynik
    showBattleResult(result);
  } catch (error) {
    if (error.code === 'DAILY_ATTACK_LIMIT_REACHED') {
      showError('Wykorzystales limit atakow na dzisiaj');
    } else if (error.code === 'GUILD_HAS_SHIELD') {
      showError('Ta gildia ma aktywny shield');
    }
  }
};
```

### Atak Guild Boss

```typescript
const handleBossAttack = async () => {
  try {
    const result = await attackGuildBoss(guildId);
    showSuccess(`Zadano ${result.attempt.damage} obrazen! +${result.guildCoinsEarned} Guild Coins`);
  } catch (error) {
    if (error.code === 'ALREADY_ATTACKED_BOSS_TODAY') {
      showError('Mozesz atakowac bossa raz dziennie');
    } else if (error.code === 'NO_BATTLE_HERO_SET') {
      showError('Ustaw Battle Hero w zakladce Roster');
    }
  }
};
```

### Uzycie GuildTag

```tsx
import { GuildTag } from '../shared/GuildTag.js';

// W komponencie LeaderboardEntry
function LeaderboardEntry({ entry }: { entry: PlayerLeaderboardEntry }) {
  return (
    <div class={styles.entry}>
      <span class={styles.name}>{entry.displayName}</span>
      {entry.guildId && entry.guildTag && (
        <GuildTag guildId={entry.guildId} tag={entry.guildTag} />
      )}
      <span class={styles.score}>{entry.score}</span>
    </div>
  );
}

// Klikniecie tagu automatycznie otwiera GuildPreviewModal
```

### Programatyczne otwarcie podgladu gildii

```typescript
import { openGuildPreview } from '../state/guildPreview.signals.js';

// Otworz podglad gildii po ID
const handleViewGuild = (guildId: string) => {
  openGuildPreview(guildId);
};
```
