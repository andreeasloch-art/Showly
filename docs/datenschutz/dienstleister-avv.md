# Dienstleister und Auftragsverarbeitungsverträge (AVV)

Vor dem Livegang mit jedem Dienst den AVV abschließen (meist im Konto
anklickbar) und hier abhaken.

| Dienst | Zweck | Sitz / Region | AVV | Drittland-Grundlage |
|---|---|---|---|---|
| Lovable (Hosting) | App ausliefern | Schweden (EU) | [ ] | – |
| Supabase | Datenbank, Anmeldung, Speicher | Region im Projekt prüfen (EU wählen) | [ ] | DPF/SCC, falls US-Bezug |
| Stripe | Zahlung, Auszahlung, Ausweisprüfung | Irland (EU) / USA | [ ] (Teil der Stripe-Bedingungen) | DPF |
| Virenscanner ClamAV (optional, `VIRUS_SCAN_URL`) | Uploads auf Schadsoftware prüfen | eigener Server in der EU | nur nötig, wenn ein fremder Dienst scannt | – |
| Resend | E-Mails | USA | [ ] | DPF / SCC |
| Twilio | SMS-Codes | Irland / USA | [ ] | DPF |
| Cloudflare Turnstile | Captcha (optional) | USA | [ ] | DPF |
| Komoot Photon | Ortssuche (nur mit Einwilligung) | Deutschland | – (keine AV, eigene Verantwortung) | – |

Hinweis: Kein Analytics-Dienst im Einsatz. Wird einer ergänzt, braucht er eine
Einwilligung im Cookie-Banner (TDDDG) und einen Eintrag hier und in der
Datenschutzerklärung.
