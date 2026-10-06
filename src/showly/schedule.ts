/* Wann ist ein Künstler frei? Dauer der Show plus Fahrtzeit.
 *
 * Termine beginnen zur vollen Stunde (SLOTS: 10, 11 … 20 Uhr). Eine
 * Buchung belegt nicht nur ihre Startzeit, sondern ihre ganze Dauer und
 * danach eine Stunde, damit der Künstler zur nächsten Show fahren kann.
 * Dieselbe Stunde gilt davor: Wer um 12 Uhr für zwei Stunden bucht, endet
 * um 14 Uhr und kann keine Show um 14 Uhr haben.
 *
 * Beispiel: gebucht 14–16 Uhr → gesperrt ist 13–17 Uhr. Die nächste Show
 * kann um 17 Uhr beginnen; davor muss eine Show spätestens um 13 Uhr enden
 * (zwei Stunden also ab 11 Uhr).
 *
 * Im Kalender stehen zwei Arten von Einträgen (je Tag eine Liste Texte):
 *   "14:00"    vom Künstler gesperrt bzw. Startzeit einer Buchung
 *   "14:00+3"  Buchung um 14 Uhr für 3 Stunden
 * Diese Datei ist rein und getestet (schedule.test.ts); Kalender, Warenkorb
 * und Server benutzen sie gleich. */

/** Fahrtzeit zwischen zwei Shows in Stunden */
export const TRAVEL_BUFFER_H = 1;
/** Abstand der Startzeiten; eine Sperre gilt für dieses ganze Fenster */
export const SLOT_STEP_H = 1;
/** Übliche Länge einer Show, wenn noch keine gewählt ist */
export const DEFAULT_SHOW_H = 2;

export interface Busy {
  slot: string;
  hours: number;
  kind: "booking" | "block";
}

export function hourOf(slot: string): number {
  const m = /^(\d{1,2}):(\d{2})/.exec(slot);
  return m ? Number(m[1]) + Number(m[2]) / 60 : NaN;
}

export function bookingEntry(slot: string, hours: number): string {
  return `${slot}+${Math.max(1, Math.round(hours) || 1)}`;
}

/** Kalendereinträge eines Tages lesen ("all" sperrt den ganzen Tag) */
export function parseBusy(entries: readonly string[]): Busy[] {
  const out: Busy[] = [];
  for (const e of entries) {
    if (e === "all") {
      out.push({ slot: "00:00", hours: 24, kind: "block" });
      continue;
    }
    const m = /^(\d{1,2}:\d{2})\+(\d{1,2})$/.exec(e);
    if (m) out.push({ slot: m[1]!, hours: Number(m[2]), kind: "booking" });
    else if (!Number.isNaN(hourOf(e))) out.push({ slot: e, hours: SLOT_STEP_H, kind: "block" });
  }
  return out;
}

/** Passt eine Show um `slot` mit `hours` Stunden nicht mehr hinein? */
export function clashes(slot: string, hours: number, busy: readonly Busy[]): boolean {
  const start = hourOf(slot);
  if (Number.isNaN(start)) return true;
  const end = start + Math.max(1, hours);
  return busy.some((b) => {
    const bs = hourOf(b.slot);
    const be = bs + b.hours;
    /* Zwischen zwei Buchungen liegt die Fahrtzeit; eine Sperre des
       Künstlers gilt genau für ihr Fenster */
    const buf = b.kind === "booking" ? TRAVEL_BUFFER_H : 0;
    return start < be + buf && bs < end + buf;
  });
}

/** Startzeiten, die für eine Show dieser Länge nicht mehr gehen */
export function unavailable(slots: readonly string[], hours: number, entries: readonly string[]): string[] {
  const busy = parseBusy(entries);
  return slots.filter((s) => clashes(s, hours, busy));
}

/** Mehrere neue Buchungen (z. B. im Warenkorb) gegen den Kalender und
 *  gegeneinander prüfen. Gibt den Index der ersten, die nicht passt, oder -1. */
export function firstClash(
  list: readonly { artistId: number; dateISO: string; slot: string; hours: number }[],
  entriesOf: (artistId: number, dateISO: string) => readonly string[],
): number {
  const added = new Map<string, Busy[]>();
  for (let i = 0; i < list.length; i++) {
    const b = list[i]!;
    const key = `${b.artistId}|${b.dateISO}`;
    const busy = [...parseBusy(entriesOf(b.artistId, b.dateISO)), ...(added.get(key) ?? [])];
    if (clashes(b.slot, b.hours, busy)) return i;
    added.set(key, [...(added.get(key) ?? []), { slot: b.slot, hours: Math.max(1, b.hours), kind: "booking" }]);
  }
  return -1;
}

/** Eintrag einer Buchung wieder entfernen (Absage, Verschiebung) */
export function withoutBooking(entries: readonly string[], slot: string): string[] {
  return entries.filter((e) => e !== slot && !e.startsWith(slot + "+"));
}
