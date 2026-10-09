import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { ARTISTS } from "@/showly/data";
import { LANGS, SITE, langUrl } from "@/showly/seo";
import { BAKERS } from "@/showly/sweets";
import { GUIDES } from "@/showly/guides";
import { CITIES, MIN_INDEX, SERVICES, landingPath, serves } from "@/showly/landing";
import { artistPath, slugify } from "@/showly/slugs";
import { DEFAULT_RADIUS_KM } from "@/showly/travel";

const LEGAL_DOCS_KEYS = ["imprint", "privacy", "security", "cookies", "terms"];

export interface SitemapEntry {
  path: string;
  /** Datum der letzten Änderung (YYYY-MM-DD), nur wenn bekannt */
  lastmod?: string;
  changefreq?: "daily" | "weekly" | "monthly" | "yearly";
  priority?: string;
  /** Seite gibt es nur auf Deutsch (Stadtseiten, Ratgeber): ohne hreflang */
  deOnly?: boolean;
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
    { path: "/buchen", changefreq: "weekly", priority: "0.7", deOnly: true },
    { path: "/ratgeber", changefreq: "monthly", priority: "0.6", deOnly: true },
    ...GUIDES.map((g) => ({ path: `/ratgeber/${g.slug}`, lastmod: g.updated, changefreq: "monthly" as const, priority: "0.6", deOnly: true })),
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
    const db = adminClient();
    const { data } = await db
      .from("artists")
      .select("id, updated_at, descr, media, name, cat, loc")
      .eq("published", true)
      .eq("blocked", false)
      .limit(20000);
    const { data: provs } = await db.from("providers_public").select("id, kind, data").limit(5000);
    const { data: offers } = await db.from("provider_offers_public").select("provider_id, kind").limit(20000);
    const out: SitemapEntry[] = (data || [])
      .filter((r) => {
        /* gleiche Schwelle wie profileIndexable (schema.ts): dünne Profile
           sind noindex und gehören nicht in die Sitemap */
        const d = (r.descr || {}) as { de?: string };
        return String(d.de || "").trim().length >= 160 && Array.isArray(r.media) && r.media.length > 0;
      })
      .map((r) => ({
        path: artistPath({ id: r.id, cat: r.cat, name: r.name, loc: r.loc }),
        ...(r.updated_at ? { lastmod: String(r.updated_at).slice(0, 10) } : {}),
        changefreq: "weekly" as const,
        priority: "0.9",
      }));
    /* Konditoreien mit mindestens einem Angebot (wie in torten.$id.tsx) */
    const withOffers = new Set((offers || []).filter((o) => o.kind === "sweet").map((o) => o.provider_id));
    const bakers = (provs || []).filter((p) => p.kind === "baker");
    for (const p of bakers) if (withOffers.has(p.id)) out.push({ path: `/torten/${p.id}`, changefreq: "weekly", priority: "0.7" });
    /* Stadtseiten nur mit genug echten Anbietern (landing.ts) */
    for (const svc of SERVICES)
      for (const city of CITIES) {
        const n =
          svc.cat === "cake"
            ? bakers.filter((p) => {
                const d = (p.data || {}) as { city?: string; radiusKm?: number };
                return serves(slugify(String(d.city || "")), Number(d.radiusKm) || 0, city);
              }).length
            : (data || []).filter((r) => r.cat === svc.cat && serves(slugify(String(((r.loc || {}) as { de?: string }).de || "")), DEFAULT_RADIUS_KM, city))
                .length;
        if (n >= MIN_INDEX) out.push({ path: landingPath(svc.slug, city.slug), changefreq: "weekly", priority: "0.8", deOnly: true });
      }
    return out;
  } catch {
    return [];
  }
}

/** URL-Blöcke inkl. hreflang-Alternativen für alle Sprachvarianten. */
export function buildSitemapXml(extra: SitemapEntry[] = []): string {
  const urls = [...staticEntries(), ...extra].map((e) => {
    const alt = e.deOnly ? "" : [
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
