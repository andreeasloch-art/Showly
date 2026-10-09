/* Echte Künstlerprofile aus der Datenbank in den Katalog der App holen.
 *
 * Veröffentlicht werden Profile erst nach bestandener Ausweisprüfung; die
 * liest jeder über die öffentliche Sicht (ohne Besitzerkennung). Das eigene
 * Profil sieht der Künstler auch vorher schon, damit er es pflegen kann.
 * Die Kennungen beginnen bei 100000 und überschneiden sich nie mit den
 * Beispielprofilen. */
import type { ArtistRow } from "@/lib/database.types";
import { ARTISTS, CATS, type Artist } from "./data";
import { isBackendConfigured, supabase } from "@/lib/supabase";
import { preloadMedia } from "./media";
import { cleanWorkHours } from "./workHours";
import { cleanPackages } from "./plannerPackages";
import { tierOf } from "./policies";
import { cleanSurcharges } from "./surcharges";

/* Titelbilder werden synchron als Hintergrund gesetzt; deshalb ihre Adressen
   gleich nach dem Laden der Profile holen (nur freigegebene kommen zurück). */
function preloadCloudGalleries(ids: string[]) {
  return ids.length ? preloadMedia(ids) : Promise.resolve();
}

type PublicRow = Omit<ArtistRow, "owner" | "published" | "blocked" | "blocked_reason" | "tax_ack_at" | "created_at" | "updated_at">;

const list = (v: unknown): { de: string[]; en: string[] } => {
  const o = (v || {}) as { de?: string[]; en?: string[] };
  const de = Array.isArray(o.de) ? o.de : [];
  return { de, en: Array.isArray(o.en) ? o.en : de };
};
const txt = (v: unknown): { de: string; en: string; es?: string } => {
  const o = (v || {}) as { de?: string; en?: string; es?: string };
  const de = o.de || "";
  return { de, en: o.en || de, ...(o.es ? { es: o.es } : {}) };
};

export function artistFromRow(r: PublicRow): Artist {
  const cat = CATS.find((c) => c.id === r.cat);
  const specs = list(r.specs);
  return {
    id: r.id,
    cat: r.cat,
    icon: cat ? cat.icon : "mask",
    color: r.color || "#F1EAFF",
    price: Math.round(r.price_cents) / 100,
    minHours: 1,
    rating: Number(r.rating) || 0,
    reviews: r.review_count || 0,
    verified: r.verified,
    superhost: r.superhost,
    events: r.events_count || 0,
    /* Keine erfundene Antwortzeit: ohne Wert gilt die Frist aus den AGB */
    responseTime: txt(r.response_time).de ? txt(r.response_time) : { de: "48 Std.", en: "48h", es: "48 h" },
    responseRate: r.response_rate || "100%",
    shopIds: [],
    name: txt(r.name),
    loc: txt(r.loc),
    desc: txt(r.descr),
    tags: list(r.tags),
    langs: list(r.langs),
    includes: list(r.includes),
    specs: specs.de,
    figures: specs.de,
    rev: [],
    instantBook: r.instant_book !== false,
    business: r.business !== false,
    /* Galerie: Kennungen der Server-Dateien mit "c:" davor. Adressen gibt der
       Server öffentlich nur für freigegebene Dateien heraus (media.functions). */
    photos: (Array.isArray(r.media) ? r.media : []).map((m) => ({
      id: "c:" + m.id,
      kind: m.kind === "video" ? ("video" as const) : ("image" as const),
      ratio: Number(m.ratio) || 1,
    })),
    workHours: cleanWorkHours(r.work_hours),
    packages: cleanPackages(r.packages),
    cancelTier: tierOf(r.cancel_tier),
    standby: r.standby === true,
    cancelRate: Number(r.cancel_rate) || 0,
    surcharges: cleanSurcharges(r.surcharges),
    awayUntil: r.away_until ?? null,
    fromDb: true,
  };
}

export function upsertArtist(a: Artist) {
  const i = ARTISTS.findIndex((x) => x.id === a.id);
  if (i >= 0) ARTISTS[i] = { ...ARTISTS[i], ...a };
  else ARTISTS.push(a);
}

let loaded = false;

/** Veröffentlichte Profile laden (einmal je Seitenaufruf) und das eigene,
 *  falls angemeldet. Gibt die Anzahl neu bekannter Profile zurück. */
export async function hydrateDbArtists(ownerId?: string): Promise<number> {
  if (!isBackendConfigured()) return 0;
  const sb = supabase();
  let n = 0;
  if (!loaded) {
    loaded = true;
    const { data } = await sb.from("artists_public").select("*").limit(1000);
    for (const r of data || []) {
      upsertArtist(artistFromRow(r));
      n++;
    }
    void preloadCloudGalleries((data || []).flatMap((r) => (Array.isArray(r.media) ? r.media : []).map((m) => "c:" + m.id)));
  }
  if (ownerId) {
    const { data } = await sb.from("artists").select("*").eq("owner", ownerId).limit(5);
    for (const r of data || []) {
      upsertArtist(artistFromRow(r));
      n++;
    }
    void preloadCloudGalleries((data || []).flatMap((r) => (Array.isArray(r.media) ? r.media : []).map((m) => "c:" + m.id)));
  }
  return n;
}
