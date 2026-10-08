import { describe, expect, it } from "vitest";
import { cleanWorkHours, outsideWork, withinWork } from "./workHours";

const SLOTS = ["10:00", "12:00", "14:00", "16:00", "18:00", "19:00", "20:00"];

describe("Arbeitszeiten der Künstler", () => {
  /* Mittwoch 14–20 Uhr, Samstag 10–22 Uhr, sonst frei */
  const wh = cleanWorkHours({ "3": [14, 20], "6": [10, 22], "1": [20, 10], "x": [1, 2] })!;

  it("ungültige Einträge fallen weg", () => {
    expect(wh).toEqual({ "3": [14, 20], "6": [10, 22] });
    expect(cleanWorkHours(null)).toBeNull();
  });

  it("Show muss ganz in die Arbeitszeit passen", () => {
    // 2026-10-07 ist ein Mittwoch
    expect(withinWork(wh, "2026-10-07", "14:00", 2)).toBe(true);
    expect(withinWork(wh, "2026-10-07", "18:00", 2)).toBe(true);
    expect(withinWork(wh, "2026-10-07", "19:00", 2)).toBe(false);
    expect(withinWork(wh, "2026-10-07", "12:00", 1)).toBe(false);
    expect(outsideWork(wh, "2026-10-07", SLOTS, 2)).toEqual(["10:00", "12:00", "19:00", "20:00"]);
  });

  it("Tage ohne Eintrag sind frei, ohne Plan gibt es keine Grenze", () => {
    // 2026-10-08 Donnerstag
    expect(outsideWork(wh, "2026-10-08", SLOTS, 1)).toEqual(SLOTS);
    expect(outsideWork(null, "2026-10-08", SLOTS, 1)).toEqual([]);
    // Samstag 10–22
    expect(outsideWork(wh, "2026-10-10", SLOTS, 2)).toEqual([]);
  });
});
