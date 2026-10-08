/* Pakete der Hochzeits- und Eventplaner (rein, getestet in
 * plannerPackages.test.ts).
 *
 * Drei Stufen: Basic, Premium und Luxus. Jede Stufe hat einen Festpreis, eine
 * Liste von Leistungen, die der Planer selbst eingibt (z. B. „Dekoration“,
 * „Ablaufplan“, „Betreuung am Tag“), und einen Beschreibungstext. Der Server
 * rechnet mit genau diesem Preis (cart.server.ts), nie mit einem Wert aus dem
 * Browser. */

export const TIERS = ["basic", "premium", "luxus"] as const;
export type Tier = (typeof TIERS)[number];

export const TIER_LABEL: Record<Tier, { de: string; en: string; es: string }> = {
  basic: { de: "Basic", en: "Basic", es: "Básico" },
  premium: { de: "Premium", en: "Premium", es: "Premium" },
  luxus: { de: "Luxus", en: "Luxury", es: "Lujo" },
};

export const TIER_ICON: Record<Tier, string> = { basic: "gift", premium: "star", luxus: "crown" };

export const PLANNER_CATS = ["eventplanner", "weddingplanner"];
export const isPlannerCat = (cat: string | undefined) => !!cat && PLANNER_CATS.includes(cat);

export const MIN_PKG_PRICE = 50;
export const MAX_PKG_PRICE = 100_000;
export const MAX_ITEMS = 20;

export interface PlannerPackage {
  id: Tier;
  name: string;
  price: number;
  /** Umfang, z. B. „bis 50 Gäste“ oder „6 Monate Begleitung“ */
  dur: string;
  /** einzelne Leistungen */
  inc: string[];
  /** ausführliche Beschreibung */
  text: string;
  /** Planer hebt dieses Paket als beliebt hervor */
  popular?: boolean;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** Preis aus Zahl oder deutscher Eingabe („4.900“, „2490,50“) */
export function parsePrice(v: unknown): number {
  let t = String(v ?? "").trim().replace(/\s|€/g, "");
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(t)) t = t.replace(/\./g, "");
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

/** Nur bekannte Stufen und Felder in vernünftiger Länge; Reihenfolge Basic → Luxus */
export function cleanPackages(v: unknown): PlannerPackage[] {
  if (!Array.isArray(v)) return [];
  const out: PlannerPackage[] = [];
  for (const tier of TIERS) {
    const raw = v.find((p) => p && typeof p === "object" && (p as { id?: unknown }).id === tier) as Record<string, unknown> | undefined;
    if (!raw) continue;
    const price = parsePrice(raw["price"]);
    if (!Number.isFinite(price) || price < MIN_PKG_PRICE || price > MAX_PKG_PRICE) continue;
    const inc = Array.isArray(raw["inc"])
      ? [...new Set((raw["inc"] as unknown[]).map((x) => str(x, 80)).filter(Boolean))].slice(0, MAX_ITEMS)
      : [];
    out.push({
      id: tier,
      name: str(raw["name"], 40) || TIER_LABEL[tier].de,
      price,
      dur: str(raw["dur"], 60),
      inc,
      text: typeof raw["text"] === "string" ? raw["text"].trim().slice(0, 1500) : "",
      ...(raw["popular"] === true ? { popular: true } : {}),
    });
  }
  /* höchstens ein Paket als „beliebt“ */
  let seen = false;
  for (const p of out) {
    if (p.popular && seen) delete p.popular;
    if (p.popular) seen = true;
  }
  return out;
}

/** Fehlertext für den Editor oder null, wenn alles passt */
export function packagesProblem(list: PlannerPackage[]): "none" | "items" | "order" | null {
  if (!list.length) return "none";
  if (list.some((p) => p.inc.length === 0)) return "items";
  for (let i = 1; i < list.length; i++) if (list[i]!.price < list[i - 1]!.price) return "order";
  return null;
}

/** Einstiegspreis (günstigstes Paket) für Karten und Suche */
export function fromPrice(list: PlannerPackage[]): number | null {
  return list.length ? Math.min(...list.map((p) => p.price)) : null;
}
