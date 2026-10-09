/* Beispiel-PDFs je Belegart: BELEGE_BEISPIEL_DIR=<ordner> npx vitest run scripts/belege */
import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { belegPdf } from "@/lib/belegPdf";
import {
  PLATTFORM_PLATZHALTER, anteilAnbieter, belegFuerKauf, korrekturEntwurf, korrekturNachAuszahlung,
  stornoEntwurf, stornogebuehrEntwurf, verrechne, wochenabrechnung, type Anbieter, type Kunde, type Position,
} from "@/showly/belege";

const DIR = process.env["BELEGE_BEISPIEL_DIR"];
const kunde: Kunde = { id: "k", name: "Erika Mustermann", strasse: "Lindenweg 4", plz: "80331", ort: "München" };
const firma: Kunde = { ...kunde, firma: "Event & Co. GmbH", ust_id: "DE811111111" };
const a = (typ: Anbieter["typ"], name: string, firmaName?: string): Anbieter => ({
  id: "a", typ, name, firma: firmaName ?? null, strasse: "Bahnhofstr. 3", plz: "70173", ort: "Stuttgart",
  steuernummer: typ === "privat" ? null : "99/123/45678", ust_id: typ === "gewerblich" ? "DE123456789" : null, rechnung_praefix: "V1042",
});
const p = (b: string, cent: number, satz: number, menge = 1, von = "2026-10-17", bis = von): Position =>
  ({ beschreibung: b, menge, einzel_brutto_cent: Math.round(cent / menge), brutto_cent: cent, steuersatz: satz, leistung_von: von, leistung_bis: bis });

describe.skipIf(!DIR)("Beispiel-PDFs", () => {
  it("schreibt alle Belegarten", async () => {
    mkdirSync(DIR!, { recursive: true });
    const out = async (name: string, b: Parameters<typeof belegPdf>[0]) => {
      const bytes = await belegPdf(b);
      writeFileSync(`${DIR}/${name}.pdf`, bytes);
      expect(bytes.length).toBeGreaterThan(1000);
    };
    const d = "2026-10-09";
    const r = belegFuerKauf({ anbieter: a("gewerblich", "Max Zauber", "Zauberei Max Zauber GmbH"), kunde: firma, leistung: "baker",
      positionen: [p("Motivtorte Einhorn, 3 Etagen, für 30 Personen", 18900, 7), p("Lieferung zum Veranstaltungsort", 2500, 19), p("Candy Bar Basic", 9900, 7)], quelle: "x", order_id: 1042, buchung_id: 7, datum: d });
    await out("1-rechnung-gewerblich", { ...r, nummer: "V1042-2026-0001" });
    const k = belegFuerKauf({ anbieter: a("kleinunternehmer", "Lena Lustig"), kunde, leistung: "artist",
      positionen: [p("Clown Lena Lustig · Kindergeburtstag 17.10.2026, 15:00 Uhr · 2 Std.", 18000, 19, 2)], quelle: "x", order_id: 1043, buchung_id: 8, datum: d });
    await out("2-rechnung-kleinunternehmer", { ...k, nummer: "V1077-2026-0003" });
    const q = belegFuerKauf({ anbieter: a("privat", "Sabine Backfreude"), kunde, leistung: "baker",
      positionen: [p("20 Cupcakes Vanille", 4800, 7)], quelle: "x", order_id: 1044, buchung_id: 9, datum: d });
    await out("3-quittung-privat", { ...q, nummer: "Q-2026-000042" });
    const klein = belegFuerKauf({ anbieter: a("gewerblich", "Deko Ella", "Deko Ella e. K."), kunde, leistung: "deco",
      positionen: [p("Ballonbogen Rosé (Miete)", 8900, 19, 1, "2026-10-16", "2026-10-18")], quelle: "x", order_id: 1045, buchung_id: 10, datum: d });
    await out("4-kleinbetragsrechnung-miete", { ...klein, nummer: "V1050-2026-0012" });
    const orig = { ...r, id: 1, nummer: "V1042-2026-0001" };
    await out("5-storno", { ...stornoEntwurf(orig, "s", "2026-10-12", "Kunde hat storniert"), nummer: "V1042-2026-0002" });
    await out("6-korrektur-teilerstattung", { ...korrekturEntwurf(orig, 5000, "k", "2026-10-12", "Reklamation: Farbe abweichend"), nummer: "V1042-2026-0003" });
    await out("7-stornogebuehr", { ...stornogebuehrEntwurf(orig, 4000, "g", "2026-10-12"), nummer: "V1042-2026-0004" });
    /* Wochenabrechnung: Rechenbeispiel (15 %) plus Strafe und Rückforderung bei 20 % */
    const an = { ...a("gewerblich", "Max Zauber", "Zauberei Max Zauber GmbH"), id: "a" };
    const kor = korrekturNachAuszahlung(5000, 1500);
    const posten = [30000, 15000, 8000].map((u, i) => ({ payout_id: i + 1, buchung: `V1042-2026-00${10 + i}`, eventdatum: `2026-10-0${3 + i}`, umsatz_cent: u, provision_bp: 1500, gebuehr_cent: 0, einbehalt_cent: 0, ueberwiesen_cent: anteilAnbieter(u, 1500).auszahlung_cent }));
    const v = verrechne([{ id: 1, offen_cent: 5000 }, { id: 2, offen_cent: kor.rueckforderung_cent }], posten[2]!.ueberwiesen_cent);
    posten[2]!.ueberwiesen_cent = v.rest;
    const w = wochenabrechnung({ anbieter: an, plattform: PLATTFORM_PLATZHALTER, von: "2026-10-05", bis: "2026-10-11", posten, einbehaltFrei: [],
      verrechnungen: [{ id: 1, art: "strafgebuehr", grund: "Absage unter 14 Tagen (Buchung V1042-2026-0007)", betrag_cent: 5000 }, { id: 2, art: "rueckforderung", grund: "Erstattung Buchung V1042-2026-0004", betrag_cent: kor.rueckforderung_cent }],
      korrekturen: [{ id: 2, buchung: "V1042-2026-0004", umsatz_cent: kor.umsatz_cent, provision_netto_cent: kor.provision_netto_cent }], offen_cent: 0 })!;
    await out("8-provisionsrechnung", { ...w.provisionsrechnung!, nummer: "PR-2026-000001" });
    await out("9-auszahlungsabrechnung", { ...w.abrechnung, nummer: "AB-2026-000001" });
    const rb = wochenabrechnung({ anbieter: an, plattform: PLATTFORM_PLATZHALTER, von: "2026-10-05", bis: "2026-10-11",
      posten: [30000, 15000, 8000].map((u, i) => ({ payout_id: i + 1, buchung: `B-${i + 1}`, eventdatum: "2026-10-03", umsatz_cent: u, provision_bp: 1500, gebuehr_cent: 0, einbehalt_cent: 0, ueberwiesen_cent: anteilAnbieter(u, 1500).auszahlung_cent })),
      einbehaltFrei: [], verrechnungen: [], korrekturen: [], offen_cent: 0 })!;
    await out("10-rechenbeispiel-provisionsrechnung", { ...rb.provisionsrechnung!, nummer: "PR-2026-000002" });
    await out("11-rechenbeispiel-auszahlungsabrechnung", { ...rb.abrechnung, nummer: "AB-2026-000002" });
  });
});
