import { describe, expect, it } from "vitest";
import { berlinStart, decide, hearingOver, plannedPayout, requestLapsed, type BookingFacts } from "./cloudRules";

const base: BookingFacts = {
  status: "confirmed",
  day: "2026-10-10",
  slot: "15:00",
  paid: true,
  payout_cents: 20000,
  checkin_code: "4711",
  checked_in_at: null,
  requested_at: null,
};
/* 10.10.2026, 15:00 in Deutschland (Sommerzeit) = 13:00 UTC */
const START = Date.UTC(2026, 9, 10, 13, 0);
const H = 3600000;

describe("berlinStart", () => {
  it("rechnet deutsche Sommer- und Winterzeit um", () => {
    expect(berlinStart("2026-10-10", "15:00")).toBe(START);
    expect(berlinStart("2026-12-10", "15:00")).toBe(Date.UTC(2026, 11, 10, 14, 0));
  });
});

describe("Absage durch den Künstler (§ 9)", () => {
  it("ab 14 Tagen vorher folgenlos", () => {
    const d = decide({ kind: "cancelArtist", emergency: false }, "artist", base, START - 15 * 24 * H);
    expect(d).toMatchObject({ result: "free", payout: "cancel", booking: { status: "declined", cancelled_by: "artist" } });
    expect("newPenalty" in d && d.newPenalty).toBeFalsy();
  });
  it("unter 14 Tagen: 15 % Strafe, unter 48 Stunden 25 %, Gutschein", () => {
    const d = decide({ kind: "cancelArtist", emergency: false }, "artist", base, START - 5 * 24 * H);
    expect(d).toMatchObject({ result: "penalty", voucher: true, newPenalty: { reason: "late", status: "due", amount_cents: 3000 } });
    const u = decide({ kind: "cancelArtist", emergency: false }, "artist", base, START - 5 * H);
    expect(u).toMatchObject({ newPenalty: { amount_cents: 5000 } });
  });
  it("später mit Notfall: Nachweis wird geprüft, Kunde bekommt trotzdem den Gutschein", () => {
    const d = decide({ kind: "cancelArtist", emergency: true }, "artist", base, START - 5 * H);
    expect(d).toMatchObject({ result: "proof", voucher: true, newPenalty: { status: "proof" } });
  });
  it("Privatanbieter: Eintrag fürs Stufenmodell, aber keine Geldstrafe; Kunde bekommt Gutschein", () => {
    const priv = { ...base, business: false };
    expect(decide({ kind: "cancelArtist", emergency: false }, "artist", priv, START - 5 * H)).toMatchObject({
      result: "penalty",
      voucher: true,
      newPenalty: { reason: "late", status: "due", amount_cents: 0 },
    });
    expect(decide({ kind: "reportNoShow" }, "customer", priv, START + 2 * H)).toMatchObject({
      newPenalty: { reason: "noshow", status: "hearing", amount_cents: 0 },
    });
  });
  it("Kunde darf nicht als Künstler absagen", () => {
    expect(decide({ kind: "cancelArtist", emergency: false }, "customer", base, START - 30 * H)).toHaveProperty("error");
  });
});

describe("Stornierung durch den Kunden (§ 8)", () => {
  it("ältere Buchung ohne Stufe: bis 24 Stunden vorher kostenlos, Auszahlung entfällt", () => {
    expect(decide({ kind: "cancelCustomer" }, "customer", base, START - 25 * H)).toMatchObject({ result: "free", payout: "cancel" });
  });
  it("später bleibt die Gage geschuldet", () => {
    const d = decide({ kind: "cancelCustomer" }, "customer", base, START - 2 * H);
    expect(d).toMatchObject({ result: "late", payoutShare: 1 });
    expect("payout" in d && d.payout).toBeFalsy();
  });
  it("gespeicherte Stufe Moderat: 10 Tage vorher 50 % zurück, Auszahlung halbiert", () => {
    const m = { ...base, amount_cents: 25000, policy: { kind: "artist", tier: "moderat", free: 336, half: 168, midRate: 0.5, rebook: true } };
    expect(decide({ kind: "cancelCustomer" }, "customer", m, START - 10 * 24 * H)).toMatchObject({
      result: "late",
      refundCents: 12500,
      payoutShare: 0.5,
    });
    expect(decide({ kind: "cancelCustomer" }, "customer", m, START - 15 * 24 * H)).toMatchObject({ result: "free", refund: true });
  });
  it("offene Anfrage immer kostenlos", () => {
    expect(decide({ kind: "cancelCustomer" }, "customer", { ...base, status: "requested" }, START - 2 * H)).toMatchObject({ result: "free" });
  });
});

describe("Nichterscheinen, Anhörung und Check-in", () => {
  it("Meldung nach Beginn startet 7 Tage Anhörung mit 100 %", () => {
    const d = decide({ kind: "reportNoShow" }, "customer", base, START + 2 * H);
    expect(d).toMatchObject({ booking: { status: "noshow" }, newPenalty: { reason: "noshow", status: "hearing", amount_cents: 20000 } });
  });
  it("keine Meldung, wenn eingecheckt oder vor Beginn", () => {
    expect(decide({ kind: "reportNoShow" }, "customer", { ...base, checked_in_at: "x" }, START + H)).toHaveProperty("error");
    expect(decide({ kind: "reportNoShow" }, "customer", base, START - H)).toHaveProperty("error");
  });
  it("Check-in nur mit richtigem Code im Zeitfenster", () => {
    expect(decide({ kind: "checkin", code: "4711" }, "artist", base, START - H)).toMatchObject({ booking: { checked_in_by: "artist" } });
    expect(decide({ kind: "checkin", code: "1234" }, "artist", base, START - H)).toHaveProperty("error");
    expect(decide({ kind: "checkin", code: "4711" }, "artist", base, START - 5 * H)).toHaveProperty("error");
  });
  it("Stellungnahme setzt die Strafe auf Prüfung", () => {
    expect(decide({ kind: "claim", statement: "Unfall" }, "artist", base, START, { status: "hearing" })).toMatchObject({
      penalty: { status: "proof", statement: "Unfall" },
    });
    expect(decide({ kind: "claim" }, "artist", base, START, { status: "waived" })).toHaveProperty("error");
  });
  it("Anhörung und Anfragen laufen ab", () => {
    expect(hearingOver({ status: "hearing", hearing_until: "2026-10-01T00:00:00Z" }, Date.UTC(2026, 9, 2))).toBe(true);
    expect(requestLapsed({ ...base, status: "requested", requested_at: "2026-10-01T00:00:00Z" }, Date.UTC(2026, 9, 4))).toBe(true);
    expect(requestLapsed({ ...base, status: "requested", requested_at: "2026-10-01T00:00:00Z" }, Date.UTC(2026, 9, 2))).toBe(false);
  });
});

describe("Anfrage beantworten", () => {
  it("Zusage bei bezahlter Anfrage bestätigt und plant die Auszahlung", () => {
    expect(decide({ kind: "respond", accept: true }, "artist", { ...base, status: "requested" })).toMatchObject({
      booking: { status: "confirmed" },
      payout: "create",
    });
  });
});

describe("Auszahlung (§ 21)", () => {
  it("7 Tage nach dem Termin, Einbehalt bei den ersten 5 Buchungen", () => {
    const p = plannedPayout({ day: "2026-09-25", amount_cents: 30000, payout_cents: 20000 }, 0);
    expect(p).toMatchObject({ payout_on: "2026-10-02", reserve_cents: 4000, net_cents: 18100, provision_ust_cent: 1900, fee_cents: 10000 });
    expect(plannedPayout({ day: "2026-09-25", amount_cents: 30000, payout_cents: 20000 }, 5).reserve_cents).toBe(0);
  });
});

describe("Erstattung (§ 8 Abs. 1, § 9 Abs. 1 und 4)", () => {
  it("kostenlose Stornierung durch den Kunden: alles zurück", () => {
    expect(decide({ kind: "cancelCustomer" }, "customer", base, START - 30 * H)).toMatchObject({ refund: true });
  });
  it("späte Stornierung durch den Kunden: keine Erstattung", () => {
    const d = decide({ kind: "cancelCustomer" }, "customer", base, START - 5 * H);
    expect("refund" in d && d.refund).toBeFalsy();
  });
  it("Absage durch den Künstler, auch spät: alles zurück", () => {
    expect(decide({ kind: "cancelArtist", emergency: false }, "artist", base, START - 30 * 24 * H)).toMatchObject({ refund: true });
    expect(decide({ kind: "cancelArtist", emergency: true }, "artist", base, START - 5 * H)).toMatchObject({ refund: true });
  });
  it("Nichterscheinen gemeldet: alles zurück", () => {
    expect(decide({ kind: "reportNoShow" }, "customer", base, START + 2 * H)).toMatchObject({ refund: true });
  });
  it("Anfrage abgelehnt: bezahlt zurück, unbezahlt nichts zu erstatten", () => {
    const req = { ...base, status: "requested" };
    expect(decide({ kind: "respond", accept: false }, "artist", req, START - 50 * H)).toMatchObject({ refund: true });
    const d = decide({ kind: "respond", accept: false }, "artist", { ...req, paid: false }, START - 50 * H);
    expect("refund" in d && d.refund).toBeFalsy();
  });
});
