/* Kalender eines echten Künstlers aus der Datenbank, im Format von
 * showly/schedule.ts: gesperrte Startzeiten ("14:00") und laufende
 * Buchungen mit Dauer ("14:00+2"). Damit prüfen Kasse und Buchung auf dem
 * Server dieselbe Regel wie der Kalender im Browser: Dauer der Show plus
 * eine Stunde Fahrtzeit. */
import type { adminClient } from "./supabase.server";
import { bookingEntry } from "@/showly/schedule";

type Db = ReturnType<typeof adminClient>;

/** Buchungen in diesen Zuständen belegen den Kalender */
export const ACTIVE_BOOKING = ["requested", "pending", "confirmed", "completed"] as const;

/** Einträge je Künstler und Tag ("id|YYYY-MM-DD") */
export async function scheduleEntries(
  db: Db,
  artistIds: number[],
  fromDay: string,
  toDay?: string,
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  const ids = [...new Set(artistIds)].filter((n) => n >= 100000);
  if (!ids.length) return out;
  const push = (id: number, day: string, e: string) => {
    const k = `${id}|${day}`;
    out.set(k, [...(out.get(k) ?? []), e]);
  };
  let qa = db.from("availability").select("artist_id, day, slot").in("artist_id", ids).gte("day", fromDay).eq("blocked", true);
  let qb = db
    .from("bookings")
    .select("artist_id, day, slot, hours")
    .in("artist_id", ids)
    .gte("day", fromDay)
    .in("status", [...ACTIVE_BOOKING]);
  if (toDay) {
    qa = qa.lte("day", toDay);
    qb = qb.lte("day", toDay);
  }
  const [{ data: blocks }, { data: books }] = await Promise.all([qa.limit(5000), qb.limit(5000)]);
  for (const r of blocks || []) push(r.artist_id, r.day, r.slot);
  for (const r of books || []) if (r.artist_id && r.slot) push(r.artist_id, r.day, bookingEntry(r.slot, r.hours || 2));
  return out;
}
