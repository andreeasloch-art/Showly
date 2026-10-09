/* Belege und Abrechnung: Rechenregeln ohne Datenbank (getestet in
 * belege.test.ts). Die Datenbank (Migration 0021, beleg_anlegen) vergibt
 * die Nummern und schreibt fest; lib/belege.server.ts holt die Daten,
 * erzeugt PDFs und verschickt sie.
 *
 * Grundregeln
 *  - Showly verkauft nichts selbst, sondern vermittelt. Kunden zahlen keine
 *    Gebühr an Showly.
 *  - gewerblich       -> Rechnung im Namen des Anbieters, 19 % oder 7 % je Position
 *  - kleinunternehmer -> Rechnung im Namen des Anbieters, ohne USt (§ 19 UStG)
 *  - privat           -> Buchungsquittung von Showly, keine Rechnung
 *  - Kautionen sind kein Umsatz und stehen nie auf einer Rechnung.
 *  - Alle Beträge in ganzen Cent. Anbieter geben Bruttopreise ein:
 *      netto = round(brutto_summe * 100 / (100 + satz)), steuer = brutto - netto
 *  - Provision: Standard 20 % (2000 Basispunkte) vom bezahlten Bruttobetrag
 *    abzüglich Erstattungen, zzgl. 19 % USt, für alle Anbieter-Typen. */

export type AnbieterTyp = "gewerblich" | "kleinunternehmer" | "privat";
export type BelegArt = "rechnung" | "quittung" | "storno" | "korrektur" | "provisionsrechnung" | "auszahlungsabrechnung" | "kaution";
export type Leistungsart = "artist" | "baker" | "deco";

export const PROVISION_BP_STANDARD = 2000;
export const PROVISION_UST = 19;
export const KLEINBETRAG_CENT = 25000;
/* Schwellen für Hinweise (konfigurierbar). Kleinunternehmer: seit 2025
   25.000 € Vorjahresumsatz (§ 19 Abs. 1 UStG); wir warnen ab WARN_KLEIN. */
export const PRIVAT_MAX_BUCHUNGEN = 5;
export const PRIVAT_MAX_CENT = 60000;
export const WARN_KLEIN_CENT = 2_200_000;
export const GRENZE_KLEIN_CENT = 2_500_000;

/** Kaufmännisch runden, auch bei negativen Beträgen symmetrisch */
export const rund = (x: number): number => Math.sign(x) * Math.round(Math.abs(x));

export interface Partei {
  name: string;
  firma?: string | null;
  strasse?: string | null;
  plz?: string | null;
  ort?: string | null;
  land?: string | null;
  steuernummer?: string | null;
  ust_id?: string | null;
  handelsregister?: string | null;
  email?: string | null;
}

export interface Position {
  beschreibung: string;
  menge: number;
  einzel_brutto_cent: number;
  brutto_cent: number;
  steuersatz: number;
  leistung_von?: string | null;
  leistung_bis?: string | null;
  referenz?: string | null;
}

export interface Steuergruppe {
  satz: number;
  netto_cent: number;
  steuer_cent: number;
  brutto_cent: number;
}

/** Entwurf für beleg_anlegen (Migration 0021); Nummer vergibt die Datenbank */
export interface BelegEntwurf {
  art: BelegArt;
  kreis: string;
  praefix: string;
  stellen: number;
  jahr: number;
  quelle: string;
  aussteller_typ: "anbieter" | "plattform";
  anbieter_id: string | null;
  im_namen_von_anbieter: boolean;
  kunde_id: string | null;
  order_id: number | null;
  buchung_id: number | null;
  bezug_beleg_id: number | null;
  belegdatum: string;
  leistung_von: string | null;
  leistung_bis: string | null;
  aussteller_snapshot: Partei & Record<string, unknown>;
  empfaenger_snapshot: Partei & Record<string, unknown>;
  netto_cent: number;
  steuer_cent: number;
  brutto_cent: number;
  steuer_aufstellung: Steuergruppe[];
  pflichthinweise: string[];
  kleinbetrag: boolean;
  e_rechnung_erforderlich: boolean;
  positionen: Position[];
}

/* ------------------------------------------------------------------ */
/* Steuer                                                              */
/* ------------------------------------------------------------------ */

/** Gruppen je Steuersatz aus Bruttopositionen */
export function steuerGruppen(pos: Pick<Position, "brutto_cent" | "steuersatz">[]): Steuergruppe[] {
  const sum = new Map<number, number>();
  for (const p of pos) sum.set(p.steuersatz, (sum.get(p.steuersatz) ?? 0) + p.brutto_cent);
  return [...sum.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([satz, brutto]) => {
      const netto = satz ? rund((brutto * 100) / (100 + satz)) : brutto;
      return { satz, netto_cent: netto, steuer_cent: brutto - netto, brutto_cent: brutto };
    });
}

function summen(gruppen: Steuergruppe[]) {
  return {
    netto_cent: gruppen.reduce((n, g) => n + g.netto_cent, 0),
    steuer_cent: gruppen.reduce((n, g) => n + g.steuer_cent, 0),
    brutto_cent: gruppen.reduce((n, g) => n + g.brutto_cent, 0),
  };
}

/** Bei Kleinunternehmern und Privatpersonen ist der Satz immer 0 */
export function satzFuer(typ: AnbieterTyp, satz: number | null | undefined): number {
  if (typ !== "gewerblich") return 0;
  return satz === 7 ? 7 : 19;
}

/* ------------------------------------------------------------------ */
/* Kauf: Rechnung bzw. Quittung                                        */
/* ------------------------------------------------------------------ */

export interface Anbieter extends Partei {
  id: string;
  typ: AnbieterTyp;
  rechnung_praefix?: string | null;
}

export interface Kunde extends Partei {
  id: string | null;
}

/** Firmenkunde: Firma angegeben */
export const istFirma = (k: Partei) => !!(k.firma && k.firma.trim());

export const anzeigeName = (p: Partei) => (p.firma && p.firma.trim() ? p.firma.trim() : p.name);

export function belegArtFuer(typ: AnbieterTyp): "rechnung" | "quittung" {
  return typ === "privat" ? "quittung" : "rechnung";
}

/** Nummernkreis: Rechnungen je Anbieter, Quittungen bei Showly */
export function kreisFuer(art: BelegArt, a: Pick<Anbieter, "id" | "rechnung_praefix"> | null): { kreis: string; praefix: string; stellen: number } {
  if (art === "provisionsrechnung") return { kreis: "PR", praefix: "PR", stellen: 6 };
  if (art === "auszahlungsabrechnung") return { kreis: "AB", praefix: "AB", stellen: 6 };
  if (art === "quittung" || art === "kaution" || !a) return { kreis: "Q", praefix: "Q", stellen: 6 };
  return { kreis: `R:${a.id}`, praefix: a.rechnung_praefix || "R", stellen: 4 };
}

/** Präfix für eigene Rechnungsnummern aus einer laufenden Zahl, z. B. V1042 */
export const praefixAus = (n: number) => `V${1000 + Math.max(0, Math.floor(n))}`;

export function hinweiseKauf(a: Anbieter, art: "rechnung" | "quittung", leistung: Leistungsart, kleinbetrag: boolean): string[] {
  const name = anzeigeName(a);
  if (art === "quittung") {
    return [
      "Zahlungsbestätigung. Privater Anbieter – keine Rechnung im Sinne des Umsatzsteuergesetzes.",
      ...(leistung === "baker" ? ["Privat gebacken."] : []),
      `Leistung erbracht von ${name}. Showly vermittelt die Buchung und hat die Zahlung entgegengenommen.`,
    ];
  }
  return [
    `Rechnung erstellt durch Showly im Namen und für Rechnung von ${name}.`,
    ...(a.typ === "kleinunternehmer" ? ["Gemäß § 19 UStG wird keine Umsatzsteuer berechnet."] : []),
    ...(kleinbetrag ? ["Kleinbetragsrechnung (§ 33 UStDV)."] : []),
  ];
}

export function belegFuerKauf(x: {
  anbieter: Anbieter;
  kunde: Kunde;
  leistung: Leistungsart;
  positionen: Position[];
  quelle: string;
  order_id: number | null;
  buchung_id: number | null;
  datum: string;
}): BelegEntwurf {
  const art = belegArtFuer(x.anbieter.typ);
  const positionen = x.positionen.map((p) => ({ ...p, steuersatz: satzFuer(x.anbieter.typ, p.steuersatz) }));
  const gruppen = steuerGruppen(positionen);
  const s = summen(gruppen);
  const kleinbetrag = art === "rechnung" && s.brutto_cent <= KLEINBETRAG_CENT;
  const daten = [...positionen.flatMap((p) => [p.leistung_von, p.leistung_bis])].filter((d): d is string => !!d).sort();
  const k = kreisFuer(art, x.anbieter);
  const aussteller: Partei & Record<string, unknown> =
    art === "rechnung"
      ? {
          name: x.anbieter.name,
          firma: x.anbieter.firma ?? null,
          strasse: x.anbieter.strasse ?? null,
          plz: x.anbieter.plz ?? null,
          ort: x.anbieter.ort ?? null,
          land: x.anbieter.land ?? "DE",
          /* Steuernummer bei Kleinunternehmern nur, wenn vorhanden */
          steuernummer: x.anbieter.steuernummer || null,
          ust_id: x.anbieter.typ === "gewerblich" ? x.anbieter.ust_id || null : null,
          typ: x.anbieter.typ,
        }
      : { ...PLATTFORM_PLATZHALTER, leistung_von_name: anzeigeName(x.anbieter), typ: "privat" };
  return {
    art,
    ...k,
    jahr: Number(x.datum.slice(0, 4)),
    quelle: x.quelle,
    aussteller_typ: art === "rechnung" ? "anbieter" : "plattform",
    anbieter_id: x.anbieter.id,
    im_namen_von_anbieter: art === "rechnung",
    kunde_id: x.kunde.id,
    order_id: x.order_id,
    buchung_id: x.buchung_id,
    bezug_beleg_id: null,
    belegdatum: x.datum,
    leistung_von: daten[0] ?? x.datum,
    leistung_bis: daten[daten.length - 1] ?? x.datum,
    aussteller_snapshot: aussteller,
    empfaenger_snapshot: {
      name: x.kunde.name,
      firma: x.kunde.firma || null,
      strasse: x.kunde.strasse ?? null,
      plz: x.kunde.plz ?? null,
      ort: x.kunde.ort ?? null,
      land: x.kunde.land ?? null,
      ust_id: x.kunde.ust_id || null,
      email: x.kunde.email ?? null,
    },
    ...s,
    steuer_aufstellung: gruppen,
    pflichthinweise: hinweiseKauf(x.anbieter, art, x.leistung, kleinbetrag),
    kleinbetrag,
    e_rechnung_erforderlich: art === "rechnung" && x.anbieter.typ === "gewerblich" && istFirma(x.kunde),
    positionen,
  };
}

/* Plattformdaten; echte Werte kommen aus der Konfiguration (lib/belege.server.ts).
   Bis dahin die Angaben aus dem Impressum, mit „Muster“ gekennzeichnet. */
export const PLATTFORM_PLATZHALTER: Partei & Record<string, unknown> = {
  name: "Showly GmbH (Muster)",
  firma: "Showly GmbH (Muster)",
  strasse: "Musterstraße 12",
  plz: "71522",
  ort: "Backnang",
  land: "DE",
  steuernummer: "00000/00000 (Muster)",
  ust_id: "DE000000000 (Muster)",
  handelsregister: "Amtsgericht Stuttgart, HRB 000000 (Muster)",
  email: "kontakt@showly.eu",
};

/* ------------------------------------------------------------------ */
/* Storno, Korrektur, Stornogebühr                                     */
/* ------------------------------------------------------------------ */

/** Was ein Original-Beleg für Storno und Korrektur braucht */
export type Original = Pick<
  BelegEntwurf,
  | "art"
  | "kreis"
  | "praefix"
  | "stellen"
  | "aussteller_typ"
  | "anbieter_id"
  | "im_namen_von_anbieter"
  | "kunde_id"
  | "order_id"
  | "buchung_id"
  | "leistung_von"
  | "leistung_bis"
  | "aussteller_snapshot"
  | "empfaenger_snapshot"
  | "steuer_aufstellung"
  | "pflichthinweise"
  | "e_rechnung_erforderlich"
  | "positionen"
> & { id: number; nummer: string; brutto_cent: number };

const istQuittung = (o: Pick<Original, "art">) => o.art === "quittung";

function aufOriginal(o: Original, quelle: string, datum: string): Omit<BelegEntwurf, "art" | "positionen" | "netto_cent" | "steuer_cent" | "brutto_cent" | "steuer_aufstellung" | "pflichthinweise" | "kleinbetrag"> {
  return {
    kreis: o.kreis,
    praefix: o.praefix,
    stellen: o.stellen,
    jahr: Number(datum.slice(0, 4)),
    quelle,
    aussteller_typ: o.aussteller_typ,
    anbieter_id: o.anbieter_id,
    im_namen_von_anbieter: o.im_namen_von_anbieter,
    kunde_id: o.kunde_id,
    order_id: o.order_id,
    buchung_id: o.buchung_id,
    bezug_beleg_id: o.id,
    belegdatum: datum,
    leistung_von: o.leistung_von,
    leistung_bis: o.leistung_bis,
    aussteller_snapshot: o.aussteller_snapshot,
    empfaenger_snapshot: o.empfaenger_snapshot,
    e_rechnung_erforderlich: o.e_rechnung_erforderlich,
  };
}

/** Weitergeltende Hinweise (Name des Anbieters, § 19 UStG, privat) */
const dauerHinweise = (o: Original) => o.pflichthinweise.filter((h) => !h.startsWith("Kleinbetragsrechnung"));

/** Vollstorno: alle Positionen negativ, gleicher Nummernkreis */
export function stornoEntwurf(o: Original, quelle: string, datum: string, grund: string): BelegEntwurf {
  const positionen = o.positionen.map((p) => ({ ...p, einzel_brutto_cent: -p.einzel_brutto_cent, brutto_cent: -p.brutto_cent }));
  const gruppen = o.steuer_aufstellung.map((g) => ({ satz: g.satz, netto_cent: -g.netto_cent, steuer_cent: -g.steuer_cent, brutto_cent: -g.brutto_cent }));
  return {
    art: "storno",
    ...aufOriginal(o, quelle, datum),
    ...summen(gruppen),
    steuer_aufstellung: gruppen,
    pflichthinweise: [
      istQuittung(o) ? `Storno zur Buchungsquittung Nr. ${o.nummer}.` : `Storno zu Rechnung Nr. ${o.nummer}.`,
      `Grund: ${grund}`,
      ...dauerHinweise(o),
    ],
    kleinbetrag: false,
    positionen,
  };
}

/** Teilerstattung über `betrag` (positiv): nach Bruttoanteil auf die
 *  Steuersätze verteilt, der Rundungsrest geht an die letzte Gruppe. */
export function korrekturGruppen(gruppen: Steuergruppe[], betrag: number): Steuergruppe[] {
  const total = gruppen.reduce((n, g) => n + g.brutto_cent, 0);
  if (total <= 0 || betrag <= 0) return [];
  const teile: number[] = [];
  let rest = Math.min(betrag, total);
  gruppen.forEach((g, i) => {
    const t = i === gruppen.length - 1 ? rest : rund((Math.min(betrag, total) * g.brutto_cent) / total);
    teile.push(t);
    rest -= t;
  });
  return gruppen.map((g, i) => {
    const brutto = -teile[i]!;
    const netto = g.satz ? rund((brutto * 100) / (100 + g.satz)) : brutto;
    return { satz: g.satz, netto_cent: netto, steuer_cent: brutto - netto, brutto_cent: brutto };
  });
}

export function korrekturEntwurf(o: Original, betrag: number, quelle: string, datum: string, grund: string): BelegEntwurf {
  const gruppen = korrekturGruppen(o.steuer_aufstellung, betrag);
  const positionen: Position[] = gruppen.map((g) => ({
    beschreibung: `Erstattung${gruppen.length > 1 ? ` (Anteil ${g.satz} % USt)` : ""}: ${grund}`,
    menge: 1,
    einzel_brutto_cent: g.brutto_cent,
    brutto_cent: g.brutto_cent,
    steuersatz: g.satz,
    leistung_von: o.leistung_von,
    leistung_bis: o.leistung_bis,
    referenz: null,
  }));
  return {
    art: "korrektur",
    ...aufOriginal(o, quelle, datum),
    ...summen(gruppen),
    steuer_aufstellung: gruppen,
    pflichthinweise: [
      istQuittung(o) ? `Korrektur zur Buchungsquittung Nr. ${o.nummer}.` : `Korrektur zu Rechnung Nr. ${o.nummer}.`,
      ...dauerHinweise(o),
    ],
    kleinbetrag: false,
    positionen,
  };
}

/** Neuer Beleg nur über die Stornogebühr (das Original wird vorher storniert).
 *  Steuersatz der Stornogebühr: Standard wie die ursprüngliche Leistung
 *  (höchster Satz im Original). Bitte vom Steuerberater bestätigen lassen,
 *  ob Stornogebühren als Entgelt (steuerbar) oder als Schadensersatz (nicht
 *  steuerbar) zu behandeln sind; dann hier `satz` anpassen. */
export function stornogebuehrEntwurf(o: Original, gebuehr: number, quelle: string, datum: string, satz?: number): BelegEntwurf {
  const s = satz ?? Math.max(0, ...o.steuer_aufstellung.map((g) => g.satz));
  const positionen: Position[] = [
    {
      beschreibung: `Stornogebühr zu ${istQuittung(o) ? "Buchungsquittung" : "Rechnung"} Nr. ${o.nummer}`,
      menge: 1,
      einzel_brutto_cent: gebuehr,
      brutto_cent: gebuehr,
      steuersatz: s,
      leistung_von: o.leistung_von,
      leistung_bis: o.leistung_bis,
      referenz: null,
    },
  ];
  const gruppen = steuerGruppen(positionen);
  const art = istQuittung(o) ? "quittung" : "rechnung";
  const kleinbetrag = art === "rechnung" && gebuehr <= KLEINBETRAG_CENT;
  return {
    art,
    ...aufOriginal(o, quelle, datum),
    ...summen(gruppen),
    steuer_aufstellung: gruppen,
    pflichthinweise: [...dauerHinweise(o), ...(kleinbetrag ? ["Kleinbetragsrechnung (§ 33 UStDV)."] : [])],
    kleinbetrag,
    positionen,
  };
}

/* ------------------------------------------------------------------ */
/* Provision und Auszahlung                                            */
/* ------------------------------------------------------------------ */

export const provisionNetto = (umsatz: number, bp: number) => rund((umsatz * bp) / 10000);
export const ustAuf = (netto: number) => rund((netto * PROVISION_UST) / 100);

/** Was bei einem Auftrag an den Anbieter geht (vor Einbehalt, Gebühren und
 *  Verrechnungen): Umsatz minus Provision brutto */
export function anteilAnbieter(umsatz: number, bp: number) {
  const netto = provisionNetto(umsatz, bp);
  const ust = ustAuf(netto);
  return { provision_netto_cent: netto, provision_ust_cent: ust, auszahlung_cent: umsatz - netto - ust };
}

/** Erstattung nach der Auszahlung: Anbieter zahlt die Erstattung zurück und
 *  bekommt die anteilige Provision (brutto) gutgeschrieben. */
export function korrekturNachAuszahlung(erstattung: number, bp: number) {
  const netto = provisionNetto(erstattung, bp);
  const ust = ustAuf(netto);
  return { umsatz_cent: -erstattung, provision_netto_cent: -netto, provision_ust_cent: -ust, rueckforderung_cent: erstattung - netto - ust };
}

/** Darf ein Auftrag (bzw. sein Anteil) jetzt überwiesen werden? */
export function auszahlbar(x: { bezahlt: boolean; faellig: string; heute: string; offeneBeschwerde: boolean; eingefroren?: boolean; gesperrt: boolean; schonAusgezahlt?: boolean }) {
  return x.bezahlt && x.faellig <= x.heute && !x.offeneBeschwerde && !x.eingefroren && !x.gesperrt && !x.schonAusgezahlt;
}

/** Offene Abzüge und Rückforderungen mit einem Betrag verrechnen (älteste
 *  zuerst). Gibt zurück, was verwendet wurde und was übrig bleibt. */
export function verrechne<T extends { id: number; offen_cent: number }>(offen: T[], verfuegbar: number) {
  let rest = Math.max(0, verfuegbar);
  const verwendet: { id: number; betrag_cent: number }[] = [];
  for (const o of offen) {
    if (o.offen_cent < 0) {
      /* Gutschrift (z. B. Rundungsausgleich): erhöht den Betrag */
      verwendet.push({ id: o.id, betrag_cent: o.offen_cent });
      rest -= o.offen_cent;
      continue;
    }
    const t = Math.min(rest, o.offen_cent);
    if (t <= 0) continue;
    verwendet.push({ id: o.id, betrag_cent: t });
    rest -= t;
  }
  return { verwendet, rest };
}

/* ------------------------------------------------------------------ */
/* Wochenabrechnung (jeden Montag über die Vorwoche)                   */
/* ------------------------------------------------------------------ */

export interface WochenPosten {
  payout_id: number;
  buchung: string;           // Buchungs- bzw. Belegnummer
  eventdatum: string;
  umsatz_cent: number;       // bezahlt abzüglich Erstattungen
  provision_bp: number;
  gebuehr_cent: number;      // schnellere Auszahlung (brutto)
  einbehalt_cent: number;    // Sicherheitseinbehalt, später fällig
  ueberwiesen_cent: number;  // tatsächlich überwiesen (nach Verrechnung)
}
export interface WochenVerrechnung {
  id: number;
  art: "strafgebuehr" | "schaden" | "sonstiges" | "rueckforderung";
  grund: string;
  betrag_cent: number;       // abgezogen (negativ = gutgeschrieben)
}
export interface WochenKorrektur {
  id: number;
  buchung: string;
  umsatz_cent: number;       // negativ
  provision_netto_cent: number; // negativ
}
export interface WochenEingabe {
  anbieter: Anbieter;
  plattform: Partei & Record<string, unknown>;
  von: string;
  bis: string;
  posten: WochenPosten[];
  einbehaltFrei: { payout_id: number; buchung: string; betrag_cent: number }[];
  verrechnungen: WochenVerrechnung[];
  korrekturen: WochenKorrektur[];
  /** nach dieser Woche noch offene Abzüge/Rückforderungen (positiv) */
  offen_cent: number;
}

export interface WochenErgebnis {
  provisionsrechnung: BelegEntwurf | null;
  abrechnung: BelegEntwurf;
  summen: {
    umsatz_brutto_cent: number;
    provision_netto_cent: number;
    provision_steuer_cent: number;
    provision_brutto_cent: number;
    gebuehren_cent: number;
    einbehalt_cent: number;
    abzuege_cent: number;
    korrekturen_cent: number;
    vortrag_cent: number;
    auszahlung_cent: number;
    rundung_cent: number;
    status: "ausgezahlt" | "erledigt" | "vortrag" | "bereit";
  };
}

const euro = (c: number) => (c / 100).toFixed(2).replace(".", ",") + " €";
const datumDe = (d: string) => d.split("-").reverse().join(".");

export function wochenabrechnung(e: WochenEingabe): WochenErgebnis | null {
  if (!e.posten.length && !e.einbehaltFrei.length && !e.verrechnungen.length && !e.korrekturen.length && e.offen_cent <= 0) return null;
  const umsatz = e.posten.reduce((n, p) => n + p.umsatz_cent, 0);
  const provLines = e.posten.map((p) => ({ p, netto: provisionNetto(p.umsatz_cent, p.provision_bp) }));
  const korrNetto = e.korrekturen.reduce((n, k) => n + k.provision_netto_cent, 0);
  const provNetto = provLines.reduce((n, l) => n + l.netto, 0) + korrNetto;
  const provUst = ustAuf(provNetto);
  const provBrutto = provNetto + provUst;
  /* pro Auftrag bereits einbehaltene USt (anteilAnbieter) vs. USt auf die Wochensumme */
  const ustEinzeln = provLines.reduce((n, l) => n + ustAuf(l.netto), 0) + e.korrekturen.reduce((n, k) => n + ustAuf(k.provision_netto_cent), 0);
  const rundung = ustEinzeln - provUst; // > 0: Anbieter bekommt das gut
  const gebuehren = e.posten.reduce((n, p) => n + p.gebuehr_cent, 0);
  const einbehalt = e.posten.reduce((n, p) => n + p.einbehalt_cent, 0) - e.einbehaltFrei.reduce((n, x) => n + x.betrag_cent, 0);
  const abzuege = e.verrechnungen.filter((v) => v.art !== "rueckforderung").reduce((n, v) => n + v.betrag_cent, 0);
  const rueck = e.verrechnungen.filter((v) => v.art === "rueckforderung").reduce((n, v) => n + v.betrag_cent, 0);
  const ueberwiesen = e.posten.reduce((n, p) => n + p.ueberwiesen_cent, 0) + e.einbehaltFrei.reduce((n, x) => n + x.betrag_cent, 0);

  const datum = e.bis;
  const jahr = Number(datum.slice(0, 4));

  let pr: BelegEntwurf | null = null;
  if (provLines.length || e.korrekturen.length) {
    const positionen: Position[] = [
      ...provLines.map(({ p, netto }) => ({
        beschreibung: `Provision ${p.provision_bp / 100} % · Buchung ${p.buchung} vom ${datumDe(p.eventdatum)} · Umsatz ${euro(p.umsatz_cent)}`,
        menge: 1,
        einzel_brutto_cent: netto,
        brutto_cent: netto,
        steuersatz: PROVISION_UST,
        leistung_von: p.eventdatum,
        leistung_bis: p.eventdatum,
        referenz: `payout:${p.payout_id}`,
      })),
      ...e.korrekturen.map((k) => ({
        beschreibung: `Provisionsgutschrift nach Erstattung · Buchung ${k.buchung} · Umsatz ${euro(k.umsatz_cent)}`,
        menge: 1,
        einzel_brutto_cent: k.provision_netto_cent,
        brutto_cent: k.provision_netto_cent,
        steuersatz: PROVISION_UST,
        referenz: `korrektur:${k.id}`,
      })),
    ];
    /* Hier sind die Positionsbeträge netto; die Steuer kommt auf die Summe */
    const gruppe: Steuergruppe = { satz: PROVISION_UST, netto_cent: provNetto, steuer_cent: provUst, brutto_cent: provBrutto };
    pr = {
      art: "provisionsrechnung",
      ...kreisFuer("provisionsrechnung", null),
      jahr,
      quelle: `pr:${e.anbieter.id}:${e.bis}`,
      aussteller_typ: "plattform",
      anbieter_id: e.anbieter.id,
      im_namen_von_anbieter: false,
      kunde_id: null,
      order_id: null,
      buchung_id: null,
      bezug_beleg_id: null,
      belegdatum: datum,
      leistung_von: e.von,
      leistung_bis: e.bis,
      aussteller_snapshot: e.plattform,
      empfaenger_snapshot: { ...e.anbieter },
      netto_cent: provNetto,
      steuer_cent: provUst,
      brutto_cent: provBrutto,
      steuer_aufstellung: [gruppe],
      pflichthinweise: [
        "Provision für die Vermittlung über Showly. Positionen netto, Umsatzsteuer auf die Summe.",
        "Der Betrag ist mit den Auszahlungen dieser Woche bereits verrechnet.",
      ],
      kleinbetrag: false,
      e_rechnung_erforderlich: e.anbieter.typ === "gewerblich",
      positionen,
    };
  }

  const abPos: Position[] = [];
  const line = (beschreibung: string, cent: number, referenz: string | null = null) => {
    if (cent) abPos.push({ beschreibung, menge: 1, einzel_brutto_cent: cent, brutto_cent: cent, steuersatz: 0, referenz });
  };
  for (const p of e.posten) line(`Umsatz Buchung ${p.buchung} vom ${datumDe(p.eventdatum)}`, p.umsatz_cent, `payout:${p.payout_id}`);
  /* je Auftrag einbehalten: Provision netto + USt (anteilAnbieter) */
  const itemNetto = provLines.reduce((n, l) => n + l.netto, 0);
  const itemUst = provLines.reduce((n, l) => n + ustAuf(l.netto), 0);
  line(`Provision ${euro(itemNetto)} netto + ${euro(itemUst)} USt (siehe Provisionsrechnung)`, -(itemNetto + itemUst));
  line("Gebühr für schnellere Auszahlung", -gebuehren);
  line("Sicherheitseinbehalt (wird nach 30 Tagen ausgezahlt)", -e.posten.reduce((n, p) => n + p.einbehalt_cent, 0));
  for (const x of e.einbehaltFrei) line(`Freigabe Sicherheitseinbehalt Buchung ${x.buchung}`, x.betrag_cent, `payout:${x.payout_id}`);
  for (const v of e.verrechnungen)
    line(
      v.art === "rueckforderung"
        ? `Rückforderung nach Erstattung (abzüglich Provisionsgutschrift): ${v.grund}`
        : `${v.art === "strafgebuehr" ? "Vertragsstrafe" : v.art === "schaden" ? "Schadensersatz" : "Sonstiger Abzug"} (ohne USt): ${v.grund}`,
      -v.betrag_cent,
      `verrechnung:${v.id}`,
    );

  const vortrag = e.offen_cent > 0 ? -e.offen_cent : 0;
  const status: WochenErgebnis["summen"]["status"] = ueberwiesen > 0 ? "ausgezahlt" : vortrag < 0 ? "vortrag" : "erledigt";
  const ab: BelegEntwurf = {
    art: "auszahlungsabrechnung",
    ...kreisFuer("auszahlungsabrechnung", null),
    jahr,
    quelle: `ab:${e.anbieter.id}:${e.bis}`,
    aussteller_typ: "plattform",
    anbieter_id: e.anbieter.id,
    im_namen_von_anbieter: false,
    kunde_id: null,
    order_id: null,
    buchung_id: null,
    bezug_beleg_id: null,
    belegdatum: datum,
    leistung_von: e.von,
    leistung_bis: e.bis,
    aussteller_snapshot: e.plattform,
    empfaenger_snapshot: { ...e.anbieter },
    netto_cent: ueberwiesen,
    steuer_cent: 0,
    brutto_cent: ueberwiesen,
    steuer_aufstellung: [],
    pflichthinweise: [
      "Auszahlungsabrechnung – keine Rechnung.",
      `Überwiesen in diesem Zeitraum: ${euro(ueberwiesen)}.`,
      ...(vortrag < 0 ? [`Noch offen und mit den nächsten Auszahlungen verrechnet (Vortrag): ${euro(-vortrag)}.`] : []),
      ...(rundung ? [`Rundungsausgleich Umsatzsteuer: ${euro(rundung)}${rundung > 0 ? " zu deinen Gunsten" : " zu Lasten"}, verrechnet mit der nächsten Auszahlung.`] : []),
      "Vertragsstrafen und Schadensersatz unterliegen nicht der Umsatzsteuer.",
    ],
    kleinbetrag: false,
    e_rechnung_erforderlich: false,
    positionen: abPos,
  };
  return {
    provisionsrechnung: pr,
    abrechnung: ab,
    summen: {
      umsatz_brutto_cent: umsatz,
      provision_netto_cent: provNetto,
      provision_steuer_cent: provUst,
      provision_brutto_cent: provBrutto,
      gebuehren_cent: gebuehren,
      einbehalt_cent: einbehalt,
      abzuege_cent: abzuege,
      korrekturen_cent: rueck,
      vortrag_cent: vortrag,
      auszahlung_cent: ueberwiesen,
      rundung_cent: rundung,
      status,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Schwellen für Hinweise                                              */
/* ------------------------------------------------------------------ */

export function schwellen(a: { typ: AnbieterTyp; umsatz_jahr_cent: number; buchungen_jahr: number }) {
  return {
    hinweisGewerbe: a.typ === "privat" && (a.buchungen_jahr > PRIVAT_MAX_BUCHUNGEN || a.umsatz_jahr_cent >= PRIVAT_MAX_CENT),
    warnungUmsatz: a.typ === "kleinunternehmer" && a.umsatz_jahr_cent >= WARN_KLEIN_CENT,
  };
}

/* ------------------------------------------------------------------ */
/* DATEV-Export (Buchungsstapel, EXTF 700) für Provisionsrechnungen     */
/* ------------------------------------------------------------------ */

export interface DatevKonten {
  beraternummer: string;
  mandantennummer: string;
  /** Erlöskonto Provision 19 % (SKR03 8400 / SKR04 4400) */
  erloese: string;
  /** Sammel-Debitor für Anbieter */
  debitor: string;
}

export function datevCsv(
  belege: { nummer: string; belegdatum: string; brutto_cent: number; art: string; empfaenger: string }[],
  k: DatevKonten,
  jahr: number,
): string {
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const head = [
    q("EXTF"), "700", "21", q("Buchungsstapel"), "13", new Date().toISOString().replace(/\D/g, "").slice(0, 17), "", q("SH"), q(""), q(""),
    k.beraternummer, k.mandantennummer, `${jahr}0101`, "4", `${jahr}0101`, `${jahr}1231`, q("Showly Provisionen"), q(""), "1", "0", "0", q("EUR"),
  ].join(";");
  const cols = ["Umsatz (ohne Soll/Haben-Kz)", "Soll/Haben-Kennzeichen", "WKZ Umsatz", "Kurs", "Basis-Umsatz", "WKZ Basis-Umsatz", "Konto", "Gegenkonto (ohne BU-Schlüssel)", "BU-Schlüssel", "Belegdatum", "Belegfeld 1", "Belegfeld 2", "Skonto", "Buchungstext"]
    .map(q)
    .join(";");
  const rows = belege.map((b) =>
    [
      (Math.abs(b.brutto_cent) / 100).toFixed(2).replace(".", ","),
      b.brutto_cent >= 0 ? q("S") : q("H"),
      q("EUR"), "", "", "",
      k.debitor,
      k.erloese,
      q(""),
      b.belegdatum.slice(8, 10) + b.belegdatum.slice(5, 7),
      q(b.nummer.slice(0, 36)),
      q(""),
      "",
      q(`${b.art === "provisionsrechnung" ? "Provision" : b.art} ${b.empfaenger}`.slice(0, 60)),
    ].join(";"),
  );
  return [head, cols, ...rows].join("\r\n") + "\r\n";
}

/* ------------------------------------------------------------------ */
/* Kaution (Verleih): kein Umsatz, eigene Bestätigung                  */
/* ------------------------------------------------------------------ */

export function kautionEntwurf(x: {
  anbieter: Anbieter;
  kunde: Kunde;
  plattform: Partei & Record<string, unknown>;
  positionen: { beschreibung: string; menge: number; brutto_cent: number; leistung_von?: string | null; leistung_bis?: string | null }[];
  quelle: string;
  order_id: number | null;
  buchung_id: number | null;
  datum: string;
}): BelegEntwurf {
  const positionen: Position[] = x.positionen.map((p) => ({
    ...p,
    einzel_brutto_cent: Math.round(p.brutto_cent / Math.max(1, p.menge)),
    steuersatz: 0,
  }));
  const summe = positionen.reduce((n, p) => n + p.brutto_cent, 0);
  const daten = positionen.flatMap((p) => [p.leistung_von, p.leistung_bis]).filter((d): d is string => !!d).sort();
  return {
    art: "kaution",
    ...kreisFuer("kaution", null),
    jahr: Number(x.datum.slice(0, 4)),
    quelle: x.quelle,
    aussteller_typ: "plattform",
    anbieter_id: x.anbieter.id,
    im_namen_von_anbieter: false,
    kunde_id: x.kunde.id,
    order_id: x.order_id,
    buchung_id: x.buchung_id,
    bezug_beleg_id: null,
    belegdatum: x.datum,
    leistung_von: daten[0] ?? x.datum,
    leistung_bis: daten[daten.length - 1] ?? x.datum,
    aussteller_snapshot: { ...x.plattform, leistung_von_name: anzeigeName(x.anbieter) },
    empfaenger_snapshot: { name: x.kunde.name, firma: x.kunde.firma || null, strasse: x.kunde.strasse ?? null, plz: x.kunde.plz ?? null, ort: x.kunde.ort ?? null, email: x.kunde.email ?? null },
    netto_cent: summe,
    steuer_cent: 0,
    brutto_cent: summe,
    steuer_aufstellung: [{ satz: 0, netto_cent: summe, steuer_cent: 0, brutto_cent: summe }],
    pflichthinweise: [
      "Kautionsbestätigung – keine Rechnung. Die Kaution ist kein Entgelt und unterliegt nicht der Umsatzsteuer.",
      "Showly verwahrt die Kaution und erstattet sie nach der Rückgabe, abzüglich belegter Schäden, Reinigung oder Verspätung.",
    ],
    kleinbetrag: false,
    e_rechnung_erforderlich: false,
    positionen,
  };
}

/* ------------------------------------------------------------------ */
/* Steuer- und DAC7-Daten der Anbieter                                 */
/* ------------------------------------------------------------------ */

/** Steuerliche Identifikationsnummer: 11 Ziffern, Prüfziffer nach ISO 7064 MOD 11,10 */
export function steuerIdGueltig(v: string | null | undefined): boolean {
  const s = String(v || "").replace(/\s/g, "");
  if (!/^[1-9]\d{10}$/.test(s)) return false;
  let p = 10;
  for (let i = 0; i < 10; i++) {
    let sum = (Number(s[i]) + p) % 10;
    if (sum === 0) sum = 10;
    p = (sum * 2) % 11;
  }
  const check = (11 - p) % 10;
  return check === Number(s[10]);
}

export const ustIdGueltig = (v: string | null | undefined) => /^[A-Z]{2}[0-9A-Z]{2,13}$/.test(String(v || "").replace(/\s/g, "").toUpperCase());

/** Sind die Daten für Belege und die DAC7-Meldung vollständig? Ohne sie
 *  zahlt Showly nicht aus (auszahlungen_gesperrt). */
export function steuerdatenFehlen(a: {
  typ: AnbieterTyp;
  name?: string | null;
  firma?: string | null;
  strasse?: string | null;
  plz?: string | null;
  ort?: string | null;
  geburtsdatum?: string | null;
  steuer_id?: string | null;
  steuernummer?: string | null;
  ust_id?: string | null;
  iban?: string | null;
}): string[] {
  const f: string[] = [];
  if (!a.name?.trim()) f.push("Name");
  if (!a.strasse?.trim() || !a.plz?.trim() || !a.ort?.trim()) f.push("Anschrift");
  if (!a.iban?.replace(/\s/g, "")) f.push("IBAN");
  if (a.typ === "gewerblich") {
    if (!a.ust_id?.trim() && !a.steuernummer?.trim()) f.push("Steuernummer oder USt-IdNr.");
    if (a.ust_id?.trim() && !ustIdGueltig(a.ust_id)) f.push("gültige USt-IdNr.");
  } else {
    if (!a.geburtsdatum) f.push("Geburtsdatum");
    if (!steuerIdGueltig(a.steuer_id)) f.push("steuerliche Identifikationsnummer");
    if (a.typ === "kleinunternehmer" && !a.steuernummer?.trim() && !steuerIdGueltig(a.steuer_id)) f.push("Steuernummer");
  }
  return f;
}
