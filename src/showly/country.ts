// Standorterkennung (Zeitzone) -> Land, Sprache und lokale Städtevorschläge.

import type { Lang } from "./data";
import { citiesOf, cityCountry } from "./cities";

export type CountryCode = string;

/** Zeitzone -> ISO-Ländercode (Auszug der relevanten Märkte). */
export const TZ_COUNTRY: Record<string, CountryCode> = {
  "Europe/Berlin": "de",
  "Europe/Busingen": "de",
  "Europe/Vienna": "at",
  "Europe/Zurich": "ch",
  "Europe/London": "gb",
  "Europe/Belfast": "gb",
  "Europe/Dublin": "ie",
  "Europe/Madrid": "es",
  "Atlantic/Canary": "es",
  "Africa/Ceuta": "es",
  "America/Mexico_City": "mx",
  "America/Monterrey": "mx",
  "America/Cancun": "mx",
  "America/Tijuana": "mx",
  "America/Bogota": "co",
  "America/Lima": "pe",
  "America/Santiago": "cl",
  "America/Argentina/Buenos_Aires": "ar",
  "America/Argentina/Cordoba": "ar",
  "America/Montevideo": "uy",
  "America/Caracas": "ve",
  "America/Guatemala": "gt",
  "America/Havana": "cu",
  "America/Santo_Domingo": "do",
  "America/Panama": "pa",
  "America/Costa_Rica": "cr",
  "America/La_Paz": "bo",
  "America/Asuncion": "py",
  "America/Guayaquil": "ec",
  "America/Managua": "ni",
  "America/Tegucigalpa": "hn",
  "America/El_Salvador": "sv",
  "America/Puerto_Rico": "pr",
  "America/New_York": "us",
  "America/Chicago": "us",
  "America/Denver": "us",
  "America/Phoenix": "us",
  "America/Los_Angeles": "us",
  "America/Anchorage": "us",
  "Pacific/Honolulu": "us",
  "America/Toronto": "ca",
  "America/Vancouver": "ca",
  "America/Edmonton": "ca",
  "America/Winnipeg": "ca",
  "America/Halifax": "ca",
  "Australia/Sydney": "au",
  "Australia/Melbourne": "au",
  "Australia/Brisbane": "au",
  "Australia/Perth": "au",
  "Australia/Adelaide": "au",
  "Pacific/Auckland": "nz",
};

/** Land -> Sprache der App. */
export const COUNTRY_LANG: Record<string, Lang> = {
  de: "de",
  at: "de",
  ch: "de",
  li: "de",
  es: "es",
  mx: "es",
  ar: "es",
  co: "es",
  cl: "es",
  pe: "es",
  ve: "es",
  ec: "es",
  bo: "es",
  py: "es",
  uy: "es",
  cr: "es",
  pa: "es",
  ni: "es",
  hn: "es",
  sv: "es",
  gt: "es",
  cu: "es",
  do: "es",
  pr: "es",
  gq: "es",
  gb: "en",
  ie: "en",
  us: "en",
  ca: "en",
  au: "en",
  nz: "en",
  za: "en",
  sg: "en",
};

/** Städtevorschläge je Land (nur das erkannte Land wird initial gezeigt). */
export const COUNTRY_CITIES: Record<string, string[]> = {
  de: [
    "Berlin", "Hamburg", "München", "Köln", "Frankfurt am Main", "Stuttgart", "Düsseldorf",
    "Leipzig", "Dortmund", "Essen", "Bremen", "Dresden", "Hannover", "Nürnberg", "Duisburg",
    "Bochum", "Wuppertal", "Bielefeld", "Bonn", "Münster", "Karlsruhe", "Mannheim", "Augsburg",
    "Wiesbaden", "Mönchengladbach", "Braunschweig", "Kiel", "Aachen", "Chemnitz", "Magdeburg",
    "Freiburg im Breisgau", "Mainz", "Lübeck", "Erfurt", "Rostock", "Kassel", "Potsdam",
    "Saarbrücken", "Heidelberg", "Regensburg", "Würzburg", "Ulm", "Osnabrück", "Oldenburg",
    "Darmstadt", "Paderborn", "Göttingen", "Koblenz", "Trier", "Jena", "Konstanz", "Bamberg",
  ],
  at: [
    "Wien", "Graz", "Linz", "Salzburg", "Innsbruck", "Klagenfurt", "Villach", "Wels",
    "St. Pölten", "Dornbirn", "Bregenz", "Eisenstadt", "Baden bei Wien", "Krems an der Donau",
  ],
  ch: [
    "Zürich", "Bern", "Basel", "Genf", "Lausanne", "Luzern", "Winterthur", "St. Gallen",
    "Lugano", "Biel/Bienne", "Thun", "Chur", "Zug", "Sion", "Fribourg", "Neuchâtel",
  ],
  gb: [
    "London", "Manchester", "Birmingham", "Liverpool", "Leeds", "Glasgow", "Edinburgh",
    "Bristol", "Sheffield", "Cardiff", "Belfast", "Newcastle upon Tyne", "Nottingham",
    "Brighton", "Oxford", "Cambridge", "Leicester", "Coventry", "Southampton", "York",
    "Aberdeen", "Bath", "Norwich", "Plymouth",
  ],
  ie: ["Dublin", "Cork", "Galway", "Limerick", "Waterford", "Kilkenny", "Belfast", "Sligo"],
  us: [
    "New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia", "San Antonio",
    "San Diego", "Dallas", "Austin", "San Jose", "San Francisco", "Seattle", "Denver", "Boston",
    "Miami", "Atlanta", "Las Vegas", "Orlando", "Washington, D.C.", "Nashville", "New Orleans",
    "Portland", "Detroit", "Minneapolis", "Charlotte", "Tampa", "Salt Lake City",
  ],
  ca: [
    "Toronto", "Vancouver", "Montreal", "Calgary", "Ottawa", "Edmonton", "Quebec City",
    "Halifax", "Winnipeg", "Victoria", "Hamilton", "London (Ontario)",
  ],
  au: [
    "Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Canberra", "Gold Coast",
    "Hobart", "Darwin", "Newcastle", "Cairns", "Wollongong",
  ],
  nz: ["Auckland", "Wellington", "Christchurch", "Hamilton", "Dunedin", "Queenstown", "Tauranga"],
  es: [
    "Madrid", "Barcelona", "Valencia", "Sevilla", "Zaragoza", "Málaga", "Murcia",
    "Palma de Mallorca", "Las Palmas de Gran Canaria", "Bilbao", "Alicante", "Córdoba",
    "Valladolid", "Vigo", "Gijón", "Granada", "A Coruña", "Vitoria-Gasteiz", "Elche",
    "Santa Cruz de Tenerife", "Oviedo", "Pamplona", "Santander", "Salamanca", "San Sebastián",
    "Toledo", "Marbella", "Ibiza", "Cádiz", "Tarragona",
  ],
  mx: [
    "Ciudad de México", "Guadalajara", "Monterrey", "Puebla", "Tijuana", "León", "Querétaro",
    "Mérida", "Cancún", "Toluca", "Ciudad Juárez", "Acapulco", "Oaxaca", "Puerto Vallarta",
  ],
  ar: [
    "Buenos Aires", "Córdoba (Argentina)", "Rosario", "Mendoza", "La Plata", "Mar del Plata",
    "San Miguel de Tucumán", "Salta", "Bariloche",
  ],
  co: [
    "Bogotá", "Medellín", "Cali", "Barranquilla", "Cartagena", "Bucaramanga", "Santa Marta",
    "Pereira",
  ],
  cl: [
    "Santiago de Chile", "Valparaíso", "Viña del Mar", "Concepción", "Antofagasta", "La Serena",
  ],
  pe: ["Lima", "Arequipa", "Trujillo", "Cusco", "Chiclayo", "Piura"],
  ve: ["Caracas", "Maracaibo", "Valencia (Venezuela)", "Barquisimeto", "Maracay"],
  ec: ["Quito", "Guayaquil", "Cuenca", "Manta", "Ambato"],
  bo: ["La Paz", "Santa Cruz de la Sierra", "Cochabamba", "Sucre"],
  py: ["Asunción", "Ciudad del Este", "Encarnación"],
  uy: ["Montevideo", "Punta del Este", "Salto"],
  cr: ["San José (Costa Rica)", "Liberia", "Alajuela"],
  pa: ["Ciudad de Panamá", "Colón", "David"],
  ni: ["Managua", "León (Nicaragua)", "Granada (Nicaragua)"],
  hn: ["Tegucigalpa", "San Pedro Sula"],
  sv: ["San Salvador", "Santa Ana"],
  gt: ["Ciudad de Guatemala", "Antigua Guatemala", "Quetzaltenango"],
  cu: ["La Habana", "Santiago de Cuba", "Varadero"],
  do: ["Santo Domingo", "Punta Cana", "Santiago de los Caballeros"],
  pr: ["San Juan (Puerto Rico)", "Ponce", "Mayagüez"],
  gq: ["Malabo", "Bata"],
};

/** Ländercode aus der Zeitzone bzw. dem Browser-Locale ableiten. */
export function detectCountry(): CountryCode | null {
  if (typeof window === "undefined") return null;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TZ_COUNTRY[tz]) return TZ_COUNTRY[tz]!;
  } catch {
    /* Zeitzone nicht verfügbar */
  }
  const locales: string[] = [
    ...(Array.isArray(navigator.languages) ? navigator.languages : []),
    navigator.language || "",
  ];
  for (const raw of locales) {
    const m = /^[a-z]{2}[-_]([A-Za-z]{2})$/.exec(String(raw));
    if (m) {
      const code = m[1]!.toLowerCase();
      if (COUNTRY_LANG[code]) return code;
    }
  }
  return null;
}

/** Sprache aus dem erkannten Land. */
export function langForCountry(code: CountryCode | null): Lang | null {
  if (!code) return null;
  return COUNTRY_LANG[code.toLowerCase()] ?? null;
}

/** Initiale Städteliste: nur das erkannte Land (aus der Städte-Datenbank). */
export function citiesForCountry(code: CountryCode | null): string[] {
  const c = (code || "").toLowerCase();
  const db = citiesOf(c);
  return db.length ? db : (COUNTRY_CITIES[c] ?? []);
}

/* ---- Stadt & Standort ------------------------------------------------- */

const CITY_KEY = "showly.city";

function norm(s: string): string {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

let cityIndex: Record<string, string> | null = null;

/** Land zu einer Stadt (aus den bekannten Städtelisten). */
export function countryForCity(city: string): CountryCode | null {
  if (!city) return null;
  if (!cityIndex) {
    cityIndex = {};
    for (const [cc, list] of Object.entries(COUNTRY_CITIES)) {
      for (const c of list) cityIndex[norm(c)] = cc;
    }
  }
  const key = norm(city.split(",")[0] ?? city);
  return cityIndex[key] ?? cityCountry(city) ?? null;
}

/** Zuletzt erkannte/gewählte Stadt merken. */
export function rememberCity(city: string) {
  try {
    if (city) localStorage.setItem(CITY_KEY, city);
  } catch {
    /* Storage nicht verfügbar */
  }
}

/** Stadt des Besuchers: gespeicherte Wahl, sonst größte Stadt des Landes. */
export function detectCity(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = localStorage.getItem(CITY_KEY);
    if (saved) return saved;
  } catch {
    /* Storage nicht verfügbar */
  }
  const list = citiesForCountry(detectCountry());
  return list[0] ?? null;
}

/** Wurde eine Stadt manuell gewählt/gespeichert? */
export function savedCity(): string | null {
  try {
    return localStorage.getItem(CITY_KEY) || null;
  } catch {
    return null;
  }
}

/** Gespeicherte Stadt verwerfen. */
export function forgetCity() {
  try {
    localStorage.removeItem(CITY_KEY);
  } catch {
    /* Storage nicht verfügbar */
  }
}

/**
 * Fallback-Auswahl: Städte in der Nähe (gleiches Land), sonst eine kurze
 * internationale Liste. Die aktuelle Stadt steht immer vorn.
 */
export function nearbyCities(
  country?: CountryCode | null,
  current?: string | null,
  limit = 12,
): string[] {
  const cc = (country || detectCountry() || "de").toLowerCase();
  const base = citiesForCountry(cc);
  const fallback = base.length
    ? base
    : ["Berlin", "Wien", "Zürich", "London", "New York", "Madrid", "Barcelona", "Dublin"];
  const out: string[] = [];
  if (current) out.push(current);
  for (const c of fallback) {
    if (out.length >= limit) break;
    if (!out.some((x) => norm(x) === norm(c))) out.push(c);
  }
  return out;
}

/** Aktueller Zustand der Standort-Freigabe. */
export async function geoPermission(): Promise<"granted" | "denied" | "prompt" | "unavailable"> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return "unavailable";
  try {
    const perm = await navigator.permissions?.query({ name: "geolocation" as PermissionName });
    return (perm?.state as "granted" | "denied" | "prompt") ?? "prompt";
  } catch {
    return "prompt";
  }
}

/**
 * Standort aktiv anfragen (nur auf Nutzer-Klick!). Gibt bei Ablehnung oder
 * Fehler `null` zurück – die Oberfläche zeigt dann die Städteliste.
 */
export async function requestGeoCity(): Promise<string | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return null;
  const pos = await new Promise<GeolocationPosition | null>((res) => {
    navigator.geolocation.getCurrentPosition(
      (p) => res(p),
      () => res(null),
      { timeout: 8000, maximumAge: 6e5 },
    );
  });
  if (!pos) return null;
  return reverseCity(pos.coords.latitude, pos.coords.longitude);
}

async function reverseCity(lat: number, lon: number): Promise<string | null> {
  try {
    const url = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}&limit=1`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = (await r.json()) as { features?: { properties?: Record<string, string> }[] };
    const p = j.features?.[0]?.properties ?? {};
    const city = p["city"] || p["town"] || p["village"] || p["county"] || p["name"] || "";
    if (city) rememberCity(city);
    return city || null;
  } catch {
    return null;
  }
}

/**
 * Genaue Stadt per GPS – nur wenn die Erlaubnis bereits erteilt wurde,
 * damit kein zusätzlicher Berechtigungs-Dialog erscheint.
 */
export async function geoCity(): Promise<string | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return null;
  try {
    const perm = await navigator.permissions?.query({ name: "geolocation" as PermissionName });
    if (perm && perm.state !== "granted") return null;
  } catch {
    return null;
  }
  const pos = await new Promise<GeolocationPosition | null>((res) => {
    navigator.geolocation.getCurrentPosition(
      (p) => res(p),
      () => res(null),
      { timeout: 6000, maximumAge: 6e5 },
    );
  });
  if (!pos) return null;
  try {
    const url = `https://photon.komoot.io/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&limit=1`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = (await r.json()) as { features?: { properties?: Record<string, string> }[] };
    const p = j.features?.[0]?.properties ?? {};
    const city = p["city"] || p["town"] || p["village"] || p["county"] || p["name"] || "";
    if (city) rememberCity(city);
    return city || null;
  } catch {
    return null;
  }
}
