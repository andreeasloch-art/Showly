/* Eigene Städte-Datenbank.
   Basis sind die Standardlisten aus country.ts (COUNTRY_CITIES); zusätzlich
   können im Portal eigene Städte angelegt, bearbeitet und gelöscht werden.
   Gespeichert wird lokal unter `showly.cities`. */

import { COUNTRY_CITIES, COUNTRY_LANG } from "./country";

export interface CityEntry {
  /** stabiler Schlüssel (slug) */
  id: string;
  name: string;
  /** ISO-Ländercode, z. B. "de" */
  country: string;
  /** Region/Umgebung, optional */
  region?: string;
  /** aus den Standardlisten (nicht löschbar) */
  builtin?: boolean;
}

const KEY = "showly.cities";
const EVENT = "showly:cities";

export function citySlugKey(s: string): string {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

type Custom = Record<string, CityEntry>;
/** gelöschte Standard-Städte (nur ausgeblendet) */
type Store = { custom: Custom; hidden: string[] };

function read(): Store {
  if (typeof localStorage === "undefined") return { custom: {}, hidden: [] };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}") as Partial<Store>;
    return { custom: raw.custom ?? {}, hidden: raw.hidden ?? [] };
  } catch {
    return { custom: {}, hidden: [] };
  }
}

function write(s: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* Storage nicht verfügbar */
  }
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new CustomEvent(EVENT));
    } catch {
      /* ignorieren */
    }
  }
}

/** Auf Änderungen der Städte-Datenbank hören (auch aus anderen Tabs). */
export function subscribeCities(fn: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (!e.key || e.key === KEY) fn();
  };
  window.addEventListener(EVENT, fn);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, fn);
    window.removeEventListener("storage", onStorage);
  };
}

/** Alle Städte: Standardlisten + eigene Einträge. */
export function allCities(): CityEntry[] {
  const { custom, hidden } = read();
  const out: CityEntry[] = [];
  const seen = new Set<string>();
  for (const [cc, list] of Object.entries(COUNTRY_CITIES)) {
    for (const name of list) {
      const id = citySlugKey(name);
      if (hidden.includes(id) || seen.has(id)) continue;
      seen.add(id);
      out.push({ id, name, country: cc, builtin: true });
    }
  }
  for (const c of Object.values(custom)) {
    const i = out.findIndex((x) => x.id === c.id);
    if (i >= 0) out[i] = { ...out[i]!, ...c, ...(out[i]!.builtin ? { builtin: true } : {}) };
    else out.push(c);
  }
  return out.sort((a, b) => a.country.localeCompare(b.country) || a.name.localeCompare(b.name));
}

/** Städte eines Landes (aus der Datenbank). */
export function citiesOf(country: string | null | undefined): string[] {
  const cc = (country || "").toLowerCase();
  if (!cc) return [];
  return allCities()
    .filter((c) => c.country === cc)
    .map((c) => c.name);
}

/** Land zu einer Stadt (aus der Datenbank). */
export function cityCountry(name: string): string | null {
  const id = citySlugKey((name || "").split(",")[0] ?? name);
  return allCities().find((c) => c.id === id)?.country ?? null;
}

/** Nur die selbst angelegten/bearbeiteten Einträge. */
export function customCities(): CityEntry[] {
  return Object.values(read().custom).sort(
    (a, b) => a.country.localeCompare(b.country) || a.name.localeCompare(b.name),
  );
}

export function hiddenCities(): string[] {
  return read().hidden;
}

/** Stadt anlegen oder bearbeiten. */
export function saveCity(input: { id?: string; name: string; country: string; region?: string }): CityEntry | null {
  const name = (input.name || "").trim();
  const country = (input.country || "").trim().toLowerCase();
  if (!name || !country) return null;
  const s = read();
  const id = input.id || citySlugKey(name);
  const entry: CityEntry = { id, name, country, ...(input.region ? { region: input.region.trim() } : {}) };
  if (input.id && input.id !== citySlugKey(name)) delete s.custom[input.id];
  s.custom[entry.id] = entry;
  s.hidden = s.hidden.filter((h) => h !== entry.id);
  write(s);
  return entry;
}

/** Stadt entfernen (Standard-Städte werden ausgeblendet). */
export function removeCity(id: string) {
  const s = read();
  delete s.custom[id];
  const builtin = Object.entries(COUNTRY_CITIES).some(([, list]) =>
    list.some((n) => citySlugKey(n) === id),
  );
  if (builtin && !s.hidden.includes(id)) s.hidden.push(id);
  write(s);
}

/** Ausgeblendete Standard-Stadt wiederherstellen. */
export function restoreCity(id: string) {
  const s = read();
  s.hidden = s.hidden.filter((h) => h !== id);
  write(s);
}

/** Bekannte Ländercodes für die Auswahl im Portal. */
export function knownCountries(): string[] {
  const set = new Set<string>([...Object.keys(COUNTRY_CITIES), ...Object.keys(COUNTRY_LANG)]);
  for (const c of allCities()) set.add(c.country);
  return [...set].sort();
}
