/* Hilfe: häufige Fragen, Kontaktformular und Antwortzeiten.
 *
 * Anfragen landen als Hilfe-Anfrage in der Datenbank (support.functions.ts)
 * und werden in der Verwaltung beantwortet; die Antwort geht per Mail raus
 * und steht hier unter "Meine Anfragen". Ohne Datenbank (Vorschau) wird
 * nichts verschickt. */
import { PrivacyAck, usePrivacyCopy } from "@/components/showly/PrivacyAck";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useShowly } from "@/showly/store";
import { Icon } from "@/showly/ui";
import { Footer } from "@/components/showly/Footer";
import { headLang, seoHead } from "@/showly/seo";
import { faqGraph } from "@/showly/schema";
import { isBackendConfigured } from "@/lib/supabase";
import { createTicket, myTickets } from "@/utils/support.functions";
import type { SupportTopic } from "@/lib/database.types";

export const Route = createFileRoute("/hilfe")({
  head: (ctx) => {
    const lang = headLang(ctx);
    const C = COPY[lang] ?? COPY.de;
    /* Die sichtbaren Fragen auch als FAQPage für Suchmaschinen und KI-Suchen */
    return {
      ...seoHead("/hilfe", "/hilfe", lang),
      scripts: [{ type: "application/ld+json", children: faqGraph(lang, "/hilfe", C.h, C.faq as unknown as [string, string][]) }],
    };
  },
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
      ["Kann ich kostenlos stornieren?", "Das hängt von der Stornostufe ab, die der Anbieter gewählt hat. Du siehst sie im Profil und an der Kasse, und sie wird mit deiner Buchung gespeichert. Flexibel: kostenlos bis 7 Tage vorher, bis 48 Stunden 50 %, danach 100 %. Moderat: kostenlos bis 14 Tage, bis 7 Tage 50 %. Streng: kostenlos bis 30 Tage, bis 14 Tage 50 %. Torten: kostenlos bis Produktionsbeginn. Verleih: kostenlos bis 3 Tage vor Mietbeginn, danach 25 % plus Versand. Einmal kostenlos umbuchen auf einen Termin innerhalb von 6 Monaten geht bis 48 Stunden vorher. Du darfst nachweisen, dass dem Anbieter ein geringerer Schaden entstanden ist (AGB § 8)."],
      ["Was passiert, wenn der Künstler absagt oder nicht kommt? (Ersatzgarantie)", "Dafür gibt es die Showly-Ersatzgarantie: Kommt dein Künstler nicht, besorgen wir Ersatz oder du bekommst alles zurück. Den vollen Betrag erstatten wir sofort. Du bekommst gleich drei passende Ersatz-Künstler für denselben Termin vorgeschlagen; kostet der Ersatz mehr, übernehmen wir den Aufpreis bis 100 €. Dazu gibt es einen Gutschein über 15 %. Unter 48 Stunden vor dem Event rufen wir dich an. Hat der Künstler 15 Minuten nach Beginn nicht eingecheckt, bekommt ihr beide eine Nachricht, und du kannst im Dashboard „Künstler ist nicht erschienen“ melden (AGB § 9)."],
      ["Wofür ist der Check-in-Code?", "Du findest ihn im Dashboard bei deiner Buchung. Nenne ihn dem Künstler bei der Ankunft; so ist nachgewiesen, dass er da war."],
      ["Warum kann ich keine Telefonnummer schicken?", "Kontakt und Zahlung laufen über Showly, damit beide Seiten abgesichert sind: Nur so gelten Stornoschutz, Gutschein und Erstattung. Nutze die Nachrichten zur Buchung."],
      ["Wann bekomme ich als Künstler mein Geld?", "Immer 7 Tage nach dem Event auf dein Auszahlungskonto bei Stripe. Brauchst du es schneller, wählst du im Portal unter Auszahlungen: 3 Tage nach dem Event gegen 10 % Gebühr oder innerhalb von 48 Stunden gegen 20 % Gebühr. Bei einer offenen Reklamation wird erst danach ausgezahlt. Bei den ersten 5 Buchungen behalten wir 20 % für 30 Tage als Sicherheit ein (AGB § 21)."],
      ["Wie reklamiere ich?", "Innerhalb von 48 Stunden nach dem Event im Dashboard bei der Buchung: Grund wählen (zu spät, zu kurz, anders als beschrieben, unfreundlich, Torte falsch oder beschädigt, Artikel mangelhaft) und Fotos oder Videos anhängen, bei Torten und Mietartikeln ist das Pflicht. Die Auszahlung an den Anbieter wird angehalten, er hat 48 Stunden für eine Stellungnahme. Einigt ihr euch auf eine Teilerstattung, geht das per Klick. Sonst entscheidet unser Team innerhalb von 5 Tagen. Deine gesetzlichen Gewährleistungsrechte bleiben unberührt (AGB § 14 a)."],
      ["Wie funktionieren die Bewertungen?", "Bewerten kann nur, wer wirklich gebucht hat und dessen Termin stattgefunden hat; die Bewertung trägt dann „Verifizierte Buchung“. Du hast 14 Tage Zeit. Kunde und Anbieter bewerten sich gegenseitig, verdeckt: Sichtbar wird beides erst, wenn beide bewertet haben oder die Frist um ist. Anbieter können öffentlich antworten. Gelöscht wird nur bei Verstößen (Beleidigung, Kontaktdaten, nachweislich falsche Tatsachen), nie wegen einer schlechten Note. Für Bewertungen gibt es keine Gegenleistung."],
      ["Was passiert bei Schäden an Mietartikeln?", "Bei Ausgabe und Rückgabe gibt es ein Protokoll mit Fotos und Zeitstempel, das du bestätigst. Normale Reinigung ist im Preis enthalten. Schäden werden nach dem Katalog berechnet, den du vorher siehst (etwa Fleck 15 €, kleiner Riss 25 €, Verlust Zeitwert), höchstens bis zur Kaution. Der Vermieter muss einen Schaden innerhalb von 72 Stunden nach Rückgabe melden, sonst wird die Kaution automatisch frei. Du kannst widersprechen. Mit dem Sorglos-Paket (+5 €) sind kleine Schäden abgedeckt."],
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
      ["Can I cancel for free?", "That depends on the cancellation tier the provider chose (flexible, moderate or strict). You see it in the profile and at checkout, and it is saved with your booking. One free rebooking within 6 months is possible up to 48 hours before. You may prove that the provider suffered a smaller loss (T&C § 8)."],
      ["What if the artist cancels or doesn't show up? (Replacement guarantee)", "You get the full amount back immediately, three replacement suggestions for the same date (we cover up to €100 extra) and a 15% voucher. Less than 48 hours before, we call you. If the artist has not checked in 15 minutes after the start, you both get a message and you can report a no-show in the dashboard (T&C § 9)."],
      ["What is the check-in code for?", "You find it in your dashboard with the booking. Give it to the artist on arrival; it proves they were there."],
      ["Why can't I send a phone number?", "Contact and payment go through Showly so both sides are protected: only then do cancellation protection, voucher and refunds apply. Use the messages for the booking."],
      ["When do I get paid as an artist?", "Always 7 days after the event. Faster for a fee: 3 days after the event for 10 %, within 48 hours for 20 %. Open complaints pause the payout (T&C § 21)."],
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
      ["¿Puedo cancelar gratis?", "Depende del nivel de cancelación que eligió el proveedor (flexible, moderado o estricto). Lo ves en el perfil y al pagar, y se guarda con tu reserva. Un cambio de fecha gratuito en 6 meses, hasta 48 horas antes. Puedes demostrar que el daño fue menor (CG § 8)."],
      ["¿Y si el artista cancela o no aparece? (Garantía de sustitución)", "Recibes el importe completo al instante, tres propuestas de sustitución (cubrimos hasta 100 € más) y un vale del 15 %. A menos de 48 horas te llamamos. Si el artista no hizo check-in 15 minutos después del inicio, ambos recibís un mensaje y puedes avisar de la ausencia en el panel (CG § 9)."],
      ["¿Para qué es el código de check-in?", "Está en tu panel junto a la reserva. Dáselo al artista al llegar; así queda probado que estuvo."],
      ["¿Por qué no puedo enviar un teléfono?", "El contacto y el pago van por Showly para proteger a ambas partes: solo así valen la protección, el vale y el reembolso. Usa los mensajes de la reserva."],
      ["¿Cuándo cobro como artista?", "Siempre 7 días después del evento. Más rápido con comisión: 3 días después por un 10 %, en 48 horas por un 20 %. Las reclamaciones abiertas detienen el pago (CG § 21)."],
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
  const [ack, setAck] = useState(false);
  const P = usePrivacyCopy();
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
    if (!ack) return toast(P.need);
    if (!cloud) {
      setSent(true);
      return;
    }
    setBusy(true);
    try {
      const { captchaToken } = await import("@/showly/captcha");
      const captcha = await captchaToken(lang).catch(() => undefined);
      const r = await createTicket({
        data: { email: email.trim(), name: name.trim(), topic, body: body.trim(), hp, ...(captcha ? { captcha } : {}) },
      });
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
              {/* Alle Antworten stehen im HTML (für Suchmaschinen und Vorleseprogramme), zugeklappte sind nur ausgeblendet */}
              <p hidden={open !== i}>{a}</p>
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
              <span className="pe-label">
                {C.name} <small>({lang === "en" ? "optional" : lang === "es" ? "opcional" : "freiwillig"})</small>
              </span>
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
            <PrivacyAck checked={ack} onChange={setAck} id="help-privacy" />
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
