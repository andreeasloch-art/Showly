import { describe, expect, it } from "vitest";
import { CITIES, SERVICES, cityBySlug, distanceKm, nearbyCities, serves } from "./landing";
import { CAT_SLUG, slugify } from "./slugs";

describe("Stadtseiten", () => {
  const berlin = cityBySlug("berlin")!;
  it("Städte-Schlüssel passen zur Umschrift der Adressen", () => {
    for (const c of CITIES) expect(slugify(c.name)).toBe(c.slug);
  });
  it("jede Leistung hat eigenen Text und gültige Kategorie", () => {
    const intros = new Set(SERVICES.map((s) => s.intro));
    expect(intros.size).toBe(SERVICES.length);
    for (const s of SERVICES) {
      expect(s.cat === "cake" || CAT_SLUG[s.cat] === s.slug).toBe(true);
      expect(s.tips.length).toBeGreaterThanOrEqual(3);
    }
  });
  it("Entfernung und Umkreis", () => {
    expect(Math.round(distanceKm(berlin, cityBySlug("hamburg")!))).toBeGreaterThan(240);
    expect(serves("berlin", 0, berlin)).toBe(true);
    expect(serves("potsdam", 500, berlin)).toBe(false); // unbekannter Ort: nur genauer Treffer
    expect(serves("leipzig", 160, berlin)).toBe(true);
    expect(serves("leipzig", 100, berlin)).toBe(false);
  });
  it("Nachbarstädte", () => {
    expect(nearbyCities(cityBySlug("koeln")!, 2).map((c) => c.slug)).toEqual(["duesseldorf", "essen"]);
  });
});
