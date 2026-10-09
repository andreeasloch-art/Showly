/* PDF für jede Belegart im Showly-Design (pdf-lib, läuft im Worker und in
 * Node). Eine Vorlage für alle Belegarten; Titel, Spalten und Hinweise
 * kommen aus dem Beleg. Schrift Helvetica (WinAnsi: Umlaute, €, „“).
 * Die gleiche Gliederung hat die HTML-Ansicht (showly/belegHtml.ts). */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { BelegEntwurf, Partei } from "@/showly/belege";

const VIOLETT = rgb(0x6b / 255, 0x4f / 255, 0xd8 / 255);
const TINTE = rgb(0x1a / 255, 0x15 / 255, 0x30 / 255);
const GRAU = rgb(0x55 / 255, 0x4b / 255, 0x6b / 255);
const LINIE = rgb(0xe4 / 255, 0xdd / 255, 0xf5 / 255);
const FLAECHE = rgb(0xfb / 255, 0xf9 / 255, 0xff / 255);

export const TITEL: Record<string, string> = {
  rechnung: "Rechnung",
  quittung: "Buchungsquittung",
  storno: "Stornorechnung",
  korrektur: "Rechnungskorrektur",
  provisionsrechnung: "Provisionsrechnung",
  auszahlungsabrechnung: "Auszahlungsabrechnung",
  kaution: "Kautionsbestätigung",
};

export const euroText = (c: number) =>
  (c < 0 ? "-" : "") +
  (Math.abs(c) / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
  " €";
const datum = (d?: string | null) => (d ? d.split("-").reverse().join(".") : "");

/** Nur Zeichen, die Helvetica (WinAnsi) kann */
function sauber(font: PDFFont, s: string): string {
  let out = "";
  for (const ch of String(s ?? "")) {
    try {
      font.encodeText(ch);
      out += ch;
    } catch {
      out += ch === "→" ? "->" : ch === "≥" ? ">=" : "?";
    }
  }
  return out;
}

function umbrechen(font: PDFFont, text: string, size: number, breite: number): string[] {
  const zeilen: string[] = [];
  for (const absatz of sauber(font, text).split("\n")) {
    let z = "";
    for (const w of absatz.split(" ")) {
      const t = z ? `${z} ${w}` : w;
      if (font.widthOfTextAtSize(t, size) > breite && z) {
        zeilen.push(z);
        z = w;
      } else z = t;
    }
    zeilen.push(z);
  }
  return zeilen;
}

function adresse(p: Partei & Record<string, unknown>): string[] {
  return [
    p.firma && p.firma !== p.name ? String(p.firma) : null,
    p.name ? String(p.name) : null,
    p.strasse ? String(p.strasse) : null,
    [p.plz, p.ort].filter(Boolean).join(" ") || null,
    p.land && p.land !== "DE" ? String(p.land) : null,
  ].filter((x): x is string => !!x);
}

export async function belegPdf(b: BelegEntwurf & { nummer: string }): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${TITEL[b.art] ?? "Beleg"} ${b.nummer}`);
  doc.setAuthor("Showly");
  doc.setCreator("Showly Belegsystem");
  doc.setCreationDate(new Date(`${b.belegdatum}T12:00:00Z`));
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fett = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28;
  const H = 841.89;
  const L = 50;
  const R = W - 50;
  let page: PDFPage = doc.addPage([W, H]);
  let y = H - 50;

  const text = (s: string, x: number, yy: number, o: { size?: number; f?: PDFFont; c?: ReturnType<typeof rgb>; rechts?: boolean } = {}) => {
    const f = o.f ?? font;
    const size = o.size ?? 9.5;
    const t = sauber(f, s);
    const xx = o.rechts ? x - f.widthOfTextAtSize(t, size) : x;
    page.drawText(t, { x: xx, y: yy, size, font: f, color: o.c ?? TINTE });
  };
  const neueSeite = () => {
    fuss();
    page = doc.addPage([W, H]);
    y = H - 60;
  };
  const platz = (h: number) => {
    if (y - h < 110) neueSeite();
  };
  const plattform = b.aussteller_typ === "plattform" ? b.aussteller_snapshot : null;
  function fuss() {
    page.drawLine({ start: { x: L, y: 70 }, end: { x: R, y: 70 }, thickness: 0.6, color: LINIE });
    const p = plattform ?? {
      name: "Showly",
      email: "kontakt@showly.eu",
    };
    const z1 = `Showly · Vermittlung von Künstlern, Torten, Kostümen und Deko · ${p.email ?? "kontakt@showly.eu"}`;
    const z2 = plattform
      ? [plattform.firma ?? plattform.name, [plattform.strasse, [plattform.plz, plattform.ort].filter(Boolean).join(" ")].filter(Boolean).join(", "), plattform.handelsregister, plattform.ust_id ? `USt-IdNr. ${plattform.ust_id}` : null, plattform.steuernummer ? `St.-Nr. ${plattform.steuernummer}` : null]
          .filter(Boolean)
          .join(" · ")
      : "Erstellt von Showly im Auftrag des Ausstellers. Aufbewahrung 10 Jahre (GoBD).";
    text(z1, L, 56, { size: 7.5, c: GRAU });
    for (const [i, z] of umbrechen(font, String(z2), 7.5, R - L).entries()) text(z, L, 46 - i * 9, { size: 7.5, c: GRAU });
  }

  /* Kopf: Wortmarke und Titel */
  text("Showly", L, y - 6, { size: 22, f: fett, c: VIOLETT });
  text(TITEL[b.art] ?? "Beleg", R, y - 4, { size: 18, f: fett, rechts: true });
  y -= 22;
  text(`Nr. ${b.nummer}`, R, y - 4, { size: 10, f: fett, c: VIOLETT, rechts: true });
  y -= 30;

  /* Aussteller (Absenderzeile) und Empfänger */
  const a = b.aussteller_snapshot;
  const abs = [a.firma && a.firma !== a.name ? a.firma : a.name, a.strasse, [a.plz, a.ort].filter(Boolean).join(" ")].filter(Boolean).join(" · ");
  text(abs, L, y, { size: 7.5, c: GRAU });
  page.drawLine({ start: { x: L, y: y - 3 }, end: { x: L + 250, y: y - 3 }, thickness: 0.4, color: LINIE });
  let ye = y - 18;
  for (const z of adresse(b.empfaenger_snapshot)) {
    text(z, L, ye, { size: 10 });
    ye -= 13;
  }
  if (b.empfaenger_snapshot.ust_id) {
    text(`USt-IdNr. ${b.empfaenger_snapshot.ust_id}`, L, ye, { size: 8.5, c: GRAU });
    ye -= 12;
  }

  /* Rechte Spalte: Daten des Belegs */
  const info: [string, string][] = [
    ["Datum", datum(b.belegdatum)],
    [b.art === "provisionsrechnung" || b.art === "auszahlungsabrechnung" ? "Zeitraum" : "Leistung", b.leistung_von === b.leistung_bis ? datum(b.leistung_von) : `${datum(b.leistung_von)} – ${datum(b.leistung_bis)}`],
    ...(b.aussteller_typ === "anbieter" && a.steuernummer ? ([["Steuernummer", String(a.steuernummer)]] as [string, string][]) : []),
    ...(b.aussteller_typ === "anbieter" && a.ust_id ? ([["USt-IdNr.", String(a.ust_id)]] as [string, string][]) : []),
    ...(b.order_id ? ([["Bestellung", `#${b.order_id}`]] as [string, string][]) : []),
  ];
  let yi = y - 18;
  for (const [k, v] of info) {
    text(k, R - 150, yi, { size: 8.5, c: GRAU });
    text(v, R, yi, { size: 9, rechts: true });
    yi -= 13;
  }
  if (b.aussteller_typ === "anbieter") {
    yi -= 4;
    text("Aussteller", R - 150, yi, { size: 8.5, c: GRAU });
    yi -= 12;
    for (const z of adresse(a)) {
      text(z, R, yi, { size: 8.5, rechts: true });
      yi -= 11;
    }
  }
  y = Math.min(ye, yi) - 18;

  /* Positionen */
  const netto = b.art === "provisionsrechnung";
  const spalten = { pos: L, besch: L + 22, menge: R - 175, einzel: R - 115, satz: R - 62, betrag: R };
  page.drawRectangle({ x: L - 4, y: y - 6, width: R - L + 8, height: 20, color: FLAECHE });
  text("Pos.", spalten.pos, y, { size: 8, f: fett, c: GRAU });
  text("Beschreibung", spalten.besch, y, { size: 8, f: fett, c: GRAU });
  text("Menge", spalten.menge, y, { size: 8, f: fett, c: GRAU, rechts: true });
  text(netto ? "Netto" : "Einzelpreis", spalten.einzel, y, { size: 8, f: fett, c: GRAU, rechts: true });
  if (b.art !== "auszahlungsabrechnung") text("USt", spalten.satz, y, { size: 8, f: fett, c: GRAU, rechts: true });
  text(netto ? "Betrag netto" : "Betrag", spalten.betrag, y, { size: 8, f: fett, c: GRAU, rechts: true });
  y -= 20;
  b.positionen.forEach((p, i) => {
    const zeilen = umbrechen(font, p.beschreibung + (p.leistung_von && p.leistung_bis && p.leistung_von !== p.leistung_bis ? ` (${datum(p.leistung_von)} – ${datum(p.leistung_bis)})` : ""), 9, spalten.menge - spalten.besch - 40);
    platz(zeilen.length * 12 + 8);
    text(String(i + 1), spalten.pos, y, { size: 9, c: GRAU });
    zeilen.forEach((z, k) => text(z, spalten.besch, y - k * 12, { size: 9 }));
    text(String(p.menge), spalten.menge, y, { size: 9, rechts: true });
    text(euroText(p.einzel_brutto_cent), spalten.einzel, y, { size: 9, rechts: true });
    if (b.art !== "auszahlungsabrechnung") text(`${p.steuersatz} %`, spalten.satz, y, { size: 9, rechts: true });
    text(euroText(p.brutto_cent), spalten.betrag, y, { size: 9, rechts: true });
    const unten = y - (zeilen.length - 1) * 12 - 5;
    page.drawLine({ start: { x: L, y: unten }, end: { x: R, y: unten }, thickness: 0.3, color: LINIE });
    y = unten - 13;
  });

  /* Summen */
  y -= 8;
  platz(110);
  const summe = (k: string, v: number, stark = false) => {
    text(k, R - 120, y, { size: stark ? 10.5 : 9, f: stark ? fett : font, rechts: true, c: stark ? TINTE : GRAU });
    text(euroText(v), R, y, { size: stark ? 10.5 : 9, f: stark ? fett : font, rechts: true });
    y -= stark ? 18 : 13;
  };
  if (b.art === "auszahlungsabrechnung") {
    summe("Auszahlungsbetrag", b.brutto_cent, true);
  } else if (b.art === "quittung" || (b.steuer_cent === 0 && b.steuer_aufstellung.every((g) => g.satz === 0))) {
    summe(b.art === "quittung" ? "Bezahlt" : "Gesamtbetrag", b.brutto_cent, true);
  } else {
    summe("Summe netto", b.netto_cent);
    for (const g of b.steuer_aufstellung) summe(`zzgl. ${g.satz} % USt auf ${euroText(g.netto_cent)}`, g.steuer_cent);
    summe("Summe brutto", b.brutto_cent, true);
  }

  /* Hinweise */
  y -= 6;
  for (const h of b.pflichthinweise) {
    const zeilen = umbrechen(font, h, 8.5, R - L);
    platz(zeilen.length * 11 + 4);
    for (const z of zeilen) {
      text(z, L, y, { size: 8.5, c: GRAU });
      y -= 11;
    }
    y -= 3;
  }
  if (b.art === "rechnung" || b.art === "quittung") {
    platz(14);
    text("Bereits bezahlt über Showly. Bitte nicht erneut überweisen.", L, y - 4, { size: 8.5, f: fett, c: VIOLETT });
  }
  fuss();
  return doc.save({ useObjectStreams: false });
}

/** SHA-256 als Hex (Web Crypto, Worker und Node) */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
