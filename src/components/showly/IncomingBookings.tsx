/* Eingehende Buchungen eines Künstlers.
 *
 * Oben die offenen Anfragen mit Annehmen und Ablehnen, darunter kommende und
 * vergangene Buchungen. Ob Kunden sofort buchen oder erst anfragen, legt der
 * Künstler im Profil fest (siehe showly/booking.ts). Ablehnen fragt einmal
 * nach, direkt im Eintrag: Browser-Dialoge wie confirm() sind in der App-
 * Hülle und in Vorschauen oft gesperrt. */
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ARTISTS } from "@/showly/data";
import { useShowly, type Booking } from "@/showly/store";
import { Icon } from "@/showly/ui";
import { figName } from "@/showly/figures";
import { bookingPrice, minHoursOf } from "@/showly/pricing";
import { isInstant, isLateCancel, respondBy } from "@/showly/booking";

const COPY = {
  de: {
    modeInstant: "Du bist sofort buchbar. Kunden buchen freie Termine direkt.",
    modeRequest: "Kunden schicken dir Anfragen. Du hast 48 Stunden, um zu antworten.",
    change: "Ändern",
    reqH: "Neue Anfragen",
    nextH: "Kommende Buchungen",
    pastH: "Vergangen und abgelehnt",
    accept: "Annehmen",
    decline: "Ablehnen",
    sure: "Wirklich ablehnen?",
    cancel: "Absagen",
    sureCancel: "Wirklich absagen? Der Kunde bekommt den vollen Betrag zurück.",
    yesCancel: "Ja, absagen",
    cancelled: "Buchung abgesagt. Der Kunde bekommt den vollen Betrag zurück.",
    sureLate: (p: string) => `Weniger als 24 Stunden vor Beginn: Ohne Notfall fällt eine Vertragsstrafe in Höhe deiner Gage an (${p}), und der Kunde bekommt einen Gutschein. Bei einem Notfall (z. B. Unfall, akute Krankheit) schick uns den Nachweis, dann entfällt die Strafe.`,
    yesEmergency: "Notfall, Nachweis folgt",
    yesNoEmergency: "Ohne Notfall absagen",
    doneProof: "Abgesagt. Schick den Nachweis innerhalb von 7 Tagen an support@showly.de, wir prüfen ihn.",
    donePenalty: (p: string) => `Abgesagt. Die Vertragsstrafe von ${p} wird dir in Rechnung gestellt.`,
    penDue: (p: string) => `Vertragsstrafe ${p}: wird in Rechnung gestellt`,
    penProof: "Notfall-Nachweis wird geprüft (support@showly.de)",
    penWaived: "Nachweis anerkannt, keine Vertragsstrafe",
    claim: "Notfall belegen",
    claimed: "Danke. Schick den Nachweis innerhalb von 7 Tagen an support@showly.de.",
    yes: "Ja, ablehnen",
    no: "Zurück",
    until: (d: string) => `Antwort bis ${d}`,
    fee: "deine Gage",
    guests: (g: string) => `${g} Gäste`,
    customer: "Kunde",
    accepted: "Buchung angenommen. Der Kunde wird benachrichtigt.",
    declined: "Anfrage abgelehnt. Der Termin ist wieder frei, der Kunde zahlt nichts.",
    noneH: "Noch keine Buchungen",
    noneP: "Sobald dich jemand bucht oder anfragt, erscheint es hier.",
    st: {
      requested: "Neue Anfrage",
      confirmed: "Bestätigt",
      pending: "Zahlung offen",
      completed: "Erledigt",
      declined: "Abgelehnt",
      cancelled: "Vom Kunden storniert",
      noshow: "Als nicht erschienen gemeldet",
      byMe: "Von dir abgesagt",
    },
  },
  en: {
    modeInstant: "You can be booked instantly. Customers book free slots directly.",
    modeRequest: "Customers send you requests. You have 48 hours to reply.",
    change: "Change",
    reqH: "New requests",
    nextH: "Upcoming bookings",
    pastH: "Past and declined",
    accept: "Accept",
    decline: "Decline",
    sure: "Really decline?",
    cancel: "Cancel",
    sureCancel: "Really cancel? The customer gets a full refund.",
    yesCancel: "Yes, cancel",
    cancelled: "Booking cancelled. The customer gets a full refund.",
    sureLate: (p: string) => `Less than 24 hours before the start: without an emergency, a contractual penalty equal to your fee applies (${p}) and the customer gets a voucher. In an emergency (e.g. accident, sudden illness), send us proof and the penalty is dropped.`,
    yesEmergency: "Emergency, proof to follow",
    yesNoEmergency: "Cancel without emergency",
    doneProof: "Cancelled. Send the proof to support@showly.de within 7 days and we'll review it.",
    donePenalty: (p: string) => `Cancelled. The contractual penalty of ${p} will be invoiced to you.`,
    penDue: (p: string) => `Contractual penalty ${p}: will be invoiced`,
    penProof: "Emergency proof under review (support@showly.de)",
    penWaived: "Proof accepted, no penalty",
    claim: "Prove emergency",
    claimed: "Thanks. Send the proof to support@showly.de within 7 days.",
    yes: "Yes, decline",
    no: "Back",
    until: (d: string) => `Reply by ${d}`,
    fee: "your fee",
    guests: (g: string) => `${g} guests`,
    customer: "Customer",
    accepted: "Booking accepted. The customer will be notified.",
    declined: "Request declined. The slot is free again and the customer pays nothing.",
    noneH: "No bookings yet",
    noneP: "As soon as someone books or requests you, it shows up here.",
    st: {
      requested: "New request",
      confirmed: "Confirmed",
      pending: "Payment open",
      completed: "Done",
      declined: "Declined",
      cancelled: "Cancelled by customer",
      noshow: "Reported as no-show",
      byMe: "Cancelled by you",
    },
  },
  es: {
    modeInstant: "Se te puede reservar al instante. Los clientes reservan huecos libres directamente.",
    modeRequest: "Los clientes te envían solicitudes. Tienes 48 horas para responder.",
    change: "Cambiar",
    reqH: "Nuevas solicitudes",
    nextH: "Próximas reservas",
    pastH: "Pasadas y rechazadas",
    accept: "Aceptar",
    decline: "Rechazar",
    sure: "¿Seguro que quieres rechazar?",
    cancel: "Cancelar",
    sureCancel: "¿Seguro que quieres cancelar? El cliente recibe el reembolso completo.",
    yesCancel: "Sí, cancelar",
    cancelled: "Reserva cancelada. El cliente recibe el reembolso completo.",
    sureLate: (p: string) => `Faltan menos de 24 horas: sin una emergencia se aplica una penalización igual a tu caché (${p}) y el cliente recibe un vale. En caso de emergencia (p. ej. accidente, enfermedad repentina), envíanos el justificante y no habrá penalización.`,
    yesEmergency: "Emergencia, envío justificante",
    yesNoEmergency: "Cancelar sin emergencia",
    doneProof: "Cancelada. Envía el justificante a support@showly.de en 7 días y lo revisaremos.",
    donePenalty: (p: string) => `Cancelada. Se te facturará la penalización de ${p}.`,
    penDue: (p: string) => `Penalización ${p}: se facturará`,
    penProof: "Justificante de emergencia en revisión (support@showly.de)",
    penWaived: "Justificante aceptado, sin penalización",
    claim: "Justificar emergencia",
    claimed: "Gracias. Envía el justificante a support@showly.de en 7 días.",
    yes: "Sí, rechazar",
    no: "Volver",
    until: (d: string) => `Responder antes del ${d}`,
    fee: "tu caché",
    guests: (g: string) => `${g} invitados`,
    customer: "Cliente",
    accepted: "Reserva aceptada. Avisaremos al cliente.",
    declined: "Solicitud rechazada. La fecha vuelve a estar libre y el cliente no paga nada.",
    noneH: "Aún no hay reservas",
    noneP: "En cuanto alguien te reserve o te envíe una solicitud, aparecerá aquí.",
    st: {
      requested: "Nueva solicitud",
      confirmed: "Confirmada",
      pending: "Pago pendiente",
      completed: "Hecha",
      declined: "Rechazada",
      cancelled: "Cancelada por el cliente",
      noshow: "Marcada como no presentado",
      byMe: "Cancelada por ti",
    },
  },
} as const;

export function IncomingBookings({ artistId, onEditProfile }: { artistId: number; onEditProfile?: () => void }) {
  const { lang, fmt, fmtDate, t, bookings, respondBooking, cancelByArtist, claimEmergency, penalties, toast } = useShowly();
  const C = COPY[(lang as "de" | "en" | "es") ?? "de"] ?? COPY.de;
  const navigate = useNavigate();
  const [asking, setAsking] = useState<number | null>(null);
  const a = ARTISTS.find((x) => x.id === artistId);
  if (!a) return null;

  const mine = bookings.filter((b) => b.artistId === artistId);
  const today = new Date().toISOString().slice(0, 10);
  const requests = mine.filter((b) => b.status === "requested");
  const next = mine
    .filter((b) => (b.status === "confirmed" || b.status === "pending") && b.dateISO >= today)
    .sort((x, y) => (x.dateISO < y.dateISO ? -1 : 1));
  const past = mine.filter((b) => !requests.includes(b) && !next.includes(b));

  const when = (iso: string) =>
    new Date(iso).toLocaleString(lang === "en" ? "en-GB" : lang === "es" ? "es-ES" : "de-DE", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  function row(b: Booking) {
    const net = bookingPrice(a!, b.hours || minHoursOf(a!), b.pkg).payout;
    const until = respondBy(b.requestedAt);
    const pen = penalties.find((p) => p.bookingId === b.id);
    const late = isLateCancel(b);
    return (
      <article className={"dash26-item inb-item s-" + b.status} key={b.id}>
        <div className="dash26-item-body">
          <div className="dash26-item-top">
            <span className="dash26-item-name static">
              {fmtDate(b.dateISO)}
              {b.slot ? ` · ${b.slot} ${t("misc.uhr")}` : ""}
            </span>
            <span className={"dash26-status s-" + b.status}>
              {b.status === "declined" && b.cancelledBy === "artist" ? C.st.byMe : C.st[b.status]}
            </span>
          </div>
          <div className="dash26-item-meta">
            {b.customer && (
              <span>
                <Icon name="user" /> {b.customer}
              </span>
            )}
            {b.hours ? (
              <span>
                <Icon name="clock" /> {t("book.hoursVal", { n: b.hours })}
              </span>
            ) : null}
            {b.figure && (
              <span>
                <Icon name="mask" /> {figName(a!.cat, b.figure, lang)}
              </span>
            )}
            {b.occasion && (
              <span>
                <Icon name="party" /> {b.occasion}
              </span>
            )}
            {b.guests && (
              <span>
                <Icon name="user" /> {C.guests(b.guests)}
              </span>
            )}
          </div>
          {b.status === "requested" && until && <p className="inb-until">{C.until(when(until))}</p>}
          {pen && (
            <p className={"inb-pen s-" + pen.status}>
              {pen.status === "due" ? C.penDue(fmt(pen.amount)) : pen.status === "proof" ? C.penProof : C.penWaived}
              {pen.status === "due" && (
                <button
                  type="button"
                  className="inb-mode-btn"
                  onClick={() => {
                    claimEmergency(pen.id);
                    toast(C.claimed);
                  }}
                >
                  {C.claim}
                </button>
              )}
            </p>
          )}
        </div>
        <div className="dash26-item-side">
          <b>{fmt(net)}</b>
          <small>{C.fee}</small>
        </div>
        {(b.status === "confirmed" || b.status === "pending") && b.dateISO >= today && (
          <div className="inb-actions">
            {asking === b.id ? (
              <>
                <span className="inb-sure">{late ? C.sureLate(fmt(net)) : C.sureCancel}</span>
                <button className="dash26-mini outline" onClick={() => setAsking(null)}>
                  {C.no}
                </button>
                {late && (
                  <button
                    className="dash26-mini outline"
                    onClick={() => {
                      cancelByArtist(b.id, true);
                      setAsking(null);
                      toast(C.doneProof);
                    }}
                  >
                    {C.yesEmergency}
                  </button>
                )}
                <button
                  className="dash26-mini inb-decline"
                  onClick={() => {
                    const r = cancelByArtist(b.id, false);
                    setAsking(null);
                    toast(r === "penalty" ? C.donePenalty(fmt(net)) : C.cancelled);
                  }}
                >
                  {late ? C.yesNoEmergency : C.yesCancel}
                </button>
              </>
            ) : (
              <button className="dash26-mini outline inb-decline-ghost" onClick={() => setAsking(b.id)}>
                <Icon name="close" /> {C.cancel}
              </button>
            )}
          </div>
        )}
        {b.status === "requested" && (
          <div className="inb-actions">
            {asking === b.id ? (
              <>
                <span className="inb-sure">{C.sure}</span>
                <button className="dash26-mini outline" onClick={() => setAsking(null)}>
                  {C.no}
                </button>
                <button
                  className="dash26-mini inb-decline"
                  onClick={() => {
                    respondBooking(b.id, false);
                    setAsking(null);
                    toast(C.declined);
                  }}
                >
                  {C.yes}
                </button>
              </>
            ) : (
              <>
                <button className="dash26-mini outline inb-decline-ghost" onClick={() => setAsking(b.id)}>
                  <Icon name="close" /> {C.decline}
                </button>
                <button
                  className="dash26-mini inb-accept"
                  onClick={() => {
                    respondBooking(b.id, true);
                    toast(C.accepted);
                  }}
                >
                  <Icon name="check" /> {C.accept}
                </button>
              </>
            )}
          </div>
        )}
      </article>
    );
  }

  const instant = isInstant(a);
  return (
    <div className="inb">
      <div className="inb-mode">
        <Icon name={instant ? "check" : "clock"} />
        <span className="inb-mode-text">{instant ? C.modeInstant : C.modeRequest}</span>
        <button
          className="inb-mode-btn"
          onClick={() =>
            onEditProfile ? onEditProfile() : navigate({ to: "/dashboard", search: { tab: "edit" } as never })
          }
        >
          {C.change}
        </button>
      </div>

      {mine.length === 0 && (
        <div className="feed26-empty dash26-empty">
          <span className="feed26-empty-ic">
            <Icon name="clipboard" />
          </span>
          <h3>{C.noneH}</h3>
          <p>{C.noneP}</p>
        </div>
      )}

      {requests.length > 0 && (
        <>
          <h3 className="inb-h">
            {C.reqH} <span className="inb-count">{requests.length}</span>
          </h3>
          <div className="dash26-list">{requests.map(row)}</div>
        </>
      )}
      {next.length > 0 && (
        <>
          <h3 className="inb-h">{C.nextH}</h3>
          <div className="dash26-list">{next.map(row)}</div>
        </>
      )}
      {past.length > 0 && (
        <>
          <h3 className="inb-h">{C.pastH}</h3>
          <div className="dash26-list">{past.map(row)}</div>
        </>
      )}
    </div>
  );
}
