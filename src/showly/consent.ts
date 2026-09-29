/* Einwilligungen nach § 25 TDDDG und Art. 6 Abs. 1 lit. a DSGVO.
 *
 * Ohne Einwilligung lädt die App nichts von fremden Servern und speichert im
 * Browser nur, was für die gewünschte Funktion unbedingt nötig ist (Anmeldung,
 * Warenkorb, Sprache, diese Entscheidung selbst).
 *
 * Optionale Kategorien:
 *  - places:  Adress- und Ortssuche über Photon (Komoot, Server in der EU).
 *             Dabei gehen der Suchtext bzw. der Standort und die IP-Adresse
 *             an Komoot.
 *  - comfort: Merken der zuletzt gesuchten Städte und der Klicks auf den
 *             "Top-Act"-Kacheln, nur im eigenen Browser.
 *
 * Analyse, Werbe-Pixel und Einbettungen (Video, Karten, Social Media) gibt es
 * derzeit nicht. Kommen welche dazu, bekommen sie hier eine eigene Kategorie
 * und dürfen erst nach Zustimmung geladen werden. */

export type ConsentCategory = "places" | "comfort";
export interface Consent {
  v: 1;
  places: boolean;
  comfort: boolean;
  /** Zeitpunkt der Entscheidung (Nachweis) */
  at: string;
}

const KEY = "showly.consent";
const EVENT = "showly:consent";
const OPEN_EVENT = "showly:consent-open";
/* Nach 12 Monaten fragen wir erneut */
const MAX_AGE_MS = 365 * 86_400_000;

let cache: Consent | null | undefined;

function read(): Consent | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || "null") as Consent | null;
    if (!c || c.v !== 1) return null;
    if (Date.now() - new Date(c.at).getTime() > MAX_AGE_MS) return null;
    return c;
  } catch {
    return null;
  }
}

export function getConsent(): Consent | null {
  if (cache === undefined) cache = read();
  return cache;
}

/** Hat die Person schon entschieden? Sonst zeigt die App das Banner. */
export function hasDecided(): boolean {
  return getConsent() !== null;
}

export function allowed(cat: ConsentCategory): boolean {
  return !!getConsent()?.[cat];
}

export function saveConsent(choice: { places: boolean; comfort: boolean }) {
  const c: Consent = { v: 1, ...choice, at: new Date().toISOString() };
  cache = c;
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    /* privater Modus: gilt dann nur für diesen Besuch */
  }
  /* Widerruf: bereits Gespeichertes dieser Kategorie wieder entfernen */
  if (!c.comfort) {
    for (const k of ["showly.city", "showly.spotlight.clicks"]) {
      try {
        localStorage.removeItem(k);
      } catch {
        /* egal */
      }
    }
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

export function subscribeConsent(fn: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}

/** Einstellungen erneut öffnen (Link im Fußbereich, Seite Cookies) */
export function openConsentSettings() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(OPEN_EVENT));
}

export function subscribeOpen(fn: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(OPEN_EVENT, fn);
  return () => window.removeEventListener(OPEN_EVENT, fn);
}
