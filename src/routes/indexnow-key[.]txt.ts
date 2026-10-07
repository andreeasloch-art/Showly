/* Schlüsseldatei für IndexNow (lib/indexnow.server.ts). Suchmaschinen rufen
   sie ab, um zu prüfen, dass die Meldungen wirklich von showly.eu kommen. */
import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

export const Route = createFileRoute("/indexnow-key.txt")({
  server: {
    handlers: {
      GET: async () => {
        const { indexNowKey } = await import("@/lib/indexnow.server");
        const key = indexNowKey();
        return key
          ? new Response(key, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" } })
          : new Response("Not found", { status: 404 });
      },
    },
  },
});
