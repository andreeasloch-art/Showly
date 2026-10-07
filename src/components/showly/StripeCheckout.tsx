import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createCartCheckout, createShowlyCheckout, releaseCartHold, type CheckoutLineInput } from "@/utils/payments.functions";
import { useEffect, useRef, useState } from "react";

export function StripeCheckout({
  lines,
  description,
  customerEmail,
  returnUrl,
  locale,
}: {
  lines: CheckoutLineInput[];
  description: string;
  customerEmail?: string;
  returnUrl?: string;
  locale?: "de" | "en" | "es";
}) {
  const fetchClientSecret = async (): Promise<string> => {
    const result = await createShowlyCheckout({
      data: {
        lines,
        description,
        ...(customerEmail ? { customerEmail } : {}),
        returnUrl:
          returnUrl ||
          `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
        environment: getStripeEnvironment(),
        ...(locale ? { locale } : {}),
      },
    });
    if ("error" in result) throw new Error(result.error);
    if (!result.clientSecret) throw new Error("Stripe did not return a client secret");
    return result.clientSecret;
  };

  return (
    <div id="checkout">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}

/** Zahlungsmaske für den ganzen Warenkorb. Beträge rechnet der Server. */
export function StripeCartCheckout({
  shop,
  bookings,
  sweets = [],
  customerEmail,
  locale,
}: {
  shop: { shopId: number; mode: "rent" | "buy"; qty: number }[];
  bookings: {
    artistId: number;
    hours: number;
    pkg?: string;
    dateISO: string;
    slot: string;
  }[];
  sweets?: { sweetId: number; qty: number; dateISO: string }[];
  customerEmail?: string | undefined;
  locale?: "de" | "en" | "es";
}) {
  /* Künstler-Termine sind während des Bezahlens reserviert (createCartCheckout).
     Bricht jemand ab, wird die Reservierung sofort freigegeben; nach der
     Zahlung macht recordCart daraus die Buchung. */
  const [hold, setHold] = useState<{ key: string; until: string } | null>(null);
  const [err, setErr] = useState("");
  const done = useRef(false);
  const holdRef = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (holdRef.current && !done.current) void releaseCartHold({ data: { holdKey: holdRef.current } }).catch(() => undefined);
    },
    [],
  );
  const fetchClientSecret = async (): Promise<string> => {
    const result = await createCartCheckout({
      data: {
        shop,
        bookings,
        ...(sweets.length ? { sweets } : {}),
        ...(customerEmail ? { customerEmail } : {}),
        returnUrl: `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
        environment: getStripeEnvironment(),
        ...(locale ? { locale } : {}),
      },
    });
    if ("error" in result) {
      setErr(result.error);
      throw new Error(result.error);
    }
    if (!result.clientSecret) throw new Error("Stripe did not return a client secret");
    if (result.holdKey && result.holdUntil) {
      holdRef.current = result.holdKey;
      setHold({ key: result.holdKey, until: result.holdUntil });
    }
    return result.clientSecret;
  };
  const until = hold ? new Date(hold.until).toLocaleTimeString(locale === "en" ? "en-GB" : locale === "es" ? "es-ES" : "de-DE", { hour: "2-digit", minute: "2-digit" }) : "";
  return (
    <div id="checkout">
      {err && (
        <p className="checkout-hold checkout-hold-err" role="alert">
          {err}
        </p>
      )}
      {hold && (
        <p className="checkout-hold" role="status">
          {locale === "en"
            ? `Your artist dates are reserved for you until ${until}. If you don't pay by then, they become available again.`
            : locale === "es"
              ? `Tus citas con artistas están reservadas para ti hasta las ${until}. Si no pagas antes, vuelven a quedar libres.`
              : `Deine Künstler-Termine sind bis ${until} Uhr für dich reserviert. Bezahlst du bis dahin nicht, werden sie wieder frei.`}
        </p>
      )}
      <EmbeddedCheckoutProvider
        stripe={getStripe()}
        options={{
          fetchClientSecret,
          onComplete: () => {
            done.current = true;
          },
        }}
      >
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
