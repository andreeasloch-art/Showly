import { describe, expect, it } from "vitest";
import { SLOTS } from "./ui";
import { bookingEntry, clashes, firstClash, parseBusy, unavailable, withoutBooking } from "./schedule";

describe("Eine Stunde Fahrtzeit vor und nach jeder Show", () => {
  it("14 bis 16 Uhr gebucht: 13 bis 17 Uhr gesperrt, ab 17 Uhr wieder frei", () => {
    const day = [bookingEntry("14:00", 2)];
    // Eine Stunde Show: gesperrt sind nur die Startzeiten 13 bis 16 Uhr
    expect(unavailable(SLOTS, 1, day)).toEqual(["13:00", "14:00", "15:00", "16:00"]);
    // Zwei Stunden Show: muss um 13 Uhr fertig sein, also Start 11 Uhr
    expect(unavailable(SLOTS, 2, day)).toEqual(["12:00", "13:00", "14:00", "15:00", "16:00"]);
    expect(unavailable(SLOTS, 2, day)).not.toContain("17:00");
    expect(unavailable(SLOTS, 2, day)).not.toContain("11:00");
  });

  it("vorher braucht es auch genau eine Stunde", () => {
    const busy = parseBusy([bookingEntry("14:00", 2)]);
    expect(clashes("11:00", 2, busy)).toBe(false); // 11–13, dann eine Stunde Fahrt
    expect(clashes("12:00", 1, busy)).toBe(false); // 12–13
    expect(clashes("12:00", 2, busy)).toBe(true); // 12–14, keine Zeit zum Fahren
  });

  it("längere Show blockiert länger", () => {
    const day = [bookingEntry("10:00", 4)];
    // 10–14 Uhr plus eine Stunde: ab 15 Uhr frei
    expect(unavailable(SLOTS, 2, day)).toEqual(["10:00", "11:00", "12:00", "13:00", "14:00"]);
  });

  it("eine Sperre des Künstlers gilt nur für ihre Stunde", () => {
    const day = ["16:00"];
    expect(unavailable(SLOTS, 1, day)).toEqual(["16:00"]);
    // zwei Stunden ab 15 Uhr reichen in die Sperre hinein
    expect(unavailable(SLOTS, 2, day)).toEqual(["15:00", "16:00"]);
  });

  it("ganzer Tag gesperrt", () => {
    expect(unavailable(SLOTS, 1, ["all"])).toEqual(SLOTS);
  });

  it("zwei Buchungen im Warenkorb am selben Tag werden gegeneinander geprüft", () => {
    const none = () => [];
    expect(
      firstClash(
        [
          { artistId: 1, dateISO: "2026-12-01", slot: "14:00", hours: 2 },
          { artistId: 1, dateISO: "2026-12-01", slot: "16:00", hours: 2 },
        ],
        none,
      ),
    ).toBe(1);
    expect(
      firstClash(
        [
          { artistId: 1, dateISO: "2026-12-01", slot: "14:00", hours: 2 },
          { artistId: 1, dateISO: "2026-12-01", slot: "17:00", hours: 2 },
          { artistId: 2, dateISO: "2026-12-01", slot: "15:00", hours: 2 },
        ],
        none,
      ),
    ).toBe(-1);
  });

  it("Absage gibt Startzeit und Dauer wieder frei", () => {
    expect(withoutBooking(["10:00", "14:00", "14:00+2", "18:00+3"], "14:00")).toEqual(["10:00", "18:00+3"]);
  });
});
