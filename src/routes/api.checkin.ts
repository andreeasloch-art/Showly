/* Check-in-Wächter (lib/fair.server.ts) für einen Zeitplan-Dienst, alle
 * 5 Minuten: 15 Minuten nach Beginn ohne Check-in bekommen Künstler und
 * Kunde eine Nachricht.
 *
 * Aufruf:  POST /api/checkin  mit  Authorization: Bearer <CRON_SECRET> */
import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

async function handle(request: Request): Promise<Response> {
  const secret = process.env["CRON_SECRET"];
  const auth = request.headers.get("authorization") || "";
  if (!secret || secret.length < 16 || auth !== `Bearer ${secret}`)
    return new Response("Nicht erlaubt", { status: 401 });
  const { runCheckinWatch } = await import("@/lib/fair.server");
  const alerted = await runCheckinWatch();
  return new Response(JSON.stringify({ alerted }), { headers: { "Content-Type": "application/json" } });
}

export const Route = createFileRoute("/api/checkin")({
  server: {
    handlers: {
      POST: ({ request }) => handle(request),
    },
  },
});
