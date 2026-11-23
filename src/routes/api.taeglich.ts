/* Tägliche Aufgaben (lib/daily.server.ts) für einen Zeitplan-Dienst.
 *
 * Aufruf:  POST /api/taeglich  mit  Authorization: Bearer <Schlüssel>
 * (Datenbank-Zeitplan aus Migration 0017 oder CRON_SECRET). */
import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

async function handle(request: Request): Promise<Response> {
  const { cronAllowed } = await import("@/lib/cron.server");
  if (!(await cronAllowed(request))) return new Response("Nicht erlaubt", { status: 401 });
  const { runDaily } = await import("@/lib/daily.server");
  try {
    const result = await runDaily();
    return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    /* Bricht der ganze Tageslauf ab, erfährt es die Verwaltung per Mail */
    const msg = e instanceof Error ? e.message : String(e);
    const { alertAdmins } = await import("@/lib/alert.server");
    await alertAdmins("taeglich-abbruch", "Tägliche Aufgaben abgebrochen", [
      "Die täglichen Aufgaben (Auszahlungen, Erinnerungen, Fristen) sind mit einem Fehler abgebrochen:",
      msg.slice(0, 500),
      "Sie laufen morgen erneut. In der Verwaltung lassen sie sich auch von Hand starten.",
    ]).catch(() => false);
    return new Response(JSON.stringify({ error: msg.slice(0, 500) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}

export const Route = createFileRoute("/api/taeglich")({
  server: {
    handlers: {
      POST: ({ request }) => handle(request),
    },
  },
});
