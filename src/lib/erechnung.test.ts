import { describe, expect, it } from "vitest";
import { belegFuerKauf, type Position } from "@/showly/belege";
import { pdfMitXml, xrechnungCii, zeilenNetto } from "./erechnung";
import { belegPdf } from "./belegPdf";

const p = (b: number, s: number): Position => ({ beschreibung: "Leistung <A&B>", menge: 1, einzel_brutto_cent: b, brutto_cent: b, steuersatz: s, leistung_von: "2026-10-17", leistung_bis: "2026-10-17" });
const beleg = belegFuerKauf({
  anbieter: { id: "a", typ: "gewerblich", name: "Max", firma: "Max GmbH", strasse: "Str. 1", plz: "70173", ort: "Stuttgart", ust_id: "DE123456789", steuernummer: "99/1/2", rechnung_praefix: "V1" },
  kunde: { id: "k", name: "Eva", firma: "Event AG", ust_id: "DE999999999", strasse: "Weg 2", plz: "80331", ort: "München" },
  leistung: "baker",
  positionen: [p(999, 19), p(999, 19), p(999, 19), p(10700, 7)],
  quelle: "x", order_id: 5, buchung_id: 1, datum: "2026-10-09",
});

describe("E-Rechnung (XRechnung CII)", () => {
  it("ist für Firmenkunden gewerblicher Anbieter vorgesehen", () => {
    expect(beleg.e_rechnung_erforderlich).toBe(true);
  });
  it("Zeilen-Netto summiert sich je Steuersatz genau auf die Gruppe", () => {
    const n = zeilenNetto(beleg);
    const g19 = beleg.steuer_aufstellung.find((g) => g.satz === 19)!;
    expect(n.slice(0, 3).reduce((a, b) => a + b, 0)).toBe(g19.netto_cent);
    expect(n[3]).toBe(beleg.steuer_aufstellung.find((g) => g.satz === 7)!.netto_cent);
  });
  it("enthält Pflichtfelder und stimmige Summen", () => {
    const x = xrechnungCii({ ...beleg, nummer: "V1-2026-0001" });
    expect(x).toContain("urn:xeinkauf.de:kosit:xrechnung_3.0");
    expect(x).toContain("<ram:ID>V1-2026-0001</ram:ID><ram:TypeCode>380</ram:TypeCode>");
    expect(x).toContain('<ram:ID schemeID="VA">DE123456789</ram:ID>');
    expect(x).toContain("<ram:GrandTotalAmount>136.97</ram:GrandTotalAmount>");
    expect(x).toContain("<ram:DuePayableAmount>0.00</ram:DuePayableAmount>");
    expect(x).toContain("Leistung &lt;A&amp;B&gt;");
    /* Tags sind ausgeglichen */
    const open = (x.match(/<(?!\/|\?)[^>]*[^/]>/g) || []).length;
    const close = (x.match(/<\//g) || []).length;
    expect(open).toBe(close);
  });
  it("wird als Anhang ins PDF eingebettet", async () => {
    const pdf = await belegPdf({ ...beleg, nummer: "V1-2026-0001" });
    const hybrid = await pdfMitXml(pdf, xrechnungCii({ ...beleg, nummer: "V1-2026-0001" }));
    expect(hybrid.length).toBeGreaterThan(pdf.length);
    expect(Buffer.from(hybrid).toString("latin1")).toContain("xrechnung.xml");
  });
});
