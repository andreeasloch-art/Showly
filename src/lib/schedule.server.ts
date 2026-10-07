/* Kalender eines echten Künstlers aus der Datenbank, im Format von
 * showly/schedule.ts: gesperrte Startzeiten ("14:00"), Buchungen und
 * Reservierungen mit Dauer ("14:00+2") und Termine aus seinem eigenen
 * Kalender ("09:30+1.5" bzw. "all"). Der Kalender im Browser zeigt damit
 * dieselben freien Zeiten, die die Datenbank beim Belegen zulässt. */
import type { adminClient } from "./supabase.server";
import { bookingEntry } from "@/showly/schedule";
import { zonedToUtc } from "@/showly/icsBusy";

type Db = ReturnType<typeof adminClient>;

/** Buchungen in diesen Zuständen belegen den Kalender */
export const ACTIVE_BOOKING = ["requested", "pending", "confirmed", "completed"] as const;

/* Uhrzeit und Datum in Berlin */
function berlin(d: Date): { day: string; hm: string; h: number } {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(d);
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? "00";
  return { day: `${v("year")}-${v("month")}-${v("day")}`, hm: `${v("hour")}:${v("minute")}`, h: Number(v("hour")) + Number(v("minute")) / 60 };
}

/** Termin aus einem fremden Kalender als Einträge je Berliner Tag */
export function externalEntries(start: Date, end: Date, allDay: boolean): [string, string][] {
  const out: [string, string][] = [];
  let cur = start;
  for (let guard = 0; cur < end && guard < 400; guard++) {
    const b = berlin(cur);
    if (allDay) {
      out.push([b.day, "all"]);
    } else {
      const e = berlin(end);
      const until = e.day === b.day ? e.h : 24;
      const hours = Math.max(1 / 60, until - b.h);
      out.push([b.day, `${b.hm}+${Math.round(hours * 100) / 100}`]);
    }
    /* weiter mit dem nächsten Berliner Tag um 0 Uhr */
    const next = new Date(cur.getTime() + 86_400_000);
    const nb = berlin(next);
    const [y, m, d] = nb.day.split("-").map(Number) as [number, number, number];
    cur = zonedToUtc(y, m, d, 0, 0, 0, "Europe/Berlin");
  }
  return out;
}

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
  const nowIso = new Date().toISOString();
  let qa = db.from("availability").select("artist_id, day, slot").in("artist_id", ids).gte("day", fromDay).eq("blocked", true);
  /* Gebuchte und gerade an der Kasse reservierte Termine (0012 slot_claims) */
  let qc = db
    .from("slot_claims")
    .select("artist_id, day, slot, hours, kind, expires_at")
    .in("artist_id", ids)
    .gte("day", fromDay)
    .or(`kind.eq.booking,expires_at.gt.${nowIso}`);
  /* Termine aus den eigenen Kalendern der Künstler */
  const fromTs = zonedToUtc(...(fromDay.split("-").map(Number) as [number, number, number]), 0, 0, 0, "Europe/Berlin").toISOString();
  let qx = db.from("external_busy").select("artist_id, starts_at, ends_at, all_day").in("artist_id", ids).gte("ends_at", fromTs);
  if (toDay) {
    qa = qa.lte("day", toDay);
    qc = qc.lte("day", toDay);
    const [y, m, d] = toDay.split("-").map(Number) as [number, number, number];
    qx = qx.lt("starts_at", new Date(zonedToUtc(y, m, d, 0, 0, 0, "Europe/Berlin").getTime() + 86_400_000).toISOString());
  }
  const [{ data: blocks }, { data: claims }, { data: ext }] = await Promise.all([qa.limit(5000), qc.limit(5000), qx.limit(5000)]);
  for (const r of blocks || []) push(r.artist_id, r.day, r.slot);
  for (const r of claims || []) push(r.artist_id, r.day, bookingEntry(r.slot, r.hours || 2));
  for (const r of ext || []) {
    for (const [day, e] of externalEntries(new Date(r.starts_at), new Date(r.ends_at), r.all_day)) {
      if (day >= fromDay && (!toDay || day <= toDay)) push(r.artist_id, day, e);
    }
  }
  return out;
}
