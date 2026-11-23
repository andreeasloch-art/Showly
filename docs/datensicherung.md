# Datensicherung und Wiederherstellung

## Was gesichert wird

- **Automatisch jeden Montag um 6 Uhr** (Zeitplan `/api/woche`): alle Tabellen
  vollständig plus die Liste der Konten (ohne Passwörter), gepackt als
  `.json.gz` im privaten Speicher **„sicherungen“** (Lovable → Cloud → Storage).
  Behalten werden die letzten 12 Sicherungen, also rund drei Monate.
- **Von Hand:** Verwaltung → „Datensicherung“ lädt dieselben Daten als `.json`
  herunter. Empfehlung: einmal im Monat herunterladen und verschlüsselt
  außerhalb von Lovable ablegen (z. B. verschlüsselter Ordner in der Cloud).
- Bewusst **nicht** gesichert: Anfragezähler, kurzfristige Reservierungen der
  Kasse, SMS-Protokoll und Browserfehler (kurzlebig, ohne Wert für eine
  Wiederherstellung).
- **Nicht in der Datei:** hochgeladene Fotos, Videos und Beleg-PDFs. Sie liegen
  im Speicher („medien“, „belege“) und sind bei Lovable Cloud bzw. Supabase
  gesichert, soweit der Tarif das vorsieht. Die Rechnungsdaten selbst (Nummern,
  Beträge, Positionen) sind in der Sicherung enthalten.

Schlägt die wöchentliche Sicherung fehl, kommt eine Mail an die Verwaltung
(sobald der Mailversand eingerichtet ist).

## Zurückspielen

Voraussetzung: Node.js auf dem Rechner und dieser Code (`npm ci`).

1. Sicherung holen: Lovable → Cloud → Storage → „sicherungen“ → Datei
   herunterladen (oder den Download aus der Verwaltung nehmen).
2. Verbindungsadresse der Datenbank holen: Lovable → Cloud → Database →
   Connection string (Session). Sie enthält das Datenbank-Passwort: nirgends
   speichern oder weitergeben.
3. Erst testen, ohne etwas zu ändern: das Skript schreibt ohne `--ersetzen`
   nur in leere Tabellen und bricht sonst ab, ohne etwas zu ändern.
   ```
   node scripts/sicherung/wiederherstellen.mjs sicherung.json.gz "<verbindungsadresse>"
   ```
4. Wirklich zurückspielen (leert die gesicherten Tabellen und füllt sie aus
   der Sicherung, alles in einem Schritt; bei einem Fehler bleibt alles, wie es war):
   ```
   node scripts/sicherung/wiederherstellen.mjs sicherung.json.gz "<verbindungsadresse>" --ersetzen
   ```
5. Danach: Rechnungsnummern und Buchungsnummern laufen ohne Lücke weiter.
   Alles, was nach dem Zeitpunkt der Sicherung passiert ist, fehlt; Zahlungen
   aus dieser Zeit stehen in Stripe und lassen sich von dort nachtragen.

**In ein ganz neues Projekt:** Erst alle Migrationen einspielen. Die Konten
(Anmeldung) liegen bei Supabase getrennt von den Tabellen; die Sicherung
enthält ihre Liste (`authUsers`), aber keine Passwörter. Für ein neues Projekt
müssen die Konten neu angelegt werden und alle ihr Passwort zurücksetzen. Das
ist der Notfall; der Normalfall (Daten im bestehenden Projekt beschädigt oder
gelöscht) braucht das nicht.

## Getestet

`src/lib/sicherung.db.test.ts` spielt gegen ein echtes Postgres durch:
Sicherung erstellen, Daten löschen und verändern, zurückspielen, alles wieder
da (auch über 1000 Zeilen und gesperrte Rechnungen), danach lückenlose
Nummern. `src/lib/backup.server.test.ts` prüft, dass keine Tabelle aus den
Migrationen in der Sicherung fehlt.
