/* Verwaltung: Fotos und Videos freigeben oder ablehnen.
 *
 * Jede neue Datei steht hier, bis jemand aus dem Team sie angesehen hat.
 * Worauf achten: Telefonnummern, E-Mail- oder Webadressen, Social-Media-
 * Namen, QR-Codes, Firmenschilder mit Kontaktdaten, bei Videos auch im Ton
 * (Videos laufen hier mit Ton). Ablehnen nur mit Grund; die Person sieht
 * ihn in ihrem Profil und bekommt ihn per Mail. */
import { useCallback, useEffect, useState } from "react";
import { useShowly } from "@/showly/store";
import { adminMedia, adminMediaDecide, type AdminMediaRow } from "@/utils/media.functions";

const when = (v: string | null) =>
  v ? new Date(v).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) : "";
const mb = (b: number) => (b / 1024 / 1024).toFixed(1).replace(".", ",") + " MB";
const STATUS: Record<AdminMediaRow["status"], string> = {
  pending: "wartet",
  approved: "freigegeben",
  rejected: "abgelehnt",
};

export function AdminMedia() {
  const { toast } = useShowly();
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [rows, setRows] = useState<AdminMediaRow[]>([]);
  const [text, setText] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await adminMedia({ data: { filter } }).catch(() => null);
    if (!r) return;
    if ("error" in r) return toast(r.error);
    setRows(r.rows);
  }, [filter, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(id: string, action: "approve" | "reject") {
    setBusy(true);
    try {
      const r = await adminMediaDecide({ data: { id, action, text: text[id] || "" } });
      if ("error" in r) return toast(r.error);
      toast(action === "approve" ? "Freigegeben" : "Abgelehnt, die Person wurde informiert");
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-media">
      <p className="admin-media-hint">
        Prüfen auf Telefonnummern, E-Mail- und Webadressen, Social-Media-Namen, QR-Codes und Firmenschilder mit
        Kontaktdaten. Bei Videos auch auf den Ton achten. Die automatische Prüfung im Browser ist bereits gelaufen.
      </p>
      <div className="admin-media-filter" role="group" aria-label="Anzeige">
        <button type="button" className={filter === "pending" ? "on" : ""} onClick={() => setFilter("pending")}>
          Wartet auf Freigabe
        </button>
        <button type="button" className={filter === "all" ? "on" : ""} onClick={() => setFilter("all")}>
          Alle der letzten Zeit
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="dash26-none">{filter === "pending" ? "Nichts wartet auf Freigabe." : "Keine Einträge."}</p>
      ) : (
        <ul className="admin-media-list">
          {rows.map((r) => (
            <li key={r.id} className={"admin-media-item st-" + r.status}>
              <div className="admin-media-view">
                {r.kind === "video" ? (
                  <video src={r.url} controls playsInline preload="metadata" />
                ) : (
                  <a href={r.url} target="_blank" rel="noreferrer">
                    <img src={r.url} alt="" loading="lazy" />
                  </a>
                )}
              </div>
              <div className="admin-media-info">
                <b>
                  {r.kind === "video" ? "Video" : "Foto"} von {r.owner_name}
                </b>
                <small>
                  {when(r.created_at)} · {mb(r.bytes)}
                  {r.duration ? ` · ${Math.round(r.duration)} s` : ""} · automatische Prüfung{" "}
                  {r.auto_ok ? "bestanden" : "nicht bestanden"} · {STATUS[r.status]}
                  {r.reviewed_at ? ` am ${when(r.reviewed_at)}` : ""}
                </small>
                {r.reason && <p>Grund: {r.reason}</p>}
                {r.status !== "approved" && (
                  <button
                    type="button"
                    className="dash26-mini inb-accept"
                    disabled={busy}
                    onClick={() => void decide(r.id, "approve")}
                  >
                    Freigeben
                  </button>
                )}
                {r.status !== "rejected" && (
                  <>
                    <textarea
                      className="admin26-note"
                      rows={2}
                      placeholder="Grund für die Ablehnung (geht an die Person)"
                      value={text[r.id] ?? ""}
                      onChange={(e) => setText((t) => ({ ...t, [r.id]: e.target.value }))}
                    />
                    <button
                      type="button"
                      className="dash26-mini inb-decline"
                      disabled={busy}
                      onClick={() => void decide(r.id, "reject")}
                    >
                      Ablehnen
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
