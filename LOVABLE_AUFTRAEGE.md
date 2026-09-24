# Aufträge für Lovable – Schritt für Schritt

Jeden Auftrag einzeln in den Lovable-Chat kopieren. Erst weitermachen, wenn der
Schritt getestet ist. Schlüssel (Stripe, Resend) nie in den Chat schreiben,
sondern nur in das Eingabefeld, das Lovable dafür anzeigt.

Vorher: GitHub mit dem Lovable-Projekt verbinden und diesen Code ins
Repository hochladen.

---

## 1. Datenbank anlegen

> Aktiviere Lovable Cloud für dieses Projekt. Lies zuerst `EINRICHTUNG.md` und
> `supabase/migrations/0001_showly_grundlage.sql` und lege die Tabellen daraus an.
> Ergänze Tabellen für: Buchungen, Bestellungen mit Positionen, Torten-Anbieter
> (`src/showly/sweets.ts`, Typ `Baker`), Torten-Angebote (`Sweet`),
> Torten-Anfragen (`SweetRequest`) und Deko-Artikel von Anbietern
> (`DecoInput`). Setze Zugriffsregeln: Kunden sehen nur ihre eigenen
> Buchungen, Bestellungen und Anfragen; Anbieter sehen nur Anfragen und
> Buchungen zu ihrem eigenen Profil. Verändere keine Seiten, kein Design und
> keine Texte.

**Testen:** Tabellen sind in Lovable Cloud sichtbar, die Seite sieht aus wie vorher.

## 2. Anmeldung

> Stelle die Anmeldung auf Lovable Cloud um (E-Mail und Google), wie in
> `EINRICHTUNG.md` beschrieben. Die Rolle (Kunde, Künstler, Planer) wird beim
> Registrieren gespeichert. Design und Texte nicht verändern.

**Testen:** Registrieren, abmelden, wieder anmelden.

## 3. Buchungen und Bestellungen in die Datenbank

> Stelle den Warenkorb-Abschluss auf die Datenbank um: `completeCart` in
> `src/showly/store.tsx` soll Buchungen, Bestellungen und Torten-Anfragen in
> die Datenbank schreiben statt in localStorage. Das Dashboard
> (`src/routes/dashboard.tsx`) liest sie von dort. Die Preise berechnet
> weiterhin `src/showly/pricing.ts`. Kasse (`src/components/showly/CartCheckout.tsx`),
> Design und Texte nicht verändern.

**Testen:** Künstler buchen, Deko und Torte in den Warenkorb, zur Kasse,
reservieren. Im Konto (auch auf einem zweiten Gerät) ist alles sichtbar.

## 4. Stripe im Testmodus

> Verbinde Stripe im Testmodus. Die Kasse nutzt bereits `createCartCheckout`
> in `src/utils/payments.functions.ts`, der die Beträge auf dem Server
> berechnet. Richte einen Stripe-Webhook ein, der eine Bestellung erst nach
> erfolgreicher Zahlung auf „bestätigt“ setzt. Design und Texte nicht
> verändern.

**Testen:** Mit der Stripe-Testkarte 4242 4242 4242 4242 bezahlen. Im Konto
steht die Buchung danach als bestätigt.

## 5. Profile in die Datenbank

> Speichere Künstlerprofile, Torten-Anbieter mit Angeboten und Deko-Artikel
> von Anbietern in der Datenbank statt in localStorage, Bilder im
> Cloud-Speicher statt in IndexedDB (`src/showly/media.ts`). Name und
> Geburtsdatum aus der Ausweisprüfung bleiben gesperrt. Design nicht
> verändern.

**Testen:** Profil anlegen, Foto hochladen, auf einem anderen Gerät ansehen.

## 6. E-Mails mit Resend

> Binde Resend für Bestätigungsmails an (`src/utils/email.functions.ts`):
> an Kunden nach Buchung, Bestellung und Anfrage, an Künstler und
> Torten-Anbieter bei neuen Buchungen und Anfragen. Frag mich nach dem
> Resend-Schlüssel über das Secrets-Feld.

**Testen:** Testbuchung machen, beide E-Mails kommen an.

## 7. Vor dem Start

- Erfundene Beispielprofile und Bewertungen entfernen oder als Beispiel kennzeichnen.
- Impressum, AGB, Datenschutz, Widerruf und die Regeln für private Bäcker
  rechtlich prüfen lassen.
- Stripe auf Live-Modus umstellen.
