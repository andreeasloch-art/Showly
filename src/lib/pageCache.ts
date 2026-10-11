import { countryFromHeaders } from "@/showly/geoLang";

/* Seiten-Zwischenspeicher: Öffentliche Seiten, die für alle gleich aussehen
   (Startseite, Künstler- und Tortenprofile, Stadtseiten, Ratgeber,
   Locations, Infoseiten), legt Cloudflare nach dem ersten Aufbau 5 Minuten
   ab. Jeder weitere Aufruf in der Zeit kommt fertig aus dem Speicher, ohne
   den Server und ohne Datenbank. Nach 5 Minuten wird die Seite neu gebaut,
   ein geändertes Profil ist also spätestens dann überall zu sehen.

   Nicht gemerkt wird alles mit Konto oder Geld (Profil, Übersicht, Kasse,
   Warenkorb, Verwaltung), jede Anfrage, die keine ganze Seite will, und
   jeder Besuch mit Anmelde-Cookie. Im Schlüssel stehen die volle Adresse
   (Sprache ?lang=, Filter), das Land des Besuchers (der Server schreibt es
   ins HTML) und die Kennung des Builds. */
export const PAGE_TTL = 300;
const CACHEABLE = [
  /^\/$/,
  /^\/kuenstler\/[^/]+\/[^/]+\/[^/]+$/,
  /^\/torten(\/\d+)?$/,
  /^\/locations(\/\d+)?$/,
  /^\/buchen(\/[^/]+\/[^/]+)?$/,
  /^\/ratgeber(\/[^/]+)?$/,
  /^\/(shop|blog|hilfe|ueber-showly|wie-funktioniert-showly|mitmachen)$/,
  /^\/rechtliches\/[^/]+$/,
];

type EdgeCache = { match(req: Request): Promise<Response | undefined>; put(req: Request, res: Response): Promise<void> };
export function edgeCache(): EdgeCache | null {
  try {
    return (globalThis as unknown as { caches?: { default?: EdgeCache } }).caches?.default ?? null;
  } catch {
    return null;
  }
}

export function pageCacheKey(request: Request, build: string): Request | null {
  if (request.method !== "GET") return null;
  const url = new URL(request.url);
  if (!CACHEABLE.some((r) => r.test(url.pathname))) return null;
  if (!(request.headers.get("accept") || "").includes("text/html")) return null;
  if (/(^|;\s*)sb-/.test(request.headers.get("cookie") || "")) return null;
  const country = countryFromHeaders((h) => request.headers.get(h)) || "xx";
  url.hash = "";
  url.searchParams.sort();
  url.searchParams.set("__c", country);
  url.searchParams.set("__b", build);
  return new Request(url.toString());
}

