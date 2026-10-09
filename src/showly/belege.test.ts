import { describe, expect, it } from "vitest";
import {
  PLATTFORM_PLATZHALTER,
  anteilAnbieter,
  auszahlbar,
  belegFuerKauf,
  korrekturEntwurf,
  korrekturGruppen,
  korrekturNachAuszahlung,
  schwellen,
  steuerGruppen,
  stornoEntwurf,
  stornogebuehrEntwurf,
  verrechne,
  wochenabrechnung,
  type Anbieter,
  type BelegEntwurf,
  type Kunde,
  type Original,
  type Position,
  type WochenEingabe,
} from "./belege";

const anbieter = (typ: Anbieter["typ"], extra: Partial<Anbieter> = {}): Anbieter => ({
  id: "a1",
  typ,
  name: "Max Muster",
  firma: typ === "gewerblich" ? "Zauberei Muster GmbH" : null,
  strasse: "Hauptstr. 1",
  plz: "10115",
  ort: "Berlin",
  steuernummer: typ === "privat" ? null : "27/123/45678",
  ust_id: typ === "gewerblich" ? "DE123456789" : null,
  rechnung_praefix: "V1042",
  ...extra,
});
const privatKunde: Kunde = { id: "k1", name: "Erika Kundin", strasse: "Weg 2", plz: "80331", ort: "München" };
const firmenKunde: Kunde = { ...privatKunde, firma: "Event AG", ust_id: "DE999999999" };
const pos = (brutto: number, satz: number, menge = 1, d = "2026-10-10"): Position => ({
  beschreibung: "Leistung",
  menge,
  einzel_brutto_cent: Math.round(brutto / menge),
  brutto_cent: brutto,
  steuersatz: satz,
  leistung_von: d,
  leistung_bis: d,
});
const kauf = (a: Anbieter, k: Kunde, p: Position[], leistung: "artist" | "baker" | "deco" = "artist") =>
  belegFuerKauf({ anbieter: a, kunde: k, leistung, positionen: p, quelle: "kauf:1", order_id: 1, buchung_id: 1, datum: "2026-10-09" });
const alsOriginal = (b: BelegEntwurf, id = 7, nummer = "V1042-2026-0001"): Original => ({ ...b, id, nummer });

describe("Belegart je Anbieter-Typ", () => {
  it("gewerblich: Rechnung im Namen des Anbieters mit USt", () => {
    const b = kauf(anbieter("gewerblich"), privatKunde, [pos(119000, 19)]);
    expect(b.art).toBe("rechnung");
    expect(b.aussteller_typ).toBe("anbieter");
    expect(b.im_namen_von_anbieter).toBe(true);
    expect(b.kreis).toBe("R:a1");
    expect(b.praefix).toBe("V1042");
    expect(b.stellen).toBe(4);
    expect(b).toMatchObject({ netto_cent: 100000, steuer_cent: 19000, brutto_cent: 119000 });
    expect(b.aussteller_snapshot).toMatchObject({ firma: "Zauberei Muster GmbH", ust_id: "DE123456789", steuernummer: "27/123/45678" });
    expect(b.pflichthinweise[0]).toBe("Rechnung erstellt durch Showly im Namen und für Rechnung von Zauberei Muster GmbH.");
    expect(b.kleinbetrag).toBe(false);
  });
  it("kleinunternehmer: Rechnung ohne USt, § 19 Hinweis, Satz immer 0", () => {
    const b = kauf(anbieter("kleinunternehmer", { steuernummer: null }), privatKunde, [pos(30000, 19), pos(5000, 7)]);
    expect(b.art).toBe("rechnung");
    expect(b.steuer_cent).toBe(0);
    expect(b.netto_cent).toBe(35000);
    expect(b.positionen.every((p) => p.steuersatz === 0)).toBe(true);
    expect(b.pflichthinweise).toContain("Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.");
    expect(b.pflichthinweise[0]).toContain("im Namen und für Rechnung von Max Muster");
    expect(b.aussteller_snapshot.steuernummer).toBeNull(); // nur drucken, wenn vorhanden
  });
  it("privat: Buchungsquittung von Showly, Kreis Q, Torte „Privat gebacken“", () => {
    const b = kauf(anbieter("privat"), privatKunde, [pos(4500, 7)], "baker");
    expect(b.art).toBe("quittung");
    expect(b.aussteller_typ).toBe("plattform");
    expect(b).toMatchObject({ kreis: "Q", praefix: "Q", stellen: 6, steuer_cent: 0 });
    expect(b.pflichthinweise[0]).toBe("Zahlungsbestätigung. Privater Anbieter – keine Rechnung im Sinne des Umsatzsteuergesetzes.");
    expect(b.pflichthinweise).toContain("Privat gebacken.");
    expect(b.kleinbetrag).toBe(false);
  });
});

describe("Beträge und Steuer", () => {
  it("gemischte Sätze 19 % und 7 % je Gruppe", () => {
    const b = kauf(anbieter("gewerblich"), privatKunde, [pos(11900, 19), pos(10700, 7), pos(5950, 19)]);
    expect(b.steuer_aufstellung).toEqual([
      { satz: 19, netto_cent: 15000, steuer_cent: 2850, brutto_cent: 17850 },
      { satz: 7, netto_cent: 10000, steuer_cent: 700, brutto_cent: 10700 },
    ]);
    expect(b).toMatchObject({ netto_cent: 25000, steuer_cent: 3550, brutto_cent: 28550 });
  });
  it("Rundung: netto = round(brutto * 100 / (100 + satz)) auf die Gruppensumme", () => {
    /* 3 × 9,99 € à 19 %: 2997 / 1,19 = 2518,49… -> 2518 netto, 479 Steuer */
    expect(steuerGruppen([pos(999, 19), pos(999, 19), pos(999, 19)])).toEqual([{ satz: 19, netto_cent: 2518, steuer_cent: 479, brutto_cent: 2997 }]);
    /* 1 Cent: 1/1,07 = 0,93 -> 1 netto, 0 Steuer */
    expect(steuerGruppen([pos(1, 7)])).toEqual([{ satz: 7, netto_cent: 1, steuer_cent: 0, brutto_cent: 1 }]);
    const g = steuerGruppen([pos(4999, 7)]);
    expect(g[0]!.netto_cent + g[0]!.steuer_cent).toBe(4999);
  });
  it("Kleinbetragsrechnung bis 250 € brutto", () => {
    expect(kauf(anbieter("gewerblich"), privatKunde, [pos(25000, 19)]).kleinbetrag).toBe(true);
    expect(kauf(anbieter("gewerblich"), privatKunde, [pos(25001, 19)]).kleinbetrag).toBe(false);
    expect(kauf(anbieter("gewerblich"), privatKunde, [pos(9900, 19)]).pflichthinweise).toContain("Kleinbetragsrechnung (§ 33 UStDV).");
  });
  it("Firmenkunde bei gewerblichem Anbieter: E-Rechnung erforderlich", () => {
    const b = kauf(anbieter("gewerblich"), firmenKunde, [pos(50000, 19)]);
    expect(b.e_rechnung_erforderlich).toBe(true);
    expect(b.empfaenger_snapshot).toMatchObject({ firma: "Event AG", ust_id: "DE999999999" });
    expect(kauf(anbieter("kleinunternehmer"), firmenKunde, [pos(50000, 19)]).e_rechnung_erforderlich).toBe(false);
    expect(kauf(anbieter("gewerblich"), privatKunde, [pos(50000, 19)]).e_rechnung_erforderlich).toBe(false);
  });
  it("Leistungszeitraum von–bis aus den Positionen (Miete)", () => {
    const b = kauf(anbieter("gewerblich"), privatKunde, [{ ...pos(6000, 19), leistung_von: "2026-10-10", leistung_bis: "2026-10-12" }], "deco");
    expect([b.leistung_von, b.leistung_bis]).toEqual(["2026-10-10", "2026-10-12"]);
  });
});

describe("Storno und Erstattung", () => {
  const orig = alsOriginal(kauf(anbieter("gewerblich"), privatKunde, [pos(11900, 19), pos(10700, 7)]));
  it("Vollstorno: alles negativ, gleicher Nummernkreis, Verweis auf die Rechnung", () => {
    const s = stornoEntwurf(orig, "storno:7", "2026-10-12", "Kunde hat storniert");
    expect(s.art).toBe("storno");
    expect([s.kreis, s.praefix, s.stellen]).toEqual([orig.kreis, orig.praefix, orig.stellen]);
    expect(s).toMatchObject({ netto_cent: -20000, steuer_cent: -2600, brutto_cent: -22600, bezug_beleg_id: 7 });
    expect(s.pflichthinweise[0]).toBe("Storno zu Rechnung Nr. V1042-2026-0001.");
    expect(s.positionen.every((p) => p.brutto_cent < 0)).toBe(true);
  });
  it("Storno einer Quittung", () => {
    const q = alsOriginal(kauf(anbieter("privat"), privatKunde, [pos(5000, 19)]), 8, "Q-2026-000012");
    const s = stornoEntwurf(q, "storno:8", "2026-10-12", "Absage");
    expect(s.kreis).toBe("Q");
    expect(s.pflichthinweise[0]).toBe("Storno zur Buchungsquittung Nr. Q-2026-000012.");
  });
  it("Teilstorno mit 19 % und 7 %: anteilig nach Brutto, Rest auf die letzte Gruppe", () => {
    /* 119 € (19 %) und 107 € (7 %), Erstattung 100 €:
       19 %: round(100 * 119/226) = 52,65 €; 7 %: Rest 47,35 € */
    const g = korrekturGruppen(orig.steuer_aufstellung, 10000);
    expect(g.map((x) => x.brutto_cent)).toEqual([-5265, -4735]);
    expect(g[0]).toEqual({ satz: 19, netto_cent: -4424, steuer_cent: -841, brutto_cent: -5265 });
    expect(g[1]).toEqual({ satz: 7, netto_cent: -4425, steuer_cent: -310, brutto_cent: -4735 });
    const k = korrekturEntwurf(orig, 10000, "korr:1", "2026-10-12", "Reklamation");
    expect(k.art).toBe("korrektur");
    expect(k.brutto_cent).toBe(-10000);
    expect(k.pflichthinweise[0]).toBe("Korrektur zu Rechnung Nr. V1042-2026-0001.");
  });
  it("Stornogebühr: neuer Beleg nur über die Gebühr, Satz wie die Leistung", () => {
    const f = stornogebuehrEntwurf(orig, 3000, "gebuehr:7", "2026-10-12");
    expect(f.art).toBe("rechnung");
    expect(f.positionen).toHaveLength(1);
    expect(f.steuer_aufstellung).toEqual([{ satz: 19, netto_cent: 2521, steuer_cent: 479, brutto_cent: 3000 }]);
    expect(f.kleinbetrag).toBe(true);
    expect(stornogebuehrEntwurf(orig, 3000, "g", "2026-10-12", 0).steuer_cent).toBe(0);
  });
  it("Erstattung nach Auszahlung: Rückforderung und Provisionsgutschrift", () => {
    /* 100 € erstattet, 20 %: Gutschrift 20 € + 3,80 € USt, Rückforderung 76,20 € */
    expect(korrekturNachAuszahlung(10000, 2000)).toEqual({ umsatz_cent: -10000, provision_netto_cent: -2000, provision_ust_cent: -380, rueckforderung_cent: 7620 });
  });
});

describe("Provision und Wochenabrechnung", () => {
  const a = anbieter("gewerblich");
  const woche = (posten: WochenEingabe["posten"], extra: Partial<WochenEingabe> = {}): WochenEingabe => ({
    anbieter: a,
    plattform: PLATTFORM_PLATZHALTER,
    von: "2026-10-05",
    bis: "2026-10-11",
    posten,
    einbehaltFrei: [],
    verrechnungen: [],
    korrekturen: [],
    offen_cent: 0,
    ...extra,
  });
  const posten = (id: number, umsatz: number, bp = 1500, ueberwiesen?: number) => ({
    payout_id: id,
    buchung: `B-${id}`,
    eventdatum: "2026-10-03",
    umsatz_cent: umsatz,
    provision_bp: bp,
    gebuehr_cent: 0,
    einbehalt_cent: 0,
    ueberwiesen_cent: ueberwiesen ?? anteilAnbieter(umsatz, bp).auszahlung_cent,
  });

  it("Rechenbeispiel: 300 + 150 + 80 € bei 15 % -> Auszahlung 435,39 €", () => {
    const r = wochenabrechnung(woche([posten(1, 30000), posten(2, 15000), posten(3, 8000)]))!;
    expect(r.summen).toMatchObject({
      umsatz_brutto_cent: 53000,
      provision_netto_cent: 7950,
      provision_steuer_cent: 1511,
      provision_brutto_cent: 9461,
      auszahlung_cent: 43539,
      rundung_cent: 0,
      status: "ausgezahlt",
    });
    expect(r.provisionsrechnung!.positionen).toHaveLength(3);
    expect(r.provisionsrechnung!).toMatchObject({ kreis: "PR", netto_cent: 7950, steuer_cent: 1511, brutto_cent: 9461 });
    /* Die Zeilen der Abrechnung ergeben genau den überwiesenen Betrag */
    expect(r.abrechnung.positionen.reduce((n, p) => n + p.brutto_cent, 0)).toBe(43539);
  });
  it("Standard 20 %", () => {
    expect(anteilAnbieter(10000, 2000)).toEqual({ provision_netto_cent: 2000, provision_ust_cent: 380, auszahlung_cent: 7620 });
  });
  it("ohne Buchungen, Abzüge und Vortrag: nichts erstellen", () => {
    expect(wochenabrechnung(woche([]))).toBeNull();
  });
  it("Buchung mit offener Beschwerde bzw. vor Fälligkeit wird nicht ausgezahlt", () => {
    const basis = { bezahlt: true, faellig: "2026-10-10", heute: "2026-10-12", offeneBeschwerde: false, gesperrt: false };
    expect(auszahlbar(basis)).toBe(true);
    expect(auszahlbar({ ...basis, offeneBeschwerde: true })).toBe(false);
    expect(auszahlbar({ ...basis, gesperrt: true })).toBe(false);
    expect(auszahlbar({ ...basis, heute: "2026-10-09" })).toBe(false);
    expect(auszahlbar({ ...basis, bezahlt: false })).toBe(false);
    expect(auszahlbar({ ...basis, schonAusgezahlt: true })).toBe(false);
  });
  it("Strafgebühr größer als Umsatz: negativer Vortrag, in der Folgewoche verrechnet", () => {
    /* Woche 1: 100 € Umsatz (85 € für den Anbieter bei 15 %… hier 20 %: 76,20 €), Strafe 150 € */
    const anteil1 = anteilAnbieter(10000, 2000).auszahlung_cent; // 7620
    const v1 = verrechne([{ id: 1, offen_cent: 15000 }], anteil1);
    expect(v1).toEqual({ verwendet: [{ id: 1, betrag_cent: 7620 }], rest: 0 });
    const w1 = wochenabrechnung(
      woche([posten(1, 10000, 2000, v1.rest)], {
        verrechnungen: [{ id: 11, art: "strafgebuehr", grund: "Absage unter 14 Tagen", betrag_cent: 7620 }],
        offen_cent: 15000 - 7620,
      }),
    )!;
    expect(w1.summen).toMatchObject({ auszahlung_cent: 0, vortrag_cent: -7380, status: "vortrag" });
    expect(w1.abrechnung.positionen.some((p) => p.beschreibung.startsWith("Vertragsstrafe (ohne USt)"))).toBe(true);
    /* Woche 2: 200 € Umsatz -> 152,40 €, davon 73,80 € Rest der Strafe */
    const anteil2 = anteilAnbieter(20000, 2000).auszahlung_cent; // 15240
    const v2 = verrechne([{ id: 1, offen_cent: 7380 }], anteil2);
    expect(v2).toEqual({ verwendet: [{ id: 1, betrag_cent: 7380 }], rest: 7860 });
    const w2 = wochenabrechnung(
      woche([posten(2, 20000, 2000, v2.rest)], { bis: "2026-10-18", verrechnungen: [{ id: 12, art: "strafgebuehr", grund: "Rest", betrag_cent: 7380 }] }),
    )!;
    expect(w2.summen).toMatchObject({ auszahlung_cent: 7860, vortrag_cent: 0, status: "ausgezahlt" });
    expect(w2.abrechnung.positionen.reduce((n, p) => n + p.brutto_cent, 0)).toBe(7860);
  });
  it("Erstattung nach Auszahlung: Minuszeile in der Provisionsrechnung, Rückforderung verrechnet", () => {
    const k = korrekturNachAuszahlung(10000, 2000);
    const anteil = anteilAnbieter(30000, 2000).auszahlung_cent; // 22860
    const v = verrechne([{ id: 5, offen_cent: k.rueckforderung_cent }], anteil);
    const r = wochenabrechnung(
      woche([posten(1, 30000, 2000, v.rest)], {
        korrekturen: [{ id: 5, buchung: "B-0", umsatz_cent: k.umsatz_cent, provision_netto_cent: k.provision_netto_cent }],
        verrechnungen: [{ id: 21, art: "rueckforderung", grund: "Erstattung B-0", betrag_cent: k.rueckforderung_cent }],
      }),
    )!;
    const pr = r.provisionsrechnung!;
    expect(pr.positionen.map((p) => p.brutto_cent)).toEqual([6000, -2000]);
    expect(pr).toMatchObject({ netto_cent: 4000, steuer_cent: 760, brutto_cent: 4760 });
    expect(r.summen.auszahlung_cent).toBe(22860 - 7620);
    expect(r.abrechnung.positionen.reduce((n, p) => n + p.brutto_cent, 0)).toBe(22860 - 7620);
  });
  it("Rundungsausgleich, wenn USt je Auftrag und auf die Summe abweichen", () => {
    /* 3 × 0,25 € Provision netto: je 0,05 € USt (0,0475) = 0,15 €; Summe 0,75 € -> 0,14 € */
    const r = wochenabrechnung(woche([posten(1, 125, 2000), posten(2, 125, 2000), posten(3, 125, 2000)]))!;
    expect(r.summen.provision_steuer_cent).toBe(14);
    expect(r.summen.rundung_cent).toBe(1);
  });
});

describe("Schwellen", () => {
  it("privat: mehr als 5 Buchungen oder 600 € im Jahr", () => {
    expect(schwellen({ typ: "privat", buchungen_jahr: 5, umsatz_jahr_cent: 59999 }).hinweisGewerbe).toBe(false);
    expect(schwellen({ typ: "privat", buchungen_jahr: 6, umsatz_jahr_cent: 100 }).hinweisGewerbe).toBe(true);
    expect(schwellen({ typ: "privat", buchungen_jahr: 1, umsatz_jahr_cent: 60000 }).hinweisGewerbe).toBe(true);
  });
  it("kleinunternehmer: Warnung ab 22.000 €", () => {
    expect(schwellen({ typ: "kleinunternehmer", buchungen_jahr: 0, umsatz_jahr_cent: 2_199_999 }).warnungUmsatz).toBe(false);
    expect(schwellen({ typ: "kleinunternehmer", buchungen_jahr: 0, umsatz_jahr_cent: 2_200_000 }).warnungUmsatz).toBe(true);
  });
});

describe("Steuer- und DAC7-Daten", () => {
  it("Steuer-ID mit Prüfziffer", async () => {
    const { steuerIdGueltig } = await import("./belege");
    expect(steuerIdGueltig("86095742719")).toBe(true); // Beispiel des BZSt
    expect(steuerIdGueltig("86095742718")).toBe(false);
    expect(steuerIdGueltig("123")).toBe(false);
  });
  it("ohne vollständige Daten keine Auszahlung", async () => {
    const { steuerdatenFehlen } = await import("./belege");
    expect(steuerdatenFehlen({ typ: "privat", name: "A" })).toEqual(["Anschrift", "IBAN", "Geburtsdatum", "steuerliche Identifikationsnummer"]);
    expect(
      steuerdatenFehlen({ typ: "gewerblich", name: "A", strasse: "S", plz: "1", ort: "O", iban: "DE89370400440532013000", ust_id: "DE123456789" }),
    ).toEqual([]);
  });
});
