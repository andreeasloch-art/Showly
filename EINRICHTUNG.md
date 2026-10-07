# Showly: Datenbank, Anmeldung und Ausweisprüfung einrichten

Diese Anleitung führt einmal durch alles, was von Hand zu tun ist. Danach läuft
die Anmeldung über Google, E-Mail oder Telefon, und Künstler können sich
ausweisen.

Solange die Schlüssel fehlen, läuft Showly wie bisher im örtlichen
Übungsbetrieb weiter. Es geht also nichts kaputt, wenn du zwischendrin aufhörst.

---

## 1. Supabase-Projekt anlegen

1. Auf **supabase.com** ein kostenloses Projekt anlegen, Region Frankfurt.
2. Im Projekt auf **SQL Editor** gehen, den Inhalt von
   `supabase/migrations/0001_showly_grundlage.sql` einfügen und ausführen.
   Danach genauso `supabase/migrations/0002_anfragen_konto_meldungen.sql`
   , `supabase/migrations/0003_buchungsablauf_geld.sql` und
   `supabase/migrations/0004_chat_admin_anbieter_support.sql`. Damit stehen alle
   Tabellen und die Zugriffsregeln: Buchungen mit Anfrage, Absage und
   Check-in, Vertragsstrafen, Gutscheine, Auszahlungen, Torten-Anfragen,
   Shop-Bestellungen, das Löschen von Konten und Meldungen.

   **Lovable Cloud:** Im Lovable-Projekt „Showly“ sind alle vier Teile
   bereits eingespielt (Stand 26.09.2026). Dort ist nichts mehr zu tun.

   **Neu: Fotos und Videos mit Freigabe** (`supabase/migrations/0007_medien_pruefung.sql`).
   In Lovable Cloud ist sie eingespielt (Stand 03.10.2026, ebenso 0005 und
   0006); in einem neuen Projekt im SQL Editor ausführen. Die Datei legt den privaten Speicher „medien“ an, die
   Tabelle `media` mit den Zugriffsregeln und die Galerie-Spalte bei den
   Künstlern. Danach erscheint in der Verwaltung (`/admin`) der Reiter
   „Fotos & Videos“: Jede neue Datei wartet dort, bis jemand aus dem Team
   sie freigibt oder mit Grund ablehnt. Die Person bekommt eine Mail
   (wenn der Mail-Dienst eingerichtet ist, Abschnitt 4).
3. Unter **Project Settings → API** drei Werte abholen und in die Datei `.env`
   eintragen, Vorlage ist `.env.example`:
   - Project URL → `VITE_SUPABASE_URL`
   - anon public → `VITE_SUPABASE_ANON_KEY`
   - service_role → `SUPABASE_SERVICE_ROLE_KEY`

Der dritte Schlüssel umgeht sämtliche Zugriffsregeln. Er gehört ausschließlich
auf den Server und niemals in ein Repository.

---

## 2. Anmeldung mit Google

1. In der **Google Cloud Console** ein Projekt anlegen, dann
   *APIs & Services → Credentials → OAuth client ID*, Typ Webanwendung.
2. Als erlaubte Weiterleitung eintragen:
   `https://<deinprojekt>.supabase.co/auth/v1/callback`
3. Die erhaltene Client-ID und das Client-Geheimnis in Supabase unter
   **Authentication → Providers → Google** eintragen und einschalten.

## 2b. Mit Apple anmelden

Pflicht, sobald die App im App Store steht und „Mit Google anmelden“
anbietet (Apple-Richtlinie 4.8).

1. Im **Apple Developer**-Konto unter *Certificates, Identifiers & Profiles*
   eine **Services ID** anlegen (z. B. `com.showly.app.signin`) und
   *Sign in with Apple* aktivieren.
2. Als Domain die Supabase-Adresse eintragen, als Return-URL
   `https://<deinprojekt>.supabase.co/auth/v1/callback`.
3. Unter *Keys* einen Schlüssel mit *Sign in with Apple* erzeugen und die
   `.p8`-Datei herunterladen (geht nur einmal).
4. In Supabase unter **Authentication → Providers → Apple** Services ID,
   Team-ID, Key-ID und den Inhalt der `.p8`-Datei eintragen und einschalten.

Der Knopf „Mit Apple anmelden“ steht schon auf der Seite `/anmelden`.

## 3. Anmeldung per E-Mail

In Supabase unter **Authentication → Providers → Email** die Option
*Confirm email* aktivieren. Für den Versand reicht zum Testen der eingebaute
Dienst. Für den Echtbetrieb dort einen eigenen SMTP-Zugang hinterlegen, sonst
gilt ein niedriges Sendelimit.

## 3b. Passwort vergessen

1. Supabase → **Authentication → URL Configuration**: unter **Redirect URLs**
   `https://DEINE-DOMAIN/auth/rueckkehr*` eintragen (auch die Vorschau-Adresse
   von Lovable). Ohne diesen Eintrag landet der Link aus der E-Mail auf der
   Startseite statt bei „Neues Passwort“.
2. **Authentication → Email Templates → Reset Password**: Betreff
   „Dein neues Passwort für Showly“, Inhalt aus
   `supabase/templates/passwort-zuruecksetzen.html` einfügen.
3. **Authentication → Providers → Email**: „Secure password change“ und eine
   Mindestlänge von 8 Zeichen einstellen; „Leaked password protection“
   einschalten, falls verfügbar.
4. Für zuverlässige Zustellung eigenen SMTP-Versand einrichten (etwa Resend
   mit der Showly-Domain). Der eingebaute Versand von Supabase schickt nur
   wenige Mails pro Stunde.

Ablauf: /passwort-vergessen → E-Mail → /auth/rueckkehr → /passwort-neu. Die
Seite antwortet immer gleich, egal ob es die Adresse gibt. Nach dem Speichern
werden alle anderen Sitzungen abgemeldet.

## 4. Anmeldung per Telefon (SMS-Code mit Kostenbremse)

Showly verschickt SMS-Codes über **Twilio Verify**, über den eigenen Server
und mit eingebauter Kostenbremse (`src/lib/sms.server.ts`):

- nur echte Handynummern; Festnetz-, Sonder- (0900), Premium- und
  Satellitennummern bekommen keine SMS
- nur Länder auf der Liste: Deutschland, Österreich, Schweiz, Liechtenstein,
  Luxemburg, Spanien, Andorra, spanischsprachiges Amerika, Großbritannien,
  Irland, USA, Kanada, Australien und Neuseeland. Weitere Länder in Lovable
  unter Secrets als `SMS_EXTRA_COUNTRIES` freischalten, z. B. `FR,IT,NL`.
  Für sie gelten strengere Tageslimits. Alle anderen melden sich kostenlos
  per E-Mail, Google oder Apple an.
- je Nummer höchstens 3 Codes pro Stunde und 5 pro Tag, je Internetadresse
  5 pro Stunde und 15 pro Tag, 5 Prüfversuche pro Stunde
- je Land und Tag höchstens 150 (`SMS_COUNTRY_DAILY_LIMIT`), für
  zusätzlich freigeschaltete Länder 25
- insgesamt höchstens 300 SMS pro Tag (`SMS_DAILY_LIMIT`). Bei rund
  8 Cent sind das höchstens etwa 24 € am Tag, auch bei einem Angriff.
- Schlägt die Zählung fehl, geht im Zweifel keine SMS raus.

Einrichtung:

1. Auf twilio.com ein Konto anlegen, Guthaben aufladen (z. B. 20 €) und
   **Auto-Recharge ausschalten**, damit nie mehr abgebucht wird, als du
   aufgeladen hast.
2. In der Twilio-Konsole unter **Verify → Services** einen Dienst „Showly“
   anlegen, Kanal SMS. Dort **Fraud Guard** auf „Maximum“ stellen.
3. Unter **Verify → Geo Permissions** nur die Länder oben erlauben,
   alle anderen sperren.
4. In Lovable unter Secrets eintragen: `TWILIO_ACCOUNT_SID`,
   `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` (beginnt mit `VA…`).
5. Optional: `SMS_DAILY_LIMIT` und `SMS_COUNTRY_DAILY_LIMIT` anpassen.

Ohne diese Angaben bleibt der Telefon-Weg aus. Die App meldet dann freundlich,
dass man E-Mail nehmen soll. Ist stattdessen in der Datenbank selbst ein
SMS-Dienst hinterlegt (Authentication → Phone), nutzt die App den.

## 5. Ausweisprüfung bei Stripe

1. Im Stripe-Dashboard unter **Identity** die Prüfung freischalten. Stripe
   verlangt dafür einmalig Angaben zum Unternehmen.
2. Sonst ist nichts zu tun, es wird derselbe Schlüssel wie für die Zahlungen
   benutzt.
3. Kosten: etwa 1,50 Euro je Prüfung.

Im Portal erscheint der Block *Ausweisprüfung*. Ausweisfoto und Selfie gehen
direkt an Stripe. Showly speichert weder Bilder noch biometrische Merkmale,
sondern nur das Ergebnis in der Tabelle `verifications`. Das Prüfsiegel am
Profil setzt allein der Server; über die Zugriffsregeln kann es sich niemand
selbst geben.

---

## 6. Meldungen bearbeiten

Meldungen zu Beiträgen, Kommentaren, Bewertungen und Profilen landen in der
Tabelle `reports` (Supabase → **Table Editor**). Für jede Meldung:

1. Inhalt ansehen (`target_type` und `target_id` sagen, was gemeldet wurde).
2. Entscheiden: entfernen oder stehen lassen. In `status` `removed` oder
   `kept` eintragen, in `decision` kurz begründen, `decided_at` setzen.
3. Der betroffenen Person die Begründung schicken (Pflicht nach Art. 17
   Digital Services Act), bei Entfernung auch der meldenden Person.

Offensichtlich rechtswidrige Inhalte (Beleidigung, Nacktbilder,
Urheberrechtsverstoß) zeitnah entfernen, am besten innerhalb von 24 Stunden.

## 7. Konto löschen

Läuft über die Server-Funktion `deleteMyAccount`
(`src/utils/account.functions.ts`) und braucht den Dienstschlüssel
`SUPABASE_SERVICE_ROLE_KEY`. Buchungen bleiben ohne Personenbezug erhalten;
offene Buchungen verhindern das Löschen.

---

## 8. Auszahlungen an Künstler (Stripe Connect)

Künstler richten ihr Auszahlungskonto im Dashboard unter „Zahlungen“ ein.
Bankdaten und Ausweis gibt man dabei direkt bei Stripe ein; Showly speichert
nur die Kontokennung (Tabelle `payout_accounts`).

1. Im Stripe-Dashboard **Connect** für das Showly-Konto aktivieren
   (Plattform, Konten vom Typ „Express“, Land Deutschland).
2. Die Auszahlungen selbst (Überweisung 5 Werktage nach dem Termin, Einbehalt
   bei den ersten 5 Buchungen) stehen als Plan in der Tabelle `payouts`.
   Ausgeführt werden sie über Stripe-Transfers; dafür fehlt noch ein
   täglicher Auftrag, der fällige Einträge überweist.

---

## 9. Verwaltung (Admin-Bereich unter /admin)

Wer Admin ist, steht in der Tabelle `admin_emails`. Wer sich mit einer dieser
Adressen anmeldet, bekommt beim ersten Anmelden die Rolle „admin“. Einen
weiteren Admin fügst du im SQL Editor hinzu:

    insert into public.admin_emails (email) values ('name@beispiel.de');
    update public.profiles set role = 'admin' where lower(email) = 'name@beispiel.de';

Im Admin-Bereich: Meldungen entscheiden, Notfall-Nachweise und Anhörungen
entscheiden, Künstler und Torten-/Deko-Anbieter freischalten oder sperren,
Erstattungen über Stripe auslösen, Hilfe-Anfragen beantworten, Fehlerprotokoll
ansehen und eine Datensicherung herunterladen. Jede Aktion prüft die Rolle auf
dem Server.

## 10. E-Mails (Antworten, Entscheidungen, Erstattungen)

Showly verschickt Mails über **Resend** (resend.com). Ohne Schlüssel wird
nichts verschickt, der Rest läuft weiter.

- `RESEND_API_KEY`: Schlüssel von Resend
- `SHOWLY_MAIL_FROM`: Absender, z. B. `Showly <hallo@showly.eu>` (die Domain showly.eu vorher bei Resend bestätigen)
  (die Domain muss bei Resend bestätigt sein)

## 11. Datensicherung

- **Automatisch:** Im Supabase-Dashboard unter **Database → Backups** die
  tägliche Sicherung prüfen. Sie ist ab dem Pro-Tarif enthalten;
  Point-in-Time-Recovery (Wiederherstellen auf die Minute) ist ein Zusatz.
  Bei Lovable Cloud hängt das vom Lovable-Tarif ab.
- **Von Hand:** Im Admin-Bereich unter „Datensicherung“ lädt ein Klick alle
  Tabellen als JSON-Datei herunter. Sinnvoll z. B. einmal pro Woche; die Datei
  enthält personenbezogene Daten und gehört verschlüsselt abgelegt.

## 12. Schutz vor Missbrauch

Die Serverfunktionen zählen je Person (ohne Anmeldung je Internetadresse)
mit, wie oft eine Aktion ausgelöst wird, und lehnen darüber hinaus ab
(`src/lib/guard.server.ts`): Warenkorb 10 in 10 Minuten, Nachrichten 30 in
10 Minuten, Registrierung 3 am Tag, Hilfe-Anfragen 5 pro Stunde, Meldungen
20 am Tag. Die Grenzen lassen sich dort anpassen.

---

## 13. Tägliche Aufgaben: Auszahlungen, Erinnerungen, Löschfristen

Migrationen `0008_eine_person_ein_profil.sql` und
`0009_gemeinschaft_benachrichtigung.sql` sind in Lovable Cloud eingespielt
(Stand 04.10.2026).

Einmal am Tag muss der Server Folgendes erledigen
(`src/lib/daily.server.ts`):

- unbeantwortete Anfragen verfallen lassen und das Geld erstatten
- Erinnerungen an offene Anfragen verschicken
- fällige Auszahlungen an Anbieter überweisen

Dafür:

1. In Lovable unter Secrets `CRON_SECRET` anlegen, einen langen Zufallswert
   (mindestens 16 Zeichen).
2. Einen Zeitplan einrichten, der täglich, etwa um 6 Uhr, Folgendes aufruft:
   `POST https://<deine-domain>/api/taeglich` mit dem Kopf
   `Authorization: Bearer <CRON_SECRET>`. Geeignet sind pg_cron mit pg_net
   in Supabase oder ein kostenloser Dienst wie cron-job.org.
3. Ohne Zeitplan: In der Verwaltung unter Übersicht → „Tägliche Aufgaben“ auf
   „Jetzt ausführen“ tippen.

Auszahlungen gehen per Stripe-Transfer auf das Connect-Konto der
anbietenden Person, 5 Werktage nach dem Termin. Den Sicherheitseinbehalt
der ersten Buchungen überweist der Server nach Ablauf seiner Frist. Keine
Auszahlung gibt es bei Storno, Nichterscheinen, Erstattung oder einer
offenen Meldung. Erstattungen laufen sofort und automatisch, wenn die AGB es
vorsehen, also bei kostenloser Stornierung, Absage durch den Künstler,
Ablehnung und Nichterscheinen.

**Benachrichtigungen per Mail** (über Resend, Abschnitt 10) gehen raus bei:

- neuer Anfrage oder Buchung
- Zusage, Absage oder Stornierung
- neuer Chat-Nachricht, höchstens eine Mail je Verlauf und halbe Stunde
- Antwort auf eine Torten-Anfrage
- neuer Shop-Bestellung
- Erinnerung an offene Anfragen

## 14. Bei Google gefunden werden (Search Console)

Die App bringt alles mit, was Suchmaschinen brauchen:

- Seitentitel und Beschreibung je Seite und Sprache, mit hreflang
- Vorschaubild (`/og-showly.jpg`) für Google, WhatsApp, Facebook und X
- strukturierte Daten mit Name, Logo und den Social-Media-Profilen
- `/sitemap.xml` mit allen Künstlern und Anbietern
- `/robots.txt`, die Konto, Kasse und Verwaltung aus der Suche heraushält
- eigene Adresse je Sprache: Deutsch ohne Zusatz, Englisch mit `?lang=en`,
  Spanisch mit `?lang=es`. Der Server liefert jede Fassung schon in ihrer
  Sprache aus, und hreflang sagt Google, welche Fassung zu wem passt. So
  zeigt Google Suchenden in den USA oder Großbritannien die englische, in
  Spanien oder Lateinamerika die spanische und in Deutschland, Österreich
  und der Schweiz die deutsche Seite.

Schritte:

Die Domain ist **showly.eu**. Canonical, Sitemap, robots.txt und
Vorschaubilder zeigen schon darauf.

0. Schon vor dem Veröffentlichen möglich: in der Search Console eine
   Property vom Typ „Domain“ für `showly.eu` anlegen und mit dem angezeigten
   TXT-Eintrag beim Domain-Anbieter (DNS) bestätigen.
1. Zum Start: In Lovable unter Project Settings → Domains `showly.eu` und
   `www.showly.eu` verbinden (DNS-Einträge, die Lovable anzeigt, beim
   Domain-Anbieter eintragen), dann veröffentlichen (Publish).
2. Falls noch nicht geschehen, die Property in der Search Console anlegen:
   - „Domain“ wählen und per DNS-Eintrag bestätigen (empfohlen);
   - sonst „URL-Präfix“ mit der veröffentlichten Adresse und Methode
     „HTML-Tag“. Den Wert hinter `content="…"` in Lovable unter Secrets als
     `VITE_GOOGLE_SITE_VERIFICATION` eintragen, neu veröffentlichen und in
     der Search Console auf „Bestätigen“ tippen.
3. In der Search Console unter „Sitemaps“ `sitemap.xml` einreichen.
4. Optional Bing Webmaster Tools (Code als `VITE_BING_SITE_VERIFICATION`).
   Bing kann die Einstellungen aus der Search Console übernehmen.

Bis Google die Seite zeigt, vergehen meist einige Tage bis wenige Wochen.

### IndexNow und KI-Suche (ab Livegang)

- In Lovable unter Secrets `INDEXNOW_KEY` setzen (32 Zeichen, z. B. `openssl rand -hex 16`). Dann meldet Showly neue und geänderte Künstlerprofile automatisch an Bing und Copilot. Anleitung: `docs/seo/BING-WEBMASTER-SETUP.md`.
- Die robots.txt lässt Google, Bing und die KI-Suchen (ChatGPT, Claude, Perplexity) ausdrücklich zu und sperrt private Bereiche. Alles Weitere zu Sichtbarkeit: `docs/seo/`.

## Was in der Datenbank läuft und was noch nicht

**Läuft über die Datenbank**, sobald jemand über Supabase angemeldet ist:

- Buchungen mit Anfrage, Zusage, Absage, Stornierung, Check-in und
  Nichterscheinen; die Regeln der AGB prüft der Server (`src/showly/cloudRules.ts`)
- Vertragsstrafen mit Anhörung, 50-€-Gutscheine, geplante Auszahlungen
- Torten-Anfragen und Direktbuchungen, Shop-Bestellungen
- Künstlerprofile, die sich neu registrieren (sichtbar nach Ausweisprüfung)
- Torten- und Deko-Anbieter mit eigenem Konto (sichtbar nach Freischaltung
  im Admin-Bereich), ihre Angebote und ihr Posteingang
- Nachrichten zwischen Kunde und Anbieter (Kontaktdaten-Filter auf dem Server)
- Hilfe-Anfragen und Fehlerprotokoll

- Bewertungen, Beiträge im Event-Blog mit Likes und Kommentaren
  (Fotos und Videos darin nach Freigabe durch das Team)
- Kalender-Sperren, die ein Künstler selbst setzt
- Erstattungen und Auszahlungen über Stripe (Abschnitt 13)

**Noch im Browser:**

- die Beispielprofile aus `data.js` (sie bleiben als Beispiele; Buchungen
  darauf werden gespeichert, haben aber keinen Künstler als Empfänger)
- Bilder einzelner Shop-Angebote von Deko-Anbietern (Galerie der Profile
  liegt schon im Speicher „medien“)
- Auszahlungen an Torten- und Deko-Anbieter laufen noch nicht automatisch
  (nur Künstler und Planer)
