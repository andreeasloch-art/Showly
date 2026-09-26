/* Hilfe: häufige Fragen, Kontaktformular und Antwortzeiten.
 *
 * Anfragen landen als Hilfe-Anfrage in der Datenbank (support.functions.ts)
 * und werden in der Verwaltung beantwortet; die Antwort geht per Mail raus
 * und steht hier unter "Meine Anfragen". Ohne Datenbank (Vorschau) wird
 * nichts verschickt. */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useShowly } from "@/showly/store";
import { Icon } from "@/showly/ui";
import { Footer } from "@/components/showly/Footer";
import { isBackendConfigured } from "@/lib/supabase";
import { createTicket, myTickets } from "@/utils/support.functions";
import type { SupportTopic } from "@/lib/database.types";

export const Route = createFileRoute("/hilfe")({
  head: () => ({
    meta: [
      { title: "Hilfe und Kontakt – Showly" },
      { name: "description", content: "Antworten zu Buchung, Zahlung, Stornierung und Konto bei Showly, und der direkte Weg zu unserem Team." },
    ],
  }),
  component: HelpPage,
});

type QA = [string, string];

const COPY = {
  de: {
    h: "Hilfe und Kontakt",
    lead: "Die häufigsten Fragen stehen hier. Findest du keine Antwort, schreib uns.",
    times: "Wir antworten werktags (Montag bis Freitag) innerhalb von 24 Stunden, am Wochenende innerhalb von 48 Stunden. Bei einem Problem am Tag deines Events schreib bitte „Heute“ an den Anfang, das beantworten wir zuerst.",
    faqH: "Häufige Fragen",
    faq: [
      ["Wie buche ich einen Künstler?", "Profil öffnen, Datum und Uhrzeit wählen, in den Warenkorb legen und an der Kasse bezahlen. Bei Künstlern mit Sofortbuchung ist der Termin sofort fest. Bei Anfrage-Künstlern bekommst du innerhalb von 48 Stunden eine Zusage; abgebucht wird erst dann."],
      ["Kann ich kostenlos stornieren?", "Ja, bis 24 Stunden vor Beginn ohne Angabe von Gründen, im Dashboard unter Buchungen. Danach bleibt die Gage geschuldet (AGB § 8)."],
      ["Was passiert, wenn der Künstler absagt oder nicht kommt?", "Du bekommst alles zurück. Sagt er später als 24 Stunden vorher ohne Notfall ab oder erscheint nicht, bekommst du zusätzlich einen Gutschein über 50 € (AGB § 9). Ein Nichterscheinen meldest du im Dashboard."],
      ["Wofür ist der Check-in-Code?", "Du findest ihn im Dashboard bei deiner Buchung. Nenne ihn dem Künstler bei der Ankunft; so ist nachgewiesen, dass er da war."],
      ["Warum kann ich keine Telefonnummer schicken?", "Kontakt und Zahlung laufen über Showly, damit beide Seiten abgesichert sind: Nur so gelten Stornoschutz, Gutschein und Erstattung. Nutze die Nachrichten zur Buchung."],
      ["Wann bekomme ich als Künstler mein Geld?", "5 Werktage nach dem Termin auf dein Auszahlungskonto bei Stripe. Bei den ersten 5 Buchungen behalten wir 20 % für 30 Tage als Sicherheit ein (AGB § 21)."],
      ["Kann ich auch privat anbieten, ohne Gewerbe?", "Ja. Showly ist für Selbstständige, Betriebe und Privatpersonen. Bei der Anmeldung wählst du privat oder gewerblich. Kunden sehen das im Profil. Privatanbieter zahlen bei später Absage oder Nichterscheinen keine Vertragsstrafe; es gilt das Stufenmodell mit Verwarnung, Einschränkung und Sperre (AGB §§ 9, 23)."],
      ["Muss ich meine Einnahmen versteuern?", "Das kann sein, auch wenn du privat anbietest. Ab welchem Betrag Steuern anfallen (etwa Einkommensteuer oder Umsatzsteuer) und ob du ein Gewerbe anmelden musst, hängt vom Land ab, in dem du lebst, und von der Höhe deiner Einnahmen. Du bist selbst dafür verantwortlich, deine Einnahmen anzugeben und Steuern abzuführen. Showly berät dazu nicht und ist dafür nicht verantwortlich. Soweit gesetzlich vorgeschrieben, meldet Showly Einnahmen an die Steuerbehörden (in Deutschland nach dem Plattformen-Steuertransparenzgesetz). Im Zweifel hilft dein Finanzamt oder eine Steuerberatung (AGB § 18)."],
      ["Wie lösche ich mein Konto?", "Im Dashboard unter Profil ganz unten. Offene Buchungen müssen vorher abgeschlossen oder storniert sein."],
      ["Wie melde ich einen Inhalt?", "Über das Menü mit den drei Punkten am Beitrag, Kommentar oder Profil. Wir prüfen jede Meldung und teilen dir das Ergebnis mit."],
    ] as QA[],
    formH: "Nachricht an das Showly-Team",
    name: "Name (freiwillig)",
    email: "E-Mail für die Antwort",
    topic: "Worum geht es?",
    topics: { booking: "Buchung", payment: "Zahlung oder Erstattung", account: "Konto und Anmeldung", provider: "Als Künstler oder Anbieter", report: "Meldung oder Beschwerde", other: "Sonstiges" },
    body: "Deine Nachricht",
    send: "Absenden",
    sent: "Danke, deine Nachricht ist angekommen. Wir melden uns per Mail.",
    practice: "Vorschau: Nachrichten werden hier nicht verschickt.",
    needMail: "Bitte gib eine E-Mail-Adresse an, damit wir antworten können.",
    needBody: "Bitte beschreibe kurz dein Anliegen.",
    mineH: "Meine Anfragen",
    answer: "Antwort",
    open: "offen",
    legal: "Rechtliches",
  },
  en: {
    h: "Help and contact",
    lead: "The most common questions are answered here. If you can't find an answer, write to us.",
    times: "We reply on business days (Monday to Friday) within 24 hours, at weekends within 48 hours. If there is a problem on the day of your event, start your message with “Today” and we will answer it first.",
    faqH: "Frequently asked questions",
    faq: [
      ["How do I book an artist?", "Open the profile, pick date and time, add to cart and pay at checkout. Artists with instant booking are confirmed right away. For request artists you get an answer within 48 hours; you are only charged then."],
      ["Can I cancel for free?", "Yes, up to 24 hours before the start without giving a reason, in the dashboard under bookings. After that the fee remains due (T&C § 8)."],
      ["What if the artist cancels or doesn't show up?", "You get everything back. If they cancel later than 24 hours before without an emergency, or don't show up, you also get a €50 voucher (T&C § 9). Report a no-show in the dashboard."],
      ["What is the check-in code for?", "You find it in your dashboard with the booking. Give it to the artist on arrival; it proves they were there."],
      ["Why can't I send a phone number?", "Contact and payment go through Showly so both sides are protected: only then do cancellation protection, voucher and refunds apply. Use the messages for the booking."],
      ["When do I get paid as an artist?", "5 business days after the event, to your payout account at Stripe. For your first 5 bookings we hold back 20% for 30 days as security (T&C § 21)."],
      ["Can I offer privately, without a business?", "Yes. Showly is for self-employed people, businesses and private persons. When you sign up you choose private or commercial. Customers see this on your profile. Private providers pay no contractual penalty for late cancellations or no-shows; the strike model with warning, restriction and suspension applies (T&C §§ 9, 23)."],
      ["Do I have to pay tax on my income?", "Possibly, even if you offer privately. The amount from which taxes apply (such as income tax or VAT) and whether you must register a business depend on the country you live in and on how much you earn. You are responsible for declaring your income and paying taxes yourself. Showly does not give tax advice and is not responsible for this. Where required by law, Showly reports income to the tax authorities (in Germany under the Platform Tax Transparency Act). If in doubt, ask your tax office or a tax advisor (T&C § 18)."],
      ["How do I delete my account?", "In the dashboard at the bottom of your profile. Open bookings must be completed or cancelled first."],
      ["How do I report content?", "Use the three-dot menu on the post, comment or profile. We review every report and tell you the outcome."],
    ] as QA[],
    formH: "Message to the Showly team",
    name: "Name (optional)",
    email: "Email for our reply",
    topic: "What is it about?",
    topics: { booking: "Booking", payment: "Payment or refund", account: "Account and sign-in", provider: "As an artist or provider", report: "Report or complaint", other: "Other" },
    body: "Your message",
    send: "Send",
    sent: "Thanks, your message has arrived. We'll reply by email.",
    practice: "Preview: messages are not sent here.",
    needMail: "Please enter an email address so we can reply.",
    needBody: "Please briefly describe your request.",
    mineH: "My requests",
    answer: "Answer",
    open: "open",
    legal: "Legal",
  },
  es: {
    h: "Ayuda y contacto",
    lead: "Aquí están las preguntas más frecuentes. Si no encuentras respuesta, escríbenos.",
    times: "Respondemos en días laborables (lunes a viernes) en 24 horas y el fin de semana en 48 horas. Si hay un problema el día de tu evento, empieza con «Hoy» y lo atenderemos primero.",
    faqH: "Preguntas frecuentes",
    faq: [
      ["¿Cómo reservo un artista?", "Abre el perfil, elige fecha y hora, añádelo al carrito y paga en la caja. Con reserva inmediata la cita queda fijada al momento. Con solicitud recibes respuesta en 48 horas y solo entonces se cobra."],
      ["¿Puedo cancelar gratis?", "Sí, hasta 24 horas antes sin dar motivos, en el panel en reservas. Después se debe el caché (CG § 8)."],
      ["¿Y si el artista cancela o no aparece?", "Te devolvemos todo. Si cancela con menos de 24 horas sin emergencia o no aparece, además recibes un vale de 50 € (CG § 9). Comunica la ausencia en el panel."],
      ["¿Para qué es el código de check-in?", "Está en tu panel junto a la reserva. Dáselo al artista al llegar; así queda probado que estuvo."],
      ["¿Por qué no puedo enviar un teléfono?", "El contacto y el pago van por Showly para proteger a ambas partes: solo así valen la protección, el vale y el reembolso. Usa los mensajes de la reserva."],
      ["¿Cuándo cobro como artista?", "5 días hábiles después del evento en tu cuenta de cobro de Stripe. En tus primeras 5 reservas retenemos el 20 % durante 30 días (CG § 21)."],
      ["¿Puedo ofrecer como particular, sin empresa?", "Sí. Showly es para autónomos, empresas y particulares. Al registrarte eliges particular o profesional, y los clientes lo ven en tu perfil. Los particulares no pagan penalización por cancelación tardía o ausencia; se aplica el sistema por niveles con aviso, restricción y bloqueo (CG §§ 9, 23)."],
      ["¿Tengo que pagar impuestos por mis ingresos?", "Puede ser, aunque ofrezcas como particular. El importe a partir del cual se pagan impuestos y si debes darte de alta dependen de tu país y de cuánto ganas. Eres responsable de declarar tus ingresos y pagar los impuestos. Showly no asesora sobre impuestos ni se responsabiliza de ello. Cuando la ley lo exige, Showly comunica los ingresos a las autoridades fiscales (en Alemania según la ley de transparencia fiscal de plataformas). En caso de duda, consulta a tu oficina tributaria o a un asesor fiscal (CG § 18)."],
      ["¿Cómo borro mi cuenta?", "En el panel, al final de tu perfil. Las reservas abiertas deben estar terminadas o canceladas."],
      ["¿Cómo denuncio un contenido?", "Con el menú de tres puntos en la publicación, comentario o perfil. Revisamos cada aviso y te informamos."],
    ] as QA[],
    formH: "Mensaje al equipo de Showly",
    name: "Nombre (opcional)",
    email: "Correo para la respuesta",
    topic: "¿De qué se trata?",
    topics: { booking: "Reserva", payment: "Pago o reembolso", account: "Cuenta e inicio de sesión", provider: "Como artista o proveedor", report: "Aviso o queja", other: "Otro" },
    body: "Tu mensaje",
    send: "Enviar",
    sent: "Gracias, tu mensaje ha llegado. Te responderemos por correo.",
    practice: "Vista previa: aquí no se envían mensajes.",
    needMail: "Indica un correo para poder responderte.",
    needBody: "Describe brevemente tu consulta.",
    mineH: "Mis consultas",
    answer: "Respuesta",
    open: "abierta",
    legal: "Legal",
  },
} as const;

type Ticket = { id: number; topic: string; body: string; status: string; answer: string | null; created_at: string };

function HelpPage() {
  const { lang, session, toast, fmtDate } = useShowly();
  const C = COPY[(lang as "de" | "en" | "es") ?? "de"] ?? COPY.de;
  const [open, setOpen] = useState<number | null>(0);
  const [name, setName] = useState(session?.name ?? "");
  const [email, setEmail] = useState(session?.email ?? "");
  const [topic, setTopic] = useState<SupportTopic>("booking");
  const [body, setBody] = useState("");
  const [hp, setHp] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [mine, setMine] = useState<Ticket[]>([]);
  const cloud = isBackendConfigured();

  useEffect(() => {
    if (!session?.backend) return;
    void myTickets()
      .then((t) => setMine(t as Ticket[]))
      .catch(() => undefined);
  }, [session?.backend, sent]);

  async function send() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return toast(C.needMail);
    if (body.trim().length < 5) return toast(C.needBody);
    if (!cloud) {
      setSent(true);
      return;
    }
    setBusy(true);
    try {
      const r = await createTicket({ data: { email: email.trim(), name: name.trim(), topic, body: body.trim(), hp } });
      if ("error" in r) return toast(r.error);
      setSent(true);
      setBody("");
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page active ui26 help26">
      <div className="help26-wrap">
        <h1>{C.h}</h1>
        <p className="help26-lead">{C.lead}</p>
        <p className="help26-times">
          <Icon name="clock" /> <span>{C.times}</span>
        </p>

        <h2>{C.faqH}</h2>
        <div className="help26-faq">
          {C.faq.map(([q, a], i) => (
            <div key={i} className={"help26-qa" + (open === i ? " open" : "")}>
              <button type="button" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
                {q}
                <span aria-hidden="true">{open === i ? "−" : "+"}</span>
              </button>
              {open === i && <p>{a}</p>}
            </div>
          ))}
        </div>

        <h2>{C.formH}</h2>
        {sent ? (
          <p className="help26-sent">
            <Icon name="check" /> {cloud ? C.sent : C.practice}
          </p>
        ) : (
          <div className="help26-form">
            <label className="pe-field">
              <span className="pe-label">{C.name}</span>
              <input value={name} autoComplete="name" onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="pe-field">
              <span className="pe-label">{C.email}</span>
              <input value={email} type="email" autoComplete="email" onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="pe-field">
              <span className="pe-label">{C.topic}</span>
              <select value={topic} onChange={(e) => setTopic(e.target.value as SupportTopic)}>
                {(Object.keys(C.topics) as SupportTopic[]).map((k) => (
                  <option key={k} value={k}>
                    {C.topics[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className="pe-field">
              <span className="pe-label">{C.body}</span>
              <textarea rows={5} maxLength={4000} value={body} onChange={(e) => setBody(e.target.value)} />
            </label>
            {/* Unsichtbar für Menschen, Bots füllen es aus */}
            <input className="help26-hp" tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} aria-hidden="true" />
            {!cloud && <p className="help26-note">{C.practice}</p>}
            <button type="button" className="home-btn primary" disabled={busy} onClick={() => void send()}>
              {C.send}
            </button>
          </div>
        )}

        {mine.length > 0 && (
          <>
            <h2>{C.mineH}</h2>
            <ul className="help26-mine">
              {mine.map((t) => (
                <li key={t.id}>
                  <small>
                    {fmtDate(t.created_at)} · {C.topics[t.topic as SupportTopic] ?? t.topic} · {t.answer ? "" : C.open}
                  </small>
                  <p>{t.body}</p>
                  {t.answer && (
                    <p className="help26-answer">
                      <b>{C.answer}:</b> {t.answer}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}

        <p className="help26-legal">
          {C.legal}:{" "}
          <Link to="/rechtliches/$doc" params={{ doc: "terms" }}>
            AGB
          </Link>{" "}
          ·{" "}
          <Link to="/rechtliches/$doc" params={{ doc: "privacy" }}>
            Datenschutz
          </Link>{" "}
          ·{" "}
          <Link to="/rechtliches/$doc" params={{ doc: "imprint" }}>
            Impressum
          </Link>
        </p>
      </div>
      <Footer />
    </div>
  );
}
