/* Übersicht für alle Anbieter (Künstler, Planer, Konditoreien, Deko- und
 * Kostümanbieter): was diese Woche verdient wurde, was ausgezahlt wird,
 * Statistik, Urlaubsmodus, Abrechnung und Bewertungen.
 * Mit Datenbank-Konto rechnet der Server (dashboard.functions.ts); in der
 * Vorschau ohne Konto aus den Daten im Browser. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useShowly } from "@/showly/store";
import { Icon } from "@/showly/ui";
import type { Overview } from "@/utils/dashboard.functions";
import { UserReviewList } from "./Reviews";

const DAY = 86400000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
function weekStart(dayISO: string): string {
  const d = new Date(dayISO + "T12:00:00Z");
  return iso(d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY);
}

export function ProviderOverview({ artistId, onGo }: { artistId?: number | undefined; onGo?: (tab: string) => void }) {
  const { cloudOn, payouts, bookings, fmt, fmtDate, toast } = useShowly();
  const [data, setData] = useState<Overview | null>(null);
  const [awayDate, setAwayDate] = useState("");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [busy, setBusy] = useState(false);

  /* Ohne Datenbank: aus den Auszahlungen und Buchungen im Browser */
  const local = useMemo<Overview | null>(() => {
    if (cloudOn || artistId === undefined) return null;
    const today = iso(Date.now());
    const from = weekStart(today);
    const to = iso(new Date(from + "T12:00:00Z").getTime() + 6 * DAY);
    const mine = payouts.filter((p) => p.artistId === artistId);
    const inW = (d: string, a: string, b: string) => d >= a && d <= b;
    const cents = (v: number) => Math.round(v * 100);
    const week = mine.filter((p) => inW(p.dateISO, from, to));
    const weeks = Array.from({ length: 8 }, (_, k) => {
      const wf = iso(new Date(from + "T12:00:00Z").getTime() - (7 - k) * 7 * DAY);
      const wt = iso(new Date(wf + "T12:00:00Z").getTime() + 6 * DAY);
      return { from: wf, netCents: mine.filter((p) => inW(p.dateISO, wf, wt)).reduce((n, p) => n + cents(p.net), 0) };
    });
    const req = bookings.filter((b) => b.artistId === artistId);
    return {
      week: { from, to, grossCents: week.reduce((n, p) => n + cents(p.gross), 0), netCents: week.reduce((n, p) => n + cents(p.net), 0), count: week.length },
      payoutThisWeekCents: mine.filter((p) => p.payoutOn && inW(p.payoutOn, from, to)).reduce((n, p) => n + cents(p.net), 0),
      paidThisWeekCents: mine.filter((p) => p.status === "paid" && p.payoutOn && inW(p.payoutOn, from, to)).reduce((n, p) => n + cents(p.net), 0),
      openCents: mine.filter((p) => p.status === "pending").reduce((n, p) => n + cents(p.net), 0),
      monthNetCents: mine.filter((p) => p.dateISO.startsWith(today.slice(0, 7))).reduce((n, p) => n + cents(p.net), 0),
      weeks,
      upcoming: mine
        .filter((p) => p.status === "pending")
        .sort((a, b) => (a.payoutOn || "").localeCompare(b.payoutOn || ""))
        .slice(0, 6)
        .map((p) => ({ id: p.id, label: "Auftritt", eventDay: p.dateISO, payoutOn: p.payoutOn || p.dateISO, netCents: cents(p.net), grossCents: cents(p.gross), status: "scheduled", frozen: !!p.frozen })),
      stats: { views: 0, requests: req.length, booked: req.filter((b) => b.status === "confirmed" || b.status === "completed").length, conversion: 0 },
      away: { until: null },
      hasAccount: false,
    };
  }, [cloudOn, artistId, payouts, bookings]);

  const load = useCallback(async () => {
    if (!cloudOn) return;
    const { providerOverview } = await import("@/utils/dashboard.functions");
    const r = await providerOverview().catch(() => null);
    if (r && !("error" in r)) setData(r);
  }, [cloudOn]);
  useEffect(() => {
    void load();
  }, [load]);

  const o = data ?? local;
  const euro = (c: number) => fmt(c / 100);
  const max = Math.max(1, ...(o?.weeks || []).map((w) => w.netCents));

  async function away(until: string | null) {
    if (!cloudOn) return toast("Vorschau: Urlaubsmodus wird mit Konto gespeichert.");
    setBusy(true);
    const { setAwayMode } = await import("@/utils/dashboard.functions");
    const r = await setAwayMode({ data: { until } }).catch(() => ({ error: "Hat nicht geklappt" }));
    setBusy(false);
    if ("error" in r) return toast(r.error);
    toast(until ? `Urlaubsmodus bis ${fmtDate(until)} aktiv` : "Urlaubsmodus beendet");
    void load();
  }

  async function statement() {
    if (!cloudOn) return toast("Vorschau: Die Abrechnung gibt es mit Konto.");
    const { monthStatement } = await import("@/utils/dashboard.functions");
    const r = await monthStatement({ data: { month } }).catch(() => ({ error: "Hat nicht geklappt" }));
    if ("error" in r) return toast(r.error);
    const url = URL.createObjectURL(new Blob([r.csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = r.filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  if (!o)
    return (
      <div className="ov-empty">
        <p>Die Übersicht erscheint, sobald du mit deinem Anbieter-Konto angemeldet bist.</p>
      </div>
    );

  return (
    <div className="ov">
      <section className="ov-cards" aria-label="Geld diese Woche">
        <div className="ov-card main">
          <span className="ov-k">Diese Woche verdient</span>
          <b className="ov-v">{euro(o.week.netCents)}</b>
          <small>
            {o.week.count} {o.week.count === 1 ? "Auftrag" : "Aufträge"} · Kundenpreis {euro(o.week.grossCents)} · {fmtDate(o.week.from)}–{fmtDate(o.week.to)}
          </small>
        </div>
        <div className="ov-card">
          <span className="ov-k">Wird diese Woche ausgezahlt</span>
          <b className="ov-v">{euro(o.payoutThisWeekCents)}</b>
          <small>davon schon überwiesen: {euro(o.paidThisWeekCents)}</small>
        </div>
        <div className="ov-card">
          <span className="ov-k">Noch offen insgesamt</span>
          <b className="ov-v">{euro(o.openCents)}</b>
          <small>7 Tage nach Termin, Lieferung oder Mietende</small>
        </div>
        <div className="ov-card">
          <span className="ov-k">Dieser Monat</span>
          <b className="ov-v">{euro(o.monthNetCents)}</b>
          <small>nach Provision</small>
        </div>
      </section>
      {cloudOn && !o.hasAccount && (
        <p className="ov-warn" role="alert">
          <Icon name="money" /> Hinterlege unter „Zahlungen“ dein Auszahlungskonto, sonst kann nichts überwiesen werden.
        </p>
      )}

      <section className="ov-panel">
        <h3>Letzte 8 Wochen</h3>
        <div className="ov-bars" role="img" aria-label="Verdienst je Woche">
          {o.weeks.map((w) => (
            <div className="ov-bar" key={w.from} title={`${fmtDate(w.from)}: ${euro(w.netCents)}`}>
              <span style={{ height: `${Math.max(3, Math.round((w.netCents / max) * 100))}%` }} />
              <small>{w.from.slice(8)}.{w.from.slice(5, 7)}.</small>
            </div>
          ))}
        </div>
      </section>

      <section className="ov-panel">
        <h3>Nächste Auszahlungen</h3>
        {o.upcoming.length ? (
          <ul className="ov-list">
            {o.upcoming.map((p) => (
              <li key={p.id}>
                <span>
                  <b>{fmtDate(p.payoutOn)}</b> · {p.label} vom {fmtDate(p.eventDay)}
                  {p.status === "held" ? " · Sicherheitseinbehalt" : ""}
                  {p.frozen ? " · angehalten (Reklamation)" : ""}
                </span>
                <b>{euro(p.netCents)}</b>
              </li>
            ))}
          </ul>
        ) : (
          <p className="fair-muted">Gerade keine offenen Auszahlungen.</p>
        )}
        {onGo && (
          <button type="button" className="dash26-mini outline" onClick={() => onGo("payments")}>
            Schneller auszahlen lassen <Icon name="arrow" />
          </button>
        )}
      </section>

      <section className="ov-panel">
        <h3>Statistik (30 Tage)</h3>
        <div className="ov-stats">
          <div>
            <b>{o.stats.views}</b>
            <span>Profilaufrufe</span>
          </div>
          <div>
            <b>{o.stats.requests}</b>
            <span>Anfragen und Bestellungen</span>
          </div>
          <div>
            <b>{o.stats.booked}</b>
            <span>gebucht</span>
          </div>
          <div>
            <b>{o.stats.conversion} %</b>
            <span>Conversion</span>
          </div>
        </div>
        <p className="fair-muted">Aufrufe zählen wir nur als Zahl pro Tag, ohne Daten über die Besucher.</p>
      </section>

      <section className="ov-panel">
        <h3>Urlaubsmodus</h3>
        {o.away.until ? (
          <div className="fair-row wrap">
            <span>
              Aktiv bis <b>{fmtDate(o.away.until)}</b>. In dieser Zeit sind keine neuen Buchungen oder Bestellungen möglich; bestehende bleiben bestehen.
            </span>
            <button type="button" className="dash26-mini outline" disabled={busy} onClick={() => void away(null)}>
              Urlaub beenden
            </button>
          </div>
        ) : (
          <div className="fair-row wrap">
            <label className="ov-away">
              <span>Abwesend bis</span>
              <input type="date" min={iso(Date.now())} value={awayDate} onChange={(e) => setAwayDate(e.target.value)} />
            </label>
            <button type="button" className="dash26-mini" disabled={!awayDate || busy} onClick={() => void away(awayDate)}>
              Urlaubsmodus einschalten
            </button>
          </div>
        )}
        {onGo && artistId !== undefined && (
          <button type="button" className="dash26-mini outline" onClick={() => onGo("calendar")}>
            Einzelne Tage oder Zeiten sperren <Icon name="arrow" />
          </button>
        )}
      </section>

      <section className="ov-panel">
        <h3>Abrechnung</h3>
        <div className="fair-row wrap">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Monat" />
          <button type="button" className="dash26-mini" onClick={() => void statement()}>
            <Icon name="clipboard" /> Abrechnung herunterladen (CSV)
          </button>
        </div>
        <p className="fair-muted">
          Alle Aufträge des Monats mit Kundenpreis, Provision, Gebühren, verrechneten Strafen und Auszahlung. Öffnet sich in Excel oder Numbers. Rechnungen an
          Kunden stellen Unternehmer selbst aus (AGB § 21 Abs. 6).
        </p>
      </section>

      {artistId !== undefined && (
        <section className="ov-panel">
          <h3>Bewertungen und Antworten</h3>
          <UserReviewList artistId={artistId} />
        </section>
      )}
    </div>
  );
}
