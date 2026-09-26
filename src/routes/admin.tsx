/* Verwaltung für das Showly-Team.
 *
 * Nur mit Rolle "admin" (in der Datenbank); jede Aktion prüft der Server
 * selbst (admin.functions.ts). Hier wird entschieden über Meldungen,
 * Notfall-Nachweise und Anhörungen, Freischalten und Sperren von Künstlern
 * und Anbietern, Erstattungen, Hilfe-Anfragen; dazu das Fehlerprotokoll und
 * die Datensicherung. */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useShowly } from "@/showly/store";
import { Icon } from "@/showly/ui";
import { isBackendConfigured } from "@/lib/supabase";
import { getStripeEnvironment } from "@/lib/stripe";
import { adminAct, adminExport, adminList, adminOverview, type AdminSection } from "@/utils/admin.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Verwaltung – Showly" }, { name: "robots", content: "noindex" }] }),
  component: AdminPage,
});

type Row = Record<string, unknown> & { id: number };

const TABS: { id: AdminSection | "overview" | "export"; label: string; icon: string }[] = [
  { id: "overview", label: "Übersicht", icon: "chart" },
  { id: "reports", label: "Meldungen", icon: "shield" },
  { id: "penalties", label: "Strafen & Nachweise", icon: "scale" },
  { id: "artists", label: "Künstler", icon: "star" },
  { id: "providers", label: "Torten & Deko", icon: "gift" },
  { id: "refunds", label: "Erstattungen", icon: "money" },
  { id: "tickets", label: "Hilfe-Anfragen", icon: "mail" },
  { id: "errors", label: "Fehler", icon: "server" },
  { id: "export", label: "Datensicherung", icon: "lock" },
];

const S = (v: unknown) => (v == null ? "" : typeof v === "object" ? String((v as { de?: string }).de ?? JSON.stringify(v)) : String(v));
const euro = (c: unknown) => (Number(c || 0) / 100).toFixed(2).replace(".", ",") + " €";
const when = (v: unknown) => (v ? new Date(String(v)).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) : "");

function AdminPage() {
  const { session, toast } = useShowly();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("overview");
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    if (tab === "overview") {
      const r = await adminOverview().catch(() => null);
      if (r && !("error" in r)) setCounts(r);
      else if (r) toast(r.error);
      return;
    }
    if (tab === "export") return;
    const r = await adminList({ data: { section: tab } }).catch(() => null);
    if (!r) return;
    if ("error" in r) return toast(r.error);
    setRows(JSON.parse(r.json) as Row[]);
  }, [tab, toast]);

  useEffect(() => {
    setRows([]);
    if (session?.backend) void load();
  }, [load, session?.backend]);

  async function act(payload: Parameters<typeof adminAct>[0]["data"]) {
    setBusy(true);
    try {
      const r = await adminAct({ data: payload });
      if ("error" in r) return toast(r.error);
      toast(r.note || "Erledigt");
      setText((t) => ({ ...t, [payload.id]: "" }));
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    setBusy(true);
    try {
      const r = await adminExport();
      if ("error" in r) return toast(r.error);
      const blob = new Blob([r.json], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `showly-sicherung-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setBusy(false);
    }
  }

  if (!isBackendConfigured() || !session?.backend || !session.admin)
    return (
      <div className="page active ui26 admin26">
        <div className="admin26-wrap">
          <h1>Verwaltung</h1>
          <p>
            Dieser Bereich ist nur für das Showly-Team und funktioniert mit der Datenbank. Melde dich mit deinem
            Admin-Konto an.
          </p>
          <Link className="home-btn primary" to="/anmelden">
            Anmelden
          </Link>
        </div>
      </div>
    );

  const note = (id: number, ph: string) => (
    <textarea
      className="admin26-note"
      rows={2}
      placeholder={ph}
      value={text[id] ?? ""}
      onChange={(e) => setText((t) => ({ ...t, [id]: e.target.value }))}
    />
  );
  const btn = (label: string, onClick: () => void, kind = "outline") => (
    <button type="button" className={"dash26-mini " + kind} disabled={busy} onClick={onClick}>
      {label}
    </button>
  );

  return (
    <div className="page active ui26 admin26">
      <div className="admin26-wrap">
        <h1>Verwaltung</h1>
        <nav className="admin26-tabs">
          {TABS.map((t) => (
            <button key={t.id} type="button" className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>
              <Icon name={t.icon} /> {t.label}
              {counts && t.id in counts && counts[t.id]! > 0 && <span className="chat26-badge">{counts[t.id]}</span>}
            </button>
          ))}
        </nav>

        {tab === "overview" && counts && (
          <div className="admin26-grid">
            {[
              ["Offene Meldungen", counts["reports"], "reports"],
              ["Nachweise und Anhörungen", counts["penalties"], "penalties"],
              ["Künstler warten auf Freischaltung", counts["artists"], "artists"],
              ["Anbieter warten auf Freischaltung", counts["providers"], "providers"],
              ["Erstattungen offen", counts["refunds"], "refunds"],
              ["Offene Hilfe-Anfragen", counts["tickets"], "tickets"],
              ["Fehler in 24 Stunden", counts["errors"], "errors"],
            ].map(([label, n, id]) => (
              <button key={String(id)} type="button" className="admin26-card" onClick={() => setTab(id as AdminSection)}>
                <b>{String(n ?? 0)}</b>
                <span>{String(label)}</span>
              </button>
            ))}
          </div>
        )}

        {tab === "reports" && (
          <ul className="admin26-list">
            {rows.map((r) => (
              <li key={r.id} className={"st-" + S(r["status"])}>
                <div>
                  <b>
                    {S(r["target_type"])} #{S(r["target_id"])} · {S(r["reason"])}
                  </b>
                  <small>{when(r["created_at"])} · Status: {S(r["status"])}</small>
                  {!!r["details"] && <p>{S(r["details"])}</p>}
                  {!!r["decision"] && <p className="admin26-done">Entscheidung: {S(r["decision"])}</p>}
                </div>
                {r["status"] === "open" && (
                  <div className="admin26-act">
                    {note(r.id, "Begründung (geht an die meldende Person)")}
                    {btn("Entfernen", () => void act({ section: "reports", id: r.id, action: "remove", text: text[r.id] || "" }), "inb-decline")}
                    {btn("Belassen", () => void act({ section: "reports", id: r.id, action: "keep", text: text[r.id] || "" }))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {tab === "penalties" && (
          <ul className="admin26-list">
            {rows.map((r) => {
              const b = (r["bookings"] || {}) as Record<string, unknown>;
              const open = r["status"] === "proof" || r["status"] === "hearing";
              return (
                <li key={r.id} className={"st-" + S(r["status"])}>
                  <div>
                    <b>
                      {r["reason"] === "noshow" ? "Nicht erschienen" : "Späte Absage"} · {euro(r["amount_cents"])}
                    </b>
                    <small>
                      Termin {S(b["day"])} {S(b["slot"])} · Kunde {S(b["customer_name"])} · Künstler #
                      {S(b["artist_id"] ?? b["catalog_artist"])} · Status: {S(r["status"])}
                      {r["hearing_until"] ? ` · Anhörung bis ${when(r["hearing_until"])}` : ""}
                    </small>
                    {!!r["statement"] && <p>Stellungnahme: {S(r["statement"])}</p>}
                  </div>
                  {open && (
                    <div className="admin26-act">
                      {note(r.id, "Notiz (optional)")}
                      {btn("Nachweis anerkennen, keine Strafe", () => void act({ section: "penalties", id: r.id, action: "waive", text: text[r.id] || "" }), "inb-accept")}
                      {btn("Strafe fällig, Gutschein an Kunden", () => void act({ section: "penalties", id: r.id, action: "confirm", text: text[r.id] || "" }), "inb-decline")}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {(tab === "artists" || tab === "providers") && (
          <ul className="admin26-list">
            {rows.map((r) => {
              const d = (r["data"] || {}) as Record<string, unknown>;
              const name = tab === "artists" ? S(r["name"]) : S(d["name"] || d["vendor"]);
              const sec = tab;
              return (
                <li key={r.id} className={r["blocked"] ? "st-blocked" : r["published"] ? "st-ok" : "st-open"}>
                  <div>
                    <b>
                      #{r.id} {name}
                    </b>
                    <small>
                      {tab === "artists"
                        ? `${S(r["cat"])} · ${S(r["loc"])} · ${euro(r["price_cents"])}/Std. · Ausweis ${r["verified"] ? "geprüft" : "nicht geprüft"}`
                        : `${S(r["kind"]) === "baker" ? "Torten" : "Deko"} · ${S(d["city"])} · ${d["kind"] === "private" ? "privat" : "gewerblich"}${d["foodRegistered"] ? " · Lebensmittelamt bestätigt" : ""}`}
                      {" · "}
                      {r["blocked"] ? "gesperrt" : r["published"] ? "sichtbar" : "wartet"}
                    </small>
                    {!!r["blocked_reason"] && <p>Sperrgrund: {S(r["blocked_reason"])}</p>}
                  </div>
                  <div className="admin26-act">
                    {!r["blocked"] && !r["published"] && btn("Freischalten", () => void act({ section: sec, id: r.id, action: "publish" }), "inb-accept")}
                    {!r["blocked"] && !!r["published"] && btn("Verbergen", () => void act({ section: sec, id: r.id, action: "unpublish" }))}
                    {!r["blocked"] && note(r.id, "Grund für eine Sperre (geht an die Person)")}
                    {!r["blocked"] && btn("Sperren", () => void act({ section: sec, id: r.id, action: "block", text: text[r.id] || "" }), "inb-decline")}
                    {!!r["blocked"] && btn("Sperre aufheben", () => void act({ section: sec, id: r.id, action: "unblock" }))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {tab === "refunds" && (
          <ul className="admin26-list">
            {rows.map((r) => {
              const left = Number(r["amount_cents"]) - Number(r["refunded_cents"]);
              return (
                <li key={r.id} className={left > 0 ? "st-open" : "st-ok"}>
                  <div>
                    <b>
                      Buchung #{r.id} · {S(r["day"])} {S(r["slot"])} · {S(r["customer_name"])}
                    </b>
                    <small>
                      Status: {S(r["status"])}
                      {r["cancelled_by"] ? ` (von ${r["cancelled_by"] === "customer" ? "Kunde" : "Künstler"})` : ""} · bezahlt{" "}
                      {euro(r["amount_cents"])} · erstattet {euro(r["refunded_cents"])} {when(r["refunded_at"])}
                    </small>
                  </div>
                  {left > 0 && (
                    <div className="admin26-act">
                      {btn(`${euro(left)} erstatten`, () => void act({ section: "refunds", id: r.id, action: "refund", environment: getStripeEnvironment() }), "inb-accept")}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {tab === "tickets" && (
          <ul className="admin26-list">
            {rows.map((r) => (
              <li key={r.id} className={"st-" + S(r["status"])}>
                <div>
                  <b>
                    {S(r["name"]) || S(r["email"])} · {S(r["topic"])}
                  </b>
                  <small>
                    {S(r["email"])} · {when(r["created_at"])} · {S(r["status"])}
                  </small>
                  <p>{S(r["body"])}</p>
                  {!!r["answer"] && <p className="admin26-done">Antwort: {S(r["answer"])}</p>}
                </div>
                {r["status"] !== "closed" && (
                  <div className="admin26-act">
                    {note(r.id, "Antwort (geht per Mail an die Person)")}
                    {btn("Antworten", () => void act({ section: "tickets", id: r.id, action: "answer", text: text[r.id] || "" }), "inb-accept")}
                    {btn("Schließen", () => void act({ section: "tickets", id: r.id, action: "close" }))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {tab === "errors" && (
          <ul className="admin26-list">
            {rows.map((r) => (
              <li key={r.id}>
                <div>
                  <b>{S(r["message"])}</b>
                  <small>
                    {when(r["created_at"])} · {S(r["url"])} · {S(r["user_agent"]).slice(0, 80)}
                  </small>
                  {!!r["stack"] && <pre>{S(r["stack"]).slice(0, 1200)}</pre>}
                </div>
              </li>
            ))}
          </ul>
        )}

        {tab === "export" && (
          <div className="admin26-export">
            <p>
              Lädt alle Tabellen als JSON-Datei herunter (je bis 10.000 Einträge). Bewahre die Datei sicher auf; sie
              enthält personenbezogene Daten. Die automatische tägliche Sicherung stellst du zusätzlich bei Supabase bzw.
              Lovable Cloud ein (siehe EINRICHTUNG.md).
            </p>
            {btn("Sicherung herunterladen", () => void download(), "inb-accept")}
          </div>
        )}

        {tab !== "overview" && tab !== "export" && rows.length === 0 && <p className="dash26-none">Keine Einträge.</p>}
      </div>
    </div>
  );
}
