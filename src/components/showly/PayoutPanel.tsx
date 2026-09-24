/* Auszahlungen für Künstler und Bäcker.
 *
 * Oben das Auszahlungskonto: Ohne Kontodaten kann nichts ausgezahlt werden,
 * deshalb steht der Hinweis auffällig da, bis das Konto hinterlegt ist.
 * Darunter die Auszahlungen mit Datum (5 Werktage nach dem Termin) und dem
 * Sicherheitseinbehalt der ersten Buchungen (AGB § 21).
 *
 * Im Echtbetrieb erfasst Stripe Connect Konto und Identität im eigenen,
 * gesicherten Fenster; Showly speichert dann keine IBAN. Bis dahin liegen
 * die Angaben nur in diesem Browser. */
import { useState } from "react";
import { useShowly, type Payout } from "@/showly/store";
import { Icon } from "@/showly/ui";
import {
  isValidIban,
  maskIban,
  normalizeIban,
  payoutDate,
} from "@/showly/booking";

const COPY = {
  de: {
    bankH: "Auszahlungskonto",
    bankP:
      "Deine Gage wird 5 Werktage nach dem Termin auf dieses Konto überwiesen.",
    missing:
      "Hinterlege dein Konto, sonst können wir deine Gage nicht auszahlen.",
    holder: "Kontoinhaber",
    iban: "IBAN",
    bic: "BIC (freiwillig)",
    save: "Konto speichern",
    change: "Ändern",
    cancel: "Abbrechen",
    remove: "Entfernen",
    saved: "Konto gespeichert",
    badIban: "Die IBAN stimmt nicht. Bitte prüf sie noch einmal.",
    needHolder: "Bitte gib den Kontoinhaber an.",
    listH: "Deine Auszahlungen",
    none: "Noch keine Auszahlungen. Sie erscheinen hier nach deiner ersten Buchung.",
    on: (d: string) => `Auszahlung am ${d}`,
    waitBank: "wartet auf Kontodaten",
    paid: "ausgezahlt",
    planned: "geplant",
    reserve: (a: string, d: string) =>
      `davon ${a} Sicherheitseinbehalt, Auszahlung am ${d}`,
    reserveInfo:
      "Von deinen ersten 5 Buchungen behalten wir 20 % der Gage 30 Tage als Sicherheit ein und zahlen sie danach aus (AGB § 21).",
  },
  en: {
    bankH: "Payout account",
    bankP:
      "Your fee is transferred to this account 5 business days after the event.",
    missing: "Add your account, otherwise we can't pay out your fee.",
    holder: "Account holder",
    iban: "IBAN",
    bic: "BIC (optional)",
    save: "Save account",
    change: "Change",
    cancel: "Cancel",
    remove: "Remove",
    saved: "Account saved",
    badIban: "The IBAN isn't valid. Please check it again.",
    needHolder: "Please enter the account holder.",
    listH: "Your payouts",
    none: "No payouts yet. They show up here after your first booking.",
    on: (d: string) => `Payout on ${d}`,
    waitBank: "waiting for account details",
    paid: "paid",
    planned: "scheduled",
    reserve: (a: string, d: string) =>
      `incl. ${a} security reserve, paid out on ${d}`,
    reserveInfo:
      "For your first 5 bookings we hold back 20% of the fee for 30 days as security and pay it out afterwards (T&C § 21).",
  },
  es: {
    bankH: "Cuenta de cobro",
    bankP:
      "Tu caché se transfiere a esta cuenta 5 días hábiles después del evento.",
    missing: "Añade tu cuenta; si no, no podemos pagarte el caché.",
    holder: "Titular",
    iban: "IBAN",
    bic: "BIC (opcional)",
    save: "Guardar cuenta",
    change: "Cambiar",
    cancel: "Cancelar",
    remove: "Eliminar",
    saved: "Cuenta guardada",
    badIban: "El IBAN no es válido. Revísalo de nuevo.",
    needHolder: "Indica el titular de la cuenta.",
    listH: "Tus pagos",
    none: "Aún no hay pagos. Aparecerán aquí tras tu primera reserva.",
    on: (d: string) => `Pago el ${d}`,
    waitBank: "esperando datos bancarios",
    paid: "pagado",
    planned: "previsto",
    reserve: (a: string, d: string) =>
      `incl. ${a} de retención de seguridad, se paga el ${d}`,
    reserveInfo:
      "De tus primeras 5 reservas retenemos el 20 % del caché durante 30 días como garantía y luego lo pagamos (CG § 21).",
  },
} as const;

export function BankForm({ ownerKey }: { ownerKey: string }) {
  const { lang, bankAccounts, saveBank, toast } = useShowly();
  const C = COPY[(lang as "de" | "en" | "es") ?? "de"] ?? COPY.de;
  const acc = bankAccounts[ownerKey];
  const [edit, setEdit] = useState(false);
  const [holder, setHolder] = useState(acc?.holder || "");
  const [iban, setIban] = useState("");
  const [bic, setBic] = useState(acc?.bic || "");
  const [err, setErr] = useState("");

  function save() {
    if (!holder.trim()) return setErr(C.needHolder);
    if (!isValidIban(iban)) return setErr(C.badIban);
    saveBank(ownerKey, {
      holder: holder.trim().slice(0, 80),
      iban: normalizeIban(iban),
      ...(bic.trim() ? { bic: bic.trim().toUpperCase().slice(0, 11) } : {}),
      savedAt: new Date().toISOString(),
    });
    setErr("");
    setIban("");
    setEdit(false);
    toast(C.saved);
  }

  const showForm = !acc || edit;
  return (
    <section className={"bank" + (acc ? "" : " missing")}>
      <div className="bank-head">
        <span className="bank-ic">
          <Icon name="money" />
        </span>
        <div>
          <h3>{C.bankH}</h3>
          <p>{acc ? C.bankP : C.missing}</p>
        </div>
      </div>
      {!showForm && acc && (
        <div className="bank-show">
          <span>
            <b>{acc.holder}</b>
            <code>{maskIban(acc.iban)}</code>
          </span>
          <button
            type="button"
            className="inb-mode-btn"
            onClick={() => setEdit(true)}
          >
            {C.change}
          </button>
        </div>
      )}
      {showForm && (
        <div className="bank-form">
          <label className="pe-field">
            <span className="pe-label">{C.holder}</span>
            <input
              id={`bank-holder-${ownerKey}`}
              value={holder}
              autoComplete="name"
              onChange={(e) => setHolder(e.target.value)}
            />
          </label>
          <label className="pe-field">
            <span className="pe-label">{C.iban}</span>
            <input
              id={`bank-iban-${ownerKey}`}
              value={iban}
              inputMode="text"
              autoComplete="off"
              placeholder="DE00 0000 0000 0000 0000 00"
              onChange={(e) => setIban(e.target.value.toUpperCase())}
            />
          </label>
          <label className="pe-field">
            <span className="pe-label">{C.bic}</span>
            <input
              id={`bank-bic-${ownerKey}`}
              value={bic}
              autoComplete="off"
              onChange={(e) => setBic(e.target.value)}
            />
          </label>
          {err && (
            <p className="del-acc-msg" role="alert">
              {err}
            </p>
          )}
          <div className="del-acc-actions">
            {acc && (
              <button
                type="button"
                className="home-btn soft"
                onClick={() => setEdit(false)}
              >
                {C.cancel}
              </button>
            )}
            <button type="button" className="home-btn primary" onClick={save}>
              {C.save}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export function PayoutPanel({ artistId }: { artistId: number }) {
  const { lang, fmt, fmtDate, payouts, bankAccounts } = useShowly();
  const C = COPY[(lang as "de" | "en" | "es") ?? "de"] ?? COPY.de;
  const key = `artist:${artistId}`;
  const hasBank = !!bankAccounts[key];
  const mine = payouts.filter((p) => p.artistId === artistId);
  const today = new Date().toISOString().slice(0, 10);
  const due = (p: Payout) => p.payoutOn || payoutDate(p.dateISO);

  return (
    <div className="payout">
      <BankForm ownerKey={key} />
      <div className="dash26-panel">
        <div className="dash26-panel-head">
          <h3>{C.listH}</h3>
        </div>
        <p className="payout-info">{C.reserveInfo}</p>
        {mine.length ? (
          <ul className="payout-list">
            {mine.map((p) => (
              <li key={p.id}>
                <div>
                  <b>{fmtDate(p.dateISO)}</b>
                  <small>{C.on(fmtDate(due(p)))}</small>
                  {p.reserve ? (
                    <small>
                      {C.reserve(fmt(p.reserve), fmtDate(p.reserveUntil))}
                    </small>
                  ) : null}
                </div>
                <div className="payout-side">
                  <b>{fmt(p.net)}</b>
                  <span
                    className={
                      "dash26-status " +
                      (p.status === "paid"
                        ? "s-completed"
                        : hasBank
                          ? "s-confirmed"
                          : "s-pending")
                    }
                  >
                    {p.status === "paid"
                      ? C.paid
                      : !hasBank
                        ? C.waitBank
                        : due(p) <= today
                          ? C.paid
                          : C.planned}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="dash26-none">{C.none}</p>
        )}
      </div>
    </div>
  );
}
