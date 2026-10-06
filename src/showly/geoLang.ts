/* Sprache nach Land: Wer Showly aus Spanien oder Kolumbien öffnet, sieht die
 * Seite auf Spanisch, aus Deutschland, Österreich oder der Schweiz auf
 * Deutsch, aus Großbritannien oder den USA auf Englisch.
 *
 * Das Land kommt zuerst vom Server: Der Hoster (Cloudflare) schreibt das Land
 * der Internetadresse in jede Anfrage (CF-IPCountry). Das ist zuverlässiger
 * als die Zeitzone des Geräts. Fehlt es, gilt die Zeitzone, danach die
 * Browsersprache. Gespeichert wird dabei nichts, auch keine IP-Adresse.
 *
 * Reihenfolge (pickLang):
 *   1. ?lang=de|en|es in der Adresse
 *   2. Sprache, die die Person selbst gewählt hat (gespeichert)
 *   3. Land der Internetadresse
 *   4. Land aus der Zeitzone
 *   5. Browsersprache
 *   6. Deutsch
 * Suchmaschinen bekommen keine automatische Umstellung, damit Google jede
 * Sprachfassung unter ihrer eigenen Adresse (?lang=) erfasst. */
import type { Lang } from "./data";
import { COUNTRY_LANG } from "./country";

/** Kopfzeilen, in denen Hoster das Land der Anfrage mitschicken */
export const GEO_HEADERS = ["cf-ipcountry", "x-vercel-ip-country", "x-country-code", "x-geo-country"];

/** Ländercode aus den Kopfzeilen; "XX" und "T1" (Tor) zählen nicht */
export function countryFromHeaders(get: (name: string) => string | null | undefined): string | null {
  for (const h of GEO_HEADERS) {
    const v = String(get(h) || "").trim().toLowerCase();
    if (/^[a-z]{2}$/.test(v) && v !== "xx" && v !== "t1") return v;
  }
  return null;
}

/** Land, das der Server beim Laden der Seite erkannt hat (im HTML mitgeliefert) */
export function serverCountry(): string | null {
  if (typeof window === "undefined") return null;
  const v = (window as { __SHOWLY_GEO?: unknown }).__SHOWLY_GEO;
  return typeof v === "string" && /^[a-z]{2}$/.test(v) ? v : null;
}

const BOT = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|whatsapp/i;

export function isBot(ua?: string): boolean {
  const s = ua ?? (typeof navigator !== "undefined" ? navigator.userAgent : "");
  return BOT.test(s);
}

const isLang = (v: unknown): v is Lang => v === "de" || v === "en" || v === "es";

export function pickLang(o: {
  url?: Lang | null;
  saved?: string | null;
  ipCountry?: string | null;
  tzCountry?: string | null;
  browser?: readonly string[];
  bot?: boolean;
}): Lang {
  if (o.url) return o.url;
  if (isLang(o.saved)) return o.saved;
  if (o.bot) return "de";
  const byIp = o.ipCountry ? COUNTRY_LANG[o.ipCountry.toLowerCase()] : undefined;
  if (byIp) return byIp;
  const byTz = o.tzCountry ? COUNTRY_LANG[o.tzCountry.toLowerCase()] : undefined;
  if (byTz) return byTz;
  for (const raw of o.browser || []) {
    const c = String(raw).toLowerCase().slice(0, 2);
    if (isLang(c)) return c;
  }
  return "de";
}

/** Zahlen- und Datumsformat: Englisch aus den USA im US-Format */
export function localeFor(lang: Lang, country: string | null): string {
  if (lang === "de") return country === "at" ? "de-AT" : country === "ch" ? "de-CH" : "de-DE";
  if (lang === "en") return country === "us" ? "en-US" : "en-GB";
  return country === "co" || country === "mx" || country === "ar" ? `es-${country.toUpperCase()}` : "es-ES";
}
