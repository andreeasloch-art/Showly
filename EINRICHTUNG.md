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

**Damit nichts im Spam landet** (bei Resend → Domains → showly.eu die angezeigten DNS-Einträge beim Domain-Anbieter eintragen):
- **SPF:** TXT-Eintrag für die Absender-Subdomain (z. B. `send.showly.eu`) mit dem Wert, den Resend anzeigt (`v=spf1 include:amazonses.com ~all`).
- **DKIM:** den TXT-Eintrag `resend._domainkey` genau wie angezeigt.
- **DMARC:** TXT-Eintrag `_dmarc.showly.eu` mit `v=DMARC1; p=quarantine; rua=mailto:dmarc@showly.eu` (anfangs `p=none` zum Beobachten).
Erst wenn Resend alle drei als „verified“ zeigt, `SHOWLY_MAIL_FROM` auf die eigene Domain umstellen.

**Automatische Mails:** Anbieter bei neuer Anfrage (mit 48-Stunden-Frist) und Erinnerung nach 24 Stunden; Kunde nach der Zahlung (Bestätigung mit Zahlungsbeleg), 2 Tage vor dem Event (auch an den Künstler), am Tag danach (Bewertung) und am letzten Miettag (Rückgabe). Die zeitgesteuerten laufen im täglichen Lauf (§ 13). Ein Konto nur mit Handynummer bekommt keine Mails, sieht aber alles in der App.

**Push-Nachrichten in der App** kommen mit der App-Store-Version (Capacitor + Firebase Cloud Messaging / Apple Push). Dafür braucht es ein Firebase-Projekt und ein Apple-Entwicklerkonto; SMS/WhatsApp-Erinnerungen bewusst nicht, weil sie pro Nachricht kosten und eine eigene Einwilligung brauchen.

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

1. Der Zeitplan läuft schon in der Datenbank (Migration 0017, pg_cron mit
   pg_net): alle 5 Minuten der Check-in-Wächter (`/api/checkin`), täglich
   um 4:00 UTC (6 Uhr Sommerzeit) die täglichen Aufgaben (`/api/taeglich`).
   Den Schlüssel erzeugt die Datenbank selbst; ein Secret ist nicht nötig.
2. Solange die App nicht veröffentlicht ist, tun die Aufträge nichts. Nach
   dem Veröffentlichen einmal in der Datenbank die Adresse eintragen:
   `update private.cron_settings set base_url = 'https://<deine-domain>';`
3. Ohne Zeitplan: In der Verwaltung unter Übersicht → „Tägliche Aufgaben“ auf
   „Jetzt ausführen“ tippen. Ein externer Dienst (etwa cron-job.org) geht
   auch: dann `CRON_SECRET` als Secret setzen und als
   `Authorization: Bearer <CRON_SECRET>` mitschicken.
4. Check-in-Wächter: Hat ein Künstler 15 Minuten nach Beginn nicht
   eingecheckt, bekommen er und der Kunde eine Nachricht; der Kunde kann dann
   „Künstler ist nicht erschienen“ melden.
5. Eine Telefon-Hotline gibt es nicht. Fällt ein Künstler weniger als
   48 Stunden vorher aus, legt der Server ein Ticket „Ersatzgarantie
   DRINGEND“ an (Verwaltung → Hilfe-Anfragen); der Kundensupport
   beantwortet es zuerst per E-Mail.

Auszahlungen gehen per Stripe-Transfer auf das Connect-Konto der
anbietenden Person, immer 7 Tage nach dem Termin; schneller auf Wunsch der
anbietenden Person gegen 10 % (3 Tage) bzw. 20 % (48 Stunden) Gebühr.
Fällige Vertragsstrafen werden mit der nächsten Auszahlung verrechnet, bei
einer offenen Reklamation ist die Auszahlung eingefroren. Den Sicherheitseinbehalt
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

## 15. Doppelbuchungen, Reservierung beim Bezahlen, Teilbestellungen, Kalender

Migration `0012_buchungssicherheit.sql` (in Lovable eingespielt).

- **Keine Doppelbuchung:** Jede belegte Zeit eines Künstlers steht genau einmal in `slot_claims`. Die Datenbank verbietet Überschneidungen selbst (Ausschlussregel, inkl. einer Stunde Fahrtzeit), und `claim_slots` sperrt vor dem Prüfen die Zeile des Künstlers (`SELECT … FOR UPDATE`). Getestet: 30 gleichzeitige Kassen für denselben Termin → genau eine bekommt ihn.
- **Reservierung beim Bezahlen:** Wer an die Kasse geht, bekommt die Künstler-Termine 15 Minuten reserviert (`HOLD_MINUTES` in `src/lib/slots.server.ts`). Stripe lässt eine offene Kasse frühestens nach 30 Minuten ablaufen; bezahlt jemand nach Ablauf der Reservierung und ist der Termin inzwischen weg, wird die Buchung sofort abgelehnt und das Geld automatisch erstattet. Abbruch gibt den Termin sofort frei, sonst der tägliche Lauf bzw. der nächste Zugriff.
- **Teilbestellungen:** Ein Warenkorb (ein Event) wird zur Bestellung `orders` mit einer Teilbestellung `sub_orders` je Anbieter (jeder Künstler, jede Konditorei, jeder Deko-Anbieter, Showly-Shop). Buchungen, Torten und Shop-Zeilen hängen über `sub_order_id` daran. Kunden sehen alle Teilbestellungen ihrer Bestellung, Anbieter nur ihre eigene.
- **Kalender verbinden:** Künstler tragen im Portal unter „Verfügbarkeit“ (bzw. Dashboard → Kalender) den iCal-Link aus Google, Apple oder Outlook ein. Abgleich sofort, vor jeder Reservierung (wenn älter als 15 Minuten) und im täglichen Lauf. Gespeichert werden nur Beginn und Ende. Dazu gibt es einen geheimen Abo-Link mit allen Showly-Auftritten (`/api/kalender/<schlüssel>.ics`).
- Nichts einzustellen; der tägliche Lauf (Abschnitt 13) erledigt Aufräumen und Abgleich mit.

## 16. Zahlungen absichern, Bots, Zwei-Faktor, Überwachung

**Stripe-Webhook** (verbucht Zahlungen auch, wenn der Browser nach dem Bezahlen zugeht, und meldet Rückbuchungen):
1. Stripe-Dashboard → Entwickler → Webhooks → Endpunkt hinzufügen: `https://<deine-domain>/api/stripe/webhook`
2. Ereignisse: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.dispute.created`, `charge.dispute.closed`
3. Signatur-Geheimnis als `STRIPE_LIVE_WEBHOOK_SECRET` (bzw. `STRIPE_SANDBOX_WEBHOOK_SECRET` im Testmodus) in Lovable hinterlegen.
Rückbuchungen halten die Auszahlungen an und erscheinen als Fall unter Verwaltung → Hilfe.

**Zahlungsarten:** Karte, Apple Pay, Google Pay, PayPal, Klarna, SEPA-Lastschrift im Stripe-Dashboard unter Einstellungen → Zahlungsmethoden einschalten; die Kasse zeigt automatisch alles Eingeschaltete. 3-D Secure macht Stripe selbst. Kartendaten kommen nie auf unseren Server.

**Schutz vor Bots (Cloudflare Turnstile, optional):** Kostenloses Widget bei Cloudflare anlegen, `VITE_TURNSTILE_SITE_KEY` und `TURNSTILE_SECRET_KEY` setzen und in Supabase → Authentication → Attack Protection „Captcha“ mit Turnstile und demselben Geheimnis einschalten. Erst beides zusammen einschalten, sonst klappt die Anmeldung nicht.

**Zwei-Faktor:** Im Konto unter „Zwei-Faktor-Anmeldung“ einrichten. Für die Verwaltung Pflicht, sobald `ADMIN_REQUIRE_2FA=1` gesetzt ist (erst setzen, wenn alle Admins 2FA eingerichtet haben). In Supabase → Authentication → MFA muss TOTP eingeschaltet sein.

**Virenschutz für Uploads:** Jede hochgeladene Datei (Chat-Anhänge, Fotos und Videos, Nachweise bei Reklamation und Übergabe) wird auf dem Server geprüft. Immer aktiv ist die eigene Prüfung (`src/showly/fileScan.ts`): echte Dateiart, Virensignatur-Testmuster, versteckter Code in Bildern, und bei PDFs Skripte, Programmstart, eingebettete Dateien und Verschlüsselung, auch in komprimierten Teilen. Was durchfällt, wird sofort gelöscht.
Zusätzlich lässt sich ein echter Virenscanner (ClamAV) anbinden:
1. Einen ClamAV-REST-Dienst betreiben, z. B. das Docker-Image `ajilach/clamav-rest` bei einem EU-Hoster (Hetzner o. ä.), erreichbar nur per HTTPS.
2. In Lovable die Secrets `VIRUS_SCAN_URL` (z. B. `https://scan.deine-domain.de/v2/scan`) und optional `VIRUS_SCAN_TOKEN` (wird als `Authorization: Bearer …` gesendet; im Dienst bzw. davorgeschalteten Proxy prüfen) setzen.
3. Ab dann wird jede Datei zusätzlich mit ClamAV geprüft. Ist der Scanner gerade nicht erreichbar, werden PDFs abgelehnt; Fotos und Videos gehen nach der eigenen Prüfung durch.
Betreibst du den Scanner selbst, ist kein weiterer Auftragsverarbeitungsvertrag nötig; bei einem fremden Scan-Dienst schon (`docs/datenschutz/dienstleister-avv.md`).

**Überwachung:** Bei UptimeRobot oder Better Stack einen Monitor auf `https://<deine-domain>/api/status` anlegen (200 = alles gut, 503 = Datenbank weg). Fehler aus der App landen unter Verwaltung → Fehler.

**Automatische Prüfung (CI):** `.github/workflows/ci.yml` prüft bei jedem Push Typen, Tests und Build; Dependabot schlägt wöchentlich Updates vor.

Datenschutz-Unterlagen: `docs/datenschutz/` (Verarbeitungsverzeichnis, Löschkonzept, Dienstleister/AVV). Umgebungen: `docs/umgebungen.md`.

## 17. Belege, Wochenabrechnung, DAC7, E-Rechnung

**Was automatisch passiert**
- Nach jeder bezahlten Bestellung bekommt der Kunde pro Anbieter einen Beleg per E-Mail: gewerblich eine Rechnung im Namen des Anbieters (19 %/7 %), Kleinunternehmer eine Rechnung mit §19-Hinweis, privat eine Showly-Buchungsquittung. Kautionen bekommen eine eigene Kautionsbestätigung und stehen nie auf der Rechnung.
- Erstattungen erzeugen Storno, Korrektur oder Stornogebühr mit Bezug auf den Originalbeleg. Nummern sind lückenlos je Anbieter und Jahr (`V1001-2026-0001`), Quittungen `Q-2026-000001`, Provisionsrechnungen `PR-…`, Auszahlungsabrechnungen `AB-…`.
- Belege sind nach dem Anlegen in der Datenbank gesperrt (Trigger). Das PDF liegt im privaten Speicher-Bucket `belege`, mit SHA-256-Prüfsumme.
- Jeden Montag (Cron `showly-woche`, ruft `POST /api/woche`) bekommt jeder Anbieter eine Provisionsrechnung (20 % + 19 % USt) und eine Auszahlungsabrechnung über die Vorwoche. Abzüge (Vertragsstrafen, Erstattungen nach Auszahlung) werden verrechnet; was nicht gedeckt ist, wird vorgetragen.
- Auszahlungen bleiben gesperrt, bis der Anbieter unter „Zahlungen“ seine Steuer- und Rechnungsdaten (DAC7) ausgefüllt hat.

**Einstellen (Secrets in Lovable)**
- `SHOWLY_FIRMA`, `SHOWLY_STRASSE`, `SHOWLY_PLZ`, `SHOWLY_ORT`, `SHOWLY_UST_ID`, `SHOWLY_STEUERNUMMER`, `SHOWLY_HANDELSREGISTER`, `SHOWLY_RECHNUNG_EMAIL`: Angaben der Plattform auf allen Belegen. Solange sie fehlen, stehen „Muster“-Platzhalter auf den Belegen.
- `DATEV_BERATER`, `DATEV_MANDANT`, optional `DATEV_ERLOESKONTO` (Standard 8400) und `DATEV_DEBITOR` (Standard 10000) für den DATEV-Export unter Verwaltung → Belege & Abrechnung.
- Migration `supabase/migrations/0021_belege.sql` einspielen (legt Tabellen, Nummernkreise, Bucket und Cron an).

**Vor dem Start prüfen lassen**
- Steuerberater: Steuersatz der Stornogebühr, 7 %-Sätze bei Torten, Kontenzuordnung im DATEV-Export, Kleinunternehmergrenze (gesetzlich 25.000 € Vorjahr / 100.000 € laufendes Jahr; Showly warnt bei 22.000 €).
- Künstlersozialkasse: ob Showly für Künstlerhonorare KSK-Abgabe zahlen muss.
- E-Rechnung: Das XRechnung-XML (CII) hängt im PDF. Das PDF ist kein PDF/A-3. Eine Beispielrechnung einmal mit dem KoSIT-Validator prüfen.
- Aufbewahrung 10 Jahre: Für den Bucket `belege` ein Backup mit Schreibschutz (Object Lock/WORM, z. B. S3 oder Backblaze B2) einrichten.

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
