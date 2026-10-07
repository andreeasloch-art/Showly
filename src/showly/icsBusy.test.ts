import { describe, expect, it } from "vitest";
import { icsBusy, zonedToUtc } from "./icsBusy";

const from = new Date("2026-10-01T00:00:00Z");
const to = new Date("2027-01-31T00:00:00Z");

/* Wie Google Kalender: IANA-Zeitzone, wöchentliche Serie mit Ausnahme */
const GOOGLE = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Google Inc//Google Calendar 70.9054//EN
BEGIN:VEVENT
DTSTART;TZID=Europe/Berlin:20261010T140000
DTEND;TZID=Europe/Berlin:20261010T160000
UID:single@google.com
SUMMARY:Privat – Hochzeit Müller
END:VEVENT
BEGIN:VEVENT
DTSTART;TZID=Europe/Berlin:20261005T180000
DTEND;TZID=Europe/Berlin:20261005T200000
RRULE:FREQ=WEEKLY;COUNT=4
EXDATE;TZID=Europe/Berlin:20261012T180000
UID:series@google.com
SUMMARY:Probe
END:VEVENT
BEGIN:VEVENT
DTSTART;TZID=Europe/Berlin:20261020T210000
DTEND;TZID=Europe/Berlin:20261020T230000
RECURRENCE-ID;TZID=Europe/Berlin:20261019T180000
UID:series@google.com
SUMMARY:Probe verschoben
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20261101
DTEND;VALUE=DATE:20261102
TRANSP:TRANSPARENT
UID:birthday@google.com
SUMMARY:Geburtstag Oma
END:VEVENT
BEGIN:VEVENT
DTSTART:20261103T090000Z
DTEND:20261103T100000Z
STATUS:CANCELLED
UID:cancelled@google.com
END:VEVENT
END:VCALENDAR`;

/* Wie Outlook: Windows-Zeitzonenname mit VTIMEZONE, ganztägig belegt */
const OUTLOOK = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:Microsoft Exchange Server 2010
BEGIN:VTIMEZONE
TZID:W. Europe Standard Time
BEGIN:STANDARD
DTSTART:16010101T030000
TZOFFSETFROM:+0200
TZOFFSETTO:+0100
RRULE:FREQ=YEARLY;INTERVAL=1;BYDAY=-1SU;BYMONTH=10
END:STANDARD
BEGIN:DAYLIGHT
DTSTART:16010101T020000
TZOFFSETFROM:+0100
TZOFFSETTO:+0200
RRULE:FREQ=YEARLY;INTERVAL=1;BYDAY=-1SU;BYMONTH=3
END:DAYLIGHT
END:VTIMEZONE
BEGIN:VEVENT
DTSTART;TZID=W. Europe Standard Time:20261212T150000
DTEND;TZID=W. Europe Standard Time:20261212T170000
UID:outlook1
SUMMARY:Firmenfeier
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20261224
DTEND;VALUE=DATE:20261225
UID:outlook2
SUMMARY:Weihnachten Auftritt
END:VEVENT
END:VCALENDAR`;

const iso = (d: Date) => d.toISOString().slice(0, 16);

describe("Belegte Zeiten aus iCal", () => {
  it("Einzeltermin in Berliner Sommerzeit", () => {
    const b = icsBusy(GOOGLE, from, to);
    expect(b.some((x) => iso(x.start) === "2026-10-10T12:00" && iso(x.end) === "2026-10-10T14:00")).toBe(true);
  });

  it("wöchentliche Serie mit gestrichenem und verschobenem Termin", () => {
    const series = icsBusy(GOOGLE, from, to).filter((x) => [5, 12, 19, 20, 26].includes(x.start.getUTCDate()) && x.start.getUTCMonth() === 9);
    // 5.10. 18–20 (Sommerzeit = 16 UTC), 12.10. gestrichen, 19.10. verschoben auf 20.10. 21–23, 26.10. Winterzeit = 17 UTC
    expect(series.map((x) => iso(x.start))).toEqual(["2026-10-05T16:00", "2026-10-20T19:00", "2026-10-26T17:00"]);
  });

  it("als frei markierte und abgesagte Termine zählen nicht", () => {
    const b = icsBusy(GOOGLE, from, to);
    expect(b.some((x) => x.allDay)).toBe(false);
    expect(b.some((x) => iso(x.start) === "2026-11-03T09:00")).toBe(false);
  });

  it("Outlook mit Windows-Zeitzone und ganztägigem Termin", () => {
    const b = icsBusy(OUTLOOK, from, to);
    expect(iso(b[0]!.start)).toBe("2026-12-12T14:00");
    const allDay = b.find((x) => x.allDay)!;
    expect(iso(allDay.start)).toBe("2026-12-23T23:00");
    expect(iso(allDay.end)).toBe("2026-12-24T23:00");
  });

  it("nur Termine im Zeitfenster", () => {
    expect(icsBusy(GOOGLE, new Date("2026-12-01T00:00:00Z"), to)).toHaveLength(0);
  });

  it("kaputter Kalender wirft einen Fehler", () => {
    expect(() => icsBusy("das ist kein Kalender", from, to)).toThrow();
  });

  it("Ortszeit → UTC über Sommer- und Winterzeit", () => {
    expect(zonedToUtc(2026, 7, 1, 12, 0, 0, "Europe/Berlin").toISOString()).toBe("2026-07-01T10:00:00.000Z");
    expect(zonedToUtc(2026, 12, 1, 12, 0, 0, "Europe/Berlin").toISOString()).toBe("2026-12-01T11:00:00.000Z");
    expect(zonedToUtc(2026, 12, 1, 12, 0, 0, "America/New_York").toISOString()).toBe("2026-12-01T17:00:00.000Z");
  });
});
