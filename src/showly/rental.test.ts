import { describe, expect, it } from "vitest";
import { priceLines, shopLineTotal } from "./pricing";
import type { ShopItem } from "./data";
import { maxInUse, occupied, rentDays, rentalFree, shipFee, shipOptions, type Claim } from "./rental";

describe("Mietzeitraum", () => {
  it("zählt erster und letzter Tag mit", () => {
    expect(rentDays("2026-10-30", "2026-10-31")).toBe(2);
    expect(rentDays("2026-10-31", "2026-10-31")).toBe(1);
    expect(rentDays("2026-10-31", "2026-11-02")).toBe(3);
  });
  it("ungültig: rückwärts, zu lang oder kein Datum", () => {
    expect(rentDays("2026-11-02", "2026-10-31")).toBe(0);
    expect(rentDays("2026-10-01", "2026-11-15")).toBe(0);
    expect(rentDays(undefined, "2026-10-31")).toBe(0);
  });
});

describe("Verfügbarkeit nach Stückzahl mit Reinigungspuffer", () => {
  /* Halloween: 2 Hexenkostüme, 1 Tag Reinigung nach der Rückgabe */
  const terms = { stock: 2, bufferDays: 1 };
  const claims: Claim[] = [
    { from: "2026-10-30", until: "2026-11-01", qty: 1 }, // 30.–31.10. + 1 Tag Puffer
    { from: "2026-10-31", until: "2026-11-01", qty: 1 },
  ];

  it("belegt Zeitraum plus Puffer", () => {
    expect(occupied("2026-10-30", "2026-10-31", 1)).toEqual(["2026-10-30", "2026-11-01"]);
    expect(maxInUse(claims, "2026-10-29", "2026-11-03")).toBe(2);
  });

  it("an Halloween sind beide weg, am 29.10. noch eins frei", () => {
    expect(rentalFree(terms, claims, "2026-10-31", "2026-10-31", 1)).toBe(false);
    // 28.–29.10. + Puffer 30.10.: dann ist am 30.10. eins belegt → noch eins frei
    expect(rentalFree(terms, claims, "2026-10-28", "2026-10-29", 1)).toBe(true);
    expect(rentalFree(terms, claims, "2026-10-28", "2026-10-29", 2)).toBe(false);
  });

  it("nach Rückgabe und Reinigung wieder frei", () => {
    expect(rentalFree(terms, claims, "2026-11-01", "2026-11-02", 1)).toBe(false);
    expect(rentalFree(terms, claims, "2026-11-02", "2026-11-03", 2)).toBe(true);
  });

  it("Standard: ein Stück, ein Tag Puffer", () => {
    expect(rentalFree({}, [{ from: "2026-12-24", until: "2026-12-25", qty: 1 }], "2026-12-25", "2026-12-26", 1)).toBe(false);
    expect(rentalFree({}, [{ from: "2026-12-24", until: "2026-12-25", qty: 1 }], "2026-12-26", "2026-12-26", 1)).toBe(true);
  });
});

describe("Übergabe", () => {
  it("Abholung immer, Lieferung und Versand nur wenn angeboten", () => {
    expect(shipOptions({})).toEqual(["pickup"]);
    expect(shipOptions({ deliveryFee: 15, shippingFee: 9.9 })).toEqual(["pickup", "delivery", "shipping"]);
    expect(shipFee({ shippingFee: 9.9 }, "shipping")).toBe(9.9);
    expect(shipFee({}, "delivery")).toBeNull();
    expect(shipFee({}, undefined)).toBe(0);
  });
});


describe("Mietpreis an der Kasse (Server rechnet genauso)", () => {
  const item = {
    id: 100001,
    cat: "fairy",
    rent: 30,
    buy: 200,
    rating: 0,
    reviews: 0,
    name: "Hexenkostüm",
    desc: "",
    stock: 2,
    deposit: 50,
    sizes: ["S", "M"],
    shippingFee: 9.9,
  } as ShopItem;
  const extra = { item: (id: number) => (id === item.id ? item : undefined) };
  const name = (v: unknown) => String(v);

  it("Miete × Tage × Stück, dazu Kaution je Stück und Versand", () => {
    const l = { shopId: item.id, mode: "rent" as const, qty: 2, from: "2026-10-30", to: "2026-10-31", size: "M", ship: "shipping" as const };
    const { lines, unknown } = priceLines([l], [], name, { rent: "Miete", buy: "Kauf" }, [], extra, { allowDemo: false });
    expect(unknown).toEqual([]);
    const cents = lines.reduce((n, x) => n + x.amountInCents * x.quantity, 0);
    expect(cents).toBe(30 * 2 * 2 * 100 + 50 * 2 * 100 + 990);
    expect(shopLineTotal(item, l)).toBe(30 * 2 * 2 + 50 * 2 + 9.9);
  });

  it("ohne Zeitraum, ohne Größe oder mit nicht angebotener Lieferung nicht bezahlbar", () => {
    const base = { shopId: item.id, mode: "rent" as const, qty: 1 };
    const L = (x: object) => priceLines([{ ...base, ...x }], [], name, { rent: "", buy: "" }, [], extra, { allowDemo: false }).unknown;
    expect(L({ size: "M" })).toEqual(["rent:100001"]);
    expect(L({ from: "2026-10-30", to: "2026-10-31" })).toEqual(["rent:100001"]);
    expect(L({ from: "2026-10-30", to: "2026-10-31", size: "M", ship: "delivery" })).toEqual(["rent:100001"]);
    expect(L({ from: "2026-10-30", to: "2026-10-31", size: "M" })).toEqual([]);
  });
});

describe("Kostüm kaufen mit Größe", () => {
  const costume = { id: 100002, cat: "fairy", rent: 0, buy: 120, rating: 0, reviews: 0, name: "Fee", desc: "", sizes: ["116", "128"] } as ShopItem;
  const extra = { item: (id: number) => (id === costume.id ? costume : undefined) };
  const L = (x: object) =>
    priceLines([{ shopId: costume.id, mode: "buy" as const, qty: 1, ...x }], [], String, { rent: "", buy: "Kauf" }, [], extra, { allowDemo: false });
  it("ohne oder mit falscher Größe nicht bezahlbar", () => {
    expect(L({}).unknown).toEqual(["size:100002"]);
    expect(L({ size: "XXL" }).unknown).toEqual(["size:100002"]);
  });
  it("mit Größe: Kaufpreis, Größe im Posten", () => {
    const r = L({ size: "128" });
    expect(r.unknown).toEqual([]);
    expect(r.lines[0]!.name).toContain("128");
    expect(r.lines[0]!.amountInCents).toBe(12000);
  });
});
