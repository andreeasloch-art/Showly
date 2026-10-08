import { describe, expect, it } from "vitest";
import { cleanPackages, fromPrice, isPlannerCat, packagesProblem } from "./plannerPackages";

describe("Planer-Pakete Basic, Premium, Luxus", () => {
  const raw = [
    { id: "luxus", price: "4.900", name: "Luxus", inc: ["Komplette Planung", "Dekoration", "Dekoration", " "], text: "Alles aus einer Hand.", popular: true },
    { id: "basic", price: 900, inc: ["Ablaufplan", "Betreuung am Tag"], text: "Für kleine Feiern", dur: "bis 50 Gäste" },
    { id: "premium", price: "2490,50", name: "Premium Plus", inc: ["Ablaufplan", "Dienstleister-Suche"], popular: true },
    { id: "gold", price: 100, inc: ["x"] },
  ];

  it("ordnet Basic → Premium → Luxus, säubert Leistungen und Preise", () => {
    const p = cleanPackages(raw);
    expect(p.map((x) => x.id)).toEqual(["basic", "premium", "luxus"]);
    expect(p[0]!.name).toBe("Basic");
    expect(p[0]!.dur).toBe("bis 50 Gäste");
    expect(p[1]!.price).toBe(2490.5);
    expect(p[2]!.inc).toEqual(["Komplette Planung", "Dekoration"]);
  });

  it("höchstens ein Paket ist „beliebt“", () => {
    expect(cleanPackages(raw).filter((x) => x.popular).map((x) => x.id)).toEqual(["premium"]);
  });

  it("ungültige Preise fallen weg", () => {
    expect(cleanPackages([{ id: "basic", price: 10, inc: ["a"] }])).toEqual([]);
    expect(cleanPackages("x")).toEqual([]);
  });

  it("prüft Leistungen und Preisreihenfolge", () => {
    const p = cleanPackages(raw);
    expect(packagesProblem(p)).toBeNull();
    expect(packagesProblem([])).toBe("none");
    expect(packagesProblem(cleanPackages([{ id: "basic", price: 900, inc: [] }]))).toBe("items");
    expect(packagesProblem(cleanPackages([{ id: "basic", price: 900, inc: ["a"] }, { id: "premium", price: 500, inc: ["b"] }]))).toBe("order");
    expect(fromPrice(p)).toBe(900);
  });

  it("nur für Hochzeits- und Eventplaner", () => {
    expect(isPlannerCat("weddingplanner")).toBe(true);
    expect(isPlannerCat("magician")).toBe(false);
  });
});
