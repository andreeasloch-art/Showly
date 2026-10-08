# Umgebungen: Entwicklung, Test, Live

| Umgebung | Wo | Datenbank | Zahlungen |
|---|---|---|---|
| Entwicklung | lokal (`npm run dev`) bzw. Vorschau-Artifact | keine oder eigenes Supabase-Testprojekt | Stripe Sandbox |
| Test | Lovable-Vorschau (Branch / Remix) | eigenes Supabase-Projekt „showly-test“ | Stripe Sandbox (`STRIPE_SANDBOX_*`) |
| Live | veröffentlichte Lovable-App unter der eigenen Domain | Supabase-Live-Projekt | Stripe Live (`STRIPE_LIVE_*`) |

Regeln:
- Geheimnisse (API-Schlüssel) nur als Umgebungsvariablen in Lovable/Supabase,
  nie im Code. Liste in EINRICHTUNG.md.
- Migrationen (`supabase/migrations/`) zuerst im Testprojekt ausführen, dann live.
- Jeder Push läuft durch die CI (`.github/workflows/ci.yml`): Typen, Tests, Build.
- Live wird erst veröffentlicht, wenn Bezahlsystem und Impressum fertig sind.

Skalierung für Stoßzeiten (Halloween, Fasching, Weihnachten): Die App läuft
serverlos und skaliert automatisch; Engpass ist die Datenbank. Vorher in
Supabase eine größere Compute-Stufe wählen, Doppelbuchungen verhindert die
Datenbank selbst (Sperren), Bilder kommen aus dem Speicher-CDN.
