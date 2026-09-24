/* "Top Act der Woche" – bezahlte Platzierung pro Stadt (7 Tage).
   Jede Stadt der Welt hat ihren eigenen Top Act; bezahlt wird nur für die
   eigene Stadt und deren Umgebung (gleiches Land / gleiche Region). */

import { countryForCity } from "./country";

export const SPOTLIGHT_PRICE = 99;
export const SPOTLIGHT_PRICE_ID = "spotlight_week_99";
export const SPOTLIGHT_DAYS = 7;

export interface SpotlightInput {
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

type Store = Record<string, Spotlight>;

function read(): Store {
  if (typeof localStorage === "undefined") return {};
  let store: Store = {};
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) store = (JSON.parse(raw) as Store) ?? {};
  } catch {
    store = {};
  }
  // Alte Einzel-Platzierung übernehmen
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const s = JSON.parse(legacy) as Spotlight;
      if (s?.city && typeof s.until === "number") {
        const k = citySlug(s.city);
        if (!store[k]) store[k] = s;
      }
      localStorage.removeItem(LEGACY_KEY);
      write(store);
    }
  } catch {
    /* ignorieren */
  }
  // Abgelaufene entfernen
  const now = Date.now();
  let changed = false;
  for (const k of Object.keys(store)) {
    if (!store[k] || store[k]!.until < now) {
      delete store[k];
      changed = true;
    }
  }
  if (changed) write(store);
  return store;
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
  if (typeof localStorage === "undefined") return;
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
  return Object.values(read()).sort((a, b) => a.city.localeCompare(b.city));
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

/** Aktive Platzierung genau für diese Stadt. */
export function getSpotlightFor(city: string): Spotlight | null {
  if (!city) return null;
  return read()[citySlug(city)] ?? null;
}

/** Ist für diese Stadt die Woche schon vergeben? */
export function isCityTaken(city: string): boolean {
  return !!getSpotlightFor(city);
}

/**
 * Platzierung für Stadt + Umgebung.
 * 1. exakt die Stadt, 2. eine Stadt im selben Land (Umgebung).
 */
export function getSpotlightNear(
  city: string | null | undefined,
  country?: string | null,
): { spot: Spotlight; exact: boolean } | null {
  const store = read();
  if (city) {
    const hit = store[citySlug(city)];
    if (hit) return { spot: hit, exact: true };
  }
  const cc = (country || countryForCity(city || "") || "").toLowerCase();
  if (cc) {
    for (const s of Object.values(store)) {
      if ((countryForCity(s.city) || "").toLowerCase() === cc) return { spot: s, exact: false };
    }
  }
  return null;
}

/** Kompatibel: irgendeine aktive Platzierung (erste). */
export function getSpotlight(): Spotlight | null {
  return listSpotlights()[0] ?? null;
}

export function activateSpotlight(input: SpotlightInput): Spotlight {
  const s: Spotlight = { ...input, until: Date.now() + SPOTLIGHT_DAYS * 864e5 };
  const store = read();
  store[citySlug(input.city)] = s;
  write(store);
  return s;
}

export function clearSpotlight(city?: string) {
  const store = read();
  if (city) delete store[citySlug(city)];
  else for (const k of Object.keys(store)) delete store[k];
  write(store);
}

export function daysLeft(s: Spotlight): number {
  return Math.max(1, Math.ceil((s.until - Date.now()) / 864e5));
}
