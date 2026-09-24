import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getPending, type Pending } from "@/showly/pending";
import { StripeCheckout } from "@/components/showly/StripeCheckout";
import { isPaymentConfigured } from "@/lib/stripe";
import { clearPending } from "@/showly/pending";
import { PaymentTestModeBanner } from "@/components/showly/PaymentTestModeBanner";
import { useShowly } from "@/showly/store";
import { CartCheckout } from "@/components/showly/CartCheckout";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Sichere Zahlung – Showly" },
      {
        name: "description",
        content:
          "Bezahle deine Showly-Buchung sicher per Kreditkarte, PayPal oder Banküberweisung.",
      },
      { property: "og:title", content: "Sichere Zahlung – Showly" },
      {
        property: "og:description",
        content: "Buchung sicher bezahlen: Kreditkarte, PayPal oder Banküberweisung.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CheckoutRoute,
});

const COPY = {
  de: {
    title: "Sichere Zahlung",
    emptyH: "Keine Zahlung offen",
    emptyP: "Bitte wähle zuerst eine Buchung oder lege Artikel in den Warenkorb.",
    home: "Zur Startseite",
    offH: "Online-Zahlung noch nicht freigeschaltet",
    offP:
      "Für diesen Auftritt ist der Zahlungsanbieter noch nicht verbunden. Du kannst den Termin trotzdem verbindlich reservieren. Der Künstler bestätigt die Anfrage, die Zahlung folgt danach.",
    offBooking: "Termin verbindlich reservieren",
    offOrder: "Bestellung verbindlich aufgeben",
    offBlocked:
      "Der Werbeplatz lässt sich erst buchen, wenn die Online-Zahlung eingerichtet ist.",
    offDone: "Reservierung gespeichert. Du findest sie unter Meine Buchungen.",
    offDash: "Zu meinen Buchungen",
    offNote: "Es wird jetzt nichts abgebucht.",
  },
  en: {
    title: "Secure payment",
    emptyH: "Nothing to pay",
    emptyP: "Pick a booking first or add items to your cart.",
    home: "Back to home",
    offH: "Online payment is not switched on yet",
    offP:
      "The payment provider is not connected for this build. You can still reserve the date. The artist confirms the request and payment follows afterwards.",
    offBooking: "Reserve this date",
    offOrder: "Place this order",
    offBlocked: "The promoted slot can only be booked once online payment is set up.",
    offDone: "Reservation saved. You will find it under My bookings.",
    offDash: "Go to my bookings",
    offNote: "Nothing is charged now.",
  },
  es: {
    title: "Pago seguro",
    emptyH: "No hay ningún pago pendiente",
    emptyP: "Elige primero una reserva o añade artículos al carrito.",
    home: "Ir al inicio",
    offH: "El pago en línea todavía no está activado",
    offP:
      "El proveedor de pago no está conectado en esta versión. Aun así puedes reservar la fecha en firme. El artista confirma la solicitud y el pago llega después.",
    offBooking: "Reservar la fecha",
    offOrder: "Enviar el pedido",
    offBlocked: "El espacio destacado solo se puede reservar con el pago en línea activo.",
    offDone: "Reserva guardada. La verás en Mis reservas.",
    offDash: "Ir a mis reservas",
    offNote: "Ahora no se cobra nada.",
  },
} as const;

/* Gemeinsamer Typ ueber alle Sprachen, siehe Kommentar im Event-Blog. */
type Copy = (typeof COPY)[keyof typeof COPY];

/* Werbeplatz „Top Act“ läuft weiter über die Einzelzahlung, alles andere
   über den gemeinsamen Warenkorb. */
function CheckoutRoute() {
  const [legacy, setLegacy] = useState<boolean | null>(null);
  useEffect(() => {
    const p = getPending();
    setLegacy(!!p && p.kind !== "cart");
  }, []);
  if (legacy === null) return <div className="page active" />;
  return legacy ? <CheckoutPage /> : <CartCheckout />;
}

function CheckoutPage() {
  const { fmt, session, lang } = useShowly() as any;
  const T = COPY[(lang as "de" | "en" | "es") ?? "de"] ?? COPY.de;
  const navigate = useNavigate();
  const [pending, setPendingState] = useState<Pending | null>(null);
  const [ready, setReady] = useState(false);
  /* Ohne hinterlegten Zahlungsanbieter wird die Zahlungsmaske gar nicht erst
     eingebunden. Sonst reisst sie beim Laden die ganze Seite in die
     Fehleranzeige. */
  const paymentReady = isPaymentConfigured();

  useEffect(() => {
    setPendingState(getPending());
    setReady(true);
  }, []);

  const amount = pending ? (pending.kind === "booking" ? pending.amount : pending.total) : 0;

  return (
    <div className="page active">
      <div className="checkout-page">
        <PaymentTestModeBanner />
        <h1 className="checkout-title">{T.title}</h1>
        {ready && !pending && (
          <div className="empty-state">
            <h3>{T.emptyH}</h3>
            <p>{T.emptyP}</p>
            <button className="btn-primary" onClick={() => navigate({ to: "/" })}>
              {T.home}
            </button>
          </div>
        )}
        {pending && (
          <>
            <div className="checkout-summary">
              <span>{pending.title}</span>
              <strong>{fmt(amount)}</strong>
            </div>
            {paymentReady ? (
              <StripeCheckout
                lines={
                  pending.lines?.length
                    ? pending.lines
                    : [
                        {
                          name: pending.title,
                          amountInCents: Math.round(amount * 100),
                          quantity: 1,
                        },
                      ]
                }
                description={pending.title}
                locale={(lang as "de" | "en" | "es") ?? "de"}
                {...(session?.email ? { customerEmail: session.email } : {})}
              />
            ) : (
              <ReserveWithoutPayment pending={pending} T={T} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* Reservierung ohne Online-Zahlung.
 *
 * Solange kein Zahlungsanbieter verbunden ist, endet die Buchung sonst in einer
 * Fehlerseite. Hier wird die Buchung stattdessen als offene Reservierung
 * gespeichert: Der Termin ist im Kalender des Künstlers belegt, im Dashboard
 * steht sie als offen, und es wird nichts abgebucht. */
function ReserveWithoutPayment({
  pending,
  T,
}: {
  pending: Pending;
  T: Copy;
}) {
  const { addBooking, checkout, toast } = useShowly() as any;
  const navigate = useNavigate();
  const [saved, setSaved] = useState(false);

  if (pending.kind === "spotlight") {
    return (
      <div className="pay-off">
        <h2 className="pay-off-h">{T.offH}</h2>
        <p className="pay-off-p">{T.offBlocked}</p>
      </div>
    );
  }

  function reserve() {
    if (pending.kind === "booking") {
      addBooking({
        artistId: pending.artistId,
        dateISO: pending.dateISO,
        slot: pending.slot,
        amount: pending.amount,
        status: "pending",
        ...(pending.figure ? { figure: pending.figure } : {}),
        ...(pending.pkg ? { pkg: pending.pkg } : {}),
      });
    } else {
      checkout();
    }
    clearPending();
    setSaved(true);
    toast(T.offDone);
  }

  if (saved) {
    return (
      <div className="pay-off">
        <h2 className="pay-off-h">{T.offDone}</h2>
        <button className="btn-primary" onClick={() => navigate({ to: "/dashboard" })}>
          {T.offDash}
        </button>
      </div>
    );
  }

  return (
    <div className="pay-off">
      <h2 className="pay-off-h">{T.offH}</h2>
      <p className="pay-off-p">{T.offP}</p>
      <button className="btn-primary" onClick={reserve}>
        {pending.kind === "booking" ? T.offBooking : T.offOrder}
      </button>
      <p className="pay-off-note">{T.offNote}</p>
    </div>
  );
}
