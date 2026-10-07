# Strukturierte Daten (schema.org) bei Showly

Alle JSON-LD-Blöcke entstehen in **`src/showly/schema.ts`**. Keine Seite baut eigene Organisationsdaten; so beschreibt jede Seite Showly gleich.

## Was wo ausgegeben wird

| Seite | Typen | Quelle |
|---|---|---|
| jede Seite (`__root.tsx`) | `Organization`, `WebSite` | `siteGraph(lang)` |
| `/ueber-showly` | `AboutPage` (about/mainEntity → Organization), `BreadcrumbList` | `aboutGraph` |
| `/wie-funktioniert-showly` | `WebPage`, `BreadcrumbList` | `pageGraph` |
| `/hilfe` | `FAQPage` mit allen sichtbaren Fragen, `BreadcrumbList` | `faqGraph` |
| `/kuenstler/:id` (nur echte, gepflegte Profile) | `ProfilePage` → `Person` bzw. `PerformingGroup` (Band), `Service` mit `Offer` (Preis in EUR, broker = Showly), `BreadcrumbList`, `AggregateRating` **nur bei echten Bewertungen** | `artistGraph` |

Beispielprofile und dünne Profile bekommen **kein** Schema und `noindex, follow`.

## Organization – was drin ist und was bewusst fehlt

Drin: `name` „Showly“, `alternateName` („Showly – Künstler & Entertainment buchen“, „Showly – Artist & Entertainment Booking Platform“, „SHOWLY“), `url`, `logo` (512 × 512), `image`, `description` (Definition je Sprache), `sameAs` (Instagram, Facebook, TikTok, X), `contactPoint` (Kundensupport über `/hilfe`, Deutsch/Englisch/Spanisch).

Bewusst nicht drin, bis es echte Angaben gibt: `address`, `founder`, `foundingDate`, `numberOfEmployees`, `telephone`, `email`, `areaServed`. Grund: Das Impressum enthält noch „Muster“-Platzhalter. **Sobald das Impressum echt ist**, in `organization()` ergänzen:

```ts
legalName: "…",            // laut Handelsregister
address: { "@type": "PostalAddress", streetAddress: "…", postalCode: "…", addressLocality: "…", addressCountry: "DE" },
email: "kontakt@showly.eu", // erst wenn das Postfach eingerichtet ist
```

Und neue Profile (LinkedIn, App Store, Google Play, Crunchbase) in `SOCIAL_PROFILES` in `src/showly/seo.ts` aufnehmen.

## Regeln

- Nur Angaben, die auf der Seite sichtbar und wahr sind.
- Keine Bewertungssterne ohne echte Bewertungen (Google-Richtlinie, UWG).
- Keine `HowTo`-Auszeichnung (Google zeigt sie nicht mehr an) und kein `SoftwareApplication`, solange es keine App in den Stores gibt.
- FAQ-Schema nur für Fragen, die auf derselben Seite vollständig im HTML stehen.

## Prüfen

- Unit-Tests: `src/showly/schema.test.ts`.
- Nach Livegang: https://search.google.com/test/rich-results und https://validator.schema.org mit `https://showly.eu/`, `/ueber-showly`, `/hilfe` und einem echten Profil.
