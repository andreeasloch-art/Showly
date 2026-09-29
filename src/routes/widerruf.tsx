/* Elektronische Widerrufsfunktion ("Vertrag hier widerrufen").
 *
 * Seit 19. Juni 2026 müssen Online-Händler Verbrauchern eine Schaltfläche
 * zum Widerruf anbieten (EU-Richtlinie 2023/2673): Erklärung mit Name,
 * Vertrag und Kontaktweg, dann "Widerruf bestätigen", danach eine
 * Eingangsbestätigung mit Inhalt, Datum und Uhrzeit. */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { seoHead } from "@/showly/seo";
import { useShowly } from "@/showly/store";
import { Icon } from "@/showly/ui";
import { Footer } from "@/components/showly/Footer";
import { isBackendConfigured } from "@/lib/supabase";
import { submitWithdrawal } from "@/utils/support.functions";

export const Route = createFileRoute("/widerruf")({
  head: () => seoHead("/widerruf", "/widerruf"),
  component: Withdraw,
});

const COPY = {
  de: {
    h: "Vertrag widerrufen",
    lead: "Du hast etwas über Showly gekauft und möchtest den Vertrag innerhalb der Widerrufsfrist widerrufen? Das geht hier direkt. Wann ein Widerrufsrecht besteht, steht in der",
    lead2: "Widerrufsbelehrung",
    name: "Dein Name",
    email: "E-Mail-Adresse für die Eingangsbestätigung",
    contract: "Welchen Vertrag widerrufst du?",
    contractPh: "z. B. Bestellung vom 12.10.2026, Kostüm „Schneekönigin“",
    pick: "Aus deinen Bestellungen wählen",
    none: "Bitte wählen",
    order: (id: number, d: string) => `Bestellung ${id} vom ${d}`,
    note: "Anmerkung (freiwillig)",
    next: "Weiter zur Bestätigung",
    reviewH: "Bitte prüfen",
    reviewP: "Mit dem Klick auf „Widerruf bestätigen“ erklärst du den Widerruf dieses Vertrags.",
    back: "Zurück",
    confirm: "Widerruf bestätigen",
    busy: "Wird gesendet …",
    doneH: "Dein Widerruf ist eingegangen",
    doneP: (d: string) => `Eingang: ${d} Uhr. Eine Bestätigung mit Inhalt, Datum und Uhrzeit haben wir an deine E-Mail-Adresse geschickt. Wir melden uns mit den nächsten Schritten zur Rücksendung und Erstattung.`,
    practice: "Vorschau ohne Datenbank: Hier würde der Widerruf jetzt gespeichert und per E-Mail bestätigt. Bitte mach einen Screenshot als Nachweis.",
    need: "Bitte Name, E-Mail und den Vertrag angeben.",
    hint: "Kein Widerrufsrecht besteht in der Regel bei Buchungen von Künstlern für einen festen Termin, bei nach Wunsch gefertigten oder schnell verderblichen Torten und bei Angeboten von Privatpersonen. Einzelheiten in der Widerrufsbelehrung.",
  },
  en: {
    h: "Withdraw from contract",
    lead: "You bought something through Showly and want to withdraw within the withdrawal period? You can do it right here. When a right of withdrawal applies is explained in the",
    lead2: "withdrawal policy",
    name: "Your name",
    email: "Email address for the confirmation",
    contract: "Which contract are you withdrawing from?",
    contractPh: "e.g. order of 12 Oct 2026, costume “Snow Queen”",
    pick: "Choose from your orders",
    none: "Please choose",
    order: (id: number, d: string) => `Order ${id} of ${d}`,
    note: "Note (optional)",
    next: "Continue to confirmation",
    reviewH: "Please check",
    reviewP: "By clicking “Confirm withdrawal” you declare the withdrawal from this contract.",
    back: "Back",
    confirm: "Confirm withdrawal",
    busy: "Sending …",
    doneH: "Your withdrawal has been received",
    doneP: (d: string) => `Received: ${d}. We have sent a confirmation with the content, date and time to your email address. We will get back to you about the return and refund.`,
    practice: "Preview without a database: the withdrawal would now be stored and confirmed by email. Please take a screenshot as proof.",
    need: "Please enter your name, email and the contract.",
    hint: "There is usually no right of withdrawal for artist bookings on a fixed date, for made-to-order or perishable cakes, and for offers by private persons. Details in the withdrawal policy.",
  },
  es: {
    h: "Desistir del contrato",
    lead: "¿Compraste algo en Showly y quieres desistir dentro del plazo? Puedes hacerlo aquí. Cuándo existe el derecho de desistimiento se explica en la",
    lead2: "información sobre el desistimiento",
    name: "Tu nombre",
    email: "Correo para la confirmación",
    contract: "¿De qué contrato desistes?",
    contractPh: "p. ej. pedido del 12/10/2026, disfraz «Reina de las nieves»",
    pick: "Elegir de tus pedidos",
    none: "Elige",
    order: (id: number, d: string) => `Pedido ${id} del ${d}`,
    note: "Comentario (opcional)",
    next: "Continuar a la confirmación",
    reviewH: "Comprueba los datos",
    reviewP: "Al pulsar «Confirmar desistimiento» declaras que desistes de este contrato.",
    back: "Volver",
    confirm: "Confirmar desistimiento",
    busy: "Enviando …",
    doneH: "Hemos recibido tu desistimiento",
    doneP: (d: string) => `Recibido: ${d}. Te hemos enviado una confirmación con el contenido, la fecha y la hora. Te escribiremos sobre la devolución y el reembolso.`,
    practice: "Vista previa sin base de datos: aquí se guardaría el desistimiento y se confirmaría por correo. Haz una captura como prueba.",
    need: "Indica nombre, correo y el contrato.",
    hint: "Normalmente no hay derecho de desistimiento en reservas de artistas para una fecha fija, en tartas por encargo o perecederas ni en ofertas de particulares. Detalles en la información sobre el desistimiento.",
  },
} as const;

function Withdraw() {
  const { lang, session, orders, fmtDate, toast } = useShowly();
  const C = COPY[(lang as keyof typeof COPY) in COPY ? (lang as keyof typeof COPY) : "de"];
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState(session?.name ?? "");
  const [email, setEmail] = useState(session?.email ?? "");
  const [contract, setContract] = useState("");
  const [note, setNote] = useState("");
  const [hp, setHp] = useState("");
  const [busy, setBusy] = useState(false);
  const [at, setAt] = useState("");
  const cloud = isBackendConfigured();

  function next() {
    if (name.trim().length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || contract.trim().length < 2)
      return toast(C.need);
    setStep(2);
  }

  async function confirm() {
    if (!cloud) {
      setAt(new Date().toISOString());
      setStep(3);
      return;
    }
    setBusy(true);
    try {
      const r = await submitWithdrawal({ data: { name, email, contract, note, hp } });
      if ("error" in r) return toast(r.error);
      setAt(r.at);
      setStep(3);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const when = at ? new Date(at).toLocaleString(lang === "en" ? "en-GB" : lang === "es" ? "es-ES" : "de-DE") : "";

  return (
    <div className="page active ui26 help26">
      <div className="help26-wrap">
        <h1>{C.h}</h1>
        <p className="help26-lead">
          {C.lead}{" "}
          <Link to="/rechtliches/$doc" params={{ doc: "withdrawal" }}>
            {C.lead2}
          </Link>
          .
        </p>
        <p className="help26-note">{C.hint}</p>

        {step === 1 && (
          <div className="help26-form">
            <label className="pe-field">
              <span className="pe-label">{C.name}</span>
              <input value={name} autoComplete="name" required onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="pe-field">
              <span className="pe-label">{C.email}</span>
              <input value={email} type="email" autoComplete="email" required onChange={(e) => setEmail(e.target.value)} />
            </label>
            {orders.length > 0 && (
              <label className="pe-field">
                <span className="pe-label">{C.pick}</span>
                <select value="" onChange={(e) => e.target.value && setContract(e.target.value)}>
                  <option value="">{C.none}</option>
                  {orders.map((o) => (
                    <option key={o.id} value={C.order(o.id, fmtDate(o.dateISO))}>
                      {C.order(o.id, fmtDate(o.dateISO))}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="pe-field">
              <span className="pe-label">{C.contract}</span>
              <input value={contract} placeholder={C.contractPh} required onChange={(e) => setContract(e.target.value)} />
            </label>
            <label className="pe-field">
              <span className="pe-label">{C.note}</span>
              <textarea rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            <input className="help26-hp" tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} aria-hidden="true" />
            <button type="button" className="home-btn primary" onClick={next}>
              {C.next}
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="help26-form" role="region" aria-labelledby="wd-review">
            <h2 id="wd-review">{C.reviewH}</h2>
            <dl className="wd-review">
              <dt>{C.name}</dt>
              <dd>{name}</dd>
              <dt>{C.email}</dt>
              <dd>{email}</dd>
              <dt>{C.contract}</dt>
              <dd>{contract}</dd>
              {note && (
                <>
                  <dt>{C.note}</dt>
                  <dd>{note}</dd>
                </>
              )}
            </dl>
            <p>{C.reviewP}</p>
            <div className="wd-btns">
              <button type="button" className="home-btn ghost" onClick={() => setStep(1)}>
                {C.back}
              </button>
              <button type="button" className="home-btn primary" disabled={busy} onClick={() => void confirm()}>
                {busy ? C.busy : C.confirm}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="help26-sent" role="status">
            <Icon name="check" />
            <div>
              <b>{C.doneH}</b>
              <p>{cloud ? C.doneP(when) : `${C.practice} (${when})`}</p>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
