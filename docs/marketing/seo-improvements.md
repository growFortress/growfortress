# Ulepszenia SEO dla Grow Fortress

## 🎯 Priorytetowe Działania

### 1. Polskie Meta Tagi w index.html

**Status:** ⚠️ Do zaimplementowania

**Akcja:** Dodanie polskich wersji meta tagów Open Graph i Twitter Cards.

**Korzyści:**
- Lepsze wyświetlanie w polskich mediach społecznościowych
- Wyższe pozycje w polskich wynikach wyszukiwania
- Lepsze CTR (Click-Through Rate) z wyników wyszukiwania

---

### 2. Utworzenie sitemap.xml

**Status:** ⚠️ Brakuje

**Lokalizacja:** `/apps/web/public/sitemap.xml`

**Struktura sugerowana:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://growfortress.com/</loc>
    <lastmod>2026-01-28</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
    <xhtml:link rel="alternate" hreflang="pl" href="https://growfortress.com/?lang=pl"/>
    <xhtml:link rel="alternate" hreflang="en" href="https://growfortress.com/?lang=en"/>
  </url>
  <!-- Dodaj więcej URL-i gdy będą podstrony (blog, poradniki, etc.) -->
</urlset>
```

**Akcja:** Utworzenie automatycznego generowania sitemap (można użyć biblioteki jak `sitemap-generator`).

---

### 3. Utworzenie robots.txt

**Status:** ⚠️ Brakuje

**Lokalizacja:** `/apps/web/public/robots.txt`

**Zawartość:**
```
User-agent: *
Allow: /

# Sitemap
Sitemap: https://growfortress.com/sitemap.xml

# Zablokuj admin panel (jeśli jest publiczny)
Disallow: /admin/

# Zablokuj API endpoints (jeśli nie chcesz ich indeksować)
Disallow: /api/
```

---

### 4. Optymalizacja Structured Data (Schema.org)

**Status:** ✅ Częściowo zaimplementowane

**Aktualne:** VideoGame schema jest już w `index.html`

**Ulepszenia:**
- Dodanie `GameServer` schema dla informacji o serwerze
- Dodanie `Review` schema (gdy będą recenzje)
- Dodanie `FAQPage` schema (gdy będzie FAQ)
- Dodanie `BreadcrumbList` schema dla nawigacji

**Przykład rozszerzenia:**
```json
{
  "@context": "https://schema.org",
  "@type": "VideoGame",
  "name": "Grow Fortress",
  "description": "...",
  "gameServer": {
    "@type": "GameServer",
    "name": "Grow Fortress Server",
    "gameLocation": "https://growfortress.com"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.8",
    "ratingCount": "1000"
  }
}
```

---

### 5. Optymalizacja Title Tags

**Status:** ✅ Dobry, ale można ulepszyć

**Aktualny:** `Grow Fortress - Endless TD + Roguelike Choices + PvP Arena | Free Browser Game`

**Sugerowane warianty:**
- **PL:** `Grow Fortress - Nieskończona Tower Defense + Roguelike + PvP | Darmowa Gra Przeglądarkowa`
- **EN:** `Grow Fortress - Endless Tower Defense + Roguelike + PvP Arena | Free Browser Game`

**Ulepszenia:**
- Dynamiczne title tags dla różnych podstron (gdy będą)
- Dodanie brand name na końcu dla rozpoznawalności

---

### 6. Optymalizacja Meta Descriptions

**Status:** ✅ Dobry

**Aktualny:** Dobry opis, ale można dodać polską wersję

**Sugerowana polska wersja:**
```
Nieskończona tower defense z roguelike wyborami co falę, walkami PvP arena i wojnami gildii. Bez instalacji — graj natychmiast w przeglądarce. Strategiczne wybory reliktów, rankingi na żywo i idle progression.
```

**Ulepszenia:**
- Różne opisy dla różnych podstron (gdy będą)
- Dodanie call-to-action w opisie
- Optymalizacja długości (150-160 znaków)

---

### 7. Dodanie Breadcrumbs

**Status:** ⚠️ Brakuje (gdy będą podstrony)

**Implementacja:**
- HTML breadcrumbs w kodzie
- Schema.org BreadcrumbList markup

**Przykład:**
```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [{
    "@type": "ListItem",
    "position": 1,
    "name": "Strona główna",
    "item": "https://growfortress.com"
  }, {
    "@type": "ListItem",
    "position": 2,
    "name": "Poradniki",
    "item": "https://growfortress.com/guides"
  }]
}
```

---

### 8. Optymalizacja Obrazów

**Status:** ⚠️ Do sprawdzenia

**Akcje:**
- Dodanie `alt` tekstów do wszystkich obrazów
- Optymalizacja rozmiaru obrazów (WebP format)
- Dodanie `loading="lazy"` dla obrazów below-the-fold
- Utworzenie `image-sitemap.xml` dla ważnych obrazów

**Przykład:**
```html
<img 
  src="/screenshot.jpg" 
  alt="Grow Fortress - Tower Defense gameplay screenshot pokazujący twierdzę i wrogów"
  loading="lazy"
  width="1200"
  height="675"
/>
```

---

### 9. Optymalizacja Prędkości Ładowania

**Status:** ⚠️ Do sprawdzenia

**Metryki do monitorowania:**
- **LCP (Largest Contentful Paint):** < 2.5s
- **FID (First Input Delay):** < 100ms
- **CLS (Cumulative Layout Shift):** < 0.1
- **TTFB (Time to First Byte):** < 600ms

**Narzędzia:**
- Google PageSpeed Insights
- Lighthouse
- WebPageTest

**Optymalizacje:**
- Code splitting
- Lazy loading obrazów i komponentów
- Minifikacja CSS/JS
- CDN dla assetów statycznych
- Caching headers

---

### 10. Mobile-First Optimization

**Status:** ✅ Meta viewport jest ustawiony

**Sprawdzenie:**
- Responsywność na różnych urządzeniach
- Touch-friendly buttons (min. 44x44px)
- Mobile-friendly test: https://search.google.com/test/mobile-friendly

---

### 11. International SEO (hreflang)

**Status:** ⚠️ Do zaimplementowania

**Akcja:** Dodanie hreflang tags dla PL i EN wersji

**Implementacja w HTML:**
```html
<link rel="alternate" hreflang="pl" href="https://growfortress.com/?lang=pl" />
<link rel="alternate" hreflang="en" href="https://growfortress.com/?lang=en" />
<link rel="alternate" hreflang="x-default" href="https://growfortress.com/" />
```

---

### 12. Content Marketing dla SEO

**Status:** ⚠️ Do utworzenia

**Sugerowane strony/podstrony:**

1. **Blog/News** (`/blog` lub `/news`)
   - Artykuły o grze
   - Poradniki
   - Aktualizacje

2. **Poradniki** (`/guides`)
   - Przewodniki po mechanikach
   - Strategie PvP
   - Build guides

3. **FAQ** (`/faq`)
   - Często zadawane pytania
   - Troubleshooting

4. **O grze** (`/about`)
   - Opis gry
   - Historia rozwoju
   - Zespół

**Korzyści:**
- Więcej słów kluczowych do targetowania
- Dłuższy czas na stronie
- Wyższy ranking w Google
- Więcej backlinków

---

### 13. Link Building Strategy

**Status:** ⚠️ Do rozpoczęcia

**Strategia:**

1. **Portale gier przeglądarkowych:**
   - GryOnline.pl
   - GameJolt
   - Kongregate
   - itch.io
   - Newgrounds

2. **Współpraca z blogerami:**
   - Blogi o grach przeglądarkowych
   - Blogi o Tower Defense
   - Blogi o grach indie

3. **Wymiana linków:**
   - Inne gry przeglądarkowe
   - Developerzy gier indie

4. **Press releases:**
   - Portale technologiczne
   - Portale gier

---

### 14. Local SEO (Opcjonalnie)

**Status:** ⚠️ Jeśli relevant

**Jeśli firma chce być widoczna lokalnie:**
- Google Business Profile
- Lokalne katalogi
- Lokalne media

---

### 15. Analytics & Monitoring

**Status:** ⚠️ Do skonfigurowania

**Narzędzia:**
- **Google Analytics 4** - tracking ruchu
- **Google Search Console** - monitoring SEO
- **Bing Webmaster Tools** - dla Bing
- **Hotjar/Microsoft Clarity** - heatmaps

**Metryki do śledzenia:**
- Organiczny ruch (organic traffic)
- Pozycje słów kluczowych
- CTR z wyników wyszukiwania
- Bounce rate
- Czas na stronie
- Conversion rate (wizyty → rejestracje)

---

## 📊 Słowa Kluczowe do Targetowania

### Główne (High Priority)
- **PL:** "tower defense przeglądarka", "gry przeglądarkowe tower defense", "tower defense online"
- **EN:** "browser tower defense", "online tower defense", "web tower defense game"

### Długie frazy (Long-tail)
- **PL:** "darmowa gra tower defense przeglądarka", "tower defense z roguelike", "tower defense pvp przeglądarka"
- **EN:** "free browser tower defense", "roguelike tower defense browser", "tower defense pvp browser"

### Branded
- "Grow Fortress"
- "Grow Fortress gra"
- "Grow Fortress tower defense"

### Konkurencyjne analizy
- Sprawdź słowa kluczowe konkurentów (np. Bloons TD, Kingdom Rush)
- Użyj narzędzi: Ahrefs, SEMrush, Ubersuggest

---

## 🔧 Checklist Implementacji SEO

### Priorytet 1 (Natychmiast)
- [ ] Dodanie polskich meta tagów do `index.html`
- [ ] Utworzenie `sitemap.xml`
- [ ] Utworzenie `robots.txt`
- [ ] Konfiguracja Google Search Console
- [ ] Konfiguracja Google Analytics 4

### Priorytet 2 (Tydzień 1-2)
- [ ] Optymalizacja obrazów (alt texts, WebP)
- [ ] Dodanie hreflang tags
- [ ] Test prędkości ładowania (PageSpeed Insights)
- [ ] Mobile-friendly test

### Priorytet 3 (Miesiąc 1)
- [ ] Utworzenie bloga/podstron z contentem
- [ ] Utworzenie FAQ strony
- [ ] Rozpoczęcie link building
- [ ] Monitoring pozycji słów kluczowych

---

## 📈 Oczekiwane Rezultaty

### Po 1 miesiącu:
- Indeksacja w Google (wszystkie strony)
- Pierwsze pozycje dla branded keywords
- 50-100 organicznych wizyt/miesiąc

### Po 3 miesiącach:
- Pozycje w top 20 dla głównych słów kluczowych
- 200-500 organicznych wizyt/miesiąc
- Backlinks z 5-10 domen

### Po 6 miesiącach:
- Pozycje w top 10 dla głównych słów kluczowych
- 1000+ organicznych wizyt/miesiąc
- Backlinks z 20+ domen
- Wzrost brand awareness

---

## 🛠️ Narzędzia SEO

### Darmowe
- Google Search Console
- Google Analytics
- Google PageSpeed Insights
- Bing Webmaster Tools
- Ubersuggest (ograniczona wersja darmowa)

### Płatne (Opcjonalnie)
- Ahrefs ($99/miesiąc)
- SEMrush ($119/miesiąc)
- Moz Pro ($99/miesiąc)

---

## 📚 Zasoby Edukacyjne

- [Google SEO Starter Guide](https://developers.google.com/search/docs/beginner/seo-starter-guide)
- [Moz Beginner's Guide to SEO](https://moz.com/beginners-guide-to-seo)
- [Google Search Central Blog](https://developers.google.com/search/blog)

---

**Ostatnia aktualizacja:** 2026-01-28
