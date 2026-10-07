import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { ARTISTS } from "@/showly/data";
import { LANGS, SITE, langUrl } from "@/showly/seo";
import { BAKERS } from "@/showly/sweets";

const LEGAL_DOCS_KEYS = ["imprint", "privacy", "security", "cookies", "terms"];

export interface SitemapEntry {
  path: string;
  /** Datum der letzten Änderung (YYYY-MM-DD), nur wenn bekannt */
  lastmod?: string;
  changefreq?: "daily" | "weekly" | "monthly" | "yearly";
  priority?: string;
}

/* Nur kanonische, indexierbare und öffentliche Seiten. Nicht hinein gehören:
   Konto, Kasse, Verwaltung (robots.txt), Beispielprofile und Beispiel-
   Anbieter (noindex, sie zeigen nur, wie ein Angebot aussehen kann) und
   Filter- oder Suchadressen. */
function staticEntries(): SitemapEntry[] {
  const entries: SitemapEntry[] = [
    { path: "/", changefreq: "daily", priority: "1.0" },
    { path: "/ueber-showly", changefreq: "monthly", priority: "0.8" },
    { path: "/wie-funktioniert-showly", changefreq: "monthly", priority: "0.8" },
    { path: "/shop", changefreq: "weekly", priority: "0.8" },
    { path: "/torten", changefreq: "weekly", priority: "0.8" },
    { path: "/mitmachen", changefreq: "monthly", priority: "0.7" },
    { path: "/torten/anbieten", changefreq: "monthly", priority: "0.6" },
    { path: "/hilfe", changefreq: "monthly", priority: "0.6" },
    { path: "/blog", changefreq: "daily", priority: "0.6" },
  ];
  for (const b of BAKERS) {
    if (!b.demo) entries.push({ path: `/torten/${b.id}`, changefreq: "weekly", priority: "0.7" });
  }
  for (const a of ARTISTS) {
    if (!a.demo && !(a as { fromDb?: boolean }).fromDb) entries.push({ path: `/kuenstler/${a.id}`, changefreq: "weekly", priority: "0.9" });
  }
  for (const d of LEGAL_DOCS_KEYS) {
    entries.push({ path: `/rechtliches/${d}`, changefreq: "yearly", priority: "0.3" });
  }
  return entries;
}

/* Veröffentlichte echte Künstlerprofile aus der Datenbank, mit dem Datum der
   letzten Änderung. Ohne Datenbank (Vorschau) bleibt die Liste leer. */
async function dbEntries(): Promise<SitemapEntry[]> {
  try {
    const { adminClient } = await import("@/lib/supabase.server");
    const { data } = await adminClient()
      .from("artists")
      .select("id, updated_at, descr, media")
      .eq("published", true)
      .eq("blocked", false)
      .limit(20000);
    return (data || [])
      .filter((r) => {
        /* gleiche Schwelle wie profileIndexable (schema.ts): dünne Profile
           sind noindex und gehören nicht in die Sitemap */
        const d = (r.descr || {}) as { de?: string };
        return String(d.de || "").trim().length >= 160 && Array.isArray(r.media) && r.media.length > 0;
      })
      .map((r) => ({
        path: `/kuenstler/${r.id}`,
        ...(r.updated_at ? { lastmod: String(r.updated_at).slice(0, 10) } : {}),
        changefreq: "weekly" as const,
        priority: "0.9",
      }));
  } catch {
    return [];
  }
}

/** URL-Blöcke inkl. hreflang-Alternativen für alle Sprachvarianten. */
export function buildSitemapXml(extra: SitemapEntry[] = []): string {
  const urls = [...staticEntries(), ...extra].map((e) => {
    const alt = [
      ...LANGS.map(
        (l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${langUrl(e.path, l)}"/>`,
      ),
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}${e.path}"/>`,
    ].join("\n");
    return [
      `  <url>`,
      `    <loc>${SITE}${e.path}</loc>`,
      alt,
      e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
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
        new Response(buildSitemapXml(await dbEntries()), {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        }),
    },
  },
});
