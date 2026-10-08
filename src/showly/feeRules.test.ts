import { describe, expect, it } from "vitest";
import { cleanRate, pickRate, type FeeRule } from "./feeRules";

describe("Provision je Kategorie oder Anbieter", () => {
  const rules: FeeRule[] = [
    { scope: "category", ref: "magician", rate: 0.15 },
    { scope: "category", ref: "sweets", rate: 0.1 },
    { scope: "artist", ref: "100007", rate: 0.12 },
    { scope: "deco", ref: "100020", rate: 0.08 },
  ];
  it("Anbieter vor Kategorie vor Standard", () => {
    expect(pickRate(rules, { kind: "artist", providerId: 100007, category: "magician" }, 0.2)).toBe(0.12);
    expect(pickRate(rules, { kind: "artist", providerId: 100008, category: "magician" }, 0.2)).toBe(0.15);
    expect(pickRate(rules, { kind: "artist", providerId: 100009, category: "clown" }, 0.2)).toBe(0.2);
  });
  it("Konditoreien und Deko über ihre Bereiche", () => {
    expect(pickRate(rules, { kind: "baker", providerId: 100050 }, 0.2)).toBe(0.1);
    expect(pickRate(rules, { kind: "deco", providerId: 100020 }, 0.2)).toBe(0.08);
    expect(pickRate(rules, { kind: "deco", providerId: 100021 }, 0.2)).toBe(0.2);
  });
  it("Eingabe als Prozent oder Anteil, höchstens 50 %", () => {
    expect(cleanRate("15")).toBe(0.15);
    expect(cleanRate("0,125")).toBe(0.125);
    expect(cleanRate(60)).toBeNull();
    expect(cleanRate("x")).toBeNull();
  });
});
