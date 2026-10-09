/* Wochenendzuschlag und Saisonpreise pflegen (Profil-Editor der Künstler
 * und Planer). Regeln in showly/surcharges.ts. */
import { useShowly } from "@/showly/store";
import { Icon } from "@/showly/ui";
import type { Season, Surcharges } from "@/showly/surcharges";

const PRESETS: Season[] = [
  { from: "12-01", to: "12-24", pct: 20, label: "Weihnachtszeit" },
  { from: "12-25", to: "01-06", pct: 25, label: "Feiertage" },
  { from: "02-01", to: "02-28", pct: 15, label: "Fasching" },
  { from: "10-20", to: "10-31", pct: 15, label: "Halloween" },
  { from: "05-01", to: "09-30", pct: 10, label: "Hochzeitssaison" },
  { from: "01-07", to: "01-31", pct: -10, label: "Nebensaison" },
];

const toInput = (md: string) => `2026-${md}`;
const fromInput = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v.slice(5) : "");

export function PriceRules({ value, onChange, price }: { value: Surcharges | null; onChange: (v: Surcharges | null) => void; price: number }) {
  const { fmt } = useShowly();
  const v: Surcharges = value ?? { weekend: 0, seasons: [] };
  /* Roh weitergeben; aufgeräumt wird beim Speichern (cleanSurcharges) */
  const set = (next: Surcharges) => onChange(next);
  const upd = (i: number, patch: Partial<Season>) =>
    set({ ...v, seasons: v.seasons.map((s, k) => (k === i ? { ...s, ...patch } : s)) });
  return (
    <div className="pr-rules">
      <label className="pe-field">
        <span className="pe-label">Wochenendzuschlag (Samstag und Sonntag)</span>
        <div className="pr-row">
          <input
            type="number"
            min={0}
            max={100}
            inputMode="numeric"
            value={v.weekend || ""}
            placeholder="0"
            onChange={(e) => set({ ...v, weekend: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
            aria-label="Wochenendzuschlag in Prozent"
          />
          <span>%</span>
          {v.weekend > 0 && price > 0 && <small>z. B. {fmt(Math.round(price * (1 + v.weekend / 100)))} statt {fmt(price)}</small>}
        </div>
      </label>
      <span className="pe-label">Saisonpreise (jedes Jahr wiederkehrend)</span>
      {v.seasons.map((s, i) => (
        <div className="pr-season" key={i}>
          <input value={s.label} maxLength={40} placeholder="Name, z. B. Weihnachtszeit" onChange={(e) => upd(i, { label: e.target.value })} aria-label="Name der Saison" />
          <div className="pr-row">
            <input type="date" value={toInput(s.from)} onChange={(e) => upd(i, { from: fromInput(e.target.value) || s.from })} aria-label="von" />
            <span>–</span>
            <input type="date" value={toInput(s.to)} onChange={(e) => upd(i, { to: fromInput(e.target.value) || s.to })} aria-label="bis" />
          </div>
          <div className="pr-row">
            <input
              type="number"
              min={-50}
              max={100}
              value={s.pct}
              onChange={(e) => upd(i, { pct: Math.max(-50, Math.min(100, Number(e.target.value) || 0)) })}
              aria-label="Zuschlag in Prozent (negativ = Rabatt)"
            />
            <span>% {s.pct < 0 ? "Rabatt" : "Zuschlag"}</span>
            <button type="button" className="dash26-mini outline inb-decline-ghost" onClick={() => set({ ...v, seasons: v.seasons.filter((_, k) => k !== i) })}>
              <Icon name="trash" /> Entfernen
            </button>
          </div>
        </div>
      ))}
      {v.seasons.length < 8 && (
        <div className="pr-presets">
          {PRESETS.filter((p) => !v.seasons.some((s) => s.label === p.label)).map((p) => (
            <button type="button" key={p.label} className="fair-chip" onClick={() => onChange({ ...v, seasons: [...v.seasons, p] })}>
              + {p.label} {p.pct > 0 ? "+" : "−"}
              {Math.abs(p.pct)} %
            </button>
          ))}
          <button type="button" className="fair-chip" onClick={() => onChange({ ...v, seasons: [...v.seasons, { from: "06-01", to: "06-30", pct: 10, label: "" }] })}>
            + Eigene Saison
          </button>
        </div>
      )}
      <p className="fair-muted">
        Kunden sehen den Preis für ihr gewähltes Datum vor der Buchung, mit Hinweis auf den Zuschlag. Wochenende und Saison werden addiert (höchstens +150 %).
        Gilt für neue Buchungen.
      </p>
    </div>
  );
}
