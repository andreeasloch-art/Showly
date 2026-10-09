/* Wöchentliche Abrechnung mit den Anbietern (lib/belege.server.ts):
 * Provisionsrechnung und Auszahlungsabrechnung über die Vorwoche.
 *
 * Aufruf:  POST /api/woche  mit  Authorization: Bearer <Schlüssel>
 * Der Datenbank-Zeitplan ruft montags um 04:00 und 05:00 UTC auf; gerechnet
 * wird nur, wenn es in Deutschland 6 Uhr ist (Sommer- und Winterzeit).
 * Doppelte Aufrufe erzeugen nichts doppelt. */
import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

async function handle(request: Request): Promise<Response> {
  const { cronAllowed } = await import("@/lib/cron.server");
  if (!(await cronAllowed(request))) return new Response("Nicht erlaubt", { status: 401 });
  const jetzt = new Date();
  const stunde = Number(new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", hour12: false }).format(jetzt));
  const tag = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Berlin", weekday: "short" }).format(jetzt);
  const sofort = new URL(request.url).searchParams.get("sofort") === "1";
  if (!sofort && (tag !== "Mon" || stunde !== 6)) {
    return new Response(JSON.stringify({ uebersprungen: true, tag, stunde }), { headers: { "Content-Type": "application/json" } });
  }
  const { wochenabrechnungAlle } = await import("@/lib/belege.server");
  const result = await wochenabrechnungAlle();
  return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
}

export const Route = createFileRoute("/api/woche")({
  server: {
    handlers: {
      POST: ({ request }) => handle(request),
    },
  },
});
