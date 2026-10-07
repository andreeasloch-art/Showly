# Bing Webmaster Tools und IndexNow für showly.eu

**EXTERNER ZUGRIFF ERFORDERLICH** – erst nach dem Livegang. Bing liefert auch die Ergebnisse für Microsoft Copilot; IndexNow wird außerdem von Yandex, Seznam und Naver genutzt. Google nutzt IndexNow nicht.

## 1. Website hinzufügen

1. https://www.bing.com/webmasters öffnen.
2. Am schnellsten: „Aus Google Search Console importieren“ (wenn die Search Console schon eingerichtet ist). Sonst `https://showly.eu` hinzufügen und per Meta-Tag bestätigen: den Wert aus `content="…"` in Lovable unter Secrets als `VITE_BING_SITE_VERIFICATION` eintragen und neu veröffentlichen.
3. Sitemap `https://showly.eu/sitemap.xml` einreichen.

## 2. IndexNow einschalten

1. Einen Schlüssel erzeugen, z. B. im Terminal `openssl rand -hex 16` (32 Zeichen, nur 0–9 und a–f).
2. In Lovable unter Secrets: `INDEXNOW_KEY` = dieser Schlüssel. Neu veröffentlichen.
3. Prüfen: `https://showly.eu/indexnow-key.txt` zeigt genau den Schlüssel.
4. Ab dann meldet Showly automatisch (`src/lib/indexnow.server.ts`):
   - wenn ein Künstler die Ausweisprüfung besteht und sein Profil live geht,
   - wenn die Verwaltung ein Profil freischaltet, verbirgt oder sperrt.
   Gemeldet werden alle drei Sprachfassungen. Antwort 200 oder 202 = angenommen.
5. In Bing Webmaster Tools unter „IndexNow“ erscheinen die gemeldeten Adressen.

## 3. Monatlich prüfen

- Suchleistung: Klicks, Impressionen.
- **AI Performance** (sofern im Konto verfügbar): Zitate in Copilot/Bing-Antworten, zitierte Seiten, Grounding Queries, Themen. Werte in `AI-VISIBILITY-REPORT.md` übertragen.
- Crawl-Fehler, blockierte URLs (nur private Bereiche dürfen auftauchen).
