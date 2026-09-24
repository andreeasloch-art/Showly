/* Dreistufiges Buchungs-Modal: Details → Zahlung → Bestätigung. */
import { useState } from "react";
import { BookingModeNote } from "@/components/showly/BookingModeNote";
import { useNavigate } from "@tanstack/react-router";
import type { Artist } from "@/showly/data";
import { useShowly } from "@/showly/store";
import { CatIcon, Icon, bgOf, hasImg } from "@/showly/ui";
import { figName } from "@/showly/figures";
import { ContactHint, useContactCheck } from "@/components/showly/ContactHint";


const COPY = {
  de: { toCart: "In den Warenkorb", summaryH: "Zusammenfassung", note: "Deko, Torte und weitere Acts kannst du im Warenkorb dazulegen und alles zusammen bezahlen." },
  en: { toCart: "Add to cart", summaryH: "Summary", note: "Add decor, a cake or more acts in your cart and pay for everything together." },
  es: { toCart: "Añadir al carrito", summaryH: "Resumen", note: "Añade decoración, tarta u otros artistas en el carrito y paga todo junto." },
} as const;

export function BookingModal({
  artist: a,
  date,
  slot,
  figure,
  pkg,
  hours: startHours,
  guests,
  loc,
  onClose,
}: {
  artist: Artist;
  date: string;
  slot: string;
  figure: string | null;
  pkg: { id: string; name: unknown; price: number } | null;
  /** Im Profil gewählte Dauer in Stunden */
  hours?: number;
  guests: string;
  loc: string;
  onClose: () => void;
}) {
  const okText = useContactCheck();
  const { t, lang, L, fmt, num, fmtDate, addCartBooking } = useShowly();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const C = COPY[(lang as "de" | "en" | "es") ?? "de"] ?? COPY.de;
  const [g, setG] = useState(guests);
  const minHours = Math.max(1, Number(a["minHours"]) || 1);
  const [hours, setHours] = useState(Math.max(minHours, startHours ?? 2));
  const [l, setL] = useState(loc);

  /* Gage pro Stunde mal Dauer. Feste Pakete der Planer kosten einmal ihren
     Paketpreis, unabhängig von Stunden. */
  const hourly = a.price;
  const base = pkg ? pkg.price : hourly * hours;
  const fee = Math.round(base * 0.2);
  const total = base + fee;

  const [occasion, setOccasion] = useState("");
  const [notes, setNotes] = useState("");

  /* Die Buchung kommt in den Warenkorb, bezahlt wird an der Kasse
     zusammen mit Deko und Torten. „Jetzt bezahlen“ geht direkt dorthin. */
  function toCart(payNow: boolean) {
    if (!okText(notes)) return;
    addCartBooking(
      {
        artistId: a.id,
        dateISO: date,
        slot,
        hours,
        ...(pkg ? { pkg: pkg.id } : {}),
        ...(figure ? { figure } : {}),
        ...(g ? { guests: String(g).slice(0, 6) } : {}),
        ...(l.trim() ? { address: l.trim().slice(0, 120) } : {}),
        ...(occasion ? { occasion } : {}),
        ...(notes.trim() ? { notes: notes.trim().slice(0, 500) } : {}),
      },
      { quiet: payNow },
    );
    onClose();
    if (payNow) navigate({ to: "/checkout" });
  }

  return (
    <div>
      <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="modal">
          <div className="modal-head">
            <h2>{step === 1 ? t("mod.request") : C.summaryH}</h2>
            <button className="modal-close" onClick={onClose}>
              ✕
            </button>
          </div>
          <div className="modal-body">
            <div className="steps-bar">
              <div className="step-dot on" />
              <div className={"step-dot" + (step > 1 ? " on" : "")} />
            </div>

            {step === 1 && (
              <>
                <div className="modal-artist-row">
                  <div className="modal-artist-icon" style={bgOf(a)}>
                    {!hasImg(a) && (
                      <span className="img-fallback">
                        <CatIcon id={a.cat} />
                      </span>
                    )}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 3 }}>{L(a.name)}</div>
                    <div style={{ fontSize: 13, color: "var(--sh-muted)" }}>
                      {a.reviews > 0 ? `★ ${num(a.rating)} (${a.reviews} ${t("misc.reviews")}) · ` : `${t("card.new")} · `}
                      {L(a.loc)}
                    </div>
                  </div>
                </div>
                <div className="modal-section-title">{t("mod.eventDetails")}</div>
                <div className="sel-banner" style={{ marginBottom: 14 }}>
                  <Icon name="calendar" /> {fmtDate(date)} · {slot} {t("misc.uhr")}
                </div>
                {pkg && (
                  <div className="sel-banner" style={{ marginBottom: 14 }}>
                    <Icon name="gift" /> {t("book.pkgLbl")}: {L(pkg.name)} · {fmt(pkg.price)}
                  </div>
                )}
                {figure && (
                  <div className="sel-banner" style={{ marginBottom: 14 }}>
                    <Icon name="mask" /> {t("book.figure")}: {figName(a.cat, figure, lang)}
                  </div>
                )}
                <div className="two-col">
                  <div className="input-group">
                    <label>{t("mod.guests")}</label>
                    <input
                      type="number"
                      min={1}
                      placeholder="30"
                      value={g}
                      onChange={(e) => setG(e.target.value)}
                    />
                  </div>
                  {!pkg && (
                    <div className="input-group">
                      <label htmlFor="mod-hours">{t("mod.duration")}</label>
                      <select
                        id="mod-hours"
                        value={hours}
                        onChange={(e) => setHours(Number(e.target.value))}
                      >
                        {Array.from({ length: 12 - minHours + 1 }, (_, i) => minHours + i).map((n) => (
                          <option value={n} key={n}>
                            {t("book.hoursVal", { n })} · {fmt(Math.round(hourly * n * 1.2))}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <div className="input-group">
                  <label>{t("mod.address")}</label>
                  <input
                    type="text"
                    maxLength={120}
                    placeholder={t("mod.addressPh")}
                    value={l}
                    onChange={(e) => setL(e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label>{t("mod.occasion")}</label>
                  <select value={occasion} onChange={(e) => setOccasion(e.target.value)}>
                    {["occ1", "occ2", "occ3", "occ4", "occ5"].map((o) => (
                      <option key={o} value={t("mod." + o)}>{t("mod." + o)}</option>
                    ))}
                  </select>
                </div>
                <div className="input-group">
                  <label>{t("mod.notes")}</label>
                  <textarea rows={2} maxLength={500} placeholder={t("mod.notesPh")} value={notes} onChange={(e) => setNotes(e.target.value)} />
                  <ContactHint text={notes} />
                </div>
                <button className="btn-primary" style={{ width: "100%" }} onClick={() => okText(notes) && setStep(2)}>
                  {t("mod.continue")}
                </button>
              </>
            )}

            {step === 2 && (
              <>
                <div className="confirm-card">
                  <div style={{ fontWeight: 800, marginBottom: 11, fontSize: 15 }}>
                    {t("mod.summary")}
                  </div>
                  <div className="pb-row">
                    <span>
                      {pkg
                        ? `${t("book.pkgLbl")}: ${String(L(pkg.name))}`
                        : `${t("mod.feeFor", { name: L(a.name) })} · ${t("book.timesH", { p: fmt(hourly), n: hours })}`}
                    </span>
                    <span>{fmt(base)}</span>
                  </div>
                  <div className="pb-row">
                    <span>{t("book.fee")}</span>
                    <span>{fmt(fee)}</span>
                  </div>
                  <p className="mod-cart-note">
                    <Icon name="cart" /> {C.note}
                  </p>
                  <div className="pb-row">
                    <span>{t("book.date")}</span>
                    <span>
                      {fmtDate(date)} · {slot} {t("misc.uhr")}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontWeight: 800,
                      fontSize: 18,
                      borderTop: "1px solid rgba(0,0,0,.1)",
                      paddingTop: 9,
                    }}
                  >
                    <span>{t("book.total")}</span>
                    <span>{fmt(total)}</span>
                  </div>
                </div>
                <BookingModeNote artist={a} />
                <div className="policy-box">
                  <Icon name="lock" /> <strong>{t("mod.cancelPolicy")}</strong> {t("mod.cancelText")}
                </div>
                <div className="mod-actions">
                  <button className="btn-secondary" onClick={() => setStep(1)}>
                    {t("mod.back")}
                  </button>
                  <button className="btn-secondary" onClick={() => toCart(false)}>
                    <Icon name="cart" /> {C.toCart}
                  </button>
                  <button className="btn-primary" onClick={() => toCart(true)}>
                    {t("mod.payNow")}
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
