# SHOWLY – AI-Visibility- und SEO-Audit

Stand: 7. Oktober 2026 · Grundlage: Repository `andreeasloch-art/showly`, lokaler Server-Render (`vite dev`), Abruf von showly.eu, offizielle Crawler-Dokumentationen von OpenAI, Anthropic, Perplexity, Google und IndexNow.

**Wichtigster Befund:** Die öffentliche Domain **showly.eu ist noch nicht live**. Sie zeigt die Strato-Seite „Domain reserved“. HTTPS liefert einen TLS-Fehler (`tlsv1 alert internal error`). Das ist eine bewusste Entscheidung der Inhaberin: Die Seite geht erst nach Zahlungssystem und Fertigstellung online. Bis dahin kann keine Suchmaschine und keine KI Showly finden. Alle übrigen Punkte bereiten den Start vor, damit Showly ab dem ersten Tag sauber erfasst wird.

Prioritäten: **P0** kritisch · **P1** hoch · **P2** mittel · **P3** später
Status: ✅ umgesetzt und getestet · 🔧 vorbereitet, wartet auf Livegang/Zugang · ⏳ offen · 🔒 EXTERNER ZUGRIFF ERFORDERLICH

## 1. Domain, Erreichbarkeit, Server

| # | Befund | Prio | Erwarteter Effekt | Umsetzung | Status |
|---|---|---|---|---|---|
| 1.1 | showly.eu zeigt Strato-Parkseite, keine App | P0 | Ohne Livegang keine Indexierung | App in Lovable veröffentlichen und Domain verbinden, **erst nach Freigabe durch die Inhaberin** | 🔒 Entscheidung |
| 1.2 | HTTPS auf showly.eu und www.showly.eu: TLS-Fehler | P0 | Google und KI-Crawler brechen ab | Beim Verbinden der Domain mit Lovable stellt Lovable das Zertifikat aus; DNS bei Strato (A/CNAME laut Lovable) | 🔒 Strato/Lovable |
| 1.3 | www und ohne www: noch keine Weiterleitung | P1 | Doppelte Inhalte, geteilte Signale | Kanonisch ist `https://showly.eu` (seo.ts `SITE`). www per 301 auf showly.eu leiten (Lovable Domain-Einstellung „Redirect www“) | 🔒 Lovable |
| 1.4 | http → https | P1 | Sicherheit, ein kanonischer Host | Mit Zertifikat automatisch; nach Livegang prüfen | 🔧 |
| 1.5 | Server-Rendering (SSR) | ✅ | Crawler ohne JavaScript sehen Inhalt | TanStack Start rendert Titel, Text, Links und JSON-LD auf dem Server. Geprüft per `curl` | ✅ |

## 2. Crawling und Indexierung

| # | Befund | Prio | Erwarteter Effekt | Umsetzung | Status |
|---|---|---|---|---|---|
| 2.1 | robots.txt ohne ausdrückliche Regeln für KI-Suchbots | P1 | Klarheit für OAI-SearchBot, Claude-SearchBot, Claude-User, PerplexityBot, Googlebot, Bingbot | Eigene Gruppe mit `Allow: /` und denselben Sperren für private Bereiche (`src/routes/robots[.]txt.ts`). Trainings-Crawler (GPTBot, ClaudeBot, Google-Extended) bewusst **unverändert** | ✅ |
| 2.2 | Private Bereiche | ✅ | Kein Konto/Kasse im Index | `/admin /dashboard /portal /konto /anmelden /checkout /passwort- /auth/ /api/` in jeder Gruppe gesperrt; zusätzlich `noindex` auf Kasse, Passwort, Verwaltung | ✅ |
| 2.3 | **Sitemap führte 29 Beispielprofile** (erfundene Acts) | P0 | Google hätte Seiten ohne echtes Angebot indexiert („thin/misleading content“) | Beispielprofile und Beispiel-Bäcker raus aus der Sitemap; echte, veröffentlichte Profile aus der Datenbank rein, mit `lastmod` | ✅ |
| 2.4 | **Beispielprofile ohne noindex** | P0 | Wie 2.3 | `noindex, follow` auf allen Beispielprofilen (`/kuenstler/1–29`, Beispiel-Bäcker) | ✅ |
| 2.5 | **Echte Künstlerprofile wurden nur im Browser geladen** | P0 | Crawler sahen „Profil nicht gefunden“ und einen allgemeinen Titel | Profil wird beim Rendern auf dem Server geladen (`loader` + `utils/seo.functions.ts`), eigener Titel, Beschreibung, JSON-LD | ✅ (ohne echte Profile in der DB nur per Test geprüft) |
| 2.6 | Dünne echte Profile | P1 | Thin Content | Profile mit < 160 Zeichen Beschreibung oder ohne Foto: `noindex` und nicht in der Sitemap (`profileIndexable`) | ✅ |
| 2.7 | Sitemap ohne `lastmod` | P2 | Schnellere Neuerfassung | `lastmod` aus `updated_at` für Profile; statische Seiten ohne erfundenes Datum | ✅ |
| 2.8 | IndexNow fehlte | P1 | Bing/Copilot erfassen neue Profile in Minuten | `lib/indexnow.server.ts`, Schlüssel unter `/indexnow-key.txt`, Meldung bei Freischaltung (Ausweisprüfung, Verwaltung) | 🔧 Schlüssel `INDEXNOW_KEY` setzen |
| 2.9 | Hilfe-Seite ohne Canonical/hreflang, FAQ-Antworten nur beim Aufklappen im HTML | P1 | Fragen nicht zitierfähig | `seoHead` + `FAQPage`; alle Antworten stehen im HTML (zugeklappte nur ausgeblendet) | ✅ |
| 2.10 | `/top-act` ohne Canonical/hreflang | P3 | gering (Verkaufsseite für Künstler) | später auf `seoHead` umstellen | ⏳ |
| 2.11 | Filter-/Suchadressen | ✅ | keine Duplikate | Suche läuft ohne eigene URLs; nur `?lang=` erzeugt Varianten, jeweils mit eigenem Canonical | ✅ |
| 2.12 | 404 | P2 | Soft-404 | Unbekannte Profil-IDs liefern Status 200 mit Hinweis und `noindex`. Echte 404 wäre besser | ⏳ |

## 3. Metadaten und Inhalt

| # | Befund | Prio | Erwarteter Effekt | Umsetzung | Status |
|---|---|---|---|---|---|
| 3.1 | Titel/Beschreibung je Route und Sprache | ✅ | | `src/showly/seo.ts`, DE/EN/ES | ✅ |
| 3.2 | Profilseiten hatten alle denselben Titel | P1 | Profile austauschbar | Titel „Name – Sparte buchen \| Showly“, Beschreibung aus dem Profiltext, `og:type=profile` | ✅ |
| 3.3 | Keine Seite, die erklärt, **was Showly ist** | P0 | KI-Systeme können die Marke nicht einordnen | `/ueber-showly` (DE/EN/ES) mit Definition im ersten Absatz, Zielgruppen, Ablauf, Konditionen, Abgrenzung zur gleichnamigen Serien-App | ✅ |
| 3.4 | Kein erklärter Ablauf | P1 | Antworten auf „Wie funktioniert …“ | `/wie-funktioniert-showly` (DE/EN/ES) | ✅ |
| 3.5 | Fußzeile: „Über uns“, „Jobs“, „Presse“ ohne Link | P2 | tote Einträge | „Über uns“ verlinkt jetzt `/ueber-showly`; „So funktioniert's“ ergänzt. Jobs/Presse erst mit Inhalt | ✅ / ⏳ |
| 3.6 | Keine Kategorie- und Anlass-Landingpages | P1 | Category Visibility („Zauberer buchen“) | Architektur in `SHOWLY-CONTENT-MAP.csv`; Umsetzung erst, wenn echte Profile je Sparte da sind (sonst Doorway Pages) | ⏳ |
| 3.7 | Keine Ratgeber | P2 | Informationsanfragen | 10 Ratgeber geplant (Content-Map); keine erfundenen Preise, Zahlen nur mit Quelle | ⏳ |
| 3.8 | Startseiten-H1 aus mehreren Spans | ✅ | | geprüft, wird gerendert | ✅ |
| 3.9 | Bild-Alt-Texte | P2 | Bildsuche, Barrierefreiheit | Profilbilder sind CSS-Hintergründe ohne Alt. Für echte Profile `<img alt>` einführen | ⏳ |

## 4. Strukturierte Daten

| # | Befund | Prio | Erwarteter Effekt | Umsetzung | Status |
|---|---|---|---|---|---|
| 4.1 | Organization ohne Beschreibung und Kontakt | P1 | Entity-Klarheit | Zentrale Datei `src/showly/schema.ts`: Name, alternateName (beschreibend), Logo, Beschreibung, sameAs, ContactPoint (Hilfe-Seite, 3 Sprachen) | ✅ |
| 4.2 | Keine erfundenen Firmendaten | ✅ | Vertrauen | Gründer, Adresse, Gründungsjahr fehlen bewusst, weil das Impressum noch „Muster“-Angaben hat | ✅ |
| 4.3 | Profile ohne Schema | P1 | Rich Results, KI-Verständnis | `ProfilePage` + `Person`/`PerformingGroup` + `Service` + `Offer` + `BreadcrumbList`; Bewertungen nur bei echten | ✅ |
| 4.4 | FAQ / About / WebPage | P1 | | `FAQPage` (Hilfe), `AboutPage`, `WebPage`, `BreadcrumbList` | ✅ |
| 4.5 | Validierung | P1 | | JSON-Parsing aller Seiten geprüft, Unit-Tests `schema.test.ts`. Google Rich Results Test erst nach Livegang | 🔧 |

## 5. Sprache und hreflang

| # | Befund | Prio | Umsetzung | Status |
|---|---|---|---|---|
| 5.1 | DE (Standard), EN, ES unter `?lang=` mit selbstreferenzierendem Canonical, hreflang und x-default | ✅ | Bestand, getestet | ✅ |
| 5.2 | Server rendert die Sprache aus `?lang` | ✅ | Bestand | ✅ |
| 5.3 | Bots bekommen Deutsch, solange kein `?lang` | ✅ | richtig, damit jede Fassung eine eigene URL hat | ✅ |

## 6. Leistung, Mobil, Barrierefreiheit

| # | Befund | Prio | Umsetzung | Status |
|---|---|---|---|---|
| 6.1 | Core Web Vitals nicht messbar, solange die Seite nicht live ist | P1 | Nach Livegang PageSpeed Insights / Search Console | 🔧 |
| 6.2 | Startvideo (3 MB) beim ersten Aufruf | P2 | Lädt erst nach dem Standbild; prüfen, ob es Crawler-Rendering verzögert (LCP) | ⏳ |
| 6.3 | Mobil | ✅ | Handy-Layout geprüft (Screenshots) | ✅ |
| 6.4 | Barrierefreiheit (BFSG) | ✅ | Bestand; Brotkrumen mit `role=navigation` | ✅ |

## 7. Entity und Marke

| # | Befund | Prio | Umsetzung | Status |
|---|---|---|---|---|
| 7.1 | **Namensgleichheit**: „Showly: Track Shows & Movies“ (Trakt, App Store & Google Play, Open Source) dominiert Suchergebnisse zu „Showly app“. Dazu ähnliche Namen: Shoply (Marktplatz, AU/UK), Showbird (Künstler-Marktplatz NL/BE) | P0 | Beschreibender Zusatz „Showly – Künstler & Entertainment buchen“ in Schema, Texten und Profilen; Abgrenzung auf `/ueber-showly` und in `/llms.txt` | ✅ / 🔒 externe Profile |
| 7.2 | App-Store-Name | P1 | Beim Einreichen nicht nur „Showly“, sondern „Showly – Künstler buchen“ o. ä. verwenden | 🔒 |
| 7.3 | Social-Profile verlinkt (sameAs) | ✅ | Instagram, Facebook, TikTok, X | ✅ |
| 7.4 | Externe Profile (LinkedIn, Branchenverzeichnisse) | P1 | Texte in `SHOWLY-BRAND-DESCRIPTION.md` | 🔒 |

## 8. Tracking

| # | Befund | Prio | Umsetzung | Status |
|---|---|---|---|---|
| 8.1 | Kein Analytics-Werkzeug | P1 | Entscheidung nötig: datenschutzfreundliches Werkzeug (z. B. ohne Cookies) oder GA4 mit Einwilligung. AI-Referrals (chatgpt.com, perplexity.ai, claude.ai, copilot.microsoft.com, gemini.google.com) dann als eigener Kanal | 🔒 Entscheidung |
| 8.2 | Search Console / Bing Webmaster | P0 nach Livegang | Anleitungen `GOOGLE-SEARCH-CONSOLE-SETUP.md`, `BING-WEBMASTER-SETUP.md`; Verifizierungs-Tags im Code vorbereitet | 🔒 |

## Tests dieses Arbeitsblocks

- `vitest`: 197 Tests grün, darunter neu: robots.txt (KI-Bots dürfen, private Bereiche gesperrt, Trainings-Crawler unverändert), Sitemap ohne Beispielprofile, mit `lastmod`, Schema (keine erfundenen Bewertungen/Firmendaten, Band → PerformingGroup, dünne Profile noindex).
- Server-Render per `curl`: `/ueber-showly`, `/wie-funktioniert-showly?lang=en`, `/ueber-showly?lang=es`, `/hilfe` → Status 200, eigener Titel, Canonical, H1, gültiges JSON-LD. `/kuenstler/1` und `/torten/1` → `noindex, follow`. `/sitemap.xml` ohne Beispielprofile. `/llms.txt` 200. `/indexnow-key.txt` 404 ohne Schlüssel (richtig).
- Handy-Darstellung (390 px) der neuen Seiten per Screenshot.
- Nicht testbar, solange nicht live: echte Domain, HTTPS, Search Console, Bing, Rich Results Test, Core Web Vitals, echte Profile aus der Datenbank.
