/* Belegte Zeiten aus einem iCal-Kalender (Google, Apple/iCloud, Outlook).
 *
 * Künstler nehmen auch außerhalb von Showly Aufträge an. Damit sie nicht
 * doppelt gebucht werden, liest Showly ihren privaten Kalender-Link (.ics)
 * und sperrt die belegten Zeiten samt einer Stunde Fahrtzeit.
 *
 * Gespeichert werden nur Beginn und Ende, keine Titel, Orte oder Teilnehmer.
 * Termine, die im Kalender als "frei" markiert sind (TRANSP:TRANSPARENT),
 * und abgesagte Termine (STATUS:CANCELLED) zählen nicht. Wiederkehrende
 * Termine (RRULE, EXDATE, geänderte Einzeltermine) werden aufgelöst.
 *
 * Zeitzonen: IANA-Namen (Europe/Berlin) über Intl, Windows-Namen aus
 * Outlook (W. Europe Standard Time) über eine Zuordnung bzw. den
 * mitgelieferten VTIMEZONE-Block, schwebende Zeiten als Europe/Berlin. */
import ICAL from "ical.js";

export interface BusyInterval {
  start: Date;
  end: Date;
  allDay: boolean;
}

const DEFAULT_TZ = "Europe/Berlin";

/* Häufige Windows-Zeitzonen aus Outlook/Exchange */
const WINDOWS_TZ: Record<string, string> = {
  "W. Europe Standard Time": "Europe/Berlin",
  "Central Europe Standard Time": "Europe/Budapest",
  "Central European Standard Time": "Europe/Warsaw",
  "Romance Standard Time": "Europe/Paris",
  "GMT Standard Time": "Europe/London",
  "Greenwich Standard Time": "Atlantic/Reykjavik",
  "E. Europe Standard Time": "Europe/Chisinau",
  "FLE Standard Time": "Europe/Kiev",
  "GTB Standard Time": "Europe/Bucharest",
  "Eastern Standard Time": "America/New_York",
  "Central Standard Time": "America/Chicago",
  "Mountain Standard Time": "America/Denver",
  "Pacific Standard Time": "America/Los_Angeles",
  "Mexico Standard Time": "America/Mexico_City",
  "Central Standard Time (Mexico)": "America/Mexico_City",
  "SA Pacific Standard Time": "America/Bogota",
  "Argentina Standard Time": "America/Argentina/Buenos_Aires",
  UTC: "UTC",
};

function isIana(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Abweichung der Zeitzone von UTC zum Zeitpunkt ms (in ms) */
function tzOffset(ms: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(ms));
  const v = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return Date.UTC(v("year"), v("month") - 1, v("day"), v("hour"), v("minute"), v("second")) - ms;
}

/** Ortszeit in einer Zeitzone → UTC (zweimal gerechnet, damit Sommerzeit stimmt) */
export function zonedToUtc(y: number, mo: number, d: number, h: number, mi: number, s: number, tz: string): Date {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  const first = guess - tzOffset(guess, tz);
  return new Date(guess - tzOffset(first, tz));
}

function toDate(t: ICAL.Time, tzid: string | null): Date {
  if (t.zone && t.zone.tzid === "UTC") return new Date(Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute, t.second));
  const name = tzid ? (WINDOWS_TZ[tzid] ?? tzid) : null;
  if (name && isIana(name)) return zonedToUtc(t.year, t.month, t.day, t.hour, t.minute, t.second, name);
  /* Unbekannter Name, aber im Kalender beschrieben (VTIMEZONE): ical.js rechnet */
  if (tzid && ICAL.TimezoneService.has(tzid)) return t.toJSDate();
  return zonedToUtc(t.year, t.month, t.day, t.hour, t.minute, t.second, DEFAULT_TZ);
}

function tzidOf(comp: ICAL.Component, prop: string): string | null {
  const p = comp.getFirstProperty(prop);
  const v = p?.getParameter("tzid");
  return typeof v === "string" ? v : null;
}

/** Belegte Zeiten zwischen from und to. Wirft bei kaputtem Kalender. */
export function icsBusy(text: string, from: Date, to: Date, maxEvents = 5000): BusyInterval[] {
  const root = new ICAL.Component(ICAL.parse(text));
  /* Mitgelieferte Zeitzonen bekannt machen (für Namen, die Intl nicht kennt) */
  for (const vtz of root.getAllSubcomponents("vtimezone")) {
    const id = vtz.getFirstPropertyValue("tzid");
    if (typeof id === "string" && !ICAL.TimezoneService.has(id)) ICAL.TimezoneService.register(vtz);
  }

  const vevents = root.getAllSubcomponents("vevent");
  const masters = new Map<string, ICAL.Event>();
  const singles: ICAL.Component[] = [];
  const exceptions: ICAL.Component[] = [];
  for (const ve of vevents) {
    if (ve.getFirstProperty("recurrence-id")) exceptions.push(ve);
    else if (ve.getFirstProperty("rrule") || ve.getFirstProperty("rdate")) masters.set(String(ve.getFirstPropertyValue("uid")), new ICAL.Event(ve));
    else singles.push(ve);
  }
  /* Geänderte Einzeltermine gehören zu ihrer Serie */
  for (const ex of exceptions) {
    const m = masters.get(String(ex.getFirstPropertyValue("uid")));
    if (m) m.relateException(ex);
    else singles.push(ex);
  }

  const out: BusyInterval[] = [];
  const counts = (ve: ICAL.Component) => {
    const transp = String(ve.getFirstPropertyValue("transp") || "").toUpperCase();
    const status = String(ve.getFirstPropertyValue("status") || "").toUpperCase();
    return transp !== "TRANSPARENT" && status !== "CANCELLED";
  };
  const push = (start: ICAL.Time, end: ICAL.Time | null, ve: ICAL.Component) => {
    if (!counts(ve)) return;
    const allDay = start.isDate;
    let s: Date;
    let e: Date;
    if (allDay) {
      s = zonedToUtc(start.year, start.month, start.day, 0, 0, 0, DEFAULT_TZ);
      const endT = end && end.isDate ? end : null;
      e = endT
        ? zonedToUtc(endT.year, endT.month, endT.day, 0, 0, 0, DEFAULT_TZ)
        : new Date(zonedToUtc(start.year, start.month, start.day, 0, 0, 0, DEFAULT_TZ).getTime() + 86_400_000);
    } else {
      s = toDate(start, tzidOf(ve, "dtstart"));
      e = end ? toDate(end, tzidOf(ve, "dtend") ?? tzidOf(ve, "dtstart")) : s;
    }
    if (e.getTime() <= s.getTime()) e = new Date(s.getTime() + 60_000);
    if (e <= from || s >= to) return;
    out.push({ start: s, end: e, allDay });
  };

  for (const ve of singles) {
    if (out.length >= maxEvents) break;
    const ev = new ICAL.Event(ve);
    push(ev.startDate, ev.endDate, ve);
  }

  for (const ev of masters.values()) {
    const it = ev.iterator();
    let guard = 0;
    for (let t = it.next(); t && guard < 3000 && out.length < maxEvents; t = it.next(), guard++) {
      const d = ev.getOccurrenceDetails(t);
      const comp = d.item.component;
      const s = toDate(d.startDate, tzidOf(comp, "dtstart"));
      if (s >= to) break;
      push(d.startDate, d.endDate, comp);
    }
  }

  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}
