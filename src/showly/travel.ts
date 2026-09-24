/* Einsatzgebiet: wie weit ein Künstler von seinem Standort aus fährt.
 *
 * Der Wert steht als `radiusKm` im Profil. Von jedem Punkt in Deutschland aus
 * ist bei 800 km das ganze Land erreichbar. Dieser Wert steht deshalb für
 * "deutschlandweit" und braucht keine zweite Angabe im Profil. */

export const NATIONWIDE_KM = 800;
export const DEFAULT_RADIUS_KM = 50;

/* Die Auswahl, die Künstler im Profil und bei der Anmeldung sehen. */
export const RADIUS_OPTIONS = [10, 20, 30, 40, 50, 75, 100, 150, 200, 300, 500, NATIONWIDE_KM];

export function isNationwide(km: number): boolean {
  return km >= NATIONWIDE_KM;
}

/** Radius eines Profils, notfalls der Vorgabewert. */
export function radiusOf(a: { radiusKm?: unknown } | null | undefined): number {
  const km = Math.round(Number(a?.radiusKm));
  if (!Number.isFinite(km) || km <= 0) return DEFAULT_RADIUS_KM;
  return Math.min(NATIONWIDE_KM, km);
}

const NATIONAL = { de: "Deutschlandweit", en: "Nationwide", es: "En todo el país" } as const;

/** Kurzform für Karten und Listen: "50 km Umkreis" oder "Deutschlandweit". */
export function travelShort(km: number, lang: string): string {
  if (isNationwide(km)) return pick(NATIONAL, lang);
  if (lang === "en") return `${km} km radius`;
  if (lang === "es") return `${km} km a la redonda`;
  return `${km} km Umkreis`;
}

/** Volle Angabe fürs Profil: "Fährt bis 50 km um München". */
export function travelLabel(km: number, lang: string, city?: string): string {
  const place = (city || "").trim();
  if (isNationwide(km)) {
    if (lang === "en") return place ? `Travels nationwide, based in ${place}` : "Travels nationwide";
    if (lang === "es") return place ? `Viaja por todo el país, con base en ${place}` : "Viaja por todo el país";
    return place ? `Fährt deutschlandweit, Standort ${place}` : "Fährt deutschlandweit";
  }
  if (lang === "en") return place ? `Travels up to ${km} km around ${place}` : `Travels up to ${km} km`;
  if (lang === "es") return place ? `Viaja hasta ${km} km alrededor de ${place}` : `Viaja hasta ${km} km`;
  return place ? `Fährt bis ${km} km rund um ${place}` : `Fährt bis ${km} km`;
}

/** Beschriftung eines Eintrags in der Auswahlliste. */
export function travelOption(km: number, lang: string): string {
  if (isNationwide(km)) return pick(NATIONAL, lang);
  if (lang === "en") return `up to ${km} km`;
  if (lang === "es") return `hasta ${km} km`;
  return `bis ${km} km`;
}

function pick(m: { de: string; en: string; es: string }, lang: string): string {
  return lang === "en" ? m.en : lang === "es" ? m.es : m.de;
}
