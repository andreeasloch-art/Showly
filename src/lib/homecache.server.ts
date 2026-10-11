/* Zwischenspeicher für die Daten, die jeder Besuch der Startseite braucht:
 * veröffentlichte Künstler, Anbieter samt Angeboten, die laufenden Acts und
 * Locations der Woche und die belegten Termine der Künstler.
 *
 * Vorher fragte jeder Browser das selbst bei der Datenbank ab, gut fünf
 * Abfragen je Besuch. Jetzt holt der Server die Daten einmal und merkt sie
 * sich (routes/api.katalog.ts):
 *   - Künstler, Anbieter, Angebote, Wochen-Plätze: 5 Minuten
 *   - belegte Termine: 1 Minute
 * Ein neuer Künstler erscheint also spätestens nach 5 Minuten für alle.
 * Beim Buchen ändert das nichts: Reservierung und Zahlung prüfen den Termin
 * immer direkt in der Datenbank (cart.server.ts, slot_claims).
 *
 * Gemerkt wird im Speicher des Servers. Auf Cloudflare laufen mehrere
 * Server nebeneinander, jeder hat seinen eigenen Speicher; zusätzlich legt
 * die Route die fertige Antwort in den Cloudflare-Zwischenspeicher. */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { adminClient } from "./supabase.server";

export const CATALOG_TTL_MS = 5 * 60_000;
export const AVAIL_TTL_MS = 60_000;

const todayBerlin = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());

export type SpotlightOut = {
  kind: "act" | "location";
  name: string;
  cat: string;
  city: string;
  tagline: string;
  link: string | null;
  artistId: number | null;
  venueId: number | null;
  until: string;
};

/** Laufende, bezahlte Acts und Locations der Woche */
export async function activeSpotlights(): Promise<SpotlightOut[]> {
  const today = todayBerlin();
  const { data } = await adminClient()
    .from("spotlights")
    .select("kind, name, cat, city, tagline, link, artist_id, venue_id, ends_on")
    .eq("status", "paid")
    .lte("starts_on", today)
    .gte("ends_on", today)
    .limit(500);
  return (data || []).map((r) => ({
    kind: r.kind === "location" ? "location" : "act",
    name: r.name,
    cat: r.cat,
    city: r.city,
    tagline: r.tagline,
    link: r.link,
    artistId: r.artist_id,
    venueId: r.venue_id,
    until: r.ends_on,
  }));
}

/** Öffentliche Ansichten mit den Rechten eines nicht angemeldeten Besuchers
 *  lesen, genau wie vorher der Browser. So kommt nichts mit, was die
 *  Freigaben in der Datenbank nicht ohnehin öffentlich zeigen. */
function publicClient() {
  const url = process.env["VITE_SUPABASE_URL"];
  const key = process.env["VITE_SUPABASE_ANON_KEY"];
  if (!url || !key) throw new Error("Datenbank nicht eingerichtet");
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function loadCatalog() {
  const sb = publicClient();
  const [artists, providers, offers, spotlights] = await Promise.all([
    sb.from("artists_public").select("*").limit(1000),
    sb.from("providers_public").select("id, kind, data").limit(1000),
    sb.from("provider_offers_public").select("*").limit(3000),
    activeSpotlights(),
  ]);
  /* Lieber gar nicht merken als eine halbe Liste fünf Minuten lang zeigen */
  if (artists.error || providers.error || offers.error) throw new Error("Katalog nicht lesbar");
  return { artists: artists.data || [], providers: providers.data || [], offers: offers.data || [], spotlights };
}

async function loadAvail(artistIds: number[]) {
  const { scheduleEntries } = await import("./schedule.server");
  const map = await scheduleEntries(adminClient(), artistIds, todayBerlin());
  const out: Record<number, Record<string, string[]>> = {};
  for (const [k, entries] of map) {
    const [id, day] = k.split("|");
    (out[Number(id)] ||= {})[day!] = entries;
  }
  return out;
}

type Memo<T> = { at: number; value: T } | null;
let catalogMemo: Memo<Awaited<ReturnType<typeof loadCatalog>>> = null;
let availMemo: Memo<Record<number, Record<string, string[]>>> = null;
/* Laufende Abfragen teilen: kommen 50 Besucher in derselben Sekunde, fragt
   der Server trotzdem nur einmal */
let catalogFlight: Promise<Awaited<ReturnType<typeof loadCatalog>>> | null = null;
let availFlight: Promise<Record<number, Record<string, string[]>>> | null = null;

export async function cachedCatalog(now = Date.now()) {
  if (!catalogMemo || now - catalogMemo.at > CATALOG_TTL_MS) {
    catalogFlight ||= loadCatalog().finally(() => (catalogFlight = null));
    catalogMemo = { at: now, value: await catalogFlight };
  }
  const catalog = catalogMemo.value;
  if (!availMemo || now - availMemo.at > AVAIL_TTL_MS) {
    const ids = catalog.artists.map((a) => a.id).filter((n): n is number => typeof n === "number");
    availFlight ||= loadAvail(ids).finally(() => (availFlight = null));
    availMemo = { at: now, value: await availFlight };
  }
  return { ...catalog, avail: availMemo.value };
}

export type CatalogOut = Awaited<ReturnType<typeof cachedCatalog>>;
