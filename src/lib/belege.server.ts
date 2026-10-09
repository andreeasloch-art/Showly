/* Belegsystem auf dem Server: Belege beim Bezahlen, bei Erstattungen und
 * Storno, Nachzahlungen, Wochenabrechnung mit den Anbietern.
 *
 * Rechenregeln in showly/belege.ts (rein, getestet), Nummern und
 * Schreibschutz in der Datenbank (Migration 0021, beleg_anlegen), PDFs in
 * lib/belegPdf.ts, E-Rechnung in lib/erechnung.ts.
 *
 * Jede Funktion ist wiederholbar: Belege haben einen eindeutigen
 * Quell-Schlüssel ("kauf:<teilbestellung>" usw.); ein zweiter Aufruf gibt den
 * vorhandenen Beleg zurück und verschickt nichts doppelt. */
import { adminClient } from "./supabase.server";
import { base64, sendMail } from "./mail.server";
import { belegPdf, sha256Hex } from "./belegPdf";
import { pdfMitXml, xrechnungCii } from "./erechnung";
import type { AnbieterRow, BelegRow } from "./database.types";
import {
  PLATTFORM_PLATZHALTER,
  PROVISION_BP_STANDARD,
  belegFuerKauf,
  kautionEntwurf,
  korrekturEntwurf,
  korrekturNachAuszahlung,
  schwellen,
  stornoEntwurf,
  stornogebuehrEntwurf,
  wochenabrechnung,
  type Anbieter,
  type BelegEntwurf,
  type Kunde,
  type Leistungsart,
  type Original,
  type Partei,
  type Position,
  type WochenEingabe,
} from "@/showly/belege";

type Db = ReturnType<typeof adminClient>;
const euro = (c: number) => (c / 100).toFixed(2).replace(".", ",") + " €";

/** Heutiges Datum in deutscher Zeit (YYYY-MM-DD) */
export function heuteBerlin(d = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(d);
}

/** Daten der Plattform (Provisionsrechnung, Quittungen). Bis die echten
 *  Firmendaten in der Konfiguration stehen, die „Muster“-Angaben. */
export function plattform(): Partei & Record<string, unknown> {
  const e = (k: string) => process.env[k] || null;
  return {
    ...PLATTFORM_PLATZHALTER,
    ...(e("SHOWLY_FIRMA") ? { name: e("SHOWLY_FIRMA")!, firma: e("SHOWLY_FIRMA") } : {}),
    ...(e("SHOWLY_STRASSE") ? { strasse: e("SHOWLY_STRASSE") } : {}),
    ...(e("SHOWLY_PLZ") ? { plz: e("SHOWLY_PLZ") } : {}),
    ...(e("SHOWLY_ORT") ? { ort: e("SHOWLY_ORT") } : {}),
    ...(e("SHOWLY_UST_ID") ? { ust_id: e("SHOWLY_UST_ID") } : {}),
    ...(e("SHOWLY_STEUERNUMMER") ? { steuernummer: e("SHOWLY_STEUERNUMMER") } : {}),
    ...(e("SHOWLY_HANDELSREGISTER") ? { handelsregister: e("SHOWLY_HANDELSREGISTER") } : {}),
    ...(e("SHOWLY_RECHNUNG_EMAIL") ? { email: e("SHOWLY_RECHNUNG_EMAIL") } : {}),
  };
}

/* ------------------------------------------------------------------ */
/* Anbieter                                                            */
/* ------------------------------------------------------------------ */

/** Steuerdaten eines Anbieters; legt die Zeile beim ersten Mal aus den
 *  bisherigen Angaben (gewerblich/privat) an. */
export async function anbieterLaden(db: Db, owner: string): Promise<{ row: AnbieterRow; anbieter: Anbieter; email: string | null }> {
  let { data: row } = await db.from("anbieter").select("*").eq("id", owner).maybeSingle();
  const { data: prof } = await db.from("profiles").select("display_name, email").eq("id", owner).maybeSingle();
  if (!row) {
    const { data: art } = await db.from("artists").select("business").eq("owner", owner).limit(1);
    const { data: prov } = await db.from("providers").select("data").eq("owner", owner).limit(1);
    const gewerblich = art?.[0]?.business === true || (prov?.[0]?.data as { kind?: string } | undefined)?.kind === "business";
    await db.from("anbieter").upsert({ id: owner, typ: gewerblich ? "gewerblich" : "privat", name: prof?.display_name ?? null }, { onConflict: "id", ignoreDuplicates: true });
    row = (await db.from("anbieter").select("*").eq("id", owner).single()).data!;
  }
  if (row.typ !== "privat" && !row.rechnung_praefix) {
    const { data: p } = await db.rpc("anbieter_praefix", { p_id: owner });
    row = { ...row, rechnung_praefix: (p as string) ?? null };
  }
  return {
    row,
    email: prof?.email ?? null,
    anbieter: {
      id: owner,
      typ: row.typ,
      name: row.name || prof?.display_name || "Anbieter",
      firma: row.firma,
      strasse: row.strasse,
      plz: row.plz,
      ort: row.ort,
      land: row.land,
      steuernummer: row.steuernummer,
      ust_id: row.ust_id,
      handelsregister: row.handelsregister,
      rechnung_praefix: row.rechnung_praefix,
      email: prof?.email ?? null,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Ablage: Beleg anlegen, PDF erzeugen, speichern, verschicken          */
/* ------------------------------------------------------------------ */

async function positionenVon(db: Db, belegId: number): Promise<Position[]> {
  const { data } = await db.from("beleg_positionen").select("*").eq("beleg_id", belegId).order("pos");
  return (data || []).map((p) => ({
    beschreibung: p.beschreibung,
    menge: p.menge,
    einzel_brutto_cent: p.einzel_brutto_cent,
    brutto_cent: p.brutto_cent,
    steuersatz: p.steuersatz,
    leistung_von: p.leistung_von,
    leistung_bis: p.leistung_bis,
    referenz: p.referenz,
  }));
}

/** Gespeicherten Beleg wieder als Entwurf (für PDF, Storno, Korrektur) */
export async function alsEntwurf(db: Db, r: BelegRow): Promise<BelegEntwurf & { nummer: string; id: number }> {
  return {
    id: r.id,
    nummer: r.nummer,
    art: r.art,
    kreis: r.kreis,
    praefix: /^(.*)-\d{4}-\d+$/.exec(r.nummer)?.[1] ?? r.kreis,
    stellen: r.nummer.split("-").pop()!.length,
    jahr: r.jahr,
    quelle: r.quelle ?? "",
    aussteller_typ: r.aussteller_typ,
    anbieter_id: r.anbieter_id,
    im_namen_von_anbieter: r.im_namen_von_anbieter,
    kunde_id: r.kunde_id,
    order_id: r.order_id,
    buchung_id: r.buchung_id,
    bezug_beleg_id: r.bezug_beleg_id,
    belegdatum: r.belegdatum,
    leistung_von: r.leistung_von,
    leistung_bis: r.leistung_bis,
    aussteller_snapshot: r.aussteller_snapshot as Partei & Record<string, unknown>,
    empfaenger_snapshot: r.empfaenger_snapshot as Partei & Record<string, unknown>,
    netto_cent: r.netto_cent,
    steuer_cent: r.steuer_cent,
    brutto_cent: r.brutto_cent,
    steuer_aufstellung: r.steuer_aufstellung,
    pflichthinweise: r.pflichthinweise,
    kleinbetrag: r.kleinbetrag,
    e_rechnung_erforderlich: r.e_rechnung_erforderlich,
    positionen: await positionenVon(db, r.id),
  };
}

const ablagePfad = (r: BelegRow, ext: string) => `${r.anbieter_id ?? "showly"}/${r.jahr}/${r.nummer}.${ext}`;

/** Beleg anlegen (idempotent), PDF und ggf. E-Rechnung ablegen.
 *  `neu` ist nur beim ersten Mal wahr; dann wird auch verschickt. */
export async function belegAnlegen(db: Db, e: BelegEntwurf): Promise<{ row: BelegRow; neu: boolean; pdf: Uint8Array | null; xml: string | null }> {
  const { data, error } = await db.rpc("beleg_anlegen", { p: e });
  if (error || !data) throw new Error(`Beleg konnte nicht angelegt werden: ${error?.message ?? "unbekannt"}`);
  const row = data as BelegRow;
  if (row.sha256) return { row, neu: false, pdf: null, xml: null };
  const voll = await alsEntwurf(db, row);
  let bezug: string | null = null;
  if (row.bezug_beleg_id) bezug = (await db.from("belege").select("nummer").eq("id", row.bezug_beleg_id).maybeSingle()).data?.nummer ?? null;
  let pdf = await belegPdf(voll);
  let xml: string | null = null;
  if (row.e_rechnung_erforderlich) {
    xml = xrechnungCii({ ...voll, bezug_nummer: bezug });
    pdf = await pdfMitXml(pdf, xml);
  }
  const sha = await sha256Hex(pdf);
  const store = db.storage.from("belege");
  /* Nicht überschreiben (upsert: false): ein vorhandenes PDF bleibt */
  await store.upload(ablagePfad(row, "pdf"), pdf, { contentType: "application/pdf", upsert: false });
  if (xml) await store.upload(ablagePfad(row, "xml"), new TextEncoder().encode(xml), { contentType: "application/xml", upsert: false });
  const { data: fest } = await db
    .from("belege")
    .update({ pdf_pfad: ablagePfad(row, "pdf"), sha256: sha, ...(xml ? { xml_pfad: ablagePfad(row, "xml") } : {}) })
    .eq("id", row.id)
    .is("sha256", null)
    .select("*")
    .maybeSingle();
  /* Hat ein paralleler Aufruf schon abgelegt, verschickt der */
  return { row: (fest as BelegRow | null) ?? row, neu: !!fest, pdf, xml };
}

const TITEL_MAIL: Record<string, string> = {
  rechnung: "Deine Rechnung",
  quittung: "Deine Buchungsquittung",
  storno: "Stornobeleg zu deiner Buchung",
  korrektur: "Korrekturbeleg zu deiner Erstattung",
  kaution: "Bestätigung deiner Kaution",
  provisionsrechnung: "Provisionsrechnung",
  auszahlungsabrechnung: "Auszahlungsabrechnung",
};

async function anKunden(db: Db, r: BelegRow, pdf: Uint8Array, xml: string | null, satz?: string) {
  const empf = r.empfaenger_snapshot as { email?: string | null };
  let to = empf.email ?? null;
  if (!to && r.kunde_id) to = (await db.from("profiles").select("email").eq("id", r.kunde_id).maybeSingle()).data?.email ?? null;
  if (!to) return;
  await sendMail(
    to,
    `${TITEL_MAIL[r.art] ?? "Beleg"} ${r.nummer}`,
    [
      satz ??
        (r.art === "quittung" || r.art === "rechnung"
          ? `Danke für deine Buchung über Showly. Im Anhang findest du ${r.art === "rechnung" ? "die Rechnung" : "die Buchungsquittung"} über ${euro(r.brutto_cent)}. Du hast schon bezahlt.`
          : `Im Anhang findest du den Beleg ${r.nummer} über ${euro(r.brutto_cent)}.`),
      "Alle Belege findest du auch in deinem Konto unter „Zahlungen“.",
    ],
    [
      { filename: `${r.nummer}.pdf`, content: base64(pdf) },
      ...(xml ? [{ filename: `${r.nummer}.xml`, content: base64(new TextEncoder().encode(xml)) }] : []),
    ],
  ).catch(() => false);
}

/** Zähler und Hinweise (privat über der Schwelle, Kleinunternehmer-Grenze) */
async function zaehlen(db: Db, owner: string, cent: number, buchungen: number, email: string | null) {
  const { data } = await db.rpc("beleg_zaehlen", { p_anbieter: owner, p_cent: cent, p_buchungen: buchungen });
  const a = data as AnbieterRow | null;
  if (!a) return;
  const s = schwellen(a);
  if (s.hinweisGewerbe && !a.hinweis_gewerbe) {
    await db.from("anbieter").update({ hinweis_gewerbe: true, hinweis_gewerbe_am: new Date().toISOString() }).eq("id", owner);
    if (email)
      await sendMail(email, "Bitte prüfe deine Angaben: privat oder Kleinunternehmer?", [
        `Du hast in diesem Jahr schon ${a.buchungen_jahr} Buchungen bzw. ${euro(a.umsatz_jahr_cent)} Umsatz über Showly.`,
        "Wer regelmäßig und mit Gewinnabsicht verkauft oder auftritt, ist in der Regel gewerblich tätig. Bitte melde ein Gewerbe an und stelle dein Konto unter „Zahlungen“ → „Steuer- und Rechnungsdaten“ auf Kleinunternehmer oder gewerblich um. Im Zweifel hilft dein Steuerberater.",
      ]).catch(() => false);
  }
  if (s.warnungUmsatz && !a.warnung_umsatzgrenze) {
    await db.from("anbieter").update({ warnung_umsatzgrenze: true }).eq("id", owner);
    if (email)
      await sendMail(email, "Hinweis: Umsatzgrenze für Kleinunternehmer", [
        `Dein Umsatz über Showly liegt in diesem Jahr bei ${euro(a.umsatz_jahr_cent)}.`,
        "Die Kleinunternehmerregelung (§ 19 UStG) gilt nur, wenn der Umsatz im Vorjahr höchstens 25.000 € betrug und im laufenden Jahr 100.000 € nicht übersteigt. Bitte prüfe mit deinem Steuerberater, ob du ab dem nächsten Jahr Umsatzsteuer ausweisen musst.",
      ]).catch(() => false);
  }
}

/* ------------------------------------------------------------------ */
/* Kauf: nach der Zahlung (Stripe-Webhook bzw. Rückkehr aus der Kasse)  */
/* ------------------------------------------------------------------ */

const txt = (v: unknown) => (typeof v === "string" ? v : String(((v || {}) as Record<string, string>)["de"] || ""));
const tag = (d: string) => d.split("-").reverse().join(".");

function anschrift(a: string | null | undefined): Pick<Partei, "strasse" | "plz" | "ort"> {
  const s = String(a || "").trim();
  const m = /^(.*?),\s*(\d{4,5})\s+(.+)$/.exec(s);
  return m ? { strasse: m[1]!, plz: m[2]!, ort: m[3]! } : { strasse: s || null, plz: null, ort: null };
}

async function kundeVon(db: Db, orderId: number): Promise<Kunde & { email: string | null }> {
  const { data: o } = await db.from("orders").select("*").eq("id", orderId).maybeSingle();
  const { data: p } = o?.customer ? await db.from("profiles").select("display_name, email").eq("id", o.customer).maybeSingle() : { data: null };
  return {
    id: o?.customer ?? null,
    name: o?.kunde_name || p?.display_name || "Kunde",
    firma: o?.kunde_firma ?? null,
    ust_id: o?.kunde_ust_id ?? null,
    ...anschrift(o?.kunde_anschrift),
    land: "DE",
    email: p?.email ?? null,
  };
}

async function angebote(db: Db, ids: number[]) {
  if (!ids.length) return new Map<number, Record<string, unknown>>();
  const { data } = await db.from("provider_offers").select("id, data").in("id", ids);
  return new Map((data || []).map((o) => [o.id, o.data]));
}

/** Positionen einer Teilbestellung (ohne Kaution) */
async function positionenKauf(db: Db, sub: { id: number; provider_kind: string }, a: AnbieterRow): Promise<{ pos: Position[]; kaution: { beschreibung: string; menge: number; brutto_cent: number; leistung_von?: string | null; leistung_bis?: string | null }[]; shopOrder: number | null }> {
  if (sub.provider_kind === "artist") {
    const { data: bks } = await db.from("bookings").select("*").eq("sub_order_id", sub.id).order("day");
    const ids = [...new Set((bks || []).map((b) => b.artist_id).filter((x): x is number => !!x))];
    const { data: arts } = ids.length ? await db.from("artists").select("id, name").in("id", ids) : { data: [] };
    const nameOf = new Map((arts || []).map((x) => [x.id, txt(x.name)]));
    return {
      pos: (bks || [])
        /* schon vor dem Beleg Erstattetes (z. B. Termin vergeben) zählt nicht */
        .filter((b) => b.paid && b.amount_cents - b.refunded_cents > 0)
        .map((b) => ({
          beschreibung: [
            b.pkg ? `${nameOf.get(b.artist_id ?? 0) ?? "Auftritt"} · Paket ${b.pkg}` : `${nameOf.get(b.artist_id ?? 0) ?? "Auftritt"} · ${b.hours} Std.`,
            b.figure ? `Figur ${b.figure}` : null,
            b.occasion ? b.occasion : null,
            `${tag(b.day)}${b.slot ? `, ${b.slot} Uhr` : ""}`,
          ]
            .filter(Boolean)
            .join(" · "),
          menge: 1,
          einzel_brutto_cent: b.amount_cents - b.refunded_cents,
          brutto_cent: b.amount_cents - b.refunded_cents,
          steuersatz: a.ust_satz_standard,
          leistung_von: b.day,
          leistung_bis: b.day,
          referenz: `booking:${b.id}`,
        })),
      kaution: [],
      shopOrder: null,
    };
  }
  if (sub.provider_kind === "baker") {
    const { data: sw } = await db.from("sweet_requests").select("*").eq("sub_order_id", sub.id).order("day");
    const off = await angebote(db, (sw || []).map((r) => r.sweet_ref));
    return {
      pos: (sw || [])
        .filter((r) => (r.paid_cents ?? 0) - (r.refunded_cents ?? 0) > 0)
        .map((r) => {
          const d = off.get(r.sweet_ref) ?? {};
          return {
            beschreibung: `${txt(d["name"]) || "Torte bzw. Süßes"}${r.direct ? "" : " (Wunschtorte, Richtpreis)"} · ${tag(r.day)}`,
            menge: r.qty,
            einzel_brutto_cent: Math.round(((r.paid_cents ?? 0) - (r.refunded_cents ?? 0)) / Math.max(1, r.qty)),
            brutto_cent: (r.paid_cents ?? 0) - (r.refunded_cents ?? 0),
            steuersatz: Number(d["ust"]) === 19 ? 19 : 7,
            leistung_von: r.day,
            leistung_bis: r.day,
            referenz: `sweet:${r.id}`,
          };
        }),
      kaution: [],
      shopOrder: null,
    };
  }
  /* Deko und Kostüme */
  const { data: so } = await db.from("shop_orders").select("*").eq("sub_order_id", sub.id).maybeSingle();
  if (!so) return { pos: [], kaution: [], shopOrder: null };
  const off = await angebote(db, so.items.map((i) => i.shopId));
  return {
    pos: so.items.map((i) => {
      const d = off.get(i.shopId) ?? {};
      const cents = (i as { price_cents?: number }).price_cents ?? 0;
      return {
        beschreibung: `${txt(d["name"]) || "Artikel"} (${i.mode === "rent" ? "Miete" : "Kauf"}${i.size ? `, Größe ${i.size}` : ""})`,
        menge: i.qty,
        einzel_brutto_cent: Math.round(cents / Math.max(1, i.qty)),
        brutto_cent: cents,
        steuersatz: Number(d["ust"]) === 7 ? 7 : 19,
        leistung_von: i.from ?? null,
        leistung_bis: i.to ?? null,
        referenz: `shop:${so.id}:${i.shopId}`,
      };
    }),
    kaution: so.items
      .filter((i) => ((i as { deposit_cents?: number }).deposit_cents ?? 0) > 0)
      .map((i) => ({
        beschreibung: `Kaution ${txt((off.get(i.shopId) ?? {})["name"]) || "Mietartikel"}`,
        menge: i.qty,
        brutto_cent: (i as { deposit_cents?: number }).deposit_cents ?? 0,
        leistung_von: i.from ?? null,
        leistung_bis: i.to ?? null,
      })),
    shopOrder: so.id,
  };
}

/** Belege zu einer bezahlten Bestellung: je Anbieter ein Beleg (Rechnung
 *  bzw. Quittung), dazu ggf. Kautionsbestätigung. Wiederholbar. */
export async function belegeFuerBestellung(orderId: number): Promise<number> {
  const db = adminClient();
  const { data: order } = await db.from("orders").select("id, status").eq("id", orderId).maybeSingle();
  if (!order || order.status !== "paid") return 0;
  const { data: subs } = await db.from("sub_orders").select("*").eq("order_id", orderId);
  const kunde = await kundeVon(db, orderId);
  const datum = heuteBerlin();
  let n = 0;
  for (const sub of subs || []) {
    /* Showly-eigener Katalog: die Plattform verkauft nichts selbst */
    if (sub.provider_kind === "showly" || !sub.provider_owner) continue;
    const { row: aRow, anbieter, email } = await anbieterLaden(db, sub.provider_owner);
    const { pos, kaution, shopOrder } = await positionenKauf(db, sub, aRow);
    if (pos.length) {
      const e = belegFuerKauf({ anbieter, kunde, leistung: sub.provider_kind as Leistungsart, positionen: pos, quelle: `kauf:${sub.id}`, order_id: orderId, buchung_id: sub.id, datum });
      const r = await belegAnlegen(db, e);
      if (r.neu && r.pdf) {
        n++;
        await anKunden(db, r.row, r.pdf, r.xml);
        await zaehlen(db, anbieter.id, r.row.brutto_cent, 1, email);
      }
    }
    if (kaution.length && shopOrder) {
      const k = kautionEntwurf({ anbieter, kunde, plattform: plattform(), positionen: kaution, quelle: `kaution:${shopOrder}`, order_id: orderId, buchung_id: sub.id, datum });
      const r = await belegAnlegen(db, k);
      if (r.neu && r.pdf) await anKunden(db, r.row, r.pdf, null, `Für deine Miete hast du ${euro(r.row.brutto_cent)} Kaution hinterlegt. Sie ist kein Umsatz und steht deshalb nicht auf der Rechnung. Nach der Rückgabe bekommst du sie zurück.`);
    }
  }
  return n;
}

/** Nachzahlung bei einer Wunschtorte mit höherem Preis: eigener Beleg über
 *  die Differenz (gleicher Aussteller wie der ursprüngliche Beleg) */
export async function belegNachzahlung(sweetId: number, cents: number, sessionId: string): Promise<void> {
  const db = adminClient();
  const { data: r } = await db.from("sweet_requests").select("*").eq("id", sweetId).maybeSingle();
  if (!r?.baker_owner || cents <= 0) return;
  const { data: sub } = r.sub_order_id ? await db.from("sub_orders").select("order_id").eq("id", r.sub_order_id).maybeSingle() : { data: null };
  const { anbieter, email } = await anbieterLaden(db, r.baker_owner);
  const kunde = sub?.order_id ? await kundeVon(db, sub.order_id) : { id: r.customer, name: r.customer_name || "Kunde", email: null };
  const off = await angebote(db, [r.sweet_ref]);
  const e = belegFuerKauf({
    anbieter,
    kunde,
    leistung: "baker",
    positionen: [
      {
        beschreibung: `Aufpreis laut Angebot der Konditorei: ${txt((off.get(r.sweet_ref) ?? {})["name"]) || "Wunschtorte"} · ${tag(r.day)}`,
        menge: 1,
        einzel_brutto_cent: cents,
        brutto_cent: cents,
        steuersatz: Number((off.get(r.sweet_ref) ?? {})["ust"]) === 19 ? 19 : 7,
        leistung_von: r.day,
        leistung_bis: r.day,
        referenz: `sweet:${r.id}`,
      },
    ],
    quelle: `nachzahlung:${sessionId}`,
    order_id: sub?.order_id ?? null,
    buchung_id: r.sub_order_id ?? null,
    datum: heuteBerlin(),
  });
  const b = await belegAnlegen(db, e);
  if (b.neu && b.pdf) {
    await anKunden(db, b.row, b.pdf, b.xml);
    await zaehlen(db, anbieter.id, cents, 0, email);
  }
}

/* ------------------------------------------------------------------ */
/* Erstattung und Storno                                               */
/* ------------------------------------------------------------------ */

/** Nach einer Erstattung an den Kunden (Stripe ist schon erledigt):
 *  Storno- bzw. Korrekturbeleg, bei Stornogebühr Storno + neuer Beleg über
 *  die Gebühr; war schon ausgezahlt, Rückforderung mit Provisionsgutschrift.
 *  `ref` macht den Aufruf wiederholbar (z. B. "booking:12:0"). */
export async function erstattungVerbuchen(x: {
  subOrderId: number | null | undefined;
  cents: number;
  grund: string;
  ref: string;
  /** Kunde storniert und Showly behält eine Gebühr (Stornostufe) */
  stornogebuehrCent?: number;
  /** Auszahlung, zu der die Erstattung gehört (Rückforderung danach) */
  payoutId?: number | null;
}): Promise<void> {
  if (!x.subOrderId || x.cents <= 0) return;
  const db = adminClient();
  const datum = heuteBerlin();
  const { data: orig } = await db.from("belege").select("*").eq("quelle", `kauf:${x.subOrderId}`).maybeSingle();
  if (orig) {
    const o = (await alsEntwurf(db, orig)) as unknown as Original;
    const { data: vorher } = await db.from("belege").select("brutto_cent, art").eq("bezug_beleg_id", orig.id);
    const schonStorniert = (vorher || []).some((v) => v.art === "storno");
    const rest = orig.brutto_cent + (vorher || []).reduce((n, v) => n + (v.art === "storno" || v.art === "korrektur" ? v.brutto_cent : 0), 0);
    const ohneVorher = !(vorher || []).length;
    const ergebnis: { row: BelegRow; pdf: Uint8Array | null; xml: string | null; neu: boolean }[] = [];
    if (!schonStorniert && rest > 0) {
      /* Stornogebühr nur, wenn der Beleg allein diese Leistung enthält; sonst
         würde das Storno auch andere Termine derselben Rechnung aufheben */
      if (x.stornogebuehrCent && x.stornogebuehrCent > 0 && ohneVorher && o.positionen.length === 1) {
        ergebnis.push(await belegAnlegen(db, stornoEntwurf(o, `${x.ref}:storno`, datum, x.grund)));
        ergebnis.push(await belegAnlegen(db, stornogebuehrEntwurf(o, x.stornogebuehrCent, `${x.ref}:gebuehr`, datum)));
      } else if (x.cents >= rest && ohneVorher) {
        ergebnis.push(await belegAnlegen(db, stornoEntwurf(o, `${x.ref}:storno`, datum, x.grund)));
      } else {
        ergebnis.push(await belegAnlegen(db, korrekturEntwurf(o, Math.min(x.cents, rest), `${x.ref}:korrektur`, datum, x.grund)));
      }
    }
    for (const r of ergebnis) if (r.neu && r.pdf) await anKunden(db, r.row, r.pdf, r.xml);
    if (orig.anbieter_id) await db.rpc("beleg_zaehlen", { p_anbieter: orig.anbieter_id, p_cent: -x.cents, p_buchungen: 0 }).then(undefined, () => null);
  }

  /* Abrechnung mit dem Anbieter */
  const { data: sub } = await db.from("sub_orders").select("id, erstattet_cent, provider_owner, provision_bp").eq("id", x.subOrderId).maybeSingle();
  if (sub) await db.from("sub_orders").update({ erstattet_cent: (sub.erstattet_cent ?? 0) + x.cents }).eq("id", sub.id);
  if (!x.payoutId) return;
  const { data: p } = await db.from("payouts").select("*").eq("id", x.payoutId).maybeSingle();
  if (!p) return;
  if (p.status === "paid" || p.status === "held") {
    /* Schon ausgezahlt: Rückforderung, Provision anteilig gutschreiben */
    const owner = p.owner ?? sub?.provider_owner ?? null;
    if (!owner) return;
    const bp = p.provision_bp ?? (p.gross_cents ? Math.round((p.fee_cents * 10000) / p.gross_cents) : PROVISION_BP_STANDARD);
    const k = korrekturNachAuszahlung(x.cents, bp);
    await db.from("provision_korrekturen").upsert(
      {
        anbieter_id: owner,
        buchung_id: x.subOrderId,
        payout_id: p.id,
        umsatz_cent: k.umsatz_cent,
        provision_netto_cent: k.provision_netto_cent,
        provision_ust_cent: k.provision_ust_cent,
        rueckforderung_cent: k.rueckforderung_cent,
        quelle: `${x.ref}:rueck`,
      },
      { onConflict: "quelle", ignoreDuplicates: true },
    );
  } else {
    await db.from("payouts").update({ erstattet_cent: (p.erstattet_cent ?? 0) + x.cents }).eq("id", p.id);
  }
}

/* ------------------------------------------------------------------ */
/* Wochenabrechnung (Montag 06:00 Uhr deutscher Zeit über die Vorwoche) */
/* ------------------------------------------------------------------ */

/** Montag bis Sonntag der Vorwoche zu einem Tag */
export function vorwoche(heute: string): { von: string; bis: string } {
  const d = new Date(`${heute}T12:00:00Z`);
  const wd = (d.getUTCDay() + 6) % 7; // Montag = 0
  const bis = new Date(d.getTime() - (wd + 1) * 86_400_000);
  const von = new Date(bis.getTime() - 6 * 86_400_000);
  return { von: von.toISOString().slice(0, 10), bis: bis.toISOString().slice(0, 10) };
}

async function ownerVonPayout(db: Db, p: { owner?: string | null | undefined; artist_id: number | null }) {
  if (p.owner) return p.owner;
  if (!p.artist_id) return null;
  return (await db.from("artists").select("owner").eq("id", p.artist_id).maybeSingle()).data?.owner ?? null;
}

export async function wochenabrechnungAlle(heute = heuteBerlin()): Promise<{ neu: number; gesperrt: number; vorhanden: number }> {
  const db = adminClient();
  const { von, bis } = vorwoche(heute);
  const ab = `${von}T00:00:00+02:00`;
  const bisTs = `${bis}T23:59:59+02:00`;
  const out = { neu: 0, gesperrt: 0, vorhanden: 0 };

  /* Wer war in der Woche dabei? Auszahlungen, Freigaben, Verrechnungen, Korrekturen, offene Abzüge */
  const { data: pays } = await db.from("payouts").select("*").is("auszahlung_id", null).gte("ausgezahlt_am", ab).lte("ausgezahlt_am", bisTs).limit(5000);
  const { data: frei } = await db.from("payouts").select("*").is("einbehalt_auszahlung_id", null).gte("einbehalt_frei_am", ab).lte("einbehalt_frei_am", bisTs).limit(5000);
  const { data: verr } = await db.from("verrechnungen").select("*").is("auszahlung_id", null).lte("erstellt_am", bisTs).limit(5000);
  const { data: korr } = await db.from("provision_korrekturen").select("*").is("auszahlung_id", null).lte("erstellt_am", bisTs).limit(5000);
  const { data: abz } = await db.from("anbieter_abzuege").select("*").limit(5000);

  const owners = new Map<string, true>();
  const ownerOf = new Map<number, string>();
  for (const p of [...(pays || []), ...(frei || [])]) {
    const o = await ownerVonPayout(db, p);
    if (o) {
      owners.set(o, true);
      ownerOf.set(p.id, o);
    }
  }
  for (const k of korr || []) owners.set(k.anbieter_id, true);
  for (const a of abz || []) if (a.betrag_cent - a.verrechnet_cent !== 0) owners.set(a.anbieter_id, true);
  const abzById = new Map((abz || []).map((a) => [a.id, a]));
  const korrById = new Map((korr || []).map((k) => [k.id, k]));
  /* Verrechnungen gehören zur Auszahlung, aus der sie abgezogen wurden */
  const { data: verrPays } = (verr || []).length ? await db.from("payouts").select("id, owner, artist_id").in("id", (verr || []).map((v) => v.payout_id)) : { data: [] };
  for (const p of verrPays || []) {
    const o = await ownerVonPayout(db, p);
    if (o) ownerOf.set(p.id, o);
  }

  for (const owner of owners.keys()) {
    const { row, anbieter } = await anbieterLaden(db, owner);
    const meine = (pays || []).filter((p) => ownerOf.get(p.id) === owner);
    const buchungsNr = async (p: { booking_id: number | null; sub_order_id?: number | null; sweet_request_id?: number | null; id: number }) => {
      const sub =
        p.sub_order_id ??
        (p.booking_id ? (await db.from("bookings").select("sub_order_id").eq("id", p.booking_id).maybeSingle()).data?.sub_order_id : null) ??
        (p.sweet_request_id ? (await db.from("sweet_requests").select("sub_order_id").eq("id", p.sweet_request_id).maybeSingle()).data?.sub_order_id : null);
      const b = sub ? (await db.from("belege").select("nummer").eq("quelle", `kauf:${sub}`).maybeSingle()).data?.nummer : null;
      return b ?? (p.booking_id ? `Buchung ${p.booking_id}` : `Auftrag ${p.id}`);
    };
    const posten: WochenEingabe["posten"] = [];
    for (const p of meine)
      posten.push({
        payout_id: p.id,
        buchung: await buchungsNr(p),
        eventdatum: p.event_day ?? p.payout_on,
        umsatz_cent: p.gross_cents - (p.erstattet_cent ?? 0),
        provision_bp: p.provision_bp ?? (p.gross_cents ? Math.round((p.fee_cents * 10000) / p.gross_cents) : PROVISION_BP_STANDARD),
        gebuehr_cent: p.express_fee_cents ?? 0,
        einbehalt_cent: p.reserve_cents,
        ueberwiesen_cent: p.ueberwiesen_cent ?? 0,
      });
    const einbehaltFrei: WochenEingabe["einbehaltFrei"] = [];
    for (const p of (frei || []).filter((p) => ownerOf.get(p.id) === owner)) einbehaltFrei.push({ payout_id: p.id, buchung: await buchungsNr(p), betrag_cent: p.reserve_cents });
    const meineVerr = (verr || []).filter((v) => ownerOf.get(v.payout_id) === owner);
    const verrechnungen: WochenEingabe["verrechnungen"] = meineVerr.map((v) => {
      const a = v.abzug_id ? abzById.get(v.abzug_id) : null;
      return { id: v.id, art: a ? a.art : "rueckforderung", grund: a ? a.grund : `Buchung ${korrById.get(v.korrektur_id ?? 0)?.buchung_id ?? ""}`, betrag_cent: v.betrag_cent };
    });
    const meineKorr = (korr || []).filter((k) => k.anbieter_id === owner);
    const korrekturen: WochenEingabe["korrekturen"] = meineKorr.map((k) => ({ id: k.id, buchung: `Teilbestellung ${k.buchung_id ?? ""}`, umsatz_cent: k.umsatz_cent, provision_netto_cent: k.provision_netto_cent }));
    const offen =
      (abz || []).filter((a) => a.anbieter_id === owner).reduce((n, a) => n + Math.max(0, a.betrag_cent - a.verrechnet_cent), 0) +
      meineKorr.reduce((n, k) => n + Math.max(0, k.rueckforderung_cent - k.verrechnet_cent), 0);

    const w = wochenabrechnung({ anbieter, plattform: plattform(), von, bis, posten, einbehaltFrei, verrechnungen, korrekturen, offen_cent: offen });
    if (!w) continue;
    const { data: res } = await db.rpc("wochenabrechnung_buchen", {
      p: {
        anbieter_id: owner,
        zeitraum_von: von,
        zeitraum_bis: bis,
        payout_ids: meine.map((p) => p.id),
        einbehalt_ids: einbehaltFrei.map((x) => x.payout_id),
        verrechnung_ids: meineVerr.map((v) => v.id),
        korrektur_ids: meineKorr.map((k) => k.id),
        provisionsrechnung: w.provisionsrechnung,
        abrechnung: w.abrechnung,
        summen: w.summen,
      },
    });
    const r = res as { status: string; provisionsrechnung_id?: number | null; abrechnung_id?: number } | null;
    if (!r) continue;
    if (r.status === "gesperrt") {
      out.gesperrt++;
      continue;
    }
    if (r.status !== "neu") {
      out.vorhanden++;
      continue;
    }
    out.neu++;
    /* Rundungsausgleich USt (Wochensumme vs. je Auftrag) mit der nächsten Auszahlung */
    if (w.summen.rundung_cent)
      await db.from("anbieter_abzuege").insert({ anbieter_id: owner, art: "sonstiges", betrag_cent: -w.summen.rundung_cent, grund: `Rundungsausgleich USt Provisionsrechnung ${von} – ${bis}` });
    /* PDFs ablegen und an den Anbieter schicken */
    const anhaenge: { filename: string; content: string }[] = [];
    for (const id of [r.provisionsrechnung_id, r.abrechnung_id].filter((x): x is number => !!x)) {
      const { data: b } = await db.from("belege").select("*").eq("id", id).single();
      if (!b) continue;
      const voll = await alsEntwurf(db, b);
      let pdf = await belegPdf(voll);
      let xml: string | null = null;
      if (b.e_rechnung_erforderlich) {
        xml = xrechnungCii(voll);
        pdf = await pdfMitXml(pdf, xml);
      }
      await db.storage.from("belege").upload(ablagePfad(b, "pdf"), pdf, { contentType: "application/pdf", upsert: false });
      if (xml) await db.storage.from("belege").upload(ablagePfad(b, "xml"), new TextEncoder().encode(xml), { contentType: "application/xml", upsert: false });
      await db.from("belege").update({ pdf_pfad: ablagePfad(b, "pdf"), sha256: await sha256Hex(pdf), ...(xml ? { xml_pfad: ablagePfad(b, "xml") } : {}) }).eq("id", b.id).is("sha256", null);
      anhaenge.push({ filename: `${b.nummer}.pdf`, content: base64(pdf) });
    }
    const to = anbieter.email;
    if (to && anhaenge.length)
      await sendMail(
        to,
        `Deine Showly-Abrechnung ${tag(von)} – ${tag(bis)}`,
        [
          `In dieser Woche haben wir dir ${euro(w.summen.auszahlung_cent)} überwiesen. Provision: ${euro(w.summen.provision_netto_cent)} netto zzgl. ${euro(w.summen.provision_steuer_cent)} USt.`,
          ...(w.summen.vortrag_cent < 0 ? [`Noch offen und mit den nächsten Auszahlungen verrechnet: ${euro(-w.summen.vortrag_cent)}.`] : []),
          "Provisionsrechnung und Auszahlungsabrechnung findest du im Anhang und in deinem Konto unter „Zahlungen“.",
        ],
        anhaenge,
      ).catch(() => false);
    void row;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Storno durch die Verwaltung: stornieren(buchung, betrag?, grund, gebühr?) */
/* ------------------------------------------------------------------ */

/** Erstattet an den Kunden und erstellt Storno- bzw. Korrekturbeleg.
 *  Ohne Betrag: alles, was noch nicht erstattet ist. Mit Stornogebühr:
 *  Original wird storniert, neuer Beleg nur über die Gebühr.
 *  `buchungId` ist die Teilbestellung des Anbieters (sub_orders.id). */
export async function stornieren(
  buchungId: number,
  betragCent: number | undefined,
  grund: string,
  stornogebuehrCent?: number,
): Promise<{ ok: true; erstattet: number } | { error: string }> {
  const db = adminClient();
  const { data: sub } = await db.from("sub_orders").select("*").eq("id", buchungId).maybeSingle();
  if (!sub) return { error: "Buchung nicht gefunden" };
  const gebuehr = Math.max(0, Math.round(stornogebuehrCent ?? 0));
  let erstattet = 0;

  if (sub.provider_kind === "artist") {
    const { refundBooking } = await import("./money.server");
    const { data: bks } = await db.from("bookings").select("*").eq("sub_order_id", sub.id).eq("paid", true).order("day");
    const offen = (bks || []).map((b) => ({ id: b.id, rest: b.amount_cents - b.refunded_cents })).filter((b) => b.rest > 0);
    let ziel = betragCent ?? offen.reduce((n, b) => n + b.rest, 0) - gebuehr;
    for (const b of offen) {
      if (ziel <= 0) break;
      const cents = Math.min(b.rest, ziel);
      const r = await refundBooking(b.id, { cents, reason: grund, stornogebuehr: gebuehr > 0 && offen.length === 1 });
      if ("error" in r) return r;
      erstattet += r.cents;
      ziel -= r.cents;
    }
    return { ok: true, erstattet };
  }

  if (sub.provider_kind === "baker") {
    const { refundSweet } = await import("./wishcake.server");
    const { data: sw } = await db.from("sweet_requests").select("*").eq("sub_order_id", sub.id).order("day");
    const offen = (sw || []).map((r) => ({ id: r.id, rest: (r.paid_cents ?? 0) - (r.refunded_cents ?? 0) })).filter((r) => r.rest > 0);
    let ziel = betragCent ?? offen.reduce((n, r) => n + r.rest, 0) - gebuehr;
    for (const r of offen) {
      if (ziel <= 0) break;
      const res = await refundSweet(r.id, Math.min(r.rest, ziel), grund);
      if ("error" in res) return res;
      erstattet += res.cents;
      ziel -= res.cents;
      if (res.cents >= r.rest) await db.from("sweet_requests").update({ status: "cancelled" }).eq("id", r.id);
    }
    return { ok: true, erstattet };
  }

  /* Deko und Kostüme: über die Zahlung der Bestellung erstatten (ohne Kaution) */
  const { data: so } = await db.from("shop_orders").select("*").eq("sub_order_id", sub.id).maybeSingle();
  const { data: order } = await db.from("orders").select("stripe_session_id").eq("id", sub.order_id).maybeSingle();
  if (!so || !order?.stripe_session_id) return { error: "Keine Zahlung zu dieser Bestellung" };
  const ware = so.total_cents - (so.deposit_cents ?? 0);
  const rest = ware - (sub.erstattet_cent ?? 0);
  const cents = Math.min(rest, betragCent ?? rest - gebuehr);
  if (cents <= 0) return { error: "Nichts mehr zu erstatten" };
  const { stripeEnv } = await import("./money.server");
  const { createStripeClient, getStripeErrorMessage } = await import("./stripe.server");
  try {
    const env = stripeEnv();
    const s = await createStripeClient(env).checkout.sessions.retrieve(order.stripe_session_id);
    const pi = typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id;
    if (!pi) return { error: "Keine Zahlung zu dieser Bestellung" };
    await createStripeClient(env).refunds.create(
      { payment_intent: pi, amount: cents, metadata: { sub_order_id: String(sub.id), kind: "storno" } },
      { idempotencyKey: `storno-${sub.id}-${sub.erstattet_cent ?? 0}-${cents}` },
    );
  } catch (e) {
    return { error: getStripeErrorMessage(e) };
  }
  const { data: po } = await db.from("payouts").select("id").eq("sub_order_id", sub.id).maybeSingle();
  await erstattungVerbuchen({
    subOrderId: sub.id,
    cents,
    grund,
    ref: `shop:${sub.id}:${sub.erstattet_cent ?? 0}`,
    ...(gebuehr > 0 ? { stornogebuehrCent: gebuehr } : {}),
    payoutId: po?.id ?? null,
  });
  /* Vor der Auszahlung: Anteil des Anbieters anteilig kürzen */
  if (po?.id) {
    const { data: p } = await db.from("payouts").select("*").eq("id", po.id).maybeSingle();
    if (p && p.status === "scheduled" && p.gross_cents > 0) {
      const { provisionFelder } = await import("@/showly/cloudRules");
      const rest2 = Math.max(0, p.gross_cents - (p.erstattet_cent ?? 0));
      const fee = Math.round((rest2 * (p.provision_bp ?? 2000)) / 10000);
      await db.from("payouts").update({ ...provisionFelder(rest2, fee), fee_cents: fee }).eq("id", p.id);
    }
  }
  return { ok: true, erstattet: cents };
}
