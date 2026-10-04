/* Tägliche Aufgaben (lib/daily.server.ts) für einen Zeitplan-Dienst.
 *
 * Aufruf:  POST /api/taeglich  mit  Authorization: Bearer <CRON_SECRET>
 * Ohne gesetztes CRON_SECRET ist der Weg gesperrt. */
import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

async function handle(request: Request): Promise<Response> {
  const secret = process.env["CRON_SECRET"];
  const auth = request.headers.get("authorization") || "";
  if (!secret || secret.length < 16 || auth !== `Bearer ${secret}`)
    return new Response("Nicht erlaubt", { status: 401 });
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
