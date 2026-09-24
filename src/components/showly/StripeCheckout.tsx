import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createCartCheckout, createShowlyCheckout, type CheckoutLineInput } from "@/utils/payments.functions";

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
