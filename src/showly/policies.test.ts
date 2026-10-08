import { describe, expect, it } from "vitest";
import {
  apologyVoucherCents,
  artistCancelStage,
  canRebook,
  customerCancel,
  damageCents,
  depositAutoRelease,
  frequentComplainer,
  guideline,
  payoutFor,
  pickReplacements,
  policySnapshot,
  rebookTargetOk,
  reviewVisible,
  reviewWindow,
  upgradeCents,
} from "./policies";

const H = 3600000;
const start = Date.UTC(2026, 11, 20, 15);

describe("Stornostufen", () => {
  it("Flexibel: frei bis 7 Tage, 50 % bis 48 h, dann 100 %", () => {
    const p = policySnapshot("artist", "flexibel");
    expect(customerCancel(p, start, start - 8 * 24 * H, 10000).refundCents).toBe(10000);
    expect(customerCancel(p, start, start - 3 * 24 * H, 10000)).toMatchObject({ stage: "mid", refundCents: 5000 });
    expect(customerCancel(p, start, start - 24 * H, 10000)).toMatchObject({ stage: "full", refundCents: 0 });
  });
  it("Moderat und Streng", () => {
    const m = policySnapshot("artist", "moderat");
    expect(customerCancel(m, start, start - 10 * 24 * H, 10000).stage).toBe("mid");
    expect(customerCancel(m, start, start - 6 * 24 * H, 10000).stage).toBe("full");
    const s = policySnapshot("artist", "streng");
    expect(customerCancel(s, start, start - 31 * 24 * H, 10000).stage).toBe("free");
    expect(customerCancel(s, start, start - 20 * 24 * H, 10000).stage).toBe("mid");
    expect(customerCancel(s, start, start - 13 * 24 * H, 10000).stage).toBe("full");
  });
  it("unbekannte Stufe wird Moderat", () => {
    expect(policySnapshot("artist", "xyz").tier).toBe("moderat");
  });
  it("Torte: nach Produktionsbeginn nichts zurück", () => {
    const p = policySnapshot("cake", "flexibel", 4);
    expect(customerCancel(p, start, start - 5 * 24 * H, 8000).refundCents).toBe(8000);
    expect(customerCancel(p, start, start - 3 * 24 * H, 8000).refundCents).toBe(0);
  });
  it("Verleih: danach Teilbetrag plus Versand", () => {
    const p = policySnapshot("rental", "moderat");
    expect(customerCancel(p, start, start - 4 * 24 * H, 4000, 800).refundCents).toBe(4000);
    // 800 Versand + 25 % von 3200 = 1600 bleiben
    expect(customerCancel(p, start, start - 24 * H, 4000, 800).refundCents).toBe(2400);
  });
  it("einmal umbuchen bis 48 h vorher, höchstens 6 Monate später", () => {
    const p = policySnapshot("artist", "streng");
    expect(canRebook(p, { status: "confirmed" }, start, start - 72 * H)).toBe(true);
    expect(canRebook(p, { status: "confirmed", rebooked_at: "x" }, start, start - 72 * H)).toBe(false);
    expect(canRebook(p, { status: "confirmed" }, start, start - 24 * H)).toBe(false);
    expect(canRebook(policySnapshot("cake", "x"), { status: "confirmed" }, start, start - 72 * H)).toBe(false);
    expect(rebookTargetOk("2026-12-20", "2027-06-20", "2026-12-01")).toBe(true);
    expect(rebookTargetOk("2026-12-20", "2027-06-21", "2026-12-01")).toBe(false);
    expect(rebookTargetOk("2026-12-20", "2026-11-30", "2026-12-01")).toBe(false);
  });
});

describe("Künstler sagt ab", () => {
  it("Stufen", () => {
    expect(artistCancelStage(start, start - 15 * 24 * H)).toBe("free");
    expect(artistCancelStage(start, start - 10 * 24 * H)).toBe("late");
    expect(artistCancelStage(start, start - 24 * H)).toBe("urgent");
  });
  it("Gutschein 15 %, mindestens 10 €; Aufpreis bis 100 €", () => {
    expect(apologyVoucherCents(40000)).toBe(6000);
    expect(apologyVoucherCents(3000)).toBe(1000);
    expect(upgradeCents(30000, 35000)).toBe(5000);
    expect(upgradeCents(30000, 50000)).toBe(10000);
    expect(upgradeCents(30000, 20000)).toBe(0);
  });
  it("drei Ersatz-Künstler, Springer zuerst", () => {
    const base = { cat: "magic", city: "Berlin", rating: 4, price_cents: 20000, standby: false, busy: false, blocked: false };
    const list = [
      { ...base, id: 1 },
      { ...base, id: 2, rating: 5 },
      { ...base, id: 3, standby: true, rating: 3 },
      { ...base, id: 4, busy: true },
      { ...base, id: 5, city: "Hamburg" },
      { ...base, id: 6, cat: "clown" },
      { ...base, id: 7, rating: 4.5 },
    ];
    expect(pickReplacements({ id: 1, cat: "magic", city: "berlin", price_cents: 20000 }, list).map((c) => c.id)).toEqual([3, 2, 7]);
  });
});

describe("Reklamation, Schaden, Bewertung, Auszahlung", () => {
  it("Richtwerte", () => {
    expect(guideline("late", { lateMin: 20 }).min).toBe(0.2);
    expect(guideline("short", { bookedMin: 60, playedMin: 45 }).min).toBe(0.25);
    expect(guideline("cake", {}).max).toBe(1);
  });
  it("viele Reklamationen", () => {
    const now = Date.UTC(2026, 9, 1);
    expect(frequentComplainer(["2026-09-01", "2026-05-01", "2026-01-01"], now)).toBe(true);
    expect(frequentComplainer(["2026-09-01", "2025-05-01", "2026-01-01"], now)).toBe(false);
  });
  it("Schadenskatalog mit Sorglos-Paket und Kaution als Grenze", () => {
    expect(damageCents([{ key: "fleck" }, { key: "riss" }], { carefree: false, depositCents: 10000 })).toBe(4000);
    expect(damageCents([{ key: "fleck" }, { key: "riss" }], { carefree: true, depositCents: 10000 })).toBe(0);
    expect(damageCents([{ key: "verlust" }], { carefree: true, valueCents: 30000, depositCents: 10000 })).toBe(10000);
  });
  it("Kaution nach 72 h automatisch frei", () => {
    const r = "2026-10-01T10:00:00Z";
    expect(depositAutoRelease(r, false, Date.parse(r) + 73 * H)).toBe(true);
    expect(depositAutoRelease(r, false, Date.parse(r) + 70 * H)).toBe(false);
    expect(depositAutoRelease(r, true, Date.parse(r) + 100 * H)).toBe(false);
  });
  it("Bewertung 14 Tage, doppelt verdeckt", () => {
    const day = "2026-10-01";
    expect(reviewWindow(day, Date.parse("2026-10-01T15:00:00Z"))).toBe("early");
    expect(reviewWindow(day, Date.parse("2026-10-03T10:00:00Z"))).toBe("open");
    expect(reviewWindow(day, Date.parse("2026-10-17T10:00:00Z"))).toBe("closed");
    expect(reviewVisible(false, day, Date.parse("2026-10-05T10:00:00Z"))).toBe(false);
    expect(reviewVisible(true, day, Date.parse("2026-10-05T10:00:00Z"))).toBe(true);
  });
  it("Auszahlung 7 Tage, schneller 10 %, 48 h 20 %", () => {
    expect(payoutFor("2026-10-01", 10000, "standard")).toMatchObject({ payout_on: "2026-10-08", net_cents: 10000 });
    expect(payoutFor("2026-10-01", 10000, "fast")).toMatchObject({ payout_on: "2026-10-04", express_fee_cents: 1000 });
    expect(payoutFor("2026-10-01", 10000, "express")).toMatchObject({ payout_on: "2026-10-03", net_cents: 8000 });
  });
});
