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

## 4. Anmeldung per Telefon

Unter **Authentication → Providers → Phone** einen SMS-Dienst hinterlegen,
etwa Twilio oder MessageBird. Beachte: Jede SMS kostet Geld, in Deutschland
grob sieben bis zehn Cent. Ohne diesen Schritt bleibt der Telefon-Reiter zwar
sichtbar, meldet aber einen Fehler.

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
- `SHOWLY_MAIL_FROM`: Absender, z. B. `Showly <hilfe@deine-domain.de>`
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

**Noch im Browser:**

- Bewertungen und Beiträge im Event-Blog
- die Beispielprofile aus `data.js` (sie bleiben als Beispiele; Buchungen
  darauf werden gespeichert, haben aber keinen Künstler als Empfänger)
- Fotos von Anbietern und Angeboten (brauchen einen Dateispeicher,
  z. B. Supabase Storage); Angebote aus der Datenbank zeigen Standardbilder
- Kalender-Sperren, die ein Künstler selbst setzt
- Erstattungen löst der Admin-Bereich per Klick über Stripe aus; automatisch
  bei jeder Stornierung passiert das noch nicht
- Überweisungen an Künstler und Anbieter (Stripe-Transfers nach Plan)
