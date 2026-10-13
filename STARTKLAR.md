# Showly – Startliste

Stand: 13.10.2026 · Live-Adresse: https://showly-events.lovable.app

Prüfen jederzeit unter https://showly-events.lovable.app/api/status
(`ok: true` = Server und Datenbank laufen; `setup` zeigt, was eingerichtet ist).

## Erledigt

| Punkt | Stand |
|---|---|
| Neueste Version veröffentlicht (Lovable-Projekt „Showly Events“) | ✅ |
| Datenbank im Browser (Anmeldung, echte Buchungen) | ✅ repariert, lief vorher im Übungsbetrieb |
| Automatische Aufgaben (Check-in-Wächter, Auszahlungen, Erstattungen, Erinnerungen) | ✅ Adresse eingetragen, laufen |
| Zwischenspeicher, Vorausladen, kleine Bilder, Offline-Speicher | ✅ live |
| Datenbank-Indizes (Migration 0026) | ✅ eingespielt |
| Handy-App zeigt auf die neue Adresse (`capacitor.config.ts`) | ✅ (wirkt mit dem nächsten App-Build) |

## Offen – nur du kannst das

1. **Impressum mit echten Firmendaten.** Steht noch auf „Muster“. Pflicht vor dem Start.
   Name, Anschrift, E-Mail, Handelsregister, USt-ID schicken, ich trage sie ein
   (Impressum, Belege, strukturierte Daten).
2. **Stripe im Live-Modus.** Zurzeit Testmodus (`stripe_live: false`). In Lovable
   unter Zahlungen auf Live umstellen bzw. `STRIPE_LIVE_API_KEY` hinterlegen.
3. **Stripe-Webhook** (`stripe_webhook: false`): Stripe-Dashboard → Entwickler →
   Webhooks → Endpunkt `https://showly-events.lovable.app/api/stripe/webhook`,
   Ereignisse `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `charge.dispute.created`, `charge.dispute.closed`; Signatur-Geheimnis als
   `STRIPE_LIVE_WEBHOOK_SECRET` in Lovable unter Secrets.
4. **E-Mail-Versand** (`mail: false`): Konto bei Resend anlegen, Domain bestätigen,
   `RESEND_API_KEY` und `SHOWLY_MAIL_FROM` (z. B. `Showly <hallo@deine-domain.de>`)
   in Lovable unter Secrets setzen. Ohne das gehen keine Bestätigungen raus.
5. **Eigene Domain** (z. B. showly.eu): in Lovable unter Domains verbinden und
   `VITE_SITE_URL` auf die Domain setzen. Danach die Adresse der automatischen
   Aufgaben umstellen (sag mir Bescheid, ich mache das).
6. **Datensicherung:** In Lovable/Supabase prüfen, ob tägliche Sicherungen im
   Tarif enthalten sind. Zusätzlich wöchentlich in der Verwaltung → „Datensicherung“
   herunterladen und verschlüsselt ablegen.
7. **Ausfallwächter:** Kostenlos bei uptimerobot.com: „Add New Monitor“ → HTTP(s) →
   URL `https://showly-events.lovable.app/api/status` → alle 5 Minuten → E-Mail an dich.
8. **Zwei-Faktor für Admins:** Im Konto einrichten, danach `ADMIN_REQUIRE_2FA=1` setzen.

## Notbremsen

- Alte Version zurück: Lovable → Versionsverlauf → Wiederherstellen → Veröffentlichen.
- Offline-Speicher abschalten: Inhalt von `public/sw.js` durch die „Notbremse“ aus
  dem Kopfkommentar der Datei ersetzen und veröffentlichen.
- Gemerkte Seiten verfallen spätestens nach 5 Minuten, bei jeder neuen Version sofort.
