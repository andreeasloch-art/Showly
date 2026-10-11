/* Alles, was die Startseite aus der Datenbank braucht, in einer Antwort und
 * zwischengespeichert (lib/homecache.server.ts). Der Browser holt das hier
 * statt fünf einzelner Abfragen; klappt es nicht, fragt er wie früher selbst
 * (showly/homeCache.ts). */
import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

/* Wie lange Browser und Cloudflare die fertige Antwort behalten dürfen.
   Kurz, weil die belegten Termine mit drinstehen. */
const MAX_AGE = 60;

type EdgeCache = { match(req: Request): Promise<Response | undefined>; put(req: Request, res: Response): Promise<void> };
const edgeCache = (): EdgeCache | null => {
  try {
    return (globalThis as unknown as { caches?: { default?: EdgeCache } }).caches?.default ?? null;
  } catch {
    return null;
  }
};

export const Route = createFileRoute("/api/katalog")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        /* Fester Schlüssel ohne Abfrageteil, damit niemand mit ?x=1 den
           Zwischenspeicher umgeht */
        const key = new Request(new URL("/api/katalog", request.url).toString());
        const edge = edgeCache();
        const hit = await edge?.match(key).catch(() => undefined);
        if (hit) return hit;
        try {
          const { cachedCatalog } = await import("@/lib/homecache.server");
          const body = await cachedCatalog();
          const res = Response.json(body, {
            headers: {
              "Cache-Control": `public, max-age=${MAX_AGE}, s-maxage=${MAX_AGE}, stale-while-revalidate=${MAX_AGE * 5}`,
              "X-Robots-Tag": "noindex",
            },
          });
          await edge?.put(key, res.clone()).catch(() => undefined);
          return res;
        } catch {
          return Response.json({ error: "nicht verfügbar" }, { status: 503, headers: { "Cache-Control": "no-store" } });
        }
      },
    },
  },
});
