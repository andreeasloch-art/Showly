/* Provision je Kategorie oder Anbieter (rein, getestet in feeRules.test.ts).
 *
 * Reihenfolge: eigene Regel des Anbieters (Künstler, Konditorei, Deko) vor
 * der Regel seiner Kategorie vor dem Standard (FEE_RATE, 20 %). Die
 * Verwaltung pflegt die Regeln (Tabelle fee_rules, Migration 0014). Kunden
 * zahlen immer den angezeigten Endpreis; die Provision ändert nur, was beim
 * Anbieter ankommt. */

export type FeeScope = "category" | "artist" | "baker" | "deco";

export interface FeeRule {
  scope: FeeScope;
  /** Kategorie-Kennung (z. B. "magician", "sweets", "deko") oder Anbieter-ID */
  ref: string;
  /** Anteil 0 … 0,5 */
  rate: number;
}

export const MAX_FEE = 0.5;

export function cleanRate(v: unknown): number | null {
  const n = Number(String(v).replace(",", "."));
  if (!Number.isFinite(n)) return null;
  const r = n > 1 ? n / 100 : n; // 15 oder 0,15
  return r < 0 || r > MAX_FEE ? null : Math.round(r * 10000) / 10000;
}

export function pickRate(
  rules: FeeRule[],
  who: { kind: "artist" | "baker" | "deco"; providerId?: number | null | undefined; category?: string | null | undefined },
  fallback: number,
): number {
  if (who.providerId != null) {
    const own = rules.find((r) => r.scope === who.kind && r.ref === String(who.providerId));
    if (own) return own.rate;
  }
  const cat = who.category ?? (who.kind === "baker" ? "sweets" : who.kind === "deco" ? "deko" : null);
  if (cat) {
    const c = rules.find((r) => r.scope === "category" && r.ref === cat);
    if (c) return c.rate;
  }
  return fallback;
}
