# Google Search Console für showly.eu einrichten

**EXTERNER ZUGRIFF ERFORDERLICH** – Claude hat keinen Zugang zur Search Console und zum Strato-DNS. Erst nach dem Livegang sinnvoll (vorher sieht Google nur die Strato-Parkseite).

## 1. Property anlegen (Domain-Property, empfohlen)

1. https://search.google.com/search-console öffnen, mit dem Google-Konto von Showly anmelden.
2. „Property hinzufügen“ → **Domain** → `showly.eu` eingeben.
3. Google zeigt einen TXT-Eintrag wie `google-site-verification=abc123…`. Kopieren.
4. Bei Strato: Domainverwaltung → showly.eu → DNS → **TXT-Record** für `@` (die Domain selbst) mit genau diesem Wert anlegen.
5. 10–60 Minuten warten, dann in der Search Console „Bestätigen“.

Alternative (URL-Präfix-Property `https://showly.eu/`, Methode „HTML-Tag“): nur den Wert aus `content="…"` in Lovable unter Secrets als `VITE_GOOGLE_SITE_VERIFICATION` eintragen und neu veröffentlichen. Der Code gibt das Meta-Tag dann automatisch aus (`src/routes/__root.tsx`).

## 2. Sitemap einreichen

Search Console → Sitemaps → `https://showly.eu/sitemap.xml` → Senden. Erwartet: Status „Erfolgreich“, etwa 14 URLs plus je ein Eintrag pro echtem, gepflegtem Künstlerprofil.

## 3. Prüfen in der ersten Woche

| Bericht | Was soll stehen |
|---|---|
| URL-Prüfung `https://showly.eu/` | „URL ist auf Google“ bzw. „Indexierung beantragen“ |
| URL-Prüfung `/ueber-showly` | gerenderter HTML-Code enthält „Was ist Showly?“ |
| Seiten → Nicht indexiert | Beispielprofile `/kuenstler/1–29` unter „Durch noindex-Tag ausgeschlossen“ – **gewollt** |
| Seiten → Durch robots.txt blockiert | nur `/dashboard`, `/konto`, `/checkout` usw. – gewollt |
| Core Web Vitals | nach einigen Wochen Daten |
| Verbesserungen | Breadcrumbs, FAQ ohne Fehler |

## 4. Monatlich festhalten (in AI-VISIBILITY-REPORT.md)

Klicks, Impressionen, durchschnittliche Position, Anzahl indexierter Seiten, Top-Suchanfragen mit „showly“ und ohne (Category Visibility).
