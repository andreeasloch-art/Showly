/* robots.txt aus dem Code, damit die Sitemap-Adresse immer zur Domain passt
   (SITE in seo.ts, mit eigener Domain über VITE_SITE_URL). */
import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { SITE } from "@/showly/seo";

/* Alles Öffentliche darf in die Suche. Konto, Kasse und Verwaltung sind
   persönliche Bereiche und gehören nicht in den Suchindex. */
const PRIVATE = ["/admin", "/dashboard", "/portal", "/konto", "/anmelden", "/checkout", "/passwort-", "/auth/", "/api/"];

export function buildRobotsTxt(): string {
  return [
    "User-agent: *",
    "Allow: /",
    "# Sprachvarianten werden über ?lang=de|en|es ausgeliefert und dürfen gecrawlt werden.",
    "Allow: /*?lang=",
    ...PRIVATE.map((p) => `Disallow: ${p}`),
    "",
    `Sitemap: ${SITE}/sitemap.xml`,
    "",
  ].join("\n");
}

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async () =>
        new Response(buildRobotsTxt(), {
          headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
        }),
    },
  },
});
