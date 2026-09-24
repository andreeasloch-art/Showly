/* Kasse für den ganzen Warenkorb.
 *
 * Drei Schritte: Übersicht, Kontaktdaten, Bezahlen. Rechts steht immer die
 * Summe. Künstler und Artikel werden zusammen bezahlt, Torten-Anfragen gehen
 * beim Abschluss an die Anbieter und kosten jetzt nichts.
 *
 * Ist ein Zahlungsanbieter hinterlegt, rechnet der Server die Beträge selbst
 * nach (siehe createCartCheckout). Ohne Zahlungsanbieter wird verbindlich
 * reserviert und die Zahlung folgt nach Bestätigung. */
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useShowly, type CartSnapshot } from "@/showly/store";
import { SHOP_ITEMS } from "@/showly/data";
import { Icon, bgOf, shopBg } from "@/showly/ui";
import { isPaymentConfigured } from "@/lib/stripe";
import { setPending } from "@/showly/pending";
import { MAX_HOURS, bookingPrice, cartTotals, findArtist, minHoursOf, shopUnit } from "@/showly/pricing";
import { SWEETS, bakerOf, sweetBg } from "@/showly/sweets";
import { StripeCartCheckout } from "@/components/showly/StripeCheckout";
import { isInstant } from "@/showly/booking";
import { PaymentTestModeBanner } from "@/components/showly/PaymentTestModeBanner";
import { Footer } from "@/components/showly/Footer";

const TEXT = {
  de: {
    title: "Kasse",
    steps: ["Übersicht", "Deine Daten", "Bezahlen"],
    emptyH: "Dein Warenkorb ist leer",
    emptyP: "Leg einen Künstler, Deko oder eine Torte hinein und komm dann hierher zurück.",
    toActs: "Künstler finden",
    toShop: "Zum Shop",
    toSweets: "Torten & Süßes",
    acts: "Künstler",
    items: "Artikel",
    requests: "Torten-Anfragen",
    requestsP: "Der Anbieter bestätigt Termin und Preis. Bezahlt wird erst danach.",
    hours: "Dauer",
    hoursVal: (n: number) => `${n} Std.`,
    remove: "Entfernen",
    rent: "Miete",
    buy: "Kauf",
    approx: "ca.",
    next: "Weiter",
    back: "Zurück",
    toPay: "Weiter zur Zahlung",
    contactH: "Kontaktdaten",
    name: "Vor- und Nachname",
    email: "E-Mail",
    phone: "Telefon (für Rückfragen am Veranstaltungstag)",
    eventH: "Veranstaltungsort",
    eventP: "Hierhin kommen Künstler und Lieferungen.",
    street: "Straße und Hausnummer",
    zip: "PLZ",
    city: "Ort",
    terms: "Ich akzeptiere die",
    termsLink: "AGB",
    and: "und habe die",
    privacyLink: "Datenschutzerklärung",
    read: "gelesen.",
    need: "Bitte Name, gültige E-Mail und die Adresse ausfüllen.",
    needTerms: "Bitte die AGB bestätigen.",
    sumH: "Deine Bestellung",
    sumActs: "Künstler",
    sumItems: "Artikel",
    sumFee: "Servicegebühr",
    sumTotal: "Jetzt zu zahlen",
    sumLater: "Torten-Anfragen (Preis folgt)",
    secure: "Sichere Zahlung über Stripe. Showly sieht keine Kartendaten.",
    cancel: "Buchungen sind bis 24 Stunden vorher kostenlos stornierbar.",
    reqNote: "Einige Künstler bestätigen erst innerhalb von 48 Stunden. Für diese Buchungen wird erst bei Zusage abgebucht.",
    offH: "Online-Zahlung noch nicht freigeschaltet",
    offP: "Du kannst trotzdem verbindlich reservieren. Künstler und Anbieter bestätigen, bezahlt wird danach. Jetzt wird nichts abgebucht.",
    offBtn: "Zahlungspflichtig reservieren",
    onlyReq: "Anfragen abschicken",
    onlyReqP: "Die Anbieter melden sich mit Termin und Endpreis bei dir.",
    doneH: "Geschafft, danke!",
    donePaid: "Deine Bestellung ist bestätigt.",
    doneReserved: "Deine Reservierung ist eingegangen. Du findest sie in deinem Konto unter Buchungen und Bestellungen.",
    doneReq: "Deine Torten-Anfragen sind unterwegs.",
    toDash: "Zu meinen Buchungen",
    more: "Weiter stöbern",
    unknown: "Einige Posten wurden in diesem Browser angelegt und können erst mit angeschlossener Datenbank online bezahlt werden.",
  },
  en: {
    title: "Checkout",
    steps: ["Overview", "Your details", "Payment"],
    emptyH: "Your cart is empty",
    emptyP: "Add an artist, decor or a cake and come back here.",
    toActs: "Find artists",
    toShop: "Go to shop",
    toSweets: "Cakes & sweets",
    acts: "Artists",
    items: "Items",
    requests: "Cake requests",
    requestsP: "The baker confirms date and price. You pay only after that.",
    hours: "Duration",
    hoursVal: (n: number) => `${n} hrs`,
    remove: "Remove",
    rent: "Rent",
    buy: "Buy",
    approx: "approx.",
    next: "Continue",
    back: "Back",
    toPay: "Continue to payment",
    contactH: "Contact details",
    name: "Full name",
    email: "Email",
    phone: "Phone (for questions on the day)",
    eventH: "Event location",
    eventP: "Artists and deliveries come here.",
    street: "Street and number",
    zip: "Postcode",
    city: "City",
    terms: "I accept the",
    termsLink: "terms",
    and: "and have read the",
    privacyLink: "privacy policy",
    read: ".",
    need: "Please fill in your name, a valid email and the address.",
    needTerms: "Please accept the terms.",
    sumH: "Your order",
    sumActs: "Artists",
    sumItems: "Items",
    sumFee: "Service fee",
    sumTotal: "To pay now",
    sumLater: "Cake requests (price follows)",
    secure: "Secure payment via Stripe. Showly never sees card details.",
    cancel: "Bookings can be cancelled free of charge up to 24 hours before.",
    reqNote: "Some artists confirm within 48 hours. For those bookings, payment is only taken once they accept.",
    offH: "Online payment is not switched on yet",
    offP: "You can still reserve. Artists and providers confirm, payment follows afterwards. Nothing is charged now.",
    offBtn: "Reserve with obligation to pay",
    onlyReq: "Send requests",
    onlyReqP: "The bakers will get back to you with date and final price.",
    doneH: "Done, thank you!",
    donePaid: "Your order is confirmed.",
    doneReserved: "Your reservation has been received. You'll find it in your account under bookings and orders.",
    doneReq: "Your cake requests are on their way.",
    toDash: "My bookings",
    more: "Keep browsing",
    unknown: "Some items were created in this browser and can only be paid online once the database is connected.",
  },
  es: {
    title: "Caja",
    steps: ["Resumen", "Tus datos", "Pago"],
    emptyH: "Tu carrito está vacío",
    emptyP: "Añade un artista, decoración o una tarta y vuelve aquí.",
    toActs: "Buscar artistas",
    toShop: "Ir a la tienda",
    toSweets: "Tartas y dulces",
    acts: "Artistas",
    items: "Artículos",
    requests: "Solicitudes de tartas",
    requestsP: "El repostero confirma fecha y precio. Pagas después.",
    hours: "Duración",
    hoursVal: (n: number) => `${n} h`,
    remove: "Quitar",
    rent: "Alquiler",
    buy: "Compra",
    approx: "aprox.",
    next: "Continuar",
    back: "Atrás",
    toPay: "Continuar al pago",
    contactH: "Datos de contacto",
    name: "Nombre y apellidos",
    email: "Correo",
    phone: "Teléfono (para dudas el día del evento)",
    eventH: "Lugar del evento",
    eventP: "Aquí llegan artistas y entregas.",
    street: "Calle y número",
    zip: "C. P.",
    city: "Ciudad",
    terms: "Acepto las",
    termsLink: "condiciones",
    and: "y he leído la",
    privacyLink: "política de privacidad",
    read: ".",
    need: "Rellena nombre, un correo válido y la dirección.",
    needTerms: "Acepta las condiciones.",
    sumH: "Tu pedido",
    sumActs: "Artistas",
    sumItems: "Artículos",
    sumFee: "Tarifa de servicio",
    sumTotal: "A pagar ahora",
    sumLater: "Solicitudes de tartas (precio a confirmar)",
    secure: "Pago seguro con Stripe. Showly no ve los datos de la tarjeta.",
    cancel: "Las reservas se pueden cancelar gratis hasta 24 horas antes.",
    reqNote: "Algunos artistas confirman en 48 horas. En esas reservas solo se cobra cuando aceptan.",
    offH: "El pago en línea todavía no está activado",
    offP: "Aun así puedes reservar. Artistas y proveedores confirman y el pago llega después. Ahora no se cobra nada.",
    offBtn: "Reservar con obligación de pago",
    onlyReq: "Enviar solicitudes",
    onlyReqP: "Los reposteros te contestarán con fecha y precio final.",
    doneH: "¡Listo, gracias!",
    donePaid: "Tu pedido está confirmado.",
    doneReserved: "Hemos recibido tu reserva. La encontrarás en tu cuenta, en reservas y pedidos.",
    doneReq: "Tus solicitudes de tartas están en camino.",
    toDash: "Mis reservas",
    more: "Seguir explorando",
    unknown: "Algunos artículos se crearon en este navegador y solo se pueden pagar en línea con la base de datos conectada.",
  },
};
type T = (typeof TEXT)["de"];

interface Contact {
  name: string;
  email: string;
  phone: string;
  street: string;
  zip: string;
  city: string;
}
const CONTACT_KEY = "showly.contact";

export function CartCheckout() {
  const {
    lang,
    L,
    fmt,
    fmtDate,
    hydrated,
    session,
    toast,
    cart,
    cartBookings,
    cartRequests,
    updateCartBooking,
    removeCartBooking,
    removeFromCart,
    removeCartRequest,
    completeCart,
  } = useShowly();
  const X = (TEXT[(lang as "de" | "en" | "es") ?? "de"] ?? TEXT.de) as T;
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [done, setDone] = useState<null | { paid: boolean; req: boolean; reserved: boolean }>(null);
  const [terms, setTerms] = useState(false);
  const [paying, setPaying] = useState(false);
  const [contact, setContact] = useState<Contact>({ name: "", email: "", phone: "", street: "", zip: "", city: "" });
  const paymentReady = isPaymentConfigured();

  /* Kontaktdaten vom letzten Mal oder aus dem Konto vorbelegen */
  useEffect(() => {
    let saved: Partial<Contact> = {};
    try {
      saved = JSON.parse(localStorage.getItem(CONTACT_KEY) || "{}");
    } catch {
      saved = {};
    }
    setContact((c) => ({
      ...c,
      ...saved,
      name: saved.name || session?.name || "",
      email: saved.email || session?.email || "",
      street: saved.street || cartBookings[0]?.address || "",
    }));
    // nur beim ersten Laden
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  const totals = cartTotals(cart, cartBookings);
  const reqSum = cartRequests.reduce((s, r) => s + r.estimate, 0);
  const empty = !cart.length && !cartBookings.length && !cartRequests.length;
  const hasOwnItems = cart.some((c) => SHOP_ITEMS.find((i) => i.id === c.shopId)?.own);

  if (!hydrated) return <div className="page active ui26 co-page" />;

  function snapshot(): CartSnapshot {
    const address = [contact.street, [contact.zip, contact.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    return {
      shop: cart,
      bookings: cartBookings.map((b) => ({ ...b, address: address || b.address })),
      requests: cartRequests.map((r) => ({ ...r, city: r.city || contact.city })),
      contact: {
        name: contact.name.trim(),
        email: contact.email.trim(),
        ...(contact.phone.trim() ? { phone: contact.phone.trim() } : {}),
        ...(address ? { address } : {}),
      },
    };
  }

  function validContact() {
    const okMail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim());
    const needsAddress = cartBookings.length > 0 || cart.length > 0;
    if (!contact.name.trim() || !okMail || (needsAddress && (!contact.street.trim() || !contact.city.trim()))) {
      toast(X.need);
      return false;
    }
    if (!terms) {
      toast(X.needTerms);
      return false;
    }
    try {
      localStorage.setItem(CONTACT_KEY, JSON.stringify(contact));
    } catch {
      /* Speicher nicht verfügbar */
    }
    return true;
  }

  function finishWithoutPayment() {
    const snap = snapshot();
    const req = snap.requests.length > 0;
    const reserved = snap.bookings.length + snap.shop.length > 0;
    completeCart(snap, false);
    setDone({ paid: false, req, reserved });
  }

  function startPayment() {
    const snap = snapshot();
    setPending({
      kind: "cart",
      total: totals.total,
      title: X.sumH,
      lines: [],
      email: snap.contact.email,
      snapshot: snap,
    });
    setPaying(true);
  }

  if (done) {
    return (
      <div className="page active ui26 co-page">
        <div className="co-wrap">
          <div className="co-done">
            <span className="co-done-ic">
              <Icon name="check" />
            </span>
            <h1>{X.doneH}</h1>
            <p>{done.paid ? X.donePaid : done.reserved ? X.doneReserved : ""}</p>
            {done.req && <p>{X.doneReq}</p>}
            <div className="co-done-btns">
              <button className="home-btn primary" onClick={() => navigate({ to: "/dashboard" })}>
                {X.toDash}
              </button>
              <button className="home-btn soft" onClick={() => navigate({ to: "/" })}>
                {X.more}
              </button>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (empty) {
    return (
      <div className="page active ui26 co-page">
        <div className="co-wrap">
          <div className="empty-state">
            <div className="ic">
              <Icon name="cart" />
            </div>
            <h3>{X.emptyH}</h3>
            <p>{X.emptyP}</p>
            <div className="co-done-btns">
              <Link className="home-btn primary" to="/">
                {X.toActs}
              </Link>
              <Link className="home-btn soft" to="/shop">
                {X.toShop}
              </Link>
              <Link className="home-btn soft" to="/torten">
                {X.toSweets}
              </Link>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const set = (k: keyof Contact) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setContact((c) => ({ ...c, [k]: e.target.value.slice(0, 120) }));

  return (
    <div className="page active ui26 co-page">
      <div className="co-wrap">
        <PaymentTestModeBanner />
        <h1 className="co-title">{X.title}</h1>
        <ol className="co-steps">
          {X.steps.map((label, i) => (
            <li key={label} className={i === step ? "on" : i < step ? "done" : ""}>
              <button onClick={() => i < step && !paying && setStep(i)} disabled={i >= step || paying}>
                <span>{i < step ? <Icon name="check" /> : i + 1}</span>
                {label}
              </button>
            </li>
          ))}
        </ol>

        <div className="co-layout">
          <div className="co-main">
            {step === 0 && (
              <>
                {cartBookings.length > 0 && (
                  <section className="pe-card">
                    <h3 className="co-h">{X.acts}</h3>
                    {cartBookings.map((b) => {
                      const a = findArtist(b.artistId);
                      if (!a) return null;
                      const p = bookingPrice(a, b.hours, b.pkg);
                      const min = minHoursOf(a);
                      return (
                        <div className="co-line" key={b.key}>
                          <span className="co-img" style={bgOf(a)} />
                          <div className="co-line-text">
                            <b>{L(a.name)}</b>
                            <small>
                              {fmtDate(b.dateISO)} · {b.slot}
                              {b.figure ? ` · ${b.figure}` : ""}
                            </small>
                            {p.pkg ? (
                              <small>{String(L(p.pkg.name))}</small>
                            ) : (
                              <span className="co-hours">
                                {X.hours}
                                <button onClick={() => updateCartBooking(b.key, { hours: p.hours - 1 })} disabled={p.hours <= min} aria-label="−">
                                  −
                                </button>
                                <output>{X.hoursVal(p.hours)}</output>
                                <button onClick={() => updateCartBooking(b.key, { hours: p.hours + 1 })} disabled={p.hours >= MAX_HOURS} aria-label="+">
                                  +
                                </button>
                              </span>
                            )}
                          </div>
                          <div className="co-line-end">
                            <b>{fmt(p.total)}</b>
                            <button className="co-rm" onClick={() => removeCartBooking(b.key)}>
                              {X.remove}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </section>
                )}

                {cart.length > 0 && (
                  <section className="pe-card">
                    <h3 className="co-h">{X.items}</h3>
                    {cart.map((c, idx) => {
                      const i = SHOP_ITEMS.find((x) => x.id === c.shopId);
                      if (!i) return null;
                      return (
                        <div className="co-line" key={c.shopId + c.mode}>
                          <span className="co-img" style={shopBg(i)} />
                          <div className="co-line-text">
                            <b>{L(i.name)}</b>
                            <small>
                              {c.mode === "rent" ? X.rent : X.buy} · {c.qty} × {fmt(shopUnit(i, c.mode))}
                            </small>
                          </div>
                          <div className="co-line-end">
                            <b>{fmt(shopUnit(i, c.mode) * c.qty)}</b>
                            <button className="co-rm" onClick={() => removeFromCart(idx)}>
                              {X.remove}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </section>
                )}

                {cartRequests.length > 0 && (
                  <section className="pe-card">
                    <h3 className="co-h">{X.requests}</h3>
                    <p className="pe-hint">{X.requestsP}</p>
                    {cartRequests.map((r) => {
                      const sw = SWEETS.find((x) => x.id === r.sweetId);
                      const b = bakerOf(r.bakerId);
                      return (
                        <div className="co-line" key={r.key}>
                          <span className="co-img" style={sw ? sweetBg(sw) : undefined} />
                          <div className="co-line-text">
                            <b>{sw ? L(sw.name) : "—"}</b>
                            <small>
                              {b ? String(L(b.name)) : ""} · {fmtDate(r.dateISO)} · {r.qty}×
                            </small>
                            {r.wishes && <small className="co-wish">„{r.wishes}“</small>}
                          </div>
                          <div className="co-line-end">
                            <b>
                              <small>{X.approx}</small> {fmt(r.estimate)}
                            </b>
                            <button className="co-rm" onClick={() => removeCartRequest(r.key)}>
                              {X.remove}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </section>
                )}

                <div className="co-nav">
                  <span />
                  <button className="home-btn primary" onClick={() => setStep(1)}>
                    {X.next}
                    <Icon name="arrow" />
                  </button>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <section className="pe-card">
                  <h3 className="co-h">{X.contactH}</h3>
                  <label className="pe-field">
                    <span className="pe-label">{X.name}</span>
                    <input value={contact.name} onChange={set("name")} autoComplete="name" />
                  </label>
                  <div className="pe-grid2">
                    <label className="pe-field">
                      <span className="pe-label">{X.email}</span>
                      <input type="email" value={contact.email} onChange={set("email")} autoComplete="email" />
                    </label>
                    <label className="pe-field">
                      <span className="pe-label">{X.phone}</span>
                      <input type="tel" value={contact.phone} onChange={set("phone")} autoComplete="tel" />
                    </label>
                  </div>
                </section>
                {(cartBookings.length > 0 || cart.length > 0) && (
                  <section className="pe-card">
                    <h3 className="co-h">{X.eventH}</h3>
                    <p className="pe-hint">{X.eventP}</p>
                    <label className="pe-field">
                      <span className="pe-label">{X.street}</span>
                      <input value={contact.street} onChange={set("street")} autoComplete="street-address" />
                    </label>
                    <div className="co-zip">
                      <label className="pe-field">
                        <span className="pe-label">{X.zip}</span>
                        <input value={contact.zip} onChange={set("zip")} autoComplete="postal-code" inputMode="numeric" />
                      </label>
                      <label className="pe-field">
                        <span className="pe-label">{X.city}</span>
                        <input value={contact.city} onChange={set("city")} autoComplete="address-level2" />
                      </label>
                    </div>
                  </section>
                )}
                <label className="ob-check co-terms">
                  <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
                  <span>
                    {X.terms}{" "}
                    <Link to="/rechtliches/$doc" params={{ doc: "terms" }} target="_blank">
                      {X.termsLink}
                    </Link>{" "}
                    {X.and}{" "}
                    <Link to="/rechtliches/$doc" params={{ doc: "privacy" }} target="_blank">
                      {X.privacyLink}
                    </Link>{" "}
                    {X.read}
                  </span>
                </label>
                <div className="co-nav">
                  <button className="home-btn soft" onClick={() => setStep(0)}>
                    {X.back}
                  </button>
                  <button className="home-btn primary" onClick={() => validContact() && setStep(2)}>
                    {totals.total > 0 ? X.toPay : X.next}
                    <Icon name="arrow" />
                  </button>
                </div>
              </>
            )}

            {step === 2 && (
              <section className="pe-card co-pay">
                {totals.total <= 0 ? (
                  <>
                    <h3 className="co-h">{X.onlyReq}</h3>
                    <p className="pe-hint">{X.onlyReqP}</p>
                    <button className="home-btn primary" onClick={finishWithoutPayment}>
                      <Icon name="send" /> {X.onlyReq}
                    </button>
                  </>
                ) : paymentReady && !hasOwnItems ? (
                  paying ? (
                    <StripeCartCheckout
                      shop={cart}
                      bookings={cartBookings.map((b) => ({
                        artistId: b.artistId,
                        hours: b.hours,
                        dateISO: b.dateISO,
                        slot: b.slot,
                        ...(b.pkg ? { pkg: b.pkg } : {}),
                      }))}
                      customerEmail={contact.email.trim()}
                      locale={(lang as "de" | "en" | "es") ?? "de"}
                    />
                  ) : (
                    <>
                      <p className="pe-note">
                        <Icon name="lock" /> {X.secure}
                      </p>
                      <button className="home-btn primary" onClick={startPayment}>
                        <Icon name="lock" /> {X.toPay} · {fmt(totals.total)}
                      </button>
                    </>
                  )
                ) : (
                  <>
                    <h3 className="co-h">{X.offH}</h3>
                    <p className="pe-hint">{hasOwnItems && paymentReady ? X.unknown : X.offP}</p>
                    <button className="home-btn primary" onClick={finishWithoutPayment}>
                      <Icon name="check" /> {X.offBtn}
                    </button>
                  </>
                )}
                {!paying && (
                  <div className="co-nav">
                    <button className="home-btn soft" onClick={() => setStep(1)}>
                      {X.back}
                    </button>
                    <span />
                  </div>
                )}
              </section>
            )}
          </div>

          <aside className="co-side">
            <div className="bk-side-card">
              <h3>{X.sumH}</h3>
              <ul className="co-sum">
                {totals.artists > 0 && (
                  <li>
                    <span>{X.sumActs}</span>
                    <span>{fmt(totals.artists)}</span>
                  </li>
                )}
                {totals.items > 0 && (
                  <li>
                    <span>{X.sumItems}</span>
                    <span>{fmt(totals.items)}</span>
                  </li>
                )}
                {totals.fees > 0 && (
                  <li>
                    <span>{X.sumFee}</span>
                    <span>{fmt(totals.fees)}</span>
                  </li>
                )}
                <li className="total">
                  <span>{X.sumTotal}</span>
                  <strong>{fmt(totals.total)}</strong>
                </li>
                {cartRequests.length > 0 && (
                  <li className="later">
                    <span>{X.sumLater}</span>
                    <span>
                      {X.approx} {fmt(reqSum)}
                    </span>
                  </li>
                )}
              </ul>
              <p className="co-side-note">
                <Icon name="shield" /> {X.secure}
              </p>
              {cartBookings.length > 0 && (
                <p className="co-side-note">
                  <Icon name="calendar" /> {X.cancel}
                </p>
              )}
              {cartBookings.some((b) => !isInstant(findArtist(b.artistId))) && (
                <p className="co-side-note">
                  <Icon name="clock" /> {X.reqNote}
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>
      <Footer />
    </div>
  );
}
