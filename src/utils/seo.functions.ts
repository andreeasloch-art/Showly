/* Öffentliche Daten für Suchmaschinen, auf dem Server gelesen.
 *
 * Echte Künstlerprofile liegen in der Datenbank. Damit Google, Bing und
 * KI-Suchen (OAI-SearchBot, Claude-SearchBot, PerplexityBot) den Inhalt
 * eines Profils sehen, ohne JavaScript auszuführen, lädt die Profilseite das
 * Profil schon beim Rendern auf dem Server. Gelesen wird nur die öffentliche
 * Sicht artists_public (veröffentlicht, nicht gesperrt, ohne Besitzer). */
import { createServerFn } from "@tanstack/react-start";
import type { ArtistRow } from "@/lib/database.types";

export type PublicArtistRow = Omit<
  ArtistRow,
  "owner" | "published" | "blocked" | "blocked_reason" | "tax_ack_at" | "created_at" | "updated_at"
>;

export const publicArtist = createServerFn({ method: "GET" })
  .inputValidator((d: { id: number }) => ({ id: Math.trunc(Number(d?.id)) || 0 }))
  .handler(async ({ data }): Promise<PublicArtistRow | null> => {
    if (data.id < 100000) return null;
    try {
      const { adminClient } = await import("@/lib/supabase.server");
      const { data: row } = await adminClient().from("artists_public").select("*").eq("id", data.id).maybeSingle();
      return (row as PublicArtistRow | null) ?? null;
    } catch {
      return null; // ohne Datenbank (Vorschau) gibt es keine echten Profile
    }
  });

/* ---------------------------------------------------------------------------
 * Konditoreien und Stadtseiten
 * ------------------------------------------------------------------------ */
import type { OfferRow, Row as ProviderPublicRow } from "@/showly/cloudProviders";

export interface PublicBaker {
  provider: ProviderPublicRow;
  offers: OfferRow[];
}
/* Freie JSON-Felder (data) gehen als Text über die Leitung; parseBakers
   macht daraus wieder PublicBaker */
type Wire = string;
export const parseBakers = (w: Wire | null | undefined): PublicBaker[] => {
  try {
    return w ? (JSON.parse(w) as PublicBaker[]) : [];
  } catch {
    return [];
  }
};

export const publicBaker = createServerFn({ method: "GET" })
  .inputValidator((d: { id: number }) => ({ id: Math.trunc(Number(d?.id)) || 0 }))
  .handler(async ({ data }): Promise<Wire | null> => {
    if (data.id < 100000) return null;
    try {
      const { adminClient } = await import("@/lib/supabase.server");
      const db = adminClient();
      const { data: p } = await db.from("providers_public").select("id, kind, data").eq("id", data.id).eq("kind", "baker").maybeSingle();
      if (!p) return null;
      const { data: offers } = await db.from("provider_offers_public").select("*").eq("provider_id", data.id).limit(200);
      return JSON.stringify([{ provider: p as ProviderPublicRow, offers: (offers || []) as OfferRow[] }]);
    } catch {
      return null;
    }
  });

export interface LandingData {
  artists: PublicArtistRow[];
  bakers: Wire;
}

/** Echte Anbieter für eine Stadtseite (landing.ts): wer dort wohnt oder
 *  mit seinem Umkreis hinkommt. Beispielprofile zählen nicht. */
export const landingData = createServerFn({ method: "GET" })
  .inputValidator((d: { service: string; city: string }) => ({ service: String(d?.service || ""), city: String(d?.city || "") }))
  .handler(async ({ data }): Promise<LandingData> => {
    const { serviceBySlug, cityBySlug, serves } = await import("@/showly/landing");
    const { slugify } = await import("@/showly/slugs");
    const { DEFAULT_RADIUS_KM } = await import("@/showly/travel");
    const svc = serviceBySlug(data.service);
    const city = cityBySlug(data.city);
    if (!svc || !city) return { artists: [], bakers: "[]" };
    try {
      const { adminClient } = await import("@/lib/supabase.server");
      const db = adminClient();
      if (svc.cat === "cake") {
        const { data: provs } = await db.from("providers_public").select("id, kind, data").eq("kind", "baker").limit(2000);
        const near = (provs || []).filter((p) => {
          const d = (p.data || {}) as { city?: string; radiusKm?: number };
          return serves(slugify(String(d.city || "")), Number(d.radiusKm) || 0, city);
        });
        if (!near.length) return { artists: [], bakers: "[]" };
        const { data: offers } = await db
          .from("provider_offers_public")
          .select("*")
          .in("provider_id", near.map((p) => p.id))
          .limit(2000);
        return {
          artists: [],
          bakers: JSON.stringify(
            near.map((p) => ({
              provider: p as ProviderPublicRow,
              offers: ((offers || []) as OfferRow[]).filter((o) => o.provider_id === p.id),
            })),
          ),
        };
      }
      const { data: rows } = await db.from("artists_public").select("*").eq("cat", svc.cat).limit(2000);
      const artists = ((rows || []) as PublicArtistRow[]).filter((r) => {
        const loc = (r.loc || {}) as { de?: string };
        return serves(slugify(String(loc.de || "")), DEFAULT_RADIUS_KM, city);
      });
      return { artists, bakers: "[]" };
    } catch {
      return { artists: [], bakers: "[]" }; // Vorschau ohne Datenbank
    }
  });
