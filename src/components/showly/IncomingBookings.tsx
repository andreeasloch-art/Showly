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
import { PENALTY_RATE, checkinOpen, isLateCancel, respondBy } from "@/showly/booking";

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
    sureLate: (p: string) => `Weniger als 24 Stunden vor Beginn: Ohne Notfall fällt eine Vertragsstrafe von 50 % deiner Gage an (${p}), und der Kunde bekommt einen Gutschein. Bei einem Notfall (z. B. Unfall, akute Krankheit) schick uns den Nachweis, dann entfällt die Strafe.`,
    yesEmergency: "Notfall, Nachweis folgt",
    yesNoEmergency: "Ohne Notfall absagen",
    doneProof: "Abgesagt. Schick den Nachweis innerhalb von 7 Tagen an support@showly.de, wir prüfen ihn.",
    donePenalty: (p: string) => `Abgesagt. Die Vertragsstrafe von ${p} wird dir in Rechnung gestellt.`,
    penDue: (p: string) => `Vertragsstrafe ${p}: wird in Rechnung gestellt`,
    penProof: "Deine Stellungnahme oder dein Nachweis wird geprüft (support@showly.de)",
    penWaived: "Nachweis anerkannt, keine Vertragsstrafe",
    claim: "Notfall belegen",
    claimed: "Danke. Schick den Nachweis innerhalb von 7 Tagen an support@showly.de.",
    penHearing: (d: string) => `Der Kunde meldet: nicht erschienen. Du kannst dich bis ${d} äußern oder einen Notfall belegen, danach wird die Vertragsstrafe fällig.`,
    wasThere: "Ich war da",
    disputed: "Danke. Schick uns kurz, was passiert ist (z. B. Fotos vom Auftritt), an support@showly.de. Wir prüfen das.",
    checkinH: "Check-in vor Ort",
    checkinP: "Frag den Kunden nach seinem 4-stelligen Code und gib ihn hier ein. Das belegt, dass du da warst.",
    checkinBtn: "Einchecken",
    checkinOk: "Eingecheckt. Danke!",
    checkinBad: "Der Code stimmt nicht. Bitte frag noch einmal nach.",
    checkedIn: (t: string) => `Eingecheckt um ${t}`,
    stWarn: (d: string) => `Wegen eines Nichterscheinens kannst du bis ${d} nur per Anfrage gebucht werden und stehst in der Suche weiter unten (AGB § 23).`,
    stSusp: (d: string) => `Dein Profil ist wegen wiederholten Nichterscheinens bis ${d} gesperrt (AGB § 23).`,
    stRemoved: "Dein Profil wurde wegen dreimaligen Nichterscheinens innerhalb von 12 Monaten dauerhaft entfernt (AGB § 23).",
    stAppeal: "Du kannst innerhalb von 6 Monaten kostenlos widersprechen: support@showly.de.",
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
    sureLate: (p: string) => `Less than 24 hours before the start: without an emergency, a contractual penalty of 50% of your fee applies (${p}) and the customer gets a voucher. In an emergency (e.g. accident, sudden illness), send us proof and the penalty is dropped.`,
    yesEmergency: "Emergency, proof to follow",
    yesNoEmergency: "Cancel without emergency",
    doneProof: "Cancelled. Send the proof to support@showly.de within 7 days and we'll review it.",
    donePenalty: (p: string) => `Cancelled. The contractual penalty of ${p} will be invoiced to you.`,
    penDue: (p: string) => `Contractual penalty ${p}: will be invoiced`,
    penProof: "Your response or proof is under review (support@showly.de)",
    penWaived: "Proof accepted, no penalty",
    claim: "Prove emergency",
    claimed: "Thanks. Send the proof to support@showly.de within 7 days.",
    penHearing: (d: string) => `The customer reports: no-show. You can respond or prove an emergency until ${d}; after that, the contractual penalty becomes due.`,
    wasThere: "I was there",
    disputed: "Thanks. Briefly send us what happened (e.g. photos of the gig) at support@showly.de. We'll review it.",
    checkinH: "Check-in on site",
    checkinP: "Ask the customer for their 4-digit code and enter it here. It proves you were there.",
    checkinBtn: "Check in",
    checkinOk: "Checked in. Thanks!",
    checkinBad: "The code is wrong. Please ask again.",
    checkedIn: (t: string) => `Checked in at ${t}`,
    stWarn: (d: string) => `Because of a no-show, you can only be booked by request until ${d} and appear lower in search (T&C § 23).`,
    stSusp: (d: string) => `Your profile is suspended until ${d} because of repeated no-shows (T&C § 23).`,
    stRemoved: "Your profile was permanently removed after three no-shows within 12 months (T&C § 23).",
    stAppeal: "You can appeal free of charge within 6 months: support@showly.de.",
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
    sureLate: (p: string) => `Faltan menos de 24 horas: sin una emergencia se aplica una penalización del 50 % de tu caché (${p}) y el cliente recibe un vale. En caso de emergencia (p. ej. accidente, enfermedad repentina), envíanos el justificante y no habrá penalización.`,
    yesEmergency: "Emergencia, envío justificante",
    yesNoEmergency: "Cancelar sin emergencia",
    doneProof: "Cancelada. Envía el justificante a support@showly.de en 7 días y lo revisaremos.",
    donePenalty: (p: string) => `Cancelada. Se te facturará la penalización de ${p}.`,
    penDue: (p: string) => `Penalización ${p}: se facturará`,
    penProof: "Tu respuesta o justificante está en revisión (support@showly.de)",
    penWaived: "Justificante aceptado, sin penalización",
    claim: "Justificar emergencia",
    claimed: "Gracias. Envía el justificante a support@showly.de en 7 días.",
    penHearing: (d: string) => `El cliente indica: no se presentó. Puedes responder o justificar una emergencia hasta el ${d}; después, la penalización será exigible.`,
    wasThere: "Estuve allí",
    disputed: "Gracias. Envíanos lo que pasó (p. ej. fotos de la actuación) a support@showly.de. Lo revisaremos.",
    checkinH: "Check-in en el lugar",
    checkinP: "Pide al cliente su código de 4 cifras e introdúcelo aquí. Demuestra que estuviste allí.",
    checkinBtn: "Hacer check-in",
    checkinOk: "Check-in hecho. ¡Gracias!",
    checkinBad: "El código no es correcto. Vuelve a preguntar.",
    checkedIn: (t: string) => `Check-in a las ${t}`,
    stWarn: (d: string) => `Por no presentarte, hasta el ${d} solo se te puede reservar por solicitud y apareces más abajo en la búsqueda (CG § 23).`,
    stSusp: (d: string) => `Tu perfil está suspendido hasta el ${d} por no presentarte varias veces (CG § 23).`,
    stRemoved: "Tu perfil se ha eliminado definitivamente tras tres ausencias en 12 meses (CG § 23).",
    stAppeal: "Puedes reclamar gratis en un plazo de 6 meses: support@showly.de.",
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
  const { lang, fmt, fmtDate, t, bookings, respondBooking, cancelByArtist, claimEmergency, penalties, checkIn, standing, instantFor, toast } = useShowly();
  const [codes, setCodes] = useState<Record<number, string>>({});
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
              {pen.status === "hearing"
                ? C.penHearing(fmtDate(pen.hearingUntil))
                : pen.status === "due"
                  ? C.penDue(fmt(pen.amount))
                  : pen.status === "proof"
                    ? C.penProof
                    : C.penWaived}
              {pen.status === "hearing" && pen.reason === "noshow" && (
                <button
                  type="button"
                  className="inb-mode-btn"
                  onClick={() => {
                    claimEmergency(pen.id);
                    toast(C.disputed);
                  }}
                >
                  {C.wasThere}
                </button>
              )}
              {(pen.status === "due" || pen.status === "hearing") && (
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
          {b.checkedInAt ? (
            <p className="inb-checked">
              <Icon name="check" /> {C.checkedIn(new Date(b.checkedInAt).toLocaleTimeString(lang === "en" ? "en-GB" : lang === "es" ? "es-ES" : "de-DE", { hour: "2-digit", minute: "2-digit" }))}
            </p>
          ) : (
            (b.status === "confirmed" || b.status === "pending") &&
            checkinOpen(b) && (
              <div className="inb-checkin">
                <b>{C.checkinH}</b>
                <small>{C.checkinP}</small>
                <div>
                  <input
                    id={"checkin-" + b.id}
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="0000"
                    value={codes[b.id] || ""}
                    onChange={(e) => setCodes((c) => ({ ...c, [b.id]: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                  />
                  <button
                    type="button"
                    className="dash26-mini inb-accept"
                    disabled={(codes[b.id] || "").length !== 4}
                    onClick={async () => toast((await checkIn(b.id, codes[b.id] || "")) ? C.checkinOk : C.checkinBad)}
                  >
                    {C.checkinBtn}
                  </button>
                </div>
              </div>
            )
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
                <span className="inb-sure">{late ? C.sureLate(fmt(Math.round(net * PENALTY_RATE.late))) : C.sureCancel}</span>
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
                    toast(r === "penalty" ? C.donePenalty(fmt(Math.round(net * PENALTY_RATE.late))) : C.cancelled);
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

  const instant = instantFor(a);
  const st = standing(a.id);
  return (
    <div className="inb">
      {(st.removed || !st.bookable || !st.instantAllowed) && (
        <div className="inb-standing" role="alert">
          <Icon name="shield" />
          <span>
            <b>{st.removed ? C.stRemoved : !st.bookable ? C.stSusp(fmtDate(st.until)) : C.stWarn(fmtDate(st.until))}</b>
            <small>{C.stAppeal}</small>
          </span>
        </div>
      )}
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
