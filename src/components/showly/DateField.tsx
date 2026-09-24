/* Datumsfeld der Suche: Beim Klick öffnet sich ein großer Monatskalender
 * statt der kleinen Browser-Auswahl. Vergangene Tage sind gesperrt, heute ist
 * markiert, und zwei Schnellwahlen decken die häufigsten Fälle ab. */
import { useEffect, useMemo, useRef, useState } from "react";
import { useShowly } from "@/showly/store";
import { Icon, isoOf, todayISO } from "@/showly/ui";

const LABELS = {
  de: {
    open: "Datum wählen",
    today: "Heute",
    weekend: "Nächstes Wochenende",
    clear: "Zurücksetzen",
    close: "Fertig",
    dows: ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"],
    prev: "Voriger Monat",
    next: "Nächster Monat",
  },
  en: {
    open: "Pick a date",
    today: "Today",
    weekend: "Next weekend",
    clear: "Clear",
    close: "Done",
    dows: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    prev: "Previous month",
    next: "Next month",
  },
  es: {
    open: "Elegir fecha",
    today: "Hoy",
    weekend: "Próximo fin de semana",
    clear: "Borrar",
    close: "Listo",
    dows: ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"],
    prev: "Mes anterior",
    next: "Mes siguiente",
  },
} as const;

function localeOf(lang: string) {
  return lang === "en" ? "en-GB" : lang === "es" ? "es-ES" : "de-DE";
}

export function DateField({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (iso: string) => void;
  label: string;
}) {
  const { lang } = useShowly();
  const T = LABELS[(lang as "de" | "en" | "es") ?? "de"] ?? LABELS.de;
  const wrap = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const now = useMemo(() => new Date(), []);
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const today = todayISO();

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    window.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);

  const first = new Date(ym.y, ym.m, 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(ym.y, ym.m + 1, 0).getDate();
  const monthLabel = first.toLocaleDateString(localeOf(lang), { month: "long", year: "numeric" });

  function shift(d: number) {
    const next = new Date(ym.y, ym.m + d, 1);
    setYm({ y: next.getFullYear(), m: next.getMonth() });
  }

  function pick(iso: string) {
    onChange(iso);
    setOpen(false);
  }

  function nextWeekend() {
    const d = new Date();
    const toSaturday = (6 - ((d.getDay() + 6) % 7) + 7) % 7 || 7;
    d.setDate(d.getDate() + toSaturday);
    setYm({ y: d.getFullYear(), m: d.getMonth() });
    pick(isoOf(d.getFullYear(), d.getMonth(), d.getDate()));
  }

  const pretty = value
    ? new Date(value + "T00:00:00").toLocaleDateString(localeOf(lang), {
        weekday: "short",
        day: "numeric",
        month: "long",
      })
    : "";

  return (
    <div className="ac-wrap df-wrap" ref={wrap}>
      <button
        type="button"
        className="df-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span className="search-field-lbl">{label}</span>
        <span className={"df-value" + (value ? " set" : "")}>{pretty || T.open}</span>
      </button>

      {open && (
        <div className="df-pop" role="dialog" aria-label={T.open}>
          <div className="df-head">
            <button className="df-nav" onClick={() => shift(-1)} aria-label={T.prev}>
              ‹
            </button>
            <div className="df-month">{monthLabel}</div>
            <button className="df-nav" onClick={() => shift(1)} aria-label={T.next}>
              ›
            </button>
          </div>

          <div className="df-dows">
            {T.dows.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>

          <div className="df-grid">
            {Array.from({ length: lead }).map((_, i) => (
              <span className="df-day empty" key={"e" + i} />
            ))}
            {Array.from({ length: days }).map((_, i) => {
              const iso = isoOf(ym.y, ym.m, i + 1);
              const past = iso < today;
              const cls =
                "df-day" +
                (past ? " past" : "") +
                (iso === today ? " today" : "") +
                (iso === value ? " sel" : "");
              return (
                <button
                  key={iso}
                  className={cls}
                  disabled={past}
                  onClick={() => pick(iso)}
                  aria-current={iso === value ? "date" : undefined}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>

          <div className="df-foot">
            <button className="df-quick" onClick={() => pick(today)}>
              <Icon name="calendar" /> {T.today}
            </button>
            <button className="df-quick" onClick={nextWeekend}>
              <Icon name="party" /> {T.weekend}
            </button>
            {value && (
              <button className="df-quick ghost" onClick={() => pick("")}>
                {T.clear}
              </button>
            )}
            <button className="df-done" onClick={() => setOpen(false)}>
              {T.close}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
