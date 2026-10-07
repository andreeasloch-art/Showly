# SHOWLY – Roadmap für Sichtbarkeit in Suche und KI-Suche

Ausgangslage (7. Oktober 2026): Die App ist fertig gebaut, aber **noch nicht veröffentlicht** (Entscheidung der Inhaberin: erst nach Zahlungssystem und Fertigstellung). showly.eu zeigt die Strato-Parkseite. Der Zeitplan zählt deshalb **ab dem Livegang (Tag 0)**. Alles, was vorher geht, ist vorbereitet.

Niemand kann eine Nennung in ChatGPT, Claude, Perplexity, Gemini oder Copilot garantieren. Ziel ist, Crawlbarkeit, Verständlichkeit, Autorität und Zitierfähigkeit so weit wie möglich zu erhöhen.

## Vor dem Livegang (erledigt in diesem Block)

- robots.txt mit KI-Suchbots, private Bereiche gesperrt
- Sitemap nur mit echten, indexierbaren Seiten; Beispielprofile `noindex`
- echte Profile serverseitig gerendert, mit Profil-Schema
- zentrale schema.org-Datei, Organization ohne erfundene Daten
- `/ueber-showly`, `/wie-funktioniert-showly` (DE/EN/ES), Hilfe mit FAQPage
- IndexNow vorbereitet, `/llms.txt`
- Markenbeschreibungen für externe Profile

## Entscheidungen der Inhaberin (offen)

1. **Livegang-Termin** (Voraussetzung für alles Weitere).
2. **KI-Training erlauben oder sperren?** GPTBot (OpenAI), ClaudeBot (Anthropic), Google-Extended (Gemini-Training), CCBot (Common Crawl) dürfen aktuell wie jeder andere Crawler alle öffentlichen Seiten lesen. Das ist getrennt von der KI-*Suche* (OAI-SearchBot, Claude-SearchBot, PerplexityBot), die ausdrücklich erlaubt ist. Sperren würde die Sichtbarkeit in KI-Suchen nicht verringern, kann aber langfristig beeinflussen, was Modelle „von sich aus“ über Showly wissen. Empfehlung: erlaubt lassen; die Inhalte sind Marketing- und Informationsseiten.
3. **Analytics-Werkzeug** (mit oder ohne Cookies) für AI-Referral-Tracking.
4. **Impressum mit echten Firmendaten** – Voraussetzung für vollständiges Organization-Schema, Google Business Profile und Presseprofile.
5. **App-Store-Name**: wegen der gleichnamigen Serien-App mit beschreibendem Zusatz einreichen.

## Phase 1 – Technische Grundlage (Tag 0–7)

| Aufgabe | Wer | Datei/Ort |
|---|---|---|
| Domain showly.eu in Lovable verbinden, HTTPS, www → ohne www (301) | Inhaberin | Lovable, Strato-DNS |
| `curl -I https://showly.eu/robots.txt`, `/sitemap.xml`, `/llms.txt` prüfen | Claude | – |
| Google Search Console einrichten, Sitemap einreichen | Inhaberin + Claude | `GOOGLE-SEARCH-CONSOLE-SETUP.md` |
| Bing Webmaster Tools, IndexNow-Schlüssel setzen | Inhaberin + Claude | `BING-WEBMASTER-SETUP.md` |
| Rich Results Test für Start, Über-Seite, Hilfe, erstes Profil | Claude | `SHOWLY-SCHEMA.md` |
| Cloudflare/WAF (falls genutzt): KI-Suchbots nicht blockieren; Allowlisting nur über veröffentlichte IP-Listen (openai.com/searchbot.json, claude.com/crawling/bots.json, perplexity.com/perplexitybot.json) | Inhaberin | – |

## Phase 2 – Entity (Tag 7–21)

- Externe Profile anlegen bzw. angleichen mit den Texten aus `SHOWLY-BRAND-DESCRIPTION.md`: LinkedIn-Unternehmensseite, YouTube, Instagram/Facebook/TikTok/X-Bio, Crunchbase.
- Neue Profile in `SOCIAL_PROFILES` (seo.ts) aufnehmen → landen automatisch im `sameAs`.
- Impressum echt → Organization-Schema ergänzen (`SHOWLY-SCHEMA.md`).
- Google Business Profile **nur**, wenn es eine Anschrift mit Kundenkontakt gibt (sonst nicht zulässig).
- Wikipedia/Wikidata: **nicht anlegen**. Showly erfüllt die Relevanzkriterien derzeit nicht (keine unabhängigen Quellen). Erst nach echter Presseberichterstattung neu prüfen.

## Phase 3 – Kommerzielle Seiten (ab ~20 echten Profilen)

- Kategorieseiten nur für Sparten mit echten Profilen (`SHOWLY-CONTENT-MAP.csv`, Spalte „Voraussetzung“). Reihenfolge nach Nachfrage und Angebot, voraussichtlich: Zauberer, DJ, Kinderunterhaltung/Märchenfiguren, Band, Musiker.
- Anlass-Seiten (Hochzeit, Firmenfeier, Kindergeburtstag, Weihnachtsfeier) mit echten Profilen und eigenem Text.
- Keine Stadt-Seiten („DJ Berlin“), solange es dort nicht mehrere echte Profile gibt.
- Profilqualität: Künstler im Portal anleiten (Beschreibung ≥ 160 Zeichen, Fotos, Einsatzgebiet, Pakete) – nur solche Profile werden indexiert.

## Phase 4 – Ratgeber (ab Woche 6)

Zehn Ratgeber aus der Content-Map, je Woche einer. Jede Seite beginnt mit einer direkten Antwort in 50–100 Wörtern; Preisangaben nur aus echten Showly-Daten (z. B. Spanne der Profilpreise einer Sparte) oder mit Quelle.

## Phase 5 – Externe Autorität (laufend ab Woche 4)

- Künstler-Websites: Badge „Buchbar über Showly“ mit Link aufs eigene Profil (Badge-Grafik und HTML-Schnipsel bauen).
- Digital PR: 20 Story-Ideen in `SHOWLY-COMPETITOR-GAP.md`, Abschnitt PR.
- Echte Bewertungen: Bewerten kann nur, wer wirklich gebucht hat und dessen Termin vorbei ist (bereits so gebaut). Neu zu bauen: eine Bewertungs-Erinnerung per Mail nach jedem Event mit Check-in im täglichen Lauf. Keine gekauften oder erfundenen Bewertungen.

## Phase 6 – Monitoring (monatlich ab Tag 30)

- `AI-VISIBILITY-BENCHMARK.csv`: 100 Fragen, monatlich von Hand in ChatGPT, Claude, Perplexity, Gemini, Copilot prüfen (keine automatisierten Abfragen gegen deren Nutzungsbedingungen).
- Bing Webmaster Tools → AI Performance (Zitate, Grounding Queries), Werte monatlich in `AI-VISIBILITY-REPORT.md`.
- Search Console: Klicks, Impressionen, indexierte Seiten.
- Brand Accuracy: Aussagen der KI-Systeme über Showly als CORRECT / OUTDATED / INCORRECT / MISSING einordnen.
