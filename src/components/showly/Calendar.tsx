/* Verfügbarkeits-Kalender – Besucher-Ansicht (Slot wählen) und
   Anbieter-Ansicht (Slots sperren/freigeben). Portiert aus dem Prototyp. */
import { useEffect, useState } from "react";
import { useShowly } from "@/showly/store";
import { Icon, SLOTS, isoOf, todayISO } from "@/showly/ui";
import { SLOT_STEP_H, unavailable } from "@/showly/schedule";

export interface CalSel {
  date: string | null;
  slot: string | null;
}

export function useCalendar() {
  const now = new Date();
  const [sel, setSel] = useState<CalSel>({ date: null, slot: null });
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  return { sel, setSel, ym, setYm };
}

export function Calendar({
  providerId,
  owner = false,
  sel,
  setSel,
  ym,
  setYm,
  id,
  hours = SLOT_STEP_H,
}: {
  providerId: number;
  /** Dauer der Show, die gebucht werden soll (Besucher-Ansicht) */
  hours?: number;
  owner?: boolean;
  sel: CalSel;
  setSel: (s: CalSel) => void;
  ym: { y: number; m: number };
  setYm: (v: { y: number; m: number }) => void;
  id?: string;
}) {
  const { t, lang, fmtDate, bookedSlots, toggleBlock, toast } = useShowly();
  const tISO = todayISO();

  /* Selbst gesperrt oder Startzeit einer Buchung */
  const explicitOn = (iso: string) =>
    bookedSlots(providerId, iso).flatMap((e) => (e === "all" ? SLOTS : [e.split("+")[0]!]));
  /* Besucher: was für eine Show dieser Länge samt einer Stunde Fahrtzeit
     vor und nach anderen Buchungen nicht mehr geht (schedule.ts).
     Anbieter: was er selbst gesperrt hat bzw. was gebucht ist. */
  const blockedOn = (iso: string) =>
    owner ? explicitOn(iso) : unavailable(SLOTS, hours, bookedSlots(providerId, iso));
  /* Nur durch die Fahrtzeit nach bzw. vor einer Buchung belegt */
  const travelOn = (iso: string) => {
    const mine = explicitOn(iso);
    return unavailable(SLOTS, 1, bookedSlots(providerId, iso).filter((e) => e.includes("+"))).filter(
      (s) => !mine.includes(s),
    );
  };
  const freeOn = (iso: string) => SLOTS.filter((s) => !blockedOn(iso).includes(s));

  /* Längere Show gewählt: passt die gewählte Zeit nicht mehr, Auswahl lösen */
  useEffect(() => {
    if (!owner && sel.date && sel.slot && blockedOn(sel.date).includes(sel.slot)) {
      setSel({ date: sel.date, slot: null });
      toast(t("cal.travelClash"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hours]);

  function dayState(iso: string) {
    if (iso < tISO) return "past";
    const b = blockedOn(iso);
    if (b.includes("all") || b.length >= SLOTS.length) return "full";
    if (b.length) return "part";
    return "free";
  }

  const first = new Date(ym.y, ym.m, 1);
  const start = (first.getDay() + 6) % 7;
  const days = new Date(ym.y, ym.m + 1, 0).getDate();
  const monthLabel = first.toLocaleDateString(lang === "de" ? "de-DE" : lang === "es" ? "es-ES" : "en-GB", {
    month: "long",
    year: "numeric",
  });

  function shift(d: number) {
    let m = ym.m + d;
    let y = ym.y;
    if (m < 0) {
      m = 11;
      y--;
    }
    if (m > 11) {
      m = 0;
      y++;
    }
    setYm({ y, m });
  }

  function pickDay(iso: string) {
    setSel({ date: sel.date === iso ? null : iso, slot: null });
  }

  function pickSlot(sl: string) {
    if (owner) {
      if (travelOn(sel.date!).includes(sl)) return toast(t("cal.travelNote"));
      toggleBlock(providerId, sel.date!, sl);
      toast(
        blockedOn(sel.date!).includes(sl)
          ? t("toast.slotFree", { s: sl })
          : t("toast.slotBlocked", { s: sl }),
      );
      return;
    }
    if (blockedOn(sel.date!).includes(sl)) return toast(t("cal.conflict"));
    setSel({ date: sel.date, slot: sel.slot === sl ? null : sl });
  }

  const cells = [];
  for (let i = 0; i < start; i++) cells.push(<div className="cal-day empty" key={"e" + i} />);
  for (let d = 1; d <= days; d++) {
    const iso = isoOf(ym.y, ym.m, d);
    const st = dayState(iso);
    const cls = ["cal-day", st];
    if (owner && st !== "past") cls.push("owner");
    if (iso === tISO) cls.push("today");
    if (sel.date === iso) cls.push("sel");
    const clickable = !(st === "past" || (st === "full" && !owner));
    /* Im Kästchen nur ein Punkt bzw. Strich; die Zahl freier Zeitfenster
       steht im Namen des Knopfs für Vorlesehilfen und im Tooltip. Vorher
       standen "7 / 4 / frei" untereinander und waren nicht zu verstehen. */
    const nFree = freeOn(iso).length;
    const mini = st === "full" && owner ? t("cal.blocked") : "";
    const label =
      st === "part"
        ? `${d}. – ${nFree} ${t("cal.slotFree")}`
        : st === "full"
          ? `${d}. – ${t("cal.full")}`
          : st === "free"
            ? `${d}. – ${t("cal.free")}`
            : String(d);
    cells.push(
      <button
        className={cls.join(" ")}
        key={iso}
        disabled={!clickable}
        aria-label={label}
        title={label}
        aria-pressed={sel.date === iso}
        onClick={() => clickable && pickDay(iso)}
      >
        {d}
        {st === "part" && !owner && <span className="cal-dot" aria-hidden="true" />}
        {mini && <span className="cal-mini">{mini}</span>}
      </button>,
    );
  }

  return (
    <>
      <div className="cal" id={id}>
        <div className="cal-head">
          <div className="cal-title">{monthLabel}</div>
          <div className="cal-nav">
            <button className="cal-arrow" onClick={() => shift(-1)} aria-label="zurück">
              ‹
            </button>
            <button className="cal-arrow" onClick={() => shift(1)} aria-label="weiter">
              ›
            </button>
          </div>
        </div>
        <div className="cal-dows">
          {t("dows")
            .split(",")
            .map((x) => (
              <div className="cal-dow" key={x}>
                {x}
              </div>
            ))}
        </div>
        <div className="cal-grid">{cells}</div>
        <div className="cal-legend">
          <span>
            <i className="lg-box lg-free" />
            {t("cal.free")}
          </span>
          <span>
            <i className="lg-box lg-part" />
            {t("cal.part")}
          </span>
          <span>
            <i className="lg-box lg-full" />
            {t("cal.full")}
          </span>
          <span>
            <i className="lg-box lg-today" />
            {t("cal.today")}
          </span>
        </div>
      </div>

      <div className="slot-panel">
        {!sel.date ? (
          <div className="slot-panel-s">{owner ? t("cal.ownerHint") : t("cal.pickDay")}</div>
        ) : (
          <>
            <div className="slot-panel-h">{t("cal.slotsOf", { d: fmtDate(sel.date) })}</div>
            <div className="slot-panel-s">{owner ? t("cal.ownerHint") : t("cal.pickSlot")}</div>
            <div className="slot-grid">
              {SLOTS.map((sl) => {
                const taken = blockedOn(sel.date!).includes(sl);
                const travel = !taken && owner && travelOn(sel.date!).includes(sl);
                const cls = [
                  "slot",
                  owner ? "owner" : "",
                  taken ? (owner ? "mine" : "taken") : travel ? "taken" : "",
                  !owner && sel.slot === sl ? "on" : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <button className={cls} key={sl} onClick={() => pickSlot(sl)}>
                    {sl}
                    <small>{travel ? t("cal.travel") : taken ? t("cal.blocked") : t("cal.slotFree")}</small>
                  </button>
                );
              })}
            </div>
            {bookedSlots(providerId, sel.date).some((e) => e.includes("+")) && (
              <div className="mini-note" style={{ marginTop: 10 }}>
                {t("cal.travelNote")}
              </div>
            )}
            {!owner && sel.slot && (
              <div className="sel-banner">
                <Icon name="check" /> {t("cal.selected", { d: fmtDate(sel.date), s: sel.slot })}
              </div>
            )}
            {!owner && !sel.slot && !freeOn(sel.date).length && (
              <div className="mini-note" style={{ marginTop: 10 }}>
                {t("cal.noSlots")}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
