/* Eingehende Buchungen eines Künstlers.
 *
 * Oben die offenen Anfragen mit Annehmen und Ablehnen, darunter kommende und
 * vergangene Buchungen. Ob Kunden sofort buchen oder erst anfragen, legt der
 * Künstler im Profil fest (siehe showly/booking.ts). Ablehnen fragt einmal
 * nach, direkt im Eintrag: Browser-Dialoge wie confirm() sind in der App-
 * Hülle und in Vorschauen oft gesperrt. */
import { ComplaintList } from "./Fair";
import { reviewWindow } from "@/showly/policies";
import { dbIdOf } from "@/showly/cloudMap";
import { isBusiness } from "@/showly/providerStatus";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ARTISTS } from "@/showly/data";
import { useShowly, type Booking } from "@/showly/store";
import { Icon } from "@/showly/ui";
import { figName } from "@/showly/figures";
import { bookingPrice, minHoursOf } from "@/showly/pricing";
import { checkinOpen, respondBy, startOf } from "@/showly/booking";
import { ARTIST_PENALTY, artistCancelStage } from "@/showly/policies";
import { Chat, unreadFor, useUnread } from "./Chat";

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
    sureLate: (p: string) => `Weniger als 14 Tage vor dem Event: Ohne Notfall fällt eine Vertragsstrafe an (${p}; unter 48 Stunden 25 % deiner Gage, sonst 15 %), sie wird mit deiner nächsten Auszahlung verrechnet. Das zählt als Verwarnung und erscheint in deiner Stornoquote; 3 Verwarnungen in 12 Monaten führen zur Sperre. Bei einem Notfall (z. B. Unfall, akute Krankheit) schick uns den Nachweis, dann entfällt die Strafe.`,
    yesEmergency: "Notfall, Nachweis folgt",
    yesNoEmergency: "Ohne Notfall absagen",
    doneProof: "Abgesagt. Schick den Nachweis innerhalb von 7 Tagen an support@showly.eu, wir prüfen ihn.",
    donePenalty: (p: string) => `Abgesagt. Die Vertragsstrafe von ${p} wird mit deiner nächsten Auszahlung verrechnet.`,
    penDue: (p: string) => `Vertragsstrafe ${p}: wird in Rechnung gestellt`,
    penProof: "Deine Stellungnahme oder dein Nachweis wird geprüft (support@showly.eu)",
    penWaived: "Nachweis anerkannt, keine Vertragsstrafe",
    sureLatePriv: "Weniger als 14 Tage vor dem Event: Ohne Notfall bekommst du eine Verwarnung nach dem Stufenmodell (AGB § 23), und der Kunde bekommt einen Gutschein. Eine Geldstrafe gibt es bei Privatanbietern nicht. Bei einem Notfall schick uns den Nachweis.",
    donePenaltyPriv: "Abgesagt. Die späte Absage wird als Verwarnung vermerkt (AGB § 23).",
    penDuePriv: "Späte Absage oder Nichterscheinen: als Verwarnung vermerkt, keine Geldstrafe",
    penHearingPriv: (d: string) => `Der Kunde meldet: nicht erschienen. Du kannst dich bis ${d} äußern oder einen Notfall belegen, danach wird es als Verwarnung vermerkt.`,
    claim: "Notfall belegen",
    claimed: "Danke. Schick den Nachweis innerhalb von 7 Tagen an support@showly.eu.",
    penHearing: (d: string) => `Der Kunde meldet: nicht erschienen. Du kannst dich bis ${d} äußern oder einen Notfall belegen, danach wird die Vertragsstrafe fällig.`,
    wasThere: "Ich war da",
    msgs: "Nachrichten",
    disputed: "Danke. Schick uns kurz, was passiert ist (z. B. Fotos vom Auftritt), an support@showly.eu. Wir prüfen das.",
    checkinH: "Check-in vor Ort",
    checkinP: "Frag den Kunden nach seinem 4-stelligen Code und gib ihn hier ein. Das belegt, dass du da warst.",
    checkinBtn: "Einchecken",
    checkinOk: "Eingecheckt. Danke!",
    checkinBad: "Der Code stimmt nicht. Bitte frag noch einmal nach.",
    checkedIn: (t: string) => `Eingecheckt um ${t}`,
    stWarn: (d: string) => `Wegen eines Nichterscheinens kannst du bis ${d} nur per Anfrage gebucht werden und stehst in der Suche weiter unten (AGB § 23).`,
    stSusp: (d: string) => `Dein Profil ist wegen wiederholten Nichterscheinens bis ${d} gesperrt (AGB § 23).`,
    stRemoved: "Dein Profil wurde wegen dreimaligen Nichterscheinens innerhalb von 12 Monaten dauerhaft entfernt (AGB § 23).",
    stAppeal: "Du kannst innerhalb von 6 Monaten kostenlos widersprechen: support@showly.eu.",
    yes: "Ja, ablehnen",
    no: "Zurück",
    until: (d: string) => `Antwort bis ${d}`,
    fee: "dein Verdienst",
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
    sureLate: (p: string) => `Less than 14 days before the event: without an emergency a contractual penalty applies (${p}; 25% of your fee under 48 hours, otherwise 15%), offset against your next payout. It counts as a warning and shows in your cancellation rate; 3 warnings in 12 months lead to a ban. In an emergency, send us proof and the penalty is dropped.`,
    yesEmergency: "Emergency, proof to follow",
    yesNoEmergency: "Cancel without emergency",
    doneProof: "Cancelled. Send the proof to support@showly.eu within 7 days and we'll review it.",
    donePenalty: (p: string) => `Cancelled. The contractual penalty of ${p} is offset against your next payout.`,
    penDue: (p: string) => `Contractual penalty ${p}: will be invoiced`,
    penProof: "Your response or proof is under review (support@showly.eu)",
    penWaived: "Proof accepted, no penalty",
    sureLatePriv: "Less than 14 days before the event: without an emergency you get a warning under the strike model (T&C § 23), and the customer gets a voucher. Private providers pay no monetary penalty. In an emergency, send us proof.",
    donePenaltyPriv: "Cancelled. The late cancellation is recorded as a warning (T&C § 23).",
    penDuePriv: "Late cancellation or no-show: recorded as a warning, no monetary penalty",
    penHearingPriv: (d: string) => `The customer reports: no-show. You can respond or prove an emergency until ${d}; after that, it is recorded as a warning.`,
    claim: "Prove emergency",
    claimed: "Thanks. Send the proof to support@showly.eu within 7 days.",
    penHearing: (d: string) => `The customer reports: no-show. You can respond or prove an emergency until ${d}; after that, the contractual penalty becomes due.`,
    wasThere: "I was there",
    msgs: "Messages",
    disputed: "Thanks. Briefly send us what happened (e.g. photos of the gig) at support@showly.eu. We'll review it.",
    checkinH: "Check-in on site",
    checkinP: "Ask the customer for their 4-digit code and enter it here. It proves you were there.",
    checkinBtn: "Check in",
    checkinOk: "Checked in. Thanks!",
    checkinBad: "The code is wrong. Please ask again.",
    checkedIn: (t: string) => `Checked in at ${t}`,
    stWarn: (d: string) => `Because of a no-show, you can only be booked by request until ${d} and appear lower in search (T&C § 23).`,
    stSusp: (d: string) => `Your profile is suspended until ${d} because of repeated no-shows (T&C § 23).`,
    stRemoved: "Your profile was permanently removed after three no-shows within 12 months (T&C § 23).",
    stAppeal: "You can appeal free of charge within 6 months: support@showly.eu.",
    yes: "Yes, decline",
    no: "Back",
    until: (d: string) => `Reply by ${d}`,
    fee: "your earnings",
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
    sureLate: (p: string) => `Faltan menos de 14 días: sin una emergencia se aplica una penalización (${p}; 25 % de tu caché a menos de 48 horas, si no 15 %), que se descuenta de tu próximo pago. Cuenta como advertencia; 3 en 12 meses llevan al bloqueo. En caso de emergencia, envíanos el justificante y no habrá penalización.`,
    yesEmergency: "Emergencia, envío justificante",
    yesNoEmergency: "Cancelar sin emergencia",
    doneProof: "Cancelada. Envía el justificante a support@showly.eu en 7 días y lo revisaremos.",
    donePenalty: (p: string) => `Cancelada. La penalización de ${p} se descuenta de tu próximo pago.`,
    penDue: (p: string) => `Penalización ${p}: se facturará`,
    penProof: "Tu respuesta o justificante está en revisión (support@showly.eu)",
    penWaived: "Justificante aceptado, sin penalización",
    sureLatePriv: "Menos de 14 días antes del evento: sin emergencia recibes un aviso según el sistema por niveles (CG § 23) y el cliente recibe un vale. Los particulares no pagan penalización económica. En caso de emergencia, envíanos el justificante.",
    donePenaltyPriv: "Cancelado. La cancelación tardía se registra como aviso (CG § 23).",
    penDuePriv: "Cancelación tardía o ausencia: registrada como aviso, sin penalización económica",
    penHearingPriv: (d: string) => `El cliente informa: no se presentó. Puedes responder o justificar una emergencia hasta el ${d}; después se registrará como aviso.`,
    claim: "Justificar emergencia",
    claimed: "Gracias. Envía el justificante a support@showly.eu en 7 días.",
    penHearing: (d: string) => `El cliente indica: no se presentó. Puedes responder o justificar una emergencia hasta el ${d}; después, la penalización será exigible.`,
    wasThere: "Estuve allí",
    msgs: "Mensajes",
    disputed: "Gracias. Envíanos lo que pasó (p. ej. fotos de la actuación) a support@showly.eu. Lo revisaremos.",
    checkinH: "Check-in en el lugar",
    checkinP: "Pide al cliente su código de 4 cifras e introdúcelo aquí. Demuestra que estuviste allí.",
    checkinBtn: "Hacer check-in",
    checkinOk: "Check-in hecho. ¡Gracias!",
    checkinBad: "El código no es correcto. Vuelve a preguntar.",
    checkedIn: (t: string) => `Check-in a las ${t}`,
    stWarn: (d: string) => `Por no presentarte, hasta el ${d} solo se te puede reservar por solicitud y apareces más abajo en la búsqueda (CG § 23).`,
    stSusp: (d: string) => `Tu perfil está suspendido hasta el ${d} por no presentarte varias veces (CG § 23).`,
    stRemoved: "Tu perfil se ha eliminado definitivamente tras tres ausencias en 12 meses (CG § 23).",
    stAppeal: "Puedes reclamar gratis en un plazo de 6 meses: support@showly.eu.",
    yes: "Sí, rechazar",
    no: "Volver",
    until: (d: string) => `Responder antes del ${d}`,
    fee: "tus ingresos",
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
  /* Nachrichten mit dem Kunden */
  const [chatFor, setChatFor] = useState<number | null>(null);
  const unread = useUnread();
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
    const stage = artistCancelStage(startOf(b), Date.now());
    const late = stage !== "free";
    const rate = ARTIST_PENALTY[stage === "urgent" ? "urgent" : "late"];
    const priv = !isBusiness(a);
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
            {b.status !== "declined" && b.status !== "cancelled" && (
              <button type="button" className="dash26-mini outline chat26-open" onClick={() => setChatFor(b.id)}>
                <Icon name="comment" /> {C.msgs}
                {unreadFor(unread, b.id) > 0 && <span className="chat26-badge">{unreadFor(unread, b.id)}</span>}
              </button>
            )}
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
                ? (priv ? C.penHearingPriv : C.penHearing)(fmtDate(pen.hearingUntil))
                : pen.status === "due"
                  ? priv || !pen.amount
                    ? C.penDuePriv
                    : C.penDue(fmt(pen.amount))
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
                <span className="inb-sure">{late ? (priv ? C.sureLatePriv : C.sureLate(fmt(Math.round(net * rate)))) : C.sureCancel}</span>
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
                    toast(
                      r === "penalty"
                        ? priv
                          ? C.donePenaltyPriv
                          : C.donePenalty(fmt(Math.round(net * rate)))
                        : C.cancelled,
                    );
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
        {(b.status === "confirmed" || b.status === "completed") && dbIdOf(b.id) !== null && reviewWindow(b.dateISO, Date.now()) === "open" && (
          <GuestReview bookingId={dbIdOf(b.id)!} />
        )}
      </article>
    );
  }

  const instant = instantFor(a);
  const st = standing(a.id);
  return (
    <div className="inb">
      <ComplaintList role="provider" />
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
      {chatFor !== null &&
        (() => {
          const cb = mine.find((x) => x.id === chatFor);
          return (
            <Chat
              bookingId={chatFor}
              as="provider"
              heading={`${cb?.customer ?? ""}${cb ? " · " + fmtDate(cb.dateISO) : ""}`}
              onClose={() => setChatFor(null)}
            />
          );
        })()}
    </div>
  );
}

/** Künstler bewertet den Kunden; verdeckt, bis beide bewertet haben oder 14 Tage um sind */
function GuestReview({ bookingId }: { bookingId: number }) {
  const { toast } = useShowly();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [done, setDone] = useState(false);
  if (done) return <p className="fair-muted">Danke! Deine Bewertung bleibt verdeckt, bis der Kunde auch bewertet hat oder 14 Tage um sind.</p>;
  if (!open)
    return (
      <div className="inb-actions">
        <button className="dash26-mini outline" onClick={() => setOpen(true)}>
          <Icon name="star" /> Kunden bewerten
        </button>
      </div>
    );
  return (
    <div className="fair-box">
      <b>Wie war die Zusammenarbeit mit dem Kunden?</b>
      <div className="fair-chips" role="radiogroup" aria-label="Sterne">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} className={"fair-chip" + (rating === n ? " on" : "")} onClick={() => setRating(n)}>
            {n} ★
          </button>
        ))}
      </div>
      <textarea rows={2} placeholder="Kurz (freiwillig)" value={text} onChange={(e) => setText(e.target.value)} aria-label="Text" />
      <button
        className="dash26-mini"
        onClick={async () => {
          const { reviewGuest } = await import("@/utils/fair.functions");
          const r = await reviewGuest({ data: { bookingId, rating, text } }).catch(() => ({ error: "Hat nicht geklappt" }));
          if ("error" in r) return toast(r.error);
          setDone(true);
        }}
      >
        Bewertung abgeben
      </button>
    </div>
  );
}
