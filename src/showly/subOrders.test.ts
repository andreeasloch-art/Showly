import { describe, expect, it } from "vitest";
import { splitIntoSubOrders, type SplitInput } from "./subOrders";

const base: SplitInput = {
  paid: true,
  feeRate: 0.2,
  bookings: [
    { artistId: 100001, owner: "a1", amountCents: 20000, feeCents: 4000, payoutCents: 16000, request: false },
    { artistId: 100002, owner: "a2", amountCents: 30000, feeCents: 6000, payoutCents: 24000, request: true },
  ],
  sweets: [
    { bakerId: 200001, owner: "b1", priceCents: 9000, direct: true },
    { bakerId: 200001, owner: "b1", priceCents: 3000, direct: true },
  ],
  shop: [
    { providerId: 300001, owner: "d1", amountCents: 5000 },
    { providerId: null, owner: null, amountCents: 2500 },
    { providerId: null, owner: null, amountCents: 1500 },
  ],
};

describe("Warenkorb in Teilbestellungen je Anbieter", () => {
  const subs = splitIntoSubOrders(base);
  const by = (k: string) => subs.find((s) => s.key === k)!;

  it("eine Teilbestellung je Anbieter", () => {
    expect(subs.map((s) => s.key).sort()).toEqual(["artist:100001", "artist:100002", "baker:200001", "deco:300001", "showly:showly"]);
  });

  it("Beträge, Provision und Auszahlung je Anbieter", () => {
    expect(by("baker:200001")).toMatchObject({ amountCents: 12000, feeCents: 2400, payoutCents: 9600, status: "paid" });
    expect(by("deco:300001")).toMatchObject({ amountCents: 5000, feeCents: 1000, payoutCents: 4000 });
    /* Showly-Katalog: keine Auszahlung an Dritte */
    expect(by("showly:showly")).toMatchObject({ amountCents: 4000, feeCents: 4000, payoutCents: 0, owner: null });
  });

  it("Status je Anbieter: Sofortbuchung bestätigt, Anfrage wartet", () => {
    expect(by("artist:100001").status).toBe("confirmed");
    expect(by("artist:100002").status).toBe("requested");
  });

  it("Summe aller Teilbestellungen = Warenkorb", () => {
    const sum = subs.reduce((s, x) => s + x.amountCents, 0);
    expect(sum).toBe(20000 + 30000 + 12000 + 5000 + 4000);
    for (const s of subs) expect(s.feeCents + s.payoutCents).toBe(s.amountCents);
  });

  it("jede Position landet in genau einer Teilbestellung", () => {
    const parts = subs.flatMap((s) => s.parts.map((p) => `${p.type}:${p.index}`)).sort();
    expect(parts).toEqual(["booking:0", "booking:1", "shop:0", "shop:1", "shop:2", "sweet:0", "sweet:1"]);
  });

  it("Torten-Anfrage ohne Festpreis: Teilbestellung ohne Betrag, Status Anfrage", () => {
    const s = splitIntoSubOrders({ ...base, bookings: [], shop: [], sweets: [{ bakerId: 7, owner: null, priceCents: 0, direct: false }] });
    expect(s[0]).toMatchObject({ amountCents: 0, status: "requested" });
  });

  it("unbezahlt: offen statt bezahlt", () => {
    const s = splitIntoSubOrders({ ...base, paid: false });
    expect(s.find((x) => x.key === "artist:100001")!.status).toBe("pending");
    expect(s.find((x) => x.key === "deco:300001")!.status).toBe("pending");
  });
});
