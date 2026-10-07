/* robots.txt aus dem Code, damit die Sitemap-Adresse immer zur Domain passt
   (SITE in seo.ts, mit eigener Domain über VITE_SITE_URL). */
import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { SITE } from "@/showly/seo";

/* Alles Öffentliche darf in die Suche. Konto, Kasse und Verwaltung sind
   persönliche Bereiche und gehören nicht in den Suchindex. */
const PRIVATE = ["/admin", "/dashboard", "/portal", "/konto", "/anmelden", "/checkout", "/passwort-", "/auth/", "/api/"];

/* Suchmaschinen und KI-Suchen, die öffentliche Seiten finden und als Quelle
   nennen sollen (offizielle Namen laut Anbieter, Stand Oktober 2026):
     OAI-SearchBot    ChatGPT-Suche (OpenAI), nicht Training
     Claude-SearchBot Suche in Claude (Anthropic), nicht Training
     Claude-User      Abruf, wenn jemand Claude nach einer Seite fragt
     PerplexityBot    Perplexity-Suche, nicht Training
     Googlebot        Google-Suche inkl. AI Overviews und AI Mode
     Bingbot          Bing und Copilot
   Eine eigene Gruppe ersetzt für diesen Bot die Regeln unter "*", deshalb
   stehen die privaten Bereiche in jeder Gruppe noch einmal.
   Trainings-Crawler (GPTBot, ClaudeBot, Google-Extended, CCBot) werden hier
   bewusst nicht verändert: Für sie gilt weiter die allgemeine Regel "*".
   Ob Showly-Inhalte für KI-Training genutzt werden dürfen, ist eine eigene
   Entscheidung der Inhaberin (docs/seo/SHOWLY-AI-ROADMAP.md). */
export const SEARCH_BOTS = ["OAI-SearchBot", "Claude-SearchBot", "Claude-User", "PerplexityBot", "Googlebot", "Bingbot"];

function group(agents: string[]): string[] {
  return [
    ...agents.map((a) => `User-agent: ${a}`),
    "Allow: /",
    "# Sprachvarianten werden über ?lang=de|en|es ausgeliefert und dürfen gecrawlt werden.",
    "Allow: /*?lang=",
    ...PRIVATE.map((p) => `Disallow: ${p}`),
    "",
  ];
}

export function buildRobotsTxt(): string {
  return [...group(["*"]), "# Suchmaschinen und KI-Suchen ausdrücklich zugelassen", ...group(SEARCH_BOTS), `Sitemap: ${SITE}/sitemap.xml`, ""].join(
    "\n",
  );
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
