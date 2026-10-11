/* Die Startseiten-Daten in einer Anfrage vom Server holen, wo sie
 * zwischengespeichert liegen (routes/api.katalog.ts). Einmal je
 * Seitenaufruf; alle Stellen, die Künstler, Anbieter, Wochen-Plätze oder
 * belegte Termine brauchen, teilen sich dieselbe Antwort.
 *
 * Kommt nichts (keine Verbindung, Vorschau ohne Server), geben wir null
 * zurück und die Aufrufer fragen wie früher selbst bei der Datenbank. */
import type { CatalogOut } from "@/lib/homecache.server";

let pending: Promise<CatalogOut | null> | null = null;

export function loadHomeCatalog(): Promise<CatalogOut | null> {
  if (typeof window === "undefined" || typeof fetch === "undefined") return Promise.resolve(null);
  pending ||= fetch("/api/katalog", { headers: { accept: "application/json" } })
    .then(async (r) => {
      if (!r.ok || !(r.headers.get("content-type") || "").includes("json")) return null;
      const body = (await r.json()) as CatalogOut;
      return Array.isArray(body?.artists) ? body : null;
    })
    .catch(() => null);
  return pending;
}
