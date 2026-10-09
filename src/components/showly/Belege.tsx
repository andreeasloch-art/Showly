/* Belege im Konto (Kunden und Anbieter), Steuer- und DAC7-Daten der
 * Anbieter, Jahres-ZIP. Serverseite: utils/belege.functions.ts. */
import { useCallback, useEffect, useState } from "react";
import { useShowly } from "@/showly/store";
import { Icon } from "@/showly/ui";
import type { BelegKurz, Steuerdaten } from "@/utils/belege.functions";
import type { AuszahlungRow } from "@/lib/database.types";

const ART: Record<string, string> = {
  rechnung: "Rechnung",
  quittung: "Buchungsquittung",
  storno: "Storno",
  korrektur: "Korrektur",
  kaution: "Kaution",
  provisionsrechnung: "Provisionsrechnung",
  auszahlungsabrechnung: "Auszahlungsabrechnung",
};

function herunterladen(name: string, base64: string, typ: string) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: typ }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

/** Liste aller eigenen Belege; `anbieter` zeigt zusätzlich Wochenabrechnungen und ZIP */
export function BelegeListe({ anbieter = false }: { anbieter?: boolean }) {
  const { cloudOn, fmt, fmtDate, toast } = useShowly();
  const [jahr, setJahr] = useState(new Date().getFullYear());
  const [belege, setBelege] = useState<BelegKurz[] | null>(null);
  const [abr, setAbr] = useState<AuszahlungRow[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!cloudOn) return;
    const { meineBelege } = await import("@/utils/belege.functions");
    const r = await meineBelege({ data: { jahr } }).catch(() => null);
    if (r && !("error" in r)) {
      setBelege(r.belege.filter((b) => (anbieter ? b.rolle === "anbieter" : b.rolle === "kunde")));
      setAbr(r.abrechnungen);
    }
  }, [cloudOn, jahr, anbieter]);
  useEffect(() => {
    void load();
  }, [load]);

  async function oeffnen(id: number, xml = false) {
    const { belegLink } = await import("@/utils/belege.functions");
    const r = await belegLink({ data: { id, xml } }).catch(() => ({ error: "Hat nicht geklappt" }));
    if ("error" in r) return toast(r.error);
    window.open(r.url, "_blank", "noopener");
  }

  async function zip() {
    setBusy(true);
    const { belegeZip } = await import("@/utils/belege.functions");
    const r = await belegeZip({ data: { jahr } }).catch(() => ({ error: "Hat nicht geklappt" }));
    setBusy(false);
    if ("error" in r) return toast(r.error);
    herunterladen(r.filename, r.base64, "application/zip");
  }

  return (
    <section className="dash26-panel belege">
      <div className="dash26-panel-head">
        <h3>{anbieter ? "Belege und Abrechnungen" : "Rechnungen und Belege"}</h3>
        <select value={jahr} onChange={(e) => setJahr(Number(e.target.value))} aria-label="Jahr">
          {[0, 1, 2].map((k) => {
            const y = new Date().getFullYear() - k;
            return (
              <option key={y} value={y}>
                {y}
              </option>
            );
          })}
        </select>
      </div>
      {!cloudOn ? (
        <p className="fair-muted">
          Nach jeder bezahlten Buchung kommt der Beleg als PDF per E-Mail und steht hier zum Download bereit. In der Vorschau ohne Konto gibt es noch keine Belege.
        </p>
      ) : belege === null ? (
        <p className="fair-muted">Wird geladen …</p>
      ) : (
        <>
          {anbieter && abr.length > 0 && (
            <>
              <h4 className="belege-h">Wöchentliche Abrechnung</h4>
              <ul className="belege-list">
                {abr.map((a) => (
                  <li key={a.id}>
                    <span>
                      <b>
                        {fmtDate(a.zeitraum_von)} – {fmtDate(a.zeitraum_bis)}
                      </b>
                      <small>
                        Umsatz {fmt(a.umsatz_brutto_cent / 100)} · Provision {fmt(a.provision_brutto_cent / 100)} brutto
                        {a.abzuege_cent ? ` · Abzüge ${fmt(a.abzuege_cent / 100)}` : ""}
                        {a.vortrag_cent < 0 ? ` · offen ${fmt(-a.vortrag_cent / 100)}` : ""}
                      </small>
                    </span>
                    <b>{fmt(a.auszahlung_cent / 100)}</b>
                    <span className="belege-btns">
                      {a.provisionsrechnung_id && (
                        <button type="button" className="dash26-mini outline" onClick={() => void oeffnen(a.provisionsrechnung_id!)}>
                          Provision
                        </button>
                      )}
                      {a.abrechnung_id && (
                        <button type="button" className="dash26-mini outline" onClick={() => void oeffnen(a.abrechnung_id!)}>
                          Abrechnung
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              <h4 className="belege-h">Belege an deine Kunden</h4>
            </>
          )}
          {belege.length ? (
            <ul className="belege-list">
              {belege.map((b) => (
                <li key={b.id}>
                  <span>
                    <b>
                      {ART[b.art] ?? b.art} {b.nummer}
                    </b>
                    <small>
                      {fmtDate(b.belegdatum)}
                      {b.name ? ` · ${b.name}` : ""}
                      {b.leistung_von ? ` · Leistung ${fmtDate(b.leistung_von)}${b.leistung_bis && b.leistung_bis !== b.leistung_von ? ` – ${fmtDate(b.leistung_bis)}` : ""}` : ""}
                    </small>
                  </span>
                  <b className={b.brutto_cent < 0 ? "minus" : ""}>{fmt(b.brutto_cent / 100)}</b>
                  <span className="belege-btns">
                    <button type="button" className="dash26-mini outline" onClick={() => void oeffnen(b.id)}>
                      <Icon name="clipboard" /> PDF
                    </button>
                    {b.e_rechnung_erforderlich && (
                      <button type="button" className="dash26-mini outline" onClick={() => void oeffnen(b.id, true)}>
                        E-Rechnung
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="fair-muted">Für {jahr} gibt es noch keine Belege.</p>
          )}
          {anbieter && (
            <button type="button" className="dash26-mini" disabled={busy} onClick={() => void zip()}>
              <Icon name="clipboard" /> Alle Belege {jahr} als ZIP (für die Steuerberatung)
            </button>
          )}
        </>
      )}
    </section>
  );
}

/** Steuer- und Rechnungsdaten (auch für die DAC7-Meldung). Ohne vollständige
 *  Angaben zahlt Showly nicht aus. */
export function SteuerdatenForm() {
  const { cloudOn, toast, fmt } = useShowly();
  const [d, setD] = useState<Steuerdaten | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!cloudOn) return;
    void (async () => {
      const { steuerdatenLaden } = await import("@/utils/belege.functions");
      const r = await steuerdatenLaden().catch(() => null);
      if (r && !("error" in r)) setD(r);
    })();
  }, [cloudOn]);

  if (!cloudOn)
    return (
      <section className="dash26-panel">
        <div className="dash26-panel-head">
          <h3>Steuer- und Rechnungsdaten</h3>
        </div>
        <p className="fair-muted">
          Mit Konto trägst du hier ein, ob du privat, als Kleinunternehmer oder gewerblich anbietest, dazu Anschrift und Steuerdaten. Daraus erstellt Showly die Rechnungen
          in deinem Namen. Ohne vollständige Angaben gibt es keine Auszahlung (Meldepflicht nach dem Plattformen-Steuertransparenzgesetz).
        </p>
      </section>
    );
  if (!d) return null;
  const set = (k: keyof Steuerdaten) => (e: { target: { value: string } }) => setD({ ...d, [k]: e.target.value } as Steuerdaten);

  async function speichern() {
    if (!d) return;
    setBusy(true);
    const { steuerdatenSpeichern } = await import("@/utils/belege.functions");
    const r = await steuerdatenSpeichern({ data: d as unknown as Record<string, unknown> }).catch(() => ({ error: "Hat nicht geklappt" }));
    setBusy(false);
    if ("error" in r) return toast(r.error);
    setD({ ...d, fehlt: r.fehlt, gesperrt: r.fehlt.length > 0 });
    toast(r.fehlt.length ? `Gespeichert. Es fehlt noch: ${r.fehlt.join(", ")}` : "Gespeichert. Auszahlungen sind freigegeben.");
  }

  return (
    <section className="dash26-panel steuer">
      <div className="dash26-panel-head">
        <h3>Steuer- und Rechnungsdaten</h3>
      </div>
      {d.fehlt.length > 0 ? (
        <p className="ov-warn" role="alert">
          <Icon name="lock" /> Auszahlungen sind angehalten, bis alles vollständig ist. Es fehlt: {d.fehlt.join(", ")}.
        </p>
      ) : (
        <p className="fair-muted">Vollständig. {d.rechnung_praefix ? `Deine Rechnungsnummern beginnen mit ${d.rechnung_praefix}.` : ""}</p>
      )}
      {d.hinweis_gewerbe && d.typ === "privat" && (
        <p className="ov-warn">
          Du hattest dieses Jahr schon {d.buchungen_jahr} Buchungen bzw. {fmt(d.umsatz_jahr_cent / 100)} Umsatz. Bitte prüfe, ob du ein Gewerbe anmelden musst, und stelle dann
          auf Kleinunternehmer oder gewerblich um.
        </p>
      )}
      <div className="steuer-typ" role="radiogroup" aria-label="Wie bietest du an?">
        {(
          [
            ["privat", "Privat", "Gelegentlich, ohne Gewerbe. Kunden bekommen eine Buchungsquittung von Showly."],
            ["kleinunternehmer", "Kleinunternehmer", "Mit Gewerbe, ohne Umsatzsteuer (§ 19 UStG). Rechnung in deinem Namen."],
            ["gewerblich", "Gewerblich", "Mit Umsatzsteuer (19 % oder 7 %). Rechnung in deinem Namen."],
          ] as const
        ).map(([k, t, p]) => (
          <button type="button" key={k} role="radio" aria-checked={d.typ === k} className={"fair-tier" + (d.typ === k ? " on" : "")} onClick={() => setD({ ...d, typ: k })}>
            <b>{t}</b>
            <small>{p}</small>
          </button>
        ))}
      </div>
      <div className="pe-grid2">
        <label className="pe-field">
          <span className="pe-label">Vor- und Nachname</span>
          <input value={d.name ?? ""} onChange={set("name")} autoComplete="name" />
        </label>
        <label className="pe-field">
          <span className="pe-label">Firma (falls vorhanden)</span>
          <input value={d.firma ?? ""} onChange={set("firma")} autoComplete="organization" />
        </label>
      </div>
      <label className="pe-field">
        <span className="pe-label">Straße und Hausnummer</span>
        <input value={d.strasse ?? ""} onChange={set("strasse")} autoComplete="street-address" />
      </label>
      <div className="pe-grid2">
        <label className="pe-field">
          <span className="pe-label">PLZ</span>
          <input value={d.plz ?? ""} onChange={set("plz")} inputMode="numeric" autoComplete="postal-code" />
        </label>
        <label className="pe-field">
          <span className="pe-label">Ort</span>
          <input value={d.ort ?? ""} onChange={set("ort")} autoComplete="address-level2" />
        </label>
      </div>
      {d.typ !== "privat" && (
        <div className="pe-grid2">
          <label className="pe-field">
            <span className="pe-label">Steuernummer</span>
            <input value={d.steuernummer ?? ""} onChange={set("steuernummer")} placeholder="z. B. 93/123/45678" />
          </label>
          {d.typ === "gewerblich" && (
            <label className="pe-field">
              <span className="pe-label">USt-IdNr.</span>
              <input value={d.ust_id ?? ""} onChange={set("ust_id")} placeholder="DE123456789" />
            </label>
          )}
        </div>
      )}
      {d.typ === "gewerblich" && (
        <div className="pe-grid2">
          <label className="pe-field">
            <span className="pe-label">Handelsregister (falls eingetragen)</span>
            <input value={d.handelsregister ?? ""} onChange={set("handelsregister")} placeholder="Amtsgericht …, HRB …" />
          </label>
          <label className="pe-field">
            <span className="pe-label">Steuersatz für Auftritte</span>
            <select value={d.ust_satz_standard} onChange={(e) => setD({ ...d, ust_satz_standard: Number(e.target.value) })}>
              <option value={19}>19 %</option>
              <option value={7}>7 % (z. B. Konzerte, Theater – bitte mit Steuerberatung klären)</option>
            </select>
          </label>
        </div>
      )}
      <h4 className="belege-h">Für die Meldung an das Bundeszentralamt für Steuern (DAC7)</h4>
      <div className="pe-grid2">
        {d.typ !== "gewerblich" && (
          <>
            <label className="pe-field">
              <span className="pe-label">Geburtsdatum</span>
              <input type="date" value={d.geburtsdatum ?? ""} onChange={set("geburtsdatum")} autoComplete="bday" />
            </label>
            <label className="pe-field">
              <span className="pe-label">Steuerliche Identifikationsnummer (11 Ziffern)</span>
              <input value={d.steuer_id ?? ""} onChange={set("steuer_id")} inputMode="numeric" maxLength={14} />
            </label>
          </>
        )}
        <label className="pe-field">
          <span className="pe-label">IBAN des Auszahlungskontos</span>
          <input value={d.iban ?? ""} onChange={set("iban")} autoComplete="off" placeholder="DE…" />
        </label>
      </div>
      <p className="fair-muted">
        Showly muss Anbieter und ihre Umsätze einmal im Jahr an das Bundeszentralamt für Steuern melden (Plattformen-Steuertransparenzgesetz). Deine Daten sehen nur du und die
        Verwaltung; die IBAN zeigen wir nur gekürzt an.
      </p>
      <button type="button" className="home-btn primary" disabled={busy} onClick={() => void speichern()}>
        Speichern
      </button>
    </section>
  );
}

/** Verwaltung: Abzug anlegen, stornieren, Exporte, Wochenabrechnung */
export function BelegeVerwaltung() {
  const { toast } = useShowly();
  const [abzug, setAbzug] = useState({ anbieter: "", art: "strafgebuehr", betrag: "", grund: "" });
  const [storno, setStorno] = useState({ buchung: "", betrag: "", gebuehr: "", grund: "" });
  const jahr = new Date().getFullYear();
  const cent = (v: string) => Math.round(Number(String(v).replace(",", ".")) * 100) || 0;

  async function abzugAnlegen() {
    const { adminAbzug } = await import("@/utils/belege.functions");
    const r = await adminAbzug({ data: { anbieter: abzug.anbieter, art: abzug.art, betragCent: cent(abzug.betrag), grund: abzug.grund } }).catch(() => ({ error: "Hat nicht geklappt" }));
    if ("error" in r) return toast(r.error);
    toast("Abzug angelegt; er wird mit der nächsten Auszahlung verrechnet.");
    setAbzug({ anbieter: "", art: "strafgebuehr", betrag: "", grund: "" });
  }
  async function stornieren() {
    if (!window.confirm("Wirklich erstatten? Das Geld geht sofort an den Kunden zurück.")) return;
    const { adminStornieren } = await import("@/utils/belege.functions");
    const r = await adminStornieren({
      data: {
        buchungId: Number(storno.buchung),
        ...(storno.betrag ? { betragCent: cent(storno.betrag) } : {}),
        ...(storno.gebuehr ? { stornogebuehrCent: cent(storno.gebuehr) } : {}),
        grund: storno.grund,
      },
    }).catch(() => ({ error: "Hat nicht geklappt" }));
    if ("error" in r) return toast(r.error);
    toast(`Erstattet: ${(r.erstattet / 100).toFixed(2).replace(".", ",")} €. Der Kunde bekommt den Beleg per E-Mail.`);
  }
  async function datei(fn: "adminDatev" | "adminDac7", j: number) {
    const m = await import("@/utils/belege.functions");
    const r = await m[fn]({ data: { jahr: j } }).catch(() => ({ error: "Hat nicht geklappt" }));
    if ("error" in r) return toast(r.error);
    const url = URL.createObjectURL(new Blob([r.csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = r.filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }
  async function woche() {
    const { adminWoche } = await import("@/utils/belege.functions");
    const r = await adminWoche().catch(() => ({ error: "Hat nicht geklappt" }));
    if ("error" in r) return toast(r.error);
    toast(`Wochenabrechnung: ${r.result.neu} neu, ${r.result.vorhanden} schon vorhanden, ${r.result.gesperrt} gesperrt.`);
  }

  return (
    <div className="belege-admin">
      <section className="dash26-panel">
        <h3>Strafgebühr oder Abzug anlegen</h3>
        <p className="fair-muted">Ohne Umsatzsteuer. Zum Beispiel Absage unter 14 Tagen: 15 % des Buchungswerts, unter 48 Stunden 25 %, Nichterscheinen 100 %.</p>
        <div className="pe-grid2">
          <input placeholder="E-Mail oder Kennung des Anbieters" value={abzug.anbieter} onChange={(e) => setAbzug({ ...abzug, anbieter: e.target.value })} />
          <select value={abzug.art} onChange={(e) => setAbzug({ ...abzug, art: e.target.value })}>
            <option value="strafgebuehr">Vertragsstrafe</option>
            <option value="schaden">Schadensersatz</option>
            <option value="sonstiges">Sonstiges</option>
          </select>
          <input placeholder="Betrag in €" inputMode="decimal" value={abzug.betrag} onChange={(e) => setAbzug({ ...abzug, betrag: e.target.value })} />
          <input placeholder="Grund" value={abzug.grund} onChange={(e) => setAbzug({ ...abzug, grund: e.target.value })} />
        </div>
        <button type="button" className="dash26-mini" onClick={() => void abzugAnlegen()}>
          Abzug anlegen
        </button>
      </section>
      <section className="dash26-panel">
        <h3>Stornieren und erstatten</h3>
        <p className="fair-muted">Nummer der Teilbestellung. Ohne Betrag wird alles erstattet. Mit Stornogebühr: Original wird storniert, neuer Beleg nur über die Gebühr.</p>
        <div className="pe-grid2">
          <input placeholder="Buchung (Teilbestellung)" inputMode="numeric" value={storno.buchung} onChange={(e) => setStorno({ ...storno, buchung: e.target.value })} />
          <input placeholder="Betrag in € (leer = alles)" inputMode="decimal" value={storno.betrag} onChange={(e) => setStorno({ ...storno, betrag: e.target.value })} />
          <input placeholder="Stornogebühr in € (optional)" inputMode="decimal" value={storno.gebuehr} onChange={(e) => setStorno({ ...storno, gebuehr: e.target.value })} />
          <input placeholder="Grund" value={storno.grund} onChange={(e) => setStorno({ ...storno, grund: e.target.value })} />
        </div>
        <button type="button" className="dash26-mini outline inb-decline-ghost" onClick={() => void stornieren()}>
          Erstatten und Beleg erstellen
        </button>
      </section>
      <section className="dash26-panel">
        <h3>Exporte und Abrechnung</h3>
        <div className="fair-row wrap">
          <button type="button" className="dash26-mini outline" onClick={() => void datei("adminDatev", jahr)}>
            DATEV {jahr} (Provisionen)
          </button>
          <button type="button" className="dash26-mini outline" onClick={() => void datei("adminDac7", jahr - 1)}>
            DAC7 {jahr - 1}
          </button>
          <button type="button" className="dash26-mini outline" onClick={() => void woche()}>
            Wochenabrechnung jetzt
          </button>
        </div>
      </section>
    </div>
  );
}
