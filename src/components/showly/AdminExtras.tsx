/* Verwaltung: Provision je Kategorie/Anbieter, Rabattcodes und Gutscheine,
 * Berichte und Audit-Log. Jede Aktion prüft der Server (admin.functions.ts)
 * und schreibt sie ins Audit-Log. */
import { useEffect, useState } from "react";
import { useShowly } from "@/showly/store";
import { CATS } from "@/showly/data";
import { getStripeEnvironment } from "@/lib/stripe";
import { adminAudit, adminFees, adminPromos, adminReport, type AdminReport, type PromoInfo } from "@/utils/admin.functions";
import { adminComplaints, evidenceUrls } from "@/utils/fair.functions";
import type { ComplaintRow } from "@/lib/database.types";

const euro = (c: number) => (c / 100).toFixed(2).replace(".", ",") + " €";
const pct = (r: number) => `${Math.round(r * 1000) / 10} %`;

export function AdminFees() {
  const { toast, catLabel } = useShowly();
  const [rules, setRules] = useState<{ id: number; scope: string; ref: string; rate: number }[]>([]);
  const [standard, setStandard] = useState(0.2);
  const [scope, setScope] = useState("category");
  const [ref, setRef] = useState(CATS[0]?.id ?? "");
  const [rate, setRate] = useState("");

  async function run(data: Parameters<typeof adminFees>[0]["data"]) {
    const r = await adminFees({ data }).catch(() => null);
    if (!r) return;
    if ("error" in r) return toast(r.error);
    setRules(r.rules);
    setStandard(r.standard);
  }
  useEffect(() => {
    void run({ op: "list" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refLabel = (s: string, r: string) =>
    s === "category" ? (r === "sweets" ? "Torten & Süßes" : r === "deko" ? "Deko-Shop" : catLabel(r)) : `${s === "artist" ? "Künstler" : s === "baker" ? "Konditorei" : "Deko"} #${r}`;

  return (
    <section className="admin26-panel">
      <h2>Provision</h2>
      <p className="admin26-hint">
        Standard: {pct(standard)} vom Endpreis. Regel für einen Anbieter geht vor der Regel seiner Kategorie. Kunden
        zahlen immer denselben Preis; die Provision ändert nur die Auszahlung. Gilt für neue Buchungen.
      </p>
      <ul className="admin26-list">
        {rules.map((r) => (
          <li key={r.id}>
            <div>
              <b>{refLabel(r.scope, r.ref)}</b>
              <small>{pct(r.rate)}</small>
            </div>
            <div className="admin26-act">
              <button type="button" className="dash26-mini inb-decline" onClick={() => void run({ op: "delete", id: r.id })}>
                Entfernen
              </button>
            </div>
          </li>
        ))}
        {!rules.length && <li>Noch keine eigenen Regeln.</li>}
      </ul>
      <div className="admin26-form">
        <select value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Art">
          <option value="category">Kategorie</option>
          <option value="artist">Künstler (Kennung)</option>
          <option value="baker">Konditorei (Kennung)</option>
          <option value="deco">Deko-Anbieter (Kennung)</option>
        </select>
        {scope === "category" ? (
          <select value={ref} onChange={(e) => setRef(e.target.value)} aria-label="Kategorie">
            {CATS.filter((c) => c.id !== "all").map((c) => (
              <option key={c.id} value={c.id}>
                {catLabel(c.id)}
              </option>
            ))}
            <option value="sweets">Torten &amp; Süßes</option>
            <option value="deko">Deko-Shop</option>
          </select>
        ) : (
          <input value={ref} placeholder="z. B. 100023" onChange={(e) => setRef(e.target.value)} aria-label="Kennung" />
        )}
        <input value={rate} inputMode="decimal" placeholder="Provision in %" onChange={(e) => setRate(e.target.value)} aria-label="Provision" />
        <button type="button" className="dash26-mini" onClick={() => void run({ op: "set", scope, ref, rate })}>
          Speichern
        </button>
      </div>
    </section>
  );
}

export function AdminPromos() {
  const { toast } = useShowly();
  const env = getStripeEnvironment();
  const [list, setList] = useState<PromoInfo[]>([]);
  const [f, setF] = useState({ code: "", kind: "percent", value: "", max: "", expires: "", min: "" });

  async function run(data: Parameters<typeof adminPromos>[0]["data"]) {
    const r = await adminPromos({ data }).catch(() => null);
    if (!r) return;
    if ("error" in r) return toast(r.error);
    setList(r.promos);
    if (data.op === "create") {
      toast("Code angelegt");
      setF({ code: "", kind: "percent", value: "", max: "", expires: "", min: "" });
    }
  }
  useEffect(() => {
    void run({ op: "list", environment: env });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const n = (v: string) => Number(v.replace(",", ".")) || 0;
  return (
    <section className="admin26-panel">
      <h2>Rabattcodes und Gutscheine</h2>
      <p className="admin26-hint">
        Kunden geben den Code an der Kasse ein. Den Rabatt trägt Showly, Anbieter bekommen ihren vollen Anteil.
        Geschenkgutschein: Euro-Betrag mit „höchstens 1×“. Umgebung: {env === "live" ? "Live" : "Test"}.
      </p>
      <ul className="admin26-list">
        {list.map((p) => (
          <li key={p.id} className={p.active ? "" : "st-closed"}>
            <div>
              <b>
                {p.code} · {p.off}
              </b>
              <small>
                {p.used}× eingelöst{p.max ? ` von ${p.max}` : ""}
                {p.expires ? ` · bis ${p.expires.split("-").reverse().join(".")}` : ""}
                {p.active ? "" : " · deaktiviert"}
              </small>
            </div>
            {p.active && (
              <div className="admin26-act">
                <button type="button" className="dash26-mini inb-decline" onClick={() => void run({ op: "off", environment: env, id: p.id })}>
                  Deaktivieren
                </button>
              </div>
            )}
          </li>
        ))}
        {!list.length && <li>Noch keine Codes.</li>}
      </ul>
      <div className="admin26-form">
        <input value={f.code} placeholder="CODE, z. B. HALLOWEEN10" onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} aria-label="Code" />
        <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} aria-label="Art">
          <option value="percent">Prozent</option>
          <option value="euro">Euro-Betrag</option>
        </select>
        <input value={f.value} inputMode="decimal" placeholder={f.kind === "percent" ? "z. B. 10" : "z. B. 25"} onChange={(e) => setF({ ...f, value: e.target.value })} aria-label="Wert" />
        <input value={f.max} inputMode="numeric" placeholder="höchstens … mal" onChange={(e) => setF({ ...f, max: e.target.value })} aria-label="Einlösungen" />
        <input type="date" value={f.expires} onChange={(e) => setF({ ...f, expires: e.target.value })} aria-label="gültig bis" />
        <input value={f.min} inputMode="decimal" placeholder="Mindestbestellwert €" onChange={(e) => setF({ ...f, min: e.target.value })} aria-label="Mindestbestellwert" />
        <button
          type="button"
          className="dash26-mini"
          onClick={() =>
            void run({
              op: "create",
              environment: env,
              code: f.code,
              ...(f.kind === "percent" ? { percent: n(f.value) } : { euros: n(f.value) }),
              ...(n(f.max) ? { max: n(f.max) } : {}),
              ...(f.expires ? { expires: f.expires } : {}),
              ...(n(f.min) ? { minEuros: n(f.min) } : {}),
            })
          }
        >
          Anlegen
        </button>
      </div>
    </section>
  );
}

export function AdminReportView() {
  const { toast } = useShowly();
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today.slice(0, 8) + "01");
  const [to, setTo] = useState(today);
  const [r, setR] = useState<AdminReport | null>(null);

  async function load() {
    const x = await adminReport({ data: { from, to } }).catch(() => null);
    if (!x) return;
    if ("error" in x) return toast(x.error);
    setR(x);
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="admin26-panel">
      <h2>Berichte</h2>
      <div className="admin26-form">
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="von" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="bis" />
        <button type="button" className="dash26-mini" onClick={() => void load()}>
          Anzeigen
        </button>
      </div>
      {r && (
        <>
          <div className="admin26-grid">
            {[
              ["Umsatz (bezahlt)", euro(r.revenueCents)],
              ["Provision", euro(r.feeCents)],
              ["Rabatte (trägt Showly)", euro(r.discountCents)],
              ["Bestellungen", String(r.orders)],
              ["Buchungen", String(r.bookings.total)],
              ["Stornoquote", `${Math.round(r.cancelRate * 1000) / 10} %`],
              ["Rückbuchungen", String(r.disputes)],
              ["Vertragsstrafen", euro(r.penaltiesCents)],
              ["Garantie-Topf (Strafen + 5 % Provision)", euro(r.guaranteeCents)],
            ].map(([k, v]) => (
              <div key={k} className="admin26-card">
                <b>{v}</b>
                <span>{k}</span>
              </div>
            ))}
          </div>
          <p className="admin26-hint">
            Buchungen: {r.bookings.confirmed} bestätigt, {r.bookings.requested} offen, {r.bookings.cancelled} storniert,{" "}
            {r.bookings.declined} abgelehnt/verfallen.
          </p>
          <h3>Top-Anbieter</h3>
          <ol className="admin26-top">
            {r.top.map((t) => (
              <li key={`${t.kind}-${t.providerId}`}>
                <b>{t.name}</b> · {euro(t.cents)} · {t.count}×
              </li>
            ))}
            {!r.top.length && <li>Keine Umsätze im Zeitraum.</li>}
          </ol>
        </>
      )}
    </section>
  );
}

export function AdminAuditView() {
  const { toast } = useShowly();
  const [rows, setRows] = useState<{ id: number; email: string | null; action: string; target: string | null; detail: string; created_at: string }[]>([]);
  useEffect(() => {
    void adminAudit()
      .then((r) => ("error" in r ? toast(r.error) : setRows(r.rows)))
      .catch(() => undefined);
  }, [toast]);
  return (
    <section className="admin26-panel">
      <h2>Audit-Log</h2>
      <p className="admin26-hint">Jede Aktion der Verwaltung, nicht änderbar. Die letzten 300 Einträge.</p>
      <ul className="admin26-list">
        {rows.map((r) => (
          <li key={r.id}>
            <div>
              <b>
                {r.action}
                {r.target ? ` · ${r.target}` : ""}
              </b>
              <small>
                {new Date(r.created_at).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })} · {r.email ?? "–"}
              </small>
              {r.detail && <p>{r.detail}</p>}
            </div>
          </li>
        ))}
        {!rows.length && <li>Noch keine Einträge.</li>}
      </ul>
    </section>
  );
}

/** Reklamationen: Nachweise, Stellungnahme, Entscheidung innerhalb von 5 Tagen */
export function AdminComplaints() {
  const { toast } = useShowly();
  const [list, setList] = useState<(ComplaintRow & { flagged: boolean; title: string })[]>([]);
  const [form, setForm] = useState<Record<number, { cents: string; text: string }>>({});
  async function run(data: Parameters<typeof adminComplaints>[0]["data"]) {
    const r = await adminComplaints({ data }).catch(() => null);
    if (!r) return;
    if ("error" in r) return toast(r.error);
    setList(r.list);
  }
  useEffect(() => {
    void run({ op: "list" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function show(c: ComplaintRow) {
    const ref = c.booking_id
      ? { kind: "booking" as const, id: c.booking_id }
      : c.shop_order_id
        ? { kind: "order" as const, id: c.shop_order_id }
        : { kind: "sweet" as const, id: c.sweet_request_id ?? 0 };
    const urls = await evidenceUrls({ data: { ref, paths: c.evidence } }).catch(() => ({}));
    Object.values(urls).forEach((u) => window.open(u, "_blank", "noopener"));
  }
  const open = list.filter((c) => ["open", "offer", "escalated"].includes(c.status));
  const done = list.filter((c) => !["open", "offer", "escalated"].includes(c.status));
  const row = (c: ComplaintRow & { flagged: boolean; title: string }) => {
    const f = form[c.id] ?? { cents: "", text: "" };
    return (
      <li key={c.id} className={c.status === "escalated" ? "" : "st-closed"}>
        <div>
          <b>
            #{c.id} · {c.title} · {euro(c.amount_cents)}
            {c.flagged ? " · ⚠ viele Reklamationen" : ""}
          </b>
          <small>
            {c.booking_id ? `Buchung ${c.booking_id}` : c.shop_order_id ? `Bestellung ${c.shop_order_id}` : `Torte ${c.sweet_request_id}`} · Status {c.status} ·
            entscheiden bis {new Date(c.decide_by).toLocaleDateString("de-DE")}
          </small>
          <p>{c.body}</p>
          {c.statement && <p>Stellungnahme: {c.statement}</p>}
          {c.offer_cents ? <p>Angebot: {euro(c.offer_cents)} ({c.offer_by})</p> : null}
          {c.decision && <p>Entscheidung: {c.decision} · {euro(c.refund_cents ?? 0)}</p>}
        </div>
        <div className="admin26-act">
          {c.evidence.length > 0 && (
            <button type="button" className="dash26-mini outline" onClick={() => void show(c)}>
              {c.evidence.length} Nachweise
            </button>
          )}
          {["open", "offer", "escalated"].includes(c.status) && (
            <>
              <input inputMode="decimal" placeholder="Erstattung €" value={f.cents} onChange={(e) => setForm({ ...form, [c.id]: { ...f, cents: e.target.value } })} aria-label="Erstattung" />
              <input placeholder="Begründung" value={f.text} onChange={(e) => setForm({ ...form, [c.id]: { ...f, text: e.target.value } })} aria-label="Begründung" />
              <button
                type="button"
                className="dash26-mini"
                onClick={() =>
                  void run({ op: "decide", id: c.id, cents: Math.round(Number(f.cents.replace(",", ".")) * 100) || 0, decision: f.text })
                }
              >
                Entscheiden
              </button>
            </>
          )}
        </div>
      </li>
    );
  };
  return (
    <section className="admin26-panel">
      <h2>Reklamationen</h2>
      <p className="admin26-hint">
        Anbieter haben 48 Stunden für eine Stellungnahme, danach landet die Reklamation hier. Entscheidung spätestens 5 Tage nach Eingang. Richtwerte: 20 Minuten zu
        spät = 20 %, kürzere Show anteilig, falsches Tortenmotiv 50–100 %. Der Chat zur Buchung zählt als Nachweis. Gesetzliche Gewährleistung bleibt unberührt.
      </p>
      <h3>Offen ({open.length})</h3>
      <ul className="admin26-list">{open.length ? open.map(row) : <li>Keine offenen Reklamationen.</li>}</ul>
      <h3>Erledigt</h3>
      <ul className="admin26-list">{done.slice(0, 50).map(row)}</ul>
    </section>
  );
}
