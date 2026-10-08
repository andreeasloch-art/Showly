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
  const result = await runDaily();
  return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
}

export const Route = createFileRoute("/api/taeglich")({
  server: {
    handlers: {
      POST: ({ request }) => handle(request),
    },
  },
});
