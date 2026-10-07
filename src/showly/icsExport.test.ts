import { describe, expect, it } from "vitest";
import { buildIcs, icsEscape } from "./icsExport";
import { icsBusy } from "./icsBusy";
import { safeCalendarUrl } from "@/lib/calsync.server";

describe("Eigener Kalender-Link (iCal-Feed)", () => {
  const ics = buildIcs("Showly-Auftritte", [
    {
      uid: "showly-1@showly.eu",
      start: new Date("2026-12-12T13:00:00Z"),
      end: new Date("2026-12-12T15:00:00Z"),
      summary: "Showly-Auftritt – Elsa, Anna; Olaf",
      location: "Musterstraße 1, 71522 Backnang",
    },
  ]);

  it("gültiges iCal, das Kalender-Apps wieder einlesen können", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    const back = icsBusy(ics, new Date("2026-12-01T00:00:00Z"), new Date("2026-12-31T00:00:00Z"));
    expect(back).toHaveLength(1);
    expect(back[0]!.start.toISOString()).toBe("2026-12-12T13:00:00.000Z");
  });

  it("maskiert Sonderzeichen und faltet lange Zeilen", () => {
    expect(icsEscape("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });
});

describe("Kalender-Links prüfen (Schutz vor Missbrauch)", () => {
  it("Google, iCloud und Outlook werden angenommen, webcal wird https", () => {
    expect(safeCalendarUrl("https://calendar.google.com/calendar/ical/x%40gmail.com/private-abc/basic.ics")).toMatch(/^https:\/\/calendar\.google\.com\//);
    expect(safeCalendarUrl("webcal://p23-caldav.icloud.com/published/2/abc")).toBe("https://p23-caldav.icloud.com/published/2/abc");
    expect(safeCalendarUrl("https://outlook.office365.com/owa/calendar/abc/def/calendar.ics")).toBeTruthy();
  });

  it("interne Adressen, http und Zugangsdaten werden abgelehnt", () => {
    for (const bad of [
      "http://calendar.google.com/x.ics",
      "https://localhost/x.ics",
      "https://127.0.0.1/x.ics",
      "https://10.0.0.5/x.ics",
      "https://[::1]/x.ics",
      "https://user:pass@example.com/x.ics",
      "https://metadata.internal/x",
      "file:///etc/passwd",
      "keine adresse",
    ])
      expect(safeCalendarUrl(bad), bad).toBeNull();
  });
});
