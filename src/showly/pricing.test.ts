import { describe, expect, it } from "vitest";
import { cartTotals, priceLines, sweetPrice } from "./pricing";
import { SWEETS, isDirectSweet } from "./sweets";

const name = (v: unknown) =>
  typeof v === "string" ? v : String((v as { de?: string })?.de ?? "");
const labels = { rent: "Miete", buy: "Kauf", fee: "Servicegebühr" };

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

  it("Anfragen tauchen nicht als Bezahlposten auf", () => {
    const { unknown } = priceLines([], [], name, labels, [
      { sweetId: wedding.id, qty: 50, dateISO: "2026-10-10" },
    ]);
    expect(unknown).toEqual([`sweet:${wedding.id}`]);
  });

  it("in der Summe zählen nur direkt gebuchte Pakete", () => {
    const t = cartTotals(
      [],
      [],
      [
        { sweetId: cupcakes.id, qty: 1, direct: true, estimate: 1 },
        { sweetId: wedding.id, qty: 50, estimate: 400 },
      ],
    );
    expect(t.sweets).toBe(cupcakes.price);
    expect(t.total).toBe(cupcakes.price);
  });
});
