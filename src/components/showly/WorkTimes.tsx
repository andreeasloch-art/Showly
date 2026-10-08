/* Künstler-Kalender: feste Arbeitszeiten je Wochentag und Urlaub bzw.
 * Abwesenheit als Zeitraum. Beides sperrt Termine für Kunden; die
 * Datenbank prüft die Arbeitszeiten beim Buchen noch einmal (claim_slots).
 * Bestehende Buchungen bleiben bestehen. */
import { useState } from "react";
import { useShowly } from "@/showly/store";
import { ARTISTS } from "@/showly/data";
import { Icon, todayISO } from "@/showly/ui";
import { DateField } from "@/components/showly/DateField";
import { WEEK_ORDER, cleanWorkHours, type WorkHours } from "@/showly/workHours";
import { addDaysISO } from "@/showly/cakeRules";

type Lang = "de" | "en" | "es";
type Day = (typeof WEEK_ORDER)[number];

const COPY = {
  de: {
    whH: "Arbeitszeiten",
    whP: "An welchen Tagen und zu welchen Uhrzeiten können Kunden dich buchen? Die Show muss ganz in die Zeit passen. Ohne Arbeitszeiten bist du jeden Tag von 10 bis 21 Uhr buchbar.",
    on: "Arbeitszeiten verwenden",
    days: { "1": "Montag", "2": "Dienstag", "3": "Mittwoch", "4": "Donnerstag", "5": "Freitag", "6": "Samstag", "0": "Sonntag" } as Record<Day, string>,
    from: "von",
    to: "bis",
    save: "Speichern",
    saved: "Arbeitszeiten gespeichert.",
    vacH: "Urlaub und Abwesenheit",
    vacP: "Sperrt ganze Tage, z. B. Urlaub. Bestehende Buchungen bleiben bestehen.",
    vFrom: "Erster Tag",
    vTo: "Letzter Tag",
    block: "Zeitraum sperren",
    free: "Zeitraum freigeben",
    bad: "Bitte einen gültigen Zeitraum wählen (höchstens 120 Tage, nicht in der Vergangenheit).",
    blocked: (n: number) => `${n} Tage gesperrt.`,
    freed: (n: number) => `${n} Tage freigegeben.`,
  },
  en: {
    whH: "Working hours",
    whP: "On which days and at what times can customers book you? The show must fit entirely. Without working hours you can be booked every day from 10 am to 9 pm.",
    on: "Use working hours",
    days: { "1": "Monday", "2": "Tuesday", "3": "Wednesday", "4": "Thursday", "5": "Friday", "6": "Saturday", "0": "Sunday" } as Record<Day, string>,
    from: "from",
    to: "to",
    save: "Save",
    saved: "Working hours saved.",
    vacH: "Holidays and time off",
    vacP: "Blocks whole days, e.g. holidays. Existing bookings stay in place.",
    vFrom: "First day",
    vTo: "Last day",
    block: "Block period",
    free: "Unblock period",
    bad: "Please choose a valid period (max. 120 days, not in the past).",
    blocked: (n: number) => `${n} days blocked.`,
    freed: (n: number) => `${n} days unblocked.`,
  },
  es: {
    whH: "Horario de trabajo",
    whP: "¿Qué días y a qué horas pueden reservarte? El show debe caber entero. Sin horario puedes ser reservado todos los días de 10 a 21 h.",
    on: "Usar horario",
    days: { "1": "Lunes", "2": "Martes", "3": "Miércoles", "4": "Jueves", "5": "Viernes", "6": "Sábado", "0": "Domingo" } as Record<Day, string>,
    from: "de",
    to: "a",
    save: "Guardar",
    saved: "Horario guardado.",
    vacH: "Vacaciones y ausencias",
    vacP: "Bloquea días completos, p. ej. vacaciones. Las reservas existentes se mantienen.",
    vFrom: "Primer día",
    vTo: "Último día",
    block: "Bloquear periodo",
    free: "Liberar periodo",
    bad: "Elige un periodo válido (máx. 120 días, no en el pasado).",
    blocked: (n: number) => `${n} días bloqueados.`,
    freed: (n: number) => `${n} días liberados.`,
  },
} as const;

const HOURS = Array.from({ length: 25 }, (_, i) => i);

export function WorkTimes({ artistId }: { artistId: number }) {
  const { lang, toast, session, setDaysBlocked } = useShowly();
  const C = COPY[(lang as Lang) ?? "de"] ?? COPY.de;
  const artist = ARTISTS.find((a) => a.id === artistId);
  const [use, setUse] = useState(!!artist?.workHours);
  const [wh, setWh] = useState<WorkHours>(
    artist?.workHours ?? { "1": [14, 20], "2": [14, 20], "3": [14, 20], "4": [14, 20], "5": [14, 21], "6": [10, 21], "0": [10, 20] },
  );
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);

  function setDay(d: Day, v: [number, number] | null) {
    setWh((w) => {
      const next = { ...w };
      if (v) next[d] = v;
      else delete next[d];
      return next;
    });
  }

  async function saveHours() {
    const clean = use ? cleanWorkHours(wh) : null;
    setBusy(true);
    const fromDb = (artist as { fromDb?: boolean } | undefined)?.fromDb;
    if (fromDb && session?.backend) {
      const { setWorkHoursCloud } = await import("@/utils/community.functions");
      const r = await setWorkHoursCloud({ data: { artistId, workHours: clean } }).catch(() => ({ error: "Netzwerkfehler" }));
      setBusy(false);
      if ("error" in r) return toast(r.error);
    } else setBusy(false);
    if (artist) artist.workHours = clean;
    toast(C.saved);
  }

  function range(): string[] | null {
    if (!from || !to || to < from || from < todayISO()) return null;
    const out: string[] = [];
    for (let d = from; d <= to && out.length <= 120; d = addDaysISO(d, 1)) out.push(d);
    return out.length > 120 ? null : out;
  }

  async function vacation(blocked: boolean) {
    const days = range();
    if (!days) return toast(C.bad);
    setBusy(true);
    const r = await setDaysBlocked(artistId, days, blocked);
    setBusy(false);
    if (r !== "ok") return toast(r);
    toast(blocked ? C.blocked(days.length) : C.freed(days.length));
  }

  return (
    <div className="worktimes">
      <section className="acc-sec">
        <div className="acc-sec-head">
          <span className="acc-sec-ic">
            <Icon name="clock" />
          </span>
          <div>
            <h3>{C.whH}</h3>
            <p>{C.whP}</p>
          </div>
        </div>
        <label className="food-none">
          <input type="checkbox" checked={use} onChange={(e) => setUse(e.target.checked)} />
          {C.on}
        </label>
        {use && (
          <div className="wt-days">
            {WEEK_ORDER.map((d) => {
              const v = wh[d];
              return (
                <div className="wt-row" key={d}>
                  <label className="wt-day">
                    <input type="checkbox" checked={!!v} onChange={(e) => setDay(d, e.target.checked ? [14, 20] : null)} />
                    {C.days[d]}
                  </label>
                  {v && (
                    <span className="wt-time">
                      <span className="sr-only">{C.from}</span>
                      <select aria-label={`${C.days[d]} ${C.from}`} value={v[0]} onChange={(e) => setDay(d, [Number(e.target.value), Math.max(Number(e.target.value) + 1, v[1])])}>
                        {HOURS.slice(0, 24).map((h) => (
                          <option key={h} value={h}>
                            {String(h).padStart(2, "0")}:00
                          </option>
                        ))}
                      </select>
                      –
                      <select aria-label={`${C.days[d]} ${C.to}`} value={v[1]} onChange={(e) => setDay(d, [v[0], Number(e.target.value)])}>
                        {HOURS.filter((h) => h > v[0]).map((h) => (
                          <option key={h} value={h}>
                            {String(h).padStart(2, "0")}:00
                          </option>
                        ))}
                      </select>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <button type="button" className="acc-sec-btn" disabled={busy} onClick={() => void saveHours()}>
          {C.save}
        </button>
      </section>

      <section className="acc-sec">
        <div className="acc-sec-head">
          <span className="acc-sec-ic">
            <Icon name="calendar" />
          </span>
          <div>
            <h3>{C.vacH}</h3>
            <p>{C.vacP}</p>
          </div>
        </div>
        <div className="pe-grid2">
          <div className="pe-field">
            <span className="pe-label">{C.vFrom}</span>
            <DateField value={from} onChange={setFrom} label={C.vFrom} />
          </div>
          <div className="pe-field">
            <span className="pe-label">{C.vTo}</span>
            <DateField value={to} onChange={setTo} label={C.vTo} />
          </div>
        </div>
        <div className="acc-sec-actions">
          <button type="button" className="home-btn primary" disabled={busy} onClick={() => void vacation(true)}>
            {C.block}
          </button>
          <button type="button" className="home-btn soft" disabled={busy} onClick={() => void vacation(false)}>
            {C.free}
          </button>
        </div>
      </section>
    </div>
  );
}
