import { describe, expect, it } from "vitest";
import { checkinCodeOf, checkinOpen, isLateCancel, presenceQuestion, standingOf } from "./booking";

const DAY = 86400000;
const now = new Date("2026-09-24T12:00:00").getTime();
const iso = (t: number) => new Date(t).toISOString();
const strike = (daysAgo: number) => ({ artistId: 1, reason: "noshow" as const, status: "due", dateISO: iso(now - daysAgo * DAY) });

describe("Stornofrist 24 Stunden", () => {
  it("25 Stunden vorher ist früh genug, 23 Stunden nicht", () => {
    const at = (h: number) => {
      const d = new Date(now + h * 3600000);
      return { dateISO: d.toISOString().slice(0, 10), slot: `${String(d.getHours()).padStart(2, "0")}:00` };
    };
    expect(isLateCancel(at(25), now)).toBe(false);
    expect(isLateCancel(at(23), now)).toBe(true);
  });
});

describe("Check-in", () => {
  const b = { id: 5, dateISO: "2026-09-24", slot: "14:00", status: "confirmed" };
  it("Code ist vierstellig und bleibt gleich", () => {
    expect(checkinCodeOf(b)).toMatch(/^\d{4}$/);
    expect(checkinCodeOf(b)).toBe(checkinCodeOf(b));
  });
  it("öffnet 2 Stunden vor Beginn", () => {
    expect(checkinOpen(b, new Date("2026-09-24T11:30:00").getTime())).toBe(false);
    expect(checkinOpen(b, new Date("2026-09-24T12:30:00").getTime())).toBe(true);
  });
  it("fragt den Kunden 30 Minuten nach Beginn, wenn niemand eingecheckt hat", () => {
    expect(presenceQuestion(b, new Date("2026-09-24T14:20:00").getTime())).toBe(false);
    expect(presenceQuestion(b, new Date("2026-09-24T14:40:00").getTime())).toBe(true);
    expect(presenceQuestion({ ...b, checkedInAt: "x" }, new Date("2026-09-24T14:40:00").getTime())).toBe(false);
  });
});

describe("Stufenmodell", () => {
  it("ohne Verstoß keine Einschränkung", () => {
    expect(standingOf(1, [], now)).toMatchObject({ bookable: true, instantAllowed: true, demoted: false });
  });
  it("1. Verstoß: 30 Tage nur Anfragen, weiter unten", () => {
    expect(standingOf(1, [strike(10)], now)).toMatchObject({ bookable: true, instantAllowed: false, demoted: true });
    expect(standingOf(1, [strike(40)], now)).toMatchObject({ instantAllowed: true, demoted: false });
  });
  it("2. Verstoß: 60 Tage gesperrt", () => {
    expect(standingOf(1, [strike(100), strike(5)], now)).toMatchObject({ bookable: false, removed: false });
    expect(standingOf(1, [strike(100), strike(70)], now)).toMatchObject({ bookable: true });
  });
  it("3. Verstoß in 12 Monaten: dauerhaft entfernt", () => {
    expect(standingOf(1, [strike(200), strike(100), strike(300)], now)).toMatchObject({ removed: true, bookable: false });
  });
  it("Verstöße älter als 12 Monate zählen nicht, offene Anhörungen auch nicht", () => {
    expect(standingOf(1, [strike(400), strike(500), strike(10)], now).strikes).toBe(1);
    expect(standingOf(1, [{ ...strike(3), status: "hearing" }], now).strikes).toBe(0);
    expect(standingOf(1, [{ ...strike(3), artistId: 2 }], now).strikes).toBe(0);
  });
});

import { isValidIban, maskIban, payoutDate } from "./booking";

describe("Auszahlung", () => {
  it("5 Werktage nach dem Termin, Wochenende zählt nicht", () => {
    expect(payoutDate("2026-09-25")).toBe("2026-10-02"); // Freitag -> Freitag
    expect(payoutDate("2026-09-26")).toBe("2026-10-02"); // Samstag -> Freitag
    expect(payoutDate("2026-09-28")).toBe("2026-10-05"); // Montag -> Montag
  });
  it("prüft die IBAN", () => {
    expect(isValidIban("DE89 3704 0044 0532 0130 00")).toBe(true);
    expect(isValidIban("DE89 3704 0044 0532 0130 01")).toBe(false);
    expect(isValidIban("DE89 3704 0044 0532 0130")).toBe(false);
    expect(isValidIban("AT61 1904 3002 3457 3201")).toBe(true);
    expect(maskIban("DE89370400440532013000")).toBe("DE89 •••• •••• •••• 3000");
  });
});
