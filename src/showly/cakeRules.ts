/* Torten & Süßes: Pflichtangaben nach Lebensmittelrecht und Regeln für den
 * Bestelltag (rein, getestet in cakeRules.test.ts).
 *
 *  - Die 14 Hauptallergene (LMIV Anhang II) müssen vor dem Kauf sichtbar
 *    sein, dazu Zutaten, Haltbarkeit und Lagerung (Art. 9, 14 LMIV).
 *  - Vorlaufzeit: frühestens nach leadDays Tagen (Anbieter oder Angebot).
 *  - Tageskapazität: höchstens maxPerDay Aufträge pro Tag (0 = ohne Grenze). */

export const ALLERGENS = [
  "gluten",
  "crustaceans",
  "eggs",
  "fish",
  "peanuts",
  "soy",
  "milk",
  "nuts",
  "celery",
  "mustard",
  "sesame",
  "sulphites",
  "lupin",
  "molluscs",
] as const;

export type AllergenId = (typeof ALLERGENS)[number];

export const ALLERGEN_LABEL: Record<AllergenId, { de: string; en: string; es: string }> = {
  gluten: { de: "Glutenhaltiges Getreide", en: "Cereals containing gluten", es: "Cereales con gluten" },
  crustaceans: { de: "Krebstiere", en: "Crustaceans", es: "Crustáceos" },
  eggs: { de: "Eier", en: "Eggs", es: "Huevos" },
  fish: { de: "Fisch", en: "Fish", es: "Pescado" },
  peanuts: { de: "Erdnüsse", en: "Peanuts", es: "Cacahuetes" },
  soy: { de: "Soja", en: "Soy", es: "Soja" },
  milk: { de: "Milch (inkl. Laktose)", en: "Milk (incl. lactose)", es: "Leche (incl. lactosa)" },
  nuts: { de: "Schalenfrüchte (Nüsse)", en: "Tree nuts", es: "Frutos de cáscara" },
  celery: { de: "Sellerie", en: "Celery", es: "Apio" },
  mustard: { de: "Senf", en: "Mustard", es: "Mostaza" },
  sesame: { de: "Sesam", en: "Sesame", es: "Sésamo" },
  sulphites: { de: "Schwefeldioxid und Sulfite", en: "Sulphur dioxide and sulphites", es: "Dióxido de azufre y sulfitos" },
  lupin: { de: "Lupinen", en: "Lupin", es: "Altramuces" },
  molluscs: { de: "Weichtiere", en: "Molluscs", es: "Moluscos" },
};

export type Storage = "cool" | "room" | "frozen";

export interface FoodInfo {
  allergens: AllergenId[];
  /** ausdrücklich bestätigt: keines der 14 Hauptallergene enthalten */
  noAllergens: boolean;
  ingredients: string;
  /** z. B. "2 Tage gekühlt" */
  shelfLife: string;
  storage: Storage;
  /** Spuren möglich (Kreuzkontamination), freiwillige Angabe */
  traces: AllergenId[];
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const ids = (v: unknown) =>
  Array.isArray(v) ? [...new Set(v.map(String).filter((x): x is AllergenId => (ALLERGENS as readonly string[]).includes(x)))] : [];

/** Nur bekannte Felder in vernünftiger Länge (Browser und Server) */
export function cleanFoodInfo(v: unknown): FoodInfo | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const allergens = ids(o["allergens"]);
  return {
    allergens,
    noAllergens: allergens.length === 0 && o["noAllergens"] === true,
    ingredients: str(o["ingredients"], 1200),
    shelfLife: str(o["shelfLife"], 120),
    storage: o["storage"] === "room" || o["storage"] === "frozen" ? o["storage"] : "cool",
    traces: ids(o["traces"]).filter((x) => !allergens.includes(x)),
  };
}

/** Pflichtangaben vollständig? Ohne sie darf das Angebot nicht verkauft werden. */
export function foodInfoComplete(f: FoodInfo | null | undefined): f is FoodInfo {
  return !!f && (f.allergens.length > 0 || f.noAllergens) && f.ingredients.length >= 3 && f.shelfLife.length >= 2;
}

export function allergenList(f: FoodInfo, lang: "de" | "en" | "es"): string {
  return f.allergens.map((a) => ALLERGEN_LABEL[a][lang]).join(", ");
}

/* ---------------------------------------------------------------------- */

export function addDaysISO(todayISO: string, n: number): string {
  const d = new Date(todayISO + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export type DayCheck = { ok: true } | { ok: false; reason: "lead"; earliest: string } | { ok: false; reason: "full" };

/** Darf an diesem Tag (noch) bestellt werden? taken = schon angenommene oder
 *  offene Aufträge des Anbieters an diesem Tag */
export function checkCakeDay(
  rules: { leadDays: number; maxPerDay: number },
  dayISO: string,
  todayISO: string,
  taken: number,
  adding = 1,
): DayCheck {
  const earliest = addDaysISO(todayISO, Math.max(0, rules.leadDays));
  if (dayISO < earliest) return { ok: false, reason: "lead", earliest };
  if (rules.maxPerDay > 0 && taken + adding > rules.maxPerDay) return { ok: false, reason: "full" };
  return { ok: true };
}
