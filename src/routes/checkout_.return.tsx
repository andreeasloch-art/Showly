import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { clearPending, getPending } from "@/showly/pending";
import { activateSpotlight } from "@/showly/spotlight";
import { useShowly } from "@/showly/store";
import { ARTISTS } from "@/showly/data";
import { AddOnShelf, suggestForArtist } from "@/components/showly/AddOns";
import { sendPurchaseConfirmation } from "@/utils/email.functions";
import { verifyShowlySession } from "@/utils/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";

export const Route = createFileRoute("/checkout_/return")({
  head: () => ({
    meta: [
      { title: "Zahlung abgeschlossen – Showly" },
      {
        name: "description",
        content: "Deine Showly-Zahlung wurde verarbeitet – hier siehst du das Ergebnis.",
      },
      { property: "og:title", content: "Zahlung abgeschlossen – Showly" },
      { property: "og:description", content: "Ergebnis deiner Showly-Zahlung." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { session_id?: string | undefined } => ({
    session_id: typeof search["session_id"] === "string" ? search["session_id"] : undefined,
  }),

  component: CheckoutReturn,
});

const RCOPY = {
  de: {
    title: "Zahlung",
    checking: "Zahlung wird geprüft…",
    noInfo: "Keine Zahlungsinformationen gefunden.",
    booking: "Zahlung erfolgreich – deine Buchung ist bestätigt.",
    order: "Zahlung erfolgreich – deine Bestellung ist unterwegs.",
    spotlight: "Zahlung erfolgreich – dein Act ist jetzt Top Act der Woche.",
    done: "Zahlung abgeschlossen.",
    failed: "Zahlung nicht bestätigt. Es wurde nichts gebucht.",
    dash: "Zum Dashboard",
    more: "Weiter stöbern",
    addonsH: "Mach dein Event komplett",
    addonsP: "Passende Deko und Torte zu deiner Buchung",
  },
  en: {
    title: "Payment",
    checking: "Checking your payment…",
    noInfo: "No payment information found.",
    booking: "Payment successful – your booking is confirmed.",
    order: "Payment successful – your order is on its way.",
    spotlight: "Payment successful – your act is now top act of the week.",
    done: "Payment completed.",
    failed: "Payment not confirmed. Nothing was booked.",
    dash: "Go to dashboard",
    more: "Keep browsing",
    addonsH: "Complete your event",
    addonsP: "Decor and cake to match your booking",
  },
  es: {
    title: "Pago",
    checking: "Comprobando el pago…",
    noInfo: "No se encontró información del pago.",
    booking: "Pago correcto: tu reserva está confirmada.",
    order: "Pago correcto: tu pedido está en camino.",
    spotlight: "Pago correcto: tu act es el top act de la semana.",
    done: "Pago completado.",
    failed: "Pago no confirmado. No se ha reservado nada.",
    dash: "Ir al panel",
    more: "Seguir explorando",
    addonsH: "Completa tu evento",
    addonsP: "Decoración y tarta a juego con tu reserva",
  },
} as const;

function CheckoutReturn() {
  const { session_id: sessionId } = Route.useSearch();
  const { addBooking, checkout, addPayout, completeCart, fmt, lang, L } = useShowly() as any;
  const T = RCOPY[(lang as "de" | "en" | "es") ?? "de"] ?? RCOPY.de;
  const navigate = useNavigate();
  const done = useRef(false);
  const [msg, setMsg] = useState("");
  const [bookedId, setBookedArtist] = useState<number | null>(null);
  const booked = bookedId === null ? undefined : ARTISTS.find((a) => a.id === bookedId);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    if (!sessionId) {
      setMsg(T.noInfo);
      return;
    }
    void (async () => {
      let paid = false;
      try {
        const res = await verifyShowlySession({
          data: { sessionId, environment: getStripeEnvironment() },
        });
        paid = res.paid;
      } catch {
        paid = false;
      }
      if (!paid) {
        setMsg(T.failed);
        return;
      }
      const pending = getPending();

      function mail(subject: string, lines: string[], total: number) {
        if (!pending?.email) return;
        void sendPurchaseConfirmation({
          data: { to: pending.email, subject, lines, total: fmt(total) },
        }).catch(() => undefined);
      }

      if (pending?.kind === "booking") {
        setBookedArtist(pending.artistId);
        addBooking({
          artistId: pending.artistId,
          dateISO: pending.dateISO,
          slot: pending.slot,
          amount: pending.amount,
          status: "confirmed",
          ...(pending.figure ? { figure: pending.figure } : {}),
          ...(pending.pkg ? { pkg: pending.pkg } : {}),
        });
        addPayout({
          artistId: pending.artistId,
          artistName: pending.artistName,
          dateISO: pending.dateISO,
          gross: pending.amount,
          fee: pending.amount - pending.payout,
          net: pending.payout,
        });
        mail(
          T.booking,
          [
            pending.artistName,
            `${pending.dateISO} · ${pending.slot} · ${pending.hours} h`,
            ...(pending.figure ? [pending.figure] : []),
          ],
          pending.amount,
        );
        setMsg(T.booking);
      } else if (pending?.kind === "order") {
        checkout();
        mail(T.order, pending.lines.map((l: any) => `${l.quantity || 1} × ${l.name}`), pending.total);
        setMsg(T.order);
      } else if (pending?.kind === "cart") {
        const snap = pending.snapshot;
        completeCart(snap, true, sessionId);
        if (snap.bookings[0]) setBookedArtist(snap.bookings[0].artistId);
        mail(
          T.order,
          [
            ...snap.bookings.map((b: any) => `${b.dateISO} · ${b.slot} · ${b.hours} h`),
            ...snap.shop.map((l: any) => `${l.qty} × #${l.shopId}`),
            ...(snap.requests.length ? [`${snap.requests.length} × Torten-Anfrage`] : []),
          ],
          pending.total,
        );
        setMsg(snap.bookings.length ? T.booking : T.order);
      } else if (pending?.kind === "spotlight") {
        activateSpotlight(pending.spot);
        mail(T.spotlight, [pending.spot.name, pending.spot.city], pending.total);
        setMsg(T.spotlight);
      } else {
        setMsg(T.done);
      }
      clearPending();
    })();
  }, [sessionId, addBooking, checkout, addPayout, completeCart, fmt, T]);

  return (
    <div className="page active">
      <div className="checkout-page">
        <h1 className="checkout-title">{T.title}</h1>
        <p className="checkout-msg">{msg || T.checking}</p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button className="btn-primary" onClick={() => navigate({ to: "/dashboard" })}>
            {T.dash}
          </button>
          <button className="btn-secondary" onClick={() => navigate({ to: "/" })}>
            {T.more}
          </button>
        </div>
      </div>
      {booked && (
        <div className="ui26 addon-zone addon-after">
          <AddOnShelf
            deco={suggestForArtist(booked, String(L(booked.loc))).deco.slice(0, 4)}
            sweets={suggestForArtist(booked, String(L(booked.loc))).sweets.slice(0, 3)}
            title={T.addonsH}
            sub={T.addonsP}
          />
        </div>
      )}
    </div>
  );
}
