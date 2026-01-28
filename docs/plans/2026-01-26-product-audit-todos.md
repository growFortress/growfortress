# Grow Fortress - Product Audit TODO List

**Data audytu:** 2026-01-26
**Cel:** Przygotowanie gry jako kompletnego produktu do launch (web + mobile web)

---

## Executive Summary

| Priorytet | Ilość zadań | Szacowany wpływ |
|-----------|-------------|-----------------|
| 🔴 KRYTYCZNY | 8 | Blokuje launch |
| 🟠 WYSOKI | 12 | Znacząco wpływa na retention/revenue |
| 🟡 ŚREDNI | 15 | Poprawia jakość produktu |
| 🟢 NISKI | 10 | Nice-to-have |

---

## 🔴 KRYTYCZNY (Blokuje Launch)

### Monetyzacja

- [ ] **MON-001**: Zaimplementować backend routes dla systemu gacha (`/v1/gacha/*`)
  - Schema już istnieje w `packages/protocol/src/gacha.ts`
  - Potrzebne: hero summon, artifact chests, pity system, spark redemption
  - Szacowany wpływ: +40-60% potential revenue

- [ ] **MON-002**: Zaimplementować UI flow dla gacha
  - Plik istnieje: `apps/web/src/components/modals/GachaBannerModal.tsx`
  - Potrzebne: animacje losowania, pity counter display, spark progress

- [ ] **MON-003**: Dokończyć convenience items w `handleConvenienceItem()`
  - Lokalizacja: `apps/server/src/services/shop.ts:872-893`
  - Stubbed items: `boss_ticket`, `pvp_reset`, `quest_refresh`
  - Komentarz w kodzie: "Set a flag that next idle claim is doubled (would need to add to user model)"

### Retention

- [ ] **RET-001**: Zaimplementować system Daily Login Rewards
  - Brak w codebase - wymaga nowego systemu
  - Standard w konkurencji: 7-day cycle z rosnącymi nagrodami
  - Szacowany wpływ: +20% DAU retention

- [ ] **RET-002**: Zaimplementować Weekly Missions/Challenges
  - Brak w codebase - wymaga nowego systemu
  - Przykłady: "Zabij 1000 wrogów", "Ukończ 10 fal bez obrażeń"
  - Szacowany wpływ: +15% weekly retention

### Tutorial/FTUE

- [ ] **TUT-001**: Dodać opcję skip tutorial dla returning players
  - Lokalizacja: `apps/web/src/tutorial/tutorialSteps.ts`
  - Problem: Frustracja przy tworzeniu nowych kont (testing, streaming)

- [ ] **TUT-002**: Dodać achievement za ukończenie tutoriala
  - Brak nagrody za przejście onboardingu
  - Sugestia: "First Steps" achievement + starter dust reward

### Legal/Compliance

- [ ] **LEG-001**: Dodać gacha rates disclosure (wymagane prawnie w wielu krajach)
  - Dotyczy: EU, Japan, China, Belgium regulations
  - Potrzebne: widoczne % drop rates przed zakupem

---

## 🟠 WYSOKI (Znaczący wpływ)

### Monetyzacja

- [ ] **MON-004**: Rozbudować system kosmetyków
  - Obecnie: tylko founder badge
  - Potrzebne: hero skins, fortress skins, effect colors
  - Szacowany wpływ: +30% whale spending

- [ ] **MON-005**: Dodać Limited-Time Offers system
  - Flash sales, bundle deals with countdown
  - Szacowany wpływ: +15% impulse purchases

- [ ] **MON-006**: Zaimplementować First Purchase Double Bonus
  - Schema exists, needs frontend messaging
  - "First purchase gets 2x value!"

### Retention

- [ ] **RET-003**: Dodać streak bonus system
  - Consecutive day login = increasing rewards
  - Standard: 7-day streak = premium currency

- [ ] **RET-004**: Zaimplementować limited-time events system
  - Seasonal events, special boss rushes
  - Rotacja co 2-4 tygodnie

- [ ] **RET-005**: Dodać "reminder" tooltips po tutorialu
  - Gracze zapominają mechaniki po przerwie
  - Sugestia: context-sensitive hints after 3+ days inactive

### Social Features

- [ ] **SOC-001**: Dodać social sharing (share score, share build)
  - Brak w codebase
  - Potrzebne dla viral growth na web

- [ ] **SOC-002**: Zaimplementować invite friends system z nagrodami
  - Referral codes, friend bonuses
  - Szacowany wpływ: +10-20% organic acquisition

- [ ] **SOC-003**: Dodać spectate mode dla guild members
  - Możliwość oglądania rozgrywki innych
  - Buduje community engagement

### UI/UX

- [ ] **UX-001**: Dodać light mode option
  - Obecnie: tylko dark theme
  - Niektórzy gracze preferują jasne UI

- [ ] **UX-002**: Poprawić color variety
  - Heavy reliance na cyan/red może powodować palette fatigue
  - Sugestia: więcej accent colors per pillar

### Combat System (Nice-to-have enhancements)

- [ ] **COM-001**: Zaimplementować invulnerability frames (5 ultimate abilities)
  - Zakomentowane w `heroes.ts`: Vanguard, Medic, Scout, Forge, Pyro
  - Komentarz: "wymaga osobnej implementacji w systemie walki"

---

## 🟡 ŚREDNI (Poprawia jakość)

### Tutorial/FTUE

- [ ] **TUT-003**: Rozszerzyć onboarding z 1 do 3 kroków
  - Komentarz w kodzie: "kept for potential future expansion"
  - Lokalizacja: `apps/web/src/components/modals/OnboardingModal.tsx`

- [ ] **TUT-004**: Dodać interactive tutorial replay w settings
  - Możliwość ponownego przejścia tutoriala

- [ ] **TUT-005**: Dodać tooltips dla wszystkich UI elementów
  - Hover explanations dla ikon, statów, bonusów

### Monetyzacja

- [ ] **MON-007**: Dodać purchase confirmation modals
  - Dodatkowe potwierdzenie przed zakupem
  - Wymagane dla dobrego UX i compliance

- [ ] **MON-008**: Zaimplementować email receipts
  - Automatyczne potwierdzenie zakupu na email

- [ ] **MON-009**: Dodać refund request UI (user-facing)
  - Admin-side exists, potrzebne user-facing

### Progression

- [ ] **PRO-001**: Dodać milestone rewards
  - Nagrody za osiągnięcie key progression points
  - np. "Reach Commander Level 10" = special reward

- [ ] **PRO-002**: Balansować early game curve
  - Pierwsze 30 fal mogą być zbyt łatwe/trudne
  - Potrzebne: playtesting i tuning

- [ ] **PRO-003**: Dodać "what's new" screen po update
  - Informowanie graczy o nowych features

### Content

- [ ] **CON-001**: Dodać więcej boss variety
  - Obecnie: limited boss pool per pillar
  - Potrzebne dla long-term engagement

- [ ] **CON-002**: Rozważyć seasonal battle pass content
  - Nowe relikty, artefakty per season

- [ ] **CON-003**: Dodać hero lore/story elements
  - Character backstories, unlock cinematics

### Analytics

- [ ] **ANA-001**: Dodać monetization event tracking
  - Funnel analysis: view → click → purchase → complete

- [ ] **ANA-002**: Zaimplementować A/B testing framework dla pricing
  - Test different price points, bundles

- [ ] **ANA-003**: Dodać churn prediction alerts
  - Identify at-risk players for re-engagement

### Performance

- [ ] **PER-001**: Audit i optymalizacja CSS bundle size
  - Complex CSS architecture may need simplification

- [ ] **PER-002**: Lazy load modals i heavy components
  - Reduce initial bundle size

---

## 🟢 NISKI (Nice-to-have)

### UI/UX

- [ ] **UX-003**: Dodać custom cursor themes
  - Premium cosmetic option

- [ ] **UX-004**: Zaimplementować UI sound effects
  - Button clicks, notifications, achievements
  - Plik istnieje: `apps/web/src/game/AudioManager.ts` (has TODO)

- [ ] **UX-005**: Dodać keyboard shortcuts overlay
  - Help screen z wszystkimi hotkeys

### Social

- [ ] **SOC-004**: Dodać in-game chat system
  - Guild chat, global chat

- [ ] **SOC-005**: Zaimplementować friend list system
  - Add friends, see online status

### Content

- [ ] **CON-004**: Dodać achievement showcase na profilu
  - Display rare achievements to others

- [ ] **CON-005**: Rozważyć endless mode prestige system
  - Reset progress for permanent bonuses

### Localization

- [ ] **LOC-001**: Dodać więcej języków
  - Obecnie: EN, PL
  - Potrzebne dla global reach: DE, FR, ES, PT, RU

- [ ] **LOC-002**: Dodać currency localization
  - Obecnie: PLN primary
  - Auto-detect: EUR, USD, GBP based on region

---

## Podsumowanie według systemu

| System | Krytyczne | Wysokie | Średnie | Niskie | Total |
|--------|-----------|---------|---------|--------|-------|
| Monetyzacja | 3 | 3 | 3 | 0 | 9 |
| Retention | 2 | 3 | 0 | 0 | 5 |
| Tutorial/FTUE | 2 | 1 | 2 | 0 | 5 |
| Social | 0 | 3 | 0 | 2 | 5 |
| UI/UX | 0 | 2 | 0 | 3 | 5 |
| Combat | 0 | 1 | 0 | 0 | 1 |
| Progression | 0 | 0 | 3 | 1 | 4 |
| Content | 0 | 0 | 3 | 2 | 5 |
| Analytics | 0 | 0 | 3 | 0 | 3 |
| Performance | 0 | 0 | 2 | 0 | 2 |
| Legal | 1 | 0 | 0 | 0 | 1 |
| Localization | 0 | 0 | 0 | 2 | 2 |
| **TOTAL** | **8** | **12** | **15** | **10** | **45** |

---

## Następne kroki

1. **Sprint 1 (2 tygodnie):** Wszystkie KRYTYCZNE zadania
2. **Sprint 2 (2 tygodnie):** WYSOKIE zadania monetyzacji i retention
3. **Sprint 3 (2 tygodnie):** WYSOKIE zadania social + pozostałe
4. **Ongoing:** ŚREDNIE i NISKIE w backlogu

---

*Dokument wygenerowany przez Claude Code podczas kompleksowego audytu produktu.*
