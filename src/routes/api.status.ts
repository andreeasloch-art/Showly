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
        return Response.json(
          { ok, db, time: new Date().toISOString() },
          { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } },
        );
      },
    },
  },
});
