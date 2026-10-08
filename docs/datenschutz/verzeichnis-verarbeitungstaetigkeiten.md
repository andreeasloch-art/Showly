# Verzeichnis von Verarbeitungstätigkeiten (Art. 30 DSGVO) – Entwurf

Stand: Oktober 2026. Vorlage aus dem tatsächlichen Code. Mit „Muster“ markierte
Angaben vor dem Livegang ersetzen und mit Datenschutzberatung prüfen.

**Verantwortlicher:** Showly GmbH (Muster), Anschrift siehe Impressum
**Datenschutz-Kontakt:** datenschutz@showly.eu
**Datenschutzbeauftragter:** benennen, sobald § 38 BDSG greift (in der Regel ab
20 Personen, die ständig mit personenbezogenen Daten arbeiten) oder eine
umfangreiche Kerntätigkeit nach Art. 37 DSGVO vorliegt.

| Nr. | Verarbeitung | Betroffene | Daten | Zweck / Rechtsgrundlage | Empfänger | Löschung |
|---|---|---|---|---|---|---|
| 1 | Konto und Anmeldung | Kunden, Anbieter | E-Mail/Telefon, Name, Rolle, Passwort-Hash, 2FA-Schlüssel | Vertrag, Art. 6 Abs. 1 b | Supabase (AV) | Kontolöschung |
| 2 | Buchungen und Bestellungen | Kunden, Anbieter | Termin, Adresse, Anlass, Wünsche, Beträge | Vertrag, Art. 6 Abs. 1 b; § 147 AO | Anbieter der Buchung, Stripe | 10 Jahre (anonymisiert nach Kontolöschung) |
| 3 | Zahlung, Auszahlung, Rückbuchung | Kunden, Anbieter | Zahlungs-ID, Betrag, Konto bei Stripe | Vertrag; rechtl. Pflicht | Stripe | 10 Jahre |
| 4 | Ausweisprüfung | Anbieter | Prüfergebnis, Name, Geburtsdatum, Prüfwert | Art. 6 Abs. 1 c/f (DSA Art. 30, Betrugsschutz) | Stripe Identity | Kontolöschung bzw. Dauer einer Sperre |
| 5 | Nachrichten (Chat) | Kunden, Anbieter | Nachrichtentext, Anhänge | Vertrag | Gesprächspartner | 24 Monate |
| 6 | Bewertungen, Blog, Medien | Nutzer | Text, Fotos, Videos | Vertrag; berecht. Interesse | öffentlich nach Freigabe | Kontolöschung |
| 7 | Kalender-Abgleich | Künstler | Beginn/Ende belegter Termine | Vertrag | – | 1 Tag nach Termin / Entfernen des Kalenders |
| 8 | E-Mails und Benachrichtigungen | alle | E-Mail, Inhalt | Vertrag | Resend (AV) | Versandprotokoll beim Dienst |
| 9 | SMS-Codes | Nutzer mit Telefon-Login | Telefonnummer, gehashte Zähler | Vertrag; berecht. Interesse | Twilio (AV) | 30 Tage |
| 10 | Missbrauchsschutz, Captcha | alle | gehashte IP, Browsermerkmale | berecht. Interesse; § 25 Abs. 2 TDDDG | Cloudflare (nur wenn eingeschaltet) | 2 Tage |
| 11 | Fehlerprotokoll | alle | Fehlermeldung, Seite, Browser | berecht. Interesse | – | 90 Tage |
| 12 | Hilfe, Widerruf, Meldungen (DSA) | alle | Anliegen, E-Mail | Vertrag; rechtl. Pflicht | – | 24 Monate |
| 13 | Steuerliche Meldung (PStTG) | Anbieter | Steuerdaten, Umsätze | rechtl. Pflicht | BZSt | 10 Jahre |

**Technische und organisatorische Maßnahmen (Art. 32):** HTTPS mit HSTS,
Zugriffsregeln in der Datenbank (Row Level Security), Prüfung jeder
Server-Aktion auf Eigentümer, Zwei-Faktor-Pflicht für die Verwaltung,
Rate Limiting, Captcha, Upload-Prüfung (Dateiart, Größe, Metadaten),
private Speicher-Buckets, tägliche Datensicherung (siehe EINRICHTUNG.md § 11),
Geheimnisse nur als Umgebungsvariablen.
