import { describe, expect, it } from "vitest";
import { cleanVenue, dayOpen, matchVenue, slotsFor, suggestVenues, venueQuote, weekdayOf } from "./locations";
import { VENUES } from "./venues";

const base = (over: Record<string, unknown> = {}) =>
  cleanVenue(
    {
      kind: "saal",
      name: "Saal",
      city: "Berlin",
      seated: 50,
      standing: 80,
      mode: "hour",
      price: 100,
      minHours: 3,
      week: Array.from({ length: 7 }, () => ({ from: "10:00", to: "22:00" })),
      bufferMin: 60,
      leadDays: 2,
      ...over,
    },
    1,
  );

describe("venueQuote", () => {
  it("rechnet Stunden mit Mindestdauer", () => {
    const q = venueQuote(base(), { dateISO: "2026-11-04", start: "14:00", hours: 2, guests: 20 });
    expect(q.hours).toBe(3);
    expect(q.total).toBe(300);
    expect(q.fee).toBe(60);
    expect(q.payout).toBe(240);
    expect(q.ok).toBe(true);
  });

  it("Pauschale: Halbtag bis 5 Std., sonst Ganztag", () => {
    const v = base({ mode: "flat", price: 500, priceFull: 900, minHours: 1 });
    expect(venueQuote(v, { dateISO: "2026-11-04", start: "10:00", hours: 5, guests: 10 }).total).toBe(500);
    expect(venueQuote(v, { dateISO: "2026-11-04", start: "10:00", hours: 6, guests: 10 }).total).toBe(900);
  });

  it("je Gast mit Mindestzahl, zu viele Gäste ist ein Fehler", () => {
    const v = base({ mode: "person", price: 20, minGuests: 10 });
    expect(venueQuote(v, { dateISO: "2026-11-04", start: "10:00", hours: 3, guests: 4 }).total).toBe(200);
    const big = venueQuote(v, { dateISO: "2026-11-04", start: "10:00", hours: 3, guests: 500 });
    expect(big.ok).toBe(false);
    expect(big.error).toBe("guests");
  });

  it("Paket je Kind mit Extras und Wochenendzuschlag", () => {
    const v = base({
      packages: [{ id: "p", name: "Party", includes: ["Eintritt"], price: 20, per: "person", minGuests: 8, maxGuests: 20, hours: 3 }],
      extras: [
        { id: "torte", name: "Torte", price: 30, per: "event" },
        { id: "eltern", name: "Kaffee", price: 5, per: "person" },
      ],
      surcharges: { weekend: 10, seasons: [] },
    });
    /* Samstag: 10 Kinder × 20 € = 200 € + 10 % = 220 € */
    const q = venueQuote(v, { dateISO: "2026-11-07", start: "14:00", hours: 1, guests: 10, pkg: "p", extras: ["torte", "eltern"] });
    expect(q.hours).toBe(3);
    expect(q.base).toBe(220);
    expect(q.extrasTotal).toBe(80);
    expect(q.total).toBe(300);
  });

  it("unbekanntes Paket wird nicht berechnet", () => {
    expect(venueQuote(base(), { dateISO: "2026-11-04", start: "10:00", hours: 3, guests: 5, pkg: "x" }).ok).toBe(false);
  });
});

describe("Kalender", () => {
  const today = "2026-11-01";
  it("Wochentag 0 = Montag", () => {
    expect(weekdayOf("2026-11-02")).toBe(0);
    expect(weekdayOf("2026-11-08")).toBe(6);
  });

  it("Vorlauf, Sperrtage und Ruhetage", () => {
    const v = base({ blocked: ["2026-11-10"], week: [null, ...Array.from({ length: 6 }, () => ({ from: "10:00", to: "22:00" }))] });
    expect(dayOpen(v, "2026-11-02", today)).toBe(false); // Montag zu
    expect(dayOpen(v, "2026-11-03", today)).toBe(true);
    expect(dayOpen(v, "2026-11-10", today)).toBe(false);
    expect(dayOpen(v, "2026-11-02", "2026-11-01")).toBe(false);
  });

  it("frei wählbare Zeiten: keine Überschneidung inkl. Puffer", () => {
    const s = slotsFor(base(), "2026-11-04", 3, [{ start: "14:00", hours: 3 }], today).map((x) => x.start);
    expect(s).toContain("10:00");
    expect(s).not.toContain("12:00"); // endet 15:00, überschneidet
    expect(s).not.toContain("17:30"); // Puffer bis 18:00
    expect(s).toContain("18:00");
    expect(s).not.toContain("19:30"); // endet nach 22:00
  });

  it("feste Zeitfenster mit mehreren Partytischen", () => {
    const v = base({ slots: ["10:00", "14:00"], parallel: 2, bufferMin: 0 });
    const taken = [
      { start: "14:00", hours: 3 },
      { start: "14:00", hours: 3 },
      { start: "10:00", hours: 3 },
    ];
    const s = slotsFor(v, "2026-11-04", 3, taken, today);
    expect(s).toEqual([{ start: "10:00", free: 1 }]);
  });

  it("Öffnung bis nach Mitternacht", () => {
    const v = base({ week: Array.from({ length: 7 }, () => ({ from: "18:00", to: "02:00" })), minHours: 1 });
    const s = slotsFor(v, "2026-11-04", 4, [], today).map((x) => x.start);
    expect(s).toContain("22:00");
    expect(s).not.toContain("22:30");
  });
});

describe("Suche", () => {
  it("findet über Art, Stadt, Gäste und Anlass", () => {
    const v = VENUES.find((x) => x.kind === "indoorspielplatz")!;
    expect(matchVenue(v, { q: "spielplatz" }, "2026-11-01")).toBe(true);
    expect(matchVenue(v, { occasion: "hochzeit" }, "2026-11-01")).toBe(false);
    expect(matchVenue(v, { city: "stuttgart", guests: 15 }, "2026-11-01")).toBe(true);
  });

  it("Vorschläge: Arten und Anlässe zuerst", () => {
    const s = suggestVenues(VENUES, "kinder", "de");
    expect(s[0]?.type).toBe("occasion");
    expect(s.some((x) => x.id === "indoorspielplatz")).toBe(true);
    expect(suggestVenues(VENUES, "wasser", "de")[0]?.id).toBe("wasserpark");
    expect(suggestVenues(VENUES, "hochzeit", "de").map((x) => x.id)).toContain("hochzeitssaal");
  });

  it("Adresse wird bereinigt und nie öffentlich übernommen", () => {
    const v = cleanVenue({ name: "X", address: "Musterweg 1", kind: "nope" }, 9);
    expect(v.kind).toBe("sonstiges");
    expect(v.address).toBe("Musterweg 1");
  });
});
