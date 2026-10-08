import { describe, expect, it } from "vitest";
import { ALLERGENS, allergenList, checkCakeDay, cleanFoodInfo, foodInfoComplete } from "./cakeRules";

describe("Allergene und Pflichtangaben (LMIV)", () => {
  it("genau die 14 Hauptallergene", () => {
    expect(ALLERGENS).toHaveLength(14);
  });

  it("unbekannte Werte fliegen raus, Spuren nicht doppelt", () => {
    const f = cleanFoodInfo({
      allergens: ["eggs", "milk", "gluten", "unsinn", "eggs"],
      traces: ["nuts", "milk"],
      ingredients: " Weizenmehl, Zucker, Butter, Eier ",
      shelfLife: "2 Tage gekühlt",
      storage: "cool",
      noAllergens: true,
    })!;
    expect(f.allergens).toEqual(["eggs", "milk", "gluten"]);
    expect(f.traces).toEqual(["nuts"]);
    expect(f.noAllergens).toBe(false);
    expect(f.ingredients).toBe("Weizenmehl, Zucker, Butter, Eier");
    expect(allergenList(f, "de")).toBe("Eier, Milch (inkl. Laktose), Glutenhaltiges Getreide");
    expect(foodInfoComplete(f)).toBe(true);
  });

  it("ohne Allergenangabe oder Zutaten nicht vollständig", () => {
    expect(foodInfoComplete(cleanFoodInfo({ ingredients: "Zucker", shelfLife: "1 Woche" }))).toBe(false);
    expect(foodInfoComplete(cleanFoodInfo({ allergens: ["milk"], shelfLife: "1 Woche" }))).toBe(false);
    expect(foodInfoComplete(cleanFoodInfo({ noAllergens: true, ingredients: "Zucker, Farbstoff", shelfLife: "3 Monate" }))).toBe(true);
    expect(foodInfoComplete(null)).toBe(false);
  });
});

describe("Bestelltag: Vorlaufzeit und Tageskapazität", () => {
  const rules = { leadDays: 5, maxPerDay: 3 };
  it("Motivtorte mit 5 Tagen Vorlauf", () => {
    expect(checkCakeDay(rules, "2026-10-11", "2026-10-07", 0)).toEqual({ ok: false, reason: "lead", earliest: "2026-10-12" });
    expect(checkCakeDay(rules, "2026-10-12", "2026-10-07", 0)).toEqual({ ok: true });
  });
  it("Tag voll, wenn die Backstube ausgelastet ist", () => {
    expect(checkCakeDay(rules, "2026-10-20", "2026-10-07", 2)).toEqual({ ok: true });
    expect(checkCakeDay(rules, "2026-10-20", "2026-10-07", 3)).toEqual({ ok: false, reason: "full" });
    expect(checkCakeDay({ leadDays: 1, maxPerDay: 0 }, "2026-10-20", "2026-10-07", 99)).toEqual({ ok: true });
  });
  it("über den Monatswechsel", () => {
    expect(checkCakeDay({ leadDays: 7, maxPerDay: 0 }, "2026-11-02", "2026-10-28", 0).ok).toBe(false);
    expect(checkCakeDay({ leadDays: 7, maxPerDay: 0 }, "2026-11-04", "2026-10-28", 0).ok).toBe(true);
  });
});
