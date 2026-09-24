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
   Danach genauso `supabase/migrations/0002_anfragen_konto_meldungen.sql`.
   Damit stehen alle Tabellen und die Zugriffsregeln, auch für Buchungs-
   anfragen, das Löschen von Konten und für Meldungen.
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

## Was danach noch offen ist

Die Grundlage steht, die Umstellung der bestehenden Abläufe nicht. Diese Punkte
laufen weiterhin im Browserspeicher und gehören als Nächstes in die Datenbank:

- Buchungen und Verfügbarkeit
- Bewertungen und Beiträge im Event-Blog
- Künstlerprofile aus `data.js`
- Torten-Anbieter, Deko-Anbieter und ihre Anfragen
- Warenkorb und Bestellungen (die Kasse fasst Künstler, Artikel und
  Torten-Anfragen schon zusammen, gespeichert wird aber noch im Browser)

Die Preise rechnet der Server beim Bezahlen bereits selbst nach
(`createCartCheckout` in `src/utils/payments.functions.ts`, Grundlage
`src/showly/pricing.ts`). Posten, die nur im Browser angelegt wurden, lehnt er
ab, bis sie in der Datenbank stehen.

Der Reihe nach sinnvoll ist: erst Buchungen und Bestellungen in die Datenbank,
weil daran Geld hängt, danach Profile, zuletzt Bewertungen und Beiträge.
