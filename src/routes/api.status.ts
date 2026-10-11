/* Status für die Uptime-Überwachung (z. B. UptimeRobot, Better Stack):
 * /api/status antwortet 200, wenn Server und Datenbank laufen, sonst 503.
 * Gibt keine Interna preis, nur ok/Fehler je Baustein. */
import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

export const Route = createFileRoute("/api/status")({
  server: {
    handlers: {
      GET: async () => {
        let db: "ok" | "down" | "off" = "off";
        if (process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
          try {
            const { adminClient } = await import("@/lib/supabase.server");
            const { error } = await adminClient().from("artists").select("id", { head: true, count: "exact" }).limit(1);
            db = error ? "down" : "ok";
          } catch {
            db = "down";
          }
        }
        const ok = db !== "down";
        /* Was eingerichtet ist (nur ja/nein, nie ein Wert), damit nach dem
           Veröffentlichen schnell zu sehen ist, was noch fehlt */
        const has = (k: string) => !!process.env[k];
        const { serverPublicSupabase } = await import("@/lib/publicConfig");
        const setup = {
          datenbank_browser: !!serverPublicSupabase(),
          datenbank_server: has("SUPABASE_SERVICE_ROLE_KEY"),
          stripe_live: has("STRIPE_LIVE_API_KEY"),
          stripe_webhook: has("STRIPE_LIVE_WEBHOOK_SECRET") || has("STRIPE_SANDBOX_WEBHOOK_SECRET"),
          mail: has("RESEND_API_KEY"),
        };
        return Response.json(
          { ok, db, setup, time: new Date().toISOString() },
          { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } },
        );
      },
    },
  },
});
