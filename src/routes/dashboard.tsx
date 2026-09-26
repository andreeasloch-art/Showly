import { seoHead } from "@/showly/seo";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ARTISTS, SHOP_ITEMS, type Artist } from "@/showly/data";
import { useShowly } from "@/showly/store";
import { CatIcon, Icon, bgOf, hasImg, shopBg } from "@/showly/ui";
import { figName, figuresOf, realName } from "@/showly/figures";
import { Calendar, useCalendar } from "@/components/showly/Calendar";
import { Footer } from "@/components/showly/Footer";
import { ArtistCard } from "@/components/showly/ArtistCard";
import { MyRequests } from "@/components/showly/Sweets";
import { listRequests } from "@/showly/sweets";
import { ProfileEditor } from "@/components/showly/ProfileEditor";
import { IncomingBookings } from "@/components/showly/IncomingBookings";
import { checkinCodeOf, isLateCancel, presenceQuestion, startOf } from "@/showly/booking";
import { DeleteAccount } from "@/components/showly/DeleteAccount";
import { BlockedList } from "@/components/showly/BlockedList";
import { PayoutPanel } from "@/components/showly/PayoutPanel";
import { Chat, unreadFor, useUnread } from "@/components/showly/Chat";
import { ProviderInbox } from "@/components/showly/ProviderInbox";

export const Route = createFileRoute("/dashboard")({
  /* ?tab=edit öffnet direkt einen Bereich, etwa aus dem eigenen Profil heraus */
  validateSearch: (search: Record<string, unknown>): { tab?: string } =>
    typeof search["tab"] === "string" ? { tab: (search["tab"] as string).slice(0, 20) } : {},
  head: () => seoHead("/dashboard", "/dashboard"),
  component: Dashboard,
});

/* Texte, die es nur im neuen Aufbau des Dashboards gibt. */
const COPY = {
  de: {
    sweetReq: "Torten-Anfragen",
    incoming: "Buchungen",
    stNoShow: "Nicht erschienen, erstattet",
    stByArtist: "Vom Künstler abgesagt, erstattet",
    noShow: "Künstler nicht erschienen?",
    noShowSure: "Wir erstatten dir den vollen Betrag. Der Künstler kann sich 7 Tage dazu äußern; bestätigt sich das Nichterscheinen, bekommst du zusätzlich einen Gutschein über 50 €. Bitte melde nur, was wirklich passiert ist; falsche Meldungen können zur Sperrung führen.",
    noShowYes: "Ja, nicht erschienen",
    noShowDone: "Danke für die Meldung. Du bekommst alles zurück. Den Gutschein siehst du hier, sobald die Prüfung abgeschlossen ist (spätestens nach 7 Tagen).",
    vouchH: "Deine Gutscheine",
    vouchP: (d: string) => `Gültig bis ${d}. Zum Einlösen schick den Code mit deiner nächsten Buchung an support@showly.de, wir ziehen ihn vom Betrag ab.`,
    copy: "Kopieren",
    copied: "Code kopiert",
    codeLine: (c: string) => `Check-in-Code: ${c}. Nenne ihn dem Künstler vor Ort.`,
    msgs: "Nachrichten",
    presenceQ: (n: string) => `Ist ${n} da?`,
    presenceP: "Der Künstler hat noch nicht eingecheckt.",
    presenceYes: "Ja, ist da",
    presenceNo: "Nein, nicht erschienen",
    presenceThanks: "Danke! Viel Spaß beim Event.",
    stCancelled: "Storniert",
    cancel: "Stornieren",
    withdraw: "Anfrage zurückziehen",
    cancelFree: "Kostenlos stornieren? Du bekommst den vollen Betrag zurück.",
    cancelLate: "Weniger als 24 Stunden vor Beginn: Die Gage bleibt fällig (AGB § 8). Trotzdem stornieren?",
    cancelReq: "Anfrage zurückziehen? Es wird nichts abgebucht.",
    cancelYes: "Ja, stornieren",
    cancelNo: "Zurück",
    cancelDone: "Buchung storniert. Der Betrag wird erstattet.",
    cancelDoneLate: "Buchung storniert. Die Gage bleibt nach AGB § 8 fällig.",
    incomingSub: "Anfragen annehmen oder ablehnen und kommende Auftritte im Blick behalten.",
    stRequested: "Wartet auf Zusage",
    stDeclined: "Abgelehnt",
    noReqH: "Noch keine Anfragen",
    noReqP: "Torten, Kuchen und Candy Bars fragst du direkt bei Konditoreien und Privatbäckern an.",
    noReqBtn: "Torten ansehen",
    hello: (n: string) => `Hallo, ${n}`,
    find: "Künstler finden",
    shop: "Kostüm-Shop",
    view: "Profil ansehen",
    inclFee: "inkl. Servicegebühr",
    edit: "Profil bearbeiten",
    editSub: "Bilder, Charaktere, Texte, Stundengage und Kontaktdaten. Name und Geburtsdatum aus der Ausweisprüfung sind gesperrt.",
    account: "Konto",
    noPkgH: "Noch keine Pakete",
    noPkgP: "Pakete mit Festpreis legst du in deinem öffentlichen Profil an.",
  },
  en: {
    sweetReq: "Cake requests",
    incoming: "Bookings",
    stNoShow: "No-show, refunded",
    stByArtist: "Cancelled by the artist, refunded",
    noShow: "Artist didn't show up?",
    noShowSure: "We'll refund the full amount. The artist has 7 days to respond; if the no-show is confirmed, you also get a €50 voucher. Please only report what really happened; false reports can lead to a ban.",
    noShowYes: "Yes, no-show",
    noShowDone: "Thanks for letting us know. You get a full refund. Your voucher appears here once the review is done (within 7 days).",
    vouchH: "Your vouchers",
    vouchP: (d: string) => `Valid until ${d}. To redeem, send the code with your next booking to support@showly.de and we'll deduct it.`,
    copy: "Copy",
    copied: "Code copied",
    codeLine: (c: string) => `Check-in code: ${c}. Give it to the artist on site.`,
    msgs: "Messages",
    presenceQ: (n: string) => `Is ${n} there?`,
    presenceP: "The artist hasn't checked in yet.",
    presenceYes: "Yes, they're here",
    presenceNo: "No, didn't show up",
    presenceThanks: "Thanks! Enjoy the event.",
    stCancelled: "Cancelled",
    cancel: "Cancel",
    withdraw: "Withdraw request",
    cancelFree: "Cancel for free? You get a full refund.",
    cancelLate: "Less than 24 hours before the start: the fee remains due (T&C § 8). Cancel anyway?",
    cancelReq: "Withdraw the request? Nothing will be charged.",
    cancelYes: "Yes, cancel",
    cancelNo: "Back",
    cancelDone: "Booking cancelled. The amount will be refunded.",
    cancelDoneLate: "Booking cancelled. The fee remains due under T&C § 8.",
    incomingSub: "Accept or decline requests and keep track of upcoming gigs.",
    stRequested: "Awaiting reply",
    stDeclined: "Declined",
    noReqH: "No requests yet",
    noReqP: "Request cakes, bakes and candy bars directly from patisseries and home bakers.",
    noReqBtn: "See cakes",
    hello: (n: string) => `Hi, ${n}`,
    find: "Find artists",
    shop: "Costume shop",
    view: "View profile",
    inclFee: "incl. service fee",
    edit: "Edit profile",
    editSub: "Photos, characters, texts, hourly fee and contact details. Name and date of birth from the ID check are locked.",
    account: "Account",
    noPkgH: "No packages yet",
    noPkgP: "Create fixed-price packages in your public profile.",
  },
  es: {
    sweetReq: "Solicitudes de tartas",
    incoming: "Reservas",
    stNoShow: "No se presentó, reembolsada",
    stByArtist: "Cancelada por el artista, reembolsada",
    noShow: "¿El artista no se presentó?",
    noShowSure: "Te devolvemos el importe completo. El artista tiene 7 días para responder; si se confirma la ausencia, recibes además un vale de 50 €. Denuncia solo lo que ocurrió de verdad; las denuncias falsas pueden llevar al bloqueo.",
    noShowYes: "Sí, no se presentó",
    noShowDone: "Gracias por avisar. Recibes el reembolso completo. Tu vale aparecerá aquí cuando termine la revisión (máx. 7 días).",
    vouchH: "Tus vales",
    vouchP: (d: string) => `Válido hasta el ${d}. Para canjearlo, envía el código con tu próxima reserva a support@showly.de y lo descontamos.`,
    copy: "Copiar",
    copied: "Código copiado",
    codeLine: (c: string) => `Código de check-in: ${c}. Dáselo al artista en el lugar.`,
    msgs: "Mensajes",
    presenceQ: (n: string) => `¿Está ${n} allí?`,
    presenceP: "El artista aún no ha hecho check-in.",
    presenceYes: "Sí, está aquí",
    presenceNo: "No, no se presentó",
    presenceThanks: "¡Gracias! Disfruta del evento.",
    stCancelled: "Cancelada",
    cancel: "Cancelar",
    withdraw: "Retirar solicitud",
    cancelFree: "¿Cancelar gratis? Recibes el importe completo.",
    cancelLate: "Faltan menos de 24 horas: el caché sigue siendo debido (CG § 8). ¿Cancelar igualmente?",
    cancelReq: "¿Retirar la solicitud? No se cobrará nada.",
    cancelYes: "Sí, cancelar",
    cancelNo: "Volver",
    cancelDone: "Reserva cancelada. Se te reembolsará el importe.",
    cancelDoneLate: "Reserva cancelada. El caché sigue siendo debido según CG § 8.",
    incomingSub: "Acepta o rechaza solicitudes y controla tus próximas actuaciones.",
    stRequested: "Esperando respuesta",
    stDeclined: "Rechazada",
    noReqH: "Aún no hay solicitudes",
    noReqP: "Pide tartas y candy bars directamente a pastelerías y particulares.",
    noReqBtn: "Ver tartas",
    hello: (n: string) => `Hola, ${n}`,
    find: "Buscar artistas",
    shop: "Tienda de disfraces",
    view: "Ver perfil",
    inclFee: "incl. tarifa de servicio",
    edit: "Editar perfil",
    editSub: "Fotos, personajes, textos, caché por hora y contacto. El nombre y la fecha de nacimiento de la verificación están bloqueados.",
    account: "Cuenta",
    noPkgH: "Aún no hay paquetes",
    noPkgP: "Crea paquetes con precio fijo en tu perfil público.",
  },
} as const;

function Face({ a }: { a: Artist }) {
  if (hasImg(a)) return null;
  return (
    <span className="img-fallback">
      <CatIcon id={a.cat} />
    </span>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .map((x) => x[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/* Leerer Bereich mit Einladung, im selben Stil wie der leere Event-Feed */
function Empty({
  icon,
  title,
  text,
  button,
  onClick,
}: {
  icon: string;
  title: string;
  text: string;
  button: string;
  onClick: () => void;
}) {
  return (
    <div className="feed26-empty dash26-empty">
      <span className="feed26-empty-ic">
        <Icon name={icon} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      <button className="home-btn primary" onClick={onClick}>
        {button} <Icon name="arrow" />
      </button>
    </div>
  );
}

/* Dashboard für Kunden und Anbieter.
 *
 * Statt einer Seitenleiste stehen die Bereiche als Reiter oben unter der
 * Begrüßung, wie bei Konto-Seiten von Airbnb oder Instagram. Das spart auf
 * dem Handy den Umweg über ein Menü: die Reiter laufen dort waagerecht und
 * lassen sich wischen. Inhalt, Daten und Funktionen sind dieselben wie
 * vorher; neu sind nur Aufbau und Gestaltung. */
function Dashboard() {
  const {
    t,
    lang,
    L,
    fmt,
    fmtDate,
    setLang,
    bookings,
    orders,
    payouts,
    favorites,
    session,
    hydrated,
    toast,
    catLabel,
    myProviders,
    cancelByCustomer,
    reportNoShow,
    vouchers,
    confirmPresence,
  } = useShowly();
  const [cancelAsk, setCancelAsk] = useState<number | null>(null);
  /* Nachrichten zu einer Buchung */
  const [chatFor, setChatFor] = useState<number | null>(null);
  const unread = useUnread();
  const todayISO = new Date().toISOString().slice(0, 10);
  /* Nichterscheinen lässt sich bis 14 Tage nach dem Termin melden */
  const noShowFrom = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  const isLate = (b: { dateISO: string; slot?: string }) => isLateCancel(b);
  const C = COPY[(lang as "de" | "en" | "es") ?? "de"] ?? COPY.de;
  const navigate = useNavigate();
  const cal = useCalendar();
  const myProfile = session?.providerId ? ARTISTS.find((a) => a.id === session.providerId) : null;
  const [sweetReqCount, setSweetReqCount] = useState(0);
  useEffect(() => setSweetReqCount(listRequests().length), []);
  const items: [string, string, string, string | number][] = myProfile
    ? [
        ["incoming", "clipboard", C.incoming, bookings.filter((b) => b.artistId === myProfile.id && b.status === "requested").length || ""],
        ["edit", "sparkle", C.edit, ""],
        ["calendar", "calendar", t("dash.calendar"), ""],
        ...(((myProfile as any).packages || []).length
          ? ([["packages", "gift", t("dash.packages"), ((myProfile as any).packages || []).length]] as [
              string,
              string,
              string,
              string | number,
            ][])
          : []),
        ["payments", "money", t("dash.payments"), ""],
        ["profile", "user", C.account, ""],
      ]
    : [
        ["bookings", "clipboard", t("dash.bookings"), bookings.length],
        ["orders", "bag", t("dash.orders"), orders.length],
        ["requests", "gift", C.sweetReq, sweetReqCount],
        ["favorites", "heart", t("dash.favs"), favorites.length],
        ["payments", "money", t("dash.payments"), ""],
        ["profile", "user", t("dash.profile"), ""],
      ];
  const { tab } = Route.useSearch();
  const [section, setSection] = useState(tab || items[0]![0]);
  const active = items.some((i) => i[0] === section) ? section : items[0]![0];
  const current = items.find((i) => i[0] === active)!;

  const name = session ? session.name : "Maria Müller";
  const mail = session ? session.email : "maria@mail.com";
  const first = name.split(" ")[0] || name;
  const roleLabel = session
    ? myProfile
      ? session.role === "planner"
        ? t("prov.planner")
        : t("prov.artist")
      : t("auth.customer")
    : "";
  const statusLabel = (st: string) =>
    st === "confirmed"
      ? t("mod.confirmed")
      : st === "pending"
        ? t("dash.pending")
        : st === "requested"
          ? C.stRequested
          : st === "noshow"
            ? C.stNoShow
            : st === "declined"
            ? C.stDeclined
            : st === "cancelled"
              ? C.stCancelled
              : t("dash.done");

  const spent =
    bookings
      .filter((b) => b.status !== "cancelled" && b.status !== "declined")
      .reduce((s, b) => s + b.amount, 0) + orders.reduce((s, o) => s + o.total, 0);
  const favArtists = ARTISTS.filter((a) => favorites.includes(a.id));
  const payRows = [
    ...bookings.map((b) => ({
      date: b.dateISO,
      label: `${t("tbl.booking")}: ${L(ARTISTS.find((a) => a.id === b.artistId)?.name || "")}`,
      amount: b.amount,
      paid: b.status === "completed",
    })),
    ...orders.map((o) => ({
      date: o.dateISO,
      label: `${t("tbl.order")} #${o.id}`,
      amount: o.total,
      paid: o.status === "completed",
    })),
  ].sort((x, y) => (x.date < y.date ? 1 : -1));

  const heads: Record<string, [string, string]> = {
    bookings: [t("dash.bookingsH"), t("dash.bookingsSub")],
    incoming: [C.incoming, C.incomingSub],
    orders: [t("dash.ordersH"), t("dash.ordersSub")],
    favorites: [t("dash.favsH"), t("dash.favsSub")],
    payments: [t("dash.paymentsH"), t("dash.paymentsSub")],
    calendar: [t("dash.calendar"), t("cal.ownerHint")],
    packages: [t("dash.packages"), t("pkg.p")],
    myprofile: [t("dash.myprofile"), t("dash.myProfSub")],
    edit: [C.edit, C.editSub],
    profile: [t("dash.profileH"), t("dash.profileSub")],
  };
  const [headT, headP] = heads[active] ?? [current[2], ""];

  /* Nur mit Anmeldung. Wer nicht eingeloggt ist, landet auf der Seite zum
     Anmelden. Bis der gespeicherte Zustand geladen ist, zeigen wir nichts,
     damit kein fremdes Beispielkonto aufblitzt. */
  useEffect(() => {
    if (hydrated && !session) void navigate({ to: "/konto", replace: true });
  }, [hydrated, session, navigate]);
  if (!hydrated || !session) return null;

  return (
    <div className="page active ui26 dash26">
      <section className="dash26-top">
        <div className="dash26-top-inner">
          <div className="dash26-hello rise" style={{ ["--d" as string]: "0ms" }}>
            {myProfile ? (
              <span className="dash26-avatar img" style={bgOf(myProfile, "center 28%")} />
            ) : (
              <span className="dash26-avatar">{initials(name)}</span>
            )}
            <div className="dash26-hello-text">
              <span className="home-eyebrow">
                {myProfile ? t("dash.mineProv") : t("dash.mine")}
              </span>
              <h1>{C.hello(first)}</h1>
              <p>
                <span>{mail}</span>
                {roleLabel && <span className="dash26-role">{roleLabel}</span>}
              </p>
            </div>
          </div>
          <div className="dash26-quick rise" style={{ ["--d" as string]: "80ms" }}>
            {myProfile ? (
              <button
                className="home-btn primary"
                onClick={() =>
                  navigate({ to: "/kuenstler/$id", params: { id: String(myProfile.id) } })
                }
              >
                {C.view} <Icon name="arrow" />
              </button>
            ) : (
              <button className="home-btn primary" onClick={() => navigate({ to: "/" })}>
                <Icon name="search" /> {C.find}
              </button>
            )}
            <button className="home-btn soft" onClick={() => navigate({ to: "/shop" })}>
              <Icon name="bag" /> {C.shop}
            </button>
          </div>
        </div>

        <nav
          className="dash26-tabs rise"
          style={{ ["--d" as string]: "140ms" }}
          aria-label={t("dash.mine")}
        >
          <div className="dash26-tabs-inner">
            {items.map((it) => (
              <button
                key={it[0]}
                className={"dash26-tab" + (active === it[0] ? " on" : "")}
                aria-current={active === it[0] ? "page" : undefined}
                onClick={() => setSection(it[0])}
              >
                <Icon name={it[1]} />
                <span>{it[2]}</span>
                {it[3] !== "" && <b className="dash26-count">{it[3]}</b>}
              </button>
            ))}
          </div>
        </nav>
      </section>

      <main className="dash26-main">
        <header className="dash26-head" key={active}>
          <h2>{headT}</h2>
          {headP && <p>{headP}</p>}
        </header>

        {active === "bookings" && (
          <>
            {vouchers.length > 0 && (
              <div className="vouch">
                <h3>
                  <Icon name="gift" /> {C.vouchH}
                </h3>
                {vouchers.map((v) => (
                  <div className="vouch-item" key={v.code}>
                    <b>{fmt(v.amount)}</b>
                    <code>{v.code}</code>
                    <button
                      type="button"
                      className="inb-mode-btn"
                      onClick={() => {
                        navigator.clipboard?.writeText(v.code).then(
                          () => toast(C.copied),
                          () => {},
                        );
                      }}
                    >
                      {C.copy}
                    </button>
                    <small>{C.vouchP(fmtDate(v.validUntil))}</small>
                  </div>
                ))}
              </div>
            )}
            <div className="dash26-stats">
              <div className="dash26-stat">
                <span className="dash26-stat-ic violet">
                  <Icon name="clipboard" />
                </span>
                <b>{bookings.length}</b>
                <span>{t("dash.total")}</span>
              </div>
              <div className="dash26-stat">
                <span className="dash26-stat-ic coral">
                  <Icon name="clock" />
                </span>
                <b>{bookings.filter((b) => b.status === "pending").length}</b>
                <span>{t("dash.pending")}</span>
              </div>
              <div className="dash26-stat">
                <span className="dash26-stat-ic green">
                  <Icon name="check" />
                </span>
                <b>{bookings.filter((b) => b.status === "completed").length}</b>
                <span>{t("dash.done")}</span>
              </div>
              <div className="dash26-stat">
                <span className="dash26-stat-ic teal">
                  <Icon name="money" />
                </span>
                <b>{fmt(spent)}</b>
                <span>{t("dash.spent")}</span>
              </div>
            </div>

            {bookings.length ? (
              <div className="dash26-list">
                {bookings.map((b) => {
                  const a = ARTISTS.find((x) => x.id === b.artistId);
                  if (!a) return null;
                  const go = () => navigate({ to: "/kuenstler/$id", params: { id: String(a.id) } });
                  return (
                    <article className="dash26-item" key={b.id}>
                      <button
                        className="dash26-thumb"
                        style={bgOf(a)}
                        onClick={go}
                        aria-label={String(L(a.name))}
                      >
                        <Face a={a} />
                      </button>
                      <div className="dash26-item-body">
                        <div className="dash26-item-top">
                          <button className="dash26-item-name" onClick={go}>
                            {L(a.name)}
                          </button>
                          <span className={"dash26-status s-" + b.status}>
                            {b.status === "declined" && b.cancelledBy === "artist"
                              ? C.stByArtist
                              : statusLabel(b.status)}
                          </span>
                        </div>
                        <div className="dash26-item-meta">
                          <span>
                            <Icon name="calendar" /> {fmtDate(b.dateISO)}
                            {b.slot ? ` · ${b.slot} ${t("misc.uhr")}` : ""}
                          </span>
                          <span>
                            <Icon name="pin" /> {L(a.loc)}
                          </span>
                          {b.figure && (
                            <span>
                              <Icon name="mask" /> {figName(a.cat, b.figure, lang)}
                            </span>
                          )}
                        </div>
                        {(b.status === "confirmed" || b.status === "pending") && b.dateISO >= todayISO && (
                          <p className="dash26-code">
                            <Icon name="lock" /> {C.codeLine(checkinCodeOf(b))}
                          </p>
                        )}
                      </div>
                      <div className="dash26-item-side">
                        <b>{fmt(b.amount)}</b>
                        <small>{C.inclFee}</small>
                        <button className="dash26-mini" onClick={go}>
                          {t("dash.again")} <Icon name="arrow" />
                        </button>
                        {b.status !== "declined" && b.status !== "cancelled" && (
                          <button className="dash26-mini outline chat26-open" onClick={() => setChatFor(b.id)}>
                            <Icon name="comment" /> {C.msgs}
                            {unreadFor(unread, b.id) > 0 && <span className="chat26-badge">{unreadFor(unread, b.id)}</span>}
                          </button>
                        )}
                      </div>
                      {(b.status === "confirmed" || b.status === "pending" || b.status === "requested") &&
                        b.dateISO >= todayISO &&
                        startOf(b) > Date.now() && (
                          <div className="inb-actions">
                            {cancelAsk === b.id ? (
                              <>
                                <span className="inb-sure">
                                  {b.status === "requested"
                                    ? C.cancelReq
                                    : isLate(b)
                                      ? C.cancelLate
                                      : C.cancelFree}
                                </span>
                                <button className="dash26-mini outline" onClick={() => setCancelAsk(null)}>
                                  {C.cancelNo}
                                </button>
                                <button
                                  className="dash26-mini inb-decline"
                                  onClick={() => {
                                    const late = cancelByCustomer(b.id);
                                    setCancelAsk(null);
                                    toast(late ? C.cancelDoneLate : C.cancelDone);
                                  }}
                                >
                                  {C.cancelYes}
                                </button>
                              </>
                            ) : (
                              <button
                                className="dash26-mini outline inb-decline-ghost"
                                onClick={() => setCancelAsk(b.id)}
                              >
                                <Icon name="close" /> {b.status === "requested" ? C.withdraw : C.cancel}
                              </button>
                            )}
                          </div>
                        )}
                      {presenceQuestion(b) && (
                        <div className="inb-actions dash26-presence">
                          <span className="inb-sure">
                            <b>{C.presenceQ(String(L(a.name)))}</b> {C.presenceP}
                          </span>
                          <button
                            className="dash26-mini outline"
                            onClick={() => {
                              reportNoShow(b.id);
                              toast(C.noShowDone);
                            }}
                          >
                            {C.presenceNo}
                          </button>
                          <button
                            className="dash26-mini inb-accept"
                            onClick={() => {
                              confirmPresence(b.id);
                              toast(C.presenceThanks);
                            }}
                          >
                            {C.presenceYes}
                          </button>
                        </div>
                      )}
                      {(b.status === "confirmed" || b.status === "pending") &&
                        !b.checkedInAt &&
                        !presenceQuestion(b) &&
                        b.dateISO < todayISO &&
                        b.dateISO >= noShowFrom && (
                          <div className="inb-actions">
                            {cancelAsk === b.id ? (
                              <>
                                <span className="inb-sure">{C.noShowSure}</span>
                                <button className="dash26-mini outline" onClick={() => setCancelAsk(null)}>
                                  {C.cancelNo}
                                </button>
                                <button
                                  className="dash26-mini inb-decline"
                                  onClick={() => {
                                    reportNoShow(b.id);
                                    setCancelAsk(null);
                                    toast(C.noShowDone);
                                  }}
                                >
                                  {C.noShowYes}
                                </button>
                              </>
                            ) : (
                              <button
                                className="dash26-mini outline inb-decline-ghost"
                                onClick={() => setCancelAsk(b.id)}
                              >
                                {C.noShow}
                              </button>
                            )}
                          </div>
                        )}
                    </article>
                  );
                })}
              </div>
            ) : (
              <Empty
                icon="clipboard"
                title={t("dash.noBookH")}
                text={t("dash.noBookP")}
                button={t("dash.noBookBtn")}
                onClick={() => navigate({ to: "/" })}
              />
            )}
          </>
        )}

        {active === "orders" &&
          (orders.length ? (
            <div className="dash26-list">
              {orders.map((o) => {
                const count = o.items.reduce((s, i) => s + i.qty, 0);
                const firstItem = SHOP_ITEMS.find((x) => x.id === o.items[0]!.shopId);
                const names = o.items
                  .map(
                    (i) =>
                      `${L(SHOP_ITEMS.find((s) => s.id === i.shopId)!.name)} (${t(
                        i.mode === "rent" ? "cart.rent" : "cart.buy",
                      )} ×${i.qty})`,
                  )
                  .join(", ");
                const done = o.status === "completed";
                return (
                  <article className="dash26-item" key={o.id}>
                    <span
                      className="dash26-thumb light"
                      style={firstItem ? shopBg(firstItem) : {}}
                    />
                    <div className="dash26-item-body">
                      <div className="dash26-item-top">
                        <span className="dash26-item-name static">
                          {t("dash.orderNr", { n: "#" + o.id })}
                        </span>
                        <span className={"dash26-status " + (done ? "s-completed" : "s-pending")}>
                          {done ? t("dash.done") : t("dash.delivered")}
                        </span>
                      </div>
                      <div className="dash26-item-meta">
                        <span>
                          <Icon name="calendar" /> {fmtDate(o.dateISO)}
                        </span>
                        <span>
                          <Icon name="bag" />{" "}
                          {count === 1 ? t("dash.item1") : t("dash.items", { n: count })}
                        </span>
                      </div>
                      <p className="dash26-item-note">{names}</p>
                    </div>
                    <div className="dash26-item-side">
                      <b>{fmt(o.total)}</b>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <Empty
              icon="bag"
              title={t("dash.noOrderH")}
              text={t("dash.noOrderP")}
              button={t("dash.noOrderBtn")}
              onClick={() => navigate({ to: "/shop" })}
            />
          ))}

        {active === "requests" && session?.backend && (myProviders.baker || myProviders.deco) && <ProviderInbox />}
        {active === "requests" &&
          (sweetReqCount ? (
            <MyRequests />
          ) : (
            <Empty
              icon="gift"
              title={C.noReqH}
              text={C.noReqP}
              button={C.noReqBtn}
              onClick={() => navigate({ to: "/torten" })}
            />
          ))}

        {active === "favorites" &&
          (favArtists.length ? (
            <div className="act-grid dash26-favs reveal-stagger">
              {favArtists.map((a) => (
                <ArtistCard a={a} key={a.id} />
              ))}
            </div>
          ) : (
            <Empty
              icon="heart"
              title={t("dash.noFavH")}
              text={t("dash.noFavP")}
              button={t("dash.noFavBtn")}
              onClick={() => navigate({ to: "/" })}
            />
          ))}

        {active === "payments" && myProfile && (
          <PayoutPanel artistId={myProfile.id} />
        )}

        {active === "payments" && !myProfile && (
          <>
            <div className="dash26-panel">
              <div className="dash26-panel-head">
                <h3>{t("dash.transactions")}</h3>
                <button className="dash26-mini outline" onClick={() => toast(t("toast.invoice"))}>
                  <Icon name="clipboard" /> {t("dash.invoice")}
                </button>
              </div>
              {payRows.length ? (
                <div className="dash26-table-wrap">
                  <table className="dash26-table">
                    <thead>
                      <tr>
                        <th>{t("tbl.date")}</th>
                        <th>{t("tbl.item")}</th>
                        <th className="num">{t("tbl.amount")}</th>
                        <th>{t("tbl.status")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payRows.map((r, k) => (
                        <tr key={k}>
                          <td className="muted">{fmtDate(r.date)}</td>
                          <td className="strong">{r.label}</td>
                          <td className="num strong">{fmt(r.amount)}</td>
                          <td>
                            <span
                              className={"dash26-status " + (r.paid ? "s-completed" : "s-pending")}
                            >
                              {r.paid ? t("tbl.paid") : t("tbl.open")}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="dash26-none">{t("dash.noBookP")}</p>
              )}
            </div>
            {payouts.length > 0 && (
              <div className="dash26-panel">
                <div className="dash26-panel-head">
                  <h3>{t("dash.payouts")}</h3>
                </div>
                <div className="dash26-table-wrap">
                  <table className="dash26-table">
                    <thead>
                      <tr>
                        <th>{t("tbl.date")}</th>
                        <th>{t("tbl.item")}</th>
                        <th className="num">{t("tbl.amount")}</th>
                        <th>{t("tbl.status")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payouts.map((p) => (
                        <tr key={p.id}>
                          <td className="muted">{fmtDate(p.dateISO)}</td>
                          <td className="strong">{p.artistName}</td>
                          <td className="num strong">{fmt(p.net)}</td>
                          <td>
                            <span className="dash26-status s-pending">{t("tbl.open")}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {active === "incoming" && myProfile && (
          <IncomingBookings artistId={myProfile.id} onEditProfile={() => setSection("edit")} />
        )}

        {active === "edit" && myProfile && <ProfileEditor artist={myProfile} key={myProfile.id} />}

        {active === "calendar" && myProfile && (
          <div className="dash26-panel dash26-cal">
            <Calendar providerId={myProfile.id} owner {...cal} />
          </div>
        )}

        {active === "packages" &&
          myProfile &&
          !(((myProfile as any).packages || []) as any[]).length && (
            <Empty
              icon="gift"
              title={C.noPkgH}
              text={C.noPkgP}
              button={C.view}
              onClick={() =>
                navigate({ to: "/kuenstler/$id", params: { id: String(myProfile.id) } })
              }
            />
          )}

        {active === "packages" && myProfile && (
          <div className="dash26-pkgs">
            {(((myProfile as any).packages || []) as any[]).map((p) => (
              <div className={"dash26-pkg" + (p.popular ? " popular" : "")} key={p.id}>
                {p.popular && <span className="dash26-pkg-tag">★ {t("pkg.popular")}</span>}
                <span className="dash26-stat-ic violet">
                  <Icon name={p.icon || "gift"} />
                </span>
                <h3>{L(p.name)}</h3>
                <span className="dash26-pkg-dur">{L(p.dur || "")}</span>
                <div className="dash26-pkg-price">
                  {fmt(p.price)} <small>{t("pkg.fixed")}</small>
                </div>
                <ul>
                  {L(p.inc || []).map((x: string) => (
                    <li key={x}>
                      <Icon name="check" /> {x}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {active === "myprofile" && myProfile && (
          <div className="dash26-panel dash26-me">
            <div className="dash26-me-img" style={bgOf(myProfile)}>
              <Face a={myProfile} />
            </div>
            <div className="dash26-me-body">
              <span className="dash26-role">
                <CatIcon id={myProfile.cat} /> {catLabel(myProfile.cat)}
              </span>
              <h3>{L(myProfile.name)}</h3>
              <p className="dash26-item-meta">
                <span>
                  <Icon name="pin" /> {L(myProfile.loc)}
                </span>
                {realName(myProfile) && (
                  <span>
                    <Icon name="user" /> {t("fig.behind")}: {realName(myProfile)}
                  </span>
                )}
              </p>
              {figuresOf(myProfile).length > 0 && (
                <div className="dash26-chips">
                  {figuresOf(myProfile).map((v) => (
                    <span className="dash26-chip" key={v}>
                      <Icon name="mask" /> {figName(myProfile.cat, v, lang)}
                    </span>
                  ))}
                </div>
              )}
              <div className="dash26-me-btns">
                <button
                  className="home-btn primary"
                  onClick={() =>
                    navigate({ to: "/kuenstler/$id", params: { id: String(myProfile.id) } })
                  }
                >
                  {t("own.manage")}
                </button>
              </div>
            </div>
          </div>
        )}

        {active === "profile" && (
          <div className="join26">
            <div className="register-form join26-form dash26-form">
              <div className="form-grid">
                <div className="input-group">
                  <label htmlFor="pf-first">{t("reg.first")}</label>
                  <input id="pf-first" type="text" defaultValue={name.split(" ")[0]} />
                </div>
                <div className="input-group">
                  <label htmlFor="pf-last">{t("reg.last")}</label>
                  <input
                    id="pf-last"
                    type="text"
                    defaultValue={name.split(" ").slice(1).join(" ")}
                  />
                </div>
              </div>
              <div className="input-group">
                <label htmlFor="pf-mail">{t("reg.email")}</label>
                <input id="pf-mail" type="email" defaultValue={mail} />
              </div>
              <div className="form-grid">
                <div className="input-group">
                  <label htmlFor="pf-phone">{t("profile.phone")}</label>
                  <input id="pf-phone" type="tel" defaultValue="+49 151 23456789" />
                </div>
                <div className="input-group">
                  <label htmlFor="pf-loc">{t("reg.loc")}</label>
                  <input id="pf-loc" type="text" defaultValue="München, Bayern" />
                </div>
              </div>
              <div className="input-group">
                <label htmlFor="pf-lang">{t("profile.lang")}</label>
                <select
                  id="pf-lang"
                  value={lang}
                  onChange={(e) => setLang(e.target.value as "de" | "en" | "es")}
                >
                  <option value="de">Deutsch</option>
                  <option value="en">English</option>
                  <option value="es">Español</option>
                </select>
              </div>
              <button
                className="home-btn primary wide"
                onClick={() => toast(t("toast.profileSaved"))}
              >
                {t("profile.save")}
              </button>
            </div>
            <BlockedList />
            <DeleteAccount />
          </div>
        )}
      </main>
      <Footer />
      {chatFor !== null &&
        (() => {
          const cb = bookings.find((x) => x.id === chatFor);
          const ca = cb ? ARTISTS.find((x) => x.id === cb.artistId) : undefined;
          return (
            <Chat
              bookingId={chatFor}
              as="customer"
              heading={`${ca ? String(L(ca.name)) : ""}${cb ? " · " + fmtDate(cb.dateISO) : ""}`}
              onClose={() => setChatFor(null)}
            />
          );
        })()}
    </div>
  );
}
