import { describe, expect, it } from "vitest";
import { externalEntries } from "./schedule.server";
import { SLOTS } from "@/showly/ui";
import { unavailable } from "@/showly/schedule";

describe("Termine aus fremden Kalendern im Showly-Kalender", () => {
  it("Termin am Nachmittag (Berliner Zeit) mit Fahrtzeit", () => {
    const e = externalEntries(new Date("2026-12-12T14:30:00Z"), new Date("2026-12-12T16:00:00Z"), false);
    expect(e).toEqual([["2026-12-12", "15:30+1.5"]]);
    // 15:30–17:00 belegt, mit Fahrtzeit: Showly-Shows (2 h) gehen bis 12:30 Ende bzw. ab 18:00
    const blocked = unavailable(SLOTS, 2, e.map((x) => x[1]));
    expect(blocked).toEqual(["13:00", "14:00", "15:00", "16:00", "17:00"]);
  });

  it("ganztägig belegt sperrt den Tag", () => {
    const e = externalEntries(new Date("2026-12-23T23:00:00Z"), new Date("2026-12-24T23:00:00Z"), true);
    expect(e).toEqual([["2026-12-24", "all"]]);
  });

  it("über Mitternacht: zwei Tage", () => {
    const e = externalEntries(new Date("2026-12-12T21:00:00Z"), new Date("2026-12-13T01:00:00Z"), false);
    expect(e).toEqual([
      ["2026-12-12", "22:00+2"],
      ["2026-12-13", "00:00+2"],
    ]);
  });
});
