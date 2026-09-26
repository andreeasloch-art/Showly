import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { ARTISTS } from "@/showly/data";
import { LANGS, SITE } from "@/showly/seo";
import { BAKERS } from "@/showly/sweets";

const LEGAL_DOCS_KEYS = ["imprint", "privacy", "security", "cookies", "terms"];

interface SitemapEntry {
  path: string;
  changefreq?: "daily" | "weekly" | "monthly" | "yearly";
  priority?: string;
}

function buildEntries(): SitemapEntry[] {
  const entries: SitemapEntry[] = [
    { path: "/", changefreq: "daily", priority: "1.0" },
    { path: "/shop", changefreq: "weekly", priority: "0.8" },
    { path: "/mitmachen", changefreq: "monthly", priority: "0.7" },
    { path: "/hilfe", changefreq: "monthly", priority: "0.5" },
    { path: "/blog", changefreq: "daily", priority: "0.6" },
    { path: "/torten", changefreq: "weekly", priority: "0.8" },
    { path: "/torten/anbieten", changefreq: "monthly", priority: "0.6" },
  ];
  for (const b of BAKERS) {
    entries.push({ path: `/torten/${b.id}`, changefreq: "weekly", priority: "0.7" });
  }
  for (const a of ARTISTS) {
    entries.push({ path: `/kuenstler/${a.id}`, changefreq: "weekly", priority: "0.9" });
  }
  for (const d of LEGAL_DOCS_KEYS) {
    entries.push({ path: `/rechtliches/${d}`, changefreq: "yearly", priority: "0.3" });
  }
  return entries;
}

/** URL-Blöcke inkl. hreflang-Alternativen für alle Sprachvarianten. */
export function buildSitemapXml(): string {
  const urls = buildEntries().map((e) => {
    const alt = [
      ...LANGS.map(
        (l) =>
          `    <xhtml:link rel="alternate" hreflang="${l}" href="${SITE}${e.path}?lang=${l}"/>`,
      ),
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}${e.path}"/>`,
    ].join("\n");
    return [
      `  <url>`,
      `    <loc>${SITE}${e.path}</loc>`,
      alt,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      `  </url>`,
    ]
      .filter(Boolean)
      .join("\n");
  });

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">`,
    ...urls,
    `</urlset>`,
  ].join("\n");
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () =>
        new Response(buildSitemapXml(), {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        }),
    },
  },
});
