import { describe, expect, it } from "vitest";
import { SLOTS } from "./ui";
import { bookingEntry, clashes, firstClash, parseBusy, unavailable, withoutBooking } from "./schedule";

describe("Fahrtzeit zwischen zwei Shows", () => {
  it("14 bis 16 Uhr gebucht: 16 Uhr ist zu, 18 Uhr wieder frei", () => {
    const day = [bookingEntry("14:00", 2)];
    expect(unavailable(SLOTS, 2, day)).toEqual(["12:00", "14:00", "16:00"]);
  });

  it("vorher braucht es auch die Stunde: 12 Uhr geht nur mit einer Stunde Show", () => {
    const busy = parseBusy([bookingEntry("14:00", 2)]);
    expect(clashes("12:00", 2, busy)).toBe(true);
    expect(clashes("12:00", 1, busy)).toBe(false);
    expect(clashes("10:00", 2, busy)).toBe(false);
  });

  it("längere Show blockiert länger", () => {
    const day = [bookingEntry("10:00", 4)];
    // 10–14 Uhr, plus eine Stunde: frei erst ab 15 Uhr, also 16 Uhr
    expect(unavailable(SLOTS, 2, day)).toEqual(["10:00", "12:00", "14:00"]);
  });

  it("eine Sperre des Künstlers gilt nur für ihr eigenes Fenster", () => {
    const day = ["16:00"];
    expect(unavailable(SLOTS, 2, day)).toEqual(["16:00"]);
    // drei Stunden ab 14 Uhr reichen in die Sperre hinein
    expect(unavailable(SLOTS, 3, day)).toEqual(["14:00", "16:00"]);
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
          { artistId: 1, dateISO: "2026-12-01", slot: "18:00", hours: 2 },
          { artistId: 2, dateISO: "2026-12-01", slot: "16:00", hours: 2 },
        ],
        none,
      ),
    ).toBe(-1);
  });

  it("Absage gibt Startzeit und Dauer wieder frei", () => {
    expect(withoutBooking(["10:00", "14:00", "14:00+2", "18:00+3"], "14:00")).toEqual(["10:00", "18:00+3"]);
  });
});
