/* Arbeitszeiten der Künstler (rein, getestet in workHours.test.ts).
 *
 * Wochenplan je Wochentag (Schlüssel wie Date.getDay(): "0" = Sonntag …
 * "6" = Samstag) mit [von, bis] in vollen Stunden. Eine Show muss ganz
 * hineinpassen: Beginn ≥ von und Beginn + Dauer ≤ bis. Fehlt ein Tag, ist er
 * frei. Kein Plan (null) = keine Einschränkung. Dieselbe Regel prüft die
 * Datenbank beim Buchen (claim_slots, Migration 0013). */

export type WorkHours = Partial<Record<"0" | "1" | "2" | "3" | "4" | "5" | "6", [number, number]>>;

export const WEEK_ORDER = ["1", "2", "3", "4", "5", "6", "0"] as const;

export function cleanWorkHours(v: unknown): WorkHours | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const out: WorkHours = {};
  for (const k of WEEK_ORDER) {
    const e = (v as Record<string, unknown>)[k];
    if (!Array.isArray(e) || e.length !== 2) continue;
    const from = Math.round(Number(e[0]));
    const to = Math.round(Number(e[1]));
    if (Number.isFinite(from) && Number.isFinite(to) && from >= 0 && to <= 24 && to > from) out[k] = [from, to];
  }
  return out;
}

const dowOf = (iso: string) => String(new Date(iso + "T12:00:00Z").getUTCDay()) as keyof WorkHours;

/** Passt eine Show (Beginn "HH:MM", Dauer in Stunden) in die Arbeitszeit? */
export function withinWork(wh: WorkHours | null | undefined, iso: string, slot: string, hours: number): boolean {
  if (!wh) return true;
  const e = wh[dowOf(iso)];
  if (!e) return false;
  const h = Number(slot.slice(0, 2));
  return h >= e[0] && h + Math.max(1, hours) <= e[1];
}

/** Zeitfenster, die wegen der Arbeitszeit nicht gehen */
export function outsideWork(wh: WorkHours | null | undefined, iso: string, slots: string[], hours: number): string[] {
  if (!wh) return [];
  return slots.filter((s) => !withinWork(wh, iso, s, hours));
}
