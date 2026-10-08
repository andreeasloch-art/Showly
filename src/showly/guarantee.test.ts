import { describe, expect, it } from "vitest";
import { GUARANTEE, guaranteeCopy, guaranteePool } from "./guarantee";

describe("Ersatzgarantie", () => {
  it("Topf aus Vertragsstrafen und 5 % der Provision, abzüglich Verbrauch", () => {
    expect(guaranteePool({ penaltiesCents: 30000, feeCents: 200000 })).toBe(40000);
    expect(guaranteePool({ penaltiesCents: 0, feeCents: 100000, usedCents: 2000 })).toBe(3000);
    expect(guaranteePool({ penaltiesCents: 0, feeCents: 0, usedCents: 500 })).toBe(0);
  });
  it("Versprechen in allen Sprachen", () => {
    expect(GUARANTEE.de.claim).toContain("Ersatz");
    expect(guaranteeCopy("es").claim).toContain("sustituto");
    expect(guaranteeCopy("xx")).toBe(GUARANTEE.de);
  });
});
