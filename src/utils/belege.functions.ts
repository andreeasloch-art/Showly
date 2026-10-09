/* Belege in der App: Kunden und Anbieter sehen ihre Belege, Anbieter
 * pflegen Steuer- und DAC7-Daten, laden ein Jahr als ZIP; die Verwaltung
 * legt Abzüge an, storniert, exportiert DATEV und DAC7. */
import { createServerFn } from "@tanstack/react-start";
import { adminClient, requireUser } from "@/lib/supabase.server";
import { TOO_MANY, allow, requireAdmin } from "@/lib/guard.server";
import type { AnbieterRow, AuszahlungRow, BelegRow } from "@/lib/database.types";

async function me() {
  try {
    return await requireUser();
  } catch {
    return null;
  }
}
async function admin() {
  try {
    return await requireAdmin();
  } catch {
    return null;
  }
}
const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export type BelegKurz = Pick<
  BelegRow,
  "id" | "art" | "nummer" | "belegdatum" | "brutto_cent" | "leistung_von" | "leistung_bis" | "aussteller_typ" | "e_rechnung_erforderlich" | "anbieter_id" | "kunde_id"
> & { rolle: "kunde" | "anbieter"; name: string };

/** Eigene Belege: als Kunde (Rechnungen, Quittungen, Storno) und als Anbieter
 *  (im eigenen Namen ausgestellt, Provisionsrechnungen, Abrechnungen) */
export const meineBelege = createServerFn({ method: "POST" })
  .inputValidator((d: { jahr?: number }) => ({ jahr: Number.isInteger(d?.jahr) ? d.jahr! : null }))
  .handler(async ({ data }): Promise<{ belege: BelegKurz[]; abrechnungen: AuszahlungRow[] } | { error: string }> => {
    const ctx = await me();
    if (!ctx) return { error: "Bitte melde dich an" };
    const db = adminClient();
    let q = db
      .from("belege")
      .select("id, art, nummer, belegdatum, brutto_cent, leistung_von, leistung_bis, aussteller_typ, e_rechnung_erforderlich, anbieter_id, kunde_id, aussteller_snapshot, empfaenger_snapshot")
      .or(`kunde_id.eq.${ctx.user.id},anbieter_id.eq.${ctx.user.id}`)
      .order("erstellt_am", { ascending: false })
      .limit(500);
    if (data.jahr) q = q.eq("jahr", data.jahr);
    const { data: rows } = await q;
    const { data: ab } = await db.from("auszahlungen").select("*").eq("anbieter_id", ctx.user.id).order("zeitraum_bis", { ascending: false }).limit(60);
    return {
      belege: (rows || [])
        /* Kunden sehen keine Provisions- und Auszahlungsbelege anderer */
        .filter((b) => b.anbieter_id === ctx.user.id || !["provisionsrechnung", "auszahlungsabrechnung"].includes(b.art))
        .map((b) => {
          const rolle = b.kunde_id === ctx.user.id ? ("kunde" as const) : ("anbieter" as const);
          const gegen = (rolle === "kunde" ? b.aussteller_snapshot : b.empfaenger_snapshot) as { name?: string; firma?: string; leistung_von_name?: string };
          return {
            id: b.id,
            art: b.art,
            nummer: b.nummer,
            belegdatum: b.belegdatum,
            brutto_cent: b.brutto_cent,
            leistung_von: b.leistung_von,
            leistung_bis: b.leistung_bis,
            aussteller_typ: b.aussteller_typ,
            e_rechnung_erforderlich: b.e_rechnung_erforderlich,
            anbieter_id: b.anbieter_id,
            kunde_id: b.kunde_id,
            rolle,
            name: String(gegen?.leistung_von_name || gegen?.firma || gegen?.name || ""),
          };
        }),
      abrechnungen: (ab || []) as AuszahlungRow[],
    };
  });

/** Kurz gültiger Link zum PDF bzw. zur E-Rechnung eines eigenen Belegs */
export const belegLink = createServerFn({ method: "POST" })
  .inputValidator((d: { id: number; xml?: boolean }) => ({ id: Math.trunc(Number(d?.id)) || 0, xml: !!d?.xml }))
  .handler(async ({ data }): Promise<{ url: string } | { error: string }> => {
    const ctx = await me();
    if (!ctx) return { error: "Bitte melde dich an" };
    const db = adminClient();
    const { data: b } = await db.from("belege").select("anbieter_id, kunde_id, pdf_pfad, xml_pfad, art").eq("id", data.id).maybeSingle();
    const darf = b && (b.anbieter_id === ctx.user.id || (b.kunde_id === ctx.user.id && !["provisionsrechnung", "auszahlungsabrechnung"].includes(b.art)) || ctx.profile?.role === "admin");
    if (!b || !darf) return { error: "Keine Berechtigung" };
    const pfad = data.xml ? b.xml_pfad : b.pdf_pfad;
    if (!pfad) return { error: "Der Beleg wird gerade erstellt. Bitte gleich noch einmal versuchen." };
    const { data: u } = await db.storage.from("belege").createSignedUrl(pfad, 300, { download: true });
    return u?.signedUrl ? { url: u.signedUrl } : { error: "Datei nicht gefunden" };
  });

/** Alle Belege eines Jahres als ZIP (für Anbieter und ihre Steuerberatung) */
export const belegeZip = createServerFn({ method: "POST" })
  .inputValidator((d: { jahr: number }) => ({ jahr: Math.min(2100, Math.max(2024, Math.trunc(Number(d?.jahr)) || new Date().getFullYear())) }))
  .handler(async ({ data }): Promise<{ filename: string; base64: string; anzahl: number } | { error: string }> => {
    const ctx = await me();
    if (!ctx) return { error: "Bitte melde dich an" };
    if (!(await allow("action", ctx.user.id))) return { error: TOO_MANY };
    const db = adminClient();
    const { data: rows } = await db.from("belege").select("nummer, pdf_pfad, xml_pfad").eq("anbieter_id", ctx.user.id).eq("jahr", data.jahr).limit(2000);
    const { zipSync } = await import("fflate");
    const files: Record<string, Uint8Array> = {};
    for (const r of rows || []) {
      for (const pfad of [r.pdf_pfad, r.xml_pfad].filter((x): x is string => !!x)) {
        const { data: blob } = await db.storage.from("belege").download(pfad);
        if (blob) files[pfad.split("/").pop()!] = new Uint8Array(await blob.arrayBuffer());
      }
    }
    if (!Object.keys(files).length) return { error: `Für ${data.jahr} gibt es noch keine Belege.` };
    const zip = zipSync(files, { level: 6 });
    const { base64 } = await import("@/lib/mail.server");
    return { filename: `Showly-Belege-${data.jahr}.zip`, base64: base64(zip), anzahl: (rows || []).length };
  });

/* ------------------------------------------------------------------ */
/* Steuer- und DAC7-Daten                                              */
/* ------------------------------------------------------------------ */

export type Steuerdaten = Pick<
  AnbieterRow,
  "typ" | "name" | "firma" | "strasse" | "plz" | "ort" | "land" | "steuernummer" | "ust_id" | "handelsregister" | "ust_satz_standard" | "geburtsdatum" | "steuer_id" | "iban"
> & { rechnung_praefix: string | null; gesperrt: boolean; fehlt: string[]; umsatz_jahr_cent: number; buchungen_jahr: number; hinweis_gewerbe: boolean };

export const steuerdatenLaden = createServerFn({ method: "POST" }).handler(async (): Promise<Steuerdaten | { error: string }> => {
  const ctx = await me();
  if (!ctx) return { error: "Bitte melde dich an" };
  const db = adminClient();
  const { anbieterLaden } = await import("@/lib/belege.server");
  const { row } = await anbieterLaden(db, ctx.user.id);
  const { steuerdatenFehlen } = await import("@/showly/belege");
  return {
    typ: row.typ,
    name: row.name,
    firma: row.firma,
    strasse: row.strasse,
    plz: row.plz,
    ort: row.ort,
    land: row.land,
    steuernummer: row.steuernummer,
    ust_id: row.ust_id,
    handelsregister: row.handelsregister,
    ust_satz_standard: row.ust_satz_standard,
    geburtsdatum: row.geburtsdatum,
    steuer_id: row.steuer_id,
    /* IBAN nur maskiert zurück */
    iban: row.iban ? `${row.iban.slice(0, 4)} •••• ${row.iban.slice(-4)}` : null,
    rechnung_praefix: row.rechnung_praefix,
    gesperrt: row.auszahlungen_gesperrt,
    fehlt: steuerdatenFehlen(row),
    umsatz_jahr_cent: row.umsatz_jahr_cent,
    buchungen_jahr: row.buchungen_jahr,
    hinweis_gewerbe: row.hinweis_gewerbe,
  };
});

export const steuerdatenSpeichern = createServerFn({ method: "POST" })
  .inputValidator((d: Record<string, unknown>) => ({
    typ: d["typ"] === "gewerblich" || d["typ"] === "kleinunternehmer" ? (d["typ"] as "gewerblich" | "kleinunternehmer") : ("privat" as const),
    name: s(d["name"], 120),
    firma: s(d["firma"], 160),
    strasse: s(d["strasse"], 160),
    plz: s(d["plz"], 10),
    ort: s(d["ort"], 80),
    land: (s(d["land"], 2) || "DE").toUpperCase(),
    steuernummer: s(d["steuernummer"], 30),
    ust_id: s(d["ust_id"], 20).replace(/\s/g, "").toUpperCase(),
    handelsregister: s(d["handelsregister"], 120),
    ust_satz_standard: Number(d["ust_satz_standard"]) === 7 ? 7 : 19,
    geburtsdatum: /^\d{4}-\d{2}-\d{2}$/.test(String(d["geburtsdatum"])) ? String(d["geburtsdatum"]) : "",
    steuer_id: s(d["steuer_id"], 14).replace(/\s/g, ""),
    /* leer oder maskiert = unverändert */
    iban: s(d["iban"], 40).replace(/\s/g, "").toUpperCase(),
  }))
  .handler(async ({ data }): Promise<{ ok: true; fehlt: string[] } | { error: string }> => {
    const ctx = await me();
    if (!ctx) return { error: "Bitte melde dich an" };
    if (!(await allow("action", ctx.user.id))) return { error: TOO_MANY };
    const db = adminClient();
    const { anbieterLaden } = await import("@/lib/belege.server");
    const { row } = await anbieterLaden(db, ctx.user.id);
    const { isValidIban } = await import("@/showly/booking");
    const { steuerdatenFehlen, ustIdGueltig } = await import("@/showly/belege");
    if (data.iban && !data.iban.includes("•") && !isValidIban(data.iban)) return { error: "Die IBAN stimmt nicht." };
    if (data.ust_id && !ustIdGueltig(data.ust_id)) return { error: "Die USt-IdNr. hat nicht das richtige Format (z. B. DE123456789)." };
    const next = {
      typ: data.typ,
      name: data.name || null,
      firma: data.firma || null,
      strasse: data.strasse || null,
      plz: data.plz || null,
      ort: data.ort || null,
      land: data.land,
      steuernummer: data.steuernummer || null,
      ust_id: data.ust_id || null,
      handelsregister: data.handelsregister || null,
      ust_satz_standard: data.typ === "gewerblich" ? data.ust_satz_standard : 19,
      geburtsdatum: data.geburtsdatum || null,
      steuer_id: data.steuer_id || null,
      iban: data.iban && !data.iban.includes("•") ? data.iban : row.iban,
    };
    const fehlt = steuerdatenFehlen(next);
    /* Von der Verwaltung gesperrt (sperrgrund) bleibt gesperrt */
    const gesperrt = fehlt.length > 0 || !!row.sperrgrund;
    const { error } = await db
      .from("anbieter")
      .update({ ...next, auszahlungen_gesperrt: gesperrt, updated_at: new Date().toISOString() })
      .eq("id", ctx.user.id);
    if (error) return { error: "Speichern hat nicht geklappt" };
    if (next.typ !== "privat") await db.rpc("anbieter_praefix", { p_id: ctx.user.id }).then(undefined, () => null);
    return { ok: true, fehlt };
  });

/* ------------------------------------------------------------------ */
/* Verwaltung                                                          */
/* ------------------------------------------------------------------ */

/** Strafgebühr, Schaden oder sonstigen Abzug anlegen (ohne USt); wird mit
 *  der nächsten Auszahlung verrechnet und in der Wochenabrechnung gezeigt */
export const adminAbzug = createServerFn({ method: "POST" })
  .inputValidator((d: { anbieter: string; art: string; betragCent: number; grund: string; buchungId?: number }) => ({
    anbieter: s(d?.anbieter, 200),
    art: d?.art === "schaden" || d?.art === "sonstiges" ? d.art : ("strafgebuehr" as const),
    betragCent: Math.min(10_000_000, Math.max(1, Math.round(Number(d?.betragCent)) || 0)),
    grund: s(d?.grund, 300),
    buchungId: Number.isInteger(d?.buchungId) ? d.buchungId! : null,
  }))
  .handler(async ({ data }): Promise<{ ok: true } | { error: string }> => {
    const ctx = await admin();
    if (!ctx) return { error: "Keine Berechtigung" };
    if (!data.grund) return { error: "Bitte einen Grund angeben" };
    const db = adminClient();
    /* Anbieter per E-Mail oder Kennung */
    let id = /^[0-9a-f-]{36}$/i.test(data.anbieter) ? data.anbieter : null;
    if (!id) id = (await db.from("profiles").select("id").eq("email", data.anbieter.toLowerCase()).maybeSingle()).data?.id ?? null;
    if (!id) return { error: "Anbieter nicht gefunden" };
    const { error } = await db.from("anbieter_abzuege").insert({
      anbieter_id: id,
      art: data.art as "strafgebuehr" | "schaden" | "sonstiges",
      betrag_cent: data.betragCent,
      grund: data.grund,
      buchung_id: data.buchungId,
      erstellt_von: ctx.user.id,
    });
    if (error) return { error: "Speichern hat nicht geklappt" };
    await db.from("admin_audit").insert({ actor: ctx.user.id, action: "abzug", target: id, detail: data as unknown as Record<string, unknown> });
    return { ok: true };
  });

/** Buchung (Teilbestellung) ganz oder teilweise stornieren, ggf. mit Stornogebühr */
export const adminStornieren = createServerFn({ method: "POST" })
  .inputValidator((d: { buchungId: number; betragCent?: number; grund: string; stornogebuehrCent?: number }) => ({
    buchungId: Math.trunc(Number(d?.buchungId)) || 0,
    betragCent: d?.betragCent ? Math.max(1, Math.round(Number(d.betragCent))) : undefined,
    grund: s(d?.grund, 300) || "Storno",
    stornogebuehrCent: d?.stornogebuehrCent ? Math.max(0, Math.round(Number(d.stornogebuehrCent))) : undefined,
  }))
  .handler(async ({ data }): Promise<{ ok: true; erstattet: number } | { error: string }> => {
    const ctx = await admin();
    if (!ctx) return { error: "Keine Berechtigung" };
    const { stornieren } = await import("@/lib/belege.server");
    const r = await stornieren(data.buchungId, data.betragCent, data.grund, data.stornogebuehrCent);
    await adminClient().from("admin_audit").insert({ actor: ctx.user.id, action: "storno", target: String(data.buchungId), detail: data as unknown as Record<string, unknown> });
    return r;
  });

/** DATEV-Buchungsstapel aller Provisionsrechnungen eines Jahres */
export const adminDatev = createServerFn({ method: "POST" })
  .inputValidator((d: { jahr: number }) => ({ jahr: Math.trunc(Number(d?.jahr)) || new Date().getFullYear() }))
  .handler(async ({ data }): Promise<{ filename: string; csv: string } | { error: string }> => {
    const ctx = await admin();
    if (!ctx) return { error: "Keine Berechtigung" };
    const db = adminClient();
    const { data: rows } = await db.from("belege").select("nummer, belegdatum, brutto_cent, art, empfaenger_snapshot").eq("art", "provisionsrechnung").eq("jahr", data.jahr).order("laufnummer");
    const { datevCsv } = await import("@/showly/belege");
    const csv = datevCsv(
      (rows || []).map((r) => ({
        nummer: r.nummer,
        belegdatum: r.belegdatum,
        brutto_cent: r.brutto_cent,
        art: r.art,
        empfaenger: String((r.empfaenger_snapshot as { firma?: string; name?: string }).firma || (r.empfaenger_snapshot as { name?: string }).name || ""),
      })),
      {
        beraternummer: process.env["DATEV_BERATER"] || "1001",
        mandantennummer: process.env["DATEV_MANDANT"] || "1",
        erloese: process.env["DATEV_ERLOESKONTO"] || "8400",
        debitor: process.env["DATEV_DEBITOR"] || "10000",
      },
      data.jahr,
    );
    return { filename: `EXTF_Showly_Provisionen_${data.jahr}.csv`, csv: "﻿" + csv };
  });

/** DAC7: Anbieter mit Umsätzen eines Jahres und ihren Meldedaten (Grundlage
 *  für die Meldung an das BZSt bis 31.1. des Folgejahres) */
export const adminDac7 = createServerFn({ method: "POST" })
  .inputValidator((d: { jahr: number }) => ({ jahr: Math.trunc(Number(d?.jahr)) || new Date().getFullYear() - 1 }))
  .handler(async ({ data }): Promise<{ filename: string; csv: string } | { error: string }> => {
    const ctx = await admin();
    if (!ctx) return { error: "Keine Berechtigung" };
    const db = adminClient();
    const { data: belege } = await db.from("belege").select("anbieter_id, art, brutto_cent, belegdatum").eq("jahr", data.jahr).in("art", ["rechnung", "quittung", "storno", "korrektur"]).limit(100000);
    const { data: pr } = await db.from("belege").select("anbieter_id, brutto_cent").eq("jahr", data.jahr).eq("art", "provisionsrechnung").limit(100000);
    const sum = new Map<string, { umsatz: number; anzahl: number; quartal: number[]; provision: number }>();
    for (const b of belege || []) {
      if (!b.anbieter_id) continue;
      const x = sum.get(b.anbieter_id) ?? { umsatz: 0, anzahl: 0, quartal: [0, 0, 0, 0], provision: 0 };
      x.umsatz += b.brutto_cent;
      if (b.art === "rechnung" || b.art === "quittung") x.anzahl++;
      x.quartal[Math.floor((Number(b.belegdatum.slice(5, 7)) - 1) / 3)]! += b.brutto_cent;
      sum.set(b.anbieter_id, x);
    }
    for (const p of pr || []) if (p.anbieter_id && sum.has(p.anbieter_id)) sum.get(p.anbieter_id)!.provision += p.brutto_cent;
    const ids = [...sum.keys()];
    const { data: an } = ids.length ? await db.from("anbieter").select("*").in("id", ids) : { data: [] };
    const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const eur = (c: number) => (c / 100).toFixed(2).replace(".", ",");
    const kopf = ["Typ", "Name", "Firma", "Strasse", "PLZ", "Ort", "Land", "Geburtsdatum", "Steuer-ID", "Steuernummer", "USt-IdNr", "Handelsregister", "IBAN", "Anzahl Verkäufe", "Umsatz Q1", "Umsatz Q2", "Umsatz Q3", "Umsatz Q4", "Umsatz gesamt", "Provision und Gebühren", "Meldepflichtig (ab 30 Verkäufen oder 2.000 €)"];
    const zeilen = (an || []).map((a) => {
      const x = sum.get(a.id)!;
      const melde = x.anzahl >= 30 || x.umsatz >= 200000;
      return [a.typ, a.name, a.firma, a.strasse, a.plz, a.ort, a.land, a.geburtsdatum, a.steuer_id, a.steuernummer, a.ust_id, a.handelsregister, a.iban, x.anzahl, ...x.quartal.map(eur), eur(x.umsatz), eur(x.provision), melde ? "ja" : "nein"]
        .map(q)
        .join(";");
    });
    return { filename: `DAC7_Showly_${data.jahr}.csv`, csv: "﻿" + [kopf.map(q).join(";"), ...zeilen].join("\r\n") + "\r\n" };
  });

/** Wochenabrechnung sofort ausführen (für die Vorwoche; nichts doppelt) */
export const adminWoche = createServerFn({ method: "POST" }).handler(async (): Promise<{ ok: true; result: { neu: number; gesperrt: number; vorhanden: number } } | { error: string }> => {
  const ctx = await admin();
  if (!ctx) return { error: "Keine Berechtigung" };
  const { wochenabrechnungAlle } = await import("@/lib/belege.server");
  return { ok: true, result: await wochenabrechnungAlle() };
});
