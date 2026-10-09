/* Saisonpreise und Wochenendzuschlag der Künstler und Planer (rein,
 * getestet in surcharges.test.ts).
 *
 *  - Wochenende (Samstag und Sonntag): Zuschlag in Prozent, 0–100.
 *  - Saisonen: wiederkehrende Zeiträume im Jahr (z. B. 01.12.–24.12.
 *    „Weihnachtszeit“ +20 %, oder 15.01.–28.02. „Nebensaison“ −10 %),
 *    -50 bis +100 %. Überschneiden sich Saisonen, gilt die höchste.
 *  - Wochenende und Saison werden addiert, insgesamt höchstens +150 %,
 *    mindestens −50 %.
 * Der Preis gilt für Stundensatz und Pakete gleichermaßen; Kunden sehen ihn
 * vor der Buchung, der Server rechnet ihn selbst nach. */

export interface Season {
  /** MM-TT */
  from: string;
  /** MM-TT, darf vor "from" liegen (über den Jahreswechsel) */
  to: string;
  pct: number;
  label: string;
}

export interface Surcharges {
  weekend: number;
  seasons: Season[];
}

const MD = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const clampInt = (v: unknown, min: number, max: number) => Math.max(min, Math.min(max, Math.round(Number(v)) || 0));

export function cleanSurcharges(v: unknown): Surcharges | null {
  if (!v || typeof v !== "object") return null;
  const o = v as { weekend?: unknown; seasons?: unknown };
  const seasons = (Array.isArray(o.seasons) ? o.seasons : [])
    .map((x) => x as Partial<Season>)
    .filter((x) => typeof x.from === "string" && MD.test(x.from) && typeof x.to === "string" && MD.test(x.to))
    .slice(0, 8)
    .map((x) => ({
      from: x.from!,
      to: x.to!,
      pct: clampInt(x.pct, -50, 100),
      label: typeof x.label === "string" ? x.label.trim().slice(0, 40) : "",
    }))
    .filter((x) => x.pct !== 0);
  const weekend = clampInt(o.weekend, 0, 100);
  if (!weekend && !seasons.length) return null;
  return { weekend, seasons };
}

function inSeason(md: string, s: Season): boolean {
  return s.from <= s.to ? md >= s.from && md <= s.to : md >= s.from || md <= s.to;
}

export function isWeekend(dateISO: string): boolean {
  const d = new Date(dateISO.slice(0, 10) + "T12:00:00Z").getUTCDay();
  return d === 0 || d === 6;
}

/** Zuschlag (bzw. Rabatt) in Prozent für einen Tag, mit Begründung */
export function surchargeFor(s: Surcharges | null | undefined, dateISO: string | undefined): { pct: number; reasons: string[] } {
  if (!s || !dateISO || !/^\d{4}-\d{2}-\d{2}/.test(dateISO)) return { pct: 0, reasons: [] };
  const reasons: string[] = [];
  let pct = 0;
  if (s.weekend && isWeekend(dateISO)) {
    pct += s.weekend;
    reasons.push(`Wochenende +${s.weekend} %`);
  }
  const md = dateISO.slice(5, 10);
  const hit = s.seasons.filter((x) => inSeason(md, x)).sort((a, b) => b.pct - a.pct)[0];
  if (hit) {
    pct += hit.pct;
    reasons.push(`${hit.label || "Saison"} ${hit.pct > 0 ? "+" : "−"}${Math.abs(hit.pct)} %`);
  }
  return { pct: Math.max(-50, Math.min(150, pct)), reasons };
}

/** Preis mit Zuschlag, auf ganze Euro gerundet */
export function withSurcharge(base: number, s: Surcharges | null | undefined, dateISO: string | undefined): number {
  const { pct } = surchargeFor(s, dateISO);
  return pct ? Math.round(base * (1 + pct / 100)) : base;
}
