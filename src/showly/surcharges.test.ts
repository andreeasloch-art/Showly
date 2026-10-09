import { describe, expect, it } from "vitest";
import { cleanSurcharges, surchargeFor, withSurcharge } from "./surcharges";

const s = cleanSurcharges({
  weekend: 15,
  seasons: [
    { from: "12-01", to: "12-24", pct: 20, label: "Weihnachtszeit" },
    { from: "12-20", to: "01-06", pct: 30, label: "Feiertage" },
    { from: "01-15", to: "02-28", pct: -10, label: "Nebensaison" },
  ],
});

describe("Saisonpreise und Wochenende", () => {
  it("ohne Angaben kein Zuschlag", () => {
    expect(cleanSurcharges({ weekend: 0, seasons: [] })).toBeNull();
    expect(withSurcharge(200, null, "2026-12-05")).toBe(200);
  });
  it("Wochenende Samstag und Sonntag", () => {
    expect(surchargeFor(s, "2026-10-10").pct).toBe(15); // Samstag
    expect(surchargeFor(s, "2026-10-11").pct).toBe(15); // Sonntag
    expect(surchargeFor(s, "2026-10-09").pct).toBe(0); // Freitag
  });
  it("Saison, höchste gewinnt, auch über den Jahreswechsel", () => {
    expect(surchargeFor(s, "2026-12-02").pct).toBe(20); // Mittwoch
    expect(surchargeFor(s, "2026-12-22").pct).toBe(30); // Dienstag, beide Saisonen
    expect(surchargeFor(s, "2027-01-04").pct).toBe(30); // Montag
  });
  it("Wochenende und Saison addieren sich, Rabatt möglich", () => {
    expect(withSurcharge(200, s, "2026-12-05")).toBe(270); // Samstag +15 +20
    expect(withSurcharge(200, s, "2027-02-02")).toBe(180); // Dienstag −10
  });
  it("ungültige Angaben werden verworfen", () => {
    const x = cleanSurcharges({ weekend: 500, seasons: [{ from: "13-01", to: "12-01", pct: 10 }, { from: "05-01", to: "05-31", pct: 900 }] });
    expect(x).toEqual({ weekend: 100, seasons: [{ from: "05-01", to: "05-31", pct: 100, label: "" }] });
  });
});
