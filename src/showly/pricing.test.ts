import { describe, expect, it } from "vitest";
import { bookingPrice, cakePrice, cartTotals, priceLines, sweetPrice } from "./pricing";
import { ARTISTS } from "./data";
import { SWEETS, isDirectSweet } from "./sweets";

const name = (v: unknown) =>
  typeof v === "string" ? v : String((v as { de?: string })?.de ?? "");
const labels = { rent: "Miete", buy: "Kauf" };

describe("Torten & Süßes: Direktbuchung", () => {
  const cupcakes = SWEETS.find((s) => s.cat === "cupcakes")!;
  const wedding = SWEETS.find((s) => s.cat === "wedding")!;

  it("feste Pakete sind direkt buchbar, Hochzeits- und Motivtorten nicht", () => {
    expect(isDirectSweet(cupcakes)).toBe(true);
    expect(isDirectSweet(wedding)).toBe(false);
    expect(isDirectSweet({ ...wedding, direct: true })).toBe(true);
  });

  it("der Preis kommt aus dem Katalog, nicht aus dem Browser", () => {
    expect(sweetPrice(cupcakes.id, 2)).toBe(cupcakes.price * 2);
    expect(sweetPrice(wedding.id, 50)).toBeNull();
    const { lines, unknown } = priceLines([], [], name, labels, [
      { sweetId: cupcakes.id, qty: 2, dateISO: "2026-10-10" },
    ]);
    expect(unknown).toEqual([]);
    expect(lines[0]!.amountInCents).toBe(Math.round(cupcakes.price * 2 * 100));
  });

  it("Wunschtorten werden zum Richtpreis sofort bezahlt", () => {
    const { lines, unknown } = priceLines([], [], name, labels, [
      { sweetId: wedding.id, qty: 50, dateISO: "2026-10-10" },
    ]);
    expect(unknown).toEqual([]);
    expect(lines[0]!.amountInCents).toBe(Math.round(cakePrice(wedding.id, 50)! * 100));
  });

  it("in der Summe zählen Pakete und Wunschtorten", () => {
    const t = cartTotals(
      [],
      [],
      [
        { sweetId: cupcakes.id, qty: 1, direct: true, estimate: 1 },
        { sweetId: wedding.id, qty: 50, estimate: 400 },
      ],
    );
    expect(t.sweets).toBe(cupcakes.price + cakePrice(wedding.id, 50)!);
    expect(t.total).toBe(t.sweets);
  });
});

describe("Künstlerbuchung: Endpreis und Provision", () => {
  const a = { ...ARTISTS[0]!, price: 150, minHours: 1 };
  it("Kunde zahlt den Endpreis ohne Aufschlag, Künstler bekommt 80 %", () => {
    const p = bookingPrice(a, 1);
    expect(p.total).toBe(150);
    expect(p.fee).toBe(30);
    expect(p.payout).toBe(120);
  });
  it("an der Kasse gibt es keinen Posten Servicegebühr", () => {
    const { lines } = priceLines([], [{ artistId: ARTISTS[0]!.id, hours: 2, dateISO: "2026-10-10", slot: "15:00" }], name, labels);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.amountInCents * lines[0]!.quantity).toBe(Math.round(ARTISTS[0]!.price * 100) * Math.max(2, Number(ARTISTS[0]!["minHours"]) || 1));
  });
});
