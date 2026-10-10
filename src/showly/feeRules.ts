/* Provision je Kategorie oder Anbieter (rein, getestet in feeRules.test.ts).
 *
 * Reihenfolge: eigene Regel des Anbieters (Künstler, Konditorei, Deko) vor
 * der Regel seiner Kategorie vor dem Standard (FEE_RATE, 20 %). Die
 * Verwaltung pflegt die Regeln (Tabelle fee_rules, Migration 0014). Kunden
 * zahlen immer den angezeigten Endpreis; die Provision ändert nur, was beim
 * Anbieter ankommt. */

export type FeeScope = "category" | "artist" | "baker" | "deco" | "location";

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
  who: { kind: "artist" | "baker" | "deco" | "location"; providerId?: number | null | undefined; category?: string | null | undefined },
  fallback: number,
): number {
  if (who.providerId != null) {
    const own = rules.find((r) => r.scope === who.kind && r.ref === String(who.providerId));
    if (own) return own.rate;
  }
  const cat = who.category ?? (who.kind === "baker" ? "sweets" : who.kind === "deco" ? "deko" : who.kind === "location" ? "locations" : null);
  if (cat) {
    const c = rules.find((r) => r.scope === "category" && r.ref === cat);
    if (c) return c.rate;
  }
  return fallback;
}

/* Startphase: alle Anbieter (Künstler, Konditoreien, Deko- und Kostümanbieter) zahlen in den ersten 3 Monaten nach der Anmeldung
   keine Provision (AGB § 21 Abs. 1a). Maßgeblich ist der Tag der Buchung,
   nicht der Auftrittstag. */
export const START_FREE_MONTHS = 3;

/** Ende der Startphase (Anmeldung + 3 Monate) */
export function startFreeUntil(since: string | Date): Date {
  const d = new Date(since);
  const end = new Date(d);
  end.setMonth(end.getMonth() + START_FREE_MONTHS);
  /* 31. Januar + 3 Monate: auf den letzten Tag des Monats begrenzen */
  if (end.getDate() !== d.getDate()) end.setDate(0);
  return end;
}

/** Liegt der Buchungszeitpunkt noch in der provisionsfreien Startphase? */
export function inStartPhase(since: string | Date | null | undefined, at: Date = new Date()): boolean {
  if (!since) return false;
  const s = new Date(since);
  if (Number.isNaN(s.getTime())) return false;
  return at.getTime() < startFreeUntil(s).getTime();
}
