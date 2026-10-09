/* "Top Act der Woche" – bezahlte Platzierung pro Stadt (7 Tage je Woche).
   Jede Stadt der Welt hat bis zu fünf Top Acts gleichzeitig; sie wechseln
   sich oben auf der Startseite im Kopfbereich ab. Bezahlt wird nur für die
   eigene Stadt und deren Umgebung (gleiches Land / gleiche Region). */

import { allowed } from "./consent";
import { countryForCity } from "./country";

export const SPOTLIGHT_PRICE = 99;
export const SPOTLIGHT_PRICE_ID = "spotlight_week_99";
export const SPOTLIGHT_DAYS = 7;
/** Plätze je Stadt und Tag */
export const SPOTLIGHT_SLOTS = 5;

export interface SpotlightInput {
  /** gebuchte Wochen (1 bis 4), Standard 1 */
  weeks?: number | undefined;
  name: string;
  cat: string;
  city: string;
  tagline: string;
  image?: string;
  link?: string;
  email?: string;
}

export interface Spotlight extends SpotlightInput {
  until: number;
}

const KEY = "showly.spotlights";
const LEGACY_KEY = "showly.spotlight";

/** Stadtname -> stabiler Schlüssel (akzent- und schreibweisenunabhängig). */
export function citySlug(city: string): string {
  return String(city || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

type Store = Spotlight[];

/* Gebuchte Top Acts aus der Datenbank (für alle sichtbar). Sie stehen vor
   den Einträgen aus diesem Browser. */
let cloud: Store = [];
export function setCloudSpotlights(list: (SpotlightInput & { until: number })[]) {
  cloud = [...list];
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

/** Nur die Einträge aus diesem Browser (ohne Datenbank) */
function readOwn(): Store {
  if (typeof localStorage === "undefined") return [];
  let store: Store = [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]") as Store | Record<string, Spotlight>;
    /* Früher eine Platzierung je Stadt (Objekt), jetzt eine Liste */
    store = Array.isArray(raw) ? raw : Object.values(raw ?? {});
  } catch {
    store = [];
  }
  // Alte Einzel-Platzierung übernehmen
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const s = JSON.parse(legacy) as Spotlight;
      if (s?.city && typeof s.until === "number") store.push(s);
      localStorage.removeItem(LEGACY_KEY);
      write(store);
    }
  } catch {
    /* ignorieren */
  }
  const now = Date.now();
  const live = store.filter((x) => x && x.city && x.until >= now);
  if (live.length !== store.length) write(live);
  return live;
}

function read(): Store {
  const now = Date.now();
  return [...cloud.filter((v) => v.until >= now), ...readOwn()];
}

function write(store: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* Storage nicht verfügbar */
  }
  emit();
}

/* ---- Live-Aktualisierung ---------------------------------------------- */

const EVENT = "showly:spotlights";

function emit() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch {
    /* ignorieren */
  }
}

/** Auf Änderungen an Platzierungen/Klicks hören (auch aus anderen Tabs). */
export function subscribeSpotlights(fn: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (!e.key || e.key === KEY || e.key === CLICK_KEY) fn();
  };
  window.addEventListener(EVENT, fn);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, fn);
    window.removeEventListener("storage", onStorage);
  };
}

/* ---- Klick-Tracking pro Stadt ------------------------------------------ */

const CLICK_KEY = "showly.spotlight.clicks";

type Clicks = Record<string, { city: string; act: string; clicks: number; last: number }>;

function readClicks(): Clicks {
  if (typeof localStorage === "undefined") return {};
  try {
    return (JSON.parse(localStorage.getItem(CLICK_KEY) || "{}") as Clicks) ?? {};
  } catch {
    return {};
  }
}

/** Klick auf die Top-Act-Kachel zählen (pro Stadt + Act). */
export function trackSpotlightClick(city: string, act: string) {
  if (typeof localStorage === "undefined" || !allowed("comfort")) return;
  const all = readClicks();
  const k = `${citySlug(city)}::${citySlug(act)}`;
  const prev = all[k];
  all[k] = {
    city: city || "",
    act: act || "",
    clicks: (prev?.clicks ?? 0) + 1,
    last: Date.now(),
  };
  try {
    localStorage.setItem(CLICK_KEY, JSON.stringify(all));
  } catch {
    /* ignorieren */
  }
  emit();
}

/** Klicks für eine Stadt (optional für einen bestimmten Act). */
export function clicksFor(city: string, act?: string): number {
  const all = readClicks();
  const cs = citySlug(city);
  let n = 0;
  for (const [k, v] of Object.entries(all)) {
    if (!k.startsWith(cs + "::")) continue;
    if (act && citySlug(act) !== citySlug(v.act)) continue;
    n += v.clicks;
  }
  return n;
}

/** Klick-Statistik – nach Klicks sortiert. */
export function listClickStats(): { city: string; act: string; clicks: number; last: number }[] {
  return Object.values(readClicks()).sort((a, b) => b.clicks - a.clicks);
}

/** Alle aktiven Platzierungen (weltweit). */
export function listSpotlights(): Spotlight[] {
  return read().sort((a, b) => a.city.localeCompare(b.city));
}

/** Eigene Platzierungen (alle Städte) eines Künstlers – per E-Mail oder Profil-Link. */
export function listSpotlightsOf(email?: string | null, link?: string | null): Spotlight[] {
  const e = (email || "").trim().toLowerCase();
  return listSpotlights().filter(
    (s) =>
      (e && (s.email || "").trim().toLowerCase() === e) ||
      (link && s.link === link) ||
      false,
  );
}

/** Ein Act steht in einer Stadt nur einmal, auch wenn er doppelt gespeichert ist */
function uniqueActs(list: Spotlight[]): Spotlight[] {
  const seen = new Set<string>();
  return list.filter((s) => {
    const k = citySlug(s.city) + "::" + (s.link || citySlug(s.name));
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Alle aktiven Top Acts genau dieser Stadt (höchstens fünf). */
export function getSpotlightsFor(city: string): Spotlight[] {
  if (!city) return [];
  const k = citySlug(city);
  return uniqueActs(read().filter((s) => citySlug(s.city) === k)).slice(0, SPOTLIGHT_SLOTS);
}

/** Erste aktive Platzierung dieser Stadt. */
export function getSpotlightFor(city: string): Spotlight | null {
  return getSpotlightsFor(city)[0] ?? null;
}

/** Freie Plätze in dieser Stadt (0 bis 5). */
export function freeSlots(city: string): number {
  return Math.max(0, SPOTLIGHT_SLOTS - getSpotlightsFor(city).length);
}

/** Sind in dieser Stadt alle fünf Plätze vergeben? */
export function isCityTaken(city: string): boolean {
  return freeSlots(city) === 0;
}

/**
 * Top Acts für Stadt + Umgebung, höchstens fünf.
 * Zuerst die der Stadt selbst, dann aufgefüllt aus demselben Land.
 */
export function getSpotlightsNear(
  city: string | null | undefined,
  country?: string | null,
): { spot: Spotlight; exact: boolean }[] {
  const all = read();
  const k = city ? citySlug(city) : "";
  const exact = k ? uniqueActs(all.filter((s) => citySlug(s.city) === k)) : [];
  const out = exact.map((spot) => ({ spot, exact: true }));
  const cc = (country || countryForCity(city || "") || "").toLowerCase();
  if (cc && out.length < SPOTLIGHT_SLOTS) {
    const near = uniqueActs(
      all.filter((s) => citySlug(s.city) !== k && (countryForCity(s.city) || "").toLowerCase() === cc),
    );
    for (const spot of near) out.push({ spot, exact: false });
  }
  return out.slice(0, SPOTLIGHT_SLOTS);
}

/** Erster Top Act für Stadt + Umgebung. */
export function getSpotlightNear(
  city: string | null | undefined,
  country?: string | null,
): { spot: Spotlight; exact: boolean } | null {
  return getSpotlightsNear(city, country)[0] ?? null;
}

/** Kompatibel: irgendeine aktive Platzierung (erste). */
export function getSpotlight(): Spotlight | null {
  return listSpotlights()[0] ?? null;
}

export function activateSpotlight(input: SpotlightInput): Spotlight {
  const s: Spotlight = { ...input, until: Date.now() + SPOTLIGHT_DAYS * Math.max(1, Math.min(4, input.weeks ?? 1)) * 864e5 };
  const k = citySlug(input.city);
  /* Derselbe Act in derselben Stadt ersetzt seinen alten Eintrag */
  const own = readOwn().filter((x) => !(citySlug(x.city) === k && citySlug(x.name) === citySlug(input.name)));
  write([...own, s]);
  return s;
}

/** Platzierungen aus diesem Browser löschen: für eine Stadt (optional nur einen Act) oder alle. */
export function clearSpotlight(city?: string, name?: string) {
  if (!city) return write([]);
  const k = citySlug(city);
  write(readOwn().filter((x) => !(citySlug(x.city) === k && (!name || citySlug(x.name) === citySlug(name)))));
}

export function daysLeft(s: Spotlight): number {
  return Math.max(1, Math.ceil((s.until - Date.now()) / 864e5));
}

let cloudLoaded = false;
/** Laufende Top Acts aus der Datenbank holen (nur mit angebundener Datenbank) */
export async function loadCloudSpotlights() {
  if (cloudLoaded || typeof window === "undefined") return;
  cloudLoaded = true;
  try {
    const { isBackendConfigured } = await import("@/lib/supabase");
    if (!isBackendConfigured()) return;
    const { activeTopActs } = await import("@/utils/spotlight.functions");
    const list = await activeTopActs();
    setCloudSpotlights(
      list.map((r) => ({
        name: r.name,
        cat: r.cat,
        city: r.city,
        tagline: r.tagline,
        ...(r.link ? { link: r.link } : {}),
        ...(r.artistId ? { image: `/api/bild/kuenstler/${r.artistId}` } : {}),
        until: Date.parse(r.until + "T23:59:59"),
      })),
    );
  } catch {
    cloudLoaded = false;
  }
}
