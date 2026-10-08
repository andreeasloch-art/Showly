/* Faire Regeln sichtbar machen (showly/policies.ts):
 *  - Stornostufe im Profil, an der Kasse und bei der Buchung
 *  - Stufe wählen und Springer-Liste im Profil-Editor
 *  - einmal kostenlos umbuchen
 *  - Reklamation mit Fotos/Videos, Stellungnahme, Einigung per Klick
 *  - Auszahlung schneller gegen Gebühr
 *  - Übergabeprotokoll und Schadenskatalog beim Verleih
 *  - Ersatz-Vorschläge nach Absage oder Nichterscheinen */
import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useShowly } from "@/showly/store";
import { Icon } from "@/showly/ui";
import {
  CANCEL_TIERS,
  CANCEL_TIER_IDS,
  CAREFREE_EUR,
  COMPLAINT_CATS,
  COMPLAINT_LABEL,
  DAMAGE_CATALOG,
  PAYOUT_SPEED,
  RENT_FREE_HOURS,
  RENT_LATE_RATE,
  evidenceRequired,
  guideline,
  tierOf,
  type CancelTier,
  type ComplaintCat,
  type PayoutSpeed,
  type PolicySnapshot,
} from "@/showly/policies";
import type { HandoverRow } from "@/lib/database.types";
import type { ComplaintInfo } from "@/utils/fair.functions";

const euro = (v: number) => v.toFixed(2).replace(".", ",").replace(",00", "") + " €";
const days = (h: number) => (h > 48 && h % 24 === 0 ? `${h / 24} Tage` : `${h} Stunden`);
const daysEn = (h: number) => (h > 48 && h % 24 === 0 ? `${h / 24} days` : `${h} hours`);
const daysEs = (h: number) => (h > 48 && h % 24 === 0 ? `${h / 24} días` : `${h} horas`);

const TIER_NAME: Record<string, Record<CancelTier, string>> = {
  de: { flexibel: "Flexibel", moderat: "Moderat", streng: "Streng" },
  en: { flexibel: "Flexible", moderat: "Moderate", streng: "Strict" },
  es: { flexibel: "Flexible", moderat: "Moderada", streng: "Estricta" },
};

/** Regel einer Stufe in einem Satz */
export function tierRule(tier: CancelTier, lang: string): string {
  const t = CANCEL_TIERS[tier];
  if (lang === "en") return `Free until ${daysEn(t.free)} before, 50 % until ${daysEn(t.half)} before, then 100 %.`;
  if (lang === "es") return `Gratis hasta ${daysEs(t.free)} antes, 50 % hasta ${daysEs(t.half)} antes, después 100 %.`;
  return `Kostenlos bis ${days(t.free)} vorher, bis ${days(t.half)} vorher 50 %, danach 100 %.`;
}

function policyRule(p: PolicySnapshot, lang: string): string {
  if (p.kind === "cake")
    return lang === "en"
      ? `Free until production starts (${daysEn(p.free)} before), then no refund.`
      : lang === "es"
        ? `Gratis hasta el inicio de la producción (${daysEs(p.free)} antes), después sin reembolso.`
        : `Kostenlos bis Produktionsbeginn (${days(p.free)} vorher), danach keine Erstattung.`;
  if (p.kind === "rental")
    return lang === "en"
      ? `Free until ${daysEn(p.free)} before the rental starts, then ${Math.round(p.midRate * 100)} % plus shipping.`
      : lang === "es"
        ? `Gratis hasta ${daysEs(p.free)} antes del alquiler, después ${Math.round(p.midRate * 100)} % más envío.`
        : `Kostenlos bis ${days(p.free)} vor Mietbeginn, danach ${Math.round(p.midRate * 100)} % plus Versand.`;
  if (p.free === p.half)
    return lang === "en" ? `Free until ${daysEn(p.free)} before.` : lang === "es" ? `Gratis hasta ${daysEs(p.free)} antes.` : `Kostenlos bis ${days(p.free)} vorher.`;
  return lang === "en"
    ? `Free until ${daysEn(p.free)} before, 50 % until ${daysEn(p.half)} before, then 100 %.`
    : lang === "es"
      ? `Gratis hasta ${daysEs(p.free)} antes, 50 % hasta ${daysEs(p.half)} antes, después 100 %.`
      : `Kostenlos bis ${days(p.free)} vorher, bis ${days(p.half)} vorher 50 %, danach 100 %.`;
}

const POLICY_COPY = {
  de: {
    h: "Stornobedingungen",
    rebook: "Einmal kostenlos umbuchen auf einen Termin innerhalb von 6 Monaten (bis 48 Stunden vorher).",
    legal: "Gebühren sind pauschal; du darfst nachweisen, dass ein geringerer Schaden entstanden ist. Mit der Buchung gespeichert – spätere Änderungen gelten nicht für dich.",
    rate: (n: number) => `Stornoquote des Künstlers: ${n} % (12 Monate)`,
  },
  en: {
    h: "Cancellation policy",
    rebook: "One free rebooking to a date within 6 months (up to 48 hours before).",
    legal: "Fees are flat-rate; you may prove that a smaller loss occurred. Saved with your booking – later changes don't apply to you.",
    rate: (n: number) => `Artist cancellation rate: ${n} % (12 months)`,
  },
  es: {
    h: "Condiciones de cancelación",
    rebook: "Un cambio de fecha gratuito a otra fecha en 6 meses (hasta 48 horas antes).",
    legal: "Las tarifas son fijas; puedes demostrar un daño menor. Se guarda con tu reserva: los cambios posteriores no te afectan.",
    rate: (n: number) => `Tasa de cancelación del artista: ${n} % (12 meses)`,
  },
};

/** Stornostufe als Hinweis (Profil, Kasse, Buchung) */
export function CancelPolicyNote({
  tier,
  policy,
  cancelRate,
  compact = false,
}: {
  tier?: CancelTier | undefined;
  policy?: PolicySnapshot | undefined;
  cancelRate?: number | undefined;
  compact?: boolean;
}) {
  const { lang } = useShowly();
  const C = POLICY_COPY[lang as "de"] ?? POLICY_COPY.de;
  const t = policy?.tier ?? tierOf(tier);
  const name = (TIER_NAME[lang] ?? TIER_NAME["de"]!)[t];
  const rule = policy ? policyRule(policy, lang) : tierRule(t, lang);
  if (compact)
    return (
      <p className="fair-policy compact">
        <Icon name="shield" /> <b>{C.h}: {policy?.kind === "cake" || policy?.kind === "rental" ? "" : name}</b> {rule}
      </p>
    );
  return (
    <div className="fair-policy">
      <div className="fair-policy-head">
        <Icon name="shield" />
        <b>
          {C.h}: {name}
        </b>
      </div>
      <p>{rule}</p>
      {(!policy || policy.rebook) && <p>{C.rebook}</p>}
      {cancelRate !== undefined && cancelRate > 0 && <p className="fair-muted">{C.rate(Math.round(cancelRate * 100))}</p>}
      <p className="fair-muted">{C.legal}</p>
    </div>
  );
}

/** Stufe wählen und Springer-Liste (Profil-Editor) */
export function TierPicker({
  value,
  onChange,
  standby,
  onStandby,
}: {
  value: CancelTier;
  onChange: (t: CancelTier) => void;
  standby: boolean;
  onStandby: (v: boolean) => void;
}) {
  const { lang } = useShowly();
  const names = TIER_NAME[lang] ?? TIER_NAME["de"]!;
  return (
    <div className="fair-tiers">
      <div className="fair-tier-grid" role="radiogroup" aria-label="Stornostufe">
        {CANCEL_TIER_IDS.map((t) => (
          <button
            type="button"
            key={t}
            role="radio"
            aria-checked={value === t}
            className={"fair-tier" + (value === t ? " on" : "")}
            onClick={() => onChange(t)}
          >
            <b>{names[t]}</b>
            <small>{tierRule(t, lang)}</small>
          </button>
        ))}
      </div>
      <p className="fair-muted">
        {lang === "en"
          ? "Applies to new bookings. Existing bookings keep the tier they were booked with."
          : lang === "es"
            ? "Se aplica a nuevas reservas. Las reservas existentes conservan su nivel."
            : "Gilt für neue Buchungen. Bestehende Buchungen behalten die Stufe, mit der sie gebucht wurden."}
      </p>
      <label className="fair-check">
        <input type="checkbox" checked={standby} onChange={(e) => onStandby(e.target.checked)} />
        <span>
          <b>{lang === "en" ? "Standby list" : lang === "es" ? "Lista de suplentes" : "Springer-Liste"}</b>{" "}
          {lang === "en"
            ? "I'm happy to step in at short notice when another artist cancels. You're suggested first and get a 10 % bonus."
            : lang === "es"
              ? "Puedo sustituir con poca antelación si otro artista cancela. Te proponemos primero y recibes un 10 % extra."
              : "Ich springe kurzfristig ein, wenn ein anderer Künstler ausfällt. Du wirst zuerst vorgeschlagen und bekommst 10 % Bonus."}
        </span>
      </label>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Umbuchen
 * ------------------------------------------------------------------------ */
export function RebookForm({ id, dateISO, slot, onDone }: { id: number; dateISO: string; slot?: string | undefined; onDone: () => void }) {
  const { rebook, toast } = useShowly();
  const [day, setDay] = useState("");
  const [time, setTime] = useState(slot || "15:00");
  const [busy, setBusy] = useState(false);
  const max = new Date(dateISO + "T12:00:00Z");
  max.setUTCMonth(max.getUTCMonth() + 6);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  return (
    <div className="fair-box">
      <b>Neuer Termin</b>
      <p className="fair-muted">Einmal kostenlos, bis {max.toISOString().slice(0, 10).split("-").reverse().join(".")}.</p>
      <div className="fair-row">
        <input type="date" min={tomorrow} max={max.toISOString().slice(0, 10)} value={day} onChange={(e) => setDay(e.target.value)} aria-label="Neues Datum" />
        <input type="time" step={900} value={time} onChange={(e) => setTime(e.target.value)} aria-label="Uhrzeit" />
        <button
          type="button"
          className="dash26-mini"
          disabled={!day || busy}
          onClick={async () => {
            setBusy(true);
            const err = await rebook(id, day, time);
            setBusy(false);
            if (err) return toast(err);
            toast("Umgebucht. Der Künstler ist informiert.");
            onDone();
          }}
        >
          Umbuchen
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Ersatz-Vorschläge
 * ------------------------------------------------------------------------ */
export function Replacements({ list }: { list: { id: number; name: string; price: number; standby: boolean }[] }) {
  if (!list.length) return null;
  return (
    <div className="fair-box fair-repl">
      <b>
        <Icon name="shield" /> Ersatzgarantie: diese Künstler sind an deinem Termin frei
      </b>
      <ul>
        {list.map((r) => (
          <li key={r.id}>
            <Link to="/kuenstler/$id" params={{ id: String(r.id) }}>
              {r.name}
            </Link>{" "}
            · {euro(r.price)}
            {r.standby ? " · Springer" : ""}
          </li>
        ))}
      </ul>
      <p className="fair-muted">Kostet der Ersatz mehr, übernehmen wir den Aufpreis bis 100 €.</p>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Nachweise hochladen (Fotos, Videos)
 * ------------------------------------------------------------------------ */
type EvRef = { kind: "booking" | "order" | "sweet"; id: number };

export function EvidencePicker({ refTo, value, onChange }: { refTo: EvRef; value: string[]; onChange: (v: string[]) => void }) {
  const { toast, cloudOn } = useShowly();
  const [busy, setBusy] = useState(false);
  async function add(files: FileList | null) {
    if (!files?.length) return;
    if (!cloudOn) {
      onChange([...value, ...Array.from(files).map((f) => `vorschau/${f.name}`)].slice(0, 12));
      return;
    }
    setBusy(true);
    try {
      const { evidenceUploadUrl } = await import("@/utils/fair.functions");
      const { supabase } = await import("@/lib/supabase");
      const out: string[] = [];
      for (const f of Array.from(files).slice(0, 12 - value.length)) {
        const up = await evidenceUploadUrl({ data: { ref: refTo, mime: f.type, bytes: f.size } });
        if ("error" in up) {
          toast(up.error);
          continue;
        }
        const put = await supabase().storage.from("evidence").uploadToSignedUrl(up.path, up.token, f, { contentType: f.type });
        if (put.error) toast("Hochladen hat nicht geklappt");
        else out.push(up.path);
      }
      onChange([...value, ...out]);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="fair-evidence">
      <label className="dash26-mini outline">
        <Icon name="camera" /> {busy ? "Lädt …" : "Fotos/Videos anhängen"}
        <input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm" multiple hidden onChange={(e) => void add(e.target.files)} />
      </label>
      {value.length > 0 && <small>{value.length} Datei(en) angehängt</small>}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Reklamation erstellen
 * ------------------------------------------------------------------------ */
export function ComplaintForm({
  refTo,
  kinds,
  hours,
  onDone,
}: {
  refTo: EvRef;
  /** angebotene Gründe; Standard je nach Art */
  kinds?: ComplaintCat[];
  hours?: number | undefined;
  onDone: () => void;
}) {
  const { toast, cloudOn } = useShowly();
  const cats = kinds ?? (refTo.kind === "booking" ? ["late", "short", "different", "rude"] : refTo.kind === "sweet" ? ["cake", "different"] : ["item", "different"]);
  const [cat, setCat] = useState<ComplaintCat>(cats[0] as ComplaintCat);
  const [body, setBody] = useState("");
  const [lateMin, setLateMin] = useState("");
  const [played, setPlayed] = useState("");
  const [evidence, setEvidence] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const g = guideline(cat, { lateMin: Number(lateMin) || 0, bookedMin: (hours || 2) * 60, playedMin: Number(played) || 0 });
  async function send() {
    if (body.trim().length < 10) return toast("Bitte beschreibe kurz, was passiert ist.");
    if (evidenceRequired(cat) && !evidence.length) return toast("Bitte Fotos oder ein Video anhängen (Pflicht bei Torten und Mietartikeln).");
    if (!cloudOn) {
      toast("Vorschau: Reklamation würde jetzt an den Anbieter gehen.");
      return onDone();
    }
    setBusy(true);
    const { createComplaint } = await import("@/utils/fair.functions");
    const r = await createComplaint({
      data: { ref: refTo, category: cat, body, evidence, lateMin: Number(lateMin) || 0, playedMin: Number(played) || 0 },
    }).catch(() => ({ error: "Senden hat nicht geklappt" }));
    setBusy(false);
    if ("error" in r) return toast(r.error);
    toast("Reklamation gesendet. Der Anbieter hat 48 Stunden für eine Stellungnahme.");
    onDone();
  }
  return (
    <div className="fair-box">
      <b>Reklamieren (bis 48 Stunden nach dem Termin)</b>
      <div className="fair-chips" role="radiogroup" aria-label="Grund">
        {cats.map((c) => (
          <button type="button" key={c} role="radio" aria-checked={cat === c} className={"fair-chip" + (cat === c ? " on" : "")} onClick={() => setCat(c as ComplaintCat)}>
            {COMPLAINT_LABEL[c as ComplaintCat]}
          </button>
        ))}
      </div>
      {cat === "late" && (
        <input inputMode="numeric" placeholder="Wie viele Minuten zu spät?" value={lateMin} onChange={(e) => setLateMin(e.target.value.replace(/\D/g, ""))} aria-label="Minuten zu spät" />
      )}
      {cat === "short" && (
        <input inputMode="numeric" placeholder="Wie viele Minuten wurde gespielt?" value={played} onChange={(e) => setPlayed(e.target.value.replace(/\D/g, ""))} aria-label="Minuten gespielt" />
      )}
      <textarea rows={3} placeholder="Was ist passiert?" value={body} onChange={(e) => setBody(e.target.value)} aria-label="Beschreibung" />
      <EvidencePicker refTo={refTo} value={evidence} onChange={setEvidence} />
      <p className="fair-muted">
        Richtwert: {g.text}. Die Auszahlung an den Anbieter wird angehalten, bis ihr euch einigt oder das Showly-Team innerhalb von 5 Tagen entscheidet. Der Chat
        zählt als Nachweis. Deine gesetzlichen Gewährleistungsrechte bleiben unberührt.
      </p>
      <div className="fair-row">
        <button type="button" className="dash26-mini outline" onClick={onDone}>
          Abbrechen
        </button>
        <button type="button" className="dash26-mini" disabled={busy} onClick={() => void send()}>
          Reklamation senden
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Reklamationen anzeigen (Kunde und Anbieter)
 * ------------------------------------------------------------------------ */
const STATUS: Record<string, string> = {
  open: "offen",
  offer: "Angebot liegt vor",
  agreed: "geeinigt",
  escalated: "beim Showly-Team",
  decided: "entschieden",
  withdrawn: "zurückgezogen",
};

export function ComplaintList({ role }: { role: "customer" | "provider" }) {
  const { toast, cloudOn } = useShowly();
  const [list, setList] = useState<ComplaintInfo[]>([]);
  const [text, setText] = useState<Record<number, string>>({});
  const [cents, setCents] = useState<Record<number, string>>({});
  const load = useCallback(async () => {
    if (!cloudOn) return;
    const { myComplaints } = await import("@/utils/fair.functions");
    const r = await myComplaints().catch(() => []);
    setList(r.filter((c) => c.role === role));
  }, [cloudOn, role]);
  useEffect(() => {
    void load();
  }, [load]);
  if (!list.length) return null;
  async function act(id: number, op: "statement" | "offer" | "accept" | "escalate" | "withdraw") {
    const { complaintAction } = await import("@/utils/fair.functions");
    const c = Math.round(Number((cents[id] || "").replace(",", ".")) * 100) || 0;
    const r = await complaintAction({ data: { id, op, text: text[id] || "", cents: c } }).catch(() => ({ error: "Hat nicht geklappt" }));
    if ("error" in r) return toast(r.error);
    toast("Gespeichert");
    void load();
  }
  return (
    <section className="fair-complaints">
      <h3>Reklamationen</h3>
      {list.map((c) => {
        const open = ["open", "offer", "escalated"].includes(c.status);
        const theirOffer = c.status === "offer" && c.offer_by && c.offer_by !== role;
        return (
          <article key={c.id} className="fair-box">
            <div className="fair-row space">
              <b>{c.title}</b>
              <span className="fair-tag">{STATUS[c.status] ?? c.status}</span>
            </div>
            <p>{c.body}</p>
            {c.evidence.length > 0 && <p className="fair-muted">{c.evidence.length} Nachweis(e) angehängt</p>}
            <p className="fair-muted">Richtwert: {c.guide}</p>
            {c.statement && (
              <p>
                <b>Stellungnahme:</b> {c.statement}
              </p>
            )}
            {c.offer_cents ? (
              <p>
                <b>Angebot:</b> {euro(c.offer_cents / 100)} Teilerstattung ({c.offer_by === "provider" ? "vom Anbieter" : "vom Kunden"})
              </p>
            ) : null}
            {c.decision && (
              <p>
                <b>Ergebnis:</b> {c.decision}
                {c.refund_cents ? ` · ${euro(c.refund_cents / 100)} erstattet` : ""}
              </p>
            )}
            {open && (
              <div className="fair-row wrap">
                {theirOffer && (
                  <button type="button" className="dash26-mini inb-accept" onClick={() => void act(c.id, "accept")}>
                    Angebot annehmen
                  </button>
                )}
                {role === "provider" && !c.statement && (
                  <>
                    <input placeholder="Stellungnahme (48 Stunden Zeit)" value={text[c.id] || ""} onChange={(e) => setText({ ...text, [c.id]: e.target.value })} aria-label="Stellungnahme" />
                    <button type="button" className="dash26-mini" onClick={() => void act(c.id, "statement")}>
                      Stellung nehmen
                    </button>
                  </>
                )}
                <input inputMode="decimal" placeholder="Betrag in €" value={cents[c.id] || ""} onChange={(e) => setCents({ ...cents, [c.id]: e.target.value })} aria-label="Betrag" />
                <button type="button" className="dash26-mini outline" onClick={() => void act(c.id, "offer")}>
                  Teilerstattung vorschlagen
                </button>
                {c.status !== "escalated" && (
                  <button type="button" className="dash26-mini outline" onClick={() => void act(c.id, "escalate")}>
                    Showly entscheiden lassen
                  </button>
                )}
                {role === "customer" && (
                  <button type="button" className="dash26-mini outline inb-decline-ghost" onClick={() => void act(c.id, "withdraw")}>
                    Zurückziehen
                  </button>
                )}
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
}

/* ---------------------------------------------------------------------------
 * Auszahlung schneller
 * ------------------------------------------------------------------------ */
export function PayoutSpeedPicker({ id, net, expressFee, speed, frozen }: { id: number; net: number; expressFee?: number | undefined; speed?: PayoutSpeed | undefined; frozen?: boolean | undefined }) {
  const { setPayoutSpeed, toast } = useShowly();
  const base = net + (expressFee ?? 0);
  const cur = speed ?? "standard";
  if (frozen) return <p className="fair-muted">Angehalten: offene Reklamation. Ausgezahlt wird nach der Klärung.</p>;
  const label: Record<PayoutSpeed, string> = {
    standard: `7 Tage nach dem Event · ${euro(base)}`,
    fast: `3 Tage nach dem Event · −10 % · ${euro(base * (1 - PAYOUT_SPEED.fast.fee))}`,
    express: `innerhalb von 48 Stunden · −20 % · ${euro(base * (1 - PAYOUT_SPEED.express.fee))}`,
  };
  return (
    <div className="fair-speed" role="radiogroup" aria-label="Auszahlung">
      {(["standard", "fast", "express"] as PayoutSpeed[]).map((s) => (
        <button
          type="button"
          key={s}
          role="radio"
          aria-checked={cur === s}
          className={"fair-chip" + (cur === s ? " on" : "")}
          onClick={async () => {
            if (s === cur) return;
            const err = await setPayoutSpeed(id, s);
            toast(err ?? "Auszahlung geändert");
          }}
        >
          {label[s]}
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Verleih: Schadenskatalog, Sorglos-Paket, Übergabeprotokoll
 * ------------------------------------------------------------------------ */
export function DamageCatalog({ deposit }: { deposit?: number | undefined }) {
  return (
    <details className="fair-catalog">
      <summary>Schadenskatalog und Kaution</summary>
      <ul>
        {DAMAGE_CATALOG.map((d) => (
          <li key={d.key}>
            <span>{d.label}</span>
            <b>{d.eur === null ? "Zeitwert" : euro(d.eur)}</b>
          </li>
        ))}
      </ul>
      <p className="fair-muted">
        Normale Reinigung ist im Preis enthalten. Bei verspäteter Rückgabe fällt je Tag der Tagesmietpreis an. Abgezogen wird höchstens die Kaution{deposit ? ` (${euro(deposit)})` : ""}. Ausgabe und Rückgabe werden mit Fotos
        protokolliert. Meldet der Vermieter innerhalb von 72 Stunden nach Rückgabe keinen Schaden, kommt die Kaution automatisch zurück; du kannst jedem Abzug
        widersprechen. Storno: kostenlos bis {RENT_FREE_HOURS / 24} Tage vor Mietbeginn, danach {Math.round(RENT_LATE_RATE * 100)} % plus Versand.
      </p>
    </details>
  );
}

export function CarefreeToggle({ on, onChange, qty = 1 }: { on: boolean; onChange: (v: boolean) => void; qty?: number }) {
  return (
    <label className="fair-check">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <b>Sorglos-Paket +{euro(CAREFREE_EUR * qty)}</b> Kleine Schäden (Fleck, kleiner Riss, fehlendes Teil, starke Verschmutzung) sind abgedeckt.
      </span>
    </label>
  );
}

/** Kunde: Protokoll bestätigen, Schaden ansehen, widersprechen */
export function RentStatus({ orderId, rent }: { orderId: number; rent: { deposit: number; carefree: boolean; handover: HandoverRow; returnedAt?: string; damage?: { cents: number; objected: boolean }; released: boolean } }) {
  const { toast, refreshCloud } = useShowly();
  const [why, setWhy] = useState("");
  const [ask, setAsk] = useState(false);
  const dbId = orderId - 1_000_000_000;
  async function confirm(step: "out" | "back") {
    const { handoverConfirm } = await import("@/utils/fair.functions");
    const r = await handoverConfirm({ data: { orderId: dbId, step } }).catch(() => ({ error: "Hat nicht geklappt" }));
    if ("error" in r) return toast(r.error);
    toast("Bestätigt");
    void refreshCloud();
  }
  async function object() {
    const { objectDamage } = await import("@/utils/fair.functions");
    const r = await objectDamage({ data: { orderId: dbId, text: why } }).catch(() => ({ error: "Hat nicht geklappt" }));
    if ("error" in r) return toast(r.error);
    toast("Widerspruch gesendet. Das Showly-Team prüft die Übergabefotos.");
    setAsk(false);
    void refreshCloud();
  }
  const step = (k: "out" | "back", label: string) => {
    const h = rent.handover[k];
    if (!h) return null;
    return (
      <p>
        <Icon name="camera" /> {label}: {h.photos.length} Foto(s), {new Date(h.at).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}
        {h.confirmed_at ? (
          " · bestätigt"
        ) : (
          <>
            {" "}
            <button type="button" className="dash26-mini outline" onClick={() => void confirm(k)}>
              Zustand bestätigen
            </button>
          </>
        )}
      </p>
    );
  };
  return (
    <div className="fair-box">
      <b>Miete · Kaution {euro(rent.deposit)}</b>
      {rent.carefree && <p className="fair-muted">Sorglos-Paket: kleine Schäden abgedeckt.</p>}
      {step("out", "Ausgabe")}
      {step("back", "Rückgabe")}
      {rent.damage ? (
        <p>
          Einbehalten: {euro(rent.damage.cents / 100)} nach Schadenskatalog.{" "}
          {rent.damage.cents > 0 && !rent.damage.objected && !ask && (
            <button type="button" className="dash26-mini outline" onClick={() => setAsk(true)}>
              Widersprechen
            </button>
          )}
          {rent.damage.objected && " Widerspruch liegt beim Showly-Team."}
        </p>
      ) : rent.released ? (
        <p>Kaution zurückgezahlt.</p>
      ) : rent.returnedAt ? (
        <p className="fair-muted">Ohne Schadensmeldung kommt die Kaution 72 Stunden nach Rückgabe automatisch zurück.</p>
      ) : null}
      {ask && (
        <div className="fair-row wrap">
          <input placeholder="Warum widersprichst du?" value={why} onChange={(e) => setWhy(e.target.value)} aria-label="Begründung" />
          <button type="button" className="dash26-mini" onClick={() => void object()}>
            Senden
          </button>
        </div>
      )}
    </div>
  );
}

/** Anbieter: Übergabe mit Fotos protokollieren und Schaden nach Katalog melden */
export function HandoverTools({ orderId, returned, reported }: { orderId: number; returned: boolean; reported: boolean }) {
  const { toast } = useShowly();
  const [photos, setPhotos] = useState<string[]>([]);
  const [items, setItems] = useState<Record<string, number>>({});
  const [value, setValue] = useState("");
  const [late, setLate] = useState("");
  const ref: EvRef = { kind: "order", id: orderId };
  async function record(step: "out" | "back") {
    const { handoverRecord } = await import("@/utils/fair.functions");
    const r = await handoverRecord({ data: { orderId, step, photos } }).catch(() => ({ error: "Hat nicht geklappt" }));
    if ("error" in r) return toast(r.error);
    setPhotos([]);
    toast(step === "out" ? "Ausgabe protokolliert. Der Kunde bestätigt die Fotos." : "Rückgabe protokolliert. Du hast 72 Stunden, um einen Schaden zu melden.");
  }
  async function damage() {
    const { reportDamage } = await import("@/utils/fair.functions");
    const list = Object.entries(items)
      .filter(([, q]) => q > 0)
      .map(([key, qty]) => ({ key, qty }));
    const r = await reportDamage({
      data: { orderId, items: list, valueCents: Math.round(Number(value.replace(",", ".")) * 100) || 0, lateDays: Number(late) || 0 },
    }).catch(() => ({ error: "Hat nicht geklappt" }));
    if ("error" in r) return toast(r.error);
    toast(r.keptCents ? `${euro(r.keptCents / 100)} einbehalten, Rest erstattet` : "Kaution vollständig erstattet");
  }
  return (
    <div className="fair-box">
      <b>Übergabeprotokoll</b>
      <EvidencePicker refTo={ref} value={photos} onChange={setPhotos} />
      <div className="fair-row wrap">
        {!returned && (
          <button type="button" className="dash26-mini outline" disabled={!photos.length} onClick={() => void record("out")}>
            Ausgabe protokollieren
          </button>
        )}
        <button type="button" className="dash26-mini outline" disabled={!photos.length} onClick={() => void record("back")}>
          Rückgabe protokollieren
        </button>
      </div>
      {returned && !reported && (
        <>
          <b>Schaden melden (bis 72 Stunden nach Rückgabe)</b>
          <ul className="fair-catalog-pick">
            {DAMAGE_CATALOG.map((d) => (
              <li key={d.key}>
                <label>
                  <input
                    type="checkbox"
                    checked={(items[d.key] ?? 0) > 0}
                    onChange={(e) => setItems({ ...items, [d.key]: e.target.checked ? 1 : 0 })}
                  />{" "}
                  {d.label} · {d.eur === null ? "Zeitwert" : euro(d.eur)}
                </label>
              </li>
            ))}
          </ul>
          {(items["verlust"] ?? 0) > 0 && (
            <input inputMode="decimal" placeholder="Zeitwert in €" value={value} onChange={(e) => setValue(e.target.value)} aria-label="Zeitwert" />
          )}
          <label className="fair-row">
            <span>Verspätete Rückgabe (Tage, je Tag Tagesmietpreis)</span>
            <input inputMode="numeric" placeholder="0" value={late} onChange={(e) => setLate(e.target.value.replace(/\D/g, "").slice(0, 2))} aria-label="Tage zu spät" />
          </label>
          <button type="button" className="dash26-mini" onClick={() => void damage()}>
            {Object.values(items).some((q) => q > 0) || Number(late) > 0 ? "Abzug melden, Rest erstatten" : "Kein Schaden: Kaution erstatten"}
          </button>
        </>
      )}
    </div>
  );
}
