# Lokales SEO, Adressen, Teilen

Stand: 9. Oktober 2026

## Was im Code steckt

| Punkt | Umsetzung |
|---|---|
| Serverseitiges Rendering | TanStack Start rendert jede Seite auf dem Server. Profile (Künstler und Konditoreien) und Stadtseiten laden ihre Daten im `loader`, also steht der Text schon im HTML. |
| Lokale Landingpages | `/buchen/<leistung>/<stadt>`, z. B. `/buchen/zauberer/berlin`, `/buchen/motivtorte/muenchen`. 22 Leistungen × 16 Städte. Texte je Leistung in `src/showly/landing.ts`, Stadtteil aus echten Profilen (Anzahl, Preisspanne, Bewertungen, Nachbarstädte). Übersicht: `/buchen`. |
| Schutz vor leeren Seiten | Eine Stadtseite kommt erst mit mindestens 3 echten Anbietern (`MIN_INDEX`) in den Index und in die Sitemap, vorher `noindex, follow`. Beispielprofile zählen nie. |
| Sprechende URLs | Künstler: `/kuenstler/<stadt>/<kategorie>/<name>-<id>` (`src/showly/slugs.ts`). Alte Adresse `/kuenstler/<id>` und veraltete Teile (Umzug, neuer Name) leiten mit 301 weiter. |
| Strukturierte Daten | Organization, WebSite, ProfilePage, Person/PerformingGroup, Service, Offer, AggregateRating (nur echte), Bakery/Person mit Product + Offer je Angebot, CollectionPage + ItemList (Stadtseiten), Article (Ratgeber), BreadcrumbList, FAQPage. |
| Title, Description, Canonical | Pro Seite; Profile mit Name, Sparte und Ort. Canonical immer auf die sprechende Adresse. |
| Sitemap, robots.txt | `/sitemap.xml` mit echten Profilen, Konditoreien mit Angeboten, Stadtseiten über der Schwelle, Ratgeber. `/robots.txt` sperrt Konto, Kasse, Verwaltung. |
| Filterseiten | Filter laufen ohne eigene Adressen; Parameter wie `?bereich=deko` haben ein Canonical auf die Seite ohne Parameter. |
| Gelöschte Profile | Server antwortet mit 404 (Künstler und Konditoreien), damit sie aus dem Index fallen. |
| Open Graph | Profile teilen ihr erstes freigegebenes Foto (`/api/bild/kuenstler/<id>`, `/api/bild/torten/<id>`), sonst das Showly-Bild. |
| Bilder | Alle Katalogbilder als WebP; Eigene Fotos werden beim Hochladen auf höchstens 1600 px verkleinert. |
| Ratgeber | `/ratgeber` mit 4 Artikeln (`src/showly/guides.ts`), verlinkt auf passende Stadtseiten. |

## Was du selbst machen musst (nach dem Livegang)

1. **Google Search Console** einrichten und Sitemap einreichen (Anleitung: `GOOGLE-SEARCH-CONSOLE-SETUP.md`).
2. **Google Business Profile**: Erst sinnvoll, wenn das Impressum echte Firmendaten hat. Als „Online-Dienst ohne Ladengeschäft“ anlegen (Adresse ausblenden), Kategorie z. B. „Künstleragentur“ oder „Eventplanung“, Website-Link auf die Startseite. Keine erfundenen Standorte anlegen.
3. **Bewertungen fördern**: Showly schickt nach jedem Termin automatisch eine Bewertungsanfrage per E-Mail. Für das Google-Profil zusätzlich zufriedene Kunden um eine Bewertung bitten; keine Bewertungen kaufen oder gegen Rabatt tauschen (verboten nach UWG und Google-Richtlinien).
4. **CDN**: Kommt mit dem Hosting (Cloudflare). Nichts weiter nötig.
5. **Weitere Städte**: In `CITIES` in `src/showly/landing.ts` ergänzen (Name, Region, Koordinaten). Die Seiten entstehen automatisch.
6. **Weitere Ratgeber**: In `GUIDES` in `src/showly/guides.ts` anhängen.

## Bewusst nicht gemacht

- **Event-Schema**: Gehört zu öffentlichen Veranstaltungen mit Datum und Ort. Gebuchte private Feiern sind keine; falsches Markup kann zu einer manuellen Maßnahme von Google führen.
- **Stadtseiten für Kostüme und Deko**: Werden verschickt, ein Ortsbezug wäre künstlich.
- **410 statt 404**: Die Router-Bibliothek setzt bei „nicht gefunden“ 404. Für Google ist das gleichwertig, die Seite fällt in beiden Fällen aus dem Index.
