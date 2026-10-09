/* /llms.txt: eine kurze, maschinenlesbare Übersicht der wichtigsten
   öffentlichen Seiten (Vorschlag von llmstxt.org). Kein Rankingfaktor und
   kein Ersatz für robots.txt, Sitemap oder gute Inhalte; Google sagt
   ausdrücklich, dass es solche Dateien nicht braucht. Sie schadet nicht und
   kann KI-Werkzeugen helfen, Showly richtig einzuordnen. */
import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { SITE } from "@/showly/seo";
import { BRAND_DEFINITION } from "@/showly/schema";

export function buildLlmsTxt(): string {
  return [
    "# Showly",
    "",
    `> ${BRAND_DEFINITION.en}`,
    "",
    "Showly (showly.eu) is an artist and entertainment booking platform. It is not related to the TV show tracking app of the same name.",
    "Languages: German (default), English (?lang=en), Spanish (?lang=es).",
    "",
    "## About",
    `- [What is Showly?](${SITE}/ueber-showly?lang=en): definition, audience, booking process, terms for artists`,
    `- [How Showly works](${SITE}/wie-funktioniert-showly?lang=en): booking in 4 steps, cancellation, travel time between shows`,
    `- [Help & FAQ](${SITE}/hilfe?lang=en)`,
    `- [Local pages (German)](${SITE}/buchen): artists, cakes and more by city, e.g. /buchen/zauberer/berlin`,
    `- [Guides (German)](${SITE}/ratgeber): children's birthday ideas, booking checklist, ordering a themed cake, wedding entertainment`,
    "",
    "## Book",
    `- [Find artists](${SITE}/?lang=en): magicians, DJs, bands, musicians, character performers, clowns, acrobats and more`,
    `- [Costumes & decorations](${SITE}/shop?lang=en): rent or buy`,
    `- [Cakes & sweets](${SITE}/torten?lang=en): from patisseries and home bakers`,
    "",
    "## For artists and bakers",
    `- [Join as an artist](${SITE}/mitmachen?lang=en)`,
    `- [Offer cakes](${SITE}/torten/anbieten?lang=en)`,
    "",
    "## Legal",
    `- [Terms](${SITE}/rechtliches/terms)`,
    `- [Legal notice](${SITE}/rechtliches/imprint)`,
    `- [Privacy](${SITE}/rechtliches/privacy)`,
    "",
  ].join("\n");
}

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: async () =>
        new Response(buildLlmsTxt(), {
          headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" },
        }),
    },
  },
});
